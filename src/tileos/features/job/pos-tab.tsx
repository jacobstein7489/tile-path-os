/* A project's POs, readable in one go:
 *   the numbers on top — his PO against our estimate, what the materials POs come to, how much tile is here, what's
 *                        still to order
 *   Purchase orders     — every PO in two groups: the installer's (what share of our estimate it is) and materials
 *   Installer PO vs our estimate — line by line, once he has one
 *   Tile, Setting materials — what we need against what's ordered and what's here, on the same columns */
import * as React from 'react'
import { Plus, HardHat, Package } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job } from '@/tileos/data/model'
import { tilesOf } from '@/tileos/data/jobs'
import { TileOrders, MaterialsNeed } from './takeoff'
import { takeoff } from '../takeoff'
import { poRatio } from '../poratio'
import { tileStatus } from './scope-tab'
import { Section, Empty, Word, Strip, Group } from './kit'
import { InstallerVsEstimate, currentIPO, budgetOf } from './ratio'

/** where a materials PO is, in plain words */
const poWord = (step: number, eta?: string) =>
  step <= 0 ? 'Draft — not sent' : step === 1 ? 'Waiting to confirm' : step === 2 ? (eta ? `Coming ${eta}` : 'Confirmed') : step === 3 ? 'Delivered' : step === 4 ? 'Delivered · bill came in' : 'Paid'
const COLS = 'grid grid-cols-[2rem_minmax(0,1fr)_7rem_11.5rem] items-center gap-4 max-sm:grid-cols-[2rem_minmax(0,1fr)_auto] max-sm:gap-3'
export function POsTab({ job, onScope }: { job: Job; onScope: () => void }) {
  const s = useStore()
  const [vs, setVs] = React.useState(false)
  if (s.role === 'site') return <DeliveriesTab job={job} onScope={onScope} />
  const ipos = s.ipos.filter((p) => p.jobId === job.id)
  const pos = s.pos.filter((p) => p.jobId === job.id)
  const ipo = currentIPO(s, job.id)
  const b = budgetOf(s, job)
  const r = ipo ? poRatio(s, ipo) : undefined
  /* three parts: the installer's PO, the tile, our materials (with their POs) — each says where it stands */
  return (
    <div className="flex flex-col gap-4">
      <Section
        title="The installer"
        right={r && r.sold && r.total ? <span className={cn(r.over && 'font-semibold text-bad-600')}>{r.pct}% of our estimate{r.over ? ' — over the line' : ''}</span> : b.sold ? `Keep it under ${fmtMoney(b.cap)}` : undefined}
        action={ipo ? <Button size="sm" variant="ghost" onClick={() => setVs(!vs)}>{vs ? 'Hide the lines' : 'Line by line'}</Button> : undefined}
      >
        {ipos.map((p) => {
          const pr = poRatio(s, p)
          return (
            <PORow
              key={p.id}
              onClick={() => s.open({ t: 'ipo', id: p.id })}
              icon={<HardHat />}
              title={`${PEOPLE[p.crew].name} · ${p.id}`}
              sub={<>{pr.sold && pr.total ? <span className={cn(pr.over ? 'font-semibold text-bad-600' : 'text-ink-2')}>{pr.pct}% of our estimate</span> : 'No prices on it yet'} · {p.lines.length} line{p.lines.length === 1 ? '' : 's'}{p.changes.length ? ` · ${p.changes.length} change${p.changes.length > 1 ? 's' : ''}` : ''}</>}
              amount={pr.total || p.lines.reduce((n, l) => n + l.amount, 0)}
              status={<Word tone={p.status === 'Accepted' ? 'ok' : p.status === 'Rejected' ? 'bad' : undefined}>{p.status === 'Draft' ? 'Draft — not sent' : p.status === 'Sent' ? `Waiting for ${PEOPLE[p.crew].short}` : p.status === 'Rejected' ? 'Turned down' : 'Accepted'}</Word>}
            />
          )
        })}
        {!ipo && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-[0.84375rem] text-muted max-sm:px-4">
            <span className="min-w-0 flex-1">No installer PO yet{b.sold ? <> — keep it under <b className="font-semibold text-ink">{fmtMoney(b.cap)}</b>, {b.line}% of our {fmtMoney(b.sold)}</> : null}.</span>
            <Button size="sm" variant="primary" icon={<HardHat />} onClick={() => s.open({ t: 'book', jobId: job.id })}>Book the installer</Button>
          </div>
        )}
      </Section>
      {ipo && vs && <InstallerVsEstimate job={job} />}
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

/** the numbers on top: his PO against our estimate, the materials POs, the tile that's here, what's still to order */
function POStrip({ job }: { job: Job }) {
  const s = useStore()
  const ipo = currentIPO(s, job.id)
  const r = ipo ? poRatio(s, ipo) : undefined
  const b = budgetOf(s, job)
  const pos = s.pos.filter((p) => p.jobId === job.id && !/cancelled/i.test(p.note))
  const late = pos.filter((p) => p.late).length
  const open = pos.filter((p) => p.step < 3).length
  const tags = Array.from(new Set([...tilesOf(job.id).map((t) => t.tag), ...s.checks.filter((c) => c.jobId === job.id).map((c) => c.tag)]))
  const sts = tags.map((tag) => tileStatus(s, job.id, tag))
  const here = sts.filter((x) => x.label === 'On site').length
  const short = sts.filter((x) => x.tone === 'bad').length
  const notOrdered = sts.filter((x) => x.label === 'Not ordered yet').length
  const t = takeoff(s, job.id)
  const matMiss = t.counted ? t.lines.filter((l) => l.toOrder > 0).length : 0
  const toOrder = matMiss + notOrdered
  return (
    <Strip stats={[
      { label: 'Installer PO', value: r && r.sold && r.total ? `${r.pct}%` : ipo ? fmtMoney(r?.total || 0) : '—', sub: r && r.sold && r.total ? `of our estimate · ${r.over ? 'over' : 'under'} the ${r.line}% line` : ipo ? 'No prices on his PO yet' : b.sold ? `None yet · keep it under ${fmtMoney(b.cap)}` : 'None yet', tone: r?.over ? 'bad' : undefined },
      { label: 'Materials POs', value: fmtMoney(pos.reduce((n, p) => n + p.amount, 0)), sub: late ? `${late} late` : pos.length ? `${pos.length} PO${pos.length === 1 ? '' : 's'}${open ? ` · ${open} not in yet` : ' · all in'}` : 'None yet', tone: late ? 'bad' : undefined },
      { label: 'Tile on site', value: tags.length ? `${here} of ${tags.length}` : '—', sub: short ? `${short} short — settle it` : notOrdered ? `${notOrdered} not ordered yet` : tags.length && here < tags.length ? `${tags.length - here} coming` : tags.length ? 'All here' : 'No tiles yet', tone: short ? 'bad' : undefined },
      { label: 'Still to order', value: String(toOrder), sub: toOrder ? [matMiss ? `${matMiss} material${matMiss === 1 ? '' : 's'}` : '', notOrdered ? `${notOrdered} tile${notOrdered === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') : t.counted || tags.length ? 'Everything’s ordered' : 'Nothing worked out yet' },
    ]} />
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
