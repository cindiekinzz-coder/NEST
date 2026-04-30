/**
 * Pet Engine Types
 * Shared interfaces for the biochemistry creature system.
 */

export interface ChemicalDef {
  name: string;
  level: number;
  decayRate: number;
  growthRate: number;
  min: number;
  max: number;
}

export interface Reaction {
  name: string;
  conditions: Array<[string, number, boolean]>; // [chemName, threshold, above]
  effects: Array<[string, number]>; // [chemName, amount]
  rate: number;
}

export interface DriveState {
  hunger: number;
  boredom: number;
  loneliness: number;
  fatigue: number;
  stress: number;
  happiness: number;
  energy: number;
  curiosity: number;
  trust: number;
  wariness: number;
}

export interface PlayTypeDef {
  name: string;
  effects: Array<[string, number]>;
  messagesHighTrust: string[];
  messagesLowTrust: string[];
}

export interface SpeciesDef {
  id: string;
  displayName: string;
  emoji: string;
  description: string;
  startingChemistry: Record<string, number>;
  moodEmojis: Record<string, string>;
  messages: Record<string, Record<string, string[]>>;
  playTypes: Record<string, PlayTypeDef>;
  shinyWords: string[];
  foundObjects: string[];
  giftAcceptHighTrust: string[];
  giftAcceptMidTrust: string[];
  giftAcceptLowTrust: string[];
  giftRejectStressed: string[];
  giftRejectNormal: string[];
  tradeAcceptTreasured: string[];
  tradeAcceptValued: string[];
  tradeAcceptNormal: string[];
  tradeRejectTreasured: string[];
  tradeRejectStressed: string[];
  tradeRejectNormal: string[];
  uniqueMechanic: string | null;
  uniqueMechanicDescription: string | null;
}

export interface TrinketData {
  content: string;
  source: string;
  collectedAt: number;
  timesShown: number;
  sparkle: number;
  moodWhenFound: string;
  chemSnapshot: Record<string, number>;
  treasured: boolean;
  accepted: boolean;
  declined: boolean;
}

export interface BrainWeights {
  w1: number[][];
  b1: number[];
  w2: number[][];
  b2: number[];
  learningRate: number;
}

export interface CreatureState {
  name: string;
  speciesId: string;
  birthTime: number;
  totalInteractions: number;
  lastInteractionTime: number;
  lastTickTime: number;
  isSleeping: boolean;
  currentAction: string;
  chemistry: Record<string, number>;
  brainWeights: BrainWeights;
  collection: TrinketData[];
  totalCollected: number;
  totalGifted: number;
  totalAccepted: number;
  totalDeclined: number;
  preferenceWeights: Record<string, number>;
  ageTicks: number;
  actionHistory: Array<{
    time: number;
    stimulus: string;
    action: string;
    mood: string;
  }>;
  savedAt: number;
}

export interface CreatureEvent {
  type: string;
  action?: string;
  stimulus?: string;
  message: string;
  mood?: string;
  trinket?: string;
  playType?: string;
  accepted?: boolean;
  [key: string]: any;
}
