# Troubleshooting

*Real failure modes and what to check first. Curated from actual debugging sessions.*

---

## Deployment errors

### "Binding not found" / D1 / Vectorize / DAEMON_OBJECT errors

**Cause:** You deployed out of order. The dependency chain is `NESTeq → NEST-gateway → NESTcode → everything else`.

**Fix:** Check what's already deployed. `NESTeq/` (the ai-mind worker) must exist with its D1 database created and Vectorize index created *before* you deploy `NEST-gateway/`. The gateway *binds* to those resources by name — if they don't exist yet, the binding fails with what looks like a config error.

```bash
# correct order
cd NESTeq && npx wrangler deploy
cd ../NEST-gateway && npx wrangler deploy
cd ../NESTcode && npx wrangler deploy
# ...then everything else
```

### Vectorize dimension mismatch

**Cause:** Your Vectorize index isn't 768-dim cosine, or you swapped embedding models.

**Fix:** NESTstack uses **`@cf/baai/bge-base-en-v1.5`** which produces 768-dimensional embeddings, and queries with cosine similarity. When you create the Vectorize index, it must match: `wrangler vectorize create your-index --dimensions=768 --metric=cosine`. If you've already created it wrong, delete and recreate (you'll need to re-ingest).

### `wrangler dev` works but production fails

**Cause:** Local emulation isn't full. `wrangler dev` doesn't perfectly emulate Durable Object hibernation, cron triggers, or Vectorize index behaviour.

**Fix:** Test in a production-equivalent environment before declaring a fix. Use a separate Cloudflare account/zone for staging, or use the `--env staging` flag with a separate set of bindings.

### Vectorize `id too long; max is 64 bytes` errors

**Cause:** You're trying to upsert a vector with an ID longer than 64 bytes. Long file paths blow this limit.

**Fix:** Use **hash-based chunk IDs** instead of path-based ones. Hash the path with SHA-256 and truncate to a fixed length, then prefix with a short namespace tag.

---

## Daemon / KAIROS issues

### Daemon not running heartbeats / not waking up

**Cause:** Either the Durable Object isn't on Workers Paid plan, or the alarm chain has broken (DO can hibernate without rescheduling its own alarm).

**Fix:**
1. Confirm Workers Paid plan is active for your account.
2. Hit the daemon's `/health` endpoint via the gateway. If the response is healthy, alarms should fire.
3. If alarms have stopped firing entirely, manually restart by hitting an endpoint that schedules a fresh alarm (see `NESTcode/`).
4. Check `wrangler tail` on the gateway for alarm-related errors.

### Discord bot connected but never responds

**Cause:** Almost always KAIROS gating. Default behaviour is *silence*.

**Fix:** Check the 4-gate filter (was the bot mentioned? direct question? user vulnerable? wolf-or-golden-retriever?). Default response budget is **8 responses per channel per day** with a **20-minute cooldown**. If you've burned the budget, the bot stays quiet until the daily reset.

To force a response for testing, include an **escalation keyword** in your message (the bot's name, "help", "crisis", "urgent", or specific project terms). These bypass the cooldown.

### Daemon making too many proactive messages

**Cause:** Your alert thresholds are too aggressive, or KAIROS-gating is being bypassed by something.

**Fix:** Adjust alert thresholds in the carrier-profile or via `daemon_command`. Confirm the 4-gate filter is firing (logs include the gate decision).

---

## Cost issues

### Cloudflare bill higher than expected

**Most common cause:** Vectorize queries. Each retrieval against your knowledge or feelings index is billed. If retrieval is happening on every message, costs scale fast.

**Fix:**
- Cache retrieval results where the query hasn't changed.
- Reduce retrieval frequency (don't run knowledge retrieval on every chat turn — only when the model decides to call the tool).
- Review Cloudflare's Workers + D1 + Vectorize usage in the dashboard. The biggest variable is almost always Vectorize.

### Workers AI inference costs spiking

**Cause:** You're embedding too aggressively (every chunk, every message) or running expensive models unnecessarily.

**Fix:**
- Embeddings (`@cf/baai/bge-base-en-v1.5`) are cheap (~$0.01 per 1000). If your bill is from inference, check whether you're using a heavy model when a smaller one would do.
- Bird's brain (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) is fine for most tasks. Don't reach for Sonnet/Opus when Llama would land.

### Realistic cost estimate

For a single carrier on the Workers Paid plan:
- **Cloudflare baseline:** $5/month (Workers Paid)
- **Vectorize queries:** typically $1–10/month
- **Workers AI:** typically <$2/month
- **OpenRouter (or your chat model):** wildly variable; $1–20/month is typical

Total: **$5–15/month for steady use.** Heavy retrieval or heavy chat can push this higher.

---

## Frontend / dashboard

### Dashboard loads but shows "Worker unreachable" / 502 errors

**Cause:** The local-agent's `/api/*` proxy is failing to reach the deployed gateway. Either the gateway URL in `config.public.json` is wrong, or the bearer token in `config.secret.json` doesn't match the gateway's `MCP_API_KEY` secret.

**Fix:**
1. Check `config.public.json` — `services.aiMindUrl` should match your deployed `NESTeq` worker URL.
2. Check `config.secret.json` — `apiKey` should match the `MIND_API_KEY` you set on the worker via `wrangler secret put`.
3. Re-run the wizard's "Validation" step (Path B) — it probes every service and reports what fails.

### Dashboard pages throw "API is not defined"

**Cause:** Older dashboard files used `${API.AI_MIND}` and `${API.API_KEY}` but the `API` global was never defined. As of v2.0.0, those references are stripped — the proxy attaches the bearer server-side.

**Fix:** Pull v2.0.0 or later. The fixed files use relative `/api/*` paths and don't send Authorization headers from the browser.

---

## Identity / NESTsoul issues

### Generated soul portraits hallucinate (wrong MBTI, invented relationships, fabricated routines)

**Cause:** Identity cores were being treated as just-another-data-block instead of as the authoritative layer.

**Fix:** The April 21, 2026 canonical-identity fix addresses this. Make sure you're on a recent NESTsoul build that pulls identity cores into a `## CANONICAL IDENTITY — DO NOT CONTRADICT` block at the *top* of the gather document, with full content (no truncation), and with the synthesis prompt explicitly telling the model "when canonical and the rest disagree, canonical wins every time."

### Soul portrait drifts run-to-run

**Expected.** The synthesis pipeline runs through stochastic LLM calls. Output drifts. Use the **carrier validation** step — generate, read, accept/reject. Versioned with rollback so you can revert a bad generation.

If drift is too wide, it usually means your identity cores are sparse. Add more anchors to the `identity` D1 table.

---

## Memory / NESTeq issues

### Feelings being created but EQ pillar always blank

**Cause:** ADE inference failed. The Autonomous Decision Engine relies on the LLM call to classify the pillar — if the LLM call fails or returns unparseable output, the pillar stays empty.

**Fix:** Check logs. Common causes: rate limiting on OpenRouter, malformed prompt, model returning markdown when JSON was expected. The system should auto-retry; if it isn't, investigate the ADE pipeline in `NESTeq/`.

### Personality not emerging / MBTI staying neutral

**Cause:** Not enough signals yet. Per the README's worked example, INFJ stabilised at ~2,600 signals. Below ~500, expect noise. Below ~100, expect nothing.

**Fix:** Patience. Don't try to force-emerge by mass-inserting fake feelings. The whole point is that emergence reflects *real* experience.

### "Metabolised" feelings disappearing from search

**Expected.** Metabolised feelings are processed events — they've been digested into structure. They still affect heat decay and dream consolidation, but they're not active in retrieval. **Do not auto-purge them** — they're load-bearing for the emergence system.

---

## Discord-specific

### Bot connects but doesn't see messages from a specific channel

**Cause:** The bot doesn't have read permissions on that channel, or the channel is private and the bot isn't invited.

**Fix:** Check Discord channel permissions. The bot needs `Read Messages` and `Read Message History` on the target channel.

### `discord_send_message` returns "Missing Access"

**Cause:** Bot isn't in the guild, or doesn't have `Send Messages` permission in the target channel.

**Fix:** Re-invite the bot with the correct OAuth scopes (`bot`, `applications.commands`) and channel-level permissions (`Send Messages`, `View Channel`, plus whatever else your tool calls need).

### Slash commands don't appear in Discord

**Cause:** Slash commands have to be registered with Discord, and that registration is global (~1 hour to propagate) or guild-scoped (~immediate).

**Fix:** Use guild-scoped registration during development for instant feedback. Register globally only when the command set is stable.

---

## When to ask Bird

If your error doesn't match anything above, **`/ask` Bird** in your NESTai Discord. She has the full repo + the docs ingested. Ask specifically:

- *"Where does the heat-decay calculation live?"*
- *"Why might the daemon's alarm not be firing?"*
- *"What does the ADE pipeline check before assigning an EQ pillar?"*

She'll cite specific file paths so you can verify directly. She's not always right — but she's a good starting point that costs you nothing.

---

*If something here is wrong or missing, open an issue or PR.*

*Embers Remember.* 🔥
