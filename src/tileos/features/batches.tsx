/* The same kind of thing many times, in one window — its row on Today is one line (see collapse in mytasks).
 *   Daily updates: every job a crew is on today, sent or not. Tap one: its update (it opens over this list and comes
 *     back here once it's sent). The row stays on Today until every one is sent.
 *   Things to bring: every pickup for the jobs, by project — On my way / Dropped off right on each line.
 *   The same step on many projects (get the tile paperwork from the store): the projects down the left, the one picked
 *     open on the right, done right there. */
import * as React from 'react'
import { Check, ChevronLeft, PackageCheck, Truck } from 'lucide-react'
import { useStore, meOf, isRequest } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { BAND_STRONG, bandStyle, bandLabel } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { md, TODAY } from '@/tileos/lib/today'
import type { Task } from '@/tileos/data/work'
import { dailyDue, taskIso } from './mytasks'
import { siteOf, realOwner, stepsFor, type StepView } from './steps'
import { StepIcon, stepWords } from './steps-ui'
import { StepInline, todoOf } from './stepwin'
import { useSmall } from '@/tileos/lib/phone'
import { TripButtons } from './requests'


export function DailiesModal({ who, level }: { who?: PersonKey; level: number }) {
  const s = useStore()
  const me = meOf(s.role)
  const person = (who || me) as PersonKey
  const due = () => {
    const st = useStore.getState()
    return dailyDue(st, 'site').filter((d) => !who || siteOf(st, st.jobs[d.jobId]) === who)
  }
  /* one line a job (yesterday's not sent says so on it) — the list as it was when it opened: sending one doesn't move
     the rest, it says Sent */
  const [list] = React.useState(() => { const all = due(); return Array.from(new Set(all.map((d) => d.jobId))).map((jobId) => ({ jobId, crew: all.find((d) => d.jobId === jobId)?.crew, missed: all.find((d) => d.jobId === jobId && d.missed)?.missed })) })
  const left = due()
  const sent = (d: { jobId: string }) => !left.some((x) => x.jobId === d.jobId)
  const sentN = list.filter(sent).length
  const theirs = person !== me && s.role !== 'site'
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Daily updates"
      sub={`${theirs ? `${PEOPLE[person]?.name || 'The site manager'} · ` : ''}${sentN} of ${list.length} sent`}
      footer={<Button className="ml-auto max-sm:flex-1" variant="primary" onClick={s.close} data-dailies-done>Done</Button>}
      bodyClass="p-0"
    >
      <div data-dailies>
        {list.map((d) => {
          const j = s.jobs[d.jobId]
          const ok = sent(d)
          const crew = d.crew && PEOPLE[d.crew] ? `${PEOPLE[d.crew].short}’s crew · ` : ''
          return (
            <div key={d.jobId} className="flex min-h-14 items-center gap-3 border-t border-line-2 px-5 py-2 first:border-t-0 max-sm:px-4" data-daily-row={d.jobId} data-sent={ok ? '1' : '0'}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-medium text-ink">{j?.name || 'A project'}</span>
                <span className="block truncate text-[0.8125rem] text-muted">{d.missed && !ok && <span className="font-medium text-bad-600">{md(d.missed)} not sent · </span>}{crew}{j?.pct ?? 0}% installed</span>
              </span>
              {ok
                ? <span className="inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-semibold text-[#2c8a5b]"><Check className="h-4 w-4" strokeWidth={2.5} />Sent</span>
                : theirs
                  ? <span className="shrink-0 text-[0.8125rem] text-muted">Not sent yet</span>
                  : <Button size="sm" className="shrink-0" onClick={() => s.open({ t: 'daily', jobId: d.jobId })} data-daily-send={d.jobId}>Send update</Button>}
            </div>
          )
        })}
        {!list.length && <div className="px-6 py-10 text-center text-[0.875rem] text-muted">Every daily update is sent.</div>}
      </div>
    </Modal>
  )
}

/** what's to be brought to the jobs, by project: each thing, who asked, by when — and On my way / Dropped off on it */
export function TripsModal({ who, day, level }: { who?: PersonKey; day?: string; level: number }) {
  const s = useStore()
  const me = meOf(s.role)
  const person = (who || me) as PersonKey
  /* today's and late together; a day ahead on its own — the list as it was when it opened */
  const inDay = (t: Task) => { const iso = taskIso(t); return day && day !== 'now' ? true : !iso || iso <= TODAY }
  const [ids] = React.useState(() => useStore.getState().tasks.filter((t) => isRequest(t) && t.state === 'now' && !t.urgent && realOwner(useStore.getState(), t.owner) === person && inDay(t)).map((t) => t.id))
  const list = ids.map((id) => s.tasks.find((t) => t.id === id)).filter((t): t is Task => !!t)
  const jobs = Array.from(new Set(list.map((t) => t.jobId)))
  const left = list.filter((t) => t.state !== 'done').length
  const mine = person === me || s.role === 'site'
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Things to bring"
      sub={`${mine ? '' : `${PEOPLE[person]?.name || ''} · `}${left ? `${left} still to drop off` : 'All dropped off'}`}
      footer={<Button className="ml-auto max-sm:flex-1" variant="primary" onClick={s.close} data-trips-done>Done</Button>}
      bodyClass="p-0"
    >
      <div data-trips>
        {jobs.map((jobId) => (
          <section key={jobId} aria-label={s.jobs[jobId]?.name || 'A project'}>
            <div className={cn(BAND_STRONG, 'px-5 max-sm:px-4')} style={bandStyle('neutral')} data-band><span className={bandLabel('neutral')}>{s.jobs[jobId]?.name || 'A project'}</span></div>
            {list.filter((t) => t.jobId === jobId).map((t) => {
              const done = t.state === 'done'
              const due = taskIso(t)
              const late = !done && !!due && due < TODAY
              return (
                <div key={t.id} className="flex min-h-14 items-center gap-3 border-t border-line-2 px-5 py-2 max-sm:flex-wrap max-sm:px-4" data-trip={t.id} data-done={done ? '1' : '0'}>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[0.9375rem]', done ? 'text-muted line-through decoration-faint' : 'font-medium text-ink')}>{t.req?.what || t.title}</span>
                    <span className={cn('block truncate text-[0.8125rem]', late ? 'font-medium text-bad-600' : 'text-muted')}>{[t.by && PEOPLE[t.by] ? `${t.by === me ? 'You' : PEOPLE[t.by].short} asked` : '', due ? (late ? `was due ${md(due)}` : due === TODAY ? 'today' : `by ${md(due)}`) : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                  {done
                    ? <span className="inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-semibold text-[#2c8a5b]"><PackageCheck className="h-4 w-4" />Dropped off</span>
                    : mine
                      ? <span className="shrink-0 max-sm:ml-auto"><TripButtons t={t} /></span>
                      : <span className="inline-flex shrink-0 items-center gap-1 text-[0.8125rem] text-muted">{t.req?.trip === 'onway' ? <><Truck className="h-4 w-4" />On the way</> : 'Not yet'}</span>}
                </div>
              )
            })}
          </section>
        ))}
        {!list.length && <div className="px-6 py-10 text-center text-[0.875rem] text-muted">Nothing to bring.</div>}
      </div>
    </Modal>
  )
}

/** the same step on many projects — the projects down the left (each: where it's at), the one picked open on the right,
 *  done right there. It opens on the first that isn't done. A phone: that project's step, with "All N projects" over it */
const STAY = () => {}
export function StepBatchModal({ k, jobs, level }: { k: string; jobs: string[]; level: number }) {
  const s = useStore()
  const small = useSmall()
  const me = meOf(s.role)
  const items = jobs.map((id) => { const job = s.jobs[id]; const v = job ? stepsFor(s, job).find((x) => x.key === k) : undefined; return job && v ? { job, v } : null }).filter((x): x is { job: Job; v: StepView } => !!x)
  const [at, setAt] = React.useState(() => items.find((x) => x.v.state !== 'done' && x.v.state !== 'na')?.job.id || items[0]?.job.id || '')
  const [picking, setPicking] = React.useState(false)
  if (!items.length) return null
  const cur = items.find((x) => x.job.id === at) || items[0]
  const doneN = items.filter((x) => x.v.state === 'done' || x.v.state === 'na').length
  return (
    <Modal level={level} size="lg" onClose={s.close} title={todoOf(items[0].v)} sub={doneN ? `${items.length} projects · ${doneN} done` : `${items.length} projects`} bodyClass="p-0">
      <div className="grid md:grid-cols-[17.5rem_minmax(0,1fr)]" data-step-batch={k}>
        {(!small || picking) && (
          <nav className="border-line py-2 md:border-r" aria-label="The projects" data-batch-list>
            {items.map((x) => {
              const on = !small && x.job.id === cur.job.id
              const w = stepWords(s, x.job, x.v, me)
              return (
                <button key={x.job.id} type="button" onClick={() => { setAt(x.job.id); setPicking(false) }} data-batch-job={x.job.id} data-state={x.v.state} {...(on ? { 'data-on': '' } : {})} className={cn('mx-2 flex min-h-11 w-[calc(100%-1rem)] min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left transition', on ? 'bg-brand-50 text-brand-800' : 'hover:bg-[rgba(17,19,24,0.035)]')}>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[0.9375rem] leading-snug', on ? 'font-semibold text-brand-800' : 'font-medium text-ink')}>{x.job.name}</span>
                    {x.v.state !== 'now' && <span className={cn('block truncate text-[0.8125rem] leading-snug', w.tone)}>{w.text}</span>}
                  </span>
                  {(x.v.state === 'done' || x.v.state === 'na') && <Check className="h-4 w-4 shrink-0 text-[#2c8a5b]" strokeWidth={2.5} />}
                </button>
              )
            })}
          </nav>
        )}
        {(!small || !picking) && (
          <div className="min-w-0 px-6 pb-6 pt-5 max-sm:px-4 max-sm:pt-3" data-batch-open={cur.job.id}>
            {small && <button type="button" onClick={() => setPicking(true)} className="mb-3 inline-flex min-h-10 items-center gap-1 text-[0.875rem] font-semibold text-brand-700" data-batch-all><ChevronLeft className="h-4 w-4" />All {items.length} projects</button>}
            <h3 className="mb-3 text-[1.0625rem] font-semibold leading-snug text-ink" data-batch-name>{cur.job.name}</h3>
            <StepInline key={cur.job.id + ':' + k} job={cur.job} v={cur.v} onClose={STAY} bare />
          </div>
        )}
      </div>
    </Modal>
  )
}
