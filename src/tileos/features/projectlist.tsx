/* Projects — won work only (estimates live in Estimates). This is the game plan, as a list:
 * every project with where it stands — for the ones getting ready, its checklist (what's done, what's open,
 * who has each open step); for the ones being installed, how far along and what's holding anything up.
 * Filters on top; the default shows everything that isn't finished. */
import * as React from 'react'
import { Plus, Wrench, CalendarClock, CircleCheckBig, Building2, HardHat, ClipboardList, Flag, Sparkles, PauseCircle, Layers, TriangleAlert } from 'lucide-react'
import { useStore, addHist, newTask, NOW, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, DatePresets } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Group, Row, Col, Meta, IconTile, ProgressRing, EmptyState, Status, Bubbles, DateTile, PX, STICKY_HEAD } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, fmtMoney, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { billingOf } from './job/money-tab'
import { stepsFor, stepCounts, lanesFor, isGettingReady } from './steps'
import { TODAY, md, isoFromLabel } from '@/tileos/lib/today'
import { SearchSelect } from '@/tileos/components/ui/select'
import { isOff } from './active'
import { allowedFor } from './newpicker'

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
      actions={allowedFor(s.role, 'newproject') ? <Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newproject' })}>New project</Button> : undefined}
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

/* Project · Where it stands · Installer · Dates · Contract — no status column: the group it's under already says it */
const COLS = 'grid grid-cols-[minmax(0,1.15fr)_8.75rem_minmax(0,1.5fr)_8rem_7.5rem_9.375rem] items-center gap-6 max-2xl:grid-cols-[minmax(0,1.1fr)_8.75rem_minmax(0,1.5fr)_8rem_7.5rem] max-xl:grid-cols-[minmax(0,1fr)_8.25rem_minmax(0,1.4fr)_7.5rem] max-lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] max-md:grid-cols-1'

function ListHead() {
  return (
    <div className={cn('border-b border-line-2 bg-wash py-2 text-[0.75rem] font-semibold text-muted max-lg:hidden', COLS, PX, STICKY_HEAD)}>
      <span>Project</span>
      <span className="max-lg:hidden">Status</span>
      <span>Where it stands</span>
      <span className="max-xl:hidden">Installer</span>
      <span className="max-lg:hidden">Dates</span>
      <span className="max-2xl:hidden">Contract · billed</span>
    </div>
  )
}

/** what we billed so far, as a slim bar under the contract */
function MoneyCell({ j }: { j: Job }) {
  const b = billingOf(j)
  const contract = (b.contract || j.contract || 0) + (b.changes || 0)
  if (!contract) return <span className="text-[0.8125rem] text-faint">—</span>
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.84375rem] font-semibold tnum text-ink">{fmtMoney(contract)}</span>
        <span className="text-[0.75rem] font-medium tnum text-muted">{b.billedPct || 0}%</span>
      </div>
      <div className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-wash-2">
        <span className="h-full bg-ok-500" style={{ width: `${b.paidPct || 0}%` }} />
        <span className="h-full bg-brand-300" style={{ width: `${Math.max(0, (b.billedPct || 0) - (b.paidPct || 0))}%` }} />
      </div>
    </div>
  )
}

/** one slim bar and a few words — the same shape for every kind of project */
function Progress({ pct, tone, label, sub, subTone }: { pct: number; tone: 'brand' | 'ok' | 'warn'; label: React.ReactNode; sub?: React.ReactNode; subTone?: 'bad' | 'warn' }) {
  const bar = tone === 'ok' ? 'bg-ok-500' : tone === 'warn' ? 'bg-warn-500' : 'bg-brand-500'
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="h-1.5 w-[5.5rem] shrink-0 overflow-hidden rounded-full bg-wash-2"><span className={cn('block h-full rounded-full', bar)} style={{ width: `${Math.max(3, Math.min(100, pct))}%` }} /></span>
        <span className="truncate text-[0.8125rem] font-medium tnum text-ink-2">{label}</span>
      </div>
      {sub && <div className={cn('mt-0.5 truncate pl-[6.125rem] text-[0.78125rem] max-md:pl-0', subTone === 'bad' ? 'font-medium text-bad-600' : subTone === 'warn' ? 'font-medium text-warn-700' : 'text-muted')}>{sub}</div>}
    </div>
  )
}

/** where it stands, in one cell — the checklist while it's getting ready, the work once crews are on it */
function StandsCell({ j }: { j: Job }) {
  const s = useStore()
  const t = typeOf(j)
  if (t === 'coming') {
    const steps = stepsFor(s, j).filter((x) => x.state !== 'na')
    const c = stepCounts(steps)
    const lanes = lanesFor(steps)
    const lDone = lanes.filter((l) => l.state === 'done').length
    const bad = steps.filter((x) => x.state === 'bad')
    return <Progress pct={(c.done / Math.max(1, c.total)) * 100} tone="brand" label={c.done === c.total ? 'Ready — every step done' : `${lDone} of ${lanes.length} ready`} sub={bad.length ? `${bad[0].note || bad[0].short}${bad.length > 1 ? ` · +${bad.length - 1} more` : ''}` : undefined} subTone="bad" />
  }
  if (t === 'hold') return <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-medium text-bad-600"><PauseCircle className="h-4 w-4 shrink-0" /><span className="truncate">{j.hold?.reason}</span></span>
  const rooms = s.rooms[j.id] || []
  if (t === 'progress') {
    const blocked = rooms.flatMap((r) => r.surfaces.filter((x) => ['blocked', 'waitmat', 'hold'].includes(x.state)).map((x) => `${r.name} ${x.name.toLowerCase()}`))
    const left = rooms.filter((r) => (r.pct ?? 0) < 100).length
    return <Progress pct={j.pct ?? 0} tone="ok" label={<>{j.pct ?? 0}% installed<span className="font-normal text-muted"> · {left ? `${left} of ${rooms.length} rooms left` : 'all rooms tiled'}</span></>} sub={blocked.length ? `Waiting: ${blocked.slice(0, 2).join(', ')}${blocked.length > 2 ? ` +${blocked.length - 2}` : ''}` : undefined} subTone="warn" />
  }
  if (t === 'touchups' || t === 'repairs') {
    const all = s.punch.filter((p) => p.jobId === j.id)
    const open = all.filter((p) => p.status !== 'verified')
    const booking = s.bookings.find((b) => b.jobId === j.id && b.end >= TODAY)
    const hold = s.ready.find((r) => r.jobId === j.id && r.kind === 'hold')
    return (
      <Progress
        pct={all.length ? ((all.length - open.length) / all.length) * 100 : 100}
        tone="warn"
        label={open.length ? `${open.length} touch-up${open.length > 1 ? 's' : ''} open` : t === 'repairs' ? j.scope || 'Repair' : 'All touch-ups verified'}
        sub={hold ? `Return on hold — ${hold.warn?.toLowerCase()}` : booking ? `${PEOPLE[booking.crew as PersonKey]?.short} back ${md(booking.start)}` : 'Return visit not booked'}
        subTone={hold ? 'bad' : undefined}
      />
    )
  }
  const b = billingOf(j)
  return <span className="text-[0.8125rem] text-muted">{b.billedPct >= 100 ? 'Billed in full' : `${b.billedPct || 0}% billed`}{j.stageDates?.closeout ? ` · closed ${j.stageDates.closeout}` : ''}</span>
}

function DatesCell({ j }: { j: Job }) {
  const s = useStore()
  const t = typeOf(j)
  const iso = s.prep[j.id]?.targetISO
  if (t === 'coming') {
    /* the day's come: say the site's ready only if the site check says so — otherwise it's late, in red */
    const siteBad = !!iso && iso <= TODAY && stepsFor(s, j).some((x) => x.key === 'heights' && x.state === 'bad')
    return <span className="text-[0.8125rem] text-muted">{iso ? (iso <= TODAY ? (siteBad ? <span className="font-semibold text-bad-600">Late · was {md(iso)}</span> : <span className="font-medium text-ok-700">Site ready</span>) : <>Start <span className="font-medium text-ink-2">{md(iso)}</span></>) : 'Start to set'}</span>
  }
  const start = j.dates?.start || s.prep[j.id]?.started
  return (
    <span className="block min-w-0 text-[0.8125rem] leading-tight text-muted">
      {start && <span className="block truncate">Started {start}</span>}
      {j.dates?.finish && t !== 'done' && <span className="block truncate">Finish <span className="font-medium text-ink-2">{j.dates.finish}</span></span>}
      {!start && !j.dates?.finish && '—'}
    </span>
  )
}

function ProjectRow({ j, crew }: { j: Job; crew?: PersonKey }) {
  const s = useStore()
  const t = typeOf(j)
  const status = j.hold ? 'On hold' : t === 'coming' ? (flowOf(j) === 'setup' ? 'Setup' : 'Ready to start') : STAGE_LABEL[j.stage]
  const tone = j.hold ? 'bad' : t === 'coming' ? (flowOf(j) === 'setup' ? 'vio' : 'info') : TYPE_TONE[t]
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => s.open({ t: 'job', id: j.id })}
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) s.open({ t: 'job', id: j.id }) }}
      className={cn('min-h-[3.5rem] cursor-pointer border-t border-line-2 py-2.5 transition-colors hover:bg-[#f7f5f0] max-md:gap-1.5', COLS, PX)}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <div className="truncate text-[0.875rem] font-semibold text-ink">{j.name}{j.kind === 'repair' && <span className="ml-2 align-[0.0625rem] text-[0.75rem] font-semibold text-[#b83a5e]">Repair</span>}</div>
          <div className="truncate text-[0.78125rem] text-muted">{j.client}</div>
        </div>
      </div>
      <div className="min-w-0 max-lg:hidden"><Status tone={tone}>{status}</Status></div>
      <div className="min-w-0"><StandsCell j={j} /></div>
      <div className="min-w-0 max-xl:hidden">
        {crew ? <span className="inline-flex min-w-0 items-center gap-2 text-[0.8125rem] font-medium text-ink-2"><Avatar who={crew} size={24} /><span className="truncate">{PEOPLE[crew].short}</span></span> : <span className="text-[0.8125rem] text-faint">{t === 'done' ? '—' : 'Not booked'}</span>}
      </div>
      <div className="min-w-0 max-lg:hidden"><DatesCell j={j} /></div>
      <div className="min-w-0 max-2xl:hidden"><MoneyCell j={j} /></div>
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
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="New repair"
      sub="A callback, a warranty fix or a small repair. It goes straight to Projects → Repairs."
      footer={
        <>
          <Button variant="ghost" onClick={s.close}>Cancel</Button>
          <Button className="ml-auto" variant="primary" disabled={!clientId || !name.trim() || !what.trim() || billable === null} onClick={create}>Add repair</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Client">
          <SearchSelect value={clientId} onChange={(id) => { setClientId(id); if (!name) setName(`${CUSTOMERS[id]?.name.split(' ')[0]} repair`) }} placeholder="Type a client" options={Object.values(CUSTOMERS).filter((c) => !isOff(s, 'client', c.id)).map((c) => ({ key: c.id, label: c.name, hint: c.kind }))} />
        </Field>
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 830 Northwood — lobby grout" /></Field>
        <Field label="What needs fixing?"><TextInput value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. Cracked tiles at the elevator landing" /></Field>
        <Field label="Who pays?">
          <div className="flex gap-2">
            <Chip on={billable === true} onClick={() => setBillable(true)}>We bill the client</Chip>
            <Chip on={billable === false} onClick={() => setBillable(false)}>Warranty — no charge</Chip>
          </div>
        </Field>
        <Field label="Who does it" hint="Leave it empty to book a crew later">
          <div className="flex flex-wrap gap-2">{CREWS.filter((c) => !isOff(s, 'crew', c)).map((c) => <Chip key={c} on={crew === c} onClick={() => setCrew(crew === c ? '' : c)} className="h-9" icon={<Avatar who={c} size={20} />}>{PEOPLE[c].short}</Chip>)}</div>
        </Field>
        {crew && <Field label="When"><DatePresets value={day} onPick={setDay} presets={['Today', 'Tomorrow', 'Fri', 'Next Mon']} /></Field>}
      </div>
    </Modal>
  )
}

/* ================= a new project, straight away — won without an estimate here, or brought in from before ================= */
export function NewProjectModal({ level }: { level: number }) {
  const s = useStore()
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
    }, `${finalName} is set up`, { sub: 'Its checklist starts with the office building the rooms.', to: [{ who: 'office', what: `Build the rooms · ${finalName}` }, ...(amount ? [{ who: 'accounting' as PersonKey, what: 'Deposit invoice' }] : [])] })
    s.close()
    setTimeout(() => s.open({ t: 'job', id }), 60)
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="New project"
      sub="Won already. To price one, use Estimates."
      footer={
        <>
          <Button variant="ghost" onClick={s.close}>Cancel</Button>
          <Button className="ml-auto" variant="primary" disabled={!clientId || !finalName} onClick={create}>Create project</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Client">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1"><SearchSelect value={clientId} onChange={setClientId} placeholder="Type a client" options={Object.values(CUSTOMERS).filter((c) => !isOff(s, 'client', c.id)).map((c) => ({ key: c.id, label: c.name, hint: c.kind }))} /></div>
            <Button onClick={() => s.open({ t: 'newclient' })} icon={<Plus />}>New</Button>
          </div>
        </Field>
        <Field label="Address"><TextInput aria-label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 42 Orchard St, Brooklyn" /></Field>
        {!more && (
          <button onClick={() => setMore(true)} className="inline-flex items-center gap-1.5 self-start text-[0.8125rem] font-semibold text-ink-2 hover:text-ink">
            <Plus className="h-4 w-4" />A different name, the contract, when we start
          </button>
        )}
        {more && (
          <div className="flex flex-col gap-4 rounded-[0.875rem] bg-wash px-4 py-4">
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <Field label="Name" hint="It goes by the street if you leave it"><TextInput aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder={address.split(',')[0].trim() || 'e.g. Green Tree'} /></Field>
              <Field label="Contract" hint="The deposit invoice is made from it"><TextInput aria-label="Contract" inputMode="decimal" value={contract} onChange={(e) => setContract(e.target.value)} placeholder="$0" /></Field>
            </div>
            <Field label="When can we start?"><DatePresets value={start} onPick={setStart} presets={['Next Mon', 'In 2 weeks']} /></Field>
            <Field label="Project manager">
              <div className="flex flex-wrap gap-2">
                {(['ys', 'office'] as PersonKey[]).map((p) => <Chip key={p} on={pm === p} onClick={() => setPm(p)} icon={<Avatar who={p} size={20} />}>{PEOPLE[p].name}</Chip>)}
              </div>
            </Field>
          </div>
        )}
      </div>
    </Modal>
  )
}
