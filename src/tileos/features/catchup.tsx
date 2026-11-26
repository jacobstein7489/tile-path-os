/* Bring projects up to date. The ones brought in (from Asana, or from their estimates) come in with only what Asana
 * knew — not who the site manager is, how far the crew got, which parts of getting ready are done. One project at a
 * time, a few taps each — just the basics: the client, where it stands, what's done already, the installer, the site
 * manager, how far, the start and the finish. Its papers can be attached if they're handy — they're kept on the project
 * (Documents); nothing is read or filled in from them here (the rooms, the tiles, the layouts come later, on the projects
 * picked for it).
 * It opens on the list: every one of them, what's set up (✓) and what isn't yet — and what's still missing on it (the
 * client, the installer, the site manager, the start). Tap any one; Save & close saves it and goes back to the list,
 * where it's ticked — you pick the next one yourself. Nothing's laid out as a wall of choices: each answer is one box you tap (the installer is typed to
 * find him, however many there are). The same form, for one project, is the office's say on where it's up to — from
 * the project's ··· menu, without going through its steps one by one. */
import * as React from 'react'
import { Building2, CalendarCheck, Check, ChevronLeft, ChevronRight, CircleCheckBig, ClipboardList, ExternalLink, FileText, HardHat, Paperclip, Pause, Plus, Sparkles, UserRound } from 'lucide-react'
import { useStore, addHist, meOf, NOW, newTask, closeTasks, type Store } from '@/tileos/store'
import { Avatar, Button, TextInput } from '@/tileos/components/ui/core'
import { Group } from '@/tileos/components/ui/page'
import { Modal, DateField } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, type Customer, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { labelFromIso, isoFromLabel, TODAY } from '@/tileos/lib/today'
import { companySteps, FOLLOW_UPS, BEFORE_TILE_OS } from './steps'
import { tracksFor, TRACKS, type TrackKey } from './tracks'
import { isOff } from './active'
import { keepFiles } from '@/tileos/lib/files'

const PRICING: Stage[] = ['request', 'estimating', 'proposal', 'followup']
const BEFORE_START: Stage[] = ['awarded', 'setup', 'verification', 'ready', 'scheduled']
const BEFORE = BEFORE_TILE_OS
const brought = (s: Pick<Store, 'hist'>, j: Job) => (s.hist[j.id] || []).find((h) => /^Brought in/.test(h.title))
/** came in from Asana or an estimate, rather than made here step by step */
const broughtIn = (s: Pick<Store, 'hist'>, j: Job) => !!brought(s, j) || j.keyDate?.label === 'Brought in'
/** a project that's going — won, not finished */
const isOpen = (j: Job) => !PRICING.includes(j.stage) && !['closeout', 'complete'].includes(j.stage)
/** brought in and not gone through yet */
export const needsCatchUp = (s: Pick<Store, 'hist'>, j: Job) => !j.caughtUp && isOpen(j) && broughtIn(s, j)
/** the busiest first: in progress, touch-ups, then getting ready */
const rank = (j: Job) => (j.stage === 'installation' ? 0 : j.stage === 'punch' ? 1 : 2)
/** the ones to go through */
export function catchUpList(s: Store): Job[] {
  return Object.values(s.jobs).filter((j) => needsCatchUp(s, j)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}
/** every brought-in project that's open — gone through or not (the list a run works through) */
export function broughtOpenList(s: Store): Job[] {
  return Object.values(s.jobs).filter((j) => isOpen(j) && broughtIn(s, j)).sort((a, b) => Number(!!a.caughtUp) - Number(!!b.caughtUp) || rank(a) - rank(b) || a.name.localeCompare(b.name))
}
/** every open project — the ones nobody went through yet first */
export function allOpenList(s: Store): Job[] {
  return Object.values(s.jobs).filter(isOpen).sort((a, b) => Number(!!a.caughtUp) - Number(!!b.caughtUp) || rank(a) - rank(b) || a.name.localeCompare(b.name))
}
/** the stand-in client a job came in with when Asana didn't say whose it was */
const TO_CONFIRM = /^client to confirm$/i
const clientSet = (s: Store, j: Job) => !!j.clientId && !TO_CONFIRM.test(j.client || '') && !TO_CONFIRM.test((s.clients[j.clientId] || CUSTOMERS[j.clientId])?.name || '')
const GC_WORDS = /\b(llc|inc|corp|co|construction|builders?|group|development|properties|homes|contracting|realty|management)\b/i

type Where = 'new' | 'ready' | 'installing' | 'touchups' | 'done'
const WHERE: { key: Where; label: string }[] = [
  { key: 'new', label: 'Getting ready' },
  { key: 'ready', label: 'Ready for the crew' },
  { key: 'installing', label: 'In progress' },
  { key: 'touchups', label: 'Touch-ups' },
  { key: 'done', label: 'Finished' },
]
const whereWord = (w: Where) => WHERE.find((x) => x.key === w)!.label
/** where it stands, each with its own mark — the same marks and colors as the bubbles on Projects */
const WHERE_MARK: Record<Where, { icon: React.ReactNode; tint: string; solid: string }> = {
  new: { icon: <ClipboardList />, tint: '#f1eefb', solid: '#6b55c9' },
  ready: { icon: <CalendarCheck />, tint: '#eaf0fc', solid: '#2650cf' },
  installing: { icon: <HardHat />, tint: '#e9f5ee', solid: '#23854f' },
  touchups: { icon: <Sparkles />, tint: '#fbf2e2', solid: '#b06a0c' },
  done: { icon: <CircleCheckBig />, tint: '#f1efea', solid: '#646a74' },
}
const whereLead = (w: Where) => <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5" style={{ background: WHERE_MARK[w].tint, color: WHERE_MARK[w].solid }}>{WHERE_MARK[w].icon}</span>
/** on hold is one of where it stands — the same box (what it was at stays under it, for when it's taken off hold) */
const HOLD_LEAD = <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5" style={{ background: '#fdecea', color: '#c4320a' }}><Pause /></span>
/** what's done already, one tap each — the same things, in the same words, as on the project. The estimate isn't one:
 *  it's in once it's uploaded on the project, so the rooms are really there */
const PARTS: { key: TrackKey; label: string }[] = TRACKS.filter((t) => t.key !== 'estimate').map((t) => ({ key: t.key, label: t.label }))
/** ready for the crew = every one of them is done */
const READY_PARTS: TrackKey[] = PARTS.map((p) => p.key)
type Draft = { clientId: string; where: Where; parts: TrackKey[]; crew: string; site: string; pct: string; start: string; finish: string; hold: boolean; why: string; /** on hold until this day (iso) */ until: string }
function draftOf(s: Store, j: Job): Draft {
  const done = tracksFor(s, j).filter((t) => t.state === 'done').map((t) => t.key)
  const where: Where = j.stage === 'installation' ? 'installing' : j.stage === 'punch' ? 'touchups' : ['closeout', 'complete'].includes(j.stage) ? 'done' : READY_PARTS.every((k) => done.includes(k)) ? 'ready' : 'new'
  const prep = s.prep[j.id]
  const startIso = BEFORE_START.includes(j.stage) ? prep?.targetISO : isoFromLabel(j.dates?.start)
  /* a brought-in project's site manager only when Asana named one — otherwise it was a stand-in, so it's asked */
  const site = !broughtIn(s, j) || j.caughtUp || /Site manager:/.test(brought(s, j)?.detail || '') ? j.site || '' : ''
  const crew = j.crew || (prep?.installer && prep.installer !== 'tbd' ? String(prep.installer) : '')
  return { clientId: clientSet(s, j) ? j.clientId : '', where, parts: done, crew, site, pct: j.pct ? String(j.pct) : '', start: startIso || '', finish: isoFromLabel(j.dates?.finish) || '', hold: !!j.hold, why: j.hold?.reason || '', until: isoFromLabel(j.hold?.until) || '' }
}
/** the link back to the job in Asana — from its history */
const asanaOf = (s: Store, j: Job) => (s.hist[j.id] || []).map((h) => h.detail?.match(/https:\/\/app\.asana\.com\/[^\s—]+/)?.[0]).find(Boolean)
/** what's up next on a project that's getting ready — the first part that isn't done */
const NEXT_UP: { part: TrackKey; text: string; owner: PersonKey }[] = [
  { part: 'tile', text: 'Get the tile paperwork', owner: 'estimator' },
  { part: 'scope', text: 'Set the design meeting', owner: 'office' },
  { part: 'site', text: 'Check the site', owner: 'yakov' },
  { part: 'installer', text: 'Send the installer his PO', owner: 'ys' },
  { part: 'materials', text: 'Order the materials', owner: 'ys' },
  { part: 'delivery', text: 'Receive the tile', owner: 'yakov' },
]

/** save one project the way it was set: the client, where it stands (and what's checked off with it), the people, how
 *  far, dates — said with a pop (msg); closed when it's the one project (close) */
function save(jobId: string, d: Draft, msg?: string, opts?: { close?: boolean; sub?: string }) {
  const st0 = useStore.getState()
  const me = meOf(st0.role)
  st0.commit((st) => {
    const j = st.jobs[jobId]
    if (!j) return
    /* whose it is */
    const c = d.clientId ? st.clients[d.clientId] || CUSTOMERS[d.clientId] : undefined
    if (c && c.id !== j.clientId) { j.clientId = c.id; j.client = c.name }
    const stage: Stage = d.where === 'installing' ? 'installation' : d.where === 'touchups' ? 'punch' : d.where === 'done' ? 'complete' : BEFORE_START.includes(j.stage) ? j.stage : 'setup'
    j.stage = stage
    /* what's done already: everything once the crew started; while it's getting ready, what was tapped — its main
       steps. What only follows them (the scope after the meeting, the layouts, the walk-through, the room sheets) isn't
       said to be done — nobody did it here: it's not tracked on this project. Fix problems is only ever there when the
       site check found something, and the estimate is in once its rooms are */
    const all = !BEFORE_START.includes(stage)
    const tracks = tracksFor(st, j)
    const recs = (st.stepRecs[jobId] ||= {})
    const partOf = (k: string) => tracks.find((t) => t.steps.some((v) => v.key === k))?.key
    companySteps(st).forEach((def) => {
      const r = recs[def.key]
      if (def.key === 'estimate') return
      if (def.key === 'fixes') { if (r?.note === BEFORE) delete recs.fixes; return }
      const part = partOf(def.key)
      const on = all || def.key === 'deposit' || (!!part && d.parts.includes(part))
      const follow = FOLLOW_UPS.has(def.key)
      if (on) {
        if (!r?.done && !r?.na) recs[def.key] = follow ? { ...(r || {}), na: true, by: me, note: BEFORE } : { ...(r || {}), done: NOW, by: me, note: BEFORE }
        else if (follow && r?.done && r.note === BEFORE) { const { done: _, ...rest } = r; recs[def.key] = { ...rest, na: true } }
      }
      else if (r?.note === BEFORE) delete recs[def.key]
    })
    /* the people */
    const crew = d.crew && (CREWS as string[]).includes(d.crew) ? (d.crew as PersonKey) : undefined
    if (crew) j.crew = crew
    else delete j.crew
    const prep = (st.prep[jobId] ||= { target: 'TBD', meeting: { text: 'TBD' }, installer: 'tbd', confirmed: 'no', paperwork: 'no', po: 'no', material: 'no', deposit: 'na' } as any)
    prep.installer = crew || 'tbd'
    if (d.site) j.site = d.site as PersonKey
    /* how far, the dates */
    if (stage === 'installation') j.pct = Math.max(0, Math.min(100, Math.round(Number(d.pct) || 0)))
    if (BEFORE_START.includes(stage)) {
      if (d.start) { prep.targetISO = d.start; prep.target = labelFromIso(d.start) } else { delete prep.targetISO; prep.target = 'TBD' }
    } else if (d.where !== 'done') {
      const dates = { ...(j.dates || {}) } as Record<string, string>
      if (d.start) dates.start = labelFromIso(d.start)
      else delete dates.start
      if (d.finish) dates.finish = labelFromIso(d.finish)
      else delete dates.finish
      j.dates = dates as any
    }
    /* on hold, why, and until when — that day a to-do on your Today to check in (taken off hold sooner: it's gone) */
    if (d.hold && d.where !== 'done') j.hold = { reason: d.why.trim() || 'On hold', since: j.hold?.since || NOW, by: j.hold?.by || me, ...(d.until ? { until: labelFromIso(d.until) } : {}) }
    else delete j.hold
    const check = st.tasks.filter((t) => t.jobId === jobId && t.state !== 'done' && t.action?.kind === 'catchup')
    if (j.hold?.until) {
      const title = `Check in on ${j.name}: on hold until ${j.hold.until}`
      const t0 = check[0]
      if (t0) { t0.title = title; t0.due = j.hold.until; t0.where = j.hold.reason }
      else newTask(st, { jobId, title, type: 'Field', owner: me, for: ['owner', 'pm'], state: 'now', due: j.hold.until, tone: 'warn', where: j.hold.reason, action: { label: 'Where it’s up to', kind: 'catchup' } })
      closeTasks(st, check.slice(1).map((t) => t.id), 'Off hold')
    } else closeTasks(st, check.map((t) => t.id), j.hold ? 'No day to check in' : 'Off hold')
    j.status = j.hold ? 'bad' : 'info'
    j.headline = j.hold ? `On hold · ${j.hold.reason}` : whereWord(d.where)
    const site = (d.site || j.site || 'yakov') as PersonKey
    if (stage === 'installation') j.next = { text: 'Keep the daily updates going', owner: site }
    else if (stage === 'punch') j.next = { text: 'Finish the touch-ups', owner: site }
    else if (BEFORE_START.includes(stage)) {
      const up = !(st.rooms[jobId] || []).length ? { text: 'Add the estimate', owner: 'estimator' as PersonKey } : NEXT_UP.find((n) => !d.parts.includes(n.part))
      j.next = up ? { text: up.text, owner: up.owner, due: 'This week' } : { text: 'Schedule the crew', owner: 'ys', due: 'This week' }
    }
    j.caughtUp = NOW
    addHist(st, jobId, { who: me, kind: 'setup', title: 'Brought up to date', detail: [whereWord(d.where), crew ? `installer ${PEOPLE[crew]?.short || crew}` : '', d.site ? `site manager ${PEOPLE[d.site as PersonKey]?.short || d.site}` : '', stage === 'installation' ? `${j.pct}% in` : '', j.hold ? 'on hold' : ''].filter(Boolean).join(' · ') })
  }, msg, msg ? { ...opts } : { undo: false })
}
/** a client typed that isn't on the list: the one by that name, or a new one */
function clientNamed(name: string): string | undefined {
  const nm = name.trim()
  if (!nm || TO_CONFIRM.test(nm)) return undefined
  const key = nm.toLowerCase().replace(/\s+/g, ' ')
  const s = useStore.getState()
  const had = Object.values(s.clients).find((c) => c.name.trim().toLowerCase().replace(/\s+/g, ' ') === key)
  if (had) return had.id
  const id = 'c' + Date.now().toString(36)
  s.commit((st) => { st.clients[id] = { id, name: nm, kind: GC_WORDS.test(nm) ? 'General contractor' : 'Homeowner', address: '', phone: '', email: '', notes: '', contacts: [] } as Customer }, undefined, { undo: false })
  return id
}

/** what's still missing on a project — said on the list, so it's plain which ones aren't set up properly */
export function missingOf(s: Store, j: Job): string[] {
  const d = draftOf(s, j)
  const out: string[] = []
  if (!d.clientId) out.push('client')
  if (!d.crew && (d.where === 'installing' || d.where === 'touchups' || d.where === 'ready')) out.push('installer')
  if (!d.site && d.where !== 'done') out.push('site manager')
  if (!d.start && d.where !== 'done') out.push(d.where === 'new' || d.where === 'ready' ? 'planned start' : 'start date')
  return out
}

/** one project (id) — from its ··· menu; every open project (all) — from Settings → Bring in projects; or else the brought-in ones */
export function CatchUpModal({ level, id: one, all }: { level: number; id?: string; all?: boolean }) {
  const s = useStore()
  /* the list as it was when it opened — saving one doesn't shuffle the rest */
  const [ids] = React.useState(() => (one ? [one] : (all ? allOpenList : broughtOpenList)(useStore.getState()).map((j) => j.id)))
  /* the project open in the form — none: the list */
  const [cur, setCur] = React.useState<string | null>(null)
  /* each project's answers, kept while you go back and forth */
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({})
  const job = cur ? s.jobs[cur] : one ? s.jobs[one] : undefined
  const d = job ? drafts[job.id] || draftOf(s, job) : undefined
  const set = (p: Partial<Draft>) => { if (job && d) setDrafts((x) => ({ ...x, [job.id]: { ...d, ...p } })) }
  if (one) {
    if (!job || !d) return null
    return (
      <Modal
        level={level}
        size="md"
        onClose={s.close}
        title="Where it’s up to"
        sub={job.name}
        footer={<><div className="ml-auto" aria-hidden /><Button className="max-sm:flex-1" variant="primary" icon={<Check />} onClick={() => save(job.id, d, 'Saved', { close: true })} data-catchup-save>Save</Button></>}
        bodyClass="px-6 py-5 max-sm:px-4"
      >
        <CatchUpForm job={job} d={d} set={set} />
      </Modal>
    )
  }
  const title = all ? 'Go through projects' : 'Bring projects up to date'
  const jobs = ids.map((k) => s.jobs[k]).filter((j): j is Job => !!j)
  const isSet = (j: Job) => !!j.caughtUp
  const setN = jobs.filter(isSet).length
  const pct = jobs.length ? Math.round((setN / jobs.length) * 100) : 100
  /* the next one that isn't set up — after this one, else from the top */
  const nextAfter = (k: string | null) => {
    const i = k ? ids.indexOf(k) : -1
    const after = [...ids.slice(i + 1), ...ids.slice(0, Math.max(0, i))]
    return after.find((x) => x !== k && s.jobs[x] && !s.jobs[x].caughtUp) || null
  }
  const progress = (
    <div className="flex items-center gap-3 text-[0.8125rem] text-muted" data-catchup-progress>
      <span className="font-semibold text-ink-2">{title}</span>
      <span className="tnum" data-catchup-count>{setN} of {jobs.length} set up</span>
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-wash-3 max-sm:w-16" aria-hidden><span className="block h-full rounded-full bg-[#2c8a5b] transition-[width]" style={{ width: `${pct}%` }} /></span>
    </div>
  )
  /* ---- the list: what's set up and what isn't ---- */
  if (!job || !d) {
    const todo = jobs.filter((j) => !isSet(j))
    const done = jobs.filter(isSet)
    const row = (j: Job) => {
      const miss = missingOf(s, j)
      const ok = isSet(j)
      return (
        <button key={j.id} type="button" onClick={() => setCur(j.id)} data-catchup-row={j.id} data-set={ok ? '1' : '0'} className="flex min-h-[3.25rem] w-full items-center gap-3 border-t border-line-2 px-6 py-2 text-left transition row-hover max-sm:px-4">
          <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ok ? 'bg-[#e6f4ec] text-[#2c8a5b]' : 'border-2 border-[#d9d3c9]')}>{ok && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold text-ink">{j.name}</span>
            <span className={cn('block truncate text-[0.8125rem]', miss.length ? (ok ? 'text-muted' : 'font-medium text-[#8f5207]') : 'text-muted')}>
              {miss.length ? `No ${miss.join(' · no ')}` : ok ? `Set up${j.caughtUp ? ` ${j.caughtUp}` : ''}` : whereWord(draftOf(s, j).where)}
            </span>
          </span>
          <span className="shrink-0 text-[0.8125rem] text-muted max-sm:hidden">{whereWord(draftOf(s, j).where)}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </button>
      )
    }
    const first = nextAfter(null)
    return (
      <Modal
        level={level}
        size="lg"
        tall
        onClose={s.close}
        title={title}
        header={<div className="border-b border-line px-6 pb-4 pt-5 pr-16 max-sm:px-4 max-sm:pt-3.5" data-catchup-head>{progress}<h2 className="font-display mt-2 text-[1.375rem] font-semibold leading-tight text-ink">{todo.length ? `${todo.length} to set up` : 'Every one is set up'}</h2><div className="mt-0.5 text-[0.875rem] text-muted">Tap one to set it up. What’s still missing is said on each.</div></div>}
        footer={first ? <Button className="ml-auto max-sm:flex-1" variant="primary" iconRight={<ChevronRight />} onClick={() => setCur(first)} data-catchup-start>{setN ? 'Go on with the next one' : 'Start with the first one'}</Button> : <Button className="ml-auto max-sm:flex-1" variant="primary" onClick={s.close} data-catchup-close>Done</Button>}
        bodyClass="p-0"
      >
        <div data-catchup-list>
          {todo.length > 0 && <><Group label="Not set up yet" count={todo.length} tone="warn" />{todo.map(row)}</>}
          {done.length > 0 && <><Group label="Set up" count={done.length} tone="ok" />{done.map(row)}</>}
          {!jobs.length && <div className="px-6 py-10 text-center text-[0.875rem] text-muted" data-catchup="done">{all ? 'No open projects.' : 'Every project is up to date.'}</div>}
        </div>
      </Modal>
    )
  }
  /* ---- one project ---- */
  const link = asanaOf(s, job)
  const at = ids.indexOf(job.id)
  /* back to the list — what was typed and not saved is let go, so the form shows only what's saved */
  const toList = () => { setDrafts((x) => { const y = { ...x }; delete y[job.id]; return y }); setCur(null) }
  /* saved: back on the list, ticked — the next one is yours to pick */
  const saveClose = () => { save(job.id, d, 'Saved', { sub: `${job.name} is set up` }); toList() }
  return (
    <Modal
      level={level}
      size="lg"
      tall
      onClose={s.close}
      title={title}
      header={
        <div className="border-b border-line px-6 pb-4 pt-5 pr-16 max-sm:px-4 max-sm:pt-3.5" data-catchup-head>
          <div className="flex items-center gap-3 text-[0.8125rem] text-muted">
            <button type="button" onClick={toList} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" data-catchup-list-back><ChevronLeft className="h-4 w-4" />All {jobs.length}</button>
            <span className="tnum" data-catchup-at>{at + 1} of {jobs.length}</span>
            <span className="tnum">· {setN} set up</span>
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display min-w-0 max-w-full truncate text-[1.375rem] font-semibold leading-tight text-ink" data-catchup-name>{job.name}</h2>
            <span className="flex shrink-0 items-baseline gap-3">
              {link && <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700 hover:underline">In Asana<ExternalLink className="h-3 w-3" /></a>}
              <button type="button" onClick={() => s.open({ t: 'job', id: job.id })} className="text-[0.8125rem] font-semibold text-brand-700 hover:underline">Open the project</button>
            </span>
          </div>
          {job.address && job.address !== job.name && <div className="mt-0.5 truncate text-[0.875rem] text-muted">{job.address}</div>}
        </div>
      }
      footer={
        <>
          <Button className="ml-auto max-sm:flex-1" variant="ghost" onClick={toList} data-catchup-cancel>Cancel</Button>
          <Button className="max-sm:flex-1" variant="primary" icon={<Check />} onClick={saveClose} data-catchup-save-close>Save &amp; close</Button>
        </>
      }
      bodyClass="px-6 py-5 max-sm:px-4"
    >
      <CatchUpForm key={job.id} job={job} d={d} set={set} />
    </Modal>
  )
}

/** the touch-ups still to fix, right in the setup: how many, what they are, and Add */
function TouchupsLine({ job }: { job: Job }) {
  const s = useStore()
  const open = s.punch.filter((p) => p.jobId === job.id && p.status !== 'verified')
  return (
    <Line label="Touch-ups" hint="What’s still to fix">
      <div className="flex min-w-0 flex-col gap-1.5" data-catchup-touchups={open.length}>
        {open.length > 0 && (
          <ul className="flex min-w-0 flex-col gap-0.5 text-[0.875rem] text-ink-2">
            {open.slice(0, 6).map((p) => <li key={p.id} className="flex min-w-0 items-start gap-2"><span className="mt-[0.4375rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[#cfc9be]" /><span className="min-w-0 break-words">{p.text}</span></li>)}
            {open.length > 6 && <li className="pl-3.5 text-muted">and {open.length - 6} more</li>}
          </ul>
        )}
        <Button size="sm" className="self-start" icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId: job.id })} data-catchup-touchups-add>{open.length ? 'Add more' : 'Add the touch-ups'}</Button>
      </div>
    </Line>
  )
}

/** the answers for one project, one line each — the question on the left, one box to tap on the right: whose it is,
 *  where it stands (on hold is one of them), what's done, who's on it, how far, the dates */
function CatchUpForm({ job, d, set }: { job: Job; d: Draft; set: (p: Partial<Draft>) => void }) {
  const s = useStore()
  const crews = CREWS.filter((c) => !isOff(s, 'crew', c) || c === d.crew)
  const sites = s.team.filter((m) => m.role === 'site' && m.status !== 'off').map((m) => m.key as PersonKey)
  const siteList = Array.from(new Set([...sites, ...(d.site ? [d.site as PersonKey] : [])]))
  const getting = d.where === 'new' || d.where === 'ready'
  const hold = d.hold && d.where !== 'done'
  const clients = Object.values(s.clients).filter((c) => !TO_CONFIRM.test(c.name)).sort((a, b) => a.name.localeCompare(b.name))
  return (
    <div className="flex flex-col gap-3.5" data-catchup={job.id}>
      <Line label="Client" warn={!d.clientId} hint={d.clientId ? undefined : 'Not set yet'}>
        <SearchSelect
          label="Client"
          value={d.clientId}
          options={clients.map((c) => ({ key: c.id, label: c.name, hint: c.kind }))}
          onChange={(id) => set({ clientId: id })}
          onCreate={(t) => { const id = clientNamed(t); if (id) set({ clientId: id }) }}
          createLabel={(t) => `Add “${t}” as a new client`}
          placeholder="Pick the client"
          icon={<Building2 />}
          search
          width={380}
          className="w-full"
        />
      </Line>
      {/* where it stands — On hold is one of them (why, right under it); picking where it is takes it off hold */}
      <Line label="Where it stands" hint={hold ? `It was: ${whereWord(d.where)}` : undefined} top={hold}>
        <span className="flex min-w-0 flex-col gap-2" data-catchup-where={hold ? 'hold' : d.where}>
          <SearchSelect label="Where it stands" value={hold ? 'hold' : d.where}
            options={[...WHERE.map((w) => ({ key: w.key as string, label: w.label, lead: whereLead(w.key) })), ...(d.where !== 'done' ? [{ key: 'hold', label: 'On hold', lead: HOLD_LEAD }] : [])]}
            onChange={(w) => (w === 'hold' ? set({ hold: true }) : set({ hold: false, where: w as Where, parts: w === 'ready' ? Array.from(new Set([...d.parts, ...READY_PARTS])) : d.parts }))} search={false} width={300} className="w-full" />
          {hold && (
            <span className="grid gap-2">
              <TextInput value={d.why} onChange={(e) => set({ why: e.target.value })} placeholder="Why. Waiting on the GC, the tile…" aria-label="Why it’s on hold" data-catchup-why />
              {/* until when: that day it's on your Today, to check in */}
              <DateBox value={d.until} min={TODAY} onChange={(v) => set({ until: v })} label="On hold until · that day it’s on your Today" data="until" placeholder="Until when?" clear />
            </span>
          )}
        </span>
      </Line>
      {getting && (
        <Line label="Done already" hint="Tap each one that’s done">
          <div className="flex flex-wrap gap-1.5">
            {PARTS.map((p) => {
              const on = d.parts.includes(p.key)
              const tap = () => {
                const parts = on ? d.parts.filter((x) => x !== p.key) : [...d.parts, p.key]
                /* ready for the crew means design, tile and site are done — taking one off makes it getting ready again */
                set({ parts, where: d.where === 'ready' && !READY_PARTS.every((k) => parts.includes(k)) ? 'new' : d.where })
              }
              return <button key={p.key} type="button" aria-pressed={on} onClick={tap} data-catchup-part={p.key} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.84375rem] font-semibold transition max-sm:h-11 max-sm:px-3.5', on ? 'border-[#2c8a5b] bg-[#e6f4ec] text-[#1f6b45]' : 'border-line bg-white text-ink-2 hover:bg-wash')}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}{p.label}</button>
            })}
          </div>
        </Line>
      )}
      {d.where !== 'done' && (
        <Line label="Installer" warn={!d.crew && !getting}>
          <span data-catchup-crew={d.crew || 'none'}>
            <SearchSelect label="Installer" value={d.crew} options={crews.map((c) => ({ key: c as string, label: PEOPLE[c]?.name || c, lead: <Avatar who={c as PersonKey} size={22} /> }))} emptyLabel="Not picked yet" onChange={(c) => set({ crew: c })} placeholder="Type his name" icon={d.crew ? undefined : <HardHat />} search width={320} className="w-full" />
          </span>
        </Line>
      )}
      {/* at the touch-ups: what's still to fix goes in right here — no closing this to go to the project */}
      {d.where === 'touchups' && <TouchupsLine job={job} />}
      <Line label="Site manager" warn={!d.site && d.where !== 'done'}>
        <span data-catchup-site={d.site || 'none'}>
          <SearchSelect label="Site manager" value={d.site} options={siteList.map((p) => ({ key: p as string, label: PEOPLE[p]?.name || p, lead: <Avatar who={p as PersonKey} size={22} /> }))} emptyLabel="Not set" onChange={(p) => set({ site: p })} icon={d.site ? undefined : <UserRound />} search={siteList.length > 8} width={300} className="w-full" />
        </span>
      </Line>
      {d.where === 'installing' && (
        <Line label="How far">
          <span className="relative block w-32"><TextInput inputMode="numeric" value={d.pct} onChange={(e) => set({ pct: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })} placeholder="0" aria-label="Percent installed" className="h-10 pr-8" data-catchup-pct /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-muted">% in</span></span>
        </Line>
      )}
      {d.where !== 'done' && (
        <Line label={getting ? 'Planned start' : d.where === 'touchups' ? 'Started · finished' : 'Started · finish'}>
          <div className={cn('grid gap-2', !getting && 'grid-cols-2')}>
            <DateBox value={d.start} onChange={(v) => set({ start: v })} label="Start" data="start" />
            {!getting && <DateBox value={d.finish} min={d.start} onChange={(v) => set({ finish: v })} label="Finish" data="finish" />}
          </div>
        </Line>
      )}
      {/* its papers, if they're handy — kept on the project; nothing is read from them here */}
      <Line label="Papers" hint="If they’re handy">
        <AttachPapers job={job} />
      </Line>
    </div>
  )
}
/** attach its papers — the estimate, the POs, the tile paperwork, the plans: kept on the project (Documents), each by its
 *  name. Nothing is read or filled in from them here */
function AttachPapers({ job }: { job: Job }) {
  const s = useStore()
  const ref = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const files = s.files.filter((f) => f.jobId === job.id && f.kind !== 'photo')
  const add = async (list: File[]) => {
    if (!list.length) return
    setBusy(true)
    const plans = list.filter((f) => /plan|drawing|arch/i.test(f.name))
    const rest = list.filter((f) => !plans.includes(f))
    try {
      if (plans.length) await keepFiles(job.id, plans, 'plans')
      if (rest.length) await keepFiles(job.id, rest, 'other')
    } finally { setBusy(false) }
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-catchup-attach={files.length}>
      <input ref={ref} type="file" multiple accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.csv" className="hidden" aria-label="Attach papers" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; void add(l) }} data-catchup-attach-input />
      {files.slice(-4).map((f) => (
        <span key={f.id} className="inline-flex h-9 min-w-0 max-w-[15rem] items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[0.8125rem] text-ink-2" title={f.name} data-catchup-file>
          <FileText className="h-3.5 w-3.5 shrink-0 text-muted" /><span className="min-w-0 truncate">{f.name}</span>
        </span>
      ))}
      {files.length > 4 && <span className="text-[0.8125rem] text-muted">+{files.length - 4} more</span>}
      <Button size="sm" icon={<Paperclip />} disabled={busy} onClick={() => ref.current?.click()} data-catchup-attach-btn>{busy ? 'Attaching…' : files.length ? 'Attach more' : 'Attach'}</Button>
    </div>
  )
}
/** one question: its name on the left, the answer on the right — stacked on a phone */
function Line({ label, hint, warn, top, children }: { label: string; hint?: string; warn?: boolean; /** its boxes go on down (on hold: why, until): the name level with the first */ top?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn('grid grid-cols-[10rem_minmax(0,1fr)] gap-4 max-sm:grid-cols-1 max-sm:gap-1.5', top ? 'items-start' : 'items-center')} data-catchup-line={label}>
      <span className={cn('min-w-0', top && 'sm:pt-2.5')}>
        <span className={cn('block text-[0.875rem] font-semibold', warn ? 'text-[#8f5207]' : 'text-ink')}>{label}</span>
        {hint && <span className="block text-[0.75rem] text-muted">{hint}</span>}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** a start or a finish: the day in words, and a big calendar to pick it from (any day, one gone by too) */
function DateBox({ value, min, onChange, label, data, placeholder, clear }: { value: string; min?: string; onChange: (v: string) => void; label: string; data: string; placeholder?: string; /** "No day" to take it off */ clear?: boolean }) {
  return <DateField value={value} min={min} onChange={onChange} onClear={clear ? () => onChange('') : undefined} label={label} placeholder={placeholder} data-catchup-date={data} />
}
