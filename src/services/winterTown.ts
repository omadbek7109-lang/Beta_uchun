/**
 * DAMEO BETA — "Qishki shahar" (Winter Town): everybody builds one town together in December.
 * Every finished game adds snow ❄ to one shared counter (win +2, draw +1, loss +1); at each goal a new part of the
 * town opens (tree → houses → lights → ice rink → the big celebration) and EVERY player can take that stage's reward.
 *
 * Beta: there is no server, so the shared counter is simulated and, for testing, every stage is open (TOWN_PREVIEW);
 * the player's own share is counted from their real games on this device. In main DAMEO the counter is one number on
 * the server, bumped once per finished game (no extra reads per move).
 */
import type { MatchSummary, Player } from '../types/models.ts';
import { demoWalletApply } from './demoWallet.ts';

/** Beta: everything open so the whole town can be tried now. */
export const TOWN_PREVIEW = true;
/** 1 December 00:00 – 31 December 23:59, Tashkent (UTC+5) */
export const TOWN_START = Date.UTC(2026, 11, 1) - 5 * 3_600_000;
export const TOWN_END = Date.UTC(2027, 0, 1) - 5 * 3_600_000;

export interface TownStage {
  n: number;
  key: 'tree' | 'houses' | 'lights' | 'rink' | 'party';
  icon: string;
  goal: number;
  coins: number;
}
/** Goals sized for today's audience (~450 games a day ≈ 1 300 ❄ a day): the last one lands around New Year's Eve. */
export const TOWN_STAGES: TownStage[] = [
  { n: 1, key: 'tree', icon: '🎄', goal: 2_000, coins: 100 },
  { n: 2, key: 'houses', icon: '🏠', goal: 8_000, coins: 200 },
  { n: 3, key: 'lights', icon: '💡', goal: 16_000, coins: 300 },
  { n: 4, key: 'rink', icon: '⛸️', goal: 26_000, coins: 500 },
  { n: 5, key: 'party', icon: '🎆', goal: 40_000, coins: 1_000 },
];
export const SNOW_PER = { win: 2, draw: 1, loss: 1 } as const;

/** The player's own snow: their finished games in the season (beta preview: all of them). */
export function mySnow(matches: MatchSummary[], now = Date.now()): number {
  let s = 0;
  for (const m of matches) {
    if (!TOWN_PREVIEW && (m.ts < TOWN_START || m.ts >= TOWN_END || m.ts > now)) continue;
    s += SNOW_PER[m.result as keyof typeof SNOW_PER] ?? 0;
  }
  return s;
}

/** Simulated shared counter (beta): steady growth through the month; preview = past the last goal. */
export function communitySnow(mine: number, now = Date.now()): number {
  if (TOWN_PREVIEW) return 41_200 + mine;
  const days = Math.max(0, Math.min(31, (now - TOWN_START) / 86_400_000));
  return Math.round(days * 1_300) + mine;
}
export const participants = (total: number) => Math.max(1, Math.round(total / 58));

export const stageOpen = (st: TownStage, total: number) => total >= st.goal;
/** the stage being built now (the first one not reached), null when all are open */
export const currentStage = (total: number) => TOWN_STAGES.find((s) => total < s.goal) ?? null;
/** progress 0–1 along the road: icon i sits at i/(N-1) and is reached at its goal */
export function roadProgress(total: number): number {
  const N = TOWN_STAGES.length;
  for (let i = 0; i < N; i++) {
    const g = TOWN_STAGES[i].goal;
    if (total < g) return i === 0 ? 0 : (i - 1 + (total - TOWN_STAGES[i - 1].goal) / (g - TOWN_STAGES[i - 1].goal)) / (N - 1);
  }
  return 1;
}

/** Top contributors: the demo players with a steady share each, plus the player when they make it. */
export function topBuilders(players: Player[], me: { id: string; username: string; avatar?: string | null } | null, mine: number, n = 10) {
  const rows = players.map((p, i) => {
    let h = 0;
    for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return { id: p.id, name: p.username, avatar: (p.avatar ?? null) as string | null, snow: 180 + (h % 1300) + (i % 7) * 11, me: false };
  });
  if (me) rows.push({ id: me.id, name: me.username, avatar: me.avatar ?? null, snow: mine, me: true });
  rows.sort((a, b) => b.snow - a.snow);
  return { top: rows.slice(0, n), myPlace: me ? rows.findIndex((r) => r.me) + 1 : null };
}

/* ---------------------------------------------------------------- rewards (beta: this device) */
const KEY = 'dameobeta.town.v1';
export const TOWN_EVENT = 'dameobeta:town';
function claimed(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}
export const townClaimed = () => claimed();
/** Takes a stage's reward once: only when the stage is open. */
export function claimTownStage(n: number, total: number): { ok: true; coins: number } | { ok: false; error: 'locked' | 'claimed' } {
  const st = TOWN_STAGES.find((s) => s.n === n);
  if (!st || !stageOpen(st, total)) return { ok: false, error: 'locked' };
  const c = claimed();
  if (c.includes(n)) return { ok: false, error: 'claimed' };
  demoWalletApply(st.coins, 'town', 'town_stage', String(n), `Qishki shahar · ${n}-bosqich`, `town-${n}`);
  try {
    localStorage.setItem(KEY, JSON.stringify([...c, n]));
  } catch {
    /* private mode: the coins are given, the mark is lost */
  }
  window.dispatchEvent(new Event(TOWN_EVENT));
  return { ok: true, coins: st.coins };
}

/* ---------------------------------------------------------------- the town map
 * The town is one picture (public/town/map.webp, 1774×887) with sprites set on its plots. Coordinates are in map
 * pixels: x, y = the point where the sprite stands on the ground. Far plots are drawn smaller (townScale) and
 * nearer sprites are drawn over farther ones (sorted by y). */
export const MAP_W = 1774;
export const MAP_H = 887;
export type TownItemKey =
  | 'xmas' | 'hall' | 'clock' | 'house1' | 'house2' | 'house3' | 'lodge' | 'pine' | 'tree_lit' | 'tree_dec' | 'snowman'
  | 'bench' | 'lamp' | 'lantern' | 'lights_post' | 'banner' | 'sign' | 'market' | 'fence' | 'lights_rope' | 'iron_fence'
  | 'hedge_lit' | 'hedge_box' | 'rocks' | 'berry' | 'arch_lit' | 'arch_d' | 'rink' | 'fountain' | 'gazebo' | 'fire';
/** width on the map (px) at scale 1, and the stage that opens it for decorating */
export const TOWN_ITEMS: Record<TownItemKey, { w: number; stage: number }> = {
  xmas: { w: 120, stage: 1 }, pine: { w: 48, stage: 1 }, tree_dec: { w: 55, stage: 1 }, snowman: { w: 42, stage: 1 },
  rocks: { w: 55, stage: 1 }, berry: { w: 38, stage: 1 }, sign: { w: 30, stage: 1 },
  hall: { w: 210, stage: 2 }, clock: { w: 85, stage: 2 }, house1: { w: 125, stage: 2 }, house2: { w: 125, stage: 2 },
  house3: { w: 120, stage: 2 }, lodge: { w: 140, stage: 2 }, fence: { w: 75, stage: 2 }, hedge_box: { w: 52, stage: 2 },
  bench: { w: 55, stage: 2 },
  lamp: { w: 22, stage: 3 }, lantern: { w: 34, stage: 3 }, lights_post: { w: 80, stage: 3 }, lights_rope: { w: 80, stage: 3 },
  banner: { w: 50, stage: 3 }, tree_lit: { w: 55, stage: 3 }, hedge_lit: { w: 80, stage: 3 }, arch_lit: { w: 80, stage: 3 },
  iron_fence: { w: 95, stage: 3 },
  rink: { w: 200, stage: 4 }, fountain: { w: 95, stage: 4 }, gazebo: { w: 105, stage: 4 },
  market: { w: 105, stage: 5 }, fire: { w: 50, stage: 5 }, arch_d: { w: 85, stage: 5 },
};
/** what each stage builds for everybody: [item, x, y, size] */
export const TOWN_LAYOUT: Record<number, [TownItemKey, number, number, number][]> = {
  1: [['xmas', 910, 395, 1.5]],
  2: [
    ['hall', 845, 640, 0.95], ['clock', 905, 300, 1], ['house1', 650, 560, 1], ['house2', 470, 515, 1], ['lodge', 1205, 565, 1],
    ['house3', 1400, 505, 1], ['house2', 610, 350, 1], ['house3', 430, 325, 1], ['house1', 1230, 352, 1], ['house2', 1400, 328, 1],
  ],
  3: [
    ['arch_lit', 985, 470, 1], ['lamp', 935, 455, 1], ['lamp', 1040, 457, 1], ['lamp', 1080, 575, 1], ['lamp', 1150, 625, 1],
    ['banner', 1115, 530, 1], ['lights_rope', 700, 655, 1], ['lights_rope', 990, 655, 1], ['hedge_lit', 1060, 470, 1],
    ['hedge_lit', 760, 470, 1], ['lantern', 800, 420, 1], ['lantern', 1020, 420, 1],
  ],
  4: [['rink', 280, 430, 0.8], ['bench', 190, 450, 1], ['bench', 380, 455, 1], ['fountain', 1330, 425, 1], ['gazebo', 1560, 410, 1]],
  5: [
    ['market', 545, 605, 1], ['fire', 1580, 525, 1], ['snowman', 860, 470, 1], ['snowman', 1015, 612, 1], ['arch_d', 570, 445, 1],
    ['tree_dec', 1480, 600, 1],
  ],
};
/** the player's own plots: free places where they put what they like */
export const TOWN_SLOTS: [number, number][] = [
  [1310, 610], [720, 410], [1130, 410], [760, 305], [1060, 305], [320, 540], [1680, 520], [1300, 450], [500, 420], [170, 520], [1560, 330],
];
/** far plots are smaller: 0.59 at the back row → 1.4 at the front */
export const townScale = (y: number) => 1.4 * Math.max(0.42, Math.min(1.12, 0.42 + ((y - 250) / 350) * 0.58));

export interface Placed {
  id: string;
  item: TownItemKey;
  /** left / top / width in % of the map; the sprite hangs from its ground point */
  x: number;
  y: number;
  w: number;
  z: number;
  slot?: number;
}
export function place(id: string, item: TownItemKey, x: number, y: number, size = 1, slot?: number): Placed {
  return { id, item, x: (x / MAP_W) * 100, y: (y / MAP_H) * 100, w: ((TOWN_ITEMS[item].w * townScale(y) * size) / MAP_W) * 100, z: Math.round(y), slot };
}
/** everything standing in the town: the open stages' buildings plus the player's decorations, back to front */
export function townScene(total: number, deco: Record<number, TownItemKey>): Placed[] {
  const out: Placed[] = [];
  for (const st of TOWN_STAGES) {
    if (!stageOpen(st, total)) continue;
    TOWN_LAYOUT[st.n].forEach(([it, x, y, s], i) => out.push(place(`s${st.n}-${i}`, it, x, y, s)));
  }
  for (const [k, it] of Object.entries(deco)) {
    const i = Number(k);
    const sl = TOWN_SLOTS[i];
    if (sl && TOWN_ITEMS[it]) out.push(place(`d${i}`, it, sl[0], sl[1], 1, i));
  }
  return out.sort((a, b) => a.z - b.z);
}
/** items the player may put on a plot: those of the open stages */
export const decoItems = (total: number) =>
  (Object.keys(TOWN_ITEMS) as TownItemKey[]).filter((k) => k !== 'xmas' && k !== 'hall' && k !== 'rink').map((k) => ({
    key: k,
    open: stageOpen(TOWN_STAGES[TOWN_ITEMS[k].stage - 1], total),
    stage: TOWN_ITEMS[k].stage,
  }));

const DECO_KEY = 'dameobeta.town.deco.v1';
export function townDeco(): Record<number, TownItemKey> {
  try {
    const v = JSON.parse(localStorage.getItem(DECO_KEY) ?? '{}');
    const out: Record<number, TownItemKey> = {};
    for (const [k, it] of Object.entries(v ?? {})) if (TOWN_SLOTS[Number(k)] && typeof it === 'string' && it in TOWN_ITEMS) out[Number(k)] = it as TownItemKey;
    return out;
  } catch {
    return {};
  }
}
/** puts an item on a plot (null clears it) */
export function setTownDeco(slot: number, item: TownItemKey | null): Record<number, TownItemKey> {
  const d = townDeco();
  if (!TOWN_SLOTS[slot]) return d;
  if (item) d[slot] = item;
  else delete d[slot];
  try {
    localStorage.setItem(DECO_KEY, JSON.stringify(d));
  } catch {
    /* private mode: kept for this visit only */
  }
  return d;
}
