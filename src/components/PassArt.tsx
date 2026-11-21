/**
 * DAMEO Pass artwork — every reward is drawn here as its own SVG (no external images except shop items),
 * with CSS effects by rarity: shine sweep, glow pulse, twinkling sparks, rotating rays (legendary / mythic).
 * Also: status emoji next to a name (like Telegram Premium), avatar frames, profile backgrounds, badges, titles.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Reward } from '../services/pass/core.ts';
import { PASS_EVENT } from '../services/pass/demo.ts';
import { wornOf, type Worn } from '../services/pass/index.ts';

const art = (p: string) => new URL(p, document.baseURI).href;

/* ================================================================ shared bits */
function Sparks({ n = 4, color = '#fff7d1' }: { n?: number; color?: string }) {
  const pts = [
    [10, 12],
    [54, 10],
    [56, 46],
    [8, 50],
    [32, 4],
    [60, 28],
  ].slice(0, n);
  return (
    <g className="pa-sparks">
      {pts.map(([x, y], i) => (
        <path key={i} className="pa-spark" style={{ animationDelay: `${i * 0.45}s` }} d={`M${x} ${y - 3}L${x + 0.9} ${y - 0.9}L${x + 3} ${y}L${x + 0.9} ${y + 0.9}L${x} ${y + 3}L${x - 0.9} ${y + 0.9}L${x - 3} ${y}L${x - 0.9} ${y - 0.9}Z`} fill={color} />
      ))}
    </g>
  );
}

function Coin({ x, y, id, r = 11 }: { x: number; y: number; id: string; r?: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y + 2.5} rx={r} ry={r * 0.42} fill="#9a5b06" />
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.42} fill={`url(#${id}-gold)`} stroke="#b7790c" strokeWidth="0.8" />
      <ellipse cx={x} cy={y} rx={r * 0.66} ry={r * 0.26} fill="none" stroke="#fff3b0" strokeOpacity="0.7" strokeWidth="0.9" />
      <path d={`M${x - 3.2} ${y + 0.6}l1-2.4 2.2 1.4 2.2-1.4 1 2.4z`} fill="#b45309" />
    </g>
  );
}
function GoldDefs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff3b0" />
        <stop offset="0.45" stopColor="#fbbf24" />
        <stop offset="1" stopColor="#d97706" />
      </linearGradient>
      <linearGradient id={`${id}-violet`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#c4b5fd" />
        <stop offset="0.5" stopColor="#7c3aed" />
        <stop offset="1" stopColor="#3b0f8a" />
      </linearGradient>
      <linearGradient id={`${id}-silver`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.5" stopColor="#cbd5e1" />
        <stop offset="1" stopColor="#64748b" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fde68a" stopOpacity="0.9" />
        <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function CoinStack({ amount, id }: { amount: number; id: string }) {
  const n = amount >= 500 ? 5 : amount >= 150 ? 4 : amount >= 100 ? 3 : 2;
  const spots: [number, number][] = [
    [26, 46],
    [40, 44],
    [33, 38],
    [22, 34],
    [42, 31],
  ];
  return (
    <>
      {spots.slice(0, n).map(([x, y], i) => (
        <g key={i}>
          <Coin x={x} y={y} id={id} />
          <Coin x={x} y={y - 4} id={id} />
        </g>
      ))}
    </>
  );
}

/* ================================================================ status emoji (also used next to names) */
export function EmojiArt({ id, size = 20, className = '' }: { id: string; size?: number; className?: string }) {
  const u = useId().replace(/:/g, '');
  const body = (() => {
    switch (id) {
      case 'e-piece':
        return (
          <>
            <ellipse cx="32" cy="44" rx="28" ry="12" fill="#0b0f1a" />
            <rect x="4" y="34" width="56" height="10" fill="#1f2937" />
            <ellipse cx="32" cy="34" rx="28" ry="12" fill={`url(#${u}-dark)`} stroke="#9ca3af" strokeWidth="1.5" />
            <ellipse cx="32" cy="34" rx="19" ry="7.5" fill="none" stroke="#a78bfa" strokeWidth="2" />
            <path d="M21 37l-3-14 9 6 5-10 5 10 9-6-3 14z" fill={`url(#${u}-gold)`} stroke="#92400e" strokeWidth="1" />
          </>
        );
      case 'e-crown':
        return (
          <>
            <rect x="8" y="10" width="48" height="40" rx="12" fill={`url(#${u}-violet)`} />
            <path d="M24 52l8-6h-8z" fill="#5b21b6" />
            <path d="M18 38l-2-16 9 7 7-11 7 11 9-7-2 16z" fill={`url(#${u}-gold)`} stroke="#92400e" strokeWidth="1" />
            <circle cx="32" cy="18" r="2" fill="#fef3c7" />
          </>
        );
      case 'e-win':
        return (
          <>
            <rect x="4" y="16" width="56" height="32" rx="8" fill="#047857" />
            <rect x="6" y="18" width="52" height="26" rx="6" fill="#10b981" />
            <text x="32" y="38" textAnchor="middle" fontSize="17" fontWeight="900" fill="#ecfdf5" fontFamily="system-ui, sans-serif">
              WIN
            </text>
          </>
        );
      case 'e-diamond':
        return (
          <>
            <path d="M14 24l10-12h16l10 12-18 28z" fill="#a78bfa" />
            <path d="M14 24h36L32 52z" fill="#7c3aed" />
            <path d="M24 12l-4 12h24l-4-12z" fill="#ddd6fe" />
            <path d="M20 24l12 28 12-28" fill="none" stroke="#ede9fe" strokeWidth="1" strokeOpacity="0.7" />
          </>
        );
      case 'e-gold-crown':
        return (
          <>
            <path d="M10 46l-4-26 14 11 12-19 12 19 14-11-4 26z" fill={`url(#${u}-gold)`} stroke="#92400e" strokeWidth="1.2" />
            <rect x="10" y="44" width="44" height="7" rx="2" fill="#d97706" />
            <circle cx="20" cy="39" r="3" fill="#ef4444" />
            <circle cx="32" cy="36" r="3.4" fill="#3b82f6" />
            <circle cx="44" cy="39" r="3" fill="#10b981" />
          </>
        );
      case 'e-fire':
        return (
          <>
            <path d="M32 6c3 10 16 16 16 30a16 16 0 01-32 0c0-8 5-12 7-18 2 5 4 7 6 8-1-8 1-14 3-20z" fill="#f97316" />
            <path d="M32 26c2 6 9 9 9 17a9 9 0 01-18 0c0-5 3-7 4-10 1 3 2 4 4 5-1-5 0-8 1-12z" fill="#fde047" />
          </>
        );
      default:
        return <circle cx="32" cy="32" r="20" fill="#a78bfa" />;
    }
  })();
  return (
    <svg className={`pa-emoji ${className}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <GoldDefs id={u} />
      <defs>
        <linearGradient id={`${u}-dark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4b5563" />
          <stop offset="1" stopColor="#111827" />
        </linearGradient>
      </defs>
      {body}
    </svg>
  );
}

/* ================================================================ frames */
const FRAME_STYLE: Record<string, { cls: string; label?: string }> = {
  'f-violet': { cls: 'pf-violet' },
  'f-silver': { cls: 'pf-silver' },
  'f-gold': { cls: 'pf-gold' },
  'f-epic': { cls: 'pf-epic' },
  'f-legend': { cls: 'pf-legend' },
};
/** Wraps an avatar with a pass frame. */
export function PassFrame({ id, size, children }: { id: string | null | undefined; size: number; children: ReactNode }) {
  if (!id || !FRAME_STYLE[id]) return <>{children}</>;
  const crown = id === 'f-gold' || id === 'f-legend';
  return (
    <span className={`pf ${FRAME_STYLE[id].cls}`} style={{ width: size, height: size, ['--pf' as string]: `${size}px` }}>
      <span className="pf-ring" aria-hidden />
      {id === 'f-legend' && (
        <>
          <span className="pf-wing pf-wing-l" aria-hidden />
          <span className="pf-wing pf-wing-r" aria-hidden />
        </>
      )}
      <span className="pf-in">{children}</span>
      {crown && (
        <svg className="pf-crown" viewBox="0 0 64 40" aria-hidden>
          <path d="M8 36L4 10l14 11L32 2l14 19 14-11-4 26z" fill="#fbbf24" stroke="#92400e" strokeWidth="2" />
          <circle cx="32" cy="24" r="4" fill="#ef4444" />
        </svg>
      )}
    </span>
  );
}
function FrameArt({ id }: { id: string }) {
  return (
    <span className="pa-frame-art">
      <PassFrame id={id} size={34}>
        <span className="pa-frame-face" />
      </PassFrame>
    </span>
  );
}

/* ================================================================ backgrounds */
export function ProfileBg({ id, className = '' }: { id: string | null | undefined; className?: string }) {
  if (!id) return null;
  return (
    <span className={`pbg pbg-${id} ${className}`} aria-hidden>
      {id === 'bg-night' && (
        <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMax slice">
          <circle cx="320" cy="44" r="22" fill="#f5f3ff" opacity="0.92" />
          <circle cx="330" cy="38" r="20" fill="#2e1065" opacity="0.35" />
          <path d="M0 160L70 80l50 50 70-90 80 100 60-60 70 80z" fill="#4c1d95" />
          <path d="M0 160l90-60 60 40 80-70 90 90 80-50v50z" fill="#2e1065" />
        </svg>
      )}
      {id === 'bg-palace' && (
        <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMax slice">
          <path d="M120 160V96h20V70l10-14 10 14v26h20V60l20-26 20 26v36h20V70l10-14 10 14v26h20v64z" fill="#78350f" opacity="0.85" />
          <path d="M190 34l10-18 10 18z" fill="#fbbf24" />
        </svg>
      )}
      {id === 'bg-cosmos' && (
        <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid slice">
          <circle cx="330" cy="110" r="34" fill="#7c3aed" />
          <ellipse cx="330" cy="110" rx="58" ry="10" fill="none" stroke="#f0abfc" strokeWidth="3" transform="rotate(-18 330 110)" />
          <circle cx="60" cy="40" r="6" fill="#93c5fd" />
        </svg>
      )}
      <span className="pbg-stars" />
    </span>
  );
}
function BgArt({ id }: { id: string }) {
  return (
    <span className="pa-bg-art">
      <ProfileBg id={id} />
    </span>
  );
}

/* ================================================================ badges and titles */
export function BadgeArt({ id, size = 40 }: { id: string; size?: number }) {
  const u = useId().replace(/:/g, '');
  const gold = id === 'b-s1-gold';
  return (
    <svg className="pa-badge" viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <GoldDefs id={u} />
      <circle cx="32" cy="32" r="20" fill={gold ? `url(#${u}-gold)` : `url(#${u}-silver)`} />
      <circle cx="32" cy="32" r="16" fill={gold ? '#78350f' : '#334155'} />
      {[0, 1].map((side) => (
        <g key={side} transform={side ? 'translate(64 0) scale(-1 1)' : undefined}>
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={10 + i * 1.5} cy={46 - i * 7} rx="3.2" ry="6" transform={`rotate(${-30 + i * 14} ${10 + i * 1.5} ${46 - i * 7})`} fill={gold ? '#fbbf24' : '#cbd5e1'} />
          ))}
        </g>
      ))}
      <text x="32" y="38.5" textAnchor="middle" fontSize="17" fontWeight="900" fill={gold ? '#fde68a' : '#f1f5f9'} fontFamily="system-ui, sans-serif">
        S1
      </text>
    </svg>
  );
}
const TITLE_STYLE: Record<string, string> = { 't-active': 'pt-violet', 't-elite': 'pt-gold', 't-champion': 'pt-champ' };
export const TITLE_NAME: Record<string, { uz: string; en: string }> = {
  't-active': { uz: "Faol o'yinchi", en: 'Active player' },
  't-elite': { uz: 'Dameo Elite', en: 'Dameo Elite' },
  't-champion': { uz: "Chempion da'vogar", en: 'Title contender' },
};
export function TitleTag({ id, lang }: { id: string; lang: 'uz' | 'en' }) {
  const n = TITLE_NAME[id];
  if (!n) return null;
  return (
    <span className={`pt ${TITLE_STYLE[id] ?? ''}`}>
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden>
        <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.1l1.4-7L2 9.3l7-.8z" fill="currentColor" />
      </svg>
      {lang === 'en' ? n.en : n.uz}
    </span>
  );
}
function TitleArt({ id }: { id: string }) {
  const u = useId().replace(/:/g, '');
  const gold = id !== 't-active';
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden>
      <GoldDefs id={u} />
      <path d="M4 26l8 6-8 6h10V26z" fill={gold ? '#b45309' : '#5b21b6'} />
      <path d="M60 26l-8 6 8 6H50V26z" fill={gold ? '#b45309' : '#5b21b6'} />
      <rect x="12" y="22" width="40" height="20" rx="3" fill={gold ? `url(#${u}-gold)` : `url(#${u}-violet)`} />
      <path d="M32 26l1.8 3.8 4.2.5-3.1 2.9.8 4.1L32 35.3l-3.7 2 .8-4.1-3.1-2.9 4.2-.5z" fill={gold ? '#7c2d12' : '#fde68a'} />
      {id === 't-champion' && <path d="M22 20l-1.5-9 6 4 5.5-7 5.5 7 6-4-1.5 9z" fill="#fbbf24" stroke="#92400e" strokeWidth="0.8" />}
    </svg>
  );
}

/* ================================================================ other rewards */
function XpTicket({ pct, id }: { pct: number; id: string }) {
  const hot = pct >= 50;
  return (
    <>
      <g transform="rotate(-12 32 32)">
        <path d="M6 18h52v9a5 5 0 000 10v9H6v-9a5 5 0 000-10z" fill={hot ? `url(#${id}-gold)` : `url(#${id}-violet)`} stroke={hot ? '#92400e' : '#3b0f8a'} strokeWidth="1.2" />
        <path d="M46 20v24" stroke={hot ? '#92400e' : '#c4b5fd'} strokeWidth="1" strokeDasharray="2 2" />
        <text x="26" y="36" textAnchor="middle" fontSize="14" fontWeight="900" fill={hot ? '#7c2d12' : '#fff'} fontFamily="system-ui, sans-serif">
          XP
        </text>
        <text x="52" y="35" textAnchor="middle" fontSize="7" fontWeight="900" fill={hot ? '#7c2d12' : '#fde68a'} fontFamily="system-ui, sans-serif" transform="rotate(90 52 32)">
          +{pct}%
        </text>
      </g>
    </>
  );
}
function Box({ id, kind }: { id: string; kind: string }) {
  if (kind === 'box-bag')
    return (
      <>
        <path d="M22 22c-10 8-14 30 10 30s20-22 10-30z" fill={`url(#${id}-violet)`} />
        <path d="M24 22l-4-8h24l-4 8z" fill="#6d28d9" />
        <rect x="22" y="20" width="20" height="4" rx="2" fill="#fbbf24" />
        <path d="M26 40l-1-8 4 3 3-5 3 5 4-3-1 8z" fill="#fbbf24" />
      </>
    );
  const epic = kind === 'box-epic';
  return (
    <>
      <rect x="10" y="30" width="44" height="22" rx="3" fill={epic ? '#7e22ce' : '#6d28d9'} stroke="#3b0764" strokeWidth="1" />
      <path d="M10 30c0-12 44-12 44 0z" fill={epic ? '#a855f7' : '#8b5cf6'} stroke="#3b0764" strokeWidth="1" />
      <rect x="10" y="29" width="44" height="4" fill={`url(#${id}-gold)`} />
      <rect x="28" y="20" width="8" height="32" fill={`url(#${id}-gold)`} opacity="0.95" />
      <rect x="27" y="31" width="10" height="9" rx="2" fill="#fbbf24" stroke="#92400e" strokeWidth="1" />
      <circle cx="32" cy="35.5" r="1.8" fill="#7c2d12" />
      {epic && <circle cx="32" cy="24" r="3" fill="#ec4899" stroke="#fdf2f8" strokeWidth="1" />}
    </>
  );
}
function FxArt({ slug, id }: { slug: string; id: string }) {
  return (
    <>
      {slug === 'fx-ripple' && [10, 16, 22].map((r, i) => <circle key={r} className="pa-ripple" style={{ animationDelay: `${i * 0.5}s` }} cx="32" cy="36" r={r} fill="none" stroke="#22d3ee" strokeWidth="2" />)}
      {slug === 'fx-fire' && (
        <>
          <path className="pa-flame" d="M14 44c-2-10 6-14 6-24 6 6 6 12 10 12 0-8 4-12 8-18 2 10 12 14 12 26z" fill="#f97316" />
          <path d="M22 44c0-6 4-8 5-14 3 4 4 7 6 7 0-4 2-7 4-10 2 6 6 9 6 17z" fill="#fde047" />
        </>
      )}
      {slug === 'fx-sparkle' && <Sparks n={6} color="#fde68a" />}
      <ellipse cx="32" cy="48" rx="14" ry="5.5" fill="#0f172a" />
      <ellipse cx="32" cy="44" rx="14" ry="5.5" fill={`url(#${id}-violet)`} stroke="#c4b5fd" strokeWidth="1" />
      <path d="M27 45l1.6-3.6 3.4 2 3.4-2 1.6 3.6z" fill="#fde68a" />
    </>
  );
}

/* ================================================================ the reward picture */
export function RewardArt({ r }: { r: Reward }) {
  const u = useId().replace(/:/g, '');
  const fx = `pa pa-${r.rarity} pa-k-${r.kind}`;
  const svg = (children: ReactNode) => (
    <svg className="pa-svg" viewBox="0 0 64 64" aria-hidden>
      <GoldDefs id={u} />
      {children}
      {(r.rarity === 'legendary' || r.rarity === 'mythic') && <Sparks n={r.rarity === 'mythic' ? 6 : 4} />}
    </svg>
  );
  let inner: ReactNode;
  switch (r.kind) {
    case 'coins':
      inner = svg(
        <g transform="translate(-7 -9) scale(1.22)">
          <CoinStack amount={Number(r.value)} id={u} />
        </g>,
      );
      break;
    case 'xp_boost':
      inner = svg(<XpTicket pct={Number(r.value)} id={u} />);
      break;
    case 'box':
      inner = svg(<Box id={u} kind={r.value} />);
      break;
    case 'emoji':
      inner = <EmojiArt id={r.value} size={44} className="pa-emoji-big" />;
      break;
    case 'frame':
      inner = <FrameArt id={r.value} />;
      break;
    case 'background':
      inner = <BgArt id={r.value} />;
      break;
    case 'badge':
      inner = <BadgeArt id={r.value} size={48} />;
      break;
    case 'title':
      inner = svg(<TitleArt id={r.value} />);
      break;
    case 'item':
      inner = r.value.startsWith('fx-') ? (
        svg(<FxArt slug={r.value} id={u} />)
      ) : (
        <img className="pa-img" src={art(r.value.startsWith('st-') ? `stones/${r.value}.webp` : `boards/${r.value}-sm.webp`)} alt="" loading="lazy" />
      );
      break;
  }
  return (
    <span className={fx}>
      {(r.rarity === 'legendary' || r.rarity === 'mythic') && <span className="pa-rays" aria-hidden />}
      <span className="pa-body">{inner}</span>
      {r.rarity !== 'common' && <span className="pa-shine" aria-hidden />}
    </span>
  );
}

/* ================================================================ worn cosmetics (profile, header, menu) */
export function useWorn(userId: string | null | undefined, enabled = true): Worn {
  const [w, setW] = useState<Worn>({});
  useEffect(() => {
    if (!enabled) {
      setW({});
      return;
    }
    let alive = true;
    const load = () => wornOf(userId).then((x) => alive && setW(x), () => undefined);
    void load();
    window.addEventListener(PASS_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(PASS_EVENT, load);
    };
  }, [userId, enabled]);
  return w;
}
/** Status emoji next to a name — like the Telegram Premium icon. */
export function NameEmoji({ worn, size = 18 }: { worn: Worn; size?: number }) {
  if (!worn.emoji) return null;
  return (
    <span className="pa-name-emoji" title="DAMEO Pass">
      <EmojiArt id={worn.emoji} size={size} />
    </span>
  );
}
