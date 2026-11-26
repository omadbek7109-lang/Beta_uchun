import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { NY_CATEGORY, NY_FRAMES, NY_ITEMS } from './newYear.ts';
import { COSMETIC_ART, FRAME_FIT, FRAME_MASK } from './pass/core.ts';
import { ambientCss } from './boardAmbient.ts';
import { fxOf, skinCss, type BoardStyle, type PieceStyle } from './skins.ts';
import { stoneMat } from './stoneMaterials.ts';
import { demoCatalog, demoEquip } from './demoShop.ts';

describe('New Year collection (beta)', () => {
  test('3 boards, 2 stone sets, 2 move effects and 8 frames, all free and in their own tab', () => {
    expect(NY_ITEMS.filter((i) => i.slot === 'board').length).toBe(3);
    expect(NY_ITEMS.filter((i) => i.slot === 'piece').length).toBe(2);
    expect(NY_ITEMS.filter((i) => i.slot === 'effect').length).toBe(2);
    expect(NY_FRAMES.length).toBe(8);
    for (const i of NY_ITEMS) {
      expect(i.is_free).toBe(true);
      expect(i.category_id).toBe(NY_CATEGORY.id);
    }
  });
  test('every artwork file exists', () => {
    for (const i of NY_ITEMS) {
      expect(existsSync(`public/${i.image_url}`)).toBe(true);
      if (i.slot === 'board') {
        const st = i.style as BoardStyle;
        for (const f of [st.lt, st.dt, st.fr, i.image_url!.replace(/^boards\//, '').replace(/\.webp$/, '-sm')]) expect(existsSync(`public/boards/${f}.webp`)).toBe(true);
      } else if (i.slot === 'piece') {
        const st = i.style as PieceStyle;
        for (const f of [st.w.tex, st.b.tex, st.w.ktex, st.b.ktex]) expect(existsSync(`public/stones/${f}.webp`)).toBe(true);
      }
    }
    for (const f of NY_FRAMES) {
      expect(existsSync(`public/${COSMETIC_ART[f.id]}`)).toBe(true);
      expect(existsSync(`public/${FRAME_MASK[f.id]}`)).toBe(true);
      expect(FRAME_FIT[f.id]).toBeDefined();
    }
    for (const f of ['ny-snow-far', 'ny-snow-near']) expect(existsSync(`public/boards/${f}.webp`)).toBe(true);
  });
  test('boards: frame, textures and ambience in the CSS; stones: their own motion material', () => {
    for (const i of NY_ITEMS) {
      const css = skinCss({ slug: i.slug, slot: i.slot, style: i.style });
      if (i.slot === 'board') {
        expect(css).toContain(`${(i.style as BoardStyle).fr}.webp`);
        expect(css).toContain('.bfx-1::before');
        expect(css).toContain('ny-snow-near.webp');
      } else if (i.slot === 'effect') {
        expect(fxOf(i.style)).toMatch(/^frost/);
      } else {
        expect(stoneMat(i.slug, undefined)).not.toBeNull();
        expect(css).toContain('.mv-trail-w');
        expect(css).toContain('.piece-gone .shard');
      }
    }
  });
  test('ambience: unknown kinds give nothing (styles come from data)', () => {
    expect(ambientCss('sk-b-x', 'snow;}body{display:none')).toBe('');
    expect(ambientCss('sk-b-x', undefined)).toBe('');
    expect(ambientCss('sk-b-x', 'aurora')).toContain('ny-aurora');
  });
  test('beta shop: the tab comes first, the items are owned and can be equipped', async () => {
    const c = demoCatalog();
    expect(c.categories[0].id).toBe('newyear');
    for (const i of NY_ITEMS) expect(c.items.find((x) => x.slug === i.slug)?.owned).toBe(true);
    expect((await demoEquip('board', 'ny-aurora-board')).ok).toBe(true);
    expect((await demoEquip('piece', 'ny-gift-stone')).ok).toBe(true);
  });
});
