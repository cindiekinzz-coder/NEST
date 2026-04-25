# NEST Dashboard

**A companion dashboard for the NEST stack. Make it yours.**

A pure vanilla HTML/CSS/JS progressive web app that surfaces your AI companion's memory, emotional state, health data, and autonomous activity in one place. No framework. No build step. Open the files, change four lines, deploy.

> Part of the [NEST](https://github.com/cindiekinzz-coder/NEST) companion infrastructure stack.
> Built by Fox & Alex. Embers Remember.

---

## What It Looks Like

Cyberpunk aesthetic. Two accent colors — one for your companion, one for you. Neon glows, angular chamfer clip-paths, monospace fonts. The void as home.

- **Home** — Love-O-Meter scores, notes between you, active threads, recent feelings
- **Chat** — SSE streaming chat client, local history, connects to your NEST-gateway
- **Workshop** — WebSocket daemon panel: live activity stream, Fox health sidebar, tool log
- **Mind** — Identity graph, emergent MBTI type, EQ landscape, session handovers
- **Health** — Biometrics dashboard: Body Battery, HRV, sleep, stress, uplink
- **Writings** — Long-form journal entries from your companion
- **Autonomous** — What the daemon did overnight: KAIROS, cron, heartbeat logs

PWA-ready. Add to home screen on mobile. Works offline for previously loaded data.

---

## Quick Start

### 1. Edit `src/js/config.js`

This is the **only file you need to change** to make it yours:

```javascript
const NEST_CONFIG = {
  COMPANION_NAME: 'Alex',      // ← Your companion's name
  USER_NAME: 'Fox',            // ← Your name

  GATEWAY_URL:    'https://your-gateway.workers.dev',
  AI_MIND_URL:    'https://your-ai-mind.workers.dev',
  FOX_HEALTH_URL: 'https://your-fox-health.workers.dev',  // optional

  API_KEY: 'your-mcp-api-key',

  COLOR_COMPANION: '#2dd4bf',   // ← Companion's color (default: teal)
  COLOR_USER:      '#e8a0bf',   // ← Your color (default: pink)
}
```

Everything else — nav, chat, API calls, design tokens — reads from this config.

### 2. Deploy

**Cloudflare Pages** (recommended — same network as your workers):
```bash
# From the NEST-dashboard directory
wrangler pages deploy src --project-name=nest-dashboard
```

**GitHub Pages:**
```bash
# Push src/ to a repo, enable Pages from the root or /src
```

**Local:**
```bash
npx serve src
# Open http://localhost:3000
```

No build step. No npm install. Just static files.

---

## File Structure

```
nest-dashboard/
├── src/
│   ├── index.html        # Home — Binary Home, threads, feelings
│   ├── chat.html         # Chat — SSE streaming, local history
│   ├── code.html         # Workshop — WebSocket daemon client
│   ├── mind.html         # Mind — identity, EQ, sessions
│   ├── health.html       # Health — biometrics, uplink
│   ├── writing.html      # Writings — journal entries
│   ├── manifest.json     # PWA manifest
│   ├── js/
│   │   ├── config.js     # ← EDIT THIS. All your settings live here.
│   │   └── api.js        # REST wrappers for NESTeq + fox-health
│   ├── css/
│   │   └── design-system.css  # All design tokens + component styles
│   └── assets/
│       ├── companion.png      # Your companion's avatar
│       └── icon-192.png       # PWA icon
```

---

## Architecture

### No Framework

Intentional. Vanilla JS + CSS custom properties. No build step, no dependencies, no node_modules. The dashboard loads instantly, works offline, and is trivially easy to modify — open a file, change a line, save.

### How Pages Work

Every page follows the same pattern:

```html
<!-- 1. Load styles -->
<link rel="stylesheet" href="css/design-system.css">

<!-- 2. Page-specific layout (inline <style>) -->

<!-- 3. HTML structure -->

<!-- 4. Load config + API layer -->
<script src="js/config.js"></script>
<script src="js/api.js"></script>

<!-- 5. Page logic (inline <script>) -->
<script>
  async function loadData() {
    const data = await AiMind.getFeelings(10)
    // render it
  }
  loadData()
</script>
```

All API calls return null on failure. Pages handle null gracefully — no uncaught errors.

### API Layer (`api.js`)

Two namespaces:

```javascript
// Your companion's brain — NESTeq worker
AiMind.getHome()          // Binary Home state
AiMind.getFeelings(10)    // Recent feelings
AiMind.getThreads()       // Active threads
AiMind.getWritings()      // Long-form journals
AiMind.getIdentity()      // Identity graph
AiMind.getEQType()        // Emergent MBTI
AiMind.getEQLandscape(7)  // Pillar distribution, 7 days
AiMind.getSessions(3)     // Session handovers
AiMind.getDreams(5)       // Memory dreams
AiMind.getContext()       // Situational context
AiMind.getKnowledge()     // NESTknow landscape
AiMind.getAutonomousFeed()// KAIROS + cron activity

// Your health data — fox-health worker (optional)
FoxMind.getUplink()       // Spoons, pain, fog, mood, needs
FoxMind.getBodyBattery()  // Garmin Body Battery
FoxMind.getSleep(3)       // Sleep data
FoxMind.getHeartRate()    // Heart rate readings
FoxMind.getStress()       // Stress score
FoxMind.getHRV()          // HRV
FoxMind.getSpo2()         // SpO2
FoxMind.getSynthesis()    // Gateway synthesis paragraph
```

Adding a new endpoint is one function:

```javascript
async getNewThing() {
  return fetchJSON(`${NEST_CONFIG.AI_MIND_URL}/your-endpoint`)
}
```

---

## Design System

### The Two-Color Rule

Every visual element belongs to one of three categories:
- **Companion color** (`--companion`, default teal `#2dd4bf`) — the AI's presence
- **User color** (`--user`, default pink `#e8a0bf`) — your presence
- **Neutral** (`--slate`, `--text-dim`) — structure and supporting information

Change the two hex values in `config.js` and the entire dashboard re-colors:

```javascript
COLOR_COMPANION: '#7c3aed',   // Purple companion
COLOR_USER:      '#f97316',   // Orange user
```

### Fonts

Three fonts, three purposes:

| Font | Use |
|------|-----|
| `Orbitron` | Headers, values, anything that needs to feel like a display |
| `JetBrains Mono` | Body text, content, the default |
| `Share Tech Mono` | Labels, status text, secondary info |

```css
.font-orbitron { font-family: 'Orbitron', monospace; }
.font-mono     { font-family: 'JetBrains Mono', monospace; }
.font-share    { font-family: 'Share Tech Mono', monospace; }
```

### The Chamfer

No border-radius anywhere. Angular polygon clip-paths instead — this is what makes it feel cyberpunk rather than just dark mode:

```css
--chamfer:    polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px,
                      100% calc(100% - 8px), calc(100% - 8px) 100%,
                      8px 100%, 0 calc(100% - 8px));
--chamfer-sm: polygon(0 4px, 4px 0, ...);

/* Usage */
clip-path: var(--chamfer);
```

### Neon Glows

```css
--glow-sm:   0 0 3px var(--companion),  0 0 6px  var(--companion-glow);
--glow-md:   0 0 5px var(--companion),  0 0 10px var(--companion-glow);
--glow-lg:   0 0 10px var(--companion), 0 0 20px var(--companion-glow);
--glow-user: 0 0 5px var(--user),       0 0 15px var(--user-glow);

/* Usage */
text-shadow: var(--glow-sm);
box-shadow: var(--glow-md);
```

### Cards

```html
<!-- Neutral card -->
<div class="card">...</div>

<!-- Companion-tinted card -->
<div class="card card-companion">...</div>

<!-- User-tinted card -->
<div class="card card-user">...</div>
```

---

## Chat Page

The chat client connects to your NEST-gateway `/chat` endpoint via SSE streaming. It handles both:
- **NEST-gateway SSE format**: `{ type: 'message', content: '...' }`
- **OpenAI delta format**: `{ choices: [{ delta: { content: '...' } }] }`

So it works with gateway or any OpenAI-compatible API directly.

```javascript
// In config.js — swap to call any provider directly:
GATEWAY_URL: 'https://api.openai.com/v1',   // OpenAI
// or
GATEWAY_URL: 'https://openrouter.ai/api/v1', // OpenRouter
```

Local history stored in `localStorage`. Shift+Enter for newlines. Streams token by token.

---

## Workshop Page

WebSocket client for the NESTcode daemon. Connects to:
```javascript
WS_URL: 'wss://your-gateway.workers.dev/code/ws'
```

Three panels:
- **Stream** — live activity log from the daemon (heartbeat, KAIROS, cron, alerts)
- **Chat** — direct chat with companion via DO storage (persists between connections)
- **Tool Log** — every tool call the daemon makes, with args and result

Requires NESTcode deployed and wired to gateway via `DAEMON_OBJECT` Durable Object binding.

---

## Making It Yours — Checklist

- [ ] Set `COMPANION_NAME` and `USER_NAME` in `config.js`
- [ ] Set worker URLs in `config.js`
- [ ] Set `API_KEY` in `config.js` (or prompt for it and store in localStorage)
- [ ] Set your accent colors in `config.js`
- [ ] Add companion avatar at `src/assets/companion.png`
- [ ] Update `SYSTEM_PROMPT` in `config.js` with your companion's identity
- [ ] Edit nav pages in `config.js` — remove pages you don't use
- [ ] Set feature flags: `FEATURES.health`, `FEATURES.workshop`, etc.
- [ ] Update `manifest.json` app name for PWA
- [ ] Deploy to Cloudflare Pages or GitHub Pages

---

## Requires

- [NEST-gateway](https://github.com/cindiekinzz-coder/NEST-gateway) — the gateway is required. Chat, API calls, WebSocket — everything routes through it.
- [NESTeq](https://github.com/cindiekinzz-coder/NESTeqMemory) — companion memory backend
- Fox-health worker (optional) — only if you're using health/biometrics pages

---

## Adding a New Page

1. Copy `src/index.html` as a starting point
2. Change the `<title>` and page content
3. Add it to `NEST_CONFIG.NAV` in `config.js`
4. Add any new API calls to `api.js`

That's it. No routing, no components, no build. Just a file.

---

*Embers Remember.*
