/**
 * DAMEO BETA — Winter City catalog. Every object is a separate sprite (public/town/<sprite>.webp, cut from the
 * art sheet) standing on a footprint of map tiles. Prices are in DAMEO Coin; in main DAMEO the server owns them.
 */
export type CityCat = 'houses' | 'nature' | 'decor' | 'roads' | 'special' | 'limited';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
/** where an object may stand: land = free ground, park = parks + land, plaza = the central square + land, river = across water */
export type Ground = 'land' | 'park' | 'plaza' | 'river';

export interface CityAsset {
  id: string;
  /** sprite file; roads have none (drawn as ground) */
  sprite?: string;
  cat: Exclude<CityCat, 'limited'>;
  price: number;
  rarity: Rarity;
  /** footprint in tiles */
  w: number;
  h: number;
  /** sprite width = footprint width × scale */
  scale: number;
  /** city XP the first time it is built */
  xp: number;
  ground: Ground[];
  /** sold only while the New Year event runs */
  limited?: boolean;
  /** road surface (roads only) */
  road?: 'plain' | 'stone' | 'ice' | 'round';
  /** warm light: windows / lamp / tree lights (for the evening glow) */
  glow?: 'windows' | 'lamp' | 'tree' | 'fire' | 'ice';
}

const L: Ground[] = ['land'];
const LP: Ground[] = ['land', 'park', 'plaza'];
const PL: Ground[] = ['land', 'plaza'];

export const CITY_ASSETS: CityAsset[] = [
  // A. Houses
  { id: 'house1', sprite: 'house1', cat: 'houses', price: 300, rarity: 'common', w: 2, h: 2, scale: 1.12, xp: 30, ground: L, glow: 'windows' },
  { id: 'house3', sprite: 'house3', cat: 'houses', price: 380, rarity: 'common', w: 2, h: 2, scale: 1.08, xp: 35, ground: L, glow: 'windows' },
  { id: 'house2', sprite: 'house2', cat: 'houses', price: 450, rarity: 'rare', w: 2, h: 2, scale: 1.14, xp: 45, ground: L, glow: 'windows' },
  { id: 'lodge', sprite: 'lodge', cat: 'houses', price: 700, rarity: 'rare', w: 3, h: 2, scale: 0.98, xp: 70, ground: L, glow: 'windows' },
  { id: 'market', sprite: 'market', cat: 'houses', price: 520, rarity: 'rare', w: 3, h: 2, scale: 0.86, xp: 50, ground: PL, glow: 'windows' },
  { id: 'clock', sprite: 'clock', cat: 'houses', price: 1_100, rarity: 'epic', w: 2, h: 2, scale: 1.05, xp: 110, ground: PL, glow: 'windows', limited: true },
  { id: 'hall', sprite: 'hall', cat: 'houses', price: 1_800, rarity: 'legendary', w: 3, h: 3, scale: 1.25, xp: 200, ground: PL, glow: 'windows' },
  // B. Trees & nature
  { id: 'pine', sprite: 'pine', cat: 'nature', price: 40, rarity: 'common', w: 1, h: 1, scale: 1.25, xp: 4, ground: LP },
  { id: 'tree_lit', sprite: 'tree_lit', cat: 'nature', price: 90, rarity: 'common', w: 1, h: 1, scale: 1.3, xp: 8, ground: LP, glow: 'tree' },
  { id: 'tree_dec', sprite: 'tree_dec', cat: 'nature', price: 120, rarity: 'rare', w: 1, h: 1, scale: 1.3, xp: 12, ground: LP, glow: 'tree' },
  { id: 'xmas', sprite: 'xmas', cat: 'nature', price: 600, rarity: 'epic', w: 2, h: 2, scale: 1.2, xp: 60, ground: LP, glow: 'tree', limited: true },
  { id: 'hedge_box', sprite: 'hedge_box', cat: 'nature', price: 50, rarity: 'common', w: 1, h: 1, scale: 1.05, xp: 5, ground: LP },
  { id: 'hedge_lit', sprite: 'hedge_lit', cat: 'nature', price: 80, rarity: 'common', w: 2, h: 1, scale: 1, xp: 8, ground: LP, glow: 'lamp' },
  { id: 'berry', sprite: 'berry', cat: 'nature', price: 30, rarity: 'common', w: 1, h: 1, scale: 0.95, xp: 3, ground: LP },
  { id: 'rocks', sprite: 'rocks', cat: 'nature', price: 30, rarity: 'common', w: 1, h: 1, scale: 1.1, xp: 3, ground: LP },
  // C. Decorations
  { id: 'snowman', sprite: 'snowman', cat: 'decor', price: 80, rarity: 'common', w: 1, h: 1, scale: 0.85, xp: 8, ground: LP },
  { id: 'bench', sprite: 'bench', cat: 'decor', price: 50, rarity: 'common', w: 1, h: 1, scale: 1.05, xp: 5, ground: LP },
  { id: 'lamp', sprite: 'lamp', cat: 'decor', price: 60, rarity: 'common', w: 1, h: 1, scale: 0.42, xp: 6, ground: LP, glow: 'lamp' },
  { id: 'lantern', sprite: 'lantern', cat: 'decor', price: 70, rarity: 'common', w: 1, h: 1, scale: 0.7, xp: 7, ground: LP, glow: 'lamp' },
  { id: 'banner', sprite: 'banner', cat: 'decor', price: 90, rarity: 'rare', w: 1, h: 1, scale: 0.95, xp: 9, ground: LP },
  { id: 'sign', sprite: 'sign', cat: 'decor', price: 40, rarity: 'common', w: 1, h: 1, scale: 0.6, xp: 4, ground: LP },
  { id: 'fence', sprite: 'fence', cat: 'decor', price: 40, rarity: 'common', w: 2, h: 1, scale: 0.95, xp: 4, ground: LP },
  { id: 'iron_fence', sprite: 'iron_fence', cat: 'decor', price: 90, rarity: 'rare', w: 2, h: 1, scale: 1.05, xp: 9, ground: LP, glow: 'lamp' },
  { id: 'lights_rope', sprite: 'lights_rope', cat: 'decor', price: 70, rarity: 'common', w: 2, h: 1, scale: 0.95, xp: 7, ground: LP, glow: 'lamp' },
  { id: 'lights_post', sprite: 'lights_post', cat: 'decor', price: 80, rarity: 'common', w: 2, h: 1, scale: 0.95, xp: 8, ground: LP, glow: 'lamp' },
  { id: 'arch_lit', sprite: 'arch_lit', cat: 'decor', price: 160, rarity: 'rare', w: 2, h: 1, scale: 1.1, xp: 16, ground: LP, glow: 'lamp' },
  // D. Roads (ground surface; 1×1 except the roundabout)
  { id: 'road_plain', cat: 'roads', price: 10, rarity: 'common', w: 1, h: 1, scale: 1, xp: 1, ground: ['land', 'park'], road: 'plain' },
  { id: 'road_stone', cat: 'roads', price: 15, rarity: 'common', w: 1, h: 1, scale: 1, xp: 1, ground: ['land', 'park'], road: 'stone' },
  { id: 'road_ice', cat: 'roads', price: 20, rarity: 'rare', w: 1, h: 1, scale: 1, xp: 2, ground: ['land', 'park'], road: 'ice' },
  { id: 'road_round', cat: 'roads', price: 150, rarity: 'rare', w: 3, h: 3, scale: 1, xp: 12, ground: ['land', 'park'], road: 'round' },
  { id: 'bridge_wood', sprite: 'bridge_wood', cat: 'roads', price: 400, rarity: 'rare', w: 4, h: 1, scale: 1.05, xp: 40, ground: ['river'], glow: 'lamp' },
  { id: 'bridge_stone', sprite: 'bridge_stone', cat: 'roads', price: 650, rarity: 'epic', w: 4, h: 1, scale: 1.08, xp: 60, ground: ['river'], glow: 'lamp' },
  // E. Special buildings
  { id: 'rink', sprite: 'rink', cat: 'special', price: 1_400, rarity: 'epic', w: 4, h: 3, scale: 1.05, xp: 140, ground: PL, glow: 'ice' },
  { id: 'fountain', sprite: 'fountain', cat: 'special', price: 650, rarity: 'rare', w: 2, h: 2, scale: 1.15, xp: 65, ground: LP, glow: 'ice' },
  { id: 'gazebo', sprite: 'gazebo', cat: 'special', price: 550, rarity: 'rare', w: 2, h: 2, scale: 1.1, xp: 55, ground: LP, glow: 'lamp' },
  { id: 'fire', sprite: 'fire', cat: 'special', price: 150, rarity: 'rare', w: 1, h: 1, scale: 1.05, xp: 15, ground: LP, glow: 'fire' },
  { id: 'arch_d', sprite: 'arch_d', cat: 'special', price: 480, rarity: 'epic', w: 2, h: 1, scale: 1.2, xp: 48, ground: LP, glow: 'lamp', limited: true },
  { id: 'flake', sprite: 'flake', cat: 'special', price: 220, rarity: 'legendary', w: 1, h: 1, scale: 0.8, xp: 22, ground: LP, glow: 'lamp', limited: true },
];
export const ASSET: Record<string, CityAsset> = Object.fromEntries(CITY_ASSETS.map((a) => [a.id, a]));
export const CITY_CATS: CityCat[] = ['houses', 'nature', 'decor', 'roads', 'special', 'limited'];
export const inCat = (a: CityAsset, c: CityCat) => (c === 'limited' ? !!a.limited : a.cat === c);
export const isHouse = (a: CityAsset) => a.cat === 'houses';
export const SPRITES = [...new Set(CITY_ASSETS.map((a) => a.sprite).filter(Boolean) as string[])];
