/* + New (what to add, for which project — only what fits your login), and the colored option tiles other windows use */
import * as React from 'react'
import {
  FileText, Building2, ListTodo, CalendarPlus, Sparkles, Wrench, ContactRound, PackageCheck,
  MessageCircleQuestion, ArrowLeftRight, PackageX, Truck, Gavel, Phone, ClipboardList, Wallet, Search, ChevronRight, ChevronLeft,
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
  payment: ['owner', 'office', 'accounting'],
  newreq: ['owner', 'pm', 'office', 'takeoff', 'estimator'],
  newproject: ['owner', 'pm', 'office'],
  newrepair: ['owner', 'pm', 'office'],
  newclient: ['owner', 'pm', 'office', 'estimator', 'accounting'],
}
export const allowedFor = (role: Role, key: string) => !FOR[key] || FOR[key].includes(role)

type Pick = { k: string; l: string; h: string; i: React.ElementType; m: (jobId?: string) => M }

/** the project a window is open on, or the project page — "New" starts on it */
function projectInView(s: ReturnType<typeof useStore.getState>) {
  const top = [...s.modals].reverse().find((m) => m.t === 'job' && m.id)
  return (top?.id as string | undefined) || (s.route.page === 'job' ? s.route.id : undefined)
}
const STAGE_RANK: Partial<Record<Stage, number>> = { installation: 0, scheduled: 1, punch: 2, ready: 3, verification: 4, setup: 5, awarded: 6, proposal: 7, followup: 7, estimating: 8, request: 9, closeout: 10, complete: 11 }

/* + New — what you want to add first (a task is the first thing), with the project on top: the one you're in, or pick
 * one, or none for the company. Only what fits your login. Pricing a new project, a project, a repair or a client start
 * here too. */
export function NewPickerModal({ level, jobId: given }: { level: number; jobId?: string }) {
  const s = useStore()
  const role = s.role
  const here = given || projectInView(useStore.getState())
  const [jobId, setJobId] = React.useState<string>(here && s.jobs[here] ? here : '')
  const job = jobId ? s.jobs[jobId] : undefined
  const go = (m: M) => s.swap(m)
  const ok = (x: { k: string }) => allowedFor(role, x.k)
  const add: Pick[] = [
    { k: 'task', l: 'Task', h: 'Something someone has to do', i: ListTodo, m: (j) => ({ t: 'newtask', jobId: j }) },
    { k: 'meeting', l: 'Meeting or walkthrough', h: 'A day, a time and who’s in it', i: CalendarPlus, m: (j) => ({ t: 'record', type: 'meeting', jobId: j }) },
    { k: 'po', l: 'Purchase order', h: 'Materials from a supplier', i: PackageCheck, m: (j) => ({ t: 'newpo', jobId: j }) },
    { k: 'punch', l: 'Touch-ups', h: 'A punch list for a crew', i: Sparkles, m: (j) => ({ t: 'punchnew', jobId: j }) },
  ].filter(ok)
  const log: Pick[] = [
    { k: 'daily', l: 'Daily update', h: 'What the crew tiled today', i: ClipboardList, m: (j) => ({ t: 'record', type: 'daily', jobId: j }) },
    { k: 'question', l: 'Site issue or question', h: 'Something on site needs an answer', i: MessageCircleQuestion, m: (j) => ({ t: 'record', type: 'question', jobId: j }) },
    { k: 'change', l: 'Client asked for a change', h: 'Height, tile, layout or extra work', i: ArrowLeftRight, m: (j) => ({ t: 'record', type: 'change', jobId: j }) },
    { k: 'shortage', l: 'Short, wrong or damaged', h: 'The crew can’t finish with what’s there', i: PackageX, m: (j) => ({ t: 'record', type: 'shortage', jobId: j }) },
    { k: 'delivery', l: 'Delivery arrived', h: 'Tile or materials landed on site', i: Truck, m: (j) => ({ t: 'record', type: 'delivery', jobId: j }) },
    { k: 'decision', l: 'Decision made', h: 'The designer, GC or client answered', i: Gavel, m: (j) => ({ t: 'record', type: 'decision', jobId: j }) },
    { k: 'call', l: 'Call or follow-up', h: 'Spoke with someone, or no answer', i: Phone, m: (j) => ({ t: 'record', type: 'call', jobId: j }) },
    { k: 'payment', l: 'Payment received', h: 'A check or transfer came in', i: Wallet, m: (j) => ({ t: 'record', type: 'payment', jobId: j }) },
  ].filter(ok)
  const starts: Pick[] = [
    { k: 'newreq', l: 'Price a new project', h: 'Upload the plans — it goes to the takeoff', i: FileText, m: () => ({ t: 'newreq' }) },
    { k: 'newproject', l: 'New project', h: 'Won already, or priced outside', i: Building2, m: () => ({ t: 'newproject' }) },
    { k: 'newrepair', l: 'New repair', h: 'A small job or a callback', i: Wrench, m: () => ({ t: 'newrepair' }) },
    { k: 'newclient', l: 'New client', h: 'A GC, a designer, an owner', i: ContactRound, m: () => ({ t: 'newclient' }) },
  ].filter(ok)
  const projects = Object.values(s.jobs).filter((j) => j.stage !== 'complete').sort((a, b) => (STAGE_RANK[a.stage] ?? 12) - (STAGE_RANK[b.stage] ?? 12) || a.name.localeCompare(b.name))
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
    items.length ? (
      <section>
        <div className="mb-2 text-[0.78125rem] font-semibold text-muted">{label}</div>
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">{items.map((x) => <Row key={x.k} x={x} />)}</div>
      </section>
    ) : null
  return (
    <Modal level={level} size="md" onClose={s.close} title="New" sub={job ? `For ${job.name} · ${job.client}` : 'Pick what to add — it goes on the project you pick'}>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-wash px-3 py-2.5 max-sm:flex-col max-sm:items-stretch max-sm:gap-1.5">
        <span className="shrink-0 text-[0.8125rem] font-semibold text-ink-2">For which project</span>
        <SearchSelect
          label="Project"
          value={jobId}
          onChange={setJobId}
          options={projects.map((j) => ({ key: j.id, label: j.name, hint: [j.client, STAGE_LABEL[j.stage]].filter(Boolean).join(' · ') }))}
          emptyLabel="No project — for the company"
          placeholder="Pick a project"
          searchPlaceholder="Type a project, address or client…"
          search
          width={420}
          icon={<Building2 />}
          className="min-w-0 flex-1 bg-white"
        />
      </div>
      <div className="flex flex-col gap-5">
        <Group label="Add" items={add} />
        <Group label="Log what happened" items={log} />
        <Group label="Start something new" items={starts} />
      </div>
    </Modal>
  )
}
