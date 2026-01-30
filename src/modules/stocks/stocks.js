/**
 * Overwatch - Stocks Module v3.0.0
 * 
 * Advanced stock market monitoring with heatmap, gainers/losers, and volume analysis.
 * 
 * Part of the Overwatch 24x7 Monitoring Service
 */

// =============================================================================
// Module Metadata
// =============================================================================
export const MODULE_INFO = {
  id: 'stocks',
  name: 'Stock Market',
  icon: '📈',
  description: 'Monitor stock prices and market movements',
  version: '3.0.0'
};

// =============================================================================
// Company Database - Popular companies with brief descriptions
// =============================================================================
const COMPANY_INFO = {
  // Big Tech
  AAPL: { sector: 'Tech', desc: 'iPhone, Mac, iPad maker - world\'s most valuable company' },
  MSFT: { sector: 'Tech', desc: 'Windows, Azure cloud, Office 365 - enterprise software leader' },
  GOOGL: { sector: 'Tech', desc: 'Google Search, YouTube, Android - digital advertising giant' },
  AMZN: { sector: 'Tech', desc: 'E-commerce king, AWS cloud - logistics & AI powerhouse' },
  META: { sector: 'Tech', desc: 'Facebook, Instagram, WhatsApp - social media & metaverse' },
  NVDA: { sector: 'Chips', desc: 'AI GPU leader - powering ChatGPT, autonomous cars' },
  TSLA: { sector: 'Auto', desc: 'Electric vehicles, solar, AI robotics - Musk\'s empire' },
  // AI & Semiconductors
  AMD: { sector: 'Chips', desc: 'CPU/GPU chipmaker - NVIDIA\'s main AI competitor' },
  INTC: { sector: 'Chips', desc: 'PC & server CPU pioneer - rebuilding AI capabilities' },
  PLTR: { sector: 'AI', desc: 'AI data analytics for government & enterprise' },
  SMCI: { sector: 'AI', desc: 'AI server infrastructure - NVIDIA\'s key partner' },
  ARM: { sector: 'Chips', desc: 'Chip architecture for mobile & AI - SoftBank backed' },
  AVGO: { sector: 'Chips', desc: 'Broadcom - networking chips, VMware, AI accelerators' },
  QCOM: { sector: 'Chips', desc: 'Qualcomm - 5G modems, mobile AI processors' },
  MU: { sector: 'Chips', desc: 'Micron - memory chips for AI servers & phones' },
  // Streaming & Software
  NFLX: { sector: 'Media', desc: 'Streaming pioneer - original content powerhouse' },
  CRM: { sector: 'Cloud', desc: 'Salesforce - CRM & enterprise cloud software' },
  ORCL: { sector: 'Cloud', desc: 'Oracle - database, enterprise software, cloud' },
  ADBE: { sector: 'Software', desc: 'Creative Cloud, Photoshop, PDF - creative tools' },
  // Finance & Payments
  V: { sector: 'Finance', desc: 'Visa - global payments network leader' },
  MA: { sector: 'Finance', desc: 'Mastercard - payment processing worldwide' },
  JPM: { sector: 'Finance', desc: 'JPMorgan Chase - largest US bank' },
  BAC: { sector: 'Finance', desc: 'Bank of America - consumer & investment banking' },
  GS: { sector: 'Finance', desc: 'Goldman Sachs - investment banking, trading' },
  // Healthcare & Pharma
  JNJ: { sector: 'Health', desc: 'Johnson & Johnson - pharma, medical devices' },
  UNH: { sector: 'Health', desc: 'UnitedHealth - largest health insurer' },
  PFE: { sector: 'Pharma', desc: 'Pfizer - vaccines, pharmaceuticals' },
  MRNA: { sector: 'Biotech', desc: 'Moderna - mRNA vaccines & therapeutics' },
  LLY: { sector: 'Pharma', desc: 'Eli Lilly - diabetes, obesity drugs (Ozempic rival)' },
  // Retail & Consumer
  WMT: { sector: 'Retail', desc: 'Walmart - world\'s largest retailer' },
  COST: { sector: 'Retail', desc: 'Costco - membership warehouse retail' },
  HD: { sector: 'Retail', desc: 'Home Depot - home improvement retail' },
  NKE: { sector: 'Consumer', desc: 'Nike - athletic apparel & footwear leader' },
  MCD: { sector: 'Food', desc: 'McDonald\'s - global fast food chain' },
  KO: { sector: 'Beverage', desc: 'Coca-Cola - world\'s most famous brand' },
  PEP: { sector: 'Beverage', desc: 'Pepsi, Frito-Lay, Gatorade - snacks & drinks' },
  // Energy
  XOM: { sector: 'Energy', desc: 'Exxon Mobil - oil & gas supermajor' },
  CVX: { sector: 'Energy', desc: 'Chevron - integrated oil & gas company' },
  // Telecom
  T: { sector: 'Telecom', desc: 'AT&T - wireless, fiber, HBO Max' },
  VZ: { sector: 'Telecom', desc: 'Verizon - wireless network, 5G leader' },
  // Industrial & Aerospace
  BA: { sector: 'Aerospace', desc: 'Boeing - commercial & defense aircraft' },
  CAT: { sector: 'Industrial', desc: 'Caterpillar - construction & mining equipment' },
  GE: { sector: 'Industrial', desc: 'GE Aerospace - jet engines, power systems' },
  // Crypto & Fintech
  COIN: { sector: 'Crypto', desc: 'Coinbase - largest US crypto exchange' },
  SQ: { sector: 'Fintech', desc: 'Block (Square) - payments, Cash App, Bitcoin' },
  PYPL: { sector: 'Fintech', desc: 'PayPal - online payments pioneer' },
  // EV & Clean Energy
  RIVN: { sector: 'EV', desc: 'Rivian - electric trucks & SUVs, Amazon partner' },
  LCID: { sector: 'EV', desc: 'Lucid - luxury electric vehicles' },
  // Gaming & Entertainment
  DIS: { sector: 'Media', desc: 'Disney - theme parks, Marvel, Star Wars, streaming' },
  RBLX: { sector: 'Gaming', desc: 'Roblox - metaverse gaming platform for kids' },
  // Chinese Tech (US-listed)
  BABA: { sector: 'Tech', desc: 'Alibaba - China\'s Amazon (e-commerce, cloud)' },
  NIO: { sector: 'EV', desc: 'NIO - Chinese electric vehicle maker' },
  // Biotech
  GILD: { sector: 'Biotech', desc: 'Gilead - HIV, hepatitis, COVID treatments' },
};

/**
 * Get company info with fallback
 */
function getCompanyInfo(symbol) {
  return COMPANY_INFO[symbol] || { sector: 'Other', desc: '' };
}

// =============================================================================
// Configuration
// =============================================================================
const config = {
  watchList: ['MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AAPL', 'AMD', 'PLTR', 'SMCI', 'ARM'],
  alertThreshold: 20, // Only alert for extreme moves (>20%)
  refreshInterval: 60000,
  currentView: 'cards', // cards, heatmap, table
  sortBy: 'change', // symbol, change, volume, price - default to change for better UX
  sortDir: 'desc', // desc to show biggest movers first
  showTopMovers: true,
  showBreadth: true
};

/**
 * Load watchList and display settings from localStorage
 */
function loadSettingsFromStorage() {
  try {
    const saved = localStorage.getItem('overwatch_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      // Load watchlist
      if (settings.stockWatchlist && settings.stockWatchlist.length > 0) {
        config.watchList = settings.stockWatchlist;
        console.log('[Stocks] Loaded watchList from settings:', config.watchList);
      }
      // Load display preferences
      if (settings.stocks) {
        if (settings.stocks.defaultView) config.currentView = settings.stocks.defaultView;
        if (settings.stocks.showTopMovers !== undefined) config.showTopMovers = settings.stocks.showTopMovers;
        if (settings.stocks.showBreadth !== undefined) config.showBreadth = settings.stocks.showBreadth;
      }
    }
  } catch (e) {
    console.error('[Stocks] Failed to load settings:', e);
  }
}

// =============================================================================
// State
// =============================================================================
let stockData = null;
let nasdaqMovers = null;
let marketStatus = null;
let refreshInterval = null;
let nasdaqInterval = null;
let container = null;

// =============================================================================
// API Calls
// =============================================================================
async function fetchStockData() {
  try {
    // Pass watchList as query param so server fetches our custom symbols
    const symbols = config.watchList.join(',');
    const response = await fetch(`/api/stocks/prices?symbols=${encodeURIComponent(symbols)}`);
    return response.json();
  } catch (error) {
    console.error('[Stocks] Fetch error:', error);
    return null;
  }
}

async function fetchMarketStatus() {
  try {
    const response = await fetch('/api/stocks/market-status');
    return response.json();
  } catch (error) {
    console.error('[Stocks] Market status error:', error);
    return null;
  }
}

async function fetchNasdaqMovers() {
  try {
    const response = await fetch('/api/stocks/nasdaq-movers');
    return response.json();
  } catch (error) {
    console.error('[Stocks] NASDAQ movers error:', error);
    return null;
  }
}

// =============================================================================
// Utility Functions
// =============================================================================
function formatVolume(vol) {
  if (!vol) return '--';
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
  return vol.toString();
}

function formatMarketCap(cap) {
  if (!cap) return '--';
  if (cap >= 1e12) return '$' + (cap / 1e12).toFixed(2) + 'T';
  if (cap >= 1e9) return '$' + (cap / 1e9).toFixed(2) + 'B';
  if (cap >= 1e6) return '$' + (cap / 1e6).toFixed(2) + 'M';
  return '$' + cap.toLocaleString();
}

function getChangeColor(change) {
  if (change > 3) return '#22c55e';
  if (change > 1) return '#4ade80';
  if (change > 0) return '#86efac';
  if (change > -1) return '#fca5a5';
  if (change > -3) return '#f87171';
  return '#ef4444';
}

function sortStocks(stocks, sortBy, sortDir) {
  const sorted = [...stocks].sort((a, b) => {
    let aVal, bVal;
    switch (sortBy) {
    case 'change':
      aVal = a.changePercent || 0;
      bVal = b.changePercent || 0;
      break;
    case 'volume':
      aVal = a.volume || 0;
      bVal = b.volume || 0;
      break;
    case 'price':
      aVal = a.price || 0;
      bVal = b.price || 0;
      break;
    case 'marketCap':
      aVal = a.marketCap || 0;
      bVal = b.marketCap || 0;
      break;
    default:
      aVal = a.symbol;
      bVal = b.symbol;
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });
  return sorted;
}

// =============================================================================
// Rendering - Header & Controls
// =============================================================================
function renderHeader() {
  const isOpen = marketStatus?.isOpen;
  
  return `
    <div class="stocks-header">
      <div class="stocks-title">
        <h2>📈 Stock Market</h2>
        <div class="market-status-badge ${isOpen ? 'open' : 'closed'}">
          <span class="pulse-dot"></span>
          ${isOpen ? 'Market Open' : 'Market Closed'}
        </div>
      </div>
      <div class="stocks-controls">
        <div class="view-toggle">
          <button class="view-btn ${config.currentView === 'cards' ? 'active' : ''}" data-view="cards" title="Card View">
            <span>▦</span>
          </button>
          <button class="view-btn ${config.currentView === 'heatmap' ? 'active' : ''}" data-view="heatmap" title="Heatmap">
            <span>◫</span>
          </button>
          <button class="view-btn ${config.currentView === 'table' ? 'active' : ''}" data-view="table" title="Table View">
            <span>☰</span>
          </button>
        </div>
        <select class="sort-select" id="sort-select">
          <option value="symbol" ${config.sortBy === 'symbol' ? 'selected' : ''}>Sort: Symbol</option>
          <option value="change" ${config.sortBy === 'change' ? 'selected' : ''}>Sort: % Change</option>
          <option value="volume" ${config.sortBy === 'volume' ? 'selected' : ''}>Sort: Volume</option>
          <option value="price" ${config.sortBy === 'price' ? 'selected' : ''}>Sort: Price</option>
        </select>
        <button class="refresh-btn" onclick="window.stocksModule.refresh()">🔄</button>
      </div>
    </div>
  `;
}

// =============================================================================
// Rendering - Market Summary
// =============================================================================
function renderMarketSummary() {
  if (!stockData?.indices) return '';
  
  const indices = stockData.indices;
  
  return `
    <div class="market-summary">
      <div class="indices-row">
        ${indices.map(idx => `
          <div class="index-pill ${(idx.changePercent || 0) >= 0 ? 'positive' : 'negative'}">
            <span class="idx-name">${idx.name || idx.symbol}</span>
            <span class="idx-value">${idx.price?.toLocaleString(undefined, {maximumFractionDigits: 0}) || '--'}</span>
            <span class="idx-change">${(idx.changePercent || 0) >= 0 ? '▲' : '▼'} ${Math.abs(idx.changePercent || 0).toFixed(2)}%</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// =============================================================================
// Rendering - US Market Top Movers (Top 10 Gainers/Losers)
// =============================================================================
function renderNasdaqMovers() {
  if (!nasdaqMovers) {
    return `
      <div class="nasdaq-movers-section">
        <div class="section-header">
          <h3>📊 US Market Top Movers</h3>
          <span class="section-subtitle">Top 10 gainers & losers from NYSE, NASDAQ, AMEX • Alerts for >20% moves</span>
        </div>
        <div class="nasdaq-loading">
          <div class="loading-spinner-small"></div>
          <span>Loading market movers...</span>
        </div>
      </div>
    `;
  }
  
  const { gainers = [], losers = [] } = nasdaqMovers;
  
  // Highlight extreme movers (>20%)
  const renderNasdaqCard = (stock, type) => {
    const isExtreme = Math.abs(stock.changePercent || 0) >= 20;
    const changeClass = (stock.changePercent || 0) >= 0 ? 'positive' : 'negative';
    const companyInfo = getCompanyInfo(stock.symbol);
    const hasInfo = companyInfo.desc !== '';
    
    return `
      <div class="nasdaq-mover-card ${type} ${isExtreme ? 'extreme' : ''}" 
           data-symbol="${stock.symbol}" 
           data-name="${stock.name || stock.symbol}"
           onclick="window.stocksModule.showTrendModal('${stock.symbol}', '${(stock.name || stock.symbol).replace(/'/g, '')}')">
        ${isExtreme ? '<div class="extreme-badge">🚨 >20%</div>' : ''}
        <div class="nasdaq-card-header">
          <span class="nasdaq-symbol">${stock.symbol}</span>
          ${hasInfo ? `<span class="company-sector">${companyInfo.sector}</span>` : ''}
          <span class="nasdaq-change ${changeClass}">
            ${(stock.changePercent || 0) >= 0 ? '▲' : '▼'} ${Math.abs(stock.changePercent || 0).toFixed(2)}%
          </span>
        </div>
        <div class="nasdaq-name" title="${stock.name}">${stock.name || ''}</div>
        ${hasInfo ? `<div class="company-desc">${companyInfo.desc}</div>` : ''}
        <div class="nasdaq-card-footer">
          <span>$${stock.price?.toFixed(2) || '--'}</span>
          <span class="nasdaq-exchange">${stock.exchange || ''}</span>
          <span class="nasdaq-volume">Vol: ${formatVolume(stock.volume)}</span>
        </div>
      </div>
    `;
  };
  
  return `
    <div class="nasdaq-movers-section">
      <div class="section-header">
        <h3>📊 US Market Top Movers</h3>
        <span class="section-subtitle">
          Top 10 from NYSE, NASDAQ, AMEX • 
          <span class="alert-indicator">🚨 Email alerts for >20% moves</span> •
          Updates every 10 min
        </span>
      </div>
      
      <div class="nasdaq-movers-grid">
        <div class="nasdaq-column gainers">
          <h4>🚀 Top Gainers (${gainers.length})</h4>
          <div class="nasdaq-cards-scroll">
            ${gainers.length > 0 
    ? gainers.map(s => renderNasdaqCard(s, 'gainer')).join('') 
    : '<p class="no-movers">No data available</p>'
}
          </div>
        </div>
        
        <div class="nasdaq-column losers">
          <h4>📉 Top Losers (${losers.length})</h4>
          <div class="nasdaq-cards-scroll">
            ${losers.length > 0 
    ? losers.map(s => renderNasdaqCard(s, 'loser')).join('') 
    : '<p class="no-movers">No data available</p>'
}
          </div>
        </div>
      </div>
      
      <div class="nasdaq-footer">
        <span>Last updated: ${nasdaqMovers.lastUpdate ? new Date(nasdaqMovers.lastUpdate).toLocaleTimeString() : '--'}</span>
        <span>Data from Yahoo Finance (All US Exchanges)</span>
      </div>
    </div>
  `;
}

// =============================================================================
// Rendering - Heatmap View
// =============================================================================
function renderHeatmap() {
  if (!stockData?.stocks || stockData.stocks.length === 0) {
    return '<div class="no-data">No stock data available</div>';
  }
  
  const stocks = stockData.stocks;
  const maxVolume = Math.max(...stocks.map(s => s.volume || 0));
  
  // Calculate tile sizes based on volume (min 80px, max 200px)
  const getTileSize = (volume) => {
    if (!volume || !maxVolume) return 100;
    const ratio = volume / maxVolume;
    return Math.floor(80 + ratio * 120);
  };
  
  const tiles = stocks.map(stock => {
    const size = getTileSize(stock.volume);
    const bgColor = getChangeColor(stock.changePercent || 0);
    const textColor = Math.abs(stock.changePercent || 0) > 1 ? '#fff' : '#000';
    
    return `
      <div class="heatmap-tile" 
           style="width: ${size}px; height: ${size}px; background: ${bgColor}; color: ${textColor}; cursor: pointer;"
           title="${stock.name || stock.symbol}\nPrice: $${stock.price?.toFixed(2)}\nChange: ${stock.changePercent?.toFixed(2)}%\nVolume: ${formatVolume(stock.volume)}\n\nClick for chart"
           onclick="window.stocksModule.showTrendModal('${stock.symbol}', '${(stock.name || stock.symbol).replace(/'/g, '')}')">
        <div class="tile-symbol">${stock.symbol}</div>
        <div class="tile-change">${(stock.changePercent || 0) >= 0 ? '+' : ''}${(stock.changePercent || 0).toFixed(2)}%</div>
        <div class="tile-price">$${stock.price?.toFixed(0) || '--'}</div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="heatmap-container">
      <div class="heatmap-legend">
        <span class="legend-label">Volume:</span>
        <span class="legend-small">Low</span>
        <div class="legend-scale">
          <div class="scale-box small"></div>
          <div class="scale-box medium"></div>
          <div class="scale-box large"></div>
        </div>
        <span class="legend-large">High</span>
        <span class="legend-divider">|</span>
        <span class="legend-label">Color:</span>
        <span class="legend-down">▼ Loss</span>
        <div class="color-scale"></div>
        <span class="legend-up">Gain ▲</span>
      </div>
      <div class="heatmap-grid">
        ${tiles}
      </div>
    </div>
  `;
}

// =============================================================================
// Rendering - Card View
// =============================================================================
function renderCardView() {
  if (!stockData?.stocks || stockData.stocks.length === 0) {
    return '<div class="no-data">No stock data available</div>';
  }
  
  const sorted = sortStocks(stockData.stocks, config.sortBy, config.sortDir);
  
  const cards = sorted.map(stock => {
    const changeClass = (stock.changePercent || 0) >= 0 ? 'positive' : 'negative';
    const changeIcon = (stock.changePercent || 0) >= 0 ? '▲' : '▼';
    
    // Day range percentage (where current price sits between low and high)
    const dayRange = stock.high && stock.low ? 
      ((stock.price - stock.low) / (stock.high - stock.low) * 100).toFixed(0) : 50;
    
    return `
      <div class="stock-card-v2 ${changeClass}" 
           data-symbol="${stock.symbol}"
           onclick="window.stocksModule.showTrendModal('${stock.symbol}', '${(stock.name || stock.symbol).replace(/'/g, '')}')">
        <div class="card-header">
          <div class="card-symbol">${stock.symbol}</div>
          <div class="card-name">${stock.name || ''}</div>
        </div>
        
        <div class="card-price-row">
          <span class="card-price">$${stock.price?.toFixed(2) || '--'}</span>
          <span class="card-change ${changeClass}">
            ${changeIcon} ${Math.abs(stock.changePercent || 0).toFixed(2)}%
          </span>
        </div>
        
        <div class="card-sparkline" id="spark-${stock.symbol}"></div>
        
        <div class="card-range">
          <div class="range-labels">
            <span>L: $${stock.low?.toFixed(2) || '--'}</span>
            <span>H: $${stock.high?.toFixed(2) || '--'}</span>
          </div>
          <div class="range-bar">
            <div class="range-fill" style="width: ${dayRange}%"></div>
            <div class="range-marker" style="left: ${dayRange}%"></div>
          </div>
        </div>
        
        <div class="card-stats">
          <div class="stat">
            <span class="stat-label">Volume</span>
            <span class="stat-value">${formatVolume(stock.volume)}</span>
          </div>
          ${stock.marketCap ? `<div class="stat">
            <span class="stat-label">Mkt Cap</span>
            <span class="stat-value">${formatMarketCap(stock.marketCap)}</span>
          </div>` : `<div class="stat">
            <span class="stat-label">Prev Close</span>
            <span class="stat-value">$${stock.previousClose?.toFixed(2) || '--'}</span>
          </div>`}
          <div class="stat">
            <span class="stat-label">Open</span>
            <span class="stat-value">$${stock.open?.toFixed(2) || '--'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  return `<div class="stocks-card-grid">${cards}</div>`;
}

// =============================================================================
// Rendering - Table View
// =============================================================================
function renderTableView() {
  if (!stockData?.stocks || stockData.stocks.length === 0) {
    return '<div class="no-data">No stock data available</div>';
  }
  
  const sorted = sortStocks(stockData.stocks, config.sortBy, config.sortDir);
  
  const rows = sorted.map(stock => {
    const changeClass = (stock.changePercent || 0) >= 0 ? 'positive' : 'negative';
    return `
      <tr class="${changeClass}" style="cursor: pointer;" onclick="window.stocksModule.showTrendModal('${stock.symbol}', '${(stock.name || stock.symbol).replace(/'/g, '')}')">
        <td class="col-symbol">
          <strong>${stock.symbol}</strong>
          <span class="stock-name-small">${stock.name || ''}</span>
        </td>
        <td class="col-price">$${stock.price?.toFixed(2) || '--'}</td>
        <td class="col-change ${changeClass}">
          ${(stock.changePercent || 0) >= 0 ? '▲' : '▼'} ${Math.abs(stock.changePercent || 0).toFixed(2)}%
        </td>
        <td class="col-volume">${formatVolume(stock.volume)}</td>
        <td class="col-high">$${stock.high?.toFixed(2) || '--'}</td>
        <td class="col-low">$${stock.low?.toFixed(2) || '--'}</td>
        <td class="col-cap">${stock.marketCap ? formatMarketCap(stock.marketCap) : '--'}</td>
      </tr>
    `;
  }).join('');
  
  return `
    <div class="stocks-table-container">
      <table class="stocks-table">
        <thead>
          <tr>
            <th class="col-symbol">Symbol</th>
            <th class="col-price">Price</th>
            <th class="col-change">Change</th>
            <th class="col-volume">Volume</th>
            <th class="col-high">High</th>
            <th class="col-low">Low</th>
            <th class="col-cap">Mkt Cap</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

// =============================================================================
// Rendering - Fear & Greed Index (Calculated from market data)
// =============================================================================
function calculateFearGreedIndex() {
  // Calculate Fear & Greed based on multiple market factors
  let score = 50; // Start neutral
  let factors = {};
  
  // Factor 1: Market Momentum (from indices)
  if (stockData?.indices) {
    const avgChange = stockData.indices.reduce((sum, idx) => sum + (idx.changePercent || 0), 0) / stockData.indices.length;
    const momentumScore = Math.min(100, Math.max(0, 50 + avgChange * 10));
    factors.momentum = { value: avgChange, score: momentumScore };
    score += (momentumScore - 50) * 0.3;
  }
  
  // Factor 2: Breadth (advancing vs declining in watchlist)
  if (stockData?.stocks) {
    const advancing = stockData.stocks.filter(s => (s.changePercent || 0) > 0).length;
    const total = stockData.stocks.length;
    const breadthPct = total > 0 ? (advancing / total * 100) : 50;
    factors.breadth = { value: breadthPct, score: breadthPct };
    score += (breadthPct - 50) * 0.25;
  }
  
  // Factor 3: Top Movers sentiment (gainers vs losers strength)
  if (nasdaqMovers) {
    const { gainers = [], losers = [] } = nasdaqMovers;
    const avgGain = gainers.length > 0 ? gainers.reduce((sum, s) => sum + Math.abs(s.changePercent || 0), 0) / gainers.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((sum, s) => sum + Math.abs(s.changePercent || 0), 0) / losers.length : 0;
    const moversScore = avgGain > avgLoss ? Math.min(100, 50 + (avgGain - avgLoss) * 3) : Math.max(0, 50 - (avgLoss - avgGain) * 3);
    factors.movers = { gainAvg: avgGain, lossAvg: avgLoss, score: moversScore };
    score += (moversScore - 50) * 0.25;
  }
  
  // Factor 4: Volatility proxy (spread of changes)
  if (stockData?.stocks && stockData.stocks.length > 0) {
    const changes = stockData.stocks.map(s => s.changePercent || 0);
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const volatility = Math.sqrt(changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length);
    // High volatility = more fear, low volatility = more greed
    const volScore = Math.min(100, Math.max(0, 70 - volatility * 10));
    factors.volatility = { value: volatility, score: volScore };
    score += (volScore - 50) * 0.2;
  }
  
  // Normalize to 0-100
  score = Math.min(100, Math.max(0, score));
  
  return { score: Math.round(score), factors };
}

function getFearGreedLabel(score) {
  if (score <= 20) return { label: 'Extreme Fear', class: 'extreme-fear', emoji: '😱' };
  if (score <= 40) return { label: 'Fear', class: 'fear', emoji: '😰' };
  if (score <= 60) return { label: 'Neutral', class: 'neutral', emoji: '😐' };
  if (score <= 80) return { label: 'Greed', class: 'greed', emoji: '😊' };
  return { label: 'Extreme Greed', class: 'extreme-greed', emoji: '🤑' };
}

function renderFearGreedIndex() {
  const { score, factors } = calculateFearGreedIndex();
  const sentiment = getFearGreedLabel(score);
  
  return `
    <div class="fear-greed-section">
      <div class="fear-greed-header">
        <h4>📈 Market Sentiment</h4>
        <span class="fear-greed-value ${sentiment.class}">${score}</span>
      </div>
      
      <div class="fear-greed-gauge">
        <div class="fear-greed-needle" style="left: ${score}%"></div>
      </div>
      
      <div class="fear-greed-labels">
        <span>Extreme Fear</span>
        <span>Fear</span>
        <span>Neutral</span>
        <span>Greed</span>
        <span>Extreme Greed</span>
      </div>
      
      <div class="fear-greed-sentiment">
        ${sentiment.emoji} <strong>${sentiment.label}</strong>
      </div>
      
      <div class="fear-greed-factors">
        <div class="fg-factor">
          <span class="fg-factor-label">Momentum</span>
          <span class="fg-factor-value ${factors.momentum?.value >= 0 ? 'positive' : 'negative'}">
            ${factors.momentum?.value >= 0 ? '▲' : '▼'} ${Math.abs(factors.momentum?.value || 0).toFixed(2)}%
          </span>
        </div>
        <div class="fg-factor">
          <span class="fg-factor-label">Breadth</span>
          <span class="fg-factor-value ${(factors.breadth?.value || 50) >= 50 ? 'positive' : 'negative'}">
            ${(factors.breadth?.value || 50).toFixed(0)}% ▲
          </span>
        </div>
        <div class="fg-factor">
          <span class="fg-factor-label">Volatility</span>
          <span class="fg-factor-value ${(factors.volatility?.value || 0) < 2 ? 'positive' : 'negative'}">
            ${(factors.volatility?.value || 0).toFixed(1)}σ
          </span>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// Rendering - Market Breadth
// =============================================================================
function renderMarketBreadth() {
  if (!stockData?.stocks) return '';
  
  const stocks = stockData.stocks;
  const advancing = stocks.filter(s => (s.changePercent || 0) > 0).length;
  const declining = stocks.filter(s => (s.changePercent || 0) < 0).length;
  const unchanged = stocks.filter(s => (s.changePercent || 0) === 0).length;
  const total = stocks.length;
  
  const advPct = total > 0 ? (advancing / total * 100).toFixed(0) : 0;
  const decPct = total > 0 ? (declining / total * 100).toFixed(0) : 0;
  
  return `
    <div class="market-breadth">
      <h4>📊 Market Breadth</h4>
      <div class="breadth-bar">
        <div class="breadth-advancing" style="width: ${advPct}%"></div>
        <div class="breadth-declining" style="width: ${decPct}%"></div>
      </div>
      <div class="breadth-labels">
        <span class="advancing">▲ ${advancing} Advancing</span>
        ${unchanged > 0 ? `<span class="unchanged">— ${unchanged} Unchanged</span>` : ''}
        <span class="declining">▼ ${declining} Declining</span>
      </div>
    </div>
  `;
}

// =============================================================================
// Main Render
// =============================================================================
function updateUI() {
  if (!container) return;
  
  const stocksContainer = document.getElementById('stocks-container');
  if (!stocksContainer) return;
  
  if (!stockData || !stockData.stocks) {
    stocksContainer.innerHTML = `
      <div class="stocks-loading">
        <div class="loading-spinner"></div>
        <p>Loading market data...</p>
      </div>
    `;
    return;
  }
  
  // Render based on current view
  let viewContent = '';
  switch (config.currentView) {
  case 'heatmap':
    viewContent = renderHeatmap();
    break;
  case 'table':
    viewContent = renderTableView();
    break;
  default:
    viewContent = renderCardView();
  }
  
  stocksContainer.innerHTML = `
    ${renderHeader()}
    ${renderMarketSummary()}
    ${renderFearGreedIndex()}
    
    ${config.showTopMovers ? renderNasdaqMovers() : ''}
    
    <div class="stocks-main-view">
      <h3>📋 Watchlist (${stockData.stocks.length} stocks) <span class="view-hint">Click any stock for chart</span></h3>
      ${viewContent}
    </div>
    
    ${config.showBreadth ? renderMarketBreadth() : ''}
    
    <div class="stocks-footer">
      <span>Last updated: ${new Date().toLocaleTimeString()}</span>
      <span>💡 Tip: Use Settings to customize layout</span>
      <span>Data from Yahoo Finance (15 min delay)</span>
    </div>
  `;
  
  // Setup event listeners
  setupEventListeners();
  
  // Render sparklines
  renderSparklines();
}

function setupEventListeners() {
  // View toggle buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      config.currentView = e.currentTarget.dataset.view;
      updateUI();
    });
  });
  
  // Sort select
  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      config.sortBy = e.target.value;
      updateUI();
    });
  }
}

function renderSparklines() {
  if (!window.OverwatchCharts || !stockData?.stocks) return;
  
  stockData.stocks.forEach(stock => {
    if (stock.sparkline && stock.sparkline.length > 0) {
      const sparkContainer = document.getElementById(`spark-${stock.symbol}`);
      if (sparkContainer) {
        window.OverwatchCharts.sparkline(sparkContainer, stock.sparkline, {
          width: 120,
          height: 30
        });
      }
    }
  });
}

// =============================================================================
// Main Loop
// =============================================================================
async function refresh() {
  try {
    console.log('[Stocks] Refreshing data...');
    const [stocks, status, movers] = await Promise.all([
      fetchStockData(),
      fetchMarketStatus(),
      fetchNasdaqMovers()
    ]);
    
    stockData = stocks;
    marketStatus = status;
    nasdaqMovers = movers;
    
    updateUI();
  } catch (error) {
    console.error('[Stocks] Refresh error:', error);
  }
}

async function refreshNasdaqOnly() {
  try {
    console.log('[Stocks] Refreshing NASDAQ movers...');
    nasdaqMovers = await fetchNasdaqMovers();
    updateUI();
  } catch (error) {
    console.error('[Stocks] NASDAQ refresh error:', error);
  }
}

// =============================================================================
// Trend Modal
// =============================================================================
let currentTrendRange = '1d';

async function showTrendModal(symbol, name) {
  void symbol; // Used for future reference
  currentTrendRange = '1d';
  
  // Create modal if not exists
  let modal = document.getElementById('trend-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'trend-modal';
    modal.className = 'trend-modal';
    document.body.appendChild(modal);
  }
  
  modal.innerHTML = `
    <div class="trend-modal-backdrop" onclick="window.stocksModule.closeTrendModal()"></div>
    <div class="trend-modal-content">
      <div class="trend-modal-header">
        <div class="trend-title">
          <h3>${symbol}</h3>
          <span class="trend-name">${name}</span>
        </div>
        <button class="trend-close-btn" onclick="window.stocksModule.closeTrendModal()">✕</button>
      </div>
      <div class="trend-range-selector">
        <button class="range-btn active" data-range="1d">1D</button>
        <button class="range-btn" data-range="5d">5D</button>
        <button class="range-btn" data-range="1m">1M</button>
        <button class="range-btn" data-range="3m">3M</button>
        <button class="range-btn" data-range="6m">6M</button>
        <button class="range-btn" data-range="1y">1Y</button>
        <button class="range-btn" data-range="ytd">YTD</button>
      </div>
      <div class="trend-chart-container">
        <div class="trend-loading">
          <div class="loading-spinner"></div>
          <p>Loading chart...</p>
        </div>
      </div>
      <div class="trend-stats"></div>
    </div>
  `;
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Set up range button listeners
  modal.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      modal.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentTrendRange = e.target.dataset.range;
      loadTrendChart(symbol);
    });
  });
  
  // Load initial chart
  await loadTrendChart(symbol);
}

function closeTrendModal() {
  const modal = document.getElementById('trend-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

async function loadTrendChart(symbol) {
  const modal = document.getElementById('trend-modal');
  if (!modal) return;
  
  const chartContainer = modal.querySelector('.trend-chart-container');
  const statsContainer = modal.querySelector('.trend-stats');
  
  chartContainer.innerHTML = `
    <div class="trend-loading">
      <div class="loading-spinner"></div>
      <p>Loading chart...</p>
    </div>
  `;
  
  try {
    const response = await fetch(`/api/stocks/chart?symbol=${symbol}&range=${currentTrendRange}`);
    const data = await response.json();
    
    if (data.error) {
      chartContainer.innerHTML = `<div class="trend-error">Failed to load chart: ${data.error}</div>`;
      return;
    }
    
    // Render chart
    renderTrendChart(chartContainer, data);
    
    // Update stats
    const changeClass = data.changePercent >= 0 ? 'positive' : 'negative';
    const changeIcon = data.changePercent >= 0 ? '▲' : '▼';
    
    statsContainer.innerHTML = `
      <div class="trend-stat-row">
        <div class="trend-stat">
          <span class="stat-label">Current Price</span>
          <span class="stat-value">$${data.currentPrice?.toFixed(2) || '--'}</span>
        </div>
        <div class="trend-stat">
          <span class="stat-label">Change</span>
          <span class="stat-value ${changeClass}">
            ${changeIcon} $${Math.abs(data.change || 0).toFixed(2)} (${Math.abs(data.changePercent || 0).toFixed(2)}%)
          </span>
        </div>
        <div class="trend-stat">
          <span class="stat-label">Prev Close</span>
          <span class="stat-value">$${data.previousClose?.toFixed(2) || '--'}</span>
        </div>
        <div class="trend-stat">
          <span class="stat-label">Data Points</span>
          <span class="stat-value">${data.dataPoints?.length || 0}</span>
        </div>
      </div>
    `;
  } catch (error) {
    chartContainer.innerHTML = `<div class="trend-error">Failed to load chart: ${error.message}</div>`;
  }
}

function renderTrendChart(container, data) {
  if (!data.dataPoints || data.dataPoints.length === 0) {
    container.innerHTML = '<div class="trend-error">No data available</div>';
    return;
  }
  
  const points = data.dataPoints;
  const prices = points.map(p => p.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;
  
  const width = 600;
  const height = 300;
  const padding = 40;
  
  // Build SVG path
  const pathPoints = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p.close - minPrice) / priceRange) * (height - 2 * padding);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  
  // Area path (for gradient fill)
  const areaPath = pathPoints + ` L ${width - padding} ${height - padding} L ${padding} ${height - padding} Z`;
  
  const isPositive = data.changePercent >= 0;
  const lineColor = isPositive ? '#22c55e' : '#ef4444';
  const fillColor = isPositive ? 'url(#greenGradient)' : 'url(#redGradient)';
  
  // Format time labels
  const firstTime = new Date(points[0].time);
  const lastTime = new Date(points[points.length - 1].time);
  const formatTime = (date) => {
    if (currentTrendRange === '1d') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  container.innerHTML = `
    <svg class="trend-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#22c55e;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#22c55e;stop-opacity:0" />
        </linearGradient>
        <linearGradient id="redGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#ef4444;stop-opacity:0.3" />
          <stop offset="100%" style="stop-color:#ef4444;stop-opacity:0" />
        </linearGradient>
      </defs>
      
      <!-- Grid lines -->
      <g class="grid-lines" stroke="rgba(255,255,255,0.1)" stroke-width="1">
        ${[0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = padding + pct * (height - 2 * padding);
    return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" />`;
  }).join('')}
      </g>
      
      <!-- Area fill -->
      <path d="${areaPath}" fill="${fillColor}" />
      
      <!-- Line -->
      <path d="${pathPoints}" fill="none" stroke="${lineColor}" stroke-width="2" />
      
      <!-- Y-axis labels -->
      <g class="y-labels" fill="rgba(255,255,255,0.6)" font-size="10">
        <text x="${padding - 5}" y="${padding}" text-anchor="end">$${maxPrice.toFixed(2)}</text>
        <text x="${padding - 5}" y="${height / 2}" text-anchor="end">$${((maxPrice + minPrice) / 2).toFixed(2)}</text>
        <text x="${padding - 5}" y="${height - padding}" text-anchor="end">$${minPrice.toFixed(2)}</text>
      </g>
      
      <!-- X-axis labels -->
      <g class="x-labels" fill="rgba(255,255,255,0.6)" font-size="10">
        <text x="${padding}" y="${height - 10}" text-anchor="start">${formatTime(firstTime)}</text>
        <text x="${width - padding}" y="${height - 10}" text-anchor="end">${formatTime(lastTime)}</text>
      </g>
      
      <!-- Current price line -->
      <line x1="${padding}" y1="${height - padding - ((prices[prices.length - 1] - minPrice) / priceRange) * (height - 2 * padding)}"
            x2="${width - padding}" y2="${height - padding - ((prices[prices.length - 1] - minPrice) / priceRange) * (height - 2 * padding)}"
            stroke="${lineColor}" stroke-width="1" stroke-dasharray="4,4" opacity="0.5" />
    </svg>
  `;
}

// =============================================================================
// Module Lifecycle
// =============================================================================
export function init(containerEl) {
  console.log('[Stocks] Initializing module v3.0...');
  container = containerEl;
  
  // Load watchList and display settings from storage
  loadSettingsFromStorage();
  
  // Create container structure
  container.innerHTML = `
    <div class="module-content stocks-module-v2">
      <div id="stocks-container" class="stocks-container">
        <div class="stocks-loading">
          <div class="loading-spinner"></div>
          <p>Loading market data...</p>
        </div>
      </div>
    </div>
  `;
  
  // Expose functions globally
  window.stocksModule = { refresh, refreshNasdaqOnly, showTrendModal, closeTrendModal, updateWatchList };
  
  // Listen for settings changes
  window.addEventListener('settingsChanged', handleSettingsChanged);
  
  // Initial fetch
  refresh();
  
  // Set up auto-refresh for watchList (every 1 min)
  refreshInterval = setInterval(refresh, config.refreshInterval);
  
  // Set up NASDAQ movers refresh (every 5 min on frontend, backend checks every 10 min)
  nasdaqInterval = setInterval(refreshNasdaqOnly, 5 * 60 * 1000);
}

/**
 * Handle settings changes from settings module
 */
function handleSettingsChanged(event) {
  const settings = event.detail;
  let needsRefresh = false;
  let needsUIUpdate = false;
  
  // Check watchlist changes
  if (settings.stockWatchlist && settings.stockWatchlist.length > 0) {
    const newWatchList = settings.stockWatchlist;
    if (JSON.stringify(newWatchList) !== JSON.stringify(config.watchList)) {
      console.log('[Stocks] WatchList changed, refreshing...');
      config.watchList = newWatchList;
      needsRefresh = true;
    }
  }
  
  // Check display settings changes
  if (settings.stocks) {
    if (settings.stocks.defaultView && settings.stocks.defaultView !== config.currentView) {
      config.currentView = settings.stocks.defaultView;
      needsUIUpdate = true;
    }
    if (settings.stocks.showTopMovers !== undefined && settings.stocks.showTopMovers !== config.showTopMovers) {
      config.showTopMovers = settings.stocks.showTopMovers;
      needsUIUpdate = true;
    }
    if (settings.stocks.showBreadth !== undefined && settings.stocks.showBreadth !== config.showBreadth) {
      config.showBreadth = settings.stocks.showBreadth;
      needsUIUpdate = true;
    }
  }
  
  // Apply changes
  if (needsRefresh) {
    refresh();
  } else if (needsUIUpdate) {
    updateUI();
  }
}

/**
 * Update watchList programmatically
 */
function updateWatchList(symbols) {
  if (Array.isArray(symbols) && symbols.length > 0) {
    config.watchList = symbols.map(s => s.toUpperCase());
    refresh();
  }
}

export function destroy() {
  console.log('[Stocks] Destroying module...');
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  if (nasdaqInterval) {
    clearInterval(nasdaqInterval);
    nasdaqInterval = null;
  }
  // Remove settings listener
  window.removeEventListener('settingsChanged', handleSettingsChanged);
  // Close modal if open
  closeTrendModal();
  window.stocksModule = null;
}

export function getStatus() {
  if (!stockData) {
    return { status: 'loading', summary: 'Loading market data...' };
  }
  
  const extremeMovers = stockData.stocks?.filter(s => Math.abs(s.changePercent) >= config.alertThreshold) || [];
  
  if (extremeMovers.length > 0) {
    return {
      status: 'alert',
      summary: `🚨 ${extremeMovers.length} stock(s) moved >20%!`,
      data: { extremeMovers }
    };
  }
  
  return {
    status: marketStatus?.isOpen ? 'normal' : 'inactive',
    summary: marketStatus?.isOpen ? 'Market open - watching...' : 'Market closed',
    data: stockData
  };
}
