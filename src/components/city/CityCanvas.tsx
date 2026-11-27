/**
 * DAMEO BETA — Winter City renderer: one <canvas>, a camera (pan, pinch-zoom, double-tap, wheel), viewport culling
 * over chunked buckets, level-of-detail (far: silhouettes from tiny mip-maps, no decorations/lights; near: full
 * sprites, window and lamp glow) and short animation bursts (snow, twinkle, water, build drop) — the loop stops
 * when nothing moves, so an idle city costs nothing.
 */
import { useCallback, useEffect, useMemo, useRef, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react';
import { ASSET, type CityAsset } from '../../services/city/assets.ts';
import type { Building } from '../../services/city/store.ts';
import { COLS, ROWS, TH, TW, WORLD_H, WORLD_W, world, type Plot, type Prop } from '../../services/city/world.ts';

export interface Ghost {
  a: CityAsset;
  x: number;
  y: number;
  flip: boolean;
  ok: boolean;
}
export interface CityCanvasHandle {
  zoom(f: number): void;
  overview(): void;
  flyTo(tx: number, ty: number, z?: number): void;
  snapshot(): Promise<Blob | null>;
  centerTile(): [number, number];
}
interface Props {
  /** filled with the camera controls */
  api?: { current: CityCanvasHandle | null };
  buildings: Building[];
  ghost?: Ghost | null;
  /** free plots get faint outlines; `suggest` ones glow */
  showPlots?: boolean;
  suggest?: Plot[] | null;
  occupied?: Int32Array | null;
  selected?: string | null;
  /** id of a just-built object: plays the drop + snow puff */
  dropId?: string | null;
  festive?: boolean;
  fireworks?: boolean;
  start?: { x: number; y: number; z: number };
  onGhostMove?: (x: number, y: number) => void;
  onTapBuilding?: (b: Building | null, tile: [number, number]) => void;
  onZoom?: (z: number) => void;
}

/* ------------------------------------------------------------------ sprites + mip-maps (shared by every canvas) */
type Mips = { img: HTMLImageElement; mips: (HTMLCanvasElement | HTMLImageElement)[]; ready: boolean };
const SPR = new Map<string, Mips>();
const listeners = new Set<() => void>();
function sprite(name: string): Mips {
  let m = SPR.get(name);
  if (m) return m;
  const img = new Image();
  img.decoding = 'async';
  m = { img, mips: [], ready: false };
  SPR.set(name, m);
  const mm = m;
  img.onload = () => {
    const list: (HTMLCanvasElement | HTMLImageElement)[] = [img];
    let src: HTMLCanvasElement | HTMLImageElement = img;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    while (w > 24) {
      w = Math.round(w / 2);
      h = Math.max(1, Math.round(h / 2));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      c.getContext('2d')!.drawImage(src, 0, 0, w, h);
      list.unshift(c);
      src = c;
    }
    mm.mips = list;
    mm.ready = true;
    listeners.forEach((f) => f());
  };
  img.src = new URL(`town/${name}.webp`, document.baseURI).href;
  return m;
}
function pickMip(m: Mips, px: number) {
  for (const c of m.mips) if (c.width >= px * 0.85) return c;
  return m.mips[m.mips.length - 1];
}

/* ------------------------------------------------------------------ ground textures (generated once) */
let TEX: { woods: HTMLCanvasElement; snow: HTMLCanvasElement; stone: HTMLCanvasElement; street: HTMLCanvasElement; plaza: HTMLCanvasElement; ice: HTMLCanvasElement; glow: HTMLCanvasElement; warm: HTMLCanvasElement } | null = null;
function noiseCanvas(w: number, h: number, base: string, dots: [string, number, number][]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  let s = 7;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const [col, n, size] of dots) {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = r() * w;
      const y = r() * h;
      const rr = size * (0.4 + r());
      g.beginPath();
      g.ellipse(x, y, rr, rr * 0.66, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}
function textures() {
  if (TEX) return TEX;
  const snow = noiseCanvas(256, 168, '#aeb4ea', [['rgba(255,255,255,0.16)', 90, 14], ['rgba(120,120,210,0.12)', 70, 10], ['rgba(255,255,255,0.55)', 160, 1.1]]);
  const stone = noiseCanvas(128, 84, '#7b78c4', [['rgba(255,255,255,0.08)', 30, 6]]);
  {
    const g = stone.getContext('2d')!;
    g.strokeStyle = 'rgba(40,30,110,0.28)';
    g.lineWidth = 1.2;
    for (let y = 0; y <= 84; y += 21) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(128, y);
      g.stroke();
      for (let x = (y / 21) % 2 ? 0 : 16; x < 128; x += 32) {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 21);
        g.stroke();
      }
    }
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 40; i++) g.fillRect((i * 53) % 128, (i * 37) % 84, 3, 1.5);
  }
  const street = noiseCanvas(128, 84, '#9a9ad8', [['rgba(255,255,255,0.18)', 40, 8], ['rgba(70,60,150,0.12)', 30, 6]]);
  const plaza = noiseCanvas(96, 63, '#a9a8e6', [['rgba(255,255,255,0.22)', 40, 6], ['rgba(90,80,170,0.10)', 30, 4], ['rgba(255,255,255,0.6)', 50, 0.9]]);
  {
    const g = plaza.getContext('2d')!;
    g.strokeStyle = 'rgba(80,70,160,0.16)';
    g.lineWidth = 1;
    for (let y = 0; y < 63; y += 10.5)
      for (let x = (y / 10.5) % 2 ? 0 : 8; x < 96; x += 16) {
        g.beginPath();
        g.ellipse(x + 8, y + 5, 7, 4.5, 0, 0, Math.PI * 2);
        g.stroke();
      }
  }
  const ice = noiseCanvas(128, 84, '#5d86e6', [['rgba(255,255,255,0.25)', 25, 9]]);
  {
    const g = ice.getContext('2d')!;
    g.strokeStyle = 'rgba(230,245,255,0.6)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(10, 10);
    g.lineTo(60, 40);
    g.lineTo(120, 30);
    g.moveTo(60, 40);
    g.lineTo(40, 80);
    g.stroke();
  }
  const glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  {
    const g = glow.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,214,130,0.95)');
    gr.addColorStop(0.35, 'rgba(255,180,80,0.35)');
    gr.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  const warm = document.createElement('canvas');
  warm.width = warm.height = 64;
  {
    const g = warm.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,200,110,0.55)');
    gr.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  const woods = document.createElement('canvas');
  woods.width = 420;
  woods.height = 300;
  {
    const g = woods.getContext('2d')!;
    g.fillStyle = '#23205a';
    g.fillRect(0, 0, 420, 300);
    let k = 3;
    const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const x = r() * 420;
      const y = r() * 300;
      const h = 40 + r() * 40;
      g.fillStyle = r() < 0.5 ? '#2f3172' : '#373a80';
      g.beginPath();
      g.moveTo(x, y - h);
      g.lineTo(x + h * 0.38, y);
      g.lineTo(x - h * 0.38, y);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(230,235,255,0.5)';
      g.beginPath();
      g.moveTo(x, y - h);
      g.lineTo(x + h * 0.14, y - h * 0.62);
      g.lineTo(x - h * 0.14, y - h * 0.62);
      g.closePath();
      g.fill();
    }
  }
  TEX = { woods, snow, stone, street, plaza, ice, glow, warm };
  return TEX;
}

/* ------------------------------------------------------------------ drawable objects */
interface Obj {
  key: string;
  sprite: string;
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  flip: boolean;
  glow?: string;
  b?: Building;
  /** drawn size (world px), computed once */
  dw: number;
  dh: number;
  depth: number;
}
const CH = 16; // bucket = 16×16 tiles
const NBX = Math.ceil(COLS / CH);
const NBY = Math.ceil(ROWS / CH);
function bucketize(objs: Obj[]) {
  const b: Obj[][] = Array.from({ length: NBX * NBY }, () => []);
  for (const o of objs) {
    const bx = Math.max(0, Math.min(NBX - 1, Math.floor((o.x + o.w / 2) / CH)));
    const by = Math.max(0, Math.min(NBY - 1, Math.floor((o.y + o.h) / CH)));
    b[by * NBX + bx].push(o);
  }
  return b;
}
const ASPECT: Record<string, number> = {};
function mkObj(key: string, spriteName: string, x: number, y: number, w: number, h: number, scale: number, flip: boolean, glow?: string, b?: Building): Obj {
  const dw = w * TW * scale;
  return { key, sprite: spriteName, x, y, w, h, scale, flip, glow, b, dw, dh: dw * (ASPECT[spriteName] ?? 1), depth: y + h };
}
function propObj(p: Prop, i: number) {
  return mkObj(`p${i}`, p.sprite, p.x, p.y, p.w, Math.max(p.h, 0.01), p.scale, !!p.flip, p.glow);
}

export function CityCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const P = useRef(props);
  P.current = props;
  const W = world();
  const cam = useRef({ x: (props.start?.x ?? W.plaza.cx) * TW, y: (props.start?.y ?? W.plaza.cy) * TH, z: props.start?.z ?? 0.5 });
  const view = useRef({ w: 360, h: 500, dpr: 1 });
  const anim = useRef({ until: 0, raf: 0, vel: [0, 0] as [number, number], fly: null as null | { from: typeof cam.current; to: typeof cam.current; t0: number; dur: number }, drop: { id: '', t0: 0 }, fw: 0 });
  const drawn = useRef<{ o: Obj; x: number; y: number; w: number; h: number }[]>([]);
  const calm = () => document.documentElement.classList.contains('calm') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // static world props in buckets
  const propBuckets = useMemo(() => bucketize(W.props.map(propObj)), [W]);
  const buildObjs = useMemo(() => {
    const list: Obj[] = [];
    for (const b of props.buildings as Building[]) {
      const a = ASSET[b.a];
      if (!a || !a.sprite) continue;
      list.push(mkObj(b.id, a.sprite, b.x, b.y, a.w, a.h, a.scale * (b.s ?? 1), !!b.f, a.glow, b));
    }
    return { buckets: bucketize(list), roads: props.buildings.filter((b: Building) => ASSET[b.a]?.road) };
  }, [props.buildings]);
  const freePlots = useMemo(() => {
    if (!props.showPlots) return null;
    const occ = props.occupied;
    return W.plots.filter((p) => !occ || !occ[p.y * COLS + p.x]);
  }, [props.showPlots, props.occupied, W]);

  /* ---------------------------------------------------------------- camera */
  const limits = () => {
    const { w, h } = view.current;
    const min = Math.min(w / WORLD_W, h / WORLD_H) * 0.98;
    return { min, max: 2 };
  };
  const clamp = () => {
    const c = cam.current;
    const { w, h } = view.current;
    const { min, max } = limits();
    c.z = Math.max(min, Math.min(max, c.z));
    const hw = w / 2 / c.z;
    const hh = h / 2 / c.z;
    c.x = WORLD_W < hw * 2 ? WORLD_W / 2 : Math.max(hw, Math.min(WORLD_W - hw, c.x));
    c.y = WORLD_H < hh * 2 ? WORLD_H / 2 : Math.max(hh, Math.min(WORLD_H - hh, c.y));
  };
  const toWorld = (sx: number, sy: number): [number, number] => {
    const c = cam.current;
    const { w, h } = view.current;
    return [(sx - w / 2) / c.z + c.x, (sy - h / 2) / c.z + c.y];
  };
  const zoomAt = (f: number, sx: number, sy: number) => {
    const [wx, wy] = toWorld(sx, sy);
    const c = cam.current;
    const { min, max } = limits();
    const nz = Math.max(min, Math.min(max, c.z * f));
    const { w, h } = view.current;
    c.z = nz;
    c.x = wx - (sx - w / 2) / nz;
    c.y = wy - (sy - h / 2) / nz;
    clamp();
    P.current.onZoom?.(c.z);
  };

  /* ---------------------------------------------------------------- draw */
  const draw = useCallback((now: number) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const T = textures();
    const { w: vw, h: vh, dpr } = view.current;
    const c = cam.current;
    const z = c.z;
    const live = now < anim.current.until;
    const t = now / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#17123f';
    g.fillRect(0, 0, vw, vh);
    if (cam.current.z < 0.2) {
      // the woods around the city (only visible when zoomed far out)
      g.setTransform(dpr * cam.current.z, 0, 0, dpr * cam.current.z, dpr * (vw / 2 - cam.current.x * cam.current.z), dpr * (vh / 2 - cam.current.y * cam.current.z));
      g.fillStyle = g.createPattern(textures().woods, 'repeat')!;
      g.fillRect(-WORLD_W, -WORLD_H, WORLD_W * 3, WORLD_H * 3);
    }
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - c.x * z), dpr * (vh / 2 - c.y * z));
    // visible tile range
    const [wx0, wy0] = toWorld(0, 0);
    const [wx1, wy1] = toWorld(vw, vh);
    const tx0 = Math.max(0, Math.floor(wx0 / TW) - 1);
    const ty0 = Math.max(0, Math.floor(wy0 / TH) - 1);
    const tx1 = Math.min(COLS, Math.ceil(wx1 / TW) + 1);
    const ty1 = Math.min(ROWS, Math.ceil(wy1 / TH) + 6);
    const pat = (cvs: HTMLCanvasElement) => g.createPattern(cvs, 'repeat')!;

    const vis = (x: number, y: number, w: number, h: number) => x + w >= tx0 && y + h >= ty0 && x <= tx1 && y <= ty1;
    // ground
    g.fillStyle = z < 0.14 ? '#aab1e8' : pat(T.snow);
    g.fillRect(tx0 * TW, ty0 * TH, (tx1 - tx0) * TW, (ty1 - ty0) * TH);
    // parks: a soft blue-green tint
    g.fillStyle = 'rgba(70,110,150,0.16)';
    for (const d of W.districts) if (d.kind === 'park' && vis(d.x, d.y, d.w, d.h)) g.fillRect(d.x * TW, d.y * TH, d.w * TW, d.h * TH);
    g.fillStyle = 'rgba(30,24,90,0.22)'; // the forest frame
    g.fillRect(0, 0, WORLD_W, 3 * TH);
    g.fillRect(0, WORLD_H - 3 * TH, WORLD_W, 3 * TH);
    g.fillRect(0, 3 * TH, 3 * TW, WORLD_H - 6 * TH);
    g.fillRect(WORLD_W - 3 * TW, 3 * TH, 3 * TW, WORLD_H - 6 * TH);
    // roads
    const roadPat = pat(T.stone);
    const streetPat = pat(T.street);
    for (const r of W.roads) {
      if (!vis(r.x, r.y, r.w, r.h)) continue;
      g.fillStyle = r.kind === 'street' ? streetPat : roadPat;
      g.fillRect(r.x * TW, r.y * TH, r.w * TW, r.h * TH);
    }
    if (z > 0.12) {
      g.strokeStyle = 'rgba(236,238,255,0.85)';
      g.lineWidth = 5;
      for (const r of W.roads) {
        if (r.kind === 'street' || !vis(r.x, r.y, r.w, r.h)) continue;
        if (r.w > r.h) {
          g.beginPath();
          g.moveTo(r.x * TW, r.y * TH);
          g.lineTo((r.x + r.w) * TW, r.y * TH);
          g.moveTo(r.x * TW, (r.y + r.h) * TH);
          g.lineTo((r.x + r.w) * TW, (r.y + r.h) * TH);
          g.stroke();
        } else {
          g.beginPath();
          g.moveTo(r.x * TW, r.y * TH);
          g.lineTo(r.x * TW, (r.y + r.h) * TH);
          g.moveTo((r.x + r.w) * TW, r.y * TH);
          g.lineTo((r.x + r.w) * TW, (r.y + r.h) * TH);
          g.stroke();
        }
      }
      if (z > 0.3) {
        // the avenues' warm centre line
        g.strokeStyle = 'rgba(255,214,140,0.45)';
        g.lineWidth = 3;
        g.setLineDash([26, 22]);
        for (const r of W.roads) {
          if (r.kind !== 'avenue' || !vis(r.x, r.y, r.w, r.h)) continue;
          g.beginPath();
          if (r.w > r.h) {
            g.moveTo(r.x * TW, (r.y + r.h / 2) * TH);
            g.lineTo((r.x + r.w) * TW, (r.y + r.h / 2) * TH);
          } else {
            g.moveTo((r.x + r.w / 2) * TW, r.y * TH);
            g.lineTo((r.x + r.w / 2) * TW, (r.y + r.h) * TH);
          }
          g.stroke();
        }
        g.setLineDash([]);
      }
    }
    // central square
    const { cx, cy, r: pr } = W.plaza;
    g.save();
    g.beginPath();
    g.ellipse(cx * TW, cy * TH, pr * TW, pr * TH, 0, 0, Math.PI * 2);
    g.fillStyle = pat(T.plaza);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(240,240,255,0.9)';
    g.stroke();
    g.strokeStyle = 'rgba(255,214,140,0.5)';
    g.lineWidth = 4;
    for (const k of [0.72, 0.42]) {
      g.beginPath();
      g.ellipse(cx * TW, cy * TH, pr * TW * k, pr * TH * k, 0, 0, Math.PI * 2);
      g.stroke();
    }
    // snowflake emblem
    g.strokeStyle = 'rgba(235,245,255,0.75)';
    g.lineWidth = 6;
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.moveTo(cx * TW, cy * TH);
      g.lineTo(cx * TW + Math.cos(a) * pr * TW * 0.35, cy * TH + Math.sin(a) * pr * TH * 0.35);
    }
    g.stroke();
    g.restore();
    // river
    {
      const y0 = Math.max(0, ty0 - 2);
      const y1 = Math.min(ROWS, ty1 + 2);
      g.beginPath();
      for (let y = y0; y < y1; y++) g.lineTo(W.river[y][0] * TW, (y + 0.5) * TH);
      for (let y = y1 - 1; y >= y0; y--) g.lineTo(W.river[y][1] * TW, (y + 0.5) * TH);
      g.closePath();
      const gr = g.createLinearGradient(W.river[y0][0] * TW, 0, W.river[y0][1] * TW, 0);
      gr.addColorStop(0, '#1b2c86');
      gr.addColorStop(0.5, '#2d5fd1');
      gr.addColorStop(1, '#1b2c86');
      g.fillStyle = gr;
      g.fill();
      g.lineWidth = 9;
      g.strokeStyle = 'rgba(245,246,255,0.95)';
      g.stroke();
      if (z > 0.2) {
        // ice glints drifting downstream (move only during a burst)
        g.save();
        g.clip();
        g.strokeStyle = 'rgba(200,230,255,0.55)';
        g.lineWidth = 2.5;
        const off = live ? (t * 18) % (TH * 4) : 0;
        for (let y = y0; y < y1; y += 2) {
          const c0 = (W.river[y][0] + W.river[y][1]) / 2;
          const yy = y * TH + off;
          g.beginPath();
          g.moveTo((c0 - 0.6 + ((y * 7) % 5) * 0.15) * TW, yy);
          g.lineTo((c0 + 0.2 + ((y * 3) % 4) * 0.15) * TW, yy + 6);
          g.stroke();
        }
        g.restore();
      }
    }
    // player-laid roads
    for (const b of buildObjs.roads) {
      const a = ASSET[b.a];
      if (!vis(b.x, b.y, a.w, a.h)) continue;
      g.fillStyle = a.road === 'ice' ? pat(T.ice) : a.road === 'stone' ? roadPat : streetPat;
      if (a.road === 'round') {
        g.beginPath();
        g.ellipse((b.x + 1.5) * TW, (b.y + 1.5) * TH, 1.5 * TW, 1.5 * TH, 0, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = 'rgba(240,240,255,0.9)';
        g.lineWidth = 4;
        g.stroke();
        g.fillStyle = pat(T.snow);
        g.beginPath();
        g.ellipse((b.x + 1.5) * TW, (b.y + 1.5) * TH, 0.6 * TW, 0.6 * TH, 0, 0, Math.PI * 2);
        g.fill();
      } else g.fillRect(b.x * TW, b.y * TH, a.w * TW + 0.5, a.h * TH + 0.5);
    }
    // plots
    const p = P.current;
    if (freePlots && z > 0.16) {
      g.strokeStyle = `rgba(255,255,255,${z > 0.4 ? 0.45 : 0.3})`;
      g.lineWidth = 2 / Math.max(z, 0.35);
      g.setLineDash([10, 8]);
      for (const pl of freePlots) if (vis(pl.x, pl.y, pl.w, pl.h)) g.strokeRect(pl.x * TW + 4, pl.y * TH + 3, pl.w * TW - 8, pl.h * TH - 6);
      g.setLineDash([]);
    }
    if (p.suggest) {
      g.fillStyle = 'rgba(120,255,170,0.22)';
      g.strokeStyle = 'rgba(140,255,180,0.85)';
      g.lineWidth = 3 / Math.max(z, 0.4);
      for (const pl of p.suggest) {
        if (!vis(pl.x, pl.y, pl.w, pl.h)) continue;
        g.fillRect(pl.x * TW + 3, pl.y * TH + 2, pl.w * TW - 6, pl.h * TH - 4);
        g.strokeRect(pl.x * TW + 3, pl.y * TH + 2, pl.w * TW - 6, pl.h * TH - 4);
      }
    }
    // selection footprint
    const sel = p.selected ? p.buildings.find((b: Building) => b.id === p.selected) : null;
    if (sel) {
      const a = ASSET[sel.a];
      g.strokeStyle = '#ffd76a';
      g.lineWidth = 4 / Math.max(z, 0.4);
      g.strokeRect(sel.x * TW, sel.y * TH, a.w * TW, a.h * TH);
    }
    // ghost footprint
    const gh = p.ghost;
    if (gh) {
      g.fillStyle = gh.ok ? 'rgba(80,230,140,0.45)' : 'rgba(255,80,90,0.5)';
      g.strokeStyle = gh.ok ? '#7dffb0' : '#ff7b84';
      g.lineWidth = 3 / Math.max(z, 0.4);
      g.fillRect(gh.x * TW, gh.y * TH, gh.a.w * TW, gh.a.h * TH);
      g.strokeRect(gh.x * TW, gh.y * TH, gh.a.w * TW, gh.a.h * TH);
    }

    // objects, back to front
    const bx0 = Math.max(0, Math.floor(tx0 / CH) - 1);
    const bx1 = Math.min(NBX - 1, Math.floor(tx1 / CH) + 1);
    const by0 = Math.max(0, Math.floor(ty0 / CH));
    const by1 = Math.min(NBY - 1, Math.floor(ty1 / CH) + 1);
    const list: Obj[] = [];
    const far: Obj[] = [];
    const take = (b: Obj[][]) => {
      for (let by = by0; by <= by1; by++)
        for (let bx = bx0; bx <= bx1; bx++)
          for (const o of b[by * NBX + bx]) {
            const ox = (o.x + o.w / 2) * TW;
            const oy = (o.y + o.h) * TH;
            if (ox + o.dw / 2 < wx0 || ox - o.dw / 2 > wx1 || oy - o.dh > wy1 || oy < wy0) continue;
            if (o.dw * z < 3.5) {
              // too small for a sprite: a silhouette dot for trees, nothing for small decorations (LOD)
              if (o.sprite === 'pine' || o.sprite === 'tree_lit') far.push(o);
              continue;
            }
            list.push(o);
          }
    };
    take(propBuckets);
    take(buildObjs.buckets);
    let ghostObj: Obj | null = null;
    if (gh && gh.a.sprite) {
      ghostObj = mkObj('__ghost', gh.a.sprite, gh.x, gh.y, gh.a.w, gh.a.h, gh.a.scale, gh.flip);
      list.push(ghostObj);
    }
    if (far.length) {
      g.fillStyle = '#3d4d8c';
      g.beginPath();
      for (const o of far) {
        const ox = (o.x + 0.5) * TW;
        const oy = (o.y + 0.6) * TH;
        g.moveTo(ox + 26 * o.scale, oy);
        g.ellipse(ox, oy, 26 * o.scale, 30 * o.scale, 0, 0, Math.PI * 2);
      }
      g.fill();
    }
    list.sort((a, b) => a.depth - b.depth || a.x - b.x);
    const out: typeof drawn.current = [];
    const near = z > 0.42;
    const drop = anim.current.drop;
    for (const o of list) {
      const m = sprite(o.sprite);
      if (!m.ready) continue;
      if (!ASPECT[o.sprite]) {
        ASPECT[o.sprite] = m.img.naturalHeight / m.img.naturalWidth;
        o.dh = o.dw * ASPECT[o.sprite];
      }
      const ox = (o.x + o.w / 2) * TW;
      let oy = (o.y + o.h) * TH + 2;
      let alpha = 1;
      let sc = 1;
      if (o === ghostObj) alpha = 0.72;
      if (o.b && o.b.id === drop.id) {
        const k = Math.min(1, (now - drop.t0) / 520);
        const e = 1 - Math.pow(1 - k, 3);
        oy -= (1 - e) * 120;
        sc = k < 1 ? 0.85 + 0.15 * e : 1;
        alpha = 0.3 + 0.7 * e;
      }
      const dw = o.dw * sc;
      const dh = o.dh * sc;
      const img = pickMip(m, dw * z * view.current.dpr);
      g.globalAlpha = alpha;
      if (o.flip) {
        g.save();
        g.translate(ox, 0);
        g.scale(-1, 1);
        g.drawImage(img, -dw / 2, oy - dh, dw, dh);
        g.restore();
      } else g.drawImage(img, ox - dw / 2, oy - dh, dw, dh);
      g.globalAlpha = 1;
      if (o.b) out.push({ o, x: ox - dw / 2, y: oy - dh, w: dw, h: dh });
    }
    // evening light (near only): warm windows, lamps, twinkling trees
    if (near) {
      g.globalCompositeOperation = 'lighter';
      for (const o of list) {
        if (!o.glow) continue;
        const ox = (o.x + o.w / 2) * TW;
        const oy = (o.y + o.h) * TH;
        const flick = live ? 0.75 + 0.25 * Math.sin(t * 2.3 + o.x * 1.7 + o.y) : 0.9;
        if (o.glow === 'windows') {
          g.globalAlpha = 0.5 * flick;
          g.drawImage(T.warm, ox - o.dw * 0.42, oy - o.dh * 0.62, o.dw * 0.84, o.dh * 0.6);
        } else if (o.glow === 'lamp') {
          g.globalAlpha = 0.7 * flick;
          const s = 34 + o.dw * 0.25;
          g.drawImage(T.glow, ox - s / 2, oy - o.dh * 0.92 - s / 2, s, s);
        } else if (o.glow === 'tree') {
          g.globalAlpha = 0.45;
          for (let i = 0; i < 4; i++) {
            const k = live ? 0.5 + 0.5 * Math.sin(t * 3 + i * 1.9 + o.x) : 0.6;
            g.globalAlpha = 0.6 * k;
            const s = 12 + o.dw * 0.08;
            g.drawImage(T.glow, ox + (((i * 37) % 9) / 9 - 0.5) * o.dw * 0.5 - s / 2, oy - o.dh * (0.25 + ((i * 23) % 10) / 16) - s / 2, s, s);
          }
        } else if (o.glow === 'fire') {
          g.globalAlpha = live ? 0.6 + 0.3 * Math.sin(t * 9 + o.x) : 0.7;
          g.drawImage(T.glow, ox - o.dw * 0.7, oy - o.dh * 1.1, o.dw * 1.4, o.dh * 1.2);
        } else if (o.glow === 'ice') {
          g.globalAlpha = live ? 0.25 + 0.2 * Math.sin(t * 1.4 + o.x) : 0.3;
          g.drawImage(T.warm, ox - o.dw * 0.4, oy - o.dh * 0.6, o.dw * 0.8, o.dh * 0.5);
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    drawn.current = out;
    // snow puff on a fresh build
    if (drop.id && now - drop.t0 < 1300) {
      const b = p.buildings.find((x: Building) => x.id === drop.id);
      if (b) {
        const a = ASSET[b.a];
        const k = (now - drop.t0 - 450) / 850;
        if (k > 0) {
          const ox = (b.x + a.w / 2) * TW;
          const oy = (b.y + a.h) * TH;
          g.fillStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
          for (let i = 0; i < 18; i++) {
            const ang = (i / 18) * Math.PI * 2;
            const d = 20 + k * (60 + (i % 3) * 25) * a.w;
            g.beginPath();
            g.arc(ox + Math.cos(ang) * d, oy + Math.sin(ang) * d * 0.5 - k * 20, 5 * (1 - k) + 2, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
    }
    // fireworks over the square (global city, celebration stage)
    if (p.fireworks && now < anim.current.fw) {
      g.globalCompositeOperation = 'lighter';
      const cols = ['255,215,106', '196,181,253', '125,211,252', '252,165,165'];
      for (let k = 0; k < 4; k++) {
        const ph = ((now / 1000 + k * 0.55) % 2.2) / 2.2;
        const fx = (cx + Math.sin(k * 2.1) * 7) * TW;
        const fy = (cy - 14 - (k % 2) * 4) * TH;
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          const d = ph * 220;
          g.fillStyle = `rgba(${cols[k]},${1 - ph})`;
          g.beginPath();
          g.arc(fx + Math.cos(ang) * d, fy + Math.sin(ang) * d + ph * ph * 60, 6, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalCompositeOperation = 'source-over';
    }
    // district names when far away
    if (z < 0.34) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalAlpha = Math.min(1, (0.34 - z) / 0.1);
      g.font = '700 12px system-ui, sans-serif';
      g.textAlign = 'center';
      for (const d of W.districts) {
        const sx = ((d.x + d.w / 2) * TW - c.x) * z + vw / 2;
        const sy = ((d.y + d.h / 2) * TH - c.y) * z + vh / 2;
        if (sx < -60 || sx > vw + 60 || sy < -20 || sy > vh + 20) continue;
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(20,12,60,0.75)';
        g.strokeText(d.name, sx, sy);
        g.fillStyle = d.kind === 'premium' ? '#ffd76a' : '#fff';
        g.fillText(d.name, sx, sy);
      }
      g.globalAlpha = 1;
    }
    // falling snow (screen space, bursts only)
    if (live) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 46; i++) {
        const sp = 18 + (i % 5) * 7;
        const x = (((i * 97.3) % vw) + Math.sin(t * 0.7 + i) * 14 + vw) % vw;
        const y = ((i * 53.7 + t * sp) % (vh + 20)) - 10;
        g.beginPath();
        g.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, [W, propBuckets, buildObjs, freePlots]);

  /* ---------------------------------------------------------------- loop: runs only while something moves */
  const kick = useCallback((ms = 0) => {
    const A = anim.current;
    if (ms && !calm()) A.until = Math.max(A.until, performance.now() + ms);
    if (A.raf) return;
    const step = (now: number) => {
      A.raf = 0;
      const c = cam.current;
      let moving = false;
      if (A.fly) {
        const k = Math.min(1, (now - A.fly.t0) / A.fly.dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        c.x = A.fly.from.x + (A.fly.to.x - A.fly.from.x) * e;
        c.y = A.fly.from.y + (A.fly.to.y - A.fly.from.y) * e;
        c.z = A.fly.from.z * Math.pow(A.fly.to.z / A.fly.from.z, e);
        clamp();
        P.current.onZoom?.(c.z);
        if (k >= 1) A.fly = null;
        moving = true;
      } else if (Math.abs(A.vel[0]) + Math.abs(A.vel[1]) > 0.02) {
        c.x -= (A.vel[0] * 16) / c.z;
        c.y -= (A.vel[1] * 16) / c.z;
        A.vel = [A.vel[0] * 0.9, A.vel[1] * 0.9];
        clamp();
        moving = true;
      }
      draw(now);
      const busy = moving || now < A.until || now - A.drop.t0 < 1300 || (P.current.fireworks && now < A.fw);
      if (busy) A.raf = requestAnimationFrame(step);
    };
    A.raf = requestAnimationFrame(step);
  }, [draw]);

  // resize
  useEffect(() => {
    const cv = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      view.current = { w: r.width, h: r.height, dpr };
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      clamp();
      P.current.onZoom?.(cam.current.z);
      kick();
    });
    ro.observe(cv);
    const on = () => kick();
    listeners.add(on);
    return () => {
      ro.disconnect();
      listeners.delete(on);
      cancelAnimationFrame(anim.current.raf);
      anim.current.raf = 0;
    };
  }, [kick]);
  // redraw on data changes; a short living burst when the city opens
  useEffect(() => kick(), [kick, props.ghost, props.selected, props.suggest, props.showPlots]);
  useEffect(() => {
    kick(18_000);
  }, [kick]);
  useEffect(() => {
    if (props.dropId) {
      anim.current.drop = { id: props.dropId, t0: performance.now() };
      kick(4_000);
    }
  }, [props.dropId, kick]);
  useEffect(() => {
    if (props.fireworks && !calm()) {
      anim.current.fw = performance.now() + 4_500;
      kick();
    }
  }, [props.fireworks, kick]);
  useEffect(() => {
    if (props.start) {
      cam.current = { x: props.start.x * TW, y: props.start.y * TH, z: props.start.z };
      clamp();
      kick();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.start]);

  /* ---------------------------------------------------------------- gestures */
  const g = useRef({
    pts: new Map<number, { x: number; y: number }>(),
    mode: '' as '' | 'pan' | 'ghost' | 'pinch',
    sx: 0,
    sy: 0,
    t0: 0,
    moved: false,
    last: { x: 0, y: 0, t: 0 },
    pinch: { d: 0, mx: 0, my: 0 },
    grab: [0, 0] as [number, number],
    lastTap: { t: 0, x: 0, y: 0 },
  });
  const local = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const ghostHit = (x: number, y: number) => {
    const gh = P.current.ghost;
    if (!gh) return false;
    const [wx, wy] = toWorld(x, y);
    const a = gh.a;
    const dh = a.w * TW * a.scale * (ASPECT[a.sprite ?? ''] ?? 1);
    const pad = 24 / cam.current.z;
    return wx > gh.x * TW - pad && wx < (gh.x + a.w) * TW + pad && wy > (gh.y + a.h) * TH - dh - pad && wy < (gh.y + a.h) * TH + pad;
  };
  const onDown = (e: RPointerEvent) => {
    const S = g.current;
    const p = local(e);
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
    S.pts.set(e.pointerId, p);
    anim.current.vel = [0, 0];
    anim.current.fly = null;
    if (S.pts.size === 1) {
      S.mode = ghostHit(p.x, p.y) ? 'ghost' : 'pan';
      S.sx = p.x;
      S.sy = p.y;
      S.t0 = performance.now();
      S.moved = false;
      S.last = { ...p, t: S.t0 };
      if (S.mode === 'ghost') {
        const gh = P.current.ghost!;
        const [wx, wy] = toWorld(p.x, p.y);
        S.grab = [wx / TW - gh.x, wy / TH - gh.y];
      }
    } else if (S.pts.size === 2) {
      const [a, b] = [...S.pts.values()];
      S.mode = 'pinch';
      S.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      S.moved = true;
    }
  };
  const onMove = (e: RPointerEvent) => {
    const S = g.current;
    if (!S.pts.has(e.pointerId)) return;
    const p = local(e);
    const prev = S.pts.get(e.pointerId)!;
    S.pts.set(e.pointerId, p);
    if (Math.hypot(p.x - S.sx, p.y - S.sy) > 7) S.moved = true;
    const c = cam.current;
    if (S.mode === 'pinch' && S.pts.size >= 2) {
      const [a, b] = [...S.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      c.x -= (mx - S.pinch.mx) / c.z;
      c.y -= (my - S.pinch.my) / c.z;
      if (S.pinch.d > 0) zoomAt(d / S.pinch.d, mx, my);
      S.pinch = { d, mx, my };
      kick();
    } else if (S.mode === 'pan') {
      c.x -= (p.x - prev.x) / c.z;
      c.y -= (p.y - prev.y) / c.z;
      clamp();
      const now = performance.now();
      const dt = Math.max(8, now - S.last.t);
      anim.current.vel = [((p.x - S.last.x) / dt) * 1, ((p.y - S.last.y) / dt) * 1];
      S.last = { ...p, t: now };
      kick();
    } else if (S.mode === 'ghost') {
      const [wx, wy] = toWorld(p.x, p.y);
      const nx = Math.round(wx / TW - S.grab[0]);
      const ny = Math.round(wy / TH - S.grab[1]);
      const gh = P.current.ghost;
      if (gh && (nx !== gh.x || ny !== gh.y)) P.current.onGhostMove?.(nx, ny);
      // drag near the edge → the camera follows
      const { w, h } = view.current;
      const ex = p.x < 30 ? -1 : p.x > w - 30 ? 1 : 0;
      const ey = p.y < 30 ? -1 : p.y > h - 30 ? 1 : 0;
      if (ex || ey) {
        c.x += (ex * 12) / c.z;
        c.y += (ey * 12) / c.z;
        clamp();
        kick();
      }
    }
  };
  const onUp = (e: RPointerEvent) => {
    const S = g.current;
    const p = local(e);
    S.pts.delete(e.pointerId);
    if (S.mode === 'pinch') {
      if (S.pts.size === 1) {
        const [q] = [...S.pts.values()];
        S.mode = 'pan';
        S.last = { ...q, t: performance.now() };
      } else S.mode = '';
      return;
    }
    if (S.pts.size > 0) return;
    const wasPan = S.mode === 'pan';
    S.mode = '';
    if (!S.moved && performance.now() - S.t0 < 450) {
      anim.current.vel = [0, 0];
      const now = performance.now();
      const L = S.lastTap;
      if (now - L.t < 320 && Math.hypot(p.x - L.x, p.y - L.y) < 30) {
        // double tap: zoom in there
        const [wx, wy] = toWorld(p.x, p.y);
        const c = cam.current;
        anim.current.fly = { from: { ...c }, to: { x: wx, y: wy, z: Math.min(limits().max, c.z * 2.2) }, t0: now, dur: 380 };
        S.lastTap = { t: 0, x: 0, y: 0 };
        kick();
        return;
      }
      S.lastTap = { t: now, x: p.x, y: p.y };
      // tap: which building?
      let hit: Building | null = null;
      const [wx, wy] = toWorld(p.x, p.y);
      for (let i = drawn.current.length - 1; i >= 0; i--) {
        const d = drawn.current[i];
        if (wx >= d.x && wx <= d.x + d.w && wy >= d.y + d.h * 0.15 && wy <= d.y + d.h) {
          hit = d.o.b ?? null;
          break;
        }
      }
      if (!hit) {
        // roads (flat)
        const tx = Math.floor(wx / TW);
        const ty = Math.floor(wy / TH);
        hit = P.current.buildings.find((b) => ASSET[b.a]?.road && tx >= b.x && ty >= b.y && tx < b.x + ASSET[b.a].w && ty < b.y + ASSET[b.a].h) ?? null;
      }
      P.current.onTapBuilding?.(hit, [Math.floor(wx / TW), Math.floor(wy / TH)]);
    } else if (wasPan) kick(4_000);
  };
  const onWheel = (e: RWheelEvent) => {
    const p = local(e);
    zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    kick();
  };

  const handle: CityCanvasHandle = {
    zoom(f) {
      const { w, h } = view.current;
      const c = cam.current;
      const { min, max } = limits();
      anim.current.fly = { from: { ...c }, to: { x: c.x, y: c.y, z: Math.max(min, Math.min(max, c.z * f)) }, t0: performance.now(), dur: 260 };
      void w;
      void h;
      kick();
    },
    overview() {
      const c = cam.current;
      anim.current.fly = { from: { ...c }, to: { x: WORLD_W / 2, y: WORLD_H / 2, z: limits().min }, t0: performance.now(), dur: 520 };
      kick();
    },
    flyTo(tx, ty, z) {
      const c = cam.current;
      anim.current.fly = { from: { ...c }, to: { x: tx * TW, y: ty * TH, z: z ?? Math.max(c.z, 0.7) }, t0: performance.now(), dur: 520 };
      kick();
    },
    snapshot() {
      return new Promise((res) => {
        draw(performance.now());
        canvasRef.current?.toBlob((b) => res(b), 'image/jpeg', 0.9);
      });
    },
    centerTile() {
      return [Math.floor(cam.current.x / TW), Math.floor(cam.current.y / TH)];
    },
  };
  if (props.api) props.api.current = handle;

  return (
    <canvas
      ref={canvasRef}
      className="city-canvas"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onWheel={onWheel}
      onContextMenu={(e: RPointerEvent) => e.preventDefault()}
    />
  );
}
