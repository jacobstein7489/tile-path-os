/* Game plan — Cobblestone's upcoming-job sheet, inside the software. Same columns as the sheet, but the
 * checklist fills itself from what really happened: pick the installer and his PO is drafted, approve it and it
 * goes out, he accepts and "Installer confirmed" turns Yes. Tile selection, materials and the deposit come from
 * the project, the POs and billing. Click any cell to do that step. Start moves the project down to In progress. */
import * as React from 'react'
import { ChevronDown, Play, CalendarDays, CornerDownRight, UserRoundPlus, FileText, StickyNote, Check, X, Clock3, Contrast, Rocket, CalendarClock, CalendarX2, FileClock, HardHat, Plus } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel, MenuSep, Tip } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, PX, Group, DateTile, ProgressRing, StepPill, Status, Bubbles } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import type { Prep } from '@/tileos/data/upcoming'
import { estAmount } from '@/tileos/data/estimates'
import { setPlan, startProject } from './flows'
import { pickInstaller } from './flows2'
import { materialStatus } from './takeoff'
import { TODAY } from '@/tileos/lib/today'

const UPCOMING = ['awarded', 'setup', 'verification', 'ready', 'scheduled']

/* ---------------- who's free, from the schedule ---------------- */
const nextWorkday = (iso: string) => {
  const d = new Date(iso + 'T12:00:00')
  do d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6)
  return d.toISOString().slice(0, 10)
}
const shortDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
export function crewFree(s: Store) {
  return CREWS.map((crew) => {
    const last = s.bookings.filter((b) => b.crew === crew).map((b) => b.end).sort().pop()
    return { crew, iso: !last || last < TODAY ? TODAY : nextWorkday(last) }
  }).sort((a, b) => a.iso.localeCompare(b.iso))
}

/* a meeting typed the way people say it — "Design meeting Thursday 1030" — keeps its day and time for the agenda */
const DAYS: [RegExp, string][] = [[/\btoday\b/i, 'Today'], [/\btomorrow\b/i, 'Tomorrow'], [/\bmon(day)?\b/i, 'Mon'], [/\btue(s|sday)?\b/i, 'Tue'], [/\bwed(nesday)?\b/i, 'Wed'], [/\bthu(r|rs|rsday)?\b/i, 'Thu'], [/\bfri(day)?\b/i, 'Fri']]
export function parseMeeting(text: string): Prep['meeting'] {
  const t = text.trim()
  if (!t) return { text: 'TBD' }
  const day = DAYS.find(([re]) => re.test(t))?.[1]
  const m = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) || t.match(/\b(\d{1,2})(\d{2})\b/)
  let time: string | undefined
  if (m) {
    const h = Number(m[1])
    const min = m[2] && m[2] !== '00' ? `:${m[2]}` : ''
    const ap = m[3] ? m[3].toUpperCase() : h >= 7 && h < 12 ? 'AM' : 'PM'
    if (h >= 1 && h <= 12) time = `${h}${min} ${ap}`
  }
  let rest = t
  if (day) rest = rest.replace(DAYS.find(([, d]) => d === day)![0], '')
  if (m) rest = rest.replace(m[0], '')
  rest = rest.replace(/[\s—–,-]+$/g, '').replace(/^[\s—–,-]+/g, '').replace(/\s{2,}/g, ' ').trim()
  return { text: rest || 'Meeting', day, time }
}
export const meetingText = (m?: Prep['meeting']) => (m ? [m.text, [m.day, m.time].filter(Boolean).join(' ')].filter(Boolean).join(' — ') : 'TBD')

/* ---------------- the checklist before the crew starts, read from the system ----------------
 * Tile picked → tile on site → our materials → installer PO → deposit. Each step shows a short
 * status under its circle, and clicking it always takes you to the place where that step gets done. */
type CellState = 'yes' | 'no' | 'wait' | 'part' | 'na' | 'bad'
export interface Cell { state: CellState; label: string; hint: string; run?: () => void; disabled?: string }
export type CellKey = 'picked' | 'onsite' | 'material' | 'po' | 'deposit'
export const CELLS: { key: CellKey; head: [string, string]; full: string; w: number; short: string }[] = [
  { key: 'picked', head: ['Tile', 'picked'], full: 'Tile picked for every surface', w: 76, short: 'Tile picked' },
  { key: 'onsite', head: ['Tile', 'on site'], full: 'Finish tile delivered to site', w: 76, short: 'Tile on site' },
  { key: 'material', head: ['Our', 'materials'], full: 'Our setting materials and trim', w: 76, short: 'Our materials' },
  { key: 'po', head: ['Installer', 'PO'], full: 'Installer PO sent and accepted', w: 76, short: 'Installer PO' },
  { key: 'deposit', head: ['Deposit', 'paid'], full: 'Deposit paid', w: 76, short: 'Deposit paid' },
]
export function installerOf(s: Store, j: Job): PersonKey | undefined {
  const p = s.prep[j.id]?.installer
  if (p && p !== 'tbd') return p
  return (s.bookings.find((b) => b.jobId === j.id)?.crew as PersonKey) || undefined
}
export function planCells(s: Store, j: Job): Record<CellKey, Cell> {
  const crew = installerOf(s, j)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === j.id)
  const openIPO = () => ipo && s.open({ t: 'ipo', id: ipo.id })
  const book = () => s.open({ t: 'book', jobId: j.id, crew })
  /* tile picked: every surface has its tile */
  const surfaces = (s.rooms[j.id] || []).flatMap((r) => r.surfaces)
  const picked = surfaces.filter((x) => x.tile).length
  const openScope = () => s.open({ t: 'job', id: j.id, tab: 'scope' })
  const tilesPicked: Cell = !surfaces.length
    ? { state: 'no', label: 'No rooms', hint: 'Build the rooms and surfaces first', run: openScope }
    : picked < surfaces.length
      ? { state: 'part', label: `${picked} of ${surfaces.length}`, hint: `${surfaces.length - picked} surfaces still need a tile`, run: openScope }
      : { state: 'yes', label: 'All picked', hint: 'Every surface has its tile', run: openScope }
  /* tile on site: from the tile checks (ordered vs our takeoff vs delivered), else what the office marked */
  const checks = s.checks.filter((c) => c.jobId === j.id)
  const short = checks.find((c) => c.ordered < Math.ceil(c.measured * (1 + c.wastePct / 100)) && !c.note)
  const openOrders = () => s.open({ t: 'job', id: j.id, tab: 'orders' })
  const got = checks.reduce((n, c) => n + Math.min(1, c.received / Math.max(1, c.ordered)), 0)
  const onsite: Cell = short
    ? { state: 'bad', label: `${Math.ceil(short.measured * (1 + short.wastePct / 100)) - short.ordered} ${short.unit} short`, hint: `${short.tag}: the store’s order doesn’t cover our takeoff`, run: () => s.open({ t: 'qty', jobId: j.id, tag: short.tag }) }
    : checks.length
      ? got >= checks.length
        ? { state: 'yes', label: 'On site', hint: 'All finish tile delivered', run: openOrders }
        : checks.some((c) => c.received > 0)
          ? { state: 'part', label: 'Part here', hint: checks.filter((c) => c.received < c.ordered).map((c) => `${c.tag} ${c.received} of ${c.ordered} ${c.unit}`).join(' · '), run: openOrders }
          : { state: 'wait', label: checks[0].eta ? `Due ${checks[0].eta}` : 'Ordered', hint: 'Ordered by the GC — not delivered yet', run: openOrders }
      : s.prep[j.id]?.tile === 'yes'
        ? { state: 'yes', label: 'On site', hint: 'Finish tile delivered', run: openOrders }
        : s.prep[j.id]?.tile === 'part'
          ? { state: 'part', label: 'Part here', hint: 'Some of the tile is on site', run: openOrders }
          : { state: 'no', label: 'Not yet', hint: 'Finish tile not delivered yet', run: openOrders }
  /* our materials — worked out from the scope, against what's ordered and on site */
  const ms = materialStatus(s, j.id)
  const material: Cell = { state: ms.state, label: ms.label, hint: ms.hint, run: ms.go === 'order' ? () => s.open({ t: 'newpo', jobId: j.id, fromTakeoff: true }) : ms.go === 'scope' ? openScope : openOrders }
  /* the installer's PO */
  const po: Cell = !ipo
    ? { state: 'no', label: crew ? 'Not sent' : 'No installer', hint: crew ? `Send ${PEOPLE[crew].name} his PO` : 'Pick the installer and send him the PO', run: book }
    : ipo.status === 'Draft'
      ? { state: 'part', label: 'Draft', hint: `${ipo.id} saved, not sent yet`, run: openIPO }
      : ipo.status === 'Sent'
        ? { state: 'wait', label: 'Sent', hint: `${ipo.id} sent ${ipo.date} — waiting for ${PEOPLE[ipo.crew].name} to accept`, run: openIPO }
        : ipo.status === 'Rejected'
          ? { state: 'bad', label: 'Declined', hint: `${PEOPLE[ipo.crew].name} turned it down${ipo.reason ? ' — ' + ipo.reason.toLowerCase() : ''}`, run: book }
          : { state: 'yes', label: 'Accepted', hint: `${PEOPLE[ipo.crew].name} accepted ${ipo.id} on ${ipo.date}`, run: openIPO }
  /* the deposit */
  const dep = s.money.find((m) => m.jobId === j.id && m.kind === 'deposit')
  const openDep = () => dep && s.open({ t: 'money', id: dep.id })
  const deposit: Cell = !dep
    ? { state: 'na', label: 'None', hint: 'No deposit on this project' }
    : dep.state === 'paid'
      ? { state: 'yes', label: 'Paid', hint: `${fmtMoney(dep.amount || 0)} · ${dep.date || 'received'}`, run: openDep }
      : dep.paid
        ? { state: 'part', label: 'Part paid', hint: `${fmtMoney(dep.paid)} received, ${fmtMoney((dep.amount || 0) - dep.paid)} still open`, run: openDep }
        : dep.step >= 1
          ? { state: 'wait', label: `Invoiced`, hint: `Invoice ${dep.ref || ''} sent — waiting for payment`, run: openDep }
          : { state: 'no', label: 'To invoice', hint: 'Send the deposit invoice', run: openDep }
  return { picked: tilesPicked, onsite, material, po, deposit }
}

export type Row = { j: Job; p: Prep; group: 'coming' | 'progress'; pending?: string }
export function rowsOf(s: Store): Row[] {
  /* won, not started: from the client's yes until the crew starts. Started projects live in Projects. */
  const won = Object.values(s.jobs).filter((j) => j.kind !== 'repair' && UPCOMING.includes(j.stage))
  const rows: Row[] = won.map((j) => ({ j, p: s.prep[j.id] || {}, group: 'coming' }))
  const rank = (r: Row) => (r.p.targetISO ? 0 : 1)
  return rows.sort((a, b) => rank(a) - rank(b) || (a.p.targetISO || '').localeCompare(b.p.targetISO || '') || a.j.name.localeCompare(b.j.name))
}

/* ================= the page ================= */
type Bucket = 'now' | 'soon' | 'tbd'
const bucketOf = (r: Row): Bucket => (!r.p.targetISO ? 'tbd' : r.p.targetISO <= TODAY ? 'now' : 'soon')
const BUCKET_LABEL: Record<Bucket | 'all', string> = { all: 'Won, not started yet', now: 'Can start now', soon: 'Starting soon', tbd: 'Start date to set' }
/* the sheet's columns: project & meeting · installer · the five steps · next step · action */
const COLS = 'plan-grid'

export function UpcomingPage() {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const [inst, setInst] = React.useState('all')
  const [bucket, setBucket] = React.useState<Bucket | 'all'>('all')
  const match = (r: Row) => (inst === 'all' || (inst === 'tbd' ? !installerOf(s, r.j) : installerOf(s, r.j) === inst)) && (!q || `${r.j.name} ${r.j.client} ${r.p.nextStep || ''} ${r.p.notes || ''}`.toLowerCase().includes(q.toLowerCase()))
  const all = rowsOf(s).filter(match)
  const inB = (b: Bucket) => all.filter((r) => bucketOf(r) === b)
  const shown = bucket === 'all' ? all : inB(bucket)
  const coming = shown
  const pendingN = s.estimates.filter((e) => e.status === 'sent' && s.jobs[e.jobId]).length
  const allSet = (r: Row) => { const c = planCells(s, r.j); return CELLS.every((k) => ['yes', 'na'].includes(c[k.key].state)) }
  const free = crewFree(s)
  const freeNow = free.filter((f) => f.iso === TODAY)
  const pick = (b: Bucket) => () => setBucket(bucket === b ? 'all' : b)
  return (
    <Page
      title="Game plan"
      sub="Won projects that haven’t started — what has to be ready before the crew starts."
      top={
        <Bubbles
          items={[
            { key: 'now', label: 'Can start now', count: inB('now').length, icon: <Rocket />, color: 'green', on: bucket === 'now', onClick: pick('now') },
            { key: 'soon', label: 'Starting soon', count: inB('soon').length, icon: <CalendarClock />, color: 'blue', on: bucket === 'soon', onClick: pick('soon') },
            { key: 'tbd', label: 'Start date to set', count: inB('tbd').length, icon: <CalendarX2 />, color: 'slate', on: bucket === 'tbd', onClick: pick('tbd') },
            { key: 'pending', label: 'Estimates out — may come next', count: pendingN, icon: <FileClock />, color: 'violet', onClick: () => s.go({ page: 'estimates', q: { status: 'sent' } }), gapBefore: true },
          ]}
        />
      }
      toolbar={
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="text-[0.9375rem] font-semibold text-ink">{BUCKET_LABEL[bucket]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{shown.length}</span></span>
          <div className="ml-4 flex min-w-0 items-center gap-1.5 text-[0.84375rem] text-muted max-xl:hidden">
            <span className="mr-0.5 font-medium">Free now</span>
            {freeNow.length ? freeNow.map((f) => (
              <span key={f.crew} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white pl-1 pr-3 text-[0.8125rem] font-semibold text-ink-2"><Avatar who={f.crew} size={24} />{PEOPLE[f.crew].short}</span>
            )) : <span className="text-faint">nobody</span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Filter icon={<UserRoundPlus />} label="Installer" value={inst} options={[{ key: 'tbd', label: 'Not picked yet' }, ...CREWS.map((c) => ({ key: c, label: PEOPLE[c].name }))]} onChange={setInst} />
            <ToolbarSearch value={q} onChange={setQ} placeholder="Search" />
          </div>
        </div>
      }
    >
      {/* laptops and up: the sheet */}
      <div className="max-xl:hidden">
        <div className={cn('border-b border-line-2 bg-wash py-3 text-[0.78125rem] font-semibold text-muted', COLS, PX)}>
          <span>Project · next meeting</span>
          <span>Installer</span>
          {CELLS.map((c) => <span key={c.key} className="text-center leading-[1.2]" title={c.full}>{c.head[0]}<br />{c.head[1]}</span>)}
          <span className="plan-next">Next step · note</span>
          <span />
        </div>
        {coming.map((r) => <PlanRow key={r.j.id} r={r} />)}
        {!shown.length && <div className="border-t border-line-2 px-6 py-14 text-center text-[0.875rem] text-muted">Nothing here.</div>}
      </div>
      {/* tablets and phones: one card per project, same answers */}
      <div className={cn('flex flex-col gap-3 py-4 xl:hidden', PX)}>
        {coming.map((r) => <PlanCard key={r.j.id} r={r} />)}
      </div>
    </Page>
  )
}

/** the start date as a calendar leaf */
export function StartTile({ r }: { r: Row }) {
  const { p, j } = r
  if (r.pending) return <DateTile top="Est." main="—" tone="vio" />
  if (r.group === 'progress') return <ProgressRing pct={j.pct ?? 0} size={48} tone="ok" label={`${j.pct ?? 0}%`} />
  if (!p.targetISO) return <DateTile top="Start" main="TBD" />
  if (p.targetISO <= TODAY) return <DateTile top="Ready" main="Now" tone="ok" />
  const d = new Date(p.targetISO + 'T12:00:00')
  return <DateTile top={d.toLocaleDateString('en-US', { month: 'short' })} main={String(d.getDate())} tone="info" />
}

/** one step of the checklist as a circle: green check done, amber part-way, blue waiting, dashed not yet */
export function StepDot({ cell, label, caption = true }: { cell: Cell; label: string; caption?: boolean }) {
  const body =
    cell.state === 'yes' ? <Check className="h-4 w-4" strokeWidth={3.2} />
    : cell.state === 'bad' ? <X className="h-4 w-4" strokeWidth={3.2} />
    : cell.state === 'wait' ? <Clock3 className="h-4 w-4" strokeWidth={2.4} />
    : cell.state === 'part' ? <Contrast className="h-4 w-4" strokeWidth={2.4} />
    : cell.state === 'na' ? <span className="text-[0.8125rem] font-bold">–</span>
    : <Plus className="h-4 w-4 text-faint transition group-hover/dot:text-brand-600" strokeWidth={2.4} />
  const tone = cell.state === 'yes' ? 'text-ok-700' : cell.state === 'bad' ? 'text-bad-600' : cell.state === 'wait' ? 'text-brand-600' : cell.state === 'part' ? 'text-warn-700' : 'text-muted'
  return (
    <Tip label={`${label} — ${cell.disabled || cell.hint}`}>
      <button
        type="button"
        aria-label={`${label}: ${cell.label}`}
        disabled={!cell.run}
        onClick={(e) => { e.stopPropagation(); cell.run?.() }}
        className="group/dot flex min-w-0 flex-col items-center gap-1 disabled:cursor-default"
      >
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-full transition group-enabled/dot:group-hover/dot:scale-110',
            cell.state === 'yes' && 'bg-ok-500 text-white shadow-[0_0.1875rem_0.5rem_-0.125rem_rgba(18,183,106,.55)]',
            cell.state === 'bad' && 'bg-bad-500 text-white shadow-[0_0.1875rem_0.5rem_-0.125rem_rgba(240,68,56,.55)]',
            cell.state === 'wait' && 'bg-brand-50 text-brand-600 ring-2 ring-inset ring-brand-200',
            cell.state === 'part' && 'bg-warn-50 text-warn-700 ring-2 ring-inset ring-warn-300',
            cell.state === 'no' && 'border-2 border-dashed border-[#d9d3c9] bg-white group-hover/dot:border-brand-400',
            cell.state === 'na' && 'text-faint',
          )}
        >
          {body}
        </span>
        {caption && <span className={cn('max-w-full truncate text-[0.71875rem] font-semibold leading-none', tone)}>{cell.label}</span>}
      </button>
    </Tip>
  )
}

/* ---------------- one project, one row of the sheet ---------------- */
function PlanRow({ r }: { r: Row }) {
  const s = useStore()
  const { j, p } = r
  const inProgress = r.group === 'progress'
  const cells = planCells(s, j)
  const set = (patch: Partial<Prep>) => setPlan(j.id, patch)
  const est = r.pending ? s.estimates.find((e) => e.id === r.pending) : undefined
  const target = p.target || ''
  const timing = r.pending
    ? `${r.pending} · ${fmtMoney(estAmount(est!))}`
    : inProgress
      ? target
      : /^Ready now — /.test(target)
        ? `Ready: ${target.replace(/^Ready now — /, '')}`
        : target === 'Ready now' || target === 'TBD'
          ? ''
          : target.replace(/\s+—\s+[A-Z][a-z]{2} \d{1,2}$/, '')
  const openIt = () => s.open({ t: r.pending ? 'estimate' : 'job', id: r.pending || j.id })
  return (
    <div className={cn('border-t border-line-2 py-3.5 transition-colors hover:bg-[#f7f5f0]', COLS, PX)}>
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={openIt} className="shrink-0" aria-label={`Open ${j.name}`}><StartTile r={r} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <button onClick={openIt} className="truncate text-left text-[0.9375rem] font-semibold leading-5 text-ink hover:text-brand-600">{j.name}</button>
            {timing && <span className="truncate text-[0.78125rem] font-medium text-muted">{timing}</span>}
          </div>
          {r.pending ? <div className="mt-1 truncate text-[0.8125rem] text-muted">{p.notes || 'Waiting for the client’s answer'}</div> : <MeetingLine m={p.meeting} onSave={(v) => set({ meeting: parseMeeting(v) })} />}
        </div>
      </div>
      <div className="min-w-0">{r.pending ? <span className="text-[0.8125rem] text-faint">After approval</span> : <InstallerPick job={j} locked={inProgress} />}</div>
      {r.pending ? (
        <div className="col-span-5 flex justify-center">
          <span className="inline-flex h-8 items-center gap-2 rounded-full bg-vio-50 px-3.5 text-[0.78125rem] font-semibold text-vio-600"><FileText className="h-4 w-4" />Joins the plan when approved</span>
        </div>
      ) : (
        CELLS.map((c) => <div key={c.key} className="flex min-w-0 justify-center"><StepDot cell={cells[c.key]} label={c.short} /></div>)
      )}
      <div className="plan-next min-w-0">
        {r.pending ? (
          <span className="line-clamp-2 text-[0.84375rem] font-semibold leading-[1.125rem] text-ink-2">Verify whether the job is approved</span>
        ) : (
          <>
            <EditText value={p.nextStep || ''} placeholder="Add the next step" onSave={(v) => set({ nextStep: v })} strong />
            <EditText value={p.notes || ''} placeholder="Add a note" onSave={(v) => set({ notes: v })} icon={<StickyNote />} faintEmpty />
          </>
        )}
      </div>
      <div className="flex justify-end"><RowAction r={r} cells={cells} /></div>
    </div>
  )
}

/** kept for the project window */
export function CellButton({ cell, label }: { cell: Cell; label: string; wide?: boolean }) {
  return <StepDot cell={cell} label={label} />
}

function RowAction({ r, cells }: { r: Row; cells: Record<CellKey, Cell> }) {
  const s = useStore()
  const { j } = r
  if (r.pending) return <Button size="sm" variant="outline" onClick={() => s.open({ t: 'estimate', id: r.pending })}>Open</Button>
  if (r.group === 'progress') return <Button size="sm" variant="ghost" onClick={() => s.open({ t: 'job', id: j.id })}>Open</Button>
  const crew = installerOf(s, j)
  const open = CELLS.filter((c) => !['yes', 'na'].includes(cells[c.key].state)).map((c) => c.full.replace(/\?$/, '').replace(/ —.*$/, ''))
  if (!open.length && crew) return <Button size="sm" variant="primary" icon={<Play />} onClick={() => startProject(j.id)}>Start</Button>
  return (
    <Menu align="end" width={300} trigger={<Button size="sm" variant="outline" icon={<Play />}>Start</Button>}>
      <div className="px-2.5 pb-2 pt-2">
        <div className="text-[0.875rem] font-semibold text-ink">{open.length} step{open.length === 1 ? '' : 's'} still open on {j.name}</div>
        <div className="mt-1 text-[0.8125rem] leading-snug text-muted">{open.join(' · ')}{!crew ? ' · no installer picked' : ''}</div>
      </div>
      <MenuSep />
      {crew ? <MenuItem icon={<Play className="h-4 w-4" />} onSelect={() => startProject(j.id)}>Start anyway</MenuItem> : <div className="px-2.5 py-2 text-[0.8125rem] text-muted">Pick the installer first — his PO is drafted for you.</div>}
    </Menu>
  )
}

/** the installer: his name, or a button that opens the booking (pick him, look over his PO, send it) */
export function InstallerPick({ job, locked, wide }: { job: Job; locked?: boolean; wide?: boolean }) {
  const s = useStore()
  const who = installerOf(s, job)
  return (
    <button
      disabled={locked}
      onClick={(e) => { e.stopPropagation(); s.open({ t: 'book', jobId: job.id, crew: who }) }}
      aria-label={who ? `Installer ${PEOPLE[who].name} — change` : 'Pick the installer'}
      className={cn(
        'inline-flex h-8 max-w-full items-center gap-2 rounded-full text-[0.8125rem] font-semibold transition',
        who ? 'pl-1 pr-3 text-ink hover:bg-wash-2' : 'border border-dashed border-[#c9ced5] px-3 text-muted hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
        wide && 'w-full',
        locked && 'cursor-default hover:bg-transparent',
      )}
    >
      {who ? <Avatar who={who} size={24} /> : <UserRoundPlus className="h-3.5 w-3.5" />}
      <span className="truncate">{who ? PEOPLE[who].name : 'Pick installer'}</span>
    </button>
  )
}

/** the next meeting as people say it; the day and time stand out */
export function MeetingLine({ m, onSave }: { m?: Prep['meeting']; onSave: (v: string) => void }) {
  const set = !!m && m.text !== 'TBD'
  const when = set ? [m!.day, m!.time].filter(Boolean).join(' ') : ''
  return (
    <EditText
      value={set ? meetingText(m) : ''}
      placeholder="No meeting set"
      onSave={onSave}
      icon={<CalendarDays />}
      display={set ? (<span className="truncate">{when && <span className="font-semibold text-brand-600">{when} · </span>}<span className="text-ink-2">{m!.text}</span></span>) : undefined}
    />
  )
}

/** text you click and type right in the row; Enter saves, Esc cancels */
export function EditText({ value, placeholder, onSave, strong, display, disabled, icon, inline, grow, faintEmpty }: { value: string; placeholder: string; onSave: (v: string) => void; strong?: boolean; display?: React.ReactNode; disabled?: boolean; icon?: React.ReactNode; muted?: boolean; clamp?: 1 | 2; inline?: boolean; grow?: boolean; faintEmpty?: boolean }) {
  const [editing, setEditing] = React.useState(false)
  const [v, setV] = React.useState(value)
  const done = () => {
    setEditing(false)
    if (v.trim() !== value.trim()) onSave(v.trim())
  }
  if (!editing)
    return (
      <button
        disabled={disabled}
        onClick={(e) => { e.stopPropagation(); setV(value); setEditing(true) }}
        title={disabled ? undefined : value ? `${value}\n\nClick to edit` : 'Click to add'}
        className={cn(
          'flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-[0.1875rem] text-left text-[0.8125rem] leading-[1.125rem] transition enabled:hover:bg-wash-2 disabled:cursor-default [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0',
          inline ? (grow ? 'min-w-[5rem] flex-1 text-muted' : 'max-w-[62%] shrink-0') : '-ml-1.5 w-[calc(100%+0.375rem)]',
          strong && value ? 'text-[0.84375rem] font-semibold text-ink-2' : 'text-muted', !value && 'text-faint', (grow || faintEmpty) && !value && 'opacity-0 group-hover/row:opacity-100 focus:opacity-100',
        )}
      >
        {icon && <span className="inline-flex text-faint">{icon}</span>}
        {display ?? <span className={cn(strong ? 'line-clamp-2' : 'truncate')}>{value || placeholder}</span>}
      </button>
    )
  return (
    <textarea
      autoFocus
      rows={1}
      value={v}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setV(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() }
        if (e.key === 'Escape') { setV(value); setEditing(false) }
      }}
      className="mt-0.5 block w-full resize-none rounded-md border border-brand-300 bg-white px-1.5 py-0.5 text-[0.78125rem] leading-[1.125rem] text-ink outline-none ring-[0.1875rem] ring-brand-50"
    />
  )
}

/* ---------------- phones ---------------- */
function PlanCard({ r }: { r: Row }) {
  const s = useStore()
  const { j, p } = r
  const cells = planCells(s, j)
  const set = (patch: Partial<Prep>) => setPlan(j.id, patch)
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <StartTile r={r} />
        <button onClick={() => s.open({ t: r.pending ? 'estimate' : 'job', id: r.pending || j.id })} className="min-w-0 flex-1 text-left">
          <div className="truncate text-[0.9375rem] font-medium text-ink">{j.name}</div>
          <div className="truncate text-[0.78125rem] text-muted">{r.pending ? `Estimate ${r.pending} · waiting on approval` : `${STAGE_LABEL[j.stage]} · ${p.target || 'TBD'}`}</div>
        </button>
      </div>
      {!r.pending && (
        <>
          <div className="mt-3"><InstallerPick job={j} locked={r.group === 'progress'} /></div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CELLS.map((c) => {
              const cell = cells[c.key]
              return <StepPill key={c.key} state={cell.state as any} onClick={cell.run}>{c.short}: {cell.label}</StepPill>
            })}
          </div>
          <div className="mt-3 border-t border-line-2 pt-2">
            <MeetingLine m={p.meeting} onSave={(v) => set({ meeting: parseMeeting(v) })} />
            <EditText value={p.nextStep || ''} placeholder="Add the next step" onSave={(v) => set({ nextStep: v })} icon={<CornerDownRight />} strong />
            <EditText value={p.notes || ''} placeholder="Add a note" onSave={(v) => set({ notes: v })} icon={<StickyNote />} />
          </div>
        </>
      )}
      <div className="mt-3 flex justify-end"><RowAction r={r} cells={cells} /></div>
    </div>
  )
}
