import { useState } from 'react';
import { CLASSES, ITEMS, QUESTS, TICKS_PER_DAY, type QuestTemplate } from '../game/data';
import {
  adventurerPower, day, partyFee, partyPower, qty, questBlocker, questDays, questTemplate, questUnlocked,
  successChance, xpToNext,
} from '../game/rules';
import type { Action, Adventurer, GameState, Inventory, ItemId } from '../game/types';
import { Progress } from './BuildingsPanel';
import { pct } from './format';

const SUPPLY_ITEMS: ItemId[] = ['rations', 'healing_potion', 'iron_sword', 'leather_armor'];

export function TavernPanel({ state, dispatch }: { state: GameState; dispatch: (a: Action) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const template = selected ? questTemplate(selected) : undefined;
  const today = day(state);

  return (
    <div className="panel tavern">
      {state.quests.length > 0 && (
        <section className="card">
          <h3>🗺️ Quests underway</h3>
          {state.quests.map((q) => {
            const t = questTemplate(q.templateId)!;
            const names = q.partyIds.map((id) => state.adventurers.find((a) => a.id === id)?.name ?? '?');
            const left = q.endsTick - state.tick;
            return (
              <div key={q.id} className="active-quest">
                <div>
                  {t.icon} <b>{t.name}</b> · {names.join(', ')} · {pct(q.successChance)} chance ·{' '}
                  <span className="muted">
                    back in {left >= TICKS_PER_DAY ? `${Math.ceil(left / TICKS_PER_DAY)} days` : `${left} hours`}
                  </span>
                </div>
                <Progress value={(state.tick - q.startedTick) / (q.endsTick - q.startedTick)} />
              </div>
            );
          })}
        </section>
      )}

      <section className="card">
        <h3>🍺 At the tavern</h3>
        {state.buildings.tavern < 1 && <p className="muted">Build a Tavern to attract adventurers.</p>}
        {state.adventurers.length === 0 && state.buildings.tavern > 0 && (
          <p className="muted">No adventurers right now. More arrive every few days; a bigger tavern draws more.</p>
        )}
        <div className="adventurers">
          {state.adventurers.map((a) => (
            <div key={a.id} className={`adventurer status-${a.status}`}>
              <div className="adv-head">
                <span className="big-icon" title={CLASSES[a.cls].perk}>{CLASSES[a.cls].icon}</span>
                <div>
                  <b>{a.name}</b>
                  <div className="muted small">
                    Lv {a.level} {CLASSES[a.cls].name} · ⚔️ {adventurerPower(a)} · 🪙 {a.fee}
                  </div>
                </div>
              </div>
              <div className="small">{CLASSES[a.cls].perk}</div>
              <div className="small muted">
                XP {a.xp}/{xpToNext(a)} · {a.questsCompleted} quests ·{' '}
                {a.status === 'idle' && `leaves in ${Math.max(0, a.leavesOnDay - today)}d`}
                {a.status === 'questing' && 'on a quest'}
                {a.status === 'injured' && `injured, ${Math.max(0, (a.recoversOnDay ?? today) - today)}d to recover`}
              </div>
              {a.status === 'idle' && (
                <button className="ghost small" onClick={() => dispatch({ type: 'dismissAdventurer', adventurerId: a.id })}>
                  Dismiss
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3>📋 Quest board</h3>
        <div className="quest-board">
          {QUESTS.map((q) => {
            const unlocked = questUnlocked(state, q);
            return (
              <button key={q.id} className={`quest-tile${selected === q.id ? ' selected' : ''}`} disabled={!unlocked}
                onClick={() => setSelected(selected === q.id ? null : q.id)}>
                <span className="big-icon">{unlocked ? q.icon : '🔒'}</span>
                <span>
                  <b>{q.name}</b>
                  <span className="muted small block">
                    {unlocked
                      ? `⚔️ ${q.difficulty} · ${q.days}d · up to ${q.maxParty} · ⭐+${q.reputation}`
                      : `Needs ${q.minReputation} reputation`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {template && (
          <QuestPlanner key={template.id} state={state} quest={template} dispatch={dispatch} onDone={() => setSelected(null)} />
        )}
      </section>
    </div>
  );
}

function QuestPlanner(props: { state: GameState; quest: QuestTemplate; dispatch: (a: Action) => void; onDone: () => void }) {
  const { state, quest } = props;
  const [partyIds, setPartyIds] = useState<string[]>([]);
  const [supplies, setSupplies] = useState<Inventory>({});

  const idle = state.adventurers.filter((a) => a.status === 'idle');
  const party = partyIds.map((id) => idle.find((a) => a.id === id)).filter((a): a is Adventurer => !!a);
  const blocker = questBlocker(state, quest, party, supplies);
  const power = partyPower(party, supplies);
  const chance = successChance(quest, party, supplies);

  const toggle = (id: string) =>
    setPartyIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < quest.maxParty ? [...ids, id] : ids));
  const setSupply = (item: ItemId, n: number) =>
    setSupplies((s) => ({ ...s, [item]: Math.max(0, Math.min(qty(state, item), n)) }));

  return (
    <div className="planner">
      <h4>{quest.icon} {quest.name}</h4>
      <p>{quest.description}</p>
      <p className="muted small">
        Rewards: {quest.loot.map((l) => `${l.item === 'gold' ? '🪙' : ITEMS[l.item].icon} ${l.min}–${l.max}`).join(' · ')} · ⭐ +{quest.reputation}
      </p>

      <h5>Party ({party.length}/{quest.maxParty})</h5>
      {idle.length === 0 && <p className="muted small">No idle adventurers at the tavern.</p>}
      <div className="party-pick">
        {idle.map((a) => (
          <label key={a.id} className={partyIds.includes(a.id) ? 'picked' : ''}>
            <input type="checkbox" checked={partyIds.includes(a.id)} onChange={() => toggle(a.id)} />
            {CLASSES[a.cls].icon} {a.name} <span className="muted small">Lv {a.level} · ⚔️ {adventurerPower(a)} · 🪙 {a.fee}</span>
          </label>
        ))}
      </div>

      <h5>Supplies</h5>
      <div className="supplies">
        {SUPPLY_ITEMS.map((item) => {
          const n = supplies[item] ?? 0;
          return (
            <div key={item} className="supply" title={ITEMS[item].description}>
              <span>{ITEMS[item].icon} {ITEMS[item].name}</span>
              <span className="stepper">
                <button className="ghost" disabled={n <= 0} onClick={() => setSupply(item, n - 1)}>−</button>
                <b>{n}</b>
                <button className="ghost" disabled={n >= qty(state, item)} onClick={() => setSupply(item, n + 1)}>+</button>
              </span>
              <span className="muted small">have {Math.floor(qty(state, item))}</span>
            </div>
          );
        })}
      </div>

      <div className="odds">
        <span>⚔️ Power <b>{power}</b> vs difficulty <b>{quest.difficulty}</b></span>
        <span>🎲 Success <b className={chance >= 0.6 ? 'pos' : chance < 0.35 ? 'neg' : ''}>{pct(chance)}</b></span>
        <span>⏱ {questDays(quest, party)} day{questDays(quest, party) > 1 ? "s" : ""}</span>
        <span>🪙 Fee {partyFee(party)}</span>
      </div>
      <div className="planner-actions">
        <button disabled={!!blocker} title={blocker ?? ''}
          onClick={() => {
            props.dispatch({ type: 'startQuest', templateId: quest.id, partyIds, supplies });
            props.onDone();
          }}>
          Send party
        </button>
        {blocker && <span className="blocker">{blocker}</span>}
      </div>
    </div>
  );
}
