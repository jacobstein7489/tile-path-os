/* One step of getting a project ready, in one window that never changes size: the whole list down the side (every step
 * by name, where it stands, who has it), the step itself on the right — what it is, whose turn, when, the one or two
 * things that finish it, and what opens when it's done. The project's list, Today and the step's own task all open it;
 * Back / Next walk through the steps in order.
 *
 * And the project's game plan — the same list, grouped, one line per step, in plain words. */
import * as React from 'react'
import { Check, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Plus, Camera, Mail, Copy, Send, Truck, PackageCheck, PackageX, Ruler, Zap, Droplets, Wrench, HardHat, X, Sparkles, Clock3, Upload, FileText, Hourglass, CornerDownRight, Users, ArrowRight } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, TextArea, Field } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, Pop, DatePresets, Tip } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { MultiSelect } from '@/tileos/components/ui/select'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { toast } from '@/tileos/lib/pop'
import { keepFiles, openFile, sizeLabel } from '@/tileos/lib/files'
import { PEOPLE, fmtMoney, type Job, type PersonKey, type Tone } from '@/tileos/data/model'
import { GROUTS, JOINTS, byTag, type Tile, type Surface } from '@/tileos/data/jobs'
import { METHODS, type MethodKey } from '@/tileos/data/takeoff'
import { timeLabel } from '@/tileos/data/calendar'
import { TODAY, labelFromIso, isoFromLabel } from '@/tileos/lib/today'
import { stepsFor, stepCounts, markStep, reopenStep, skipStep, setStepOwner, setStepDue, setCompanyStepOwner, companySteps, markTileOrdered, checkInTile, sendRevisedQty, setSiteCheck, sendSiteProblems, waitOnStep, stopWaiting, materialsCame, materialsLate, logChanges, estimatorFor, takesTile, SITE_CHECKS, PHASES, CHANGE_KINDS, type StepView } from './steps'
import { insidePeople, AddStep, StepIcon } from './steps-ui'
import { patchTile, setTileOn, readPhoto, refKey } from './tiles'
import { methodOf, suggestMethod, methodsFor, takeoff, materialStatus, qtyLabel } from './takeoff'
import { confirmSetting } from './setting'
import { heightStatus, isWall } from './heights'
import { installerOf, crewFree } from './upcoming'
import { pickInstaller, sendDraftIPO, setSurfaceTile } from './flows2'
import { createInvoice, recordPayment, matBy, acceptIPO } from './flows'
import { addEvent, removeEvent, moveEvent } from './calendar'
import { isOff } from './active'
import { poRatio, type Ratio } from './poratio'
import { PaperRead } from './paperread'
import { SFChip, AddSurfaceButton, AddRoomButton } from './roomedit'

/* ---------------- words ---------------- */
/** what the step is, said plainly — the title of its window */
const TITLE: Record<string, string> = {
  getpaper: 'Get the tile paperwork from the store',
  rooms: 'Enter the tile paperwork',
  qty: 'Quantities on the paperwork',
  design: 'Design meeting',
  change: 'Is the estimate still right?',
  tile: 'Grout and a picture for every tile',
  layouts: 'Layouts',
  heights: 'Site check',
  setup: 'Underlayment and setup',
  installer: 'Installer and his PO',
  walk: 'Show the installer the job',
  confirmed: 'Installer confirmed',
  materials: 'Order our materials',
  matin: 'Our materials delivered',
  order: 'Tile delivery date',
  delivered: 'Tile delivered',
  deposit: 'Deposit',
}
/** what to do, said the way you'd say it — the line on Today and on the project */
export const TODO: Record<string, string> = {
  getpaper: 'Get the tile paperwork from the store',
  rooms: 'Enter the tile paperwork',
  qty: 'Check the quantities on the paperwork',
  design: 'Set up the design meeting',
  change: 'Did the meeting change the estimate?',
  tile: 'Pick the grout and pictures',
  layouts: 'Draw the layouts',
  heights: 'Site check — heights, water, electrical, plumbing',
  setup: 'Decide the underlayment and setup',
  installer: 'Pick the installer and send his PO',
  walk: 'Show the installer the job',
  confirmed: 'Get the installer’s yes',
  materials: 'Order our materials',
  matin: 'Did our materials come?',
  order: 'Get the tile delivery date',
  delivered: 'Check in the tile',
  deposit: 'Invoice the deposit',
}
/** one line under the title: what this step is for */
const WHAT: Record<string, string> = {
  getpaper: 'Ask the tile store for the paperwork — what they’re sending, how much of each. Upload it here when it comes.',
  rooms: 'Upload it and AI reads it: every tile matched to the walls and floors from the estimate. Fix what it got wrong, pick what it couldn’t.',
  qty: 'Is there enough of every tile, with the extra for cuts? Short — send them the right quantities, and it waits for the new paperwork.',
  design: 'With the designer or the client — tile, layout, grout, patterns. Everyone who needs to be there gets it on their calendar.',
  change: 'After the meeting or the site walk: anything that changes the price — LED channels, a pattern, a bigger tile, an extra niche. It goes to the estimator.',
  tile: 'A grout and a picture for every tile — the installer’s sheet shows them.',
  layouts: 'Draw the layouts for what was picked at the meeting.',
  heights: 'Look at the site before we order: heights, water, electrical, plumbing.',
  setup: 'What every floor and wall is set on — underlayment, membrane, mud. Our materials are worked out from it.',
  installer: 'Pick who installs it and send him his PO — the meter shows it against the estimate.',
  walk: 'Show the installer the job before he starts. Not every job needs it.',
  confirmed: 'He took the PO and the dates. Until he says yes, it comes back on the list to call him.',
  materials: 'Setting materials, worked out from the setup and the square feet.',
  matin: 'On the day it’s due, it’s on the list of whoever ordered it: did it come?',
  order: 'Find out when the store delivers the tile, and who checks it in.',
  delivered: 'Count the boxes when it comes.',
  deposit: 'Invoice it in QuickBooks, then mark it here. A missing deposit is a warning, not a stop.',
}
export const todoOf = (v: StepView) =>
  v.key === 'deposit' && v.state === 'wait' ? 'Deposit payment'
    : v.key === 'qty' && v.state === 'bad' ? 'Send the revised quantities'
      : v.key === 'confirmed' && v.state !== 'later' && v.due && v.due <= TODAY ? 'Did the installer say yes?'
        : v.state === 'now' && v.due && v.due <= TODAY && /^Asked /.test(v.note || '') ? `Follow up · ${v.short.toLowerCase()}`
          : TODO[v.key] || v.label

export function openStep(jobId: string, k: string) { useStore.getState().open({ t: 'step', jobId, k }) }

/** where a step stands, in words */
function stateWords(v: StepView, me: PersonKey): { text: string; tone: Tone } {
  if (v.state === 'done') return { text: `Done${v.doneOn ? ` ${v.doneOn}` : ''}${v.doneBy ? ` · ${PEOPLE[v.doneBy]?.short}` : ''}`, tone: 'ok' }
  if (v.state === 'na') return { text: 'Not needed on this project', tone: 'neutral' }
  if (v.state === 'later') return { text: `Not yet — after ${v.waitsFor?.toLowerCase()}${v.waitsOn ? ` (${v.waitsOn === me ? 'you' : PEOPLE[v.waitsOn]?.short})` : ''}`, tone: 'neutral' }
  if (v.state === 'wait') return { text: 'Waiting', tone: 'warn' }
  if (v.state === 'bad') return { text: 'Problem', tone: 'bad' }
  return { text: v.owner === me ? 'Your turn' : `${PEOPLE[v.owner]?.short || 'Their'}’s turn`, tone: 'info' }
}

/* ================= the window ================= */
export function StepModal({ jobId, k, level }: { jobId: string; k: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const all = job ? stepsFor(s, job) : []
  const list = all.filter((x) => x.state !== 'na' || x.key === k)
  const i = list.findIndex((x) => x.key === k)
  const v = list[i]
  if (!job || !v) return null
  const me = meOf(s.role)
  const go = (x?: StepView) => { if (x) s.swap({ t: 'step', jobId, k: x.key }) }
  const c = stepCounts(all)
  const word = stateWords(v, me)
  const dated = !['order', 'delivered', 'design', 'walk', 'matin', 'confirmed'].includes(v.key)
  const opens = all.filter((x) => x.after.includes(v.key) && x.state !== 'na')
  return (
    <Modal
      level={level}
      size="xl"
      onClose={s.close}
      className="h-[min(50rem,92vh)] max-sm:h-[94dvh]"
      title={`${job.name} — getting ready`}
      sub={`${c.done} of ${c.total} steps done${c.bad ? ` · ${c.bad} with a problem` : ''}`}
      bodyClass="flex min-h-0 overflow-hidden p-0"
      footer={<Foot job={job} v={v} prev={list[i - 1]} next={list[i + 1]} go={go} />}
    >
      <Rail list={list} at={v.key} go={go} me={me} />
      <div key={v.key} className="scroll-soft min-w-0 flex-1 overflow-y-auto px-7 py-6 max-md:px-5 max-sm:px-4 max-sm:py-4">
        <PhonePicker list={list} at={i} go={go} />
        <div className="flex items-start gap-3">
          <span className="mt-1"><StepIcon state={v.state} size={26} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[1.375rem] font-semibold leading-tight tracking-[-0.01em] text-ink max-sm:text-[1.1875rem]">{TITLE[v.key] || v.label}</h3>
            <div className={cn('mt-1 text-[0.90625rem] font-semibold', word.tone === 'ok' ? 'text-ok-700' : word.tone === 'warn' ? 'text-warn-700' : word.tone === 'bad' ? 'text-bad-700' : word.tone === 'info' ? 'text-brand-700' : 'text-muted')}>
              {word.text}{(v.state === 'wait' || v.state === 'bad' || v.state === 'now') && v.note ? <span className="font-normal text-ink-2"> — {v.note}</span> : null}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Who job={job} v={v} />
          {dated && v.state !== 'done' && v.state !== 'na' && <When job={job} v={v} />}
        </div>
        <UsualOwner v={v} />
        {WHAT[v.key] && v.state !== 'done' && <p className="mt-4 text-[0.875rem] leading-snug text-muted">{WHAT[v.key]}</p>}
        <div className="mt-5"><Body job={job} v={v} /></div>
        {opens.length > 0 && (
          <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-wash px-4 py-3 text-[0.84375rem] text-ink-2">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
            <span>{v.state === 'done' ? 'This opened ' : 'When this is done, it opens '}{opens.map((x, n) => <React.Fragment key={x.key}>{n > 0 && (n === opens.length - 1 ? ' and ' : ', ')}<button onClick={() => go(x)} className="font-semibold text-ink hover:text-brand-700">{x.short.toLowerCase()}</button> for {x.owner === me ? 'you' : PEOPLE[x.owner]?.short}</React.Fragment>)} — {opens.length === 1 ? 'it goes' : 'they go'} on {opens.every((x) => x.owner === me) ? 'your' : 'their'} Today by {opens.length === 1 ? 'itself' : 'themselves'}.</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** every step down the side, by name — same size whichever one you're on */
function Rail({ list, at, go, me }: { list: StepView[]; at: string; go: (x?: StepView) => void; me: PersonKey }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { ref.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest' }) }, [at])
  return (
    <nav ref={ref} aria-label="Steps" className="scroll-soft flex w-[17rem] shrink-0 flex-col overflow-y-auto border-r border-line bg-[#fafbfc] max-md:hidden">
      <div className="flex-1 py-2">
        {PHASES.map((ph) => {
          const items = list.filter((x) => x.phase === ph.key)
          if (!items.length) return null
          return (
            <div key={ph.key} className="pb-1.5">
              <div className="px-4 pb-1 pt-2.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-muted">{ph.label}</div>
              {items.map((x) => (
                <button
                  key={x.key}
                  aria-current={x.key === at ? 'step' : undefined}
                  onClick={() => go(x)}
                  className={cn('flex h-10 w-full items-center gap-2.5 px-4 text-left transition', x.key === at ? 'bg-white shadow-[inset_0.1875rem_0_0_#2650cf]' : 'hover:bg-white/70')}
                >
                  <StepIcon state={x.state} size={20} />
                  <span className={cn('min-w-0 flex-1 truncate text-[0.84375rem] font-semibold', x.key === at ? 'text-ink' : x.state === 'done' || x.state === 'na' || x.state === 'later' ? 'text-muted' : 'text-ink-2')}>{x.short}</span>
                  <Tip label={`${x.owner === me ? 'You' : PEOPLE[x.owner]?.name}`}><span><Avatar who={x.owner} size={20} /></span></Tip>
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <Legend className="border-t border-line-2 px-4 py-2.5" />
    </nav>
  )
}
/** what the marks mean — the same everywhere */
export function Legend({ className }: { className?: string }) {
  const items: [StepView['state'], string][] = [['done', 'Done'], ['now', 'To do'], ['wait', 'Waiting'], ['bad', 'Problem'], ['later', 'Not yet']]
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.71875rem] font-medium text-muted', className)}>
      {items.map(([st, l]) => <span key={st} className="inline-flex items-center gap-1.5"><StepIcon state={st} size={14} />{l}</span>)}
    </div>
  )
}
/** on a phone: which step, and the list to jump to another */
function PhonePicker({ list, at, go }: { list: StepView[]; at: number; go: (x?: StepView) => void }) {
  return (
    <div className="mb-4 md:hidden">
      <Menu align="start" width={320} trigger={
        <button className="flex h-11 w-full items-center gap-2.5 rounded-[0.625rem] border border-line bg-white px-3 text-left">
          <StepIcon state={list[at].state} size={20} />
          <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">Step {at + 1} of {list.length} · {list[at].short}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
        </button>
      }>
        {PHASES.map((ph) => {
          const items = list.filter((x) => x.phase === ph.key)
          if (!items.length) return null
          return (
            <React.Fragment key={ph.key}>
              <MenuLabel>{ph.label}</MenuLabel>
              {items.map((x) => <MenuItem key={x.key} icon={<StepIcon state={x.state} size={18} />} checked={x.key === list[at].key} hint={PEOPLE[x.owner]?.short} onSelect={() => go(x)}>{x.short}</MenuItem>)}
            </React.Fragment>
          )
        })}
      </Menu>
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

function Foot({ job, v, prev, next, go }: { job: Job; v: StepView; prev?: StepView; next?: StepView; go: (x?: StepView) => void }) {
  const s = useStore()
  const rec = s.stepRecs[job.id]?.[v.key]
  const reopenable = v.custom || ['getpaper', 'rooms', 'qty', 'heights', 'design', 'walk', 'order', 'delivered', 'change', 'layouts', 'matin', 'confirmed'].includes(v.key)
  return (
    <>
      {v.state === 'na' ? <Button variant="ghost" onClick={() => skipStep(job.id, v.key, false)}>Needed after all</Button>
        : v.state === 'done' ? (reopenable && rec?.done ? <Button variant="ghost" onClick={() => reopenStep(job.id, v.key)}>Not done after all</Button> : null)
          : rec?.wait ? <Button variant="ghost" onClick={() => stopWaiting(job.id, v.key)}>Not waiting any more</Button>
            : <Button variant="ghost" onClick={() => skipStep(job.id, v.key, true)}>Not needed on this project</Button>}
      <span className="ml-auto" />
      {prev && <Button variant="ghost" icon={<ChevronLeft />} onClick={() => go(prev)}>Back</Button>}
      {next && <Button iconRight={<ChevronRight />} onClick={() => go(next)}><span className="max-w-[12rem] truncate">Next: {next.short}</span></Button>}
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

/** waiting on someone outside — who, and the day it comes back */
function WaitFor({ job, k, who, label = 'Asked them — waiting' }: { job: Job; k: string; who: string; label?: string }) {
  const [open, setOpen] = React.useState(false)
  const [on, setOn] = React.useState(who)
  const [back, setBack] = React.useState('Tomorrow')
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={360} trigger={<Button icon={<Hourglass />}>{label}</Button>}>
      <div className="text-[0.875rem] font-semibold text-ink">Waiting on</div>
      <TextInput className="mt-2" value={on} onChange={(e) => setOn(e.target.value)} placeholder="The tile store, the GC…" />
      <div className="mt-3 text-[0.875rem] font-semibold text-ink">Back on your list</div>
      <div className="mt-2"><DatePresets value={back} onPick={setBack} presets={['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} /></div>
      <div className="mt-3 flex justify-end"><Button variant="primary" disabled={!on.trim()} onClick={() => { waitOnStep(job.id, k, on.trim(), back); setOpen(false) }}>Save</Button></div>
    </Pop>
  )
}

function Body({ job, v }: { job: Job; v: StepView }) {
  switch (v.key) {
    case 'getpaper': return <GetPaper job={job} v={v} />
    case 'rooms': return <EnterPaper job={job} v={v} />
    case 'qty': return <Quantities job={job} v={v} />
    case 'tile': return <Selections job={job} />
    case 'design':
    case 'walk': return <Meeting job={job} v={v} />
    case 'change': return <EstimateCheck job={job} v={v} />
    case 'installer': return <Installer job={job} />
    case 'confirmed': return <Confirmed job={job} v={v} />
    case 'setup': return <Setup job={job} v={v} />
    case 'order': return <Order job={job} v={v} />
    case 'deposit': return <Deposit job={job} />
    case 'heights': return <SiteCheck job={job} v={v} />
    case 'materials': return <Materials job={job} />
    case 'matin': return <MaterialsIn job={job} v={v} />
    case 'delivered': return <Delivered job={job} v={v} />
  }
  return <Custom job={job} v={v} />
}

/* ================= the tile paperwork: get it, enter it, check the quantities ================= */
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
const PAPER_OK = (f: File) => /pdf|image/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name)

/** 1 · someone gets the paperwork from the store and puts it here */
function GetPaper({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const input = React.useRef<HTMLInputElement>(null)
  const [over, setOver] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const kept = s.files.filter((f) => f.jobId === job.id && f.kind === 'paperwork')
  const up = async (list: File[]) => {
    const files = list.filter(PAPER_OK)
    if (!files.length) { toast('Pick a PDF or photos of the paperwork'); return }
    setBusy(true)
    try { await keepFiles(job.id, files, 'paperwork') } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-col gap-4">
      {kept.length > 0 && (
        <Block title="The paperwork" right={`${kept.length} file${kept.length === 1 ? '' : 's'}`}>
          {kept.map((f) => (
            <button key={f.id} onClick={() => openFile(f)} className="flex w-full items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left first:border-t-0 hover:bg-wash/60">
              <FileText className="h-4 w-4 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">{f.name}</span>
              <span className="shrink-0 text-[0.78125rem] text-muted">{f.at} · {sizeLabel(f.size)}</span>
            </button>
          ))}
        </Block>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void up(Array.from(e.dataTransfer.files || [])) }}
        className={cn('flex items-center gap-4 rounded-xl border-2 border-dashed px-4 py-4 transition max-sm:flex-wrap', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d5dbe3] bg-[#fafbfc]')}
      >
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-xs"><Upload className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.90625rem] font-semibold text-ink">{kept.length ? 'Newer paperwork? Upload it too' : 'Upload the paperwork when it comes'}</span>
          <span className="block text-[0.8125rem] text-muted">PDF or photos. It stays with the project — the next person enters it from here.</span>
        </span>
        <Button size="sm" variant="primary" icon={<Upload />} disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Upload'}</Button>
        <input ref={input} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; void up(l) }} />
      </div>
      {v.state !== 'done' && (
        <Actions>
          <WaitFor job={job} k="getpaper" who="The tile store" label="Asked the store — waiting" />
          <Button icon={<Check />} onClick={() => markStep(job.id, 'getpaper', 'Got it — on paper', { close: true })}>Got it on paper</Button>
        </Actions>
      )}
    </div>
  )
}

/** 2 · the paperwork goes in: AI reads it, every tile matched to our walls and floors — and what isn't */
function EnterPaper({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const [allRooms, setAllRooms] = React.useState(false)
  if (!rooms.length) return (
    <div className="flex flex-col gap-4">
      <Block title="What we’re tiling" right={<AddRoomButton jobId={job.id} have={[]} />}><Quiet>No rooms yet — they come from the estimate. Add them here, one room at a time.</Quiet></Block>
    </div>
  )
  const tiles = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const flat = flatOf(s, job.id)
  const tiled = flat.filter((f) => takesTile(f.x.name))
  const missing = tiled.filter((f) => !f.x.tile)
  const loose = tiles.filter((t) => !flat.some((f) => f.x.tile === t.tag))
  const totalSF = rooms.reduce((n, r) => n + r.surfaces.reduce((m, x) => m + (x.sf || 0), 0), 0)
  const shownRooms = allRooms ? rooms : rooms.slice(0, 3)
  return (
    <div className="flex flex-col gap-4">
      <PaperRead job={job} />
      <Block title="Tile on the paperwork" right={<Button size="xs" icon={<Plus />} onClick={() => s.open({ t: 'tile', jobId: job.id })}>Add a tile</Button>}>
        {!tiles.length && <Quiet>Upload the paperwork above — or add each tile by hand: its tag, its name, where it goes.</Quiet>}
        {tiles.map((t) => <TileWhere key={t.tag} job={job} t={t} loose={loose.includes(t)} />)}
      </Block>
      {missing.length > 0 && (
        <Block title={<span className="text-warn-800">Not matched yet — no tile</span>} right={`${missing.length} of ${tiled.length}`}>
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
      {!missing.length && tiled.length > 0 && tiles.length > 0 && <Good>Every wall and floor has its tile.</Good>}
      <Block title="What we’re tiling" right={<><span className="max-sm:hidden">{`${rooms.length} room${rooms.length === 1 ? '' : 's'} · ${totalSF.toLocaleString('en-US')} SF`}</span><AddRoomButton jobId={job.id} have={rooms.map((r) => r.name)} /></>}>
        {shownRooms.map((r) => {
          const sf = r.surfaces.reduce((n, x) => n + (x.sf || 0), 0)
          return (
            <div key={r.name} className="flex items-start gap-3 border-t border-line-2 px-4 py-2 first:border-t-0 max-sm:flex-wrap">
              <span className="w-[9.5rem] shrink-0 truncate pt-1 text-[0.84375rem] font-semibold text-ink max-sm:w-auto max-sm:flex-1">{r.name}</span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1.5 max-sm:order-last max-sm:basis-full">
                {r.surfaces.map((x) => <SFChip key={x.name} jobId={job.id} room={r.name} x={x} />)}
                <AddSurfaceButton jobId={job.id} room={r.name} have={r.surfaces.map((x) => x.name)} />
              </span>
              <span className="shrink-0 pt-1 text-[0.8125rem] font-semibold tnum text-ink-2">{sf ? `${sf.toLocaleString('en-US')} SF` : '—'}</span>
            </div>
          )
        })}
        {rooms.length > 3 && <button onClick={() => setAllRooms(!allRooms)} className="w-full border-t border-line-2 px-4 py-2 text-left text-[0.8125rem] font-semibold text-brand-600 hover:bg-wash">{allRooms ? 'Show fewer' : `Show all ${rooms.length} rooms`}</button>}
      </Block>
      {v.state !== 'done' && tiles.length > 0 && missing.length > 0 && (
        <Actions><Button icon={<Check />} onClick={() => markStep(job.id, 'rooms', `Entered — ${missing.length} without a tile on this paperwork`, { close: true })}>Entered — the rest isn’t on this paperwork</Button></Actions>
      )}
    </div>
  )
}
/** one tile from the paperwork: what it is and which walls and floors it goes on */
function TileWhere({ job, t, loose }: { job: Job; t: Tile; loose?: boolean }) {
  const s = useStore()
  const flat = flatOf(s, job.id)
  const opts = flat.filter((f) => takesTile(f.x.name) || f.x.tile === t.tag).map((f) => ({ key: refKey({ room: f.room, surface: f.x.name }), label: `${f.room} · ${f.x.name}`, hint: f.x.tile && f.x.tile !== t.tag ? `Has ${f.x.tile} now` : f.x.sf ? `${f.x.sf} SF` : undefined }))
  const vals = flat.filter((f) => f.x.tile === t.tag).map((f) => refKey({ room: f.room, surface: f.x.name }))
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0">
      <TileImg tile={t} size={40} radius={8} />
      <div className="min-w-0 flex-1">
        <button onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} className="block max-w-full truncate text-left text-[0.875rem] font-semibold text-ink hover:text-brand-700">{t.tag} {t.name}{t.size ? <span className="font-normal text-muted"> · {t.size}</span> : null}{t.paper ? <span className="font-normal text-muted"> · {t.paper.qty.toLocaleString('en-US')} {unitWord(t.paper.unit, t.paper.qty)} on the paperwork</span> : null}</button>
        <MultiSelect values={vals} options={opts} label={`Where ${t.tag} goes`} placeholder="Where does it go?" width={360} className={cn('mt-1 min-h-8 py-1 text-[0.8125rem]', loose && 'border-warn-300 bg-warn-50/50')} onChange={(keys) => setTileOn(job.id, t.tag, keys.map((k) => { const [room, surface] = k.split('|'); return { room, surface } }))} summary={(p) => (p.length > 2 ? `${p[0].label} and ${p.length - 1} more` : p.map((o) => o.label).join(', '))} />
      </div>
      {loose && <Status tone="warn">Not on a wall or floor</Status>}
    </div>
  )
}

/** 3 · is there enough of every tile — short goes back to them with the right numbers */
function Quantities({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const [sending, setSending] = React.useState(false)
  const tiles = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const rows = tiles.map((t) => qtyRow(s, job.id, t)).filter((r) => r.on.length)
  const short = rows.filter((r) => r.short > 0)
  const sent = s.stepRecs[job.id]?.qty?.qty || s.stepRecs[job.id]?.rooms?.qty
  if (!rows.length) return <Block title="Each tile"><Quiet>After the tile is matched to the walls and floors — then each one shows what the paperwork has against what we need.</Quiet></Block>
  return (
    <div className="flex flex-col gap-4">
      {sent && v.state !== 'done' && <div className="rounded-xl bg-warn-50 px-4 py-3 text-[0.84375rem] text-warn-800">Revised quantities went to {sent.to} {sent.at}. When the new paperwork comes, put its numbers in — it checks itself.</div>}
      <Block title="What the paperwork has · what we need" right="with the extra for cuts">
        {rows.map((r) => <TileQty key={r.t.tag} job={job} r={r} />)}
      </Block>
      {v.state === 'done' && <Good>{v.note || 'Enough of every tile'}</Good>}
      {v.state !== 'done' && !sending && short.length > 0 && (
        <Actions>
          <span className="mr-auto text-[0.84375rem] font-semibold text-bad-700">{short.length === 1 ? `${short[0].t.tag} is short` : `${short.length} tiles are short`}</span>
          <Button onClick={() => markStep(job.id, 'qty', 'Short — kept as it is', { close: true })}>Keep it as it is</Button>
          <Button variant="primary" icon={<Send />} onClick={() => setSending(true)}>Send revised quantities</Button>
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

/* ================= grout and a picture for every tile ================= */
function Selections({ job }: { job: Job }) {
  const s = useStore()
  const tiles = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const flat = flatOf(s, job.id)
  return (
    <div className="flex flex-col gap-4">
      {!tiles.length && <PaperRead job={job} />}
      <Block title="Each tile" right={<Button size="xs" icon={<Plus />} onClick={() => s.open({ t: 'tile', jobId: job.id })}>Add a tile</Button>}>
        {!tiles.length && <Quiet>No tiles yet — add them from the tile paperwork.</Quiet>}
        {tiles.map((t) => <TilePick key={t.tag} job={job} t={t} n={flat.filter((f) => f.x.tile === t.tag).length} />)}
      </Block>
      {tiles.length > 0 && tiles.every((t) => t.grout && (t.photo || t.swatch)) && <Good>Every tile has its grout and a picture.</Good>}
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

/* ================= the design meeting, showing the installer the job ================= */
const TIMES = Array.from({ length: 23 }, (_, i) => 7 * 60 + i * 30)
/** who's in it from our side — the design meeting goes on the site manager's and the owner's calendars too */
function meetingPeople(s: Store, v: StepView): PersonKey[] {
  const site = s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key as PersonKey | undefined
  const boss = meOf('owner')
  return Array.from(new Set([v.owner, ...(v.key === 'design' ? [site, boss] : [])].filter(Boolean))) as PersonKey[]
}
function Meeting({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const walk = v.key === 'walk'
  const ev = s.events
    .filter((e) => e.jobId === job.id && (walk ? e.kind === 'walkthrough' && /installer|crew/i.test(`${e.title} ${e.with || ''}`) : /design/i.test(e.title)))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
    .pop()
  const crew = installerOf(s, job)
  const [edit, setEdit] = React.useState(!ev)
  const [day, setDay] = React.useState(ev ? labelFromIso(ev.date) : 'Tomorrow')
  const [time, setTime] = React.useState(ev?.start ?? 10 * 60)
  const [withWho, setWith] = React.useState(ev?.with ?? (walk ? (crew ? PEOPLE[crew].name : '') : 'The designer'))
  const [who, setWho] = React.useState<PersonKey[]>(() => ev?.people?.length ? ev.people : meetingPeople(s, v))
  const [notes, setNotes] = React.useState('')
  const done = v.state === 'done'
  const people = insidePeople(s)
  const save = () => {
    const iso = isoFromLabel(day) || TODAY
    if (ev) moveEvent(ev.id, { date: iso, start: time, people: who, with: withWho.trim() || undefined })
    else addEvent({ jobId: job.id, kind: walk ? 'walkthrough' : 'meeting', title: walk ? 'Walkthrough with the installer' : 'Design meeting', date: iso, start: time, dur: 60, people: who.length ? who : [v.owner], with: withWho.trim() || undefined, plan: true } as any)
    setEdit(false)
  }
  if (ev && !edit) {
    const past = ev.date <= TODAY
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 max-sm:flex-wrap">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><CalendarDays className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.9375rem] font-semibold text-ink">{labelFromIso(ev.date)} · {timeLabel(ev.start)}</div>
            <div className="truncate text-[0.8125rem] text-muted">{[ev.with ? `With ${ev.with}` : '', ev.people.map((p) => PEOPLE[p]?.short).filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</div>
          </div>
          {!done && (
            <span className="flex shrink-0 gap-1.5">
              <Button size="sm" onClick={() => setEdit(true)}>Move it</Button>
              <Button size="sm" variant="ghost" onClick={() => removeEvent(ev.id)}>Cancel it</Button>
            </span>
          )}
        </div>
        {!done && past && (
          <>
            <Field label={walk ? 'Anything he needs to know (optional)' : 'What was decided (optional)'}>
              <TextArea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={walk ? 'Where to start, what to watch out for' : 'Tile, layout, grout — anything that changed'} />
            </Field>
            <Actions><Button variant="primary" icon={<Check />} onClick={() => markStep(job.id, v.key, notes.trim() || undefined, { close: !walk ? false : true })}>It happened</Button></Actions>
          </>
        )}
        {!done && !past && <div className="text-[0.84375rem] text-muted">It’s on {ev.people.map((p) => PEOPLE[p]?.short).filter(Boolean).join(', ')}’s calendar and Today that day. After it happens, mark it done here{walk ? '' : ' — then say if anything changed from the estimate'}.</div>}
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
      <Field label="Who from us — it goes on their calendar and Today, and they’re told">
        <div className="flex flex-wrap gap-1.5">
          {people.map((p) => {
            const on = who.includes(p)
            return <button key={p} type="button" aria-pressed={on} onClick={() => setWho(on ? who.filter((x) => x !== p) : [...who, p])} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border pl-1 pr-3 text-[0.8125rem] font-medium transition', on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}><Avatar who={p} size={26} />{PEOPLE[p]?.short}{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</button>
          })}
        </div>
      </Field>
      <Actions>
        {ev && <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>}
        {!ev && !done && <Button onClick={() => markStep(job.id, v.key, 'Done outside the calendar', { close: true })}>It already happened</Button>}
        <Button variant="primary" icon={<CalendarDays />} disabled={!who.length} onClick={save}>{ev ? 'Save the new time' : walk ? 'Set the walkthrough' : 'Set the meeting'}</Button>
      </Actions>
    </div>
  )
}

/* ================= after the meeting: is the estimate still right? ================= */
function EstimateCheck({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const rec = s.stepRecs[job.id]?.change
  const [items, setItems] = React.useState<{ what: string; where?: string; note?: string }[]>([])
  const [what, setWhat] = React.useState('')
  const [where, setWhere] = React.useState('')
  const [note, setNote] = React.useState('')
  const to = estimatorFor(s, job.id)
  if (v.state === 'done')
    return rec?.changes?.length ? (
      <Block title="What changed" right={`sent to ${PEOPLE[to]?.short}`}>
        {rec.changes.map((c, n) => <div key={n} className="border-t border-line-2 px-4 py-2.5 text-[0.875rem] text-ink first:border-t-0"><b className="font-semibold">{c.what}</b>{c.where ? <span className="text-muted"> · {c.where}</span> : null}{c.note ? <span className="block text-[0.8125rem] text-muted">{c.note}</span> : null}</div>)}
      </Block>
    ) : <Good>{v.note || 'Nothing changed — same as the estimate'}</Good>
  const add = () => { if (!what.trim()) return; setItems([...items, { what: what.trim(), where: where || undefined, note: note.trim() || undefined }]); setWhat(''); setWhere(''); setNote('') }
  return (
    <div className="flex flex-col gap-4">
      {!items.length && (
        <button onClick={() => markStep(job.id, 'change', 'Nothing changed — same as the estimate', { close: true })} className="flex items-center gap-3 rounded-xl border border-ok-200 bg-ok-50/60 px-4 py-3.5 text-left transition hover:bg-ok-50">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ok-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[0.9375rem] font-semibold text-ink">Nothing changed</span><span className="block text-[0.8125rem] text-muted">It’s the same as the estimate</span></span>
        </button>
      )}
      <Block title={items.length ? `What changed · ${items.length}` : 'Something changed — log it'}>
        {items.map((c, n) => (
          <div key={n} className="flex items-start gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0">
            <span className="min-w-0 flex-1 text-[0.875rem] text-ink"><b className="font-semibold">{c.what}</b>{c.where ? <span className="text-muted"> · {c.where}</span> : null}{c.note ? <span className="block text-[0.8125rem] text-muted">{c.note}</span> : null}</span>
            <button aria-label={`Take off ${c.what}`} onClick={() => setItems(items.filter((_, i) => i !== n))} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint hover:bg-bad-50 hover:text-bad-600"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <div className={cn('px-4 py-3', items.length > 0 && 'border-t border-line-2')}>
          <div className="flex flex-wrap gap-1.5">
            {CHANGE_KINDS.map((k) => <button key={k} type="button" aria-pressed={what === k} onClick={() => setWhat(what === k ? '' : k)} className={cn('inline-flex h-8 items-center rounded-full border px-3 text-[0.8125rem] font-medium transition', what === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}>{k}</button>)}
          </div>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_14rem] gap-2 max-sm:grid-cols-1">
            <TextInput mic value={what} onChange={(e) => setWhat(e.target.value)} placeholder="What changed — or pick one above" aria-label="What changed" className="h-10" />
            <Menu align="end" width={260} trigger={<button className="inline-flex h-10 items-center justify-between gap-2 rounded-[0.625rem] border border-line bg-white px-3 text-[0.875rem] text-ink-2 hover:border-[#cbd1d9]"><span className="truncate">{where || 'Where'}</span><ChevronDown className="h-4 w-4 shrink-0 text-faint" /></button>}>
              <MenuLabel>Where</MenuLabel>
              {['Whole project', ...rooms.map((r) => r.name)].map((r) => <MenuItem key={r} checked={where === r} onSelect={() => setWhere(r)}>{r}</MenuItem>)}
            </Menu>
          </div>
          <div className="mt-2"><TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How much, how big — what the estimator needs to price it (optional)" aria-label="Note" className="min-h-[4rem]" /></div>
          <div className="mt-2 flex justify-end"><Button size="sm" icon={<Plus />} disabled={!what.trim()} onClick={add}>Add it</Button></div>
        </div>
      </Block>
      {items.length > 0 && <Actions><Button variant="primary" icon={<Send />} onClick={() => logChanges(job.id, items)}>Send to {PEOPLE[to]?.short || 'the estimator'} to update the estimate</Button></Actions>}
    </div>
  )
}

/* ================= his yes ================= */
function Confirmed({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const b = s.bookings.find((x) => x.jobId === job.id)
  if (!ipo || ipo.status === 'Draft') return v.state === 'done' ? <Good>{v.note || 'Confirmed'}</Good> : <Block title="His yes"><Quiet>After his PO goes out — then it waits for his yes, and comes back on the list to call him.</Quiet></Block>
  if (ipo.status === 'Rejected') return <div className="rounded-xl bg-bad-50 px-4 py-3 text-[0.84375rem] font-medium text-bad-700">{PEOPLE[ipo.crew].short} turned it down{ipo.reason ? ` — ${ipo.reason.toLowerCase()}` : ''}. Pick someone else on “Installer PO”.</div>
  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => s.open({ t: 'ipo', id: ipo.id })} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition hover:border-[#cbd1d9] hover:bg-wash/50">
        <Avatar who={ipo.crew} size={38} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-ink">{PEOPLE[ipo.crew].name}</span>
          <span className={cn('block text-[0.8125rem]', ipo.status === 'Accepted' ? 'text-ok-700' : 'text-warn-700')}>{ipo.id} · {ipo.status === 'Accepted' ? `took it ${ipo.date}` : 'sent — waiting for his yes'}{b ? ` · ${labelFromIso(b.start)} – ${labelFromIso(b.end)}` : ''}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </button>
      {ipo.status === 'Sent' && v.state !== 'done' && (
        <Actions>
          <WaitFor job={job} k="confirmed" who={PEOPLE[ipo.crew].short} label="Called him — waiting" />
          <Button variant="primary" icon={<Check />} onClick={() => acceptIPO(ipo.id)}>He said yes</Button>
        </Actions>
      )}
    </div>
  )
}

/* ================= our materials come ================= */
function MaterialsIn({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const open = s.pos.filter((p) => p.jobId === job.id && p.step >= 1 && p.step < 3)
  const [late, setLate] = React.useState(false)
  const [when, setWhen] = React.useState('Tomorrow')
  if (!open.length) return v.state === 'done' ? <Good>{v.note || 'On site'}</Good> : <Block title="Our orders"><Quiet>After the order goes out — the day it’s due, it’s on the list of whoever ordered it: did it come?</Quiet></Block>
  return (
    <div className="flex flex-col gap-4">
      <Block title="On the way" right={`${open.length} order${open.length === 1 ? '' : 's'}`}>
        {open.map((p) => (
          <button key={p.id} onClick={() => s.open({ t: 'po', id: p.id })} className="flex w-full items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left first:border-t-0 hover:bg-wash/60">
            <Truck className="h-4 w-4 shrink-0 text-faint" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-semibold text-ink">{p.id} · {p.supplier}</span><span className="block truncate text-[0.78125rem] text-muted">{p.what}</span></span>
            <span className={cn('shrink-0 text-[0.8125rem] font-semibold', p.late ? 'text-bad-600' : 'text-ink-2')}>{p.eta ? `Due ${p.eta.replace(/^Due\s+/i, '')}` : 'No date yet'}</span>
          </button>
        ))}
      </Block>
      {!late ? (
        <Actions>
          <Button icon={<PackageX />} onClick={() => s.open({ t: 'record', jobId: job.id, type: 'shortage' })}>Short or wrong</Button>
          <Button onClick={() => setLate(true)}>Not here yet</Button>
          <Button variant="primary" icon={<PackageCheck />} onClick={() => materialsCame(job.id)}>It all came</Button>
        </Actions>
      ) : (
        <div className="rounded-xl border border-line p-4">
          <div className="text-[0.875rem] font-semibold text-ink">When is it coming now?</div>
          <div className="mt-2"><DatePresets value={when} onPick={setWhen} presets={['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} /></div>
          <div className="mt-3 flex justify-end gap-2"><Button variant="ghost" onClick={() => setLate(false)}>Cancel</Button><Button variant="primary" onClick={() => materialsLate(job.id, when)}>Save</Button></div>
        </div>
      )}
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

/* ================= the game plan — on the project ================= */
const DOT: Record<string, string> = { bad: 'bg-bad-500', now: 'bg-brand-600', mine: 'bg-brand-600', wait: 'bg-warn-500', ev: 'bg-vio-500', task: 'bg-brand-400' }
/** every step, grouped the way the work goes — one line each: where it stands, in words; who has it; when */
export function GamePlan({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const [adding, setAdding] = React.useState(false)
  const steps = stepsFor(s, job)
  const c = stepCounts(steps)
  const start = s.prep[job.id]?.targetISO
  const stepTasks = new Set(steps.map((v) => v.taskId).filter(Boolean))
  const tasks = s.tasks.filter((t) => t.jobId === job.id && (t.state === 'now' || t.state === 'waiting') && !stepTasks.has(t.id) && !t.step)
  const meets = s.events.filter((e) => e.jobId === job.id && e.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start).slice(0, 3)
  const mine = steps.filter((v) => (v.state === 'now' || v.state === 'bad') && v.owner === me).length
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 max-sm:px-4">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold text-ink">Getting ready <span className="ml-1 text-[0.8125rem] font-semibold text-muted">{c.done} of {c.total} done</span></h3>
          <div className="text-[0.78125rem] text-muted">{start ? `Starts ${labelFromIso(start)} · ` : ''}each step goes on its person’s Today when the one before it is done{mine ? ` · ${mine} for you` : ''}</div>
        </div>
        <Legend className="ml-auto max-sm:ml-0" />
      </header>
      {PHASES.map((ph) => {
        const items = steps.filter((v) => v.phase === ph.key)
        if (!items.length) return null
        const d = items.filter((v) => v.state === 'done' || v.state === 'na').length
        return (
          <div key={ph.key}>
            <div className="flex items-center gap-2 border-t border-line-2 bg-[#f8f9fb] px-5 py-1.5 first:border-t-0 max-sm:px-4">
              <span className="text-[0.71875rem] font-bold uppercase tracking-[0.06em] text-muted">{ph.label}</span>
              <span className={cn('text-[0.71875rem] font-semibold', d === items.length ? 'text-ok-700' : 'text-faint')}>{d === items.length ? 'all done' : `${d} of ${items.length}`}</span>
            </div>
            {items.map((v) => <PlanRow key={v.key} job={job} v={v} me={me} />)}
          </div>
        )
      })}
      {(tasks.length > 0 || meets.length > 0) && (
        <>
          <div className="border-t border-line-2 bg-[#f8f9fb] px-5 py-1.5 text-[0.71875rem] font-bold uppercase tracking-[0.06em] text-muted max-sm:px-4">Also on this project</div>
          {tasks.map((t) => <NextRow key={t.id} dot={t.state === 'waiting' ? 'wait' : 'task'} title={t.title.replace(new RegExp(`\\s*[—·-]\\s*${job.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '')} sub={t.state === 'waiting' ? `Waiting on ${t.waitingOn}${t.followUp ? ` · back ${t.followUp}` : ''}` : undefined} who={t.owner} mine={t.owner === me} when={t.state === 'waiting' ? 'Waiting' : t.due || ''} onClick={() => s.open({ t: 'task', id: t.id })} />)}
          {meets.map((e) => <NextRow key={e.id} dot="ev" title={e.title} sub={e.with ? `With ${e.with}` : undefined} who={e.people[0]} mine={e.people.includes(me)} when={`${labelFromIso(e.date)} ${timeLabel(e.start)}`} onClick={() => s.open({ t: 'event', id: e.id })} />)}
        </>
      )}
      {adding ? <AddStep job={job} steps={steps} onDone={() => setAdding(false)} compact /> : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 border-t border-line-2 px-5 py-2.5 text-left text-[0.8125rem] font-semibold text-muted transition hover:bg-wash hover:text-ink max-sm:px-4"><Plus className="h-4 w-4" />Add a step for this project</button>
      )}
    </section>
  )
}
function PlanRow({ job, v, me }: { job: Job; v: StepView; me: PersonKey }) {
  const quiet = v.state === 'done' || v.state === 'na'
  const sub = v.state === 'later' ? `After ${v.waitsFor?.toLowerCase()}${v.waitsOn ? ` · ${v.waitsOn === me ? 'you' : PEOPLE[v.waitsOn]?.short}` : ''}`
    : v.state === 'done' ? (v.note || 'Done') : v.state === 'na' ? 'Not needed on this project' : v.note || ''
  const when = v.state === 'done' ? (v.doneOn ? `Done ${v.doneOn}` : 'Done') : v.state === 'na' || v.state === 'later' ? '' : v.due ? (v.state === 'wait' ? labelFromIso(v.due) : `Due ${labelFromIso(v.due)}`) : v.state === 'wait' ? 'Waiting' : ''
  const late = !!v.due && v.due < TODAY && (v.state === 'now' || v.state === 'bad')
  return (
    <button onClick={() => openStep(job.id, v.key)} className={cn('group flex w-full items-center gap-3 border-t border-line-2 px-5 py-2.5 text-left transition hover:bg-[#f8f9fb] max-sm:px-4', v.state === 'later' && 'bg-[#fcfcfd]')}>
      <StepIcon state={v.state} size={22} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[0.875rem] font-semibold max-sm:whitespace-normal max-sm:leading-snug', quiet ? 'text-muted' : v.state === 'later' ? 'text-ink-2' : 'text-ink')}>
          {v.label}{v.only && <span className="ml-2 text-[0.71875rem] font-medium text-faint">this project only</span>}
        </span>
        {sub && <span className={cn('block truncate text-[0.78125rem] max-sm:whitespace-normal max-sm:leading-snug', v.state === 'bad' ? 'font-medium text-bad-600' : v.state === 'wait' ? 'text-warn-700' : 'text-muted')}>{v.state === 'later' && <CornerDownRight className="mr-1 inline h-3 w-3 align-[-0.0625rem]" />}{sub}</span>}
      </span>
      <span className="flex w-[9.5rem] shrink-0 items-center gap-2 max-sm:w-auto">
        <Avatar who={v.owner} size={24} />
        <span className={cn('truncate text-[0.84375rem] max-sm:hidden', v.owner === me && !quiet ? 'font-semibold text-brand-700' : 'text-ink-2')}>{v.owner === me ? 'You' : PEOPLE[v.owner]?.short}</span>
      </span>
      <span className={cn('w-[5.5rem] shrink-0 text-right text-[0.8125rem] tnum max-sm:hidden', late ? 'font-semibold text-bad-600' : v.state === 'done' ? 'text-ok-700' : 'text-muted')}>{when}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:text-brand-600" />
    </button>
  )
}
function NextRow({ dot, title, sub, bad, who, mine, when, late, onClick }: { dot: string; title: string; sub?: string; bad?: boolean; who?: PersonKey; mine?: boolean; when?: string; late?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 border-t border-line-2 px-5 py-3 text-left transition first:border-t-0 hover:bg-[#f8f9fb] max-sm:px-4">
      <span className="inline-flex w-[1.375rem] shrink-0 justify-center"><span className={cn('h-2.5 w-2.5 rounded-full', DOT[dot])} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-semibold text-ink max-sm:whitespace-normal max-sm:leading-snug">{title}</span>
        {sub && <span className={cn('block truncate text-[0.78125rem] max-sm:whitespace-normal max-sm:leading-snug', bad ? 'font-medium text-bad-600' : 'text-muted')}>{sub}</span>}
      </span>
      {who && (
        <span className="flex w-[9.5rem] shrink-0 items-center gap-2 max-sm:w-auto">
          <Avatar who={who} size={24} />
          <span className={cn('truncate text-[0.84375rem] max-sm:hidden', mine ? 'font-semibold text-brand-700' : 'text-ink-2')}>{mine ? 'You' : PEOPLE[who]?.short}</span>
        </span>
      )}
      <span className={cn('w-[5.5rem] shrink-0 text-right text-[0.8125rem] tnum max-sm:hidden', late ? 'font-semibold text-bad-600' : 'text-muted')}>{when}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:text-brand-600" />
    </button>
  )
}
