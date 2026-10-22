/* Where the project stands — the flow, one step at a time, like the estimate's path:
 *   Design & setup · Site · Installer · Materials & deposit · Installing · Touch-ups · Billing
 * The circles on top (ProjectFlow) say how far each is; tap one and it opens underneath (StagePanel). A step of
 * getting ready is the office's sheet as questions, each answered Yes, No or N/A — what's answered folds away, so what's
 * left is what you see. Tap a question for the rest of it (who has it, when, the paperwork, the PO…), right under it. */
import * as React from 'react'
import { ChevronDown, Plus, Truck, HardHat, CalendarDays, Grid2x2, Check, X, Trash2 } from 'lucide-react'
import { useStore, meOf, isRequest, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Circle, Circles, type CircleState } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { roomPct } from '@/tileos/data/jobs'
import { TODAY, labelFromIso, daysBetween, isoFromLabel } from '@/tileos/lib/today'
import { readyGroups, canAnswer, answerRow, lockedOf, GROUPS, type ReadyRow, type ReadyGroup, type GroupKey, type Answer } from '../ready'
import { addJobStep, removeJobStep } from '../steps'
import { StepIcon, insidePeople } from '../steps-ui'
import { StepInline } from '../stepwin'
import { AnswerPick, NoNote } from '../answer'
import { HeightsInline } from '../heights'
import { pictureOf } from '../progressbill'
import { installerOf } from '../upcoming'
import { RoomsTab } from './rooms'
import { MoneyTab } from './money-tab'
import { TouchupsList } from '../touchups'
import { firstName } from './kit'
import { SURF_LABEL } from '@/tileos/data/jobs'

const PRICING = ['request', 'estimating', 'proposal', 'followup']
export const IN_FIELD = ['installation', 'punch', 'closeout', 'complete']

/** a step of the flow: a part of getting ready, or what comes after it */
export type FlowKey = GroupKey | 'install' | 'punch' | 'money'
export type FlowStage = { key: FlowKey; label: string; state: CircleState; pct?: number; sub: string; words: string; tone?: 'bad' | 'warn' | 'ok'; mine?: boolean; group?: ReadyGroup }
const SHORT_LABEL: Record<string, string> = { design: 'Design & setup', site: 'Site', installer: 'Installer', materials: 'Materials & deposit', other: 'Your own' }
const latest = (rows: ReadyRow[]) => rows.map((r) => r.doneOn).filter(Boolean).sort((a, b) => (isoFromLabel(a) || '').localeCompare(isoFromLabel(b) || '')).pop()

/** every step of the flow, with how far it is — the circles on top and the words in the panel */
export function useFlow(job: Job): FlowStage[] {
  const s = useStore()
  return flowOf(s, job)
}
export function flowOf(s: Store, job: Job): FlowStage[] {
  const me = meOf(s.role)
  const money = !['site', 'crew'].includes(s.role)
  const inField = IN_FIELD.includes(job.stage)
  const out: FlowStage[] = []
  if (PRICING.includes(job.stage)) return out
  readyGroups(s, job).forEach((g) => {
    const all = g.done === g.total
    const open = g.rows.filter((r) => r.state !== 'done' && r.state !== 'na')
    const mine = open.some((r) => r.owner === me && (r.state === 'now' || r.state === 'bad'))
    const waiting = open.length > 0 && open.every((r) => r.state === 'wait')
    const later = open.length > 0 && open.every((r) => r.state === 'later')
    const count = `${g.done} of ${g.total}`
    const who = g.key === 'site' ? firstName(g.rows[0]?.owner) || PEOPLE[g.rows[0]?.owner]?.short : g.key === 'installer' ? (() => { const c = installerOf(s, job) || (job.crew as PersonKey | undefined); return c ? PEOPLE[c]?.short : undefined })() : undefined
    const when = all ? latest(g.rows) : undefined
    out.push({
      key: g.key, label: SHORT_LABEL[g.key] || g.label, group: g, mine,
      state: all ? 'done' : g.bad ? 'bad' : waiting ? 'wait' : later ? 'later' : 'now',
      pct: g.total ? Math.round((g.done / g.total) * 100) : 0,
      sub: all ? `Done${when ? ` ${when}` : ''}` : g.bad ? `${g.bad} ${g.bad === 1 ? 'problem' : 'problems'}` : [who, count].filter(Boolean).join(' · '),
      words: all ? 'All done' : `${count} done${g.bad ? ` · ${g.bad} ${g.bad === 1 ? 'problem' : 'problems'}` : ''}${waiting ? ' · waiting' : ''}`,
      tone: all ? 'ok' : g.bad ? 'bad' : undefined,
    })
  })
  const rooms = s.rooms[job.id] || []
  const b = s.bookings.find((x) => x.jobId === job.id)
  const crew = (job.crew || b?.crew || installerOf(s, job)) as PersonKey | undefined
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const days = startIso ? daysBetween(TODAY, startIso) : null
  const pct = inField ? (job.stage === 'installation' ? job.pct ?? 0 : 100) : 0
  const doneRooms = rooms.filter((r) => roomPct(r) >= 100).length
  const late = !inField && !!startIso && startIso < TODAY
  out.push({
    key: 'install', label: 'Installing',
    state: !inField ? (late ? 'bad' : 'later') : pct >= 100 ? 'done' : 'now',
    pct,
    sub: !inField ? (start ? `${late ? 'Was to start' : 'Starts'} ${start}` : 'No start date') : pct >= 100 ? `Done${job.dates?.finish ? ` ${job.dates.finish}` : ''}` : `${pct}%${crew ? ` · ${PEOPLE[crew]?.short}` : ''}`,
    words: !inField ? (start ? `${late ? 'Was to start' : 'Starts'} ${start}${!late && days != null && days >= 0 ? ` · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}` : ''}` : 'No start date yet') : pct >= 100 ? `Done${job.dates?.finish ? ` ${job.dates.finish}` : ''}` : `${pct}% · ${doneRooms} of ${rooms.length} rooms done`,
    tone: late ? 'bad' : pct >= 100 ? 'ok' : undefined,
  })
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const openP = punch.filter((p) => p.status !== 'verified')
  const after = ['closeout', 'complete'].includes(job.stage)
  out.push({
    key: 'punch', label: 'Touch-ups',
    state: punch.length && !openP.length ? 'done' : openP.length ? 'now' : after ? 'done' : 'later',
    pct: punch.length ? Math.round(((punch.length - openP.length) / punch.length) * 100) : 0,
    sub: openP.length ? `${openP.length} open` : punch.length ? 'All checked' : after ? 'None' : 'After installing',
    words: openP.length ? `${openP.length} open · ${punch.length - openP.length} of ${punch.length} checked` : punch.length ? 'All checked' : after ? 'None' : inField ? 'None yet' : 'After the installing',
    tone: punch.length && !openP.length ? 'ok' : undefined,
  })
  if (money) {
    const pic = pictureOf(s, job.id)
    const total = pic.contract + pic.changes
    const paid = job.stage === 'complete' || (total > 0 && pic.paid >= total)
    out.push({
      key: 'money', label: 'Billing',
      state: paid ? 'done' : pic.billed ? 'now' : 'later',
      pct: pic.paidPct,
      sub: paid ? 'Paid' : pic.billed ? `${pic.paidPct}% paid` : 'Not billed yet',
      words: pic.billed ? `${fmtMoney(pic.paid)} of ${fmtMoney(total)} paid` : total ? `Nothing billed yet · ${fmtMoney(total)} contract` : 'Nothing billed yet',
      tone: paid ? 'ok' : undefined,
    })
  }
  return out
}

/** the step the project opens on: once it's started, where it is; before that, your turn first, then a problem, then
 *  the first part that isn't done — or the part a link asks for */
export function defaultFlow(s: Store, job: Job, tab?: string): FlowKey {
  const flow = flowOf(s, job)
  const has = (k: FlowKey) => flow.some((f) => f.key === k)
  const t = tab === 'estimate' || tab === 'billing' || tab === 'money' ? 'money'
    : tab === 'touchups' || tab === 'punch' ? 'punch'
      : tab === 'install' || tab === 'rooms' || tab === 'crew' ? 'install'
        : tab === 'installer' ? 'installer'
          : tab === 'orders' || tab === 'materials' || tab === 'pos' ? 'materials'
            : undefined
  if (t && has(t as FlowKey)) return t as FlowKey
  if (s.role === 'accounting' && has('money')) return 'money'
  if (job.stage === 'installation') return 'install'
  if (job.stage === 'punch') return 'punch'
  if (['closeout', 'complete'].includes(job.stage)) return has('money') ? 'money' : 'punch'
  const parts = flow.filter((f) => f.group)
  const pick = parts.find((f) => f.mine) || parts.find((f) => f.state === 'bad') || parts.find((f) => f.state === 'now') || parts.find((f) => f.state === 'wait') || parts.find((f) => f.state !== 'done')
  return pick?.key || 'install'
}

/** the circles on top — the project's flow, like the estimate's path. Tap one and it opens underneath. */
export function ProjectFlow({ job, at, onPick, className }: { job: Job; at: FlowKey; onPick: (k: FlowKey) => void; className?: string }) {
  const flow = useFlow(job)
  if (!flow.length) return null
  return (
    <Circles
      layout="beside"
      size={30}
      at={at}
      onPick={(k) => onPick(k as FlowKey)}
      label="The project, step by step"
      className={className}
      groups={[{ key: 'flow', steps: flow.map((f, i) => ({ key: f.key, label: f.label, sub: f.sub, state: f.state, pct: f.state === 'done' || f.state === 'bad' ? undefined : Math.max(f.pct || 0, f.state === 'later' ? 0 : 6), center: String(i + 1), mine: f.mine, attrs: { 'data-flow': f.key } })) }]}
    />
  )
}

const TONE: Record<string, string> = { ok: 'text-[#2c8a5b]', bad: 'font-medium text-bad-600', warn: 'text-warn-700' }

/** the step that's open, under the circles: its questions, the rooms, the touch-ups or the money */
export function StagePanel({ job, at, focus, setFocus, onRoom }: {
  job: Job
  at: FlowKey
  /** a question to open and show ('step:qty', 'site:water') — from "Your turn" */
  focus?: string | null
  setFocus: (id: string | null) => void
  onRoom: (name: string) => void
}) {
  const flow = useFlow(job)
  const f = flow.find((x) => x.key === at) || flow[0]
  if (PRICING.includes(job.stage)) return <div className="rounded-[0.875rem] border border-line bg-white px-4 py-8 text-center text-[0.875rem] text-muted">Paperwork, the design meeting, the site, the installer, deliveries, the deposit — it all starts once the estimate is won.</div>
  if (!f) return null
  const n = flow.indexOf(f) + 1
  return (
    <section data-stage={f.key} className="flex min-h-0 flex-col">
      <header className="mb-2.5 flex min-w-0 items-center gap-3 px-0.5">
        <Circle st={{ key: f.key, label: f.label, state: f.state, pct: f.state === 'done' || f.state === 'bad' ? undefined : Math.max(f.pct || 0, f.state === 'later' ? 0 : 6), center: String(n) }} size={34} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[1.0625rem] font-semibold text-ink">{f.label}</span>
          <span className={cn('block truncate text-[0.8125rem] text-muted', f.tone && TONE[f.tone])}>{f.words}</span>
        </span>
      </header>
      {f.group ? <Questions key={f.key} job={job} g={f.group} focus={focus} setFocus={setFocus} />
        : f.key === 'install' ? <InstallBody job={job} onRoom={onRoom} />
          : f.key === 'punch' ? <PunchBody job={job} />
            : <MoneyTab job={job} />}
      {/* what else is open on the job — a problem, something asked for, a wait — under every part but the money */}
      {f.key !== 'money' && <AlsoOpen job={job} className="mt-3" max={f.group ? 2 : undefined} />}
    </section>
  )
}

/* ================= a part of getting ready: its questions ================= */
const answered = (r: ReadyRow) => r.state === 'done' || r.state === 'na'
function Questions({ job, g, focus, setFocus }: { job: Job; g: ReadyGroup; focus?: string | null; setFocus: (id: string | null) => void }) {
  const [openRow, setOpenRow] = React.useState<string | null>(focus || null)
  const [show, setShow] = React.useState(false)
  /* a question just answered stays a moment, its mark landing, before it folds away */
  const [fresh, setFresh] = React.useState<Record<string, true>>({})
  const box = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!focus) return
    setOpenRow(focus)
    const t = setTimeout(() => {
      box.current?.querySelector<HTMLElement>(`[data-row="${focus}"]`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
      setFocus(null)
    }, 60)
    return () => clearTimeout(t)
  }, [focus])
  const pick = (r: ReadyRow, a: Answer | null) => {
    answerRow(job, r, a)
    if (a === 'yes' || a === 'na') {
      setFresh((x) => ({ ...x, [r.id]: true }))
      setTimeout(() => setFresh((x) => { const n = { ...x }; delete n[r.id]; return n }), 1500)
      if (openRow === r.id) setOpenRow(null)
    }
    if (a === 'no') setOpenRow(r.id)
  }
  const all = g.done === g.total
  const rows = g.rows.filter((r) => !answered(r) || show || fresh[r.id] || openRow === r.id)
  return (
    <div ref={box} data-group={g.key} data-checklist>
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
        {rows.map((r) => <Row key={r.id} job={job} r={r} fresh={!!fresh[r.id]} open={openRow === r.id} onToggle={() => setOpenRow(openRow === r.id ? null : r.id)} pick={pick} />)}
        {all && !show && (
          <div className="flex items-center gap-2.5 px-4 py-3.5 text-[0.875rem] font-semibold text-[#2c8a5b]">
            <span className="cheer-check inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#2c8a5b] text-white"><Check className="h-3.5 w-3.5" strokeWidth={3.4} /></span>
            Everything here is answered.
          </div>
        )}
        {g.done > 0 && (
          <button onClick={() => setShow(!show)} className="flex w-full items-center gap-2 border-t border-line-2 px-4 py-2 text-left text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50/40">
            <Check className="h-3.5 w-3.5" />{show ? 'Hide what’s answered' : `${g.done} answered — show ${g.done === 1 ? 'it' : 'them'}`}
          </button>
        )}
      </div>
      <AddQuestion job={job} group={g.key} />
    </div>
  )
}

/** the words under a question: who has it and when — or what it's waiting on, what's wrong, when it was done */
function rowWords(r: ReadyRow, me: PersonKey): { text: React.ReactNode; tone?: string } {
  const who = r.owner === me ? 'You' : firstName(r.owner) || PEOPLE[r.owner]?.short || ''
  if (r.state === 'done') {
    const by = r.doneBy ? `${r.doneBy === me ? 'You' : PEOPLE[r.doneBy]?.short || ''}${r.doneOn ? ` · ${r.doneOn}` : ''}` : ''
    return { text: [by, r.note && r.note !== 'Done' ? r.note : ''].filter(Boolean).join(' — ') || 'Yes', tone: 'text-[#2c8a5b]' }
  }
  if (r.state === 'na') return { text: 'Not needed on this project', tone: 'text-faint' }
  if (r.state === 'bad') return { text: r.note || 'No', tone: 'font-medium text-bad-600' }
  if (r.state === 'wait') return { text: r.note || 'Waiting', tone: 'text-warn-700' }
  if (r.state === 'later') return { text: r.step.waitsFor ? `Not yet — waits for: ${r.step.waitsFor}` : 'Not yet', tone: 'text-faint' }
  const late = !!r.due && r.due < TODAY
  const note = r.kind === 'site' ? r.note || r.sub : r.note
  return {
    text: <><b className={cn('font-semibold', r.owner === me ? 'text-brand-700' : 'text-ink-2')}>{who}</b>{r.due ? <span className={late ? 'font-semibold text-bad-600' : ''}> · {late ? 'was due' : 'due'} {labelFromIso(r.due)}</span> : null}{note ? <> · {note}</> : null}</>,
  }
}

function Row({ job, r, fresh, open, onToggle, pick }: { job: Job; r: ReadyRow; fresh: boolean; open: boolean; onToggle: () => void; pick: (r: ReadyRow, a: Answer | null) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const can = canAnswer(s, r)
  const w = rowWords(r, me)
  const noNote = r.kind === 'site' ? s.stepRecs[job.id]?.heights?.checks?.[r.key]?.note : s.stepRecs[job.id]?.[r.key]?.no?.note
  return (
    <div data-row={r.id} {...(r.kind === 'step' ? { 'data-step': r.key } : { 'data-site': r.key })} data-state={r.state} className={cn('border-t border-line-2 first:border-t-0', fresh && 'row-fresh')}>
      <div className="flex items-center gap-3 px-3.5 py-2 max-sm:gap-2.5 max-sm:px-3">
        <span className={cn('inline-flex shrink-0', fresh && 'cheer-check')}><StepIcon state={r.state} size={22} /></span>
        <button onClick={onToggle} aria-expanded={open} className="group min-w-0 flex-1 text-left">
          <span className="flex min-w-0 items-center gap-1">
            <span className={cn('line-clamp-2 text-[0.875rem] font-semibold leading-snug', r.state === 'na' ? 'text-muted' : 'text-ink')}>{r.q}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-faint opacity-0 transition group-hover:opacity-100 pointer-coarse:opacity-100', open && 'rotate-180 opacity-100')} />
          </span>
          <span className={cn('block truncate text-[0.75rem] text-muted', w.tone)}>{w.text}</span>
        </button>
        <AnswerPick q={r.q} value={r.answer} onPick={(a) => pick(r, a)} disabled={!can} locked={lockedOf(s, job, r)} />
      </div>
      {open && (
        <div className="border-t border-line-2 bg-[#fcfbf9] px-4 pb-4 pt-3 max-sm:px-3" data-panel>
          {r.answer === 'no' && (
            <div className="mb-3">
              <div className="mb-1.5 text-[0.8125rem] font-semibold text-bad-700">What’s wrong?</div>
              <NoNote value={noNote} disabled={!can} autoFocus={!noNote} onSave={(t) => answerRow(job, r, 'no', t)} />
            </div>
          )}
          {r.kind === 'site'
            ? <SiteMore job={job} r={r} />
            : <StepInline job={job} v={r.step} onClose={onToggle} />}
          {r.step.only && r.kind === 'step' && !['crew', 'client', 'site', 'accounting'].includes(s.role) && (
            <button onClick={() => removeJobStep(job.id, r.key)} className="mt-3 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.78125rem] font-semibold text-muted hover:bg-wash hover:text-bad-600"><Trash2 className="h-3.5 w-3.5" />Take this question off the project</button>
          )}
        </div>
      )}
    </div>
  )
}

/** a site question, open: what it means, who checks it — the wall heights right there to measure */
function SiteMore({ job, r }: { job: Job; r: ReadyRow }) {
  const s = useStore()
  const me = meOf(s.role)
  return (
    <div>
      <p className="text-[0.84375rem] leading-snug text-ink-2">{r.sub}</p>
      <p className="mt-1 text-[0.78125rem] text-muted">On the site check · {r.owner === me ? 'you check it' : `${PEOPLE[r.owner]?.short || 'the site manager'} checks it`}{r.state === 'done' && r.doneBy ? ` · answered by ${r.doneBy === me ? 'you' : PEOPLE[r.doneBy]?.short}${r.doneOn ? ` ${r.doneOn}` : ''}` : ''}</p>
      {r.key === 'walls' && r.state !== 'na' && <div className="mt-3"><HeightsInline jobId={job.id} /></div>}
    </div>
  )
}

/** a question just for this project — in the part that's open, answered by whoever it's for */
function AddQuestion({ job, group }: { job: Job; group: GroupKey }) {
  const s = useStore()
  const me = meOf(s.role)
  const [on, setOn] = React.useState(false)
  const [text, setText] = React.useState('')
  const partOwner = (readyGroups(s, job).find((x) => x.key === group)?.rows[0]?.owner || me) as PersonKey
  const [who, setWho] = React.useState<PersonKey | null>(null)
  const owner = who || (group === 'site' ? partOwner : me)
  if (['crew', 'client', 'accounting'].includes(s.role)) return null
  if (!on) return (
    <button onClick={() => setOn(true)} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[0.8125rem] font-semibold text-muted transition hover:bg-white hover:text-brand-700">
      <Plus className="h-4 w-4" />Add a question
    </button>
  )
  const add = () => {
    const q = text.trim()
    if (!q) return
    addJobStep(job.id, /\?$/.test(q) ? q : `${q}?`, owner, undefined, group)
    setText('')
    setOn(false)
  }
  const pill = 'inline-flex h-9 items-center gap-1.5 rounded-[0.5625rem] border border-line bg-white px-2.5 text-[0.8125rem] font-semibold text-ink-2 hover:bg-wash'
  return (
    <div className="mt-2 rounded-[0.875rem] border border-line bg-white p-3" data-add-question>
      <div className="mb-2 text-[0.84375rem] font-semibold text-ink">A question for {GROUPS.find((x) => x.key === group)?.label.toLowerCase()} on {job.name}</div>
      <TextInput mic autoFocus aria-label="The question" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder={group === 'site' ? 'e.g. Heated floor wire on site?' : 'e.g. Sample board approved?'} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Menu align="start" width={280} trigger={<button className={pill} aria-label="Who answers it"><Avatar who={owner} size={20} plain />{owner === me ? 'You answer it' : `${PEOPLE[owner]?.short} answers it`}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
          <MenuLabel>Who answers it</MenuLabel>
          {insidePeople(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} plain />} checked={owner === p} hint={PEOPLE[p]?.roleLabel} onSelect={() => setWho(p)}>{PEOPLE[p]?.name}</MenuItem>)}
        </Menu>
        <span className="ml-auto flex items-center gap-2">
          <Button variant="ghost" icon={<X />} onClick={() => { setOn(false); setText('') }}>Cancel</Button>
          <Button variant="primary" icon={<Plus />} disabled={!text.trim()} onClick={add}>Add</Button>
        </span>
      </div>
    </div>
  )
}

/* ================= installing: the rooms, each a ring ================= */
function InstallBody({ job, onRoom }: { job: Job; onRoom: (name: string) => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const inField = IN_FIELD.includes(job.stage)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const crew = (job.crew || b?.crew) as PersonKey | undefined
  const sf = rooms.flatMap((r) => r.surfaces).reduce((n, x) => n + (x.sf || 0), 0)
  if (!rooms.length) return <RoomsTab job={job} />
  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-faint">
        <span className="inline-flex items-center gap-1.5"><HardHat />{crew ? PEOPLE[crew]?.short : 'No installer yet'}</span>
        {job.dates?.start && <span className="inline-flex items-center gap-1.5"><CalendarDays />{job.dates.start} – {job.dates.finish || '…'}</span>}
        {sf > 0 && <span className="inline-flex items-center gap-1.5"><Grid2x2 />{sf.toLocaleString('en-US')} SF</span>}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] gap-2 max-sm:grid-cols-2" aria-label="The rooms">
        {rooms.map((x) => {
          const p = roomPct(x)
          const wait = x.surfaces.filter((y) => ['blocked', 'waitmat', 'hold'].includes(y.state))
          const stuck = wait.some((y) => y.state === 'blocked')
          const st: CircleState = !inField ? 'later' : p >= 100 ? 'done' : stuck ? 'bad' : wait.length ? 'wait' : p > 0 ? 'now' : 'later'
          return (
            <button key={x.name} data-room={x.name} onClick={() => onRoom(x.name)} className={cn('flex min-w-0 items-center gap-3 rounded-[0.875rem] border bg-white px-3 py-2.5 text-left transition hover:-translate-y-px hover:shadow-card max-sm:gap-2 max-sm:px-2.5', st === 'bad' ? 'border-bad-200' : 'border-[#e8e2d8] hover:border-[#d8d1c5]')}>
              <Circle st={{ key: x.name, label: x.name, state: st, pct: inField ? p : 0, center: !inField ? String(x.surfaces.length) : `${p}%` }} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-semibold leading-tight text-ink">{x.name}</span>
                <span className={cn('mt-0.5 block truncate text-[0.75rem] leading-tight', st === 'bad' ? 'font-medium text-bad-600' : st === 'wait' ? 'text-warn-700' : st === 'done' ? 'text-[#2c8a5b]' : st === 'now' ? 'text-brand-700' : 'text-muted')}>
                  {!inField ? `${x.surfaces.length} walls and floors` : p >= 100 ? 'Done' : wait.length ? `${stuck ? 'Blocked' : 'Waiting'} — ${(wait.find((y) => y.state === 'blocked') || wait[0]).reason || SURF_LABEL[wait[0].state]}` : p > 0 ? `${x.surfaces.filter((y) => y.state === 'done').length} of ${x.surfaces.length} done` : 'Not started'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PunchBody({ job }: { job: Job }) {
  const s = useStore()
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  return (
    <div>
      {canAdd && <div className="mb-2 flex justify-end"><Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId: job.id })}>Add touch-ups</Button></div>}
      <section className="rounded-[0.875rem] border border-[#e8e2d8] bg-white px-4 pb-4 pt-3"><TouchupsList job={job} /></section>
    </div>
  )
}

/** what else is open on the job — requests, questions, things to chase — that isn't one of its questions */
export function AlsoOpen({ job, className, max }: { job: Job; className?: string; /** show this many, the rest one tap away */ max?: number }) {
  const s = useStore()
  const me = meOf(s.role)
  const [all, setAll] = React.useState(false)
  /* problems first, then what we're waiting on, then the rest */
  const rank = (t: (typeof s.tasks)[number]) => (t.tone === 'bad' ? 0 : t.state === 'waiting' ? 1 : 2)
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.title.startsWith('Touch-ups at') && !t.step).sort((a, b) => rank(a) - rank(b))
  if (!tasks.length) return null
  const shown = all || !max ? tasks : tasks.slice(0, max)
  return (
    <section className={cn('overflow-hidden rounded-[1rem] border border-line bg-white', className)} data-also-open>
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5"><h4 className="text-[0.90625rem] font-bold text-ink">Also open</h4><span className="rounded-full bg-wash-2 px-1.5 text-[0.71875rem] font-bold tnum text-ink-2">{tasks.length}</span>
        {shown.length < tasks.length && <button onClick={() => setAll(true)} className="ml-auto text-[0.78125rem] font-semibold text-brand-700 hover:underline">{tasks.length - shown.length} more</button>}
      </header>
      <div className="p-1.5">
        {shown.map((t) => (
          <button key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#f6f3ee]">
            {isRequest(t) ? <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[#fff1e3] text-[#c2410c]"><Truck className="h-3 w-3" /></span> : <StepIcon state={t.tone === 'bad' ? 'bad' : t.state === 'waiting' ? 'wait' : 'now'} size={22} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.84375rem] font-medium text-ink">{t.title}</span>
              <span className={cn('block truncate text-[0.75rem]', t.owner === me ? 'font-semibold text-brand-700' : 'text-muted')}>{t.state === 'waiting' ? `Waiting on ${t.waitingOn}` : t.req ? `${t.req.trip === 'onway' ? 'On the way' : 'Asked'}${t.by ? ` by ${firstName(t.by)}` : ''}` : t.owner === me ? 'You' : firstName(t.owner)}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
