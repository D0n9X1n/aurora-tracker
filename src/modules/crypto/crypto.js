/**
 * Nocturne Crypto Module
 * Cryptocurrency price tracking with CoinGecko API (free, no key)
 */

class CryptoModule {
  constructor() {
    this.container = null;
    this.updateInterval = null;
    this.cryptoData = null;
    this.watchlist = ['bitcoin', 'ethereum', 'solana', 'cardano', 'dogecoin', 'ripple'];
  }

  async init(container) {
    this.container = container;
    this.renderLoading();
    await this.fetchCrypto();
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
            <div class="crypto-module">
                <div class="crypto-loading">
                    <div class="loading-spinner"></div>
                    <p>Fetching cryptocurrency data...</p>
                </div>
            </div>
        `;
  }

  async fetchCrypto() {
    try {
      const response = await fetch('/api/crypto/prices');
      if (!response.ok) throw new Error('Crypto API error');
      this.cryptoData = await response.json();
      this.render();
    } catch (err) {
      console.error('[Crypto] Fetch error:', err);
      this.renderError('Unable to fetch cryptocurrency data');
    }
  }

  startAutoUpdate() {
    // Update every 60 seconds (CoinGecko rate limit friendly)
    this.updateInterval = setInterval(() => this.fetchCrypto(), 60 * 1000);
  }

  formatPrice(price) {
    if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (price >= 1) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (price >= 0.01) return price.toLocaleString('en-US', { maximumFractionDigits: 4 });
    return price.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }

  formatMarketCap(cap) {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
    if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
    return `$${cap.toLocaleString()}`;
  }

  renderSparkline(data) {
    if (!data || data.length < 2) return '';
        
    const width = 100;
    const height = 30;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
        
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
        
    const isUp = data[data.length - 1] > data[0];
    const color = isUp ? '#31c48d' : '#ef4444';
        
    return `
            <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                <polyline fill="none" stroke="${color}" stroke-width="1.5" points="${points}"/>
            </svg>
        `;
  }

  render() {
    if (!this.cryptoData || !this.cryptoData.coins) {
      this.renderError('No data available');
      return;
    }

    const { coins, global, lastUpdate } = this.cryptoData;

    this.container.innerHTML = `
            <div class="crypto-module">
                <div class="crypto-header">
                    <div class="header-info">
                        <h2>💰 Cryptocurrency Market</h2>
                        <p class="update-time">Updated: ${new Date(lastUpdate).toLocaleTimeString()}</p>
                    </div>
                    <button class="refresh-btn" onclick="window.cryptoModule.fetchCrypto()">🔄</button>
                </div>

                <!-- Global Market Stats -->
                <div class="crypto-global">
                    <div class="global-stat">
                        <span class="stat-label">Total Market Cap</span>
                        <span class="stat-value">${this.formatMarketCap(global?.totalMarketCap || 0)}</span>
                    </div>
                    <div class="global-stat">
                        <span class="stat-label">24h Volume</span>
                        <span class="stat-value">${this.formatMarketCap(global?.totalVolume || 0)}</span>
                    </div>
                    <div class="global-stat">
                        <span class="stat-label">BTC Dominance</span>
                        <span class="stat-value">${global?.btcDominance?.toFixed(1) || '--'}%</span>
                    </div>
                    <div class="global-stat">
                        <span class="stat-label">Active Coins</span>
                        <span class="stat-value">${global?.activeCryptos?.toLocaleString() || '--'}</span>
                    </div>
                </div>

                <!-- Crypto Cards -->
                <div class="crypto-grid">
                    ${coins.map((coin, index) => this.renderCoinCard(coin, index + 1)).join('')}
                </div>

                <!-- Fear & Greed Index -->
                ${this.renderFearGreed()}
            </div>
        `;
  }

  renderCoinCard(coin, rank) {
    const changeClass = coin.priceChange24h >= 0 ? 'positive' : 'negative';
    const changeIcon = coin.priceChange24h >= 0 ? '▲' : '▼';
        
    return `
            <div class="crypto-card">
                <div class="crypto-rank">#${rank}</div>
                <div class="crypto-info">
                    <div class="crypto-icon">${this.getCryptoIcon(coin.symbol)}</div>
                    <div class="crypto-name">
                        <span class="name">${coin.name}</span>
                        <span class="symbol">${coin.symbol.toUpperCase()}</span>
                    </div>
                </div>
                <div class="crypto-sparkline">
                    ${this.renderSparkline(coin.sparkline)}
                </div>
                <div class="crypto-price">
                    <span class="price">$${this.formatPrice(coin.price)}</span>
                    <span class="change ${changeClass}">
                        ${changeIcon} ${Math.abs(coin.priceChange24h).toFixed(2)}%
                    </span>
                </div>
                <div class="crypto-stats">
                    <div class="stat">
                        <span class="label">Market Cap</span>
                        <span class="value">${this.formatMarketCap(coin.marketCap)}</span>
                    </div>
                    <div class="stat">
                        <span class="label">24h Volume</span>
                        <span class="value">${this.formatMarketCap(coin.volume24h)}</span>
                    </div>
                </div>
            </div>
        `;
  }

  getCryptoIcon(symbol) {
    const icons = {
      btc: '₿',
      eth: 'Ξ',
      sol: '◎',
      ada: '₳',
      doge: 'Ð',
      xrp: '✕',
      bnb: '⬡',
      dot: '●',
      avax: '🔺',
      matic: '⬡'
    };
    return icons[symbol.toLowerCase()] || '🪙';
  }

  renderFearGreed() {
    // Simplified Fear & Greed based on market momentum
    if (!this.cryptoData?.global) return '';
        
    const btcChange = this.cryptoData.coins?.find(c => c.symbol === 'btc')?.priceChange24h || 0;
    let index = 50 + (btcChange * 5); // Simple approximation
    index = Math.max(0, Math.min(100, index));
        
    let label, color;
    if (index <= 25) { label = 'Extreme Fear'; color = '#ef4444'; }
    else if (index <= 45) { label = 'Fear'; color = '#f97316'; }
    else if (index <= 55) { label = 'Neutral'; color = '#eab308'; }
    else if (index <= 75) { label = 'Greed'; color = '#84cc16'; }
    else { label = 'Extreme Greed'; color = '#22c55e'; }

    return `
            <div class="fear-greed">
                <h3>Market Sentiment</h3>
                <div class="fg-meter">
                    <div class="fg-bar">
                        <div class="fg-fill" style="width: ${index}%; background: ${color}"></div>
                        <div class="fg-indicator" style="left: ${index}%"></div>
                    </div>
                    <div class="fg-labels">
                        <span>Fear</span>
                        <span>Neutral</span>
                        <span>Greed</span>
                    </div>
                </div>
                <div class="fg-value" style="color: ${color}">
                    <span class="value">${Math.round(index)}</span>
                    <span class="label">${label}</span>
                </div>
            </div>
        `;
  }

  renderError(message) {
    this.container.innerHTML = `
            <div class="crypto-module">
                <div class="crypto-error">
                    <span class="error-icon">⚠️</span>
                    <p>${message}</p>
                    <button onclick="window.cryptoModule.fetchCrypto()">Retry</button>
                </div>
            </div>
        `;
  }

  getStatus() {
    if (!this.cryptoData) {
      return { status: 'loading', message: 'Fetching crypto...' };
    }
    const btc = this.cryptoData.coins?.find(c => c.symbol === 'btc');
    if (btc) {
      const changeIcon = btc.priceChange24h >= 0 ? '↑' : '↓';
      return { 
        status: 'active', 
        message: `BTC $${this.formatPrice(btc.price)} ${changeIcon}`,
        icon: '₿'
      };
    }
    return { status: 'active', message: 'Crypto loaded' };
  }
}

// Export for module loading
window.CryptoModule = CryptoModule;
window.cryptoModule = null;

export function init(container) {
  window.cryptoModule = new CryptoModule();
  return window.cryptoModule.init(container);
}

export function destroy() {
  if (window.cryptoModule) {
    window.cryptoModule.destroy();
    window.cryptoModule = null;
  }
}

export function getStatus() {
  return window.cryptoModule ? window.cryptoModule.getStatus() : { status: 'inactive' };
}
