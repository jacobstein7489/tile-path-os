/* Bring projects up to date. The ones brought in (from Asana, or from their estimates) come in with only what Asana
 * knew — not who the site manager is, how far the crew got, which parts of getting ready are done. One project at a
 * time, a few taps each: the client, where it stands, what's done already, the installer, the site manager, how far,
 * the start and the finish — and its estimate and tile paperwork if they're handy (the rooms and the tiles fill in by
 * themselves).
 * It opens on the list: every one of them, what's set up (✓) and what isn't yet — and what's still missing on it (the
 * client, the installer, the site manager, the start). Tap any one; Save & next saves it and opens the next one that
 * isn't set up. Nothing's laid out as a wall of choices: each answer is one box you tap (the installer is typed to
 * find him, however many there are). The same form, for one project, is the office's say on where it's up to — from
 * the project's ··· menu, without going through its steps one by one. */
import * as React from 'react'
import { Building2, Check, ChevronLeft, ChevronRight, ExternalLink, FileText, HardHat, ListChecks, PauseCircle, Sparkles, Upload, UserRound } from 'lucide-react'
import { useStore, addHist, meOf, NOW, type Store } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Group } from '@/tileos/components/ui/page'
import { Modal } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, type Customer, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { labelFromIso, isoFromLabel } from '@/tileos/lib/today'
import { companySteps } from './steps'
import { tracksFor, type TrackKey } from './tracks'
import { isOff } from './active'
import { estimateInto } from './bringin'
import { readPaperworkFor, useReadWords } from './paperread'
import { allowedFor } from './newpicker'

const PRICING: Stage[] = ['request', 'estimating', 'proposal', 'followup']
const BEFORE_START: Stage[] = ['awarded', 'setup', 'verification', 'ready', 'scheduled']
const BEFORE = 'Done before Tile OS'
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
const PARTS: { key: TrackKey; label: string }[] = [
  { key: 'scope', label: 'Design' }, { key: 'tile', label: 'Tile' }, { key: 'site', label: 'Site' }, { key: 'installer', label: 'Installer' }, { key: 'materials', label: 'Materials' },
]
/** ready for the crew = these three are done */
const READY_PARTS: TrackKey[] = ['scope', 'tile', 'site']
type Draft = { clientId: string; where: Where; parts: TrackKey[]; crew: string; site: string; pct: string; start: string; finish: string; hold: boolean; why: string }
function draftOf(s: Store, j: Job): Draft {
  const done = tracksFor(s, j).filter((t) => t.state === 'done').map((t) => t.key)
  const where: Where = j.stage === 'installation' ? 'installing' : j.stage === 'punch' ? 'touchups' : ['closeout', 'complete'].includes(j.stage) ? 'done' : READY_PARTS.every((k) => done.includes(k)) ? 'ready' : 'new'
  const prep = s.prep[j.id]
  const startIso = BEFORE_START.includes(j.stage) ? prep?.targetISO : isoFromLabel(j.dates?.start)
  /* a brought-in project's site manager only when Asana named one — otherwise it was a stand-in, so it's asked */
  const site = !broughtIn(s, j) || j.caughtUp || /Site manager:/.test(brought(s, j)?.detail || '') ? j.site || '' : ''
  const crew = j.crew || (prep?.installer && prep.installer !== 'tbd' ? String(prep.installer) : '')
  return { clientId: clientSet(s, j) ? j.clientId : '', where, parts: done, crew, site, pct: j.pct ? String(j.pct) : '', start: startIso || '', finish: isoFromLabel(j.dates?.finish) || '', hold: !!j.hold, why: j.hold?.reason || '' }
}
/** the link back to the job in Asana — from its history */
const asanaOf = (s: Store, j: Job) => (s.hist[j.id] || []).map((h) => h.detail?.match(/https:\/\/app\.asana\.com\/[^\s—]+/)?.[0]).find(Boolean)
/** what's up next on a project that's getting ready — the first part that isn't done */
const NEXT_UP: { part: TrackKey; text: string; owner: PersonKey }[] = [
  { part: 'scope', text: 'Finish the design', owner: 'ys' },
  { part: 'tile', text: 'Get the tile paperwork', owner: 'estimator' },
  { part: 'site', text: 'Check the site', owner: 'yakov' },
  { part: 'installer', text: 'Send the installer his PO', owner: 'ys' },
  { part: 'materials', text: 'Order the materials', owner: 'ys' },
]

/** save one project the way it was set: the client, where it stands (and what's checked off with it), the people, how
 *  far, dates — said with a pop and closed when it's the one project (msg) */
function save(jobId: string, d: Draft, msg?: string) {
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
    /* what's done already: everything once the crew started; while it's getting ready, the parts that were tapped */
    const all = !BEFORE_START.includes(stage)
    const tracks = tracksFor(st, j)
    const recs = (st.stepRecs[jobId] ||= {})
    const partOf = (k: string) => tracks.find((t) => t.steps.some((v) => v.key === k))?.key
    companySteps(st).forEach((def) => {
      const part = partOf(def.key)
      const on = all || def.key === 'deposit' || (!!part && d.parts.includes(part))
      const r = recs[def.key]
      if (on) { if (!r?.done && !r?.na) recs[def.key] = { ...(r || {}), done: NOW, by: me, note: BEFORE } }
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
    /* on hold, and why */
    if (d.hold && d.where !== 'done') j.hold = { reason: d.why.trim() || 'On hold', since: j.hold?.since || NOW, by: j.hold?.by || me }
    else delete j.hold
    j.status = j.hold ? 'bad' : 'info'
    j.headline = j.hold ? `On hold · ${j.hold.reason}` : whereWord(d.where)
    const site = (d.site || j.site || 'yakov') as PersonKey
    if (stage === 'installation') j.next = { text: 'Keep the daily updates going', owner: site }
    else if (stage === 'punch') j.next = { text: 'Finish the touch-ups', owner: site }
    else if (BEFORE_START.includes(stage)) {
      const up = NEXT_UP.find((n) => !d.parts.includes(n.part))
      j.next = up ? { text: up.text, owner: up.owner, due: 'This week' } : { text: 'Schedule the crew', owner: 'ys', due: 'This week' }
    }
    j.caughtUp = NOW
    addHist(st, jobId, { who: me, kind: 'setup', title: 'Brought up to date', detail: [whereWord(d.where), crew ? `installer ${PEOPLE[crew]?.short || crew}` : '', d.site ? `site manager ${PEOPLE[d.site as PersonKey]?.short || d.site}` : '', stage === 'installation' ? `${j.pct}% in` : '', j.hold ? 'on hold' : ''].filter(Boolean).join(' · ') })
  }, msg, msg ? { close: true } : { undo: false })
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

/** one project (id) — from its ··· menu; every open project (all) — from Projects; or else the brought-in ones */
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
        footer={<><Button className="ml-auto max-sm:flex-1" variant="ghost" onClick={s.close}>Cancel</Button><Button className="max-sm:flex-1" variant="primary" icon={<Check />} onClick={() => save(job.id, d, 'Saved')} data-catchup-save>Save</Button></>}
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
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-[#ece8e1] max-sm:w-16" aria-hidden><span className="block h-full rounded-full bg-[#2c8a5b] transition-[width]" style={{ width: `${pct}%` }} /></span>
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
        header={<div className="border-b border-line px-6 pb-4 pt-5 pr-16 max-sm:px-4 max-sm:pt-3.5" data-catchup-head>{progress}<h2 className="font-display mt-2 text-[1.375rem] font-semibold leading-tight text-ink">{todo.length ? `${todo.length} to set up` : 'Every one is set up'}</h2><div className="mt-0.5 text-[0.875rem] text-muted">Tap one to set it up — what’s still missing is said on each.</div></div>}
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
  const next = () => {
    save(job.id, d)
    setDrafts((x) => ({ ...x, [job.id]: d }))
    setCur(nextAfter(job.id))
  }
  const skip = () => setCur(nextAfter(job.id) || null)
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
            <button type="button" onClick={() => setCur(null)} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" data-catchup-list-back><ChevronLeft className="h-4 w-4" />All {jobs.length}</button>
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
          <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setCur(null)} className="max-sm:hidden">All projects</Button>
          <Button variant="ghost" onClick={skip} data-catchup-skip>Skip</Button>
          <Button className="ml-auto max-sm:flex-1" variant="primary" iconRight={<ChevronRight />} onClick={next} data-catchup-next>{nextAfter(job.id) ? 'Save & next' : 'Save'}</Button>
        </>
      }
      bodyClass="px-6 py-5 max-sm:px-4"
    >
      <CatchUpForm key={job.id} job={job} d={d} set={set} papers />
    </Modal>
  )
}

/** the answers for one project, one line each — the question on the left, one box to tap on the right: whose it is,
 *  where it stands, what's done, who's on it, how far, the dates, on hold */
function CatchUpForm({ job, d, set, papers }: { job: Job; d: Draft; set: (p: Partial<Draft>) => void; papers?: boolean }) {
  const s = useStore()
  const crews = CREWS.filter((c) => !isOff(s, 'crew', c) || c === d.crew)
  const sites = s.team.filter((m) => m.role === 'site' && m.status !== 'off').map((m) => m.key as PersonKey)
  const siteList = Array.from(new Set([...sites, ...(d.site ? [d.site as PersonKey] : [])]))
  const getting = d.where === 'new' || d.where === 'ready'
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
      <Line label="Where it stands">
        <span data-catchup-where={d.where}>
          <SearchSelect label="Where it stands" value={d.where} options={WHERE.map((w) => ({ key: w.key, label: w.label }))} onChange={(w) => set({ where: w as Where, parts: w === 'ready' ? Array.from(new Set([...d.parts, ...READY_PARTS])) : d.parts })} search={false} width={300} className="w-full" />
        </span>
      </Line>
      {getting && (
        <Line label="Done already" hint="Tap each part that’s done">
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
            <SearchSelect label="Installer" value={d.crew} options={crews.map((c) => ({ key: c as string, label: PEOPLE[c]?.name || c }))} emptyLabel="Not picked yet" onChange={(c) => set({ crew: c })} placeholder="Type his name" icon={<HardHat />} search width={320} className="w-full" />
          </span>
        </Line>
      )}
      <Line label="Site manager" warn={!d.site && d.where !== 'done'}>
        <span data-catchup-site={d.site || 'none'}>
          <SearchSelect label="Site manager" value={d.site} options={siteList.map((p) => ({ key: p as string, label: PEOPLE[p]?.name || p }))} emptyLabel="Not set" onChange={(p) => set({ site: p })} icon={<UserRound />} search={siteList.length > 8} width={300} className="w-full" />
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
      {d.where !== 'done' && (
        <Line label="On hold">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => set({ hold: !d.hold })} aria-pressed={d.hold} data-catchup-hold className={cn('inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[0.875rem] font-semibold transition', d.hold ? 'border-bad-300 bg-bad-50 text-bad-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}><PauseCircle className="h-4 w-4" />{d.hold ? 'On hold' : 'No'}</button>
            {d.hold && <span className="min-w-[12rem] flex-1"><TextInput value={d.why} onChange={(e) => set({ why: e.target.value })} placeholder="Why — waiting on the GC, the tile…" aria-label="Why it’s on hold" data-catchup-why /></span>}
          </div>
        </Line>
      )}
      {papers && <Papers key={job.id} job={job} />}
    </div>
  )
}
/** one question: its name on the left, the answer on the right — stacked on a phone */
function Line({ label, hint, warn, children }: { label: string; hint?: string; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-center gap-4 max-sm:grid-cols-1 max-sm:gap-1.5" data-catchup-line={label}>
      <span className="min-w-0">
        <span className={cn('block text-[0.875rem] font-semibold', warn ? 'text-[#8f5207]' : 'text-ink')}>{label}</span>
        {hint && <span className="block text-[0.75rem] text-muted">{hint}</span>}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function DateBox({ value, min, onChange, label, data }: { value: string; min?: string; onChange: (v: string) => void; label: string; data: string }) {
  return <input type="date" value={value} min={min || undefined} onChange={(e) => onChange(e.target.value)} aria-label={label} data-catchup-date={data} className="h-10 w-full rounded-[0.5625rem] border border-line bg-white px-3 text-[0.9375rem] text-ink focus:border-brand-300 focus:outline-none" />
}

/** its estimate and tile paperwork, when they're handy — read in the background while you go on to the next one */
function Papers({ job }: { job: Job }) {
  const s = useStore()
  const est = React.useRef<HTMLInputElement>(null)
  const pap = React.useRef<HTMLInputElement>(null)
  const [estNow, setEstNow] = React.useState<'' | 'reading' | 'bad'>('')
  const paper = useReadWords(job.id)
  const rooms = (s.rooms[job.id] || []).length
  const tiles = Object.keys(s.tiles[job.id] || {}).length
  const readEstimate = (files: File[]) => {
    if (!files[0]) return
    setEstNow('reading')
    void estimateInto(job.id, files[0]).then(() => setEstNow(''), () => setEstNow('bad'))
  }
  const readPaper = (files: File[]) => {
    const j = useStore.getState().jobs[job.id]
    if (j && files.length) void readPaperworkFor(j, files)
  }
  return (
    <div className="rounded-xl border border-line bg-[#fbfaf7] px-4 py-3" data-catchup-papers>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2"><span className="text-[0.875rem] font-semibold text-ink">Papers</span><span className="text-[0.8125rem] text-muted">If they’re handy. AI fills in the rooms and the tiles — you can go on to the next project while it reads.</span></div>
      <input ref={est} type="file" accept="application/pdf,image/*" className="hidden" aria-label="Its estimate" data-catchup-estimate onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; readEstimate(f) }} />
      <input ref={pap} type="file" multiple accept="application/pdf,image/*" className="hidden" aria-label="Its tile paperwork" data-catchup-paperwork onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; readPaper(f) }} />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" icon={estNow === 'reading' ? <FileText /> : rooms ? <Check /> : <Upload />} disabled={estNow === 'reading'} onClick={() => est.current?.click()} data-catchup-est-btn>
          {estNow === 'reading' ? 'Reading the estimate…' : rooms ? `Estimate · ${rooms} ${rooms === 1 ? 'room' : 'rooms'}` : 'Add its estimate'}
        </Button>
        <Button size="sm" icon={paper === 'reading' ? <FileText /> : tiles ? <Check /> : <Sparkles />} disabled={paper === 'reading'} onClick={() => pap.current?.click()} data-catchup-paper-btn>
          {paper === 'reading' ? 'Reading the paperwork…' : tiles ? `Tile paperwork · ${tiles} ${tiles === 1 ? 'tile' : 'tiles'}` : 'Add its tile paperwork'}
        </Button>
      </div>
      {(estNow === 'bad' || (paper && paper !== 'reading')) && <div className="mt-2 text-[0.8125rem] text-bad-700">{estNow === 'bad' ? 'Couldn’t read the estimate just now — try again.' : paper}</div>}
    </div>
  )
}

/** on Projects, while some brought-in projects haven't been gone through: how many, and the button to start */
export function CatchUpBar() {
  const s = useStore()
  if (!allowedFor(s.role, 'bringin')) return null
  const list = catchUpList(s)
  if (!list.length) return null
  const going = list.filter((j) => j.stage === 'installation' || j.stage === 'punch').length
  return (
    <div className={cn('flex items-center gap-3 border-b border-[#d9e3f5] bg-[#f3f7fd] py-3 max-sm:flex-col max-sm:items-stretch', 'px-5 max-sm:px-4')} data-catchup-bar>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 shadow-[0_0_0_1px_#d9e3f5] max-sm:hidden"><ListChecks className="h-[1.125rem] w-[1.125rem]" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-[0.9375rem] font-semibold text-ink">{list.length} {list.length === 1 ? 'project came' : 'projects came'} in without where they’re up to</div>
        <div className="text-[0.8125rem] text-muted">Go through them one at a time: where it stands, the installer, the site manager, the dates{going ? ` — the ${going} going now first` : ''}.</div>
      </div>
      <Button variant="primary" onClick={() => s.open({ t: 'catchup' })} data-open-catchup>Go through them</Button>
    </div>
  )
}
