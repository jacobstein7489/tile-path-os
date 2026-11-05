/* Visit the jobs — the admin's rounds: a video from every job site, every work day (David's ask).
 *   Every job site with work going on today, in driving order from where you are. Start opens Google Maps through all
 *   of them — nothing typed. Tap an address: Google Maps to just that one.
 *   At each one: Video (the camera opens), then Send — the phone's own share, so it goes to David on WhatsApp. It's
 *   ticked off, said in the project's history, and the video is kept with the project (Files and photos) — it waits on
 *   the phone until it's up, so going back to Google Maps doesn't lose it.
 *   Skip a stop for today (×), or add a project that isn't on it. The row on Today goes once every stop has its video. */
import * as React from 'react'
import { create } from 'zustand'
import { Navigation, Video, Send, Check, X, Plus } from 'lucide-react'
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
import { placeOf, findPlaces, inOrder, mapsRoute, mapsTo, whereAmI, type Pt } from '@/tileos/lib/route'
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
const FIELD_OFF = ['request', 'estimating', 'proposal', 'followup', 'closeout', 'complete']
/** the job sites with work going on today: a crew booked there today, or it's being installed or touched up */
export function siteJobs(s: Store, day = TODAY): Job[] {
  const booked = new Set(s.bookings.filter((b) => b.start <= day && b.end >= day).map((b) => b.jobId))
  return Object.values(s.jobs).filter((j) => !j.hold && !FIELD_OFF.includes(j.stage) && (booked.has(j.id) || ['installation', 'punch'].includes(j.stage)))
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
  React.useEffect(() => { let on = true; void whereAmI().then((p) => { if (on) setHere(p) }); return () => { on = false } }, [])
  React.useEffect(() => { const ac = new AbortController(); void findPlaces(jobs.map((j) => j.address || '').filter(Boolean), found, ac.signal); return () => ac.abort() }, [ids])
  const left = jobs.filter((j) => !wentToday(j))
  const done = jobs.filter(wentToday)
  const order = inOrder(left.map((j) => ({ id: j.id, j, pt: j.address ? placeOf(j.address) : null })), here)
  const looking = here === undefined || order.some((x) => x.pt === undefined)
  const how = looking ? 'putting them in driving order…' : order.filter((x) => x.pt).length >= 2 ? (here ? 'in driving order from where you are' : 'in driving order') : 'in the order they’re listed'
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
      try { await navigator.share({ files: [file], title: j.name, text: `${j.name} — ${dayShort(TODAY)}` }) } catch (e: any) {
        if (e?.name !== 'AbortError') toast('Couldn’t open sharing — tap Send again')
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
      sub={left.length ? `${dayShort(TODAY)} · ${left.length} ${left.length === 1 ? 'job' : 'jobs'} ${how}` : `${dayShort(TODAY)} · every job has its video`}
      footer={
        left.length ? (
          <a href={route} target="_blank" rel="noopener noreferrer" className={cn(btnClass('primary', 'md'), 'ml-auto gap-2', small && 'h-12 flex-1 text-[1rem]')} data-rounds-start>
            <Navigation className="h-[1.125rem] w-[1.125rem]" />{left.length > 10 ? 'Start · the first 10 in Google Maps' : 'Start in Google Maps'}
          </a>
        ) : (
          <Button className={cn('ml-auto', small && 'h-12 flex-1 text-[1rem]')} variant="primary" onClick={s.close}>Done for today</Button>
        )
      }
    >
      <div className="-mx-6 -my-5 max-sm:-mx-4" data-rounds>
        {order.map((x, i) => {
          const j = x.j
          const clip = clips[j.id]
          const line = [j.address, crewLine(s, j)].filter(Boolean).join(' · ')
          return (
            <div key={j.id} className="flex items-center gap-3 border-b border-line-2 px-6 py-3 max-sm:px-4" data-rounds-stop={j.id}>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[0.8125rem] font-bold text-brand-700 tnum">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.9375rem] font-semibold text-ink">{j.name}</div>
                {/* the address: Google Maps to just this one */}
                <a href={mapsTo(j.address || j.name)} target="_blank" rel="noopener noreferrer" className="block truncate text-[0.8125rem] text-muted hover:text-brand-700" data-rounds-address>{line || 'No address yet'}</a>
              </div>
              {clip
                ? <Button variant="primary" size="sm" icon={<Send />} onClick={() => void send(j)} data-rounds-send>Send</Button>
                : <Button size="sm" icon={<Video />} onClick={() => shoot(j.id)} data-rounds-video>Video</Button>}
              <button type="button" aria-label={`Skip ${j.name} today`} title="Not today" onClick={() => skip(j.id)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink" data-rounds-skip><X className="h-4 w-4" /></button>
            </div>
          )
        })}
        {!jobs.length && <div className="px-6 py-8 text-center text-[0.875rem] text-muted max-sm:px-4">No job has work going on today.</div>}
        {done.length > 0 && (
          <>
            <Group label="Done" count={done.length} tone="ok" />
            {done.map((j) => (
              <div key={j.id} className="flex items-center gap-3 border-b border-line-2 px-6 py-3 max-sm:px-4" data-rounds-done={j.id}>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ok-50 text-ok-600"><Check className="h-4 w-4" strokeWidth={3} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[0.9375rem] font-semibold text-ink-2">{j.name}</div>
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
