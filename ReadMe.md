# 🌙 Nocturne v3.1.0

**24x7 Personal Monitoring Assistant**

A comprehensive monitoring dashboard for tracking aurora conditions, cryptocurrency, stock markets, and breaking news - all from free APIs with no keys required!

![Version](https://img.shields.io/badge/version-3.1.0-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![Tests](https://img.shields.io/badge/tests-59%20passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📸 Module Overview

| Module | Description |
|--------|-------------|
| **Dashboard** | At-a-glance overview of all monitoring services with quick access widgets |
| **Aurora** | Binary GO/NO GO decision based on real space physics data + current weather |
| **Crypto** | Top 10 cryptocurrency prices with sparkline charts and market stats |
| **Stocks** | Custom watchlist with interactive charts and market movers |
| **News** | Multi-source RSS aggregation from BBC, NPR, CNBC, Bloomberg |
| **Settings** | Theme, watchlists, location, and notification configuration |

---

## 🤖 For AI Agents

> **⚠️ IMPORTANT**: Before making any changes to this codebase, please read **[QUICKREF.md](QUICKREF.md)** first. It contains complete technical specifications, API documentation, and architecture details.

---

## 🚀 Features

### 📊 Dashboard
- **At-a-glance widgets** for all monitored services
- **Quick access** to all modules
- **Auto-refresh** every 2 minutes
- **Personalized greeting** based on time of day

### 🌌 Aurora Tracker
- **Binary Decision**: GO or NO GO based on actual space physics
- **Location-Aware**: Calculates if aurora can reach YOUR latitude
- **Real-time Data**: DSCOVR/ACE satellite solar wind data
- **NOAA OVATION Model**: Official aurora forecast (30-90 min prediction)
- **Local Sky Check**: Cloud coverage at your GPS location
- **Current Weather**: Today's conditions right on the aurora page
- **Smart Viewing Tips**: Weather-based recommendations for aurora viewing
- **7 Space Weather Metrics**: Bz, Speed, Pressure, Density, Bt, Clock Angle, Duration

### 💰 Cryptocurrency
- **Top 10 coins** with real-time prices
- **24h price changes** with sparkline charts
- **Global market stats**: Total market cap, volume, BTC dominance
- **Market sentiment** indicator (Fear & Greed approximation)

### 📈 Stock Market
- **Custom watchlist**: Default tracks AI & Big Tech leaders
  - MSFT, NVDA, TSLA, META, GOOGL, AAPL, AMD, PLTR, SMCI, ARM
- **US Market Top Movers**: Top 10 gainers & losers from NYSE, NASDAQ, AMEX
- **Company Profiles**: Brief descriptions for 90+ popular stocks
- **Major indices**: S&P 500, NASDAQ Composite, DOW Jones
- **Interactive charts**: Click any stock for price trend modal
- **Email alerts**: Automatic notification for >20% moves

### 📰 Breaking News
- **Multi-source aggregation**: BBC, NPR, TechCrunch, CNBC, Bloomberg, etc.
- **Category filtering**: Technology, Business, Science, etc.
- **Time-based sorting** with relative timestamps
- **Breaking news highlights**

### ⚙️ Settings
- **Theme**: Dark/Light mode
- **Custom watchlists** for stocks and crypto
- **Location settings** for weather
- **Refresh intervals** configuration
- **Keyboard shortcuts** for power users
- **Browser notifications** (optional)

---

## 🛠️ Technical Stack

### Free Data Sources (No API Keys Required!)
| Source | Data Provided |
|--------|---------------|
| NOAA DSCOVR/ACE | Real-time solar wind data |
| NOAA OVATION | Aurora probability forecast |
| Open-Meteo | Weather and cloud coverage |
| CoinGecko | Cryptocurrency prices |
| Yahoo Finance | Stock prices, indices, movers |
| RSS Feeds | News from major outlets |

### Tech Stack
- **Backend**: Node.js 18+ with native HTTP (no Express)
- **Frontend**: Vanilla JavaScript ES Modules
- **Styling**: CSS3 with CSS Variables (dark/light themes)
- **Charts**: Custom SVG-based (no dependencies)
- **PWA**: Service Worker for offline support
- **Testing**: Node.js built-in test runner (59 tests)

---

## 🚀 Quick Start

```bash
# Clone the repo
git clone <repo-url>
cd nocturne

# Install dependencies (just dotenv!)
npm install

# Start the server
npm start

# Run tests
npm test
```

Visit **http://localhost:8000**

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` | Dashboard |
| `2` | Aurora |
| `3` | Weather |
| `4` | Crypto |
| `5` | Stocks |
| `6` | News |
| `S` | Settings |
| `R` | Refresh current view |

---

## 📱 Mobile Support

- **Touch-optimized** tabs with 48px+ tap targets
- **Responsive design** - single column on mobile
- **PWA installable** - add to home screen
- **Offline support** via Service Worker

### Install as PWA

1. Open in Chrome/Edge on mobile
2. Tap the menu → "Add to Home Screen"
3. Enjoy native-like experience!

---

## 🔧 Configuration (Optional)

Create a `.env` file for optional features:

```env
# Server
PORT=8000

# Email Alerts (Optional - requires Gmail App Password)
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
EMAIL_RECIPIENTS=you@email.com,friend@email.com
EMAIL_COOLDOWN=60

# Alert Location (for aurora & stock notifications)
ALERT_LATITUDE=47.6
ALERT_LONGITUDE=-122.3
ALERT_LOCATION_NAME=Seattle, WA

# Module Toggles
AURORA_ENABLED=true
STOCKS_ENABLED=true
NEWS_ENABLED=true

# Stock Watchlist (comma-separated)
STOCKS_WATCHLIST=MSFT,NVDA,TSLA,META,GOOGL,AAPL,AMD,PLTR,SMCI,ARM
```

---

## 📊 Project Structure

```
nocturne/
├── server.js              # Main server (~2100 lines)
├── package.json
├── QUICKREF.md            # Technical reference (READ FIRST!)
├── ReadMe.md              # This file
│
├── src/
│   ├── index.html         # Main SPA entry
│   ├── css/
│   │   ├── styles.css     # Base styles
│   │   ├── nocturne.css   # Module styles (~2900 lines)
│   │   └── charts.css     # Chart styles
│   ├── js/
│   │   ├── nocturne.js        # Main controller
│   │   ├── aurora.js          # Aurora decision logic
│   │   └── charts.js          # SVG chart library
│   └── modules/           # Feature modules
│       ├── dashboard/
│       ├── aurora/
│       ├── weather/
│       ├── crypto/
│       ├── stocks/        # Includes 90+ company profiles
│       ├── news/
│       └── settings/
│
├── public/
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
│
└── tests/
    └── server.test.js     # 59 comprehensive tests
```

---

## 🚀 Deploy to Azure

The deploy script uses **Basic (B1) tier** for 24x7 Always On support:

```bash
# Quick deploy script included!
./quick-deploy.sh
```

Or manually:
```bash
# Create resource group
az group create --name nocturne-rg --location centralus

# Create Basic tier plan (supports Always On)
az appservice plan create --name nocturne-plan --resource-group nocturne-rg --sku B1 --is-linux

# Create and deploy
az webapp up --name nocturne --resource-group nocturne-rg --plan nocturne-plan --runtime "NODE|22-lts"

# Enable Always On
az webapp config set --name nocturne --resource-group nocturne-rg --always-on true
```

> **Note**: Basic tier (~$13/month) is required for 24x7 uptime. Free tier apps sleep after 20 minutes of inactivity.

---

## 🧪 Testing

```bash
# Run all 59 tests
npm test

# Test coverage by category:
# - Static Files: 10 tests
# - Aurora APIs: 12 tests
# - Weather APIs: 11 tests
# - Stocks APIs: 15 tests
# - Crypto/News: 4 tests
# - Status: 3 tests
# - Security: 7 tests
```

---

## 📋 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/solar-wind` | Real-time solar wind data |
| `GET /api/clouds` | Cloud coverage & forecast |
| `GET /api/ovation` | Aurora probability model |
| `GET /api/aurora/status` | GO/NO GO decision |
| `GET /api/stocks/prices` | Watchlist prices |
| `GET /api/stocks/nasdaq-movers` | Top 10 US market movers |
| `GET /api/stocks/chart` | Stock price charts |
| `GET /api/crypto/prices` | Crypto prices |
| `GET /api/weather/forecast` | Weather forecast |
| `GET /api/news/headlines` | News headlines |
| `GET /api/status` | Server health |

---

## 📄 License

MIT License - Do what you want with it!

---

## 🙏 Credits

Data provided by:
- [NOAA Space Weather Prediction Center](https://www.swpc.noaa.gov/)
- [Open-Meteo](https://open-meteo.com/)
- [CoinGecko](https://www.coingecko.com/)
- [Yahoo Finance](https://finance.yahoo.com/)
- Various RSS feeds (BBC, NPR, TechCrunch, CNBC, Bloomberg, Ars Technica, Hacker News, NASA)

---

**Built with ❤️ as a 24x7 monitoring companion**
