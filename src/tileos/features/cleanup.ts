/* Cleaning up: a project, an estimate or a client that shouldn't be there (a test, a double, a typo) — gone, with
 * everything tied to it. And starting over: every project, estimate, client and task out, the team, items and
 * settings kept. Nothing here can be undone, so each one asks first (the Delete window). */
import { useStore, freshData, pickData } from '@/tileos/store'
import { showPop } from '@/tileos/lib/pop'
import { REAL, startFresh } from '@/tileos/lib/save'

const S = () => useStore.getState()

/** what goes with a project */
export function jobTies(id: string) {
  const s = S()
  return {
    estimates: s.estimates.filter((e) => e.jobId === id).length,
    tasks: s.tasks.filter((t) => t.jobId === id && t.state !== 'done').length,
    money: s.money.filter((m) => m.jobId === id).length,
    pos: s.pos.filter((p) => p.jobId === id).length + s.ipos.filter((p) => p.jobId === id).length,
    files: s.files.filter((f) => f.jobId === id).length,
    punch: s.punch.filter((p) => p.jobId === id).length,
  }
}

/** the project and everything tied to it */
export function deleteJob(id: string) {
  const s = S()
  const j = s.jobs[id]
  if (!j) return
  s.commit((st) => {
    delete st.jobs[id]
    delete st.tiles[id]; delete st.hist[id]; delete st.rooms[id]; delete st.diary[id]; delete st.prep[id]; delete st.notes[id]; delete st.messages[id]; delete st.stepRecs[id]; delete st.jobSteps[id]; delete st.pricing[id]
    const out = <T extends { jobId?: string }>(list: T[]) => list.filter((x) => x.jobId !== id)
    st.tasks = out(st.tasks); st.money = out(st.money); st.pos = out(st.pos); st.mats = out(st.mats as any) as any; st.checks = out(st.checks); st.bookings = out(st.bookings)
    st.ready = out(st.ready as any) as any; st.notices = out(st.notices as any) as any; st.punch = out(st.punch); st.ipos = out(st.ipos); st.estimates = out(st.estimates); st.events = out(st.events as any) as any
    st.shortages = out(st.shortages as any) as any; st.files = out(st.files)
    st.lost = st.lost.filter((l) => l.name !== j.name)
  }, `${j.name} deleted`, { sub: 'The project and everything tied to it.' })
  s.closeAll()
}

/** an estimate — and its project when the project was only ever that estimate */
export function deleteEstimate(id: string) {
  const s = S()
  const e = s.estimates.find((x) => x.id === id)
  if (!e) return
  const j = s.jobs[e.jobId]
  const others = s.estimates.filter((x) => x.jobId === e.jobId && x.id !== id).length
  const withJob = !!j && !others && ['request', 'estimating', 'proposal', 'followup'].includes(j.stage)
  if (withJob) { deleteJob(e.jobId); return }
  s.commit((st) => {
    st.estimates = st.estimates.filter((x) => x.id !== id)
    st.tasks = st.tasks.filter((t) => !(t.action && 'kind' in t.action && typeof t.action.kind === 'string' && t.action.kind.endsWith(':' + id)))
  }, `Estimate ${id} deleted`)
  s.closeAll()
}

/** a client with no projects (one with projects stays — make it inactive instead) */
export function deleteClient(id: string) {
  const s = S()
  const c = s.clients[id]
  if (!c) return
  const jobs = Object.values(s.jobs).filter((j) => j.clientId === id)
  if (jobs.length) return
  s.commit((st) => {
    delete st.clients[id]
    st.inactive = (st.inactive || []).filter((x) => x !== 'client:' + id)
    st.team = st.team.filter((m) => m.clientId !== id)
  }, `${c.name} deleted`)
  s.closeAll()
}

/** every project, estimate, client and task out — the team, logins, items and settings stay. In the real app the
 *  rows go out of the company's database the same way any change does. */
export function startOver() {
  const s = S()
  if (!REAL.cloud) { s.closeAll(); startFresh(); return }
  const keepRole = s.role
  s.replaceData(freshData(pickData(s)))
  S().setRole(keepRole)
  S().closeAll()
  S().go({ page: 'today' })
  showPop({ title: 'Clean slate', sub: `No projects, estimates, tasks or clients${REAL.cloud ? ' — cleared from the company’s database' : ''}. Your team, items and settings stayed. Start with + New.` })
}
