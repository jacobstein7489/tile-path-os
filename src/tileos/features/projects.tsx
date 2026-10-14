import * as React from 'react'
import { Plus, ChevronRight, AlertTriangle, ChevronDown, Building2, Phone, Mail, MapPin, UserPlus, FileCheck2, FileX2, Archive, Pencil, ArrowRight } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore } from '@/tileos/store'
import { PageHeader, Card, Button, SearchField, Avatar, Dot, Empty, Chip, UnderlineTabs, Field, TextInput, TextArea, Pill, IconCircle, Count, Segmented } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, DatePresets, Tip } from '@/tileos/components/ui/overlay'
import { Swatch } from '@/tileos/components/ui/swatch'
import { StageTrack } from '@/tileos/components/ui/progress'
import { cn, TONE } from '@/tileos/lib/utils'
import { PHASES, STAGE_LABEL, PEOPLE, phaseOf, seesUpcoming, type Phase, type Stage, type PersonKey, type Job } from '@/tileos/data/model'
import { CUSTOMERS, toneOrder } from '@/tileos/data/jobs'
import { TODAY, md, workday, addDays } from '@/tileos/lib/today'

/** the two ways to look at projects: every project, or the ones about to start */
export function ProjectViews({ value }: { value: 'list' | 'upcoming' }) {
  const role = useStore((s) => s.role)
  const go = useStore((s) => s.go)
  if (!seesUpcoming(role)) return null
  return (
    <Segmented
      value={value}
      onChange={(v) => go({ page: v === 'upcoming' ? 'upcoming' : 'projects' })}
      items={[{ key: 'list', label: 'All projects' }, { key: 'upcoming', label: 'Coming up' }]}
    />
  )
}

const GRID = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.95fr)_minmax(0,1.9fr)_minmax(0,1.55fr)_6rem_1.75rem] items-center gap-5'

export function ProjectsPage() {
  const route = useStore((s) => s.route)
  const role = useStore((s) => s.role)
  const jobs = useStore((s) => s.jobs)
  const lost = useStore((s) => s.lost)
  const open = useStore((s) => s.open)
  const [phase, setPhase] = React.useState<Phase | 'all'>((route.q?.phase as Phase) || (role === 'estimator' ? 'pricing' : 'all'))
  const [q, setQ] = React.useState('')
  const [attention, setAttention] = React.useState(route.q?.attention === '1')
  const [owner, setOwner] = React.useState<PersonKey | 'any'>('any')
  const [openRow, setOpenRow] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (route.q?.phase) setPhase(route.q.phase as Phase)
    if (route.q?.attention) setAttention(true)
  }, [route.q])

  const all = Object.values(jobs)
  const needsAttention = (j: Job) => j.status === 'bad'
  const matches = (j: Job) => {
    if (q) {
      const hay = `${j.name} ${j.client} ${j.address} ${j.headline} ${j.issues.map((i) => i.text).join(' ')}`.toLowerCase()
      if (!q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false
    }
    if (attention && !needsAttention(j)) return false
    if (owner !== 'any' && j.next.owner !== owner) return false
    return true
  }
  const filtered = all.filter(matches)
  const shown = filtered.filter((j) => phase === 'all' || phaseOf(j.stage) === phase)
  shown.sort((a, b) => PHASES.findIndex((p) => p.key === phaseOf(a.stage)) - PHASES.findIndex((p) => p.key === phaseOf(b.stage)) || toneOrder[a.status] - toneOrder[b.status])
  const groups = phase === 'all' ? PHASES.map((p) => ({ p, items: shown.filter((j) => phaseOf(j.stage) === p.key) })).filter((g) => g.items.length) : [{ p: PHASES.find((x) => x.key === phase)!, items: shown }]
  const count = (k: Phase | 'all') => filtered.filter((j) => k === 'all' || phaseOf(j.stage) === k).length

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Projects"
        sub={`${all.length} projects, from the first price request to complete. Click a row to see everything going on.`}
        actions={
          <>
            <ProjectViews value="list" />
            <Button variant="ghost" icon={<Archive className="h-4 w-4" />} onClick={() => open({ t: 'lost' })}>{lost.length} not won</Button>
            {role !== 'accounting' && <Button variant="primary" icon={<Plus className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.4} />} onClick={() => open({ t: 'newreq' })}>New price request</Button>}
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="px-6 pt-1 max-sm:px-3">
          <UnderlineTabs
            value={phase}
            onChange={setPhase}
            className="border-b-0"
            items={[{ key: 'all' as Phase | 'all', label: 'All', count: count('all') }, ...PHASES.map((p) => ({ key: p.key as Phase | 'all', label: p.label, count: count(p.key) }))]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-6 py-3 max-sm:px-4">
          <SearchField value={q} onChange={setQ} placeholder="Search a project, client or issue…" className="w-[21.25rem] max-md:w-full max-md:basis-full" />
          <Chip on={attention} onClick={() => setAttention((v) => !v)} icon={<AlertTriangle className="h-4 w-4" />}>Needs attention</Chip>
          <Menu
            align="start"
            trigger={
              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-[0.875rem] font-semibold text-ink-2 hover:bg-wash">
                {owner === 'any' ? 'Whose move: anyone' : <><Avatar who={owner} size={20} />{PEOPLE[owner].name}</>}
                <ChevronDown className="h-4 w-4 text-muted" />
              </button>
            }
          >
            <MenuLabel>Whose move is it?</MenuLabel>
            <MenuItem checked={owner === 'any'} onSelect={() => setOwner('any')}>Anyone</MenuItem>
            {(['ys', 'office', 'estimator', 'materials', 'accounting'] as PersonKey[]).map((p) => (
              <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={owner === p} onSelect={() => setOwner(p)}>
                {PEOPLE[p].name}
              </MenuItem>
            ))}
          </Menu>
          {(q || attention || owner !== 'any') && (
            <button className="text-[0.84375rem] font-semibold text-brand-600" onClick={() => { setQ(''); setAttention(false); setOwner('any') }}>Clear</button>
          )}
          <span className="ml-auto text-[0.84375rem] text-muted max-md:hidden">{shown.length} shown</span>
        </div>
        <div className={cn(GRID, 'border-y border-line bg-wash px-6 py-2.5 text-[0.78125rem] font-semibold text-muted max-xl:hidden')}>
          <span>Project</span>
          <span>Where it’s at</span>
          <span>What’s going on</span>
          <span>Next step</span>
          <span className="text-right">Date</span>
          <span />
        </div>
        {groups.map((g) => (
          <section key={g.p.key}>
            {phase === 'all' && (
              <div className="flex items-baseline gap-2.5 px-6 pb-2 pt-6 max-sm:px-4">
                <span className="h-tight text-[1.0625rem] font-semibold text-ink">{g.p.label}</span>
                <Count>{g.items.length}</Count>
                <span className="truncate text-[0.78125rem] text-faint max-sm:hidden">{g.p.hint}</span>
              </div>
            )}
            {g.items.map((j) => (
              <JobRow key={j.id} j={j} open={openRow === j.id} onToggle={() => setOpenRow(openRow === j.id ? null : j.id)} />
            ))}
          </section>
        ))}
        {!shown.length && <Empty icon={<Building2 className="h-6 w-6" />} title="No projects match" sub="Try another search, or clear the filters." />}
      </Card>
    </div>
  )
}

/** everything going on: the project's issues plus every open task on it */
function useGoingOn(j: Job) {
  const tasks = useStore((s) => s.tasks)
  const open = tasks.filter((t) => t.jobId === j.id && t.state !== 'done')
  const order = { now: 0, waiting: 1, later: 2, done: 3 }
  open.sort((a, b) => order[a.state] - order[b.state])
  return { issues: j.issues, tasks: open }
}

function JobRow({ j, open: expanded, onToggle }: { j: Job; open: boolean; onToggle: () => void }) {
  const s = useStore()
  const role = s.role
  const { issues, tasks } = useGoingOn(j)
  const task = tasks.find((t) => t.state === 'now' && t.owner === j.next.owner && !!t.action) || tasks.find((t) => t.state === 'now' && t.owner === j.next.owner)
  const first = issues[0]
  const more = issues.length - 1 + tasks.length
  const stage = j.readiness === 'partial' && j.stage === 'ready' ? 'Partly ready' : `${STAGE_LABEL[j.stage]}${j.pct !== undefined && ['installation', 'punch'].includes(j.stage) ? ` · ${j.pct}%` : ''}`
  const go = () => s.open({ t: 'job', id: j.id, tab: role === 'accounting' ? 'money' : role === 'materials' ? 'materials' : undefined })
  return (
    <div className={cn('border-t border-line-2', expanded && 'bg-wash/60')}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onToggle()
          }
        }}
        className={cn(GRID, 'group w-full cursor-pointer px-6 py-3.5 text-left transition-colors hover:bg-wash focus-visible:bg-wash focus-visible:outline-none md:max-xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_1.75rem] max-md:grid-cols-[minmax(0,1fr)_1.75rem] max-xl:gap-x-5 max-md:gap-x-3 max-md:gap-y-2 max-sm:px-4')}
      >
        <div className="min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              go()
            }}
            className="block max-w-full truncate text-left text-[0.9375rem] font-semibold text-ink hover:text-brand-700 hover:underline decoration-brand-200 underline-offset-2"
          >
            {j.name}
          </button>
          <div className="truncate text-[0.8125rem] text-muted">
            <span className="xl:hidden">{stage} · </span>
            {j.client}
          </div>
        </div>
        <div className="min-w-0 text-[0.875rem] text-ink-2 max-xl:hidden">{stage}</div>
        <div className="flex min-w-0 items-start gap-2 max-md:col-span-2 max-md:row-start-2">
          {first ? <Dot tone={first.tone === 'info' ? 'neutral' : first.tone} className="mt-[0.4375rem]" /> : <Dot tone="ok" className="mt-[0.4375rem]" />}
          <div className="min-w-0">
            <div className={cn('line-clamp-2 text-[0.875rem] leading-snug', first?.tone === 'bad' ? 'text-bad-700' : 'text-ink-2')}>{first ? first.text : j.headline}</div>
            {more > 0 && <div className="mt-0.5 text-[0.78125rem] font-medium text-brand-600">{expanded ? 'Showing everything' : `+${more} more going on`}</div>}
          </div>
        </div>
        {task ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              s.open({ t: 'task', id: task.id })
            }}
            title={`Open: ${task.title}`}
            className="group/next -mx-2 -my-1.5 flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-brand-50 max-md:col-span-2"
          >
            <Avatar who={j.next.owner} size={26} />
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[0.875rem] leading-snug text-ink group-hover/next:text-brand-700">{j.next.text}</div>
              {j.next.due && <div className={cn('text-[0.78125rem]', j.next.dueTone === 'bad' ? 'font-semibold text-bad-700' : j.next.dueTone === 'warn' ? 'text-warn-700' : 'text-muted')}>{j.next.due}</div>}
            </div>
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5 max-md:col-span-2">
            <Avatar who={j.next.owner} size={26} />
            <div className="min-w-0">
              <div className="line-clamp-2 text-[0.875rem] leading-snug text-ink">{j.next.text}</div>
              {j.next.due && <div className={cn('text-[0.78125rem]', j.next.dueTone === 'bad' ? 'font-semibold text-bad-700' : j.next.dueTone === 'warn' ? 'text-warn-700' : 'text-muted')}>{j.next.due}</div>}
            </div>
          </div>
        )}
        <div className="text-right max-xl:hidden">
          <div className="text-[0.75rem] text-muted">{j.keyDate.label}</div>
          <div className={cn('text-[0.875rem] font-semibold tnum', j.keyDate.tone === 'bad' ? 'text-bad-700' : 'text-ink')}>{j.keyDate.value}</div>
        </div>
        <ChevronDown className={cn('h-[1.125rem] w-[1.125rem] justify-self-end text-faint transition group-hover:text-ink-2 max-md:col-start-2 max-md:row-start-1', expanded && 'rotate-180 text-ink-2')} />
      </div>
      {expanded && <GoingOn j={j} issues={issues} tasks={tasks} onOpen={go} />}
    </div>
  )
}

function GoingOn({ j, issues, tasks, onOpen }: { j: Job; issues: Job['issues']; tasks: ReturnType<typeof useGoingOn>['tasks']; onOpen: () => void }) {
  const s = useStore()
  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-5 px-6 pb-5 pt-1 max-lg:grid-cols-1 max-sm:px-4">
      <div className="min-w-0">
        <div className="mb-2 text-[0.8125rem] font-semibold text-muted">Going on ({issues.length})</div>
        {issues.length ? (
          <div className="flex flex-col gap-2">
            {issues.map((i, k) => (
              <div key={k} className="flex items-start gap-2.5 text-[0.875rem]">
                <Dot tone={i.tone === 'info' ? 'neutral' : i.tone} className="mt-[0.4375rem]" />
                <span className={cn('min-w-0', i.tone === 'bad' ? 'font-medium text-bad-700' : 'text-ink-2')}>{i.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[0.875rem] text-muted">Nothing open — {j.headline.toLowerCase()}</div>
        )}
      </div>
      <div className="min-w-0">
        <div className="mb-2 text-[0.8125rem] font-semibold text-muted">Open tasks ({tasks.length})</div>
        {tasks.length ? (
          <div className="flex flex-col">
            {tasks.map((t) => (
              <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="-mx-2 flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white">
                <Avatar who={t.owner} size={22} />
                <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink">{t.title}</span>
                <span className={cn('shrink-0 text-[0.78125rem]', t.state === 'waiting' ? 'text-warn-700' : /late/i.test(t.due || '') ? 'font-semibold text-bad-700' : 'text-muted')}>{t.state === 'waiting' ? `Waiting · ${t.waitingOn}` : t.due || ''}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-[0.875rem] text-muted">No open tasks.</div>
        )}
        <Button size="sm" className="mt-3" iconRight={<ArrowRight className="h-4 w-4" />} onClick={onOpen}>Open {j.name}</Button>
      </div>
    </div>
  )
}

/* ---------------- Not won ---------------- */
export function LostModal({ level }: { level: number }) {
  const lost = useStore((s) => s.lost)
  const close = useStore((s) => s.close)
  return (
    <Modal level={level} size="md" onClose={close} title="Not won" sub="Projects that didn’t go ahead stay here with the reason — never deleted.">
      <div className="flex flex-col divide-y divide-line-2 rounded-2xl border border-line">
        {lost.map((l, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] font-semibold text-ink">{l.name}</div>
              <div className="text-[0.8125rem] text-muted">{l.client}</div>
            </div>
            <div className="text-right">
              <div className="text-[0.875rem] font-medium text-ink-2">{l.reason}</div>
              <div className="text-[0.78125rem] text-muted">{l.date}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ---------------- Customer ---------------- */
export function CustomerModal({ id, level }: { id: string; level: number }) {
  const close = useStore((s) => s.close)
  const open = useStore((s) => s.open)
  const jobs = useStore((s) => s.jobs)
  const tasks = useStore((s) => s.tasks)
  const c = CUSTOMERS[id]
  const [edit, setEdit] = React.useState(false)
  const [notes, setNotes] = React.useState(c?.notes || '')
  if (!c) return null
  const theirJobs = Object.values(jobs).filter((j) => j.clientId === id)
  const openItems = tasks.filter((t) => t.state !== 'done' && theirJobs.some((j) => j.id === t.jobId))
  const header = (
    <div className="border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
      <h2 className="h-tight text-[1.4375rem] font-bold text-ink max-sm:text-[1.1875rem]">{c.name}</h2>
      <div className="mt-1 text-[0.875rem] text-muted">
        {theirJobs.length} {theirJobs.length === 1 ? 'project' : 'projects'} · {openItems.length} open items
      </div>
    </div>
  )
  return (
    <Modal level={level} size="lg" onClose={close} header={header} title={c.name}>
      <div className="grid grid-cols-[1fr_18.75rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[0.84375rem] font-semibold text-muted">Projects</div>
          </div>
          <div className="flex flex-col divide-y divide-line-2 rounded-2xl border border-line">
            {theirJobs.map((j) => (
              <button key={j.id} onClick={() => open({ t: 'job', id: j.id })} className="flex items-center gap-3.5 px-4 py-3.5 text-left hover:bg-wash">
                <div className="min-w-0 flex-1">
                  <div className="text-[0.90625rem] font-semibold text-ink">{j.name}</div>
                  <div className="truncate text-[0.8125rem] text-muted">{j.headline}</div>
                </div>
                <Pill tone="neutral" size="sm">{STAGE_LABEL[j.stage]}</Pill>
                <ChevronRight className="h-4 w-4 text-faint" />
              </button>
            ))}
            {!theirJobs.length && <div className="px-4 py-6 text-[0.875rem] text-muted">No active projects.</div>}
          </div>
          <div className="mb-3 mt-7 flex items-center justify-between">
            <div className="text-[0.84375rem] font-semibold text-muted">People we deal with</div>
            <Button size="xs" variant="ghost" icon={<UserPlus className="h-4 w-4" />} onClick={() => toast('Add a person — their role, phone and email')}>Add person</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {c.contacts.map((p, i) => (
              <div key={i} className="rounded-2xl border border-line p-4">
                <div className="text-[0.90625rem] font-semibold text-ink">{p.name}</div>
                <div className="text-[0.78125rem] text-muted">{p.role}</div>
                <div className="mt-3 flex flex-col gap-1.5 text-[0.84375rem] text-ink-2">
                  <span className="inline-flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted" />{p.phone}</span>
                  <span className="inline-flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 text-muted" />{p.email}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="self-start rounded-2xl border border-line bg-wash/60 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[0.84375rem] font-semibold text-muted">Details</div>
            <button onClick={() => setEdit((v) => !v)} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-600"><Pencil className="h-3.5 w-3.5" />{edit ? 'Done' : 'Edit'}</button>
          </div>
          <div className="mt-3 flex flex-col gap-3 text-[0.875rem] text-ink-2">
            <span className="inline-flex items-center gap-2.5"><MapPin className="h-4 w-4 text-muted" />{c.address}</span>
            <span className="inline-flex items-center gap-2.5"><Phone className="h-4 w-4 text-muted" />{c.phone}</span>
            <span className="inline-flex items-center gap-2.5 truncate"><Mail className="h-4 w-4 text-muted" />{c.email}</span>
          </div>
          <div className="mt-5 text-[0.84375rem] font-semibold text-muted">Notes</div>
          {edit ? <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2" /> : <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-2">{notes || 'No notes yet.'}</p>}
        </div>
      </div>
    </Modal>
  )
}
