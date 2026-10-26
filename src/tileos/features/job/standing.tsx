/* Where the project stands — the line on top, and what's going on now on the left.
 *   THE LINE (in the header), like the estimate's path: Approved → Getting ready → Crew scheduled → Installing →
 *     Touch-ups → Closed. "Crew scheduled" is locked until getting ready is done. Billing runs alongside it, on its own
 *     strip, and never stops anything.
 *   THE LEFT, while getting ready: five tracks at the same time — Scope, Tile, Site, Installer, Materials. Each is a
 *     short path of steps with who has it now, when, and one button; tap a step and it opens right there. Nothing is
 *     checked off: a step moves when the real thing happens. Under them, the open issues — each one someone's.
 *   Once the crew is in, the tracks fold to one ✓ line, and the left is the issues, the changes, more tile and the
 *     touch-ups. */
import * as React from 'react'
import { ChevronDown, ChevronRight, ChevronUp, Plus, Truck, HardHat, CalendarDays, Check, Receipt, Minus, TriangleAlert, ListTodo, Hourglass, Package, FileText } from 'lucide-react'
import { useStore, meOf, isRequest } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Circles } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, isoFromLabel } from '@/tileos/lib/today'
import { stepsFor, type StepState } from '../steps'
import { StepIcon } from '../steps-ui'
import { StepInline, TITLE } from '../stepwin'
import { installerOf } from '../upcoming'
import { TouchupsList } from '../touchups'
import { allowedFor } from '../newpicker'
import { firstName } from './kit'
import { tracksFor, lineOf, phaseOf, leadWords, stepShort, moneyLine, issuesOf, issueKind, bookingOf, type TrackView, type TrackKey } from '../tracks'

/** the track (and the step on it) that's open on the left */
export type OpenTrack = { track: TrackKey; step: string } | null

/* ================= the line ================= */
/** where the project is — one line, like the estimate's: the step going on now is filled blue and says "Now" */
export function ProjectLine({ job, className }: { job: Job; className?: string }) {
  const s = useStore()
  const line = lineOf(s, job, tracksFor(s, job))
  const here = line.find((x) => x.state === 'now' || x.state === 'bad') || [...line].reverse().find((x) => x.state === 'done')
  return (
    <>
    <Circles
      layout="beside"
      markNow
      size={30}
      className={className}
      label="Where the project is"
      groups={[{ key: 'line', steps: line.map((x, i) => ({ key: x.key, label: x.label, sub: x.sub, state: x.state, lock: x.lock, center: String(i + 1), attrs: { 'data-line': x.key, ...(x.lock ? { 'data-gate': 'locked' } : {}) } })) }]}
    />
    {here && <div className="mt-1.5 truncate text-[0.8125rem] sm:hidden" data-line-now><b className={cn('font-semibold', here.state === 'bad' ? 'text-bad-600' : 'text-brand-700')}>{here.label}</b>{here.sub ? <span className="text-muted"> · {here.sub}</span> : null}</div>}
    </>
  )
}

/** the money, alongside the line the whole time — what's paid of the contract, and the deposit. Never in the way. */
export function BillingStrip({ job, onOpen, className }: { job: Job; onOpen: () => void; className?: string }) {
  const s = useStore()
  if (['site', 'crew', 'client'].includes(s.role)) return null
  const m = moneyLine(s, job)
  if (!m.total && !m.dep) return null
  return (
    <button onClick={onOpen} data-billing className={cn('flex w-full min-w-0 items-center gap-3 rounded-[0.625rem] border border-[#e1ebe2] bg-[#f5f9f5] px-3 py-1.5 text-left text-[0.8125rem] transition hover:border-[#cadccd] hover:bg-[#f0f6f0] max-sm:gap-2 max-sm:px-2.5', className)}>
      <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#2c4a3e]"><Receipt className="h-3.5 w-3.5" />Billing<span className="font-normal text-muted max-md:hidden">· alongside, never in the way</span></span>
      <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-[#dfe8df] max-sm:hidden" aria-hidden><span className="block h-full rounded-full bg-[#2c8a5b]" style={{ width: `${m.paidPct}%` }} /></span>
      <span className="min-w-0 flex-1 truncate text-ink-2">
        <b className="font-semibold tnum text-ink">{fmtMoney(m.paid)}</b> paid of <span className="tnum">{fmtMoney(m.total)}</span>
        {m.billed > m.paid && <> · <span className="tnum">{fmtMoney(m.billed - m.paid)}</span> billed</>}
        {m.toBill > 0 && <span className="font-semibold text-brand-700"> · {fmtMoney(m.toBill)} ready to bill</span>}
        {m.dep && m.dep.tone !== 'ok' && <span className="font-medium text-warn-700"> · {m.dep.text}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
    </button>
  )
}

/* ================= the left: what's going on now ================= */
export function ProjectNow({ job, open, setOpen }: { job: Job; open: OpenTrack; setOpen: (o: OpenTrack) => void }) {
  const s = useStore()
  const tracks = tracksFor(s, job, stepsFor(s, job))
  const phase = phaseOf(s, job, tracks)
  const [unfold, setUnfold] = React.useState(false)
  const showTracks = phase === 'ready' || unfold || !!open
  return (
    <div className="flex flex-col gap-3" data-phase={phase}>
      {showTracks
        ? <Tracks job={job} tracks={tracks} open={open} setOpen={setOpen} onFold={phase !== 'ready' ? () => { setUnfold(false); setOpen(null) } : undefined} />
        : <ReadyDone job={job} tracks={tracks} onOpen={() => setUnfold(true)} />}
      {phase === 'crew' && <CrewCard job={job} />}
      {phase === 'punch' && <TouchupsCard job={job} />}
      <OpenIssues job={job} />
      <MoreTile job={job} />
      <Changes job={job} />
      {phase === 'install' && s.punch.some((p) => p.jobId === job.id && p.status !== 'verified') && <TouchupsCard job={job} />}
    </div>
  )
}

/* ---------------- the five tracks ---------------- */
function Tracks({ job, tracks, open, setOpen, onFold }: { job: Job; tracks: TrackView[]; open: OpenTrack; setOpen: (o: OpenTrack) => void; onFold?: () => void }) {
  const n = tracks.length
  const done = tracks.filter((t) => t.state === 'done').length
  return (
    <section data-tracks>
      <header className="mb-2 flex min-w-0 items-baseline gap-2.5 px-0.5">
        <h3 className="shrink-0 text-[1.0625rem] font-semibold text-ink">Getting ready</h3>
        <span className={cn('min-w-0 truncate text-[0.8125rem]', done === n ? 'font-medium text-[#2c8a5b]' : 'text-muted')}>{done === n ? `All ${n} done` : `${n} at the same time — each one shows who has it now`}</span>
        {onFold && <button onClick={onFold} className="ml-auto inline-flex shrink-0 items-center gap-1 self-center rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><ChevronUp className="h-3.5 w-3.5" />Fold</button>}
      </header>
      <div className="flex flex-col gap-1.5">
        {tracks.map((t) => <TrackRow key={t.key} job={job} t={t} at={open?.track === t.key ? open.step : null} onAt={(k) => setOpen(k ? { track: t.key, step: k } : null)} />)}
      </div>
    </section>
  )
}

const WHO_TONE: Record<string, string> = { ok: 'text-[#2c8a5b]', mine: 'text-brand-700', now: 'text-ink', wait: 'text-warn-700', bad: 'text-bad-600', later: 'text-muted' }

/** one track: its name, who has it now and when, its one button — and its path of steps under it */
function TrackRow({ job, t, at, onAt }: { job: Job; t: TrackView; at: string | null; onAt: (k: string | null) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const w = leadWords(s, job, t)
  const lead = t.lead
  const viewer = ['client', 'crew'].includes(s.role)
  const mine = !viewer && !!lead && (lead.state === 'now' || lead.state === 'bad') && lead.owner === me
  const box = React.useRef<HTMLDivElement>(null)
  const toggle = (k?: string) => {
    const key = k || lead?.key || t.steps[t.steps.length - 1]?.key
    onAt(at === key ? null : key || null)
  }
  /* opened from "Your turn" (or a step tapped): bring it into view */
  React.useEffect(() => { if (at) box.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }) }, [at])
  const v = at ? t.steps.find((x) => x.key === at) : undefined
  return (
    <div ref={box} data-track={t.key} data-state={t.state} className={cn('overflow-hidden rounded-[0.875rem] border bg-white transition-shadow', t.state === 'bad' ? 'border-bad-200' : 'border-line', at && 'shadow-card')}>
      <div className="flex min-w-0 items-center gap-3 px-3.5 pt-2 max-sm:gap-2 max-sm:px-3">
        <button onClick={() => toggle()} aria-expanded={!!at} className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left">
          <span className="text-[0.9375rem] font-bold text-ink">{t.label}</span>
          {t.state === 'done' && <span className="inline-flex items-center gap-1 text-[0.75rem] font-semibold text-[#2c8a5b]"><Check className="h-3.5 w-3.5" strokeWidth={3} />{t.doneOn ? `Done ${t.doneOn}` : 'Done'}</span>}
        </button>
        {t.state !== 'done' && (
          <button onClick={() => toggle()} className="flex min-w-0 max-w-[60%] items-center gap-2 text-right" data-who>
            <span className="min-w-0 leading-tight">
              <span className={cn('block truncate text-[0.8125rem] font-semibold', WHO_TONE[w.tone])}>{w.top}</span>
              {w.sub && <span className={cn('block truncate text-[0.71875rem]', w.late ? 'font-semibold text-bad-600' : 'text-muted')}>{w.sub}</span>}
            </span>
            {w.who && (
              <span className="relative shrink-0">
                <Avatar who={w.who} size={26} />
                {w.tone === 'wait' && <span className="absolute -bottom-1 -right-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white text-warn-700 ring-1 ring-[#f0dcb4]"><Hourglass className="h-2.5 w-2.5" /></span>}
              </span>
            )}
          </button>
        )}
        {mine && <Button size="sm" variant="primary" data-do-it onClick={() => toggle(lead!.key)} className="shrink-0">Do it</Button>}
      </div>
      <TrackPath job={job} t={t} at={at} onPick={(k) => toggle(k)} />
      {v && (
        <div className="border-t border-line-2 bg-[#fcfbf9] px-4 pb-4 pt-3 max-sm:px-3" data-track-open={v.key}>
          <div className="mb-1.5 flex min-w-0 items-center gap-2">
            <h4 className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{TITLE[v.key] || v.label}</h4>
            <button onClick={() => onAt(null)} aria-label="Close the step" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-wash hover:text-ink"><ChevronUp className="h-4 w-4" /></button>
          </div>
          <StepInline job={job} v={v} onClose={() => onAt(null)} />
        </div>
      )}
    </div>
  )
}

/* the marks on a track's path — the same colors as the line on top */
function Dot({ state, lead }: { state: StepState; lead?: boolean }) {
  const box = 'inline-flex h-[0.9375rem] w-[0.9375rem] shrink-0 items-center justify-center rounded-full'
  if (state === 'done') return <span className={cn(box, 'bg-[#2c8a5b] text-white')}><Check className="h-2.5 w-2.5" strokeWidth={3.6} /></span>
  if (state === 'bad') return <span className={cn(box, 'bg-[#d7342a] text-[0.625rem] font-black leading-none text-white')}>!</span>
  if (state === 'now') return <span className={cn(box, 'bg-[#2650cf]', lead && 'shadow-[0_0_0_0.1875rem_rgba(38,80,207,.18)]')} />
  if (state === 'wait') return <span className={cn(box, 'border-2 border-[#d98c0b] bg-white')} />
  if (state === 'na') return <span className={cn(box, 'bg-wash-2 text-faint')}><Minus className="h-2.5 w-2.5" strokeWidth={3} /></span>
  return <span className={cn(box, 'border-[0.09375rem] border-[#cfc8bd] bg-white')} />
}
const DOT_LABEL: Record<StepState, string> = { done: 'font-medium text-ink-2', now: 'font-semibold text-brand-700', bad: 'font-semibold text-bad-600', wait: 'font-medium text-warn-700', later: 'text-muted', na: 'text-faint line-through' }

/** a track's steps in a row — done, the one it's on, what comes after. Tap one and it opens under the track. */
function TrackPath({ job, t, at, onPick }: { job: Job; t: TrackView; at: string | null; onPick: (k: string) => void }) {
  const s = useStore()
  return (
    <ol className="flex min-w-0 items-center overflow-hidden px-3.5 pb-2 pt-1 max-sm:px-3" aria-label={`${t.label}, step by step`}>
      {t.steps.filter((v) => v.state !== 'na' || at === v.key).map((v, i, list) => {
        const lead = t.lead?.key === v.key
        const on = at === v.key
        const prev = list[i - 1]
        return (
          <li key={v.key} className={cn('flex items-center', lead || on ? 'min-w-fit shrink-0' : 'min-w-0 shrink')}>
            {i > 0 && <span aria-hidden className={cn('mx-1.5 h-[0.125rem] w-3.5 shrink-0 rounded-full max-sm:mx-1 max-sm:w-2.5', prev.state === 'done' || prev.state === 'na' ? 'bg-[#2c8a5b]' : 'bg-[#e5e0d7]')} />}
            <button data-step={v.key} data-state={v.state} onClick={() => onPick(v.key)} aria-pressed={on} title={`${TITLE[v.key] || v.label}${v.note ? ` — ${v.note}` : ''}`} className={cn('flex min-w-0 items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-1.5 text-[0.78125rem] transition hover:bg-[#f4f1ec]', on && 'bg-brand-50 ring-1 ring-brand-200 hover:bg-brand-50')}>
              <Dot state={v.state} lead={lead} />
              <span className={cn('min-w-0 truncate', DOT_LABEL[v.state], lead && 'font-bold', !lead && !on && 'max-sm:hidden')}>{stepShort(s, job, v)}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/** getting ready, folded to one line — a ✓ when every track is done; what's still open (tile that came short,
 *  materials on the way) says so. Tap it to see the tracks again. */
function ReadyDone({ job, tracks, onOpen }: { job: Job; tracks: TrackView[]; onOpen: () => void }) {
  const s = useStore()
  const open = tracks.filter((t) => t.state !== 'done')
  const last = tracks.map((t) => t.doneOn).filter(Boolean).sort((a, b) => (isoFromLabel(a) || '').localeCompare(isoFromLabel(b) || '')).pop()
  const bad = open.some((t) => t.state === 'bad')
  return (
    <button data-ready-folded data-open={open.length || undefined} onClick={onOpen} className={cn('flex w-full min-w-0 items-center gap-3 rounded-[0.875rem] border bg-white px-3.5 py-2.5 text-left transition hover:bg-[#fcfbf9]', bad ? 'border-bad-200' : 'border-line')}>
      {open.length
        ? <StepIcon state={bad ? 'bad' : 'wait'} size={28} />
        : <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2c8a5b] text-white"><Check className="h-4 w-4" strokeWidth={3} /></span>}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-[0.9375rem] font-semibold text-ink">{open.length ? `Getting ready — ${tracks.length - open.length} of ${tracks.length} done` : `Getting ready — all ${tracks.length} done`}</span>
        <span className={cn('block truncate text-[0.75rem]', bad ? 'font-medium text-bad-600' : open.length ? 'text-warn-700' : 'text-muted')}>
          {open.length ? open.map((t) => `${t.label}: ${t.lead ? stepShort(s, job, t.lead).toLowerCase() : 'open'}`).join(' · ') : `${tracks.map((t) => t.label).join(' · ')}${last ? ` · the last one ${last}` : ''}`}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-faint" />
    </button>
  )
}

/* ---------------- the crew: who, his PO, the days ---------------- */
function CrewCard({ job }: { job: Job }) {
  const s = useStore()
  const crew = (installerOf(s, job) || job.crew) as PersonKey | undefined
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const b = bookingOf(s, job)
  const booked = job.stage === 'scheduled' || !!b
  const dep = moneyLine(s, job).dep
  const money = !['site', 'crew', 'client'].includes(s.role)
  return (
    <section data-crew className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
        <h4 className="text-[0.9375rem] font-bold text-ink">Crew</h4>
        <span className={cn('text-[0.78125rem]', booked ? 'font-medium text-[#2c8a5b]' : 'font-semibold text-brand-700')}>{booked ? 'Scheduled' : 'Everything’s confirmed — pick the days'}</span>
      </header>
      <div className="flex flex-col gap-2 px-4 py-3 text-[0.84375rem]">
        <button onClick={() => (ipo ? s.open({ t: 'ipo', id: ipo.id }) : s.open({ t: 'installerwin', jobId: job.id }))} className="flex min-w-0 items-center gap-2.5 text-left">
          {crew ? <Avatar who={crew} size={30} /> : <span className="inline-flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-faint"><HardHat className="h-4 w-4" /></span>}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-semibold text-ink">{crew ? PEOPLE[crew]?.name : 'No installer yet'}</span>
            <span className="block truncate text-[0.75rem] text-muted">{ipo ? `${ipo.id} · ${ipo.status === 'Accepted' ? `took it${ipo.date ? ` ${ipo.date}` : ''}` : ipo.status.toLowerCase()}` : 'No PO yet'}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </button>
        <div className="flex items-center gap-2.5 text-ink-2">
          <span className="inline-flex w-[1.875rem] justify-center"><CalendarDays className="h-4 w-4 text-faint" /></span>
          {b ? <span><b className="font-semibold text-ink">{labelFromIso(b.start)} – {labelFromIso(b.end)}</b>{b.workers ? ` · ${b.workers} workers` : ''}{b.status === 'pending' ? <span className="text-warn-700"> · waiting for his OK</span> : null}</span> : <span className="text-muted">No days on the calendar yet</span>}
        </div>
        {money && dep && dep.tone === 'warn' && (
          <div className="flex items-center gap-2.5 text-warn-700">
            <span className="inline-flex w-[1.875rem] justify-center"><Receipt className="h-4 w-4" /></span>
            <span className="font-medium">{dep.text.replace(/^./, (c) => c.toUpperCase())} — a warning, not a stop</span>
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------------- open issues: anything that comes up, each one someone's ---------------- */
/** "Today", "This week", "Before Fri" read in a sentence: today, this week, before Fri */
const dayWord = (d: string) => d.replace(/^(Today|Tomorrow|This|Next|Every|By|Before)\b/, (w) => w.toLowerCase())
export function OpenIssues({ job, className }: { job: Job; className?: string }) {
  const s = useStore()
  const me = meOf(s.role)
  const list = issuesOf(s, job)
  const [all, setAll] = React.useState(false)
  const shown = all ? list : list.slice(0, 4)
  const canAdd = !['client', 'accounting', 'crew'].includes(s.role)
  const bad = list.some((t) => t.tone === 'bad')
  return (
    <section data-issues className={cn('overflow-hidden rounded-[0.875rem] border bg-white', bad ? 'border-bad-200' : 'border-line', className)}>
      <header className={cn('flex min-w-0 items-center gap-2 border-b px-4 py-2.5', bad ? 'border-bad-100 bg-[#fdf6f5]' : 'border-line-2')}>
        <h4 className={cn('shrink-0 text-[0.9375rem] font-bold', bad ? 'text-bad-700' : 'text-ink')}>Open issues</h4>
        <span className="shrink-0 rounded-full bg-wash-2 px-1.5 text-[0.71875rem] font-bold tnum text-ink-2">{list.length}</span>
        <span className="min-w-0 truncate text-[0.75rem] text-muted max-sm:hidden">anything that comes up — each one is someone’s</span>
        {canAdd && (
          <Menu align="end" width={280} trigger={<button aria-label="Add an issue" className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-3.5 w-3.5" />Add</button>}>
            <MenuLabel>An issue on {job.name}</MenuLabel>
            <MenuItem icon={<TriangleAlert className="h-4 w-4" />} hint="Tile wrong, broken or short · site not ready" onSelect={() => s.open({ t: 'problem', jobId: job.id })}>A problem</MenuItem>
            <MenuItem icon={<Truck className="h-4 w-4" />} hint="Material or a tool, brought to the job" onSelect={() => s.open({ t: 'need', jobId: job.id })}>Need something on site</MenuItem>
            {allowedFor(s.role, 'task') && <MenuItem icon={<ListTodo className="h-4 w-4" />} hint="A question to answer, something to chase" onSelect={() => s.open({ t: 'newtask', jobId: job.id })}>Something for someone to do</MenuItem>}
          </Menu>
        )}
      </header>
      {!list.length
        ? <div className="px-4 py-2.5 text-[0.84375rem] text-muted">Nothing open.</div>
        : (
          <div className="p-1.5">
            {shown.map((t) => {
              const waiting = t.state === 'waiting'
              const due = waiting ? (t.followUp ? `follow up ${dayWord(t.followUp)}` : '') : t.due ? (/^(today|tomorrow|this |next |every )/i.test(t.due) ? dayWord(t.due) : /^(by|before) /i.test(t.due) ? dayWord(t.due) : `by ${t.due}`) : ''
              return (
                <button key={t.id} data-issue={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#f6f3ee]">
                  {isRequest(t) ? <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-[#fff1e3] text-[#c2410c]"><Truck className="h-3 w-3" /></span> : <StepIcon state={t.tone === 'bad' ? 'bad' : waiting ? 'wait' : 'now'} size={22} />}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[0.84375rem] font-semibold text-ink">{t.title}</span>
                    <span className="block truncate text-[0.75rem] text-muted"><b className={cn('font-semibold', t.tone === 'bad' ? 'text-bad-600' : 'text-ink-2')}>{issueKind(t)}</b>{t.where ? ` · ${t.where}` : t.by ? ` · from ${firstName(t.by)}` : ''}</span>
                  </span>
                  <span className="max-w-[40%] shrink-0 text-right leading-tight">
                    <span className={cn('block truncate text-[0.78125rem] font-semibold', waiting ? 'text-warn-700' : t.owner === me ? 'text-brand-700' : 'text-ink-2')}>{waiting ? `Waiting on ${t.waitingOn || 'them'}` : t.owner === me ? 'You' : firstName(t.owner)}</span>
                    {due && <span className="block truncate text-[0.71875rem] text-muted">{due}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      {list.length > shown.length && <button onClick={() => setAll(true)} className="flex w-full items-center justify-center gap-1 border-t border-line-2 px-4 py-2 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50/40">{list.length - shown.length} more<ChevronDown className="h-3.5 w-3.5" /></button>}
    </section>
  )
}

/* ---------------- once it's going: more tile, the changes, the touch-ups ---------------- */
function Box({ title, count, data, children, right }: { title: string; count?: number; data: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section {...{ [`data-${data}`]: '' }} className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
        <h4 className="text-[0.9375rem] font-bold text-ink">{title}</h4>
        {count != null && <span className="rounded-full bg-wash-2 px-1.5 text-[0.71875rem] font-bold tnum text-ink-2">{count}</span>}
        {right && <span className="ml-auto">{right}</span>}
      </header>
      <div className="p-1.5">{children}</div>
    </section>
  )
}
const ROW = 'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-[#f6f3ee]'

/** tile that came up short — reordered, coming, back to work */
function MoreTile({ job }: { job: Job }) {
  const s = useStore()
  const list = s.shortages.filter((x) => x.jobId === job.id && x.step !== 'received')
  if (!list.length) return null
  return (
    <Box title="More tile" count={list.length} data="more-tile">
      {list.map((x) => (
        <button key={x.id} onClick={() => s.open({ t: 'short', id: x.id })} className={ROW}>
          <span className={cn('inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full', x.stops ? 'bg-bad-50 text-bad-600' : 'bg-[#fbf3e3] text-warn-700')}><Package className="h-3 w-3" /></span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[0.84375rem] font-semibold text-ink">{x.tag} · {x.qty} {x.unit} short</span>
            <span className="block truncate text-[0.75rem] text-muted">{x.surfaces.map((y) => `${y.room} ${y.surface.toLowerCase()}`).join(', ')}{x.stops ? <b className="font-semibold text-bad-600"> · the crew is stopped</b> : null}</span>
          </span>
          <span className="max-w-[40%] shrink-0 truncate text-right text-[0.78125rem] font-semibold text-warn-700">{x.step === 'reordered' ? (x.eta ? `Coming ${x.eta.replace(/^\w+,\s*/, '')}` : `Reordered${x.orderedFrom ? ` · ${x.orderedFrom}` : ''}`) : <span className="text-bad-600">Not reordered yet</span>}</span>
        </button>
      ))}
    </Box>
  )
}

/** change orders — what changed from the contract, and where each one is */
function Changes({ job }: { job: Job }) {
  const s = useStore()
  /* the site manager sees what changed (it changes his work) — the prices are for whoever sees money */
  if (['crew', 'client'].includes(s.role)) return null
  const money = s.role !== 'site'
  const list = s.money.filter((m) => m.jobId === job.id && m.kind === 'change')
  if (!list.length) return null
  return (
    <Box title="Changes" count={list.length} data="changes">
      {list.map((m) => {
        const words = m.state === 'paid' ? { t: 'Paid', c: 'text-[#2c8a5b]' } : m.step < 0 ? { t: m.due || 'Waiting for the OK', c: 'text-warn-700' } : m.step >= 1 ? { t: 'Billed', c: 'text-ink-2' } : { t: m.due || 'Approved', c: 'text-[#2c8a5b]' }
        return (
          <button key={m.id} onClick={() => (money ? s.open({ t: 'money', id: m.id }) : s.open({ t: 'job', id: job.id, tab: 'scope' }))} className={ROW}>
            <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full bg-wash-2 text-ink-2"><FileText className="h-3 w-3" /></span>
            <span className="min-w-0 flex-1 truncate text-[0.84375rem] font-semibold text-ink">{m.title}</span>
            <span className="shrink-0 text-right leading-tight">
              {money && <span className="block text-[0.8125rem] font-semibold tnum text-ink">{m.amount ? fmtMoney(m.amount) : '—'}</span>}
              <span className={cn('block max-w-[11rem] truncate text-[0.71875rem] font-medium', words.c)}>{words.t}</span>
            </span>
          </button>
        )
      })}
    </Box>
  )
}

function TouchupsCard({ job }: { job: Job }) {
  const s = useStore()
  const canAdd = !['accounting', 'client', 'crew'].includes(s.role)
  return (
    <section data-touchups className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-center gap-2 border-b border-line-2 px-4 py-2.5">
        <h4 className="text-[0.9375rem] font-bold text-ink">Touch-ups</h4>
        {canAdd && <button onClick={() => s.open({ t: 'punchnew', jobId: job.id })} className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><Plus className="h-3.5 w-3.5" />Add</button>}
      </header>
      <div className="px-4 pb-3 pt-2"><TouchupsList job={job} /></div>
    </section>
  )
}
