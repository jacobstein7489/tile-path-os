/* Projects — won work only (estimates live in Estimates). A plain table, one line per project:
 *   Project · Client · Where it stands · Next · Who · Start · Contract
 * No status column: the group it's under already says it. Red only for a problem. */
import * as React from 'react'
import { Plus, Wrench, CalendarClock, CircleCheckBig, Building2, HardHat, ClipboardList, Flag, Sparkles, PauseCircle, Layers, TriangleAlert, Check } from 'lucide-react'
import { useStore, addHist, newTask, NOW, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, DatePresets } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Group, EmptyState, Bubbles, STICKY_HEAD } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, fmtMoney, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { billingOf } from './job/money-tab'
import { stepsFor, isGettingReady, companySteps, type StepView } from './steps'
import { tracksFor, phaseOf, bookingOf, stepShort, type TrackView } from './tracks'
import { stepWords } from './steps-ui'
import { TODAY, md, isoFromLabel } from '@/tileos/lib/today'
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
  const startOf = (j: Job) => s.prep[j.id]?.targetISO || '9999'
  list.sort((a, b) => PROJ_TYPES.findIndex((t) => t.key === typeOf(a)) - PROJ_TYPES.findIndex((t) => t.key === typeOf(b)) || (typeOf(a) === 'coming' ? startOf(a).localeCompare(startOf(b)) : 0) || TONE_ORDER[a.status] - TONE_ORDER[b.status])
  const n = (k: ProjType) => won.filter((j) => typeOf(j) === k).length
  const pick = (k: View) => () => setView(view === k ? 'active' : k)
  const clients = Array.from(new Set(won.map((j) => j.clientId))).map((id) => ({ key: id, label: CUSTOMERS[id]?.name || won.find((j) => j.clientId === id)!.client }))
  const readyN = won.filter((j) => typeOf(j) === 'coming' && stepsFor(s, j).every((x) => ['done', 'na'].includes(x.state))).length
  return (
    <Page
      title="Projects"
      top={
        <Bubbles
          items={[
            { key: 'active', label: 'All open', count: won.filter((j) => typeOf(j) !== 'done').length, icon: <Layers />, color: 'indigo', on: view === 'active', onClick: () => setView('active') },
            { key: 'coming', label: 'Getting ready', count: n('coming'), sub: readyN ? `${readyN} ready` : undefined, icon: <ClipboardList />, color: 'violet', on: view === 'coming', onClick: pick('coming'), gapBefore: true },
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
          <span className="bar-title text-[0.9375rem] font-semibold text-ink">{VIEW_LABEL[view]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{list.length}</span></span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Filter icon={<Building2 />} label="Client" value={client} options={clients} onChange={setClient} width={280} />
            <Filter icon={<HardHat />} label="Installer" value={crew} options={CREWS.map((c) => ({ key: c, label: PEOPLE[c].name }))} onChange={setCrew} />
            <Filter icon={<Flag />} label="Status" value={att} allLabel="Any" options={[{ key: 'yes' as const, label: 'Needs attention' }]} onChange={(v) => setAtt(v as 'all' | 'yes')} />
            <ClearFilters show={client !== 'all' || crew !== 'all' || att !== 'all' || !!q} onClear={() => { setClient('all'); setCrew('all'); setAtt('all'); setQ('') }} />
            <ToolbarSearch value={q} onChange={setQ} placeholder="Search projects" />
          </div>
        </>
      }
    >
      <div>
        {!!list.length && <ListHead />}
        {view === 'active'
          ? PROJ_TYPES.filter((t) => t.key !== 'done').map((t) => {
              const rows = list.filter((j) => typeOf(j) === t.key)
              if (!rows.length) return null
              return (
                <section key={t.key}>
                  <Group label={t.label} count={rows.length} tone={TYPE_TONE[t.key]} />
                  {rows.map((j) => <ProjectRow key={j.id} j={j} crew={crewOf(j)} />)}
                </section>
              )
            })
          : list.map((j) => <ProjectRow key={j.id} j={j} crew={crewOf(j)} />)}
        {!list.length && <EmptyState icon={<Building2 />} title="No projects here" sub={view === 'repairs' ? 'Repair jobs and callbacks land here.' : 'Try another filter.'} action={view === 'repairs' && allowedFor(s.role, 'newrepair') ? <Button icon={<Wrench />} onClick={() => s.open({ t: 'newrepair' })}>New repair</Button> : undefined} />}
      </div>
    </Page>
  )
}

const TYPE_TONE: Record<ProjType, 'info' | 'ok' | 'warn' | 'vio' | 'neutral' | 'bad'> = { hold: 'bad', coming: 'vio', progress: 'ok', touchups: 'warn', repairs: 'vio', done: 'neutral' }

/* One line per project, in light lines like a table — a column for each thing, never two lines in a cell:
 *   Project · Client · Where it stands · Next · Who · Start · Contract
 * Where it stands: the five parts of getting ready as small circles and how many are done; installing, how far; touch-
 * ups, how many are open. Next: the one thing the project waits on — in red only when it's a problem. On a phone each
 * project is two short lines: its name and where it stands, then what's next and whose it is. */
const COLS = 'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_9rem_minmax(0,1.5fr)_9.5rem_5.75rem_7.5rem] max-xl:grid-cols-[minmax(0,1.3fr)_9rem_minmax(0,1.4fr)_9.5rem] max-md:block'
/** a cell: one line, its own column, a light line between the columns */
const CELL = 'flex min-w-0 items-center px-4 max-md:px-0'
const LINES = 'divide-x divide-line-2 max-md:divide-x-0'
const HEAD = 'flex h-9 min-w-0 items-center px-4'

function ListHead() {
  return (
    <div className={cn('border-y border-line-2 bg-wash text-[0.75rem] font-semibold text-muted', COLS, LINES, STICKY_HEAD, 'max-md:hidden')}>
      <span className={cn(HEAD, 'pl-5')}>Project</span>
      <span className={cn(HEAD, 'max-xl:hidden')}>Client</span>
      <span className={HEAD}>Where it stands</span>
      <span className={HEAD}>Next</span>
      <span className={HEAD}>Who</span>
      <span className={cn(HEAD, 'max-xl:hidden')}>Start</span>
      <span className={cn(HEAD, 'justify-end max-xl:hidden')}>Contract</span>
    </div>
  )
}

/** one part of getting ready, as a small circle: ✓ done · a ring that fills as its steps get done · ! a problem */
function PartDot({ t }: { t: TrackView }) {
  if (t.state === 'done') return <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#2c8a5b] text-white"><Check className="h-2 w-2" strokeWidth={4} /></span>
  if (t.state === 'bad') return <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#d7342a] text-[0.5rem] font-black text-white">!</span>
  const r = 5.2, c = 2 * Math.PI * r, f = t.total ? t.done / t.total : 0
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0 -rotate-90">
      <circle cx="7" cy="7" r={r} fill="#fff" stroke={t.state === 'wait' ? '#e9c98f' : '#ddd6cb'} strokeWidth="2" />
      {f > 0 && <circle cx="7" cy="7" r={r} fill="none" stroke="#2c8a5b" strokeWidth="2" strokeDasharray={`${c * f} ${c}`} strokeLinecap="round" />}
    </svg>
  )
}
/** a slim bar and a few words — installing and touch-ups */
function Bar({ pct, tone, label }: { pct: number; tone: 'ok' | 'warn'; label: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-wash-2"><span className={cn('block h-full rounded-full', tone === 'ok' ? 'bg-ok-500' : 'bg-warn-500')} style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} /></span>
      <span className="truncate text-[0.8125rem] font-medium tnum text-ink">{label}</span>
    </span>
  )
}

/** where it stands, in a few characters */
function StandsCell({ j }: { j: Job }) {
  const s = useStore()
  const t = typeOf(j)
  if (t === 'coming') {
    const tracks = tracksFor(s, j)
    const done = tracks.filter((x) => x.state === 'done').length
    const all = done === tracks.length
    return (
      <span className="flex min-w-0 items-center gap-2" data-mini-line aria-label={`Getting ready — ${done} of ${tracks.length} parts done`} title={all ? 'Every part is ready — book the crew' : `${done} of ${tracks.length} parts ready`}>
        <span className="flex shrink-0 items-center gap-[0.1875rem]">
          {tracks.map((x) => (
            <span key={x.key} data-mark={x.key} data-at={x.state} title={`${x.label} — ${x.state === 'done' ? 'done' : x.state === 'bad' ? 'a problem' : `${x.done} of ${x.total} done${x.state === 'wait' ? ' · waiting' : ''}`}`} className="inline-flex">
              <PartDot t={x} /><span className="sr-only" data-mark-name>{x.label}</span><span className="sr-only" data-mark-count>{x.done}/{x.total}</span>
            </span>
          ))}
        </span>
        <span className={cn('truncate text-[0.8125rem] font-medium tnum', all ? 'text-[#2c8a5b]' : 'text-ink-2')}>{all ? 'Ready' : `${done}/${tracks.length}`}</span>
      </span>
    )
  }
  if (t === 'hold') return <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-medium text-bad-600"><PauseCircle className="h-4 w-4 shrink-0" /><span className="truncate">On hold</span></span>
  if (t === 'progress') return <Bar pct={j.pct ?? 0} tone="ok" label={`${j.pct ?? 0}%`} />
  if (t === 'touchups' || t === 'repairs') {
    const all = s.punch.filter((p) => p.jobId === j.id)
    const open = all.filter((p) => p.status !== 'verified')
    if (t === 'repairs' && !all.length) return <span className="truncate text-[0.8125rem] font-medium text-ink-2">Repair</span>
    return <Bar pct={all.length ? ((all.length - open.length) / all.length) * 100 : 100} tone="warn" label={open.length ? `${open.length} open` : 'All checked'} />
  }
  const b = billingOf(j)
  return <span className="truncate text-[0.8125rem] text-muted">{b.billedPct >= 100 ? 'Billed' : `${b.billedPct || 0}% billed`}</span>
}

/** what the project waits on now, and whose it is — while getting ready the most pressing open step (a problem first,
 *  then what's late, then what's due first); once the crew is on it, the installer */
function nextOf(s: Store, j: Job, crew?: PersonKey): { what: string; who?: PersonKey; bad?: boolean; title?: string } {
  const t = typeOf(j)
  if (t === 'coming') {
    /* every part ready: the crew is next (the deposit is a warning, not a stop) */
    const tracks = tracksFor(s, j)
    if (tracks.every((x) => x.state === 'done')) return { what: bookingOf(s, j) ? 'Crew booked' : 'Book the crew' }
    const inPart = new Set(tracks.flatMap((x) => x.steps.map((v) => v.key)))
    const open = stepsFor(s, j).filter((v) => inPart.has(v.key) && (v.state === 'now' || v.state === 'bad' || v.state === 'wait'))
    const rank = (v: StepView) => (v.state === 'bad' ? 0 : v.state === 'now' && v.due && v.due < TODAY ? 1 : v.state === 'now' ? 2 : 3)
    const v = [...open].sort((a, b) => rank(a) - rank(b) || (a.due || '9999').localeCompare(b.due || '9999'))[0]
    if (!v) return { what: phaseOf(s, j) === 'crew' ? 'Book the crew' : '—' }
    /* a problem says what it is — "No water on site", not just the step */
    const what = v.state === 'bad' && v.note ? v.note.split(' · ')[0].replace(/^No — /, '') : stepShort(s, j, v)
    return { what, who: v.owner, bad: v.state === 'bad', title: v.note }
  }
  if (t === 'progress') return { what: 'Installing', who: crew }
  if (t === 'touchups' || t === 'repairs') {
    const booking = s.bookings.find((b) => b.jobId === j.id && b.end >= TODAY)
    return booking ? { what: `Back ${md(booking.start)}`, who: booking.crew as PersonKey } : { what: 'Book the return visit' }
  }
  if (t === 'hold') return { what: j.hold?.shortage ? 'Waiting for the tile' : j.hold?.reason || 'On hold', bad: true }
  return { what: '—' }
}

function WhoCell({ who }: { who?: PersonKey }) {
  const s = useStore()
  const me = meOf(s.role)
  if (!who || !PEOPLE[who]) return <span className="text-[0.8125rem] text-faint">—</span>
  return (
    <span className="flex min-w-0 items-center gap-2" data-who>
      <Avatar who={who} size={22} />
      <span className={cn('truncate text-[0.8125rem]', who === me ? 'font-semibold text-ink' : 'font-medium text-ink-2')}>{who === me ? 'You' : PEOPLE[who]?.short || PEOPLE[who]?.name}</span>
    </span>
  )
}

/** the day the crew starts (amber once it's passed and they haven't) — or the day they started */
function startOf(s: Store, j: Job): { text: string; late?: boolean } {
  if (typeOf(j) === 'coming') {
    const b = bookingOf(s, j)
    if (b) return { text: md(b.start) }
    const iso = s.prep[j.id]?.targetISO
    return iso ? { text: md(iso), late: iso < TODAY } : { text: '—' }
  }
  const b = bookingOf(s, j)
  return { text: j.dates?.start || (b ? md(b.start) : s.prep[j.id]?.started || '—') }
}

function ProjectRow({ j, crew }: { j: Job; crew?: PersonKey }) {
  const s = useStore()
  const n = nextOf(s, j, crew)
  const st = startOf(s, j)
  const b = billingOf(j)
  const contract = (b.contract || j.contract || 0) + (b.changes || 0)
  const nextCell = <span title={n.title} className={cn('flex min-w-0 items-center gap-1.5 text-[0.84375rem]', n.bad ? 'font-semibold text-bad-600' : 'text-ink')}>{n.bad && <TriangleAlert className="h-3.5 w-3.5 shrink-0" />}<span className="truncate">{n.what}</span></span>
  return (
    <div
      role="button"
      tabIndex={0}
      data-project={j.id}
      onClick={() => s.open({ t: 'job', id: j.id })}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) s.open({ t: 'job', id: j.id }) }}
      className={cn('min-h-[2.875rem] cursor-pointer border-b border-line-2 transition-colors hover:bg-[#f7f5f0] max-md:px-4 max-md:py-2.5', COLS, LINES)}
    >
      {/* a computer: a column for each */}
      <div className={cn(CELL, 'pl-5 max-md:hidden')}><span className="truncate text-[0.90625rem] font-semibold text-ink">{j.name}</span>{j.kind === 'repair' && <span className="ml-2 shrink-0 text-[0.75rem] font-semibold text-[#b83a5e]">Repair</span>}</div>
      <div className={cn(CELL, 'max-xl:hidden')}><span className="truncate text-[0.8125rem] text-muted">{j.client}</span></div>
      <div className={cn(CELL, 'max-md:hidden')}><StandsCell j={j} /></div>
      <div className={cn(CELL, 'max-md:hidden')}>{nextCell}</div>
      <div className={cn(CELL, 'max-md:hidden')}><WhoCell who={n.who} /></div>
      <div className={cn(CELL, 'max-xl:hidden')}><span className={cn('truncate text-[0.8125rem] tnum', st.late ? 'font-medium text-warn-700' : 'text-ink-2')} title={st.late ? 'The start date passed' : undefined}>{st.text}</span></div>
      <div className={cn(CELL, 'justify-end max-xl:hidden')}><span className={cn('text-[0.84375rem] font-semibold tnum', contract ? 'text-ink' : 'font-normal text-faint')}>{contract ? fmtMoney(contract) : '—'}</span></div>
      {/* a phone: two short lines */}
      <div className="hidden min-w-0 max-md:block">
        <div className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{j.name}</span>
          <span className="shrink-0"><StandsCell j={j} /></span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1">{nextCell}</span>
          {n.who && PEOPLE[n.who] && <span className="shrink-0"><WhoCell who={n.who} /></span>}
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
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
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
export function NewProjectModal({ level }: { level: number }) {
  const s = useStore()
  const [at, setAt] = React.useState<At>('new')
  const [clientId, setClientId] = React.useState('')
  const [name, setName] = React.useState('')
  const [address, setAddress] = React.useState('')
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
      header={<FormHead k="newproject" kicker="Won already — to price one, use Estimates" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <Button variant="ghost" onClick={s.close}>Cancel</Button>
          <Button className="ml-auto" variant="primary" disabled={!clientId || !finalName} onClick={create}>Create project</Button>
        </>
      }
    >
      <FormRow label="Client">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><SearchSelect label="Client" value={clientId} onChange={setClientId} placeholder="Type a client" options={Object.values(CUSTOMERS).filter((c) => !isOff(s, 'client', c.id)).map((c) => ({ key: c.id, label: c.name, hint: c.kind }))} search /></div>
          <Button onClick={() => s.open({ t: 'newclient' })} icon={<Plus />}>New</Button>
        </div>
      </FormRow>
      <FormRow label="Address">
        <TextInput aria-label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 42 Orchard St, Brooklyn" />
      </FormRow>
      <FormRow label="Where it’s at" hint={AT_OPTIONS.find((x) => x.key === at)!.hint}>
        <SearchSelect label="Where it’s at" value={at} onChange={(k) => setAt((k || 'new') as At)} search={false} options={AT_OPTIONS.map((x) => ({ key: x.key, label: x.label }))} plain />
      </FormRow>
      {!more && (
        <button onClick={() => setMore(true)} className="mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-2 hover:text-ink">
          <Plus className="h-4 w-4" />A different name, the contract, when we start
        </button>
      )}
      {more && <>
        <FormRow label="Name" hint="It goes by the street if you leave it">
          <TextInput aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder={address.split(',')[0].trim() || 'e.g. Green Tree'} />
        </FormRow>
        <FormRow label="Contract" hint="The deposit invoice is made from it">
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
