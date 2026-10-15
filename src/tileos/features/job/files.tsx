import * as React from 'react'
import { refFor, refLabel } from '../activity'
import { FileText, Map, BookOpen, Palette, ScrollText, FileSignature, Package2, Upload, CheckCircle2, Camera, HardHat, ArrowLeftRight, HelpCircle, Package, Wallet, CalendarDays, Gavel, LayoutGrid, Sparkles, Cpu, ArrowRight } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore, historyOf } from '@/tileos/store'
import { Card, CardHeader, Button, Pill, Avatar, Chip, Empty } from '@/tileos/components/ui/core'
import { Swatch } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type SwatchKey } from '@/tileos/data/model'
import { filesFor, type HistKind } from '@/tileos/data/jobs'
import { shiftText, NOW } from '@/tileos/lib/today'

const KIND_ICON: Record<string, React.ElementType> = { plans: Map, spec: BookOpen, finish: Palette, paperwork: ScrollText, proposal: FileText, contract: FileSignature, package: Package2, photo: Camera }

export function FilesTab({ job }: { job: Job }) {
  const files = filesFor(job.id)
  const role = useStore((s) => s.role)
  const photos: { sw: SwatchKey; cap: string; who: string }[] = [
    { sw: 'subway', cap: 'Guest bath walls', who: 'Philip · Sat' },
    { sw: 'toscana', cap: 'Master shower wall A', who: 'Philip · Fri' },
    { sw: 'hex', cap: 'Shower floor drain', who: shiftText('Yaakov · Sep 22') },
    { sw: 'pearl', cap: 'Girls bath corners', who: shiftText('Philip · Sep 25') },
    { sw: 'calacatta', cap: 'Kitchen backsplash', who: shiftText('Philip · Sep 19') },
    { sw: 'bianco', cap: 'Guest bath floor', who: shiftText('Philip · Sep 17') },
  ]
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader
          title="Documents"
          count={files.length}
          action={
            <div className="flex gap-2">
              <Button size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => toast('Upload — it asks whether scope, quantity or layout needs a review')}>Upload</Button>
              {role !== 'accounting' && <Button size="sm" variant="primary" onClick={() => toast('New plan revision — the system asks what it changes and who has to review it')}>New plan revision</Button>}
            </div>
          }
        />
        <div className="grid grid-cols-3 gap-3 px-6 pb-6 max-md:grid-cols-1 max-sm:px-4">
          {files.map((f) => {
            const Ic = KIND_ICON[f.kind] || FileText
            return (
              <button key={f.name} onClick={() => toast(`${f.name} — opens the file (demo)`)} className="flex items-start gap-3.5 rounded-2xl border border-line p-4 text-left transition hover:bg-wash">
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
      {job.id === '119' && (
        <Card>
          <CardHeader title="Photos" count={photos.length} action={<Button size="sm" icon={<Camera className="h-4 w-4" />} onClick={() => toast('Add photos — pick the room and surface')}>Add photos</Button>} />
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
      )}
    </div>
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
