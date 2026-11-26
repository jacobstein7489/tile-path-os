/* Tile on a PO — a number to follow instead of a pile of emails.
 *   New tile PO: which tiles and how much, from which store, who pays — the client (their order number at the store;
 *     our PO is the call for the delivery, no prices) or us (with prices and a bill to come) — and when it's needed on
 *     site. It goes to the store by email with its number in the subject.
 *   Part came: how much of each line came — counted on each tile, and the rest stays open on the same PO. */
import * as React from 'react'
import { Send, Truck, PackageCheck, Mail, Eye, ChevronLeft, CircleAlert } from 'lucide-react'
import { useStore, NOW, type Store } from '@/tileos/store'
import { Button, TextInput, TextArea, Segmented } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { TileImg } from '@/tileos/components/ui/swatch'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn, peekPO } from '@/tileos/lib/utils'
import { fmtMoney } from '@/tileos/data/model'
import { tilesOf, tileOf, hasTile, sfFor, tilesOn, floorsOf, type Room } from '@/tileos/data/jobs'
import { takesTile } from './steps'
import { whereIn } from './roomdetails'
import type { PO } from '@/tileos/data/work'
import { createTilePO, receivePOPart } from './flows'
import { paperQty } from './steps'
import { sellsTile } from '@/tileos/data/directory'
import { mailLive, poWords, poMail, supplierEmails } from './mailout'
import { FormHead, FormRow, ProjectField, DAY_OPTIONS, byDay } from './formkit'

/** the tile POs on a project that are still open — for one tile, when a tag is given */
export const openTilePOs = (s: Pick<Store, 'pos'>, jobId: string, tag?: string): PO[] =>
  s.pos.filter((p) => p.jobId === jobId && p.kind === 'tile' && p.step >= 1 && p.step < 3 && !/cancelled/i.test(p.note) && (!tag || p.lines.some((l) => l.tag === tag)))

const UNITS = ['SF', 'boxes', 'pallets', 'pieces']
type Draft = { tag: string; name: string; on: boolean; n: number; unit: string; price: number }

/** the job's tile by area, the way the scope of work has it: each floor, each room, the tiles on its walls and floors
 *  (and where in the room) — a tile on two rooms is under both; tile on no wall or floor yet comes last */
export function tileAreas(rooms: Room[], tags: string[]) {
  const seen = new Set<string>()
  const groups = floorsOf(rooms).map((g) => ({
    floor: g.floor,
    rooms: g.rooms.map((r) => {
      const on = Array.from(new Set(r.surfaces.filter((x) => takesTile(x.name) || tilesOn(x).length).flatMap((x) => tilesOn(x)))).filter((tag) => tags.includes(tag))
      on.forEach((tag) => seen.add(tag))
      return { room: r.name, tiles: on.map((tag) => ({ tag, where: whereIn(r, tag) })) }
    }).filter((r) => r.tiles.length),
  })).filter((g) => g.rooms.length)
  return { groups, loose: tags.filter((tag) => !seen.has(tag)) }
}
const areaKey = (room: string, tag: string) => `${room}|${tag}`

/** how much of a tile is still to come to the site: what's ordered and not here, else what the walls and floors need */
function toCome(s: Store, jobId: string, tag: string): { n: number; unit: string } {
  const c = s.checks.find((x) => x.jobId === jobId && x.tag === tag)
  if (c) return { n: Math.max(0, c.ordered - c.received), unit: c.unit }
  const sf = (s.rooms[jobId] || []).reduce((n, r) => n + r.surfaces.filter((x) => hasTile(x, tag)).reduce((m, x) => m + sfFor(jobId, x, tag), 0), 0)
  const t = tileOf(jobId, tag)
  if (t?.paper?.qty) return { n: t.paper.qty, unit: t.paper.unit }
  return { n: Math.ceil(sf * 1.1), unit: 'SF' }
}

/** how much more of a tile the project needs: a shortage reported on it, else what the paperwork came up short */
function shortOf(s: Store, jobId: string, tag: string): { n: number; unit?: string } {
  const sh = s.shortages.find((x) => x.jobId === jobId && x.tag === tag && x.step === 'short')
  if (sh) return { n: sh.qty, unit: sh.unit }
  const t = tileOf(jobId, tag)
  const q = t ? paperQty(s, jobId, t) : undefined
  return q && q.short > 0 ? { n: q.short, unit: q.unit } : { n: 0 }
}

/** a tile PO — or, "Order more tile" (more): more of the same tile when the project came up short, on top of what was
 *  ordered. It goes to the store with its number, like any tile PO; a shortage reported on the tile is reordered on it */
export function NewTilePOModal({ jobId, tags, qty, units, more, shortId, level }: { jobId?: string; tags?: string[]; qty?: Record<string, number>; /** what the amounts are in (a problem logged in boxes) */ units?: Record<string, string>; more?: boolean; shortId?: string; level: number }) {
  const s = useStore()
  const [job, setJob] = React.useState(jobId || '')
  const j = s.jobs[job]
  const all = job ? Array.from(new Set([...tilesOf(job).map((t) => t.tag), ...s.checks.filter((c) => c.jobId === job).map((c) => c.tag)])) : []
  const first = tileOf(job, (tags && tags[0]) || all[0] || '')
  const draft = (): Draft[] =>
    all.map((tag) => {
      const t = tileOf(job, tag)
      const c = s.checks.find((x) => x.jobId === job && x.tag === tag)
      const name = [t?.name, t?.size].filter(Boolean).join(' · ')
      /* more tile: only what's short is filled in — the rest is 0 until you type how much */
      if (more) {
        const sh = qty?.[tag] != null ? { n: qty[tag] } : shortOf(s, job, tag)
        const unit = units?.[tag] || ('unit' in sh && sh.unit) || c?.unit || t?.paper?.unit || 'SF'
        return { tag, name, on: (tags ? tags.includes(tag) : true) && sh.n > 0, n: sh.n, unit, price: 0 }
      }
      const left = toCome(s, job, tag)
      const on = tags ? tags.includes(tag) : !c || c.received < c.ordered
      return { tag, name, on: on && left.n > 0, n: left.n, unit: left.unit, price: 0 }
    })
  const [lines, setLines] = React.useState<Draft[]>(draft)
  /* by area, the way the scope of work has it: each floor, each room, the tiles in it */
  const areas = tileAreas(s.rooms[job] || [], all)
  /* more tile: how much for each room (a tile in two rooms has a line in each) — what's known to be short is filled in
     where it was found */
  const perInit = (L: Draft[] = draft()): Record<string, number> => {
    const out: Record<string, number> = {}
    if (!more) return out
    L.forEach((l) => {
      if (!l.on || !l.n) return
      const found = s.shortages.find((x) => x.jobId === job && x.tag === l.tag && x.step === 'short')?.surfaces?.[0]?.room
      const rooms = areas.groups.flatMap((g) => g.rooms).filter((r) => r.tiles.some((x) => x.tag === l.tag)).map((r) => r.room)
      const room = found && rooms.includes(found) ? found : rooms[0] || ''
      out[areaKey(room, l.tag)] = l.n
    })
    return out
  }
  const [per, setPer] = React.useState<Record<string, number>>(() => perInit(lines))
  React.useEffect(() => { const L = draft(); setLines(L); setPer(perInit(L)) }, [job])
  const perTag = (tag: string) => Object.entries(per).reduce((n, [k, v]) => (k.endsWith(`|${tag}`) ? n + (v || 0) : n), 0)
  const order = [...areas.groups.flatMap((g) => g.rooms.flatMap((r) => r.tiles.map((x) => x.tag))), ...areas.loose].filter((tag, i, a) => a.indexOf(tag) === i)
  /* the rooms each one is for, on its line on the PO ("— Master bath floor") */
  const forRooms = (tag: string) => areas.groups.flatMap((g) => g.rooms).filter((r) => (per[areaKey(r.room, tag)] || 0) > 0).map((r) => { const w = r.tiles.find((x) => x.tag === tag)?.where; return `${r.room}${w ? ` ${w.toLowerCase()}` : ''}` })
  /* who pays the store: the client's tile is only delivered on our PO */
  const [pays, setPays] = React.useState<'client' | 'us'>(first?.suppliedBy === 'Us' ? 'us' : 'client')
  /* the store each tile comes from — what its paperwork says (or the PO it was on before). Tile is ordered from the
     store it comes from, never another one: one store → that's it, locked; two → one of those two; none set yet → a
     tile store from Suppliers, and it's kept with the tiles from then on */
  const storeOf = (tag: string) => tileOf(job, tag)?.supplier || s.checks.find((c) => c.jobId === job && c.tag === tag)?.supplier || j?.tileStore || ''
  /* the job's tile store (set once — the first tile PO, the paperwork, or on Tile & materials) is where it all goes */
  const jobStores = Array.from(new Set([...(j?.tileStore ? [j.tileStore] : []), ...all.map(storeOf)].filter(Boolean)))
  const tileStores = s.suppliers.filter((x) => sellsTile(x) && !s.inactive.includes('supplier:' + x.name)).map((x) => x.name)
  const pickStore = () => (tags?.length ? storeOf(tags[0]) : '') || jobStores[0] || tileStores[0] || ''
  const [store, setStore] = React.useState(pickStore)
  React.useEffect(() => { setStore(pickStore()) }, [job])
  /* more tile: each tile goes to its own store — nothing to pick (tile from two stores makes a PO for each) */
  const each = !!more && jobStores.length > 1
  const fromHere = (tag: string) => each || !storeOf(tag) || storeOf(tag) === store
  const [ref, setRef] = React.useState('')
  /* more tile: needed today, unless you say otherwise; nothing else to fill in — who pays follows the tile, the PO
     number is made by itself */
  const [needed, setNeeded] = React.useState(more ? 'Today' : 'Mon')
  const [memo, setMemo] = React.useState('')
  const byArea = !!more && order.length > 0
  const picked = byArea
    ? order.map((tag) => lines.find((l) => l.tag === tag)).filter((l): l is Draft => !!l && perTag(l.tag) > 0 && fromHere(l.tag)).map((l) => { const rooms = forRooms(l.tag); return { ...l, n: perTag(l.tag), name: rooms.length ? `${l.name} · ${rooms.join(', ')}` : l.name } })
    : order.map((tag) => lines.find((l) => l.tag === tag)).filter((l): l is Draft => !!l && l.on && l.n > 0 && fromHere(l.tag))
  /* prices on the window: a tile we buy, on a tile PO — more tile keeps it to what and how much */
  const priced = pays === 'us' && !more
  const total = pays === 'us' && !more ? picked.reduce((n, l) => n + l.n * l.price, 0) : 0
  const stores = jobStores.length ? jobStores : Array.from(new Set([...tileStores, store].filter(Boolean)))
  const days = DAY_OPTIONS()
  if (!days.some((d) => d.key === needed)) days.unshift({ key: needed, label: needed })
  const set = (i: number, p: Partial<Draft>) => setLines((L) => L.map((x, k) => (k === i ? { ...x, ...p } : x)))
  /* more tile, one room's line: the tile (and where in the room), how much more for there */
  const areaLine = (room: string, tag: string, where?: string) => {
    const i = lines.findIndex((x) => x.tag === tag)
    const l = lines[i]
    if (!l || !fromHere(tag)) return null
    const k = areaKey(room, tag)
    const n = per[k] || 0
    const setN = (v: number) => setPer((P) => ({ ...P, [k]: v }))
    return (
      <label key={k} data-tile-line={tag} data-tile-area={room} className={cn('grid grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem] items-center gap-2 border-b border-line-2 py-2 max-sm:grid-cols-[1.5rem_minmax(0,1fr)_5rem]', !n && 'opacity-70')}>
        <input type="checkbox" checked={n > 0} onChange={(e) => setN(e.target.checked ? n || 1 : 0)} aria-label={`More ${tag}${room ? ` for ${room}` : ''}`} className="h-4 w-4 accent-[#2650cf]" />
        <span className="flex min-w-0 items-center gap-2.5">
          <TileImg tile={tileOf(job, tag)} size={30} radius={6} />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[0.875rem] text-ink"><b className="font-semibold">{tag}</b> {l.name}</span>
            {(where || each) && <span className="block truncate text-[0.75rem] text-muted" data-tile-where>{[where, each ? storeOf(tag) : ''].filter(Boolean).join(' · ')}</span>}
          </span>
        </span>
        <input inputMode="decimal" aria-label={`How much more ${tag}${room ? ` for ${room}` : ''}`} value={n || ''} onChange={(e) => setN(Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0))} className="h-8 w-full rounded-md border border-line bg-white px-2 text-right text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none" />
        <select aria-label={`Unit for ${tag}`} value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} className="h-8 rounded-md border border-line bg-white px-1.5 text-[0.8125rem] text-ink max-sm:hidden">
          {Array.from(new Set([l.unit, ...UNITS])).map((u) => <option key={u}>{u}</option>)}
        </select>
      </label>
    )
  }
  const paidBy = pays === 'us' ? 'us' : first?.suppliedBy === 'Owner' ? 'Owner' : 'GC'
  /* one PO for each store the checked tile comes from (more tile from two stores) — else one */
  const groups = (): [string, Draft[]][] => {
    if (!each) return [[store, picked]]
    const g = new Map<string, Draft[]>()
    picked.forEach((l) => { const st = storeOf(l.tag) || store; g.set(st, [...(g.get(st) || []), l]) })
    return [...g.entries()]
  }
  /* the POs as they'll go out — for the review, before anything is sent (their numbers aren't used up yet) */
  const drafts = (): PO[] => groups().map(([st, ls], k) => ({
    id: peekPO(k), jobId: job, kind: 'tile', paidBy, supplier: st, what: '', step: 1, date: NOW, eta: 'Asked for ' + needed, note: '', log: [],
    ...(pays === 'client' && !each && ref.trim() ? { storeRef: ref.trim() } : {}), ...(memo.trim() ? { memo: memo.trim() } : {}), ...(more ? { more: true } : {}),
    amount: Math.round(ls.reduce((n, l) => n + (pays === 'us' ? l.n * l.price : 0), 0)),
    lines: ls.map((l) => ({ item: `${l.tag} ${l.name}`.trim(), qty: `${l.n.toLocaleString('en-US')} ${l.unit}`, n: l.n, unit: l.unit, tag: l.tag, got: 0, ...(pays === 'us' ? { price: l.price } : {}) })),
  }) as PO)
  /* nothing goes out before it's looked at: the email's words, to whom, and the PO as the store gets it */
  const [rev, setRev] = React.useState<null | { subject: string; message: string }>(null)
  const review = () => { const ds = drafts(); if (ds.length) setRev(poWords(s, ds[0], { many: ds.length > 1 })) }
  const send = () => {
    if (!job || !picked.length) return
    const lineOf = (l: Draft) => ({ tag: l.tag, name: l.name, n: l.n, unit: l.unit, ...(pays === 'us' ? { price: l.price } : {}) })
    const list = groups()
    const first0 = peekPO(0)
    list.forEach(([st, ls], i) => {
      const id = peekPO(0)
      /* the words as reviewed — each PO with its own number in them */
      const mail = rev ? { subject: list.length === 1 ? rev.subject : undefined, message: rev.message.split(first0).join(id) } : undefined
      createTilePO(job, { supplier: st, paidBy, storeRef: pays === 'client' && !each ? ref : undefined, neededBy: needed, memo: list.length === 1 ? memo : undefined, more, shortId, lines: ls.map(lineOf), mail, quiet: i < list.length - 1, says: list.length > 1 ? `${list.length} POs sent · ${list.map(([x]) => x).join(' and ')}` : undefined })
    })
  }
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={j ? `${more ? 'Order more tile' : 'Tile PO'} · ${j.name}` : more ? 'Order more tile' : 'Tile PO'}
      header={<FormHead k={more ? 'moretile' : 'po'} kicker={j ? j.name : 'Tile'} title={more ? 'Order more tile' : 'Tile PO'} />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={rev ? (
        /* the review: back to change it, or send it as it is */
        <>
          <Button variant="ghost" icon={<ChevronLeft />} onClick={() => setRev(null)} data-tile-po-back>Back</Button>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" icon={mailLive() ? <Send /> : <PackageCheck />} onClick={send} data-send-tile-po>{mailLive() ? (each ? 'Send them' : `Send it to ${store}`) : 'Save the PO'}</Button>
        </>
      ) : (
        <>
          <span className="text-[0.84375rem] text-muted">{picked.length} {picked.length === 1 ? 'tile' : 'tiles'}{priced ? <> · <span className="font-medium text-ink">{fmtMoney(total)}</span></> : more ? ` · a PO number of its own` : ' · no prices. The client’s tile'}</span>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" icon={<Eye />} disabled={!job || !picked.length || (!each && !store.trim())} onClick={review} data-review-tile-po>Review it</Button>
        </>
      )}
    >
      {rev && <POReview pos={drafts()} rev={rev} setRev={setRev} />}
      <div data-tile-po-form className={rev ? 'hidden' : undefined}>
        {!jobId && (
          <FormRow label="Project">
            <ProjectField value={job} onChange={setJob} keep={(x) => !['request', 'estimating', 'proposal', 'followup'].includes(x.stage)} autoFocus />
          </FormRow>
        )}
        {!more && (
          <FormRow label="Who pays the store" hint={pays === 'client' ? 'The client bought the tile. This PO is our call for the delivery. No prices on it.' : 'We buy the tile. It has prices, and the store’s bill comes to us.'}>
            <Segmented value={pays} onChange={setPays} className="max-sm:w-full max-sm:[&>button]:flex-1" items={[{ key: 'client', label: 'The client’s tile · deliver it' }, { key: 'us', label: 'We buy it' }]} />
          </FormRow>
        )}
        <FormRow label="Store" hint={j ? <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />{jobStores.length === 1 ? `Where this project’s tile comes from · delivered to ${j.address}` : jobStores.length ? `This project’s tile comes from ${jobStores.join(' and ')} · delivered to ${j.address}` : `No store on this project’s tile yet. It’s kept with the tile from this PO on · delivered to ${j.address}`}</span> : undefined}>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2 max-sm:grid-cols-1">
            {/* the store is the tile's own — nothing to change (a regular tile PO from a project with two stores picks one
                of those two; with no store on the tile yet, one is picked once and kept) */}
            {jobStores.length === 1 || each || (more && store && jobStores.length)
              ? <div className="flex h-10 min-w-0 items-center rounded-[0.625rem] border border-line bg-wash px-3 text-[0.875rem] font-semibold text-ink" data-store-fixed>{each ? jobStores.join(' · ') : store}</div>
              : <SearchSelect label="Store" value={store} onChange={setStore} search={stores.length > 8} width={340} options={stores.map((v) => ({ key: v, label: v }))} placeholder="Pick the tile store" />}
            <SearchSelect label="Needed on site by" value={needed} onChange={setNeeded} search={false} width={260} options={days.map((d) => ({ key: d.key, label: byDay(d.label, 'Needed by') }))} plain />
          </div>
        </FormRow>
        {pays === 'client' && !more && (
          <FormRow label="Their order number" hint="The client’s order at the store. The store finds it by this. Optional.">
            <TextInput value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. #BT-22817" aria-label="The store’s order number" className="max-w-[16rem]" data-store-ref />
          </FormRow>
        )}
        <FormRow label={more ? 'Which tile, how much more' : 'Which tile, how much'} hint={job && !all.length ? 'No tile on this project yet. It comes in when the tile paperwork is entered.' : more ? 'By area, like the scope of work. How much more for each room, on top of what was ordered. What’s known to be short is filled in.' : 'What’s still to come is filled in. Under each tile, where it goes.'}>
          {lines.length > 0 && (
            <div className={cn('grid items-center gap-2 border-b border-line pb-2 text-[0.78125rem] font-medium text-muted max-sm:hidden', priced ? 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem_6rem]' : 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem]')}>
              <span /><span>Tile</span><span className="text-right">Qty</span><span>Unit</span>{priced && <span className="text-right">Price / unit</span>}
            </div>
          )}
          {/* more tile: by area — each floor, each room, its tiles; how much for that room */}
          {byArea && areas.groups.map((g) => (
            <div key={g.floor} data-tile-floor={g.floor}>
              {(areas.groups.length > 1 || g.floor !== 'Rooms') && <div className="mt-2 px-1 pb-1 text-[0.6875rem] font-bold uppercase tracking-[0.07em] text-[#2c4a3e]">{g.floor}</div>}
              {g.rooms.map((r) => (
                <div key={r.room} data-tile-room={r.room}>
                  <div className="rounded-md bg-wash-2 px-2.5 py-1 text-[0.75rem] font-bold uppercase tracking-[0.02em] text-[#333]">{r.room}</div>
                  {r.tiles.map(({ tag, where }) => areaLine(r.room, tag, where))}
                </div>
              ))}
            </div>
          ))}
          {byArea && areas.loose.length > 0 && (
            <div data-tile-room="">
              <div className="mt-2 rounded-md bg-wash-2 px-2.5 py-1 text-[0.75rem] font-bold uppercase tracking-[0.02em] text-[#333]">Not on a wall or floor yet</div>
              {areas.loose.map((tag) => areaLine('', tag))}
            </div>
          )}
          {!byArea && order.map((tag) => {
            const i = lines.findIndex((x) => x.tag === tag)
            const l = lines[i]
            if (!l || !fromHere(l.tag)) return null
            /* where it goes — so you see what's what */
            const where = areas.groups.flatMap((g) => g.rooms).filter((r) => r.tiles.some((x) => x.tag === tag)).map((r) => r.room)
            return (
              <label key={l.tag} data-tile-line={l.tag} className={cn('grid items-center gap-2 border-b border-line-2 py-2 max-sm:grid-cols-[1.5rem_minmax(0,1fr)_5rem]', priced ? 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem_6rem]' : 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_6rem]', !l.on && 'opacity-60')}>
                <input type="checkbox" checked={l.on} onChange={(e) => set(i, { on: e.target.checked })} aria-label={`Put ${l.tag} on the PO`} className="h-4 w-4 accent-[#2650cf]" />
                <span className="flex min-w-0 items-center gap-2.5">
                  <TileImg tile={tileOf(job, l.tag)} size={30} radius={6} />
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate text-[0.875rem] text-ink"><b className="font-semibold">{l.tag}</b> {l.name}</span>
                    <span className="block truncate text-[0.75rem] text-muted" data-tile-where>{[each ? storeOf(l.tag) : '', where.length ? where.join(', ') : 'Not on a wall or floor yet'].filter(Boolean).join(' · ')}</span>
                  </span>
                </span>
                <input inputMode="decimal" aria-label={`How much ${l.tag}`} value={l.n || ''} onChange={(e) => set(i, { n: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0), on: true })} className="h-8 w-full rounded-md border border-line bg-white px-2 text-right text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none" />
                <select aria-label={`Unit for ${l.tag}`} value={l.unit} onChange={(e) => set(i, { unit: e.target.value })} className="h-8 rounded-md border border-line bg-white px-1.5 text-[0.8125rem] text-ink max-sm:hidden">
                  {Array.from(new Set([l.unit, ...UNITS])).map((u) => <option key={u}>{u}</option>)}
                </select>
                {priced && <input inputMode="decimal" aria-label={`Price for ${l.tag}`} value={l.price || ''} placeholder="$" onChange={(e) => set(i, { price: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0) })} className="h-8 w-full rounded-md border border-line bg-white px-2 text-right text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none max-sm:hidden" />}
              </label>
            )
          })}
        </FormRow>
        {!more && (
          <FormRow label="A line for the store" hint="On the PO and in its email. A gate code, call before, which door.">
            <TextArea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional" aria-label="A line for the store" />
          </FormRow>
        )}
        {mailLive() && <div className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-muted"><Mail className="h-3.5 w-3.5" />Next you see the email and the PO, the way {store} gets them. Nothing goes out before you send it.</div>}
      </div>
    </Modal>
  )
}

/** the review before a PO goes out: to whom, the words (type over them), and the PO as the store gets it — the real
 *  email, pictures and all */
function POReview({ pos, rev, setRev }: { pos: PO[]; rev: { subject: string; message: string }; setRev: (r: { subject: string; message: string }) => void }) {
  const s = useStore()
  const live = mailLive()
  return (
    <div className="flex flex-col gap-4" data-tile-po-review>
      {!live && (
        <div className="flex items-start gap-2 rounded-xl bg-warn-50 px-3.5 py-2.5 text-[0.875rem] text-warn-700"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />Email isn’t set up in the app yet. The PO is saved, and you send it yourself (Print or Email it on the PO).</div>
      )}
      {pos.map((p) => {
        const to = supplierEmails(s, p.supplier)
        return (
          <FormRow key={p.id} label={pos.length > 1 ? `To ${p.supplier} · ${p.id}` : 'To'}>
            <div className={cn('flex min-h-10 items-center rounded-[0.625rem] border px-3 text-[0.9375rem]', to.length ? 'border-line bg-wash text-ink' : 'border-warn-100 bg-warn-50 text-warn-700')} data-review-to>
              {to.length ? `${p.supplier} · ${to.join(', ')}` : `${p.supplier} has no email in Tile OS. Add it (Suppliers → ${p.supplier}), or call them`}
            </div>
          </FormRow>
        )
      })}
      {pos.length === 1 && (
        <FormRow label="Subject">
          <TextInput value={rev.subject} onChange={(e) => setRev({ ...rev, subject: e.target.value })} aria-label="Subject" data-review-subject />
        </FormRow>
      )}
      <FormRow label="Message" hint="Type over it. The PO's lines and the tile pictures go under it by themselves.">
        <TextArea rows={8} value={rev.message} onChange={(e) => setRev({ ...rev, message: e.target.value })} aria-label="Message" data-review-message />
      </FormRow>
      {pos.map((p) => <MailPreview key={p.id} html={previewHtml(s, p, pos.length > 1 ? { message: rev.message.split(pos[0].id).join(p.id) } : rev)} label={pos.length > 1 ? `What ${p.supplier} gets` : `What ${p.supplier} gets`} />)}
    </div>
  )
}
/** the email as the store sees it — its pictures shown here in place */
function previewHtml(s: Store, p: PO, o: { subject?: string; message?: string }) {
  const m = poMail(s, p, o)
  /* its pictures in place, and the logo from here (the email has it from the published app) */
  return m.attachments.reduce((h, a) => h.split(`cid:${a.content_id}`).join(`data:${a.content_type};base64,${a.content}`), m.html).replace(/src="[^"]*\/logo-email\.png"/, 'src="/logo-email.png"')
}
function MailPreview({ html, label }: { html: string; label: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null)
  const [h, setH] = React.useState(420)
  const fit = () => { const d = ref.current?.contentDocument; if (d?.body) setH(Math.min(1400, d.documentElement.scrollHeight + 4)) }
  return (
    <div data-review-preview>
      <div className="mb-1.5 text-[0.875rem] font-semibold text-ink">{label}</div>
      <div className="overflow-hidden rounded-xl border border-line bg-white px-4 py-3">
        <iframe ref={ref} title={label} srcDoc={`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}img{max-width:100%}</style></head><body>${html}</body></html>`} onLoad={fit} className="block w-full border-0" style={{ height: h }} sandbox="allow-same-origin" />
      </div>
    </div>
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
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" icon={<PackageCheck />} disabled={!any} onClick={() => receivePOPart(p.id, counts, said.trim() || undefined)} data-save-part>Save what came</Button>
        </>
      }
    >
      <p className="mb-3 text-[0.875rem] text-ink-2">How much of each came? Whatever didn’t stays open on {p.id} · it’s back on the list to follow up.</p>
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
