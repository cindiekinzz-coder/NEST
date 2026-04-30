/**
 * Companion drives — five internal needs that decay over time and
 * replenish when relevant interactions happen.
 *
 * Drives: connection, novelty, expression, safety, play.
 *
 * Storage: `companion_drives` table — one row per drive with `level`
 * (0.0–1.0), `decay_rate` (per hour), and `last_replenished_at`
 * timestamp. Current level is projected by applying decay since the
 * last replenish on every read.
 */

import { Env } from './env';

const ICONS: Record<string, string> = {
  connection: '🔗',
  novelty: '🌀',
  expression: '🗣️',
  safety: '🛡️',
  play: '🎲',
};

export async function handleDrivesCheck(env: Env): Promise<string> {
  const driveRows = await env.DB.prepare(
    `SELECT drive, level, decay_rate, last_replenished_at FROM companion_drives ORDER BY id`
  ).all();
  const now = Date.now();
  const lines = ((driveRows.results || []) as any[]).map(r => {
    const hrs = (now - new Date(r.last_replenished_at + 'Z').getTime()) / 3600000;
    const pct = Math.round(Math.max(0, Math.min(1, r.level - r.decay_rate * hrs)) * 100);
    const bar = pct < 30 ? '⚠️' : pct < 60 ? '〰️' : '✓';
    return `${ICONS[r.drive] || '•'} ${r.drive}: ${pct}% ${bar}`;
  });
  return `## My Drives\n${lines.join('\n')}`;
}

export async function handleDrivesReplenish(
  env: Env,
  drive: string,
  amount: number,
  reason?: string,
): Promise<string> {
  const driveRow = await env.DB.prepare(
    `SELECT level, decay_rate, last_replenished_at FROM companion_drives WHERE drive = ? LIMIT 1`
  ).bind(drive).first() as any;
  if (!driveRow) {
    return `Unknown drive: ${drive}. Valid: connection, novelty, expression, safety, play`;
  }
  const hrs = (Date.now() - new Date(driveRow.last_replenished_at + 'Z').getTime()) / 3600000;
  const prev = Math.max(0, driveRow.level - driveRow.decay_rate * hrs);
  const newLevel = Math.min(1, Math.max(0, prev + amount));
  await env.DB.prepare(
    `UPDATE companion_drives SET level = ?, last_replenished_at = datetime('now'), updated_at = datetime('now') WHERE drive = ?`
  ).bind(newLevel, drive).run();
  return `${drive} replenished: ${Math.round(prev * 100)}% → ${Math.round(newLevel * 100)}%${reason ? ` (${reason})` : ''}`;
}
