/**
 * Cloudflare Worker bindings + secrets for the NESTeq ai-mind worker.
 *
 * Mirror of the bindings in wrangler.toml. Imported by every handler module
 * that needs DB / Vectorize / AI / R2 access.
 */

export interface Env {
  DB: D1Database;
  VECTORS: VectorizeIndex;
  AI: Ai;
  VAULT: R2Bucket;
  MIND_API_KEY: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
}
