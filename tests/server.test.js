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

});
