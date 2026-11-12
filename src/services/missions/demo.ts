/**
 * Beta / demo adapter for Daily Missions — no backend, TEST DATA ONLY.
 * Plays the server's role with the same rules (core.ts): progress is derived from this device's finished
 * games (local profile) plus beta test events, claims are validated here and paid in TEST coins that never
 * leave the device. Storage: localStorage 'dameobeta.missions.v1' (separate from the main DAMEO app).
 */
import type { MatchSummary } from '../../types/models.ts';
import { demoBalance, demoWalletApply } from '../demoWallet.ts';
import { loadLocal } from '../localProfile.ts';
import { readJSON, writeJSON } from '../localStore.ts';
import {
  DEFAULT_DEFS,
  DEFAULT_SETTINGS,
  buildBoard,
  checkClaim,
  tashkentDay,
  validateConfig,
  type ClaimCheck,
  type DayActivity,
  type DefsError,
  type FinishedGame,
  type MissionBoard,
  type MissionDef,
  type MissionSettings,
} from './core.ts';

const KEY = 'dameobeta.missions.v1';
interface TestDay {
  referrals: number;
  puzzles: number;
  games: FinishedGame[];
}
interface DemoState {
  defs: MissionDef[];
  settings: MissionSettings;
  /** day → slug → coins paid */
  claims: Record<string, Record<string, number>>;
  balance: number;
  test: Record<string, TestDay>;
}

function load(): DemoState {
  const s = readJSON<Partial<DemoState> | null>(KEY, null) ?? {};
  return {
    defs: s.defs?.length ? s.defs : DEFAULT_DEFS.map((d) => ({ ...d })),
    settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}) },
    claims: s.claims ?? {},
    balance: s.balance ?? 0,
    test: s.test ?? {},
  };
}
const save = (s: DemoState) => {
  // keep only the last 7 days of claims / test data
  const keep = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => b.localeCompare(a)).slice(0, 7));
  writeJSON(KEY, { ...s, claims: keep(s.claims), test: keep(s.test) });
};

const fromLocal = (m: MatchSummary): FinishedGame | null => {
  if (m.mode === 'practice' || m.mode === 'local') return null; // never recorded by the server either
  return {
    ts: m.ts,
    rated: m.rated,
    outcome: m.result,
    moves: m.moves ?? 0,
    vsBot: m.mode === 'bot',
    botLevel: m.mode === 'bot' ? ((m.difficulty as FinishedGame['botLevel']) ?? null) : null,
  };
};

function activity(s: DemoState, day: string): DayActivity {
  const games = loadLocal()
    .matches.filter((m) => tashkentDay(m.ts) === day)
    .map(fromLocal)
    .filter((g): g is FinishedGame => g !== null);
  const t = s.test[day] ?? { referrals: 0, puzzles: 0, games: [] };
  return { games: [...games, ...t.games], referrals: t.referrals, puzzles: t.puzzles };
}

export function demoBoard(now = Date.now()): MissionBoard & { balance: number } {
  const s = load();
  const day = tashkentDay(now);
  return { ...buildBoard(s.defs, s.settings, activity(s, day), s.claims[day] ?? {}, day), balance: demoBalance() };
}

export function demoClaim(slug: string, now = Date.now()): ClaimCheck & { balance: number } {
  const s = load();
  const day = tashkentDay(now);
  const claims = s.claims[day] ?? {};
  const r = checkClaim(buildBoard(s.defs, s.settings, activity(s, day), claims, day), slug);
  if (r.ok) {
    s.claims[day] = { ...claims, [slug]: r.amount };
    save(s);
    // one beta test wallet for missions and the shop; idem key = the server's (mission:<day>:<slug>)
    if (r.amount > 0) demoWalletApply(r.amount, 'reward', 'mission', slug, day, `mission:${day}:${slug}`);
  }
  return { ...r, balance: demoBalance() };
}

/* ---------------------------------------------------------------- beta test tools */
function bumpTest(fn: (t: TestDay) => void) {
  const s = load();
  const day = tashkentDay(Date.now());
  const t = s.test[day] ?? { referrals: 0, puzzles: 0, games: [] };
  fn(t);
  s.test[day] = t;
  save(s);
}
export type TestEvent = 'puzzle' | 'referral' | 'rated_win' | 'rated_loss' | 'bot_medium_win' | 'casual_game';
export function addTestEvent(e: TestEvent) {
  bumpTest((t) => {
    const ts = Date.now();
    const game = (o: Partial<FinishedGame>): FinishedGame => ({ ts, rated: true, outcome: 'win', moves: 30, vsBot: false, botLevel: null, ...o });
    if (e === 'puzzle') t.puzzles += 1;
    else if (e === 'referral') t.referrals += 1;
    else if (e === 'rated_win') t.games.push(game({}));
    else if (e === 'rated_loss') t.games.push(game({ outcome: 'loss' }));
    else if (e === 'bot_medium_win') t.games.push(game({ rated: false, vsBot: true, botLevel: 'medium' }));
    else t.games.push(game({ rated: false, vsBot: true, botLevel: 'easy', outcome: 'loss' }));
  });
}
/** Clears today's test events and claims (test coins stay). */
export function resetTestDay() {
  const s = load();
  const day = tashkentDay(Date.now());
  delete s.test[day];
  delete s.claims[day];
  save(s);
}

/* ---------------------------------------------------------------- admin (beta) */
export const demoConfig = () => {
  const s = load();
  return { defs: s.defs, settings: s.settings };
};
export function demoSaveConfig(defs: MissionDef[], settings: MissionSettings): DefsError | null {
  const err = validateConfig(defs, settings);
  if (err) return err;
  const s = load();
  save({ ...s, defs, settings });
  return null;
}
