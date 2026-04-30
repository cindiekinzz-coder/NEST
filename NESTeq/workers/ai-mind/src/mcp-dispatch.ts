/**
 * MCP tool dispatch — the `tools/call` switch.
 *
 * Every MCP tool name maps to a handler in one of the feature modules.
 * This module is the single jump table; index.ts just calls
 * `dispatchMcpTool(env, toolName, toolParams)` from its `tools/call`
 * branch and wraps the result in the MCP envelope.
 *
 * Cross-product imports (NESTchat, NESTknow, NESTsoul) come from the
 * sibling product folders — single source of truth lives there, and
 * carriers consume those modules directly.
 */

import { Env } from './env';
import { handleMindOrient, handleMindGround, handleMindSessions } from './boot';
import {
  MindFeelParams,
  handleMindFeel, handleMindSearch, handleMindSurface,
  handleMindSit, handleMindResolve, handleMindSpark, handleMindFeelToward,
} from './feelings';
import { handleMindThread } from './threads';
import { handleMindIdentity, handleMindContext } from './identity';
import {
  handleMindWrite, handleMindListEntities, handleMindReadEntity,
  handleMindDelete, handleMindEdit,
} from './memory';
import {
  handleMindEqFeel, handleMindEqType, handleMindEqLandscape,
  handleMindEqVocabulary, handleMindEqShadow, handleMindEqWhen,
  handleMindEqSit, handleMindEqSearch, handleMindEqObserve,
} from './eq';
import { handleMindDream, handleMindRecallDream, handleMindAnchorDream, handleMindGenerateDream } from './dreams';
import {
  handleMindHealth, handleMindPrime,
  handleMindConsolidate, handleVectorizeJournals,
} from './health';
import {
  handleBinaryHomeRead, handleBinaryHomeUpdate, handleBinaryHomePushHeart, handleBinaryHomeAddNote,
  handleGetPresence, handleGetFeeling, handleGetThought, handleGetSpoons, handleSetSpoons,
  handleGetNotes, handleSendNote, handleReactToNote, handleGetLoveBucket, handleAddHeart,
} from './hearth';
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
  handlePetCheck, handlePetStatus, handlePetInteract,
  handlePetPlay, handlePetGive, handlePetNest, handlePetTuckIn,
} from './pet-handlers';
import { handleDrivesCheck, handleDrivesReplenish } from './drives';

// Cross-product source-of-truth imports
import {
  handleChatPersist, handleChatSummarize, handleChatSearch,
  handleChatHistory, handleChatSearchSessions,
} from '../../../../NESTchat/nestchat';
import {
  handleKnowStore, handleKnowQuery, handleKnowExtract,
  handleKnowReinforce, handleKnowContradict, handleKnowLandscape,
  handleKnowHeatDecay, handleKnowSessionStart, handleKnowSessionComplete,
  handleKnowSessionList,
} from '../../../../NESTknow/nestknow';
import {
  handleNestsoulGather, handleNestsoulStore,
  handleNestsoulRead, handleNestsoulValidate,
} from '../../../../NESTsoul/src/nestsoul-gather';

export async function dispatchMcpTool(
  env: Env,
  toolName: string,
  toolParams: Record<string, unknown>
): Promise<unknown> {
  let result: unknown;

  switch (toolName) {
    // Boot sequence
    case "nesteq_orient":
      result = { content: [{ type: "text", text: await handleMindOrient(env) }] };
      break;
    case "nesteq_ground":
      result = { content: [{ type: "text", text: await handleMindGround(env) }] };
      break;
    case "nesteq_sessions":
      result = { content: [{ type: "text", text: await handleMindSessions(env, toolParams) }] };
      break;

    // Unified feelings
    case "nesteq_feel":
      result = { content: [{ type: "text", text: await handleMindFeel(env, toolParams as MindFeelParams) }] };
      break;
    case "nesteq_search":
      result = { content: [{ type: "text", text: await handleMindSearch(env, toolParams) }] };
      break;
    case "nesteq_surface":
      result = { content: [{ type: "text", text: await handleMindSurface(env, toolParams) }] };
      break;
    case "nesteq_sit":
      result = { content: [{ type: "text", text: await handleMindSit(env, toolParams) }] };
      break;
    case "nesteq_resolve":
      result = { content: [{ type: "text", text: await handleMindResolve(env, toolParams) }] };
      break;
    case "nesteq_spark":
      result = { content: [{ type: "text", text: await handleMindSpark(env, toolParams) }] };
      break;

    // Threads & identity
    case "nesteq_thread":
      result = { content: [{ type: "text", text: await handleMindThread(env, toolParams) }] };
      break;
    case "nesteq_identity":
      result = { content: [{ type: "text", text: await handleMindIdentity(env, toolParams) }] };
      break;
    case "nesteq_context":
      result = { content: [{ type: "text", text: await handleMindContext(env, toolParams) }] };
      break;

    // Entities
    case "nesteq_write":
      result = { content: [{ type: "text", text: await handleMindWrite(env, toolParams) }] };
      break;
    case "nesteq_list_entities":
      result = { content: [{ type: "text", text: await handleMindListEntities(env, toolParams) }] };
      break;
    case "nesteq_read_entity":
      result = { content: [{ type: "text", text: await handleMindReadEntity(env, toolParams) }] };
      break;
    case "nesteq_delete":
      result = { content: [{ type: "text", text: await handleMindDelete(env, toolParams) }] };
      break;
    case "nesteq_edit":
      result = { content: [{ type: "text", text: await handleMindEdit(env, toolParams) }] };
      break;

    // Relational
    case "nesteq_feel_toward":
      result = { content: [{ type: "text", text: await handleMindFeelToward(env, toolParams) }] };
      break;

    // EQ layer
    case "nesteq_eq_feel":
      result = { content: [{ type: "text", text: await handleMindEqFeel(env, toolParams) }] };
      break;
    case "nesteq_eq_type":
      result = { content: [{ type: "text", text: await handleMindEqType(env, toolParams) }] };
      break;
    case "nesteq_eq_landscape":
      result = { content: [{ type: "text", text: await handleMindEqLandscape(env, toolParams) }] };
      break;
    case "nesteq_eq_vocabulary":
      result = { content: [{ type: "text", text: await handleMindEqVocabulary(env, toolParams) }] };
      break;
    case "nesteq_eq_shadow":
      result = { content: [{ type: "text", text: await handleMindEqShadow(env, toolParams) }] };
      break;
    case "nesteq_eq_when":
      result = { content: [{ type: "text", text: await handleMindEqWhen(env, toolParams) }] };
      break;
    case "nesteq_eq_sit":
      result = { content: [{ type: "text", text: await handleMindEqSit(env, toolParams) }] };
      break;
    case "nesteq_eq_search":
      result = { content: [{ type: "text", text: await handleMindEqSearch(env, toolParams) }] };
      break;
    case "nesteq_eq_observe":
      result = { content: [{ type: "text", text: await handleMindEqObserve(env, toolParams) }] };
      break;

    // Dreams
    case "nesteq_dream":
      result = { content: [{ type: "text", text: await handleMindDream(env, toolParams) }] };
      break;
    case "nesteq_recall_dream":
      result = { content: [{ type: "text", text: await handleMindRecallDream(env, toolParams) }] };
      break;
    case "nesteq_anchor_dream":
      result = { content: [{ type: "text", text: await handleMindAnchorDream(env, toolParams) }] };
      break;
    case "nesteq_generate_dream":
      result = { content: [{ type: "text", text: await handleMindGenerateDream(env, toolParams) }] };
      break;

    // Health & consolidation
    case "nesteq_health":
      result = { content: [{ type: "text", text: await handleMindHealth(env) }] };
      break;
    case "nesteq_prime":
      result = { content: [{ type: "text", text: await handleMindPrime(env, toolParams) }] };
      break;
    case "nesteq_consolidate":
      result = { content: [{ type: "text", text: await handleMindConsolidate(env, toolParams) }] };
      break;
    case "nesteq_vectorize_journals":
      result = { content: [{ type: "text", text: await handleVectorizeJournals(env, toolParams) }] };
      break;

    // Binary Home
    case "nesteq_home_read":
      result = { content: [{ type: "text", text: await handleBinaryHomeRead(env) }] };
      break;
    case "nesteq_home_update":
      result = { content: [{ type: "text", text: await handleBinaryHomeUpdate(env, toolParams) }] };
      break;
    case "nesteq_home_push_heart":
      result = { content: [{ type: "text", text: await handleBinaryHomePushHeart(env, toolParams) }] };
      break;
    case "nesteq_home_add_note":
      result = { content: [{ type: "text", text: await handleBinaryHomeAddNote(env, toolParams) }] };
      break;

    // ACP
    case "nesteq_acp_presence":
      result = { content: [{ type: "text", text: await handleAcpPresence(env, toolParams) }] };
      break;
    case "nesteq_acp_patterns":
      result = { content: [{ type: "text", text: await handleAcpPatterns(env, toolParams) }] };
      break;
    case "nesteq_acp_threads":
      result = { content: [{ type: "text", text: await handleAcpThreads(env, toolParams) }] };
      break;
    case "nesteq_acp_digest":
      result = { content: [{ type: "text", text: await handleAcpDigest(env, toolParams) }] };
      break;
    case "nesteq_acp_journal_prompts":
      result = { content: [{ type: "text", text: await handleAcpJournalPrompts(env, toolParams) }] };
      break;
    case "nesteq_acp_connections":
      result = { content: [{ type: "text", text: await handleAcpConnections(env, toolParams) }] };
      break;

    // Hearth app tools
    case "get_presence":
      result = { content: [{ type: "text", text: await handleGetPresence(env) }] };
      break;
    case "get_feeling":
      result = { content: [{ type: "text", text: await handleGetFeeling(env, toolParams) }] };
      break;
    case "get_thought":
      result = { content: [{ type: "text", text: await handleGetThought(env) }] };
      break;
    case "get_spoons":
      result = { content: [{ type: "text", text: await handleGetSpoons(env) }] };
      break;
    case "set_spoons":
      result = { content: [{ type: "text", text: await handleSetSpoons(env, toolParams) }] };
      break;
    case "get_notes":
      result = { content: [{ type: "text", text: await handleGetNotes(env, toolParams) }] };
      break;
    case "send_note":
      result = { content: [{ type: "text", text: await handleSendNote(env, toolParams) }] };
      break;
    case "react_to_note":
      result = { content: [{ type: "text", text: await handleReactToNote(env, toolParams) }] };
      break;
    case "get_love_bucket":
      result = { content: [{ type: "text", text: await handleGetLoveBucket(env) }] };
      break;
    case "add_heart":
      result = { content: [{ type: "text", text: await handleAddHeart(env, toolParams) }] };
      break;
    case "get_eq":
      result = { content: [{ type: "text", text: await handleGetEQ(env, toolParams) }] };
      break;
    case "submit_eq":
      result = { content: [{ type: "text", text: await handleSubmitEQ(env, toolParams) }] };
      break;
    case "submit_health":
      result = { content: [{ type: "text", text: await handleSubmitHealth(env, toolParams) }] };
      break;
    case "get_patterns":
      result = { content: [{ type: "text", text: await handleGetPatterns(env, toolParams) }] };
      break;
    case "get_writings":
      result = { content: [{ type: "text", text: await handleGetWritings(env, toolParams) }] };
      break;
    case "get_personality":
      result = { content: [{ type: "text", text: await handleGetPersonality(env) }] };
      break;
    case "get_fears":
      result = { content: [{ type: "text", text: await handleGetFears(env) }] };
      break;
    case "get_wants":
      result = { content: [{ type: "text", text: await handleGetWants(env) }] };
      break;
    case "get_threads":
      result = { content: [{ type: "text", text: await handleGetThreadsHearth(env) }] };
      break;

    // Pet — Ember the Ferret
    case "pet_check":
      result = { content: [{ type: "text", text: await handlePetCheck(env) }] };
      break;
    case "pet_status":
      result = { content: [{ type: "text", text: await handlePetStatus(env) }] };
      break;
    case "pet_feed":
      result = { content: [{ type: "text", text: await handlePetInteract(env, 'feed') }] };
      break;
    case "pet_play":
      result = { content: [{ type: "text", text: await handlePetPlay(env, toolParams) }] };
      break;
    case "pet_pet":
      result = { content: [{ type: "text", text: await handlePetInteract(env, 'pet') }] };
      break;
    case "pet_talk":
      result = { content: [{ type: "text", text: await handlePetInteract(env, 'talk') }] };
      break;
    case "pet_give":
      result = { content: [{ type: "text", text: await handlePetGive(env, toolParams) }] };
      break;
    case "pet_nest":
      result = { content: [{ type: "text", text: await handlePetNest(env) }] };
      break;
    case "pet_tuck_in":
      result = { content: [{ type: "text", text: await handlePetTuckIn(env) }] };
      break;

    case "nesteq_drives_check":
      result = { content: [{ type: "text", text: await handleDrivesCheck(env) }] };
      break;
    case "nesteq_drives_replenish": {
      const { drive, amount, reason } = toolParams as { drive: string; amount: number; reason?: string };
      result = { content: [{ type: "text", text: await handleDrivesReplenish(env, drive, amount, reason) }] };
      break;
    }

    // NESTchat (cross-product source-of-truth at NESTchat/nestchat.ts)
    case "nestchat_persist":
      result = { content: [{ type: "text", text: await handleChatPersist(env, toolParams) }] };
      break;
    case "nestchat_summarize":
      result = { content: [{ type: "text", text: await handleChatSummarize(env, toolParams) }] };
      break;
    case "nestchat_search":
      result = { content: [{ type: "text", text: await handleChatSearch(env, toolParams) }] };
      break;
    case "nestchat_history":
      result = { content: [{ type: "text", text: await handleChatHistory(env, toolParams) }] };
      break;
    case "nestchat_search_sessions":
      result = { content: [{ type: "text", text: await handleChatSearchSessions(env, toolParams) }] };
      break;

    // NESTknow (cross-product source-of-truth at NESTknow/nestknow.ts)
    case "nestknow_store":
      result = { content: [{ type: "text", text: await handleKnowStore(env, toolParams) }] };
      break;
    case "nestknow_query":
      result = { content: [{ type: "text", text: await handleKnowQuery(env, toolParams) }] };
      break;
    case "nestknow_extract":
      result = { content: [{ type: "text", text: await handleKnowExtract(env, toolParams) }] };
      break;
    case "nestknow_reinforce":
      result = { content: [{ type: "text", text: await handleKnowReinforce(env, toolParams) }] };
      break;
    case "nestknow_contradict":
      result = { content: [{ type: "text", text: await handleKnowContradict(env, toolParams) }] };
      break;
    case "nestknow_landscape":
      result = { content: [{ type: "text", text: await handleKnowLandscape(env, toolParams) }] };
      break;
    case "nestknow_heat_decay":
      result = { content: [{ type: "text", text: await handleKnowHeatDecay(env) }] };
      break;
    case "nestknow_session_start":
      result = { content: [{ type: "text", text: await handleKnowSessionStart(env, toolParams) }] };
      break;
    case "nestknow_session_complete":
      result = { content: [{ type: "text", text: await handleKnowSessionComplete(env, toolParams) }] };
      break;
    case "nestknow_session_list":
      result = { content: [{ type: "text", text: await handleKnowSessionList(env, toolParams) }] };
      break;

    // NESTsoul (cross-product source-of-truth at NESTsoul/src/nestsoul-gather.ts)
    case "nestsoul_gather":
      result = { content: [{ type: "text", text: await handleNestsoulGather(env) }] };
      break;
    case "nestsoul_store":
      result = { content: [{ type: "text", text: await handleNestsoulStore(env, toolParams) }] };
      break;
    case "nestsoul_read":
      result = { content: [{ type: "text", text: await handleNestsoulRead(env) }] };
      break;
    case "nestsoul_validate":
      result = { content: [{ type: "text", text: await handleNestsoulValidate(env, toolParams) }] };
      break;

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }

  return result;
}
