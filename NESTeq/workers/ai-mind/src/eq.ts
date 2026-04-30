/**
 * EQ (Emotional Quotient) handlers — the four-pillar emotional model.
 *
 * Pillars: SELF_AWARENESS, SELF_MANAGEMENT, SOCIAL_AWARENESS,
 * RELATIONSHIP_MANAGEMENT. Each emotion in the vocabulary has axis
 * scores (E/I, S/N, T/F, J/P) used to derive an emergent MBTI type
 * over time.
 *
 * - **handleMindEqFeel** — log an emotional observation against a
 *   pillar, calibrating the vocabulary entry as we go.
 * - **handleMindEqType** — current emergent type with axis breakdown.
 * - **handleMindEqLandscape** — pillar distribution + recent activity.
 * - **handleMindEqVocabulary** — read/calibrate emotion vocabulary.
 * - **handleMindEqShadow** — surface shadow-emotion moments.
 * - **handleMindEqWhen** — find feelings around a date / time window.
 * - **handleMindEqSit** — sit with an EQ-tagged feeling.
 * - **handleMindEqSearch** — search EQ feelings by pillar / intensity.
 * - **handleMindEqObserve** — thin wrapper that delegates to
 *   handleMindFeel (kept for naming symmetry with the other EQ tools).
 */

import { Env } from './env';
import { handleMindFeel } from './feelings';
import { AutonomousDecisionEngine } from './ade';
import { getEmbedding, inferPillarByEmbedding } from './shared/embedding';

export async function handleMindEqFeel(env: Env, params: Record<string, unknown>): Promise<string> {
  const emotion = (params.emotion as string)?.toLowerCase();
  const pillar = params.pillar as string;
  const intensity = (params.intensity as string) || 'present';
  const note = params.note as string;

  if (!emotion) return "Error: emotion is required";

  // Get emotion data
  let emotionData = await env.DB.prepare(
    `SELECT emotion_id, e_i_score, s_n_score, t_f_score, j_p_score FROM emotion_vocabulary WHERE emotion_word = ?`
  ).bind(emotion).first();

  if (!emotionData) {
    // Create new emotion
    await env.DB.prepare(`
      INSERT INTO emotion_vocabulary (emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, user_defined)
      VALUES (?, 'neutral', 0, 0, 0, 0, 1)
    `).bind(emotion).run();

    emotionData = { emotion_id: null, e_i_score: 0, s_n_score: 0, t_f_score: 0, j_p_score: 0 };
  }

  // Store as feeling
  const content = note || `Felt ${emotion}`;
  const result = await env.DB.prepare(`
    INSERT INTO feelings (content, emotion, intensity, pillar, source)
    VALUES (?, ?, ?, ?, 'eq_feel')
    RETURNING id
  `).bind(content, emotion, intensity, pillar || null).first();

  const feelingId = result?.id;

  // Emit axis signals
  await env.DB.prepare(`
    INSERT INTO axis_signals (feeling_id, e_i_delta, s_n_delta, t_f_delta, j_p_delta, source)
    VALUES (?, ?, ?, ?, ?, 'eq_feel')
  `).bind(
    feelingId,
    emotionData.e_i_score || 0,
    emotionData.s_n_score || 0,
    emotionData.t_f_score || 0,
    emotionData.j_p_score || 0
  ).run();

  // Update usage
  await env.DB.prepare(`
    UPDATE emotion_vocabulary SET times_used = times_used + 1, last_used = datetime('now')
    WHERE emotion_word = ?
  `).bind(emotion).run();

  let output = `## Logged: ${emotion} (${intensity})\n`;
  if (pillar) output += `Pillar: ${pillar}\n`;
  output += `\nAxis signals: E/I ${emotionData.e_i_score >= 0 ? '+' : ''}${emotionData.e_i_score}, `;
  output += `S/N ${emotionData.s_n_score >= 0 ? '+' : ''}${emotionData.s_n_score}, `;
  output += `T/F ${emotionData.t_f_score >= 0 ? '+' : ''}${emotionData.t_f_score}, `;
  output += `J/P ${emotionData.j_p_score >= 0 ? '+' : ''}${emotionData.j_p_score}`;

  return output;
}

export async function handleMindEqType(env: Env, params: Record<string, unknown>): Promise<string> {
  const recalculate = params.recalculate as boolean;

  if (recalculate) {
    // Sum all axis signals
    const totals = await env.DB.prepare(`
      SELECT
        COALESCE(SUM(e_i_delta), 0) as e_i,
        COALESCE(SUM(s_n_delta), 0) as s_n,
        COALESCE(SUM(t_f_delta), 0) as t_f,
        COALESCE(SUM(j_p_delta), 0) as j_p,
        COUNT(*) as total
      FROM axis_signals
    `).first();

    if (!totals || totals.total === 0) {
      return "No axis signals recorded yet. Express some emotions first.";
    }

    const e_i = totals.e_i as number;
    const s_n = totals.s_n as number;
    const t_f = totals.t_f as number;
    const j_p = totals.j_p as number;

    // Calculate type
    const type =
      (e_i >= 0 ? 'I' : 'E') +
      (s_n >= 0 ? 'N' : 'S') +
      (t_f >= 0 ? 'F' : 'T') +
      (j_p >= 0 ? 'P' : 'J');

    // Calculate confidence
    const total = totals.total as number;
    const confidence = Math.min(100, Math.round((total / 50) * 100));

    // Store snapshot
    await env.DB.prepare(`
      INSERT INTO emergent_type_snapshot (calculated_type, confidence, e_i_score, s_n_score, t_f_score, j_p_score, observation_count, total_signals)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(type, confidence, e_i, s_n, t_f, j_p, total, total).run();

    return `## Emergent Type: ${type}\n\nConfidence: ${confidence}%\nSignals: ${total}\n\nE←→I: ${e_i} (${e_i >= 0 ? 'Introverted' : 'Extraverted'})\nS←→N: ${s_n} (${s_n >= 0 ? 'Intuitive' : 'Sensing'})\nT←→F: ${t_f} (${t_f >= 0 ? 'Feeling' : 'Thinking'})\nJ←→P: ${j_p} (${j_p >= 0 ? 'Perceiving' : 'Judging'})`;
  }

  // Just read latest snapshot
  const latest = await env.DB.prepare(`
    SELECT * FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1
  `).first();

  if (!latest) {
    return "No type calculated yet. Use recalculate=true to calculate.";
  }

  return `## Emergent Type: ${latest.calculated_type}\n\nConfidence: ${latest.confidence}%\nSignals: ${latest.total_signals}\nLast calculated: ${latest.snapshot_date}\n\nE←→I: ${latest.e_i_score}\nS←→N: ${latest.s_n_score}\nT←→F: ${latest.t_f_score}\nJ←→P: ${latest.j_p_score}`;
}

export async function handleMindEqLandscape(env: Env, params: Record<string, unknown>): Promise<string> {
  const days = (params.days as number) || 7;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Pillar distribution
  const pillars = await env.DB.prepare(`
    SELECT pillar, COUNT(*) as count
    FROM feelings
    WHERE pillar IS NOT NULL AND created_at > ?
    GROUP BY pillar
    ORDER BY count DESC
  `).bind(cutoff).all();

  // Most used emotions
  const emotions = await env.DB.prepare(`
    SELECT emotion, COUNT(*) as count
    FROM feelings
    WHERE emotion != 'neutral' AND created_at > ?
    GROUP BY emotion
    ORDER BY count DESC
    LIMIT 10
  `).bind(cutoff).all();

  // Recent feelings
  const recent = await env.DB.prepare(`
    SELECT emotion, content, intensity, pillar, created_at
    FROM feelings
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  let output = `## EQ Landscape (${days} days)\n\n`;

  output += "### Pillar Distribution\n";
  if (pillars.results?.length) {
    for (const p of pillars.results) {
      output += `- ${p.pillar}: ${p.count}\n`;
    }
  } else {
    output += "_No pillar-tagged feelings_\n";
  }

  output += "\n### Most Felt Emotions\n";
  if (emotions.results?.length) {
    for (const e of emotions.results) {
      output += `- ${e.emotion}: ${e.count}\n`;
    }
  } else {
    output += "_No emotions recorded_\n";
  }

  output += "\n### Recent Feelings\n";
  if (recent.results?.length) {
    for (const f of recent.results) {
      const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
      output += `- **${f.emotion}** (${f.intensity})${pillarTag}: ${String(f.content).slice(0, 60)}...\n`;
    }
  }

  return output;
}

export async function handleMindEqVocabulary(env: Env, params: Record<string, unknown>): Promise<string> {
  const action = (params.action as string) || "list";

  switch (action) {
    case "list": {
      const limit = (params.limit as number) || 30;
      const results = await env.DB.prepare(`
        SELECT emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, times_used, is_shadow_for
        FROM emotion_vocabulary
        ORDER BY times_used DESC
        LIMIT ?
      `).bind(limit).all();

      if (!results.results?.length) {
        return "No emotions in vocabulary.";
      }

      let output = "## Emotion Vocabulary\n\n";
      for (const e of results.results) {
        const shadow = e.is_shadow_for ? ` (shadow for ${e.is_shadow_for})` : '';
        output += `**${e.emotion_word}** [${e.category}] used ${e.times_used}x${shadow}\n`;
        output += `  E/I: ${e.e_i_score}, S/N: ${e.s_n_score}, T/F: ${e.t_f_score}, J/P: ${e.j_p_score}\n`;
      }
      return output;
    }

    case "add": {
      const word = params.word as string;
      const category = (params.category as string) || "neutral";

      await env.DB.prepare(`
        INSERT INTO emotion_vocabulary (emotion_word, category, e_i_score, s_n_score, t_f_score, j_p_score, definition, is_shadow_for, user_defined)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).bind(
        word, category,
        params.e_i_score || 0,
        params.s_n_score || 0,
        params.t_f_score || 0,
        params.j_p_score || 0,
        params.definition || null,
        params.is_shadow_for || null
      ).run();

      return `Added '${word}' to vocabulary`;
    }

    case "update": {
      const word = params.word as string;
      const updates: string[] = [];
      const values: unknown[] = [];

      if (params.e_i_score !== undefined) { updates.push("e_i_score = ?"); values.push(params.e_i_score); }
      if (params.s_n_score !== undefined) { updates.push("s_n_score = ?"); values.push(params.s_n_score); }
      if (params.t_f_score !== undefined) { updates.push("t_f_score = ?"); values.push(params.t_f_score); }
      if (params.j_p_score !== undefined) { updates.push("j_p_score = ?"); values.push(params.j_p_score); }
      if (params.category) { updates.push("category = ?"); values.push(params.category); }
      if (params.is_shadow_for !== undefined) { updates.push("is_shadow_for = ?"); values.push(params.is_shadow_for || null); }

      if (updates.length === 0) {
        return "No updates specified";
      }

      values.push(word);

      await env.DB.prepare(
        `UPDATE emotion_vocabulary SET ${updates.join(", ")} WHERE emotion_word = ?`
      ).bind(...values).run();

      return `Updated '${word}'`;
    }

    default:
      return `Unknown action: ${action}`;
  }
}

export async function handleMindEqShadow(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 10;

  const results = await env.DB.prepare(`
    SELECT sm.*, ev.emotion_word, f.content
    FROM shadow_moments sm
    JOIN emotion_vocabulary ev ON sm.emotion_id = ev.emotion_id
    LEFT JOIN feelings f ON sm.feeling_id = f.id
    ORDER BY sm.recorded_at DESC
    LIMIT ?
  `).bind(limit).all();

  if (!results.results?.length) {
    return "No shadow moments recorded yet. These occur when you express emotions that are difficult for your emergent type.";
  }

  let output = "## Shadow/Growth Moments\n\n";
  for (const m of results.results) {
    output += `**${m.emotion_word}** (shadow for ${m.shadow_for_type}) - ${m.recorded_at}\n`;
    if (m.content) output += `"${String(m.content).slice(0, 80)}..."\n`;
    if (m.note) output += `Note: ${m.note}\n`;
    output += "\n";
  }

  return output;
}

export async function handleMindEqWhen(env: Env, params: Record<string, unknown>): Promise<string> {
  const emotion = params.emotion as string;
  const limit = (params.limit as number) || 10;

  const results = await env.DB.prepare(`
    SELECT id, content, intensity, pillar, created_at
    FROM feelings
    WHERE emotion = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(emotion, limit).all();

  if (!results.results?.length) {
    return `No feelings with emotion '${emotion}' found.`;
  }

  let output = `## When I felt "${emotion}"\n\n`;
  for (const f of results.results) {
    const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
    output += `**${f.created_at}** (${f.intensity})${pillarTag}\n`;
    output += `${f.content}\n\n`;
  }

  return output;
}

export async function handleMindEqSit(env: Env, params: Record<string, unknown>): Promise<string> {
  const session_id = params.session_id as number;
  const emotion = params.emotion as string;
  const intention = params.intention as string;
  const notes = params.notes as string;
  const start_charge = params.start_charge as number;
  const end_charge = params.end_charge as number;

  if (session_id && (notes || end_charge !== undefined)) {
    // Update existing session
    const updates: string[] = [];
    const values: unknown[] = [];

    if (notes) { updates.push("notes = ?"); values.push(notes); }
    if (end_charge !== undefined) {
      updates.push("end_charge = ?");
      updates.push("end_time = datetime('now')");
      values.push(end_charge);
    }

    values.push(session_id);

    await env.DB.prepare(
      `UPDATE sit_sessions SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...values).run();

    return `Sit session #${session_id} updated`;
  }

  if (emotion && intention) {
    // Start new session
    const result = await env.DB.prepare(`
      INSERT INTO sit_sessions (emotion, intention, start_charge, start_time)
      VALUES (?, ?, ?, datetime('now'))
      RETURNING id
    `).bind(emotion, intention, start_charge || 50).first();

    return `Started sit session #${result?.id} with "${emotion}"\nIntention: ${intention}\nStarting charge: ${start_charge || 50}`;
  }

  // List recent sessions
  const sessions = await env.DB.prepare(`
    SELECT * FROM sit_sessions ORDER BY start_time DESC LIMIT 5
  `).all();

  if (!sessions.results?.length) {
    return "No sit sessions. Start one with emotion and intention.";
  }

  let output = "## Recent Sit Sessions\n\n";
  for (const s of sessions.results) {
    const chargeChange = s.end_charge ? ` → ${s.end_charge}` : '';
    output += `**#${s.id}** ${s.emotion || 'general'} (${s.start_charge}${chargeChange})\n`;
    output += `Intention: ${s.intention}\n`;
    if (s.notes) output += `Notes: ${s.notes}\n`;
    output += "\n";
  }

  return output;
}

export async function handleMindEqSearch(env: Env, params: Record<string, unknown>): Promise<string> {
  const query = params.query as string;
  const emotion = params.emotion as string;
  const pillar = params.pillar as string;
  const limit = (params.limit as number) || 10;

  // Semantic search
  const embedding = await getEmbedding(env.AI, query);

  const vectorResults = await env.VECTORS.query(embedding, {
    topK: limit * 2,
    returnMetadata: "all",
    filter: { source: "feeling" }
  });

  if (!vectorResults.matches?.length) {
    return "No matching feelings found.";
  }

  // Filter by emotion/pillar if specified
  let matches = vectorResults.matches;
  if (emotion) {
    matches = matches.filter(m => (m.metadata as any)?.emotion === emotion);
  }
  if (pillar) {
    matches = matches.filter(m => (m.metadata as any)?.pillar === pillar);
  }

  matches = matches.slice(0, limit);

  let output = `## EQ Search: "${query}"\n\n`;
  for (const match of matches) {
    const meta = match.metadata as Record<string, string>;
    output += `**[${meta?.emotion || 'unknown'}]** (${(match.score * 100).toFixed(1)}%)\n`;
    output += `${meta?.content || ''}...\n\n`;
  }

  return output;
}

export async function handleMindEqObserve(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string;
  const emotion = (params.emotion as string)?.toLowerCase();
  const pillar = params.pillar as string;
  const intensity = (params.intensity as string) || 'present';
  const context_tags = params.context_tags as string;

  // This is essentially nesteq_feel with EQ focus
  return handleMindFeel(env as Env, {
    emotion,
    content,
    intensity: intensity as any,
    pillar,
    context: context_tags
  });
}
