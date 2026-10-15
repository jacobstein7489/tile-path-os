/* The project at a glance, the way the estimate reads: a bar on top with where it's at (the getting-ready parts, then
 * the install, the touch-ups, closing it out), what's open right now with the one button for each, the few facts that
 * matter, and what we're tiling. Plus the project's estimate, and changing the project's own details. */
import * as React from 'react'
import { ChevronRight, ListChecks, FileText, Pencil, Check, Building2, Plus } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { SearchSelect } from '@/tileos/components/ui/select'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { tilesOf, tileOf, floorsOf, roomPct, CUSTOMERS } from '@/tileos/data/jobs'
import { curRev, revTotal, type Estimate } from '@/tileos/data/estimates'
import { timeLabel } from '@/tileos/data/calendar'
import { TODAY, labelFromIso, md } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, takesTile, type StepView } from '../steps'
import { StepIcon, AddStep } from '../steps-ui'
import { openStep, todoOf } from '../stepwin'
import { installerOf } from '../upcoming'
import { materialStatus } from '../takeoff'
import { poRatio } from '../poratio'
import { CAT, catOf } from '../estimates'
import { billingOf } from './money-tab'
import { tileStatus } from './scope-tab'

const PRICING = ['request', 'estimating', 'proposal', 'followup']
type PathStep = { key: string; label: string; state: 'done' | 'current' | 'future' | 'blocked'; sub?: string; date?: string; onClick?: () => void }
const PARTS: { key: string; label: string }[] = [
  { key: 'paper', label: 'Paperwork' },
  { key: 'meet', label: 'Design meeting' },
  { key: 'site', label: 'Site' },
  { key: 'installer', label: 'Installer' },
  { key: 'deliver', label: 'Deliveries' },
]

/** the bar on top: each part of getting ready (who has it now, how many steps are done), then the install, the
 *  touch-ups and closing it out */
export function projectPath(s: Store, job: Job): PathStep[] {
  const me = meOf(s.role)
  const ready = isGettingReady(job)
  const past = !ready && !PRICING.includes(job.stage)
  const steps = ready ? stepsFor(s, job) : []
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const who = (p?: PersonKey) => (p ? (p === me ? 'You' : PEOPLE[p]?.short) : undefined)
  const parts: PathStep[] = PARTS.map((ph) => {
    if (!ready) return { key: ph.key, label: ph.label, state: past ? 'done' : 'future' }
    const items = steps.filter((v) => v.phase === ph.key && v.state !== 'na')
    const bad = items.find((v) => v.state === 'bad')
    const open = bad || items.find((v) => v.state === 'now') || items.find((v) => v.state === 'wait')
    const done = items.filter((v) => v.state === 'done').length
    const all = items.length > 0 && done === items.length
    const first = open || items.find((v) => v.state === 'later') || items[0]
    return {
      key: ph.key,
      label: ph.label,
      state: all || !items.length ? 'done' : bad ? 'blocked' : open ? 'current' : 'future',
      sub: all ? undefined : who(first?.owner),
      date: all ? 'Done' : `${done} of ${items.length} done`,
      onClick: first ? () => openStep(job.id, first.key) : undefined,
    }
  })
  const st = job.stage
  const b = s.bookings.find((x) => x.jobId === job.id)
  const start = job.dates?.start || (b ? md(b.start) : s.prep[job.id]?.targetISO ? labelFromIso(s.prep[job.id]!.targetISO!) : undefined)
  const punchOpen = s.punch.filter((p) => p.jobId === job.id && p.status !== 'verified').length
  return [
    ...parts,
    { key: 'install', label: 'Installing', state: st === 'installation' ? 'current' : ['punch', 'closeout', 'complete'].includes(st) ? 'done' : 'future', sub: who(crew), date: st === 'installation' ? `${job.pct ?? 0}% done` : start ? `Starts ${start}` : undefined },
    { key: 'punch', label: 'Touch-ups', state: st === 'punch' ? 'current' : ['closeout', 'complete'].includes(st) ? 'done' : 'future', date: st === 'punch' ? `${punchOpen} open` : undefined },
    { key: 'close', label: 'Billed and closed', state: st === 'complete' ? 'done' : st === 'closeout' ? 'current' : 'future' },
  ]
}

/** the one thing to press: my next step on this project — or, if it's someone else's turn, whose and what */
export function nextOn(s: Store, job: Job): { v: StepView; mine: boolean } | null {
  if (!isGettingReady(job)) return null
  const me = meOf(s.role)
  const open = stepsFor(s, job).filter((v) => v.state === 'now' || v.state === 'bad')
  const rank = (v: StepView) => (v.owner === me ? 0 : 2) + (v.state === 'bad' ? 0 : 1)
  const v = [...open].sort((a, b) => rank(a) - rank(b))[0]
  return v ? { v, mine: v.owner === me } : null
}

/* ================= what's open right now ================= */
export function OpenNow({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const steps = stepsFor(s, job)
  const c = stepCounts(steps)
  const rank = (v: StepView) => (v.state === 'bad' ? 0 : v.state === 'now' && v.owner === me ? 1 : v.state === 'now' ? 2 : 3)
  const open = steps.filter((v) => v.state === 'bad' || v.state === 'now' || v.state === 'wait').sort((a, b) => rank(a) - rank(b))
  const stepTasks = new Set(steps.map((v) => v.taskId).filter(Boolean))
  const tasks = s.tasks.filter((t) => t.jobId === job.id && (t.state === 'now' || t.state === 'waiting') && !stepTasks.has(t.id) && !t.step)
  const meets = s.events.filter((e) => e.jobId === job.id && e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).slice(0, 3)
  const firstKey = steps.find((v) => v.state !== 'done' && v.state !== 'na')?.key || steps[0]?.key
  const [adding, setAdding] = React.useState(false)
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3 max-sm:px-4">
        <h3 className="text-[0.9375rem] font-semibold text-ink">What’s open now <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{open.length + tasks.length}</span></h3>
        {firstKey && <Button size="sm" variant="ghost" className="ml-auto" icon={<ListChecks />} onClick={() => openStep(job.id, firstKey)}>All {c.total} steps</Button>}
      </header>
      {open.map((v) => <OpenRow key={v.key} job={job} v={v} me={me} />)}
      {tasks.map((t) => (
        <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="group flex w-full items-center gap-3 border-t border-line-2 px-5 py-3 text-left first:border-t-0 hover:bg-[#f8f9fb] max-sm:px-4">
          <span className="inline-flex w-[1.625rem] shrink-0 justify-center"><span className={cn('h-2.5 w-2.5 rounded-full', t.state === 'waiting' ? 'bg-warn-500' : 'bg-brand-400')} /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-semibold text-ink">{t.title}</span><span className={cn('block truncate text-[0.78125rem]', t.state === 'waiting' ? 'text-warn-700' : 'text-muted')}>{t.state === 'waiting' ? `Waiting on ${t.waitingOn}${t.followUp ? ` · back ${t.followUp}` : ''}` : t.due ? `Due ${t.due}` : 'A task'}</span></span>
          <Person who={t.owner} me={me} />
          <ChevronRight className="h-4 w-4 shrink-0 text-faint group-hover:text-brand-600" />
        </button>
      ))}
      {meets.map((e) => (
        <button key={e.id} onClick={() => s.open({ t: 'event', id: e.id })} className="group flex w-full items-center gap-3 border-t border-line-2 px-5 py-3 text-left first:border-t-0 hover:bg-[#f8f9fb] max-sm:px-4">
          <span className="inline-flex w-[1.625rem] shrink-0 justify-center"><span className="h-2.5 w-2.5 rounded-full bg-vio-500" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-semibold text-ink">{e.title}</span><span className="block truncate text-[0.78125rem] text-muted">{labelFromIso(e.date)} · {timeLabel(e.start)}{e.with ? ` · with ${e.with}` : ''}</span></span>
          <Person who={e.people[0]} me={me} />
          <ChevronRight className="h-4 w-4 shrink-0 text-faint group-hover:text-brand-600" />
        </button>
      ))}
      {!open.length && !tasks.length && !meets.length && <div className="px-5 py-5 text-[0.875rem] text-muted max-sm:px-4">{c.done === c.total ? 'Every step is done — it’s ready to start.' : 'Nothing open right now — the next steps open as these finish.'}</div>}
      {adding ? <AddStep job={job} steps={steps} onDone={() => setAdding(false)} compact /> : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 border-t border-line-2 px-5 py-2.5 text-left text-[0.8125rem] font-semibold text-muted transition hover:bg-wash hover:text-ink max-sm:px-4"><Plus className="h-4 w-4" />Add a step for this project</button>
      )}
    </section>
  )
}
function Person({ who, me }: { who?: PersonKey; me: PersonKey }) {
  if (!who) return null
  return (
    <span className="flex w-[8.5rem] shrink-0 items-center gap-2 max-sm:w-auto">
      <Avatar who={who} size={24} />
      <span className={cn('truncate text-[0.84375rem] max-sm:hidden', who === me ? 'font-semibold text-brand-700' : 'text-ink-2')}>{who === me ? 'You' : PEOPLE[who]?.short}</span>
    </span>
  )
}
function OpenRow({ job, v, me }: { job: Job; v: StepView; me: PersonKey }) {
  const late = !!v.due && v.due < TODAY && v.state !== 'wait'
  const mine = v.owner === me && (v.state === 'now' || v.state === 'bad')
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-5 py-3 first:border-t-0 max-sm:flex-wrap max-sm:px-4">
      <StepIcon state={v.state} size={26} />
      <button onClick={() => openStep(job.id, v.key)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[0.90625rem] font-semibold text-ink max-sm:whitespace-normal">{todoOf(v)}</span>
        {v.note && <span className={cn('block truncate text-[0.78125rem] max-sm:whitespace-normal', v.state === 'bad' ? 'font-medium text-bad-600' : v.state === 'wait' ? 'text-warn-700' : 'text-muted')}>{v.note}</span>}
      </button>
      <Person who={v.owner} me={me} />
      <span className={cn('w-[5.5rem] shrink-0 text-right text-[0.8125rem] tnum max-sm:hidden', late ? 'font-semibold text-bad-600' : 'text-muted')}>{v.state === 'wait' ? (v.due ? `Back ${labelFromIso(v.due)}` : 'Waiting') : v.due ? `Due ${labelFromIso(v.due)}` : ''}</span>
      <Button size="sm" variant={mine ? 'primary' : 'secondary'} className="shrink-0" onClick={() => openStep(job.id, v.key)}>{v.state === 'wait' ? 'Open' : v.action?.label || 'Open'}</Button>
    </div>
  )
}

/* ================= the few facts that matter ================= */
export function AtAGlance({ job, setTab }: { job: Job; setTab: (t: any) => void }) {
  const s = useStore()
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id && p.status !== 'Rejected')
  const b = s.bookings.find((x) => x.jobId === job.id)
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish}` : b ? `${md(b.start)} – ${md(b.end)}` : s.prep[job.id]?.targetISO ? `Starts ${labelFromIso(s.prep[job.id]!.targetISO!)}` : 'No dates yet'
  const tiles = tilesOf(job.id)
  const sts = tiles.map((t) => tileStatus(s, job.id, t.tag))
  const worst = sts.find((x) => x.tone === 'bad') || sts.find((x) => x.tone === 'warn')
  const ms = materialStatus(s, job.id)
  const m = billingOf(job)
  const r = ipo ? poRatio(s, ipo) : undefined
  const rows: { label: string; value: React.ReactNode; sub?: string; tone: Tone; tab: string }[] = [
    { label: 'Installer', value: crew ? PEOPLE[crew]?.name : 'Not picked yet', sub: [dates, ipo ? (ipo.status === 'Accepted' ? 'took his PO' : ipo.status === 'Sent' ? 'PO sent — waiting for his yes' : 'PO not sent yet') : ''].filter(Boolean).join(' · '), tone: !crew ? 'warn' : ipo?.status === 'Accepted' ? 'ok' : 'info', tab: 'installer' },
    { label: 'His PO', value: r && r.sold ? `${r.pct}% of the estimate` : ipo ? fmtMoney(r?.total || 0) : '—', sub: r && r.sold ? `${fmtMoney(r.total)} of ${fmtMoney(r.sold)} · keep it under ${r.line}%` : 'No PO yet', tone: !r || !r.sold ? 'neutral' : r.over ? 'bad' : 'ok', tab: 'orders' },
    { label: 'Tile', value: tiles.length ? `${tiles.length} tile${tiles.length === 1 ? '' : 's'}` : 'No tiles yet', sub: worst ? worst.label : tiles.length ? 'All on site or on the way' : 'From the tile paperwork', tone: worst ? worst.tone : tiles.length ? 'ok' : 'warn', tab: 'scope' },
    { label: 'Our materials', value: ms.state === 'yes' ? 'On site' : ms.state === 'wait' ? 'Ordered' : ms.label, sub: ms.hint, tone: ms.state === 'yes' ? 'ok' : ms.state === 'wait' ? 'info' : ms.go === 'order' ? 'warn' : 'neutral', tab: 'orders' },
    ...(s.role !== 'site' ? [{ label: 'Billing', value: m.contract ? fmtMoney(m.contract + m.changes) : 'No contract yet', sub: `${m.billedPct}% billed · ${m.paidPct}% paid`, tone: (m.toBill > 0 ? 'warn' : 'ok') as Tone, tab: 'money' }] : []),
  ]
  const dot: Record<Tone, string> = { ok: 'bg-ok-500', warn: 'bg-warn-500', bad: 'bg-bad-500', info: 'bg-brand-500', vio: 'bg-vio-500', neutral: 'bg-[#c6ccd4]' }
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="border-b border-line px-4 py-3"><h3 className="text-[0.90625rem] font-semibold text-ink">At a glance</h3></header>
      {rows.map((x) => (
        <button key={x.label} onClick={() => setTab(x.tab)} className="group flex w-full items-start gap-3 border-t border-line-2 px-4 py-2.5 text-left first:border-t-0 hover:bg-[#f8f9fb]">
          <span className={cn('mt-[0.4375rem] h-2 w-2 shrink-0 rounded-full', dot[x.tone])} />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2"><span className="text-[0.78125rem] font-semibold text-muted">{x.label}</span><span className="truncate text-[0.875rem] font-semibold text-ink">{x.value}</span></span>
            {x.sub && <span className="block truncate text-right text-[0.75rem] text-muted">{x.sub}</span>}
          </span>
        </button>
      ))}
    </section>
  )
}

/* ================= what we're tiling, room by room ================= */
export function TilingCard({ job, setTab }: { job: Job; setTab: (t: any) => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = ['installation', 'punch', 'closeout', 'complete'].includes(job.stage)
  const sf = rooms.reduce((n, r) => n + r.surfaces.reduce((m, x) => m + (takesTile(x.name) ? x.sf || 0 : 0), 0), 0)
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-[0.90625rem] font-semibold text-ink">What we’re tiling</h3>
        <span className="text-[0.78125rem] font-semibold tnum text-muted">{inField ? `${job.pct ?? 0}% installed` : `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}`}</span>
      </header>
      {floorsOf(rooms).map((g) => (
        <div key={g.floor}>
          {(floorsOf(rooms).length > 1 || g.floor !== 'Rooms') && <div className="border-t border-line-2 bg-[#f8f9fb] px-4 py-1 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-muted first:border-t-0">{g.floor}</div>}
          {g.rooms.map((r) => {
            const tags = Array.from(new Set(r.surfaces.map((x) => x.tile).filter(Boolean))) as string[]
            const rsf = r.surfaces.reduce((n, x) => n + (takesTile(x.name) ? x.sf || 0 : 0), 0)
            const pct = r.pct ?? roomPct(r)
            return (
              <button key={r.name} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name })} className="flex w-full items-center gap-2.5 border-t border-line-2 px-4 py-2 text-left first:border-t-0 hover:bg-[#f8f9fb]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.84375rem] font-semibold text-ink">{r.name}</span>
                  <span className="block truncate text-[0.75rem] text-muted">{r.surfaces.filter((x) => takesTile(x.name)).map((x) => x.name.toLowerCase()).join(', ') || 'No walls or floors yet'}</span>
                </span>
                <span className="flex shrink-0 -space-x-1.5">{tags.slice(0, 3).map((t) => { const tt = tileOf(job.id, t); return tt ? <TileImg key={t} tile={tt} size={20} radius={10} className="ring-2 ring-white" /> : null })}</span>
                <span className="w-[3.75rem] shrink-0 text-right text-[0.78125rem] font-semibold tnum text-ink-2">{inField ? `${pct}%` : rsf ? `${rsf} SF` : '—'}</span>
              </button>
            )
          })}
        </div>
      ))}
      {!rooms.length && <div className="px-4 py-3 text-[0.8125rem] text-muted">No rooms yet — they come from the estimate.</div>}
      <button onClick={() => setTab('scope')} className="flex w-full items-center justify-between border-t border-line-2 px-4 py-2.5 text-[0.8125rem] font-semibold text-brand-600 hover:bg-wash">Every wall and floor<ChevronRight className="h-4 w-4" /></button>
    </section>
  )
}

/* ================= the project's estimate ================= */
export function EstimateTab({ job }: { job: Job }) {
  const s = useStore()
  const ests = s.estimates.filter((e) => e.jobId === job.id)
  const cos = s.money.filter((m) => m.jobId === job.id && m.kind === 'change')
  if (!ests.length)
    return (
      <div className="flex flex-col items-center py-14 text-center">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><FileText className="h-5 w-5" /></span>
        <div className="text-[1rem] font-semibold text-ink">No estimate in the system for this project</div>
        <div className="mt-1 max-w-sm text-[0.875rem] text-muted">It was priced before Tile OS. The contract is on Billing.</div>
      </div>
    )
  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
        <header className="border-b border-line px-5 py-3"><h3 className="text-[0.9375rem] font-semibold text-ink">The estimate</h3></header>
        {ests.map((e) => <EstRow key={e.id} e={e} />)}
      </section>
      <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
        <header className="flex items-center gap-3 border-b border-line px-5 py-3">
          <h3 className="text-[0.9375rem] font-semibold text-ink">Change orders <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{cos.length}</span></h3>
          <Button size="sm" className="ml-auto" icon={<Plus />} onClick={() => s.open({ t: 'sitechange', jobId: job.id })}>Client wants a change</Button>
        </header>
        {cos.map((m) => (
          <button key={m.id} onClick={() => s.open({ t: 'money', id: m.id })} className="flex w-full items-center gap-3 border-t border-line-2 px-5 py-3 text-left first:border-t-0 hover:bg-[#f8f9fb]">
            <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-semibold text-ink">{m.title}</span><span className="block truncate text-[0.78125rem] text-muted">{m.ref ? `${m.ref} · ` : ''}{m.due || ''}</span></span>
            <span className="shrink-0 text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(m.amount || 0)}</span>
            <Status tone={m.state === 'paid' ? 'ok' : m.state === 'waiting' ? 'warn' : 'neutral'}>{m.state === 'paid' ? 'Paid' : m.state === 'waiting' ? 'Billed' : 'Approved'}</Status>
          </button>
        ))}
        {!cos.length && <div className="px-5 py-4 text-[0.84375rem] text-muted">No changes from the estimate.</div>}
      </section>
    </div>
  )
}
function EstRow({ e }: { e: Estimate }) {
  const s = useStore()
  const r = curRev(e)
  const c = CAT[catOf(e)]
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-5 py-3 first:border-t-0 max-sm:flex-wrap">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wash-2 text-ink-2"><FileText className="h-[1.125rem] w-[1.125rem]" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.90625rem] font-semibold text-ink">{e.id}{e.revs.length > 1 ? ` · Revision ${r?.n}` : ''}</span>
        <span className="block truncate text-[0.78125rem] text-muted">{r?.lines.length || 0} lines{e.approvedOn ? ` · approved ${e.approvedOn}` : ''}</span>
      </span>
      <Status tone={c.tone}>{c.label}</Status>
      <span className="w-[6.5rem] shrink-0 text-right text-[1rem] font-semibold tnum text-ink">{fmtMoney(revTotal(r))}</span>
      <span className="flex shrink-0 gap-1.5">
        <Button size="sm" onClick={() => s.open({ t: 'sow', jobId: e.jobId, estId: e.id })}>Scope of work</Button>
        <Button size="sm" variant="primary" onClick={() => s.open({ t: 'estimate', id: e.id })}>Open</Button>
      </span>
    </div>
  )
}

/* ================= the project's own details ================= */
export function EditProjectModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const j = s.jobs[id]
  const [name, setName] = React.useState(j?.name || '')
  const [address, setAddress] = React.useState(j?.address || '')
  const [clientId, setClientId] = React.useState(j?.clientId || '')
  const [po, setPo] = React.useState(j?.clientPO || '')
  const [contract, setContract] = React.useState(j?.contract ? String(j.contract) : '')
  if (!j) return null
  const clients = Object.values(s.clients)
  const ok = !!name.trim() && !!clientId
  const save = () => {
    const c = s.clients[clientId] || CUSTOMERS[clientId]
    s.commit((st) => {
      const x = st.jobs[id]
      if (!x) return
      const was = x.name
      x.name = name.trim()
      x.address = address.trim()
      x.clientId = clientId
      x.client = c?.name || x.client
      x.clientPO = po.trim() || undefined
      const n = Math.round(Number(contract.replace(/[^\d.]/g, '')))
      if (n > 0) x.contract = n
      ;(st.hist[id] ||= []).unshift({ date: TODAY_LABEL(), who: meOf(st.role), kind: 'setup', title: 'Project details changed', detail: was !== x.name ? `Was “${was}”` : undefined } as any)
    }, 'Saved', { close: true })
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Project details"
      sub={j.name}
      footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" icon={<Check />} disabled={!ok} onClick={save}>Save</Button></>}
    >
      <div className="flex flex-col gap-4">
        <Field label="Project name"><TextInput data-autofocus value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Address"><TextInput value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" /></Field>
        <Field label="Client">
          <SearchSelect label="Client" value={clientId} onChange={setClientId} options={clients.map((c) => ({ key: c.id, label: c.name, hint: c.kind }))} placeholder="Pick the client" icon={<Building2 />} width={380} search />
        </Field>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Their PO or contract number"><TextInput value={po} onChange={(e) => setPo(e.target.value)} placeholder="Optional" /></Field>
          <Field label="Contract amount"><TextInput inputMode="decimal" value={contract} onChange={(e) => setContract(e.target.value)} placeholder="From the estimate" /></Field>
        </div>
      </div>
    </Modal>
  )
}
const TODAY_LABEL = () => md(TODAY)
export const EditButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={onClick} aria-label={label} title={label} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash hover:text-ink"><Pencil className="h-4 w-4" /></button>
)
