/**
 * Beta / demo adapter for DAMEO Pass — no backend, TEST DATA ONLY.
 * Plays the server's role with the same rules (core.ts): XP is derived from this device's finished games,
 * daily-mission claims (beta missions), check-ins and beta test events. Rewards are paid in TEST coins / test items
 * that never leave the device. Storage: localStorage 'dameobeta.pass.v1' (separate from the main DAMEO app).
 */
import type { MatchSummary } from '../../types/models.ts';
import { demoGrant, demoOwns } from '../demoShop.ts';
import { demoBalance, demoWalletApply } from '../demoWallet.ts';
import { loadLocal } from '../localProfile.ts';
import { readJSON, writeJSON } from '../localStore.ts';
import {
  DEFAULT_PRICE,
  DEFAULT_REWARDS,
  DEFAULT_RULES,
  buildPass,
  checkPassClaim,
  claimKey,
  rewardCoins,
  seasonAt,
  tashkentDay,
  type PassBoard,
  type PassClaimError,
  type PassGame,
  type SeasonActivity,
  type Track,
} from './core.ts';

const KEY = 'dameobeta.pass.v1';
const MISSIONS_KEY = 'dameobeta.missions.v1';

interface SeasonState {
  claims: string[];
  elite: boolean;
  checkins: string[];
  /** day → missions claimed (copied from the beta missions, which keep only 7 days) */
  missions: Record<string, number>;
  missionBonus: string[];
  testGames: PassGame[];
  testReferrals: number[];
}
interface State {
  seasons: Record<string, SeasonState>;
  titles: string[];
  equippedTitle: string | null;
}
const blank = (): SeasonState => ({ claims: [], elite: false, checkins: [], missions: {}, missionBonus: [], testGames: [], testReferrals: [] });
const load = (): State => {
  const s = readJSON<Partial<State> | null>(KEY, null) ?? {};
  return { seasons: s.seasons ?? {}, titles: s.titles ?? [], equippedTitle: s.equippedTitle ?? null };
};
const save = (s: State) => {
  // keep the last 4 seasons
  const seasons = Object.fromEntries(Object.entries(s.seasons).sort(([a], [b]) => Number(b) - Number(a)).slice(0, 4));
  writeJSON(KEY, { ...s, seasons });
};

/** Copies today's (and the last week's) beta mission claims into the season so they survive the 7-day window. */
function syncMissions(ss: SeasonState) {
  const m = readJSON<{ claims?: Record<string, Record<string, number>> } | null>(MISSIONS_KEY, null);
  for (const [day, slugs] of Object.entries(m?.claims ?? {})) {
    const n = Object.keys(slugs).filter((k) => k !== '__bonus').length;
    ss.missions[day] = Math.max(ss.missions[day] ?? 0, n);
    if ('__bonus' in slugs && !ss.missionBonus.includes(day)) ss.missionBonus.push(day);
  }
}

const fromLocal = (m: MatchSummary): PassGame | null => {
  if (m.mode === 'practice' || m.mode === 'local') return null; // never recorded by the server either
  const live = m.mode === 'online' || m.mode === 'demo-rated';
  return { ts: m.ts, live: live && m.rated, outcome: m.result, moves: m.moves ?? 0, vsBot: m.mode === 'bot' };
};

function withSeason<T>(now: number, fn: (s: State, ss: SeasonState, n: number) => T): T {
  const s = load();
  const n = seasonAt(now).n;
  const ss = { ...blank(), ...(s.seasons[n] ?? {}) };
  syncMissions(ss);
  const out = fn(s, ss, n);
  s.seasons[n] = ss;
  save(s);
  return out;
}

function activity(ss: SeasonState): SeasonActivity {
  const games = loadLocal()
    .matches.map(fromLocal)
    .filter((g): g is PassGame => g !== null);
  return {
    games: [...games, ...ss.testGames],
    checkins: ss.checkins,
    missions: ss.missions,
    missionBonus: ss.missionBonus,
    referrals: ss.testReferrals,
  };
}
const board = (ss: SeasonState, now: number) =>
  buildPass(seasonAt(now), activity(ss), DEFAULT_RULES, DEFAULT_REWARDS, ss.claims, ss.elite, DEFAULT_PRICE, now);

export type DemoPass = PassBoard & { balance: number; titles: string[]; equippedTitle: string | null };
export function demoPass(now = Date.now()): DemoPass {
  return withSeason(now, (s, ss) => ({ ...board(ss, now), balance: demoBalance(), titles: s.titles, equippedTitle: s.equippedTitle }));
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
  | { ok: true; coins: number; item: string | null; title: string | null; balance: number }
  | { ok: false; error: PassClaimError; balance: number };
export function demoPassClaim(level: number, track: Track, now = Date.now()): DemoClaim {
  return withSeason(now, (s, ss, n) => {
    const r = checkPassClaim(board(ss, now), level, track);
    if (!r.ok) return { ok: false, error: r.error, balance: demoBalance() };
    const rw = r.reward;
    let item: string | null = null;
    let title: string | null = null;
    let owned = false;
    if (rw.kind === 'item') {
      owned = demoOwns(rw.value);
      if (!owned) owned = !demoGrant(rw.value); // could not grant → pay the coins instead
      if (!owned) item = rw.value;
    }
    if (rw.kind === 'title') {
      title = rw.value;
      if (!s.titles.includes(rw.value)) s.titles.push(rw.value);
    }
    const coins = rewardCoins(rw, owned);
    ss.claims.push(claimKey(level, track));
    if (coins > 0) demoWalletApply(coins, 'reward', 'pass', claimKey(level, track), `season ${n}`, `pass:${n}:${claimKey(level, track)}`);
    return { ok: true, coins, item, title, balance: demoBalance() };
  });
}

export type EliteResult = { ok: true; balance: number } | { ok: false; error: 'already' | 'insufficient' | 'stars_beta'; balance: number };
export function demoBuyElite(method: 'coins' | 'stars', now = Date.now()): EliteResult {
  return withSeason(now, (_s, ss, n) => {
    if (ss.elite) return { ok: false, error: 'already', balance: demoBalance() };
    if (method === 'stars') return { ok: false, error: 'stars_beta', balance: demoBalance() };
    try {
      demoWalletApply(-DEFAULT_PRICE.coins, 'purchase', 'pass', `elite:${n}`, `Elite season ${n}`, `pass_elite:${n}`);
    } catch {
      return { ok: false, error: 'insufficient', balance: demoBalance() };
    }
    ss.elite = true;
    return { ok: true, balance: demoBalance() };
  });
}

export function demoEquipTitle(id: string | null) {
  const s = load();
  if (id && !s.titles.includes(id)) return { ok: false };
  s.equippedTitle = id;
  save(s);
  return { ok: true };
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
      // "a full day": puts 20 live wins on an earlier day of this season (to test levels quickly)
      const season = seasonAt(now);
      const used = new Set(ss.testGames.map((x) => tashkentDay(x.ts)));
      for (let d = season.start + 12 * 3600_000; d < now; d += 86_400_000) {
        if (used.has(tashkentDay(d)) || tashkentDay(d) === tashkentDay(now)) continue;
        for (let i = 0; i < 20; i++) ss.testGames.push(g({ ts: d + i * 60_000 }));
        return;
      }
      for (let i = 0; i < 20; i++) ss.testGames.push(g({ ts: now - (i + 1) * 1000 }));
    }
  });
}
/** Clears this season's test events, claims and Elite (test coins and test items stay). */
export function resetPassSeason(now = Date.now()) {
  const s = load();
  delete s.seasons[seasonAt(now).n];
  save(s);
}
