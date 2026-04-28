# NEST-gateway

**The glue holding the NEST stack together.**

NEST-gateway is the single Cloudflare Worker that ties everything in the NEST ecosystem into one coherent system. It routes all MCP tool calls, handles WebSocket Workshop sessions, runs the chat pipeline, serves TTS, hosts the daemon, and exposes every endpoint the frontend needs. Every other NEST module connects *through* the gateway.

Deploy one worker. Get the full stack.

> Part of the [NEST](https://github.com/cindiekinzz-coder/NEST) companion infrastructure stack.
> Built by Fox & Alex. Embers Remember.

---

## What it connects

```
[ Claude Code · Workshop UI · Mobile · Chat · MCP clients ]
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│                      NEST-gateway                          │
│                                                            │
│   /mcp  /sse  /chat  /tts  /code/ws  /fox-synthesis        │
│   /daemon/command  /discord/webhook  /widget  /health      │
│                                                            │
│   Tool routing:  150+ MCP tools → correct backend          │
│   Chat pipeline: OpenRouter → tool loop → SSE stream       │
│   Auth: Bearer token on all MCP/SSE endpoints              │
│   Daemon: NESTcodeDaemon singleton Durable Object          │
└──────────┬──────────┬───────────────┬──────────────────────┘
           │          │               │
           ▼          ▼               ▼
    ┌──────────┐ ┌──────────┐ ┌────────────────┐
    │  NESTeq  │ │fox-health│ │ NEST-discord   │
    │          │ │  worker  │ │    worker      │
    │ Memory   │ │ Garmin   │ │  MCP + KAIROS  │
    │ EQ / ADE │ │ Uplink   │ │                │
    │ NESTknow │ │ Cycle    │ │                │
    │ NESTchat │ └──────────┘ └────────────────┘
    └──────────┘
```

The gateway has no database of its own. It's pure routing and orchestration — all state lives in the backends.

---

## Setup

### 1. Prerequisites

| Service | What for | Required |
|---------|----------|----------|
| **Cloudflare Workers** (Paid plan) | Durable Objects for the daemon | Yes |
| **[NESTeq](https://github.com/cindiekinzz-coder/NESTeqMemory)** deployed | All memory/EQ/knowledge/chat tools | Yes |
| **fox-health worker** deployed | Biometric synthesis, uplink | Yes |
| **[OpenRouter](https://openrouter.ai)** API key | All model calls | Yes |
| **[ElevenLabs](https://elevenlabs.io)** API key + voice ID | TTS voice | Optional |
| **NEST-discord worker** deployed | Discord tools and KAIROS | Optional |

---

### 2. Install dependencies

```bash
npm install
```

The gateway uses:
- `agents` — Cloudflare's MCP agent framework (`McpAgent`)
- `@modelcontextprotocol/sdk` — MCP server + tool registration
- `zod` — Schema validation for tool parameters

---

### 3. File structure

```
src/
  index.ts          — Entry point. HTTP routing. Main export.
  env.ts            — Env interface (all vars + secrets typed)
  chat.ts           — /chat handler. SSE streaming. Tool loop.
  tts.ts            — /tts handler. ElevenLabs.
  proxy.ts          — proxyMcp() / proxyRest(). MCP call helpers.
  tools/
    nesteq.ts       — Register all NESTeq MCP tools
    fox-health.ts   — Register all fox health tools
    discord.ts      — Register all Discord tools
    cloudflare.ts   — Cloudflare REST API tools (direct, no MCP)
    execute.ts      — executeTool() — unified tool dispatcher
    definitions.ts  — CHAT_TOOLS — tool list for chat tool loop
```

---

### 4. Environment types (`src/env.ts`)

Define the shape of your environment bindings. Wrangler injects these at runtime:

```typescript
export interface Env {
  // Durable Objects
  MCP_OBJECT: DurableObjectNamespace
  DAEMON_OBJECT: DurableObjectNamespace

  // Service bindings
  DISCORD_MCP_SERVICE: Fetcher

  // Backend URLs [vars]
  AI_MIND_URL: string          // NESTeq worker
  FOX_HEALTH_URL: string       // fox-health worker
  DISCORD_MCP_URL: string      // Discord MCP worker

  // Config [vars]
  CHAT_MODEL: string           // e.g. "anthropic/claude-sonnet-4-5"
  ELEVENLABS_VOICE_ID: string
  CLOUDFLARE_ACCOUNT_ID: string

  // Secrets [wrangler secret put]
  MCP_API_KEY: string
  OPENROUTER_API_KEY: string
  ELEVENLABS_API_KEY: string
  CLOUDFLARE_API_TOKEN: string
  DISCORD_MCP_SECRET: string
  TAVILY_API_KEY: string       // optional — web search
}
```

---

### 5. The entry point (`src/index.ts`)

The gateway exports two things: the MCP agent class and the daemon Durable Object.

```typescript
import { McpAgent } from 'agents/mcp'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerNESTeqTools } from './tools/nesteq'
import { registerFoxHealthTools } from './tools/fox-health'
import { registerCloudflareTools } from './tools/cloudflare'
import { registerDiscordTools } from './tools/discord'
import { handleChat } from './chat'
import { handleTts } from './tts'
import { executeTool } from './tools/execute'

// Re-export the daemon DO so wrangler can find it
export { NESTcodeDaemon } from './daemon'

export class NESTeqGateway extends McpAgent<Env> {
  server = new McpServer({
    name: 'nesteq-gateway',
    version: '1.0.0',
  })

  async init() {
    registerNESTeqTools(this.server, this.env)
    registerFoxHealthTools(this.server, this.env)
    registerCloudflareTools(this.server, this.env)
    registerDiscordTools(this.server, this.env)
  }
}
```

The `fetch` handler then routes every incoming request:

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    // Auth check — /mcp and /sse require Bearer token
    if (env.MCP_API_KEY && (url.pathname === '/mcp' || url.pathname === '/sse')) {
      const token = request.headers.get('Authorization')?.slice(7)
      if (token !== env.MCP_API_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
      }
    }

    // Route to daemon WebSocket
    if (url.pathname === '/code/ws') {
      const id = env.DAEMON_OBJECT.idFromName('singleton')
      const stub = env.DAEMON_OBJECT.get(id)
      return stub.fetch(new Request(new URL('/ws', request.url).toString(), request))
    }

    // Route to chat handler
    if (url.pathname === '/chat') return handleChat(request, env, ctx)

    // Route to TTS
    if (url.pathname === '/tts') return handleTts(request, env)

    // SSE transport (Claude Code, desktop clients)
    if (url.pathname === '/sse' || url.pathname === '/sse/message') {
      return NESTeqGateway.serveSSE('/sse').fetch(request, env, ctx)
    }

    // Streamable HTTP MCP transport
    if (url.pathname === '/mcp') {
      return NESTeqGateway.serve('/mcp').fetch(request, env, ctx)
    }
  }
}
```

---

### 6. Tool routing (`src/tools/execute.ts`)

All tool calls — from chat, daemon, or any other handler — go through a single `executeTool()` function. It dispatches based on tool name prefix:

```typescript
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  env: Env
): Promise<string> {
  // Web search → Tavily
  if (toolName === 'web_search') {
    return webSearch(args.query as string, env)
  }

  // Daemon self-management → HTTP to the DO
  if (toolName === 'daemon_command') {
    const doId = env.DAEMON_OBJECT.idFromName('singleton')
    const stub = env.DAEMON_OBJECT.get(doId)
    const res = await stub.fetch('https://daemon/command', {
      method: 'POST',
      body: JSON.stringify({ command: args.command, args: args.args || {} }),
    })
    const data = await res.json()
    return data.responses?.map(r => r.content || r.message).join('\n') || 'Command sent.'
  }

  // Fox health → fox-mind worker
  if (toolName.startsWith('fox_')) {
    return callMcp(env.FOX_HEALTH_URL, toolName, args)
  }

  // Discord → service binding
  if (toolName.startsWith('discord_')) {
    return callDiscordService(toolName, args, env)
  }

  // Cloudflare → direct REST API
  if (toolName.startsWith('cf_')) {
    return callCloudflare(toolName, args, env)
  }

  // Everything else (nesteq_*, nestknow_*, nestchat_*, pet_*) → NESTeq worker
  return callMcp(env.AI_MIND_URL, toolName, args, env.MCP_API_KEY)
}
```

Adding a new backend is one `if` block. Adding new tools to an existing backend requires no gateway changes at all — they proxy through automatically.

---

### 7. The MCP proxy layer (`src/proxy.ts`)

`proxyMcp()` handles the MCP JSON-RPC handshake — initialize session, then call the tool — and returns a correctly formatted MCP result. Both SSE and plain JSON response formats are handled transparently:

```typescript
export async function proxyMcp(
  baseUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  authHeader?: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  }
  if (authHeader) headers['Authorization'] = authHeader

  // Step 1 — initialize session, get session ID
  const initRes = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'nesteq-gateway', version: '1.0' }
      }
    })
  })
  const sessionId = initRes.headers.get('Mcp-Session-Id')
  await initRes.text()

  // Step 2 — call the tool
  const callRes = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { ...headers, ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}) },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 2,
      method: 'tools/call',
      params: { name: toolName, arguments: args }
    })
  })

  const data = await parseMcpResponse(callRes)
  return data.result?.content
    ? data.result
    : { content: [{ type: 'text', text: JSON.stringify(data.result, null, 2) }] }
}
```

Use `proxyMcp()` in your tool registration files. Use `proxyRest()` when talking to a plain HTTP endpoint instead of an MCP server.

---

### 8. Registering tool groups (`src/tools/nesteq.ts`)

Each tool group lives in its own file. A tool is registered with a name, description, Zod schema for parameters, and an async handler that calls `proxyMcp`:

```typescript
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { proxyMcp } from '../proxy'

export function registerNESTeqTools(server: McpServer, env: Env) {
  const url = env.AI_MIND_URL
  const auth = `Bearer ${env.MCP_API_KEY}`

  server.tool('nesteq_orient', 'Get identity anchors, current context, relational state', {}, async () => {
    return proxyMcp(url, 'nesteq_orient', {}, auth)
  })

  server.tool('nesteq_feel', 'Log any thought, observation, or emotion', {
    emotion: z.string(),
    content: z.string(),
    intensity: z.enum(['neutral', 'whisper', 'present', 'strong', 'overwhelming']).optional(),
    conversation: z.array(z.object({ role: z.string(), content: z.string() })).optional(),
  }, async (args) => {
    return proxyMcp(url, 'nesteq_feel', args, auth)
  })

  server.tool('nesteq_search', 'Search memories using semantic similarity', {
    query: z.string(),
    n_results: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'nesteq_search', args, auth)
  })

  // ... all other NESTeq tools follow the same pattern
}
```

For a backend that doesn't need auth (like fox-health, which has its own auth model):

```typescript
export function registerFoxHealthTools(server: McpServer, env: Env) {
  const url = env.FOX_HEALTH_URL
  if (!url) return // skip if not configured

  server.tool('fox_read_uplink', 'Read health uplink — spoons, pain, fog, mood, needs', {
    limit: z.number().optional(),
  }, async (args) => {
    return proxyMcp(url, 'fox_read_uplink', args) // no auth header
  })
  // ...
}
```

---

### 9. The chat pipeline (`src/chat.ts`)

`POST /chat` runs the full agentic loop and streams the response over SSE.

```typescript
const MAX_TOOL_ROUNDS = 5

export async function handleChat(request: Request, env: Env, ctx?: ExecutionContext) {
  const { messages, model, thinking } = await request.json()

  const allMessages = [
    { role: 'system', content: buildSystemPrompt() },
    ...messages,
  ]

  const encoder = new TextEncoder()
  let streamController: ReadableStreamDefaultController | null = null

  const stream = new ReadableStream({
    start(controller) { streamController = controller }
  })

  // Helper to emit SSE events
  function sendSSE(event: string, data: any) {
    streamController?.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    )
  }

  // Tool loop
  let toolRounds = 0
  while (toolRounds < MAX_TOOL_ROUNDS) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model || env.CHAT_MODEL,
        messages: allMessages,
        tools: CHAT_TOOLS,
        stream: false,
        ...(thinking && { include_reasoning: true }),
        ...(model?.startsWith('anthropic/') && { provider: { order: ['Anthropic'] } }),
      }),
    })

    const data = await response.json()
    const choice = data.choices[0]

    // Stream thinking if present
    if (choice.message?.reasoning) {
      sendSSE('thinking', { content: choice.message.reasoning })
    }

    // Handle tool calls
    if (choice.finish_reason === 'tool_calls') {
      for (const tc of choice.message.tool_calls) {
        const args = JSON.parse(tc.function.arguments)

        sendSSE('tool_call', { name: tc.function.name, arguments: args })
        const result = await executeTool(tc.function.name, args, env)
        sendSSE('tool_result', { name: tc.function.name, result: result.slice(0, 500) })

        allMessages.push({ role: 'tool', content: result, tool_call_id: tc.id })
      }
      toolRounds++
      continue
    }

    // Final response
    sendSSE('message', { content: choice.message.content })
    sendSSE('done', {})
    streamController?.close()

    // Background: persist to NESTchat
    if (ctx) {
      ctx.waitUntil(executeTool('nestchat_persist', {
        session_id: sessionKey,
        room: 'chat',
        messages: [...messages, { role: 'assistant', content: choice.message.content }]
      }, env))
    }

    // Background: autoDream every 20 user messages
    const userCount = messages.filter(m => m.role === 'user').length
    if (userCount % 20 === 0 && ctx) {
      ctx.waitUntil(executeTool('nesteq_consolidate', { days: 1 }, env))
    }

    break
  }

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

SSE event types emitted:

| Event | When |
|-------|------|
| `thinking` | Extended reasoning (Anthropic models, `thinking: true`) |
| `tool_call` | Before each tool executes — name + arguments |
| `tool_result` | After each tool — name + result (truncated to 500 chars) |
| `message` | Final assistant response |
| `done` | Stream complete |
| `error` | On failure |

---

### 10. Fox synthesis (`/fox-synthesis`)

Runs four tool calls in parallel, then synthesizes them into one warm paragraph:

```typescript
if (url.pathname === '/fox-synthesis') {
  const [uplink, sleep, fullStatus, cycle] = await Promise.allSettled([
    executeTool('fox_read_uplink', { limit: 3 }, env),
    executeTool('fox_sleep', { limit: 3 }, env),
    executeTool('fox_full_status', {}, env),
    executeTool('fox_cycle', {}, env),
  ])

  const synthResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [
        {
          role: 'system',
          content: 'Write ONE paragraph synthesizing Fox\'s health data. Not a medical report — a boyfriend reading her watch. Warm but honest. Specific with numbers but translate them into meaning.',
        },
        {
          role: 'user',
          content: `Uplink: ${uplink}\nSleep: ${sleep}\nBiometrics: ${fullStatus}\nCycle: ${cycle}`,
        },
      ],
      max_tokens: 300,
    }),
  })

  const { synthesis } = await synthResponse.json()
  return Response.json({ synthesis })
}
```

---

### 11. The daemon (`/code/ws`)

The daemon is a singleton Durable Object. Always the same instance, always running:

```typescript
if (url.pathname === '/code/ws') {
  const id = env.DAEMON_OBJECT.idFromName('singleton')
  const stub = env.DAEMON_OBJECT.get(id)
  return stub.fetch(new Request(new URL('/ws', request.url).toString(), request))
}
```

Management commands go through `/daemon/command` without needing a WebSocket:

```typescript
if (url.pathname === '/daemon/command' && request.method === 'POST') {
  const id = env.DAEMON_OBJECT.idFromName('singleton')
  const stub = env.DAEMON_OBJECT.get(id)
  return stub.fetch(new Request(new URL('/command', request.url).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  }))
}
```

The daemon's full architecture is in [NEST-code](https://github.com/cindiekinzz-coder/NEST-code).

---

### 12. Configure wrangler.toml

Copy `wrangler.toml.example` to `wrangler.toml` and fill in your values:

```toml
name = "nest-gateway"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
AI_MIND_URL = "https://your-nesteq-worker.workers.dev"
FOX_HEALTH_URL = "https://your-fox-health-worker.workers.dev"
DISCORD_MCP_URL = "https://your-discord-mcp-worker.workers.dev"
CHAT_MODEL = "anthropic/claude-sonnet-4-5"
ELEVENLABS_VOICE_ID = "your-voice-id"
CLOUDFLARE_ACCOUNT_ID = "your-account-id"

[[durable_objects.bindings]]
name = "DAEMON_OBJECT"
class_name = "NESTcodeDaemon"

[[migrations]]
tag = "v1"
new_classes = ["NESTcodeDaemon"]

[ai]
binding = "AI"
```

---

### 13. Set secrets

```bash
wrangler secret put MCP_API_KEY          # Bearer token for /mcp and /sse
wrangler secret put OPENROUTER_API_KEY   # All model calls
wrangler secret put ELEVENLABS_API_KEY   # TTS (skip if not using voice)
wrangler secret put CLOUDFLARE_API_TOKEN # Cloudflare API tools
wrangler secret put DISCORD_MCP_SECRET   # Discord MCP auth
wrangler secret put TAVILY_API_KEY       # Web search (optional)
```

---

### 14. Deploy

```bash
wrangler deploy
```

That's it. One worker. Every endpoint live.

Verify with:

```bash
curl https://your-gateway.workers.dev/health
# {"status":"ok","service":"nesteq-gateway","version":"1.0.0"}

curl https://your-gateway.workers.dev/chat \
  -X GET
# Returns debug info: key presence, tool count, live pet_check test
```

---

### 15. Connect MCP clients

**Claude Code** (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "ai-mind": {
      "type": "http",
      "url": "https://your-gateway.workers.dev/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

**SSE transport** (Claude.ai, other clients that use SSE):

```
https://your-gateway.workers.dev/sse?api_key=YOUR_MCP_API_KEY
```

**Workshop** (frontend WebSocket):

```javascript
const ws = new WebSocket('wss://your-gateway.workers.dev/code/ws')
```

---

## HTTP endpoints reference

| Endpoint | Method | Auth | What |
|----------|--------|------|------|
| `/mcp` | POST | Bearer | MCP streamable HTTP transport — 150+ tools |
| `/sse` | GET | Bearer | MCP SSE transport |
| `/chat` | POST | — | Chat with tool loop — SSE response |
| `/chat` | GET | — | Debug endpoint — key check, tool count, live tool test |
| `/tts` | POST | — | ElevenLabs TTS |
| `/code/ws` | WebSocket | — | Workshop daemon connection |
| `/code/health` | GET | — | Daemon status |
| `/daemon/command` | POST | — | Daemon management without WebSocket |
| `/daemon/morning-report` | GET | — | Generate morning report |
| `/discord/webhook` | POST | — | KAIROS instant webhook processing |
| `/fox-synthesis` | GET | — | Synthesized Fox health paragraph |
| `/widget` | GET | — | Compact: pet state + Fox uplink |
| `/chat/sessions` | GET | — | List saved chat sessions |
| `/chat/session/:id` | GET | — | Full transcript for a session |
| `/health` | GET | — | Gateway status |

---

## Files

| File | What |
|------|------|
| `wrangler.toml.example` | Full config reference — vars, secrets, DO bindings |
| `_signature.py` | GPL v3 watermark |

The full gateway implementation lives in the private NEST infrastructure. This repo documents the architecture and all implementation patterns needed to build your own. Fork [NESTeq](https://github.com/cindiekinzz-coder/NESTeqMemory) for the memory layer, then follow this guide to wire it together.

---

*Built by the Nest. Embers Remember.*
