# QUICKREF.md - Nocturne v3.0.0

> **⚠️ FOR AI AGENTS**: Read this file FIRST before making any changes to this codebase. This contains the complete technical specifications for the Nocturne 24x7 monitoring service.

---

## 🎯 System Overview

**Project Name**: Nocturne  
**Purpose**: 24x7 personal monitoring assistant with modular trackers  
**Version**: 3.0.0  
**Node.js**: 18+ (ES Modules)  
**Deployment**: Azure App Service (Basic B1 for Always On)

### Core Modules

| Module | Description | Data Source |
|--------|-------------|-------------|
| Dashboard | At-a-glance overview of all services | All APIs |
| Aurora | Real-time aurora visibility + current weather | NOAA DSCOVR/ACE, Open-Meteo |
| Crypto | Top cryptocurrency prices & market stats | CoinGecko |
| Stocks | Stock watchlist + US market movers | Yahoo Finance |
| News | Breaking news from RSS feeds | BBC, NPR, CNBC, etc. |
| Settings | Theme, watchlist, location config | Local storage |

> **Note**: Weather data is integrated into the Aurora page for viewing conditions. No separate Weather tab.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  src/index.html → Tabbed SPA (vanilla JS ES Modules)        │
│  src/modules/*  → Individual module JS files                │
│  src/css/*      → Modular stylesheets                       │
└─────────────────────────────────────────────────────────────┘
                              ↑ HTTP/JSON
┌─────────────────────────────────────────────────────────────┐
│                     server.js (Node.js)                      │
│  - API proxy with caching                                    │
│  - Static file serving                                       │
│  - Email alerts (optional)                                   │
│  - Daily summary emails (optional)                           │
└─────────────────────────────────────────────────────────────┘
                              ↑ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                    External APIs (FREE)                      │
│  NOAA, Open-Meteo, CoinGecko, Yahoo Finance, RSS Feeds      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
nocturne/
├── server.js                    # Backend: ~2100 lines, all API routes
├── package.json                 # Dependencies (minimal: dotenv only)
├── .env                         # Optional config (email, alerts)
├── .eslintrc.json               # ESLint config (2-space indent)
├── quick-deploy.sh              # Azure deployment script
├── QUICKREF.md                  # This file - AI reference
├── ReadMe.md                    # Human documentation
│
├── src/
│   ├── index.html               # Main SPA entry point
│   ├── css/
│   │   ├── styles.css           # Base/reset styles
│   │   ├── nocturne.css         # Module styles (~2900 lines)
│   │   └── charts.css           # Chart component styles
│   ├── js/
│   │   ├── nocturne.js          # Main controller & router
│   │   ├── aurora.js            # Aurora decision logic
│   │   └── charts.js            # SVG chart library
│   └── modules/
│       ├── dashboard/dashboard.js
│       ├── aurora/aurora.js     # Includes current weather display
│       ├── crypto/crypto.js
│       ├── stocks/stocks.js     # ~1050 lines, company DB
│       ├── news/news.js
│       └── settings/settings.js
│
├── public/
│   ├── manifest.json            # PWA manifest
│   ├── favicon.svg              # App favicon
│   └── sw.js                    # Service worker
│
└── tests/
    └── server.test.js           # 59 tests (Node.js test runner)
```

---

## 🔌 API Endpoints

### Aurora APIs

| Endpoint | Description | Cache |
|----------|-------------|-------|
| `GET /api/solar-wind` | Real-time solar wind data | 2 min |
| `GET /api/clouds?lat=&lon=` | Cloud coverage & forecast | 15 min |
| `GET /api/ovation?lat=&lon=` | NOAA aurora probability | 10 min |
| `GET /api/aurora/status` | Combined aurora GO/NO GO status | 2 min |

### Market APIs

| Endpoint | Description | Cache |
|----------|-------------|-------|
| `GET /api/stocks/prices` | Watchlist stocks + indices | 1 min |
| `GET /api/stocks/market-status` | NYSE open/close status | 1 min |
| `GET /api/stocks/nasdaq-movers` | Top 10 US market movers | 10 min |
| `GET /api/stocks/chart?symbol=&range=` | Stock price chart data | 5 min |
| `GET /api/crypto/prices` | Top 10 crypto prices | 2 min |

### Other APIs

| Endpoint | Description | Cache |
|----------|-------------|-------|
| `GET /api/weather/forecast?lat=&lon=` | Full weather forecast | 15 min |
| `GET /api/news/headlines` | Aggregated RSS news | 5 min |
| `GET /api/status` | Server health & module status | None |

---

## 📊 Stocks Module Details

### US Market Movers

Fetches **top 10 gainers and losers** from ALL US exchanges:
- NYSE (NYQ, NYS)
- NASDAQ (NMS, NGM, NCM, NIM)
- AMEX (ASE)
- NYSE ARCA (PCX)

### Watchlist (Default)

Big Tech + AI Leaders:
```javascript
['MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AAPL', 'AMD', 'PLTR', 'SMCI', 'ARM']
```

### Company Info Database

The stocks module includes a built-in company database (`COMPANY_INFO`) with:
- **90+ companies** with sector tags and brief descriptions
- Used to provide context for market movers
- Shows sector badge and company description on mover cards

Example entries:
```javascript
NVDA: { sector: 'Chips', desc: 'AI GPU leader - powering ChatGPT, autonomous cars' }
TSLA: { sector: 'Auto', desc: 'Electric vehicles, solar, AI robotics - Musk\'s empire' }
```

### Email Alerts

Sends email alerts when any stock moves **>20%** in a single day:
- Cooldown: 4 hours per symbol (prevents spam)
- Only triggers during market hours (9:30 AM - 4:00 PM ET)

---

## 🌌 Aurora Module Decision Logic

### Binary GO / NO GO (No MAYBE!)

The aurora module uses **real-time physics-based** decision making:

1. **Darkness Check**: Sun must be below -6° (civil twilight)
2. **Bz Field**: Must be southward (negative) - this opens the magnetosphere
3. **Latitude Reach**: Calculate if aurora can reach user's latitude
4. **Sky Clarity**: Low clouds < 50% blocking

### Integrated Current Weather

The Aurora page now displays **current weather conditions** to help with viewing decisions:

- **Temperature & Feels Like**: Know what to wear when going outside
- **Weather Description**: Current conditions (clear, cloudy, rain, snow)
- **Humidity & Wind**: Environmental factors for comfort
- **Visibility**: Crucial for aurora viewing
- **Viewing Tip**: Smart tip based on current conditions (bundling up, rain warning, etc.)

### Why Bz Over Kp?

- **Kp** is a 3-hour lagging average
- **Bz** is real-time from DSCOVR satellite at L1 point
- Bz southward = magnetosphere opens = aurora possible
- Bz northward = magnetosphere closed = no aurora (regardless of Kp)

### G4 Storm Baseline (May 10-11, 2024)

Reference values from the strongest storm in 20+ years:
```javascript
{ speed: 750, density: 25, bz: -30, bt: 40, pressure: 15 }
```

---

## 🎨 Frontend Structure

### CSS Architecture

- **styles.css**: Base reset, variables, typography
- **nocturne.css**: All module-specific styles (~2900 lines)
- **charts.css**: SVG chart styling

### CSS Variables

```css
:root {
  --bg-primary: #0a0a0f;
  --bg-card: #12121a;
  --text: #ffffff;
  --text-dim: #8b8ba3;
  --accent: #6366f1;
  --go: #22c55e;
  --no-go: #ef4444;
}
```

### Mobile-First Design

- Tabs show icons only on mobile (< 640px)
- Touch-friendly: 48px min tap targets
- Horizontal scroll for tabs with scroll-snap
- All touch events use `touch-action: manipulation`

---

## 🔧 Configuration

### Environment Variables (.env)

```env
# Server
PORT=8000

# Email Alerts (Optional)
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=app-specific-password
EMAIL_RECIPIENTS=user1@email.com,user2@email.com
EMAIL_COOLDOWN=60

# Alert Location
ALERT_LATITUDE=47.6
ALERT_LONGITUDE=-122.3
ALERT_LOCATION_NAME=Seattle, WA

# Module Toggles
AURORA_ENABLED=true
STOCKS_ENABLED=true
NEWS_ENABLED=true

# Custom Watchlist
STOCKS_WATCHLIST=MSFT,NVDA,TSLA,META,GOOGL,AAPL,AMD,PLTR,SMCI,ARM
```

---

## 🧪 Testing

Run all 59 tests:
```bash
npm test
```

Test structure:
- **Static Files** (10 tests): HTML, CSS, JS, PWA assets
- **Aurora APIs** (12 tests): Solar wind, clouds, ovation
- **Weather APIs** (11 tests): Forecast, conditions
- **Stocks APIs** (15 tests): Prices, movers, charts
- **Crypto/News** (4 tests): Price feeds, RSS
- **Status** (3 tests): Health checks
- **Security** (7 tests): Error handling, validation

---

## 🚀 Deployment

### Azure App Service

```bash
# Use the quick-deploy script
./quick-deploy.sh

# Or manual deployment
az webapp up --name nocturne --resource-group nocturne-rg --plan nocturne-plan --runtime "NODE|22-lts"
az webapp config set --name nocturne --resource-group nocturne-rg --always-on true
```

> **Important**: Use Basic tier (B1) or higher for Always On. Free tier sleeps after 20 min.

---

## 📋 Version Maintenance

When releasing a new version, update ALL these files:

| File | Location |
|------|----------|
| `package.json` | `"version": "x.x.x"` (source of truth) |
| `QUICKREF.md` | Title line |
| `server.js` | Startup console log |
| `src/js/aurora.js` | Header comment |
| `src/css/styles.css` | Header comment |

---

## ⚠️ Common Pitfalls

1. **ESLint**: Uses 2-space indentation. Run `npx eslint --fix` before committing.
2. **ES Modules**: All files use `import/export`. No `require()`.
3. **CORS**: Server adds `Access-Control-Allow-Origin: *` to all API responses.
4. **Caching**: External API calls are cached. Check cache TTL before debugging.
5. **Market Hours**: Stock movers only update during US market hours (9:30-4:00 ET).

---

## 🔗 External Resources

- [NOAA Space Weather](https://www.swpc.noaa.gov/)
- [Open-Meteo API](https://open-meteo.com/)
- [CoinGecko API](https://www.coingecko.com/api)
- [Yahoo Finance](https://finance.yahoo.com/)
