import { beforeEach, describe, expect, test } from 'bun:test';
import { ASSET } from './assets.ts';
import { N_SLOTS, SLOTS, covers } from './map.ts';
import { buy, canPlace, claimGift, claimTask, cityStats, friendCity, globalCity, levelOf, loadCity, move, occupancy, place, saveCity, store, suggested, tasksOf } from './store.ts';
import { demoBalance } from '../demoWallet.ts';

// bun has no DOM: a tiny localStorage + window for the beta wallet / storage helpers
const mem = new Map<string, string>();
const G = globalThis as any;
G.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
G.window ??= globalThis;
G.window.dispatchEvent ??= () => true;
G.Event ??= class {};
beforeEach(() => mem.clear());

describe('Qishki shahar — xarita', () => {
  test('qurilish joylari xarita ichida, orqadan oldinga tartiblangan, 16 bo\'limga bo\'lingan', () => {
    expect(N_SLOTS).toBeGreaterThan(300);
    const sectors = new Set<number>();
    SLOTS.forEach(([x, y, s], i) => {
      expect(x > 0 && x < 1672 && y > 0 && y < 941).toBe(true);
      if (i) expect(y).toBeGreaterThanOrEqual(SLOTS[i - 1][1]);
      sectors.add(s);
    });
    expect(sectors.size).toBe(16);
  });
  test('katta bino qo\'shni joylarni ham egallaydi, kichigi — faqat o\'zini', () => {
    expect(covers(ASSET.lamp, 100)).toEqual([100]);
    expect(covers(ASSET.house1, 100)).toEqual([100]);
    expect(covers(ASSET.rink, 100).length).toBeGreaterThan(1);
  });
});

describe('Qishki shahar — xarid, joylashtirish', () => {
  test('xarid inventarga tushadi, coin to\'g\'ri ayiriladi; bir so\'rov ikki marta = bitta xarid', () => {
    const before = demoBalance();
    const r = buy(loadCity(), 'house2', 'n1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.s.inv.house2).toBe(1);
    expect(demoBalance()).toBe(before - ASSET.house2.price);
    const again = buy(r.s, 'house2', 'n1');
    expect(again.ok && again.s.inv.house2).toBe(1);
    expect(demoBalance()).toBe(before - ASSET.house2.price);
  });
  test('pul yetmasa — xarid yo\'q', () => {
    expect(buy(loadCity(), 'hall', 'big', 50).ok).toBe(false);
  });
  test('bo\'sh joyga qo\'yadi, band joyga qo\'ymaydi, katta bino qo\'shnisini to\'smaydi', () => {
    let s = loadCity();
    const r = place(s, 'house1', 120, false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = { ...r.s, inv: { ...r.s.inv, house1: 1, rink: 1 } };
    const busy = place(s, 'house1', 120, false);
    expect(!busy.ok && busy.error).toBe('busy');
    const near = covers(ASSET.rink, 120).find((i) => i !== 120)!;
    expect(canPlace(ASSET.rink, near, occupancy(s.b)).ok).toBe(false);
    expect(canPlace(ASSET.house1, -1, occupancy([])).ok).toBe(false);
    expect(canPlace(ASSET.house1, N_SLOTS, occupancy([])).ok).toBe(false);
  });
  test('saqlanadi va qayta ochilganda tiklanadi; ko\'chirish, aylantirish, inventarga qaytarish', () => {
    const r = place(loadCity(), 'house1', 50, true);
    if (!r.ok) throw new Error('place');
    saveCity(r.s);
    const back = loadCity();
    expect(back.b.length).toBe(1);
    expect(back.b[0]).toMatchObject({ a: 'house1', slot: 50, f: 1 });
    const free = suggested(ASSET.house1, occupancy(back.b)).find((i) => i !== 50)!;
    const m = move(back, back.b[0].id, free, false);
    expect(m.ok).toBe(true);
    if (!m.ok) return;
    expect(m.s.b[0].slot).toBe(free);
    expect(m.s.b[0].f).toBeUndefined();
    const st = store(m.s, m.s.b[0].id);
    expect(st.b.length).toBe(0);
    expect(st.inv.house1).toBe(1);
  });
  test('saqlangan ma\'lumot buzilsa — noto\'g\'ri obyektlar tashlanadi', () => {
    mem.set('dameobeta.city.v2', JSON.stringify({ v: 1, b: [{ id: 'x', a: 'house1', slot: 5, t: 0 }, { id: 'y', a: 'house1', slot: 5, t: 0 }, { id: 'z', a: 'nope', slot: 9, t: 0 }, { id: 'w', a: 'pine', slot: 99999, t: 0 }], inv: { pine: -3, bogus: 4 } }));
    const s = loadCity();
    expect(s.b.map((b) => b.id)).toEqual(['x']);
    expect(s.inv).toEqual({});
  });
});

describe('Qishki shahar — progress, vazifalar, boshqa shaharlar', () => {
  test('daraja, statistika', () => {
    expect(levelOf(0)).toBe(1);
    expect(levelOf(100)).toBe(2);
    expect(levelOf(300)).toBe(3);
    const r = place(loadCity(), 'house1', 10, false);
    if (!r.ok) throw new Error();
    const st = cityStats(r.s);
    expect(st.houses).toBe(1);
    expect(st.area).toBe(1);
    expect(st.value).toBe(ASSET.house1.price);
    expect(st.today).toBe(1);
  });
  test('kunlik sovg\'a kuniga bir marta; vazifa faqat bajarilganda, yutqazgan o\'yin ham hisob', () => {
    const g = claimGift(loadCity());
    expect(g.ok).toBe(true);
    if (!g.ok) return;
    expect(claimGift(g.s).ok).toBe(false);
    const play = tasksOf(g.s, []).find((x) => x.id === 'd-play')!;
    expect(claimTask(g.s, play).ok).toBe(false);
    const play2 = tasksOf(g.s, [{ id: '1', ts: Date.now(), opponent: 'x', mode: 'bot', result: 'loss', delta: 0, rated: false, moves: 20 } as any]).find((x) => x.id === 'd-play')!;
    const c = claimTask(g.s, play2);
    expect(c.ok).toBe(true);
    if (c.ok) expect(claimTask(c.s, play2).ok).toBe(false);
  });
  test('do\'st shahri bir xil chiqadi va to\'qnashuvsiz; global shahar joylar soniga sig\'adi', () => {
    const a = friendCity('demo-4');
    expect(a).toEqual(friendCity('demo-4'));
    expect(a.length).toBeGreaterThan(5);
    const occ = new Int32Array(N_SLOTS);
    a.forEach((b, i) => {
      expect(canPlace(ASSET[b.a], b.slot, occ).ok).toBe(true);
      for (const j of covers(ASSET[b.a], b.slot)) occ[j] = i + 1;
    });
    const g = globalCity(1_800, ['a', 'b']);
    expect(g.length).toBe(N_SLOTS);
    expect(new Set(g.map((b) => b.slot)).size).toBe(N_SLOTS);
  });
});
