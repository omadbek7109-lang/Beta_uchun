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
  type Currency,
  type PassBoard,
  type PassClaimError,
  type Reward,
  type Track,
  type XpResult,
} from './core.ts';
import { PASS_EVENT, demoBoosters, demoBuyElite, demoCheckin, demoEquip, demoPass, demoPassClaim, demoUseBooster, demoWorn, type Owned, type Perk, type StoredBooster } from './demo.ts';
import { tg } from '../telegram.ts';

export type { PassBoard, Track, Reward, Owned, CosmeticKind, Perk };
export type Worn = Partial<Record<CosmeticKind, string>>;
export type PassState = PassBoard & {
  balance: number;
  owned: Owned[];
  equipped: Worn;
  wallet: Record<Currency, number>;
  perks: Perk[];
  /** beta showcase switch (always false with a backend) */
  allOpen: boolean;
  test: boolean;
};

/** a pass_rewards row as the server sends it */
interface ServerReward {
  level: number;
  track: Track;
  kind: Reward['kind'];
  value: string;
  fallback_coins: number;
  rarity: Reward['rarity'];
  label_uz: string;
  label_en: string;
  art: string | null;
  days: number;
  min_coins: number;
  max_coins: number;
  amount: number;
  note_uz: string | null;
  note_en: string | null;
}
export const fromServerReward = (r: ServerReward): Reward => ({
  level: r.level,
  track: r.track,
  kind: r.kind,
  value: r.value,
  fallbackCoins: r.fallback_coins,
  rarity: r.rarity,
  label_uz: r.label_uz,
  label_en: r.label_en,
  art: r.art ?? undefined,
  days: r.days || undefined,
  min: r.min_coins || undefined,
  max: r.max_coins || undefined,
  amount: r.amount || undefined,
  note_uz: r.note_uz ?? undefined,
  note_en: r.note_en ?? undefined,
});

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
  rewards: ServerReward[];
  wallet: Record<Currency, number>;
  perks: Perk[];
  season_end: number;
}

export async function getPass(): Promise<PassState> {
  if (!backendConfigured) return { ...demoPass(), test: true };
  const r = await db.rpc<ServerPass>('pass_me');
  const now = Date.now();
  const done = new Set(r.claims);
  const lv = levelOf(r.xp);
  // rewards come from the server (pass_rewards); XP, level and claims were decided there too
  const rows = r.rewards?.length ? r.rewards.map(fromServerReward) : DEFAULT_REWARDS;
  const season = { ...seasonAt(now), n: r.season, end: r.season_end ?? seasonAt(now).end };
  const b = buildPass(season, { games: [], checkins: [], missions: {}, missionBonus: [], referrals: [] }, DEFAULT_RULES, rows, r.claims, r.elite, r.price, now);
  const rewards = b.rewards.map((x) => ({
    ...x,
    state: (done.has(claimKey(x.level, x.track)) ? 'claimed' : x.level > lv.level ? 'locked' : x.track === 'elite' && !r.elite ? 'elite_locked' : 'ready') as (typeof b.rewards)[number]['state'],
  }));
  return {
    ...b,
    xp: r.xp,
    earned: r.xp,
    level: lv,
    today: r.today,
    boostToday: r.boost_today,
    checkedInToday: r.checked_in,
    rewards,
    readyCount: rewards.filter((x) => x.state === 'ready').length,
    balance: r.balance,
    owned: r.owned,
    equipped: r.equipped,
    wallet: r.wallet ?? { crystal: 0, ticket: 0 },
    perks: r.perks ?? [],
    allOpen: false,
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

/**
 * Premium Pass with Telegram Stars: the server creates an order and an XTR invoice (Edge Function `payments`,
 * action 'pass_premium'); Telegram shows the payment sheet; Premium opens ONLY when the bot receives
 * `successful_payment` (pass_payment_complete). The app then waits until the server reports Premium.
 * Beta (no backend): unlocks at once as a test — no payment.
 */
export type BuyEliteResult = { ok: true; test: boolean } | { ok: false; error: 'already' | 'cancelled' | 'pending' | 'failed' | 'no_telegram' };
export async function buyElite(lang: 'uz' | 'en' = 'uz'): Promise<BuyEliteResult> {
  if (!backendConfigured) {
    const r = demoBuyElite();
    return r.ok ? { ok: true, test: true } : { ok: false, error: r.error };
  }
  const inv = await db.invokeFunction<{ ok: boolean; link?: string; error?: string }>('payments', { action: 'pass_premium', lang }).catch(() => null);
  if (!inv?.ok || !inv.link) return { ok: false, error: inv?.error === 'already' ? 'already' : 'failed' };
  if (!tg?.openInvoice) return { ok: false, error: 'no_telegram' };
  const status = await new Promise<string>((res) => tg!.openInvoice!(inv.link!, (st) => res(st)));
  if (status === 'cancelled') return { ok: false, error: 'cancelled' };
  if (status === 'failed') return { ok: false, error: 'failed' };
  // paid (or pending): Premium opens when the server has confirmed the payment
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const me = await db.rpc<{ elite: boolean }>('pass_me').catch(() => null);
    if (me?.elite) return { ok: true, test: false };
  }
  return { ok: false, error: 'pending' };
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

/* ---------------------------------------------------------------- XP boosters kept in the inventory */
export type { StoredBooster };
export type BoosterState = { stored: StoredBooster[]; active: { pct: number; from: number; until: number } | null };
/** Boosters waiting in the inventory + the running one. Beta: this device; with a backend: rpc pass_boosters. */
export async function getBoosters(): Promise<BoosterState> {
  if (!backendConfigured) return demoBoosters();
  return db.rpc<BoosterState>('pass_boosters', {});
}
export type ActivateBoosterResult = { ok: true; until: number } | { ok: false; error: 'not_found' | 'expired' | 'active' | 'failed' };
/** Turns a stored booster on now (runs for its hours). */
export async function activateBooster(id: string): Promise<ActivateBoosterResult> {
  if (!backendConfigured) {
    const r = demoUseBooster(id);
    if (r.ok) window.dispatchEvent(new Event(PASS_EVENT));
    return r;
  }
  try {
    return await db.rpc<ActivateBoosterResult>('pass_booster_use', { p_id: id });
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/** Admin: Premium for this season, free (rpc pass_grant_premium checks the admin role and writes the audit log). */
export async function adminGrantPremium(userId: string): Promise<{ ok: boolean; already?: boolean }> {
  if (!backendConfigured) {
    const r = demoBuyElite(Date.now(), 'admin');
    if (r.ok) window.dispatchEvent(new Event(PASS_EVENT));
    return r.ok ? { ok: true } : { ok: false, already: true };
  }
  try {
    const r = await db.rpc<{ ok: boolean; already?: boolean }>('pass_grant_premium', { p_user: userId, p_note: null });
    return { ok: !!r.ok, already: !!r.already };
  } catch {
    return { ok: false };
  }
}
