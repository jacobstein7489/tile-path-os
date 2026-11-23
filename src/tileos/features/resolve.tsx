import * as React from 'react'
import { Droplets, ArrowRight, Check, CheckCircle2, AlertTriangle, Package, CalendarDays, Smartphone, Receipt, Layers3, ScrollText, Camera, Truck, HardHat, Clock3, Repeat, Building2, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { keepFiles } from '@/tileos/lib/files'
import { REAL, backToMe } from '@/tileos/lib/save'
import { useStore, signInAs, meOf } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { Button, OptionCard, Chip, Field, Pill, IconCircle, Avatar, Stepper as NumStepper, TextInput } from '@/tileos/components/ui/core'
import { Swatch, TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, PEOPLE, ROLES, roleDef, type Role, LOGIN_TYPES, loginOf } from '@/tileos/data/model'
import { tileOf, hasTile, sfFor } from '@/tileos/data/jobs'
import { needNow, shortNow } from '@/tileos/data/work'
import { DRAIN_ANSWERS, resolveDrain, approveCO004, thinsetDecision, settleQty, receiveMat, receiveTile, receiveTiles, verifyPunch } from './flows'
import { setTileOrdered } from './flows2'
import { shiftText, shiftDeep } from '@/tileos/lib/today'

function JobHead({ jobId, kicker, title, right }: { jobId: string; kicker: string; title: string; right?: React.ReactNode }) {
  const job = useStore((s) => s.jobs[jobId])
  return (
    <div className="flex items-center gap-4 border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
      <div className="min-w-0 flex-1">
        <div className="text-[0.84375rem] font-medium text-muted">{job?.name} · {kicker}</div>
        <h2 className="h-tight text-[1.375rem] font-bold text-ink max-sm:text-[1.1875rem]">{title}</h2>
      </div>
      {right}
    </div>
  )
}

export function DrainModal({ level }: { level: number }) {
  const close = useStore((s) => s.close)
  const [pick, setPick] = React.useState<number | null>(null)
  return (
    <Modal
      level={level}
      size="md"
      onClose={close}
      title="Drain answer"
      header={<JobHead jobId="119" kicker="Master Bath · shower floor · drain" title="Record the plumber’s answer" right={<Pill tone="bad">Blocks 1 surface</Pill>} />}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">The answer becomes a permanent installation direction.</span>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" disabled={pick === null} onClick={() => resolveDrain(pick!)}>Save answer</Button>
        </>
      }
    >
      <div className="mb-5 rounded-2xl bg-wash px-4 py-3.5">
        <div className="text-[0.8125rem] font-semibold text-muted">{shiftText('The question · asked Sep 22')}</div>
        <div className="mt-1 text-[0.96875rem] font-medium text-ink">Is this the final drain, and does the trim go in before or after tile?</div>
      </div>
      <div className="flex flex-col gap-2.5">
        {DRAIN_ANSWERS.map((a, i) => (
          <OptionCard key={i} on={pick === i} onClick={() => setPick(i)} title={a.a} sub={a.b} icon={<Droplets className="h-5 w-5" />} />
        ))}
      </div>
    </Modal>
  )
}

export function CO004Modal({ level }: { level: number }) {
  const close = useStore((s) => s.close)
  const [by, setBy] = React.useState('')
  const [how, setHow] = React.useState('')
  const cascade = [
    { i: Layers3, t: 'Scope', d: 'Full height becomes the approved scope. The 3 ft version stays in history.' },
    { i: Package, t: 'Finish tile', d: 'About 96 SF more T-06. The GC is asked to add it to their order.' },
    { i: ScrollText, t: 'Materials', d: 'Thinset, grout, clips and metal recalculated.' },
    { i: CalendarDays, t: 'Schedule', d: shiftText('About one more crew day. Finish moves to Oct 12.') },
    { i: Smartphone, t: 'Crew', d: 'Philip’s phone changes from “hold at 3 ft” to full height.' },
    { i: Receipt, t: 'Accounting', d: 'CO-004 becomes ready to bill · $6,850.' },
  ]
  return (
    <Modal
      level={level}
      size="lg"
      onClose={close}
      title="Record CO-004 approval"
      header={<JobHead jobId="119" kicker="Change order CO-004" title="Boys bath walls · 3 ft to full height" right={<div className="text-right"><div className="text-[1.5rem] font-bold tnum text-ink">$6,850</div><div className="text-[0.78125rem] text-muted">{shiftText('Priced Sep 24')}</div></div>} />}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{how === 'Verbal' ? 'Verbal is allowed. A “get it in writing” item is created.' : 'One approval updates six departments.'}</span>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" disabled={!by || !how} icon={<ShieldCheck className="h-[1.125rem] w-[1.125rem]" />} onClick={() => approveCO004({ by, how })}>Record approval</Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_23.75rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
            <div className="flex-1 text-center">
              <div className="text-[0.78125rem] text-muted">Approved today</div>
              <div className="text-[1.125rem] font-bold text-muted line-through decoration-faint">3 ft high</div>
            </div>
            <ArrowRight className="h-5 w-5 text-faint" />
            <div className="flex-1 text-center">
              <div className="text-[0.78125rem] text-muted">Client asked for</div>
              <div className="text-[1.125rem] font-bold text-ink">Full height</div>
            </div>
          </div>
          <Field label="Who approved it?">
            <div className="flex flex-wrap gap-2">
              {['GC project manager', 'Owner’s rep', 'Client'].map((x) => <Chip key={x} on={by === x} onClick={() => setBy(x)}>{x}</Chip>)}
            </div>
          </Field>
          <Field label="How?">
            <div className="flex flex-wrap gap-2">
              {['Signed change order', 'Email', 'Verbal'].map((x) => <Chip key={x} on={how === x} onClick={() => setHow(x)}>{x}</Chip>)}
            </div>
            {how === 'Verbal' && <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-warn-50 px-3 py-2.5 text-[0.84375rem] text-warn-700"><AlertTriangle className="h-4 w-4" />Allowed by company rule. Written backup is required and tracked.</div>}
          </Field>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-5">
          <div className="text-[0.9375rem] font-semibold text-ink">The moment you approve</div>
          <div className="mt-3 flex flex-col gap-3">
            {cascade.map((c) => (
              <div key={c.t} className="flex gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-card"><c.i className="h-4 w-4" /></span>
                <div>
                  <div className="text-[0.84375rem] font-semibold text-ink">{c.t}</div>
                  <div className="text-[0.8125rem] leading-snug text-ink-2">{c.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function ThinsetModal({ level }: { level: number }) {
  const close = useStore((s) => s.close)
  const [pick, setPick] = React.useState<'chase' | 'reorder' | ''>('')
  return (
    <Modal
      level={level}
      size="md"
      onClose={close}
      title="Thinset decision"
      header={<JobHead jobId="828" kicker="PO-1039 · Infinity" title="Thinset is 23 days late. Chase or reorder?" right={<Pill tone="bad">Return on hold</Pill>} />}
      footer={
        <>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" disabled={!pick} onClick={() => thinsetDecision(pick as any)}>{pick === 'reorder' ? 'Set up the new PO' : 'Save decision'}</Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {shiftDeep([['Ordered', 'Aug 25'], ['Promised', 'Sep 5'], ['Last call', 'Sep 8 · “next week”']]).map(([a, b]) => (
          <div key={a} className="rounded-xl bg-wash px-3.5 py-3">
            <div className="text-[0.78125rem] text-muted">{a}</div>
            <div className="text-[0.875rem] font-semibold text-ink">{b}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <OptionCard on={pick === 'chase'} onClick={() => setPick('chase')} icon={<Clock3 className="h-5 w-5" />} title="Chase Infinity. Decide again Wednesday" sub="It waits on Infinity and comes back to you Wednesday by itself." />
        <OptionCard on={pick === 'reorder'} onClick={() => setPick('reorder')} icon={<Repeat className="h-5 w-5" />} title="Reorder from another supplier now" sub="PO-1039 is cancelled and kept in history. The return can be booked when it lands." />
      </div>
    </Modal>
  )
}

/** what was ordered of the tile, typed in: the number and SF or boxes — saved as you leave the box (Undo puts it back) */
function OrderedBox({ jobId, tag, have, unit }: { jobId: string; tag: string; have?: number; unit: 'SF' | 'boxes' }) {
  const [q, setQ] = React.useState(have != null ? String(have) : '')
  const [u, setU] = React.useState<'SF' | 'boxes'>(unit)
  React.useEffect(() => setQ(have != null ? String(have) : ''), [have])
  const save = (uu = u) => { const n = Number(q); if (q.trim() && !isNaN(n) && (n !== have || uu !== unit)) setTileOrdered(jobId, tag, n, uu) }
  return (
    <div className="mt-1 flex items-center gap-2">
      <TextInput inputMode="decimal" aria-label={`How much of ${tag} was ordered`} value={q} placeholder="0" onChange={(e) => setQ(e.target.value.replace(/[^\d.]/g, ''))} onBlur={() => save()} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className="h-11 w-28 text-right text-[1.125rem] font-bold tnum" data-qty-ordered-in />
      <span className="inline-flex rounded-[0.625rem] bg-white p-0.5 ring-1 ring-inset ring-line">
        {(['SF', 'boxes'] as const).map((k) => <button key={k} type="button" onClick={() => { setU(k); save(k) }} aria-pressed={u === k} className={cn('h-9 rounded-[0.5rem] px-3 text-[0.875rem] font-semibold transition', u === k ? 'bg-ink text-white' : 'text-ink-2 hover:bg-wash')} data-qty-unit={k}>{k === 'SF' ? 'SF' : 'Boxes'}</button>)}
      </span>
    </div>
  )
}
/* A tile's count, how it adds up: every wall and floor it goes on with its square feet (one without any said plainly —
 * tap it to put them in), the extra for cuts, our takeoff; their order; the difference. Short: how to settle it. */
const sfWords = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('en-US')} SF`
export function QtyModal({ jobId, tag, level }: { jobId: string; tag: string; level: number }) {
  const s = useStore()
  const c = s.checks.find((x) => x.jobId === jobId && x.tag === tag)
  const [pick, setPick] = React.useState<'askgc' | 'order' | 'accept' | ''>('')
  const t = tileOf(jobId, tag)
  const lines = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.filter((x) => hasTile(x, tag)).map((x) => ({ room: r.name, name: x.name, sf: sfFor(jobId, x, tag) })))
  const live = lines.reduce((n, l) => n + l.sf, 0)
  const none = lines.filter((l) => !l.sf)
  if (!c && !lines.length) return null
  /* our takeoff: the walls and floors as they are now, with the extra for cuts (none with square feet yet: what was
     counted when their order was checked) — the same numbers the tile's line goes by */
  const boxes = !!c && /box/i.test(c.unit)
  const measured = live > 0 || !c ? live : c.measured
  const pct = c ? c.wastePct : 10
  const need = c ? needNow(s.rooms[jobId], jobId, c) : Math.ceil(live * 1.1)
  const short = c ? shortNow(s.rooms[jobId], jobId, c) : 0
  const gap = c ? need - c.ordered : 0
  /* the walls and floors changed since their order was checked (square feet only — boxes are counted their own way) */
  const moved = !!c && !boxes && live > 0 && Math.abs(live - c.measured) >= 1
  const unit = c?.unit || 'SF'
  const title = short ? `Their order is ${short} ${unit} short of our takeoff` : c ? 'Their order covers our takeoff' : 'Our takeoff'
  const row = 'flex min-h-10 items-center gap-3 border-t border-line-2 px-4 py-2 first:border-t-0 max-sm:px-3'
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="How it adds up"
      header={<JobHead jobId={jobId} kicker={`${tag}${t?.name ? ` ${t.name}` : ''}`} title={title} />}
      footer={short ? (
        <>
          <span className="text-[0.84375rem] text-muted max-sm:hidden">Settled now, not when the crew is standing there.</span>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" disabled={!pick} onClick={() => settleQty(jobId, tag, pick as any)}>{pick === 'order' ? 'Set up the PO' : 'Save'}</Button>
        </>
      ) : <><div className="ml-auto" aria-hidden /><Button variant="primary" onClick={s.close}>Done</Button></>}
    >
      <div className="flex flex-col gap-5" data-qty-breakdown>
        {/* where our takeoff comes from: each wall and floor, tap one to change its square feet */}
        <section>
          <div className="mb-2 flex items-center gap-3">
            <TileImg tile={t} size={40} />
            <div className="min-w-0">
              <div className="text-[0.9375rem] font-semibold text-ink">Where our takeoff comes from</div>
              <div className="text-[0.8125rem] text-muted">Every wall and floor {tag} goes on. Tap one to change its square feet.</div>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-line" data-qty-lines>
            {lines.map((l) => (
              <button key={l.room + '|' + l.name} type="button" onClick={() => s.open({ t: 'surface', jobId, room: l.room, surface: l.name })} className={cn(row, 'w-full text-left transition hover:bg-wash')} data-qty-line={`${l.room} · ${l.name}`}>
                <span className="min-w-0 flex-1 text-[0.9375rem] text-ink"><span className="text-muted">{l.room} · </span>{l.name}</span>
                <span className={cn('shrink-0 text-[0.9375rem] tnum', l.sf ? 'text-ink' : 'font-medium text-warn-700')}>{l.sf ? sfWords(l.sf) : 'No square feet yet'}</span>
              </button>
            ))}
            {!lines.length && <div className={row}><span className="text-[0.875rem] text-muted">It isn’t on a wall or floor anymore.</span></div>}
            <div className={cn(row, 'bg-[#faf8f5]')}><span className="flex-1 text-[0.9375rem] text-ink-2">Measured</span><span className="text-[0.9375rem] font-semibold tnum text-ink" data-qty-measured>{boxes && live <= 0 ? `${measured} ${unit}` : sfWords(measured)}</span></div>
            <div className={cn(row, 'bg-[#faf8f5]')}><span className="flex-1 text-[0.9375rem] text-ink-2">Extra for cuts · {pct}%</span><span className="text-[0.9375rem] tnum text-ink">+ {boxes && live <= 0 ? `${Math.round(measured * pct) / 100} ${unit}` : sfWords((measured * pct) / 100)}</span></div>
            <div className={cn(row, 'bg-[#faf8f5]')}><span className="flex-1 text-[0.9375rem] font-semibold text-ink">Our takeoff</span><span className="text-[1.0625rem] font-bold tnum text-ink" data-qty-need>{need.toLocaleString('en-US')} {unit}</span></div>
          </div>
          {none.length > 0 && <div className="mt-2 text-[0.8125rem] font-medium text-warn-700" data-qty-none>{none.length} {none.length === 1 ? 'wall or floor has' : 'walls and floors have'} no square feet yet, so our takeoff is low. Tap {none.length === 1 ? 'it' : 'each one'} to put them in.</div>}
          {moved && <div className="mt-2 text-[0.8125rem] text-muted" data-qty-moved>When their order went in, the walls and floors came to {sfWords(c!.measured)}. They’re {sfWords(live)} now, and that’s what it goes by.</div>}
        </section>
        {/* their order and the difference */}
        <section className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="rounded-xl bg-wash px-4 py-3">
            <div className="text-[0.8125rem] text-muted">Their order · type it in</div>
            <OrderedBox jobId={jobId} tag={tag} have={c?.ordered} unit={(c?.unit === 'boxes' ? 'boxes' : t?.paper?.unit) || 'SF'} />
            {c && <div className="mt-1 text-[0.8125rem] text-muted">{[c.supplier, c.suppliedBy ? `for the ${c.suppliedBy}` : ''].filter(Boolean).join(' · ')}</div>}
          </div>
          <div className={cn('rounded-xl px-4 py-3', short ? 'bg-bad-50' : 'bg-[#eef6f1]')}>
            <div className="text-[0.8125rem] text-muted">Difference</div>
            <div className={cn('text-[1.25rem] font-bold tnum', short ? 'text-bad-600' : 'text-[#2c8a5b]')} data-qty-gap>{!c ? '' : short ? `${short} ${unit} short` : gap > 0 ? `${gap} ${unit} under` : gap < 0 ? `${-gap} ${unit} to spare` : 'Exactly enough'}</div>
            <div className="text-[0.8125rem] text-muted">{!c ? 'Once their order is in' : short ? `About ${Math.ceil(short / (t?.boxSF || 30))} ${Math.ceil(short / (t?.boxSF || 30)) === 1 ? 'box' : 'boxes'}` : gap > 0 ? 'That’s rounding. The extra for cuts covers it.' : 'Covered, with the extra for cuts'}</div>
          </div>
        </section>
        {short > 0 && (
          <div className="flex flex-col gap-2.5">
            <OptionCard on={pick === 'askgc'} onClick={() => setPick('askgc')} icon={<Building2 className="h-5 w-5" />} title={`Ask the GC to add ${short} ${unit} to their order`} sub="They supply the tile. It waits on the GC and comes back Wednesday." />
            <OptionCard on={pick === 'order'} onClick={() => setPick('order')} icon={<Package className="h-5 w-5" />} title="We order the short tile ourselves" sub="A PO to the tile store from here. Billed back to the GC if agreed." />
            <OptionCard on={pick === 'accept'} onClick={() => setPick('accept')} icon={<CheckCircle2 className="h-5 w-5" />} title="Their number is right. Accept it" sub="Use it if our takeoff was high. It’s logged with your name." />
          </div>
        )}
      </div>
    </Modal>
  )
}

export function ReceiveModal({ matId, level }: { matId: string; level: number }) {
  const s = useStore()
  const m = s.mats.find((x) => x.id === matId)
  const [qty, setQty] = React.useState(2)
  const [cond, setCond] = React.useState('Good')
  if (!m) return null
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Receive"
      header={<JobHead jobId={m.jobId} kicker={`${m.po} · ${m.where}`} title={`Receive · ${m.name}`} right={<Pill tone="warn">4 of 6 here</Pill>} />}
      footer={
        <>
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" icon={<Truck className="h-[1.125rem] w-[1.125rem]" />} onClick={() => receiveMat(matId, qty, cond)}>Save receipt</Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="How many arrived?" hint="Receipts add up. Nothing is overwritten."><NumStepper value={qty} onChange={setQty} min={1} max={6} suffix="pieces" /></Field>
        <Field label="Condition">
          <div className="flex flex-wrap gap-2">
            {['Good', 'Damaged', 'Wrong item'].map((x) => <Chip key={x} on={cond === x} onClick={() => setCond(x)}>{x}</Chip>)}
          </div>
        </Field>
        <SlipPhoto jobId={m.jobId} />
      </div>
    </Modal>
  )
}

/** a photo of the packing slip goes onto the project's photos */
function SlipPhoto({ jobId }: { jobId: string }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [n, setN] = React.useState(0)
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) { setN((x) => x + l.length); void keepFiles(jobId, l, 'photo', { quiet: true }) } }} />
      <Button className="self-start" icon={n ? <Check className="h-4 w-4" /> : <Camera className="h-4 w-4" />} onClick={() => ref.current?.click()}>{n ? `${n} photo${n === 1 ? '' : 's'} of the packing slip added` : 'Add photo of the packing slip'}</Button>
    </>
  )
}

/** the tile came in — every tile still to come on the project, in one window: how many of each came (all of it, unless
 *  you change a number), one Save. Then each is checked against what its rooms need, and a tile that's short is said
 *  right away. Tapped from one tile, that one is first. */
export function ReceiveTileModal({ jobId, tag, level }: { jobId: string; tag?: string; level: number }) {
  const s = useStore()
  const all = s.checks.filter((x) => x.jobId === jobId && x.received < x.ordered)
  const list = tag ? [...all.filter((x) => x.tag === tag), ...all.filter((x) => x.tag !== tag)] : all
  const [n, setN] = React.useState<Record<string, string>>(() => Object.fromEntries(list.map((c) => [c.tag, String(c.ordered - c.received)])))
  if (!list.length) return null
  const counts = Object.fromEntries(list.map((c) => [c.tag, Math.max(0, Math.min(c.ordered - c.received, Number(n[c.tag]) || 0))]))
  const whole = list.every((c) => counts[c.tag] === c.ordered - c.received)
  const any = list.some((c) => counts[c.tag] > 0)
  const supplier = Array.from(new Set(list.map((c) => c.supplier))).join(' · ')
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="The tile came in"
      header={<JobHead jobId={jobId} kicker={supplier || 'Tile'} title="The tile came in" />}
      footer={
        <>
          <Button variant="ghost" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => s.swap({ t: 'problem', jobId })}>Broken, wrong or missing?</Button>
          <Button className="ml-auto" variant="primary" icon={<Truck className="h-[1.125rem] w-[1.125rem]" />} disabled={!any} onClick={() => receiveTiles(jobId, counts)} data-receive-save>{whole ? (list.length > 1 ? 'All of it came' : 'It all came') : 'Save what came'}</Button>
        </>
      }
    >
      <div className="text-[0.875rem] text-muted">Every tile still to come, all of it is filled in. Change a number if less came.</div>
      <div className="mt-3 overflow-hidden rounded-xl border border-line" data-receive-list>
        {list.map((c) => {
          const t = tileOf(jobId, c.tag)
          const left = c.ordered - c.received
          return (
            <div key={c.tag} className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0" data-receive-tile={c.tag}>
              {t ? <TileImg tile={t} size={36} radius={7} /> : <span className="h-9 w-9 shrink-0 rounded-[0.4375rem] bg-wash-2" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold text-ink">{c.tag}{t?.name ? <span className="font-normal text-ink-2"> {t.name}</span> : null}</span>
                <span className="block truncate text-[0.8125rem] text-muted">{c.where} · {c.received ? `${c.received} of ${c.ordered} here` : `${c.ordered} ${c.unit} ordered`}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <TextInput inputMode="numeric" value={n[c.tag] ?? ''} onChange={(e) => setN({ ...n, [c.tag]: e.target.value.replace(/[^\d]/g, '').slice(0, 5) })} aria-label={`${c.tag}. How much came`} className="h-9 w-[4.5rem] text-right tnum" data-receive-n={c.tag} />
                <span className="w-12 text-[0.8125rem] text-muted">{c.unit}</span>
              </span>
              {Number(n[c.tag] || 0) < left && <span className="sr-only">{left - Number(n[c.tag] || 0)} still to come</span>}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

export function VerifyModal({ taskId, level }: { taskId: string; level: number }) {
  const s = useStore()
  const t = s.tasks.find((x) => x.id === taskId)
  if (!t) return null
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Verify"
      header={<JobHead jobId={t.jobId} kicker={t.where || 'Punch item'} title={t.title} />}
      footer={
        <>
          <Button onClick={() => verifyPunch(taskId, false)}>Needs more work</Button>
          <Button className="ml-auto" variant="success" icon={<CheckCircle2 className="h-[1.125rem] w-[1.125rem]" />} onClick={() => verifyPunch(taskId, true)}>Verified</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 max-sm:gap-2">
        {['Before', 'After'].map((l, i) => (
          <div key={l} className="overflow-hidden rounded-2xl border border-line">
            <div className="relative h-[9.375rem] max-sm:h-[6.5rem]">
              <Swatch kind="blackhex" size={300} radius={0} className="!h-full !w-full" />
              {i === 0 && <span className="absolute inset-0 bg-[radial-gradient(circle_at_40%_45%,rgba(214,200,170,.75),transparent_55%)]" />}
            </div>
            <div className="px-3 py-2 text-[0.8125rem] font-semibold text-ink max-sm:px-2.5 max-sm:py-1.5">{l}<span className="font-normal text-muted"> · {i ? 'Philip, today' : shiftText('Yaakov, Sep 11')}</span></div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function RolesModal({ level }: { level: number }) {
  const s = useStore()
  const label = (r: string) => ROLES.find((x) => x.key === r)?.label.split(' · ')[0]
  const pages = (r: Role) => (s.access[r] || []).map((k) => ({ today: 'Today', estimates: 'Estimates', projects: 'Projects', upcoming: 'Schedule', pos: 'POs', pay: 'Installer pay', money: 'Billing', items: 'Items', clients: 'Clients', designers: 'Designers', subs: 'Installers', suppliers: 'Suppliers' } as Record<string, string>)[k]).filter(Boolean)
  const TYPES: Role[] = LOGIN_TYPES
  const count = (r: Role) => s.team.filter((m) => loginOf(m.role) === r && m.status !== 'off').length
  const what: Partial<Record<Role, string>> = { crew: 'An installer’s phone. Only his job: where to work, what not to start, his touch-ups', client: 'A GC or client. Their projects, photos, approvals, invoices, messages' }
  return (
    <Modal level={level} size="lg" onClose={s.close} title="See what each person sees" sub="Tap a person to see exactly their Today. Every task that lands on them. In the real app everyone signs in with their own email.">
      <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
        {TYPES.map((r) => {
          const on = s.role === r
          const people = s.team.filter((m) => loginOf(m.role) === r && m.status !== 'off')
          return (
            <div key={r} className={cn('overflow-hidden rounded-[0.75rem] border transition', on ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-line')}>
              <button onClick={() => (r === REAL.home ? backToMe() : people[0] ? signInAs(people[0].key) : s.setRole(r))} className="flex w-full items-start gap-3.5 p-3.5 text-left transition hover:bg-wash">
                <span className={cn('mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.5625rem]', on ? 'bg-brand-600 text-white' : 'bg-wash-2 text-ink-2')}>{r === 'crew' ? <Smartphone className="h-4 w-4" /> : r === 'client' ? <Building2 className="h-4 w-4" /> : r === 'owner' ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[0.90625rem] font-semibold text-ink">{r === 'owner' ? 'Admin' : r === 'crew' ? 'Installer (crew)' : r === 'client' ? 'GC / client' : label(r)}{r !== 'crew' && r !== 'client' && <span className="text-[0.75rem] font-medium text-muted">{count(r)} {count(r) === 1 ? 'person' : 'people'}</span>}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[0.78125rem] leading-snug text-muted">{what[r] || (r === 'owner' ? 'Everything, plus Settings. The team, logins and rules' : pages(r).join(' · '))}</span>
                </span>
                <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-faint" />
              </button>
              {people.length > 0 && r !== 'client' && (
                <div className="flex flex-wrap gap-1.5 border-t border-line-2 px-3.5 py-2.5">
                  {people.map((m) => (
                    <button key={m.key} data-person={m.key} onClick={() => signInAs(m.key)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border bg-white pl-1 pr-2.5 text-[0.78125rem] font-medium transition hover:border-brand-300 hover:text-brand-700', on && meOf(s.role) === m.key ? 'border-brand-500 text-brand-700' : 'border-line text-ink-2')}>
                      <Avatar who={m.key} size={22} />{PEOPLE[m.key]?.name || m.first}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
