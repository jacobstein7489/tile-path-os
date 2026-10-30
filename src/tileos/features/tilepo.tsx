/* Tile on a PO — a number to follow instead of a pile of emails.
 *   New tile PO: which tiles and how much, from which store, who pays — the client (their order number at the store;
 *     our PO is the call for the delivery, no prices) or us (with prices and a bill to come) — and when it's needed on
 *     site. It goes to the store by email with its number in the subject.
 *   Part came: how much of each line came — counted on each tile, and the rest stays open on the same PO. */
import * as React from 'react'
import { Send, Truck, PackageCheck, Mail } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Button, TextInput, TextArea, Segmented } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { TileImg } from '@/tileos/components/ui/swatch'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney } from '@/tileos/data/model'
import { tilesOf, tileOf } from '@/tileos/data/jobs'
import type { PO } from '@/tileos/data/work'
import { createTilePO, receivePOPart } from './flows'
import { mailLive } from './mailout'
import { FormHead, FormRow, ProjectField, DAY_OPTIONS, byDay } from './formkit'

/** the tile POs on a project that are still open — for one tile, when a tag is given */
export const openTilePOs = (s: Pick<Store, 'pos'>, jobId: string, tag?: string): PO[] =>
  s.pos.filter((p) => p.jobId === jobId && p.kind === 'tile' && p.step >= 1 && p.step < 3 && !/cancelled/i.test(p.note) && (!tag || p.lines.some((l) => l.tag === tag)))

const UNITS = ['SF', 'boxes', 'pallets', 'pieces']
type Draft = { tag: string; name: string; on: boolean; n: number; unit: string; price: number }

/** how much of a tile is still to come to the site: what's ordered and not here, else what the walls and floors need */
function toCome(s: Store, jobId: string, tag: string): { n: number; unit: string } {
  const c = s.checks.find((x) => x.jobId === jobId && x.tag === tag)
  if (c) return { n: Math.max(0, c.ordered - c.received), unit: c.unit }
  const sf = (s.rooms[jobId] || []).reduce((n, r) => n + r.surfaces.filter((x) => x.tile === tag).reduce((m, x) => m + (x.sf || 0), 0), 0)
  const t = tileOf(jobId, tag)
  if (t?.paper?.qty) return { n: t.paper.qty, unit: t.paper.unit }
  return { n: Math.ceil(sf * 1.1), unit: 'SF' }
}

export function NewTilePOModal({ jobId, tags, level }: { jobId?: string; tags?: string[]; level: number }) {
  const s = useStore()
  const [job, setJob] = React.useState(jobId || '')
  const j = s.jobs[job]
  const all = job ? Array.from(new Set([...tilesOf(job).map((t) => t.tag), ...s.checks.filter((c) => c.jobId === job).map((c) => c.tag)])) : []
  const first = tileOf(job, (tags && tags[0]) || all[0] || '')
  const draft = (): Draft[] =>
    all.map((tag) => {
      const t = tileOf(job, tag)
      const c = s.checks.find((x) => x.jobId === job && x.tag === tag)
      const left = toCome(s, job, tag)
      const on = tags ? tags.includes(tag) : !c || c.received < c.ordered
      return { tag, name: [t?.name, t?.size].filter(Boolean).join(' · '), on: on && left.n > 0, n: left.n, unit: left.unit, price: 0 }
    })
  const [lines, setLines] = React.useState<Draft[]>(draft)
  React.useEffect(() => { setLines(draft()) }, [job])
  /* who pays the store: the client's tile is only delivered on our PO */
  const [pays, setPays] = React.useState<'client' | 'us'>(first?.suppliedBy === 'Us' ? 'us' : 'client')
  const [store, setStore] = React.useState(first?.supplier || s.checks.find((c) => c.jobId === job)?.supplier || 'Best Tile')
  const [ref, setRef] = React.useState('')
  const [needed, setNeeded] = React.useState('Mon')
  const [memo, setMemo] = React.useState('')
  const picked = lines.filter((l) => l.on && l.n > 0)
  const total = pays === 'us' ? picked.reduce((n, l) => n + l.n * l.price, 0) : 0
  const stores = Array.from(new Set([store, ...s.suppliers.map((x) => x.name), ...s.checks.map((c) => c.supplier)].filter(Boolean)))
  const days = DAY_OPTIONS()
  if (!days.some((d) => d.key === needed)) days.unshift({ key: needed, label: needed })
  const set = (i: number, p: Partial<Draft>) => setLines((L) => L.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const send = () => {
    if (!job || !picked.length) return
    const paidBy = pays === 'us' ? 'us' : first?.suppliedBy === 'Owner' ? 'Owner' : 'GC'
    createTilePO(job, { supplier: store, paidBy, storeRef: pays === 'client' ? ref : undefined, neededBy: needed, memo, lines: picked.map((l) => ({ tag: l.tag, name: l.name, n: l.n, unit: l.unit, ...(pays === 'us' ? { price: l.price } : {}) })) })
  }
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={j ? `Tile PO · ${j.name}` : 'Tile PO'}
      header={<FormHead k="po" kicker={j ? j.name : 'Tile'} title="Tile PO" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{picked.length} {picked.length === 1 ? 'tile' : 'tiles'}{pays === 'us' ? <> · <span className="font-medium text-ink">{fmtMoney(total)}</span></> : ' · no prices — the client’s tile'}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={mailLive() ? <Send /> : <PackageCheck />} disabled={!job || !picked.length || !store.trim()} onClick={send} data-send-tile-po>{mailLive() ? `Send it to ${store}` : 'Save the PO'}</Button>
        </>
      }
    >
      <div data-tile-po-form>
        {!jobId && (
          <FormRow label="Project">
            <ProjectField value={job} onChange={setJob} keep={(x) => !['request', 'estimating', 'proposal', 'followup'].includes(x.stage)} autoFocus />
          </FormRow>
        )}
        <FormRow label="Who pays the store" hint={pays === 'client' ? 'The client bought the tile — this PO is our call for the delivery. No prices on it.' : 'We buy the tile — it has prices, and the store’s bill comes to us.'}>
          <Segmented value={pays} onChange={setPays} className="max-sm:w-full max-sm:[&>button]:flex-1" items={[{ key: 'client', label: 'The client’s tile — deliver it' }, { key: 'us', label: 'We buy it' }]} />
        </FormRow>
        <FormRow label="Store" hint={j ? <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />Delivered to {j.address}</span> : undefined}>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2 max-sm:grid-cols-1">
            <SearchSelect label="Store" value={store} onChange={setStore} search={stores.length > 8} width={340} options={stores.map((v) => ({ key: v, label: v }))} />
            <SearchSelect label="Needed on site by" value={needed} onChange={setNeeded} search={false} width={260} options={days.map((d) => ({ key: d.key, label: byDay(d.label, 'Needed by') }))} plain />
          </div>
        </FormRow>
        {pays === 'client' && (
          <FormRow label="Their order number" hint="The client’s order at the store — the store finds it by this. Optional.">
            <TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. #BT-22817" aria-label="The store’s order number" className="max-w-[16rem]" data-store-ref />
          </FormRow>
        )}
        <FormRow label="Which tile, how much" hint={job && !all.length ? 'No tile on this project yet — it comes in when the tile paperwork is entered.' : 'What’s still to come is filled in.'}>
          {lines.length > 0 && (
            <div className={cn('grid items-center gap-2 border-b border-line pb-2 text-[0.78125rem] font-medium text-muted max-sm:hidden', pays === 'us' ? 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem_6rem]' : 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem]')}>
              <span /><span>Tile</span><span className="text-right">Qty</span><span>Unit</span>{pays === 'us' && <span className="text-right">Price / unit</span>}
            </div>
          )}
          {lines.map((l, i) => (
            <label key={l.tag} data-tile-line={l.tag} className={cn('grid items-center gap-2 border-b border-line-2 py-2 max-sm:grid-cols-[1.5rem_minmax(0,1fr)_5rem]', pays === 'us' ? 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem_6rem]' : 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem]', !l.on && 'opacity-60')}>
              <input type="checkbox" checked={l.on} onChange={(e) => set(i, { on: e.target.checked })} aria-label={`Put ${l.tag} on the PO`} className="h-4 w-4 accent-[#2650cf]" />
              <span className="flex min-w-0 items-center gap-2.5">
                <TileImg tile={tileOf(job, l.tag)} size={30} radius={6} />
                <span className="min-w-0 truncate text-[0.875rem] text-ink"><b className="font-semibold">{l.tag}</b> {l.name}</span>
              </span>
              <input inputMode="decimal" aria-label={`How much ${l.tag}`} value={l.n || ''} onChange={(e) => set(i, { n: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0), on: true })} className="h-8 w-full rounded-md border border-line bg-white px-2 text-right text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none" />
              <select aria-label={`Unit for ${l.tag}`} value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} className="h-8 rounded-md border border-line bg-white px-1.5 text-[0.8125rem] text-ink max-sm:hidden">
                {Array.from(new Set([l.unit, ...UNITS])).map((u) => <option key={u}>{u}</option>)}
              </select>
              {pays === 'us' && <input inputMode="decimal" aria-label={`Price for ${l.tag}`} value={l.price || ''} placeholder="$" onChange={(e) => set(i, { price: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0) })} className="h-8 w-full rounded-md border border-line bg-white px-2 text-right text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none max-sm:hidden" />}
            </label>
          ))}
        </FormRow>
        <FormRow label="A line for the store" hint="On the PO and in its email — a gate code, call before, which door.">
          <TextArea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional" aria-label="A line for the store" />
        </FormRow>
        {mailLive() && <div className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-muted"><Mail className="h-3.5 w-3.5" />It goes to {store} by email, with its number in the subject — they reply to confirm the day.</div>}
      </div>
    </Modal>
  )
}

/** part of a PO came: how many of each line — the rest stays open on the same PO */
export function PartCameModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const p = s.pos.find((x) => x.id === id)
  const [counts, setCounts] = React.useState<number[]>(() => (p ? p.lines.map(() => 0) : []))
  const [said, setSaid] = React.useState('')
  if (!p) return null
  const any = counts.some((n) => n > 0)
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={`${p.id} · part came`}
      sub={`${s.jobs[p.jobId]?.name || ''} · ${p.supplier}`}
      footer={
        <>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<PackageCheck />} disabled={!any} onClick={() => receivePOPart(p.id, counts, said.trim() || undefined)} data-save-part>Save what came</Button>
        </>
      }
    >
      <p className="mb-3 text-[0.875rem] text-ink-2">How much of each came? Whatever didn’t stays open on {p.id} — it’s back on the list to follow up.</p>
      <div className="overflow-hidden rounded-xl border border-line">
        {p.lines.map((l, i) => {
          const left = Math.max(0, (l.n ?? 0) - (l.got || 0))
          return (
            <div key={i} className="flex min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0" data-part-line={l.tag || i}>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[0.875rem] font-medium text-ink">{l.item}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{l.got ? `${l.got} came before · ` : ''}{left} {l.unit || ''} still to come</span>
              </span>
              <input inputMode="decimal" aria-label={`How much of ${l.item} came`} disabled={!left} value={counts[i] || ''} placeholder="0" onChange={(e) => { const n = Math.min(left, Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)); setCounts((C) => C.map((x, k) => (k === i ? n : x))) }} className="h-9 w-[5.5rem] rounded-md border border-line bg-white px-2 text-right text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none disabled:bg-wash" />
              <button type="button" disabled={!left} onClick={() => setCounts((C) => C.map((x, k) => (k === i ? left : x)))} className="shrink-0 text-[0.8125rem] font-semibold text-brand-700 hover:underline disabled:text-faint">All {left}</button>
            </div>
          )
        })}
      </div>
      <TextInput className="mt-3" value={said} onChange={(e) => setSaid(e.target.value)} placeholder={`What ${p.supplier} said about the rest (optional)`} aria-label="What the store said" />
    </Modal>
  )
}
