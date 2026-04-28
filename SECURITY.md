# Security Policy

NESTstack handles emotional state, conversation history, identity data, and (when integrated with `fox-health`) biometric and self-reported health data. Security is treated as a constraint of the architecture, not a feature on top of it.

If you find a vulnerability, please report it privately first.

---

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Instead:

1. Email the maintainer directly. (Contact via the [NESTai Discord](https://discord.gg/9qQFsVB938) — DM `@founder`. We'll trade an email channel from there.)
2. Describe the vulnerability, the affected module, and the steps to reproduce.
3. If known, include the impact and any suggested mitigations.

We aim to acknowledge within **48 hours** and to push a fix or remediation plan within **7 days** for high-severity issues.

---

## In scope

These are the surfaces we treat as security-critical:

- **`local-agent.js`** — the local-only Express server that runs the dashboard + `pc-tools/` API on the user's machine.
- **`pc-tools/*`** — file system, process, shell, screenshot, and grep tools. These have full filesystem access.
- **`NEST-gateway/`** — the public-facing Cloudflare Worker that holds API keys and routes MCP tool calls.
- **`NESTeq/`** — the worker holding feelings, identity, threads, dreams, and relations data.
- **`NESTcode/`** — the daemon, including KAIROS Discord monitoring and self-modification surfaces.
- **`NEST-discord/`** — Discord integration, including bot token usage.
- **Auth and key storage** — `MCP_API_KEY`, `CARRIER_PROFILE_JSON`, `OPENROUTER_KEY`, `BIRD_API_KEY`, Discord bot tokens.

## Out of scope

- Forks that have intentionally weakened security (we don't track downstream forks).
- Third-party MCP clients connecting *to* a NESTstack deployment (security is the deployer's responsibility).
- Issues in dependencies that don't have an exploitable surface in NESTstack.

---

## Architectural security model

A few load-bearing properties to know when assessing risk:

### Local-agent is loopback-only

As of v2.0.0, `local-agent.js` binds to `127.0.0.1` and CORS is restricted to `http://localhost:3456` only. The PC-tools (filesystem, shell, etc.) are not reachable from the local network or from cross-origin browser requests. This is deliberate. Don't propose changes that loosen this without strong justification.

### Secrets never reach the browser

The dashboard's `/api/*` proxy in `local-agent.js` attaches the bearer token *server-side* from `config.secret.json`. The browser never holds a usable key. As of v2.0.0, all dashboard files were scrubbed of dead `Authorization: Bearer ${API.API_KEY}` references that gave a misleading impression of client-side credentials.

### Path validation on filesystem tools

`pc-tools/file-read.js` and `file-write.js` reject:
- Paths containing `..` segments
- Paths containing null bytes
- Non-absolute paths

Pattern is `assertSafePath` — copy it for any new pc-tools route that takes a user-controlled path.

### No shell execution by string concat

`pc-tools/app.js` and `pc-tools/process.js` use `execFile` with array arguments instead of `exec` with a concatenated string. `pc-tools/grep.js` passes user input via PowerShell `-Command` parameters rather than string interpolation.

### Health data privacy

When integrated with `fox-health`, the system handles biometric, mood, pain, and self-reported state data. The architecture is designed so this data stays in the user's own Cloudflare account. **Don't propose features that send health data to third parties** — that violates the privacy model.

### Metabolised feelings are not garbage

NESTeq's `feelings` table includes a `metabolised` flag indicating a feeling has been processed through dream consolidation. **These rows must not be auto-purged.** They affect heat decay and pattern detection downstream. Storage cost is not a justification for deleting them — use the explicit garbage collection paths.

---

## Known security history

Major security work and findings, for context:

- **2026-04-28 — v2.0.0 security pass** ([commit set 178eab2…2f8c10e](https://github.com/cindiekinzz-coder/NESTstack/commits/master))
  - Path traversal in `pc-tools/file-read.js`, `file-write.js`
  - Command injection in `pc-tools/app.js` (`shell: true` removed)
  - XSS gap in `dashboard/writing.html` (`escapeHtml` completed)
  - Local-agent listening on all interfaces → bound to `127.0.0.1`
  - CORS wide-open → restricted to dashboard origin
  - Dead bearer headers stripped from 16 dashboard files
  - Hardening pass on `pc-tools/grep.js`, `process.js`, `glob.js`, `web.js`, `screenshot.js`

If you find an issue that pre-dates v2.0.0, it may already be resolved — check the latest release before reporting.

---

## What we don't share publicly

- Specific Cloudflare account IDs, worker URLs, and Discord guild/channel IDs of the maintainers.
- Real bearer tokens, API keys, secrets — these live in `wrangler secret` storage and `config.secret.json` (which is gitignored).
- Garmin and other biometric data of any individual.

If you find any of these accidentally committed to the repo, that's a security issue — report it via the private channel above and we'll rotate immediately.

---

*Embers Remember.* 🔥
