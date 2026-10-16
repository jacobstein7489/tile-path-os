import * as React from 'react'
import { refFor, refLabel } from '../activity'
import { FileText, Map, BookOpen, Palette, ScrollText, FileSignature, Package2, Upload, CheckCircle2, Camera, HardHat, ArrowLeftRight, HelpCircle, Package, Wallet, CalendarDays, Gavel, LayoutGrid, Sparkles, Loader2, MoreHorizontal, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore, historyOf } from '@/tileos/store'
import { Card, CardHeader, Button, Pill, Avatar, Chip, Empty } from '@/tileos/components/ui/core'
import { Swatch } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type SwatchKey } from '@/tileos/data/model'
import { filesFor, type HistKind, type FileRec } from '@/tileos/data/jobs'
import { Menu, MenuItem } from '@/tileos/components/ui/overlay'
import { REAL, useSaveStatus } from '@/tileos/lib/save'
import { keepFiles, openFile, removeFile, fileUrl, sizeLabel, KIND_LABEL } from '@/tileos/lib/files'
import { shiftText, NOW } from '@/tileos/lib/today'

const KIND_ICON: Record<string, React.ElementType> = { plans: Map, spec: BookOpen, finish: Palette, paperwork: ScrollText, proposal: FileText, contract: FileSignature, package: Package2, photo: Camera, other: FileText }
const ACCEPT: Record<FileRec['kind'], string> = { paperwork: 'application/pdf,image/*', plans: 'application/pdf,image/*', photo: 'image/*', other: '' }
const ORDER: FileRec['kind'][] = ['paperwork', 'plans', 'photo', 'other']

/** a project's files and photos: the tile paperwork, plans and specs, site photos — add them, open them, remove them */
export function FilesTab({ job }: { job: Job }) {
  const s = useStore()
  const st = useSaveStatus()
  const mine = s.files.filter((f) => f.jobId === job.id)
  /* the sample's documents and photos show only while the sample is open */
  const sampleOn = st.mode === 'sample' && st.where !== 'cloud'
  const sample = sampleOn ? filesFor(job.id) : []
  const input = React.useRef<HTMLInputElement>(null)
  const [kind, setKind] = React.useState<FileRec['kind']>('photo')
  const [busy, setBusy] = React.useState<FileRec['kind'] | null>(null)
  const [over, setOver] = React.useState(false)
  const pick = (k: FileRec['kind']) => {
    setKind(k)
    requestAnimationFrame(() => { if (input.current) { input.current.accept = ACCEPT[k]; input.current.click() } })
  }
  const add = async (list: File[], k: FileRec['kind']) => {
    if (!list.length) return
    setBusy(k)
    const { problem } = await keepFiles(job.id, list, k)
    setBusy(null)
    if (problem) toast(`Not kept — ${problem}`)
  }
  const kindOfFile = (f: File): FileRec['kind'] => (/^image\//.test(f.type) ? 'photo' : 'other')
  const photos = mine.filter((f) => f.kind === 'photo')
  const docs = mine.filter((f) => f.kind !== 'photo')
  return (
    <div
      className="flex flex-col gap-5"
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false) }}
      onDrop={(e) => { e.preventDefault(); setOver(false); const l = Array.from(e.dataTransfer.files || []); const ph = l.filter((f) => kindOfFile(f) === 'photo'); const rest = l.filter((f) => kindOfFile(f) !== 'photo'); void add(ph, 'photo').then(() => add(rest, 'other')) }}
    >
      <input ref={input} type="file" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; void add(l, kind) }} />
      <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d8d2c8] bg-[#faf8f5]')}>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-xs">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.90625rem] font-semibold text-ink">{busy ? `Adding ${KIND_LABEL[busy].toLowerCase()}…` : 'Add files and photos'}</span>
          <span className="block text-[0.8125rem] text-muted">The tile paperwork, plans and spec book, site photos — drop them here or pick them.{REAL.cloud ? '' : ' (The preview keeps them only while it’s open.)'}</span>
        </span>
        <span className="flex flex-wrap gap-2">
          <Button size="sm" icon={<Camera />} onClick={() => pick('photo')}>Photos</Button>
          <Button size="sm" icon={<ScrollText />} onClick={() => pick('paperwork')}>Tile paperwork</Button>
          <Button size="sm" icon={<Map />} onClick={() => pick('plans')}>Plans</Button>
          <Button size="sm" variant="ghost" onClick={() => pick('other')}>Other</Button>
        </span>
      </div>

      {ORDER.filter((k) => k !== 'photo' && docs.some((f) => f.kind === k)).map((k) => (
        <Card key={k}>
          <CardHeader title={KIND_LABEL[k]} count={docs.filter((f) => f.kind === k).length} />
          <div className="px-3 pb-3">{docs.filter((f) => f.kind === k).slice().reverse().map((f) => <DocRow key={f.id} f={f} />)}</div>
        </Card>
      ))}

      {photos.length > 0 && (
        <Card>
          <CardHeader title="Photos" count={photos.length} />
          <div className="grid grid-cols-6 gap-3 px-6 pb-6 max-md:grid-cols-4 max-sm:grid-cols-3 max-sm:gap-2 max-sm:px-4">
            {photos.slice().reverse().map((f) => <PhotoTile key={f.id} f={f} all={photos} />)}
          </div>
        </Card>
      )}

      {!mine.length && !sample.length && <div className="rounded-xl border border-line px-5 py-8 text-center text-[0.875rem] text-muted">No files yet. The tile paperwork read on the paperwork step lands here too.</div>}

      {sample.length > 0 && (
        <Card>
          <CardHeader title="Sample documents" count={sample.length} />
          <div className="grid grid-cols-3 gap-3 px-6 pb-6 max-md:grid-cols-1 max-sm:px-4">
            {sample.map((f) => {
              const Ic = KIND_ICON[f.kind] || FileText
              return (
                <button key={f.name} onClick={() => toast(`${f.name} — a sample document`)} className="flex items-start gap-3.5 rounded-2xl border border-line p-4 text-left transition hover:bg-wash">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Ic className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.90625rem] font-semibold text-ink">{f.name}</span>
                    <span className="mt-0.5 block text-[0.78125rem] text-muted">{f.rev} · {f.date}</span>
                    {f.note && <span className="mt-1 block truncate text-[0.78125rem] text-muted">{f.note}</span>}
                  </span>
                  {f.current && <Pill tone="ok" size="sm"><CheckCircle2 className="h-3 w-3" />Current</Pill>}
                </button>
              )
            })}
          </div>
        </Card>
      )}
      {sampleOn && job.id === '119' && <SamplePhotos />}
    </div>
  )
}

function DocRow({ f }: { f: FileRec }) {
  const Ic = KIND_ICON[f.kind] || FileText
  return (
    <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-wash">
      <button onClick={() => openFile(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Ic className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.90625rem] font-semibold text-ink">{f.name}</span>
          <span className="block truncate text-[0.78125rem] text-muted">{[f.at, sizeLabel(f.size), PEOPLE[f.by]?.short, f.path || !REAL.cloud ? '' : 'not in storage'].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <FileMenu f={f} />
    </div>
  )
}
function FileMenu({ f }: { f: FileRec }) {
  return (
    <Menu align="end" width={200} trigger={<button aria-label={`More · ${f.name}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint transition hover:bg-wash-2 hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
      <MenuItem icon={<ExternalLink className="h-4 w-4" />} onSelect={() => openFile(f)}>Open</MenuItem>
      <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => removeFile(f)}>Remove</MenuItem>
    </Menu>
  )
}
function PhotoTile({ f, all }: { f: FileRec; all: FileRec[] }) {
  const s = useStore()
  const view = async () => {
    const items = await Promise.all(all.slice().reverse().map(async (p) => ({ id: p.id, kind: 'photo' as const, url: (await fileUrl(p).catch(() => undefined)) || p.thumb, cap: p.name, day: p.at, who: p.by })))
    s.open({ t: 'media', items, index: Math.max(0, items.findIndex((x) => x.id === f.id)) })
  }
  return (
    <div className="group relative overflow-hidden rounded-xl border border-line">
      <button onClick={view} className="block aspect-square w-full bg-wash-2" aria-label={`Photo ${f.name}`}>
        {f.thumb ? <img src={f.thumb} alt={f.name} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center text-faint"><Camera className="h-6 w-6" /></span>}
      </button>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2 pb-1.5 pt-5 text-[0.6875rem] font-medium text-white">{f.at} · {PEOPLE[f.by]?.short}</span>
      <span className="absolute right-1 top-1 opacity-0 transition group-hover:opacity-100 max-sm:opacity-100"><FileMenu f={f} /></span>
    </div>
  )
}
function SamplePhotos() {
  const photos: { sw: SwatchKey; cap: string; who: string }[] = [
    { sw: 'subway', cap: 'Guest bath walls', who: 'Philip · Sat' },
    { sw: 'toscana', cap: 'Master shower wall A', who: 'Philip · Fri' },
    { sw: 'hex', cap: 'Shower floor drain', who: shiftText('Yaakov · Sep 22') },
    { sw: 'pearl', cap: 'Girls bath corners', who: shiftText('Philip · Sep 25') },
    { sw: 'calacatta', cap: 'Kitchen backsplash', who: shiftText('Philip · Sep 19') },
    { sw: 'bianco', cap: 'Guest bath floor', who: shiftText('Philip · Sep 17') },
  ]
  return (
    <Card>
      <CardHeader title="Sample photos" count={photos.length} />
      <div className="grid grid-cols-6 gap-3 px-6 pb-6 max-md:grid-cols-4 max-sm:grid-cols-3 max-sm:gap-2 max-sm:px-4">
        {photos.map((p, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-line">
            <div className="relative aspect-[4/3]">
              <Swatch kind={p.sw} size={400} radius={0} className="!h-full !w-full" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
            </div>
            <div className="px-3 py-2">
              <div className="truncate text-[0.8125rem] font-semibold text-ink">{p.cap}</div>
              <div className="text-[0.75rem] text-muted">{p.who}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

const H_ICON: Record<HistKind, { i: React.ElementType; c: string }> = {
  field: { i: HardHat, c: 'bg-brand-50 text-brand-600' },
  change: { i: ArrowLeftRight, c: 'bg-vio-50 text-vio-600' },
  question: { i: HelpCircle, c: 'bg-warn-50 text-warn-600' },
  material: { i: Package, c: 'bg-warn-50 text-warn-700' },
  money: { i: Wallet, c: 'bg-ok-50 text-ok-600' },
  schedule: { i: CalendarDays, c: 'bg-brand-50 text-brand-600' },
  decision: { i: Gavel, c: 'bg-ok-50 text-ok-700' },
  setup: { i: LayoutGrid, c: 'bg-wash-2 text-ink-2' },
  pricing: { i: FileText, c: 'bg-vio-50 text-vio-600' },
  system: { i: Sparkles, c: 'bg-wash-2 text-muted' },
}
const FILTERS: { k: string; label: string; kinds: HistKind[] }[] = [
  { k: 'all', label: 'Everything', kinds: [] },
  { k: 'field', label: 'Field', kinds: ['field', 'question'] },
  { k: 'change', label: 'Changes & decisions', kinds: ['change', 'decision'] },
  { k: 'material', label: 'Materials', kinds: ['material'] },
  { k: 'money', label: 'Billing', kinds: ['money'] },
  { k: 'pricing', label: 'Pricing & setup', kinds: ['pricing', 'setup', 'schedule', 'system'] },
]

export function HistoryTab({ job }: { job: Job }) {
  const s = useStore()
  const role = s.role
  const all = historyOf(s, job.id)
  const [f, setF] = React.useState(role === 'accounting' ? 'money' : 'all')
  const list = f === 'all' ? all : all.filter((h) => FILTERS.find((x) => x.k === f)!.kinds.includes(h.kind))
  const groups: { date: string; items: typeof list }[] = []
  list.forEach((h) => {
    const g = groups.find((x) => x.date === h.date)
    if (g) g.items.push(h)
    else groups.push({ date: h.date, items: [h] })
  })
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.filter((x) => role !== 'accounting' || x.k === 'money').map((x) => (
          <Chip key={x.k} on={f === x.k} onClick={() => setF(x.k)} className="h-8 px-2.5 text-[0.84375rem]">{x.label}</Chip>
        ))}
        <span className="ml-auto text-[0.8125rem] text-muted max-sm:hidden">Click any line to see its details</span>
      </div>
      <div className="mt-4">
        {groups.map((g) => (
          <div key={g.date} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 border-t border-line-2 pt-2 max-sm:grid-cols-1 max-sm:gap-1">
            <div className="pt-2.5 text-[0.8125rem] font-medium text-muted">{g.date === NOW ? 'Today' : g.date}</div>
            <div className="pb-2">
              {g.items.map((h, i) => {
                const r = refFor(s, `${h.title} ${h.detail || ''}`, job.id, h.ref)
                return (
                  <button key={i} onClick={() => s.open({ t: 'activity', entry: h, jobId: job.id })} className="group flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-wash">
                    <Avatar who={h.who} size={26} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.875rem] leading-snug text-ink">{h.title}</span>
                      {h.detail && <span className="mt-0.5 block text-[0.8125rem] text-muted">{h.detail}</span>}
                      {h.from && h.to && <span className="mt-0.5 block text-[0.78125rem] text-muted">{h.from} → <span className="text-ink-2">{h.to}</span></span>}
                      <span className="mt-0.5 block text-[0.78125rem] text-faint">{PEOPLE[h.who]?.name}</span>
                    </span>
                    {r && <span className="shrink-0 pt-0.5 text-[0.78125rem] font-medium text-brand-700 opacity-80 group-hover:opacity-100">{refLabel(r)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        {!groups.length && <div className="py-10 text-center text-[0.875rem] text-muted">Nothing here yet.</div>}
      </div>
    </div>
  )
}
