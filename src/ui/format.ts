import { ITEMS } from '../game/data';
import type { Inventory, ItemId } from '../game/types';

export const fmt = (n: number) => Math.floor(n + 1e-9).toLocaleString();

export const signed = (n: number, digits = 1) => {
  const v = Number(n.toFixed(digits));
  return `${v >= 0 ? '+' : ''}${v}`;
};

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function costList(gold: number, items: Inventory): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (gold > 0) out.push({ key: 'gold', label: `🪙 ${gold}` });
  for (const [item, n] of Object.entries(items) as [ItemId, number][]) {
    out.push({ key: item, label: `${ITEMS[item].icon} ${n}` });
  }
  return out;
}
