/* Automations — what lands on each person's Today by itself. The system's own hand-offs and reminders (the site
 * manager's daily updates, the pay week, estimate follow-ups, invoice reminders…) and the repeating tasks the admin
 * sets for anyone ("send me how many people are on each job, every weekday at 4"). Each can be turned off. */
import * as React from 'react'
import { Repeat, AlarmClock, ClipboardList, HandCoins, BadgeCheck, PhoneCall, ListChecks, Receipt, Mail, Truck, Plus, Trash2, Building2 } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Button, CardHeader, IconCircle, Chip, TextInput } from '@/tileos/components/ui/core'
import { Card } from '@/tileos/components/ui/page'
import { Modal } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { REPEAT_LABEL, type Task } from '@/tileos/data/work'
import { companyTeam } from './estflow'
import { insidePeople } from './steps-ui'
import { matBy } from './flows'

const S = () => useStore.getState()

export interface AutoDef { key: string; who: (s: Store) => PersonKey; what: string; sub: string; when: (s: Store) => string; icon: React.ElementType; toggle: boolean; words: RegExp }
/* the real people: the site manager, whoever handles accounting (the admin if nobody does), the admin */
const onTeam = (s: Store, k?: string) => !!k && s.team.some((m) => m.key === k && m.status !== 'off')
const roleHolder = (s: Store, role: string) => s.team.find((m) => m.role === role && m.status !== 'off' && (m.email || m.uid || m.last))?.key as PersonKey | undefined
const boss = (s: Store) => meOf('owner')
const siteMgr = (s: Store) => roleHolder(s, 'site') || (onTeam(s, 'yakov') ? 'yakov' : boss(s))
const books = (s: Store) => roleHolder(s, 'accounting') || (onTeam(s, 'accounting') ? 'accounting' : boss(s))
export const AUTOS: AutoDef[] = [
  { key: 'daily-update', who: siteMgr, what: 'Daily update for each crew on site', sub: 'One per project with a crew working — how far each wall and floor moved, with photos. It’s what installer pay is figured from.', when: () => 'Every work day', icon: ClipboardList, toggle: true, words: /daily|update|progress|how far/i },
  { key: 'delivery', who: (s) => matBy(s), what: 'Check in each delivery', sub: 'On the day it’s due — all here, or short, wrong or broken', when: () => 'On the delivery day', icon: Truck, toggle: false, words: /deliver|check in|arriv/i },
  { key: 'pay-review', who: boss, what: 'Approve installer pay for the week', sub: 'Every installer’s week from the daily updates, next to his bill', when: () => 'Every Monday', icon: HandCoins, toggle: true, words: /\bpay\b|payroll|approve/i },
  { key: 'est-final', who: (s) => companyTeam(s).final, what: 'Final review of every estimate', sub: 'When the office review is done — approve it and it goes to the client', when: () => 'When it’s their turn', icon: BadgeCheck, toggle: false, words: /final review|review.*estimate/i },
  { key: 'est-followup', who: (s) => companyTeam(s).follow, what: 'Follow up on estimates that went out', sub: 'The client hasn’t answered — call or email, then set the next date', when: () => '3 work days after it’s sent', icon: PhoneCall, toggle: true, words: /follow.?up|estimate.*(sent|answer)/i },
  { key: 'steps', who: boss, what: 'Getting-ready steps, in order', sub: 'Every project’s steps — each lands on its own person’s Today when the one before it is done (Who does what)', when: () => 'When it’s their turn', icon: ListChecks, toggle: false, words: /paperwork|design meeting|site check|heights|installer|materials|tile delivery/i },
  { key: 'late', who: boss, what: 'What’s late — a pop-up for each person', sub: 'Once a day, the first time they open it: what’s past its date on their Today. You also see the team’s, with “Remind” — it pops up on their screen.', when: () => 'Once a day', icon: AlarmClock, toggle: true, words: /\blate\b|overdue|past due|behind/i },
  { key: 'inv-remind', who: books, what: 'Remind clients about unpaid invoices', sub: 'A reminder email, ready to send, until it’s paid', when: (s) => `Every ${s.rules.reminderDays} days after it’s due`, icon: Mail, toggle: true, words: /unpaid|invoice|remind.*pa/i },
  { key: 'billing-day', who: books, what: 'Bill last week’s progress', sub: 'What got installed on every project last week, from the daily updates — what to bill each client, one click per bill', when: () => 'Every Monday', icon: Receipt, toggle: true, words: /\bbill|billing/i },
]
export const autoOn = (s: Pick<Store, 'rules'>, key: string) => !(s.rules.autoOff || []).includes(key)
export function toggleAuto(key: string) {
  const on = autoOn(S(), key)
  const def = AUTOS.find((a) => a.key === key)
  S().commit((s) => { s.rules.autoOff = on ? [...(s.rules.autoOff || []), key] : (s.rules.autoOff || []).filter((k) => k !== key) }, `${def?.what || 'Automation'} — ${on ? 'off' : 'on'}`)
}
export function pauseRepeating(id: string) {
  const t0 = S().tasks.find((t) => t.id === id)
  S().commit((s) => { const t = s.tasks.find((x) => x.id === id); if (t) t.paused = !t.paused }, t0?.paused ? 'Back on' : 'Paused — it stops coming until you turn it back on')
}
export function removeRepeating(id: string) {
  S().commit((s) => { s.tasks = s.tasks.filter((t) => t.id !== id) }, 'Automation removed')
}

/** everyone inside the company who can get something on their Today — the admin first */
const peopleOf = (s: Store): PersonKey[] => { const ps = insidePeople(s); const b = meOf('owner'); return [b, ...ps.filter((p) => p !== b)].filter((p) => PEOPLE[p]) }
const roleOf = (s: Store, p: PersonKey): Role[] => { const r = s.team.find((m) => m.key === p)?.role; return r ? [r] : ['owner'] }

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={cn('relative h-5 w-9 shrink-0 rounded-full transition', on ? 'bg-ok-500' : 'bg-[#d0d5dc]')}>
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', on ? 'left-[1.125rem]' : 'left-0.5')} />
    </button>
  )
}

const ROW = 'grid grid-cols-[2rem_minmax(0,1fr)_11.875rem_6rem] items-center gap-3 border-t border-line-2 px-5 py-2.5 max-md:grid-cols-[2rem_minmax(0,1fr)_auto] max-sm:px-4'
export function AutomationsTab() {
  const s = useStore()
  const custom = s.tasks.filter((t) => t.repeat && t.state !== 'done')
  return (
    <Card pad={false} className="overflow-hidden">
      <CardHeader
        icon={<IconCircle tone="info" size={34}><Repeat className="h-4 w-4" /></IconCircle>}
        title="Automations — what lands on each person’s Today by itself"
        sub="The system’s own hand-offs and reminders run by themselves — turn any of them off. Your own are repeating reminders in your words: they land on someone’s Today on schedule."
        action={<Button size="sm" variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newauto' })}>New reminder</Button>}
      />
      {Array.from(new Set([...peopleOf(s), ...AUTOS.map((a) => a.who(s)), ...custom.map((t) => t.owner)])).map((p) => {
        const autos = AUTOS.filter((a) => a.who(s) === p)
        const mine = custom.filter((t) => t.owner === p)
        if (!autos.length && !mine.length) return null
        return (
          <section key={p}>
            <div className="flex items-center gap-2.5 border-t border-line bg-wash px-5 py-2 max-sm:px-4">
              <Avatar who={p} size={24} />
              <span className="text-[0.84375rem] font-semibold text-ink">{PEOPLE[p]?.name || p}</span>
              <span className="truncate text-[0.78125rem] text-muted">{PEOPLE[p]?.roleLabel}</span>
              <span className="ml-auto text-[0.78125rem] font-semibold tnum text-muted">{autos.length + mine.length}</span>
            </div>
            {autos.map((a) => {
              const on = autoOn(s, a.key)
              return (
                <div key={a.key} className={cn(ROW, !on && 'opacity-60')}>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.5625rem] bg-wash-2 text-ink-2"><a.icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{a.what}</span>
                    <span className="block truncate text-[0.78125rem] text-muted">{a.sub}</span>
                    <span className="block truncate text-[0.78125rem] font-medium text-ink-2 md:hidden">{a.when(s)}</span>
                  </span>
                  <span className="truncate text-[0.8125rem] text-ink-2 max-md:hidden">{a.when(s)}</span>
                  <span className="flex justify-end">{a.toggle ? <Switch on={on} onClick={() => toggleAuto(a.key)} label={a.what} /> : <span className="text-[0.75rem] font-medium text-faint">Always on</span>}</span>
                </div>
              )
            })}
            {mine.map((t) => (
              <div key={t.id} className={cn(ROW, t.paused && 'opacity-60')}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.5625rem] bg-brand-50 text-brand-600"><Repeat className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{t.title}<span className="ml-2 align-[0.0625rem] text-[0.71875rem] font-medium text-brand-600">yours</span></span>
                  <span className="block truncate text-[0.78125rem] text-muted">{s.jobs[t.jobId]?.name || 'Company'}{t.paused ? ' · paused' : ''}</span>
                  <span className="block truncate text-[0.78125rem] font-medium text-ink-2 md:hidden">{REPEAT_LABEL[t.repeat!]}{t.repeatAt ? ` at ${t.repeatAt}` : ''}</span>
                </span>
                <span className="truncate text-[0.8125rem] text-ink-2 max-md:hidden">{REPEAT_LABEL[t.repeat!]}{t.repeatAt ? ` at ${t.repeatAt}` : ''}</span>
                <span className="flex items-center justify-end gap-1.5">
                  <Switch on={!t.paused} onClick={() => pauseRepeating(t.id)} label={t.title} />
                  <button aria-label={`Remove ${t.title}`} onClick={() => removeRepeating(t.id)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-bad-50 hover:text-bad-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            ))}
          </section>
        )
      })}
    </Card>
  )
}

/* ================= a new automation: what, who, how often ================= */
export function NewAutomationModal({ level, who: who0 }: { level: number; who?: PersonKey }) {
  const s = useStore()
  const [title, setTitle] = React.useState('')
  const [owner, setOwner] = React.useState<PersonKey>(who0 || siteMgr(s))
  /* the words match something the system already does by itself — say so */
  const built = title.trim().length > 3 ? AUTOS.find((a) => a.words.test(title)) : undefined
  const [repeat, setRepeat] = React.useState<NonNullable<Task['repeat']>>('weekdays')
  const [at, setAt] = React.useState('4 PM')
  const [job, setJob] = React.useState('')
  const projects = Object.values(s.jobs).filter((j) => !['request', 'estimating', 'proposal', 'followup', 'complete'].includes(j.stage))
  const add = () => {
    if (!title.trim()) return
    s.addTask({ jobId: job, title: title.trim(), type: 'Field', owner, due: 'Today', for: roleOf(s, owner), state: 'now', tone: 'info', repeat, repeatAt: at, where: `${REPEAT_LABEL[repeat]} at ${at}`, watch: owner === meOf(s.role) ? [] : [s.role] })
    s.close()
  }
  const chip = 'h-8 px-2.5 text-[0.8125rem]'
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="A reminder that repeats"
      sub="It lands on their Today on schedule, in your words, and comes back when it’s done. It’s a reminder — it doesn’t do the work by itself."
      footer={
        <>
          <span className="truncate text-[0.8125rem] text-muted max-sm:hidden">{PEOPLE[owner]?.short} · {REPEAT_LABEL[repeat].toLowerCase()} at {at}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim()} onClick={add}>Add the reminder</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput mic data-autofocus aria-label="What should happen" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="The reminder — e.g. Send me how many people are on each job" className="h-12 rounded-[0.6875rem] text-[0.9375rem]" />
        {built && <div className="-mt-2 rounded-lg bg-brand-50 px-3 py-2 text-[0.8125rem] text-brand-800">The system already does this by itself: <b className="font-semibold">{built.what}</b> — {PEOPLE[built.who(s)]?.short}, {built.when(s).toLowerCase()}. It’s on the list behind this window.</div>}
        <div>
          <div className="mb-1.5 text-[0.78125rem] font-semibold text-muted">Who gets it</div>
          <div className="flex flex-wrap gap-1.5">{peopleOf(s).map((p) => <Chip key={p} on={owner === p} onClick={() => setOwner(p)} className={chip} icon={<Avatar who={p} size={18} />}>{PEOPLE[p]?.short}</Chip>)}</div>
        </div>
        <div>
          <div className="mb-1.5 text-[0.78125rem] font-semibold text-muted">How often</div>
          <div className="flex flex-wrap gap-1.5">{(Object.keys(REPEAT_LABEL) as NonNullable<Task['repeat']>[]).map((r) => <Chip key={r} on={repeat === r} onClick={() => setRepeat(r)} className={chip}>{REPEAT_LABEL[r]}</Chip>)}</div>
        </div>
        <div>
          <div className="mb-1.5 text-[0.78125rem] font-semibold text-muted">At</div>
          <div className="flex flex-wrap gap-1.5">{['8 AM', 'Noon', '4 PM', '6 PM'].map((x) => <Chip key={x} on={at === x} onClick={() => setAt(x)} className={chip}>{x}</Chip>)}</div>
        </div>
        <div>
          <div className="mb-1.5 text-[0.78125rem] font-semibold text-muted">For one project <span className="font-normal">(optional)</span></div>
          <SearchSelect value={job} onChange={setJob} emptyLabel="Company — not one project" placeholder="Project" icon={<Building2 />} options={projects.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} className="h-9" />
        </div>
      </div>
    </Modal>
  )
}
