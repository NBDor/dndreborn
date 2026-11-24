import { ITEMS } from '../game/data';
import type { ItemId } from '../game/types';

export const fmt = (n: number) => Math.floor(n + 1e-9).toLocaleString();

export function kg(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)} t`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} t`;
  if (n >= 10) return `${Math.round(n)} kg`;
  return `${Math.round(n * 10) / 10} kg`;
}

/** "350 kg" for weighed goods, "12" for counted ones. */
export const amount = (item: ItemId, n: number) => (ITEMS[item].unit === 'kg' ? kg(n) : fmt(n));

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export function qualityWord(q: number): string {
  if (q >= 0.8) return 'fine';
  if (q >= 0.6) return 'good';
  if (q >= 0.4) return 'rough';
  return 'poor';
}
