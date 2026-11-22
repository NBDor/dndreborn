import { BUILDINGS, ITEMS, RECIPES } from '../game/data';
import { qty, recipeBlocker } from '../game/rules';
import type { Action, BuildingId, GameState, ItemId } from '../game/types';
import { fmt } from './format';

export function CraftingPanel({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const stations = [...new Set(RECIPES.map((r) => r.station))] as BuildingId[];

  return (
    <div className="panel">
      <p className="muted">
        Turn raw resources into materials, quest supplies and gear. Each recipe needs its station built to the listed level.
      </p>
      {stations.map((station) => (
        <section key={station} className="card">
          <h3>
            {BUILDINGS[station].icon} {BUILDINGS[station].name}{' '}
            <span className="muted">
              {state.buildings[station] ? `level ${state.buildings[station]}` : 'not built'}
            </span>
          </h3>
          <div className="recipes">
            {RECIPES.filter((r) => r.station === station).map((r) => {
              const out = ITEMS[r.output];
              const blocker1 = recipeBlocker(state, r, 1);
              const blocker5 = recipeBlocker(state, r, 5);
              return (
                <div key={r.id} className="recipe">
                  <div className="recipe-io">
                    <span>
                      {(Object.entries(r.inputs) as [ItemId, number][]).map(([item, n]) => (
                        <span key={item} className={qty(state, item) < n ? 'neg' : ''} title={ITEMS[item].name}>
                          {ITEMS[item].icon} {n}{' '}
                        </span>
                      ))}
                    </span>
                    <span className="arrow">→</span>
                    <span title={out.description}>
                      {out.icon} {r.qty > 1 ? `${r.qty}× ` : ''}<b>{out.name}</b>
                    </span>
                    <span className="muted small">(have {fmt(qty(state, r.output))})</span>
                  </div>
                  <div className="recipe-actions">
                    <button disabled={!!blocker1} title={blocker1 ?? ''}
                      onClick={() => dispatch({ type: 'craft', recipeId: r.id })}>Craft</button>
                    <button disabled={!!blocker5} title={blocker5 ?? ''}
                      onClick={() => dispatch({ type: 'craft', recipeId: r.id, times: 5 })}>×5</button>
                  </div>
                  {blocker1 && <span className="blocker">{blocker1}</span>}
                  <span className="muted small">{out.description}</span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
