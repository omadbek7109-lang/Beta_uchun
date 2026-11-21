/**
 * DAMEO Pass API. With a backend every number comes from SQL functions (0031_season_pass.sql:
 * pass_me / pass_checkin / pass_claim / pass_equip / pass_worn); the browser only asks.
 * Without one (DAMEO BETA) the demo adapter plays the server with the same rules and TEST rewards.
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
  type CosmeticKind,
  type PassBoard,
  type PassClaimError,
  type Reward,
  type Track,
  type XpResult,
} from './core.ts';
import { demoBuyElite, demoCheckin, demoEquip, demoPass, demoPassClaim, demoWorn, type Owned } from './demo.ts';

export type { PassBoard, Track, Reward, Owned, CosmeticKind };
export type Worn = Partial<Record<CosmeticKind, string>>;
export type PassState = PassBoard & { balance: number; owned: Owned[]; equipped: Worn; test: boolean };

interface ServerPass {
  season: number;
  xp: number;
  today: XpResult;
  boost_today: number;
  elite: boolean;
  price: { som: number; stars: number };
  checked_in: boolean;
  claims: string[];
  owned: Owned[];
  equipped: Worn;
  balance: number;
}

export async function getPass(): Promise<PassState> {
  if (!backendConfigured) return { ...demoPass(), test: true };
  const r = await db.rpc<ServerPass>('pass_me');
  const now = Date.now();
  const done = new Set(r.claims);
  const lv = levelOf(r.xp);
  const b = buildPass(seasonAt(now), { games: [], checkins: [], missions: {}, missionBonus: [], referrals: [] }, DEFAULT_RULES, DEFAULT_REWARDS, r.claims, r.elite, r.price, now);
  const rewards = b.rewards.map((x) => ({
    ...x,
    state: (done.has(claimKey(x.level, x.track)) ? 'claimed' : x.level > lv.level ? 'locked' : x.track === 'elite' && !r.elite ? 'elite_locked' : 'ready') as (typeof b.rewards)[number]['state'],
  }));
  return {
    ...b,
    xp: r.xp,
    level: lv,
    today: r.today,
    boostToday: r.boost_today,
    checkedInToday: r.checked_in,
    rewards,
    readyCount: rewards.filter((x) => x.state === 'ready').length,
    balance: r.balance,
    owned: r.owned,
    equipped: r.equipped,
    test: false,
  };
}

export async function passCheckin(): Promise<boolean> {
  if (!backendConfigured) return demoCheckin().ok;
  const r = await db.rpc<{ ok: boolean }>('pass_checkin');
  return r.ok;
}

export type PassClaimResult =
  | { ok: true; coins: number; item: string | null; cosmetic: CosmeticKind | null; boost: number; balance: number }
  | { ok: false; error: PassClaimError | 'failed' };
export async function claimPass(level: number, track: Track): Promise<PassClaimResult> {
  if (!backendConfigured) return demoPassClaim(level, track);
  try {
    const r = await db.rpc<{ ok: boolean; coins?: number; item?: string | null; cosmetic?: CosmeticKind | null; boost?: number; balance?: number; error?: string }>(
      'pass_claim',
      { p_level: level, p_track: track },
    );
    if (r.ok) return { ok: true, coins: r.coins ?? 0, item: r.item ?? null, cosmetic: r.cosmetic ?? null, boost: r.boost ?? 0, balance: r.balance ?? 0 };
    const e = r.error === 'unknown' || r.error === 'locked' || r.error === 'elite' || r.error === 'already' ? r.error : 'failed';
    return { ok: false, error: e };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/** Premium: beta unlocks it for testing; the main app opens the FLECT STARS payment (so'm). */
export type BuyEliteResult = { ok: true; test: boolean } | { ok: false; error: 'already' | 'pay_flect' | 'failed' };
export async function buyElite(): Promise<BuyEliteResult> {
  if (!backendConfigured) {
    const r = demoBuyElite();
    return r.ok ? { ok: true, test: true } : { ok: false, error: r.error };
  }
  return { ok: false, error: 'pay_flect' };
}

export async function equipCosmetic(kind: CosmeticKind, id: string | null): Promise<boolean> {
  if (!backendConfigured) return demoEquip(kind, id).ok;
  const r = await db.rpc<{ ok: boolean }>('pass_equip', { p_kind: kind, p_id: id });
  return r.ok;
}

/** Worn cosmetics of a player (beta: this device's own). */
export async function wornOf(userId: string | null | undefined): Promise<Worn> {
  if (!backendConfigured) return demoWorn();
  if (!userId) return {};
  try {
    return await db.rpc<Worn>('pass_worn', { p_user: userId });
  } catch {
    return {};
  }
}
