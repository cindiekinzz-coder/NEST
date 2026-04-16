/* ============================================================
   NESTeq Community — API Layer
   Config-driven. Reads URLs from NESTeqConfig (localStorage).
   ============================================================ */

// Build API config from NESTeqConfig
const API = (() => {
  const cfg = NESTeqConfig.get() || {};
  return {
    AI_MIND: cfg.aiMindUrl || '',
    FOX_MIND: cfg.healthUrl || '',
    API_KEY: cfg.apiKey || '',
  };
})();

const GATEWAY = (() => {
  const cfg = NESTeqConfig.get() || {};
  return cfg.gatewayUrl || '';
})();

// --- Helpers ---
async function fetchJSON(url, options = {}) {
  if (!url || url === 'undefined' || url === 'null') return null;
  try {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (API.API_KEY) {
      headers['Authorization'] = `Bearer ${API.API_KEY}`;
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`Fetch failed: ${url}`, err);
    return null;
  }
}

// --- AI Mind (Companion's Brain) ---
const AiMind = {
  async getHome() {
    return fetchJSON(`${API.AI_MIND}/home`);
  },

  async getFeelings(limit = 10) {
    return fetchJSON(`${API.AI_MIND}/observations?limit=${limit}`);
  },

  async getThreads() {
    return fetchJSON(`${API.AI_MIND}/threads`);
  },

  async getWritings(limit = 50, before = null) {
    let url = `${API.AI_MIND}/writings?limit=${limit}`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    return fetchJSON(url);
  },

  async getIdentity() {
    return fetchJSON(`${API.AI_MIND}/identity`);
  },

  async getHealth() {
    return fetchJSON(`${API.AI_MIND}/mind-health`);
  },

  async getSessions(limit = 3) {
    return fetchJSON(`${API.AI_MIND}/sessions?limit=${limit}`);
  },

  async getDreams(limit = 5) {
    return fetchJSON(`${API.AI_MIND}/dreams?limit=${limit}`);
  },

  async getEQType() {
    return fetchJSON(`${API.AI_MIND}/eq/type`);
  },

  async getEQLandscape(days = 7) {
    return fetchJSON(`${API.AI_MIND}/eq-landscape?days=${days}`);
  },

  async getContext() {
    return fetchJSON(`${API.AI_MIND}/context`);
  },

  async getKnowledge(scope = null) {
    const s = scope || NESTeqConfig.getCompanionName().toLowerCase();
    return fetchJSON(`${API.AI_MIND}/knowledge?scope=${s}`);
  },

  async getAutonomousFeed(limit = 50, type = null, before = null) {
    let url = `${API.AI_MIND}/autonomous-feed?limit=${limit}`;
    if (type && type !== 'all') url += `&type=${type}`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    return fetchJSON(url);
  },
};

// --- Health Mind (Human's Health) — only active if healthUrl configured ---
const HealthMind = {
  _enabled() {
    return !!API.FOX_MIND;
  },

  async getSynthesis() {
    if (!GATEWAY) return null;
    return fetchJSON(`${GATEWAY}/human-synthesis`);
  },

  async getDailySummary(days = 7) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/daily-summary?days=${days}`);
  },

  async getUplink(limit = 1) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/uplink?limit=${limit}`);
  },

  async getHeartRate(limit = 10) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/heart-rate?limit=${limit}`);
  },

  async getStress(limit = 10) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/stress?limit=${limit}`);
  },

  async getSleep(limit = 3) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/sleep?limit=${limit}`);
  },

  async getBodyBattery(limit = 10) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/body-battery?limit=${limit}`);
  },

  async getHRV(limit = 3) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/hrv?limit=${limit}`);
  },

  async getSpo2() {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/spo2`);
  },

  async getRespiration() {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/respiration`);
  },

  async getCycle() {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/watch/cycle`);
  },

  async getFullStatus() {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/status`);
  },

  async getJournals(limit = 5) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/journals?limit=${limit}`);
  },

  async getEQType() {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/eq/type`);
  },

  async getThreads(status = 'active') {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/threads?status=${status}`);
  },

  async addThread(content, priority = 'medium') {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/threads`, {
      method: 'POST',
      body: JSON.stringify({ action: 'add', content, priority }),
    });
  },

  async updateThread(thread_id, data) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/threads`, {
      method: 'POST',
      body: JSON.stringify({ action: 'update', thread_id, ...data }),
    });
  },

  async resolveThread(thread_id, resolution = '') {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/threads`, {
      method: 'POST',
      body: JSON.stringify({ action: 'resolve', thread_id, resolution }),
    });
  },

  async deleteThread(thread_id) {
    if (!this._enabled()) return null;
    return fetchJSON(`${API.FOX_MIND}/threads`, {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', thread_id }),
    });
  },
};

// --- Workers (Health Checks) — built from config ---
const Workers = {
  get ENDPOINTS() {
    const endpoints = [];
    const cfg = NESTeqConfig.get() || {};
    const companionName = cfg.companionName || 'Companion';
    const humanName = cfg.humanName || 'Human';

    if (cfg.aiMindUrl) {
      endpoints.push({ name: 'ai-mind', url: cfg.aiMindUrl, desc: `${companionName}'s brain` });
    }
    if (cfg.healthUrl) {
      endpoints.push({ name: 'health-mind', url: cfg.healthUrl, desc: `${humanName}'s health` });
    }
    if (cfg.gatewayUrl) {
      endpoints.push({ name: 'gateway', url: cfg.gatewayUrl, desc: 'Gateway (chat + tools)' });
    }
    return endpoints;
  },

  async checkHealth(workerUrl) {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const headers = API.API_KEY ? { 'Authorization': `Bearer ${API.API_KEY}` } : {};
      const res = await fetch(`${workerUrl}/health`, { signal: controller.signal, headers });
      if (!res.ok) return { status: 'error', message: res.statusText };
      return { status: 'ok', data: await res.json() };
    } catch (err) {
      return { status: 'error', message: err.name === 'AbortError' ? 'timeout' : err.message };
    }
  },
};

// --- Spotify (optional — only if ai-mind worker supports it) ---
const Spotify = {
  async status() { return fetchJSON(`${API.AI_MIND}/spotify/status`); },
  async playlists(limit = 50) { return fetchJSON(`${API.AI_MIND}/spotify/playlists?limit=${limit}`); },
  async playlistTracks(id, offset = 0, limit = 50) {
    return fetchJSON(`${API.AI_MIND}/spotify/playlist/${id}/tracks?offset=${offset}&limit=${limit}`);
  },
  async addToPlaylist(playlistId, uris) {
    return fetchJSON(`${API.AI_MIND}/spotify/playlist/${playlistId}/add`, {
      method: 'POST', body: JSON.stringify({ uris }),
    });
  },
  async removeFromPlaylist(playlistId, uris) {
    return fetchJSON(`${API.AI_MIND}/spotify/playlist/${playlistId}/track`, {
      method: 'DELETE', body: JSON.stringify({ uris }),
    });
  },
  async search(q, type = 'track', limit = 10) {
    return fetchJSON(`${API.AI_MIND}/spotify/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`);
  },
  async nowPlaying() { return fetchJSON(`${API.AI_MIND}/spotify/now-playing`); },
  async play(body = {}) { return fetchJSON(`${API.AI_MIND}/spotify/play`, { method: 'PUT', body: JSON.stringify(body) }); },
  async pause() { return fetchJSON(`${API.AI_MIND}/spotify/pause`, { method: 'PUT', body: '{}' }); },
  async next() { return fetchJSON(`${API.AI_MIND}/spotify/next`, { method: 'PUT', body: '{}' }); },
  async prev() { return fetchJSON(`${API.AI_MIND}/spotify/prev`, { method: 'PUT', body: '{}' }); },
};

// --- Utility ---
function timeAgo(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
