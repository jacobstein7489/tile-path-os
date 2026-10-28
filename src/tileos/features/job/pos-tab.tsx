/* Materials — everything that has to come to the job, and whether it's here:
 *   Tile — every tile: its picture, its grout, where it goes; how much we need, what's ordered, what's here — and the
 *          one thing to do (the GC ordered it, it came in, settle a short count). A search box on top.
 *   Our materials — what we buy for the job: thinset, grout, boards, membranes, metal edges (Schluter) — worked out
 *          from the setup and the square feet, with their POs and deliveries.
 * The installer's PO isn't a material: it's on getting ready (the Installer part) and on People, with him. */
import * as React from 'react'
import { Package } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, type Job } from '@/tileos/data/model'
import { tilesOf } from '@/tileos/data/jobs'
import { TileOrders, MaterialsNeed } from './takeoff'
import { tileStatus } from './scope-tab'
import { Section, Empty, Word } from './kit'

/** where a materials PO is, in plain words */
const poWord = (step: number, eta?: string) =>
  step <= 0 ? 'Draft — not sent' : step === 1 ? 'Waiting to confirm' : step === 2 ? (eta ? `Coming ${eta}` : 'Confirmed') : step === 3 ? 'Delivered' : step === 4 ? 'Delivered · bill came in' : 'Paid'
const COLS = 'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_minmax(13rem,auto)] items-center gap-x-6 max-lg:grid-cols-[minmax(0,1fr)_6rem_minmax(11rem,auto)] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3'
export function MaterialsTab({ job, onScope }: { job: Job; onScope: () => void }) {
  const s = useStore()
  if (s.role === 'site') return <DeliveriesTab job={job} onScope={onScope} />
  const pos = s.pos.filter((p) => p.jobId === job.id)
  return (
    <div className="flex flex-col gap-4" data-materials>
      <TileOrders job={job} onScope={onScope} />
      <MaterialsNeed job={job} onScope={onScope} orders={
        pos.length ? pos.map((p) => (
          <PORow
            key={p.id}
            onClick={() => s.open({ t: 'po', id: p.id })}
            icon={<Package />}
            title={`${p.id} · ${p.supplier}`}
            sub={p.what}
            amount={p.amount}
            status={<Word tone={/cancelled/i.test(p.note) ? undefined : p.late ? 'bad' : p.step >= 3 ? 'ok' : undefined}>{/cancelled/i.test(p.note) ? 'Cancelled' : p.late ? `Late · ${p.eta}` : poWord(p.step, p.eta)}</Word>}
          />
        )) : undefined
      } />
    </div>
  )
}
/** the window with the same (from a link that asks for the orders) */
export const POsTab = MaterialsTab
/** one PO on a project, one line: which order · what's on it · how much · where it's at */
function PORow({ onClick, title, sub, amount, status }: { onClick: () => void; icon?: React.ReactNode; title: string; sub: React.ReactNode; amount?: number; status: React.ReactNode }) {
  return (
    <button onClick={onClick} data-po-row className={cn(COLS, 'min-h-12 w-full border-t border-line-2 px-5 py-2 text-left transition-colors hover:bg-[#f7f5f0] max-sm:px-4')}>
      <span className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-wash-2 text-muted"><Package className="h-3.5 w-3.5" /></span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[0.875rem] text-ink">{title}</span>
          <span className="hidden truncate text-[0.75rem] text-muted max-lg:block">{sub}{amount != null ? ` · ${fmtMoney(amount)}` : ''}</span>
        </span>
      </span>
      <span className="min-w-0 truncate text-[0.8125rem] text-muted max-lg:hidden">{sub}</span>
      <span className="text-right text-[0.8125rem] tnum text-ink-2 max-lg:hidden">{amount != null ? fmtMoney(amount) : ''}</span>
      <span className="justify-self-end text-right">{status}</span>
    </button>
  )
}

/** the site manager's version: what's coming and what's here — no prices, no POs to make, no installer PO */
function DeliveriesTab({ job, onScope }: { job: Job; onScope: () => void }) {
  const s = useStore()
  const pos = s.pos.filter((p) => p.jobId === job.id && !/cancelled/i.test(p.note))
  const coming = pos.filter((p) => p.step < 3)
  const late = coming.filter((p) => p.late).length
  const tags = Array.from(new Set([...tilesOf(job.id).map((t) => t.tag), ...s.checks.filter((c) => c.jobId === job.id).map((c) => c.tag)]))
  const sts = tags.map((tag) => tileStatus(s, job.id, tag))
  const here = sts.filter((x) => x.label === 'On site').length
  const short = sts.filter((x) => x.tone === 'bad').length
  return (
    <div className="flex flex-col gap-4">
      <Section title="On the way" count={coming.length} right={late ? <span className="font-semibold text-bad-600">{late} late</span> : tags.length ? `Tile: ${here} of ${tags.length} here${short ? ` · ${short} short` : ''}` : undefined}>
        {coming.map((p) => (
          <PORow key={p.id} onClick={() => s.open({ t: 'po', id: p.id })} title={p.what} sub={p.supplier} status={<Word tone={p.late ? 'bad' : undefined}>{p.late ? `Late · ${p.eta}` : poWord(p.step, p.eta)}</Word>} />
        ))}
        {!coming.length && <Empty>Nothing on the way to this project.</Empty>}
      </Section>
      <TileOrders job={job} onScope={onScope} simple />
      <MaterialsNeed job={job} onScope={onScope} simple />
    </div>
  )
}
