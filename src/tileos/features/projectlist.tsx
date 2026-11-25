/* Projects — won work only (estimates live in Estimates). A plain list, one line per project:
 *   Project · Client · Where it stands · When
 * Where it stands is how far along the part it's in is — never one thing out of many, never whose turn (it's often a
 * few things, and a few people). Its problems are counted next to it, in red — red only for a problem. */
import * as React from 'react'
import { Plus, Wrench, CircleCheckBig, Building2, HardHat, ClipboardList, Sparkles, PauseCircle, Layers } from 'lucide-react'
import { useStore, addHist, newTask, NOW, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip, Segmented } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Group, EmptyState, Bubbles, STICKY_HEAD, HEAD_ROW, ROW_H, BAND, BAND_LABEL, GROUP_STICKY, BandCount } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, fmtMoney, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { billingOf } from './job/money-tab'
import { stepsFor, companySteps, IN_FIELD_STAGES } from './steps'
import { pictureOf } from './progressbill'
import { tracksFor, bookingOf, problemsOf, gateOpen, leadWords } from './tracks'
import { stepWords } from './job/whatsleft'
import { NewProjectKind } from './estnew'
import { installerOf } from './upcoming'
import { TODAY, md, isoFromLabel, labelFromIso, daysBetween } from '@/tileos/lib/today'
import { useSort, sortRows, SortHead, SortMenu, type Sort, type SortCol } from '@/tileos/components/ui/sort'
import { SearchSelect, MultiSelect } from '@/tileos/components/ui/select'
import { TODO } from './stepwin'
import { isOff } from './active'
import { allowedFor } from './newpicker'
import { touchupsWords } from './todokinds'
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
  const rank = (j: Job) => (problemsOf(s, j).length ? 0 : 1)
  const startOf = (j: Job) => bookingOf(s, j)?.start || s.prep[j.id]?.targetISO || '9999'
  list.sort((a, b) => PROJ_TYPES.findIndex((t) => t.key === typeOf(a)) - PROJ_TYPES.findIndex((t) => t.key === typeOf(b)) || rank(a) - rank(b) || (typeOf(a) === 'coming' ? startOf(a).localeCompare(startOf(b)) : 0) || TONE_ORDER[a.status] - TONE_ORDER[b.status])
  /* sorted by a column (tap its name; a phone: Sort) — inside each group */
  const sorter = useSort('projects')
  const shown = sortRows(list, sorter.sort, { name: (j) => j.name, client: (j) => j.client, stands: (j) => standOf(s, j).text, date: (j) => dateKeyOf(s, j) })
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
          soft
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
            <SortMenu sort={sorter.sort} set={sorter.set} cols={PROJECT_SORT} className="ml-auto md:hidden" />
          </div>
        </>
      }
    >
      <div style={{ '--list': listCols(when, false), '--list-xl': listCols(when, true) } as React.CSSProperties} data-even-list>
        {!!list.length && <ListHead when={when} sort={sorter.sort} onSort={sorter.toggle} />}
        {view === 'active'
          ? PROJ_TYPES.filter((t) => t.key !== 'done').map((t) => {
              const rows = shown.filter((j) => typeOf(j) === t.key)
              if (!rows.length) return null
              return (
                <section key={t.key} data-project-group={t.key}>
                  <GroupHead k={t.key} label={t.label} n={rows.length} />
                  {rows.map((j) => <ProjectRow key={j.id} j={j} when={when} />)}
                </section>
              )
            })
          : shown.map((j) => <ProjectRow key={j.id} j={j} when={when} />)}
        {!list.length && <EmptyState icon={<Building2 />} title="No projects here" sub={view === 'repairs' ? 'Repair jobs and callbacks land here.' : 'Try another filter.'} action={view === 'repairs' && allowedFor(s.role, 'newrepair') ? <Button icon={<Wrench />} onClick={() => s.open({ t: 'newrepair' })}>New repair</Button> : undefined} />}
      </div>
    </Page>
  )
}

/** each group's tone — kept on the band as data (the bubble on top has the color; the band itself is plain) */
const TYPE_TONE: Record<ProjType, 'info' | 'ok' | 'warn' | 'vio' | 'neutral' | 'bad'> = { hold: 'bad', coming: 'vio', progress: 'ok', touchups: 'warn', repairs: 'vio', done: 'neutral' }
/** All open: each group's name in the same plain band as Estimates' and Today's — light gray, small capitals, how many
 *  (the colors and marks are on the boxes on top, not again on the bands) — and it stays on top while its projects
 *  scroll by (under the column names on a computer), so you always see which group you're in */
function GroupHead({ k, label, n }: { k: ProjType; label: string; n: number }) {
  return (
    <div className={cn(BAND, 'px-5 max-sm:px-4', GROUP_STICKY)} data-band data-group-tone={TYPE_TONE[k]} data-group-head={k}>
      <span className={BAND_LABEL}>{label}</span>
      <BandCount n={n} />
    </div>
  )
}

/* One line per project — the same as Estimates: the project's name, the client (gray), where it stands, and the date:
 *   Project · (Client, on a wide screen) · Where it stands · Date
 * Where it stands says how far along it is — "5 of 7 done", "Ready — pick the crew's days", "51% installed", "3 to
 * fix · 1 to check" — and how many problems it has, in red. The date is the day it starts, or the day it's to be done.
 * One color means something — red, a problem. On a phone: the name and the date, where it stands under it. */
const COLS = 'grid items-center gap-x-6 max-md:block'
/** the columns: the names and where it stands share the width; the date is as wide as it needs. A long one is cut
 *  short, so nothing runs into the next column. Date is a column only when a project on the list has one */
const listCols = (when: boolean, xl: boolean) => [xl ? 'minmax(0,0.9fr) minmax(0,1fr)' : 'minmax(0,1fr)', 'minmax(0,1.5fr)', when ? 'max-content' : ''].filter(Boolean).join(' ')

/** the columns a project list sorts by */
const PROJECT_SORT: SortCol[] = [{ k: 'name', label: 'Project' }, { k: 'client', label: 'Client' }, { k: 'stands', label: 'Where it stands' }, { k: 'date', label: 'Date', kind: 'date' }]
/** its date, to sort by: the day it starts — or ends, or the installer is back */
function dateKeyOf(s: Store, j: Job): string {
  const t = typeOf(j)
  const b = bookingOf(s, j)
  if (t === 'coming') return b?.start || s.prep[j.id]?.targetISO || ''
  if (t === 'progress') return b?.end || isoFromLabel(j.dates?.finish || '') || ''
  if (t === 'touchups' || t === 'repairs') return s.bookings.filter((x) => x.jobId === j.id && x.end >= TODAY).sort((a, c) => a.start.localeCompare(c.start))[0]?.start || ''
  return ''
}
function ListHead({ when, sort, onSort }: { when: boolean; sort: Sort; onSort: (k: string) => void }) {
  return (
    <div className={cn(HEAD_ROW, 'px-5', COLS, STICKY_HEAD, 'max-md:hidden')} data-list-head data-subrow>
      <span><SortHead k="name" sort={sort} onSort={onSort}>Project</SortHead></span>
      <span className="max-xl:hidden"><SortHead k="client" sort={sort} onSort={onSort}>Client</SortHead></span>
      <span><SortHead k="stands" sort={sort} onSort={onSort}>Where it stands</SortHead></span>
      {when && <span className="text-right" data-when-head><SortHead k="date" sort={sort} onSort={onSort} right kind="date">Date</SortHead></span>}
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
    /* none logged yet: what's holding it — its first open to-do ("Walk the job with Charlie · Today") */
    if (!all.length) return { pct: 0, text: j.kind === 'repair' ? 'Repair' : holdingTouchups(s, j) || 'No touch-ups yet' }
    /* the same count as its line in To do: done is fixed (checked or waiting to be checked) */
    const done = all.filter((p) => p.status === 'verify' || p.status === 'verified').length
    const checked = all.filter((p) => p.status === 'verified').length
    return { pct: Math.round((done / all.length) * 100), text: touchupsWords(all, true), tone: checked === all.length ? 'ok' : undefined }
  }
  const pic = pictureOf(s, j.id)
  return pic.paidPct >= 100 ? { pct: 100, text: 'Paid in full', tone: 'ok' } : { pct: pic.paidPct, text: `${pic.billedPct}% billed · ${pic.paidPct}% paid` }
}

/** a project in touch-ups with none logged yet: what's holding it — its first open to-do, and when ("Walk the job with
 *  Charlie · Today"); nothing open: nothing */
export function holdingTouchups(s: Store, j: Job): string {
  const t = s.tasks
    .filter((t) => t.jobId === j.id && t.state !== 'done' && !t.repeat && !t.paused)
    .map((t) => ({ t, iso: isoFromLabel(t.due || t.followUp || '') || '9999' }))
    .sort((a, b) => (a.t.tone === 'bad' ? 0 : 1) - (b.t.tone === 'bad' ? 0 : 1) || a.iso.localeCompare(b.iso))[0]
  if (!t) return ''
  const late = t.iso < TODAY ? daysBetween(t.iso, TODAY) : 0
  const when = t.iso === '9999' ? '' : late ? `${late} ${late === 1 ? 'day' : 'days'} late` : t.iso === TODAY ? 'Today' : labelFromIso(t.iso)
  return `${t.t.title.replace(/\.$/, '')}${when ? ` · ${when}` : ''}`
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

/** where a project stands, in a few words — how far along the part it's in is: never one thing out of many, never
 *  whose turn (it's often a few people's). Its problems are counted next to it, in red */
export function standOf(s: Store, j: Job): { text: string; quiet?: boolean } {
  const t = typeOf(j)
  const b = bookingOf(s, j)
  const crew = (b?.crew || j.crew || installerOf(s, j)) as PersonKey | undefined
  const who = crew ? ` · ${PEOPLE[crew]?.short || crew}` : ''
  const cap = (x: string) => x.replace(/^./, (c) => c.toUpperCase())
  if (t === 'hold') return { text: `${j.hold?.shortage ? 'Waiting for the tile' : j.hold?.reason ? cap(j.hold.reason) : 'On hold'}${j.hold?.until ? ` · until ${j.hold.until}` : ''}`, quiet: true }
  if (t === 'progress') return { text: `${j.pct ?? 0}% installed${who}` }
  if (t === 'touchups' || t === 'repairs') return { text: s.punch.some((p) => p.jobId === j.id) ? cap(howFar(s, j).text) : t === 'repairs' ? j.scope || 'Repair' : holdingTouchups(s, j) || 'No touch-ups yet' }
  if (t === 'done') { const bl = billingOf(j); return bl.paidPct >= 100 ? { text: 'Paid in full', quiet: true } : bl.billedPct >= 100 ? { text: 'Waiting to be paid', quiet: true } : { text: 'Bill the rest' } }
  /* getting ready: how many of its parts are done (the same count as on the project) — then the crew */
  const tracks = tracksFor(s, j)
  if (gateOpen(tracks)) return b ? { text: `Crew booked${who}` } : { text: 'Ready. Pick the crew’s days' }
  return { text: `${tracks.filter((x) => x.state === 'done').length} of ${tracks.length} done` }
}
/** what a project is waiting on, in a few words each — its to-dos marked waiting (on the GC, an inspector, another
 *  trade): "stone install", "waterproofing inspection". Never its ordinary to-dos. Only once it's being installed (or
 *  in touch-ups), where "80% installed" alone doesn't say it; getting ready says it with its steps, on hold with why */
export function waitingOn(s: Store, j: Job): string[] {
  if (!['installation', 'punch'].includes(j.stage) || j.hold) return []
  return s.tasks
    /* a problem is counted in red already — not said again here. What comes back first, first */
    .filter((t) => t.jobId === j.id && t.state === 'waiting' && t.tone !== 'bad')
    .sort((a, b) => (isoFromLabel(a.followUp || '') || '9999').localeCompare(isoFromLabel(b.followUp || '') || '9999'))
    .map((t) => {
      const what = t.title.replace(/\s*[·,-]?\s*waiting (on|for)\b.*$/i, '').replace(/^waiting (on|for)( the gc)?(:|\s·)?\s*/i, '').replace(/\.$/, '').trim()
      const low = /^[A-Z][a-z]/.test(what) ? what.charAt(0).toLowerCase() + what.slice(1) : what
      /* the GC: said as who it's on ("the GC for CO-004") */
      return /\bgc\b/i.test(t.waitingOn || '') || /\bthe gc\b/i.test(t.title) ? (low ? `the GC for ${low}` : 'the GC') : low
    })
    .filter(Boolean)
}
/** a project's problems, counted — "1 problem", "3 problems" */
const probWords = (n: number) => `${n} ${n === 1 ? 'problem' : 'problems'}`

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
  if (t === 'hold') return { text: `${j.hold?.shortage ? 'Waiting for the tile' : j.hold?.reason ? cap(j.hold.reason) : 'On hold'}${j.hold?.until ? ` · until ${j.hold.until}` : ''}`, tone: 'quiet' }
  if (t === 'progress') return crew ? { text: `${j.pct ?? 0}% installed`, who: crew } : { text: 'No installer on it' }
  if (t === 'touchups') return crew ? { text: cap(howFar(s, j).text), who: crew } : { text: 'Pick who fixes them' }
  if (t === 'repairs') return crew ? { text: s.punch.some((p) => p.jobId === j.id) ? cap(howFar(s, j).text) : j.scope || 'Repair', who: crew } : { text: 'Pick a crew' }
  if (t === 'done') { const bl = billingOf(j); return bl.paidPct >= 100 ? { text: 'Paid and closed', tone: 'quiet' } : bl.billedPct >= 100 ? { text: 'Waiting to be paid', tone: 'quiet' } : { text: 'Bill the rest' } }
  /* getting ready: the step that's up — yours first, then the first one someone has to do (in the job's order), then
     what it waits on */
  const tracks = tracksFor(s, j, steps)
  if (gateOpen(tracks)) return b ? { text: 'Crew booked', who: b.crew as PersonKey } : { text: 'Ready. Book the crew', who: steps.find((v) => v.key === 'installer')?.owner }
  const open = tracks.filter((x) => x.state !== 'done' && x.lead)
  const leads = open.map((x) => x.lead!)
  const v = leads.find((x) => x.state === 'now' && x.owner === me) || leads.find((x) => x.state === 'now') || leads.find((x) => x.state === 'wait') || leads.find((x) => x.state === 'later') || leads[0]
  if (!v) return { text: 'Getting ready', tone: 'quiet' }
  const step = stepWords(s, j, v)
  if (v.state === 'wait') return { text: `${step} · ${leadWords(s, j, open.find((x) => x.lead === v)!).top.replace(/^./, (c) => c.toLowerCase())}`, who: v.owner, tone: 'quiet' }
  if (v.state === 'later') return { text: step, who: v.owner, tone: 'quiet' }
  return { text: step, who: v.owner }
}

function ProjectRow({ j, when: hasWhen }: { j: Job; when: boolean }) {
  const s = useStore()
  const probs = problemsOf(s, j)
  const st = standOf(s, j)
  const w = whenOf(s, j)
  const open = () => s.open({ t: 'job', id: j.id })
  const date = (cls: string, text: string) => <span className={cn(cls, 'whitespace-nowrap tnum', w.late ? 'font-medium text-warn-700' : 'text-muted')} title={w.late ? 'The start date passed' : undefined} data-when>{text}</span>
  /* where it stands, and its problems counted in red (pointing at it lists them) — and, under it in amber, what it's
     waiting on (two at most, then how many more) */
  const waits = waitingOn(s, j)
  const stand = (cls: string) => (
    <span className={cn('min-w-0', cls)} data-stand={st.text} title={probs.length ? probs.map((p) => p.text).join('\n') : undefined}>
      <span className="block break-words">
        <span className={st.quiet ? 'text-muted' : 'text-ink-2'}>{st.text}</span>
        {probs.length > 0 && <span className="font-medium text-bad-600" data-problems={probs.length}> · {probWords(probs.length)}</span>}
      </span>
      {waits.length > 0 && <span className="block whitespace-normal text-[0.8125rem] leading-snug text-warn-700" data-waiting-on={waits.length}>Waiting on: {waits.slice(0, 2).join(' · ')}{waits.length > 2 ? ` · ${waits.length - 2} more` : ''}</span>}
    </span>
  )
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
        {/* the name the same as every list's — Today's size and weight; the client next to it gray */}
        <span className="min-w-0 break-words text-[0.9375rem] text-ink" data-project-name>{j.name}</span>
        {j.kind === 'repair' && <span className="shrink-0 text-[0.8125rem] text-muted">Repair</span>}
      </div>
      <span className="min-w-0 break-words text-[0.875rem] text-muted max-xl:hidden">{j.client}</span>
      <div className="flex min-w-0 items-center text-[0.875rem] max-md:hidden" data-now>{stand('')}</div>
      {hasWhen && (w.text ? date('text-right text-[0.875rem] max-md:hidden', w.text) : <span className="text-right text-[0.875rem] text-faint max-md:hidden" data-when></span>)}
      {/* a phone: like Today — every row the same two lines: the name (and its date on the right), and under it where it
          stands (its problems in red); the same weight, nothing wrapping */}
      <div className="hidden min-w-0 max-md:block">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="min-w-0 flex-1 break-words text-[0.9375rem] leading-[1.375rem] text-ink" data-project-name>{j.name}</span>
          {!!w.text && date('shrink-0 text-[0.8125rem]', whenShort(w.text))}
        </div>
        <div className="min-w-0 text-[0.875rem] leading-5" data-now>{stand('block')}</div>
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
        <TextInput aria-label="Repair name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 830 Northwood · lobby grout" />
      </FormRow>
      <FormRow label="Who pays?">
        <SearchSelect label="Who pays" value={billable === null ? '' : billable ? 'bill' : 'warranty'} onChange={(k) => setBillable(k === 'bill')} placeholder="Pick one" search={false} width={300} options={[{ key: 'bill', label: 'We bill the client' }, { key: 'warranty', label: 'Warranty · no charge' }]} />
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
export function NewProjectModal({ level, name: name0, address: address0 }: { level: number; name?: string; address?: string }) {
  const s = useStore()
  /* what's done already — nothing picked: it starts from the beginning. Picked: those are checked off ("done before
     Tile OS"); only what's left goes on people's lists */
  const [doneKeys, setDoneKeys] = React.useState<string[]>([])
  /* already under way (a job that started before Tile OS): next comes the one page where you set where it stands and
     tick what's done — the same as Set up projects — instead of going step by step */
  const [under, setUnder] = React.useState(false)
  const steps = companySteps(s).filter((d) => !d.off)
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
        st.money.unshift({ id: 'dep-' + id, jobId: id, kind: 'deposit', title: `Deposit ${pct}%`, amount: amt, step: 0, state: 'todo', due: 'Today', dueTone: 'warn', note: 'Created with the project.', log: [{ date: NOW, who: 'system', text: 'Deposit required. Created with the project' }], action: 'Create invoice' } as any)
      }
      addHist(st, id, { who: meOf(st.role), kind: 'pricing', title: 'Project created', detail: amount ? `Contract ${fmtMoney(amount)}` : undefined })
      /* already under way: what's done is checked off, the rest is on people's lists */
      if (doneKeys.length) {
        const recs = (st.stepRecs[id] ||= {})
        doneKeys.forEach((k) => { recs[k] = { done: NOW, by: meOf(st.role), note: 'Done before Tile OS' } })
        st.jobs[id].headline = 'Under way'
        st.jobs[id].issues = []
        addHist(st, id, { who: meOf(st.role), kind: 'field', title: `Entered under way · ${doneKeys.length} ${doneKeys.length === 1 ? 'step' : 'steps'} done already`, detail: doneKeys.map((k) => steps.find((d) => d.key === k)?.short || k).join(', ') })
      }
    }, `${finalName} is set up`, !doneKeys.length
      ? { sub: 'Its checklist starts with the office building the rooms.', to: [{ who: 'office', what: `Build the rooms · ${finalName}` }, ...(amount ? [{ who: 'accounting' as PersonKey, what: 'Deposit invoice' }] : [])] }
      : { sub: 'What’s done is checked off. Only what’s left is on people’s lists.', to: amount ? [{ who: 'accounting' as PersonKey, what: 'Deposit invoice' }] : undefined })
    s.close()
    setTimeout(() => s.open(under ? { t: 'catchup', id } : { t: 'job', id }), 60)
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
          <TextInput aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder={address.split(',')[0].trim() || 'Name · e.g. Leeds Residence'} className="h-10" />
          <TextInput aria-label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address · street, city" className="h-10" />
        </div>
      </FormRow>
      <FormRow label="Client">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1"><SearchSelect label="Client" value={clientId} onChange={setClientId} placeholder="Type a client" options={Object.values(CUSTOMERS).filter((c) => !isOff(s, 'client', c.id)).map((c) => ({ key: c.id, label: c.name, hint: c.kind }))} search /></div>
          <Button onClick={() => s.open({ t: 'newclient' })} icon={<Plus />}>New</Button>
        </div>
      </FormRow>
      {/* where it's at: starting now (its steps one after another), or already under way (next: one page to set where it
          stands and tick what's done) */}
      <FormRow label="Where is it up to?">
        <span className="block" data-new-under={under ? 'yes' : 'no'}>
          <Segmented value={under ? 'under' : 'new'} onChange={(v) => setUnder(v === 'under')} className="grid w-full grid-cols-2 [&>button]:justify-center" items={[{ key: 'new', label: 'Starting now' }, { key: 'under', label: 'Already under way' }]} />
          <span className="mt-1.5 block text-[0.8125rem] text-muted">{under ? 'Next: one page to set where it stands and tick what’s done. No going step by step.' : 'Its steps come one after another, starting with the paperwork.'}</span>
        </span>
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
            <SearchSelect label="When can we start" value={start} onChange={setStart} placeholder="Start, not set yet" emptyLabel="Not set yet" search={false} width={260} options={startOpts} plain />
            <SearchSelect label="Project manager" value={pm} onChange={(k) => setPm(k as PersonKey)} search={false} width={280} options={(['ys', 'office'] as PersonKey[]).map((p) => ({ key: p, label: PEOPLE[p].name, hint: 'Runs it', lead: <Avatar who={p} size={22} /> }))} plain />
          </div>
        </FormRow>
      </>}
    </Modal>
  )
}
