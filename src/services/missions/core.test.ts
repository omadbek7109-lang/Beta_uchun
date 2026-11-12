import { describe, expect, test } from 'bun:test';
import {
  BONUS_SLUG,
  DEFAULT_DEFS,
  DEFAULT_SETTINGS,
  bestWinStreak,
  buildBoard,
  checkClaim,
  maxDaily,
  measure,
  nextResetTs,
  tashkentDay,
  validateConfig,
  type DayActivity,
  type FinishedGame,
} from './core.ts';

const g = (o: Partial<FinishedGame>): FinishedGame => ({ ts: 0, rated: true, outcome: 'win', moves: 30, vsBot: false, botLevel: null, ...o });
const empty: DayActivity = { games: [], referrals: 0, puzzles: 0 };
const day = '2026-11-12';

describe('daily missions', () => {
  test('exactly 7 launch missions worth 300 per day', () => {
    expect(DEFAULT_DEFS.length).toBe(7);
    expect(new Set(DEFAULT_DEFS.map((d) => d.kind)).size).toBe(7);
    expect(maxDaily(DEFAULT_DEFS, DEFAULT_SETTINGS)).toBe(300);
    expect(validateConfig(DEFAULT_DEFS, DEFAULT_SETTINGS)).toBeNull();
  });

  test('Tashkent day boundary is 00:00 UTC+5', () => {
    expect(tashkentDay(Date.parse('2026-11-11T18:59:59Z'))).toBe('2026-11-11');
    expect(tashkentDay(Date.parse('2026-11-11T19:00:00Z'))).toBe('2026-11-12');
    expect(nextResetTs(Date.parse('2026-11-12T05:00:00Z'))).toBe(Date.parse('2026-11-12T19:00:00Z'));
  });

  test('streak resets on loss or draw and follows finish order', () => {
    const games = [g({ ts: 1 }), g({ ts: 2 }), g({ ts: 3, outcome: 'draw' }), g({ ts: 4 }), g({ ts: 6 }), g({ ts: 5 })];
    expect(bestWinStreak(games)).toBe(3);
  });

  test('short games and practice bots do not count', () => {
    const a: DayActivity = {
      ...empty,
      games: [
        g({ moves: 8 }), // too short
        g({ vsBot: true, rated: false, botLevel: 'medium' }),
        g({ vsBot: true, rated: false, botLevel: 'easy' }),
        g({ vsBot: true, rated: false, botLevel: 'medium', outcome: 'loss' }),
      ],
    };
    const s = DEFAULT_SETTINGS;
    expect(measure('match_complete', a, s)).toBe(3);
    expect(measure('rated_complete', a, s)).toBe(0);
    expect(measure('bot_win_medium', a, s)).toBe(1);
  });

  test('claims: done → ok once, never twice, bonus only after all', () => {
    const a: DayActivity = { games: [g({}), g({})], referrals: 0, puzzles: 0 };
    let claims: Record<string, number> = {};
    let b = buildBoard(DEFAULT_DEFS, DEFAULT_SETTINGS, a, claims, day);
    expect(checkClaim(b, 'rated_win_2')).toEqual({ ok: true, amount: 30 });
    expect(checkClaim(b, 'invite_1')).toEqual({ ok: false, error: 'not_done' });
    expect(checkClaim(b, 'nope')).toEqual({ ok: false, error: 'unknown' });
    expect(checkClaim(b, BONUS_SLUG)).toEqual({ ok: false, error: 'not_done' });
    claims = { rated_win_2: 30 };
    b = buildBoard(DEFAULT_DEFS, DEFAULT_SETTINGS, a, claims, day);
    expect(checkClaim(b, 'rated_win_2')).toEqual({ ok: false, error: 'already' });
    expect(b.earned).toBe(30);
  });

  test('full day pays exactly 300 and the cap holds', () => {
    const games = [
      ...[1, 2, 3, 4, 5].map((ts) => g({ ts })),
      g({ ts: 6, vsBot: true, rated: false, botLevel: 'medium' }),
    ];
    const a: DayActivity = { games, referrals: 1, puzzles: 10 };
    const claims: Record<string, number> = {};
    for (const d of DEFAULT_DEFS) {
      const r = checkClaim(buildBoard(DEFAULT_DEFS, DEFAULT_SETTINGS, a, claims, day), d.slug);
      expect(r.ok).toBe(true);
      if (r.ok) claims[d.slug] = r.amount;
    }
    const bonus = checkClaim(buildBoard(DEFAULT_DEFS, DEFAULT_SETTINGS, a, claims, day), BONUS_SLUG);
    expect(bonus).toEqual({ ok: true, amount: 60 });
    if (bonus.ok) claims[BONUS_SLUG] = bonus.amount;
    expect(Object.values(claims).reduce((s, v) => s + v, 0)).toBe(300);
    // a lower cap trims the last payout instead of exceeding it
    const noBonus = { ...claims };
    delete noBonus[BONUS_SLUG];
    const tight = buildBoard(DEFAULT_DEFS, { ...DEFAULT_SETTINGS, dailyCap: 250 }, a, noBonus, day);
    expect(checkClaim(tight, BONUS_SLUG)).toEqual({ ok: true, amount: 10 });
  });

  test('admin validation rejects configs above the daily cap', () => {
    const defs = DEFAULT_DEFS.map((d) => (d.slug === 'invite_1' ? { ...d, reward: 61 } : d));
    expect(validateConfig(defs, DEFAULT_SETTINGS)).toBe('over_cap');
    expect(validateConfig(DEFAULT_DEFS.map((d) => ({ ...d, target: 0 })), DEFAULT_SETTINGS)).toBe('bad_target');
    expect(validateConfig(DEFAULT_DEFS, { ...DEFAULT_SETTINGS, dailyCap: 250 })).toBe('over_cap');
    // turning a mission off frees its coins
    expect(validateConfig(DEFAULT_DEFS.map((d) => (d.slug === 'invite_1' ? { ...d, active: false } : d)), { ...DEFAULT_SETTINGS, dailyCap: 250 })).toBeNull();
  });
});
