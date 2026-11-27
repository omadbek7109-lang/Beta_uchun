/**
 * DAMEO BETA — "Qish festivali" (Winter Festival, 1–31 December): advent calendar, the Ice Giant community boss,
 * the Santa vs Snow Maiden team race, three holiday bots, 12 winter challenges, the gift board, the New Year's Eve
 * arena and the "DAMEO 2026" year review. Everything here is pure + localStorage (beta has no server); the
 * same rules move to the server in main DAMEO.
 *
 * Fair by design: every reward comes from playing; a loss is never punished (it just does no damage).
 */
import type { MatchSummary, Player } from '../types/models.ts';
import { demoWalletApply } from './demoWallet.ts';
import { readJSON, writeJSON } from './localStore.ts';

/** beta: the festival runs now; day 1 = the day the beta preview started */
export const FEST_PREVIEW = true;
const PREVIEW_START = Date.UTC(2026, 10, 28) - 5 * 3_600_000; // 28 Nov 2026 00:00 Tashkent
export const FEST_EVENT = 'dameobeta:fest';
const KEY = 'dameobeta.fest.v1';
const TZ = 5 * 3_600_000;

export const dayKey = (ms: number) => new Date(ms + TZ).toISOString().slice(0, 10);
/** festival day 1…31 (0 = not started, 32 = over) */
export function festDay(now = Date.now()): number {
  if (FEST_PREVIEW) return Math.min(31, Math.max(1, Math.floor((now - PREVIEW_START) / 86_400_000) + 1));
  const d = new Date(now + TZ);
  if (d.getUTCMonth() !== 11) return d.getUTCMonth() === 0 ? 32 : 0;
  return d.getUTCDate();
}
/** the calendar date (Tashkent) of festival day n */
export function dateOfDay(n: number, now = Date.now()): string {
  if (FEST_PREVIEW) return dayKey(PREVIEW_START + (n - 1) * 86_400_000 + 3_600_000);
  return `${new Date(now + TZ).getUTCFullYear()}-12-${String(n).padStart(2, '0')}`;
}
/** midnight of the New Year in Tashkent (ms) */
export const NEW_YEAR_MS = Date.UTC(2027, 0, 1) - TZ;

/* ------------------------------------------------------------------ what happened in festival games */
export type HolidayBot = 'qorbobo' | 'qorqiz' | 'muzdev';
export interface FestGame {
  ts: number;
  result: 'win' | 'loss' | 'draw';
  /** plies in the game */
  moves: number;
  /** the human played black */
  black?: boolean;
  bot?: HolidayBot;
  /** gift-board game: gifts collected */
  gifts?: number;
  /** most pieces taken in one move */
  combo?: number;
  /** won with at least one king left */
  kingWin?: boolean;
}
export interface FestState {
  v: 1;
  games: FestGame[];
  /** opened calendar days */
  opened: number[];
  team: 'santa' | 'snow' | null;
  /** reward ids already taken (boss-…, ch-…, bots, all12 …) */
  got: string[];
  /** year review seen */
  wrapped?: boolean;
  /** the intro film was shown */
  intro?: boolean;
}
const fresh = (): FestState => ({ v: 1, games: [], opened: [], team: null, got: [] });
export function loadFest(): FestState {
  const s = readJSON<FestState | null>(KEY, null);
  if (!s || s.v !== 1) return fresh();
  return {
    ...fresh(),
    ...s,
    games: Array.isArray(s.games) ? s.games.slice(-500) : [],
    opened: (s.opened ?? []).filter((d) => Number.isInteger(d) && d >= 1 && d <= 31),
    got: Array.isArray(s.got) ? s.got : [],
  };
}
export function saveFest(s: FestState) {
  writeJSON(KEY, s);
  window.dispatchEvent(new Event(FEST_EVENT));
}
/** called when a local game ends */
export function recordFestGame(g: FestGame) {
  const s = loadFest();
  saveFest({ ...s, games: [...s.games, g].slice(-500) });
}
const pay = (coins: number, id: string, note: string) => {
  if (coins > 0) demoWalletApply(coins, 'reward', 'festival', id, `Qish festivali · ${note}`, `fest-${id}`);
};
const take = (s: FestState, id: string): FestState => ({ ...s, got: s.got.includes(id) ? s.got : [...s.got, id] });

/* ------------------------------------------------------------------ 1. advent calendar */
export type CalReward = { coins: number; frame?: string; big?: boolean };
export const CALENDAR: CalReward[] = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  if (d === 31) return { coins: 2026, frame: 'f-ny-royal', big: true };
  if (d === 25) return { coins: 500, frame: 'f-ny-gifts', big: true };
  if (d % 7 === 0) return { coins: 300, frame: ['f-ny-tale', 'f-ny-cabin', 'f-ny-crystal', 'f-ny-aurora'][d / 7 - 1], big: true };
  return { coins: 40 + (d % 5) * 15 };
});
const gamesOn = (s: FestState, matches: MatchSummary[], date: string) =>
  matches.filter((m) => dayKey(m.ts) === date).length + s.games.filter((g) => dayKey(g.ts) === date && !matches.some((m) => Math.abs(m.ts - g.ts) < 1500)).length;
export type CalState = 'opened' | 'ready' | 'play' | 'missed' | 'locked';
export function calendarState(s: FestState, matches: MatchSummary[], now = Date.now()) {
  const today = festDay(now);
  const playedToday = gamesOn(s, matches, dayKey(now)) > 0;
  const days = CALENDAR.map((r, i) => {
    const d = i + 1;
    const st: CalState = s.opened.includes(d) ? 'opened' : d > today ? 'locked' : d < today ? 'missed' : playedToday ? 'ready' : 'play';
    return { d, r, st };
  });
  // streak: opened days in a row ending today or yesterday
  let streak = 0;
  for (let d = today; d >= 1; d--) {
    if (s.opened.includes(d)) streak++;
    else if (d !== today) break;
  }
  return { today, days, streak, playedToday };
}
/** streak bonus: +10 % per day in a row (max +100 %) */
export const streakBonus = (streak: number) => Math.min(1, streak * 0.1);
export function openDay(s: FestState, matches: MatchSummary[], d: number, now = Date.now()): { ok: true; s: FestState; coins: number; frame?: string } | { ok: false } {
  const cal = calendarState(s, matches, now);
  const day = cal.days[d - 1];
  if (!day || day.st !== 'ready') return { ok: false };
  const coins = Math.round(day.r.coins * (1 + streakBonus(cal.streak)));
  pay(coins, `cal-${d}`, `${d}-kun qutisi`);
  return { ok: true, coins, frame: day.r.frame, s: { ...s, opened: [...s.opened, d] } };
}

/* ------------------------------------------------------------------ 2. the Ice Giant (community boss) */
export const BOSS_HP = 100_000;
/** damage to the Ice Giant: a win takes 5 HP, a draw 2 — no daily limit (100 wins a day = 500) */
export const hitOf = (r: FestGame['result']) => (r === 'win' ? 5 : r === 'draw' ? 2 : 0);
export function myHits(s: FestState) {
  return s.games.reduce((n, g) => n + hitOf(g.result), 0);
}
/** beta: everybody else's hits grow with the festival day (real numbers come from the server in main) */
export function bossState(s: FestState, now = Date.now()) {
  const day = festDay(now);
  const frac = Math.min(1, (now - (FEST_PREVIEW ? PREVIEW_START : NEW_YEAR_MS - 31 * 86_400_000)) / (31 * 86_400_000));
  const others = Math.round(BOSS_HP * Math.max(0.18, Math.min(0.97, 0.18 + frac * 0.79)));
  const mine = myHits(s);
  const hp = Math.max(0, BOSS_HP - others - mine);
  const pct = hp / BOSS_HP;
  const phase = pct > 0.75 ? 1 : pct > 0.5 ? 2 : pct > 0.25 ? 3 : pct > 0 ? 4 : 5;
  return { hp, pct, phase, mine, day, down: hp === 0 };
}
export const BOSS_MILESTONES = [
  { id: 'boss-25', hits: 25, coins: 100 },
  { id: 'boss-100', hits: 100, coins: 300 },
  { id: 'boss-300', hits: 300, coins: 800 },
];
export function claimBossMilestone(s: FestState, id: string): { ok: true; s: FestState; coins: number } | { ok: false } {
  const m = BOSS_MILESTONES.find((x) => x.id === id);
  if (!m || s.got.includes(id) || myHits(s) < m.hits) return { ok: false };
  pay(m.coins, id, `Muz Dev · ${m.hits} zarba`);
  return { ok: true, coins: m.coins, s: take(s, id) };
}
export function claimBossDown(s: FestState, now = Date.now()): { ok: true; s: FestState; coins: number } | { ok: false } {
  if (s.got.includes('boss-down') || !bossState(s, now).down || myHits(s) < 1) return { ok: false };
  pay(1_000, 'boss-down', "Muz Dev yiqildi");
  return { ok: true, coins: 1_000, s: take(s, 'boss-down') };
}
export function topHitters(players: Player[], me: { id: string; username: string } | null, s: FestState) {
  const rows = players.slice(0, 30).map((p, i) => ({ id: p.id, name: p.username, hits: Math.round(400 - i * 11 + ((p.rating * 7) % 37)), me: false }));
  if (me) rows.push({ id: me.id, name: me.username, hits: myHits(s), me: true });
  return rows.sort((a, b) => b.hits - a.hits).map((r, i) => ({ ...r, place: i + 1 }));
}

/* ------------------------------------------------------------------ 3. team race */
export type Team = 'santa' | 'snow';
export const teamPoints = (r: FestGame['result']) => (r === 'win' ? 3 : r === 'draw' ? 1 : 0) + 1; // +1 for playing at all
export function chooseTeam(s: FestState, team: Team): FestState {
  return s.team ? s : { ...s, team };
}
export function teamState(s: FestState, now = Date.now()) {
  const day = festDay(now);
  // beta: a close race that swings day by day
  const base = 1_800 + day * 2_100;
  const swing = Math.sin(day * 1.3) * 0.04;
  const mine = s.team ? s.games.filter((g) => g.ts >= 0).reduce((n, g) => n + teamPoints(g.result), 0) : 0;
  let santa = Math.round(base * (0.5 + swing));
  let snow = Math.round(base * (0.5 - swing));
  if (s.team === 'santa') santa += mine;
  if (s.team === 'snow') snow += mine;
  const total = santa + snow;
  return { santa, snow, santaPct: Math.round((santa / total) * 100), mine, lead: santa >= snow ? ('santa' as const) : ('snow' as const) };
}

/* ------------------------------------------------------------------ 4. holiday bots */
export interface BotDef {
  id: HolidayBot;
  /** portrait (public/fest) */
  art: string;
  level: 'easy' | 'medium' | 'hard';
  emoji: string;
  rating: number;
  coins: number;
}
export const HOLIDAY_BOTS: BotDef[] = [
  { id: 'qorbobo', art: 'av-qorbobo', level: 'easy', emoji: '🎅', rating: 1000, coins: 100 },
  { id: 'qorqiz', art: 'av-qorqiz', level: 'medium', emoji: '❄️', rating: 1450, coins: 200 },
  { id: 'muzdev', art: 'av-muzdev', level: 'hard', emoji: '🧊', rating: 1900, coins: 400 },
];
export const isHolidayBot = (x: string | null): x is HolidayBot => x === 'qorbobo' || x === 'qorqiz' || x === 'muzdev';
export const botBeaten = (s: FestState, id: HolidayBot) => s.games.some((g) => g.bot === id && g.result === 'win');
export function claimBot(s: FestState, id: HolidayBot): { ok: true; s: FestState; coins: number } | { ok: false } {
  const key = `bot-${id}`;
  const b = HOLIDAY_BOTS.find((x) => x.id === id)!;
  if (s.got.includes(key) || !botBeaten(s, id)) return { ok: false };
  pay(b.coins, key, `${id} yutildi`);
  return { ok: true, coins: b.coins, s: take(s, key) };
}
/** what a holiday bot says (i18n keys: fest.say.<bot>.<event>.<n>) */
export type SayEvent = 'start' | 'iTake' | 'youTake' | 'king' | 'iWin' | 'youWin' | 'draw';
export const SAY_COUNT: Record<SayEvent, number> = { start: 3, iTake: 3, youTake: 3, king: 2, iWin: 2, youWin: 2, draw: 1 };

/* ------------------------------------------------------------------ 5. twelve winter challenges */
export interface Challenge {
  id: string;
  goal: number;
  have: number;
}
export function challenges(s: FestState, cal: { streak: number }): Challenge[] {
  const g = s.games;
  const wins = g.filter((x) => x.result === 'win');
  let run = 0;
  let best = 0;
  for (const x of g) {
    run = x.result === 'win' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  let calRun = 0;
  let calBest = 0;
  for (let d = 1; d <= 31; d++) {
    calRun = s.opened.includes(d) ? calRun + 1 : 0;
    calBest = Math.max(calBest, calRun);
  }
  const list: [string, number, number][] = [
    ['beat-qorbobo', 1, botBeaten(s, 'qorbobo') ? 1 : 0],
    ['beat-qorqiz', 1, botBeaten(s, 'qorqiz') ? 1 : 0],
    ['beat-muzdev', 1, botBeaten(s, 'muzdev') ? 1 : 0],
    ['fast-win', 1, wins.some((x) => x.moves <= 30) ? 1 : 0],
    ['king-win', 1, wins.some((x) => x.kingWin) ? 1 : 0],
    ['combo3', 1, g.some((x) => (x.combo ?? 0) >= 3) ? 1 : 0],
    ['gifts', 5, Math.min(5, g.reduce((n, x) => n + (x.gifts ?? 0), 0))],
    ['streak3', 3, Math.min(3, best)],
    ['black-win', 1, wins.some((x) => x.black) ? 1 : 0],
    ['play10', 10, Math.min(10, g.length)],
    ['cal7', 7, Math.min(7, Math.max(calBest, cal.streak))],
    ['hits50', 50, Math.min(50, myHits(s))],
  ];
  return list.map(([id, goal, have]) => ({ id, goal, have }));
}
export const CH_COINS = 60;
export const ALL12_COINS = 1_500;
export function claimChallenge(s: FestState, c: Challenge): { ok: true; s: FestState; coins: number } | { ok: false } {
  const key = `ch-${c.id}`;
  if (s.got.includes(key) || c.have < c.goal) return { ok: false };
  pay(CH_COINS, key, `topshiriq ${c.id}`);
  return { ok: true, coins: CH_COINS, s: take(s, key) };
}
export function claimAll12(s: FestState, list: Challenge[]): { ok: true; s: FestState; coins: number } | { ok: false } {
  if (s.got.includes('all12') || list.some((c) => c.have < c.goal)) return { ok: false };
  pay(ALL12_COINS, 'all12', '12 ta topshiriq');
  return { ok: true, coins: ALL12_COINS, s: take(s, 'all12') };
}

/* ------------------------------------------------------------------ 6. gift board */
/** four gift squares on empty dark squares of the middle rows (seeded per game) */
export function giftSquares(seed: number): number[] {
  const free: number[] = [];
  for (let r = 3; r <= 4; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) free.push(r * 8 + c);
  let a = seed >>> 0 || 7;
  const rnd = () => ((a = (a * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out: number[] = [];
  while (out.length < 4 && free.length) out.push(...free.splice(Math.floor(rnd() * free.length), 1));
  return out.sort((x, y) => x - y);
}
export const GIFT_COINS = [15, 25, 40, 60];

/* ------------------------------------------------------------------ 7. New Year's Eve */
export const ARENA_START_MS = NEW_YEAR_MS - 3_600_000; // 31 Dec 23:00
export function countdown(now = Date.now()) {
  const ms = Math.max(0, NEW_YEAR_MS - now);
  return { ms, d: Math.floor(ms / 86_400_000), h: Math.floor(ms / 3_600_000) % 24, m: Math.floor(ms / 60_000) % 60, s: Math.floor(ms / 1000) % 60, arena: now >= ARENA_START_MS && now < NEW_YEAR_MS + 30 * 60_000, done: ms === 0 };
}

/* ------------------------------------------------------------------ 8. year review ("DAMEO 2026") */
export function yearReview(matches: MatchSummary[], players: Player[], me: { rating: number; username: string } | null) {
  const ms = matches.filter((m) => new Date(m.ts + TZ).getUTCFullYear() === 2026 || FEST_PREVIEW);
  const wins = ms.filter((m) => m.result === 'win').length;
  const draws = ms.filter((m) => m.result === 'draw').length;
  let run = 0;
  let best = 0;
  for (const m of [...ms].sort((a, b) => a.ts - b.ts)) {
    run = m.result === 'win' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  const opp = new Map<string, number>();
  for (const m of ms) opp.set(m.opponent, (opp.get(m.opponent) ?? 0) + 1);
  const rival = [...opp.entries()].sort((a, b) => b[1] - a[1])[0];
  const fastest = ms.filter((m) => m.result === 'win').sort((a, b) => a.moves - b.moves)[0];
  const days = new Set(ms.map((m) => dayKey(m.ts))).size;
  const rating = me?.rating ?? 1200;
  const below = players.filter((p) => p.rating < rating).length;
  const better = players.length ? Math.round((below / players.length) * 100) : 50;
  const hours = Math.max(1, Math.round((ms.reduce((n, m) => n + m.moves, 0) * 9) / 3600));
  return { games: ms.length, wins, draws, losses: ms.length - wins - draws, best, rival: rival ? { name: rival[0], n: rival[1] } : null, fastest: fastest?.moves ?? null, days, better, rating, hours, name: me?.username ?? '' };
}

/** the intro film: subtitles (i18n keys fest.film.<n>) by time in seconds — swap the file + these for a new cut */
export const FILM_SUBS: [number, number][] = [
  [0.3, 6.2],
  [6.4, 11.5],
  [11.7, 17.2],
  [17.4, 20.9],
  [21.0, 25.3],
  [25.4, 29.9],
  [30.0, 34.0],
  [34.1, 37.5],
  [37.6, 40.7],
  [40.8, 47.4],
];
/** URL of a festival picture (public/fest/<name>.webp) */
export const festArt = (name: string) => new URL(`fest/${name}.webp`, document.baseURI).href;
