/**
 * Nocturne Server Tests v3.0.0
 * Using Node.js built-in test runner (Node 18+))
 * 
 * Test Organization:
 * ├── Static File Serving     (10 tests) - HTML, CSS, JS, PWA assets
 * ├── Aurora/Solar APIs       (12 tests) - /api/solar-wind, /api/aurora/status
 * ├── Aurora Support APIs     (11 tests) - /api/clouds, /api/ovation, /api/weather/forecast
 * ├── Stocks APIs             (15 tests) - /api/stocks/*, market status, movers, charts
 * ├── Crypto APIs             (2 tests)  - /api/crypto/prices
 * ├── News APIs               (2 tests)  - /api/news/headlines  
 * ├── Status APIs             (3 tests)  - /api/status
 * └── Security & Validation   (7 tests)  - Error handling, data validation
 * 
 * Total: 59 tests
 * 
 * Run: npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test configuration
const TEST_PORT = 8099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Server process
let serverProcess = null;

// Helper to make HTTP requests
function httpGet(urlPath, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error('Request timeout')), timeout);
    const url = new URL(urlPath, BASE_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeoutId);
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: res.headers['content-type']?.includes('application/json') 
              ? JSON.parse(data) 
              : data
          });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
      res.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
    }).on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
}

// Wait for server to be ready
async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await httpGet('/', 1000);
      return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  throw new Error('Server did not start in time');
}

// ===========================================================================
// MAIN TEST SUITE
// ===========================================================================

describe('Nocturne Server v3.0.0', () => {
  
  before(async () => {
    const serverPath = path.join(__dirname, '..', 'server.js');
    serverProcess = spawn('node', [serverPath], {
      env: { ...process.env, PORT: TEST_PORT },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    serverProcess.stdout.on('data', () => {});
    serverProcess.stderr.on('data', () => {});
    await waitForServer();
  });

  after(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  // =========================================================================
  // STATIC FILE SERVING (10 tests)
  // =========================================================================
  
  describe('Static File Serving', () => {
    
    it('should serve index.html at root path', async () => {
      const res = await httpGet('/');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/html'));
      assert.ok(res.data.includes('Nocturne'));
    });

    it('should serve CSS files', async () => {
      const res = await httpGet('/src/css/styles.css');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/css'));
    });

    it('should serve nocturne.css', async () => {
      const res = await httpGet('/src/css/nocturne.css');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/css'));
    });

    it('should serve charts.css', async () => {
      const res = await httpGet('/src/css/charts.css');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/css'));
    });

    it('should serve JavaScript files', async () => {
      const res = await httpGet('/src/js/aurora.js');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('application/javascript'));
    });

    it('should serve charts.js', async () => {
      const res = await httpGet('/src/js/charts.js');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('application/javascript'));
    });

    it('should serve nocturne.js', async () => {
      const res = await httpGet('/src/js/nocturne.js');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('application/javascript'));
    });

    it('should serve manifest.json', async () => {
      const res = await httpGet('/public/manifest.json');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('application/json'));
    });

    it('should serve service worker', async () => {
      const res = await httpGet('/public/sw.js');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('application/javascript'));
    });

    it('should return 404 for non-existent files', async () => {
      const res = await httpGet('/non-existent-file.xyz');
      assert.strictEqual(res.status, 404);
    });
  });

  // =========================================================================
  // AURORA / SOLAR WIND APIs (12 tests)
  // =========================================================================

  describe('API: /api/solar-wind', () => {
    
    it('should return solar wind data with required fields', async () => {
      const res = await httpGet('/api/solar-wind', 10000);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['content-type'], 'application/json');
      const data = res.data;
      assert.ok('time' in data, 'should have time field');
      assert.ok('speed' in data, 'should have speed field');
      assert.ok('density' in data, 'should have density field');
      assert.ok('bz' in data, 'should have bz field');
      assert.ok('bt' in data, 'should have bt field');
      assert.ok('pressure' in data, 'should have pressure field');
      assert.ok('clockAngle' in data, 'should have clockAngle field');
      assert.ok('similarity' in data, 'should have similarity field');
      assert.ok('scores' in data, 'should have scores field');
      assert.ok('baseline' in data, 'should have baseline field');
    });

    it('should return valid numeric values', async () => {
      const res = await httpGet('/api/solar-wind');
      const data = res.data;
      assert.strictEqual(typeof data.speed, 'number');
      assert.strictEqual(typeof data.density, 'number');
      assert.strictEqual(typeof data.bz, 'number');
      assert.strictEqual(typeof data.bt, 'number');
      assert.strictEqual(typeof data.pressure, 'number');
      assert.strictEqual(typeof data.similarity, 'number');
    });

    it('should return similarity score between 0 and 99', async () => {
      const res = await httpGet('/api/solar-wind');
      assert.ok(res.data.similarity >= 0 && res.data.similarity <= 99);
    });

    it('should return G4 baseline values', async () => {
      const res = await httpGet('/api/solar-wind');
      const baseline = res.data.baseline;
      assert.strictEqual(baseline.speed, 750);
      assert.strictEqual(baseline.density, 25);
      assert.strictEqual(baseline.bz, -30);
      assert.strictEqual(baseline.bt, 40);
      assert.strictEqual(baseline.pressure, 15);
    });

    it('should return scores object with all metrics', async () => {
      const res = await httpGet('/api/solar-wind');
      const scores = res.data.scores;
      assert.ok('bz' in scores && 'speed' in scores && 'density' in scores);
    });

    it('should have CORS headers', async () => {
      const res = await httpGet('/api/solar-wind');
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
    });

    it('should return G-Scale and extended data', async () => {
      const res = await httpGet('/api/solar-wind');
      assert.ok('gScale' in res.data && 'bzSouthDuration' in res.data);
      assert.ok(res.data.gScale >= 0 && res.data.gScale <= 5);
    });

    it('should return temperature and magnetic components', async () => {
      const res = await httpGet('/api/solar-wind');
      assert.ok('temperature' in res.data && 'bx' in res.data && 'by' in res.data);
    });

    it('should return clock angle between 0 and 360', async () => {
      const res = await httpGet('/api/solar-wind');
      assert.ok(res.data.clockAngle >= 0 && res.data.clockAngle <= 360);
    });
  });

  describe('API: /api/aurora/status', () => {
    
    it('should return aurora status with required fields', async () => {
      const res = await httpGet('/api/aurora/status', 10000);
      assert.strictEqual(res.status, 200);
      assert.ok('auroraScore' in res.data && 'kp' in res.data && 'status' in res.data);
    });

    it('should return valid aurora score between 0 and 100', async () => {
      const res = await httpGet('/api/aurora/status');
      assert.ok(res.data.auroraScore >= 0 && res.data.auroraScore <= 100);
    });

    it('should return valid status string', async () => {
      const res = await httpGet('/api/aurora/status');
      assert.ok(['GO', 'MAYBE', 'NO GO', 'Unknown'].includes(res.data.status));
    });
  });

  // =========================================================================
  // AURORA SUPPORT APIs (11 tests) - clouds, ovation, weather for aurora module
  // =========================================================================

  describe('API: /api/clouds', () => {
    
    it('should return cloud data with required fields', async () => {
      const res = await httpGet('/api/clouds?lat=47.6&lon=-122.3', 10000);
      assert.strictEqual(res.status, 200);
      assert.ok('total' in res.data && 'low' in res.data && 'mid' in res.data && 'high' in res.data);
    });

    it('should return cloud percentages between 0 and 100', async () => {
      const res = await httpGet('/api/clouds?lat=47.6&lon=-122.3');
      const d = res.data;
      assert.ok(d.total >= 0 && d.total <= 100);
      assert.ok(d.low >= 0 && d.low <= 100);
    });

    it('should use default coordinates if not provided', async () => {
      const res = await httpGet('/api/clouds');
      assert.strictEqual(res.status, 200);
    });

    it('should return trend and forecast data', async () => {
      const res = await httpGet('/api/clouds?lat=47.6&lon=-122.3');
      if (!res.data.error) {
        assert.ok('trend' in res.data && 'forecast' in res.data);
      }
    });

    it('should handle invalid coordinates gracefully', async () => {
      const res = await httpGet('/api/clouds?lat=invalid&lon=invalid');
      assert.strictEqual(res.status, 200);
    });
  });

  describe('API: /api/ovation', () => {
    
    it('should return OVATION forecast data', async () => {
      const res = await httpGet('/api/ovation?lat=47.6&lon=-122.3', 10000);
      assert.strictEqual(res.status, 200);
    });

    it('should use default coordinates if not provided', async () => {
      const res = await httpGet('/api/ovation');
      assert.strictEqual(res.status, 200);
    });

    it('should return location probability and viewable flag', async () => {
      const res = await httpGet('/api/ovation?lat=65.0&lon=-147.0', 10000);
      if (!res.data.error) {
        assert.ok('atLocation' in res.data && 'viewable' in res.data);
      }
    });
  });

  describe('API: /api/weather/forecast', () => {
    
    it('should return weather forecast with required fields', async () => {
      const res = await httpGet('/api/weather/forecast?lat=47.6&lon=-122.3', 15000);
      assert.strictEqual(res.status, 200);
      assert.ok('current' in res.data || 'error' in res.data);
    });

    it('should return location information', async () => {
      const res = await httpGet('/api/weather/forecast?lat=47.6&lon=-122.3', 15000);
      if (!res.data.error) {
        assert.ok('location' in res.data);
      }
    });

    it('should use default coordinates if not provided', async () => {
      const res = await httpGet('/api/weather/forecast', 15000);
      assert.strictEqual(res.status, 200);
    });
  });

  // =========================================================================
  // STOCKS APIs (15 tests)
  // =========================================================================

  describe('API: /api/stocks/prices', () => {
    
    it('should return stock prices with stocks array', async () => {
      const res = await httpGet('/api/stocks/prices', 15000);
      assert.strictEqual(res.status, 200);
      assert.ok('stocks' in res.data || 'error' in res.data);
    });

    it('should return market indices', async () => {
      const res = await httpGet('/api/stocks/prices', 15000);
      if (!res.data.error) {
        assert.ok('indices' in res.data);
      }
    });

    it('should return stock data with required fields', async () => {
      const res = await httpGet('/api/stocks/prices', 15000);
      if (res.data.stocks?.length > 0) {
        assert.ok('symbol' in res.data.stocks[0]);
      }
    });
  });

  describe('API: /api/stocks/market-status', () => {
    
    it('should return market status', async () => {
      const res = await httpGet('/api/stocks/market-status');
      assert.strictEqual(res.status, 200);
      assert.ok('isOpen' in res.data);
      assert.strictEqual(typeof res.data.isOpen, 'boolean');
    });

    it('should return timezone information', async () => {
      const res = await httpGet('/api/stocks/market-status');
      assert.strictEqual(res.data.timezone, 'America/New_York');
    });
  });

  describe('API: /api/stocks/nasdaq-movers (US Markets)', () => {
    
    it('should return US market movers with gainers and losers', async () => {
      const res = await httpGet('/api/stocks/nasdaq-movers', 20000);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.data.gainers) && Array.isArray(res.data.losers));
    });

    it('should return up to 10 movers from each category', async () => {
      const res = await httpGet('/api/stocks/nasdaq-movers', 20000);
      if (res.data.gainers) {
        assert.ok(res.data.gainers.length <= 10);
      }
      if (res.data.losers) {
        assert.ok(res.data.losers.length <= 10);
      }
    });

    it('should return mover data with exchange info', async () => {
      const res = await httpGet('/api/stocks/nasdaq-movers', 20000);
      if (res.data.gainers?.length > 0) {
        assert.ok('symbol' in res.data.gainers[0]);
        assert.ok('exchange' in res.data.gainers[0]);
      }
    });
  });

  describe('API: /api/stocks/chart', () => {
    
    it('should return chart data for valid symbol', async () => {
      const res = await httpGet('/api/stocks/chart?symbol=AAPL&range=1d', 15000);
      assert.strictEqual(res.status, 200);
    });

    it('should return error for missing symbol', async () => {
      const res = await httpGet('/api/stocks/chart');
      assert.strictEqual(res.status, 400);
      assert.ok('error' in res.data);
    });

    it('should return dataPoints array', async () => {
      const res = await httpGet('/api/stocks/chart?symbol=AAPL&range=1d', 15000);
      if (!res.data.error) {
        assert.ok(Array.isArray(res.data.dataPoints));
      }
    });

    it('should support different time ranges', async () => {
      for (const range of ['1d', '5d', '1m']) {
        const res = await httpGet(`/api/stocks/chart?symbol=AAPL&range=${range}`, 15000);
        assert.strictEqual(res.status, 200);
      }
    });
  });

  // =========================================================================
  // CRYPTO & NEWS APIs (4 tests)
  // =========================================================================

  describe('API: /api/crypto/prices', () => {
    
    it('should return crypto prices with coins array', async () => {
      const res = await httpGet('/api/crypto/prices', 15000);
      assert.strictEqual(res.status, 200);
      assert.ok('coins' in res.data || 'error' in res.data);
    });

    it('should return coin data with required fields', async () => {
      const res = await httpGet('/api/crypto/prices', 15000);
      if (res.data.coins?.length > 0) {
        assert.ok('symbol' in res.data.coins[0] && 'price' in res.data.coins[0]);
      }
    });
  });

  describe('API: /api/news/headlines', () => {
    
    it('should return news headlines', async () => {
      const res = await httpGet('/api/news/headlines', 15000);
      assert.strictEqual(res.status, 200);
      assert.ok('articles' in res.data || 'error' in res.data);
    });

    it('should return article data with required fields', async () => {
      const res = await httpGet('/api/news/headlines', 15000);
      if (res.data.articles?.length > 0) {
        assert.ok('title' in res.data.articles[0] && 'source' in res.data.articles[0]);
      }
    });
  });

  // =========================================================================
  // STATUS API (3 tests)
  // =========================================================================

  describe('API: /api/status', () => {
    
    it('should return service status', async () => {
      const res = await httpGet('/api/status');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.service, 'Nocturne');
      assert.strictEqual(res.data.version, '3.0.0');
    });

    it('should return uptime information', async () => {
      const res = await httpGet('/api/status');
      assert.ok(res.data.uptime > 0);
    });

    it('should return module status', async () => {
      const res = await httpGet('/api/status');
      assert.ok('modules' in res.data);
      assert.ok('aurora' in res.data.modules && 'stocks' in res.data.modules);
    });
  });

  // =========================================================================
  // SECURITY & VALIDATION (7 tests)
  // =========================================================================

  describe('Security', () => {
    
    it('should not expose sensitive environment variables', async () => {
      const res = await httpGet('/api/solar-wind');
      const dataStr = JSON.stringify(res.data);
      assert.ok(!dataStr.includes('SMTP_PASS'));
      assert.ok(!dataStr.includes('smtp.gmail'));
    });

    it('should not serve dot files', async () => {
      const res = await httpGet('/.env');
      assert.strictEqual(res.status, 404);
    });

    it('should not serve files outside public directories', async () => {
      const res = await httpGet('/package.json');
      assert.ok(res.status === 404 || res.data.name !== 'nocturne');
    });
  });

  describe('Error Handling', () => {
    
    it('should handle malformed API requests', async () => {
      const res = await httpGet('/api/');
      assert.strictEqual(res.status, 404);
    });

    it('should return proper content types', async () => {
      const jsonRes = await httpGet('/api/solar-wind');
      assert.ok(jsonRes.headers['content-type'].includes('application/json'));
      const htmlRes = await httpGet('/');
      assert.ok(htmlRes.headers['content-type'].includes('text/html'));
    });
  });

  describe('Data Validation', () => {
    
    it('should have consistent data types across requests', async () => {
      const res1 = await httpGet('/api/solar-wind');
      const res2 = await httpGet('/api/solar-wind');
      assert.deepStrictEqual(Object.keys(res1.data).sort(), Object.keys(res2.data).sort());
    });

    it('should cache solar wind data (same values within cache window)', async () => {
      const res1 = await httpGet('/api/solar-wind');
      const res2 = await httpGet('/api/solar-wind');
      assert.strictEqual(res1.data.bz, res2.data.bz);
      assert.strictEqual(res1.data.similarity, res2.data.similarity);
    });
  });

});
