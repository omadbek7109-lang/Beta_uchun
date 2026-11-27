import { beforeEach, describe, expect, test } from 'bun:test';
import {
  CALENDAR, botBeaten, bossState, calendarState, challenges, chooseTeam, claimAll12, claimBossMilestone, claimBot, claimChallenge, countdown,
  festDay, giftSquares, loadFest, myHits, openDay, recordFestGame, streakBonus, teamState, yearReview,
} from './festival.ts';
import { demoBalance } from './demoWallet.ts';

const mem = new Map<string, string>();
const G = globalThis as any;
G.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
G.window ??= globalThis;
G.window.dispatchEvent ??= () => true;
G.Event ??= class {};
beforeEach(() => mem.clear());

const NOW = Date.UTC(2026, 10, 30, 10); // beta day 3
const match = (ts: number, result: 'win' | 'loss' | 'draw' = 'loss') => ({ id: String(ts), ts, opponent: 'x', mode: 'bot', result, delta: 0, rated: false, moves: 40 }) as any;

describe('Qish festivali — kalendar', () => {
  test('bugungi quti faqat o\'yindan keyin ochiladi, ikki marta ochilmaydi, o\'tgan kunlar o\'tkazib yuborilgan', () => {
    expect(festDay(NOW)).toBe(3);
    const s = loadFest();
    let cal = calendarState(s, [], NOW);
    expect(cal.days[2].st).toBe('play');
    expect(cal.days[0].st).toBe('missed');
    expect(cal.days[3].st).toBe('locked');
    expect(openDay(s, [], 3, NOW).ok).toBe(false);
    const before = demoBalance();
    const r = openDay(s, [match(NOW - 60_000)], 3, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(demoBalance()).toBe(before + CALENDAR[2].coins);
    cal = calendarState(r.s, [match(NOW)], NOW);
    expect(cal.days[2].st).toBe('opened');
    expect(cal.streak).toBe(1);
    expect(openDay(r.s, [match(NOW)], 3, NOW).ok).toBe(false);
    expect(streakBonus(20)).toBe(1);
  });
});

describe('Qish festivali — Muz Dev, jamoalar, botlar, topshiriqlar', () => {
  test('har o\'yin zarba beradi (mag\'lubiyat ham), bosqichlar va mukofot', () => {
    recordFestGame({ ts: NOW, result: 'loss', moves: 40 });
    recordFestGame({ ts: NOW, result: 'win', moves: 20, kingWin: true, combo: 3, black: true });
    const s = loadFest();
    expect(myHits(s)).toBe(4);
    const b = bossState(s, NOW);
    expect(b.hp).toBeLessThan(100_000);
    expect(b.mine).toBe(4);
    expect(claimBossMilestone(s, 'boss-10').ok).toBe(false);
  });
  test('jamoa bir marta tanlanadi, o\'yin ochko qo\'shadi', () => {
    let s = chooseTeam(loadFest(), 'snow');
    expect(chooseTeam(s, 'santa').team).toBe('snow');
    const a = teamState(s, NOW);
    s = { ...s, games: [{ ts: NOW, result: 'win', moves: 30 }] };
    const b = teamState(s, NOW);
    expect(b.snow - a.snow).toBe(4);
    expect(b.santa).toBe(a.santa);
  });
  test('bayram boti yutilganda mukofot bir marta', () => {
    recordFestGame({ ts: NOW, result: 'win', moves: 50, bot: 'qorbobo' });
    const s = loadFest();
    expect(botBeaten(s, 'qorbobo')).toBe(true);
    expect(botBeaten(s, 'muzdev')).toBe(false);
    const r = claimBot(s, 'qorbobo');
    expect(r.ok).toBe(true);
    if (r.ok) expect(claimBot(r.s, 'qorbobo').ok).toBe(false);
    expect(claimBot(s, 'muzdev').ok).toBe(false);
  });
  test('12 topshiriq natijadan hisoblanadi; hammasi bajarilmaguncha katta sovg\'a yo\'q', () => {
    recordFestGame({ ts: NOW, result: 'win', moves: 24, kingWin: true, combo: 3, black: true, gifts: 2 });
    const s = loadFest();
    const list = challenges(s, { streak: 0 });
    expect(list.length).toBe(12);
    const byId = Object.fromEntries(list.map((c) => [c.id, c]));
    expect(byId['fast-win'].have).toBe(1);
    expect(byId['king-win'].have).toBe(1);
    expect(byId['combo3'].have).toBe(1);
    expect(byId['black-win'].have).toBe(1);
    expect(byId['gifts'].have).toBe(2);
    expect(claimChallenge(s, byId['gifts']).ok).toBe(false);
    expect(claimChallenge(s, byId['fast-win']).ok).toBe(true);
    expect(claimAll12(s, list).ok).toBe(false);
  });
});

describe('Qish festivali — sovg\'ali taxta, taymer, yil yakunlari', () => {
  test('4 ta sovg\'a o\'rtadagi bo\'sh qora kataklarda', () => {
    const g = giftSquares(12345);
    expect(g.length).toBe(4);
    expect(new Set(g).size).toBe(4);
    for (const sq of g) {
      const r = Math.floor(sq / 8);
      const c = sq % 8;
      expect(r === 3 || r === 4).toBe(true);
      expect((r + c) % 2).toBe(1);
    }
    expect(giftSquares(12345)).toEqual(g);
  });
  test('Yangi yilgacha qolgan vaqt', () => {
    const c = countdown(Date.UTC(2026, 11, 31, 18, 30)); // 23:30 Tashkent
    expect(c.d).toBe(0);
    expect(c.h).toBe(0);
    expect(c.m).toBe(30);
    expect(c.arena).toBe(true);
    expect(countdown(Date.UTC(2027, 0, 2)).done).toBe(true);
  });
  test('yil yakunlari', () => {
    const y = yearReview([match(1, 'win'), match(2, 'win'), match(3, 'loss'), match(4, 'win')], [], { rating: 1300, username: 'a' });
    expect(y.games).toBe(4);
    expect(y.wins).toBe(3);
    expect(y.best).toBe(2);
    expect(y.rival?.n).toBe(4);
  });
});
