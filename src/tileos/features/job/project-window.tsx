/* The project window — the header on top (the project, the client and the address, the installer; then where it's up
 * to in a word and the one date that matters: "Getting ready — Starts Mon, Nov 23 · 15 days · 1 problem"), then the
 * project's parts one tab at a time (job/board): Where it stands · Scope of work · Layouts · Materials · Billing ·
 * People · Documents. The window is the same size on every tab — nothing grows or shrinks as you go. */
import * as React from 'react'
import { CalendarDays, Printer, HardHat, Play, ClipboardList, Receipt, ArrowRight, MoreHorizontal, Pencil, Trash2, MessageCircle, Lock, ListChecks } from 'lucide-react'
import { useStore, historyOf, meOf, type Store } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuSep, Pop } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { EstimatePaper } from '../estpaper'
import { printNode } from '@/tileos/lib/print'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { tileOf, floorsOf, roomPct } from '@/tileos/data/jobs'
import { IN_FIELD_STAGES } from '../steps'
import { readyForCrew, startProject } from '../flows'
import { installerOf } from '../upcoming'
import { MoneyTab } from './money-tab'
import { FilesTab, HistoryTab } from './files'
import { MaterialsTab } from './pos-tab'
import { PricingWorkspace } from '../pricing'
import { ScopeTab } from './scope-tab'
import { projectStatus } from '../statuses'
import { todoOf } from '../stepwin'
import { nextOn, WhatsOpen, AddToProject } from './plan'
import { ProjectBoard, RoomBody, viewFromTab, tabFromLink, trackOfStep, type BoardView, type BoardTab } from './board'
import { type OpenTrack } from './standing'
import { tracksFor, phaseOf, bookingOf, problemsOf, TRACKS, type TrackKey } from '../tracks'
import { pictureOf } from '../progressbill'
import { ScopeDoc, scopeRev } from './scopedoc'
import { md, dayShort, daysBetween, TODAY } from '@/tileos/lib/today'
import { typeOf, howFar, whenOf } from '../projectlist'
import { seesMoney } from './board'

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
const TAB_TRACK: Record<string, TrackKey> = { estimate: 'estimate', installer: 'installer', paperwork: 'tile', tile: 'tile', site: 'site', design: 'scope', delivery: 'delivery' }
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
    <Modal level={level} size="full" tall onClose={close} title={job.name} header={<ProjectHeader job={job} mode="modal" onChat={() => st.setView({ t: 'chat' })} onMoney={() => { st.setView(null); st.setTab('billing') }} />} bodyClass="p-0 overflow-hidden">
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
      <ProjectHeader job={job} mode="page" pricing={pricing} onChat={() => st.setView({ t: 'chat' })} onMoney={() => { st.setView(null); st.setTab('billing') }} />
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

/** where the project is, in a few words: the stage, the one thing that matters now (the day it starts, how far the
 *  installing is, the touch-ups left, the money at the end) and under it how far off that is */
function standsOf(s: Store, job: Job): { kicker: string; big: string; meta: string; late?: boolean; hold?: boolean } {
  const t = typeOf(job)
  const b = bookingOf(s, job)
  const cap = (x: string) => x.replace(/^./, (c) => c.toUpperCase())
  if (t === 'hold') return { kicker: 'On hold', big: job.hold?.shortage ? 'Waiting for the tile' : job.hold?.reason ? cap(job.hold.reason) : 'On hold', meta: '', hold: true }
  if (t === 'coming') {
    const iso = b?.start || s.prep[job.id]?.targetISO
    if (!iso) return { kicker: 'Getting ready', big: 'No start date yet', meta: '' }
    const n = daysBetween(TODAY, iso)
    const away = n > 1 ? `${n} days` : n === 1 ? 'Tomorrow' : n === 0 ? 'Today' : `${-n} ${n === -1 ? 'day' : 'days'} late`
    return { kicker: b ? 'Crew booked' : 'Getting ready', big: `Starts ${dayShort(iso)}`, meta: away, late: n < 0 && !b }
  }
  if (t === 'progress') {
    const end = b?.end
    return { kicker: 'Installing', big: `${job.pct ?? 0}% installed`, meta: end ? (end < TODAY ? `Was to end ${dayShort(end)}` : `Ends ${dayShort(end)}`) : job.dates?.finish ? `Ends ${job.dates.finish}` : '', late: !!end && end < TODAY }
  }
  if (t === 'touchups' || t === 'repairs') {
    const big = t === 'repairs' && !s.punch.some((p) => p.jobId === job.id) ? job.scope || 'Repair' : howFar(s, job).text
    return { kicker: t === 'repairs' ? 'Repair' : 'Touch-ups', big: cap(big), meta: whenOf(s, job).text }
  }
  const pic = pictureOf(s, job.id)
  return { kicker: 'Finished', big: pic.paidPct >= 100 ? 'Paid and closed' : pic.billedPct >= 100 ? 'Waiting to be paid' : 'Bill the rest', meta: seesMoney(s.role) ? `${pic.billedPct}% billed · ${pic.paidPct}% paid` : '' }
}

/** where it's up to, under the project's name — in words, the same on every tab: the stage, the date, the problems */
function StandsHead({ job }: { job: Job }) {
  const s = useStore()
  const w = standsOf(s, job)
  const n = problemsOf(s, job).length
  return (
    <div className="mt-3" data-stands-head>
      <div className={cn('text-[0.75rem] font-bold uppercase tracking-[0.08em]', w.hold ? 'text-bad-600' : 'text-muted')} data-stage-word>{w.kicker}</div>
      <div className="mt-0.5 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-display min-w-0 text-[1.5rem] font-semibold leading-tight tracking-[-0.015em] text-ink max-sm:text-[1.25rem]" data-stands-big>{w.big}</span>
        {(w.meta || n > 0) && (
          <span className="text-[0.9375rem] text-muted max-sm:text-[0.875rem]" data-stands-meta>
            {w.meta && <span className={w.late ? 'font-medium text-warn-700' : undefined}>{w.meta}</span>}
            {w.meta && n > 0 && ' · '}
            {n > 0 && <b className="font-semibold text-bad-600" data-stands-problems={n}>{n} {n === 1 ? 'problem' : 'problems'}</b>}
          </span>
        )}
      </div>
    </div>
  )
}

/** the header, the same as an estimate's: the name, the client and the address, the installer; on the right the
 *  conversation, + Add and ···. Under it where it's up to, in words. No money up here — it's in Billing. */
export function ProjectHeader({ job, mode, pricing, onChat, onMoney }: { job: Job; mode: 'modal' | 'page'; pricing?: boolean; onChat?: () => void; /** the contract opens the Billing tab */ onMoney?: () => void }) {
  const s = useStore()
  const role = s.role
  const status = headStatus(s, job)
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const me = meOf(role)
  const msgs = s.messages[job.id] || []
  const unread = msgs.slice(s.seen?.[`${job.id}|${me}`]?.n || 0).filter((m) => m.who !== me).length
  const canEdit = ['owner', 'pm', 'office', 'estimator'].includes(role)
  /* ··· holds only what changes the project itself — everything else is on the project, one tap away. The office
     says where it's up to straight out: the client, where it stands, who's on it — no going through its steps */
  const setsWhere = ['owner', 'pm', 'office'].includes(role)
  const more = (canEdit || ['owner', 'pm'].includes(role)) ? (
    <Menu align="end" width={240} trigger={<Button size="sm" aria-label="More for this project" icon={<MoreHorizontal />} />}>
      {setsWhere && <MenuItem icon={<ListChecks className="h-4 w-4" />} onSelect={() => s.open({ t: 'catchup', id: job.id })}>Update where it’s up to</MenuItem>}
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
        {pricing && <span className="min-w-0 shrink-0 max-sm:hidden">{statusChip}</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
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
      {pricing && <div className="mt-1.5 sm:hidden">{statusChip}</div>}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-muted max-sm:flex-col max-sm:items-start max-sm:gap-0 sm:[&>*+*]:before:mr-1.5 sm:[&>*+*]:before:content-['·']">
        <button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="truncate text-ink-2 hover:text-brand-700">{meta[0]}</button>
        {meta[1] && <span className="truncate">{meta[1]}</span>}
        {!pricing && (crew
          ? <button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} className="inline-flex items-center gap-1 hover:text-ink"><HardHat className="h-3.5 w-3.5 text-faint" /><span className="font-medium text-ink-2">{PEOPLE[crew].short}</span></button>
          : !['closeout', 'complete'].includes(job.stage) && <span className="inline-flex items-center gap-1"><HardHat className="h-3.5 w-3.5 text-faint" />No installer yet</span>)}
        {designer && <span className="truncate">Designer: <span className="font-medium text-ink-2">{designer.name}</span></span>}
      </div>
      {/* where it's up to, in words — no circles, nothing to decode */}
      {!pricing && onChat && <StandsHead job={job} />}
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
  return <Modal level={level} size="xl" tall onClose={s.close} title="Materials" sub={job.name} bodyClass="bg-canvas p-5 max-sm:p-3"><MaterialsTab job={job} onScope={() => { s.close(); s.open({ t: 'scopewin', jobId }) }} /></Modal>
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

/** one room in its own window — its walls and floors, the daily log, its photos. Close it, you're where you were */
export function RoomModal({ jobId, room, view, surface, level }: { jobId: string; room?: string; view?: any; surface?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const r = (s.rooms[jobId] || []).find((x) => x.name === room) || (s.rooms[jobId] || [])[0]
  if (!job || !r) return null
  const inField = IN_FIELD_STAGES.includes(job.stage)
  const n = r.surfaces.length
  const sf = r.surfaces.reduce((t, x) => t + (x.sf || 0), 0)
  return (
    <Modal level={level} size="lg" onClose={s.close} title={r.name} sub={[job.name, inField ? `${roomPct(r)}% installed` : `${n} ${n === 1 ? 'wall or floor' : 'walls and floors'}`, sf ? `${sf.toLocaleString('en-US')} SF` : ''].filter(Boolean).join(' · ')} bodyClass="bg-canvas p-0">
      <RoomBody job={job} name={r.name} tab={view === 'log' || view === 'photos' ? view : undefined} surface={surface} />
    </Modal>
  )
}

/* ================= a printable scope of work, in Cobblestone's document style (job/scopedoc) ================= */
export function ScopeDocModal({ jobId, estId, print, level }: { jobId: string; estId?: string; print?: boolean; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const doc = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { if (print) { const t = setTimeout(() => printNode(doc.current, `${s.jobs[jobId]?.name || ''} — Scope of work`), 350); return () => clearTimeout(t) } }, [print])
  const rooms = estId ? [] : s.rooms[jobId] || []
  const est = estId ? s.estimates.find((e) => e.id === estId) : s.estimates.find((e) => e.jobId === jobId && e.status === 'approved')
  if (!job) return null
  const fromEst = !rooms.length && est ? scopeRev(est) : undefined
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
          <Button className="ml-auto" variant="primary" icon={<Printer />} onClick={() => printNode(doc.current, `${job.name} — Scope of work`)}>Print</Button>
        </>
      }
    >
      <ScopeDoc jobId={jobId} estId={estId} innerRef={doc} />
    </Modal>
  )
}
