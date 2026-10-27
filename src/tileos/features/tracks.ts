/* How a project really runs, in two parts on one screen:
 *   THE LINE — like the estimate's path: Approved → Getting ready → Crew scheduled → Installing → Touch-ups → Closed.
 *     The crew can't be scheduled until getting ready is done. Billing isn't on the line: it runs alongside the whole
 *     time and never stops anything.
 *   GETTING READY — five tracks at the same time: Scope, Tile, Site, Installer, Materials. Each one is a short path of
 *     steps; every step is one person's task, and it moves by itself when the thing really happens (the PO goes out,
 *     the tile is checked in, the scope is confirmed). Nothing to check off.
 *   THE ROOMS — the scope of work from the approved estimate, each room where it really is: not ready (and why), ready,
 *     installing (how far), stopped, done. */
import { meOf, isRequest, type Store } from '@/tileos/store'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import { roomPct, type Room } from '@/tileos/data/jobs'
import { labelFromIso, isoFromLabel, TODAY } from '@/tileos/lib/today'
import { stepsFor, paperQty, takesTile, floorRooms, fracIn, siteRooms, IN_FIELD_STAGES, SITE_CHECKS, type StepView, type StepState } from './steps'
import { methodOf } from './takeoff'
import { installerOf } from './upcoming'
import { pictureOf } from './progressbill'
import type { Task } from '@/tileos/data/work'

export type TrackKey = 'scope' | 'tile' | 'site' | 'installer' | 'materials' | 'other'
/** the five tracks of getting ready, and the steps each one walks through, in order */
export const TRACKS: { key: TrackKey; label: string; steps: string[] }[] = [
  { key: 'scope', label: 'Design', steps: ['design', 'change', 'tile', 'setup', 'layouts'] },
  { key: 'tile', label: 'Tile', steps: ['getpaper', 'rooms', 'qty', 'order', 'delivered'] },
  { key: 'site', label: 'Site', steps: ['heights', 'level', 'fixes', 'sheets'] },
  { key: 'installer', label: 'Installer', steps: ['installer', 'confirmed', 'walk'] },
  { key: 'materials', label: 'Materials', steps: ['materials', 'matin'] },
]
/** a question added on one project sits in the track of the part it was added to */
const GROUP_TRACK: Record<string, TrackKey> = { design: 'scope', site: 'site', installer: 'installer', materials: 'materials' }
/** each step's name on its track's path — what has to happen, said plainly */
export const STEP_SHORT: Record<string, string> = {
  design: 'Design meeting', change: 'Confirm scope', tile: 'Pick tile & grout', setup: 'Decide underlayment', layouts: 'Set layouts',
  getpaper: 'Get paperwork', rooms: 'Enter paperwork', qty: 'Check quantities', order: 'Get delivery date', delivered: 'Receive tile',
  heights: 'Site check', level: 'Floor levels', fixes: 'Fix problems', sheets: 'Hang room sheets',
  installer: 'Send installer PO', confirmed: 'Installer accepts', walk: 'Walk-through',
  materials: 'Order materials', matin: 'Receive materials',
}
/** a step's name on the path — it says what happened when that matters (tile short, the store revising) */
/** a step's name where its column is narrow (a phone): long words may break, with a hyphen, at a sensible place */
export const softWrap = (t: string) => t.replace(/\b(under)(layment)\b/gi, '$1\u00AD$2')

export function stepShort(s: Store, job: Job, v: StepView) {
  if (v.key === 'qty' && v.state === 'bad') {
    const short = Object.values(s.tiles[job.id] || {}).map((t) => paperQty(s, job.id, t)).filter((r) => r.on > 0 && r.short > 0)
    if (short.length) return `${short[0].tag} short${short.length > 1 ? ` +${short.length - 1}` : ''}`
  }
  if (v.key === 'qty' && v.state === 'wait') return 'Waiting on store'
  if (v.key === 'installer' && v.state !== 'done' && !installerOf(s, job)) return 'Pick installer'
  if (v.key === 'fixes' && v.state === 'now') return 'Re-check on site'
  if (v.key === 'order' && v.state === 'bad') return 'Store ordered short'
  if (v.key === 'delivered' && v.state === 'bad') return s.tasks.some((t) => t.jobId === job.id && t.tone === 'bad' && t.type === 'Materials' && t.state !== 'done') ? 'Tile came wrong' : 'Tile came short'
  return (!v.custom || v.key === 'design' || v.key === 'change' || v.key === 'layouts' || v.key === 'walk' || v.key === 'sheets') && !v.only ? STEP_SHORT[v.key] || v.short : v.short
}

export interface TrackView {
  key: TrackKey
  label: string
  steps: StepView[]
  /** the step the track is on: a problem first, then your turn, then anyone's turn, then what it waits for */
  lead?: StepView
  state: StepState
  done: number
  total: number
  /** the day the last step was done (when the whole track is) */
  doneOn?: string
}
const finished = (v: StepView) => v.state === 'done' || v.state === 'na'

/** which track a step is on — the deposit is on none (billing runs alongside) */
export function trackOf(v: StepView): TrackKey | null {
  if (v.key === 'deposit') return null
  const t = TRACKS.find((x) => x.steps.includes(v.key))
  if (t && !v.only) return t.key
  if (v.group && GROUP_TRACK[v.group]) return GROUP_TRACK[v.group]
  return 'other'
}

/** getting ready, track by track — a company's own steps (if any) on a sixth, "Your own" */
export function tracksFor(s: Store, job: Job, all: StepView[] = stepsFor(s, job)): TrackView[] {
  const me = meOf(s.role)
  const lists: Record<TrackKey, StepView[]> = { scope: [], tile: [], site: [], installer: [], materials: [], other: [] }
  all.forEach((v) => { const k = trackOf(v); if (k) lists[k].push(v) })
  /* in the track's own order; a question added on this project goes at the end of its track */
  TRACKS.forEach((t) => lists[t.key].sort((a, b) => (t.steps.indexOf(a.key) + 1 || 99) - (t.steps.indexOf(b.key) + 1 || 99)))
  const view = (key: TrackKey, label: string): TrackView | null => {
    const steps = lists[key]
    if (!steps.length) return null
    const open = steps.filter((v) => !finished(v))
    const lead = open.find((v) => v.state === 'bad') || open.find((v) => v.state === 'now' && v.owner === me) || open.find((v) => v.state === 'now') || open.find((v) => v.state === 'wait') || open[0]
    const state: StepState = !open.length ? 'done' : open.some((v) => v.state === 'bad') ? 'bad' : open.some((v) => v.state === 'now') ? 'now' : open.some((v) => v.state === 'wait') ? 'wait' : 'later'
    const days = steps.map((v) => v.doneOn).filter(Boolean) as string[]
    const doneOn = !open.length ? days.sort((a, b) => (isoFromLabel(a) || '').localeCompare(isoFromLabel(b) || '')).pop() : undefined
    return { key, label, steps, lead, state, done: steps.length - open.length, total: steps.length, doneOn }
  }
  const out: TrackView[] = []
  TRACKS.forEach((t) => { const v = view(t.key, t.label); if (v) out.push(v) })
  const own = view('other', 'Your own')
  if (own) out.push(own)
  return out
}

/** the crew waits for every track; the deposit isn't one (a warning, not a stop) */
export const gateOpen = (tracks: TrackView[]) => tracks.every((t) => t.state === 'done')

/** who has a track now and when — the words on its right */
export function leadWords(s: Store, job: Job, t: TrackView): { who?: PersonKey; top: string; sub?: string; tone: 'ok' | 'now' | 'mine' | 'wait' | 'bad' | 'later'; late?: boolean } {
  const me = meOf(s.role)
  const v = t.lead
  if (!v || t.state === 'done') return { top: 'All done', sub: t.doneOn, tone: 'ok' }
  const name = (p?: PersonKey) => (!p ? '' : p === me ? 'You' : PEOPLE[p]?.short || '')
  const day = (iso?: string) => (!iso ? undefined : iso === TODAY ? 'today' : iso < TODAY ? `was due ${labelFromIso(iso)}` : labelFromIso(iso) === 'Tomorrow' ? 'tomorrow' : `by ${labelFromIso(iso)}`)
  const late = !!v.due && v.due < TODAY
  if (v.state === 'wait') {
    const rec = s.stepRecs[job.id]?.[v.key]
    const task = v.taskId ? s.tasks.find((x) => x.id === v.taskId) : undefined
    const on = rec?.wait?.on || task?.waitingOn
      || (v.key === 'qty' ? 'the new paperwork' : v.key === 'confirmed' ? (() => { const p = [...s.ipos].reverse().find((x) => x.jobId === job.id); return p ? PEOPLE[p.crew]?.short : 'the installer' })() : '')
    const when = v.due ? (v.due <= TODAY ? 'follow up today' : `${['delivered', 'matin'].includes(v.key) ? 'coming' : ['design', 'walk'].includes(v.key) ? 'set for' : 'follow up'} ${labelFromIso(v.due)}`) : undefined
    if (['delivered', 'matin'].includes(v.key)) return { who: v.owner, top: v.due ? `Coming ${labelFromIso(v.due)}` : 'On the way', sub: name(v.owner) ? `${name(v.owner)} checks it in` : undefined, tone: 'wait' }
    if (['design', 'walk'].includes(v.key)) return { who: v.owner, top: v.due ? `Set for ${labelFromIso(v.due)}` : 'Set', sub: name(v.owner), tone: 'wait' }
    return { who: v.owner, top: on ? `Waiting on ${on}` : 'Waiting', sub: when, tone: 'wait' }
  }
  if (v.state === 'later') {
    const before = t.steps.find((x) => x.short === v.waitsFor)
    return { who: v.waitsOn || v.owner, top: `Waits for ${before ? stepShort(s, job, before) : v.waitsFor || 'the step before'}`, sub: v.waitsOn ? name(v.waitsOn) : undefined, tone: 'later' }
  }
  return { who: v.owner, top: name(v.owner), sub: day(v.due), tone: v.state === 'bad' ? 'bad' : v.owner === me ? 'mine' : 'now', late }
}

/* ================= the line ================= */
export type LineKey = 'approved' | 'ready' | 'crew' | 'install' | 'punch' | 'closed'
export type LineState = 'done' | 'now' | 'later' | 'bad'
export interface LineStep { key: LineKey; label: string; state: LineState; sub?: string; lock?: boolean }
/** the part of the project the left side shows: getting ready, the crew, the installing, touch-ups, closing */
export type Phase = 'ready' | 'crew' | 'install' | 'punch' | 'closed'

/** the crew's booking on the calendar (not a return visit) */
export const bookingOf = (s: Store, job: Job) => s.bookings.find((x) => x.jobId === job.id && x.label !== 'Return visit')

export function phaseOf(s: Store, job: Job, tracks: TrackView[] = tracksFor(s, job)): Phase {
  if (job.stage === 'installation') return 'install'
  if (job.stage === 'punch') return 'punch'
  if (['closeout', 'complete'].includes(job.stage)) return 'closed'
  return gateOpen(tracks) ? 'crew' : 'ready'
}

/** where the project is, like the estimate's path — one step "Now" */
export function lineOf(s: Store, job: Job, tracks: TrackView[] = tracksFor(s, job)): LineStep[] {
  const st = job.stage
  const inField = IN_FIELD_STAGES.includes(st)
  const est = s.estimates.find((e) => e.jobId === job.id && e.status === 'approved')
  const won = job.stageDates?.won || est?.approvedOn
  const b = bookingOf(s, job)
  const crew = (b?.crew || job.crew || installerOf(s, job)) as PersonKey | undefined
  const startIso = b?.start || s.prep[job.id]?.targetISO
  const start = job.dates?.start || (startIso ? labelFromIso(startIso) : undefined)
  const done = tracks.filter((t) => t.state === 'done').length
  const bad = tracks.filter((t) => t.state === 'bad').length
  const open = gateOpen(tracks)
  const booked = st === 'scheduled' || (!!b && !inField)
  const punch = s.punch.filter((p) => p.jobId === job.id)
  const openP = punch.filter((p) => p.status !== 'verified')
  const pct = st === 'installation' ? job.pct ?? 0 : 0
  const n = tracks.length
  return [
    { key: 'approved', label: 'Approved', state: 'done', sub: [won, est?.id].filter(Boolean).join(' · ') || 'Won' },
    inField || open
      ? { key: 'ready', label: 'Getting ready', state: 'done', sub: inField ? 'Done' : `All ${n} done` }
      : { key: 'ready', label: 'Getting ready', state: bad ? 'bad' : 'now', sub: `${done} of ${n} done${bad ? ` · ${bad} ${bad === 1 ? 'problem' : 'problems'}` : ''}` },
    inField || booked
      ? { key: 'crew', label: 'Crew scheduled', state: 'done', sub: [crew ? PEOPLE[crew]?.short : '', start].filter(Boolean).join(' · ') || 'Scheduled' }
      : open
        ? { key: 'crew', label: 'Crew scheduled', state: 'now', sub: crew ? `${PEOPLE[crew]?.short} — pick the days` : 'Pick the days' }
        : { key: 'crew', label: 'Crew scheduled', state: 'later', lock: true, sub: `opens when all ${n} are done` },
    st === 'installation'
      ? { key: 'install', label: 'Installing', state: 'now', sub: `${pct}%${crew ? ` · ${PEOPLE[crew]?.short}` : ''}` }
      : inField
        ? { key: 'install', label: 'Installing', state: 'done', sub: job.dates?.finish ? `Done ${job.dates.finish}` : 'Done' }
        : { key: 'install', label: 'Installing', state: 'later', sub: start ? `${startIso && startIso < TODAY ? 'was to start' : 'starts'} ${start}` : undefined },
    st === 'punch'
      ? { key: 'punch', label: 'Touch-ups', state: 'now', sub: openP.length ? `${openP.length} open` : 'None open' }
      : ['closeout', 'complete'].includes(st)
        ? { key: 'punch', label: 'Touch-ups', state: 'done', sub: punch.length ? 'All checked' : 'None' }
        : { key: 'punch', label: 'Touch-ups', state: 'later' },
    st === 'closeout'
      ? { key: 'closed', label: 'Closed', state: 'now', sub: 'The final bill' }
      : st === 'complete'
        ? { key: 'closed', label: 'Closed', state: 'done', sub: 'Paid and closed' }
        : { key: 'closed', label: 'Closed', state: 'later' },
  ]
}

/** the money, alongside the line — billed and paid of the contract, and the deposit */
export function moneyLine(s: Store, job: Job) {
  const pic = pictureOf(s, job.id)
  const total = pic.contract + pic.changes
  const dep = s.money.find((m) => m.jobId === job.id && m.kind === 'deposit')
  const dep2: { text: string; tone: 'ok' | 'warn' | 'muted' } | null = !dep ? null
    : dep.state === 'paid' ? { text: `deposit paid${dep.date ? ` ${dep.date}` : ''}`, tone: 'ok' }
      : dep.step >= 1 ? { text: `deposit sent${dep.date ? ` ${dep.date}` : ''} — not paid yet`, tone: 'warn' }
        : { text: 'deposit not invoiced yet', tone: 'warn' }
  return { ...pic, total, dep: dep2 }
}

/* ================= open issues ================= */
/** anything that came up on the project that isn't a step — a problem, a request, a question, something to chase.
 *  Problems first, then what we're waiting on, then the rest. */
export function issuesOf(s: Store, job: Job): Task[] {
  const rank = (t: Task) => (t.tone === 'bad' ? 0 : t.state === 'waiting' ? 1 : 2)
  return s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.step && !t.title.startsWith('Touch-ups at') && !t.repeat).sort((a, b) => rank(a) - rank(b))
}
export const issueKind = (t: Task) => (isRequest(t) ? 'Needed on site' : t.tone === 'bad' ? 'Problem' : t.type === 'Pricing' ? 'Change' : t.state === 'waiting' ? 'Waiting' : 'To do')

/* ================= the rooms ================= */
export type RoomState = 'notready' | 'ready' | 'installing' | 'stopped' | 'done' | 'notstarted'
export type ChipTone = 'bad' | 'warn' | 'todo' | 'ok'
export interface RoomChip { tone: ChipTone; text: string }
/** the word before a room's line, where the line itself doesn't say it */
export const ROOM_WORD: Record<RoomState, string> = { notready: '', ready: '', installing: '', stopped: 'Stopped', done: '', notstarted: 'Not started' }
/** what a room needs before the crew can start on it — each one done, to come, or a problem */
export interface RoomCheck { label: string; state: 'ok' | 'todo' | 'bad'; note?: string }
export interface RoomView { room: Room; sf: number; pct: number; state: RoomState; chips: RoomChip[]; tiles: string[]; sub: string; checks: RoomCheck[] }


const low = (t: string) => t.replace(/\s*·.*$/, '').replace(/^[A-Z](?![A-Z]|-\d)/, (c) => c.toLowerCase())

/** every room of the scope of work and where it really is. What's wrong with this room itself says so on it (the
 *  worst first); what's simply still to come (tile, layout, the site check) is one quiet line. */
export function roomsOf(s: Store, job: Job, steps: StepView[] = stepsFor(s, job)): RoomView[] {
  const rooms = s.rooms[job.id] || []
  const inField = IN_FIELD_STAGES.includes(job.stage)
  const tiles = s.tiles[job.id] || {}
  const step = (k: string) => steps.find((v) => v.key === k)
  const open = (k: string) => { const v = step(k); return !!v && v.state !== 'done' && v.state !== 'na' }
  const crew = (bookingOf(s, job)?.crew || job.crew) as PersonKey | undefined
  const problems = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && t.tone === 'bad')
  const floors = floorRooms(rooms)
  const shortRows = Object.values(tiles).map((t) => paperQty(s, job.id, t)).filter((r) => r.on > 0 && r.short > 0)
  /* the site check's problems: one that names a room is that room's; the rest are every room's */
  const siteBad = Object.entries(s.stepRecs[job.id]?.heights?.checks || {}).filter(([, c]) => !c.ok && !c.na)
  const meetingDone = !open('design')
  return rooms.map((r) => {
    const tiled = r.surfaces.filter((x) => takesTile(x.name))
    const sf = r.surfaces.reduce((n, x) => n + (x.sf || 0), 0)
    const pct = roomPct(r)
    const tags = Array.from(new Set(tiled.map((x) => x.tile).filter(Boolean))) as string[]
    const chips: RoomChip[] = []
    const toCome: string[] = []
    const add = (tone: ChipTone, text: string) => { if (!chips.some((c) => c.text === text)) chips.push({ tone, text }) }
    const named = (text: string) => text.toLowerCase().includes(r.name.toLowerCase())
    const cut = (t: string) => (t.length > 34 ? t.slice(0, 32).trimEnd() + '…' : t)
    if (pct < 100) {
      /* stopped or held up on site */
      const blocked = r.surfaces.find((x) => x.state === 'blocked')
      if (blocked) add('bad', cut(`Stopped — ${low(blocked.reason || 'blocked')}`))
      const held = r.surfaces.find((x) => x.state === 'waitmat' || x.state === 'hold')
      if (held) add('warn', cut(held.pending ? `Change pending — ${held.pending.co}` : held.reason ? `Waiting — ${low(held.reason)}` : held.state === 'hold' ? 'On hold — a change' : 'Waiting on material'))
      /* a problem logged on this room or on its tile (when nothing above already says it) */
      if (!blocked && !held) problems.filter((t) => named(`${t.where || ''} ${t.title}`) || tags.some((tag) => t.title.startsWith(tag) || (t.where || '').startsWith(tag))).slice(0, 1).forEach((t) => add('bad', cut(t.title.replace(/^(T-\d+):\s*\d+\s+boxes?\s+/, '$1 '))))
      /* the site check: looked at room by room, only the rooms that miss it; the rest, every room it's asked in */
      siteBad.forEach(([k, c]) => {
        const def = SITE_CHECKS.find((x) => x.k === k)
        const no = def?.no || (k === 'walls' ? 'Wall heights to check' : `${k}: no`)
        const here = c.rooms?.length ? c.rooms.includes(r.name) : !def?.byRoom || siteRooms(rooms, k).includes(r.name)
        if (here) add(c.fixed ? 'warn' : 'bad', c.fixed ? `${no} — fixed, to check` : no)
      })
      const fl = floors.find((f) => f.room.name === r.name)
      if (fl?.word?.tone === 'bad') add('bad', `Floor ${fracIn(fl.word.diff)} out`)
      /* its tile: short on the paperwork, short or not here yet, more coming */
      tags.forEach((tag) => {
        if (open('qty') && shortRows.some((x) => x.tag === tag)) add(step('qty')?.state === 'wait' ? 'warn' : 'bad', `${tag} short`)
        const c = s.checks.find((x) => x.jobId === job.id && x.tag === tag)
        if (c && c.received < c.ordered) {
          if (c.received > 0) add('bad', `${tag} short — ${c.received} of ${c.ordered}`)
          else if (!inField) toCome.push(c.eta ? `tile ${c.eta.replace(/^\w+,\s*/, '')}` : 'tile')
          else add('warn', c.eta ? `${tag} coming ${c.eta.replace(/^\w+,\s*/, '')}` : `${tag} not here yet`)
        }
        const sh = s.shortages.find((x) => x.jobId === job.id && x.tag === tag && x.step !== 'received' && x.surfaces.some((y) => y.room === r.name))
        if (sh) add(sh.stops ? 'bad' : 'warn', sh.eta ? `More ${tag} coming ${sh.eta.replace(/^\w+,\s*/, '')}` : `More ${tag} needed`)
      })
      if (!inField) {
        if (tiled.some((x) => !x.tile)) toCome.push('tile')
        else if (tags.length && open('delivered') && !s.checks.some((x) => x.jobId === job.id)) toCome.push('tile')
        /* its layout: in question once the meeting's done and it still isn't set */
        const noLayout = tiled.filter((x) => x.tile && !x.layout)
        if (noLayout.length && open('layouts')) { if (meetingDone) add('warn', 'Layout in question'); else toCome.push('layout') }
        if (open('setup') && r.surfaces.some((x) => x.sf && methodOf(r.name, x).auto)) toCome.push('underlayment')
        if (open('heights') && step('heights')?.state !== 'bad') toCome.push('site check')
      }
    }
    const order: Record<ChipTone, number> = { bad: 0, warn: 1, todo: 2, ok: 3 }
    chips.sort((a, b) => order[a.tone] - order[b.tone])
    /* nothing wrong with it, only what's still to come: one quiet line */
    if (!chips.length && toCome.length) chips.push({ tone: 'todo', text: `To come: ${Array.from(new Set(toCome)).join(', ')}` })
    const blocked = pct < 100 && r.surfaces.some((x) => x.state === 'blocked')
    const started = inField && (pct > 0 || r.surfaces.some((x) => x.state === 'working'))
    const state: RoomState = pct >= 100 ? 'done'
      : inField ? (blocked ? 'stopped' : started ? 'installing' : chips.some((c) => c.tone === 'bad' || c.tone === 'warn') ? 'notready' : 'notstarted')
        : chips.length ? 'notready' : 'ready'
    const doneN = r.surfaces.filter((x) => x.state === 'done').length
    const n = r.surfaces.length
    const what = n === 1 ? r.surfaces[0].name : `${n} walls & floors`
    const sub = state === 'done' ? `Done${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}`
      : started ? `${crew ? `${PEOPLE[crew]?.short} · ` : ''}${doneN} of ${n === 1 ? '1' : `${n} walls & floors`} done`
        : `${sf ? `${sf.toLocaleString('en-US')} SF` : `${what} · no square feet yet`}${tags.length ? ` · ${tags.join(', ')}` : ''}`
    /* before the crew: what this room needs, one line each */
    const checks: RoomCheck[] = []
    if (!inField) {
      const tileProblem = chips.find((c) => c.tone === 'bad' && tags.some((tag) => c.text.includes(tag)))
      checks.push({ label: 'Tile picked', state: tiled.some((x) => !x.tile) ? 'todo' : 'ok', note: tags.join(', ') || undefined })
      const tileHere = !open('delivered') || (tags.length > 0 && tags.every((tag) => { const c = s.checks.find((x) => x.jobId === job.id && x.tag === tag); return !!c && c.received >= c.ordered }))
      checks.push({ label: 'Tile on site', state: tileProblem ? 'bad' : tileHere ? 'ok' : 'todo', note: tileProblem?.text || toCome.find((x) => /^tile /.test(x))?.replace(/^tile /, 'coming ') })
      checks.push({ label: 'Layout set', state: !open('layouts') || tiled.every((x) => !x.tile || x.layout) ? 'ok' : chips.some((c) => c.text === 'Layout in question') ? 'bad' : 'todo' })
      checks.push({ label: 'Underlayment decided', state: !open('setup') || !r.surfaces.some((x) => x.sf && methodOf(r.name, x).auto) ? 'ok' : 'todo' })
      const siteProblem = chips.find((c) => c.tone === 'bad' && SITE_CHECKS.some((d) => d.no === c.text))
      checks.push({ label: 'Site checked', state: siteProblem ? 'bad' : !open('heights') ? 'ok' : 'todo', note: siteProblem?.text })
      const fl = floors.find((f) => f.room.name === r.name)
      if (fl && !fl.mud) checks.push({ label: 'Floor level', state: fl.word?.tone === 'bad' ? 'bad' : fl.word || !open('level') ? 'ok' : 'todo', note: fl.word?.label })
    }
    return { room: r, sf, pct, state, chips, tiles: tags, sub, checks }
  })
}
