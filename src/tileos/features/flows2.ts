/* The v8 flows: estimates → projects, the installer PO loop, materials from the estimate,
 * tile selection, recurring tasks and the daily crew report. Every step logs itself with a link to its record. */
import { SURFACES } from '@/tileos/data/areas'
import { useStore, addHist, newTask, closeTasks, NOW, meOf, repeatTask } from '@/tileos/store'
import type { PersonKey, Role } from '@/tileos/data/model'
import { fmtMoney, PEOPLE, PRICING_STAGES } from '@/tileos/data/model'
import type { Room } from '@/tileos/data/jobs'
import { tileOf } from '@/tileos/data/jobs'
import { METHODS, type MethodKey } from '@/tileos/data/takeoff'
import { curRev, revTotal, teamOf, type Estimate, type EstLine } from '@/tileos/data/estimates'
import type { IPOLine } from '@/tileos/data/field'
import type { POLine } from '@/tileos/data/work'
import { nextPO } from '@/tileos/lib/utils'
import { giveTo } from './estflow'
import { peopleOn, namesOf, rolesOf, estSteps } from './estpeople'
import { matBy, matFor } from './flows'
import { mailLive, emailIPO } from './mailout'
import { shiftText, labelFromIso, workday, addDays, TODAY } from '@/tileos/lib/today'

const S = () => useStore.getState()
const me = () => meOf(S().role)
const L = (who: PersonKey, text: string) => ({ date: NOW, who, text })
let lid = 900
/** new estimate line numbers carry on after the saved ones */
export const seedLines = (n: number) => { if (n > lid) lid = n }
/** the login each person works under — where their follow-ups show up */
const FOL_ROLE: Partial<Record<PersonKey, Role>> = { ys: 'owner', office: 'office', estimator: 'estimator', takeoff: 'takeoff', yakov: 'site', materials: 'materials', accounting: 'accounting' }

/* ================= estimates ================= */
export const estOf = (s: { estimates: Estimate[] }, jobId: string) => s.estimates.find((e) => e.jobId === jobId)

export function estEditLines(estId: string, fn: (lines: EstLine[]) => EstLine[]) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    const r = curRev(e)
    if (r.status !== 'draft') return
    r.lines = fn(r.lines)
    if (e.status === 'request' && r.lines.length) {
      e.status = 'estimating'
      e.step = 'takeoff'
    }
  })
}
export const newLine = (area: string, itemId: string, qty: number, rate: number, surface?: string): EstLine => ({ id: 'el' + ++lid, area, itemId, qty, rate, ...(surface ? { surface } : {}) })

export function estStart(estId: string, who: PersonKey = 'estimator') {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    e.status = 'estimating'
    e.estimator = who
    e.log.push(L(me(), `Estimating started · ${PEOPLE[who].name}`))
    const j = s.jobs[e.jobId]
    if (j && PRICING_STAGES.includes(j.stage)) j.stage = 'estimating'
    addHist(s, e.jobId, { who: me(), kind: 'pricing', title: `Estimating started · ${e.id}`, ref: { t: 'estimate', id: e.id } })
  }, 'Estimating started')
}

export function estSend(estId: string) {
  const e0 = S().estimates.find((x) => x.id === estId)
  if (!e0) return
  const r0 = curRev(e0)
  const total = revTotal(r0)
  const team = teamOf(e0)
  /* who follows up — one or more people, the first leads */
  const fols = peopleOn(S(), e0, 'follow')
  const fol = fols[0] || team.follow
  /* the follow-up lands a few work days out */
  const fu = labelFromIso(workday(addDays(TODAY, 3)))
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)!
    e.revs.forEach((r) => {
      if (r.status === 'sent') r.status = 'superseded'
    })
    const r = curRev(e)
    r.status = 'sent'
    r.sentOn = NOW
    e.status = 'sent'
    e.followUp = fu
    e.log.push(L(me(), `Revision ${r.n} sent · ${fmtMoney(total)}`))
    const j = s.jobs[e.jobId]
    if (j) {
      if (PRICING_STAGES.includes(j.stage)) j.stage = 'followup'
      j.keyDate = { label: 'Sent', value: NOW }
      j.next = { text: `Follow up on revision ${r.n}`, owner: fol, due: fu }
      j.headline = `Revision ${r.n} sent today`
      j.status = 'ok'
    }
    const p = s.pricing[e.jobId]
    if (p) {
      p.revs.forEach((x) => { if (x.status === 'Sent') x.status = 'Superseded' })
      p.revs = p.revs.filter((x) => x.r !== 'R' + r.n)
      p.revs.push({ r: 'R' + r.n, date: NOW, amount: total, status: 'Sent', what: r.what })
      p.nextFollowUp = fu
    }
    closeTasks(s, s.tasks.filter((t) => t.jobId === e.jobId && t.state !== 'done' && t.type === 'Pricing').map((t) => t.id), 'Estimate sent')
    if (!(s.rules.autoOff || []).includes('est-followup')) newTask(s, { jobId: e.jobId, title: `Follow up on ${e.id} · ${j?.name}`, type: 'Pricing', owner: fol, also: fols.length > 1 ? fols.slice(1) : undefined, for: fols.length ? rolesOf(s as any, fols) : [FOL_ROLE[fol] || 'office'], watch: ['owner'], state: 'waiting', waitingOn: 'Client', followUp: fu, tone: 'neutral', where: `Revision ${r.n} · ${fmtMoney(total)} · sent ${NOW}`, action: { label: 'Open estimate', kind: 'estimate:' + e.id } })
    addHist(s, e.jobId, { who: me(), kind: 'pricing', title: `${e.id} revision ${r.n} sent · ${fmtMoney(total)}`, ref: { t: 'estimate', id: e.id } })
  }, `${e0.id} sent — it’s ${namesOf(fols.length ? fols : [fol], null, true)}’s now`, { close: true, sub: `${namesOf(fols.length ? fols : [fol])} ${fols.length > 1 ? 'follow' : 'follows'} up with ${S().jobs[e0.jobId]?.client || 'the client'} ${fu === 'Today' ? 'today' : fu} — it’s on their Today. Yes makes it a project; changes start the next revision.`, flow: [...estSteps(S()).map((x) => ({ who: peopleOn(S(), e0, x.key)[0], label: x.label, state: 'done' as const })), { who: fol, label: 'Follows up', state: 'now' }, { label: 'Client', state: 'next' }] })
}

/** the client wants changes: a new revision, with each thing they asked for as a note to check off */
export function estRevise(estId: string, what: string, o: { changes?: { text: string; area?: string }[]; asked?: string } = {}) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    const last = curRev(e)
    e.revs.push({ n: last.n + 1, date: NOW, status: 'draft', what: what || 'Revision', asked: o.asked, lines: last.lines.map((l) => ({ ...l, id: 'el' + ++lid })) })
    ;(o.changes || []).forEach((c, i) => (e.notes ||= []).push({ id: 'nt' + Date.now().toString(36) + i, rev: last.n + 1, by: me(), step: 'review', area: c.area, text: c.text, date: NOW }))
    e.status = 'revision'
    e.backTo = undefined
    e.log.push(L(me(), `Revision ${last.n + 1} started — ${what || 'changes requested'}`))
    const j = s.jobs[e.jobId]
    if (j && PRICING_STAGES.includes(j.stage)) j.stage = 'proposal'
    /* a revision walks the same path: takeoff, office review, owner review */
    giveTo(s, e, 'takeoff')
    addHist(s, e.jobId, { who: me(), kind: 'pricing', title: `Revision ${last.n + 1} requested · ${what || 'changes'}`, ref: { t: 'estimate', id: e.id } })
  }, `Revision started — it’s on ${namesOf(peopleOn(S(), S().estimates.find((x) => x.id === estId)!, 'takeoff'))}’s Today`)
}

export function estLost(estId: string, reason: string) {
  const e0 = S().estimates.find((x) => x.id === estId)
  if (!e0) return
  const j0 = S().jobs[e0.jobId]
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)!
    e.status = 'lost'
    e.log.push(L(me(), `Marked lost — ${reason}`))
    if (j0) s.lost.unshift({ name: j0.name, client: j0.client, reason, date: NOW })
    closeTasks(s, s.tasks.filter((t) => t.jobId === e.jobId && t.state !== 'done').map((t) => t.id), 'Lost')
  }, `${e0.id} marked lost`)
}

/* an approved estimate builds the project's rooms: every line that tiles a surface becomes that surface; the lines
 * that aren't tile — underlayment, waterproofing, metals, a saddle, a drain — become details of the room's surfaces */
const NOT_TILE: Record<string, (x: { name: string }) => Partial<Record<'prep' | 'edge' | 'notes', string>> | null> = {
  under: (x) => (/floor/i.test(x.name) ? { prep: 'Uncoupling membrane' } : null),
  mud: (x) => (/floor/i.test(x.name) ? { prep: 'Mud bed' } : null),
  selflevel: (x) => (/floor/i.test(x.name) ? { prep: 'Self-level' } : null),
  skim: (x) => (/floor/i.test(x.name) ? null : { prep: 'Skim coat' }),
  wp: (x) => (/shower|tub|wall|niche|bench/i.test(x.name) ? { prep: 'Waterproofing' } : null),
  metals: (x) => (/floor/i.test(x.name) ? null : { edge: 'Metal edges' }),
  saddle: (x) => (/^floor/i.test(x.name) ? { notes: 'Saddle at the door' } : null),
  drain: (x) => (/shower floor/i.test(x.name) ? { notes: 'Linear drain' } : null),
  showerdrain: (x) => (/shower floor/i.test(x.name) ? { notes: 'Shower drain' } : null),
}
const SURF_KEY = (label?: string) => SURFACES.find((x) => x.label.toLowerCase() === (label || '').toLowerCase())?.key
export function roomsFromEstimate(e: Estimate, items: { id: string; surface?: string; type?: string }[]): Room[] {
  const rooms: Room[] = []
  const later: { area: string; key: string }[] = []
  curRev(e).lines.forEach((l) => {
    const it = items.find((i) => i.id === l.itemId)
    const key = SURF_KEY(l.surface)
    if (key && NOT_TILE[key]) { later.push({ area: l.area, key }); return }
    const surface = l.surface && it?.type === 'labor' && it.id !== 'i-wp' && it.id !== 'i-prep' && it.id !== 'i-edge' ? l.surface : it?.surface
    if (!surface) return
    let r = rooms.find((x) => x.name === l.area)
    if (!r) rooms.push((r = { name: l.area, pct: 0, surfaces: [] }))
    const ex = r.surfaces.find((x) => x.name === surface)
    if (ex) ex.sf = (ex.sf || 0) + l.qty
    else r.surfaces.push({ name: surface, tile: l.tile || '', state: 'notstarted', sf: l.qty, itemId: l.itemId })
  })
  later.forEach(({ area, key }) => {
    const r = rooms.find((x) => x.name === area)
    r?.surfaces.forEach((x) => {
      const add = NOT_TILE[key](x)
      if (!add) return
      if (add.prep && !x.prep) x.prep = add.prep
      else if (add.prep && x.prep && !x.prep.includes(add.prep)) x.prep = `${x.prep} + ${add.prep.toLowerCase()}`
      if (add.edge && !x.edge) x.edge = add.edge
      if (add.notes) x.notes = x.notes ? `${x.notes} · ${add.notes}` : add.notes
    })
  })
  return rooms
}
/** called from the award: the estimate is approved and its scope carries over */
export function approveEstimateInAward(s: any, jobId: string) {
  const e: Estimate | undefined = s.estimates.find((x: Estimate) => x.jobId === jobId)
  if (!e) return
  e.status = 'approved'
  e.approvedOn = NOW
  const r = [...e.revs].reverse().find((x) => x.status === 'sent') || curRev(e)
  e.revs.forEach((x) => { if (x !== r && x.status === 'sent') x.status = 'superseded' })
  r.status = 'approved'
  e.log.push(L(meOf(s.role), `Approved — revision ${r.n} became the project`))
  if (!s.rooms[jobId]?.length) {
    const rooms = roomsFromEstimate({ ...e, revs: [r] }, s.items)
    if (rooms.length) s.rooms[jobId] = rooms
  }
}

/* ================= the installer PO loop ================= */
const SURF_ITEM: Record<string, string> = { Floor: 'i-floor', Walls: 'i-wall', 'Shower floor': 'i-mosaic', Backsplash: 'i-splash', Border: 'i-border' }
export function surfaceItem(name: string) {
  if (SURF_ITEM[name]) return SURF_ITEM[name]
  if (/shower floor|mosaic/i.test(name)) return 'i-mosaic'
  if (/splash/i.test(name)) return 'i-splash'
  if (/border|coping/i.test(name)) return 'i-border'
  if (/floor|base|landing|steps|field/i.test(name)) return 'i-floor'
  return 'i-wall'
}
/** what we'd pay the installer: square feet from the project's surfaces × the item's installer rate */
export function draftIPOLines(s: any, jobId: string): IPOLine[] {
  const rooms: Room[] = s.rooms[jobId] || []
  const items = s.items as { id: string; name: string; cost: number; unit: string }[]
  const byItem: Record<string, number> = {}
  /* each surface pays what its estimate item pays the installer; the sample's surfaces fall back to the standard items */
  rooms.forEach((r) => r.surfaces.forEach((x) => {
    if (!x.sf) return
    const id = x.itemId && items.some((i) => i.id === x.itemId) ? x.itemId : surfaceItem(x.name)
    byItem[id] = (byItem[id] || 0) + x.sf
  }))
  let lines: IPOLine[] = Object.entries(byItem).filter(([id]) => items.some((i) => i.id === id)).map(([id, n]) => {
    const it = items.find((i) => i.id === id)!
    return { item: it.name, itemId: id, n, rate: it.cost, qty: `${n.toLocaleString('en-US')} ${it.unit}`, amount: Math.round(n * (it.cost || 0)) }
  })
  if (!lines.length) {
    /* no square feet yet: one line per room at the estimate's share */
    const e: Estimate | undefined = s.estimates.find((x: Estimate) => x.jobId === jobId)
    const contract = s.jobs[jobId]?.contract || revTotal(e ? curRev(e) : undefined) || 40000
    const names = rooms.length ? rooms.map((r) => r.name) : ['All areas']
    lines = names.map((n) => ({ item: `${n} — install per plans`, qty: 'Per plans', amount: Math.round((contract * 0.32) / names.length / 10) * 10 }))
  }
  return lines
}
/** pick the installer: his PO is drafted from the scope, ready for you to approve and send */
export function pickInstaller(jobId: string, crew: PersonKey | 'tbd') {
  const j0 = S().jobs[jobId]
  if (!j0) return
  if (crew === 'tbd') {
    S().commit((s) => {
      s.prep[jobId] = { ...(s.prep[jobId] || {}), installer: 'tbd' }
      s.ipos = s.ipos.filter((p) => !(p.jobId === jobId && p.status === 'Draft'))
    }, 'Installer cleared')
    return
  }
  let id = ''
  S().commit((s) => {
    s.prep[jobId] = { ...(s.prep[jobId] || {}), installer: crew }
    const live = s.ipos.find((p) => p.jobId === jobId && ['Sent', 'Accepted'].includes(p.status))
    if (live && live.crew === crew) {
      id = live.id
      return
    }
    s.ipos = s.ipos.filter((p) => !(p.jobId === jobId && ['Draft', 'Rejected'].includes(p.status)))
    id = 'IPO-' + (/^\d/.test(jobId) ? jobId.toUpperCase() : 201 + s.ipos.length)
    if (s.ipos.some((p) => p.id === id)) id = id + '-' + (s.ipos.length + 1)
    s.ipos.push({ id, jobId, crew, status: 'Draft', date: NOW, lines: draftIPOLines(s, jobId), changes: [], log: [L(me(), `Drafted for ${PEOPLE[crew].name} from the project scope`)] })
    addHist(s, jobId, { who: me(), kind: 'schedule', title: `Installer picked · ${PEOPLE[crew].name}`, detail: `PO ${id} drafted — waiting for your approval`, ref: { t: 'ipo', id } })
  }, `${PEOPLE[crew].name} picked — his PO is drafted for you to approve`)
  if (id) S().open({ t: 'ipo', id })
}
/** book the installer: his PO (lines from the project scope) is created and sent to him in one step.
 *  It shows in Purchase orders and on the project; he accepts or turns it down. */
export function bookInstaller(jobId: string, crew: PersonKey, o: { send: boolean; note?: string } = { send: true }) {
  const j0 = S().jobs[jobId]
  if (!j0) return ''
  let id = ''
  S().commit((s) => {
    s.prep[jobId] = { ...(s.prep[jobId] || {}), installer: crew }
    s.ipos = s.ipos.filter((p) => !(p.jobId === jobId && ['Draft', 'Rejected'].includes(p.status)))
    id = nextPO()
    const lines = draftIPOLines(s, jobId)
    const total = lines.reduce((n, l) => n + l.amount, 0)
    s.ipos.push({ id, jobId, crew, status: o.send ? 'Sent' : 'Draft', date: NOW, lines, changes: [], log: [L(me(), o.send ? `Created from the project scope and sent to ${PEOPLE[crew].name}` : `Drafted for ${PEOPLE[crew].name} from the project scope`), ...(o.note ? [L(me(), o.note)] : [])] })
    if (o.send) newTask(s, { jobId, title: `${PEOPLE[crew].name} to accept ${id} · ${s.jobs[jobId]?.name}`, type: 'Schedule', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: PEOPLE[crew].name, followUp: 'Tomorrow', tone: 'info', where: id, action: { label: 'Open PO', kind: 'ipo:' + id } })
    addHist(s, jobId, { who: me(), kind: 'schedule', title: o.send ? `${id} sent to ${PEOPLE[crew].name} · ${fmtMoney(total)}` : `${id} drafted for ${PEOPLE[crew].name}`, detail: 'Installer PO from the project scope', ref: { t: 'ipo', id } })
  }, o.send ? `PO sent to ${PEOPLE[crew].name}` : `Draft PO saved for ${PEOPLE[crew].name}`, o.send ? { sub: 'When he answers, record it on the PO — he accepted or turned it down.', flow: [{ who: meOf(S().role), label: 'Sent', state: 'done' }, { who: crew, label: 'He accepts', state: 'now' }, { label: 'On the calendar', state: 'next' }] } : undefined)
  /* the real app: his PO goes to him by email */
  if (o.send && id && mailLive()) void emailIPO(id)
  return id
}
export function sendDraftIPO(ipoId: string) {
  const p0 = S().ipos.find((p) => p.id === ipoId)
  if (!p0) return
  S().commit((s) => {
    const p = s.ipos.find((x) => x.id === ipoId)!
    p.status = 'Sent'
    p.date = NOW
    p.log.push(L(me(), `Approved and sent to ${PEOPLE[p.crew].name}`))
    newTask(s, { jobId: p.jobId, title: `${PEOPLE[p.crew].name} to accept ${p.id} · ${s.jobs[p.jobId]?.name}`, type: 'Schedule', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: PEOPLE[p.crew].name, followUp: 'Tomorrow', tone: 'info', where: p.id, action: { label: 'Open PO', kind: 'ipo:' + p.id } })
    addHist(s, p.jobId, { who: me(), kind: 'schedule', title: `${p.id} sent to ${PEOPLE[p.crew].name} · ${fmtMoney(p.lines.reduce((n, l) => n + l.amount, 0))}`, ref: { t: 'ipo', id: p.id } })
  }, `${p0.id} sent to ${PEOPLE[p0.crew].name}`, { close: true, sub: 'When he answers, record it on the PO — he accepted or turned it down.', flow: [{ who: meOf(S().role), label: 'Sent', state: 'done' }, { who: p0.crew, label: 'He accepts', state: 'now' }, { label: 'On the calendar', state: 'next' }] })
  if (mailLive()) void emailIPO(ipoId)
}
/** change the lines of an installer's PO. A draft simply changes; a PO he already has goes to him again as a new
 *  revision, and he accepts it again. */
export function setIPOLines(ipoId: string, lines: IPOLine[], o: { revise?: boolean } = {}) {
  const p0 = S().ipos.find((p) => p.id === ipoId)
  if (!p0) return
  const sum = (ls: IPOLine[]) => ls.reduce((n, l) => n + (l.amount || 0), 0)
  const before = sum(p0.lines)
  const after = sum(lines)
  const rev = (p0.rev || 1) + 1
  S().commit((s) => {
    const p = s.ipos.find((x) => x.id === ipoId)
    if (!p) return
    p.lines = lines
    if (!o.revise) return
    p.rev = rev
    p.status = 'Sent'
    p.date = NOW
    p.log.push(L(me(), `Revision ${rev} sent to ${PEOPLE[p.crew].name} · ${fmtMoney(before)} → ${fmtMoney(after)}`))
    closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'ipo:' + p.id && t.state !== 'done').map((t) => t.id), 'Replaced by the revision')
    newTask(s, { jobId: p.jobId, title: `${PEOPLE[p.crew].name} to accept ${p.id} revision ${rev} · ${s.jobs[p.jobId]?.name}`, type: 'Schedule', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: PEOPLE[p.crew].name, followUp: 'Tomorrow', tone: 'info', where: p.id, action: { label: 'Open PO', kind: 'ipo:' + p.id } })
    addHist(s, p.jobId, { who: me(), kind: 'schedule', title: `${p.id} revised — revision ${rev} sent to ${PEOPLE[p.crew].name}`, detail: `${fmtMoney(before)} → ${fmtMoney(after)}`, ref: { t: 'ipo', id: p.id } })
  }, o.revise ? `Revision ${rev} sent to ${PEOPLE[p0.crew].short}` : undefined, o.revise ? { sub: `${fmtMoney(before)} → ${fmtMoney(after)}. When he OKs it, record it on the PO.` } : undefined)
  if (o.revise && mailLive()) void emailIPO(ipoId)
}
export function answerIPO(ipoId: string, ok: boolean, reason?: string, o: { fromCrew?: boolean } = {}) {
  const p0 = S().ipos.find((p) => p.id === ipoId)
  if (!p0) return
  S().commit((s) => {
    const p = s.ipos.find((x) => x.id === ipoId)!
    p.status = ok ? 'Accepted' : 'Rejected'
    p.reason = ok ? undefined : reason
    p.date = NOW
    p.log.push(L(p.crew, ok ? 'Accepted' : `Rejected${reason ? ' — ' + reason : ''}`))
    if (ok) s.prep[p.jobId] = { ...(s.prep[p.jobId] || {}), installer: p.crew }
    closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'ipo:' + ipoId || t.action?.kind === 'ipoaccept:' + ipoId).map((t) => t.id), ok ? 'Accepted' : 'Rejected')
    if (!ok) newTask(s, { jobId: p.jobId, title: `${PEOPLE[p.crew].name} turned down ${s.jobs[p.jobId]?.name} — pick another installer`, type: 'Schedule', owner: 'ys', for: ['owner', 'pm'], state: 'now', due: 'Today', dueTone: 'warn', tone: 'warn', where: reason || p.id, action: { label: 'Open game plan', kind: 'upcoming' } })
    addHist(s, p.jobId, { who: p.crew, kind: 'schedule', title: `${PEOPLE[p.crew].name} ${ok ? 'accepted' : 'turned down'} ${p.id}`, detail: reason, ref: { t: 'ipo', id: p.id } })
  }, o.fromCrew ? (ok ? `You said yes to ${p0.id}` : `You turned down ${p0.id}`) : ok ? `${PEOPLE[p0.crew].name} accepted ${p0.id}` : `${PEOPLE[p0.crew].name} turned it down`, o.fromCrew ? { close: true, sub: ok ? 'The office books your days once it’s ready — they show here.' : 'The office knows.' } : ok ? { close: true, sub: 'Next: put him on the calendar from the Schedule.', flow: [{ who: meOf(S().role), label: 'Sent', state: 'done' }, { who: p0.crew, label: 'Accepted', state: 'done' }, { label: 'On the calendar', state: 'now' }] } : { close: true, sub: 'Pick another installer — it’s on your Today.' })
}

/* ================= materials, priced from our items ================= */
export function createItemPO(jobId: string, o: { vendor: string; lines: POLine[]; what: string; neededBy: string; replaces?: string }) {
  const id = nextPO()
  const amount = Math.round(o.lines.reduce((n, l) => n + (l.n || 0) * (l.price || 0), 0))
  S().commit((s) => {
    s.pos.unshift({ id, jobId, supplier: o.vendor, what: o.what, lines: o.lines, amount, step: 1, date: NOW, eta: 'Asked for ' + o.neededBy, note: `Sent today · waiting for ${o.vendor} to confirm`, log: [L(me(), `Sent to ${o.vendor}`)] })
    o.lines.forEach((l) => {
      const it = s.items.find((i) => i.id === l.itemId)
      if (it && l.price) it.cost = l.price
    })
    s.mats.forEach((m) => {
      if (m.jobId === jobId && m.status === 'to-order' && o.lines.some((l) => m.name.toLowerCase().includes(l.item.split(' ')[0].toLowerCase()))) {
        m.status = 'sent'
        m.po = id
      }
    })
    newTask(s, { jobId, title: `${id} · waiting for ${o.vendor} to confirm`, type: 'Materials', owner: matBy(s), for: matFor(s), state: 'waiting', waitingOn: o.vendor, followUp: 'Tomorrow', tone: 'warn', where: o.what, action: { label: 'Mark confirmed', kind: 'po:' + id } })
    addHist(s, jobId, { who: me(), kind: 'material', title: `${id} sent to ${o.vendor} · ${fmtMoney(amount)}`, detail: o.lines.map((l) => `${l.qty} ${l.item}`).join(', '), ref: { t: 'po', id } })
  }, `${id} sent to ${o.vendor}`)
  return id
}
/** the estimate's material lines, grouped by the vendor we buy them from */
export function materialsFromEstimate(s: any, jobId: string): { vendor: string; lines: POLine[] }[] {
  const e: Estimate | undefined = s.estimates.find((x: Estimate) => x.jobId === jobId)
  if (!e) return []
  const r = [...e.revs].reverse().find((x) => x.status === 'approved') || curRev(e)
  const groups: Record<string, POLine[]> = {}
  r.lines.forEach((l) => {
    const it = s.items.find((i: any) => i.id === l.itemId)
    if (!it || it.type !== 'material') return
    const v = it.vendor || 'Infinity'
    ;(groups[v] = groups[v] || []).push({ item: it.name, itemId: it.id, n: l.qty, qty: `${l.qty} ${it.unit}${l.qty === 1 ? '' : 's'}`, price: it.cost })
  })
  return Object.entries(groups).map(([vendor, lines]) => ({ vendor, lines }))
}

/* ================= tile selection: what goes where ================= */
export function setSurfaceTile(jobId: string, room: string, surface: string, tag: string) {
  S().commit((s) => {
    const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
    if (!x) return
    x.tile = tag
    if (x.state === 'unknown' && x.reason === 'Wall tile not confirmed') {
      x.state = 'ready'
      x.reason = undefined
    }
    addHist(s, jobId, { who: me(), kind: 'setup', title: `Tile selection · ${room} ${surface.toLowerCase()} → ${tag ? `${tag} ${s.tiles[jobId]?.[tag]?.name || ''}` : 'not picked'}` })
  }, tag ? `${room} · ${surface} gets ${tag}` : 'Tile cleared')
}

/** how a wall or floor is set — the materials recalculate from it */
export function setSurfaceMethod(jobId: string, room: string, surface: string, method: MethodKey) {
  S().commit((s) => {
    const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
    if (!x) return
    x.method = method
    addHist(s, jobId, { who: me(), kind: 'setup', title: `${room} · ${surface.toLowerCase()} set on ${METHODS[method].label.toLowerCase()}`, detail: 'Materials recalculated' })
  }, `${room} · ${surface} — ${METHODS[method].label.toLowerCase()} · materials updated`)
}
/** square feet for a wall or floor */
export function setSurfaceSF(jobId: string, room: string, surface: string, sf: number) {
  S().commit((s) => {
    const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
    if (!x) return
    const was = x.sf
    x.sf = sf || undefined
    addHist(s, jobId, { who: me(), kind: 'setup', title: `${room} · ${surface.toLowerCase()} · ${sf} SF`, from: was ? `${was} SF` : undefined, to: `${sf} SF` })
  }, `${room} · ${surface}: ${sf} SF · materials updated`)
}

/* ================= recurring tasks and the daily crew report ================= */
export function sendCrewReport(taskId: string | undefined, rows: { jobId: string; crew: PersonKey; workers: number; note: string }[]) {
  const people = rows.reduce((n, r) => n + r.workers, 0)
  S().commit((s) => {
    rows.forEach((r) => {
      const b = s.bookings.find((x) => x.jobId === r.jobId && x.crew === r.crew)
      if (b) b.workers = r.workers
      addHist(s, r.jobId, { who: me(), kind: 'field', title: `Crew report · ${PEOPLE[r.crew].name}’s crew, ${r.workers} ${r.workers === 1 ? 'person' : 'people'} · ${s.jobs[r.jobId]?.pct ?? 0}%`, detail: r.note || undefined })
    })
    s.notices.unshift({ id: 'cr' + Date.now(), text: `Crew report from ${PEOPLE[me()].short} — ${rows.length} jobs, ${people} people`, when: 'Just now', kind: 'field', unread: true })
    const t = taskId ? s.tasks.find((x) => x.id === taskId) : s.tasks.find((x) => x.action?.kind === 'crewreport' && x.state === 'now')
    if (t) {
      t.state = 'done'
      t.doneAt = 'Just now'
      t.log.push(L(me(), `Sent — ${rows.length} jobs, ${people} people`))
      if (t.repeat) repeatTask(s, t)
    }
  }, `Report sent — ${rows.length} jobs, ${people} people`)
}

export function estFollowUp(estId: string, o: { how: string; outcome: string; next: string }) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    e.followUp = o.next
    e.log.push(L(me(), `${o.how} — ${o.outcome.toLowerCase()}`))
    const p = s.pricing[e.jobId]
    if (p) {
      p.fu.push({ date: NOW, how: o.how, outcome: o.outcome, by: me() })
      p.nextFollowUp = o.next
    }
    s.tasks.forEach((t) => {
      if (t.jobId === e.jobId && t.state === 'waiting' && t.type === 'Pricing') t.followUp = o.next
    })
    addHist(s, e.jobId, { who: me(), kind: 'pricing', title: `Follow-up on ${e.id} · ${o.how.toLowerCase()} — ${o.outcome.toLowerCase()}`, detail: `Next follow-up ${o.next}`, ref: { t: 'estimate', id: e.id } })
  }, `Logged — next follow-up ${o.next}`)
}
export function estAssign(estId: string, who: PersonKey) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    e.estimator = who
    e.log.push(L(me(), `Estimator: ${PEOPLE[who].name}`))
    const p = s.pricing[e.jobId]
    if (p) p.estimator = who
  }, `${PEOPLE[who].name} has it`)
}

/* ================= the finish tile the GC orders: log it against our takeoff ================= */
export function logTileOrder(jobId: string, tag: string, o: { sf: number; where: string }) {
  const t = tileOf(jobId, tag)
  const waste = 10
  const need = Math.ceil(o.sf * (1 + waste / 100))
  S().commit((s) => {
    if (s.checks.some((c) => c.jobId === jobId && c.tag === tag)) return
    s.checks.push({ jobId, tag, where: o.where, unit: 'SF', measured: Math.round(o.sf), wastePct: waste, ordered: need, received: 0, supplier: t?.supplier || 'Best Tile', suppliedBy: t?.suppliedBy || 'GC', eta: 'TBD' })
    addHist(s, jobId, { who: me(), kind: 'material', title: `${tag} ordered by the ${t?.suppliedBy || 'GC'} · ${need} SF`, detail: `Covers our takeoff of ${Math.round(o.sf)} SF + ${waste}% waste` })
  }, `${tag} logged — ${need} SF, matches our takeoff`)
}
