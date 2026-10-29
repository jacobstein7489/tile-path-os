/* The project — one window that fills the screen, the same shape as the estimate:
 *   on top (in the header) the line, like the estimate's path — Approved · Getting ready · Crew scheduled · Installing ·
 *     Touch-ups · Closed;
 *   under it the project's parts, one tab at a time: Where it stands (getting ready, part by part) · Scope of work (like
 *     the estimate's paper, with its change orders) · Materials (the tile, our materials and metal edges, what's ordered
 *     and here) · Billing · People (the installer and his PO too) · Documents.
 * A room, the conversation, a file open in the same window, with Back on top. On a phone, one side at a time. */
import * as React from 'react'
import { PrintSheetsButton } from '../roomsheets'
import { ChevronRight } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Segmented, UnderlineTabs } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { type Job } from '@/tileos/data/model'
import { tilesOf, GROUTS, roomPct } from '@/tileos/data/jobs'
import { surfacePct, SURF_LABEL } from '@/tileos/data/jobs'
import { SurfaceDetail } from './rooms'
import { Thread, ConvoHead } from '../messages'
import { RoomDiary, RoomPhotos, roomMedia } from '../field'
import { DocPanel, PanelBar } from '../docview'
import { FilesTab, HistoryTab } from './files'
import { ScopeTab } from './scope-tab'
import { MaterialsTab } from './pos-tab'
import { MoneyTab } from './money-tab'
import { Stands, type OpenTrack } from './standing'
import { JobPart, type JobTab } from './details'
import { IN_FIELD_STAGES, stepsFor } from '../steps'
import { tracksFor } from '../tracks'

/** something opened on the project: a room, the conversation, a file, the money… */
export type BoardView = null | { t: 'room'; name: string; tab?: RoomTab; /** a wall or floor to open right away */ surface?: string } | { t: 'chat' } | { t: 'file'; id: string } | { t: 'doc'; doc: string } | { t: 'files' } | { t: 'scope' } | { t: 'log' } | { t: 'orders' } | { t: 'money' }

/** a link that opens something on the project right away (what happened, every wall and floor) */
export const viewFromTab = (tab?: string): BoardView => (tab === 'history' || tab === 'log' ? { t: 'log' } : tab === 'walls' ? { t: 'scope' } : null)

/** the track a step is on, opened on that step — for "Your turn", Today and a missing paper on the job side */
export function trackOfStep(s: Store, job: Job, k: string): OpenTrack {
  const t = tracksFor(s, job, stepsFor(s, job)).find((x) => x.steps.some((v) => v.key === k))
  return t ? { track: t.key, step: k } : null
}

/** what a room shows when it's open: its walls and floors, the crew's daily log for it, its photos */
export type RoomTab = 'surfaces' | 'log' | 'photos'
/** one room, open on the project, with Back on top: its walls and floors (tap one for its tile, grout and layout), the
 *  daily log for this room, and its photos — one at a time */
function RoomOpen({ job, name, tab: tab0, surface, back }: { job: Job; name: string; tab?: RoomTab; surface?: string; back: () => void }) {
  const s = useStore()
  const r = (s.rooms[job.id] || []).find((x) => x.name === name)
  const [openSf, setOpenSf] = React.useState<string | null>(surface || null)
  const [tab, setTab] = React.useState<RoomTab>(tab0 || 'surfaces')
  const inField = IN_FIELD_STAGES.includes(job.stage)
  /* opened on one wall or floor: it's in view */
  React.useEffect(() => {
    if (!surface) return
    try { document.querySelector(`[data-room-open="${CSS.escape(name)}"] [data-surface="${CSS.escape(surface)}"]`)?.scrollIntoView({ block: 'nearest' }) } catch { /* old browser */ }
  }, [])
  if (!r) return null
  const p = roomPct(r)
  const entries = (s.diary[job.id] || []).filter((e) => e.rooms.some((x) => x.room === r.name))
  const media = roomMedia(s.diary[job.id], r.name)
  return (
    <div data-panel="room" data-room-open={r.name}>
      <PanelBar title={r.name} sub={inField ? `${p}% installed · ${r.surfaces.filter((x) => x.state === 'done').length} of ${r.surfaces.length} done` : `${r.surfaces.length} ${r.surfaces.length === 1 ? 'wall or floor' : 'walls and floors'}`} onBack={back} back="Back to the project" />
      <div className="px-5 pt-3 max-sm:px-3">
        <Segmented value={tab} onChange={setTab} className="w-full [&>button]:flex-1" items={[
          { key: 'surfaces', label: 'Walls and floors' },
          { key: 'log', label: <>Daily log<span className="ml-1 font-medium text-muted">{entries.length || ''}</span></> },
          { key: 'photos', label: <>Photos<span className="ml-1 font-medium text-muted">{media.length || ''}</span></> },
        ]} />
      </div>
      {tab === 'log' ? <RoomDiary job={job} room={r} /> : tab === 'photos' ? <RoomPhotos job={job} room={r} /> : (
        <div className="px-5 py-4 max-sm:px-3">
          <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
            {r.surfaces.map((x) => {
              const tile = tilesOf(job.id).find((t) => t.tag === x.tile)
              const g = x.grout || tile?.grout
              const on = openSf === x.name
              const waiting = ['blocked', 'waitmat', 'hold', 'unknown'].includes(x.state)
              return (
                <div key={x.name} className="border-b border-line-2 last:border-b-0">
                  <button data-surface={x.name} onClick={() => setOpenSf(on ? null : x.name)} aria-expanded={on} className={cn('flex w-full items-center gap-3 px-5 py-2.5 text-left transition hover:bg-[#f6f3ee]', on && 'bg-[#f6f3ee]')}>
                    <TileImg tile={tile} size={34} radius={8} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.90625rem] font-semibold text-ink">{x.name}<span className="font-normal text-muted"> · {tile ? `${x.tile} ${tile.name}` : x.tile || 'no tile yet'}{g ? ` · ${GROUTS[g]?.name || g} grout` : ''}</span></span>
                      <span className={cn('block truncate text-[0.78125rem]', waiting ? 'font-medium text-bad-600' : x.state === 'working' ? 'text-brand-700' : x.state === 'done' ? 'text-[#2c8a5b]' : 'text-muted')}>{x.state === 'working' ? `In progress · ${surfacePct(x)}%` : SURF_LABEL[x.state]}{x.reason ? ` — ${x.reason}` : ''}{x.sf ? ` · ${x.sf} SF` : ''}</span>
                    </span>
                    <ChevronRight className={cn('h-4 w-4 shrink-0 text-faint transition', on && 'rotate-90')} />
                  </button>
                  {on && <div className="border-t border-line-2 bg-white"><SurfaceDetail job={job} room={r} sf={x} /></div>}
                </div>
              )
            })}
          </div>
          {r.surfaces.some((x) => x.tile) && <div className="mt-3 flex justify-end"><PrintSheetsButton job={job} room={r.name} size="sm" variant="ghost" /></div>}
        </div>
      )}
    </div>
  )
}


/* ---------------- something opened on the project, with Back on top ---------------- */
const FULL: string[] = ['chat', 'file', 'doc']
function InPlace({ job, view, back, setView }: { job: Job; view: NonNullable<BoardView>; back: () => void; setView: (v: BoardView) => void }) {
  const backLabel = 'Back to the project'
  const page = (title: string, body: React.ReactNode, sub?: string) => (
    <div data-panel={view.t}>
      <PanelBar title={title} sub={sub} onBack={back} back={backLabel} />
      <div className="px-5 py-4 max-sm:px-3">{body}</div>
    </div>
  )
  switch (view.t) {
    case 'room': return <RoomOpen key={`${view.name}|${view.surface || ''}`} job={job} name={view.name} tab={view.tab} surface={view.surface} back={back} />
    case 'chat': return (
      <div className="flex h-full min-h-0 flex-col" data-panel="chat">
        <ConvoHead jobId={job.id} onBack={back} backLabel={backLabel} />
        <div className="min-h-0 flex-1"><Thread jobId={job.id} outside={useStore.getState().role === 'client'} /></div>
      </div>
    )
    case 'file': return <DocPanel jobId={job.id} fileId={view.id} onBack={back} back={backLabel} />
    case 'doc': return <DocPanel jobId={job.id} doc={view.doc} onBack={back} back={backLabel} />
    case 'files': return page('Files and photos', <FilesTab job={job} />)
    case 'scope': return page('Scope of work', <ScopeTab job={job} />, 'every wall and floor — its tile, grout and layout')
    case 'log': return page('What happened', <HistoryTab job={job} />)
    case 'orders': return page('Materials', <MaterialsTab job={job} onScope={() => setView({ t: 'scope' })} />)
    case 'money': return page('Billing', <MoneyTab job={job} />, 'alongside the job the whole time — billed, paid, the changes')
  }
}

/* ---------------- the body: what's going on now on the left, the job on the right ---------------- */
/** the project's parts, one at a time, each the full width: Where it stands (what's next, getting ready, the open
 *  issues) · Scope of work · Tiles · People · Documents. It opens on Where it stands. */
export type BoardTab = 'stands' | 'materials' | 'billing' | JobTab
const LINK_TAB: Record<string, BoardTab> = {
  scope: 'scope', rooms: 'scope', tiles: 'materials', materials: 'materials', orders: 'materials', pos: 'materials', deliveries: 'materials',
  money: 'billing', billing: 'billing', estimate: 'billing', people: 'people', files: 'files', docs: 'files', documents: 'files',
}
/** who sees the money — billing is its own tab, never on top of the work */
export const seesMoney = (role: string) => !['site', 'crew', 'client'].includes(role)
export const tabFromLink = (tab?: string, role: string = useStore.getState().role): BoardTab => {
  const t = (tab && LINK_TAB[tab]) || 'stands'
  return t === 'billing' && !seesMoney(role) ? 'stands' : t
}

export function ProjectBoard({ job, open, setOpen, view, setView, onStep, tab, setTab }: {
  job: Job
  /** the track (and its step) open on Where it stands */
  open: OpenTrack
  setOpen: (o: OpenTrack) => void
  view: BoardView
  setView: (v: BoardView) => void
  /** open a step on its track (a missing paper on the job side → the step that gets it) */
  onStep?: (k: string) => void
  tab: BoardTab
  setTab: (t: BoardTab) => void
}) {
  const s = useStore()
  const top = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { top.current?.scrollTo?.({ top: 0 }) }, [view, tab])
  if (view) {
    const full = FULL.includes(view.t)
    return <div className={cn('h-full min-h-0 min-w-0 bg-[#f7f5f1]', full ? 'flex flex-col max-lg:h-[78dvh]' : 'scroll-soft overflow-y-auto')} data-board-main><InPlace job={job} view={view} back={() => setView(null)} setView={setView} /></div>
  }
  const money = seesMoney(s.role)
  const at: BoardTab = tab === 'billing' && !money ? 'stands' : tab
  const pick = (t: BoardTab) => { setTab(t); if (t !== 'stands') setOpen(null) }
  const sheet = (body: React.ReactNode) => <div data-side="job" className="mx-auto w-full max-w-[96rem] px-5 pb-8 pt-4 max-sm:px-3">{body}</div>
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* the project's parts — plain words, no counts on them */}
      <UnderlineTabs<BoardTab>
        value={at}
        onChange={pick}
        size="lg"
        className="shrink-0 bg-white px-5 max-sm:px-4 max-sm:[&>button+button]:ml-5"
        items={[
          { key: 'stands', label: 'Where it stands', short: 'Status' },
          { key: 'scope', label: 'Scope of work', short: 'Scope' },
          { key: 'materials', label: 'Materials' },
          ...(money ? [{ key: 'billing' as BoardTab, label: 'Billing' }] : []),
          { key: 'people', label: 'People' },
          { key: 'files', label: 'Documents', short: 'Docs' },
        ]}
      />
      <div ref={top} data-board-tab={at} className={cn('scroll-soft min-h-0 flex-1 overflow-y-auto', at === 'stands' ? 'bg-[#f4f1ec] lg:overflow-hidden' : 'bg-[#f7f5f1]')}>
        {at === 'stands'
          ? <div data-side="stands" className="mx-auto w-full max-w-[96rem] px-5 pb-6 pt-4 max-sm:px-2.5 lg:h-full lg:pb-0"><Stands job={job} open={open} setOpen={setOpen} onStep={onStep || (() => {})} setView={setView} /></div>
          : at === 'materials' ? sheet(<MaterialsTab job={job} onScope={() => setTab('scope')} />)
            : at === 'billing' ? sheet(<MoneyTab job={job} />)
              : <div data-side="job" className="mx-auto w-full max-w-[96rem]"><JobPart job={job} tab={at} open={setView} onStep={onStep} /></div>}
      </div>
    </div>
  )
}
