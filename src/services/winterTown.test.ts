import { describe, expect, test } from 'bun:test';
import { TOWN_STAGES, currentStage, mySnow, roadProgress, stageOpen, topBuilders } from './winterTown.ts';
import type { MatchSummary, Player } from '../types/models.ts';

const m = (result: MatchSummary['result']): MatchSummary => ({ id: Math.random().toString(), ts: Date.now(), opponent: 'x', mode: 'online', result, delta: 0, rated: true, moves: 30 });

describe('Qishki shahar', () => {
  test('snow: win 2, draw 1, loss 1', () => {
    expect(mySnow([m('win'), m('win'), m('draw'), m('loss')])).toBe(6);
  });
  test('stages open in order; the road ends at 1', () => {
    const goals = TOWN_STAGES.map((s) => s.goal);
    expect([...goals].sort((a, b) => a - b)).toEqual(goals);
    expect(stageOpen(TOWN_STAGES[0], goals[0] - 1)).toBe(false);
    expect(stageOpen(TOWN_STAGES[0], goals[0])).toBe(true);
    expect(currentStage(goals[1])?.n).toBe(3);
    expect(currentStage(goals[4])).toBeNull();
    expect(roadProgress(0)).toBe(0);
    expect(roadProgress(goals[4])).toBe(1);
    expect(roadProgress(goals[2])).toBeCloseTo(0.5, 5);
  });
  test('top builders: sorted, the player found', () => {
    const players = Array.from({ length: 20 }, (_, i) => ({ id: `demo-${i}`, username: `p${i}`, avatar: null }) as unknown as Player);
    const { top, myPlace } = topBuilders(players, { id: 'me', username: 'Me' }, 99_999);
    expect(top.length).toBe(10);
    expect(top[0].me).toBe(true);
    expect(myPlace).toBe(1);
    for (let i = 1; i < top.length; i++) expect(top[i - 1].snow).toBeGreaterThanOrEqual(top[i].snow);
  });
});

import { TOWN_LAYOUT, TOWN_SLOTS, townScale, townScene } from './winterTown.ts';
describe('Qishki shahar — xarita', () => {
  test('har ochiq bosqich binolari chiziladi, orqadan oldinga', () => {
    const all = Object.values(TOWN_LAYOUT).reduce((n, l) => n + l.length, 0);
    const sc = townScene(99_999, { 0: 'snowman', 3: 'pine' });
    expect(sc.length).toBe(all + 2);
    for (let i = 1; i < sc.length; i++) expect(sc[i].z).toBeGreaterThanOrEqual(sc[i - 1].z);
    expect(townScene(0, {}).length).toBe(0);
    expect(townScene(2_000, {}).length).toBe(TOWN_LAYOUT[1].length);
  });
  test('uzoq joy kichikroq, joylar xarita ichida', () => {
    expect(townScale(300)).toBeLessThan(townScale(600));
    for (const [x, y] of TOWN_SLOTS) expect(x > 0 && x < 1774 && y > 0 && y < 887).toBe(true);
  });
});
