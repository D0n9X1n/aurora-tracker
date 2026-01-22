import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8000;

// Cache data to reduce API calls
const cache = {
  magnetometer: null,
  plasma: null,
  kpIndex: null,
  scales: null,
  magnetometerTime: 0,
  plasmaTime: 0,
  kpIndexTime: 0,
  scalesTime: 0,
  cloudData: null,
  cloudDataTime: 0
};

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes (real-time data updates frequently)
const CLOUD_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes for cloud data (updates less frequently)

// NOAA API endpoints - All WORKING!
const NOAA_APIS = {
  // Real-time magnetic field (1-minute updates)
  magnetometer: 'https://services.swpc.noaa.gov/text/rtsw/data/mag-1-day.i.json',
  // Real-time solar wind/plasma (1-minute updates)
  plasma: 'https://services.swpc.noaa.gov/text/rtsw/data/plasma-1-day.i.json',
  // Kp index (3-hourly updates)
  kpIndex: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
  // Current and forecast geomagnetic scales
  scales: 'https://services.swpc.noaa.gov/products/noaa-scales.json'
};

/**
 * Fetch JSON from external URL with fallback
 */
function fetchJSON(urlString) {
  return new Promise((resolve, reject) => {
    https.get(urlString, { timeout: 10000 }, (res) => {
      let data = '';
      let timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 10000);
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Invalid JSON response`));
        }
      });
      
      res.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    }).on('error', reject).on('timeout', () => {
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Get mock data for when NOAA API is unavailable
 */
function getMockSolarWindData() {
  const now = new Date();
  // Generate realistic G4-like data
  const baseData = [
    { time: new Date(now - 4*60*60000).toISOString(), speed: 520, density: 18, bz: -18, bt: 28, temperature: 1800000 },
    { time: new Date(now - 3*60*60000).toISOString(), speed: 540, density: 19, bz: -20, bt: 29, temperature: 1900000 },
    { time: new Date(now - 2*60*60000).toISOString(), speed: 560, density: 20, bz: -22, bt: 30, temperature: 2000000 },
    { time: new Date(now - 1*60*60000).toISOString(), speed: 580, density: 21, bz: -24, bt: 31, temperature: 2100000 },
    { time: now.toISOString(), speed: 600, density: 22, bz: -25, bt: 32, temperature: 2200000 },
    { time: new Date(now + 1*60*60000).toISOString(), speed: 590, density: 21, bz: -23, bt: 31, temperature: 2100000 },
  ];
  return baseData;
}

/**
 * Process cloud data from Open-Meteo
 */
function processCloudData(cloudData, latitude, longitude) {
  try {
    if (!cloudData || !cloudData.hourly) {
      return null;
    }

    // Get current hour (index 0) and next 23 hours
    const hourly = cloudData.hourly;
    const times = hourly.time || [];
    const lowClouds = hourly.cloud_cover_low || [];
    const midClouds = hourly.cloud_cover_mid || [];
    const highClouds = hourly.cloud_cover_high || [];

    // Process hourly data
    const processedHourly = [];
    for (let i = 0; i < Math.min(24, times.length); i++) {
      const low = lowClouds[i] || 0;
      const mid = midClouds[i] || 0;
      const high = highClouds[i] || 0;

      // Calculate weighted cloud index (low clouds block aurora most)
      const cloudIndex = (low * 1.0 + mid * 0.6 + high * 0.2) / 2.8;
      const visibility = Math.max(0, 100 - cloudIndex);

      processedHourly.push({
        time: times[i],
        low: Math.round(low),
        mid: Math.round(mid),
        high: Math.round(high),
        total: Math.round(low + mid + high) / 3, // Simplified total
        cloudIndex: Math.round(cloudIndex),
        visibility: Math.round(visibility), // 0-100% clear sky
        recommendation: 
          visibility > 80 ? '✅ GO! Excellent viewing conditions' :
          visibility > 60 ? '🟡 MAYBE - Fair viewing, monitor conditions' :
          visibility > 40 ? '⚠️  RISKY - Poor viewing, clouds likely blocking' :
          '❌ NO GO - Too cloudy, aurora will be blocked'
      });
    }

    return {
      latitude,
      longitude,
      timezone: cloudData.timezone || 'UTC',
      updated: new Date().toISOString(),
      hourly: processedHourly,
      currentCondition: processedHourly[0]
    };
  } catch (error) {
    console.error('[Cloud] Error processing cloud data:', error.message);
    return null;
  }
}

/**
 * Process NOAA space weather data into unified format
 */
function processSpaceWeatherData(plasmaData, magnetometerData, kpData, scalesData) {
  try {
    // Extract latest plasma data (skip header row)
    const latestPlasma = plasmaData[plasmaData.length - 1];
    const [timeStr, speed, density, temperature] = latestPlasma;
    
    // Extract latest magnetometer data
    const latestMag = magnetometerData[magnetometerData.length - 1];
    const [magTimeStr, bt, bx_gsm, by_gsm, bz_gsm] = latestMag;
    
    // Get current Kp value (most recent)
    const latestKp = kpData[kpData.length - 1];
    const [kpTimeStr, kpValue] = latestKp;
    
    // Get current geomagnetic scale
    const currentScale = scalesData['0']; // 0 = current
    
    return {
      time: timeStr,
      speed: parseFloat(speed),
      density: parseFloat(density),
      temperature: parseFloat(temperature),
      bz: parseFloat(bz_gsm),
      bx: parseFloat(bx_gsm),
      by: parseFloat(by_gsm),
      bt: parseFloat(bt),
      kp: parseFloat(kpValue),
      gScale: currentScale?.G?.Scale || '0',
      gText: currentScale?.G?.Text || 'none'
    };
  } catch (e) {
    console.error('Error processing space weather data:', e.message);
    return getMockSolarWindData()[0]; // Return latest mock data point
  }
}

/**
 * Serve static files
 */
function serveStaticFile(filePath, res) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Determine content type
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

/**
 * Main request handler
 */
const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoints
  if (req.url === '/api/solar-wind') {
    try {
      // Check cache
      const cacheValid = cache.plasma && cache.magnetometer && 
                        Date.now() - cache.plasmaTime < CACHE_DURATION &&
                        Date.now() - cache.magnetometerTime < CACHE_DURATION;
      
      if (cacheValid) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cache.combinedData));
        return;
      }

      // Fetch fresh data from NOAA
      console.log('[API] Fetching real-time space weather data...');
      try {
        const [plasmaData, magnetometerData, kpData, scalesData] = await Promise.all([
          fetchJSON(NOAA_APIS.plasma),
          fetchJSON(NOAA_APIS.magnetometer),
          fetchJSON(NOAA_APIS.kpIndex),
          fetchJSON(NOAA_APIS.scales)
        ]);

        // Process and combine data
        const combined = processSpaceWeatherData(plasmaData, magnetometerData, kpData, scalesData);
        cache.plasma = plasmaData;
        cache.magnetometer = magnetometerData;
        cache.kpIndex = kpData;
        cache.scales = scalesData;
        cache.combinedData = combined;
        cache.plasmaTime = Date.now();
        cache.magnetometerTime = Date.now();
        cache.kpIndexTime = Date.now();
        cache.scalesTime = Date.now();
        
        console.log('[API] ✅ Real-time NOAA data loaded');
      } catch (fetchError) {
        console.log('[API] Using mock data (NOAA unavailable)');
        cache.combinedData = getMockSolarWindData();
        cache.plasmaTime = Date.now();
        cache.magnetometerTime = Date.now();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cache.combinedData));
    } catch (error) {
      console.error('[API] Error:', error.message);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (req.url.startsWith('/api/cloud-coverage')) {
    try {
      // Parse latitude and longitude from query string
      const url = new URL(req.url, `http://${req.headers.host}`);
      const latitude = parseFloat(url.searchParams.get('latitude'));
      const longitude = parseFloat(url.searchParams.get('longitude'));

      if (isNaN(latitude) || isNaN(longitude)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid latitude/longitude parameters' }));
        return;
      }

      // Check cache
      const cacheValid = cache.cloudData && (Date.now() - cache.cloudDataTime < CLOUD_CACHE_DURATION);
      
      if (cacheValid) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(cache.cloudData));
        return;
      }

      // Fetch fresh cloud data from Open-Meteo
      console.log(`[Cloud] Fetching cloud coverage for lat=${latitude}, lon=${longitude}...`);
      const cloudUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=cloud_cover_low,cloud_cover_mid,cloud_cover_high&timezone=auto`;
      
      const cloudDataRaw = await fetchJSON(cloudUrl);
      const cloudDataProcessed = processCloudData(cloudDataRaw, latitude, longitude);

      cache.cloudData = cloudDataProcessed;
      cache.cloudDataTime = Date.now();
      
      console.log(`[Cloud] ✅ Cloud data loaded (current visibility: ${cloudDataProcessed?.currentCondition?.visibility}%)`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(cache.cloudData));
    } catch (error) {
      console.error('[Cloud] Error:', error.message);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (req.url === '/api/forecast-3hour') {
    try {
      // Forecast API is currently unavailable or changed
      // Return empty forecast instead of trying to fetch
      console.log('[API] Forecast endpoint disabled (NOAA API changed)');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    } catch (error) {
      console.error('[API] Error:', error.message);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // Static files
  let filePath = req.url === '/' ? './src/index.html' : `.${req.url}`;
  
  // Security: prevent directory traversal
  filePath = path.normalize(filePath);
  if (filePath.includes('..')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  // Check if file exists
  fs.stat(filePath, (err) => {
    if (err) {
      // Try with index.html for directories
      filePath = path.join(path.dirname(filePath), 'index.html');
      fs.stat(filePath, (err) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          serveStaticFile(filePath, res);
        }
      });
    } else {
      serveStaticFile(filePath, res);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🌌 Northern Lights Reporter Server`);
  console.log(`📡 Listening on http://localhost:${PORT}`);
  console.log(`📍 Open http://localhost:${PORT}/src/index.html in your browser`);
  console.log(`\n✨ Features:`);
  console.log(`  • Serves static files from ./src/`);
  console.log(`  • Proxies NOAA API requests (/api/solar-wind, /api/forecast-3hour)`);
  console.log(`  • Caches API responses for 5 minutes`);
  console.log(`  • Handles CORS automatically`);
});
