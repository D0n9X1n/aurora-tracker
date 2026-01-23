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
  cooldownMinutes: parseInt(process.env.EMAIL_COOLDOWN || '60')
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
    const yesterdayEnd = new Date(yesterdayPST.setHours(23, 59, 59, 999)).toISOString().slice(0, 10);
    
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
  
  const subject = `${emoji} Aurora Daily Summary: ${verdict} conditions on ${stats.date}`;
  const body = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a2e;">${emoji} Yesterday's Aurora Summary</h1>
      <p style="font-size: 18px; color: #4a4a6a;"><strong>Date:</strong> ${stats.date}</p>
      
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #00d4aa;">${verdict}</h2>
        <p style="font-size: 16px; margin-bottom: 0;">${description}</p>
      </div>
      
      <h2 style="color: #1a1a2e;">📊 Key Statistics</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr style="background: #f0f0f5;">
          <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Metric</th>
          <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Min</th>
          <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Max</th>
          <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Avg</th>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">🌬️ Solar Wind Speed (km/s)</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.speed.min}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.speed.max}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.speed.avg}</td>
        </tr>
        <tr style="background: #f9f9fc;">
          <td style="padding: 10px; border-bottom: 1px solid #eee;">📦 Density (p/cm³)</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.density.min}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.density.max}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.density.avg}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">🧭 Bz Field (nT)</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee; ${parseFloat(stats.bz.min) < -5 ? 'color: #00aa00; font-weight: bold;' : ''}">${stats.bz.min}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.bz.max}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.bz.avg}</td>
        </tr>
        <tr style="background: #f9f9fc;">
          <td style="padding: 10px; border-bottom: 1px solid #eee;">🔋 Bt Total Field (nT)</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.bt.min}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.bt.max}</td>
          <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${stats.bt.avg}</td>
        </tr>
      </table>
      
      <h2 style="color: #1a1a2e;">🎯 Aurora Metrics</h2>
      <ul style="font-size: 15px; line-height: 1.8;">
        <li><strong>Peak G4 Similarity:</strong> ${peakSimilarity}%${peakTime ? ` (at ${peakTime.slice(11, 16)} UTC)` : ''}</li>
        <li><strong>Hours with Good Bz (&lt;-5 nT):</strong> ~${goodBzHours} hours</li>
        <li><strong>Data Points Analyzed:</strong> ${stats.dataPoints}</li>
      </ul>
      
      <div style="background: #f0f0f5; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <p style="margin: 0; font-size: 13px; color: #666;">
          📍 This summary is generated daily at 8:00 AM PST.<br>
          🔗 Visit your Aurora Tracker for real-time conditions.
        </p>
      </div>
    </div>
  `;
  
  const sent = await sendEmail(subject, body);
  console.log(`[Daily] Summary email ${sent ? 'sent successfully' : 'failed to send'}`);
}

// Schedule daily summary at 8 AM PST
function scheduleDailySummary() {
  const checkAndSchedule = () => {
    const now = new Date();
    // Convert to PST (UTC-8)
    const pstHours = (now.getUTCHours() - 8 + 24) % 24;
    const pstMinutes = now.getUTCMinutes();
    
    // Check if it's 8:00 AM PST (within the first minute)
    if (pstHours === 8 && pstMinutes === 0) {
      sendDailySummaryEmail();
    }
  };
  
  // Check every minute
  setInterval(checkAndSchedule, 60 * 1000);
  console.log('📅 Daily summary scheduled for 8:00 AM PST');
}

// ============================================================================
// Email Notifications
// ============================================================================
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

function checkAndSendAlerts(data) {
  const now = Date.now();
  const cooldown = EMAIL_CONFIG.cooldownMinutes * 60 * 1000;

  // Alert when GO conditions detected
  if (data.similarity >= 40 && data.bz < -5 && now - emailState.lastAlert > cooldown) {
    const subject = `🌌 AURORA ALERT: GO Conditions Detected! (${data.similarity}% G4 Match)`;
    const body = `
      <h1>🌌 Aurora GO Alert!</h1>
      <p>Current conditions indicate <strong>GO</strong> for aurora viewing!</p>
      <h2>Key Metrics:</h2>
      <ul>
        <li><strong>G4 Similarity:</strong> ${data.similarity}%</li>
        <li><strong>Bz Field:</strong> ${data.bz} nT (southward - GOOD!)</li>
        <li><strong>Solar Wind:</strong> ${data.speed} km/s</li>
        <li><strong>Dynamic Pressure:</strong> ${data.pressure} nPa</li>
        <li><strong>Southward Duration:</strong> ${data.bzSouthDuration} min</li>
      </ul>
      <p>Check your local cloud conditions and head to a dark location!</p>
    `;
    sendEmail(subject, body);
    emailState.lastAlert = now;
  }
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
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(400);
    res.end('Bad Request');
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
  } else {
    console.log('📧 Email alerts: DISABLED');
  }
  console.log('');
});
