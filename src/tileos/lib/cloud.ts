/* The company's data in the database (the real app only — the preview page keeps a test in the browser instead).
 *
 * Each project, task, estimate, client… is its own row in `tileos_records`, so two people working at the same time
 * only clash when they change the very same thing (then the later change wins). A change goes up a moment after it's
 * made; everyone else's changes come down live. Days kept as words ("Today", "Tomorrow", "Wed") are turned into the
 * right day when a record written on an earlier day is opened, exactly like a saved test.
 *
 *   map  (jobs, clients, rooms…)    one row per entry, id = the entry's key
 *   list (tasks, POs, estimates…)   one row per item, id = the item's id — plus an "__order" row with the order
 *   one  (rules, access…)           the whole thing in one "__all" row
 */
import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import { useStore, DATA_KEYS, freshData, initialData, ensureTiles, ID, signInAs, type Data } from '@/tileos/store'
import { REAL, redate, seedCounters, setSaveStatus } from '@/tileos/lib/save'
import { TODAY } from '@/tileos/lib/today'
import type { Member, Role } from '@/tileos/data/model'

/* the generated database types don't know this table yet (Lovable regenerates them after the migration) */
const sb = supabase as any
const TABLE = 'tileos_records'
const ORDER = '__order'
const ALL = '__all'
/** this tab — its own changes coming back live are skipped */
const CLIENT = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)

type Shape = 'map' | 'list' | 'one'
const SHAPE: Partial<Record<keyof Data, Shape>> = {
  jobs: 'map', clients: 'map', tiles: 'map', pricing: 'map', hist: 'map', rooms: 'map', diary: 'map', prep: 'map', notes: 'map', pay: 'map',
  messages: 'map', stepRecs: 'map', jobSteps: 'map',
  tasks: 'list', money: 'list', pos: 'list', mats: 'list', checks: 'list', bookings: 'list', notices: 'list', punch: 'list', ipos: 'list',
  items: 'list', estimates: 'list', designers: 'list', suppliers: 'list', events: 'list', team: 'list', shortages: 'list',
  ready: 'one', lost: 'one', rules: 'one', access: 'one', inactive: 'one',
}
const shapeOf = (k: string): Shape => (SHAPE as any)[k] || 'one'
export function idOf(k: string, el: any): string {
  if (k === 'team') return String(el?.key)
  if (k === 'checks') return `${el?.jobId}|${el?.tag}`
  if (k === 'suppliers') return String(el?.name)
  return el?.id != null ? String(el.id) : JSON.stringify(el).slice(0, 180)
}

export type Row = { collection: string; id: string; data: any; updated_at?: string; client_id?: string | null }
type Change = { up: Row[]; del: { collection: string; id: string }[] }

/* ---------------- what changed between two copies of the data ---------------- */
export function diff(a: Data, b: Data): Change {
  const up: Row[] = []
  const del: { collection: string; id: string }[] = []
  for (const k of DATA_KEYS) {
    const x = (a as any)[k]
    const y = (b as any)[k]
    if (x === y) continue
    const shape = shapeOf(k)
    if (shape === 'one') { up.push({ collection: k, id: ALL, data: y ?? null }); continue }
    if (shape === 'map') {
      const xo = x || {}, yo = y || {}
      for (const id of Object.keys(yo)) if (xo[id] !== yo[id]) up.push({ collection: k, id, data: yo[id] })
      for (const id of Object.keys(xo)) if (!(id in yo)) del.push({ collection: k, id })
      continue
    }
    const xm = new Map<string, any>((x || []).map((e: any) => [idOf(k, e), e]))
    const ym = new Map<string, any>((y || []).map((e: any) => [idOf(k, e), e]))
    for (const [id, e] of ym) if (xm.get(id) !== e) up.push({ collection: k, id, data: e })
    for (const id of xm.keys()) if (!ym.has(id)) del.push({ collection: k, id })
    if ([...xm.keys()].join('\n') !== [...ym.keys()].join('\n')) up.push({ collection: k, id: ORDER, data: [...ym.keys()] })
  }
  return { up, del }
}

/* ---------------- rows → data, and rows laid onto data ---------------- */
const empty = (k: string) => (shapeOf(k) === 'map' ? {} : shapeOf(k) === 'list' ? [] : undefined)
/** the data as the database has it; keys with no rows at all are empty (or, with `base`, the clean start's) */
export function assemble(rows: Row[], base?: Data): Data {
  const by = new Map<string, Row[]>()
  rows.forEach((r) => { const l = by.get(r.collection); if (l) l.push(r); else by.set(r.collection, [r]) })
  const d: any = {}
  for (const k of DATA_KEYS) {
    const rs = by.get(k)
    if (!rs?.length) { d[k] = base ? (base as any)[k] : empty(k); continue }
    const shape = shapeOf(k)
    if (shape === 'one') d[k] = rs.find((r) => r.id === ALL)?.data ?? (base ? (base as any)[k] : undefined)
    else if (shape === 'map') d[k] = Object.fromEntries(rs.map((r) => [r.id, r.data]))
    else {
      const order: string[] = rs.find((r) => r.id === ORDER)?.data || []
      const els = new Map(rs.filter((r) => r.id !== ORDER).map((r) => [r.id, r.data]))
      d[k] = [...order.filter((id) => els.has(id)).map((id) => els.get(id)), ...[...els.keys()].filter((id) => !order.includes(id)).map((id) => els.get(id))]
    }
  }
  return d as Data
}
/** lay changed rows (and deletions) onto a copy of the data — everything not touched keeps its identity */
export function patch(data: Data, rows: Row[], dels: { collection: string; id: string }[]): Data {
  const d: any = { ...data }
  const touched = new Set<string>()
  const own = (k: string) => {
    if (touched.has(k)) return
    touched.add(k)
    const shape = shapeOf(k)
    d[k] = shape === 'map' ? { ...(d[k] || {}) } : shape === 'list' ? [...(d[k] || [])] : d[k]
  }
  for (const r of rows) {
    if (!(DATA_KEYS as string[]).includes(r.collection)) continue
    const k = r.collection
    const shape = shapeOf(k)
    if (shape === 'one') { if (r.id === ALL) d[k] = r.data; continue }
    own(k)
    if (shape === 'map') { d[k][r.id] = r.data; continue }
    const list: any[] = d[k]
    if (r.id === ORDER) {
      const order: string[] = r.data || []
      const els = new Map(list.map((e) => [idOf(k, e), e]))
      d[k] = [...order.filter((id) => els.has(id)).map((id) => els.get(id)), ...list.filter((e) => !order.includes(idOf(k, e)))]
      continue
    }
    const i = list.findIndex((e) => idOf(k, e) === r.id)
    if (i >= 0) list[i] = r.data
    else list.push(r.data)
  }
  for (const x of dels) {
    if (!(DATA_KEYS as string[]).includes(x.collection)) continue
    const k = x.collection
    const shape = shapeOf(k)
    if (shape === 'one') continue
    own(k)
    if (shape === 'map') delete d[k][x.id]
    else d[k] = (d[k] as any[]).filter((e) => idOf(k, e) !== x.id)
  }
  return d as Data
}

/* ---------------- a record written on an earlier day: "Tomorrow" becomes the right day ---------------- */
const dayOf = (ts?: string) => {
  if (!ts) return TODAY
  const t = new Date(ts)
  if (isNaN(t.getTime())) return TODAY
  const p = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`
}
const fresh = (r: Row): Row => {
  const day = dayOf(r.updated_at)
  return day === TODAY || r.id === ORDER ? r : { ...r, data: redate(r.data, day) }
}

/* ---------------- the database calls ---------------- */
export type CloudProblem = 'setup' | 'network' | 'denied'
const kindOf = (e: any): CloudProblem => {
  const msg = `${e?.code || ''} ${e?.message || ''}`.toLowerCase()
  if (/42p01|pgrst205|could not find the table|does not exist|schema cache/.test(msg)) return 'setup'
  if (/42501|permission|rls|not allowed|jwt/.test(msg)) return 'denied'
  return 'network'
}
async function loadAll(): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(TABLE).select('collection,id,data,updated_at').order('collection').order('id').range(from, from + 999)
    if (error) throw error
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}
const recentDeletes = new Set<string>()
async function push(c: Change) {
  for (let i = 0; i < c.up.length; i += 200) {
    const part = c.up.slice(i, i + 200).map((r) => ({ collection: r.collection, id: r.id, data: r.data ?? null, client_id: CLIENT }))
    const { error } = await sb.from(TABLE).upsert(part, { onConflict: 'collection,id' })
    if (error) throw error
  }
  const by = new Map<string, string[]>()
  c.del.forEach((x) => { const l = by.get(x.collection); if (l) l.push(x.id); else by.set(x.collection, [x.id]) })
  for (const [col, ids] of by) {
    ids.forEach((id) => recentDeletes.add(col + '\u0000' + id))
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await sb.from(TABLE).delete().eq('collection', col).in('id', ids.slice(i, i + 200))
      if (error) throw error
    }
  }
}

/* ---------------- keeping the store and the database in step ---------------- */
let synced: Data | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let sending = false
let again = false
let channel: RealtimeChannel | null = null
let unsub: (() => void) | null = null
const pickNow = (): Data => { const s: any = useStore.getState(); const d: any = {}; DATA_KEYS.forEach((k) => (d[k] = s[k])); return d }
function schedule(ms = 400) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; void flush() }, ms)
}
export async function flush() {
  if (!synced) return
  if (sending) { again = true; return }
  const now = pickNow()
  const c = diff(synced, now)
  if (!c.up.length && !c.del.length) return
  sending = true
  setSaveStatus({ saving: true })
  try {
    await push(c)
    /* only what was sent counts as saved — anything changed while it was going up goes next */
    synced = patch(synced, c.up, c.del)
    setSaveStatus({ saving: false, at: Date.now(), problem: undefined })
  } catch (e) {
    const k = kindOf(e)
    setSaveStatus({ saving: false, problem: k === 'denied' ? 'Your login can’t save changes — ask the admin' : 'Not saved yet — trying again' })
    if (k !== 'denied') schedule(5000)
  } finally {
    sending = false
    if (again) { again = false; schedule(50) }
  }
}
/* other people's changes, a few at a time */
let inbox: { up: Row[]; del: { collection: string; id: string }[] } = { up: [], del: [] }
let inboxTimer: ReturnType<typeof setTimeout> | null = null
function receive(p: any) {
  const row: Row | undefined = p.new && Object.keys(p.new).length ? p.new : undefined
  if (p.eventType === 'DELETE') {
    const old = p.old || {}
    const key = old.collection + '\u0000' + old.id
    if (recentDeletes.has(key)) { recentDeletes.delete(key); return }
    if (old.collection && old.id) inbox.del.push({ collection: old.collection, id: old.id })
  } else if (row) {
    if (row.client_id === CLIENT) return
    inbox.up.push(fresh(row))
  }
  if (!inboxTimer) inboxTimer = setTimeout(applyInbox, 120)
}
function applyInbox() {
  inboxTimer = null
  const { up, del } = inbox
  inbox = { up: [], del: [] }
  if (!synced || (!up.length && !del.length)) return
  /* lay it on both copies, so it isn't sent back up; anything we changed meanwhile still goes */
  synced = patch(synced, up, del)
  const next = patch(pickNow(), up, del)
  ensureTiles(next as any)
  useStore.setState(next as any)
}

/* ---------------- starting: load, sign the person in, then keep in step ---------------- */
export type StartResult = { ok: true; member: Member } | { ok: false; why: CloudProblem; detail?: string }
export async function startCloud(user: User, opts: { admin: boolean; name: string; appRoles: string[] }): Promise<StartResult> {
  let rows: Row[]
  try { rows = await loadAll() } catch (e: any) { return { ok: false, why: kindOf(e), detail: e?.message } }
  const base = freshData(initialData())
  /* the database as it is (what's "saved"), and the data to work with (with the clean start filling any gaps) */
  const fixed = rows.map(fresh)
  const db = assemble(fixed, undefined)
  const data = assemble(fixed, base)
  ensureTiles(data as any)
  seedCounters(JSON.stringify(data))
  ID.sfx = '.' + CLIENT.slice(0, 4)
  synced = db
  useStore.getState().replaceData(data)
  REAL.cloud = true
  REAL.admin = opts.admin
  REAL.email = user.email || undefined
  setSaveStatus({ where: 'cloud', mode: 'fresh', saving: false, problem: undefined })
  const member = linkMember(user, opts)
  /* whatever the clean start filled in (the first time: everything) goes up right away */
  schedule(30)
  unsub?.()
  unsub = useStore.subscribe((s, prev) => { if (DATA_KEYS.some((k) => (s as any)[k] !== (prev as any)[k])) schedule() })
  channel?.unsubscribe()
  channel = sb.channel('tileos-records').on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, receive).subscribe()
  window.addEventListener('beforeunload', () => { if (timer) { clearTimeout(timer); void flush() } })
  return { ok: true, member }
}
/* the tests (in development only) can hand in a change as if someone else made it */
if (import.meta.env.DEV && typeof window !== 'undefined') (window as any).__tileosCloud = { receive, flush, applyNow: () => applyInbox(), client: CLIENT }
export function stopCloud() {
  unsub?.(); unsub = null
  channel?.unsubscribe(); channel = null
  synced = null
}

/* ---------------- who's signed in: their place on the team ---------------- */
const ROLE_OF: Record<string, Role> = { admin: 'owner', gm: 'owner', pm: 'pm', sales: 'office', estimator: 'estimator', site_manager: 'site', office_coordinator: 'office', accounting: 'accounting', installer: 'crew', viewer: 'office' }
export const APP_ROLE: Record<Role, string> = { owner: 'admin', pm: 'pm', office: 'office_coordinator', takeoff: 'estimator', estimator: 'estimator', site: 'site_manager', materials: 'office_coordinator', accounting: 'accounting', crew: 'installer', client: 'viewer' }
function linkMember(user: User, opts: { admin: boolean; name: string; appRoles: string[] }): Member {
  const s = useStore.getState()
  const email = (user.email || '').toLowerCase()
  let m = s.team.find((x) => x.uid === user.id) || (email ? s.team.find((x) => (x.email || '').toLowerCase() === email) : undefined)
  /* the first admin to sign in is the owner on the team list */
  if (!m && opts.admin) m = s.team.find((x) => x.role === 'owner' && !x.uid)
  if (!m) {
    const role = ROLE_OF[opts.appRoles[0]] || 'office'
    const [first, ...rest] = (opts.name || email.split('@')[0] || 'New person').split(' ')
    const key = ('u' + user.id.replace(/-/g, '').slice(0, 8)) as any
    m = { key, first, last: rest.join(' ') || undefined, email: user.email || undefined, role, status: 'active', uid: user.id }
    const mm = m
    s.commit((x) => { x.team.push(mm) })
  } else if (m.uid !== user.id || (!m.email && user.email)) {
    const key = m.key
    s.commit((x) => { const t = x.team.find((y) => y.key === key); if (t) { t.uid = user.id; if (!t.email && user.email) t.email = user.email } })
  }
  const me = useStore.getState().team.find((x) => x.key === m!.key)!
  REAL.home = me.role
  signInAs(me.key)
  return me
}

/* ---------------- the admin lets people in ---------------- */
export type Waiting = { uid: string; name: string; email: string; since: string }
/** people who signed up and aren't let in yet */
export async function waitingPeople(): Promise<Waiting[]> {
  const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
    sb.from('profiles').select('user_id,full_name,email,created_at').order('created_at', { ascending: false }),
    sb.from('user_roles').select('user_id'),
  ])
  if (e1 || e2) throw e1 || e2
  const has = new Set((roles || []).map((r: any) => r.user_id))
  return (profiles || []).filter((p: any) => !has.has(p.user_id)).map((p: any) => ({ uid: p.user_id, name: p.full_name || p.email || 'New person', email: p.email || '', since: p.created_at }))
}
/** let someone in as a team member with a role (a new team member, or one already on the list) */
export async function letIn(p: Waiting, role: Role, memberKey?: string) {
  const { error } = await sb.from('user_roles').insert({ user_id: p.uid, role: APP_ROLE[role] })
  if (error && !/duplicate/i.test(error.message || '')) throw error
  const s = useStore.getState()
  s.commit((x) => {
    const t = memberKey ? x.team.find((y) => y.key === memberKey) : undefined
    if (t) { t.uid = p.uid; t.email = t.email || p.email; t.role = role; t.status = 'active' }
    else {
      const [first, ...rest] = (p.name || p.email.split('@')[0]).split(' ')
      x.team.push({ key: ('u' + p.uid.replace(/-/g, '').slice(0, 8)) as any, first, last: rest.join(' ') || undefined, email: p.email || undefined, role, status: 'active', uid: p.uid })
    }
  }, `${p.name} can sign in now`)
}
