import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readJSON, writeJSON } from '../services/localStore.ts';
import { configureSound, installAudioUnlock } from '../services/sound.ts';

export interface Settings {
  /** highlight selectable pieces and legal destination squares */
  showLegal: boolean;
  /** ask before restart / resign */
  confirmActions: boolean;
  /** sound effects on/off and volume 0–1 */
  sound: boolean;
  volume: number;
  /** hide the in-game chat */
  chatHidden: boolean;
  /** decorative animations (stones' gleam, profile frames, …) */
  animations: boolean;
  /** seasonal decoration (New Year: snow on buttons, garland, frosty panels) — shown only in its season */
  festive: boolean;
}
const DEFAULTS: Settings = { showLegal: true, confirmActions: true, sound: true, volume: 0.7, chatHidden: false, animations: true, festive: true };

/** New Year decoration season: 1 December – 10 January (Tashkent). BETA: always on, so it can be tried now. */
const FESTIVE_PREVIEW = true;
export function festiveSeason(now = new Date()): boolean {
  if (FESTIVE_PREVIEW) return true;
  const t = new Date(now.getTime() + 5 * 3_600_000); // Tashkent = UTC+5
  const m = t.getUTCMonth();
  const d = t.getUTCDate();
  return m === 11 || (m === 0 && d <= 10);
}
const KEY = 'dameobeta.settings';

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}
const C = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...readJSON<Partial<Settings>>(KEY, {}) }));
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeJSON(KEY, next);
      return next;
    });
  }, []);
  useEffect(() => {
    installAudioUnlock();
    configureSound({ enabled: settings.sound, volume: settings.volume });
  }, [settings.sound, settings.volume]);
  // html.calm stops every decorative loop: switched off here, or the phone is in battery-saver territory
  // (Battery API: not charging and ≤ 20 %). Reduced Motion is handled in CSS.
  const [lowBattery, setLowBattery] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (e: string, f: () => void) => void }> };
    let alive = true;
    nav.getBattery?.().then(
      (b) => {
        const check = () => alive && setLowBattery(!b.charging && b.level <= 0.2);
        check();
        b.addEventListener('levelchange', check);
        b.addEventListener('chargingchange', check);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('calm', !settings.animations || lowBattery);
  }, [settings.animations, lowBattery]);
  useEffect(() => {
    document.documentElement.classList.toggle('ny-theme', settings.festive && festiveSeason());
  }, [settings.festive]);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useSettings(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}
