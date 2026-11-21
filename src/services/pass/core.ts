/**
 * DAMEO Pass (season pass, "Royale Pass" style): pure rules shared by the beta (demo) adapter and mirrored 1:1 in SQL
 * (supabase/migrations/0031_season_pass.sql). No React, no I/O — unit-tested in core.test.ts.
 *
 *  - A season lasts 14 days (00:00 Tashkent, every second Monday) and has 20 levels.
 *  - XP comes from playing, winning, daily check-in, daily missions and invited friends; daily / per-season caps
 *    stop farming. XP is derived by the server from its own rows — the client never reports XP.
 *  - Two reward tracks per level: Free (everyone) and Elite (bought once per season, for coins or Stars).
 *    Every reward is claimed by pressing "Olish" (never automatic), once per season, level and track.
 */

/* ------------------------------------------------------------------ Uzbekistan time (UTC+5, no DST) */
export const TZ_OFFSET_MS = 5 * 3600 * 1000;
export const DAY_MS = 86_400_000;
export const tashkentDay = (ts: number): string => new Date(ts + TZ_OFFSET_MS).toISOString().slice(0, 10);
export const dayStartUtc = (day: string): number => Date.parse(`${day}T00:00:00Z`) - TZ_OFFSET_MS;

/* ------------------------------------------------------------------ seasons */
export const SEASON_DAYS = 14;
/** Season 1 starts on this Monday (Tashkent). Change only together with pass_settings.anchor in SQL. */
export const SEASON_ANCHOR = '2026-11-16';

export interface SeasonTheme {
  name_uz: string;
  name_en: string;
  /** colour accent of the season (CSS) */
  hue: number;
}
/** Themes rotate; the season number picks one. */
export const THEMES: SeasonTheme[] = [
  { name_uz: 'Qish qiroli', name_en: 'Winter King', hue: 205 },
  { name_uz: "Muz qal'a", name_en: 'Ice Fortress', hue: 190 },
  { name_uz: 'Oltin toj', name_en: 'Golden Crown', hue: 42 },
  { name_uz: 'Tungi arena', name_en: 'Night Arena', hue: 265 },
  { name_uz: 'Bahor shamoli', name_en: 'Spring Wind', hue: 140 },
  { name_uz: 'Olov jangi', name_en: 'Battle of Fire', hue: 12 },
];

export interface Season {
  n: number;
  start: number; // UTC ms, inclusive
  end: number; // UTC ms, exclusive
  theme: SeasonTheme;
}
export function seasonAt(ts: number, anchor = SEASON_ANCHOR): Season {
  const a = dayStartUtc(anchor);
  const len = SEASON_DAYS * DAY_MS;
  const n = Math.max(1, Math.floor((ts - a) / len) + 1);
  const start = a + (n - 1) * len;
  return { n, start, end: start + len, theme: THEMES[(n - 1) % THEMES.length] };
}

/* ------------------------------------------------------------------ levels */
export const MAX_LEVEL = 20;
/** XP needed to go from level n-1 to level n (index = n). Level 1 is reached at 0 XP. Total 5 850. */
export const LEVEL_STEP: number[] = [0, 0, ...Array.from({ length: MAX_LEVEL - 1 }, (_, i) => {
  const n = i + 2;
  return n <= 5 ? 150 : n <= 10 ? 250 : n <= 15 ? 350 : 450;
})];
/** Cumulative XP at which level n is reached. */
export const LEVEL_XP: number[] = LEVEL_STEP.reduce<number[]>((acc, step, n) => {
  acc[n] = n === 0 ? 0 : (acc[n - 1] ?? 0) + step;
  return acc;
}, []);

export interface LevelInfo {
  level: number;
  /** XP into the current level */
  into: number;
  /** XP of the current level step (0 at max) */
  step: number;
  /** total XP needed for the next level (null at max) */
  nextAt: number | null;
}
export function levelOf(xp: number): LevelInfo {
  let level = 1;
  while (level < MAX_LEVEL && xp >= LEVEL_XP[level + 1]) level++;
  if (level === MAX_LEVEL) return { level, into: 0, step: 0, nextAt: null };
  return { level, into: xp - LEVEL_XP[level], step: LEVEL_STEP[level + 1], nextAt: LEVEL_XP[level + 1] };
}

/* ------------------------------------------------------------------ XP rules */
export interface XpRules {
  liveGame: number; // finished game vs a person or a virtual opponent (rated)
  liveWin: number; // extra for winning it
  botWin: number; // practice bot win
  checkin: number; // first visit of the day ("Kirish")
  mission: number; // each daily mission claimed
  missionBonus: number; // all missions of the day claimed
  referral: number; // an invited friend finished their first 2 games
  liveGamesPerDay: number;
  botWinsPerDay: number;
  referralsPerSeason: number;
  dailyCap: number;
  minMoves: number;
  /** Elite owners get +X% XP (whole numbers) */
  eliteBoostPct: number;
}
export const DEFAULT_RULES: XpRules = {
  liveGame: 15,
  liveWin: 25,
  botWin: 10,
  checkin: 25,
  mission: 20,
  missionBonus: 40,
  referral: 150,
  liveGamesPerDay: 20,
  botWinsPerDay: 10,
  referralsPerSeason: 5,
  dailyCap: 1000,
  minMoves: 12,
  eliteBoostPct: 20,
};

export type XpSource = 'live_game' | 'live_win' | 'bot_win' | 'checkin' | 'mission' | 'mission_bonus' | 'referral';
export interface PassGame {
  ts: number;
  live: boolean; // vs a person / virtual opponent, rated by the server
  outcome: 'win' | 'loss' | 'draw';
  moves: number;
  vsBot: boolean; // practice bot
}
export interface SeasonActivity {
  games: PassGame[];
  /** Tashkent days with a check-in */
  checkins: string[];
  /** day → missions claimed that day (bonus excluded) */
  missions: Record<string, number>;
  /** days on which the mission bonus was claimed */
  missionBonus: string[];
  /** finish times of qualified referrals (friend finished 2 games) */
  referrals: number[];
}
export interface XpLine {
  source: XpSource;
  count: number;
  xp: number;
}
export interface XpResult {
  total: number;
  today: number;
  /** what today's XP came from (before the cap) */
  todayLines: XpLine[];
  capped: boolean;
}

/** Season XP: per Tashkent day sum every source, apply the Elite boost, then the daily cap. */
export function seasonXp(a: SeasonActivity, season: Season, r: XpRules, elite: boolean, now: number): XpResult {
  const inSeason = (ts: number) => ts >= season.start && ts < season.end;
  const days = new Map<string, Map<XpSource, XpLine>>();
  const add = (day: string, source: XpSource, xp: number, count = 1) => {
    const m = days.get(day) ?? new Map<XpSource, XpLine>();
    const l = m.get(source) ?? { source, count: 0, xp: 0 };
    l.count += count;
    l.xp += xp;
    m.set(source, l);
    days.set(day, m);
  };

  const byDay = new Map<string, PassGame[]>();
  for (const g of a.games) {
    if (!inSeason(g.ts) || g.moves < r.minMoves) continue;
    const d = tashkentDay(g.ts);
    byDay.set(d, [...(byDay.get(d) ?? []), g]);
  }
  for (const [d, games] of byDay) {
    const sorted = [...games].sort((x, y) => x.ts - y.ts);
    const live = sorted.filter((g) => g.live).slice(0, r.liveGamesPerDay);
    for (const g of live) {
      add(d, 'live_game', r.liveGame);
      if (g.outcome === 'win') add(d, 'live_win', r.liveWin);
    }
    const bot = sorted.filter((g) => g.vsBot && !g.live && g.outcome === 'win').slice(0, r.botWinsPerDay);
    for (const _ of bot) add(d, 'bot_win', r.botWin);
  }
  for (const d of new Set(a.checkins)) if (inSeason(dayStartUtc(d))) add(d, 'checkin', r.checkin);
  for (const [d, n] of Object.entries(a.missions)) if (n > 0 && inSeason(dayStartUtc(d))) add(d, 'mission', r.mission * n, n);
  for (const d of new Set(a.missionBonus)) if (inSeason(dayStartUtc(d))) add(d, 'mission_bonus', r.missionBonus);
  const refs = a.referrals.filter(inSeason).sort((x, y) => x - y).slice(0, r.referralsPerSeason);
  for (const ts of refs) add(tashkentDay(ts), 'referral', r.referral);

  const today = tashkentDay(now);
  let total = 0;
  let todayXp = 0;
  let capped = false;
  for (const [d, m] of days) {
    const raw = [...m.values()].reduce((s, l) => s + l.xp, 0);
    const boosted = elite ? Math.floor((raw * (100 + r.eliteBoostPct)) / 100) : raw;
    const v = Math.min(boosted, r.dailyCap);
    total += v;
    if (d === today) {
      todayXp = v;
      capped = boosted > r.dailyCap;
    }
  }
  const order: XpSource[] = ['live_game', 'live_win', 'bot_win', 'checkin', 'mission', 'mission_bonus', 'referral'];
  const todayLines = order.map((s) => days.get(today)?.get(s)).filter((l): l is XpLine => !!l);
  return { total, today: todayXp, todayLines, capped };
}

/* ------------------------------------------------------------------ rewards */
export type Track = 'free' | 'elite';
export type RewardKind = 'coins' | 'item' | 'title' | 'xp_boost';
export interface Reward {
  level: number;
  track: Track;
  kind: RewardKind;
  /** coins amount, or item slug (shop catalog), or title id */
  value: string;
  /** if the item is already owned it turns into these coins */
  fallbackCoins: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
  label_uz: string;
  label_en: string;
}

const c = (level: number, track: Track, n: number, rarity: Reward['rarity'] = 'common'): Reward => ({
  level,
  track,
  kind: 'coins',
  value: String(n),
  fallbackCoins: 0,
  rarity,
  label_uz: `${n} coin`,
  label_en: `${n} coins`,
});
const it = (level: number, track: Track, slug: string, fallback: number, rarity: Reward['rarity'], uz: string, en: string): Reward => ({
  level,
  track,
  kind: 'item',
  value: slug,
  fallbackCoins: fallback,
  rarity,
  label_uz: uz,
  label_en: en,
});
const title = (level: number, track: Track, id: string, rarity: Reward['rarity'], uz: string, en: string): Reward => ({
  level,
  track,
  kind: 'title',
  value: id,
  fallbackCoins: 0,
  rarity,
  label_uz: uz,
  label_en: en,
});

/**
 * Free track ≈ 1 070 coins + 3 items + 2 titles per season; Elite ≈ 2 300 coins + 6 items + 2 titles (below its
 * 3 000-coin price, so buying Elite with coins is a sink — its value is the items, titles and the XP boost).
 * Only non-limited shop items are used, so a pass never eats a Limited Edition serial.
 */
export const DEFAULT_REWARDS: Reward[] = [
  c(1, 'free', 30),
  c(2, 'free', 40),
  c(3, 'free', 50),
  it(4, 'free', 'graphite', 250, 'common', 'Graphite doska', 'Graphite board'),
  c(5, 'free', 60),
  c(6, 'free', 60),
  title(7, 'free', 'season_player', 'rare', '"Mavsum o\'yinchisi" unvoni', '"Season player" title'),
  c(8, 'free', 70),
  c(9, 'free', 70),
  it(10, 'free', 'st-royal-gold', 250, 'rare', 'Royal Gold toshlar', 'Royal Gold stones'),
  c(11, 'free', 70),
  c(12, 'free', 80),
  c(13, 'free', 80),
  c(14, 'free', 80),
  it(15, 'free', 'royal-wood', 600, 'rare', 'Royal Wood doska', 'Royal Wood board'),
  c(16, 'free', 90),
  c(17, 'free', 90),
  c(18, 'free', 100),
  c(19, 'free', 100),
  title(20, 'free', 'season_finisher', 'epic', '"Mavsum finalisti" unvoni', '"Season finisher" title'),

  c(1, 'elite', 100, 'rare'),
  it(2, 'elite', 'st-obsidian', 600, 'rare', 'Obsidian toshlar', 'Obsidian stones'),
  c(3, 'elite', 100, 'rare'),
  c(4, 'elite', 100, 'rare'),
  it(5, 'elite', 'fx-ripple', 1500, 'rare', "To'lqin effekti", 'Ripple effect'),
  c(6, 'elite', 150, 'rare'),
  c(7, 'elite', 150, 'rare'),
  it(8, 'elite', 'emerald-board', 900, 'epic', 'Emerald doska', 'Emerald board'),
  c(9, 'elite', 150, 'epic'),
  title(10, 'elite', 'elite_member', 'epic', '"Elite" unvoni', '"Elite" title'),
  c(11, 'elite', 150, 'epic'),
  it(12, 'elite', 'st-sapphire', 900, 'epic', 'Sapphire toshlar', 'Sapphire stones'),
  c(13, 'elite', 200, 'epic'),
  c(14, 'elite', 200, 'epic'),
  it(15, 'elite', 'fx-sparkle', 2500, 'epic', 'Uchqun effekti', 'Sparkle effect'),
  c(16, 'elite', 200, 'epic'),
  c(17, 'elite', 250, 'legendary'),
  c(18, 'elite', 250, 'legendary'),
  it(19, 'elite', 'fx-fire', 4000, 'legendary', 'Olov izi effekti', 'Fire trail effect'),
  title(20, 'elite', 'season_king', 'mythic', '"Mavsum qiroli" unvoni + 300 coin', '"Season king" title + 300 coins'),
];
/** The level-20 Elite title also pays these coins. */
export const ELITE_FINAL_COINS = 300;

export interface PassPrice {
  coins: number;
  stars: number;
}
export const DEFAULT_PRICE: PassPrice = { coins: 3000, stars: 99 };

/* ------------------------------------------------------------------ board (what the UI shows) */
export type RewardState = 'locked' | 'ready' | 'claimed' | 'elite_locked';
export interface RewardView extends Reward {
  state: RewardState;
}
export interface PassBoard {
  season: Season;
  xp: number;
  level: LevelInfo;
  elite: boolean;
  price: PassPrice;
  today: XpResult;
  checkedInToday: boolean;
  rewards: RewardView[];
  readyCount: number;
}

export const claimKey = (level: number, track: Track) => `${track}:${level}`;

export function buildPass(
  season: Season,
  a: SeasonActivity,
  rules: XpRules,
  rewards: Reward[],
  claims: string[],
  elite: boolean,
  price: PassPrice,
  now: number,
): PassBoard {
  const xp = seasonXp(a, season, rules, elite, now);
  const lv = levelOf(xp.total);
  const done = new Set(claims);
  const views = [...rewards]
    .sort((x, y) => x.level - y.level || (x.track === y.track ? 0 : x.track === 'free' ? -1 : 1))
    .map((r): RewardView => {
      const k = claimKey(r.level, r.track);
      const state: RewardState = done.has(k)
        ? 'claimed'
        : r.level > lv.level
          ? 'locked'
          : r.track === 'elite' && !elite
            ? 'elite_locked'
            : 'ready';
      return { ...r, state };
    });
  return {
    season,
    xp: xp.total,
    level: lv,
    elite,
    price,
    today: xp,
    checkedInToday: a.checkins.includes(tashkentDay(now)),
    rewards: views,
    readyCount: views.filter((v) => v.state === 'ready').length,
  };
}

export type PassClaimError = 'unknown' | 'locked' | 'elite' | 'already';
export type PassClaimCheck = { ok: true; reward: Reward } | { ok: false; error: PassClaimError };
export function checkPassClaim(board: PassBoard, level: number, track: Track): PassClaimCheck {
  const r = board.rewards.find((x) => x.level === level && x.track === track);
  if (!r) return { ok: false, error: 'unknown' };
  if (r.state === 'claimed') return { ok: false, error: 'already' };
  if (r.state === 'locked') return { ok: false, error: 'locked' };
  if (r.state === 'elite_locked') return { ok: false, error: 'elite' };
  return { ok: true, reward: r };
}

/** Coins a reward pays: coin rewards their amount, an owned item its fallback, the Elite final title its bonus. */
export function rewardCoins(r: Reward, alreadyOwned: boolean): number {
  if (r.kind === 'coins') return Number(r.value) || 0;
  if (r.kind === 'item') return alreadyOwned ? r.fallbackCoins : 0;
  if (r.kind === 'title' && r.level === MAX_LEVEL && r.track === 'elite') return ELITE_FINAL_COINS;
  return 0;
}

/** Sum of everything a track pays in coins (items counted as not owned). */
export const trackCoins = (rewards: Reward[], track: Track) =>
  rewards.filter((r) => r.track === track).reduce((s, r) => s + rewardCoins(r, false), 0);
