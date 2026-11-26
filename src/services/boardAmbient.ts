/**
 * Board ambience (New Year collection): falling snow over the board and its frame, plus the frame's own lights —
 * flickering lanterns, glowing ice posts, the northern lights. Drawn on three empty layers that Board renders inside
 * the board wrapper (`.bfx-1..3`, see app.css); a board opts in with `amb` in its style.
 * Every loop animates only transform / opacity (GPU-composited, no repaints). Off with html.calm (animations setting /
 * low battery) and prefers-reduced-motion; frozen by html.app-paused. Small previews (.mini-skin) get none.
 */
export type Ambient = 'frost' | 'ice' | 'aurora';
export const AMBIENTS: readonly Ambient[] = ['frost', 'ice', 'aurora'];

/** a point of the frame picture (fractions 0–1 of its width / height) → % of the wrapper */
const p = (x: number, y: number) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
const glow = (x: number, y: number, c: string, r: number) => `radial-gradient(circle at ${p(x, y)}, ${c}, transparent ${r}%)`;
/** source-pixel helper: a point of the owner's artwork crop → fractions */
const at = (crop: [number, number, number, number]) => (X: number, Y: number) => [(X - crop[0]) / (crop[2] - crop[0]), (Y - crop[1]) / (crop[3] - crop[1])] as const;

interface Spec {
  /** snow density: opacity of the far and the near flakes */
  snow: [number, number];
  /** layer 2: light sources (lanterns / emblems), their animation */
  lights: string[];
  lightsAnim: string;
  /** layer 3 (optional): extra light */
  extra?: 'ice' | 'aurora';
  /** ice: where the inner glowing line runs (the board opening, % of the wrapper) */
  inner?: [number, number, number, number];
}

const WARM = 'rgba(255,196,92,.7)';
const ICE = 'rgba(110,190,255,.8)';
const fr = at([846, 2, 1668, 935]);
const ic = at([8, 8, 832, 925]);
const au = at([0, 0, 1254, 1254]);
const L = (pt: readonly [number, number], c: string, r: number) => glow(pt[0], pt[1], c, r);
const SPECS: Record<Ambient, Spec> = {
  // wooden frame: six lanterns flicker like candles, the crown plaques glow
  frost: {
    snow: [0.55, 0.85],
    lights: [
      L(fr(925, 150), WARM, 7), L(fr(1590, 150), WARM, 7), L(fr(905, 445), WARM, 6), L(fr(1600, 445), WARM, 6),
      L(fr(915, 775), WARM, 7), L(fr(1590, 775), WARM, 7), L(fr(1255, 105), 'rgba(255,215,120,.6)', 6), L(fr(1255, 830), 'rgba(255,215,120,.6)', 6),
    ],
    lightsAnim: 'ny-flicker 3.4s ease-in-out infinite',
  },
  // silver-ice frame: the four snowflake emblems and the blue inner line breathe
  ice: {
    snow: [0.5, 0.75],
    lights: [L(ic(418, 85), ICE, 9), L(ic(418, 840), ICE, 9), L(ic(60, 450), ICE, 8), L(ic(770, 450), ICE, 8)],
    lightsAnim: 'ny-pulse 3s ease-in-out infinite',
    extra: 'ice',
    inner: [14.39, 14.32, 13.74, 12.86], // top right bottom left
  },
  // premium frame: gold lanterns, glowing shields, the crown's jewel, the wolves' eyes and the northern lights above
  aurora: {
    snow: [0.6, 0.9],
    lights: [
      L(au(100, 165), WARM, 6), L(au(1150, 165), WARM, 6), L(au(95, 1030), WARM, 6), L(au(1150, 1030), WARM, 6),
      L(au(85, 610), 'rgba(255,210,120,.55)', 6), L(au(1170, 610), 'rgba(255,210,120,.55)', 6),
      L(au(627, 75), 'rgba(190,150,255,.75)', 6), L(au(232, 1110), 'rgba(255,190,80,.9)', 2.4), L(au(1022, 1110), 'rgba(255,190,80,.9)', 2.4),
    ],
    lightsAnim: 'ny-flicker 3.8s ease-in-out infinite',
    extra: 'aurora',
  },
};

const snowUrl = (name: string) => {
  const base = typeof document !== 'undefined' ? document.baseURI : 'https://localhost/';
  return `url("${new URL(`boards/${name}.webp`, base).href}")`;
};

/** CSS for one board scope (`.sk-b-<slug>`); '' for an unknown kind. */
export function ambientCss(scope: string, kind: unknown): string {
  if (typeof kind !== 'string' || !(AMBIENTS as readonly string[]).includes(kind)) return '';
  const s = SPECS[kind as Ambient];
  const sel = (tail: string) => `.${scope}.board-wrap:not(.mini-skin) ${tail}`;
  let css = `${sel('.bfx')}{display:block;}`;
  css += `${sel('.bfx-1::before')}{background-image:${snowUrl('ny-snow-far')};opacity:${s.snow[0]};}`;
  css += `${sel('.bfx-1::after')}{background-image:${snowUrl('ny-snow-near')};opacity:${s.snow[1]};}`;
  css += `${sel('.bfx-2')}{background:${s.lights.join(',')};animation:${s.lightsAnim};}`;
  if (s.extra === 'ice' && s.inner) css += `${sel('.bfx-3')}{inset:${s.inner.map((v) => `${v}%`).join(' ')};border-radius:6px;box-shadow:0 0 14px 2px rgba(70,160,255,.75),inset 0 0 14px rgba(70,160,255,.55);animation:ny-pulse 3s ease-in-out 1.5s infinite;}`;
  if (s.extra === 'aurora') css += `${sel('.bfx-3')}{inset:-4% -12% auto -12%;height:26%;background:radial-gradient(ellipse 26% 55% at 22% 55%,rgba(80,255,190,.5),transparent 70%),radial-gradient(ellipse 30% 60% at 50% 42%,rgba(160,100,255,.55),transparent 70%),radial-gradient(ellipse 26% 52% at 78% 58%,rgba(70,200,255,.45),transparent 70%);mix-blend-mode:screen;animation:ny-aurora 9s ease-in-out infinite alternate;}`;
  return css;
}
