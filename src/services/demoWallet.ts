/**
 * DAMEO BETA — on-device TEST wallet (no backend). One balance for the whole beta: Daily Missions rewards
 * land here and the Shop spends from here. Never touches the main DAMEO wallet.
 * Storage: localStorage 'dameobeta.wallet.v1'. A first visit gets a start grant so the shop can be tried.
 */
import { readJSON, writeJSON } from './localStore.ts';
import type { LedgerRow } from './shop.ts';

const KEY = 'dameobeta.wallet.v1';
export const BETA_START_COINS = 10_000;
export const DEMO_WALLET_EVENT = 'dameobeta:wallet';

interface State {
  balance: number;
  seq: number;
  ledger: LedgerRow[];
  idem: string[];
}

function load(): State {
  const s = readJSON<State | null>(KEY, null);
  if (s && typeof s.balance === 'number') return s;
  const start: State = { balance: 0, seq: 0, ledger: [], idem: [] };
  apply(start, BETA_START_COINS, 'reward', 'beta', null, 'beta_start');
  writeJSON(KEY, start);
  return start;
}

function apply(s: State, amount: number, kind: string, refType: string | null, refId: string | null, note: string | null) {
  s.balance += amount;
  s.seq += 1;
  s.ledger.unshift({ id: s.seq, amount, balance_after: s.balance, kind, ref_type: refType, ref_id: refId, note, created_at: new Date().toISOString() });
  s.ledger = s.ledger.slice(0, 200);
}

/** Moves coins (positive = credit, negative = spend). Same idem key twice → applied once. Throws 'insufficient'. */
export function demoWalletApply(amount: number, kind: string, refType: string | null, refId: string | null, note: string | null, idem?: string): number {
  const s = load();
  if (idem && s.idem.includes(idem)) return s.balance;
  if (s.balance + amount < 0) throw new Error('insufficient funds');
  apply(s, amount, kind, refType, refId, note);
  if (idem) s.idem = [idem, ...s.idem].slice(0, 300);
  writeJSON(KEY, s);
  window.dispatchEvent(new Event(DEMO_WALLET_EVENT));
  return s.balance;
}

export const demoBalance = () => load().balance;
export function demoHistory(before?: number): LedgerRow[] {
  const rows = load().ledger;
  return (before ? rows.filter((r) => r.id < before) : rows).slice(0, 30);
}
