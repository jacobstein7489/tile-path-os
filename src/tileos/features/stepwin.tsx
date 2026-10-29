/* One part of getting a project ready — the paperwork, the design meeting, the site, the installer, the deliveries —
 * in one window that never changes size, looking just like the part does on the project: its steps as circles on top,
 * like the estimate's path (✓ done, the one it's on, what comes after, whose each one is), and under them the one step
 * you picked with only what it needs — what it is, whose turn, when, the one or two things that finish it. Today, a
 * task or a link opens it; tap another circle and that step shows instead. */
import * as React from 'react'
import { Check, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Plus, Camera, Mail, Copy, Send, Truck, PackageCheck, PackageX, Ruler, Zap, Droplets, Wrench, HardHat, Plug, X, Sparkles, Clock3, Upload, FileText, Hourglass, Users, Lock, MoreHorizontal, Grid2x2 } from 'lucide-react'
import { useStore, meOf, addHist, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, TextArea, Field } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop, DatePresets, Tip } from '@/tileos/components/ui/overlay'
import { Status, Path, Circles, type CircleState, type CircleStep } from '@/tileos/components/ui/page'
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
import { mailLive, emailText } from './mailout'
import { stepsFor, stepCounts, markStep, reopenStep, skipStep, setStepOwner, setStepDue, markTileOrdered, checkInTile, sendRevisedQty, setSiteAnswer, siteFixed, siteRecheck, siteRooms, siteQuestions, siteProblem, waitOnStep, stopWaiting, tileNotYet, materialsCame, materialsLate, estimatorFor, takesTile, scopeLock, SITE_CHECKS, PHASES, type StepView, setFloorLevel, fracIn, floorRooms, isFloor, sendFloorProblems, setLaser, LASER_AT, LEVEL_OK, LEVEL_PREP } from './steps'
import { insidePeople, StepIcon } from './steps-ui'
import { patchTile, setTileOn, readPhoto, refKey } from './tiles'
import { methodOf, suggestMethod, methodsFor, takeoff, materialStatus, qtyLabel, GROUPS, type Group } from './takeoff'
import { confirmSetting } from './setting'
import { isWall } from './heights'
import { installerOf, crewFree } from './upcoming'
import { pickInstaller, sendDraftIPO, setSurfaceTile } from './flows2'
import { createInvoice, recordPayment, matBy, acceptIPO } from './flows'
import { addEvent, removeEvent, moveEvent } from './calendar'
import { isOff } from './active'
import { poRatio, type Ratio } from './poratio'
import { PaperRead } from './paperread'
import { AddRoomButton } from './roomedit'
import { LayoutsList, fillSuggestions } from './layout'
import { PrintSheetsButton, sheetRooms, sheetRows } from './roomsheets'
import { NoNote, SitePick, type SiteVal } from './answer'
import { HeightsInline } from './heights'
import { SiteChangeForm } from './field'
import { trackOf, TRACKS, stepShort, softWrap } from './tracks'

/* ---------------- words ---------------- */
/** what the step is, said plainly — the title of its window */
export const TITLE: Record<string, string> = {
  getpaper: 'Get the tile paperwork from the store',
  rooms: 'Enter the tile paperwork',
  qty: 'Check the quantities on the paperwork',
  design: 'Design meeting',
  change: 'Confirm the scope after the meeting',
  tile: 'Pick the tile and grout — a picture and the grout for every tile',
  layouts: 'Set the layouts',
  heights: 'Site check — on site',
  level: 'Floor levels — the high and low point of every floor',
  fixes: 'Fix what the site check found',
  sheets: 'Hang the room sheets',
  setup: 'Decide the underlayment — what every floor and wall is set on',
  installer: 'Pick the installer — send his PO',
  walk: 'Walk-through with the installer',
  confirmed: 'The installer accepts the PO',
  materials: 'Order our materials',
  matin: 'Receive our materials',
  order: 'Get the tile delivery date',
  delivered: 'Receive the tile — count it',
  deposit: 'Deposit',
}
/** what to do, said the way you'd say it — the line on Today and on the project */
export const TODO: Record<string, string> = {
  getpaper: 'Get the tile paperwork from the store',
  rooms: 'Enter the tile paperwork',
  qty: 'Check the quantities on the paperwork',
  design: 'Set up the design meeting',
  change: 'Confirm the scope — same as the estimate, or what changed',
  tile: 'Pick the tile and grout',
  layouts: 'Set the layouts',
  heights: 'Site check',
  fixes: 'Get what the site check found fixed',
  sheets: 'Print and hang the room sheets',
  level: 'Measure the floors — high and low',
  setup: 'Decide the underlayment',
  installer: 'Pick the installer and send his PO',
  walk: 'Walk-through with the installer',
  confirmed: 'Get the installer to accept',
  materials: 'Order our materials',
  matin: 'Did our materials come?',
  order: 'Get the tile delivery date',
  delivered: 'Receive the tile',
  deposit: 'Invoice the deposit',
}
/** one line under the title: what this step is for */
export const WHAT: Record<string, string> = {
  getpaper: 'Ask the tile store for the paperwork — what they’re sending, how much of each. Upload it here when it comes.',
  rooms: 'Upload it and AI reads it: every tile matched to the walls and floors from the estimate. Fix what it got wrong, pick what it couldn’t.',
  qty: 'Is there enough of every tile, with the extra for cuts? Short — send them the right quantities, and it waits for the new paperwork.',
  design: 'With the designer or the client — tile, layout, grout, patterns. Everyone who needs to be there gets it on their calendar.',
  change: 'After the design meeting: is it the same as the estimate? Say so in one tap. Something changed — a border, LED channels, a pattern, taller walls — each change becomes a change order: the estimator prices it, the client OKs it, and the tile and the installer’s PO follow.',
  tile: 'A grout and a picture for every tile — the installer’s sheet shows them.',
  layouts: 'The system suggests each one from the tile — the pattern, and where to start so there are no thin cuts. Tap one to see it drawn, change it or send it to the designer.',
  heights: 'On site, before we order: the whole site, then room by room. Some rooms miss something (2 of 3 drains)? Tap Some and pick them — each one goes to be fixed and comes back to you to check again.',
  fixes: 'What the site check found. Get each one fixed (the GC, the plumber…) — once it is, it goes back to the site manager to look at again on site.',
  sheets: 'One page for each room — its tiles, the grout, what every wall and floor is set on, and its layout drawn to scale. Print them and hang one in each room before the crew starts.',
  level: 'Every floor we tile: the high point and the low point off one laser line. The system says flat, self-leveler, or the GC’s to fix. A mud bed levels itself.',
  setup: 'What every floor and wall is set on — underlayment, membrane, mud. Our materials are worked out from it.',
  installer: 'Pick who installs it and send him his PO — the meter shows it against the estimate.',
  walk: 'Walk the job with the installer before he starts. Not every job needs it.',
  confirmed: 'He accepts the PO and the dates. Until he does, it comes back on the list to call him.',
  materials: 'Setting materials, worked out from the setup and the square feet.',
  matin: 'On the day it’s due, it’s on the list of whoever ordered it: did it come?',
  order: 'Find out when the store delivers the tile, and who checks it in.',
  delivered: 'Count the boxes when it comes.',
  deposit: 'Invoice it in QuickBooks, then mark it here. A missing deposit is a warning, not a stop.',
}
export const todoOf = (v: StepView) =>
  v.key === 'fixes' && v.state === 'now' ? 'Check the fixes again on site'
  : v.key === 'qty' && v.state === 'wait' ? 'Did the new tile paperwork come?'
  : v.key === 'deposit' && v.state === 'wait' ? 'Deposit payment'
    : v.key === 'qty' && v.state === 'bad' ? 'Send the revised quantities'
      : v.key === 'confirmed' && v.state !== 'later' && v.due && v.due <= TODAY ? 'Did the installer say yes?'
        : v.state === 'now' && v.due && v.due <= TODAY && /^Asked /.test(v.note || '') ? `Follow up · ${v.short.toLowerCase()}`
          : v.named ? v.label : TODO[v.key] || v.label

export function openStep(jobId: string, k: string) { useStore.getState().open({ t: 'step', jobId, k }) }

/** where a step stands, in words */
function stateWords(v: StepView, me: PersonKey): { text: string; tone: Tone } {
  if (v.state === 'done') return { text: `Done${v.doneOn ? ` ${v.doneOn}` : ''}${v.doneBy ? ` · ${PEOPLE[v.doneBy]?.short}` : ''}`, tone: 'ok' }
  if (v.state === 'na') return { text: 'Not needed on this project', tone: 'neutral' }
  if (v.state === 'later') return { text: 'Not yet', tone: 'neutral' }
  if (v.state === 'wait') return { text: 'Waiting', tone: 'warn' }
  if (v.state === 'bad') return { text: 'Problem', tone: 'bad' }
  return { text: v.owner === me ? 'Your turn' : `${PEOPLE[v.owner]?.short || 'Their'}’s turn`, tone: 'info' }
}
/** when an open step is due — only a day the flow set (a delivery, a follow-up, a day someone was given) */
function dueWords(v: StepView): { text: string; late: boolean } | null {
  if (!v.due || v.state === 'done' || v.state === 'na' || v.state === 'later') return null
  const d = labelFromIso(v.due)
  if (v.due < TODAY) return { text: `was due ${d}`, late: true }
  return { text: v.due === TODAY ? 'due today' : d === 'Tomorrow' ? 'due tomorrow' : `due ${d}`, late: false }
}

/** someone else's step: remind them — it pops up on their screen (and when it's late, it counts as checking in) */
export function remindStep(job: Job, v: StepView) {
  const st = useStore.getState()
  const me = meOf(st.role)
  st.commit((x) => {
    const r = ((x.stepRecs[job.id] ||= {})[v.key] ||= {}) as any
    r.nudge = { by: me, at: Date.now().toString(36), day: TODAY }
    if (v.due && v.due < TODAY) r.checkIn = { by: me, day: TODAY }
    addHist(x, job.id, { who: me, kind: 'setup', title: `${v.short}: reminded ${PEOPLE[v.owner]?.short || ''}` })
  }, `Reminder sent to ${PEOPLE[v.owner]?.short || 'them'}`, { sub: 'It pops up on their screen, and it’s on their Today.', undo: false })
}

/* ================= the window ================= */
/** where a step is shown: its own window (close = close it) or inline on the project page (close = fold it) */
const StepHost = React.createContext<{ close: () => void } | null>(null)
export const useStepHost = () => React.useContext(StepHost)

/** who may do what with a step: only its person does it, and only once the steps before it are done. Who has each step
 *  comes from Who does what — the admin can take one over, or give it to someone else on one project. */
function stepRights(s: Store, v: StepView) {
  const me = meOf(s.role)
  const mine = v.owner === me
  const admin = s.role === 'owner' || s.role === 'pm'
  const locked = v.state === 'later'
  return { me, mine, admin, locked, viewOnly: !mine || locked }
}
/** what's happened with a step, from the project's history — newest first */
const HIST_OF: Record<string, RegExp> = {
  order: /^Tile ordered by the store|^Followed up on the tile/i, delivered: /^Tile delivered/i, heights: /^Site check/i, fixes: /^Fixed:/i,
  matin: /^Our materials delivered/i, qty: /^Revised quantities/i, change: /change(s)? from the estimate/i, level: /^Floor heights/i,
}
function stepHistory(s: Store, job: Job, v: StepView) {
  const own = (t: string) => t.toLowerCase().startsWith(`${v.short.toLowerCase()}:`) || !!HIST_OF[v.key]?.test(t)
  return (s.hist[job.id] || []).filter((e: any) => typeof e.title === 'string' && own(e.title)).slice(0, 5) as { date: string; who: PersonKey | string; title: string; detail?: string }[]
}

/** what's happening with a step — the same block on top of every step: done (when, who), your turn, someone else's
 *  turn, waiting on someone outside, a problem, or not yet (what it waits for). When it's due, and what it's for. */
function StepStatus({ job, v, me, mine, admin, onSite, take, goTo }: { job: Job; v: StepView; me: PersonKey; mine: boolean; admin: boolean; onSite: boolean; take: string; goTo?: (k: string) => void }) {
  const name = PEOPLE[v.owner]?.short || 'someone else'
  const due = dueWords(v)
  const open = v.state !== 'done' && v.state !== 'na'
  const what = v.note && (v.state === 'now' || v.state === 'wait' || v.state === 'bad') ? v.note : open ? WHAT[v.key] : undefined
  const look = v.state === 'done' ? { box: 'border-[#d5e7da] bg-[#f3f8f4]', head: 'text-[#22573c]' }
    : v.state === 'bad' ? { box: 'border-bad-100 bg-bad-50/60', head: 'text-bad-700' }
      : v.state === 'wait' ? { box: 'border-[#f0dfbd] bg-[#fdf8ee]', head: 'text-warn-700' }
        : v.state === 'now' && mine ? { box: 'border-brand-100 bg-brand-50/60', head: 'text-brand-800' }
          : v.state === 'later' ? { box: 'border-dashed border-[#d6cfc3] bg-[#faf8f5]', head: 'text-ink-2' }
            : { box: 'border-line bg-[#faf8f5]', head: 'text-ink' }
  const head = v.state === 'done' ? `Done${v.doneOn ? ` ${v.doneOn}` : ''}${v.doneBy ? ` · ${v.doneBy === me ? 'you' : PEOPLE[v.doneBy]?.short}` : ''}`
    : v.state === 'na' ? 'Not needed on this project'
      : v.state === 'later' ? 'Not yet'
        : v.state === 'wait' ? 'Waiting'
          : v.state === 'bad' ? 'A problem'
            : mine ? 'Your turn' : `${name}’s turn`
  /* nobody has this part's login yet: it's yours until someone does — said, so it doesn't look like someone else's */
  const cover = mine && open && v.cover ? `No ${v.cover.toLowerCase()} on the team yet, so it’s yours until there is one. ` : ''
  const sub = v.state === 'later'
    ? `It opens when ${v.waitsFor || 'the step before'} is done${v.waitsOn ? ` — ${v.waitsOn === me ? 'you have' : `${PEOPLE[v.waitsOn]?.short} has`} that` : ''}. Then it’s ${mine ? 'yours' : `${name}’s`}.`
    : what || cover ? `${cover}${what || ''}${!mine && open && onSite && v.state === 'now' ? ' — on site' : ''}` : undefined
  return (
    <div className={cn('flex min-w-0 items-start gap-3 rounded-xl border px-3.5 py-3', look.box)} data-step-status data-step-state={v.state} {...(v.state === 'later' ? { 'data-locked': '' } : {})} {...(!mine && open && v.state !== 'later' ? { 'data-not-mine': '' } : {})} {...(cover ? { 'data-covering': v.cover } : {})}>
      {v.state === 'now' && !mine ? <Avatar who={v.owner} size={30} plain /> : v.state === 'later' ? <span className="inline-flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full border border-dashed border-[#bfb8ad] bg-white text-faint"><Lock className="h-3.5 w-3.5" /></span> : <StepIcon state={v.state} size={30} />}
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-[min(100%,13rem)] flex-1">
          <div className={cn('text-[0.90625rem] font-semibold leading-snug', look.head)}>
            {head}
            {due && <span className={cn('font-medium', due.late ? 'text-bad-600' : 'text-ink-2')}> · {due.text}</span>}
          </div>
          {sub && <div className="mt-0.5 text-[0.84375rem] leading-snug text-ink-2">{sub}</div>}
        </div>
        {!mine && open && v.state !== 'later' && <span className="flex shrink-0 items-center gap-1.5"><Button size="sm" onClick={() => remindStep(job, v)} data-remind-step>Remind {PEOPLE[v.owner]?.short || 'them'}</Button>{admin && <Button size="sm" onClick={() => setStepOwner(job.id, take, me)}>Take it over</Button>}</span>}
        {/* not yet: straight to the step it waits for — nothing ends here */}
        {v.state === 'later' && v.waitsKey && goTo && <Button size="sm" className="shrink-0" iconRight={<ChevronRight />} onClick={() => goTo(v.waitsKey!)} data-go-waits={v.waitsKey}><span className="max-w-[13rem] truncate">Go to {v.waitsFor || 'the step before'}</span></Button>}
      </div>
      {admin && <StepMore job={job} v={v} />}
    </div>
  )
}

/** the step itself, the same way every time: what's happening (the block on top), then the work — yours to do; or,
 *  someone else's, what they do there (read only); nothing yet while it waits for the step before — and what's
 *  happened with it. */
function StepPanel({ job, v, roomy, goTo }: { job: Job; v: StepView; roomy?: boolean; goTo?: (k: string) => void }) {
  const s = useStore()
  const { me, mine, admin, locked, viewOnly } = stepRights(s, v)
  const name = PEOPLE[v.owner]?.short || 'someone else'
  /* checking the fixes again is the site manager's — taking it over takes the site check */
  const take = v.key === 'fixes' && v.state === 'now' ? 'heights' : v.key
  const open = v.state !== 'done' && v.state !== 'na'
  const onSite = v.key === 'heights' || v.key === 'level' || v.key === 'delivered' || (v.key === 'fixes' && v.state === 'now')
  const hist = stepHistory(s, job, v)
  const gap = roomy ? 'mt-5' : 'mt-4'
  return (
    <>
      <StepStatus job={job} v={v} me={me} mine={mine} admin={admin} onSite={onSite} take={take} goTo={goTo} />
      {/* the work is its person's: someone else's step says what's happening, and what happened — no greyed-out form to
          scroll. A problem is the exception: everyone sees what's wrong (each problem opens; the buttons stay theirs). */}
      {mine && !locked ? (
        <fieldset className={cn('m-0 min-w-0 border-0 p-0', gap)}><Body job={job} v={v} /></fieldset>
      ) : v.state === 'bad' ? (
        <fieldset disabled className={cn('m-0 min-w-0 border-0 p-0', gap)} data-problem-view><Body job={job} v={v} /></fieldset>
      ) : null}
      {hist.length > 0 && (
        <div className={cn('border-t border-line-2 pt-3', gap)} data-step-history>
          <div className="mb-1 text-[0.75rem] font-semibold text-muted">What happened</div>
          <ul className="flex flex-col gap-1">
            {hist.map((e, i) => (
              <li key={i} className="flex min-w-0 gap-2 text-[0.8125rem] leading-snug">
                <span className="w-12 shrink-0 tnum text-muted">{e.date}</span>
                <span className="min-w-0 text-ink-2"><b className="font-semibold text-ink">{PEOPLE[e.who as PersonKey]?.short || 'Tile OS'}</b> · {e.title.toLowerCase().startsWith(`${v.short.toLowerCase()}:`) ? e.title.slice(v.short.length + 1).trim() : e.title}{e.detail ? <span className="text-muted"> — {e.detail}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

/** one step, without any window around it — right on the project */
export function StepInline({ job, v, onClose, onGo }: { job: Job; v: StepView; onClose?: () => void; onGo?: (k: string) => void }) {
  const host = React.useMemo(() => ({ close: () => onClose?.() }), [onClose])
  return (
    <StepHost.Provider value={host}>
      <div className="min-w-0"><StepPanel job={job} v={v} goTo={onGo} /></div>
    </StepHost.Provider>
  )
}

/** a part's steps as circles, like the estimate's path: ✓ done, the one it's on (blue when it's yours), amber while
 *  it waits on someone outside, red for a problem, grey for what comes after — and under each, whose it is and when.
 *  Tap one to see it. The same on the project and in the step's own window. */
export function PartPath({ job, list, at, onPick, label }: { job: Job; list: StepView[]; at: string; onPick: (k: string) => void; label: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const day = (iso: string) => (iso === TODAY ? 'today' : labelFromIso(iso))
  const circle = (x: StepView, i: number): CircleStep => {
    const mine = x.owner === me
    const state: CircleState = x.state === 'done' ? 'done' : x.state === 'bad' ? 'bad' : x.state === 'wait' ? 'wait' : x.state === 'now' ? (mine ? 'now' : 'todo') : 'later'
    const who = mine ? 'You' : PEOPLE[x.owner]?.short || ''
    const sub = x.state === 'done' ? (x.doneOn ? x.doneOn : 'Done')
      : x.state === 'bad' ? `${who} · problem`
        : x.state === 'wait' ? `${who} · ${x.due ? `back ${day(x.due)}` : 'waiting'}`
          : x.state === 'now' ? `${who}${x.due ? ` · ${x.due < TODAY ? 'late' : day(x.due)}` : ''}`
            : x.state === 'na' ? 'Not needed' : who
    return { key: x.key, label: stepShort(s, job, x), sub, state, center: String(i + 1), attrs: { 'data-step': x.key, 'data-track-step': x.key, 'data-state': x.state, ...(x.key === at ? { 'data-on': '' } : {}) } }
  }
  return <Circles groups={[{ key: 'part', steps: list.map(circle) }]} at={at} onPick={onPick} size={34} label={label} />
}

/** one part of getting ready in its own window (from Today, a task, a link) — the same as on the project: its steps as
 *  circles on top, the one that's picked under them with its work. Tap another and it shows instead. */
export function StepModal({ jobId, k, level }: { jobId: string; k: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const all = job ? stepsFor(s, job) : []
  const at = all.find((x) => x.key === k)
  /* only this track's steps (the deposit, on none, keeps its own part) */
  const tk = at ? trackOf(at) : null
  const list = at ? all.filter((x) => (tk ? trackOf(x) === tk : x.phase === at.phase) && (x.state !== 'na' || x.key === k)) : []
  const v = list.find((x) => x.key === k)
  const body = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { body.current?.scrollTo?.({ top: 0 }) }, [k])
  if (!job || !v) return null
  const go = (key: string) => { if (key !== k) s.swap({ t: 'step', jobId, k: key }) }
  const c = stepCounts(list)
  const part = (tk && TRACKS.find((t) => t.key === tk)?.label) || PHASES.find((p) => p.key === v.phase)?.label || 'Getting ready'
  const title = v.named ? v.label : TITLE[v.key] || v.label
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      className="h-[min(48rem,92vh)] max-sm:h-[94dvh]"
      title={part}
      sub={`${job.name} · ${c.done === c.total ? 'all done' : `${c.done} of ${c.total} done`}${c.bad ? ` · ${c.bad} with a problem` : ''}`}
      bodyClass="flex min-h-0 flex-col overflow-hidden p-0"
    >
      {/* its steps, like the estimate's path — they stay put */}
      <div data-track-steps data-part-path className="shrink-0 border-b border-line-2 px-3 pb-2 pt-3 max-sm:px-1">
        <PartPath job={job} list={list} at={k} onPick={go} label={`${part} — its steps`} />
      </div>
      <div ref={body} className="scroll-soft min-h-0 min-w-0 flex-1 overflow-y-auto" data-step-view={v.key}>
        <div className="px-6 pb-6 pt-5 max-sm:px-4" data-step-open={v.key}>
          <h3 className="mb-3 text-[1.125rem] font-semibold leading-snug text-ink">{title}</h3>
          <StepHost.Provider value={{ close: s.close }}><StepPanel job={job} v={v} roomy goTo={(key) => s.swap({ t: 'step', jobId, k: key })} /></StepHost.Provider>
        </div>
      </div>
    </Modal>
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

/** the admin's few extra things with a step, in one small menu: not needed here, not done after all, give it to
 *  someone else on this project — and Who does what, where every step's person is set for every project */
function StepMore({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const rec = s.stepRecs[job.id]?.[v.key]
  const reopenable = v.custom || ['getpaper', 'rooms', 'qty', 'heights', 'design', 'walk', 'order', 'delivered', 'change', 'layouts', 'matin', 'confirmed'].includes(v.key)
  const open = v.state !== 'done' && v.state !== 'na'
  const items: { label: string; run: () => void }[] = v.state === 'na' ? [{ label: 'Needed after all', run: () => skipStep(job.id, v.key, false) }]
    : v.state === 'done' ? (reopenable && rec?.done ? [{ label: 'Not done after all', run: () => reopenStep(job.id, v.key) }] : [])
      : [...(rec?.wait ? [{ label: 'Not waiting any more', run: () => stopWaiting(job.id, v.key) }] : []), { label: 'Not needed on this project', run: () => skipStep(job.id, v.key, true) }]
  return (
    <Menu align="end" width={290} trigger={<button aria-label="More for this step" className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-wash hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
      {items.map((x) => <MenuItem key={x.label} onSelect={x.run}>{x.label}</MenuItem>)}
      {open && (
        <>
          {items.length > 0 && <MenuSep />}
          <MenuLabel>Give it to someone else — this project only</MenuLabel>
          {insidePeople(s).filter((p) => p !== v.owner).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} plain />} hint={PEOPLE[p]?.roleLabel} onSelect={() => setStepOwner(job.id, v.key, p)}>{PEOPLE[p]?.name}</MenuItem>)}
        </>
      )}
      <MenuSep />
      <MenuItem icon={<Users className="h-4 w-4" />} hint="Who has each step, on every project" onSelect={() => { s.closeAll(); s.go({ page: 'settings', tab: 'checklist' }) }}>Who does what</MenuItem>
    </Menu>
  )
}

/* ---------------- small pieces ---------------- */
/** a row that opens something to look at (a PO, a file, a problem) — it still opens when the step is someone else's
 *  (a step you only see has its buttons off, not its links) */
function OpenRow({ onClick, className, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { onClick: () => void; title?: string }) {
  return <div role="button" tabIndex={0} {...rest} onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }} className={cn('cursor-pointer', className)}>{children}</div>
}
function Block({ title, right, children, className }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border border-line', className)}>
      <header className="flex min-h-10 items-center gap-3 border-b border-line-2 bg-[#faf8f5] px-4 py-2">
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
  const s = useStore()
  const was = s.stepRecs[job.id]?.[k]?.wait
  const [open, setOpen] = React.useState(false)
  const [on, setOn] = React.useState(was?.on || who)
  const [back, setBack] = React.useState('Tomorrow')
  const [note, setNote] = React.useState('')
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={360} trigger={<Button icon={<Hourglass />} data-wait-for>{was ? 'Followed up — still waiting' : label}</Button>}>
      <div className="text-[0.875rem] font-semibold text-ink">Waiting on</div>
      <TextInput className="mt-2" value={on} onChange={(e) => setOn(e.target.value)} placeholder="The tile store, the GC…" />
      {was && <><div className="mt-3 text-[0.875rem] font-semibold text-ink">What they said</div><TextInput className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. it ships Wednesday" /></>}
      <div className="mt-3 text-[0.875rem] font-semibold text-ink">Back on the list</div>
      <div className="mt-2"><DatePresets value={back} onPick={setBack} presets={['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} /></div>
      <div className="mt-2 text-[0.75rem] text-muted">It’s off the list until then — not done. It comes back that day if it hasn’t come.</div>
      <div className="mt-3 flex justify-end"><Button variant="primary" disabled={!on.trim()} onClick={() => { waitOnStep(job.id, k, on.trim(), back, note.trim() || undefined); setOpen(false) }}>Save</Button></div>
    </Pop>
  )
}
/** the tile didn't come on its day: followed up with the store — when it's coming now, and what they said */
function TileNotYet({ job }: { job: Job }) {
  const [open, setOpen] = React.useState(false)
  const [when, setWhen] = React.useState('Tomorrow')
  const [note, setNote] = React.useState('')
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={360} trigger={<Button icon={<Hourglass />} data-tile-not-yet>Not here yet — followed up</Button>}>
      <div className="text-[0.875rem] font-semibold text-ink">What the store said</div>
      <TextInput className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. on the truck Thursday" />
      <div className="mt-3 text-[0.875rem] font-semibold text-ink">When it’s coming now</div>
      <div className="mt-2"><DatePresets value={when} onPick={setWhen} presets={['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon']} /></div>
      <div className="mt-2 text-[0.75rem] text-muted">It’s off the list until that day — then it’s back, to check it in.</div>
      <div className="mt-3 flex justify-end"><Button variant="primary" onClick={() => { tileNotYet(job.id, when, note.trim() || undefined); setOpen(false) }}>Save</Button></div>
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
    case 'fixes': return <SiteFixes job={job} v={v} />
    case 'level': return <FloorLevels job={job} v={v} />
    case 'materials': return <Materials job={job} v={v} />
    case 'matin': return <MaterialsIn job={job} v={v} />
    case 'delivered': return <Delivered job={job} v={v} />
    case 'layouts': if (!v.only) return <Layouts job={job} v={v} />
      break
    case 'sheets': if (!v.only) return <Sheets job={job} v={v} />
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
            <OpenRow key={f.id} onClick={() => openFile(f)} className="flex w-full items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left first:border-t-0 hover:bg-wash/60">
              <FileText className="h-4 w-4 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold text-ink">{f.name}</span>
              <span className="shrink-0 text-[0.78125rem] text-muted">{f.at} · {sizeLabel(f.size)}</span>
            </OpenRow>
          ))}
        </Block>
      )}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void up(Array.from(e.dataTransfer.files || [])) }}
        className={cn('flex items-center gap-4 rounded-xl border-2 border-dashed px-4 py-4 transition max-sm:flex-wrap', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d8d2c8] bg-[#faf8f5]')}
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
  if (!rooms.length) return (
    <div className="flex flex-col gap-4">
      <Block title="Scope of work" right={<AddRoomButton jobId={job.id} have={[]} />}><Quiet>No rooms yet — they come from the estimate. Add them here, one room at a time.</Quiet></Block>
    </div>
  )
  const tiles = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const flat = flatOf(s, job.id)
  const tiled = flat.filter((f) => takesTile(f.x.name))
  const missing = tiled.filter((f) => !f.x.tile)
  const lock = scopeLock(s, job.id)
  const loose = tiles.filter((t) => !flat.some((f) => f.x.tile === t.tag))
  const totalSF = rooms.reduce((n, r) => n + r.surfaces.reduce((m, x) => m + (x.sf || 0), 0), 0)
  return (
    <div className="flex flex-col gap-4">
      {lock.canEdit ? <PaperRead job={job} /> : <div className="flex items-center gap-2.5 rounded-xl bg-wash px-4 py-3 text-[0.84375rem] text-ink-2"><Lock className="h-4 w-4 shrink-0" />Only {PEOPLE[lock.owner]?.short} enters the paperwork and changes the scope.</div>}
      <Block title="Tile on the paperwork" right={lock.canEdit ? <Button size="xs" icon={<Plus />} onClick={() => s.open({ t: 'tile', jobId: job.id })}>Add a tile</Button> : undefined}>
        {!tiles.length && <Quiet>{lock.canEdit ? 'None yet — upload the paperwork above, or add each tile by hand: its tag, its name, where it goes.' : `None yet — ${PEOPLE[lock.owner]?.short} enters them from the paperwork.`}</Quiet>}
        {tiles.map((t) => <TileWhere key={t.tag} job={job} t={t} loose={loose.includes(t)} locked={!lock.canEdit} />)}
      </Block>
      {missing.length > 0 && (
        <Block title={<span className="text-warn-800">Not matched yet — no tile</span>} right={`${missing.length} of ${tiled.length}`}>
          {missing.map((f) => (
            <div key={f.room + '|' + f.x.name} className="flex items-center gap-3 border-t border-line-2 px-4 py-2 first:border-t-0">
              <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-ink"><b className="font-semibold">{f.room}</b> · {f.x.name}{f.x.sf ? <span className="text-muted"> · {f.x.sf} SF</span> : null}</span>
              {lock.canEdit && <Menu align="end" width={280} trigger={<Button size="sm">Pick a tile<ChevronDown className="h-3.5 w-3.5" /></Button>}>
                <MenuLabel>{f.room} · {f.x.name}</MenuLabel>
                {tiles.map((t) => <MenuItem key={t.tag} icon={<TileImg tile={t} size={20} radius={4} />} onSelect={() => setSurfaceTile(job.id, f.room, f.x.name, t.tag)}>{t.tag} {t.name}</MenuItem>)}
                <MenuItem icon={<Plus className="h-4 w-4" />} onSelect={() => s.open({ t: 'tile', jobId: job.id, room: f.room, surface: f.x.name })}>A new tile…</MenuItem>
              </Menu>}
            </div>
          ))}
        </Block>
      )}
      {!missing.length && tiled.length > 0 && tiles.length > 0 && <Good>Every wall and floor has its tile.</Good>}
      <div className="text-[0.8125rem] text-muted">{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'} · {totalSF.toLocaleString('en-US')} SF — the rooms, walls and square feet are on <b className="font-semibold text-ink-2">Scope of work</b>.</div>
      {v.state !== 'done' && tiles.length > 0 && missing.length > 0 && (
        <Actions><Button icon={<Check />} onClick={() => markStep(job.id, 'rooms', `Entered — ${missing.length} without a tile on this paperwork`, { close: true })}>Entered — the rest isn’t on this paperwork</Button></Actions>
      )}
    </div>
  )
}
/** one tile from the paperwork: what it is and which walls and floors it goes on */
function TileWhere({ job, t, loose, locked }: { job: Job; t: Tile; loose?: boolean; locked?: boolean }) {
  const s = useStore()
  const flat = flatOf(s, job.id)
  const opts = flat.filter((f) => takesTile(f.x.name) || f.x.tile === t.tag).map((f) => ({ key: refKey({ room: f.room, surface: f.x.name }), label: `${f.room} · ${f.x.name}`, hint: f.x.tile && f.x.tile !== t.tag ? `Has ${f.x.tile} now` : f.x.sf ? `${f.x.sf} SF` : undefined }))
  const vals = flat.filter((f) => f.x.tile === t.tag).map((f) => refKey({ room: f.room, surface: f.x.name }))
  return (
    <div className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0">
      <TileImg tile={t} size={40} radius={8} />
      <div className="min-w-0 flex-1">
        <OpenRow onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} className="block max-w-full truncate text-left text-[0.875rem] font-semibold text-ink hover:text-brand-700">{t.tag} {t.name}{t.size ? <span className="font-normal text-muted"> · {t.size}</span> : null}{t.paper ? <span className="font-normal text-muted"> · {t.paper.qty.toLocaleString('en-US')} {unitWord(t.paper.unit, t.paper.qty)} on the paperwork</span> : null}</OpenRow>
        {locked ? <div className="mt-0.5 truncate text-[0.8125rem] text-muted">{vals.length ? opts.filter((o) => vals.includes(o.key)).map((o) => o.label).join(', ') : 'Not on a wall or floor'}</div> : <MultiSelect values={vals} options={opts} label={`Where ${t.tag} goes`} placeholder="Where does it go?" width={360} className={cn('mt-1 min-h-8 py-1 text-[0.8125rem]', loose && 'border-warn-300 bg-warn-50/50')} onChange={(keys) => setTileOn(job.id, t.tag, keys.map((k) => { const [room, surface] = k.split('|'); return { room, surface } }))} summary={(p) => (p.length > 2 ? `${p[0].label} and ${p.length - 1} more` : p.map((o) => o.label).join(', '))} />}
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
  /* no tile entered from the paperwork yet: it goes in right here — no going back a step */
  if (!rows.length) return (
    <div className="flex flex-col gap-4">
      {scopeLock(s, job.id).canEdit && <PaperRead job={job} />}
      <Block title="Each tile"><Quiet>No tile from the paperwork on the walls and floors yet{scopeLock(s, job.id).canEdit ? ' — upload it above and AI reads it' : ''}. Then each tile shows what the paperwork has against what we need.</Quiet></Block>
    </div>
  )
  return (
    <div className="flex flex-col gap-4">
      {sent && v.state !== 'done' && <div className="rounded-xl bg-warn-50 px-4 py-3 text-[0.84375rem] text-warn-800">Revised quantities went to {sent.to} {sent.at}. When the new paperwork comes, drop it here — it reads the new numbers and checks itself.</div>}
      {sent && v.state !== 'done' && <PaperRead job={job} />}
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
          <OpenRow onClick={() => s.open({ t: 'tile', jobId: job.id, tag: r.t.tag })} className="block max-w-full truncate text-left text-[0.875rem] font-semibold text-ink hover:text-brand-700">{r.t.tag} {r.t.name}{r.t.size ? <span className="font-normal text-muted"> · {r.t.size}</span> : null}</OpenRow>
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
  /* the real app with email set up: it goes from Tile OS (Settings → Email: "Everything else"), not your mail app */
  const [busy, setBusy] = React.useState(false)
  const direct = mailLive()
  const sendNow = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await emailText({ to, subject: `${job.name} — revised tile quantities`, text })
      if (!r.ok) { toast.error(r.why); return }
      sent()
    } finally { setBusy(false) }
  }
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
        {direct ? (
          <Button variant="primary" icon={<Mail className="h-4 w-4" />} disabled={busy || !/@/.test(to)} onClick={sendNow}>{busy ? 'Sending…' : 'Send it'}</Button>
        ) : (
          <>
            <a href={href} target="_blank" rel="noreferrer" onClick={() => setTimeout(sent, 50)} className="inline-flex h-9 items-center gap-2 rounded-[0.5625rem] border border-[#d9d3c9] bg-white px-3.5 text-[0.84375rem] font-semibold text-ink shadow-xs hover:border-brand-300 hover:text-brand-700"><Mail className="h-4 w-4" />Email it</a>
            <Button variant="primary" icon={<Check />} onClick={sent}>Mark it sent</Button>
          </>
        )}
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
      <Block title="Each tile" right={tiles.length ? <Button size="xs" icon={<Plus />} onClick={() => s.open({ t: 'tile', jobId: job.id })}>Add a tile</Button> : undefined}>
        {!tiles.length && <div className="flex flex-wrap items-center gap-3 px-4 py-3"><span className="min-w-0 flex-1 text-[0.84375rem] text-muted">No tiles yet — they come in when the tile paperwork is entered.</span><Button size="sm" onClick={() => s.swap({ t: 'step', jobId: job.id, k: 'rooms' })}>Enter the paperwork</Button></div>}
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
          <Menu align="start" width={180} trigger={<button className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-[0.625rem] border border-line bg-white px-3 text-[0.875rem] font-medium text-ink hover:border-[#cdc7bc]"><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-faint" />{timeLabel(time)}</span><ChevronDown className="h-4 w-4 text-faint" /></button>}>
            {TIMES.map((m) => <MenuItem key={m} checked={m === time} onSelect={() => setTime(m)}>{timeLabel(m)}</MenuItem>)}
          </Menu>
        </Field>
        <Field label="With"><TextInput value={withWho} onChange={(e) => setWith(e.target.value)} placeholder={walk ? 'The installer' : 'The designer, the client…'} /></Field>
      </div>
      <Field label="Who from us — it goes on their calendar and Today, and they’re told">
        <MultiSelect
          label="Who from us"
          values={who}
          options={people.map((p) => ({ key: p, label: PEOPLE[p]?.name || p, hint: PEOPLE[p]?.roleLabel }))}
          onChange={(keys) => setWho(keys as PersonKey[])}
          placeholder="Pick who goes"
          width={320}
          icon={<Users />}
          summary={(picked) => <span className="truncate">{picked.map((o) => PEOPLE[o.key as PersonKey]?.short || o.label).join(', ')}</span>}
        />
      </Field>
      <Actions>
        {ev && <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>}
        {!ev && !done && <Button onClick={() => markStep(job.id, v.key, 'Done outside the calendar', { close: true })}>It already happened</Button>}
        <Button variant="primary" icon={<CalendarDays />} disabled={!who.length} onClick={save}>{ev ? 'Save the new time' : walk ? 'Set the walkthrough' : 'Set the meeting'}</Button>
      </Actions>
    </div>
  )
}

/* ================= after the meeting: confirm the scope — the same, or what changed ================= */
const coWord = (m: { step: number; state: string; meta?: { sent?: boolean } }) => (m.step < 0 ? (m.meta?.sent ? 'Waiting on the client’s OK' : 'Being priced') : m.state === 'paid' ? 'Paid' : m.step >= 1 ? 'Billed' : 'Approved')
function EstimateCheck({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const [adding, setAdding] = React.useState(false)
  const cos = s.money.filter((m) => m.jobId === job.id && m.kind === 'change' && m.meta?.meeting)
  const old = s.stepRecs[job.id]?.change?.changes
  const est = PEOPLE[estimatorFor(s, job.id)]?.short || 'the estimator'
  const crew = installerOf(s, job)
  const list = cos.length > 0 && (
    <Block title="What changed — a change order each" right={`${cos.length}`}>
      {cos.map((m) => (
        <OpenRow key={m.id} data-co={m.id} onClick={() => s.open({ t: 'money', id: m.id })} className="flex w-full items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left first:border-t-0 hover:bg-wash/60">
          <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-semibold text-ink">{m.title}</span><span className="block truncate text-[0.78125rem] text-muted">{m.meta ? `${m.meta.from} → ${m.meta.to}` : m.note}</span></span>
          <span className="shrink-0 text-right leading-tight"><span className="block text-[0.8125rem] font-semibold tnum text-ink">{m.amount ? fmtMoney(m.amount) : '—'}</span><span className={cn('block text-[0.75rem] font-medium', m.step < 0 ? 'text-warn-700' : 'text-[#2c8a5b]')}>{coWord(m)}</span></span>
        </OpenRow>
      ))}
    </Block>
  )
  if (v.state === 'done')
    return cos.length ? <>{list}</>
      : old?.length ? (
        <Block title="What changed" right={`sent to ${est}`}>
          {old.map((c, n) => <div key={n} className="border-t border-line-2 px-4 py-2.5 text-[0.875rem] text-ink first:border-t-0"><b className="font-semibold">{c.what}</b>{c.where ? <span className="text-muted"> · {c.where}</span> : null}{c.note ? <span className="block text-[0.8125rem] text-muted">{c.note}</span> : null}</div>)}
        </Block>
      ) : <Good>{v.note || 'Same as the estimate — confirmed'}</Good>
  return (
    <div className="flex flex-col gap-4">
      {!adding && !cos.length && (
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <button data-same onClick={() => markStep(job.id, 'change', 'Same as the estimate — confirmed', { close: true })} className="flex items-start gap-3 rounded-xl border border-ok-200 bg-ok-50/60 px-4 py-3.5 text-left transition hover:bg-ok-50">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ok-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[0.9375rem] font-semibold text-ink">Same as the estimate</span><span className="block text-[0.8125rem] leading-snug text-muted">Nothing changed at the meeting — the scope is set</span></span>
          </button>
          <button data-changed onClick={() => setAdding(true)} className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3.5 text-left transition hover:border-[#cdc7bc] hover:bg-wash/40">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#fbf2e1] text-warn-700"><Plus className="h-4 w-4" strokeWidth={3} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[0.9375rem] font-semibold text-ink">Something changed</span><span className="block text-[0.8125rem] leading-snug text-muted">Each one a change order — {est} prices it, the client OKs it{crew ? `, ${PEOPLE[crew]?.short}’s PO` : ''} and the tile follow</span></span>
          </button>
        </div>
      )}
      {list}
      {adding && <SiteChangeForm jobId={job.id} by="Designer" meeting onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />}
      {!adding && cos.length > 0 && (
        <Actions>
          <Button icon={<Plus />} onClick={() => setAdding(true)}>Another change</Button>
          <Button variant="primary" icon={<Check />} onClick={() => markStep(job.id, 'change', `${cos.length} change${cos.length === 1 ? '' : 's'} — change order${cos.length === 1 ? '' : 's'} started`, { close: true })}>That’s everything — the scope is set</Button>
        </Actions>
      )}
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
      <OpenRow onClick={() => s.open({ t: 'ipo', id: ipo.id })} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition hover:border-[#cdc7bc] hover:bg-wash/50">
        <Avatar who={ipo.crew} size={38} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-ink">{PEOPLE[ipo.crew].name}</span>
          <span className={cn('block text-[0.8125rem]', ipo.status === 'Accepted' ? 'text-ok-700' : 'text-warn-700')}>{ipo.id} · {ipo.status === 'Accepted' ? `took it ${ipo.date}` : 'sent — waiting for his yes'}{b ? ` · ${labelFromIso(b.start)} – ${labelFromIso(b.end)}` : ''}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </OpenRow>
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
          <OpenRow key={p.id} onClick={() => s.open({ t: 'po', id: p.id })} className="flex w-full items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left first:border-t-0 hover:bg-wash/60">
            <Truck className="h-4 w-4 shrink-0 text-faint" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[0.875rem] font-semibold text-ink">{p.id} · {p.supplier}</span><span className="block truncate text-[0.78125rem] text-muted">{p.what}</span></span>
            <span className={cn('shrink-0 text-[0.8125rem] font-semibold', p.late ? 'text-bad-600' : 'text-ink-2')}>{p.eta ? `Due ${p.eta.replace(/^Due\s+/i, '')}` : 'No date yet'}</span>
          </OpenRow>
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
        <OpenRow onClick={() => s.open({ t: 'ipo', id: ipo.id })} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-left transition hover:border-[#cdc7bc] hover:bg-wash/50">
          <Avatar who={ipo.crew} size={38} />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold text-ink">{PEOPLE[ipo.crew].name}</span>
            <span className={cn('block text-[0.8125rem]', ipo.status === 'Accepted' ? 'text-ok-700' : ipo.status === 'Sent' ? 'text-warn-700' : 'text-muted')}>{ipo.id} · {said}</span>
          </span>
          <span className="shrink-0 text-right"><span className="block text-[1.125rem] font-semibold tnum text-ink">{fmtMoney(r.total)}</span><span className="block text-[0.71875rem] text-muted">his PO</span></span>
        </OpenRow>
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
          <button className="flex h-12 w-full items-center gap-3 rounded-[0.625rem] border border-line bg-white px-3 text-left transition hover:border-[#cdc7bc]" aria-label="Pick the installer">
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
            <div className="px-4 pt-2.5 text-[0.75rem] font-semibold text-muted">{r.name}</div>
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

/* ================= 6 · the tile order: when it comes — whoever receives the tile has it that day ================= */
function Order({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const host = useStepHost()
  const me = meOf(s.role)
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const [when, setWhen] = React.useState('Thu')
  const receiver = stepsFor(s, job).find((x) => x.key === 'delivered')?.owner
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
      {receiver && (
        <div className="flex items-center gap-2.5 text-[0.84375rem] text-ink-2" data-receiver={receiver}>
          <Avatar who={receiver} size={26} />
          <span>It goes on {receiver === me ? 'your' : <b className="font-semibold text-ink">{PEOPLE[receiver]?.short}’s</b>} list that day, to check it in.</span>
        </div>
      )}
      <Actions><Button variant="primary" icon={<Truck />} onClick={() => { markTileOrdered(job.id, when); (host || s).close() }}>Save the delivery date</Button></Actions>
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
      <OpenRow onClick={() => s.open({ t: 'money', id: dep.id })} className="flex w-full items-center gap-4 rounded-xl border border-line px-4 py-3 text-left transition hover:border-[#cdc7bc] hover:bg-wash/50">
        <span className="min-w-0 flex-1">
          <span className="block text-[1.25rem] font-semibold tnum text-ink">{fmtMoney(dep.amount || 0)}</span>
          <span className="block text-[0.8125rem] text-muted">{paid ? `Paid${dep.date ? ` ${dep.date}` : ''}` : dep.step >= 1 ? `Invoice ${dep.ref || ''} sent · ${fmtMoney(left)} open`.replace('  ', ' ') : 'Not invoiced yet'}</span>
        </span>
        <Status tone={paid ? 'ok' : dep.step >= 1 ? 'warn' : 'neutral'}>{paid ? 'Paid' : dep.step >= 1 ? 'Waiting for payment' : 'To invoice'}</Status>
      </OpenRow>
      {!paid && (
        <Actions>
          {dep.step < 1 ? <Button variant="primary" icon={<Check />} onClick={() => createInvoice(dep.id)}>It’s invoiced in QuickBooks</Button> : <Button variant="primary" icon={<Check />} onClick={() => recordPayment(dep.id, left, 'Deposit paid')}>Paid in full</Button>}
        </Actions>
      )}
    </div>
  )
}

/* ================= 8 · the site check — on site, the whole site, then room by room ================= */
const CHECK_ICON: Record<string, React.ElementType> = { power: Plug, walls: Ruler, level: Ruler, electric: Zap, plumbing: Wrench, water: Droplets, drains: Droplets, led: Zap, windows: Grid2x2, ready: HardHat }
function SiteCheck({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const me = meOf(s.role)
  const rooms = s.rooms[job.id] || []
  const answers = s.stepRecs[job.id]?.heights?.checks || {}
  const qs = siteQuestions(rooms)
  const whole = qs.filter((c) => !c.byRoom)
  const byRoom = qs.filter((c) => c.byRoom)
  const asked = qs.filter((c) => answers[c.k]).length
  const wrong = Object.entries(answers).filter(([, c]) => !c.ok && !c.na)
  const fixer = stepsFor(s, job).find((x) => x.key === 'fixes')?.owner
  const fixerName = fixer === me ? 'your' : `${PEOPLE[fixer as PersonKey]?.name || 'the office'}’s`
  /* only the site check's person answers it (anyone else sees it) */
  const can = v.owner === me
  const done = asked === qs.length
  return (
    <div className="flex flex-col gap-4">
      {done && (
        <div className={cn('flex items-center gap-2.5 rounded-xl px-4 py-3 text-[0.875rem] font-semibold', wrong.length ? 'bg-[#fdf3f1] text-bad-700' : 'bg-ok-50 text-ok-700')} data-site-done>
          {wrong.length ? <StepIcon state="bad" size={22} /> : <span className="inline-flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded-full bg-ok-500 text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>}
          {wrong.length ? `Site check done — ${wrong.length === 1 ? 'one thing' : `${wrong.length} things`} to fix, on ${fixerName} list (Fix problems)` : 'Site check done — everything’s good on site'}
        </div>
      )}
      <Block title="The whole site" right={`${asked} of ${qs.length} answered`}>
        {whole.map((c) => <SiteRow key={c.k} job={job} k={c.k} can={can} fixer={fixerName} />)}
      </Block>
      <Block title="Room by room" right="some rooms missing it? tap Some">
        {byRoom.map((c) => <SiteRow key={c.k} job={job} k={c.k} can={can} fixer={fixerName} />)}
      </Block>
    </div>
  )
}
/** one thing looked at on site: Yes, Some (which rooms don't have it — "2 of 3 have it"), No (what's wrong) or N/A.
 *  What happens is said right under it: a No or a Some goes on the fix list. */
function SiteRow({ job, k, can, fixer }: { job: Job; k: string; can: boolean; fixer: string }) {
  const s = useStore()
  const c = SITE_CHECKS.find((x) => x.k === k)!
  const a = s.stepRecs[job.id]?.heights?.checks?.[k]
  const rooms = siteRooms(s.rooms[job.id] || [], k)
  const byRoom = !!c.byRoom && rooms.length > 1
  const [some, setSome] = React.useState(false)
  const missing = a && !a.ok && !a.na ? a.rooms || [] : []
  const val: SiteVal | undefined = !a ? (some ? 'some' : undefined) : a.na ? 'na' : a.ok ? 'yes' : byRoom && missing.length && missing.length < rooms.length ? 'some' : 'no'
  const Ic = CHECK_ICON[k] || Check
  const pick = (x: SiteVal | null) => {
    if (x === 'some' && val === 'some') return
    setSome(x === 'some')
    if (x === null || x === 'some') { if (a) setSiteAnswer(job.id, k, null); return }
    if (x === 'yes') return setSiteAnswer(job.id, k, { ok: true })
    if (x === 'na') return setSiteAnswer(job.id, k, { ok: true, na: true })
    setSiteAnswer(job.id, k, { ok: false, note: a?.note, rooms: byRoom ? rooms : undefined })
  }
  /* Some: tap the rooms that don't have it — each tap is kept */
  const toggle = (room: string) => {
    const next = missing.includes(room) ? missing.filter((x) => x !== room) : [...missing, room]
    if (!next.length) { setSiteAnswer(job.id, k, null); setSome(true); return }
    setSiteAnswer(job.id, k, { ok: false, note: a?.note, rooms: next })
  }
  const have = rooms.length - missing.length
  const wrong = !!a && !a.ok && !a.na
  /* the drains are only asked where the scope has a shower — it says which */
  const words = !a ? (some ? 'Which rooms don’t have it? Tap them.' : c.byRoom === 'shower' && rooms.length ? `Only where there’s a shower: ${rooms.join(', ')}` : c.sub)
    : a.na ? 'Not needed here'
      : a.ok ? `Yes${a.by ? ` · ${PEOPLE[a.by]?.short}${a.at ? ` ${a.at}` : ''}` : ''}`
        : `${byRoom ? `${have} of ${rooms.length} have it — missing: ${missing.join(', ')}` : 'No'}${a.note ? ` · ${a.note}` : ''}`
  const showRooms = byRoom && (val === 'some' || val === 'no')
  return (
    <div className="border-t border-line-2 px-4 py-3 first:border-t-0" data-site={k} data-answer-is={val}>
      <div className="flex items-center gap-3 max-sm:flex-wrap @max-lg:flex-wrap">
        <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] max-sm:hidden @max-lg:hidden', wrong ? 'bg-bad-50 text-bad-600' : a?.ok && !a.na ? 'bg-ok-50 text-ok-700' : 'bg-wash text-muted')}><Ic className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 max-sm:basis-full @max-lg:basis-full">
          <span className="block text-[0.875rem] font-semibold text-ink">{c.q}</span>
          <span className={cn('block text-[0.78125rem]', wrong ? 'font-medium text-bad-600' : a?.ok && !a.na ? 'text-[#2c8a5b]' : some ? 'font-medium text-warn-700' : 'text-muted')}>{words}</span>
        </span>
        <SitePick q={c.q} byRoom={byRoom} value={val} onPick={pick} disabled={!can} className="max-sm:ml-auto @max-lg:ml-auto" />
      </div>
      {showRooms && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 sm:pl-12" data-site-rooms>
          {rooms.map((r) => {
            const miss = missing.includes(r)
            return (
              <button key={r} type="button" disabled={!can} data-missing={miss || undefined} onClick={() => toggle(r)} aria-pressed={miss} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold transition', miss ? 'border-bad-200 bg-bad-50 text-bad-700' : 'border-line bg-white text-ink-2 enabled:hover:border-[#cdc7bc]')}>
                {miss && <X className="h-3.5 w-3.5" strokeWidth={3} />}{r}
              </button>
            )
          })}
        </div>
      )}
      {wrong && (
        <div className="mt-2 flex flex-col gap-1.5 sm:pl-12">
          <NoNote value={a!.note} disabled={!can} autoFocus={can && !a!.note && !byRoom} placeholder="What’s wrong? (optional) — e.g. the GC says next week" onSave={(t) => setSiteAnswer(job.id, k, { ok: false, note: t, rooms: a!.rooms })} />
          <span className="text-[0.75rem] font-medium text-bad-600" data-goes-to-fix>→ On {fixer} list to fix — it comes back here to look at again</span>
        </div>
      )}
    </div>
  )
}

/* ================= 8a · the fixes: what the site check found, fixed, and looked at again ================= */
function SiteFixes({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const me = meOf(s.role)
  const answers = s.stepRecs[job.id]?.heights?.checks || {}
  const wrong = Object.entries(answers).filter(([, c]) => !c.ok && !c.na)
  const site = stepsFor(s, job).find((x) => x.key === 'heights')?.owner
  if (!wrong.length) return <Good>{v.state === 'done' ? v.note || 'Fixed — and checked again on site' : 'Nothing to fix'}</Good>
  const toFix = wrong.filter(([, c]) => !c.fixed).length
  return (
    <div className="flex flex-col gap-4">
      <Block title="What the site check found" right={[toFix ? `${toFix} to fix` : '', wrong.length - toFix ? `${wrong.length - toFix} to look at again` : ''].filter(Boolean).join(' · ')}>
        {wrong.map(([k, c]) => {
          const Ic = CHECK_ICON[k] || Check
          return (
            <div key={k} data-fix={k} data-fixed={c.fixed ? '' : undefined} className="flex items-center gap-3 border-t border-line-2 px-4 py-3 first:border-t-0 max-sm:flex-wrap">
              <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem]', c.fixed ? 'bg-brand-50 text-brand-600' : 'bg-bad-50 text-bad-600')}><Ic className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.875rem] font-semibold text-ink">{siteProblem(k, c)}</span>
                <span className={cn('block text-[0.78125rem]', c.fixed ? 'text-brand-700' : 'text-muted')}>{c.fixed ? `Fixed ${c.fixed}${c.fixedBy ? ` · ${PEOPLE[c.fixedBy]?.short}` : ''} — ${site === me ? 'look at it again on site' : `${PEOPLE[site as PersonKey]?.short || 'the site manager'} looks again on site`}` : `Found ${c.at || ''}${c.by ? ` by ${PEOPLE[c.by]?.short}` : ''} on the site check`}</span>
              </span>
              {c.fixed
                ? <span className="flex shrink-0 gap-1.5 max-sm:ml-auto"><Button size="sm" variant="ghost" onClick={() => siteRecheck(job.id, k, false)}>Still not</Button><Button size="sm" variant="primary" icon={<Check />} onClick={() => siteRecheck(job.id, k, true)}>It’s fixed</Button></span>
                : <Button size="sm" className="shrink-0 max-sm:ml-auto" icon={<Check />} onClick={() => siteFixed(job.id, k)}>Fixed</Button>}
            </div>
          )
        })}
      </Block>
      {toFix > 0 && <Actions><WaitFor job={job} k="fixes" who="The GC" label="Asked the GC — waiting" /></Actions>}
    </div>
  )
}

/* ================= 8b · the floors: the high and the low point of every one ================= */
const FRACS: [string, number][] = [['0', 0], ['⅛', 0.125], ['¼', 0.25], ['⅜', 0.375], ['½', 0.5], ['⅝', 0.625], ['¾', 0.75], ['⅞', 0.875]]
const splitIn = (n?: number) => (n == null ? { whole: '', frac: 0 } : { whole: String(Math.floor(n)), frac: Math.round((n - Math.floor(n)) * 1000) / 1000 })
/** one reading: the tape from the floor up to the laser line — whole inches, and the fraction picked from a list */
function Reading({ label, value, onSave, bad, hint = '48' }: { label: string; value?: number; onSave: (n: number | null) => void; bad?: boolean; hint?: string }) {
  const [whole, setWhole] = React.useState(() => splitIn(value).whole)
  const [frac, setFrac] = React.useState(() => splitIn(value).frac)
  React.useEffect(() => { const v = splitIn(value); setWhole(v.whole); setFrac(v.frac) }, [value])
  const commit = (w: string, f: number) => { const n = w.trim() === '' ? null : Number(w); onSave(n == null || isNaN(n) ? null : Math.round((n + f) * 1000) / 1000) }
  const box = cn('h-9 rounded-lg border bg-white text-[0.9375rem] tnum text-ink outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100', bad ? 'border-bad-300' : 'border-line')
  return (
    <span className="inline-flex items-center gap-1">
      <input aria-label={label} inputMode="numeric" value={whole} placeholder={hint} onChange={(e) => setWhole(e.target.value.replace(/[^\d]/g, '').slice(0, 3))} onBlur={() => commit(whole, frac)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className={cn(box, 'w-[3.125rem] px-1.5 text-center')} />
      <span className="relative inline-flex">
        <select aria-label={`${label} — the fraction`} value={String(frac)} onChange={(e) => { const f = Number(e.target.value); setFrac(f); if (whole.trim() !== '') commit(whole, f) }} className={cn(box, 'w-[3.75rem] appearance-none pl-2 pr-6')}>
          {FRACS.map(([t, n]) => <option key={t} value={String(n)}>{t === '0' ? '—' : t}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
      </span>
    </span>
  )
}
/** every floor we tile, one line each. First how to do it: the laser line at one height (48″ off the floor at the
 *  door), then in every room the tape from the floor up to the line at the highest spot and the lowest spot. The line
 *  says flat, self-leveler, or the GC's to fix. A mud bed levels itself, so it needs no numbers. */
function FloorLevels({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const rooms = floorRooms(s.rooms[job.id] || [])
  const toDo = rooms.filter((f) => !f.mud)
  const measured = toDo.filter((f) => f.word)
  const bad = measured.filter((f) => f.word!.tone === 'bad')
  const laser = s.prep[job.id]?.laser
  const at = laser?.at || LASER_AT
  const [where, setWhere] = React.useState(laser?.where || '')
  const [height, setHeight] = React.useState(String(at))
  const [draft, setDraft] = React.useState<Record<string, number | null>>({})
  const save = (f: typeof rooms[number], k: 'high' | 'low', n: number | null) => {
    const key = `${f.room.name}|${k}`
    const next = { ...draft, [key]: n }
    setDraft(next)
    const high = next[`${f.room.name}|high`] ?? f.room.level?.high ?? null
    const low = next[`${f.room.name}|low`] ?? f.room.level?.low ?? null
    if (high == null || low == null) return
    if (f.room.level && f.room.level.high === high && f.room.level.low === low) return
    setFloorLevel(job.id, f.room.name, high, low)
  }
  const saveHeight = () => { const n = Number(height); if (n > 0 && n !== at) setLaser(job.id, where, n); else setHeight(String(at)) }
  if (!rooms.length) return <div className="rounded-xl bg-wash px-4 py-3 text-[0.84375rem] text-muted">No floors on this project — nothing to measure.</div>
  const box = 'h-9 rounded-lg border border-line bg-white px-3 text-[0.875rem] text-ink outline-none transition placeholder:text-faint focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
  return (
    <div>
      <div className="rounded-xl border border-line bg-[#faf8f5] px-4 py-3" data-laser>
        <div className="text-[0.875rem] font-semibold text-ink">How to measure</div>
        <ol className="mt-1.5 flex flex-col gap-1 text-[0.84375rem] leading-snug text-ink-2">
          <li className="flex gap-2"><b className="w-4 shrink-0 font-semibold text-ink">1</b><span>Set the laser on its tripod in the middle of the floor. At the door, raise it until the line is <b className="font-semibold text-ink">{at}″ off the floor</b> — mark it on the wall.</span></li>
          <li className="flex gap-2"><b className="w-4 shrink-0 font-semibold text-ink">2</b><span>In every room, look for the highest and the lowest spot — the corners, the middle, along the walls.</span></li>
          <li className="flex gap-2"><b className="w-4 shrink-0 font-semibold text-ink">3</b><span>At each, measure from the floor up to the laser line and type it below. The highest spot has the <b className="font-semibold text-ink">shortest</b> number.</span></li>
        </ol>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted">
          <label className="inline-flex items-center gap-1.5">Line at<input aria-label="The laser line, inches off the floor" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value.replace(/[^\d]/g, '').slice(0, 3))} onBlur={saveHeight} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className={cn(box, 'w-[3.5rem] px-1.5 text-center tnum')} />″</label>
          <input aria-label="Where the laser line is set" value={where} onChange={(e) => setWhere(e.target.value)} onBlur={() => setLaser(job.id, where)} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} placeholder="Where you marked it (optional) — e.g. the hallway wall by the door" className={cn(box, 'min-w-[12rem] flex-1')} />
        </div>
        {laser?.date && <div className="mt-1.5 text-[0.75rem] text-faint">Noted {labelFromIso(laser.date)}{laser.by ? ` by ${PEOPLE[laser.by as PersonKey]?.short || ''}` : ''}</div>}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-line">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-x-3 border-b border-line-2 bg-wash px-3 py-1.5 text-[0.75rem] font-semibold text-muted max-sm:hidden @max-md:hidden">
          <span>Floor</span><span className="text-center">Highest spot<span className="block font-normal text-faint">floor → line</span></span><span className="text-center">Lowest spot<span className="block font-normal text-faint">floor → line</span></span>
        </div>
        {rooms.map((f) => {
          const w = f.word
          const method = f.room.surfaces.find((x) => isFloor(x.name))?.method
          return (
            <div key={f.room.name} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1.5 border-b border-line-2 px-3 py-2 last:border-b-0 max-sm:grid-cols-[auto_auto] @max-md:grid-cols-[auto_auto]">
              <span className="min-w-0 max-sm:col-span-2 @max-md:col-span-2">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">{f.room.name}</span>
                <span className={cn('block truncate text-[0.75rem]', f.mud ? 'text-muted' : !w ? 'text-faint' : w.tone === 'ok' ? 'text-ok-700' : w.tone === 'warn' ? 'text-warn-700' : 'font-semibold text-bad-600')}>
                  {f.mud ? 'Mud bed — it levels itself' : w ? w.label : method === 'slu' ? 'Self-leveler planned — measure it anyway' : 'Not measured yet'}
                </span>
              </span>
              {f.mud
                ? <span className="col-span-2 text-[0.8125rem] text-faint max-sm:col-span-2 max-sm:text-left @max-md:text-left">no numbers needed</span>
                : (['high', 'low'] as const).map((k) => (
                  <span key={k} className="inline-flex flex-col items-start gap-0.5">
                    <span className="text-[0.6875rem] font-semibold text-faint sm:hidden @max-md:block">{k === 'high' ? 'Highest spot' : 'Lowest spot'}</span>
                    <Reading label={`${f.room.name} — ${k === 'high' ? 'highest' : 'lowest'} spot, floor to laser, in inches`} hint={String(at)} value={draft[`${f.room.name}|${k}`] ?? f.room.level?.[k]} bad={w?.tone === 'bad'} onSave={(n) => save(f, k, n)} />
                  </span>
                ))}
            </div>
          )
        })}
      </div>
      <div className="mt-2 text-[0.75rem] leading-snug text-muted">Up to {fracIn(LEVEL_OK)} out is fine. Up to {fracIn(LEVEL_PREP)} gets self-leveler, and the materials follow. More than that, the GC fixes the floor before we start.</div>
      {v.state !== 'done' && (
        <Actions>
          {bad.length > 0 && <Button variant="primary" icon={<Send />} onClick={() => sendFloorProblems(job.id)}>Tell the office — {bad.length === 1 ? `${bad[0].room.name} is ${fracIn(bad[0].word!.diff)} out` : `${bad.length} floors are out`}</Button>}
          {!bad.length && measured.length > 0 && measured.length < toDo.length && <span className="text-[0.8125rem] text-muted">{toDo.length - measured.length} more to measure — it’s done when every floor has its numbers.</span>}
        </Actions>
      )}
    </div>
  )
}
/* ================= 9 · our materials — by what they're for, worked out from the setup and the square feet ================= */
const GROUP_EMPTY: Record<Group, string> = {
  'Floor prep': 'Nothing under the floors — they go on the slab',
  'Walls and waterproofing': 'Nothing on the walls before the tile',
  'Setting and grout': 'After the tile is picked — thinset and grout go by the tile',
  'Metal edges': 'No metal edges on this job',
}
function Materials({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const t = takeoff(s, job.id)
  const ms = materialStatus(s, job.id)
  const toOrder = t.lines.filter((l) => l.toOrder > 0)
  const noSF = t.skipped.filter((k) => /square feet/i.test(k.why))
  const noTile = t.skipped.filter((k) => /after its tile/i.test(k.why))
  const setupOpen = stepsFor(s, job).some((x) => x.key === 'setup' && x.state !== 'done' && x.state !== 'na')
  if (!t.total || !t.counted) return <Block title="Our materials"><Quiet>{ms.hint}</Quiet></Block>
  return (
    <div className="flex flex-col gap-3">
      <Block title="What it takes" right={`${t.sf.toLocaleString('en-US')} SF · ${setupOpen ? 'the setup isn’t decided yet — suggested' : 'from the setup'}`}>
        {GROUPS.map((g) => {
          const lines = t.lines.filter((l) => l.group === g && l.need > 0)
          return (
            <div key={g} className="border-t border-line-2 first:border-t-0" data-mat-group={g}>
              <div className="px-4 pb-1 pt-2.5 text-[0.75rem] font-semibold text-muted">{g}</div>
              {!lines.length && <div className="px-4 pb-2.5 text-[0.8125rem] text-faint">{g === 'Setting and grout' && !noTile.length ? 'Nothing yet' : GROUP_EMPTY[g]}</div>}
              {lines.map((l) => {
                const it = s.items.find((i) => i.id === l.itemId)
                return (
                  <div key={l.itemId} className="flex items-center gap-3 px-4 py-1.5 last:pb-2.5">
                    <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-ink">{it?.brand ? `${it.brand} ${it.product}` : it?.name || l.itemId}</span>
                    <span className="shrink-0 text-[0.84375rem] font-semibold tnum text-ink">{qtyLabel(l.need, it?.unit || '')}</span>
                    <span className={cn('w-[6.5rem] shrink-0 text-right text-[0.78125rem]', l.toOrder ? 'font-semibold text-warn-700' : 'text-ok-700')}>{l.toOrder ? `${l.toOrder} to order` : l.onSite >= l.need ? 'On site' : 'Ordered'}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </Block>
      {(noSF.length > 0 || noTile.length > 0) && (
        <div className="text-[0.78125rem] leading-snug text-muted">
          {noTile.length > 0 && <div>Thinset and grout come in once the tile is picked — {noTile.length} {noTile.length === 1 ? 'wall or floor' : 'walls and floors'} still without one.</div>}
          {noSF.length > 0 && <div>Not counted — no square feet yet: {noSF.slice(0, 3).map((k) => `${k.room} ${k.surface.toLowerCase()}`).join(', ')}{noSF.length > 3 ? ` and ${noSF.length - 3} more` : ''}.</div>}
        </div>
      )}
      {v.state !== 'done' && toOrder.length > 0 && <Actions><Button variant="primary" icon={<Truck />} onClick={() => s.open({ t: 'newpo', jobId: job.id, fromTakeoff: true })}>Order them — {toOrder.length} {toOrder.length === 1 ? 'material' : 'materials'}</Button></Actions>}
    </div>
  )
}

/* ================= 10 · the tile comes ================= */
/** tile that came broken, wrong or short — each one is a problem on someone's desk until it's sorted */
function TileProblems({ job }: { job: Job }) {
  const s = useStore()
  const me = meOf(s.role)
  const probs = s.tasks.filter((t) => t.jobId === job.id && t.tone === 'bad' && t.type === 'Materials' && t.state !== 'done')
  if (!probs.length) return null
  return (
    <Block title={probs.length === 1 ? 'A problem' : `${probs.length} problems`}>
      {probs.map((t) => (
        <OpenRow key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left transition first:border-t-0 row-hover">
          <StepIcon state="bad" size={22} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.875rem] font-semibold text-ink">{t.title}</span>
            <span className="block truncate text-[0.78125rem] text-muted">{[t.owner === me ? 'You' : PEOPLE[t.owner]?.short, t.state === 'waiting' && t.waitingOn ? `waiting on ${t.waitingOn}` : t.due].filter(Boolean).join(' · ')}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </OpenRow>
      ))}
    </Block>
  )
}

function Delivered({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const host = useStepHost()
  const checks = s.checks.filter((c) => c.jobId === job.id)
  /* a tile with a problem logged against it isn't "all here", even if the count matched */
  const badTags = new Set(s.tasks.filter((t) => t.jobId === job.id && t.tone === 'bad' && t.type === 'Materials' && t.state !== 'done').map((t) => (t.where || t.title).split(/[\s:·]/)[0]))
  if (checks.length)
    return (
      <div className="space-y-4">
        <TileProblems job={job} />
        <Block title="The delivery" right={checks[0].supplier}>
          {checks.map((c) => (
            <div key={c.tag} className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0">
              <span className="min-w-0 flex-1"><span className="block text-[0.875rem] font-semibold text-ink">{c.tag} <span className="font-normal text-muted">· {c.where}</span></span><span className="block text-[0.78125rem] text-muted">{c.received} of {c.ordered} {c.unit} here{c.eta && c.received < c.ordered ? ` · due ${c.eta}` : ''}</span></span>
              {badTags.has(c.tag)
                ? <Status tone="bad">Problem</Status>
                : <Status tone={c.received >= c.ordered ? 'ok' : c.received ? 'bad' : 'neutral'}>{c.received >= c.ordered ? 'All here' : c.received ? 'Part of it' : 'Not yet'}</Status>}
            </div>
          ))}
        </Block>
        <Actions>
          <Button icon={<PackageX />} onClick={() => s.open({ t: 'problem', jobId: job.id })}>Broken, wrong or missing</Button>
          {checks.some((c) => c.received < c.ordered) && v.state !== 'wait' && <TileNotYet job={job} />}
          {checks.some((c) => c.received < c.ordered) && <Button variant="primary" icon={<PackageCheck />} onClick={() => s.open({ t: 'receivetile', jobId: job.id })}>Check it in</Button>}
        </Actions>
      </div>
    )
  if (v.state === 'done') return <Good>{v.note || 'On site'}</Good>
  if (badTags.size) return <div className="space-y-4"><TileProblems job={job} /><Actions><Button icon={<PackageX />} onClick={() => s.open({ t: 'problem', jobId: job.id })}>Another problem</Button></Actions></div>
  return (
    <div>
      <div className="rounded-xl border border-line px-4 py-3 text-[0.875rem] text-ink">{v.due ? <>Delivery <b className="font-semibold">{labelFromIso(v.due)}</b> — count the boxes against the order.</> : 'No delivery date yet — it’s set on the tile order step.'}</div>
      <Actions>
        <Button icon={<PackageX />} onClick={() => s.open({ t: 'problem', jobId: job.id })}>Broken, wrong or missing</Button>
        {v.due && v.state !== 'wait' && <TileNotYet job={job} />}
        <Button variant="primary" icon={<PackageCheck />} onClick={() => { checkInTile(job.id); (host || s).close() }}>All of it is here</Button>
      </Actions>
    </div>
  )
}

/* ================= a step of your own ================= */
/* ================= the room sheets: one page a room — print them, hang one in each ================= */
function Sheets({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const rooms = sheetRooms(s, job.id)
  if (!rooms.length) return <p className="text-[0.875rem] text-muted">No tile on any wall or floor yet — the sheets are made from the tile paperwork.</p>
  return (
    <div data-sheets-step>
      <div className="overflow-hidden rounded-xl border border-line">
        {rooms.map((r) => {
          const rows = sheetRows(job.id, r)
          return (
            <div key={r.name} className="flex min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0" data-sheet-room={r.name}>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.90625rem] font-semibold text-ink">{r.name}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{rows.map((x) => `${x.x.name} · ${x.tile?.tag || x.x.tile}`).join('  ·  ')}</span>
              </span>
              <PrintSheetsButton job={job} room={r.name} size="sm" variant="ghost">Print</PrintSheetsButton>
            </div>
          )
        })}
      </div>
      <Actions>
        <PrintSheetsButton job={job} />
        {v.state !== 'done' && <Button variant="primary" icon={<Check />} onClick={() => markStep(job.id, 'sheets', 'Up in every room', { close: true })}>They’re up in every room</Button>}
      </Actions>
    </div>
  )
}

/* ================= the layouts: every wall and floor, with what the system suggests ================= */
function Layouts({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const missing = (s.rooms[job.id] || []).flatMap((r) => r.surfaces).filter((x) => x.tile && takesTile(x.name) && !x.layout).length
  return (
    <div>
      <LayoutsList job={job} action={missing > 0 ? <Button size="sm" variant="primary" icon={<Sparkles />} onClick={() => fillSuggestions(job.id)}>Use the suggestions ({missing})</Button> : undefined} />
      {v.state !== 'done' && missing === 0 && (
        <Actions>
          <Button variant="primary" icon={<Check />} onClick={() => markStep(job.id, 'layouts', undefined, { close: true })}>Layouts are set</Button>
        </Actions>
      )}
    </div>
  )
}

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
