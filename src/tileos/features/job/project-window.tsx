/* The project window — the line on top (where the project is, like the estimate's path, with the billing alongside),
 * then two sides (job/board): what's going on now on the left (getting ready's five tracks and the open issues; once
 * the crew is in, the issues, changes, more tile and touch-ups), the job's details on the right (the scope of work —
 * every room and where it is — the tiles, the people, the documents).
 *   header: the project, where it stands in one word, the client and the address, the installer and the dates; on the
 *           right the conversation, + Add, and ··· (its details, delete). Under it the line and the billing.
 *   footer: the one thing to do now — your turn on a track, or what the project needs (schedule the crew, start it,
 *           the daily update…). The crew can't be scheduled until getting ready is done. */
import * as React from 'react'
import { CalendarDays, Printer, HardHat, Play, ClipboardList, Receipt, ArrowRight, MoreHorizontal, Pencil, Trash2, MessageCircle, Lock } from 'lucide-react'
import { useStore, historyOf, meOf, type Store } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuSep, Pop } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { EstimatePaper } from '../estpaper'
import { printNode } from '@/tileos/lib/print'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { tileOf, floorsOf } from '@/tileos/data/jobs'
import { readyForCrew, startProject } from '../flows'
import { installerOf } from '../upcoming'
import { MoneyTab } from './money-tab'
import { FilesTab, HistoryTab } from './files'
import { POsTab } from './pos-tab'
import { PricingWorkspace } from '../pricing'
import { RoomsTab } from './rooms'
import { ScopeTab } from './scope-tab'
import { projectStatus } from '../statuses'
import { todoOf } from '../stepwin'
import { nextOn, WhatsOpen, AddToProject } from './plan'
import { ProjectBoard, viewFromTab, tabFromLink, trackOfStep, type BoardView, type BoardTab } from './board'
import { ProjectLine, BillingStrip, type OpenTrack } from './standing'
import { tracksFor, phaseOf, bookingOf, TRACKS, type TrackKey } from '../tracks'
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

/** a link that names a track ("installer", "orders"…) opens that track on the step it's on */
const TAB_TRACK: Record<string, TrackKey> = { installer: 'installer', orders: 'materials', materials: 'materials', pos: 'materials', paperwork: 'tile', tile: 'tile', site: 'site', design: 'scope' }
function openFromTab(job: Job | undefined, tab?: string): OpenTrack {
  if (!job || !tab) return null
  const s = useStore.getState()
  if (tab.startsWith('step:')) return trackOfStep(s, job, tab.slice(5))
  const k = TAB_TRACK[tab]
  if (!k || !['awarded', 'setup', 'verification', 'ready', 'scheduled'].includes(job.stage)) return null
  const t = tracksFor(s, job).find((x) => x.key === k)
  return t && t.state !== 'done' && t.lead ? { track: k, step: t.lead.key } : null
}

/** the window's state: the track (and step) open on the left, and what's open in place */
function useProjectState(job: Job | undefined, initial?: string) {
  const [open, setOpen] = React.useState<OpenTrack>(() => openFromTab(job, initial))
  const [view, setView] = React.useState<BoardView>(() => (initial?.startsWith('step:') ? null : viewFromTab(initial)))
  /* it opens on Where it stands — or on the part a link names (its tiles, people, documents) */
  const [tab, setTab] = React.useState<BoardTab>(() => tabFromLink(initial))
  /* "Your turn", Today, a missing paper: its track opens on that step */
  const onStep = (k: string) => {
    if (!job) return
    const o = (TRACKS.some((t) => t.key === k) ? openFromTab(job, Object.keys(TAB_TRACK).find((x) => TAB_TRACK[x] === k)) : null) || trackOfStep(useStore.getState(), job, k)
    if (!o) return
    setView(null)
    setTab('stands')
    setOpen(o)
  }
  return { open, setOpen, view, setView, onStep, tab, setTab }
}

/* ================= the window ================= */
export function ProjectWindow({ id, tab: initial, level }: { id: string; tab?: string; level: number }) {
  const job = useStore((s) => s.jobs[id])
  const close = useStore((s) => s.close)
  const pricing = job && ['request', 'estimating', 'proposal', 'followup'].includes(job.stage)
  const st = useProjectState(job, initial)
  if (!job) return null
  if (pricing) {
    return (
      <Modal level={level} size="xl" tall onClose={close} title={job.name} header={<ProjectHeader job={job} mode="modal" pricing />} bodyClass="p-0">
        <div className="p-6"><PricingWorkspace job={job} /></div>
      </Modal>
    )
  }
  return (
    <Modal level={level} size="full" tall onClose={close} title={job.name} header={<ProjectHeader job={job} mode="modal" onChat={() => st.setView({ t: 'chat' })} onMoney={() => st.setView({ t: 'money' })} />} bodyClass="p-0 overflow-hidden">
      <ProjectBoard job={job} open={st.open} setOpen={st.setOpen} view={st.view} setView={st.setView} onStep={st.onStep} tab={st.tab} setTab={st.setTab} />
    </Modal>
  )
}

/** the same project as a page (Open full page) */
export function ProjectPage({ job, tab: initial }: { job: Job; tab?: string }) {
  const st = useProjectState(job, initial)
  const pricing = ['request', 'estimating', 'proposal', 'followup'].includes(job.stage)
  return (
    <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white shadow-card">
      <ProjectHeader job={job} mode="page" pricing={pricing} onChat={() => st.setView({ t: 'chat' })} onMoney={() => st.setView({ t: 'money' })} />
      {pricing ? <div className="p-6"><PricingWorkspace job={job} /></div> : (
        <>
          <div className="h-[min(48rem,calc(100dvh-14rem))] min-h-[24rem]"><ProjectBoard job={job} open={st.open} setOpen={st.setOpen} view={st.view} setView={st.setView} onStep={st.onStep} tab={st.tab} setTab={st.setTab} /></div>
        </>
      )}
    </div>
  )
}

/* ---------------- header ---------------- */
/** where the project stands, in one plain bubble (red only when it's on hold) — the same words as the Projects list */
function headStatus(s: Store, job: Job): { tone: Tone; label: string; onClick?: () => void } {
  const st = projectStatus(s, job)
  if (st.key === 'hold') return { tone: 'bad', label: `On hold · ${(job.hold?.reason || '').replace(/^Waiting for /, 'waiting for ')}`, onClick: job.hold?.shortage ? () => s.open({ t: 'short', id: job.hold!.shortage! }) : undefined }
  return { tone: st.tone, label: st.label }
}

/** the header, the same as an estimate's: the name and where it stands, the client and the address, the installer and
 *  the dates; on the right the contract (for whoever sees money), the conversation, + Add and ··· */
export function ProjectHeader({ job, mode, pricing, onChat, onMoney }: { job: Job; mode: 'modal' | 'page'; pricing?: boolean; onChat?: () => void; /** the billing strip opens the money in place */ onMoney?: () => void }) {
  const s = useStore()
  const role = s.role
  const status = headStatus(s, job)
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const me = meOf(role)
  const msgs = s.messages[job.id] || []
  const unread = msgs.slice(s.seen?.[`${job.id}|${me}`]?.n || 0).filter((m) => m.who !== me).length
  const money = !['site', 'crew'].includes(role)
  const pic = money && !pricing ? pictureOf(s, job.id) : null
  const canEdit = ['owner', 'pm', 'office', 'estimator'].includes(role)
  const dates = job.dates?.start ? `${job.dates.start} – ${job.dates.finish || '…'}` : (() => { const b = s.bookings.find((x) => x.jobId === job.id); return b ? `${md(b.start)} – ${md(b.end)}` : '' })()
  /* ··· holds only what changes the project itself — everything else is on the project, one tap away */
  const more = (canEdit || ['owner', 'pm'].includes(role)) ? (
    <Menu align="end" width={240} trigger={<Button size="sm" aria-label="More for this project" icon={<MoreHorizontal />} />}>
      {canEdit && <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => s.open({ t: 'editproject', id: job.id })}>Change the project’s details</MenuItem>}
      {['owner', 'pm'].includes(role) && <><MenuSep /><MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => s.open({ t: 'delete', kind: 'job', id: job.id })}>Delete this project…</MenuItem></>}
    </Menu>
  ) : null
  const meta = [job.client, job.address].filter(Boolean)
  const designer = s.designers.find((d) => d.clients.includes(job.clientId))
  const statusChip = status.onClick
    ? <button onClick={status.onClick} className="min-w-0"><Status tone={status.tone} plain={status.tone !== 'bad'}>{status.label}</Status></button>
    : <Status tone={status.tone} plain={status.tone !== 'bad'} className="min-w-0">{status.label}</Status>
  return (
    <div className={cn('relative border-b border-line bg-white px-5 pb-3 pt-3 max-sm:px-4 max-sm:pt-3', mode === 'modal' && 'pr-14 max-sm:pr-14')}>
      {/* the name and where it stands — on the right the contract and the two buttons */}
      <div className="flex min-w-0 items-center gap-2.5">
        <h2 className="font-display min-w-0 truncate text-[1.25rem] font-semibold leading-tight tracking-[-0.012em] text-ink max-sm:text-[1.125rem]">{job.name}</h2>
        {(pricing || status.tone === 'bad') && <span className="min-w-0 shrink-0 max-sm:hidden">{statusChip}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {pic && pic.contract > 0 && <span className="text-[0.8125rem] text-muted max-md:hidden"><b className="text-[0.9375rem] font-semibold tnum text-ink">{fmtMoney(pic.contract + pic.changes)}</b> contract{pic.billed > 0 ? <> · <span className="tnum">{fmtMoney(pic.paid)}</span> paid</> : ''}</span>}
          {!pricing && onChat && (
            <Button size="sm" icon={<MessageCircle />} onClick={onChat} aria-label={`Messages${unread ? ` — ${unread} new` : ''}`} className="relative max-sm:w-9 max-sm:px-0 max-sm:[&>span]:hidden">
              <span>Messages</span>
              {unread > 0 && <span className="absolute -right-1.5 -top-1.5 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-bad-500 px-1 text-[0.6875rem] font-bold text-white ring-2 ring-white">{unread}</span>}
            </Button>
          )}
          {!pricing && !['accounting', 'client'].includes(role) && <AddToProject job={job} />}
          {!pricing && more}
        </span>
      </div>
      {/* who it's for, where, who installs it and when */}
      {(pricing || status.tone === 'bad') && <div className="mt-1.5 sm:hidden">{statusChip}</div>}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-muted max-sm:flex-col max-sm:items-start max-sm:gap-0 sm:[&>*+*]:before:mr-1.5 sm:[&>*+*]:before:content-['·']">
        <button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="truncate text-ink-2 hover:text-brand-700">{meta[0]}</button>
        {meta[1] && <span className="truncate">{meta[1]}</span>}
        {!pricing && (crew
          ? <button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} className="inline-flex items-center gap-1 hover:text-ink"><HardHat className="h-3.5 w-3.5 text-faint" /><span className="font-medium text-ink-2">{PEOPLE[crew].short}</span>{dates && <span>· {dates}</span>}</button>
          : !['closeout', 'complete'].includes(job.stage) && <span className="inline-flex items-center gap-1"><HardHat className="h-3.5 w-3.5 text-faint" />No installer yet</span>)}
        {designer && <span className="truncate">Designer: <span className="font-medium text-ink-2">{designer.name}</span></span>}
        {pic && pic.contract > 0 && <span className="md:hidden">{fmtMoney(pic.contract + pic.changes)}</span>}
      </div>
      {/* where it is, like the estimate's path — and the billing alongside it, never in the way */}
      {!pricing && onMoney && <><ProjectLine className="mt-3" job={job} /><BillingStrip className="mt-2" job={job} onOpen={onMoney} /></>}
    </div>
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
