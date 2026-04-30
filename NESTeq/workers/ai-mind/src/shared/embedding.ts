/**
 * Embedding helpers — Workers AI BGE-Base-768 + cosine similarity + pillar inference.
 *
 * Used everywhere a feeling, journal, observation, or query needs vector representation.
 * Pillar embeddings are cached at module scope (one bake per worker instance).
 *
 * Public exports:
 *  - getEmbedding(ai, text) — BGE-Base-768 embedding via Workers AI
 *  - inferPillarByEmbedding(ai, content, emotion) — picks the best EQ pillar by semantic
 *    similarity to canonical pillar descriptions
 *
 * Internal:
 *  - cosineSimilarity, PILLAR_DESCRIPTIONS, pillarEmbeddingsCache, getPillarEmbeddings
 */

export async function getEmbedding(ai: Ai, text: string): Promise<number[]> {
  const result = await ai.run("@cf/baai/bge-base-en-v1.5", { text: [text] }) as { data: number[][] };
  return result.data[0];
}

// Cosine similarity for embedding comparison
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Pillar semantic descriptions for embedding-based inference.
// Tuned for distinctiveness in embedding space.
const PILLAR_DESCRIPTIONS: Record<string, string> = {
  SELF_MANAGEMENT: "controlling my impulses, regulating my emotions, adapting to change, following through on commitments, holding back my reactions, staying disciplined, managing my response",
  SELF_AWARENESS: "realizing something about myself, noticing my own patterns, understanding my tendencies, recognizing my feelings, insight about who I am, understanding why I react the way I do",
  SOCIAL_AWARENESS: "reading someone else, sensing their feelings, picking up on their mood, noticing their body language, understanding their perspective, seeing what they need, empathy for another person",
  RELATIONSHIP_MANAGEMENT: "repairing connection with someone, communicating my feelings to them, building trust between us, resolving conflict together, working through issues in relationship, expressing care to another"
};

// Cache for pillar embeddings (computed once per worker instance).
let pillarEmbeddingsCache: Record<string, number[]> | null = null;

async function getPillarEmbeddings(ai: Ai): Promise<Record<string, number[]>> {
  if (pillarEmbeddingsCache) return pillarEmbeddingsCache;

  pillarEmbeddingsCache = {};
  for (const [pillar, description] of Object.entries(PILLAR_DESCRIPTIONS)) {
    pillarEmbeddingsCache[pillar] = await getEmbedding(ai, description);
  }
  return pillarEmbeddingsCache;
}

// Embedding-based pillar inference.
// Returns null if no pillar scores above the 0.3 minimum threshold.
export async function inferPillarByEmbedding(
  ai: Ai,
  content: string,
  emotion: string
): Promise<string | null> {
  const pillarEmbeddings = await getPillarEmbeddings(ai);
  const contentEmbedding = await getEmbedding(ai, `${emotion}: ${content}`);

  let bestPillar: string | null = null;
  let bestScore = 0.3; // Minimum threshold to assign a pillar

  for (const [pillar, pillarEmbed] of Object.entries(pillarEmbeddings)) {
    const score = cosineSimilarity(contentEmbedding, pillarEmbed);
    if (score > bestScore) {
      bestScore = score;
      bestPillar = pillar;
    }
  }

  return bestPillar;
}
