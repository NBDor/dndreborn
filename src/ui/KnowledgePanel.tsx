import { SKILL_NAMES, STRUCTURES, TECHS, TECH_ORDER } from '../game/data';
import { canWorkAge, isChild, skill, techStatus } from '../game/rules';
import type { Action, GameState, Person, TechId } from '../game/types';
import { amount } from './format';
import { Bar } from './PeoplePanel';

type Props = { state: GameState; dispatch: (a: Action) => void };

export function KnowledgePanel({ state, dispatch }: Props) {
  const byStatus = (st: ReturnType<typeof techStatus>) => TECH_ORDER.filter((t) => techStatus(state, t) === st);

  return (
    <div className="panel">
      <p className="muted">
        New techniques come from experiments, which cost time and materials and may take many attempts, and from
        watching how neighbours work. Everything here follows real prerequisites.
      </p>

      <section className="card">
        <h3>Can be discovered</h3>
        <div className="techs">
          {byStatus('available').map((t) => <TechCard key={t} id={t} state={state} dispatch={dispatch} />)}
          {byStatus('available').length === 0 && <p className="muted">Nothing new can be tried right now.</p>}
        </div>
      </section>

      <section className="card">
        <h3>Out of reach for now</h3>
        <div className="techs">
          {[...byStatus('locked'), ...byStatus('future')].map((t) => <TechCard key={t} id={t} state={state} dispatch={dispatch} />)}
        </div>
      </section>

      <section className="card">
        <h3>Known</h3>
        <div className="known">
          {byStatus('known').map((t) => (
            <details key={t}>
              <summary>{TECHS[t].icon} {TECHS[t].name}</summary>
              <p className="small">{TECHS[t].effect}</p>
              <p className="small muted">🔬 {TECHS[t].science}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function TechCard({ id, state, dispatch }: Props & { id: TechId }) {
  const t = TECHS[id];
  const st = techStatus(state, id);
  const progress = state.research[id] ?? 0;
  const researchers = state.people.filter((p) => p.job === 'researcher' && p.research === id);
  const candidates = state.people
    .filter((p) => canWorkAge(p, state.day) && !isChild(p, state.day) && !p.away && !(p.job === 'researcher' && p.research === id))
    .sort((a, b) => (t.skill ? skill(b, t.skill) - skill(a, t.skill) : 0));
  const missing = t.prereqs.filter((p) => !state.known.includes(p));

  return (
    <article className={`tech ${st}`}>
      <header>
        <span className="big-icon">{st === 'locked' || st === 'future' ? '🔒' : t.icon}</span>
        <h4>{t.name}</h4>
      </header>
      <p className="small">{t.effect}</p>
      <p className="small muted">🔬 {t.science}</p>
      {st === 'future' && <p className="small"><b>Beyond this era.</b></p>}
      {st === 'locked' && (
        <p className="small neg">
          Needs {[...missing.map((m) => TECHS[m].name), ...(t.needs && !missing.length ? [`a ${STRUCTURES[t.needs].name.toLowerCase()}`] : [])].join(', ')}
        </p>
      )}
      {st === 'available' && (
        <>
          <Bar value={progress / t.cost} warnBelow={0} />
          <p className="small muted">
            {Math.floor(progress)} of {t.cost} days of work
            {t.skill ? ` · helped by ${SKILL_NAMES[t.skill].toLowerCase()}` : ''}
            {t.uses ? ` · uses ${Object.entries(t.uses).map(([i, n]) => amount(i as never, n)).join(' and ')} a day` : ''}
          </p>
          <p className="small">
            {researchers.length ? `Experimenting: ${researchers.map((p) => p.name).join(', ')}` : 'No one is experimenting.'}
          </p>
          <div className="row">
            <select defaultValue="" onChange={(e) => {
              if (e.target.value) dispatch({ type: 'assign', personId: e.target.value, job: 'researcher', research: id });
              e.target.value = '';
            }}>
              <option value="">Assign someone…</option>
              {candidates.map((p: Person) => (
                <option key={p.id} value={p.id}>{p.name}{t.skill ? ` (${SKILL_NAMES[t.skill].toLowerCase()} ${Math.round(skill(p, t.skill))})` : ''}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </article>
  );
}
