/* The project window — the job like the estimate (job/board): a track of its four parts on top, each a ring that
 * says how far it is, and under it the part you're on: the flow numbered step by step with its status and whose it
 * is, the rooms, the touch-ups, the money. Tap a step and it opens beside the list — never a window inside a window.
 *   header: the project, the client and the address, the installer, and three buttons at most: the one thing to do
 *           now (start the job, the daily update…), + Add, and ··· for the rest. */
import * as React from 'react'
import { CalendarDays, Maximize2, Check, Printer, HardHat, Play, ClipboardList, ListTodo, Receipt, Paperclip, History, MessageCircle, Package, Grid2x2, ArrowRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useStore, historyOf, type Store } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuSep } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { EstimatePaper } from '../estpaper'
import { printNode } from '@/tileos/lib/print'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { tileOf, floorsOf } from '@/tileos/data/jobs'
import { verificationDone, startProject } from '../flows'
import { installerOf } from '../upcoming'
import { MoneyTab } from './money-tab'
import { FilesTab, HistoryTab } from './files'
import { POsTab } from './pos-tab'
import { PricingWorkspace } from '../pricing'
import { RoomsTab } from './rooms'
import { ScopeTab } from './scope-tab'
import { projectStatus } from '../statuses'
import { stepsFor } from '../steps'
import { openStep, todoOf } from '../stepwin'
import { nextOn, WhatsOpen, AddToProject } from './plan'
import { ProjectBoard, ProjectFoot, Track, useParts } from './board'
import { pictureOf } from '../progressbill'
import { md } from '@/tileos/lib/today'

export { floorsOf }
export type PTab = 'ready' | 'install' | 'punch' | 'money'

/** where the project is — the section it opens on */
export function sectionOf(job: Job): PTab {
  if (['installation'].includes(job.stage)) return 'install'
  if (job.stage === 'punch') return 'punch'
  if (['closeout', 'complete'].includes(job.stage)) return 'money'
  return 'ready'
}
/** links into the window (section names, and tab names from earlier versions) land on the right section */
const tabFrom = (initial: string | undefined, job: Job): PTab =>
  (['ready', 'install', 'punch', 'money'] as PTab[]).includes(initial as PTab) ? (initial as PTab)
  : initial === 'estimate' || initial === 'billing' ? 'money'
  : initial === 'scope' || initial === 'rooms' || initial === 'installer' || initial === 'crew' ? 'install'
  : initial === 'touchups' ? 'punch'
  : initial === 'orders' || initial === 'materials' || initial === 'pos' || initial === 'setup' || initial === 'checklist' ? 'ready'
  : sectionOf(job)

/* ================= the window ================= */
export function ProjectWindow({ id, tab: initial, level }: { id: string; tab?: string; level: number }) {
  const job = useStore((s) => s.jobs[id])
  const role = useStore((s) => s.role)
  const close = useStore((s) => s.close)
  const pricing = job && ['request', 'estimating', 'proposal', 'followup'].includes(job.stage)
  const [part, setPart] = React.useState<PTab>(() => (job ? (initial ? tabFrom(initial, job) : role === 'accounting' ? 'money' : sectionOf(job)) : 'ready'))
  if (!job) return null
  if (pricing) {
    return (
      <Modal level={level} size="xl" tall onClose={close} title={job.name} header={<ProjectHeader job={job} mode="modal" />} bodyClass="p-0">
        <div className="p-6"><PricingWorkspace job={job} /></div>
      </Modal>
    )
  }
  return (
    <Modal level={level} size="xl" tall onClose={close} title={job.name} header={<ProjectHeader job={job} mode="modal" part={part} setPart={setPart} />} footer={<ProjectFooter job={job} part={part} />} bodyClass="p-0">
      <ProjectBoard job={job} part={part} />
    </Modal>
  )
}

/** the same project as a page (Open full page) */
export function ProjectPage({ job, tab: initial }: { job: Job; tab?: string }) {
  const [part, setPart] = React.useState<PTab>(tabFrom(initial, job))
  const pricing = ['request', 'estimating', 'proposal', 'followup'].includes(job.stage)
  return (
    <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white shadow-card">
      <ProjectHeader job={job} mode="page" part={pricing ? undefined : part} setPart={setPart} />
      {pricing ? <div className="p-6"><PricingWorkspace job={job} /></div> : (
        <>
          <ProjectBoard job={job} part={part} />
          <div className="flex items-center gap-3 border-t border-line px-6 py-3"><ProjectFooter job={job} part={part} /></div>
        </>
      )}
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

/** where the project stands, in one plain bubble (red only when it's on hold) — the same words as the Projects list */
function headStatus(s: Store, job: Job): { tone: Tone; label: string; onClick?: () => void } {
  const st = projectStatus(s, job)
  if (st.key === 'hold') return { tone: 'bad', label: `On hold · ${(job.hold?.reason || '').replace(/^Waiting for /, 'waiting for ')}`, onClick: job.hold?.shortage ? () => s.open({ t: 'short', id: job.hold!.shortage! }) : undefined }
  return { tone: st.tone, label: st.label }
}

/** the header, the same as an estimate's: what it is and where it stands, the name, the client and the address;
 *  on the right the contract (for whoever sees money) and the two buttons; under it the four parts as rings */
export function ProjectHeader({ job, mode, part, setPart }: { job: Job; mode: 'modal' | 'page'; part?: PTab; setPart?: (t: PTab) => void }) {
  const s = useStore()
  const role = s.role
  const status = headStatus(s, job)
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const parts = useParts(job)
  const pricing = !part
  const money = !['site', 'crew'].includes(role)
  const pic = money && !pricing ? pictureOf(s, job.id) : null
  const canEdit = ['owner', 'pm', 'office', 'estimator'].includes(role)
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish || '…'}` : (() => { const b = s.bookings.find((x) => x.jobId === job.id); return b ? `${md(b.start)} – ${md(b.end)}` : '' })()
  const more = (
    <Menu align="end" width={270} trigger={<Button size="sm" aria-label="More for this project" icon={<MoreHorizontal />} />}>
      <MenuItem icon={<ListTodo className="h-4 w-4" />} onSelect={() => s.open({ t: 'whatsopen', jobId: job.id })}>Everything open — mine, everyone’s, done</MenuItem>
      <MenuItem icon={<History className="h-4 w-4" />} onSelect={() => s.open({ t: 'history', jobId: job.id })}>Everything that happened</MenuItem>
      <MenuItem icon={<Paperclip className="h-4 w-4" />} onSelect={() => s.open({ t: 'files', jobId: job.id })}>Files and photos</MenuItem>
      <MenuItem icon={<MessageCircle className="h-4 w-4" />} onSelect={() => s.open({ t: 'chat', jobId: job.id })}>Messages</MenuItem>
      <MenuSep />
      <MenuItem icon={<Grid2x2 className="h-4 w-4" />} onSelect={() => s.open({ t: 'scopewin', jobId: job.id })}>Scope of work — every wall and floor</MenuItem>
      {role !== 'site' && <MenuItem icon={<Package className="h-4 w-4" />} onSelect={() => s.open({ t: 'orderswin', jobId: job.id })}>All the orders</MenuItem>}
      {(canEdit || mode === 'modal') && <MenuSep />}
      {canEdit && <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => s.open({ t: 'editproject', id: job.id })}>Change the project’s details</MenuItem>}
      {mode === 'modal' && <MenuItem icon={<Maximize2 className="h-4 w-4" />} onSelect={() => { s.closeAll(); s.go({ page: 'job', id: job.id }) }}>Open as a full page</MenuItem>}
      {['owner', 'pm'].includes(role) && <><MenuSep /><MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => s.open({ t: 'delete', kind: 'job', id: job.id })}>Delete this project…</MenuItem></>}
    </Menu>
  )
  return (
    <div className={cn('relative border-b border-line bg-white px-6 pb-4 pt-5 max-sm:px-4 max-sm:pb-3 max-sm:pt-4', mode === 'modal' && 'pr-16 max-sm:pr-14')}>
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3 max-sm:gap-1.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted">
            <span>{job.kind === 'repair' ? 'Repair' : 'Project'}</span>
            {status.onClick
              ? <button onClick={status.onClick}><Status tone={status.tone} plain={status.tone !== 'bad'}>{status.label}</Status></button>
              : <Status tone={status.tone} plain={status.tone !== 'bad'}>{status.label}</Status>}
          </div>
          <h2 className="font-display mt-0.5 text-[1.5625rem] font-semibold leading-tight tracking-[-0.012em] text-ink max-sm:text-[1.375rem]">{job.name}</h2>
          {/* one line on a desktop, dots between; a line each on a phone */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.875rem] text-muted max-sm:text-[0.8125rem] [&>*+*]:sm:before:mr-1.5 [&>*+*]:sm:before:content-['·']">
            <button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="text-ink-2 hover:text-brand-700">{job.client}</button>
            <span className="max-sm:basis-full">{job.address}</span>
            {!pricing && (crew
              ? <button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} className="inline-flex items-center gap-1 hover:text-ink max-sm:basis-full"><HardHat className="h-4 w-4 text-faint" /><span className="font-medium text-ink-2">{PEOPLE[crew].short}</span>{dates && <span>· {dates}</span>}</button>
              : !['closeout', 'complete'].includes(job.stage) && <span className="inline-flex items-center gap-1 max-sm:basis-full"><HardHat className="h-4 w-4 text-faint" />No installer yet</span>)}
            {pic && pic.contract > 0 && <span className="sm:hidden max-sm:basis-full">Contract <b className="font-semibold tnum text-ink">{fmtMoney(pic.contract + pic.changes)}</b>{pic.billed > 0 ? ` · ${fmtMoney(pic.paid)} paid` : ''}</span>}
          </div>
        </div>
        <div className="shrink-0 text-right max-md:text-left max-sm:absolute max-sm:right-14 max-sm:top-3">
          {pic && (
            <div className="max-sm:hidden">
              <div className="text-[0.8125rem] text-muted">{pic.contract ? 'Contract' : 'No contract amount yet'}</div>
              {pic.contract > 0 && <div className="text-[1.625rem] font-semibold leading-tight tnum text-ink">{fmtMoney(pic.contract + pic.changes)}</div>}
              {pic.billed > 0 && <div className="text-[0.75rem] text-muted">{fmtMoney(pic.paid)} paid · {fmtMoney(pic.contract + pic.changes - pic.paid)} open</div>}
            </div>
          )}
          {!pricing && (
            <div className={cn('flex items-center justify-end gap-2 max-md:justify-start', pic ? 'mt-2 max-sm:mt-0' : '')}>
              {!['accounting', 'client'].includes(role) && <AddToProject job={job} />}
              {more}
            </div>
          )}
        </div>
      </div>
      {!pricing && setPart && <Track className="mt-4 max-sm:mt-3" parts={parts} at={part} onPick={setPart} />}
    </div>
  )
}

/* ---------------- footer: the one thing to do now ---------------- */
function ProjectFooter({ job, part }: { job: Job; part: PTab }) {
  const s = useStore()
  const prim = PRIMARY[job.stage]
  /* getting ready is done when the checklist is (the deposit is a warning, not a stop) */
  const left = job.stage === 'setup' || job.stage === 'verification' ? stepsFor(s, job).filter((v) => v.state !== 'done' && v.state !== 'na' && v.key !== 'deposit') : []
  const locked = left.length > 0
  const next = nextOn(s, job)
  const runPrimary = () => {
    if (job.stage === 'setup' || job.stage === 'verification') return verificationDone(job.id)
    if (job.stage === 'ready' || job.stage === 'scheduled') return startProject(job.id)
    if (job.stage === 'installation') return s.open({ t: 'daily', jobId: job.id })
    if (job.stage === 'punch') return s.open({ t: 'assign', jobId: job.id })
    if (job.stage === 'closeout') return s.open({ t: 'money', id: s.money.find((m) => m.jobId === job.id && m.kind === 'final')?.id || '' })
  }
  const viewer = ['client', 'crew'].includes(s.role)
  /* the one button: my next step here, or what this stage needs */
  const main = viewer ? null : next && (locked || !prim)
    ? (next.mine
      ? <Button variant="primary" className="max-w-[26rem] max-sm:max-w-none" icon={<ArrowRight />} onClick={() => openStep(job.id, next.v.key)}><span className="truncate">Your turn: {todoOf(next.v)}</span></Button>
      : <span className="inline-flex items-center gap-2 text-[0.84375rem] text-muted"><Avatar who={next.v.owner} size={22} />{PEOPLE[next.v.owner]?.short}’s turn — {todoOf(next.v)}</span>)
    : prim && !locked
      ? <Button variant="primary" icon={prim.icon} onClick={runPrimary}><span className="truncate">{prim.label}</span></Button>
      : null
  return (
    <>
      <span className="min-w-0 max-sm:hidden"><ProjectFoot job={job} part={part} /></span>
      <span className="ml-auto flex min-w-0 items-center gap-2 max-sm:w-full max-sm:[&>button]:w-full">{main}</span>
    </>
  )
}

/** the money, in its own window (from the board's Billed and paid) */
export function MoneyWinModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  return <Modal level={level} size="xl" tall onClose={s.close} title="Billed and paid" sub={job.name} bodyClass="bg-canvas p-5 max-sm:p-3"><MoneyTab job={job} /></Modal>
}

/** everything open on the project in its own window — Mine · Everyone · Done */
export function WhatsOpenModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  return <Modal level={level} size="lg" tall onClose={s.close} title="Open on this project" sub={job.name} bodyClass="bg-canvas p-4 max-sm:p-2"><WhatsOpen job={job} setTab={() => s.close()} /></Modal>
}
/** the scope of work and all the orders, each in its own window (from the ··· menu) */
export function ScopeWinModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  return <Modal level={level} size="xl" tall onClose={s.close} title="Scope of work" sub={job.name} bodyClass="bg-canvas p-5 max-sm:p-3"><ScopeTab job={job} /></Modal>
}
export function OrdersWinModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  return <Modal level={level} size="xl" tall onClose={s.close} title="All the orders" sub={job.name} bodyClass="bg-canvas p-5 max-sm:p-3"><POsTab job={job} onScope={() => { s.close(); s.open({ t: 'scopewin', jobId }) }} /></Modal>
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
