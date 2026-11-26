/* Visit the jobs — the admin's rounds: a video from every job site, every work day (David's ask).
 *   Every job site with work going on today, in driving order from where you are. Start opens Google Maps through all
 *   of them — nothing typed. Tap an address: Google Maps to just that one.
 *   At each one: Video (the camera opens), then Send — the phone's own share, so it goes to David on WhatsApp. It's
 *   ticked off, said in the project's history, and the video is kept with the project (Files and photos) — it waits on
 *   the phone until it's up, so going back to Google Maps doesn't lose it.
 *   Skip a stop for today (×), or add a project that isn't on it. The row on Today goes once every stop has its video. */
import * as React from 'react'
import { create } from 'zustand'
import { Navigation, Video, Send, Check, X, Plus, MapPinned, LocateFixed, Car } from 'lucide-react'
import { ListHead, WIN_ROW_GRID } from './winhead'
import { useStore, meOf, addHist, type Store } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { Button, btnClass } from '@/tileos/components/ui/core'
import { Group } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job } from '@/tileos/data/model'
import { TODAY, dayShort } from '@/tileos/lib/today'
import { toast } from '@/tileos/lib/pop'
import { useSmall } from '@/tileos/lib/phone'
import { REAL } from '@/tileos/lib/save'
import { keepFiles } from '@/tileos/lib/files'
import { putLocal, getLocal, delLocal } from '@/tileos/lib/localdb'
import { placeOf, findPlaces, inOrder, mapsRoute, mapsTo, whereAmI, driveTable, guessTable, bestPath, driveWords, mileWords, type Pt } from '@/tileos/lib/route'
import { ProjectField } from './formkit'

const S = () => useStore.getState()
export const roundsOn = (s: Pick<Store, 'rules'>) => !(s.rules.autoOff || []).includes('rounds')

/* ---------------- the day's stops ---------------- */
/* today's own changes, on this phone: a stop skipped, a project added */
type Picks = { skip: string[]; add: string[] }
const pickKey = (me: string) => `tileos-rounds:${me}:${TODAY}`
const readPicks = (me: string): Picks => { try { const p = JSON.parse(localStorage.getItem(pickKey(me)) || 'null'); return { skip: p?.skip || [], add: p?.add || [] } } catch { return { skip: [], add: [] } } }
/** a skip or an add: the window and the row on Today both look again */
export const usePicks = create<{ n: number }>(() => ({ n: 0 }))
function setPicks(me: string, f: (p: Picks) => Picks) {
  try { localStorage.setItem(pickKey(me), JSON.stringify(f(readPicks(me)))) } catch { /* private window: for now only */ }
  usePicks.setState((x) => ({ n: x.n + 1 }))
}
/** where the crews are today: the crew list sent last night (or this morning) — the jobs with people there. No list
 *  for today yet: the jobs with a crew booked today */
export function siteJobs(s: Store, day = TODAY): Job[] {
  const all = Object.values(s.jobs).filter((j) => !j.hold)
  const said = (j: Job) => (j.onSite?.day === day ? j.onSite : j.crewPlan?.day === day ? j.crewPlan : undefined)
  if (all.some((j) => said(j))) return all.filter((j) => (said(j)?.workers || 0) > 0)
  return all.filter((j) => s.bookings.some((b) => b.jobId === j.id && b.start <= day && b.end >= day))
}
/** where today's stops come from, in words */
export const stopsFrom = (s: Store, day = TODAY) => (Object.values(s.jobs).some((j) => !j.hold && (j.onSite?.day === day || j.crewPlan?.day === day)) ? 'from last night’s crew list' : 'with a crew booked today')
/** Visit the jobs skipped for today (on any phone or computer): off Today until the next work day */
export const roundsSkipped = (s: Pick<Store, 'rules'>, me: string) => s.rules.skipped?.['rounds:' + me] === TODAY
export function skipRounds(me: string, skip = true) {
  S().commit((st) => {
    const k = 'rounds:' + me
    const m = { ...(st.rules.skipped || {}) }
    if (skip) m[k] = TODAY
    else delete m[k]
    st.rules.skipped = m
  }, skip ? 'Skipped for today' : 'Back on Today', skip ? { sub: 'Visit the jobs is back on your Today the next work day.', undo: true } : { undo: false })
}
/** today's stops: those, less any skipped, with any added */
export function roundJobs(s: Store, me: string): Job[] {
  const p = readPicks(me)
  const base = siteJobs(s).filter((j) => !p.skip.includes(j.id))
  const more = p.add.map((id) => s.jobs[id]).filter((j): j is Job => !!j && !base.includes(j))
  return [...base, ...more]
}
const wentToday = (j: Job) => j.visit?.day === TODAY
/** how far the day's rounds are: stops still to go, and done */
export function roundsToday(s: Store, me: string) {
  const l = roundJobs(s, me)
  const done = l.filter(wentToday).length
  return { left: l.length - done, done }
}
/** been there: ticked off, and said in the project's history */
export function markVisited(jobId: string, video: boolean) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    if (!j) return
    const me = meOf(s.role)
    j.visit = { day: TODAY, by: me, video }
    addHist(s, jobId, { who: me, kind: 'field', title: video ? 'Site visit · video sent' : 'Site visit' })
  })
}
/** who's there today and how many — the crew list, else the installer */
function crewLine(s: Store, j: Job): string {
  const c = j.onSite?.day === TODAY ? j.onSite : j.crewPlan?.day === TODAY ? j.crewPlan : undefined
  if (c) return c.workers ? `${PEOPLE[c.crew]?.short || 'Crew'} · ${c.workers} ${c.workers === 1 ? 'person' : 'people'}` : 'nobody there today'
  const b = s.bookings.find((x) => x.jobId === j.id && x.start <= TODAY && x.end >= TODAY)
  const who = b?.crew || j.crew
  return who && PEOPLE[who] ? PEOPLE[who].short : ''
}

/* ---------------- the videos: each waits on the phone until it's up with the project ---------------- */
/* a phone that goes into a pocket — or back to Google Maps — stops an upload; the next time the app is open it goes on */
type Clip = { id: string; jobId: string; name: string; type: string; blob: Blob; tries?: number }
const CLIPS = 'tileos-clips'
const MAX = 50 * 1024 * 1024
async function clipIds(): Promise<string[]> { try { return (await getLocal<string[]>(CLIPS)) || [] } catch { return [] } }
async function dropClip(id: string) {
  await delLocal(`clip:${id}`).catch(() => undefined)
  await putLocal(CLIPS, (await clipIds()).filter((x) => x !== id)).catch(() => undefined)
}
/** keep a video with its project — now if it can, else as soon as it can */
export async function keepClip(jobId: string, f: File) {
  if (f.size > MAX) return /* too big to keep (over 50 MB) — it still went out on WhatsApp */
  if (!REAL.files) { void keepFiles(jobId, [f], 'photo', { quiet: true, hist: false }); return }
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
  try {
    await putLocal(`clip:${id}`, { id, jobId, name: f.name, type: f.type, blob: f } as Clip)
    await putLocal(CLIPS, [...(await clipIds()), id])
  } catch { void keepFiles(jobId, [f], 'photo', { quiet: true, stored: true, hist: false }); return }
  void sendClips()
}
let sending = false
/** the videos still on this phone, up to their projects — one at a time; one that won't go after a few tries is let go */
export async function sendClips() {
  if (sending || !REAL.files) return
  sending = true
  try {
    for (const id of await clipIds()) {
      const c = await getLocal<Clip>(`clip:${id}`).catch(() => undefined)
      if (!c) { await dropClip(id); continue }
      const { recs } = await keepFiles(c.jobId, [new File([c.blob], c.name, { type: c.type })], 'photo', { quiet: true, stored: true, hist: false })
      if (recs.length || (c.tries || 0) >= 4) await dropClip(id)
      else await putLocal(`clip:${id}`, { ...c, tries: (c.tries || 0) + 1 }).catch(() => undefined)
    }
  } finally { sending = false }
}
/** in the app: the videos waiting on this phone go up when it opens, comes back, or gets its signal back */
export function ClipsUploader() {
  React.useEffect(() => {
    const go = () => void sendClips()
    const back = () => { if (document.visibilityState === 'visible') go() }
    const t = setTimeout(go, 4000)
    window.addEventListener('online', go)
    document.addEventListener('visibilitychange', back)
    return () => { clearTimeout(t); window.removeEventListener('online', go); document.removeEventListener('visibilitychange', back) }
  }, [])
  return null
}

/* ---------------- the window ---------------- */
const canShare = (f: File) => { try { return !!navigator.canShare?.({ files: [f] }) } catch { return false } }

export function RoundsModal({ level }: { level: number }) {
  const s = useStore()
  const small = useSmall()
  const me = meOf(s.role)
  usePicks((x) => x.n)
  /* where you are (undefined: still asking the phone), and each place as the map finds it */
  const [here, setHere] = React.useState<Pt | null | undefined>(undefined)
  const [, found] = React.useReducer((n: number) => n + 1, 0)
  const [adding, setAdding] = React.useState(false)
  const [clips, setClips] = React.useState<Record<string, File>>({})
  const cam = React.useRef<HTMLInputElement>(null)
  const forJob = React.useRef('')
  const jobs = roundJobs(s, me)
  const ids = jobs.map((j) => j.id).join()
  const locate = () => { setHere(undefined); void whereAmI().then((p) => setHere(p)) }
  React.useEffect(() => { let on = true; void whereAmI().then((p) => { if (on) setHere(p) }); return () => { on = false } }, [])
  /* each address found (near where you are, once the phone says where that is) */
  /* (the map asked about every one: one it couldn't answer goes last, the rest are planned without it) */
  const [searched, setSearched] = React.useState('')
  React.useEffect(() => { if (here === undefined) return; const ac = new AbortController(); void findPlaces(jobs.map((j) => j.address || '').filter(Boolean), found, ac.signal, here).then(() => { if (!ac.signal.aborted) setSearched(ids) }); return () => ac.abort() }, [ids, here === undefined])
  const left = jobs.filter((j) => !wentToday(j))
  const done = jobs.filter(wentToday)
  const stops = left.map((j) => { const pt = j.address ? placeOf(j.address) : null; return { id: j.id, j, pt: pt === undefined && searched === ids ? null : pt } })
  const finding = here === undefined || stops.some((x) => x.pt === undefined)
  /* the quickest way, by road: the drive between every two stops (and from where you are), every order tried */
  const known = stops.filter((x) => x.pt) as (typeof stops[number] & { pt: Pt })[]
  const key = `${here ? `${here.lat.toFixed(3)},${here.lng.toFixed(3)}` : '-'}|${known.map((x) => x.id).join()}`
  const [plan, setPlan] = React.useState<{ key: string; ids: string[]; legs: { sec: number; m: number }[]; road: boolean } | null>(null)
  React.useEffect(() => {
    if (finding || known.length < 1) return
    const ac = new AbortController()
    const pts = [...(here ? [here] : []), ...known.map((x) => x.pt)]
    void driveTable(pts, ac.signal).then((t) => {
      if (ac.signal.aborted) return
      const g = t || guessTable(pts)
      const path = bestPath(g.sec, !!here)
      const visit = here ? path.slice(1) : path
      const legs = visit.map((p, i) => { const from = i === 0 ? (here ? 0 : -1) : visit[i - 1]; return from < 0 ? { sec: 0, m: 0 } : { sec: g.sec[from][p], m: g.m[from][p] } })
      setPlan({ key, ids: visit.map((p) => known[p - (here ? 1 : 0)].id), legs, road: !!t })
    })
    return () => ac.abort()
  }, [key, finding])
  const planned = plan && plan.key === key ? plan : null
  const order = planned ? [...planned.ids.map((id) => stops.find((x) => x.id === id)!).filter(Boolean), ...stops.filter((x) => !x.pt)] : inOrder(stops, here)
  const legOf = (id: string) => { const i = planned ? planned.ids.indexOf(id) : -1; return i >= 0 ? planned!.legs[i] : undefined }
  const total = planned ? planned.legs.reduce((a, l) => ({ sec: a.sec + l.sec, m: a.m + l.m }), { sec: 0, m: 0 }) : null
  const route = mapsRoute(order.map((x) => x.j.address || x.j.name))
  /* the camera, for one stop */
  const shoot = (jobId: string) => { forJob.current = jobId; const el = cam.current; if (el) { el.value = ''; el.click() } }
  const took = (f?: File) => { const id = forJob.current; if (f && id) setClips((c) => ({ ...c, [id]: f })) }
  /* the phone's own share (WhatsApp, to David) — then ticked off and kept with the project. Backing out sends nothing */
  const send = async (j: Job) => {
    const f = clips[j.id]
    if (!f) return
    const ext = f.name.match(/\.\w+$/)?.[0] || (/quicktime/i.test(f.type) ? '.mov' : '.mp4')
    const file = new File([f], `${j.name.replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '')}-${TODAY}${ext}`, { type: f.type || 'video/mp4' })
    if (canShare(file)) {
      try { await navigator.share({ files: [file], title: j.name, text: `${j.name} · ${dayShort(TODAY)}` }) } catch (e: any) {
        if (e?.name !== 'AbortError') toast('Couldn’t open sharing. Tap Send again')
        return
      }
    }
    markVisited(j.id, true)
    void keepClip(j.id, file)
    setClips((c) => { const n = { ...c }; delete n[j.id]; return n })
  }
  const skip = (id: string) => setPicks(me, (p) => ({ skip: [...p.skip, id], add: p.add.filter((k) => k !== id) }))
  const add = (id: string) => { setPicks(me, (p) => ({ skip: p.skip.filter((k) => k !== id), add: [...p.add.filter((k) => k !== id), id] })); setAdding(false) }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Visit the jobs"
      inlineClose
      header={<ListHead kind={{ icon: <MapPinned />, label: 'Site visit' }} title="Visit the jobs" sub={left.length ? `${left.length} ${left.length === 1 ? 'job site' : 'job sites'} ${stopsFrom(s)}` : jobs.length ? 'Every job has its video' : `No crews out today ${stopsFrom(s).replace(/^with a crew booked today$/, 'on the calendar')}`} who={me} me={me} when={`Today · ${dayShort(TODAY)}`} attrs={{ 'data-rounds-head': '' }} />}
      footer={
        left.length ? (
          <>
          {/* not today: off Today until the next work day */}
          <Button variant="ghost" className={cn(small && 'h-12')} onClick={() => { skipRounds(me); s.close() }} data-rounds-skip-day>Skip today</Button>
          <a href={route} target="_blank" rel="noopener noreferrer" className={cn(btnClass('primary', 'md'), 'ml-auto gap-2', small && 'h-12 flex-1 text-[1rem]')} data-rounds-start>
            <Navigation className="h-[1.125rem] w-[1.125rem]" />{left.length > 10 ? 'Start in Google Maps · stops 1–10' : small ? 'Start' : 'Start in Google Maps'}
          </a>
          </>
        ) : (
          <Button className={cn('ml-auto', small && 'h-12 flex-1 text-[1rem]')} variant="primary" onClick={s.close}>Done for today</Button>
        )
      }
    >
      <div className="-mx-6 -my-5 max-sm:-mx-4" data-rounds>
        {/* the day's drive, before Google Maps opens: how long, how far, from where */}
        {left.length > 0 && (
          <div className="flex items-start gap-3 border-b border-line-2 bg-wash px-6 py-3.5 max-sm:px-4" data-rounds-plan>
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 shadow-[0_0_0_1px_rgba(0,0,0,.06)]"><Car className="h-[1.125rem] w-[1.125rem]" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] font-semibold text-ink" data-rounds-total>
                {total && total.sec > 0 ? <>{planned!.road ? '' : 'About '}{driveWords(total.sec)} driving · {mileWords(total.m)}</> : finding || known.length ? 'Working out the best route…' : `${left.length} ${left.length === 1 ? 'stop' : 'stops'}`}
              </div>
              <div className="mt-0.5 text-[0.8125rem] leading-snug text-muted" data-rounds-from>
                {here === undefined ? 'Finding where you are…'
                  : here ? <>{finding || (known.length && !planned) ? 'From where you are' : known.length >= 2 ? 'The quickest order, from where you are' : 'From where you are'}{planned && !planned.road ? ' · a guess, the road map didn’t answer' : ''}</>
                    : <>Your location is off, so it starts at the first stop. To turn it on: the phone’s <b className="font-medium text-ink-2">Settings → Privacy & Security → Location Services → Safari Websites → While Using</b>.</>}
              </div>
              {here === null && <button type="button" onClick={locate} className="mt-1.5 inline-flex items-center gap-1.5 text-[0.84375rem] font-semibold text-brand-700" data-rounds-locate><LocateFixed className="h-4 w-4" />Try my location again</button>}
            </div>
          </div>
        )}
        {order.map((x, i) => {
          const j = x.j
          const clip = clips[j.id]
          const line = [j.address, crewLine(s, j)].filter(Boolean).join(' · ')
          const leg = legOf(j.id)
          return (
            <React.Fragment key={j.id}>
            {/* Google Maps takes ten stops at a time: where the first trip ends, and that the rest come after */}
            {i === 10 && <div className="border-b border-line-2 bg-wash px-6 py-2 text-[0.8125rem] text-muted max-sm:px-4" data-rounds-split>Google Maps takes 10 stops at a time · these {order.length - 10} come next: once 1–10 have their videos, Start takes these.</div>}
            <div className={cn(WIN_ROW_GRID, 'border-b border-line-2 px-6 py-2.5 max-sm:px-4')} data-rounds-stop={j.id}>
              <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center justify-self-center rounded-full bg-brand-50 text-[0.75rem] font-bold text-brand-700 tnum">{i + 1}</span>
              <div className="min-w-0">
                <div className="break-words text-[0.9375rem] font-semibold text-ink">{j.name}</div>
                {/* the address: Google Maps to just this one */}
                <a href={mapsTo(j.address || j.name)} target="_blank" rel="noopener noreferrer" className="block break-words text-[0.8125rem] text-muted hover:text-brand-700" data-rounds-address>{line || 'No address yet'}</a>
                {/* the drive to it: from where you are (the first), else from the stop before */}
                {leg && leg.sec > 0 ? <div className="mt-0.5 text-[0.75rem] font-medium text-ink-2 tnum" data-rounds-leg>{planned!.road ? '' : '~'}{driveWords(leg.sec)} · {mileWords(leg.m)}{i === 0 && here ? ' from you' : ''}</div>
                  : x.pt === null ? <div className="mt-0.5 text-[0.75rem] text-warn-700" data-rounds-nomap>Not found on the map · last</div> : null}
              </div>
              <span className="flex shrink-0 items-center gap-1">
                {clip
                  ? <Button variant="primary" size="sm" icon={<Send />} onClick={() => void send(j)} data-rounds-send>Send</Button>
                  : <Button size="sm" icon={<Video />} onClick={() => shoot(j.id)} data-rounds-video>Video</Button>}
                <button type="button" aria-label={`Skip ${j.name} today`} title="Not today" onClick={() => skip(j.id)} className="-mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink" data-rounds-skip><X className="h-4 w-4" /></button>
              </span>
            </div>
            </React.Fragment>
          )
        })}
        {!jobs.length && <div className="px-6 py-8 text-center text-[0.875rem] text-muted max-sm:px-4">No job has work going on today.</div>}
        {done.length > 0 && (
          <>
            <Group label="Done" count={done.length} tone="ok" />
            {done.map((j) => (
              <div key={j.id} className={cn(WIN_ROW_GRID, 'border-b border-line-2 px-6 py-2.5 max-sm:px-4')} data-rounds-done={j.id}>
                <span className="inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center justify-self-center rounded-full bg-ok-50 text-ok-600"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                <div className="col-span-2 min-w-0">
                  <div className="break-words text-[0.9375rem] font-semibold text-ink-2">{j.name}</div>
                  <div className="text-[0.8125rem] text-muted">{j.visit?.video ? 'Video sent' : 'Been there'}</div>
                </div>
              </div>
            ))}
          </>
        )}
        {/* a job that isn't on it — for today */}
        <div className="px-6 py-3 max-sm:px-4">
          {adding ? (
            <div className="flex flex-col gap-2">
              <ProjectField value="" onChange={(id) => { if (id) add(id) }} keep={(x) => !jobs.some((j) => j.id === x.id) && !['request', 'estimating', 'proposal', 'followup'].includes(x.stage)} autoFocus />
              <button type="button" onClick={() => setAdding(false)} className="self-start text-[0.84375rem] font-semibold text-muted">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="inline-flex h-10 items-center gap-1.5 text-[0.875rem] font-semibold text-brand-700" data-rounds-add><Plus className="h-4 w-4" />Another project</button>
          )}
        </div>
        {jobs.length > 1 && <div className="px-6 pb-3 text-[0.6875rem] text-faint max-sm:px-4">Addresses found with © OpenStreetMap</div>}
      </div>
      {/* the phone's camera, straight to video */}
      <input ref={cam} type="file" accept="video/*" capture="environment" className="hidden" onChange={(e) => took(e.target.files?.[0] || undefined)} data-rounds-cam />
    </Modal>
  )
}
