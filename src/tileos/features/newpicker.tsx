/* + New, and the colored option tiles other windows use */
import * as React from 'react'
import {
  FileText, Building2, ListTodo, CalendarPlus, Sparkles, Wrench, ContactRound, PackageCheck,
  MessageCircleQuestion, ArrowLeftRight, PackageX, Truck, Gavel, Phone, ClipboardList, Wallet, Search, ChevronRight, ChevronLeft,
} from 'lucide-react'
import { useStore, type Modal as M } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { STAGE_LABEL, type Stage } from '@/tileos/data/model'

export const TILE_COLORS = {
  blue: { solid: '#2f5bd8', tint: '#f0f4fe', line: '#d9e2f9' },
  violet: { solid: '#7357d6', tint: '#f5f2fe', line: '#e3dcf8' },
  indigo: { solid: '#4f55d0', tint: '#f1f1fd', line: '#dcddf7' },
  cyan: { solid: '#1586a8', tint: '#ecf7fa', line: '#cde8f0' },
  amber: { solid: '#d1870f', tint: '#fdf6e9', line: '#f3e2c0' },
  rose: { solid: '#d0456f', tint: '#fdf0f4', line: '#f5d6e0' },
  teal: { solid: '#15897a', tint: '#ebf7f5', line: '#cce9e4' },
  orange: { solid: '#d9631e', tint: '#fdf2eb', line: '#f5dac8' },
  red: { solid: '#cf3d2e', tint: '#fdf0ee', line: '#f4d3ce' },
  green: { solid: '#22894f', tint: '#edf7f1', line: '#cde9d8' },
  slate: { solid: '#5b6575', tint: '#f3f4f6', line: '#dfe2e7' },
} as const
export type TileColor = keyof typeof TILE_COLORS

/** one colored option — a solid icon on a soft tint of the same color */
export function ColorTile({ label, hint, icon: I, color, onClick, selected }: { label: string; hint?: string; icon: React.ElementType; color: TileColor; onClick: () => void; selected?: boolean }) {
  const c = TILE_COLORS[color]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('group flex min-h-[5.75rem] flex-col items-start gap-2 rounded-[0.8125rem] border p-3 text-left transition duration-150 hover:-translate-y-px hover:shadow-[0_0.5rem_1.125rem_-0.625rem_rgba(20,26,36,.28)] max-sm:min-h-0 max-sm:flex-row max-sm:items-center max-sm:gap-2.5 max-sm:p-2.5', selected && 'ring-2')}
      style={{ background: c.tint, borderColor: c.line, ...(selected ? ({ '--tw-ring-color': c.solid } as React.CSSProperties) : {}) }}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] text-white shadow-[0_0.125rem_0.375rem_-0.125rem_rgba(0,0,0,.28)] max-sm:h-8 max-sm:w-8" style={{ background: c.solid }}>
        <I className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.84375rem] font-semibold leading-tight text-ink max-sm:text-[0.8125rem]">{label}</span>
        {hint && <span className="mt-0.5 line-clamp-2 block text-[0.75rem] leading-snug text-[#5b6372] max-sm:hidden">{hint}</span>}
      </span>
    </button>
  )
}

type Pick = { l: string; h: string; i: React.ElementType; m: (jobId?: string) => M; hide?: boolean; company?: boolean }

/** the project a window is open on, or the project page — "New" starts on it */
function projectInView(s: ReturnType<typeof useStore.getState>) {
  const top = [...s.modals].reverse().find((m) => m.t === 'job' && m.id)
  return (top?.id as string | undefined) || (s.route.page === 'job' ? s.route.id : undefined)
}
const STAGE_RANK: Partial<Record<Stage, number>> = { installation: 0, scheduled: 1, punch: 2, ready: 3, verification: 4, setup: 5, awarded: 6, proposal: 7, followup: 7, estimating: 8, request: 9, closeout: 10, complete: 11 }

/* + New — first which project, then what to add to it, so everything lands on a project.
 * Opened from inside a project, it starts at the second step. New estimates, projects, repairs and clients start here too. */
export function NewPickerModal({ level, jobId: given }: { level: number; jobId?: string }) {
  const s = useStore()
  const acct = s.role === 'accounting'
  const here = given || projectInView(useStore.getState())
  /* undefined: still picking · '': not for a project · an id: that project */
  const [jobId, setJobId] = React.useState<string | undefined>(here && s.jobs[here] ? here : undefined)
  const [q, setQ] = React.useState('')
  const job = jobId ? s.jobs[jobId] : undefined
  const go = (m: M) => s.swap(m)

  const add: Pick[] = [
    { l: 'Task', h: 'Something someone has to do', i: ListTodo, m: (j) => ({ t: 'newtask', jobId: j }), company: true },
    { l: 'Meeting or walkthrough', h: 'A day and a time, on everyone’s agenda', i: CalendarPlus, m: (j) => ({ t: 'record', type: 'meeting', jobId: j }), hide: acct, company: true },
    { l: 'Purchase order', h: 'Materials from a supplier', i: PackageCheck, m: (j) => ({ t: 'newpo', jobId: j }), hide: acct },
    { l: 'Touch-ups', h: 'A punch list for a crew, with a due date', i: Sparkles, m: (j) => ({ t: 'punchnew', jobId: j }), hide: acct },
  ]
  const log: Pick[] = [
    { l: 'Daily update', h: 'What the crew tiled today', i: ClipboardList, m: (j) => ({ t: 'record', type: 'daily', jobId: j }), hide: acct },
    { l: 'Site issue or question', h: 'Something on site needs an answer', i: MessageCircleQuestion, m: (j) => ({ t: 'record', type: 'question', jobId: j }), hide: acct },
    { l: 'Client asked for a change', h: 'Height, tile, layout or extra work', i: ArrowLeftRight, m: (j) => ({ t: 'record', type: 'change', jobId: j }), hide: acct },
    { l: 'Short, wrong or damaged', h: 'The crew can’t finish with what’s there', i: PackageX, m: (j) => ({ t: 'record', type: 'shortage', jobId: j }), hide: acct },
    { l: 'Delivery arrived', h: 'Tile or materials landed on site', i: Truck, m: (j) => ({ t: 'record', type: 'delivery', jobId: j }), hide: acct },
    { l: 'Decision made', h: 'The designer, GC or client answered', i: Gavel, m: (j) => ({ t: 'record', type: 'decision', jobId: j }), hide: acct },
    { l: 'Call or follow-up', h: 'Spoke with someone, or no answer', i: Phone, m: (j) => ({ t: 'record', type: 'call', jobId: j }), company: true },
    { l: 'Payment received', h: 'A check or transfer came in', i: Wallet, m: (j) => ({ t: 'record', type: 'payment', jobId: j }) },
  ]
  const shown = (xs: Pick[]) => xs.filter((x) => !x.hide && (jobId !== '' || x.company))

  /* step 1 — which project */
  if (jobId === undefined) {
    const ql = q.trim().toLowerCase()
    const list = Object.values(s.jobs)
      .filter((j) => !ql || `${j.name} ${j.client} ${j.address}`.toLowerCase().includes(ql))
      .sort((a, b) => (STAGE_RANK[a.stage] ?? 12) - (STAGE_RANK[b.stage] ?? 12) || a.name.localeCompare(b.name))
    const starts = [
      { l: 'New estimate', i: FileText, m: { t: 'newreq' }, hide: acct },
      { l: 'New project', i: Building2, m: { t: 'newproject' }, hide: acct },
      { l: 'New repair', i: Wrench, m: { t: 'newrepair' }, hide: acct },
      { l: 'New client', i: ContactRound, m: { t: 'newclient' } },
    ].filter((x) => !x.hide)
    return (
      <Modal level={level} size="md" onClose={s.close} title="New" sub="Pick the project it’s for — or start something new.">
        <div className="grid grid-cols-4 gap-2 max-sm:grid-cols-2">
          {starts.map((x) => (
            <button key={x.l} onClick={() => go(x.m as M)} className="flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-3 text-left text-[0.84375rem] font-semibold text-ink transition hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-700 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-brand-600">
              <x.i />
              <span className="truncate">{x.l}</span>
            </button>
          ))}
        </div>
        <div className="mt-5 text-[0.78125rem] font-semibold text-muted">Or add to a project</div>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a project, client or address" aria-label="Find a project" className="h-10 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[0.875rem] text-ink outline-none transition placeholder:text-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
        </div>
        <div className="scroll-soft mt-2 max-h-[min(22rem,46vh)] overflow-y-auto rounded-xl border border-line">
          {list.map((j) => (
            <button key={j.id} onClick={() => { setJobId(j.id); setQ('') }} className="flex w-full items-center gap-3 border-b border-line-2 px-3.5 py-2.5 text-left transition last:border-0 hover:bg-[#f7f8fa]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">{j.name}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{[j.client, STAGE_LABEL[j.stage]].filter(Boolean).join(' · ')}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
            </button>
          ))}
          {!list.length && <div className="px-3.5 py-5 text-center text-[0.84375rem] text-muted">{Object.keys(s.jobs).length ? 'No project matches that.' : 'No projects yet — start with a new estimate or project above.'}</div>}
        </div>
        <button onClick={() => setJobId('')} className="mt-3 text-[0.8125rem] font-semibold text-brand-600 hover:underline">Not for a project — a company task, meeting or call</button>
      </Modal>
    )
  }

  /* step 2 — what to add to it */
  const Row = ({ x }: { x: Pick }) => (
    <button onClick={() => go(x.m(jobId || undefined))} className="group flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-left transition hover:border-brand-200 hover:bg-brand-50/40">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-wash-2 text-ink-2 transition group-hover:bg-white group-hover:text-brand-600 [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]"><x.i /></span>
      <span className="min-w-0">
        <span className="block truncate text-[0.875rem] font-semibold text-ink">{x.l}</span>
        <span className="block truncate text-[0.75rem] text-muted">{x.h}</span>
      </span>
    </button>
  )
  const Group = ({ label, items }: { label: string; items: Pick[] }) =>
    shown(items).length ? (
      <section>
        <div className="mb-2 text-[0.78125rem] font-semibold text-muted">{label}</div>
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">{shown(items).map((x) => <Row key={x.l} x={x} />)}</div>
      </section>
    ) : null
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={job ? `Add to ${job.name}` : 'Add — not for a project'}
      sub={job ? [job.client, STAGE_LABEL[job.stage]].filter(Boolean).join(' · ') : 'For the company, not one project'}
    >
      {!here && (
        <button onClick={() => setJobId(undefined)} className="-mt-1 mb-3 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-600 hover:underline"><ChevronLeft className="h-4 w-4" />Another project</button>
      )}
      <div className="flex flex-col gap-5">
        <Group label="Add" items={add} />
        <Group label="Log what happened" items={log} />
      </div>
    </Modal>
  )
}
