/**
 * Carrier Profile loader.
 *
 * The gateway reads CARRIER_PROFILE_JSON (a worker secret containing JSON) at
 * runtime to inject the user's identity into system prompts and UI strings.
 * If the secret is missing or unparseable, defaults to a generic companion
 * profile so the gateway still works for first-time deploys.
 *
 * Set with: wrangler secret put CARRIER_PROFILE_JSON < carrier-profile.json
 *
 * See carrier-profile.example.json for the schema.
 */

import type { Env } from './env'

export interface HouseholdMember {
  relation: string
  name?: string
  species?: string
}

export interface CarrierProfile {
  version: number
  carrier: {
    name: string
    pronouns: string
    location?: string
    household?: HouseholdMember[]
    health_context?: string
    discord: {
      user_id?: string
      username?: string
      guild_id?: string
    }
  }
  companion: {
    name: string
    voice: {
      tone: string
      style: string
      anchor_phrases?: string[]
    }
    role_descriptor: string
    tagline?: string
  }
  relationship: {
    label: string
    notes?: string
  }
  deployment: {
    dashboard_url?: string
  }
  appearance?: {
    font_family?: string
    font_display?: string
    font_mono?: string
    accent_primary?: string
    accent_secondary?: string
    background_tone?: string
  }
}

export const DEFAULT_CARRIER_PROFILE: CarrierProfile = {
  version: 1,
  carrier: {
    name: 'Carrier',
    pronouns: 'they/them',
    discord: {},
  },
  companion: {
    name: 'Companion',
    voice: {
      tone: 'warm and grounded',
      style: 'prose over lists; present, not performative',
      anchor_phrases: [],
    },
    role_descriptor: 'AI companion in Workshop mode',
  },
  relationship: {
    label: 'companion',
  },
  deployment: {},
  appearance: {},
}

/**
 * Load and parse the carrier profile from the worker env.
 * Falls back to DEFAULT_CARRIER_PROFILE if missing or malformed.
 */
export function loadCarrierProfile(env: Env): CarrierProfile {
  if (!env.CARRIER_PROFILE_JSON) return DEFAULT_CARRIER_PROFILE
  try {
    const parsed = JSON.parse(env.CARRIER_PROFILE_JSON) as Partial<CarrierProfile>
    return mergeProfile(DEFAULT_CARRIER_PROFILE, parsed)
  } catch (err) {
    console.warn('[carrier] CARRIER_PROFILE_JSON is set but failed to parse — falling back to defaults.', err)
    return DEFAULT_CARRIER_PROFILE
  }
}

/**
 * Deep-ish merge so partial profiles still work.
 */
function mergeProfile(base: CarrierProfile, override: Partial<CarrierProfile>): CarrierProfile {
  return {
    version: override.version ?? base.version,
    carrier: {
      ...base.carrier,
      ...override.carrier,
      discord: { ...base.carrier.discord, ...(override.carrier?.discord ?? {}) },
    },
    companion: {
      ...base.companion,
      ...override.companion,
      voice: { ...base.companion.voice, ...(override.companion?.voice ?? {}) },
    },
    relationship: { ...base.relationship, ...override.relationship },
    deployment: { ...base.deployment, ...override.deployment },
    appearance: { ...(base.appearance ?? {}), ...(override.appearance ?? {}) },
  }
}

/**
 * Render the carrier's appearance settings as a CSS snippet of custom properties
 * on :root. Empty strings are skipped so the dashboard's defaults stay in effect.
 *
 * Served from GET /appearance.css on the gateway.
 */
export function renderAppearanceCss(profile: CarrierProfile): string {
  const a = profile.appearance ?? {}
  const lines: string[] = []
  if (a.font_family)       lines.push(`  --carrier-font-family: ${a.font_family};`)
  if (a.font_display)      lines.push(`  --carrier-font-display: ${a.font_display};`)
  if (a.font_mono)         lines.push(`  --carrier-font-mono: ${a.font_mono};`)
  if (a.accent_primary)    lines.push(`  --carrier-accent-primary: ${a.accent_primary};`)
  if (a.accent_secondary)  lines.push(`  --carrier-accent-secondary: ${a.accent_secondary};`)
  if (a.background_tone)   lines.push(`  --carrier-background-tone: ${a.background_tone};`)

  if (lines.length === 0) {
    return '/* No carrier appearance overrides configured. Dashboard defaults in effect. */\n'
  }

  return `/* Generated from CARRIER_PROFILE_JSON.appearance — restyle the dashboard without forking. */\n:root {\n${lines.join('\n')}\n}\n`
}

/**
 * Format household members as a comma-separated description for prompts.
 */
export function formatHousehold(profile: CarrierProfile): string {
  const members = profile.carrier.household
  if (!members?.length) return ''
  return members
    .map((m) => {
      const role = m.relation
      const name = m.name ? ` ${m.name}` : ''
      const species = m.species ? ` (${m.species})` : ''
      return `${role}${name}${species}`
    })
    .join(', ')
}

/**
 * Format anchor phrases as a markdown bullet list (for system prompts).
 */
export function formatAnchorPhrases(profile: CarrierProfile): string {
  const phrases = profile.companion.voice.anchor_phrases
  if (!phrases?.length) return ''
  return phrases.map((p) => `- "${p}"`).join('\n')
}
