/* The project window — opens nearly full screen. One clean header, five tabs, nothing else.
 *   header: the project and where it stands (one colored status), the client, the address, the installer; Log and
 *           the one main button. Files, messages and history are small icons next to the tabs.
 *   tabs:   Overview  — four facts at a glance (installer · tile · our materials · billing), then what's open:
 *                       while it's getting ready, the checklist (every step, who has it, done or not) and whatever
 *                       else is open on the side; once the crew is on it, what's open and how far each room is
 *           Scope     — the tiles (a card each: picture, grout, where it goes, is it here) and every wall and floor:
 *                       tile · grout · layout · what goes under it · edge or metal · SF — by room or by tile
 *           Orders    — the tile from the store, our materials worked out from the scope, every PO
 *           Installer — who installs it, his PO, his days, the daily updates, the touch-ups
 *           Billing */
import * as React from 'react'
import {
  Building2, MapPin, CalendarDays, Maximize2, ListPlus, Lock, Check, X, Clock3, Contrast, Plus, ChevronDown, ChevronRight,
  Printer, HardHat, Send, Play, ClipboardList, Receipt, Paperclip, History, MessageCircle, Package, Grid2x2, Wallet, TriangleAlert } from 'lucide-react'
import { useStore, historyOf, type Store } from '@/tileos/store'
import type { Task } from '@/tileos/data/work'
import type { CalEvent } from '@/tileos/data/calendar'
import { Button, Avatar, IconButton, UnderlineTabs } from '@/tileos/components/ui/core'
import { Modal, Tip } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { EstimatePaper } from '../estpaper'
import { printNode } from '@/tileos/lib/print'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { roomPct, filesFor, tilesOf, tileOf, floorsOf } from '@/tileos/data/jobs'
import { needWithWaste } from '@/tileos/data/work'
import { sendToSite, verificationDone, startProject } from '../flows'
import { materialStatus } from '../takeoff'
import { CAL_TODAY, dayLabel, timeLabel } from '@/tileos/data/calendar'
import { planCells, CELLS, installerOf } from '../upcoming'
import { surfaceFix } from './overview'
import { MoneyTab, billingOf } from './money-tab'
import { FilesTab, HistoryTab } from './files'
import { POsTab } from './pos-tab'
import { PricingWorkspace } from '../pricing'
import { RoomsTab } from './rooms'
import { ScopeTab, tileStatus } from './scope-tab'
import { InstallerTab } from './crew-tab'
import { settingStatus } from '../setting'
import { heightStatus } from '../heights'
import { unreadOf } from '../messages'
import { projectStatus } from '../statuses'
import { isGettingReady, stepsFor, stepCounts, type StepView } from '../steps'
import { StepsList, StepIcon, StepButton, StepPath } from '../steps-ui'
import { useSaveStatus } from '@/tileos/lib/save'
import { md } from '@/tileos/lib/today'
import { NOW } from '@/tileos/lib/today'

export { floorsOf }
export type PTab = 'overview' | 'scope' | 'orders' | 'installer' | 'money'

/** old links into the window (tab names from earlier versions) land on the right tab */
const tabFrom = (initial: string | undefined): PTab =>
  (['overview', 'scope', 'orders', 'installer', 'money'] as PTab[]).includes(initial as PTab)
    ? (initial as PTab)
    : initial === 'rooms' || initial === 'setup' ? 'scope'
      : initial === 'materials' || initial === 'pos' ? 'orders'
        : initial === 'touchups' || initial === 'punch' || initial === 'crew' ? 'installer'
          : initial === 'billing' ? 'money' : 'overview'

/* ================= the window ================= */
export function ProjectWindow({ id, tab: initial, level }: { id: string; tab?: string; level: number }) {
  const job = useStore((s) => s.jobs[id])
  const role = useStore((s) => s.role)
  const close = useStore((s) => s.close)
  const pricing = job && ['request', 'estimating', 'proposal', 'followup'].includes(job.stage)
  const [tab, setTab] = React.useState<PTab>(initial ? tabFrom(initial) : role === 'accounting' ? 'money' : 'overview')
  if (!job) return null
  return (
    <Modal level={level} size="full" tall onClose={close} title={job.name} header={<ProjectHeader job={job} mode="modal" tab={pricing ? undefined : tab} setTab={setTab} />} bodyClass="p-0">
      {pricing ? <div className="p-6"><PricingWorkspace job={job} /></div> : <ProjectBody job={job} tab={tab} setTab={setTab} />}
    </Modal>
  )
}

/** the same project as a page (Open full page) */
export function ProjectPage({ job, tab: initial }: { job: Job; tab?: string }) {
  const [tab, setTab] = React.useState<PTab>(tabFrom(initial))
  return (
    <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white shadow-card">
      <ProjectHeader job={job} mode="page" tab={tab} setTab={setTab} />
      <div className="min-h-[35rem]"><ProjectBody job={job} tab={tab} setTab={setTab} /></div>
    </div>
  )
}

/* ---------------- header ---------------- */
const PRIMARY: Partial<Record<string, { label: string; icon: React.ReactNode }>> = {
  setup: { label: 'Ready to start', icon: <Check /> },
  verification: { label: 'Ready to start', icon: <Check /> },
  ready: { label: 'Start the job', icon: <Play /> },
  scheduled: { label: 'Start the job', icon: <Play /> },
  installation: { label: 'Daily update', icon: <ClipboardList /> },
  punch: { label: 'Book the return visit', icon: <CalendarDays /> },
  closeout: { label: 'Final invoice', icon: <Receipt /> },
}

function tabsFor(s: Store, job: Job): { key: PTab; label: string; count?: number; tone?: Tone }[] {
  const open = todoCount(s, job)
  const pos = s.pos.filter((p) => p.jobId === job.id).length + s.ipos.filter((p) => p.jobId === job.id).length
  const bills = s.money.filter((m) => m.jobId === job.id && m.state !== 'paid' && m.kind !== 'custpo').length
  const punchOpen = s.punch.filter((p) => p.jobId === job.id && p.status !== 'verified').length
  const noTile = (s.rooms[job.id] || []).flatMap((r) => r.surfaces).filter((x) => !x.tile).length
  return [
    { key: 'overview', label: 'Overview', count: open.n || undefined, tone: open.bad ? 'bad' : undefined },
    { key: 'scope', label: 'Scope', count: noTile || undefined },
    { key: 'orders', label: 'Orders', count: pos || undefined },
    { key: 'installer', label: 'Installer', count: punchOpen || undefined },
    ...(s.role !== 'site' ? [{ key: 'money' as PTab, label: 'Billing', count: bills || undefined }] : []),
  ]
}

/** where the project stands, in one colored bubble — the same words as the Projects list */
function headStatus(s: Store, job: Job): { tone: Tone; label: string; onClick?: () => void } {
  const st = projectStatus(s, job)
  if (st.key === 'hold') return { tone: 'bad', label: `On hold · ${(job.hold?.reason || '').replace(/^Waiting for /, 'waiting for ')}`, onClick: job.hold?.shortage ? () => s.open({ t: 'short', id: job.hold!.shortage! }) : undefined }
  if (isGettingReady(job)) {
    const c = stepCounts(stepsFor(s, job))
    return { tone: st.tone, label: `${st.label} · ${c.done} of ${c.total} steps done` }
  }
  if (st.key === 'progress') return { tone: st.tone, label: `In progress · ${job.pct ?? 0}%` }
  if (st.key === 'touchups') {
    const n = s.punch.filter((p) => p.jobId === job.id && p.status !== 'verified').length
    return { tone: st.tone, label: n ? `Touch-ups · ${n} open` : 'Touch-ups' }
  }
  return { tone: st.tone, label: st.label }
}

export function ProjectHeader({ job, mode, tab, setTab }: { job: Job; mode: 'modal' | 'page'; tab?: PTab; setTab: (t: PTab) => void }) {
  const s = useStore()
  const role = s.role
  const status = headStatus(s, job)
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const prim = PRIMARY[job.stage]
  const blockers = nowItems(s, job, setTab).items.filter((i) => i.status === 'bad').length
  /* getting ready is done when the checklist is (the deposit is a warning, not a stop) */
  const left = job.stage === 'setup' || job.stage === 'verification' ? stepsFor(s, job).filter((v) => v.state !== 'done' && v.state !== 'na' && v.key !== 'deposit') : []
  const locked = left.length > 0
  const files = filesFor(job.id).length
  const unread = unreadOf(s, job.id)
  const runPrimary = () => {
    if (job.stage === 'setup' || job.stage === 'verification') return verificationDone(job.id)
    if (job.stage === 'ready' || job.stage === 'scheduled') return startProject(job.id)
    if (job.stage === 'installation') return s.open({ t: 'daily', jobId: job.id })
    if (job.stage === 'punch') return s.open({ t: 'assign', jobId: job.id })
    if (job.stage === 'closeout') return s.open({ t: 'money', id: s.money.find((m) => m.jobId === job.id && m.kind === 'final')?.id || '' })
  }
  const pricing = !tab
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish}` : (() => { const b = s.bookings.find((x) => x.jobId === job.id); return b ? `${md(b.start)} – ${md(b.end)}` : '' })()
  return (
    <div className="border-b border-line bg-white">
      <div className={cn('px-7 pt-5 max-sm:px-4', mode === 'modal' && 'pr-16 max-sm:pr-14', pricing && 'pb-4')}>
        <div className="flex items-start gap-4 max-lg:flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="font-display min-w-0 truncate text-[1.5rem] font-semibold leading-tight tracking-[-0.012em] text-ink max-sm:text-[1.3125rem]">{job.name}</h1>
              {!pricing && (status.onClick
                ? <button onClick={status.onClick} className="min-w-0 max-w-full"><Status tone={status.tone}>{status.label}</Status></button>
                : <Status tone={status.tone} className="shrink-0">{status.label}</Status>)}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.84375rem] text-muted">
              <button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:text-brand-600"><Building2 className="h-4 w-4 text-faint" />{job.client}</button>
              <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-faint" /><span className="truncate">{job.address}</span></span>
              {!pricing && (crew
                ? <button onClick={() => setTab('installer')} className="inline-flex items-center gap-1.5 hover:text-brand-600"><Avatar who={crew} size={18} /><span className="font-medium text-ink-2">{PEOPLE[crew].short}</span>{dates && <span>· {dates}</span>}</button>
                : !['closeout', 'complete'].includes(job.stage) && <button onClick={() => s.open({ t: 'book', jobId: job.id })} className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline"><HardHat className="h-4 w-4" />Book an installer</button>)}
            </div>
          </div>
          {!pricing && role !== 'accounting' && (
            <div className="flex shrink-0 items-center gap-2 max-lg:w-full">
              <span className="max-lg:flex-1 max-sm:hidden" />
              <Button icon={<ListPlus />} aria-label="Log what happened" onClick={() => s.open({ t: 'record', jobId: job.id })}><span className="max-sm:hidden">Log</span></Button>
              {prim && (
                <Tip label={locked ? `${left.length} step${left.length > 1 ? 's' : ''} left: ${left.slice(0, 3).map((v) => v.short.toLowerCase()).join(', ')}${left.length > 3 ? '…' : ''}` : prim.label}>
                  <span className="max-sm:flex max-sm:min-w-0 max-sm:flex-1"><Button variant="primary" className="max-sm:w-full max-sm:min-w-0" icon={locked ? <Lock /> : prim.icon} disabled={locked} onClick={runPrimary}><span className="truncate">{prim.label}</span></Button></span>
                </Tip>
              )}
            </div>
          )}
        </div>
      </div>
      {tab && (
        <div className="mt-2 flex items-center gap-3 px-7 max-sm:px-4">
          <UnderlineTabs className="min-w-0 flex-1 border-b-0" value={tab} onChange={setTab} items={tabsFor(s, job)} />
          <div className="flex shrink-0 items-center gap-0.5 max-sm:hidden">
            <HeadIcon label={`Files and photos${files ? ` · ${files}` : ''}`} count={files} onClick={() => s.open({ t: 'files', jobId: job.id })}><Paperclip className="h-4 w-4" /></HeadIcon>
            <HeadIcon label="Messages — the team, the crew and the GC" count={unread} hot onClick={() => s.open({ t: 'chat', jobId: job.id })}><MessageCircle className="h-4 w-4" /></HeadIcon>
            <HeadIcon label="Everything that happened" onClick={() => s.open({ t: 'history', jobId: job.id })}><History className="h-4 w-4" /></HeadIcon>
            {mode === 'modal' && <HeadIcon label="Open as a full page" onClick={() => { s.closeAll(); s.go({ page: 'job', id: job.id }) }}><Maximize2 className="h-4 w-4" /></HeadIcon>}
          </div>
        </div>
      )}
      {/* on a phone the small buttons sit under the tabs */}
      {tab && (
        <div className="flex items-center gap-1 border-t border-line-2 px-3 py-1.5 sm:hidden">
          <button onClick={() => s.open({ t: 'files', jobId: job.id })} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.78125rem] font-semibold text-muted"><Paperclip className="h-3.5 w-3.5" />Files{files ? ` ${files}` : ''}</button>
          <button onClick={() => s.open({ t: 'chat', jobId: job.id })} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.78125rem] font-semibold', unread ? 'text-brand-700' : 'text-muted')}><MessageCircle className="h-3.5 w-3.5" />Messages{unread ? ` ${unread}` : ''}</button>
          <button onClick={() => s.open({ t: 'history', jobId: job.id })} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.78125rem] font-semibold text-muted"><History className="h-3.5 w-3.5" />History</button>
        </div>
      )}
    </div>
  )
}
function HeadIcon({ label, count, hot, onClick, children }: { label: string; count?: number; hot?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tip label={label}>
      <span className="relative">
        <IconButton label={label.split(' — ')[0].split(' · ')[0]} size="sm" onClick={onClick}>{children}</IconButton>
        {!!count && <span className={cn('pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-[1rem] min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.625rem] font-bold tnum text-white ring-2 ring-white', hot ? 'bg-brand-600' : 'bg-ink')}>{count}</span>}
      </span>
    </Tip>
  )
}

/* ---------------- the body: just the tab you're on ---------------- */
export function ProjectBody({ job, tab, setTab }: { job: Job; tab: PTab; setTab: (t: PTab) => void }) {
  return (
    <div key={tab} className="animate-fade-up px-7 py-6 max-sm:px-3.5 max-sm:py-4">
      {tab === 'overview' && <OverviewTab job={job} setTab={setTab} />}
      {tab === 'scope' && <ScopeTab job={job} />}
      {tab === 'orders' && <POsTab job={job} onScope={() => setTab('scope')} />}
      {tab === 'installer' && <InstallerTab job={job} />}
      {tab === 'money' && <MoneyTab job={job} />}
    </div>
  )
}

/* ================= Overview ================= */
function OverviewTab({ job, setTab }: { job: Job; setTab: (t: PTab) => void }) {
  const s = useStore()
  const ready = isGettingReady(job)
  /* getting ready: the step bar on top says where it stands; the checklist below says what's next and whose it is */
  if (ready) {
    const extra = todoLines(s, job, setTab, true).lines.filter((l) => l.task || l.it || l.ev).length
    return (
      <div className="flex flex-col gap-5">
        <StepPath job={job} />
        <div className={cn('grid w-full items-start gap-5 max-xl:grid-cols-1', extra ? 'grid-cols-[minmax(0,1fr)_21.25rem]' : 'grid-cols-1')}>
          <div className="min-w-0"><StepsList job={job} /></div>
          {extra > 0 && <div className="flex min-w-0 flex-col gap-4"><AlsoOpen job={job} setTab={setTab} /></div>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <Glance job={job} setTab={setTab} />
      <div className="grid w-full grid-cols-[minmax(0,1fr)_21.25rem] items-start gap-5 max-xl:grid-cols-1">
        <div className="min-w-0"><TodoList job={job} setTab={setTab} /></div>
        <div className="flex min-w-0 flex-col gap-4"><RoomsProgress job={job} setTab={setTab} /></div>
      </div>
    </div>
  )
}

/** four facts anyone can read in a second: who installs it, the tile, our materials, the money */
function Glance({ job, setTab }: { job: Job; setTab: (t: PTab) => void }) {
  const s = useStore()
  const save = useSaveStatus()
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id && p.status !== 'Rejected') || [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const booking = s.bookings.find((b) => b.jobId === job.id)
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish}` : booking ? `${md(booking.start)} – ${md(booking.end)}` : ''
  const ipoWord = !ipo ? '' : ipo.status === 'Accepted' ? 'PO accepted' : ipo.status === 'Sent' ? 'PO sent — waiting for him' : ipo.status === 'Draft' ? 'PO not sent yet' : 'PO turned down'
  /* tile: how many, and the worst news first */
  const tiles = tilesOf(job.id)
  const flat = (s.rooms[job.id] || []).flatMap((r) => r.surfaces)
  const unpicked = flat.filter((x) => !x.tile).length
  const sts = tiles.map((t) => ({ t, st: tileStatus(s, job.id, t.tag) })).filter((x) => x.st.label !== 'Not on a wall or floor yet')
  const worst = sts.find((x) => x.st.tone === 'bad') || sts.find((x) => x.st.tone === 'warn') || sts.find((x) => x.st.tone === 'info')
  const tileTone: Tone = unpicked || !tiles.length ? 'warn' : worst ? worst.st.tone : 'ok'
  const tileSub = !flat.length ? 'Rooms come from the estimate' : unpicked ? `${unpicked} wall${unpicked === 1 ? '' : 's'} or floor${unpicked === 1 ? '' : 's'} still need${unpicked === 1 ? 's' : ''} a tile` : worst ? `${worst.t.tag} · ${worst.st.label.charAt(0).toLowerCase() + worst.st.label.slice(1)}` : 'All on site'
  /* our materials */
  const ms = materialStatus(s, job.id)
  const matMain = ms.state === 'yes' ? 'On site' : ms.state === 'wait' ? 'Ordered' : ms.label === 'No scope' || ms.label === 'Add SF' ? 'Not worked out yet' : ms.label
  const matTone: Tone = ms.state === 'yes' ? 'ok' : ms.state === 'wait' ? 'info' : ms.go === 'order' ? (ms.state === 'part' ? 'warn' : 'bad') : 'neutral'
  /* money */
  const m = moneyFacts(s, job)
  const sample = save.mode === 'sample' ? ' · sample' : ''
  const dep = m.dep
  const depLine = !dep ? '' : dep.state === 'paid' ? 'Deposit paid' : dep.step >= 1 ? `Deposit invoiced ${dep.ref || ''} — not paid`.replace('  ', ' ') : 'Deposit not invoiced yet'
  const facts: Fact[] = [
    { key: 'installer', tab: 'installer', label: 'Installer', icon: <HardHat />, lead: crew ? <Avatar who={crew} size={26} /> : undefined, main: crew ? PEOPLE[crew].name : 'Not booked yet', sub: crew ? [dates, ipoWord].filter(Boolean).join(' · ') || 'No dates yet' : 'Pick who installs it', tone: !crew ? 'warn' : ipo?.status === 'Rejected' ? 'bad' : ipo?.status === 'Accepted' ? 'ok' : 'info' },
    { key: 'tile', tab: 'scope', label: 'Tile', icon: <Grid2x2 />, lead: tiles.length ? <span className="flex -space-x-2">{tiles.slice(0, 4).map((t) => <TileImg key={t.tag} tile={t} size={26} radius={7} className="ring-2 ring-white" />)}</span> : undefined, main: tiles.length ? `${tiles.length} tile${tiles.length === 1 ? '' : 's'}` : 'No tiles yet', sub: tileSub, tone: tileTone },
    { key: 'materials', tab: 'orders', label: 'Our materials', icon: <Package />, main: matMain, sub: ms.hint, tone: matTone },
    ...(s.role !== 'site' ? [{ key: 'money', tab: 'money' as PTab, label: 'Billing', icon: <Wallet />, main: m.contract ? fmtMoney(m.contract) : 'No contract yet', sub: isGettingReady(job) && depLine ? depLine : m.toBill > 0 ? `${fmtMoney(m.toBill)} to bill · ${m.billedPct}% billed${sample}` : `${m.billedPct}% billed · ${m.paidPct}% paid${sample}`, tone: (dep && dep.state !== 'paid' && isGettingReady(job) ? 'warn' : m.toBill > 0 ? 'warn' : 'ok') as Tone }] : []),
  ]
  return (
    <div className={cn('grid gap-3 max-sm:gap-2', facts.length === 4 ? 'grid-cols-4 max-xl:grid-cols-2' : 'grid-cols-3 max-xl:grid-cols-3 max-sm:grid-cols-2')}>
      {facts.map((f) => <FactCard key={f.key} f={f} onClick={() => setTab(f.tab)} />)}
    </div>
  )
}
type Fact = { key: string; tab: PTab; label: string; icon: React.ReactNode; lead?: React.ReactNode; main: string; sub: string; tone: Tone }
const TONE_DOT: Record<Tone, string> = { ok: 'bg-ok-500', warn: 'bg-warn-500', bad: 'bg-bad-500', info: 'bg-brand-500', vio: 'bg-vio-500', neutral: 'bg-[#c6ccd4]' }
function FactCard({ f, onClick }: { f: Fact; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex min-w-0 flex-col rounded-[0.875rem] border border-line bg-white px-4 py-3 text-left transition hover:border-[#cfd4db] hover:shadow-card max-sm:px-3 max-sm:py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-muted max-sm:text-[0.6875rem]">
        <span className="inline-flex text-faint [&_svg]:h-3.5 [&_svg]:w-3.5 max-sm:hidden">{f.icon}</span><span className="truncate">{f.label}</span>
        <span className={cn('ml-auto h-2 w-2 shrink-0 rounded-full', TONE_DOT[f.tone])} />
      </span>
      <span className="mt-2 flex min-w-0 items-center gap-2.5 max-sm:mt-1.5 max-sm:gap-2">
        <span className="shrink-0 max-sm:hidden">{f.lead}</span>
        <span className="min-w-0 truncate text-[1rem] font-semibold text-ink max-sm:text-[0.9375rem]">{f.main}</span>
      </span>
      <span className={cn('mt-0.5 truncate text-[0.78125rem]', f.tone === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{f.sub}</span>
    </button>
  )
}
/** the contract, how much is billed and paid — worked out from the estimate, the daily updates and the bills */
function moneyFacts(s: Store, job: Job) {
  const b = billingOf(job)
  const dep = s.money.find((m) => m.jobId === job.id && m.kind === 'deposit')
  return { contract: b.contract + b.changes, billedPct: b.billedPct, paidPct: b.paidPct, dep, toBill: b.toBill }
}

/** while it's getting ready: everything open that isn't a checklist step — tasks, meetings, tile that came up short */
function AlsoOpen({ job, setTab }: { job: Job; setTab: (t: PTab) => void }) {
  const s = useStore()
  const { lines } = todoLines(s, job, setTab, true)
  const open = lines.filter((l) => l.task || l.it)
  const meets = lines.filter((l) => l.ev)
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="text-[0.90625rem] font-semibold text-ink">Also open<span className="ml-1.5 text-[0.8125rem] font-semibold text-faint">{open.length}</span></h3>
        <span className="truncate text-[0.78125rem] text-muted">Outside the checklist</span>
      </header>
      {open.map((l) => <SideLine key={l.key} l={l} />)}
      {!open.length && <div className="px-4 py-3 text-[0.8125rem] text-muted">Nothing else open.</div>}
      {meets.length > 0 && (
        <>
          <div className="border-t border-line-2 bg-wash px-4 py-1.5 text-[0.71875rem] font-bold uppercase tracking-[0.06em] text-muted">Meetings</div>
          {meets.map((l) => <SideLine key={l.key} l={l} />)}
        </>
      )}
      <div className="flex items-center gap-1 border-t border-line-2 px-2 py-1.5">
        <button onClick={() => s.open({ t: 'newtask', jobId: job.id })} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[0.8125rem] font-semibold text-muted hover:bg-wash hover:text-ink"><Plus className="h-4 w-4" />Task</button>
        <button onClick={() => s.open({ t: 'record', jobId: job.id, type: 'meeting' })} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[0.8125rem] font-semibold text-muted hover:bg-wash hover:text-ink"><CalendarDays className="h-4 w-4" />Meeting</button>
      </div>
    </section>
  )
}
function SideLine({ l }: { l: Line }) {
  const s = useStore()
  if (l.ev) {
    const e = l.ev
    return (
      <button onClick={() => s.open({ t: 'event', id: e.id })} className="flex w-full items-center gap-2.5 border-t border-line-2 px-4 py-2 text-left transition first:border-t-0 hover:bg-[#f7f8fa]">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-vio-50 text-vio-600"><CalendarDays className="h-3.5 w-3.5" /></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[0.84375rem] font-semibold text-ink">{e.title}</span><span className="block truncate text-[0.75rem] text-muted">{dayLabel(e.date)} · {timeLabel(e.start)}</span></span>
        <span className="flex -space-x-1.5">{e.people.slice(0, 2).map((p) => <Avatar key={p} who={p} size={22} ring />)}</span>
      </button>
    )
  }
  if (l.it) {
    const it = l.it
    return (
      <button onClick={it.action?.run} className="flex w-full items-center gap-2.5 border-t border-line-2 px-4 py-2 text-left transition first:border-t-0 hover:bg-[#f7f8fa]">
        <span className="shrink-0 [&>span]:h-6 [&>span]:w-6">{NOW_ICON[it.status]}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-[0.84375rem] font-semibold text-ink">{it.title}</span><span className={cn('block truncate text-[0.75rem]', it.status === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{it.note}</span></span>
        {it.action && <span className="shrink-0 text-[0.78125rem] font-semibold text-brand-600">{it.action.label}</span>}
      </button>
    )
  }
  const t = l.task!
  return (
    <button onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-2.5 border-t border-line-2 px-4 py-2 text-left transition first:border-t-0 hover:bg-[#f7f8fa]">
      <span className="shrink-0 [&>span]:h-6 [&>span]:w-6">{NOW_ICON[t.state === 'waiting' ? 'wait' : 'todo']}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-[0.84375rem] font-semibold text-ink">{t.title}</span><span className={cn('block truncate text-[0.75rem]', t.state === 'waiting' ? 'text-warn-700' : 'text-muted')}>{t.state === 'waiting' ? `Waiting on ${t.waitingOn} · back ${t.followUp}` : t.due || 'No date'}</span></span>
      <Avatar who={t.owner} size={22} />
    </button>
  )
}

/** once the crew is on it: how far each room is */
function RoomsProgress({ job, setTab }: { job: Job; setTab: (t: PTab) => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="border-b border-line px-4 py-3">
        <div className="flex items-baseline justify-between gap-2"><h3 className="text-[0.90625rem] font-semibold text-ink">Installed</h3><span className="text-[0.8125rem] font-semibold tnum text-ink">{job.pct ?? 0}%</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wash-2"><div className="h-full rounded-full bg-ok-500" style={{ width: `${Math.max(3, job.pct ?? 0)}%` }} /></div>
      </header>
      <ol className="py-1.5">
        {rooms.map((r) => {
          const pct = r.pct ?? roomPct(r)
          const held = r.surfaces.some((x) => ['blocked', 'waitmat', 'hold'].includes(x.state))
          return (
            <li key={r.name}>
              <button onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name })} className="flex w-full items-center gap-3 px-4 py-[0.375rem] text-left transition hover:bg-[#f7f8fa]">
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-2">{r.name}</span>
                {held && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-warn-500" />}
                <span className="h-1 w-[4.5rem] shrink-0 overflow-hidden rounded-full bg-wash-2"><span className={cn('block h-full rounded-full', held ? 'bg-warn-500' : 'bg-ok-500')} style={{ width: `${Math.max(4, pct)}%` }} /></span>
                <span className={cn('w-9 shrink-0 text-right text-[0.78125rem] font-semibold tnum', pct >= 100 ? 'text-ok-700' : 'text-muted')}>{pct}%</span>
              </button>
            </li>
          )
        })}
        {!rooms.length && <li className="px-4 py-2 text-[0.8125rem] text-muted">Rooms come from the scope.</li>}
      </ol>
      <button onClick={() => setTab('scope')} className="flex w-full items-center justify-between border-t border-line-2 px-4 py-2.5 text-[0.8125rem] font-semibold text-brand-600 hover:bg-wash">Every wall and floor<ChevronRight className="h-4 w-4" /></button>
    </section>
  )
}

/** files and history, each in its own window */
export function FilesModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  return <Modal level={level} size="lg" tall onClose={s.close} title="Files and photos" sub={job.name}><FilesTab job={job} /></Modal>
}
export function HistoryModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  return <Modal level={level} size="lg" tall onClose={s.close} title="History" sub={`${job.name} · ${historyOf(s, job.id).length} entries`}><HistoryTab job={job} /></Modal>
}

/* ================= Now: what has to happen at this stage ================= */
type NowState = 'done' | 'todo' | 'part' | 'wait' | 'bad'
type NowItem = { key: string; title: string; status: NowState; note?: string; action?: { label: string; run: () => void } }
const CELL_TO_NOW: Record<string, NowState> = { yes: 'done', no: 'todo', part: 'part', wait: 'wait', bad: 'bad', na: 'done' }

export function nowItems(s: Store, job: Job, setTab: (t: PTab) => void): { heading: string; items: NowItem[] } {
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
      { key: 'punch', title: 'Touch-ups', status: left.length ? 'todo' : 'done', note: left.length ? `${left.length} still open` : 'All verified', action: left.length ? { label: 'Open list', run: () => setTab('installer') } : undefined },
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

const NOW_ICON: Record<NowState, React.ReactNode> = {
  done: <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ok-500 text-white"><Check className="h-3.5 w-3.5" strokeWidth={3.2} /></span>,
  bad: <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bad-500 text-white"><X className="h-3.5 w-3.5" strokeWidth={3.2} /></span>,
  wait: <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-2 ring-inset ring-brand-200"><Clock3 className="h-3.5 w-3.5" strokeWidth={2.4} /></span>,
  part: <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-warn-50 text-warn-700 ring-2 ring-inset ring-warn-300"><Contrast className="h-3.5 w-3.5" strokeWidth={2.4} /></span>,
  todo: <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-[#d6dae0] bg-white" />,
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
type Line = { key: string; rank: number; it?: NowItem; task?: Task; owner?: Task; ev?: CalEvent; step?: StepView }
function todoLines(s: Store, job: Job, setTab: (t: PTab) => void, extrasOnly?: boolean, withSteps?: boolean) {
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

/* ================= To do: one list — what this stage needs, everyone's part, meetings ================= */
function TodoList({ job, setTab, extrasOnly, withSteps }: { job: Job; setTab: (t: PTab) => void; extrasOnly?: boolean; withSteps?: boolean }) {
  const s = useStore()
  const [showDone, setShowDone] = React.useState(false)
  const [showWait, setShowWait] = React.useState(false)
  const { lines, done } = todoLines(s, job, setTab, extrasOnly || withSteps, withSteps)
  const act = lines.filter((l) => l.rank !== 2)
  const waits = lines.filter((l) => l.rank === 2)
  const who = (t: Task) => (
    <Tip label={`${PEOPLE[t.owner].name} has it — open the task`}>
      <button onClick={(e) => { e.stopPropagation(); s.open({ t: 'task', id: t.id }) }} className="inline-flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-[0.78125rem] font-medium text-muted hover:bg-wash-2 hover:text-ink">
        <Avatar who={t.owner} size={24} />
        <span className="max-md:hidden">{PEOPLE[t.owner].short}</span>
      </button>
    </Tip>
  )
  const row = (l: Line) => {
    if (l.step) {
      const v = l.step
      return (
        <LineShell lead={<StepIcon state={v.state} size={28} />} title={v.label} note={v.note || (v.state === 'wait' ? 'Waiting' : 'Checklist step')} bad={v.state === 'bad'} wrap
          right={<><span className="inline-flex items-center gap-1.5 text-[0.78125rem] font-medium text-muted"><Avatar who={v.owner} size={24} /><span className="max-md:hidden">{PEOPLE[v.owner]?.short}</span></span><StepButton job={job} v={v} /></>}
        />
      )
    }
    if (l.it) return <CheckLine it={l.it} owner={l.owner ? who(l.owner) : undefined} />
    if (l.task) {
      const t = l.task
      return (
        <LineShell lead={NOW_ICON[t.state === 'waiting' ? 'wait' : 'todo']} onClick={() => s.open({ t: 'task', id: t.id })}
          title={t.title}
          note={<span className={t.state === 'waiting' ? 'text-warn-700' : undefined}>{t.state === 'waiting' ? `Waiting on ${t.waitingOn} · back ${t.followUp}` : t.due || 'No date'}</span>}
          right={<><span className="inline-flex items-center gap-1.5 text-[0.78125rem] font-medium text-muted"><Avatar who={t.owner} size={24} /><span className="max-md:hidden">{PEOPLE[t.owner].short}</span></span><ChevronRight className="h-4 w-4 text-faint" /></>}
        />
      )
    }
    const e = l.ev!
    return (
      <LineShell lead={<span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-vio-50 text-vio-600"><CalendarDays className="h-3.5 w-3.5" /></span>} onClick={() => s.open({ t: 'event', id: e.id })}
        title={e.title}
        note={`${dayLabel(e.date)} · ${timeLabel(e.start)}${e.with ? ` · with ${e.with}` : ''}`}
        right={<><span className="flex -space-x-1.5 max-sm:hidden">{e.people.slice(0, 3).map((p) => <Avatar key={p} who={p} size={24} ring />)}</span><ChevronRight className="h-4 w-4 text-faint" /></>}
      />
    )
  }
  return (
    <div className="w-full min-w-0">
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
        <header className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3 max-sm:px-4">
          <h3 className="text-[0.90625rem] font-semibold text-ink">What’s open<span className="ml-1.5 text-[0.8125rem] font-semibold text-faint">{act.filter((l) => !l.ev).length}</span></h3>
          <span className="truncate text-[0.78125rem] text-muted max-sm:hidden">{withSteps ? 'The steps that are someone’s turn, and anything else open here' : 'Everything that needs doing here, with who has each'}</span>
        </header>
        {act.length ? act.map((l) => <div key={l.key} className="border-t border-line-2 first:border-t-0">{row(l)}</div>) : (
          <div className="flex items-center gap-3 px-5 py-5 text-[0.875rem] font-medium text-muted">{NOW_ICON.done}<span className="font-semibold text-ink">{waits.length ? 'Nothing for us right now — only waiting on others' : 'Nothing open on this project'}</span></div>
        )}
        {waits.length > 0 && (
          <>
            <button onClick={() => setShowWait((v) => !v)} className="flex w-full items-center gap-2 border-t border-line bg-wash px-5 py-2.5 text-left text-[0.8125rem] font-semibold text-ink-2 transition hover:text-ink max-sm:px-4">
              {showWait ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Waiting on others<span className="text-[0.78125rem] font-semibold text-faint">{waits.length}</span>
              <span className="ml-auto truncate text-[0.78125rem] font-normal text-muted">{!showWait && waits.map((l) => l.step?.short || l.task?.waitingOn || l.it?.title).filter(Boolean).slice(0, 3).join(' · ')}</span>
            </button>
            {showWait && waits.map((l) => <div key={l.key} className="border-t border-line-2">{row(l)}</div>)}
          </>
        )}
        <div className="flex items-center gap-1 border-t border-line-2 px-3 py-2">
          <button onClick={() => s.open({ t: 'newtask', jobId: job.id })} className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[0.84375rem] font-semibold text-muted hover:bg-wash hover:text-ink"><Plus className="h-4 w-4" />Add a task</button>
          <button onClick={() => s.open({ t: 'record', jobId: job.id, type: 'meeting' })} className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-[0.84375rem] font-semibold text-muted hover:bg-wash hover:text-ink"><CalendarDays className="h-4 w-4" />Add a meeting</button>
        </div>
      </div>
      {done.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-[0.8125rem] font-semibold text-muted hover:text-ink">
            {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}Done · {done.length}
          </button>
          {showDone && (
            <div className="mt-2 overflow-hidden rounded-[0.875rem] border border-line bg-white">
              {done.map((it) => <div key={it.key} className="border-t border-line-2 first:border-t-0"><CheckLine it={it} /></div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LineShell({ lead, title, note, right, onClick, bad, dim, wrap }: { lead: React.ReactNode; title: React.ReactNode; note?: React.ReactNode; right?: React.ReactNode; onClick?: () => void; bad?: boolean; dim?: boolean; wrap?: boolean }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag onClick={onClick} className={cn('flex min-h-[3.25rem] w-full items-center gap-3 px-5 py-2 text-left max-sm:px-4', wrap && 'max-sm:flex-wrap max-sm:gap-y-2', onClick && 'transition hover:bg-[#f7f8fa]')}>
      <span className="shrink-0">{lead}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[0.875rem] font-semibold leading-5', dim ? 'text-muted' : 'text-ink')}>{title}</span>
        {note && <span className={cn('block truncate text-[0.78125rem] leading-[1.125rem]', bad ? 'font-medium text-bad-600' : 'text-muted')}>{note}</span>}
      </span>
      {right && <span className={cn('flex shrink-0 items-center gap-3', wrap && 'max-sm:w-full max-sm:justify-between max-sm:pl-[2.625rem]')}>{right}</span>}
    </Tag>
  )
}
function CheckLine({ it, owner }: { it: NowItem; owner?: React.ReactNode }) {
  return (
    <LineShell lead={NOW_ICON[it.status]} title={it.title} note={it.note} bad={it.status === 'bad'} dim={it.status === 'done'} wrap={!!it.action}
      right={it.action || owner ? <>{owner || <span />}{it.action && <Button size="sm" variant={it.status === 'bad' ? 'primary' : 'outline'} onClick={it.action.run}>{it.action.label}</Button>}</> : undefined}
    />
  )
}

/** one room up close — its surfaces, the daily log and photos (the rooms view, in its own window) */
export function RoomModal({ jobId, room, view, surface, level }: { jobId: string; room?: string; view?: any; surface?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  return (
    <Modal level={level} size="xl" tall onClose={s.close} title={`${job.name}${room ? ' · ' + room : ''}`} sub={job.client} bodyClass="bg-canvas p-5 max-sm:p-3">
      <RoomsTab job={job} room={room} view={view} surface={surface} />
    </Modal>
  )
}

/* ================= a printable scope of work, in Cobblestone's document style ================= */
export function ScopeDocModal({ jobId, estId, print, level }: { jobId: string; estId?: string; print?: boolean; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const doc = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (print) { const t = setTimeout(() => printNode(doc.current), 350); return () => clearTimeout(t) } }, [print])
  const rooms = estId ? [] : s.rooms[jobId] || []
  const est = estId ? s.estimates.find((e) => e.id === estId) : s.estimates.find((e) => e.jobId === jobId && e.status === 'approved')
  if (!job) return null
  const fromEst = !rooms.length && est ? (est.revs.find((r) => r.status === 'draft') || est.revs[est.revs.length - 1]) : undefined
  const estAreas = fromEst ? Array.from(new Set(fromEst.lines.map((l) => l.area))) : []
  const GREEN = '#2c4a3e'
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="Scope of work"
      sub={`${job.name} — what we install, room by room`}
      bodyClass="bg-wash px-8 py-6 max-sm:px-3"
      footer={
        <>
          <span className="text-[0.8125rem] text-muted">{fromEst ? `From estimate ${est!.id}, revision ${fromEst.n}` : `From the project’s rooms and surfaces${est ? ` · estimate ${est.id}` : ''}`}</span>
          <Button className="ml-auto" variant="primary" icon={<Printer />} onClick={() => printNode(doc.current)}>Print</Button>
        </>
      }
    >
      {fromEst && est ? <EstimatePaper e={est} rev={fromEst} prices={false} innerRef={doc} /> : (
      <div ref={doc} className="mx-auto max-w-[47.5rem] bg-white px-10 py-9 font-[Helvetica,Arial,sans-serif] text-[#222] shadow-card max-sm:px-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[1.75rem] font-bold tracking-[0.01em]" style={{ color: GREEN }}>COBBLESTONE</div>
          <div className="text-[0.8125rem] font-bold tracking-[0.04em]" style={{ color: GREEN }}>SCOPE OF WORK</div>
        </div>
        <div className="mt-4 text-[0.875rem] font-bold">{job.name} | {job.address}</div>
        <div className="mt-0.5 flex justify-between text-[0.75rem] text-[#444]">
          <span>{job.client}</span>
          <span>{est ? `Estimate ${est.id}` : 'Scope'} | {est?.approvedOn || (fromEst ? fromEst.date : '') || job.stageDates?.won || ''}</span>
        </div>
        <div className="mt-6">
          {floorsOf(rooms).map((g) => (
            <section key={g.floor} className="mb-5">
              <div className="flex justify-between px-2 py-2 text-[0.75rem] font-bold uppercase text-white" style={{ background: GREEN }}>
                <span>{g.floor}</span><span>Quantity</span>
              </div>
              {g.rooms.map((r) => (
                <div key={r.name}>
                  <div className="mt-1 bg-[#eef0ee] px-2 py-1.5 text-[0.71875rem] font-bold uppercase">{r.name}{r.note ? <span className="normal-case"> | {r.note}</span> : null}</div>
                  {r.surfaces.map((x) => {
                    const t = tileOf(jobId, x.tile)
                    const what = /floor/i.test(x.name) ? 'Floor tile' : /wall|splash|wainscot/i.test(x.name) ? 'Wall tile' : x.name
                    return (
                      <div key={x.name} className="flex justify-between px-2 py-[0.1875rem] text-[0.71875rem]">
                        <span>{x.name} — {what}{t ? ` ${t.size.replace(/\s/g, '').toUpperCase()} (${t.tag} ${t.name})` : ''}{x.height ? ` · ${x.height}` : ''}</span>
                        <span className="tnum">{x.sf ? `${x.sf} SF` : '1 EA'}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className="mt-8 flex justify-between border-t border-[#ddd] pt-2 text-[0.625rem] text-[#666]">
          <span>Scope reference{est ? ` — based on estimate ${est.id}` : ''}</span><span>1</span>
        </div>
      </div>
      )}
    </Modal>
  )
}
