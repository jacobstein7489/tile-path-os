/* Upload the tile paperwork and AI reads it and enters it by itself: every tile on it — tag, name, size, grout, how
 * much, how it's laid, the edges (mitered or which metal), how high — matched to the walls and floors from the
 * estimate. What it entered shows right after, with anything it couldn't match; "Take it back" undoes it all. Paperwork
 * uploaded earlier that nothing was read from yet is read the moment this opens. The file stays with the project. */
import * as React from 'react'
import { create } from 'zustand'
import { Sparkles, Upload, Loader2, FileText, Check, X, CircleAlert, Undo2 } from 'lucide-react'
import { useStore, addHist, meOf } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { Status } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { REAL } from '@/tileos/lib/save'
import { keepFiles, openFile, sizeLabel, fileBlob } from '@/tileos/lib/files'
import { GROUTS, byTag, type Tile } from '@/tileos/data/jobs'
import type { Job } from '@/tileos/data/model'
import { readTilePaperwork, ReadError, labelOf, type ReadResult, type ReadTile } from './reader'
import { takesTile } from './steps'
import { applyRead } from './tiles'

type Before = { tiles: Record<string, Tile>; rooms: any[] }
type State =
  | { k: 'idle'; msg?: string; tone?: 'bad' | 'warn' }
  | { k: 'reading'; name: string; n: number }
  | { k: 'entered'; res: ReadResult; file: string; problem?: string; before: Before }
/* paperwork already uploaded is read once by itself on each project (again only with a tap) */
const tried = new Set<string>()
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? null))

/* the reading runs on its own — closing the window, or the step turning done when the file lands, doesn't stop it;
   when it's done it's entered, and the pop-up says so (with Undo) wherever you are */
const useReads = create<{ by: Record<string, State> }>(() => ({ by: {} }))
const setRead = (jobId: string, st: State) => useReads.setState((x) => ({ by: { ...x.by, [jobId]: st } }))
const ctls: Record<string, AbortController> = {}
export function stopRead(jobId: string) { ctls[jobId]?.abort(); setRead(jobId, { k: 'idle' }) }
/** the paperwork is being read on this project, or what it entered is on screen — its window stays open for it */
export const useReadBusy = (jobId: string) => useReads((x) => { const k = x.by[jobId]?.k; return k === 'reading' || k === 'entered' })
/** how its reading is going, in a few words — 'reading', what went wrong, or '' — for a window that started it */
export const useReadWords = (jobId: string) => useReads((x) => { const r = x.by[jobId]; return r?.k === 'reading' ? 'reading' : r?.k === 'idle' && r.msg ? r.msg : '' })
async function runRead(job: Job, list: File[], already?: boolean) {
  const files = list.filter((f) => /pdf|image/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name))
  if (!files.length) { setRead(job.id, { k: 'idle', msg: 'Pick a PDF or photos of the paperwork.', tone: 'warn' }); return }
  const name = files.length === 1 ? files[0].name : `${files.length} files`
  setRead(job.id, { k: 'reading', name, n: files.length })
  ctls[job.id]?.abort()
  const c = (ctls[job.id] = new AbortController())
  /* the file is kept first — it stays with the project whatever the reading says */
  const kept = already ? { problem: undefined as string | undefined } : await keepFiles(job.id, files, 'paperwork', { quiet: true }).catch((e: any) => ({ problem: String(e?.message || e) }))
  try {
    const st0 = useStore.getState()
    const res = await readTilePaperwork(job, st0.rooms[job.id] || [], Object.values(st0.tiles[job.id] || {}).sort(byTag), files, c.signal)
    if (c.signal.aborted) return
    if (!res.tiles.length) { setRead(job.id, { k: 'idle', msg: `No tiles found on ${name}.${res.notes ? ` ${res.notes}` : ''}`, tone: 'warn' }); return }
    /* entered right away — what was there before is kept, so it can be taken back */
    const st1 = useStore.getState()
    const before: Before = { tiles: copy(st1.tiles[job.id] || {}), rooms: copy(st1.rooms[job.id] || []) }
    applyRead(job.id, res.tiles, { file: name, rooms: res.rooms })
    setRead(job.id, { k: 'entered', res, file: name, problem: kept.problem, before })
  } catch (e: any) {
    if (c.signal.aborted || e?.code === 'cancelled') { setRead(job.id, { k: 'idle' }); return }
    setRead(job.id, { k: 'idle', msg: e instanceof ReadError ? e.message : 'Couldn’t read it just now — try again.', tone: 'bad' })
  } finally { if (ctls[job.id] === c) delete ctls[job.id] }
}

/** read a project's tile paperwork and enter it (bringing a project in with its paperwork) — kept with the project
 *  first, then read; the pop-up says what was entered */
export const readPaperworkFor = (job: Job, files: File[]) => runRead(job, files)

/** the drop zone, the reading, and what it entered — at the top of the paperwork steps */
export function PaperRead({ job }: { job: Job }) {
  const s = useStore()
  const st = useReads((x) => x.by[job.id]) || ({ k: 'idle' } as State)
  const [over, setOver] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const kept = s.files.filter((f) => f.jobId === job.id && f.kind === 'paperwork')
  /* paperwork already uploaded (on Get paperwork) that nothing was read from yet: read it from here — no second upload */
  const unread = kept.length > 0 && !Object.values(s.tiles[job.id] || {}).some((t) => t.paper) && !(s.hist[job.id] || []).some((h) => /^Read from the tile paperwork/.test(h.title))
  const readKept = async () => {
    const recs = kept.slice(-8)
    setRead(job.id, { k: 'reading', name: recs.length === 1 ? recs[0].name : `${recs.length} files`, n: recs.length })
    const files = (await Promise.all(recs.map(fileBlob))).filter(Boolean) as File[]
    if (!files.length) { setRead(job.id, { k: 'idle', msg: `Couldn’t open ${recs.length === 1 ? recs[0].name : 'the paperwork'} — upload it here instead.`, tone: 'warn' }); return }
    void runRead(job, files, true)
  }
  const go = (l: File[]) => { void runRead(job, l) }
  /* uploaded before and not read yet: read it now — no button */
  React.useEffect(() => {
    if (!unread || st.k !== 'idle' || tried.has(job.id)) return
    tried.add(job.id)
    void readKept()
  }, [unread, job.id])
  if (st.k === 'entered') return <Entered job={job} res={st.res} file={st.file} problem={st.problem} before={st.before} onDone={() => setRead(job.id, { k: 'idle' })} />
  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (st.k !== 'reading') void go(Array.from(e.dataTransfer.files || [])) }}
        className={cn('flex items-center gap-4 rounded-xl border-2 border-dashed px-4 py-3.5 transition max-sm:flex-wrap', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d8d2c8] bg-[#faf8f5]')}
      >
        <span className={cn('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', st.k === 'reading' ? 'bg-brand-50 text-brand-600' : 'bg-white text-brand-600 shadow-xs')}>
          {st.k === 'reading' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          {st.k === 'reading' ? (
            <>
              <span className="block truncate text-[0.90625rem] font-semibold text-ink">Reading {st.name}…</span>
              <span className="block text-[0.8125rem] text-muted">Every tile, its size, grout and how much — matched to the walls and floors. Up to a minute; you can close this, it keeps going.</span>
            </>
          ) : unread ? (
            <>
              <span className="block text-[0.90625rem] font-semibold text-ink">The paperwork is here — AI reads it</span>
              <span className="block text-[0.8125rem] text-muted">It finds every tile and matches it to the walls and floors from the estimate.</span>
            </>
          ) : (
            <>
              <span className="block text-[0.90625rem] font-semibold text-ink">Upload the tile paperwork — AI reads it</span>
              <span className="block text-[0.8125rem] text-muted">PDF or photos. It finds every tile and matches it to the walls and floors from the estimate.</span>
            </>
          )}
        </span>
        {st.k === 'reading'
          ? <Button size="sm" variant="ghost" icon={<X />} onClick={() => stopRead(job.id)}>Stop</Button>
          : unread
            ? <span className="flex shrink-0 items-center gap-1.5"><Button size="sm" variant="ghost" icon={<Upload />} onClick={() => input.current?.click()}>Another</Button><Button size="sm" variant="primary" icon={<Sparkles />} onClick={() => void readKept()} data-read-kept>Read it</Button></span>
            : <Button size="sm" variant="primary" icon={<Upload />} onClick={() => input.current?.click()}>Upload</Button>}
        <input ref={input} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; void go(l) }} />
      </div>
      {st.k === 'idle' && st.msg && <div className={cn('mt-2 flex items-start gap-2 text-[0.8125rem] font-medium', st.tone === 'bad' ? 'text-bad-700' : 'text-warn-800')}><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{st.msg}</div>}
      {kept.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {kept.slice(-4).map((f) => (
            <button key={f.id} onClick={() => openFile(f)} className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[0.78125rem] font-medium text-ink-2 hover:border-brand-200 hover:text-brand-700">
              <FileText className="h-3.5 w-3.5 shrink-0 text-faint" /><span className="truncate">{f.name}</span><span className="shrink-0 text-faint">· {f.at} · {sizeLabel(f.size)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** what it entered from the paperwork — and what it couldn't match, to fix below; "Take it back" undoes it all */
function Entered({ job, res, file, problem, before, onDone }: { job: Job; res: ReadResult; file: string; problem?: string; before: Before; onDone: () => void }) {
  const s = useStore()
  const matched = res.tiles.reduce((n, t) => n + t.goesOn.length, 0)
  const covered = new Set(res.tiles.flatMap((t) => t.goesOn))
  const loose = res.tiles.filter((t) => !t.goesOn.length)
  const uncovered = (s.rooms[job.id] || []).flatMap((r) => r.surfaces.filter((x) => takesTile(x.name) && !x.tile).map((x) => labelOf(r.name, x.name))).filter((l) => !covered.has(l))
  const takeBack = () => {
    s.commit((st) => {
      st.tiles[job.id] = before.tiles
      st.rooms[job.id] = before.rooms
      addHist(st, job.id, { who: meOf(st.role), kind: 'setup', title: `Took back what was read from ${file}` })
    }, 'Taken back — as it was before the paperwork', { undo: false })
    onDone()
  }
  return (
    <section className="overflow-hidden rounded-xl border border-ok-100" data-paper-entered>
      <header className="flex items-center gap-3 bg-ok-50/70 px-4 py-3">
        <Check className="h-4 w-4 shrink-0 text-ok-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.90625rem] font-semibold text-ink">Entered {res.tiles.length} tile{res.tiles.length === 1 ? '' : 's'} from {file}</span>
          <span className="block text-[0.78125rem] text-muted">{matched} wall{matched === 1 ? '' : 's'} and floors matched · {res.pages} page{res.pages === 1 ? '' : 's'} read — fix anything below, one tap each</span>
        </span>
      </header>
      {res.tiles.map((t, i) => <ReadRow key={i} t={t} same={s.tiles[job.id]?.[t.tag] || Object.values(s.tiles[job.id] || {}).find((x) => x.name.toLowerCase() === t.name.toLowerCase())} />)}
      {(loose.length > 0 || uncovered.length > 0) && (
        <div className="border-t border-line-2 bg-warn-50/50 px-4 py-3 text-[0.8125rem]">
          <div className="font-semibold text-warn-800">Not matched yet</div>
          {loose.length > 0 && <div className="mt-1 text-ink-2"><b className="font-semibold">On the paperwork, no wall or floor:</b> {loose.map((t) => [t.tag, t.name].filter(Boolean).join(' ')).join(', ')}</div>}
          {uncovered.length > 0 && <div className="mt-1 text-ink-2"><b className="font-semibold">Ours, not on the paperwork:</b> {uncovered.slice(0, 8).join(', ')}{uncovered.length > 8 ? ` and ${uncovered.length - 8} more` : ''}</div>}
          <div className="mt-1 text-muted">Match the rest below — one tap each.</div>
        </div>
      )}
      {res.notes && <div className="flex items-start gap-2 border-t border-line-2 px-4 py-2.5 text-[0.8125rem] text-warn-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{res.notes}</div>}
      {problem && <div className="flex items-start gap-2 border-t border-line-2 px-4 py-2.5 text-[0.8125rem] text-warn-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />The file itself wasn’t kept with the project: {problem}</div>}
      <footer className="flex flex-wrap items-center gap-2 border-t border-line-2 bg-white px-4 py-3">
        <Button variant="ghost" icon={<Undo2 />} onClick={takeBack} data-take-back>Take it back</Button>
        <span className="ml-auto" />
        <Button variant="primary" icon={<Check />} onClick={onDone}>Looks right</Button>
      </footer>
    </section>
  )
}
function ReadRow({ t, same }: { t: ReadTile; same?: Tile }) {
  const g = t.grout ? Object.entries(GROUTS).find(([, x]) => t.grout!.toLowerCase().includes(x.name.toLowerCase())) : undefined
  const more = [t.layout, t.edge ? `Edges: ${t.edge}` : '', t.height].filter(Boolean)
  return (
    <div className="flex items-start gap-3 border-t border-line-2 px-4 py-3" data-read-row={t.tag || t.name}>
      {same ? <TileImg tile={same} size={36} radius={7} /> : <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.4375rem] bg-wash text-[0.6875rem] font-bold text-muted">{t.tag || 'New'}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[0.875rem] font-semibold text-ink">{same ? `${same.tag} ${same.name}` : [t.tag, t.name].filter(Boolean).join(' ')}</span>
        </span>
        <span className="mt-0.5 block text-[0.78125rem] text-muted">{[t.size, t.finish, t.maker, t.supplier].filter(Boolean).join(' · ') || 'No details on the paperwork'}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78125rem]">
          {t.qty ? <span className="font-semibold text-ink-2">{t.qty.toLocaleString('en-US')} {t.unit === 'boxes' ? 'boxes' : 'SF'}{t.boxSF ? ` · ${t.boxSF} SF a box` : ''}</span> : <span className="text-warn-700">No quantity on it</span>}
          {t.grout && <span className="inline-flex items-center gap-1 text-ink-2">{g ? <GroutDot grout={g[0]} size={12} /> : null}{t.grout} grout</span>}
          {t.joint && <span className="text-muted">{t.joint} joint</span>}
        </span>
        {more.length > 0 && <span className="mt-0.5 block text-[0.78125rem] text-ink-2">{more.join(' · ')}</span>}
        <span className={cn('mt-1 block text-[0.78125rem]', t.goesOn.length ? 'text-ink-2' : 'text-warn-700')}>{t.goesOn.length ? `Goes on ${t.goesOn.join(', ')}` : 'Doesn’t say where it goes — pick it below'}</span>
        {t.note && <span className="mt-0.5 block text-[0.75rem] text-muted">{t.note}</span>}
      </span>
    </div>
  )
}
