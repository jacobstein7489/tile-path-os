/* The project — one window that fills the screen, in two sides:
 *   Where it stands (left): getting ready as questions answered Yes, No or N/A — part by part, what's answered folds
 *     away — then the installing room by room, the touch-ups, what's billed and paid. The part it's in is open.
 *   Job details (right): what goes on this job, there at any time — the tile and grout, the rooms with what they're set
 *     on and their layouts, the people and the dates, the documents.
 * On a phone, one side at a time. Anything opened from there — a room, the conversation, a file, the scope of work —
 * opens in the same window, with Back on top. */
import * as React from 'react'
import { ChevronRight, FileText } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Button, Segmented } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { type Job } from '@/tileos/data/model'
import { tilesOf, GROUTS, roomPct } from '@/tileos/data/jobs'
import { surfacePct, SURF_LABEL } from '@/tileos/data/jobs'
import { SurfaceDetail } from './rooms'
import { Thread, ConvoHead } from '../messages'
import { DocPanel, PanelBar } from '../docview'
import { FilesTab, HistoryTab } from './files'
import { ScopeTab } from './scope-tab'
import { POsTab } from './pos-tab'
import { Standing, stageOf, IN_FIELD, type StageKey } from './standing'
import { Details } from './details'
import { readyGroups } from '../ready'

export type { StageKey }
/** something opened on the project: a room, the conversation, a file… */
export type BoardView = null | { t: 'room'; name: string } | { t: 'chat' } | { t: 'file'; id: string } | { t: 'files' } | { t: 'scope' } | { t: 'log' } | { t: 'orders' }

/** where the window opens — the part the project is in, or the part a link asks for */
export function defaultStages(s: Store, job: Job, tab?: string): StageKey[] {
  const t = tab === 'estimate' || tab === 'billing' || tab === 'money' ? 'money'
    : tab === 'touchups' || tab === 'punch' ? 'punch'
      : tab === 'install' || tab === 'rooms' || tab === 'installer' || tab === 'crew' ? 'install'
        : tab === 'ready' || tab === 'setup' || tab === 'checklist' || tab === 'orders' || tab === 'materials' || tab === 'pos' ? 'ready'
          : undefined
  const k = (t || stageOf(s, job)) as StageKey
  /* the money is only for whoever sees money */
  if (k === 'money' && ['site', 'crew'].includes(s.role)) return [IN_FIELD.includes(job.stage) ? 'install' : 'ready']
  return [k]
}
/** a link that opens something on the project right away (the scope of work) */
export const viewFromTab = (tab?: string): BoardView => (tab === 'scope' ? { t: 'scope' } : null)

/** the question a step is, on the checklist — for "Your turn" in the footer */
export function rowOfStep(s: Store, job: Job, k: string): string | undefined {
  const rows = readyGroups(s, job).flatMap((g) => g.rows)
  if (k === 'heights') return rows.find((r) => r.kind === 'site' && r.state !== 'done' && r.state !== 'na')?.id || rows.find((r) => r.kind === 'site')?.id
  return rows.find((r) => r.kind === 'step' && r.key === k)?.id
}

/** one room, open on the project: its walls and floors — tap one for its tile, grout, layout and photos */
function RoomOpen({ job, name, back }: { job: Job; name: string; back: () => void }) {
  const s = useStore()
  const r = (s.rooms[job.id] || []).find((x) => x.name === name)
  const [openSf, setOpenSf] = React.useState<string | null>(null)
  const inField = IN_FIELD.includes(job.stage)
  if (!r) return null
  const p = roomPct(r)
  const entries = (s.diary[job.id] || []).filter((e) => e.rooms.some((x) => x.room === r.name))
  return (
    <div data-panel>
      <PanelBar title={r.name} sub={inField ? `${p}% installed · ${r.surfaces.filter((x) => x.state === 'done').length} of ${r.surfaces.length} done` : `${r.surfaces.length} walls and floors`} onBack={back} back="Back to the project" right={entries.length ? <Button size="sm" variant="ghost" icon={<FileText />} onClick={() => s.open({ t: 'room', jobId: job.id, room: r.name, view: 'log' })}>Daily log · {entries.length}</Button> : undefined} />
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
      </div>
    </div>
  )
}


/* ---------------- something opened on the project, with Back on top ---------------- */
const FULL: string[] = ['chat', 'file']
function InPlace({ job, view, back, setView }: { job: Job; view: NonNullable<BoardView>; back: () => void; setView: (v: BoardView) => void }) {
  const backLabel = 'Back to the project'
  const page = (title: string, body: React.ReactNode, sub?: string) => (
    <div data-panel={view.t}>
      <PanelBar title={title} sub={sub} onBack={back} back={backLabel} />
      <div className="px-5 py-4 max-sm:px-3">{body}</div>
    </div>
  )
  switch (view.t) {
    case 'room': return <RoomOpen job={job} name={view.name} back={back} />
    case 'chat': return (
      <div className="flex h-full min-h-0 flex-col" data-panel="chat">
        <ConvoHead jobId={job.id} onBack={back} backLabel={backLabel} />
        <div className="min-h-0 flex-1"><Thread jobId={job.id} outside={useStore.getState().role === 'client'} /></div>
      </div>
    )
    case 'file': return <DocPanel jobId={job.id} fileId={view.id} onBack={back} back={backLabel} />
    case 'files': return page('Files and photos', <FilesTab job={job} />)
    case 'scope': return page('Scope of work', <ScopeTab job={job} />, 'every wall and floor — its tile, grout and layout')
    case 'log': return page('What happened', <HistoryTab job={job} />)
    case 'orders': return page('All the orders', <POsTab job={job} onScope={() => setView({ t: 'scope' })} />)
  }
}

/* ---------------- the body: where it stands on the left, the job's details on the right ---------------- */
export function ProjectBoard({ job, stages, setStages, focus, setFocus, view, setView }: {
  job: Job
  stages: StageKey[]
  setStages: (k: StageKey[]) => void
  focus: string | null
  setFocus: (id: string | null) => void
  view: BoardView
  setView: (v: BoardView) => void
}) {
  const [side, setSide] = React.useState<'stands' | 'details'>('stands')
  const top = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { top.current?.scrollTo?.({ top: 0 }) }, [view])
  /* "Your turn" on a phone: the question is on the left side */
  React.useEffect(() => { if (focus) setSide('stands') }, [focus])
  if (view) {
    const full = FULL.includes(view.t)
    return <div ref={top} className={cn('h-full min-h-0 min-w-0 bg-[#f7f5f1]', full ? 'flex flex-col max-lg:h-[78dvh]' : 'scroll-soft overflow-y-auto')} data-board-main><InPlace job={job} view={view} back={() => setView(null)} setView={setView} /></div>
  }
  const title = 'text-[0.75rem] font-bold uppercase tracking-[0.06em] text-muted'
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line bg-white px-4 py-2 lg:hidden">
        <Segmented value={side} onChange={setSide} items={[{ key: 'stands', label: 'Where it stands' }, { key: 'details', label: 'Job details' }]} className="w-full [&>button]:flex-1" />
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)]">
        <div data-side="stands" className={cn('scroll-soft min-h-0 min-w-0 bg-[#f4f1ec] px-5 pb-6 pt-4 max-sm:px-2.5 lg:overflow-y-auto lg:border-r lg:border-line', side !== 'stands' && 'max-lg:hidden')}>
          <h3 className={cn(title, 'mb-2.5 px-0.5 max-lg:hidden')}>Where it stands</h3>
          <Standing job={job} open={stages} setOpen={setStages} focus={focus} setFocus={setFocus} onRoom={(name) => setView({ t: 'room', name })} />
        </div>
        <div data-side="details" className={cn('scroll-soft min-h-0 min-w-0 bg-white lg:overflow-y-auto', side !== 'details' && 'max-lg:hidden')}>
          <h3 className={cn(title, 'px-5 pt-4 max-sm:px-4 max-lg:hidden')}>Job details</h3>
          <Details job={job} open={setView} />
        </div>
      </div>
    </div>
  )
}

/** a desktop-sized window */
export function useWide() {
  const [wide, setWide] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true))
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const f = () => setWide(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return wide
}
