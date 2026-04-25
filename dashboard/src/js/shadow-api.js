/* ============================================================
   NESTeq Dashboard — Shadow API Layer
   Fetches from shadow-mind worker (same endpoints as ai-mind)
   ============================================================ */

const SHADOW_API = {
  MIND: 'https://your-shadow-mind.workers.dev',
  API_KEY: 'your-shadow-api-key-here',
};

async function fetchShadowJSON(url, options = {}) {
  try {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    headers['Authorization'] = `Bearer ${SHADOW_API.API_KEY}`;
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`Shadow Fetch failed: ${url}`, err);
    return null;
  }
}

const ShadowMind = {
  async getHome() {
    return fetchShadowJSON(`${SHADOW_API.MIND}/home`);
  },
  async getFeelings(limit = 10) {
    const data = await fetchShadowJSON(`${SHADOW_API.MIND}/observations?limit=${limit}`);
    return data?.observations || data || [];
  },
  async getThreads() {
    const data = await fetchShadowJSON(`${SHADOW_API.MIND}/threads`);
    return data?.threads || data || [];
  },
  async getIdentity() {
    return fetchShadowJSON(`${SHADOW_API.MIND}/identity`);
  },
  async getHealth() {
    return fetchShadowJSON(`${SHADOW_API.MIND}/mind-health`);
  },
  async getEQType() {
    return fetchShadowJSON(`${SHADOW_API.MIND}/eq/type`);
  },
  async getEQLandscape(days = 7) {
    return fetchShadowJSON(`${SHADOW_API.MIND}/eq-landscape?days=${days}`);
  },
  async getDreams(limit = 5) {
    const data = await fetchShadowJSON(`${SHADOW_API.MIND}/dreams?limit=${limit}`);
    return data?.dreams || data || [];
  },
  async getWritings(limit = 10) {
    return fetchShadowJSON(`${SHADOW_API.MIND}/writings?limit=${limit}`);
  },
  async getKnowledge(scope = 'shadow') {
    return fetchShadowJSON(`${SHADOW_API.MIND}/knowledge?scope=${scope}`);
  },
  async getContext() {
    return fetchShadowJSON(`${SHADOW_API.MIND}/context`);
  },
};
