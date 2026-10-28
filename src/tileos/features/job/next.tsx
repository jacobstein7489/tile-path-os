/* What's next on the project — on Where it stands, the one thing to do now, next to what it's about:
 *   getting ready (on a phone — on a computer the step itself is open): your turn on a step, or whose turn it is;
 *   then: schedule the crew, start the job, the return visit, the final invoice. Installing has nothing to press here:
 *   the daily update is on the site manager's Today.
 * It used to be a bar at the bottom of the window, away from everything it was about. */
import * as React from 'react'
import { ArrowRight, CalendarDays, Play, Receipt, Hourglass, Check } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Pop } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job } from '@/tileos/data/model'
import { readyForCrew, startProject } from '../flows'
import { todoOf, remindStep } from '../stepwin'
import { nextOn } from './plan'
import { tracksFor, phaseOf, bookingOf, trackOf, TRACKS } from '../tracks'

/** the card: a mark, a small line (whose turn, which part), what it is — and the one button */
function Card({ tone, mark, top, title, sub, action }: { tone: 'mine' | 'calm'; mark: React.ReactNode; top: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <section data-next={tone} className={cn('flex min-w-0 items-center gap-3 rounded-[0.875rem] border px-4 py-3 max-sm:flex-wrap max-sm:px-3', tone === 'mine' ? 'border-brand-200 bg-brand-50/70' : 'border-line bg-white')}>
      <span className="shrink-0">{mark}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[0.75rem] font-semibold', tone === 'mine' ? 'text-brand-700' : 'text-muted')}>{top}</span>
        <span className="block truncate text-[0.96875rem] font-semibold leading-snug text-ink max-sm:whitespace-normal">{title}</span>
        {sub && <span className="block truncate text-[0.8125rem] text-muted">{sub}</span>}
      </span>
      {action && <span className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{action}</span>}
    </section>
  )
}
const Mark = ({ children, tone }: { children: React.ReactNode; tone: 'mine' | 'calm' }) => (
  <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]', tone === 'mine' ? 'bg-brand-600 text-white' : 'bg-wash-2 text-ink-2')}>{children}</span>
)

/** what's next on this project — nothing for the crew or the client to press here */
export function NextUp({ job, onStep }: { job: Job; onStep: (k: string) => void }) {
  const s = useStore()
  if (['client', 'crew'].includes(s.role)) return null
  const tracks = tracksFor(s, job)
  const phase = phaseOf(s, job, tracks)
  const booked = job.stage === 'scheduled' || !!bookingOf(s, job)
  const finalBill = s.money.find((m) => m.jobId === job.id && m.kind === 'final')
  if (phase === 'ready' && !booked) {
    const next = nextOn(s, job)
    if (!next) return <Card tone="calm" mark={<Mark tone="calm"><Hourglass /></Mark>} top="Waiting" title="Nothing to do here right now" sub="Each part comes back on someone’s list by itself" />
    const v = next.v
    const part = TRACKS.find((t) => t.key === trackOf(v))?.label
    if (next.mine)
      return <Card tone="mine" mark={<Mark tone="mine"><ArrowRight /></Mark>} top={`Your turn${part ? ` · ${part}` : ''}`} title={todoOf(v)} action={<Button variant="primary" data-your-turn onClick={() => onStep(v.key)}>Open it</Button>} />
    return (
      <Card tone="calm" mark={<Avatar who={v.owner} size={36} />} top={`${PEOPLE[v.owner]?.short || 'Someone'}’s turn${part ? ` · ${part}` : ''}`} title={todoOf(v)}
        action={<><Button onClick={() => onStep(v.key)}>Open it</Button><Button onClick={() => remindStep(job, v)} data-remind-step>Remind {PEOPLE[v.owner]?.short || 'them'}</Button></>} />
    )
  }
  if (phase === 'ready' && booked) {
    const open = tracks.filter((t) => t.state !== 'done')
    return <Card tone="mine" mark={<Mark tone="mine"><Play /></Mark>} top="Next" title="Start the job" sub={open.length ? `The crew is on the calendar — ${open.length} part${open.length === 1 ? '' : 's'} of getting ready still open` : 'The crew is on the calendar'} action={<StartJob job={job} open={open} />} />
  }
  if (phase === 'crew')
    return booked
      ? <Card tone="mine" mark={<Mark tone="mine"><Play /></Mark>} top="Next" title="Start the job" sub="Getting ready is done and the crew is on the calendar" action={<Button variant="primary" icon={<Play />} onClick={() => startProject(job.id)}>Start the job</Button>} />
      : <Card tone="mine" mark={<Mark tone="mine"><CalendarDays /></Mark>} top="Next" title="Schedule the crew" sub="All five parts of getting ready are done" action={<Button variant="primary" icon={<CalendarDays />} data-schedule-crew onClick={() => { readyForCrew(job.id); s.open({ t: 'assign', jobId: job.id }) }}>Schedule the crew</Button>} />
  /* installing: nothing to press here — the daily update is on the site manager's Today, every day */
  if (phase === 'install') return null
  if (phase === 'punch')
    return <Card tone="mine" mark={<Mark tone="mine"><CalendarDays /></Mark>} top="Next" title="Book the return visit" sub="For the touch-ups" action={<Button variant="primary" icon={<CalendarDays />} onClick={() => s.open({ t: 'assign', jobId: job.id })}>Book the return visit</Button>} />
  if (job.stage === 'closeout' && finalBill)
    return <Card tone="mine" mark={<Mark tone="mine"><Receipt /></Mark>} top="Next" title="The final invoice" action={<Button variant="primary" icon={<Receipt />} onClick={() => s.open({ t: 'money', id: finalBill.id })}>Final invoice</Button>} />
  if (job.stage === 'complete')
    return <Card tone="calm" mark={<Mark tone="calm"><Check /></Mark>} top="Closed" title="This project is done" sub={job.dates?.finish ? `Finished ${job.dates.finish} · paid and closed` : 'Paid and closed'} />
  return null
}

/** the crew is on the calendar but getting ready isn't all done: start it — after saying what's still open */
function StartJob({ job, open }: { job: Job; open: { label: string; lead?: { short: string } }[] }) {
  const [ask, setAsk] = React.useState(false)
  if (!open.length) return <Button variant="primary" icon={<Play />} onClick={() => startProject(job.id)}>Start the job</Button>
  return (
    <Pop open={ask} onOpenChange={setAsk} align="end" side="bottom" width={340} trigger={<Button variant="primary" icon={<Play />}>Start the job</Button>}>
      <div className="text-[0.9375rem] font-semibold text-ink">Getting ready isn’t done</div>
      <ul className="mt-1.5 flex flex-col gap-0.5 text-[0.84375rem] text-ink-2" data-still-open>
        {open.map((t) => <li key={t.label}><b className="font-semibold">{t.label}</b>{t.lead ? ` — ${t.lead.short.toLowerCase()}` : ''}</li>)}
      </ul>
      <p className="mt-2 text-[0.8125rem] text-muted">The crew is already on the calendar. Start anyway, and these stay open for whoever has them.</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setAsk(false)}>Not yet</Button>
        <Button variant="primary" icon={<Play />} onClick={() => { setAsk(false); startProject(job.id) }}>Start anyway</Button>
      </div>
    </Pop>
  )
}
