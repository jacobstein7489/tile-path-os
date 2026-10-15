/* The getting-ready checklist — one list per project, every step with the person who has it.
 *
 * Built-in steps read themselves from what really happened: rooms built, tiles picked, the setup decided,
 * the store's order and its delivery date, heights measured, our materials, the installer's PO, the deposit.
 * Your own steps (Settings → Checklist for every project, or "Add a step" on one project) are checked off by
 * whoever has them.
 *
 * A step opens when the steps it waits for are done — and then it's on its owner's Today. That's the hand-off:
 * nobody has to tell the next person; the list moves by itself. */
import { useStore, meOf, NOW, type Store } from '@/tileos/store'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { needWithWaste, type Task } from '@/tileos/data/work'
import { TODAY, addDays, isoFromLabel, labelFromIso } from '@/tileos/lib/today'
import { settingStatus } from './setting'
import { heightStatus } from './heights'
import { materialStatus } from './takeoff'
import { installerOf } from './upcoming'
import { matBy, runTaskAction } from './flows'

const S = () => useStore.getState()

export type StepState = 'done' | 'now' | 'wait' | 'later' | 'bad' | 'na'
export interface StepDef { key: string; label: string; short: string; owner: PersonKey | 'matBy'; after?: string[]; custom?: boolean }
export interface StepRec { done?: string; by?: PersonKey; owner?: PersonKey; due?: string; na?: boolean; note?: string }
export interface StepAction { label: string; run?: () => void; pick?: 'delivery' | 'checkin' | 'check' }
export interface StepView {
  key: string
  label: string
  short: string
  owner: PersonKey
  state: StepState
  note?: string
  /** ISO day it's due (deliveries, or a date someone set) */
  due?: string
  custom?: boolean
  /** added just for this project */
  only?: boolean
  after: string[]
  /** the first earlier step it's waiting for */
  waitsFor?: string
  action?: StepAction
  taskId?: string
  doneOn?: string
  doneBy?: PersonKey
}

/* the company's checklist, in order. "Electrical and plumbing" is one you added — remove it or add more in Settings. */
export const STEP_DEFAULTS: StepDef[] = [
  { key: 'rooms', label: 'Rooms and surfaces built from the paperwork', short: 'Rooms', owner: 'office' },
  { key: 'tile', label: 'Tile picked for every surface', short: 'Tile picks', owner: 'office', after: ['rooms'] },
  { key: 'setup', label: 'Setup decided — what goes under the tile', short: 'Setup', owner: 'office', after: ['rooms'] },
  { key: 'order', label: 'Tile ordered — delivery date set', short: 'Tile order', owner: 'office', after: ['tile'] },
  { key: 'heights', label: 'Wall heights measured on site', short: 'Heights', owner: 'yakov', after: ['rooms'] },
  { key: 'rough', label: 'Electrical and plumbing in the right spots', short: 'Rough-ins', owner: 'yakov', after: ['rooms'], custom: true },
  { key: 'materials', label: 'Our setting materials ordered', short: 'Materials', owner: 'matBy', after: ['setup', 'heights'] },
  { key: 'delivered', label: 'Tile delivered and counted', short: 'Tile delivery', owner: 'yakov', after: ['order'] },
  { key: 'installer', label: 'Installer booked — PO accepted', short: 'Installer', owner: 'ys', after: ['tile'] },
  { key: 'deposit', label: 'Deposit received', short: 'Deposit', owner: 'accounting' },
]
export const BUILT_IN = new Set(STEP_DEFAULTS.filter((d) => !d.custom).map((d) => d.key))

export const READY_STAGES = ['awarded', 'setup', 'verification', 'ready', 'scheduled']
export const isGettingReady = (j: Job) => j.kind !== 'repair' && READY_STAGES.includes(j.stage)
export const companySteps = (s: Pick<Store, 'rules'>): StepDef[] => s.rules.steps || STEP_DEFAULTS
const defsFor = (s: Store, jobId: string): (StepDef & { only?: boolean })[] => [...companySteps(s), ...(s.jobSteps[jobId] || []).map((d) => ({ ...d, only: true }))]

/** the open task that is this step, if someone already has one */
export function taskForStep(s: Pick<Store, 'tasks'>, jobId: string, key: string): Task | undefined {
  return s.tasks.find((t) => t.step === `${jobId}:${key}` && (t.state === 'now' || t.state === 'waiting'))
}

type Raw = { state: StepState; note?: string; due?: string; action?: StepAction }
function builtIn(s: Store, j: Job, key: string, rec: StepRec): Raw | null {
  const rooms = s.rooms[j.id] || []
  const flat = rooms.flatMap((r) => r.surfaces)
  const openJob = (tab: string) => () => s.open({ t: 'job', id: j.id, tab })
  switch (key) {
    case 'rooms':
      return rooms.length ? { state: 'done', note: `${rooms.length} rooms · ${flat.length} surfaces` } : { state: 'now', note: 'Not built yet', action: { label: 'Build rooms', run: () => s.open({ t: 'buildrooms', jobId: j.id }) } }
    case 'tile': {
      if (!flat.length) return { state: 'now', note: 'After the rooms' }
      const picked = flat.filter((x) => x.tile).length
      return picked === flat.length ? { state: 'done', note: 'Every surface has its tile' } : { state: 'now', note: `${picked} of ${flat.length} surfaces picked`, action: { label: 'Pick tiles', run: openJob('scope') } }
    }
    case 'setup': {
      const st = settingStatus(s, j.id)
      if (!st.total) return { state: 'now', note: 'Add the square feet first', action: { label: 'Open scope', run: openJob('scope') } }
      /* projects past setup had theirs decided before this list existed */
      if (['verification', 'ready', 'scheduled'].includes(j.stage) && st.set < st.total) return { state: 'done', note: 'Decided at setup — open the scope to see it' }
      return st.set === st.total ? { state: 'done', note: 'Decided for every surface — materials follow it' } : { state: 'now', note: `${st.set} of ${st.total} surfaces decided · suggestions ready`, action: { label: 'Decide the setup', run: () => s.open({ t: 'setting', jobId: j.id }) } }
    }
    case 'order': {
      const checks = s.checks.filter((c) => c.jobId === j.id)
      const short = checks.find((c) => c.ordered < needWithWaste(c) && !c.note)
      if (short) return { state: 'bad', note: `${short.tag}: the store ordered ${needWithWaste(short) - short.ordered} ${short.unit} less than we need`, action: { label: 'Settle it', run: () => s.open({ t: 'qty', jobId: j.id, tag: short.tag }) } }
      if (checks.length) {
        const eta = checks.find((c) => c.eta && c.received < c.ordered)?.eta
        return { state: 'done', note: `Ordered from ${checks[0].supplier}${eta ? ` · delivery ${eta}` : ''}` }
      }
      if (rec.done) return { state: 'done', note: rec.note || 'Ordered' }
      const p = s.prep[j.id]?.tile
      if (p === 'yes' || p === 'part') return { state: 'done', note: 'Ordered by the store' }
      return { state: 'now', note: 'Find out when it’s being delivered', action: { label: 'Mark ordered', pick: 'delivery' } }
    }
    case 'heights': {
      const hs = heightStatus(s, j.id)
      if (!hs.total) return { state: 'na', note: 'No walls on this project' }
      if (hs.measured === hs.total) return { state: 'done', note: 'Square feet and materials follow the real heights' }
      /* projects past the site check had theirs taken before this list existed */
      if (['ready', 'scheduled'].includes(j.stage) && !s.tasks.some((t) => t.step === `${j.id}:heights` && t.state !== 'done')) return { state: 'done', note: 'Checked at the site visit' }
      return { state: 'now', note: `${hs.measured} of ${hs.total} walls measured`, action: { label: 'Record the heights', run: () => s.open({ t: 'heights', jobId: j.id }) } }
    }
    case 'materials': {
      const ms = materialStatus(s, j.id)
      if (ms.state === 'yes') return { state: 'done', note: 'Everything the setup needs is on site' }
      if (ms.state === 'wait') return { state: 'wait', note: `Ordered — ${ms.hint.replace(/ — on the way$/, '')} on the way` }
      if (ms.go === 'scope') return { state: 'now', note: ms.hint, action: { label: 'Open scope', run: openJob('scope') } }
      return { state: 'now', note: `${ms.label} — worked out from the setup and square feet`, action: { label: 'Order materials', run: () => s.open({ t: 'newpo', jobId: j.id, fromTakeoff: true }) } }
    }
    case 'delivered': {
      const checks = s.checks.filter((c) => c.jobId === j.id)
      if (checks.length) {
        if (checks.every((c) => c.received >= c.ordered)) return { state: 'done', note: 'All of it is on site' }
        const run = () => s.open({ t: 'receivetile', jobId: j.id })
        const open = checks.filter((c) => c.received < c.ordered)
        const eta = isoFromLabel(open.find((c) => c.eta)?.eta)
        if (checks.some((c) => c.received > 0)) return { state: 'bad', due: eta, note: open.map((c) => `${c.tag} ${c.received} of ${c.ordered} ${c.unit}`).join(' · '), action: { label: 'Check it in', run } }
        if (eta && eta > TODAY) return { state: 'wait', due: eta, note: `Delivery ${labelFromIso(eta)} · ${checks[0].supplier}`, action: { label: 'Check it in', run } }
        return { state: 'now', due: eta || TODAY, note: eta && eta < TODAY ? `Was due ${labelFromIso(eta)} — did it come?` : 'Being delivered today', action: { label: 'Check it in', run } }
      }
      const p = s.prep[j.id]?.tile
      if (rec.done || p === 'yes') return { state: 'done', note: rec.note || 'On site' }
      if (p === 'part') return { state: 'bad', note: 'Part of it is here', action: { label: 'Report what’s short', run: () => s.open({ t: 'record', jobId: j.id, type: 'shortage' }) } }
      if (rec.due) {
        const d = rec.due
        return d > TODAY
          ? { state: 'wait', due: d, note: `Delivery ${labelFromIso(d)}`, action: { label: 'Check it in', pick: 'checkin' } }
          : { state: 'now', due: d, note: d < TODAY ? `Was due ${labelFromIso(d)} — did it come?` : 'Being delivered today', action: { label: 'Check it in', pick: 'checkin' } }
      }
      return { state: 'now', note: 'No delivery date yet' }
    }
    case 'installer': {
      const crew = installerOf(s, j)
      const ipo = [...s.ipos].reverse().find((p) => p.jobId === j.id)
      if (ipo?.status === 'Accepted') return { state: 'done', note: `${PEOPLE[ipo.crew].name} accepted ${ipo.id}` }
      if (ipo?.status === 'Sent') return { state: 'wait', note: `${ipo.id} sent — waiting for ${PEOPLE[ipo.crew].short} to accept`, action: { label: 'Open his PO', run: () => s.open({ t: 'ipo', id: ipo.id }) } }
      if (ipo?.status === 'Draft') return { state: 'now', note: `${ipo.id} saved, not sent yet`, action: { label: 'Send his PO', run: () => s.open({ t: 'ipo', id: ipo.id }) } }
      if (ipo?.status === 'Rejected') return { state: 'bad', note: `${PEOPLE[ipo.crew].short} turned it down`, action: { label: 'Book someone', run: () => s.open({ t: 'book', jobId: j.id }) } }
      return { state: 'now', note: crew ? `${PEOPLE[crew].short} picked — his PO isn’t out` : 'Nobody picked yet', action: { label: crew ? 'Send his PO' : 'Book installer', run: () => s.open({ t: 'book', jobId: j.id, crew }) } }
    }
    case 'deposit': {
      const dep = s.money.find((m) => m.jobId === j.id && m.kind === 'deposit')
      if (!dep) return { state: 'na', note: 'No deposit on this project' }
      const open = () => s.open({ t: 'money', id: dep.id })
      if (dep.state === 'paid') return { state: 'done', note: `Paid${dep.date ? ' ' + dep.date : ''}` }
      if (dep.paid) return { state: 'wait', note: `${fmtMoney((dep.amount || 0) - dep.paid)} still open`, action: { label: 'Record payment', run: open } }
      if (dep.step >= 1) return { state: 'wait', note: `Invoice ${dep.ref || ''} sent — not paid yet`, action: { label: 'Record payment', run: open } }
      return { state: 'now', note: 'Not invoiced yet — a warning, not a stop', action: { label: 'Create invoice', run: open } }
    }
  }
  return null
}

/** every step of one project, in order, with who has it and where it stands */
export function stepsFor(s: Store, j: Job): StepView[] {
  const recs = s.stepRecs[j.id] || {}
  const list: StepView[] = defsFor(s, j.id).map((d) => {
    const rec = recs[d.key] || {}
    const task = taskForStep(s, j.id, d.key)
    let raw: Raw | null = BUILT_IN.has(d.key) && !d.only ? builtIn(s, j, d.key, rec) : null
    if (!raw) {
      raw = rec.done
        ? { state: 'done', note: rec.note }
        : rec.na
          ? { state: 'na', note: 'Not needed on this project' }
          : { state: 'now', due: rec.due, note: rec.note || (d.key === 'rough' ? 'Boxes, valves and drains where the layout needs them' : d.only ? 'Added for this project' : 'Your own step — check it off when it’s done'), action: { label: d.key === 'rough' ? 'Checked — all good' : 'Mark done', pick: 'check' } }
    }
    if (rec.na && raw.state !== 'done') raw = { state: 'na', note: 'Not needed on this project' }
    const owner = (task?.owner || rec.owner || (d.owner === 'matBy' ? matBy(s) : d.owner)) as PersonKey
    const view: StepView = {
      key: d.key, label: d.label, short: d.short, owner, state: raw.state, note: raw.note, due: raw.due || rec.due, custom: !BUILT_IN.has(d.key) || d.only, only: d.only,
      after: d.after || [], action: raw.action, taskId: task?.id, doneOn: rec.done, doneBy: rec.by,
    }
    /* a task already open for this step: its button and its words win */
    if (task && view.state !== 'done') {
      if (task.action && task.action.kind !== 'open-job') view.action = { label: task.action.label, run: () => runTaskAction(task) }
      if (task.state === 'waiting') { view.state = 'wait'; view.note = `Waiting on ${task.waitingOn} · back ${task.followUp}` }
    }
    return view
  })
  /* a step that waits for an earlier one isn't anyone's turn yet */
  const doneish = (k: string) => { const x = list.find((y) => y.key === k); return !x || x.state === 'done' || x.state === 'na' }
  list.forEach((v) => {
    if (v.state !== 'now') return
    const first = v.after.find((k) => !doneish(k))
    if (first) { v.state = 'later'; v.waitsFor = list.find((y) => y.key === first)?.short }
  })
  return list
}

export function stepCounts(steps: StepView[]) {
  const counted = steps.filter((x) => x.state !== 'na')
  return { done: counted.filter((x) => x.state === 'done').length, total: counted.length, bad: counted.filter((x) => x.state === 'bad').length }
}

/** where each step of a project would be due: its own date, else before the start */
export function stepDueIso(s: Store, j: Job, v: StepView): string | undefined {
  return v.due || s.prep[j.id]?.targetISO
}

/** what's on someone's plate from the checklists: the steps that are their turn now */
export function stepTodos(s: Store, who: PersonKey | 'all'): { job: Job; step: StepView }[] {
  const out: { job: Job; step: StepView }[] = []
  /* a single task can cover one kind of step everywhere ("6 projects ready — book them" covers every installer step) */
  const covered = new Set(s.tasks.filter((t) => t.state === 'now' && t.step?.startsWith('*:')).map((t) => `${t.owner}:${t.step!.slice(2)}`))
  Object.values(s.jobs).filter(isGettingReady).forEach((j) => {
    stepsFor(s, j).forEach((v) => {
      if (v.taskId) return
      if (!(v.state === 'now' || v.state === 'bad' || (v.state === 'wait' && v.due && v.due <= TODAY))) return
      if (who !== 'all' && v.owner !== who) return
      if (covered.has(`${v.owner}:${v.key}`)) return
      out.push({ job: j, step: v })
    })
  })
  return out
}

/* ================= moves ================= */
const me = () => meOf(S().role)
/** the steps that open when this one is done, and who gets them */
function nextUp(s: Store, j: Job, key: string): { who: PersonKey; what: string }[] {
  const before = stepsFor(s, j)
  return before
    .filter((v) => v.state === 'later' && v.after.includes(key) && v.after.every((k) => k === key || ['done', 'na'].includes(before.find((y) => y.key === k)?.state || 'done')))
    .map((v) => ({ who: v.owner, what: `${v.short} · ${j.name}` }))
}

/** check off a step you own (your own steps, or one done outside the system) */
export function markStep(jobId: string, key: string, note?: string) {
  const s = S()
  const j = s.jobs[jobId]
  const def = defsFor(s, jobId).find((d) => d.key === key)
  if (!j || !def) return
  const to = nextUp(s, j, key)
  s.commit((st) => {
    const r = ((st.stepRecs[jobId] ||= {})[key] ||= {})
    r.done = NOW
    r.by = me()
    if (note) r.note = note
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'field', title: `${def.short}: done`, detail: note } as any)
  }, `${def.short} — done`, { sub: to.length ? 'The next steps are on their lists now.' : 'Checked off on the project.', to: to.length ? to : undefined, close: false })
}
export function reopenStep(jobId: string, key: string) {
  S().commit((st) => { const r = st.stepRecs[jobId]?.[key]; if (r) { delete r.done; delete r.by } }, 'Back on the list')
}
export function skipStep(jobId: string, key: string, na: boolean) {
  S().commit((st) => { const r = ((st.stepRecs[jobId] ||= {})[key] ||= {}); if (na) r.na = true; else delete r.na }, na ? 'Not needed on this project' : 'Back on the list')
}
export function setStepOwner(jobId: string, key: string, owner: PersonKey) {
  const s = S()
  const t = taskForStep(s, jobId, key)
  s.commit((st) => {
    ;((st.stepRecs[jobId] ||= {})[key] ||= {}).owner = owner
    if (t) { const x = st.tasks.find((y) => y.id === t.id); if (x) x.owner = owner }
  }, `${PEOPLE[owner].name} has it now`, { to: [{ who: owner, what: defsFor(s, jobId).find((d) => d.key === key)?.short || 'Step' }] })
}
export function setStepDue(jobId: string, key: string, label: string) {
  const iso = isoFromLabel(label)
  S().commit((st) => { ((st.stepRecs[jobId] ||= {})[key] ||= {}).due = iso }, `Due ${labelFromIso(iso)}`)
}

/** the store ordered the tile: when is it coming, and who checks it in that day */
export function markTileOrdered(jobId: string, when: string, receiver: PersonKey) {
  const s = S()
  const j = s.jobs[jobId]
  const iso = isoFromLabel(when) || addDays(TODAY, 3)
  s.commit((st) => {
    const r = (st.stepRecs[jobId] ||= {})
    r.order = { ...(r.order || {}), done: NOW, by: me(), note: `Ordered · delivery ${labelFromIso(iso)}` }
    r.delivered = { ...(r.delivered || {}), due: iso, owner: receiver }
    if (st.prep[jobId]) st.prep[jobId].tile = 'no'
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'material', title: 'Tile ordered by the store', detail: `Delivery ${labelFromIso(iso)} — ${PEOPLE[receiver].name} checks it in` } as any)
  }, 'Tile marked ordered', { sub: `It shows on ${PEOPLE[receiver].short}’s list on ${labelFromIso(iso) === 'Today' ? 'today' : labelFromIso(iso)} to check it in.`, to: [{ who: receiver, what: `Check in the tile at ${j?.name} · ${labelFromIso(iso)}` }] })
}
/** the tile came: all of it, or report what's short */
export function checkInTile(jobId: string) {
  const s = S()
  const j = s.jobs[jobId]
  const to = j ? nextUp(s, j, 'delivered') : []
  s.commit((st) => {
    const r = ((st.stepRecs[jobId] ||= {}).delivered ||= {})
    r.done = NOW
    r.by = me()
    r.note = `All here · checked in ${NOW}`
    if (st.prep[jobId]) st.prep[jobId].tile = 'yes'
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'material', title: 'Tile delivered — all of it', detail: 'Counted on site' } as any)
  }, 'Tile checked in — all of it', { sub: 'The project shows it on site.', to: to.length ? to : undefined })
}

/* ---------------- your own steps ---------------- */
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) + '-' + Date.now().toString(36).slice(-4)
export function addJobStep(jobId: string, label: string, owner: PersonKey, after?: string) {
  const key = slug(label)
  S().commit((st) => {
    ;(st.jobSteps[jobId] ||= []).push({ key, label, short: label.split(/\s+/).slice(0, 3).join(' '), owner, after: after ? [after] : [], custom: true })
  }, 'Step added', { sub: 'Only on this project.', to: [{ who: owner, what: label }] })
}
export function removeJobStep(jobId: string, key: string) {
  S().commit((st) => { st.jobSteps[jobId] = (st.jobSteps[jobId] || []).filter((d) => d.key !== key) }, 'Step removed')
}
export function addCompanyStep(label: string, owner: PersonKey, after?: string) {
  const key = slug(label)
  S().commit((st) => {
    st.rules.steps = [...companySteps(st), { key, label, short: label.split(/\s+/).slice(0, 3).join(' '), owner, after: after ? [after] : ['rooms'], custom: true }]
  }, 'Added to every project’s checklist', { to: [{ who: owner, what: label }] })
}
export function removeCompanyStep(key: string) {
  S().commit((st) => { st.rules.steps = companySteps(st).filter((d) => d.key !== key) }, 'Removed from the checklist')
}
export function setCompanyStepOwner(key: string, owner: PersonKey | 'matBy') {
  S().commit((st) => { st.rules.steps = companySteps(st).map((d) => (d.key === key ? { ...d, owner } : d)) }, 'Saved — new projects follow it')
}
export function renameCompanyStep(key: string, label: string) {
  S().commit((st) => { st.rules.steps = companySteps(st).map((d) => (d.key === key ? { ...d, label, short: d.custom ? label.split(/\s+/).slice(0, 3).join(' ') : d.short } : d)) }, 'Renamed')
}
