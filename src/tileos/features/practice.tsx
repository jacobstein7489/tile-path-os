/* A practice project — to try what the site manager does every day and what it moves: his daily update, the
 * installer's pay for the week, and what gets billed to the client. One click in Settings makes it (pick which
 * installer is on it); it's marked "Practice" everywhere it shows; "Remove the practice project" takes every piece of
 * it back out — the project, its client, rooms, tiles, the installer's PO and booking, the updates and bills. */
import * as React from 'react'
import { FlaskConical, Trash2, ArrowRight, ClipboardList, HandCoins, Receipt, ChevronDown, Check, HardHat, Package, Truck } from 'lucide-react'
import { useStore, meOf, NOW, signInAs, type Store } from '@/tileos/store'
import { Avatar, Button, CardHeader, IconCircle } from '@/tileos/components/ui/core'
import { Card } from '@/tileos/components/ui/page'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { CREWS, PEOPLE, fmtMoney, type Job, type PersonKey, type Customer } from '@/tileos/data/model'
import { jobPct, roomPct, type Room, type Tile } from '@/tileos/data/jobs'
import type { DiaryEntry } from '@/tileos/data/field'
import { REAL, backToMe } from '@/tileos/lib/save'
import { TODAY, MONDAY, addDays, md, dayShort } from '@/tileos/lib/today'

export const PRACTICE = 'practice'
const CLIENT = 'practice-client'
const IPO_ID = 'IPO-PRACTICE'
const BOOKING = 'bk-practice'
const S = () => useStore.getState()
export const hasPractice = (s: Pick<Store, 'jobs'>) => !!s.jobs[PRACTICE]
/** the real people: the site manager (the admin when there's none), the admin */
const siteOf = (s: Store) => (s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key as PersonKey | undefined)
const bossOf = (s: Store) => ((REAL.me && s.team.some((m) => m.key === REAL.me) ? REAL.me : meOf('owner')) as PersonKey)
const crewsOf = (s: Store) => CREWS.filter((c) => !s.inactive.includes('crew:' + c) && PEOPLE[c])

/* what the crew put in, day by day since last Monday — only the days before today (today's is his to send) */
type Move = [day: number, room: string, surface: string, from: number, to: number]
const MOVES: Move[] = [
  [0, 'Master Bath', 'Floor', 0, 50],
  [1, 'Master Bath', 'Floor', 50, 100], [1, 'Master Bath', 'Shower walls', 0, 15],
  [2, 'Master Bath', 'Shower walls', 15, 35],
  [3, 'Master Bath', 'Shower walls', 35, 55], [3, 'Kitchen', 'Backsplash', 0, 40],
  [4, 'Kitchen', 'Backsplash', 40, 100],
  [7, 'Master Bath', 'Shower walls', 55, 70],
  [8, 'Master Bath', 'Shower walls', 70, 80], [8, 'Master Bath', 'Niche', 0, 50],
  [9, 'Master Bath', 'Shower walls', 80, 90], [9, 'Master Bath', 'Niche', 50, 100],
  [10, 'Master Bath', 'Shower walls', 90, 100],
  [11, 'Master Bath', 'Shower floor', 0, 60],
]
const TILES: Record<string, Tile> = {
  'T-1': { tag: 'T-1', name: 'Porcelain floor', size: '24 × 24', finish: 'Matte', maker: 'Practice', supplier: 'Tile store', suppliedBy: 'Owner', sku: '', swatch: 'grigio', grout: 'warmgray', joint: '1/8″' },
  'T-2': { tag: 'T-2', name: 'Wall tile', size: '12 × 24', finish: 'Matte', maker: 'Practice', supplier: 'Tile store', suppliedBy: 'Owner', sku: '', swatch: 'bianco', grout: 'white', joint: '1/16″' },
  'T-3': { tag: 'T-3', name: 'Hex mosaic 2″', size: '2″ hex', finish: 'Matte', maker: 'Practice', supplier: 'Tile store', suppliedBy: 'Owner', sku: '', swatch: 'hex', grout: 'warmgray', joint: '1/16″' },
  'T-4': { tag: 'T-4', name: 'White subway', size: '3 × 12', finish: 'Gloss', maker: 'Practice', supplier: 'Tile store', suppliedBy: 'Owner', sku: '', swatch: 'subway', grout: 'white', joint: '1/16″' },
}
const SURF = (name: string, tile: string, sf: number, extra: Partial<Room['surfaces'][number]> = {}) => ({ name, tile, sf, state: 'ready' as const, grout: TILES[tile].grout, joint: TILES[tile].joint, ...extra })

/** where the practice project starts: getting ready (paperwork in, square feet in — nothing ordered or booked, to try
 *  the installer's PO, the orders, the tile coming in, then installing), or already installing (to try the daily
 *  update, pay and billing) */
export type PracticeFrom = 'start' | 'installing'
export function makePractice(crew: PersonKey, from: PracticeFrom = 'installing') {
  if (from === 'start') return makePracticeStart()
  const s0 = S()
  if (hasPractice(s0)) return
  const lastMon = addDays(MONDAY, -7)
  const finish = addDays(TODAY, 8)
  const site = siteOf(s0) || bossOf(s0)
  const boss = bossOf(s0)
  const days = MOVES.filter(([d]) => addDays(lastMon, d) < TODAY)
  /* the rooms, as far along as the updates say */
  const rooms: Room[] = [
    { name: 'Master Bath', floor: '2nd floor', pct: 0, surfaces: [
      SURF('Floor', 'T-1', 60, { layout: 'Straight lay · full tile at the door', edge: 'Saddle at the door', prep: 'Uncoupling membrane' }),
      SURF('Shower walls', 'T-2', 110, { layout: 'Offset 1/3 · start from the top', height: 'To the ceiling', edge: 'Metal edge · brushed nickel', prep: 'Waterproofing membrane' }),
      SURF('Shower floor', 'T-3', 15, { layout: 'Pitched to the drain', prep: 'Mud bed' }),
      SURF('Niche', 'T-2', 6, { layout: 'Mitered edges', edge: 'Mitered' }),
    ] },
    { name: 'Kitchen', floor: '1st floor', pct: 0, surfaces: [SURF('Backsplash', 'T-4', 35, { layout: 'Offset 1/2 · centered on the range', height: '18″ to the cabinets' })] },
    { name: 'Guest Bath', floor: '2nd floor', pct: 0, surfaces: [
      SURF('Floor', 'T-1', 45, { layout: 'Straight lay · centered on the door', edge: 'Saddle at the door' }),
      SURF('Tub walls', 'T-4', 80, { layout: 'Offset 1/2 · centered on the tub', height: '84″ · metal edge on top', edge: 'Metal edge · brushed nickel', prep: 'Cement board, taped' }),
    ] },
  ]
  days.forEach(([, room, surface, , to]) => {
    const x = rooms.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
    if (x) { x.pct = to; x.state = to >= 100 ? 'done' : 'working' }
  })
  rooms.forEach((r) => (r.pct = roomPct(r)))
  /* one update per work day, newest first — the way the site manager sends them */
  const byDay = new Map<number, Move[]>()
  days.forEach((m) => byDay.set(m[0], [...(byDay.get(m[0]) || []), m]))
  const diary: DiaryEntry[] = Array.from(byDay.entries()).sort((a, b) => b[0] - a[0]).map(([d, ms]) => {
    const iso = addDays(lastMon, d)
    const rs = Array.from(new Set(ms.map((m) => m[1])))
    return {
      id: `dp-${iso}`, date: md(iso), day: dayShort(iso), who: crew, workers: 2,
      rooms: rs.map((room) => ({ room, items: ms.filter((m) => m[1] === room).map((m) => ({ surface: m[2], from: m[3], to: m[4] })), media: [] })),
      note: 'Practice update',
    }
  })
  const pct = jobPct(rooms)
  const job: Job = {
    id: PRACTICE, name: 'Practice — 12 Test Lane', client: 'Practice client', clientId: CLIENT, address: '12 Test Lane · practice, not a real job', clientPO: 'PRACTICE',
    stage: 'installation', status: 'ok', headline: 'Practice project — try the daily update',
    issues: [{ tone: 'info', text: 'Practice project — remove it in Settings → Practice project when you’re done' }],
    next: { text: 'Send today’s daily update', owner: site, due: 'Today' },
    pct, crew, workers: 2, pm: boss, site, kind: 'install',
    keyDate: { label: 'Finish', value: md(finish) },
    dates: { start: md(lastMon), finish: md(finish), awarded: md(addDays(lastMon, -21)) },
    swatch: 'calacatta', building: 'house', contract: 14200,
    stageDates: { won: md(addDays(lastMon, -21)), setup: md(addDays(lastMon, -18)), verification: md(addDays(lastMon, -14)), ready: md(addDays(lastMon, -10)), scheduled: md(addDays(lastMon, -9)), installation: md(lastMon) },
  }
  const client: Customer = { id: CLIENT, name: 'Practice client', kind: 'Homeowner', address: '12 Test Lane', phone: '', email: '', notes: 'Made for practice — remove it in Settings → Practice project.', contacts: [] }
  const sent = md(addDays(lastMon, -9))
  s0.commit((st) => {
    st.jobs[PRACTICE] = job
    st.clients[CLIENT] = client
    st.tiles[PRACTICE] = JSON.parse(JSON.stringify(TILES))
    st.rooms[PRACTICE] = rooms
    st.diary[PRACTICE] = diary
    st.ipos.push({
      id: IPO_ID, jobId: PRACTICE, crew, status: 'Accepted', date: sent,
      lines: [
        { item: 'Floor tile — set and grout', qty: '105 SF', amount: 1575, itemId: 'i-floor', n: 105, rate: 15 },
        { item: 'Wall tile — set and grout', qty: '231 SF', amount: 4158, itemId: 'i-wall', n: 231, rate: 18 },
        { item: 'Mosaic — shower floor', qty: '15 SF', amount: 450, itemId: 'i-mosaic', n: 15, rate: 30 },
      ],
      changes: [],
      log: [{ date: sent, who: boss, text: `Sent to ${PEOPLE[crew]?.short} (practice)` }, { date: sent, who: crew, text: 'Accepted' }],
    })
    st.bookings.push({ id: BOOKING, crew, jobId: PRACTICE, start: lastMon, end: finish, label: 'Master bath · kitchen · guest bath (practice)', workers: 2, status: 'on' })
    ;(st.hist[PRACTICE] ||= []).unshift({ date: NOW, who: meOf(st.role), kind: 'field', title: 'Practice project made', detail: `${PEOPLE[crew]?.short} installing since ${md(lastMon)}. Try the daily update, then see installer pay and billing move. Remove it in Settings when you’re done.` } as any)
  }, 'Practice project made', { sub: `${PEOPLE[crew]?.short} is on it — ${PEOPLE[site]?.short || 'the site manager'} has today’s daily update.` })
}

/** the rooms, every wall and floor with its tile and square feet — nothing installed yet, and no layouts: those are
 *  set after the design meeting, from what the system suggests */
function practiceRooms(): Room[] {
  return [
    { name: 'Master Bath', floor: '2nd floor', pct: 0, surfaces: [
      SURF('Floor', 'T-1', 60, { edge: 'Saddle at the door' }),
      SURF('Shower walls', 'T-2', 110, { height: 'To the ceiling', edge: 'Metal edge · brushed nickel' }),
      SURF('Shower floor', 'T-3', 15),
      SURF('Niche', 'T-2', 6, { edge: 'Mitered' }),
    ] },
    { name: 'Kitchen', floor: '1st floor', pct: 0, surfaces: [SURF('Backsplash', 'T-4', 35, { height: '18″ to the cabinets' })] },
    { name: 'Guest Bath', floor: '2nd floor', pct: 0, surfaces: [
      SURF('Floor', 'T-1', 45, { edge: 'Saddle at the door' }),
      SURF('Tub walls', 'T-4', 80, { height: '84″ · metal edge on top', edge: 'Metal edge · brushed nickel' }),
    ] },
  ]
}
/** a practice project that's just been won: the paperwork is in (every tile, with enough coming), the square feet are in —
 *  the installer, his PO, the materials, the tile delivery and the start are all still to do */
function makePracticeStart() {
  const s0 = S()
  if (hasPractice(s0)) return
  const boss = bossOf(s0)
  const site = siteOf(s0) || boss
  const start = addDays(TODAY, 10)
  const rooms = practiceRooms()
  rooms.forEach((r) => r.surfaces.forEach((x) => { x.state = 'ready'; x.pct = 0 }))
  const tiles: Record<string, Tile> = JSON.parse(JSON.stringify(TILES))
  Object.values(tiles).forEach((t) => {
    const on = rooms.flatMap((r) => r.surfaces).filter((x) => x.tile === t.tag)
    const need = on.reduce((n, x) => n + (x.sf || 0) * (/floor/i.test(x.name) ? 1.1 : 1.12), 0)
    t.paper = { qty: Math.ceil(need / 10) * 10 + 10, unit: 'SF' }
  })
  const contract = 14200
  const won = md(addDays(TODAY, -2))
  const job: Job = {
    id: PRACTICE, name: 'Practice — 12 Test Lane', client: 'Practice client', clientId: CLIENT, address: '12 Test Lane · practice, not a real job', clientPO: 'PRACTICE',
    stage: 'setup', status: 'ok', headline: 'Practice project — try the whole flow',
    issues: [{ tone: 'info', text: 'Practice project — remove it in Settings → Practice project when you’re done' }],
    next: { text: 'Pick the installer and send his PO', owner: boss, due: 'Today' },
    pct: 0, pm: boss, site, kind: 'install',
    keyDate: { label: 'Start', value: md(start) },
    dates: { awarded: won },
    swatch: 'calacatta', building: 'house', contract,
    stageDates: { won, setup: won },
  }
  const client: Customer = { id: CLIENT, name: 'Practice client', kind: 'Homeowner', address: '12 Test Lane', phone: '', email: '', notes: 'Made for practice — remove it in Settings → Practice project.', contacts: [] }
  s0.commit((st) => {
    st.jobs[PRACTICE] = job
    st.clients[CLIENT] = client
    st.tiles[PRACTICE] = tiles
    st.rooms[PRACTICE] = rooms
    st.prep[PRACTICE] = { ...(st.prep[PRACTICE] || {}), targetISO: start } as any
    st.money.push({ id: 'dep-practice', jobId: PRACTICE, kind: 'deposit', title: 'Deposit 20%', amount: Math.round(contract * 0.2), step: 0, state: 'todo', note: 'Practice — nothing goes to QuickBooks', log: [{ date: NOW, who: 'system', text: 'Deposit required — practice' }] } as any)
    ;(st.hist[PRACTICE] ||= []).unshift({ date: NOW, who: meOf(st.role), kind: 'setup', title: 'Practice project made — paperwork in, nothing ordered yet', detail: 'Pick the installer and send his PO, order the materials, get the tile in, then start the job. Remove it in Settings when you’re done.' } as any)
  }, 'Practice project made', { sub: 'Paperwork and square feet are in — the installer, the orders and the start are yours to try.' })
}

/** everything with the practice project's id, gone */
export function removePractice() {
  S().commit((st) => {
    const j = PRACTICE
    delete st.jobs[j]
    delete st.clients[CLIENT]
    ;(['tiles', 'rooms', 'diary', 'hist', 'prep', 'notes', 'messages', 'pricing', 'stepRecs', 'jobSteps'] as const).forEach((k) => { if ((st as any)[k]?.[j]) delete (st as any)[k][j] })
    ;(['tasks', 'money', 'pos', 'mats', 'checks', 'bookings', 'ready', 'punch', 'ipos', 'estimates', 'events', 'shortages', 'files'] as const).forEach((k) => { (st as any)[k] = ((st as any)[k] as any[]).filter((x) => x?.jobId !== j) })
    st.notices = st.notices.filter((n: any) => n.jobId !== j)
    st.inactive = st.inactive.filter((x) => x !== 'client:' + CLIENT)
  }, 'Practice project removed', { sub: 'Its updates, pay lines and bills went with it.' })
}

/* ---------------- Settings → Practice project ---------------- */
export function PracticeTab() {
  const s = useStore()
  const crews = crewsOf(s)
  const [crew, setCrew] = React.useState<PersonKey>(crews[0] || 'philip')
  const [from, setFrom] = React.useState<PracticeFrom>('start')
  const on = hasPractice(s)
  const job = s.jobs[PRACTICE]
  const site = siteOf(s)
  const ipo = s.ipos.find((p) => p.id === IPO_ID)
  const asSite = () => { if (site) signInAs(site); else s.setRole('site'); S().go({ page: 'today' }) }
  /* the project opens right on that question — no window on top of it */
  const open = (k?: string) => () => S().open({ t: 'job', id: PRACTICE, tab: k ? `step:${k}` : undefined })
  const early = !!job && ['awarded', 'setup', 'verification', 'ready', 'scheduled'].includes(job.stage)
  const startSteps: { icon: React.ElementType; title: string; sub: string; btn: string; run: () => void }[] = [
    { icon: HardHat, title: '1 · The installer’s PO', sub: 'Pick who installs it — his PO is made from the square feet × his rates. Send it, then mark that he said yes.', btn: 'Pick the installer', run: open('installer') },
    { icon: Package, title: '2 · Order the setting materials', sub: 'Decide what every wall and floor is set on — the materials work themselves out from the square feet. Then send the PO.', btn: 'Decide the setup', run: open('setup') },
    { icon: Truck, title: '3 · The tile comes in', sub: 'Get the delivery date from the store, then check it in. Anything broken, wrong or missing: + Add → A problem.', btn: 'Tile delivery date', run: open('order') },
    { icon: ClipboardList, title: '4 · Start the job — then the daily update', sub: 'When it’s ready, Start the job. Then the daily update, installer pay and billing follow from it.', btn: 'Open the project', run: open() },
  ]
  const steps: { icon: React.ElementType; title: string; sub: string; btn: string; run: () => void }[] = early ? startSteps : [
    { icon: ClipboardList, title: `1 · The daily update — as ${site ? PEOPLE[site]?.short : 'the site manager'}`, sub: 'His Today has “Daily update · Practice — 12 Test Lane”. Move a wall or floor (say the shower floor to 100%), add a photo, send it. You come back with “Back to me” on top.', btn: `See it as ${site ? PEOPLE[site]?.short : 'the site manager'}`, run: asSite },
    { icon: HandCoins, title: `2 · Installer pay — ${job?.crew ? PEOPLE[job.crew]?.short : 'his'} week`, sub: 'Installer pay works out his week from the updates: square feet that moved × the rate on his PO. Today’s update shows up there as soon as it’s sent.', btn: 'Open installer pay', run: () => S().go({ page: 'pay' }) },
    { icon: Receipt, title: '3 · Billing — what the client owes for the work', sub: 'Billing → Progress: last week’s work on this project is ready to bill, figured the same way from the updates. This week’s keeps adding up as updates come in.', btn: 'Open billing', run: () => S().go({ page: 'money', tab: 'progress' }) },
  ]
  return (
    <Card pad={false} className="overflow-hidden">
      <CardHeader
        icon={<IconCircle tone="info" size={34}><FlaskConical className="h-4 w-4" /></IconCircle>}
        title="Practice project — try the whole flow"
        sub="A made-up project with its rooms, square feet and tiles filled in. Nothing goes to a client or to QuickBooks. It shows in pay and billing while it’s here — remove it before you approve pay or send bills."
      />
      {!on ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line-2 px-5 py-4 max-sm:px-4">
          <span className="text-[0.875rem] text-ink-2">Start it</span>
          <Menu align="start" width={320} trigger={
            <button aria-label="Where it starts" className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white px-3 text-[0.84375rem] font-semibold text-ink hover:border-[#cdc7bc]">{from === 'start' ? 'Getting ready — nothing ordered yet' : 'Installing — a crew on it since last Monday'}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>
          }>
            <MenuLabel>Where the practice project starts</MenuLabel>
            <MenuItem checked={from === 'start'} onSelect={() => setFrom('start')} hint="Try the installer’s PO, the orders, the tile coming in, then installing">Getting ready — nothing ordered yet</MenuItem>
            <MenuItem checked={from === 'installing'} onSelect={() => setFrom('installing')} hint="Try the daily update, installer pay and billing">Installing — a crew on it since last Monday</MenuItem>
          </Menu>
          {from === 'installing' && <span className="text-[0.875rem] text-ink-2">with</span>}
          {from === 'installing' && <Menu align="start" width={240} trigger={
            <button className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-[0.84375rem] font-semibold text-ink hover:border-[#cdc7bc]"><Avatar who={crew} size={26} />{PEOPLE[crew]?.name}<ChevronDown className="h-3.5 w-3.5 text-faint" /></button>
          }>
            <MenuLabel>The installer on the practice project</MenuLabel>
            {crews.map((c) => <MenuItem key={c} icon={<Avatar who={c} size={20} />} checked={crew === c} onSelect={() => setCrew(c)}>{PEOPLE[c]?.name}</MenuItem>)}
          </Menu>}
          <Button variant="primary" icon={<FlaskConical />} onClick={() => makePractice(crew, from)}>Make the practice project</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 border-t border-line-2 px-5 py-3.5 max-sm:px-4">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ok-50 text-ok-600"><Check className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.90625rem] font-semibold text-ink">{job?.name}</span>
              <span className="block text-[0.78125rem] text-muted">{[early ? 'Getting ready' : job?.crew ? `${PEOPLE[job.crew]?.short} installing` : '', early ? `${(s.rooms[PRACTICE] || []).flatMap((r) => r.surfaces).reduce((n, x) => n + (x.sf || 0), 0)} SF` : `${job?.pct ?? 0}% done`, `contract ${fmtMoney(job?.contract || 0)}`, ipo ? `his PO ${fmtMoney(ipo.lines.reduce((n, l) => n + l.amount, 0))}` : ''].filter(Boolean).join(' · ')}</span>
            </span>
            <Button size="sm" icon={<ArrowRight />} onClick={() => s.open({ t: 'job', id: PRACTICE })}>Open it</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 />} className="text-bad-600 hover:bg-bad-50" onClick={removePractice}>Remove the practice project</Button>
          </div>
          {steps.map((x) => (
            <div key={x.title} className="flex items-start gap-3 border-t border-line-2 px-5 py-3.5 max-sm:flex-wrap max-sm:px-4">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5625rem] bg-wash-2 text-ink-2"><x.icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.875rem] font-semibold text-ink">{x.title}</span>
                <span className="block text-[0.8125rem] leading-snug text-muted">{x.sub}</span>
              </span>
              <Button size="sm" className={cn('shrink-0 max-sm:ml-11')} onClick={x.run}>{x.btn}</Button>
            </div>
          ))}
          {REAL.admin && <div className="border-t border-line-2 px-5 py-2.5 text-[0.78125rem] text-muted max-sm:px-4">Seeing it as someone else? “Back to me” is on the bar on top{' '}<button className="font-semibold text-brand-700 hover:underline" onClick={backToMe}>— or here</button>.</div>}
        </>
      )}
    </Card>
  )
}
