import { describe, expect, test } from 'bun:test';

// a tiny localStorage for the demo store
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};
const { demoBoosters, demoBuyElite, demoPass, demoPassClaim, demoUseBooster } = await import('./demo.ts');

const H = 3_600_000;
const NOW = Date.UTC(2026, 10, 22, 10);

describe('XP booster kept in the inventory', () => {
  test('Free Lv.3 goes to the inventory, turns on later for 3 hours, once', () => {
    mem.clear();
    expect(demoPassClaim(3, 'free', NOW).ok).toBe(true);
    let b = demoBoosters(NOW);
    expect(b.stored.length).toBe(1);
    expect(b.stored[0].pct).toBe(10);
    expect(b.active).toBeNull();
    expect(demoPass(NOW).boostToday).toBe(0); // nothing runs until the player turns it on

    const later = NOW + 5 * 24 * H;
    const r = demoUseBooster(b.stored[0].id, later);
    expect(r.ok).toBe(true);
    b = demoBoosters(later + H);
    expect(b.stored.length).toBe(0);
    expect(b.active?.pct).toBe(10);
    expect(demoPass(later + H).boostToday).toBe(10);
    expect(demoBoosters(later + 3 * H + 1).active).toBeNull(); // over after 3 hours
  });
  test('cannot be turned on after 30 days or while another runs', () => {
    mem.clear();
    demoPassClaim(3, 'free', NOW);
    expect(demoPassClaim(3, 'elite', NOW).ok).toBe(false); // Premium is locked until it is bought
    demoBuyElite(NOW);
    expect(demoPassClaim(3, 'elite', NOW).ok).toBe(true);
    const [a, p] = demoBoosters(NOW).stored;
    expect(demoUseBooster(p.id, NOW + H).ok).toBe(true);
    expect(demoUseBooster(a.id, NOW + 2 * H)).toEqual({ ok: false, error: 'active' });
    expect(demoUseBooster(a.id, NOW + 31 * 24 * H)).toEqual({ ok: false, error: 'expired' });
  });
});
