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
  eliteBoostPct: 0,
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
/** a timed XP booster from a pass reward: +pct% on every Tashkent day it touches */
export interface XpBoost {
  pct: number;
  from: number; // UTC ms
  until: number; // UTC ms, exclusive
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

/** The strongest booster that touches this Tashkent day (boosters do not stack with each other). */
export function boostPct(boosts: XpBoost[], day: string): number {
  const t0 = dayStartUtc(day);
  const t1 = t0 + DAY_MS;
  return boosts.filter((b) => b.from < t1 && b.until > t0).reduce((m, b) => Math.max(m, b.pct), 0);
}

/** Season XP: per Tashkent day sum every source, apply the Elite boost, then the daily cap. */
export function seasonXp(a: SeasonActivity, season: Season, r: XpRules, elite: boolean, now: number, boosts: XpBoost[] = []): XpResult {
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
    const pct = (elite ? r.eliteBoostPct : 0) + boostPct(boosts, d);
    const boosted = Math.floor((raw * (100 + pct)) / 100);
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
/**
 * coins      — value = amount
 * item       — value = shop item slug (non-limited boards / stones / effects); owned → fallbackCoins
 * xp_boost   — value = percent, days = duration (from the claim)
 * box        — random coins between min and max
 * emoji      — status emoji next to the name (like Telegram Premium)        value = art id
 * frame      — avatar frame                                                   value = art id
 * background — profile background                                            value = art id
 * badge      — season badge on the profile                                   value = art id
 * title      — title under the name (days = how long, 0 = forever)          value = art id
 */
export type RewardKind = 'coins' | 'item' | 'xp_boost' | 'box' | 'emoji' | 'frame' | 'background' | 'badge' | 'title';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
export interface Reward {
  level: number;
  track: Track;
  kind: RewardKind;
  value: string;
  fallbackCoins: number;
  rarity: Rarity;
  label_uz: string;
  label_en: string;
  /** xp_boost / title: duration in days (0 = forever) */
  days?: number;
  /** box: coin range */
  min?: number;
  max?: number;
}
/** Cosmetics a player can own and wear. */
export type CosmeticKind = 'emoji' | 'frame' | 'background' | 'badge' | 'title';
export const COSMETIC_KINDS: CosmeticKind[] = ['emoji', 'frame', 'background', 'badge', 'title'];
export const isCosmetic = (k: RewardKind): k is CosmeticKind => (COSMETIC_KINDS as string[]).includes(k);

type R = Omit<Reward, 'level' | 'track' | 'fallbackCoins'> & { fallbackCoins?: number };
const at = (level: number, track: Track, r: R): Reward => ({ fallbackCoins: 0, ...r, level, track });
const coinR = (n: number, rarity: Rarity = 'common'): R => ({ kind: 'coins', value: String(n), rarity, label_uz: `${n} Dameo Coin`, label_en: `${n} Dameo Coins` });

/** Season 01 reward list — 20 free + 20 premium. */
export const DEFAULT_REWARDS: Reward[] = [
  at(1, 'free', coinR(50)),
  at(2, 'free', { kind: 'emoji', value: 'e-piece', rarity: 'common', label_uz: 'Dona emojisi', label_en: 'Piece emoji' }),
  at(3, 'free', { kind: 'xp_boost', value: '10', days: 3, rarity: 'common', label_uz: 'XP +10% (3 kun)', label_en: 'XP +10% (3 days)' }),
  at(4, 'free', { kind: 'frame', value: 'f-violet', rarity: 'rare', label_uz: 'Binafsha ramka', label_en: 'Violet frame' }),
  at(5, 'free', coinR(100)),
  at(6, 'free', { kind: 'emoji', value: 'e-crown', rarity: 'rare', label_uz: 'Toj emojisi', label_en: 'Crown emoji' }),
  at(7, 'free', { kind: 'background', value: 'bg-night', rarity: 'rare', label_uz: 'Tungi tog\'lar foni', label_en: 'Night mountains background' }),
  at(8, 'free', { kind: 'xp_boost', value: '20', days: 3, rarity: 'rare', label_uz: 'XP Booster +20% (3 kun)', label_en: 'XP Booster +20% (3 days)' }),
  at(9, 'free', { kind: 'item', value: 'graphite', fallbackCoins: 250, rarity: 'common', label_uz: 'Graphite doska', label_en: 'Graphite board' }),
  at(10, 'free', { kind: 'box', value: 'box-bag', min: 50, max: 250, rarity: 'rare', label_uz: 'Mukofot qutisi', label_en: 'Reward bag' }),
  at(11, 'free', coinR(150)),
  at(12, 'free', { kind: 'item', value: 'st-royal-gold', fallbackCoins: 250, rarity: 'rare', label_uz: 'Royal Gold donalar', label_en: 'Royal Gold pieces' }),
  at(13, 'free', { kind: 'emoji', value: 'e-win', rarity: 'rare', label_uz: 'WIN emojisi', label_en: 'WIN emoji' }),
  at(14, 'free', { kind: 'background', value: 'bg-aurora', rarity: 'rare', label_uz: 'Shimol shafag\'i foni', label_en: 'Aurora background' }),
  at(15, 'free', { kind: 'frame', value: 'f-silver', rarity: 'rare', label_uz: 'Kumush ramka', label_en: 'Silver frame' }),
  at(16, 'free', coinR(200)),
  at(17, 'free', { kind: 'title', value: 't-active', days: 7, rarity: 'epic', label_uz: '"Faol o\'yinchi" unvoni (7 kun)', label_en: '"Active player" title (7 days)' }),
  at(18, 'free', { kind: 'item', value: 'royal-wood', fallbackCoins: 600, rarity: 'epic', label_uz: 'Royal Wood doska', label_en: 'Royal Wood board' }),
  at(19, 'free', { kind: 'box', value: 'box-chest', min: 150, max: 500, rarity: 'epic', label_uz: 'Kichik sandiq', label_en: 'Small chest' }),
  at(20, 'free', { kind: 'badge', value: 'b-s1', rarity: 'epic', label_uz: 'Season 01 ishtirokchisi', label_en: 'Season 01 participant' }),

  at(1, 'elite', coinR(250, 'rare')),
  at(2, 'elite', { kind: 'item', value: 'st-sapphire', fallbackCoins: 900, rarity: 'epic', label_uz: 'Sapphire donalar', label_en: 'Sapphire pieces' }),
  at(3, 'elite', { kind: 'xp_boost', value: '50', days: 7, rarity: 'epic', label_uz: 'XP +50% (7 kun)', label_en: 'XP +50% (7 days)' }),
  at(4, 'elite', { kind: 'frame', value: 'f-gold', rarity: 'epic', label_uz: 'Oltin toj ramka (S1)', label_en: 'Golden crown frame (S1)' }),
  at(5, 'elite', { kind: 'emoji', value: 'e-diamond', rarity: 'epic', label_uz: 'Olmos emojisi', label_en: 'Diamond emoji' }),
  at(6, 'elite', { kind: 'item', value: 'fx-ripple', fallbackCoins: 1500, rarity: 'epic', label_uz: 'Neon yurish effekti', label_en: 'Neon move effect' }),
  at(7, 'elite', { kind: 'item', value: 'emerald-board', fallbackCoins: 900, rarity: 'epic', label_uz: 'Emerald doska', label_en: 'Emerald board' }),
  at(8, 'elite', { kind: 'emoji', value: 'e-gold-crown', rarity: 'legendary', label_uz: 'Oltin toj emojisi', label_en: 'Golden crown emoji' }),
  at(9, 'elite', { kind: 'title', value: 't-elite', days: 30, rarity: 'epic', label_uz: '"Dameo Elite" unvoni (30 kun)', label_en: '"Dameo Elite" title (30 days)' }),
  at(10, 'elite', { kind: 'box', value: 'box-epic', min: 400, max: 1000, rarity: 'legendary', label_uz: 'Kolleksiya sandig\'i (Epik)', label_en: 'Collection chest (Epic)' }),
  at(11, 'elite', coinR(500, 'epic')),
  at(12, 'elite', { kind: 'background', value: 'bg-palace', rarity: 'legendary', label_uz: 'Oltin saroy foni', label_en: 'Golden palace background' }),
  at(13, 'elite', { kind: 'emoji', value: 'e-fire', rarity: 'legendary', label_uz: 'Olov emojisi', label_en: 'Fire emoji' }),
  at(14, 'elite', { kind: 'item', value: 'fx-fire', fallbackCoins: 4000, rarity: 'legendary', label_uz: 'Olov dona effekti', label_en: 'Fire piece effect' }),
  at(15, 'elite', { kind: 'background', value: 'bg-cosmos', rarity: 'legendary', label_uz: 'Kosmos foni', label_en: 'Cosmos background' }),
  at(16, 'elite', { kind: 'frame', value: 'f-epic', rarity: 'legendary', label_uz: 'Animatsiyali ramka (Epik)', label_en: 'Animated frame (Epic)' }),
  at(17, 'elite', { kind: 'badge', value: 'b-s1-gold', rarity: 'legendary', label_uz: 'Season 01 oltin belgi', label_en: 'Season 01 gold badge' }),
  at(18, 'elite', { kind: 'item', value: 'fx-sparkle', fallbackCoins: 2500, rarity: 'legendary', label_uz: 'Uchqun yurish effekti', label_en: 'Sparkle move effect' }),
  at(19, 'elite', { kind: 'title', value: 't-champion', days: 30, rarity: 'legendary', label_uz: '"Chempion da\'vogar" unvoni (30 kun)', label_en: '"Title contender" title (30 days)' }),
  at(20, 'elite', { kind: 'frame', value: 'f-legend', rarity: 'mythic', label_uz: 'Season 01 Premium ramka', label_en: 'Season 01 Premium frame' }),
];

export interface PassPrice {
  /** shown price; paid through FLECT STARS (so'm) */
  som: number;
  stars: number;
}
export const DEFAULT_PRICE: PassPrice = { som: 11_900, stars: 99 };

/** Coins a reward pays now (a box needs its roll; an owned item pays its fallback). */
export function rewardCoins(r: Reward, alreadyOwned: boolean, roll = 0): number {
  if (r.kind === 'coins') return Number(r.value) || 0;
  if (r.kind === 'item') return alreadyOwned ? r.fallbackCoins : 0;
  if (r.kind === 'box') {
    const lo = r.min ?? 0;
    const hi = Math.max(lo, r.max ?? lo);
    return lo + Math.floor(Math.max(0, Math.min(0.999999, roll)) * (hi - lo + 1));
  }
  return 0;
}

/** Sum of fixed coins a track pays (boxes at their average, items as not owned). */
export const trackCoins = (rewards: Reward[], track: Track) =>
  rewards
    .filter((r) => r.track === track)
    .reduce((s, r) => s + (r.kind === 'box' ? ((r.min ?? 0) + (r.max ?? 0)) / 2 : rewardCoins(r, false)), 0);

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
  /** strongest XP booster active today (percent) */
  boostToday: number;
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
  boosts: XpBoost[] = [],
  /** beta showcase: treat the season as finished (every level reached) */
  allOpen = false,
): PassBoard {
  const xp = seasonXp(a, season, rules, elite, now, boosts);
  if (allOpen) xp.total = Math.max(xp.total, LEVEL_XP[MAX_LEVEL]);
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
    boostToday: boostPct(boosts, tashkentDay(now)) + (elite ? rules.eliteBoostPct : 0),
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
