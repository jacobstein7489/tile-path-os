/* Upload the tile paperwork and AI reads it and enters it by itself: every tile on it — its picture, name, size, grout,
 * how much, how it's laid, the edges, how high — matched to the walls and floors of the scope of work (room sheets
 * too: a page a room, each tile under a label that says where it goes). While it reads, a card says what it's on and
 * a bar moves (lib/reading — it stays when you leave and come back, and the bar on top of every screen shows it).
 * Then: every tile it read, each with where it goes — a picker to fix it, amber when it couldn't match — and our walls
 * and floors the paperwork didn't cover, each with "Pick a tile". "Take it back" undoes it all. Paperwork uploaded
 * earlier that nothing was read from yet is read the moment this opens. The file stays with the project.
 *   on the paperwork step (Where it stands), and on Tile & materials — the same reading, the same card */
import * as React from 'react'
import { create } from 'zustand'
import { Sparkles, Upload, FileText, Check, CircleAlert, Undo2, ChevronDown, Plus, X } from 'lucide-react'
import { useStore, addHist, meOf } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { MultiSelect } from '@/tileos/components/ui/select'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { keepFiles, showFile, sizeLabel, fileBlob } from '@/tileos/lib/files'
import { startReading, stepReading, endReading, failReading, useReadingOf } from '@/tileos/lib/reading'
import { GROUTS, byTag, hasTile, tilesOn, floorsOf, type Tile, type Room, type Surface } from '@/tileos/data/jobs'
import { DOC_GREEN, DOC_GRAY } from './docpaper'
import type { Job } from '@/tileos/data/model'
import { readTilePaperwork, ReadError, type ReadResult } from './reader'
import { takesTile } from './steps'
import { applyRead, setTileOn, refKey } from './tiles'
import { ReadingCard } from './readcard'

type Before = { tiles: Record<string, Tile>; rooms: any[] }
type State =
  | { k: 'idle'; msg?: string; tone?: 'bad' | 'warn' }
  | { k: 'reading'; name: string; n: number }
  | { k: 'entered'; res: ReadResult; file: string; problem?: string; before: Before; /** the tag each tile it read got */ tags: string[] }
/* paperwork already uploaded is read once by itself on each project (again only with a tap) */
const tried = new Set<string>()
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? null))

/* the reading runs on its own — closing the window, or the step turning done when the file lands, doesn't stop it;
   when it's done it's entered, and what it entered waits on the project (with Take it back) until it's looked at */
const useReads = create<{ by: Record<string, State> }>(() => ({ by: {} }))
const setRead = (jobId: string, st: State) => useReads.setState((x) => ({ by: { ...x.by, [jobId]: st } }))
const ctls: Record<string, AbortController> = {}
/* the files of the last reading — "Try again" reads them again, no second upload */
const lastFiles: Record<string, { files: File[]; already?: boolean }> = {}
export function stopRead(jobId: string) { ctls[jobId]?.abort(); endReading('paperwork', jobId); setRead(jobId, { k: 'idle' }) }
/** the paperwork is being read on this project, or what it entered is on screen — its window stays open for it */
export const useReadBusy = (jobId: string) => useReads((x) => { const k = x.by[jobId]?.k; return k === 'reading' || k === 'entered' })
/** how its reading is going, in a few words — 'reading', what went wrong, or '' — for a window that started it */
export const useReadWords = (jobId: string) => useReads((x) => { const r = x.by[jobId]; return r?.k === 'reading' ? 'reading' : r?.k === 'idle' && r.msg ? r.msg : '' })
const PAPER_OK = (f: File) => /pdf|image/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name)
async function runRead(job: Job, list: File[], already?: boolean) {
  const files = list.filter(PAPER_OK)
  if (!files.length) { setRead(job.id, { k: 'idle', msg: 'Pick a PDF or photos of the paperwork.', tone: 'warn' }); return }
  const name = files.length === 1 ? files[0].name : `${files.length} files`
  lastFiles[job.id] = { files, already }
  ctls[job.id]?.abort()
  const c = (ctls[job.id] = new AbortController())
  setRead(job.id, { k: 'reading', name, n: files.length })
  startReading('paperwork', job.id, name)
  /* the file is kept first — it stays with the project whatever the reading says */
  const kept = already ? { problem: undefined as string | undefined } : await keepFiles(job.id, files, 'paperwork', { quiet: true }).catch((e: any) => ({ problem: String(e?.message || e) }))
  try {
    const st0 = useStore.getState()
    const res = await readTilePaperwork(job, st0.rooms[job.id] || [], Object.values(st0.tiles[job.id] || {}).sort(byTag), files, c.signal, (st) => { if (!c.signal.aborted) stepReading('paperwork', job.id, st) })
    if (c.signal.aborted) return
    endReading('paperwork', job.id)
    if (!res.tiles.length) { setRead(job.id, { k: 'idle', msg: `No tiles found on ${name}.${res.notes ? ` ${res.notes}` : ''}`, tone: 'warn' }); return }
    /* entered right away — what was there before is kept, so it can be taken back */
    const st1 = useStore.getState()
    const before: Before = { tiles: copy(st1.tiles[job.id] || {}), rooms: copy(st1.rooms[job.id] || []) }
    const tags = applyRead(job.id, res.tiles, { file: name, rooms: res.rooms })
    setRead(job.id, { k: 'entered', res, file: name, problem: kept.problem, before, tags })
  } catch (e: any) {
    if (c.signal.aborted || e?.code === 'cancelled') { endReading('paperwork', job.id); setRead(job.id, { k: 'idle' }); return }
    failReading('paperwork', job.id, e instanceof ReadError ? e.message : 'Couldn’t read it just now · try again.')
    setRead(job.id, { k: 'idle' })
  } finally { if (ctls[job.id] === c) delete ctls[job.id] }
}
const again = (job: Job) => { const l = lastFiles[job.id]; if (l) void runRead(job, l.files, l.already) }

/** read a project's tile paperwork and enter it (bringing a project in with its paperwork) — kept with the project
 *  first, then read; what it entered waits on the project */
export const readPaperworkFor = (job: Job, files: File[]) => runRead(job, files)

/** a way to pick the paperwork from a menu: its hidden file box (put it on the page) and what opens it */
export function usePaperPicker(job: Job) {
  const ref = React.useRef<HTMLInputElement>(null)
  const input = <input ref={ref} type="file" multiple accept="application/pdf,image/*" className="hidden" aria-label="The tile paperwork" data-paper-input onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; void runRead(job, l) }} />
  return { pick: () => ref.current?.click(), input }
}
/** the button that uploads it (Tile & materials) — the card below says the rest */
export function PaperUpload({ job, primary, label = 'Upload the tile paperwork' }: { job: Job; primary?: boolean; label?: string }) {
  const input = React.useRef<HTMLInputElement>(null)
  const reading = useReadingOf('paperwork', job.id)
  const busy = !!reading && !reading.failed
  return (
    <>
      <Button size="sm" variant={primary ? 'primary' : undefined} icon={<Upload />} disabled={busy} onClick={() => input.current?.click()} data-paper-upload>{busy ? 'Reading…' : label}</Button>
      <input ref={input} type="file" multiple accept="application/pdf,image/*" className="hidden" aria-label="The tile paperwork" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; void runRead(job, l) }} />
    </>
  )
}

/** what the paperwork is up to on this project — reading (the card), couldn't, or what it entered (to check) — and
 *  nothing when there's nothing to say */
export function PaperPanel({ job, className }: { job: Job; className?: string }) {
  const st = useReads((x) => x.by[job.id]) || ({ k: 'idle' } as State)
  const reading = useReadingOf('paperwork', job.id)
  if (reading) return <ReadingCard r={reading} onStop={() => stopRead(job.id)} onRetry={lastFiles[job.id] ? () => again(job) : undefined} className={className} />
  if (st.k === 'entered') return <div className={className}><Entered job={job} res={st.res} file={st.file} problem={st.problem} before={st.before} tags={st.tags} onDone={() => setRead(job.id, { k: 'idle' })} /></div>
  if (st.k === 'idle' && st.msg) return <div className={cn('flex items-start gap-2 text-[0.8125rem] font-medium', st.tone === 'bad' ? 'text-bad-700' : 'text-warn-800', className)}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{st.msg}</div>
  return null
}

/** the drop zone, the reading, and what it entered — at the top of the paperwork steps */
export function PaperRead({ job }: { job: Job }) {
  const s = useStore()
  const st = useReads((x) => x.by[job.id]) || ({ k: 'idle' } as State)
  const reading = useReadingOf('paperwork', job.id)
  const [over, setOver] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const kept = s.files.filter((f) => f.jobId === job.id && f.kind === 'paperwork')
  /* paperwork already uploaded (on Get paperwork) that nothing was read from yet: read it from here — no second upload */
  const unread = kept.length > 0 && !Object.values(s.tiles[job.id] || {}).some((t) => t.paper) && !(s.hist[job.id] || []).some((h) => /^Read from the tile paperwork/.test(h.title))
  const readKept = async () => {
    const recs = kept.slice(-8)
    const name = recs.length === 1 ? recs[0].name : `${recs.length} files`
    startReading('paperwork', job.id, name)
    const files = (await Promise.all(recs.map(fileBlob))).filter(Boolean) as File[]
    if (!files.length) { failReading('paperwork', job.id, `Couldn’t open ${recs.length === 1 ? recs[0].name : 'the paperwork'}. Upload it here instead.`); return }
    void runRead(job, files, true)
  }
  const go = (l: File[]) => { void runRead(job, l) }
  /* uploaded before and not read yet: read it now — no button */
  React.useEffect(() => {
    if (!unread || st.k !== 'idle' || reading || tried.has(job.id)) return
    tried.add(job.id)
    void readKept()
  }, [unread, job.id])
  if (reading && !reading.failed) return <ReadingCard r={reading} onStop={() => stopRead(job.id)} />
  if (st.k === 'entered') return <Entered job={job} res={st.res} file={st.file} problem={st.problem} before={st.before} tags={st.tags} onDone={() => setRead(job.id, { k: 'idle' })} />
  return (
    <div className="flex flex-col gap-2">
      {reading?.failed && <ReadingCard r={reading} onRetry={lastFiles[job.id] ? () => again(job) : undefined} />}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void go(Array.from(e.dataTransfer.files || [])) }}
        className={cn('flex items-center gap-4 rounded-xl border-2 border-dashed px-4 py-3.5 transition max-sm:flex-wrap', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d8d2c8] bg-[#faf8f5]')}
      >
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-xs"><Sparkles className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          {unread ? (
            <span className="block text-[0.90625rem] font-semibold text-ink">The paperwork is here</span>
          ) : (
            <>
              <span className="block text-[0.90625rem] font-semibold text-ink">Upload the tile paperwork</span>
              <span className="block text-[0.8125rem] text-muted">PDF or photos. It’s read by itself and matched to the scope of work</span>
            </>
          )}
        </span>
        {unread
          ? <span className="flex shrink-0 items-center gap-1.5"><Button size="sm" variant="ghost" icon={<Upload />} onClick={() => input.current?.click()}>Another</Button><Button size="sm" variant="primary" icon={<Sparkles />} onClick={() => void readKept()} data-read-kept>Read it</Button></span>
          : <Button size="sm" variant="primary" icon={<Upload />} onClick={() => input.current?.click()}>Upload</Button>}
        <input ref={input} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; void go(l) }} />
      </div>
      {st.k === 'idle' && st.msg && <div className={cn('flex items-start gap-2 text-[0.8125rem] font-medium', st.tone === 'bad' ? 'text-bad-700' : 'text-warn-800')}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{st.msg}</div>}
      {kept.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {kept.slice(-4).map((f) => (
            <button key={f.id} onClick={() => void showFile(f, kept)} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[0.78125rem] font-medium text-ink-2 hover:border-brand-200 hover:text-brand-700">
              <FileText className="h-3.5 w-3.5 shrink-0 text-faint" /><span className="truncate">{f.name}</span><span className="shrink-0 text-faint">· {f.at} · {sizeLabel(f.size)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** the walls and floors by area, for a picker: each room's name once, its walls and floors under it (a room on the
 *  scope's floor order) */
export function areaOptions(s: { rooms: Record<string, any[]> }, jobId: string, tag?: string, trim?: boolean) {
  const rooms = (s.rooms[jobId] || []) as Room[]
  return floorsOf(rooms).flatMap((g) => g.rooms.flatMap((r) => r.surfaces.filter((x) => takesTile(x.name) || hasTile(x, tag)).map((x) => ({
    key: refKey({ room: r.name, surface: x.name }),
    label: x.name,
    group: r.name,
    hint: x.tile && !hasTile(x, tag) ? (trim ? `Goes with ${x.tile}` : `Has ${x.tile} now`) : x.sf ? `${x.sf} SF` : undefined,
  }))))
}
const areaSummary = (p: { label: string; group?: string }[]) => (p.length > 2 ? `${p[0].group} · ${p[0].label} and ${p.length - 1} more` : p.map((o) => `${o.group} · ${o.label}`).join(', '))
/** is what the paperwork entered on screen to check (the tile list waits under it) */
export const usePaperReview = (jobId: string) => useReads((x) => x.by[jobId]?.k === 'entered')

/** what it entered from the paperwork, to check — laid out like the scope of work: the tiles it couldn't place on top
 *  (each with where it goes, picked by area); then floor by floor, room by room, every wall and floor with its tile —
 *  tap the tile to change it, an amber "Pick a tile" where there's none. Every change is saved as it's made; "Take it
 *  back" undoes it all */
function Entered({ job, res, file, problem, before, tags, onDone }: { job: Job; res: ReadResult; file: string; problem?: string; before: Before; tags: string[]; onDone: () => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const flat = rooms.flatMap((r) => r.surfaces.map((x) => ({ room: r.name, x })))
  const read = Array.from(new Set(tags.filter(Boolean))).map((tag) => s.tiles[job.id]?.[tag]).filter(Boolean) as Tile[]
  const placed = flat.filter((f) => read.some((t) => hasTile(f.x, t.tag))).length
  const loose = read.filter((t) => !flat.some((f) => hasTile(f.x, t.tag)))
  /* the ones it couldn't place stay on top while you check — placed by hand, each says where it went (nothing jumps) */
  const [first] = React.useState(() => loose.map((t) => t.tag))
  const byHand = [...first, ...loose.map((t) => t.tag).filter((tag) => !first.includes(tag))].map((tag) => s.tiles[job.id]?.[tag]).filter(Boolean) as Tile[]
  const empty = flat.filter((f) => takesTile(f.x.name) && !tilesOn(f.x).length)
  const groups = floorsOf(rooms)
  const several = groups.length > 1 || (groups[0] && groups[0].floor !== 'Rooms')
  const takeBack = () => {
    s.commit((st) => {
      st.tiles[job.id] = before.tiles
      st.rooms[job.id] = before.rooms
      addHist(st, job.id, { who: meOf(st.role), kind: 'setup', title: `Took back what was read from ${file}` })
    }, 'Taken back. As it was before the paperwork', { undo: false })
    onDone()
  }
  return (
    <section className="overflow-hidden rounded-xl border border-ok-100 bg-white" data-paper-entered>
      <header className="flex items-start gap-3 bg-ok-50/70 px-4 py-3">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.90625rem] font-semibold text-ink">Read {read.length} tile{read.length === 1 ? '' : 's'} from {file}</span>
          <span className="block text-[0.8125rem] text-ink-2" data-paper-summary>
            {placed} wall{placed === 1 ? '' : 's'} and floors matched
            {loose.length > 0 && <span className="font-semibold text-warn-800"> · {loose.length} to place by hand</span>}
            {empty.length > 0 && <span className="text-muted"> · {empty.length} of ours without a tile</span>}
          </span>
        </span>
      </header>
      {byHand.length > 0 && (
        <div data-paper-loose>
          {loose.length > 0
            ? <div className="border-t border-warn-100 bg-warn-50/60 px-4 py-2 text-[0.8125rem] font-semibold text-warn-800">Not placed yet <span className="font-normal">· pick where each one goes</span></div>
            : <div className="border-t border-line-2 bg-[#faf8f5] px-4 py-2 text-[0.8125rem] font-semibold text-ink-2">Placed by hand</div>}
          {byHand.map((t) => <MatchRow key={t.tag} job={job} t={t} />)}
        </div>
      )}
      <div data-paper-areas>
        <div className="border-t border-line-2 bg-[#faf8f5] px-4 py-2 text-[0.8125rem] font-semibold text-ink-2">By area <span className="font-normal text-muted">· tap a tile to change it</span></div>
        {groups.map((g) => (
          <div key={g.floor}>
            {several && <div className="px-4 py-1.5 text-[0.71875rem] font-bold uppercase tracking-[0.06em] text-white" style={{ background: DOC_GREEN }}>{g.floor}</div>}
            {g.rooms.map((r) => {
              const lines = r.surfaces.filter((x) => takesTile(x.name) || tilesOn(x).length)
              if (!lines.length) return null
              return (
                <div key={r.name} data-paper-room={r.name}>
                  <div className="border-t border-line px-4 py-1.5 text-[0.78125rem] font-bold uppercase tracking-[0.02em] text-[#222]" style={{ background: DOC_GRAY }}>{r.name}</div>
                  {lines.map((x) => <AreaLine key={x.name} job={job} room={r} x={x} />)}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      {res.notes && <div className="flex items-start gap-2 border-t border-line-2 px-4 py-2.5 text-[0.8125rem] text-warn-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{res.notes}</div>}
      {problem && <div className="flex items-start gap-2 border-t border-line-2 px-4 py-2.5 text-[0.8125rem] text-warn-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />The file itself wasn’t kept with the project: {problem}</div>}
      <footer className="flex flex-wrap items-center gap-2 border-t border-line-2 bg-white px-4 py-3">
        <Button variant="ghost" icon={<Undo2 />} onClick={takeBack} data-take-back>Take it back</Button>
        <span className="ml-auto" />
        <Button variant="primary" icon={<Check />} onClick={onDone} data-paper-done>Looks right</Button>
      </footer>
    </section>
  )
}

/** one wall or floor, by area: its name, and its tile — tap it for the tiles (with their pictures) to change it, or
 *  an amber "Pick a tile" when it has none */
function AreaLine({ job, room, x }: { job: Job; room: Room; x: Surface }) {
  const s = useStore()
  const tags = tilesOn(x)
  const ts = tags.map((t) => s.tiles[job.id]?.[t]).filter(Boolean) as Tile[]
  const all = Object.values(s.tiles[job.id] || {}).sort(byTag)
  const flat = (s.rooms[job.id] || []).flatMap((r) => r.surfaces.map((y) => ({ room: r.name, x: y })))
  const g = x.grout || ts[0]?.grout
  const pick = (tag: string) => {
    if (hasTile(x, tag)) return
    const on = flat.filter((f) => hasTile(f.x, tag)).map((f) => ({ room: f.room, surface: f.x.name }))
    setTileOn(job.id, tag, [...on, { room: room.name, surface: x.name }])
  }
  const clear = () => tags.forEach((tag) => setTileOn(job.id, tag, flat.filter((f) => hasTile(f.x, tag) && !(f.room === room.name && f.x.name === x.name)).map((f) => ({ room: f.room, surface: f.x.name }))))
  return (
    <div className="grid min-h-12 grid-cols-[minmax(0,0.75fr)_minmax(0,2fr)_minmax(0,0.9fr)] items-center gap-3 border-t border-line-2 px-4 py-1.5 max-sm:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]" data-paper-line={`${room.name} · ${x.name}`} data-empty={!tags.length || undefined}>
      <span className="min-w-0 truncate text-[0.875rem] text-ink">{x.name}{x.height ? <span className="text-muted"> · {x.height.split(/\s+[—·]\s+|\.\s+(?=[A-Z])|,\s+(?=to\b)/i)[0]}</span> : null}</span>
      <Menu align="start" width={340} trigger={
        tags.length ? (
          <button type="button" className="flex min-w-0 items-center gap-2 rounded-lg py-1 pl-1 pr-2 text-left transition hover:bg-wash" aria-label={`${room.name} · ${x.name}: change its tile`} data-paper-change>
            {ts.map((t) => <TileImg key={t.tag} tile={t} size={32} radius={6} />)}
            <span className="min-w-0 truncate text-[0.875rem] text-ink-2">{ts.map((t, i) => <React.Fragment key={t.tag}>{i ? ' + ' : ''}<b className="font-semibold text-ink">{t.tag}</b> {t.name}</React.Fragment>)}{ts[0]?.size ? <span className="text-muted"> · {ts[0].size}</span> : null}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
          </button>
        ) : (
          <button type="button" className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-warn-300 bg-warn-50/60 px-3 text-[0.8125rem] font-semibold text-warn-800 hover:bg-warn-50" data-paper-pick>Pick a tile<ChevronDown className="h-3.5 w-3.5" /></button>
        )
      }>
        <MenuLabel>{room.name} · {x.name}</MenuLabel>
        {all.map((t) => <MenuItem key={t.tag} icon={<TileImg tile={t} size={24} radius={4} />} checked={hasTile(x, t.tag)} onSelect={() => pick(t.tag)}>{t.tag} {t.name}{t.size ? ` · ${t.size}` : ''}</MenuItem>)}
        {tags.length > 0 && <MenuItem icon={<X className="h-4 w-4" />} onSelect={clear}>No tile here</MenuItem>}
        <MenuItem icon={<Plus className="h-4 w-4" />} onSelect={() => s.open({ t: 'tile', jobId: job.id, room: room.name, surface: x.name })}>A new tile…</MenuItem>
      </Menu>
      <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted max-sm:hidden">{g ? <><GroutDot grout={g} size={12} /><span className="truncate">{GROUTS[g]?.name || g}</span></> : null}</span>
    </div>
  )
}

/** a tile it couldn't place: its picture, name and size, its grout — and where it goes, picked by area */
function MatchRow({ job, t }: { job: Job; t: Tile }) {
  const s = useStore()
  const flat = (s.rooms[job.id] || []).flatMap((r) => r.surfaces.map((x) => ({ room: r.name, x })))
  const opts = areaOptions(s, job.id, t.tag, t.trim)
  const vals = flat.filter((f) => hasTile(f.x, t.tag)).map((f) => refKey({ room: f.room, surface: f.x.name }))
  const loose = !vals.length
  const g = t.grout ? GROUTS[t.grout] : undefined
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,22rem)] items-center gap-x-3 gap-y-2 border-t border-line-2 px-4 py-2.5 max-md:grid-cols-[2.5rem_minmax(0,1fr)]" data-paper-tile={t.tag} data-loose={loose || undefined}>
      <button type="button" onClick={() => s.open({ t: 'tile', jobId: job.id, tag: t.tag })} aria-label={`${t.tag} ${t.name}`} className="shrink-0"><TileImg tile={t} size={40} radius={8} /></button>
      <span className="min-w-0 leading-tight">
        <span className="block break-words text-[0.875rem] text-ink"><b className="font-semibold tnum">{t.tag}</b> {t.name}{t.size ? <span className="text-muted"> · {t.size}</span> : null}{t.trim ? <span className="text-muted"> · trim</span> : null}</span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.78125rem] text-muted">{g ? <><GroutDot grout={t.grout} size={12} /><span className="min-w-0 break-words">{g.name} grout</span></> : <span className="min-w-0 break-words">{t.note || 'No grout on the paperwork'}</span>}</span>
      </span>
      <MultiSelect
        values={vals}
        options={opts}
        label={`Where ${t.tag} goes`}
        placeholder={t.trim ? 'Which walls it finishes' : 'Pick where it goes'}
        searchPlaceholder="Type a room or a wall…"
        width={380}
        className={cn('min-h-9 py-1 text-[0.8125rem] max-md:col-span-2 max-md:col-start-1', loose && 'border-warn-300 bg-warn-50/60 text-warn-800')}
        onChange={(keys) => setTileOn(job.id, t.tag, keys.map((k) => { const [room, surface] = k.split('|'); return { room, surface } }))}
        summary={areaSummary}
      />
    </div>
  )
}
