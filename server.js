import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load .env file
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================
const PORT = process.env.PORT || 8000;
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Email Configuration
const EMAIL_CONFIG = {
  enabled: process.env.EMAIL_ENABLED === 'true',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  fromEmail: process.env.FROM_EMAIL || '',
  recipients: (process.env.EMAIL_RECIPIENTS || '').split(',').filter(e => e.trim()),
  cooldownMinutes: parseInt(process.env.EMAIL_COOLDOWN || '60'),
  // Alert location - where to check darkness (default: Seattle, WA)
  alertLatitude: parseFloat(process.env.ALERT_LATITUDE || '47.6'),
  alertLongitude: parseFloat(process.env.ALERT_LONGITUDE || '-122.3'),
  alertLocationName: process.env.ALERT_LOCATION_NAME || 'Seattle, WA'
};

// NOAA API endpoints - Using DSCOVR/ACE real-time solar wind data
const NOAA_APIS = {
  plasma: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json',
  mag: 'https://services.swpc.noaa.gov/products/solar-wind/mag-7-day.json',
  scales: 'https://services.swpc.noaa.gov/products/noaa-scales.json',
  // OVATION Aurora Model - 30-90 min forecast with lat/lon aurora probability
  ovation: 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json'
};

// OVATION cache (separate from main cache - larger data)
const ovationCache = { data: null, time: 0 };

// May 10-11, 2024 G4 Storm Reference Values
// This was the strongest storm in 20+ years, aurora visible as far south as Florida
const G4_BASELINE = {
  speed: 750,           // km/s - Peak solar wind speed during G4
  density: 25,          // p/cm³ - Peak particle density
  bz: -30,              // nT - Peak southward Bz (negative = southward)
  bt: 40,               // nT - Peak total field
  by: 20,               // nT - East-west component
  temperature: 500000,  // K - Plasma temperature
  pressure: 15          // nPa - Dynamic pressure
};

// ============================================================================
// Cache & State
// ============================================================================
const cache = { data: null, time: 0 };
const cloudCache = {};
const emailState = { lastAlert: 0 };

// ============================================================================
// Helper Functions
// ============================================================================
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
    https.get(url, { headers: { 'User-Agent': 'AuroraTracker/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON')); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ============================================================================
// OVATION Aurora Model - NOAA's official aurora forecast
// ============================================================================
async function getOvationForecast(lat, lon) {
  try {
    // Cache OVATION data for 10 minutes (it updates every ~30 min)
    if (!ovationCache.data || Date.now() - ovationCache.time > 10 * 60 * 1000) {
      console.log('[OVATION] Fetching aurora forecast...');
      ovationCache.data = await fetchJSON(NOAA_APIS.ovation);
      ovationCache.time = Date.now();
    }
    
    const ov = ovationCache.data;
    if (!ov || !ov.coordinates) return null;
    
    // Find aurora probability at user's location
    // OVATION data: [lon, lat, aurora_prob] for entire globe
    const roundLat = Math.round(lat);
    const roundLon = Math.round(((lon % 360) + 360) % 360); // Normalize to 0-359
    
    // Find closest point
    let closest = null;
    let minDist = Infinity;
    
    for (const coord of ov.coordinates) {
      const [cLon, cLat, prob] = coord;
      const dist = Math.abs(cLat - roundLat) + Math.abs(cLon - roundLon);
      if (dist < minDist) {
        minDist = dist;
        closest = { lat: cLat, lon: cLon, probability: prob };
      }
    }
    
    // Find max probability in user's region (within 5° for horizon viewing)
    let maxInRegion = 0;
    let maxLat = null;
    for (const coord of ov.coordinates) {
      const [cLon, cLat, prob] = coord;
      if (Math.abs(cLon - roundLon) <= 30 && cLat > roundLat && cLat <= roundLat + 15) {
        if (prob > maxInRegion) {
          maxInRegion = prob;
          maxLat = cLat;
        }
      }
    }
    
    return {
      observationTime: ov['Observation Time'],
      forecastTime: ov['Forecast Time'],
      atLocation: closest?.probability || 0,
      nearbyMax: maxInRegion,
      nearbyMaxLat: maxLat,
      viewable: closest?.probability >= 5 || maxInRegion >= 20
    };
  } catch (e) {
    console.error('[OVATION] Error:', e.message);
    return null;
  }
}

// ============================================================================
// Process Space Weather Data with Full Analysis
// ============================================================================
function processSpaceWeatherData(plasma, mag, scales) {
  try {
    // Skip header row (first row is column names)
    const plasmaData = plasma.slice(1);
    const magData = mag.slice(1);
    
    // Get recent valid readings
    const recentPlasma = plasmaData.slice(-10).filter(p => p[1] && p[2] && !isNaN(parseFloat(p[1])));
    const recentMag = magData.slice(-10).filter(m => m[3] && !isNaN(parseFloat(m[3])));
    
    if (!recentPlasma.length || !recentMag.length) {
      console.log('[Data] No valid readings found');
      throw new Error('No valid data');
    }

    const latestPlasma = recentPlasma[recentPlasma.length - 1];
    const latestMag = recentMag[recentMag.length - 1];
    
    // NOAA Scales: 0=current observed, 1=today predicted, 2=tomorrow, 3=day after
    const currentScale = scales['0'];
    const predictedScale = scales['1'];

    // Debug log
    console.log('[Data] Plasma entry:', latestPlasma);
    console.log('[Data] Mag entry:', latestMag);

    // Plasma data format: [time, density, speed, temperature]
    // Note: NOAA format has density at [1], speed at [2], temp at [3]
    const density = parseFloat(latestPlasma[1]) || 0;
    const speed = parseFloat(latestPlasma[2]) || 0;
    const temperature = parseFloat(latestPlasma[3]) || 0;
    
    // Mag data format: [time, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt]
    // Indices: bx=[1], by=[2], bz=[3], lon=[4], lat=[5], bt=[6]
    const bx = parseFloat(latestMag[1]) || 0;       // Sunward component
    const by = parseFloat(latestMag[2]) || 0;       // East-west component
    const bz = parseFloat(latestMag[3]) || 0;       // North-south (KEY!)
    const bt = parseFloat(latestMag[6]) || Math.sqrt(bx*bx + by*by + bz*bz); // Total field

    // DERIVED CALCULATIONS - These are what really matter for aurora
    
    // 1. Dynamic Pressure (nPa) - How hard solar wind hits magnetosphere
    // Formula: P = 1.6726e-6 * n * v²  (n in cm⁻³, v in km/s)
    const pressure = (1.6726e-6 * density * speed * speed).toFixed(2);

    // 2. IMF Clock Angle (degrees) - Direction of magnetic field
    // 180° = pure southward (best for aurora)
    const clockAngle = Math.round((Math.atan2(by, bz) * 180 / Math.PI + 360) % 360);

    // 3. Southward Bz Duration (from last 60 min of data)
    // Magnetometer data format: [time, bx_gsm, by_gsm, bz_gsm, lon_gsm, lat_gsm, bt]
    // Bz is at index 3, NOT index 4 (which is lon_gsm)
    // Data is per-minute, so 60 entries = 60 minutes
    const last60minMag = mag.slice(-60);
    const bzSouthCount = last60minMag.filter(m => parseFloat(m[3]) < -3).length;
    const bzSouthDuration = bzSouthCount; // minutes (1 entry = 1 minute)

    // 4. Calculate individual scores vs G4 baseline
    const scores = {
      bz: Math.min(100, Math.round((Math.abs(bz) / Math.abs(G4_BASELINE.bz)) * 100)),
      speed: Math.min(100, Math.round((speed / G4_BASELINE.speed) * 100)),
      density: Math.min(100, Math.round((density / G4_BASELINE.density) * 100)),
      bt: Math.min(100, Math.round((bt / G4_BASELINE.bt) * 100)),
      pressure: Math.min(100, Math.round((parseFloat(pressure) / G4_BASELINE.pressure) * 100)),
      temperature: Math.min(100, Math.round((temperature / G4_BASELINE.temperature) * 100))
    };

    // 5. Overall G4 Similarity Score (weighted)
    // Bz is most critical - without southward Bz, no aurora regardless of other factors
    let similarity = Math.round(
      scores.bz * 0.40 +        // Bz is THE key factor
      scores.speed * 0.20 +     // Speed determines impact strength
      scores.density * 0.15 +   // Density = particle count
      scores.bt * 0.10 +        // Total field strength
      scores.pressure * 0.10 +  // Dynamic pressure
      scores.temperature * 0.05 // Temperature (minor factor)
    );

    // Bonus for sustained southward Bz
    if (bzSouthDuration >= 20 && bz < -5) similarity += 10;
    // Bonus for very strong conditions
    if (bz < -15) similarity += 5;
    if (speed > 600) similarity += 5;
    
    similarity = Math.min(similarity, 99);

    // 6. Aurora Power Index estimate (GW) - based on pressure and Bz
    const auroraPower = Math.round(Math.abs(bz) * parseFloat(pressure) * 2);

    // NOAA G-Scale - Current Observed
    const gScale = parseInt(currentScale?.G?.Scale) || 0;
    const gText = currentScale?.G?.Text || 'none';
    const gObservedTime = currentScale?.DateStamp && currentScale?.TimeStamp 
      ? `${currentScale.DateStamp}T${currentScale.TimeStamp}Z` : null;
    
    // NOAA G-Scale - Predicted (today's max forecast)
    const gPredicted = parseInt(predictedScale?.G?.Scale) || 0;
    const gPredictedText = predictedScale?.G?.Text || 'none';
    const gPredictedTime = predictedScale?.DateStamp && predictedScale?.TimeStamp
      ? `${predictedScale.DateStamp}T${predictedScale.TimeStamp}Z` : null;

    const data = {
      time: latestPlasma[0],
      // Raw measurements
      speed: Math.round(speed),
      density: parseFloat(density.toFixed(1)),
      temperature: Math.round(temperature),
      bz: parseFloat(bz.toFixed(1)),
      bt: parseFloat(bt.toFixed(1)),
      bx: parseFloat(bx.toFixed(1)),
      by: parseFloat(by.toFixed(1)),
      // Derived values
      pressure: parseFloat(pressure),
      clockAngle,
      bzSouthDuration,
      auroraPower,
      // Scores
      scores,
      similarity,
      // NOAA official - Current Observed
      gScale,
      gText,
      gObservedTime,
      // NOAA official - Predicted
      gPredicted,
      gPredictedText,
      gPredictedTime,
      // G4 baseline for comparison
      baseline: G4_BASELINE
    };

    return data;
  } catch (e) {
    console.error('[Data] Processing error:', e.message);
    return getMockData();
  }
}

function getMockData() {
  return {
    time: new Date().toISOString(),
    speed: 380, density: 4.5, temperature: 95000,
    bz: -1.5, bt: 5.2, bx: 2.1, by: 3.8,
    pressure: 1.2, clockAngle: 45,
    bzSouthDuration: 0, auroraPower: 1,
    scores: { bz: 5, speed: 51, density: 18, bt: 13, pressure: 8, temperature: 19 },
    similarity: 12, gScale: 0, gText: 'none',
    baseline: G4_BASELINE
  };
}

// ============================================================================
// Cloud Coverage (Open-Meteo API with hourly forecast)
// ============================================================================
async function fetchCloudData(lat, lon) {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = cloudCache[cacheKey];
  
  if (cached && Date.now() - cached.time < 15 * 60 * 1000) {
    return cached.data;
  }

  try {
    // Get current + next 6 hours forecast
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,weather_code&hourly=cloud_cover,cloud_cover_low&forecast_hours=6&timezone=auto`;
    const data = await fetchJSON(url);
    
    const current = data.current || {};
    const hourly = data.hourly || {};
    
    // Calculate 6-hour trend
    const hourlyLow = hourly.cloud_cover_low || [];
    const trend = hourlyLow.length >= 2 
      ? (hourlyLow[hourlyLow.length - 1] - hourlyLow[0]) > 10 ? 'increasing' 
        : (hourlyLow[0] - hourlyLow[hourlyLow.length - 1]) > 10 ? 'clearing' : 'stable'
      : 'unknown';

    const result = {
      total: current.cloud_cover || 0,
      low: current.cloud_cover_low || 0,
      mid: current.cloud_cover_mid || 0,
      high: current.cloud_cover_high || 0,
      visibility: current.visibility || 10000,
      weatherCode: current.weather_code || 0,
      trend,
      forecast: hourlyLow,
      time: current.time || new Date().toISOString()
    };

    cloudCache[cacheKey] = { data: result, time: Date.now() };
    console.log(`[Cloud] ${cacheKey}: ${result.total}% (Low: ${result.low}%, Mid: ${result.mid}%, High: ${result.high}%) - ${trend}`);
    return result;
  } catch (e) {
    console.error('[Cloud] Error:', e.message);
    return { total: 0, low: 0, mid: 0, high: 0, visibility: 10000, trend: 'unknown', error: true };
  }
}

// ============================================================================
// Daily Summary - Analyze Yesterday's Aurora Conditions
// ============================================================================
async function generateDailySummary() {
  try {
    console.log('[Daily] Generating yesterday\'s aurora summary...');
    
    // Fetch 7-day data (contains yesterday)
    const [plasma, mag] = await Promise.all([
      fetchJSON(NOAA_APIS.plasma),
      fetchJSON(NOAA_APIS.mag)
    ]);
    
    // Get yesterday's date range (PST = UTC-8)
    const now = new Date();
    const pstOffset = -8 * 60 * 60 * 1000;
    const pstNow = new Date(now.getTime() + pstOffset);
    const yesterdayPST = new Date(pstNow);
    yesterdayPST.setDate(yesterdayPST.getDate() - 1);
    
    const yesterdayStart = new Date(yesterdayPST.setHours(0, 0, 0, 0)).toISOString().slice(0, 10);
    
    // Filter data for yesterday (skip header row)
    const plasmaData = plasma.slice(1).filter(p => p[0] && p[0].startsWith(yesterdayStart));
    const magData = mag.slice(1).filter(m => m[0] && m[0].startsWith(yesterdayStart));
    
    if (!plasmaData.length || !magData.length) {
      console.log('[Daily] No data available for yesterday');
      return null;
    }
    
    // Calculate statistics for yesterday
    const speeds = plasmaData.map(p => parseFloat(p[2])).filter(v => !isNaN(v));
    const densities = plasmaData.map(p => parseFloat(p[1])).filter(v => !isNaN(v));
    const bzValues = magData.map(m => parseFloat(m[3])).filter(v => !isNaN(v));
    const btValues = magData.map(m => parseFloat(m[6])).filter(v => !isNaN(v));
    
    const stats = {
      date: yesterdayStart,
      dataPoints: plasmaData.length,
      speed: {
        min: Math.round(Math.min(...speeds)),
        max: Math.round(Math.max(...speeds)),
        avg: Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
      },
      density: {
        min: Math.min(...densities).toFixed(1),
        max: Math.max(...densities).toFixed(1),
        avg: (densities.reduce((a, b) => a + b, 0) / densities.length).toFixed(1)
      },
      bz: {
        min: Math.min(...bzValues).toFixed(1),
        max: Math.max(...bzValues).toFixed(1),
        avg: (bzValues.reduce((a, b) => a + b, 0) / bzValues.length).toFixed(1)
      },
      bt: {
        min: Math.min(...btValues).toFixed(1),
        max: Math.max(...btValues).toFixed(1),
        avg: (btValues.reduce((a, b) => a + b, 0) / btValues.length).toFixed(1)
      }
    };
    
    // Count hours with good aurora conditions (Bz < -5 nT)
    const goodBzCount = bzValues.filter(bz => bz < -5).length;
    const goodBzHours = Math.round(goodBzCount / (bzValues.length / 24) * 24 / 60); // Approximate hours
    
    // Calculate peak G4 similarity for yesterday
    let peakSimilarity = 0;
    let peakTime = '';
    
    for (let i = 0; i < Math.min(plasmaData.length, magData.length); i++) {
      const speed = parseFloat(plasmaData[i][2]) || 0;
      const density = parseFloat(plasmaData[i][1]) || 0;
      const bz = parseFloat(magData[i][3]) || 0;
      const bt = parseFloat(magData[i][6]) || 0;
      const pressure = 1.6726e-6 * density * speed * speed;
      
      const scores = {
        bz: Math.min(100, Math.round((Math.abs(bz) / 30) * 100)),
        speed: Math.min(100, Math.round((speed / 750) * 100)),
        density: Math.min(100, Math.round((density / 25) * 100)),
        bt: Math.min(100, Math.round((bt / 40) * 100)),
        pressure: Math.min(100, Math.round((pressure / 15) * 100))
      };
      
      const similarity = Math.round(
        scores.bz * 0.40 + scores.speed * 0.20 + scores.density * 0.15 + 
        scores.bt * 0.10 + scores.pressure * 0.10
      );
      
      if (similarity > peakSimilarity) {
        peakSimilarity = similarity;
        peakTime = plasmaData[i][0];
      }
    }
    
    // Determine overall verdict
    let verdict, emoji, description;
    if (peakSimilarity >= 50 && parseFloat(stats.bz.min) < -10) {
      verdict = 'EXCELLENT';
      emoji = '🌟';
      description = 'Outstanding aurora conditions! Visible at mid-latitudes.';
    } else if (peakSimilarity >= 35 && parseFloat(stats.bz.min) < -5) {
      verdict = 'GOOD';
      emoji = '✨';
      description = 'Good aurora activity! Visible at higher latitudes.';
    } else if (peakSimilarity >= 20 || parseFloat(stats.bz.min) < -3) {
      verdict = 'MODERATE';
      emoji = '🌙';
      description = 'Some aurora activity possible at high latitudes.';
    } else {
      verdict = 'QUIET';
      emoji = '😴';
      description = 'Minimal aurora activity. Better luck next time!';
    }
    
    return { stats, goodBzHours, peakSimilarity, peakTime, verdict, emoji, description };
  } catch (e) {
    console.error('[Daily] Error generating summary:', e.message);
    return null;
  }
}

async function sendDailySummaryEmail() {
  const summary = await generateDailySummary();
  if (!summary) {
    console.log('[Daily] Skipping email - no summary data');
    return;
  }
  
  const { stats, goodBzHours, peakSimilarity, peakTime, verdict, emoji, description } = summary;
  
  // Calculate additional insights
  const bzMin = parseFloat(stats.bz.min);
  const speedMax = stats.speed.max;
  const densityMax = parseFloat(stats.density.max);
  
  // Determine visibility latitude at peak
  let visibleLat = '70°N+ (Arctic only)';
  if (bzMin < -25) visibleLat = '35°N (Southern US)';
  else if (bzMin < -20) visibleLat = '40°N (Northern CA, NY)';
  else if (bzMin < -15) visibleLat = '45°N (OR, WI, MI)';
  else if (bzMin < -10) visibleLat = '50°N (WA, MN, ME)';
  else if (bzMin < -5) visibleLat = '55°N (Canada border)';
  else if (bzMin < -3) visibleLat = '60°N (Alaska, Canada)';
  
  // Calculate dynamic pressure at peak
  const peakPressure = (1.6726e-6 * densityMax * speedMax * speedMax).toFixed(2);
  
  // G-scale estimate based on Bz
  let gScaleEstimate = 'G0 (Quiet)';
  if (bzMin < -25) gScaleEstimate = 'G4-G5 (Severe/Extreme)';
  else if (bzMin < -15) gScaleEstimate = 'G3 (Strong)';
  else if (bzMin < -10) gScaleEstimate = 'G2 (Moderate)';
  else if (bzMin < -5) gScaleEstimate = 'G1 (Minor)';
  
  // Best viewing window (when Bz was most negative)
  const peakTimeFormatted = peakTime ? new Date(peakTime).toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' 
  }) + ' PST' : 'N/A';
  
  const subject = `${emoji} Aurora Daily Summary: ${verdict} conditions on ${stats.date}`;
  const body = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #0d1117; color: #e6edf3; padding: 0;">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 28px; color: #ffffff;">${emoji} Aurora Daily Report</h1>
        <p style="margin: 10px 0 0; font-size: 16px; color: #8b949e;">${stats.date}</p>
      </div>
      
      <!-- Verdict Banner -->
      <div style="background: ${verdict === 'EXCELLENT' ? '#238636' : verdict === 'GOOD' ? '#1f6feb' : verdict === 'MODERATE' ? '#9e6a03' : '#484f58'}; padding: 25px; text-align: center;">
        <h2 style="margin: 0; font-size: 32px; color: white;">${verdict}</h2>
        <p style="margin: 10px 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">${description}</p>
      </div>
      
      <!-- Quick Stats Grid -->
      <div style="padding: 25px; background: #161b22;">
        <h3 style="color: #58a6ff; margin: 0 0 15px; font-size: 18px;">📊 Quick Stats</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 15px; background: #21262d; border-radius: 8px 0 0 0; text-align: center; width: 25%;">
              <div style="font-size: 24px; font-weight: bold; color: #58a6ff;">${peakSimilarity}%</div>
              <div style="font-size: 12px; color: #8b949e; margin-top: 5px;">Peak G4 Match</div>
            </td>
            <td style="padding: 15px; background: #21262d; text-align: center; width: 25%;">
              <div style="font-size: 24px; font-weight: bold; color: ${bzMin < -10 ? '#3fb950' : bzMin < -5 ? '#d29922' : '#f85149'};">${stats.bz.min} nT</div>
              <div style="font-size: 12px; color: #8b949e; margin-top: 5px;">Min Bz</div>
            </td>
            <td style="padding: 15px; background: #21262d; text-align: center; width: 25%;">
              <div style="font-size: 24px; font-weight: bold; color: #e6edf3;">${stats.speed.max}</div>
              <div style="font-size: 12px; color: #8b949e; margin-top: 5px;">Max km/s</div>
            </td>
            <td style="padding: 15px; background: #21262d; border-radius: 0 8px 0 0; text-align: center; width: 25%;">
              <div style="font-size: 24px; font-weight: bold; color: #e6edf3;">~${goodBzHours}h</div>
              <div style="font-size: 12px; color: #8b949e; margin-top: 5px;">Good Bz Time</div>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Detailed Metrics Table -->
      <div style="padding: 0 25px 25px; background: #161b22;">
        <h3 style="color: #58a6ff; margin: 0 0 15px; font-size: 18px;">📈 Detailed Metrics</h3>
        <table style="width: 100%; border-collapse: collapse; background: #21262d; border-radius: 8px; overflow: hidden;">
          <tr style="background: #30363d;">
            <th style="padding: 12px; text-align: left; color: #8b949e; font-weight: 600;">Metric</th>
            <th style="padding: 12px; text-align: center; color: #8b949e; font-weight: 600;">Min</th>
            <th style="padding: 12px; text-align: center; color: #8b949e; font-weight: 600;">Max</th>
            <th style="padding: 12px; text-align: center; color: #8b949e; font-weight: 600;">Avg</th>
            <th style="padding: 12px; text-align: center; color: #8b949e; font-weight: 600;">G4 Ref</th>
          </tr>
          <tr>
            <td style="padding: 12px; border-top: 1px solid #30363d; color: #e6edf3;">🧭 Bz Field (nT)</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: ${bzMin < -10 ? '#3fb950' : '#e6edf3'}; font-weight: ${bzMin < -10 ? 'bold' : 'normal'};">${stats.bz.min}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.bz.max}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.bz.avg}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #8b949e;">-30</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-top: 1px solid #30363d; color: #e6edf3;">🌬️ Speed (km/s)</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.speed.min}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: ${stats.speed.max > 600 ? '#3fb950' : '#e6edf3'};">${stats.speed.max}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.speed.avg}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #8b949e;">750</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-top: 1px solid #30363d; color: #e6edf3;">📦 Density (p/cm³)</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.density.min}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.density.max}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.density.avg}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #8b949e;">25</td>
          </tr>
          <tr>
            <td style="padding: 12px; border-top: 1px solid #30363d; color: #e6edf3;">🔋 Bt Field (nT)</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.bt.min}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.bt.max}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #e6edf3;">${stats.bt.avg}</td>
            <td style="padding: 12px; border-top: 1px solid #30363d; text-align: center; color: #8b949e;">40</td>
          </tr>
        </table>
      </div>
      
      <!-- Analysis Section -->
      <div style="padding: 0 25px 25px; background: #161b22;">
        <h3 style="color: #58a6ff; margin: 0 0 15px; font-size: 18px;">🔬 Analysis</h3>
        <div style="background: #21262d; border-radius: 8px; padding: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #8b949e;">Estimated Storm Level:</td>
              <td style="padding: 8px 0; color: #e6edf3; font-weight: bold;">${gScaleEstimate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #8b949e;">Visible Latitude (at peak):</td>
              <td style="padding: 8px 0; color: #e6edf3; font-weight: bold;">${visibleLat}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #8b949e;">Peak Dynamic Pressure:</td>
              <td style="padding: 8px 0; color: #e6edf3; font-weight: bold;">${peakPressure} nPa</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #8b949e;">Best Viewing Window:</td>
              <td style="padding: 8px 0; color: #e6edf3; font-weight: bold;">${peakTimeFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #8b949e;">Data Points Analyzed:</td>
              <td style="padding: 8px 0; color: #e6edf3;">${stats.dataPoints.toLocaleString()}</td>
            </tr>
          </table>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background: #0d1117; padding: 20px 25px; border-top: 1px solid #30363d; border-radius: 0 0 12px 12px;">
        <p style="margin: 0; font-size: 13px; color: #8b949e; text-align: center;">
          📅 Daily summary sent at 8:00 AM PST<br>
          🌌 <a href="https://aurora-tracker.azurewebsites.net" style="color: #58a6ff; text-decoration: none;">View Live Aurora Tracker →</a>
        </p>
      </div>
    </div>
  `;
  
  const sent = await sendEmail(subject, body);
  console.log(`[Daily] Summary email ${sent ? 'sent successfully' : 'failed to send'}`);
  return sent;
}

// File to persist last daily summary date (survives restarts)
const DAILY_SUMMARY_STATE_FILE = path.join(__dirname, '.daily-summary-state.json');

function getLastDailySummaryDate() {
  try {
    if (fs.existsSync(DAILY_SUMMARY_STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(DAILY_SUMMARY_STATE_FILE, 'utf8'));
      return state.lastSentDate || null;
    }
  } catch (e) {
    console.error('[Daily] Error reading state file:', e.message);
  }
  return null;
}

function saveLastDailySummaryDate(date) {
  try {
    fs.writeFileSync(DAILY_SUMMARY_STATE_FILE, JSON.stringify({ lastSentDate: date }));
  } catch (e) {
    console.error('[Daily] Error saving state file:', e.message);
  }
}

// Schedule daily summary at 8 AM PST (or catch up on startup if missed)
function scheduleDailySummary() {
  // Load persisted state (survives server restarts)
  let lastSentDate = getLastDailySummaryDate();
  
  const checkAndSchedule = () => {
    const now = new Date();
    // Convert to PST (UTC-8)
    const pstHours = (now.getUTCHours() - 8 + 24) % 24;
    const pstMinutes = now.getUTCMinutes();
    const todayDate = now.toISOString().slice(0, 10);
    
    // Check if it's 8:00-8:04 AM PST and haven't sent today
    // Using 5-minute window to avoid race conditions
    if (pstHours === 8 && pstMinutes < 5 && lastSentDate !== todayDate) {
      lastSentDate = todayDate;
      saveLastDailySummaryDate(todayDate);
      console.log(`[Daily] Triggering daily summary at ${pstHours}:${pstMinutes.toString().padStart(2, '0')} PST`);
      sendDailySummaryEmail();
    }
  };
  
  // Check on startup: if we missed today's summary (it's after 8 AM and we haven't sent)
  const checkStartupCatchup = () => {
    const now = new Date();
    const pstHours = (now.getUTCHours() - 8 + 24) % 24;
    const todayDate = now.toISOString().slice(0, 10);
    
    // If it's after 8 AM PST and we haven't sent today's summary
    if (pstHours >= 8 && lastSentDate !== todayDate) {
      console.log(`[Daily] Startup catch-up: Last sent on ${lastSentDate || 'never'}, sending today's summary now`);
      lastSentDate = todayDate;
      saveLastDailySummaryDate(todayDate);
      sendDailySummaryEmail();
    } else if (lastSentDate === todayDate) {
      console.log(`[Daily] Already sent today's summary (${todayDate})`);
    } else {
      console.log(`[Daily] Waiting for 8:00 AM PST to send summary (current: ${pstHours}:${now.getUTCMinutes().toString().padStart(2, '0')} PST)`);
    }
  };
  
  // Check every minute for scheduled time
  setInterval(checkAndSchedule, 60 * 1000);
  // Check immediately on startup for catch-up
  checkStartupCatchup();
  console.log('📅 Daily summary scheduled for 8:00 AM PST');
}

// ============================================================================
// Email Notifications
// ============================================================================

/**
 * Calculate sun altitude for a given location and time.
 * Used to determine if it's dark enough for aurora viewing.
 * 
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees  
 * @param {Date} date - Date/time to check (default: now)
 * @returns {object} - Sun altitude and darkness info
 */
function getSunPosition(lat, lon, date = new Date()) {
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  
  // Day of year
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  // Solar declination (simplified)
  const declination = -23.45 * Math.cos(toRad((360 / 365) * (dayOfYear + 10)));
  
  // Time of day in hours (UTC)
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  
  // Solar hour angle
  const solarNoon = 12 - (lon / 15);
  const hourAngle = (utcHours - solarNoon) * 15;
  
  // Sun altitude angle
  const latRad = toRad(lat);
  const decRad = toRad(declination);
  const haRad = toRad(hourAngle);
  
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + 
                 Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const altitude = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
  
  return {
    altitude: Math.round(altitude * 10) / 10,
    isDark: altitude < -6,        // Civil twilight or darker
    canViewAurora: altitude < -6, // Need at least civil twilight for aurora
    level: altitude < -18 ? 'night' : 
      altitude < -12 ? 'nautical' :
        altitude < -6 ? 'civil' :
          altitude < 0 ? 'horizon' : 'day'
  };
}

/**
 * Calculate hours until dark for a location
 */
function getHoursUntilDark(lat, lon) {
  const now = new Date();
  const sun = getSunPosition(lat, lon, now);
  
  if (sun.canViewAurora) return 0; // Already dark
  
  // Check each hour ahead to find when it gets dark
  for (let h = 1; h <= 18; h++) {
    const future = new Date(now.getTime() + h * 60 * 60 * 1000);
    const futureSun = getSunPosition(lat, lon, future);
    if (futureSun.canViewAurora) {
      // Refine to quarter hours
      for (let m = 0; m < 60; m += 15) {
        const precise = new Date(now.getTime() + (h - 1) * 60 * 60 * 1000 + m * 60 * 1000);
        const preciseSun = getSunPosition(lat, lon, precise);
        if (preciseSun.canViewAurora) {
          return Math.round(((h - 1) + m / 60) * 10) / 10;
        }
      }
      return h;
    }
  }
  return null; // Won't get dark in 18 hours (polar day)
}

async function sendEmail(subject, body) {
  if (!EMAIL_CONFIG.enabled || !EMAIL_CONFIG.recipients.length) return false;

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: EMAIL_CONFIG.smtpHost,
      port: EMAIL_CONFIG.smtpPort,
      secure: EMAIL_CONFIG.smtpPort === 465,
      auth: { user: EMAIL_CONFIG.smtpUser, pass: EMAIL_CONFIG.smtpPass }
    });

    for (const recipient of EMAIL_CONFIG.recipients) {
      await transporter.sendMail({
        from: EMAIL_CONFIG.fromEmail,
        to: recipient.trim(),
        subject,
        html: body
      });
    }
    console.log(`[Email] Alert sent to ${EMAIL_CONFIG.recipients.length} recipients`);
    return true;
  } catch (e) {
    console.error('[Email] Failed:', e.message);
    return false;
  }
}

/**
 * Send a startup notification email when the server starts
 */
async function sendStartupEmail() {
  const now = new Date();
  const timeStr = now.toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    dateStyle: 'full',
    timeStyle: 'short'
  });
  
  const subject = '🌌 Aurora Tracker Started';
  const body = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0d1117; color: #e6edf3; padding: 0;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px; color: #ffffff;">🌌 Aurora Tracker</h1>
        <p style="margin: 10px 0 0; font-size: 14px; color: #8b949e;">Server Started Successfully</p>
      </div>
      
      <div style="padding: 25px; background: #161b22;">
        <p style="color: #e6edf3; margin: 0 0 15px;">Hello! Aurora Tracker is now running and monitoring space weather conditions.</p>
        
        <div style="background: #21262d; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #8b949e;">Started:</td>
              <td style="padding: 8px 0; color: #e6edf3;">${timeStr} PST</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #8b949e;">Alert Location:</td>
              <td style="padding: 8px 0; color: #e6edf3;">${EMAIL_CONFIG.alertLocationName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #8b949e;">Recipients:</td>
              <td style="padding: 8px 0; color: #e6edf3;">${EMAIL_CONFIG.recipients.length}</td>
            </tr>
          </table>
        </div>
        
        <p style="color: #8b949e; margin: 0; font-size: 13px;">
          📧 You'll receive GO alerts when aurora conditions are favorable and the sky is dark.<br>
          📅 Daily summaries are sent at 8:00 AM PST.
        </p>
      </div>
      
      <div style="background: #0d1117; padding: 15px 25px; border-top: 1px solid #30363d; border-radius: 0 0 12px 12px; text-align: center;">
        <a href="https://aurora-tracker.azurewebsites.net" style="color: #58a6ff; text-decoration: none; font-size: 13px;">View Live Tracker →</a>
      </div>
    </div>
  `;
  
  const sent = await sendEmail(subject, body);
  if (sent) {
    console.log('[Startup] Welcome email sent');
  }
}

function checkAndSendAlerts(data) {
  const now = Date.now();
  const cooldown = EMAIL_CONFIG.cooldownMinutes * 60 * 1000;

  // Check space weather conditions first
  if (!(data.similarity >= 40 && data.bz < -5 && now - emailState.lastAlert > cooldown)) {
    return; // Conditions not met
  }

  // CHECK DARKNESS - Don't alert during daylight!
  const sun = getSunPosition(EMAIL_CONFIG.alertLatitude, EMAIL_CONFIG.alertLongitude);
  
  if (!sun.canViewAurora) {
    // It's daytime - don't send alert
    const hoursUntilDark = getHoursUntilDark(EMAIL_CONFIG.alertLatitude, EMAIL_CONFIG.alertLongitude);
    console.log(`[Alert] GO conditions detected but it's daytime at ${EMAIL_CONFIG.alertLocationName} (sun: ${sun.altitude}°, dark in ~${hoursUntilDark}h). Skipping alert.`);
    return;
  }

  console.log(`[Alert] GO conditions AND dark sky at ${EMAIL_CONFIG.alertLocationName} (sun: ${sun.altitude}°). Sending alert!`);

  // Calculate visibility latitude
  let visibleLat = '65°N';
  let visibleLocations = 'Alaska, Northern Canada';
  if (data.bz < -25) { visibleLat = '35°N'; visibleLocations = 'Southern US (TX, FL, AZ)'; }
  else if (data.bz < -20) { visibleLat = '40°N'; visibleLocations = 'Northern CA, NY, NV'; }
  else if (data.bz < -15) { visibleLat = '45°N'; visibleLocations = 'OR, WI, MI, MA'; }
  else if (data.bz < -10) { visibleLat = '50°N'; visibleLocations = 'WA, MN, ME, ND'; }
  else if (data.bz < -5) { visibleLat = '55°N'; visibleLocations = 'Canada border states'; }
    
  // Determine urgency level
  const urgency = data.similarity >= 60 ? 'STRONG' : data.similarity >= 50 ? 'GOOD' : 'MODERATE';
  const urgencyColor = data.similarity >= 60 ? '#238636' : data.similarity >= 50 ? '#1f6feb' : '#9e6a03';
    
  // Current time in PST
  const pstTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' 
  });
    
  const subject = `🚨 AURORA GO ALERT: ${urgency} Conditions NOW! (${data.similarity}% G4 Match)`;
  const body = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d1117; color: #e6edf3;">
        
        <!-- Urgent Header -->
        <div style="background: ${urgencyColor}; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 32px; color: white;">🚨 GO NOW!</h1>
          <p style="margin: 10px 0 0; font-size: 18px; color: rgba(255,255,255,0.95);">${urgency} Aurora Conditions Detected</p>
        </div>
        
        <!-- Time Banner -->
        <div style="background: #161b22; padding: 15px; text-align: center; border-bottom: 1px solid #30363d;">
          <span style="font-size: 14px; color: #8b949e;">Alert Time: </span>
          <span style="font-size: 16px; color: #e6edf3; font-weight: bold;">${pstTime} PST</span>
        </div>
        
        <!-- Key Metrics -->
        <div style="padding: 25px; background: #161b22;">
          <h2 style="color: #58a6ff; margin: 0 0 20px; font-size: 18px;">📊 Current Conditions</h2>
          
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 15px; background: #21262d; border-radius: 8px; text-align: center; width: 50%;">
                <div style="font-size: 36px; font-weight: bold; color: #3fb950;">${data.similarity}%</div>
                <div style="font-size: 12px; color: #8b949e; margin-top: 5px;">G4 Storm Match</div>
              </td>
              <td style="width: 10px;"></td>
              <td style="padding: 15px; background: #21262d; border-radius: 8px; text-align: center; width: 50%;">
                <div style="font-size: 36px; font-weight: bold; color: #3fb950;">${data.bz.toFixed(1)} nT</div>
                <div style="font-size: 12px; color: #8b949e; margin-top: 5px;">Bz Field (Southward!)</div>
              </td>
            </tr>
          </table>
          
          <div style="background: #21262d; border-radius: 8px; padding: 20px; margin-top: 15px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #8b949e; width: 50%;">🌬️ Solar Wind Speed:</td>
                <td style="padding: 8px 0; color: #e6edf3; font-weight: bold;">${data.speed} km/s</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8b949e;">⚡ Dynamic Pressure:</td>
                <td style="padding: 8px 0; color: #e6edf3; font-weight: bold;">${data.pressure.toFixed(2)} nPa</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8b949e;">⏱️ Southward Duration:</td>
                <td style="padding: 8px 0; color: #e6edf3; font-weight: bold;">${data.bzSouthDuration} min</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #8b949e;">🧭 Clock Angle:</td>
                <td style="padding: 8px 0; color: #e6edf3; font-weight: bold;">${data.clockAngle}°</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- Visibility Info -->
        <div style="padding: 0 25px 25px; background: #161b22;">
          <div style="background: linear-gradient(135deg, #238636 0%, #1a7f37 100%); border-radius: 8px; padding: 20px;">
            <h3 style="color: white; margin: 0 0 10px; font-size: 16px;">🌍 Where to See It</h3>
            <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 15px;">
              <strong>Visible as far south as:</strong> ${visibleLat}<br>
              <strong>Locations:</strong> ${visibleLocations}
            </p>
          </div>
        </div>
        
        <!-- Action Steps -->
        <div style="padding: 0 25px 25px; background: #161b22;">
          <h2 style="color: #58a6ff; margin: 0 0 15px; font-size: 18px;">✅ What To Do NOW</h2>
          <div style="background: #21262d; border-radius: 8px; padding: 20px;">
            <ol style="margin: 0; padding-left: 20px; color: #e6edf3; line-height: 2;">
              <li><strong>Check local clouds</strong> - Need clear skies to see aurora</li>
              <li><strong>Find a dark location</strong> - Away from city lights</li>
              <li><strong>Face NORTH</strong> - Aurora appears on northern horizon</li>
              <li><strong>Allow 20 min</strong> for eyes to adjust to darkness</li>
              <li><strong>Be patient</strong> - Aurora can pulse and fade</li>
            </ol>
          </div>
        </div>
        
        <!-- Pro Tips -->
        <div style="padding: 0 25px 25px; background: #161b22;">
          <div style="background: #21262d; border-radius: 8px; padding: 15px; border-left: 4px solid #58a6ff;">
            <p style="margin: 0; color: #8b949e; font-size: 13px;">
              💡 <strong style="color: #e6edf3;">Pro Tip:</strong> Use your phone camera to detect faint aurora - cameras are more sensitive than eyes. Take a 5-10 second exposure pointing north.
            </p>
          </div>
        </div>
        
        <!-- Footer -->
        <div style="background: #0d1117; padding: 20px 25px; border-top: 1px solid #30363d;">
          <p style="margin: 0; font-size: 13px; color: #8b949e; text-align: center;">
            🌌 <a href="https://aurora-tracker.azurewebsites.net" style="color: #58a6ff; text-decoration: none;">Open Live Tracker →</a><br>
            <span style="font-size: 11px;">Alert cooldown: ${EMAIL_CONFIG.cooldownMinutes} minutes</span>
          </p>
        </div>
      </div>
    `;
  sendEmail(subject, body);
  emailState.lastAlert = now;
}

// ============================================================================
// Static File Server
// ============================================================================
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ============================================================================
// HTTP Server
// ============================================================================
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 'no-cache');

  const url = new URL(req.url, `http://${req.headers.host}`);

  // API: Solar Wind Data (with full analysis)
  if (url.pathname === '/api/solar-wind') {
    try {
      if (cache.data && Date.now() - cache.time < CACHE_DURATION) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cache.data));
        return;
      }

      console.log('[API] Fetching NOAA data...');
      const [plasma, mag, scales] = await Promise.all([
        fetchJSON(NOAA_APIS.plasma),
        fetchJSON(NOAA_APIS.mag),
        fetchJSON(NOAA_APIS.scales)
      ]);

      const data = processSpaceWeatherData(plasma, mag, scales);
      cache.data = data;
      cache.time = Date.now();

      checkAndSendAlerts(data);

      console.log(`[API] ✅ Similarity: ${data.similarity}% | Bz: ${data.bz}nT | Speed: ${data.speed}km/s | Pressure: ${data.pressure}nPa`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (error) {
      console.error('[API] Error:', error.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(getMockData()));
    }
    return;
  }

  // API: Cloud Coverage
  if (url.pathname === '/api/clouds') {
    try {
      const lat = parseFloat(url.searchParams.get('lat')) || 47.6;
      const lon = parseFloat(url.searchParams.get('lon')) || -122.3;
      const cloudData = await fetchCloudData(lat, lon);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cloudData));
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ total: 0, low: 0, mid: 0, high: 0, error: true }));
    }
    return;
  }

  // API: OVATION Aurora Forecast (NOAA's official model)
  if (url.pathname === '/api/ovation') {
    try {
      const lat = parseFloat(url.searchParams.get('lat')) || 47.6;
      const lon = parseFloat(url.searchParams.get('lon')) || -122.3;
      const forecast = await getOvationForecast(lat, lon);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(forecast || { error: 'No data' }));
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Serve index.html at root
  let filePath;
  if (url.pathname === '/' || url.pathname === '/index.html') {
    filePath = path.join(__dirname, 'src', 'index.html');
  } else {
    filePath = path.join(__dirname, url.pathname);
  }

  filePath = path.normalize(filePath);
  
  // Security: Only allow files from specific directories
  const allowedDirs = [
    path.join(__dirname, 'src'),
    path.join(__dirname, 'public')
  ];
  const isAllowed = allowedDirs.some(dir => filePath.startsWith(dir + path.sep) || filePath === dir);
  
  // Security: Block dot files (like .env, .gitignore)
  const fileName = path.basename(filePath);
  const isDotFile = fileName.startsWith('.');
  
  if (!filePath.startsWith(__dirname) || !isAllowed || isDotFile) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  serveFile(filePath, res);
});

// ============================================================================
// Start Server
// ============================================================================
server.listen(PORT, () => {
  console.log('\n🌌 Aurora Tracker v1.0');
  console.log(`📡 http://localhost:${PORT}\n`);
  console.log('Data sources:');
  console.log('  • NOAA DSCOVR/ACE real-time solar wind');
  console.log('  • NOAA OVATION aurora forecast model');
  console.log('  • Open-Meteo cloud coverage\n');
  
  if (EMAIL_CONFIG.enabled) {
    console.log(`📧 Email alerts: ENABLED (${EMAIL_CONFIG.recipients.length} recipients)`);
    scheduleDailySummary();
    sendStartupEmail();
  } else {
    console.log('📧 Email alerts: DISABLED');
  }
  console.log('');
});
