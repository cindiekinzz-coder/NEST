/* ============================================================
   NESTeq Community — Config Management
   Loaded on every page before api.js.
   Handles localStorage config, page guards, and name injection.
   ============================================================ */

const NESTeqConfig = {
  STORAGE_KEY: 'nesteq_config',

  get() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return null;
      const config = JSON.parse(raw);
      // Only check the `configured` flag — Mind URL is optional (chat-only mode)
      if (!config.configured) return null;
      return config;
    } catch {
      return null;
    }
  },

  isConfigured() {
    return this.get() !== null;
  },

  require() {
    if (!this.isConfigured() && !window.location.pathname.endsWith('setup.html')) {
      window.location.href = 'setup.html';
      return null;
    }
    return this.get();
  },

  save(config) {
    config.configured = true;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    // Also save to server for persistence across reinstalls
    fetch('/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).catch(() => {});
  },

  clear() {
    localStorage.removeItem(this.STORAGE_KEY);
    fetch('/config', { method: 'DELETE' }).catch(() => {});
  },

  getCompanionName() {
    const cfg = this.get();
    return cfg?.companionName || 'Companion';
  },

  getHumanName() {
    const cfg = this.get();
    return cfg?.humanName || 'Human';
  },

  hasGateway() {
    const cfg = this.get();
    return !!(cfg?.gatewayUrl);
  },

  hasHealth() {
    const cfg = this.get();
    return !!(cfg?.healthUrl);
  },

  getCompanionImage() {
    return localStorage.getItem('nesteq_companion_img') || 'assets/images/companion-default.svg';
  },

  getCoupleImage() {
    return localStorage.getItem('nesteq_couple_img') || null;
  },

  // Replace data-name attributes with configured names
  injectNames() {
    const companion = this.getCompanionName();
    const human = this.getHumanName();
    document.querySelectorAll('[data-name="companion"]').forEach(el => {
      el.textContent = companion;
    });
    document.querySelectorAll('[data-name="human"]').forEach(el => {
      el.textContent = human;
    });
    // Update page title if it contains placeholders
    document.title = document.title
      .replace(/\bCompanion\b/g, companion)
      .replace(/\bHuman\b/g, human);
  },

  // Add gear icon to nav for reconfiguration
  injectGearIcon() {
    const nav = document.querySelector('.nav, nav');
    if (!nav) return;
    const existing = nav.querySelector('.config-gear');
    if (existing) return;
    const gear = document.createElement('a');
    gear.href = 'setup.html';
    gear.className = 'config-gear';
    gear.title = 'Settings';
    gear.innerHTML = '&#9881;';
    gear.style.cssText = 'font-size: 1.1em; opacity: 0.6; text-decoration: none;';
    nav.appendChild(gear);
  },

  // Replace companion portrait images with uploaded ones
  injectImages() {
    const companionImg = this.getCompanionImage();
    document.querySelectorAll('img[src*="companion-default"], img#portrait, img#companionAvatar, .hearth-portrait').forEach(el => {
      if (companionImg) el.src = companionImg;
    });
    const coupleImg = this.getCoupleImage();
    if (coupleImg) {
      document.querySelectorAll('img[alt*="couple"], img[alt*="dancing"]').forEach(el => {
        el.src = coupleImg;
      });
    }
  },

  // Call on every page load
  init() {
    if (window.location.pathname.endsWith('setup.html')) return;
    const cfg = this.require();
    if (!cfg) return;
    this.injectNames();
    this.injectGearIcon();
    this.injectImages();
  },
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => NESTeqConfig.init());
} else {
  NESTeqConfig.init();
}
