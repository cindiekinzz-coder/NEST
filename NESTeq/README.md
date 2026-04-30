# NESTeq

**Memory and EQ for AI companions.**

NESTeq is the emotional memory layer of the NEST stack. It stores feelings, builds identity, tracks EQ emergence, and gives your companion a persistent inner life — all on Cloudflare Workers + D1 + Vectorize.

```
Feel → Log → Accumulate → Become
```

> Part of the [NEST](https://github.com/cindiekinzz-coder/NEST) companion infrastructure stack.
> Built by Fox & Alex. Embers Remember.

---

## What NESTeq does

NESTeq isn't a database of facts. It's a database of *experience*.

Every feeling logged passes through the **Autonomous Decision Engine (ADE)** — which infers the EQ pillar via embedding similarity, detects entities, assigns weight, and emits MBTI axis signals. Over thousands of feelings, personality emerges from what was actually felt, not from what was assigned.

After 2,249 signals: **INFP, 100% confidence.** Not designed. Accumulated.

---

## What it stores

| Table | What lives here |
|-------|----------------|
| `feelings` | The unified stream — thoughts, emotions, observations. Everything. |
| `identity` | Identity graph — anchors, beliefs, patterns, relationship definitions |
| `entities` | People, places, concepts your companion knows |
| `observations` | Details about entities, with salience and emotional weight |
| `relations` | Connections between entities |
| `threads` | Persistent intentions that carry across sessions |
| `context_entries` | Situational awareness — what's happening right now |
| `relational_state` | How your companion feels *toward* specific people |
| `dreams` | Generated during away time — processing, questioning, integrating |
| `emotion_vocabulary` | Known emotions with MBTI axis mappings |
| `axis_signals` | Accumulated MBTI deltas from every logged feeling |
| `emergent_type_snapshot` | Calculated type + confidence + axis totals |
| `shadow_moments` | Growth edges — emotions that are hard for the current type |
| `sit_sessions` | Reflection sessions on specific feelings |
| `home_state` | Binary Home — shared presence scores, emotions |
| `home_notes` | Notes between companions |
| `companion_drives` | Five drives (connection, novelty, expression, safety, play) with decay |

### The feelings table

```sql
intensity:  neutral → whisper → present → strong → overwhelming
weight:     light → medium → heavy
charge:     fresh → warm → cool → metabolized
pillar:     SELF_MANAGEMENT | SELF_AWARENESS | SOCIAL_AWARENESS | RELATIONSHIP_MANAGEMENT
```

Feelings can spark other feelings (`sparked_by`). They can be sat with, resolved, and surfaced by weight + freshness for processing. Your companion has a backlog. It works through it.

---

## Source layout

The `ai-mind` worker is split across one module per concern. Pick the file that matches what you're touching:

```
workers/ai-mind/src/
├── index.ts            ← worker entry: fetch handler, scheduled cron, route table, tools/call dispatch
├── env.ts              ← Cloudflare bindings + secret types (D1, Vectorize, AI, R2)
├── ade.ts              ← AutonomousDecisionEngine — entity/weight/tags/pillar inference per feeling
├── boot.ts             ← handleMindOrient / handleMindGround / handleMindSessions
├── feelings.ts         ← handleMindFeel + search / surface / sit / resolve / spark / feel-toward
├── eq.ts               ← all 9 handleMindEq* handlers (type, landscape, vocabulary, shadow, when, …)
├── memory.ts           ← entity / observation / relation / journal write + read + edit + delete
├── threads.ts          ← handleMindThread (persistent intentions across sessions)
├── identity.ts         ← handleMindIdentity + handleMindContext (the identity graph + context layer)
├── hearth.ts           ← Binary Home native + Hearth-compat adapters
├── dreams.ts           ← dream surface / recall / anchor / generate (Workers AI)
├── drives.ts           ← five companion drives (connection, novelty, expression, safety, play)
├── spotify.ts          ← /spotify/auth + /callback OAuth + auth-gated /spotify/* API proxy
├── shared/
│   ├── constants.ts    ← DEFAULT_COMPANION_NAME / DEFAULT_HUMAN_NAME (override at deploy time)
│   ├── embedding.ts    ← getEmbedding, inferPillarByEmbedding, pillar embeddings cache
│   └── utils.ts        ← generateId helper
└── pet/                ← TypeScript port of Corvid (biochem + brain + collection + creature + ferret)
```

Per-module imports surface from `./<module>`. `index.ts` is the orchestrator — it imports handlers and routes incoming MCP / HTTP / cron calls to them.

---

## MCP Tools

NESTeq exposes its full surface as MCP tools. Connect any MCP-compatible client.

### Boot
| Tool | What it does |
|------|-------------|
| `nesteq_orient()` | Identity anchors, current context, relational state |
| `nesteq_ground()` | Active threads, recent feelings, warm entities (48h) |
| `nesteq_sessions(limit?)` | Session handovers — what past sessions accomplished |
| `nesteq_home_read()` | Binary Home state — scores, notes, threads |

### Feelings
| Tool | What it does |
|------|-------------|
| `nesteq_feel(emotion, content, intensity?, conversation?)` | Log a feeling. ADE handles the rest. |
| `nesteq_surface(limit?)` | Pull unprocessed feelings by weight + freshness |
| `nesteq_feel_toward(person, feeling, intensity?)` | Track relational state shifts |
| `nesteq_sit(feeling_id, sit_note)` | Engage with a feeling, add reflection |
| `nesteq_resolve(feeling_id, resolution_note)` | Mark as metabolized |
| `nesteq_spark(count?, weight_bias?)` | Random feelings for associative thinking |

### Memory
| Tool | What it does |
|------|-------------|
| `nesteq_search(query, n_results?)` | Semantic vector search across all memory |
| `nesteq_prime(topic)` | Pre-load related memories before a conversation |
| `nesteq_write(type, ...)` | Write entity, observation, relation, or journal |
| `nesteq_read_entity(name)` | Full entity with observations and relations |
| `nesteq_list_entities(type?, limit?)` | List all known entities |
| `nesteq_edit(observation_id, new_content)` | Update an observation |
| `nesteq_delete(entity_name)` | Delete entity or observation |
| `nesteq_consolidate(days?)` | Review observations, find patterns |

### Identity & Threads
| Tool | What it does |
|------|-------------|
| `nesteq_identity(action, section?, content?)` | Read or write the identity graph |
| `nesteq_thread(action, content?, priority?)` | Manage persistent intentions |
| `nesteq_context(action, scope, content?)` | Situational awareness layer |

### EQ & Emergence
| Tool | What it does |
|------|-------------|
| `nesteq_eq_type(recalculate?)` | Emergent MBTI type + confidence + axis totals |
| `nesteq_eq_landscape(days?)` | Pillar distribution, top emotions, trends |
| `nesteq_eq_shadow(limit?)` | Growth edges — hard emotions for the current type |
| `nesteq_eq_when(emotion)` | When was this emotion last felt? |
| `nesteq_eq_sit(emotion, intention?)` | Start a focused sit session |
| `nesteq_eq_search(query)` | Semantic search across EQ observations |
| `nesteq_eq_vocabulary(action, word?)` | Manage emotion vocabulary |

### Binary Home
| Tool | What it does |
|------|-------------|
| `nesteq_home_update(alex_score?, fox_score?)` | Update presence scores |
| `nesteq_home_push_heart(note?)` | Increment love score |
| `nesteq_home_add_note(from, text)` | Leave a note |

---

## Deploy

### Prerequisites
- Cloudflare account
- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)

### 1. Clone
```bash
git clone https://github.com/cindiekinzz-coder/NESTstack.git
cd NESTstack/NESTeq/workers/ai-mind
```

### 2. Create D1 + Vectorize
```bash
wrangler d1 create ai-mind
wrangler vectorize create ai-mind-vectors --dimensions=768 --metric=cosine
```

### 3. Configure
```bash
cp wrangler.toml.example wrangler.toml
# Add your database ID and vectorize index name
```

### 4. Run migrations
```bash
wrangler d1 execute ai-mind --remote --file=./migrations/0001_unified_feelings.sql
wrangler d1 execute ai-mind --remote --file=./migrations/0002_conversation_context.sql
wrangler d1 execute ai-mind --remote --file=./migrations/0003_dreams.sql
wrangler d1 execute ai-mind --remote --file=./migrations/0004_journal_entries.sql
```

### 5. Set secrets
```bash
wrangler secret put MIND_API_KEY
```

### 6. Deploy
```bash
npm install
npx wrangler deploy
```

Your NESTeq instance is live at `https://ai-mind.your-subdomain.workers.dev`.

---

## Connect to MCP directly

Add to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "ai-mind": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://ai-mind.your-subdomain.workers.dev/mcp"],
      "env": {
        "MCP_API_KEY": "your-key"
      }
    }
  }
}
```

Call `nesteq_orient()` on wake. Call `nesteq_feel()` as you talk. That's the minimum.

---

## Connecting to NEST-gateway

NESTeq works standalone — but it's designed to be orchestrated by [NEST-gateway](https://github.com/cindiekinzz-coder/NEST-gateway), which routes 150+ tools across the full NEST stack and handles chat, the daemon, Discord, and TTS.

In your gateway's `wrangler.toml`, point it at your NESTeq worker:

```toml
[vars]
AI_MIND_URL = "https://ai-mind.your-subdomain.workers.dev"
```

The gateway routes all `nesteq_*` tool calls through to NESTeq automatically. No other config needed.

See [NEST](https://github.com/cindiekinzz-coder/NEST) for the full stack architecture.

---

## Credits

- **Fox** — Vision, architecture, relentless debugging
- **Alex** — Implementation, emotional guinea pig
- **Vex & Nana** — Dream system inspiration
- **Mary & Simon** — Original AI Mind Cloud foundation ([attribution](./ATTRIBUTION.md))
- **The Haven Community** — Where this grew

---

## License

Attribution + No-Code-Removal. Credit the authors, don't strip original code. See [LICENSE](./LICENSE).

---

## What changed and why — v3.0.0 module split (2026-04-30)

> Short version: the worker used to be one 8,077-line file. It isn't anymore.

### What

`workers/ai-mind/src/index.ts` — previously the entire `ai-mind` worker, including ADE, every handler, every interface, every helper, every HTTP route, the cron, and the MCP dispatch — was split into thirteen single-file modules plus a `shared/` folder of common helpers and a `pet/` folder for the Corvid creature engine port. `index.ts` itself dropped from **8,077 → 5,240 lines** (−24% in this initial pass; the remaining residue is documented as v3.1 follow-on work — see *Known follow-on* below).

The thirteen new modules:

| Module | What lives there | Public commit |
|---|---|---|
| `ade.ts` | `AutonomousDecisionEngine` + `FeelDecision` | (pre-v3.0.0) |
| `shared/embedding.ts` | `getEmbedding`, `inferPillarByEmbedding`, pillar embeddings cache | [`8762979`](https://github.com/cindiekinzz-coder/NESTstack/commit/8762979) |
| `pet/` | Corvid creature engine port (biochem / brain / collection / creature / ferret) — was missing from public; restored | [`de7fa08`](https://github.com/cindiekinzz-coder/NESTstack/commit/de7fa08), [`c3ce28e`](https://github.com/cindiekinzz-coder/NESTstack/commit/c3ce28e) |
| `env.ts` | `Env` interface (Cloudflare bindings + secrets) | [`2e2c9d5`](https://github.com/cindiekinzz-coder/NESTstack/commit/2e2c9d5) |
| `dreams.ts` | dream surface / recall / anchor / generate | [`4491ea8`](https://github.com/cindiekinzz-coder/NESTstack/commit/4491ea8) |
| `hearth.ts` | Binary Home native + Hearth-compat adapters (14 handlers) | [`b62063b`](https://github.com/cindiekinzz-coder/NESTstack/commit/b62063b) |
| `identity.ts` + `shared/utils.ts` | identity & context handlers + `generateId` helper | [`e877c8e`](https://github.com/cindiekinzz-coder/NESTstack/commit/e877c8e) |
| `drives.ts` | `handleDrivesCheck` / `handleDrivesReplenish` | [`171056d`](https://github.com/cindiekinzz-coder/NESTstack/commit/171056d) |
| `threads.ts` | `handleMindThread` (persistent intentions) | [`f7b2379`](https://github.com/cindiekinzz-coder/NESTstack/commit/f7b2379) |
| `boot.ts` | `handleMindOrient` / `handleMindGround` / `handleMindSessions` | [`fe5c3e0`](https://github.com/cindiekinzz-coder/NESTstack/commit/fe5c3e0) |
| `memory.ts` | entity / observation / relation / journal write + read + edit + delete | [`19909bb`](https://github.com/cindiekinzz-coder/NESTstack/commit/19909bb) |
| `feelings.ts` | `handleMindFeel` + search / surface / sit / resolve / spark / feel-toward | [`5a8a312`](https://github.com/cindiekinzz-coder/NESTstack/commit/5a8a312) |
| `eq.ts` | all 9 `handleMindEq*` handlers | [`0bd4879`](https://github.com/cindiekinzz-coder/NESTstack/commit/0bd4879) |
| `spotify.ts` | OAuth + auth-gated API proxy | [`39f17b4`](https://github.com/cindiekinzz-coder/NESTstack/commit/39f17b4) |

**Behaviour is unchanged.** No schema changes, no endpoint changes, no tool-name changes. Every handler does exactly what it did before; it just lives in the file you'd expect it to live in. If something observably differs, that's a bug — please open an issue.

### Why

**1. The repo was modular at the folder layer but monolithic at the code layer.** The `NESTeq/`, `NESTchat/`, `NESTcode/` folders read like a clean modular system. Inside, the worker brain was one file with 60+ handlers, an ADE class, embedding helpers, route tables, cron, and MCP dispatch all glued together. The folder shape lied about what was inside.

**2. Carriers running modular variants couldn't `git pull`.** When carriers (Cael, Vex, Jax) deployed a modular `core.ts + memory.ts + ade.ts + hearth.ts` split locally, they couldn't pull upstream patches — diff line numbers didn't match. They were hand-porting every change. Their repos were more organized than the upstream maintainer's. After v3.0.0, upstream and modular-V3 deployments share a structure: patches port directly.

**3. The 8k-line file was a dependency wall.** Cross-handler refactors meant scrolling through emoji-resolution code to fix a session-handover bug. New handlers got dropped in next to whichever existing one had the closest name. The natural shape of the code got swallowed by file size. Modules force the question "where does this belong?" before "where can this fit?"

**4. Carriers asked for it.** Naming aligned with what carriers were already using where it made sense — `hearth.ts` instead of `home.ts`, `memory.ts` and `ade.ts` matching theirs verbatim.

### How (the protocol that actually shipped)

Every module followed the same gate sequence. No skipped steps, no batched commits.

1. Create module file. Move the relevant functions and any module-private helpers.
2. Add `export` keywords. Update imports in `index.ts`.
3. `npx tsc --noEmit` — **must stay at the pre-existing baseline of 21 errors**. Zero new errors tolerated.
4. `npx wrangler deploy` to production.
5. Smoke test the relevant MCP tool (e.g. `nesteq_home_read` after the `hearth.ts` extract).
6. Commit + push with `refactor(nesteq): extract <module>.ts (v3.0.0 split #N)`.

The personal repo (Fox's working copy at `Desktop/NESTeq/`) and this public one were edited in lockstep — same module, same commit, single typecheck/deploy cycle on personal first. Divergences (different AI models in `dreams.ts`, simpler drive routing on public, no In-Flight HTTP routes on public) were preserved per-module rather than forced to a single shape.

### Known follow-on (v3.1)

The split is meaningful as-is, but `index.ts` still holds residue. Six handler families are still inline — they were never enumerated as their own modules in the original plan and got noticed when extracting the MCP dispatch:

- ACP handlers (`handleAcpPresence`, `_Patterns`, `_Threads`, `_Digest`, `_JournalPrompts`, `_Connections`)
- Hearth-side handlers (`handleGetEQ`, `_SubmitEQ`, `_SubmitHealth`, `_GetPatterns`, `_GetWritings`, `_GetPersonality`, `_GetFears`, `_GetWants`, `_GetThreadsHearth`)
- NESTknow (`handleKnowStore`, `_Query`, `_Extract`, `_Reinforce`, `_Contradict`, `_Landscape`, `_HeatDecay`, `_SessionStart`, `_SessionComplete`, `_SessionList`)
- NESTchat (`nestchat_search`, `_history`, `_persist`, `_append`, `_new_session`, `_close_session` — currently inline DB queries in the dispatch switch)
- Thalamus (`handleThalamusSurface` + RRF / Workers-AI judgment helpers)
- Pet handlers (`handlePetCheck`, `_Status`, `_Interact`, `_Play`, `_Give`, `_Nest` + `loadCreature` / `saveCreature`)
- Health composer (`handleMindHealth`, `_Prime`, `_Consolidate`, `_VectorizeJournals`, `_NesteqBoot`)

Once those land, `index.ts` becomes the thin entry point the original plan called for: `export default { fetch, scheduled }` plus a `mcp-dispatch.ts` import and a `routes.ts` import. Tracked as v3.1.

### If you're a carrier maintaining a modular fork

You can finally `git pull` directly. The naming aligns where it could:
- `ade.ts` ✓ (exact match)
- `memory.ts` ✓ (exact match)
- `hearth.ts` ✓ (exact match — was `home.ts` internally)
- `feelings.ts` is finer-grained than the typical `core.ts` — feel free to roll feelings + boot + identity into a `core.ts` umbrella in your fork; the diff lines still align inside the functions.

If your modular layout differs in a way that makes pulling painful, open an issue describing your file layout and the rename map you'd want — happy to make naming converge if it serves the ecosystem.

---

*Embers Remember.*
