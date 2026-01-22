# Northern Lights Reporter

A real-time web application to track northern lights (aurora borealis) visibility anywhere on Earth. Get instant updates using your device's location!

## Features

✨ **Auto-Detect Your Location**
- Uses browser geolocation API to find your exact coordinates
- Displays your latitude/longitude in the app
- Calculates aurora visibility for YOUR specific location
- Fallback to Seattle (47.6°N, -122.3°W) if location access denied

🌍 **Works Anywhere on Earth**
- Not just Seattle anymore!
- Aurora visibility calculations work for any latitude
- Real-time data shows your local space weather conditions
- Automatically adapts recommendations for your location

✨ **Real-Time NOAA Data (Truly Live!)**
- Live solar wind speed, density, temperature from ACE spacecraft
- Real-time magnetic field components (Bz, Bx, By, Bt)
- Current Kp index (3-hourly)
- Geomagnetic storm scales (G, S, R ratings)
- 2-minute refresh for true real-time updates

🌙 **Real-Time Space Weather Metrics**
- Solar wind speed (km/s) - actual live measurement
- Magnetic field Bz (southward component) - PRIMARY aurora driver
- Particle density (p/cm³) - energy transfer indicator
- Temperature (K) - plasma energy state
- Total field Bt (nT) - coupling efficiency
- Current Kp index - geomagnetic activity
- Geomagnetic scale classification

📊 **G4 Storm Baseline Comparison**
- Compares current conditions to May 2024 G4 severe geomagnetic storm
- Shows similarity percentage (0-100%) to extreme event
- Displays the gap between current and baseline conditions
- Historical reference for understanding severity

📊 **Baseline Reference Display**
- May 2024 G4 storm baseline values shown side-by-side
- Visual gap between current and baseline conditions
- Historical context for understanding space weather events
- Reference for interpreting severity levels

💡 **Smart Recommendations**
- Contextual advice based on real-time solar wind data
- Aurora viewing windows and best times
- Tips for optimal viewing conditions
- Direct links to NOAA Space Weather Prediction Center

🎨 **Beautiful, Responsive UI**
- Works on desktop, tablet, and mobile devices
- Dark-themed interface inspired by aurora aesthetics
- Smooth animations and intuitive indicators
- Baseline section for quick gap analysis

## How It Works

### Real-Time Data Instead of Static Forecasts

Unlike traditional aurora forecasts that rely solely on the Kp index, this tracker uses:

1. **Solar Wind Speed**: Fast solar wind is essential for aurora formation. Higher speeds (>400 km/s) mean better conditions.
2. **Magnetic Field Orientation (Bz)**: A south-pointing Bz component (negative values) is highly efficient at driving aurora activity.
3. **Current Geomagnetic Activity**: Real-time measurements, not predictions.
4. **Location-Based Visibility**: The visibility calculation accounts for Seattle's latitude (47.6°N).

### Visibility Calculation

The app calculates your viewing chances using:
- **Base Kp Value**: Determines aurora oval position
- **Solar Wind Boost**: Adds 0-15% based on wind speed
- **Magnetic Field Efficiency**: Adds up to 10% for favorable Bz
- **Location Factor**: Automatically tuned for Seattle's latitude

### Rating Levels

| Rating | Emoji | Kp Range | What It Means |
|--------|-------|----------|--------------|
| Very Low | ❌ | <2 | Aurora unlikely to reach Seattle |
| Low | ⚠️ | 2-4 | Possible only in far north |
| Moderate | 🌙 | 4-6 | Visible from dark locations |
| High | ✨ | 6-8 | Good chance for viewing |
| Very High | 🌟 | 8+ | Strong display likely |

## Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection (data fetched from NOAA)
- Optional: A location in the Seattle area for best accuracy

### Installation

1. Clone or download this repository
2. Open `index.html` in your web browser
3. That's it! Data loads automatically from NOAA

### No Installation Needed!
This is a client-side application. Just open the HTML file and it works immediately.

## Deploy to Azure

The fastest way to deploy the full app (including the Node.js proxy) is:

```bash
./quick-deploy.sh
```

Deployment defaults:
- App name: `northern-lights-reporter`
- Resource group: `northern-lights-reporter-rg`
- URL: `https://northern-lights-reporter.azurewebsites.net`
- SKU: Try `F1` (Free) first, fallback to `B1` if Free is unavailable

## Usage

### Basic Viewing
1. Open the application in your browser
2. Check the main aurora chance indicator
3. Read the recommendations for tips

### Understanding the Metrics

**Solar Wind Speed (km/s)**
- <300: Slow solar wind, weak aurora
- 300-400: Moderate conditions
- 400-600: Good aurora potential
- >600: Excellent conditions

**Kp Value (0-9)**
- Measures geomagnetic disturbance
- Higher = stronger aurora, visible further south
- In real-time mode, focus on trend rather than absolute value

**Activity Level**
- Quiet: Normal space weather
- Unsettled: Minor activity
- Active: Increasing aurora activity
- Storm: Major geomagnetic storm

### Checking the Forecast
- Look at the hourly forecast section
- Identify peaks in visibility percentage
- Plan to head out during high-chance hours

### Manual Refresh
- Press **Ctrl+R** (or **Cmd+R** on Mac) to manually refresh data
- Data automatically refreshes every 30 minutes

## What You Need to See Aurora

### Ideal Conditions (All Required)
✓ **Clear skies** (cloudy nights block aurora)
✓ **Dark location** (away from city lights - drive 30-45 min north)
✓ **High visibility chance** (this app shows you when)
✓ **Clear eyes** (give yourself 15-20 minutes to adjust to darkness)

### Best Times
- After sunset, aurora is most visible 8 PM - 2 AM
- Aurora is most active during geomagnetic storms
- Best viewing is at true north, between 9 PM - 11 PM

### Where to Go Near Seattle
**For best dark skies, head north:**
- Anacortes (50 min north): Excellent dark skies
- Snoqualmie Pass (45 min east): Mountain dark skies
- Deception Pass (50 min north): Great spot with views
- Rattlesnake Ledge (30 min east): Closer option

**Avoid:**
- Downtown Seattle (too much light pollution)
- Tacoma area (south-facing, lights everywhere)
- Towards the ocean (usually cloudy)

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js proxy server with caching
- **Data Source**: Real-time solar wind data
- **Fallback**: Realistic G4-like mock data when API unavailable
- **Caching**: 5-minute cache to reduce API calls

## Current Data Source

**Live NOAA Space Weather APIs** (Real-time, verified working):

1. **Solar Wind Plasma Data**
   - Endpoint: `https://services.swpc.noaa.gov/text/rtsw/data/plasma-1-day.i.json`
   - Provides: Speed (km/s), Density (p/cm³), Temperature (K)
   - Update frequency: ~1-minute

2. **Magnetometer Data (GSM Coordinates)**
   - Endpoint: `https://services.swpc.noaa.gov/text/rtsw/data/mag-1-day.i.json`
   - Provides: Bz (southward), Bx, By, Bt (total field) in nanoTesla
   - Update frequency: ~1-minute

3. **Kp Index (Geomagnetic Disturbance)**
   - Endpoint: `https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json`
   - Provides: Kp value (0-9 scale) representing geomagnetic activity
   - Update frequency: ~3-hourly

4. **Geomagnetic Scales & Forecasts**
   - Endpoint: `https://services.swpc.noaa.gov/products/noaa-scales.json`
   - Provides: Current and 3-day forecast G/S/R scale ratings
   - Update frequency: Real-time

**Data Integration:**
- Backend Node.js server combines all 4 endpoints into unified `/api/solar-wind` endpoint
- Fetches all 4 APIs in parallel (millisecond latency)
- Cache duration: 2 minutes (real-time balance with NOAA rate limits)
- Fallback: Mock G4-like data if any endpoint fails (graceful degradation)

**Refresh Rate:** 2-minute intervals (tracks 1-minute NOAA data updates)

## API Endpoints

### `/api/solar-wind`
Returns unified real-time space weather data combining all 4 NOAA sources.

**Response Example:**
```json
{
  "time": "2026-01-22 07:03:00",
  "speed": 587.98,
  "density": 0.18,
  "temperature": 154970.02,
  "bz": -1.42,
  "bx": -8.88,
  "by": -2,
  "bt": 9.21,
  "kp": 3.33,
  "gScale": "0",
  "gText": "none"
}
```

**Fields:**
- `speed`: Solar wind speed in km/s (typical: 300-1000)
- `density`: Plasma density in p/cm³ (typical: 0.1-10)
- `temperature`: Temperature in Kelvin (typical: 100k-500k)
- `bz`, `bx`, `by`, `bt`: Magnetic field components in nT (GSM coordinates)
- `kp`: Geomagnetic index 0-9 (higher = more aurora activity)
- `gScale`: Current G-scale (0=none, 1-5=G1 to G5)
- `gText`: Human-readable scale description

## Customization

### Change Your Location
Edit `aurora-tracker.js`:
```javascript
const SEATTLE_LATITUDE = 47.6;      // Change to your latitude
const SEATTLE_LONGITUDE = -122.3;   // Change to your longitude
```

Then adjust visibility thresholds based on your latitude.

### Adjust Refresh Rate
Edit `aurora-tracker.js`:
```javascript
// Change 30 * 60 * 1000 to your desired interval in milliseconds
setInterval(async () => {
    // Auto-refresh code
}, 30 * 60 * 1000);
```

## Data Accuracy

- **Solar Wind Data**: Updated every 5 minutes by NOAA
- **Forecast Data**: Updated every 3 hours
- **Kp Index**: Real-time measurements from magnetometer stations
- **Last Update**: Shown in footer of application

## Limitations

- Aurora is invisible during daylight (even if activity is high)
- Clouds block aurora completely
- Light pollution reduces visibility significantly
- Extreme solar wind conditions may cause brief data gaps
- NOAA API requires internet connection

## Science Behind This Tracker

### Why Not Just Use Kp?

The Kp index is a 3-hour averaged value that doesn't capture:
- **Real-time solar wind fluctuations** that drive immediate aurora
- **Efficiency variations** based on Bz orientation
- **Local day/night effects** on aurora visibility

This tracker uses actual measured space weather data for more accurate, real-time predictions.

### Aurora Formation

Aurora is created when:
1. Solar wind carries charged particles
2. Particles interact with Earth's magnetic field
3. Magnetosphere accelerates particles toward poles
4. Particles collide with atmospheric oxygen/nitrogen
5. Collisions create beautiful light displays!

The stronger the solar wind and the more efficient the magnetic coupling (south-pointing Bz), the more aurora you see.

## Troubleshooting

### "Unable to fetch aurora data"
- Check your internet connection
- Ensure NOAA services are online (rare outages happen)
- Try refreshing the page
- Disable VPN/proxy if you have one

### No hourly forecast data
- NOAA forecast may be updating, try refreshing
- Check if Kp value shows - solar wind data is most reliable

### Always shows "Very Low Chance"
- This might be accurate! Low solar activity is common
- Check the actual Kp and wind speed values
- Look back in a few hours/days for better conditions

## Contributing

Found a bug or have a suggestion? Consider:
- Checking NOAA status page
- Verifying your location coordinates are correct
- Checking if it's a browser compatibility issue

## Resources

- **NOAA Space Weather Prediction Center**: https://www.swpc.noaa.gov/
- **Aurora Forecast**: https://www.swpc.noaa.gov/products/aurora-forecast
- **Solar Wind Data**: https://www.swpc.noaa.gov/products/real-time-solar-wind
- **What is Kp Index?**: https://www.swpc.noaa.gov/noaa-scales-explanation
- **Dark Sky Finder**: https://darksitefinder.com/

## License

Open source and free to use. Built for aurora enthusiasts everywhere.

## Support

This application relies on NOAA's free public API. If you find it useful, consider:
- Sharing with fellow aurora enthusiasts
- Reporting bugs and improvements
- Checking weather forecasts before heading out (clouds are the real enemy!)

---

**Remember**: The best way to see aurora is to get outside! Even low chance predictions can result in beautiful displays with luck and persistence. Happy aurora hunting! 🌌✨
