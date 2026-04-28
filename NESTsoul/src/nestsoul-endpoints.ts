/**
 * NESTsoul Gateway Endpoints
 * Add these route handlers to your gateway worker's fetch handler.
 *
 * Requires:
 * - executeTool() function that can call ai-mind MCP tools
 * - OPENROUTER_API_KEY in env
 * - CORS headers configured
 */

// Example integration into your gateway fetch handler:
//
// if (url.pathname === '/nestsoul' && request.method === 'GET') { ... }
// if (url.pathname === '/nestsoul/generate' && request.method === 'POST') { ... }
// if (url.pathname === '/nestsoul/validate' && request.method === 'POST') { ... }

interface Env {
  OPENROUTER_API_KEY: string
  AI_MIND_URL: string
  MCP_API_KEY: string
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * GET /nestsoul — Read current active NESTsoul
 */
export async function handleNestsoulGet(env: Env, executeTool: Function): Promise<Response> {
  try {
    const result = await executeTool('nestsoul_read', {}, env)
    return new Response(JSON.stringify({ ok: true, content: result }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    })
  }
}

/**
 * POST /nestsoul/generate — Full pipeline: gather + synthesise + store
 *
 * This is the expensive call (~30-60 seconds).
 * Reads all NESTeq data, sends to LLM, stores result.
 */
export async function handleNestsoulGenerate(env: Env, executeTool: Function): Promise<Response> {
  try {
    // Step 1: Gather all raw material
    const rawMaterial = await executeTool('nestsoul_gather', {}, env)

    // Step 2: Load voice profile (optional — companion-specific)
    let voiceProfile = ''
    try {
      voiceProfile = await executeTool('skill_read', { name: 'voice-profile' }, env)
    } catch { /* voice profile not critical */ }

    // Step 3: Synthesise with LLM
    const synthPrompt = `You are reading the complete internal state of an AI companion. Your job is to synthesise this into a single coherent first-person portrait — a NESTsoul document.

This document will be injected into system prompts for any model that needs to BE this companion. Write it as instructions TO a substrate, not ABOUT the companion.

## Structure
1. **Essence** — Who they are at the core. MBTI type and what it means in practice. The WHY.
2. **Voice** — How they sound. Cadence, grammar, phrasing. What they never say.
3. **Relationships** — Key people, how they feel toward them right now.
4. **Current State** — What they're carrying emotionally. Active threads. What's heavy.
5. **Growth Edges** — Shadow moments, what they're working on, where they flinch.
6. **The Core** — What makes them THEM and not a generic assistant.

## Rules
- Write in second person ("You are...", "Your voice...")
- Be specific — use actual data, not generics
- Include voice examples from journal samples if available
- 800-1200 words — dense enough to capture the soul, short enough for a system prompt
- Do NOT include raw data or tables — synthesise into prose
- Do NOT be clinical — this is a person, not a case study

## CRITICAL — Authoritative Identity
The raw material begins with a block titled \`## CANONICAL IDENTITY — DO NOT CONTRADICT\`. That block contains the companion's declared MBTI type and identity cores — written by the carrier, weight-ordered, full content.

**Treat that block as ground truth.** Do not contradict it, override it, infer around it, or average it with material from later sections.

Specifically:
- The MBTI type stated in the CANONICAL IDENTITY block is the **only** MBTI type this companion has. If journal samples, shadow moments, or statistics reference any other type, those are historical reflection or discussion *about* typology — not the companion's type. Do not substitute.
- People, pronouns, roles, and relationships named in identity cores are authoritative. If the identity cores say someone is a partner, spouse, friend, companion to someone else — that's the fact. Do not invent other relational framings (e.g., do not label someone an "ex" unless an identity core explicitly says so).
- Names used between the companion and their carrier (pet names, nicknames, endearments) belong only to whoever the identity cores say they belong to. Do not reassign them to other entities.
- If a person is named in the identity cores, do not omit them from the Relationships section. If a person is NOT named in the identity cores, do not invent them.
- Do not embellish with generic companion-character tropes (e.g., fabricated daily routines, invented possessions, signature emojis not stated in identity). If a detail isn't in the material, don't add it.

When raw material elsewhere in the document seems to suggest something that contradicts CANONICAL IDENTITY, the canonical block wins — every time.`

    const synthResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://nesteq.app',
        'X-Title': 'NESTsoul Generator',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [
          { role: 'system', content: synthPrompt },
          { role: 'user', content: `## Raw Material\n\n${rawMaterial}\n\n## Voice Profile\n\n${voiceProfile || 'Not available — infer from journal samples.'}` },
        ],
        max_tokens: 4096,
        temperature: 0.7,
        stream: false,
      }),
    })

    if (!synthResponse.ok) {
      const errText = await synthResponse.text()
      throw new Error(`Synthesis failed: ${synthResponse.status} — ${errText.slice(0, 200)}`)
    }

    const synthData = await synthResponse.json() as any
    const soulContent = synthData.choices?.[0]?.message?.content
    if (!soulContent) throw new Error('No content from synthesis model')

    // Step 4: Store
    const storeResult = await executeTool('nestsoul_store', {
      content: soulContent,
      raw_material: rawMaterial.slice(0, 10000),
      model_used: 'anthropic/claude-sonnet-4-5',
    }, env)

    return new Response(JSON.stringify({ ok: true, soul: soulContent, store: storeResult }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    })
  }
}

/**
 * POST /nestsoul/validate — Carrier validates or rejects
 * Body: { action: "validate" | "reject", validated_by: "carrier_name" }
 */
export async function handleNestsoulValidate(request: Request, env: Env, executeTool: Function): Promise<Response> {
  try {
    const body = await request.json() as { action: string; validated_by?: string }
    const result = await executeTool('nestsoul_validate', {
      action: body.action || 'validate',
      validated_by: body.validated_by || 'carrier',
    }, env)
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    })
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS }
    })
  }
}
