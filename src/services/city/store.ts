/**
 * DAMEO BETA — Winter City state and rules (on this device; main DAMEO keeps the same rules on the server).
 * My City: buildings (asset, tile x/y, flip), inventory, XP, daily gift + tasks, likes and visits.
 * Every rule a server must re-check lives here as a pure function: canPlace, buy, place, move, store.
 */
import type { MatchSummary, Player } from '../../types/models.ts';
import { demoWalletApply, demoBalance } from '../demoWallet.ts';
import { readJSON, writeJSON } from '../localStore.ts';
import { ASSET, CITY_ASSETS, type CityAsset, isHouse } from './assets.ts';
import { COLS, ROWS, T, rng, tileAt, world, type Plot } from './world.ts';

export interface Building {
  id: string;
  a: string;
  x: number;
  y: number;
  /** mirrored (the art has one view; "turn" flips it) */
  f?: 1;
  /** placed at (ms) */
  t: number;
  /** size multiplier — town props only */
  s?: number;
  /** owner name — other players' houses in the global city */
  o?: string;
}
export interface CityState {
  v: 1;
  b: Building[];
  inv: Record<string, number>;
  xp: number;
  seq: number;
  spent: number;
  bought: number;
  /** placements per day (Tashkent) */
  days: Record<string, number>;
  gift: string;
  tasks: { day: string; got: string[] };
  week: { wk: string; got: string[] };
  visits: { day: string; ids: string[] };
  likes: string[];
  likesWeek: { wk: string; n: number };
  name: string;
}
const KEY = 'dameobeta.city.v1';
export const CITY_EVENT = 'dameobeta:city';
/** the New Year event (beta: always on) */
export const EVENT_ON = true;

const fresh = (): CityState => ({
  v: 1, b: [], inv: { house1: 1, pine: 3, lamp: 2, snowman: 1 }, xp: 0, seq: 0, spent: 0, bought: 0, days: {}, gift: '',
  tasks: { day: '', got: [] }, week: { wk: '', got: [] }, visits: { day: '', ids: [] }, likes: [], likesWeek: { wk: '', n: 0 }, name: '',
});
export function loadCity(): CityState {
  const s = readJSON<CityState | null>(KEY, null);
  if (!s || s.v !== 1 || !Array.isArray(s.b)) return fresh();
  // drop anything the catalog or the map no longer allows (old saves, edited storage)
  const ok: Building[] = [];
  const occ = new Int32Array(COLS * ROWS);
  for (const b of s.b) {
    const a = ASSET[b.a];
    if (!a || !canPlace(a, b.x, b.y, occ).ok) continue;
    mark(occ, a, b.x, b.y, ok.length + 1);
    ok.push(b);
  }
  return { ...fresh(), ...s, b: ok };
}
export function saveCity(s: CityState) {
  writeJSON(KEY, s);
  window.dispatchEvent(new Event(CITY_EVENT));
}

/* ------------------------------------------------------------------ calendar (Tashkent) */
export const dayKey = (now = Date.now()) => new Date(now + 5 * 3_600_000).toISOString().slice(0, 10);
export function weekKey(now = Date.now()) {
  const d = new Date(now + 5 * 3_600_000);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ occupancy & placement */
export function mark(occ: Int32Array, a: CityAsset, x: number, y: number, v: number) {
  for (let j = y; j < y + a.h; j++) for (let i = x; i < x + a.w; i++) if (i >= 0 && j >= 0 && i < COLS && j < ROWS) occ[j * COLS + i] = v;
}
export function occupancy(bs: Building[]): Int32Array {
  const occ = new Int32Array(COLS * ROWS);
  bs.forEach((b, i) => {
    const a = ASSET[b.a];
    if (a) mark(occ, a, b.x, b.y, i + 1);
  });
  return occ;
}
const GROUND_TILE: Record<string, T> = { land: T.Land, park: T.Park, plaza: T.Plaza };
export type PlaceErr = 'bounds' | 'ground' | 'busy' | 'water';
/** Can `a` stand with its back-left tile at (x, y)? `ignore` = index+1 of the building being moved. */
export function canPlace(a: CityAsset, x: number, y: number, occ: Int32Array, ignore = 0): { ok: true } | { ok: false; error: PlaceErr } {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + a.w > COLS || y + a.h > ROWS) return { ok: false, error: 'bounds' };
  const river = a.ground.includes('river');
  let water = 0;
  for (let j = y; j < y + a.h; j++)
    for (let i = x; i < x + a.w; i++) {
      const o = occ[j * COLS + i];
      if (o && o !== ignore) return { ok: false, error: 'busy' };
      const t = tileAt(i, j);
      if (river) {
        if (t === T.River) water++;
        else if (t !== T.Park && t !== T.Land) return { ok: false, error: 'ground' };
      } else if (!a.ground.some((g) => GROUND_TILE[g] === t)) return { ok: false, error: t === T.River ? 'water' : 'ground' };
    }
  if (river && water < 2) return { ok: false, error: 'ground' };
  return { ok: true };
}
/** "Recommended" spots: free plots the object fits (houses: plot size; others: any free plot) */
export function suggested(a: CityAsset, occ: Int32Array): Plot[] {
  if (!a.ground.includes('land')) return [];
  return world().plots.filter((p) => {
    if (isHouse(a)) {
      if (p.kind === 'house' && (a.w !== 2 || a.h !== 2)) return false;
      if (p.kind === 'trade' && a.w * a.h > 6) return false;
    }
    if (a.w > p.w || a.h > p.h) return false;
    return canPlace(a, p.x, p.y, occ).ok;
  });
}

/* ------------------------------------------------------------------ actions */
export type CityErr = PlaceErr | 'funds' | 'none' | 'limited' | 'unknown';
export function buy(s: CityState, id: string, nonce: string, n = 1): { ok: true; s: CityState } | { ok: false; error: CityErr } {
  const a = ASSET[id];
  if (!a || n < 1 || n > 50) return { ok: false, error: 'unknown' };
  if (a.limited && !EVENT_ON) return { ok: false, error: 'limited' };
  const cost = a.price * n;
  try {
    // the same nonce twice (double tap, retry) charges once and adds once
    const before = demoBalance();
    const after = demoWalletApply(-cost, 'purchase', 'city_item', id, `Qishki shahar · ${id}${n > 1 ? ` ×${n}` : ''}`, `city-${nonce}`);
    if (after === before) return { ok: true, s };
  } catch {
    return { ok: false, error: 'funds' };
  }
  return { ok: true, s: { ...s, inv: { ...s.inv, [id]: (s.inv[id] ?? 0) + n }, spent: s.spent + cost, bought: s.bought + n } };
}
export function place(s: CityState, id: string, x: number, y: number, flip: boolean, now = Date.now()): { ok: true; s: CityState; b: Building } | { ok: false; error: CityErr } {
  const a = ASSET[id];
  if (!a) return { ok: false, error: 'unknown' };
  if ((s.inv[id] ?? 0) < 1) return { ok: false, error: 'none' };
  const c = canPlace(a, x, y, occupancy(s.b));
  if (!c.ok) return c;
  const b: Building = { id: `b${s.seq + 1}`, a: id, x, y, t: now, ...(flip ? { f: 1 as const } : {}) };
  const day = dayKey(now);
  return {
    ok: true,
    b,
    s: { ...s, b: [...s.b, b], seq: s.seq + 1, inv: { ...s.inv, [id]: s.inv[id] - 1 }, xp: s.xp + a.xp, days: { ...s.days, [day]: (s.days[day] ?? 0) + 1 } },
  };
}
export function move(s: CityState, bid: string, x: number, y: number, flip: boolean): { ok: true; s: CityState } | { ok: false; error: CityErr } {
  const i = s.b.findIndex((b) => b.id === bid);
  if (i < 0) return { ok: false, error: 'unknown' };
  const a = ASSET[s.b[i].a];
  const c = canPlace(a, x, y, occupancy(s.b), i + 1);
  if (!c.ok) return c;
  const b = { ...s.b[i], x, y };
  if (flip) b.f = 1;
  else delete b.f;
  return { ok: true, s: { ...s, b: s.b.map((o, k) => (k === i ? b : o)) } };
}
/** back to the inventory (XP stays: it was earned by building) */
export function store(s: CityState, bid: string): CityState {
  const b = s.b.find((o) => o.id === bid);
  if (!b) return s;
  return { ...s, b: s.b.filter((o) => o.id !== bid), inv: { ...s.inv, [b.a]: (s.inv[b.a] ?? 0) + 1 } };
}

/* ------------------------------------------------------------------ progress */
export const levelOf = (xp: number) => Math.floor((Math.sqrt(1 + (8 * xp) / 100) - 1) / 2) + 1;
export const levelXp = (lv: number) => (100 * (lv - 1) * lv) / 2;
export function cityStats(s: CityState, now = Date.now()) {
  let houses = 0;
  let area = 0;
  let value = 0;
  for (const b of s.b) {
    const a = ASSET[b.a];
    if (!a) continue;
    if (isHouse(a)) houses++;
    if (!a.road) area += a.w * a.h;
    value += a.price;
  }
  const lv = levelOf(s.xp);
  return { houses, objects: s.b.length, area, value, lv, xp: s.xp, from: levelXp(lv), to: levelXp(lv + 1), today: s.days[dayKey(now)] ?? 0, bought: s.bought };
}

/* ------------------------------------------------------------------ daily gift */
export const GIFTS: ({ coins: number } | { item: string; n: number })[] = [
  { coins: 60 }, { item: 'pine', n: 2 }, { item: 'snowman', n: 1 }, { item: 'lamp', n: 2 }, { coins: 90 }, { item: 'tree_lit', n: 1 }, { item: 'bench', n: 1 },
];
export const giftOf = (day: string) => GIFTS[Math.floor(Date.parse(day) / 86_400_000) % GIFTS.length];
export function claimGift(s: CityState, now = Date.now()): { ok: true; s: CityState; gift: (typeof GIFTS)[number] } | { ok: false } {
  const day = dayKey(now);
  if (s.gift === day) return { ok: false };
  const g = giftOf(day);
  if ('coins' in g) demoWalletApply(g.coins, 'reward', 'city_gift', day, 'Qishki shahar · kunlik sovg\'a', `city-gift-${day}`);
  const inv = 'item' in g ? { ...s.inv, [g.item]: (s.inv[g.item] ?? 0) + g.n } : s.inv;
  return { ok: true, gift: g, s: { ...s, gift: day, inv } };
}

/* ------------------------------------------------------------------ tasks: games (any result) and building, never punishing a loss */
export interface Task {
  id: string;
  goal: number;
  have: number;
  coins: number;
  xp: number;
  week?: boolean;
}
export function tasksOf(s: CityState, matches: MatchSummary[], now = Date.now()): Task[] {
  const day = dayKey(now);
  const wk = weekKey(now);
  const gamesToday = matches.filter((m) => dayKey(m.ts) === day).length;
  const gamesWeek = matches.filter((m) => weekKey(m.ts) === wk).length;
  let placedWeek = 0;
  for (const [d, n] of Object.entries(s.days)) if (weekKey(Date.parse(d) + 12 * 3_600_000) === wk) placedWeek += n;
  const visits = s.visits.day === day ? s.visits.ids.length : 0;
  const likes = s.likesWeek.wk === wk ? s.likesWeek.n : 0;
  return [
    { id: 'd-play', goal: 1, have: gamesToday, coins: 40, xp: 20 },
    { id: 'd-play3', goal: 3, have: gamesToday, coins: 80, xp: 40 },
    { id: 'd-build', goal: 2, have: s.days[day] ?? 0, coins: 30, xp: 20 },
    { id: 'd-visit', goal: 1, have: visits, coins: 25, xp: 10 },
    { id: 'w-play', goal: 15, have: gamesWeek, coins: 300, xp: 150, week: true },
    { id: 'w-build', goal: 20, have: placedWeek, coins: 250, xp: 150, week: true },
    { id: 'w-like', goal: 5, have: likes, coins: 120, xp: 60, week: true },
  ].map((t) => ({ ...t, have: Math.min(t.have, t.goal) }));
}
export const taskTaken = (s: CityState, t: Task, now = Date.now()) =>
  t.week ? s.week.wk === weekKey(now) && s.week.got.includes(t.id) : s.tasks.day === dayKey(now) && s.tasks.got.includes(t.id);
export function claimTask(s: CityState, t: Task, now = Date.now()): { ok: true; s: CityState } | { ok: false } {
  if (t.have < t.goal || taskTaken(s, t, now)) return { ok: false };
  const day = dayKey(now);
  const wk = weekKey(now);
  demoWalletApply(t.coins, 'reward', 'city_task', t.id, 'Qishki shahar · vazifa', `city-task-${t.week ? wk : day}-${t.id}`);
  if (t.week) {
    const got = s.week.wk === wk ? s.week.got : [];
    return { ok: true, s: { ...s, xp: s.xp + t.xp, week: { wk, got: [...got, t.id] } } };
  }
  const got = s.tasks.day === day ? s.tasks.got : [];
  return { ok: true, s: { ...s, xp: s.xp + t.xp, tasks: { day, got: [...got, t.id] } } };
}

/* ------------------------------------------------------------------ other players' cities (beta: generated) */
export function visit(s: CityState, cityId: string, now = Date.now()): CityState {
  const day = dayKey(now);
  const ids = s.visits.day === day ? s.visits.ids : [];
  return ids.includes(cityId) ? s : { ...s, visits: { day, ids: [...ids, cityId] } };
}
export function like(s: CityState, cityId: string, now = Date.now()): CityState {
  if (s.likes.includes(cityId)) return s;
  const wk = weekKey(now);
  return { ...s, likes: [...s.likes, cityId], likesWeek: { wk, n: (s.likesWeek.wk === wk ? s.likesWeek.n : 0) + 1 } };
}
const hash = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
};
const HOUSES = ['house1', 'house3', 'house2', 'lodge', 'house1', 'house2'];
const DECOR = ['pine', 'tree_lit', 'lamp', 'snowman', 'bench', 'tree_dec', 'lantern', 'hedge_box', 'fence', 'lights_rope'];
/** a friend's city: houses on plots of one or two districts with decorations around them */
export function friendCity(seed: string): Building[] {
  const r = rng(hash(seed));
  const W = world();
  const homes = W.districts.filter((d) => d.plots > 20 && d.kind !== 'premium');
  const ds = [homes[Math.floor(r() * homes.length)], homes[Math.floor(r() * homes.length)]];
  const out: Building[] = [];
  const occ = new Int32Array(COLS * ROWS);
  const nHouses = 12 + Math.floor(r() * 40);
  const plots = W.plots.filter((p) => ds.some((d) => d.id === p.d));
  for (const p of plots) {
    if (out.length >= nHouses || r() < 0.25) continue;
    const a = ASSET[p.kind === 'trade' ? (r() < 0.5 ? 'market' : 'lodge') : HOUSES[Math.floor(r() * HOUSES.length)]];
    if (!canPlace(a, p.x, p.y, occ).ok) continue;
    mark(occ, a, p.x, p.y, out.length + 1);
    out.push({ id: `f${out.length}`, a: a.id, x: p.x, y: p.y, t: 0, ...(r() < 0.5 ? { f: 1 as const } : {}) });
  }
  // decorations on the free tiles next to the houses
  const tries = out.length * 3;
  for (let i = 0; i < tries; i++) {
    const h = out[Math.floor(r() * out.length)];
    if (!h) break;
    const a = ASSET[DECOR[Math.floor(r() * DECOR.length)]];
    const x = h.x + Math.floor(r() * 5) - 2;
    const y = h.y + Math.floor(r() * 5) - 2;
    if (!canPlace(a, x, y, occ).ok) continue;
    mark(occ, a, x, y, out.length + 1);
    out.push({ id: `f${out.length}`, a: a.id, x, y, t: 0 });
  }
  return out;
}
export function cityScore(seed: string) {
  const r = rng(hash(seed + ':score'));
  return { likes: Math.floor(r() * 180), value: 4_000 + Math.floor(r() * 40_000) };
}
/** weekly prettiest cities: players' generated scores + mine (likes I received are 0 on this device) */
export function topCities(players: Player[], me: { id: string; username: string } | null, s: CityState) {
  const rows = players.slice(0, 40).map((p) => ({ id: p.id, name: p.username, ...cityScore(p.id), me: false }));
  if (me) rows.push({ id: me.id, name: me.username, likes: 0, value: cityStats(s).value, me: true });
  const pts = (r: { likes: number; value: number }) => r.likes * 100 + r.value / 10;
  rows.sort((a, b) => pts(b) - pts(a));
  return rows.map((r, i) => ({ ...r, place: i + 1, pts: Math.round(pts(r)) }));
}

/* ------------------------------------------------------------------ the global city: the square + everybody's houses */
export const GLOBAL_LAYOUT: Record<number, [string, number, number, number?][]> = {
  1: [['xmas', 71, 63, 1.9]],
  2: [['hall', 70, 56, 1.05], ['clock', 65, 58], ['clock', 78, 58]],
  3: [['lamp', 66, 61], ['lamp', 79, 61], ['lamp', 66, 69], ['lamp', 79, 69], ['arch_lit', 71, 74], ['lights_post', 67, 65], ['lights_post', 76, 65], ['tree_lit', 64, 66], ['tree_lit', 81, 66]],
  4: [['rink', 63, 70], ['fountain', 77, 70], ['gazebo', 80, 63], ['bench', 68, 71], ['bench', 76, 72]],
  5: [['market', 64, 59, 0.9], ['fire', 74, 61], ['snowman', 69, 68], ['snowman', 75, 68], ['arch_d', 71, 54], ['flake', 72, 72]],
};
/** the shared town: open stages' buildings on the square and one house per player (up to the 1 000 plots) */
export function globalCity(openStages: number[], players: number, names: string[]): Building[] {
  const out: Building[] = [];
  for (const n of openStages) for (const [a, x, y, sz] of GLOBAL_LAYOUT[n] ?? []) out.push({ id: `g${n}-${out.length}`, a, x, y, t: 0, ...(sz ? { s: sz } : {}) });
  const W = world();
  const r = rng(77);
  const order = W.plots.map((p) => p.id).sort(() => r() - 0.5);
  const count = Math.min(players, order.length);
  for (let i = 0; i < count; i++) {
    const p = W.plots[order[i]];
    const a = p.kind === 'premium' ? (r() < 0.4 ? 'hall' : 'lodge') : p.kind === 'trade' ? (r() < 0.6 ? 'market' : 'lodge') : HOUSES[Math.floor(r() * HOUSES.length)];
    out.push({ id: `p${i}`, a, x: p.x, y: p.y, t: 0, o: names[i % names.length] + (i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : ''), ...(r() < 0.5 ? { f: 1 as const } : {}) });
  }
  return out;
}
export const allAssets = CITY_ASSETS;
