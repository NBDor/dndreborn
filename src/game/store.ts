// Small mutating helpers used inside the engine on a cloned state. Never call these on state the UI holds.
import { ITEMS, TOOL_LIFE } from './data';
import type { GameState, ItemId, LogKind } from './types';

const MAX_LOG = 150;

export function log(s: GameState, kind: LogKind, text: string) {
  s.log.unshift({ id: s.nextId++, day: s.day, kind, text });
  if (s.log.length > MAX_LOG) s.log.length = MAX_LOG;
}

export const newId = (s: GameState, prefix: string) => `${prefix}${s.nextId++}`;

/** Add to a stock, averaging quality by quantity. */
export function add(s: GameState, item: ItemId, n: number, q = 0.6) {
  if (n <= 0) return;
  const lot = s.inventory[item];
  if (!lot || lot.qty <= 1e-9) {
    s.inventory[item] = { qty: n, q };
    return;
  }
  lot.q = (lot.q * lot.qty + q * n) / (lot.qty + n);
  lot.qty += n;
}

/** Take up to n from a stock; returns how much was taken. */
export function take(s: GameState, item: ItemId, n: number): number {
  const lot = s.inventory[item];
  if (!lot || n <= 0) return 0;
  const t = Math.min(lot.qty, n);
  lot.qty -= t;
  if (lot.qty < 1e-6) lot.qty = 0;
  return t;
}

/** Share of a job's workers who have the tool: 1 with tools for all, 0.35 with none. */
export function toolFactor(s: GameState, item: ItemId, users: number): number {
  if (users <= 0) return 1;
  const have = s.inventory[item]?.qty ?? 0;
  return 0.35 + 0.65 * Math.min(1, have / users);
}

/** Wear tools down for a day's use by `users` people. */
export function wear(s: GameState, item: ItemId, users: number, multiplier = 1) {
  const lot = s.inventory[item];
  const life = TOOL_LIFE[item];
  if (!lot || !life || users <= 0) return;
  const lifetime = life * (0.5 + lot.q) * multiplier;
  lot.qty = Math.max(0, lot.qty - Math.min(users, lot.qty) / lifetime);
}

export const kcalOf = (item: ItemId) => ITEMS[item].kcal ?? 0;
