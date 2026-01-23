# 🌌 Aurora Tracker

Real-time aurora visibility tracker with a definitive **GO** or **NO GO** decision.

**No uncertainty. No "maybe". Just a clear answer: Should you go outside NOW?**

## Features

- **Binary Decision**: GO or NO GO based on actual space physics
- **Location-Aware**: Calculates if aurora can reach YOUR latitude
- **Real-time Data**: DSCOVR/ACE satellite data (not delayed Kp index)
- **NOAA OVATION Model**: Official aurora forecast (30-90 min prediction)
- **Local Sky Check**: Cloud coverage at your GPS location
- **Desktop & Mobile**: Responsive design works everywhere
- **Email Alerts**: Real-time GO alerts + daily summary reports
- **7 Space Weather Metrics**: Bz, Speed, Pressure, Density, Bt, Clock Angle, Duration

## The Science

Aurora requires three things:
1. **Southward IMF (Bz < 0)** - Opens Earth's magnetosphere to solar wind
2. **Strong Solar Wind** - Speed + density = energy input
3. **Clear Sky** - You need to actually see it

We use real-time **Bz field** and **solar wind data** from DSCOVR/ACE satellites instead of Kp index (which is delayed 3+ hours).

### Reference: May 2024 G4 Storm

All metrics are compared to the May 10-11, 2024 G4 geomagnetic storm - the strongest in 20+ years when aurora was visible as far south as Florida.

## Quick Start

```bash
# Install
npm install

# Run
node server.js

# Open
open http://localhost:8000
```

## Data Sources

- **NOAA SWPC**: Real-time solar wind from DSCOVR/ACE satellites
- **NOAA OVATION**: Official aurora probability forecast model
- **Open-Meteo**: Cloud coverage by GPS coordinates

## Metrics Displayed

| Metric | Why It Matters |
|--------|----------------|
| **Bz Field** | THE key factor - negative = aurora possible |
| **Solar Wind Speed** | Faster = more energy hitting magnetosphere |
| **Dynamic Pressure** | How hard solar wind pushes Earth's field |
| **Particle Density** | More particles = brighter aurora |
| **Bt Field** | Total magnetic field strength |
| **Clock Angle** | IMF direction (180° = pure south = best) |
| **Bz Duration** | Sustained southward (60 min window) better than spikes |

## Email Alerts (Optional)

Get notified when GO conditions are detected, plus daily summary reports.

Create `.env` file:
```
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
EMAIL_RECIPIENTS=you@email.com
EMAIL_COOLDOWN=60
```

**Features:**
- Real-time GO alerts when conditions are favorable
- Daily summary at 8 AM PST with yesterday's aurora conditions

## Decision Logic

The decision is **conservative** and **location-aware**:

```
NO GO if:
- Bz ≥ 0 (northward - magnetosphere closed)
- Aurora won't reach your latitude
- Bz weakly south with low pressure
- Low clouds > 50%
- Total sky clarity < 40%

GO if:
- Strong southward Bz that reaches your latitude + clear sky
- Good margin between aurora visibility and your location
- Supported by NOAA OVATION forecast
```

Marginal cases are NO GO - we're conservative to avoid false hope.

## Screenshots

### Desktop (2-column layout)
Decision card stays visible while scrolling through data.

### Mobile
All information in single column, touch-friendly tooltips.

## Development

See [QUICKREF.md](QUICKREF.md) for complete technical documentation.

## License

MIT
