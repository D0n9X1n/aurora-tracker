/**
 * Nocturne - Aurora Module v3.1.0
 * 
 * Real-time aurora viewing decision based on DSCOVR/ACE satellite data.
 * Binary GO/NO GO - no uncertainty, no MAYBE.
 * 
 * Part of Nocturne 24x7 Personal Assistant
 * Reference: May 10-11, 2024 G4 Storm (strongest in 20+ years)
 */

// =============================================================================
// Configuration
// =============================================================================
let userLatitude = 47.6;
let userLongitude = -122.3;
let locationName = 'Seattle, WA';

// =============================================================================
// Darkness Calculation - Aurora requires dark sky!
// =============================================================================

/**
 * Calculate sun position and determine if it's dark enough for aurora viewing.
 * Uses simplified astronomical calculations.
 * 
 * @param {number} lat - Latitude in degrees
 * @param {number} lon - Longitude in degrees
 * @param {Date} date - Date/time to check (default: now)
 * @returns {object} - Darkness info including isDark, sunAltitude, darkness level
 */
function getSunPosition(lat, lon, date = new Date()) {
  // Convert to radians
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
  const solarNoon = 12 - (lon / 15); // Approximate solar noon in UTC
  const hourAngle = (utcHours - solarNoon) * 15; // 15 degrees per hour
  
  // Sun altitude angle
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

/**
 * Determine darkness level for aurora viewing
 * @returns {object} - isDark, level, description, hoursUntilDark
 */
function getDarknessInfo() {
  const sun = getSunPosition(userLatitude, userLongitude);
  const alt = sun.altitude;
  
  // Darkness levels for aurora viewing:
  // - Astronomical twilight (sun < -18°): Best - fully dark
  // - Nautical twilight (sun < -12°): Good - dark enough for aurora
  // - Civil twilight (sun < -6°): Marginal - bright aurora might be visible
  // - Above horizon (sun >= -6°): Too bright - no aurora visible
  
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
    canViewAurora = true; // Marginal
  } else if (alt < 0) {
    level = 'horizon';
    description = 'Sun near horizon - too bright';
    isDark = false;
    canViewAurora = false;
  } else {
    level = 'day';
    description = `Daytime (sun ${alt > 0 ? '+' : ''}${alt}°) - aurora not visible`;
    isDark = false;
    canViewAurora = false;
  }
  
  // Estimate hours until dark (rough calculation)
  let hoursUntilDark = null;
  if (!canViewAurora && alt > -12) {
    // Sun moves ~15° per hour, need to get to -12°
    hoursUntilDark = Math.round((alt + 12) / 15 * 10) / 10;
    if (hoursUntilDark < 0) hoursUntilDark = null;
  }
  
  return {
    isDark,
    canViewAurora,
    level,
    description,
    sunAltitude: alt,
    hoursUntilDark
  };
}

// =============================================================================
// Geolocation
// =============================================================================
function initGeolocation() {
  if (!navigator.geolocation) return;
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLatitude = pos.coords.latitude;
      userLongitude = pos.coords.longitude;
      locationName = `${userLatitude.toFixed(2)}°, ${userLongitude.toFixed(2)}°`;
      updateLocationDisplay();
      if (tracker.hasData()) {
        tracker.fetchCloudData().then(() => tracker.render());
      }
    },
    () => updateLocationDisplay(),
    { timeout: 5000 }
  );
}

function updateLocationDisplay() {
  const el = document.getElementById('location-info');
  if (el) el.textContent = `📍 ${locationName}`;
}

// =============================================================================
// Aurora Tracker Class
// =============================================================================
class AuroraTracker {
  constructor() {
    this.data = null;
    this.cloudData = null;
    this.ovationData = null; // NOAA OVATION model forecast
    this.lastUpdate = null;
  }

  hasData() { return this.data !== null; }

  async fetchData() {
    const response = await fetch('/api/solar-wind');
    if (!response.ok) throw new Error(`Server error ${response.status}`);
    this.data = await response.json();
    await Promise.all([
      this.fetchCloudData(),
      this.fetchOvationData()
    ]);
    this.lastUpdate = new Date();
  }

  async fetchCloudData() {
    try {
      const response = await fetch(`/api/clouds?lat=${userLatitude}&lon=${userLongitude}`);
      if (!response.ok) throw new Error('Cloud API failed');
      this.cloudData = await response.json();
    } catch (e) {
      // Fail towards viewing - assume clear if can't fetch clouds
      this.cloudData = { total: 0, low: 0, mid: 0, high: 0, error: true };
    }
  }

  // Fetch NOAA OVATION aurora forecast (30-90 min prediction)
  async fetchOvationData() {
    try {
      const response = await fetch(`/api/ovation?lat=${userLatitude}&lon=${userLongitude}`);
      if (!response.ok) throw new Error('OVATION API failed');
      this.ovationData = await response.json();
    } catch (e) {
      this.ovationData = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Sky Score (0-100) - weighted by cloud layer impact
  // ---------------------------------------------------------------------------
  getSkyScore() {
    if (!this.cloudData) return 100;
    // Low clouds = total block, mid = partial, high = minor obstruction
    const weighted = (this.cloudData.low || 0) * 1.0 + 
                     (this.cloudData.mid || 0) * 0.7 + 
                     (this.cloudData.high || 0) * 0.3;
    return Math.max(0, Math.round(100 - Math.min(weighted, 100)));
  }

  // ---------------------------------------------------------------------------
  // Estimated Visibility Latitude (based on Bz and G-Scale)
  // Conservative estimate - aurora visible AT or ABOVE this latitude
  // ---------------------------------------------------------------------------
  getVisibleLatitude() {
    const bz = this.data?.bz || 0;
    const gScale = this.data?.gScale || 0;
    const speed = this.data?.speed || 400;
    
    // Use G-Scale if available (official NOAA)
    if (gScale >= 5) return 30;  // G5: Florida/Texas
    if (gScale >= 4) return 35;  // G4: Southern US
    if (gScale >= 3) return 45;  // G3: Northern US
    if (gScale >= 2) return 50;  // G2: Canada border
    if (gScale >= 1) return 55;  // G1: Northern states
    
    // Fallback to Bz-based estimate with speed consideration
    if (bz < -25 && speed > 600) return 35;
    if (bz < -20 && speed > 500) return 40;
    if (bz < -15 && speed > 450) return 45;
    if (bz < -10 && speed > 400) return 50;
    if (bz < -8) return 55;
    if (bz < -5) return 58;
    if (bz < -3) return 62;
    return 67; // Quiet conditions - only arctic
  }

  // ---------------------------------------------------------------------------
  // Check if aurora is visible at user's latitude
  // ---------------------------------------------------------------------------
  canSeeAuroraAtMyLatitude() {
    const visibleAt = this.getVisibleLatitude();
    const myLat = Math.abs(userLatitude); // Handle southern hemisphere
    return myLat >= visibleAt;
  }

  // ---------------------------------------------------------------------------
  // THE Decision Logic - BINARY GO/NO GO
  // ---------------------------------------------------------------------------
  // Based on real space physics, not arbitrary thresholds
  // 
  // Key insight: Aurora requires FOUR things:
  // 1. DARKNESS - Can't see aurora during daylight!
  // 2. Southward IMF (Bz < 0) - Opens magnetosphere to solar wind
  // 3. Strong solar wind (speed + density = pressure) - Drives energy
  // 4. Clear sky - Can actually see it
  // ---------------------------------------------------------------------------
  getDecision() {
    const d = this.data;
    const c = this.cloudData || {};
    const sky = this.getSkyScore();
    const darkness = getDarknessInfo();

    // FAIL SAFE: No data = NO GO
    if (!d) {
      return {
        decision: 'NO GO',
        class: 'no-go',
        icon: '🚫',
        reason: 'Cannot fetch space weather data',
        action: 'Check your internet connection and refresh the page.',
        confidence: 'high'
      };
    }

    // Extract key parameters
    const bz = d.bz || 0;
    const speed = d.speed || 0;
    const density = d.density || 0;
    const pressure = d.pressure || 0;
    const clockAngle = d.clockAngle || 0;
    const similarity = d.similarity || 0;
    const bzDuration = d.bzSouthDuration || 0;

    // =========================================================================
    // CRITICAL: CHECK DARKNESS FIRST - Can't see aurora in daylight!
    // =========================================================================
    if (!darkness.canViewAurora) {
      const timeNote = darkness.hoursUntilDark 
        ? `Dark in ~${darkness.hoursUntilDark} hours.` 
        : 'Check back after sunset.';
      
      // Still report space weather status
      const spaceWeatherNote = bz < -5 
        ? `Space weather is active (Bz ${bz.toFixed(1)} nT).` 
        : 'Space weather is quiet.';
      
      return {
        decision: 'NO GO',
        class: 'no-go',
        icon: '☀️',
        reason: darkness.description,
        action: `Aurora is only visible at night. ${timeNote} ${spaceWeatherNote}`,
        confidence: 'high',
        factors: { darkness: darkness.level, sun: `${darkness.sunAltitude}°` }
      };
    }

    // =========================================================================
    // AURORA CONDITIONS - Based on actual physics
    // =========================================================================
    
    // Bz is the PRIMARY factor - without southward Bz, NO aurora
    const bzGood = bz < -3;           // At least weakly southward
    const bzStrong = bz < -8;         // Strongly southward
    const bzExtreme = bz < -15;       // G3+ level southward
    
    // Solar wind strength
    const speedFast = speed > 450;    // Enhanced solar wind
    const speedVeryFast = speed > 600;// CME-level speeds
    
    // Dynamic pressure (compression of magnetosphere)
    const pressureHigh = pressure > 3;// Significant compression
    
    // Particle density (brighter aurora)
    const densityHigh = density > 10; // High density = brighter aurora
    const densityVeryHigh = density > 20; // Very high density
    
    // Duration matters - sustained Bz is better than spikes
    const sustained = bzDuration >= 15; // 15+ minutes sustained southward
    
    // Clock angle - 180° is pure south (best), near 0° or 360° is north (bad)
    const goodClockAngle = clockAngle > 120 && clockAngle < 240;

    // =========================================================================
    // SKY CONDITIONS
    // =========================================================================
    const skyClear = sky >= 60;       // Good viewing
    const skyPartly = sky >= 40;      // Possible viewing with breaks
    const skyBlockedLow = c.low > 50; // Low clouds = total block

    // =========================================================================
    // DECISION MATRIX - CONSERVATIVE APPROACH
    // =========================================================================

    // DEFINITE NO GO CONDITIONS
    
    // 1. No southward Bz = No aurora (physics says no)
    if (bz >= 0) {
      return {
        decision: 'NO GO',
        class: 'no-go',
        icon: '⊖',
        reason: `Bz is ${bz > 0 ? '+' : ''}${bz.toFixed(1)} nT (northward)`,
        action: 'IMF is northward - magnetosphere is closed. No aurora possible. Bz must go negative.',
        confidence: 'high',
        factors: { bz: 'blocking', sky: 'n/a' }
      };
    }

    // 2. Check if aurora can reach your latitude FIRST
    const visibleLat = this.getVisibleLatitude();
    const myLat = Math.abs(userLatitude);
    const canSeeIt = myLat >= visibleLat;
    const latDiff = visibleLat - myLat;

    if (!canSeeIt) {
      return {
        decision: 'NO GO',
        class: 'no-go',
        icon: '🌍',
        reason: `Aurora at ${visibleLat}°N, you're at ${myLat.toFixed(1)}°`,
        action: `Aurora won't reach your latitude. Need Bz < -${Math.ceil(Math.abs(bz) + latDiff/2)} nT or G${Math.max(1, Math.ceil(latDiff/10))}+ storm. Current Bz: ${bz.toFixed(1)} nT.`,
        confidence: 'high',
        factors: { visible: visibleLat + '°N', you: myLat.toFixed(1) + '°' }
      };
    }

    // 3. Very weak southward Bz = Only high latitudes
    if (bz > -5 && !pressureHigh) {
      return {
        decision: 'NO GO',
        class: 'no-go',
        icon: '📉',
        reason: `Bz only ${bz.toFixed(1)} nT (weak)`,
        action: `Bz not strong enough. Aurora limited to ${visibleLat}°N+. Need Bz < -8 nT for good display at your location.`,
        confidence: 'high',
        factors: { bz: 'weak', pressure: pressure.toFixed(1) + ' nPa' }
      };
    }

    // 4. Low clouds blocking = Can't see anything
    if (skyBlockedLow) {
      return {
        decision: 'NO GO',
        class: 'no-go',
        icon: '☁️',
        reason: `${c.low}% low cloud cover`,
        action: `Aurora IS active (Bz ${bz.toFixed(1)} nT) but low clouds blocking view. ${c.trend === 'clearing' ? 'Clearing soon!' : 'Find clearer skies.'}`,
        confidence: 'high',
        factors: { sky: 'blocked', aurora: 'active' }
      };
    }

    // 5. Too cloudy overall
    if (sky < 40) {
      return {
        decision: 'NO GO',
        class: 'no-go',
        icon: '🌧️',
        reason: `Only ${sky}% sky clarity`,
        action: `Cloud cover too heavy. ${c.trend === 'clearing' ? 'Forecast shows clearing - wait!' : 'Try a different location with clearer skies.'}`,
        confidence: 'medium',
        factors: { sky: 'cloudy', clouds: `${c.total}%` }
      };
    }

    // =========================================================================
    // GO CONDITIONS - CONSERVATIVE: Must be strong enough for your latitude
    // =========================================================================
    
    let goScore = 0;
    const reasons = [];
    
    // How much margin do we have? (negative = aurora extends past our latitude)
    const latitudeMargin = myLat - visibleLat;
    
    // Bz factors (most important) - MORE CONSERVATIVE thresholds
    if (bzExtreme) { goScore += 35; reasons.push(`Bz ${bz.toFixed(1)} nT (extreme!)`); }
    else if (bzStrong) { goScore += 25; reasons.push(`Bz ${bz.toFixed(1)} nT (strong)`); }
    else if (bzGood) { goScore += 12; reasons.push(`Bz ${bz.toFixed(1)} nT`); }
    
    // Duration bonus - sustained matters!
    if (sustained && bzStrong) { goScore += 12; reasons.push(`${bzDuration} min sustained`); }
    else if (sustained && bzGood) { goScore += 6; }
    
    // Speed factors
    if (speedVeryFast) { goScore += 12; reasons.push(`${speed} km/s`); }
    else if (speedFast) { goScore += 6; }
    
    // Pressure
    if (pressureHigh) { goScore += 6; reasons.push(`${pressure.toFixed(1)} nPa`); }
    
    // Density (more particles = brighter aurora)
    if (densityVeryHigh) { goScore += 8; reasons.push(`${density.toFixed(0)} p/cm³`); }
    else if (densityHigh) { goScore += 4; }
    
    // Clock angle
    if (goodClockAngle) { goScore += 4; }
    
    // Overall similarity to G4 storm (supporting evidence)
    if (similarity >= 50) { goScore += 8; }
    else if (similarity >= 30) { goScore += 4; }
    
    // Latitude margin bonus (aurora extends well past your location)
    if (latitudeMargin > 10) { goScore += 10; reasons.push(`${latitudeMargin.toFixed(0)}° margin`); }
    else if (latitudeMargin > 5) { goScore += 5; }
    
    // Sky clarity
    if (skyClear) { goScore += 8; }
    else if (skyPartly) { goScore += 4; }

    // =========================================================================
    // NOAA OVATION Model - Additional Evidence (not primary decision)
    // =========================================================================
    const ov = this.ovationData;
    let ovationNote = '';
    if (ov && !ov.error) {
      const prob = ov.atLocation || 0;
      const nearbyMax = ov.nearbyMax || 0;
      if (prob >= 30) {
        goScore += 8;
        ovationNote = `NOAA: ${prob}% at your location`;
      } else if (nearbyMax >= 40) {
        goScore += 4;
        ovationNote = `NOAA: ${nearbyMax}% visible north`;
      } else if (prob >= 10 || nearbyMax >= 20) {
        ovationNote = `NOAA: ${Math.max(prob, nearbyMax)}% nearby`;
      }
    }

    // =========================================================================
    // FINAL DECISION - CONSERVATIVE THRESHOLDS
    // Our physics-based rules are PRIMARY, OVATION is supporting evidence
    // =========================================================================

    // STRONG GO: Excellent conditions with good margin
    if (goScore >= 55 && skyClear && latitudeMargin >= 5) {
      return {
        decision: 'GO',
        class: 'go',
        icon: '🎯',
        reason: reasons.slice(0, 2).join(' • '),
        action: `Strong aurora likely! Visible to ${visibleLat}°N (you're at ${myLat.toFixed(1)}°). Go now! Dark sky, face north, 20min eye adjustment.${ovationNote ? ' ' + ovationNote : ''}`,
        confidence: 'high',
        factors: { score: goScore, margin: latitudeMargin.toFixed(0) + '°' },
        ovation: ov
      };
    }

    // GOOD GO: Solid conditions
    if (goScore >= 45 && sky >= 50 && latitudeMargin >= 0) {
      return {
        decision: 'GO',
        class: 'go',
        icon: '✅',
        reason: reasons.slice(0, 2).join(' • '),
        action: `Good conditions! Aurora at ${visibleLat}°N should reach you. ${!skyClear ? 'Watch for cloud breaks.' : 'Find dark location.'}${ovationNote ? ' ' + ovationNote : ''}`,
        confidence: 'medium',
        factors: { score: goScore, sky: sky + '%' },
        ovation: ov
      };
    }

    // MARGINAL: Conditions exist but borderline for your latitude
    if (goScore >= 35 && sky >= 50 && latitudeMargin >= -3) {
      return {
        decision: 'NO GO',
        class: 'no-go',
        icon: '⚠️',
        reason: `Marginal: ${visibleLat}°N, you're ${myLat.toFixed(1)}°`,
        action: `Aurora may be faint at your latitude. Wait for Bz to strengthen (currently ${bz.toFixed(1)} nT) or conditions to improve.`,
        confidence: 'medium',
        factors: { score: goScore, need: 'stronger Bz' }
      };
    }

    // NOT STRONG ENOUGH
    return {
      decision: 'NO GO',
      class: 'no-go',
      icon: '⏳',
      reason: `Bz ${bz.toFixed(1)} nT, need stronger`,
      action: `Current conditions won't produce visible aurora at ${myLat.toFixed(1)}°. Need Bz < -10 nT or G2+ storm. Check again in 30 min.`,
      confidence: 'medium',
      factors: { score: goScore, visible: visibleLat + '°N' }
    };
  }

  // ---------------------------------------------------------------------------
  // Status Helpers
  // ---------------------------------------------------------------------------
  getBzStatus(val) {
    if (val < -15) return '🔥 Extreme!';
    if (val < -10) return '🟢 Strong';
    if (val < -5) return '🟡 Good';
    if (val < -2) return '🟠 Weak';
    if (val < 0) return '🔴 Very weak';
    return '⛔ Northward';
  }

  getSpeedStatus(val) {
    if (val >= 700) return '🔥 Extreme!';
    if (val >= 550) return '🟢 Fast';
    if (val >= 450) return '🟡 Enhanced';
    if (val >= 350) return '🟠 Normal';
    return '🔴 Slow';
  }

  getPressureStatus(val) {
    if (val >= 10) return '🔥 Extreme!';
    if (val >= 5) return '🟢 High';
    if (val >= 3) return '🟡 Good';
    if (val >= 1.5) return '🟠 Moderate';
    return '🔴 Low';
  }

  getDensityStatus(val) {
    if (val >= 20) return '🔥 Dense!';
    if (val >= 12) return '🟢 High';
    if (val >= 6) return '🟡 Good';
    if (val >= 3) return '🟠 Normal';
    return '🔴 Low';
  }

  getBtStatus(val) {
    if (val >= 30) return '🔥 Extreme!';
    if (val >= 20) return '🟢 Strong';
    if (val >= 12) return '🟡 Elevated';
    if (val >= 6) return '🟠 Normal';
    return '🔴 Weak';
  }

  getClockAngleStatus(val) {
    // 180° = pure south (best), 0/360° = north (worst)
    if (val >= 150 && val <= 210) return '🟢 Southward';
    if (val >= 120 && val <= 240) return '🟡 SW/SE';
    if (val >= 90 && val <= 270) return '🟠 Mixed';
    return '🔴 Northward';
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  render() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('content-state').style.display = 'block';

    this.renderDecision();
    this.renderSimilarity();
    this.renderFactors();
    this.renderAction();
    this.renderMetrics();
    this.renderStormScale();
    this.renderOvation();
    this.renderClouds();
    this.renderInfo();
    this.renderTime();
    updateLocationDisplay();
  }

  renderDecision() {
    const d = this.getDecision();
    const card = document.getElementById('decision-card');
    card.className = `decision-card ${d.class}`;
    document.getElementById('decision-icon').textContent = d.icon;
    document.getElementById('decision-text').textContent = d.decision;
    document.getElementById('decision-reason').textContent = d.reason;
  }

  renderSimilarity() {
    const similarity = this.data?.similarity || 0;
    document.getElementById('similarity-badge').textContent = `${similarity}%`;
    document.getElementById('similarity-bar').style.width = `${similarity}%`;
  }

  renderFactors() {
    const similarity = this.data?.similarity || 0;
    const sky = this.getSkyScore();

    // Aurora factor
    document.getElementById('aurora-value').textContent = `${similarity}%`;
    const auroraBar = document.getElementById('aurora-bar');
    auroraBar.style.width = `${similarity}%`;
    auroraBar.className = `factor-fill ${similarity >= 50 ? 'high' : similarity >= 25 ? 'medium' : 'low'}`;
    document.getElementById('aurora-hint').textContent = 
      similarity >= 50 ? 'Strong conditions!' :
        similarity >= 30 ? 'Moderate' : 'Weak';

    // Sky factor
    document.getElementById('sky-value').textContent = `${sky}%`;
    const skyBar = document.getElementById('sky-bar');
    skyBar.style.width = `${sky}%`;
    skyBar.className = `factor-fill ${sky >= 60 ? 'high' : sky >= 40 ? 'medium' : 'low'}`;
    document.getElementById('sky-hint').textContent =
      sky >= 70 ? 'Clear!' :
        sky >= 50 ? 'Partly cloudy' : 'Cloudy';
  }

  renderAction() {
    const d = this.getDecision();
    const box = document.getElementById('action-box');
    box.className = `action-box ${d.class}`;
    document.getElementById('action-text').textContent = d.action;
  }

  renderMetrics() {
    const d = this.data || {};
    const baseline = d.baseline || {};
    const scores = d.scores || {};

    // PRIMARY METRIC: Bz Field (THE key factor)
    const bzEl = document.getElementById('bz-current');
    if (bzEl) {
      bzEl.textContent = d.bz?.toFixed(1) || '--';
      document.getElementById('bz-baseline').textContent = `-${baseline.bz || 30}`;
      document.getElementById('bz-bar').style.width = `${scores.bz || 0}%`;
      document.getElementById('bz-status').textContent = this.getBzStatus(d.bz || 0);
    }

    // Solar Wind Speed
    const speedEl = document.getElementById('speed-current');
    if (speedEl) {
      speedEl.textContent = d.speed || '--';
      document.getElementById('speed-baseline').textContent = baseline.speed || 750;
      document.getElementById('speed-bar').style.width = `${scores.speed || 0}%`;
      document.getElementById('speed-status').textContent = this.getSpeedStatus(d.speed || 0);
    }

    // Dynamic Pressure
    const pressureEl = document.getElementById('pressure-current');
    if (pressureEl) {
      pressureEl.textContent = d.pressure?.toFixed(1) || '--';
      document.getElementById('pressure-baseline').textContent = baseline.pressure || 15;
      document.getElementById('pressure-bar').style.width = `${scores.pressure || 0}%`;
      document.getElementById('pressure-status').textContent = this.getPressureStatus(d.pressure || 0);
    }

    // Particle Density
    const densityEl = document.getElementById('density-current');
    if (densityEl) {
      densityEl.textContent = d.density?.toFixed(1) || '--';
      document.getElementById('density-baseline').textContent = baseline.density || 25;
      document.getElementById('density-bar').style.width = `${scores.density || 0}%`;
      document.getElementById('density-status').textContent = this.getDensityStatus(d.density || 0);
    }

    // Total Field (Bt)
    const btEl = document.getElementById('bt-current');
    if (btEl) {
      btEl.textContent = d.bt?.toFixed(1) || '--';
      document.getElementById('bt-baseline').textContent = baseline.bt || 40;
      document.getElementById('bt-bar').style.width = `${scores.bt || 0}%`;
      document.getElementById('bt-status').textContent = this.getBtStatus(d.bt || 0);
    }

    // Clock Angle
    const clockEl = document.getElementById('clock-current');
    if (clockEl) {
      clockEl.textContent = d.clockAngle || '--';
      document.getElementById('clock-status').textContent = this.getClockAngleStatus(d.clockAngle || 0);
      // Visual indicator
      const arrow = document.getElementById('clock-arrow');
      if (arrow) {
        arrow.style.transform = `rotate(${d.clockAngle || 0}deg)`;
      }
    }

    // Southward Duration
    const durationEl = document.getElementById('duration-current');
    if (durationEl) {
      durationEl.textContent = d.bzSouthDuration || '0';
      const durPct = Math.min(100, ((d.bzSouthDuration || 0) / 60) * 100);
      document.getElementById('duration-bar').style.width = `${durPct}%`;
      document.getElementById('duration-status').textContent = 
        d.bzSouthDuration >= 30 ? '🟢 Sustained' :
          d.bzSouthDuration >= 15 ? '🟡 Building' : '🔴 Brief';
    }
  }

  renderStormScale() {
    const gScale = this.data?.gScale || 0;
    const gPredicted = this.data?.gPredicted || 0;
    const labels = ['No Storm', 'Minor Storm', 'Moderate Storm', 'Strong Storm', 'Severe Storm', 'Extreme Storm'];

    // === CURRENT OBSERVED ===
    // Deactivate all current
    for (let i = 0; i <= 5; i++) {
      const el = document.getElementById(`g${i}`);
      if (el) el.classList.remove('active');
    }
    // Activate current
    const activeEl = document.getElementById(`g${gScale}`);
    if (activeEl) activeEl.classList.add('active');

    // Current storm text
    const textEl = document.getElementById('g-scale-text');
    if (textEl) textEl.textContent = `G${gScale} - ${labels[gScale]}`;
    
    // Current observed time
    const observedTimeEl = document.getElementById('g-observed-time');
    if (observedTimeEl && this.data?.gObservedTime) {
      const time = new Date(this.data.gObservedTime);
      observedTimeEl.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // === PREDICTED ===
    // Deactivate all predicted
    for (let i = 0; i <= 5; i++) {
      const el = document.getElementById(`gp${i}`);
      if (el) el.classList.remove('active');
    }
    // Activate predicted
    const predictedEl = document.getElementById(`gp${gPredicted}`);
    if (predictedEl) predictedEl.classList.add('active');

    // Predicted storm text
    const predictedTextEl = document.getElementById('g-predicted-text');
    if (predictedTextEl) predictedTextEl.textContent = `G${gPredicted} - ${labels[gPredicted]}`;
    
    // Predicted time
    const predictedTimeEl = document.getElementById('g-predicted-time');
    if (predictedTimeEl && this.data?.gPredictedTime) {
      const time = new Date(this.data.gPredictedTime);
      predictedTimeEl.textContent = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }

  renderOvation() {
    const ov = this.ovationData;
    
    const localEl = document.getElementById('ovation-local');
    const northEl = document.getElementById('ovation-north');
    const timeEl = document.getElementById('ovation-time');
    
    if (!ov || ov.error) {
      if (localEl) localEl.textContent = '--';
      if (northEl) northEl.textContent = '--';
      if (timeEl) timeEl.textContent = 'Forecast unavailable';
      return;
    }
    
    const localProb = ov.atLocation || 0;
    const northProb = ov.nearbyMax || 0;
    
    if (localEl) {
      localEl.textContent = `${localProb}%`;
      localEl.className = `ovation-value ${localProb >= 30 ? 'high' : localProb >= 15 ? 'medium' : ''}`;
    }
    
    if (northEl) {
      northEl.textContent = `${northProb}%`;
      northEl.className = `ovation-value ${northProb >= 40 ? 'high' : northProb >= 20 ? 'medium' : ''}`;
    }
    
    if (timeEl) {
      const forecastTime = ov.forecastTime ? new Date(ov.forecastTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
      timeEl.textContent = `Forecast for ${forecastTime}`;
    }
  }

  renderClouds() {
    const c = this.cloudData || {};
    
    const totalEl = document.getElementById('cloud-total');
    if (totalEl) totalEl.textContent = `${c.total || 0}%`;
    
    const lowEl = document.getElementById('cloud-low');
    if (lowEl) {
      lowEl.textContent = `${c.low || 0}%`;
      document.getElementById('cloud-low-bar').style.width = `${c.low || 0}%`;
    }
    
    const midEl = document.getElementById('cloud-mid');
    if (midEl) {
      midEl.textContent = `${c.mid || 0}%`;
      document.getElementById('cloud-mid-bar').style.width = `${c.mid || 0}%`;
    }
    
    const highEl = document.getElementById('cloud-high');
    if (highEl) {
      highEl.textContent = `${c.high || 0}%`;
      document.getElementById('cloud-high-bar').style.width = `${c.high || 0}%`;
    }

    // Cloud trend
    const trendEl = document.getElementById('cloud-trend');
    if (trendEl) {
      const trend = c.trend || 'unknown';
      trendEl.textContent = trend === 'clearing' ? '📈 Clearing' : 
        trend === 'increasing' ? '📉 Increasing' : '➡️ Stable';
    }
  }

  renderInfo() {
    const latEl = document.getElementById('user-latitude');
    if (latEl) latEl.textContent = `${userLatitude.toFixed(1)}°`;
    
    const visEl = document.getElementById('visible-latitude');
    if (visEl) visEl.textContent = `${this.getVisibleLatitude()}°N+`;
    
    // Darkness status
    const darknessEl = document.getElementById('darkness-status');
    if (darknessEl) {
      const darkness = getDarknessInfo();
      if (darkness.level === 'night') {
        darknessEl.textContent = '🌙 Dark';
      } else if (darkness.level === 'nautical') {
        darknessEl.textContent = '🌑 Twilight';
      } else if (darkness.level === 'civil') {
        darknessEl.textContent = '🌆 Dusk';
      } else if (darkness.hoursUntilDark) {
        darknessEl.textContent = `☀️ ~${darkness.hoursUntilDark}h`;
      } else {
        darknessEl.textContent = '☀️ Day';
      }
    }
    
    if (this.data?.time) {
      const dataTime = new Date(this.data.time);
      const age = Math.round((Date.now() - dataTime.getTime()) / 60000);
      const timeEl = document.getElementById('data-time');
      if (timeEl) timeEl.textContent = age < 5 ? 'Real-time' : `${age} min ago`;
    }
  }

  renderTime() {
    if (this.lastUpdate) {
      const el = document.getElementById('last-updated');
      if (el) {
        el.textContent = this.lastUpdate.toLocaleTimeString([], {
          hour: '2-digit', minute: '2-digit'
        });
      }
    }
  }

  renderError(message) {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('content-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'flex';
    const msgEl = document.getElementById('error-message');
    if (msgEl) msgEl.textContent = message;
  }
}

// =============================================================================
// Initialize
// =============================================================================
const tracker = new AuroraTracker();

// Expose init function for dynamic loading (Nocturne main controller)
window.auroraTrackerInit = async function() {
  console.log('[Aurora] Initializing tracker...');
  initGeolocation();
  initTooltips();
  
  try {
    await tracker.fetchData();
    tracker.render();

    // Auto-refresh every 2 minutes (clear any existing interval first)
    if (window.auroraRefreshInterval) {
      clearInterval(window.auroraRefreshInterval);
    }
    window.auroraRefreshInterval = setInterval(async () => {
      try {
        await tracker.fetchData();
        tracker.render();
      } catch (e) {
        console.error('Auto-refresh failed:', e);
      }
    }, 2 * 60 * 1000);

  } catch (error) {
    console.error('Initial fetch failed:', error);
    tracker.renderError(error.message);
  }
};

// Auto-initialize on DOMContentLoaded (for standalone use)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.auroraTrackerInit);
} else {
  // DOM already loaded (dynamically loaded script)
  window.auroraTrackerInit();
}

// Retry button
document.addEventListener('click', (e) => {
  if (e.target.id === 'retry-btn') {
    document.getElementById('error-state').style.display = 'none';
    document.getElementById('loading-state').style.display = 'flex';
    tracker.fetchData().then(() => tracker.render()).catch((err) => tracker.renderError(err.message));
  }
});

// =============================================================================
// Tooltip System
// =============================================================================
function initTooltips() {
  const popup = document.createElement('div');
  popup.className = 'tooltip-popup';
  popup.innerHTML = `
    <div class="tooltip-header">
      <span class="tooltip-title"></span>
      <button class="tooltip-close">×</button>
    </div>
    <div class="tooltip-content"></div>
  `;
  document.body.appendChild(popup);

  const titleEl = popup.querySelector('.tooltip-title');
  const contentEl = popup.querySelector('.tooltip-content');
  const closeBtn = popup.querySelector('.tooltip-close');

  const closeTooltip = () => popup.classList.remove('visible');
  closeBtn.addEventListener('click', closeTooltip);
  
  // Close on outside click
  document.addEventListener('click', (e) => {
    if (popup.classList.contains('visible') && !popup.contains(e.target) && !e.target.closest('[data-tooltip]')) {
      closeTooltip();
    }
  });

  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-tooltip]');
    if (!card) return;

    e.preventDefault();
    const tooltip = card.getAttribute('data-tooltip');
    const name = card.querySelector('.metric-name')?.textContent || 'Info';
    
    titleEl.textContent = name;
    contentEl.textContent = tooltip;
    popup.classList.add('visible');
  });
}

