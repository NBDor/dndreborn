import { useEffect, useReducer, useRef, useState } from 'react';
import { clearSave, createInitialState, loadGame, reduce, saveGame } from './game/engine';
import { DAYS_PER_SEASON } from './game/data';
import { day, dayOfSeason, hourOfDay, season, year } from './game/rules';
import type { Action, GameState } from './game/types';
import { BuildingsPanel } from './ui/BuildingsPanel';
import { CraftingPanel } from './ui/CraftingPanel';
import { LogPanel } from './ui/LogPanel';
import { MarketPanel } from './ui/MarketPanel';
import { ResourceBar } from './ui/ResourceBar';
import { TavernPanel } from './ui/TavernPanel';

type Root = { type: 'reset'; state: GameState } | Action;
const rootReducer = (s: GameState, a: Root) => (a.type === 'reset' ? a.state : reduce(s, a));

const TABS = [
  { id: 'village', label: '🏘️ Village' },
  { id: 'crafting', label: '⚒️ Crafting' },
  { id: 'tavern', label: '🍺 Tavern & Quests' },
  { id: 'market', label: '⚖️ Market' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const SPEEDS = [0, 1, 2, 4];
const MS_PER_TICK = 500; // one in-game hour per half second at 1×

export default function App() {
  const [state, dispatch] = useReducer(rootReducer, undefined, () => loadGame() ?? createInitialState());
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<Tab>('village');

  useEffect(() => {
    if (!speed) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), MS_PER_TICK / speed);
    return () => clearInterval(id);
  }, [speed]);

  // Autosave at most every few seconds, and when the tab is hidden.
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

  return (
    <div className="app">
      <header className="topbar">
        <h1>🏰 Hearthstead</h1>
        <div className="clock">
          Day <b>{day(state)}</b> · {String(hourOfDay(state)).padStart(2, '0')}:00
        </div>
        <div className={`season season-${season(state).id}`} title={season(state).description}>
          {season(state).icon} {season(state).name} {dayOfSeason(state)}/{DAYS_PER_SEASON} · Year {year(state)}
        </div>
        <div className="speed">
          {SPEEDS.map((s) => (
            <button key={s} className={speed === s ? 'active' : 'ghost'} onClick={() => setSpeed(s)}>
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
              <button key={t.id} className={tab === t.id ? 'active' : 'ghost'} onClick={() => setTab(t.id)}>
                {t.label}
                {t.id === 'tavern' && state.adventurers.some((a) => a.status === 'idle') && <span className="dot" />}
              </button>
            ))}
          </nav>
          {/* The village stays mounted so the map keeps its camera and animations across tabs. */}
          <div hidden={tab !== 'village'}>
            <BuildingsPanel state={state} dispatch={dispatch} />
          </div>
          {tab === 'crafting' && <CraftingPanel state={state} dispatch={dispatch} />}
          {tab === 'tavern' && <TavernPanel state={state} dispatch={dispatch} />}
          {tab === 'market' && <MarketPanel state={state} dispatch={dispatch} />}
        </main>
        <LogPanel state={state} />
      </div>
    </div>
  );
}
