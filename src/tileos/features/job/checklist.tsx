/* Two windows the project opens from its header:
 *   Getting ready — the whole checklist in one list, part by part (the paperwork, the design meeting, the site, the
 *     installer, the deliveries, the deposit): each step, where it stands, whose it is. Tap one to work on it.
 *   The installer — who's installing it, his days, his PO, the daily updates and the touch-ups. */
import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE } from '@/tileos/data/model'
import { labelFromIso, TODAY } from '@/tileos/lib/today'
import { isGettingReady, stepsFor, stepCounts, PHASES } from '../steps'
import { StepIcon } from '../steps-ui'
import { openStep, todoOf } from '../stepwin'
import { InstallerTab } from './crew-tab'
import { firstName } from './kit'

export function ChecklistModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  if (!job) return null
  const me = meOf(s.role)
  const ready = isGettingReady(job)
  const steps = ready ? stepsFor(s, job) : []
  const c = stepCounts(steps)
  return (
    <Modal level={level} size="lg" tall onClose={s.close} title="Getting ready" sub={ready ? `${job.name} · ${c.done} of ${c.total} done${c.bad ? ` · ${c.bad} problem${c.bad === 1 ? '' : 's'}` : ''}` : job.name}>
      {!ready && <div className="py-10 text-center text-[0.9375rem] text-muted">{['request', 'estimating', 'proposal', 'followup'].includes(job.stage) ? 'It starts once the estimate is won.' : 'Done — it was ready before the crew started.'}</div>}
      {/* one block per part — paperwork, the design meeting, the site, the installer, deliveries, the deposit — each with
          its own small bar. A part that's done folds to one line; tap it to see its steps again. */}
      {PHASES.map((ph) => {
        const items = steps.filter((v) => v.phase === ph.key)
        if (!items.length) return null
        const done = items.filter((v) => v.state === 'done' || v.state === 'na').length
        const all = done === items.length
        const bad = items.some((v) => v.state === 'bad')
        const shown = open[ph.key] ?? !all
        return (
          <section key={ph.key} className="mb-2.5 overflow-hidden rounded-[0.875rem] border border-line bg-white last:mb-0" data-part={ph.key}>
            <h3><button onClick={() => setOpen((o) => ({ ...o, [ph.key]: !shown }))} aria-expanded={shown} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f8f6f2]">
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{ph.label}</span>
              <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-[#ece8e1] max-sm:w-14" aria-hidden>
                <span className={cn('block h-full rounded-full', all ? 'bg-[#2c4a3e]' : bad ? 'bg-bad-500' : 'bg-brand-600')} style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
              </span>
              <span className={cn('w-[4.25rem] shrink-0 text-right text-[0.8125rem] tnum', all ? 'font-semibold text-[#2c4a3e]' : bad ? 'font-semibold text-bad-600' : 'text-ink-2')}>{all ? 'Done' : bad ? 'Problem' : `${done} of ${items.length}`}</span>
              <ChevronRight className={cn('h-4 w-4 shrink-0 text-faint transition-transform', shown && 'rotate-90')} />
            </button></h3>
            {shown && <div className="border-t border-line-2">
              {items.map((v) => {
                const late = v.due && v.due < TODAY && (v.state === 'now' || v.state === 'bad')
                return (
                  <button key={v.key} onClick={() => openStep(job.id, v.key)} className="flex w-full items-center gap-3 border-t border-line-2 py-2.5 pl-4 pr-4 text-left transition first:border-t-0 hover:bg-[#f8f6f2]">
                    <StepIcon state={v.state} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[0.875rem] font-semibold', v.state === 'done' || v.state === 'na' ? 'text-ink-2' : 'text-ink')}>{v.state === 'done' || v.state === 'na' ? v.label : todoOf(v)}</span>
                      {v.note && <span className={cn('block truncate text-[0.78125rem]', v.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{v.note}</span>}
                    </span>
                    {v.state !== 'done' && v.state !== 'na' && <span className={cn('shrink-0 text-[0.8125rem]', v.owner === me ? 'font-semibold text-ink' : 'text-ink-2')}>{v.owner === me ? 'You' : firstName(v.owner) || PEOPLE[v.owner]?.short}</span>}
                    {v.due && v.state !== 'done' && v.state !== 'na' && <span className={cn('w-[4.5rem] shrink-0 text-right text-[0.8125rem] tnum max-sm:hidden', late ? 'font-semibold text-bad-600' : 'text-muted')}>{labelFromIso(v.due)}</span>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                  </button>
                )
              })}
            </div>}
          </section>
        )
      })}
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
