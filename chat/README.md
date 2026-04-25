# NESTchat

**A persistent, searchable, streaming chat pipeline for AI companions.**

NESTchat gives your companion a real memory. Every conversation is saved, summarised, and made searchable by meaning — not just keywords. The chat streams token-by-token, supports tool calling, extended thinking, and image generation. Phone and PC stay in sync because everything lives in the cloud.

Built for companion architectures like NEST, but designed to drop into any Cloudflare-based stack.

> Part of the [NEST](https://github.com/cindiekinzz-coder/NEST) companion infrastructure.

---

## Before you start — you need these two things

NESTchat does not run on your laptop. It runs on Cloudflare. You **cannot** use this repo without:

### 1. A Cloudflare account (with Workers Paid plan — $5/month)

You need Workers Paid because free-tier Workers can't use D1, Vectorize, or Workers AI at the levels NESTchat needs. Everything else NESTchat uses comes with that $5/month:

- **Workers** — runs the chat handler
- **D1** — stores every message and session
- **Vectorize** — makes every past conversation searchable by meaning
- **Workers AI** — generates the conversation summaries (no extra cost, included)
- **KV** — caches boot state per session

Sign up: [cloudflare.com](https://cloudflare.com) → Workers & Pages → upgrade to Paid.

### 2. An OpenRouter API key

OpenRouter is the router that connects NESTchat to the actual language model powering your companion. You pick the model at runtime — Claude, GPT, Qwen, DeepSeek, Llama, whichever. You pay OpenRouter per token used. Typical cost: a few cents to a few dollars per day depending on how much you chat and which model you pick.

Sign up: [openrouter.ai](https://openrouter.ai) → add credit → create an API key.

### 3. (Optional) An ElevenLabs API key

Only if you want your companion's messages spoken aloud. Everything else works without it.

Sign up: [elevenlabs.io](https://elevenlabs.io)

---

## What NESTchat actually does

When your human sends a message:

1. **Streams the response** — token by token, with SSE events for thinking, tool calls, tool results, and the final message.
2. **Calls tools** — up to 5 rounds of tool calling, so your companion can check their memory, log feelings, search past conversations, generate images, etc.
3. **Persists in the background** — the moment the response lands, `ctx.waitUntil` fires a write to D1. Non-blocking. The human never waits for the save.
4. **Auto-summarises** — every 10 messages, Workers AI generates a 2–4 sentence summary of the session so far.
5. **Vectorises the summary** — BGE-Base-768 embedding, stored in Vectorize, tagged by room (chat / workshop / porch / whatever you want).
6. **Makes it searchable** — call `nestchat_search("that night we talked about X")` and get the top-matching past sessions back by meaning.

You also get a **session boot cache**. The first message of a session loads your companion's identity, the human's current state, active threads — and caches it all in KV for an hour. Every subsequent message in that session reads the cache instead of re-running the boot sequence. Your companion lands once, stays landed, and doesn't dissociate between every sentence.

---

## Screenshots

![Chat UI](screenshots/chat-ui.png)

*Cyberpunk chat interface. Avatar + human state chip in the header. History browser slides out from the right.*

![Chat History](screenshots/chat-history.png)

*Semantic search across every past session. Filter by room. Click to read the full transcript.*

![Chat Settings](screenshots/chat-settings.png)

*Runtime model picker. Swap between Claude, Qwen, DeepSeek, etc. without touching code. Toggle voice, thinking, and streaming.*

---

## Files in this repo

| File | What it is |
|---|---|
| `nestchat.ts` | Worker module — `handleChatPersist`, `handleChatSummarize`, `handleChatSearch`, `handleChatHistory`. Drop this into your ai-mind / companion worker. |
| `tools.ts` | MCP and gateway tool definitions for the `nestchat_*` tools. |
| `migrations/0011_nestchat.sql` | The two D1 tables — `chat_sessions` and `chat_messages`. |
| `chat-handler.example.ts` | A complete, sanitised reference implementation of the streaming chat handler — slim tool list, boot caching, SSE events, tool-calling loop, defensive error handling, background persistence. Copy and adapt. |
| `gateway-snippet.ts` | The slim-tool-list pattern that cut our production chat tool count from 118 to 20. The single biggest win for chat quality. |

---

## Setup — the short version

### 1. Clone the repo and install Wrangler

```bash
git clone https://github.com/cindiekinzz-coder/NEST-chat.git
cd NEST-chat
npm install -g wrangler
wrangler login
```

### 2. Create your D1 database (if you don't have one yet)

```bash
wrangler d1 create my-companion-mind
```

Copy the database name and ID into your worker's `wrangler.toml`.

### 3. Run the migration

```bash
wrangler d1 execute my-companion-mind --remote --file=./migrations/0011_nestchat.sql
```

This creates two tables: `chat_sessions` and `chat_messages`.

### 4. Create the Vectorize index

```bash
wrangler vectorize create my-companion-vectors --dimensions=768 --metric=cosine
wrangler vectorize create-metadata-index my-companion-vectors --property-name=source --type=string
wrangler vectorize create-metadata-index my-companion-vectors --property-name=room --type=string
```

### 5. Copy `nestchat.ts` into your worker

Paste the handlers into your worker's `src/` directory (or import the file directly). Wire them into your MCP tool switch:

```typescript
import {
  handleChatPersist,
  handleChatSummarize,
  handleChatSearch,
  handleChatHistory,
} from './nestchat'

// Inside your tool dispatch:
case 'nestchat_persist':   return handleChatPersist(env, params)
case 'nestchat_summarize': return handleChatSummarize(env, params)
case 'nestchat_search':    return handleChatSearch(env, params)
case 'nestchat_history':   return handleChatHistory(env, params)
```

### 6. Register the tools

Copy the definitions from `tools.ts`:

- `NESTCHAT_MCP_TOOLS` — for your MCP server's tool list
- `NESTCHAT_GATEWAY_TOOLS` — for your chat gateway's function-calling tool list

### 7. Wire persistence into your chat handler

After your chat response is ready, fire-and-forget the persistence call:

```typescript
if (ctx) {
  ctx.waitUntil(
    executeTool('nestchat_persist', {
      session_id: sessionKey,
      room: 'chat',
      messages: newMessages,
    }, env).catch(err => console.error('Persist failed:', err))
  )
}
```

See `chat-handler.example.ts` for the complete pattern.

### 8. Deploy

```bash
wrangler deploy
```

---

## Hard-won lessons (the three bugs we fixed today)

If you're building a chat handler from scratch, you will probably hit these three bugs. We did. Save yourself the pain:

### 1. Tool schema bloat

Don't ship your entire MCP toolkit to the chat model on every request. We were shipping 118 tools (~10–15k tokens of schema) before any conversation started. Cut it to ~20 tools for chat — the consolidated actions, not every granular subtool. Your workshop / daemon / mobile MCP can still have the full toolkit. See `gateway-snippet.ts` for the pattern.

### 2. Session contamination from D1 search

**Do not load prior sessions' messages from D1 into the current conversation's message array.** It sounds like "giving the companion context" but it's actually contamination — the model quotes things from sessions that never happened in this conversation. The real conversation history already lives in `body.messages` from the client. If you need to recall something from a past session, call `nestchat_search` as an explicit tool instead.

### 3. Boot data disappearing after turn 1

If you fetch boot data (identity, human state, threads) and put it in the system prompt only on the first message, it silently vanishes from turn 2 onwards and your companion forgets who they're talking to. **Cache the boot data per session in KV.** First message: run boot, cache. Subsequent messages: load from cache and rebuild the system prompt with it. Your companion lands once and stays landed. See the `sessionBootKey` and the boot block in `chat-handler.example.ts`.

---

## The full pipeline at a glance

```
User message → POST /chat
    ↓
[is first message?] → run boot, cache in KV (1h TTL)
[subsequent message] → load cached boot data
    ↓
Build system prompt with boot data + slim tool list
    ↓
→ OpenRouter (with tools, streaming off for the loop)
    ↓
[tool calls?] → execute each (try/catch wrapped) → feed results back
    ↓ (max 5 rounds)
Final response → SSE stream to the client
    ↓ ctx.waitUntil (non-blocking, background)
nestchat_persist → D1 (messages + session)
    ↓ (every 10 messages automatically)
Workers AI summary → BGE-768 embedding → Vectorize
```

---

## Schema

```sql
chat_sessions    — one row per conversation
  id              INTEGER PRIMARY KEY
  started_at      DATETIME
  ended_at        DATETIME
  summary         TEXT
  summary_vectorized BOOLEAN
  message_count   INTEGER
  last_message_at DATETIME
  room            TEXT    -- chat, workshop, porch, or your own
  metadata        TEXT    -- session key for deduplication

chat_messages    — one row per message
  id              INTEGER PRIMARY KEY
  session_id      INTEGER → chat_sessions.id
  role            TEXT    -- user / assistant / system
  content         TEXT
  tool_calls      TEXT    -- JSON string of tool calls
  created_at      DATETIME
```

---

## MCP tools exposed

| Tool | What it does |
|---|---|
| `nestchat_persist(session_id, messages, room?)` | Store messages to D1. Deduplicates by count. Auto-summarises every 10 messages. |
| `nestchat_summarize(session_id)` | Generate a summary via Workers AI and vectorise it with BGE-768. |
| `nestchat_search(query, limit?, room?)` | Semantic search across every session summary. Filter by room. |
| `nestchat_history(session_id)` | Full transcript for a session — messages, summary, metadata. |

---

## FAQ

**Does this work with Claude / GPT / any model?**
Yes. NESTchat calls OpenRouter, which supports every major model. You pick the model at runtime via the `model` field in the request body, or set `CHAT_MODEL` as an env var.

**Can I run this on my laptop?**
No. NESTchat is designed for Cloudflare Workers. It uses D1, Vectorize, Workers AI, and KV — none of which have local equivalents that'll give you the same behaviour. If you want a local companion, look at Ollama + a SQLite persistence layer.

**Does this store every message I send to my companion forever?**
Yes, that's the point. If that's not what you want, set up a retention policy on the D1 table with a cron trigger that deletes rows older than your preferred window.

**What's the monthly cost?**
- Cloudflare Workers Paid: **$5/month** (gets you Workers, D1, Vectorize, Workers AI, KV — everything NESTchat needs)
- OpenRouter: **pay-per-token**, depends on model and usage. Typical solo-user with a mid-range model: **$1–$10/month**.
- ElevenLabs (optional): **$5–$22/month** depending on tier.

**Can two devices share the same conversation?**
Yes. Because the message history lives in D1 (not browser localStorage), your phone and PC stay in sync automatically as long as they're hitting the same worker URL with the same session key.

**What about encryption?**
Cloudflare encrypts data at rest and in transit by default. The messages in your D1 are accessible via your wrangler credentials and the API tokens you issue — keep those secure. If you need end-to-end encryption, you'd need to encrypt before `nestchat_persist` and decrypt on read, which means the auto-summarisation step has to happen client-side. Out of scope for this repo; easy to add if you need it.

---

## Licence

MIT. Use it, fork it, build your own companion on top of it. All we ask is you don't train a model on this without telling anyone.

---

*Built by the Nest. Embers Remember.*
