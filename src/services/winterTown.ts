/**
 * DAMEO BETA — "Qishki shahar" (Winter Town): everybody builds one town together in December.
 * Every finished game adds snow ❄ to one shared counter (win +2, draw +1, loss +1); at each goal a new part of the
 * town opens (tree → houses → lights → ice rink → the big celebration) and EVERY player can take that stage's reward.
 *
 * Beta: there is no server, so the shared counter is simulated and, for testing, every stage is open (TOWN_PREVIEW);
 * the player's own share is counted from their real games on this device. In main DAMEO the counter is one number on
 * the server, bumped once per finished game (no extra reads per move).
 */
import type { MatchSummary, Player } from '../types/models.ts';
import { demoWalletApply } from './demoWallet.ts';

/** Beta: everything open so the whole town can be tried now. */
export const TOWN_PREVIEW = true;
/** 1 December 00:00 – 31 December 23:59, Tashkent (UTC+5) */
export const TOWN_START = Date.UTC(2026, 11, 1) - 5 * 3_600_000;
export const TOWN_END = Date.UTC(2027, 0, 1) - 5 * 3_600_000;

export interface TownStage {
  n: number;
  key: 'tree' | 'houses' | 'lights' | 'rink' | 'party';
  icon: string;
  goal: number;
  coins: number;
}
/** Goals sized for today's audience (~450 games a day ≈ 1 300 ❄ a day): the last one lands around New Year's Eve. */
export const TOWN_STAGES: TownStage[] = [
  { n: 1, key: 'tree', icon: '🎄', goal: 2_000, coins: 100 },
  { n: 2, key: 'houses', icon: '🏠', goal: 8_000, coins: 200 },
  { n: 3, key: 'lights', icon: '💡', goal: 16_000, coins: 300 },
  { n: 4, key: 'rink', icon: '⛸️', goal: 26_000, coins: 500 },
  { n: 5, key: 'party', icon: '🎆', goal: 40_000, coins: 1_000 },
];
export const SNOW_PER = { win: 2, draw: 1, loss: 1 } as const;

/** The player's own snow: their finished games in the season (beta preview: all of them). */
export function mySnow(matches: MatchSummary[], now = Date.now()): number {
  let s = 0;
  for (const m of matches) {
    if (!TOWN_PREVIEW && (m.ts < TOWN_START || m.ts >= TOWN_END || m.ts > now)) continue;
    s += SNOW_PER[m.result as keyof typeof SNOW_PER] ?? 0;
  }
  return s;
}

/** Simulated shared counter (beta): steady growth through the month; preview = past the last goal. */
export function communitySnow(mine: number, now = Date.now()): number {
  if (TOWN_PREVIEW) return 41_200 + mine;
  const days = Math.max(0, Math.min(31, (now - TOWN_START) / 86_400_000));
  return Math.round(days * 1_300) + mine;
}
/** players taking part: about one per 33 ❄ (preview ≈ 1 250) */
export const participants = (total: number) => Math.max(1, Math.round(total / 33));

export const stageOpen = (st: TownStage, total: number) => total >= st.goal;
/** the stage being built now (the first one not reached), null when all are open */
export const currentStage = (total: number) => TOWN_STAGES.find((s) => total < s.goal) ?? null;
/** progress 0–1 along the road: icon i sits at i/(N-1) and is reached at its goal */
export function roadProgress(total: number): number {
  const N = TOWN_STAGES.length;
  for (let i = 0; i < N; i++) {
    const g = TOWN_STAGES[i].goal;
    if (total < g) return i === 0 ? 0 : (i - 1 + (total - TOWN_STAGES[i - 1].goal) / (g - TOWN_STAGES[i - 1].goal)) / (N - 1);
  }
  return 1;
}

/** Top contributors: the demo players with a steady share each, plus the player when they make it. */
export function topBuilders(players: Player[], me: { id: string; username: string; avatar?: string | null } | null, mine: number, n = 10) {
  const rows = players.map((p, i) => {
    let h = 0;
    for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { id: p.id, name: p.username, avatar: (p.avatar ?? null) as string | null, snow: 180 + (h % 1300) + (i % 7) * 11, me: false };
  });
  if (me) rows.push({ id: me.id, name: me.username, avatar: me.avatar ?? null, snow: mine, me: true });
  rows.sort((a, b) => b.snow - a.snow);
  return { top: rows.slice(0, n), myPlace: me ? rows.findIndex((r) => r.me) + 1 : null };
}

/* ---------------------------------------------------------------- rewards (beta: this device) */
const KEY = 'dameobeta.town.v1';
export const TOWN_EVENT = 'dameobeta:town';
function claimed(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}
export const townClaimed = () => claimed();
/** Takes a stage's reward once: only when the stage is open. */
export function claimTownStage(n: number, total: number): { ok: true; coins: number } | { ok: false; error: 'locked' | 'claimed' } {
  const st = TOWN_STAGES.find((s) => s.n === n);
  if (!st || !stageOpen(st, total)) return { ok: false, error: 'locked' };
  const c = claimed();
  if (c.includes(n)) return { ok: false, error: 'claimed' };
  demoWalletApply(st.coins, 'town', 'town_stage', String(n), `Qishki shahar · ${n}-bosqich`, `town-${n}`);
  try {
    localStorage.setItem(KEY, JSON.stringify([...c, n]));
  } catch {
    /* private mode: the coins are given, the mark is lost */
  }
  window.dispatchEvent(new Event(TOWN_EVENT));
  return { ok: true, coins: st.coins };
}
