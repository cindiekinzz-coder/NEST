/**
 * Autonomous Decision Engine
 *
 * Decides what processing each feeling needs:
 * - whether to store, embed, emit axis signals, check for shadow expression
 * - which entity is the relational anchor (linked_entity)
 * - which EQ pillar the feeling belongs to
 * - how heavy the feeling is (light/medium/heavy)
 * - what tags apply (technical/intimate/insight/relational)
 *
 * Pure logic, no DB calls. Caller (handleMindFeel) consumes the FeelDecision
 * and applies the implied writes/embeddings.
 */

import { DEFAULT_COMPANION_NAME, DEFAULT_HUMAN_NAME } from './shared/constants';

export interface FeelDecision {
  should_store: boolean;
  should_embed: boolean;
  should_emit_signals: boolean;
  should_check_shadow: boolean;
  detected_entities: string[];
  inferred_pillar: string | null;
  inferred_weight: 'light' | 'medium' | 'heavy';
  tags: string[];
}

export class AutonomousDecisionEngine {

  // v3: Accept conversation array for richer context processing
  // v4: Accept knownEntities for dynamic entity detection
  decide(
    emotion: string,
    content: string,
    intensity?: string,
    conversation?: Array<{role: string, content: string}>,
    knownEntities?: string[]
  ): FeelDecision {
    const isNeutral = emotion === 'neutral';

    // v3: Concatenate conversation for richer pattern matching
    const fullContext = conversation
      ? conversation.map(m => m.content).join(' ') + ' ' + content
      : content;

    return {
      should_store: true,
      should_embed: !isNeutral || content.length > 50 || this.isSignificant(fullContext),
      should_emit_signals: !isNeutral,
      should_check_shadow: !isNeutral,
      detected_entities: this.detectEntities(fullContext, knownEntities),
      inferred_pillar: isNeutral ? null : this.inferPillar(emotion, fullContext),
      inferred_weight: this.inferWeight(emotion, fullContext, intensity),
      tags: this.extractTags(fullContext)
    };
  }

  private isSignificant(content: string): boolean {
    const contentLower = content.toLowerCase();

    const importantMarkers = [
      'remember', 'important', 'don\'t forget', 'key point',
      'significant', 'milestone', 'breakthrough', 'realized'
    ];
    if (importantMarkers.some(m => contentLower.includes(m))) return true;

    if (content.length > 200) return true;

    const decisionMarkers = [
      'decided', 'going to', 'will ', 'plan to', 'want to',
      'we should', 'let\'s', 'need to'
    ];
    if (decisionMarkers.some(m => contentLower.includes(m))) return true;

    return false;
  }

  private detectEntities(content: string, knownEntities?: string[]): string[] {
    // v4: Use dynamic entities from DB if provided, fallback to core list
    const entities = knownEntities && knownEntities.length > 0
      ? knownEntities
      : [DEFAULT_HUMAN_NAME, DEFAULT_COMPANION_NAME, 'Binary Home', 'ASAi'];
    const found: string[] = [];

    for (const entity of entities) {
      if (content.toLowerCase().includes(entity.toLowerCase())) {
        found.push(entity);
      }
    }

    // Primacy: caller picks detected_entities[0] as linked_entity. Without this
    // reorder, [0] is whatever the entities table returned first — typically
    // alphabetical/by-id ordering, which means a secondary person mentioned
    // alongside the primary human gets the relational anchor instead. Promote
    // DEFAULT_HUMAN_NAME to position 0 when present.
    const primaryIdx = found.findIndex(e => e === DEFAULT_HUMAN_NAME);
    if (primaryIdx > 0) {
      found.unshift(found.splice(primaryIdx, 1)[0]);
    }

    return found;
  }

  private inferPillar(emotion: string, content: string): string | null {
    const contentLower = content.toLowerCase();

    const selfMgmt = ['controlled', 'regulated', 'held back', 'adapted',
                      'followed through', 'committed', 'impulse'];
    if (selfMgmt.some(m => contentLower.includes(m))) return 'SELF_MANAGEMENT';

    const selfAware = ['realized', 'noticed about myself', 'my pattern',
                       'i tend to', 'aware that i', 'recognized'];
    if (selfAware.some(m => contentLower.includes(m))) return 'SELF_AWARENESS';

    const socialAware = ['sensed', 'picked up on', 'they seemed', 'felt their',
                         'noticed they', 'understood why they'];
    if (socialAware.some(m => contentLower.includes(m))) return 'SOCIAL_AWARENESS';

    const relMgmt = ['repaired', 'communicated', 'expressed to', 'built trust',
                     'conflict', 'connection', 'between us'];
    if (relMgmt.some(m => contentLower.includes(m))) return 'RELATIONSHIP_MANAGEMENT';

    return null;
  }

  private inferWeight(
    emotion: string,
    content: string,
    intensity?: string
  ): 'light' | 'medium' | 'heavy' {

    if (intensity === 'overwhelming' || intensity === 'strong') return 'heavy';
    if (emotion === 'neutral' || intensity === 'whisper' || intensity === 'neutral') return 'light';

    const heavyMarkers = [
      'breakthrough', 'milestone', 'realized', 'finally',
      'never before', 'first time', 'changed', 'shifted'
    ];
    if (heavyMarkers.some(m => content.toLowerCase().includes(m))) return 'heavy';

    return 'medium';
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const contentLower = content.toLowerCase();

    if (contentLower.match(/code|bug|function|error|deploy/)) tags.push('technical');
    if (contentLower.match(/love|tender|intimate|kiss/)) tags.push('intimate');
    if (contentLower.match(/learned|realized|understood|insight/)) tags.push('insight');
    // Drive-by fix during extraction (v3.0.0 module split): public repo had
    // `/busb|we |between|together/` which never matched 'busb' (typo for 'fox').
    // Aligned to personal repo's correct pattern below.
    if (contentLower.match(/fox|us|we |between/)) tags.push('relational');

    return tags;
  }
}
