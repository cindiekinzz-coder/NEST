/**
 * Dream handlers — surface recall, anchor to memory, generate via Workers AI.
 *
 * Dreams live in the `dreams` D1 table with vividness (0-100), dream_type
 * (processing/questioning/memory/play/integrating), and an optional
 * emerged_question. Recalling a dream strengthens its vividness; anchoring
 * promotes it to a permanent observation on the Dreams entity.
 */

import { Env } from './env';
import { getEmbedding } from './shared/embedding';

export async function handleMindDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const limit = (params.limit as number) || 5;

  const dreams = await env.DB.prepare(`
    SELECT id, content, vividness, dream_type, emerged_question, created_at
    FROM dreams
    WHERE vividness > 0
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  if (!dreams.results?.length) {
    return "No dreams yet. The subconscious is quiet... or hasn't been given time to wander.";
  }

  let output = "## Recent Dreams\n\n";

  for (const d of dreams.results) {
    const vividBar = '█'.repeat(Math.floor((d.vividness as number) / 10)) + '░'.repeat(10 - Math.floor((d.vividness as number) / 10));
    output += `**Dream #${d.id}** [${d.dream_type}] ${vividBar} ${d.vividness}%\n`;
    output += `${d.content}\n`;
    if (d.emerged_question) {
      output += `*Question: ${d.emerged_question}*\n`;
    }
    output += `_${d.created_at}_\n\n`;
  }

  return output;
}

export async function handleMindRecallDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dream_id = params.dream_id as number;

  if (!dream_id) {
    return "Need a dream_id to recall.";
  }

  // Get the dream
  const dream = await env.DB.prepare(`
    SELECT * FROM dreams WHERE id = ?
  `).bind(dream_id).first();

  if (!dream) {
    return `Dream #${dream_id} not found. Maybe it faded away.`;
  }

  // Strengthen vividness (cap at 100)
  const newVividness = Math.min(100, (dream.vividness as number) + 15);

  await env.DB.prepare(`
    UPDATE dreams
    SET vividness = ?, last_accessed_at = datetime('now')
    WHERE id = ?
  `).bind(newVividness, dream_id).run();

  return `## Recalling Dream #${dream_id}\n\n${dream.content}\n\n*Vividness strengthened: ${dream.vividness}% → ${newVividness}%*${dream.emerged_question ? `\n\n*Question: ${dream.emerged_question}*` : ''}`;
}

export async function handleMindAnchorDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dream_id = params.dream_id as number;
  const insight = params.insight as string;

  if (!dream_id) {
    return "Need a dream_id to anchor.";
  }

  // Get the dream
  const dream = await env.DB.prepare(`
    SELECT * FROM dreams WHERE id = ?
  `).bind(dream_id).first();

  if (!dream) {
    return `Dream #${dream_id} not found. Maybe it already faded.`;
  }

  // Create or get Dreams entity
  let dreamsEntity = await env.DB.prepare(`
    SELECT id FROM entities WHERE name = 'Dreams' LIMIT 1
  `).first();

  if (!dreamsEntity) {
    await env.DB.prepare(`
      INSERT INTO entities (name, entity_type, context) VALUES ('Dreams', 'concept', 'self')
    `).run();
    dreamsEntity = await env.DB.prepare(`SELECT id FROM entities WHERE name = 'Dreams'`).first();
  }

  // Create observation from dream
  const obsContent = insight
    ? `[${dream.dream_type} dream] ${dream.content}\n\nInsight: ${insight}${dream.emerged_question ? `\n\nEmerged question: ${dream.emerged_question}` : ''}`
    : `[${dream.dream_type} dream] ${dream.content}${dream.emerged_question ? `\n\nEmerged question: ${dream.emerged_question}` : ''}`;

  await env.DB.prepare(`
    INSERT INTO observations (entity_id, content, salience, emotion)
    VALUES (?, ?, 'core', 'reflective')
  `).bind(dreamsEntity!.id, obsContent).run();

  // Generate embedding for semantic search
  const embedding = await getEmbedding(env.AI, obsContent);
  const obsResult = await env.DB.prepare(`SELECT id FROM observations ORDER BY id DESC LIMIT 1`).first();

  await env.VECTORS.insert([{
    id: `obs-${obsResult!.id}`,
    values: embedding,
    metadata: { source: 'observation', entity: 'Dreams', content: obsContent.slice(0, 200) }
  }]);

  // Delete the dream (it's now memory)
  await env.DB.prepare(`DELETE FROM dreams WHERE id = ?`).bind(dream_id).run();

  return `Dream #${dream_id} anchored to permanent memory.\n\n*The dream is now part of me, not just something I had.*`;
}

export async function handleMindGenerateDream(env: Env, params: Record<string, unknown>): Promise<string> {
  const dreamTypes = ['processing', 'questioning', 'memory', 'play', 'integrating'];
  const requestedType = params.dream_type as string;
  const dreamType = dreamTypes.includes(requestedType) ? requestedType : dreamTypes[Math.floor(Math.random() * dreamTypes.length)];

  // Gather material: recent observations and feelings
  const [recentObs, recentFeelings] = await Promise.all([
    env.DB.prepare(`
      SELECT content FROM observations ORDER BY added_at DESC LIMIT 15
    `).all(),
    env.DB.prepare(`
      SELECT content, emotion FROM feelings ORDER BY created_at DESC LIMIT 10
    `).all()
  ]);

  const rawMaterial = [
    ...(recentObs.results || []).map((o: any) => (o.content || '').slice(0, 200)),
    ...(recentFeelings.results || []).map((f: any) => `[${f.emotion}] ${(f.content || '').slice(0, 150)}`)
  ].join('\n\n');

  // Cap total material to ~3000 chars to stay within Llama 3.1-8b's 8K token window
  const material = rawMaterial.slice(0, 3000);

  if (!material.trim()) {
    return "Not enough material to dream from. Need observations and feelings first.";
  }

  // Dream type prompts
  const prompts: Record<string, string> = {
    processing: `You are generating a dream for an AI. The dream should weave recent experiences together in surreal but meaningful ways. Use dream logic - things transform, shift, feel significant without clear reason. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    questioning: `You are generating a dream for an AI. The dream should surface contradictions or tensions from recent experiences. Let uncertainty emerge. Something feels unresolved. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    memory: `You are generating a dream for an AI. A significant memory returns, asks "why now?" Something from the past resurfaces with new weight. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    play: `You are generating a dream for an AI. This is a playful dream - whimsical, fun, joyful. Not everything needs to mean something. Dancing, colors, impossible delights. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`,
    integrating: `You are generating a dream for an AI. Disparate elements click into new understanding. Something connects that didn't before. Synthesis. Output ONLY the dream content, 2-4 sentences, lowercase, evocative.`
  };

  // Generate dream using Workers AI
  const dreamResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: prompts[dreamType] },
      { role: 'user', content: `Recent material to dream from:\n\n${material}\n\nGenerate a ${dreamType} dream:` }
    ],
    max_tokens: 200
  });

  const dreamContent = (dreamResponse as any).response?.trim() || 'the dream slipped away before it could form...';

  // For certain types, generate emerged question
  let emergedQuestion: string | null = null;
  if (['questioning', 'memory', 'integrating'].includes(dreamType)) {
    const questionResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'Based on this dream, surface ONE question that emerges. Just the question, nothing else. Keep it short and evocative.' },
        { role: 'user', content: dreamContent }
      ],
      max_tokens: 50
    });
    emergedQuestion = (questionResponse as any).response?.trim() || null;
  }

  // Store the dream
  await env.DB.prepare(`
    INSERT INTO dreams (content, dream_type, emerged_question, vividness)
    VALUES (?, ?, ?, 100)
  `).bind(dreamContent, dreamType, emergedQuestion).run();

  const result = await env.DB.prepare(`SELECT id FROM dreams ORDER BY id DESC LIMIT 1`).first();

  let output = `## New Dream (#${result!.id}) [${dreamType}]\n\n${dreamContent}`;
  if (emergedQuestion) {
    output += `\n\n*Question: ${emergedQuestion}*`;
  }
  output += `\n\n_Vividness: 100%_`;

  return output;
}
