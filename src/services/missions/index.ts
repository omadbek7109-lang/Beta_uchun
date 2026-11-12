/**
 * Daily Missions API. With a backend every number and every coin comes from SQL functions
 * (0030_daily_missions.sql: daily_missions_me / claim_daily_mission / admin_*); the browser only asks.
 * Without one (DAMEO BETA) the demo adapter plays the server with the same rules and TEST coins.
 */
import { backendConfigured } from '../config.ts';
import { db } from '../supabase.ts';
import { BONUS_SLUG, finalizeBoard, type DefsError, type MissionBoard, type MissionDef, type MissionKind, type MissionSettings } from './core.ts';
import { demoBoard, demoClaim, demoConfig, demoSaveConfig } from './demo.ts';

export { BONUS_SLUG, type MissionBoard, type MissionDef, type MissionKind, type MissionSettings };
export type MissionsState = MissionBoard & { balance: number; test: boolean };
export type ClaimResult = { ok: true; amount: number; balance: number } | { ok: false; error: 'unknown' | 'not_done' | 'already' | 'failed'; balance?: number };

interface ServerBoard {
  day: string;
  cap: number;
  bonus: number;
  bonus_claimed: boolean;
  balance: number;
  claims: Record<string, number> | null;
  missions: { slug: string; kind: MissionKind; target: number; reward: number; progress: number; title_uz: string; title_en: string; claimed: boolean }[];
}

export async function getMissions(): Promise<MissionsState> {
  if (!backendConfigured) return { ...demoBoard(), test: true };
  const r = await db.rpc<ServerBoard>('daily_missions_me');
  const claims = { ...(r.claims ?? {}) };
  if (r.bonus_claimed && !(BONUS_SLUG in claims)) claims[BONUS_SLUG] = 0;
  return { ...finalizeBoard(r.day, r.cap, r.bonus, r.missions, claims), balance: r.balance, test: false };
}

export async function claimMission(slug: string): Promise<ClaimResult> {
  if (!backendConfigured) {
    const r = demoClaim(slug);
    return r.ok ? { ok: true, amount: r.amount, balance: r.balance } : { ok: false, error: r.error, balance: r.balance };
  }
  try {
    const r = await db.rpc<{ ok: boolean; amount?: number; balance?: number; error?: string }>('claim_daily_mission', { p_slug: slug });
    if (r.ok) return { ok: true, amount: r.amount ?? 0, balance: r.balance ?? 0 };
    const e = r.error === 'unknown' || r.error === 'not_done' || r.error === 'already' ? r.error : 'failed';
    return { ok: false, error: e };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/* ---------------------------------------------------------------- admin */
export interface MissionConfig {
  defs: MissionDef[];
  settings: MissionSettings;
}
export async function getMissionConfig(): Promise<MissionConfig> {
  if (!backendConfigured) return demoConfig();
  const r = await db.rpc<{ defs: MissionDef[]; settings: { bonus: number; daily_cap: number; min_moves: number } }>('admin_missions_get');
  return { defs: r.defs, settings: { bonus: r.settings.bonus, dailyCap: r.settings.daily_cap, minMoves: r.settings.min_moves } };
}

/** Saves everything in one server transaction (rejected as a whole if it breaks a rule). */
export async function saveMissionConfig(c: MissionConfig): Promise<DefsError | 'failed' | null> {
  if (!backendConfigured) return demoSaveConfig(c.defs, c.settings);
  try {
    await db.rpc('admin_missions_save', {
      p_defs: c.defs.map(({ slug, target, reward, title_uz, title_en, sort, active }) => ({ slug, target, reward, title_uz, title_en, sort, active })),
      p_bonus: c.settings.bonus,
      p_daily_cap: c.settings.dailyCap,
      p_min_moves: c.settings.minMoves,
    });
    return null;
  } catch (e) {
    const m = String((e as Error)?.message ?? '');
    return m.includes('over_cap') ? 'over_cap' : m.includes('bad_') ? (m.match(/bad_[a-z]+/)![0] as DefsError) : 'failed';
  }
}
