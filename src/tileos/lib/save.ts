/* Keeping a test. Everything done in the mockup is saved: in this browser (so it opens instantly) and, when the page
 * runs on claude.ai, in the person's own private space there — the same test on the phone and the computer.
 * Dates saved as "Today", "Tomorrow" or "Wed" are turned back into real days when the test opens on a later day.
 * Tests that pin a day (?today=…) or ask for the sample (?sample) open the sample and don't save, unless the address
 * also says ?save. */
import * as React from 'react'
import { useStore, DATA_KEYS, initialData, freshData, pickData, seedTasks, type Data } from '@/tileos/store'
import { seedLines } from '@/tileos/features/flows2'
import { seedRefs } from '@/tileos/lib/utils'
import { TODAY, addDays, dow, labelFromIso } from '@/tileos/lib/today'
import { showPop } from '@/tileos/lib/pop'
import type { Role } from '@/tileos/data/model'

export type SaveMode = 'sample' | 'fresh'
type Meta = { v: number; day: string; at: number; mode: SaveMode; keys: Record<string, { gen: number; n: number }> }
type Saved = { meta: Meta; json: Record<string, string> }
const V = 1
const CHUNK = 60000
const LS = 'tileos-test-v1'
const OFF = (() => {
  try { const p = new URLSearchParams(location.search); return (p.has('today') || p.has('sample')) && !p.has('save') } catch { return false }
})()

/* ---------------- what the screens show ---------------- */
export type SaveStatus = { where: 'account' | 'browser' | 'cloud' | 'none'; at?: number; mode: SaveMode; saving: boolean; problem?: string }
/** someone who signed up in the real app and is waiting for the admin to let them in */
export type WaitingPerson = { uid: string; name: string; email: string; since: string }
/** set by the real app (not the mockup): it saves to the company's database, who signed in, how to sign out —
 *  and, for the admin, the people waiting to be let in */
export const REAL: {
  cloud: boolean; admin: boolean; home: Role; email?: string; signOut?: () => void
  people?: { waiting: () => Promise<WaitingPerson[]>; letIn: (p: WaitingPerson, role: Role, memberKey?: string) => Promise<void> }
  /** the company's AI on the server: read these pages (pictures) and answer the prompt */
  ai?: (prompt: string, pages: Blob[], signal?: AbortSignal) => Promise<string>
  /** the company's file storage: keep a file with a project, and a link to open it */
  files?: { put: (jobId: string, id: string, file: File) => Promise<string>; url: (path: string) => Promise<string> }
} = { cloud: false, admin: true, home: 'owner' }
let status: SaveStatus = { where: OFF ? 'none' : 'browser', mode: 'sample', saving: false }
const listeners = new Set<() => void>()
const setStatus = (p: Partial<SaveStatus>) => { status = { ...status, ...p }; listeners.forEach((f) => f()) }
export const setSaveStatus = setStatus
/** a "sample" note on amounts — only while the sample is open (a clean start and the real app use real prices) */
export const smp = (t: string) => (status.mode === 'sample' && status.where !== 'cloud' ? t : '')
export function useSaveStatus() {
  return React.useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f) }, () => status)
}

/* ---------------- relative days → real days ---------------- */
const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const REL = /^(Today|Tomorrow|Yesterday|Just now|Now|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Next Mon|This week|In 2 weeks|\d+ days? late)$/
/* fields where a weekday is a repeating day, not a date */
const KEEP_KEYS = new Set(['repeatAt', 'label', 'title', 'name', 'kind', 'text', 'short'])
function isoAt(label: string, ref: string): string | undefined {
  const l = label.toLowerCase()
  if (l === 'today' || l === 'now' || l === 'just now') return ref
  if (l === 'tomorrow') return addDays(ref, 1)
  if (l === 'yesterday') return addDays(ref, -1)
  if (l === 'next mon') { let d = addDays(ref, 1); while (dow(d) !== 1) d = addDays(d, 1); return d }
  if (l === 'in 2 weeks') return addDays(ref, 14)
  if (l === 'this week') { let d = ref; while (dow(d) !== 5) d = addDays(d, 1); return d }
  const late = l.match(/^(\d+) days? late$/)
  if (late) return addDays(ref, -Number(late[1]))
  const wd = WD.indexOf(l)
  if (wd >= 0) { let d = ref; while (dow(d) !== wd) d = addDays(d, 1); return d }
  return undefined
}
export function redate<T>(x: T, ref: string, key = ''): T {
  if (typeof x === 'string') {
    if (KEEP_KEYS.has(key) || !REL.test(x)) return x
    const iso = isoAt(x, ref)
    return (iso ? labelFromIso(iso) : x) as unknown as T
  }
  if (Array.isArray(x)) return x.map((v) => redate(v, ref, key)) as unknown as T
  if (x && typeof x === 'object') {
    const out: Record<string, unknown> = {}
    Object.entries(x as Record<string, unknown>).forEach(([k, v]) => (out[k] = redate(v, ref, k)))
    return out as T
  }
  return x
}

/* ---------------- numbers carry on after the saved ones ---------------- */
export function seedCounters(json: string) {
  const max = (re: RegExp) => { let m = 0; for (const x of json.matchAll(re)) m = Math.max(m, Number(x[1])); return m }
  seedTasks(max(/"id":"n(\d+)"/g))
  seedLines(max(/"id":"el(\d+)"/g))
  seedRefs(max(/"ref":"#(\d+)"/g), max(/PO-(\d+)/g))
}

/* ---------------- where it's kept ---------------- */
interface Backend {
  where: 'account' | 'browser'
  read(): Promise<Saved | null>
  write(changed: Record<string, string>, meta: Meta): Promise<Meta>
}
function readBrowser(): Saved | null {
  try {
    const raw = localStorage.getItem(LS)
    if (!raw) return null
    const o = JSON.parse(raw)
    return o?.meta?.v === V && o.json ? (o as Saved) : null
  } catch { return null }
}
const browser: Backend = {
  where: 'browser',
  async read() { return readBrowser() },
  async write(changed, meta) {
    try {
      const cur = readBrowser() || { meta, json: {} }
      Object.assign(cur.json, changed)
      cur.meta = meta
      localStorage.setItem(LS, JSON.stringify(cur))
    } catch { /* private window or full — the account copy still has it */ }
    return meta
  },
}
function account(db: any, uid: string): Backend {
  const col = db.collection('data/users/' + uid)
  const metaRef = col.doc('tileos')
  const part = (k: string, gen: number, i: number) => col.doc(`tileos~${k}~${gen}~${i}`)
  return {
    where: 'account',
    async read() {
      const m = await metaRef.get()
      if (!m.exists) return null
      const meta = m.data() as Meta
      if (meta?.v !== V || !meta.keys) return null
      const json: Record<string, string> = {}
      for (const [k, { gen, n }] of Object.entries(meta.keys)) {
        const parts = await Promise.all(Array.from({ length: n }, (_, i) => part(k, gen, i).get()))
        if (parts.some((p: any) => !p.exists)) return null
        json[k] = parts.map((p: any) => (p.data() as { s: string }).s).join('')
      }
      return { meta, json }
    },
    async write(changed, meta) {
      const next: Meta = { ...meta, keys: { ...meta.keys } }
      const old: [string, number, number][] = []
      for (const [k, str] of Object.entries(changed)) {
        const gen = (meta.keys[k]?.gen || 0) + 1
        const n = Math.max(1, Math.ceil(str.length / CHUNK))
        for (let i = 0; i < n; i++) await part(k, gen, i).set({ s: str.slice(i * CHUNK, (i + 1) * CHUNK) })
        if (meta.keys[k]) for (let i = 0; i < meta.keys[k].n; i++) old.push([k, meta.keys[k].gen, i])
        next.keys[k] = { gen, n }
      }
      await metaRef.set(next as unknown as Record<string, unknown>)
      for (const [k, g, i] of old) { try { await part(k, g, i).delete() } catch { /* cleaned up next time */ } }
      return next
    },
  }
}

/* ---------------- turning saved text back into data ---------------- */
function build(saved: Saved): Data {
  const base = saved.meta.mode === 'fresh' ? freshData(initialData()) : initialData()
  const out: any = pickData(base)
  let all = ''
  DATA_KEYS.forEach((k) => {
    const str = saved.json[k]
    if (str == null) return
    try { out[k] = JSON.parse(str); all += str } catch { /* keep the default for a broken part */ }
  })
  seedCounters(all)
  return saved.meta.day && saved.meta.day !== TODAY ? redate(out as Data, saved.meta.day) : (out as Data)
}

/* ---------------- the saving loop ---------------- */
let meta: Meta = { v: V, day: TODAY, at: 0, mode: 'sample', keys: {} }
let last: Record<string, string> = {}
const dirty = new Set<string>()
let timer: number | undefined
let running = false
let backends: Backend[] = []
let quiet = false

function markAll() { DATA_KEYS.forEach((k) => dirty.add(k)) }
function schedule(ms = 900) {
  if (OFF) return
  window.clearTimeout(timer)
  timer = window.setTimeout(flush, ms)
}
async function flush() {
  if (running) { schedule(600); return }
  const st = useStore.getState() as any
  const changed: Record<string, string> = {}
  dirty.forEach((k) => {
    const str = JSON.stringify(st[k] ?? null)
    if (str !== last[k]) changed[k] = str
  })
  dirty.clear()
  if (!Object.keys(changed).length) return
  running = true
  setStatus({ saving: true })
  const nextMeta: Meta = { ...meta, day: TODAY, at: Date.now() }
  try {
    for (const b of backends) {
      const m = await b.write(changed, { ...nextMeta, keys: b.where === 'account' ? meta.keys : nextMeta.keys })
      if (b.where === 'account') nextMeta.keys = m.keys
    }
    meta = nextMeta
    Object.assign(last, changed)
    setStatus({ saving: false, at: meta.at, problem: undefined })
  } catch (e: any) {
    if (e?.code === 'invalid_argument' || e?.code === 'revoked' || e?.code === 'not_granted') {
      /* this viewer can't keep data on the account — this browser keeps it */
      backends = backends.filter((b) => b.where !== 'account')
      Object.assign(last, changed)
      setStatus({ saving: false, where: 'browser', at: Date.now(), problem: undefined })
    } else {
      Object.keys(changed).forEach((k) => dirty.add(k))
      setStatus({ saving: false, problem: e?.code === 'quota_exceeded' ? 'Your saved test is full — start fresh to make room' : 'Couldn’t save just now — trying again' })
      if (e?.code !== 'quota_exceeded') schedule(4000)
    }
  } finally {
    running = false
  }
}

/** before the first screen: open the test saved in this browser, if there is one */
export function openSavedNow() {
  if (OFF) return
  const saved = readBrowser()
  if (!saved) {
    /* the first time: a clean slate with the company's own items — the sample is one tap away (Settings → Test data) */
    quiet = true
    useStore.getState().replaceData(freshData(pickData(useStore.getState())))
    quiet = false
    meta = { ...meta, mode: 'fresh' }
    setStatus({ mode: 'fresh' })
    return
  }
  quiet = true
  useStore.getState().replaceData(build(saved))
  quiet = false
  meta = { ...saved.meta, keys: {} }
  setStatus({ mode: saved.meta.mode, at: saved.meta.at })
  /* the browser copy is now what's on screen */
  const st = useStore.getState() as any
  DATA_KEYS.forEach((k) => (last[k] = saved.meta.day === TODAY && saved.json[k] != null ? saved.json[k] : JSON.stringify(st[k] ?? null)))
  if (saved.meta.day !== TODAY) markAll()
}

/** after the first screen: keep saving, and pick up the account copy when the page runs on claude.ai */
export async function startSaving() {
  if (OFF) return
  backends = [browser]
  useStore.subscribe((st: any, prev: any) => {
    if (quiet) return
    let any = false
    DATA_KEYS.forEach((k) => { if (st[k] !== prev[k]) { dirty.add(k); any = true } })
    if (any) schedule()
  })
  if (dirty.size) schedule(300)
  const c = (window as any).claude
  if (!c?.use) return
  try {
    const [db, user] = await Promise.all([c.use('db'), c.use('user')])
    const uid = db && user ? await user.id() : null
    if (!db || !uid) return
    const acc = account(db, uid)
    const saved = await acc.read().catch(() => null)
    backends = [browser, acc]
    setStatus({ where: 'account' })
    if (saved && saved.meta.at > (meta.at || 0)) {
      /* the account copy is newer — it was changed on another device */
      quiet = true
      useStore.getState().replaceData(build(saved))
      quiet = false
      meta = saved.meta
      const st = useStore.getState() as any
      last = {}
      DATA_KEYS.forEach((k) => (last[k] = saved.meta.day === TODAY && saved.json[k] != null ? saved.json[k] : JSON.stringify(st[k] ?? null)))
      if (saved.meta.day !== TODAY) markAll()
      DATA_KEYS.forEach((k) => { if (saved.json[k] == null) dirty.add(k) })
      setStatus({ mode: saved.meta.mode, at: saved.meta.at })
      const hadLocal = !!readBrowser()
      await browser.write(saved.json, saved.meta)
      showPop({ title: hadLocal ? 'Picked up your latest changes' : 'Your saved test is open', sub: 'It’s saved to your account, so it’s the same on your phone and your computer.' })
      if (dirty.size) schedule(300)
    } else if (saved) {
      meta = { ...meta, keys: saved.meta.keys }
      if (meta.at) { markAll(); last = {}; schedule(300) }
    } else if (meta.at) {
      /* first time on the account: copy the test up */
      last = {}
      markAll()
      schedule(300)
    }
  } catch { /* stays saved in this browser */ }
}

/* ---------------- the buttons ---------------- */
function restart(d: Data, mode: SaveMode) {
  const keepRole = useStore.getState().role
  useStore.getState().replaceData(d)
  useStore.getState().setRole(keepRole)
  meta = { ...meta, mode }
  setStatus({ mode })
  seedCounters(JSON.stringify(d))
  markAll()
  schedule(200)
}
/** no projects, estimates, tasks or clients — the team, logins, items and settings stay (the preview only: the real
 *  app's data is the company's, and the sample never goes near it) */
export function startFresh() {
  if (status.where === 'cloud') return
  restart(freshData(pickData(useStore.getState())), 'fresh')
  showPop({ title: 'Clean slate', sub: 'No projects, estimates, tasks or clients. Your team, items and settings stayed. Start with + New → Estimate.' })
}
export function bringBackSample() {
  if (status.where === 'cloud') return
  restart(initialData(), 'sample')
  showPop({ title: 'The sample is back', sub: 'Every sample project, estimate and task, as they were.' })
}
