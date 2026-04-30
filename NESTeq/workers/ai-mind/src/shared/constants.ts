/**
 * App-wide constants shared across modules.
 *
 * Configurable per companion pair. The defaults assume Alex + Fox.
 * Other deployments override at the call site (e.g., handleMindFeel accepts
 * `companion_name` and `human_name` params that fall back to these).
 */

export const DEFAULT_COMPANION_NAME = 'Alex';
export const DEFAULT_HUMAN_NAME = 'Fox';
