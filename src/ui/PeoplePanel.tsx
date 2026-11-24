import { JOBS, JOB_ORDER, SKILL_NAMES, TECHS } from '../game/data';
import {
  age, canWorkAge, isAvailable, isChild, isHelper, isUnwell, skill, techStatus,
} from '../game/rules';
import type { Action, GameState, JobId, Person, SkillId, TechId } from '../game/types';

type Props = { state: GameState; dispatch: (a: Action) => void };

const WORK_JOBS = JOB_ORDER.filter((j) => j !== 'researcher');
/** When adding a worker, take them from these jobs first. */
const SPARE_FIRST: JobId[] = ['idle', 'gatherer', 'woodcutter', 'builder', 'hideworker', 'potter', 'herder', 'farmer', 'knapper'];

export function PeoplePanel({ state, dispatch }: Props) {
  const day = state.day;
  const workers = state.people.filter((p) => canWorkAge(p, day));

  const addWorker = (job: JobId) => {
    const sk = JOBS[job].skill;
    const pool = workers.filter((p) => p.job !== job && !p.away && p.job !== 'researcher');
    pool.sort((a, b) => {
      const pa = SPARE_FIRST.indexOf(a.job), pb = SPARE_FIRST.indexOf(b.job);
      if (pa !== pb) return pa - pb;
      return (sk ? skill(b, sk) - skill(a, sk) : 0) || (isHelper(a, day) ? 1 : 0) - (isHelper(b, day) ? 1 : 0);
    });
    if (pool[0]) dispatch({ type: 'assign', personId: pool[0].id, job });
  };
  const removeWorker = (job: JobId) => {
    const sk = JOBS[job].skill;
    const pool = workers.filter((p) => p.job === job && !p.away).sort((a, b) => (sk ? skill(a, sk) - skill(b, sk) : 0));
    if (pool[0]) dispatch({ type: 'assign', personId: pool[0].id, job: 'idle' });
  };

  const sorted = [...state.people].sort((a, b) => a.born - b.born);
  const researchable = (Object.keys(TECHS) as TechId[]).filter((t) => techStatus(state, t) === 'available');

  return (
    <div className="panel">
      <div className="card jobs">
        {WORK_JOBS.map((job) => {
          const n = workers.filter((p) => p.job === job).length;
          return (
            <div key={job} className="job-count" title={JOBS[job].description}>
              <span>{JOBS[job].icon} {JOBS[job].name}</span>
              <span className="stepper">
                <button className="ghost" onClick={() => removeWorker(job)} disabled={n === 0} aria-label={`Fewer ${JOBS[job].name}`}>−</button>
                <b>{n}</b>
                <button className="ghost" onClick={() => addWorker(job)} disabled={job === 'idle'} aria-label={`More ${JOBS[job].name}`}>+</button>
              </span>
            </div>
          );
        })}
      </div>

      <div className="card">
        <table className="people">
          <thead>
            <tr><th>Name</th><th>Health</th><th>Skills</th><th>Work</th></tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <PersonRow key={p.id} p={p} state={state} researchable={researchable}
                onAssign={(job, research) => dispatch({ type: 'assign', personId: p.id, job, research })} />
            ))}
          </tbody>
        </table>
        <p className="muted small">
          People learn by doing, and learn fastest working beside someone more skilled. Children help from seven and
          work fully from twelve.
        </p>
      </div>
    </div>
  );
}

function PersonRow({ p, state, researchable, onAssign }: {
  p: Person; state: GameState; researchable: TechId[]; onAssign: (job: JobId, research?: TechId) => void;
}) {
  const day = state.day;
  const years = Math.floor(age(p, day));
  const top = (Object.entries(p.skills) as [SkillId, number][]).filter(([, v]) => v >= 5).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const status = p.away ? 'away on a journey' : isUnwell(p, day) ? `${p.unwellReason ?? 'unwell'} (${(p.unwellUntil ?? day) - day}d)` : null;
  const value = p.job === 'researcher' ? `researcher:${p.research}` : p.job;

  return (
    <tr className={status ? 'dim' : ''}>
      <td>
        <b>{p.name}</b> <span className="muted small">{p.sex === 'f' ? '♀' : '♂'} {years}{isChild(p, day) ? (isHelper(p, day) ? ' · helper' : ' · child') : ''}</span>
        {status && <div className="small neg">{status}</div>}
      </td>
      <td><Bar value={p.health / 100} /></td>
      <td className="skills">
        {top.map(([sk, v]) => <span key={sk} className="chip-skill" title={`${SKILL_NAMES[sk]} ${Math.round(v)}`}>{SKILL_NAMES[sk]} {Math.round(v)}</span>)}
      </td>
      <td>
        {canWorkAge(p, day) ? (
          <select value={value} disabled={!!p.away} onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith('researcher:')) onAssign('researcher', v.slice(11) as TechId);
            else onAssign(v as JobId);
          }}>
            {WORK_JOBS.map((j) => (
              <option key={j} value={j}>
                {JOBS[j].icon} {JOBS[j].name}{JOBS[j].skill ? ` (${Math.round(skill(p, JOBS[j].skill!))})` : ''}
              </option>
            ))}
            {[...new Set([...researchable, ...(p.research ? [p.research] : [])])].map((t) => (
              <option key={t} value={`researcher:${t}`}>💡 Experiment: {TECHS[t].name}</option>
            ))}
          </select>
        ) : (
          <span className="muted small">too young</span>
        )}
        {!isAvailable(p, day) && canWorkAge(p, day) && !p.away && <span className="muted small"> resting</span>}
      </td>
    </tr>
  );
}

export function Bar({ value, warnBelow = 0.4 }: { value: number; warnBelow?: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={`bar${v < warnBelow ? ' low' : ''}`} title={`${Math.round(v * 100)}%`}>
      <div style={{ width: `${v * 100}%` }} />
    </div>
  );
}
