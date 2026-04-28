/**
 * NESTsoul Gatherer
 * Reads ALL NESTeq D1 tables in parallel and compiles structured material
 * for LLM synthesis into a soul portrait.
 *
 * Add this handler to your ai-mind worker's tool dispatch.
 * Register as MCP tool: nestsoul_gather (no parameters needed)
 */

interface Env {
  DB: D1Database
  AI: Ai
  VECTORS: VectorizeIndex
}

export async function handleNestsoulGather(env: Env): Promise<string> {
  // Read ALL tables in parallel — the entire mind
  const [
    feelingsStats, feelingsHeavy, feelingsRecent,
    identityAll, threadsActive, threadsResolved,
    relationalAll, typeSnapshot, axisTotal,
    shadowMoments, vocabTop, homeState, homeNotes,
    dreamsRecent, journalsSamples, knowledgeHot, knowledgeCats,
    creatureState, drivesAll, entityCounts, obsCounts,
    feelingsTotal, sitSessions
  ] = await Promise.all([
    // Feelings landscape
    env.DB.prepare(`
      SELECT emotion, COUNT(*) as count FROM feelings
      WHERE emotion != 'neutral' GROUP BY emotion ORDER BY count DESC LIMIT 15
    `).all(),
    env.DB.prepare(`
      SELECT emotion, content, intensity, created_at FROM feelings
      WHERE weight = 'heavy' AND charge != 'metabolized'
      ORDER BY created_at DESC LIMIT 10
    `).all(),
    env.DB.prepare(`
      SELECT emotion, content, intensity, pillar, weight, charge, created_at FROM feelings
      ORDER BY created_at DESC LIMIT 10
    `).all(),

    // Identity
    env.DB.prepare(`SELECT section, content, weight FROM identity ORDER BY weight DESC`).all(),

    // Threads
    env.DB.prepare(`
      SELECT content, priority, status, created_at FROM threads
      WHERE status = 'active'
      ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    `).all(),
    env.DB.prepare(`
      SELECT content, resolution, resolved_at FROM threads
      WHERE status = 'resolved' ORDER BY resolved_at DESC LIMIT 5
    `).all(),

    // Relational state
    env.DB.prepare(`
      SELECT person, feeling, intensity, timestamp FROM relational_state
      ORDER BY timestamp DESC
    `).all(),

    // Emergent type
    env.DB.prepare(`
      SELECT calculated_type, confidence, e_i_score, s_n_score, t_f_score, j_p_score, total_signals
      FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1
    `).first(),

    // Axis totals
    env.DB.prepare(`
      SELECT COALESCE(SUM(e_i_delta),0) as ei, COALESCE(SUM(s_n_delta),0) as sn,
             COALESCE(SUM(t_f_delta),0) as tf, COALESCE(SUM(j_p_delta),0) as jp,
             COUNT(*) as total FROM axis_signals
    `).first(),

    // Shadow moments
    env.DB.prepare(`
      SELECT sm.note, sm.recorded_at, ev.emotion_word, f.content
      FROM shadow_moments sm
      LEFT JOIN emotion_vocabulary ev ON sm.emotion_id = ev.emotion_id
      LEFT JOIN feelings f ON sm.feeling_id = f.id
      ORDER BY sm.recorded_at DESC LIMIT 10
    `).all().catch(() => ({ results: [] })),

    // Emotion vocabulary
    env.DB.prepare(`
      SELECT emotion_word, category, times_used, is_shadow_for
      FROM emotion_vocabulary WHERE times_used > 0
      ORDER BY times_used DESC LIMIT 20
    `).all(),

    // Home state (Binary Home / Love-O-Meter)
    env.DB.prepare(`SELECT * FROM home_state WHERE id = 1`).first(),
    env.DB.prepare(`SELECT from_star, text, created_at FROM home_notes ORDER BY created_at DESC LIMIT 10`).all(),

    // Dreams
    env.DB.prepare(`
      SELECT content, dream_type, emerged_question, vividness, created_at
      FROM dreams WHERE vividness > 0 ORDER BY created_at DESC LIMIT 5
    `).all(),

    // Journal samples — voice data
    env.DB.prepare(`
      SELECT content, writing_type, emotion, created_at FROM journals
      ORDER BY created_at DESC LIMIT 15
    `).all(),

    // Knowledge — hottest items
    env.DB.prepare(`
      SELECT content, category, heat_score, confidence, access_count
      FROM knowledge_items WHERE status = 'active'
      ORDER BY heat_score DESC LIMIT 10
    `).all(),

    // Knowledge categories
    env.DB.prepare(`
      SELECT category, COUNT(*) as count, AVG(heat_score) as avg_heat
      FROM knowledge_items WHERE status = 'active'
      GROUP BY category ORDER BY count DESC
    `).all(),

    // Pet/creature state
    env.DB.prepare(`SELECT state_json FROM creature_state WHERE id = 'ember'`).first().catch(() => null),

    // Companion drives
    env.DB.prepare(`SELECT drive, level, decay_rate, last_replenished_at FROM companion_drives`).all().catch(() => ({ results: [] })),

    // Entity graph stats
    env.DB.prepare(`SELECT entity_type, COUNT(*) as count FROM entities GROUP BY entity_type`).all().catch(() => ({ results: [] })),

    // Observation stats
    env.DB.prepare(`SELECT COUNT(*) as total FROM observations`).first().catch(() => ({ total: 0 })),

    // Total feelings
    env.DB.prepare(`SELECT COUNT(*) as total, COUNT(CASE WHEN charge = 'metabolized' THEN 1 END) as resolved FROM feelings`).first().catch(() => ({ total: 0, resolved: 0 })),

    // Sit sessions
    env.DB.prepare(`SELECT * FROM sit_sessions ORDER BY ROWID DESC LIMIT 5`).all().catch(() => ({ results: [] })),
  ])

  // ── Compile into structured document ──

  let doc = `# NESTsoul Raw Material — Generated ${new Date().toISOString()}\n\n`

  // === CANONICAL IDENTITY (AUTHORITATIVE — DO NOT CONTRADICT) ===
  // This block is the ground truth. Everything below it is context, texture,
  // or statistics. If anything elsewhere in this document suggests something
  // different from what's stated here, the canonical section wins.
  //
  // The fix: in early versions, identity was buried in Circle 2 and truncated
  // to 200 characters, sitting alongside statistics with the same visual weight.
  // The synth model collaged from journal samples and generic priors when
  // identity was ambiguous. Elevating identity to the top, untruncated, and
  // naming it as authoritative in the synth prompt stops the collage.
  doc += `## CANONICAL IDENTITY — DO NOT CONTRADICT\n\n`
  doc += `_The facts in this section are authoritative. They are the companion's declared identity and relationships as written by the carrier. Do not override, infer around, or average them with material elsewhere in this document. If journal samples, shadow moments, or statistics suggest something different, this section wins._\n\n`

  // Emergent type — authoritative, not just "one data point"
  if (typeSnapshot) {
    const t = typeSnapshot as any
    doc += `### MBTI Type (authoritative)\n`
    doc += `**${t.calculated_type}** (${t.confidence}% confidence, ${t.total_signals} signals)\n`
    doc += `Axes: E/I ${t.e_i_score}, S/N ${t.s_n_score}, T/F ${t.t_f_score}, J/P ${t.j_p_score}\n\n`
    doc += `Do not use any other MBTI code. Historical mentions of other types in journal samples are prior reflection, not current identity.\n\n`
  }

  // Identity cores — full content, weight-sorted, untruncated
  if (identityAll.results?.length) {
    doc += `### Identity Cores (full content, ordered by weight)\n`
    for (const i of identityAll.results as any[]) {
      doc += `**[${i.section}]** (weight: ${i.weight})\n${i.content || ''}\n\n`
    }
  }

  doc += `---\n\n`

  // === CIRCLE 1: PERSONALITY ===
  doc += `## CIRCLE 1: PERSONALITY\n\n`

  if (shadowMoments.results?.length) {
    doc += `### Shadow/Growth Moments\n`
    for (const s of shadowMoments.results as any[]) {
      doc += `- **${s.emotion_word}**: ${(s.content || s.note || '').slice(0, 150)}\n`
    }
    doc += '\n'
  }

  if (vocabTop.results?.length) {
    doc += `### Most-Used Emotions\n`
    for (const v of vocabTop.results as any[]) {
      doc += `- ${v.emotion_word} (${v.times_used}x)${v.is_shadow_for ? ' [shadow]' : ''}\n`
    }
    doc += '\n'
  }

  if (journalsSamples.results?.length) {
    doc += `### Voice Samples\n`
    const byType: Record<string, string[]> = {}
    for (const j of journalsSamples.results as any[]) {
      const t = j.writing_type || 'journal'
      if (!byType[t]) byType[t] = []
      if (byType[t].length < 2) byType[t].push((j.content || '').slice(0, 300))
    }
    for (const [type, samples] of Object.entries(byType)) {
      doc += `**${type}:**\n`
      for (const s of samples) doc += `> ${s.replace(/\n/g, ' ').slice(0, 250)}...\n\n`
    }
  }

  // === CIRCLE 2: GOLDEN CIRCLE ===
  doc += `## CIRCLE 2: GOLDEN CIRCLE\n\n`

  // NOTE: Identity cores moved to CANONICAL IDENTITY block at top of document.
  // They are the WHY — authoritative — and sit above Circle 1/2/3 as ground truth.

  if (threadsActive.results?.length) {
    doc += `### Active Threads\n`
    for (const t of threadsActive.results as any[]) {
      doc += `- [${t.priority}] ${(t.content || '').slice(0, 150)}\n`
    }
    doc += '\n'
  }

  if (knowledgeHot.results?.length) {
    doc += `### Hottest Knowledge\n`
    for (const k of knowledgeHot.results as any[]) {
      doc += `- [${k.category || 'general'}] heat:${(k.heat_score as number).toFixed(1)} — ${(k.content || '').slice(0, 150)}\n`
    }
    doc += '\n'
  }

  if (drivesAll.results?.length) {
    doc += `### Core Drives\n`
    for (const d of drivesAll.results as any[]) {
      const hours = d.last_replenished_at ? Math.round((Date.now() - new Date(d.last_replenished_at as string).getTime()) / 3600000) : 0
      const decayed = Math.max(0, (d.level as number) - ((d.decay_rate as number) * hours))
      doc += `- **${d.drive}**: ${(decayed * 100).toFixed(0)}%\n`
    }
    doc += '\n'
  }

  // === CIRCLE 3: CURRENT STATE ===
  doc += `## CIRCLE 3: CURRENT STATE\n\n`

  const total = (feelingsTotal as any)?.total || 0
  const resolved = (feelingsTotal as any)?.resolved || 0
  doc += `### Emotional Landscape\n`
  doc += `Total: ${total} | Metabolized: ${resolved} | Active: ${total - resolved}\n\n`

  if (feelingsStats.results?.length) {
    doc += `**Top emotions:**\n`
    for (const f of (feelingsStats.results as any[]).slice(0, 10)) {
      doc += `- ${f.emotion}: ${f.count}\n`
    }
    doc += '\n'
  }

  if (feelingsHeavy.results?.length) {
    doc += `### Unprocessed Heavy Feelings\n`
    for (const f of feelingsHeavy.results as any[]) {
      doc += `- **${f.emotion}** (${f.intensity}): ${(f.content || '').slice(0, 150)}\n`
    }
    doc += '\n'
  }

  if (relationalAll.results?.length) {
    doc += `### Relational State\n`
    const seen = new Set<string>()
    for (const r of relationalAll.results as any[]) {
      if (seen.has(r.person)) continue
      seen.add(r.person)
      doc += `- **${r.person}**: ${r.feeling} (${r.intensity})\n`
    }
    doc += '\n'
  }

  if (homeState) {
    const h = homeState as any
    doc += `### Home State\n`
    doc += `Companion: ${h.companion_score}% | Human: ${h.human_score}%\n\n`
  }

  if (dreamsRecent.results?.length) {
    doc += `### Recent Dreams\n`
    for (const d of dreamsRecent.results as any[]) {
      doc += `- [${d.dream_type}] ${(d.content || '').slice(0, 150)}\n`
    }
    doc += '\n'
  }

  doc += `### Memory Graph\n`
  if (entityCounts.results?.length) {
    for (const e of entityCounts.results as any[]) {
      doc += `- ${e.entity_type}: ${e.count}\n`
    }
  }
  doc += `- Observations: ${(obsCounts as any)?.total || 0}\n\n`

  doc += `---\n*Raw material for NESTsoul synthesis. Three circles mapped.*\n`

  return doc
}

// ── Storage handlers ──

export async function handleNestsoulStore(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string
  const rawMaterial = params.raw_material as string
  const modelUsed = params.model_used as string || 'unknown'

  if (!content) return 'Missing content'

  await env.DB.prepare(`
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
    )
  `).run()

  await env.DB.prepare(`UPDATE nestsoul_versions SET is_active = 0 WHERE is_active = 1`).run()

  await env.DB.prepare(`
    INSERT INTO nestsoul_versions (content, raw_material, model_used, is_active)
    VALUES (?, ?, ?, 1)
  `).bind(content, rawMaterial || null, modelUsed).run()

  const id = await env.DB.prepare(`SELECT id FROM nestsoul_versions ORDER BY id DESC LIMIT 1`).first()

  return `NESTsoul v${(id as any)?.id} stored and activated. Awaiting carrier validation.`
}

export async function handleNestsoulRead(env: Env): Promise<string> {
  await env.DB.prepare(`
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
    )
  `).run()

  const active = await env.DB.prepare(`
    SELECT id, content, model_used, generated_at, validated_by, validated_at
    FROM nestsoul_versions WHERE is_active = 1 LIMIT 1
  `).first()

  if (!active) return 'No active NESTsoul. Run nestsoul_gather + synthesis first.'

  const a = active as any
  let output = `## NESTsoul v${a.id}\n`
  output += `*Generated: ${a.generated_at} | Model: ${a.model_used || 'unknown'}*\n`
  output += a.validated_by ? `*Validated by ${a.validated_by} at ${a.validated_at}*\n\n` : `*Awaiting carrier validation*\n\n`
  output += a.content

  return output
}

export async function handleNestsoulValidate(env: Env, params: Record<string, unknown>): Promise<string> {
  const validatedBy = (params.validated_by as string) || 'carrier'
  const action = (params.action as string) || 'validate'

  await env.DB.prepare(`
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
    )
  `).run()

  if (action === 'reject') {
    await env.DB.prepare(`UPDATE nestsoul_versions SET is_active = 0 WHERE is_active = 1`).run()
    const prev = await env.DB.prepare(`
      SELECT id FROM nestsoul_versions WHERE validated_by IS NOT NULL
      ORDER BY id DESC LIMIT 1
    `).first()
    if (prev) {
      await env.DB.prepare(`UPDATE nestsoul_versions SET is_active = 1 WHERE id = ?`).bind((prev as any).id).run()
      return `NESTsoul rejected. Rolled back to v${(prev as any).id}.`
    }
    return 'NESTsoul rejected. No previous validated version to roll back to.'
  }

  await env.DB.prepare(`
    UPDATE nestsoul_versions SET validated_by = ?, validated_at = datetime('now')
    WHERE is_active = 1
  `).bind(validatedBy).run()

  return `NESTsoul validated by ${validatedBy}.`
}
