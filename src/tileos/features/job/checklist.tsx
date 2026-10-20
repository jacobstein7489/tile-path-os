/* Two windows the project opens from its header:
 *   Getting ready — the whole checklist in one list, part by part (the paperwork, the design meeting, the site, the
 *     installer, the deliveries, the deposit): each step, where it stands, whose it is. Tap one to work on it.
 *   The installer — who's installing it, his days, his PO, the daily updates and the touch-ups. */
import * as React from 'react'
import { ChevronRight, ChevronLeft, Check } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE } from '@/tileos/data/model'
import { labelFromIso, TODAY } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, PHASES, type StepView } from '../steps'
import { StepIcon } from '../steps-ui'
import { openStep, todoOf } from '../stepwin'
import { InstallerTab } from './crew-tab'
import { firstName } from './kit'

export function ChecklistModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  /* the part you drilled into — nothing picked means the six parts side by side */
  const [part, setPart] = React.useState<string | null>(null)
  if (!job) return null
  const me = meOf(s.role)
  const ready = isGettingReady(job)
  const steps = ready ? stepsFor(s, job) : []
  const c = stepCounts(steps)
  const who = (v: StepView) => (v.owner === me ? 'You' : firstName(v.owner) || PEOPLE[v.owner]?.short)
  const isDone = (v: StepView) => v.state === 'done' || v.state === 'na'
  const parts = PHASES.map((ph) => {
    const items = steps.filter((v) => v.phase === ph.key)
    const done = items.filter(isDone).length
    const bad = items.find((v) => v.state === 'bad')
    /* the next thing in this part: a problem first, then whatever's up now */
    const next = bad || items.find((v) => v.state === 'now') || items.find((v) => !isDone(v))
    return { ph, items, done, all: items.length > 0 && done === items.length, bad: !!bad, next }
  }).filter((p) => p.items.length)
  const open = parts.find((p) => p.ph.key === part)
  const StepRow = ({ v }: { v: StepView }) => {
    const late = v.due && v.due < TODAY && (v.state === 'now' || v.state === 'bad')
    return (
      <button onClick={() => openStep(job.id, v.key)} className="flex w-full items-center gap-3 border-t border-line-2 py-2.5 pl-4 pr-4 text-left transition first:border-t-0 hover:bg-[#f8f6f2]">
        <StepIcon state={v.state} size={24} />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-[0.875rem] font-semibold', isDone(v) ? 'text-ink-2' : 'text-ink')}>{isDone(v) ? v.label : todoOf(v)}</span>
          {v.note && <span className={cn('block truncate text-[0.78125rem]', v.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{v.note}</span>}
        </span>
        {!isDone(v) && <span className={cn('shrink-0 text-[0.8125rem]', v.owner === me ? 'font-semibold text-ink' : 'text-ink-2')}>{who(v)}</span>}
        {v.due && !isDone(v) && <span className={cn('w-[4.5rem] shrink-0 text-right text-[0.8125rem] tnum max-sm:hidden', late ? 'font-semibold text-bad-600' : 'text-muted')}>{labelFromIso(v.due)}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </button>
    )
  }
  return (
    <Modal level={level} size="lg" onClose={s.close} title="Getting ready" sub={ready ? `${job.name} · ${c.done} of ${c.total} done${c.bad ? ` · ${c.bad} problem${c.bad === 1 ? '' : 's'}` : ''}` : job.name}>
      {!ready && <div className="py-10 text-center text-[0.9375rem] text-muted">{['request', 'estimating', 'proposal', 'followup'].includes(job.stage) ? 'It starts once the estimate is won.' : 'Done — it was ready before the crew started.'}</div>}
      {open ? (
        /* one part, every step */
        <div>
          <button onClick={() => setPart(null)} className="mb-3 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700 hover:text-brand-800"><ChevronLeft className="h-4 w-4" />All six parts</button>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-[1rem] font-semibold text-ink">{open.ph.label}</h3>
            <span className={cn('text-[0.8125rem] tnum', open.all ? 'font-semibold text-[#2c4a3e]' : open.bad ? 'font-semibold text-bad-600' : 'text-muted')}>{open.all ? 'Done' : `${open.done} of ${open.items.length} done`}</span>
          </div>
          <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">{open.items.map((v) => <StepRow key={v.key} v={v} />)}</div>
        </div>
      ) : (
        /* six parts side by side — each with its small bar and the one next thing; tap the name for every step */
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {parts.map(({ ph, items, done, all, bad, next }) => (
            <section key={ph.key} data-part={ph.key} className={cn('flex flex-col overflow-hidden rounded-[0.875rem] border bg-white', bad ? 'border-bad-200' : 'border-line')}>
              <h3><button onClick={() => setPart(ph.key)} aria-label={`${ph.label} — ${all ? 'done' : bad ? 'problem' : `${done} of ${items.length} done`}`} className="flex w-full items-center gap-3 px-4 pb-2 pt-3.5 text-left transition hover:bg-[#f8f6f2]">
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{ph.label}</span>
                <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[#ece8e1]" aria-hidden>
                  <span className={cn('block h-full rounded-full', all ? 'bg-[#2c4a3e]' : bad ? 'bg-bad-500' : 'bg-brand-600')} style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
                </span>
                <span className={cn('shrink-0 text-[0.8125rem] tnum', all ? 'font-semibold text-[#2c4a3e]' : bad ? 'font-semibold text-bad-600' : 'text-ink-2')}>{all ? 'Done' : bad ? 'Problem' : `${done} of ${items.length}`}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
              </button></h3>
              {next ? (
                <button onClick={() => openStep(job.id, next.key)} className="flex w-full flex-1 items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left transition hover:bg-[#f8f6f2]">
                  <StepIcon state={next.state} size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{todoOf(next)}</span>
                    <span className={cn('block truncate text-[0.78125rem]', next.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{[next.note, who(next)].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              ) : (
                <div className="flex flex-1 items-center gap-2 border-t border-line-2 px-4 py-2.5 text-[0.8125rem] text-muted"><Check className="h-4 w-4 text-[#2c4a3e]" />All done</div>
              )}
            </section>
          ))}
        </div>
      )}
    </Modal>
  )
}

export function InstallerModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  return (
    <Modal level={level} size="xl" tall onClose={s.close} title="The installer" sub={job.name} bodyClass="bg-canvas p-5 max-sm:p-3">
      <InstallerTab job={job} />
    </Modal>
  )
}
