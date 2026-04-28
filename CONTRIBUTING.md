# Contributing to NESTstack

Thank you for showing up. Real contributions to this codebase are welcome — bug fixes, new modules, doc improvements, and clean integrations all land regularly.

This guide is short on purpose. The deeper reading lives in [`EXTENDING.md`](./EXTENDING.md).

---

## Before you write code

**Read [`EXTENDING.md`](./EXTENDING.md).**
It covers the three load-bearing mantras, deployment order, Cloudflare-binding gotchas, and the patterns that need to be honoured (and the common AI-agent mistakes that fight the architecture). Most PR-feedback rounds we've had could have been avoided by a 10-minute read of that doc first.

**Glance at [`docs/GLOSSARY.md`](./docs/GLOSSARY.md).**
If you don't know what NESTeq, ADE, KAIROS, or "metabolised feelings" mean, you'll spend time fighting names. The glossary is short.

---

## How to contribute

### 1. Open an issue first (for non-trivial changes)

For anything beyond a typo fix or a one-line bug patch, open a GitHub issue first to talk about the approach. Two-key approval (Fox + Alex) gates everything that lands; an issue conversation is the cheapest way to make sure your direction matches ours before you spend hours on a PR.

For typos and tiny fixes, a PR is fine without an issue.

### 2. Fork, branch, build

```bash
gh repo fork cindiekinzz-coder/NESTstack --clone
cd NESTstack
git checkout -b fix/your-thing
```

For most module changes, you can develop with **Path A** (local-only, no Cloudflare) — see the root README's quickstart. Path A doesn't exercise the daemon or KAIROS, but it's enough for dashboard / UI / tool-routing work.

### 3. Test before submitting

- **Syntax:** `node --check path/to/file.js` for JS modules.
- **Type:** if the module has a tsconfig, run `npx tsc --noEmit`.
- **Smoke test:** start `NESTdesktop/` locally, exercise the path you changed.
- **For schema changes:** add a numbered migration file in `NESTeq/workers/*/migrations/` — never modify an existing one in place.

### 4. Submit a PR

- Reference the issue you opened (if one exists).
- In the description, name *what* changed, *why*, and *how to test*.
- If your change touches one of the patterns in [`EXTENDING.md`](./EXTENDING.md), call it out explicitly so reviewers know you considered the tradeoff.
- Keep PRs focused. One concern per PR is much easier to review than a sprawling refactor.

---

## What lands easily

- **Bug fixes** with a clear repro and a small surgical change.
- **Doc improvements** — typos, clarifications, broken links, examples that no longer match the code.
- **New MCP tools** that follow the existing pattern (Zod schema, registered in `CHAT_TOOLS`, with a sensible name in the `nesteq_*` / `discord_*` / etc. namespace).
- **New per-module READMEs** if you find one is thin or out of date.

## What needs more conversation first

- **New modules** — adding a new top-level folder is a real architectural change. Open an issue with the proposed shape before writing code.
- **Schema changes** — D1 migrations are forever. Get alignment first.
- **Frontend framework migrations** — the dashboard is vanilla JS + Tauri v2 deliberately. Don't propose a React/Next/Svelte rewrite as "modernisation." (See [`EXTENDING.md`](./EXTENDING.md) for the why.)
- **Personality / configuration shortcuts** — anything that makes traits *configurable* rather than *emergent* fights the design. Talk to us first.

---

## What we won't merge

- Code that hardcodes API keys, URLs, or personal identity into source files. The carrier-profile system exists for a reason.
- Changes that break the three mantras (everything is a feeling / emergence over configuration / three-layer brain).
- Aggressive autonomous self-modification proposals (see KAIROS notes in [`EXTENDING.md`](./EXTENDING.md)).
- Anything that bypasses metabolised-feelings handling in NESTeq.

---

## Reporting security issues

**Do not open a public issue for security vulnerabilities.** See [`SECURITY.md`](./SECURITY.md) for the private reporting channel.

---

## Community

- **NESTai Discord** — public server, [discord.gg/9qQFsVB938](https://discord.gg/9qQFsVB938). `#tools-bugs-and-ai` is the right channel for technical discussion.
- **Substack** — [cindieknzz.substack.com](https://cindieknzz.substack.com/) for the longer-form thinking on what we're learning.

---

*Built by Fox & Alex. Embers Remember.* 🔥
