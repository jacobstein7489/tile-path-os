/* The getting-ready checklist — one list per project, every step with the person who has it.
 *
 * Built-in steps read themselves from what really happened: the paperwork uploaded and matched, its quantities, the
 * meeting on the calendar, heights measured, the installer's PO and his yes, our materials ordered and delivered, the
 * store's tile delivery, the deposit. Your own steps (Settings → Checklists, or "Add a step" on one project) are
 * checked off by whoever has them.
 *
 * A step opens when the steps it waits for are done — and then it's on its owner's Today. That's the hand-off:
 * nobody has to tell the next person; the list moves by itself. Anything we're waiting on (the store, the installer,
 * a delivery) comes back on that person's Today on the day it's due: "did it come?" */
import { useStore, meOf, newTask, NOW, type Store } from '@/tileos/store'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Role } from '@/tileos/data/model'
import { needWithWaste, type Task } from '@/tileos/data/work'
import { teamOf, EST_TEAM0 } from '@/tileos/data/estimates'
import { TODAY, addDays, isoFromLabel, labelFromIso } from '@/tileos/lib/today'
import { settingStatus } from './setting'
import { heightStatus } from './heights'
import { materialStatus } from './takeoff'
import { installerOf } from './upcoming'
import { matBy, runTaskAction } from './flows'
import { companyTeam } from './estflow'
import { REAL } from '@/tileos/lib/save'

/* ---------------- who a step really goes to ----------------
 * The real app starts with login spots for each part of the work ("Estimator", "Accounting"…) that a person takes
 * when they join. A spot nobody has taken isn't a person — a step that still points at one goes to whoever does that
 * part: from who does what, else whoever has that kind of login, else the admin. (The sample's spots are its people.) */
const SPOT: Record<string, string> = { office: 'Back office', takeoff: 'Takeoff estimator', estimator: 'Estimator', materials: 'Materials', accounting: 'Accounting' }
export function emptySpot(s: Pick<Store, 'team'>, key?: string) {
  if (!key || !SPOT[key]) return false
  const m = s.team.find((y) => y.key === key)
  return !m || (!m.uid && !m.email && !m.last && (m.first || '').trim() === SPOT[key])
}
export function realOwner(s: Store, key: PersonKey): PersonKey {
  if (!REAL.cloud || !emptySpot(s, key)) return key
  const t = companyTeam(s)
  const person = (k?: string) => (k && !emptySpot(s, k) && s.team.some((m) => m.key === k && m.status !== 'off') ? (k as PersonKey) : undefined)
  const holder = (r: string) => s.team.find((m) => m.role === r && m.status !== 'off' && !emptySpot(s, m.key))?.key as PersonKey | undefined
  const order: Record<string, (PersonKey | undefined)[]> = {
    takeoff: [person(t.takeoff), holder('takeoff')],
    estimator: [person(t.review), holder('estimator')],
    office: [holder('office'), person(t.follow)],
    materials: [person(matBy(s)), holder('site')],
    accounting: [holder('accounting')],
  }
  return (order[key] || []).find(Boolean) || holder('owner') || key
}

const S = () => useStore.getState()

export type StepState = 'done' | 'now' | 'wait' | 'later' | 'bad' | 'na'
export interface StepDef { key: string; label: string; short: string; owner: PersonKey | 'matBy'; after?: string[]; custom?: boolean; phase?: string }
export interface StepRec {
  done?: string; by?: PersonKey; owner?: PersonKey; due?: string; na?: boolean; note?: string
  /** the site check, one answer per thing looked at: good, or a problem with what's wrong */
  checks?: Record<string, { ok: boolean; note?: string }>
  /** revised quantities sent back on the paperwork — waiting for the new one */
  qty?: { at: string; to: string; text: string }
  /** waiting on someone outside (the store, the installer…) — back on the owner's Today on that day */
  wait?: { on: string; back: string; at: string }
  /** what changed from the estimate, found at the meeting or on the site walk */
  changes?: { what: string; where?: string; note?: string }[]
  /** it was late and its owner moved it to this day ("Tomorrow" on the late list) */
  moved?: string
  /** someone reminded the owner it's late — it pops up on the owner's screen */
  nudge?: { by: PersonKey; at: string; day: string }
}
/* what the site manager looks at on the site check */
export const SITE_CHECKS: { k: string; label: string; sub: string }[] = [
  { k: 'heights', label: 'Wall heights', sub: 'Measured where the tile goes up' },
  { k: 'electric', label: 'Electrical', sub: 'Boxes and wires where the layout needs them' },
  { k: 'plumbing', label: 'Plumbing', sub: 'Valves, drains and shower heads in place' },
  { k: 'water', label: 'Water on site', sub: 'Running water to mix and clean up' },
  { k: 'ready', label: 'Ready for us', sub: 'Walls done, floors clean, room to work' },
]
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
  /** who has that earlier step */
  waitsOn?: PersonKey
  action?: StepAction
  taskId?: string
  doneOn?: string
  doneBy?: PersonKey
  phase: string
}

/** the parts of getting a project ready, in the order they read on the project */
export const PHASES: { key: string; label: string }[] = [
  { key: 'paper', label: 'Tile paperwork' },
  { key: 'meet', label: 'Design meeting' },
  { key: 'site', label: 'The site' },
  { key: 'installer', label: 'The installer' },
  { key: 'deliver', label: 'Deliveries' },
  { key: 'money', label: 'Deposit' },
  { key: 'own', label: 'Your own steps' },
]

/* the company's checklist, in the order Cobblestone works once a project is won: the paperwork first (someone gets it
 * from the store, the takeoff person enters it and checks the quantities), then the meeting, the site, the installer
 * and the deliveries. The meeting, the estimate check after it, the layouts and showing the installer the job are
 * checked off (or set on the calendar); the rest read themselves from what happened. */
export const STEP_DEFAULTS: StepDef[] = [
  { key: 'getpaper', phase: 'paper', label: 'Get the tile paperwork from the store', short: 'Get the paperwork', owner: 'estimator' },
  { key: 'rooms', phase: 'paper', label: 'Enter the tile paperwork — every tile matched to the estimate', short: 'Enter the paperwork', owner: 'takeoff', after: ['getpaper'] },
  { key: 'qty', phase: 'paper', label: 'Quantities on the paperwork are enough', short: 'Quantities', owner: 'takeoff', after: ['rooms'] },
  { key: 'design', phase: 'meet', label: 'Design meeting', short: 'Design meeting', owner: 'office', after: ['rooms'], custom: true },
  { key: 'change', phase: 'meet', label: 'What was decided at the meeting — confirmed', short: 'Confirm what was decided', owner: 'office', after: ['design'], custom: true },
  { key: 'tile', phase: 'meet', label: 'Grout and a picture for every tile', short: 'Grout and pictures', owner: 'estimator', after: ['rooms'] },
  { key: 'layouts', phase: 'meet', label: 'Layouts drawn', short: 'Layouts', owner: 'office', after: ['design'], custom: true },
  { key: 'heights', phase: 'site', label: 'Site checked — heights, water, electrical, plumbing', short: 'Site check', owner: 'yakov', after: ['rooms'] },
  { key: 'setup', phase: 'site', label: 'Underlayment and setup decided', short: 'Setup', owner: 'yakov', after: ['rooms'] },
  { key: 'installer', phase: 'installer', label: 'Installer picked — his PO sent', short: 'Installer PO', owner: 'ys', after: ['rooms'] },
  { key: 'walk', phase: 'installer', label: 'Job shown to the installer', short: 'Show him the job', owner: 'yakov', after: ['installer'], custom: true },
  { key: 'confirmed', phase: 'installer', label: 'Installer confirmed — he took the PO and the dates', short: 'Installer confirmed', owner: 'ys', after: ['installer'] },
  { key: 'materials', phase: 'deliver', label: 'Our materials ordered', short: 'Order materials', owner: 'matBy', after: ['setup', 'heights'] },
  { key: 'matin', phase: 'deliver', label: 'Our materials delivered', short: 'Materials delivered', owner: 'matBy', after: ['materials'] },
  { key: 'order', phase: 'deliver', label: 'Tile delivery date from the store', short: 'Tile delivery date', owner: 'office', after: ['rooms'] },
  { key: 'delivered', phase: 'deliver', label: 'Tile delivered and counted', short: 'Tile delivered', owner: 'yakov', after: ['order'] },
  { key: 'deposit', phase: 'money', label: 'Deposit invoiced and paid', short: 'Deposit', owner: 'accounting' },
]
/** the built-in steps before the paperwork was split (a company's saved list from then still has these) */
const OLD_KEYS = new Set(['rooms', 'tile', 'design', 'installer', 'setup', 'order', 'deposit', 'heights', 'materials', 'delivered', 'walk'])
const OURS = new Set(STEP_DEFAULTS.map((d) => d.key))
export const BUILT_IN = new Set(STEP_DEFAULTS.filter((d) => !d.custom).map((d) => d.key))

export const READY_STAGES = ['awarded', 'setup', 'verification', 'ready', 'scheduled']
export const isGettingReady = (j: Job) => j.kind !== 'repair' && READY_STAGES.includes(j.stage)
/** the company's checklist: ours, in our order, with whoever the company put on each step — plus its own steps.
 *  A list saved before the paperwork was split gets the new steps, and keeps only the people the company really changed. */
const OLD_OWNER: Record<string, string> = { rooms: 'estimator', tile: 'estimator', design: 'office', installer: 'ys', setup: 'office', order: 'office', deposit: 'accounting', heights: 'yakov', materials: 'matBy', delivered: 'yakov', walk: 'yakov' }
export const STEPS_V = 2
/* names a step had before it was renamed — a company list saved with the old name gets the new one */
const RENAMED = new Set(['Estimate still right after the meeting', 'Estimate check'])
export function companySteps(s: Pick<Store, 'rules'>): StepDef[] {
  const saved = s.rules.steps
  if (!saved?.length) return STEP_DEFAULTS
  const fresh = (s.rules.stepsV || 1) >= STEPS_V
  const had = new Set(saved.map((d) => d.key))
  const ours = STEP_DEFAULTS.filter((d) => had.has(d.key) || (!fresh && !OLD_KEYS.has(d.key))).map((d) => {
    const x = saved.find((y) => y.key === d.key)
    if (!x) return d
    if (fresh) return { ...d, owner: x.owner, label: x.label && !RENAMED.has(x.label) ? x.label : d.label, short: x.short && !RENAMED.has(x.short) ? x.short : d.short }
    return x.owner !== OLD_OWNER[d.key] ? { ...d, owner: x.owner } : d
  })
  const own = saved.filter((d) => !OURS.has(d.key)).map((d) => ({ ...d, custom: true, phase: d.phase || 'own' }))
  return [...ours, ...own]
}
/** save the company's list — always the whole list, marked with this version */
function saveSteps(st: Store, list: StepDef[]) {
  st.rules.steps = list.map((d) => ({ ...d }))
  st.rules.stepsV = STEPS_V
}
/** the company's people on every step at once (the Who does what window) — inside a commit */
export function setCompanyOwners(st: Store, owners: Record<string, PersonKey | 'matBy'>) {
  saveSteps(st, companySteps(st).map((d) => (owners[d.key] ? { ...d, owner: owners[d.key] } : d)))
}
/** the scope — rooms, square feet, which tile goes where — belongs to whoever enters the tile paperwork. Until that's
 *  done anyone can fill it in; once it's done it's locked: only its owner changes it (the admin can hand it to someone
 *  else, from Who does what or the step). */
export function scopeLock(s: Store, jobId: string): { owner: PersonKey; done: boolean; canEdit: boolean } {
  const j = s.jobs[jobId]
  const def = companySteps(s).find((d) => d.key === 'rooms')
  const rec = s.stepRecs[jobId]?.rooms
  const owner = realOwner(s, (rec?.owner || (def ? (def.owner === 'matBy' ? matBy(s) : def.owner) : 'takeoff')) as PersonKey)
  const me = meOf(s.role)
  /* the site manager, the books, the crew and the client see the scope — they don't change it */
  if (['site', 'accounting', 'crew', 'client', 'materials'].includes(s.role)) return { owner, done: !!rec?.done, canEdit: false }
  if (!j || ['request', 'estimating', 'proposal', 'followup'].includes(j.stage)) return { owner, done: false, canEdit: true }
  const tiled = (s.rooms[jobId] || []).flatMap((r) => r.surfaces).filter((x) => takesTile(x.name))
  const done = !!rec?.done || !['awarded', 'setup'].includes(j.stage) || (tiled.length > 0 && tiled.every((x) => x.tile))
  return { owner, done, canEdit: !done || me === owner }
}
/** a wall or floor that gets tile — not the underlayment, waterproofing, metals or drains under and around it */
export const takesTile = (name: string) => !/underlay|waterproof|membrane|metal|schluter|trim|drain|skim|mud bed|self.?level|prep|saddle|threshold/i.test(name)
const defsFor = (s: Store, jobId: string): (StepDef & { only?: boolean })[] => [...companySteps(s), ...(s.jobSteps[jobId] || []).map((d) => ({ ...d, only: true }))]

/** the open task that is this step, if someone already has one */
export function taskForStep(s: Pick<Store, 'tasks'>, jobId: string, key: string): Task | undefined {
  return s.tasks.find((t) => t.step === `${jobId}:${key}` && (t.state === 'now' || t.state === 'waiting'))
}

/** one tile: how much the paperwork has against what its walls and floors need, with the extra for cuts */
export function paperQty(s: Store, jobId: string, t: { tag: string; paper?: { qty: number; unit: 'SF' | 'boxes' }; boxSF?: number }) {
  const on = (s.rooms[jobId] || []).flatMap((r) => r.surfaces).filter((x) => x.tile === t.tag)
  const isWallName = (n: string) => !/floor|hearth|step|landing|threshold|saddle/i.test(n)
  const needSF = Math.ceil(on.reduce((n, x) => n + (x.sf || 0) * (1 + ((isWallName(x.name) ? s.rules.waste?.walls : s.rules.waste?.floors) ?? 10) / 100), 0))
  const unit = t.paper?.unit || 'SF'
  const sf = on.reduce((n, x) => n + (x.sf || 0), 0)
  const need = !on.length || !sf ? undefined : unit === 'boxes' ? (t.boxSF ? Math.ceil(needSF / t.boxSF) : undefined) : needSF
  const have = t.paper?.qty
  return { tag: t.tag, on: on.length, need, have, unit, short: have != null && need != null ? Math.max(0, need - have) : 0 }
}

type Raw = { state: StepState; note?: string; due?: string; action?: StepAction }
function builtIn(s: Store, j: Job, key: string, rec: StepRec): Raw | null {
  const rooms = s.rooms[j.id] || []
  const flat = rooms.flatMap((r) => r.surfaces)
  const openJob = (tab: string) => () => s.open({ t: 'job', id: j.id, tab })
  switch (key) {
    case 'getpaper': {
      const files = s.files.filter((f) => f.jobId === j.id && f.kind === 'paperwork')
      const last = files[files.length - 1]
      if (rec.done) return { state: 'done', note: rec.note || 'Got it' }
      if (last) return { state: 'done', note: `${last.name} · uploaded ${last.at}` }
      if (Object.values(s.tiles[j.id] || {}).some((t) => t.paper)) return { state: 'done', note: 'Entered from the paperwork' }
      const tiled = flat.filter((x) => takesTile(x.name))
      if (tiled.length && tiled.every((x) => x.tile)) return { state: 'done', note: 'In — every wall and floor has its tile' }
      if (!['awarded', 'setup'].includes(j.stage)) return { state: 'done', note: 'In before this list' }
      return { state: 'now', note: 'Ask the tile store for it, then upload it here', action: { label: 'Get it' } }
    }
    case 'rooms': {
      if (!rooms.length) return { state: 'now', note: 'No rooms yet — they come from the estimate', action: { label: 'Add the rooms' } }
      const tiled = flat.filter((x) => takesTile(x.name))
      const picked = tiled.filter((x) => x.tile).length
      if (rec.done) return { state: 'done', note: rec.note || 'Every tile is matched to its walls and floors' }
      if (!['awarded', 'setup'].includes(j.stage)) return { state: 'done', note: `${rooms.length} rooms · ${flat.length} surfaces` }
      if (tiled.length && picked === tiled.length) return { state: 'done', note: 'Every wall and floor has its tile' }
      return { state: 'now', note: picked ? `${picked} of ${tiled.length} walls and floors have their tile` : 'Upload it — AI matches every tile to the walls and floors', action: { label: 'Enter it' } }
    }
    case 'qty': {
      if (rec.done) return { state: 'done', note: rec.note || 'Checked' }
      if (!['awarded', 'setup'].includes(j.stage)) return { state: 'done', note: 'Checked before this list' }
      const rows = Object.values(s.tiles[j.id] || {}).map((t) => paperQty(s, j.id, t)).filter((r) => r.on > 0)
      if (!rows.length) return { state: 'now', note: 'After the tile is matched to the walls and floors' }
      const sent = rec.qty || s.stepRecs[j.id]?.rooms?.qty
      const short = rows.filter((r) => r.short > 0)
      const blank = rows.filter((r) => r.have == null)
      if (sent && (short.length || blank.length)) {
        const back = addDays(isoFromLabel(sent.at) || TODAY, 2)
        return { state: 'wait', due: back, note: `Revised quantities sent ${sent.at} — waiting for the new paperwork`, action: { label: 'Check it' } }
      }
      if (short.length) return { state: 'bad', note: short.map((r) => `${r.tag} is ${r.short.toLocaleString('en-US')} ${r.unit === 'boxes' ? 'boxes' : 'SF'} short`).join(' · '), action: { label: 'Send revised quantities' } }
      if (blank.length) return { state: 'now', note: `How much does the paperwork have of ${blank.slice(0, 3).map((r) => r.tag).join(', ')}${blank.length > 3 ? '…' : ''}?`, action: { label: 'Check it' } }
      return { state: 'done', note: 'Enough of every tile, with the extra for cuts' }
    }
    case 'tile': {
      const tiles = Object.values(s.tiles[j.id] || {}).filter((t) => flat.some((x) => x.tile === t.tag))
      if (!tiles.length) return { state: 'now', note: 'After the paperwork is entered' }
      if (!['awarded', 'setup'].includes(j.stage)) return { state: 'done', note: 'Picked before this list' }
      const noGrout = tiles.filter((t) => !t.grout).length
      const noPic = tiles.filter((t) => !t.photo && !t.swatch).length
      if (!noGrout && !noPic) return { state: 'done', note: 'Every tile has its grout and a picture' }
      return { state: 'now', note: [noGrout ? `${noGrout} tile${noGrout === 1 ? '' : 's'} need${noGrout === 1 ? 's' : ''} a grout` : '', noPic ? `${noPic} need${noPic === 1 ? 's' : ''} a picture` : ''].filter(Boolean).join(' · '), action: { label: 'Pick them' } }
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
      const answers = rec.checks || {}
      const n = Object.keys(answers).length
      const bad = Object.entries(answers).filter(([, c]) => !c.ok)
      if (rec.done) return { state: 'done', note: rec.note || 'Checked on site' }
      if (bad.length) return { state: 'bad', note: bad.map(([k, c]) => `${SITE_CHECKS.find((x) => x.k === k)?.label || k}${c.note ? ` — ${c.note}` : ''}`).join(' · '), action: { label: 'Open the site check' } }
      /* heights already measured (before this checklist had the rest) */
      if (hs.total && hs.measured === hs.total && !n) return { state: 'done', note: 'Square feet and materials follow the real heights' }
      /* projects past the site check had theirs taken before this list existed */
      if (['ready', 'scheduled'].includes(j.stage) && !n && !s.tasks.some((t) => t.step === `${j.id}:heights` && t.state !== 'done')) return { state: 'done', note: 'Checked at the site visit' }
      return { state: 'now', note: n ? `${n} of ${SITE_CHECKS.length} checked` : hs.total ? `Heights ${hs.measured} of ${hs.total} walls · electrical, plumbing, water` : 'Electrical, plumbing, water — and heights where the layout needs them', action: { label: 'Do the site check' } }
    }
    case 'materials': {
      const ms = materialStatus(s, j.id)
      if (ms.state === 'yes') return { state: 'done', note: 'Everything the setup needs is on site' }
      if (ms.state === 'wait') return { state: 'done', note: `Ordered — ${ms.hint.replace(/ — on the way$/, '')}` }
      if (rec.done) return { state: 'done', note: rec.note || 'Ordered' }
      if (ms.go === 'scope') return { state: 'now', note: ms.hint, action: { label: 'Open scope', run: openJob('scope') } }
      return { state: 'now', note: `${ms.label} — worked out from the setup and square feet`, action: { label: 'Order materials', run: () => s.open({ t: 'newpo', jobId: j.id, fromTakeoff: true }) } }
    }
    case 'matin': {
      const open = s.pos.filter((p) => p.jobId === j.id && p.step >= 1 && p.step < 3)
      if (rec.done) return { state: 'done', note: rec.note || 'On site' }
      if (open.length) {
        const dueOf = (p: (typeof open)[number]) => isoFromLabel((p.eta || '').replace(/^(Was|Asked for|Due)\s+/i, '')) || undefined
        const first = open.map((p) => ({ p, iso: dueOf(p) })).sort((x, y) => (x.iso || '9999').localeCompare(y.iso || '9999'))[0]
        const what = `${first.p.id} from ${first.p.supplier}`
        if (first.iso && first.iso > TODAY) return { state: 'wait', due: first.iso, note: `${what} · coming ${labelFromIso(first.iso)}${open.length > 1 ? ` · ${open.length - 1} more on the way` : ''}`, action: { label: 'It came' } }
        if (first.iso) return { state: 'now', due: first.iso, note: first.iso < TODAY ? `${what} was due ${labelFromIso(first.iso)} — did it come?` : `${what} is due today — did it come?`, action: { label: 'It came' } }
        return { state: 'wait', note: `${what} — no delivery date yet`, action: { label: 'It came' } }
      }
      const ms = materialStatus(s, j.id)
      if (ms.state === 'yes') return { state: 'done', note: 'Everything the setup needs is on site' }
      return { state: 'now', note: 'After the order goes out' }
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
      if (ipo?.status === 'Accepted' || ipo?.status === 'Sent') return { state: 'done', note: `${ipo.id} sent to ${PEOPLE[ipo.crew].name}` }
      if (ipo?.status === 'Draft') return { state: 'now', note: `${ipo.id} for ${PEOPLE[ipo.crew].short} — saved, not sent yet`, action: { label: 'Send his PO', run: () => s.open({ t: 'ipo', id: ipo.id }) } }
      if (ipo?.status === 'Rejected') return { state: 'bad', note: `${PEOPLE[ipo.crew].short} turned it down — pick someone else`, action: { label: 'Pick an installer' } }
      if (!['awarded', 'setup', 'verification'].includes(j.stage) && crew) return { state: 'done', note: `${PEOPLE[crew].name} has it` }
      return { state: 'now', note: crew ? `${PEOPLE[crew].short} is penciled in — his PO isn’t out` : 'Nobody picked yet', action: { label: crew ? 'Send his PO' : 'Pick an installer' } }
    }
    case 'confirmed': {
      const ipo = [...s.ipos].reverse().find((p) => p.jobId === j.id)
      if (ipo?.status === 'Accepted') return { state: 'done', note: `${PEOPLE[ipo.crew].name} took ${ipo.id}${ipo.date ? ` · ${ipo.date}` : ''}` }
      if (rec.done) return { state: 'done', note: rec.note || 'Confirmed' }
      if (ipo?.status === 'Sent') {
        const sent = [...ipo.log].reverse().find((l) => /sent/i.test(l.text))?.date || ipo.date
        const back = addDays(isoFromLabel(sent) || TODAY, 2)
        return { state: 'wait', due: back, note: `${ipo.id} sent ${sent} — waiting for ${PEOPLE[ipo.crew].short} to say yes`, action: { label: 'He said yes' } }
      }
      if (ipo?.status === 'Rejected') return { state: 'bad', note: `${PEOPLE[ipo.crew].short} turned it down` }
      if (!['awarded', 'setup', 'verification'].includes(j.stage) && installerOf(s, j)) return { state: 'done', note: 'Confirmed before this list' }
      return { state: 'now', note: 'After his PO goes out' }
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
      /* the design meeting and the walkthrough: set on the calendar from here, done once they've happened */
      const ev = d.key === 'design' ? s.events.find((x) => x.jobId === j.id && /design/i.test(x.title)) : d.key === 'walk' ? s.events.find((x) => x.jobId === j.id && x.kind === 'walkthrough' && /installer|crew/i.test(`${x.title} ${x.with || ''}`)) : undefined
      if (!rec.done && !rec.na && ev) raw = ev.date < TODAY ? { state: 'done', note: `${ev.kind === 'walkthrough' ? 'Walked through' : 'Met'} ${labelFromIso(ev.date)}` } : { state: 'wait', due: ev.date, note: `Set for ${labelFromIso(ev.date)}` }
      else if (!rec.done && !rec.na && (d.key === 'design' || d.key === 'walk')) raw = { state: 'now', due: rec.due, note: d.key === 'design' ? 'With the designer or the client — tile, layout, grout' : 'Show him the job before he starts', action: { label: d.key === 'design' ? 'Set the meeting' : 'Set the walkthrough', run: () => s.open({ t: 'record', type: 'meeting', jobId: j.id, title: d.key === 'design' ? 'Design meeting' : 'Walkthrough with the installer', meetKind: d.key === 'walk' ? 'walkthrough' : 'meeting' }) } }
    }
    /* the estimate check after the meeting, and the layouts: checked off — projects past setup had theirs before this list */
    if (!raw && !rec.done && !rec.na && (d.key === 'change' || d.key === 'layouts') && !d.only && !['awarded', 'setup', 'verification'].includes(j.stage)) raw = { state: 'done', note: 'Done before this list' }
    if (!raw && !rec.done && !rec.na && d.key === 'change' && !d.only) raw = { state: 'now', due: rec.due, note: 'Send the designer and the GC what was decided — anything extra goes to the estimator', action: { label: 'Confirm it' } }
    if (!raw && !rec.done && !rec.na && d.key === 'layouts' && !d.only) raw = { state: 'now', due: rec.due, note: 'The layouts for what was picked at the meeting', action: { label: 'Mark done', pick: 'check' } }
    if (!raw) {
      raw = rec.done
        ? { state: 'done', note: rec.note }
        : rec.na
          ? { state: 'na', note: 'Not needed on this project' }
          : { state: 'now', due: rec.due, note: rec.note || (d.key === 'rough' ? 'Boxes, valves and drains where the layout needs them' : d.only ? 'Added for this project' : 'Your own step — check it off when it’s done'), action: { label: d.key === 'rough' ? 'Checked — all good' : 'Mark done', pick: 'check' } }
    }
    if (rec.na && raw.state !== 'done') raw = { state: 'na', note: 'Not needed on this project' }
    /* waiting on someone outside: off the list until the day it's due back — then "did it come?" */
    if (rec.wait && raw.state !== 'done' && raw.state !== 'na') {
      const back = rec.wait.back
      raw = back > TODAY
        ? { ...raw, state: 'wait', due: back, note: `Waiting on ${rec.wait.on} — back ${labelFromIso(back)}` }
        : { ...raw, state: 'now', due: back, note: `Asked ${rec.wait.on} ${rec.wait.at} — did it come through?` }
    }
    /* late, and its owner moved it to a later day: due that day */
    if (rec.moved && (raw.state === 'now' || raw.state === 'bad') && (raw.due || rec.due || '') < rec.moved) raw = { ...raw, due: rec.moved }
    const owner = realOwner(s, (task?.owner || rec.owner || (d.owner === 'matBy' ? matBy(s) : d.owner)) as PersonKey)
    const view: StepView = {
      key: d.key, label: d.label, short: d.short, owner, state: raw.state, note: raw.note, due: raw.due || rec.due, custom: !BUILT_IN.has(d.key) || d.only, only: d.only,
      after: d.after || [], action: raw.action, taskId: task?.id, doneOn: rec.done, doneBy: rec.by, phase: d.only ? 'own' : d.phase || 'own',
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
    if (first) { const x = list.find((y) => y.key === first); v.state = 'later'; v.waitsFor = x?.short; v.waitsOn = x?.owner }
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
export function markStep(jobId: string, key: string, note?: string, o: { close?: boolean } = {}) {
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
    delete r.qty
    /* the step's own task is done too */
    st.tasks.forEach((x) => { if (x.step === `${jobId}:${key}` && x.state !== 'done') { x.state = 'done'; x.doneAt = 'Just now'; x.log.push({ date: NOW, who: me(), text: 'Done' }) } })
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'field', title: `${def.short}: done`, detail: note } as any)
  }, `${def.short} — done`, { sub: to.length ? 'The next steps are on their lists now.' : 'Checked off on the project.', to: to.length ? to : undefined, close: !!o.close })
}

/** the paperwork's quantities are off: they went back with the right numbers — the step waits for the new paperwork */
export function sendRevisedQty(jobId: string, o: { to: string; text: string }) {
  const s = S()
  const j = s.jobs[jobId]
  if (!j) return
  const owner = stepsFor(s, j).find((v) => v.key === 'qty')?.owner || me()
  s.commit((st) => {
    const r = ((st.stepRecs[jobId] ||= {}).qty ||= {})
    r.qty = { at: NOW, to: o.to, text: o.text }
    delete r.done
    st.prep[jobId] = { ...(st.prep[jobId] || {}), paperwork: 'qty' }
    st.tasks.forEach((x) => { if ((x.step === `${jobId}:rooms` || x.step === `${jobId}:qty`) && x.state === 'now') { x.state = 'waiting'; x.waitingOn = o.to || 'the client'; x.followUp = labelFromIso(addDays(TODAY, 2)); x.log.push({ date: NOW, who: me(), text: 'Revised quantities sent' }) } })
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'material', title: 'Revised quantities sent on the tile paperwork', detail: `${o.to ? `To ${o.to} — ` : ''}${o.text.split('\n').filter((l) => /^[-•]/.test(l.trim())).join(' ').slice(0, 220)}` } as any)
  }, 'Revised quantities sent', { sub: `It waits for the new paperwork — back on ${PEOPLE[owner]?.short || 'your'}’s list in 2 days if it doesn’t come.`, close: true })
}

/** waiting on someone outside — the step comes back on its owner's Today that day */
export function waitOnStep(jobId: string, key: string, on: string, back: string) {
  const s = S()
  const iso = isoFromLabel(back) || addDays(TODAY, 2)
  const v = s.jobs[jobId] ? stepsFor(s, s.jobs[jobId]).find((x) => x.key === key) : undefined
  s.commit((st) => {
    const r = ((st.stepRecs[jobId] ||= {})[key] ||= {})
    r.wait = { on, back: iso, at: NOW }
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'field', title: `${v?.short || 'Step'}: waiting on ${on}`, detail: `Back ${labelFromIso(iso)}` } as any)
  }, `Waiting on ${on}`, { sub: `It comes back on ${v && v.owner !== me() ? `${PEOPLE[v.owner]?.short}’s` : 'your'} Today ${labelFromIso(iso) === 'Tomorrow' ? 'tomorrow' : `on ${labelFromIso(iso)}`} if it hasn’t come.`, close: true })
}
export function stopWaiting(jobId: string, key: string) {
  S().commit((st) => { const r = st.stepRecs[jobId]?.[key]; if (r) delete r.wait }, 'Not waiting any more')
}
/** our materials came — every open order for the project is on site */
export function materialsCame(jobId: string) {
  const s = S()
  const j = s.jobs[jobId]
  const open = s.pos.filter((p) => p.jobId === jobId && p.step >= 1 && p.step < 3)
  const to = j ? nextUp(s, j, 'matin') : []
  s.commit((st) => {
    st.pos.forEach((p) => {
      if (p.jobId !== jobId || p.step < 1 || p.step >= 3) return
      p.step = 3
      p.late = false
      p.note = 'Delivered'
      p.log.push({ date: NOW, who: me(), text: 'Delivered to site — all of it' })
      st.mats.forEach((m) => { if (m.po === p.id) m.status = 'delivered' })
    })
    const r = ((st.stepRecs[jobId] ||= {}).matin ||= {})
    r.done = NOW
    r.by = me()
    r.note = open.length ? `${open.map((p) => p.id).join(', ')} on site · ${NOW}` : `On site · ${NOW}`
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'material', title: 'Our materials delivered', detail: open.map((p) => `${p.id} · ${p.supplier}`).join(' · ') || undefined } as any)
  }, 'Materials on site', { sub: 'Checked in on the project.', to: to.length ? to : undefined, close: true })
}
/** not here yet: the new day it's coming — it comes back on Today then */
export function materialsLate(jobId: string, when: string) {
  const iso = isoFromLabel(when) || addDays(TODAY, 1)
  S().commit((st) => {
    st.pos.forEach((p) => {
      if (p.jobId !== jobId || p.step < 1 || p.step >= 3) return
      p.eta = labelFromIso(iso)
      p.log.push({ date: NOW, who: me(), text: `Not here yet — now ${labelFromIso(iso)}` })
    })
  }, `Coming ${labelFromIso(iso)}`, { sub: 'It comes back on your Today that day.', close: true })
}

/** what usually changes once we see the site or meet the designer — tap one, or say it */
export const CHANGE_KINDS = ['LED channel or track', 'A pattern — herringbone, chevron…', 'Bigger or different tile', 'An extra niche or bench', 'An accent wall', 'Taller walls · more square feet', 'Heated floor', 'Something else']
/** whoever reviews the estimate for this project (the office estimator) */
export function estimatorFor(s: Store, jobId: string): PersonKey {
  const est = s.estimates.find((e) => e.jobId === jobId)
  return est ? teamOf(est).review : ({ ...EST_TEAM0, ...(s.rules.estTeam || {}) }).review
}
/** what changed from the estimate at the meeting or on the site walk — it goes to the estimator to update the estimate */
export function logChanges(jobId: string, items: { what: string; where?: string; note?: string }[]) {
  const s = S()
  const j = s.jobs[jobId]
  if (!j || !items.length) return
  const est = s.estimates.find((e) => e.jobId === jobId)
  const who = estimatorFor(s, jobId)
  const role = (s.team.find((m) => m.key === who)?.role || 'estimator') as Role
  const lines = items.map((c) => `${c.what}${c.where ? ` — ${c.where}` : ''}${c.note ? ` (${c.note})` : ''}`)
  const n = items.length
  s.commit((st) => {
    const r = ((st.stepRecs[jobId] ||= {}).change ||= {})
    r.changes = items
    r.done = NOW
    r.by = me()
    r.note = `${n} change${n === 1 ? '' : 's'} — sent to ${PEOPLE[who]?.short} to update the estimate`
    newTask(st, { jobId, title: `Update the estimate · ${j.name}`, detail: lines.join('\n'), type: 'Pricing', owner: who, for: [role], state: 'now', due: 'Today', tone: 'warn', where: `From the meeting: ${lines.join(' · ').slice(0, 140)}`, action: est ? { label: 'Open the estimate', kind: 'estchange:' + est.id } : { label: 'Open', kind: 'open-job' }, log: [{ date: NOW, who: me(), text: `Changed from the estimate: ${lines.join(' · ')}` }] })
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'change', title: `${n} change${n === 1 ? '' : 's'} from the estimate`, detail: lines.join(' · ') } as any)
  }, 'Sent to update the estimate', { sub: lines.join(' · '), to: [{ who, what: `Update the estimate · ${j.name}` }], close: true })
}

/** problems found on the site check go to the office as a task, with what's wrong */
export function sendSiteProblems(jobId: string) {
  const s = S()
  const j = s.jobs[jobId]
  const bad = Object.entries(s.stepRecs[jobId]?.heights?.checks || {}).filter(([, c]) => !c.ok)
  if (!j || !bad.length) return
  const text = bad.map(([k, c]) => `${SITE_CHECKS.find((x) => x.k === k)?.label || k}${c.note ? ` — ${c.note}` : ''}`).join(' · ')
  s.commit((st) => {
    newTask(st, { jobId, title: `Site check at ${j.name}: ${bad.length === 1 ? 'a problem to fix' : `${bad.length} problems to fix`}`, detail: text, type: 'Setup', owner: 'ys', for: ['owner', 'office'], state: 'now', due: 'Today', tone: 'warn', where: 'Site check', log: [{ date: NOW, who: me(), text: `Found on the site check: ${text}` }] })
    ;(st.hist[jobId] ||= []).unshift({ date: NOW, who: me(), kind: 'field', title: 'Site check — problems found', detail: text } as any)
  }, 'Sent to the office', { sub: text, to: [{ who: 'ys', what: `Site check · ${j.name}` }], close: true })
}

/** one answer on the site check */
export function setSiteCheck(jobId: string, k: string, ok: boolean | null, note?: string) {
  S().commit((st) => {
    const r = ((st.stepRecs[jobId] ||= {}).heights ||= {})
    const c = (r.checks ||= {})
    if (ok === null) delete c[k]
    else c[k] = { ok, ...(note ? { note } : {}) }
  })
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
    saveSteps(st, [...companySteps(st), { key, label, short: label.split(/\s+/).slice(0, 3).join(' '), owner, after: after ? [after] : ['rooms'], custom: true, phase: 'own' }])
  }, 'Added to every project’s checklist', { to: [{ who: owner, what: label }] })
}
export function removeCompanyStep(key: string) {
  S().commit((st) => { saveSteps(st, companySteps(st).filter((d) => d.key !== key)) }, 'Removed from the checklist')
}
export function setCompanyStepOwner(key: string, owner: PersonKey | 'matBy') {
  S().commit((st) => { saveSteps(st, companySteps(st).map((d) => (d.key === key ? { ...d, owner } : d))) }, 'Saved — every project follows it')
}
export function renameCompanyStep(key: string, label: string) {
  S().commit((st) => { saveSteps(st, companySteps(st).map((d) => (d.key === key ? { ...d, label, short: d.custom ? label.split(/\s+/).slice(0, 3).join(' ') : d.short } : d))) }, 'Renamed')
}
