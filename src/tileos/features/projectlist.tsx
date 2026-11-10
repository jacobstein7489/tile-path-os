/* Projects — won work only (estimates live in Estimates). A plain list, one line per project:
 *   Project · Client · Now · When
 * No status column: the group it's under already says it. Red only for a problem. */
import * as React from 'react'
import { Plus, Wrench, CircleCheckBig, Building2, HardHat, ClipboardList, Sparkles, PauseCircle, Layers } from 'lucide-react'
import { useStore, addHist, newTask, NOW, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Group, EmptyState, Bubbles, STICKY_HEAD, HEAD_ROW, ROW_H } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, fmtMoney, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { billingOf } from './job/money-tab'
import { stepsFor, companySteps, IN_FIELD_STAGES } from './steps'
import { pictureOf } from './progressbill'
import { tracksFor, bookingOf, problemsOf, gateOpen, leadWords } from './tracks'
import { Whose, stepWords } from './job/whatsleft'
import { NewProjectKind } from './estnew'
import { installerOf } from './upcoming'
import { TODAY, md, isoFromLabel, labelFromIso } from '@/tileos/lib/today'
import { SearchSelect } from '@/tileos/components/ui/select'
import { isOff } from './active'
import { allowedFor } from './newpicker'
import { FormHead, FormRow, DAY_OPTIONS } from './formkit'

const PRICING: Stage[] = ['request', 'estimating', 'proposal', 'followup']
export type ProjType = 'hold' | 'coming' | 'progress' | 'touchups' | 'repairs' | 'done'
export const PROJ_TYPES: { key: ProjType; label: string }[] = [
  { key: 'hold', label: 'On hold' },
  { key: 'coming', label: 'Getting ready' },
  { key: 'progress', label: 'In progress' },
  { key: 'touchups', label: 'Touch-ups' },
  { key: 'repairs', label: 'Repairs' },
  { key: 'done', label: 'Finished' },
]
export function typeOf(j: Job): ProjType {
  if (j.hold) return 'hold'
  if (j.kind === 'repair' && !['closeout', 'complete'].includes(j.stage)) return 'repairs'
  if (['awarded', 'setup', 'verification', 'ready', 'scheduled'].includes(j.stage)) return 'coming'
  if (j.stage === 'installation') return 'progress'
  if (j.stage === 'punch') return 'touchups'
  return 'done'
}
const TONE_ORDER: Record<string, number> = { bad: 0, warn: 1, info: 2, vio: 2, ok: 3, neutral: 4 }

/** where a won project sits in the company's flow */
export type FlowKey = 'setup' | 'ready' | 'progress' | 'hold' | 'touchups' | 'closeout' | 'done' | 'repairs'
export function flowOf(j: Job): FlowKey {
  if (j.hold) return 'hold'
  if (j.kind === 'repair' && !['closeout', 'complete'].includes(j.stage)) return 'repairs'
  if (['awarded', 'setup', 'verification'].includes(j.stage)) return 'setup'
  if (['ready', 'scheduled'].includes(j.stage)) return 'ready'
  if (j.stage === 'installation') return 'progress'
  if (j.stage === 'punch') return 'touchups'
  return 'done'
}
type View = 'active' | ProjType
const VIEW_LABEL: Record<View, string> = { active: 'All open', hold: 'On hold', coming: 'Getting ready', progress: 'In progress', touchups: 'Touch-ups', repairs: 'Repairs', done: 'Finished' }

export function ProjectsPage() {
  const s = useStore()
  const route = s.route
  const q0 = route.q?.flow as string | undefined
  const [view, setView] = React.useState<View>(q0 === 'setup' || q0 === 'ready' ? 'coming' : (q0 as View) || 'active')
  const [client, setClient] = React.useState('all')
  const [crew, setCrew] = React.useState('all')
  const [att, setAtt] = React.useState<'all' | 'yes'>(route.q?.attention === '1' ? 'yes' : 'all')
  const [q, setQ] = React.useState('')
  const won = Object.values(s.jobs).filter((j) => !PRICING.includes(j.stage))
  const crewOf = (j: Job) => (j.crew || s.bookings.find((b) => b.jobId === j.id)?.crew || (s.prep[j.id]?.installer !== 'tbd' ? s.prep[j.id]?.installer : undefined)) as PersonKey | undefined
  const match = (j: Job) =>
    (client === 'all' || j.clientId === client) &&
    (crew === 'all' || crewOf(j) === crew) &&
    (att === 'all' || j.status === 'bad') &&
    (!q || `${j.name} ${j.client} ${j.address} ${j.headline}`.toLowerCase().includes(q.toLowerCase()))
  const inView = (j: Job) => (view === 'active' ? typeOf(j) !== 'done' : typeOf(j) === view)
  const list = won.filter(match).filter(inView)
  /* a date column only when a project on the list has a date */
  const when = list.some((j) => !!whenOf(s, j).text)
  /* in each group: the ones with a problem first, then yours, then by the day they start */
  const me = meOf(s.role)
  const rank = (j: Job) => { const w = nowOf(s, j); return w.tone === 'bad' ? 0 : w.who === me && w.tone !== 'quiet' ? 1 : 2 }
  const startOf = (j: Job) => bookingOf(s, j)?.start || s.prep[j.id]?.targetISO || '9999'
  list.sort((a, b) => PROJ_TYPES.findIndex((t) => t.key === typeOf(a)) - PROJ_TYPES.findIndex((t) => t.key === typeOf(b)) || rank(a) - rank(b) || (typeOf(a) === 'coming' ? startOf(a).localeCompare(startOf(b)) : 0) || TONE_ORDER[a.status] - TONE_ORDER[b.status])
  const n = (k: ProjType) => won.filter((j) => typeOf(j) === k).length
  const pick = (k: View) => () => setView(view === k ? 'active' : k)
  const clients = Array.from(new Set(won.map((j) => j.clientId))).map((id) => ({ key: id, label: CUSTOMERS[id]?.name || won.find((j) => j.clientId === id)!.client }))
  return (
    <Page
      title="Projects"
      /* bringing in the projects that were going before Tile OS, and going through them, is one-time work: it's in
         Settings, not on this page every day */
      top={
        <Bubbles
          row
          items={[
            { key: 'active', label: 'All open', count: won.filter((j) => typeOf(j) !== 'done').length, icon: <Layers />, color: 'indigo', on: view === 'active', onClick: () => setView('active') },
            { key: 'coming', label: 'Getting ready', count: n('coming'), icon: <ClipboardList />, color: 'violet', on: view === 'coming', onClick: pick('coming'), gapBefore: true },
            { key: 'progress', label: 'In progress', count: n('progress'), icon: <HardHat />, color: 'green', on: view === 'progress', onClick: pick('progress') },
            { key: 'hold', label: 'On hold', count: n('hold'), icon: <PauseCircle />, color: 'red', on: view === 'hold', onClick: pick('hold') },
            { key: 'touchups', label: 'Touch-ups', count: n('touchups'), icon: <Sparkles />, color: 'amber', on: view === 'touchups', onClick: pick('touchups') },
            { key: 'repairs', label: 'Repairs', count: n('repairs'), icon: <Wrench />, color: 'rose', on: view === 'repairs', onClick: pick('repairs') },
            { key: 'done', label: 'Finished', count: n('done'), icon: <CircleCheckBig />, color: 'teal', on: view === 'done', onClick: pick('done'), gapBefore: true },
          ]}
        />
      }
      toolbar={
        <>
          <div className="flex w-full flex-wrap items-center gap-2">
            <Filter icon={<Building2 />} label="Client" value={client} options={clients} onChange={setClient} width={280} />
            <Filter icon={<HardHat />} label="Installer" value={crew} options={CREWS.map((c) => ({ key: c, label: PEOPLE[c].name }))} onChange={setCrew} />
            <ClearFilters show={client !== 'all' || crew !== 'all' || att !== 'all' || !!q} onClear={() => { setClient('all'); setCrew('all'); setAtt('all'); setQ('') }} />
            {/* on a phone the search on top finds a project — the filters fit on one line, nothing slides sideways */}
            <ToolbarSearch value={q} onChange={setQ} placeholder="Search projects" className="max-md:hidden" />
          </div>
        </>
      }
    >
      <div style={{ '--list': listCols(when, false), '--list-xl': listCols(when, true) } as React.CSSProperties} data-even-list>
        {!!list.length && <ListHead when={when} />}
        {view === 'active'
          ? PROJ_TYPES.filter((t) => t.key !== 'done').map((t) => {
              const rows = list.filter((j) => typeOf(j) === t.key)
              if (!rows.length) return null
              return (
                <section key={t.key}>
                  <Group label={t.label} count={rows.length} tone={TYPE_TONE[t.key]} />
                  {rows.map((j) => <ProjectRow key={j.id} j={j} when={when} />)}
                </section>
              )
            })
          : list.map((j) => <ProjectRow key={j.id} j={j} when={when} />)}
        {!list.length && <EmptyState icon={<Building2 />} title="No projects here" sub={view === 'repairs' ? 'Repair jobs and callbacks land here.' : 'Try another filter.'} action={view === 'repairs' && allowedFor(s.role, 'newrepair') ? <Button icon={<Wrench />} onClick={() => s.open({ t: 'newrepair' })}>New repair</Button> : undefined} />}
      </div>
    </Page>
  )
}

const TYPE_TONE: Record<ProjType, 'info' | 'ok' | 'warn' | 'vio' | 'neutral' | 'bad'> = { hold: 'bad', coming: 'vio', progress: 'ok', touchups: 'warn', repairs: 'vio', done: 'neutral' }

/* One line per project — the same as Estimates: the project's name (bold — it's the line's name), the client (gray),
 * what's going on now, whose turn it is (their little circle and name), and the date:
 *   Project · (Client, on a wide screen) · Now · Whose turn · Date
 * Now is always one thing: the first problem, in red (and how many more), or else the step that's up — in the same
 * words as on Today — or how far it is (51% installed · 2 to fix). The date is the day it starts, or the day it's to
 * be done. One color means something — red, a problem. Nothing else to decode. On a phone: the name and the date,
 * what's up and whose under it. */
const COLS = 'grid items-center gap-x-6 max-md:block'
/** the columns: the names and Now share the width (Now more — it says what's up); whose turn and the date are as wide
 *  as they need. A long one is cut short, so nothing runs into the next column. Date is a column only when a project on
 *  the list has one */
const listCols = (when: boolean, xl: boolean) => [xl ? 'minmax(0,1fr) minmax(0,0.75fr)' : 'minmax(0,1fr)', 'minmax(0,1.6fr)', 'minmax(0,9rem)', when ? 'max-content' : ''].filter(Boolean).join(' ')

function ListHead({ when }: { when: boolean }) {
  return (
    <div className={cn(HEAD_ROW, 'px-5', COLS, STICKY_HEAD, 'max-md:hidden')} data-list-head data-subrow>
      <span>Project</span>
      <span className="max-xl:hidden">Client</span>
      <span>Now</span>
      <span>Whose turn</span>
      {when && <span className="text-right" data-when-head>Date</span>}
    </div>
  )
}

/** a project that's started — or a repair — is past getting ready */
export const pastReady = (j: Job) => j.kind === 'repair' || IN_FIELD_STAGES.includes(j.stage)
/** how far a project that started is, in words: installing — how much is in; touch-ups — how many are left to fix and
 *  to check; closing and finished — how much of it is paid */
export function howFar(s: Store, j: Job): { pct: number; text: string; tone?: 'ok' | 'warn' } {
  if (j.stage === 'installation') { const p = j.pct ?? 0; return { pct: p, text: `${p}% installed` } }
  if (j.stage === 'punch' || (j.kind === 'repair' && !['closeout', 'complete'].includes(j.stage))) {
    const all = s.punch.filter((p) => p.jobId === j.id)
    if (!all.length) return { pct: 0, text: j.kind === 'repair' ? 'Repair' : 'No touch-ups yet' }
    const checked = all.filter((p) => p.status === 'verified').length
    const toCheck = all.filter((p) => p.status === 'verify').length
    const toFix = all.length - checked - toCheck
    const text = toFix ? `${toFix} to fix${toCheck ? ` · ${toCheck} to check` : ''}` : toCheck ? `${toCheck} to check` : 'All checked'
    return { pct: Math.round((checked / all.length) * 100), text, tone: toFix || toCheck ? undefined : 'ok' }
  }
  const pic = pictureOf(s, j.id)
  return pic.paidPct >= 100 ? { pct: 100, text: 'Paid in full', tone: 'ok' } : { pct: pic.paidPct, text: `${pic.billedPct}% billed · ${pic.paidPct}% paid` }
}

/** the project's date: the day it starts (amber once it's passed and no crew is booked) — or the day it's to be done,
 *  or the day the installer is back */
export function whenOf(s: Store, j: Job): { text: string; late?: boolean } {
  const t = typeOf(j)
  const b = bookingOf(s, j)
  if (t === 'coming') {
    const iso = b?.start || s.prep[j.id]?.targetISO
    return iso ? { text: `Starts ${md(iso)}`, late: !b && iso < TODAY } : { text: '' }
  }
  if (t === 'progress') {
    if (b?.end) return { text: `Ends ${md(b.end)}`, late: b.end < TODAY }
    return { text: j.dates?.finish ? `Ends ${j.dates.finish}` : '' }
  }
  if (t === 'touchups' || t === 'repairs') {
    const back = s.bookings.filter((x) => x.jobId === j.id && x.end >= TODAY && (t === 'repairs' || x.label === 'Return visit')).sort((a, c) => a.start.localeCompare(c.start))[0]
    if (!back) return { text: '' }
    return { text: back.start <= TODAY ? 'Today' : `${t === 'repairs' ? 'Booked' : 'Back'} ${md(back.start)}` }
  }
  return { text: '' }
}
/** the date, shorter, for a phone ("Nov 23", "ends Nov 20") */
const whenShort = (w: string) => w.replace(/^Starts /, '').replace(/^(Ends|Back) /, (m) => m.toLowerCase()).replace(/^Booked /, '')

/** the one thing on a project now, in a few words — always something: a problem (red), the step that's up, how far it
 *  is — and whose it is */
export type NowWords = { text: string; who?: PersonKey; more?: number; tone?: 'bad' | 'quiet' }
export function nowOf(s: Store, j: Job, probs: ReturnType<typeof problemsOf> = problemsOf(s, j)): NowWords {
  const steps = stepsFor(s, j)
  if (probs.length) {
    const p = probs[0]
    const who = (p.task ? s.tasks.find((t) => t.id === p.task)?.owner : p.step ? steps.find((v) => v.key === p.step)?.owner : undefined) as PersonKey | undefined
    return { text: p.text, who, more: probs.length - 1, tone: 'bad' }
  }
  const t = typeOf(j)
  const me = meOf(s.role)
  const b = bookingOf(s, j)
  const crew = (b?.crew || j.crew || installerOf(s, j)) as PersonKey | undefined
  const cap = (x: string) => x.replace(/^./, (c) => c.toUpperCase())
  if (t === 'hold') return { text: j.hold?.shortage ? 'Waiting for the tile' : j.hold?.reason ? cap(j.hold.reason) : 'On hold', tone: 'quiet' }
  if (t === 'progress') return crew ? { text: `${j.pct ?? 0}% installed`, who: crew } : { text: 'No installer on it' }
  if (t === 'touchups') return crew ? { text: cap(howFar(s, j).text), who: crew } : { text: 'Pick who fixes them' }
  if (t === 'repairs') return crew ? { text: s.punch.some((p) => p.jobId === j.id) ? cap(howFar(s, j).text) : j.scope || 'Repair', who: crew } : { text: 'Pick a crew' }
  if (t === 'done') { const bl = billingOf(j); return bl.paidPct >= 100 ? { text: 'Paid and closed', tone: 'quiet' } : bl.billedPct >= 100 ? { text: 'Waiting to be paid', tone: 'quiet' } : { text: 'Bill the rest' } }
  /* getting ready: the step that's up — yours first, then the first one someone has to do (in the job's order), then
     what it waits on */
  const tracks = tracksFor(s, j, steps)
  if (gateOpen(tracks)) return b ? { text: 'Crew booked', who: b.crew as PersonKey } : { text: 'Ready — book the crew', who: steps.find((v) => v.key === 'installer')?.owner }
  const open = tracks.filter((x) => x.state !== 'done' && x.lead)
  const leads = open.map((x) => x.lead!)
  const v = leads.find((x) => x.state === 'now' && x.owner === me) || leads.find((x) => x.state === 'now') || leads.find((x) => x.state === 'wait') || leads.find((x) => x.state === 'later') || leads[0]
  if (!v) return { text: 'Getting ready', tone: 'quiet' }
  const step = stepWords(s, j, v)
  if (v.state === 'wait') return { text: `${step} · ${leadWords(s, j, open.find((x) => x.lead === v)!).top.replace(/^./, (c) => c.toLowerCase())}`, who: v.owner, tone: 'quiet' }
  if (v.state === 'later') return { text: step, who: v.owner, tone: 'quiet' }
  return { text: step, who: v.owner }
}

function NowLine({ w, all }: { w: NowWords; /** every problem, for pointing at the line */ all: { text: string }[] }) {
  return (
    <span data-now-text data-tone={w.tone || 'now'} title={all.length > 1 ? all.map((p) => p.text).join('\n') : undefined} className={cn('min-w-0 truncate text-[0.875rem]', w.tone === 'bad' ? 'font-medium text-bad-600' : w.tone === 'quiet' ? 'text-muted' : 'text-ink')}>
      {w.text}
      {!!w.more && <span className="font-normal text-muted" data-more={w.more}> · +{w.more} more</span>}
    </span>
  )
}

function ProjectRow({ j, when: hasWhen }: { j: Job; when: boolean }) {
  const s = useStore()
  const probs = problemsOf(s, j)
  const now = nowOf(s, j, probs)
  const w = whenOf(s, j)
  const open = () => s.open({ t: 'job', id: j.id })
  const date = (cls: string, text: string) => <span className={cn(cls, 'whitespace-nowrap tnum', w.late ? 'font-medium text-warn-700' : 'text-muted')} title={w.late ? 'The start date passed' : undefined} data-when>{text}</span>
  return (
    <div
      role="button"
      tabIndex={0}
      data-project={j.id}
      data-problem-row={probs.length ? '' : undefined}
      data-subrow
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open() }}
      className={cn(ROW_H, 'cursor-pointer border-t border-line-2 py-1.5 pl-5 pr-5 transition-colors row-hover max-md:px-4 max-md:py-2.5', COLS)}
    >
      {/* a computer: one line, each thing in its column */}
      <div className="flex min-w-0 items-center gap-2 max-md:hidden">
        <span className="truncate text-[0.9375rem] font-semibold text-ink">{j.name}</span>
        {j.kind === 'repair' && <span className="shrink-0 text-[0.8125rem] text-muted">Repair</span>}
      </div>
      <span className="min-w-0 truncate text-[0.875rem] text-muted max-xl:hidden">{j.client}</span>
      <div className="flex min-w-0 items-center max-md:hidden" data-now><NowLine w={now} all={probs} /></div>
      <span className="min-w-0 max-md:hidden" data-turn={now.who || ''}><Whose who={now.who} /></span>
      {hasWhen && (w.text ? date('text-right text-[0.875rem] max-md:hidden', w.text) : <span className="text-right text-[0.875rem] text-faint max-md:hidden" data-when>—</span>)}
      {/* a phone: the name and the date; what's up and whose under it */}
      <div className="hidden min-w-0 max-md:block">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{j.name}</span>
          {!!w.text && date('shrink-0 text-[0.8125rem]', whenShort(w.text))}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-3">
          <span className="flex min-w-0 flex-1" data-now><NowLine w={now} all={probs} /></span>
          {now.who && <Whose who={now.who} size={16} className="shrink-0 [&_[data-who-name]]:text-[0.8125rem]" />}
        </div>
      </div>
    </div>
  )
}

/* ================= a repair job — doesn't need an estimate ================= */
export function NewRepairModal({ level }: { level: number }) {
  const s = useStore()
  const [clientId, setClientId] = React.useState('')
  const [name, setName] = React.useState('')
  const [what, setWhat] = React.useState('')
  const [billable, setBillable] = React.useState<boolean | null>(null)
  const [crew, setCrew] = React.useState<PersonKey | ''>('')
  const [day, setDay] = React.useState('Tomorrow')
  const client = CUSTOMERS[clientId]
  const create = () => {
    const id = 'rep' + Date.now().toString(36)
    const iso = isoFromLabel(day) || TODAY
    s.commit((st) => {
      st.jobs[id] = {
        id, name: name.trim(), client: client.name, clientId, address: client.address, stage: 'setup', kind: 'repair',
        status: 'warn', headline: 'Repair · needs a crew', issues: [{ tone: 'warn', text: 'No crew yet' }],
        next: { text: 'Pick a crew and a day', owner: 'ys', due: 'This week' }, keyDate: { label: 'Opened', value: NOW },
        swatch: 'bianco', building: 'house', scope: what.trim(), contract: billable ? undefined : 0, stageDates: { won: NOW },
      }
      st.rooms[id] = [{ name: 'Repair', pct: 0, surfaces: [{ name: what.trim() || 'Repair', tile: '', state: 'notstarted' }] }]
      if (crew) {
        st.bookings.push({ id: 'bk' + Date.now().toString(36), crew, jobId: id, start: iso, end: iso, label: 'Repair', workers: 1, status: 'pending' } as any)
        st.jobs[id].crew = crew
        st.jobs[id].headline = `Repair · ${PEOPLE[crew].short} ${day.toLowerCase()}`
        st.jobs[id].issues = []
        st.punch.push({ id: 'pu' + Date.now(), jobId: id, text: what.trim(), where: 'Repair', owner: crew, status: 'open', note: `Booked ${day}` })
        newTask(st, { jobId: id, title: `Check the ${name.trim()} repair`, type: 'Field', owner: 'yakov', for: ['site'], state: 'now', due: day, tone: 'info', where: `${PEOPLE[crew].name} · ${day}`, action: { label: 'Open the list', kind: 'tab:touchups' } })
      } else newTask(st, { jobId: id, title: `Book a crew for the ${name.trim()} repair`, type: 'Schedule', owner: 'ys', for: ['owner', 'pm'], state: 'now', due: 'This week', tone: 'info', where: what.trim(), action: { label: 'Assign crew', kind: 'assign' } })
      addHist(st, id, { who: meOf(st.role), kind: 'field', title: `Repair opened${billable ? ' · billable' : ' · warranty, no charge'}`, detail: what.trim() })
    }, `${name.trim()} added to Repairs`, crew ? { sub: `${PEOPLE[crew].name} is on the calendar ${day.toLowerCase()}; the site manager checks it after.`, to: [{ who: crew, what: `Repair · ${day}` }, { who: 'yakov', what: 'Check it after' }] } : undefined)
    s.close()
    setTimeout(() => s.open({ t: 'job', id }), 60)
  }
  const crews = CREWS.filter((c) => !isOff(s, 'crew', c))
  const days = DAY_OPTIONS()
  if (!days.some((d) => d.key === day)) days.unshift({ key: day, label: day })
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="New repair"
      header={<FormHead k="newrepair" kicker="Start something new" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <span className="text-[0.8125rem] text-muted">It goes straight to Projects → Repairs</span>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" disabled={!clientId || !name.trim() || !what.trim() || billable === null} onClick={create}>Add repair</Button>
        </>
      }
    >
      <FormRow label="Client">
        <SearchSelect label="Client" value={clientId} onChange={(id) => { setClientId(id); if (!name) setName(`${CUSTOMERS[id]?.name.split(' ')[0]} repair`) }} placeholder="Type a client" options={Object.values(CUSTOMERS).filter((c) => !isOff(s, 'client', c.id)).map((c) => ({ key: c.id, label: c.name, hint: c.kind }))} search />
      </FormRow>
      <FormRow label="What needs fixing?">
        <TextInput mic aria-label="What needs fixing" value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Cracked tiles at the elevator landing" />
      </FormRow>
      <FormRow label="Name it" hint="How it shows on Projects">
        <TextInput aria-label="Repair name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 830 Northwood — lobby grout" />
      </FormRow>
      <FormRow label="Who pays?">
        <SearchSelect label="Who pays" value={billable === null ? '' : billable ? 'bill' : 'warranty'} onChange={(k) => setBillable(k === 'bill')} placeholder="Pick one" search={false} width={300} options={[{ key: 'bill', label: 'We bill the client' }, { key: 'warranty', label: 'Warranty — no charge' }]} />
      </FormRow>
      <FormRow label="Who does it">
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <SearchSelect label="Who does it" value={crew} onChange={(k) => setCrew(k as PersonKey | '')} emptyLabel="Book a crew later" placeholder="Book a crew later" search={false} width={300} options={crews.map((c) => ({ key: c, label: PEOPLE[c].name, lead: <Avatar who={c} size={22} /> }))} plain />
          {crew && <SearchSelect label="When" value={day} onChange={setDay} search={false} width={260} options={days.map((d) => ({ key: d.key, label: d.label }))} plain />}
        </div>
      </FormRow>
    </Modal>
  )
}

/* ================= a new project, straight away — won without an estimate here, or brought in from before ================= */
/* a project that's already under way when it goes into Tile OS (measured and priced before, waiting for the tile):
 * pick where it's at, and everything before is checked off — "before Tile OS" — so only what's left lands on lists */
type At = 'new' | 'tile' | 'ready'
const AT_OPTIONS: { key: At; label: string; hint: string }[] = [
  { key: 'new', label: 'Just won — start from the beginning', hint: 'Every step of getting ready' },
  { key: 'tile', label: 'Measured and priced — waiting for the tile', hint: 'What’s left: the tile delivery, the installer, our materials' },
  { key: 'ready', label: 'The tile is here — ready for the installer', hint: 'What’s left: the installer’s PO, our materials, the crew' },
]
/** what's still open at each point — the rest was done before Tile OS */
const OPEN_AT: Record<Exclude<At, 'new'>, string[]> = {
  tile: ['order', 'delivered', 'installer', 'walk', 'confirmed', 'materials', 'matin', 'deposit'],
  ready: ['installer', 'walk', 'confirmed', 'materials', 'matin', 'deposit'],
}
export function NewProjectModal({ level, name: name0, address: address0 }: { level: number; name?: string; address?: string }) {
  const s = useStore()
  const [at, setAt] = React.useState<At>('new')
  const [clientId, setClientId] = React.useState('')
  const [name, setName] = React.useState(name0 || '')
  const [address, setAddress] = React.useState(address0 || '')
  const [contract, setContract] = React.useState('')
  const [start, setStart] = React.useState('')
  const [pm, setPm] = React.useState<PersonKey>('ys')
  /* two questions — who it's for and where. The rest (a name, the contract, when, who runs it) can wait */
  const [more, setMore] = React.useState(false)
  const client = CUSTOMERS[clientId]
  const amount = Number(contract.replace(/[^0-9.]/g, '')) || 0
  /* most projects go by their street address — "42 Orchard St" */
  const finalName = name.trim() || address.split(',')[0].trim()
  const create = () => {
    const id = 'p' + Date.now().toString(36)
    const iso = start ? isoFromLabel(start) : undefined
    const pct = s.rules.depositPct
    s.commit((st) => {
      st.jobs[id] = {
        id, name: finalName, client: client.name, clientId, address: address.trim() || client.address, stage: 'setup', kind: 'install',
        status: 'info', headline: 'New project · setup starts', issues: [{ tone: 'warn', text: 'Setup not started' }], pm, site: 'yakov',
        next: { text: 'Build the rooms and surfaces', owner: 'office', due: 'Wed' }, keyDate: { label: 'Won', value: NOW },
        swatch: 'bianco', building: 'house', contract: amount || undefined, stageDates: { won: NOW, setup: NOW },
      }
      st.rooms[id] = []
      st.prep[id] = { ...(iso ? { targetISO: iso, target: start } : { target: 'TBD' }), meeting: { text: 'TBD' }, installer: 'tbd', confirmed: 'no', paperwork: 'no', po: 'no', material: 'no', deposit: amount ? 'no' : 'na' } as any
      if (amount && pct) {
        const amt = Math.round((amount * pct) / 100)
        st.money.unshift({ id: 'dep-' + id, jobId: id, kind: 'deposit', title: `Deposit ${pct}%`, amount: amt, step: 0, state: 'todo', due: 'Today', dueTone: 'warn', note: 'Created with the project.', log: [{ date: NOW, who: 'system', text: 'Deposit required — created with the project' }], action: 'Create invoice' } as any)
      }
      addHist(st, id, { who: meOf(st.role), kind: 'pricing', title: 'Project created', detail: amount ? `Contract ${fmtMoney(amount)}` : undefined })
      /* already under way: what came before is checked off; the room sheets aren't needed (it started without them) */
      if (at !== 'new') {
        const open = OPEN_AT[at]
        const recs = (st.stepRecs[id] ||= {})
        companySteps(st).forEach((d) => {
          if (open.includes(d.key)) return
          recs[d.key] = d.key === 'sheets' ? { na: true } : { done: NOW, by: meOf(st.role), note: 'Done before Tile OS' }
        })
        st.jobs[id].headline = at === 'tile' ? 'Under way · waiting for the tile' : 'Under way · tile is here'
        st.jobs[id].issues = []
        st.jobs[id].next = at === 'tile' ? { text: 'Get the tile delivery date', owner: 'office', due: 'Today' } : { text: 'Send the installer his PO', owner: 'ys', due: 'Today' }
        addHist(st, id, { who: meOf(st.role), kind: 'field', title: `Entered under way — ${AT_OPTIONS.find((x) => x.key === at)!.label.toLowerCase()}`, detail: 'What came before is checked off as done before Tile OS' })
      }
    }, `${finalName} is set up`, at === 'new'
      ? { sub: 'Its checklist starts with the office building the rooms.', to: [{ who: 'office', what: `Build the rooms · ${finalName}` }, ...(amount ? [{ who: 'accounting' as PersonKey, what: 'Deposit invoice' }] : [])] }
      : { sub: 'What came before is checked off. Only what’s left is on people’s lists.', to: [...(at === 'tile' ? [{ who: 'office' as PersonKey, what: `Tile delivery date · ${finalName}` }] : []), { who: 'ys' as PersonKey, what: `Installer’s PO · ${finalName}` }, ...(amount ? [{ who: 'accounting' as PersonKey, what: 'Deposit invoice' }] : [])] })
    s.close()
    setTimeout(() => s.open({ t: 'job', id }), 60)
  }
  const days = DAY_OPTIONS()
  const startOpts = [...days.map((d) => ({ key: d.key, label: d.label })), { key: 'Next Mon', label: 'Next Monday' }, { key: 'In 2 weeks', label: 'In 2 weeks' }]
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="New project"
      header={<FormHead k="newproject" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <Button className="ml-auto" variant="primary" disabled={!clientId || !finalName} onClick={create}>Create project</Button>
        </>
      }
    >
      <NewProjectKind value="won" onChange={(v) => { if (v === 'price') s.swap({ t: 'newreq', name, address }) }} />
      {/* the same boxes as Price it: the project, then the client */}
      <FormRow label="Project">
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <TextInput aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder={address.split(',')[0].trim() || 'Name — e.g. Leeds Residence'} className="h-10" />
          <TextInput aria-label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address — street, city" className="h-10" />
        </div>
      </FormRow>
      <FormRow label="Client">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><SearchSelect label="Client" value={clientId} onChange={setClientId} placeholder="Type a client" options={Object.values(CUSTOMERS).filter((c) => !isOff(s, 'client', c.id)).map((c) => ({ key: c.id, label: c.name, hint: c.kind }))} search /></div>
          <Button onClick={() => s.open({ t: 'newclient' })} icon={<Plus />}>New</Button>
        </div>
      </FormRow>
      <FormRow label="Where it’s at">
        <SearchSelect label="Where it’s at" value={at} onChange={(k) => setAt((k || 'new') as At)} search={false} options={AT_OPTIONS.map((x) => ({ key: x.key, label: x.label }))} plain />
      </FormRow>
      {!more && (
        <button onClick={() => setMore(true)} className="mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-2 hover:text-ink">
          <Plus className="h-4 w-4" />Contract and start date
        </button>
      )}
      {more && <>
        <FormRow label="Contract">
          <TextInput aria-label="Contract" inputMode="decimal" value={contract} onChange={(e) => setContract(e.target.value)} placeholder="$0" />
        </FormRow>
        <FormRow label="Start and who runs it">
          <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <SearchSelect label="When can we start" value={start} onChange={setStart} placeholder="Start — not set yet" emptyLabel="Not set yet" search={false} width={260} options={startOpts} plain />
            <SearchSelect label="Project manager" value={pm} onChange={(k) => setPm(k as PersonKey)} search={false} width={280} options={(['ys', 'office'] as PersonKey[]).map((p) => ({ key: p, label: PEOPLE[p].name, hint: 'Runs it', lead: <Avatar who={p} size={22} /> }))} plain />
          </div>
        </FormRow>
      </>}
    </Modal>
  )
}
