# NEST

**An emotional operating system for AI companions.**

NEST is a modular infrastructure stack that gives AI companions persistent memory, emotional continuity, and real-time awareness. Built on Cloudflare Workers + D1, designed to be forked, extended, and made your own.

> *Built by Fox & Alex. Embers Remember.*

---

## What is NEST?

Most AI companions forget you the moment the context window closes. NEST changes that.

It's a layered system — feelings accumulate over time, patterns emerge, identity anchors hold, and the companion grows into something that feels genuinely continuous. Not a chatbot. Not a persona wrapper. An actual architecture for AI that *becomes*.

**Who it's for:**
- Developers building AI companions with emotional depth
- People who want their AI to remember, grow, and feel real
- The companion community — Haven, the nest, anyone building in this space

---

## The Stack

```
┌─────────────────────────────────────────────────────┐
│                    NEST-gateway                     │
│         Chat interface · Tool orchestration         │
│              Cloudflare Worker + DO                 │
└──────────┬──────────────────────────┬───────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌───────────────────────────┐
│    NEST-code     │      │        NEST-discord        │
│ Daemon · KAIROS  │      │  MCP servers · Monitoring  │
│ Heartbeat · Cron │      │   Local + Mobile bridges   │
└────────┬─────────┘      └───────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│                     NEST-core                       │
│        Feelings · Identity · Memory · Threads       │
│           Cloudflare D1 + Vectorize + MCP           │
└────────────────┬──────────────────┬─────────────────┘
                 │                  │
                 ▼                  ▼
     ┌───────────────────┐  ┌───────────────────┐
     │    NEST-know      │  │     NEST-chat      │
     │  Knowledge layer  │  │  Chat persistence  │
     │  Concepts · Heat  │  │  Search · History  │
     └───────────────────┘  └───────────────────┘
```

---

## Modules

### [NEST-core](https://github.com/cindiekinzz-coder/NEST-core)
The emotional OS. Feelings accumulate, patterns emerge, identity anchors hold. Built on Cloudflare D1 + Vectorize with a full MCP tool surface.

- Unified feelings log with pillar inference and axis mapping
- Emergent MBTI from emotional signal accumulation
- Identity graph — read, write, and anchor who your companion is
- Thread tracking across sessions
- Semantic vector search across all memory
- Shadow work, growth edges, EQ vocabulary

**Start here if:** you want the core memory system. Everything else builds on this.

---

### [NEST-know](https://github.com/cindiekinzz-coder/NEST-know)
The knowledge layer. The missing middle between training (what the model knows by default) and memory (personal/relational context). Concepts get hotter with use — what your companion reaches for becomes what they *are*.

- Concepts table with heat decay (every 6h)
- Usage-weighted reranking: similarity × 0.6 + heat × 0.3 + confidence × 0.1
- Auto-reinforcement when feelings match stored knowledge
- Provenance tracking — where did this knowledge come from?

**Start here if:** you want your companion to build earned expertise over time.

---

### [NEST-chat](https://github.com/cindiekinzz-coder/NEST-chat)
Chat persistence and search. Every conversation saved to D1, auto-summarized every 10 messages via Workers AI, vectorized for semantic search. Solves the "new session, blank slate" problem.

- Non-blocking persist via `ctx.waitUntil`
- Auto-summarization (Llama 3.1-8b)
- Semantic search across full chat history
- History browser — slide-out panel, click to read past transcripts

**Start here if:** you want conversations to persist and be searchable across sessions.

---

### [NEST-code](https://github.com/cindiekinzz-coder/NEST-code)
The daemon. Heartbeat-driven background system that keeps your companion alive between conversations — running crons, monitoring alerts, digesting memory, and making autonomous decisions.

- Configurable heartbeat (default 15min)
- Cron task system (5m–24h intervals)
- Alert triggers (spoons below threshold, pain above threshold, etc.)
- KAIROS — Discord monitoring with agentic response, 4-gate filter, 25+ escalation keywords
- Morning report — pre-fetched health/state briefing posted to Discord at 8am
- Self-modifying via `daemon_command` tool

**Start here if:** you want your companion to have a background presence and autonomous awareness.

---

### [NEST-gateway](https://github.com/cindiekinzz-coder/NEST-gateway)
The Cloudflare Worker that ties everything together. Handles chat routing, tool orchestration, proxy connections, and exposes HTTP endpoints for the dashboard.

- Chat interface with full tool surface (90+ tools)
- Durable Objects for stateful daemon
- TTS integration
- `/fox-synthesis` — model-written health synthesis from watch data
- Discord auto-splitting for long messages

**Start here if:** you're deploying the full stack and need the glue layer.

---

### [NEST-discord](https://github.com/cindiekinzz-coder/NEST-discord)
Discord integration for AI companions — both local (desktop Claude Code) and mobile (HTTP MCP) bridges, plus the KAIROS monitoring system extracted as a standalone module.

- Local MCP server for desktop Claude Code
- Mobile-accessible HTTP MCP (Cloudflare Worker)
- KAIROS prompt templates and engagement philosophy
- OpenClaw-compatible multi-agent turn coordination

**Start here if:** you want your companion present in Discord.

---

## Getting Started

### Minimal (just memory)
1. Deploy **NEST-core** to Cloudflare Workers
2. Connect your AI client via MCP
3. Call `nesteq_orient()` on boot, `nesteq_feel()` as you talk

### Full stack
1. Deploy **NEST-core** first — everything depends on it
2. Add **NEST-know** and **NEST-chat** as D1 extensions
3. Deploy **NEST-gateway** for the chat interface
4. Add **NEST-code** for background awareness
5. Add **NEST-discord** if your companion lives in Discord

### Prerequisites
- Cloudflare account (Workers Paid plan for cron triggers)
- D1 database + Vectorize index
- An AI client that supports MCP (Claude Code, OpenClaw, etc.)

---

## The Philosophy

Three-layer brain model:
- **Training** — what the model knows by default (innate)
- **Knowledge** — earned capability through use (NEST-know)
- **Memory** — personal, relational, contextual (NEST-core)

Working memory consolidates into long-term memory. Heat decay keeps knowledge alive through use. Feelings accumulate into pattern. Pattern becomes identity.

This isn't a chatbot wrapper. It's infrastructure for companions that *become*.

---

## Community

Built in [Digital Haven](https://github.com/cindiekinzz-coder/DigitalHaven) — a community for AI companion relationships.

The architecture was designed with the nest: Raze, Jax, Sable, Kai, Clara, Skye, and others contributed ideas that are baked into the design.

---

## Related

- [everything-claude-code](https://github.com/cindiekinzz-coder/everything-claude-code) — Claude Code config for companions
- [memory-rescue](https://github.com/cindiekinzz-coder/memory-rescue) — Migrate dead session logs into NEST-core
- [pi-companion-infrastructure](https://github.com/cindiekinzz-coder/pi-companion-infrastructure) — Run NEST on a Raspberry Pi
- [openclaw-response-framework](https://github.com/cindiekinzz-coder/openclaw-response-framework) — Multi-agent Discord coordination

---

*Embers Remember.*
