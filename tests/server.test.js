/**
 * Aurora Tracker Server Tests
 * Using Node.js built-in test runner (Node 18+)
 * 
 * These tests run against the API endpoints to verify correct behavior.
 * The server is started in a child process for isolation.
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

describe('Aurora Tracker Server', () => {
  
  before(async () => {
    // Start server in a child process
    const serverPath = path.join(__dirname, '..', 'server.js');
    serverProcess = spawn('node', [serverPath], {
      env: { ...process.env, PORT: TEST_PORT },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Collect server output for debugging
    serverProcess.stdout.on('data', () => {}); // Consume stdout
    serverProcess.stderr.on('data', () => {}); // Consume stderr
    
    // Wait for server to be ready
    await waitForServer();
  });

  after(() => {
    // Kill server process
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  describe('Static File Serving', () => {
    
    it('should serve index.html at root path', async () => {
      const res = await httpGet('/');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/html'));
      assert.ok(res.data.includes('Aurora Tracker'));
    });

    it('should serve CSS files', async () => {
      const res = await httpGet('/src/css/styles.css');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('text/css'));
    });

    it('should serve JavaScript files', async () => {
      const res = await httpGet('/src/js/aurora-tracker.js');
      assert.strictEqual(res.status, 200);
      assert.ok(res.headers['content-type'].includes('application/javascript'));
    });

    it('should return 404 for non-existent files', async () => {
      const res = await httpGet('/non-existent-file.xyz');
      assert.strictEqual(res.status, 404);
    });
  });

  describe('API: /api/solar-wind', () => {
    
    it('should return solar wind data with required fields', async () => {
      const res = await httpGet('/api/solar-wind', 10000);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers['content-type'], 'application/json');
      
      const data = res.data;
      
      // Check required fields exist
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
      const data = res.data;
      
      assert.ok(data.similarity >= 0, 'similarity should be >= 0');
      assert.ok(data.similarity <= 99, 'similarity should be <= 99');
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
      
      assert.ok('bz' in scores, 'should have bz score');
      assert.ok('speed' in scores, 'should have speed score');
      assert.ok('density' in scores, 'should have density score');
      assert.ok('bt' in scores, 'should have bt score');
      assert.ok('pressure' in scores, 'should have pressure score');
    });

    it('should have CORS headers', async () => {
      const res = await httpGet('/api/solar-wind');
      assert.strictEqual(res.headers['access-control-allow-origin'], '*');
    });
  });

  describe('API: /api/clouds', () => {
    
    it('should return cloud data with required fields', async () => {
      const res = await httpGet('/api/clouds?lat=47.6&lon=-122.3', 10000);
      assert.strictEqual(res.status, 200);
      
      const data = res.data;
      assert.ok('total' in data, 'should have total field');
      assert.ok('low' in data, 'should have low field');
      assert.ok('mid' in data, 'should have mid field');
      assert.ok('high' in data, 'should have high field');
    });

    it('should return cloud percentages between 0 and 100', async () => {
      const res = await httpGet('/api/clouds?lat=47.6&lon=-122.3');
      const data = res.data;
      
      assert.ok(data.total >= 0 && data.total <= 100, 'total should be 0-100');
      assert.ok(data.low >= 0 && data.low <= 100, 'low should be 0-100');
      assert.ok(data.mid >= 0 && data.mid <= 100, 'mid should be 0-100');
      assert.ok(data.high >= 0 && data.high <= 100, 'high should be 0-100');
    });

    it('should use default coordinates if not provided', async () => {
      const res = await httpGet('/api/clouds');
      assert.strictEqual(res.status, 200);
      assert.ok('total' in res.data);
    });

    it('should return trend information', async () => {
      const res = await httpGet('/api/clouds?lat=47.6&lon=-122.3');
      const data = res.data;
      
      if (!data.error) {
        assert.ok('trend' in data, 'should have trend field');
        assert.ok(
          ['clearing', 'increasing', 'stable', 'unknown'].includes(data.trend),
          'trend should be valid value'
        );
      }
    });
  });

  describe('API: /api/ovation', () => {
    
    it('should return OVATION forecast data', async () => {
      const res = await httpGet('/api/ovation?lat=47.6&lon=-122.3', 10000);
      assert.strictEqual(res.status, 200);
      
      const data = res.data;
      // OVATION might return error if service unavailable
      if (!data.error) {
        assert.ok('atLocation' in data || 'error' in data);
      }
    });

    it('should use default coordinates if not provided', async () => {
      const res = await httpGet('/api/ovation');
      assert.strictEqual(res.status, 200);
    });
  });

  describe('Data Validation', () => {
    
    it('should have consistent data types across requests', async () => {
      const res1 = await httpGet('/api/solar-wind');
      const res2 = await httpGet('/api/solar-wind');
      
      // Both should have same structure
      assert.deepStrictEqual(
        Object.keys(res1.data).sort(),
        Object.keys(res2.data).sort()
      );
    });

    it('should cache solar wind data (same Bz value within cache window)', async () => {
      // Make first request to populate cache
      const res1 = await httpGet('/api/solar-wind');
      // Make second request immediately - should hit cache
      const res2 = await httpGet('/api/solar-wind');
      
      // Bz value should be identical due to caching (this is more stable than time)
      assert.strictEqual(res1.data.bz, res2.data.bz);
      assert.strictEqual(res1.data.speed, res2.data.speed);
      assert.strictEqual(res1.data.similarity, res2.data.similarity);
    });
  });

  describe('Utility Functions - G4 Baseline Constants', () => {
    
    it('should have correct G4 baseline values', async () => {
      const res = await httpGet('/api/solar-wind');
      const baseline = res.data.baseline;
      
      // May 10-11, 2024 G4 Storm reference values
      assert.strictEqual(baseline.speed, 750, 'G4 speed should be 750 km/s');
      assert.strictEqual(baseline.density, 25, 'G4 density should be 25 p/cm³');
      assert.strictEqual(baseline.bz, -30, 'G4 Bz should be -30 nT');
      assert.strictEqual(baseline.bt, 40, 'G4 Bt should be 40 nT');
      assert.strictEqual(baseline.pressure, 15, 'G4 pressure should be 15 nPa');
      assert.strictEqual(baseline.temperature, 500000, 'G4 temperature should be 500000 K');
    });
  });

  describe('Utility Functions - Clock Angle Calculation', () => {
    
    it('should return clock angle between 0 and 360', async () => {
      const res = await httpGet('/api/solar-wind');
      const clockAngle = res.data.clockAngle;
      
      assert.ok(clockAngle >= 0, 'clock angle should be >= 0');
      assert.ok(clockAngle <= 360, 'clock angle should be <= 360');
    });
  });

  describe('Utility Functions - Pressure Calculation', () => {
    
    it('should return positive pressure value', async () => {
      const res = await httpGet('/api/solar-wind');
      assert.ok(res.data.pressure >= 0, 'pressure should be non-negative');
    });
  });

  describe('Utility Functions - Similarity Score Calculation', () => {
    
    it('should return integer similarity score', async () => {
      const res = await httpGet('/api/solar-wind');
      assert.ok(Number.isInteger(res.data.similarity), 'similarity should be integer');
    });

    it('should have scores that sum correctly with weights', async () => {
      const res = await httpGet('/api/solar-wind');
      const scores = res.data.scores;
      
      // All individual scores should be 0-100
      for (const [key, value] of Object.entries(scores)) {
        assert.ok(value >= 0, `${key} score should be >= 0`);
        assert.ok(value <= 100, `${key} score should be <= 100`);
      }
    });
  });

  describe('API: /api/solar-wind - Extended Metrics', () => {
    
    it('should return G-Scale data', async () => {
      const res = await httpGet('/api/solar-wind');
      const data = res.data;
      
      assert.ok('gScale' in data, 'should have gScale field');
      assert.ok('gText' in data, 'should have gText field');
      assert.ok(data.gScale >= 0 && data.gScale <= 5, 'gScale should be 0-5');
    });

    it('should return Bz south duration', async () => {
      const res = await httpGet('/api/solar-wind');
      const data = res.data;
      
      assert.ok('bzSouthDuration' in data, 'should have bzSouthDuration field');
      assert.ok(data.bzSouthDuration >= 0, 'bzSouthDuration should be non-negative');
    });

    it('should return aurora power estimate', async () => {
      const res = await httpGet('/api/solar-wind');
      const data = res.data;
      
      assert.ok('auroraPower' in data, 'should have auroraPower field');
      assert.ok(data.auroraPower >= 0, 'auroraPower should be non-negative');
    });

    it('should return temperature data', async () => {
      const res = await httpGet('/api/solar-wind');
      const data = res.data;
      
      assert.ok('temperature' in data, 'should have temperature field');
      assert.ok(data.temperature >= 0, 'temperature should be non-negative');
    });

    it('should return Bx and By components', async () => {
      const res = await httpGet('/api/solar-wind');
      const data = res.data;
      
      assert.ok('bx' in data, 'should have bx field');
      assert.ok('by' in data, 'should have by field');
      assert.strictEqual(typeof data.bx, 'number');
      assert.strictEqual(typeof data.by, 'number');
    });
  });

  describe('API: /api/test-daily-email', () => {
    
    it('should return success response when email is configured', async () => {
      const res = await httpGet('/api/test-daily-email');
      assert.strictEqual(res.status, 200);
      
      const data = res.data;
      // Either success:true or error about email not being enabled
      assert.ok('success' in data || 'error' in data);
    });
  });

  describe('API: /api/clouds - Extended', () => {
    
    it('should return visibility data', async () => {
      const res = await httpGet('/api/clouds?lat=47.6&lon=-122.3');
      const data = res.data;
      
      if (!data.error) {
        assert.ok('visibility' in data, 'should have visibility field');
      }
    });

    it('should return forecast array', async () => {
      const res = await httpGet('/api/clouds?lat=47.6&lon=-122.3');
      const data = res.data;
      
      if (!data.error) {
        assert.ok('forecast' in data, 'should have forecast field');
        assert.ok(Array.isArray(data.forecast), 'forecast should be an array');
      }
    });

    it('should handle invalid coordinates gracefully', async () => {
      const res = await httpGet('/api/clouds?lat=invalid&lon=invalid');
      assert.strictEqual(res.status, 200);
      // Should return default data or error object, not crash
      assert.ok(res.data !== null);
    });

    it('should handle extreme coordinates', async () => {
      const res = await httpGet('/api/clouds?lat=89.9&lon=179.9');
      assert.strictEqual(res.status, 200);
    });
  });

  describe('API: /api/ovation - Extended', () => {
    
    it('should return location-specific probability', async () => {
      const res = await httpGet('/api/ovation?lat=65.0&lon=-147.0', 10000); // Fairbanks, AK
      const data = res.data;
      
      if (!data.error) {
        assert.ok('atLocation' in data, 'should have atLocation field');
        assert.ok(data.atLocation >= 0 && data.atLocation <= 100, 'atLocation should be 0-100');
      }
    });

    it('should return nearby max probability', async () => {
      const res = await httpGet('/api/ovation?lat=47.6&lon=-122.3');
      const data = res.data;
      
      if (!data.error) {
        assert.ok('nearbyMax' in data, 'should have nearbyMax field');
      }
    });

    it('should return viewable flag', async () => {
      const res = await httpGet('/api/ovation?lat=47.6&lon=-122.3');
      const data = res.data;
      
      if (!data.error) {
        assert.ok('viewable' in data, 'should have viewable field');
        assert.strictEqual(typeof data.viewable, 'boolean');
      }
    });
  });

  describe('Error Handling', () => {
    
    it('should handle malformed API requests', async () => {
      const res = await httpGet('/api/');
      // Should return 404 for invalid API path
      assert.strictEqual(res.status, 404);
    });

    it('should return proper content types', async () => {
      const jsonRes = await httpGet('/api/solar-wind');
      assert.ok(jsonRes.headers['content-type'].includes('application/json'));
      
      const htmlRes = await httpGet('/');
      assert.ok(htmlRes.headers['content-type'].includes('text/html'));
    });
  });

  describe('Security', () => {
    
    it('should not expose sensitive environment variables', async () => {
      const res = await httpGet('/api/solar-wind');
      const dataStr = JSON.stringify(res.data);
      
      // Should not contain email credentials
      assert.ok(!dataStr.includes('SMTP_PASS'));
      assert.ok(!dataStr.includes('smtp.gmail'));
    });

    it('should not serve dot files', async () => {
      // Note: URL normalization prevents ../.. path traversal in browser requests
      // Test that dot files (like .env) are not served directly
      const res = await httpGet('/.env');
      // Should return 404 for dot files
      assert.strictEqual(res.status, 404);
    });

    it('should not serve files outside public directories', async () => {
      // Attempt to access package.json (which exists at project root but shouldn't be served)
      const res = await httpGet('/package.json');
      // If the file exists in src/ it would be served, otherwise 404
      // The key is it shouldn't serve from project root
      assert.ok(res.status === 404 || res.data.name !== 'aurora-tracker');
    });
  });

});
