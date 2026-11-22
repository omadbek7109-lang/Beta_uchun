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
  /** picture of the reward (one file per reward, public/pass/*.webp) */
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

type R = Omit<Reward, 'level' | 'track' | 'fallbackCoins' | 'art'> & { fallbackCoins?: number; art?: string };
const F = (level: number, r: R): Reward => ({ fallbackCoins: 0, art: `pass/free-${String(level).padStart(2, '0')}.webp`, ...r, level, track: 'free' });
const P = (level: number, r: R): Reward => ({ fallbackCoins: 0, art: `pass/prem-${String(level).padStart(2, '0')}.webp`, ...r, level, track: 'elite' });
const coinR = (n: number, rarity: Rarity = 'common'): R => ({ kind: 'coins', value: String(n), rarity, label_uz: `${n} Dameo Coin`, label_en: `${n} Dameo Coins` });
const item = (slug: string, fallback: number, rarity: Rarity, uz: string, en: string, nuz: string, nen: string): R => ({
  kind: 'item', value: slug, fallbackCoins: fallback, rarity, label_uz: uz, label_en: en, note_uz: nuz, note_en: nen,
});

/** Season 01 "Royal Legacy" — 20 free + 20 premium rewards (the server's pass_rewards table holds the same rows). */
export const DEFAULT_REWARDS: Reward[] = [
  F(1, coinR(50)),
  F(2, item('st-obsidian', 600, 'common', 'Klassik dona (Style)', 'Classic pieces (Style)', "O'yinda: Obsidian donalar", 'In game: Obsidian pieces')),
  F(3, { kind: 'xp_boost', value: '10', days: 3, rarity: 'common', label_uz: 'XP +10% (3 kun)', label_en: 'XP +10% (3 days)' }),
  F(4, { kind: 'frame', value: 'f-laurel', rarity: 'rare', label_uz: 'Profil avatar ramkasi', label_en: 'Profile avatar frame', art: 'pass/frame-free-laurel.webp' }),
  F(5, coinR(100)),
  F(6, { kind: 'emoji', value: 'e-crown,e-piece,e-win', rarity: 'rare', label_uz: 'Maxsus emoji (3 ta)', label_en: 'Special emoji (3)', note_uz: 'Ism yonida ko\'rinadi', note_en: 'Shown next to your name' }),
  F(7, { kind: 'background', value: 'bg-night', rarity: 'rare', label_uz: 'Profil foni (Tema)', label_en: 'Profile background' }),
  F(8, { kind: 'xp_boost', value: '20', days: 3, rarity: 'rare', label_uz: 'XP Booster (3 kun)', label_en: 'XP Booster (3 days)', note_uz: 'XP +20%', note_en: 'XP +20%' }),
  F(9, item('graphite', 250, 'common', 'Oddiy doska (Skin)', 'Board skin', "O'yinda: Graphite doska", 'In game: Graphite board')),
  F(10, { kind: 'box', value: 'box-bag', min: 50, max: 250, rarity: 'rare', label_uz: 'Mukofot qutisi (Tasodifiy)', label_en: 'Reward bag (Random)', note_uz: '50–250 coin', note_en: '50–250 coins' }),
  F(11, coinR(150)),
  F(12, item('fx-ripple', 1500, 'rare', 'Dona effekti (Oddiy)', 'Piece effect', "O'yinda: To'lqin effekti", 'In game: Ripple effect')),
  F(13, { kind: 'emoji', value: 'e-win', rarity: 'rare', label_uz: "G'alaba stikerlari (3 ta)", label_en: 'Victory stickers (3)', note_uz: 'WIN emojisi', note_en: 'WIN emoji' }),
  F(14, { kind: 'perk', value: 'mission_slot', amount: 1, days: 3, rarity: 'rare', label_uz: 'Topshiriq sloti +1 (3 kun)', label_en: 'Mission slot +1 (3 days)' }),
  F(15, { kind: 'frame', value: 'f-violet2', rarity: 'rare', label_uz: 'Profil ramkasi (Oddiy)', label_en: 'Profile frame' }),
  F(16, coinR(200)),
  F(17, { kind: 'title', value: 't-active', days: 7, rarity: 'epic', label_uz: '"Faol o\'yinchi" unvoni (7 kun)', label_en: '"Active player" title (7 days)' }),
  F(18, item('royal-wood', 600, 'epic', 'Maxsus doska (Rangli)', 'Special board', "O'yinda: Royal Wood doska", 'In game: Royal Wood board')),
  F(19, { kind: 'box', value: 'box-chest', min: 150, max: 500, rarity: 'epic', label_uz: 'Kichik sandiq (Kolleksiya)', label_en: 'Small chest', note_uz: '150–500 coin', note_en: '150–500 coins' }),
  F(20, { kind: 'badge', value: 'b-s1', rarity: 'epic', label_uz: 'Season 01 ishtirokchisi', label_en: 'Season 01 participant' }),

  P(1, coinR(250, 'rare')),
  P(2, item('st-royal-gold', 250, 'epic', 'Premium dona (Oltin)', 'Premium pieces (Gold)', "O'yinda: Royal Gold donalar", 'In game: Royal Gold pieces')),
  P(3, { kind: 'xp_boost', value: '50', days: 7, rarity: 'epic', label_uz: 'XP +50% (7 kun)', label_en: 'XP +50% (7 days)' }),
  P(4, { kind: 'frame', value: 'f-gold', rarity: 'epic', label_uz: 'Premium ramka (S1)', label_en: 'Premium frame (S1)' }),
  P(5, { kind: 'currency', value: 'crystal', amount: 100, rarity: 'epic', label_uz: '100 Kreativ kristall', label_en: '100 Creative crystals' }),
  P(6, item('fx-lightning', 4000, 'epic', 'Yurish effekti (Neon)', 'Move effect (Neon)', "O'yinda: Chaqmoq effekti", 'In game: Lightning effect')),
  P(7, item('emerald-board', 900, 'epic', 'Premium doska (Animatsiyali)', 'Premium board (Animated)', "O'yinda: Emerald doska", 'In game: Emerald board')),
  P(8, { kind: 'emoji', value: 'e-gold-crown,e-diamond,e-fire,e-crown,e-win', rarity: 'legendary', label_uz: 'Maxsus emoji (5 ta)', label_en: 'Special emoji (5)', note_uz: 'Ism yonida ko\'rinadi', note_en: 'Shown next to your name' }),
  P(9, { kind: 'title', value: 't-elite', days: 30, rarity: 'epic', label_uz: '"Dameo Elite" unvoni (30 kun)', label_en: '"Dameo Elite" title (30 days)' }),
  P(10, { kind: 'box', value: 'box-epic', min: 400, max: 1000, rarity: 'legendary', label_uz: "Kolleksiya sandig'i (Epik)", label_en: 'Collection chest (Epic)', note_uz: '400–1000 coin', note_en: '400–1000 coins' }),
  P(11, coinR(500, 'epic')),
  P(12, item('midnight-blue', 300, 'epic', 'Mavsumiy doska (S1 Exclusive)', 'Season board (S1 Exclusive)', "O'yinda: Midnight Blue doska", 'In game: Midnight Blue board')),
  P(13, { kind: 'frame', value: 'f-royal', rarity: 'epic', label_uz: 'Premium avatar ramkasi', label_en: 'Premium avatar frame' }),
  P(14, item('fx-fire', 4000, 'legendary', 'Dona effekti (Fire)', 'Piece effect (Fire)', "O'yinda: Olov izi effekti", 'In game: Fire trail effect')),
  P(15, { kind: 'currency', value: 'ticket', amount: 5, rarity: 'epic', label_uz: "O'yin chiptasi (+5 ta)", label_en: 'Game tickets (+5)' }),
  P(16, { kind: 'frame', value: 'f-wings', rarity: 'legendary', label_uz: 'Oltin qanotli ramka (Epik)', label_en: 'Golden wings frame (Epic)', art: 'pass/frame-prem-wings.webp' }),
  P(17, { kind: 'badge', value: 'b-s1-gold', rarity: 'legendary', label_uz: 'Season 01 Belgi (Profil)', label_en: 'Season 01 badge (Profile)' }),
  P(18, item('fx-stardust', 6000, 'legendary', 'Yurish effekti (Wings)', 'Move effect (Wings)', "O'yinda: Yulduz changi effekti", 'In game: Stardust effect')),
  P(19, { kind: 'title', value: 't-champion', days: 30, rarity: 'legendary', label_uz: '"Champion da\'vogar" unvoni (30 kun)', label_en: '"Title contender" title (30 days)' }),
  P(20, { kind: 'frame', value: 'f-royal-wings', rarity: 'mythic', label_uz: 'Season 01 Premium ramkasi (Legendary)', label_en: 'Season 01 Premium frame (Legendary)', art: 'pass/frame-prem-royal.webp' }),
];

/**
 * Where the empty hole of each frame picture is (fractions of the square picture), measured from the artwork.
 * The avatar is fitted exactly into this hole, so every frame looks the same size around it.
 */
export const FRAME_FIT: Record<string, { x: number; y: number; w: number; h: number }> = {
  'f-laurel': { x: 0.1406, y: 0.1938, w: 0.7219, h: 0.6219 },
  'f-violet2': { x: 0.1367, y: 0.2148, w: 0.7227, h: 0.6328 },
  'f-gold': { x: 0.1523, y: 0.3477, w: 0.6953, h: 0.4805 },
  'f-royal': { x: 0.1523, y: 0.332, w: 0.6875, h: 0.5273 },
  'f-wings': { x: 0.2437, y: 0.2, w: 0.5219, h: 0.5687 },
  'f-royal-wings': { x: 0.175, y: 0.2062, w: 0.5687, h: 0.5094 },
};

/** picture of a cosmetic by id (frames / badges / backgrounds reuse the reward artwork) */
export const COSMETIC_ART: Record<string, string> = {
  'f-laurel': 'pass/frame-free-laurel.webp',
  'f-violet2': 'pass/free-15.webp',
  'f-gold': 'pass/prem-04.webp',
  'f-royal': 'pass/prem-13.webp',
  'f-wings': 'pass/frame-prem-wings.webp',
  'f-royal-wings': 'pass/frame-prem-royal.webp',
  'b-s1': 'pass/free-20.webp',
  'b-s1-gold': 'pass/prem-17.webp',
  'bg-night': 'pass/free-07.webp',
  't-active': 'pass/free-17.webp',
  't-elite': 'pass/prem-09.webp',
  't-champion': 'pass/prem-19.webp',
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
