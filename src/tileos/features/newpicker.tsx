/* + New (what to add, for which project — only what fits your login), and the colored option tiles other windows use */
import * as React from 'react'
import {
  FileText, Building2, ListTodo, CalendarPlus, Sparkles, Wrench, ContactRound, PackageCheck,
  MessageCircleQuestion, ArrowLeftRight, PackageX, Truck, Gavel, Phone, ClipboardList, Wallet, StickyNote, TriangleAlert,
} from 'lucide-react'
import { useStore, type Modal as M } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { STAGE_LABEL, type Stage, type Role } from '@/tileos/data/model'
import { SearchSelect } from '@/tileos/components/ui/select'

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
  slate: { solid: '#5b6575', tint: '#f1eee8', line: '#dfe2e7' },
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

/** who each option is for — a login sees only what fits its job (the site manager doesn't make POs or take payments;
 *  the books don't log site issues or decisions) */
const FOR: Record<string, Role[]> = {
  task: ['owner', 'pm', 'office', 'takeoff', 'estimator', 'site', 'materials', 'accounting'],
  meeting: ['owner', 'pm', 'office', 'takeoff', 'estimator', 'site', 'materials'],
  po: ['owner', 'pm', 'office', 'estimator', 'materials'],
  punch: ['owner', 'pm', 'office', 'site'],
  daily: ['owner', 'pm', 'office', 'site'],
  question: ['owner', 'pm', 'office', 'site', 'estimator'],
  change: ['owner', 'pm', 'office', 'site', 'estimator'],
  shortage: ['owner', 'pm', 'office', 'site', 'materials'],
  delivery: ['owner', 'pm', 'office', 'site', 'materials'],
  decision: ['owner', 'pm', 'office', 'site', 'estimator', 'takeoff'],
  call: ['owner', 'pm', 'office', 'takeoff', 'estimator', 'site', 'materials', 'accounting'],
  problem: ['owner', 'pm', 'office', 'site', 'materials', 'estimator'],
  payment: ['owner', 'office', 'accounting'],
  newreq: ['owner', 'pm', 'office', 'takeoff', 'estimator'],
  newproject: ['owner', 'pm', 'office'],
  newrepair: ['owner', 'pm', 'office'],
  newclient: ['owner', 'pm', 'office', 'estimator', 'accounting'],
}
export const allowedFor = (role: Role, key: string) => !FOR[key] || FOR[key].includes(role)

type Pick = { k: string; l: string; h: string; i: React.ElementType; m: (jobId?: string) => M; job?: boolean }

/** the project a window is open on, or the project page — "New" starts on it */
function projectInView(s: ReturnType<typeof useStore.getState>) {
  const top = [...s.modals].reverse().find((m) => m.t === 'job' && m.id)
  return (top?.id as string | undefined) || (s.route.page === 'job' ? s.route.id : undefined)
}
const STAGE_RANK: Partial<Record<Stage, number>> = { installation: 0, scheduled: 1, punch: 2, ready: 3, verification: 4, setup: 5, awarded: 6, proposal: 7, followup: 7, estimating: 8, request: 9, closeout: 10, complete: 11 }

/* + New — everything your login adds, in color, all on one screen (no "More"): the project on top (the one you're in,
 * or pick one), then what goes on the job site, then the paperwork, then starting something new. What your login adds
 * most comes first in each. */
type Group = 'site' | 'office'
const ADD: (Pick & { c: TileColor; g: Group })[] = [
  { k: 'need', l: 'Need something on site', h: 'Material or a tool — brought to the job, on someone’s list until it’s dropped off', i: Truck, c: 'orange', g: 'site', m: (j) => ({ t: 'need', jobId: j }) },
  { k: 'problem', l: 'Problem', h: 'Tile broken, wrong or missing · site not ready', i: TriangleAlert, c: 'red', g: 'site', job: true, m: (j) => ({ t: 'problem', jobId: j! }) },
  { k: 'punch', l: 'Touch-ups', h: 'A list for the crew, with photos', i: Sparkles, c: 'violet', g: 'site', m: (j) => ({ t: 'punchnew', jobId: j }) },
  { k: 'daily', l: 'Daily update', h: 'What the crew tiled today', i: ClipboardList, c: 'blue', g: 'site', m: (j) => ({ t: 'record', type: 'daily', jobId: j }) },
  { k: 'delivery', l: 'Delivery arrived', h: 'Tile or materials landed on site', i: PackageCheck, c: 'teal', g: 'site', m: (j) => ({ t: 'record', type: 'delivery', jobId: j }) },
  { k: 'shortage', l: 'Damaged or wrong', h: 'Tile or material that came broken, wrong or short', i: PackageX, c: 'rose', g: 'site', m: (j) => ({ t: 'record', type: 'shortage', jobId: j }) },
  { k: 'question', l: 'Site issue or question', h: 'Something on site needs an answer', i: MessageCircleQuestion, c: 'amber', g: 'site', m: (j) => ({ t: 'record', type: 'question', jobId: j }) },
  { k: 'task', l: 'Task', h: 'Something someone has to do', i: ListTodo, c: 'blue', g: 'office', m: (j) => ({ t: 'newtask', jobId: j }) },
  { k: 'note', l: 'Note', h: 'A call, a decision — anything to remember', i: StickyNote, c: 'amber', g: 'office', job: true, m: (j) => ({ t: 'note', jobId: j! }) },
  { k: 'meeting', l: 'Meeting or walkthrough', h: 'A day, a time, who’s in it', i: CalendarPlus, c: 'indigo', g: 'office', m: (j) => ({ t: 'record', type: 'meeting', jobId: j }) },
  { k: 'po', l: 'Purchase order', h: 'Materials from a supplier', i: FileText, c: 'cyan', g: 'office', m: (j) => ({ t: 'newpo', jobId: j }) },
  { k: 'change', l: 'Client asked for a change', h: 'Height, tile, layout or extra work', i: ArrowLeftRight, c: 'violet', g: 'office', m: (j) => ({ t: 'record', type: 'change', jobId: j }) },
  { k: 'decision', l: 'Decision made', h: 'The designer, GC or client answered', i: Gavel, c: 'slate', g: 'office', m: (j) => ({ t: 'record', type: 'decision', jobId: j }) },
  { k: 'call', l: 'Call or follow-up', h: 'Spoke with someone, or no answer', i: Phone, c: 'green', g: 'office', m: (j) => ({ t: 'record', type: 'call', jobId: j }) },
  { k: 'payment', l: 'Payment received', h: 'A check or transfer came in', i: Wallet, c: 'green', g: 'office', m: (j) => ({ t: 'record', type: 'payment', jobId: j }) },
]
/** what each login adds most — first in its group */
const TOP: Partial<Record<Role, string[]>> = {
  owner: ['need', 'problem', 'punch', 'task', 'note', 'meeting'],
  pm: ['need', 'problem', 'punch', 'task', 'note', 'meeting'],
  office: ['need', 'problem', 'task', 'note', 'meeting', 'po'],
  site: ['daily', 'need', 'problem', 'punch', 'delivery', 'task'],
  materials: ['need', 'delivery', 'problem', 'po', 'task'],
  accounting: ['payment', 'task', 'note'],
  estimator: ['task', 'note', 'meeting', 'decision'],
  takeoff: ['task', 'note', 'meeting'],
}
const STARTS: (Pick & { c: TileColor })[] = [
  { k: 'newreq', l: 'Price a new project', h: 'Upload the plans', i: FileText, c: 'blue', m: () => ({ t: 'newreq' }) },
  { k: 'newproject', l: 'New project', h: 'Won already', i: Building2, c: 'teal', m: () => ({ t: 'newproject' }) },
  { k: 'newrepair', l: 'New repair', h: 'A small job or a callback', i: Wrench, c: 'orange', m: () => ({ t: 'newrepair' }) },
  { k: 'newclient', l: 'New client', h: 'A GC, a designer, an owner', i: ContactRound, c: 'violet', m: () => ({ t: 'newclient' }) },
]

/** one choice on + New: its own color, the icon solid, the words beside it — the same size for all of them */
function Choice({ x, onClick }: { x: Pick & { c: TileColor }; onClick: () => void }) {
  const c = TILE_COLORS[x.c]
  return (
    <button
      type="button"
      onClick={onClick}
      title={x.h}
      data-new={x.k}
      className="group flex min-h-12 min-w-0 items-center gap-2.5 rounded-[0.75rem] border px-2.5 py-2 text-left transition duration-150 hover:-translate-y-px hover:shadow-[0_0.5rem_1rem_-0.625rem_rgba(20,26,36,.3)]"
      style={{ background: c.tint, borderColor: c.line }}
    >
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5625rem] text-white shadow-[0_0.125rem_0.375rem_-0.125rem_rgba(0,0,0,.3)] transition group-hover:scale-105" style={{ background: c.solid }}>
        <x.i className="h-[1.0625rem] w-[1.0625rem]" strokeWidth={2.1} />
      </span>
      <span className="min-w-0 text-[0.84375rem] font-semibold leading-tight text-ink">{x.l}</span>
    </button>
  )
}

export function NewPickerModal({ level, jobId: given }: { level: number; jobId?: string }) {
  const s = useStore()
  const role = s.role
  const here = given || projectInView(useStore.getState())
  const [jobId, setJobId] = React.useState<string>(here && s.jobs[here] ? here : '')
  const [needJob, setNeedJob] = React.useState('')
  const job = jobId ? s.jobs[jobId] : undefined
  const ok = (x: { k: string }) => allowedFor(role, x.k)
  const top = TOP[role] || TOP.owner!
  const rank = (k: string) => { const i = top.indexOf(k); return i < 0 ? 99 : i }
  const of = (g: Group) => ADD.filter((x) => x.g === g && ok(x)).sort((a, b) => rank(a.k) - rank(b.k))
  /* the group with your most-used first on top (the site manager's day starts on site, the books' in the office) */
  const groups = ([['site', 'On the job site'], ['office', 'Paperwork and calls']] as [Group, string][])
    .map(([g, label]) => ({ g, label, list: of(g) }))
    .filter((x) => x.list.length)
    .sort((a, b) => Math.min(...a.list.map((x) => rank(x.k))) - Math.min(...b.list.map((x) => rank(x.k))))
  const starts = STARTS.filter(ok)
  const go = (x: Pick) => {
    /* a note or a problem goes on a project — pick it first */
    if (x.job && !jobId) { setNeedJob(x.l); return }
    s.swap(x.m(jobId || undefined))
  }
  const projects = Object.values(s.jobs).filter((j) => j.stage !== 'complete').sort((a, b) => (STAGE_RANK[a.stage] ?? 12) - (STAGE_RANK[b.stage] ?? 12) || a.name.localeCompare(b.name))
  const head = 'mb-2 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-muted'
  return (
    <Modal level={level} size="md" onClose={s.close} title="New" sub={job ? `For ${job.name}` : 'Which project is it for?'}>
      <SearchSelect
        label="Project"
        value={jobId}
        onChange={(k) => { setJobId(k); setNeedJob('') }}
        options={projects.map((j) => ({ key: j.id, label: j.name, hint: [j.client, STAGE_LABEL[j.stage]].filter(Boolean).join(' · ') }))}
        emptyLabel="Not for a project — company-wide"
        placeholder="Pick a project"
        searchPlaceholder="Type a project, address or client…"
        search
        width={420}
        icon={<Building2 />}
        className={cn('w-full', needJob && 'ring-2 ring-bad-200')}
        plain
      />
      {needJob && <div className="mt-1.5 text-[0.8125rem] font-medium text-bad-600">Pick the project for the {needJob.toLowerCase()} first.</div>}
      {groups.map((x) => (
        <section key={x.g} className="mt-4" data-new-group={x.g}>
          <div className={head}>{x.label}</div>
          <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-2">{x.list.map((y) => <Choice key={y.k} x={y} onClick={() => go(y)} />)}</div>
        </section>
      ))}
      {starts.length > 0 && (
        <section className="mt-5 border-t border-line-2 pt-4" data-new-group="start">
          <div className={head}>Start something new</div>
          <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">{starts.map((y) => <Choice key={y.k} x={y} onClick={() => go(y)} />)}</div>
        </section>
      )}
    </Modal>
  )
}
