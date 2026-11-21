/**
 * DAMEO Pass API. With a backend every number comes from SQL functions (0031_season_pass.sql:
 * pass_me / pass_checkin / pass_claim / pass_buy_elite_coins); the browser only asks.
 * Without one (DAMEO BETA) the demo adapter plays the server with the same rules and TEST coins.
 */
import { backendConfigured } from '../config.ts';
import { db } from '../supabase.ts';
import {
  DEFAULT_REWARDS,
  DEFAULT_RULES,
  buildPass,
  claimKey,
  levelOf,
  seasonAt,
  type PassBoard,
  type PassClaimError,
  type Reward,
  type Track,
  type XpResult,
} from './core.ts';
import { demoBuyElite, demoCheckin, demoEquipTitle, demoPass, demoPassClaim } from './demo.ts';

export type { PassBoard, Track, Reward };
export type PassState = PassBoard & { balance: number; titles: string[]; equippedTitle: string | null; test: boolean };

interface ServerPass {
  season: number;
  xp: number;
  today: XpResult;
  elite: boolean;
  price: { coins: number; stars: number };
  checked_in: boolean;
  claims: string[];
  titles: string[];
  equipped_title: string | null;
  balance: number;
}

export async function getPass(): Promise<PassState> {
  if (!backendConfigured) return { ...demoPass(), test: true };
  const r = await db.rpc<ServerPass>('pass_me');
  const now = Date.now();
  const season = seasonAt(now);
  const done = new Set(r.claims);
  const lv = levelOf(r.xp);
  // the server already decided XP and claims; buildPass is only used for the reward states
  const b = buildPass(season, { games: [], checkins: [], missions: {}, missionBonus: [], referrals: [] }, DEFAULT_RULES, DEFAULT_REWARDS, r.claims, r.elite, r.price, now);
  return {
    ...b,
    xp: r.xp,
    level: lv,
    today: r.today,
    checkedInToday: r.checked_in,
    rewards: b.rewards.map((x) => ({
      ...x,
      state: done.has(claimKey(x.level, x.track)) ? 'claimed' : x.level > lv.level ? 'locked' : x.track === 'elite' && !r.elite ? 'elite_locked' : 'ready',
    })),
    balance: r.balance,
    titles: r.titles,
    equippedTitle: r.equipped_title,
    test: false,
  };
}

export async function passCheckin(): Promise<boolean> {
  if (!backendConfigured) return demoCheckin().ok;
  const r = await db.rpc<{ ok: boolean }>('pass_checkin');
  return r.ok;
}

export type PassClaimResult =
  | { ok: true; coins: number; item: string | null; title: string | null; balance: number }
  | { ok: false; error: PassClaimError | 'failed' };
export async function claimPass(level: number, track: Track): Promise<PassClaimResult> {
  if (!backendConfigured) return demoPassClaim(level, track);
  try {
    const r = await db.rpc<{ ok: boolean; coins?: number; item?: string | null; title?: string | null; balance?: number; error?: string }>('pass_claim', {
      p_level: level,
      p_track: track,
    });
    if (r.ok) return { ok: true, coins: r.coins ?? 0, item: r.item ?? null, title: r.title ?? null, balance: r.balance ?? 0 };
    const e = r.error === 'unknown' || r.error === 'locked' || r.error === 'elite' || r.error === 'already' ? r.error : 'failed';
    return { ok: false, error: e };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export type BuyEliteResult = { ok: true; balance: number } | { ok: false; error: 'already' | 'insufficient' | 'stars_beta' | 'failed' };
export async function buyElite(method: 'coins' | 'stars'): Promise<BuyEliteResult> {
  if (!backendConfigured) return demoBuyElite(method);
  if (method === 'stars') return { ok: false, error: 'stars_beta' }; // Stars invoice: added with the payments function
  try {
    const r = await db.rpc<{ ok: boolean; balance?: number; error?: string }>('pass_buy_elite_coins');
    if (r.ok) return { ok: true, balance: r.balance ?? 0 };
    return { ok: false, error: r.error === 'already' || r.error === 'insufficient' ? r.error : 'failed' };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function equipTitle(id: string | null): Promise<boolean> {
  if (!backendConfigured) return demoEquipTitle(id).ok;
  const r = await db.rpc<{ ok: boolean }>('pass_equip_title', { p_title: id });
  return r.ok;
}
