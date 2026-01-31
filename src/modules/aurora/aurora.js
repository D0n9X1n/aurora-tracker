/**
 * Nocturne - Aurora Module v3.1.0
 * 
 * Real-time aurora viewing decision based on DSCOVR/ACE satellite data.
 * Binary GO/NO GO - no uncertainty, no MAYBE.
 * 
 * Part of Nocturne 24x7 Personal Assistant
 */

// =============================================================================
// Module Metadata
// =============================================================================
export const MODULE_INFO = {
  id: 'aurora',
  name: 'Aurora Tracker',
  icon: '🌌',
  description: 'Real-time aurora visibility with GO/NO GO decision',
  version: '3.1.0'
};

// =============================================================================
// Configuration
// =============================================================================
let userLatitude = 47.6;
let userLongitude = -122.3;
let locationName = 'Seattle, WA';

// =============================================================================
// State
// =============================================================================
let currentData = null;
let cloudData = null;
let ovationData = null;
let weatherData = null;
let darknessInfo = null;
let refreshInterval = null;

// =============================================================================
// Darkness Calculation
// =============================================================================
function getSunPosition(lat, lon, date = new Date()) {
  const toRad = (deg) => deg * Math.PI / 180;
  const toDeg = (rad) => rad * 180 / Math.PI;
  
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  const declination = -23.45 * Math.cos(toRad((360 / 365) * (dayOfYear + 10)));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const solarNoon = 12 - (lon / 15);
  const hourAngle = (utcHours - solarNoon) * 15;
  const latRad = toRad(lat);
  const decRad = toRad(declination);
  const haRad = toRad(hourAngle);
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + 
                 Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
  const altitude = toDeg(Math.asin(Math.max(-1, Math.min(1, sinAlt))));
  
  return {
    altitude: Math.round(altitude * 10) / 10,
    declination: Math.round(declination * 10) / 10,
    hourAngle: Math.round(hourAngle)
  };
}

function getDarknessInfo() {
  const sun = getSunPosition(userLatitude, userLongitude);
  const alt = sun.altitude;
  
  let level, description, isDark, canViewAurora;
  
  if (alt < -18) {
    level = 'night';
    description = 'Full darkness - ideal for aurora';
    isDark = true;
    canViewAurora = true;
  } else if (alt < -12) {
    level = 'nautical';
    description = 'Nautical twilight - good for aurora';
    isDark = true;
    canViewAurora = true;
  } else if (alt < -6) {
    level = 'civil';
    description = 'Civil twilight - only bright aurora visible';
    isDark = false;
    canViewAurora = true;
  } else if (alt < 0) {
    level = 'horizon';
    description = 'Sun near horizon - too bright';
    isDark = false;
    canViewAurora = false;
  } else {
    level = 'day';
    description = 'Daytime - aurora not visible';
    isDark = false;
    canViewAurora = false;
  }
  
  return { isDark, level, description, canViewAurora, sunAltitude: alt };
}

// =============================================================================
// Decision Logic
// =============================================================================
function makeDecision(data, clouds, darkness) {
  // NO GO if daytime
  if (!darkness.canViewAurora) {
    return {
      decision: 'NO GO',
      reason: darkness.description,
      icon: '☀️',
      class: 'no-go'
    };
  }
  
  // NO GO if Bz not southward
  if (data.bz >= 0) {
    return {
      decision: 'NO GO',
      reason: 'Bz northward - magnetosphere closed',
      icon: '🧲',
      class: 'no-go'
    };
  }
  
  // Calculate visible latitude based on Bz
  let visibleLat = 70;
  if (data.bz < -25) visibleLat = 35;
  else if (data.bz < -20) visibleLat = 40;
  else if (data.bz < -15) visibleLat = 45;
  else if (data.bz < -10) visibleLat = 50;
  else if (data.bz < -5) visibleLat = 55;
  else if (data.bz < -3) visibleLat = 60;
  
  // NO GO if aurora won't reach user's latitude
  if (userLatitude < visibleLat) {
    return {
      decision: 'NO GO',
      reason: `Aurora at ${visibleLat}°N+, you're at ${userLatitude.toFixed(1)}°N`,
      icon: '📍',
      class: 'no-go'
    };
  }
  
  // Check clouds
  if (clouds && clouds.low > 50) {
    return {
      decision: 'NO GO',
      reason: `Low clouds blocking sky (${clouds.low}%)`,
      icon: '☁️',
      class: 'no-go'
    };
  }
  
  // GO conditions met!
  let strength = 'Moderate';
  if (data.similarity >= 60) strength = 'Strong';
  else if (data.similarity >= 40) strength = 'Good';
  
  return {
    decision: 'GO',
    reason: `${strength} aurora conditions at your latitude!`,
    icon: '✨',
    class: 'go'
  };
}

// =============================================================================
// API Calls
// =============================================================================
async function fetchSolarWind() {
  const response = await fetch('/api/aurora/solar-wind');
  return response.json();
}

async function fetchClouds() {
  const response = await fetch(`/api/aurora/clouds?lat=${userLatitude}&lon=${userLongitude}`);
  return response.json();
}

async function fetchOvation() {
  const response = await fetch(`/api/aurora/ovation?lat=${userLatitude}&lon=${userLongitude}`);
  return response.json();
}

async function fetchWeather() {
  const response = await fetch(`/api/weather/forecast?lat=${userLatitude}&lon=${userLongitude}`);
  return response.json();
}

// =============================================================================
// Weather Helpers
// =============================================================================
function getWeatherIcon(code, isDay = true) {
  const icons = {
    0: isDay ? '☀️' : '🌙',
    1: isDay ? '🌤️' : '🌙',
    2: '⛅',
    3: '☁️',
    45: '🌫️', 48: '🌫️',
    51: '🌧️', 53: '🌧️', 55: '🌧️',
    61: '🌧️', 63: '🌧️', 65: '🌧️',
    71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
    80: '🌦️', 81: '🌦️', 82: '🌦️',
    85: '🌨️', 86: '🌨️',
    95: '⛈️', 96: '⛈️', 99: '⛈️'
  };
  return icons[code] || '🌡️';
}

function getWeatherDescription(code) {
  const descriptions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light showers',
    81: 'Showers',
    82: 'Heavy showers',
    85: 'Light snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Severe thunderstorm'
  };
  return descriptions[code] || 'Unknown';
}

// =============================================================================
// Rendering
// =============================================================================
function updateUI() {
  if (!currentData) return;
  
  darknessInfo = getDarknessInfo();
  const decision = makeDecision(currentData, cloudData, darknessInfo, ovationData);
  
  // Decision card
  const decisionCard = document.getElementById('decision-card');
  const decisionIcon = document.getElementById('decision-icon');
  const decisionText = document.getElementById('decision-text');
  const decisionReason = document.getElementById('decision-reason');
  
  if (decisionCard && decisionIcon && decisionText && decisionReason) {
    decisionCard.className = `decision-card ${decision.class}`;
    decisionIcon.textContent = decision.icon;
    decisionText.textContent = decision.decision;
    decisionReason.textContent = decision.reason;
  }
  
  // Similarity
  const similarityBadge = document.getElementById('similarity-badge');
  const similarityBar = document.getElementById('similarity-bar');
  if (similarityBadge) similarityBadge.textContent = `${currentData.similarity}%`;
  if (similarityBar) similarityBar.style.width = `${currentData.similarity}%`;
  
  // Update all metrics
  updateMetrics();
  updateClouds();
  updateOvation();
  updateInfo();
}

function updateMetrics() {
  const data = currentData;
  if (!data) return;
  
  // Bz
  setMetric('bz', data.bz, data.scores.bz, data.bz < -5 ? 'Southward!' : data.bz < 0 ? 'Weakly south' : 'Northward');
  
  // Speed
  setMetric('speed', data.speed, data.scores.speed, data.speed > 600 ? 'Fast!' : data.speed > 500 ? 'Elevated' : 'Normal');
  
  // Pressure
  setMetric('pressure', data.pressure.toFixed(2), data.scores.pressure, data.pressure > 5 ? 'High!' : 'Normal');
  
  // Density
  setMetric('density', data.density.toFixed(1), data.scores.density, data.density > 10 ? 'Dense!' : 'Normal');
  
  // Bt
  setMetric('bt', data.bt.toFixed(1), data.scores.bt, data.bt > 15 ? 'Strong!' : 'Normal');
  
  // Clock angle
  const clockArrow = document.getElementById('clock-arrow');
  const clockCurrent = document.getElementById('clock-current');
  const clockStatus = document.getElementById('clock-status');
  if (clockArrow) clockArrow.style.transform = `rotate(${data.clockAngle}deg)`;
  if (clockCurrent) clockCurrent.textContent = data.clockAngle;
  if (clockStatus) clockStatus.textContent = data.clockAngle > 120 && data.clockAngle < 240 ? 'Favorable' : 'Unfavorable';
  
  // Duration
  const durationCurrent = document.getElementById('duration-current');
  const durationBar = document.getElementById('duration-bar');
  const durationStatus = document.getElementById('duration-status');
  if (durationCurrent) durationCurrent.textContent = data.bzSouthDuration;
  if (durationBar) durationBar.style.width = `${Math.min(100, data.bzSouthDuration / 30 * 100)}%`;
  if (durationStatus) durationStatus.textContent = data.bzSouthDuration > 15 ? 'Sustained' : data.bzSouthDuration > 5 ? 'Building' : 'Brief';
  
  // G-Scale
  updateGScale(data.gScale, data.gPredicted);
}

function setMetric(name, value, score, status) {
  const current = document.getElementById(`${name}-current`);
  const bar = document.getElementById(`${name}-bar`);
  const statusEl = document.getElementById(`${name}-status`);
  
  if (current) current.textContent = value;
  if (bar) bar.style.width = `${score}%`;
  if (statusEl) statusEl.textContent = status;
}

function updateGScale(current, predicted) {
  // Current observed
  for (let i = 0; i <= 5; i++) {
    const el = document.getElementById(`g${i}`);
    if (el) el.classList.toggle('active', i === current);
  }
  const gScaleText = document.getElementById('g-scale-text');
  if (gScaleText) {
    const labels = ['G0 - No Storm', 'G1 - Minor', 'G2 - Moderate', 'G3 - Strong', 'G4 - Severe', 'G5 - Extreme'];
    gScaleText.textContent = labels[current] || labels[0];
  }
  
  // Predicted
  for (let i = 0; i <= 5; i++) {
    const el = document.getElementById(`gp${i}`);
    if (el) el.classList.toggle('active', i === predicted);
  }
  const gPredictedText = document.getElementById('g-predicted-text');
  if (gPredictedText) {
    const labels = ['G0 - No Storm', 'G1 - Minor', 'G2 - Moderate', 'G3 - Strong', 'G4 - Severe', 'G5 - Extreme'];
    gPredictedText.textContent = labels[predicted] || labels[0];
  }
}

function updateClouds() {
  if (!cloudData) return;
  
  const cloudTotal = document.getElementById('cloud-total');
  const cloudTrend = document.getElementById('cloud-trend');
  
  if (cloudTotal) cloudTotal.textContent = `${cloudData.total}%`;
  if (cloudTrend) {
    cloudTrend.textContent = cloudData.trend === 'clearing' ? '↓ Clearing' : 
      cloudData.trend === 'increasing' ? '↑ Increasing' : '→ Stable';
  }
  
  ['low', 'mid', 'high'].forEach(layer => {
    const val = document.getElementById(`cloud-${layer}`);
    const bar = document.getElementById(`cloud-${layer}-bar`);
    if (val) val.textContent = `${cloudData[layer]}%`;
    if (bar) bar.style.width = `${cloudData[layer]}%`;
  });
}

function updateOvation() {
  if (!ovationData) return;
  
  const localEl = document.getElementById('ovation-local');
  const northEl = document.getElementById('ovation-north');
  
  if (localEl) localEl.textContent = `${ovationData.atLocation || 0}%`;
  if (northEl) northEl.textContent = `${ovationData.nearbyMax || 0}%`;
}

function updateInfo() {
  const userLat = document.getElementById('user-latitude');
  const visibleLat = document.getElementById('visible-latitude');
  const darknessStatus = document.getElementById('darkness-status');
  const dataTime = document.getElementById('data-time');
  
  if (userLat) userLat.textContent = `${userLatitude.toFixed(1)}°N`;
  
  if (currentData && visibleLat) {
    let vLat = 70;
    if (currentData.bz < -25) vLat = 35;
    else if (currentData.bz < -20) vLat = 40;
    else if (currentData.bz < -15) vLat = 45;
    else if (currentData.bz < -10) vLat = 50;
    else if (currentData.bz < -5) vLat = 55;
    else if (currentData.bz < -3) vLat = 60;
    visibleLat.textContent = `${vLat}°N+`;
  }
  
  if (darknessInfo && darknessStatus) {
    darknessStatus.textContent = darknessInfo.level.charAt(0).toUpperCase() + darknessInfo.level.slice(1);
  }
  
  if (currentData && dataTime) {
    const dataDate = new Date(currentData.time);
    const age = Math.round((Date.now() - dataDate.getTime()) / 60000);
    dataTime.textContent = age < 1 ? 'Just now' : `${age} min ago`;
  }
}

function updateWeather() {
  if (!weatherData || !weatherData.current) return;
  
  const current = weatherData.current;
  const isDay = current.is_day === 1;
  
  // Weather icon
  const iconEl = document.getElementById('weather-icon');
  if (iconEl) iconEl.textContent = getWeatherIcon(current.weather_code, isDay);
  
  // Temperature
  const tempEl = document.getElementById('weather-temp');
  if (tempEl) tempEl.textContent = `${Math.round(current.temperature_2m)}°F`;
  
  // Description
  const descEl = document.getElementById('weather-desc');
  if (descEl) descEl.textContent = getWeatherDescription(current.weather_code);
  
  // Location display
  const locEl = document.getElementById('weather-location');
  if (locEl) locEl.textContent = locationName;
  
  // Details
  const feelsEl = document.getElementById('weather-feels');
  if (feelsEl) feelsEl.textContent = `${Math.round(current.apparent_temperature)}°F`;
  
  const humidityEl = document.getElementById('weather-humidity');
  if (humidityEl) humidityEl.textContent = `${current.relative_humidity_2m}%`;
  
  const windEl = document.getElementById('weather-wind');
  if (windEl) windEl.textContent = `${Math.round(current.wind_speed_10m)} mph`;
  
  const visibilityEl = document.getElementById('weather-visibility');
  if (visibilityEl) {
    const visMiles = Math.round(current.visibility / 1609);
    visibilityEl.textContent = `${visMiles} mi`;
  }
  
  // Viewing tip based on weather conditions
  const tipEl = document.getElementById('weather-viewing-tip');
  if (tipEl) {
    let tipText = '';
    let tipIcon = '💡';
    
    const temp = current.temperature_2m;
    const weatherCode = current.weather_code;
    
    if ([61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode)) {
      tipText = 'Rain expected - not ideal for aurora viewing';
      tipIcon = '☔';
    } else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
      tipText = 'Snow expected - limited visibility';
      tipIcon = '❄️';
    } else if ([45, 48].includes(weatherCode)) {
      tipText = 'Foggy conditions - poor visibility';
      tipIcon = '🌫️';
    } else if (temp < 32) {
      tipText = `Bundle up! It's freezing (${Math.round(temp)}°F)`;
      tipIcon = '🧥';
    } else if (temp < 45) {
      tipText = 'Dress warmly for outdoor viewing';
      tipIcon = '🧤';
    } else if (weatherCode <= 1) {
      tipText = 'Clear skies - perfect for aurora viewing!';
      tipIcon = '✨';
    } else if (weatherCode <= 3) {
      tipText = 'Some clouds, but viewing may still be possible';
      tipIcon = '⛅';
    } else {
      tipText = 'Check sky conditions before heading out';
      tipIcon = '👀';
    }
    
    tipEl.innerHTML = `<span class="tip-icon">${tipIcon}</span><span class="tip-text">${tipText}</span>`;
  }
}

// =============================================================================
// Location
// =============================================================================
function initLocation() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        userLatitude = pos.coords.latitude;
        userLongitude = pos.coords.longitude;
        locationName = `${userLatitude.toFixed(2)}°, ${userLongitude.toFixed(2)}°`;
        updateLocationDisplay();
        refresh();
      },
      () => {
        console.log('[Aurora] Using default location');
        updateLocationDisplay();
      }
    );
  }
}

function updateLocationDisplay() {
  const locationInfo = document.getElementById('location-info');
  if (locationInfo) locationInfo.textContent = `📍 ${locationName}`;
}

// =============================================================================
// Main Loop
// =============================================================================
async function refresh() {
  try {
    const [solarWind, clouds, ovation, weather] = await Promise.all([
      fetchSolarWind(),
      fetchClouds(),
      fetchOvation(),
      fetchWeather()
    ]);
    
    currentData = solarWind;
    cloudData = clouds;
    ovationData = ovation;
    weatherData = weather;
    
    updateUI();
    updateWeather();
    updateTimestamp();
    
  } catch (error) {
    console.error('[Aurora] Refresh error:', error);
  }
}

function updateTimestamp() {
  const el = document.getElementById('last-updated');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// =============================================================================
// Module Lifecycle
// =============================================================================
export function init(container) {
  console.log('[Aurora] Initializing module...');
  
  // Show loading state
  const loadingState = container.querySelector('#loading-state');
  const contentState = container.querySelector('#content-state');
  const errorState = container.querySelector('#error-state');
  
  if (loadingState) loadingState.style.display = 'flex';
  if (contentState) contentState.style.display = 'none';
  if (errorState) errorState.style.display = 'none';
  
  // Initialize location
  initLocation();
  
  // Initial fetch
  refresh().then(() => {
    if (loadingState) loadingState.style.display = 'none';
    if (contentState) contentState.style.display = 'block';
  }).catch(() => {
    if (loadingState) loadingState.style.display = 'none';
    if (errorState) errorState.style.display = 'flex';
  });
  
  // Set up auto-refresh every 2 minutes
  refreshInterval = setInterval(refresh, 2 * 60 * 1000);
  
  // Retry button
  const retryBtn = container.querySelector('#retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      if (errorState) errorState.style.display = 'none';
      if (loadingState) loadingState.style.display = 'flex';
      refresh().then(() => {
        if (loadingState) loadingState.style.display = 'none';
        if (contentState) contentState.style.display = 'block';
      });
    });
  }
}

export function destroy() {
  console.log('[Aurora] Destroying module...');
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

export function getStatus() {
  if (!currentData || !darknessInfo) {
    return { status: 'loading', summary: 'Loading...' };
  }
  
  const decision = makeDecision(currentData, cloudData, darknessInfo, ovationData);
  return {
    status: decision.decision === 'GO' ? 'alert' : 'normal',
    summary: `${decision.decision} - ${decision.reason}`,
    data: {
      similarity: currentData.similarity,
      bz: currentData.bz,
      decision: decision.decision
    }
  };
}
