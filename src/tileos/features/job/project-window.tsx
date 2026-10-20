/* The project window — opens nearly full screen, and reads like the estimate:
 *   header: the project and where it stands, the client and the address (the pencil changes them), and the one button
 *           when there's something for you here. Then the bar of where it's at — paperwork, design meeting, site,
 *           installer, deliveries, installing, touch-ups, closed — each part the same size: how far it is, who has it.
 *   tabs:   Overview          — To do (your turn, others, waiting, coming up); at a glance; what we're tiling
 *           Scope of work — every room, wall and floor: the tile, how it's set, the square feet, where it's at
 *           POs               — the installer's PO (against the estimate) and every materials PO, then the tile
 *           Estimate          — the estimate it came from, and the change orders
 *           Installer, Billing
 * Every tab is built from the same pieces (job/kit): the same cards, rows, people and dates. */
import * as React from 'react'
import {
  Building2, MapPin, CalendarDays, Maximize2, ListPlus, Lock, Check, X, Clock3, Contrast, Plus, ChevronDown, ChevronRight,
  Printer, HardHat, Send, Play, ClipboardList, Receipt, Paperclip, History, MessageCircle, Package, Grid2x2, Wallet, TriangleAlert, ArrowRight, MoreHorizontal, Pencil } from 'lucide-react'
import { useStore, historyOf, type Store } from '@/tileos/store'
import type { Task } from '@/tileos/data/work'
import type { CalEvent } from '@/tileos/data/calendar'
import { Button, Avatar, IconButton, UnderlineTabs } from '@/tileos/components/ui/core'
import { Modal, Tip, Menu, MenuItem, MenuLabel, MenuSep } from '@/tileos/components/ui/overlay'
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
import { isGettingReady, stepsFor, stepCounts, takesTile, type StepView } from '../steps'
import { StepIcon, StepButton, AddStep } from '../steps-ui'
import { openStep, todoOf } from '../stepwin'
import { projectPath, nextOn, PhaseBar, WhatsOpen, Latest } from './plan'
import { nowItems, todoCount } from './todo'
import { useSaveStatus } from '@/tileos/lib/save'
import { md } from '@/tileos/lib/today'
import { NOW } from '@/tileos/lib/today'

export { floorsOf }
export type PTab = 'overview' | 'scope' | 'orders' | 'estimate' | 'money'

/** old links into the window (tab names from earlier versions) land on the right tab */
const tabFrom = (initial: string | undefined): PTab =>
  initial === 'estimate' ? 'money'
  : (['overview', 'scope', 'orders', 'money'] as PTab[]).includes(initial as PTab)
    ? (initial as PTab)
    : initial === 'rooms' || initial === 'setup' ? 'scope'
      : initial === 'materials' || initial === 'pos' || initial === 'installer' || initial === 'crew' ? 'orders'
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
    <Modal level={level} size="full" tall onClose={close} title={job.name} header={<ProjectHeader job={job} mode="modal" tab={pricing ? undefined : tab} setTab={setTab} />} bodyClass={pricing ? 'p-0' : 'bg-[#f4f1eb] p-0'}>
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
      <div className="min-h-[35rem] bg-[#f4f1eb]"><ProjectBody job={job} tab={tab} setTab={setTab} /></div>
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

/** the tabs, the same on every project — four: what's happening, what we're tiling, what's ordered (the installer's PO,
 *  the tile, the materials), and the money. The installer himself opens from the header. The site manager has
 *  Deliveries for Orders, and no Money. */
function tabsFor(s: Store): { key: PTab; label: string }[] {
  return [
    { key: 'overview', label: 'Overview' },
    { key: 'scope', label: 'Scope of work' },
    { key: 'orders', label: s.role === 'site' ? 'Deliveries' : 'Orders' },
    ...(s.role !== 'site' ? [{ key: 'money' as PTab, label: 'Money' }] : []),
  ]
}

/** where the project stands, in one plain bubble (red only when it's on hold) — the same words as the Projects list.
 *  With the four-part bar under it, the bubble is just the word: the bar already says how far along it is. */
function headStatus(s: Store, job: Job, withBar = false): { tone: Tone; label: string; onClick?: () => void } {
  const st = projectStatus(s, job)
  if (st.key === 'hold') return { tone: 'bad', label: `On hold · ${(job.hold?.reason || '').replace(/^Waiting for /, 'waiting for ')}`, onClick: job.hold?.shortage ? () => s.open({ t: 'short', id: job.hold!.shortage! }) : undefined }
  if (withBar) return { tone: st.tone, label: st.label }
  if (isGettingReady(job)) {
    const c = stepCounts(stepsFor(s, job))
    return { tone: st.tone, label: `${st.label} · ${c.done} of ${c.total} steps done` }
  }
  if (st.key === 'progress') return { tone: st.tone, label: `In progress · ${job.pct ?? 0}% installed` }
  if (st.key === 'touchups') {
    const n = s.punch.filter((p) => p.jobId === job.id && p.status !== 'verified').length
    return { tone: st.tone, label: n ? `Touch-ups · ${n} open` : 'Touch-ups' }
  }
  return { tone: st.tone, label: st.label }
}

export function ProjectHeader({ job, mode, tab, setTab }: { job: Job; mode: 'modal' | 'page'; tab?: PTab; setTab: (t: PTab) => void }) {
  const s = useStore()
  const role = s.role
  const status = headStatus(s, job, !!tab)
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const prim = PRIMARY[job.stage]
  const blockers = nowItems(s, job, setTab).items.filter((i) => i.status === 'bad').length
  /* getting ready is done when the checklist is (the deposit is a warning, not a stop) */
  const left = job.stage === 'setup' || job.stage === 'verification' ? stepsFor(s, job).filter((v) => v.state !== 'done' && v.state !== 'na' && v.key !== 'deposit') : []
  const locked = left.length > 0
  /* the one thing to press: my next step here — or whose turn it is */
  const next = nextOn(s, job)
  const path = projectPath(s, job, setTab)
  const save = useSaveStatus()
  const files = s.files.filter((f) => f.jobId === job.id).length + (save.mode === 'sample' && save.where !== 'cloud' ? filesFor(job.id).length : 0)
  const unread = unreadOf(s, job.id)
  const runPrimary = () => {
    if (job.stage === 'setup' || job.stage === 'verification') return verificationDone(job.id)
    if (job.stage === 'ready' || job.stage === 'scheduled') return startProject(job.id)
    if (job.stage === 'installation') return s.open({ t: 'daily', jobId: job.id })
    if (job.stage === 'punch') return s.open({ t: 'assign', jobId: job.id })
    if (job.stage === 'closeout') return s.open({ t: 'money', id: s.money.find((m) => m.jobId === job.id && m.kind === 'final')?.id || '' })
  }
  const pricing = !tab
  /* the one button: my next step here, or what this stage needs */
  const main = next && (locked || !prim)
    ? (next.mine && tab !== 'overview'
      ? <span className="max-sm:flex max-sm:min-w-0 max-sm:flex-1"><Button variant="primary" className="max-w-[22rem] max-sm:w-full max-sm:min-w-0 max-sm:max-w-none" icon={<ArrowRight />} onClick={() => openStep(job.id, next.v.key)}><span className="truncate">Your turn: {todoOf(next.v)}</span></Button></span>
      : null)
    : prim && !locked
      ? <span className="max-sm:flex max-sm:min-w-0 max-sm:flex-1"><Button variant="primary" className="max-sm:w-full max-sm:min-w-0" icon={prim.icon} onClick={runPrimary}><span className="truncate">{prim.label}</span></Button></span>
      : null
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish}` : (() => { const b = s.bookings.find((x) => x.jobId === job.id); return b ? `${md(b.start)} – ${md(b.end)}` : '' })()
  const canBook = ['owner', 'pm', 'office'].includes(role)
  const canEdit = ['owner', 'pm', 'office', 'estimator'].includes(role)
  /* the rest, in one short menu — adding things is on the Overview's list (+ Add) */
  const more = (
    <Menu align="end" width={270} trigger={<Button aria-label="More for this project" icon={<MoreHorizontal />} />}>
      <MenuItem icon={<History className="h-4 w-4" />} onSelect={() => s.open({ t: 'history', jobId: job.id })}>Everything that happened</MenuItem>
      <MenuItem icon={<Paperclip className="h-4 w-4" />} onSelect={() => s.open({ t: 'files', jobId: job.id })} hint={files ? `${files}` : undefined}>Files and photos</MenuItem>
      <MenuItem icon={<MessageCircle className="h-4 w-4" />} onSelect={() => s.open({ t: 'chat', jobId: job.id })} hint={unread ? `${unread} new` : undefined}>Messages</MenuItem>
      {(canEdit || mode === 'modal') && <MenuSep />}
      {canEdit && <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => s.open({ t: 'editproject', id: job.id })}>Change the project’s details</MenuItem>}
      {mode === 'modal' && <MenuItem icon={<Maximize2 className="h-4 w-4" />} onSelect={() => { s.closeAll(); s.go({ page: 'job', id: job.id }) }}>Open as a full page</MenuItem>}
    </Menu>
  )
  return (
    <div className="relative border-b border-line bg-white">
      <div className={cn('px-7 pt-4 max-sm:px-4 max-sm:pt-3.5', mode === 'modal' && 'pr-16 max-sm:pr-14', !main && !pricing && (mode === 'modal' ? 'max-sm:pr-24' : 'max-sm:pr-14'), pricing && 'pb-4')}>
        <div className="flex items-start gap-4 max-lg:flex-wrap max-sm:gap-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="font-display min-w-0 truncate text-[1.625rem] font-semibold leading-tight tracking-[-0.015em] text-ink max-sm:text-[1.3125rem]">{job.name}</h1>
              {!pricing && (status.onClick
                ? <button onClick={status.onClick} className="min-w-0 max-w-full"><Status tone={status.tone} plain={status.tone !== 'bad'}>{status.label}</Status></button>
                : <Status tone={status.tone} plain={status.tone !== 'bad'} className="shrink-0">{status.label}</Status>)}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[0.8125rem] text-muted">
              <button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:text-brand-600"><Building2 className="h-4 w-4 text-faint" />{job.client}</button>
              <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0 text-faint" /><span className="truncate">{job.address}</span></span>
              {!pricing && (crew
                ? <button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} className="inline-flex items-center gap-1.5 hover:text-ink"><HardHat className="h-4 w-4 text-faint" /><span className="font-medium text-ink-2 underline decoration-line underline-offset-[0.1875rem]">{PEOPLE[crew].short}</span>{dates && <span>· {dates}</span>}</button>
                : !['closeout', 'complete'].includes(job.stage) && <span className="inline-flex items-center gap-1.5"><HardHat className="h-4 w-4 text-faint" />No installer yet</span>)}
            </div>
          </div>
          {!pricing && (
            <div className={cn('flex shrink-0 items-center gap-2', main ? 'max-lg:w-full' : cn('max-sm:absolute max-sm:top-3', mode === 'modal' ? 'max-sm:right-14' : 'max-sm:right-4'))}>
              {/* with nothing to start, the "…" sits up by the title on a phone instead of on a row of its own */}
              <span className="max-lg:flex-1 max-sm:hidden" />
              {main}
              {more}
            </div>
          )}
        </div>
      </div>
      {tab && (
        <div className="px-6 pt-2 max-sm:px-2">
          <PhaseBar cells={path} />
        </div>
      )}
      {tab && (
        <div className="mt-0.5 px-7 max-sm:px-4">
          <UnderlineTabs className="min-w-0 border-b-0" value={tab} onChange={setTab} items={tabsFor(s)} />
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
    <div key={tab} className="animate-fade-up px-7 py-5 max-sm:px-3 max-sm:py-3.5">
      {tab === 'overview' && <OverviewTab job={job} setTab={setTab} />}
      {tab === 'scope' && <ScopeTab job={job} />}
      {tab === 'orders' && <POsTab job={job} onScope={() => setTab('scope')} />}
      {tab === 'estimate' && <MoneyTab job={job} />}
      {tab === 'money' && <MoneyTab job={job} />}
    </div>
  )
}

/* ================= Overview ================= */
function OverviewTab({ job, setTab }: { job: Job; setTab: (t: PTab) => void }) {
  const role = useStore((s) => s.role)
  /* what's open (and whose desk it's on), and what happened lately — that's the whole job at a glance */
  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_22.5rem] items-start gap-4 max-[68rem]:grid-cols-1">
      <div className="min-w-0"><WhatsOpen key={role} job={job} setTab={setTab} /></div>
      <div className="min-w-0"><Latest job={job} /></div>
    </div>
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
                  <div className="mt-1 bg-[#efece5] px-2 py-1.5 text-[0.71875rem] font-bold uppercase">{r.name}{r.note ? <span className="normal-case"> | {r.note}</span> : null}</div>
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
