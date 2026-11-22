import type { GameState } from '../game/types';

export function LogPanel({ state }: { state: GameState }) {
  return (
    <aside className="log card">
      <h3>📜 Chronicle</h3>
      <ol>
        {state.log.map((e) => (
          <li key={e.id} className={`log-${e.kind}`}>
            <span className="muted small">Day {e.day}</span> {e.text}
          </li>
        ))}
      </ol>
    </aside>
  );
}
