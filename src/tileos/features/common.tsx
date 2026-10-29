import * as React from 'react'
import { FileText, LayoutGrid, Package, HardHat, ArrowLeftRight, CalendarDays, Receipt, Ban, Clock, Check, MoonStar } from 'lucide-react'
import { useStore } from '@/tileos/store'
import type { Task, TaskType } from '@/tileos/data/work'
import { cn, TONE } from '@/tileos/lib/utils'
import { Swatch } from '@/tileos/components/ui/swatch'
import { Avatar, Pill } from '@/tileos/components/ui/core'
import type { Tone } from '@/tileos/data/model'

export const TYPE_ICON: Record<TaskType, React.ElementType> = {
  Pricing: FileText, Setup: LayoutGrid, Materials: Package, Field: HardHat, Changes: ArrowLeftRight, Schedule: CalendarDays, Money: Receipt,
}

export function JobChip({ id, className, size = 20, noLink }: { id: string; className?: string; size?: number; noLink?: boolean }) {
  const job = useStore((s) => s.jobs[id])
  const open = useStore((s) => s.open)
  if (!job) return null
  const inner = (
    <>
      <span className="truncate">{job.name}</span>
    </>
  )
  if (noLink) return <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>{inner}</span>
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        open({ t: 'job', id })
      }}
      className={cn('inline-flex min-w-0 items-center gap-2 hover:text-brand-700 hover:underline decoration-brand-200 underline-offset-2', className)}
    >
      {inner}
    </button>
  )
}

export function dueLabel(t: Task): { text: string; tone: Tone } {
  if (t.state === 'waiting') return { text: `${t.waitingOn} · ${t.followUp}`, tone: 'warn' }
  if (t.state === 'later') return { text: `Back ${t.laterUntil}`, tone: 'neutral' }
  if (t.state === 'done') return { text: t.doneAt || 'Done', tone: 'ok' }
  return { text: t.due || '—', tone: (t.dueTone as Tone) || 'neutral' }
}

/* Compact priority card (Today) — job · where, what, one status */
export function PriorityCard({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const job = useStore((s) => s.jobs[t.jobId])
  const d = dueLabel(t)
  const bar = t.state === 'waiting' ? 'bg-warn-500' : TONE[t.tone].bar
  return (
    <button onClick={onOpen} className="group relative flex w-full items-start gap-3 overflow-hidden rounded-xl border border-line bg-white py-3.5 pl-4 pr-3.5 text-left transition hover:border-[#d2d9e4] hover:shadow-raise">
      <span className={cn('absolute inset-y-2.5 left-0 w-[0.1875rem] rounded-r-full', bar)} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[0.78125rem] text-muted">
          <span className="max-w-[62%] shrink-0 truncate font-semibold text-ink-2">{job?.name}</span>
          {t.where && <span className="min-w-0 truncate">· {t.where}</span>}
        </span>
        <span className="mt-1 line-clamp-2 block text-[0.90625rem] font-semibold leading-snug text-ink">{t.title}</span>
      </span>
      <Pill tone={d.tone} size="sm" className="mt-0.5">
        {d.text}
      </Pill>
    </button>
  )
}

/* Full task row (Tasks page, job pages) */
export function TaskRow({ t, showJob = true, compact }: { t: Task; showJob?: boolean; compact?: boolean }) {
  const open = useStore((s) => s.open)
  const completeTask = useStore((s) => s.completeTask)
  const reopenTask = useStore((s) => s.reopenTask)
  const job = useStore((s) => s.jobs[t.jobId])
  const [leaving, setLeaving] = React.useState(false)
  const Icon = TYPE_ICON[t.type]
  const d = dueLabel(t)
  const done = t.state === 'done'
  return (
    <div
      onClick={() => open({ t: 'task', id: t.id })}
      className={cn('group flex cursor-pointer items-center gap-4 border-b border-line-2 px-5 transition-colors last:border-0 row-hover max-sm:gap-3 max-sm:px-4', compact ? 'py-3' : 'py-3.5', leaving && 'row-out')}
    >
      <button
        aria-label={done ? 'Reopen' : 'Mark done'}
        onClick={(e) => {
          e.stopPropagation()
          if (done) return reopenTask(t.id)
          setLeaving(true)
          setTimeout(() => completeTask(t.id), 240)
        }}
        className={cn(
          'inline-flex h-[1.5rem] w-[1.5rem] shrink-0 items-center justify-center rounded-full border-2 transition',
          done ? 'border-ok-500 bg-ok-500 text-white' : 'border-[#CBD3DE] text-transparent hover:border-ok-500 hover:bg-ok-50 hover:text-ok-600',
          leaving && 'check-pop border-ok-500 bg-ok-500 text-white',
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-[0.9375rem] font-medium max-sm:line-clamp-2 max-sm:whitespace-normal max-sm:text-[0.90625rem] max-sm:leading-snug', done ? 'text-muted line-through decoration-faint' : 'text-ink')}>{t.title}</div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-[0.8125rem] text-muted">
          {showJob && job && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="truncate font-medium text-ink-2">{job.name}</span>
            </span>
          )}
          {t.where && <span className={cn('truncate', showJob && 'max-sm:hidden')}>{showJob ? '· ' : ''}{t.where}</span>}
        </div>
      </div>
      {t.blocks && t.state !== 'done' && !compact && (
        <span className="hidden max-w-[15rem] shrink-0 items-center gap-1.5 truncate text-[0.78125rem] font-medium text-bad-700 xl:inline-flex">
          <Ban className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Holds up {t.blocks}</span>
        </span>
      )}
      <span className={cn('inline-flex w-[9.375rem] shrink-0 items-center justify-end gap-1.5 text-right text-[0.84375rem] max-sm:w-auto max-sm:max-w-[6.5rem] max-sm:text-[0.78125rem]', d.tone === 'bad' ? 'font-semibold text-bad-700' : d.tone === 'warn' ? 'text-warn-700' : 'text-muted')}>
        {t.state === 'waiting' ? <Clock className="h-3.5 w-3.5" /> : t.state === 'later' ? <MoonStar className="h-3.5 w-3.5" /> : null}
        <span className="truncate">{d.text}</span>
      </span>
      <Avatar who={t.owner} size={30} className="max-sm:hidden" />
    </div>
  )
}
