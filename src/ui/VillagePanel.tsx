import { useState } from 'react';
import {
  GOATS_PER_PEN, GRANARY_KG, GROW_DAYS, HARVEST_DAYS, SMOKE_KG_PER_DAY, SOW_DAYS, STRUCTURES, STRUCTURE_ORDER, TECHS,
  WEED_DAYS,
} from '../game/data';
import { buildBlocker, fieldStage, structuresOf, workers } from '../game/rules';
import type { Action, GameState, Structure, StructureType } from '../game/types';
import { kg, pct } from './format';
import { VillageMap } from './map/VillageMap';
import { Bar } from './PeoplePanel';

type Props = { state: GameState; dispatch: (a: Action) => void };

export function VillagePanel({ state, dispatch }: Props) {
  const [selected, setSelected] = useState<string | null>(state.structures[0]?.id ?? null);
  const [placing, setPlacing] = useState<StructureType | null>(null);
  const structure = state.structures.find((x) => x.id === selected);

  return (
    <div className="map-layout">
      <VillageMap
        state={state}
        selected={selected}
        placing={placing}
        onSelect={setSelected}
        onPlace={(at) => {
          dispatch({ type: 'build', structure: placing!, at });
          setPlacing(null);
        }}
        onCancelPlace={() => setPlacing(null)}
      />
      <div className="map-side">
        {structure && <StructureCard x={structure} state={state} dispatch={dispatch} />}
        <BuildMenu state={state} onPlace={setPlacing} placing={placing} />
      </div>
    </div>
  );
}

function StructureCard({ x, state, dispatch }: Props & { x: Structure }) {
  const def = STRUCTURES[x.type];
  return (
    <article className="card building">
      <header>
        <span className="big-icon">{def.icon}</span>
        <div>
          <h3>{def.name}</h3>
          <span className="muted small">{x.built ? 'Standing' : 'Being built'}</span>
        </div>
      </header>
      <p className="small">{def.description}</p>
      {!x.built ? (
        <>
          <Bar value={x.work / x.workNeeded} warnBelow={0} />
          <p className="small muted">
            {Math.floor(x.work)} of {Math.ceil(x.workNeeded)} builder-days · {workers(state, 'builder').length} builders at work
            {x.clearedWood ? ` · clearing trees` : ''}
          </p>
          {workers(state, 'builder').length === 0 && <p className="small neg">No one is assigned as a builder.</p>}
          <button className="ghost" onClick={() => dispatch({ type: 'cancelBuild', structureId: x.id })}>Abandon (keep half the materials)</button>
        </>
      ) : (
        <Details x={x} state={state} />
      )}
    </article>
  );
}

function Details({ x, state }: { x: Structure; state: GameState }) {
  if (x.type === 'field' && x.field) {
    const f = x.field;
    const stage = fieldStage(f, state.day);
    const grown = f.sownOn === null ? 0 : state.day - f.sownOn;
    const text = {
      unsown: f.harvestedOn !== undefined && state.day - f.harvestedOn < 200 ? 'Stubble. Sow again next spring.' : 'Unsown. Farmers sow in spring.',
      sowing: `Sowing: ${pct(f.sowWork / SOW_DAYS)} done.`,
      growing: `Growing: day ${grown} of about ${GROW_DAYS}. Weeded ${pct(Math.min(1, f.weeding / WEED_DAYS))}.`,
      ripe: `Ripe! Harvest ${pct(f.harvestWork / HARVEST_DAYS)} done. Grain is lost every day it waits.`,
    }[stage];
    return (
      <>
        <p className="small">{text}</p>
        {stage === 'growing' && <Bar value={grown / GROW_DAYS} warnBelow={0} />}
        <p className="small muted">Soil fertility {pct(f.fertility)}: falls with each harvest, recovers when fields rest{state.known.includes('manuring') ? ' and with manure' : ''}.</p>
      </>
    );
  }
  if (x.type === 'pen') return <p className="small">{state.goats} goats · {structuresOf(state, 'pen').length * GOATS_PER_PEN} places in pens</p>;
  if (x.type === 'granary') return <p className="small">Keeps {kg(GRANARY_KG)} of grain safe from damp and mice.</p>;
  if (x.type === 'smokerack') return <p className="small">Smokes up to {SMOKE_KG_PER_DAY} kg of leftover meat and fish a day.</p>;
  if (x.type === 'kiln') return <p className="small">Potters fire here: fewer breakages and half the fuel.</p>;
  return <p className="small">Sleeps {STRUCTURES[x.type].housing}.</p>;
}

function BuildMenu({ state, onPlace, placing }: { state: GameState; onPlace: (t: StructureType) => void; placing: StructureType | null }) {
  return (
    <div className="card build-menu">
      <h3>Build</h3>
      {STRUCTURE_ORDER.filter((t) => STRUCTURES[t].buildable).map((t) => {
        const def = STRUCTURES[t];
        const blocker = buildBlocker(state, t);
        const locked = def.tech && !state.known.includes(def.tech);
        return (
          <div key={t} className={`build-row${locked ? ' dim' : ''}`} title={def.description}>
            <div>
              <b>{def.icon} {def.name}</b>
              <div className="small muted">
                {locked
                  ? `Needs ${TECHS[def.tech!].name}`
                  : [def.wood && `${kg(def.wood)} wood`, def.straw && `${kg(def.straw)} straw`, def.clay && `${kg(def.clay)} clay dug on site`, `${def.days}+ builder-days`].filter(Boolean).join(' · ')}
              </div>
              {blocker && !locked && <div className="small neg">{blocker}</div>}
            </div>
            <button disabled={!!blocker || placing === t} onClick={() => onPlace(t)}>Place</button>
          </div>
        );
      })}
      <p className="small muted">Building on wooded land takes longer, but the felled trees give wood.</p>
    </div>
  );
}
