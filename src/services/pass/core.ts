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
  { name_uz: 'Royal Legacy', name_en: 'Royal Legacy', hue: 275 },
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
 * item       — value = shop item slug (non-limited boards / pieces / effects); owned → fallbackCoins
 * xp_boost   — value = percent, days = duration (from the claim)
 * box        — random coins between min and max
 * currency   — value = 'crystal' | 'ticket', amount = how many
 * perk       — value = 'mission_slot', amount = +N, days = duration
 * emoji      — value = one or more emoji ids (comma list): status emoji next to the name
 * frame / background / badge — value = cosmetic id
 * title      — value = title id, days = how long (0 = forever)
 */
export type RewardKind = 'coins' | 'item' | 'xp_boost' | 'box' | 'currency' | 'perk' | 'emoji' | 'frame' | 'background' | 'badge' | 'title';
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
  /** picture of the reward (one SVG file per reward, public/pass/s1/*.svg) */
  art?: string;
  days?: number;
  min?: number;
  max?: number;
  amount?: number;
  /** what it is in the game, shown in the reward details */
  note_uz?: string;
  note_en?: string;
}
export type CosmeticKind = 'emoji' | 'frame' | 'background' | 'badge' | 'title';
export const COSMETIC_KINDS: CosmeticKind[] = ['emoji', 'frame', 'background', 'badge', 'title'];
export const isCosmetic = (k: RewardKind): k is CosmeticKind => (COSMETIC_KINDS as string[]).includes(k);
export type Currency = 'crystal' | 'ticket';

type R = Omit<Reward, 'level' | 'track' | 'fallbackCoins' | 'art'> & { fallbackCoins?: number };
/** every reward has its own illustration, drawn as SVG (public/pass/s1/*.svg) */
const F = (level: number, r: R): Reward => ({ fallbackCoins: 0, ...r, level, track: 'free', art: `pass/s1/free-${String(level).padStart(2, '0')}.svg` });
const P = (level: number, r: R): Reward => ({ fallbackCoins: 0, ...r, level, track: 'elite', art: `pass/s1/prem-${String(level).padStart(2, '0')}.svg` });
const coinR = (n: number, rarity: Rarity = 'common'): R => ({ kind: 'coins', value: String(n), rarity, label_uz: `${n} Dameo Coin`, label_en: `${n} Dameo Coins` });
const item = (slug: string, fallback: number, rarity: Rarity, uz: string, en: string, nuz: string, nen: string): R => ({
  kind: 'item', value: slug, fallbackCoins: fallback, rarity, label_uz: uz, label_en: en, note_uz: nuz, note_en: nen,
});

/** Season 01 "Royal Legacy" — 20 free + 20 premium rewards, no two alike (the server's pass_rewards table holds the same rows). */
export const DEFAULT_REWARDS: Reward[] = [
  F(1, coinR(50)),
  F(2, item('st-obsidian', 600, 'common', 'Klassik dona', 'Classic pieces', "O'yinda: Obsidian donalar", 'In game: Obsidian pieces')),
  F(3, { kind: 'xp_boost', value: '10', days: 3, rarity: 'common', label_uz: 'XP kartasi', label_en: 'XP card', note_uz: 'XP +10% (3 kun)', note_en: 'XP +10% (3 days)' }),
  F(4, { kind: 'background', value: 'bg-mountains', rarity: 'common', label_uz: "Tog'lar profil foni", label_en: 'Mountains background' }),
  F(5, coinR(100)),
  F(6, { kind: 'emoji', value: 'e-smile,e-heart,e-piece', rarity: 'common', label_uz: 'Oddiy emoji kolleksiyasi', label_en: 'Basic emoji set', note_uz: '3 ta emoji — ism yonida', note_en: '3 emoji — next to your name' }),
  F(7, { kind: 'frame', value: 'f-basic', rarity: 'common', label_uz: 'Basic avatar ramkasi', label_en: 'Basic avatar frame' }),
  F(8, { kind: 'xp_boost', value: '20', days: 3, rarity: 'rare', label_uz: 'XP Booster', label_en: 'XP Booster', note_uz: 'XP +20% (3 kun)', note_en: 'XP +20% (3 days)' }),
  F(9, item('graphite', 250, 'common', 'Oddiy shashka doskasi', 'Classic board', "O'yinda: Graphite doska", 'In game: Graphite board')),
  F(10, { kind: 'badge', value: 'b-bronze', rarity: 'common', label_uz: 'Bronze yutuq belgisi', label_en: 'Bronze badge' }),
  F(11, coinR(150)),
  F(12, { kind: 'background', value: 'bg-desert', rarity: 'rare', label_uz: 'Sahro profil foni', label_en: 'Desert background' }),
  F(13, { kind: 'emoji', value: 'e-win', rarity: 'rare', label_uz: 'WIN stikeri', label_en: 'WIN sticker', note_uz: 'Ism yonida ko\'rinadi', note_en: 'Shown next to your name' }),
  F(14, { kind: 'perk', value: 'mission_slot', amount: 1, days: 3, rarity: 'rare', label_uz: 'Daily Mission bonusi', label_en: 'Daily Mission bonus', note_uz: 'Topshiriq sloti +1 (3 kun)', note_en: 'Mission slot +1 (3 days)' }),
  F(15, coinR(200)),
  F(16, { kind: 'badge', value: 'b-silver', rarity: 'rare', label_uz: 'Silver badge', label_en: 'Silver badge' }),
  F(17, { kind: 'title', value: 't-active', days: 7, rarity: 'rare', label_uz: '"Faol o\'yinchi" unvoni', label_en: '"Active player" title', note_uz: '7 kun', note_en: '7 days' }),
  F(18, item('royal-wood', 600, 'rare', 'Rangli klassik doska', 'Colourful board', "O'yinda: Royal Wood doska", 'In game: Royal Wood board')),
  F(19, { kind: 'box', value: 'box-material', min: 150, max: 500, rarity: 'rare', label_uz: 'Material sandiq', label_en: 'Material chest', note_uz: '150–500 coin', note_en: '150–500 coins' }),
  F(20, { kind: 'badge', value: 'b-s1', rarity: 'epic', label_uz: 'Season 01 ishtirokchisi', label_en: 'Season 01 participant' }),

  P(1, coinR(500, 'rare')),
  P(2, item('st-royal-gold', 250, 'epic', 'Golden Royal dona', 'Golden Royal pieces', "O'yinda: Royal Gold donalar", 'In game: Royal Gold pieces')),
  P(3, { kind: 'xp_boost', value: '50', days: 7, rarity: 'epic', label_uz: 'XP +50% Booster', label_en: 'XP +50% Booster', note_uz: '7 kun', note_en: '7 days' }),
  P(4, { kind: 'frame', value: 'f-royal', rarity: 'legendary', label_uz: 'Legendary Royal ramka', label_en: 'Legendary Royal frame' }),
  P(5, { kind: 'currency', value: 'crystal', amount: 100, rarity: 'epic', label_uz: '100 Creative Crystal', label_en: '100 Creative Crystals' }),
  P(6, item('fx-lightning', 4000, 'epic', 'Neon yurish effekti', 'Neon move effect', "O'yinda: Chaqmoq effekti", 'In game: Lightning effect')),
  P(7, item('emerald-board', 900, 'epic', 'Royal animatsiyali doska', 'Royal animated board', "O'yinda: Emerald doska", 'In game: Emerald board')),
  P(8, { kind: 'emoji', value: 'e-gold-crown,e-diamond,e-fire,e-star,e-crown', rarity: 'epic', label_uz: 'VIP emoji kolleksiyasi', label_en: 'VIP emoji set', note_uz: '5 ta emoji — ism yonida', note_en: '5 emoji — next to your name' }),
  P(9, { kind: 'title', value: 't-elite', days: 30, rarity: 'epic', label_uz: '"Dameo Elite" unvoni', label_en: '"Dameo Elite" title', note_uz: '30 kun', note_en: '30 days' }),
  P(10, { kind: 'box', value: 'box-epic', min: 400, max: 1000, rarity: 'legendary', label_uz: 'Epic sandiq', label_en: 'Epic chest', note_uz: '400–1000 coin', note_en: '400–1000 coins' }),
  P(11, coinR(1000, 'legendary')),
  P(12, { kind: 'background', value: 'bg-castle', rarity: 'legendary', label_uz: 'Qasr profil foni', label_en: 'Castle background' }),
  P(13, { kind: 'frame', value: 'f-premium', rarity: 'epic', label_uz: 'Premium avatar ramkasi', label_en: 'Premium avatar frame' }),
  P(14, item('fx-fire', 4000, 'legendary', 'Fire Crown dona effekti', 'Fire Crown piece effect', "O'yinda: Olov izi effekti", 'In game: Fire trail effect')),
  P(15, { kind: 'currency', value: 'ticket', amount: 5, rarity: 'epic', label_uz: "Golden o'yin chiptasi", label_en: 'Golden game ticket', note_uz: '+5 ta chipta', note_en: '+5 tickets' }),
  P(16, { kind: 'frame', value: 'f-legend', rarity: 'legendary', label_uz: 'Legendary animatsiyali ramka', label_en: 'Legendary animated frame' }),
  P(17, { kind: 'badge', value: 'b-s1-gold', rarity: 'legendary', label_uz: 'Season 01 Legendary belgisi', label_en: 'Season 01 Legendary badge' }),
  P(18, item('fx-stardust', 6000, 'legendary', 'Royal Wings effekti', 'Royal Wings effect', "O'yinda: Yulduz changi effekti", 'In game: Stardust effect')),
  P(19, { kind: 'title', value: 't-immortal', days: 30, rarity: 'legendary', label_uz: '"Immortal" unvoni', label_en: '"Immortal" title', note_uz: '30 kun', note_en: '30 days' }),
  P(20, { kind: 'frame', value: 'f-eternal', rarity: 'mythic', label_uz: 'ULTIMATE — Eternal Champion ramkasi', label_en: 'ULTIMATE — Eternal Champion frame' }),
];

/** picture of a cosmetic by id */
export const COSMETIC_ART: Record<string, string> = {
  'f-basic': 'pass/s1/free-07.svg',
  'f-royal': 'pass/s1/prem-04.svg',
  'f-premium': 'pass/s1/prem-13.svg',
  'f-legend': 'pass/s1/prem-16.svg',
  'f-eternal': 'pass/s1/prem-20.svg',
  'b-bronze': 'pass/s1/free-10.svg',
  'b-silver': 'pass/s1/free-16.svg',
  'b-s1': 'pass/s1/free-20.svg',
  'b-s1-gold': 'pass/s1/prem-17.svg',
  'bg-mountains': 'pass/s1/scene-mountains.svg',
  'bg-desert': 'pass/s1/scene-desert.svg',
  'bg-castle': 'pass/s1/scene-castle.svg',
};

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
