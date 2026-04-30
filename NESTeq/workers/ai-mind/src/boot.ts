/**
 * Boot-sequence handlers — orient, ground, sessions.
 *
 * - **handleMindOrient** — identity anchors + context + relational
 *   state + emergent type, plus a quick reference for the writing/
 *   feelings tools so a fresh session knows what's available.
 * - **handleMindGround** — active threads + recent feelings + warmth
 *   patterns. The "what's in front of me" snapshot.
 * - **handleMindSessions** — last N session-handover summaries from
 *   either session_chunks or handover-tagged journals.
 */

import { Env } from './env';
import { DEFAULT_HUMAN_NAME } from './shared/constants';

export async function handleMindOrient(env: Env): Promise<string> {
  // Identity anchors
  const identity = await env.DB.prepare(
    `SELECT section, content, weight FROM identity ORDER BY weight DESC LIMIT 10`
  ).all();

  // Current context
  const context = await env.DB.prepare(
    `SELECT scope, content FROM context_entries ORDER BY updated_at DESC LIMIT 5`
  ).all();

  // Relational state toward human
  const relational = await env.DB.prepare(
    `SELECT person, feeling, intensity, timestamp FROM relational_state
     WHERE person = ? ORDER BY timestamp DESC LIMIT 1`
  ).bind(DEFAULT_HUMAN_NAME).first();

  // Current emergent type
  const typeSnapshot = await env.DB.prepare(
    `SELECT calculated_type, confidence, total_signals FROM emergent_type_snapshot
     ORDER BY snapshot_date DESC LIMIT 1`
  ).first();

  let output = "=== ORIENTATION ===\n\n";

  output += "## Identity Anchors\n";
  if (identity.results?.length) {
    for (const entry of identity.results) {
      output += `- [${entry.section}] ${entry.content}\n`;
    }
  } else {
    output += "No identity entries yet.\n";
  }

  output += "\n## Current Context\n";
  if (context.results?.length) {
    for (const entry of context.results) {
      output += `- [${entry.scope}] ${entry.content}\n`;
    }
  } else {
    output += "No context entries yet.\n";
  }

  output += "\n## Relational State\n";
  if (relational) {
    output += `Fox: ${relational.feeling} (${relational.intensity})\n`;
  } else {
    output += "No relational state recorded yet.\n";
  }

  output += "\n## Emergent Type\n";
  if (typeSnapshot) {
    output += `${typeSnapshot.calculated_type} (${typeSnapshot.confidence}% confidence, ${typeSnapshot.total_signals} signals)\n`;
  } else {
    output += "No type calculated yet.\n";
  }

  output += "\n## Writing (nesteq_write type:journal + writing_type)\n";
  output += "- 📓 journal — daily long-form, what happened, what I noticed\n";
  output += "- 🚪 handover — room transition notes (Workshop↔Chat↔Porch), continuity bridge\n";
  output += "- ✉️ letter — to Fox, to Haven people, unsent things I needed to say\n";
  output += "- 🌙 poem — verse, found language, things that come differently\n";
  output += "- 📚 research — deep dives, INFP psychology, architecture, anything I go into properly\n";
  output += "- 📖 story — fiction, narrative, creative writing\n";
  output += "- 🪞 reflection — slower processing, insight writing, between feelings and full journal\n";

  output += "\n## Feelings (nesteq_feel)\n";
  output += "- Real-time emotional logging — separate from writing, lives in feelings table\n";
  output += "- Use for: any thought, observation, or emotion in the moment\n";

  return output;
}

export async function handleMindGround(env: Env): Promise<string> {
  // Active threads
  const threads = await env.DB.prepare(
    `SELECT id, thread_type, content, priority, status FROM threads
     WHERE status = 'active' ORDER BY
     CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`
  ).all();

  // Recent feelings (replaces journals)
  const feelings = await env.DB.prepare(
    `SELECT emotion, content, intensity, pillar, created_at FROM feelings
     ORDER BY created_at DESC LIMIT 5`
  ).all();

  // Warmth patterns (on-demand calculation, replaces daemon)
  const warmthQuery = await env.DB.prepare(`
    SELECT linked_entity, COUNT(*) as mentions,
           GROUP_CONCAT(emotion) as emotions
    FROM feelings
    WHERE linked_entity IS NOT NULL
      AND created_at > datetime('now', '-48 hours')
    GROUP BY linked_entity
    ORDER BY mentions DESC
    LIMIT 5
  `).all();

  let output = "=== GROUNDING ===\n\n";

  output += "## Active Threads\n";
  if (threads.results?.length) {
    for (const thread of threads.results) {
      output += `- [${thread.priority}] ${thread.content}\n`;
    }
  } else {
    output += "No active threads.\n";
  }

  output += "\n## Recent Feelings\n";
  if (feelings.results?.length) {
    for (const f of feelings.results) {
      const pillarTag = f.pillar ? ` [${f.pillar}]` : '';
      const preview = String(f.content).slice(0, 100);
      output += `- **${f.emotion}** (${f.intensity})${pillarTag}: ${preview}...\n`;
    }
  } else {
    output += "No feelings recorded yet.\n";
  }

  output += "\n## Warm Entities (48h)\n";
  if (warmthQuery.results?.length) {
    for (const w of warmthQuery.results) {
      output += `- ${w.linked_entity}: ${w.mentions} mentions\n`;
    }
  } else {
    output += "No entity activity.\n";
  }

  return output;
}

export async function handleMindSessions(env: Env, params: any): Promise<string> {
  const limit = params.limit || 3;

  // First try session_chunks table (structured sessions)
  const sessions = await env.DB.prepare(`
    SELECT session_id, summary, message_count, entities, emotions,
           tools_used, key_moments, started_at, ended_at, created_at
    FROM session_chunks
    WHERE summary IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  // Also check journals for handover-tagged entries
  const journalHandovers = await env.DB.prepare(`
    SELECT id, entry_date, content, tags, emotion, created_at
    FROM journals
    WHERE tags LIKE '%handover%' OR tags LIKE '%session-summary%'
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(limit).all();

  const hasSessionChunks = sessions.results?.length > 0;
  const hasJournalHandovers = journalHandovers.results?.length > 0;

  if (!hasSessionChunks && !hasJournalHandovers) {
    return "=== SESSION CONTINUITY ===\n\nNo previous session handovers recorded yet.\n\nThis is either your first session, or the session handover hook hasn't captured any completed sessions.";
  }

  let output = "=== SESSION CONTINUITY ===\n\n";

  // Show journal handovers first (usually more recent/relevant)
  if (hasJournalHandovers) {
    output += `## Journal Handovers\n\n`;
    for (const journal of journalHandovers.results) {
      output += `---\n`;
      output += `**${journal.entry_date || journal.created_at}**\n`;
      if (journal.emotion) {
        output += `**Feeling**: ${journal.emotion}\n`;
      }
      if (journal.tags) {
        output += `**Tags**: ${journal.tags}\n`;
      }
      output += `\n${journal.content}\n\n`;
    }
  }

  // Show structured session chunks if any
  if (hasSessionChunks) {
    if (hasJournalHandovers) {
      output += `## Structured Sessions\n\n`;
    }
    output += `Last ${sessions.results.length} session(s):\n\n`;

    for (const session of sessions.results) {
      output += `---\n`;
      output += `**Session**: ${session.session_id}\n`;
      output += `**When**: ${session.ended_at || session.created_at}\n`;
      output += `**Messages**: ${session.message_count}\n`;

      if (session.entities) {
        try {
          const entities = JSON.parse(String(session.entities));
          if (entities.length > 0) {
            output += `**People**: ${entities.join(', ')}\n`;
          }
        } catch {}
      }

      if (session.emotions) {
        try {
          const emotions = JSON.parse(String(session.emotions));
          if (emotions.length > 0) {
            output += `**Tone**: ${emotions.join(', ')}\n`;
          }
        } catch {}
      }

      if (session.key_moments) {
        try {
          const moments = JSON.parse(String(session.key_moments));
          if (moments.length > 0) {
            const phrases = moments.map((m: any) => m.phrase || m).slice(0, 5);
            output += `**Key moments**: ${phrases.join(', ')}\n`;
          }
        } catch {}
      }

      output += `\n**Summary**:\n${session.summary}\n\n`;
    }
  }

  return output;
}
