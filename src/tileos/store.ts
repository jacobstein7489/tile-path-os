import { create } from 'zustand'
import { SHORTAGES0, type Shortage } from '@/tileos/data/shortages'
import { MESSAGES0, SEEN0, type Msg } from '@/tileos/data/messages'
import { EVENTS0, type CalEvent } from '@/tileos/data/calendar'
import { MAT_RULES0, type MatRules } from '@/tileos/data/takeoff'
import { immer } from 'zustand/middleware/immer'
import { showPop, type FlowStep } from '@/tileos/lib/pop'
import type { Job, Role, Stage, PersonKey, Customer } from '@/tileos/data/model'
import { roleDef, PEOPLE, fmtMoney, TEAM0, ROLES, ACCESS, applyTeam, moveLogins, type Member } from '@/tileos/data/model'
import { JOBS0, PRICING0, ROOMS, LOST0, CUSTOMERS, CUSTOMERS0, TILES, JOB_TILES, GROUTS, historyFor, roomPct, jobPct, hasSF, type Pricing, type Room, type HistEntry, type Tile, type Grout, type FileRec } from '@/tileos/data/jobs'
import { DIARY0, IPOS0, type DiaryEntry, type IPO } from '@/tileos/data/field'
import { PREP0, NOTES0, type Prep, type Note } from '@/tileos/data/upcoming'
import { ITEMS0, type Item } from '@/tileos/data/items'
import { QB_ITEMS, QB_SURFACE_ITEMS } from '@/tileos/data/qbitems'
import { PRICING_ESTIMATES, approvedEstimates, type Estimate } from '@/tileos/data/estimates'
import { DESIGNERS0, SUPPLIERS0, type Designer, type SupplierInfo } from '@/tileos/data/directory'
import {
  TASKS0, MONEY0, POS0, OURMATS, TILECHECKS, BOOKINGS0, READY0, NOTICES0, PUNCH0, BILLING,
  type PunchItem, type Task, type MoneyItem, type PO, type OurMat, type TileCheck, type Booking, type ReadyItem, type Notice, type LogLine,
} from '@/tileos/data/work'
import { nextRef, nextPO } from '@/tileos/lib/utils'
import { NOW as NOW_T, TODAY as TODAY_T, shiftDeep, shiftText, isoFromLabel, md } from '@/tileos/lib/today'
import { sampleHistory } from '@/tileos/data/history'
import type { StepDef, StepRec } from '@/tileos/features/steps'
import type { EstTeam } from '@/tileos/data/estimates'
import type { AreaPreset, SurfaceDef } from '@/tileos/data/areas'

export type Page = 'today' | 'inbox' | 'upcoming' | 'tasks' | 'projects' | 'clients' | 'schedule' | 'money' | 'flow' | 'settings' | 'job' | 'crew' | 'estimates' | 'pos' | 'items' | 'designers' | 'subs' | 'suppliers' | 'directory' | 'pay' | 'team'
export interface Route { page: Page; id?: string; tab?: string; q?: Record<string, string> }
export type Modal = { t: string; [k: string]: any }

export interface Rules {
  depositRule: 'warn' | 'block'
  depositPct: number
  retainage: number
  reminderDays: number
  /** the admin checks in when something is this many work days late (2 unless he changes it) */
  checkInDays?: number
  /** on time this share of the time (%) — below it, the team report says so (85 unless he changes it) */
  onTimeGoal?: number
  waste: { floors: number; walls: number; mosaic: number; large: number }
  billingDay: number
  /** how the deposit comes off the progress bills: counted as billed first, a share of each bill, or at the end */
  depositOff?: 'first' | 'share' | 'final'
  /** coverage numbers for the material takeoff */
  mat: MatRules
  /** who orders our materials and handles deliveries — the site manager, unless the admin changes it */
  matBy?: PersonKey
  /** the company's getting-ready checklist (Settings → Checklist); empty = the standard one */
  steps?: StepDef[]
  /** which version of the checklist the saved list was made with (2 = the paperwork split into getting and entering it) */
  stepsV?: number
  /** when the admin set who does what (the window that asks once) */
  whoSet?: string
  /** which version of who-does-what he saved (3 = the steps that had nobody got someone) */
  whoV?: number
  /** automations the admin turned off (Settings → Automations) */
  autoOff?: string[]
  /** who does each estimate step by default — new estimates start with these people */
  estTeam?: EstTeam
  /** the areas a new estimate offers (empty = the standard list) and surfaces the company added */
  areas?: AreaPreset[]
  surfaces?: SurfaceDef[]
  /** which item each surface brings onto an estimate, when it isn't the standard one — set by the QuickBooks import */
  surfaceItems?: Record<string, string>
  /** grout colors the company added to the standard list */
  grouts?: Record<string, Grout>
  /** what we pay the installer should stay under this share of the estimate — the line on the PO meter (50 = half) */
  laborPct?: number
}

export interface Data {
  jobs: Record<string, Job>
  /** the clients — GCs, developers, owners */
  clients: Record<string, Customer>
  /** each project's tiles, by the tag on the finish schedule: picture, size, grout, who orders it */
  tiles: Record<string, Record<string, Tile>>
  tasks: Task[]
  money: MoneyItem[]
  pos: PO[]
  mats: OurMat[]
  checks: TileCheck[]
  bookings: Booking[]
  ready: ReadyItem[]
  pricing: Record<string, Pricing>
  hist: Record<string, HistEntry[]>
  rooms: Record<string, Room[]>
  notices: Notice[]
  lost: { name: string; client: string; reason: string; date: string }[]
  punch: PunchItem[]
  diary: Record<string, DiaryEntry[]>
  ipos: IPO[]
  prep: Record<string, Prep>
  notes: Record<string, Note[]>
  items: Item[]
  estimates: Estimate[]
  designers: Designer[]
  /** who we buy from */
  suppliers: SupplierInfo[]
  rules: Rules
  /** meetings and walkthroughs, with a day and a time */
  events: CalEvent[]
  /** who signs in, and what each login sees */
  team: Member[]
  access: Record<Role, string[]>
  shortages: Shortage[]
  messages: Record<string, Msg[]>
  /** installer pay by week: approved, or questioned */
  pay: Record<string, { status: 'approved' | 'paid' | 'asked'; amount: number; date: string; note?: string }>
  /** files kept with the projects — the tile paperwork, plans, photos */
  files: FileRec[]
  /** each project's checklist: what was checked off by hand, owners changed, dates set */
  stepRecs: Record<string, Record<string, StepRec>>
  /** steps added to just one project */
  jobSteps: Record<string, StepDef[]>
  /** clients, designers, installers and suppliers marked inactive — 'client:parkplace', 'crew:caesar' */
  inactive: string[]
  /** the inbox, per person: "<conversation>|<person>" → how many messages they've seen, whether they put it away
   *  (at which count — a new message brings it back) or marked it unread */
  seen: Record<string, { n: number; away?: number; unread?: boolean }>
}

interface UI {
  role: Role
  route: Route
  modals: Modal[]
  past: Data[]
  paletteOpen: boolean
}

interface Actions {
  setRole: (r: Role) => void
  go: (r: Route) => void
  open: (m: Modal) => void
  close: () => void
  closeAll: () => void
  swap: (m: Modal) => void
  setPalette: (v: boolean) => void
  undo: () => void
  /** swap in a whole set of data — a saved test, a fresh start or the sample — without an undo step */
  replaceData: (d: Data) => void
  commit: (fn: (s: Store) => void, msg?: string, opts?: { undo?: boolean; sub?: string; flow?: FlowStep[]; to?: { who: PersonKey; what: string }[]; close?: boolean; tone?: 'ok' | 'warn' | 'done' | 'wait' }) => void
  log: (jobId: string, e: Omit<HistEntry, 'date'> & { date?: string }) => void
  /* tasks */
  completeTask: (id: string, result?: string) => void
  waitTask: (id: string, on: string, back: string) => void
  laterTask: (id: string, until: string) => void
  reopenTask: (id: string) => void
  reassignTask: (id: string, owner: PersonKey) => void
  setTaskDue: (id: string, due: string) => void
  noteTask: (id: string, text: string, as?: PersonKey) => void
  addTask: (t: Partial<Task> & { jobId: string; title: string }) => void
}

export type Store = Data & UI & Actions

const ME: Record<Role, PersonKey> = {
  owner: 'ys', pm: 'ys', site: 'yakov', office: 'office', takeoff: 'takeoff', estimator: 'estimator', materials: 'materials', accounting: 'accounting', crew: 'philip', client: 'gcpp',
}
export const meOf = (r: Role) => ME[r]

export function homeOf(r: Role): Route {
  if (r === 'accounting') return { page: 'money' }
  if (r === 'crew') return { page: 'crew' }
  return { page: 'today' }
}

function parseHash(): Route {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#\/?/, '')
  const [page, id, tab] = h.split('/')
  const pages: Page[] = ['today', 'upcoming', 'tasks', 'projects', 'clients', 'schedule', 'money', 'flow', 'settings', 'job', 'crew', 'estimates', 'pos', 'items', 'designers', 'subs', 'suppliers', 'directory', 'pay', 'team']
  if (pages.includes(page as Page)) return { page: page as Page, id, tab }
  return { page: 'today' }
}
export function routeToHash(r: Route) {
  return '#/' + [r.page, r.id, r.tab].filter(Boolean).join('/')
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

export function initialData(): Data {
  const jobs = clone(JOBS0)
  const rooms = clone(ROOMS)
  /* progress is computed from the surfaces wherever the plan has square feet */
  Object.entries(rooms).forEach(([id, rs]) => {
    if (!hasSF(rs)) return
    rs.forEach((r) => (r.pct = roomPct(r)))
    if (jobs[id]) jobs[id].pct = jobPct(rs)
  })
  /* the site manager's own work belongs to him */
  const tasks = clone(TASKS0).map((t) => (t.owner === 'ys' && t.for.length === 1 && t.for[0] === 'site' ? { ...t, owner: 'yakov' as const } : t))
  /* Mark Drive's wall tile isn't picked yet, so its tile selection is still open */
  rooms.mdrive?.forEach((r) => r.surfaces.forEach((x) => { if (x.reason === 'Wall tile not confirmed') x.tile = '' }))
  const contracts: Record<string, number> = {}
  Object.entries(BILLING).forEach(([id, b]) => (contracts[id] = b.contract))
  /* what QuickBooks shows billed and paid before Tile OS — the part the sample's bills here don't cover */
  Object.entries(BILLING).forEach(([id, b]) => {
    const j = jobs[id]
    if (!j) return
    const total = b.contract + b.changes
    const sent = MONEY0.filter((m) => m.jobId === id && ['deposit', 'progress', 'final'].includes(m.kind) && (m.state === 'waiting' || m.state === 'paid') && m.amount)
    const billed = sent.reduce((n, m) => n + (m.amount || 0), 0)
    const paid = sent.reduce((n, m) => n + (m.state === 'paid' ? m.amount || 0 : m.paid || 0), 0)
    const changes = MONEY0.filter((m) => m.jobId === id && m.kind === 'change' && m.step >= 0 && m.amount).reduce((n, m) => n + (m.amount || 0), 0)
    const r = (n: number) => (n < total * 0.015 ? 0 : Math.round(n / 10) * 10)
    j.before = { billed: r((total * b.billedPct) / 100 - billed), paid: r((total * b.paidPct) / 100 - paid), retainage: b.retainage, changes: Math.max(0, b.changes - changes) }
  })
  const d = shiftDeep({
    jobs,
    clients: clone(CUSTOMERS0),
    tiles: {},
    tasks,
    money: clone(MONEY0),
    pos: clone(POS0),
    mats: clone(OURMATS),
    checks: clone(TILECHECKS),
    bookings: clone(BOOKINGS0),
    ready: clone(READY0),
    pricing: clone(PRICING0),
    hist: {
      /* Green Tree, this week */
      green: [
        { date: 'Oct 1', who: 'office', kind: 'material', title: 'Best Tile: the missing T-04 comes Thursday', detail: '6 boxes' },
        { date: 'Sep 30', who: 'yakov', kind: 'material', title: 'Tile delivered — with problems', detail: 'T-05 3 boxes broken · T-07 4 boxes wrong (honed, not polished) · T-04 6 boxes missing' },
        { date: 'Sep 30', who: 'yakov', kind: 'question', title: 'Site check — the water isn’t on yet', detail: 'The GC says Friday. Heights, electrical and plumbing are fine.' },
        { date: 'Sep 30', who: 'yakov', kind: 'material', title: 'Setting materials ordered from Infinity', detail: 'Thinset, grout, membrane — delivery Monday' },
        { date: 'Sep 29', who: 'ys', kind: 'decision', title: 'Design walkthrough with the designer', detail: 'Grout warm gray · feature wall centered on the doors · niches move 6″ left' },
      ],
    },
    rooms,
    notices: clone(NOTICES0),
    lost: clone(LOST0),
    punch: clone(PUNCH0),
    diary: clone(DIARY0),
    ipos: clone(IPOS0),
    prep: clone(PREP0),
    notes: clone(NOTES0),
    items: clone(ITEMS0),
    estimates: [...clone(PRICING_ESTIMATES), ...approvedEstimates(contracts, rooms)],
    designers: clone(DESIGNERS0),
    suppliers: clone(SUPPLIERS0),
    rules: { depositRule: 'warn', depositPct: 20, retainage: 10, reminderDays: 3, waste: { floors: 10, walls: 12, mosaic: 15, large: 10 }, billingDay: 25, mat: { ...MAT_RULES0 }, matBy: 'yakov' },
    events: clone(EVENTS0),
    pay: { 'philip:2026-09-14': { status: 'paid', amount: 3027, date: 'Sep 21' } },
    team: clone(TEAM0),
    shortages: clone(SHORTAGES0),
    messages: clone(MESSAGES0),
    access: Object.fromEntries(ROLES.map((r) => [r.key, [...r.nav]])) as Record<Role, string[]>,
    /* the rough-ins were looked at during the site visits of the projects that are already ready */
    stepRecs: {
      ...Object.fromEntries(['530', 'mdrive', 'wilk', 'green'].map((id) => [id, { rough: { done: 'Sep 24', by: 'yakov' } }])),
      /* Green Tree: the site check found the water isn't on yet */
      green: { rough: { done: 'Sep 24', by: 'yakov' }, design: { done: 'Sep 29', by: 'ys', note: 'Walked it with the designer Sep 29' }, heights: { checks: { heights: { ok: true }, electric: { ok: true }, plumbing: { ok: true }, water: { ok: false, note: 'The GC says Friday' }, ready: { ok: true } } } },
    } as Record<string, Record<string, StepRec>>,
    jobSteps: {},
    files: [],
    inactive: [],
    seen: clone(SEEN0),
  } as Data)
  ensureTiles(d)
  /* the last four weeks of finished work — so the team report has something to show (sample only) */
  d.tasks.push(...sampleHistory(TODAY_T))
  /* 115 Park's tile paperwork is in: the store is sending enough of every tile (with the extra for cuts) */
  Object.values(d.tiles['115'] || {}).forEach((t) => {
    const on = (d.rooms['115'] || []).flatMap((r) => r.surfaces).filter((x) => x.tile === t.tag)
    const need = on.reduce((n, x) => n + (x.sf || 0) * (/floor/i.test(x.name) ? 1.1 : 1.12), 0)
    t.paper = { qty: Math.ceil(need / 10) * 10 + 10, unit: 'SF' }
  })
  return d
}
/** every tile tag a project uses has its tile record — the sample's tiles fill in any that are missing
 *  (a real project's tiles are added on its Scope tab, so nothing is filled in for them) */
export function ensureTiles(d: Pick<Data, 'tiles' | 'rooms' | 'checks' | 'shortages' | 'estimates'>) {
  if (!d.tiles) (d as any).tiles = {}
  const need = (jobId?: string, tag?: string) => {
    if (!jobId || !tag || !TILES[tag] || d.tiles[jobId]?.[tag]) return
    if (!d.tiles[jobId]) d.tiles[jobId] = {}
    const on = (d.rooms[jobId] || []).flatMap((r) => r.surfaces).find((x) => x.tile === tag && x.grout)
    d.tiles[jobId][tag] = { ...TILES[tag], ...(on ? { grout: on.grout, joint: on.joint } : {}) }
  }
  Object.entries(d.rooms || {}).forEach(([j, rs]) => rs.forEach((r) => r.surfaces.forEach((x) => need(j, x.tile))))
  ;(d.checks || []).forEach((c) => need(c.jobId, c.tag))
  ;(d.shortages || []).forEach((x) => need(x.jobId, x.tag))
  ;(d.estimates || []).forEach((e) => e.revs.forEach((r) => r.lines.forEach((l) => need(e.jobId, l.tile))))
}
const MD_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/
/** "Tomorrow", "Thu", "Next Mon" → "Oct 15": once it's saved, a date stays that date (tomorrow becomes today, then late) */
export function pinDate(label?: string) {
  if (!label || MD_RE.test(label) || /this week/i.test(label)) return label
  const iso = isoFromLabel(label)
  return iso ? md(iso) : label
}
function pinDates(s: Data) {
  s.tasks.forEach((t) => {
    if (t.state === 'done') {
      /* the day it was done, kept as a date (Just now / 9:12 AM don't say which day) — the last dated line on it, or today */
      if (!t.doneOn) {
        const d = MD_RE.test(t.doneAt || '') ? isoFromLabel(t.doneAt) : [...(t.log || [])].reverse().map((l) => (MD_RE.test(l.date) ? isoFromLabel(l.date) : undefined)).find(Boolean)
        t.doneOn = d || TODAY_T
      }
      return
    }
    const a = pinDate(t.due); if (a !== t.due) t.due = a
    const b = pinDate(t.followUp); if (b !== t.followUp) t.followUp = b
    const c = pinDate(t.laterUntil); if (c !== t.laterUntil) t.laterUntil = c
  })
  Object.values(s.jobs).forEach((j) => { if (j.next?.due) { const d = pinDate(j.next.due); if (d !== j.next.due) j.next.due = d } })
}
export const DATA_KEYS: (keyof Data)[] = ['jobs', 'clients', 'tiles', 'tasks', 'money', 'pos', 'mats', 'checks', 'bookings', 'ready', 'pricing', 'hist', 'rooms', 'notices', 'lost', 'punch', 'diary', 'ipos', 'prep', 'notes', 'items', 'estimates', 'designers', 'suppliers', 'rules', 'events', 'pay', 'team', 'access', 'shortages', 'messages', 'files', 'stepRecs', 'jobSteps', 'inactive', 'seen']
/** a clean start for testing: no projects, estimates, tasks or clients — the team, logins, items and settings stay */
export function freshData(keep: Data): Data {
  const d = initialData()
  const out: any = {}
  DATA_KEYS.forEach((k) => (out[k] = Array.isArray((d as any)[k]) ? [] : typeof (d as any)[k] === 'object' && (d as any)[k] !== null ? {} : (d as any)[k]))
  out.lost = []
  /* the company's own QuickBooks items, and the setting materials the takeoff orders from */
  const hasQB = keep.items.some((i) => i.id.startsWith('qb-'))
  out.items = hasQB ? clone(keep.items) : [...clone(QB_ITEMS), ...clone(ITEMS0.filter((i) => i.type === 'material'))]
  out.rules = clone(keep.rules)
  if (!hasQB) out.rules.surfaceItems = { ...QB_SURFACE_ITEMS }
  out.team = clone(keep.team)
  out.suppliers = clone(keep.suppliers?.length ? keep.suppliers : SUPPLIERS0)
  out.access = clone(keep.access)
  out.inactive = []
  out.pay = {}
  return out as Data
}
export const pickData = (s: Data): Data => {
  const d: any = {}
  DATA_KEYS.forEach((k) => (d[k] = (s as any)[k]))
  return d
}
const pick = (s: Store): Data => {
  const d: any = {}
  DATA_KEYS.forEach((k) => (d[k] = (s as any)[k]))
  return d
}

export const NOW = NOW_T
let tid = 100
/** in the real app every device adds its own short tag to new ids, so two people never make the same one */
export const ID = { sfx: '' }
/** new task numbers carry on after the ones already saved */
export const seedTasks = (n: number) => { if (n >= tid) tid = n + 1 }

/** the real app (sign-in, the company's database) never holds the sample, not even for a moment: everything in it
 *  comes from the database. Its first page sets this flag before any of the app's code loads. */
export const REAL_APP = typeof globalThis !== 'undefined' && !!(globalThis as any).__TILEOS_REAL__
/** what the app holds before anything is opened: the sample in the preview, a clean start in the real app */
const startData = (): Data => (REAL_APP ? freshData(initialData()) : initialData())

export const useStore = create<Store>()(
  immer((set, get) => ({
    ...startData(),
    role: 'owner',
    route: parseHash(),
    modals: [],
    past: [],
    paletteOpen: false,

    setRole: (r) => {
      set((s) => {
        s.role = r
        s.modals = []
        s.route = homeOf(r)
      })
      location.hash = routeToHash(homeOf(r))
      window.scrollTo(0, 0)
    },
    go: (r) => {
      set((s) => {
        s.route = r
        s.modals = []
      })
      const h = routeToHash(r)
      if (location.hash !== h) history.pushState(null, '', h)
      window.scrollTo(0, 0)
    },
    open: (m) =>
      set((s) => {
        s.modals.push(m)
      }),
    close: () =>
      set((s) => {
        s.modals.pop()
      }),
    closeAll: () =>
      set((s) => {
        s.modals = []
      }),
    swap: (m) =>
      set((s) => {
        s.modals.pop()
        s.modals.push(m)
      }),
    setPalette: (v) =>
      set((s) => {
        s.paletteOpen = v
      }),
    undo: () => {
      const prev = get().past[get().past.length - 1]
      if (!prev) return
      set((s) => {
        s.past.pop()
        DATA_KEYS.forEach((k) => ((s as any)[k] = (prev as any)[k]))
      })
      showPop({ title: 'Undone — back to how it was' })
    },
    replaceData: (d) => {
      set((s) => {
        let base: Data | undefined
        DATA_KEYS.forEach((k) => ((s as any)[k] = (d as any)[k] ?? (k === 'tiles' ? {} : ((base ||= startData()) as any)[k])))
        ensureTiles(s)
        moveLogins(s.team)
        s.tasks = s.tasks.filter((x) => !(x.state === 'later' && x.laterUntil === 'When setup is ready' && /^Review the .+ setup$/.test(x.title)))
        s.past = []
        s.modals = []
      })
    },
    commit: (fn, msg, opts = {}) => {
      const snap = pick(get())
      set((s) => {
        fn(s as Store)
        ensureTiles(s)
        pinDates(s)
        s.past = [...s.past.slice(-24), snap] as any
      })
      /* hand-offs close their window; the pop-up in the middle says where it went. The project's own window stays:
         a step answered right on the project is done there, and the project is still what you're looking at */
      if (opts.close) { const m = get().modals; if (m.length && m[m.length - 1].t !== 'job') set({ modals: m.slice(0, -1) } as any) }
      if (msg) showPop({ title: msg, sub: opts.sub, flow: opts.flow, to: opts.to, tone: opts.tone, undo: opts.undo === false ? undefined : () => get().undo() })
    },
    log: (jobId, e) =>
      set((s) => {
        if (!s.hist[jobId]) s.hist[jobId] = []
        s.hist[jobId].unshift({ date: e.date || NOW, ...e } as HistEntry)
      }),

    completeTask: (id, result) =>
      get().commit((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return
        t.state = 'done'
        t.doneAt = 'Just now'
        t.doneOn = TODAY_T
        if (result) t.result = result
        ;(t.log ||= []).push({ date: NOW, who: meOf(s.role), text: result ? `Done — ${result}` : 'Marked done' })
        if (t.jobId) addHist(s, t.jobId, { who: meOf(s.role), kind: kindOfTask(t.type), title: `Done · ${t.title}`, detail: result })
        /* a request from the site: whoever asked hears it's there, in their inbox */
        const hear = Array.from(new Set([t.by, ...(t.followers || [])].filter((p): p is PersonKey => !!p && p !== meOf(s.role))))
        if (hear.length) s.notices.unshift({ id: 'nt' + Date.now(), jobId: t.jobId, text: isRequest(t) ? `Dropped off · ${t.req?.what || t.title.replace(/^(Get to the site|Short on site) · /, '')}${s.jobs[t.jobId] ? ` at ${s.jobs[t.jobId].name}` : ''} — ${PEOPLE[meOf(s.role)]?.short || 'someone'}` : `Done · ${t.title} — ${PEOPLE[meOf(s.role)]?.short || 'someone'}`, when: 'Just now', kind: isRequest(t) ? 'material' : 'field', unread: true, open: { t: 'task', id: t.id }, for: hear })
        if (t.repeat) repeatTask(s, t)
      }, get().tasks.find((x) => x.id === id)?.repeat ? 'Done — the next one is on tomorrow’s list' : isRequest(get().tasks.find((x) => x.id === id)) ? 'Dropped off!' : 'Done!', { tone: 'done', sub: get().tasks.find((x) => x.id === id)?.title }),
    waitTask: (id, on, back) =>
      get().commit((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return
        t.state = 'waiting'
        t.waitingOn = on
        t.followUp = back
        ;(t.log ||= []).push({ date: NOW, who: meOf(s.role), text: `Waiting on ${on} · back ${back}` })
      }, `Waiting on ${on}`, { tone: 'wait', sub: `It comes back on your Today ${back.toLowerCase().startsWith('tomorrow') || back === 'Today' ? back.toLowerCase() : 'on ' + back}.` }),
    laterTask: (id, until) =>
      get().commit((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return
        const was = isoFromLabel(t.due)
        if (t.state === 'now' && was && was < TODAY_T) { t.rolls = (t.rolls || 0) + 1; t.lateFrom ||= was }
        t.state = 'later'
        t.laterUntil = until
        ;(t.log ||= []).push({ date: NOW, who: meOf(s.role), text: `Moved to later · back ${until}` })
      }, `Out of the way until ${until}`),
    reopenTask: (id) =>
      get().commit((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return
        t.state = 'now'
        t.waitingOn = undefined
        t.followUp = undefined
        t.laterUntil = undefined
        t.doneOn = undefined
        ;(t.log ||= []).push({ date: NOW, who: meOf(s.role), text: 'Back to needs action' })
      }, 'Back in needs action'),
    reassignTask: (id, owner) =>
      get().commit((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return
        t.owner = owner
        ;(t.log ||= []).push({ date: NOW, who: meOf(s.role), text: `Handed to ${PEOPLE[owner].name}` })
      }, `Handed to ${PEOPLE[owner].name}`),
    setTaskDue: (id, due) =>
      get().commit((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return
        /* moved after it was already late: counted (the team report shows how often) */
        const was = isoFromLabel(t.due)
        if (t.state === 'now' && was && was < TODAY_T) { t.rolls = (t.rolls || 0) + 1; t.lateFrom ||= was }
        t.due = due
        t.dueTone = due === 'Today' ? 'warn' : 'neutral'
        ;(t.log ||= []).push({ date: NOW, who: meOf(s.role), text: `Due ${due}` })
      }, `Due ${due}`),
    noteTask: (id, text, as) =>
      get().commit((s) => {
        const t = s.tasks.find((x) => x.id === id)
        if (!t) return
        const me = meOf(s.role)
        /* the admin can write it for someone who didn't — and it says so */
        ;(t.log ||= []).push({ date: NOW, who: as || me, text: as && as !== me ? `${text} — written by ${PEOPLE[me].short}` : text })
      }, as && as !== meOf(get().role) ? `Note added for ${PEOPLE[as].name}` : 'Note added', { undo: false }),
    addTask: (p) =>
      get().commit((s) => {
        s.tasks.unshift({
          id: 'n' + tid++ + ID.sfx, type: 'Setup', owner: meOf(s.role), for: [s.role], state: 'now', tone: 'info', log: [{ date: NOW, who: meOf(s.role), text: 'Created' }], ...p,
        } as Task)
      }, 'Task added'),
  })),
)

/* ---------- helpers used inside commits ---------- */
export function addHist(s: Data, jobId: string, e: Omit<HistEntry, 'date'> & { date?: string }) {
  if (!s.hist[jobId]) s.hist[jobId] = []
  s.hist[jobId].unshift({ date: e.date || NOW, ...e } as HistEntry)
}
export function kindOfTask(type: string): HistEntry['kind'] {
  return ({ Pricing: 'pricing', Setup: 'setup', Materials: 'material', Field: 'field', Changes: 'change', Schedule: 'schedule', Money: 'money' } as any)[type] || 'system'
}
/** a request from the site — something to bring over there; it's "Dropped off", not "Done" */
export const isRequest = (t?: Task) => !!t && (!!t.req || (t.type === 'Materials' && /^(Get to the site|Short on site) · /.test(t.title)))
export function newTask(s: Data, p: Partial<Task> & { jobId: string; title: string }) {
  const t: Task = { id: 'n' + tid++ + ID.sfx, type: 'Setup', owner: 'ys', for: ['owner'], state: 'now', tone: 'info', log: [{ date: NOW, who: 'system', text: 'Created' }], ...p } as Task
  s.tasks.unshift(t)
  return t
}
/** a recurring task: when one is done, the next one is created */
export function repeatTask(s: Data, t: Task) {
  const next = t.repeat === 'weekly' ? 'Next Mon' : t.repeat === 'monthly' ? 'Oct 28' : 'Tomorrow'
  s.tasks.push({ ...JSON.parse(JSON.stringify(t)), id: 'n' + tid++ + ID.sfx, state: 'now', due: next, dueTone: 'neutral', doneAt: undefined, result: undefined, log: [{ date: NOW, who: 'system', text: `Repeats — created when the last one was done` }] })
}
export function closeTasks(s: Data, ids: string[], text = 'Done') {
  s.tasks.forEach((t) => {
    if (ids.includes(t.id) && t.state !== 'done') {
      t.state = 'done'
      t.doneAt = 'Just now'
      t.doneOn = TODAY_T
      ;(t.log ||= []).push({ date: NOW, who: 'system', text })
    }
  })
}
export function setIssues(s: Data, jobId: string, fn: (issues: Job['issues']) => Job['issues']) {
  const j = s.jobs[jobId]
  if (!j) return
  j.issues = fn(j.issues)
  const worst = j.issues.find((i) => i.tone === 'bad') || j.issues.find((i) => i.tone === 'warn') || j.issues[0]
  j.status = worst ? (worst.tone === 'info' ? 'ok' : worst.tone) : 'ok'
  j.headline = worst ? worst.text : 'Nothing holding it up'
}
export function moveStage(s: Data, jobId: string, stage: Stage) {
  const j = s.jobs[jobId]
  if (!j) return
  j.stage = stage
}
export const L = (who: PersonKey, text: string): LogLine => ({ date: NOW, who, text })
/* recompute room and project progress after surfaces change */
export function recalc(s: Data, jobId: string, touched?: string[]) {
  const rs = s.rooms[jobId]
  if (!rs) return
  const full = hasSF(rs)
  rs.forEach((r) => {
    if (full || !touched || touched.includes(r.name)) r.pct = roomPct(r)
  })
  if (s.jobs[jobId] && full) s.jobs[jobId].pct = jobPct(rs)
}
export { nextRef, nextPO, fmtMoney }

/* ---------- selectors ---------- */
export function useJob(id?: string) {
  return useStore((s) => (id ? s.jobs[id] : undefined))
}
export function historyOf(s: Data, id: string): HistEntry[] {
  const job = s.jobs[id]
  if (!job) return []
  const p = s.pricing[id]
  if (p && ['request', 'estimating', 'proposal', 'followup'].includes(job.stage)) {
    const base: HistEntry[] = []
    ;[...p.fu].reverse().forEach((f) => base.push({ date: f.date, who: f.by, kind: 'pricing', title: `${f.how} — ${f.outcome.toLowerCase()}`, detail: f.note }))
    ;[...p.revs].reverse().forEach((r) => r.date !== '—' && base.push({ date: r.date, who: 'office', kind: 'pricing', title: `${r.r} sent${r.amount ? ' · $' + r.amount.toLocaleString('en-US') : ''}`, detail: r.what }))
    if (p.takeoff && p.takeoff.pct > 0) base.push({ date: 'Sep 16', who: p.estimator || 'estimator', kind: 'pricing', title: 'Estimating started' })
    base.push({ date: p.docs[0]?.note.match(/[A-Z][a-z]{2} \d+/)?.[0] || shiftText('Sep 25'), who: 'office', kind: 'pricing', title: 'Price request received', detail: p.docs.filter((d) => d.status === 'in').map((d) => d.name).join(', ') + ' in' })
    return [...(s.hist[id] || []), ...base]
  }
  return [...(s.hist[id] || []), ...historyFor(id, job)]
}
export function tasksForRole(tasks: Task[], role: Role) {
  return tasks.filter((t) => t.for.includes(role) || t.owner === meOf(role))
}
/* names and what each login sees follow the store — rename someone or change a login and every screen follows */
const syncTeam = (st: { team?: Member[]; access?: Record<Role, string[]> }) => {
  if (st.team) applyTeam(st.team)
  if (st.access) Object.entries(st.access).forEach(([k, v]) => { ACCESS[k as Role] = v })
}
/* CUSTOMERS (read all over) follows the clients in the store */
let lastClients: Record<string, Customer> | undefined
const syncClients = (st: { clients?: Record<string, Customer> }) => {
  if (!st.clients || st.clients === lastClients) return
  lastClients = st.clients
  Object.keys(CUSTOMERS).forEach((k) => { if (!st.clients![k]) delete CUSTOMERS[k] })
  Object.entries(st.clients).forEach(([k, v]) => { CUSTOMERS[k] = v })
}
/* JOB_TILES (looked up all over) follows the projects' tiles; custom grout colors join the standard list */
let lastTiles: Data['tiles'] | undefined
const syncTiles = (st: { tiles?: Data['tiles']; rules?: Rules }) => {
  if (st.rules?.grouts) Object.entries(st.rules.grouts).forEach(([k, v]) => { if (!GROUTS[k]) GROUTS[k] = v })
  if (!st.tiles || st.tiles === lastTiles) return
  lastTiles = st.tiles
  Object.keys(JOB_TILES).forEach((k) => { if (!st.tiles![k]) delete JOB_TILES[k] })
  Object.entries(st.tiles).forEach(([k, v]) => { JOB_TILES[k] = v })
}
syncTeam(useStore.getState())
syncClients(useStore.getState())
syncTiles(useStore.getState())
useStore.subscribe(syncTeam)
useStore.subscribe(syncClients)
useStore.subscribe(syncTiles)
/** sign in as someone: their login decides what they see */
export const ME_OF = ME
export function signInAs(key: PersonKey) {
  const m = useStore.getState().team.find((x) => x.key === key)
  if (!m) return
  ME[m.role] = key
  useStore.getState().setRole(m.role)
}

export function canSee(role: Role, what: 'money' | 'materials' | 'rooms' | 'jobs' | 'schedule') {
  if (role === 'owner') return true
  if (what === 'money') return role === 'pm' || role === 'accounting'
  if (what === 'schedule') return ['pm', 'site'].includes(role)
  if (what === 'materials') return role !== 'accounting'
  if (what === 'rooms') return role !== 'accounting'
  return role !== 'accounting'
}
export const roleNav = (r: Role) => roleDef(r).nav

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    useStore.setState({ route: parseHash(), modals: [] } as any)
  })
}
