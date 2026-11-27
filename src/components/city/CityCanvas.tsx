/**
 * DAMEO BETA — Winter City renderer on the painted map: one <canvas>, a camera (pan, pinch-zoom, double-tap,
 * wheel), viewport culling, level-of-detail (far: small mip-maps, no tiny decorations or lights; near: full sprites
 * with window / lamp glow) and short animation bursts (snow, twinkle, build drop) — the loop stops when nothing
 * moves, so an idle city costs nothing.
 */
import { useCallback, useEffect, useMemo, useRef, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from 'react';
import { ASSET, mapWidth, type CityAsset } from '../../services/city/assets.ts';
import { MAP_H, MAP_SRC, MAP_W, N_SLOTS, SLOTS, nearestSlot, spotScale } from '../../services/city/map.ts';
import type { Building } from '../../services/city/store.ts';

export interface Ghost {
  a: CityAsset;
  slot: number;
  flip: boolean;
  ok: boolean;
}
export interface CityCanvasHandle {
  zoom(f: number): void;
  overview(): void;
  flyTo(x: number, y: number, z?: number): void;
  snapshot(): Promise<Blob | null>;
  /** the build spot nearest to the middle of the screen */
  centerSlot(ok?: (i: number) => boolean): number;
}
interface Props {
  /** filled with the camera controls */
  api?: { current: CityCanvasHandle | null };
  buildings: Building[];
  ghost?: Ghost | null;
  /** free build spots glow (build mode / placing) */
  spots?: number[] | null;
  selected?: string | null;
  /** id of a just-built object: plays the drop + snow puff */
  dropId?: string | null;
  festive?: boolean;
  fireworks?: boolean;
  start?: { x: number; y: number; z: number };
  onGhostMove?: (slot: number) => void;
  onTapBuilding?: (b: Building | null, slot: number) => void;
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

/* ------------------------------------------------------------------ glow textures (generated once) */
let TEX: { glow: HTMLCanvasElement; warm: HTMLCanvasElement; spot: HTMLCanvasElement } | null = null;
function radial(stops: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}
function textures() {
  if (TEX) return TEX;
  TEX = {
    glow: radial([[0, 'rgba(255,214,130,0.95)'], [0.35, 'rgba(255,180,80,0.35)'], [1, 'rgba(255,160,60,0)']]),
    warm: radial([[0, 'rgba(255,200,110,0.55)'], [1, 'rgba(255,170,80,0)']]),
    spot: radial([[0, 'rgba(150,255,190,0.95)'], [0.45, 'rgba(110,240,170,0.45)'], [1, 'rgba(110,240,170,0)']]),
  };
  return TEX;
}
let MAPIMG: HTMLImageElement | null = null;
function mapImage(onload: () => void) {
  if (!MAPIMG) {
    MAPIMG = new Image();
    MAPIMG.decoding = 'async';
    MAPIMG.src = new URL(`town/${MAP_SRC}.webp`, document.baseURI).href;
  }
  if (!MAPIMG.complete) MAPIMG.addEventListener('load', onload, { once: true });
  return MAPIMG;
}

/* ------------------------------------------------------------------ drawable objects */
interface Obj {
  sprite: string;
  x: number;
  y: number;
  dw: number;
  flip: boolean;
  glow?: string;
  b?: Building;
  ghost?: boolean;
}
const ASPECT: Record<string, number> = {};
function objOf(b: Building): Obj | null {
  const a = ASSET[b.a];
  const sl = SLOTS[b.slot];
  if (!a?.sprite || !sl) return null;
  return { sprite: a.sprite, x: sl[0], y: sl[1], dw: mapWidth(a) * spotScale(sl[1]) * (b.s ?? 1), flip: !!b.f, glow: a.glow, b };
}

export function CityCanvas(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const P = useRef(props);
  P.current = props;
  const cam = useRef({ x: props.start?.x ?? MAP_W / 2, y: props.start?.y ?? MAP_H / 2, z: props.start?.z ?? 1 });
  const view = useRef({ w: 360, h: 500, dpr: 1 });
  const anim = useRef({ until: 0, raf: 0, vel: [0, 0] as [number, number], fly: null as null | { from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; t0: number; dur: number }, drop: { id: '', t0: 0 }, fw: 0 });
  const drawn = useRef<{ o: Obj; x: number; y: number; w: number; h: number }[]>([]);
  const calm = () => document.documentElement.classList.contains('calm') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  const objs = useMemo(() => {
    const list: Obj[] = [];
    for (const b of props.buildings as Building[]) {
      const o = objOf(b);
      if (o) list.push(o);
    }
    return list.sort((a, b) => a.y - b.y);
  }, [props.buildings]);

  /* ---------------------------------------------------------------- camera */
  const limits = () => {
    const { w, h } = view.current;
    return { min: Math.min(w / MAP_W, h / MAP_H), cover: Math.max(w / MAP_W, h / MAP_H), max: 3 };
  };
  const clamp = () => {
    const c = cam.current;
    const { w, h } = view.current;
    const { min, max } = limits();
    c.z = Math.max(min, Math.min(max, c.z));
    const hw = w / 2 / c.z;
    const hh = h / 2 / c.z;
    c.x = MAP_W < hw * 2 ? MAP_W / 2 : Math.max(hw, Math.min(MAP_W - hw, c.x));
    c.y = MAP_H < hh * 2 ? MAP_H / 2 : Math.max(hh, Math.min(MAP_H - hh, c.y));
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
    P.current.onZoom?.(c.z / limits().cover);
  };

  /* ---------------------------------------------------------------- draw */
  const draw = useCallback(
    (now: number) => {
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
      g.fillStyle = '#141036';
      g.fillRect(0, 0, vw, vh);
      g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (vw / 2 - c.x * z), dpr * (vh / 2 - c.y * z));
      const [wx0, wy0] = toWorld(0, 0);
      const [wx1, wy1] = toWorld(vw, vh);
      const img = mapImage(() => kickRef.current());
      if (img.complete && img.naturalWidth) {
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, MAP_W, MAP_H);
      }
      const p = P.current;
      // free spots (build mode)
      if (p.spots) {
        const pulse = live ? 0.75 + 0.25 * Math.sin(t * 3) : 0.9;
        g.globalAlpha = pulse;
        for (const i of p.spots) {
          const [x, y] = SLOTS[i];
          if (x < wx0 - 30 || x > wx1 + 30 || y < wy0 - 30 || y > wy1 + 30) continue;
          const s = spotScale(y);
          g.drawImage(T.spot, x - 22 * s, y - 12 * s, 44 * s, 24 * s);
        }
        g.globalAlpha = 1;
      }
      // the ghost's footprint
      const gh = p.ghost;
      if (gh && SLOTS[gh.slot]) {
        const [x, y] = SLOTS[gh.slot];
        const s = spotScale(y);
        const r = Math.max(1, mapWidth(gh.a) / 67);
        g.fillStyle = gh.ok ? 'rgba(80,230,140,0.45)' : 'rgba(255,80,90,0.5)';
        g.strokeStyle = gh.ok ? '#7dffb0' : '#ff7b84';
        g.lineWidth = 2 / Math.max(z, 0.6);
        g.beginPath();
        g.ellipse(x, y, 25 * s * r, 13 * s * r, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      const sel = p.selected ? objs.find((o) => o.b?.id === p.selected) : null;
      if (sel) {
        const s = spotScale(sel.y);
        g.strokeStyle = '#ffd76a';
        g.lineWidth = 2.5 / Math.max(z, 0.6);
        g.beginPath();
        g.ellipse(sel.x, sel.y, (sel.dw / 2) * 0.9, 13 * s * Math.max(1, sel.dw / 67), 0, 0, Math.PI * 2);
        g.stroke();
      }
      // objects, back to front (already sorted by y; the ghost slots in)
      const list: Obj[] = [];
      let ghostObj: Obj | null = null;
      if (gh && gh.a.sprite && SLOTS[gh.slot]) {
        const [x, y] = SLOTS[gh.slot];
        ghostObj = { sprite: gh.a.sprite, x, y, dw: mapWidth(gh.a) * spotScale(y), flip: gh.flip, ghost: true };
      }
      let gi = false;
      for (const o of objs) {
        if (ghostObj && !gi && o.y > ghostObj.y) {
          list.push(ghostObj);
          gi = true;
        }
        if (o.x + o.dw < wx0 || o.x - o.dw > wx1 || o.y - o.dw * 2 > wy1 || o.y < wy0) continue;
        if (o.dw * z < 3) continue; // too small to see (LOD)
        list.push(o);
      }
      if (ghostObj && !gi) list.push(ghostObj);
      const out: typeof drawn.current = [];
      const drop = anim.current.drop;
      for (const o of list) {
        const m = sprite(o.sprite);
        if (!m.ready) continue;
        if (!ASPECT[o.sprite]) ASPECT[o.sprite] = m.img.naturalHeight / m.img.naturalWidth;
        let dw = o.dw;
        let dh = dw * ASPECT[o.sprite];
        let oy = o.y + dh * 0.1;
        let alpha = o.ghost ? 0.75 : 1;
        if (o.b && o.b.id === drop.id) {
          const k = Math.min(1, (now - drop.t0) / 520);
          const e = 1 - Math.pow(1 - k, 3);
          oy -= (1 - e) * 60;
          const sc = 0.85 + 0.15 * e;
          dw *= sc;
          dh *= sc;
          alpha = 0.3 + 0.7 * e;
        }
        const im = pickMip(m, dw * z * view.current.dpr);
        g.globalAlpha = alpha;
        if (o.flip) {
          g.save();
          g.translate(o.x, 0);
          g.scale(-1, 1);
          g.drawImage(im, -dw / 2, oy - dh, dw, dh);
          g.restore();
        } else g.drawImage(im, o.x - dw / 2, oy - dh, dw, dh);
        g.globalAlpha = 1;
        if (o.b) out.push({ o, x: o.x - dw / 2, y: oy - dh, w: dw, h: dh });
      }
      // evening light when close enough to see it
      if (z > 1.1) {
        g.globalCompositeOperation = 'lighter';
        for (const o of list) {
          if (!o.glow || o.ghost) continue;
          const dh = o.dw * (ASPECT[o.sprite] ?? 1);
          const flick = live ? 0.75 + 0.25 * Math.sin(t * 2.3 + o.x * 0.17 + o.y) : 0.9;
          if (o.glow === 'windows') {
            g.globalAlpha = 0.45 * flick;
            g.drawImage(T.warm, o.x - o.dw * 0.42, o.y - dh * 0.6, o.dw * 0.84, dh * 0.6);
          } else if (o.glow === 'lamp') {
            g.globalAlpha = 0.65 * flick;
            const s = 10 + o.dw * 0.3;
            g.drawImage(T.glow, o.x - s / 2, o.y - dh * 0.9 - s / 2, s, s);
          } else if (o.glow === 'tree') {
            for (let i = 0; i < 4; i++) {
              const k = live ? 0.5 + 0.5 * Math.sin(t * 3 + i * 1.9 + o.x) : 0.6;
              g.globalAlpha = 0.6 * k;
              const s = 4 + o.dw * 0.1;
              g.drawImage(T.glow, o.x + (((i * 37) % 9) / 9 - 0.5) * o.dw * 0.5 - s / 2, o.y - dh * (0.25 + ((i * 23) % 10) / 16) - s / 2, s, s);
            }
          } else if (o.glow === 'fire') {
            g.globalAlpha = live ? 0.6 + 0.3 * Math.sin(t * 9 + o.x) : 0.7;
            g.drawImage(T.glow, o.x - o.dw * 0.7, o.y - dh * 1.1, o.dw * 1.4, dh * 1.2);
          } else if (o.glow === 'ice') {
            g.globalAlpha = live ? 0.25 + 0.2 * Math.sin(t * 1.4 + o.x) : 0.3;
            g.drawImage(T.warm, o.x - o.dw * 0.4, o.y - dh * 0.6, o.dw * 0.8, dh * 0.5);
          }
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      }
      drawn.current = out;
      // snow puff on a fresh build
      if (drop.id && now - drop.t0 < 1300) {
        const o = objs.find((x) => x.b?.id === drop.id);
        const k = (now - drop.t0 - 450) / 850;
        if (o && k > 0) {
          g.fillStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
          for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            const d = o.dw * (0.3 + k * 0.7);
            g.beginPath();
            g.arc(o.x + Math.cos(ang) * d, o.y + Math.sin(ang) * d * 0.45 - k * 8, Math.max(0.6, (1 - k) * 2.5 + 0.6), 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      // fireworks over the castle and the tree (global city, celebration stage)
      if (p.fireworks && now < anim.current.fw) {
        g.globalCompositeOperation = 'lighter';
        const cols = ['255,215,106', '196,181,253', '125,211,252', '252,165,165'];
        for (let k = 0; k < 4; k++) {
          const ph = ((now / 1000 + k * 0.55) % 2.2) / 2.2;
          const fx = 836 + Math.sin(k * 2.1) * 260;
          const fy = 120 + (k % 2) * 60;
          for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            const d = ph * 70;
            g.fillStyle = `rgba(${cols[k]},${1 - ph})`;
            g.beginPath();
            g.arc(fx + Math.cos(ang) * d, fy + Math.sin(ang) * d + ph * ph * 20, 2.2, 0, Math.PI * 2);
            g.fill();
          }
        }
        g.globalCompositeOperation = 'source-over';
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
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [objs],
  );
  /* ---------------------------------------------------------------- loop: runs only while something moves */
  const kickRef = useRef<() => void>(() => {});
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
        P.current.onZoom?.(c.z / limits().cover);
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
  kickRef.current = () => kick();

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
      P.current.onZoom?.(cam.current.z / limits().cover);
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
  useEffect(() => kick(), [kick, props.ghost, props.selected, props.spots]);
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
      cam.current = { x: props.start.x, y: props.start.y, z: props.start.z * limits().cover };
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
    if (!gh || !SLOTS[gh.slot]) return false;
    const [wx, wy] = toWorld(x, y);
    const [sx, sy] = SLOTS[gh.slot];
    const w = mapWidth(gh.a) * spotScale(sy);
    const pad = 22 / cam.current.z;
    return wx > sx - w / 2 - pad && wx < sx + w / 2 + pad && wy > sy - w * 1.1 - pad && wy < sy + pad;
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
        const [gx, gy] = SLOTS[P.current.ghost!.slot];
        const [wx, wy] = toWorld(p.x, p.y);
        S.grab = [wx - gx, wy - gy];
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
      const ns = nearestSlot(wx - S.grab[0], wy - S.grab[1]);
      const gh = P.current.ghost;
      if (gh && ns >= 0 && ns !== gh.slot) P.current.onGhostMove?.(ns);
      // drag near the edge → the camera follows
      const { w, h } = view.current;
      const ex = p.x < 30 ? -1 : p.x > w - 30 ? 1 : 0;
      const ey = p.y < 30 ? -1 : p.y > h - 30 ? 1 : 0;
      if (ex || ey) {
        c.x += (ex * 10) / c.z;
        c.y += (ey * 10) / c.z;
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
        anim.current.fly = { from: { ...c }, to: { x: wx, y: wy, z: Math.min(limits().max, c.z * 2) }, t0: now, dur: 380 };
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
      P.current.onTapBuilding?.(hit, nearestSlot(wx, wy + 4));
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
      anim.current.fly = { from: { ...c }, to: { x: MAP_W / 2, y: MAP_H / 2, z: limits().min }, t0: performance.now(), dur: 520 };
      kick();
    },
    flyTo(x, y, z) {
      const c = cam.current;
      anim.current.fly = { from: { ...c }, to: { x, y, z: (z ?? 2.2) * limits().cover }, t0: performance.now(), dur: 560 };
      kick();
    },
    snapshot() {
      return new Promise((res) => {
        draw(performance.now());
        canvasRef.current?.toBlob((b) => res(b), 'image/jpeg', 0.9);
      });
    },
    centerSlot(ok) {
      return nearestSlot(cam.current.x, cam.current.y, ok);
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
