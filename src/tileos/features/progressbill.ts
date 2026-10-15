/* Weekly progress billing — what each client can be billed, worked out from the site manager's daily updates.
 * The same way installer pay is: every wall and floor carries its share of the approved estimate, and how far it
 * moved that week × what it's worth = what got installed. Installed to date, less retainage, less what's already
 * billed (and the deposit) = the week's progress bill. One click makes the bill; the PM checks it; it goes out. */
import { useStore, addHist, meOf, type Store } from '@/tileos/store'
import { fmtMoney, type Tone } from '@/tileos/data/model'
import { surfacePct, hasSF } from '@/tileos/data/jobs'
import type { MoneyItem, BillBreakdown } from '@/tileos/data/work'
import { curRev, revTotal, type Estimate } from '@/tileos/data/estimates'
import { TODAY, NOW, addDays, md } from '@/tileos/lib/today'
import { THIS_WEEK, PAY_WEEKS, weekRange, type PayWeek } from './pay'

const S = () => useStore.getState()
type BD = Pick<Store, 'jobs' | 'rooms' | 'diary' | 'estimates' | 'money' | 'rules'>

/* ---------------- what each wall and floor is worth ---------------- */
const keyOf = (room: string, surface: string) => `${room}\u0001${surface}`
/** the key a surface's worth is kept under */
export const worthKey = keyOf
const same = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase()
export interface Worth { contract: number; byKey: Record<string, number>; est?: Estimate; from: 'estimate' | 'contract' | 'none' }

/** the approved estimate, spread over the walls and floors: a line for a surface goes on that surface; the room's
 *  other lines (prep, waterproofing, edges, a price for the room) over its surfaces by square feet; anything that
 *  isn't in a room over the whole project. With no estimate, the contract is spread the same way. */
export function worthOf(s: BD, jobId: string): Worth {
  const est = s.estimates.find((e) => e.jobId === jobId && e.status === 'approved')
  const rev = est ? [...est.revs].reverse().find((r) => r.status === 'approved') || curRev(est) : undefined
  const surfs = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.map((x) => ({ room: r.name, x })))
  const byKey: Record<string, number> = {}
  const add = (amount: number, list: typeof surfs) => {
    const w = (y: (typeof surfs)[number]) => y.x.sf || 10
    const tot = list.reduce((n, y) => n + w(y), 0)
    if (!tot) return
    list.forEach((y) => {
      const k = keyOf(y.room, y.x.name)
      byKey[k] = (byKey[k] || 0) + (amount * w(y)) / tot
    })
  }
  const total = rev ? revTotal(rev) : 0
  if (rev && total > 0) {
    let rest = 0
    rev.lines.forEach((l) => {
      const amt = l.qty * l.rate
      if (!amt) return
      const room = surfs.filter((y) => same(y.room, l.area))
      if (!room.length) { rest += amt; return }
      const byName = l.surface ? room.filter((y) => same(y.x.name, l.surface)) : []
      const byItem = room.filter((y) => y.x.itemId && y.x.itemId === l.itemId)
      add(amt, byName.length ? byName : byItem.length ? byItem : room)
    })
    if (rest) add(rest, surfs)
    return { contract: total, byKey, est, from: surfs.length ? 'estimate' : 'none' }
  }
  const c = s.jobs[jobId]?.contract || 0
  if (c) add(c, surfs)
  return { contract: c, byKey, est, from: c && surfs.length ? 'contract' : 'none' }
}

/* ---------------- what moved, from the daily updates ---------------- */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')
/** "Oct 10" → its date (last year's, when it would be ahead of us) */
export function isoOfDay(label: string) {
  const m = (label || '').match(/^([A-Z][a-z]{2}) (\d{1,2})$/)
  if (!m || MON.indexOf(m[1]) < 0) return ''
  const y = +TODAY.slice(0, 4)
  const iso = `${y}-${pad(MON.indexOf(m[1]) + 1)}-${pad(+m[2])}`
  return iso > addDays(TODAY, 31) ? `${y - 1}${iso.slice(4)}` : iso
}
export interface Move { iso: string; date: string; room: string; surface: string; from: number; to: number }
export function movesOf(s: Pick<BD, 'diary'>, jobId: string): Move[] {
  const out: Move[] = []
  ;(s.diary[jobId] || []).forEach((e) => {
    const iso = isoOfDay(e.date)
    e.rooms.forEach((r) => r.items.forEach((it) => { if (it.to > it.from) out.push({ iso, date: e.date, room: r.room, surface: it.surface, from: it.from, to: it.to }) }))
  })
  return out
}
const weekEnd = (w: PayWeek) => addDays(w.key, 6)
const inWeek = (m: Move, w: PayWeek) => !!m.iso && m.iso >= w.key && m.iso <= weekEnd(w)

/** installed to date (before retainage) — at the end of a day, or now */
export function installedOf(s: BD, jobId: string, worth = worthOf(s, jobId), endIso?: string) {
  const rooms = s.rooms[jobId] || []
  /* no square feet to weigh the walls and floors by: the project's own progress */
  if (worth.from === 'none' || !hasSF(rooms)) return Math.round((worth.contract * (s.jobs[jobId]?.pct || 0)) / 100)
  const later = endIso ? movesOf(s, jobId).filter((m) => m.iso > endIso) : []
  let n = 0
  rooms.forEach((r) =>
    r.surfaces.forEach((x) => {
      const back = later.filter((m) => m.room === r.name && m.surface === x.name).reduce((k, m) => k + (m.to - m.from), 0)
      n += ((worth.byKey[keyOf(r.name, x.name)] || 0) * Math.max(0, surfacePct(x) - back)) / 100
    }),
  )
  return Math.round(n)
}

/* ---------------- the weeks ---------------- */
export function weekOfKey(key: string): PayWeek {
  if (key === THIS_WEEK.key) return THIS_WEEK
  return PAY_WEEKS.find((w) => w.key === key) || { key, label: weekRange(key), dates: [0, 1, 2, 3, 4, 5].map((i) => md(addDays(key, i))) }
}
const billWeekOf = (m: MoneyItem) => m.bill?.week || m.week
/** the weeks to look at, newest first: this week, last week, the week before — and any older week that has a bill */
export function billWeeks(s: Pick<BD, 'money'>): PayWeek[] {
  const keys = new Set<string>([THIS_WEEK.key, ...PAY_WEEKS.map((w) => w.key)])
  const oldest = addDays(THIS_WEEK.key, -7 * 26)
  s.money.forEach((m) => { const w = billWeekOf(m); if (m.kind === 'progress' && w && w >= oldest && w <= THIS_WEEK.key) keys.add(w) })
  return Array.from(keys).sort().reverse().map(weekOfKey)
}
/** the week the billing person bills: the one that just ended */
export const LAST_WEEK = PAY_WEEKS[0]

/* ---------------- one project's week ---------------- */
export type BillState = 'running' | 'tobill' | 'deposit' | 'ahead' | 'billed' | 'later' | 'final' | 'noprice'
export const BILL_STATE: Record<BillState, { label: string; tone: Tone }> = {
  running: { label: 'This week so far', tone: 'info' },
  tobill: { label: 'To bill', tone: 'warn' },
  deposit: { label: 'The deposit covers it', tone: 'neutral' },
  ahead: { label: 'Already billed', tone: 'neutral' },
  billed: { label: 'Bill made', tone: 'ok' },
  later: { label: 'Billed the week after', tone: 'neutral' },
  final: { label: 'On the final bill', tone: 'neutral' },
  noprice: { label: 'No price to bill from', tone: 'bad' },
}
export type DepositWay = 'first' | 'share' | 'final'
export const DEPOSIT_WAY: Record<DepositWay, { label: string; sub: string }> = {
  first: { label: 'The first bills', sub: 'It counts as billed — progress bills start once the work passes it' },
  share: { label: 'A share of each bill', sub: 'Each bill gives back the same share of the work the deposit was' },
  final: { label: 'The final bill', sub: 'Progress bills are in full; the deposit comes off at the end' },
}
export const depositWayOf = (s: Pick<BD, 'rules'>): DepositWay => s.rules.depositOff || 'first'

export interface SurfLine { room: string; surface: string; from: number; to: number; byDay: Record<string, number>; worth: number; amount: number }
export interface WeekBill {
  jobId: string
  week: PayWeek
  /** the last work day it counts ("Oct 10") */
  through: string
  /** every wall and floor that moved that week, with what it was worth */
  lines: SurfLine[]
  weekAmount: number
  days: number
  contract: number
  installed: number
  pct: number
  retainagePct: number
  held: number
  depositWay: DepositWay
  deposit: number
  credit: number
  /** what's already billed for the work: before Tile OS, the deposit (when it counts first) and every bill before this week */
  bills: { id: string; label: string; amount: number }[]
  before: number
  /** the progress to bill */
  due: number
  /** approved change orders waiting to go on a bill */
  cos: MoneyItem[]
  /** the bill made for this week — or the later one that took it in */
  bill?: MoneyItem
  state: BillState
}

const isBill = (m: MoneyItem) => (m.kind === 'progress' || m.kind === 'final') && m.state !== 'upcoming' && !!m.amount
/** what a bill billed for the contract work (a weekly bill also carries its change orders) */
const workPart = (m: MoneyItem) => (m.bill ? m.bill.progress : m.amount || 0)
const billLabel = (m: MoneyItem) => (m.ref ? `${m.kind === 'final' ? 'Final bill' : (m.title.match(/Progress bill #\d+/)?.[0] || 'Progress bill')} · ${m.ref}` : m.title.split(' · ')[0])
/** approved change orders that are waiting to go on the next bill */
export const cosToBill = (s: Pick<BD, 'money'>, jobId: string) =>
  s.money.filter((m) => m.jobId === jobId && m.kind === 'change' && !!m.amount && ((m.step === 0 && m.state === 'todo') || (m.state === 'waiting' && !m.ref && m.due === 'On the next bill')))
/** the change orders a bill takes by default — not the ones that wait for the final bill */
export const cosDefault = (cos: MoneyItem[]) => cos.filter((c) => !/final/i.test(`${c.action || ''} ${c.note || ''}`))

export function weekBill(s: BD, jobId: string, week: PayWeek): WeekBill {
  const job = s.jobs[jobId]
  const worth = worthOf(s, jobId)
  const all = movesOf(s, jobId)
  const lines: SurfLine[] = []
  all.filter((m) => inWeek(m, week)).sort((a, b) => a.iso.localeCompare(b.iso)).forEach((m) => {
    const w = worth.byKey[keyOf(m.room, m.surface)] || 0
    let x = lines.find((l) => l.room === m.room && l.surface === m.surface)
    if (!x) { x = { room: m.room, surface: m.surface, from: m.from, to: m.to, byDay: {}, worth: Math.round(w), amount: 0 }; lines.push(x) }
    x.from = Math.min(x.from, m.from)
    x.to = Math.max(x.to, m.to)
    x.byDay[m.date] = (x.byDay[m.date] || 0) + (m.to - m.from)
    x.amount += (w * (m.to - m.from)) / 100
  })
  lines.forEach((l) => (l.amount = Math.round(l.amount)))
  const weekAmount = lines.reduce((n, l) => n + l.amount, 0)
  const days = new Set(all.filter((m) => inWeek(m, week)).map((m) => m.date)).size
  const endIso = week.current ? undefined : weekEnd(week)
  const installed = installedOf(s, jobId, worth, endIso)
  const contract = worth.contract
  const pct = contract ? Math.round((installed / contract) * 100) : 0
  const retainagePct = s.rules.retainage || 0
  const held = Math.round((installed * retainagePct) / 100)
  const way = depositWayOf(s)
  const mine = s.money.filter((m) => m.jobId === jobId)
  const deposits = mine.filter((m) => m.kind === 'deposit' && m.state !== 'upcoming' && !!m.amount)
  const deposit = deposits.reduce((n, m) => n + (m.amount || 0), 0)
  const prior = mine.filter((m) => isBill(m) && (!billWeekOf(m) || billWeekOf(m)! < week.key))
  const earlier = job?.before?.billed || 0
  const bills = [
    ...(earlier ? [{ id: '', label: 'Before Tile OS', amount: earlier }] : []),
    ...(way === 'first' ? deposits.map((m) => ({ id: m.id, label: m.ref ? `Deposit · ${m.ref}` : 'Deposit', amount: m.amount || 0 })) : []),
    ...prior.map((m) => ({ id: m.id, label: billLabel(m), amount: workPart(m) })),
  ]
  const before = bills.reduce((n, b) => n + b.amount, 0)
  const credit = way === 'share' && contract ? Math.round(deposit * Math.min(1, installed / contract)) : 0
  const due = Math.max(0, Math.round(installed - held - credit - before))
  const own = mine.find((m) => m.kind === 'progress' && billWeekOf(m) === week.key)
  const next = mine.filter((m) => m.kind === 'progress' && (billWeekOf(m) || '') > week.key).sort((a, b) => billWeekOf(a)!.localeCompare(billWeekOf(b)!))[0]
  const finalBill = mine.find((m) => m.kind === 'final' && m.state !== 'upcoming')
  const workLeft = installed - held - (before - (way === 'first' ? deposit : 0))
  const state: BillState = own ? 'billed'
    : next ? 'later'
    : finalBill ? 'final'
    : !contract ? 'noprice'
    : week.current ? 'running'
    : due > 0 ? 'tobill'
    : way === 'first' && deposit > 0 && workLeft > 0 && workLeft <= deposit ? 'deposit'
    : 'ahead'
  return {
    jobId, week, through: md(addDays(week.key, 5)), lines, weekAmount, days, contract, installed, pct, retainagePct, held,
    depositWay: way, deposit, credit, bills, before, due, cos: cosToBill(s, jobId), bill: own || next, state,
  }
}

/** every project with work that week (and, for the week to bill, anything installed earlier that never got billed) */
export function weekBills(s: BD, week: PayWeek): WeekBill[] {
  const live = (j: string) => !!s.jobs[j]
  const ids = new Set<string>()
  Object.keys(s.diary).forEach((j) => { if (live(j) && movesOf(s, j).some((m) => inWeek(m, week))) ids.add(j) })
  s.money.forEach((m) => { if (m.kind === 'progress' && billWeekOf(m) === week.key && live(m.jobId)) ids.add(m.jobId) })
  const rows = Array.from(ids).map((j) => weekBill(s, j, week))
  if (week.key === LAST_WEEK.key)
    Object.keys(s.jobs).forEach((j) => {
      if (ids.has(j) || !live(j) || !(s.rooms[j] || []).length || !movesOf(s, j).length) return
      const r = weekBill(s, j, week)
      if (r.state === 'tobill') rows.push(r)
    })
  const rank = (r: WeekBill) => ['tobill', 'billed', 'running', 'deposit', 'ahead', 'later', 'final', 'noprice'].indexOf(r.state)
  return rows.sort((a, b) => rank(a) - rank(b) || b.due - a.due || b.weekAmount - a.weekAmount || (s.jobs[a.jobId]?.name || '').localeCompare(s.jobs[b.jobId]?.name || ''))
}
/** what a bill for the week comes to: the progress plus the change orders that go with it */
export const billTotal = (r: WeekBill, coIds?: string[]) => r.due + (coIds ? r.cos.filter((c) => coIds.includes(c.id)) : cosDefault(r.cos)).reduce((n, c) => n + (c.amount || 0), 0)
/** last week's bills still to make — what lands on the billing person's Today */
export const billsToMake = (s: BD) => weekBills(s, LAST_WEEK).filter((r) => r.state === 'tobill')
export const billingOn = (s: Pick<BD, 'rules'>) => !(s.rules.autoOff || []).includes('billing-day')

/** a progress bill's step, in words */
export function billStep(m?: MoneyItem): { label: string; tone: Tone } {
  if (!m) return { label: '', tone: 'neutral' }
  if (m.state === 'paid') return { label: `Paid ${m.date || ''}`.trim(), tone: 'ok' }
  if (m.step <= 0) return { label: 'Draft — not sent', tone: 'vio' }
  if (m.step === 1) return { label: 'With the PM', tone: 'warn' }
  if (m.step === 2) return { label: `Sent ${m.ref || ''}`.trim(), tone: 'info' }
  return { label: `Approved ${m.ref || ''}`.trim(), tone: 'info' }
}

/* ---------------- a project's money, as it stands ---------------- */
export interface Picture {
  contract: number; changes: number; pending: number
  installed: number; installedPct: number
  billed: number; billedPct: number
  paid: number; paidPct: number
  retainage: number; depositPct: number
  /** progress that could be billed right now */
  toBill: number
}
export function pictureOf(s: BD, jobId: string): Picture {
  const job = s.jobs[jobId]
  const worth = worthOf(s, jobId)
  const contract = worth.contract || job?.contract || 0
  const mine = s.money.filter((m) => m.jobId === jobId)
  const changes = (job?.before?.changes || 0) + mine.filter((m) => m.kind === 'change' && m.step >= 0 && m.amount).reduce((n, m) => n + (m.amount || 0), 0)
  const pending = mine.filter((m) => m.kind === 'change' && m.step < 0).reduce((n, m) => n + (m.amount || m.meta?.estimate || 0), 0)
  const installed = installedOf(s, jobId, worth)
  const sent = mine.filter((m) => ['deposit', 'progress', 'final', 'retainage'].includes(m.kind) && (m.state === 'waiting' || m.state === 'paid') && !!m.amount)
  const billed = (job?.before?.billed || 0) + sent.reduce((n, m) => n + (m.amount || 0), 0)
  const paid = (job?.before?.paid || 0) + sent.reduce((n, m) => n + (m.state === 'paid' ? m.amount || 0 : m.paid || 0), 0)
  const lastBill = mine.filter((m) => m.bill).sort((a, b) => b.bill!.week.localeCompare(a.bill!.week))[0]
  const retainage = lastBill ? lastBill.bill!.held : job?.before?.retainage || 0
  const of = contract + changes
  const dep = mine.find((m) => m.kind === 'deposit' && m.amount)
  const now = weekBill(s, jobId, { ...THIS_WEEK, current: false })
  return {
    contract, changes, pending, installed,
    installedPct: contract ? Math.round((installed / contract) * 100) : job?.pct || 0,
    billed, billedPct: of ? Math.min(100, Math.round((billed / of) * 100)) : 0,
    paid, paidPct: of ? Math.min(100, Math.round((paid / of) * 100)) : 0,
    retainage,
    depositPct: dep && contract ? Math.round(((dep.amount || 0) / contract) * 100) : s.rules.depositPct ?? 20,
    toBill: ['tobill', 'deposit', 'ahead'].includes(now.state) ? now.due : 0,
  }
}

/* ---------------- what you do with it ---------------- */
const L = (who: string, text: string) => ({ date: NOW, who: who as any, text })

export function makeBill(jobId: string, weekKey: string, coIds?: string[]) {
  const s0 = S()
  const week = weekOfKey(weekKey)
  const row = weekBill(s0, jobId, week)
  if (!['tobill', 'deposit', 'ahead'].includes(row.state)) return
  const cos = coIds ? row.cos.filter((c) => coIds.includes(c.id)) : cosDefault(row.cos)
  const total = row.due + cos.reduce((n, c) => n + (c.amount || 0), 0)
  if (total <= 0) return
  const n = Math.max(0, ...s0.money.filter((m) => m.jobId === jobId && m.kind === 'progress').map((m) => +(m.title.match(/#(\d+)/)?.[1] || 0))) + 1
  const job = s0.jobs[jobId]
  const rooms: BillBreakdown['rooms'] = []
  row.lines.forEach((l) => { const r = rooms.find((x) => x.room === l.room); if (r) r.amount += l.amount; else rooms.push({ room: l.room, amount: l.amount }) })
  const bill: BillBreakdown = {
    week: week.key, label: week.label, through: row.through, contract: row.contract, installed: row.installed, pct: row.pct,
    retainagePct: row.retainagePct, held: row.held, depositWay: row.depositWay, credit: row.credit, before: row.before, progress: row.due,
    weekAmount: row.weekAmount, rooms, cos: cos.map((c) => ({ id: c.id, title: c.title, amount: c.amount || 0 })),
  }
  const me = meOf(s0.role)
  const coNames = cos.map((c) => c.title.split(' · ')[0])
  s0.commit(
    (s) => {
      s.money.unshift({
        id: `pb-${jobId}-${week.key}`, jobId, kind: 'progress', title: `Progress bill #${n} · week of ${week.label}`, week: week.key,
        amount: total, step: 0, state: 'todo', due: 'Draft',
        note: `${row.pct}% of the contract installed through ${row.through}, from the daily updates.${coNames.length ? ` With ${coNames.join(' and ')}.` : ''}`,
        log: [L(me, `Made from the week’s daily updates${row.due ? ` · ${fmtMoney(row.due)} progress` : ''}${coNames.length ? ` + ${coNames.join(', ')}` : ''}`)],
        action: 'Send to the PM', bill,
      })
      cos.forEach((c) => {
        const m = s.money.find((x) => x.id === c.id)
        if (!m) return
        m.step = 1
        m.state = 'waiting'
        m.due = `On progress bill #${n}`
        m.action = undefined
        m.log.push(L(me, `On progress bill #${n} · week of ${week.label}`))
      })
      addHist(s, jobId, { who: me, kind: 'money', title: `Progress bill #${n} made · ${fmtMoney(total)}`, detail: `Week of ${week.label} · ${row.pct}% installed${coNames.length ? ` · with ${coNames.join(', ')}` : ''}` })
    },
    `Progress bill #${n} made — ${job?.name || ''} · ${fmtMoney(total)}`,
    { close: true, sub: 'It’s in Billing → To invoice. The PM checks it, then it goes to the client.', flow: [{ who: 'yakov', label: 'Daily updates', state: 'done' }, { who: me, label: 'Bill made', state: 'done' }, { who: 'ys', label: 'PM checks it', state: 'now' }, { label: 'Client pays', state: 'next' }] },
  )
}
/** every bill still to make for a week, in one go */
export function makeAllBills(weekKey: string) {
  const s0 = S()
  const rows = weekBills(s0, weekOfKey(weekKey)).filter((r) => r.state === 'tobill')
  rows.forEach((r) => makeBill(r.jobId, weekKey))
}
/** a draft that hasn't gone anywhere can be taken back — its change orders wait for the next bill again */
export function undoBill(id: string) {
  const m0 = S().money.find((m) => m.id === id)
  if (!m0 || m0.step > 0) return
  S().commit(
    (s) => {
      const m = s.money.find((x) => x.id === id)
      if (!m) return
      ;(m.bill?.cos || []).forEach((c) => {
        const co = s.money.find((x) => x.id === c.id)
        if (!co) return
        co.step = 0
        co.state = 'todo'
        co.due = 'Approved'
        co.action = 'Add to next bill'
        co.log.push(L(meOf(s.role), `Back off ${m.title.split(' · ')[0]}`))
      })
      s.money = s.money.filter((x) => x.id !== id)
      addHist(s, m.jobId, { who: meOf(s.role), kind: 'money', title: `${m.title.split(' · ')[0]} taken back — not sent` })
    },
    'Bill taken back',
    { close: true, sub: 'Nothing went out. The week shows it to bill again.' },
  )
}
