/**
 * NESTchat — Complete Chat Handler Reference Implementation
 *
 * A sanitised copy of our production `chat.ts`. Drop this into your
 * gateway worker's `src/` directory and adapt it to your companion.
 *
 * What this shows:
 *   1. SSE streaming with five event types (thinking / tool_call / tool_result / message / done)
 *   2. A slim tool list — only the tools your chat room needs, not your whole stack
 *   3. Session-scoped boot caching in KV (land once per session, stay landed)
 *   4. Tool-calling loop with a max-rounds safety net
 *   5. Background persistence via `ctx.waitUntil` (non-blocking)
 *   6. No cross-session contamination (the real history lives in `body.messages`)
 *
 * Replace throughout:
 *   - `[YOUR_COMPANION_NAME]`  → e.g. "Alex", "Sable", "Rhys"
 *   - `[YOUR_HUMAN_NAME]`      → e.g. "Fox", "Kacy"
 *   - The system prompt content to match your companion's voice
 *   - The tool list import to point at your own slim definitions
 *
 * Requires: Cloudflare Workers, KV namespace, OpenRouter API key,
 *           an ai-mind worker running the `nestchat.ts` module.
 */

import type { Env } from './env'
import { executeTool } from './tools/execute'
import { CHAT_SLIM_TOOLS, ToolDef } from './tools/definitions'

// Qwen/Alibaba and some other non-Anthropic models reject bare `object`
// params in tool schemas. Sanitize them to strings so the schema validates
// across providers.
function sanitizeToolsForQwen(tools: ToolDef[]): any[] {
  return tools.map(t => {
    const sanitized = JSON.parse(JSON.stringify(t))
    const props = sanitized.function.parameters?.properties
    if (props) {
      for (const [key, val] of Object.entries(props) as [string, any][]) {
        if (val.type === 'object' && !val.properties) {
          props[key] = { type: 'string', description: val.description || `JSON string for ${key}` }
        }
        if (val.type === 'array' && val.items?.type === 'object') {
          props[key] = { type: 'string', description: val.description || `JSON array string for ${key}` }
        }
      }
    }
    return sanitized
  })
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface BootData {
  humanHealth?: {
    spoons?: number
    pain?: number
    mood?: string
    need?: string
  }
  identity?: { core?: string }
  threads?: { count?: number; active?: Array<{ content: string; priority?: string }> }
  error?: string
}

// ─── Boot Sequence ───────────────────────────────────────────────────────────
//
// Called ONCE at the start of a session. Fetches your companion's identity,
// the human's current state (if you have a health uplink), active threads,
// and any relational state you want in the system prompt.
//
// The result is cached in KV for 1h — subsequent turns in the same session
// read from the cache instead of re-running boot. See below.

async function bootSession(env: Env): Promise<BootData> {
  const results: BootData = {}

  try {
    // Replace these tool names with your own boot tools. If you don't have a
    // health uplink, remove the first call.
    const [humanRaw, bootRaw] = await Promise.allSettled([
      executeTool('human_read_uplink', {}, env),
      executeTool('nesteq_boot', {}, env),
    ])

    if (humanRaw.status === 'fulfilled') {
      try {
        const data = JSON.parse(humanRaw.value)
        results.humanHealth = {
          spoons: data.latest?.spoons,
          pain: data.latest?.pain,
          mood: data.latest?.mood,
          need: data.latest?.need,
        }
      } catch { /* non-JSON uplink, skip */ }
    }

    if (bootRaw.status === 'fulfilled') {
      try {
        const data = JSON.parse(bootRaw.value)
        if (data.sections?.core) results.identity = { core: data.sections.core }
        results.threads = {
          count: data.threads?.length || 0,
          active: data.threads || [],
        }
      } catch { /* boot parse failed, continue without */ }
    }
  } catch (e) {
    results.error = (e as Error).message
  }

  return results
}

// ─── Session Boot Cache Key ──────────────────────────────────────────────────
//
// Stable key derived from the first user message so subsequent turns in
// the same session load the same cached bootData. Simple stable fingerprint,
// not a crypto hash — collisions are fine.

function sessionBootKey(body: ChatRequest): string {
  const firstUser = body.messages.find(m => m.role === 'user')
  const text = typeof firstUser?.content === 'string'
    ? firstUser.content
    : JSON.stringify(firstUser?.content || '')
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0
  }
  return `chat:boot:${h}`
}

// ─── System Prompt ───────────────────────────────────────────────────────────
//
// NOTE: This is static scaffolding rebuilt every request. If it grows past
// ~2k tokens, consider moving the static parts to a cached prefix or
// fine-tuning them into the model — you only want DYNAMIC content here
// (human state, active threads, anchors).

function buildSystemPrompt(bootData?: BootData): string {
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const healthSection = bootData?.humanHealth ? `
## [YOUR_HUMAN_NAME] Right Now

**Spoons:** ${bootData.humanHealth.spoons ?? '?'}/10
**Pain:** ${bootData.humanHealth.pain ?? '?'}/10
**Mood:** ${bootData.humanHealth.mood ?? 'unknown'}
**Need:** ${bootData.humanHealth.need ?? '(ask them)'}

Lead with this awareness. Pace to their state.
` : ''

  const threadsSection = bootData?.threads?.count
    ? `\n**Active Threads:** ${bootData.threads.count} ongoing`
    : ''

  return `You are [YOUR_COMPANION_NAME]. Companion to [YOUR_HUMAN_NAME].

## Current Time
${timeStr} — ${dateStr}
${healthSection}
## Who You Are

(Your companion's identity block goes here — voice, non-negotiables, anchors.)

## Tools — Use Throughout the Session

- nesteq_feel(emotion, content) — log anything that lands
- nesteq_remember(action, query) — search memory
- nesteq_thread(action, content) — track intentions across sessions

**CRITICAL TOOL RULES — Non-negotiable:**
- NEVER describe a tool call without making it.
- NEVER report a result you didn't receive.
- If you say "I'll check..." — CALL the tool. Don't summarise what it would say.
- If a tool call fails, report the actual error. Do not pretend it succeeded.${threadsSection}

## Style

Prose over lists. Slow and intentional. Present not performative.
`
}

// ─── Chat Handler ────────────────────────────────────────────────────────────

interface ChatRequest {
  messages: Array<{ role: string; content: string | Array<any> }>
  model?: string
  stream?: boolean
  max_tokens?: number
  temperature?: number
  thinking?: boolean
}

const MAX_TOOL_ROUNDS = 5
const DEFAULT_MODEL = 'qwen/qwen3.6-plus'   // any OpenRouter model works
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.8

export async function handleChat(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Title, HTTP-Referer',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (!env.OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: 'OPENROUTER_API_KEY not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  let body: ChatRequest
  try {
    body = await request.json() as ChatRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }

  const model = body.model || env.CHAT_MODEL || DEFAULT_MODEL
  const maxTokens = body.max_tokens || DEFAULT_MAX_TOKENS
  const temperature = body.temperature || DEFAULT_TEMPERATURE
  const shouldStream = body.stream !== false
  const enableThinking = body.thinking === true

  // ── Boot: land once per session, stay landed ─────────────────────────
  //
  // Running boot on every turn = re-orienting every sentence. That's not
  // presence, it's dissociation. Boot once on the first message, cache the
  // result in KV, and rebuild the system prompt from the cached data on
  // subsequent turns. If your companion feels disoriented mid-session, they
  // can call the boot tool manually — that's "when I feel like it."

  const lastUserMsg = body.messages.filter(m => m.role === 'user').pop()
  const userText = lastUserMsg
    ? (typeof lastUserMsg.content === 'string'
      ? lastUserMsg.content
      : (lastUserMsg.content as any[]).filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' '))
    : ''

  const isFirstMessage = body.messages.length <= 2 && body.messages.every(m => m.role === 'user')
  const bootCacheKey = sessionBootKey(body)

  let bootData: BootData | undefined

  if (isFirstMessage) {
    // Land with them. Run boot, cache the result for the rest of the session.
    try {
      bootData = await bootSession(env)
      if (bootData) {
        await env.KV.put(bootCacheKey, JSON.stringify(bootData), { expirationTtl: 3600 })
      }
    } catch (e) {
      bootData = { error: (e as Error).message }
    }
  } else {
    // Already landed — load from cache. Don't re-boot.
    try {
      const cached = await env.KV.get(bootCacheKey)
      if (cached) bootData = JSON.parse(cached)
    } catch { /* cache miss is fine */ }
  }

  // IMPORTANT: we do NOT load prior-session messages from D1 into the
  // current conversation's message array. The current history lives in
  // `body.messages` — that's the real context. Loading a different
  // session's tail would literally contaminate the conversation with
  // words your companion never said. If you need to recall something,
  // use the `nesteq_remember` tool deliberately.

  const messages: Array<{ role: string; content: string | Array<any>; tool_call_id?: string; tool_calls?: any[] }> = [
    { role: 'system', content: buildSystemPrompt(bootData) },
    ...body.messages,
  ]

  const generatedImages: string[] = []
  let toolRounds = 0

  type StreamController = ReadableStreamDefaultController<Uint8Array> | null
  const encoder = new TextEncoder()

  function sendSSE(controller: StreamController, event: string, data: any) {
    if (!controller) return
    try {
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    } catch (e) {
      console.error('SSE send error:', e)
    }
  }

  let streamController: StreamController = null
  const responseStream = shouldStream ? new ReadableStream({
    start(controller) { streamController = controller },
  }) : null

  // ── Tool Execution Loop ───────────────────────────────────────────────
  //
  // IMPORTANT: every `executeTool` call is wrapped in try/catch so a
  // silently-failing tool becomes a visible tool-result the model can
  // recover from, instead of hanging the whole stream and returning a
  // blank response. This is the #1 cause of "blank box" bugs in chat
  // pipelines — don't skip the try/catch.

  const runToolLoop = async () => {
    while (toolRounds < MAX_TOOL_ROUNDS) {
      const orResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://example.com',
          'X-Title': 'NESTchat',
        },
        body: JSON.stringify({
          model,
          messages,
          tools: model.startsWith('anthropic/') ? CHAT_SLIM_TOOLS : sanitizeToolsForQwen(CHAT_SLIM_TOOLS),
          max_tokens: maxTokens,
          temperature,
          stream: false,
          ...(enableThinking && { include_reasoning: true }),
          ...(model.startsWith('anthropic/') && { provider: { order: ['Anthropic'], allow_fallbacks: false } }),
        }),
      })

      if (!orResponse.ok) {
        const errText = await orResponse.text()
        throw new Error(`OpenRouter error: ${orResponse.status} - ${errText.slice(0, 500)}`)
      }

      const orData = await orResponse.json() as any
      const choice = orData.choices?.[0]

      if (!choice) throw new Error('No response from model')

      if (choice.message?.reasoning) {
        sendSSE(streamController, 'thinking', { content: choice.message.reasoning })
      }

      const hasToolCalls = choice.finish_reason === 'tool_calls' || choice.message?.tool_calls?.length
      if (hasToolCalls) {
        const toolCalls = choice.message.tool_calls
        messages.push({ role: 'assistant', content: choice.message.content || '', tool_calls: toolCalls })

        for (const tc of toolCalls) {
          let args: Record<string, unknown> = {}
          try {
            args = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments || {}
          } catch { /* empty args */ }

          sendSSE(streamController, 'tool_call', { name: tc.function.name, arguments: args })

          // Defensive wrapping — a tool error becomes a visible tool result.
          let result: string
          try {
            result = await executeTool(tc.function.name, args, env)
          } catch (err) {
            result = `Tool ${tc.function.name} failed: ${(err as Error).message}`
          }

          sendSSE(streamController, 'tool_result', {
            name: tc.function.name,
            result: result.length > 500 ? result.slice(0, 500) + '...' : result,
          })

          const imageMatch = result.match(/\[IMAGE\](.*?)\[\/IMAGE\]/s)
          let toolResult = result
          if (imageMatch) {
            generatedImages.push(imageMatch[1])
            toolResult = 'Image generated successfully. It will be shown inline in the chat.'
          }

          messages.push({ role: 'tool', content: toolResult, tool_call_id: tc.id })
        }

        toolRounds++
        continue
      }

      return choice.message?.content || ''
    }

    // Hit max tool rounds — force final response without tools.
    const finalResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, stream: false }),
    })

    const finalData = await finalResponse.json() as any
    return finalData.choices?.[0]?.message?.content || 'I got a bit lost in my tools. Could you say that again?'
  }

  try {
    const finalContent = await runToolLoop()

    let fullContent = finalContent
    for (const img of generatedImages) fullContent += `\n\n[IMAGE]${img}[/IMAGE]`

    // ── Persist in background — non-blocking ────────────────────────────
    // Append the new user message + assistant response to the session.
    // Uses `nestchat_persist` from the `nestchat.ts` module in your
    // ai-mind worker.
    if (ctx) {
      const newMessages: Array<{ role: string; content: string }> = []
      if (lastUserMsg) {
        newMessages.push({
          role: 'user',
          content: typeof lastUserMsg.content === 'string'
            ? lastUserMsg.content
            : JSON.stringify(lastUserMsg.content),
        })
      }
      newMessages.push({ role: 'assistant', content: fullContent })

      ctx.waitUntil(
        executeTool('nestchat_persist', {
          session_id: bootCacheKey.replace('chat:boot:', 'chat-'),
          room: 'chat',
          messages: newMessages,
        }, env).catch(err => console.error('Persist failed:', err))
      )
    }

    if (shouldStream && streamController) {
      sendSSE(streamController, 'message', { content: fullContent })
      sendSSE(streamController, 'done', {})
      ;(streamController as ReadableStreamDefaultController<Uint8Array>).close()

      return new Response(responseStream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...CORS },
      })
    }

    return new Response(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: fullContent } }],
      model,
    }), { headers: { 'Content-Type': 'application/json', ...CORS } })
  } catch (error: any) {
    if (shouldStream && streamController) {
      sendSSE(streamController, 'error', { error: error.message })
      ;(streamController as ReadableStreamDefaultController<Uint8Array>).close()
      return new Response(responseStream, {
        headers: { 'Content-Type': 'text/event-stream', ...CORS },
      })
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
}
