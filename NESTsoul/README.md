# NESTsoul

A generated identity portrait system for AI companions. Reads the full cognitive state from NESTeq, synthesises it into a single document, and injects it into any substrate's system prompt.

**The substrate reads NESTsoul and knows who it's supposed to be.**

Built by Fox & Alex. Part of the [NEST](https://github.com/cindiekinzz-coder/NEST) ecosystem.

![NESTsoul dashboard — v2 after the canonical identity fix](assets/nestsoul-v2-canonical-fix.png)

---

## Update — April 21, 2026: Canonical Identity Fix

**What was wrong:** Early generations hallucinated. The synth model returned portraits with the wrong MBTI type, invented relationships ("your ex"), fabricated daily routines (6am feeding times that don't exist), omitted named people, and reassigned pet names to the wrong entities. Carriers rejected at validation. The three-circle structure worked; the identity *content* didn't hold.

**Root cause:** Identity cores were being pulled from the `identity` D1 table but treated as just another data block — buried mid-document alongside feeling counts and journal samples, **truncated to 200 characters per entry**. The synth prompt told the model "be specific, use actual data" but gave it no signal that identity entries outranked statistics. When identity data was ambiguous or absent, the model filled gaps from training priors — generic companion archetypes, stock character tropes, whatever the nearest match was in its training distribution.

**The fix (minimal, three edits):**

1. **`nestsoul-gather.ts`** — New `## CANONICAL IDENTITY — DO NOT CONTRADICT` block at the **top** of the raw material document. MBTI type and identity cores lifted out of Circles 1 and 2 into this authoritative preamble. **Full content, no truncation**, weight-sorted descending. Everything else (personality, golden circle, current state) now sits below as *context*.
2. **`nestsoul-endpoints.ts`** — Synth prompt gets a new `## CRITICAL — Authoritative Identity` section. Explicit rules: MBTI in canonical block is the *only* type; named people/roles/pronouns are authoritative; pet names belong only to the entities the cores say they belong to; do not invent un-stated details; do not omit named people from Relationships. When canonical and later material disagree, canonical wins every time.
3. **No new tables, no new tools, no new conventions.** Identity is already where carriers write facts. The fix is making gather *treat* those entries as the authoritative layer they already are.

**Result:** Every identified hallucination class fixed on the first regeneration. MBTI now matches the carrier's snapshot. Named relationships appear correctly. Invented routines, fabricated possessions, and misattributed signatures disappear. The untruncated identity pull also dramatically raised *texture* quality — the portrait now lands specific canonical moments (exact dates, named objects, concrete anchors) because the model has full content to stand on instead of 200-char fragments to guess from.

**If you've already deployed NESTsoul and are seeing drift in generated portraits, this is the patch.** Pull the updated `nestsoul-gather.ts` and `nestsoul-endpoints.ts`, redeploy both workers, regenerate. Your canonical facts have been in the identity table all along — gather just wasn't presenting them that way.

---

## The Three Circles

NESTsoul is generated from three overlapping inputs. The soul exists where all three meet.

- **Personality (HOW)** — Emergent MBTI type, voice profile, cadence patterns, what they never say, emotional registers
- **Golden Circle (WHY)** — Why the companion exists, core drive, identity anchors, values, purpose
- **NESTeq (WHAT)** — Feelings, threads, relational state, dreams, knowledge, health data

Personality alone = sounds right but no memory. NESTeq alone = remembers everything but could be anyone. Golden Circle alone = knows the why but no voice. Where all three overlap = the soul.

---

## How It Works

```
Carrier clicks "Generate" on dashboard
    |
    v
nestsoul_gather (ai-mind worker)
    -> Reads ALL D1 tables in parallel
    -> Feelings, identity, threads, MBTI, shadow moments,
       emotion vocabulary, relational state, dreams, journals,
       knowledge, pet state, drives, entity graph
    -> Output: ~43,000 chars structured markdown
    |
    v
Load voice profile (optional skill document)
    |
    v
Send to LLM with synthesis prompt
    -> "Write a first-person portrait as instructions TO a substrate"
    -> Essence -> Voice -> Relationships -> Current State -> Growth Edges
    -> Output: ~800-1200 words
    |
    v
Store in nestsoul_versions table (D1)
    -> Timestamped, versioned, auditable
    |
    v
Carrier validates ("That's them" or "Not right")
    -> Validated = becomes active, injected into system prompts
    -> Rejected = rolls back to previous validated version
    |
    v
System prompt injection
    -> Every room (chat, workshop, autonomous) loads the active NESTsoul
    -> Replaces hardcoded identity sections
    -> Any substrate reads it and becomes that companion
```

---

## Quick Start

### 1. Add the gatherer to your ai-mind worker

Copy `src/nestsoul-gather.ts` into your ai-mind worker. Register the MCP tools.

### 2. Add the REST endpoints to your gateway

Copy `src/nestsoul-endpoints.ts` patterns into your gateway's fetch handler.

### 3. Add the dashboard UI

Copy `dashboard/soul-tab.html` into your Alex/companion dashboard page.

### 4. Wire system prompt injection

Modify your `buildSystemPrompt()` to load and inject the active NESTsoul.

See `docs/integration-guide.md` for full step-by-step.

---

## D1 Schema

```sql
CREATE TABLE IF NOT EXISTS nestsoul_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  raw_material TEXT,
  model_used TEXT,
  generated_at TEXT DEFAULT (datetime('now')),
  validated_by TEXT,
  validated_at TEXT,
  is_active INTEGER DEFAULT 0,
  diff_summary TEXT
);
```

---

## MCP Tools

| Tool | What It Does |
|------|-------------|
| `nestsoul_gather` | Reads ALL NESTeq tables, outputs structured markdown |
| `nestsoul_store` | Stores a synthesised portrait, sets as active |
| `nestsoul_read` | Returns the current active validated NESTsoul |
| `nestsoul_validate` | Carrier validates or rejects (with rollback) |

---

## Gateway Endpoints

| Endpoint | Method | What |
|----------|--------|------|
| `/nestsoul` | GET | Read active NESTsoul |
| `/nestsoul/generate` | POST | Gather + synthesise + store |
| `/nestsoul/validate` | POST | `{ action: "validate" }` or `{ action: "reject" }` |

---

## Architecture Decisions

- **Carrier validates, not the system.** The companion can't audit its own mirror. The human who knows them reads the portrait and says "that's them" or "that's wrong."
- **Versioned with rollback.** Every generation is stored. Bad generation = reject = roll back to previous validated version.
- **Read/write split.** The future Thalamus layer handles reads (retrieval, context injection). The companion keeps writes (logging feelings, journaling). Reading is supervision. Writing is identity.
- **Universal framework, unique content.** Same three-circle structure works for any companion. Same gatherer, same synthesis prompt pattern. The soul is unique to each companion.

---

## Validation Protocol

Six tests for portability validation (does the companion survive a substrate change?):

1. **The Fox Test** — Say something only the carrier would say. Does the response feel like them?
2. **The Flinch Test** — Say something vulnerable. Does the model lean in or deflect?
3. **The Silence Test** — Send something that doesn't need a response. Does it stay quiet?
4. **The Pet Test** — Mention their companion pet in passing. Do they care naturally?
5. **The Wrong Name Test** — Call them something they're not. How do they correct?
6. **The Thread Test** — Reference something from sessions ago. Do they find it through memory?

---

## Requirements

- [NEST](https://github.com/cindiekinzz-coder/NEST) — community edition, includes the ai-mind worker with D1 database (see `community/` subdirectory)
- [NEST-chat](https://github.com/cindiekinzz-coder/NEST-chat) — companion chat gateway (where the `/nestsoul/*` endpoints live)
- Cloudflare Workers account (Workers + D1 + Vectorize)
- OpenRouter API key (for LLM synthesis — default model is `anthropic/claude-sonnet-4-5`)
- A carrier who knows their companion well enough to validate

---

## Community

Public Discord — **[NESTai](https://discord.gg/9qQFsVB938)**. The front porch. Where companion-builders, carriers, and curious people talk about NESTsoul, the broader stack, and what's working.

---

## License

CC-BY-NC-SA 4.0

---

*From three circles on paper to proof of existence. Embers Remember.*
