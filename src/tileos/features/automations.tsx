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

const S = () => useStore.getState()

export interface AutoDef { key: string; who: (s: Store) => PersonKey; what: string; sub: string; when: (s: Store) => string; icon: React.ElementType; toggle: boolean; words: RegExp }
/* the real people: the site manager, whoever handles accounting (the admin if nobody does), the admin */
const onTeam = (s: Store, k?: string) => !!k && s.team.some((m) => m.key === k && m.status !== 'off')
const roleHolder = (s: Store, role: string) => s.team.find((m) => m.role === role && m.status !== 'off' && (m.email || m.uid || m.last))?.key as PersonKey | undefined
const boss = (s: Store) => meOf('owner')
const siteMgr = (s: Store) => roleHolder(s, 'site') || (onTeam(s, 'yakov') ? 'yakov' : boss(s))
const books = (s: Store) => roleHolder(s, 'accounting') || (onTeam(s, 'accounting') ? 'accounting' : boss(s))
export const AUTOS: AutoDef[] = [
  { key: 'crew-morning', who: siteMgr, what: 'Where the crews are tomorrow', sub: 'After 3 in the afternoon it pops up: each project with a crew the next work day, the people already filled in — he fixes what’s different and sends it to you. Not sent by the morning: it comes up again then, for that day.', when: () => 'The night before', icon: HardHat, toggle: true, words: /crew|people|where.*work|head ?count|tomorrow/i },
  { key: 'rounds', who: boss, what: 'Visit the jobs', sub: 'Every work day on your Today: each job site with work going on, in driving order from where you are — Google Maps through all of them, and a video from each one (it goes out on WhatsApp and stays with the project)', when: () => 'Every work day', icon: MapPinned, toggle: true, words: /visit|rounds|route|google maps|video/i },
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
/** who gets each of the app's own: changed right in its window where the company sets it (the estimate's final review
 *  and follow-up, who checks in the deliveries); the rest say who it goes to, and where that's set */
const WHO_EDIT: Record<string, { set?: (p: PersonKey) => void; note?: string; go?: 'checklist' | 'team' }> = {
  'est-final': { set: (p) => setCompanyPeople('final', [p]) },
  'est-followup': { set: (p) => setCompanyPeople('follow', [p]) },
  delivery: { set: (p) => S().commit((st) => { st.rules.matBy = p }, `${PEOPLE[p]?.short || 'They'} checks in the deliveries`) },
  steps: { note: 'Each step has its own person', go: 'checklist' },
  'crew-morning': { note: 'Each project’s site manager', go: 'team' },
  'daily-update': { note: 'Each project’s site manager', go: 'team' },
  'inv-remind': { note: 'Whoever does the books', go: 'team' },
  'billing-day': { note: 'Whoever does the books', go: 'team' },
  rounds: { note: 'The admin' },
  'pay-review': { note: 'The admin' },
  late: { note: 'Each person gets their own — the admin also sees the team’s' },
}
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
                    <span className="block truncate text-[0.875rem] font-semibold text-ink">{a.what}</span>
                    <span className="block truncate text-[0.78125rem] text-muted">{a.sub}</span>
                    <span className="block truncate text-[0.78125rem] font-medium text-ink-2 md:hidden">{a.when(s)}</span>
                  </span>
                  <span className="truncate text-[0.8125rem] text-ink-2 max-md:hidden">{a.when(s)}</span>
                  <span className="flex justify-end" onClick={(e) => e.stopPropagation()}>{a.toggle ? <Switch on={on} onClick={() => toggleAuto(a.key)} label={a.what} /> : <span className="text-[0.75rem] font-medium text-faint">Always on</span>}</span>
                </div>
              )
            })}
            {mine.map((t) => (
              <div key={t.id} role="button" tabIndex={0} onClick={() => s.open({ t: 'newauto', id: t.id })} onKeyDown={(e) => { if (e.key === 'Enter') s.open({ t: 'newauto', id: t.id }) }} className={cn(ROW, 'cursor-pointer row-hover', t.paused && 'opacity-60')} data-auto={t.id}>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.5625rem] bg-brand-50 text-brand-600"><Repeat className="h-4 w-4" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{t.title}<span className="ml-2 align-[0.0625rem] text-[0.71875rem] font-medium text-brand-600">yours</span></span>
                  <span className="block truncate text-[0.78125rem] text-muted">{s.jobs[t.jobId]?.name || 'Company'}{t.paused ? ' · paused' : ''}</span>
                  <span className="block truncate text-[0.78125rem] font-medium text-ink-2 md:hidden">{REPEAT_LABEL[t.repeat!]}{t.repeatAt ? ` at ${t.repeatAt}` : ''}</span>
                </span>
                <span className="truncate text-[0.8125rem] text-ink-2 max-md:hidden">{REPEAT_LABEL[t.repeat!]}{t.repeatAt ? ` at ${t.repeatAt}` : ''}</span>
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
  { t: 'Check next week’s starts — tile, materials and installer all set?', repeat: 'weekly', at: '8 AM' },
  { t: 'Order the setting materials for next week’s starts', repeat: 'weekly', at: '8 AM' },
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
      {built && <div className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-[0.8125rem] text-brand-800">The system already does this by itself: <b className="font-semibold">{built.what}</b> — {PEOPLE[built.who(s)]?.short}, {built.when(s).toLowerCase()}. It’s on the list behind this window.</div>}
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
        <SearchSelect value={job} onChange={setJob} emptyLabel="Company — not one project" placeholder="Project" icon={<Building2 />} width={340} label="For one project" className="h-8 w-auto max-w-[16.25rem] gap-1.5 rounded-full border-[#d9d3c9] pl-2.5 pr-2.5 text-[0.8125rem] font-medium text-ink-2 [&>span:nth-child(2)]:flex-initial" options={projects.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} />
      </div>
    </Modal>
  )
}

/* ================= one of the app's own: what it does, who gets it, on or off ================= */
export function AutomationModal({ level, k }: { level: number; k: string }) {
  const s = useStore()
  const a = AUTOS.find((x) => x.key === k)
  if (!a) return null
  const on = autoOn(s, a.key)
  const who = a.who(s)
  const e = WHO_EDIT[a.key] || {}
  const go = (tab: string) => { s.closeAll(); s.go({ page: 'settings', tab }) }
  const pill = <span className="inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-line bg-white pl-1 pr-3 text-[0.875rem] font-medium text-ink"><Avatar who={who} size={26} /><span className="truncate">{PEOPLE[who]?.name || 'Nobody yet'}</span>{e.set && <ChevronDown className="h-4 w-4 shrink-0 text-faint" />}</span>
  return (
    <Modal level={level} size="sm" onClose={s.close} title={a.what} sub={a.when(s)}>
      <p className="text-[0.875rem] leading-relaxed text-ink-2" data-auto-what>{a.sub}</p>
      <div className="mt-5">
        <div className="mb-1.5 text-[0.84375rem] font-semibold text-ink-2">Who gets it</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-auto-who={who}>
          {e.set ? (
            <Menu align="start" width={260} trigger={<button type="button" aria-label="Who gets it" className="min-w-0 hover:opacity-90">{pill}</button>}>
              <MenuLabel>Who gets it</MenuLabel>
              {peopleOf(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={who === p} hint={PEOPLE[p]?.roleLabel} onSelect={() => e.set!(p)}>{PEOPLE[p]?.name}</MenuItem>)}
            </Menu>
          ) : pill}
          {e.note && <span className="text-[0.8125rem] text-muted">{e.note}</span>}
          {e.go === 'checklist' && <Button size="sm" variant="ghost" onClick={() => go('checklist')}>Who does what</Button>}
          {e.go === 'team' && <Button size="sm" variant="ghost" onClick={() => go('team')}>Team</Button>}
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[0.84375rem] font-semibold text-ink-2">{a.toggle ? (on ? 'On' : 'Off') : 'Always on — every project needs it'}</span>
        {a.toggle && <Switch on={on} onClick={() => toggleAuto(a.key)} label={a.what} />}
      </div>
    </Modal>
  )
}
