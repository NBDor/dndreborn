import { BUILDINGS, BUILDING_ORDER, ITEMS, TOWN_HALL_REPUTATION } from '../game/data';
import { buildBlocker, buildCost, buildHours, maxLevelFor, workforce } from '../game/rules';
import type { Action, GameState } from '../game/types';
import { costList } from './format';

export function BuildingsPanel({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const c = state.construction;
  const eff = workforce(state);

  return (
    <div className="panel">
      {c && (
        <div className="construction card">
          <div>
            🔨 Building <b>{BUILDINGS[c.building].name}</b> level {c.targetLevel}. Done in{' '}
            {c.endsTick - state.tick} hours.
          </div>
          <Progress
            value={1 - (c.endsTick - state.tick) / buildHours(c.building, c.targetLevel)}
          />
          <button className="ghost" onClick={() => dispatch({ type: 'cancelBuild' })}>Abandon (refund 50%)</button>
        </div>
      )}
      <div className="grid">
        {BUILDING_ORDER.map((id) => {
          const def = BUILDINGS[id];
          const level = state.buildings[id];
          const target = level + 1;
          const maxed = level >= def.maxLevel;
          const blocker = buildBlocker(state, id);
          const cost = buildCost(id, target);
          return (
            <article key={id} className={`card building${level === 0 ? ' unbuilt' : ''}`}>
              <header>
                <span className="big-icon">{def.icon}</span>
                <div>
                  <h3>{def.name}</h3>
                  <span className="muted">
                    {level === 0 ? 'Not built' : `Level ${level}`} · max {maxLevelFor(state, id)}
                  </span>
                </div>
              </header>
              <p>{def.description}</p>
              {def.produces && level > 0 && (
                <p className="good-text">
                  {ITEMS[def.produces.item].icon} +{Math.round(def.produces.perLevelPerDay * level * eff * 10) / 10} per day
                  {eff < 1 && <span className="muted"> (understaffed)</span>}
                </p>
              )}
              {def.workersPerLevel > 0 && (
                <p className="muted small">Needs {def.workersPerLevel} worker{def.workersPerLevel > 1 ? 's' : ''} per level</p>
              )}
              {id === 'town_hall' && TOWN_HALL_REPUTATION[target] !== undefined && (
                <p className="muted small">Level {target} needs {TOWN_HALL_REPUTATION[target]} reputation</p>
              )}
              {!maxed && (
                <footer>
                  <div className="cost">
                    {costList(cost.gold, cost.items).map((x) => <span key={x.key}>{x.label}</span>)}
                    <span className="muted">⏱ {buildHours(id, target)}h</span>
                  </div>
                  <button disabled={!!blocker} title={blocker ?? ''} onClick={() => dispatch({ type: 'build', building: id })}>
                    {level === 0 ? 'Build' : `Upgrade to ${target}`}
                  </button>
                  {blocker && <span className="blocker">{blocker}</span>}
                </footer>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
