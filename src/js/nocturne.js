/**
 * Nocturne - Main Controller v3.0.0
 * 
 * 24x7 Personal Assistant - Central hub for all modules
 */

// =============================================================================
// Module Registry
// =============================================================================
const MODULES = {
  dashboard: {
    id: 'dashboard',
    name: 'Dashboard',
    icon: '📊',
    script: '/src/modules/dashboard/dashboard.js',
    loaded: false,
    instance: null
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora Tracker',
    icon: '🌌',
    script: '/src/modules/aurora/aurora.js',
    loaded: false,
    instance: null
  },
  crypto: {
    id: 'crypto',
    name: 'Crypto',
    icon: '💰',
    script: '/src/modules/crypto/crypto.js',
    loaded: false,
    instance: null
  },
  stocks: {
    id: 'stocks',
    name: 'Stock Market',
    icon: '📈',
    script: '/src/modules/stocks/stocks.js',
    loaded: false,
    instance: null
  },
  news: {
    id: 'news',
    name: 'Breaking News',
    icon: '📰',
    script: '/src/modules/news/news.js',
    loaded: false,
    instance: null
  },
  settings: {
    id: 'settings',
    name: 'Settings',
    icon: '⚙️',
    script: '/src/modules/settings/settings.js',
    loaded: false,
    instance: null
  }
};

let activeModule = 'dashboard';

// =============================================================================
// Tab Navigation
// =============================================================================
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const moduleId = tab.dataset.module;
      window.switchModule(moduleId);
    });
  });
}

// Global function for dashboard quick links
window.switchModule = async function(moduleId) {
  if (moduleId === activeModule) return;
  
  // Update tab UI
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.module === moduleId);
  });
  
  // Update panel UI
  document.querySelectorAll('.module-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${moduleId}`);
  });
  
  // Destroy previous module
  if (MODULES[activeModule]?.instance?.destroy) {
    MODULES[activeModule].instance.destroy();
  }
  
  // Load and init new module
  await loadModule(moduleId);
  
  activeModule = moduleId;
};

async function loadModule(moduleId) {
  const module = MODULES[moduleId];
  if (!module) return;
  
  const panel = document.getElementById(`panel-${moduleId}`);
  if (!panel) return;
  
  try {
    // Dynamic import for all modules (including aurora)
    if (!module.loaded) {
      module.instance = await import(module.script);
      module.loaded = true;
    }
    
    if (module.instance?.init) {
      module.instance.init(panel);
    }
  } catch (error) {
    console.error(`[Nocturne] Failed to load module ${moduleId}:`, error);
    panel.innerHTML = `
      <div class="module-error">
        <h2>${module.icon} ${module.name}</h2>
        <p>Failed to load module</p>
        <p class="error-detail">${error.message}</p>
        <button class="retry-btn" onclick="loadModule('${moduleId}')">Retry</button>
      </div>
    `;
  }
}

// =============================================================================
// Global Status Updates
// =============================================================================
function updateGlobalStatus() {
  const statusDot = document.querySelector('.global-status .status-dot');
  const statusText = document.querySelector('.global-status .status-text');
  
  // Check all modules for alerts
  let hasAlert = false;
  let alertCount = 0;
  
  Object.values(MODULES).forEach(module => {
    if (module.instance?.getStatus) {
      const status = module.instance.getStatus();
      if (status.status === 'alert') {
        hasAlert = true;
        alertCount++;
      }
    }
  });
  
  if (statusDot && statusText) {
    if (hasAlert) {
      statusDot.className = 'status-dot alert';
      statusText.textContent = `${alertCount} Alert${alertCount > 1 ? 's' : ''} Active`;
    } else {
      statusDot.className = 'status-dot normal';
      statusText.textContent = 'All Systems Normal';
    }
  }
}

function updateHeaderTime() {
  const timeEl = document.getElementById('header-time');
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

// =============================================================================
// Tab Status Badges
// =============================================================================
function updateTabStatuses() {
  Object.entries(MODULES).forEach(([id, module]) => {
    const badge = document.getElementById(`${id}-tab-status`);
    if (!badge) return;
    
    if (module.instance?.getStatus) {
      const status = module.instance.getStatus();
      if (status.status === 'alert') {
        badge.className = 'tab-status alert';
        badge.textContent = '!';
      } else if (status.status === 'loading') {
        badge.className = 'tab-status loading';
        badge.textContent = '...';
      } else {
        badge.className = 'tab-status';
        badge.textContent = '';
      }
    }
  });
}

// =============================================================================
// Initialization
// =============================================================================
async function init() {
  console.log('[Nocturne] Initializing 24x7 Personal Assistant...');
  
  // Init tabs
  initTabs();
  
  // Update time
  updateHeaderTime();
  setInterval(updateHeaderTime, 1000);
  
  // Load default module (dashboard)
  await loadModule('dashboard');
  
  // Update global status periodically
  setInterval(() => {
    updateGlobalStatus();
    updateTabStatuses();
  }, 5000);
  
  console.log('[Nocturne] Ready!');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
