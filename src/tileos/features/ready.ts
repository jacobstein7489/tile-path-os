/* Getting a project ready, the way the office reads it — the questions on the project's checklist, in four parts:
 *   Design & setup · Site · Installer · Materials & deposit
 * Each one is answered Yes, No (with what's wrong) or N/A. Most answer themselves from what really happened (the
 * paperwork uploaded, the PO sent, the tile checked in); anyone can answer one by hand. The site check is one
 * question per thing looked at on site: the wall heights, power, water, the drains, the LED tracks, the windows…
 * A question added on one project ("Heated floor wire on site?") sits in the part it was added to. */
import { useStore, meOf, type Store } from '@/tileos/store'
import type { Job, PersonKey } from '@/tileos/data/model'
import { stepsFor, SITE_CHECKS, markStep, reopenStep, skipStep, sayNo, setSiteCheck, type StepView, type StepState } from './steps'
import { heightStatus } from './heights'

export type GroupKey = 'design' | 'site' | 'installer' | 'materials' | 'other'
export const GROUPS: { key: GroupKey; label: string; sub: string }[] = [
  { key: 'design', label: 'Design & setup', sub: 'The paperwork, the meeting, the tile and grout, the underlayment, the layouts' },
  { key: 'site', label: 'Site', sub: 'Heights, floors, power, water, drains, LED tracks, windows' },
  { key: 'installer', label: 'Installer', sub: 'His PO, showing him the job, his yes' },
  { key: 'materials', label: 'Materials & deposit', sub: 'The tile from the store, our materials, the deposit' },
  { key: 'other', label: 'Other', sub: 'Your own questions' },
]
const GROUP_OF_PHASE: Record<string, GroupKey> = { paper: 'design', setup: 'design', meet: 'design', grout: 'design', layouts: 'design', level: 'site', site: 'site', installer: 'installer', store: 'materials', materials: 'materials', money: 'materials' }

/** each step, asked the way the office asks it */
export const QUESTION: Record<string, string> = {
  getpaper: 'Tile paperwork in?',
  rooms: 'Paperwork entered?',
  qty: 'Enough tile on the paperwork?',
  design: 'Design meeting done?',
  change: 'What was decided — confirmed?',
  tile: 'Tile and grout picked?',
  setup: 'Underlayment decided?',
  layouts: 'Layouts confirmed?',
  level: 'Floors level?',
  installer: 'Installer PO sent?',
  walk: 'Job shown to the installer?',
  confirmed: 'Installer confirmed?',
  order: 'Tile ordered?',
  delivered: 'Tile delivered?',
  materials: 'Our materials ordered?',
  matin: 'Our materials on site?',
  deposit: 'Deposit paid?',
}
export const questionOf = (v: Pick<StepView, 'key' | 'label'>) => QUESTION[v.key] || (/\?$/.test(v.label.trim()) ? v.label.trim() : `${v.label.trim()}?`)

export type Answer = 'yes' | 'no' | 'na'
export interface ReadyRow {
  /** 'step:getpaper', 'site:water' */
  id: string
  kind: 'step' | 'site'
  key: string
  q: string
  sub?: string
  state: StepState
  /** what it says now — Yes when it's done (by hand or by itself), No, N/A; nothing while it's open */
  answer?: Answer
  /** the words under the question: who has it, what's wrong, what it's waiting on */
  note?: string
  owner: PersonKey
  due?: string
  doneOn?: string
  doneBy?: PersonKey
  /** the step it is (for a site question: the site check) */
  step: StepView
}
export interface ReadyGroup { key: GroupKey; label: string; sub: string; rows: ReadyRow[]; done: number; total: number; bad: number }

const isAnswered = (r: Pick<ReadyRow, 'state'>) => r.state === 'done' || r.state === 'na'

function stepRow(v: StepView): ReadyRow {
  const answer: Answer | undefined = v.no ? 'no' : v.state === 'done' ? 'yes' : v.state === 'na' ? 'na' : undefined
  return { id: 'step:' + v.key, kind: 'step', key: v.key, q: questionOf(v), state: v.state, answer, note: v.note, owner: v.owner, due: v.due, doneOn: v.doneOn, doneBy: v.doneBy, step: v }
}

/** the site check, one question per thing looked at */
function siteRows(s: Store, job: Job, v: StepView): ReadyRow[] {
  const answers = s.stepRecs[job.id]?.heights?.checks || {}
  const hs = heightStatus(s, job.id)
  const stepDone = v.state === 'done' || v.state === 'na'
  const open: StepState = v.state === 'later' ? 'later' : 'now'
  const row = (k: string, q: string, sub: string, auto?: { state: StepState; note?: string }): ReadyRow => {
    const a = answers[k]
    const base = { id: 'site:' + k, kind: 'site' as const, key: k, q, sub, owner: v.owner, due: v.due, step: v }
    if (a) return { ...base, state: a.na ? 'na' : a.ok ? 'done' : 'bad', answer: a.na ? 'na' : a.ok ? 'yes' : 'no', note: a.na ? 'Not needed here' : a.ok ? undefined : a.note ? `No — ${a.note}` : 'No', doneOn: a.at, doneBy: a.by }
    if (auto) return { ...base, state: auto.state, note: auto.note, answer: auto.state === 'done' ? 'yes' : auto.state === 'na' ? 'na' : undefined }
    if (stepDone) return { ...base, state: 'done', answer: 'yes', note: v.note, doneOn: v.doneOn, doneBy: v.doneBy }
    return { ...base, state: open }
  }
  const walls = !hs.total ? { state: 'na' as StepState, note: 'No tiled walls' }
    : hs.measured === hs.total ? { state: 'done' as StepState, note: 'Measured on site — the square feet follow' }
      : stepDone ? undefined
        : { state: open, note: hs.measured ? `${hs.measured} of ${hs.total} walls measured` : `${hs.total} walls to measure` }
  return [row('walls', 'Wall heights measured?', 'How high the tile goes on every wall — the square feet follow', walls), ...SITE_CHECKS.map((c) => row(c.k, c.q, c.sub))]
}

/** the project's checklist, part by part */
export function readyGroups(s: Store, job: Job): ReadyGroup[] {
  if (job.kind === 'repair' || ['request', 'estimating', 'proposal', 'followup', 'lost'].includes(job.stage)) return []
  const rows: Record<GroupKey, ReadyRow[]> = { design: [], site: [], installer: [], materials: [], other: [] }
  let site: ReadyRow[] = []
  stepsFor(s, job).forEach((v) => {
    if (v.key === 'heights' && !v.only) { site = siteRows(s, job, v); return }
    const g: GroupKey = (v.group as GroupKey) in rows ? (v.group as GroupKey) : GROUP_OF_PHASE[v.phase] || 'other'
    rows[g].push(stepRow(v))
  })
  /* on site: the wall heights and the floors first, then the rest of what's looked at, then any added question */
  const level = rows.site.filter((r) => r.key === 'level')
  rows.site = [...site.slice(0, 1), ...level, ...site.slice(1), ...rows.site.filter((r) => r.key !== 'level')]
  return GROUPS.map((g) => {
    const list = rows[g.key]
    return { ...g, rows: list, done: list.filter(isAnswered).length, total: list.length, bad: list.filter((r) => r.state === 'bad').length }
  }).filter((g) => g.rows.length)
}

/** how far getting ready is: questions answered, of how many, and how many say something's wrong */
export function readyCounts(groups: ReadyGroup[]) {
  const done = groups.reduce((n, g) => n + g.done, 0)
  const total = groups.reduce((n, g) => n + g.total, 0)
  const bad = groups.reduce((n, g) => n + g.bad, 0)
  return { done, total, bad, left: total - done }
}

/** who may answer: the office answers anything; the site manager and the books their own; the crew and the client look */
export function canAnswer(s: Store, r: ReadyRow) {
  if (['crew', 'client'].includes(s.role)) return false
  if (['site', 'accounting'].includes(s.role)) return r.owner === meOf(s.role)
  return true
}

/** answer one question — or take the answer back (null). A No carries what's wrong. */
export function answerRow(job: Job, r: ReadyRow, a: Answer | null, note?: string) {
  const s = useStore.getState()
  if (r.kind === 'site') {
    setSiteCheck(job.id, r.key, a === null ? null : a !== 'no', a === 'no' ? note?.trim() || undefined : undefined, a === 'na')
    /* the last question answered: the site check is done — it hands off like any step */
    if (a === 'yes' || a === 'na') {
      const after = useStore.getState()
      const v = stepsFor(after, job).find((x) => x.key === 'heights')
      if (v?.state === 'done' && !after.stepRecs[job.id]?.heights?.done) markStep(job.id, 'heights', 'Everything checked on site')
    }
    return
  }
  const rec = s.stepRecs[job.id]?.[r.key] || {}
  if (a === null) {
    if (rec.no) return sayNo(job.id, r.key, null)
    if (rec.na) return skipStep(job.id, r.key, false)
    if (rec.done) return reopenStep(job.id, r.key)
    return
  }
  if (a === 'yes') return markStep(job.id, r.key)
  if (a === 'na') return skipStep(job.id, r.key, true)
  return sayNo(job.id, r.key, note || '')
}

/** can this answer be taken back — or does the row say it by itself (from what really happened)? */
export function answeredByHand(s: Store, job: Job, r: ReadyRow) {
  if (r.kind === 'site') return !!s.stepRecs[job.id]?.heights?.checks?.[r.key]
  const rec = s.stepRecs[job.id]?.[r.key]
  return !!(rec?.no || rec?.na || rec?.done)
}

/** answers that can't be given: the row says it by itself, from what really happened */
export function lockedOf(s: Store, job: Job, r: ReadyRow): Partial<Record<Answer, string>> | undefined {
  if (answeredByHand(s, job, r)) return undefined
  if (r.state === 'done') return { yes: 'It says Yes by itself — from what happened on the project', na: 'It’s already done' }
  if (r.state === 'na') return { yes: r.note || 'Not on this project', no: r.note || 'Not on this project', na: r.note || 'Not on this project' }
  if (r.state === 'bad') return { yes: 'Fix what’s wrong first — it says Yes by itself once it’s fixed' }
  return undefined
}
