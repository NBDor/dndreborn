import { ITEMS, ITEM_ORDER } from '../game/data';
import {
  firewoodPerDay, foodUsePerDay, housingCap, jobsNeeded, productionPerDay, qty, season, storageCap, taxesPerDay,
  upkeepPerDay, workforce,
} from '../game/rules';
import type { GameState } from '../game/types';
import { fmt, pct, signed } from './format';

export function ResourceBar({ state }: { state: GameState }) {
  const prod = productionPerDay(state);
  const cap = storageCap(state);
  const goldNet = taxesPerDay(state) - upkeepPerDay(state);
  const shown = ITEM_ORDER.filter((id) => ITEMS[id].category === 'resource' || qty(state, id) >= 1 || prod[id]);

  return (
    <section className="resource-bar">
      <div className="stats">
        <Stat icon="🪙" label="Gold" value={fmt(state.gold)} rate={signed(goldNet)}
          title={`Taxes ${signed(taxesPerDay(state))}/day, upkeep -${upkeepPerDay(state)}/day`} />
        <Stat icon="⭐" label="Reputation" value={fmt(state.reputation)} title="Earned by completing quests" />
        <Stat icon="👪" label="Villagers" value={`${state.population}/${housingCap(state)}`}
          title="Villagers grow by one per day while there is food and housing" />
        <Stat icon="⚙️" label="Workforce" value={pct(workforce(state))} warn={workforce(state) < 1}
          title={`${state.population} villagers for ${jobsNeeded(state)} jobs. Production scales with staffing.`} />
      </div>
      <div className="items">
        {shown.map((id) => {
          let rate = prod[id] ?? 0;
          if (id === 'food') rate -= foodUsePerDay(state);
          if (id === 'wood') rate -= firewoodPerDay(state);
          const n = qty(state, id);
          return (
            <Stat key={id} icon={ITEMS[id].icon} label={ITEMS[id].name} value={fmt(n)}
              rate={rate ? signed(rate) : undefined}
              warn={(id === 'food' && (state.starving || rate < 0)) || (id === 'wood' && (state.freezing || rate < 0)) || n >= cap}
              title={`${ITEMS[id].description}\nStorage: ${fmt(n)}/${cap}`} />
          );
        })}
      </div>
      {state.starving && <div className="alert">⚠️ The village is starving! Build or upgrade farms, or buy food.</div>}
      {state.freezing && <div className="alert">🥶 The woodpiles are empty and villagers are freezing! Get wood before winter ends.</div>}
      {season(state).id === 'autumn' && <div className="hint">🍂 Winter is coming: stock food and wood. Farms slow to a crawl and every villager burns firewood.</div>}
    </section>
  );
}

function Stat(props: { icon: string; label: string; value: string; rate?: string; title?: string; warn?: boolean }) {
  return (
    <div className={`stat${props.warn ? ' warn' : ''}`} title={props.title}>
      <span className="stat-icon">{props.icon}</span>
      <span className="stat-body">
        <span className="stat-label">{props.label}</span>
        <span className="stat-value">
          {props.value}
          {props.rate && <small className={props.rate.startsWith('-') ? 'neg' : 'pos'}> {props.rate}/d</small>}
        </span>
      </span>
    </div>
  );
}
