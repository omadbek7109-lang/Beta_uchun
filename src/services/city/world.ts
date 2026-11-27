/**
 * DAMEO BETA — the Winter City map, generated the same on every device (no stored map): a 120×128 tile world with
 * a river, avenues, a central square, parks and 20+ districts holding up to 1 000 building plots (all empty at start).
 * Screen projection is a top-down oblique view: one tile = TW × TH px, objects stand on their footprint's front edge.
 */
export const COLS = 120;
export const ROWS = 128;
export const TW = 64;
export const TH = 42;
export const WORLD_W = COLS * TW;
export const WORLD_H = ROWS * TH;
export const MAX_PLOTS = 1000;

export const enum T {
  Land = 0,
  Road = 1,
  Street = 2,
  River = 3,
  Forest = 4,
  Park = 5,
  Plaza = 6,
  Bridge = 7,
}
export type PlotKind = 'house' | 'premium' | 'trade';
export interface Plot {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PlotKind;
  d: number;
}
export interface District {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'homes' | 'premium' | 'trade' | 'park';
  plots: number;
}
export interface RoadRect {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'avenue' | 'road' | 'street';
}
export interface Prop {
  sprite: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  flip?: boolean;
  glow?: 'lamp' | 'tree' | 'windows' | 'fire' | 'ice';
}
export interface World {
  tiles: Uint8Array;
  plots: Plot[];
  districts: District[];
  roads: RoadRect[];
  /** river banks per row: [left, right] in tile units (fractional) */
  river: [number, number][];
  props: Prop[];
  plaza: { cx: number; cy: number; r: number };
}

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

const NAMES = [
  'Archazor', "Qorbog'", 'Oydin', 'Yulduzli', 'Shamchiroq', 'Kumushtepa', 'Tongotar', 'Nurli', 'Shodlik', 'Muzqal\'a',
  'Bayram', "Sovg'a", 'Qorbobo', 'Oqtosh', 'Yorqin', 'Chiroqli', "Qishki bog'", 'Kamalak', 'Yangi yil', 'Oltin',
  'Shabboda', 'Ufq', 'Durdona', 'Lola',
];
export const riverCenter = (y: number) => 21 + 2.6 * Math.sin(y / 11) + 1.2 * Math.sin(y / 4.3);

let cached: World | null = null;
export function world(): World {
  if (cached) return cached;
  const tiles = new Uint8Array(COLS * ROWS);
  const at = (x: number, y: number) => y * COLS + x;
  const set = (x: number, y: number, w: number, h: number, t: T) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < COLS && j < ROWS) tiles[at(i, j)] = t;
  };
  const roads: RoadRect[] = [];
  const road = (x: number, y: number, w: number, h: number, kind: RoadRect['kind']) => {
    roads.push({ x, y, w, h, kind });
    set(x, y, w, h, kind === 'street' ? T.Street : T.Road);
  };
  // forest frame
  set(0, 0, COLS, 3, T.Forest);
  set(0, ROWS - 3, COLS, 3, T.Forest);
  set(0, 0, 3, ROWS, T.Forest);
  set(COLS - 3, 0, 3, ROWS, T.Forest);

  // main roads: horizontal (2 wide, avenue 3), vertical
  const H_ROADS: [number, number, RoadRect['kind']][] = [[24, 2, 'road'], [48, 2, 'road'], [64, 3, 'avenue'], [84, 2, 'road'], [106, 2, 'road']];
  const V_ROADS: [number, number, RoadRect['kind']][] = [[50, 2, 'road'], [71, 3, 'avenue'], [94, 2, 'road']];
  for (const [y, h, k] of H_ROADS) road(3, y, COLS - 6, h, k);
  for (const [x, w, k] of V_ROADS) road(x, 3, w, ROWS - 6, k);
  // the west bank: one street along the river and two cross streets
  road(6, 3, 2, ROWS - 6, 'road');

  // river (after the roads; crossings become bridges)
  const river: [number, number][] = [];
  for (let y = 0; y < ROWS; y++) {
    const c = riverCenter(y + 0.5);
    river.push([c - 1.7, c + 1.7]);
    for (let x = Math.floor(c - 2.4); x <= Math.ceil(c + 2.4); x++) {
      if (x < 0 || x >= COLS) continue;
      const d = Math.abs(x + 0.5 - c);
      const cur = tiles[at(x, y)];
      if (d < 1.9) tiles[at(x, y)] = cur === T.Road ? T.Bridge : T.River;
      else if (d < 2.6 && cur === T.Land) tiles[at(x, y)] = T.Park; // snowy banks
    }
  }

  // central square
  const plaza = { cx: 72.5, cy: 65.5, r: 10 };
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++) {
      const dx = x + 0.5 - plaza.cx;
      const dy = y + 0.5 - plaza.cy;
      if (dx * dx + dy * dy < plaza.r * plaza.r) tiles[at(x, y)] = T.Plaza;
    }

  // districts: the blocks between the main roads
  const ys = [[3, 24], [26, 48], [50, 64], [67, 84], [86, 106], [108, ROWS - 3]];
  const xs = [[28, 50], [52, 71], [74, 94], [96, COLS - 3]];
  const districts: District[] = [];
  const plots: Plot[] = [];
  const free = (x: number, y: number, w: number, h: number) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= COLS || j >= ROWS || tiles[at(i, j)] !== T.Land) return false;
    return true;
  };
  const r = rng(2026);
  const kindOf = (ix: number, iy: number): District['kind'] => {
    if ((ix === 1 || ix === 2) && (iy === 2 || iy === 3)) return 'trade';
    if ((ix === 0 && iy === 0) || (ix === 3 && iy === 5) || (ix === 0 && iy === 5) || (ix === 2 && iy === 4) || (ix === 3 && iy === 1)) return 'park';
    return 'homes';
  };
  let n = 0;
  const fill = (d: District, pw: number, ph: number, kind: PlotKind, seg: number) => {
    // rows: [plot][plot][street]; columns: `seg` plots then a 1-tile lane
    const x0 = d.x + 1;
    const y0 = d.y + 1;
    const x1 = d.x + d.w - 1;
    const y1 = d.y + d.h - 1;
    let y = y0;
    let row = 0;
    while (y + ph <= y1) {
      let x = x0;
      let c = 0;
      while (x + pw <= x1) {
        if (plots.length < MAX_PLOTS && free(x, y, pw, ph)) {
          plots.push({ id: plots.length, x, y, w: pw, h: ph, kind, d: d.id });
          d.plots++;
        }
        x += pw;
        if (++c % seg === 0 && x + pw < x1) {
          road(x, y, 1, ph, 'street');
          x += 1;
        }
      }
      y += ph;
      if (++row % 2 === 0 && y + ph < y1) {
        road(x0, y, x1 - x0, 1, 'street');
        y += 1;
      }
    }
  };
  // west bank: premium riverside villas between the street and the river
  const west: District = { id: 0, name: "Daryo bo'yi", x: 8, y: 3, w: 9, h: ROWS - 6, kind: 'premium', plots: 0 };
  districts.push(west);
  fill(west, 3, 3, 'premium', 99);
  for (let iy = 0; iy < ys.length; iy++)
    for (let ix = 0; ix < xs.length; ix++) {
      const [x0, x1] = xs[ix];
      const [y0, y1] = ys[iy];
      const kind = kindOf(ix, iy);
      const d: District = { id: districts.length, name: NAMES[n++ % NAMES.length], x: x0, y: y0, w: x1 - x0, h: y1 - y0, kind, plots: 0 };
      districts.push(d);
      if (kind === 'park') set(x0, y0, d.w, d.h, T.Park);
      else if (kind === 'trade') fill(d, 3, 2, 'trade', 4);
      else fill(d, 2, 2, 'house', 5);
    }
  // the river's own strip west of the street (x 3..5) is a park walk
  for (let y = 3; y < ROWS - 3; y++) for (let x = 3; x < 6; x++) if (tiles[at(x, y)] === T.Land) tiles[at(x, y)] = T.Park;

  // props: forest, park trees, lamps along roads, bridges
  const props: Prop[] = [];
  const pines = ['pine', 'pine', 'pine', 'tree_lit'];
  for (let y = 0; y < ROWS; y += 1)
    for (let x = 0; x < COLS; x += 1) {
      const t = tiles[at(x, y)];
      if (t === T.Forest && r() < 0.62) props.push({ sprite: 'pine', x: x + r() * 0.4 - 0.2, y: y + r() * 0.4 - 0.2, w: 1, h: 1, scale: 1.3 + r() * 0.6, flip: r() < 0.5 });
      else if (t === T.Park && r() < 0.09) props.push({ sprite: pines[Math.floor(r() * pines.length)], x, y, w: 1, h: 1, scale: 1.1 + r() * 0.5, flip: r() < 0.5, glow: undefined });
    }
  // district edges: fir trees in the corners and every few tiles, lamps by the streets (these tiles are not for building)
  for (const d of districts) {
    if (d.kind === 'park') continue;
    const ring: [number, number][] = [];
    for (let x = d.x; x < d.x + d.w; x++) ring.push([x, d.y], [x, d.y + d.h - 1]);
    for (let y = d.y + 1; y < d.y + d.h - 1; y++) ring.push([d.x, y], [d.x + d.w - 1, y]);
    ring.forEach(([x, y], i) => {
      if (tiles[at(x, y)] !== T.Land) return;
      const corner = (x === d.x || x === d.x + d.w - 1) && (y === d.y || y === d.y + d.h - 1);
      if (!corner && (i + d.id) % 4 !== 0) return;
      tiles[at(x, y)] = T.Park;
      props.push({ sprite: corner || r() < 0.75 ? pines[Math.floor(r() * 3)] : 'tree_lit', x, y, w: 1, h: 1, scale: 1 + r() * 0.35, flip: r() < 0.5 });
    });
  }
  for (const rd of roads) {
    if (rd.kind === 'street') continue;
    if (rd.w > rd.h) for (let x = rd.x + 3; x < rd.x + rd.w - 1; x += 7) props.push({ sprite: 'lamp', x, y: rd.y - 0.15, w: 1, h: 0, scale: 0.42, glow: 'lamp' });
    else for (let y = rd.y + 3; y < rd.y + rd.h - 1; y += 6) props.push({ sprite: 'lamp', x: rd.x - 0.75, y, w: 1, h: 1, scale: 0.42, glow: 'lamp' });
  }
  for (const [y, h] of H_ROADS) {
    const c = riverCenter(y + h / 2);
    props.push({ sprite: h >= 3 ? 'bridge_stone' : 'bridge_wood', x: c - 2.6, y: y + h - 1.05, w: 5.2, h: 1, scale: 1.05, glow: 'lamp' });
  }
  // keep lamps off the river / square
  cached = {
    tiles,
    plots,
    districts,
    roads,
    river,
    plaza,
    props: props.filter((p) => {
      const t = tiles[at(Math.max(0, Math.min(COLS - 1, Math.round(p.x))), Math.max(0, Math.min(ROWS - 1, Math.round(p.y))))];
      return p.sprite.startsWith('bridge') || (t !== T.River && t !== T.Plaza && t !== T.Bridge);
    }),
  };
  return cached;
}

export const tileAt = (x: number, y: number) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? T.Forest : world().tiles[y * COLS + x]);
