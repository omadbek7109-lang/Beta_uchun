/**
 * DAMEO BETA — the Shop without a backend, on TEST data only.
 * The catalog (fixtures/shopCatalog.json) is generated from the real migrations — the same items, prices,
 * editions and artwork as the main app — but purchases, serials and equipped skins live on this device and
 * are paid with TEST coins (demoWallet). Server rules are kept: one copy per item, limited editions get the
 * next serial and sell out, insufficient balance is refused, a retried purchase key is charged once.
 */
import fixture from './fixtures/shopCatalog.ts';
import { NY_CATEGORY, NY_ITEMS } from './newYear.ts';
import { demoWalletApply } from './demoWallet.ts';
import { readJSON, writeJSON } from './localStore.ts';
import { SbError } from './supabase.ts';
import type { BoardStock, Catalog, CoinPackage, Collection, Cosmetic, Pricing, ShopItem } from './shop.ts';
import type { Slot } from './skins.ts';

const KEY = 'dameobeta.shop.v1';
interface Owned {
  serial: number | null;
  at: string;
  /** given by DAMEO Pass (a reward or a chest), not bought */
  pass?: boolean;
}
interface State {
  owned: Record<string, Owned>;
  equipped: { piece: string | null; board: string | null; effect: string | null };
  keys: Record<string, string>;
  public: boolean;
}
const load = (): State => ({ owned: {}, equipped: { piece: null, board: null, effect: null }, keys: {}, public: true, ...readJSON<Partial<State>>(KEY, {}) });
const save = (s: State) => writeJSON(KEY, s);

const F = fixture as unknown as {
  catalog: Catalog;
  stones: BoardStock[];
  boards: BoardStock[];
  packages: CoinPackage[];
  pricing: Pricing;
};
/** Profile frames need the server (they are tied to the public profile), so the beta shop leaves that tab out. */
/** The New Year collection (beta test, free) comes first, so it is the tab the Shop opens on. */
const CATEGORIES = [NY_CATEGORY, ...F.catalog.categories.filter((c) => c.id !== 'frames')];
const ALL_ITEMS = [...NY_ITEMS, ...F.catalog.items];
const items = () => ALL_ITEMS;
const find = (slug: string) => items().find((i) => i.slug === slug);
const limitedBase = (slug: string) => [...F.stones, ...F.boards].find((s) => s.slug === slug && s.supply !== null);

function stockView(list: BoardStock[], s: State): BoardStock[] {
  return list.map((b) => {
    const mine = s.owned[b.slug];
    const sold = b.sold + (mine ? 1 : 0);
    return {
      ...b,
      sold,
      remaining: b.supply === null ? null : Math.max(0, b.supply - sold),
      sold_out: b.supply !== null && sold >= b.supply,
      mine: mine ? { serial: mine.serial ?? sold, acquired_at: mine.at } : null,
    };
  });
}

export function demoCatalog(): Catalog {
  const s = load();
  return {
    categories: CATEGORIES,
    items: items().map((i) => ({ ...i, owned: i.is_free || !!s.owned[i.slug] })),
    equipped: { ...s.equipped },
  };
}

export async function demoBuy(slug: string, key: string): Promise<{ ok: boolean; balance: number; duplicate?: boolean; serial?: number; supply?: number | null }> {
  const s = load();
  const item = find(slug) as ShopItem | undefined;
  if (!item || item.retired) throw new SbError('item not on sale', 400);
  if (s.keys[key] === slug) return { ok: true, balance: demoWalletApply(0, 'purchase', 'shop', slug, null, `buy:${key}`), duplicate: true };
  if (item.is_free || s.owned[slug]) throw new SbError('already owned', 409);
  const lim = limitedBase(slug);
  let serial: number | null = null;
  if (lim) {
    const sold = lim.sold;
    if (lim.supply !== null && sold >= lim.supply) throw new SbError('sold out', 409);
    serial = sold + 1;
  }
  let balance: number;
  try {
    balance = demoWalletApply(-item.final_price, 'purchase', 'shop', slug, item.name_en, `buy:${key}`);
  } catch {
    throw new SbError('insufficient funds', 402);
  }
  s.owned[slug] = { serial, at: new Date().toISOString() };
  s.keys[key] = slug;
  save(s);
  return { ok: true, balance, serial: serial ?? undefined, supply: lim?.supply ?? null };
}

export async function demoEquip(slot: Slot, slug: string | null): Promise<{ ok: boolean }> {
  const s = load();
  if (slug) {
    const it = find(slug);
    if (!it || it.slot !== slot) throw new SbError('wrong slot', 400);
    if (!it.is_free && !s.owned[slug]) throw new SbError('not owned', 403);
  }
  s.equipped[slot] = slug;
  save(s);
  return { ok: true };
}

export const DEMO_ME = 'demo-me';
export function demoCosmetics(userId: string): { piece: Cosmetic | null; board: Cosmetic | null; effect: Cosmetic | null } | null {
  if (userId !== DEMO_ME) return null; // other players have no beta loadout
  const s = load();
  const pick = (slug: string | null) => {
    const it = slug ? find(slug) : undefined;
    return it ? { slug: it.slug, style: it.style } : null;
  };
  return { piece: pick(s.equipped.piece), board: pick(s.equipped.board), effect: pick(s.equipped.effect) };
}

export const demoStock = (slot: 'board' | 'piece') => stockView(slot === 'piece' ? F.stones : F.boards, load());
export const demoPackages = () => F.packages;
export const demoPricing = () => F.pricing;

export function demoCollection(): Collection {
  const s = load();
  const all = [...F.boards];
  const mine = stockView(all, s).filter((b) => b.mine);
  return {
    visible: true,
    public: s.public,
    mine: true,
    owner: DEMO_ME,
    total: all.length,
    owned: mine.length,
    limited: mine.filter((b) => b.supply !== null).length,
    complete_pct: Math.round((mine.length / all.length) * 100),
    items: mine.map((b) => ({
      id: b.slug,
      slug: b.slug,
      serial: b.mine!.serial,
      supply: b.supply,
      acquired_at: b.mine!.acquired_at,
      tier: b.tier,
      icon: b.icon,
      rarity: b.rarity,
      name_uz: b.name_uz,
      name_en: b.name_en,
      image_url: b.image_url,
      style: find(b.slug)?.style ?? null,
    })),
  };
}
export function demoSetPublic(on: boolean) {
  const s = load();
  s.public = on;
  save(s);
  return { ok: true };
}

/** Beta top-up: credits the package's TEST coins at once (no Telegram Stars are charged). */
export function demoTopUp(packageId: string) {
  const p = F.packages.find((x) => x.id === packageId);
  if (!p) return { ok: false, error: 'server' };
  demoWalletApply(p.coins + p.bonus_coins, 'topup', 'beta', p.id, 'beta_topup', `topup:${p.id}:${Date.now()}`);
  return { ok: true, test: true };
}

/** Beta: is this shop item already mine (free items count as owned)? */
export function demoOwns(slug: string): boolean {
  const it = find(slug);
  return !!it && (it.is_free || !!load().owned[slug]);
}
/** Beta: gives an item for free (DAMEO Pass reward). Non-limited items only; false if unknown or already owned. */
export function demoGrant(slug: string): boolean {
  const s = load();
  const it = find(slug);
  if (!it || it.is_free || s.owned[slug] || limitedBase(slug)) return false;
  s.owned[slug] = { serial: null, at: new Date().toISOString(), pass: true };
  save(s);
  return true;
}
/** Beta "reset the season": takes back everything DAMEO Pass gave (bought items stay). Returns the slots that were unequipped. */
export function demoRevokePass(): Slot[] {
  const s = load();
  const freed: Slot[] = [];
  const bought = new Set(Object.values(s.keys)); // purchases keep their idempotency key → slug
  for (const [slug, o] of Object.entries(s.owned)) {
    // given by the Pass: flagged, a Pass-only item, or (older grants, before the flag) never bought
    if (!o.pass && find(slug)?.collection !== 'pass' && bought.has(slug)) continue;
    delete s.owned[slug];
    for (const slot of ['piece', 'board', 'effect'] as Slot[]) {
      if (s.equipped[slot] === slug) {
        s.equipped[slot] = null;
        freed.push(slot);
      }
    }
  }
  save(s);
  return freed;
}

/** Name of a shop item (for messages such as "from the chest: …"). */
export function demoItemName(slug: string, lang: 'uz' | 'en' = 'uz'): string {
  const it = find(slug);
  return it ? (lang === 'en' ? it.name_en : it.name_uz) : slug;
}
