import {
  DAYS_PER_SEASON, GOAT_FODDER_KG, GOAT_MEAT_KG, ITEMS, ITEM_ORDER, JOBS, RECIPES, TECHS,
} from '../game/data';
import {
  foodDays, granaryCapacity, herdersNeeded, penCapacity, qty, quality, storedKcal, workers,
} from '../game/rules';
import { seedReserve } from '../game/sim';
import type { Action, GameState, ItemId } from '../game/types';
import { amount, fmt, kg, qualityWord } from './format';

type Props = { state: GameState; dispatch: (a: Action) => void };

export function StoresPanel({ state, dispatch }: Props) {
  const foods = ITEM_ORDER.filter((i) => ITEMS[i].category === 'food');
  const materials = ITEM_ORDER.filter((i) => ITEMS[i].category === 'material');
  const crafted = RECIPES.map((r) => r.id);
  const spoiled = state.report.spoiled;

  return (
    <div className="panel">
      <section className="card">
        <h3>🍲 Food</h3>
        <p className="muted small">
          {fmt(storedKcal(state) / 1000)} thousand kcal in store: about <b>{fmt(foodDays(state))} days</b> for{' '}
          {state.people.length} people. {kg(seedReserve(state))} of grain is kept back as seed. Granaries and pots
          protect {kg(granaryCapacity(state) + qty(state, 'pot') * 25)} of grain from damp and mice.
        </p>
        <table className="stores">
          <thead><tr><th>Food</th><th>In store</th><th>Energy</th><th>Spoiling</th></tr></thead>
          <tbody>
            {foods.map((id) => (
              <tr key={id} title={ITEMS[id].description}>
                <td>{ITEMS[id].icon} {ITEMS[id].name}</td>
                <td>{kg(qty(state, id))}</td>
                <td className="muted">{fmt(ITEMS[id].kcal!)} kcal/kg</td>
                <td className={(spoiled[id] ?? 0) > 0.5 ? 'neg' : 'muted'}>{spoiled[id] ? `${kg(spoiled[id]!)}/day` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>🐐 Herd</h3>
        <Herd state={state} dispatch={dispatch} />
      </section>

      <section className="card">
        <h3>🛠️ Tools and goods</h3>
        <p className="muted small">Set how many of each the village should keep. Craftspeople work on whatever is furthest below its target.</p>
        <table className="stores">
          <thead><tr><th>Good</th><th>In store</th><th>Quality</th><th>Keep</th><th>Made by</th><th>From</th></tr></thead>
          <tbody>
            {crafted.map((id) => {
              const r = RECIPES.find((x) => x.id === id)!;
              const locked = r.tech && !state.known.includes(r.tech);
              const makers = workers(state, r.job).length;
              const target = state.targets[id] ?? 0;
              return (
                <tr key={id} className={locked ? 'dim' : ''} title={ITEMS[id].description}>
                  <td>{ITEMS[id].icon} {ITEMS[id].name}</td>
                  <td className={qty(state, id) < target ? 'neg' : ''}>{fmt(qty(state, id))}</td>
                  <td className="muted">{qty(state, id) >= 1 ? qualityWord(quality(state, id)) : '—'}</td>
                  <td>
                    <span className="stepper">
                      <button className="ghost" onClick={() => dispatch({ type: 'setTarget', item: id, qty: Math.max(0, target - (target > 10 ? 5 : 1)) })}>−</button>
                      <b>{target}</b>
                      <button className="ghost" onClick={() => dispatch({ type: 'setTarget', item: id, qty: target + (target >= 10 ? 5 : 1) })}>+</button>
                    </span>
                  </td>
                  <td className={!locked && makers === 0 ? 'neg small' : 'small'}>
                    {locked ? `needs ${TECHS[r.tech!].name}` : `${JOBS[r.job].icon} ${makers} ${JOBS[r.job].name.toLowerCase()}${makers === 1 ? '' : 's'}`}
                  </td>
                  <td className="small muted">
                    {(Object.entries(r.inputs) as [ItemId, number][]).map(([i, n]) => `${amount(i, n)} ${ITEMS[i].name.toLowerCase()}`).join(' + ')}, {r.days} day{r.days === 1 ? '' : 's'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>🪵 Materials</h3>
        <table className="stores">
          <thead><tr><th>Material</th><th>In store</th><th>Quality</th><th></th></tr></thead>
          <tbody>
            {materials.map((id) => (
              <tr key={id}>
                <td>{ITEMS[id].icon} {ITEMS[id].name}</td>
                <td>{amount(id, qty(state, id))}</td>
                <td className="muted">{qty(state, id) > 0.05 ? qualityWord(quality(state, id)) : '—'}</td>
                <td className="small muted">{ITEMS[id].description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Herd({ state, dispatch }: Props) {
  const winterNeed = state.goats * GOAT_FODDER_KG * DAYS_PER_SEASON;
  return (
    <div className="herd">
      <p>
        <b>{state.goats}</b> goats · pen space {penCapacity(state)} · herders {workers(state, 'herder').length} of{' '}
        {herdersNeeded(state)} needed · fodder {kg(qty(state, 'fodder'))} of {kg(winterNeed)} for a winter
      </p>
      <p className="muted small">
        Kids are born each spring. Goats graze from spring to autumn but need dried fodder in winter: many villages
        slaughter the animals they cannot feed in autumn. Each goat gives about {GOAT_MEAT_KG} kg of meat and a hide.
      </p>
      <div className="row">
        {[1, 5].map((n) => (
          <button key={n} disabled={state.goats < n} onClick={() => dispatch({ type: 'slaughter', count: n })}>
            Slaughter {n}
          </button>
        ))}
      </div>
    </div>
  );
}
