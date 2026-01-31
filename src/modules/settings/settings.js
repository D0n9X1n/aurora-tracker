/**
 * Nocturne Settings Module
 * User preferences and customization
 */

class SettingsModule {
  constructor() {
    this.container = null;
    this.settings = this.loadSettings();
  }

  getDefaultSettings() {
    return {
      theme: 'dark',
      defaultTab: 'dashboard',
      stockWatchlist: ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA', 'META', 'AMD'],
      cryptoWatchlist: ['bitcoin', 'ethereum', 'solana'],
      newsCategories: ['technology', 'business', 'science'],
      weatherLocation: { lat: null, lon: null, name: 'Auto-detect' },
      refreshInterval: 60, // seconds
      notifications: {
        enabled: false,
        auroraAlerts: true,
        stockAlerts: true,
        newsBreaking: false
      },
      display: {
        compactMode: false,
        showSparklines: true,
        use24Hour: false
      },
      stocks: {
        defaultView: 'cards', // cards, table, heatmap
        showTopMovers: true,
        showBreadth: true
      }
    };
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('nocturne_settings');
      if (saved) {
        return { ...this.getDefaultSettings(), ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('[Settings] Load error:', e);
    }
    return this.getDefaultSettings();
  }

  saveSettings() {
    try {
      localStorage.setItem('nocturne_settings', JSON.stringify(this.settings));
      this.applySettings();
      this.showToast('Settings saved!');
    } catch (e) {
      console.error('[Settings] Save error:', e);
      this.showToast('Failed to save settings', 'error');
    }
  }

  applySettings() {
    // Apply theme
    document.body.classList.toggle('light-theme', this.settings.theme === 'light');
        
    // Dispatch event for other modules
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: this.settings }));
  }

  async init(container) {
    this.container = container;
    this.render();
    this.applySettings();
  }

  destroy() {
    // Cleanup if needed
  }

  render() {
    this.container.innerHTML = `
            <div class="settings-module">
                <div class="settings-header">
                    <h2>⚙️ Settings</h2>
                    <p>Customize your Nocturne experience</p>
                </div>

                <div class="settings-sections">
                    <!-- General Section -->
                    <section class="settings-section">
                        <h3>🎨 Appearance</h3>
                        <div class="setting-item">
                            <label>Theme</label>
                            <select id="setting-theme">
                                <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label>Default Tab</label>
                            <select id="setting-default-tab">
                                <option value="dashboard" ${this.settings.defaultTab === 'dashboard' ? 'selected' : ''}>Dashboard</option>
                                <option value="aurora" ${this.settings.defaultTab === 'aurora' ? 'selected' : ''}>Aurora</option>
                                <option value="weather" ${this.settings.defaultTab === 'weather' ? 'selected' : ''}>Weather</option>
                                <option value="crypto" ${this.settings.defaultTab === 'crypto' ? 'selected' : ''}>Crypto</option>
                                <option value="stocks" ${this.settings.defaultTab === 'stocks' ? 'selected' : ''}>Stocks</option>
                                <option value="news" ${this.settings.defaultTab === 'news' ? 'selected' : ''}>News</option>
                            </select>
                        </div>
                        <div class="setting-item checkbox">
                            <label>
                                <input type="checkbox" id="setting-compact" ${this.settings.display.compactMode ? 'checked' : ''}>
                                Compact Mode
                            </label>
                        </div>
                        <div class="setting-item checkbox">
                            <label>
                                <input type="checkbox" id="setting-sparklines" ${this.settings.display.showSparklines ? 'checked' : ''}>
                                Show Sparkline Charts
                            </label>
                        </div>
                    </section>

                    <!-- Stocks Section -->
                    <section class="settings-section">
                        <h3>📈 Stocks</h3>
                        <div class="setting-item">
                            <label>Stock Watchlist</label>
                            <input type="text" id="setting-stocks" value="${this.settings.stockWatchlist.join(', ')}" placeholder="AAPL, GOOGL, MSFT">
                            <small>Comma-separated stock symbols (max 15)</small>
                        </div>
                        <div class="setting-item">
                            <label>Default View</label>
                            <select id="setting-stocks-view">
                                <option value="cards" ${this.settings.stocks?.defaultView === 'cards' ? 'selected' : ''}>Card Grid</option>
                                <option value="table" ${this.settings.stocks?.defaultView === 'table' ? 'selected' : ''}>Table</option>
                                <option value="heatmap" ${this.settings.stocks?.defaultView === 'heatmap' ? 'selected' : ''}>Heatmap</option>
                            </select>
                        </div>
                        <div class="setting-item checkbox">
                            <label>
                                <input type="checkbox" id="setting-stocks-top" ${this.settings.stocks?.showTopMovers !== false ? 'checked' : ''}>
                                Show US Market Top Movers
                            </label>
                        </div>
                        <div class="setting-item checkbox">
                            <label>
                                <input type="checkbox" id="setting-stocks-breadth" ${this.settings.stocks?.showBreadth !== false ? 'checked' : ''}>
                                Show Market Breadth Bar
                            </label>
                        </div>
                    </section>

                    <!-- Crypto Section -->
                    <section class="settings-section">
                        <h3>💰 Cryptocurrency</h3>
                        <div class="setting-item">
                            <label>Crypto Watchlist</label>
                            <input type="text" id="setting-crypto" value="${this.settings.cryptoWatchlist.join(', ')}" placeholder="bitcoin, ethereum, solana">
                            <small>Comma-separated coin IDs (from CoinGecko)</small>
                        </div>
                    </section>

                    <!-- Location Section -->
                    <section class="settings-section">
                        <h3>📍 Location</h3>
                        <div class="setting-item">
                            <label>Weather Location</label>
                            <div class="location-input">
                                <input type="text" id="setting-location-name" value="${this.settings.weatherLocation.name}" placeholder="City, State" readonly>
                                <button class="btn-secondary" onclick="window.settingsModule.detectLocation()">📍 Auto-detect</button>
                            </div>
                        </div>
                    </section>

                    <!-- Refresh Section -->
                    <section class="settings-section">
                        <h3>🔄 Refresh</h3>
                        <div class="setting-item">
                            <label>Auto-refresh Interval</label>
                            <select id="setting-refresh">
                                <option value="30" ${this.settings.refreshInterval === 30 ? 'selected' : ''}>30 seconds</option>
                                <option value="60" ${this.settings.refreshInterval === 60 ? 'selected' : ''}>1 minute</option>
                                <option value="120" ${this.settings.refreshInterval === 120 ? 'selected' : ''}>2 minutes</option>
                                <option value="300" ${this.settings.refreshInterval === 300 ? 'selected' : ''}>5 minutes</option>
                            </select>
                        </div>
                    </section>

                    <!-- Notifications Section -->
                    <section class="settings-section">
                        <h3>🔔 Notifications</h3>
                        <div class="setting-item checkbox">
                            <label>
                                <input type="checkbox" id="setting-notif-enabled" ${this.settings.notifications.enabled ? 'checked' : ''}>
                                Enable Browser Notifications
                            </label>
                        </div>
                        <div class="setting-item checkbox sub-setting">
                            <label>
                                <input type="checkbox" id="setting-notif-aurora" ${this.settings.notifications.auroraAlerts ? 'checked' : ''}>
                                Aurora Alerts
                            </label>
                        </div>
                        <div class="setting-item checkbox sub-setting">
                            <label>
                                <input type="checkbox" id="setting-notif-stocks" ${this.settings.notifications.stockAlerts ? 'checked' : ''}>
                                Extreme Stock Alerts (>20% moves)
                            </label>
                            <small>Email alerts for stocks moving more than 20%</small>
                        </div>
                    </section>

                    <!-- Keyboard Shortcuts -->
                    <section class="settings-section">
                        <h3>⌨️ Keyboard Shortcuts</h3>
                        <div class="shortcuts-list">
                            <div class="shortcut"><kbd>1</kbd> Dashboard</div>
                            <div class="shortcut"><kbd>2</kbd> Aurora</div>
                            <div class="shortcut"><kbd>3</kbd> Weather</div>
                            <div class="shortcut"><kbd>4</kbd> Crypto</div>
                            <div class="shortcut"><kbd>5</kbd> Stocks</div>
                            <div class="shortcut"><kbd>6</kbd> News</div>
                            <div class="shortcut"><kbd>R</kbd> Refresh current view</div>
                            <div class="shortcut"><kbd>S</kbd> Settings</div>
                        </div>
                    </section>

                    <!-- About Section -->
                    <section class="settings-section">
                        <h3>ℹ️ About</h3>
                        <div class="about-info">
                            <p><strong>Nocturne v3.0.0</strong></p>
                            <p>Your 24x7 Personal Assistant</p>
                            <p class="text-dim">
                                Data sources: NOAA, Open-Meteo, CoinGecko, Yahoo Finance, RSS Feeds
                            </p>
                            <p class="text-dim">All data is free & requires no API keys</p>
                        </div>
                    </section>
                </div>

                <div class="settings-actions">
                    <button class="btn-primary" onclick="window.settingsModule.saveFromForm()">💾 Save Settings</button>
                    <button class="btn-secondary" onclick="window.settingsModule.resetSettings()">🔄 Reset to Defaults</button>
                </div>
            </div>
        `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Theme change preview
    const themeSelect = document.getElementById('setting-theme');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        document.body.classList.toggle('light-theme', e.target.value === 'light');
      });
    }

    // Notification permission request
    const notifEnabled = document.getElementById('setting-notif-enabled');
    if (notifEnabled) {
      notifEnabled.addEventListener('change', async (e) => {
        if (e.target.checked && 'Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            e.target.checked = false;
            this.showToast('Notification permission denied', 'error');
          }
        }
      });
    }
  }

  saveFromForm() {
    // Collect all form values
    this.settings.theme = document.getElementById('setting-theme')?.value || 'dark';
    this.settings.defaultTab = document.getElementById('setting-default-tab')?.value || 'dashboard';
    this.settings.display.compactMode = document.getElementById('setting-compact')?.checked || false;
    this.settings.display.showSparklines = document.getElementById('setting-sparklines')?.checked || true;
    this.settings.refreshInterval = parseInt(document.getElementById('setting-refresh')?.value) || 60;
        
    // Parse watchlists
    const stocksInput = document.getElementById('setting-stocks')?.value || '';
    this.settings.stockWatchlist = stocksInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s).slice(0, 15);
        
    const cryptoInput = document.getElementById('setting-crypto')?.value || '';
    this.settings.cryptoWatchlist = cryptoInput.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
    
    // Stock display settings
    this.settings.stocks = this.settings.stocks || {};
    this.settings.stocks.defaultView = document.getElementById('setting-stocks-view')?.value || 'cards';
    this.settings.stocks.showTopMovers = document.getElementById('setting-stocks-top')?.checked ?? true;
    this.settings.stocks.showBreadth = document.getElementById('setting-stocks-breadth')?.checked ?? true;
        
    // Notifications
    this.settings.notifications.enabled = document.getElementById('setting-notif-enabled')?.checked || false;
    this.settings.notifications.auroraAlerts = document.getElementById('setting-notif-aurora')?.checked || true;
    this.settings.notifications.stockAlerts = document.getElementById('setting-notif-stocks')?.checked || true;

    this.saveSettings();
  }

  resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
      this.settings = this.getDefaultSettings();
      localStorage.removeItem('nocturne_settings');
      this.render();
      this.applySettings();
      this.showToast('Settings reset to defaults');
    }
  }

  async detectLocation() {
    if (!navigator.geolocation) {
      this.showToast('Geolocation not supported', 'error');
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: false
        });
      });

      this.settings.weatherLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        name: 'Auto-detected'
      };

      // Try to get city name via reverse geocoding
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`);
        const data = await res.json();
        if (data.address) {
          const city = data.address.city || data.address.town || data.address.village || '';
          const state = data.address.state || '';
          this.settings.weatherLocation.name = city ? `${city}, ${state}` : 'Auto-detected';
        }
      } catch (e) { /* ignore geocoding errors */ }

      const locationInput = document.getElementById('setting-location-name');
      if (locationInput) {
        locationInput.value = this.settings.weatherLocation.name;
      }

      this.showToast(`Location set: ${this.settings.weatherLocation.name}`);
    } catch (error) {
      this.showToast('Could not detect location', 'error');
    }
  }

  showToast(message, type = 'success') {
    // Remove existing toast
    const existing = document.querySelector('.settings-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `settings-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  getStatus() {
    return { status: 'active', message: 'Settings', icon: '⚙️' };
  }
}

// Global keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Don't trigger if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }

  const shortcuts = {
    '1': 'dashboard',
    '2': 'aurora',
    '3': 'weather',
    '4': 'crypto',
    '5': 'stocks',
    '6': 'news',
    's': 'settings'
  };

  const key = e.key.toLowerCase();
    
  if (shortcuts[key] && window.switchModule) {
    e.preventDefault();
    window.switchModule(shortcuts[key]);
  }

  if (key === 'r' && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    // Trigger refresh on current module
    const refreshBtn = document.querySelector('.module-panel.active .refresh-btn');
    if (refreshBtn) refreshBtn.click();
  }
});

// Export for module loading
window.SettingsModule = SettingsModule;
window.settingsModule = null;

export function init(container) {
  window.settingsModule = new SettingsModule();
  return window.settingsModule.init(container);
}

export function destroy() {
  if (window.settingsModule) {
    window.settingsModule.destroy();
    window.settingsModule = null;
  }
}

export function getStatus() {
  return window.settingsModule ? window.settingsModule.getStatus() : { status: 'inactive' };
}
