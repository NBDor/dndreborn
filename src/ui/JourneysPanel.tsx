import { useState } from 'react';
import { CARRY_KG, FLINT_TRIP_KG, HUNT_SEASON, ITEMS, ITEM_ORDER, NEIGHBORS, PREY } from '../game/data';
import {
  expeditionBlocker, expeditionDays, isAvailable, isChild, neighborValue, qty, season, skill, weightOf,
} from '../game/rules';
import type { Action, Amounts, ExpeditionKind, GameState, ItemId, Neighbor } from '../game/types';
import { amount, kg } from './format';
import { Bar } from './PeoplePanel';

type Props = { state: GameState; dispatch: (a: Action) => void };

export function JourneysPanel({ state, dispatch }: Props) {
  return (
    <div className="panel">
      {state.expeditions.length > 0 && (
        <section className="card">
          <h3>🧭 Away</h3>
          {state.expeditions.map((e) => {
            const names = e.members.map((id) => state.people.find((p) => p.id === id)?.name).filter(Boolean).join(', ');
            const where = e.kind === 'hunt' ? `hunting ${PREY.find((p) => p.id === e.target)!.name.toLowerCase()}`
              : `${e.kind === 'flint' ? 'fetching flint from' : 'trading with'} ${NEIGHBORS.find((n) => n.id === e.target)!.name}`;
            return (
              <div key={e.id} className="away">
                {names}: {where} · back in {e.returns - state.day} day{e.returns - state.day === 1 ? '' : 's'}
                <Bar value={(state.day - e.departed) / (e.returns - e.departed)} warnBelow={0} />
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <h3>🏹 Hunting</h3>
        <p className="muted small">
          Each hunter takes a bundle of arrows, and many are lost. Game is fattest in autumn ({season(state).name.toLowerCase()} now:{' '}
          {Math.round(HUNT_SEASON[season(state).id] * 100)}% chances).
        </p>
        <div className="journeys">
          {PREY.map((p) => (
            <JourneyCard key={p.id} state={state} dispatch={dispatch} kind="hunt" target={p.id}
              title={`${p.icon} ${p.name}`} subtitle={`${p.description} ${p.days} days, at least ${p.minHunters} hunters.`}
              risk={p.death > 0.01 ? 'Deadly' : p.injury > 0.03 ? 'Dangerous' : 'Low risk'} />
          ))}
        </div>
      </section>

      <section className="card">
        <h3>🤝 Neighbours</h3>
        <div className="neighbors">
          {state.neighbors.map((n) => <NeighborCard key={n.id} n={n} state={state} dispatch={dispatch} />)}
        </div>
      </section>
    </div>
  );
}

function MemberPicker({ state, chosen, setChosen, rank }: {
  state: GameState; chosen: string[]; setChosen: (ids: string[]) => void; rank?: (id: string) => number;
}) {
  const people = state.people
    .filter((p) => isAvailable(p, state.day) && !isChild(p, state.day))
    .sort((a, b) => (rank ? rank(b.id) - rank(a.id) : 0));
  return (
    <div className="members">
      {people.map((p) => (
        <label key={p.id} className={chosen.includes(p.id) ? 'picked' : ''}>
          <input type="checkbox" checked={chosen.includes(p.id)}
            onChange={() => setChosen(chosen.includes(p.id) ? chosen.filter((x) => x !== p.id) : [...chosen, p.id])} />
          {p.name}{rank ? <span className="muted small"> {Math.round(rank(p.id))}</span> : null}
        </label>
      ))}
      {people.length === 0 && <span className="muted small">No one is free to go.</span>}
    </div>
  );
}

function JourneyCard({ state, dispatch, kind, target, title, subtitle, risk }: Props & {
  kind: ExpeditionKind; target: string; title: string; subtitle: string; risk?: string;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const members = chosen.filter((id) => state.people.some((p) => p.id === id && isAvailable(p, state.day)));
  const blocker = expeditionBlocker(state, kind, target, members);
  const hunting = (id: string) => skill(state.people.find((p) => p.id === id)!, 'hunting');
  return (
    <article className="journey">
      <h4>{title}</h4>
      <p className="small">{subtitle}</p>
      {risk && <p className={`small ${risk === 'Low risk' ? 'muted' : 'neg'}`}>{risk}</p>}
      {!open ? (
        <button className="ghost" onClick={() => setOpen(true)}>Plan…</button>
      ) : (
        <>
          <MemberPicker state={state} chosen={members} setChosen={setChosen} rank={kind === 'hunt' ? hunting : undefined} />
          <div className="row">
            <button disabled={!!blocker} title={blocker ?? ''} onClick={() => {
              dispatch({ type: 'expedition', kind, target, members });
              setChosen([]);
              setOpen(false);
            }}>Set out ({expeditionDays(kind, target)} days)</button>
            {blocker && members.length > 0 && <span className="blocker">{blocker}</span>}
          </div>
        </>
      )}
    </article>
  );
}

const TRADEABLE: ItemId[] = ITEM_ORDER.filter((i) => !['wild_food', 'meat', 'fish', 'fodder', 'clay', 'straw', 'wood'].includes(i));

function NeighborCard({ n, state, dispatch }: Props & { n: Neighbor }) {
  const def = NEIGHBORS.find((d) => d.id === n.id)!;
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [cargo, setCargo] = useState<Amounts>({});
  const [wants, setWants] = useState<ItemId[]>([]);
  const members = chosen.filter((id) => state.people.some((p) => p.id === id && isAvailable(p, state.day)));
  const cleanCargo = Object.fromEntries(Object.entries(cargo).filter(([, v]) => (v ?? 0) > 0)) as Amounts;
  const blocker = expeditionBlocker(state, 'trade', n.id, members, cleanCargo);
  const offer = (Object.entries(cleanCargo) as [ItemId, number][]).reduce((sum, [i, k]) => sum + neighborValue(n, i) * k, 0) + n.owes;
  const theyHave = (Object.keys(n.stock) as ItemId[]).filter((i) => (n.stock[i] ?? 0) >= 1);
  const step = (i: ItemId) => (ITEMS[i].unit === 'kg' ? (ITEMS[i].value > 0.2 ? 1 : 10) : 1);

  return (
    <article className="neighbor">
      <h4>{def.name}</h4>
      <p className="small">{def.description} {def.days} day{def.days > 1 ? 's' : ''} away.</p>
      <div className="small">Trust <Bar value={(n.trust + 100) / 200} warnBelow={0.45} /></div>
      <p className="small"><b>They have:</b> {theyHave.map((i) => `${ITEMS[i].icon} ${amount(i, n.stock[i]!)}`).join(' · ') || 'little to spare'}</p>
      <p className="small"><b>They need:</b> {def.lacks.map((i) => `${ITEMS[i].icon} ${ITEMS[i].name.toLowerCase()}`).join(', ')}</p>
      {n.owes > 0.5 && <p className="small pos">They owe us about {Math.round(n.owes)} days of labour.</p>}
      {n.famine && <p className="small neg">They are hungry this year.</p>}

      {!open ? (
        <div className="row">
          <button className="ghost" onClick={() => setOpen(true)}>Plan a trade…</button>
          {def.flintSource && <FlintTrip state={state} dispatch={dispatch} n={n} />}
        </div>
      ) : (
        <div className="trade">
          <h5>Take with us</h5>
          <div className="cargo">
            {TRADEABLE.filter((i) => qty(state, i) >= step(i)).map((i) => (
              <div key={i} className="cargo-item">
                <span>{ITEMS[i].icon} {ITEMS[i].name}</span>
                <span className="stepper">
                  <button className="ghost" onClick={() => setCargo({ ...cargo, [i]: Math.max(0, (cargo[i] ?? 0) - step(i)) })}>−</button>
                  <b>{amount(i, cargo[i] ?? 0)}</b>
                  <button className="ghost" disabled={(cargo[i] ?? 0) + step(i) > qty(state, i)}
                    onClick={() => setCargo({ ...cargo, [i]: (cargo[i] ?? 0) + step(i) })}>+</button>
                </span>
              </div>
            ))}
          </div>
          <h5>Ask for (in order)</h5>
          <div className="members">
            {theyHave.map((i) => (
              <label key={i} className={wants.includes(i) ? 'picked' : ''}>
                <input type="checkbox" checked={wants.includes(i)} onChange={() => setWants(wants.includes(i) ? wants.filter((x) => x !== i) : [...wants, i])} />
                {ITEMS[i].icon} {ITEMS[i].name}
              </label>
            ))}
          </div>
          <h5>Who goes</h5>
          <MemberPicker state={state} chosen={members} setChosen={setChosen} />
          <p className="small muted">
            Load {kg(weightOf(cleanCargo))} of {kg(members.length * CARRY_KG)} they can carry. They value what we bring at about{' '}
            {Math.round(offer * 10) / 10} days of labour. {wants.length === 0 ? 'Asking for nothing makes it a gift, which builds trust.' : ''}
          </p>
          <div className="row">
            <button disabled={!!blocker} title={blocker ?? ''} onClick={() => {
              dispatch({ type: 'expedition', kind: 'trade', target: n.id, members, cargo: cleanCargo, wants });
              setOpen(false);
              setCargo({});
              setWants([]);
              setChosen([]);
            }}>Set out ({expeditionDays('trade', n.id)} days)</button>
            <button className="ghost" onClick={() => setOpen(false)}>Cancel</button>
            {blocker && members.length > 0 && <span className="blocker">{blocker}</span>}
          </div>
        </div>
      )}
    </article>
  );
}

function FlintTrip({ state, dispatch, n }: Props & { n: Neighbor }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const members = chosen.filter((id) => state.people.some((p) => p.id === id && isAvailable(p, state.day)));
  const blocker = expeditionBlocker(state, 'flint', n.id, members);
  if (!open) return <button className="ghost" onClick={() => setOpen(true)}>Dig flint on their land…</button>;
  return (
    <div className="trade">
      <p className="small">
        Each person digs and carries home about {FLINT_TRIP_KG} kg of good flint. {n.trust < 20 ? 'They do not trust us yet: they may catch us and fight.' : 'They will not like it.'}
      </p>
      <MemberPicker state={state} chosen={members} setChosen={setChosen} />
      <div className="row">
        <button disabled={!!blocker} onClick={() => { dispatch({ type: 'expedition', kind: 'flint', target: n.id, members }); setOpen(false); setChosen([]); }}>
          Set out ({expeditionDays('flint', n.id)} days)
        </button>
        <button className="ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
