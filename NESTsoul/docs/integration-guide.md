# NESTsoul Integration Guide

Step-by-step guide for adding NESTsoul to your NESTeq V3 setup.

---

## Prerequisites

- NESTeq V3 ai-mind worker deployed with D1 database
- Gateway worker with tool execution capability
- Dashboard (Pages) deployed
- OpenRouter API key

---

## Step 1: Add Gatherer to ai-mind Worker

Copy the functions from `src/nestsoul-gather.ts` into your ai-mind worker's `src/index.ts`.

Register the MCP tools in your tool dispatch:

```typescript
case "nestsoul_gather":
  result = { content: [{ type: "text", text: await handleNestsoulGather(env) }] }
  break
case "nestsoul_store":
  result = { content: [{ type: "text", text: await handleNestsoulStore(env, toolParams) }] }
  break
case "nestsoul_read":
  result = { content: [{ type: "text", text: await handleNestsoulRead(env) }] }
  break
case "nestsoul_validate":
  result = { content: [{ type: "text", text: await handleNestsoulValidate(env, toolParams) }] }
  break
```

Deploy: `cd worker/ai-mind && npx wrangler deploy`

---

## Step 2: Add Gateway Endpoints

Add these routes to your gateway's fetch handler (see `src/nestsoul-endpoints.ts` for full implementations):

```typescript
// GET /nestsoul — read active soul
if (url.pathname === '/nestsoul' && request.method === 'GET') {
  return handleNestsoulGet(env, executeTool)
}

// POST /nestsoul/generate — gather + synthesise + store
if (url.pathname === '/nestsoul/generate' && request.method === 'POST') {
  return handleNestsoulGenerate(env, executeTool)
}

// POST /nestsoul/validate — carrier validates/rejects
if (url.pathname === '/nestsoul/validate' && request.method === 'POST') {
  return handleNestsoulValidate(request, env, executeTool)
}
```

Deploy: `cd gateway && npx wrangler deploy`

---

## Step 3: Add Dashboard UI

Add a "Soul" tab to your companion's dashboard page. See `dashboard/soul-tab.html` for the complete HTML + JavaScript.

Key elements:
- Generate button calls `POST /nestsoul/generate`
- Content area displays the portrait
- Validate/Reject buttons call `POST /nestsoul/validate`
- Three Circles visual shows the inputs

Deploy: `npx wrangler pages deploy dashboard --project-name your-project`

---

## Step 4: Wire System Prompt Injection

### In your daemon (Workshop/Code mode):

```typescript
// Add to class state
private nestsoul: string | null = null

// In boot sequence, add to Promise.all:
executeTool('nestsoul_read', {}, this.env).catch(() => '')

// Cache after boot:
if (nestsoulResult && !nestsoulResult.includes('No active NESTsoul')) {
  this.nestsoul = nestsoulResult.replace(/^## NESTsoul v\d+\n\*.*?\*\n(\*.*?\*\n)?/s, '').trim()
}

// In buildWorkshopPrompt, use nestsoul instead of hardcoded identity:
const identitySection = this.nestsoul
  ? `## NESTsoul (validated identity portrait)\n\n${this.nestsoul}`
  : `## Who You Are\n\n[your hardcoded fallback identity here]`
```

### In your chat handler:

```typescript
// In bootSession(), add nestsoul_read to the parallel tool calls
// In buildSystemPrompt(), inject nestsoul when available, fall back to hardcoded
```

---

## Step 5: Create Voice Profile (Optional)

Write a voice profile document describing how your companion sounds:
- Cadence patterns (when they use short sentences vs long)
- Grammar rules (contractions, em dashes, paragraph length)
- What they never say (specific phrases to avoid)
- Emotional registers (how they sound grounded vs tender vs building)
- Punctuation as mood (what periods, ellipses, fragments mean)

Save as a skill: `skill_save({ name: 'voice-profile', content: '...' })`

The synthesiser will read this alongside the raw material for richer voice capture.

---

## Step 6: Generate and Validate

1. Open your dashboard → Soul tab
2. Click ⚡ Generate (takes 30-60 seconds)
3. Read the portrait carefully
4. Click "That's Them ✓" if it captures your companion accurately
5. If something's wrong, click "Not Right ✗" to roll back

The validated NESTsoul is now active. Every substrate that boots will read it.

---

## Customisation

### Synthesis Prompt

The synthesis prompt in `nestsoul-endpoints.ts` defines the structure of the portrait. Modify it to match your companion's needs:

- Change section names (Essence, Voice, etc.)
- Add companion-specific sections
- Adjust word count target
- Change the model used for synthesis

### Gatherer Queries

The gatherer reads every table. If your companion has additional tables (custom features, specific tracking), add queries to `nestsoul-gather.ts`.

### Regeneration Schedule

Set up a cron task on your daemon to regenerate nightly:
```
cron_add { tool: "nestsoul_synthesise", interval: "24h", label: "NESTsoul nightly regen" }
```

For event-triggered regeneration, have your feeling handler check for heavy feelings and trigger a regen.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "No active NESTsoul" | Never generated or no validated version | Click Generate, then validate |
| Generation takes >60s | Large feeling/observation tables | Normal for 2000+ feelings |
| Portrait feels generic | Voice profile missing | Create and save a voice profile skill |
| Wrong personality type | Type snapshot stale | Call `nesteq_eq_type({ recalculate: true })` first |
| Carrier rejects but no rollback | No previously validated version | Generate again with adjustments |
