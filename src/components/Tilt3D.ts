/**
 * 3D showcase for shop artwork: every `.ltd-card-art` inside `root` leans toward the finger / pointer
 * (and, on phones, with the device's tilt) and catches a moving glare. CSS does the drawing
 * (--rx/--ry tilt, --gx/--gy glare spot); this only feeds the variables. Off with reduced motion.
 */
import { useEffect, type RefObject } from 'react';

const MAX = 12; // degrees

export function useTilt3D(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let active: HTMLElement | null = null;
    const set = (card: HTMLElement, nx: number, ny: number) => {
      card.style.setProperty('--ry', `${(nx - 0.5) * 2 * MAX}deg`);
      card.style.setProperty('--rx', `${(0.5 - ny) * 2 * MAX}deg`);
      card.style.setProperty('--gx', `${nx * 100}%`);
      card.style.setProperty('--gy', `${ny * 100}%`);
    };
    const reset = (card: HTMLElement) => ['--rx', '--ry', '--gx', '--gy'].forEach((v) => card.style.removeProperty(v));
    const move = (e: PointerEvent) => {
      const card = (e.target as HTMLElement | null)?.closest?.('.ltd-card-art') as HTMLElement | null;
      if (active && active !== card) {
        active.classList.remove('is-tilt');
        reset(active);
      }
      active = card;
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.classList.add('is-tilt');
      set(card, Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
    };
    const leave = () => {
      if (!active) return;
      active.classList.remove('is-tilt');
      reset(active);
      active = null;
    };
    // phones: the whole grid follows the device's tilt (no permission prompt; skipped where not available)
    let raf = 0;
    const orient = (e: DeviceOrientationEvent) => {
      if (active || e.beta == null || e.gamma == null) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const nx = 0.5 + Math.max(-1, Math.min(1, (e.gamma ?? 0) / 30)) * 0.5;
        const ny = 0.5 + Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 30)) * 0.5;
        el.style.setProperty('--dry', `${(nx - 0.5) * 1.2 * MAX}deg`);
        el.style.setProperty('--drx', `${(0.5 - ny) * 1.2 * MAX}deg`);
        el.style.setProperty('--dgx', `${nx * 100}%`);
      });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('pointerup', leave);
    el.addEventListener('pointercancel', leave);
    window.addEventListener('deviceorientation', orient);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('pointerup', leave);
      el.removeEventListener('pointercancel', leave);
      window.removeEventListener('deviceorientation', orient);
    };
  }, [root]);
}
