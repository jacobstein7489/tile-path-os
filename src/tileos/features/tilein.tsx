/* The tile came in — counted the way it's counted on site: in boxes.
 *   Every tile on the project is listed (the GC's tile too, that Tile OS never saw ordered) — what's still to come
 *   first. For each: how many boxes came (a big − and +), and what's in a box: the square feet printed on the box, or
 *   how many tiles are in it (worked into square feet from the tile's size). That's asked once per tile and kept with
 *   it — next time only the boxes.
 *   As the boxes go in, each line says what that is and whether it's enough for the walls and floors it goes on, with
 *   the extra for cuts — short says by how much, right there. Save: checked in, and anything short lands on the Today
 *   of whoever orders the tile with Order more tile ready, the difference filled in. */
import * as React from 'react'
import { AlertTriangle, Truck, Package } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { Button, Stepper } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { tilesOf, tileOf, type Tile } from '@/tileos/data/jobs'
import { receiveBoxes, needOf } from './flows'
import { FormHead, FormRow, ProjectField } from './formkit'
import { useSmall } from '@/tileos/lib/phone'

/** one tile's square feet from its size ("12 × 24", "24x48") — inches, so width × height ÷ 144 */
export const pieceSF = (size?: string): number | undefined => {
  const m = (size || '').match(/(\d+(?:\.\d+)?)\s*["″]?\s*[x×]\s*(\d+(?:\.\d+)?)/i)
  if (!m) return undefined
  const sf = (Number(m[1]) * Number(m[2])) / 144
  return sf > 0 ? sf : undefined
}
const num = (v: string) => { const n = Number(String(v).replace(/[^\d.]/g, '')); return Number.isFinite(n) && n > 0 ? n : 0 }
const fmt = (n: number) => (Math.round(n * 10) / 10).toLocaleString('en-US')

type Row = { boxes: number; sf: string; pcs: string }

export function TileInModal({ jobId: jobId0, tag, level }: { jobId?: string; tag?: string; level: number }) {
  const s = useStore()
  const small = useSmall()
  const [jobId, setJobId] = React.useState(jobId0 || '')
  const job = s.jobs[jobId]
  const checks = s.checks.filter((c) => c.jobId === jobId)
  const tags = Array.from(new Set([...tilesOf(jobId).map((t) => t.tag), ...checks.map((c) => c.tag)]))
  /* what's still to come first (the one asked for on top), then the rest */
  const left = (g: string) => { const c = checks.find((x) => x.tag === g); return c ? Math.max(0, c.ordered - c.received) : 0 }
  const order = [...tags].sort((a, b) => Number(b === tag) - Number(a === tag) || Number(left(b) > 0) - Number(left(a) > 0) || a.localeCompare(b))
  /* filled in: the boxes still to come, when that's known */
  const start = (): Record<string, Row> => Object.fromEntries(order.map((g) => {
    const t = tileOf(jobId, g)
    const c = checks.find((x) => x.tag === g)
    const per = t?.boxSF
    const boxes = !c || !left(g) ? 0 : /box/i.test(c.unit) ? left(g) : per ? Math.ceil(left(g) / per) : 0
    return [g, { boxes, sf: per ? String(per) : '', pcs: '' }]
  }))
  const [rows, setRows] = React.useState<Record<string, Row>>(start)
  /* what's still coming can be filled in only once what's in its box is known */
  const filled = order.some((g) => { const c = checks.find((x) => x.tag === g); return !!c && left(g) > 0 && (/box/i.test(c.unit) || !!tileOf(jobId, g)?.boxSF) })
  React.useEffect(() => { setRows(start()) }, [jobId])
  const set = (g: string, p: Partial<Row>) => setRows((r) => ({ ...r, [g]: { ...(r[g] || { boxes: 0, sf: '', pcs: '' }), ...p } }))
  /* what's in a box: the square feet typed, or the tiles in it × one tile's square feet */
  const perBox = (g: string, t?: Tile) => { const r = rows[g]; if (!r) return 0; return num(r.sf) || (num(r.pcs) && pieceSF(t?.size) ? Math.round(num(r.pcs) * pieceSF(t?.size)! * 100) / 100 : 0) }
  const lines = order.map((g) => {
    const t = tileOf(jobId, g)
    const c = checks.find((x) => x.tag === g)
    const r = rows[g] || { boxes: 0, sf: '', pcs: '' }
    const per = perBox(g, t)
    const inBoxes = !!c && /box/i.test(c.unit)
    /* how much this is, and how much there'll be with what's already here */
    const now = inBoxes ? r.boxes : per ? r.boxes * per : 0
    const unit = inBoxes ? 'boxes' : 'SF'
    const have = (c?.received || 0) + now
    const need = c ? needOf(s, jobId, c) : (() => { const on = (s.rooms[jobId] || []).flatMap((rm) => rm.surfaces).filter((x) => x.tile === g && (x.sf || 0) > 0); const sf = on.reduce((n, x) => n + (x.sf || 0), 0); return sf ? Math.ceil(sf * 1.1) : undefined })()
    const missingBox = r.boxes > 0 && !inBoxes && !per
    return { g, t, c, r, per, now, unit, have, need, missingBox }
  })
  const picked = lines.filter((l) => l.r.boxes > 0)
  const ok = !!job && picked.length > 0 && !picked.some((l) => l.missingBox)
  const save = () => { if (ok) receiveBoxes(jobId, picked.map((l) => ({ tag: l.g, boxes: l.r.boxes, boxSF: l.per || undefined }))) }
  const boxesN = picked.reduce((n, l) => n + l.r.boxes, 0)
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="The tile came in"
      header={<FormHead k="delivery" kicker={job ? job.name : undefined} title="The tile came in" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          {job && <Button variant="ghost" icon={<AlertTriangle className="h-4 w-4" />} className="max-sm:hidden" onClick={() => s.swap({ t: 'problem', jobId })}>Broken, wrong or missing?</Button>}
          <Button className={cn('ml-auto', small && 'h-12 flex-1 text-[1rem]')} variant="primary" icon={<Truck className="h-[1.125rem] w-[1.125rem]" />} disabled={!ok} onClick={save} data-tilein-save>
            {picked.length ? `Check in ${boxesN} ${boxesN === 1 ? 'box' : 'boxes'}` : 'Check it in'}
          </Button>
        </>
      }
    >
      {!jobId0 && <FormRow label="Project"><ProjectField value={jobId} onChange={setJobId} keep={(j) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage)} /></FormRow>}
      {job && (
        <>
          <div className="text-[0.875rem] text-muted">How many boxes came of each{filled ? ' — what’s still coming is filled in' : ''}.</div>
          <div className="mt-3 flex flex-col gap-2.5" data-tilein-list>
            {lines.map((l) => {
              /* still on order after this, and short only against all of it — what's here and what's coming */
              const known = l.r.boxes > 0 && (!!l.per || l.unit === 'boxes')
              const coming = known && l.c ? Math.max(0, l.c.ordered - l.have) : 0
              const short = known && l.need != null ? Math.max(0, Math.ceil(l.need - Math.max(l.c?.ordered || 0, l.have))) : 0
              const enough = known && l.need != null && !short && !coming
              return (
                <div key={l.g} className={cn('rounded-xl border px-3.5 py-3', l.r.boxes > 0 ? 'border-brand-200 bg-brand-50/30' : 'border-line bg-white')} data-tilein-tile={l.g}>
                  <div className="flex items-center gap-3">
                    {l.t ? <TileImg tile={l.t} size={40} radius={8} /> : <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wash-2 text-faint"><Package className="h-4 w-4" /></span>}
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block text-[0.9375rem] font-semibold text-ink"><span className="tnum">{l.g}</span>{l.t?.name ? <span className="font-normal text-ink-2"> {l.t.name}</span> : null}</span>
                      <span className="mt-0.5 block text-[0.8125rem] text-muted">{[l.t?.size, l.c ? (left(l.g) ? `${fmt(left(l.g))} ${l.c.unit} still to come` : l.c.received ? 'all of it here' : '') : l.need != null ? `needs ${fmt(l.need)} SF` : ''].filter(Boolean).join(' · ')}</span>
                    </span>
                    {!small && <Stepper typed value={l.r.boxes} onChange={(n) => set(l.g, { boxes: n })} min={0} max={999} suffix="boxes" />}
                  </div>
                  {small && <div className="mt-2.5"><Stepper big typed value={l.r.boxes} onChange={(n) => set(l.g, { boxes: n })} min={0} max={999} suffix={l.r.boxes === 1 ? 'box' : 'boxes'} /></div>}
                  {/* what's in a box — asked once, kept with the tile */}
                  {l.r.boxes > 0 && l.unit !== 'boxes' && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[0.84375rem] text-ink-2" data-tilein-box={l.g}>
                      <span className="font-medium">In a box:</span>
                      <input inputMode="decimal" value={l.r.sf} onChange={(e) => set(l.g, { sf: e.target.value.replace(/[^\d.]/g, '').slice(0, 6), pcs: '' })} placeholder="SF" aria-label={`${l.g} — square feet in a box`} className="h-10 w-20 rounded-lg border border-line bg-white px-2.5 text-right tnum text-ink outline-none focus:border-brand-400" data-tilein-sf={l.g} />
                      <span>SF</span>
                      {pieceSF(l.t?.size) && (
                        <>
                          <span className="text-muted">or</span>
                          <input inputMode="numeric" value={l.r.pcs} onChange={(e) => set(l.g, { pcs: e.target.value.replace(/[^\d]/g, '').slice(0, 4), sf: '' })} placeholder="tiles" aria-label={`${l.g} — tiles in a box`} className="h-10 w-20 rounded-lg border border-line bg-white px-2.5 text-right tnum text-ink outline-none focus:border-brand-400" data-tilein-pcs={l.g} />
                          <span>tiles</span>
                        </>
                      )}
                    </div>
                  )}
                  {/* what that is, and is it enough */}
                  {l.r.boxes > 0 && (
                    <div className={cn('mt-2 text-[0.84375rem] font-medium', l.missingBox ? 'text-warn-700' : short ? 'text-bad-600' : enough ? 'text-[#1f6b45]' : 'text-ink-2')} data-tilein-says={l.g}>
                      {l.missingBox ? 'How much is in a box? It’s on the box.'
                        : `${l.unit === 'SF' ? `= ${fmt(l.now)} SF` : `${l.r.boxes} boxes`}${coming ? ` · ${fmt(coming)} ${l.unit} still to come` : ''}${short ? ` · ${fmt(short)} ${l.unit} short of what its walls and floors need` : enough ? ' · enough for its walls and floors' : ''}`}
                    </div>
                  )}
                </div>
              )
            })}
            {!lines.length && <div className="rounded-xl border border-line px-4 py-6 text-center text-[0.875rem] text-muted">No tiles on this project yet — add them on Materials → Tile selection.</div>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            {small && <button type="button" onClick={() => s.swap({ t: 'problem', jobId })} className="inline-flex items-center gap-1.5 text-[0.875rem] font-semibold text-ink-2"><AlertTriangle className="h-4 w-4" />Broken, wrong or missing?</button>}
            {/* our materials (thinset, boards, grout) came instead: their own check-in */}
            <button type="button" onClick={() => s.swap({ t: 'record', type: 'delivery', jobId })} className="text-[0.84375rem] font-semibold text-brand-700 hover:underline" data-tilein-ours>Our materials came, not tile?</button>
          </div>
        </>
      )}
    </Modal>
  )
}
