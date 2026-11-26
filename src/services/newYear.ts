/**
 * DAMEO BETA — New Year collection (DAMEO Pass season 2 concepts), FREE for testing.
 * Three boards and two stone sets built from the owner's concept art (tools/ny_art/): the boards' frames, square
 * textures and the stones' faces live in public/boards/ny-* and public/stones/ny-*. Each board also has an ambient
 * layer (falling snow, lanterns, aurora — see boardAmbient.ts) and each stone set its own motion material
 * (stoneMaterials.ts: frost / festive). Beta only: the items exist in the on-device test shop, not on any server.
 */
import type { ShopCategory, ShopItem } from './shop.ts';

export const NY_CATEGORY: ShopCategory = { id: 'newyear', name_uz: '🎄 Yangi yil', name_en: '🎄 New Year' };

const base = {
  category_id: 'newyear',
  collection: 'newyear',
  price: 0,
  final_price: 0,
  discount_percent: 0,
  is_free: true, // beta test: everyone owns them, so they can be equipped and tried in a game at once
  is_default: false,
  retired: false,
  premium_only: false,
  owned: true,
} as const;

export const NY_ITEMS: ShopItem[] = [
  {
    ...base,
    slug: 'ny-frost-board',
    slot: 'board',
    name_uz: 'Qorli Taxta',
    name_en: 'Snowy Board',
    desc_uz: "Qor bosgan yog'och ramka, muz kataklar, chiroqlar va archa shoxchalari. Ustidan qor yog'ib turadi.",
    desc_en: 'Snow-covered wooden frame, ice squares, lanterns and holly. Snow keeps falling over it.',
    rarity: 'rare',
    image_url: 'boards/ny-frost.webp',
    style: {
      light: '#e2e9f9',
      dark: '#27499e',
      edge: '#4a3646',
      edge2: '#9d8698',
      hl: '#ffcf6b',
      coord: '#dfe8ff',
      lt: 'ny-frost-l',
      dt: 'ny-frost-d',
      fr: 'ny-frost-frame',
      fi: [0.0898, 0.0977, 0.9102, 0.918],
      amb: 'frost',
    },
  },
  {
    ...base,
    slug: 'ny-ice-board',
    slot: 'board',
    name_uz: 'Yangi Yil Taxtasi',
    name_en: 'New Year Board',
    desc_uz: "Kumush-muz ramka, burchaklarda porlab turgan qor parchalari, archa va tog' naqshlari.",
    desc_en: 'Silver-ice frame with glowing snowflakes in the corners, engraved pines and mountains.',
    rarity: 'epic',
    image_url: 'boards/ny-ice.webp',
    style: {
      light: '#e7edf7',
      dark: '#1d4598',
      edge: '#5d677b',
      edge2: '#c9d1df',
      hl: '#7cc8ff',
      coord: '#d9ecff',
      lt: 'ny-ice-l',
      dt: 'ny-ice-d',
      fr: 'ny-ice-frame',
      fi: [0.0859, 0.0859, 0.9141, 0.9141],
      amb: 'ice',
    },
  },
  {
    ...base,
    slug: 'ny-aurora-board',
    slot: 'board',
    name_uz: 'Shimol Qiroli',
    name_en: 'Northern King',
    desc_uz: "Premium: oltin-binafsha ramka, muz kristallari, toj va qalqonlar. Tepada shimol yog'dusi jilolanadi.",
    desc_en: 'Premium: gold and violet frame, ice crystals, crown and shields. Northern lights shimmer above it.',
    rarity: 'mythic',
    image_url: 'boards/ny-aurora.webp',
    style: {
      light: '#e7e6fb',
      dark: '#2a2894',
      edge: '#3a1680',
      edge2: '#e0a52c',
      hl: '#ffd772',
      coord: '#e6e2ff',
      lt: 'ny-aurora-l',
      dt: 'ny-aurora-d',
      fr: 'ny-aurora-frame',
      fi: [0.1094, 0.1406, 0.8906, 0.9219],
      amb: 'aurora',
    },
  },
  {
    ...base,
    slug: 'ny-snow-stone',
    slot: 'piece',
    name_uz: 'Qorli Donacha',
    name_en: 'Snow Stone',
    desc_uz: "Muzdan yasalgan donachalar: oqi — qirovli, qorasi — chuqur ko'k muz. Yurganda qor izi qoladi, urilganda muz bo'lib sochiladi.",
    desc_en: 'Stones made of ice: frosted white and deep-blue ice. They leave a snow trail and shatter into ice when taken.',
    rarity: 'rare',
    image_url: 'stones/ny-snow-stone.webp',
    style: {
      w: { tex: 'ny-snow-stone-w', ring: '#a9c2ea', crown: '#2f6fe0', glow: 'rgba(150,210,255,.35)' },
      b: { tex: 'ny-snow-stone-b', ring: '#8fd0ff', crown: '#eaf6ff', glow: 'rgba(70,150,255,.45)' },
    },
  },
  {
    ...base,
    slug: 'ny-gift-stone',
    slot: 'piece',
    name_uz: 'Yangi Yil Donachasi',
    name_en: 'New Year Stone',
    desc_uz: "Premium: oq-oltin va qizil-oltin donachalar. Oltin yaltiraydi, urilganda oltin-qizil yulduzchalar sochiladi.",
    desc_en: 'Premium: white-gold and red-gold stones. The gold gleams; taken stones burst into gold and red stars.',
    rarity: 'legendary',
    image_url: 'stones/ny-gift-stone.webp',
    style: {
      w: { tex: 'ny-gift-stone-w', ring: '#e0b44a', crown: '#c8102e', glow: 'rgba(255,215,120,.35)' },
      b: { tex: 'ny-gift-stone-b', ring: '#d9a23a', crown: '#ffe08a', glow: 'rgba(255,90,70,.4)' },
    },
  },
];

/** New Year avatar frames (from the owner's "Yangi Yil Ramkalari" sheet). Beta: owned by everyone, worn from the Shop
 * (New Year tab) or DAMEO Pass → My style. Art: public/pass/frame-ny-*.webp; the photo fills the frame's hole. */
export interface NyFrame {
  id: string;
  name_uz: string;
  name_en: string;
  tier: 'free' | 'premium';
}
export const NY_FRAMES: NyFrame[] = [
  { id: 'f-ny-snow', name_uz: 'Qorli', name_en: 'Snowy', tier: 'free' },
  { id: 'f-ny-tale', name_uz: 'Qish Ertagi', name_en: 'Winter Tale', tier: 'premium' },
  { id: 'f-ny-cabin', name_uz: 'Qishki Uycha', name_en: 'Winter Cabin', tier: 'premium' },
  { id: 'f-ny-gifts', name_uz: 'Yangi Yil', name_en: 'New Year', tier: 'premium' },
  { id: 'f-ny-crystal', name_uz: 'Muz Kristallari', name_en: 'Ice Crystals', tier: 'premium' },
  { id: 'f-ny-aurora', name_uz: 'Shimoliy Nur', name_en: 'Northern Lights', tier: 'premium' },
];
