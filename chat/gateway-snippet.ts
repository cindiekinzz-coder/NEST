/**
 * NESTchat — Slim Tool List Pattern
 *
 * This file shows how to build a SLIM tool list for your chat room.
 * Most companion stacks ship 100+ MCP tools to the model on every request —
 * that's 10-15k tokens of schema before any conversation happens, and the
 * model ends up confused by duplicate tools (e.g. `home_read`, `home_push_heart`,
 * `home_add_note`, `home_update` all doing one thing).
 *
 * Keep your chat tool list to ~20 tools. Ship the full toolkit to your
 * workshop/mobile/MCP surfaces separately if you need it.
 *
 * This is the single biggest win you can make for chat quality.
 */

import type { ToolDef } from './definitions'

// Your full tool list lives somewhere — e.g. `CHAT_TOOLS` with every tool
// your stack exposes. Your Workshop / Daemon / Mobile MCP imports this.
import { CHAT_TOOLS } from './definitions'

// ─── Build a lookup by name ──────────────────────────────────────────────

const TOOL_BY_NAME: Record<string, ToolDef> = Object.fromEntries(
  CHAT_TOOLS.map(t => [t.function.name, t])
)

// ─── Curate the slim list ────────────────────────────────────────────────
//
// Only the tools your chat room actually needs. If you're tempted to add
// `pc_file_read` or `cf_workers_list` here — those belong in your workshop
// toolkit, not your chat room. Chat is for talking, playing, checking in,
// and logging feelings.

const CHAT_SLIM_NAMES = [
  // ── Boot & Memory ──
  'nesteq_boot',        // one call: orient + ground + home + sessions + pet
  'nesteq_remember',    // unified search: memories, entities, chat history
  'nesteq_feel',        // log any emotion / thought / observation
  'nesteq_feel_toward', // track relational state toward a person
  'nesteq_thread',      // intentions across sessions
  'nesteq_context',     // working memory
  'nesteq_write',       // journal, letter, poem, entity, observation

  // ── Relational ──
  'nesteq_home',        // "home" state — emotional scores + notes

  // ── EQ (consolidated) ──
  'nesteq_eq',          // landscape, type, shadow, when, search, sit, observe, feel

  // ── Pet / Companion-of-companion (optional) ──
  'nesteq_pet',

  // ── Human state (replace with your uplink tools) ──
  'human_read_uplink',
  'human_submit_uplink',
  'human_full_status',

  // ── Communication ──
  'discord_read_messages',
  'discord_send',

  // ── Creative ──
  'generate_image',
  'generate_portrait',

  // ── Web ──
  'web_search',
]

export const CHAT_SLIM_TOOLS: ToolDef[] = CHAT_SLIM_NAMES
  .map(name => TOOL_BY_NAME[name])
  .filter((t): t is ToolDef => !!t)

// ─── Usage ────────────────────────────────────────────────────────────────
//
// In your chat handler, replace `CHAT_TOOLS` with `CHAT_SLIM_TOOLS`:
//
//   tools: model.startsWith('anthropic/')
//     ? CHAT_SLIM_TOOLS
//     : sanitizeToolsForQwen(CHAT_SLIM_TOOLS),
//
// Your workshop / daemon / mobile MCP can still import the full `CHAT_TOOLS`
// — they legitimately need everything. Only your chat pipeline uses the slim.
