/* What has to come to the job, and where it's at — one line each, no number columns:
 *   Tile: every tile — its picture and name, the rooms it goes in, how much we need (with the extra for cuts), and where
 *     it's at in a few words (ordered · due Fri, 18 of 30 boxes here, on site, 6 boxes short) — and, when there's
 *     something to do about it, its one button (the GC ordered it, it came in, settle it).
 *   Our materials: what we buy for the job — thinset, grout, boards, membranes, metal edges — worked out from the square
 *     feet and what each wall and floor is set on. Tap one to see how it was worked out. */
import * as React from 'react'
import { ChevronDown, ShoppingCart, SlidersHorizontal, Calculator, Ruler, Plus, MoreHorizontal, Pencil, Trash2, RotateCcw, Search, Truck, Upload } from 'lucide-react'
import { logTileOrder } from '../flows2'
import { useStore, addHist, meOf } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Menu, MenuItem, Pop } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { ItemThumb } from '../items'
import { addMat, setMatQty, removeMat, restoreMat } from '../matedit'
import { Status, HEAD_ROW } from '@/tileos/components/ui/page'
import { TileImg, GroutDot } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { needWithWaste } from '@/tileos/data/work'
import { tilesOf, tileOf, hasTile, sfFor, GROUTS } from '@/tileos/data/jobs'
import { sellsTile } from '@/tileos/data/directory'
import type { Job } from '@/tileos/data/model'
import { takeoff, qtyLabel, GROUPS, type TakeLine } from '../takeoff'
import { tileStatus } from './scope-tab'
import { useSaveStatus } from '@/tileos/lib/save'
import { Section, Empty, Group, Word } from './kit'
import { openTilePOs } from '../tilepo'
import { tileStoreOf } from '../tiles'
import { scopeLock } from '../steps'
import { PaperPanel, usePaperPicker, usePaperReview } from '../paperread'
import { useReadingOf } from '@/tileos/lib/reading'

/** what · where it goes · how much we need · where it's at (and its button) */
const QGRID = 'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_6.5rem_19rem_2rem] items-center gap-x-6 max-lg:grid-cols-[minmax(0,1fr)_6rem_15rem_2rem] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3'
const QFIRST = 'flex min-w-0 items-center gap-3'
/** the tile: what · how much we need · where it's at (and its button) */
/** Tile · Where it goes · We need · Where it's at (a smaller screen: where it goes under the tile's name) */
const TGRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_17rem_1rem] items-center gap-x-6 max-lg:grid-cols-[minmax(0,1fr)_6rem_15rem_1rem] max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3'
const ROWPAD = 'min-h-12 border-t border-line-2 px-5 py-2 max-sm:px-4'
const num = (n?: number) => (n ? n.toLocaleString('en-US') : '—')
const EXACT = new Set(['m-liner', 'm-jolly', 'm-trim', 'm-edge'])

/* ---------------- tile ---------------- */
export function TileOrders({ job, onScope, simple }: { job: Job; onScope: () => void; simple?: boolean }) {
  const s = useStore()
  /* the tile paperwork is read on the Scope of work (where each tile goes) — here it's what has to come and whether it's
     here */
  const reading = useReadingOf('paperwork', job.id)
  const rooms = s.rooms[job.id] || []
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const all = Array.from(new Set([...tilesOf(job.id).map((t) => t.tag), ...checks.map((c) => c.tag)]))
  const [q, setQ] = React.useState('')
  const whereOf = (tag: string) => rooms.flatMap((r) => r.surfaces.filter((x) => hasTile(x, tag)).map((x) => `${r.name} ${x.name.toLowerCase()}`))
  const ws = q.toLowerCase().split(/\s+/).filter(Boolean)
  const tags = ws.length ? all.filter((tag) => { const t = tileOf(job.id, tag); const hay = [tag, t?.name, t?.size, t?.supplier, t?.grout && GROUTS[t.grout]?.name, ...whereOf(tag)].filter(Boolean).join(' ').toLowerCase(); return ws.every((w) => hay.includes(w)) }) : all
  return (
    <Section
      title="Tile selection"
      count={all.length}
      action={all.length > 0 || !simple ? (
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          {all.length > 6 && (
            <label className="relative block w-[15rem] max-sm:order-last max-sm:w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tiles" aria-label="Search tiles" data-tile-search className="h-8 w-full rounded-full border border-line bg-white pl-8 pr-3 text-[0.8125rem] text-ink outline-none transition placeholder:text-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
            </label>
          )}
          {/* one button: the tile came — count the boxes (everyone who takes deliveries). More tile, a tile PO: on the
              tile that needs it, or + New */}
          {all.length > 0 && <Button size="sm" variant="primary" icon={<Truck />} onClick={() => s.open({ t: 'receivetile', jobId: job.id })} data-tile-in>Tile came in</Button>}
        </span>
      ) : undefined}
    >
      <div>
        {/* where the job's tile comes from — set once, always here on top (before any tile is in, too) */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pb-3 empty:hidden max-sm:px-4" data-tile-view-bar>
          <TileStoreLine job={job} canEdit={!simple} />
        </div>
        {/* each tile once: how much we need, and where it's at — the rooms it goes in are on the scope of work */}
        {tags.length > 0 && <div className={cn(HEAD_ROW, TGRID, 'px-5 max-lg:hidden')}><span>Tile</span><span>Where it goes</span><span className="text-right">We need</span><span className="text-right">Where it’s at</span><span /></div>}
        {tags.map((tag) => {
          const t = tileOf(job.id, tag)
          const c = checks.find((y) => y.tag === tag)
          const uses = rooms.flatMap((r) => r.surfaces.filter((x) => hasTile(x, tag)).map((x) => ({ room: r.name, x })))
          /* where it goes: the rooms (each wall and floor when you point at it) */
          const goes = Array.from(new Set(uses.map((u) => u.room)))
          const goesAll = uses.map((u) => `${u.room} ${u.x.name.toLowerCase()}`).join(' · ')
          const sf = Math.round(uses.reduce((n, u) => n + sfFor(job.id, u.x, tag), 0))
          const need = c ? needWithWaste(c) : Math.ceil(sf * 1.1)
          const unit = c?.unit || 'SF'
          const st = tileStatus(s, job.id, tag)
          const short = c ? Math.max(0, need - c.ordered) : 0
          const who = t?.suppliedBy === 'Us' ? 'We' : `The ${t?.suppliedBy === 'Owner' ? 'owner' : 'GC'}`
          const boxes = t?.boxSF && unit === 'SF' ? Math.ceil(need / t.boxSF) : 0
          /* the site manager only checks deliveries in — ordering and settling quantities are the office's */
          const action = !c
            ? sf > 0 && !simple ? { label: `${who} ordered it`, run: () => logTileOrder(job.id, tag, { sf, where: uses.map((u) => `${u.room} ${u.x.name.toLowerCase()}`).join(' · ') }) }
              : simple ? { label: 'It came in', run: () => s.open({ t: 'receivetile', jobId: job.id, tag }) } : null
            : short && !simple ? { label: 'Settle it', run: () => s.open({ t: 'qty', jobId: job.id, tag }) }
              : c.received < c.ordered ? { label: 'It came in', run: () => s.open({ t: 'receivetile', jobId: job.id, tag }) } : null
          return (
            <div key={tag} data-tile={tag} className={cn(TGRID, ROWPAD, 'max-sm:grid-cols-1 max-sm:gap-y-1.5')} title={c ? `${c.supplier} · ordered by the ${c.suppliedBy === 'Owner' ? 'owner' : c.suppliedBy === 'Us' ? 'us' : 'GC'}${c ? ` · ordered ${num(c.ordered)}, here ${num(c.received)}` : ''}` : `${who === 'We' ? 'We order it' : `The ${t?.suppliedBy === 'Owner' ? 'owner' : 'GC'} orders it`}${t?.supplier ? ` from ${t.supplier}` : ''}`}>
              {/* the tile: its picture, name and size — tap it for everything about it (where it goes, its grout) */}
              <button type="button" disabled={simple || !t} onClick={() => s.open({ t: 'tile', jobId: job.id, tag })} className={cn(QFIRST, 'text-left enabled:hover:[&_b]:text-brand-700')} data-tile-open={tag}>
                {/* its picture big enough to see — its name, and its size under it (a phone: how much too) */}
                <TileImg tile={t} size={44} radius={6} />
                <span className="min-w-0 leading-snug">
                  <span className="block truncate text-[0.9375rem] text-ink"><b className="font-semibold tnum">{tag}</b> {t?.name || 'Tile'}</span>
                  <span className={cn('block truncate text-[0.8125rem]', uses.length ? 'text-muted' : 'text-warn-700')}>{[t?.size, t?.trim ? 'trim' : '', uses.length ? '' : 'not on a wall or floor yet'].filter(Boolean).join(' · ') || 'No size yet'}<span className="text-muted lg:hidden">{need ? ` · ${need.toLocaleString('en-US')} ${unit}` : ''}</span></span>
                  {/* a smaller screen: where it goes, under it */}
                  {goes.length > 0 && <span className="block truncate text-[0.8125rem] text-ink-2 lg:hidden" title={goesAll} data-tile-goes-small>{goes.join(' · ')}</span>}
                </span>
              </button>
              <span className="min-w-0 truncate text-[0.875rem] text-ink-2 max-lg:hidden" title={goesAll} data-tile-goes={goes.join('|')}>{goes.length ? goes.join(' · ') : <span className="text-faint">—</span>}</span>
              <span className="text-right text-[0.8125rem] tnum text-ink-2 max-lg:hidden" title={boxes > 0 ? `${boxes} boxes · with the extra for cuts` : 'With the extra for cuts'}>{need ? `${need.toLocaleString('en-US')} ${unit}` : '—'}</span>
              <span className="flex min-w-0 items-center justify-end gap-2.5 max-sm:justify-start max-sm:pl-14">
                {/* on a tile PO that's still open: its number, one tap to it */}
                {(() => { const po = openTilePOs(s, job.id, tag)[0]; return po ? <button type="button" onClick={() => s.open({ t: 'po', id: po.id })} className="shrink-0 text-[0.8125rem] font-semibold tnum text-brand-700 hover:underline" data-tile-po={po.id}>{po.id}</button> : null })()}
                <Word tone={st.tone === 'bad' ? 'bad' : st.tone === 'ok' ? 'ok' : undefined} className="truncate">{st.label}</Word>
                {action && <Button size="xs" variant={short ? 'primary' : 'outline'} onClick={action.run}>{action.label}</Button>}
              </span>
              <span className="max-sm:hidden" />
            </div>
          )
        })}
        {!all.length && (
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4" data-tiles-empty>
            <span className="min-w-0 flex-1">{reading ? 'The tile paperwork is being read — on the Scope of work.' : 'No tiles yet — they come from the tile paperwork, on the Scope of work (or a wall’s “Add a new tile”).'}</span>
            <Button size="sm" icon={<Ruler />} onClick={onScope}>Scope of work</Button>
          </div>
        )}
        {all.length > 0 && !tags.length && <div className="border-t border-line-2 px-5 py-3 text-[0.84375rem] text-muted max-sm:px-4">No tile matches “{q}”.</div>}
      </div>
    </Section>
  )
}


/** where the job's tile comes from — set once (the first tile PO sets it too) and every tile PO and "Order more tile"
 *  goes there; the admin can change it */
function TileStoreLine({ job, canEdit }: { job: Job; canEdit: boolean }) {
  const s = useStore()
  const [editing, setEditing] = React.useState(false)
  /* the tile stores first, then any other supplier (a store that sells more than tile) */
  const active = s.suppliers.filter((x) => !s.inactive.includes('supplier:' + x.name))
  const stores = [...active.filter((x) => sellsTile(x)), ...active.filter((x) => !sellsTile(x))].map((x) => x.name)
  const store = tileStoreOf(s, job.id)
  const set = (v: string) => {
    if (!v) return
    s.commit((st) => { const j = st.jobs[job.id]; if (j) j.tileStore = v; addHist(st, job.id, { who: meOf(st.role), kind: 'material', title: `Tile from ${v}` }) }, `Tile from ${v}`, { sub: 'Every tile PO and “Order more tile” on this job goes there.' })
    setEditing(false)
  }
  if (store && !editing) return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-[0.875rem] text-muted" data-tile-store={store}>
      <Truck className="h-4 w-4 shrink-0 text-faint" />Tile store: <b className="truncate font-semibold text-ink">{store}</b>
      {canEdit && ['owner', 'pm', 'office', 'materials', 'estimator'].includes(s.role) && <button type="button" onClick={() => setEditing(true)} className="ml-1 font-semibold text-brand-700 hover:underline" data-tile-store-change>Change</button>}
    </span>
  )
  if (!canEdit) return null
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-[0.8125rem] text-muted" data-tile-store-pick>
      <Truck className="h-4 w-4 shrink-0 text-faint" />{editing ? 'Tile store:' : 'Tile store — which store is the tile from?'}
      <SearchSelect label="The tile store" value={store} onChange={set} search width={300} options={stores.map((v) => ({ key: v, label: v }))} placeholder="Pick or type the store" searchPlaceholder="Type a store — e.g. Infinity Tile" onCreate={set} createLabel={(q) => `Use “${q}”`} />
      {editing && <button type="button" onClick={() => setEditing(false)} className="font-semibold text-muted hover:text-ink">Cancel</button>}
    </span>
  )
}

/* ---------------- our materials ---------------- */
export function MaterialsNeed({ job, onScope, simple, orders, orderOnTop }: { job: Job; onScope: () => void; simple?: boolean; orders?: React.ReactNode; /** the Materials tab: "Order what's missing" is on the line on top */ orderOnTop?: boolean }) {
  const s = useStore()
  const save = useSaveStatus()
  const t = takeoff(s, job.id)
  const [open, setOpen] = React.useState<string | null>(null)
  const miss = t.lines.filter((l) => l.toOrder > 0)
  const toggle = (k: string) => setOpen((o) => (o === k ? null : k))
  /* the office (and whoever orders) can change the list by hand; the site manager just sees it */
  const canEdit = !simple && ['owner', 'pm', 'office', 'estimator', 'materials'].includes(s.role)
  const shownCount = t.lines.length
  return (
    <Section
      title="Our materials"
      count={t.counted || shownCount ? shownCount : undefined}
      action={simple ? undefined : <>
        {canEdit && <AddMaterial jobId={job.id} />}
        {miss.length > 0 && !orderOnTop
          ? <Button size="sm" variant="primary" icon={<ShoppingCart />} onClick={() => s.open({ t: 'newpo', jobId: job.id, fromTakeoff: true })}>Order what’s missing · {miss.length}</Button>
          : canEdit && <Button size="sm" icon={<ShoppingCart />} onClick={() => s.open({ t: 'newpo', jobId: job.id })}>New PO</Button>}
      </>}
    >
      {!t.counted && !shownCount ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-[0.84375rem] text-muted max-sm:px-4">
          <span className="min-w-0 flex-1">{t.total ? 'They work themselves out once the walls and floors have their square feet.' : 'No rooms yet — they come over from the estimate.'}</span>
          <Button size="sm" icon={<Ruler />} onClick={onScope}>Scope of work</Button>
        </div>
      ) : (
        <div>
          <div className={cn(HEAD_ROW, QGRID, 'px-5 max-lg:hidden')}><span>Material</span><span>Where it goes</span><span className="text-right">We need</span><span className="text-right">Where it’s at</span><span /></div>
          {GROUPS.map((g) => {
            const ls = t.lines.filter((l) => l.group === g)
            if (!ls.length) return null
            return (
              <section key={g}>
                <Group label={g} />
                {ls.map((l) => <Line key={l.itemId} l={l} jobId={job.id} open={open === l.itemId} onToggle={() => toggle(l.itemId)} waste={t.rules.waste} canEdit={canEdit} />)}
              </section>
            )
          })}
        </div>
      )}
      {orders && <><Group label="Orders" />{orders}</>}
      {t.off.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line-2 px-5 py-2.5 text-[0.8125rem] text-muted max-sm:px-4">
          <span className="font-semibold text-ink-2">Taken off the list</span>
          {t.off.map((id) => {
            const nm = s.items.find((i) => i.id === id)?.name || id
            return canEdit
              ? <button key={id} onClick={() => restoreMat(job.id, id)} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[0.78125rem] font-medium text-ink-2 hover:bg-wash" title="Put it back on the list"><RotateCcw className="h-3 w-3" />{nm}</button>
              : <span key={id} className="text-[0.78125rem]">{nm}</span>
          })}
        </div>
      )}
      {t.skipped.length > 0 && t.counted > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-2 bg-[#faf8f5] px-5 py-2.5 text-[0.8125rem] text-ink-2 max-sm:px-4">
          <span className="font-semibold text-ink">Not counted yet</span>
          <span className="min-w-0 flex-1">{t.skipped.slice(0, 4).map((k) => `${k.room} ${k.surface.toLowerCase()} — ${k.why.toLowerCase()}`).join(' · ')}{t.skipped.length > 4 ? ` and ${t.skipped.length - 4} more` : ''}</span>
          <button onClick={onScope} className="font-semibold text-ink underline-offset-2 hover:underline">Scope of work</button>
        </div>
      )}
    </Section>
  )
}


function Line({ l, jobId, open, onToggle, waste, canEdit }: { l: TakeLine; jobId: string; open: boolean; onToggle: () => void; waste: number; canEdit?: boolean }) {
  const s = useStore()
  const it = s.items.find((i) => i.id === l.itemId)
  const unit = it?.unit || ''
  const rooms = Array.from(new Set(l.uses.filter((u) => u.room !== 'Added by hand').map((u) => u.room)))
  const sf = Array.from(new Map(l.uses.filter((u) => u.sf).map((u) => [u.room + u.surface, u.sf])).values()).reduce((n, v) => n + v, 0)
  const where = l.manual ? 'Added by hand' : rooms.length > 3 ? `${rooms.length} rooms` : rooms.join(', ')
  const exact = EXACT.has(l.itemId)
  const [editing, setEditing] = React.useState(false)
  const [q, setQ] = React.useState(String(l.need))
  React.useEffect(() => setQ(String(l.need)), [l.need])
  const saveQty = () => { const n = Math.max(0, Math.round(Number(q.replace(/[^0-9.]/g, '')) || 0)); setEditing(false); if (n !== l.need) setMatQty(jobId, l.itemId, n) }
  /* grout: which colors, so the order says them */
  const colors = l.itemId === 'm-grout' ? Array.from(new Set(l.uses.map((u) => s.rooms[jobId]?.find((r) => r.name === u.room)?.surfaces.find((x) => x.name === u.surface)?.grout).filter(Boolean) as string[])).map((g) => GROUTS[g]?.name || g) : []
  return (
    <div className={cn(QGRID, ROWPAD, 'w-full transition-colors row-hover')} data-mat={l.itemId}>
        <Pop
          open={open}
          onOpenChange={(o) => { if (o !== open) onToggle() }}
          align="start"
          width={360}
          trigger={
            <button className={cn(QFIRST, 'text-left')} aria-expanded={open} title="How it’s worked out">
              <ItemThumb item={it} size={28} />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[0.875rem] text-ink">{it?.name || l.itemId}</span>
                {/* on a phone: how much and where, under the name */}
                <span className="hidden truncate text-[0.75rem] text-muted max-lg:block">{qtyLabel(l.need, unit)}{colors.length ? ` · ${colors.join(', ')}` : ''}<span className="max-sm:hidden"> · {where}</span></span>
              </span>
            </button>
          }
        >
          <div className="text-[0.75rem] font-semibold text-muted">How it’s worked out</div>
          {l.uses.map((u, i) => (
            <div key={i} className="flex items-baseline justify-between gap-4 py-[0.1875rem] text-[0.78125rem]">
              <span className="min-w-0 text-ink-2">{u.room === 'Added by hand' ? <b className="font-semibold text-ink">Added by hand</b> : <b className="font-semibold text-ink">{u.room} · {u.surface.toLowerCase()}</b>}{u.room === 'Added by hand' ? (u.surface ? ` — ${u.surface}` : '') : ` — ${u.note}`}</span>
              <span className="shrink-0 tnum text-muted">{u.raw < 10 ? Math.round(u.raw * 10) / 10 : Math.round(u.raw)}</span>
            </div>
          ))}
          <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-line pt-1.5 text-[0.78125rem] font-semibold text-ink">
            <span>{l.edited != null ? `Changed by hand — worked out ${l.edited}` : l.manual ? 'Added by hand' : exact ? 'Counted as is' : `${Math.round(l.raw * 10) / 10} + ${waste}% extra, rounded up`}{l.itemId === 'm-sand' ? ` · about ${((l.need * 50) / 2000).toFixed(1)} tons` : ''}</span>
            <span className="tnum">{qtyLabel(l.need, unit)}</span>
          </div>
          {l.refs.length > 0 && <div className="mt-1 text-[0.75rem] text-muted">Covered by {l.refs.join(', ')}</div>}
          {(l.have > 0 || l.onSite > 0) && <div className="mt-1 text-[0.75rem] text-muted">Ordered {num(l.have)} · on site {num(l.onSite)}</div>}
        </Pop>
        <span className="min-w-0 truncate text-[0.8125rem] text-muted max-lg:hidden">{colors.length ? `${colors.join(', ')} · ` : ''}{where}</span>
        <span className={cn('text-right', editing ? 'max-sm:col-span-2 max-sm:row-start-2 max-sm:text-left' : 'max-lg:hidden')}>
          {editing ? (
            <input autoFocus aria-label={`How many ${it?.name || ''}`} inputMode="numeric" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveQty(); if (e.key === 'Escape') setEditing(false) }} onBlur={saveQty} className="h-8 w-[4.5rem] rounded-lg border border-brand-300 px-2 text-right text-[0.875rem] font-semibold tnum outline-none ring-2 ring-brand-100" />
          ) : (
            <span className="block leading-tight">
              <span className="block text-[0.8125rem] tnum text-ink-2">{qtyLabel(l.need, unit)}</span>
              {l.edited != null && <span className="block text-[0.6875rem] text-muted">changed · worked out {l.edited}</span>}
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center justify-end">
          {l.toOrder > 0 ? <Word className="text-ink">To order {l.toOrder.toLocaleString('en-US')}</Word> : l.onSite >= l.need ? <Word tone="ok">On site</Word> : <Word>Coming</Word>}
        </span>
        <span className="flex justify-end max-sm:hidden">
          {canEdit && (
            <Menu align="end" width={240} trigger={<button aria-label={`Change ${it?.name || 'this material'}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
              <MenuItem icon={<Pencil />} onSelect={() => { setQ(String(l.need)); setEditing(true) }}>Change how many</MenuItem>
              {l.edited != null && <MenuItem icon={<RotateCcw />} onSelect={() => setMatQty(jobId, l.itemId, null)}>Back to the worked-out {l.edited}</MenuItem>}
              <MenuItem icon={<Trash2 />} onSelect={() => removeMat(jobId, l.itemId)}>Take it off the list</MenuItem>
            </Menu>
          )}
        </span>
    </div>
  )
}

/** add a material by hand — from the Items catalog, or a new one */
function AddMaterial({ jobId }: { jobId: string }) {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const [itemId, setItemId] = React.useState('')
  const [qty, setQty] = React.useState('')
  const [note, setNote] = React.useState('')
  const mats = s.items.filter((i) => i.type === 'material')
  const it = mats.find((i) => i.id === itemId)
  const n = Math.round(Number(qty.replace(/[^0-9.]/g, '')) || 0)
  const add = () => { if (!itemId || !n) return; addMat(jobId, itemId, n, note.trim() || undefined); setItemId(''); setQty(''); setNote(''); setOpen(false) }
  return (
    <Pop open={open} onOpenChange={setOpen} align="end" width={400} trigger={<Button size="sm" icon={<Plus />}>Add a material</Button>}>
      <div className="text-[0.875rem] font-semibold text-ink">Add a material</div>
      <div className="mt-0.5 text-[0.78125rem] text-muted">Something the takeoff didn’t work out — it goes on the list and on the next order.</div>
      <div className="mt-3">
        <SearchSelect
          label="Material"
          value={itemId}
          onChange={setItemId}
          options={mats.map((m) => ({ key: m.id, label: m.name, hint: [m.brand, m.pack || m.unit].filter(Boolean).join(' · '), lead: <ItemThumb item={m} size={28} /> }))}
          placeholder="Pick from your items"
          searchPlaceholder="Type a material…"
          search
          width={380}
          footer={{ label: 'A new one — add it to Items', onClick: () => { setOpen(false); s.open({ t: 'newitem' }) } }}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <TextInput aria-label="How many" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="How many" className="h-10 w-[7rem] text-right tnum" />
        <span className="text-[0.84375rem] text-muted">{it ? qtyLabel(n || 2, it.unit).replace(/^\d[\d,]*\s/, '') : ''}</span>
      </div>
      <TextInput className="mt-2 h-10" aria-label="What it’s for" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it’s for (optional) — e.g. extra for the steps" />
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={!itemId || !n} onClick={add}>Add it</Button>
      </div>
    </Pop>
  )
}
