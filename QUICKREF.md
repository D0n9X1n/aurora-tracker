# QUICKREF.md - Aurora Tracker v1.0

> **For AI Agents**: Complete technical specifications for the Aurora Tracker application.

---

## System Overview

**Purpose**: Real-time aurora visibility tracker with binary GO/NO GO decision.

**Core Decision**: **GO** or **NO GO** (no middle ground!) based on:
1. **Darkness** - Is it night? (sun below horizon)
2. **Space Weather** - Is aurora actually happening? (Bz, speed, pressure)
3. **Sky Conditions** - Can you see it? (cloud coverage by layer)

**Key Insight**: We use **Bz field** and real-time satellite data instead of Kp index because:
- Kp is a 3-hour average, delayed by hours
- Bz and pressure are real-time from DSCOVR/ACE satellites
- Physics-based decision vs lagging indicator

**Architecture**: Node.js server proxying NOAA + Open-Meteo APIs → Responsive HTML/CSS/JS frontend

---

## File Structure

```
aurora-tracker/
├── server.js                    # Backend: API proxy, data processing, email alerts
├── src/
│   ├── index.html               # Frontend: Responsive 2-column layout
│   ├── js/aurora-tracker.js     # Client: Decision logic, rendering
│   └── css/styles.css           # Styling: Mobile-first, desktop 2-column
├── public/
│   └── assets/                  # Static assets (favicon, images)
├── scripts/
│   └── build.js                 # Build script
├── tests/                       # Test files
├── package.json                 # Dependencies
├── quick-deploy.sh              # Azure deployment script
├── QUICKREF.md                  # This file (AI reference)
└── ReadMe.md                    # Human-readable documentation
```

---

## Data Sources

### NOAA Space Weather APIs

| API | URL | Data |
|-----|-----|------|
| Plasma | `services.swpc.noaa.gov/products/solar-wind/plasma-7-day.json` | Speed, Density, Temperature |
| Magnetometer | `services.swpc.noaa.gov/products/solar-wind/mag-7-day.json` | Bx, By, Bz, Bt |
| Scales | `services.swpc.noaa.gov/products/noaa-scales.json` | G-Scale (storm level) - Current & Predicted |
| OVATION | `services.swpc.noaa.gov/json/ovation_aurora_latest.json` | Aurora probability forecast (30-90 min) |

### Derived Calculations

| Metric | Formula | Purpose |
|--------|---------|---------|
| **Dynamic Pressure** | `P = 1.67e-6 × density × speed²` (nPa) | Magnetosphere compression |
| **Clock Angle** | `θ = atan2(By, Bz)` (degrees) | IMF direction, 180° = best |
| **Bz Duration** | Count of southward readings in last 60 min | Sustained vs spike |

### Cloud Data

- **Source**: Open-Meteo API (`api.open-meteo.com/v1/forecast`)
- **Layers**: Low (0-2km), Mid (2-6km), High (6km+)
- **Trend**: 6-hour forecast direction (clearing/increasing/stable)

---

## API Endpoints

### GET /api/solar-wind

Returns processed space weather data with all derived metrics.

```typescript
{
  time: string;           // ISO timestamp
  // Raw measurements
  speed: number;          // km/s (normal: 400, storm: 600+)
  density: number;        // p/cm³ (normal: 5, storm: 15+)
  temperature: number;    // K
  bz: number;             // nT (negative = southward = aurora!)
  bt: number;             // nT (total field)
  bx: number;             // nT (sunward component)
  by: number;             // nT (east-west component)
  // Derived values
  pressure: number;       // nPa (dynamic pressure)
  clockAngle: number;     // degrees (180 = pure south)
  bzSouthDuration: number;// minutes in last 60 min
  auroraPower: number;    // GW estimate
  // Scores (% of G4 baseline)
  scores: {
    bz: number;
    speed: number;
    density: number;
    bt: number;
    pressure: number;
    temperature: number;
  };
  similarity: number;     // 0-99% match to G4 storm
  // NOAA official - Current Observed
  gScale: number;         // 0-5 (current)
  gText: string;          // "none" | "minor" | etc.
  gObservedTime: string;  // ISO timestamp
  // NOAA official - Predicted (24h)
  gPredicted: number;     // 0-5 (predicted)
  gPredictedText: string; // "none" | "minor" | etc.
  gPredictedTime: string; // ISO timestamp
  // Reference
  baseline: {             // G4 storm values for comparison
    speed: 750, density: 25, bz: 30, bt: 40, pressure: 15, ...
  }
}
```

### GET /api/clouds?lat={lat}&lon={lon}

Returns cloud coverage with forecast trend.

```typescript
{
  total: number;     // 0-100%
  low: number;       // 0-100% (blocks aurora)
  mid: number;       // 0-100% (reduces clarity)
  high: number;      // 0-100% (minor effect)
  visibility: number;// meters
  weatherCode: number;// WMO weather code
  trend: string;     // "clearing" | "increasing" | "stable"
  forecast: number[];// Next 6 hours low cloud %
  time: string;      // ISO timestamp
}
```

### GET /api/ovation?lat={lat}&lon={lon}

Returns NOAA OVATION aurora forecast model data.

```typescript
{
  observationTime: string;  // ISO timestamp
  forecastTime: string;     // ISO timestamp (30-90 min ahead)
  atLocation: number;       // Aurora probability at your coordinates (0-100)
  nearbyMax: number;        // Max probability visible on northern horizon (0-100)
  nearbyMaxLat: number;     // Latitude of max aurora activity
  viewable: boolean;        // Whether aurora may be viewable
}
```

---

## Decision Logic

### Binary GO / NO GO Rules (Location-Aware)

The decision logic is **conservative**, **latitude-aware**, and **time-aware** - aurora must reach your location and it must be dark.

```javascript
// STEP 0: Calculate darkness (sun position)
sunAltitude = calculateSunPosition(lat, lon, time)
if (sunAltitude > 0)      → NO GO  // Daytime - aurora not visible
if (sunAltitude > -6)     → MARGINAL  // Civil twilight - maybe visible

// STEP 1: Calculate visible latitude based on Bz and G-Scale
visibleLat = getVisibleLatitude(bz, gScale, speed)
// G5: 30°N, G4: 35°N, G3: 45°N, G2: 50°N, G1: 55°N
// Or Bz-based: -25nT→35°, -20nT→40°, -15nT→45°, etc.

latitudeMargin = userLatitude - visibleLat  // negative = aurora won't reach you

// STEP 2: ABSOLUTE NO GO CONDITIONS
if (bz >= 0)              → NO GO  // Northward IMF, magnetosphere closed
if (latitudeMargin < 0)   → NO GO  // Aurora won't reach your latitude
if (bz > -5 && !pressureHigh) → NO GO  // Too weak for mid-latitudes
if (lowClouds > 50%)      → NO GO  // Can't see through low clouds
if (skyClarity < 40%)     → NO GO  // Too cloudy overall

// STEP 3: GO CONDITIONS (conservative scoring)
goScore = 0
if (bz < -15)    goScore += 35  // Extreme southward
if (bz < -8)     goScore += 25  // Strong southward
if (bz < -3)     goScore += 12  // Good southward
if (bzDuration >= 15 && bzStrong) goScore += 12  // Sustained + strong
if (speed > 600) goScore += 12  // CME speeds
if (speed > 450) goScore += 6   // Enhanced
if (pressure > 3) goScore += 6  // High pressure
if (goodClockAngle) goScore += 4  // 120°-240°
if (latitudeMargin > 10) goScore += 10  // Strong margin
if (latitudeMargin > 5) goScore += 5   // Good margin
if (sky >= 60)   goScore += 8   // Clear sky
if (sky >= 40)   goScore += 4   // Partly clear

// OVATION Model bonus (supporting evidence)
if (ovationAtLocation >= 30%) goScore += 8
if (ovationNearby >= 40%) goScore += 4

// STEP 4: FINAL DECISION
if (goScore >= 55 && sky >= 60 && latitudeMargin >= 5) → GO (high confidence)
if (goScore >= 45 && sky >= 50 && latitudeMargin >= 0) → GO (good conditions)
if (goScore >= 35 && sky >= 50 && latitudeMargin >= -3) → NO GO (marginal)
else → NO GO
```

### Why No MAYBE?

- User needs actionable decision
- MAYBE leads to paralysis
- Either conditions justify going out, or they don't
- But we're **conservative** - marginal cases are NO GO, not GO

---

## G4 Storm Baseline (May 10-11, 2024)

Reference values from the strongest geomagnetic storm in 20+ years:

| Metric | Peak Value | Typical Quiet |
|--------|------------|---------------|
| Bz | -30 nT | -2 to +2 nT |
| Speed | 750 km/s | 400 km/s |
| Density | 25 p/cm³ | 5 p/cm³ |
| Bt | 40 nT | 5 nT |
| Pressure | 15 nPa | 2 nPa |
| Temperature | 500,000 K | 100,000 K |

**Similarity Score Weights**:
- Bz: 40% (most critical)
- Speed: 20%
- Density: 15%
- Bt: 10%
- Pressure: 10%
- Temperature: 5%

---

## Sky Score Calculation

```javascript
// Weight by impact on visibility
const weighted = low * 1.0 +    // Low clouds = total block
                 mid * 0.7 +    // Mid clouds = partial
                 high * 0.3;    // High clouds = minor
const skyScore = 100 - weighted;
```

---

## Email Alerts

### Real-time GO Alerts

Triggered when GO conditions detected:
- Similarity ≥ 40% AND
- Bz < -5 nT AND
- Cooldown period elapsed (default 60 min)

### Daily Summary Email

Sent daily at 8:00 AM PST with yesterday's aurora conditions:
- Peak G4 similarity and timestamp
- Min/max/avg for all metrics (speed, density, Bz, Bt)
- Hours with good Bz conditions (< -5 nT)
- Overall verdict: EXCELLENT / GOOD / MODERATE / QUIET

**Configuration** (environment variables):
```
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=app-specific-password
FROM_EMAIL=your-email@gmail.com
EMAIL_RECIPIENTS=user1@email.com,user2@email.com
EMAIL_COOLDOWN=60
```

---

## Frontend Structure

### Desktop Layout (768px+)

```
┌─────────────────────────────────────────────┐
│ Header (Title + Live Indicator)              │
├───────────────┬─────────────────────────────┤
│ Left Column   │ Right Column                 │
│ (sticky)      │                              │
│               │                              │
│ ┌───────────┐ │ ┌─────────────────────────┐ │
│ │ GO / NO GO│ │ │ Current Storm (G0-G5)   │ │
│ └───────────┘ │ ├─────────────────────────┤ │
│               │ │ Predicted Storm (24h)   │ │
│ G4 Similarity │ └─────────────────────────┘ │
│               │                              │
│ Aurora | Sky  │ Space Weather Metrics       │
│ factors       │ ┌─────┬─────┬─────┐        │
│               │ │ Bz  │Speed│Press│        │
│ Recommendation│ ├─────┼─────┼─────┤        │
│               │ │Dens │ Bt  │Clock│        │
│ Cloud Cover   │ ├─────┴─────┴─────┤        │
│ (Low/Mid/High)│ │ Bz Duration      │        │
│               │ └─────────────────┘         │
│               │                              │
│               │ Viewing Info                 │
│               │ ┌─────────────────────────┐ │
│               │ │ NOAA OVATION Forecast   │ │
│               │ │ (At Location + North)   │ │
│               │ └─────────────────────────┘ │
└───────────────┴─────────────────────────────┘
```

### Mobile Layout (<768px)

Single column, same components stacked vertically.

---

## Development

### Run Locally

```bash
npm install
node server.js
# Open http://localhost:8000
```

### Key Files to Modify

| Change | File(s) |
|--------|---------|
| Decision thresholds | `src/js/aurora-tracker.js` → `getDecision()` |
| Latitude visibility | `src/js/aurora-tracker.js` → `getVisibleLatitude()` |
| Add new metric | `server.js` + `index.html` + `aurora-tracker.js` |
| Styling | `src/css/styles.css` |
| API endpoints | `server.js` |
| Real-time alerts | `server.js` → `checkAndSendAlerts()` |
| Daily summary | `server.js` → `sendDailySummaryEmail()` |

---

## Caching

| Cache | TTL | Purpose |
|-------|-----|---------|
| Solar wind | 2 min | Reduce NOAA API load |
| Cloud data | 15 min | Weather changes slowly |
| OVATION forecast | 10 min | Model updates every ~30 min |

---

## Error Handling

- API failures return mock/cached data
- Cloud API failure defaults to clear sky (fail toward GO)
- Network errors show NO GO with retry button
- All errors logged to console

---

## Testing

```bash
# Check server
curl http://localhost:8000/api/solar-wind | jq

# Check clouds
curl "http://localhost:8000/api/clouds?lat=47.6&lon=-122.3" | jq

# Verify page loads
open http://localhost:8000
```
