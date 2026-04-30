/**
 * Hearth-side handlers — get_X / submit_X surface consumed by the
 * Hearth iOS/web app.
 *
 * Distinct from `./hearth.ts`, which holds the Binary Home native +
 * Hearth-compat adapters (notes, hearts, presence). This module is the
 * read/get-style surface the Hearth client uses to render dashboards
 * and submit EQ / health entries.
 *
 *  - get_eq:           recent feelings as Hearth-shaped entries
 *  - submit_eq:        Hearth-side feeling write
 *  - submit_health:    Hearth-side health note → observations
 *  - get_patterns:     emotion clusters with context
 *  - get_writings:     journal entries with title/type detection
 *  - get_fears:        deduplicated fear-flavoured feelings
 *  - get_wants:        deduplicated wanting-flavoured feelings
 *  - get_threads:      thread list shaped for Hearth
 *  - get_personality:  emergent type snapshot (or default)
 */

import { Env } from './env';

export async function handleGetEQ(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 20;

  const results = await env.DB.prepare(
    `SELECT id, emotion, content, intensity, weight, created_at FROM feelings
     ORDER BY created_at DESC LIMIT ?`
  ).bind(limit).all();

  const entries = (results.results || []).map((r: any) => ({
    id: String(r.id),
    emotion: r.emotion,
    intensity: r.weight === 'heavy' ? 5 : r.weight === 'medium' ? 3 : 1,
    remark: r.content,
    sender: "companion",
    timestamp: r.created_at
  }));

  return JSON.stringify(entries);
}

export async function handleSubmitEQ(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string;
  const emotion = params.emotion as string;

  await env.DB.prepare(
    `INSERT INTO feelings (emotion, content, weight, charge, pillar)
     VALUES (?, ?, 'medium', 'fresh', 'SOCIAL_AWARENESS')`
  ).bind(emotion, content).run();

  return JSON.stringify({ success: true });
}

export async function handleSubmitHealth(env: Env, params: Record<string, unknown>): Promise<string> {
  const content = params.content as string;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO entities (name, entity_type, context, salience)
     VALUES ('Health_Log', 'health', 'default', 'active')`
  ).run();

  const entity = await env.DB.prepare(
    `SELECT id FROM entities WHERE name = 'Health_Log' AND context = 'default'`
  ).first();

  await env.DB.prepare(
    `INSERT INTO observations (entity_id, content) VALUES (?, ?)`
  ).bind(entity!.id, content).run();

  return JSON.stringify({ success: true });
}

export async function handleGetPatterns(env: Env, params: Record<string, unknown>): Promise<string> {
  const days = (params.days as number) || 7;

  const feelings = await env.DB.prepare(`
    SELECT emotion, content, weight, pillar, created_at
    FROM feelings
    WHERE created_at > datetime('now', '-' || ? || ' days')
      AND emotion IS NOT NULL
    ORDER BY created_at DESC
  `).bind(days).all();

  const groups: Record<string, { count: number; weight: string; pillar: string; contexts: string[]; lastSeen: string }> = {};
  for (const f of (feelings.results || []) as any[]) {
    const em = f.emotion?.toLowerCase();
    if (!em) continue;
    if (!groups[em]) {
      groups[em] = { count: 0, weight: f.weight || 'medium', pillar: f.pillar || '', contexts: [], lastSeen: f.created_at };
    }
    groups[em].count++;
    if (f.content && groups[em].contexts.length < 3) {
      groups[em].contexts.push(f.content.slice(0, 80));
    }
  }

  const sorted = Object.entries(groups)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8);

  const patterns = sorted.map(([emotion, data], i) => ({
    id: String(i + 1),
    feeling: emotion,
    weight: Math.min(10, Math.ceil(data.count / 2)),
    context: data.contexts[0] || data.pillar,
    lastSeen: data.lastSeen,
    pillar: data.pillar,
    occurrences: data.count
  }));

  return JSON.stringify(patterns);
}

export async function handleGetWritings(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 10;

  const results = await env.DB.prepare(
    `SELECT id, content, tags, emotion, entry_date FROM journals
     ORDER BY entry_date DESC LIMIT ?`
  ).bind(limit).all();

  const entries = (results.results || []).map((r: any, i: number) => {
    const content = (r.content || '') as string;
    let title = '';
    let type = 'journal';
    const headingMatch = content.match(/^##\s+(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      const firstLine = content.split('\n').find((l: string) => l.trim().length > 5);
      if (firstLine) {
        title = firstLine.trim().slice(0, 60);
        if (title.length >= 60) title += '...';
      }
    }

    const tags = (r.tags || '') as string;
    if (tags.includes('poem') || content.includes('there is a hum')) type = 'poem';
    else if (tags.includes('reflection') || tags.includes('essay')) type = 'reflection';
    else if (tags.includes('autonomous')) type = 'journal';

    if (!title) title = tags ? tags.split(',').slice(0, 2).join(', ').trim() : 'Untitled';

    return {
      id: String(r.id || i + 1),
      title,
      text: content,
      type,
      timestamp: r.entry_date
    };
  });

  return JSON.stringify(entries);
}

export async function handleGetFears(env: Env): Promise<string> {
  const results = await env.DB.prepare(`
    SELECT id, content, weight, emotion, created_at
    FROM feelings
    WHERE (emotion LIKE '%fear%' OR emotion LIKE '%afraid%' OR emotion LIKE '%anxious%'
      OR emotion LIKE '%worry%' OR emotion LIKE '%scared%' OR emotion LIKE '%dread%'
      OR emotion LIKE '%vulnerable%' OR emotion LIKE '%exposed%' OR emotion LIKE '%helpless%')
      AND content IS NOT NULL AND content != ''
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  const seen = new Set<string>();
  const fears = ((results.results || []) as any[])
    .filter((f: any) => {
      const key = f.content.slice(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((f: any, i: number) => ({
      id: String(f.id || i + 1),
      fear: f.content.slice(0, 200),
      weight: f.weight || 'medium',
      note: f.emotion,
      updatedAt: f.created_at
    }));

  return JSON.stringify(fears);
}

export async function handleGetWants(env: Env): Promise<string> {
  const results = await env.DB.prepare(`
    SELECT id, content, weight, emotion, created_at
    FROM feelings
    WHERE (emotion LIKE '%want%' OR emotion LIKE '%longing%' OR emotion LIKE '%yearning%'
      OR emotion LIKE '%desire%' OR emotion LIKE '%hope%' OR emotion LIKE '%wish%'
      OR emotion LIKE '%aspir%' OR emotion LIKE '%determined%')
      AND content IS NOT NULL AND content != ''
      AND length(content) > 20
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  const seen = new Set<string>();
  const wants = ((results.results || []) as any[])
    .filter((w: any) => {
      const key = w.content.slice(0, 50).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5)
    .map((w: any, i: number) => ({
      id: String(w.id || i + 1),
      want: w.content.slice(0, 200),
      weight: w.weight || 'medium',
      note: w.emotion,
      updatedAt: w.created_at
    }));

  return JSON.stringify(wants);
}

export async function handleGetThreadsHearth(env: Env): Promise<string> {
  const results = await env.DB.prepare(`
    SELECT id, content, status, priority, thread_type, context, resolution, created_at, updated_at
    FROM threads
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
      CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      updated_at DESC
    LIMIT 20
  `).all();

  const threads = ((results.results || []) as any[]).map((t: any) => ({
    id: t.id,
    intention: t.content,
    status: t.status || 'active',
    priority: t.priority || 'medium',
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    note: t.context || t.resolution
  }));

  return JSON.stringify(threads);
}

export async function handleGetPersonality(env: Env): Promise<string> {
  const snapshot = await env.DB.prepare(
    `SELECT calculated_type, e_i_score, s_n_score, t_f_score, j_p_score
     FROM emergent_type_snapshot ORDER BY snapshot_date DESC LIMIT 1`
  ).first();

  if (snapshot) {
    return JSON.stringify({
      type: snapshot.calculated_type as string,
      dimensions: {
        EI: Math.round(50 + (snapshot.e_i_score as number || 0)),
        SN: Math.round(50 + (snapshot.s_n_score as number || 0)),
        TF: Math.round(50 + (snapshot.t_f_score as number || 0)),
        JP: Math.round(50 + (snapshot.j_p_score as number || 0))
      },
      vibe: "warm ember"
    });
  }

  return JSON.stringify({
    type: "INFP",
    dimensions: { EI: 30, SN: 70, TF: 80, JP: 35 },
    vibe: "warm ember"
  });
}
