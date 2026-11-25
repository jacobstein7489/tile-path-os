/* Ordered (or bought): how it gets to the job, and the day it should be there. Then it's followed to the end by
 * itself, so nobody has to remember it:
 *   the store delivers     it waits on the store; that day it's back on Today: Came in? → It came · Not yet
 *   someone picks it up    it's on their Today that day (Bring to 401 North 5th: … · On the way · Dropped off), and
 *                          whoever ordered it hears when it's on the way and when it's there
 *   bought, it's there     done */
import * as React from 'react'
import { Truck, UserRound, PackageCheck, Check } from 'lucide-react'
import { useStore, newTask, addHist, meOf, NOW, clockNow } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { DatePresets } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'
import { TODAY, isoFromLabel, labelFromIso, addDays, dow } from '@/tileos/lib/today'
import { insidePeople } from './steps-ui'
import { nextOf, whatOf } from './nextstep'

type How = { by: 'store'; day: string } | { by: 'person'; who: PersonKey; day: string } | { by: 'here' }
/** the days to pick from, in order: Today, Tomorrow, then the next work days ("Fri", "Next Mon", "Tue") */
const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const daysAhead = (from = 0) => {
  const out = ['Today', 'Tomorrow'].slice(from)
  for (let i = 2; out.length < 5 - from && i < 10; i++) { const w = dow(addDays(TODAY, i)); if (w > 0 && w < 6) out.push(w === 1 ? 'Next Mon' : NAMES[w]) }
  return out
}
/** "tomorrow", "on Thu" — the day, said in a sentence */
const onDay = (d: string) => (/^(today|tomorrow)$/i.test(d) ? d.toLowerCase() : `on ${d}`)
/** the store it comes from: the project's tile store (Change the project's details), else "the store" */
const storeOf = (t: Pick<Task, 'jobId'>) => useStore.getState().jobs[t.jobId]?.tileStore || ''

/** it's ordered: the store brings it (it waits for it), someone picks it up (on their Today), or it's there already */
export function markOrdered(id: string, how: How) {
  const S = useStore.getState()
  const t = S.tasks.find((x) => x.id === id)
  if (!t) return
  if (how.by === 'here') { S.completeTask(id, 'Bought. It’s there'); return }
  const job = S.jobs[t.jobId]
  const me = meOf(S.role)
  const word = nextOf(t.title)?.kind === 'buy' ? 'Bought' : 'Ordered'
  const store = storeOf(t)
  const what = whatOf(t.title)
  if (how.by === 'store') {
    const from = store || 'The store'
    S.commit((st) => {
      const x = st.tasks.find((y) => y.id === id)
      if (!x) return
      x.state = 'waiting'
      x.waitingOn = from
      x.followUp = how.day
      x.coming = true
      ;(x.log ||= []).push({ date: NOW, time: clockNow(), who: me, text: `${word} · ${from} delivers · ${how.day}` })
      if (x.jobId) addHist(st, x.jobId, { who: me, kind: 'material', title: `${word} · ${what}`, detail: `${from} delivers ${onDay(how.day)}` })
    }, `${word}. ${from} delivers ${onDay(how.day)}`, { tone: 'wait', sub: `That day it’s back on Today, to check it came.` })
    return
  }
  /* someone picks it up: on their Today that day — the same as anything asked for on site */
  const who = how.who
  const short = who === me ? 'You' : PEOPLE[who]?.short || 'Someone'
  const due = labelFromIso(isoFromLabel(how.day) || TODAY) || how.day
  S.commit((st) => {
    const x = st.tasks.find((y) => y.id === id)
    if (!x) return
    x.state = 'done'
    x.doneAt = 'Just now'
    x.doneOn = TODAY
    x.result = `${word}. ${short} ${who === me ? 'pick' : 'picks'} it up ${onDay(due)}${store ? ` at ${store}` : ''}`
    ;(x.log ||= []).push({ date: NOW, time: clockNow(), who: me, text: `${word} · ${PEOPLE[who]?.short || 'someone'} picks it up · ${due}` })
    const role = st.team.find((m) => m.key === who)?.role || 'site'
    newTask(st, {
      jobId: x.jobId, title: `Bring to ${job?.name || 'the site'}: ${what}`, detail: store ? `Pick it up at ${store}` : `${word}. Pick it up`,
      type: 'Materials', owner: who, for: [role], by: me, followers: who === me ? [] : [me], state: 'now', due, tone: 'warn',
      req: { what, trip: 'asked' }, where: job?.address, log: [{ date: NOW, time: clockNow(), who: me, text: `${word}${store ? ` at ${store}` : ''} · pick it up ${due}` }],
    } as Partial<Task> & { jobId: string; title: string })
    if (who !== me) st.notices.unshift({ id: 'no' + Date.now().toString(36), jobId: x.jobId, text: `${PEOPLE[me]?.short || 'Someone'} needs you to pick up ${what}${store ? ` at ${store}` : ''} · ${due}`, when: 'Just now', kind: 'material', unread: true, for: [who] })
    if (x.jobId) addHist(st, x.jobId, { who: me, kind: 'material', title: `${word} · ${what}`, detail: `${PEOPLE[who]?.short || 'Someone'} picks it up ${onDay(due)}` })
  }, who === me ? `${word}. It’s on your Today ${onDay(due)}` : `${word}. ${short} picks it up`, { tone: who === me ? undefined : 'wait', sub: who === me ? 'Pick it up, then Dropped off.' : `It’s on ${short}’s Today ${onDay(due)}. You hear when it’s there.`, to: who === me ? undefined : [{ who, what: `Pick up ${what}` }] })
}
/** it came: done (whoever watches it hears) */
export const cameIn = (id: string) => useStore.getState().completeTask(id, 'Came in')
/** not here yet: back on Today on the new day */
export function notYet(id: string, day: string) {
  const S = useStore.getState()
  S.commit((st) => {
    const x = st.tasks.find((y) => y.id === id)
    if (!x) return
    x.followUp = day
    x.followUps = (x.followUps || 0) + 1
    ;(x.log ||= []).push({ date: NOW, time: clockNow(), who: meOf(st.role), text: `Not here yet · back ${day}` })
  }, `Not here yet · back ${onDay(day)}`, { tone: 'wait', sub: 'That day it’s back on Today.' })
}

/** not here yet on its day: when now (it's back on Today that day) */
export function NotYetPanel({ t, onDone }: { t: Task; onDone: () => void }) {
  const [day, setDay] = React.useState('Tomorrow')
  return (
    <div data-not-yet-panel>
      <div className="text-[0.9375rem] font-semibold text-ink">When should it be there now?</div>
      <div className="mb-0.5 mt-0.5 text-[0.8125rem] text-muted">From {t.waitingOn || 'the store'}. That day it’s back on Today.</div>
      <div className="mt-3"><DatePresets value={day} onPick={setDay} presets={daysAhead(1)} /></div>
      <div className="mt-5 flex justify-end">
        <Button variant="primary" className="max-sm:h-12 max-sm:flex-1 max-sm:text-[1rem]" onClick={() => { notYet(t.id, day); onDone() }} data-not-yet-save>Save</Button>
      </div>
    </div>
  )
}

/** a choice, a whole line: its icon, its words, a check when it's the one */
function Choice({ on, icon, label, onClick, attr }: { on: boolean; icon: React.ReactNode; label: string; onClick: () => void; attr: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} data-ordered-how={attr}
      className={cn('flex h-12 w-full items-center gap-3 rounded-xl border px-3.5 text-left text-[0.9375rem] transition [&>svg]:h-[1.125rem] [&>svg]:w-[1.125rem] [&>svg]:shrink-0', on ? 'border-brand-300 bg-brand-50/70 text-ink [&>svg:first-child]:text-brand-600' : 'border-line bg-white text-ink-2 hover:bg-wash [&>svg:first-child]:text-faint')}>
      {icon}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {on && <Check className="text-brand-600" strokeWidth={2.5} />}
    </button>
  )
}

/** the little window over Ordered: how it gets there, and the day */
export function OrderedPanel({ t, onDone }: { t: Task; onDone: () => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const bought = nextOf(t.title)?.kind === 'buy'
  const store = s.jobs[t.jobId]?.tileStore
  const [how, setHow] = React.useState<'store' | 'person' | 'here'>(bought ? 'here' : 'store')
  const [who, setWho] = React.useState<PersonKey | undefined>()
  const [day, setDay] = React.useState('Tomorrow')
  const people = insidePeople(s).sort((a, b) => Number(b === me) - Number(a === me))
  const ready = how !== 'person' || !!who
  const save = () => { markOrdered(t.id, how === 'here' ? { by: 'here' } : how === 'store' ? { by: 'store', day } : { by: 'person', who: who!, day }); onDone() }
  return (
    <div data-ordered-panel>
      <div className="text-[0.9375rem] font-semibold text-ink">{bought ? 'Bought. Where is it?' : 'Ordered. How does it get there?'}</div>
      <div className="mt-3 flex flex-col gap-2" role="radiogroup">
        {bought
          ? <Choice on={how === 'here'} icon={<PackageCheck />} label="It’s there already" onClick={() => setHow('here')} attr="here" />
          : <Choice on={how === 'store'} icon={<Truck />} label={`${store || 'The store'} delivers`} onClick={() => setHow('store')} attr="store" />}
        <Choice on={how === 'person'} icon={<UserRound />} label={bought ? 'Someone brings it' : 'Someone picks it up'} onClick={() => setHow('person')} attr="person" />
      </div>
      {how === 'person' && (
        <div className="mt-3 flex flex-wrap gap-1.5" data-ordered-who>
          {people.map((p) => (
            <button key={p} type="button" onClick={() => setWho(p)} aria-pressed={who === p} data-ordered-person={p}
              className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border pl-1 pr-3 text-[0.875rem] transition', who === p ? 'border-brand-300 bg-brand-50 font-medium text-brand-800' : 'border-line bg-white text-ink-2 hover:bg-wash')}>
              <Avatar who={p} size={26} />{p === me ? 'Me' : PEOPLE[p]?.short || p}
            </button>
          ))}
        </div>
      )}
      {how !== 'here' && (
        <>
          <div className="mt-4 text-[0.9375rem] font-semibold text-ink">{how === 'store' ? 'When should it be there?' : 'Which day?'}</div>
          <div className="mt-2" data-ordered-day><DatePresets value={day} onPick={setDay} presets={daysAhead()} /></div>
        </>
      )}
      <div className="mt-5 flex justify-end">
        <Button variant="primary" className="max-sm:h-12 max-sm:flex-1 max-sm:text-[1rem]" disabled={!ready} onClick={save} data-ordered-save>Save</Button>
      </div>
    </div>
  )
}
