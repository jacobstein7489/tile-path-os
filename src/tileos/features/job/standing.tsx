/* Where the project stands — the left side of the project, always in the same order:
 *   Getting ready · Installing · Touch-ups · Billed and paid
 * Each is one line with its ring; the part the project is in is open. Getting ready is the office's sheet as questions
 * in four parts (Design & setup, Site, Installer, Materials & deposit), each answered Yes, No or N/A. What's answered
 * folds away — a part that's all done is one line — so what's left is what you see. Tap a question for the rest of it
 * (who has it, when, the paperwork, the PO…), right there under it. */
import * as React from 'react'
import { ChevronDown, Plus, Truck, HardHat, CalendarDays, Grid2x2, Check, X, Trash2 } from 'lucide-react'
import { useStore, meOf, isRequest, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Circle, type CircleState } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { roomPct } from '@/tileos/data/jobs'
import { TODAY, labelFromIso, daysBetween } from '@/tileos/lib/today'
import { readyGroups, readyCounts, canAnswer, answerRow, lockedOf, GROUPS, type ReadyRow, type ReadyGroup, type GroupKey, type Answer } from '../ready'
import { addJobStep, removeJobStep } from '../steps'
import { StepIcon, insidePeople } from '../steps-ui'
import { StepInline } from '../stepwin'
import { AnswerPick, NoNote } from '../answer'
import { HeightsInline } from '../heights'
import { pictureOf } from '../progressbill'
import { RoomsTab } from './rooms'
import { MoneyTab } from './money-tab'
import { TouchupsList } from '../touchups'
import { firstName } from './kit'
import { SURF_LABEL } from '@/tileos/data/jobs'

export type StageKey = 'ready' | 'install' | 'punch' | 'money'
const PRICING = ['request', 'estimating', 'proposal', 'followup']
export const IN_FIELD = ['installation', 'punch', 'closeout', 'complete']

/** the part a project is in — the one that's open when it opens */
export function stageOf(s: Store, job: Job): StageKey {
  if (s.role === 'accounting') return 'money'
  if (job.stage === 'installation') return 'install'
  if (job.stage === 'punch') return 'punch'
  if (['closeout', 'complete'].includes(job.stage)) return 'money'
  return 'ready'
}

/* ---------------- the four parts, each one line with its ring ---------------- */
type StageView = { key: StageKey; label: string; state: CircleState; pct?: number; center?: string; words: string; tone?: 'bad' | 'warn' | 'ok' }
export function useStages(job: Job): StageView[] {
  const s = useStore()
  const money = !['site', 'crew'].includes(s.role)
  const inField = IN_FIELD.includes(job.stage)
  const out: StageView[] = []
  const groups = readyGroups(s, job)
  if (groups.length) {
    const c = readyCounts(groups)
    const all = c.done === c.total
    out.push({
      key: 'ready', label: 'Getting ready',
      state: all ? 'done' : 'now',
      pct: c.total ? Math.max(4, Math.round((c.done / c.total) * 100)) : 0,
      center: all ? undefined : String(c.left),
      words: all ? 'All done' : `${c.done} of ${c.total} done${c.bad ? ` · ${c.bad} ${c.bad === 1 ? 'problem' : 'problems'}` : ''}`,
      tone: all ? 'ok' : c.bad ? 'bad' : undefined,
    })
  }
  const rooms = s.rooms[job.id] || []
  const b = s.bookings.find((x) => x.jobId === job.id)
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const days = startIso ? daysBetween(TODAY, startIso) : null
  const pct = inField ? (job.stage === 'installation' ? job.pct ?? 0 : 100) : 0
  const doneRooms = rooms.filter((r) => roomPct(r) >= 100).length
  const late = !inField && !!startIso && startIso < TODAY
  out.push({
    key: 'install', label: 'Installing',
    state: !inField ? (late ? 'bad' : 'later') : pct >= 100 ? 'done' : 'now',
    pct, center: inField && pct < 100 ? `${pct}%` : !inField ? String(rooms.length || '') : undefined,
    words: !inField ? (start ? `${late ? 'Was to start' : 'Starts'} ${start}${!late && days != null && days >= 0 ? ` · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}` : ''}` : 'No start date yet') : pct >= 100 ? `Done${job.dates?.finish ? ` ${job.dates.finish}` : ''}` : `${pct}% · ${doneRooms} of ${rooms.length} rooms done`,
    tone: late ? 'bad' : pct >= 100 ? 'ok' : undefined,
  })
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const open = punch.filter((p) => p.status !== 'verified')
  const after = ['closeout', 'complete'].includes(job.stage)
  out.push({
    key: 'punch', label: 'Touch-ups',
    state: punch.length && !open.length ? 'done' : open.length ? 'now' : after ? 'done' : 'later',
    pct: punch.length ? Math.round(((punch.length - open.length) / punch.length) * 100) : 0,
    center: open.length ? String(open.length) : undefined,
    words: open.length ? `${open.length} open · ${punch.length - open.length} of ${punch.length} checked` : punch.length ? 'All checked' : after ? 'None' : inField ? 'None yet' : 'After the installing',
    tone: punch.length && !open.length ? 'ok' : undefined,
  })
  if (money) {
    const pic = pictureOf(s, job.id)
    const total = pic.contract + pic.changes
    out.push({
      key: 'money', label: 'Billed and paid',
      state: job.stage === 'complete' || (total > 0 && pic.paid >= total) ? 'done' : pic.billed ? 'now' : 'later',
      pct: pic.paidPct, center: pic.billed && pic.paidPct < 100 ? `${pic.paidPct}%` : undefined,
      words: pic.billed ? `${fmtMoney(pic.paid)} of ${fmtMoney(total)} paid` : total ? `Nothing billed yet · ${fmtMoney(total)} contract` : 'Nothing billed yet',
    })
  }
  return out
}

const TONE: Record<string, string> = { ok: 'text-[#2c8a5b]', bad: 'font-medium text-bad-600', warn: 'text-warn-700' }

export function Standing({ job, open, setOpen, focus, setFocus, onRoom }: {
  job: Job
  open: StageKey[]
  setOpen: (k: StageKey[]) => void
  /** a question to open and show ('step:qty', 'site:water') — from "Your turn" */
  focus?: string | null
  setFocus: (id: string | null) => void
  onRoom: (name: string) => void
}) {
  const stages = useStages(job)
  const pricing = PRICING.includes(job.stage)
  if (pricing) return <div className="rounded-[0.875rem] border border-line bg-white px-4 py-8 text-center text-[0.875rem] text-muted">Paperwork, the design meeting, the site, the installer, deliveries, the deposit — it all starts once the estimate is won.</div>
  const toggle = (k: StageKey) => setOpen(open.includes(k) ? open.filter((x) => x !== k) : [...open, k])
  return (
    <div className="flex flex-col gap-2.5" data-standing>
      {stages.map((st) => {
        const on = open.includes(st.key)
        return (
          <section key={st.key} data-stage={st.key} className={cn('overflow-hidden rounded-[1rem] border bg-white transition-shadow', on ? 'border-[#e2dcd1] shadow-[0_0.0625rem_0.1875rem_rgba(16,24,40,.05)]' : 'border-line')}>
            <button onClick={() => toggle(st.key)} aria-expanded={on} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#faf8f5] max-sm:px-3">
              <Circle st={{ key: st.key, label: st.label, state: st.state, pct: st.pct, center: st.center }} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[1rem] font-semibold leading-tight text-ink">{st.label}</span>
                <span className={cn('mt-0.5 block truncate text-[0.8125rem] text-muted', st.tone && TONE[st.tone])}>{st.words}</span>
              </span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-faint transition', on && 'rotate-180')} />
            </button>
            {on && (
              <div className="border-t border-line-2 bg-[#f9f7f3] px-4 pb-4 pt-3 max-sm:px-2.5">
                {st.key === 'ready' ? <Checklist job={job} focus={focus} setFocus={setFocus} />
                  : st.key === 'install' ? <InstallBody job={job} onRoom={onRoom} />
                    : st.key === 'punch' ? <PunchBody job={job} />
                      : <MoneyTab job={job} />}
              </div>
            )}
          </section>
        )
      })}
      <AlsoOpen job={job} />
    </div>
  )
}

/* ================= getting ready: the questions, part by part ================= */
const answered = (r: ReadyRow) => r.state === 'done' || r.state === 'na'
function Checklist({ job, focus, setFocus }: { job: Job; focus?: string | null; setFocus: (id: string | null) => void }) {
  const s = useStore()
  const groups = readyGroups(s, job)
  const [openRow, setOpenRow] = React.useState<string | null>(focus || null)
  const [showDone, setShowDone] = React.useState<Partial<Record<GroupKey, boolean>>>({})
  /* a question just answered stays a moment, its mark landing, before it folds away */
  const [fresh, setFresh] = React.useState<Record<string, true>>({})
  const box = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!focus) return
    setOpenRow(focus)
    const t = setTimeout(() => {
      const el = box.current?.querySelector<HTMLElement>(`[data-row="${focus}"]`)
      el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
      setFocus(null)
    }, 60)
    return () => clearTimeout(t)
  }, [focus])
  const pick = (r: ReadyRow, a: Answer | null) => {
    answerRow(job, r, a)
    if (a === 'yes' || a === 'na') {
      setFresh((f) => ({ ...f, [r.id]: true }))
      setTimeout(() => setFresh((f) => { const n = { ...f }; delete n[r.id]; return n }), 1500)
      if (openRow === r.id) setOpenRow(null)
    }
    if (a === 'no') setOpenRow(r.id)
  }
  return (
    <div ref={box} className="flex flex-col gap-2.5" data-checklist>
      {groups.map((g) => (
        <Group
          key={g.key}
          job={job}
          g={g}
          show={!!showDone[g.key]}
          setShow={(v) => setShowDone((x) => ({ ...x, [g.key]: v }))}
          fresh={fresh}
          openRow={openRow}
          setOpenRow={setOpenRow}
          pick={pick}
        />
      ))}
      <AddQuestion job={job} />
    </div>
  )
}

function Group({ job, g, show, setShow, fresh, openRow, setOpenRow, pick }: {
  job: Job; g: ReadyGroup; show: boolean; setShow: (v: boolean) => void; fresh: Record<string, true>; openRow: string | null; setOpenRow: (id: string | null) => void; pick: (r: ReadyRow, a: Answer | null) => void
}) {
  const all = g.done === g.total
  const rows = g.rows.filter((r) => !answered(r) || show || fresh[r.id] || openRow === r.id)
  return (
    <section data-group={g.key} className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className={cn('flex min-h-11 items-center gap-2 px-4 py-2 max-sm:px-3', rows.length && 'border-b border-line-2')}>
        {all ? <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#2c8a5b] text-white"><Check className="h-3 w-3" strokeWidth={3.4} /></span> : null}
        <h4 className="text-[0.90625rem] font-bold text-ink">{g.label}</h4>
        <span className={cn('text-[0.8125rem]', all ? 'font-semibold text-[#2c8a5b]' : 'text-muted')}>
          {all ? 'All done' : `${g.done} of ${g.total}`}
          {g.bad > 0 && <span className="font-semibold text-bad-600"> · {g.bad} {g.bad === 1 ? 'problem' : 'problems'}</span>}
        </span>
        {g.done > 0 && (
          <button onClick={() => setShow(!show)} className="ml-auto rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50">
            {show ? 'Hide what’s done' : all ? 'Show' : `Show ${g.done} done`}
          </button>
        )}
      </header>
      {rows.map((r) => <Row key={r.id} job={job} r={r} fresh={!!fresh[r.id]} open={openRow === r.id} onToggle={() => setOpenRow(openRow === r.id ? null : r.id)} pick={pick} />)}
    </section>
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
  if (r.state === 'later') return { text: r.step.waitsFor ? `Not yet — after: ${r.step.waitsFor.toLowerCase()}` : 'Not yet', tone: 'text-faint' }
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
      <div className="flex items-center gap-3 px-4 py-2.5 max-sm:gap-2.5 max-sm:px-3">
        <span className={cn('inline-flex shrink-0', fresh && 'cheer-check')}><StepIcon state={r.state} size={22} /></span>
        <button onClick={onToggle} aria-expanded={open} className="group min-w-0 flex-1 text-left">
          <span className="flex min-w-0 items-center gap-1">
            <span className={cn('line-clamp-2 text-[0.90625rem] font-semibold leading-snug', r.state === 'na' ? 'text-muted' : 'text-ink')}>{r.q}</span>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-faint opacity-0 transition group-hover:opacity-100 pointer-coarse:opacity-100', open && 'rotate-180 opacity-100')} />
          </span>
          <span className={cn('block truncate text-[0.78125rem] text-muted', w.tone)}>{w.text}</span>
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

/** a question just for this project — in the part it belongs to, answered by whoever it's for */
function AddQuestion({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const [on, setOn] = React.useState(false)
  const [text, setText] = React.useState('')
  const [g, setG] = React.useState<GroupKey>('site')
  const siteOwner = (readyGroups(s, job).find((x) => x.key === 'site')?.rows[0]?.owner || me) as PersonKey
  const [who, setWho] = React.useState<PersonKey | null>(null)
  const owner = who || (g === 'site' ? siteOwner : me)
  if (['crew', 'client', 'accounting'].includes(s.role)) return null
  if (!on) return (
    <button onClick={() => setOn(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.875rem] border border-dashed border-[#d6cfc3] bg-white/60 text-[0.84375rem] font-semibold text-muted transition hover:border-brand-300 hover:text-brand-700">
      <Plus className="h-4 w-4" />Add a question
    </button>
  )
  const add = () => {
    const q = text.trim()
    if (!q) return
    addJobStep(job.id, /\?$/.test(q) ? q : `${q}?`, owner, undefined, g)
    setText('')
    setOn(false)
  }
  const pill = 'inline-flex h-9 items-center gap-1.5 rounded-[0.5625rem] border border-line bg-white px-2.5 text-[0.8125rem] font-semibold text-ink-2 hover:bg-wash'
  return (
    <div className="rounded-[0.875rem] border border-line bg-white p-3" data-add-question>
      <div className="mb-2 text-[0.84375rem] font-semibold text-ink">A question just for {job.name}</div>
      <TextInput mic autoFocus aria-label="The question" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} placeholder="e.g. Heated floor wire on site?" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Menu align="start" width={240} trigger={<button className={pill} aria-label="Which part">{GROUPS.find((x) => x.key === g)?.label}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
          <MenuLabel>In which part</MenuLabel>
          {GROUPS.filter((x) => x.key !== 'other').map((x) => <MenuItem key={x.key} checked={g === x.key} hint={x.sub} onSelect={() => setG(x.key)}>{x.label}</MenuItem>)}
        </Menu>
        <Menu align="start" width={280} trigger={<button className={pill} aria-label="Who answers it"><Avatar who={owner} size={20} plain />{owner === me ? 'You' : PEOPLE[owner]?.short}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
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
function AlsoOpen({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.title.startsWith('Touch-ups at') && !t.step)
  if (!tasks.length) return null
  return (
    <section className="overflow-hidden rounded-[1rem] border border-line bg-white" data-also-open>
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5"><h4 className="text-[0.90625rem] font-bold text-ink">Also open</h4><span className="rounded-full bg-wash-2 px-1.5 text-[0.71875rem] font-bold tnum text-ink-2">{tasks.length}</span></header>
      <div className="p-1.5">
        {tasks.map((t) => (
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
