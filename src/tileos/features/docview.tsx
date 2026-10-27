/* Something opened right where you are — the spec book, the plans, the client's copy — in the window you're in,
 * with "Back" on top. No new tab, no window on a window. A PDF shows in the page, a photo fills it; a document
 * that came in without a file says so and takes the file right there (drop it or pick it). */
import * as React from 'react'
import { ArrowLeft, Upload, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { fileUrl, filesOfDoc, isPdf, isImage, sizeLabel, keepFiles } from '@/tileos/lib/files'
import { docUploaded } from './estflow'

/** the bar on top of something opened inside a window: back, what it is, its buttons */
export function PanelBar({ title, sub, onBack, back = 'Back', right, className }: { title: React.ReactNode; sub?: React.ReactNode; onBack: () => void; back?: string; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('sticky top-0 z-[6] flex min-h-[3.25rem] items-center gap-3 border-b border-line bg-white px-4 py-2 max-sm:gap-2 max-sm:px-3', className)} data-panelbar>
      <button onClick={onBack} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[0.84375rem] font-semibold text-brand-700 transition hover:bg-brand-50">
        <ArrowLeft className="h-4 w-4" />
        <span className="max-sm:hidden">{back}</span>
      </button>
      <span className="h-5 w-px shrink-0 bg-line" />
      <span className="min-w-0 flex-1 truncate">
        <b className="text-[0.9375rem] font-semibold text-ink">{title}</b>
        {sub && <span className="ml-2 text-[0.8125rem] text-muted max-sm:hidden">{sub}</span>}
      </span>
      {right && <span className="flex shrink-0 items-center gap-2">{right}</span>}
    </div>
  )
}

/** one of the estimate's documents ("Spec book"), or any file by its id, shown in place */
export function DocPanel({ jobId, doc, fileId, onBack, back }: { jobId: string; doc?: string; fileId?: string; onBack: () => void; back?: string }) {
  const s = useStore()
  const list = doc ? filesOfDoc(s.files, jobId, doc) : s.files.filter((f) => f.id === fileId)
  const [pick, setPick] = React.useState<string | null>(null)
  const rec = list.find((f) => f.id === pick) || list[list.length - 1]
  const [url, setUrl] = React.useState<string | undefined>()
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [over, setOver] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const meta = doc ? s.pricing[jobId]?.docs.find((d) => d.name === doc) : undefined
  React.useEffect(() => {
    let live = true
    setUrl(undefined)
    if (!rec) return
    setLoading(true)
    fileUrl(rec)
      .then((u) => { if (live) setUrl(u) })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [rec?.id])
  const up = async (fl: File[]) => {
    if (!fl.length) return
    setBusy(true)
    /* the tile paperwork is the paperwork step's — it goes where that step and the AI read it */
    if (doc === 'Tile paperwork') await keepFiles(jobId, fl, 'paperwork')
    else if (doc) await docUploaded(jobId, doc, fl)
    else await keepFiles(jobId, fl, 'other')
    setBusy(false)
    setPick(null)
  }
  const word = doc ? doc.toLowerCase().replace(/^plans$/, 'plans') : 'file'
  return (
    <div
      className="relative flex h-full min-h-[70vh] flex-col bg-[#e9e6e0]"
      data-panel="doc"
      onDragOver={(e) => { if (!doc) return; e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!doc) return; e.preventDefault(); setOver(false); void up(Array.from(e.dataTransfer.files || [])) }}
    >
      <PanelBar
        title={doc || rec?.name || 'File'}
        sub={rec ? `${rec.name} · ${sizeLabel(rec.size)}` : meta?.status === 'in' ? 'came in — no file kept here yet' : meta ? 'missing' : undefined}
        onBack={onBack}
        back={back}
        right={
          <>
            {list.length > 1 && (
              <select aria-label="Which version" value={rec?.id} onChange={(e) => setPick(e.target.value)} className="h-9 max-w-[11rem] rounded-lg border border-line bg-white px-2 text-[0.8125rem] text-ink-2 max-sm:hidden">
                {[...list].reverse().map((f, i) => <option key={f.id} value={f.id}>{i === 0 ? 'Newest · ' : ''}{f.name}</option>)}
              </select>
            )}
            {url && <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.8125rem] font-semibold text-ink-2 hover:bg-wash max-sm:hidden"><ExternalLink className="h-4 w-4" />New tab</a>}
            {doc && rec && <Button size="sm" icon={<Upload />} disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Adding…' : 'Newer version'}</Button>}
          </>
        }
      />
      <input ref={input} type="file" accept=".pdf,image/*" multiple={!doc} className="hidden" aria-label={doc ? `Upload the ${word}` : 'Upload a file'} onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; void up(f) }} />
      <div className="relative min-h-0 flex-1">
        {!rec ? (
          <div className="flex h-full items-center justify-center p-6">
            <button onClick={() => input.current?.click()} disabled={busy} className={cn('flex w-full max-w-[26rem] flex-col items-center gap-3 rounded-2xl border-2 border-dashed bg-white px-6 py-10 text-center transition', over ? 'border-brand-500 bg-brand-50' : 'border-[#d6cfc3] hover:border-brand-300')}>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileText className="h-6 w-6" />}</span>
              <span className="text-[1rem] font-semibold text-ink">{busy ? 'Adding it…' : meta?.status === 'missing' ? `The ${word} isn’t in yet` : `No file for the ${word} yet`}</span>
              <span className="text-[0.84375rem] text-muted">{meta?.status === 'in' && meta.note ? `Marked as in (${meta.note}). ` : ''}Drop the PDF here, or tap to pick it — it opens right here after.</span>
              <span className="mt-1 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-[0.875rem] font-semibold text-white"><Upload className="h-4 w-4" />Upload the {word}</span>
            </button>
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-[0.875rem] text-muted"><Loader2 className="h-5 w-5 animate-spin" />Opening {rec.name}…</div>
        ) : !url ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-[0.9375rem] font-semibold text-ink">{rec.name} isn’t kept here anymore</span>
            <span className="max-w-[26rem] text-[0.84375rem] text-muted">The preview only keeps files while the page is open. In the real app they stay with the project.</span>
            {doc && <Button variant="primary" icon={<Upload />} onClick={() => input.current?.click()}>Upload it again</Button>}
          </div>
        ) : isPdf(rec) ? (
          <iframe title={rec.name} src={url} className="absolute inset-0 h-full w-full border-0 bg-white" />
        ) : isImage(rec) ? (
          <img src={url} alt={rec.name} className="absolute inset-0 m-auto max-h-full max-w-full object-contain p-4" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <FileText className="h-8 w-8 text-muted" />
            <span className="text-[0.9375rem] font-semibold text-ink">{rec.name}</span>
            <a href={url} download={rec.name} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-[0.875rem] font-semibold text-white">Download it</a>
          </div>
        )}
        {over && rec && <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/90 text-[1rem] font-semibold text-brand-700">Drop it — it becomes the newest {word}</div>}
      </div>
    </div>
  )
}

/** a kept file opened from somewhere that isn't a window (a message, a list) — the same viewer, in its own window */
export function FileModal({ id, back, level }: { id: string; back?: string; level: number }) {
  const s = useStore()
  const rec = s.files.find((f) => f.id === id)
  return (
    <Modal level={level} size="xl" tall onClose={s.close} title={rec?.name || 'File'} header={<span className="sr-only">{rec?.name || 'File'}</span>} bodyClass="p-0">
      {rec ? <div className="h-full [&_[data-panelbar]]:pr-14"><DocPanel jobId={rec.jobId} fileId={rec.id} onBack={s.close} back={back || 'Back'} /></div> : <div className="p-10 text-center text-[0.875rem] text-muted">This file isn’t here anymore.</div>}
    </Modal>
  )
}
