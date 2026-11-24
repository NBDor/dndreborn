import { foodDays, housing, qty, warnings } from '../game/rules';
import type { GameState } from '../game/types';
import { fmt, kg } from './format';

export function ResourceBar({ state }: { state: GameState }) {
  const days = foodDays(state);
  const adults = state.people.length;
  const garments = Math.floor(qty(state, 'clothing'));
  const notes = warnings(state);

  return (
    <section className="resource-bar">
      <div className="stats">
        <Stat icon="👪" label="People" value={`${state.people.length} / ${housing(state)} beds`} warn={state.people.length > housing(state)} />
        <Stat icon="🍲" label="Food stores" value={`${fmt(days)} days`} warn={days < 30}
          title="How long the food in store would last if nothing more came in" />
        <Stat icon="🌾" label="Grain" value={kg(qty(state, 'grain'))} />
        <Stat icon="🪵" label="Wood" value={kg(qty(state, 'wood'))} />
        <Stat icon="🪨" label="Flint" value={kg(qty(state, 'flint'))} warn={qty(state, 'flint') < 2} />
        <Stat icon="🧥" label="Clothing" value={`${garments} / ${adults}`} warn={garments < adults} />
        <Stat icon="🐐" label="Goats" value={fmt(state.goats)} />
      </div>
      {notes.length > 0 && (
        <ul className="advisor">
          {notes.slice(0, 5).map((w) => <li key={w.text} className={w.level}>{w.level === 'bad' ? '⚠️' : '•'} {w.text}</li>)}
        </ul>
      )}
    </section>
  );
}

function Stat(props: { icon: string; label: string; value: string; title?: string; warn?: boolean }) {
  return (
    <div className={`stat${props.warn ? ' warn' : ''}`} title={props.title}>
      <span className="stat-icon">{props.icon}</span>
      <span className="stat-body">
        <span className="stat-label">{props.label}</span>
        <span className="stat-value">{props.value}</span>
      </span>
    </div>
  );
}
