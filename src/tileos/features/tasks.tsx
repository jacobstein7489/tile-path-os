import * as React from 'react'
import { Plus, SlidersHorizontal, Check, Clock3, MoonStar, Ban, MapPin, ArrowRight, RotateCcw, Send, UserRound, CalendarDays, Tag, Building2, X, CheckCircle2, ListChecks } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { PageHeader, Card, Button, UnderlineTabs, SearchField, Segmented, Avatar, Pill, Empty, Count, TextArea, Field, TextInput, Chip } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuCheck, MenuLabel, MenuSep, MenuItem, Pop, WaitPicker, LaterPicker, DatePresets } from '@/tileos/components/ui/overlay'
import { Swatch } from '@/tileos/components/ui/swatch'
import { TaskRow, TYPE_ICON, JobChip } from './common'
import { runTaskAction } from './flows'
import { cn, dueBucket, BUCKET_LABEL, TONE, type DueBucket } from '@/tileos/lib/utils'
import type { Task, TaskType, TaskState } from '@/tileos/data/work'
import { PEOPLE, STAGE_LABEL, type PersonKey } from '@/tileos/data/model'

const TYPES: TaskType[] = ['Pricing', 'Setup', 'Materials', 'Field', 'Changes', 'Schedule', 'Money']

export function TasksPage() {
  const role = useStore((s) => s.role)
  const route = useStore((s) => s.route)
  const tasks = useStore((s) => s.tasks)
  const jobs = useStore((s) => s.jobs)
  const open = useStore((s) => s.open)
  const [tab, setTab] = React.useState<TaskState>((route.tab as TaskState) || 'now')
  const [scope, setScope] = React.useState<'mine' | 'all'>('mine')
  const [q, setQ] = React.useState('')
  const [types, setTypes] = React.useState<TaskType[]>(role === 'accounting' ? [] : [])
  React.useEffect(() => {
    if (route.tab) setTab(route.tab as TaskState)
  }, [route.tab])

  const me = meOf(role)
  const visible = tasks.filter((t) => {
    if (role === 'accounting' && t.type !== 'Money') return false
    if (scope === 'mine') return t.for.includes(role) || (t.owner === me && !['owner', 'pm', 'site'].includes(role))
    return role === 'owner' || t.for.includes(role) || (t.watch || []).includes(role) || t.type === 'Money' && role === 'accounting' || role === 'pm' || role === 'site'
  })
  const filtered = visible.filter((t) => {
    if (types.length && !types.includes(t.type)) return false
    if (q) {
      const hay = `${t.title} ${jobs[t.jobId]?.name} ${t.where} ${t.waitingOn} ${t.detail}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  })
  const counts = { now: 0, waiting: 0, later: 0, done: 0 } as Record<TaskState, number>
  filtered.forEach((t) => counts[t.state]++)
  const list = filtered.filter((t) => t.state === tab)

  const groups: { key: string; label: string; tone?: 'bad' | 'warn'; items: Task[] }[] = []
  if (tab === 'now' || tab === 'waiting') {
    const order: DueBucket[] = ['overdue', 'today', 'week', 'later']
    order.forEach((b) => {
      const items = list.filter((t) => dueBucket(tab === 'now' ? t.due : t.followUp, tab === 'now' ? t.dueTone : undefined) === b)
      if (items.length) groups.push({ key: b, label: tab === 'waiting' ? ({ overdue: 'Overdue follow-ups', today: 'Comes back today', week: 'Comes back this week', later: 'Later' } as any)[b] : BUCKET_LABEL[b], tone: b === 'overdue' ? 'bad' : b === 'today' ? 'warn' : undefined, items })
    })
  } else if (list.length) groups.push({ key: 'all', label: tab === 'later' ? 'Comes back later' : 'Done', items: list })

  const typeCount = (ty: TaskType) => visible.filter((t) => t.type === ty && t.state === tab).length

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Tasks"
        sub="One item per thing that has to happen — who has it, who we’re waiting on, and when it comes back."
        actions={<Button variant="primary" icon={<Plus className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.4} />} onClick={() => open({ t: 'newtask' })}>New task</Button>}
      />
      <Card>
        <div className="flex items-end justify-between gap-4 px-6 pt-2 max-lg:flex-col max-lg:items-stretch max-lg:gap-0 max-sm:px-3">
          <UnderlineTabs
            value={tab}
            onChange={setTab}
            className="flex-1 border-b-0"
            items={[
              { key: 'now', label: 'Needs action', count: counts.now },
              { key: 'waiting', label: 'Waiting on others', count: counts.waiting, tone: 'warn' },
              { key: 'later', label: 'Later', count: counts.later },
              { key: 'done', label: 'Done', count: counts.done, tone: 'ok' },
            ]}
          />
          <div className="mb-2.5 flex items-center gap-2.5 max-lg:order-first max-lg:mb-1 max-lg:mt-3 max-sm:flex-wrap">
            <SearchField value={q} onChange={setQ} placeholder="Search tasks or projects…" className="w-[16.25rem] max-lg:w-auto max-lg:flex-1 max-sm:w-full max-sm:basis-full" />
            {role !== 'accounting' && (
              <Segmented value={scope} onChange={setScope} items={[{ key: 'mine', label: 'Mine' }, { key: 'all', label: 'Everyone' }]} />
            )}
            {role !== 'accounting' && (
              <Menu
                width={260}
                trigger={
                  <button className={cn('inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-[0.875rem] font-semibold transition', types.length ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}>
                    <SlidersHorizontal className="h-4 w-4" /> Filter
                    {types.length > 0 && <Count tone="info" className="h-5 min-w-5 text-[0.6875rem]">{types.length}</Count>}
                  </button>
                }
              >
                <MenuLabel>Show only</MenuLabel>
                {TYPES.map((ty) => {
                  const Ic = TYPE_ICON[ty]
                  return (
                    <MenuCheck key={ty} checked={types.includes(ty)} onChange={(v) => setTypes((p) => (v ? [...p, ty] : p.filter((x) => x !== ty)))}>
                      <Ic className="h-4 w-4 text-muted" /> <span className="flex-1">{ty}</span> <span className="text-[0.75rem] text-faint tnum">{typeCount(ty)}</span>
                    </MenuCheck>
                  )
                })}
                {types.length > 0 && (
                  <>
                    <MenuSep />
                    <MenuItem onSelect={() => setTypes([])}>Clear filter</MenuItem>
                  </>
                )}
              </Menu>
            )}
          </div>
        </div>
        <div className="h-px bg-line" />
        {types.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line-2 px-6 py-3 max-sm:px-4">
            <span className="text-[0.8125rem] text-muted">Showing</span>
            {types.map((ty) => (
              <button key={ty} onClick={() => setTypes((p) => p.filter((x) => x !== ty))} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-100">
                {ty} <X className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        )}
        {groups.map((g) => (
          <div key={g.key}>
            <div className="flex items-center gap-2 px-6 pb-2 pt-6 max-sm:px-4">
              <span className={cn('h-tight text-[1.0625rem] font-semibold', g.tone === 'bad' ? 'text-bad-700' : 'text-ink')}>{g.label}</span>
              <Count tone={g.tone === 'bad' ? 'bad' : 'neutral'}>{g.items.length}</Count>
            </div>
            {g.items.map((t) => (
              <TaskRow key={t.id} t={t} />
            ))}
          </div>
        ))}
        {!groups.length && <Empty icon={<ListChecks className="h-6 w-6" />} title={q || types.length ? 'Nothing matches' : tab === 'done' ? 'Nothing done yet today' : 'All clear'} sub={q || types.length ? 'Try a different search or clear the filter.' : 'New items show up here the moment something needs you.'} />}
      </Card>
    </div>
  )
}

/* ---------------- Task popup ---------------- */
export function TaskModal({ id, level }: { id: string; level: number }) {
  const t = useStore((s) => s.tasks.find((x) => x.id === id))
  const job = useStore((s) => (t ? s.jobs[t.jobId] : undefined))
  const close = useStore((s) => s.close)
  const open = useStore((s) => s.open)
  const completeTask = useStore((s) => s.completeTask)
  const waitTask = useStore((s) => s.waitTask)
  const laterTask = useStore((s) => s.laterTask)
  const reopenTask = useStore((s) => s.reopenTask)
  const reassign = useStore((s) => s.reassignTask)
  const setDue = useStore((s) => s.setTaskDue)
  const noteTask = useStore((s) => s.noteTask)
  const [note, setNote] = React.useState('')
  const [waitOpen, setWaitOpen] = React.useState(false)
  const [laterOpen, setLaterOpen] = React.useState(false)
  const [dueOpen, setDueOpen] = React.useState(false)
  if (!t || !job) return null
  const Icon = TYPE_ICON[t.type]
  const stateMeta = {
    now: { label: 'Needs action', tone: 'info' as const, icon: <ArrowRight className="h-4 w-4" /> },
    waiting: { label: `Waiting on ${t.waitingOn}`, tone: 'warn' as const, icon: <Clock3 className="h-4 w-4" /> },
    later: { label: `Later · back ${t.laterUntil}`, tone: 'neutral' as const, icon: <MoonStar className="h-4 w-4" /> },
    done: { label: `Done · ${t.doneAt}`, tone: 'ok' as const, icon: <CheckCircle2 className="h-4 w-4" /> },
  }[t.state]
  const hasAction = t.action && t.state !== 'done' && t.action.kind !== 'open-job'

  const header = (
    <div className="border-b border-line-2 px-7 pb-5 pt-6 max-sm:px-4 max-sm:pb-4 max-sm:pt-4">
      <div className="flex items-start gap-4 pr-16 max-sm:pr-12">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.84375rem] text-muted">
            <button onClick={() => open({ t: 'job', id: job.id })} className="font-semibold text-ink-2 hover:text-brand-700">{job.name}</button>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.address}</span>
            <Pill tone="neutral" size="sm">{STAGE_LABEL[job.stage]}</Pill>
          </div>
          <h2 className="h-tight mt-1.5 text-[1.4375rem] font-bold leading-snug text-ink max-sm:text-[1.1875rem]">{t.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Pill tone={stateMeta.tone} size="md">{stateMeta.icon}{stateMeta.label}</Pill>
            <Pill tone="neutral" size="md"><Icon className="h-3.5 w-3.5" />{t.type}</Pill>
            {t.blocks && t.state !== 'done' && <Pill tone="bad" size="md"><Ban className="h-3.5 w-3.5" />Blocks {t.blocks.charAt(0).toLowerCase() + t.blocks.slice(1)}</Pill>}
          </div>
        </div>
      </div>
    </div>
  )

  const footer =
    t.state === 'done' ? (
      <>
        <span className="text-[0.875rem] text-muted">{t.result ? `Result: ${t.result}` : 'Finished and logged in the project history.'}</span>
        <Button className="ml-auto" icon={<RotateCcw className="h-4 w-4" />} onClick={() => reopenTask(t.id)}>Reopen</Button>
      </>
    ) : (
      <>
        <Pop
          open={laterOpen}
          onOpenChange={setLaterOpen}
          side="top"
          width={360}
          trigger={<Button className="max-sm:flex-1" icon={<MoonStar className="h-[1.125rem] w-[1.125rem]" />}>Not today</Button>}
        >
          <LaterPicker onCancel={() => setLaterOpen(false)} onSave={(u) => { setLaterOpen(false); laterTask(t.id, u) }} />
        </Pop>
        <Pop
          open={waitOpen}
          onOpenChange={setWaitOpen}
          side="top"
          width={420}
          trigger={<Button className="max-sm:flex-1" icon={<Clock3 className="h-[1.125rem] w-[1.125rem]" />}><span className="max-sm:hidden">Waiting on someone</span><span className="sm:hidden">Waiting</span></Button>}
        >
          <WaitPicker defaultWho={t.waitingOn} onCancel={() => setWaitOpen(false)} onSave={(w, b) => { setWaitOpen(false); waitTask(t.id, w, b) }} />
        </Pop>
        <div className="ml-auto flex items-center gap-3 max-sm:order-first max-sm:ml-0 max-sm:w-full max-sm:flex-wrap max-sm:gap-2">
          {t.state !== 'now' && <Button variant="ghost" className="max-sm:order-last max-sm:w-full" onClick={() => reopenTask(t.id)}>Back to needs action</Button>}
          <Button variant={hasAction ? 'secondary' : 'success'} className="max-sm:flex-1" icon={<Check className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.6} />} onClick={() => { completeTask(t.id); close() }}>
            Done
          </Button>
          {hasAction && (
            <Button variant="primary" className="max-sm:flex-[2]" iconRight={<ArrowRight className="h-[1.125rem] w-[1.125rem]" />} onClick={() => runTaskAction(t)}>
              {t.action!.label}
            </Button>
          )}
        </div>
      </>
    )

  return (
    <Modal level={level} size="lg" onClose={close} header={header} footer={footer} title={t.title} bodyClass="px-7 py-6 max-sm:px-4 max-sm:py-5">
      <div className="grid grid-cols-[1fr_16.875rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <div className="min-w-0">
          {t.state === 'waiting' && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-warn-100 bg-warn-50 px-4 py-3.5">
              <Clock3 className="h-5 w-5 text-warn-600" />
              <div className="text-[0.90625rem] text-ink-2">
                <span className="font-semibold text-ink">Waiting on {t.waitingOn}.</span> It leaves your list and comes back <span className="font-semibold">{t.followUp}</span> by itself.
              </div>
            </div>
          )}
          {t.state === 'later' && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-line bg-wash px-4 py-3.5 text-[0.90625rem] text-ink-2">
              <MoonStar className="h-5 w-5 text-muted" /> Out of the way until <span className="font-semibold text-ink">{t.laterUntil}</span>.
            </div>
          )}
          <div className="text-[0.84375rem] font-semibold text-muted">What’s needed</div>
          <p className="mt-1.5 text-[0.96875rem] leading-relaxed text-ink">{t.detail || t.title}</p>
          {t.where && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-wash-2 px-2.5 py-1.5 text-[0.84375rem] font-medium text-ink-2">
              <MapPin className="h-3.5 w-3.5 text-muted" /> {t.where}
            </div>
          )}

          <div className="mt-7 text-[0.84375rem] font-semibold text-muted">History</div>
          <div className="mt-3 flex flex-col gap-0">
            {t.log.length === 0 && <div className="text-[0.875rem] text-muted">Nothing logged yet.</div>}
            {[...t.log].reverse().map((l, i) => (
              <div key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < t.log.length - 1 && <span className="absolute left-[0.8125rem] top-8 bottom-0 w-px bg-line" />}
                <Avatar who={l.who} size={27} />
                <div className="min-w-0 pt-0.5">
                  <div className="text-[0.875rem] text-ink">{l.text}</div>
                  <div className="text-[0.78125rem] text-muted">{PEOPLE[l.who].name} · {l.date}</div>
                </div>
              </div>
            ))}
          </div>
          {t.state !== 'done' && (
            <div className="mt-5 flex gap-2.5">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the history…" onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) { noteTask(t.id, note.trim()); setNote('') } }} />
              <Button size="md" disabled={!note.trim()} onClick={() => { noteTask(t.id, note.trim()); setNote('') }}>Add</Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 self-start rounded-2xl border border-line bg-wash/60 p-2">
          <Menu
            align="end"
            width={250}
            trigger={
              <button className="flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white">
                <UserRound className="h-4 w-4 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.75rem] font-medium text-muted">Owner</span>
                  <span className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink"><Avatar who={t.owner} size={22} />{PEOPLE[t.owner].name}</span>
                </span>
              </button>
            }
          >
            <MenuLabel>Hand it to</MenuLabel>
            {(['ys', 'office', 'estimator', 'materials', 'accounting'] as PersonKey[]).map((p) => (
              <MenuItem key={p} icon={<Avatar who={p} size={22} />} checked={t.owner === p} onSelect={() => reassign(t.id, p)} hint={PEOPLE[p].roleLabel}>
                {PEOPLE[p].name}
              </MenuItem>
            ))}
          </Menu>
          <Pop
            open={dueOpen}
            onOpenChange={setDueOpen}
            align="end"
            width={360}
            trigger={
              <button className="flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white">
                <CalendarDays className="h-4 w-4 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.75rem] font-medium text-muted">{t.state === 'waiting' ? 'Comes back' : 'Due'}</span>
                  <span className={cn('block text-[0.875rem] font-semibold', t.dueTone ? TONE[t.dueTone].strong : 'text-ink')}>{t.state === 'waiting' ? t.followUp : t.due || 'No date'}</span>
                </span>
              </button>
            }
          >
            <div className="mb-3 text-[0.90625rem] font-semibold text-ink">Change the date</div>
            <DatePresets value={t.due} onPick={(d) => { setDue(t.id, d); setDueOpen(false) }} />
          </Pop>
          <div className="flex items-center gap-3 rounded-xl p-2.5">
            <Tag className="h-4 w-4 text-muted" />
            <span>
              <span className="block text-[0.75rem] font-medium text-muted">Type</span>
              <span className="block text-[0.875rem] font-semibold text-ink">{t.type}</span>
            </span>
          </div>
          <button onClick={() => open({ t: 'job', id: job.id })} className="flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-white">
            <Building2 className="h-4 w-4 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.75rem] font-medium text-muted">Project</span>
              <span className="block truncate text-[0.875rem] font-semibold text-brand-700">{job.name}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-faint" />
          </button>
          {t.waitingOn && t.state === 'waiting' && (
            <div className="flex items-center gap-3 rounded-xl p-2.5">
              <Clock3 className="h-4 w-4 text-warn-600" />
              <span>
                <span className="block text-[0.75rem] font-medium text-muted">Waiting on</span>
                <span className="block text-[0.875rem] font-semibold text-ink">{t.waitingOn}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- New task ---------------- */
export function NewTaskModal({ level, jobId }: { level: number; jobId?: string }) {
  const close = useStore((s) => s.close)
  const addTask = useStore((s) => s.addTask)
  const jobs = useStore((s) => s.jobs)
  const role = useStore((s) => s.role)
  const [title, setTitle] = React.useState('')
  const [job, setJob] = React.useState<string>(jobId || '')
  const [q, setQ] = React.useState('')
  const [type, setType] = React.useState<TaskType>('Setup')
  const [owner, setOwner] = React.useState<PersonKey>(meOf(role))
  const [due, setDue] = React.useState('Tomorrow')
  const matches = Object.values(jobs).filter((j) => !q || `${j.name} ${j.client}`.toLowerCase().includes(q.toLowerCase())).slice(0, 5)
  return (
    <Modal
      level={level}
      size="md"
      onClose={close}
      title="New task"
      sub="One item for one thing that has to happen."
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button
            className="ml-auto"
            variant="primary"
            disabled={!title.trim() || !job}
            onClick={() => {
              addTask({ jobId: job, title: title.trim(), type, owner, due, for: owner === 'ys' ? ['owner', 'pm', 'site'] : ([({ office: 'office', estimator: 'estimator', materials: 'materials', accounting: 'accounting' } as any)[owner] || 'owner']), state: 'now', tone: 'info' })
              close()
            }}
          >
            Add task
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="What has to happen?">
          <TextInput data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Confirm the saddle size with the designer" />
        </Field>
        <Field label="Which project?">
          {job ? (
            <div className="flex items-center justify-between rounded-xl border border-line bg-wash px-3 py-2.5">
              <JobChip id={job} noLink className="text-[0.90625rem] font-semibold" size={28} />
              <Button size="xs" variant="ghost" onClick={() => setJob('')}>Change</Button>
            </div>
          ) : (
            <>
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" />
              <div className="mt-2 flex flex-col gap-1">
                {matches.map((j) => (
                  <button key={j.id} onClick={() => setJob(j.id)} className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-wash">
                    <span className="text-[0.875rem] font-semibold text-ink">{j.name}</span>
                    <span className="text-[0.78125rem] text-muted">{j.client}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </Field>
        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((ty) => (
              <Chip key={ty} on={type === ty} onClick={() => setType(ty)} className="h-9 px-3 text-[0.84375rem]">{ty}</Chip>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
          <Field label="Who has it">
            <div className="flex flex-wrap gap-2">
              {(['ys', 'office', 'estimator', 'materials', 'accounting'] as PersonKey[]).map((p) => (
                <button key={p} onClick={() => setOwner(p)} title={PEOPLE[p].name} className={cn('rounded-full p-0.5 ring-2 transition', owner === p ? 'ring-brand-500' : 'ring-transparent hover:ring-line')}>
                  <Avatar who={p} size={34} />
                </button>
              ))}
            </div>
            <div className="mt-1.5 text-[0.8125rem] text-muted">{PEOPLE[owner].name}</div>
          </Field>
          <Field label="Due">
            <DatePresets value={due} onPick={setDue} presets={['Today', 'Tomorrow', 'Fri', 'Next Mon']} />
          </Field>
        </div>
      </div>
    </Modal>
  )
}
