/**
 * Nocturne Dashboard Module
 * At-a-glance summary of all monitoring services
 */

class DashboardModule {
  constructor() {
    this.container = null;
    this.updateInterval = null;
    this.data = {
      weather: null,
      crypto: null,
      stocks: null,
      news: null,
      aurora: null
    };
  }

  async init(container) {
    this.container = container;
    this.renderLoading();
    await this.fetchAllData();
    this.startAutoUpdate();
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  renderLoading() {
    this.container.innerHTML = `
            <div class="dashboard-module">
                <div class="dashboard-loading">
                    <div class="loading-spinner"></div>
                    <p>Loading dashboard...</p>
                </div>
            </div>
        `;
  }

  async fetchAllData() {
    try {
      // Fetch all data in parallel
      const [weather, crypto, stocks, news, aurora] = await Promise.allSettled([
        this.fetchWeather(),
        this.fetchCrypto(),
        this.fetchStocks(),
        this.fetchNews(),
        this.fetchAurora()
      ]);

      this.data.weather = weather.status === 'fulfilled' ? weather.value : null;
      this.data.crypto = crypto.status === 'fulfilled' ? crypto.value : null;
      this.data.stocks = stocks.status === 'fulfilled' ? stocks.value : null;
      this.data.news = news.status === 'fulfilled' ? news.value : null;
      this.data.aurora = aurora.status === 'fulfilled' ? aurora.value : null;

      this.render();
    } catch (err) {
      console.error('[Dashboard] Fetch error:', err);
      this.renderError('Failed to load dashboard data');
    }
  }

  async fetchWeather() {
    // Get user location or default
    let lat = 47.6, lon = -122.3;
    try {
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        lat = pos.coords.latitude;
        lon = pos.coords.longitude;
      }
    } catch (e) { /* use default */ }
        
    const res = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
    return res.json();
  }

  async fetchCrypto() {
    const res = await fetch('/api/crypto/prices');
    return res.json();
  }

  async fetchStocks() {
    const res = await fetch('/api/stocks/prices');
    return res.json();
  }

  async fetchNews() {
    const res = await fetch('/api/news/headlines');
    return res.json();
  }

  async fetchAurora() {
    const res = await fetch('/api/aurora/status');
    return res.json();
  }

  startAutoUpdate() {
    // Update every 2 minutes
    this.updateInterval = setInterval(() => this.fetchAllData(), 2 * 60 * 1000);
  }

  render() {
    const now = new Date();
    const greeting = this.getGreeting(now.getHours());
        
    this.container.innerHTML = `
            <div class="dashboard-module">
                <div class="dashboard-header">
                    <div class="greeting">
                        <h2>${greeting}</h2>
                        <p class="date">${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div class="header-actions">
                        <button class="refresh-btn" onclick="window.dashboardModule.fetchAllData()">🔄</button>
                    </div>
                </div>

                <div class="dashboard-grid">
                    ${this.renderWeatherWidget()}
                    ${this.renderAuroraWidget()}
                    ${this.renderCryptoWidget()}
                    ${this.renderStocksWidget()}
                    ${this.renderNewsWidget()}
                    ${this.renderQuickLinksWidget()}
                </div>

                <div class="dashboard-footer">
                    <span class="update-time">Last updated: ${now.toLocaleTimeString()}</span>
                </div>
            </div>
        `;
  }

  getGreeting(hour) {
    if (hour < 12) return '🌅 Good Morning';
    if (hour < 17) return '☀️ Good Afternoon';
    if (hour < 21) return '🌆 Good Evening';
    return '🌙 Good Night';
  }

  renderWeatherWidget() {
    if (!this.data.weather?.current) {
      return '<div class="widget weather-widget loading"><p>Loading weather...</p></div>';
    }

    const w = this.data.weather;
    const temp = Math.round(w.current.temperature_2m);
    const icon = this.getWeatherIcon(w.current.weather_code, w.current.is_day);
    const desc = this.getWeatherDesc(w.current.weather_code);

    return `
            <div class="widget weather-widget" onclick="switchModule('weather')">
                <div class="widget-header">
                    <span class="widget-icon">🌤️</span>
                    <span class="widget-title">Weather</span>
                </div>
                <div class="widget-content">
                    <div class="weather-main">
                        <span class="weather-icon">${icon}</span>
                        <span class="weather-temp">${temp}°F</span>
                    </div>
                    <div class="weather-details">
                        <p class="desc">${desc}</p>
                        <p class="location">📍 ${w.location?.name || 'Unknown'}</p>
                        <p class="feels">Feels like ${Math.round(w.current.apparent_temperature)}°</p>
                    </div>
                </div>
            </div>
        `;
  }

  getWeatherIcon(code, isDay) {
    const icons = {
      0: isDay ? '☀️' : '🌙', 1: isDay ? '🌤️' : '🌙', 2: '⛅', 3: '☁️',
      45: '🌫️', 48: '🌫️', 51: '🌧️', 53: '🌧️', 55: '🌧️',
      61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '🌨️', 73: '🌨️', 75: '❄️',
      80: '🌦️', 81: '🌦️', 82: '⛈️', 95: '⛈️', 96: '⛈️', 99: '⛈️'
    };
    return icons[code] || '🌡️';
  }

  getWeatherDesc(code) {
    const desc = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 51: 'Light drizzle', 61: 'Light rain', 63: 'Rain',
      65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow',
      80: 'Light showers', 95: 'Thunderstorm'
    };
    return desc[code] || 'Unknown';
  }

  renderAuroraWidget() {
    const a = this.data.aurora;
    let status = 'Unknown';
    let statusClass = 'neutral';
    let prob = '--';

    if (a?.auroraScore !== undefined) {
      if (a.auroraScore >= 70) { status = 'GO'; statusClass = 'go'; }
      else if (a.auroraScore >= 40) { status = 'MAYBE'; statusClass = 'maybe'; }
      else { status = 'NO GO'; statusClass = 'no-go'; }
      prob = `${Math.round(a.auroraScore)}%`;
    }

    return `
            <div class="widget aurora-widget ${statusClass}" onclick="switchModule('aurora')">
                <div class="widget-header">
                    <span class="widget-icon">🌌</span>
                    <span class="widget-title">Aurora</span>
                </div>
                <div class="widget-content">
                    <div class="aurora-status">
                        <span class="status-badge">${status}</span>
                    </div>
                    <div class="aurora-details">
                        <p>Score: ${prob}</p>
                        <p>Kp: ${a?.kp?.toFixed(1) || '--'}</p>
                    </div>
                </div>
            </div>
        `;
  }

  renderCryptoWidget() {
    if (!this.data.crypto?.coins) {
      return '<div class="widget crypto-widget loading"><p>Loading crypto...</p></div>';
    }

    const btc = this.data.crypto.coins.find(c => c.symbol === 'btc');
    const eth = this.data.crypto.coins.find(c => c.symbol === 'eth');

    return `
            <div class="widget crypto-widget" onclick="switchModule('crypto')">
                <div class="widget-header">
                    <span class="widget-icon">💰</span>
                    <span class="widget-title">Crypto</span>
                </div>
                <div class="widget-content">
                    <div class="crypto-row">
                        <span class="symbol">₿ BTC</span>
                        <span class="price">$${this.formatCompact(btc?.price || 0)}</span>
                        <span class="change ${btc?.priceChange24h >= 0 ? 'positive' : 'negative'}">
                            ${btc?.priceChange24h >= 0 ? '▲' : '▼'} ${Math.abs(btc?.priceChange24h || 0).toFixed(1)}%
                        </span>
                    </div>
                    <div class="crypto-row">
                        <span class="symbol">Ξ ETH</span>
                        <span class="price">$${this.formatCompact(eth?.price || 0)}</span>
                        <span class="change ${eth?.priceChange24h >= 0 ? 'positive' : 'negative'}">
                            ${eth?.priceChange24h >= 0 ? '▲' : '▼'} ${Math.abs(eth?.priceChange24h || 0).toFixed(1)}%
                        </span>
                    </div>
                </div>
            </div>
        `;
  }

  renderStocksWidget() {
    if (!this.data.stocks?.stocks && !this.data.stocks?.indices) {
      return '<div class="widget stocks-widget loading"><p>Loading stocks...</p></div>';
    }

    const indices = this.data.stocks.indices || [];
    const sp500 = indices.find(i => i.symbol === '^GSPC');
    const nasdaq = indices.find(i => i.symbol === '^IXIC');

    return `
            <div class="widget stocks-widget" onclick="switchModule('stocks')">
                <div class="widget-header">
                    <span class="widget-icon">📈</span>
                    <span class="widget-title">Markets</span>
                </div>
                <div class="widget-content">
                    <div class="stock-row">
                        <span class="name">S&P 500</span>
                        <span class="price">${sp500?.price?.toLocaleString() || '--'}</span>
                        <span class="change ${(sp500?.changePercent || 0) >= 0 ? 'positive' : 'negative'}">
                            ${(sp500?.changePercent || 0) >= 0 ? '▲' : '▼'} ${Math.abs(sp500?.changePercent || 0).toFixed(2)}%
                        </span>
                    </div>
                    <div class="stock-row">
                        <span class="name">NASDAQ</span>
                        <span class="price">${nasdaq?.price?.toLocaleString() || '--'}</span>
                        <span class="change ${(nasdaq?.changePercent || 0) >= 0 ? 'positive' : 'negative'}">
                            ${(nasdaq?.changePercent || 0) >= 0 ? '▲' : '▼'} ${Math.abs(nasdaq?.changePercent || 0).toFixed(2)}%
                        </span>
                    </div>
                    <p class="market-status">${this.data.stocks.marketStatus?.isOpen ? '🟢 Market Open' : '🔴 Market Closed'}</p>
                </div>
            </div>
        `;
  }

  renderNewsWidget() {
    if (!this.data.news?.articles?.length) {
      return '<div class="widget news-widget loading"><p>Loading news...</p></div>';
    }

    const topNews = this.data.news.articles.slice(0, 3);

    return `
            <div class="widget news-widget wide" onclick="switchModule('news')">
                <div class="widget-header">
                    <span class="widget-icon">📰</span>
                    <span class="widget-title">Top Headlines</span>
                </div>
                <div class="widget-content">
                    ${topNews.map(article => `
                        <div class="news-item">
                            <span class="source">${article.source}</span>
                            <p class="headline">${this.truncate(article.title, 80)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
  }

  renderQuickLinksWidget() {
    return `
            <div class="widget quick-links-widget">
                <div class="widget-header">
                    <span class="widget-icon">⚡</span>
                    <span class="widget-title">Quick Access</span>
                </div>
                <div class="widget-content">
                    <div class="quick-links">
                        <button onclick="switchModule('aurora')">🌌 Aurora</button>
                        <button onclick="switchModule('weather')">🌤️ Weather</button>
                        <button onclick="switchModule('crypto')">💰 Crypto</button>
                        <button onclick="switchModule('stocks')">📈 Stocks</button>
                        <button onclick="switchModule('news')">📰 News</button>
                    </div>
                </div>
            </div>
        `;
  }

  formatCompact(num) {
    if (num >= 1000) return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return num.toFixed(2);
  }

  truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  renderError(message) {
    this.container.innerHTML = `
            <div class="dashboard-module">
                <div class="dashboard-error">
                    <span class="error-icon">⚠️</span>
                    <p>${message}</p>
                    <button onclick="window.dashboardModule.fetchAllData()">Retry</button>
                </div>
            </div>
        `;
  }

  getStatus() {
    return { status: 'active', message: 'Dashboard ready', icon: '📊' };
  }
}

// Export for module loading
window.DashboardModule = DashboardModule;
window.dashboardModule = null;

export function init(container) {
  window.dashboardModule = new DashboardModule();
  return window.dashboardModule.init(container);
}

export function destroy() {
  if (window.dashboardModule) {
    window.dashboardModule.destroy();
    window.dashboardModule = null;
  }
}

export function getStatus() {
  return window.dashboardModule ? window.dashboardModule.getStatus() : { status: 'inactive' };
}
