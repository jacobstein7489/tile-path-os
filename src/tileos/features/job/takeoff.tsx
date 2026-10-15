/* What a project needs, worked out from the scope — checked against what's ordered and on site.
 *   Tile: each tile on the project — what our takeoff needs (with waste), what the GC (or we) ordered, what's here
 *   Our materials: what goes under and around the tile — from the square feet and how each wall and floor is set
 * Tap a material to see exactly how it was worked out. */
import * as React from 'react'
import { ChevronDown, ShoppingCart, SlidersHorizontal, Calculator, Ruler } from 'lucide-react'
import { logTileOrder } from '../flows2'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Status } from '@/tileos/components/ui/page'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { needWithWaste } from '@/tileos/data/work'
import { tilesOf, tileOf, GROUTS } from '@/tileos/data/jobs'
import type { Job } from '@/tileos/data/model'
import { takeoff, qtyLabel, GROUPS, type TakeLine } from '../takeoff'
import { tileStatus } from './scope-tab'
import { useSaveStatus } from '@/tileos/lib/save'

const HEAD = 'border-b border-line bg-wash px-5 py-2 text-[0.75rem] font-semibold text-muted max-sm:px-4'
const EXACT = new Set(['m-liner', 'm-jolly', 'm-trim', 'm-edge'])

/* ---------------- tile ---------------- */
const TGRID = 'grid grid-cols-[minmax(0,1fr)_6.5rem_8.75rem_18.125rem] items-center gap-4 max-lg:grid-cols-[minmax(0,1fr)_6rem_8.75rem] max-sm:grid-cols-[minmax(0,1fr)_auto]'
export function TileOrders({ job, onScope }: { job: Job; onScope: () => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const tags = Array.from(new Set([...tilesOf(job.id).map((t) => t.tag), ...checks.map((c) => c.tag)]))
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold text-ink">Tile</h3>
          <p className="mt-0.5 text-[0.8125rem] text-muted">What our takeoff needs, with waste, against what was ordered — so nobody runs short on site</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
        <div className={cn(TGRID, HEAD)}>
          <span>Tile</span>
          <span className="text-right">We need</span>
          <span className="max-sm:hidden">Ordered · here</span>
          <span className="max-lg:hidden">Status</span>
        </div>
        {tags.map((tag) => {
          const t = tileOf(job.id, tag)
          const c = checks.find((y) => y.tag === tag)
          const uses = rooms.flatMap((r) => r.surfaces.filter((x) => x.tile === tag).map((x) => ({ room: r.name, x })))
          const sf = uses.reduce((n, u) => n + (u.x.sf || 0), 0)
          const need = c ? needWithWaste(c) : Math.ceil(sf * 1.1)
          const unit = c?.unit || 'SF'
          const st = tileStatus(s, job.id, tag)
          const short = c ? Math.max(0, need - c.ordered) : 0
          const who = t?.suppliedBy === 'Us' ? 'We' : `The ${t?.suppliedBy === 'Owner' ? 'owner' : 'GC'}`
          const boxes = t?.boxSF && unit === 'SF' ? Math.ceil(need / t.boxSF) : 0
          const action = !c
            ? sf > 0 ? { label: `${who} ordered it`, run: () => logTileOrder(job.id, tag, { sf, where: uses.map((u) => `${u.room} ${u.x.name.toLowerCase()}`).join(' · ') }) } : null
            : short ? { label: 'Settle it', run: () => s.open({ t: 'qty', jobId: job.id, tag }) }
              : c.received < c.ordered ? { label: 'It came in', run: () => s.open({ t: 'receivetile', jobId: job.id, tag }) } : null
          return (
            <div key={tag} className={cn(TGRID, 'border-b border-line-2 px-5 py-3 last:border-0 max-sm:px-4')}>
              <span className="flex min-w-0 items-center gap-3">
                <TileImg tile={t} size={36} radius={8} />
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink"><span className="tnum">{tag}</span> · {t?.name || 'Tile'}{t?.size ? <span className="font-normal text-muted"> · {t.size}</span> : null}</span>
                  <span className="block truncate text-[0.78125rem] text-muted">{c ? `${c.where} · ${c.supplier} · ordered by the ${c.suppliedBy === 'Owner' ? 'owner' : c.suppliedBy === 'Us' ? 'us' : 'GC'}` : uses.length ? `${uses.length} wall${uses.length === 1 ? '' : 's'} and floors · ${who === 'We' ? 'we order it' : `the ${t?.suppliedBy === 'Owner' ? 'owner' : 'GC'} orders it`}${t?.supplier ? ` from ${t.supplier}` : ''}` : 'Not on a wall or floor yet'}</span>
                </span>
              </span>
              <span className="text-right">
                <span className="block text-[0.875rem] font-semibold tnum text-ink">{need ? `${need.toLocaleString('en-US')} ${unit}` : '—'}</span>
                {boxes > 0 && <span className="block text-[0.75rem] tnum text-muted">{boxes} boxes</span>}
              </span>
              <span className="text-[0.8125rem] tnum text-ink-2 max-sm:hidden">{c ? `${c.ordered.toLocaleString('en-US')} · ${c.received.toLocaleString('en-US')} here` : <span className="text-faint">Not ordered</span>}</span>
              <span className="flex min-w-0 flex-wrap items-center gap-2 max-lg:col-span-full max-sm:col-span-full">
                <Status tone={st.tone}>{st.label}</Status>
                {action && <Button size="xs" className="ml-auto max-lg:ml-0" variant={short ? 'primary' : 'outline'} onClick={action.run}>{action.label}</Button>}
              </span>
            </div>
          )
        })}
        {!tags.length && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4">
            <span className="min-w-0 flex-1">No tiles on this project yet — add them on the Scope tab, from the finish schedule.</span>
            <Button size="sm" icon={<Ruler />} onClick={onScope}>Open the scope</Button>
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------------- our materials ---------------- */
const GRID = 'grid grid-cols-[minmax(0,1fr)_7rem_9.375rem_9.875rem] items-center gap-4 max-md:grid-cols-[minmax(0,1fr)_6rem_8.25rem]'
export function MaterialsNeed({ job, onScope }: { job: Job; onScope: () => void }) {
  const s = useStore()
  const save = useSaveStatus()
  const t = takeoff(s, job.id)
  const [open, setOpen] = React.useState<string | null>(null)
  const miss = t.lines.filter((l) => l.toOrder > 0)
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k))
  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold text-ink">Our materials</h3>
          <p className="mt-0.5 text-[0.8125rem] text-muted">{t.counted ? `Worked out from ${t.counted} walls and floors · ${t.sf.toLocaleString('en-US')} SF — what goes under the tile, thinset, grout, metal${save.mode === 'sample' ? ' · sample numbers' : ''}` : 'Worked out from the square feet and what goes under each wall and floor'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {s.role === 'owner' && <Button size="sm" variant="ghost" icon={<SlidersHorizontal />} onClick={() => { s.closeAll(); s.go({ page: 'settings' }) }}>The numbers</Button>}
          {miss.length ? (
            <Button size="sm" variant="primary" icon={<ShoppingCart />} onClick={() => s.open({ t: 'newpo', jobId: job.id, fromTakeoff: true })}>Order what’s missing · {miss.length}</Button>
          ) : t.counted ? (
            <Status tone="ok">Nothing to order</Status>
          ) : null}
        </div>
      </div>
      {!t.counted ? (
        <div className="flex flex-col items-center rounded-[0.875rem] border border-dashed border-line bg-white px-6 py-8 text-center">
          <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Calculator className="h-5 w-5" /></span>
          <div className="text-[0.9375rem] font-semibold text-ink">{t.total ? 'Nothing to work out yet' : 'No rooms yet'}</div>
          <div className="mt-1 max-w-md text-[0.84375rem] text-muted">{t.total ? 'Each wall and floor needs its square feet and its tile — then the materials work themselves out.' : 'The rooms come over from the estimate.'}</div>
          <Button className="mt-3" size="sm" icon={<Ruler />} onClick={onScope}>Open the scope</Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white">
          <div className={cn(GRID, HEAD)}>
            <span>Material</span>
            <span className="text-right">Need</span>
            <span className="text-right">Have</span>
            <span className="max-md:hidden">Status</span>
          </div>
          {GROUPS.map((g) => {
            const ls = t.lines.filter((l) => l.group === g)
            if (!ls.length) return null
            return (
              <section key={g}>
                <div className="border-b border-line-2 bg-[#f7f8fa] px-5 py-1.5 text-[0.71875rem] font-bold uppercase tracking-[0.06em] text-muted max-sm:px-4">{g}</div>
                {ls.map((l) => <Line key={l.itemId} l={l} jobId={job.id} open={open === l.itemId} onToggle={() => toggle(l.itemId)} waste={t.rules.waste} />)}
              </section>
            )
          })}
        </div>
      )}
      {t.skipped.length > 0 && t.counted > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-warn-50 px-4 py-2.5 text-[0.8125rem] text-warn-800">
          <span className="font-semibold">Not counted yet</span>
          <span className="min-w-0 flex-1">{t.skipped.slice(0, 4).map((k) => `${k.room} ${k.surface.toLowerCase()} — ${k.why.toLowerCase()}`).join(' · ')}{t.skipped.length > 4 ? ` and ${t.skipped.length - 4} more` : ''}</span>
          <button onClick={onScope} className="font-semibold text-warn-800 underline-offset-2 hover:underline">Open the scope</button>
        </div>
      )}
    </section>
  )
}

function haveText(have: number, onSite: number) {
  if (!have) return '—'
  if (onSite >= have) return `${have.toLocaleString('en-US')} on site`
  if (onSite) return `${onSite} here · ${have - onSite} coming`
  return `${have.toLocaleString('en-US')} ordered`
}

function Line({ l, jobId, open, onToggle, waste }: { l: TakeLine; jobId: string; open: boolean; onToggle: () => void; waste: number }) {
  const s = useStore()
  const it = s.items.find((i) => i.id === l.itemId)
  const unit = it?.unit || ''
  const rooms = Array.from(new Set(l.uses.map((u) => u.room)))
  const sf = Array.from(new Map(l.uses.map((u) => [u.room + u.surface, u.sf])).values()).reduce((n, v) => n + v, 0)
  const where = rooms.length > 3 ? `${rooms.length} rooms` : rooms.join(', ')
  const exact = EXACT.has(l.itemId)
  /* grout: which colors, so the order says them */
  const colors = l.itemId === 'm-grout' ? Array.from(new Set(l.uses.map((u) => s.rooms[jobId]?.find((r) => r.name === u.room)?.surfaces.find((x) => x.name === u.surface)?.grout).filter(Boolean) as string[])).map((g) => GROUTS[g]?.name || g) : []
  return (
    <div className="border-b border-line-2 last:border-0">
      <button onClick={onToggle} className={cn(GRID, 'w-full px-5 py-2.5 text-left transition-colors hover:bg-[#f7f8fa] max-sm:px-4')}>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[0.875rem] font-medium text-ink"><ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-faint transition', open && 'rotate-180')} /><span className="truncate">{it?.name || l.itemId}</span></span>
          <span className="block truncate pl-5 text-[0.78125rem] text-muted">{colors.length ? `${colors.join(', ')} · ` : ''}{where}{sf && !exact ? ` · ${sf.toLocaleString('en-US')} SF` : ''}</span>
        </span>
        <span className="text-right text-[0.875rem] font-semibold tnum text-ink">{qtyLabel(l.need, unit)}</span>
        <span className="text-right text-[0.8125rem] tnum text-ink-2">{haveText(l.have, l.onSite)}</span>
        <span className="max-md:hidden">
          {l.toOrder > 0 ? <Status tone={l.have ? 'warn' : 'bad'}>To order {l.toOrder.toLocaleString('en-US')}</Status> : l.onSite >= l.need ? <Status tone="ok">On site</Status> : <Status tone="info">Coming</Status>}
        </span>
      </button>
      {open && (
        <div className="bg-wash px-5 pb-3 pl-10 pt-1.5 max-sm:px-4">
          {l.uses.map((u, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 py-[0.1875rem] text-[0.78125rem]">
              <span className="min-w-0 text-ink-2"><b className="font-semibold text-ink">{u.room} · {u.surface.toLowerCase()}</b> — {u.note}</span>
              <span className="shrink-0 tnum text-muted">{u.raw < 10 ? Math.round(u.raw * 10) / 10 : Math.round(u.raw)}</span>
            </div>
          ))}
          <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-line pt-1.5 text-[0.78125rem] font-semibold text-ink">
            <span>{exact ? 'Counted as is' : `${Math.round(l.raw * 10) / 10} + ${waste}% extra, rounded up`}{l.itemId === 'm-sand' ? ` · about ${((l.need * 50) / 2000).toFixed(1)} tons` : ''}</span>
            <span className="tnum">{qtyLabel(l.need, unit)}</span>
          </div>
          {l.refs.length > 0 && <div className="mt-1 text-[0.75rem] text-muted">Covered by {l.refs.join(', ')}</div>}
        </div>
      )}
    </div>
  )
}
