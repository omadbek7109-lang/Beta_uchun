/**
 * Beta / demo adapter for DAMEO Pass — no backend, TEST DATA ONLY.
 * Plays the server's role with the same rules (core.ts): XP is derived from this device's finished games,
 * daily-mission claims (beta missions), check-ins and beta test events. Rewards (coins, items, emoji, frames,
 * backgrounds, badges, titles, boosters, boxes) are test rewards that never leave the device.
 * Storage: localStorage 'dameobeta.pass.v3' (separate from the main DAMEO app).
 */
import type { MatchSummary } from '../../types/models.ts';
import { demoGrant, demoOwns, demoRevokePass } from '../demoShop.ts';
import { NY_FRAMES } from '../newYear.ts';
import type { Slot } from '../skins.ts';
import { demoBalance, demoWalletApply } from '../demoWallet.ts';
import { loadLocal } from '../localProfile.ts';
import { readJSON, writeJSON } from '../localStore.ts';
import {
  DAY_MS,
  DEFAULT_PRICE,
  DEFAULT_REWARDS,
  DEFAULT_RULES,
  buildPass,
  checkPassClaim,
  claimKey,
  isCosmetic,
  rewardCoins,
  seasonAt,
  tashkentDay,
  type CosmeticKind,
  type Currency,
  type PassBoard,
  type PassClaimError,
  type PassGame,
  type SeasonActivity,
  type Track,
  type XpBoost,
} from './core.ts';

const KEY = 'dameobeta.pass.v5'; // v5: fresh start with the Premium list of 4.5
const MISSIONS_KEY = 'dameobeta.missions.v1';
export const PASS_EVENT = 'dameobeta:pass';

interface SeasonState {
  claims: string[];
  elite: boolean;
  /** how Premium was opened (beta): a Stars payment or the admin */
  eliteBy?: 'stars' | 'admin';
  checkins: string[];
  missions: Record<string, number>;
  missionBonus: string[];
  testGames: PassGame[];
  testReferrals: number[];
}
export interface Owned {
  id: string;
  kind: CosmeticKind;
  season: number;
  /** UTC ms; null = forever */
  until: number | null;
}
export interface StoredBooster {
  id: string;
  pct: number;
  hours: number;
  /** UTC ms: must be turned on before this */
  expires: number;
  label_uz: string;
  label_en: string;
}
export interface Perk {
  id: string;
  amount: number;
  until: number;
}
interface State {
  seasons: Record<string, SeasonState>;
  owned: Owned[];
  equipped: Partial<Record<CosmeticKind, string>>;
  boosts: XpBoost[];
  /** XP boosters waiting in the inventory (turned on by the player) */
  stored: StoredBooster[];
  wallet: Record<Currency, number>;
  perks: Perk[];
  /** beta switch: every level + Premium open (showcase) — off = the real progress rules */
  allOpen: boolean;
}
const blank = (): SeasonState => ({ claims: [], elite: false, checkins: [], missions: {}, missionBonus: [], testGames: [], testReferrals: [] });
const load = (): State => {
  const s = readJSON<Partial<State> | null>(KEY, null) ?? {};
  return {
    seasons: s.seasons ?? {},
    owned: s.owned ?? [],
    equipped: s.equipped ?? {},
    boosts: s.boosts ?? [],
    stored: s.stored ?? [],
    wallet: { crystal: 0, ticket: 0, ...(s.wallet ?? {}) },
    perks: s.perks ?? [],
    allOpen: s.allOpen ?? true,
  };
};
/** Game items of rewards claimed before a reward changed (e.g. the Pass boards) still reach the inventory. Once per page load. */
let backfilled = false;
function backfillItems(s: State) {
  if (backfilled) return;
  backfilled = true;
  const claimed = new Set(Object.values(s.seasons).flatMap((ss) => ss.claims));
  for (const rw of DEFAULT_REWARDS) if (rw.kind === 'item' && claimed.has(claimKey(rw.level, rw.track)) && !demoOwns(rw.value)) demoGrant(rw.value);
}
const save = (s: State) => {
  const seasons = Object.fromEntries(Object.entries(s.seasons).sort(([a], [b]) => Number(b) - Number(a)).slice(0, 4));
  writeJSON(KEY, { ...s, seasons });
  try {
    window.dispatchEvent(new Event(PASS_EVENT));
  } catch {
    /* not in a browser (tests) */
  }
};

function syncMissions(ss: SeasonState) {
  const m = readJSON<{ claims?: Record<string, Record<string, number>> } | null>(MISSIONS_KEY, null);
  for (const [day, slugs] of Object.entries(m?.claims ?? {})) {
    const n = Object.keys(slugs).filter((k) => k !== '__bonus').length;
    ss.missions[day] = Math.max(ss.missions[day] ?? 0, n);
    if ('__bonus' in slugs && !ss.missionBonus.includes(day)) ss.missionBonus.push(day);
  }
}

const fromLocal = (m: MatchSummary): PassGame | null => {
  if (m.mode === 'practice' || m.mode === 'local') return null;
  const live = m.mode === 'online' || m.mode === 'demo-rated';
  return { ts: m.ts, live: live && m.rated, outcome: m.result, moves: m.moves ?? 0, vsBot: m.mode === 'bot', opp: m.opponent };
};

function withSeason<T>(now: number, fn: (s: State, ss: SeasonState, n: number) => T, write = true): T {
  const s = load();
  backfillItems(s);
  const n = seasonAt(now).n;
  const ss = { ...blank(), ...(s.seasons[n] ?? {}) };
  syncMissions(ss);
  const out = fn(s, ss, n);
  if (write) {
    s.seasons[n] = ss;
    save(s);
  }
  return out;
}

function activity(ss: SeasonState): SeasonActivity {
  const games = loadLocal()
    .matches.map(fromLocal)
    .filter((g): g is PassGame => g !== null);
  return { games: [...games, ...ss.testGames], checkins: ss.checkins, missions: ss.missions, missionBonus: ss.missionBonus, referrals: ss.testReferrals };
}
const board = (s: State, ss: SeasonState, now: number) =>
  buildPass(seasonAt(now), activity(ss), DEFAULT_RULES, DEFAULT_REWARDS, ss.claims, ss.elite, DEFAULT_PRICE, now, s.boosts, s.allOpen);
/** BETA: switch between the showcase (everything open) and the real progress rules. */
export function demoSetAllOpen(on: boolean) {
  const s = load();
  s.allOpen = on;
  save(s);
}

/** what is mine and still valid now */
/** Beta test: the New Year avatar frames are owned by everyone (not stored, so a season reset never takes them). */
const BETA_OWNED: Owned[] = [...NY_FRAMES.map((f) => ({ id: f.id, kind: 'frame' as const, season: 0, until: null })), { id: 'cb-ice', kind: 'combo', season: 0, until: null }];
const live = (s: State, now: number) => [
  ...s.owned.filter((o) => o.until === null || o.until > now),
  ...BETA_OWNED.filter((b) => !s.owned.some((o) => o.kind === b.kind && o.id === b.id)),
];
function equippedNow(s: State, now: number): Partial<Record<CosmeticKind, string>> {
  const mine = new Set(live(s, now).map((o) => `${o.kind}:${o.id}`));
  const out: Partial<Record<CosmeticKind, string>> = Object.fromEntries(Object.entries(s.equipped).filter(([k, id]) => id && mine.has(`${k}:${id}`)));
  // combo effects work as soon as they are owned (Double Strike on 2 captures, Triple Strike on 3+)
  const combos = live(s, now).filter((o) => o.kind === 'combo').map((o) => o.id);
  if (combos.length) out.combo = combos.join(',');
  else delete out.combo;
  return out;
}

export type DemoPass = PassBoard & {
  balance: number;
  owned: Owned[];
  equipped: Partial<Record<CosmeticKind, string>>;
  wallet: Record<Currency, number>;
  perks: Perk[];
  allOpen: boolean;
};
export function demoPass(now = Date.now()): DemoPass {
  return withSeason(now, (s, ss) => ({
    ...board(s, ss, now),
    balance: demoBalance(),
    owned: live(s, now),
    equipped: equippedNow(s, now),
    wallet: s.wallet,
    perks: s.perks.filter((p) => p.until > now),
    allOpen: s.allOpen,
  }));
}

/** The player's worn cosmetics (for the profile, header and menu). */
export function demoWorn(now = Date.now()): Partial<Record<CosmeticKind, string>> {
  return equippedNow(load(), now);
}

export function demoCheckin(now = Date.now()): { ok: boolean } {
  return withSeason(now, (_s, ss) => {
    const d = tashkentDay(now);
    if (ss.checkins.includes(d)) return { ok: false };
    ss.checkins.push(d);
    return { ok: true };
  });
}

export type DemoClaim =
  | { ok: true; coins: number; item: string | null; cosmetic: CosmeticKind | null; boost: number; balance: number }
  | { ok: false; error: PassClaimError; balance: number };
export function demoPassClaim(level: number, track: Track, now = Date.now(), roll = Math.random()): DemoClaim {
  return withSeason(now, (s, ss, n) => {
    const r = checkPassClaim(board(s, ss, now), level, track);
    if (!r.ok) return { ok: false, error: r.error, balance: demoBalance() };
    const rw = r.reward;
    let item: string | null = null;
    let owned = false;
    let boost = 0;
    let cosmetic: CosmeticKind | null = null;
    if (rw.kind === 'item') {
      owned = demoOwns(rw.value);
      if (!owned) owned = !demoGrant(rw.value);
      if (!owned) item = rw.value;
    } else if (isCosmetic(rw.kind)) {
      cosmetic = rw.kind;
      const until = rw.days ? now + rw.days * DAY_MS : null;
      for (const id of rw.value.split(',')) {
        const prev = s.owned.find((o) => o.kind === rw.kind && o.id === id);
        if (prev) prev.until = prev.until === null || until === null ? null : Math.max(prev.until, until);
        else s.owned.push({ id, kind: rw.kind, season: n, until });
      }
      // the first one of a kind is worn at once
      if (!s.equipped[rw.kind]) s.equipped[rw.kind] = rw.value.split(',')[0];
    } else if (rw.kind === 'currency') {
      const c = rw.value as Currency;
      s.wallet[c] = (s.wallet[c] ?? 0) + (rw.amount ?? 0);
    } else if (rw.kind === 'perk') {
      s.perks.push({ id: rw.value, amount: rw.amount ?? 1, until: now + (rw.days ?? 1) * DAY_MS });
    } else if (rw.kind === 'xp_boost') {
      boost = Number(rw.value) || 0;
      if (rw.keepDays && rw.hours) {
        // goes to the inventory; the player turns it on later (see demoUseBooster)
        s.stored.push({ id: `${n}:${claimKey(level, track)}`, pct: boost, hours: rw.hours, expires: now + rw.keepDays * DAY_MS, label_uz: rw.label_uz, label_en: rw.label_en });
      } else s.boosts.push({ pct: boost, from: now, until: now + (rw.hours ? rw.hours * 3_600_000 : (rw.days ?? 1) * DAY_MS) });
      s.boosts = s.boosts.filter((b) => b.until > now - 30 * DAY_MS);
      s.stored = s.stored.filter((b) => b.expires > now);
    }
    let coins = rewardCoins(rw, owned, roll);
    if (rw.kind === 'box' && rw.pool) {
      // a chest with game items: a random one not owned yet goes to the inventory; all owned → its coins
      const left = rw.pool.split(',').filter((slug) => !demoOwns(slug));
      const pick = left[Math.min(left.length - 1, Math.floor(roll * left.length))];
      if (pick && demoGrant(pick)) {
        item = pick;
        coins = 0;
      }
    }
    ss.claims.push(claimKey(level, track));
    if (coins > 0) demoWalletApply(coins, 'reward', 'pass', claimKey(level, track), `season ${n}`, `pass:${n}:${claimKey(level, track)}`);
    return { ok: true, coins, item, cosmetic, boost, balance: demoBalance() };
  });
}

export type EliteResult = { ok: true; balance: number; test: boolean } | { ok: false; error: 'already'; balance: number };
/** Beta: Premium unlocks for free (TEST) — in the main app it is paid with so'm through FLECT STARS. */
/** Beta: Premium for this season — a test Stars payment (50 ⭐, nothing is charged) or given by the admin. */
export function demoBuyElite(now = Date.now(), how: 'stars' | 'admin' = 'stars'): EliteResult {
  return withSeason(now, (_s, ss) => {
    if (ss.elite) return { ok: false, error: 'already', balance: demoBalance() };
    ss.elite = true;
    ss.eliteBy = how;
    return { ok: true, balance: demoBalance(), test: true };
  });
}
/** Beta test tool: takes Premium back (to test buying again). */
export function demoRevokeElite(now = Date.now()) {
  withSeason(now, (_s, ss) => {
    ss.elite = false;
    delete ss.eliteBy;
  });
}

export function demoEquip(kind: CosmeticKind, id: string | null, now = Date.now()) {
  const s = load();
  if (id && !live(s, now).some((o) => o.kind === kind && o.id === id)) return { ok: false };
  if (id) s.equipped[kind] = id;
  else delete s.equipped[kind];
  save(s);
  return { ok: true };
}

/** XP boosters in the inventory, and the one running now (if any). */
export function demoBoosters(now = Date.now()): { stored: StoredBooster[]; active: XpBoost | null } {
  const s = load();
  const active = s.boosts.filter((b) => b.until - b.from < DAY_MS && now >= b.from && now < b.until).sort((a, b) => b.pct - a.pct)[0] ?? null;
  return { stored: s.stored.filter((b) => b.expires > now), active };
}
/** Turns a stored booster on: it runs for its hours from now. Refused while another booster is running (no waste). */
export function demoUseBooster(id: string, now = Date.now()): { ok: true; until: number } | { ok: false; error: 'not_found' | 'expired' | 'active' } {
  const s = load();
  const b = s.stored.find((x) => x.id === id);
  if (!b) return { ok: false, error: 'not_found' };
  if (b.expires <= now) return { ok: false, error: 'expired' };
  if (s.boosts.some((x) => now >= x.from && now < x.until)) return { ok: false, error: 'active' };
  const until = now + b.hours * 3_600_000;
  s.boosts.push({ pct: b.pct, from: now, until });
  s.stored = s.stored.filter((x) => x.id !== id);
  save(s);
  return { ok: true, until };
}

/* ---------------------------------------------------------------- beta test tools */
export type PassTestEvent = 'live_win' | 'live_loss' | 'bot_win' | 'referral' | 'xp_day';
export function addPassTest(e: PassTestEvent, now = Date.now()) {
  withSeason(now, (_s, ss) => {
    const g = (o: Partial<PassGame>): PassGame => ({ ts: now, live: true, outcome: 'win', moves: 30, vsBot: false, ...o });
    if (e === 'live_win') ss.testGames.push(g({}));
    else if (e === 'live_loss') ss.testGames.push(g({ outcome: 'loss' }));
    else if (e === 'bot_win') ss.testGames.push(g({ live: false, vsBot: true }));
    else if (e === 'referral') ss.testReferrals.push(now);
    else {
      const season = seasonAt(now);
      const used = new Set(ss.testGames.map((x) => tashkentDay(x.ts)));
      for (let d = season.start + 12 * 3600_000; d < now; d += DAY_MS) {
        if (used.has(tashkentDay(d)) || tashkentDay(d) === tashkentDay(now)) continue;
        for (let i = 0; i < 20; i++) ss.testGames.push(g({ ts: d + i * 60_000 }));
        return;
      }
      for (let i = 0; i < 20; i++) ss.testGames.push(g({ ts: now - (i + 1) * 1000 }));
    }
  });
}
/** Clears this season's test events, claims, Premium and everything the pass gave (test coins and shop items stay). */
/** Beta: the season starts over — claims, cosmetics and the game items the Pass gave are taken back. Returns unequipped slots. */
export function resetPassSeason(now = Date.now()): Slot[] {
  const freed = demoRevokePass();
  const s = load();
  const n = seasonAt(now).n;
  delete s.seasons[n];
  s.owned = s.owned.filter((o) => o.season !== n);
  s.equipped = {};
  s.boosts = [];
  s.stored = [];
  s.wallet = { crystal: 0, ticket: 0 };
  s.perks = [];
  save(s);
  return freed;
}
