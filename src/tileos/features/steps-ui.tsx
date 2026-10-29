/* The checklist on screen: the full list inside a project (Game plan tab), and a compact strip for the
 * Projects list. Every row: where it stands, the step, who has it, when, and the one button that does it. */
import * as React from 'react'
import { Check, X, Clock3, Minus, Plus, MoreHorizontal, ChevronDown, Truck, PackageCheck, PackageX, CalendarDays, CornerDownRight, Hourglass, Lock } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel, MenuSep, Pop, DatePresets, Tip } from '@/tileos/components/ui/overlay'
import { Path } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { labelFromIso, md, TODAY } from '@/tileos/lib/today'
import { stepsFor, stepCounts, markStep, reopenStep, skipStep, setStepOwner, markTileOrdered, checkInTile, addJobStep, removeJobStep, emptySpot, type StepView, type StepState } from './steps'
import { REAL } from '@/tileos/lib/save'
import { stepShort } from './tracks'

/** the people a step can belong to: everyone inside with a login */
export function insidePeople(s: Pick<Store, 'team'>): PersonKey[] {
  /* the real app: a login spot nobody has taken ("Estimator") isn't a person — it's never offered as one */
  const keys = s.team.filter((m) => m.status !== 'off' && m.role !== 'client' && m.role !== 'crew' && !(REAL.cloud && emptySpot(s, m.key))).map((m) => m.key)
  return Array.from(new Set(keys))
}

/* the marks on a track's path: ✓ done · blue your turn · dark ring someone's turn · amber waiting on someone outside ·
   red a problem · a lock: not yet — it opens when the one before it is done */
export function TrackDot({ state, mine, lead }: { state: StepState; mine?: boolean; lead?: boolean }) {
  const box = 'inline-flex h-[0.9375rem] w-[0.9375rem] shrink-0 items-center justify-center rounded-full'
  if (state === 'done') return <span className={cn(box, 'bg-[#2c8a5b] text-white')}><Check className="h-2.5 w-2.5" strokeWidth={3.6} /></span>
  if (state === 'bad') return <span className={cn(box, 'bg-[#d7342a] text-[0.625rem] font-black leading-none text-white')}>!</span>
  if (state === 'now' && mine) return <span className={cn(box, 'bg-[#2650cf]', lead && 'shadow-[0_0_0_0.1875rem_rgba(38,80,207,.18)]')} />
  if (state === 'now') return <span className={cn(box, 'border-2 border-[#3f4654] bg-white')}><span className="h-[0.3125rem] w-[0.3125rem] rounded-full bg-[#3f4654]" /></span>
  if (state === 'wait') return <span className={cn(box, 'border-2 border-[#d98c0b] bg-white text-[#d98c0b]')}><Hourglass className="h-2 w-2" strokeWidth={3} /></span>
  if (state === 'na') return <span className={cn(box, 'bg-wash-2 text-faint')}><Minus className="h-2.5 w-2.5" strokeWidth={3} /></span>
  return <span className={cn(box, 'border-[0.09375rem] border-dashed border-[#bfb8ad] bg-white text-[#a39b8e]')}><Lock className="h-2 w-2" strokeWidth={3} /></span>
}
export const DOT_LABEL: Record<StepState, string> = { done: 'text-ink-2', now: 'font-semibold text-ink', bad: 'font-semibold text-bad-600', wait: 'font-medium text-warn-700', later: 'text-muted', na: 'text-faint line-through' }

/** where a step stands, the same mark everywhere: ✓ done · ● to do · ◷ waiting · ! problem · ○ not yet · – not needed */
export function StepIcon({ state, size = 26 }: { state: StepState; size?: number }) {
  const box = { width: size, height: size }
  const ic = size >= 26 ? 'h-3.5 w-3.5' : size > 16 ? 'h-3 w-3' : 'h-2.5 w-2.5'
  if (state === 'done') return <span style={box} className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#2c4a3e] text-white"><Check className={ic} strokeWidth={3.2} /></span>
  if (state === 'bad') return <span style={{ ...box, fontSize: Math.round(size * 0.58) }} className="inline-flex shrink-0 items-center justify-center rounded-full bg-bad-500 font-black leading-none text-white">!</span>
  if (state === 'wait') return <span style={box} className="inline-flex shrink-0 items-center justify-center rounded-full bg-white text-[#7a8494] ring-[0.09375rem] ring-inset ring-[#c6bfb4]"><Clock3 className={ic} strokeWidth={2.4} /></span>
  if (state === 'now') return <span style={box} className="inline-flex shrink-0 items-center justify-center rounded-full bg-white ring-2 ring-inset ring-ink"><span className={cn('rounded-full bg-ink', size > 16 ? 'h-2 w-2' : 'h-1.5 w-1.5')} /></span>
  if (state === 'na') return <span style={box} className="inline-flex shrink-0 items-center justify-center rounded-full bg-wash-2 text-faint"><Minus className={ic} strokeWidth={2.4} /></span>
  return <span style={box} className="inline-flex shrink-0 rounded-full border-[0.09375rem] border-dashed border-[#c9c2b7] bg-white" />
}

/** where a step is, in a few words — the same words everywhere */
export function stepWords(s: Store, job: Job, v: StepView, me: PersonKey): { text: string; tone: string } {
  const day = (iso: string) => (iso === TODAY ? 'today' : labelFromIso(iso) === 'Tomorrow' ? 'tomorrow' : labelFromIso(iso))
  const mine = v.owner === me
  switch (v.state) {
    case 'done': return { text: v.doneOn ? `Done ${v.doneOn}` : 'Done', tone: 'text-muted' }
    case 'na': return { text: 'Not needed on this project', tone: 'text-faint' }
    case 'bad': return { text: `Problem${mine ? ' · your turn' : ''}`, tone: 'font-semibold text-bad-600' }
    case 'later': {
      const before = v.waitsKey ? stepsFor(s, job).find((x) => x.key === v.waitsKey) : undefined
      const name = before ? stepShort(s, job, before) : v.waitsFor
      return { text: name ? `After ${name}` : 'Not yet', tone: 'text-muted' }
    }
    case 'wait': {
      if (['delivered', 'matin'].includes(v.key)) return { text: v.due ? `Coming ${day(v.due)}` : 'On the way', tone: 'text-warn-700' }
      if (['design', 'walk'].includes(v.key)) return { text: v.due ? `Set for ${day(v.due)}` : 'Set', tone: 'text-warn-700' }
      const rec = s.stepRecs[job.id]?.[v.key]
      const task = v.taskId ? s.tasks.find((x) => x.id === v.taskId) : undefined
      const ipo = v.key === 'confirmed' ? [...s.ipos].reverse().find((x) => x.jobId === job.id) : undefined
      const on = rec?.wait?.on || task?.waitingOn || (v.key === 'qty' ? 'the store’s new paperwork' : ipo ? PEOPLE[ipo.crew]?.short : '')
      const back = v.due ? (v.due <= TODAY ? ' · follow up today' : ` · back ${day(v.due)}`) : ''
      return { text: `${on ? `Waiting on ${on}` : 'Waiting'}${back}`, tone: 'text-warn-700' }
    }
    default: {
      if (v.due && v.due < TODAY) return { text: `Late · was due ${labelFromIso(v.due)}`, tone: 'font-semibold text-bad-600' }
      if (mine) return { text: `Your turn${v.due ? ` · due ${day(v.due)}` : ''}`, tone: 'font-semibold text-brand-700' }
      return { text: v.due ? `Due ${day(v.due)}` : 'To do', tone: 'text-ink-2' }
    }
  }
}

const STATE_WORD: Record<StepState, string> = { done: 'Done', now: 'To do', wait: 'Waiting', later: 'Not yet', bad: 'Problem', na: 'Not needed' }

/** the step's one button: it opens the step's own window, where it gets done */
export function StepButton({ job, v, size = 'sm' }: { job: Job; v: StepView; size?: 'sm' | 'xs' }) {
  const s = useStore()
  if (!v.action && v.state === 'done') return null
  const primary = v.state === 'now' || v.state === 'bad'
  return (
    <Button size={size} variant={primary ? 'secondary' : 'ghost'} className={cn(primary && 'border-[#c9c2b7] text-ink')} onClick={(e) => { e.stopPropagation(); s.open({ t: 'step', jobId: job.id, k: v.key }) }}>
      {v.action?.label || 'Open'}
    </Button>
  )
}

/** who has a step — tap to hand it to someone else on this project */
function OwnerChip({ job, v, compact }: { job: Job; v: StepView; compact?: boolean }) {
  const s = useStore()
  return (
    <Menu
      align="end"
      width={260}
      trigger={
        <button onClick={(e) => e.stopPropagation()} className="inline-flex max-w-full items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 text-[0.8125rem] font-medium text-ink-2 transition hover:bg-wash-2">
          <Avatar who={v.owner} size={24} />
          {!compact && <span className="truncate">{PEOPLE[v.owner]?.short}</span>}
        </button>
      }
    >
      <MenuLabel>Who has “{v.short}” on {job.name}</MenuLabel>
      {insidePeople(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={v.owner === p} hint={PEOPLE[p].roleLabel} onSelect={() => setStepOwner(job.id, v.key, p)}>{PEOPLE[p].name}</MenuItem>)}
    </Menu>
  )
}

/** where getting ready stands, as a bar of steps — the same look as the estimate's */
export function StepPath({ job }: { job: Job }) {
  const s = useStore()
  const steps = stepsFor(s, job).filter((v) => v.state !== 'na')
  return (
    <section className="rounded-[0.875rem] border border-line bg-white px-3 pb-3 pt-2">
      <Path
        steps={steps.map((v) => ({
          key: v.key,
          label: v.short,
          state: v.state === 'done' ? 'done' : v.state === 'bad' ? 'blocked' : v.state === 'later' ? 'future' : 'current',
          sub: PEOPLE[v.owner]?.short,
          date: v.state === 'done' ? (v.doneOn || 'Done') : v.due ? labelFromIso(v.due) : v.state === 'wait' ? 'Waiting' : undefined,
          onClick: () => s.open({ t: 'step', jobId: job.id, k: v.key }),
        }))}
      />
    </section>
  )
}

/** the full checklist for one project: what's up now first, what comes after, and what's done folded away */
export function StepsList({ job }: { job: Job }) {
  const s = useStore()
  const steps = stepsFor(s, job)
  const c = stepCounts(steps)
  const [adding, setAdding] = React.useState(false)
  const [showDone, setShowDone] = React.useState(false)
  const now = steps.filter((v) => v.state === 'now' || v.state === 'bad' || v.state === 'wait')
  const later = steps.filter((v) => v.state === 'later')
  const done = steps.filter((v) => v.state === 'done' || v.state === 'na')
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5 max-sm:px-4">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold text-ink">Getting ready</h3>
          <div className="text-[0.78125rem] text-muted">Each step opens when the one before it is done — then it’s on that person’s Today.</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-2 text-[0.8125rem] font-semibold tnum text-ink-2">
            <StepBar steps={steps} w={120} />{c.done} of {c.total}
          </span>
          <Button size="sm" icon={<Plus />} onClick={() => setAdding((x) => !x)}>Add a step</Button>
        </div>
      </header>
      {adding && <AddStep job={job} steps={steps} onDone={() => setAdding(false)} />}
      <div>
        {now.length > 0 && <GroupHead label="Now" count={now.length} />}
        {now.map((v) => <StepRow key={v.key} job={job} v={v} />)}
        {later.length > 0 && <GroupHead label="After that" count={later.length} />}
        {later.map((v) => <StepRow key={v.key} job={job} v={v} />)}
        {done.length > 0 && (
          <button onClick={() => setShowDone(!showDone)} className="flex w-full items-center gap-2 border-t border-line-2 bg-wash/60 px-5 py-2 text-left text-[0.78125rem] font-semibold text-muted hover:text-ink max-sm:px-4">
            <ChevronDown className={cn('h-3.5 w-3.5 transition', !showDone && '-rotate-90')} />Done <span className="font-medium text-faint">{done.length}</span>
          </button>
        )}
        {showDone && done.map((v) => <StepRow key={v.key} job={job} v={v} />)}
      </div>
    </section>
  )
}

function GroupHead({ label, count }: { label: string; count: number }) {
  return <div className="border-t border-line-2 bg-wash/60 px-5 py-1.5 text-[0.71875rem] font-semibold text-muted first:border-t-0 max-sm:px-4">{label} <span className="font-semibold text-faint">{count}</span></div>
}

function StepRow({ job, v }: { job: Job; v: StepView }) {
  const s = useStore()
  const task = v.taskId ? s.tasks.find((t) => t.id === v.taskId) : undefined
  const when = v.state === 'done'
    ? (v.doneOn ? `Done ${v.doneOn}` : 'Done')
    : v.due ? (v.state === 'wait' ? labelFromIso(v.due) : `Due ${labelFromIso(v.due)}`) : ''
  return (
    <div id={`step-${job.id}-${v.key}`} className={cn('group grid grid-cols-[1.75rem_minmax(0,1fr)_9.375rem_6.875rem_10.75rem_2rem] items-center gap-3 border-t border-line-2 px-5 py-2.5 first:border-t-0 max-lg:grid-cols-[1.75rem_minmax(0,1fr)_2rem] max-lg:items-start max-sm:px-4', v.state === 'later' && 'bg-[#fbfbfc]')}>
      <span className="max-lg:mt-0.5"><StepIcon state={v.state} /></span>
      <span className="min-w-0">
        <button disabled={!task} onClick={() => task && s.open({ t: 'task', id: task.id })} className="block w-full min-w-0 text-left disabled:cursor-default">
          <span className={cn('block truncate text-[0.875rem] font-semibold max-lg:whitespace-normal', v.state === 'done' || v.state === 'na' ? 'text-muted' : v.state === 'later' ? 'text-ink-2' : 'text-ink')}>
            {v.label}
            {v.only && <span className="ml-2 align-[0.0625rem] text-[0.71875rem] font-medium text-faint">this project only</span>}
          </span>
          <span className={cn('block truncate text-[0.78125rem] max-lg:whitespace-normal', v.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>
            {v.state === 'later' ? <span className="inline-flex items-center gap-1"><CornerDownRight className="h-3 w-3" />After {v.waitsFor?.toLowerCase()}{v.note && !/^After /.test(v.note) && v.note !== 'Not built yet' ? ` · ${v.note}` : ''}</span> : v.note || STATE_WORD[v.state]}
          </span>
        </button>
        {/* phones and small windows: who, when and the button go under the step */}
        <span className="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
          <OwnerChip job={job} v={v} />
          {when && <span className="text-[0.78125rem] text-muted">{when}</span>}
          {v.state !== 'done' && v.state !== 'later' && v.state !== 'na' && <span className="ml-auto"><StepButton job={job} v={v} size="xs" /></span>}
        </span>
      </span>
      <span className="min-w-0 max-lg:hidden"><OwnerChip job={job} v={v} /></span>
      <span className={cn('truncate text-[0.8125rem] tnum max-lg:hidden', v.state === 'bad' || (v.due && v.state === 'now' && /was due/i.test(v.note || '')) ? 'font-semibold text-bad-600' : 'text-muted')}>{when}</span>
      <span className="flex justify-end max-lg:hidden">{v.state !== 'done' && v.state !== 'later' && v.state !== 'na' && <StepButton job={job} v={v} />}</span>
      <Menu align="end" width={250} trigger={<button aria-label={`More · ${v.short}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-faint opacity-60 transition hover:bg-wash-2 hover:text-ink group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></button>}>
        <MenuLabel>{v.short}</MenuLabel>
        {v.custom && v.state !== 'done' && v.state !== 'later' && <MenuItem icon={<Check className="h-4 w-4" />} onSelect={() => markStep(job.id, v.key)}>Mark done</MenuItem>}
        {v.custom && v.state === 'done' && <MenuItem onSelect={() => reopenStep(job.id, v.key)}>Not done after all</MenuItem>}
        {v.state !== 'na' ? <MenuItem onSelect={() => skipStep(job.id, v.key, true)} hint="It drops out of the count">Not needed on this project</MenuItem> : <MenuItem onSelect={() => skipStep(job.id, v.key, false)}>Needed after all</MenuItem>}
        {v.only && <><MenuSep /><MenuItem danger onSelect={() => removeJobStep(job.id, v.key)}>Remove this step</MenuItem></>}
      </Menu>
    </div>
  )
}

export function AddStep({ job, steps, onDone, compact }: { job: Job; steps: StepView[]; onDone: () => void; compact?: boolean }) {
  const s = useStore()
  const [label, setLabel] = React.useState('')
  const [owner, setOwner] = React.useState<PersonKey>('yakov')
  const [after, setAfter] = React.useState<string>('')
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; addJobStep(job.id, label.trim(), owner, after || undefined); onDone() }}
      className={cn('flex flex-wrap items-center gap-2 bg-wash', compact ? 'border-t border-line-2 px-4 py-3' : 'border-b border-line px-5 py-3 max-sm:px-4')}
    >
      <TextInput autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder={compact ? 'What has to be checked' : 'What has to be checked — e.g. Drain locations with the plumber'} className={cn('h-9 flex-1 bg-white', compact ? 'w-full min-w-0 basis-full' : 'min-w-[16.25rem]')} />
      <Menu align="end" width={260} trigger={<button type="button" className="inline-flex h-9 items-center gap-2 rounded-[0.625rem] border border-line bg-white pl-1.5 pr-2.5 text-[0.84375rem] font-medium text-ink-2 hover:bg-wash"><Avatar who={owner} size={22} />{PEOPLE[owner].short}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
        <MenuLabel>Who does it</MenuLabel>
        {insidePeople(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={owner === p} hint={PEOPLE[p].roleLabel} onSelect={() => setOwner(p)}>{PEOPLE[p].name}</MenuItem>)}
      </Menu>
      <Menu align="end" width={260} trigger={<button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-[0.625rem] border border-line bg-white px-2.5 text-[0.84375rem] font-medium text-ink-2 hover:bg-wash">{after ? `After ${steps.find((x) => x.key === after)?.short.toLowerCase()}` : 'Starts now'}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
        <MenuLabel>When it opens</MenuLabel>
        <MenuItem checked={!after} onSelect={() => setAfter('')}>Right away</MenuItem>
        {steps.map((x) => <MenuItem key={x.key} checked={after === x.key} onSelect={() => setAfter(x.key)}>After {x.short.toLowerCase()}</MenuItem>)}
      </Menu>
      <Button type="submit" size="sm" variant="primary" disabled={!label.trim()}>Add</Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
    </form>
  )
}

/* ---------------- compact: one strip per project in the list ---------------- */
const SEG: Record<StepState, string> = { done: 'bg-ok-500', now: 'bg-brand-500', wait: 'bg-warn-500', bad: 'bg-bad-500', later: 'bg-[#e1dcd2]', na: 'bg-transparent' }
export function StepBar({ steps, w = 140 }: { steps: StepView[]; w?: number }) {
  const shown = steps.filter((x) => x.state !== 'na')
  return (
    <span className="inline-flex shrink-0 gap-[0.1875rem]" style={{ width: w }}>
      {shown.map((x) => <Tip key={x.key} label={`${x.short} — ${STATE_WORD[x.state]}${x.state !== 'done' ? ` · ${PEOPLE[x.owner]?.short}` : ''}`}><span className={cn('h-[0.375rem] flex-1 rounded-full', SEG[x.state])} /></Tip>)}
    </span>
  )
}

/** the open steps as short words, with the people who have them */
export function OpenSteps({ steps, max = 3 }: { steps: StepView[]; max?: number }) {
  const open = steps.filter((x) => ['now', 'bad', 'wait'].includes(x.state))
  if (!open.length) return <span className="text-[0.8125rem] font-medium text-ok-700">Ready to start</span>
  const order: Record<string, number> = { bad: 0, now: 1, wait: 2 }
  const sorted = [...open].sort((a, b) => order[a.state] - order[b.state])
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {sorted.slice(0, max).map((x) => (
        <Tip key={x.key} label={`${x.label} — ${PEOPLE[x.owner]?.name}${x.note ? ` · ${x.note}` : ''}`}>
          <span className={cn('inline-flex h-7 min-w-0 shrink items-center gap-1.5 rounded-full border bg-white py-0.5 pl-0.5 pr-2.5 text-[0.78125rem] font-medium', x.state === 'bad' ? 'border-bad-100 text-bad-700' : x.state === 'wait' ? 'border-warn-100 text-warn-700' : 'border-line text-ink-2')}>
            <Avatar who={x.owner} size={22} />
            <span className="truncate">{x.short}</span>
          </span>
        </Tip>
      ))}
      {sorted.length > max && <span className="shrink-0 text-[0.78125rem] font-semibold text-muted">+{sorted.length - max}</span>}
    </span>
  )
}

/** a short line for what we're waiting on outside the company (deliveries, the GC, invoices) */
export function waitingOutside(steps: StepView[]): string[] {
  return steps.filter((x) => x.state === 'wait').map((x) => (x.key === 'delivered' && x.due ? `Tile ${labelFromIso(x.due).toLowerCase() === 'today' ? 'today' : labelFromIso(x.due)}` : x.key === 'deposit' ? 'Deposit payment' : x.key === 'confirmed' ? 'Installer to say yes' : x.key === 'matin' ? 'Materials delivery' : x.key === 'qty' ? 'New paperwork' : x.short))
}

export function useMe() { return meOf(useStore((s) => s.role)) }
export { md }

/* ---------------- the checklist on the side of a project: one short line per step ---------------- */
export function StepsSide({ job }: { job: Job }) {
  const s = useStore()
  const steps = stepsFor(s, job)
  const c = stepCounts(steps)
  const [adding, setAdding] = React.useState(false)
  const pct = Math.round((c.done / Math.max(1, c.total)) * 100)
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="border-b border-line px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-[0.90625rem] font-semibold text-ink">Getting ready</h3>
          <span className="text-[0.78125rem] font-semibold tnum text-muted">{c.done} of {c.total} done</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-wash-2"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.max(3, pct)}%` }} /></div>
      </header>
      <ol className="py-1">{steps.map((v) => <SideStep key={v.key} job={job} v={v} />)}</ol>
      {adding ? <AddStep job={job} steps={steps} onDone={() => setAdding(false)} compact /> : (
        <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 border-t border-line-2 px-4 py-2.5 text-left text-[0.8125rem] font-semibold text-muted transition row-hover hover:text-ink"><Plus className="h-4 w-4" />Add a step</button>
      )}
    </section>
  )
}
function SideStep({ job, v }: { job: Job; v: StepView }) {
  const [open, setOpen] = React.useState(false)
  const quiet = v.state === 'done' || v.state === 'na'
  const sub = v.state === 'later' ? `After ${v.waitsFor?.toLowerCase()}` : v.state === 'done' ? (v.doneOn ? `Done ${v.doneOn}` : 'Done') : v.state === 'na' ? 'Not needed here' : v.note || STATE_WORD[v.state]
  return (
    <li>
      <Pop open={open} onOpenChange={setOpen} side="left" align="start" width={340} trigger={
        <button className={cn('flex w-full items-center gap-2.5 px-4 py-[0.4375rem] text-left transition row-hover', open && 'bg-[#f3f5f8]')}>
          <StepIcon state={v.state} size={20} />
          <span className="min-w-0 flex-1">
            <span className={cn('block truncate text-[0.84375rem] font-semibold leading-5', quiet ? 'text-muted' : v.state === 'later' ? 'text-ink-2' : 'text-ink')}>{v.short}</span>
            <span className={cn('block truncate text-[0.75rem] leading-4', v.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{sub}</span>
          </span>
          {!quiet && <Avatar who={v.owner} size={22} />}
        </button>
      }>
        <div className="flex items-start gap-2.5">
          <StepIcon state={v.state} size={22} />
          <div className="min-w-0">
            <div className="text-[0.875rem] font-semibold leading-snug text-ink">{v.label}</div>
            <div className={cn('mt-0.5 text-[0.78125rem] leading-snug', v.state === 'bad' ? 'font-medium text-bad-600' : 'text-muted')}>{sub}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-2 pt-3 text-[0.78125rem]">
          <span className="text-muted">Who has it</span>
          <OwnerChip job={job} v={v} />
        </div>
        {v.due && <div className="mt-2 flex items-center justify-between text-[0.78125rem]"><span className="text-muted">When</span><span className="font-medium text-ink-2">{labelFromIso(v.due)}</span></div>}
        <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5">
          {v.state !== 'na' && v.state !== 'done' && <Button size="sm" variant="ghost" onClick={() => { skipStep(job.id, v.key, true); setOpen(false) }}>Not needed</Button>}
          {v.state === 'na' && <Button size="sm" variant="ghost" onClick={() => { skipStep(job.id, v.key, false); setOpen(false) }}>Needed after all</Button>}
          {v.custom && v.state === 'done' && <Button size="sm" variant="ghost" onClick={() => { reopenStep(job.id, v.key); setOpen(false) }}>Not done after all</Button>}
          {v.only && <Button size="sm" variant="ghost" className="text-bad-600" onClick={() => { removeJobStep(job.id, v.key); setOpen(false) }}>Remove</Button>}
          {v.custom && v.state !== 'done' && v.state !== 'later' && v.state !== 'na' && <Button size="sm" variant="primary" icon={<Check />} onClick={() => { markStep(job.id, v.key); setOpen(false) }}>Mark done</Button>}
          {!v.custom && v.state !== 'done' && v.state !== 'later' && v.state !== 'na' && <StepButton job={job} v={v} />}
        </div>
      </Pop>
    </li>
  )
}
