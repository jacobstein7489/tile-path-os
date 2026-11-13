/* Talking to Tile OS — one way to listen, everywhere there's a mic.
 *
 * The microphone first: it's asked for once, and when it's blocked or missing, that's said plainly with what to do.
 * Then the words, as you say them — the browser's own listening (Chrome, Edge, Safari on a computer). Where the
 * browser can't (an iPhone's home-screen app, a browser whose listening service is off or out of reach), it records,
 * and the company's AI writes it down — the same speech-to-text ChatGPT uses: every second and a half while you talk
 * (the words show as you go), and once more, carefully, when you stop. While it listens the level of your voice moves,
 * so you can see it hears you — and when it hears nothing for a few seconds, it says so. */
import * as React from 'react'
import { noteHeard } from '@/tileos/lib/robottime'

/** the company's AI writing down a recording (base64 — a WAV unless its type is said) — set by the real app
 *  (lib/cloud); a hint is the names and words likely to come up; live: the quick look while you talk */
export type Hearer = (audioBase64: string, hint: string, signal?: AbortSignal, opts?: { type?: string; live?: boolean }) => Promise<string>
let hearer: Hearer | undefined
export const setHearer = (fn: Hearer | undefined) => { hearer = fn }
export const canTranscribe = () => !!hearer

const SR = (): any => (typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined)
const recordable = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== 'undefined'
/** an iPhone or iPad — its browser's listening is unreliable (and off in a home-screen app): record there instead */
const apple = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1))
/** there's a way to listen at all */
export const canListen = () => { try { return !!SR() || recordable() } catch { return false } }

const onPhone = () => apple() || /Android/.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
/** what's wrong with the microphone, and what to do — the words for each */
function micProblem(e: any): string {
  const n = String(e?.name || '')
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError')
    return apple()
      ? 'The microphone is off for Tile OS. On the iPhone: Settings → Apps → Safari → Microphone → Allow. Then tap the mic again.'
      : onPhone()
        ? 'The microphone is off for Tile OS. Tap the icon left of the web address → Permissions → Microphone → Allow. Then tap the mic again.'
        : 'The microphone is off for Tile OS. Click the icon left of the web address → turn Microphone on → reload the page, then tap the mic again.'
  if (n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError') return 'No microphone found — plug one in, or type it.'
  if (n === 'NotReadableError' || n === 'TrackStartError') return 'Another app is using the microphone — close it there, then tap the mic again.'
  return 'The microphone didn’t start — type it, or try again.'
}

/** a recording as it was made, in base64 */
async function base64Of(blob: Blob): Promise<string> {
  const url: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result || '')); r.onerror = () => rej(r.error); r.readAsDataURL(blob) })
  return url.slice(url.indexOf(',') + 1)
}
/** a sound meter's context — made right in the tap (an iPhone only lets sound start from one) */
function soundContext(): any {
  try {
    const W = window as any
    const AC = W.AudioContext || W.webkitAudioContext
    if (!AC) return null
    const ac = new AC()
    try { void ac.resume?.() } catch { /* fine */ }
    return ac
  } catch { return null }
}

/** the recording, as the AI takes it: 16 kHz, one channel, WAV — in base64 */
export async function toWav16k(blob: Blob): Promise<string> {
  const W = window as any
  const AC = W.AudioContext || W.webkitAudioContext
  const ac = new AC()
  const data = await blob.arrayBuffer()
  const audio: AudioBuffer = await new Promise((res, rej) => { const p = ac.decodeAudioData(data, res, rej); if (p?.then) p.then(res, rej) })
  try { await ac.close?.() } catch { /* closed */ }
  const rate = 16000
  const OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext
  const off = new OAC(1, Math.max(1, Math.ceil(audio.duration * rate)), rate)
  const src = off.createBufferSource()
  src.buffer = audio
  src.connect(off.destination)
  src.start(0)
  const out: AudioBuffer = await off.startRendering()
  const pcm = out.getChannelData(0)
  const buf = new ArrayBuffer(44 + pcm.length * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) { const x = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true) }
  const u = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

export type Voice = {
  /** listening now */
  on: boolean
  /** the words so far that aren't final yet — shown as they come */
  hearing: string
  /** how loud, 0–1: the bars move with it */
  level: number
  /** the level is real — the mic's meter is running (otherwise the bars move on their own) */
  metering: boolean
  /** listening, and nothing heard for a few seconds */
  quiet: boolean
  /** the AI is writing the recording down */
  busy: boolean
  /** what went wrong, and what to do */
  err: string
  start: () => void
  stop: () => void
  /** there's a way to listen here */
  can: boolean
}

/** listen: each final piece of what's said goes to onText. hint: names and words likely to come up */
export function useVoice(onText: (t: string) => void, hint = ''): Voice {
  const [on, setOn] = React.useState(false)
  const [hearing, setHearing] = React.useState('')
  const [level, setLevel] = React.useState(0)
  const [quiet, setQuiet] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  const [metering, setMetering] = React.useState(false)
  const said = React.useRef(onText)
  said.current = onText
  const hintRef = React.useRef(hint)
  hintRef.current = hint
  const rec = React.useRef<any>(null)
  const want = React.useRef(false)
  const srDown = React.useRef(false)
  const gotWords = React.useRef(false)
  const loud = React.useRef(false)
  /* the meter ran: then "loud" can be trusted */
  const metered = React.useRef(false)
  const lastLoud = React.useRef(0)
  const stream = React.useRef<MediaStream | null>(null)
  const ctx = React.useRef<any>(null)
  const raf = React.useRef(0)
  const mr = React.useRef<any>(null)
  const chunks = React.useRef<Blob[]>([])
  const cap = React.useRef<any>(null)
  const alive = React.useRef(true)
  const starting = React.useRef(false)

  const meterOff = () => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    try { ctx.current?.close?.() } catch { /* closed */ }
    ctx.current = null
    if (alive.current) { setLevel(0); setQuiet(false); setMetering(false) }
  }
  const streamOff = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null }
  React.useEffect(() => () => {
    alive.current = false
    want.current = false
    try { rec.current?.abort?.() } catch { /* gone */ }
    try { if (mr.current && mr.current.state !== 'inactive') { mr.current.onstop = null; mr.current.stop() } } catch { /* gone */ }
    clearTimeout(cap.current)
    clearInterval(liveTimer.current)
    liveAbort.current?.abort()
    meterOff()
    streamOff()
  }, [])

  /* the level of the voice — from the mic itself, so it moves only when it hears something */
  const meter = (s: MediaStream, made: any) => {
    try {
      const ac = made || soundContext()
      if (!ac) return
      try { void ac.resume?.() } catch { /* fine */ }
      const an = ac.createAnalyser()
      an.fftSize = 512
      ac.createMediaStreamSource(s).connect(an)
      ctx.current = ac
      const buf = new Uint8Array(an.fftSize)
      let last = 0
      lastLoud.current = Date.now()
      const tick = (t: number) => {
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) { const x = (buf[i] - 128) / 128; sum += x * x }
        const lv = Math.min(1, Math.sqrt(sum / buf.length) * 5)
        if (lv > 0.08) { lastLoud.current = Date.now(); loud.current = true }
        if (t - last > 80 && alive.current) {
          last = t
          if (ac.state === 'running' && !metered.current) { metered.current = true; setMetering(true) }
          setLevel(lv)
          setQuiet(ac.state === 'running' && Date.now() - lastLoud.current > 5000)
        }
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    } catch { /* no meter: the bars just move */ }
  }

  /* while you talk (recording): every second and a half, what's been said so far is written down — the words show */
  const liveTimer = React.useRef<any>(null)
  const liveBusy = React.useRef(false)
  const liveSent = React.useRef(0)
  const liveAbort = React.useRef<AbortController | null>(null)
  const liveOff = () => { clearInterval(liveTimer.current); liveTimer.current = null; liveAbort.current?.abort(); liveAbort.current = null }
  const liveLook = async (type: string) => {
    if (!hearer || liveBusy.current || !want.current) return
    const n = chunks.current.length
    if (!n || n === liveSent.current || (metered.current && !loud.current)) return
    liveBusy.current = true
    liveSent.current = n
    const ac = new AbortController()
    liveAbort.current = ac
    try {
      const text = (await hearer(await base64Of(new Blob(chunks.current.slice(0, n), { type })), hintRef.current, ac.signal, { type, live: true })).trim()
      if (alive.current && want.current && !ac.signal.aborted && text) setHearing(text)
    } catch { /* the careful one at the end still comes */ } finally { liveBusy.current = false }
  }
  /* write the recording down when you stop: carefully, the whole of it — as it was made, a WAV if that fails */
  const writeDown = async (blob: Blob) => {
    if (!hearer) { setErr('This browser can’t listen here — type it instead.'); return }
    setBusy(true)
    const t0 = performance.now()
    try {
      let text = ''
      try { text = (await hearer(await base64Of(blob), hintRef.current, undefined, { type: blob.type || 'audio/webm' })).trim() } catch { text = (await hearer(await toWav16k(blob), hintRef.current)).trim() }
      if (!alive.current) return
      noteHeard(performance.now() - t0)
      if (text) said.current(text)
      else setErr('I didn’t catch any words — try again, a little closer to the phone.')
    } catch (e: any) {
      if (alive.current) setErr(`Couldn’t write it down${e?.message ? ` — ${String(e.message).replace(/\.$/, '')}` : ''}. Type it instead.`)
    } finally {
      if (alive.current) { setBusy(false); setHearing('') }
    }
  }

  const stop = () => {
    want.current = false
    clearTimeout(cap.current)
    liveOff()
    try { rec.current?.stop?.() } catch { /* stopped */ }
    rec.current = null
    setOn(false)
    meterOff()
    const m = mr.current
    mr.current = null
    /* the recording is the words when the browser gave none (it recorded instead, or its listening failed) — what was
       written down while talking stays on screen until the careful one comes */
    const need = !!m && m.state !== 'inactive' && (srDown.current || !gotWords.current) && (loud.current || !metered.current)
    if (!need) setHearing('')
    if (m && m.state !== 'inactive') {
      m.onstop = () => {
        streamOff()
        const blob = new Blob(chunks.current, { type: m.mimeType || 'audio/webm' })
        chunks.current = []
        if (need && blob.size > 0) void writeDown(blob)
      }
      try { m.stop() } catch { streamOff() }
    } else streamOff()
  }

  const start = async () => {
    if (on || busy || starting.current) return
    const R = SR()
    if (!R && !recordable()) { setErr('This browser can’t listen — type it instead.'); return }
    /* the meter's sound, started right here in the tap — an iPhone won't start it later */
    const made = soundContext()
    starting.current = true
    setErr('')
    setQuiet(false)
    gotWords.current = false
    srDown.current = false
    loud.current = false
    metered.current = false
    chunks.current = []
    /* 1 · the microphone — asked for once; blocked or missing is said plainly */
    let s: MediaStream | null = null
    if (navigator.mediaDevices?.getUserMedia) {
      try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } as any }) } catch (e) { starting.current = false; try { made?.close?.() } catch { /* closed */ } if (alive.current) setErr(micProblem(e)); return }
    }
    starting.current = false
    if (!alive.current) { s?.getTracks().forEach((t) => t.stop()); try { made?.close?.() } catch { /* closed */ } return }
    stream.current = s
    if (s) meter(s, made)
    else try { made?.close?.() } catch { /* closed */ }
    liveSent.current = 0
    /* 2 · the words as you say them, where the browser can — an iPhone records (when there's the AI to write it down) */
    const live = !!R && (!apple() || !hearer)
    /* 3 · a recording too, when the AI can write it down: the words if the browser's listening gives none */
    if (s && recordable() && hearer) {
      try {
        const MR = (window as any).MediaRecorder
        const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg'].find((t) => MR.isTypeSupported?.(t))
        const m = new MR(s, type ? { mimeType: type } : undefined)
        m.ondataavailable = (e: any) => { if (e.data?.size) chunks.current.push(e.data) }
        m.start(1000)
        mr.current = m
        /* recording is how it hears (an iPhone, or the browser's listening is off): the words show as you go */
        liveTimer.current = setInterval(() => {
          if (!srDown.current || !want.current || !mr.current) return
          try { if (mr.current.state === 'recording') mr.current.requestData() } catch { /* fine */ }
          setTimeout(() => void liveLook(m.mimeType || type || 'audio/webm'), 120)
        }, 1500)
      } catch { mr.current = null }
    }
    if (!live && !mr.current) { liveOff(); meterOff(); streamOff(); setErr('This browser can’t listen here — type it instead.'); return }
    want.current = true
    setOn(true)
    /* three minutes at a time */
    cap.current = setTimeout(() => { if (want.current) stop() }, 3 * 60 * 1000)
    if (!live) { srDown.current = true; return }
    const r = new R()
    r.lang = 'en-US'
    r.interimResults = true
    r.continuous = true
    r.onresult = (e: any) => {
      let now = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = String(e.results[i][0]?.transcript || '')
        if (t.trim()) gotWords.current = true
        if (e.results[i].isFinal) { if (t.trim()) said.current(t.trim()) } else now += t
      }
      if (alive.current) setHearing(now.trim())
    }
    r.onerror = (e: any) => {
      const code = String(e?.error || '')
      if (code === 'no-speech' || code === 'aborted') return
      if (code === 'audio-capture') { setErr('No microphone found — plug one in, or type it.'); stop(); return }
      /* the browser's listening is off or out of reach: keep recording — the AI writes it down when you stop */
      srDown.current = true
      if (!mr.current) { setErr(code === 'network' ? 'The browser can’t reach its listening service — type it instead.' : 'This browser won’t listen here — type it instead.'); stop() }
    }
    /* a browser stops listening after a pause — keep going until you tap stop */
    r.onend = () => {
      if (alive.current) setHearing('')
      if (want.current && !srDown.current) { try { r.start() } catch { srDown.current = true } }
    }
    try { r.start(); rec.current = r } catch { srDown.current = true; if (!mr.current) { setErr('This browser won’t listen here — type it instead.'); stop() } }
  }

  return { on, hearing, level, metering, quiet, busy, err, start: () => void start(), stop, can: canListen() }
}
