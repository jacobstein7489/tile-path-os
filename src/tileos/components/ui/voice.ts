/* Talking to Tile OS — one way to listen, everywhere there's a mic.
 *
 * The microphone first: it's asked for once, and when it's blocked or missing, that's said plainly with what to do.
 * Then the words, as you say them — the browser's own listening (Chrome, Edge, Safari on a computer). Where the
 * browser can't (an iPhone's home-screen app, a browser whose listening service is off or out of reach), it records
 * instead, and the company's AI writes it down when you stop. While it listens the level of your voice moves, so you
 * can see it hears you — and when it hears nothing for a few seconds, it says so. */
import * as React from 'react'

/** the company's AI writing down a recording (16 kHz WAV, base64) — set by the real app (lib/cloud); a hint is the
 *  names and words likely to come up */
export type Hearer = (wavBase64: string, hint: string, signal?: AbortSignal) => Promise<string>
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
    meterOff()
    streamOff()
  }, [])

  /* the level of the voice — from the mic itself, so it moves only when it hears something */
  const meter = (s: MediaStream) => {
    try {
      const W = window as any
      const AC = W.AudioContext || W.webkitAudioContext
      if (!AC) return
      const ac = new AC()
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

  /* write the recording down: when the browser couldn't give the words */
  const writeDown = async (blob: Blob) => {
    if (!hearer) { setErr('This browser can’t listen here — type it instead.'); return }
    setBusy(true)
    try {
      const wav = await toWav16k(blob)
      const text = (await hearer(wav, hintRef.current)).trim()
      if (!alive.current) return
      if (text) said.current(text)
      else setErr('I didn’t catch any words — try again, a little closer to the phone.')
    } catch (e: any) {
      if (alive.current) setErr(`Couldn’t write it down${e?.message ? ` — ${String(e.message).replace(/\.$/, '')}` : ''}. Type it instead.`)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const stop = () => {
    want.current = false
    clearTimeout(cap.current)
    try { rec.current?.stop?.() } catch { /* stopped */ }
    rec.current = null
    setOn(false)
    setHearing('')
    meterOff()
    const m = mr.current
    mr.current = null
    if (m && m.state !== 'inactive') {
      /* the recording is the words when the browser gave none (it recorded instead, or its listening failed) */
      const need = (srDown.current || !gotWords.current) && (loud.current || !metered.current)
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
      try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } as any }) } catch (e) { starting.current = false; if (alive.current) setErr(micProblem(e)); return }
    }
    starting.current = false
    if (!alive.current) { s?.getTracks().forEach((t) => t.stop()); return }
    stream.current = s
    if (s) meter(s)
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
      } catch { mr.current = null }
    }
    if (!live && !mr.current) { meterOff(); streamOff(); setErr('This browser can’t listen here — type it instead.'); return }
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
