/* Job details — the right side of the project, there at any time: what goes on this job. Read only — it's what was
 * approved; a change goes through a change order, and what's still open is picked on its track on the left.
 *   Scope of work — every room from the approved estimate and where it really is: ready, not ready (and why),
 *                   installing (how far), stopped, done
 *   Tiles         — every tile with its picture, where it goes, its grout and joint
 *   People        — the client and their contact, the designer, the installer, our site manager; the dates
 *   Documents     — the latest tile paperwork, the plans, the spec book, photos — open right here */
import * as React from 'react'
import { sheetRooms, RoomSheets, coverageOf } from '../roomsheets'
import { DOC_GRAY } from '../docpaper'
import { Camera, Check, ChevronDown, ChevronRight, MoveVertical, MoreHorizontal, FileText, Upload, Mic, Paperclip, Package, History, Phone, Mail, CalendarDays, Lock, Printer, Pencil, Plus, Search, MessageCircle, MessageSquareText, HardHat, LayoutGrid, Palette, Trash2, ArrowUpRight, Image as ImageIcon } from 'lucide-react'
import { useStore, meOf, addHist, type Store } from '@/tileos/store'
import { Avatar, Segmented } from '@/tileos/components/ui/core'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, crewInfo, type Job, type PersonKey, type Reach } from '@/tileos/data/model'
import { GROUTS, byTag, filesFor, tilesOf, tileOf, tilesOn, surfacePct, floorsOf, type Tile, type Room, type Surface } from '@/tileos/data/jobs'
import { METHODS } from '@/tileos/data/takeoff'
import { methodOf } from '../takeoff'
import { TODAY, labelFromIso } from '@/tileos/lib/today'
import { timeLabel } from '@/tileos/data/calendar'
import { keepFiles, filesOfDoc } from '@/tileos/lib/files'
import { useSaveStatus } from '@/tileos/lib/save'
import { stepsFor, paperQty, takesTile, scopeLock, IN_FIELD_STAGES } from '../steps'
import { installerOf } from '../upcoming'
import { Circle, HEAD_ROW, BAND } from '@/tileos/components/ui/page'
import { roomsOf, ROOM_WORD, STEP_SHORT, type RoomView, type RoomCheck, type ChipTone } from '../tracks'
import { roomMedia } from '../field'
import { poRatio } from '../poratio'
import { TODO, todoOf } from '../stepwin'
import type { BoardView } from './board'
import { ScopeDoc } from './scopedoc'
import { RoomScope, plainLines } from './roomscope'
import { firstName, PaperBar, FloorBand, PAPER, PAPER_ROW, ROOM_BAND, ROOM_NAME, PIC_LG, PIC_SM } from './kit'
import { printNode } from '@/tileos/lib/print'
import { useSmall } from '@/tileos/lib/phone'
import { Button } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuSep } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { designerOf, NO_DESIGNER } from '@/tileos/data/directory'
import { setJobDesigner, addDesignerNamed, removeJobContact } from '../jobcontacts'
import { edgeWords, parseMetal, finishOf, profileOf, edgeKind } from '@/tileos/data/catalog'
import { isWall } from '../heights'
import { detailsOf, setRoomDetails, surfaceDetailLines, edgeShort } from '../roomdetails'
import { PaperPanel, usePaperPicker, usePaperReview } from '../paperread'
import { ScopeStart } from './scope-tab'
import { RoomMenu, RoomLines, ScopeAreaAdder } from '../roomedit'
import { tickSurface, isTiled, isGrouted, partPct } from '../progress'

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

/* ---------------- Scope of work: the scope, its tiles and its layouts on one page ----------------
 * Like Cobblestone's own scope of work: room by room, every room open — nothing to open, nothing that jumps. Each room
 * in a light band: its name and short note (FLOOR ONLY), where it stands and its square feet; tap it for the room's
 * daily log and photos. Under it each wall and floor on its own line, with its tile's picture: what it is (which walls,
 * how high), and under it the tile and size, how it's laid, the grout, the edge, its note — the same two lines as Today.
 * Tap a line for its window: the one place to change it. A wall or floor with no tile says "Pick its tile". What isn't a
 * wall or floor (1 niche, a saddle) is a note under them. The tile paperwork is read in here. One Print. Whoever builds
 * the scope changes a room from its ··· (a note, its walls and floors, its floor, its note); a room is added at the
 * bottom. Change orders, if there are any, under the rooms. */
function roomWord(r: RoomView): { text: string; cls: string } {
  if (r.state === 'done') return { text: 'Done', cls: 'font-medium text-[#2c8a5b]' }
  if (r.state === 'installing') return { text: `${r.pct}% in`, cls: 'text-ink-2' }
  if (r.state === 'ready') return { text: 'Ready', cls: 'font-medium text-[#2c8a5b]' }
  const c = r.chips[0]
  /* not started: nothing said — a quiet list, words only where something's going on */
  if (!c) return { text: '', cls: 'text-muted' }
  return { text: c.text, cls: c.tone === 'bad' ? 'font-medium text-bad-600' : c.tone === 'warn' ? 'text-warn-700' : 'text-muted' }
}
/** "Fully tiled", "48″ wainscot" — how high a wall goes, short */
/** how high, short — the height itself: "Half tiled, to 4 ft" → "To 4 ft", "Fully tiled, to the ceiling" → "To the
 *  ceiling"; "Wet walls only, to the ceiling" keeps which walls */
const heightShort = (h?: string) => {
  if (!h) return ''
  const [a, b] = h.split(/\s+[—·]\s+|\.\s+(?=[A-Z])|,\s+(?=to\b)/i).map((x) => x.trim())
  if (!b) return a
  return /^(fully|half) tiled$/i.test(a) ? b.charAt(0).toUpperCase() + b.slice(1) : `${a}, ${b}`
}
/** printing the scope of work, or the room sheets to hang in each room — from Print (a computer) or the ··· (a phone) */
function usePrint(job: Job) {
  const s = useStore()
  const [what, setWhat] = React.useState<'scope' | 'sheets' | null>(null)
  const ref = React.useRef<HTMLDivElement>(null)
  const n = sheetRooms(s, job.id).length
  React.useEffect(() => {
    if (!what) return
    const t = setTimeout(() => {
      printNode(what === 'sheets' ? (ref.current?.firstElementChild as HTMLElement | null) : ref.current, `${job.name} · ${what === 'sheets' ? 'Room sheets' : 'Scope of work'}`)
      if (what === 'sheets') s.commit((st) => { addHist(st, job.id, { who: meOf(st.role), kind: 'setup', title: `Hang room sheets: printed · ${n} room${n === 1 ? '' : 's'}` }) }, undefined, { undo: false })
      setWhat(null)
    }, 60)
    return () => clearTimeout(t)
  }, [what])
  /* the scope of work to hang up: room by room, its details and its tiles with their pictures */
  const node = (
    <>
      {what === 'scope' && <div className="hidden"><RoomScope jobId={job.id} innerRef={ref} /></div>}
      {what === 'sheets' && <div className="hidden" ref={ref}><RoomSheets job={job} /></div>}
    </>
  )
  return { n, print: (w: 'scope' | 'sheets') => { if (w === 'scope' || n) setWhat(w) }, node }
}
/** one Print: the scope of work, or the room sheets to hang in each room */
function PrintMenu({ job }: { job: Job }) {
  const pr = usePrint(job)
  return (
    <>
      <Menu align="end" width={240} trigger={<Button size="sm" icon={<Printer />} data-print-menu>Print<ChevronDown className="-mr-1 h-3.5 w-3.5 text-faint" /></Button>}>
        <MenuItem icon={<FileText className="h-4 w-4" />} onSelect={() => pr.print('scope')}>The scope of work</MenuItem>
        <MenuItem icon={<Printer className="h-4 w-4" />} onSelect={() => pr.print('sheets')} hint={pr.n ? `${pr.n} room${pr.n === 1 ? '' : 's'}. One in each` : 'Once the tile is in'}>The room sheets</MenuItem>
      </Menu>
      {pr.node}
    </>
  )
}
/** a phone: the scope's one main button, and the rest in its ··· — one slim row, nothing cut off */
function ScopeMore({ job, canEdit, canChange, onPaper }: { job: Job; canEdit: boolean; canChange: boolean; onPaper: () => void }) {
  const s = useStore()
  const pr = usePrint(job)
  return (
    <>
      <Menu align="end" width={260} trigger={<Button icon={<MoreHorizontal />} aria-label="More for the scope" data-scope-more>More</Button>}>
        {canEdit && <MenuItem icon={<Upload className="h-4 w-4" />} onSelect={onPaper}>Tile paperwork</MenuItem>}
        <MenuItem icon={<FileText className="h-4 w-4" />} onSelect={() => pr.print('scope')}>Print the scope of work</MenuItem>
        <MenuItem icon={<Printer className="h-4 w-4" />} onSelect={() => pr.print('sheets')} hint={pr.n ? `${pr.n} room${pr.n === 1 ? '' : 's'}. One in each` : 'Once the tile is in'}>Print the room sheets</MenuItem>
        {canChange && canEdit && <MenuItem icon={<Plus className="h-4 w-4" />} onSelect={() => s.open({ t: 'sitechange', jobId: job.id })}>Change order</MenuItem>}
      </Menu>
      {pr.node}
    </>
  )
}
function ScopePart({ job }: { job: Job; open: (v: BoardView) => void }) {
  const s = useStore()
  const steps = stepsFor(s, job)
  const rooms = roomsOf(s, job, steps)
  const inField = IN_FIELD_STAGES.includes(job.stage)
  /* whoever has the scope (and the admin) builds it right here — anyone else asks for a change order */
  const canEdit = scopeLock(s, job.id).canEdit
  /* a change to the scope goes through a change order — started here, whether or not there are any yet */
  const canChange = s.role !== 'accounting' && s.role !== 'client'
  const groups = floorsOf(rooms.map((r) => r.room))
  const floors = groups.length > 1 || (groups[0] && groups[0].floor !== 'Rooms')
  const viewOf = (name: string) => rooms.find((r) => r.room.name === name)!
  /* a short list of rooms: each one a line with where it's up to — open one to see (and tick) its walls and floors.
     A few rooms: all open. More: the rooms the crew is working in open by themselves (a stopped one too — its problem
     shows), the rest one line each. Which are open is kept for next time (on this computer or phone) */
  const openKey = `tileos-scope-open:${job.id}`
  const [opened, setOpened] = React.useState<string[] | 'all'>(() => {
    try { const v = localStorage.getItem(openKey); if (v) return v === 'all' ? 'all' : (JSON.parse(v) as string[]) } catch { /* none kept */ }
    return rooms.length > 4 ? rooms.filter((r) => r.state === 'installing' || r.state === 'stopped').map((r) => r.room.name) : 'all'
  })
  const keepOpen = (v: string[] | 'all') => { setOpened(v); try { localStorage.setItem(openKey, v === 'all' ? 'all' : JSON.stringify(v)) } catch { /* not kept */ } }
  const isOpen = (name: string) => opened === 'all' || opened.includes(name)
  const allOpen = rooms.every((r) => isOpen(r.room.name))
  const toggleRoom = (name: string) => { const list = opened === 'all' ? rooms.map((r) => r.room.name) : opened; keepOpen(list.includes(name) ? list.filter((n) => n !== name) : [...list, name]) }
  /* the room whose walls and floors are being ticked, and the room a note is being added to (both from its ···) */
  const [lines, setLines] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState<string | null>(null)
  const last = (s.diary[job.id] || [])[0]
  const totalSf = rooms.reduce((n, r) => n + (r.sf || 0), 0)
  /* the tile paperwork comes in here: read, its tiles matched to the walls and floors — and what it entered shows on
     top to check, the rooms waiting under it (one list at a time) */
  const picker = usePaperPicker(job)
  const checking = usePaperReview(job.id) && canEdit
  const small = useSmall()
  return (
    <section data-detail="scope" className="px-5 pb-8 pt-4 max-sm:px-3">
      {/* one slim bar — the tab already says "Scope of work": how much there is (and, installing, the last daily update)
          on the left, its buttons on the right. The rooms say the rest */}
      {rooms.length > 0 && (
        <PaperBar
          mark="data-scope-bar"
          buttonsMark="data-scope-buttons"
          lead={
            <span className="min-w-0 text-[0.8125rem] leading-snug text-muted" data-scope-sum>
              <b className="font-semibold text-ink-2">{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</b>
              {totalSf > 0 && <span className="tnum"> · {totalSf.toLocaleString('en-US')} SF</span>}
              {/* installing: when the last daily update came */}
              {inField && <span data-scope-last-update> · {last ? <>Last daily update <b className="font-semibold text-ink-2">{last.date}</b> · {last.who === meOf(s.role) ? 'you' : firstName(last.who)}</> : 'No daily update yet'}</span>}
              {/* every room open, or just their lines */}
              {rooms.length > 1 && <button type="button" onClick={() => keepOpen(allOpen ? [] : 'all')} className="ml-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.8125rem] font-semibold text-brand-700 hover:bg-brand-50" data-scope-openall={allOpen ? 'open' : 'closed'}>{allOpen ? 'Close all' : 'Open all'}</button>}
            </span>
          }
        >
          {/* the quick way to change it: say what changed — it shows the changes to OK first */}
          {canEdit && <Button variant="primary" icon={<Mic />} onClick={() => s.open({ t: 'scopetalk', jobId: job.id })} data-scope-talk>Change by talking</Button>}
          {small ? (
            /* a phone: the main button and More — one slim row */
            <>
              {!canEdit && canChange && <Button icon={<Plus />} onClick={() => s.open({ t: 'sitechange', jobId: job.id })} data-new-change>Change order</Button>}
              <ScopeMore job={job} canEdit={canEdit} canChange={canChange} onPaper={picker.pick} />
            </>
          ) : (
            <>
              {canEdit && <Button icon={<Upload />} onClick={picker.pick} data-scope-paper>Tile paperwork</Button>}
              <PrintMenu job={job} />
              {canChange && <Button icon={<Plus />} onClick={() => s.open({ t: 'sitechange', jobId: job.id })} data-new-change>Change order</Button>}
            </>
          )}
        </PaperBar>
      )}
      {canEdit && picker.input}
      {canEdit && rooms.length > 0 && <PaperPanel job={job} className="mb-4" />}
      {/* building it by hand: the first room goes on, and it's built on from here (a room added by hand opens with its
          walls and floors to tick) */}
      {!rooms.length && <ScopeStart job={job} onAdded={(room) => { setLines(room); if (opened !== 'all') keepOpen([...opened, room]) }} />}
      {rooms.length > 0 && !checking && (
        <div data-paper className={PAPER}>
          {groups.map((g) => (
            <section key={g.floor} data-floor={g.floor} className="[&+&]:border-t [&+&]:border-line">
              {/* each floor in a dark green band, as on Cobblestone's scope of work — a heading, nothing to open */}
              {floors && <FloorBand floor={g.floor} rooms={g.rooms.length} />}
              {g.rooms.map((room, i) => (
                <ScopeRoom
                  key={room.name}
                  job={job}
                  room={room}
                  view={viewOf(room.name)}
                  inField={inField}
                  canEdit={canEdit}
                  first={i === 0 && !floors}
                  ticking={lines === room.name}
                  onTicking={(o) => { setLines(o ? room.name : null); if (o && !isOpen(room.name)) toggleRoom(room.name) }}
                  open={isOpen(room.name) || lines === room.name || adding === room.name}
                  onToggle={() => toggleRoom(room.name)}
                  adding={adding === room.name}
                  onAdding={(o) => setAdding(o ? room.name : null)}
                />
              ))}
            </section>
          ))}
        </div>
      )}
      {/* one more room — the same box as on an estimate */}
      {rooms.length > 0 && canEdit && !checking && <div className="mt-4"><ScopeAreaAdder jobId={job.id} onAdded={(room) => { setLines(room); if (opened !== 'all') keepOpen([...opened, room]) }} /></div>}
      <ChangeOrders job={job} />
    </section>
  )
}

/* Each wall and floor in plain words, the way Cobblestone's own paper says it — no columns to decode:
 *   on the left what it is (and which walls), and under it what we're doing there: how high in the paper's words
 *   (Fully tiled, Half tiled, Tiled to 48″), the metal edge, its note — how it's laid comes as a picture (the layouts)
 *   on the right its tile (the picture, its number, name and size) and the grout
 *   its square feet (once the crew is on it: how far) at the end
 * A phone: the same, the tile under the words. */
/** how high a wall goes, just the height: "84″, metal edge on top" → "84″" (the metal is its edge) */
const heightOnly = (h?: string) => heightShort((h || '').replace(/\s*(?:,|·|—)?\s*metal edge on top\s*$/i, '').trim())
/** how high, in the words Cobblestone's own paper uses: "Fully tiled, to the ceiling", "Half tiled, to 4 ft", "Wet walls
 *  only, to the ceiling", "Tiled to 84″", "Tiled to the mantel", "18″ backsplash" */
export function heightWordsOf(h?: string): string {
  if (!h) return ''
  /* a change asked for and not approved yet: what's approved, and what's asked */
  const ap = h.match(/^approved:\s*(.+?)\s*·\s*requested:\s*(.+)$/i)
  if (ap) return `${heightWordsOf(ap[1])} (asked for ${ap[2].replace(/\s*\((CO-\d+)\)\s*$/i, ', $1')})`
  /* the paper's own: "Half tiled" or "Wet walls only", and how high it says after it */
  const said = h.match(/^(half tiled|wet walls only)\s*(?:,|·|—)?\s*(.*)$/i)
  if (said) {
    const rest = said[2].replace(/\s*(?:,|·|—)?\s*metal edge on top\s*$/i, '').trim()
    return `${said[1].charAt(0).toUpperCase()}${said[1].slice(1).toLowerCase()}${rest ? `, ${/^\d/.test(rest) ? 'to ' : ''}${rest.charAt(0).toLowerCase()}${rest.slice(1)}` : ''}`
  }
  if (/fully tiled|full height|^to the ceiling$/i.test(h.trim())) return 'Fully tiled, to the ceiling'
  const t = heightOnly(h)
  /* just how high: "84″" → "Tiled to 84″" (and what's said with it: "4″, bullnose top" → "Tiled to 4″, bullnose top") */
  const n = t.match(/^(\d+(?:\.\d+)?\s*(?:″|"|in|ft|feet|′|'))(?:,\s*(.+))?$/i)
  if (n) return `Tiled to ${n[1]}${n[2] ? `, ${n[2]}` : ''}`
  if (/^to\s/i.test(t)) return `Tiled ${t.charAt(0).toLowerCase()}${t.slice(1)}`
  return t.charAt(0).toUpperCase() + t.slice(1)
}
/** a wall's edge, in words: "Metal edge on top: JOLLY, satin brass", "Mitered edges" */
export function edgeWordsOf(x: Surface): string {
  if (!isWall(x.name)) return ''
  const top = /metal edge on top/i.test(x.height || '')
  const k = edgeKind(x.edge)
  if (k === 'metal') {
    const m = parseMetal(x.edge)
    const what = [profileOf(m?.profile)?.short, finishOf(m?.finish)?.name.toLowerCase()].filter(Boolean).join(', ')
    return `Metal edge${top ? ' on top' : ''}${what ? `: ${what}` : ''}`
  }
  if (k === 'mitered') return 'Mitered edges'
  if (x.edge) return `Edge: ${x.edge}`
  return top ? 'Metal edge on top' : ''
}
/** what we're doing on a wall or floor, in a line of plain words: how high, its edge, its note. How it's laid isn't
 *  said here: the layouts are their own thing (pictures, from the plans) */
const doingOf = (x: Surface) => [isWall(x.name) ? heightWordsOf(x.height) : '', edgeWordsOf(x), x.notes || ''].filter(Boolean).join(' · ')
/** a wall or floor's tile in words: its number, name and size — two tiles on one wall: both */
function tileWordsOf(jobId: string, x: Surface): { words: React.ReactNode; tile?: Tile; grout?: string } {
  const tiles = tilesOn(x).map((t) => tileOf(jobId, t)).filter(Boolean) as Tile[]
  const g = x.grout || tiles[0]?.grout
  const words = tiles.length
    ? tiles.map((t, i) => <React.Fragment key={t.tag}>{i > 0 && ' + '}<b className="font-semibold tnum text-ink">{t.tag}</b> {t.name}{t.size ? <span className="whitespace-nowrap text-muted"> · {t.size}</span> : null}</React.Fragment>)
    : x.tile || ''
  return { words, tile: tiles[0], grout: g }
}
/** a computer: what it is and what we're doing | its tile and grout | its square feet. A phone: one under the other */
const LINE_GRID = 'lg:grid lg:grid-cols-[2.5rem_minmax(0,1.35fr)_minmax(0,1fr)_4.5rem] lg:items-center lg:gap-x-5'
/** the same, with the ticks (Tile · Grout · Later) before the square feet — the same width on every line, so the tiles
 *  and the ticks line up down the room */
const LINE_GRID_TICKS = 'lg:grid lg:grid-cols-[2.5rem_minmax(0,1.5fr)_minmax(0,1fr)_18.25rem_4.5rem] lg:items-center lg:gap-x-5'

/** one room, always open: its band (tap it for the room — its daily log and photos), then each wall and floor in plain
 *  words, with its tile's picture. Its notes (a niche, a saddle — what isn't a wall or floor) under them. */
function ScopeRoom({ job, room, view, inField, canEdit, first, ticking, onTicking, adding, onAdding, open, onToggle }: {
  job: Job; room: Room; view: RoomView; inField: boolean; canEdit: boolean; first: boolean
  /** its walls and floors being ticked (from its ···) */ ticking: boolean; onTicking: (o: boolean) => void
  /** a note being added (from its ···) */ adding: boolean; onAdding: (o: boolean) => void
  /** its walls and floors shown — tap the room's line to open or close it */ open: boolean; onToggle: () => void
}) {
  const s = useStore()
  const w = roomWord(view)
  /* the crew on it: each wall and floor ticked right here — the tile in, then the grout (done); a niche can wait */
  const ticks = inField && !['client', 'accounting'].includes(s.role)
  /* where it's up to, from the ticks: "Tile 3 of 5 · Grout 1 of 5", "Done" — a problem says itself (red) instead; a room
     not started says nothing */
  const lines = room.surfaces.filter((x) => takesTile(x.name))
  const later = lines.filter((x) => x.later && !isGrouted(x))
  const counted = lines.filter((x) => !(x.later && !isGrouted(x)))
  const nTiled = counted.filter(isTiled).length
  const nGrout = counted.filter(isGrouted).length
  const upTo = !inField || !counted.length ? null
    : nGrout === counted.length ? { text: `Done${later.length ? ` · ${later.length} for later` : ''}`, cls: 'font-medium text-[#2c8a5b]' }
      : !nTiled && !counted.some(partPct) ? { text: later.length ? `${later.length} for later` : '', cls: 'text-muted' }
        : { text: `Tile ${nTiled} of ${counted.length} · Grout ${nGrout} of ${counted.length}${later.length ? ` · ${later.length} for later` : ''}`, cls: 'text-ink-2' }
  const said = w.text && /bad-|warn-/.test(w.cls) ? w : upTo || w
  return (
    <div data-room={room.name} data-room-state={view.state} data-room-open={open ? '' : undefined} className={cn(!first && 'border-t border-line')}>
      {/* the room's line: its name in capitals and its short note — then where it's up to and its square feet. Tap it to
          open (or close) its walls and floors; ↗ opens the room itself */}
      <div className={cn('flex min-h-11 min-w-0 items-center pr-2 max-sm:pr-1', open && 'sticky top-0 z-[5]')} style={{ background: DOC_GRAY }} data-room-band>
        <button type="button" onClick={onToggle} aria-expanded={open} data-room-head className={cn(ROOM_BAND, 'group flex-1 gap-3 py-1.5 pl-3 pr-2 text-left max-sm:flex-wrap max-sm:gap-x-2 max-sm:gap-y-0.5 max-sm:py-2 max-sm:pl-2')}>
          <ChevronRight className={cn('h-4 w-4 shrink-0 text-[#8a8f98] transition-transform group-hover:text-brand-700', open && 'rotate-90')} aria-hidden />
          {/* a phone: the name and its note wrap rather than end in "…" */}
          <span className="min-w-0 flex-1 truncate max-sm:whitespace-normal max-sm:leading-snug"><b className={cn(ROOM_NAME, 'group-hover:text-brand-700')}>{room.name}</b>{room.note && <span className="text-[#555]" data-room-cover> | {room.note}</span>}</span>
          {/* installing: how far it is, a small bar */}
          {inField && view.pct > 0 && <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[#e2ded6] max-sm:hidden" aria-hidden data-room-bar><span className={cn('block h-full rounded-full', view.state === 'stopped' ? 'bg-bad-500' : view.state === 'done' ? 'bg-[#2c8a5b]' : 'bg-brand-600')} style={{ width: `${view.pct}%` }} /></span>}
          {/* where it's up to, whole (never cut short): a phone, on its own line under the name */}
          {said.text && <span data-room-why className={cn('min-w-0 max-w-[45%] text-right text-[0.8125rem] leading-snug max-sm:order-last max-sm:w-full max-sm:max-w-none max-sm:pl-6 max-sm:text-left', said.cls)} title={view.chips.map((c) => c.text).join(' · ')}>{said.text}</span>}
          <span className="w-[4.25rem] shrink-0 text-right text-[0.8125rem] tnum text-[#555] max-sm:hidden">{view.sf > 0 ? `${view.sf.toLocaleString('en-US')} SF` : ''}</span>
        </button>
        <button type="button" onClick={() => s.open({ t: 'room', jobId: job.id, room: room.name })} aria-label={`Open ${room.name}`} title="Open the room: its daily log and photos" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint transition hover:bg-white hover:text-ink" data-room-open-window><ArrowUpRight className="h-4 w-4" /></button>
        {canEdit && <RoomMenu jobId={job.id} room={room} onLines={() => onTicking(true)} onDetail={() => onAdding(true)} />}
      </div>
      {/* each wall and floor in plain words — tap it to change it; the crew on it: its ticks */}
      {open && (
      <div data-room-body>
        {room.surfaces.map((x) => {
          const takes = takesTile(x.name)
          const walls = isWall(x.name) && x.walls ? x.walls.replace(/^The /, '') : ''
          const doing = doingOf(x)
          const { words, tile, grout } = tileWordsOf(job.id, x)
          const stopped = ['blocked', 'waitmat', 'hold'].includes(x.state)
          const sf = x.sf ? `${x.sf.toLocaleString('en-US')} SF` : ''
          const tickable = ticks && takes
          const openLine = () => s.open({ t: 'surface', jobId: job.id, room: room.name, surface: x.name })
          return (
            <div key={x.name} role="button" tabIndex={0} onClick={openLine} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) openLine() }} data-surface-line={x.name}
              className={cn('flex w-full min-w-0 cursor-pointer flex-wrap items-start gap-x-3 gap-y-2 border-t border-line-2 px-5 py-2.5 text-left transition row-hover first:border-t-0 max-sm:px-3 lg:flex-nowrap', ticks ? LINE_GRID_TICKS : LINE_GRID)}>
              {/* its tile's picture */}
              {tile ? <TileImg tile={tile} size={36} radius={5} className="max-lg:hidden" /> : <span className={cn('h-9 w-9 shrink-0 rounded-[5px] max-lg:hidden', takes ? 'border border-dashed border-[#cfc8bc] bg-[#faf9f6]' : 'bg-[#f3f1ec]')} />}
              {tile ? <TileImg tile={tile} size={PIC_SM} radius={6} className="lg:hidden" />
                : takes ? <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-dashed border-[#cfc8bc] bg-[#faf9f6] text-[0.625rem] font-semibold leading-tight text-muted lg:hidden" data-surface-notile>No tile</span>
                  : <span className="h-11 w-11 shrink-0 rounded-md bg-[#f3f1ec] lg:hidden" />}
              {/* what it is, and what we're doing on it — in words */}
              <span className="min-w-0 flex-1 lg:flex-none">
                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="min-w-0 flex-1 text-[0.9375rem] font-semibold leading-[1.375rem] text-ink" data-surface-name>{x.name}{walls && <span className="font-normal text-muted" data-surface-where> · {walls}</span>}</span>
                  {/* a phone: its square feet at the end of its name (stopped: said in red) */}
                  <span className={cn('shrink-0 text-[0.8125rem] tnum lg:hidden', stopped && inField ? 'font-medium text-bad-600' : 'text-muted')} data-surface-right>{stopped && inField ? 'Stopped' : sf}</span>
                </span>
                <span className="block text-[0.875rem] leading-snug text-ink-2" data-surface-under>{doing || (!takes ? 'Not tiled' : isWall(x.name) && x.state !== 'done' ? <span className="text-muted">Its height isn’t set</span> : '')}{x.later && !isGrouted(x) && <span className="font-medium text-warn-700" data-surface-later>{doing ? ' · ' : ''}Left for later</span>}</span>
                {/* a phone: its tile and grout under the words */}
                <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted lg:hidden" data-surface-tile-phone>{words || (takes ? <span className="font-medium text-warn-700">{canEdit ? 'Pick its tile' : 'No tile yet'}</span> : '')}{grout ? ` · ${GROUTS[grout]?.name || grout} grout` : ''}</span>
              </span>
              {/* a phone: the ticks on their own line under the picture and the words — in the same place on every line,
                  so they stand in straight columns */}
              {tickable && <span className="flex basis-full flex-wrap gap-1.5 lg:hidden" data-line-ticks-phone><LineTicks job={job} room={room.name} x={x} /></span>}
              {/* a computer: its tile, and the grout under it */}
              <span className="min-w-0 max-lg:hidden" data-surface-tile>
                <span className="block text-[0.875rem] leading-snug text-ink-2">{words || (takes ? <span className="font-medium text-warn-700">{canEdit ? 'Pick its tile' : 'No tile yet'}</span> : <span className="text-faint">Not tiled</span>)}</span>
                {grout && <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted" data-surface-grout><GroutDot grout={grout} size={10} /><span className="min-w-0 truncate">{GROUTS[grout]?.name || grout} grout</span></span>}
              </span>
              {/* a computer: the ticks */}
              {ticks && (tickable ? <span className="flex items-center gap-1.5 max-lg:hidden" data-line-ticks><LineTicks job={job} room={room.name} x={x} /></span> : <span className="max-lg:hidden" aria-hidden />)}
              <span className="text-right max-lg:hidden">
                <span className="block text-[0.875rem] tnum text-ink-2" data-surface-sf>{sf}</span>
                {stopped && inField && <span className="block text-[0.8125rem] font-medium text-bad-600" data-surface-status>Stopped</span>}
              </span>
            </div>
          )
        })}
        {!room.surfaces.length && <div className="border-t border-line-2 px-5 py-3 text-[0.875rem] text-muted first:border-t-0 max-sm:px-3" data-room-empty>No tile installation</div>}
        <RoomNotes job={job} room={room} canEdit={canEdit} adding={adding} onAdding={onAdding} />
      </div>
      )}
      {/* whoever builds the scope: tick the walls and floors this room has (from its ···) */}
      {canEdit && ticking && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line-2 px-5 py-1.5 max-sm:px-3" data-add-row>
          <RoomLines jobId={job.id} room={room} bare open onOpenChange={onTicking} />
        </div>
      )}
    </div>
  )
}

/** a wall's or floor's ticks: the tile is in, the grout is done — and Later (a niche waiting on its shelf). One tap each,
 *  nothing pops up; tap again to take it back. Each one the same width on every line, so they stand in straight
 *  columns down the room (a line that's grouted keeps Later's place empty) */
const TICK_W = { tile: 'w-[7.5rem]', grout: 'w-[5.5rem]', later: 'w-[4.5rem]' }
function LineTicks({ job, room, x }: { job: Job; room: string; x: Surface }) {
  const tiled = isTiled(x)
  const grouted = isGrouted(x)
  const part = partPct(x)
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  const tick = (on: boolean, label: string, part2: 'tile' | 'grout', extra?: string) => (
    <button type="button" onClick={(e) => { stop(e); tickSurface(job.id, room, x.name, part2) }} onKeyDown={stop} aria-pressed={on} aria-label={`${label} · ${x.name}`}
      className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border pl-1.5 pr-2.5 text-[0.84375rem] font-semibold transition', TICK_W[part2], on ? 'border-[#2c8a5b] bg-[#eef7f1] text-[#226b47]' : 'border-line bg-white text-ink-2 hover:border-[#c9c2b6] hover:bg-wash')}
      data-tick={part2} data-tick-on={on ? '' : undefined}>
      <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full', on ? 'bg-[#2c8a5b] text-white' : 'border-[0.09375rem] border-[#cfc9be]')}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
      <span className="min-w-0 truncate">{label}{extra && <span className="font-medium text-muted">{extra}</span>}</span>
    </button>
  )
  return (
    <>
      {tick(tiled, 'Tile', 'tile', part ? ` ${part}%` : undefined)}
      {tick(grouted, 'Grout', 'grout')}
      {!grouted ? (
        <button type="button" onClick={(e) => { stop(e); tickSurface(job.id, room, x.name, 'later') }} onKeyDown={stop} aria-pressed={!!x.later} title="Leave it for later. It doesn’t hold the room up"
          className={cn('inline-flex h-9 shrink-0 items-center justify-center rounded-full border text-[0.84375rem] font-semibold transition', TICK_W.later, x.later ? 'border-warn-300 bg-warn-50 text-warn-700' : 'border-dashed border-[#d9d3c9] bg-white text-muted hover:border-[#c9c2b6] hover:bg-wash hover:text-ink')} data-tick="later" data-tick-on={x.later ? '' : undefined}>Later</button>
      ) : <span className={cn('shrink-0', TICK_W.later)} aria-hidden />}
    </>
  )
}

/** a room's notes — what isn't a wall or floor (1 niche, a saddle, "cut the border on site"): the estimate's extras,
 *  or what someone wrote. What its walls and floors already say isn't said again. Tap one to change it (emptied:
 *  gone); "A detail" (the room's ···) adds one. */
function RoomNotes({ job, room, canEdit, adding, onAdding }: { job: Job; room: Room; canEdit: boolean; adding: boolean; onAdding: (o: boolean) => void }) {
  const s = useStore()
  /* the room's whole list (what the print uses) — the notes are the lines its walls and floors don't already say */
  const { lines: all } = detailsOf(s, job.id, room)
  const said = new Set(surfaceDetailLines(room).map((l) => l.toLowerCase()))
  const at = all.map((l, i) => (said.has(l.toLowerCase()) ? -1 : i)).filter((i) => i >= 0)
  const [editing, setEditing] = React.useState<number | null>(null)
  const [text, setText] = React.useState('')
  if (!at.length && !adding) return null
  const save = (k: number | null, v: string) => {
    const next = [...all]
    const t = v.trim()
    if (k == null) { if (t) next.push(t) } else if (t) next[at[k]] = t
    else next.splice(at[k], 1)
    if (JSON.stringify(next) !== JSON.stringify(all)) setRoomDetails(job.id, room.name, next)
    setEditing(null)
    setText('')
    if (k == null) onAdding(false)
  }
  const box = (k: number | null) => (
    <input
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') save(k, text); if (e.key === 'Escape') { setEditing(null); setText(''); if (k == null) onAdding(false) } }}
      onBlur={() => save(k, text)}
      placeholder={k == null ? 'A note · e.g. 1 niche, saddle · white quartz' : 'Empty it to take it off'}
      aria-label={k == null ? `A note for ${room.name}` : `Change the note`}
      data-room-detail-input
      className="my-0.5 h-8 w-full min-w-0 rounded-lg border border-brand-300 bg-white px-2.5 text-[0.875rem] text-ink outline-none ring-2 ring-brand-100"
    />
  )
  return (
    <ul data-room-details={room.name} className="m-0 flex min-w-0 list-none flex-col border-t border-line-2 px-5 py-2 pl-[4.75rem] first:border-t-0 max-sm:px-3 max-sm:pl-[4.25rem]">
      {at.map((i, k) => <li key={i} className="min-w-0">{editing === k ? box(k) : (
        <button type="button" disabled={!canEdit} onClick={() => { setEditing(k); setText(all[i]) }} title={canEdit ? 'Tap to change' : undefined} data-room-detail className="flex w-full min-w-0 items-baseline gap-2 py-0.5 text-left text-[0.8125rem] leading-5 text-muted enabled:hover:text-brand-700">
          <span className="shrink-0 text-faint">•</span><span className="min-w-0">{all[i]}</span>
        </button>
      )}</li>)}
      {adding && <li className="min-w-0">{box(null)}</li>}
    </ul>
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
            <span className="min-w-0 flex-1 break-words text-[0.875rem] text-ink">{m.title}</span>
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
      {phone && <a href={smsHref(phone)} aria-label={`Text ${who}`} title={`Text ${phone}`} className={cn(btn, 'max-sm:hidden')}><MessageSquareText /></a>}
      {email && <a href={`mailto:${email}`} aria-label={`Email ${who}`} title={`Email ${email}`} className={btn}><Mail /></a>}
    </span>
  )
}
/** a person on the job — the same kind of line as every list in the app: their circle and name · what they are · what
 *  they have on this job · the buttons to reach them (call, text, email — the number and the address show when you
 *  point at them), each in its own column, lined up top to bottom. On a phone what they are goes under the name. */
const PEOPLE_COLS = { '--list': 'minmax(0,1.2fr) minmax(0,0.8fr) minmax(0,1.5fr) 9.25rem' } as React.CSSProperties
const PERSON_ROW = 'flex min-h-[3.25rem] min-w-0 items-center gap-3 border-t border-line-2 px-5 py-2 max-sm:px-3 md:grid md:gap-x-6'
function Contact({ initials, who, name, role, r, sub, onName, onMessage, tone, noReach, menu, mark }: { initials?: string; who?: PersonKey; name: string; role: string; r: Reachable; sub?: React.ReactNode; onName?: () => void; onMessage?: () => void; tone?: string; /** you: nothing to reach yourself with */ noReach?: boolean; /** its ···: change it, take it off */ menu?: React.ReactNode; mark?: string }) {
  return (
    <div data-person={role} data-subrow className={PERSON_ROW} {...(mark ? { [mark]: '' } : {})}>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {who ? <Avatar who={who} size={30} /> : <span className={cn('inline-flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-semibold', tone || 'bg-[#ece8e1] text-[#4a5361]')}>{initials}</span>}
        <span className="min-w-0 leading-snug">
          {onName ? <button onClick={onName} className="block max-w-full break-words text-left text-[0.9375rem] text-ink hover:text-brand-700">{name}</button> : <span className="block max-w-full break-words text-[0.9375rem] text-ink">{name}</span>}
          {/* a phone: what they are, and what they have on this job, under the name — whole */}
          <span className="block min-w-0 break-words text-[0.8125rem] text-muted md:hidden">{role}{sub && <><span className="text-faint"> · </span>{sub}</>}</span>
        </span>
      </span>
      <span className="min-w-0 break-words text-[0.875rem] text-muted max-md:hidden" data-person-role>{role}</span>
      <span className="flex min-w-0 text-[0.875rem] text-ink-2 max-md:hidden [&>*]:min-w-0 [&>*]:break-words" data-person-on>{sub || <span className="text-faint"></span>}</span>
      <span className="flex shrink-0 items-center justify-end gap-1">{!noReach && <ReachButtons r={r} who={name} onMessage={onMessage} />}{menu}</span>
    </div>
  )
}
const MORE_BTN = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash hover:text-ink'
/** the designer on this job, picked right on its line: from Designers, none, or a new one typed in */
function DesignerPick({ job, trigger }: { job: Job; trigger: React.ReactNode }) {
  const s = useStore()
  const cur = designerOf(s.designers, job)
  return (
    <SearchSelect label="Designer" value={cur?.id || ''} trigger={trigger} width={340} search emptyLabel="No designer"
      options={s.designers.map((d) => ({ key: d.id, label: d.name, hint: d.contact && d.contact !== d.name ? d.contact : undefined }))}
      onChange={(id) => setJobDesigner(job.id, id || NO_DESIGNER)}
      onCreate={(t) => t.trim() && setJobDesigner(job.id, addDesignerNamed(t))} createLabel={(t) => `Add “${t}” as a new designer`} />
  )
}
/** the installer's PO, under his name — where it is, what it comes to against our estimate (for whoever sees money),
 *  his days; tap it to open the PO, or send one when there's none yet */
function InstallerPO({ job }: { job: Job }) {
  const s = useStore()
  const ipo = [...s.ipos].reverse().find((p) => p.jobId === job.id)
  const money = !['site', 'crew', 'client'].includes(s.role)
  const b = s.bookings.find((x) => x.jobId === job.id && x.label !== 'Return visit')
  /* on the job without a PO (his PO steps marked "no PO") — said plainly */
  if (!ipo && s.stepRecs[job.id]?.installer?.done) return <button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} data-installer-po="none" className="text-left text-muted hover:text-brand-700">No PO</button>
  if (!ipo) return <button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} data-installer-po="none" className="text-left font-medium text-warn-700 hover:underline">No PO yet · send it</button>
  const r = poRatio(s, ipo)
  const word = ipo.status === 'Accepted' ? 'accepted' : ipo.status === 'Sent' ? 'waiting for his yes' : ipo.status === 'Rejected' ? 'turned down' : 'not sent'
  return (
    <button onClick={() => s.open({ t: 'ipo', id: ipo.id })} data-installer-po={ipo.id} title={[money && r.total && r.sold ? `${r.pct}% of our estimate` : '', b ? `${labelFromIso(b.start)} – ${labelFromIso(b.end)}` : ''].filter(Boolean).join(' · ') || undefined} className="max-w-full break-words text-left text-ink-2 hover:text-brand-700">
      PO {ipo.id} · {word}{money && r.total ? <> · <span className={r.over ? 'font-semibold text-bad-600' : ''}>{fmtMoney(r.total)}</span></> : null}
    </button>
  )
}
const initialsOf = (n: string) => n.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
function PeoplePart({ job, open, onStep }: { job: Job; open: (v: BoardView) => void; onStep?: (k: string) => void }) {
  const s = useStore()
  const me = meOf(s.role)
  const client = s.clients[job.clientId]
  const designer = designerOf(s.designers, job)
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
  /* whoever isn't the client or the crew can add who to call on this job */
  const canContacts = !['client', 'crew'].includes(s.role)
  return (
    <section data-detail="people" className="px-5 pb-8 pt-4 max-sm:px-3">
      <header className="mb-3 flex min-h-9 min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="text-[1rem] font-semibold text-ink">People</h3>
        {/* someone to call on this job — the homeowner, the designer, the super */}
        {canContacts && <span className="ml-auto"><Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'jobcontact', jobId: job.id })} data-person="add" data-add-job-contact>Add a person</Button></span>}
      </header>
      {/* one list: the client and their people, the designer, the installer, the stores, then ours — what each one is
          says it, no headings between them. Its columns lined up, the way every list is */}
      <div className="overflow-clip rounded-[0.875rem] border border-line bg-white" data-contacts>
        <div data-even-list style={PEOPLE_COLS}>
        <div className={cn(HEAD_ROW, 'sticky top-0 z-[5] px-5 md:grid md:gap-x-6 max-md:hidden')} data-list-head data-subrow><span>Name</span><span>Role</span><span>On this job</span><span /></div>
        <Contact initials={initialsOf(job.client)} tone="bg-[#e3ece6] text-[#2c4a3e]" name={job.client} role="Client" r={{ phone: client?.phone, email: client?.email, more: client?.more }} onName={() => s.open({ t: 'customer', id: job.clientId })} />
        {(client?.contacts || []).map((c) => <Contact key={c.name} initials={initialsOf(c.name)} name={c.name} role={c.role || 'Contact'} r={c} />)}
        {/* this job's own people — the homeowner, the designer, the super (a client like NJ Private Customer is many
            homeowners) — tap a name to change it */}
        {(job.contacts || []).map((c, i) => (
          <Contact key={'jc' + i} mark="data-job-person" initials={initialsOf(c.name)} tone="bg-[#e6eef8] text-[#1f4f8f]" name={c.name} role={c.role || 'On this job'} r={{ phone: c.phone, email: c.email }} onName={canContacts ? () => s.open({ t: 'jobcontact', jobId: job.id, index: i }) : undefined}
            menu={canContacts ? (
              <Menu align="end" width={220} trigger={<button aria-label={`Change or take off ${c.name}`} className={MORE_BTN} data-job-person-more><MoreHorizontal className="h-4 w-4" /></button>}>
                <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => s.open({ t: 'jobcontact', jobId: job.id, index: i })}>Change</MenuItem>
                <MenuSep />
                <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => removeJobContact(job.id, i)} data-job-person-remove>Take off this job</MenuItem>
              </Menu>
            ) : undefined} />
        ))}
        {designer
          ? <Contact mark="data-job-designer" initials={initialsOf(designer.name)} tone="bg-[#efe6f6] text-[#5b2f86]" name={designer.name} role="Designer" r={designer} sub={designer.contact && !/^designer$/i.test(designer.contact) && designer.contact !== designer.name ? designer.contact : undefined} onName={() => s.open({ t: 'designer', id: designer.id })}
              menu={canContacts ? <DesignerPick job={job} trigger={<button aria-label="Change the designer" title="Change the designer" className={MORE_BTN} data-designer-change><Pencil className="h-4 w-4" /></button>} /> : undefined} />
          : canContacts && (
            /* no designer on it: picked right here, like the installer */
            <div data-person="Designer" data-job-designer="none" data-subrow className={PERSON_ROW}>
              <span className="flex min-w-0 flex-1 items-center gap-3"><span className="inline-flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full border border-dashed border-[#d1cbc0] text-faint"><Palette className="h-3.5 w-3.5" /></span><span className="truncate text-[0.9375rem] text-muted">No designer<span className="md:hidden"> yet</span></span></span>
              <span className="text-[0.875rem] text-muted max-md:hidden">Designer</span>
              <span className="max-md:hidden"><DesignerPick job={job} trigger={<button className={cn(LINK, '-ml-1.5 text-[0.875rem]')} data-designer-pick>Pick the designer</button>} /></span>
              <span className="flex justify-end md:hidden"><DesignerPick job={job} trigger={<button className={LINK} data-designer-pick>Pick</button>} /></span>
            </div>
          )}
        {crew
          ? <Contact who={crew} name={PEOPLE[crew]?.name || crew} role="Installer" r={crewReach} sub={<InstallerPO job={job} />} onName={() => s.open({ t: 'installerwin', jobId: job.id })} />
          : (
            <div data-person="Installer" data-subrow className={PERSON_ROW}>
              <span className="flex min-w-0 flex-1 items-center gap-3"><span className="inline-flex h-[1.875rem] w-[1.875rem] shrink-0 items-center justify-center rounded-full border border-dashed border-[#d1cbc0] text-faint"><HardHat className="h-3.5 w-3.5" /></span><span className="truncate text-[0.9375rem] text-muted">Not picked yet<span className="md:hidden"> · installer</span></span></span>
              <span className="text-[0.875rem] text-muted max-md:hidden">Installer</span>
              <span className="max-md:hidden"><button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} className={cn(LINK, '-ml-1.5 text-[0.875rem]')}>Pick the installer</button></span>
              <span className="flex justify-end md:hidden"><button onClick={() => s.open({ t: 'installerwin', jobId: job.id })} className={LINK}>Pick</button></span>
            </div>
          )}
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
              noReach={p === me}
            />
          )
        })}
        </div>
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
    { name: 'Tile paperwork', here: !!paper || !!sp, sub: paper ? `${paper.name} · ${paper.at}` : sp ? `${sp.name} · ${sp.date}` : tiles ? `${tiles} ${tiles === 1 ? 'tile' : 'tiles'} entered. No file kept · tap to add it` : 'missing. Tap to add it', go: () => (paper ? open({ t: 'doc', doc: 'Tile paperwork' }) : sp ? open({ t: 'files' }) : open({ t: 'doc', doc: 'Tile paperwork' })) },
    ...(rooms.length ? [{ name: 'Scope of work', here: true, sub: `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}${sf ? ` · ${sf.toLocaleString('en-US')} SF` : ''}`, go: () => open({ t: 'scope' }) }] : []),
    ...NAMED.flatMap(([doc, kind]): Paper[] => {
      const a = asked.find((d) => d.name === doc)
      const f = last(filesOfDoc(files, job.id, doc))
      const smp = sampleOf(kind)
      if (!a && !f && !smp) return []
      const here = !!f || !!smp || (!!a && a.status !== 'missing')
      return [{ name: doc, here: !!f || !!smp, sub: f ? `${f.name} · ${f.at}` : smp ? `${smp.rev} · ${smp.date}` : a && a.status !== 'missing' ? `${a.note || 'Came in'}. No file kept · tap to add it` : 'missing. Tap to add it', go: () => (!f && smp ? open({ t: 'files' }) : open({ t: 'doc', doc })) }]
    }),
    ...asked.filter((d) => !NAMED.some(([x]) => x === d.name)).map((d) => { const f = last(filesOfDoc(files, job.id, d.name)); return { name: d.name, here: !!f, sub: f ? `${f.name} · ${f.at}` : d.status === 'missing' ? 'missing. Tap to add it' : `${d.note || 'Came in'}. No file kept · tap to add it`, go: () => open({ t: 'doc', doc: d.name }) } }),
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
      <input ref={add} type="file" multiple className="hidden" aria-label="Add files · Documents" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void upload(f) }} />
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
