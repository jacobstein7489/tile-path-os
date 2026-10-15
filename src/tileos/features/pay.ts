/* Weekly installer pay — worked out from the site manager's daily updates and the installer's PO.
 * Every day the update says how far each wall and floor moved; square feet × the rate on his PO = what we owe.
 * His bill is checked against that, room by room, so nobody bills for work that isn't on the wall. */
import { useStore, addHist, newTask, meOf, NOW, type Store } from '@/tileos/store'
import { kindOf } from './takeoff'
import { CREWS, PEOPLE, fmtMoney, type PersonKey } from '@/tileos/data/model'
import { tileOf } from '@/tileos/data/jobs'
import { addDaysIso } from '@/tileos/data/calendar'
import type { IPO } from '@/tileos/data/field'
import { shiftDeep } from '@/tileos/lib/today'

const S = () => useStore.getState()

export interface PayWeek { key: string; label: string; dates: string[]; current?: boolean }
/** "Oct 5 – 10", or "Sep 28 – Oct 3" across a month */
export function weekRange(key: string) {
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const end = addDaysIso(key, 5)
  const m = (iso: string) => `${M[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`
  return key.slice(5, 7) === end.slice(5, 7) ? `${m(key)} – ${+end.slice(8, 10)}` : `${m(key)} – ${m(end)}`
}
const labelled = <T extends PayWeek>(w: T): T => ({ ...w, label: weekRange(w.key) })
/** the week we're in — a running total, approved once it's over */
export const THIS_WEEK: PayWeek = labelled(shiftDeep({ key: '2026-09-28', label: 'Sep 28 – Oct 3', dates: ['Sep 28', 'Sep 29', 'Sep 30', 'Oct 1', 'Oct 2', 'Oct 3'], current: true }))
export const PAY_WEEKS: PayWeek[] = shiftDeep([
  { key: '2026-09-21', label: 'Sep 21 – 26', dates: ['Sep 21', 'Sep 22', 'Sep 23', 'Sep 24', 'Sep 25', 'Sep 26'] },
  { key: '2026-09-14', label: 'Sep 14 – 19', dates: ['Sep 14', 'Sep 15', 'Sep 16', 'Sep 17', 'Sep 18', 'Sep 19'] },
]).map(labelled)
/** the six work days of a week, for column heads: "Mon 21" */
export const weekDays = (w: PayWeek) => w.dates.map((d, i) => ({ date: d, head: new Date(addDaysIso(w.key, i) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }), num: d.split(' ')[1] }))

/** what each installer billed us for the week — sample. Room lines when his bill has them. */
export interface PayBill { amount: number; came: string; rooms?: Record<string, number> }
export const PAY_BILLS: Record<string, PayBill> = shiftDeep({
  'philip:2026-09-21': { amount: 6176, came: 'Emailed Sat, Sep 26', rooms: { '119:Boys Bath': 1500, '119:Girls Bath': 1944, '119:Guest Bath': 1004, '119:Master Bath': 1728 } },
  'leo:2026-09-21': { amount: 1746, came: 'Texted Sat, Sep 26' },
  'alex:2026-09-21': { amount: 2060, came: 'Emailed Sun, Sep 27' },
  'philip:2026-09-14': { amount: 3027, came: 'Emailed Sat, Sep 19' },
})

/** paid on each installer PO before weekly pay started here — from QuickBooks, sample */
export const PAID_EARLIER: Record<string, number> = { 'IPO-118': 3810, 'IPO-24C': 2060, 'IPO-2385': 26950, 'IPO-828': 14200 }

/* ---------------- the weeks before: already paid ----------------
 * What QuickBooks shows paid on each installer PO before weekly pay started (above), laid out week by week so the
 * pay page has a past to scroll back through. Same installer, same project, same total — the split is sample. */
const SPREAD: Record<string, { back: number[]; w: number[] }> = {
  'IPO-2385': { back: [1, 2, 3, 4, 5, 6], w: [17, 19, 15, 18, 16, 15] },
  'IPO-828': { back: [3, 4, 5, 6], w: [26, 24, 27, 23] },
  'IPO-24C': { back: [4, 5], w: [40, 60] },
  'IPO-118': { back: [1, 2], w: [55, 45] },
}
export const HIST_BACK = 6
export interface PaidRow { crew: PersonKey; jobs: { jobId: string; ipo: string; amount: number }[]; total: number; paidOn: string }
export interface PaidWeek extends PayWeek { rows: PaidRow[]; total: number }
const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const mdOf = (iso: string) => `${MON3[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`
/** the week `back` weeks before the oldest week the daily updates cover */
export function weekBefore(back: number): PayWeek {
  const key = addDaysIso(PAY_WEEKS[PAY_WEEKS.length - 1].key, -7 * back)
  return { key, label: weekRange(key), dates: [0, 1, 2, 3, 4, 5].map((i) => mdOf(addDaysIso(key, i))) }
}
/** oldest first */
export function paidWeeks(s: Pick<Store, 'ipos'>): PaidWeek[] {
  const out: PaidWeek[] = []
  for (let back = HIST_BACK; back >= 1; back--) {
    const w = weekBefore(back)
    const rows: PaidRow[] = []
    Object.entries(SPREAD).forEach(([ipoId, sp]) => {
      const i = sp.back.indexOf(back)
      const ipo = s.ipos.find((p) => p.id === ipoId)
      if (i < 0 || !ipo) return
      const total = PAID_EARLIER[ipoId] || 0
      const sumW = sp.w.reduce((n, x) => n + x, 0)
      /* whole dollars; the oldest week takes the rounding so the PO adds up exactly */
      const part = i === sp.back.length - 1 ? total - sp.w.slice(0, -1).reduce((n, x) => n + Math.round((total * x) / sumW), 0) : Math.round((total * sp.w[i]) / sumW)
      let r = rows.find((x) => x.crew === ipo.crew)
      if (!r) { r = { crew: ipo.crew as PersonKey, jobs: [], total: 0, paidOn: mdOf(addDaysIso(w.key, 11)) }; rows.push(r) }
      r.jobs.push({ jobId: ipo.jobId, ipo: ipo.id, amount: part })
      r.total += part
    })
    rows.sort((a, b) => CREWS.indexOf(a.crew) - CREWS.indexOf(b.crew))
    out.push({ ...w, rows, total: rows.reduce((n, r) => n + r.total, 0) })
  }
  return out
}

export interface PayLine { jobId: string; date: string; room: string; surface: string; from: number; to: number; sf: number | null; rate: number | null; amount: number | null; how: string }

/** the rate on his PO for this kind of work: per SF where the PO says so, or the PO line's amount ÷ its square feet */
function rateFor(lines: IPO['lines'], want: 'floor' | 'wall' | 'mosaic' | 'large' | 'border') {
  const perSF = (l: IPO['lines'][number]) => l.rate || (() => { const n = Number((l.qty.match(/([\d,]+)\s*SF/i)?.[1] || '').replace(/,/g, '')); return n ? Math.round((l.amount / n) * 100) / 100 : 0 })()
  const pick =
    want === 'mosaic' ? lines.find((l) => l.itemId === 'i-mosaic' || /mosaic/i.test(l.item)) :
    want === 'large' ? lines.find((l) => l.itemId === 'i-large' || /large|field/i.test(l.item)) :
    want === 'border' ? lines.find((l) => /border/i.test(l.item)) :
    want === 'wall' ? lines.find((l) => l.itemId === 'i-wall' || /wall/i.test(l.item)) :
    lines.find((l) => l.itemId === 'i-floor' || /floor|field|lobby/i.test(l.item))
  const l = pick || lines.find((x) => perSF(x) > 0)
  return l ? { rate: perSF(l), item: l.item } : null
}

type PayData = Pick<Store, 'diary' | 'rooms' | 'ipos'>
export function weekPay(s: PayData, crew: PersonKey, week: PayWeek) {
  const lines: PayLine[] = []
  Object.entries(s.diary).forEach(([jobId, entries]) => {
    const ipo = s.ipos.find((p) => p.jobId === jobId && p.crew === crew && p.status !== 'Rejected')
    entries
      .filter((e) => e.who === crew && week.dates.includes(e.date))
      .forEach((e) =>
        e.rooms.forEach((r) =>
          r.items.forEach((it) => {
            const x = s.rooms[jobId]?.find((rm) => rm.name === r.room)?.surfaces.find((y) => y.name === it.surface)
            const moved = it.to - it.from
            if (moved <= 0) return
            const base = { jobId, date: e.date, room: r.room, surface: it.surface, from: it.from, to: it.to }
            /* a lump-sum change order, paid by how far it got */
            const co = ipo?.changes.find((c) => c.status !== 'pending' && new RegExp(it.surface.split(' ')[0], 'i').test(c.text))
            if (!x?.sf && co) {
              lines.push({ ...base, sf: null, rate: null, amount: Math.round((co.amount * moved) / 100), how: `${co.co} · ${moved}% of ${fmtMoney(co.amount)}` })
              return
            }
            if (!x?.sf || !ipo) {
              lines.push({ ...base, sf: null, rate: null, amount: null, how: !ipo ? 'No PO for this project' : 'No square feet on this surface yet' })
              return
            }
            const k = kindOf(x)
            const t = tileOf(jobId, x.tile)
            const big = t ? Math.max(...(t.size.match(/\d+/g) || ['12']).map(Number)) : 12
            const want = k === 'shower-floor' ? (big <= 4 ? 'mosaic' : 'floor') : /border/i.test(x.name) ? 'border' : k === 'wall' ? 'wall' : big >= 48 ? 'large' : 'floor'
            const r0 = rateFor(ipo.lines, want)
            const sf = Math.round(((x.sf * moved) / 100) * 10) / 10
            const amount = r0 ? Math.round(sf * r0.rate) : null
            lines.push({ ...base, sf, rate: r0?.rate ?? null, amount, how: r0 ? `${sf} SF × $${r0.rate}` : 'No rate on the PO' })
          }),
        ),
      )
  })
  const order = (d: string) => week.dates.indexOf(d)
  lines.sort((a, b) => order(a.date) - order(b.date))
  const total = lines.reduce((n, l) => n + (l.amount || 0), 0)
  const days = new Set(lines.map((l) => l.date)).size
  const sf = Math.round(lines.reduce((n, l) => n + (l.sf || 0), 0))
  const jobs = Array.from(new Set(lines.map((l) => l.jobId)))
  const unpriced = lines.filter((l) => l.amount == null).length
  return { lines, total, days, sf, jobs, unpriced }
}

export const payKey = (crew: string, week: string) => `${crew}:${week}`

/* ---------------- one installer's week: what we owe, what he billed, where it stands ---------------- */
export type PayState = 'check' | 'ready' | 'nobill' | 'asked' | 'approved' | 'paid' | 'running'
export const PAY_STATE: Record<PayState, { label: string; tone: 'bad' | 'info' | 'neutral' | 'warn' | 'ok' }> = {
  running: { label: 'This week so far', tone: 'info' },
  check: { label: 'Bill doesn’t match', tone: 'bad' },
  ready: { label: 'Matches his bill', tone: 'info' },
  nobill: { label: 'No bill yet', tone: 'neutral' },
  asked: { label: 'Asked him — on hold', tone: 'warn' },
  approved: { label: 'Approved', tone: 'ok' },
  paid: { label: 'Paid', tone: 'ok' },
}
export interface PayRow { crew: PersonKey; week: PayWeek; calc: ReturnType<typeof weekPay>; bill?: PayBill; diff: number; state: PayState; rec?: Store['pay'][string]; owe: number }

export function payRow(s: PayData & Pick<Store, 'pay'>, crew: PersonKey, week: PayWeek): PayRow | null {
  const calc = weekPay(s, crew, week)
  const key = payKey(crew, week.key)
  /* the sample installers' bills only count where the sample's installer POs are — a clean slate starts with none */
  const bill = s.ipos.some((p) => p.crew === crew && /^(IPO|PO)-/.test(p.id) && p.status !== 'Rejected' && PAY_BILLS[key]) && s.ipos.some((p) => p.id === 'IPO-2385' || p.id === 'IPO-828' || p.id === 'IPO-24C' || p.id === 'IPO-118') ? PAY_BILLS[key] : undefined
  const rec = s.pay[key]
  if (!calc.lines.length && !bill && !rec) return null
  const diff = bill ? bill.amount - calc.total : 0
  const off = Math.abs(diff) > Math.max(25, calc.total * 0.01)
  const state: PayState = week.current ? 'running' : rec ? rec.status : !bill ? 'nobill' : off ? 'check' : 'ready'
  /* we pay what the updates show — or his bill, if he asked for less */
  const owe = rec ? rec.amount : bill ? Math.min(bill.amount, calc.total) : calc.total
  return { crew, week, calc, bill, diff, state, rec, owe }
}
export const payRows = (s: PayData & Pick<Store, 'pay'>, week: PayWeek) => CREWS.map((c) => payRow(s, c, week)).filter((r): r is PayRow => !!r)
/** weeks still waiting for a yes */
export const payOpen = (s: PayData & Pick<Store, 'pay'>) => payRows(s, PAY_WEEKS[0]).filter((r) => !['approved', 'paid'].includes(r.state))

/** room by room: the updates against his bill */
export function payGrid(row: PayRow) {
  type Surf = { surface: string; from: number; to: number; byDay: Record<string, number>; sf: number | null; rate: number | null; amount: number; how: string; lump: boolean }
  const out: { jobId: string; room: string; amount: number; bill?: number; surfaces: Surf[] }[] = []
  row.calc.lines.forEach((l) => {
    let g = out.find((x) => x.jobId === l.jobId && x.room === l.room)
    if (!g) {
      g = { jobId: l.jobId, room: l.room, amount: 0, bill: row.bill?.rooms?.[`${l.jobId}:${l.room}`], surfaces: [] }
      out.push(g)
    }
    let x = g.surfaces.find((y) => y.surface === l.surface)
    if (!x) {
      x = { surface: l.surface, from: l.from, to: l.to, byDay: {}, sf: l.sf == null ? null : 0, rate: l.rate, amount: 0, how: l.how, lump: l.sf == null && l.amount != null }
      g.surfaces.push(x)
    }
    x.from = Math.min(x.from, l.from)
    x.to = Math.max(x.to, l.to)
    x.byDay[l.date] = (x.byDay[l.date] || 0) + (l.to - l.from)
    if (x.sf != null && l.sf != null) x.sf = Math.round((x.sf + l.sf) * 10) / 10
    x.amount += l.amount || 0
    g.amount += l.amount || 0
  })
  return out
}

/** the installer's PO: what it's worth, what we've paid on it, what's left */
export function poBalance(s: PayData & Pick<Store, 'pay'>, crew: PersonKey, jobId: string, week: PayWeek) {
  const ipo = s.ipos.find((p) => p.jobId === jobId && p.crew === crew && p.status !== 'Rejected')
  if (!ipo) return null
  const total = ipo.lines.reduce((n, l) => n + l.amount, 0) + ipo.changes.filter((c) => c.status !== 'pending').reduce((n, c) => n + c.amount, 0)
  const onJob = (w: PayWeek) => weekPay(s, crew, w).lines.filter((l) => l.jobId === jobId).reduce((n, l) => n + (l.amount || 0), 0)
  const paidWeeks = PAY_WEEKS.filter((w) => w.key < week.key && ['approved', 'paid'].includes(s.pay[payKey(crew, w.key)]?.status || ''))
  const earlier = PAID_EARLIER[ipo.id] || 0
  const before = earlier + paidWeeks.reduce((n, w) => n + onJob(w), 0)
  const now = onJob(week)
  return { ipo, total, before, now, left: total - before - now, weeks: paidWeeks.length, earlier }
}

/** where his bill and the updates part ways, in a sentence */
export function mismatchWhy(row: PayRow) {
  if (!row.bill || row.state !== 'check') return null
  const more = row.diff > 0
  const rooms = payGrid(row).filter((g) => g.bill != null && Math.abs(g.bill - g.amount) > 5)
  const name = PEOPLE[row.crew].short
  if (!rooms.length) return { more, text: more ? `${name}’s bill is ${fmtMoney(row.diff)} more than the daily updates show.` : `${name} billed ${fmtMoney(-row.diff)} less than the daily updates show — maybe something was left off.`, rooms: [] }
  return {
    more,
    text: more ? `${name}’s bill is ${fmtMoney(row.diff)} more than the daily updates show.` : `${name} billed ${fmtMoney(-row.diff)} less than the updates show.`,
    rooms: rooms.map((g) => ({ room: g.room, jobId: g.jobId, bill: g.bill!, calc: g.amount, where: g.surfaces.map((x) => `${x.surface} at ${x.to}%`).join(', ') })),
  }
}

/* ---------------- what you do with it ---------------- */
export function approvePay(crew: PersonKey, weekKey: string) {
  const s0 = S()
  const week = PAY_WEEKS.find((w) => w.key === weekKey)!
  const row = payRow(s0, crew, week)
  if (!row) return
  const amount = row.bill ? Math.min(row.bill.amount, row.calc.total) : row.calc.total
  const key = payKey(crew, weekKey)
  s0.commit(
    (s) => {
      s.pay[key] = { status: 'approved', amount, date: NOW }
      row.calc.jobs.forEach((jobId) => {
        const part = row.calc.lines.filter((l) => l.jobId === jobId).reduce((n, l) => n + (l.amount || 0), 0)
        const ipo = s.ipos.find((p) => p.jobId === jobId && p.crew === crew && p.status !== 'Rejected')
        ipo?.log.push({ date: NOW, who: meOf(s.role), text: `Week of ${week.label} approved · ${fmtMoney(part)}` })
        addHist(s, jobId, { who: meOf(s.role), kind: 'money', title: `${PEOPLE[crew].short}’s pay approved · ${week.label}`, detail: `${fmtMoney(part)} from the daily updates${ipo ? ` · a bill on ${ipo.id} in QuickBooks` : ''}`, ref: { t: 'pay', crew, week: weekKey } })
      })
      s.tasks.forEach((t) => {
        if (t.action?.kind === `pay:${key}` && t.state !== 'done') {
          t.state = 'done'
          t.doneAt = NOW
          t.log.push({ date: NOW, who: meOf(s.role), text: `Approved ${fmtMoney(amount)}` })
        }
      })
    },
    `${PEOPLE[crew].short}’s week approved — ${fmtMoney(amount)}`,
    { close: true, sub: 'It’s a bill in QuickBooks, ready for Friday’s payments.', flow: [{ who: 'yakov', label: 'Daily updates', state: 'done' }, { who: meOf(S().role), label: 'Approved', state: 'done' }, { who: 'accounting', label: 'Pays it', state: 'now' }, { who: crew, label: 'Paid', state: 'next' }] },
  )
}

export function askAboutPay(crew: PersonKey, weekKey: string) {
  const s0 = S()
  const week = PAY_WEEKS.find((w) => w.key === weekKey)!
  const row = payRow(s0, crew, week)
  if (!row) return
  const why = mismatchWhy(row)
  const key = payKey(crew, weekKey)
  const jobId = row.calc.jobs[0] || ''
  s0.commit(
    (s) => {
      s.pay[key] = { status: 'asked', amount: row.calc.total, date: NOW, note: why?.rooms.map((r) => r.room).join(', ') }
      newTask(s, {
        jobId,
        title: `${PEOPLE[crew].short}’s bill is ${fmtMoney(Math.abs(row.diff))} ${row.diff > 0 ? 'over' : 'under'} the daily updates`,
        detail: why ? [why.text, ...why.rooms.map((r) => `${r.room}: billed ${fmtMoney(r.bill)}, the updates show ${fmtMoney(r.calc)} (${r.where}).`)].join(' ') : undefined,
        type: 'Money',
        owner: meOf(s.role),
        for: [s.role],
        state: 'waiting',
        waitingOn: PEOPLE[crew].short,
        followUp: 'Tomorrow',
        tone: 'warn',
        action: { label: 'Open his week', kind: `pay:${key}` },
      })
    },
    `Asked ${PEOPLE[crew].short} about his bill`,
    { close: true, sub: 'His week is on hold until he answers — it comes back to you tomorrow either way.', flow: [{ who: meOf(S().role), label: 'Asked', state: 'done' }, { who: crew, label: 'Answers', state: 'now' }, { who: meOf(S().role), label: 'Approve', state: 'next' }] },
  )
}

export function undoPay(crew: PersonKey, weekKey: string) {
  S().commit((s) => {
    delete s.pay[payKey(crew, weekKey)]
  }, 'Back to waiting for a yes')
}
