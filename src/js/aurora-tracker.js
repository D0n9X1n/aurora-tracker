// Northern Lights Reporter - Real-time Aurora Visibility
// Algorithm: G4 Storm Baseline Comparison (May 2024)
// Uses real-time NOAA space weather data
// Location: Auto-detected via browser geolocation

// Default location (Seattle) - will be overridden by geolocation
let USER_LATITUDE = 47.6;
let USER_LONGITUDE = -122.3;
let USER_LOCATION_NAME = 'Seattle, WA';

// Get user's location via browser geolocation API
function initializeGeolocation() {
  console.log('🌍 Requesting geolocation...');
  
  if (navigator.geolocation) {
    // This should trigger browser permission prompt
    navigator.geolocation.getCurrentPosition(
      (position) => {
        USER_LATITUDE = position.coords.latitude;
        USER_LONGITUDE = position.coords.longitude;
        USER_LOCATION_NAME = `${USER_LATITUDE.toFixed(2)}°N, ${Math.abs(USER_LONGITUDE).toFixed(2)}°W`;
        updateLocationDisplay();
        
        // Hide the "Allow Location" button once granted
        const locationBtn = document.getElementById('location-request-btn');
        if (locationBtn) {
          locationBtn.style.display = 'none';
        }
        
        console.log(`✅ Geolocation SUCCESS: ${USER_LOCATION_NAME}`);
        console.log(`   Latitude: ${USER_LATITUDE}, Longitude: ${USER_LONGITUDE}`);
        
        // Re-fetch cloud data with new location since geolocation just completed
        if (tracker && typeof tracker.fetchCloudDataOnly === 'function') {
          tracker.fetchCloudDataOnly();
        }
      },
      (error) => {
        console.warn(`⚠️  Geolocation DENIED/ERROR: ${error.message} (Code: ${error.code})`);
        console.log(`   Code meanings: 1=Permission Denied, 2=Position Unavailable, 3=Timeout`);
        console.log(`   Using default location: ${USER_LOCATION_NAME}`);
        
        // Keep the "Allow Location" button visible if permission denied
        const locationBtn = document.getElementById('location-request-btn');
        if (locationBtn && error.code === 1) {
          // Permission denied - show button so user can try again
          locationBtn.textContent = 'Try Again';
          locationBtn.style.display = 'block';
        }
        
        updateLocationDisplay();
      },
      { 
        timeout: 5000,           // Allow 5s for user to respond
        enableHighAccuracy: false, // Don't require GPS, allow WiFi/IP geolocation
        maximumAge: 0            // Don't use cached position
      }
    );
  } else {
    console.error('❌ Geolocation API not available in this browser');
    updateLocationDisplay();
    const locationBtn = document.getElementById('location-request-btn');
    if (locationBtn) {
      locationBtn.style.display = 'none'; // Hide button if not supported
    }
  }
}

function updateLocationDisplay() {
  const locationInfo = document.getElementById('location-info');
  if (locationInfo) {
    locationInfo.textContent = `📍 ${USER_LOCATION_NAME}`;
  }
}

// G4 Severe Geomagnetic Storm Baseline (May 2024)
// Used for aurora similarity comparison
const G4_BASELINE = {
  speed: 600,           // km/s - typical strong solar wind
  density: 20,          // protons/cm³ - moderate-high density
  bz: -25,              // nanoTesla - strong southward component (absolute value)
  bt: 30,               // nanoTesla - total magnetic field
  temperature: 2000000, // Kelvin - hot plasma
};

// API endpoints - using local proxy to avoid CORS issues
// The backend proxy (server.js) fetches from NOAA on behalf of the client
const NOAA_ENDPOINTS = {
  // Real-time solar wind data (proxied through /api/solar-wind)
  solarWindData: '/api/solar-wind',
  // 3-hour forecast data (proxied through /api/forecast-3hour)
  forecast3hour: '/api/forecast-3hour'
};

class AuroraTracker {
    constructor() {
        this.data = {};
        this.forecast = [];
        this.cloudData = null;
        this.lastUpdate = null;
    }

    async fetchData() {
        try {
            console.log('📡 Fetching solar wind data from /api/solar-wind...');
            
            // Fetch all data in parallel
            const [solarWindResponse, forecastResponse, cloudResponse] = await Promise.all([
                fetch(NOAA_ENDPOINTS.solarWindData)
                    .then(r => {
                        console.log('Solar wind response status:', r.status);
                        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                        return r.json();
                    })
                    .catch(e => {
                        console.error('❌ Solar wind fetch error:', e.message);
                        return null;
                    }),
                fetch(NOAA_ENDPOINTS.forecast3hour)
                    .then(r => {
                        console.log('Forecast response status:', r.status);
                        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                        return r.json();
                    })
                    .catch(e => {
                        console.warn('⚠️  Forecast fetch error (non-critical):', e.message);
                        return null;
                    }),
                // Fetch cloud coverage data
                fetch(`/api/cloud-coverage?latitude=${USER_LATITUDE}&longitude=${USER_LONGITUDE}`)
                    .then(r => {
                        console.log('Cloud response status:', r.status);
                        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                        return r.json();
                    })
                    .catch(e => {
                        console.warn('⚠️  Cloud data fetch error (non-critical):', e.message);
                        return null;
                    })
            ]);

            console.log('✅ Data received. Solar wind:', solarWindResponse ? 'OK' : 'NULL', 'Forecast:', forecastResponse ? 'OK' : 'NULL', 'Cloud:', cloudResponse ? 'OK' : 'NULL');

            this.processSolarWindData(solarWindResponse);
            this.processForecastData(forecastResponse);
            this.processCloudData(cloudResponse);
            this.lastUpdate = new Date();

            return true;
        } catch (error) {
            console.error('❌ Error fetching NOAA data:', error);
            throw new Error('Unable to fetch real-time aurora data from NOAA');
        }
    }

    // Fetch only cloud data (called when geolocation completes)
    async fetchCloudDataOnly() {
        try {
            console.log(`☁️  Refetching cloud data for new location (${USER_LATITUDE.toFixed(2)}, ${USER_LONGITUDE.toFixed(2)})...`);
            const cloudResponse = await fetch(`/api/cloud-coverage?latitude=${USER_LATITUDE}&longitude=${USER_LONGITUDE}`)
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                    return r.json();
                });
            
            this.processCloudData(cloudResponse);
            this.renderCloudData(); // Re-render just the cloud section
            console.log('☁️  Cloud data updated with new location');
        } catch (e) {
            console.warn('⚠️  Cloud data refetch error:', e.message);
        }
    }

    processSolarWindData(data) {
        if (!data) {
            this.data.solarWind = { 
                speed: 0, 
                density: 0, 
                bz: 0, 
                bt: 0, 
                temperature: 0 
            };
            return;
        }

        // API now returns a single object (not an array)
        // If it's an array (legacy), get the last element
        const latestData = Array.isArray(data) ? data[data.length - 1] : data;

        this.data.solarWind = {
            speed: Math.round(latestData.speed || 0),
            density: Math.round((latestData.density || 0) * 10) / 10,
            bz: Math.round((latestData.bz || 0) * 100) / 100,
            bt: Math.round((latestData.bt || 0) * 100) / 100,
            temperature: Math.round(latestData.temperature || 0),
            timestamp: new Date(latestData.time)
        };

        // Calculate similarity to G4 storm baseline
        this.calculateG4Similarity();
    }

    calculateG4Similarity() {
        const wind = this.data.solarWind;
        
        // Normalize each parameter to G4 baseline (0-1 scale, capped at 1)
        const speedFactor = Math.min(wind.speed / G4_BASELINE.speed, 1);
        const densityFactor = Math.min(wind.density / G4_BASELINE.density, 1);
        const bzFactor = Math.min(Math.abs(wind.bz) / G4_BASELINE.bz, 1);
        const btFactor = Math.min(wind.bt / G4_BASELINE.bt, 1);
        const tempFactor = Math.min(wind.temperature / G4_BASELINE.temperature, 1);

        // Weighted combination (Bz is most important: 35%)
        const weightedScore = 
            (speedFactor * 0.20) +
            (densityFactor * 0.15) +
            (bzFactor * 0.35) +      // Magnetic field is most critical
            (btFactor * 0.15) +
            (tempFactor * 0.15);

        // Convert to percentage
        let similarity = Math.round(weightedScore * 100);

        // Modifiers for sustained southward Bz conditions
        if (wind.bz < -10) {
            similarity += 10; // Sustained southward wind bonus
        }
        if (wind.speed > 700) {
            similarity += 5;  // Strong driver bonus
        }
        if (wind.density > 20) {
            similarity += 5;  // High energy transfer bonus
        }

        // Store similarity score
        this.data.g4Similarity = Math.min(similarity, 99);
    }

    processForecastData(data) {
        if (!data || !data.forecast) {
            this.forecast = [];
            this.data.kp = 0;
            return;
        }

        // Extract relevant forecast data
        const forecastArray = data.forecast || [];
        
        if (forecastArray.length > 0) {
            const latestForecast = forecastArray[0];
            this.data.kp = parseFloat(latestForecast.kp || 0);
        }

        // Process 3-hour forecasts (if available)
        this.forecast = forecastArray.slice(0, 8).map(f => ({
            time: new Date(f.valid_time),
            kp: parseFloat(f.kp || 0),
            chance: this.calculateVisibilityChance(parseFloat(f.kp || 0))
        }));
    }

    processCloudData(data) {
        if (!data || !data.currentCondition) {
            this.cloudData = null;
            return;
        }

        this.cloudData = {
            current: {
                low: data.currentCondition.low || 0,
                mid: data.currentCondition.mid || 0,
                high: data.currentCondition.high || 0,
                visibility: data.currentCondition.visibility || 0,
                recommendation: data.currentCondition.recommendation || '?'
            },
            hourly: data.hourly || [],
            timezone: data.timezone || 'UTC'
        };

        console.log(`☁️  Cloud visibility: ${this.cloudData.current.visibility}% - ${this.cloudData.current.recommendation}`);
    }

    calculateVisibilityChance(kpIndex) {
        // Use G4 similarity score as primary metric
        // kpIndex parameter kept for backward compatibility but not used
        return this.data.g4Similarity || 0;
    }

    getVisibilityRating() {
        const chance = this.getCurrentChance();

        if (chance < 10) {
            return { level: 'veryLow', emoji: '❌', title: 'No Aurora Expected' };
        } else if (chance < 25) {
            return { level: 'low', emoji: '⚠️', title: 'Low Chance' };
        } else if (chance < 50) {
            return { level: 'moderate', emoji: '🌙', title: 'Moderate Chance' };
        } else if (chance < 75) {
            return { level: 'high', emoji: '✨', title: 'Good Chance' };
        } else if (chance < 90) {
            return { level: 'veryHigh', emoji: '⭐', title: 'Strong Display' };
        } else {
            return { level: 'veryHigh', emoji: '🌟', title: 'Exceptional Display' };
        }
    }

    getCurrentChance() {
        return this.calculateVisibilityChance(this.data.kp || 0);
    }

    getActivityLevel() {
        const wind = this.data.solarWind;
        const similarity = this.data.g4Similarity || 0;

        // Classify based on G4 storm similarity
        if (similarity < 10) {
            return 'Quiet';
        } else if (similarity < 25) {
            return 'Unsettled';
        } else if (similarity < 50) {
            return 'Active';
        } else if (similarity < 75) {
            return 'Minor Storm';
        } else if (similarity < 90) {
            return 'Strong Storm';
        } else {
            return 'Severe Storm (G4-like)';
        }
    }

    getRecommendations() {
        const recommendations = [];
        const chance = this.getCurrentChance();
        const wind = this.data.solarWind;

        // Time-based recommendations
        recommendations.push('Best viewing: After sunset (8 PM - 2 AM local time)');

        if (chance >= 75) {
            recommendations.push('🎯 Excellent conditions! Head out tonight!');
            recommendations.push('Look toward north horizon for green aurora');
            recommendations.push('Find darkest location away from city lights (30+ min north)');
            recommendations.push('Bring warm clothing and patience');
        } else if (chance >= 50) {
            recommendations.push('Good chance tonight - check weather first for clouds');
            recommendations.push('Have a backup plan - conditions may improve in 3-6 hours');
            recommendations.push('Monitor solar wind speed - if it increases, aurora may brighten');
        } else if (chance >= 25) {
            recommendations.push('Possible aurora for experienced observers only');
            recommendations.push('Requires very dark skies and clear weather');
            recommendations.push('Check again in 6 hours - conditions may improve');
        } else {
            recommendations.push('Aurora unlikely tonight');
            recommendations.push('Check back tomorrow');
        }

        // Real-time solar wind commentary
        if (wind.bz < -15) {
            recommendations.push('✨ Southward Bz is strong - excellent for coupling');
        }
        if (wind.speed > 600) {
            recommendations.push('⚡ High solar wind speed - conditions intensifying');
        }
        if (wind.density > 15) {
            recommendations.push('💨 High density - energy transfer is efficient');
        }

        return recommendations;
    }

    render() {
        const loadingState = document.getElementById('loading-state');
        const contentState = document.getElementById('content-state');
        const errorState = document.getElementById('error-state');

        loadingState.style.display = 'none';
        errorState.style.display = 'none';
        contentState.style.display = 'block';

        this.renderMainIndicator();
        this.renderMetrics();
        this.renderCloudData();
        this.renderRecommendations();
        this.renderHourlyForecast();
        this.renderLastUpdated();
    }

    renderMainIndicator() {
        const rating = this.getVisibilityRating();
        const chance = this.getCurrentChance();

        document.getElementById('indicator-circle').className = `indicator-circle chance-${rating.level}`;
        document.getElementById('chance-emoji').textContent = rating.emoji;
        document.getElementById('chance-title').textContent = rating.title;
        document.getElementById('visibility-percent').textContent = chance;

        const descriptions = {
            veryLow: 'Aurora is unlikely to reach Seattle. Monitor the forecast for improvements.',
            low: 'Aurora may be visible only in far northern regions. Not expected in Seattle.',
            moderate: 'Aurora has a fair chance of being visible from dark locations with clear skies.',
            high: 'Good chance of seeing aurora! Conditions are favorable for viewing.',
            veryHigh: 'Excellent aurora display expected! Strong activity likely throughout the night.'
        };

        document.getElementById('chance-description').textContent = descriptions[rating.level];
    }

    renderMetrics() {
        const wind = this.data.solarWind || {};

        document.getElementById('solar-wind').textContent = wind.speed || '--';
        document.getElementById('kp-value').textContent = this.data.g4Similarity !== undefined 
            ? this.data.g4Similarity + '%' 
            : '--';
        document.getElementById('bz-value').textContent = wind.bz || '--';
        document.getElementById('bt-value').textContent = wind.bt || '--';
        document.getElementById('density-value').textContent = wind.density || '--';
        document.getElementById('temp-value').textContent = wind.temperature ? (wind.temperature / 1000000).toFixed(1) + 'M' : '--';
        document.getElementById('visibility-lat').textContent = USER_LATITUDE.toFixed(2) + '°N';
        document.getElementById('activity-level').textContent = this.getActivityLevel();
    }

    renderCloudData() {
        if (!this.cloudData || !this.cloudData.current) {
            // Cloud data not available
            document.getElementById('cloud-low').textContent = '--';
            document.getElementById('cloud-mid').textContent = '--';
            document.getElementById('cloud-high').textContent = '--';
            document.getElementById('cloud-clear-portion').style.width = '0%';
            const decisionBox = document.getElementById('cloud-decision-box');
            decisionBox.innerHTML = '<div class="decision-icon">?</div><div class="decision-text">Cloud data unavailable</div>';
            decisionBox.className = 'cloud-decision';
            return;
        }

        const cloud = this.cloudData.current;

        // Update cloud percentages
        document.getElementById('cloud-low').textContent = cloud.low;
        document.getElementById('cloud-mid').textContent = cloud.mid;
        document.getElementById('cloud-high').textContent = cloud.high;

        // Update visibility bar
        const clearPercent = cloud.visibility;
        document.getElementById('cloud-clear-portion').style.width = clearPercent + '%';

        // Update GO/NO-GO decision
        const decisionBox = document.getElementById('cloud-decision-box');
        let decisionClass = 'cloud-decision';
        let icon = '?';

        if (clearPercent >= 80) {
            decisionClass += ' excellent';
            icon = '✅ GO';
        } else if (clearPercent >= 60) {
            decisionClass += ' good';
            icon = '🟡 MAYBE';
        } else {
            decisionClass += ' poor';
            icon = '❌ NO GO';
        }

        decisionBox.className = decisionClass;
        decisionBox.innerHTML = `
            <div class="decision-icon">${icon}</div>
            <div class="decision-text">${cloud.recommendation}</div>
        `;
    }

    renderRecommendations() {
        const recommendations = this.getRecommendations();
        const list = document.getElementById('recommendations-list');
        list.innerHTML = recommendations.map(rec => `<li>${rec}</li>`).join('');
    }

    renderHourlyForecast() {
        const forecastContainer = document.getElementById('hourly-forecast');
        
        // Hourly forecasts no longer available with G4 similarity algorithm
        // Real-time solar wind conditions are more accurate than hourly Kp forecasts
        forecastContainer.innerHTML = `
            <p style="grid-column: 1/-1; text-align: center; color: #999; font-style: italic;">
                Aurora visibility changes rapidly with real-time solar wind conditions.
                <br>Use space weather alerts at <a href="https://www.swpc.noaa.gov" target="_blank" style="color: #4facfe;">NOAA SWPC</a> for updates.
            </p>
        `;
    }

    renderLastUpdated() {
        if (this.lastUpdate) {
            const timeStr = this.lastUpdate.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            document.getElementById('last-updated').textContent = timeStr;
        }
    }

    renderError(message) {
        const loadingState = document.getElementById('loading-state');
        const contentState = document.getElementById('content-state');
        const errorState = document.getElementById('error-state');

        loadingState.style.display = 'none';
        contentState.style.display = 'none';
        errorState.style.display = 'block';

        document.getElementById('error-message').textContent = message;
    }
}

// Initialize the tracker
const tracker = new AuroraTracker();

// Load data on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize geolocation in BACKGROUND (don't wait for it)
    // This prevents the page from freezing while waiting for permission prompt
    initializeGeolocation();
    
    try {
        // Start data fetching immediately (don't wait for geolocation)
        // Cloud API will use default location (Seattle) if geolocation hasn't completed
        await tracker.fetchData();
        tracker.render();

        // Refresh data every 2 minutes (real-time data updates frequently)
        setInterval(async () => {
            try {
                await tracker.fetchData();
                tracker.render();
            } catch (error) {
                console.error('Auto-refresh error:', error);
            }
        }, 2 * 60 * 1000);

    } catch (error) {
        tracker.renderError(error.message);
    }
});

// Allow manual refresh
if (document.addEventListener) {
    document.addEventListener('keydown', async (e) => {
        // Press 'R' to manually refresh
        if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            document.getElementById('loading-state').style.display = 'block';
            document.getElementById('content-state').style.display = 'none';
            try {
                await tracker.fetchData();
                tracker.render();
            } catch (error) {
                tracker.renderError(error.message);
            }
        }
    });
}

// Add click handler for location request button
document.addEventListener('DOMContentLoaded', () => {
    const locationBtn = document.getElementById('location-request-btn');
    if (locationBtn) {
        locationBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('🌍 User clicked "Allow Location" button - requesting geolocation again...');
            initializeGeolocation();
        });
    }
});
