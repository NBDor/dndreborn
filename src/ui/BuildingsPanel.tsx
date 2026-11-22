import { useState } from 'react';
import { BUILDINGS, BUILDING_ORDER, ITEMS, TOWN_HALL_REPUTATION } from '../game/data';
import { buildBlocker, buildCost, buildHours, maxLevelFor, needsPlacement, workforce } from '../game/rules';
import type { Action, BuildingId, GameState } from '../game/types';
import { costList } from './format';
import { VillageMap } from './map/VillageMap';

type Props = { state: GameState; dispatch: (a: Action) => void };

export function BuildingsPanel({ state, dispatch }: Props) {
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<BuildingId>('town_hall');
  const [placing, setPlacing] = useState<BuildingId | null>(null);

  const startPlacing = (id: BuildingId) => {
    setSelected(id);
    setPlacing(id);
    setMode('map');
  };

  return (
    <div className="panel">
      <div className="view-toggle">
        <button className={mode === 'map' ? 'active' : 'ghost'} onClick={() => setMode('map')}>🗺️ Map</button>
        <button className={mode === 'list' ? 'active' : 'ghost'} onClick={() => setMode('list')}>📋 List</button>
      </div>
      {mode === 'map' ? (
        <div className="map-layout">
          <VillageMap
            state={state}
            selected={selected}
            placing={placing}
            onSelect={setSelected}
            onPlace={(at) => {
              dispatch({ type: 'build', building: placing!, at });
              setPlacing(null);
            }}
            onCancelPlace={() => setPlacing(null)}
          />
          <div className="map-side">
            <ConstructionBanner state={state} dispatch={dispatch} />
            <BuildingCard id={selected} state={state} dispatch={dispatch} onPlace={startPlacing} />
            <div className="card chips">
              {BUILDING_ORDER.map((id) => (
                <button key={id} className={`chip${selected === id ? ' active' : ''}${state.buildings[id] ? '' : ' unbuilt'}`}
                  onClick={() => setSelected(id)} title={BUILDINGS[id].name}>
                  {BUILDINGS[id].icon} {state.buildings[id] || '·'}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
        <ConstructionBanner state={state} dispatch={dispatch} />
        <div className="grid">
          {BUILDING_ORDER.map((id) => <BuildingCard key={id} id={id} state={state} dispatch={dispatch} onPlace={startPlacing} />)}
        </div>
        </>
      )}
    </div>
  );
}

function ConstructionBanner({ state, dispatch }: Props) {
  const c = state.construction;
  if (!c) return null;
  return (
    <div className="construction card">
      <div>
        🔨 Building <b>{BUILDINGS[c.building].name}</b> level {c.targetLevel}. Done in {c.endsTick - state.tick} hours.
      </div>
      <Progress value={1 - (c.endsTick - state.tick) / buildHours(c.building, c.targetLevel)} />
      <button className="ghost" onClick={() => dispatch({ type: 'cancelBuild' })}>Abandon (refund 50%)</button>
    </div>
  );
}

export function BuildingCard({ id, state, dispatch, onPlace }: Props & { id: BuildingId; onPlace: (id: BuildingId) => void }) {
  const def = BUILDINGS[id];
  const level = state.buildings[id];
  const target = level + 1;
  const maxed = level >= def.maxLevel;
  const blocker = buildBlocker(state, id);
  const cost = buildCost(id, target);
  const eff = workforce(state);

  return (
    <article className={`card building${level === 0 ? ' unbuilt' : ''}`}>
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
          {needsPlacement(state, id) ? (
            <button disabled={!!blocker} title={blocker ?? ''} onClick={() => onPlace(id)}>
              📍 {id === 'house' ? 'Place a new cottage' : 'Choose a spot'}
            </button>
          ) : (
            <button disabled={!!blocker} title={blocker ?? ''} onClick={() => dispatch({ type: 'build', building: id })}>
              Upgrade to {target}
            </button>
          )}
          {blocker && <span className="blocker">{blocker}</span>}
        </footer>
      )}
    </article>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress">
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  );
}
