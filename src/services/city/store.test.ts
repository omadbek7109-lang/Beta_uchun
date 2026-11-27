import { beforeEach, describe, expect, test } from 'bun:test';
import { ASSET } from './assets.ts';
import { buy, canPlace, claimGift, claimTask, cityStats, friendCity, globalCity, levelOf, loadCity, move, occupancy, place, saveCity, store, suggested, tasksOf } from './store.ts';
import { COLS, MAX_PLOTS, T, tileAt, world } from './world.ts';
import { demoBalance } from '../demoWallet.ts';

// bun has no DOM: a tiny localStorage + window for the beta wallet / storage helpers
const mem = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
(globalThis as any).window ??= globalThis;
(globalThis as any).window.dispatchEvent ??= () => true;
(globalThis as any).Event ??= class {};

const land = () => world().plots.find((p) => p.kind === 'house')!;
beforeEach(() => mem.clear());

describe('Qishki shahar — xarita', () => {
  test('1000 ta bo\'sh qurilish joyi, hammasi quruqlikda va bir-birini to\'smaydi', () => {
    const W = world();
    expect(W.plots.length).toBe(MAX_PLOTS);
    const seen = new Set<number>();
    for (const p of W.plots)
      for (let y = p.y; y < p.y + p.h; y++)
        for (let x = p.x; x < p.x + p.w; x++) {
          expect(tileAt(x, y)).toBe(T.Land);
          expect(seen.has(y * COLS + x)).toBe(false);
          seen.add(y * COLS + x);
        }
    expect(W.districts.length).toBeGreaterThan(20);
  });
});

describe('Qishki shahar — xarid, joylashtirish', () => {
  test('xarid inventarga tushadi, coin to\'g\'ri ayiriladi; bir so\'rov ikki marta = bitta xarid', () => {
    const before = demoBalance();
    const s0 = loadCity();
    const r = buy(s0, 'house2', 'n1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.s.inv.house2).toBe(1);
    expect(demoBalance()).toBe(before - ASSET.house2.price);
    const again = buy(r.s, 'house2', 'n1');
    expect(again.ok && again.s.inv.house2).toBe(1);
    expect(demoBalance()).toBe(before - ASSET.house2.price);
  });
  test('pul yetmasa — xarid yo\'q', () => {
    const s = loadCity();
    const r = buy(s, 'hall', 'big', 50);
    expect(r.ok).toBe(false);
  });
  test('bo\'sh joyga qo\'yadi, band joyga, yo\'lga va daryoga qo\'ymaydi', () => {
    const p = land();
    let s = loadCity();
    const r = place(s, 'house1', p.x, p.y, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.s;
    expect(s.inv.house1 ?? 0).toBe(0);
    const s2 = { ...s, inv: { ...s.inv, house1: 1 } };
    const busy = place(s2, 'house1', p.x + 1, p.y, false);
    expect(busy.ok).toBe(false);
    expect(!busy.ok && busy.error).toBe('busy');
    const road = world().roads.find((x) => x.kind === 'avenue')!;
    expect(canPlace(ASSET.house1, road.x + 5, road.y, occupancy([])).ok).toBe(false);
    const ry = 40;
    const rx = Math.round((world().river[ry][0] + world().river[ry][1]) / 2) - 1;
    expect(canPlace(ASSET.house1, rx, ry, occupancy([])).ok).toBe(false);
  });
  test('saqlanadi va qayta ochilganda tiklanadi; ko\'chirish, aylantirish, inventarga qaytarish', () => {
    const p = land();
    const r = place(loadCity(), 'house1', p.x, p.y, true);
    if (!r.ok) throw new Error('place');
    saveCity(r.s);
    const back = loadCity();
    expect(back.b.length).toBe(1);
    expect(back.b[0]).toMatchObject({ a: 'house1', x: p.x, y: p.y, f: 1 });
    const free = suggested(ASSET.house1, occupancy(back.b))[0];
    const m = move(back, back.b[0].id, free.x, free.y, false);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.s.b[0].f).toBeUndefined();
    const st = store(m.s, m.s.b[0].id);
    expect(st.b.length).toBe(0);
    expect(st.inv.house1).toBe(1);
  });
  test('saqlangan ma\'lumot buzilsa — noto\'g\'ri obyektlar tashlanadi', () => {
    mem.set('dameobeta.city.v1', JSON.stringify({ v: 1, b: [{ id: 'x', a: 'house1', x: 0, y: 0, t: 0 }, { id: 'y', a: 'nope', x: 40, y: 40, t: 0 }], inv: {} }));
    expect(loadCity().b.length).toBe(0);
  });
  test('ko\'prik faqat daryo ustiga', () => {
    const y = 40;
    const c = Math.round((world().river[y][0] + world().river[y][1]) / 2);
    expect(canPlace(ASSET.bridge_wood, c - 2, y, occupancy([])).ok).toBe(true);
    const p = land();
    expect(canPlace(ASSET.bridge_wood, p.x, p.y, occupancy([])).ok).toBe(false);
  });
});

describe('Qishki shahar — progress, vazifalar, boshqa shaharlar', () => {
  test('daraja, statistika', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(100)).toBe(2);
    expect(levelOf(300)).toBe(3);
    const p = land();
    const r = place(loadCity(), 'house1', p.x, p.y, false);
    if (!r.ok) throw new Error();
    const st = cityStats(r.s);
    expect(st.houses).toBe(1);
    expect(st.area).toBe(4);
    expect(st.value).toBe(ASSET.house1.price);
    expect(st.today).toBe(1);
  });
  test('kunlik sovg\'a kuniga bir marta; vazifa faqat bajarilganda', () => {
    const s = loadCity();
    const g = claimGift(s);
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(claimGift(g.s).ok).toBe(false);
    const t = tasksOf(g.s, []);
    const play = t.find((x) => x.id === 'd-play')!;
    expect(claimTask(g.s, play).ok).toBe(false);
    const t2 = tasksOf(g.s, [{ id: '1', ts: Date.now(), opponent: 'x', mode: 'bot', result: 'loss', delta: 0, rated: false, moves: 20 }]);
    const play2 = t2.find((x) => x.id === 'd-play')!;
    const c = claimTask(g.s, play2);
    expect(c.ok).toBe(true);
    if (c.ok) expect(claimTask(c.s, play2).ok).toBe(false);
  });
  test('do\'st shahri bir xil chiqadi va to\'qnashuvsiz; global shahar 1000 joyga sig\'adi', () => {
    const a = friendCity('demo-4');
    expect(a).toEqual(friendCity('demo-4'));
    expect(a.length).toBeGreaterThan(5);
    const occ = new Int32Array(COLS * 128);
    a.forEach((b, i) => {
      expect(canPlace(ASSET[b.a], b.x, b.y, occ).ok).toBe(true);
      for (let y = b.y; y < b.y + ASSET[b.a].h; y++) for (let x = b.x; x < b.x + ASSET[b.a].w; x++) occ[y * COLS + x] = i + 1;
    });
    const g = globalCity([1, 2, 3, 4, 5], 1_800, ['a', 'b']);
    expect(g.filter((b) => b.o).length).toBe(MAX_PLOTS);
  });
});
