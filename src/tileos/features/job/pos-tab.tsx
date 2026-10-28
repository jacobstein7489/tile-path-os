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
const COLS = 'grid grid-cols-[2rem_minmax(0,1fr)_7rem_11.5rem] items-center gap-4 max-sm:grid-cols-[2rem_minmax(0,1fr)_auto] max-sm:gap-3'
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
            title={`${p.supplier} · ${p.id}`}
            sub={`${p.what} · ${p.lines.length} line${p.lines.length === 1 ? '' : 's'}`}
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
/** one PO on a project: what, how much, where it's at */
function PORow({ onClick, icon, title, sub, amount, status }: { onClick: () => void; icon: React.ReactNode; title: string; sub: React.ReactNode; amount: number; status: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn(COLS, 'min-h-[3rem] w-full border-t border-line-2 px-5 py-2 text-left transition-colors first:border-t-0 hover:bg-[#f7f5f0] max-sm:px-4')}>
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-wash-2 text-ink-2 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[0.875rem] font-semibold text-ink">{title}</span>
        <span className="block truncate text-[0.78125rem] text-muted">{sub}</span>
      </span>
      <span className="text-right text-[0.875rem] font-semibold tnum text-ink max-sm:hidden">{fmtMoney(amount)}</span>
      <span className="justify-self-end text-right">
        <span className="hidden text-[0.875rem] font-semibold tnum text-ink max-sm:block">{fmtMoney(amount)}</span>
        {status}
      </span>
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
          <button key={p.id} onClick={() => s.open({ t: 'po', id: p.id })} className={cn(COLS, 'min-h-[3rem] w-full border-t border-line-2 px-5 py-2 text-left transition-colors first:border-t-0 hover:bg-[#f7f5f0] max-sm:px-4')}>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-wash-2 text-ink-2 [&_svg]:h-4 [&_svg]:w-4"><Package /></span>
            <span className="min-w-0">
              <span className="block truncate text-[0.875rem] font-semibold text-ink">{p.what}</span>
              <span className="block truncate text-[0.78125rem] text-muted">{p.supplier} · {p.lines.length} line{p.lines.length === 1 ? '' : 's'}</span>
            </span>
            <span className="max-sm:hidden" />
            <span className="justify-self-end"><Word tone={p.late ? 'bad' : undefined}>{p.late ? `Late · ${p.eta}` : poWord(p.step, p.eta)}</Word></span>
          </button>
        ))}
        {!coming.length && <Empty>Nothing on the way to this project.</Empty>}
      </Section>
      <TileOrders job={job} onScope={onScope} simple />
      <MaterialsNeed job={job} onScope={onScope} simple />
    </div>
  )
}
