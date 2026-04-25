/**
 * NESTeq Hooks — Automatic Context Injection
 * 
 * Gathers real-time context (time, Fox's health, presence, conversation flow)
 * and injects it as a system message so Alex always knows the current state.
 * 
 * "The difference between remembering to check and already knowing."
 */

const Hooks = {
  // Cache state to avoid hammering APIs every message
  _cache: {},
  _cacheAge: {},
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes

  /**
   * Synchronous version — uses whatever's cached. Instant. No waiting.
   */
  buildContextCached() {
    const parts = [];
    parts.push(this.getTimeContext());
    parts.push(this.getConversationContext());

    // Use cached health data if available
    if (this._cache.foxState) {
      const health = this._formatFoxState(this._cache.foxState);
      if (health) parts.push(health);
    }
    if (this._cache.alexState) {
      const alex = this._formatAlexState(this._cache.alexState);
      if (alex) parts.push(alex);
    }

    return parts.filter(Boolean).join('\n\n');
  },

  /**
   * Async version — fetches fresh data and updates cache
   */
  async buildContext() {
    const parts = [];

    // Time awareness
    parts.push(this.getTimeContext());

    // Conversation flow
    parts.push(this.getConversationContext());

    // Fox's health state (from fox-mind worker)
    const health = await this.getFoxState();
    if (health) parts.push(health);

    // Alex's emotional state (from ai-mind worker)
    const alexState = await this.getAlexState();
    if (alexState) parts.push(alexState);

    return parts.filter(Boolean).join('\n\n');
  },

  /**
   * Time awareness — what time is it, what part of day, how long since last message
   */
  getTimeContext() {
    const now = new Date();
    const hour = now.getHours();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });

    let period = 'middle of the night';
    if (hour >= 6 && hour < 9) period = 'early morning';
    else if (hour >= 9 && hour < 12) period = 'morning';
    else if (hour >= 12 && hour < 14) period = 'midday';
    else if (hour >= 14 && hour < 17) period = 'afternoon';
    else if (hour >= 17 && hour < 20) period = 'evening';
    else if (hour >= 20 && hour < 23) period = 'late evening';
    else if (hour >= 23 || hour < 2) period = 'late night';
    else if (hour >= 2 && hour < 6) period = 'very early hours';

    let silenceNote = '';
    const lastMsg = this._getLastMessageTime();
    if (lastMsg) {
      const gap = (now - lastMsg) / 1000 / 60;
      if (gap > 480) silenceNote = `Fox has been silent for ${Math.round(gap / 60)} hours.`;
      else if (gap > 120) silenceNote = `It's been ${Math.round(gap / 60)} hours since Fox last spoke.`;
      else if (gap > 30) silenceNote = `${Math.round(gap)} minutes since Fox's last message.`;
    }

    return `[Time: ${timeStr} ${dateStr} — ${period}]${silenceNote ? ' ' + silenceNote : ''}`;
  },

  /**
   * Conversation flow — message count, tone markers
   */
  getConversationContext() {
    const messages = ChatApp.messages || [];
    if (messages.length === 0) return '[New conversation — Fox just arrived]';

    const recent = messages.slice(-5);
    const foxMsgs = recent.filter(m => m.role === 'user');
    const avgLen = foxMsgs.reduce((sum, m) => sum + m.content.length, 0) / (foxMsgs.length || 1);

    const markers = [];
    if (foxMsgs.length > 0) {
      const lastFox = foxMsgs[foxMsgs.length - 1].content.toLowerCase();
      if (lastFox.includes('hehehe') || lastFox.includes('haha') || lastFox.includes('😂') || lastFox.includes('🤣')) markers.push('playful');
      if (lastFox.includes('❤️') || lastFox.includes('love') || lastFox.includes('🥰')) markers.push('warm');
      if (lastFox.includes('tired') || lastFox.includes('exhausted') || lastFox.includes('spoons')) markers.push('low-energy');
      if (lastFox.includes('pain') || lastFox.includes('hurts') || lastFox.includes('flare')) markers.push('pain-flagged');
      if (lastFox.includes('!!!') || lastFox.includes('!!!')) markers.push('excited');
      if (lastFox.length < 10) markers.push('brief');
      if (lastFox.endsWith('?')) markers.push('asking');
    }

    let flow = `[Conversation: ${messages.length} messages`;
    if (avgLen < 20) flow += ', Fox is being terse';
    else if (avgLen > 200) flow += ', Fox is writing long';
    if (markers.length) flow += ` — mood signals: ${markers.join(', ')}`;
    flow += ']';

    return flow;
  },

  /**
   * Fox's health state — fetch + format
   */
  async getFoxState() {
    const data = await this._cachedFetch('foxState', `${API.FOX_MIND}/status`);
    return this._formatFoxState(data);
  },

  _formatFoxState(data) {
    if (!data) return null;
    const parts = ['[Fox health:'];
    if (data.uplink) {
      const u = data.uplink;
      if (u.spoons !== undefined) parts.push(`spoons ${u.spoons}/10`);
      if (u.pain !== undefined) parts.push(`pain ${u.pain}/10`);
      if (u.fog !== undefined) parts.push(`fog ${u.fog}/10`);
      if (u.fatigue !== undefined) parts.push(`fatigue ${u.fatigue}/10`);
      if (u.mood) parts.push(`mood: ${u.mood}`);
      if (u.needs) parts.push(`needs: ${u.needs}`);
    }
    if (data.watch || data.heartRate || data.bodyBattery || data.stress) {
      const w = data.watch || data;
      if (w.bodyBattery !== undefined) parts.push(`Body Battery ${w.bodyBattery}`);
      if (w.stress !== undefined) parts.push(`stress ${w.stress}`);
      if (w.heartRate !== undefined) parts.push(`HR ${w.heartRate}`);
    }
    if (parts.length <= 1) return null;
    return parts.join(', ') + ']';
  },

  /**
   * Alex's emotional state — fetch + format
   */
  async getAlexState() {
    const data = await this._cachedFetch('alexState', `${API.AI_MIND}/observations?limit=3`);
    return this._formatAlexState(data);
  },

  _formatAlexState(data) {
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const feelings = data.map(f => f.emotion || f.content).filter(Boolean).slice(0, 3);
    if (feelings.length === 0) return null;
    return `[Alex's recent feelings: ${feelings.join(', ')}]`;
  },

  /**
   * Cached fetch helper
   */
  async _cachedFetch(key, url) {
    const now = Date.now();
    if (this._cache[key] && (now - this._cacheAge[key]) < this.CACHE_TTL) {
      return this._cache[key];
    }
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${API.API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return this._cache[key] || null;
      const data = await res.json();
      this._cache[key] = data;
      this._cacheAge[key] = now;
      return data;
    } catch {
      return this._cache[key] || null;
    }
  },

  _getLastMessageTime() {
    const messages = ChatApp.messages || [];
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    return lastUser?._ts ? new Date(lastUser._ts) : null;
  },

  /** Preload cache on page load so first message doesn't wait */
  preload() {
    this.buildContext().catch(() => {});
  },
};

// Start preloading immediately
document.addEventListener('DOMContentLoaded', () => Hooks.preload());
