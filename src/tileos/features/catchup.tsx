/* Bring projects up to date. The ones brought in (from Asana, or from their estimates) come in with only what Asana
 * knew — not who the site manager is, how far the crew got, which parts of getting ready are done. One project at a
 * time, a few taps each: where it stands, what's done already, the installer, the site manager, how far, the start and
 * the finish — and its estimate and tile paperwork if they're handy (the rooms and the tiles fill in by themselves).
 * Save & next saves it and goes on to the next one; it remembers which are done, so you can stop and come back. */
import * as React from 'react'
import { Check, ChevronLeft, ChevronRight, ExternalLink, FileText, ListChecks, PauseCircle, Sparkles, Upload } from 'lucide-react'
import { useStore, addHist, meOf, NOW, type Store } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
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
/** brought in and not gone through yet */
export const needsCatchUp = (s: Pick<Store, 'hist'>, j: Job) => !j.caughtUp && !PRICING.includes(j.stage) && !['closeout', 'complete'].includes(j.stage) && !!brought(s, j)
/** the ones to go through — the busiest first: in progress, touch-ups, then getting ready */
export function catchUpList(s: Store): Job[] {
  const rank = (j: Job) => (j.stage === 'installation' ? 0 : j.stage === 'punch' ? 1 : 2)
  return Object.values(s.jobs).filter((j) => needsCatchUp(s, j)).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
}

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
type Draft = { where: Where; parts: TrackKey[]; crew: string; site: string; pct: string; start: string; finish: string; hold: boolean; why: string }
function draftOf(s: Store, j: Job): Draft {
  const done = tracksFor(s, j).filter((t) => t.state === 'done').map((t) => t.key)
  const where: Where = j.stage === 'installation' ? 'installing' : j.stage === 'punch' ? 'touchups' : ['closeout', 'complete'].includes(j.stage) ? 'done' : READY_PARTS.every((k) => done.includes(k)) ? 'ready' : 'new'
  const prep = s.prep[j.id]
  const startIso = BEFORE_START.includes(j.stage) ? prep?.targetISO : isoFromLabel(j.dates?.start)
  /* the site manager only when Asana named one — otherwise it was a stand-in, so it's asked */
  const site = j.caughtUp || /Site manager:/.test(brought(s, j)?.detail || '') ? j.site || '' : ''
  const crew = j.crew || (prep?.installer && prep.installer !== 'tbd' ? String(prep.installer) : '')
  return { where, parts: done, crew, site, pct: j.pct ? String(j.pct) : '', start: startIso || '', finish: isoFromLabel(j.dates?.finish) || '', hold: !!j.hold, why: j.hold?.reason || '' }
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

/** save one project the way it was set: where it stands (and what's checked off with it), the people, how far, dates */
function save(jobId: string, d: Draft) {
  const st0 = useStore.getState()
  const me = meOf(st0.role)
  st0.commit((st) => {
    const j = st.jobs[jobId]
    if (!j) return
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
  }, undefined, { undo: false })
}

export function CatchUpModal({ level }: { level: number }) {
  const s = useStore()
  /* the list as it was when it opened — saving one doesn't shuffle the rest */
  const [ids] = React.useState(() => catchUpList(useStore.getState()).map((j) => j.id))
  const [at, setAt] = React.useState(0)
  const [saved, setSaved] = React.useState<string[]>([])
  /* each project's answers, kept while you go back and forth */
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>({})
  const id = ids[at]
  const job = id ? s.jobs[id] : undefined
  const d = job ? drafts[job.id] || draftOf(s, job) : undefined
  const go = (i: number) => setAt(Math.max(0, Math.min(ids.length, i)))
  const next = () => {
    if (!job || !d) return
    save(job.id, d)
    setDrafts((x) => ({ ...x, [job.id]: d }))
    setSaved((x) => Array.from(new Set([...x, job.id])))
    go(at + 1)
  }
  if (!job || !d) return (
    <Modal level={level} size="md" onClose={s.close} title="Bring projects up to date" footer={<Button className="ml-auto" variant="primary" onClick={s.close} data-catchup-close>Done</Button>}>
      <div className="flex flex-col items-center gap-2 py-6 text-center" data-catchup="done">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f4ec] text-[#2c8a5b]"><Check className="h-6 w-6" strokeWidth={3} /></span>
        <div className="text-[1.0625rem] font-semibold text-ink">{ids.length ? `${saved.length} of ${ids.length} brought up to date` : 'Every project is up to date'}</div>
        {ids.length > saved.length && <div className="text-[0.875rem] text-muted">{ids.length - saved.length} skipped — they stay on the list for next time.</div>}
      </div>
    </Modal>
  )
  const set = (p: Partial<Draft>) => setDrafts((x) => ({ ...x, [job.id]: { ...d, ...p } }))
  const crews = CREWS.filter((c) => !isOff(s, 'crew', c) || c === d.crew)
  const sites = s.team.filter((m) => m.role === 'site' && m.status !== 'off').map((m) => m.key as PersonKey)
  const siteList = Array.from(new Set([...sites, ...(d.site ? [d.site as PersonKey] : [])]))
  const link = asanaOf(s, job)
  const getting = d.where === 'new' || d.where === 'ready'
  const pctDone = Math.round((saved.length / ids.length) * 100)
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="Bring projects up to date"
      header={
        <div className="border-b border-line px-6 pb-4 pt-5 pr-16 max-sm:px-4 max-sm:pt-3.5" data-catchup-head>
          <div className="flex items-center gap-3 text-[0.8125rem] text-muted">
            <span className="font-semibold text-ink-2">Bring projects up to date</span>
            <span className="tnum" data-catchup-count>{at + 1} of {ids.length}</span>
            <span className="h-1.5 w-28 overflow-hidden rounded-full bg-[#ece8e1] max-sm:w-16" aria-hidden><span className="block h-full rounded-full bg-[#2c8a5b] transition-[width]" style={{ width: `${pctDone}%` }} /></span>
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display min-w-0 max-w-full truncate text-[1.375rem] font-semibold leading-tight text-ink" data-catchup-name>{job.name}</h2>
            <span className="flex shrink-0 items-baseline gap-3">
              {link && <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700 hover:underline">In Asana<ExternalLink className="h-3 w-3" /></a>}
              <button type="button" onClick={() => s.open({ t: 'job', id: job.id })} className="text-[0.8125rem] font-semibold text-brand-700 hover:underline">Open the project</button>
            </span>
          </div>
          <div className="mt-0.5 truncate text-[0.875rem] text-muted">{[job.client, job.address && job.address !== job.name ? job.address : ''].filter(Boolean).join(' · ')}</div>
        </div>
      }
      footer={
        <>
          <Button variant="ghost" icon={<ChevronLeft />} disabled={at === 0} onClick={() => go(at - 1)} data-catchup-back>Back</Button>
          <Button variant="ghost" onClick={() => go(at + 1)} data-catchup-skip>Skip</Button>
          <Button variant="ghost" className="max-sm:hidden" onClick={s.close}>Stop for now</Button>
          <Button className="ml-auto max-sm:flex-1" variant="primary" iconRight={<ChevronRight />} onClick={next} data-catchup-next>{at + 1 === ids.length ? 'Save' : 'Save & next'}</Button>
        </>
      }
      bodyClass="px-6 py-5 max-sm:px-4"
    >
      <div className="flex flex-col gap-5" data-catchup={job.id}>
        <Field label="Where it stands">
          <Chips value={d.where} items={WHERE} onPick={(w) => set({ where: w, parts: w === 'ready' ? Array.from(new Set([...d.parts, ...READY_PARTS])) : d.parts })} data="where" />
        </Field>
        {getting && (
          <Field label="Done already" hint="Tap each part that’s done. What’s left goes on people’s lists.">
            <div className="flex flex-wrap gap-2">
              {PARTS.map((p) => {
                const on = d.parts.includes(p.key)
                const tap = () => {
                  const parts = on ? d.parts.filter((x) => x !== p.key) : [...d.parts, p.key]
                  /* ready for the crew means design, tile and site are done — taking one off makes it getting ready again */
                  set({ parts, where: d.where === 'ready' && !READY_PARTS.every((k) => parts.includes(k)) ? 'new' : d.where })
                }
                return <button key={p.key} type="button" aria-pressed={on} onClick={tap} data-catchup-part={p.key} className={cn('inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[0.875rem] font-semibold transition', on ? 'border-[#2c8a5b] bg-[#e6f4ec] text-[#1f6b45]' : 'border-line bg-white text-ink-2 hover:bg-wash')}>{on && <Check className="h-4 w-4" strokeWidth={3} />}{p.label}</button>
              })}
            </div>
          </Field>
        )}
        {d.where !== 'done' && (
          <Field label="Installer">
            <Chips value={d.crew} items={[...crews.map((c) => ({ key: c as string, label: PEOPLE[c]?.name || c })), { key: '', label: 'Not picked yet' }]} onPick={(c) => set({ crew: c })} data="crew" />
          </Field>
        )}
        <Field label="Site manager">
          <Chips value={d.site} items={[...siteList.map((p) => ({ key: p as string, label: PEOPLE[p]?.name || p })), ...(d.site ? [] : [{ key: '', label: 'Not set' }])]} onPick={(p) => set({ site: p })} data="site" />
        </Field>
        {d.where === 'installing' && (
          <Field label="How far">
            <div className="flex flex-wrap items-center gap-2">
              {[10, 25, 50, 75, 90].map((n) => <button key={n} type="button" aria-pressed={d.pct === String(n)} onClick={() => set({ pct: String(n) })} data-catchup-pctpick={n} className={cn('inline-flex h-10 min-w-[3.75rem] items-center justify-center rounded-full border px-3 text-[0.875rem] font-semibold tnum transition', d.pct === String(n) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}>{n}%</button>)}
              <span className="relative w-28"><TextInput inputMode="numeric" value={[10, 25, 50, 75, 90].map(String).includes(d.pct) ? '' : d.pct} onChange={(e) => set({ pct: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })} placeholder="Other" aria-label="Percent installed" className="h-10 pr-8" data-catchup-pct /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-muted">%</span></span>
            </div>
          </Field>
        )}
        {d.where !== 'done' && (
          <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
            <Field label={getting ? 'Planned start' : 'Started'}>
              <DateBox value={d.start} onChange={(v) => set({ start: v })} label="Start" data="start" />
            </Field>
            {!getting && (
              <Field label={d.where === 'touchups' ? 'Finished the install' : 'Planned finish'}>
                <DateBox value={d.finish} min={d.start} onChange={(v) => set({ finish: v })} label="Finish" data="finish" />
              </Field>
            )}
          </div>
        )}
        {d.where !== 'done' && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => set({ hold: !d.hold })} aria-pressed={d.hold} data-catchup-hold className={cn('inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[0.875rem] font-semibold transition', d.hold ? 'border-bad-300 bg-bad-50 text-bad-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}><PauseCircle className="h-4 w-4" />On hold</button>
            {d.hold && <span className="min-w-[14rem] flex-1"><TextInput value={d.why} onChange={(e) => set({ why: e.target.value })} placeholder="Why — waiting on the GC, the tile…" aria-label="Why it’s on hold" data-catchup-why /></span>}
          </div>
        )}
        <Papers key={job.id} job={job} />
      </div>
    </Modal>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2"><span className="text-[0.875rem] font-semibold text-ink">{label}</span>{hint && <span className="text-[0.8125rem] text-muted">{hint}</span>}</div>
      {children}
    </div>
  )
}
function Chips<T extends string>({ value, items, onPick, data }: { value: T; items: { key: T; label: string }[]; onPick: (k: T) => void; data: string }) {
  return (
    <div className="flex flex-wrap gap-2" data-catchup-chips={data}>
      {items.map((it) => {
        const on = it.key === value
        return <button key={it.key || 'none'} type="button" aria-pressed={on} onClick={() => onPick(it.key)} data-chip={it.key || 'none'} className={cn('inline-flex h-10 items-center rounded-full border px-4 text-[0.875rem] font-semibold transition', on ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash', !it.key && !on && 'border-dashed font-medium text-muted')}>{it.label}</button>
      })}
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
