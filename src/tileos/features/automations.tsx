/* Automations — what lands on each person's Today by itself. The system's own hand-offs and reminders (the site
 * manager's daily updates, the pay week, estimate follow-ups, invoice reminders…) and the repeating tasks the admin
 * sets for anyone ("send me how many people are on each job, every weekday at 4"). Tap any one — the app's own too —
 * and one small window changes it: who gets it (where the company sets that), on or off; your own also what and when. */
import * as React from 'react'
import { Repeat, AlarmClock, ClipboardList, HandCoins, BadgeCheck, PhoneCall, ListChecks, Receipt, Mail, Truck, Plus, Trash2, Building2, ChevronDown, Clock3, HardHat, MapPinned } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Button, CardHeader, IconCircle } from '@/tileos/components/ui/core'
import { Card } from '@/tileos/components/ui/page'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { SuggestInput } from '@/tileos/components/ui/suggest'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { REPEAT_LABEL, type Task } from '@/tileos/data/work'
import { companyTeam } from './estflow'
import { setCompanyPeople } from './estpeople'
import { insidePeople } from './steps-ui'
import { matBy } from './flows'
import { crewMailPeople, crewMailWords, emailCrewList, mailLive, type CrewLine } from './mailout'
import { crewLines, nextWorkDay } from './mytasks'
import { showPop } from '@/tileos/lib/pop'
import { PUBLISHED } from '@/tileos/lib/save'
import { autoWho } from './autowho'
import { TODAY } from '@/tileos/lib/today'

const S = () => useStore.getState()

export interface AutoDef { key: string; who: (s: Store) => PersonKey; what: string; sub: string; /** the list's one short line (the window says it all) */ short?: string; when: (s: Store) => string; icon: React.ElementType; toggle: boolean; words: RegExp }
/* the real people: the site manager, whoever handles accounting (the admin if nobody does), the admin */
const onTeam = (s: Store, k?: string) => !!k && s.team.some((m) => m.key === k && m.status !== 'off')
const roleHolder = (s: Store, role: string) => s.team.find((m) => m.role === role && m.status !== 'off' && (m.email || m.uid || m.last))?.key as PersonKey | undefined
const boss = (s: Store) => meOf('owner')
const siteMgr = (s: Store) => roleHolder(s, 'site') || (onTeam(s, 'yakov') ? 'yakov' : boss(s))
const books = (s: Store) => roleHolder(s, 'accounting') || (onTeam(s, 'accounting') ? 'accounting' : boss(s))
export const AUTOS: AutoDef[] = [
  { key: 'crew-morning', short: 'Tomorrow’s crews on his Today. Send emails it to the team.', who: (s) => autoWho(s, 'crew-morning') || siteMgr(s), what: 'Crew list: where the crews are tomorrow', sub: 'On his Today every work day: each job in progress with a crew the next day, how many people already filled in. He fixes what’s different and taps Send: it’s emailed right away to the people you pick. Not sent by morning: it comes up again then, for that day.', when: (s) => `Every work day at ${hourWords(s.rules.crewAt ?? 18)}`, icon: HardHat, toggle: true, words: /crew|people|where.*work|head ?count|tomorrow/i },
  { key: 'rounds', short: 'Each job site with work going on, in driving order, a video from each.', who: (s) => autoWho(s, 'rounds') || boss(s), what: 'Visit the jobs', sub: 'Every work day on your Today: each job site with work going on, in driving order from where you are · Google Maps through all of them, and a video from each one (it goes out on WhatsApp and stays with the project)', when: () => 'Every work day', icon: MapPinned, toggle: true, words: /visit|rounds|route|google maps|video/i },
  { key: 'daily-update', short: 'One per job with a crew working: how far each wall and floor moved.', who: (s) => autoWho(s, 'daily-update') || siteMgr(s), what: 'Daily update for each crew on site', sub: 'One per project with a crew working. How far each wall and floor moved, with photos. It’s what installer pay is figured from.', when: () => 'Every work day', icon: ClipboardList, toggle: true, words: /daily|update|progress|how far/i },
  { key: 'delivery', short: 'On the day it’s due: all here, or short, wrong or broken.', who: (s) => matBy(s), what: 'Check in each delivery', sub: 'On the day it’s due, all here, or short, wrong or broken', when: () => 'On the delivery day', icon: Truck, toggle: false, words: /deliver|check in|arriv/i },
  { key: 'pay-review', who: (s) => autoWho(s, 'pay-review') || boss(s), what: 'Approve installer pay for the week', sub: 'Every installer’s week from the daily updates, next to his bill', when: () => 'Every Monday', icon: HandCoins, toggle: true, words: /\bpay\b|payroll|approve/i },
  { key: 'est-final', who: (s) => companyTeam(s).final, what: 'Final review of every estimate', sub: 'When the office review is done. Approve it and it goes to the client', when: () => 'When it’s their turn', icon: BadgeCheck, toggle: false, words: /final review|review.*estimate/i },
  { key: 'est-followup', who: (s) => companyTeam(s).follow, what: 'Follow up on estimates that went out', sub: 'The client hasn’t answered. Call or email, then set the next date', when: (s) => `${s.rules.followDays ?? 3} days after it’s sent`, icon: PhoneCall, toggle: true, words: /follow.?up|estimate.*(sent|answer)/i },
  { key: 'steps', short: 'Each step lands on its person’s Today when the one before it is done.', who: boss, what: 'Getting-ready steps, in order', sub: 'Every project’s steps. Each lands on its own person’s Today when the one before it is done (Who does what)', when: () => 'When it’s their turn', icon: ListChecks, toggle: false, words: /paperwork|design meeting|site check|heights|installer|materials|tile delivery/i },
  { key: 'late', short: 'What’s past its date, the first time each person opens the app.', who: boss, what: 'What’s late. A pop-up for each person', sub: 'Once a day, the first time they open it: what’s past its date on their Today. You also see the team’s, with “Remind”. It pops up on their screen.', when: () => 'Once a day', icon: AlarmClock, toggle: true, words: /\blate\b|overdue|past due|behind/i },
  { key: 'inv-remind', who: (s) => autoWho(s, 'inv-remind') || books(s), what: 'Remind clients about unpaid invoices', sub: 'A reminder email, ready to send, until it’s paid', when: (s) => `Every ${s.rules.reminderDays} days after it’s due`, icon: Mail, toggle: true, words: /unpaid|invoice|remind.*pa/i },
  { key: 'billing-day', short: 'Last week’s progress on every project, ready to bill.', who: (s) => autoWho(s, 'billing-day') || books(s), what: 'Bill last week’s progress', sub: 'What got installed on every project last week, from the daily updates. What to bill each client, one click per bill', when: () => 'Every Monday', icon: Receipt, toggle: true, words: /\bbill|billing/i },
]
export const autoOn = (s: Pick<Store, 'rules'>, key: string) => !(s.rules.autoOff || []).includes(key)
/** 18 → "6 PM" */
export const hourWords = (h: number) => (h === 12 ? 'Noon' : `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`)
/** who gets each of the app's own: changed right in its window where the company sets it (the estimate's final review
 *  and follow-up, who checks in the deliveries); the rest say who it goes to, and where that's set */
/** pick who gets one (or back to the usual person) — it lands on their Today from then on */
const setWho = (key: string, what: string) => (p: PersonKey | null) => S().commit((st) => {
  const m = { ...(st.rules.autoWho || {}) }
  if (p) m[key] = p
  else delete m[key]
  st.rules.autoWho = m
}, p ? `${PEOPLE[p]?.short || 'They'} gets it` : 'Back to the usual person', { sub: `${what}: on their Today from now on.` })
const WHO_EDIT: Record<string, { set?: (p: PersonKey | null) => void; usual?: string; note?: string; go?: 'checklist' | 'team' }> = {
  'est-final': { set: (p) => p && setCompanyPeople('final', [p]) },
  'est-followup': { set: (p) => p && setCompanyPeople('follow', [p]) },
  delivery: { set: (p) => p && S().commit((st) => { st.rules.matBy = p }, `${PEOPLE[p]?.short || 'They'} checks in the deliveries`) },
  steps: { note: 'Each step has its own person', go: 'checklist' },
  'crew-morning': { set: setWho('crew-morning', 'The crew list'), usual: 'The site manager' },
  'daily-update': { set: setWho('daily-update', 'The daily updates'), usual: 'Each project’s site manager' },
  'inv-remind': { set: setWho('inv-remind', 'Invoice reminders'), usual: 'Whoever does the books' },
  'billing-day': { set: setWho('billing-day', 'Billing the week'), usual: 'Whoever does the books' },
  rounds: { set: setWho('rounds', 'Visit the jobs'), usual: 'The admin' },
  'pay-review': { set: setWho('pay-review', 'Installer pay'), usual: 'The admin' },
  late: { note: 'Each person gets their own. The admin also sees the team’s' },
}
export function toggleAuto(key: string) {
  const on = autoOn(S(), key)
  const def = AUTOS.find((a) => a.key === key)
  S().commit((s) => { s.rules.autoOff = on ? [...(s.rules.autoOff || []), key] : (s.rules.autoOff || []).filter((k) => k !== key) }, `${def?.what || 'Automation'} · ${on ? 'off' : 'on'}`)
}
export function pauseRepeating(id: string) {
  const t0 = S().tasks.find((t) => t.id === id)
  S().commit((s) => { const t = s.tasks.find((x) => x.id === id); if (t) t.paused = !t.paused }, t0?.paused ? 'Back on' : 'Paused. It stops coming until you turn it back on')
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
      {Array.from(new Set([...peopleOf(s), ...AUTOS.map((a) => a.who(s)), ...custom.map((t) => t.owner)])).map((p) => {
        const autos = AUTOS.filter((a) => a.who(s) === p)
        const mine = custom.filter((t) => t.owner === p)
        if (!autos.length && !mine.length) return null
        return (
          <section key={p} className="[&:first-child>div:first-child]:border-t-0">
            <div className="flex items-center gap-2.5 border-t border-line bg-wash px-5 py-2 max-sm:px-4">
              <Avatar who={p} size={24} />
              <span className="text-[0.84375rem] font-semibold text-ink">{PEOPLE[p]?.name || p}</span>
              <span className="truncate text-[0.78125rem] text-muted">{PEOPLE[p]?.roleLabel}</span>
              <span className="ml-auto text-[0.78125rem] font-semibold tnum text-muted">{autos.length + mine.length}</span>
            </div>
            {autos.map((a) => {
              const on = autoOn(s, a.key)
              return (
                <div key={a.key} role="button" tabIndex={0} onClick={() => s.open({ t: 'auto', k: a.key })} onKeyDown={(e) => { if (e.key === 'Enter') s.open({ t: 'auto', k: a.key }) }} className={cn(ROW, 'cursor-pointer row-hover', !on && 'opacity-60')} data-auto={a.key}>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.5625rem] bg-wash-2 text-ink-2"><a.icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block break-words text-[0.875rem] font-semibold text-ink">{a.what}</span>
                    <span className="block break-words text-[0.78125rem] leading-snug text-muted">{a.short || a.sub}</span>
                    <span className="block break-words text-[0.78125rem] font-medium text-ink-2 md:hidden">{a.when(s)}</span>
                  </span>
                  <span className="break-words text-[0.8125rem] text-ink-2 max-md:hidden">{a.when(s)}</span>
                  <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>{a.toggle ? <Switch on={on} onClick={() => toggleAuto(a.key)} label={a.what} /> : <span className="text-[0.75rem] font-medium text-faint">Always on</span>}</span>
                </div>
              )
            })}
            {mine.map((t) => (
              <div key={t.id} role="button" tabIndex={0} onClick={() => s.open({ t: 'newauto', id: t.id })} onKeyDown={(e) => { if (e.key === 'Enter') s.open({ t: 'newauto', id: t.id }) }} className={cn(ROW, 'cursor-pointer row-hover', t.paused && 'opacity-60')} data-auto={t.id}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.5625rem] bg-brand-50 text-brand-600"><Repeat className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block break-words text-[0.875rem] font-semibold text-ink">{t.title}<span className="ml-2 align-[0.0625rem] text-[0.71875rem] font-medium text-brand-600">yours</span></span>
                  <span className="block break-words text-[0.78125rem] text-muted">{s.jobs[t.jobId]?.name || 'Company'}{t.paused ? ' · paused' : ''}</span>
                  <span className="block break-words text-[0.78125rem] font-medium text-ink-2 md:hidden">{REPEAT_LABEL[t.repeat!]}{t.repeatAt ? ` at ${t.repeatAt}` : ''}</span>
                </span>
                <span className="break-words text-[0.8125rem] text-ink-2 max-md:hidden">{REPEAT_LABEL[t.repeat!]}{t.repeatAt ? ` at ${t.repeatAt}` : ''}</span>
                <span className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
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

/** the reminders a tile company usually sets — they show under the box as you type (or under "Common"). Picking one
 *  fills in the words and how often; who gets it stays who you picked. */
const COMMON_REMINDERS: { t: string; repeat: NonNullable<Task['repeat']>; at: string }[] = [
  { t: 'Send me how many people are on each job', repeat: 'weekdays', at: '4 PM' },
  { t: 'Check next week’s starts. Tile, materials and installer all set?', repeat: 'weekly', at: '8 AM' },
  { t: 'Order the materials for next week’s starts', repeat: 'weekly', at: '8 AM' },
  { t: 'Walk every job with a crew on it', repeat: 'weekdays', at: '8 AM' },
  { t: 'Send the GC this week’s progress photos', repeat: 'weekly', at: '4 PM' },
  { t: 'Go over open invoices and call who’s late', repeat: 'weekly', at: 'Noon' },
  { t: 'Check the tile deliveries coming this week', repeat: 'weekly', at: '8 AM' },
]

/* ================= a new automation: what, who, how often ================= */
export function NewAutomationModal({ level, who: who0, id }: { level: number; who?: PersonKey; id?: string }) {
  const s = useStore()
  const cur = id ? s.tasks.find((t) => t.id === id && t.repeat) : undefined
  const [title, setTitle] = React.useState(cur?.title || '')
  const [owner, setOwner] = React.useState<PersonKey>(cur?.owner || who0 || siteMgr(s))
  /* the words match something the system already does by itself — say so */
  const built = title.trim().length > 3 ? AUTOS.find((a) => a.words.test(title)) : undefined
  const [repeat, setRepeat] = React.useState<NonNullable<Task['repeat']>>(cur?.repeat || 'weekdays')
  const [at, setAt] = React.useState(cur?.repeatAt || '4 PM')
  const [job, setJob] = React.useState(cur?.jobId || '')
  const projects = Object.values(s.jobs).filter((j) => !['request', 'estimating', 'proposal', 'followup', 'complete'].includes(j.stage))
  const add = () => {
    if (!title.trim()) return
    if (cur) {
      s.commit((st) => { const t = st.tasks.find((x) => x.id === cur.id); if (!t) return; Object.assign(t, { title: title.trim(), owner, for: roleOf(s, owner), repeat, repeatAt: at, jobId: job, where: `${REPEAT_LABEL[repeat]} at ${at}` }) }, 'Saved', { sub: `${PEOPLE[owner]?.short} · ${REPEAT_LABEL[repeat].toLowerCase()} at ${at}` })
      s.close()
      return
    }
    s.addTask({ jobId: job, title: title.trim(), type: 'Field', owner, due: 'Today', for: roleOf(s, owner), state: 'now', tone: 'info', repeat, repeatAt: at, where: `${REPEAT_LABEL[repeat]} at ${at}`, watch: owner === meOf(s.role) ? [] : [s.role] })
    s.close()
  }
  const chip = 'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[#d9d3c9] bg-white pl-1.5 pr-2.5 text-[0.8125rem] font-medium text-ink-2 transition hover:border-[#c6bfb4] hover:text-ink data-[state=open]:border-brand-300 data-[state=open]:ring-[0.1875rem] data-[state=open]:ring-brand-50'
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={cur ? 'Your reminder' : 'A reminder that repeats'}
      sub="It lands on their Today on schedule."
      footer={
        <>
          {cur && <Button variant="ghost" icon={<Trash2 />} onClick={() => { removeRepeating(cur.id); s.close() }}>Remove</Button>}
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" disabled={!title.trim()} onClick={add}>{cur ? 'Save' : 'Add the reminder'}</Button>
        </>
      }
    >
      <SuggestInput
        value={title}
        onChange={setTitle}
        onPick={(t) => { const x = COMMON_REMINDERS.find((r) => r.t === t); setTitle(t); if (x) { setRepeat(x.repeat); setAt(x.at) } }}
        onEnter={add}
        suggestions={COMMON_REMINDERS.map((x) => x.t)}
        label="What should happen"
        placeholder="The reminder, in your words"
        listLabel="Common reminders"
      />
      {built && <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-[0.8125rem] text-brand-800">The system already does this by itself: <b className="font-semibold">{built.what}</b> · {PEOPLE[built.who(s)]?.short}, {built.when(s).toLowerCase()}. It’s on the list behind this window.</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Menu align="start" width={260} trigger={<button type="button" aria-label="Who gets it" className={chip}><Avatar who={owner} size={20} /><span className="truncate">{PEOPLE[owner]?.short}</span><ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
          <MenuLabel>Who gets it</MenuLabel>
          {peopleOf(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={owner === p} onSelect={() => setOwner(p)} hint={PEOPLE[p]?.roleLabel}>{PEOPLE[p]?.name}</MenuItem>)}
        </Menu>
        <Menu align="start" width={220} trigger={<button type="button" aria-label="How often" className={chip}><span className="inline-flex h-5 w-5 items-center justify-center text-muted"><Repeat className="h-4 w-4" /></span><span className="truncate">{REPEAT_LABEL[repeat]}</span><ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
          <MenuLabel>How often</MenuLabel>
          {(Object.keys(REPEAT_LABEL) as NonNullable<Task['repeat']>[]).map((r) => <MenuItem key={r} checked={repeat === r} onSelect={() => setRepeat(r)}>{REPEAT_LABEL[r]}</MenuItem>)}
        </Menu>
        <Menu align="start" width={180} trigger={<button type="button" aria-label="At" className={chip}><span className="inline-flex h-5 w-5 items-center justify-center text-muted"><Clock3 className="h-4 w-4" /></span>at {at}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
          {['8 AM', 'Noon', '4 PM', '6 PM'].map((x) => <MenuItem key={x} checked={at === x} onSelect={() => setAt(x)}>{x}</MenuItem>)}
        </Menu>
        <SearchSelect value={job} onChange={setJob} emptyLabel="Company, not one project" placeholder="Project" icon={<Building2 />} width={340} label="For one project" className="h-8 w-auto max-w-[16.25rem] gap-1.5 rounded-full border-[#d9d3c9] pl-2.5 pr-2.5 text-[0.8125rem] font-medium text-ink-2 [&>span:nth-child(2)]:flex-initial" options={projects.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} />
      </div>
    </Modal>
  )
}

/** the ones with a time or a number of days: changed right in their window */
type WhenPick = { label: string; options: number[]; value: (s: Store) => number; words: (n: number) => string; set: (n: number) => void }
const WHEN_PICK: Record<string, WhenPick> = {
  'crew-morning': { label: 'On his Today at', options: [15, 16, 17, 18, 19, 20], value: (s) => s.rules.crewAt ?? 18, words: hourWords,
    set: (h) => S().commit((st) => { st.rules.crewAt = h }, `Crew list at ${hourWords(h)}`, { sub: 'On the site manager’s Today from then, every work day.' }) },
  'inv-remind': { label: 'A reminder every', options: [3, 5, 7, 10, 14], value: (s) => s.rules.reminderDays || 3, words: (n) => `${n} days`,
    set: (n) => S().commit((st) => { st.rules.reminderDays = n }, `Invoice reminders every ${n} days`) },
  'est-followup': { label: 'The follow-up comes', options: [2, 3, 5, 7], value: (s) => s.rules.followDays ?? 3, words: (n) => `${n} days after`,
    set: (n) => S().commit((st) => { st.rules.followDays = n }, `Follow-ups ${n} days after an estimate goes out`) },
}
/** the rest: what sets when it comes */
const WHEN_WHY: Record<string, string> = {
  rounds: 'On your Today all day. Skip today takes it off until tomorrow',
  'daily-update': 'For each job with a crew working that day',
  delivery: 'Set by each delivery’s date',
  'pay-review': 'From last week’s daily updates',
  'est-final': 'Right after the office review is done',
  steps: 'Each one when the step before it is done',
  late: 'The first time each person opens the app',
  'billing-day': 'From last week’s daily updates',
}

/* ================= one of the app's own: what it does, who gets it, on or off ================= */
export function AutomationModal({ level, k }: { level: number; k: string }) {
  const s = useStore()
  const a = AUTOS.find((x) => x.key === k)
  if (!a) return null
  const on = autoOn(s, a.key)
  const who = a.who(s)
  const e = WHO_EDIT[a.key] || {}
  /* the person the admin picked for it (nobody picked: the usual person) */
  const picked = s.rules.autoWho?.[a.key]
  const go = (tab: string) => { s.closeAll(); s.go({ page: 'settings', tab }) }
  const pill = <span className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-line bg-white pl-1 pr-3 text-[0.875rem] font-medium text-ink"><Avatar who={who} size={26} /><span className="break-words">{PEOPLE[who]?.name || 'Nobody yet'}</span>{e.set && <ChevronDown className="h-4 w-4 shrink-0 text-faint" />}</span>
  const pick = WHEN_PICK[a.key]
  /* one short window, nothing to scroll: on or off, when, who gets it — and for the crew list, who it's emailed to and
     the email itself (one tap to see it) — each one changed right on its line */
  return (
    <Modal level={level} size="md" onClose={s.close} title={a.what} sub={a.short || a.when(s)}>
      <div className="grid grid-cols-[8rem_minmax(0,1fr)] items-start gap-x-4 gap-y-4 max-sm:grid-cols-1 max-sm:gap-y-1.5" data-auto-rows>
        <AutoLabel>{a.toggle ? (on ? 'On' : 'Off') : 'On'}</AutoLabel>
        <div className="flex min-h-9 items-center gap-3" data-auto-onoff>
          {a.toggle ? <Switch on={on} onClick={() => toggleAuto(a.key)} label={a.what} /> : null}
          <span className="text-[0.8125rem] text-muted">{a.toggle ? (on ? 'Turned on' : 'Turned off. Nothing comes until it’s back on') : 'Always on. Every project needs it'}</span>
        </div>
        {/* when it comes: changed right here when it has a time or a number of days; otherwise what sets it */}
        <AutoLabel>{pick ? pick.label : 'When'}</AutoLabel>
        <div data-auto-when={a.key}>
          {pick ? (
            <div className="flex flex-wrap gap-1.5">
              {pick.options.map((o) => {
                const sel = pick.value(s) === o
                return <button key={o} type="button" onClick={() => pick.set(o)} aria-pressed={sel} className={cn('inline-flex h-9 items-center rounded-full border px-3.5 text-[0.875rem] font-semibold transition', sel ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-2 hover:bg-wash')} data-auto-when-pick={o}>{pick.words(o)}</button>
              })}
            </div>
          ) : (
            <div className="flex min-h-9 items-center text-[0.875rem] text-ink" data-auto-when-text><span>{a.when(s)}{WHEN_WHY[a.key] && <span className="text-muted"> · {WHEN_WHY[a.key]}</span>}</span></div>
          )}
        </div>
        <AutoLabel>Who gets it</AutoLabel>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-auto-who={who}>
          {e.set ? (
            <Menu align="start" width={280} trigger={<button type="button" aria-label="Who gets it" className="min-w-0 hover:opacity-90" data-auto-who-pick>{pill}</button>}>
              <MenuLabel>Who gets it</MenuLabel>
              {e.usual && <MenuItem checked={!picked} hint="Set by who's on the team" onSelect={() => e.set!(null)} data-auto-who-usual>{e.usual}</MenuItem>}
              {peopleOf(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={e.usual ? picked === p : who === p} hint={PEOPLE[p]?.roleLabel} onSelect={() => e.set!(p)} data-auto-who-person={p}>{PEOPLE[p]?.name}</MenuItem>)}
            </Menu>
          ) : pill}
          {e.note && <span className="text-[0.8125rem] text-muted">{e.note}</span>}
          {e.usual && !picked && <span className="text-[0.8125rem] text-muted">{e.usual}</span>}
          {e.go === 'checklist' && <Button size="sm" variant="ghost" onClick={() => go('checklist')}>Who does what</Button>}
        </div>
        {a.key === 'crew-morning' && <CrewMailSettings />}
      </div>
      {/* what it does, in full — under the settings, quiet */}
      <p className="mt-5 border-t border-line-2 pt-4 text-[0.8125rem] leading-relaxed text-muted" data-auto-what>{a.sub}</p>
    </Modal>
  )
}
/** a setting's name, on the left of its line */
const AutoLabel = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-9 items-center text-[0.84375rem] font-semibold text-ink-2">{children}</div>

/* ================= the crew list: what time, who it's emailed to, what the email looks like, a test ================= */
function CrewMailSettings() {
  const s = useStore()
  const off = !!s.rules.crewMail?.off
  const picked = crewMailPeople(s)
  const team = s.team.filter((m) => m.status !== 'off' && m.role !== 'crew' && m.role !== 'client' && PEOPLE[m.key as PersonKey]).map((m) => ({ key: m.key as PersonKey, email: m.email || '' }))
  const [busy, setBusy] = React.useState(false)
  const toggle = (p: PersonKey) => s.commit((st) => { const cur = crewMailPeople(st); st.rules.crewMail = { ...(st.rules.crewMail || {}), to: cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p] } }, undefined, { undo: false })
  const setOff = (v: boolean) => s.commit((st) => { st.rules.crewMail = { ...(st.rules.crewMail || {}), off: v } }, v ? 'Not emailed' : 'Emailed when it’s sent')
  /* what it looks like: tomorrow's list as it stands now */
  const day = nextWorkDay(TODAY)
  const rows: CrewLine[] = crewLines(s, day)
  const preview = crewMailWords(s, rows, day)
  const test = async () => {
    if (!mailLive()) { showPop({ title: 'Email isn’t on in this copy', sub: 'In your real app, “Send me a test” emails it to you.', tone: 'warn' }); return }
    setBusy(true)
    const r = await emailCrewList(rows, day, { test: true })
    setBusy(false)
    showPop(r.ok ? { title: 'Test sent', sub: `To ${r.to.join(', ')}. Check your inbox.` } : { title: 'The test didn’t go out', sub: `${r.why}.`, tone: 'warn' })
  }
  const [see, setSee] = React.useState(false)
  return (
    <>
      <AutoLabel>Email it to</AutoLabel>
      <div data-crew-mail>
        <div className="mb-2 flex min-h-9 items-center gap-2 text-[0.8125rem] text-muted"><Switch on={!off} onClick={() => setOff(!off)} label="Email the crew list" />{off ? 'Not emailed' : 'Emailed the moment he sends it'}</div>
        <div className={cn('flex flex-wrap gap-1.5', off && 'opacity-50')} data-crew-mail-to={picked.join(',')}>
          {team.map((m) => {
            const sel = picked.includes(m.key)
            return (
              <button key={m.key} type="button" disabled={off} onClick={() => toggle(m.key)} aria-pressed={sel} title={m.email || 'No email on the team yet'} className={cn('inline-flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-[0.875rem] font-medium transition', sel ? 'border-brand-300 bg-brand-50 text-ink' : 'border-line bg-white text-muted hover:bg-wash')} data-crew-mail-person={m.key}>
                <Avatar who={m.key} size={26} />{PEOPLE[m.key]?.short}{sel && !m.email && <span className="text-[0.75rem] font-semibold text-warn-700">no email</span>}
              </button>
            )
          })}
        </div>
      </div>
      <AutoLabel>The email</AutoLabel>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setSee(!see)} aria-expanded={see} data-crew-mail-see>{see ? 'Hide it' : 'See what it looks like'}</Button>
          <Button size="sm" disabled={busy} onClick={() => void test()} data-crew-mail-test>{busy ? 'Sending…' : 'Send me a test'}</Button>
        </div>
        {see && (
          <div className="mt-2 overflow-hidden rounded-xl border border-line bg-white" data-crew-mail-preview>
            <div className="border-b border-line-2 bg-wash px-4 py-2 text-[0.8125rem] text-muted"><b className="font-semibold text-ink">{preview.subject}</b></div>
            <div className="max-h-[18rem] overflow-auto px-4 py-3 [&_img]:max-w-[110px]" dangerouslySetInnerHTML={{ __html: preview.html.split(`${PUBLISHED}/`).join('/') }} />
          </div>
        )}
      </div>
    </>
  )
}
