import { DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS } from '../game/data';
import type { GameState } from '../game/types';

const when = (day: number) => {
  const d = day % DAYS_PER_YEAR;
  return `Y${Math.floor(day / DAYS_PER_YEAR) + 1} ${SEASONS[Math.floor(d / DAYS_PER_SEASON)].icon} ${(d % DAYS_PER_SEASON) + 1}`;
};

export function LogPanel({ state }: { state: GameState }) {
  return (
    <aside className="log card">
      <h3>📜 Chronicle</h3>
      <ol>
        {state.log.map((e) => (
          <li key={e.id} className={`log-${e.kind}`}>
            <span className="muted small">{when(e.day)}</span> {e.text}
          </li>
        ))}
      </ol>
    </aside>
  );
}
