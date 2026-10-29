/* Projects — won work only (estimates live in Estimates). A plain table, one line per project:
 *   Project · Client · Where it stands · Next · Who · Start · Contract
 * No status column: the group it's under already says it. Red only for a problem. */
import * as React from 'react'
import { Plus, Wrench, CalendarClock, CircleCheckBig, Building2, HardHat, ClipboardList, Flag, Sparkles, PauseCircle, Layers, TriangleAlert, Check } from 'lucide-react'
import { useStore, addHist, newTask, NOW, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, DatePresets } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Group, EmptyState, Bubbles, STICKY_HEAD, HEAD_ROW, Link } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, fmtMoney, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { billingOf } from './job/money-tab'
import { stepsFor, companySteps } from './steps'
import { tracksFor, bookingOf, problemsOf, readyPctOf, gateOpen, leadWords, stepShort, TRACKS, type TrackView } from './tracks'
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
  const startOf = (j: Job) => s.prep[j.id]?.targetISO || '9999'
  list.sort((a, b) => PROJ_TYPES.findIndex((t) => t.key === typeOf(a)) - PROJ_TYPES.findIndex((t) => t.key === typeOf(b)) || (typeOf(a) === 'coming' ? startOf(a).localeCompare(startOf(b)) : 0) || TONE_ORDER[a.status] - TONE_ORDER[b.status])
  const n = (k: ProjType) => won.filter((j) => typeOf(j) === k).length
  const pick = (k: View) => () => setView(view === k ? 'active' : k)
  const clients = Array.from(new Set(won.map((j) => j.clientId))).map((id) => ({ key: id, label: CUSTOMERS[id]?.name || won.find((j) => j.clientId === id)!.client }))
  return (
    <Page
      title="Projects"
      top={
        <Bubbles
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

/* One line per project, five columns that line up top to bottom and share the width:
 *   Project · Client · Design Tile Site Installer Materials · Now · Start
 * The five parts of getting ready, as circles on one line, for every project — the same five, in the same place, under
 * their names on top. Like a parcel's tracking line: the line between them is green as far as getting ready has got
 * (its steps done, of all of them) and moves along as the work does; each circle says its part — ✓ done, a ring that
 * fills, ! a problem.
 * Now: always something — the step that's up (yours in blue), the crew's days, how far the installing is, the touch-ups
 * left, why it's on hold. Problems are counted on the right of it ("2 problems"), never squeezed into the words: point
 * at the count for the list, open the project for all of them.
 * Each group (On hold, Getting ready…) is a gray band with its color dot. On a phone: the name and how far it is, then
 * what's going on now. */
const COLS = 'grid grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_17.5rem_minmax(0,1.1fr)_5rem] items-center gap-x-6 max-xl:grid-cols-[minmax(0,1fr)_17.5rem_minmax(0,1.1fr)_5rem] max-md:block'
/** each circle's place — the five the same width, so the circles are evenly spaced, each one right under its name
 *  (the widest name, Materials, fits), the same on top and in every row */
const slot = (_k?: string) => 'flex w-[3.5rem] shrink-0 justify-center'

function ListHead() {
  return (
    <div className={cn(HEAD_ROW, 'px-5', COLS, STICKY_HEAD, 'max-md:hidden')} data-list-head>
      <span>Project</span>
      <span className="max-xl:hidden">Client</span>
      <span className="flex min-w-0 items-center" data-part-names title="Where it stands — the five parts of getting ready">
        {TRACKS.map((t) => <span key={t.key} className={cn(slot(t.key), 'whitespace-nowrap text-[0.6875rem]')}>{t.label}</span>)}
      </span>
      <span>Now</span>
      <span className="text-right">Start</span>
    </div>
  )
}

/** one part of getting ready, as a small circle: ✓ done · a ring that fills as its steps get done · ! a problem */
function PartDot({ t }: { t?: TrackView }) {
  /* a part this project doesn't have */
  if (!t) return <span className="inline-flex h-4 w-4 rounded-full border-2 border-dashed border-[#ddd6cb] bg-white" />
  if (t.state === 'done') return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2c8a5b] text-white"><Check className="h-2.5 w-2.5" strokeWidth={4} /></span>
  if (t.state === 'bad') return <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#d7342a] text-[0.5625rem] font-black text-white">!</span>
  const r = 6, c = 2 * Math.PI * r, f = t.total ? t.done / t.total : 0
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 -rotate-90">
      <circle cx="8" cy="8" r={r} fill="#fff" stroke={t.state === 'wait' ? '#e9c98f' : '#ddd6cb'} strokeWidth="2.25" />
      {f > 0 && <circle cx="8" cy="8" r={r} fill="none" stroke="#2c8a5b" strokeWidth="2.25" strokeDasharray={`${c * f} ${c}`} strokeLinecap="round" />}
    </svg>
  )
}
const partWords = (x: TrackView) => `${x.label} — ${x.state === 'done' ? 'done' : x.state === 'bad' ? 'a problem' : `${x.done} of ${x.total} done${x.state === 'wait' ? ' · waiting' : ''}`}`

/** where it stands: the five parts on one tracking line — the same for every project */
function StandsCell({ j, words }: { j: Job; /** a phone: in words, no circles */ words?: boolean }) {
  const s = useStore()
  const tracks = tracksFor(s, j).filter((x) => x.key !== 'other')
  const pct = readyPctOf(tracks)
  const done = tracks.filter((x) => x.state === 'done').length
  const all = !!tracks.length && done === tracks.length
  if (words) {
    const t = typeOf(j)
    const w = t === 'progress' ? `${j.pct ?? 0}% in` : all ? (t === 'coming' ? 'Ready' : '') : `${done} of ${tracks.length} ready`
    return w ? <span className={cn('truncate text-[0.8125rem] tnum', all ? 'font-medium text-[#2c8a5b]' : 'text-ink-2')} data-mini-line>{w}</span> : null
  }
  return (
    <span className="relative flex shrink-0 items-center" data-mini-line data-ready-pct={pct} aria-label={`Getting ready — ${done} of ${tracks.length} parts done, ${pct}% of the steps`}>
      {/* the line, from the first circle's middle to the last one's — green as far as it's got */}
      <Link pct={pct} className="absolute h-[0.1875rem]" style={{ left: '1.75rem', right: '1.75rem', top: 'calc(50% - 0.09375rem)' }} />
      {TRACKS.map((tk) => {
        const x = tracks.find((y) => y.key === tk.key)
        return (
          <span key={tk.key} data-mark={tk.key} data-at={x?.state || 'none'} title={x ? partWords(x) : `${tk.label} — not on this project`} className={cn(slot(tk.key), 'relative z-[1]')}>
            <PartDot t={x} /><span className="sr-only" data-mark-name>{tk.label}</span>{x && <span className="sr-only" data-mark-count>{x.done}/{x.total}</span>}
          </span>
        )
      })}
    </span>
  )
}

/** the day the crew starts (amber once it's passed and they haven't) — or the day they started */
function startOf(s: Store, j: Job): { text: string; late?: boolean } {
  if (typeOf(j) === 'coming') {
    const b = bookingOf(s, j)
    if (b) return { text: md(b.start) }
    const iso = s.prep[j.id]?.targetISO
    return iso ? { text: md(iso), late: iso < TODAY } : { text: '' }
  }
  const b = bookingOf(s, j)
  return { text: j.dates?.start || (b ? md(b.start) : s.prep[j.id]?.started || '') }
}

/** what's going on with a project now, in a few words — always something */
export type NowWords = { text: string; who?: string; when?: string; late?: boolean; tone?: 'mine' | 'wait' | 'quiet' }
export function nowOf(s: Store, j: Job): NowWords {
  const t = typeOf(j)
  const me = meOf(s.role)
  const b = bookingOf(s, j)
  const crew = (b?.crew || j.crew || installerOf(s, j)) as PersonKey | undefined
  const name = (p?: PersonKey) => (!p ? undefined : p === me ? 'You' : PEOPLE[p]?.short || undefined)
  const day = (iso: string) => (iso === TODAY ? 'today' : iso < TODAY ? `was due ${md(iso)}` : labelFromIso(iso) === 'Tomorrow' ? 'tomorrow' : `by ${labelFromIso(iso)}`)
  if (t === 'hold') return { text: j.hold?.shortage ? 'On hold — waiting for the tile' : j.hold?.reason ? `On hold — ${j.hold.reason.replace(/^./, (c) => c.toLowerCase())}` : 'On hold', tone: 'wait' }
  if (t === 'progress') return { text: `Installing · ${j.pct ?? 0}% done`, who: name(crew) }
  if (t === 'touchups' || t === 'repairs') {
    const all = s.punch.filter((p) => p.jobId === j.id)
    const open = all.filter((p) => p.status !== 'verified').length
    if (t === 'repairs' && !all.length) return { text: 'Repair', who: name(crew) }
    return { text: open ? `Touch-ups · ${open} to fix` : 'Touch-ups · all checked', who: name(crew) }
  }
  if (t === 'done') { const bl = billingOf(j); return { text: bl.billedPct >= 100 ? 'Finished · billed' : `Finished · ${bl.billedPct || 0}% billed`, tone: 'quiet' } }
  /* getting ready: the step that's up — yours first, then the first one someone has to do (in the job's order), then
     what it waits on */
  const tracks = tracksFor(s, j)
  if (gateOpen(tracks)) return b ? { text: `Crew booked · starts ${md(b.start)}`, who: name(b.crew as PersonKey) } : { text: 'Ready — book the crew', tone: 'mine' }
  const open = tracks.filter((x) => x.state !== 'done' && x.lead)
  const leads = open.map((x) => x.lead!)
  const v = leads.find((x) => x.state === 'now' && x.owner === me) || leads.find((x) => x.state === 'now') || leads.find((x) => x.state === 'wait') || leads.find((x) => x.state === 'later') || leads[0]
  if (!v) return { text: 'Getting ready' }
  const step = stepShort(s, j, v)
  if (v.state === 'wait') {
    const w = leadWords(s, j, open.find((x) => x.lead === v)!)
    return { text: `${step} · ${w.top.replace(/^./, (c) => c.toLowerCase())}`, tone: 'wait' }
  }
  if (v.state === 'later') return { text: step, who: name(v.owner), tone: 'quiet' }
  const mine = v.owner === me
  return { text: mine ? `${step} · your turn` : step, who: mine ? undefined : name(v.owner), when: v.due ? day(v.due) : undefined, late: !!v.due && v.due < TODAY, tone: mine ? 'mine' : undefined }
}

/** the problems on a project, counted — the list on hover, all of them on the project */
function Problems({ list, small }: { list: { text: string }[]; small?: boolean }) {
  if (!list.length) return null
  const words = `${list.length} ${list.length === 1 ? 'problem' : 'problems'}`
  return (
    <span data-problems={list.length} title={`${words}:\n${list.map((p) => `• ${p.text}`).join('\n')}`} aria-label={`${words}: ${list.map((p) => p.text).join('; ')}`} className={cn('inline-flex shrink-0 items-center gap-1 rounded-full bg-bad-50 font-semibold tnum text-bad-700', small ? 'h-5 px-1.5 text-[0.71875rem]' : 'h-[1.375rem] pl-1.5 pr-2 text-[0.75rem]')}>
      <TriangleAlert className="h-3 w-3" />{words}
    </span>
  )
}
function NowLine({ w }: { w: NowWords }) {
  return (
    <span data-now-text className={cn('min-w-0 truncate text-[0.8125rem]', w.tone === 'mine' ? 'font-medium text-brand-700' : w.tone === 'quiet' ? 'text-muted' : w.tone === 'wait' ? 'text-warn-700' : 'text-ink-2')}>
      {w.text}{w.who && <span className="text-muted"> · {w.who}</span>}{w.when && <span className={w.late ? 'font-medium text-bad-600' : 'text-muted'}> · {w.when}</span>}
    </span>
  )
}

function ProjectRow({ j }: { j: Job; crew?: PersonKey }) {
  const s = useStore()
  const st = startOf(s, j)
  const probs = problemsOf(s, j)
  const now = nowOf(s, j)
  const open = () => s.open({ t: 'job', id: j.id })
  return (
    <div
      role="button"
      tabIndex={0}
      data-project={j.id}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) open() }}
      className={cn('min-h-[2.75rem] cursor-pointer border-t border-line-2 py-2 pl-5 pr-5 transition-colors row-hover max-md:px-4 max-md:py-2.5', COLS)}
    >
      {/* a computer: five things on one line, each in its column */}
      <div className="flex min-w-0 items-center gap-2 max-md:hidden">
        <span className="truncate text-[0.875rem] font-semibold text-ink">{j.name}</span>
        {j.kind === 'repair' && <span className="shrink-0 text-[0.75rem] text-muted">Repair</span>}
      </div>
      <span className="min-w-0 truncate text-[0.8125rem] text-muted max-xl:hidden">{j.client}</span>
      <div className="min-w-0 max-md:hidden"><StandsCell j={j} /></div>
      <div className="flex min-w-0 items-center gap-2 max-md:hidden" data-now><span className="flex min-w-0 flex-1"><NowLine w={now} /></span><Problems list={probs} /></div>
      <span className={cn('truncate text-right text-[0.8125rem] tnum max-md:hidden', st.late ? 'font-medium text-warn-700' : 'text-muted')} title={st.late ? 'The start date passed' : undefined}>{st.text}</span>
      {/* a phone: the name and how far it is; under it what's going on now, and the problems counted */}
      <div className="hidden min-w-0 max-md:block">
        <div className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{j.name}</span>
          <span className="shrink-0"><StandsCell j={j} words /></span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2" data-now>
          <span className="flex min-w-0 flex-1"><NowLine w={now} /></span>
          <Problems list={probs} small />
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
