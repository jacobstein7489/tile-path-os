/* What has to happen on a project at its stage — the checklist for setup, the site check, getting ready to start,
 * the install (what holds the work up, today's daily update, bills to make), touch-ups and closing out — and the
 * project's tasks and meetings, as one list with who has each. The project window's To do is built from this. */
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { needWithWaste, type Task } from '@/tileos/data/work'
import { CAL_TODAY, type CalEvent } from '@/tileos/data/calendar'
import { NOW } from '@/tileos/lib/today'
import type { Store } from '@/tileos/store'
import { verificationDone } from '../flows'
import { materialStatus } from '../takeoff'
import { planCells, CELLS, installerOf } from '../upcoming'
import { settingStatus } from '../setting'
import { heightStatus } from '../heights'
import { isGettingReady, stepsFor, type StepView } from '../steps'
import { surfaceFix } from './overview'

type SetTab = (t: any) => void
/* ================= Now: what has to happen at this stage ================= */
export type NowState = 'done' | 'todo' | 'part' | 'wait' | 'bad'
export type NowItem = { key: string; title: string; status: NowState; note?: string; action?: { label: string; run: () => void } }
const CELL_TO_NOW: Record<string, NowState> = { yes: 'done', no: 'todo', part: 'part', wait: 'wait', bad: 'bad', na: 'done' }

export function nowItems(s: Store, job: Job, setTab: SetTab): { heading: string; items: NowItem[] } {
  const rooms = s.rooms[job.id] || []
  const flat = rooms.flatMap((r) => r.surfaces.map((sf) => ({ room: r.name, sf })))
  const dep = s.money.find((m) => m.jobId === job.id && m.kind === 'deposit')
  const depItem = (): NowItem | null => !dep ? null : dep.state === 'paid'
    ? { key: 'dep', title: 'Deposit', status: 'done', note: `Paid${dep.date ? ' ' + dep.date : ''}` }
    : dep.paid
      ? { key: 'dep', title: 'Deposit', status: 'part', note: `${fmtMoney((dep.amount || 0) - dep.paid)} still open`, action: { label: 'Open invoice', run: () => s.open({ t: 'money', id: dep.id }) } }
      : dep.step >= 1
        ? { key: 'dep', title: 'Deposit', status: 'wait', note: `Invoice ${dep.ref} sent — not paid`, action: { label: 'Record payment', run: () => s.open({ t: 'money', id: dep.id }) } }
        : { key: 'dep', title: 'Deposit', status: 'todo', note: 'Not invoiced yet', action: { label: 'Create invoice', run: () => s.open({ t: 'money', id: dep.id }) } }
  const st = job.stage
  if (['awarded', 'setup'].includes(st)) {
    const picked = flat.filter((x) => x.sf.tile).length
    const checks = s.checks.filter((c) => c.jobId === job.id)
    const short = checks.find((c) => c.ordered < needWithWaste(c))
    const pos = s.pos.filter((p) => p.jobId === job.id)
    const cpo = s.money.find((m) => m.jobId === job.id && m.kind === 'custpo')
    const items: (NowItem | null)[] = [
      rooms.length
        ? { key: 'rooms', title: 'Rooms and surfaces', status: 'done', note: `${rooms.length} rooms · ${flat.length} surfaces` }
        : { key: 'rooms', title: 'Rooms and surfaces', status: 'todo', note: 'Not built yet', action: { label: 'Build rooms', run: () => s.open({ t: 'buildrooms', jobId: job.id }) } },
      { key: 'tile', title: 'Tile picked for every surface', status: !flat.length ? 'todo' : picked === flat.length ? 'done' : 'part', note: flat.length ? `${picked} of ${flat.length} picked` : 'After the rooms', action: flat.length && picked < flat.length ? { label: 'Pick tiles', run: () => setTab('scope') } : undefined },
      short
        ? { key: 'qty', title: 'Tile quantity', status: 'bad', note: `${short.tag} is ${needWithWaste(short) - short.ordered} ${short.unit} short of our takeoff`, action: { label: 'Settle it', run: () => s.open({ t: 'qty', jobId: job.id, tag: short.tag }) } }
        : { key: 'qty', title: 'Tile quantity', status: checks.length ? 'done' : 'wait', note: checks.length ? 'Covers our takeoff and waste' : 'Waiting for the store’s order' },
      (() => {
        const st = settingStatus(s, job.id)
        if (!st.total) return null
        return { key: 'set', title: 'Underlayment for every surface', status: st.set === st.total ? 'done' : st.set ? 'part' : 'todo', note: st.set === st.total ? 'Set — materials worked out from it' : `${st.set} of ${st.total} picked · suggestions ready`, action: st.set === st.total ? undefined : { label: 'Pick it', run: () => s.open({ t: 'setting', jobId: job.id }) } } as NowItem
      })(),
      (() => {
        const ms = materialStatus(s, job.id)
        const status: NowState = ms.state === 'yes' ? 'done' : ms.state === 'wait' ? 'wait' : ms.state === 'part' ? 'part' : 'todo'
        const note = ms.go === 'order' ? `${ms.label} — ${ms.hint.split(' — ')[0]}` : ms.hint
        const action = ms.go === 'order' ? { label: 'Order', run: () => s.open({ t: 'newpo', jobId: job.id, fromTakeoff: true }) } : ms.go === 'scope' ? { label: 'Open scope', run: () => setTab('scope') } : ms.state === 'yes' ? undefined : { label: 'See it', run: () => setTab('orders') }
        return { key: 'mat', title: 'Our materials', status, note, action } as NowItem
      })(),
      depItem(),
      cpo ? { key: 'cpo', title: 'Client PO', status: cpo.state === 'paid' ? 'done' : 'wait', note: cpo.state === 'paid' ? 'Received' : 'Requested from the GC', action: cpo.state !== 'paid' ? { label: 'Mark received', run: () => s.open({ t: 'money', id: cpo.id }) } : undefined } : null,
    ]
    return { heading: 'Setup', items: items.filter(Boolean) as NowItem[] }
  }
  if (st === 'verification') {
    const unknown = flat.filter((x) => x.sf.state === 'unknown')
    const hs = heightStatus(s, job.id)
    return {
      heading: 'Site check',
      items: [
        ...(hs.total ? [{ key: 'heights', title: 'Wall heights measured', status: (hs.measured === hs.total ? 'done' : 'bad') as NowState, note: hs.measured === hs.total ? 'Square feet and materials follow the real heights' : `${hs.measured} of ${hs.total} walls — required before the start`, action: hs.measured === hs.total ? undefined : { label: 'Measure', run: () => s.open({ t: 'heights', jobId: job.id }) } }] : []),
        { key: 'walk', title: 'Walkthrough on site', status: 'todo', note: 'Heights, prep and anything unclear', action: { label: 'Done', run: () => verificationDone(job.id) } },
        { key: 'unk', title: 'Surfaces to verify', status: unknown.length ? 'wait' : 'done', note: unknown.length ? unknown.map((x) => `${x.room} ${x.sf.name.toLowerCase()}`).join(' · ') : 'Nothing unclear', action: unknown.length ? { label: 'Open', run: () => setTab('scope') } : undefined },
        ...(depItem() ? [depItem()!] : []),
      ],
    }
  }
  if (['ready', 'scheduled'].includes(st)) {
    const cells = planCells(s, job)
    const crew = installerOf(s, job)
    const items: NowItem[] = CELLS.map((c) => {
      const cell = cells[c.key]
      const label = cell.state === 'yes' || cell.state === 'na' ? undefined : c.key === 'po' ? (crew ? 'Send PO' : 'Book installer') : c.key === 'material' ? (cell.state === 'wait' ? 'Open' : cell.label === 'Add SF' || cell.label === 'No scope' ? 'Open scope' : 'Order') : c.key === 'deposit' ? 'Open invoice' : c.key === 'picked' ? 'Pick tiles' : 'Open'
      return { key: c.key, title: c.short, status: CELL_TO_NOW[cell.state], note: /^\d|\$/.test(cell.label) ? `${cell.label} — ${cell.hint}` : cell.hint, action: label && cell.run ? { label, run: cell.run } : undefined }
    })
    return { heading: st === 'scheduled' ? 'Scheduled — ready to start' : 'Ready — before the crew starts', items }
  }
  if (st === 'installation') {
    const items: NowItem[] = []
    /* surfaces held up by the same thing are one line: the thing, and where it holds up the work */
    const held = flat.filter((x) => ['blocked', 'hold', 'waitmat'].includes(x.sf.state))
    const reasons = Array.from(new Set(held.map((x) => x.sf.reason || (x.sf.state === 'hold' ? 'On hold' : 'Waiting on material'))))
    reasons.forEach((why) => {
      const these = held.filter((x) => (x.sf.reason || (x.sf.state === 'hold' ? 'On hold' : 'Waiting on material')) === why)
      const fix = surfaceFix(job, these[0].room, these[0].sf)
      items.push({ key: 'held:' + why, title: why.replace(/ \d+ days? late$/, ''), status: these.some((x) => x.sf.state === 'blocked') ? 'bad' : 'wait', note: `${/late/.test(why) ? why.match(/\d+ days? late/)?.[0] + ' · ' : ''}holds up ${these.map((x) => `${x.room.toLowerCase()} ${x.sf.name.toLowerCase()}`).join(', ')}`, action: fix || undefined })
    })
    const sentToday = s.diary[job.id]?.[0]?.date === NOW
    items.push({ key: 'daily', title: 'Today’s daily update', status: sentToday ? 'done' : 'todo', note: sentToday ? 'Sent' : `${PEOPLE[(job.crew as PersonKey) || 'ys'].short}’s crew · ${job.pct ?? 0}% installed`, action: sentToday ? undefined : { label: 'Send', run: () => s.open({ t: 'daily', jobId: job.id }) } })
    s.money.filter((m) => m.jobId === job.id && m.state === 'todo').forEach((m) => items.push({ key: m.id, title: m.title, status: 'todo', note: m.due, action: { label: m.action || 'Open', run: () => s.open({ t: 'money', id: m.id }) } }))
    return { heading: 'In progress', items }
  }
  if (st === 'punch') {
    const left = s.punch.filter((p) => p.jobId === job.id && p.status !== 'verified')
    const booking = s.bookings.find((b) => b.jobId === job.id)
    const hold = s.ready.find((r) => r.jobId === job.id && r.kind === 'hold')
    const items: NowItem[] = [
      { key: 'punch', title: 'Touch-ups', status: left.length ? 'todo' : 'done', note: left.length ? `${left.length} still open` : 'All verified', action: left.length ? { label: 'Open list', run: () => s.open({ t: 'touchups', jobId: job.id }) } : undefined },
      hold
        ? { key: 'ret', title: 'Return visit', status: 'bad', note: hold.warn || 'On hold', action: job.id === '828' ? { label: 'Chase or reorder', run: () => s.open({ t: 'thinset' }) } : undefined }
        : { key: 'ret', title: 'Return visit', status: booking ? 'done' : 'todo', note: booking ? `${PEOPLE[booking.crew as PersonKey].short} · ${booking.start.slice(5).replace('-', '/')}` : 'Not booked yet', action: booking ? undefined : { label: 'Book it', run: () => s.open({ t: 'assign', jobId: job.id }) } },
    ]
    s.money.filter((m) => m.jobId === job.id && m.state === 'todo').forEach((m) => items.push({ key: m.id, title: m.title, status: 'todo', note: m.due, action: { label: m.action || 'Open', run: () => s.open({ t: 'money', id: m.id }) } }))
    return { heading: 'Touch-ups', items }
  }
  /* closeout / complete */
  const items: NowItem[] = s.money.filter((m) => m.jobId === job.id && m.state !== 'paid' && ['final', 'retainage', 'change', 'progress'].includes(m.kind)).map((m) => ({
    key: m.id, title: m.title, status: m.state === 'todo' ? 'todo' : 'wait', note: m.state === 'waiting' ? `Invoice ${m.ref || ''} sent — not paid` : m.due, action: { label: m.action || 'Open', run: () => s.open({ t: 'money', id: m.id }) },
  }))
  if (!items.length) items.push({ key: 'paid', title: 'Everything billed and paid', status: 'done' })
  return { heading: st === 'complete' ? 'Finished' : 'Closing out', items }
}


/* the stage checklist and the team's tasks are often the same thing ("Deposit" ↔ "Send the deposit invoice"):
 * show it once — the checklist line, with the person who has it */
const norm = (x?: string) => (x || '').toLowerCase().replace(/[^a-z0-9]/g, '')
function sameThing(it: NowItem, t: Task, depId?: string): boolean {
  const title = t.title.toLowerCase()
  const kind = t.action?.kind || ''
  if (kind === 'money:' + it.key) return true
  if (it.key.startsWith('sh:')) return kind === 'short:' + it.key.slice(3)
  switch (it.key) {
    case 'dep':
    case 'deposit': return (!!depId && kind === 'money:' + depId) || /deposit/.test(title)
    case 'qty': return kind.startsWith('qty') || /short of our takeoff/.test(title)
    case 'cpo': return /client po/.test(title)
    case 'daily': return /daily update/.test(title)
    case 'walk': return kind.startsWith('walk-done') || /^walk /.test(title)
    case 'mat':
    case 'material': return /^order /.test(title)
    case 'rooms': return /^build .*paperwork/.test(title)
    case 'po': return /installer po|\bipo\b/.test(title)
  }
  const n = norm(it.title)
  return n.length > 6 && (norm(t.where).startsWith(n) || norm(t.blocks).startsWith(n))
}
export type Line = { key: string; rank: number; it?: NowItem; task?: Task; owner?: Task; ev?: CalEvent; step?: StepView }
export function todoLines(s: Store, job: Job, setTab: SetTab, extrasOnly?: boolean, withSteps?: boolean) {
  /* while a project is getting ready its checklist lives in the steps — here only what's outside them */
  const base = extrasOnly ? [] : nowItems(s, job, setTab).items
  /* tile that came up short: one line that shows where the shortage is */
  const shorts = s.shortages.filter((x) => x.jobId === job.id && x.step !== 'received')
  const covered = new Set(shorts.flatMap((x) => x.surfaces.map((f) => `${f.room} · ${f.surface}`)))
  const items: NowItem[] = [
    ...shorts.map((x): NowItem => ({ key: 'sh:' + x.id, title: `${x.tag} short · ${x.qty} ${x.unit}`, status: x.step === 'short' ? 'bad' : 'wait', note: x.step === 'short' ? `${x.surfaces.map((f) => `${f.room} ${f.surface.toLowerCase()}`).join(', ')} wait for it — reorder it` : `Reordered from ${x.orderedFrom} · arrives ${x.eta}${job.hold?.shortage === x.id ? ' · project on hold' : ''}`, action: { label: x.step === 'short' ? 'Reorder' : 'It came in', run: () => s.open({ t: 'short', id: x.id }) } })),
    ...base.filter((i) => !covered.has(i.title)),
  ]
  const depId = s.money.find((m) => m.jobId === job.id && m.kind === 'deposit')?.id
  const tasks = s.tasks.filter((t) => t.jobId === job.id && (t.state === 'now' || t.state === 'waiting') && !(extrasOnly && t.step))
  const used = new Set<string>()
  const lines: Line[] = []
  items.filter((i) => i.status !== 'done').forEach((it) => {
    const owner = tasks.find((t) => !used.has(t.id) && sameThing(it, t, depId))
    if (owner) used.add(owner.id)
    lines.push({ key: 'c' + it.key, rank: it.status === 'bad' ? 0 : it.status === 'wait' ? 2 : 1, it, owner })
  })
  tasks.filter((t) => !used.has(t.id)).forEach((t) => lines.push({ key: 't' + t.id, rank: t.state === 'waiting' ? 2 : 1, task: t }))
  s.events.filter((e) => e.jobId === job.id && e.date >= CAL_TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).forEach((e) => lines.push({ key: 'e' + e.id, rank: 3, ev: e }))
  /* while it's getting ready, the checklist steps that are someone's turn (or waiting) are part of the work list */
  if (withSteps) stepsFor(s, job).filter((v) => v.state === 'now' || v.state === 'bad' || v.state === 'wait').forEach((v) => lines.push({ key: 's' + v.key, rank: v.state === 'bad' ? 0 : v.state === 'wait' ? 2 : 1, step: v }))
  lines.sort((a, b) => a.rank - b.rank)
  return { lines, done: items.filter((i) => i.status === 'done') }
}
/** how many things are open on a project (for the To do tab's count) */
export function todoCount(s: Store, job: Job) {
  /* what needs someone here — waiting on others doesn't count */
  if (isGettingReady(job)) {
    const steps = stepsFor(s, job).filter((x) => x.state === 'now' || x.state === 'bad')
    const { lines } = todoLines(s, job, () => {}, true)
    const extra = lines.filter((l) => !l.ev && l.rank !== 2)
    return { n: steps.length + extra.length, bad: steps.some((x) => x.state === 'bad') || extra.some((l) => l.it?.status === 'bad') }
  }
  const { lines } = todoLines(s, job, () => {})
  const open = lines.filter((l) => !l.ev && l.rank !== 2)
  return { n: open.length, bad: open.some((l) => l.it?.status === 'bad') }
}

