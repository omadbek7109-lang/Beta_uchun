/**
 * DAMEO 3.2 — Daily Missions: pure rules shared by the beta (demo) adapter and mirrored 1:1 in SQL
 * (supabase/migrations/0030_daily_missions.sql → _mission_progress / claim_daily_mission).
 * No React, no I/O — everything here is unit-tested (core.test.ts).
 */

export type MissionKind =
  | 'puzzle_solve'
  | 'referral_join'
  | 'bot_win_medium'
  | 'rated_win_streak'
  | 'rated_complete'
  | 'rated_win'
  | 'match_complete';

export const MISSION_KINDS: MissionKind[] = ['puzzle_solve', 'referral_join', 'bot_win_medium', 'rated_win_streak', 'rated_complete', 'rated_win', 'match_complete'];

export interface MissionDef {
  slug: string;
  kind: MissionKind;
  target: number;
  reward: number;
  title_uz: string;
  title_en: string;
  sort: number;
  active: boolean;
}

export interface MissionSettings {
  /** coins for claiming every active mission of the day */
  bonus: number;
  /** hard ceiling of mission coins per player per day (missions + bonus) */
  dailyCap: number;
  /** a finished game counts only from this many plies (same anti-farming rule as match coins) */
  minMoves: number;
}

export const BONUS_SLUG = '__bonus';
export const DEFAULT_SETTINGS: MissionSettings = { bonus: 60, dailyCap: 300, minMoves: 12 };

/** The 7 launch missions: 240 coins + 60 bonus = 300 per day. */
export const DEFAULT_DEFS: MissionDef[] = [
  { slug: 'puzzles_10', kind: 'puzzle_solve', target: 10, reward: 30, title_uz: '10 ta jumboq yech', title_en: 'Solve 10 puzzles', sort: 10, active: true },
  { slug: 'invite_1', kind: 'referral_join', target: 1, reward: 60, title_uz: "1 ta yangi do'st taklif qil", title_en: 'Invite 1 new player', sort: 20, active: true },
  { slug: 'bot_medium', kind: 'bot_win_medium', target: 1, reward: 20, title_uz: "O'rta darajali botni yut", title_en: 'Defeat the Medium bot', sort: 30, active: true },
  { slug: 'streak_3', kind: 'rated_win_streak', target: 3, reward: 50, title_uz: "Ketma-ket 3 ta reytingli o'yinda yut", title_en: 'Win 3 rated games in a row', sort: 40, active: true },
  { slug: 'rated_5', kind: 'rated_complete', target: 5, reward: 30, title_uz: "5 ta reytingli o'yinni yakunla", title_en: 'Complete 5 rated games', sort: 50, active: true },
  { slug: 'rated_win_2', kind: 'rated_win', target: 2, reward: 30, title_uz: "2 ta reytingli o'yinda yut", title_en: 'Win 2 rated games', sort: 60, active: true },
  { slug: 'matches_3', kind: 'match_complete', target: 3, reward: 20, title_uz: "3 ta o'yinni yakunla", title_en: 'Complete 3 games', sort: 70, active: true },
];

/* ------------------------------------------------------------------ Uzbekistan day (UTC+5, no DST) */
export const TZ_OFFSET_MS = 5 * 3600 * 1000;
const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' of the Tashkent calendar day containing ts. */
export const tashkentDay = (ts: number): string => new Date(ts + TZ_OFFSET_MS).toISOString().slice(0, 10);
/** UTC ms of 00:00 Tashkent on that day. */
export const dayStartUtc = (day: string): number => Date.parse(`${day}T00:00:00Z`) - TZ_OFFSET_MS;
/** UTC ms of the next 00:00 Tashkent after ts. */
export const nextResetTs = (ts: number): number => dayStartUtc(tashkentDay(ts)) + DAY_MS;

/* ------------------------------------------------------------------ progress */
export interface FinishedGame {
  /** finish time, UTC ms */
  ts: number;
  rated: boolean;
  outcome: 'win' | 'loss' | 'draw';
  /** plies played */
  moves: number;
  vsBot: boolean;
  botLevel?: 'easy' | 'medium' | 'hard' | null;
}
export interface DayActivity {
  games: FinishedGame[];
  referrals: number;
  puzzles: number;
}

/** Longest run of consecutive rated wins (a loss or draw resets it), in finish order. */
export function bestWinStreak(games: FinishedGame[]): number {
  let cur = 0;
  let best = 0;
  for (const g of [...games].sort((a, b) => a.ts - b.ts)) {
    if (g.outcome === 'win') best = Math.max(best, ++cur);
    else cur = 0;
  }
  return best;
}

export function measure(kind: MissionKind, a: DayActivity, s: MissionSettings): number {
  const counted = a.games.filter((g) => g.moves >= s.minMoves);
  const rated = counted.filter((g) => g.rated);
  switch (kind) {
    case 'puzzle_solve':
      return a.puzzles;
    case 'referral_join':
      return a.referrals;
    case 'bot_win_medium':
      return counted.filter((g) => g.vsBot && !g.rated && g.botLevel === 'medium' && g.outcome === 'win').length;
    case 'rated_win_streak':
      return bestWinStreak(rated);
    case 'rated_complete':
      return rated.length;
    case 'rated_win':
      return rated.filter((g) => g.outcome === 'win').length;
    case 'match_complete':
      return counted.length;
  }
}

/* ------------------------------------------------------------------ board (what the UI shows) */
export interface MissionView {
  slug: string;
  kind: MissionKind;
  target: number;
  reward: number;
  progress: number;
  title_uz: string;
  title_en: string;
  claimed: boolean;
  claimable: boolean;
}
export interface MissionBoard {
  day: string;
  resetsAt: number;
  cap: number;
  bonus: number;
  bonusClaimed: boolean;
  bonusClaimable: boolean;
  earned: number;
  missions: MissionView[];
}

/** claims: slug → coins actually paid today (BONUS_SLUG included). */
export function finalizeBoard(
  day: string,
  cap: number,
  bonus: number,
  rows: Omit<MissionView, 'claimable'>[],
  claims: Record<string, number>,
): MissionBoard {
  const missions = rows.map((m) => ({ ...m, progress: Math.min(m.progress, m.target), claimable: !m.claimed && m.progress >= m.target }));
  const bonusClaimed = BONUS_SLUG in claims;
  const earned = Object.values(claims).reduce((s, v) => s + v, 0);
  return {
    day,
    resetsAt: dayStartUtc(day) + DAY_MS,
    cap,
    bonus,
    bonusClaimed,
    bonusClaimable: !bonusClaimed && missions.length > 0 && missions.every((m) => m.claimed),
    earned,
    missions,
  };
}

export function buildBoard(defs: MissionDef[], s: MissionSettings, a: DayActivity, claims: Record<string, number>, day: string): MissionBoard {
  const rows = defs
    .filter((d) => d.active)
    .sort((x, y) => x.sort - y.sort || x.slug.localeCompare(y.slug))
    .map((d) => ({
      slug: d.slug,
      kind: d.kind,
      target: d.target,
      reward: d.reward,
      title_uz: d.title_uz,
      title_en: d.title_en,
      progress: measure(d.kind, a, s),
      claimed: d.slug in claims,
    }));
  return finalizeBoard(day, s.dailyCap, s.bonus, rows, claims);
}

export type ClaimError = 'unknown' | 'not_done' | 'already';
export type ClaimCheck = { ok: true; amount: number } | { ok: false; error: ClaimError };

/** The server's claim rule: done, not yet claimed, and never above the daily cap. */
export function checkClaim(board: MissionBoard, slug: string): ClaimCheck {
  let amount: number;
  if (slug === BONUS_SLUG) {
    if (board.bonusClaimed) return { ok: false, error: 'already' };
    if (!board.bonusClaimable) return { ok: false, error: 'not_done' };
    amount = board.bonus;
  } else {
    const m = board.missions.find((x) => x.slug === slug);
    if (!m) return { ok: false, error: 'unknown' };
    if (m.claimed) return { ok: false, error: 'already' };
    if (m.progress < m.target) return { ok: false, error: 'not_done' };
    amount = m.reward;
  }
  return { ok: true, amount: Math.max(0, Math.min(amount, board.cap - board.earned)) };
}

/* ------------------------------------------------------------------ admin validation */
export type DefsError = 'over_cap' | 'bad_target' | 'bad_reward' | 'bad_title' | 'bad_settings';
export function validateConfig(defs: MissionDef[], s: MissionSettings): DefsError | null {
  if (![s.bonus, s.dailyCap, s.minMoves].every((v) => Number.isInteger(v) && v >= 0) || s.bonus > 1000 || s.dailyCap > 5000 || s.minMoves > 200) return 'bad_settings';
  for (const d of defs) {
    if (!Number.isInteger(d.target) || d.target < 1 || d.target > 1000) return 'bad_target';
    if (!Number.isInteger(d.reward) || d.reward < 0 || d.reward > 1000) return 'bad_reward';
    if (!d.title_uz.trim() || !d.title_en.trim() || d.title_uz.length > 120 || d.title_en.length > 120) return 'bad_title';
  }
  return maxDaily(defs, s) > s.dailyCap ? 'over_cap' : null;
}
export const maxDaily = (defs: MissionDef[], s: MissionSettings) => defs.filter((d) => d.active).reduce((t, d) => t + d.reward, 0) + s.bonus;
