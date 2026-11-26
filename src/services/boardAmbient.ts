/**
 * Board ambience (New Year collection): falling snow over the board and its frame, plus the frame's own lights —
 * flickering lanterns, glowing ice posts, the northern lights. Drawn on three empty layers that Board renders inside
 * the board wrapper (`.bfx-1..3`, see app.css); a board opts in with `amb` in its style.
 * Every loop animates only transform / opacity (GPU-composited, no repaints). Off with html.calm (animations setting /
 * low battery) and prefers-reduced-motion; frozen by html.app-paused. Small previews (.mini-skin) get none.
 */
export type Ambient = 'frost' | 'ice' | 'aurora';
export const AMBIENTS: readonly Ambient[] = ['frost', 'ice', 'aurora'];

/** a point of the 512×512 frame art → % of the wrapper */
const p = (x: number, y: number) => `${((x / 512) * 100).toFixed(2)}% ${((y / 512) * 100).toFixed(2)}%`;
const glow = (x: number, y: number, c: string, r: number) => `radial-gradient(circle at ${p(x, y)}, ${c}, transparent ${r}%)`;

interface Spec {
  /** snow density: opacity of the far and the near flakes */
  snow: [number, number];
  /** layer 2: light sources (lanterns / posts), their animation */
  lights: string[];
  lightsAnim: string;
  /** layer 3 (optional): extra light */
  extra?: string;
}

const WARM = 'rgba(255,196,92,.62)';
const SPECS: Record<Ambient, Spec> = {
  // wooden frame: four lanterns flicker like candles
  frost: {
    snow: [0.55, 0.85],
    lights: [glow(30, 256, WARM, 7), glow(482, 256, WARM, 7), glow(196, 484, WARM, 5.5), glow(316, 484, WARM, 5.5)],
    lightsAnim: 'ny-flicker 3.4s ease-in-out infinite',
  },
  // silver-ice frame: the corner snowflakes and the blue inner line breathe
  ice: {
    snow: [0.5, 0.75],
    lights: [
      glow(34, 34, 'rgba(110,190,255,.75)', 8),
      glow(478, 34, 'rgba(110,190,255,.75)', 8),
      glow(34, 478, 'rgba(110,190,255,.75)', 8),
      glow(478, 478, 'rgba(110,190,255,.75)', 8),
      glow(256, 27, 'rgba(150,210,255,.6)', 4),
      glow(256, 485, 'rgba(150,210,255,.6)', 4),
      glow(27, 256, 'rgba(150,210,255,.6)', 4),
      glow(485, 256, 'rgba(150,210,255,.6)', 4),
    ],
    lightsAnim: 'ny-pulse 3s ease-in-out infinite',
    extra: 'ice',
  },
  // premium frame: gold lanterns, glowing crystals, the crown's jewel and the northern lights above it
  aurora: {
    snow: [0.6, 0.9],
    lights: [
      glow(128, 46, WARM, 6),
      glow(384, 46, WARM, 6),
      glow(150, 488, WARM, 5),
      glow(362, 488, WARM, 5),
      glow(26, 50, 'rgba(120,200,255,.55)', 7),
      glow(486, 50, 'rgba(120,200,255,.55)', 7),
      glow(256, 40, 'rgba(190,150,255,.6)', 9),
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
  if (s.extra === 'ice') css += `${sel('.bfx-3')}{inset:${((44 / 512) * 100).toFixed(2)}%;border-radius:8px;box-shadow:0 0 14px 2px rgba(70,160,255,.75),inset 0 0 14px rgba(70,160,255,.55);animation:ny-pulse 3s ease-in-out 1.5s infinite;}`;
  if (s.extra === 'aurora') css += `${sel('.bfx-3')}{inset:-6% -12% auto -12%;height:30%;background:radial-gradient(ellipse 26% 55% at 22% 55%,rgba(80,255,190,.5),transparent 70%),radial-gradient(ellipse 30% 60% at 50% 42%,rgba(160,100,255,.55),transparent 70%),radial-gradient(ellipse 26% 52% at 78% 58%,rgba(70,200,255,.45),transparent 70%);mix-blend-mode:screen;animation:ny-aurora 9s ease-in-out infinite alternate;}`;
  return css;
}
