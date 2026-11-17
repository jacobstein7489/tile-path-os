/* One job, one project — never the same job twice.
 * Asana can hold a job twice: its estimate (still "waiting for the client's OK") and the job itself (won). Brought in,
 * that made two projects — renaming one left the other with the old name, in search and on Estimates. Now the import
 * keeps one (asanalist), and a double already brought in is put together by itself when the data comes in: the
 * estimate goes onto the project (approved — the project is won), with its files, tasks, messages and history, and the
 * copy is gone, from everywhere. Nothing for anyone to do.
 * Only when it's plain: both brought in from Asana, the same number and street, the project with no estimate of its
 * own, one of each. */
import { produce } from 'immer'
import { addHist, NOW, type Data } from '@/tileos/store'
import { PRICING_STAGES, type Job, type PersonKey } from '@/tileos/data/model'
import { streetOf } from './asanalist'

const fromAsana = (d: Data, id: string) => (d.hist?.[id] || []).some((h) => /^Brought in from Asana/.test(h?.title || ''))
const streetOfJob = (j: Job) => streetOf(j?.address && !/to confirm/i.test(j.address) ? j.address : '') || streetOf(j?.name)

/** the doubles in the data: [the project, its copy] */
export function doublesOf(d: Data): [string, string][] {
  const jobs = Object.values(d.jobs || {})
  const won = jobs.filter((j) => !PRICING_STAGES.includes(j.stage) && fromAsana(d, j.id) && !(d.estimates || []).some((e) => e.jobId === j.id))
  const pairs: [string, string][] = []
  jobs.filter((j) => PRICING_STAGES.includes(j.stage) && fromAsana(d, j.id)).forEach((e) => {
    const st = streetOfJob(e)
    if (!st) return
    const m = won.filter((w) => streetOfJob(w) === st)
    if (m.length === 1) pairs.push([m[0].id, e.id])
  })
  /* one copy to a project — two at one street isn't plain */
  return pairs.filter(([p]) => pairs.filter((x) => x[0] === p).length === 1)
}

/** the copy onto the project: what's tied to it moves over, its rooms and the like where the project has none, what was
 *  said and done on both kept — then the copy is gone */
export function foldInto(st: Data, keepId: string, dropId: string, who: PersonKey) {
  const k = st.jobs[keepId]
  const drop = st.jobs[dropId]
  if (!k || !drop) return
  const won = !PRICING_STAGES.includes(k.stage)
  const hadEstimate = st.estimates.some((e) => e.jobId === keepId)
  const move = (list: { jobId?: string }[] | undefined) => (list || []).forEach((x) => { if (x.jobId === dropId) x.jobId = keepId })
  move(st.estimates); move(st.tasks); move(st.money); move(st.pos); move(st.ipos); move(st.files); move(st.events as any); move(st.punch)
  move(st.checks); move(st.bookings); move(st.shortages as any); move(st.notices as any); move(st.ready as any); move(st.mats as any)
  const take = (rec: Record<string, any> | undefined, empty: (v: any) => boolean) => { if (rec && rec[dropId] !== undefined && (rec[keepId] === undefined || empty(rec[keepId]))) rec[keepId] = rec[dropId] }
  const none = (v: any) => (Array.isArray(v) ? !v.length : !v || !Object.keys(v).length)
  take(st.rooms, none); take(st.tiles, none); take(st.prep, none); take(st.pricing, none); take(st.stepRecs, none); take(st.jobSteps as any, none)
  const join = (rec: Record<string, any[]> | undefined) => { if (rec?.[dropId]?.length) rec[keepId] = [...(rec[keepId] || []), ...rec[dropId]] }
  join(st.hist as any); join(st.messages as any); join(st.notes as any); join(st.diary as any)
  /* the project is won: its estimate is the approved one, and pricing it is over */
  if (won && !hadEstimate) {
    const e = st.estimates.find((x) => x.jobId === keepId)
    if (e && e.status !== 'approved') {
      e.status = 'approved'
      e.approvedOn = NOW
      const r = [...e.revs].reverse().find((x) => x.status === 'sent') || e.revs[e.revs.length - 1]
      if (r) { e.revs.forEach((x) => { if (x !== r && x.status === 'sent') x.status = 'superseded' }); r.status = 'approved' }
      e.log.push({ date: NOW, who, text: `Approved — it’s ${k.name}` })
    }
  }
  if (won) st.tasks.forEach((t) => { if (t.jobId === keepId && t.type === 'Pricing' && t.state !== 'done' && !t.step) { t.state = 'done'; t.doneAt = 'Just now'; t.log.push({ date: NOW, who, text: `Done — ${k.name} is the project` }) } })
  delete st.jobs[dropId]
  delete st.rooms[dropId]; delete st.tiles[dropId]; delete st.prep[dropId]; delete st.pricing[dropId]; delete st.stepRecs[dropId]; delete (st.jobSteps as any)[dropId]
  delete (st.hist as any)[dropId]; delete (st.messages as any)[dropId]; delete (st.notes as any)[dropId]; delete (st.diary as any)[dropId]
  addHist(st, keepId, { who, kind: 'setup', title: `${drop.name} is part of this project`, detail: 'Asana had this job twice — its estimate and the job. One project now: the estimate, its files, tasks and history are here.' })
}

/** the data with each double put together — null when there's none */
export function oneJobEach(d: Data, who: PersonKey = 'ys'): Data | null {
  const pairs = doublesOf(d)
  if (!pairs.length) return null
  return produce(d, (st) => { pairs.forEach(([keep, drop]) => foldInto(st as Data, keep, drop, who)) })
}
