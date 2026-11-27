/**
 * DAMEO BETA — the painted Winter City map ("Markaz", public/town/markaz.webp, 1672×941). Build spots were found on
 * the painted plots (tools/city_map/slots.py): every spot holds one object; big objects also cover the spots next
 * to them. Far plots are smaller on the picture, so everything there is drawn smaller (spotScale).
 */
import { ASSET, mapWidth, type CityAsset } from './assets.ts';
import { MAP_SLOTS, SECTOR_CENTERS } from './mapSlots.ts';

export const MAP_W = 1672;
export const MAP_H = 941;
export const MAP_SRC = 'markaz';
export const SLOTS = MAP_SLOTS;
export const N_SLOTS = SLOTS.length;
/** 0.55 at the far rows → 1 near the gate */
export const spotScale = (y: number) => 0.55 + 0.45 * Math.max(0, Math.min(1.15, (y - 140) / 660));
/** spacing used to place the spots (map px at scale 1) */
const SX = 31;
const SY = 17;
const dist = (i: number, j: number) => {
  const [x, y] = SLOTS[i];
  const [x2, y2] = SLOTS[j];
  const s = spotScale(y);
  return Math.hypot((x2 - x) / (SX * s), (y2 - y) / (SY * s));
};
/** spots an object standing on `slot` covers (itself + neighbours for big ones) */
const coverCache = new Map<string, number[]>();
export function covers(a: CityAsset, slot: number): number[] {
  const key = `${a.id}:${slot}`;
  let c = coverCache.get(key);
  if (c) return c;
  const k = mapWidth(a) / 45;
  c = [slot];
  if (k > 1.05) for (let j = 0; j < N_SLOTS; j++) if (j !== slot && dist(slot, j) < k) c.push(j);
  coverCache.set(key, c);
  return c;
}
export function nearestSlot(x: number, y: number, ok?: (i: number) => boolean): number {
  let best = -1;
  let bd = Infinity;
  for (let i = 0; i < N_SLOTS; i++) {
    if (ok && !ok(i)) continue;
    const [sx, sy] = SLOTS[i];
    const s = spotScale(sy);
    const d = ((sx - x) / s) ** 2 + ((sy - y) / s) ** 2 * 3;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
export const SECTOR_NAMES = [
  'Archazor', "Qorbog'", 'Oydin', 'Yulduzli', 'Shamchiroq', 'Kumushtepa', 'Tongotar', 'Nurli',
  'Shodlik', "Muzqal'a", 'Bayram', "Sovg'a", 'Qorbobo', 'Oqtosh', 'Yorqin', 'Chiroqli',
];
export const SECTORS = Object.entries(SECTOR_CENTERS)
  .map(([k, [x, y]]) => ({ id: Number(k), name: SECTOR_NAMES[Number(k)] ?? `${Number(k) + 1}`, x, y, slots: SLOTS.filter((s) => s[2] === Number(k)).length }))
  .sort((a, b) => a.id - b.id);
export const assetW = (id: string) => mapWidth(ASSET[id]);

/** small deterministic random (generated friends' cities, the global city) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

