/* One step of getting a project ready, in one small window: who has it, when it's due, and the one or two things that
 * finish it — right here, without going to another page. The step bar on the project, the "Up next" list, Today and
 * the step's own task all open this window; Back / Next walk through the steps in order.
 *
 * And "Up next" — the project's open steps, tasks and meetings, one line each, in the order they matter. */
import * as React from 'react'
import { Check, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Plus, Camera, Mail, Copy, Send, Truck, PackageCheck, PackageX, Ruler, Zap, Droplets, Wrench, HardHat, X, Sparkles, Clock3 } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, TextArea, Field } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, Pop, DatePresets, Tip } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { MultiSelect } from '@/tileos/components/ui/select'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { toast } from '@/tileos/lib/pop'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { GROUTS, JOINTS, byTag, type Tile, type Surface } from '@/tileos/data/jobs'
import { METHODS, type MethodKey } from '@/tileos/data/takeoff'
import { timeLabel } from '@/tileos/data/calendar'
import { TODAY, labelFromIso, isoFromLabel } from '@/tileos/lib/today'
import { stepsFor, stepCounts, markStep, reopenStep, skipStep, setStepOwner, setStepDue, setCompanyStepOwner, companySteps, markTileOrdered, checkInTile, sendRevisedQty, setSiteCheck, sendSiteProblems, SITE_CHECKS, type StepView } from './steps'
import { insidePeople, AddStep } from './steps-ui'
import { patchTile, setTileOn, readPhoto, refKey } from './tiles'
import { methodOf, suggestMethod, methodsFor, takeoff, materialStatus, qtyLabel } from './takeoff'
import { confirmSetting } from './setting'
import { heightStatus, isWall } from './heights'
import { installerOf, crewFree } from './upcoming'
import { pickInstaller, sendDraftIPO, setSurfaceTile } from './flows2'
import { createInvoice, recordPayment, matBy } from './flows'
import { addEvent, removeEvent } from './calendar'
import { isOff } from './active'
import { poRatio, type Ratio } from './poratio'

/* ---------------- words ---------------- */
/** the window's title */
const TITLE: Record<string, string> = {
  rooms: 'Tile paperwork and quantities',
  tile: 'Tile selections — pictures and grout',
  design: 'Design meeting',
  installer: 'Installer and his PO',
  setup: 'Underlayment and setup',
  order: 'Tile order — delivery date',
  deposit: 'Deposit',
  heights: 'Site check',
  materials: 'Our materials',
  delivered: 'Tile delivery',
  walk: 'Walkthrough with the installer',
}
/** what to do, said the way you'd say it — the line on Up next and Today */
export const TODO: Record<string, string> = {
  rooms: 'Check the tile paperwork and quantities',
  tile: 'Tile selections — pictures and grout',
  design: 'Set up the design meeting',
  installer: 'Pick the installer and send his PO',
  setup: 'Confirm the underlayment and setup',
  order: 'Get the tile delivery date',
  deposit: 'Invoice the deposit',
  heights: 'Site check — heights, electrical, plumbing, water',
  materials: 'Order our materials',
  delivered: 'Check in the tile',
  walk: 'Walk the installer through the job',
}
/** one line under the title: what this step is for */
const WHAT: Record<string, string> = {
  rooms: 'Check the tile on the paperwork against what we’re tiling. Short? Send them the right quantities.',
  tile: 'A picture and a grout for every tile, and a tile on every wall and floor.',
  design: 'Sit down with the designer or the client — tile, layout, grout.',
  installer: 'Pick who installs it and send him his PO.',
  setup: 'What every floor and wall is set on. Our materials are worked out from it.',
  order: 'Find out when the tile is being delivered, and who checks it in.',
  deposit: 'Invoice it in QuickBooks, then mark it here. A missing deposit is a warning, not a stop.',
  heights: 'Look at the site before we order: heights, electrical, plumbing, water.',
  materials: 'Setting materials, worked out from the setup and the square feet.',
  delivered: 'Count the boxes when it comes.',
  walk: 'Show the installer the job before he starts.',
}
export const todoOf = (v: StepView) => (v.key === 'deposit' && v.state === 'wait' ? 'Deposit payment' : TODO[v.key] || v.label)

export function openStep(jobId: string, k: string) { useStore.getState().open({ t: 'step', jobId, k }) }

/* ================= the window ================= */
export function StepModal({ jobId, k, level }: { jobId: string; k: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const list = job ? stepsFor(s, job).filter((x) => x.state !== 'na' || x.key === k) : []
  const i = list.findIndex((x) => x.key === k)
  const v = list[i]
  if (!job || !v) return null
  const go = (x?: StepView) => { if (x) s.swap({ t: 'step', jobId, k: x.key }) }
  const dated = !['order', 'delivered', 'design', 'walk'].includes(v.key)
  return (
    <Modal level={level} size="lg" onClose={s.close} title={TITLE[v.key] || v.label} sub={`${job.name} · step ${i + 1} of ${list.length}`} footer={<Foot job={job} v={v} prev={list[i - 1]} next={list[i + 1]} go={go} />}>
      <Dots list={list} at={i} go={go} />
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Who job={job} v={v} />
        {dated && v.state !== 'done' && v.state !== 'na' && <When job={job} v={v} />}
        <StateWord v={v} me={meOf(s.role)} />
      </div>
      <UsualOwner v={v} />
      {(v.state === 'wait' || v.state === 'bad') && v.note && <div className={cn('mt-3 rounded-lg px-3.5 py-2.5 text-[0.84375rem] font-medium', v.state === 'bad' ? 'bg-bad-50 text-bad-700' : 'bg-warn-50 text-warn-800')}>{v.note}</div>}
      {v.state === 'later' && <div className="mt-3 rounded-lg bg-wash px-3.5 py-2.5 text-[0.84375rem] text-muted">It opens after {v.waitsFor?.toLowerCase()} — you can get it ready now.</div>}
      {WHAT[v.key] && v.state !== 'done' && <p className="mt-3 text-[0.875rem] leading-snug text-muted">{WHAT[v.key]}</p>}
      <div className="mt-5"><Body job={job} v={v} /></div>
    </Modal>
  )
}

/** the steps as small numbered dots — tap one to go to it */
function Dots({ list, at, go }: { list: StepView[]; at: number; go: (x?: StepView) => void }) {
  return (
    <div className="flex items-center" role="list" aria-label="Steps">
      {list.map((x, i) => (
        <React.Fragment key={x.key}>
          {i > 0 && <span className={cn('h-[0.125rem] min-w-[0.375rem] flex-1 rounded-full', list[i - 1].state === 'done' ? 'bg-ok-500' : 'bg-[#e3e7ec]')} />}
          <Tip label={`${i + 1}. ${x.short}${x.state === 'done' ? ' — done' : x.state === 'bad' ? ' — problem' : ''}`}>
            <button
              role="listitem"
              aria-label={`Step ${i + 1}: ${x.short}`}
              aria-current={i === at ? 'step' : undefined}
              onClick={() => go(x)}
              className={cn(
                'inline-flex shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold transition hover:scale-110',
                i === at ? 'h-7 w-7' : 'h-6 w-6',
                x.state === 'done' ? 'bg-ok-500 text-white' : x.state === 'bad' ? 'bg-bad-500 text-white' : x.state === 'later' || x.state === 'na' ? 'bg-white text-faint ring-1 ring-inset ring-[#dfe3e8]' : x.state === 'wait' ? 'bg-white text-warn-700 ring-2 ring-inset ring-warn-300' : 'bg-white text-brand-700 ring-2 ring-inset ring-brand-500',
                i === at && 'shadow-[0_0_0_0.25rem_rgba(38,80,207,.18)]',
              )}
            >
              {x.state === 'done' ? <Check className="h-3 w-3" strokeWidth={3.2} /> : x.state === 'bad' ? '!' : i + 1}
            </button>
          </Tip>
        </React.Fragment>
      ))}
    </div>
  )
}

const PILL = 'inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white text-[0.84375rem] font-semibold transition hover:border-[#cbd1d9] hover:bg-wash'
function Who({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  return (
    <Menu align="start" width={290} trigger={<button className={cn(PILL, 'py-1 pl-1 pr-3 text-ink')} aria-label="Who does it"><Avatar who={v.owner} size={26} />{PEOPLE[v.owner]?.name || 'Someone'}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
      <MenuLabel>Who does it on {job.name}</MenuLabel>
      {insidePeople(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={v.owner === p} hint={PEOPLE[p]?.roleLabel} onSelect={() => setStepOwner(job.id, v.key, p)}>{PEOPLE[p]?.name}</MenuItem>)}
    </Menu>
  )
}
/** the person changed on this project — offer to make them the one on every project */
function UsualOwner({ v }: { v: StepView }) {
  const s = useStore()
  const def = companySteps(s).find((d) => d.key === v.key)
  if (!def || v.only) return null
  const usual = def.owner === 'matBy' ? matBy(s) : def.owner
  if (usual === v.owner) return null
  return <button onClick={() => setCompanyStepOwner(v.key, v.owner)} className="mt-2 text-left text-[0.8125rem] font-semibold text-brand-600 hover:underline">Make {PEOPLE[v.owner]?.short} the one for “{v.short.toLowerCase()}” on every project</button>
}
function When({ job, v }: { job: Job; v: StepView }) {
  const [open, setOpen] = React.useState(false)
  const late = !!v.due && v.due < TODAY
  return (
    <Pop open={open} onOpenChange={setOpen} align="start" width={380} trigger={<button className={cn(PILL, 'px-3', late ? 'text-bad-600' : 'text-ink-2')} aria-label="When it's due"><CalendarDays className="h-4 w-4 text-faint" />{v.due ? `Due ${labelFromIso(v.due)}` : 'No due date'}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
      <div className="text-[0.875rem] font-semibold text-ink">When should it be done?</div>
      <div className="mt-3"><DatePresets value={v.due ? labelFromIso(v.due) : undefined} onPick={(d) => { setStepDue(job.id, v.key, d); setOpen(false) }} presets={['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} /></div>
    </Pop>
  )
}
const STATE_TONE: Record<string, Tone> = { done: 'ok', now: 'info', wait: 'warn', bad: 'bad', later: 'neutral', na: 'neutral' }
function StateWord({ v, me }: { v: StepView; me: PersonKey }) {
  const word = v.state === 'done' ? `Done${v.doneOn ? ` ${v.doneOn}` : ''}${v.doneBy ? ` · ${PEOPLE[v.doneBy]?.short}` : ''}`
    : v.state === 'later' ? `After ${v.waitsFor?.toLowerCase()}` : v.state === 'na' ? 'Not needed on this job' : v.state === 'wait' ? 'Waiting' : v.state === 'bad' ? 'Problem' : v.owner === me ? 'Your turn' : `${PEOPLE[v.owner]?.short || 'Their'}’s turn`
  return <Status tone={STATE_TONE[v.state]}>{word}</Status>
}

function Foot({ job, v, prev, next, go }: { job: Job; v: StepView; prev?: StepView; next?: StepView; go: (x?: StepView) => void }) {
  const s = useStore()
  const reopenable = v.custom || ['rooms', 'heights', 'design', 'walk', 'order', 'delivered'].includes(v.key)
  return (
    <>
      {v.state === 'na' ? <Button variant="ghost" onClick={() => skipStep(job.id, v.key, false)}>Needed after all</Button>
        : v.state === 'done' ? (reopenable && s.stepRecs[job.id]?.[v.key]?.done ? <Button variant="ghost" onClick={() => reopenStep(job.id, v.key)}>Not done after all</Button> : null)
          : <Button variant="ghost" onClick={() => { skipStep(job.id, v.key, true); s.close() }}>Not needed on this job</Button>}
      <span className="ml-auto" />
      {prev && <Button variant="ghost" icon={<ChevronLeft />} onClick={() => go(prev)}>Back</Button>}
      {next && <Button iconRight={<ChevronRight />} onClick={() => go(next)}><span className="max-w-[11rem] truncate">Next: {next.short}</span></Button>}
    </>
  )
}

/* ---------------- small pieces ---------------- */
function Block({ title, right, children, className }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-line', className)}>
      <header className="flex min-h-10 items-center gap-3 border-b border-line-2 bg-[#fafbfc] px-4 py-2">
        <h4 className="text-[0.8125rem] font-bold text-ink">{title}</h4>
        {right && <span className="ml-auto flex min-w-0 items-center gap-2 text-[0.78125rem] text-muted">{right}</span>}
      </header>
      <div>{children}</div>
    </section>
  )
}
const Quiet = ({ children }: { children: React.ReactNode }) => <div className="px-4 py-3 text-[0.84375rem] text-muted">{children}</div>
const Actions = ({ children }: { children: React.ReactNode }) => <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{children}</div>
const Good = ({ children }: { children: React.ReactNode }) => <div className="mt-4 flex items-center gap-2 rounded-xl bg-ok-50 px-4 py-3 text-[0.875rem] font-medium text-ok-700"><Check className="h-4 w-4" />{children}</div>

function Body({ job, v }: { job: Job; v: StepView }) {
  switch (v.key) {
    case 'rooms': return <Paperwork job={job} v={v} />
    case 'tile': return <Selections job={job} />
    case 'design':
    case 'walk': return <Meeting job={job} v={v} />
    case 'installer': return <Installer job={job} />
    case 'setup': return <Setup job={job} v={v} />
    case 'order': return <Order job={job} v={v} />
    case 'deposit': return <Deposit job={job} />
    case 'heights': return <SiteCheck job={job} v={v} />
    case 'materials': return <Materials job={job} />
    case 'delivered': return <Delivered job={job} v={v} />
  }
  return <Custom job={job} v={v} />
}

/* ================= 1 · the tile paperwork and its quantities ================= */
type Flat = { room: string; x: Surface }
const flatOf = (s: Pick<Store, 'rooms'>, jobId: string): Flat[] => (s.rooms[jobId] || []).flatMap((r) => r.surfaces.map((x) => ({ room: r.name, x })))
const wasteOf = (s: Store, x: Surface) => (isWall(x.name) ? s.rules.waste?.walls : s.rules.waste?.floors) ?? 10
export type QtyRow = { t: Tile; on: Flat[]; sf: number; unit: 'SF' | 'boxes'; need?: number; have?: number; short: number }
/** one tile: how much the paperwork has against what its walls and floors need (with the extra for cuts) */
export function qtyRow(s: Store, jobId: string, t: Tile): QtyRow {
  const on = flatOf(s, jobId).filter((f) => f.x.tile === t.tag)
  const sf = on.reduce((n, f) => n + (f.x.sf || 0), 0)
  const needSF = Math.ceil(on.reduce((n, f) => n + (f.x.sf || 0) * (1 + wasteOf(s, f.x) / 100), 0))
  const unit = t.paper?.unit || 'SF'
  const need = !on.length || !sf ? undefined : unit === 'boxes' ? (t.boxSF ? Math.ceil(needSF / t.boxSF) : undefined) : needSF
  const have = t.paper?.qty
  const short = have != null && need != null ? Math.max(0, need - have) : 0
  return { t, on, sf, unit, need, have, short }
}
const unitWord = (u: 'SF' | 'boxes', n?: number) => (u === 'boxes' ? (n === 1 ? 'box' : 'boxes') : 'SF')

function Paperwork({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const [sending, setSending] = React.useState(false)
  const [allRooms, setAllRooms] = React.useState(false)
  if (!rooms.length) return <Block title="What we’re tiling"><Quiet>No rooms yet — they come from the estimate. <button className="font-semibold text-brand-600 hover:underline" onClick={() => s.open({ t: 'buildrooms', jobId: job.id })}>Build them</button></Quiet></Block>
  const tiles = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const rows = tiles.map((t) => qtyRow(s, job.id, t))
  const short = rows.filter((r) => r.short > 0)
  const totalSF = rooms.reduce((n, r) => n + r.surfaces.reduce((m, x) => m + (x.sf || 0), 0), 0)
  const done = v.state === 'done'
  const shownRooms = allRooms ? rooms : rooms.slice(0, 4)
  return (
    <div className="flex flex-col gap-4">
      <Block title="What we’re tiling" right={`${rooms.length} room${rooms.length === 1 ? '' : 's'} · ${totalSF.toLocaleString('en-US')} SF · from the estimate`}>
        {shownRooms.map((r) => {
          const sf = r.surfaces.reduce((n, x) => n + (x.sf || 0), 0)
          return (
            <div key={r.name} className="flex items-baseline gap-3 border-t border-line-2 px-4 py-2 first:border-t-0">
              <span className="w-[9.5rem] shrink-0 truncate text-[0.84375rem] font-semibold text-ink max-sm:w-[7rem]">{r.name}</span>
              <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-muted">{r.surfaces.map((x) => `${x.name.toLowerCase()}${x.sf ? ` ${x.sf}` : ''}`).join(' · ')}</span>
              <span className="shrink-0 text-[0.8125rem] font-semibold tnum text-ink-2">{sf ? `${sf.toLocaleString('en-US')} SF` : '—'}</span>
            </div>
          )
        })}
        {rooms.length > 4 && <button onClick={() => setAllRooms(!allRooms)} className="w-full border-t border-line-2 px-4 py-2 text-left text-[0.8125rem] font-semibold text-brand-600 hover:bg-wash">{allRooms ? 'Show fewer' : `Show all ${rooms.length} rooms`}</button>}
      </Block>
      <Block title="Tile on the paperwork" right={<Button size="xs" icon={<Plus />} onClick={() => s.open({ t: 'tile', jobId: job.id })}>Add a tile</Button>}>
        {!rows.length && <Quiet>Add each tile from the paperwork: its tag, its name, where it goes and how much they have.</Quiet>}
        {rows.map((r) => <TileQty key={r.t.tag} job={job} r={r} />)}
      </Block>
      {!done && !sending && (
        <Actions>
          {short.length > 0 && <span className="mr-auto text-[0.84375rem] font-semibold text-bad-700">{short.length === 1 ? `${short[0].t.tag} is short on the paperwork` : `${short.length} tiles are short on the paperwork`}</span>}
          <Button variant={short.length ? 'primary' : 'secondary'} icon={<Send />} onClick={() => setSending(true)}>Send revised quantities</Button>
          <Button variant={short.length ? 'secondary' : 'primary'} icon={<Check />} onClick={() => markStep(job.id, 'rooms', short.length ? 'Checked — kept as it is' : 'Quantities check out', { close: true })}>{short.length ? 'Keep it as it is' : 'Quantities check out'}</Button>
        </Actions>
      )}
      {sending && <RevisedQty job={job} rows={short.length ? short : rows} onCancel={() => setSending(false)} />}
    </div>
  )
}

function TileQty({ job, r }: { job: Job; r: QtyRow }) {
  const s = useStore()
  const flat = flatOf(s, job.id)
  const opts = flat.map((f) => ({ key: refKey({ room: f.room, surface: f.x.name }), label: `${f.room} · ${f.x.name}`, hint: f.x.tile && f.x.tile !== r.t.tag ? `Has ${f.x.tile} now` : f.x.sf ? `${f.x.sf} SF` : undefined }))
  const vals = r.on.map((f) => refKey({ room: f.room, surface: f.x.name }))
  const [qty, setQty] = React.useState(r.have != null ? String(r.have) : '')
  const [box, setBox] = React.useState(r.t.boxSF ? String(r.t.boxSF) : '')
  React.useEffect(() => setQty(r.have != null ? String(r.have) : ''), [r.have])
  const save = (unit: 'SF' | 'boxes' = r.unit) => {
    const n = Number(qty)
    const paper = qty.trim() && !isNaN(n) ? { qty: n, unit } : undefined
    if (paper?.qty === r.have && unit === r.unit) return
    patchTile(job.id, r.t.tag, { paper: paper || (unit !== r.unit ? { qty: r.have || 0, unit } : undefined) })
  }
  const tone: Tone = !r.on.length ? 'neutral' : r.have == null ? 'neutral' : r.need == null ? 'neutral' : r.short ? 'bad' : 'ok'
  const word = !r.on.length ? 'Where?' : r.have == null ? 'Enter it' : r.need == null ? '—' : r.short ? `${r.short.toLocaleString('en-US')} short` : 'Enough'
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_11.5rem_6.5rem_6.25rem] items-center gap-3 border-t border-line-2 px-4 py-3 first:border-t-0 max-md:grid-cols-2 max-md:gap-y-2">
      <div className="flex min-w-0 items-center gap-3 max-md:col-span-2">
        <TileImg tile={r.t} size={40} radius={8} />
        <div className="min-w-0 flex-1">
          <button onClick={() => s.open({ t: 'tile', jobId: job.id, tag: r.t.tag })} className="block max-w-full truncate text-left text-[0.875rem] font-semibold text-ink hover:text-brand-700">{r.t.tag} {r.t.name}{r.t.size ? <span className="font-normal text-muted"> · {r.t.size}</span> : null}</button>
          <MultiSelect values={vals} options={opts} label={`Where ${r.t.tag} goes`} placeholder="Where does it go?" width={360} className="mt-1 min-h-8 py-1 text-[0.8125rem]" onChange={(keys) => setTileOn(job.id, r.t.tag, keys.map((k) => { const [room, surface] = k.split('|'); return { room, surface } }))} summary={(p) => (p.length > 2 ? `${p[0].label} and ${p.length - 1} more` : p.map((o) => o.label).join(', '))} />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <TextInput inputMode="decimal" aria-label={`${r.t.tag} on the paperwork`} value={qty} placeholder="—" onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className="h-9 w-[4.75rem] text-right tnum" />
        <Menu align="end" width={190} trigger={<button className="inline-flex h-9 items-center gap-1 rounded-[0.5625rem] border border-line bg-white px-2 text-[0.8125rem] font-medium text-ink-2 hover:bg-wash">{unitWord(r.unit)}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
          <MenuLabel>The paperwork counts it in</MenuLabel>
          <MenuItem checked={r.unit === 'SF'} onSelect={() => save('SF')}>Square feet</MenuItem>
          <MenuItem checked={r.unit === 'boxes'} onSelect={() => save('boxes')}>Boxes</MenuItem>
        </Menu>
      </div>
      <div className="text-right leading-tight max-md:text-left">
        {r.unit === 'boxes' && !r.t.boxSF && r.on.length > 0
          ? <label className="inline-flex items-center gap-1 text-[0.75rem] text-muted"><TextInput inputMode="decimal" aria-label="SF in a box" value={box} placeholder="SF" onChange={(e) => setBox(e.target.value.replace(/[^\d.]/g, ''))} onBlur={() => Number(box) > 0 && patchTile(job.id, r.t.tag, { boxSF: Number(box) })} className="h-8 w-[3.5rem] text-right tnum" />in a box</label>
          : <><span className="block text-[0.84375rem] font-semibold tnum text-ink-2">{r.need != null ? `${r.need.toLocaleString('en-US')} ${unitWord(r.unit, r.need)}` : '—'}</span><span className="block text-[0.71875rem] text-faint">we need</span></>}
      </div>
      <div className="text-right"><Status tone={tone}>{word}</Status></div>
    </div>
  )
}

/** the revised quantities, written out — copy it, or open it in your email */
function RevisedQty({ job, rows, onCancel }: { job: Job; rows: QtyRow[]; onCancel: () => void }) {
  const s = useStore()
  const client = s.clients[job.clientId]
  const contact = client?.contacts?.find((c) => /design/i.test(c.role)) || client?.contacts?.[0]
  const me = PEOPLE[meOf(s.role)]
  const [to, setTo] = React.useState(contact?.email || client?.email || '')
  const lines = rows.filter((r) => r.on.length && r.need != null && (r.have == null || r.have < r.need)).map((r) => `- ${r.t.tag} ${r.t.name}${r.t.size ? ` (${r.t.size})` : ''}: the paperwork has ${(r.have ?? 0).toLocaleString('en-US')} ${unitWord(r.unit)} — we need ${r.need!.toLocaleString('en-US')} ${unitWord(r.unit, r.need)} for ${r.on.map((f) => `${f.room} ${f.x.name.toLowerCase()}`).join(', ')}`)
  const [text, setText] = React.useState(() => [`Hi${contact?.name ? ` ${contact.name.split(' ')[0]}` : ''},`, '', `We checked the tile paperwork for ${job.name} against our measurements. These quantities need to change:`, '', ...(lines.length ? lines : ['- ']), '', 'The quantities include the usual extra for cuts and breakage. Please send us the updated paperwork.', '', 'Thanks,', me?.name || 'Cobblestone'].join('\n'))
  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`${job.name} — revised tile quantities`)}&body=${encodeURIComponent(text)}`
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast('Copied — paste it into your email') } catch { toast('Couldn’t copy — select the text and copy it') } }
  const sent = () => sendRevisedQty(job.id, { to: to.trim() || contact?.name || client?.name || 'the client', text })
  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 max-sm:p-3">
      <div className="text-[0.90625rem] font-semibold text-ink">Send the revised quantities</div>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="To"><TextInput value={to} onChange={(e) => setTo(e.target.value)} placeholder="Their email" /></Field>
        <Field label="Message"><TextArea rows={9} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <span className="ml-auto" />
        <Button icon={<Copy />} onClick={copy}>Copy</Button>
        <a href={href} target="_blank" rel="noreferrer" onClick={() => setTimeout(sent, 50)} className="inline-flex h-9 items-center gap-2 rounded-[0.5625rem] border border-[#d6dae0] bg-white px-3.5 text-[0.84375rem] font-semibold text-ink shadow-xs hover:border-brand-300 hover:text-brand-700"><Mail className="h-4 w-4" />Email it</a>
        <Button variant="primary" icon={<Check />} onClick={sent}>Mark it sent</Button>
      </div>
    </section>
  )
}

/* ================= 2 · tile selections: a picture and a grout for every tile ================= */
function Selections({ job }: { job: Job }) {
  const s = useStore()
  const tiles = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const flat = flatOf(s, job.id)
  const missing = flat.filter((f) => !f.x.tile)
  return (
    <div className="flex flex-col gap-4">
      <Block title="Each tile" right={<Button size="xs" icon={<Plus />} onClick={() => s.open({ t: 'tile', jobId: job.id })}>Add a tile</Button>}>
        {!tiles.length && <Quiet>No tiles yet — add them from the tile paperwork.</Quiet>}
        {tiles.map((t) => <TilePick key={t.tag} job={job} t={t} n={flat.filter((f) => f.x.tile === t.tag).length} />)}
      </Block>
      {missing.length > 0 && (
        <Block title="Walls and floors without a tile" right={`${missing.length} of ${flat.length}`}>
          {missing.map((f) => (
            <div key={f.room + '|' + f.x.name} className="flex items-center gap-3 border-t border-line-2 px-4 py-2 first:border-t-0">
              <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-ink"><b className="font-semibold">{f.room}</b> · {f.x.name}{f.x.sf ? <span className="text-muted"> · {f.x.sf} SF</span> : null}</span>
              <Menu align="end" width={280} trigger={<Button size="sm">Pick a tile<ChevronDown className="h-3.5 w-3.5" /></Button>}>
                <MenuLabel>{f.room} · {f.x.name}</MenuLabel>
                {tiles.map((t) => <MenuItem key={t.tag} icon={<TileImg tile={t} size={20} radius={4} />} onSelect={() => setSurfaceTile(job.id, f.room, f.x.name, t.tag)}>{t.tag} {t.name}</MenuItem>)}
                <MenuItem icon={<Plus className="h-4 w-4" />} onSelect={() => s.open({ t: 'tile', jobId: job.id, room: f.room, surface: f.x.name })}>A new tile…</MenuItem>
              </Menu>
            </div>
          ))}
        </Block>
      )}
      {!missing.length && flat.length > 0 && <Good>Every wall and floor has its tile.</Good>}
    </div>
  )
}
function TilePick({ job, t, n }: { job: Job; t: Tile; n: number }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const pick = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try { patchTile(job.id, t.tag, await readPhoto(f), `${t.tag} picture saved`) } catch (e: any) { toast(e?.message || 'Couldn’t read that picture') }
    setBusy(false)
  }
  const g = t.grout ? GROUTS[t.grout] : undefined
  const pic = !!(t.photo || t.swatch)
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0 max-sm:flex-wrap">
      <button onClick={() => ref.current?.click()} className="group shrink-0" aria-label={`Picture of ${t.tag}`}>
        {pic ? <TileImg tile={t} size={48} radius={9} /> : <span className="inline-flex h-12 w-12 items-center justify-center rounded-[0.5625rem] border border-dashed border-[#c9ced6] text-faint transition group-hover:border-brand-300 group-hover:text-brand-600"><Camera className="h-5 w-5" /></span>}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.875rem] font-semibold text-ink">{t.tag} {t.name}</div>
        <div className="truncate text-[0.78125rem] text-muted">{[t.size, t.finish, t.maker].filter(Boolean).join(' · ') || 'No details yet'} · {n ? `${n} wall${n === 1 ? '' : 's'} or floor${n === 1 ? '' : 's'}` : 'not on a wall or floor yet'}</div>
        {!pic && <button onClick={() => ref.current?.click()} className="text-[0.75rem] font-semibold text-warn-700 hover:underline">{busy ? 'Saving the picture…' : 'Add a picture'}</button>}
      </div>
      <Menu align="end" width={240} trigger={<button className="inline-flex h-9 items-center gap-2 rounded-[0.5625rem] border border-line bg-white px-2.5 text-[0.8125rem] font-medium text-ink-2 hover:bg-wash">{g ? <><GroutDot grout={t.grout} />{g.name}</> : <span className="font-semibold text-warn-700">Pick the grout</span>}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
        <MenuLabel>Grout for {t.tag}</MenuLabel>
        {Object.entries(GROUTS).map(([k, gg]) => <MenuItem key={k} icon={<GroutDot grout={k} />} checked={t.grout === k} onSelect={() => patchTile(job.id, t.tag, { grout: k }, `${t.tag} · ${gg.name} grout`)}>{gg.name}</MenuItem>)}
      </Menu>
      <Menu align="end" width={180} trigger={<button className="inline-flex h-9 items-center gap-1 rounded-[0.5625rem] border border-line bg-white px-2.5 text-[0.8125rem] font-medium text-ink-2 hover:bg-wash">{t.joint || 'Joint'}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
        <MenuLabel>Grout joint</MenuLabel>
        {JOINTS.map((j) => <MenuItem key={j} checked={t.joint === j} onSelect={() => patchTile(job.id, t.tag, { joint: j })}>{j}</MenuItem>)}
      </Menu>
    </div>
  )
}

/* ================= 3 / 11 · the design meeting, the walkthrough with the installer ================= */
const TIMES = Array.from({ length: 23 }, (_, i) => 7 * 60 + i * 30)
function Meeting({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const walk = v.key === 'walk'
  const ev = s.events
    .filter((e) => e.jobId === job.id && (walk ? e.kind === 'walkthrough' && /installer|crew/i.test(`${e.title} ${e.with || ''}`) : /design/i.test(e.title)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
    .pop()
  const crew = installerOf(s, job)
  const [edit, setEdit] = React.useState(!ev)
  const [day, setDay] = React.useState('Tomorrow')
  const [time, setTime] = React.useState(10 * 60)
  const [withWho, setWith] = React.useState(walk ? (crew ? PEOPLE[crew].name : '') : 'The designer')
  const [notes, setNotes] = React.useState('')
  const done = v.state === 'done'
  const save = () => {
    if (ev) removeEvent(ev.id)
    addEvent({ jobId: job.id, kind: walk ? 'walkthrough' : 'meeting', title: walk ? 'Walkthrough with the installer' : 'Design meeting', date: isoFromLabel(day) || TODAY, start: time, dur: 60, people: [v.owner], with: withWho.trim() || undefined, plan: true } as any)
    s.close()
  }
  if (ev && !edit) {
    const past = ev.date <= TODAY
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><CalendarDays className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.9375rem] font-semibold text-ink">{labelFromIso(ev.date)} · {timeLabel(ev.start)}</div>
            <div className="truncate text-[0.8125rem] text-muted">{[ev.with ? `With ${ev.with}` : '', ev.people.map((p) => PEOPLE[p]?.short).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
          </div>
          {!done && <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>Change</Button>}
        </div>
        {!done && past && (
          <>
            <Field label={walk ? 'Anything he needs to know (optional)' : 'What was decided (optional)'}><TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={walk ? 'Where to start, what to watch out for' : 'Tile, layout, grout — anything that changed'} /></Field>
            <Actions><Button variant="primary" icon={<Check />} onClick={() => markStep(job.id, v.key, notes.trim() || undefined, { close: true })}>It happened</Button></Actions>
          </>
        )}
        {!done && !past && <div className="text-[0.84375rem] text-muted">It’s on {PEOPLE[v.owner]?.short}’s agenda. After it happens, mark it done here.</div>}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <Field label="What day"><DatePresets value={day} onPick={setDay} presets={['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} /></Field>
      <div className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3 max-sm:grid-cols-1">
        <Field label="What time">
          <Menu align="start" width={180} trigger={<button className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-[0.625rem] border border-line bg-white px-3 text-[0.875rem] font-medium text-ink hover:border-[#cbd1d9]"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-faint" />{timeLabel(time)}</span><ChevronDown className="h-4 w-4 text-faint" /></button>}>
            {TIMES.map((m) => <MenuItem key={m} checked={m === time} onSelect={() => setTime(m)}>{timeLabel(m)}</MenuItem>)}
          </Menu>
        </Field>
        <Field label="With"><TextInput value={withWho} onChange={(e) => setWith(e.target.value)} placeholder={walk ? 'The installer' : 'The designer, the client…'} /></Field>
      </div>
      <Actions>
        {ev && <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>}
        {!ev && !done && <Button onClick={() => markStep(job.id, v.key, 'Done outside the calendar', { close: true })}>It already happened</Button>}
        <Button variant="primary" icon={<CalendarDays />} onClick={save}>{ev ? 'Save the change' : walk ? 'Set the walkthrough' : 'Set the meeting'}</Button>
      </Actions>
    </div>
  )
}

/* ================= 4 · the installer and his PO, against the estimate ================= */
export function RatioMeter({ r, className }: { r: Ratio; className?: string }) {
  if (!r.sold) return <div className={cn('rounded-xl border border-line px-4 py-3 text-[0.84375rem] text-muted', className)}>No estimate to compare his PO with yet.</div>
  const tone = r.over ? 'bad' : r.pct > r.line - 5 ? 'warn' : 'ok'
  return (
    <div className={cn('rounded-xl border border-line px-4 py-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[0.875rem] text-ink">His PO is <b className={cn('font-bold', tone === 'bad' ? 'text-bad-700' : tone === 'warn' ? 'text-warn-700' : 'text-ok-700')}>{r.pct}%</b> of the estimate</span>
        <span className="text-[0.78125rem] tnum text-muted">{fmtMoney(r.total)} of {fmtMoney(r.sold)} · keep it under {r.line}%</span>
      </div>
      <div className="relative mt-2.5 h-2.5 rounded-full bg-wash-2">
        <div className={cn('h-full rounded-full transition-all', tone === 'bad' ? 'bg-bad-500' : tone === 'warn' ? 'bg-warn-500' : 'bg-ok-500')} style={{ width: `${Math.min(100, Math.max(2, r.pct))}%` }} />
        <Tip label={`The line: ${r.line}% of the estimate`}><span className="absolute -bottom-1 -top-1 w-[0.1875rem] rounded-full bg-ink" style={{ left: `calc(${r.line}% - 0.09375rem)` }} /></Tip>
      </div>
    </div>
  )
}
const freeWord = (iso?: string) => (!iso || iso <= TODAY ? 'Free now' : `Free from ${labelFromIso(iso)}`)
function Installer({ job }: { job: Job }) {
  const s = useStore()
  const crew = installerOf(s, job)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const free = crewFree(s).filter((c) => !isOff(s, 'crew', c.crew))
  const [pick, setPick] = React.useState<PersonKey | undefined>(crew)
  if (ipo && ipo.status !== 'Rejected') {
    const r = poRatio(s, ipo)
    const said = ipo.status === 'Draft' ? 'Not sent yet' : ipo.status === 'Sent' ? 'Sent — waiting for him to accept' : `Accepted ${ipo.date}`
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => s.open({ t: 'ipo', id: ipo.id })} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition hover:border-[#cbd1d9] hover:bg-wash/50">
          <Avatar who={ipo.crew} size={38} />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-ink">{PEOPLE[ipo.crew].name}</span>
            <span className={cn('block text-[0.8125rem]', ipo.status === 'Accepted' ? 'text-ok-700' : ipo.status === 'Sent' ? 'text-warn-700' : 'text-muted')}>{ipo.id} · {said}</span>
          </span>
          <span className="shrink-0 text-right"><span className="block text-[1.125rem] font-semibold tnum text-ink">{fmtMoney(r.total)}</span><span className="block text-[0.71875rem] text-muted">his PO</span></span>
        </button>
        <RatioMeter r={r} />
        <Actions>
          <Button onClick={() => s.open({ t: 'ipo', id: ipo.id })}>{ipo.status === 'Accepted' ? 'Open the PO' : 'Adjust the PO'}</Button>
          {ipo.status === 'Draft' && <Button variant="primary" icon={<Send />} onClick={() => sendDraftIPO(ipo.id)}>Send it to {PEOPLE[ipo.crew].short}</Button>}
        </Actions>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {ipo?.status === 'Rejected' && <div className="rounded-xl bg-bad-50 px-4 py-3 text-[0.84375rem] font-medium text-bad-700">{PEOPLE[ipo.crew].short} turned it down{ipo.reason ? ` — ${ipo.reason.toLowerCase()}` : ''}. Pick someone else.</div>}
      <Field label="Who installs it">
        <Menu align="start" width={330} trigger={
          <button className="flex h-12 w-full items-center gap-3 rounded-[0.625rem] border border-line bg-white px-3 text-left transition hover:border-[#cbd1d9]" aria-label="Pick the installer">
            {pick ? <><Avatar who={pick} size={30} /><span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{PEOPLE[pick].name} <span className="font-normal text-muted">· {freeWord(free.find((f) => f.crew === pick)?.iso)}</span></span></> : <span className="flex-1 text-[0.9375rem] text-faint">Pick the installer</span>}
            <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
          </button>
        }>
          <MenuLabel>Who’s free first</MenuLabel>
          {free.map(({ crew: c, iso }) => <MenuItem key={c} icon={<Avatar who={c} size={22} />} checked={pick === c} hint={freeWord(iso)} onSelect={() => setPick(c)}>{PEOPLE[c].name}</MenuItem>)}
        </Menu>
      </Field>
      <Actions><Button variant="primary" disabled={!pick} onClick={() => pick && pickInstaller(job.id, pick)}>Make his PO</Button></Actions>
    </div>
  )
}

/* ================= 5 · what every floor and wall is set on ================= */
function Setup({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const rooms = (s.rooms[job.id] || []).map((r) => ({ ...r, surfaces: r.surfaces.filter((x) => x.sf) })).filter((r) => r.surfaces.length)
  const [choice, setChoice] = React.useState<Record<string, MethodKey>>(() => {
    const c: Record<string, MethodKey> = {}
    rooms.forEach((r) => r.surfaces.forEach((x) => { c[`${r.name}|${x.name}`] = methodOf(r.name, x).key }))
    return c
  })
  if (!rooms.length) return <Block title="What each floor and wall is set on"><Quiet>The rooms need square feet first — the setup and our materials go by them.</Quiet></Block>
  const patched = (s.rooms[job.id] || []).map((r) => ({ ...r, surfaces: r.surfaces.map((x) => (choice[`${r.name}|${x.name}`] ? { ...x, method: choice[`${r.name}|${x.name}`] } : x)) }))
  const t = takeoff({ ...s, rooms: { ...s.rooms, [job.id]: patched } }, job.id)
  const toOrder = t.lines.filter((l) => l.toOrder > 0)
  const total = toOrder.reduce((n, l) => n + l.toOrder * (s.items.find((i) => i.id === l.itemId)?.cost || 0), 0)
  return (
    <div>
      <Block title="What each floor and wall is set on" right={<span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-brand-500" />suggested</span>}>
        {rooms.map((r) => (
          <div key={r.name} className="border-t border-line-2 first:border-t-0">
            <div className="px-4 pt-2.5 text-[0.75rem] font-bold uppercase tracking-[0.05em] text-muted">{r.name}</div>
            {r.surfaces.map((x) => {
              const k = `${r.name}|${x.name}`
              const sug = suggestMethod(r.name, x)
              return (
                <div key={x.name} className="flex items-center gap-3 px-4 py-1.5 last:pb-2.5">
                  <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-ink">{x.name} <span className="text-muted">· {x.sf} SF</span></span>
                  <Menu align="end" width={300} trigger={<button className="inline-flex h-9 min-w-[11rem] items-center justify-between gap-2 rounded-[0.5625rem] border border-line bg-white px-3 text-[0.8125rem] font-semibold text-ink-2 hover:bg-wash max-sm:min-w-0"><span className="inline-flex items-center gap-1.5 truncate">{choice[k] === sug && <Sparkles className="h-3 w-3 text-brand-500" />}{METHODS[choice[k]]?.short}</span><ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
                    <MenuLabel>{r.name} · {x.name}</MenuLabel>
                    {methodsFor(x).map((m) => <MenuItem key={m} checked={choice[k] === m} hint={METHODS[m].layers} icon={m === sug ? <Sparkles className="h-4 w-4 text-brand-500" /> : undefined} onSelect={() => setChoice({ ...choice, [k]: m })}>{METHODS[m].label}</MenuItem>)}
                  </Menu>
                </div>
              )
            })}
          </div>
        ))}
      </Block>
      <div className="mt-3 text-[0.84375rem] text-muted">{toOrder.length ? <>That comes to <b className="font-semibold text-ink">{toOrder.length} materials</b> to order, about {fmtMoney(total)} — {PEOPLE[matBy(s)]?.short} gets the order.</> : 'Nothing new to order for it.'}</div>
      <Actions><Button variant="primary" icon={<Check />} onClick={() => confirmSetting(job.id, choice)}>{v.state === 'done' ? 'Save the changes' : 'Confirm the setup'}</Button></Actions>
    </div>
  )
}

/* ================= 6 · the tile order: when it comes, who checks it in ================= */
function Order({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const people = insidePeople(s)
  const [when, setWhen] = React.useState('Thu')
  const [who, setWho] = React.useState<PersonKey>(people.includes('yakov') ? 'yakov' : v.owner)
  if (checks.length)
    return (
      <Block title="What the store ordered" right={checks[0].supplier}>
        {checks.map((c) => {
          const need = Math.ceil(c.measured * (1 + c.wastePct / 100))
          const short = c.ordered < need && !c.note
          return (
            <div key={c.tag} className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0">
              <span className="min-w-0 flex-1"><span className="block text-[0.875rem] font-semibold text-ink">{c.tag} <span className="font-normal text-muted">· {c.where}</span></span><span className="block text-[0.78125rem] text-muted">{c.ordered} {c.unit} ordered · we need {need}{c.eta ? ` · delivery ${c.eta}` : ''}</span></span>
              {short ? <Button size="sm" variant="primary" onClick={() => s.open({ t: 'qty', jobId: job.id, tag: c.tag })}>Settle it</Button> : <Status tone="ok">Enough</Status>}
            </div>
          )
        })}
      </Block>
    )
  if (v.state === 'done') return <Good>{v.note || 'Ordered'}</Good>
  return (
    <div className="flex flex-col gap-4">
      <Field label="When is the tile being delivered?"><DatePresets value={when} onPick={setWhen} presets={['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} /></Field>
      <Field label="Who checks it in that day?">
        <div className="flex flex-wrap gap-1.5">
          {people.map((p) => (
            <button key={p} onClick={() => setWho(p)} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border pl-1 pr-3 text-[0.8125rem] font-medium transition', who === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}><Avatar who={p} size={26} />{PEOPLE[p]?.short}</button>
          ))}
        </div>
      </Field>
      <Actions><Button variant="primary" icon={<Truck />} onClick={() => { markTileOrdered(job.id, when, who); s.close() }}>Save the delivery date</Button></Actions>
    </div>
  )
}

/* ================= 7 · the deposit ================= */
function Deposit({ job }: { job: Job }) {
  const s = useStore()
  const dep = s.money.find((m) => m.jobId === job.id && m.kind === 'deposit')
  if (!dep) return <Block title="Deposit"><Quiet>No deposit on this project.</Quiet></Block>
  const left = (dep.amount || 0) - (dep.paid || 0)
  const paid = dep.state === 'paid'
  return (
    <div>
      <button onClick={() => s.open({ t: 'money', id: dep.id })} className="flex w-full items-center gap-4 rounded-xl border border-line px-4 py-3 text-left transition hover:border-[#cbd1d9] hover:bg-wash/50">
        <span className="min-w-0 flex-1">
          <span className="block text-[1.25rem] font-semibold tnum text-ink">{fmtMoney(dep.amount || 0)}</span>
          <span className="block text-[0.8125rem] text-muted">{paid ? `Paid${dep.date ? ` ${dep.date}` : ''}` : dep.step >= 1 ? `Invoice ${dep.ref || ''} sent · ${fmtMoney(left)} open`.replace('  ', ' ') : 'Not invoiced yet'}</span>
        </span>
        <Status tone={paid ? 'ok' : dep.step >= 1 ? 'warn' : 'neutral'}>{paid ? 'Paid' : dep.step >= 1 ? 'Waiting for payment' : 'To invoice'}</Status>
      </button>
      {!paid && (
        <Actions>
          {dep.step < 1 ? <Button variant="primary" icon={<Check />} onClick={() => createInvoice(dep.id)}>It’s invoiced in QuickBooks</Button> : <Button variant="primary" icon={<Check />} onClick={() => recordPayment(dep.id, left, 'Deposit paid')}>Paid in full</Button>}
        </Actions>
      )}
    </div>
  )
}

/* ================= 8 · the site check ================= */
const CHECK_ICON: Record<string, React.ElementType> = { heights: Ruler, electric: Zap, plumbing: Wrench, water: Droplets, ready: HardHat }
function SiteCheck({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const answers = s.stepRecs[job.id]?.heights?.checks || {}
  const hs = heightStatus(s, job.id)
  const answered = SITE_CHECKS.filter((c) => answers[c.k]).length
  const bad = SITE_CHECKS.filter((c) => answers[c.k] && !answers[c.k].ok)
  const done = v.state === 'done'
  return (
    <div>
      <Block title="On site" right={`${answered} of ${SITE_CHECKS.length} checked`}>
        {SITE_CHECKS.map((c) => <CheckRow key={c.k} job={job} c={c} a={answers[c.k]} heights={c.k === 'heights' && hs.total ? hs : undefined} />)}
      </Block>
      {!done && (
        <Actions>
          {bad.length > 0 && <Button variant="primary" icon={<Send />} onClick={() => sendSiteProblems(job.id)}>Send {bad.length === 1 ? 'the problem' : `the ${bad.length} problems`} to the office</Button>}
          <Button variant={bad.length ? 'secondary' : 'primary'} icon={<Check />} disabled={answered < SITE_CHECKS.length || bad.length > 0} onClick={() => markStep(job.id, 'heights', 'All good on site', { close: true })}>All good — done</Button>
        </Actions>
      )}
    </div>
  )
}
function CheckRow({ job, c, a, heights }: { job: Job; c: { k: string; label: string; sub: string }; a?: { ok: boolean; note?: string }; heights?: { measured: number; total: number } }) {
  const s = useStore()
  const [note, setNote] = React.useState(a?.note || '')
  const Ic = CHECK_ICON[c.k] || Check
  const chip = (on: boolean, tone: 'ok' | 'bad') => cn('inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[0.8125rem] font-semibold transition', on ? (tone === 'ok' ? 'border-ok-500 bg-ok-500 text-white' : 'border-bad-500 bg-bad-500 text-white') : 'border-line bg-white text-ink-2 hover:bg-wash')
  return (
    <div className="border-t border-line-2 px-4 py-3 first:border-t-0">
      <div className="flex items-center gap-3 max-sm:flex-wrap">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-wash text-muted"><Ic className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.875rem] font-semibold text-ink">{c.label}</span>
          <span className="block text-[0.78125rem] text-muted">{c.sub}{heights ? ` · ${heights.measured} of ${heights.total} walls measured` : ''}</span>
        </span>
        {heights && <Button size="sm" variant="ghost" icon={<Ruler />} onClick={() => s.open({ t: 'heights', jobId: job.id })}>Enter heights</Button>}
        <span className="flex shrink-0 gap-1.5">
          <button onClick={() => setSiteCheck(job.id, c.k, a?.ok === true ? null : true)} className={chip(a?.ok === true, 'ok')}><Check className="h-3.5 w-3.5" strokeWidth={3} />Good</button>
          <button onClick={() => setSiteCheck(job.id, c.k, a?.ok === false ? null : false, note.trim() || undefined)} className={chip(a?.ok === false, 'bad')}><X className="h-3.5 w-3.5" strokeWidth={3} />Problem</button>
        </span>
      </div>
      {a?.ok === false && <TextInput autoFocus={!a.note} className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note.trim() !== (a.note || '') && setSiteCheck(job.id, c.k, false, note.trim() || undefined)} placeholder="What’s wrong — e.g. no box for the vanity light" />}
    </div>
  )
}

/* ================= 9 · our materials ================= */
function Materials({ job }: { job: Job }) {
  const s = useStore()
  const t = takeoff(s, job.id)
  const need = t.lines.filter((l) => l.need > 0)
  const ms = materialStatus(s, job.id)
  return (
    <div>
      <Block title="What it takes" right={t.sf ? `${t.sf.toLocaleString('en-US')} SF · from the setup` : undefined}>
        {!need.length && <Quiet>{ms.hint}</Quiet>}
        {need.map((l) => {
          const it = s.items.find((i) => i.id === l.itemId)
          return (
            <div key={l.itemId} className="flex items-center gap-3 border-t border-line-2 px-4 py-2 first:border-t-0">
              <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-ink">{it?.brand ? `${it.brand} ${it.product}` : it?.name || l.itemId}</span>
              <span className="shrink-0 text-[0.84375rem] font-semibold tnum text-ink">{qtyLabel(l.need, it?.unit || '')}</span>
              <span className={cn('w-[6.5rem] shrink-0 text-right text-[0.78125rem]', l.toOrder ? 'font-semibold text-warn-700' : 'text-ok-700')}>{l.toOrder ? `${l.toOrder} to order` : 'Ordered'}</span>
            </div>
          )
        })}
      </Block>
      {need.some((l) => l.toOrder > 0) && <Actions><Button variant="primary" onClick={() => s.open({ t: 'newpo', jobId: job.id, fromTakeoff: true })}>Order them</Button></Actions>}
    </div>
  )
}

/* ================= 10 · the tile comes ================= */
function Delivered({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const checks = s.checks.filter((c) => c.jobId === job.id)
  if (checks.length)
    return (
      <div>
        <Block title="The delivery" right={checks[0].supplier}>
          {checks.map((c) => (
            <div key={c.tag} className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0">
              <span className="min-w-0 flex-1"><span className="block text-[0.875rem] font-semibold text-ink">{c.tag} <span className="font-normal text-muted">· {c.where}</span></span><span className="block text-[0.78125rem] text-muted">{c.received} of {c.ordered} {c.unit} here{c.eta && c.received < c.ordered ? ` · due ${c.eta}` : ''}</span></span>
              <Status tone={c.received >= c.ordered ? 'ok' : c.received ? 'bad' : 'neutral'}>{c.received >= c.ordered ? 'All here' : c.received ? 'Part of it' : 'Not yet'}</Status>
            </div>
          ))}
        </Block>
        {checks.some((c) => c.received < c.ordered) && <Actions><Button variant="primary" icon={<PackageCheck />} onClick={() => s.open({ t: 'receivetile', jobId: job.id })}>Check it in</Button></Actions>}
      </div>
    )
  if (v.state === 'done') return <Good>{v.note || 'On site'}</Good>
  return (
    <div>
      <div className="rounded-xl border border-line px-4 py-3 text-[0.875rem] text-ink">{v.due ? <>Delivery <b className="font-semibold">{labelFromIso(v.due)}</b> — count the boxes against the order.</> : 'No delivery date yet — it’s set on the tile order step.'}</div>
      <Actions>
        <Button icon={<PackageX />} onClick={() => s.open({ t: 'record', jobId: job.id, type: 'shortage' })}>Short, wrong or broken</Button>
        <Button variant="primary" icon={<PackageCheck />} onClick={() => { checkInTile(job.id); s.close() }}>All of it is here</Button>
      </Actions>
    </div>
  )
}

/* ================= a step of your own ================= */
function Custom({ job, v }: { job: Job; v: StepView }) {
  const [note, setNote] = React.useState('')
  if (v.state === 'done') return <Good>{v.note || 'Done'}</Good>
  return (
    <div>
      <Field label="Note (optional)"><TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the next person should know" /></Field>
      <Actions><Button variant="primary" icon={<Check />} onClick={() => markStep(job.id, v.key, note.trim() || undefined, { close: true })}>Done</Button></Actions>
    </div>
  )
}

/* ================= Up next — on the project ================= */
const DOT: Record<string, string> = { bad: 'bg-bad-500', now: 'bg-brand-600', mine: 'bg-brand-600', wait: 'bg-warn-500', ev: 'bg-vio-500', task: 'bg-brand-400' }
/** what's open on a project, one line each: the steps that are someone's turn, tasks outside the steps, meetings */
export function UpNext({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const [adding, setAdding] = React.useState(false)
  const steps = stepsFor(s, job)
  const c = stepCounts(steps)
  const rank = (v: StepView) => (v.state === 'bad' ? 0 : v.state === 'now' && v.owner === me ? 1 : v.state === 'now' ? 2 : 3)
  const open = steps.filter((v) => ['bad', 'now', 'wait'].includes(v.state)).sort((a, b) => rank(a) - rank(b))
  const stepTasks = new Set(steps.map((v) => v.taskId).filter(Boolean))
  const tasks = s.tasks.filter((t) => t.jobId === job.id && (t.state === 'now' || t.state === 'waiting') && !stepTasks.has(t.id) && !t.step)
  const meets = s.events.filter((e) => e.jobId === job.id && e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).slice(0, 3)
  const when = (iso?: string) => (iso ? labelFromIso(iso) : '')
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-3 border-b border-line px-5 py-3 max-sm:px-4">
        <h3 className="text-[0.9375rem] font-semibold text-ink">Up next</h3>
        <span className="ml-auto text-[0.8125rem] font-semibold tnum text-muted">{c.done} of {c.total} steps done</span>
      </header>
      {open.map((v) => <NextRow key={v.key} dot={v.state === 'bad' ? 'bad' : v.state === 'wait' ? 'wait' : 'now'} title={todoOf(v)} sub={v.state === 'bad' || v.state === 'wait' ? v.note : undefined} bad={v.state === 'bad'} who={v.owner} mine={v.owner === me} when={v.state === 'wait' ? 'Waiting' : when(v.due)} late={!!v.due && v.due < TODAY && v.state !== 'wait'} onClick={() => openStep(job.id, v.key)} />)}
      {tasks.map((t) => <NextRow key={t.id} dot={t.state === 'waiting' ? 'wait' : 'task'} title={t.title.replace(new RegExp(`\\s*[—·-]\\s*${job.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '')} sub={t.state === 'waiting' ? `Waiting on ${t.waitingOn}${t.followUp ? ` · back ${t.followUp}` : ''}` : undefined} who={t.owner} mine={t.owner === me} when={t.state === 'waiting' ? 'Waiting' : t.due || ''} onClick={() => s.open({ t: 'task', id: t.id })} />)}
      {meets.map((e) => <NextRow key={e.id} dot="ev" title={e.title} sub={e.with ? `With ${e.with}` : undefined} who={e.people[0]} mine={e.people.includes(me)} when={`${when(e.date)} ${timeLabel(e.start)}`} onClick={() => s.open({ t: 'event', id: e.id })} />)}
      {!open.length && !tasks.length && !meets.length && <div className="px-5 py-4 text-[0.875rem] text-muted max-sm:px-4">{c.done === c.total ? 'Every step is done — it’s ready to start.' : 'Nothing open right now — the next steps open as these finish.'}</div>}
      {adding ? <AddStep job={job} steps={steps} onDone={() => setAdding(false)} compact /> : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 border-t border-line-2 px-5 py-2.5 text-left text-[0.8125rem] font-semibold text-muted transition hover:bg-wash hover:text-ink max-sm:px-4"><Plus className="h-4 w-4" />Add a step for this project</button>
      )}
    </section>
  )
}
function NextRow({ dot, title, sub, bad, who, mine, when, late, onClick }: { dot: string; title: string; sub?: string; bad?: boolean; who?: PersonKey; mine?: boolean; when?: string; late?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 border-t border-line-2 px-5 py-3 text-left transition first:border-t-0 hover:bg-[#f8f9fb] max-sm:px-4">
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[dot])} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.90625rem] font-semibold text-ink max-sm:whitespace-normal max-sm:leading-snug">{title}</span>
        {sub && <span className={cn('block truncate text-[0.8125rem] max-sm:whitespace-normal max-sm:leading-snug', bad ? 'font-medium text-bad-600' : 'text-muted')}>{sub}</span>}
      </span>
      {who && (
        <span className="flex w-[9.5rem] shrink-0 items-center gap-2 max-sm:w-auto">
          <Avatar who={who} size={24} />
          <span className={cn('truncate text-[0.84375rem] max-sm:hidden', mine ? 'font-semibold text-brand-700' : 'text-ink-2')}>{mine ? 'You' : PEOPLE[who]?.short}</span>
        </span>
      )}
      <span className={cn('w-[5.75rem] shrink-0 text-right text-[0.8125rem] tnum max-sm:w-auto', late ? 'font-semibold text-bad-600' : 'text-muted')}>{when}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:text-brand-600" />
    </button>
  )
}
