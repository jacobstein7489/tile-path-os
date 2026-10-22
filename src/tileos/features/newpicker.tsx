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
import { ProjectField } from './formkit'

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

/** every kind of thing you add — its name, what it's for, its icon and color — the same on + New and on its form */
export const KIND: Record<string, { l: string; h: string; i: React.ElementType; c: TileColor }> = Object.fromEntries([...ADD, ...STARTS].map((x) => [x.k, { l: x.l, h: x.h, i: x.i, c: x.c }]))

/** a choice on + New: a white card, only the icon in its color (calm, like the filter bubbles) */
function Choice({ x, onClick, big }: { x: Pick & { c: TileColor }; onClick: () => void; big?: boolean }) {
  const c = TILE_COLORS[x.c]
  return (
    <button
      type="button"
      onClick={onClick}
      title={x.h}
      data-new={x.k}
      className={cn('group flex min-w-0 items-center gap-3 rounded-[0.75rem] border border-line bg-white text-left transition duration-150 hover:-translate-y-px hover:border-[#d6cfc3] hover:shadow-[0_0.5rem_1rem_-0.75rem_rgba(20,26,36,.35)]', big ? 'min-h-[4rem] px-3 py-2.5' : 'min-h-11 px-2.5 py-1.5')}
    >
      <span className={cn('inline-flex shrink-0 items-center justify-center text-white shadow-[0_0.125rem_0.375rem_-0.125rem_rgba(0,0,0,.25)] transition group-hover:scale-105', big ? 'h-9 w-9 rounded-[0.625rem]' : 'h-7 w-7 rounded-[0.5rem]')} style={{ background: c.solid }}>
        <x.i className={big ? 'h-[1.125rem] w-[1.125rem]' : 'h-[0.9375rem] w-[0.9375rem]'} strokeWidth={2.1} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={cn('block font-semibold text-ink', big ? 'text-[0.90625rem]' : 'text-[0.8125rem]')}>{x.l}</span>
        {big && <span className="mt-0.5 line-clamp-1 text-[0.75rem] text-muted max-sm:hidden">{x.h}</span>}
      </span>
    </button>
  )
}

/** the same calm card for one kind, anywhere ("Log what happened" picks from these too) */
export function KindChoice({ k, onClick, big }: { k: string; onClick: () => void; big?: boolean }) {
  const x = KIND[k]
  if (!x) return null
  return <Choice x={{ k, l: x.l, h: x.h, i: x.i, c: x.c, m: () => ({ t: 'record' } as M) }} onClick={onClick} big={big} />
}

export function NewPickerModal({ level, jobId: given }: { level: number; jobId?: string }) {
  const s = useStore()
  const role = s.role
  const here = given || projectInView(useStore.getState())
  const [jobId, setJobId] = React.useState<string>(here && s.jobs[here] ? here : '')
  const job = jobId ? s.jobs[jobId] : undefined
  const ok = (x: { k: string }) => allowedFor(role, x.k)
  const top = TOP[role] || TOP.owner!
  const rank = (k: string) => { const i = top.indexOf(k); return i < 0 ? 99 : i }
  /* the quick ones: what your login adds most */
  const quick = ADD.filter(ok).filter((x) => rank(x.k) < 4).sort((a, b) => rank(a.k) - rank(b.k))
  const rest = (g: Group) => ADD.filter((x) => x.g === g && ok(x) && !quick.includes(x)).sort((a, b) => rank(a.k) - rank(b.k))
  const groups = ([['site', 'On the job site'], ['office', 'Paperwork and calls']] as [Group, string][]).map(([g, label]) => ({ g, label, list: rest(g) })).filter((x) => x.list.length)
  const starts = STARTS.filter(ok)
  /* each form asks for the project itself (typed) if it isn't picked here */
  const go = (x: Pick) => s.swap(x.m(jobId || undefined))
  const head = 'mb-2 text-[0.75rem] font-bold uppercase tracking-[0.06em] text-muted'
  return (
    <Modal level={level} size="md" onClose={s.close} title="New" sub={job ? `For ${job.name}` : 'Pick the project, or not — each one asks'}>
      <ProjectPick value={jobId} onChange={setJobId} />
      <section className="mt-4" data-new-group="quick">
        <div className={head}>Quick</div>
        <div className="grid grid-cols-2 gap-2">{quick.map((y) => <Choice key={y.k} x={y} big onClick={() => go(y)} />)}</div>
      </section>
      {groups.map((x) => (
        <section key={x.g} className="mt-4" data-new-group={x.g}>
          <div className={head}>{x.label}</div>
          <div className="grid grid-cols-3 gap-1.5 max-sm:grid-cols-2">{x.list.map((y) => <Choice key={y.k} x={y} onClick={() => go(y)} />)}</div>
        </section>
      ))}
      {starts.length > 0 && (
        <section className="mt-4 border-t border-line-2 pt-4" data-new-group="start">
          <div className={head}>Start something new</div>
          <div className="grid grid-cols-4 gap-1.5 max-md:grid-cols-2">{starts.map((y) => <Choice key={y.k} x={y} onClick={() => go(y)} />)}</div>
        </section>
      )}
    </Modal>
  )
}

/** + New's project: typed (the same field every form uses), or none for something company-wide */
function ProjectPick({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1"><ProjectField value={value} onChange={onChange} /></div>
      {value && <button type="button" onClick={() => onChange('')} className="shrink-0 rounded-md px-2 py-1 text-[0.8125rem] font-semibold text-muted hover:bg-wash hover:text-ink">Company-wide</button>}
    </div>
  )
}
