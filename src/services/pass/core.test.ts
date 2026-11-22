import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_PRICE,
  boostPct,
  DEFAULT_REWARDS,
  DEFAULT_RULES,
  LEVEL_XP,
  MAX_LEVEL,
  SEASON_DAYS,
  buildPass,
  checkPassClaim,
  dayStartUtc,
  levelOf,
  rewardCoins,
  seasonAt,
  seasonXp,
  tashkentDay,
  trackCoins,
  type PassGame,
  type SeasonActivity,
} from './core.ts';

const empty = (): SeasonActivity => ({ games: [], checkins: [], missions: {}, missionBonus: [], referrals: [] });
const T0 = dayStartUtc('2026-11-23') + 10 * 3600_000; // a Monday, 10:00 Tashkent
const game = (o: Partial<PassGame> = {}): PassGame => ({ ts: T0, live: true, outcome: 'win', moves: 30, vsBot: false, ...o });

describe('seasons', () => {
  test('14-day seasons from the anchor, Tashkent midnight', () => {
    const s1 = seasonAt(dayStartUtc('2026-11-16'));
    expect(s1.n).toBe(1);
    expect(tashkentDay(s1.start)).toBe('2026-11-16');
    expect(s1.end - s1.start).toBe(SEASON_DAYS * 86_400_000);
    const s2 = seasonAt(dayStartUtc('2026-11-30'));
    expect(s2.n).toBe(2);
    expect(seasonAt(dayStartUtc('2026-11-30') - 1).n).toBe(1);
    expect(s2.theme.name_uz).not.toBe(s1.theme.name_uz);
  });
});

describe('levels', () => {
  test('level 1 at 0 XP, 20 at the total, never above 20', () => {
    expect(levelOf(0).level).toBe(1);
    expect(LEVEL_XP[MAX_LEVEL]).toBe(5850);
    expect(levelOf(LEVEL_XP[2] - 1).level).toBe(1);
    expect(levelOf(LEVEL_XP[2]).level).toBe(2);
    expect(levelOf(99_999)).toEqual({ level: 20, into: 0, step: 0, nextAt: null });
    expect(levelOf(160)).toEqual({ level: 2, into: 10, step: 150, nextAt: 300 });
  });
});

describe('xp', () => {
  const season = seasonAt(T0);
  test('live win = game + win, loss = game only, short games ignored', () => {
    const a = empty();
    a.games = [game(), game({ outcome: 'loss', ts: T0 + 1 }), game({ moves: 5, ts: T0 + 2 })];
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0).total).toBe(15 + 25 + 15);
  });
  test('per-day caps for live games and bot wins', () => {
    const a = empty();
    a.games = Array.from({ length: 30 }, (_, i) => game({ ts: T0 + i, outcome: 'loss' }));
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0).total).toBe(20 * 15);
    a.games = Array.from({ length: 15 }, (_, i) => game({ ts: T0 + i, live: false, vsBot: true }));
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0).total).toBe(10 * 10);
  });
  test('daily cap and boosters (boost first, then cap)', () => {
    const a = empty();
    a.games = Array.from({ length: 20 }, (_, i) => game({ ts: T0 + i })); // 800
    a.checkins = [tashkentDay(T0)]; // 25
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0).total).toBe(825);
    const b20 = [{ pct: 20, from: T0, until: T0 + 86_400_000 }];
    const e = seasonXp(a, season, DEFAULT_RULES, false, T0, b20);
    expect(e.total).toBe(990);
    a.missions = { [tashkentDay(T0)]: 7 };
    const capped = seasonXp(a, season, DEFAULT_RULES, false, T0, b20);
    expect(capped.total).toBe(1000);
    expect(capped.capped).toBe(true);
  });
  test('a 5-hour booster counts only for what happens inside those 5 hours', () => {
    const a = empty();
    const H = 3_600_000;
    a.games = [game({ ts: T0 + H }), game({ ts: T0 + 6 * H })]; // 40 + 40
    a.checkins = [tashkentDay(T0)]; // 25, no time → no short boost
    const b30 = [{ pct: 30, from: T0, until: T0 + 5 * H }];
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0, b30).total).toBe(15 + 4 + 25 + 7 + 40 + 25);
  });
  test('referrals: at most 5 per season; other seasons ignored', () => {
    const a = empty();
    a.referrals = Array.from({ length: 8 }, (_, i) => T0 + i * 86_400_000);
    a.games = [game({ ts: season.end + 1000 })];
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0).total).toBe(5 * 150);
  });
  test('cap is per day, not per season', () => {
    const a = empty();
    a.games = [...Array.from({ length: 20 }, (_, i) => game({ ts: T0 + i })), ...Array.from({ length: 20 }, (_, i) => game({ ts: T0 + 86_400_000 + i }))];
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0).total).toBe(1600);
  });
});

describe('rewards and claims', () => {
  test('40 different rewards, each with its own picture', () => {
    expect(new Set(DEFAULT_REWARDS.map((r) => `${r.kind}:${r.value}`)).size).toBe(40);
  });
  test('every level has one free and one elite reward', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(DEFAULT_REWARDS.filter((r) => r.level === l && r.track === 'free').length).toBe(1);
      expect(DEFAULT_REWARDS.filter((r) => r.level === l && r.track === 'elite').length).toBe(1);
    }
  });
  test('coin budget per season stays modest (cosmetics are the value)', () => {
    expect(trackCoins(DEFAULT_REWARDS, 'free')).toBeLessThanOrEqual(1300); // 750 + chests
    expect(trackCoins(DEFAULT_REWARDS, 'elite')).toBe(2500); // 300 + 500 + 700 + 1000; the chests give cosmetics
  });
  test('box rolls stay inside the range', () => {
    const box = DEFAULT_REWARDS.find((r) => r.kind === 'box')!;
    expect(rewardCoins(box, false, 0)).toBe(box.min!);
    expect(rewardCoins(box, false, 0.9999999)).toBe(box.max!);
    for (let i = 0; i < 50; i++) {
      const v = rewardCoins(box, false, Math.random());
      expect(v >= box.min! && v <= box.max!).toBe(true);
    }
  });
  test('xp boosters: strongest one that touches the day, no stacking', () => {
    const a = empty();
    a.games = [game()];
    const season = seasonAt(T0);
    const boosts = [
      { pct: 10, from: T0 - 1000, until: T0 + 3 * 86_400_000 },
      { pct: 50, from: T0 - 1000, until: T0 + 1000 },
    ];
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0, boosts).total).toBe(60);
    expect(seasonXp(a, season, DEFAULT_RULES, false, T0, [boosts[0]]).total).toBe(44);
    expect(boostPct(boosts, tashkentDay(T0 + 5 * 86_400_000))).toBe(0);
  });
  test('claim rules: locked / elite / ready / already', () => {
    const a = empty();
    const b = buildPass(seasonAt(T0), a, DEFAULT_RULES, DEFAULT_REWARDS, [], false, DEFAULT_PRICE, T0);
    expect(b.level.level).toBe(1);
    expect(checkPassClaim(b, 1, 'free').ok).toBe(true);
    expect(checkPassClaim(b, 1, 'elite')).toEqual({ ok: false, error: 'elite' });
    expect(checkPassClaim(b, 2, 'free')).toEqual({ ok: false, error: 'locked' });
    expect(checkPassClaim(b, 99, 'free')).toEqual({ ok: false, error: 'unknown' });
    const b2 = buildPass(seasonAt(T0), a, DEFAULT_RULES, DEFAULT_REWARDS, ['free:1'], true, DEFAULT_PRICE, T0);
    expect(checkPassClaim(b2, 1, 'free')).toEqual({ ok: false, error: 'already' });
    expect(checkPassClaim(b2, 1, 'elite').ok).toBe(true);
    expect(b2.readyCount).toBe(1);
  });
  test('owned item turns into coins', () => {
    const item = DEFAULT_REWARDS.find((r) => r.kind === 'item')!;
    expect(rewardCoins(item, false)).toBe(0);
    expect(rewardCoins(item, true)).toBe(item.fallbackCoins);
  });
  test('an active player can reach level 20 in a season', () => {
    // 10 live games/day, 5 wins, check-in, 4 missions → 150+125+25+80 = 380/day × 14 = 5 320 → plus 1 friend
    const day = 15 * 10 + 25 * 5 + 25 + 20 * 4;
    expect(day * 14 + 150 * 4).toBeGreaterThanOrEqual(LEVEL_XP[MAX_LEVEL]);
  });
});
