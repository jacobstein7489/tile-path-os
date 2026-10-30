/* Short on tile — one record that walks itself through four steps, so everyone sees where it is:
 *   1 Found short   — the crew, the site manager or a short delivery reports it: which tile, how much, which surfaces
 *   2 Reordered     — whoever orders materials asks the GC / tile store (or orders it), with a delivery date
 *   3 On the way    — the date sits on the project and the Game plan; late turns red
 *   4 Back to work  — it's received, the surfaces open up, the crew gets a task
 * If the crew can't keep working on anything else, the project shows On hold until it lands. */
import * as React from 'react'
import { PackageX, Truck, PackageCheck, HardHat, Check, CalendarDays, PauseCircle } from 'lucide-react'
import { useStore, addHist, newTask, closeTasks, setIssues, NOW, meOf } from '@/tileos/store'
import { Button, Chip, Avatar, TextInput, Segmented } from '@/tileos/components/ui/core'
import { SearchSelect, MultiSelect } from '@/tileos/components/ui/select'
import { Modal, DatePresets } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import { tileOf } from '@/tileos/data/jobs'
import type { LogLine } from '@/tileos/data/work'
import type { Shortage } from '@/tileos/data/shortages'
export type { Shortage }
import { TileImg } from '@/tileos/components/ui/swatch'
import { matBy, matFor } from './flows'

const S = () => useStore.getState()
const nextId = (list: Shortage[]) => 'SH-' + (Math.max(0, ...list.map((x) => Number(x.id.slice(3)) || 0)) + 1)
const L = (who: PersonKey, text: string): LogLine => ({ date: NOW, who, text })

export function reportShortage(o: { jobId: string; tag: string; qty: number; unit: string; surfaces: { room: string; surface: string }[]; how: string; stops: boolean }) {
  const st0 = S()
  const id = nextId(st0.shortages)
  const me = meOf(st0.role)
  const who = matBy(st0)
  const job = st0.jobs[o.jobId]
  st0.commit(
    (s) => {
      s.shortages.unshift({ id, jobId: o.jobId, tag: o.tag, qty: o.qty, unit: o.unit, surfaces: o.surfaces, found: { who: me, date: NOW, how: o.how }, step: 'short', stops: o.stops, log: [L(me, `${o.how} — ${o.qty} ${o.unit} of ${o.tag} short`)] })
      o.surfaces.forEach((f) => {
        const x = s.rooms[o.jobId]?.find((r) => r.name === f.room)?.surfaces.find((y) => y.name === f.surface)
        if (x && x.state !== 'done') { x.state = 'waitmat'; x.reason = `Waiting for ${o.tag} · ${o.qty} ${o.unit} short` }
      })
      if (o.stops) s.jobs[o.jobId].hold = { reason: `Waiting for ${o.qty} ${o.unit} of ${o.tag}`, since: NOW, by: me, shortage: id }
      newTask(s, { jobId: o.jobId, title: `Reorder ${o.tag} · ${o.qty} ${o.unit} short`, detail: `${o.how}. ${o.surfaces.map((f) => `${f.room} ${f.surface.toLowerCase()}`).join(', ')} wait for it.`, type: 'Materials', owner: matBy(s), for: matFor(s), watch: ['owner', 'pm'], state: 'now', due: 'Today', dueTone: 'warn', tone: 'bad', blocks: o.surfaces.map((f) => `${f.room} ${f.surface.toLowerCase()}`).join(', '), where: `${o.tag} ${tileOf(o.jobId, o.tag)?.name || ''}`.trim(), action: { label: 'Reorder', kind: 'short:' + id } })
      setIssues(s, o.jobId, (iss) => [...iss, { tone: 'bad', text: `${o.tag} short · ${o.qty} ${o.unit}` }])
      addHist(s, o.jobId, { who: me, kind: 'material', title: `${o.tag} short · ${o.qty} ${o.unit}`, detail: `${o.how}. ${o.stops ? 'The crew can’t keep working — on hold.' : 'The crew keeps working elsewhere.'}` })
    },
    `${o.tag} is short — ${PEOPLE[who].short} reorders it`,
    { close: true, sub: o.stops ? `${job?.name} is on hold until it lands.` : 'The crew keeps working on the rest.', flow: [{ who: me, label: 'Found short', state: 'done' }, { who, label: 'Reorders', state: 'now' }, { label: 'Delivery', state: 'next' }, { who: (job?.crew as PersonKey) || 'yakov', label: 'Back to work', state: 'next' }] },
  )
  return id
}
export function reorderShortage(id: string, o: { by: 'GC' | 'Client' | 'Us'; from: string; eta: string }) {
  const st0 = S()
  const sh = st0.shortages.find((x) => x.id === id)
  if (!sh) return
  const me = meOf(st0.role)
  const job = st0.jobs[sh.jobId]
  st0.commit(
    (s) => {
      const x = s.shortages.find((y) => y.id === id)!
      x.step = 'reordered'
      x.orderedBy = o.by
      x.orderedFrom = o.from
      x.orderedOn = NOW
      x.eta = o.eta
      x.log.push(L(me, o.by === 'Us' ? `We ordered ${x.qty} ${x.unit} from ${o.from} · arrives ${o.eta}` : `${o.by === 'GC' ? 'The GC' : 'The client'} reordered from ${o.from} · arrives ${o.eta}`))
      s.tasks.filter((t) => t.action?.kind === 'short:' + id && t.state === 'now').forEach((t) => {
        t.state = 'waiting'
        t.waitingOn = o.from
        t.followUp = o.eta
        t.title = `${x.tag} reordered · arrives ${o.eta}`
        t.action = { label: 'It came in', kind: 'short:' + id }
        t.log.push(L(me, `Reordered from ${o.from}`))
      })
      if (s.jobs[sh.jobId].hold?.shortage === id) s.jobs[sh.jobId].hold!.reason = `Waiting for ${x.qty} ${x.unit} of ${x.tag} · arrives ${o.eta}`
      addHist(s, sh.jobId, { who: me, kind: 'material', title: `${x.tag} reordered · arrives ${o.eta}`, detail: `From ${o.from}${o.by !== 'Us' ? `, through the ${o.by === 'GC' ? 'GC' : 'client'}` : ''}` })
    },
    `Reordered — ${sh.tag} arrives ${o.eta}`,
    { close: true, sub: 'The date is on the project and the Schedule. If it slips, it turns red.', flow: [{ who: sh.found.who, label: 'Found short', state: 'done' }, { who: me, label: 'Reordered', state: 'done' }, { label: `Arrives ${o.eta.replace(/^\w+, /, '')}`, state: 'now' }, { who: (job?.crew as PersonKey) || 'yakov', label: 'Back to work', state: 'next' }] },
  )
}
export function receiveShortage(id: string, qty: number) {
  const st0 = S()
  const sh = st0.shortages.find((x) => x.id === id)
  if (!sh) return
  const me = meOf(st0.role)
  const job = st0.jobs[sh.jobId]
  const crew = (job?.crew as PersonKey) || (st0.bookings.find((b) => b.jobId === sh.jobId)?.crew as PersonKey) || 'yakov'
  const all = qty >= sh.qty
  st0.commit(
    (s) => {
      const x = s.shortages.find((y) => y.id === id)!
      if (all) { x.step = 'received'; x.receivedOn = NOW } else x.qty = x.qty - qty
      x.log.push(L(me, all ? `Received ${qty} ${x.unit} — all of it` : `Received ${qty} ${x.unit} · ${x.qty} still to come`))
      const c = s.checks.find((y) => y.jobId === sh.jobId && y.tag === sh.tag)
      if (c) c.received = Math.min(c.ordered, c.received + qty)
      if (all) {
        x.surfaces.forEach((f) => {
          const y = s.rooms[sh.jobId]?.find((r) => r.name === f.room)?.surfaces.find((z) => z.name === f.surface)
          if (y && y.state === 'waitmat') { y.state = 'ready'; y.reason = undefined }
        })
        if (s.jobs[sh.jobId].hold?.shortage === id) s.jobs[sh.jobId].hold = undefined
        closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'short:' + id || (t.jobId === sh.jobId && /basement wall tile|boxes of/i.test(t.title) && t.state === 'waiting')).map((t) => t.id), `${sh.tag} received`)
        setIssues(s, sh.jobId, (iss) => iss.filter((i) => !i.text.includes(sh.tag)))
        newTask(s, { jobId: sh.jobId, title: `${sh.tag} is on site — back to ${x.surfaces.map((f) => `${f.room} ${f.surface.toLowerCase()}`).join(', ')}`, type: 'Field', owner: crew, for: ['site'], watch: ['owner'], state: 'now', due: 'Tomorrow', tone: 'info', where: x.surfaces.map((f) => `${f.room} · ${f.surface}`).join(' · ') })
      }
      addHist(s, sh.jobId, { who: me, kind: 'material', title: all ? `${sh.tag} received · back to work` : `${sh.tag} · ${qty} ${sh.unit} received`, detail: all ? `${x.surfaces.map((f) => `${f.room} ${f.surface.toLowerCase()}`).join(', ')} open again` : `${x.qty} ${sh.unit} still to come` })
    },
    all ? `${sh.tag} is here — back to work` : `${qty} ${sh.unit} in — ${sh.qty - qty} still to come`,
    { close: true, sub: all ? `${job?.name} ${job?.hold ? 'is off hold. ' : ''}${PEOPLE[crew].short} has it on his list.` : undefined, flow: all ? [{ who: sh.found.who, label: 'Found short', state: 'done' }, { who: matBy(st0), label: 'Reordered', state: 'done' }, { who: me, label: 'Received', state: 'done' }, { who: crew, label: 'Back to work', state: 'now' }] : undefined },
  )
}

/* ================= the window: where the shortage is, and the one thing to do next ================= */
const STEPS = [
  { key: 'short', label: 'Found short', icon: PackageX },
  { key: 'reordered', label: 'Reordered', icon: Truck },
  { key: 'coming', label: 'Delivery', icon: CalendarDays },
  { key: 'received', label: 'Back to work', icon: HardHat },
] as const
export function shortTracker(sh: Shortage) {
  const at = sh.step === 'short' ? 0 : sh.step === 'reordered' ? 2 : 4
  return STEPS.map((st, i) => ({ ...st, state: (i < at ? 'done' : i === at ? 'now' : 'next') as 'done' | 'now' | 'next' }))
}

export function ShortageModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const sh = s.shortages.find((x) => x.id === id)
  const [by, setBy] = React.useState<'GC' | 'Client' | 'Us'>('GC')
  const [from, setFrom] = React.useState('Best Tile')
  const [eta, setEta] = React.useState('Fri')
  const [qty, setQty] = React.useState('')
  /* reordered some other way (the GC called the store): the quick way, without a PO */
  const [other, setOther] = React.useState(false)
  if (!sh) return null
  const job = s.jobs[sh.jobId]
  const tile = tileOf(sh.jobId, sh.tag)
  const steps = shortTracker(sh)
  const sub: Record<string, string> = {
    short: `${PEOPLE[sh.found.who]?.short} · ${sh.found.date}`,
    reordered: sh.orderedOn ? `${sh.orderedFrom} · ${sh.orderedOn}` : PEOPLE[matBy(s)].short,
    coming: sh.eta ? `Arrives ${sh.eta}` : 'Date to come',
    received: sh.receivedOn ? `Received ${sh.receivedOn}` : PEOPLE[(job?.crew as PersonKey) || 'yakov']?.short || '',
  }
  /* reorder it on a tile PO: the store gets it by email with a number to follow, and this closes when it's all here */
  const orderMore = () => s.swap({ t: 'moretile', jobId: sh.jobId, tags: [sh.tag], qty: { [sh.tag]: sh.qty }, shortId: sh.id })
  const footer =
    sh.step === 'short' && !other ? (
      <>
        <button type="button" onClick={() => setOther(true)} className="text-[0.8125rem] font-semibold text-muted hover:text-ink" data-ordered-other>Ordered another way?</button>
        <Button className="ml-auto" variant="primary" icon={<Truck />} onClick={orderMore} data-short-order>Order more tile</Button>
      </>
    ) : sh.step === 'short' ? (
      <>
        <span className="text-[0.84375rem] text-muted">Arrives</span>
        <DatePresets value={eta} onPick={setEta} presets={['Tomorrow', 'Thu', 'Fri', 'Next Mon']} />
        <Button className="ml-auto" variant="primary" icon={<Check />} onClick={() => reorderShortage(sh.id, { by, from, eta: eta })}>Reordered</Button>
      </>
    ) : sh.step === 'reordered' && sh.po && s.pos.some((p) => p.id === sh.po) ? (
      <>
        <span className="text-[0.84375rem] text-muted">On {sh.po} — check it in there when it comes.</span>
        <Button className="ml-auto" variant="primary" icon={<PackageCheck />} onClick={() => s.swap({ t: 'po', id: sh.po! })}>Open {sh.po}</Button>
      </>
    ) : sh.step === 'reordered' ? (
      <>
        <span className="text-[0.84375rem] text-muted">How many came?</span>
        <TextInput className="h-9 w-24" inputMode="numeric" placeholder={String(sh.qty)} value={qty} onChange={(e) => setQty(e.target.value)} />
        <span className="text-[0.84375rem] text-muted">{sh.unit}</span>
        <Button className="ml-auto" variant="primary" icon={<PackageCheck />} onClick={() => receiveShortage(sh.id, Number(qty) || sh.qty)}>It came in</Button>
      </>
    ) : <span className="text-[0.84375rem] text-muted">Closed {sh.receivedOn} — the crew is back on it.</span>
  return (
    <Modal level={level} size="lg" onClose={s.close} title={`${sh.tag} short · ${job?.name}`} sub={`${sh.qty} ${sh.unit}${tile ? ` of ${tile.name}` : ''} · ${sh.surfaces.map((f) => `${f.room} ${f.surface.toLowerCase()}`).join(', ')}`} footer={footer}>
      {job?.hold?.shortage === sh.id && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl bg-bad-50 px-4 py-3 text-[0.875rem] font-medium text-bad-700"><PauseCircle className="h-5 w-5" />{job.name} is on hold — the crew can’t keep working until it lands.</div>
      )}
      <ol className="flex items-start">
        {steps.map((st, i) => (
          <React.Fragment key={st.key}>
            {i > 0 && <span className={cn('mt-[1.3125rem] h-[0.1875rem] flex-1 rounded-full', steps[i - 1].state === 'done' ? 'bg-ok-500' : 'bg-line')} />}
            <li className="flex w-[6.5rem] shrink-0 flex-col items-center text-center max-sm:w-[4.625rem]">
              <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-full', st.state === 'done' ? 'bg-ok-500 text-white' : st.state === 'now' ? 'bg-white text-brand-600 ring-[0.1875rem] ring-brand-600 shadow-[0_0_0_0.375rem_rgba(38,80,207,.12)]' : 'bg-wash-2 text-faint')}>
                {st.state === 'done' ? <Check className="h-5 w-5" strokeWidth={3} /> : <st.icon className="h-5 w-5" />}
              </span>
              <span className={cn('mt-2 text-[0.84375rem] font-bold', st.state === 'now' ? 'text-brand-700' : st.state === 'done' ? 'text-ink' : 'text-muted')}>{st.label}</span>
              <span className="text-[0.75rem] leading-snug text-muted">{sub[st.key]}</span>
            </li>
          </React.Fragment>
        ))}
      </ol>
      {sh.step === 'short' && !other && (
        <div className="mt-6 rounded-2xl border border-line bg-wash px-4 py-3 text-[0.875rem] text-ink-2">
          <b className="font-semibold text-ink">Order more tile</b> sends the store a tile PO for the {sh.qty} {sh.unit} — with a number to follow, same as any PO. When it’s all here, this closes and the crew gets the walls and floors back.
        </div>
      )}
      {sh.step === 'short' && other && (
        <div className="mt-6 rounded-2xl border border-line p-4">
          <div className="text-[0.8125rem] font-semibold text-muted">Who orders it</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['GC', 'Client', 'Us'] as const).map((b) => <Chip key={b} on={by === b} onClick={() => setBy(b)} className="h-9">{b === 'GC' ? 'The GC (their tile store)' : b === 'Client' ? 'The client' : 'We order it'}</Chip>)}
          </div>
          <div className="mt-3 text-[0.8125rem] font-semibold text-muted">From</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {['Best Tile', 'The designer’s showroom', 'Other store'].map((f) => <Chip key={f} on={from === f} onClick={() => setFrom(f)} className="h-9">{f}</Chip>)}
          </div>
        </div>
      )}
      <div className="mt-6 grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl bg-wash px-4 py-3">
        {tile && <TileImg tile={tile} size={44} />}
        <div className="min-w-0">
          <div className="truncate text-[0.90625rem] font-semibold text-ink">{sh.tag} {tile?.name} {tile?.size ? `· ${tile.size}` : ''}</div>
          <div className="truncate text-[0.8125rem] text-muted">{sh.found.how}</div>
        </div>
      </div>
      <div className="mb-1 mt-5 text-[0.8125rem] font-medium text-muted">What happened</div>
      <div className="flex flex-col">
        {[...sh.log].reverse().map((l, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-line-2 py-2 last:border-0">
            <Avatar who={l.who} size={26} />
            <span className="min-w-0 flex-1 text-[0.84375rem] text-ink">{l.text}</span>
            <span className="shrink-0 text-[0.78125rem] text-muted">{l.date}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

/* ================= report it: which tile, how much, which surfaces, can the crew keep going ================= */
export function ReportShortModal({ jobId, room, surface, level }: { jobId: string; room?: string; surface?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const rooms = s.rooms[jobId] || []
  const tags = Array.from(new Set(rooms.flatMap((r) => r.surfaces.map((x) => x.tile)).filter(Boolean)))
  const first = rooms.find((r) => r.name === room)?.surfaces.find((x) => x.name === surface)?.tile || tags[0] || ''
  const [tag, setTag] = React.useState(first)
  const [qty, setQty] = React.useState('')
  const [unit, setUnit] = React.useState(s.checks.find((c) => c.jobId === jobId && c.tag === first)?.unit || 'SF')
  const [how, setHow] = React.useState('Ran out on site')
  const [stops, setStops] = React.useState<boolean | null>(null)
  const surf = rooms.flatMap((r) => r.surfaces.filter((x) => x.tile === tag && x.state !== 'done').map((x) => ({ room: r.name, surface: x.name })))
  const [pick, setPick] = React.useState<string[]>(room && surface ? [`${room}|${surface}`] : [])
  if (!job) return null
  const chosen = surf.filter((f) => pick.includes(`${f.room}|${f.surface}`))
  const ok = tag && Number(qty) > 0 && chosen.length && stops !== null
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={`Short on tile · ${job.name}`}
      sub="It goes straight to whoever orders materials, with the surfaces that wait for it."
      footer={<Button className="ml-auto" variant="primary" disabled={!ok} icon={<PackageX />} onClick={() => reportShortage({ jobId, tag, qty: Number(qty), unit, surfaces: chosen, how, stops: !!stops })}>Report it</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 max-sm:grid-cols-1">
          <div>
            <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">Which tile</div>
            <SearchSelect label="Which tile" value={tag} onChange={(t) => { setTag(t); setPick([]); setUnit(s.checks.find((c) => c.jobId === jobId && c.tag === t)?.unit || 'SF') }} options={tags.map((t) => ({ key: t, label: `${t} · ${tileOf(jobId, t)?.name || ''}`, hint: tileOf(jobId, t)?.size, lead: <TileImg tile={tileOf(jobId, t)} size={24} radius={5} /> }))} placeholder="Pick the tile" search={false} width={340} />
          </div>
          <div>
            <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">How much is missing</div>
            <div className="flex items-center gap-2">
              <TextInput className="h-10 w-24" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" data-autofocus />
              <Segmented value={unit} onChange={setUnit} items={[{ key: 'SF', label: 'SF' }, { key: 'boxes', label: 'boxes' }]} />
            </div>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">Which surfaces wait for it</div>
          <MultiSelect label="Which surfaces wait for it" values={pick} onChange={setPick} options={surf.map((f) => ({ key: `${f.room}|${f.surface}`, label: `${f.room} · ${f.surface}` }))} placeholder={surf.length ? 'Pick the walls and floors' : 'No open surfaces with this tile'} />
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div>
            <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">How we found out</div>
            <SearchSelect label="How we found out" value={how} onChange={setHow} options={['Ran out on site', 'Delivery came short', 'Damaged boxes', 'Counted at the site check'].map((h) => ({ key: h, label: h }))} search={false} width={300} />
          </div>
          <div>
            <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">Can the crew keep working?</div>
            <SearchSelect label="Can the crew keep working" value={stops === null ? '' : stops ? 'stop' : 'go'} onChange={(k) => setStops(k === 'stop')} options={[{ key: 'go', label: 'Yes — they keep going on other things' }, { key: 'stop', label: 'No — put the project on hold' }]} placeholder="Pick one" search={false} width={320} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
