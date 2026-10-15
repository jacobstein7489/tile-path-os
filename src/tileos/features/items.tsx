/* Items — the materials catalog the takeoff orders from (pictures, brands, how it's sold), and our labor rates.
 * Tile isn't here: the GC's tile store delivers it and we log it on the project.
 * Products come in from QuickBooks or a supplier's price list; prices are samples. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { RefreshCw, Plus, Upload, Package, Hammer, Truck, Check, FileSpreadsheet, Sparkles, Camera, Layers, Grid3x3, Droplets, ScrollText, PanelTop, Shovel, Ruler, Wrench, SprayCan, CircleDollarSign, HardHat, AlertTriangle } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, Chip, TextInput, Field, OptionCard } from '@/tileos/components/ui/core'
import { Modal, Tip } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Table, Th, Tr, Td, EmptyRow, Bubbles, EmptyState, GroupRow, type BubbleColor } from '@/tileos/components/ui/page'
import { SearchSelect } from '@/tileos/components/ui/select'
import { readQB, ITEM_GROUPS, type QBRead } from './qbimport'
import { ProductPic } from '@/tileos/components/ProductPic'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney } from '@/tileos/data/model'
import { MAT_CAT, ITEM_TYPE_LABEL, type Item, type MatCat, type PicKind } from '@/tileos/data/items'

/** the picture for any item — materials by their package, labor by a hammer */
export function ItemThumb({ item, size = 44, className }: { item?: Item; size?: number; className?: string }) {
  if (!item || item.type !== 'material') return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-xl bg-wash-2 text-muted', className)} style={{ width: size, height: size }}><Hammer className="h-4 w-4" /></span>
  const cat = MAT_CAT[item.cat || 'supplies']
  return <ProductPic kind={item.pic || 'box'} color={item.tint || cat.color} label={item.product || item.name.split(' ')[0]} sub={item.pack} photo={item.photo} size={size} className={cn('shrink-0', className)} />
}
const price = (n: number) => fmtMoney(n, { cents: n % 1 !== 0 })
/** a real photo for a product — shrunk to a light thumbnail, then shown everywhere the product is */
export function setItemPhoto(id: string, f: File) {
  const r = new FileReader()
  r.onload = () => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 480 / Math.max(img.width, img.height))
      const cv = document.createElement('canvas')
      cv.width = Math.round(img.width * k)
      cv.height = Math.round(img.height * k)
      cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height)
      const url = cv.toDataURL('image/jpeg', 0.86)
      useStore.getState().commit((s) => { const it = s.items.find((x) => x.id === id); if (it) it.photo = url }, 'Photo added', { undo: false, sub: 'It shows in the catalog, on POs and in the supplier’s email.' })
    }
    img.src = String(r.result)
  }
  r.readAsDataURL(f)
}
const CAT_ICON: Record<MatCat, React.ReactNode> = { mortar: <Layers />, grout: <Grid3x3 />, waterproofing: <Droplets />, membrane: <ScrollText />, board: <PanelTop />, prep: <Shovel />, trim: <Ruler />, supplies: <Wrench />, care: <SprayCan /> }
const CAT_COLOR: Record<MatCat, BubbleColor> = { mortar: 'indigo', grout: 'amber', waterproofing: 'blue', membrane: 'orange', board: 'violet', prep: 'cyan', trim: 'slate', supplies: 'slate', care: 'green' }

type Tab = 'ours' | 'material' | 'labor'
const UNITS = ['SF', 'LF', 'EA', 'HR', 'LS', 'bag', 'pail', 'tube', 'unit', 'box']
export function ItemsPage() {
  const s = useStore()
  const ours = s.items.filter((i) => i.id.startsWith('qb-'))
  const [tab, setTab] = React.useState<Tab>(ours.length ? 'ours' : 'material')
  const [cat, setCat] = React.useState<MatCat | 'all'>('all')
  const [grp, setGrp] = React.useState('all')
  const [need, setNeed] = React.useState<'all' | 'price' | 'rate'>('all')
  const [vendor, setVendor] = React.useState('all')
  const [q, setQ] = React.useState('')
  const mats = s.items.filter((i) => i.type === 'material' && !i.id.startsWith('qb-'))
  const labor = s.items.filter((i) => i.type !== 'material' && i.id !== 'o-room' && !i.id.startsWith('qb-'))
  const vendors = Array.from(new Set(mats.map((i) => i.vendor).filter(Boolean))) as string[]
  const match = (i: Item) => (!q || `${i.name} ${i.desc || ''} ${i.brand || ''} ${i.product || ''} ${i.qb}`.toLowerCase().includes(q.toLowerCase())) && (vendor === 'all' || i.vendor === vendor)
  const shownMats = mats.filter((i) => (cat === 'all' || i.cat === cat) && match(i))
  const shownLabor = labor.filter(match)
  const noPrice = ours.filter((i) => !i.price)
  const noRate = ours.filter((i) => i.type === 'labor' && !i.cost)
  const shownOurs = ours.filter((i) => match(i) && (grp === 'all' || (i.group || 'Tile install') === grp) && (need === 'all' || (need === 'price' ? !i.price : i.type === 'labor' && !i.cost)))
  const groups = ITEM_GROUPS.filter((g) => ours.some((i) => (i.group || 'Tile install') === g))
  const cats = (Object.keys(MAT_CAT) as MatCat[]).filter((c) => mats.some((i) => i.cat === c))
  const title = tab === 'ours' ? (need === 'price' ? 'No price yet' : need === 'rate' ? 'No installer rate yet' : grp === 'all' ? 'Your items' : grp) : tab === 'material' ? (cat === 'all' ? 'Setting materials' : MAT_CAT[cat].label) : 'Labor rates'
  const count = tab === 'ours' ? shownOurs.length : tab === 'material' ? shownMats.length : shownLabor.length
  return (
    <Page
      title="Items"
      sub={ours.length ? <>Your products and services from QuickBooks — what estimates are priced with — and the setting materials the takeoff orders from.</> : `The materials the takeoff orders from, and our labor rates.${smp(' Sample prices.')}`}
      actions={<Button variant="primary" icon={<Upload />} onClick={() => s.open({ t: 'importitems' })}>Import from QuickBooks</Button>}
      top={
        <Bubbles
          items={[
            ...(ours.length ? [{ key: 'ours', label: 'Your items', count: ours.length, sub: 'from QuickBooks', icon: <FileSpreadsheet />, color: 'blue' as BubbleColor, on: tab === 'ours' && need === 'all', onClick: () => { setTab('ours'); setNeed('all') } }] : []),
            ...(ours.length ? [{ key: 'price', label: 'No price yet', count: noPrice.length, icon: <CircleDollarSign />, color: 'amber' as BubbleColor, on: tab === 'ours' && need === 'price', onClick: () => { setTab('ours'); setNeed(need === 'price' ? 'all' : 'price') } }] : []),
            ...(ours.length ? [{ key: 'rate', label: 'No installer rate', count: noRate.length, icon: <HardHat />, color: 'orange' as BubbleColor, on: tab === 'ours' && need === 'rate', onClick: () => { setTab('ours'); setNeed(need === 'rate' ? 'all' : 'rate') } }] : []),
            { key: 'material', label: 'Setting materials', count: mats.length, icon: <Package />, color: 'teal', on: tab === 'material', onClick: () => { setTab('material'); setCat('all') }, gapBefore: ours.length > 0 },
            ...(!ours.length ? [{ key: 'labor', label: 'Labor rates', count: labor.length, icon: <Hammer />, color: 'orange' as BubbleColor, on: tab === 'labor', onClick: () => setTab('labor') }] : []),
          ]}
        />
      }
      toolbar={
        <>
          <span className="mr-2 flex-1 text-[0.9375rem] font-semibold text-ink">{title} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{count}</span></span>
          <div className="flex shrink-0 items-center gap-2 max-md:w-full max-md:flex-wrap">
            {tab === 'ours' && <Filter icon={<Layers />} label="Group" value={grp} options={groups.map((g) => ({ key: g, label: g }))} onChange={setGrp} />}
            {tab === 'material' && <Filter icon={<Layers />} label="Kind" value={cat} options={cats.map((c) => ({ key: c, label: MAT_CAT[c].label }))} onChange={(v) => setCat(v as MatCat | 'all')} />}
            {tab === 'material' && <Filter icon={<Truck />} label="Supplier" value={vendor} options={vendors.map((v) => ({ key: v, label: v }))} onChange={setVendor} />}
            <ClearFilters show={vendor !== 'all' || !!q || cat !== 'all' || grp !== 'all'} onClear={() => { setVendor('all'); setQ(''); setCat('all'); setGrp('all') }} />
            <ToolbarSearch value={q} onChange={setQ} placeholder={tab === 'material' ? 'Search brand or product' : 'Search items'} />
          </div>
        </>
      }
    >
      {tab === 'ours' && (
        <Table minWidth={820}>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th w={80}>Unit</Th>
              <Th w={130} right>We charge</Th>
              <Th w={170} right className="max-md:hidden">We pay the installer</Th>
              <Th w={110} right className="max-lg:hidden">Margin</Th>
            </tr>
          </thead>
          <tbody>
            {(grp === 'all' && need === 'all' && !q ? groups : ['_']).map((g) => {
              const rows = g === '_' ? shownOurs : shownOurs.filter((i) => (i.group || 'Tile install') === g)
              if (!rows.length) return null
              return (
                <React.Fragment key={g}>
                  {g !== '_' && <GroupRow label={g} count={rows.length} colSpan={5} tone="neutral" />}
                  {rows.map((i) => (
                    <Tr key={i.id} onClick={() => s.open({ t: 'item', id: i.id })}>
                      <Td>
                        <div className="truncate text-[0.875rem] font-semibold text-ink">{i.name}</div>
                        <div className="truncate text-[0.78125rem] text-muted">{i.desc || ITEM_TYPE_LABEL[i.type]}</div>
                      </Td>
                      <Td className="text-[0.84375rem] text-ink-2">{i.unit}</Td>
                      <Td right className={cn('tnum', i.price ? 'text-ink' : 'text-warn-700')}>{i.price ? price(i.price) : 'Priced per job'}</Td>
                      <Td right className={cn('tnum max-md:hidden', i.cost ? 'text-ink-2' : 'text-faint')}>{i.cost ? price(i.cost) : i.type === 'labor' ? 'Not set' : '—'}</Td>
                      <Td right className="tnum text-muted max-lg:hidden">{i.cost && i.price ? `${Math.round(((i.price - i.cost) / i.price) * 100)}%` : '—'}</Td>
                    </Tr>
                  ))}
                </React.Fragment>
              )
            })}
            {!shownOurs.length && <EmptyRow colSpan={5} title="No items match" sub="Try another group or clear the search." />}
          </tbody>
        </Table>
      )}
      {tab === 'material' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))] gap-3 p-5 max-sm:grid-cols-2 max-sm:gap-2 max-sm:p-3">
          {shownMats.map((i) => <MatCard key={i.id} i={i} />)}
          {!shownMats.length && <div className="col-span-full"><EmptyState title="No materials match" sub="Try another kind or clear the search." /></div>}
        </div>
      )}
      {tab === 'labor' && (
        <Table minWidth={760}>
          <thead>
            <tr>
              <Th>Rate</Th>
              <Th w={70} className="max-md:hidden">Unit</Th>
              <Th w={120} right>We charge</Th>
              <Th w={140} right className="max-md:hidden">We pay the installer</Th>
              <Th w={90} right className="max-lg:hidden">Margin</Th>
            </tr>
          </thead>
          <tbody>
            {shownLabor.map((i) => (
              <Tr key={i.id} onClick={() => s.open({ t: 'item', id: i.id })}>
                <Td>
                  <div className="truncate text-[0.875rem] font-medium text-ink">{i.name}</div>
                  <div className="truncate text-[0.78125rem] text-muted">{ITEM_TYPE_LABEL[i.type]} · QuickBooks {i.qb}</div>
                </Td>
                <Td className="text-[0.84375rem] text-muted max-md:hidden">{i.unit}</Td>
                <Td right className="tnum text-ink">{price(i.price)}</Td>
                <Td right className="tnum max-md:hidden">{i.cost ? price(i.cost) : '—'}</Td>
                <Td right className="tnum text-muted max-lg:hidden">{i.cost && i.price ? `${Math.round(((i.price - i.cost) / i.price) * 100)}%` : '—'}</Td>
              </Tr>
            ))}
            {!shownLabor.length && <EmptyRow colSpan={5} title="No rates match" />}
          </tbody>
        </Table>
      )}
    </Page>
  )
}

function MatCard({ i }: { i: Item }) {
  const s = useStore()
  const cat = MAT_CAT[i.cat || 'supplies']
  return (
    <button onClick={() => s.open({ t: 'item', id: i.id })} className="group flex min-w-0 flex-col rounded-2xl border border-line bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift">
      <div className="relative flex items-center justify-center rounded-xl" style={{ background: `${cat.color}12` }}>
        <ProductPic kind={i.pic || 'box'} color={i.tint || cat.color} label={i.product} sub={i.pack} photo={i.photo} size={132} bg={false} className="max-sm:h-[6.5rem] max-sm:w-[6.5rem]" />
        {i.usedFor && (
          <Tip label={`The takeoff orders it: ${i.usedFor.toLowerCase()}`}>
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[0.6875rem] font-semibold text-ok-700 shadow-xs"><Sparkles className="h-3 w-3" />Takeoff</span>
          </Tip>
        )}
      </div>
      <div className="mt-2.5 truncate text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-muted">{i.brand}</div>
      <div className="truncate text-[0.9375rem] font-bold leading-snug text-ink">{i.product || i.name}</div>
      <div className="truncate text-[0.78125rem] text-muted">{i.pack || i.unit}</div>
      <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-line-2 pt-2">
        <span className="text-[0.875rem] font-bold tnum text-ink">{price(i.cost)}<span className="text-[0.75rem] font-medium text-muted"> / {i.unit}</span></span>
        <span className="truncate text-[0.75rem] text-muted">{i.vendor}</span>
      </div>
    </button>
  )
}

/* ================= one item ================= */
export function ItemModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const i = s.items.find((x) => x.id === id)
  if (!i) return null
  const paid = s.pos.flatMap((p) => p.lines.filter((l) => l.itemId === id && l.price).map((l) => ({ po: p, l })))
  const inst = s.ipos.flatMap((p) => p.lines.filter((l) => l.itemId === id && l.rate).map((l) => ({ po: p, l })))
  const onEst = s.estimates.filter((e) => e.revs.some((r) => r.lines.some((l) => l.itemId === id)))
  const mat = i.type === 'material'
  const cat = MAT_CAT[i.cat || 'supplies']
  return (
    <Modal level={level} size="lg" onClose={s.close} title={mat ? `${i.brand || ''} ${i.product || ''}`.trim() || i.name : i.name} sub={mat ? `${i.name} · ${i.pack || i.unit}` : `${ITEM_TYPE_LABEL[i.type]} · per ${i.unit} · QuickBooks ${i.qb}`}>
      <div className={cn('flex gap-6 border-b border-line pb-5 max-sm:flex-col', !mat && 'block')}>
        {mat && (
          <div className="flex shrink-0 flex-col items-center gap-2 max-sm:self-start">
            <div className="flex items-center justify-center rounded-2xl" style={{ background: `${cat.color}14` }}>
              <ProductPic kind={i.pic || 'box'} color={i.tint || cat.color} label={i.product} sub={i.pack} photo={i.photo} size={168} bg={false} />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 py-1 text-[0.78125rem] font-semibold text-ink-2 hover:bg-wash">
              <Camera className="h-3.5 w-3.5" />{i.photo ? 'Change the photo' : 'Add the real photo'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setItemPhoto(i.id, f) }} />
            </label>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {mat && (
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-wash px-2.5 text-[0.78125rem] font-semibold text-ink-2"><span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />{cat.label}</span>
              {i.vendor && <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-wash px-2.5 text-[0.78125rem] font-semibold text-ink-2"><Truck className="h-3.5 w-3.5" />{i.vendor}</span>}
              {i.usedFor && <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ok-50 px-2.5 text-[0.78125rem] font-semibold text-ok-700"><Sparkles className="h-3.5 w-3.5" />Takeoff: {i.usedFor.toLowerCase()}</span>}
            </div>
          )}
          {mat && !i.id.startsWith('qb-') ? (
            <div className="grid grid-cols-3 gap-6 max-sm:grid-cols-1">
              <div><div className="text-[0.8125rem] text-muted">We last paid</div><div className="text-[1.375rem] font-semibold tnum text-ink">{price(i.cost)}<span className="text-[0.8125rem] font-medium text-muted"> / {i.unit}</span></div></div>
              <div><div className="text-[0.8125rem] text-muted">On estimates</div><div className="text-[1.375rem] font-semibold tnum text-ink">{price(i.price)}</div></div>
              <div><div className="text-[0.8125rem] text-muted">QuickBooks item</div><div className="mt-1 truncate text-[0.875rem] font-medium text-ink">{i.qb}</div></div>
            </div>
          ) : <ItemEdit i={i} />}
        </div>
      </div>
      <div className="mb-1.5 mt-6 text-[0.8125rem] font-medium text-muted">{i.type === 'labor' ? 'On installer POs' : 'What we paid, PO by PO'}</div>
      {paid.map(({ po, l }, k) => <Line key={k} onClick={() => s.open({ t: 'po', id: po.id })} title={`${po.id} · ${po.supplier}`} sub={`${s.jobs[po.jobId]?.name} · ${l.qty} · ${po.date || ''}`} right={`${price(l.price!)} / ${i.unit}`} />)}
      {inst.map(({ po, l }, k) => <Line key={'i' + k} onClick={() => s.open({ t: 'ipo', id: po.id })} title={`${po.id} · ${PEOPLE[po.crew].name}`} sub={`${s.jobs[po.jobId]?.name} · ${l.qty}`} right={`${price(l.rate!)} / ${i.unit}`} />)}
      {!paid.length && !inst.length && <div className="py-2 text-[0.84375rem] text-muted">Not on any PO yet.</div>}
      {!mat && (
        <>
          <div className="mb-1.5 mt-7 text-[0.8125rem] font-medium text-muted">On estimates</div>
          {onEst.map((e) => <Line key={e.id} onClick={() => s.open({ t: 'estimate', id: e.id })} title={`${e.id} · ${s.jobs[e.jobId]?.name}`} sub={e.status === 'approved' ? 'Approved' : 'Open'} right="" />)}
          {!onEst.length && <div className="py-2 text-[0.84375rem] text-muted">Not on any estimate yet.</div>}
        </>
      )}
    </Modal>
  )
}
/** the numbers anyone with the admin login can fix: the unit, what we charge, what we pay the installer */
function ItemEdit({ i }: { i: Item }) {
  const s = useStore()
  const [p, setP] = React.useState(i.price ? String(i.price) : '')
  const [c, setC] = React.useState(i.cost ? String(i.cost) : '')
  const save = (patch: Partial<Item>, msg: string) => s.commit((st) => { const it = st.items.find((x) => x.id === i.id); if (it) Object.assign(it, patch) }, msg, { undo: false })
  const num = (v: string) => Math.round((Number(v.replace(/[^0-9.]/g, '')) || 0) * 100) / 100
  return (
    <div>
      {i.desc && <div className="mb-4 text-[0.875rem] text-ink-2">{i.desc}</div>}
      <div className="grid grid-cols-[7.5rem_1fr_1fr] gap-4 max-sm:grid-cols-1">
        <Field label="Unit">
          <SearchSelect label="Unit" value={i.unit} onChange={(u) => save({ unit: u }, `${i.name} — per ${u}`)} options={UNITS.map((u) => ({ key: u, label: u }))} search={false} width={160} />
        </Field>
        <Field label="We charge" hint={i.price ? `per ${i.unit}` : 'Empty = priced on each estimate'}>
          <TextInput inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} onBlur={() => num(p) !== i.price && save({ price: num(p) }, `${i.name} — ${price(num(p))} / ${i.unit}`)} placeholder="$0.00" className="tnum" />
        </Field>
        <Field label="We pay the installer" hint={i.type === 'labor' ? 'Goes on his PO and his weekly pay' : 'Only for labor'}>
          <TextInput inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} onBlur={() => num(c) !== i.cost && save({ cost: num(c) }, `${i.name} — installer gets ${price(num(c))} / ${i.unit}`)} placeholder="$0.00" className="tnum" />
        </Field>
      </div>
      <div className="mt-3 text-[0.78125rem] text-muted">QuickBooks item: {i.qb}{i.group ? ` · ${i.group}` : ''}</div>
    </div>
  )
}

function Line({ title, sub, right, onClick }: { title: string; sub?: string; right?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-line-2 px-2 py-2.5 text-left transition-colors hover:bg-wash">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] text-ink">{title}</span>
        {sub && <span className="block truncate text-[0.78125rem] text-muted">{sub}</span>}
      </span>
      {right && <span className="shrink-0 text-[0.84375rem] tnum text-ink-2">{right}</span>}
    </button>
  )
}

/* ================= import: QuickBooks or a supplier's price list ================= */
type NewProd = Omit<Item, 'id' | 'type' | 'qb'> & { sku: string }
const PRICE_LIST: NewProd[] = [
  { sku: 'INF-2210', name: 'Rapid-set thinset · 50 lb', brand: 'Mapei', product: 'Ultraflex RS', cat: 'mortar', pic: 'bag', tint: '#5f6670', pack: '50 lb bag', unit: 'bag', price: 64, cost: 47, vendor: 'Infinity' },
  { sku: 'INF-3104', name: 'Urethane grout · 1 gal', brand: 'Custom Building Products', product: 'Fusion Pro', cat: 'grout', pic: 'pail', tint: '#9b8471', pack: '1 gal', unit: 'pail', price: 118, cost: 86, vendor: 'Infinity' },
  { sku: 'INF-4420', name: 'Crack isolation · 1 gal', brand: 'Laticrete', product: 'Blue 92', cat: 'waterproofing', pic: 'jug', tint: '#4569c9', pack: '1 gal', unit: 'gal', price: 74, cost: 52, vendor: 'Infinity' },
  { sku: 'INF-5012', name: 'Shower niche 12 × 24', brand: 'Schluter', product: 'KERDI-BOARD-SN', cat: 'board', pic: 'box', tint: '#e08a2a', pack: '12 × 24 in', unit: 'pc', price: 96, cost: 70, vendor: 'Infinity' },
  { sku: 'MW-0880', name: 'Stair nosing · 8 ft', brand: 'Schluter', product: 'TREP-FL', cat: 'trim', pic: 'trim', tint: '#a4abb3', pack: '8 ft · aluminum', unit: 'pc', price: 68, cost: 50, vendor: 'Metal Works Inc.' },
  { sku: 'INF-6100', name: 'Penetrating sealer · gallon', brand: 'Aqua Mix', product: 'Enrich ‘N’ Seal', cat: 'care', pic: 'jug', tint: '#3e9a68', pack: '1 gal', unit: 'gal', price: 129, cost: 92, vendor: 'Infinity' },
]
export function ImportItemsModal({ level }: { level: number }) {
  const s = useStore()
  const [from, setFrom] = React.useState<'list' | 'qb' | null>(null)
  const [pick, setPick] = React.useState<string[]>(PRICE_LIST.map((p) => p.sku))
  const [read, setRead] = React.useState<(QBRead & { file: string }) | null>(null)
  const [take, setTake] = React.useState<string[]>([])
  const have = (p: NewProd) => s.items.some((i) => i.name === p.name)
  const rows = PRICE_LIST.filter((p) => !have(p))
  const add = () => {
    const chosen = rows.filter((p) => pick.includes(p.sku))
    s.commit((st) => {
      chosen.forEach((p) => {
        const { sku, ...rest } = p
        st.items.push({ ...rest, id: 'm-' + sku.toLowerCase(), type: 'material', qb: `Materials:${p.product}` })
      })
    }, `${chosen.length} products added to the catalog`, { close: true, sub: 'With their pictures, brand and price. QuickBooks gets them as items too.' })
  }
  /* a line that looks like one job's scope, or a stray entry, starts unticked */
  const oneOff = (r: QBRead['rows'][number]) => r.item.price > 15000 || /^bathroom #\d/i.test(r.item.name) || (/^[a-z]{2,5}$/.test(r.item.name) && !r.item.price && !r.item.desc)
  const openFile = (f: File) => {
    const fr = new FileReader()
    fr.onload = () => {
      const r = readQB(String(fr.result || ''), s.items)
      setRead({ ...r, file: f.name })
      setTake(r.rows.filter((x) => x.status !== 'same' && !(x.status === 'new' && oneOff(x))).map((x) => x.item.id))
    }
    fr.readAsText(f)
  }
  const changes = read ? read.rows.filter((r) => r.status !== 'same') : []
  const doImport = () => {
    if (!read) return
    const chosen = changes.filter((r) => take.includes(r.item.id))
    s.commit((st) => {
      chosen.forEach(({ item }) => {
        const at = st.items.findIndex((x) => x.id === item.id)
        if (at >= 0) st.items[at] = { ...st.items[at], price: item.price, cost: item.cost || st.items[at].cost, desc: item.desc, qb: item.qb }
        else st.items.push(item)
      })
    }, `${chosen.length} ${chosen.length === 1 ? 'item' : 'items'} updated from QuickBooks`, { close: true, sub: 'New estimates use these prices. Estimates already sent keep theirs.' })
  }
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={from === 'qb' ? 'Import from QuickBooks' : 'Import products'}
      sub={from === 'qb' ? 'Your Products and Services list, exported from QuickBooks as a CSV file.' : 'Your QuickBooks items, or a supplier’s price list.'}
      footer={from === 'list' ? (
        <>
          <span className="text-[0.84375rem] text-muted">{pick.filter((k) => rows.some((r) => r.sku === k)).length} of {rows.length} picked</span>
          <Button className="ml-auto" variant="ghost" onClick={() => setFrom(null)}>Back</Button>
          <Button variant="primary" icon={<Check />} disabled={!rows.some((r) => pick.includes(r.sku))} onClick={add}>Add to the catalog</Button>
        </>
      ) : from === 'qb' && read && !read.problem ? (
        <>
          <span className="text-[0.84375rem] text-muted">{take.length} of {changes.length} picked</span>
          <Button className="ml-auto" variant="ghost" onClick={() => setRead(null)}>Another file</Button>
          <Button variant="primary" icon={<Check />} disabled={!take.length} onClick={doImport}>Update {take.length} {take.length === 1 ? 'item' : 'items'}</Button>
        </>
      ) : undefined}
    >
      {!from && (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <OptionCard icon={<RefreshCw />} tone="ok" title="Your QuickBooks items" sub="The Products and Services export (CSV). New items are added, changed prices are updated." onClick={() => setFrom('qb')} />
          <OptionCard icon={<FileSpreadsheet />} title="A supplier’s price list" sub="Setting materials from Infinity, Metal Works or anyone — with their pictures. Sample list." onClick={() => setFrom('list')} />
        </div>
      )}
      {from === 'qb' && !read && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#d0d5dc] bg-wash px-6 py-12 text-center transition hover:border-brand-300 hover:bg-brand-50/40">
          <Upload className="h-6 w-6 text-brand-600" />
          <span className="text-[0.9375rem] font-semibold text-ink">Pick the CSV file from QuickBooks</span>
          <span className="max-w-md text-[0.84375rem] text-muted">Export Products and Services from QuickBooks — it saves a .csv file. Payments, deposits, fees and test items are left out by themselves.</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f) }} />
        </label>
      )}
      {from === 'qb' && read?.problem && (
        <div className="flex items-start gap-3 rounded-xl border border-warn-100 bg-warn-50 px-4 py-3 text-[0.875rem] text-warn-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{read.problem} <button className="font-semibold underline" onClick={() => setRead(null)}>Pick another file</button></span></div>
      )}
      {from === 'qb' && read && !read.problem && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-wash px-4 py-3 text-[0.84375rem]">
            <span className="inline-flex items-center gap-2 font-semibold text-ink"><FileSpreadsheet className="h-4 w-4 text-ok-600" />{read.file}</span>
            <span className="text-ink-2"><b className="font-semibold">{read.rows.filter((r) => r.status === 'new').length}</b> new</span>
            <span className="text-ink-2"><b className="font-semibold">{read.rows.filter((r) => r.status === 'changed').length}</b> changed</span>
            <span className="text-muted">{read.rows.filter((r) => r.status === 'same').length} the same</span>
            {read.left.length > 0 && <span className="text-muted">{read.left.length} left out (payments, fees, tests)</span>}
          </div>
          {changes.length ? (
            <div className="overflow-hidden rounded-xl border border-line">
              {changes.map((r) => {
                const on = take.includes(r.item.id)
                return (
                  <button key={r.item.id} onClick={() => setTake(on ? take.filter((k) => k !== r.item.id) : [...take, r.item.id])} className="flex w-full items-center gap-3 border-b border-line-2 px-3 py-2.5 text-left last:border-0 hover:bg-wash">
                    <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.375rem] border-2', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c6ccd4]')}>{on && <Check className="h-3 w-3" strokeWidth={3.4} />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-semibold text-ink">{r.item.name}</span>
                      <span className="block truncate text-[0.78125rem] text-muted">{r.status === 'new' ? `New · ${r.item.group} · per ${r.item.unit}` : `Was ${r.was?.price ? price(r.was.price) : 'no price'}`}{r.item.desc ? ` · ${r.item.desc}` : ''}</span>
                    </span>
                    <span className="shrink-0 text-[0.84375rem] font-semibold tnum text-ink">{r.item.price ? price(r.item.price) : 'No price'}</span>
                  </button>
                )
              })}
            </div>
          ) : <div className="py-8 text-center text-[0.875rem] text-muted">Everything matches — your items are already up to date.</div>}
        </div>
      )}
      {from === 'list' && (
        <div>
          <div className="mb-3 flex items-center gap-3 rounded-xl border border-dashed border-[#d0d5dc] bg-wash px-4 py-3">
            <FileSpreadsheet className="h-5 w-5 text-ok-600" />
            <span className="min-w-0 flex-1 text-[0.84375rem]"><b className="font-semibold text-ink">Infinity price list — October.xlsx</b> <span className="text-muted">· sample file · {PRICE_LIST.length} products, {rows.length} new</span></span>
          </div>
          {rows.length ? (
            <div className="overflow-hidden rounded-xl border border-line">
              {rows.map((p) => {
                const on = pick.includes(p.sku)
                return (
                  <button key={p.sku} onClick={() => setPick(on ? pick.filter((k) => k !== p.sku) : [...pick, p.sku])} className="flex w-full items-center gap-3 border-b border-line-2 px-3 py-2.5 text-left last:border-0 hover:bg-wash">
                    <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.375rem] border-2', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c6ccd4]')}>{on && <Check className="h-3 w-3" strokeWidth={3.4} />}</span>
                    <ProductPic kind={p.pic as PicKind} color={p.tint || MAT_CAT[p.cat as MatCat].color} label={p.product} sub={p.pack} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.875rem] font-semibold text-ink">{p.brand} {p.product}</span>
                      <span className="block truncate text-[0.78125rem] text-muted">{p.name} · {p.sku}</span>
                    </span>
                    <span className="shrink-0 text-[0.84375rem] font-semibold tnum text-ink">{price(p.cost)} <span className="font-normal text-muted">/ {p.unit}</span></span>
                  </button>
                )
              })}
            </div>
          ) : <div className="py-8 text-center text-[0.875rem] text-muted">Everything on this list is already in the catalog.</div>}
        </div>
      )}
    </Modal>
  )
}
