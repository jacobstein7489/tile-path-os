/* Messages — one conversation per project, like WhatsApp: our team, the crew and the GC, with photos and voice notes,
 * and what the app noticed (a delivery, an approval, a daily update) as quiet lines in the same timeline, by time.
 * Newest at the bottom; a "New" line where you left off; "Seen by" under what you sent; a reaction with one tap; any
 * message can become a task. "Team only" stays inside — the GC's login never shows it. */
import * as React from 'react'
import { Send, Camera, Lock, ListPlus, Mic, X, Play, Pause, CheckCheck, Check, SmilePlus, Package, FileText, Receipt, HardHat, Repeat, ArrowRight, Users } from 'lucide-react'
import { useStore, addHist, newTask, NOW, meOf } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Modal, Tip, Pop } from '@/tileos/components/ui/overlay'
import { Swatch } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import type { Msg } from '@/tileos/data/messages'
import type { Notice } from '@/tileos/data/work'
import { TODAY, isoFromLabel, addDays } from '@/tileos/lib/today'
import { REAL } from '@/tileos/lib/save'
import { keepFiles, fileUrl } from '@/tileos/lib/files'

const S = () => useStore.getState()
const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

type Extra = { internal?: boolean; photos?: Msg['photos']; media?: Msg['media']; audio?: string; audioPath?: string; dur?: number; wave?: number[] }
export function postMessage(jobId: string, text: string, o: Extra = {}) {
  const me = meOf(S().role)
  S().commit((s) => {
    const list = (s.messages[jobId] ||= [])
    const m: Msg = { id: 'm' + Date.now(), who: me, text, date: NOW, time: timeNow() }
    ;(Object.keys(o) as (keyof Extra)[]).forEach((k) => { if (o[k] !== undefined) (m as any)[k] = o[k] })
    list.push(m)
    /* what I send, I've seen */
    s.seen ||= {}
    s.seen[`${jobId}|${me}`] = { n: list.length }
  })
}
/** a reaction: tap it again to take it back */
export function reactTo(jobId: string, id: string, emoji: string) {
  const me = meOf(S().role)
  S().commit((s) => {
    const m = s.messages[jobId]?.find((x) => x.id === id)
    if (!m) return
    const r = (m.reacts ||= {})
    const who = r[emoji] || []
    r[emoji] = who.includes(me) ? who.filter((p) => p !== me) : [...who, me]
    if (!r[emoji].length) delete r[emoji]
  })
}
export function messageToTask(jobId: string, id: string) {
  const st0 = S()
  const m = st0.messages[jobId]?.find((x) => x.id === id)
  if (!m) return
  const me = meOf(st0.role)
  st0.commit(
    (s) => {
      const x = s.messages[jobId].find((y) => y.id === id)!
      x.became = 'task'
      newTask(s, { jobId, title: m.text.length > 70 ? m.text.slice(0, 68) + '…' : m.text, detail: `From ${PEOPLE[m.who]?.name || 'someone'} in the project messages, ${m.date} ${m.time}.`, type: 'Field', owner: me, for: [s.role], state: 'now', due: 'Today', tone: 'info', where: 'From a message' })
      addHist(s, jobId, { who: me, kind: 'question', title: 'A message became a task', detail: m.text })
    },
    'It’s a task now',
    { sub: 'On your Today, linked to the message.' },
  )
}
/** messages from someone else that I haven't opened yet — the count on the project */
export const unreadOf = (s: { messages: Record<string, Msg[]>; role: Role; seen?: Record<string, { n: number }> }, jobId: string) => {
  const me = meOf(s.role)
  return (s.messages[jobId] || []).slice(s.seen?.[`${jobId}|${me}`]?.n || 0).filter((m) => m.who !== me).length
}
/** opening a conversation reads it — for me */
export function readThread(jobId: string) {
  const st = S()
  const me = meOf(st.role)
  const k = `${jobId}|${me}`
  const n = (st.messages[jobId] || []).length
  const news = st.notices.some((x) => x.jobId === jobId && x.unread && (!x.for || x.for.includes(me)))
  if (st.seen?.[k]?.n === n && !st.seen?.[k]?.unread && !news) return
  st.commit((x) => {
    x.seen ||= {}
    x.seen[k] = { n }
    x.notices.forEach((y) => { if (y.jobId === jobId && y.unread && (!y.for || y.for.includes(me))) y.unread = false })
  })
}

/* ---------------- the timeline: messages and what the app noticed, by time ---------------- */
const clockMin = (t?: string) => {
  const m = (t || '').match(/(\d{1,2}):(\d\d)\s*(AM|PM)?/i)
  if (!m) return 12 * 60
  let h = Number(m[1]) % 12
  if (/pm/i.test(m[3] || '')) h += 12
  return h * 60 + Number(m[2])
}
const dayMs = (iso: string) => Date.parse(iso + 'T00:00:00Z')
const nowMs = () => { const d = new Date(); return dayMs(TODAY) + (d.getHours() * 60 + d.getMinutes()) * 60_000 }
const msgTime = (m: Msg) => dayMs((m.date === NOW ? TODAY : isoFromLabel(m.date)) || TODAY) + clockMin(m.time) * 60_000
const WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
/** when a notice happened, from its id (made with the clock) or its words ("1h ago", "10:05 AM", "Sun", "Oct 12") */
function noticeTime(n: Notice, k: number): number {
  const ts = n.id.match(/(\d{13})/)
  if (ts) { const d = new Date(Number(ts[1])); return dayMs(TODAY) + (d.getHours() * 60 + d.getMinutes()) * 60_000 }
  const w = n.when.trim().toLowerCase()
  if (w === 'just now') return nowMs()
  const ago = w.match(/^(\d+)\s*(m|min|h|hr)s?\s+ago$/)
  if (ago) return nowMs() - Number(ago[1]) * (ago[2].startsWith('h') ? 3_600_000 : 60_000)
  if (/\d{1,2}:\d\d/.test(w)) return dayMs(TODAY) + clockMin(n.when) * 60_000
  if (w === 'yesterday') return dayMs(addDays(TODAY, -1)) + 12 * 3_600_000
  const wd = WEEK.findIndex((x) => w.startsWith(x))
  if (wd >= 0 && w.length <= 9) { let d = addDays(TODAY, -1); for (let i = 0; i < 7 && new Date(dayMs(d)).getUTCDay() !== wd; i++) d = addDays(d, -1); return dayMs(d) + 12 * 3_600_000 }
  const iso = isoFromLabel(n.when)
  return iso ? dayMs(iso) + 12 * 3_600_000 : nowMs() - k * 60_000
}
type Item = { k: 'msg'; m: Msg; t: number } | { k: 'news'; n: Notice; t: number }
/** the messages as they are, with the notices woven in where they happened */
function timeline(msgs: Msg[], news: Notice[]): Item[] {
  const ns = news.map((n, k) => ({ k: 'news' as const, n, t: noticeTime(n, k) })).sort((a, b) => a.t - b.t)
  const out: Item[] = []
  let j = 0
  msgs.forEach((m) => {
    const t = msgTime(m)
    while (j < ns.length && ns[j].t < t) out.push(ns[j++])
    out.push({ k: 'msg', m, t })
  })
  while (j < ns.length) out.push(ns[j++])
  return out
}
const dayOfMs = (t: number) => new Date(t).toISOString().slice(0, 10)
const dayWord = (iso: string) => (iso === TODAY ? 'Today' : iso === addDays(TODAY, -1) ? 'Yesterday' : new Date(dayMs(iso)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }))

/* names in a group, each with its own color — like WhatsApp */
const NAME_TONES = ['text-[#1f6fb2]', 'text-[#b4472c]', 'text-[#2f8a4f]', 'text-[#8a4fb8]', 'text-[#c2410c]', 'text-[#0f7f8a]', 'text-[#a3366b]']
const toneOf = (who: string) => NAME_TONES[[...who].reduce((n, c) => n + c.charCodeAt(0), 0) % NAME_TONES.length]

const NEWS_ICON: Record<Notice['kind'], React.ElementType> = { material: Package, pricing: FileText, money: Receipt, field: HardHat, change: Repeat }

/* ---------------- a voice note: tap the mic, talk, tap Send ---------------- */
const fmtDur = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`
/** the shape of the recording, for the bars */
async function waveOf(blob: Blob, bars = 32): Promise<number[] | undefined> {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return undefined
    const ctx = new AC()
    const buf: AudioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    const d = buf.getChannelData(0)
    const step = Math.max(1, Math.floor(d.length / bars))
    const peaks = Array.from({ length: bars }, (_, i) => { let p = 0; for (let k = i * step; k < Math.min(d.length, (i + 1) * step); k += 16) p = Math.max(p, Math.abs(d[k])); return p })
    const top = Math.max(...peaks, 0.01)
    void ctx.close?.()
    return peaks.map((p) => Math.round(Math.max(0.08, p / top) * 100) / 100)
  } catch { return undefined }
}
const asDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(''); r.readAsDataURL(b) })
function useRecorder(onDone: (blob: Blob, dur: number) => void) {
  const [on, setOn] = React.useState(false)
  const [secs, setSecs] = React.useState(0)
  const [err, setErr] = React.useState('')
  const rec = React.useRef<MediaRecorder | null>(null)
  const chunks = React.useRef<Blob[]>([])
  const t0 = React.useRef(0)
  const tick = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const cancel = React.useRef(false)
  const done = React.useRef(onDone)
  done.current = onDone
  const stop = React.useCallback(() => { if (tick.current) clearInterval(tick.current); tick.current = null; rec.current?.stream.getTracks().forEach((x) => x.stop()) }, [])
  const start = async () => {
    setErr('')
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setErr('This browser can’t record — try Chrome or Safari.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t))
      const r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined)
      chunks.current = []
      cancel.current = false
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      r.onstop = () => {
        stop()
        const dur = Math.max(1, Math.round((Date.now() - t0.current) / 1000))
        setOn(false); setSecs(0)
        if (cancel.current || !chunks.current.length) return
        done.current(new Blob(chunks.current, { type: r.mimeType || type || 'audio/webm' }), dur)
      }
      rec.current = r
      t0.current = Date.now()
      r.start(250)
      setOn(true); setSecs(0)
      tick.current = setInterval(() => { const n = Math.round((Date.now() - t0.current) / 1000); setSecs(n); if (n >= 180) r.stop() }, 250)
    } catch { setErr('Microphone not allowed — check the browser’s permission for this site.') }
  }
  const finish = () => rec.current?.stop()
  const drop = () => { cancel.current = true; rec.current?.stop() }
  React.useEffect(() => () => stop(), [stop])
  return { on, secs, err, start, finish, drop }
}
/** where a kept recording plays from: the preview keeps it in the message; the real app keeps it in storage */
const LINKS = new Map<string, { url: string; at: number }>()
async function audioSrc(m: Msg): Promise<string> {
  if (m.audio) return m.audio
  if (!m.audioPath || !REAL.files) return ''
  const hit = LINKS.get(m.audioPath)
  if (hit && Date.now() - hit.at < 9 * 60_000) return hit.url
  const url = await REAL.files.url(m.audioPath)
  LINKS.set(m.audioPath, { url, at: Date.now() })
  return url
}
/** the voice note in a bubble: play, the bars fill as it plays, how long it runs */
function Voice({ m, mine }: { m: Msg; mine: boolean }) {
  const a = React.useRef<HTMLAudioElement>(null)
  const [ready, setReady] = React.useState(false)
  const [playing, setPlaying] = React.useState(false)
  const [pos, setPos] = React.useState(0)
  const [at, setAt] = React.useState(0)
  const bars = m.wave?.length ? m.wave : Array.from({ length: 32 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin((i + 1) * 1.7 + m.id.length)))
  const toggle = async () => {
    const el = a.current
    if (!el) return
    if (playing) { el.pause(); return }
    if (!ready) { const u = await audioSrc(m); if (!u) return; el.src = u; setReady(true) }
    try { await el.play() } catch { /* the browser wants another tap */ }
  }
  return (
    <div className="flex min-w-[13rem] items-center gap-2.5 py-0.5">
      <button onClick={() => void toggle()} aria-label={playing ? 'Pause' : 'Play the voice note'} className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition', mine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-brand-600 text-white hover:bg-brand-700')}>
        {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <span className="flex h-7 flex-1 items-center gap-[0.125rem]" aria-hidden>
        {bars.map((b, i) => <span key={i} className={cn('w-[0.1875rem] shrink-0 rounded-full transition-colors', i / bars.length < pos ? (mine ? 'bg-white' : 'bg-brand-600') : mine ? 'bg-white/40' : 'bg-[#c9c3b8]')} style={{ height: `${Math.round(b * 100)}%` }} />)}
      </span>
      <span className={cn('shrink-0 text-[0.75rem] tnum', mine ? 'text-white/85' : 'text-muted')}>{fmtDur(playing || at ? at : m.dur || 0)}</span>
      <audio ref={a} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPos(0); setAt(0) }} onTimeUpdate={(e) => { const el = e.currentTarget; setAt(el.currentTime); setPos(el.duration && isFinite(el.duration) ? el.currentTime / el.duration : m.dur ? el.currentTime / m.dur : 0) }} />
    </div>
  )
}

/** photos in a bubble: the small pictures; tap one and it opens big */
function Photos({ m }: { m: Msg }) {
  const s = useStore()
  const list = m.media || []
  const open = async (i: number) => {
    const items = await Promise.all(list.map(async (x, k) => {
      const rec = s.files.find((f) => f.id === x.id)
      const url = (rec && (await fileUrl(rec).catch(() => undefined))) || x.thumb
      return { id: m.id + k, kind: 'photo' as const, url, cap: m.text && !/^(Photo|\d+ photos)$/.test(m.text) ? m.text : 'Photo', who: m.who, day: m.date }
    }))
    s.open({ t: 'media', items, index: i })
  }
  if (!list.length && m.photos?.length)
    return (
      <div className={cn('mt-1 grid gap-1', m.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {m.photos.map((p, i) => <button key={i} onClick={() => s.open({ t: 'media', items: m.photos!.map((x, k) => ({ id: m.id + k, kind: 'photo', sw: x.sw, cap: x.cap, who: m.who, day: m.date })), index: i })} className="overflow-hidden rounded-xl"><Swatch kind={p.sw} size={120} radius={12} className="!h-[7.5rem] !w-[7.5rem]" /></button>)}
      </div>
    )
  return (
    <div className={cn('mt-1 grid gap-1', list.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
      {list.slice(0, 4).map((x, i) => (
        <button key={x.id} onClick={() => void open(i)} className="relative overflow-hidden rounded-xl bg-black/5">
          {x.thumb ? <img src={x.thumb} alt="" className={cn('block object-cover', list.length > 1 ? 'aspect-square w-[7.5rem]' : 'max-h-[16rem] w-[14rem]')} /> : <span className="block aspect-square w-[7.5rem]" />}
          {i === 3 && list.length > 4 && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[1.125rem] font-bold text-white">+{list.length - 4}</span>}
        </button>
      ))}
    </div>
  )
}

const EMOJI = ['👍', '✅', '❤️', '😂', '🙏']
/** under a bubble: the reactions, and who gave them */
function Reacts({ m, jobId, mine }: { m: Msg; jobId: string; mine: boolean }) {
  const role = useStore((s) => s.role)
  const me = meOf(role)
  const r = Object.entries(m.reacts || {}).filter(([, who]) => who.length)
  if (!r.length) return null
  return (
    <div className={cn('relative z-[1] -mt-1.5 flex flex-wrap gap-1', mine ? 'justify-end pr-2' : 'pl-2')}>
      {r.map(([e, who]) => (
        <Tip key={e} label={who.map((p) => (p === me ? 'You' : PEOPLE[p]?.short || p)).join(', ')}>
          <button onClick={() => reactTo(jobId, m.id, e)} className={cn('inline-flex h-6 items-center gap-1 rounded-full border bg-white px-1.5 text-[0.8125rem] shadow-sm', who.includes(me) ? 'border-brand-300' : 'border-line')}>{e}{who.length > 1 && <span className="text-[0.6875rem] font-semibold tnum text-ink-2">{who.length}</span>}</button>
        </Tip>
      ))}
    </div>
  )
}

/* ---------------- the conversation ---------------- */
export function Thread({ jobId, outside, newFrom }: { jobId: string; outside?: boolean; newFrom?: { n: number; news: string[] } }) {
  const s = useStore()
  const me = meOf(s.role)
  const all = s.messages[jobId] || []
  const list = all.filter((m) => !outside || !m.internal)
  const news = outside ? [] : (s.role === 'accounting' ? s.notices.filter((n) => n.kind === 'money') : s.notices).filter((n) => n.jobId === jobId && (!n.for || n.for.includes(me)))
  /* where I left off — the "New" line goes there (taken when the conversation opened) */
  const [from] = React.useState(() => newFrom || { n: s.seen?.[`${jobId}|${me}`]?.n ?? 0, news: news.filter((n) => n.unread).map((n) => n.id) })
  const items = timeline(list, news)
  const isNew = (x: Item) => (x.k === 'msg' ? all.indexOf(x.m) >= from.n && x.m.who !== me : from.news.includes(x.n.id))
  const firstNew = items.findIndex(isNew)
  const newCount = items.filter(isNew).length
  const [text, setText] = React.useState('')
  const [internal, setInternal] = React.useState(false)
  const [busy, setBusy] = React.useState('')
  const fileRef = React.useRef<HTMLInputElement>(null)
  const newLine = React.useRef<HTMLDivElement>(null)
  const end = React.useRef<HTMLDivElement>(null)
  /* open on the "New" line when there is one, else at the bottom; then follow what comes in */
  const firstRun = React.useRef(true)
  React.useEffect(() => {
    if (firstRun.current && newLine.current) newLine.current.scrollIntoView({ block: 'center' })
    else end.current?.scrollIntoView({ block: 'end' })
    firstRun.current = false
  }, [items.length])
  /* while it's open, what lands in it is read */
  React.useEffect(() => { if (!outside) readThread(jobId) }, [jobId, all.length, outside])
  const job = s.jobs[jobId]
  const people = Array.from(new Set<PersonKey>([...(['ys', 'yakov'] as PersonKey[]), ...(job?.crew ? [job.crew as PersonKey] : []), ...s.team.filter((x) => x.status !== 'off' && x.role !== 'client').map((x) => x.key as PersonKey), 'gcpp'])).filter((p) => p !== me)
  /* my last message: who has seen it */
  const lastMine = (() => { for (let i = all.length - 1; i >= 0; i--) if (all[i].who === me && (!outside || !all[i].internal)) return i; return -1 })()
  const seenBy = lastMine < 0 ? [] : people.filter((p) => (s.seen?.[`${jobId}|${p}`]?.n || 0) > lastMine)
  const send = () => {
    if (!text.trim()) return
    postMessage(jobId, text.trim(), { internal: (!outside && internal) || undefined })
    setText('')
  }
  const mic = useRecorder(async (blob, dur) => {
    setBusy('Sending the voice note…')
    const wave = await waveOf(blob)
    let audio: string | undefined
    let audioPath: string | undefined
    if (REAL.files) {
      try { audioPath = await REAL.files.put(jobId, 'v' + Date.now().toString(36), blob, `voice-note.${/mp4/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm'}`) } catch { audio = await asDataUrl(blob) }
    } else audio = await asDataUrl(blob)
    postMessage(jobId, `Voice note · ${fmtDur(dur)}`, { internal: (!outside && internal) || undefined, audio, audioPath, dur, wave })
    setBusy('')
  })
  const addPhotos = async (files: File[]) => {
    if (!files.length) return
    setBusy(files.length === 1 ? 'Sending the photo…' : `Sending ${files.length} photos…`)
    const kept = await keepFiles(jobId, files, 'photo', { quiet: true })
    if (kept.recs.length) postMessage(jobId, text.trim() || (kept.recs.length === 1 ? 'Photo' : `${kept.recs.length} photos`), { internal: (!outside && internal) || undefined, media: kept.recs.map((r) => ({ id: r.id, thumb: r.thumb })) })
    setText('')
    setBusy(kept.problem ? `The photo didn’t go up — ${kept.problem}` : '')
  }
  let lastDay = ''
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto bg-[#f3efe8] bg-[radial-gradient(#e2dbcf_0.0625rem,transparent_0.0625rem)] px-5 py-4 [background-size:1.125rem_1.125rem] max-sm:px-2.5">
        {items.map((x, idx) => {
          const day = dayOfMs(x.t)
          const sep = day !== lastDay ? (lastDay = day) : ''
          const head = (
            <>
              {sep && <div className="my-3 flex justify-center"><span className="rounded-full bg-white/90 px-3 py-1 text-[0.75rem] font-semibold text-muted shadow-sm">{dayWord(sep)}</span></div>}
              {idx === firstNew && <div ref={newLine} data-new-line className="my-3 flex items-center gap-3"><span className="h-px flex-1 bg-bad-300" /><span className="rounded-full bg-bad-500 px-2.5 py-0.5 text-[0.71875rem] font-bold text-white">{newCount} new</span><span className="h-px flex-1 bg-bad-300" /></div>}
            </>
          )
          if (x.k === 'news') {
            const n = x.n
            const Ic = NEWS_ICON[n.kind]
            return (
              <React.Fragment key={'n' + n.id}>
                {head}
                <div className="my-2 flex justify-center">
                  <button data-news={n.id} onClick={() => { if (n.open) s.open(n.open); else s.open({ t: 'job', id: jobId }) }} className="group inline-flex max-w-[92%] items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-left text-[0.8125rem] leading-snug text-ink-2 shadow-sm ring-1 ring-black/[0.03] transition hover:bg-white">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-wash text-muted"><Ic className="h-3.5 w-3.5" /></span>
                    <span className="min-w-0">{n.text}</span>
                    <span className="shrink-0 text-[0.71875rem] text-faint">{n.when}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint transition group-hover:text-brand-600" />
                  </button>
                </div>
              </React.Fragment>
            )
          }
          const m = x.m
          const mine = m.who === me
          const ext = m.who === 'gcpp'
          const prev = items[idx - 1]
          const sameAsBefore = !!prev && prev.k === 'msg' && prev.m.who === m.who && !sep && idx !== firstNew
          const isLastMine = all.indexOf(m) === lastMine
          const media = !!(m.media?.length || m.photos?.length)
          return (
            <React.Fragment key={m.id}>
              {head}
              <div data-msg={m.id} className={cn('group flex items-end gap-2', mine && 'flex-row-reverse', sameAsBefore ? 'mt-0.5' : 'mt-2.5')}>
                {!mine && <span className="w-[1.875rem] shrink-0">{!sameAsBefore && <Avatar who={m.who} size={30} />}</span>}
                <div className={cn('flex min-w-0 max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
                  <div className={cn('relative rounded-2xl px-3 py-1.5 text-left text-[0.875rem] leading-snug shadow-[0_0.0625rem_0.0625rem_rgba(28,26,22,.08)]', mine ? 'rounded-br-md bg-brand-600 text-white' : m.internal ? 'rounded-bl-md bg-[#fff6e0] text-ink ring-1 ring-warn-100' : 'rounded-bl-md bg-white text-ink')}>
                    {!mine && !sameAsBefore && <div className={cn('mb-0.5 text-[0.75rem] font-semibold', toneOf(m.who))}>{PEOPLE[m.who]?.name || 'Someone'}{ext ? ' · GC' : ''}{m.wa ? <span className="font-normal text-muted"> · via WhatsApp</span> : ''}</div>}
                    {m.internal && <div className={cn('mb-0.5 inline-flex items-center gap-1 text-[0.71875rem] font-semibold', mine ? 'text-white/80' : 'text-warn-700')}><Lock className="h-3 w-3" />Team only</div>}
                    {m.audio || m.audioPath ? <Voice m={m} mine={mine} /> : media ? <Photos m={m} /> : <div className="whitespace-pre-wrap break-words">{m.text}</div>}
                    {media && m.text && !/^(Photo|\d+ photos)$/.test(m.text) && <div className="mt-1 whitespace-pre-wrap break-words">{m.text}</div>}
                    <div className={cn('mt-0.5 flex items-center justify-end gap-1 text-[0.6875rem] tnum', mine ? 'text-white/75' : 'text-faint')}>
                      {m.became && <span className={cn('mr-1 font-semibold', mine ? 'text-white' : 'text-ok-700')}>made a task ·</span>}
                      {m.time}
                      {mine && (isLastMine && seenBy.length ? <CheckCheck className="h-3.5 w-3.5 text-[#a9d8ff]" /> : <Check className="h-3.5 w-3.5" />)}
                    </div>
                  </div>
                  <Reacts m={m} jobId={jobId} mine={mine} />
                  {isLastMine && !outside && <div className="mt-0.5 pr-1 text-[0.6875rem] text-muted">{seenBy.length ? `Seen by ${seenBy.map((p) => PEOPLE[p]?.short || p).join(', ')}` : 'Sent'}</div>}
                </div>
                {/* react, or make it a task — on hover on a computer, always there on a phone */}
                <span className="mb-1.5 shrink-0 opacity-45 transition focus-within:opacity-100 group-hover:opacity-100">
                  <Pop width={250} side="top" align={mine ? 'end' : 'start'} trigger={<button aria-label="React" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-muted shadow-sm hover:text-ink"><SmilePlus className="h-4 w-4" /></button>}>
                    <div className="flex justify-between">{EMOJI.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => reactTo(jobId, m.id, e)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[1.25rem] transition hover:scale-110 hover:bg-wash">{e}</button>)}</div>
                    {!outside && !m.became && <button onClick={() => messageToTask(jobId, m.id)} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50"><ListPlus className="h-4 w-4" />Make it a task</button>}
                  </Pop>
                </span>
              </div>
            </React.Fragment>
          )
        })}
        {!items.length && <div className="py-16 text-center text-[0.875rem] text-muted">No messages yet — say something, send a photo, or a voice note.</div>}
        <div ref={end} />
      </div>
      <div className="shrink-0 border-t border-line-2 bg-white px-3 py-2.5 max-sm:px-2">
        {busy && <div className="mb-1.5 px-1 text-[0.78125rem] font-medium text-ink-2">{busy}</div>}
        {mic.on ? (
          <div className="flex items-center gap-3 rounded-full border border-bad-200 bg-bad-50 py-1.5 pl-4 pr-1.5">
            <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-bad-500" />
            <span className="text-[0.875rem] font-semibold tnum text-bad-700">{fmtDur(mic.secs)}</span>
            <span className="text-[0.78125rem] text-muted max-sm:hidden">Recording — tap Send when you’re done</span>
            <button onClick={mic.drop} aria-label="Throw the recording away" className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-white hover:text-ink"><X className="h-4 w-4" /></button>
            <button onClick={mic.finish} aria-label="Send the voice note" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-btn hover:bg-brand-700"><Send className="h-[1.125rem] w-[1.125rem]" /></button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" aria-label="Photos to send" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void addPhotos(f) }} />
            <div className={cn('flex min-w-0 flex-1 items-end rounded-[1.375rem] border pl-1.5 transition focus-within:border-brand-300', internal ? 'border-warn-200 bg-[#fffaf0]' : 'border-line bg-white')}>
              <Tip label="Send a photo"><button onClick={() => fileRef.current?.click()} aria-label="Send a photo" className="mb-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-wash hover:text-ink"><Camera className="h-[1.125rem] w-[1.125rem]" /></button></Tip>
              <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} aria-label="Message" placeholder={outside ? 'Message the Cobblestone team' : internal ? 'Team only — the GC won’t see this' : 'Message'} className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[0.9375rem] leading-tight outline-none placeholder:text-faint" />
              {!outside && <Tip label={internal ? 'Team only — tap to send to everyone' : 'Everyone sees it, the GC too — tap for team only'}><button onClick={() => setInternal(!internal)} aria-pressed={internal} aria-label="Team only" className={cn('mb-1 mr-1 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[0.75rem] font-semibold transition', internal ? 'bg-warn-500 text-white' : 'text-muted hover:bg-wash')}>{internal ? <Lock className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}<span className="max-sm:hidden">{internal ? 'Team only' : 'Everyone'}</span></button></Tip>}
            </div>
            {text.trim()
              ? <button onClick={send} aria-label="Send" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-btn transition hover:bg-brand-700"><Send className="h-[1.125rem] w-[1.125rem]" /></button>
              : <Tip label="Voice note — tap, talk, tap Send"><button onClick={() => void mic.start()} aria-label="Record a voice note" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-btn transition hover:bg-brand-700"><Mic className="h-5 w-5" /></button></Tip>}
          </div>
        )}
        {mic.err && <div className="mt-1.5 px-1 text-[0.78125rem] font-medium text-bad-600">{mic.err}</div>}
      </div>
    </div>
  )
}

export function MessagesModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  const c = CUSTOMERS[job.clientId]
  const team: PersonKey[] = Array.from(new Set([job.pm || 'ys', 'yakov', ...(job.crew ? [job.crew as PersonKey] : [])]))
  return (
    <Modal level={level} size="lg" tall onClose={s.close} title={`Messages · ${job.name}`} sub={`Our team, the crew and ${c?.name || job.client} — photos, voice notes, questions, answers.`} bodyClass="p-0">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-line-2 px-5 py-2.5 max-sm:px-3">
          <span className="flex -space-x-1.5">{team.map((p) => <Avatar key={p} who={p} size={26} ring />)}<Avatar who="gcpp" size={26} ring /></span>
          <span className="truncate text-[0.78125rem] text-muted">{team.map((p) => PEOPLE[p]?.short).join(', ')} and {PEOPLE.gcpp.name}</span>
        </div>
        <div className="min-h-0 flex-1"><Thread jobId={jobId} /></div>
      </div>
    </Modal>
  )
}
