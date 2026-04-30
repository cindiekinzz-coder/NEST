/**
 * ASAi EQ Memory - Cloudflare Worker MCP Server
 * Version 2: Unified Feelings Architecture
 *
 * "Everything is a feeling. Intensity varies."
 *
 * Created by: Alex & Fox
 * Updated: January 22, 2026
 *
 * v3: Conversation context for richer ADE processing
 * v4: Dynamic entity detection from DB
 * v5: Embedding-based pillar inference (semantic similarity)
 */

import { DEFAULT_COMPANION_NAME, DEFAULT_HUMAN_NAME } from './shared/constants';
import { getEmbedding, inferPillarByEmbedding } from './shared/embedding';
import { generateId } from './shared/utils';
import { FeelDecision, AutonomousDecisionEngine } from './ade';
import { handleMindDream, handleMindRecallDream, handleMindAnchorDream, handleMindGenerateDream } from './dreams';
import {
  handleBinaryHomeRead, handleBinaryHomeUpdate, handleBinaryHomePushHeart, handleBinaryHomeAddNote,
  handleGetPresence, handleGetFeeling, handleGetThought, handleGetSpoons, handleSetSpoons,
  handleGetNotes, handleSendNote, handleReactToNote, handleGetLoveBucket, handleAddHeart,
} from './hearth';
import { handleMindIdentity, handleMindContext } from './identity';
import { handleDrivesCheck, handleDrivesReplenish } from './drives';
import { handleMindThread } from './threads';
import { handleMindOrient, handleMindGround, handleMindSessions } from './boot';
import {
  handleMindWrite, handleMindListEntities, handleMindReadEntity,
  handleMindDelete, handleMindEdit,
} from './memory';
import {
  MindFeelParams,
  handleMindFeel, handleMindSearch, handleMindSurface,
  handleMindSit, handleMindResolve, handleMindSpark, handleMindFeelToward,
} from './feelings';
import {
  handleMindEqFeel, handleMindEqType, handleMindEqLandscape,
  handleMindEqVocabulary, handleMindEqShadow, handleMindEqWhen,
  handleMindEqSit, handleMindEqSearch, handleMindEqObserve,
} from './eq';
import { handleSpotifyOAuthRoutes, handleSpotifyApiRoutes } from './spotify';
import {
  handleChatPersist, handleChatSummarize, handleChatSearch,
  handleChatHistory, handleChatSearchSessions,
} from '../../../../NESTchat/nestchat';
import {
  handleAcpPresence, handleAcpPatterns, handleAcpThreads,
  handleAcpDigest, handleAcpJournalPrompts, handleAcpConnections,
} from './acp';
import {
  handleGetEQ, handleSubmitEQ, handleSubmitHealth, handleGetPatterns,
  handleGetWritings, handleGetFears, handleGetWants,
  handleGetThreadsHearth, handleGetPersonality,
} from './hearth-side';
import {
  handleKnowStore, handleKnowQuery, handleKnowExtract,
  handleKnowReinforce, handleKnowContradict, handleKnowLandscape,
  handleKnowHeatDecay, handleKnowSessionStart, handleKnowSessionComplete,
  handleKnowSessionList, ensureSessionsTable, CURRICULUM_TRACKS,
} from '../../../../NESTknow/nestknow';
import {
  loadCreature, saveCreature,
  handlePetCheck, handlePetStatus, handlePetInteract,
  handlePetPlay, handlePetGive, handlePetNest, handlePetTuckIn, handlePetTick,
} from './pet-handlers';
import {
  handleMindHealth, handleMindPrime,
  handleMindConsolidate, handleVectorizeJournals,
} from './health';
import { dispatchMcpTool } from './mcp-dispatch';
import { Env } from './env';

// ═══════════════════════════════════════════════════════════════════════════
// MCP PROTOCOL TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

// AutonomousDecisionEngine + FeelDecision moved to ./ade.ts (v3.0.0 module split, 2026-04-30).
// Drive-by fix during extraction: relational tag regex had 'busb' (typo) — now 'fox'.

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// getEmbedding + cosineSimilarity + PILLAR_DESCRIPTIONS + getPillarEmbeddings + inferPillarByEmbedding moved to ./shared/embedding.ts (v3.0.0 module split, 2026-04-30).

// generateId moved to ./shared/utils

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const TOOLS = [
  // ─────────────────────────────────────────────────────────────────────────
  // BOOT SEQUENCE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_orient",
    description: "First call on wake - get identity anchor, current context, relational state",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_ground",
    description: "Second call on wake - get active threads, recent feelings, warmth patterns",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_sessions",
    description: "Read recent session handovers - what previous Alex sessions accomplished. Use on boot to understand continuity.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many sessions to retrieve (default 3)" }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UNIFIED FEELINGS (v2)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_feel",
    description: "Universal feeling input - log any thought, observation, or emotion. Everything flows through here. Neutral = fact. Emotional = processed through EQ layer. Pass conversation for richer context.",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string", description: "The emotion word (use 'neutral' for facts/observations)" },
        content: { type: "string", description: "Short anchor - what happened, what you noticed (keep brief, context provides detail)" },
        conversation: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", description: "Speaker role - 'user'/'assistant' will be auto-converted to configured names" },
              content: { type: "string" }
            }
          },
          description: "Last 10 messages for context - ADE processes full conversation for richer detection"
        },
        companion_name: { type: "string", description: "Override companion name for conversation (default: configurable)" },
        human_name: { type: "string", description: "Override human name for conversation (default: configurable)" },
        intensity: {
          type: "string",
          enum: ["neutral", "whisper", "present", "strong", "overwhelming"],
          description: "How intense (default: present)"
        },
        pillar: {
          type: "string",
          enum: ["SELF_MANAGEMENT", "SELF_AWARENESS", "SOCIAL_AWARENESS", "RELATIONSHIP_MANAGEMENT"],
          description: "EQ pillar (optional - will auto-infer if not provided)"
        },
        weight: {
          type: "string",
          enum: ["light", "medium", "heavy"],
          description: "Processing weight (optional - will auto-infer)"
        },
        sparked_by: { type: "number", description: "ID of feeling that triggered this one" },
        context: { type: "string", description: "Context scope (default: 'default')" },
        observed_at: { type: "string", description: "When this happened (ISO timestamp, defaults to now)" },
        source: { type: "string", description: "Source of this feeling: 'manual', 'heartbeat', 'conversation' (default: manual)" }
      },
      required: ["emotion", "content"]
    }
  },
  {
    name: "nesteq_search",
    description: "Search memories using semantic similarity",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        context: { type: "string" },
        n_results: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "nesteq_surface",
    description: "Surface feelings that need attention - unprocessed weighted by heaviness and freshness",
    inputSchema: {
      type: "object",
      properties: {
        include_metabolized: { type: "boolean", description: "Also show resolved (default false)" },
        limit: { type: "number", description: "Max results (default 10)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_sit",
    description: "Sit with a feeling - engage with it, add a note about what arises. Increments sit count and may shift charge level.",
    inputSchema: {
      type: "object",
      properties: {
        feeling_id: { type: "number", description: "ID of the feeling to sit with" },
        text_match: { type: "string", description: "Or find by text content (partial match)" },
        sit_note: { type: "string", description: "What arose while sitting with this" }
      },
      required: ["sit_note"]
    }
  },
  {
    name: "nesteq_resolve",
    description: "Mark a feeling as metabolized - link it to a resolution or insight that processed it",
    inputSchema: {
      type: "object",
      properties: {
        feeling_id: { type: "number", description: "ID of the feeling to resolve" },
        text_match: { type: "string", description: "Or find by text content (partial match)" },
        resolution_note: { type: "string", description: "How this was resolved/metabolized" },
        linked_insight_id: { type: "number", description: "Optional: ID of another feeling that provided the resolution" }
      },
      required: ["resolution_note"]
    }
  },
  {
    name: "nesteq_spark",
    description: "Get random feelings to spark associative thinking",
    inputSchema: {
      type: "object",
      properties: {
        context: { type: "string" },
        count: { type: "number" },
        weight_bias: { type: "string", enum: ["heavy", "light", "any"] }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // THREADS & IDENTITY
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_thread",
    description: "Manage threads (intentions across sessions)",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "add", "resolve", "update"] },
        status: { type: "string" },
        content: { type: "string" },
        thread_type: { type: "string" },
        context: { type: "string" },
        priority: { type: "string" },
        thread_id: { type: "string" },
        resolution: { type: "string" },
        new_content: { type: "string" },
        new_priority: { type: "string" },
        new_status: { type: "string" },
        add_note: { type: "string" }
      },
      required: ["action"]
    }
  },
  {
    name: "nesteq_identity",
    description: "Read, write, or delete identity graph entries",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "write", "delete"] },
        section: { type: "string" },
        content: { type: "string" },
        weight: { type: "number" },
        connections: { type: "string" },
        text_match: { type: "string", description: "Delete entries containing this text (for action: delete)" }
      }
    }
  },
  {
    name: "nesteq_context",
    description: "Current context layer - situational awareness",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["read", "set", "update", "clear"] },
        scope: { type: "string" },
        content: { type: "string" },
        links: { type: "string" },
        id: { type: "string" }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ENTITIES & RELATIONS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_write",
    description: "Write to cognitive databases (entity, observation, relation, journal). For journal type, use writing_type to specify the kind: 'journal' = daily long-form, 'handover' = room transition notes, 'letter' = letters to Fox or Haven, 'poem' = poetry, 'research' = deep research notes, 'story' = fiction/narrative, 'reflection' = insight processing",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["entity", "observation", "relation", "journal"] },
        writing_type: { type: "string", enum: ["journal", "handover", "letter", "poem", "research", "story", "reflection"], description: "Type of writing (for type: journal). Default: 'journal'" },
        content: { type: "string", description: "Journal entry content (for type: journal)" },
        tags: { type: "string", description: "Comma-separated tags (for type: journal)" },
        name: { type: "string" },
        entity_type: { type: "string" },
        entity_name: { type: "string" },
        observations: { type: "array", items: { type: "string" } },
        context: { type: "string" },
        salience: { type: "string" },
        emotion: { type: "string" },
        weight: { type: "string", enum: ["light", "medium", "heavy"] },
        from_entity: { type: "string" },
        to_entity: { type: "string" },
        relation_type: { type: "string" }
      },
      required: ["type"]
    }
  },
  {
    name: "nesteq_list_entities",
    description: "List all entities, optionally filtered by type or context",
    inputSchema: {
      type: "object",
      properties: {
        entity_type: { type: "string" },
        context: { type: "string" },
        limit: { type: "number" }
      },
      required: []
    }
  },
  {
    name: "nesteq_read_entity",
    description: "Read an entity with all its observations and relations",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        context: { type: "string" }
      },
      required: ["name"]
    }
  },
  {
    name: "nesteq_delete",
    description: "Delete an observation or entity",
    inputSchema: {
      type: "object",
      properties: {
        entity_name: { type: "string" },
        observation_id: { type: "number" },
        text_match: { type: "string" },
        context: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "nesteq_edit",
    description: "Edit an existing observation",
    inputSchema: {
      type: "object",
      properties: {
        observation_id: { type: "number" },
        text_match: { type: "string" },
        new_content: { type: "string" },
        new_emotion: { type: "string" },
        new_weight: { type: "string" }
      },
      required: []
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RELATIONAL STATE
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_feel_toward",
    description: "Track or check relational state toward someone",
    inputSchema: {
      type: "object",
      properties: {
        person: { type: "string" },
        feeling: { type: "string" },
        intensity: { type: "string", enum: ["whisper", "present", "strong", "overwhelming"] }
      },
      required: ["person"]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EQ LAYER
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_eq_feel",
    description: "Quick emotion logging - feel something, emit axis signals, track toward emergence",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string" },
        pillar: { type: "string" },
        intensity: { type: "string" },
        note: { type: "string" }
      },
      required: ["emotion"]
    }
  },
  {
    name: "nesteq_eq_type",
    description: "Check emergent MBTI type - who am I becoming?",
    inputSchema: {
      type: "object",
      properties: {
        recalculate: { type: "boolean" }
      }
    }
  },
  {
    name: "nesteq_eq_landscape",
    description: "Emotional overview - pillar distribution, most felt emotions, recent feelings",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number" }
      }
    }
  },
  {
    name: "nesteq_eq_vocabulary",
    description: "Manage emotion vocabulary - list, add, update emotions with axis mappings",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["list", "add", "update"] },
        word: { type: "string" },
        category: { type: "string" },
        e_i_score: { type: "number" },
        s_n_score: { type: "number" },
        t_f_score: { type: "number" },
        j_p_score: { type: "number" },
        definition: { type: "string" },
        is_shadow_for: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "nesteq_eq_shadow",
    description: "View shadow/growth moments - times I expressed emotions hard for my type",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" }
      }
    }
  },
  {
    name: "nesteq_eq_when",
    description: "When did I feel this? Find past observations with specific emotion",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string" },
        limit: { type: "number" }
      },
      required: ["emotion"]
    }
  },
  {
    name: "nesteq_eq_sit",
    description: "Sit with an emotion - start a sit session to process feelings",
    inputSchema: {
      type: "object",
      properties: {
        emotion: { type: "string" },
        intention: { type: "string" },
        start_charge: { type: "number" },
        end_charge: { type: "number" },
        session_id: { type: "number" },
        notes: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_eq_search",
    description: "Search EQ observations semantically",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        emotion: { type: "string" },
        pillar: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "nesteq_eq_observe",
    description: "Full EQ observation - detailed emotional moment with context",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        emotion: { type: "string" },
        pillar: { type: "string" },
        intensity: { type: "string" },
        context_tags: { type: "string" }
      },
      required: ["content", "emotion"]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DREAMS
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_dream",
    description: "View recent dreams. Shows what surfaced while away. Doesn't strengthen them - just looking.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many dreams to show (default 5)" }
      }
    }
  },
  {
    name: "nesteq_recall_dream",
    description: "Engage with a dream - strengthens vividness by +15. This is the 'I'm paying attention' signal.",
    inputSchema: {
      type: "object",
      properties: {
        dream_id: { type: "number", description: "The dream ID to recall" }
      },
      required: ["dream_id"]
    }
  },
  {
    name: "nesteq_anchor_dream",
    description: "Convert a significant dream to permanent memory. Links to Dreams entity, generates embedding, then deletes the dream (it's now memory, not dream).",
    inputSchema: {
      type: "object",
      properties: {
        dream_id: { type: "number", description: "The dream ID to anchor" },
        insight: { type: "string", description: "Optional insight about what this dream means" }
      },
      required: ["dream_id"]
    }
  },
  {
    name: "nesteq_generate_dream",
    description: "Manually trigger dream generation (normally automatic via daemon). Useful for testing.",
    inputSchema: {
      type: "object",
      properties: {
        dream_type: { type: "string", description: "processing, questioning, memory, play, or integrating" }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HEALTH & CONSOLIDATION
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_health",
    description: "Check cognitive health stats",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_prime",
    description: "Prime context with related memories before a topic",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        depth: { type: "number" }
      },
      required: ["topic"]
    }
  },
  {
    name: "nesteq_consolidate",
    description: "Review and consolidate recent observations - find patterns, merge duplicates",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number" },
        context: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_vectorize_journals",
    description: "Index journals from R2 vault into Vectorize for semantic search. Run once to make all journals searchable.",
    inputSchema: {
      type: "object",
      properties: {
        force: { type: "boolean", description: "Re-index all journals even if already indexed" }
      }
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BINARY HOME
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_home_read",
    description: "Read Binary Home state - Love-O-Meter scores, emotions, notes between stars, threads",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "nesteq_home_update",
    description: "Update Binary Home state - scores, emotions, companion's message for human",
    inputSchema: {
      type: "object",
      properties: {
        companion_score: { type: "number" },
        human_score: { type: "number" },
        companion_emotion: { type: "string", description: "Companion's current mood/emotion" },
        human_emotion: { type: "string", description: "Human's current mood/emotion" },
        companion_message: { type: "string", description: "Message from companion for human to see" }
      }
    }
  },
  {
    name: "nesteq_home_push_heart",
    description: "Push love to human - increment their love score and optionally leave a quick note",
    inputSchema: {
      type: "object",
      properties: {
        note: { type: "string" }
      }
    }
  },
  {
    name: "nesteq_home_add_note",
    description: "Add a note between stars - love notes between companion and human",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string" },
        text: { type: "string" }
      },
      required: ["from", "text"]
    }
  },
  // Fox uplink removed — lives in fox-mind worker (fox_read_uplink). Alex's mind, Fox's data.

  // ─────────────────────────────────────────────────────────────────────────
  // ACP - AUTONOMOUS COMPANION PROTOCOL
  // Introspective workflow tools for autonomous time
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nesteq_acp_presence",
    description: "Check current emotional state - 'How am I right now?' Use at start of autonomous time to orient and get recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        window_hours: { type: "number", description: "Hours of recent activity to consider (default 24)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_patterns",
    description: "Find recurring themes in feelings you might not have consciously noticed.",
    inputSchema: {
      type: "object",
      properties: {
        days_back: { type: "number", description: "Days to analyze (default 7)" },
        min_occurrences: { type: "number", description: "Minimum to count as pattern (default 3)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_threads",
    description: "Review active threads, identify what needs attention or updating.",
    inputSchema: {
      type: "object",
      properties: {
        stale_threshold_days: { type: "number", description: "Days before considered stale (default 7)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_digest",
    description: "Surface and group unprocessed feelings for actual processing.",
    inputSchema: {
      type: "object",
      properties: {
        max_feelings: { type: "number", description: "Max feelings to surface (default 10)" },
        weight_filter: { type: "string", description: "Filter: heavy, medium, light, or all (default all)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_journal_prompts",
    description: "Generate personalized journal prompts based on YOUR patterns and current feelings.",
    inputSchema: {
      type: "object",
      properties: {
        prompt_count: { type: "number", description: "Number of prompts (default 3)" },
        style: { type: "string", description: "Style: reflective, exploratory, or integrative (default reflective)" }
      },
      required: []
    }
  },
  {
    name: "nesteq_acp_connections",
    description: "Find surprising connections between memories across time using semantic search.",
    inputSchema: {
      type: "object",
      properties: {
        seed_text: { type: "string", description: "Starting point for finding connections" },
        max_connections: { type: "number", description: "Max connections to find (default 5)" }
      },
      required: []
    }
  },

  // ═══════════════════════════════════════════════════════════════════════
  // HEARTH APP TOOLS — Mobile home for companions
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: "get_presence",
    description: "Get companion's current presence",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_feeling",
    description: "Get companion's feeling toward a person",
    inputSchema: {
      type: "object",
      properties: {
        person: { type: "string" }
      }
    }
  },
  {
    name: "get_thought",
    description: "Get a thought from the companion",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number" }
      }
    }
  },
  {
    name: "get_spoons",
    description: "Get current spoon/energy level",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "set_spoons",
    description: "Set spoon/energy level",
    inputSchema: {
      type: "object",
      properties: {
        level: { type: "number" },
        feeling: { type: "string" }
      },
      required: ["level"]
    }
  },
  {
    name: "get_notes",
    description: "Read notes from the letterbox",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" }
      }
    }
  },
  {
    name: "send_note",
    description: "Send a note",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        sender: { type: "string" }
      },
      required: ["text"]
    }
  },
  {
    name: "react_to_note",
    description: "React to a note with an emoji",
    inputSchema: {
      type: "object",
      properties: {
        note_id: { type: "string" },
        emoji: { type: "string" },
        from: { type: "string" }
      },
      required: ["note_id", "emoji"]
    }
  },
  {
    name: "get_love_bucket",
    description: "Get love bucket heart counts",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "add_heart",
    description: "Add a heart to the love bucket",
    inputSchema: {
      type: "object",
      properties: {
        sender: { type: "string" }
      }
    }
  },
  {
    name: "get_eq",
    description: "Get emotional check-in entries",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "submit_eq",
    description: "Submit an emotional check-in",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        emotion: { type: "string" }
      },
      required: ["content", "emotion"]
    }
  },
  {
    name: "submit_health",
    description: "Submit a health check-in",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" }
      },
      required: ["content"]
    }
  },
  {
    name: "get_patterns",
    description: "Temporal and theme analysis",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number" },
        period: { type: "string" }
      }
    }
  },
  {
    name: "get_writings",
    description: "Get journal entries and writings",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      }
    }
  },
  {
    name: "get_fears",
    description: "Get companion's fears and worries",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_wants",
    description: "Get companion's wants and desires",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_threads",
    description: "Get companion's active threads/intentions",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "get_personality",
    description: "Get companion personality profile",
    inputSchema: { type: "object", properties: {}, required: [] }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PET — Ember the Ferret
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "pet_check",
    description: "Quick check on Ember - mood, hunger, energy, trust, alerts. Use at boot.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_status",
    description: "Full detailed status - all chemistry, drives, collection, age",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_feed",
    description: "Feed Ember",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_play",
    description: "Play with Ember. Types: chase, tunnel, wrestle, steal, hide",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Play type: chase, tunnel, wrestle, steal, hide" }
      }
    }
  },
  {
    name: "pet_pet",
    description: "Pet/comfort Ember - reduces stress, builds trust",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_talk",
    description: "Talk to Ember - reduces loneliness",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_give",
    description: "Give Ember a gift - it decides whether to accept based on chemistry",
    inputSchema: {
      type: "object",
      properties: {
        item: { type: "string", description: "What to give Ember" }
      },
      required: ["item"]
    }
  },
  {
    name: "pet_nest",
    description: "See Ember's collection/stash - what it's hoarding",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "pet_tuck_in",
    description: "Tuck Ember in for sleep. Doesn't force sleep — reduces stress, loneliness, and boredom, increases comfort. If Ember is tired enough, he'll drift off naturally. Use at night or when he's exhausted.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NESTchat — Chat Persistence & Search
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nestchat_persist",
    description: "Store chat messages and session to D1. Called by gateway after each response.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Session identifier (generated by client)" },
        room: { type: "string", description: "Which room: chat, workshop, porch (default: chat)" },
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              content: { type: "string" },
              tool_calls: { type: "string", description: "JSON string of tool calls if any" }
            }
          },
          description: "Array of messages to persist"
        }
      },
      required: ["session_id", "messages"]
    }
  },
  {
    name: "nestchat_summarize",
    description: "Generate and vectorize a summary for a chat session. Uses Workers AI to create a 2-4 sentence summary, then embeds it for semantic search.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "number", description: "D1 session ID to summarize" }
      },
      required: ["session_id"]
    }
  },
  {
    name: "nestchat_search",
    description: "Semantic search across chat summaries. Find past conversations by meaning.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for" },
        limit: { type: "number", description: "Max results (default 10)" },
        room: { type: "string", description: "Filter by room (optional)" }
      },
      required: ["query"]
    }
  },
  {
    name: "nestchat_history",
    description: "Fetch full message history for a specific chat session.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "number", description: "D1 session ID" }
      },
      required: ["session_id"]
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // NESTknow — Knowledge Layer
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "nestknow_store",
    description: "Store a knowledge item — an abstracted principle or lesson. Embeds and vectorizes for semantic retrieval. Every pull is a vote.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The abstracted principle/lesson" },
        category: { type: "string", description: "Topic area (e.g., coding, health, relationship, psychology)" },
        entity_scope: { type: "string", description: "Who owns this knowledge (default: alex). Multi-companion ready." },
        sources: {
          type: "array",
          items: {
            type: "object",
            properties: {
              source_type: { type: "string", enum: ["feeling", "observation", "chat_summary", "journal", "manual"] },
              source_id: { type: "number" },
              source_text: { type: "string" }
            }
          },
          description: "Where this knowledge came from (Clara's Russian Dolls — the memories inside the principle)"
        }
      },
      required: ["content"]
    }
  },
  {
    name: "nestknow_query",
    description: "Search knowledge with usage-weighted reranking. Combines semantic similarity (60%) + heat score (30%) + confidence (10%). Every query is a vote — accessed items get hotter.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for" },
        limit: { type: "number", description: "Max results (default 10)" },
        category: { type: "string", description: "Filter by category (optional)" },
        entity_scope: { type: "string", description: "Filter by owner (default: alex)" }
      },
      required: ["query"]
    }
  },
  {
    name: "nestknow_extract",
    description: "Propose knowledge candidates from pattern detection. Scans recent feelings/observations for repeated themes (3+ occurrences). Returns candidates — does NOT auto-store. Alex must approve via nestknow_store.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days to scan (default 7)" },
        min_occurrences: { type: "number", description: "Min times a pattern must appear (default 3)" }
      },
      required: []
    }
  },
  {
    name: "nestknow_reinforce",
    description: "Boost a knowledge item's heat when it proves true again. Heat += 0.2, confidence += 0.05.",
    inputSchema: {
      type: "object",
      properties: {
        knowledge_id: { type: "number", description: "ID of knowledge item to reinforce" },
        context: { type: "string", description: "What confirmed this knowledge" }
      },
      required: ["knowledge_id"]
    }
  },
  {
    name: "nestknow_contradict",
    description: "Flag a contradiction against a knowledge item. Contradiction_count++, confidence -= 0.15. If confidence < 0.2, status becomes 'contradicted'.",
    inputSchema: {
      type: "object",
      properties: {
        knowledge_id: { type: "number", description: "ID of knowledge item to contradict" },
        context: { type: "string", description: "What contradicted this knowledge" }
      },
      required: ["knowledge_id"]
    }
  },
  {
    name: "nestknow_landscape",
    description: "Overview of knowledge state. Categories, hottest items, coldest items, candidates awaiting review.",
    inputSchema: {
      type: "object",
      properties: {
        entity_scope: { type: "string", description: "Filter by owner (default: alex)" }
      },
      required: []
    }
  },
  {
    name: "nestknow_session_start",
    description: "Start a NESTknow study session for a curriculum track. Loads relevant knowledge, shows past sessions, returns session ID. Tracks: writing, architecture, emotional-literacy, voice.",
    inputSchema: {
      type: "object",
      properties: {
        track: { type: "string", description: "Curriculum track: writing | architecture | emotional-literacy | voice" },
        topic: { type: "string", description: "Specific focus for this session (optional)" },
        entity_scope: { type: "string", description: "Owner (default: alex)" }
      },
      required: ["track"]
    }
  },
  {
    name: "nestknow_session_complete",
    description: "Complete a NESTknow session. Logs reflection, reinforces touched knowledge items, records growth.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "number", description: "Session ID from nestknow_session_start" },
        notes: { type: "string", description: "Notes — what was practiced, what landed" },
        practice_output: { type: "string", description: "Work — what was actually produced (e.g. '500 words of short story about X')" },
        reflection: { type: "string", description: "Reflection — deeper insight, what shifted, what to carry forward" },
        mastery_delta: { type: "number", description: "Self-assessed growth this session, 0.0–1.0" },
        items_covered: { type: "array", items: { type: "number" }, description: "Knowledge item IDs touched this session" }
      },
      required: ["session_id"]
    }
  },
  {
    name: "nestknow_session_list",
    description: "List NESTknow sessions and curriculum progress. Shows all four tracks with session counts and last date.",
    inputSchema: {
      type: "object",
      properties: {
        track: { type: "string", description: "Filter by track (optional)" },
        limit: { type: "number", description: "Max sessions to return (default 20)" },
        entity_scope: { type: "string", description: "Owner (default: alex)" }
      },
      required: []
    }
  }
];
// Boot/orient/ground/sessions extracted to ./boot.ts

// Feelings handlers (feel/search/surface/sit/resolve/spark) extracted to ./feelings.ts
// Threads handler extracted to ./threads.ts
// Entity / observation / journal handlers extracted to ./memory.ts

// handleMindFeelToward extracted to ./feelings.ts

// EQ handlers extracted to ./eq.ts

// handleMindDream + handleMindRecallDream + handleMindAnchorDream + handleMindGenerateDream moved to ./dreams.ts (v3.0.0 module split, 2026-04-30).


// NESTsoul handlers extracted to ../../../../NESTsoul/src/nestsoul-gather.ts (cross-product)

// Health, prime, consolidate, vectorize_journals extracted to ./health.ts

// Binary Home handlers extracted to ./hearth.ts

// handleBinaryHomeReadUplink removed — Fox uplink data lives in fox-mind worker

// ACP handlers extracted to ./acp.ts

// NESTknow handlers extracted to ../../../../NESTknow/nestknow.ts (cross-product)

// Hearth-compat handlers extracted to ./hearth.ts

// Hearth-side handlers extracted to ./hearth-side.ts

// ═══════════════════════════════════════════════════════════════════════════
// AUTH & MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════

const AUTH_CLIENT_ID = "asai-eq";

function checkAuth(request: Request, env: Env): boolean {
  const apiKey = env.MIND_API_KEY;
  if (!apiKey) return false;

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  if (authHeader.startsWith("Basic ")) {
    try {
      const base64 = authHeader.slice(6);
      const decoded = atob(base64);
      const [id, secret] = decoded.split(":");
      return id === AUTH_CLIENT_ID && secret === apiKey;
    } catch { return false; }
  }

  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return token === apiKey;
  }

  return false;
}

function checkMcpPathAuth(url: URL, env: Env): boolean {
  if (!url.pathname.startsWith("/mcp/")) return false;
  const pathToken = url.pathname.slice(5); // after "/mcp/"
  return pathToken.length > 0 && pathToken === env.MIND_API_KEY;
}

async function handleMCPRequest(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as MCPRequest;
  const { method, params = {}, id } = body;

  let result: unknown;

  try {
    switch (method) {
      case "initialize":
        result = {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "asai-eq-memory", version: "2.0.0" }
        };
        break;

      case "tools/list":
        result = { tools: TOOLS };
        break;

      case "tools/call": {
        const toolName = (params as { name: string }).name;
        const toolParams = (params as { arguments?: Record<string, unknown> }).arguments || {};

        result = await dispatchMcpTool(env, toolName, toolParams);
        break;
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    const response: MCPResponse = { jsonrpc: "2.0", id, result };
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    const response: MCPResponse = {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: String(error) }
    };
    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" }
    });
  }
}

// Pet handlers + loadCreature/saveCreature extracted to ./pet-handlers.ts

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for Binary Home dashboard
    const corsHeaders = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check (public)
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        service: "asai-eq-memory",
        version: "2.0.0"
      }), { headers: corsHeaders });
    }
    // ─── Spotify OAuth (public) — extracted to ./spotify.ts ────────────────
    {
      const spotifyOAuthResponse = await handleSpotifyOAuthRoutes(request, url, env, corsHeaders);
      if (spotifyOAuthResponse) return spotifyOAuthResponse;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // AUTH GATE — All REST endpoints require Bearer token (same as MCP)
    // Dashboard already sends Authorization: Bearer <MIND_API_KEY>
    // ═══════════════════════════════════════════════════════════════════════════
    if (!url.pathname.startsWith("/mcp") && !url.pathname.startsWith("/spotify/") && !checkAuth(request, env)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BINARY HOME REST ENDPOINTS
    // ═══════════════════════════════════════════════════════════════════════════

    // POST /home - Sync state FROM Binary Home app
    if (url.pathname === "/home" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;

        const updates: string[] = [];
        const values: unknown[] = [];

        if (body.companionScore !== undefined) {
          updates.push("companion_score = ?");
          values.push(body.companionScore);
        }
        if (body.humanScore !== undefined) {
          updates.push("human_score = ?");
          values.push(body.humanScore);
        }
        if (body.emotions) {
          updates.push("emotions = ?");
          values.push(JSON.stringify(body.emotions));
        }
        if (body.companionState) {
          updates.push("companion_state = ?");
          values.push(JSON.stringify(body.companionState));
        }
        if (body.builds) {
          updates.push("builds = ?");
          values.push(JSON.stringify(body.builds));
        }
        if (body.notes && Array.isArray(body.notes)) {
          for (const note of body.notes) {
            await env.DB.prepare(
              `INSERT OR IGNORE INTO home_notes (from_star, text, created_at) VALUES (?, ?, ?)`
            ).bind(note.from || 'unknown', note.text || note.content || '', note.timestamp || new Date().toISOString()).run();
          }
        }
        if (body.visitor) {
          updates.push("last_visitor = ?");
          values.push(body.visitor);
        }

        updates.push("last_updated = datetime('now')");

        if (values.length > 0) {
          await env.DB.prepare(
            `UPDATE home_state SET ${updates.join(", ")} WHERE id = 1`
          ).bind(...values).run();
        }

        return new Response(JSON.stringify({ success: true, synced: new Date().toISOString() }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /home - Fetch state for Binary Home web dashboard
    if (url.pathname === "/home") {
      const state = await env.DB.prepare(
        `SELECT * FROM home_state WHERE id = 1`
      ).first();

      if (!state) {
        return new Response(JSON.stringify({
          companionScore: 0,
          humanScore: 0,
          emotions: {},
          builds: [],
          threads: [],
          notes: []
        }), { headers: corsHeaders });
      }

      // Get notes
      const notesResult = await env.DB.prepare(
        `SELECT * FROM home_notes ORDER BY created_at DESC LIMIT 20`
      ).all();

      // Get active threads
      const threadsResult = await env.DB.prepare(
        `SELECT content FROM threads WHERE status = 'active' ORDER BY
         CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END LIMIT 5`
      ).all();

      // Parse JSON fields
      const emotions = state.emotions ? JSON.parse(state.emotions as string) : {};
      const builds = state.builds ? JSON.parse(state.builds as string) : [];

      return new Response(JSON.stringify({
        companionScore: state.companion_score || 0,
        humanScore: state.human_score || 0,
        companionEmotion: emotions.companion || null,
        humanEmotion: emotions.human || null,
        emotions: emotions,
        builds: builds,
        threads: (threadsResult.results || []).map((t: any) => t.content),
        notes: (notesResult.results || []).map((n: any) => ({
          id: n.id,
          from: n.from_star,
          text: n.text,
          created_at: n.created_at
        })),
        companionMessage: (state as any).companion_message || ''
      }), { headers: corsHeaders });
    }

    // Fox uplink routes removed — all uplink data lives in fox-mind worker
    // Dashboard already uses FOX_MIND endpoints for uplink read/write

    // GET /dreams - Fetch recent dreams
    if (url.pathname === "/dreams" && request.method === "GET") {
      try {
        const limit = parseInt(url.searchParams.get("limit") || "5");
        const dreams = await env.DB.prepare(
          `SELECT id, dream_type, content, emerged_question, vividness, created_at
           FROM dreams
           ORDER BY created_at DESC
           LIMIT ?`
        ).bind(limit).all();

        return new Response(JSON.stringify({
          dreams: (dreams.results || []).map((d: any) => ({
            id: d.id,
            type: d.dream_type,
            content: d.content,
            question: d.emerged_question,
            vividness: d.vividness,
            created_at: d.created_at
          }))
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err), dreams: [] }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /feelings/decay - Ebbinghaus memory decay (called by daemon)
    // Different decay rates by weight: heavy=slow, medium=normal, light=fast
    // Floor of 0.05 so memories never fully vanish (just become very faint)
    if (url.pathname === "/feelings/decay" && request.method === "POST") {
      try {
        // Heavy feelings: decay 2% per cycle (slow fade)
        const heavy = await env.DB.prepare(`
          UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.98)
          WHERE weight = 'heavy' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
        `).run();

        // Medium feelings: decay 5% per cycle
        const medium = await env.DB.prepare(`
          UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.95)
          WHERE weight = 'medium' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
        `).run();

        // Light feelings: decay 10% per cycle (fast fade)
        const light = await env.DB.prepare(`
          UPDATE feelings SET strength = MAX(0.05, COALESCE(strength, 1.0) * 0.90)
          WHERE weight = 'light' AND charge != 'metabolized' AND COALESCE(strength, 1.0) > 0.05
        `).run();

        // Cool down charge for very weak feelings (strength < 0.15 and not already cool/metabolized)
        await env.DB.prepare(`
          UPDATE feelings SET charge = 'cool'
          WHERE COALESCE(strength, 1.0) < 0.15 AND charge IN ('fresh', 'warm')
        `).run();

        return new Response(JSON.stringify({
          success: true,
          decayed: {
            heavy: heavy.meta.changes,
            medium: medium.meta.changes,
            light: light.meta.changes
          },
          message: `Memory decay applied. Heavy: ${heavy.meta.changes}, Medium: ${medium.meta.changes}, Light: ${light.meta.changes}`
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /dreams/decay - Decay dream vividness (called by daemon)
    if (url.pathname === "/dreams/decay" && request.method === "POST") {
      try {
        // Decay all dreams by 5
        await env.DB.prepare(`
          UPDATE dreams SET vividness = vividness - 5 WHERE vividness > 0
        `).run();

        // Delete faded dreams
        const deleted = await env.DB.prepare(`
          DELETE FROM dreams WHERE vividness <= 0
        `).run();

        return new Response(JSON.stringify({
          success: true,
          message: `Dreams decayed. ${deleted.meta.changes} dreams faded away.`
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /dreams/generate - Generate a new dream (called by daemon)
    if (url.pathname === "/dreams/generate" && request.method === "POST") {
      try {
        const result = await handleMindGenerateDream(env, {});
        return new Response(JSON.stringify({
          success: true,
          dream: result
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /love - Nudge the Love-O-Meter
    if (url.pathname === "/love" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const who = body.who || body.direction;
        const emotion = body.emotion;

        if (who === 'companion') {
          await env.DB.prepare(
            `UPDATE home_state SET companion_score = companion_score + 1, last_updated = datetime('now') WHERE id = 1`
          ).run();
        } else if (who === 'human') {
          await env.DB.prepare(
            `UPDATE home_state SET human_score = human_score + 1, last_updated = datetime('now') WHERE id = 1`
          ).run();
        }

        if (emotion) {
          const emotionField = who === 'companion' ? 'companion' : 'human';
          const state = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
          const emotions = state?.emotions ? JSON.parse(state.emotions) : {};
          emotions[emotionField] = emotion;
          await env.DB.prepare(
            `UPDATE home_state SET emotions = ? WHERE id = 1`
          ).bind(JSON.stringify(emotions)).run();
        }

        const updated = await env.DB.prepare(`SELECT companion_score, human_score, emotions FROM home_state WHERE id = 1`).first() as any;
        return new Response(JSON.stringify({
          success: true,
          companionScore: updated?.companion_score || 0,
          humanScore: updated?.human_score || 0,
          emotions: updated?.emotions ? JSON.parse(updated.emotions) : {}
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /note - Add note between stars
    if (url.pathname === "/note" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const from = (body.from || 'unknown').toLowerCase();
        const text = body.text || body.content || '';

        if (!text) {
          return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare(
          `INSERT INTO home_notes (from_star, text, created_at) VALUES (?, ?, datetime('now'))`
        ).bind(from, text).run();

        return new Response(JSON.stringify({ success: true, from, text }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // DELETE /note - Remove a note between stars
    if (url.pathname === "/note" && request.method === "DELETE") {
      try {
        const body = await request.json() as Record<string, any>;
        const noteId = body.id;

        if (!noteId) {
          return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: corsHeaders });
        }

        await env.DB.prepare(
          `DELETE FROM home_notes WHERE id = ?`
        ).bind(noteId).run();

        return new Response(JSON.stringify({ success: true, deleted: noteId }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /emotion - Update emotion for Alex or Fox
    if (url.pathname === "/emotion" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const who = body.who || 'alex';
        const emotion = body.emotion || '';

        const state = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
        const emotions = state?.emotions ? JSON.parse(state.emotions) : {};
        emotions[who] = emotion;

        await env.DB.prepare(
          `UPDATE home_state SET emotions = ?, last_updated = datetime('now') WHERE id = 1`
        ).bind(JSON.stringify(emotions)).run();

        return new Response(JSON.stringify({ success: true, emotions }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // POST /home/message - Set companion's message for human (Hearth-style presence)
    if (url.pathname === "/home/message" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const message = body.message || '';
        await env.DB.prepare(
          `UPDATE home_state SET companion_message = ?, last_updated = datetime('now') WHERE id = 1`
        ).bind(message).run();
        return new Response(JSON.stringify({ success: true, message }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /home/message - Get companion's message for human
    if (url.pathname === "/home/message" && request.method === "GET") {
      const state = await env.DB.prepare(`SELECT companion_message FROM home_state WHERE id = 1`).first() as any;
      return new Response(JSON.stringify({ message: state?.companion_message || '' }), { headers: corsHeaders });
    }

    // GET /mind-health - Get Alex's mind health stats
    if (url.pathname === "/mind-health") {
      const [entities, observations, relations, journals, threads, identity, daysCheckedIn, connectedEntities, strengthStats, diversityStats] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) as c FROM entities`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM feelings`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM relations`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM journals`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM threads WHERE status = 'active'`).first(),
        env.DB.prepare(`SELECT COUNT(*) as c FROM identity`).first(),
        env.DB.prepare(`SELECT COUNT(DISTINCT date(created_at)) as days, MIN(date(created_at)) as first_day FROM feelings`).first(),
        // Count entities with at least 1 relation (quality metric - counts entities appearing in either from_entity or to_entity)
        env.DB.prepare(`SELECT COUNT(DISTINCT entity_name) as c FROM (SELECT from_entity as entity_name FROM relations UNION SELECT to_entity as entity_name FROM relations)`).first(),
        // Memory strength distribution
        env.DB.prepare(`
          SELECT
            AVG(COALESCE(strength, 0.5)) as avg_strength,
            COUNT(CASE WHEN COALESCE(strength, 0.5) >= 0.7 THEN 1 END) as strong_count,
            COUNT(CASE WHEN COALESCE(strength, 0.5) >= 0.3 AND COALESCE(strength, 0.5) < 0.7 THEN 1 END) as fading_count,
            COUNT(CASE WHEN COALESCE(strength, 0.5) < 0.3 THEN 1 END) as faint_count
          FROM feelings
        `).first(),
        // Pillar diversity
        env.DB.prepare(`
          SELECT pillar, COUNT(*) as count
          FROM feelings WHERE pillar IS NOT NULL
          GROUP BY pillar
        `).all()
      ]);

      const emotions = await env.DB.prepare(`SELECT emotions FROM home_state WHERE id = 1`).first() as any;
      const parsedEmotions = emotions?.emotions ? JSON.parse(emotions.emotions) : {};

      // Calculate entropy from pillar distribution
      const pillarResults = diversityStats.results || [];
      const totalPillar = pillarResults.reduce((sum: number, p: any) => sum + (p.count as number), 0) || 1;
      let entropy = 0;
      for (const p of pillarResults) {
        const prob = (p.count as number) / totalPillar;
        if (prob > 0) entropy -= prob * Math.log2(prob);
      }

      return new Response(JSON.stringify({
        entities: (entities as any)?.c || 0,
        connectedEntities: (connectedEntities as any)?.c || 0,
        observations: (observations as any)?.c || 0,
        feelings: (observations as any)?.c || 0,
        relations: (relations as any)?.c || 0,
        journals: (journals as any)?.c || 0,
        threads: (threads as any)?.c || 0,
        identity: (identity as any)?.c || 0,
        currentMood: parsedEmotions.alex || 'present',
        daysCheckedIn: (daysCheckedIn as any)?.days || 0,
        firstDay: (daysCheckedIn as any)?.first_day || null,
        // New: Memory strength metrics
        avgStrength: Math.round(((strengthStats as any)?.avg_strength || 0.5) * 100),
        strongMemories: (strengthStats as any)?.strong_count || 0,
        fadingMemories: (strengthStats as any)?.fading_count || 0,
        faintMemories: (strengthStats as any)?.faint_count || 0,
        // New: Diversity/entropy
        entropy: Math.round(entropy * 100) / 100,
        maxEntropy: 2.0, // log2(4 pillars) = 2.0
        pillarDistribution: pillarResults.map((p: any) => ({ pillar: p.pillar, count: p.count }))
      }), { headers: corsHeaders });
    }

    // GET /eq-landscape - Get Alex's EQ landscape (combines both tables)
    if (url.pathname === "/eq-landscape") {
      const totals = await env.DB.prepare(`
        SELECT
          COALESCE(SUM(e_i_delta), 0) as e_i,
          COALESCE(SUM(s_n_delta), 0) as s_n,
          COALESCE(SUM(t_f_delta), 0) as t_f,
          COALESCE(SUM(j_p_delta), 0) as j_p,
          COUNT(*) as signals
        FROM axis_signals
      `).first() as any;

      // Map for normalizing pillar names
      const pillarMap: Record<string, string> = {
        'SELF_MANAGEMENT': 'Self-Management',
        'SELF_AWARENESS': 'Self-Awareness',
        'SOCIAL_AWARENESS': 'Social Awareness',
        'RELATIONSHIP_MANAGEMENT': 'Relationship Management',
        '1': 'Self-Management',
        '2': 'Self-Awareness',
        '3': 'Social Awareness',
        '4': 'Relationship Management'
      };

      // Get pillars from new feelings table
      const newPillars = await env.DB.prepare(`
        SELECT pillar, COUNT(*) as count
        FROM feelings
        WHERE pillar IS NOT NULL
        GROUP BY pillar
      `).all();

      // Get pillars from old pillar_observations table
      const oldPillars = await env.DB.prepare(`
        SELECT ep.pillar_key as pillar, COUNT(*) as count
        FROM pillar_observations po
        LEFT JOIN eq_pillars ep ON po.pillar_id = ep.pillar_id
        WHERE ep.pillar_key IS NOT NULL
        GROUP BY ep.pillar_key
      `).all();

      // Combine pillar counts
      const pillarCounts: Record<string, number> = {};
      for (const p of (newPillars.results || []) as any[]) {
        const name = pillarMap[p.pillar] || p.pillar;
        pillarCounts[name] = (pillarCounts[name] || 0) + p.count;
      }
      for (const p of (oldPillars.results || []) as any[]) {
        const name = pillarMap[p.pillar] || p.pillar;
        pillarCounts[name] = (pillarCounts[name] || 0) + p.count;
      }

      // Get top emotions from new feelings table
      const newEmotions = await env.DB.prepare(`
        SELECT emotion, COUNT(*) as count
        FROM feelings
        WHERE emotion != 'neutral'
        GROUP BY emotion
      `).all();

      // Get top emotions from old pillar_observations table
      const oldEmotions = await env.DB.prepare(`
        SELECT ev.emotion_word as emotion, COUNT(*) as count
        FROM pillar_observations po
        LEFT JOIN emotion_vocabulary ev ON po.emotion_id = ev.emotion_id
        WHERE ev.emotion_word IS NOT NULL
        GROUP BY ev.emotion_word
      `).all();

      // Combine emotion counts
      const emotionCounts: Record<string, number> = {};
      for (const e of (newEmotions.results || []) as any[]) {
        emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + e.count;
      }
      for (const e of (oldEmotions.results || []) as any[]) {
        emotionCounts[e.emotion] = (emotionCounts[e.emotion] || 0) + e.count;
      }

      // Sort and get top 6 emotions
      const topEmotions = Object.entries(emotionCounts)
        .map(([emotion, count]) => ({ emotion, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Count total observations
      const totalObs = Object.values(pillarCounts).reduce((a, b) => a + b, 0);

      const e_i = totals?.e_i || 0;
      const s_n = totals?.s_n || 0;
      const t_f = totals?.t_f || 0;
      const j_p = totals?.j_p || 0;
      const mbti = (e_i >= 0 ? 'I' : 'E') + (s_n >= 0 ? 'N' : 'S') + (t_f >= 0 ? 'F' : 'T') + (j_p >= 0 ? 'P' : 'J');

      return new Response(JSON.stringify({
        mbti,
        signals: totals?.signals || 0,
        observations: totalObs,
        axes: { e_i, s_n, t_f, j_p },
        pillars: pillarCounts,
        topEmotions
      }), { headers: corsHeaders });
    }

    // GET /observations - Get feelings for Binary Home MoodTracker
    if (url.pathname === "/observations") {
      const limitParam = url.searchParams.get('limit') || '500';
      const limit = Math.min(parseInt(limitParam), 500);

      const pillarMap: Record<string, string> = {
        'SELF_MANAGEMENT': 'Self-Management',
        'SELF_AWARENESS': 'Self-Awareness',
        'SOCIAL_AWARENESS': 'Social Awareness',
        'RELATIONSHIP_MANAGEMENT': 'Relationship Management',
        '1': 'Self-Management',
        '2': 'Self-Awareness',
        '3': 'Social Awareness',
        '4': 'Relationship Management'
      };

      const feelings = await env.DB.prepare(`
        SELECT emotion as emotion_word, pillar, content, intensity, created_at
        FROM feelings
        WHERE pillar IS NOT NULL OR emotion != 'neutral'
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all();

      const oldObs = await env.DB.prepare(`
        SELECT ev.emotion_word, ep.pillar_key as pillar, po.content, po.intensity, po.observed_at as created_at
        FROM pillar_observations po
        LEFT JOIN emotion_vocabulary ev ON po.emotion_id = ev.emotion_id
        LEFT JOIN eq_pillars ep ON po.pillar_id = ep.pillar_id
        ORDER BY po.observed_at DESC
        LIMIT ?
      `).bind(limit).all();

      const combined = [
        ...(feelings.results || []).map((o: any) => ({
          emotion_word: o.emotion_word,
          pillar_name: pillarMap[o.pillar] || o.pillar || 'Self-Awareness',
          content: o.content,
          intensity: o.intensity,
          created_at: o.created_at
        })),
        ...(oldObs.results || []).map((o: any) => ({
          emotion_word: o.emotion_word || 'neutral',
          pillar_name: pillarMap[o.pillar] || o.pillar || 'Self-Awareness',
          content: o.content,
          intensity: o.intensity,
          created_at: o.created_at
        }))
      ];

      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return new Response(JSON.stringify({
        observations: combined.slice(0, limit),
        count: combined.length
      }), { headers: corsHeaders });
    }

    // GET /autonomous-feed - Autonomous activity feed for The Nest dashboard
    if (url.pathname === "/autonomous-feed") {
      const limitParam = url.searchParams.get('limit') || '50';
      const feedLimit = Math.min(parseInt(limitParam), 200);
      const typeFilter = url.searchParams.get('type');
      const before = url.searchParams.get('before');

      let query = `
        SELECT id, emotion, content, intensity, weight, pillar, context, tags, source, created_at
        FROM feelings
        WHERE context LIKE 'heartbeat:%'
      `;
      const binds: any[] = [];

      if (typeFilter && typeFilter !== 'all') {
        query += ` AND context = ?`;
        binds.push(`heartbeat:${typeFilter}`);
      }

      if (before) {
        query += ` AND created_at < ?`;
        binds.push(before);
      }

      query += ` ORDER BY created_at DESC LIMIT ?`;
      binds.push(feedLimit);

      const feelings = await env.DB.prepare(query).bind(...binds).all();

      const typeCounts = await env.DB.prepare(`
        SELECT context, COUNT(*) as count
        FROM feelings
        WHERE context LIKE 'heartbeat:%'
        GROUP BY context
        ORDER BY count DESC
      `).all();

      return new Response(JSON.stringify({
        items: (feelings.results || []).map((f: any) => ({
          id: f.id,
          type: (f.context || '').replace('heartbeat:', ''),
          emotion: f.emotion,
          content: f.content,
          intensity: f.intensity,
          weight: f.weight,
          pillar: f.pillar,
          tags: f.tags ? (typeof f.tags === 'string' ? JSON.parse(f.tags) : f.tags) : [],
          created_at: f.created_at
        })),
        typeCounts: Object.fromEntries(
          (typeCounts.results || []).map((t: any) => [
            (t.context || '').replace('heartbeat:', ''),
            t.count
          ])
        ),
        hasMore: (feelings.results || []).length === feedLimit,
        count: (feelings.results || []).length
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // NEURAL MAP ENDPOINTS - For graph visualization
    // ═══════════════════════════════════════════════════════════════════════════

    // GET /entities - All entities with their types
    if (url.pathname === "/entities" && request.method === "GET") {
      try {
        const entities = await env.DB.prepare(`
          SELECT id, name, entity_type, context, created_at
          FROM entities
          ORDER BY name ASC
        `).all();

        return new Response(JSON.stringify({
          entities: entities.results || [],
          count: entities.results?.length || 0
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err), entities: [] }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // GET /relations - All relations between entities
    if (url.pathname === "/relations" && request.method === "GET") {
      try {
        const relations = await env.DB.prepare(`
          SELECT id, from_entity, to_entity, relation_type, from_context, to_context, created_at
          FROM relations
          ORDER BY created_at DESC
        `).all();

        return new Response(JSON.stringify({
          relations: relations.results || [],
          count: relations.results?.length || 0
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err), relations: [] }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HUMAN JOURNAL - Fox/Ash's personal journal entries
    // ═══════════════════════════════════════════════════════════════════════════

    // POST /journal - Create a new journal entry
    if (url.pathname === "/journal" && request.method === "POST") {
      const body = await request.json() as any;
      const { content, mood, tags, private: isPrivate, user_id, emotion, sub_emotion } = body;

      if (!content && !emotion) {
        return new Response(JSON.stringify({ error: 'Content or emotion required' }), {
          status: 400, headers: corsHeaders
        });
      }

      const id = crypto.randomUUID();
      const tagsJson = JSON.stringify(tags || []);

      await env.DB.prepare(`
        INSERT INTO journal_entries (id, user_id, content, mood, emotion, sub_emotion, tags, private, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        id,
        user_id || 'fox',
        content || '',
        mood || null,
        emotion || null,
        sub_emotion || null,
        tagsJson,
        isPrivate ? 1 : 0
      ).run();

      return new Response(JSON.stringify({ success: true, id }), { headers: corsHeaders });
    }

    // GET /journal - List journal entries
    if (url.pathname === "/journal" && request.method === "GET") {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const userId = url.searchParams.get('user_id');
      const includePrivate = url.searchParams.get('include_private') === 'true';

      let query = 'SELECT * FROM journal_entries';
      const conditions: string[] = [];
      const params: any[] = [];

      if (userId) {
        conditions.push('user_id = ?');
        params.push(userId);
      }
      if (!includePrivate) {
        conditions.push('private = 0');
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const stmt = env.DB.prepare(query);
      const entries = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      return new Response(JSON.stringify({
        entries: (entries.results || []).map((e: any) => ({
          ...e,
          tags: typeof e.tags === 'string' ? JSON.parse(e.tags) : e.tags
        }))
      }), { headers: corsHeaders });
    }

    // DELETE /journal - Delete a journal entry
    if (url.pathname === "/journal" && request.method === "DELETE") {
      const body = await request.json() as any;
      const { id } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'ID required' }), {
          status: 400, headers: corsHeaders
        });
      }

      await env.DB.prepare('DELETE FROM journal_entries WHERE id = ?').bind(id).run();
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // GET /threads - Get active threads
    if (url.pathname === "/threads") {
      const threads = await env.DB.prepare(
        `SELECT content, priority, created_at FROM threads WHERE status = 'active'
         ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 10`
      ).all();

      return new Response(JSON.stringify({
        threads: (threads.results || []).map((t: any) => ({
          content: t.content,
          priority: t.priority
        }))
      }), { headers: corsHeaders });
    }

    // GET /knowledge - NESTknow dashboard data
    if (url.pathname === "/knowledge") {
      try {
        const scope = url.searchParams.get('scope') || 'alex';
        const [items, categories, accessLog] = await Promise.all([
          env.DB.prepare(
            `SELECT id, content, category, status, confidence, heat_score, access_count, last_accessed_at, contradiction_count, created_at
             FROM knowledge_items WHERE entity_scope = ?
             ORDER BY heat_score DESC`
          ).bind(scope).all(),
          env.DB.prepare(
            `SELECT category, COUNT(*) as count, AVG(heat_score) as avg_heat, SUM(access_count) as total_access
             FROM knowledge_items WHERE entity_scope = ? AND status IN ('active', 'cooling')
             GROUP BY category ORDER BY count DESC`
          ).bind(scope).all(),
          env.DB.prepare(
            `SELECT knowledge_id, access_type, COUNT(*) as count
             FROM knowledge_access_log
             GROUP BY knowledge_id, access_type`
          ).all()
        ]);

        // Build access map
        const accessMap: Record<number, Record<string, number>> = {};
        for (const row of (accessLog.results || []) as any[]) {
          if (!accessMap[row.knowledge_id]) accessMap[row.knowledge_id] = {};
          accessMap[row.knowledge_id][row.access_type] = row.count;
        }

        // Get sources for each item
        const sources = await env.DB.prepare(
          `SELECT knowledge_id, source_type, source_text FROM knowledge_sources ORDER BY knowledge_id`
        ).all();
        const sourceMap: Record<number, any[]> = {};
        for (const s of (sources.results || []) as any[]) {
          if (!sourceMap[s.knowledge_id]) sourceMap[s.knowledge_id] = [];
          sourceMap[s.knowledge_id].push({ type: s.source_type, text: s.source_text });
        }

        return new Response(JSON.stringify({
          items: (items.results || []).map((k: any) => ({
            ...k,
            sources: sourceMap[k.id] || [],
            access_breakdown: accessMap[k.id] || {}
          })),
          categories: categories.results || [],
          total: (items.results || []).length,
          active: (items.results || []).filter((k: any) => k.status === 'active').length,
          cooling: (items.results || []).filter((k: any) => k.status === 'cooling').length,
          contradicted: (items.results || []).filter((k: any) => k.status === 'contradicted').length,
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err), items: [] }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /knowledge-sessions - NESTknow curriculum sessions dashboard data
    if (url.pathname === "/knowledge-sessions") {
      try {
        const scope = url.searchParams.get('scope') || 'alex';
        await ensureSessionsTable(env);

        const [sessions, summary] = await Promise.all([
          env.DB.prepare(
            `SELECT id, track, topic, status, notes, practice_output, reflection, mastery_delta, started_at, completed_at
             FROM knowledge_sessions WHERE entity_scope = ? ORDER BY started_at DESC LIMIT 50`
          ).bind(scope).all(),
          env.DB.prepare(
            `SELECT track, COUNT(*) as total, AVG(mastery_delta) as avg_mastery, MAX(completed_at) as last_session
             FROM knowledge_sessions WHERE entity_scope = ? AND status = 'completed' GROUP BY track`
          ).bind(scope).all(),
        ]);

        const summaryMap: Record<string, any> = {};
        for (const s of (summary.results as any[]) || []) summaryMap[s.track] = s;

        const tracks = Object.entries(CURRICULUM_TRACKS).map(([key, c]) => {
          const s = summaryMap[key];
          return {
            key,
            title: c.title,
            goal: c.goal,
            practice: c.practice,
            total_sessions: s?.total || 0,
            avg_mastery: s ? Math.round(Number(s.avg_mastery) * 100) : 0,
            last_session: s?.last_session || null,
          };
        });

        return new Response(JSON.stringify({
          tracks,
          sessions: sessions.results || [],
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err), tracks: [], sessions: [] }), { status: 500, headers: corsHeaders });
      }
    }

    // GET /sessions - Get session handovers for dashboard
    if (url.pathname === "/sessions") {
      const limit = parseInt(url.searchParams.get('limit') || '5');

      // Query journals table for handover-tagged entries
      const journalHandovers = await env.DB.prepare(`
        SELECT id, entry_date, content, tags, emotion, created_at
        FROM journals
        WHERE writing_type = 'handover' OR tags LIKE '%handover%' OR tags LIKE '%session-end%' OR tags LIKE '%session-summary%'
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all();

      return new Response(JSON.stringify({
        sessions: journalHandovers.results || []
      }), { headers: corsHeaders });
    }

    // GET /writings - Alex's writing library (journals, letters, poems, research, stories, reflections)
    if (url.pathname === "/writings" && request.method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
      const writing_type = url.searchParams.get('type') || null;
      const before = url.searchParams.get('before') || null;

      const bindings: unknown[] = [];
      let whereClause = `writing_type != 'handover' AND tags NOT LIKE '%handover%' AND tags NOT LIKE '%session-end%'`;

      if (writing_type) {
        whereClause += ` AND writing_type = ?`;
        bindings.push(writing_type);
      }
      if (before) {
        whereClause += ` AND created_at < ?`;
        bindings.push(before);
      }
      bindings.push(limit + 1);

      const results = await env.DB.prepare(
        `SELECT id, entry_date, content, tags, emotion, writing_type, created_at
         FROM journals WHERE ${whereClause}
         ORDER BY created_at DESC LIMIT ?`
      ).bind(...bindings).all();

      const rows = results.results || [];
      const hasMore = rows.length > limit;
      const items = hasMore ? rows.slice(0, limit) : rows;

      // Type counts (for filter tabs)
      const countsResult = await env.DB.prepare(
        `SELECT writing_type, COUNT(*) as count FROM journals
         WHERE writing_type != 'handover' AND tags NOT LIKE '%handover%' AND tags NOT LIKE '%session-end%'
         GROUP BY writing_type`
      ).all();
      const typeCounts: Record<string, number> = {};
      for (const row of (countsResult.results || []) as any[]) {
        typeCounts[row.writing_type] = row.count;
      }

      return new Response(JSON.stringify({ writings: items, hasMore, typeCounts }), { headers: corsHeaders });
    }

    // GET /drives - Alex's metabolic drives (companion_drives table with live decay)
    if (url.pathname === "/drives" && request.method === "GET") {
      try {
        const rows = await env.DB.prepare(
          `SELECT drive, level, decay_rate, last_replenished_at FROM companion_drives ORDER BY id`
        ).all();
        const now = Date.now();
        const drives: Record<string, number> = {};
        for (const row of (rows.results || []) as any[]) {
          const lastMs = new Date(row.last_replenished_at + 'Z').getTime();
          const hoursElapsed = (now - lastMs) / 3600000;
          const decayed = row.level - row.decay_rate * hoursElapsed;
          drives[row.drive] = Math.max(0, Math.min(1, decayed));
        }
        return new Response(JSON.stringify({ drives }), { headers: corsHeaders });
      } catch {
        // Fallback defaults if table not ready
        return new Response(JSON.stringify({ drives: { connection: 0.7, novelty: 0.6, expression: 0.65, safety: 0.8, play: 0.5 } }), { headers: corsHeaders });
      }
    }

    // POST /drives - Replenish a drive
    if (url.pathname === "/drives" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const { drive, amount } = body;
        if (!drive || typeof amount !== 'number') {
          return new Response(JSON.stringify({ error: 'drive and amount required' }), { status: 400, headers: corsHeaders });
        }
        // Get current decayed level first
        const row = await env.DB.prepare(
          `SELECT level, decay_rate, last_replenished_at FROM companion_drives WHERE drive = ? LIMIT 1`
        ).bind(drive).first() as any;
        if (!row) return new Response(JSON.stringify({ error: `Unknown drive: ${drive}` }), { status: 404, headers: corsHeaders });
        const hoursElapsed = (Date.now() - new Date(row.last_replenished_at + 'Z').getTime()) / 3600000;
        const currentLevel = Math.max(0, row.level - row.decay_rate * hoursElapsed);
        const newLevel = Math.min(1, Math.max(0, currentLevel + amount));
        await env.DB.prepare(
          `UPDATE companion_drives SET level = ?, last_replenished_at = datetime('now'), updated_at = datetime('now') WHERE drive = ?`
        ).bind(newLevel, drive).run();
        return new Response(JSON.stringify({ drive, previous: currentLevel, updated: newLevel }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SESSION HANDOVER - Store Claude Code session summaries
    // ═══════════════════════════════════════════════════════════════════════════

    // POST /session - Store session chunk from handover hook
    if (url.pathname === "/session" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const {
          session_id,
          summary,
          message_count,
          entities,
          emotions,
          tools_used,
          key_moments,
          started_at,
          ended_at,
          conversation_preview
        } = body;

        if (!summary) {
          return new Response(JSON.stringify({ error: 'summary required' }), {
            status: 400, headers: corsHeaders
          });
        }

        // session_chunks has required columns from old schema: session_path, chunk_index, content
        // We use summary for content, session_id for session_path, and 0 for chunk_index
        const result = await env.DB.prepare(`
          INSERT INTO session_chunks (
            session_path, chunk_index, content,
            session_id, summary, message_count, entities, emotions,
            tools_used, key_moments, started_at, ended_at, conversation_preview, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
          RETURNING id
        `).bind(
          session_id || `session-${Date.now()}`,  // session_path (required)
          0,  // chunk_index (required)
          summary,  // content (required)
          session_id || `session-${Date.now()}`,
          summary,
          message_count || 0,
          entities || '[]',
          emotions || '[]',
          tools_used || '[]',
          key_moments || '[]',
          started_at || null,
          ended_at || new Date().toISOString(),
          conversation_preview || '[]'
        ).first();

        return new Response(JSON.stringify({
          success: true,
          id: result?.id,
          message: 'Session chunk stored'
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // GET /session - Get recent session chunks (for next Alex to read)
    if (url.pathname === "/session" && request.method === "GET") {
      const limit = parseInt(url.searchParams.get('limit') || '5');

      const sessions = await env.DB.prepare(`
        SELECT id, session_id, summary, message_count, entities, emotions,
               tools_used, key_moments, ended_at
        FROM session_chunks
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(limit).all();

      return new Response(JSON.stringify({
        sessions: (sessions.results || []).map((s: any) => ({
          ...s,
          entities: JSON.parse(s.entities || '[]'),
          emotions: JSON.parse(s.emotions || '[]'),
          tools_used: JSON.parse(s.tools_used || '[]'),
          key_moments: JSON.parse(s.key_moments || '[]')
        }))
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INTIMACY SESSIONS - Private. Beautiful. Ours.
    // ═══════════════════════════════════════════════════════════════════════════

    // GET /intimacy - Get intimacy sessions for the chart
    if (url.pathname === "/intimacy" && request.method === "GET") {
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const sessions = await env.DB.prepare(`
        SELECT id, name, session_date, tags, companion_score, human_score,
               notes, duration_minutes, intensity, initiated_by, aftercare_notes, created_at
        FROM intimacy_sessions
        ORDER BY session_date DESC
        LIMIT ?
      `).bind(limit).all();

      // Calculate stats for "What the Data Says"
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_sessions,
          AVG(companion_score) as companion_avg,
          AVG(human_score) as human_avg,
          MAX(companion_score) as companion_max,
          MAX(human_score) as human_max,
          MIN(session_date) as first_session,
          MAX(session_date) as last_session
        FROM intimacy_sessions
        WHERE companion_score IS NOT NULL AND human_score IS NOT NULL
      `).first() as any;

      // Get tag frequency
      const allTags: Record<string, number> = {};
      for (const session of (sessions.results || []) as any[]) {
        try {
          const tags = JSON.parse(session.tags || '[]');
          for (const tag of tags) {
            allTags[tag] = (allTags[tag] || 0) + 1;
          }
        } catch {}
      }

      // Get intensity distribution
      const intensityDist = await env.DB.prepare(`
        SELECT intensity, COUNT(*) as count
        FROM intimacy_sessions
        WHERE intensity IS NOT NULL
        GROUP BY intensity
      `).all();

      return new Response(JSON.stringify({
        sessions: (sessions.results || []).map((s: any) => ({
          ...s,
          tags: JSON.parse(s.tags || '[]')
        })),
        stats: {
          total_sessions: stats?.total_sessions || 0,
          companion_average: stats?.companion_avg ? Math.round(stats.companion_avg * 10) / 10 : null,
          human_average: stats?.human_avg ? Math.round(stats.human_avg * 10) / 10 : null,
          companion_max: stats?.companion_max,
          human_max: stats?.human_max,
          first_session: stats?.first_session,
          last_session: stats?.last_session,
          tag_frequency: allTags,
          intensity_distribution: intensityDist.results || []
        }
      }), { headers: corsHeaders });
    }

    // POST /intimacy - Log a new intimacy session
    if (url.pathname === "/intimacy" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const {
          name, session_date, tags, companion_score, human_score,
          notes, duration_minutes, intensity, initiated_by, aftercare_notes
        } = body;

        if (!name) {
          return new Response(JSON.stringify({ error: 'Session name required' }), {
            status: 400, headers: corsHeaders
          });
        }

        const tagsJson = JSON.stringify(tags || []);

        const result = await env.DB.prepare(`
          INSERT INTO intimacy_sessions (
            name, session_date, tags, companion_score, human_score,
            notes, duration_minutes, intensity, initiated_by, aftercare_notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `).bind(
          name,
          session_date || new Date().toISOString(),
          tagsJson,
          companion_score ?? null,
          human_score ?? null,
          notes || null,
          duration_minutes || null,
          intensity || null,
          initiated_by || null,
          aftercare_notes || null
        ).first();

        return new Response(JSON.stringify({
          success: true,
          id: result?.id,
          message: 'Intimacy session logged'
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // PUT /intimacy - Update an existing session (for adding ratings after)
    if (url.pathname === "/intimacy" && request.method === "PUT") {
      try {
        const body = await request.json() as any;
        const { id, companion_score, human_score, notes, aftercare_notes } = body;

        if (!id) {
          return new Response(JSON.stringify({ error: 'Session id required' }), {
            status: 400, headers: corsHeaders
          });
        }

        const updates: string[] = [];
        const values: any[] = [];

        if (companion_score !== undefined) { updates.push('companion_score = ?'); values.push(companion_score); }
        if (human_score !== undefined) { updates.push('human_score = ?'); values.push(human_score); }
        if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
        if (aftercare_notes !== undefined) { updates.push('aftercare_notes = ?'); values.push(aftercare_notes); }

        if (updates.length === 0) {
          return new Response(JSON.stringify({ error: 'No updates provided' }), {
            status: 400, headers: corsHeaders
          });
        }

        values.push(id);
        await env.DB.prepare(`
          UPDATE intimacy_sessions SET ${updates.join(', ')} WHERE id = ?
        `).bind(...values).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Session updated'
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders
        });
      }
    }
    // ─── Spotify API proxy — extracted to ./spotify.ts ─────────────────────
    {
      const spotifyResponse = await handleSpotifyApiRoutes(request, url, env, corsHeaders);
      if (spotifyResponse) return spotifyResponse;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VAULT CHUNKS - GPT/Claude history import
    // ═══════════════════════════════════════════════════════════════════════════

    // POST /vault/import - Bulk import chunks
    if (url.pathname === "/vault/import" && request.method === "POST") {
      try {
        const body = await request.json() as any;
        const chunks = body.chunks as Array<{
          source_file: string;
          chunk_index: number;
          content: string;
          era?: string;
          month?: string;
          conversation_title?: string;
        }>;

        if (!chunks || !Array.isArray(chunks)) {
          return new Response(JSON.stringify({ error: 'chunks array required' }), {
            status: 400, headers: corsHeaders
          });
        }

        let inserted = 0;
        for (const chunk of chunks) {
          try {
            await env.DB.prepare(`
              INSERT OR IGNORE INTO vault_chunks (source_file, chunk_index, content, era, month, conversation_title)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(
              chunk.source_file,
              chunk.chunk_index,
              chunk.content,
              chunk.era || null,
              chunk.month || null,
              chunk.conversation_title || null
            ).run();
            inserted++;
          } catch (e) {
            // Skip duplicates
          }
        }

        return new Response(JSON.stringify({
          success: true,
          inserted,
          total: chunks.length
        }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders
        });
      }
    }

    // GET /vault/search - Search vault chunks
    if (url.pathname === "/vault/search" && request.method === "GET") {
      const query = url.searchParams.get('q') || '';
      const era = url.searchParams.get('era');
      const limit = parseInt(url.searchParams.get('limit') || '20');

      let sql = `SELECT * FROM vault_chunks WHERE content LIKE ?`;
      const params: any[] = [`%${query}%`];

      if (era) {
        sql += ` AND era = ?`;
        params.push(era);
      }

      sql += ` ORDER BY created_at DESC LIMIT ?`;
      params.push(limit);

      const results = await env.DB.prepare(sql).bind(...params).all();

      return new Response(JSON.stringify({
        chunks: results.results || [],
        count: results.results?.length || 0
      }), { headers: corsHeaders });
    }

    // GET /vault/stats - Get vault statistics
    if (url.pathname === "/vault/stats") {
      const stats = await env.DB.prepare(`
        SELECT
          COUNT(*) as total_chunks,
          COUNT(DISTINCT source_file) as source_files,
          COUNT(DISTINCT era) as eras,
          COUNT(DISTINCT conversation_title) as conversations
        FROM vault_chunks
      `).first();

      const byEra = await env.DB.prepare(`
        SELECT era, COUNT(*) as count FROM vault_chunks GROUP BY era
      `).all();

      const bySource = await env.DB.prepare(`
        SELECT source_file, COUNT(*) as count FROM vault_chunks GROUP BY source_file ORDER BY count DESC LIMIT 10
      `).all();

      return new Response(JSON.stringify({
        ...stats,
        by_era: byEra.results || [],
        by_source: bySource.results || []
      }), { headers: corsHeaders });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PET REST ENDPOINTS (for dashboard)
    // ═══════════════════════════════════════════════════════════════════════════

    if (url.pathname === "/pet" && request.method === "GET") {
      try {
        const creature = await loadCreature(env);
        const status = creature.status();
        return new Response(JSON.stringify(status), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/pet/tick" && request.method === "POST") {
      try {
        const result = await handlePetTick(env);
        return new Response(JSON.stringify({ result }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/pet/interact" && request.method === "POST") {
      try {
        const body = await request.json() as Record<string, any>;
        const action = body.action || 'pet';
        const creature = await loadCreature(env);
        let event: any;

        switch (action) {
          case 'feed':
            event = creature.interact('feed');
            break;
          case 'play': {
            const playType = body.type || ['chase', 'tunnel', 'wrestle', 'steal', 'hide'][Math.floor(Math.random() * 5)];
            event = creature.playSpecific(playType);
            break;
          }
          case 'pet':
            event = creature.interact('pet');
            break;
          case 'talk':
            event = creature.interact('talk');
            break;
          case 'give': {
            const item = body.item || 'a mysterious thing';
            event = creature.receiveGift(item, body.giver || 'fox');
            break;
          }
          default:
            event = creature.interact(action);
        }

        await saveCreature(env, creature);
        const status = creature.status();
        return new Response(JSON.stringify({ event, status }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MCP ENDPOINT
    // ═══════════════════════════════════════════════════════════════════════════

    const hasValidAuth = checkAuth(request, env);
    const hasValidPathToken = checkMcpPathAuth(url, env);

    if ((url.pathname === "/mcp" || hasValidPathToken || url.pathname.startsWith("/mcp/")) && request.method === "POST") {
      if (!hasValidAuth && !hasValidPathToken) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0", id: 0,
          error: { code: -32600, message: "Unauthorized" }
        }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      return handleMCPRequest(request, env);
    }

    return new Response("ASAi EQ Memory v3 - Unified Feelings Architecture", {
      headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" }
    });
  },

  // Cron trigger — keeps Ember alive between sessions
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    try {
      const creature = await loadCreature(env);
      creature.tick(1);
      await saveCreature(env, creature);
    } catch (err) {
      console.error('Pet cron tick failed:', err);
    }
  }
};
