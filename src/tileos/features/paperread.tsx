/* Upload the tile paperwork and let AI read it: every tile on it — tag, name, size, grout, how much — matched to the
 * walls and floors from the estimate. You see what it found, untick anything that's wrong, and use it. The file
 * stays with the project. */
import * as React from 'react'
import { Sparkles, Upload, Loader2, FileText, Check, X, CircleAlert } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { Status } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { REAL } from '@/tileos/lib/save'
import { keepFiles, openFile, sizeLabel } from '@/tileos/lib/files'
import { GROUTS, byTag, type Tile } from '@/tileos/data/jobs'
import type { Job } from '@/tileos/data/model'
import { readTilePaperwork, ReadError, labelOf, type ReadResult, type ReadTile } from './reader'
import { takesTile } from './steps'
import { applyRead } from './tiles'

type State =
  | { k: 'idle'; msg?: string; tone?: 'bad' | 'warn' }
  | { k: 'reading'; name: string; n: number }
  | { k: 'review'; res: ReadResult; file: string; problem?: string }

/** the drop zone, the reading, and the review — at the top of the paperwork step */
export function PaperRead({ job }: { job: Job }) {
  const s = useStore()
  const [st, setSt] = React.useState<State>({ k: 'idle' })
  const [over, setOver] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const ctl = React.useRef<AbortController | null>(null)
  React.useEffect(() => () => ctl.current?.abort(), [])
  const kept = s.files.filter((f) => f.jobId === job.id && f.kind === 'paperwork')
  const go = async (list: File[]) => {
    const files = list.filter((f) => /pdf|image/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name))
    if (!files.length) { setSt({ k: 'idle', msg: 'Pick a PDF or photos of the paperwork.', tone: 'warn' }); return }
    const name = files.length === 1 ? files[0].name : `${files.length} files`
    setSt({ k: 'reading', name, n: files.length })
    ctl.current?.abort()
    const c = (ctl.current = new AbortController())
    const keep = keepFiles(job.id, files, 'paperwork', { quiet: true })
    try {
      const st0 = useStore.getState()
      const res = await readTilePaperwork(job, st0.rooms[job.id] || [], Object.values(st0.tiles[job.id] || {}).sort(byTag), files, c.signal)
      if (c.signal.aborted) return
      const { problem } = await keep
      if (!res.tiles.length) { setSt({ k: 'idle', msg: `No tiles found on ${name}.${res.notes ? ` ${res.notes}` : ''}`, tone: 'warn' }); return }
      setSt({ k: 'review', res, file: name, problem })
    } catch (e: any) {
      if (c.signal.aborted || e?.code === 'cancelled') { setSt({ k: 'idle' }); return }
      setSt({ k: 'idle', msg: e instanceof ReadError ? e.message : 'Couldn’t read it just now — try again.', tone: 'bad' })
    }
  }
  if (st.k === 'review') return <Review job={job} res={st.res} file={st.file} problem={st.problem} onDone={() => setSt({ k: 'idle' })} />
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
              <span className="block text-[0.8125rem] text-muted">Every tile, its size, grout and how much — matched to the walls and floors. Up to a minute.</span>
            </>
          ) : (
            <>
              <span className="block text-[0.90625rem] font-semibold text-ink">Upload the tile paperwork — AI reads it</span>
              <span className="block text-[0.8125rem] text-muted">PDF or photos. It finds every tile and matches it to the walls and floors from the estimate.</span>
            </>
          )}
        </span>
        {st.k === 'reading'
          ? <Button size="sm" variant="ghost" icon={<X />} onClick={() => { ctl.current?.abort(); setSt({ k: 'idle' }) }}>Stop</Button>
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

/** what the AI found — untick what's wrong, then use it */
function Review({ job, res, file, problem, onDone }: { job: Job; res: ReadResult; file: string; problem?: string; onDone: () => void }) {
  const s = useStore()
  const mine = s.tiles[job.id] || {}
  const [on, setOn] = React.useState<boolean[]>(() => res.tiles.map(() => true))
  const picked = res.tiles.filter((_, i) => on[i])
  const matched = picked.reduce((n, t) => n + t.goesOn.length, 0)
  /* what isn't matched: tile on the paperwork with no wall or floor, and our walls and floors nothing on it covers */
  const covered = new Set(picked.flatMap((t) => t.goesOn))
  const loose = picked.filter((t) => !t.goesOn.length)
  const uncovered = (s.rooms[job.id] || []).flatMap((r) => r.surfaces.filter((x) => takesTile(x.name) && !x.tile).map((x) => labelOf(r.name, x.name))).filter((l) => !covered.has(l))
  return (
    <section className="overflow-hidden rounded-xl border border-brand-200">
      <header className="flex items-center gap-3 bg-brand-50/60 px-4 py-3">
        <Sparkles className="h-4 w-4 shrink-0 text-brand-600" />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.90625rem] font-semibold text-ink">Found {res.tiles.length} tile{res.tiles.length === 1 ? '' : 's'} on {file}</span>
          <span className="block text-[0.78125rem] text-muted">{res.pages} page{res.pages === 1 ? '' : 's'} read{REAL.cloud ? '' : ' by Claude'} · untick anything that’s wrong — you can fix the rest below</span>
        </span>
      </header>
      {res.tiles.map((t, i) => <ReadRow key={i} t={t} on={on[i]} same={(t.tag && mine[t.tag]) || Object.values(mine).find((x) => x.name.toLowerCase() === t.name.toLowerCase())} toggle={() => setOn(on.map((v, j) => (j === i ? !v : v)))} />)}
      {(loose.length > 0 || uncovered.length > 0) && (
        <div className="border-t border-line-2 bg-warn-50/50 px-4 py-3 text-[0.8125rem]">
          <div className="font-semibold text-warn-800">Not matched yet</div>
          {loose.length > 0 && <div className="mt-1 text-ink-2"><b className="font-semibold">On the paperwork, no wall or floor:</b> {loose.map((t) => [t.tag, t.name].filter(Boolean).join(' ')).join(', ')}</div>}
          {uncovered.length > 0 && <div className="mt-1 text-ink-2"><b className="font-semibold">Ours, not on the paperwork:</b> {uncovered.slice(0, 8).join(', ')}{uncovered.length > 8 ? ` and ${uncovered.length - 8} more` : ''}</div>}
          <div className="mt-1 text-muted">Use it anyway — then match the rest below, one tap each.</div>
        </div>
      )}
      {res.notes && <div className="flex items-start gap-2 border-t border-line-2 px-4 py-2.5 text-[0.8125rem] text-warn-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{res.notes}</div>}
      {problem && <div className="flex items-start gap-2 border-t border-line-2 px-4 py-2.5 text-[0.8125rem] text-warn-800"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />The file itself wasn’t kept with the project: {problem}</div>}
      <footer className="flex flex-wrap items-center gap-2 border-t border-line-2 bg-white px-4 py-3">
        <span className="text-[0.8125rem] text-muted">{picked.length} tile{picked.length === 1 ? '' : 's'} · {matched} wall{matched === 1 ? '' : 's'} and floors</span>
        <span className="ml-auto" />
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button variant="primary" icon={<Check />} disabled={!picked.length} onClick={() => { applyRead(job.id, picked, { file }); onDone() }}>Use it</Button>
      </footer>
    </section>
  )
}
function ReadRow({ t, on, same, toggle }: { t: ReadTile; on: boolean; same?: Tile; toggle: () => void }) {
  const g = t.grout ? Object.entries(GROUTS).find(([, x]) => t.grout!.toLowerCase().includes(x.name.toLowerCase())) : undefined
  return (
    <label className={cn('flex cursor-pointer items-start gap-3 border-t border-line-2 px-4 py-3 transition', !on && 'opacity-50')}>
      <input type="checkbox" checked={on} onChange={toggle} className="mt-1 h-4 w-4 shrink-0 accent-[#2650cf]" />
      {same ? <TileImg tile={same} size={36} radius={7} /> : <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.4375rem] bg-wash text-[0.6875rem] font-bold text-muted">{t.tag || 'New'}</span>}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[0.875rem] font-semibold text-ink">{[t.tag, t.name].filter(Boolean).join(' ')}</span>
          <Status tone={same ? 'info' : 'ok'}>{same ? `Same as ${same.tag}` : 'New tile'}</Status>
        </span>
        <span className="mt-0.5 block text-[0.78125rem] text-muted">{[t.size, t.finish, t.maker, t.supplier].filter(Boolean).join(' · ') || 'No details on the paperwork'}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.78125rem]">
          {t.qty ? <span className="font-semibold text-ink-2">{t.qty.toLocaleString('en-US')} {t.unit === 'boxes' ? 'boxes' : 'SF'}{t.boxSF ? ` · ${t.boxSF} SF a box` : ''}</span> : <span className="text-warn-700">No quantity on it</span>}
          {t.grout && <span className="inline-flex items-center gap-1 text-ink-2">{g ? <GroutDot grout={g[0]} size={12} /> : null}{t.grout} grout</span>}
          {t.joint && <span className="text-muted">{t.joint} joint</span>}
        </span>
        <span className={cn('mt-1 block text-[0.78125rem]', t.goesOn.length ? 'text-ink-2' : 'text-warn-700')}>{t.goesOn.length ? `Goes on ${t.goesOn.join(', ')}` : 'Doesn’t say where it goes — pick it below after'}</span>
        {t.note && <span className="mt-0.5 block text-[0.75rem] text-muted">{t.note}</span>}
      </span>
    </label>
  )
}
