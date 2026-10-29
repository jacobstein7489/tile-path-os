/* Job details — the right side of the project, there at any time: what goes on this job. Read only — it's what was
 * approved; a change goes through a change order, and what's still open is picked on its track on the left.
 *   Scope of work — every room from the approved estimate and where it really is: ready, not ready (and why),
 *                   installing (how far), stopped, done
 *   Tiles         — every tile with its picture, where it goes, its grout and joint
 *   People        — the client and their contact, the designer, the installer, our site manager; the dates
 *   Documents     — the latest tile paperwork, the plans, the spec book, photos — open right here */
import * as React from 'react'
import { sheetRooms, RoomSheets } from '../roomsheets'
import { Camera, Check, ChevronDown, ChevronRight, FileText, Upload, Paperclip, Package, History, Phone, Mail, CalendarDays, Lock, Printer, Pencil, Plus, Search, MessageCircle, HardHat, Image as ImageIcon } from 'lucide-react'
import { useStore, meOf, addHist, type Store } from '@/tileos/store'
import { Avatar, Segmented } from '@/tileos/components/ui/core'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, crewInfo, type Job, type PersonKey, type Reach } from '@/tileos/data/model'
import { GROUTS, byTag, filesFor, tilesOf, surfacePct, floorsOf, type Tile } from '@/tileos/data/jobs'
import { METHODS } from '@/tileos/data/takeoff'
import { methodOf } from '../takeoff'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { timeLabel } from '@/tileos/data/calendar'
import { keepFiles, filesOfDoc } from '@/tileos/lib/files'
import { useSaveStatus } from '@/tileos/lib/save'
import { stepsFor, paperQty, takesTile, IN_FIELD_STAGES } from '../steps'
import { installerOf } from '../upcoming'
import { Circle, HEAD_ROW, BAND } from '@/tileos/components/ui/page'
import { roomsOf, ROOM_WORD, STEP_SHORT, type RoomView, type RoomCheck, type ChipTone } from '../tracks'
import { roomMedia } from '../field'
import { poRatio } from '../poratio'
import { TODO, todoOf } from '../stepwin'
import type { BoardView } from './board'
import { ScopeDoc } from './scopedoc'
import { printNode } from '@/tileos/lib/print'
import { Button } from '@/tileos/components/ui/core'
import { Menu, MenuItem } from '@/tileos/components/ui/overlay'

/** a part of the job: its title (and what it is) on the left, its links on the right — then one white sheet */
function Part({ title, sub, right, children, id }: { title: string; sub?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <section data-detail={id} className="px-5 pb-8 pt-4 max-sm:px-3">
      <header className="mb-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-[1rem] font-semibold text-ink">{title}</h3>
        {sub && <span className="min-w-0 truncate text-[0.8125rem] text-muted">{sub}</span>}
        {right && <span className="ml-auto flex shrink-0 items-center gap-1">{right}</span>}
      </header>
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white px-3 py-2 shadow-card">{children}</div>
    </section>
  )
}
const LINK = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50'

export type JobTab = 'scope' | 'people' | 'files'
/** the job, one section at a time — no long scroll: Scope of work · Tiles · People · Documents */
/** one part of the job, full width under the project's tabs: the scope of work (every room and its walls and floors),
 *  the tiles, the people, the documents */
export function JobPart({ job, open, tab, onStep }: { job: Job; open: (v: BoardView) => void; tab: JobTab; /** something still open: the step on its track that gets it */ onStep?: (k: string) => void }) {
  return (
    <div data-details data-job-tab={tab} className="@container min-w-0">
      {tab === 'scope' ? <ScopePart job={job} open={open} /> : tab === 'people' ? <PeoplePart job={job} open={open} onStep={onStep} /> : <DocsPart job={job} open={open} onStep={onStep} />}
    </div>
  )
}

/* ---------------- Scope of work: a plain list ----------------
 * Each room with where it is (ready, what it waits on, how far the crew is, done) — tap it for its page (walls and
 * floors, the daily log, photos). Under it every wall and floor, one line: what it is, its tile, its square feet (and how
 * far it is, once the crew is in). The grout, the layout, what it's set on are inside — tap the line. One Print (the
 * scope of work or the room sheets) and one Edit. Change orders, if there are any, under the rooms. The paper look is
 * for printing only. */
function roomWord(r: RoomView): { text: string; cls: string } {
  if (r.state === 'done') return { text: 'Done', cls: 'font-medium text-[#2c8a5b]' }
  if (r.state === 'installing') return { text: `${r.pct}% in`, cls: 'text-ink-2' }
  if (r.state === 'ready') return { text: 'Ready', cls: 'font-medium text-[#2c8a5b]' }
  const c = r.chips[0]
  if (!c) return { text: r.state === 'notstarted' ? 'Not started' : '', cls: 'text-muted' }
  return { text: c.text, cls: c.tone === 'bad' ? 'font-medium text-bad-600' : c.tone === 'warn' ? 'text-warn-700' : 'text-muted' }
}
/** wall or floor · its tile · SF · (how far) */
const SURF_COLS = 'grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_5rem] items-center gap-x-6 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3'
const SURF_COLS_FIELD = 'grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_5rem_5.5rem] items-center gap-x-6 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-3'
/** one Print: the scope of work, or the room sheets to hang in each room */
function PrintMenu({ job }: { job: Job }) {
  const s = useStore()
  const [what, setWhat] = React.useState<'scope' | 'sheets' | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const n = sheetRooms(s, job.id).length
  React.useEffect(() => {
    if (!what) return
    const t = setTimeout(() => {
      printNode(what === 'sheets' ? (ref.current?.firstElementChild as HTMLElement | null) : ref.current)
      if (what === 'sheets') s.commit((st) => { addHist(st, job.id, { who: meOf(st.role), kind: 'setup', title: `Hang room sheets: printed — ${n} room${n === 1 ? '' : 's'}` }) }, undefined, { undo: false })
      setWhat(null)
    }, 60)
    return () => clearTimeout(t)
  }, [what])
  return (
    <>
      <Menu align="end" width={240} trigger={<Button size="sm" icon={<Printer />} data-print-menu>Print<ChevronDown className="-mr-1 h-3.5 w-3.5 text-faint" /></Button>}>
        <MenuItem icon={<FileText className="h-4 w-4" />} onSelect={() => setWhat('scope')}>The scope of work</MenuItem>
        <MenuItem icon={<Printer className="h-4 w-4" />} onSelect={() => n && setWhat('sheets')} hint={n ? `${n} room${n === 1 ? '' : 's'} — one in each` : 'Once the tile is in'}>The room sheets</MenuItem>
      </Menu>
      {what === 'scope' && <div className="hidden"><ScopeDoc jobId={job.id} innerRef={ref} /></div>}
      {what === 'sheets' && <div className="hidden" ref={ref}><RoomSheets job={job} /></div>}
    </>
  )
}
function ScopePart({ job, open }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const steps = stepsFor(s, job)
  const rooms = roomsOf(s, job, steps)
  const inField = IN_FIELD_STAGES.includes(job.stage)
  const sf = rooms.reduce((n, r) => n + r.sf, 0)
  const confirmed = ['done', 'na'].includes(steps.find((v) => v.key === 'change')?.state || '') || inField
  const canEdit = ['owner', 'pm', 'office', 'estimator'].includes(s.role)
  /* a change to the scope goes through a change order — started here, whether or not there are any yet */
  const canChange = s.role !== 'accounting' && s.role !== 'client'
  const cols = inField ? SURF_COLS_FIELD : SURF_COLS
  const groups = floorsOf(rooms.map((r) => r.room))
  const floors = groups.length > 1 || (groups[0] && groups[0].floor !== 'Rooms')
  const viewOf = (name: string) => rooms.find((r) => r.room.name === name)!
  return (
    <section data-detail="scope" className="px-5 pb-8 pt-4 max-sm:px-3">
      <header className="mb-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-[1rem] font-semibold text-ink">Scope of work</h3>
        {rooms.length > 0 && <span className="text-[0.8125rem] text-muted">{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}{sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}</span>}
        {rooms.length > 0 && confirmed && <span data-scope-locked title="Set — a change goes through a change order" className="inline-flex items-center gap-1 text-[0.8125rem] text-muted"><Lock className="h-3.5 w-3.5 text-faint" />Set</span>}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {rooms.length > 0 && <PrintMenu job={job} />}
          {rooms.length > 0 && canEdit && <Button size="sm" icon={<Pencil />} onClick={() => open({ t: 'scope' })} data-edit-walls>Edit</Button>}
          {rooms.length > 0 && canChange && <Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'sitechange', jobId: job.id })} data-new-change>Change order</Button>}
        </span>
      </header>
      {!rooms.length && <div className="rounded-xl border border-dashed border-[#d6cfc3] bg-white px-4 py-3 text-[0.84375rem] text-muted">No rooms yet — they come from the approved estimate.</div>}
      {rooms.length > 0 && (
        <div data-paper className="overflow-clip rounded-[0.875rem] border border-line bg-white">
          {/* the column names, then each room as a band with its walls and floors under it — every line the same */}
          <div className={cn(HEAD_ROW, cols, 'px-5 max-md:hidden')}>
            <span>Wall or floor</span><span>Tile</span><span className="text-right">SF</span>{inField && <span className="text-right">Done</span>}
          </div>
          {groups.map((g) => (
            <section key={g.floor}>
              {floors && <div className="flex h-9 items-center border-t border-line bg-[#e9e9e6] px-5 text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-ink-2 max-sm:px-3">{g.floor}</div>}
              {g.rooms.map((room) => {
                const r = viewOf(room.name)
                const w = roomWord(r)
                return (
                  <div key={room.name} data-room={room.name} data-room-state={r.state}>
                    <button onClick={() => open({ t: 'room', name: room.name })} data-room-head className={cn(BAND, 'group w-full min-w-0 gap-3 px-5 text-left max-sm:px-3')}>
                      <span className="min-w-0 truncate text-[0.8125rem] font-semibold text-ink group-hover:text-brand-700">{room.name}</span>
                      {r.sf > 0 && <span className="shrink-0 text-[0.8125rem] tnum text-faint">{r.sf.toLocaleString('en-US')} SF</span>}
                      <span data-room-why className={cn('ml-auto min-w-0 truncate text-right text-[0.8125rem]', w.cls)} title={r.chips.map((c) => c.text).join(' · ')}>{w.text}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                    </button>
                    {room.surfaces.map((x) => {
                      const t = tilesOf(job.id).find((y) => y.tag === x.tile)
                      const pct = surfacePct(x)
                      const stopped = ['blocked', 'waitmat', 'hold'].includes(x.state)
                      return (
                        <button key={x.name} data-surface-row={x.name} onClick={() => open({ t: 'room', name: room.name, surface: x.name })} title="Its tile, grout, layout and what it’s set on" className={cn(cols, 'w-full border-t border-line-2 px-5 py-2 text-left text-[0.8125rem] transition row-hover max-sm:px-3')}>
                          <span className="min-w-0 truncate text-[0.875rem] text-ink">{x.name}</span>
                          <span className="flex min-w-0 items-center gap-2 max-md:col-span-2 max-md:row-start-2">
                            {t ? <TileImg tile={t} size={20} radius={4} /> : null}
                            <span className={cn('min-w-0 truncate', t ? 'text-ink-2' : 'text-muted')}>{t ? <><span className="font-medium text-ink">{t.tag}</span> {t.name}{t.size ? <span className="text-muted"> · {t.size}</span> : null}</> : takesTile(x.name) ? (x.tile || 'No tile yet') : 'Not tiled'}</span>
                          </span>
                          <span className={cn('text-right tnum max-md:row-start-1 max-md:col-start-2', x.sf ? 'text-ink-2' : 'text-faint')}>{x.sf ? `${x.sf.toLocaleString('en-US')} SF` : '—'}</span>
                          {inField && <span className={cn('text-right max-md:hidden', x.state === 'done' ? 'font-medium text-[#2c8a5b]' : stopped ? 'font-medium text-bad-600' : x.state === 'working' ? 'text-ink-2' : 'text-muted')}>{x.state === 'done' ? 'Done' : x.state === 'working' ? `${pct}%` : stopped ? 'Stopped' : 'Not yet'}</span>}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </section>
          ))}
        </div>
      )}
      <ChangeOrders job={job} />
    </section>
  )
}

/** change orders on the job — what changed from the contract, and where each one is (the amounts are in Billing).
 *  Nothing shows when there are none. */
function ChangeOrders({ job }: { job: Job }) {
  const s = useStore()
  const money = !['site', 'crew', 'client'].includes(s.role)
  const list = s.money.filter((m) => m.jobId === job.id && m.kind === 'change')
  if (!list.length) return null
  return (
    <div data-changes className="mt-4 overflow-hidden rounded-[0.875rem] border border-line bg-white">
      <header className="flex items-baseline gap-2 px-5 pb-2.5 pt-3.5 max-sm:px-3">
        <h4 className="text-[0.9375rem] font-semibold text-ink">Change orders</h4>
        <span className="text-[0.8125rem] font-medium tnum text-faint">{list.length}</span>
      </header>
      {list.map((m) => {
        const words = m.state === 'paid' ? { t: 'Paid', c: 'text-[#2c8a5b]' } : m.step < 0 ? { t: 'Waiting for the client’s OK', c: 'text-warn-700' } : m.step >= 1 ? { t: 'Billed', c: 'text-ink-2' } : { t: 'Approved', c: 'text-[#2c8a5b]' }
        const where = m.meta ? [m.meta.room, m.meta.surface].filter(Boolean).join(' · ') : ''
        return (
          <button key={m.id} data-change={m.id} onClick={() => (money ? s.open({ t: 'money', id: m.id }) : undefined)} disabled={!money} title={[m.ref, where, m.meta?.from && m.meta?.to ? `${m.meta.from} → ${m.meta.to}` : ''].filter(Boolean).join(' · ') || undefined} className="flex w-full min-w-0 items-center gap-4 border-t border-line-2 px-5 py-2.5 text-left transition enabled:row-hover max-sm:px-3">
            <span className="min-w-0 flex-1 truncate text-[0.875rem] text-ink">{m.title}</span>
            <span className={cn('shrink-0 text-[0.8125rem]', words.c)}>{words.t}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- People: everyone on the job, to reach out to ---------------- */
type Reachable = { phone?: string; email?: string; more?: Reach[] }
const telHref = (v: string) => `tel:${v.replace(/ext.*$/i, '').replace(/[^\d+]/g, '')}`
const smsHref = (v: string) => `sms:${v.replace(/ext.*$/i, '').replace(/[^\d+]/g, '')}`
/** the round buttons on the right: call, text, email — each only when there's a number or an address */
function ReachButtons({ r, who, onMessage }: { r: Reachable; who: string; onMessage?: () => void }) {
  const phone = r.phone || r.more?.find((x) => x.kind === 'phone' && x.value)?.value
  const email = r.email || r.more?.find((x) => x.kind === 'email' && x.value)?.value
  const btn = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-brand-50 hover:text-brand-700 [&_svg]:h-4 [&_svg]:w-4'
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {onMessage && <button onClick={onMessage} aria-label={`Message ${who}`} title="Message on this project" className={btn}><MessageCircle /></button>}
      {phone && <a href={telHref(phone)} aria-label={`Call ${who}`} title={`Call ${phone}`} className={btn}><Phone /></a>}
      {phone && <a href={smsHref(phone)} aria-label={`Text ${who}`} title={`Text ${phone}`} className={cn(btn, 'max-sm:hidden')}><MessageCircle /></a>}
      {email && <a href={`mailto:${email}`} aria-label={`Email ${who}`} title={`Email ${email}`} className={btn}><Mail /></a>}
    </span>
  )
}
/** a person on the job, one line: who (initials in a circle) · what they are on this job · the buttons to reach them
 *  (call, text, email — the number and the address show when you point at them). On a phone what they are goes under
 *  the name. */
function Contact({ initials, who, name, role, r, sub, onName, onMessage, tone }: { initials?: string; who?: PersonKey; name: string; role: string; r: Reachable; sub?: React.ReactNode; onName?: () => void; onMessage?: () => void; tone?: string }) {
  return (
    <div data-person={role} className="flex min-h-[3.25rem] min-w-0 items-center gap-3 border-t border-line-2 px-5 py-2 max-sm:px-3">
      {who ? <Avatar who={who} size={28} /> : <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold', tone || 'bg-[#ece8e1] text-[#4a5361]')}>{initials}</span>}
      <span className="flex min-w-0 flex-1 items-baseline gap-3 max-md:flex-col max-md:gap-0">
        {onName ? <button onClick={onName} className="max-w-full shrink-0 truncate text-left text-[0.875rem] font-semibold text-ink hover:text-brand-700">{name}</button> : <span className="max-w-full shrink-0 truncate text-[0.875rem] font-semibold text-ink">{name}</span>}
        <span className="flex min-w-0 items-baseline gap-1.5 text-[0.8125rem] text-muted max-md:text-[0.75rem]"><span className="shrink-0">{role}</span>{sub && <><span className="shrink-0 text-faint">·</span><span className="min-w-0 truncate">{sub}</span></>}</span>
      </span>
      <ReachButtons r={r} who={name} onMessage={onMessage} />
    </div>
  )
}
/** the installer's PO, under his name — where it is, what it comes to against our estimate (for whoever sees money),
 *  his days; tap it to open the PO, or send one when there's none yet */
function InstallerPO({ job }: { job: Job }) {
  const s = useStore()
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const money = !['site', 'crew', 'client'].includes(s.role)
  const b = s.bookings.find((x) => x.jobId === job.id && x.label !== 'Return visit')
  if (!ipo) return <button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} data-installer-po="none" className="truncate text-left font-medium text-warn-700 hover:underline">No PO yet — send it</button>
  const r = poRatio(s, ipo)
  const word = ipo.status === 'Accepted' ? 'accepted' : ipo.status === 'Sent' ? 'waiting for his yes' : ipo.status === 'Rejected' ? 'turned down' : 'not sent'
  return (
    <button onClick={() => s.open({ t: 'ipo', id: ipo.id })} data-installer-po={ipo.id} title={[money && r.total && r.sold ? `${r.pct}% of our estimate` : '', b ? `${labelFromIso(b.start)} – ${labelFromIso(b.end)}` : ''].filter(Boolean).join(' · ') || undefined} className="max-w-full truncate text-left text-ink-2 hover:text-brand-700">
      PO {ipo.id} · {word}{money && r.total ? <> · <span className={r.over ? 'font-semibold text-bad-600' : ''}>{fmtMoney(r.total)}</span></> : null}
    </button>
  )
}
const initialsOf = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
function PeoplePart({ job, open, onStep }: { job: Job; open: (v: BoardView) => void; onStep?: (k: string) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const client = s.clients[job.clientId]
  const designer = s.designers.find((d) => d.clients.includes(job.clientId))
  const crew = installerOf(s, job) || (job.crew as PersonKey | undefined)
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const b = s.bookings.find((x) => x.jobId === job.id)
  const start = job.dates?.start || (b ? labelFromIso(b.start) : s.prep[job.id]?.targetISO ? labelFromIso(s.prep[job.id]!.targetISO!) : undefined)
  const finish = job.dates?.finish || (b ? labelFromIso(b.end) : undefined)
  const next = s.events.filter((e) => e.jobId === job.id && e.date >= TODAY).sort((a, b2) => (a.date + a.start).localeCompare(b2.date + b2.start))[0]
  /* the stores on the job: who sends the tile, who our materials come from */
  const storeNames = Array.from(new Set([...Object.values(s.tiles[job.id] || {}).map((t) => t.supplier).filter(Boolean) as string[], ...s.pos.filter((p) => p.jobId === job.id).map((p) => p.supplier)]))
  const stores = storeNames.map((n) => ({ name: n, info: s.suppliers.find((x) => x.name === n) }))
  /* ours: whoever has something open on this job — what it is, so you know why you'd call */
  const steps = stepsFor(s, job).filter((v) => v.state === 'now' || v.state === 'bad' || v.state === 'wait')
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done' && !t.step)
  const ours = Array.from(new Set([...steps.map((v) => v.owner), ...tasks.map((t) => t.owner)])).filter((p) => p && PEOPLE[p] && p !== crew)
  const memberOf = (p: PersonKey) => s.team.find((m) => m.key === p)
  const crewReach = crew ? { phone: crewInfo[crew]?.phone || memberOf(crew)?.phone, email: crewInfo[crew]?.email || memberOf(crew)?.email, more: crewInfo[crew]?.more || memberOf(crew)?.more } : {}
  const chat = () => open({ t: 'chat' })
  return (
    <section data-detail="people" className="px-5 pb-8 pt-4 max-sm:px-3">
      <header className="mb-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-[1rem] font-semibold text-ink">People</h3>
      </header>
      {/* one list: the client and their people, the designer, the installer, the stores, then ours — what each one is
          says it, no headings between them */}
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white [&>[data-person]:first-child]:border-t-0" data-contacts>
        <Contact initials={initialsOf(job.client)} tone="bg-[#e3ece6] text-[#2c4a3e]" name={job.client} role="Client" r={{ phone: client?.phone, email: client?.email, more: client?.more }} onName={() => s.open({ t: 'customer', id: job.clientId })} />
        {(client?.contacts || []).map((c) => <Contact key={c.name} initials={initialsOf(c.name)} name={c.name} role={c.role || 'Contact'} r={c} />)}
        {designer && <Contact initials={initialsOf(designer.name)} tone="bg-[#efe6f6] text-[#5b2f86]" name={designer.name} role="Designer" r={designer} sub={designer.contact && !/^designer$/i.test(designer.contact) && designer.contact !== designer.name ? designer.contact : undefined} onName={() => s.open({ t: 'designer', id: designer.id })} />}
        {crew
          ? <Contact who={crew} name={PEOPLE[crew]?.name || crew} role="Installer" r={crewReach} sub={<InstallerPO job={job} />} onName={() => s.open({ t: 'installerwin', jobId: job.id })} />
          : <div data-person="Installer" className="flex min-h-[3.25rem] items-center gap-3 border-t border-line-2 px-5 py-2 text-[0.8125rem] max-sm:px-3"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-[#d1cbc0] text-faint"><HardHat className="h-3.5 w-3.5" /></span><span className="text-muted">Installer — not picked yet</span><button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} className={cn(LINK, 'ml-auto')}>Pick</button></div>}
        {stores.map((x) => <Contact key={x.name} initials={initialsOf(x.name)} tone="bg-[#f6ecdc] text-[#7a4a0c]" name={x.name} role="Supplier" r={x.info || {}} sub={x.info?.supplies} />)}
        {ours.map((p) => {
          const mine = steps.filter((v) => v.owner === p)
          const theirs = tasks.filter((t) => t.owner === p)
          const what = [...mine.map((v) => todoOf(v)), ...theirs.map((t) => t.title)]
          const m = memberOf(p)
          return (
            <Contact
              key={p}
              who={p}
              name={p === me ? 'You' : PEOPLE[p]?.name || p}
              role={PEOPLE[p]?.roleLabel || 'Team'}
              r={{ phone: m?.phone, email: m?.email, more: m?.more }}
              sub={what.length ? <button onClick={() => (mine[0] ? onStep?.(mine[0].key) : theirs[0] && s.open({ t: 'task', id: theirs[0].id }))} title={what.join(' · ')} className="max-w-full truncate text-left hover:text-brand-700">{what.length} open</button> : undefined}
              onMessage={p !== me ? chat : undefined}
            />
          )
        })}
      </div>
    </section>
  )
}

/* ---------------- Documents ---------------- */
function DocsPart({ job, open, onStep }: { job: Job; open: (v: BoardView) => void; onStep?: (k: string) => void }) {
  const s = useStore()
  const save = useSaveStatus()
  const files = s.files.filter((f) => f.jobId === job.id)
  const sample = save.mode === 'sample' && save.where !== 'cloud' ? filesFor(job.id).filter((d) => d.current) : []
  const add = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const upload = async (list: File[]) => {
    if (!list.length) return
    setBusy(true)
    const photos = list.filter((f) => f.type.startsWith('image/'))
    const other = list.filter((f) => !f.type.startsWith('image/'))
    if (photos.length) await keepFiles(job.id, photos, 'photo')
    if (other.length) await keepFiles(job.id, other, /paperwork|selection|tile/i.test(other[0].name) ? 'paperwork' : /plan|drawing|arch/i.test(other[0].name) ? 'plans' : 'other')
    setBusy(false)
  }
  /* the latest of each kind first: the tile paperwork, the plans, the spec book — then the rest */
  const last = <T,>(l: T[]) => l[l.length - 1]
  const paper = last(files.filter((f) => f.kind === 'paperwork'))
  const plans = last(files.filter((f) => f.kind === 'plans' || f.doc === 'Plans'))
  const spec = last(files.filter((f) => f.doc === 'Spec book'))
  const photos = files.filter((f) => f.kind === 'photo')
  const top = [paper, plans, spec].filter(Boolean) as typeof files
  const rest = files.filter((f) => !top.includes(f) && f.kind !== 'photo').slice(-3).reverse()
  const n = files.length + sample.length
  const row = 'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f6f3ee]'
  /* the papers the job has by name — each one here (tap to open it) or missing; never a step */
  const rooms = s.rooms[job.id] || []
  const sf = rooms.reduce((a, r) => a + r.surfaces.reduce((b, x) => b + (x.sf || 0), 0), 0)
  const asked = s.pricing[job.id]?.docs || []
  const tiles = Object.keys(s.tiles[job.id] || {}).length
  const sampleOf = (k: string) => sample.find((d) => d.kind === k)
  const sp = sampleOf('paperwork')
  type Paper = { name: string; here: boolean; sub: string; go: () => void }
  const NAMED: [string, string][] = [['Plans', 'plans'], ['Spec book', 'spec'], ['Finish schedule', 'finish']]
  const papers: Paper[] = [
    { name: 'Tile paperwork', here: !!paper || !!sp, sub: paper ? `${paper.name} · ${paper.at}` : sp ? `${sp.name} · ${sp.date}` : tiles ? `${tiles} ${tiles === 1 ? 'tile' : 'tiles'} entered — no file kept · tap to add it` : 'missing — tap to add it', go: () => (paper ? open({ t: 'doc', doc: 'Tile paperwork' }) : sp ? open({ t: 'files' }) : open({ t: 'doc', doc: 'Tile paperwork' })) },
    ...(rooms.length ? [{ name: 'Scope of work', here: true, sub: `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}`, go: () => open({ t: 'scope' }) }] : []),
    ...NAMED.flatMap(([doc, kind]): Paper[] => {
      const a = asked.find((d) => d.name === doc)
      const f = last(filesOfDoc(files, job.id, doc))
      const smp = sampleOf(kind)
      if (!a && !f && !smp) return []
      const here = !!f || !!smp || (!!a && a.status !== 'missing')
      return [{ name: doc, here: !!f || !!smp, sub: f ? `${f.name} · ${f.at}` : smp ? `${smp.rev} · ${smp.date}` : a && a.status !== 'missing' ? `${a.note || 'Came in'} — no file kept · tap to add it` : 'missing — tap to add it', go: () => (!f && smp ? open({ t: 'files' }) : open({ t: 'doc', doc })) }]
    }),
    ...asked.filter((d) => !NAMED.some(([x]) => x === d.name)).map((d) => { const f = last(filesOfDoc(files, job.id, d.name)); return { name: d.name, here: !!f, sub: f ? `${f.name} · ${f.at}` : d.status === 'missing' ? 'missing — tap to add it' : `${d.note || 'Came in'} — no file kept · tap to add it`, go: () => open({ t: 'doc', doc: d.name }) } }),
  ]
  const namedKinds = ['paperwork', 'plans', 'spec', 'finish']
  const named = new Set([...files.filter((f) => f.kind === 'paperwork').map((f) => f.id), ...NAMED.flatMap(([d]) => filesOfDoc(files, job.id, d).map((f) => f.id)), ...asked.flatMap((d) => filesOfDoc(files, job.id, d.name).map((f) => f.id))])
  const kindWord = (f: (typeof files)[number]) => (f.kind === 'paperwork' ? 'Tile paperwork' : f.doc || (f.kind === 'plans' ? 'Plans' : 'File'))
  return (
    <Part
      id="docs"
      title="Documents"
      right={<>{n > 0 && <button onClick={() => open({ t: 'files' })} className={LINK}>All {n}</button>}<button onClick={() => add.current?.click()} disabled={busy} className={LINK}><Upload className="h-3.5 w-3.5" />{busy ? 'Adding…' : 'Add'}</button></>}
    >
      <input ref={add} type="file" multiple className="hidden" aria-label="Add files — Documents" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void upload(f) }} />
      <div className="-mx-2 mb-1.5 border-b border-line-2 pb-1.5" data-papers>
        {papers.map((d) => (
          <button key={d.name} onClick={d.go} data-paper={d.name} data-here={d.here || undefined} className={row}>
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md', d.here ? 'bg-brand-50 text-brand-600' : 'border border-dashed border-warn-300 bg-[#fffaf0] text-warn-700')}>{d.here ? <FileText className="h-4 w-4" /> : <Upload className="h-3.5 w-3.5" />}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-semibold text-ink"><span className="truncate">{d.name}</span>{d.here && <Check className="h-3.5 w-3.5 shrink-0 text-ok-600" strokeWidth={3} />}</span>
              <span className={cn('block truncate text-[0.71875rem]', d.here ? 'text-muted' : 'font-medium text-warn-700')}>{d.sub}</span>
            </span>
            {d.here && <ChevronRight className="h-4 w-4 shrink-0 text-faint" />}
          </button>
        ))}
      </div>
      {n === 0 && <button onClick={() => add.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d6cfc3] py-3 text-[0.8125rem] font-medium text-muted hover:border-brand-300 hover:text-brand-700"><Paperclip className="h-4 w-4" />Photos and other files</button>}
      <div className="-mx-2">
        {[...top, ...rest].filter((f) => !named.has(f.id)).map((f) => (
          <button key={f.id} onClick={() => open({ t: 'file', id: f.id })} title={f.name} className={row}>
            {f.thumb ? <img src={f.thumb} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" /> : <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wash text-[0.5625rem] font-bold uppercase text-muted">{(f.name.split('.').pop() || f.kind).slice(0, 4)}</span>}
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.8125rem] font-medium text-ink">{f.name}</span>
              <span className="block truncate text-[0.71875rem] text-muted">{kindWord(f)} · {f.at}</span>
            </span>
          </button>
        ))}
        {files.length < 3 && sample.filter((d) => !namedKinds.includes(d.kind)).slice(0, 4 - files.length).map((d) => (
          <button key={d.name} onClick={() => open({ t: 'files' })} title={d.name} className={row}>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-wash text-muted"><FileText className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.8125rem] font-medium text-ink">{d.name}</span>
              <span className="block truncate text-[0.71875rem] text-muted">{d.rev} · {d.date}</span>
            </span>
          </button>
        ))}
        {photos.length > 0 && (
          <button onClick={() => open({ t: 'files' })} className={row}>
            <span className="flex shrink-0 -space-x-2">{photos.slice(-3).map((p) => p.thumb ? <img key={p.id} src={p.thumb} alt="" className="h-8 w-8 rounded-md object-cover ring-2 ring-white" /> : <span key={p.id} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-wash ring-2 ring-white"><ImageIcon className="h-3.5 w-3.5 text-faint" /></span>)}</span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">{photos.length} {photos.length === 1 ? 'photo' : 'photos'}</span>
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-1 gap-y-1 border-t border-line-2 pt-2">
        <button onClick={() => open({ t: 'log' })} className={LINK}><History className="h-3.5 w-3.5" />What happened</button>
      </div>
    </Part>
  )
}
