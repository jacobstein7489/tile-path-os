/* A project's orders, in the order things get ordered:
 *   the tile (the GC's order checked against our takeoff) · our materials (worked out from the scope) · every PO —
 *   the installer's PO and our materials POs, with where each one is. */
import * as React from 'react'
import { Plus, HardHat, Package } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Status } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job } from '@/tileos/data/model'
import { PO_STEPS } from '@/tileos/data/work'
import { TileOrders, MaterialsNeed } from './takeoff'

const COLS = 'grid grid-cols-[2.25rem_minmax(0,1fr)_6.875rem_12.5rem] items-center gap-4 max-sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]'
export function POsTab({ job, onScope }: { job: Job; onScope: () => void }) {
  const s = useStore()
  const ipos = s.ipos.filter((p) => p.jobId === job.id)
  const pos = s.pos.filter((p) => p.jobId === job.id)
  const Row = ({ onClick, icon, title, sub, amount, status }: { onClick: () => void; icon: React.ReactNode; title: string; sub: string; amount: number; status: React.ReactNode }) => (
    <button onClick={onClick} className={cn(COLS, 'w-full border-b border-line-2 px-5 py-3 text-left transition-colors last:border-0 hover:bg-[#f7f8fa] max-sm:px-4')}>
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-wash-2 text-ink-2 [&_svg]:h-[1.125rem] [&_svg]:w-[1.125rem]">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[0.875rem] font-semibold text-ink">{title}</span>
        <span className="block truncate text-[0.78125rem] text-muted">{sub}</span>
      </span>
      <span className="text-right text-[0.875rem] font-semibold tnum text-ink max-sm:hidden">{fmtMoney(amount)}</span>
      <span className="justify-self-start max-sm:justify-self-end">{status}</span>
    </button>
  )
  return (
    <div className="flex flex-col gap-8">
      <TileOrders job={job} onScope={onScope} />
      <MaterialsNeed job={job} onScope={onScope} />
      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[0.9375rem] font-semibold text-ink">Purchase orders</h3>
            <p className="mt-0.5 text-[0.8125rem] text-muted">The installer’s PO and every materials PO, with where each one is</p>
          </div>
          <div className="flex gap-2">
            {!ipos.some((p) => p.status !== 'Rejected') && <Button size="sm" icon={<HardHat />} onClick={() => s.open({ t: 'book', jobId: job.id })}>Book the installer</Button>}
            <Button size="sm" icon={<Plus />} onClick={() => s.open({ t: 'newpo', jobId: job.id })}>New PO</Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
          <div className={cn(COLS, 'border-b border-line bg-wash px-5 py-2 text-[0.75rem] font-semibold text-muted max-sm:hidden')}>
            <span />
            <span>PO</span>
            <span className="text-right">Amount</span>
            <span>Status</span>
          </div>
          {ipos.map((p) => (
            <Row
              key={p.id}
              onClick={() => s.open({ t: 'ipo', id: p.id })}
              icon={<HardHat />}
              title={`${p.id} · ${PEOPLE[p.crew].name}`}
              sub={`Installer PO · ${p.lines.length} lines${p.changes.length ? ` · ${p.changes.length} change${p.changes.length > 1 ? 's' : ''}` : ''}`}
              amount={p.lines.reduce((n, l) => n + l.amount, 0)}
              status={<Status tone={p.status === 'Accepted' ? 'ok' : p.status === 'Rejected' ? 'bad' : 'warn'}>{p.status === 'Draft' ? 'Draft — not sent' : p.status === 'Sent' ? `Waiting for ${PEOPLE[p.crew].short}` : p.status === 'Rejected' ? 'Turned down' : 'Accepted'}</Status>}
            />
          ))}
          {pos.map((p) => (
            <Row
              key={p.id}
              onClick={() => s.open({ t: 'po', id: p.id })}
              icon={<Package />}
              title={`${p.id} · ${p.supplier}`}
              sub={`${p.what} · ${p.lines.length} lines`}
              amount={p.amount}
              status={<Status tone={/cancelled/i.test(p.note) ? 'neutral' : p.late ? 'bad' : p.step >= 3 ? 'ok' : 'warn'}>{/cancelled/i.test(p.note) ? 'Cancelled' : p.late ? `Late · ${p.eta}` : p.step === 1 ? 'Waiting to confirm' : p.step === 2 ? (p.eta ? `Coming ${p.eta}` : 'Confirmed') : PO_STEPS[p.step]}</Status>}
            />
          ))}
          {!ipos.length && !pos.length && <div className="px-5 py-5 text-[0.84375rem] text-muted">No POs on this project yet.</div>}
        </div>
      </section>
    </div>
  )
}
