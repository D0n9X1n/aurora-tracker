# QUICKREF.md - Project Structure & Architecture

## Project Overview

**Northern Lights Reporter** - Real-time aurora borealis visibility tracker for anywhere on Earth

**Purpose**: Display aurora visibility chance based on real-time NOAA data + G4 storm baseline comparison (0-100%)
**Features**: Auto-detects user location, works globally, 2-minute refresh with live NOAA data
**Tech Stack**: HTML5 + CSS3 + Vanilla JavaScript + Node.js proxy server
**Data Source**: 4 Live NOAA Space Weather APIs (plasma, magnetometer, Kp index, geomagnetic scales)
**Algorithm**: G4 Severe Geomagnetic Storm (May 2024) baseline similarity scoring
**Geolocation**: Browser Geolocation API (auto-detect) + Seattle fallback
**Use Case**: Aurora enthusiasts anywhere checking real-time space weather conditions before viewing attempt

## Requirements

1. Only keep `ReadMe.md` for humans and `QUICKREF.md` for AI agents.
2. Keep `quick-deploy.sh` as the only deployment file.

## Quick Start

```bash
npm install    # Install dependencies (if any updates needed)
npm run dev    # Start server on http://localhost:8000
# Open http://localhost:8000/src/index.html in browser
```

## Azure Deployment

```bash
./quick-deploy.sh
```

**Azure defaults**:
- App name: `northern-lights-reporter`
- Resource group: `northern-lights-reporter-rg`
- URL: `https://northern-lights-reporter.azurewebsites.net`
- SKU: Try `F1` (Free) first, fallback to `B1`

## File Structure

```
northern-lights-reporter/
├── src/
│   ├── index.html           # Main UI with baseline display section
│   ├── js/aurora-tracker.js # Core logic with G4 similarity calculation
│   └── css/styles.css       # Responsive styling for dark theme
├── scripts/
│   └── build.js             # No-op build for Azure Oryx
├── server.js                # Node.js proxy server (handles CORS)
├── package.json             # Project config
├── quick-deploy.sh          # Azure deployment (only deployment script)
├── ReadMe.md                # User documentation
└── QUICKREF.md              # This file - technical reference
```

## Core Components

### 1. server.js - Backend Proxy Server
**Purpose**: Fetch solar wind data without CORS issues, serve static files

**Why it exists**: 
- NOAA's API endpoints don't include CORS headers, so direct browser requests fail
- Proxy fetches data server-to-server, then returns it to the frontend
- Combines 4 real-time NOAA endpoints into unified response

**Features**:
- Fetches 4 NOAA APIs in parallel (millisecond latency)
- Parses plasma, magnetometer, Kp index, and geomagnetic scales data
- Caches responses for 2 minutes (real-time balance with API rate limits)
- Serves HTML/CSS/JS files from ./src/
- Auto-enables CORS headers on all responses
- Graceful fallback to G4-like mock data if any API fails
- Comprehensive error logging without spam

**Data Flow**:
```
Client Browser
    ↓
GET /api/solar-wind (localhost:8000)
    ↓
server.js (Node.js) - Fetches 4 APIs in parallel:
    ├─→ plasma-1-day.i.json (speed, density, temperature)
    ├─→ mag-1-day.i.json (bz, bx, by, bt in GSM coords)
    ├─→ noaa-planetary-k-index.json (Kp value)
    └─→ noaa-scales.json (current G-scale & forecast)
    ↓
processSpaceWeatherData() unifies into single object
    ↓
Returns {time, speed, density, temperature, bz, bx, by, bt, kp, gScale, gText}
    ↓
aurora-tracker.js processes and displays
```

**Current Data Source**: Live NOAA Real-Time APIs (verified working)
- Speed: ~300-800 km/s (real solar wind)
- Density: ~0.1-5 p/cm³ (real particle density)
- Bz: ~-30 to +30 nT (real magnetometer data)
- Bt: ~5-35 nT (real total field)
- Temperature: ~50k-500k K (real plasma temperature)
- Kp: 0-9 scale (real geomagnetic index)
- Update frequency: 1-2 minutes

**Endpoints**:
- `GET /api/solar-wind` - Real-time solar wind data (5 min updates)
- `GET /api/forecast-3hour` - 3-hour forecasts (not currently used)
- `GET /src/index.html` - Main interface
- `GET /src/js/aurora-tracker.js` - Application logic
- `GET /src/css/styles.css` - Styling

### 2. index.html - User Interface
**Purpose**: Display aurora visibility with real-time metrics and baseline comparison

**Key Sections**:
- Header: Title & subtitle
- Loading state: Shows spinner while fetching
- Main indicator: Large circle showing emoji + chance % + title
- **Metrics grid**: 8-column grid showing current solar wind values
- **Baseline section**: Shows G4 baseline values (May 2024 reference)
- Recommendations: Dynamic tips based on current conditions
- Real-time info: Link to NOAA SWPC for updates
- Last updated: Timestamp & location
- Error state: Shows if data fetch fails

**Current Metrics Displayed**:
1. Solar Wind Speed (km/s) - Current vs G4: 600 km/s
2. G4 Storm Similarity (%) - How close to May 2024 storm (0-100%)
3. Magnetic Field Bz (nT) - Southward component (Current vs G4: -25 nT)
4. Activity Level - Quiet/Active/Storm (derived from similarity)
5. Density (p/cm³) - Particle density (Current vs G4: 20 p/cm³)
6. Total Field Bt (nT) - Total magnetic field (Current vs G4: 30 nT)
7. Temperature (K) - Plasma temperature (Current vs G4: 2.0M K)
8. Latitude - Seattle at 47.6°N

**Baseline Section**: Shows May 2024 G4 storm values for reference
- Updated every time page loads or manual refresh (Ctrl+R / Cmd+R)
- Helps visualize the gap between current conditions and severe storm

**CSS Classes** (for customization):
- `.indicator-circle.chance-{veryLow|low|moderate|high|veryHigh}` - Main indicator styling
- `.metric-card` - Individual metric containers
- `.baseline-card` - Baseline value containers
- `.recommendations` - Tips container

**Dynamic Elements** (updated via aurora-tracker.js):
- `#chance-emoji` - Emoji showing current aurora state
- `#chance-title` - "No Aurora" to "Exceptional Display"
- `#visibility-percent` - Similarity percentage (0-99%)
- `#solar-wind` - Current wind speed
- `#kp-value` - Current G4 similarity %
- `#bz-value` - Current Bz field
- `#bt-value` - Current Bt field
- `#density-value` - Current density
- `#temp-value` - Current temperature
- `#activity-level` - Activity classification
- `#recommendations-list` - Generated tips
- `#last-updated` - Fetch timestamp
````
- `#hourly-forecast` - Generated hour cards
- `#last-updated` - Timestamp

### 2. aurora-tracker.js - Data & Logic
**Purpose**: Fetch NOAA data, calculate visibility, drive UI updates

**Main Class**: `AuroraTracker`

#### Data Structure
```javascript
this.data = {
    solarWind: {
        speed: number,      // km/s
        density: number,    // particles/cm³
        bz: number,         // nanoTesla
        timestamp: Date
    },
    kp: number              // 0-9 scale
}

this.forecast = [{
    time: Date,
    kp: number,
    chance: number          // 0-100%
}]
```

#### Key Methods

**fetchData()**: Async method
- Calls NOAA endpoints in parallel
- Returns Promise<boolean>
- Updates `this.data` and `this.forecast`
- Sets `this.lastUpdate` timestamp
- Throws error if both APIs fail

**processSolarWindData(data)**: Parse solar wind JSON
- Input: Array of objects with `{time, speed, density, bz, bt, temperature}`
- Extracts most recent entry
- Stores: `this.data.solarWind` with all parameters
- Fallback: Sets all to 0 if data missing
- Calculates aurora visibility based on G4 storm baseline comparison

**processForecastData(data)**: Parse 3-hour forecast JSON (DEPRECATED)
- No longer used in G4-similarity algorithm
- Kept for backward compatibility
- Stores: `this.data.kp` for reference only

**calculateVisibilityChance(kpIndex)**: Core visibility logic
- Input: Solar wind data object (speed, density, bz, bt, temperature)
- Algorithm: Compare current conditions to G4 storm baseline
  1. Calculate similarity score for each parameter (0-1 scale)
  2. Apply weighted factors (Bz: 35%, Speed: 20%, others: 15% each)
  3. Apply modifiers for sustained southward wind
  4. Convert to percentage and cap at 99%
- Output: 0-100 integer representing aurora likelihood

**getVisibilityRating()**: Map chance to user-friendly category
- Returns: `{level, emoji, title}`
- Levels: `veryLow|low|moderate|high|veryHigh`
- Thresholds: Kp-based (not directly used anymore)

**getCurrentChance()**: Get percentage for main display
- Returns: 0-100 integer (result of `calculateVisibilityChance()`)

**getActivityLevel()**: Map Kp to activity description
- Input: `this.data.kp`
- Output: String (Quiet/Unsettled/Active/Minor Storm/Major Storm/Extreme Storm)

**getRecommendations()**: Generate contextual tips
- Input: Current data + chance %
- Output: String array (3-6 items)
- Logic:
  - Always: Sunset timing + dark location
  - If chance >= 60: Specific viewing advice
  - If chance < 30: Wait & monitor
  - If wind > 400: Expected improvement
  - If Kp >= 6: Highlight good timing
  - If 70-90: Encourage going outside

**render()**: Update entire UI
- Shows content state (hides loading/error)
- Calls: renderMainIndicator(), renderMetrics(), renderRecommendations(), renderHourlyForecast(), renderLastUpdated()

**renderMainIndicator()**: Update main circle + title + percentage
- Gets rating from `getVisibilityRating()`
- Sets circle class to `chance-{level}`
- Updates emoji, title, percentage, description

**renderMetrics()**: Update 4-column metric grid
- Solar wind speed
- Kp value
- Latitude (static)
- Activity level

**renderRecommendations()**: Generate `<li>` items from `getRecommendations()`
- Maps string array to HTML list items

**renderHourlyForecast()**: Generate 8 hour cards
- Uses `this.forecast` array
- Shows: time, chance %, emoji indicator
- Creates grid layout

**renderLastUpdated()**: Show timestamp in footer
- Formats `this.lastUpdate` to HH:MM:SS

**renderError(message)**: Show error state
- Hides content, shows error div
- Displays error message from parameter

#### Initialization
```javascript
const tracker = new AuroraTracker();

// On page load:
await tracker.fetchData();
tracker.render();

// Auto-refresh: Every 30 minutes (30 * 60 * 1000 ms)
setInterval(async () => {...}, 30 * 60 * 1000)

// Manual refresh: Ctrl+R / Cmd+R
```

## NOAA API Endpoints

### Real-Time Data Sources (All 4 Working & Integrated)

#### 1. Solar Wind Plasma Data
**URL**: `https://services.swpc.noaa.gov/text/rtsw/data/plasma-1-day.i.json`
**Update Frequency**: ~1-minute
**Fields Used**:
- `speed`: Solar wind speed (km/s)
- `density`: Proton density (particles/cm³)
- `temperature`: Proton temperature (K)
- `time`: Timestamp

**Example Response**:
```json
[
  {
    "time": "2025-01-22 12:00:00",
    "speed": 587.98,
    "density": 0.18,
    "temperature": 154970.02
  }
]
```

#### 2. Magnetometer Data (GSM Coordinates)
**URL**: `https://services.swpc.noaa.gov/text/rtsw/data/mag-1-day.i.json`
**Update Frequency**: ~1-minute
**Fields Used**:
- `bz`: Z-component (southward direction, nanoTesla)
- `bx`: X-component (GSM coords, nanoTesla)
- `by`: Y-component (GSM coords, nanoTesla)
- `bt`: Total magnetic field magnitude (nanoTesla)
- `time`: Timestamp

**Example Response**:
```json
[
  {
    "time": "2025-01-22 12:00:00",
    "bz": -1.42,
    "bx": -8.88,
    "by": -2.00,
    "bt": 9.21
  }
]
```

#### 3. Kp Index (Geomagnetic Activity)
**URL**: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
**Update Frequency**: ~3-hourly
**Fields Used**:
- `Kp`: Kp index value (0-9 scale)
- `time_tag`: Timestamp

**Example Response**:
```json
[
  {
    "time_tag": "2025-01-22 12:00:00",
    "Kp": 3.33
  }
]
```

#### 4. Geomagnetic Scales (G/S/R Ratings)
**URL**: `https://services.swpc.noaa.gov/products/noaa-scales.json`
**Update Frequency**: Real-time
**Fields Used**:
- `current`: Current scale rating (0=none, 1-5=G1-G5)
- `0`, `1`, `2`, `3`: Current and 3-day forecast

**Example Response**:
```json
{
  "0": {
    "text": "none",
    "number": 0
  },
  "1": {
    "text": "none",
    "number": 0
  }
}
```

### Data Processing: processSpaceWeatherData()
**Location**: `server.js` lines ~80-120
**Purpose**: Parse 4 NOAA endpoints and extract latest values

**Process**:
1. Takes 4 raw API responses as input
2. Extracts most recent data point from each
3. Returns unified object with all fields:
   - `time`, `speed`, `density`, `temperature` (from plasma)
   - `bz`, `bx`, `by`, `bt` (from magnetometer)
   - `kp` (from Kp index)
   - `gScale`, `gText` (from scales)

**Error Handling**:
- If any API fails, uses fallback G4-like mock values
- Logs detailed errors to console for debugging
- Ensures frontend always gets valid response

### Historical Baseline: May 2024 G4 Storm (Used for Comparison)
Used for G4-similarity aurora activity calculation:
- **Speed**: 600-750 km/s
- **Density**: 15-25 protons/cm³
- **Bz**: -20 to -40 nT (sustained southward)
- **Bt**: 25-35 nT
- **Temperature**: 1-3 million K
- **Result**: Severe geomagnetic storm, aurora visible across entire US

## Key Algorithm: Real-Time Solar Wind Similarity

Located in `calculateVisibilityChance()`:

Aurora visibility is calculated based on **similarity to G4 storm baseline**:

```
Current Conditions Score:

Speed Factor:        current_speed / 600 km/s (weight: 0.20)
Density Factor:      current_density / 20 particles/cm³ (weight: 0.15)
Bz Factor:          |min(current_bz, 0)| / 30 nT (weight: 0.35)  ← Most important
Bt Factor:          current_bt / 30 nT (weight: 0.15)
Temperature Factor: current_temperature / 2000000 K (weight: 0.15)

Aurora Chance = (Speed×0.20 + Density×0.15 + Bz×0.35 + Bt×0.15 + Temp×0.15) × 100%

Modifiers for Seattle (47.6°N):
- If Bz sustained < -10 nT: +10% (sustained southward wind)
- If Speed > 700 km/s: +5% (strong driver)
- If Density > 20 particles/cm³: +5% (increased energy transfer)

Final: min(base + modifiers, 99%)
```

**Why These Parameters Matter**:

1. **Bz (Southward Component)** - 35% weight
   - Southward Bz efficiently couples solar wind to magnetosphere
   - G4 baseline: -20 to -40 nT
   - Threshold for aurora: Bz < -5 nT
   - Best for Seattle visibility: Bz < -15 nT

2. **Speed** - 20% weight
   - Higher speed = more ram pressure
   - G4 baseline: 600+ km/s
   - Threshold for aurora: speed > 350 km/s
   - Best for Seattle: speed > 500 km/s

3. **Density** - 15% weight
   - More particles = more energy transfer
   - G4 baseline: 15-25 particles/cm³
   - Threshold for aurora: density > 2 particles/cm³
   - Best for Seattle: density > 10 particles/cm³

4. **Bt (Total Field)** - 15% weight
   - Overall magnetic field strength
   - G4 baseline: 25-35 nT
   - Larger Bt amplifies Bz effects

5. **Temperature** - 15% weight
   - Higher temperature = higher energy particles
   - G4 baseline: 1-3 million K
   - Indicates plasma conditions

**Aurora Visibility at Seattle (47.6°N) by Similarity Score**:
- 0-10% similarity: No aurora expected
- 10-25% similarity: Possible polar aurora only
- 25-50% similarity: Aurora may reach northern US
- 50-75% similarity: Good chance for Seattle
- 75-90% similarity: Strong aurora display likely
- 90%+ similarity: Exceptional display, like G4 storm

## Configuration Constants

**In aurora-tracker.js**:
```javascript
const SEATTLE_LATITUDE = 47.6;           // User location latitude
const SEATTLE_LONGITUDE = -122.3;        // User location longitude

const NOAA_ENDPOINTS = {                 // API endpoints
    solarWindData: 'https://...',
    forecast3hour: 'https://...',
    alerts: 'https://...'                // Currently unused
};

const VISIBILITY_THRESHOLDS = {          // Old thresholds (deprecated)
    veryLow: { max: 2, ... },            // Kept for reference
    ...
};
```

**To customize for different location**:
1. Change `SEATTLE_LATITUDE` & `SEATTLE_LONGITUDE`
2. Adjust `calculateVisibilityChance()` thresholds if needed
3. Update HTML location text (line ~600 in index.html)

## State Management

### Global State
- Single `AuroraTracker` instance
- No external state management needed (small app)
- Data flow: NOAA API → `tracker.data` → `render()` → DOM

### UI States
1. **Loading**: Spinner shown, data fetching
2. **Content**: Main display, data rendered
3. **Error**: Error message, shows NOAA API failure

States mutually exclusive via `display: none/block`

## Error Handling

**Fetch Errors**:
- Solar wind fetch fails → Logs warning, sets to defaults
- Forecast fetch fails → Logs warning, sets Kp to 0
- Both fail → Renders error state
- User gets graceful fallback

**Data Processing**:
- Missing fields → Fallback to 0
- Invalid Kp → Clamps to 0-9 range
- Malformed JSON → Caught in Promise.catch()

## Performance Considerations

- **Bundle Size**: ~15KB (HTML + CSS + JS combined, unminified)
- **API Calls**: 2 parallel requests on load, then every 30 minutes
- **DOM Updates**: Full re-render per refresh (acceptable for 30-min interval)
- **Memory**: Stores only latest data point + 24 hours forecast
- **No Dependencies**: Pure vanilla JS, no libraries

## Browser Compatibility

- **Works**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Requires**: ES6 support (async/await, fetch, let/const)
- **Mobile**: Fully responsive, touch-friendly

## Configuration & Geolocation

### Automatic User Location Detection
The app now uses the **Browser Geolocation API** to automatically detect your location on page load.

**How it works**:
1. Page loads → Calls `initializeGeolocation()` 
2. Browser asks for location permission
3. If granted: Uses your actual latitude/longitude
4. If denied: Falls back to Seattle (47.6°N, -122.3°W)
5. Location updates in header: "📍 47.6°N, -122.3°W"

**Code Location**: `src/js/aurora-tracker.js` lines ~30-50

```javascript
function initializeGeolocation() {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      USER_LATITUDE = position.coords.latitude;
      USER_LONGITUDE = position.coords.longitude;
      updateLocationDisplay();
    },
    (error) => {
      // Permission denied → Use Seattle fallback
      USER_LATITUDE = 47.6;
      USER_LONGITUDE = -122.3;
    }
  );
}
```

**Global Variables** (updated dynamically):
- `USER_LATITUDE`: Current latitude (or 47.6 if using fallback)
- `USER_LONGITUDE`: Current longitude (or -122.3 if using fallback)
- `USER_LOCATION_NAME`: Display name (e.g., "47.60°N, -122.30°W")

### Manual Override (Advanced)
If you want to manually set a location without geolocation:

Edit `src/js/aurora-tracker.js` and modify:
```javascript
// Comment out geolocation call:
// initializeGeolocation();

// Set your location manually:
USER_LATITUDE = 51.5;      // Example: London
USER_LONGITUDE = -0.1;
USER_LOCATION_NAME = "London, UK";
```

### Server Configuration
The Node.js server requires no configuration - it auto-fetches from all 4 NOAA endpoints.

To change the cache duration (default: 2 minutes):
```javascript
// In server.js line ~15:
const CACHE_DURATION = 2 * 60 * 1000;  // 2 minutes
// Change to: const CACHE_DURATION = 5 * 60 * 1000;  // 5 minutes
```

## Customization Points

**Easy Changes**:
- Location: Allow browser geolocation OR edit USER_LATITUDE/LONGITUDE constants
- Refresh interval: Change `2 * 60 * 1000` in aurora-tracker.js to different ms
- Colors: Modify CSS classes in styles.css
- Text: Change strings in renderMetrics(), getRecommendations()

**Moderate Changes**:
- Add/remove metrics: Edit metrics-grid HTML & renderMetrics()
- Change visibility thresholds: Update calculateVisibilityChance() algorithm
- Add new forecast hours: Modify forecast rendering logic

**Hard Changes**:
- Use different NOAA endpoints: Must research new API format
- Add other data sources: Requires new fetch + parse logic
- Modify G4 baseline constants: Affects all similarity calculations

## Future Enhancement Ideas

- Add light pollution map integration
- Show historical aurora frequency at location
- Store viewing history locally
- Alert notifications when Kp spikes
- Multi-location comparison
- Integration with weather API (cloud cover)
- Twitter/Discord notifications for high activity

## Testing

**Manual Testing**:
1. Open index.html in browser
2. Check console for API errors: `console.log()` statements present
3. Verify data loads within 10 seconds
4. Change `SEATTLE_LATITUDE` to test different locations
5. Open DevTools > Network to inspect NOAA API responses

**API Debugging**:
- Visit endpoint URLs directly in browser to see raw JSON
- NOAA usually has data, but rare outages can happen
- Check NOAA status page: https://www.swpc.noaa.gov/

## Deployment

**Static Hosting** (recommended):
- GitHub Pages: Push to repo, enable Pages
- Netlify: Drag & drop files
- Vercel: Connect repo
- Any web server: Copy files to public directory

**No Backend Needed**: All processing client-side, all APIs public

## Security

- **HTTPS Only**: NOAA APIs require HTTPS
- **CORS**: NOAA endpoints allow public access
- **No Data Sent**: App only receives data, doesn't send anything
- **Local Only**: No user data stored or transmitted

---

**For Developers**: Fork/modify freely. Designed for rapid customization and educational use.
