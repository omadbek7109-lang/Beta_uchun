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
      fi: [0.1387, 0.1543, 0.865, 0.8574],
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
      fi: [0.1286, 0.1439, 0.8568, 0.8626],
      amb: 'ice',
    },
  },
  {
    ...base,
    slug: 'ny-aurora-board',
    slot: 'board',
    name_uz: 'Shimol Qiroli',
    name_en: 'Northern King',
    desc_uz: "Premium: oltin-binafsha ramka, muz, toj, qalqonlar va bo'rilar. Chiroqlar lipillaydi, tepada shimol yog'dusi jilolanadi.",
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
      fi: [0.1164, 0.1268, 0.886, 0.8923],
      amb: 'aurora',
    },
  },
  {
    ...base,
    slug: 'ny-snow-stone',
    slot: 'piece',
    name_uz: 'Qorli Donacha',
    name_en: 'Snow Stone',
    desc_uz: "Muzdan yasalgan donachalar: oqi — qirovli, qorasi — chuqur ko'k muz; shohlari tojli va dafna gulchambarli. Yurganda qor izi qoladi, urilganda muz bo'lib sochiladi.",
    desc_en: 'Stones made of ice: frosted white and deep-blue ice. They leave a snow trail and shatter into ice when taken.',
    rarity: 'rare',
    image_url: 'stones/ny-snow-stone.webp',
    style: {
      w: { tex: 'ny-snow-stone-w', ktex: 'ny-snow-stone-wk', ring: '#a9c2ea', crown: '#2f6fe0', glow: 'rgba(150,210,255,.35)' },
      b: { tex: 'ny-snow-stone-b', ktex: 'ny-snow-stone-bk', ring: '#8fd0ff', crown: '#eaf6ff', glow: 'rgba(70,150,255,.45)' },
    },
  },
  {
    ...base,
    slug: 'ny-gift-stone',
    slot: 'piece',
    name_uz: 'Yangi Yil Donachasi',
    name_en: 'New Year Stone',
    desc_uz: "Premium: oq-oltin va qizil-oltin donachalar; shohlari oltin tojli. Oltin yaltiraydi, urilganda oltin-qizil yulduzchalar sochiladi.",
    desc_en: 'Premium: white-gold and red-gold stones. The gold gleams; taken stones burst into gold and red stars.',
    rarity: 'legendary',
    image_url: 'stones/ny-gift-stone.webp',
    style: {
      w: { tex: 'ny-gift-stone-w', ktex: 'ny-gift-stone-wk', ring: '#e0b44a', crown: '#c8102e', glow: 'rgba(255,215,120,.35)' },
      b: { tex: 'ny-gift-stone-b', ktex: 'ny-gift-stone-bk', ring: '#d9a23a', crown: '#ffe08a', glow: 'rgba(255,90,70,.4)' },
    },
  },
  {
    ...base,
    slug: 'ny-fx-snow',
    slot: 'effect',
    name_uz: 'Qorli Yurish',
    name_en: 'Snowy Move',
    desc_uz: "Tanlangan katak yonadi, yo'l kataklarida qor parchalari paydo bo'ladi, orqada qor izi qoladi.",
    desc_en: 'The chosen square lights up, snowflakes appear on the path squares and a snow trail follows the piece.',
    rarity: 'rare',
    image_url: 'boards/ny-fx-snow.webp',
    style: { fx: 'frost', color: '#4c9bff' },
  },
  {
    ...base,
    slug: 'ny-fx-snow-prem',
    slot: 'effect',
    name_uz: 'Qorli Yurish · Premium',
    name_en: 'Snowy Move · Premium',
    desc_uz: "Premium: strelkali muz halqa, qor parchali yo'l, to'lqinsimon muz izi va tushganda muz kristallari otilib chiqadi.",
    desc_en: 'Premium: an ice ring with arrows, a snowflake path, a wavy frost ribbon and ice crystals bursting up on landing.',
    rarity: 'legendary',
    image_url: 'boards/ny-fx-snow-prem.webp',
    style: { fx: 'frostp', color: '#3d7dff' },
  },
];

/** New Year avatar frames (from the owner's "Yangi Yil Ramkalari" sheet). Beta: owned by everyone, worn from the Shop
 * (New Year tab) or DAMEO Pass → My style. Art: public/pass/frame-ny-*.webp; the photo fills the frame's hole. */
export interface NyFrame {
  id: string;
  name_uz: string;
  name_en: string;
  tier: 'free' | 'premium' | 'limited';
}
export const NY_FRAMES: NyFrame[] = [
  { id: 'f-ny-snow', name_uz: 'Qorli', name_en: 'Snowy', tier: 'free' },
  { id: 'f-ny-tale', name_uz: 'Qish Ertagi', name_en: 'Winter Tale', tier: 'premium' },
  { id: 'f-ny-cabin', name_uz: 'Qishki Uycha', name_en: 'Winter Cabin', tier: 'premium' },
  { id: 'f-ny-gifts', name_uz: 'Yangi Yil', name_en: 'New Year', tier: 'premium' },
  { id: 'f-ny-crystal', name_uz: 'Muz Kristallari', name_en: 'Ice Crystals', tier: 'premium' },
  { id: 'f-ny-aurora', name_uz: 'Shimoliy Nur', name_en: 'Northern Lights', tier: 'premium' },
  { id: 'f-ny-royal', name_uz: 'Qirollik', name_en: 'Royal', tier: 'limited' },
  { id: 'f-ny-dragon', name_uz: "Bo'ron", name_en: 'Blizzard', tier: 'limited' },
];

/** Other New Year cosmetics owned in the beta (not DAMEO Pass rewards): names for the inventory. */
export const NY_COSMETICS: Record<string, { uz: string; en: string; note_uz: string; note_en: string }> = {
  'cb-ice': {
    uz: 'Premium Combo · Muz',
    en: 'Premium Combo · Ice',
    note_uz: "Bir yurishda 2+ tosh ursangiz: muz yoylar, qor parchali kataklar, muz kristallari; 2x · 3x · 4x",
    note_en: 'Capture 2+ in one move: ice arcs, snowflake squares, ice crystals; 2x · 3x · 4x',
  },
};
