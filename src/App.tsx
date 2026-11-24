import { useEffect, useReducer, useRef, useState } from 'react';
import { DAYS_PER_SEASON } from './game/data';
import { clearSave, createInitialState, loadGame, reduce, saveGame } from './game/engine';
import { dayOfSeason, season, year } from './game/rules';
import type { Action, GameState } from './game/types';
import { JourneysPanel } from './ui/JourneysPanel';
import { KnowledgePanel } from './ui/KnowledgePanel';
import { LogPanel } from './ui/LogPanel';
import { PeoplePanel } from './ui/PeoplePanel';
import { ResourceBar } from './ui/ResourceBar';
import { StoresPanel } from './ui/StoresPanel';
import { VillagePanel } from './ui/VillagePanel';

type Root = { type: 'reset'; state: GameState } | Action;
const rootReducer = (s: GameState, a: Root) => (a.type === 'reset' ? a.state : reduce(s, a));

const TABS = [
  { id: 'village', label: '🏘️ Village' },
  { id: 'people', label: '👪 People' },
  { id: 'stores', label: '🏺 Stores & crafts' },
  { id: 'journeys', label: '🧭 Journeys' },
  { id: 'knowledge', label: '💡 Knowledge' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const SPEEDS = [0, 1, 2, 5];
const MS_PER_DAY = 1000; // one day per second at 1×

export default function App() {
  const [state, dispatch] = useReducer(rootReducer, undefined, () => loadGame() ?? createInitialState());
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<Tab>('village');

  useEffect(() => {
    if (!speed) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), MS_PER_DAY / speed);
    return () => clearInterval(id);
  }, [speed]);

  // Autosave every few seconds and when the page is hidden.
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const id = setInterval(() => saveGame(latest.current), 3000);
    const onHide = () => saveGame(latest.current);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  const newGame = () => {
    if (!confirm('Abandon this village and start a new one?')) return;
    clearSave();
    dispatch({ type: 'reset', state: createInitialState() });
  };

  const se = season(state);
  return (
    <div className="app">
      <header className="topbar">
        <h1>🔥 Hearthstead</h1>
        <div className={`season season-${se.id}`} title={se.description}>
          {se.icon} {se.name}, day {dayOfSeason(state)} of {DAYS_PER_SEASON} · Year {year(state)}
        </div>
        <div className="speed">
          {SPEEDS.map((s) => (
            <button key={s} className={speed === s ? 'active' : 'ghost'} onClick={() => setSpeed(s)} title={s ? `${s} day${s > 1 ? 's' : ''} per second` : 'Pause'}>
              {s === 0 ? '⏸' : `${s}×`}
            </button>
          ))}
          <button className="ghost" onClick={newGame} title="Start over">↺ New</button>
        </div>
      </header>

      <ResourceBar state={state} />

      <div className="layout">
        <main>
          <nav className="tabs">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'active' : 'ghost'} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>
          {/* The village stays mounted so the map keeps its camera and animations across tabs. */}
          <div hidden={tab !== 'village'}>
            <VillagePanel state={state} dispatch={dispatch} />
          </div>
          {tab === 'people' && <PeoplePanel state={state} dispatch={dispatch} />}
          {tab === 'stores' && <StoresPanel state={state} dispatch={dispatch} />}
          {tab === 'journeys' && <JourneysPanel state={state} dispatch={dispatch} />}
          {tab === 'knowledge' && <KnowledgePanel state={state} dispatch={dispatch} />}
        </main>
        <LogPanel state={state} />
      </div>
    </div>
  );
}
