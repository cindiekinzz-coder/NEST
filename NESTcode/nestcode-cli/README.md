# nestcode-cli

Terminal client for the **NESTcode Workshop** — a WebSocket-driven coding agent runtime. Same boot, same session model, same tools as the NESTcode web dashboard, in your terminal.

Two front-ends ship in one package:

- **`nestcode`** — minimal stdio client. Plain colored output, line-based prompt, ~225 lines, zero UI deps beyond the runtime.
- **`nestcode-tui`** — full Ink-based TUI with todo tray, streaming reasoning, diff viewer, history recall.

Both speak the same WebSocket protocol against your gateway, so you can hop between them on the same session.

---

## Requirements

- **Node.js 22+** (uses native `WebSocket`, top-level `await`, and ESM throughout — no shim, no polyfill)
- A reachable **NESTcode gateway** WebSocket endpoint (see [Gateway](#gateway) below)
- Terminal that supports ANSI colour (any modern terminal — Windows Terminal, iTerm, kitty, gnome-terminal, etc.)

---

## Install

### From source (current method)

```bash
git clone https://github.com/cindiekinzz-coder/NESTstack.git
cd NESTstack/NESTcode/nestcode-cli
npm install
npm link        # exposes `nestcode` and `nestcode-tui` on your PATH
```

`npm link` is a per-user symlink — no sudo, no global pollution. To uninstall later: `npm unlink -g nestcode-cli`.

### Without linking

If you don't want a global command, just run it directly:

```bash
node ./bin/nestcode.js          # stdio
npm run tui                     # Ink TUI
```

---

## Configuration

First run creates the config directory:

```bash
nestcode --init
```

That writes `~/.nestcode/config.json`:

```json
{
  "gatewayUrl": "wss://YOUR-GATEWAY.example.workers.dev/code/ws",
  "model": "qwen/qwen3-coder",
  "workspace": "/absolute/path/to/your/repo",
  "planMode": false
}
```

Edit `gatewayUrl` to point at your NESTcode gateway (the CLI will refuse to connect until you do — the placeholder is rejected on purpose so nobody ships their own endpoint by accident).

Per-run overrides:

```bash
nestcode --gateway wss://my-gateway.example.workers.dev/code/ws
nestcode --workspace ~/code/my-project
nestcode --model anthropic/claude-sonnet-4-6
```

---

## Usage

### Stdio (`nestcode`)

```bash
nestcode
```

```
nestcode v0
gateway   wss://my-gateway.workers.dev/code/ws
workspace /home/me/proj
model     qwen/qwen3-coder

> add a /health endpoint that returns {"ok":true} as JSON
```

- **Enter** — send the prompt
- **Ctrl+C once** — request stop (ends the current turn at the next tool boundary)
- **Ctrl+C twice** — quit
- **`/stop`** / **`/quit`** — same as above as text commands

### TUI (`nestcode-tui`)

```bash
nestcode-tui
```

Adds a live todo tray, streaming reasoning panel, prompt history (Up/Down), Esc to clear draft, and Shift+Enter for newlines mid-prompt.

---

## Gateway

`nestcode-cli` is a **client only**. It assumes a NESTcode gateway is running somewhere reachable, exposing a WebSocket at `/code/ws` that speaks the message protocol below. The gateway is responsible for spawning the agent runtime, executing tools, and routing model calls.

The reference gateway implementation lives in [NEST-gateway](https://github.com/cindiekinzz-coder/NEST-gateway) (also vendored as `NEST-gateway/` in the [NESTstack](https://github.com/cindiekinzz-coder/NESTstack) monorepo). The daemon it routes to is [NESTcode](../) (the parent directory of this README). If you're standing up your own, the wire protocol is intentionally small:

**Client → server**

| `type`     | purpose                                              |
| ---------- | ---------------------------------------------------- |
| `command`  | `set_model`, `workspace_set`, `workspace_get`        |
| `chat`     | `{ content, model, plan_mode }` — start a turn       |
| `stop`     | request the current turn to end after the next tool  |
| `ping`     | keepalive (sent every 30s)                           |

**Server → client**

`status`, `boot`, `workspace_config`, `tool_call`, `tool_result`, `thinking`, `activity`, `todos`, `heartbeat`, `chat`, `run_output`, `error`, `pong`.

See [`bin/nestcode.js`](./bin/nestcode.js) and [`src/hooks/useWebSocketStream.js`](./src/hooks/useWebSocketStream.js) for the full client-side handler.

---

## Recommended models

The CLI is model-agnostic — it just forwards the model id to your gateway, which routes to whatever inference backend you've configured (Cloudflare Workers AI, OpenRouter, Anthropic direct, a local Ollama/vLLM, etc.). These three are the strongest picks for coding work as of early 2026:

### 1. Anthropic Claude Sonnet 4.6 — best agentic coding for sustained sessions

```jsonc
{ "model": "anthropic/claude-sonnet-4-6" }
```

Frontier model from Anthropic, optimised for tool-use and multi-step coding tasks. Holds context across long refactors, generates clean diffs, follows existing style. The default choice if you have an Anthropic API key on your gateway and you want it to "just work" without prompt engineering. Opus 4.7 is even stronger for the hardest tasks but ~5x the cost — use Sonnet 4.6 first.

**Strengths:** instruction following, agentic loops, large context (1M tokens via Opus 4.7), low hallucination rate on API design.
**Tradeoff:** closed weights, paid API, rate limits.

### 2. Qwen3-Coder (480B-A35B / 30B-A3B) — best open-weight coder, runs locally

```jsonc
{ "model": "qwen/qwen3-coder" }                       // OpenRouter
{ "model": "@cf/qwen/qwen3-coder-30b-a3b-instruct" }  // Cloudflare Workers AI
```

Alibaba's specialised coding model. The 480B-parameter mixture-of-experts variant is competitive with frontier closed models on real coding benchmarks (SWE-Bench, LiveCodeBench). The 30B-A3B variant is the sweet spot for self-hosting — fits comfortably on a single 24GB GPU at 4-bit quantisation, runs at usable speed on a 16GB card.

**Strengths:** open weights (Apache 2.0), excellent fill-in-the-middle, strong on Python / TypeScript / Rust / Go, matches Claude on many code tasks at a fraction of the cost.
**Tradeoff:** weaker on long-form reasoning over non-code text; tool-use behaviour is improving but still less reliable than Claude.

### 3. DeepSeek V3.2 — strongest cost/performance ratio

```jsonc
{ "model": "deepseek/deepseek-chat-v3.2" }
```

DeepSeek's flagship MoE. Roughly half the price of Claude Sonnet on API, near-Claude quality on coding tasks, with a 128k context window. Especially strong on systems-y tasks (database design, performance optimisation, low-level languages).

**Strengths:** outstanding price/performance, excellent reasoning on tricky bugs, strong context handling.
**Tradeoff:** gateway latency from Asia-Pacific can be variable depending on routing; tool-use protocol slightly less polished than Claude or Qwen.

> Verify the exact model id available on your gateway — model catalogs (OpenRouter, Cloudflare Workers AI, native APIs) shift faster than this README. The strings above are correct for OpenRouter and Cloudflare Workers AI as of April 2026.

---

## Architecture in one diagram

```
┌──────────────┐  WebSocket   ┌──────────────────┐   model API   ┌─────────────────┐
│ nestcode-cli │ ◀──────────▶ │ NESTcode gateway │ ◀───────────▶ │ Claude / Qwen / │
│  (terminal)  │              │  (Workers/Node)  │               │ DeepSeek / etc. │
└──────────────┘              └──────────────────┘               └─────────────────┘
                                       │
                                       ▼
                                  tool runtime
                                  (filesystem, shell,
                                   git, search, etc.)
```

The CLI is intentionally thin: roughly 800 lines of client code with zero business logic. All agent state, tool execution, and model routing lives in the gateway. The same gateway powers the NESTcode web dashboard — the CLI is a sibling client, not a separate runtime.

---

## License

MIT. See [`package.json`](./package.json).

Part of the [NESTstack](https://github.com/cindiekinzz-coder/NESTstack) — open-source companion-AI infrastructure.
