/* What a project needs, worked out from the scope — checked against what's ordered and on site. Both on the same
 * columns: what · we need · ordered · here · where it's at.
 *   Tile: each tile on the project — what our takeoff needs (with the extra for cuts), what the GC (or we) ordered
 *   Setting materials: what goes under and around the tile — from the square feet and how each wall and floor is set
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
import { Section, Empty, Group, Word } from './kit'

const HEAD = 'border-b border-line-2 px-5 py-1.5 text-[0.71875rem] font-semibold text-muted max-sm:px-4'
/** the same columns for the tile and the materials: what · we need · ordered · here · where it's at */
const QGRID = 'grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem_5.5rem_15rem] items-center gap-4 max-lg:grid-cols-[minmax(0,1fr)_6rem_5.5rem_12rem] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-3'
const num = (n?: number) => (n ? n.toLocaleString('en-US') : '—')
function Heads({ first }: { first: string }) {
  return (
    <div className={cn(QGRID, HEAD)}>
      <span>{first}</span>
      <span className="text-right max-sm:hidden">We need</span>
      <span className="text-right max-sm:hidden">Ordered</span>
      <span className="text-right max-lg:hidden">Here</span>
      <span className="text-right">Where it’s at</span>
    </div>
  )
}
const EXACT = new Set(['m-liner', 'm-jolly', 'm-trim', 'm-edge'])

/* ---------------- tile ---------------- */
export function TileOrders({ job, onScope, simple }: { job: Job; onScope: () => void; simple?: boolean }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const tags = Array.from(new Set([...tilesOf(job.id).map((t) => t.tag), ...checks.map((c) => c.tag)]))
  return (
    <Section title="Tile" count={tags.length} right={tags.length ? 'We need includes the extra for cuts' : undefined}>
      <div>
        {tags.length > 0 && <Heads first="Tile" />}
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
          /* the site manager only checks deliveries in — ordering and settling quantities are the office's */
          const action = !c
            ? sf > 0 && !simple ? { label: `${who} ordered it`, run: () => logTileOrder(job.id, tag, { sf, where: uses.map((u) => `${u.room} ${u.x.name.toLowerCase()}`).join(' · ') }) } : null
            : short && !simple ? { label: 'Settle it', run: () => s.open({ t: 'qty', jobId: job.id, tag }) }
              : c.received < c.ordered ? { label: 'It came in', run: () => s.open({ t: 'receivetile', jobId: job.id, tag }) } : null
          return (
            <div key={tag} className={cn(QGRID, 'min-h-[3rem] border-t border-line-2 px-5 py-2 first:border-t-0 max-sm:px-4')}>
              <span className="flex min-w-0 items-center gap-3">
                <TileImg tile={t} size={32} radius={7} />
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink"><span className="tnum">{tag}</span> · {t?.name || 'Tile'}{t?.size ? <span className="font-normal text-muted"> · {t.size}</span> : null}</span>
                  <span className="block truncate text-[0.78125rem] text-muted">{c ? `${c.where} · ${c.supplier} · ordered by the ${c.suppliedBy === 'Owner' ? 'owner' : c.suppliedBy === 'Us' ? 'us' : 'GC'}` : uses.length ? `${uses.length} wall${uses.length === 1 ? '' : 's'} and floors · ${who === 'We' ? 'we order it' : `the ${t?.suppliedBy === 'Owner' ? 'owner' : 'GC'} orders it`}${t?.supplier ? ` from ${t.supplier}` : ''}` : 'Not on a wall or floor yet'}</span>
                </span>
              </span>
              <span className="text-right max-sm:hidden">
                <span className="block text-[0.875rem] font-semibold tnum text-ink">{need ? `${need.toLocaleString('en-US')} ${unit}` : '—'}</span>
                {boxes > 0 && <span className="block text-[0.75rem] tnum text-muted">{boxes} boxes</span>}
              </span>
              <span className="text-right text-[0.84375rem] tnum text-ink-2 max-sm:hidden">{c ? num(c.ordered) : '—'}</span>
              <span className="text-right text-[0.84375rem] tnum text-ink-2 max-lg:hidden">{c ? num(c.received) : '—'}</span>
              <span className="flex min-w-0 flex-wrap items-center justify-end gap-x-2.5 gap-y-1">
                <Word tone={st.tone === 'bad' ? 'bad' : st.tone === 'ok' ? 'ok' : undefined} className="truncate">{st.label}</Word>
                {action && <Button size="xs" variant={short ? 'primary' : 'outline'} onClick={action.run}>{action.label}</Button>}
              </span>
            </div>
          )
        })}
        {!tags.length && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4">
            <span className="min-w-0 flex-1">No tiles yet — they come in when the tile paperwork is entered.</span>
            <Button size="sm" icon={<Ruler />} onClick={onScope}>Scope of work</Button>
          </div>
        )}
      </div>
    </Section>
  )
}

/* ---------------- our materials ---------------- */
export function MaterialsNeed({ job, onScope, simple }: { job: Job; onScope: () => void; simple?: boolean }) {
  const s = useStore()
  const save = useSaveStatus()
  const t = takeoff(s, job.id)
  const [open, setOpen] = React.useState<string | null>(null)
  const miss = t.lines.filter((l) => l.toOrder > 0)
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k))
  return (
    <Section
      title="Setting materials"
      count={t.counted ? t.lines.length : undefined}
      right={t.counted ? <span className="max-md:hidden">From {t.counted} walls and floors · {t.sf.toLocaleString('en-US')} SF{save.mode === 'sample' ? ' · sample' : ''}</span> : undefined}
      action={simple ? undefined : <>
        {s.role === 'owner' && <Button size="sm" variant="ghost" icon={<SlidersHorizontal />} onClick={() => { s.closeAll(); s.go({ page: 'settings' }) }}><span className="max-sm:hidden">The numbers</span></Button>}
        {miss.length > 0 && <Button size="sm" variant="primary" icon={<ShoppingCart />} onClick={() => s.open({ t: 'newpo', jobId: job.id, fromTakeoff: true })}>Order what’s missing · {miss.length}</Button>}
      </>}
    >
      {!t.counted ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4">
          <span className="min-w-0 flex-1">{t.total ? 'Each wall and floor needs its square feet and its tile — then the materials work themselves out.' : 'No rooms yet — they come over from the estimate.'}</span>
          <Button size="sm" icon={<Ruler />} onClick={onScope}>Scope of work</Button>
        </div>
      ) : (
        <div>
          <Heads first="Material" />
          {GROUPS.map((g) => {
            const ls = t.lines.filter((l) => l.group === g)
            if (!ls.length) return null
            return (
              <section key={g}>
                <Group label={g} />
                {ls.map((l) => <Line key={l.itemId} l={l} jobId={job.id} open={open === l.itemId} onToggle={() => toggle(l.itemId)} waste={t.rules.waste} />)}
              </section>
            )
          })}
        </div>
      )}
      {t.skipped.length > 0 && t.counted > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-2 bg-[#fafbfa] px-5 py-2.5 text-[0.8125rem] text-ink-2 max-sm:px-4">
          <span className="font-semibold text-ink">Not counted yet</span>
          <span className="min-w-0 flex-1">{t.skipped.slice(0, 4).map((k) => `${k.room} ${k.surface.toLowerCase()} — ${k.why.toLowerCase()}`).join(' · ')}{t.skipped.length > 4 ? ` and ${t.skipped.length - 4} more` : ''}</span>
          <button onClick={onScope} className="font-semibold text-ink underline-offset-2 hover:underline">Scope of work</button>
        </div>
      )}
    </Section>
  )
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
    <div className="border-t border-line-2">
      <button onClick={onToggle} className={cn(QGRID, 'min-h-[3rem] w-full px-5 py-1.5 text-left transition-colors hover:bg-[#f7f8fa] max-sm:px-4')}>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[0.875rem] font-medium text-ink"><ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-faint transition', open && 'rotate-180')} /><span className="truncate">{it?.name || l.itemId}</span></span>
          <span className="block truncate pl-5 text-[0.78125rem] text-muted">{colors.length ? `${colors.join(', ')} · ` : ''}{where}{sf && !exact ? ` · ${sf.toLocaleString('en-US')} SF` : ''}</span>
        </span>
        <span className="text-right text-[0.875rem] font-semibold tnum text-ink max-sm:hidden">{qtyLabel(l.need, unit)}</span>
        <span className="text-right text-[0.84375rem] tnum text-ink-2 max-sm:hidden">{num(l.have)}</span>
        <span className="text-right text-[0.84375rem] tnum text-ink-2 max-lg:hidden">{num(l.onSite)}</span>
        <span className="text-right">
          {l.toOrder > 0 ? <Word className="text-ink">To order {l.toOrder.toLocaleString('en-US')}</Word> : l.onSite >= l.need ? <Word tone="ok">On site</Word> : <Word>Coming</Word>}
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
