/* Purchase orders — every PO we send: materials to suppliers and work to our installers.
 * Each line carries the item and what we pay for it, so the Items page knows our prices by vendor. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { SearchSelect } from '@/tileos/components/ui/select'
import { Mail, Plus, Send, Truck, Check, Trash2, FilePen, Hourglass, AlarmClock, PackageCheck, Layers, Package, HardHat, Building2, ArrowLeft, MapPin, CalendarCheck, Calculator } from 'lucide-react'
import { useStore, meOf, addHist, NOW } from '@/tileos/store'
import { Button, Avatar, TextInput, Field, Chip } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop, DatePresets } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Table, Th, Tr, Td, EmptyRow, Status, Path, Bubbles, Row, Col, Meta, IconTile, EmptyState } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, fmtMoney, type PersonKey, type Tone } from '@/tileos/data/model'
import { PO_STEPS, type PO, type POLine } from '@/tileos/data/work'
import type { IPO, IPOLine } from '@/tileos/data/field'
import { ipoTotal, poRatio, type Ratio } from './poratio'
import { RatioMeter } from './stepwin'
import { allSubs } from '@/tileos/data/directory'
import { confirmPO, receivePO, followUpPO, poNext, createPO, matBy } from './flows'
import { mailLive, emailPO, emailIPO } from './mailout'
import { sendDraftIPO, answerIPO, pickInstaller, materialsFromEstimate, bookInstaller, draftIPOLines, setIPOLines } from './flows2'
import { takeoff, qtyLabel, methodOf } from './takeoff'
import { METHODS } from '@/tileos/data/takeoff'
import { crewFree } from './upcoming'
import { ActivityRow } from './activity'
import { ItemPicker } from './estimates'
import { allowedFor } from './newpicker'
import { ItemThumb } from './items'
import { FormHead, FormRow, ProjectField, DAY_OPTIONS, byDay } from './formkit'
import { CalcHow } from './calc'
import { PAY_WEEKS, PAY_STATE, PAID_EARLIER, payRow } from './pay'
import { shiftText, TODAY } from '@/tileos/lib/today'

type Row = { kind: 'material'; po: PO } | { kind: 'installer'; po: IPO }
const matStatus = (p: PO): { tone: Tone; label: string; open: boolean } =>
  /cancelled/i.test(p.note) ? { tone: 'neutral', label: 'Cancelled', open: false }
  : p.late ? { tone: 'bad', label: `Late · ${p.eta}`, open: true }
  : { tone: p.step >= 3 ? 'ok' : p.step === 2 ? 'info' : 'warn', label: p.step === 3 ? 'Received' : PO_STEPS[p.step], open: p.step < 3 }
/** which bubble a PO sits in */
type POBucket = 'draft' | 'waiting' | 'coming' | 'late' | 'done'
const bucketOfPO = (r: { kind: 'material'; po: PO } | { kind: 'installer'; po: IPO }): POBucket => {
  if (r.kind === 'installer') return r.po.status === 'Draft' ? 'draft' : r.po.status === 'Sent' ? 'waiting' : 'done'
  if (/cancelled/i.test(r.po.note)) return 'done'
  if (r.po.late) return 'late'
  return r.po.step >= 3 ? 'done' : r.po.step === 1 ? 'waiting' : r.po.step === 2 ? 'coming' : 'draft'
}
const ipoStatus = (p: IPO): { tone: Tone; label: string; open: boolean } =>
  p.status === 'Draft' ? { tone: 'warn', label: 'Draft — approve and send', open: true }
  : p.status === 'Sent' ? { tone: 'warn', label: `Waiting for ${PEOPLE[p.crew].short}`, open: true }
  : p.status === 'Rejected' ? { tone: 'bad', label: 'Turned down', open: false }
  : { tone: 'ok', label: 'Accepted', open: false }

export function POsPage() {
  const s = useStore()
  const [tab, setTab] = React.useState<'open' | 'all' | 'calc' | POBucket>(s.route.q?.view === 'calc' ? 'calc' : 'open')
  const [type, setType] = React.useState('all')
  const [vendor, setVendor] = React.useState('all')
  const [job, setJob] = React.useState('all')
  const [q, setQ] = React.useState('')
  const rows: Row[] = [...s.pos.map((po) => ({ kind: 'material' as const, po })), ...s.ipos.map((po) => ({ kind: 'installer' as const, po }))]
  const vendorOf = (r: Row) => (r.kind === 'material' ? r.po.supplier : PEOPLE[r.po.crew].name)
  const st = (r: Row) => (r.kind === 'material' ? matStatus(r.po) : ipoStatus(r.po))
  const scoped = rows.filter((r) => (type === 'all' || r.kind === type) && (vendor === 'all' || vendorOf(r) === vendor) && (job === 'all' || r.po.jobId === job) && (!q || `${r.po.id} ${vendorOf(r)} ${s.jobs[r.po.jobId]?.name}`.toLowerCase().includes(q.toLowerCase())))
  const list = scoped.filter((r) => tab === 'all' || (tab === 'open' ? bucketOfPO(r) !== 'done' : bucketOfPO(r) === tab))
  const nB = (b: POBucket) => scoped.filter((r) => bucketOfPO(r) === b).length
  const pick = (b: POBucket | 'calc') => () => setTab(tab === b ? 'open' : b)
  /* what each project still needs, worked out from its scope — waiting for someone to send the PO */
  const calc = Object.values(s.jobs)
    .filter((j) => !['request', 'estimating', 'proposal', 'followup', 'closeout', 'complete'].includes(j.stage) && (job === 'all' || j.id === job))
    .map((j) => {
      const t = takeoff(s, j.id)
      const miss = t.lines.filter((l) => l.toOrder > 0)
      const total = miss.reduce((n, l) => n + l.toOrder * (s.items.find((i) => i.id === l.itemId)?.cost || 0), 0)
      return { j, t, miss, total }
    })
    .filter((x) => x.miss.length)
  const calcTotal = calc.reduce((n, x) => n + x.total, 0)
  const vendors = Array.from(new Set(rows.map(vendorOf)))
  const jobs = Array.from(new Set(rows.map((r) => r.po.jobId))).filter((id) => s.jobs[id])
  const out = list.reduce((n, r) => n + (r.kind === 'material' ? r.po.amount : ipoTotal(r.po)), 0)
  return (
    <Page
      title="Purchase orders"
      sub={tab === 'calc' ? `${fmtMoney(calcTotal)} to order` : undefined}
      actions={<Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newpo' })}>New PO</Button>}
      top={
        <Bubbles
          arrows
          items={[
            { key: 'calc', label: 'To order', count: calc.length, sub: calcTotal ? fmtMoney(calcTotal) : undefined, icon: <Calculator />, color: 'cyan', on: tab === 'calc', onClick: pick('calc') },
            { key: 'draft', label: 'Draft', count: nB('draft'), icon: <FilePen />, color: 'violet', on: tab === 'draft', onClick: pick('draft') },
            { key: 'waiting', label: 'Sent', count: nB('waiting'), icon: <Hourglass />, color: 'amber', on: tab === 'waiting', onClick: pick('waiting') },
            { key: 'coming', label: 'Confirmed', count: nB('coming'), icon: <Truck />, color: 'blue', on: tab === 'coming', onClick: pick('coming') },
            { key: 'done', label: 'Received', count: nB('done'), icon: <PackageCheck />, color: 'green', on: tab === 'done', onClick: pick('done') },
            { key: 'late', label: 'Late', count: nB('late'), icon: <AlarmClock />, color: 'red', on: tab === 'late', onClick: pick('late'), gapBefore: true },
          ]}
        />
      }
      toolbar={
        <>
          <span className="bar-title mr-2 text-[0.9375rem] font-semibold text-ink">{{ open: 'Open POs', all: 'All POs', calc: 'To order — worked out from each scope', draft: 'Draft', waiting: 'Sent — waiting to confirm', coming: 'Confirmed — on the way', late: 'Late', done: 'Received' }[tab]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{tab === 'calc' ? calc.length : list.length}</span></span>
          <Filter icon={<Layers />} label="Type" value={type} options={[{ key: 'material', label: 'Materials · suppliers' }, { key: 'installer', label: 'Installers · subs' }]} onChange={setType} />
          <Filter icon={<Package />} label="Vendor" value={vendor} options={vendors.map((v) => ({ key: v, label: v }))} onChange={setVendor} />
          <Filter icon={<Building2 />} label="Project" value={job} options={jobs.map((id) => ({ key: id, label: s.jobs[id].name }))} onChange={setJob} width={260} />
          <ClearFilters show={type !== 'all' || vendor !== 'all' || job !== 'all' || !!q} onClear={() => { setType('all'); setVendor('all'); setJob('all'); setQ('') }} />
          <ToolbarSearch value={q} onChange={setQ} placeholder="Search POs" />
        </>
      }
    >
      {tab === 'calc' ? (
        <div>
          {calc.map(({ j, t, miss, total }) => (
            <Row
              key={j.id}
              onClick={() => s.open({ t: 'newpo', jobId: j.id, fromTakeoff: true })}
              lead={<IconTile icon={<Calculator />} tone="info" />}
              title={j.name}
              meta={<><Meta icon={<Building2 />} className="shrink-0">{j.client}</Meta><Meta>{miss.length} materials from {t.sf.toLocaleString('en-US')} SF of scope</Meta></>}
            >
              <Col w={230} className="max-lg:hidden">
                <span className="flex items-center -space-x-2">{miss.slice(0, 6).map((l) => <span key={l.itemId} className="rounded-xl bg-white ring-2 ring-white"><ItemThumb item={s.items.find((i) => i.id === l.itemId)} size={36} /></span>)}</span>
              </Col>
              <Col w={110} right className="max-md:hidden"><span className="text-[0.90625rem] font-bold tnum text-ink">{fmtMoney(total)}</span></Col>
              <Col w={140} className="max-xl:hidden"><span className="inline-flex items-center gap-2 text-[0.8125rem] text-ink-2"><Avatar who={matBy(s)} size={22} />{PEOPLE[matBy(s)].short} orders</span></Col>
              <Col w={150} right className="max-md:hidden"><Button size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); s.open({ t: 'newpo', jobId: j.id, fromTakeoff: true }) }}>Review and send</Button></Col>
            </Row>
          ))}
          {!calc.length && <EmptyState icon={<Calculator />} title="Everything worked out is ordered" sub="When a project’s scope or underlayment changes, what it needs shows up here." />}
        </div>
      ) : (
      <Table minWidth={860}>
        <thead>
          <tr>
            <Th>PO</Th>
            <Th w={190} className="max-md:hidden">Vendor</Th>
            <Th w={190} className="max-lg:hidden">Project</Th>
            <Th w={120} right className="max-md:hidden">Amount</Th>
            <Th w={210} className="max-md:hidden">Status</Th>
            <Th w={110} className="max-xl:hidden">Date</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => {
            const x = st(r)
            const amount = r.kind === 'material' ? r.po.amount : ipoTotal(r.po)
            return (
              <Tr key={r.po.id} onClick={() => s.open({ t: r.kind === 'material' ? 'po' : 'ipo', id: r.po.id })}>
                <Td>
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-[0.8125rem] tnum text-muted">{r.po.id}</span>
                    <span className="truncate text-[0.875rem] font-medium text-ink">{r.kind === 'material' ? r.po.what : 'Installation'}</span>
                  </div>
                  <div className="truncate text-[0.78125rem] text-muted">{r.kind === 'material' ? 'Materials' : 'Installer PO'}<span className="md:hidden"> · {vendorOf(r)} · {fmtMoney(amount)}</span></div>
                </Td>
                <Td className="max-md:hidden">
                  {r.kind === 'installer' ? <span className="inline-flex items-center gap-2 text-[0.84375rem]"><Avatar who={r.po.crew} size={20} />{PEOPLE[r.po.crew].name}</span> : <span className="text-[0.84375rem]">{r.po.supplier}</span>}
                </Td>
                <Td className="truncate text-[0.84375rem] max-lg:hidden">{s.jobs[r.po.jobId]?.name}</Td>
                <Td right className="tnum text-ink max-md:hidden">
                  {fmtMoney(amount)}
                  {r.kind === 'installer' && (() => { const ra = poRatio(s, r.po); return ra.sold && ra.total ? <div className={cn('text-[0.75rem] font-semibold', ra.over ? 'text-bad-600' : 'text-muted')}>{ra.pct}% of estimate</div> : null })()}
                </Td>
                <Td className="max-md:hidden"><Status tone={x.tone}>{x.label}</Status></Td>
                <Td className="text-[0.84375rem] text-muted max-xl:hidden">{r.kind === 'material' ? r.po.date || r.po.log[0]?.date : r.po.date}</Td>
              </Tr>
            )
          })}
          {!list.length && <EmptyRow colSpan={6} title="No POs here" sub="Try another filter." />}
        </tbody>
      </Table>
      )}
    </Page>
  )
}

/* ================= a material PO ================= */
/** "16 bags", "2 rolls", "40 SF" — a quantity said the way the supplier reads it */
const qtyText = (n: number, unit?: string) => (!unit ? String(n) : /^(SF|LF|EA|SY|gal|lb|pc)$/i.test(unit) || n === 1 ? `${n} ${unit}` : `${n} ${unit.endsWith('s') ? unit : unit + 's'}`)
/** change a PO that's already out: the new lines go to the supplier, who confirms it again */
function changePO(id: string, lines: POLine[]) {
  const s = useStore.getState()
  s.commit((st) => {
    const p = st.pos.find((x) => x.id === id)
    if (!p) return
    const before = p.amount
    p.lines = lines.map((l) => ({ ...l, qty: l.n != null ? qtyText(l.n, st.items.find((i) => i.id === l.itemId)?.unit) : l.qty }))
    p.amount = Math.round(p.lines.reduce((n, l) => n + (l.price || 0) * (l.n || 0), 0) * 100) / 100
    if (p.step === 2) p.step = 1
    p.late = false
    p.note = `Changed ${NOW} · waiting for ${p.supplier} to confirm`
    const me = meOf(st.role)
    p.log.push({ date: NOW, who: me, text: `Changed — ${fmtMoney(before)} → ${fmtMoney(p.amount)} · sent to ${p.supplier}` })
    addHist(st, p.jobId, { who: me, kind: 'material', title: `${p.id} changed — sent to ${p.supplier}`, detail: p.lines.map((l) => `${l.item} ${l.qty}`).join(' · '), ref: { t: 'po', id: p.id } })
  }, 'PO changed', { sub: 'The change went to the supplier — it waits for them to confirm again.' })
  if (mailLive()) void emailPO(id, { changed: true })
}

export function MaterialPOModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const p = s.pos.find((x) => x.id === id)
  const [eta, setEta] = React.useState('Thu')
  const [said, setSaid] = React.useState('')
  const [back, setBack] = React.useState('Tomorrow')
  const [fu, setFu] = React.useState(false)
  /* changing it after it went out: the lines are worked on here, then the change goes to the supplier */
  const [edit, setEdit] = React.useState<POLine[] | null>(null)
  if (!p) return null
  const canChange = (p.step === 1 || p.step === 2) && allowedFor(s.role, 'po')
  const editTotal = edit ? edit.reduce((n, l) => n + (l.price || 0) * (l.n || 0), 0) : 0
  const job = s.jobs[p.jobId]
  const cancelled = /cancelled/i.test(p.note)
  const steps = ['Sent', 'Confirmed', 'Delivered', 'Bill in', 'Paid'].map((label, i) => {
    const at = p.step - 1
    return { key: label, label, state: (cancelled ? 'future' : i < at ? 'done' : i === at ? (p.late && i === 1 ? 'blocked' : 'current') : 'future') as any, sub: i === 1 && p.step <= 2 ? p.eta : undefined }
  })
  const header = (
    <div className="border-b border-line px-6 pb-5 pt-5 pr-16 max-sm:px-4">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-2">
        <div className="min-w-0">
          <div className="text-[0.8125rem] text-muted">Purchase order · materials</div>
          <h2 className="h-display mt-0.5 text-[1.5rem] font-semibold leading-tight text-ink">{p.id} · {p.supplier}</h2>
          <div className="mt-1 text-[0.875rem] text-muted">
            <button onClick={() => s.open({ t: 'job', id: p.jobId, tab: 'materials' })} className="text-ink-2 hover:text-brand-700">{job?.name}</button> · {p.what}
          </div>
        </div>
        <div className="shrink-0 text-right max-md:text-left">
          <div className="text-[1.5rem] font-semibold tnum text-ink">{fmtMoney(p.amount)}</div>
          <div className={cn('text-[0.8125rem]', p.late ? 'font-medium text-bad-700' : 'text-muted')}>{p.eta}</div>
          {p.step >= 1 && !mailLive() && <button onClick={() => s.open({ t: 'email', what: { kind: 'po', poId: p.id } })} className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-600 hover:underline"><Mail className="h-3.5 w-3.5" />The email {p.supplier} got</button>}
          {p.step >= 1 && !cancelled && mailLive() && <MailedLine mailed={p.mailed} who={p.supplier} onSend={() => emailPO(p.id)} />}
        </div>
      </div>
      {cancelled ? <div className="mt-4 rounded-lg bg-wash-2 px-4 py-3 text-[0.875rem] text-ink-2">{p.note}</div> : <Path className="mt-4" steps={steps} />}
    </div>
  )
  const footer = cancelled ? <span className="text-[0.84375rem] text-muted">Replaced — kept for the record.</span> : edit ? (
    <>
      <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
      <span className="ml-auto text-[0.84375rem] text-muted">{fmtMoney(p.amount)} → <b className="font-semibold text-ink">{fmtMoney(editTotal)}</b></span>
      <Button variant="primary" icon={<Send />} disabled={!edit.length} onClick={() => { changePO(p.id, edit); setEdit(null) }}>Send the change to {p.supplier}</Button>
    </>
  ) : (
    <>
      {canChange && <Button variant="ghost" icon={<FilePen />} onClick={() => setEdit(p.lines.map((l) => ({ ...l, n: l.n ?? (Number(String(l.qty).match(/\d+/)?.[0]) || 1) })))}>Change it</Button>}
      {p.step === 1 && (
        <>
          <span className="text-[0.84375rem] text-muted">They confirmed — arriving</span>
          <DatePresets value={eta} onPick={setEta} presets={['Tomorrow', 'Thu', 'Fri']} />
          <Button className="ml-auto" variant="primary" icon={<Check />} onClick={() => confirmPO(p.id, eta)}>Mark confirmed</Button>
        </>
      )}
      {p.step === 2 && (
        <>
          {p.late && (
            <Pop open={fu} onOpenChange={setFu} side="top" width={340} trigger={<Button>Log a follow-up</Button>}>
              <div className="text-[0.875rem] font-medium text-ink">What did {p.supplier} say?</div>
              <TextInput className="mt-2" value={said} onChange={(e) => setSaid(e.target.value)} placeholder="e.g. Ships Thursday" />
              <div className="mt-2.5"><DatePresets value={back} onPick={setBack} presets={['Tomorrow', 'Thu', 'Fri']} /></div>
              <div className="mt-3 flex justify-end"><Button size="sm" variant="primary" disabled={!said.trim()} onClick={() => { followUpPO(p.id, said.trim(), back); setSaid(''); setFu(false) }}>Save — back {back}</Button></div>
            </Pop>
          )}
          <Button className="ml-auto" variant="primary" icon={<Truck />} onClick={() => receivePO(p.id)}>Received — all here</Button>
        </>
      )}
      {p.step === 3 && <Button className="ml-auto" variant="primary" onClick={() => poNext(p.id)}>Supplier bill received</Button>}
      {p.step === 4 && <Button className="ml-auto" variant="primary" onClick={() => poNext(p.id)}>Mark paid</Button>}
      {p.step >= 5 && <span className="text-[0.84375rem] text-ok-700">Paid.</span>}
    </>
  )
  return (
    <Modal level={level} size="lg" onClose={s.close} header={header} footer={footer} title={p.id} bodyClass="px-6 py-5 max-sm:px-4">
      {edit ? <POLinesEdit lines={edit} onChange={setEdit} /> : <POLines lines={p.lines} total={p.amount} />}
      <div className="mt-3 flex items-center gap-2 text-[0.84375rem] text-muted"><Truck className="h-4 w-4" />Deliver to {job?.address}</div>
      <div className="mt-6 text-[0.8125rem] font-medium text-muted">Activity</div>
      <div className="-mx-2 mt-1">{[...p.log].reverse().map((l, i) => <ActivityRow key={i} compact jobId={p.jobId} e={{ date: l.date, who: l.who, kind: 'material', title: l.text, ref: { t: 'po', id: p.id } }} />)}</div>
    </Modal>
  )
}

/** the lines, while you change them: how many, the price, take one off, add an item */
function POLinesEdit({ lines, onChange }: { lines: POLine[]; onChange: (ls: POLine[]) => void }) {
  const s = useStore()
  const set = (i: number, patch: Partial<POLine>) => onChange(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const num = (v: string) => Math.max(0, Number(v.replace(/[^0-9.]/g, '')) || 0)
  return (
    <div>
      <div className="mb-2 text-[0.8125rem] text-muted">Change how many, the price, take a line off or add one — the change goes to the supplier.</div>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_6.5rem_6.5rem_2rem] gap-2 border-b border-line pb-2 text-[0.78125rem] font-medium text-muted max-sm:grid-cols-[minmax(0,1fr)_5rem_2rem]">
        <span>Item</span><span className="text-right">How many</span><span className="text-right max-sm:hidden">Price</span><span className="text-right max-sm:hidden">Amount</span><span />
      </div>
      {lines.map((l, i) => {
        const it = s.items.find((x) => x.id === l.itemId)
        return (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem_6.5rem_6.5rem_2rem] items-center gap-2 border-b border-line-2 py-2 text-[0.875rem] max-sm:grid-cols-[minmax(0,1fr)_5rem_2rem]">
            <span className="flex min-w-0 items-center gap-2.5">{it && <ItemThumb item={it} size={30} />}<span className="truncate text-ink">{l.item}</span></span>
            <input aria-label={`How many ${l.item}`} inputMode="decimal" value={l.n ?? ''} onChange={(e) => set(i, { n: num(e.target.value) })} className="h-9 w-full rounded-[0.5rem] border border-line bg-white px-2 text-right text-[0.875rem] tnum focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50" />
            <input aria-label={`Price of ${l.item}`} inputMode="decimal" value={l.price ?? ''} onChange={(e) => set(i, { price: num(e.target.value) })} className="h-9 w-full rounded-[0.5rem] border border-line bg-white px-2 text-right text-[0.875rem] tnum focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50 max-sm:hidden" />
            <span className="text-right tnum text-ink max-sm:hidden">{fmtMoney((l.price || 0) * (l.n || 0))}</span>
            <button aria-label={`Take ${l.item} off`} onClick={() => onChange(lines.filter((_, k) => k !== i))} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-bad-50 hover:text-bad-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        )
      })}
      <div className="mt-2"><ItemPicker types={['material']} label="Add an item" onPick={(it) => onChange([...lines, { item: it.name, itemId: it.id, n: 1, price: it.cost, qty: `1 ${it.unit}` }])} /></div>
    </div>
  )
}

function POLines({ lines, total }: { lines: POLine[]; total: number }) {
  const s = useStore()
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_6.875rem_6.25rem_6.875rem] border-b border-line pb-2 text-[0.78125rem] font-medium text-muted max-sm:grid-cols-[minmax(0,1fr)_6rem]">
        <span>Item</span><span className="text-right">Qty</span><span className="text-right max-sm:hidden">Price</span><span className="text-right max-sm:hidden">Amount</span>
      </div>
      {lines.map((l, i) => {
        const it = s.items.find((x) => x.id === l.itemId)
        return (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_6.875rem_6.25rem_6.875rem] items-center border-b border-line-2 py-2.5 text-[0.875rem] max-sm:grid-cols-[minmax(0,1fr)_6rem]">
            <span className="min-w-0">
              <span className="block truncate text-ink">{l.item}</span>
              {/* which QuickBooks item it books to — only accounting needs to see that */}
              {it && s.role === 'accounting' && <span className="block truncate text-[0.75rem] text-muted">QuickBooks · {it.qb}</span>}
            </span>
            <span className="text-right tnum text-ink-2">{l.qty}</span>
            <span className="text-right tnum text-ink-2 max-sm:hidden">{l.price ? fmtMoney(l.price, { cents: l.price % 1 !== 0 }) : '—'}</span>
            <span className="text-right tnum text-ink max-sm:hidden">{l.price && l.n ? fmtMoney(l.price * l.n) : '—'}</span>
          </div>
        )
      })}
      <div className="flex justify-end gap-6 pt-3 text-[0.9375rem] font-semibold text-ink"><span>Total</span><span className="tnum">{fmtMoney(total)}</span></div>
    </div>
  )
}

/* ================= an installer PO ================= */
/* ================= book the installer: pick him, look over his PO, send it ================= */
export function BookInstallerModal({ jobId, crew: first, level }: { jobId: string; crew?: PersonKey; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const [crew, setCrew] = React.useState<PersonKey | undefined>(first)
  const [step, setStep] = React.useState<1 | 2>(first ? 2 : 1)
  const [note, setNote] = React.useState('')
  if (!job) return null
  const free = crewFree(s)
  const lines = draftIPOLines(s, jobId)
  const total = lines.reduce((n, l) => n + l.amount, 0)
  const send = (go: boolean) => {
    if (!crew) return
    const id = bookInstaller(jobId, crew, { send: go, note: note.trim() || undefined })
    if (id) s.close()
  }
  const header = (
    <div className="border-b border-line px-7 pb-5 pt-6 pr-16 max-sm:px-4">
      <div className="text-[0.8125rem] font-medium text-muted">{job.name} · {job.client}</div>
      <h2 className="mt-0.5 text-[1.375rem] font-bold tracking-[-0.02em] text-ink">Book the installer</h2>
      <div className="mt-4 flex items-center gap-2">
        {[{ n: 1, label: 'Pick the installer' }, { n: 2, label: 'Check his PO and send it' }].map((x, i) => (
          <React.Fragment key={x.n}>
            {i > 0 && <span className={cn('h-[0.125rem] w-10 rounded-full', step > 1 ? 'bg-ok-500' : 'bg-line')} />}
            <button onClick={() => (x.n === 1 || crew) && setStep(x.n as 1 | 2)} className="inline-flex items-center gap-2 text-[0.84375rem] font-semibold">
              <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-[0.78125rem] font-bold', step > x.n ? 'bg-ok-500 text-white' : step === x.n ? 'bg-brand-600 text-white' : 'bg-wash-2 text-muted')}>{step > x.n ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : x.n}</span>
              <span className={step === x.n ? 'text-ink' : 'text-muted'}>{x.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
  const footer = step === 1 ? (
    <span className="text-[0.84375rem] text-muted">His PO is made from the project’s rooms and square feet — you’ll see it before it goes.</span>
  ) : (
    <>
      <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setStep(1)}>Back</Button>
      <Button className="ml-auto" onClick={() => send(false)}>Save as draft</Button>
      <Button variant="primary" icon={<Send />} onClick={() => send(true)}>Send PO to {crew ? PEOPLE[crew].short : ''}</Button>
    </>
  )
  return (
    <Modal level={level} size="lg" onClose={s.close} header={header} footer={footer} title="Book the installer" bodyClass="px-7 py-6 max-sm:px-4">
      {step === 1 && (
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {free.map((f) => {
            const now = s.bookings.find((b) => b.crew === f.crew && b.start <= TODAY && b.end >= TODAY)
            const sub = allSubs().find((x) => x.crew === f.crew)?.region
            return (
              <button
                key={f.crew}
                onClick={() => { setCrew(f.crew); setStep(2) }}
                className={cn('flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-lift', crew === f.crew ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-line bg-white hover:border-brand-300')}
              >
                <Avatar who={f.crew} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.96875rem] font-semibold text-ink">{PEOPLE[f.crew].name}</span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">{now ? `On ${s.jobs[now.jobId]?.name}` : 'Not on a job'}{sub ? ` · ${sub}` : ''}</span>
                </span>
                <Status tone={f.iso === TODAY ? 'ok' : 'neutral'}>{f.iso === TODAY ? 'Free now' : `Free ${new Date(f.iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</Status>
              </button>
            )
          })}
        </div>
      )}
      {step === 2 && crew && (
        <div>
          {(() => {
            const f = free.find((x) => x.crew === crew)
            const want = s.prep[jobId]?.targetISO
            if (!f || !want || f.iso <= want) return null
            const busy = s.bookings.filter((b) => b.crew === crew && b.end >= want).sort((a, b) => b.end.localeCompare(a.end))[0]
            const d = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warn-100 bg-warn-50 px-4 py-3 text-[0.84375rem] text-ink-2">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-warn-700" />
                <span><b className="font-semibold text-warn-700">{PEOPLE[crew].short} is busy until {d(busy?.end || f.iso)}</b>{busy ? ` on ${s.jobs[busy.jobId]?.name}` : ''} — {job.name} wants to start {d(want)}. It shows as a clash on the Schedule until one of them moves.</span>
              </div>
            )
          })()}
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-wash p-4">
            <Avatar who={crew} size={48} />
            <div className="min-w-0 flex-1">
              <div className="text-[0.8125rem] font-medium text-muted">New installer PO</div>
              <div className="truncate text-[1.125rem] font-bold text-ink">{PEOPLE[crew].name} · {job.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] text-muted"><MapPin className="h-3.5 w-3.5" />{job.address}</div>
            </div>
            <div className="text-right">
              <div className="text-[1.5rem] font-bold tnum text-ink">{fmtMoney(total)}</div>
              <div className="text-[0.75rem] text-faint">What we pay him{smp(' · sample')}</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_6.875rem_5.625rem_6.875rem] border-b border-line pb-2 text-[0.78125rem] font-semibold text-muted max-sm:grid-cols-[minmax(0,1fr)_6rem]">
            <span>Work · from the project scope</span><span className="text-right">Qty</span><span className="text-right max-sm:hidden">Rate</span><span className="text-right max-sm:hidden">Amount</span>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_6.875rem_5.625rem_6.875rem] items-center border-b border-line-2 py-2.5 text-[0.875rem] max-sm:grid-cols-[minmax(0,1fr)_6rem]">
              <span className="truncate text-ink">{l.item}</span>
              <span className="text-right tnum text-ink-2">{l.qty}</span>
              <span className="text-right tnum text-ink-2 max-sm:hidden">{l.rate ? fmtMoney(l.rate, { cents: l.rate % 1 !== 0 }) : 'Lump sum'}</span>
              <span className="text-right font-semibold tnum text-ink max-sm:hidden">{fmtMoney(l.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-3 text-[0.9375rem] font-bold text-ink"><span>Total</span><span className="tnum">{fmtMoney(total)}</span></div>
          <Field label="Note to the installer (optional)" className="mt-2"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Start with the floors; walls wait for the heights" /></Field>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-brand-50 px-4 py-3 text-[0.84375rem] text-brand-800">
            <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Goes to {PEOPLE[crew].short}’s phone · shows in <b>Purchase orders</b> and on the project</span>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function IPOModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const p = s.ipos.find((x) => x.id === id)
  const [rejOpen, setRejOpen] = React.useState(false)
  /* changing a PO he already has: the lines are worked on here, then go to him as a new revision */
  const [draft, setDraft] = React.useState<IPOLine[] | null>(null)
  if (!p) return null
  const job = s.jobs[p.jobId]
  const editing = p.status === 'Draft' || !!draft
  const lines = draft || p.lines
  const setLines = (ls: IPOLine[]) => (draft ? setDraft(ls) : setIPOLines(p.id, ls))
  const ratio = poRatio(s, { jobId: p.jobId, lines, changes: p.changes })
  const total = ratio.total
  const name = PEOPLE[p.crew].name
  const at = { Draft: 0, Sent: 1, Accepted: 2, Rejected: 2 }[p.status]
  const steps = [
    { key: 'draft', label: 'Made', state: (at > 0 ? 'done' : 'current') as any, sub: p.log[0]?.date || 'From scope' },
    { key: 'sent', label: `Sent to ${PEOPLE[p.crew].short}`, state: (at > 1 ? 'done' : at === 1 ? 'current' : 'future') as any, sub: at >= 1 ? p.log.find((l) => /sent/i.test(l.text))?.date : undefined },
    { key: 'answer', label: p.status === 'Rejected' ? 'Turned down' : 'Accepted', state: (p.status === 'Rejected' ? 'blocked' : p.status === 'Accepted' ? 'current' : 'future') as any, sub: at === 2 ? p.date : undefined },
  ]
  const header = (
    <div className="border-b border-line px-6 pb-5 pt-5 pr-16 max-sm:px-4">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-2">
        <div className="min-w-0">
          <div className="text-[0.8125rem] text-muted">Installer PO · in Purchase orders</div>
          <h2 className="h-display mt-0.5 text-[1.5rem] font-semibold leading-tight text-ink">{p.id}{p.rev ? ` · rev ${p.rev}` : ''} · {name}</h2>
          <div className="mt-1 text-[0.875rem] text-muted"><button onClick={() => s.open({ t: 'job', id: p.jobId })} className="text-ink-2 hover:text-brand-700">{job?.name}</button> · {job?.address}</div>
        </div>
        <div className="shrink-0 text-right max-md:text-left">
          <div className="text-[1.5rem] font-semibold tnum text-ink">{fmtMoney(total)}</div>
          <div className="text-[0.75rem] text-faint">What we pay {PEOPLE[p.crew].short}{smp(' · sample amounts')}</div>
          {p.status !== 'Draft' && mailLive() && <MailedLine mailed={p.mailed} who={PEOPLE[p.crew].short} onSend={() => emailIPO(p.id)} />}
        </div>
      </div>
      <Path className="mt-4" steps={steps} />
    </div>
  )
  const footer = (
    <>
      {p.status === 'Draft' && (
        <>
          <Menu align="start" width={260} trigger={<Button>Change installer</Button>}>
            <MenuLabel>Draft it for someone else</MenuLabel>
            {CREWS.filter((c) => c !== p.crew).map((c) => <MenuItem key={c} icon={<Avatar who={c} size={20} />} onSelect={() => s.swap({ t: 'book', jobId: p.jobId, crew: c })}>{PEOPLE[c].name}</MenuItem>)}
          </Menu>
          <Button className="ml-auto" variant="primary" icon={<Send />} onClick={() => sendDraftIPO(p.id)}>Send PO to {PEOPLE[p.crew].short}</Button>
        </>
      )}
      {draft && (
        <>
          <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
          <span className="ml-auto text-[0.84375rem] text-muted">{fmtMoney(ipoTotal(p))} → <b className="font-semibold text-ink">{fmtMoney(total)}</b></span>
          <Button variant="primary" icon={<Send />} onClick={() => { setIPOLines(p.id, draft, { revise: true }); setDraft(null) }}>Send revision {(p.rev || 1) + 1} to {PEOPLE[p.crew].short}</Button>
        </>
      )}
      {!draft && p.status === 'Sent' && (
        <>
          <Button variant="ghost" icon={<FilePen />} onClick={() => setDraft(p.lines.map((l) => ({ ...l })))}>Change it</Button>
          <span className="text-[0.84375rem] text-muted max-md:hidden">Record what {name} told you:</span>
          <Pop open={rejOpen} onOpenChange={setRejOpen} side="top" width={300} trigger={<Button className="ml-auto">He turned it down</Button>}>
            <div className="text-[0.875rem] font-medium text-ink">Why?</div>
            <div className="mt-2 flex flex-col gap-1">
              {['Booked on another job', 'Price too low', 'Too far'].map((r) => <button key={r} onClick={() => { setRejOpen(false); answerIPO(p.id, false, r) }} className="rounded-md px-2.5 py-2 text-left text-[0.875rem] text-ink-2 hover:bg-wash-2">{r}</button>)}
            </div>
          </Pop>
          <Button variant="primary" icon={<Check />} onClick={() => answerIPO(p.id, true)}>He accepted</Button>
        </>
      )}
      {!draft && p.status === 'Accepted' && (
        <>
          <span className="text-[0.84375rem] text-ok-700">Accepted {p.date} — the installer is confirmed.</span>
          <Button className="ml-auto" icon={<FilePen />} onClick={() => setDraft(p.lines.map((l) => ({ ...l })))}>Revise the PO</Button>
        </>
      )}
      {p.status === 'Rejected' && (
        <>
          <span className="text-[0.84375rem] text-bad-700">Turned down{p.reason ? ` — ${p.reason.toLowerCase()}` : ''}.</span>
          <Button className="ml-auto" variant="primary" onClick={() => s.swap({ t: 'book', jobId: p.jobId })}>Pick another installer</Button>
        </>
      )}
    </>
  )
  return (
    <Modal level={level} size="lg" onClose={s.close} header={header} footer={footer} title={p.id} bodyClass="px-6 py-5 max-sm:px-4">
      <RatioMeter r={ratio} className="mb-5" />
      {editing ? (
        <IPOLinesEdit lines={lines} ratio={ratio} onChange={setLines} />
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_6.875rem_5.625rem_6.875rem] border-b border-line pb-2 text-[0.78125rem] font-medium text-muted max-sm:grid-cols-[minmax(0,1fr)_6rem]">
            <span>Work</span><span className="text-right">Qty</span><span className="text-right max-sm:hidden">Rate</span><span className="text-right max-sm:hidden">Amount</span>
          </div>
          {p.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_6.875rem_5.625rem_6.875rem] items-center border-b border-line-2 py-2.5 text-[0.875rem] max-sm:grid-cols-[minmax(0,1fr)_6rem]">
              <span className="min-w-0"><span className="block truncate text-ink">{l.item}</span>{ratio.lines[i]?.pct != null && <span className={cn('block text-[0.75rem]', ratio.lines[i].pct! > ratio.line ? 'font-semibold text-bad-600' : 'text-muted')}>{ratio.lines[i].pct}% of what we sell it for</span>}</span>
              <span className="text-right tnum text-ink-2">{l.qty}</span>
              <span className="text-right tnum text-ink-2 max-sm:hidden">{l.rate ? `${fmtMoney(l.rate, { cents: l.rate % 1 !== 0 })}` : 'Lump sum'}</span>
              <span className="text-right tnum text-ink max-sm:hidden">{fmtMoney(l.amount)}</span>
            </div>
          ))}
        </>
      )}
      {p.changes.map((c) => (
        <div key={c.co} className="grid grid-cols-[minmax(0,1fr)_6.875rem_5.625rem_6.875rem] items-center border-b border-line-2 py-2.5 text-[0.875rem] max-sm:grid-cols-[minmax(0,1fr)_6rem]">
          <span className="truncate text-ink">{c.co} · {c.text} <span className="text-[0.78125rem] text-muted">{c.status === 'pending' ? 'pending' : c.status}</span></span>
          <span className="text-right tnum text-ink-2">{c.qty}</span>
          <span className="max-sm:hidden" />
          <span className={cn('text-right tnum max-sm:hidden', c.status === 'pending' ? 'text-muted' : 'text-ink')}>{fmtMoney(c.amount)}</span>
        </div>
      ))}
      <div className="flex justify-end gap-6 pt-3 text-[0.9375rem] font-semibold text-ink"><span>Total</span><span className="tnum">{fmtMoney(total)}</span></div>
      <IPOPay p={p} total={total} />
      <div className="mt-6 text-[0.8125rem] font-medium text-muted">Activity</div>
      <div className="-mx-2 mt-1">{[...p.log].reverse().map((l, i) => <ActivityRow key={i} compact jobId={p.jobId} e={{ date: l.date, who: l.who, kind: 'schedule', title: l.text, ref: { t: 'ipo', id: p.id } }} />)}</div>
    </Modal>
  )
}

/** the PO's lines, to change: how much and at what rate (or a lump sum), and each line's share of what we sell it for */
function IPOLinesEdit({ lines, ratio, onChange }: { lines: IPOLine[]; ratio: Ratio; onChange: (ls: IPOLine[]) => void }) {
  const set = (i: number, p: Partial<IPOLine>) => {
    const next = lines.map((l, j) => {
      if (j !== i) return l
      const m = { ...l, ...p }
      if (m.n != null && m.rate != null && (p.n != null || p.rate != null)) {
        m.amount = Math.round(m.n * m.rate)
        m.qty = `${m.n.toLocaleString('en-US')} ${(l.qty.match(/[A-Za-z].*$/) || ['SF'])[0]}`
      }
      return m
    })
    onChange(next)
  }
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_6rem_7rem_2rem] gap-2 border-b border-line pb-2 text-[0.78125rem] font-medium text-muted max-sm:hidden">
        <span>Work</span><span className="text-right">Qty</span><span className="text-right">Rate</span><span className="text-right">Amount</span><span />
      </div>
      {lines.map((l, i) => {
        const r = ratio.lines[i]
        return (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_6rem_6rem_7rem_2rem] items-center gap-2 border-b border-line-2 py-2 max-sm:grid-cols-[1fr_1fr_1fr_2rem]">
            <span className="min-w-0 max-sm:col-span-3 max-sm:row-start-1">
              <NumField text value={l.item} onSave={(v) => set(i, { item: String(v) || l.item })} className="w-full text-left" label="Work" />
              {r?.pct != null && <span className={cn('mt-0.5 block text-[0.75rem]', r.pct > ratio.line ? 'font-semibold text-bad-600' : 'text-muted')}>{r.pct}% of what we sell it for ({fmtMoney(r.sold)})</span>}
            </span>
            <button aria-label="Remove the line" onClick={() => onChange(lines.filter((_, j) => j !== i))} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-wash-2 hover:text-bad-600 sm:order-last max-sm:col-start-4 max-sm:row-start-1"><Trash2 className="h-4 w-4" /></button>
            {l.n != null ? <NumField value={l.n} onSave={(v) => set(i, { n: Number(v) || 0 })} label="Quantity" /> : <span className="text-right text-[0.8125rem] text-muted max-sm:text-left">{l.qty}</span>}
            {l.rate != null ? <NumField value={l.rate} money onSave={(v) => set(i, { rate: Number(v) || 0 })} label="Rate" /> : <span className="text-right text-[0.8125rem] text-muted">Lump sum</span>}
            {l.n != null && l.rate != null ? <span className="text-right text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(l.amount)}</span> : <NumField value={l.amount} money onSave={(v) => set(i, { amount: Math.round(Number(v) || 0) })} label="Amount" />}
          </div>
        )
      })}
      <button onClick={() => onChange([...lines, { item: 'Extra work', qty: 'Lump sum', amount: 0 }])} className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1 py-1.5 text-[0.8125rem] font-semibold text-brand-600 hover:underline"><Plus className="h-4 w-4" />Add a line</button>
    </div>
  )
}
/** a number (or a few words) that saves when you leave the box */
function NumField({ value, onSave, money, text, label, className }: { value: number | string; onSave: (v: number | string) => void; money?: boolean; text?: boolean; label: string; className?: string }) {
  const [v, setV] = React.useState(String(value))
  React.useEffect(() => setV(String(value)), [value])
  return (
    <span className={cn('relative block', className)}>
      {money && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[0.8125rem] text-faint">$</span>}
      <TextInput
        aria-label={label}
        inputMode={text ? undefined : 'decimal'}
        value={v}
        onChange={(e) => setV(text ? e.target.value : e.target.value.replace(/[^\d.]/g, ''))}
        onBlur={() => { if (v !== String(value)) onSave(text ? v.trim() : Number(v)) }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className={cn('h-9', text ? 'text-[0.875rem]' : 'text-right tnum', money && 'pl-6')}
      />
    </span>
  )
}

/** what we've paid him on this PO, week by week, from the daily updates */
function IPOPay({ p, total }: { p: IPO; total: number }) {
  const s = useStore()
  if (p.status !== 'Accepted' || !['owner', 'accounting', 'pm'].includes(s.role)) return null
  const weeks = PAY_WEEKS.map((w) => {
    const r = payRow(s, p.crew, w)
    const amount = r ? r.calc.lines.filter((l) => l.jobId === p.jobId).reduce((n, l) => n + (l.amount || 0), 0) : 0
    return { w, r, amount }
  }).filter((x) => x.amount > 0)
  const earlier = PAID_EARLIER[p.id] || 0
  if (!weeks.length && !earlier) return null
  const paid = earlier + weeks.filter((x) => x.r && ['approved', 'paid'].includes(x.r.state)).reduce((n, x) => n + x.amount, 0)
  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.8125rem] font-medium text-muted">Weekly pay · from the daily updates</span>
        <span className="text-[0.8125rem] tnum text-muted">Paid <b className="font-semibold text-ink">{fmtMoney(paid)}</b> of {fmtMoney(total)}</span>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-wash-2"><span className="bg-ok-500" style={{ width: `${Math.min(100, (paid / total) * 100)}%` }} /></div>
      <div className="mt-2 flex flex-col">
        {earlier > 0 && (
          <div className="flex items-center gap-3 border-b border-line-2 py-2.5 text-[0.875rem]">
            <span className="flex-1 text-ink">{shiftText('Before Sep 14')} <span className="text-muted">· in QuickBooks</span></span>
            <Status tone="ok">Paid</Status>
            <span className="w-[5.625rem] text-right font-semibold tnum text-ink">{fmtMoney(earlier)}</span>
          </div>
        )}
        {weeks.map(({ w, r, amount }) => (
          <button key={w.key} onClick={() => s.open({ t: 'pay', crew: p.crew, week: w.key })} className="flex items-center gap-3 border-b border-line-2 py-2.5 text-left text-[0.875rem] last:border-0 hover:bg-wash">
            <span className="flex-1 text-ink">Week of {w.label}</span>
            {r && <Status tone={PAY_STATE[r.state].tone}>{PAY_STATE[r.state].label}</Status>}
            <span className="w-[5.625rem] text-right font-semibold tnum text-ink">{fmtMoney(amount)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ================= a new PO, priced from our items ================= */
type DraftLine = { itemId: string; n: number; price: number }
export function NewPOModal({ jobId, prefill, fromEstimate, fromTakeoff, level }: { jobId?: string; prefill?: any; fromEstimate?: boolean; fromTakeoff?: boolean; level: number }) {
  const s = useStore()
  const [job, setJob] = React.useState(jobId || '')
  const groups = job ? materialsFromEstimate(s, job) : []
  /* what the scope still needs, split by who we buy it from */
  const take = job ? takeoff(s, job) : null
  const missing = take ? take.lines.filter((l) => l.toOrder > 0) : []
  const byVendor = Array.from(new Set(missing.map((l) => s.items.find((i) => i.id === l.itemId)?.vendor || 'Infinity'))).map((v) => ({
    vendor: v,
    lines: missing.filter((l) => (s.items.find((i) => i.id === l.itemId)?.vendor || 'Infinity') === v).map((l) => ({ itemId: l.itemId, n: l.toOrder, price: s.items.find((i) => i.id === l.itemId)?.cost || 0 })),
  }))
  const useTake = !!fromTakeoff || (!prefill && !fromEstimate && missing.length > 0)
  const pickVendor = prefill?.supplier || (useTake && byVendor[0]?.vendor) || (fromEstimate && groups[0]?.vendor) || 'Infinity'
  const [vendor, setVendor] = React.useState<string>(pickVendor)
  const fromPrefill = (): DraftLine[] => {
    const find = (name: string) => s.items.find((i) => i.type === 'material' && (i.name.toLowerCase().includes(name.toLowerCase().split(' ·')[0].split(' ')[0]) || name.toLowerCase().includes(i.name.toLowerCase().split(' ·')[0].split(' ')[0])))
    if (prefill?.lines) return prefill.lines.map((l: any) => { const it = find(l.item); return { itemId: it?.id || 'm-thinset', n: Number(String(l.qty).replace(/[^0-9.]/g, '')) || 1, price: it?.cost || 0 } })
    if (useTake) return (byVendor.find((g) => g.vendor === pickVendor) || byVendor[0])?.lines || []
    if (fromEstimate && groups.length) return (groups.find((g) => g.vendor === pickVendor) || groups[0]).lines.map((l) => ({ itemId: l.itemId!, n: l.n || 1, price: l.price || 0 }))
    return []
  }
  const [lines, setLines] = React.useState<DraftLine[]>(fromPrefill)
  const [needed, setNeeded] = React.useState('Thu')
  const total = lines.reduce((n, l) => n + l.n * l.price, 0)
  const j = s.jobs[job]
  const send = () => {
    const ls = lines.map((l) => {
      const it = s.items.find((i) => i.id === l.itemId)!
      return { item: it.name, qty: `${l.n} ${it.unit}${l.n === 1 || it.unit === 'LS' ? '' : 's'}`, itemId: it.id, n: l.n, price: l.price }
    })
    const ids = lines.map((l) => l.itemId)
    const what = prefill?.what || (ids.some((i) => i === 'm-sand' || i === 'm-portland') ? 'Floor prep' : ids.some((i) => i === 'm-board' || i === 'm-wp') ? 'Board and waterproofing' : ids.every((i) => /jolly|trim|edge/.test(i)) ? 'Metal edges' : 'Setting materials')
    createPO(job, { supplier: vendor, lines: ls, amount: Math.round(total), what, neededBy: needed, replaces: prefill?.replaces, tag: prefill?.tag, addQty: prefill?.addQty })
  }
  /* the supplier: one dropdown, with what each one has for this project */
  const pickVendor2 = (v: string) => {
    setVendor(v)
    if (useTake) { const t = byVendor.find((x) => x.vendor === v); setLines(t ? t.lines : []); return }
    const g = groups.find((x) => x.vendor === v)
    if (g) setLines(g.lines.map((l) => ({ itemId: l.itemId!, n: l.n || 1, price: l.price || 0 })))
  }
  const vendors = s.suppliers.filter((x) => !s.inactive.includes('supplier:' + x.name)).map((x) => x.name)
  const vendorHint = (v: string) => {
    const t = byVendor.find((g) => g.vendor === v)
    if (useTake && t) return `${t.lines.length} still missing on this project`
    if (!useTake && groups.some((g) => g.vendor === v)) return 'on the estimate'
    return undefined
  }
  const days = DAY_OPTIONS()
  if (!days.some((d) => d.key === needed)) days.unshift({ key: needed, label: needed })
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={useTake && j ? `Order materials · ${j.name}` : j ? `New PO · ${j.name}` : 'New purchase order'}
      header={<FormHead k="po" kicker={j ? j.name : undefined} title={useTake ? 'Order materials' : 'Purchase order'} />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{lines.length} lines · <span className="font-medium text-ink">{fmtMoney(total)}</span>{smp(' · sample amounts')}</span>
          <Button className="ml-auto" icon={<Mail />} disabled={!job || !lines.length} onClick={() => s.open({ t: 'email', what: { kind: 'po', draft: { jobId: job, supplier: vendor, lines, neededBy: needed } } })}>What {vendor} gets</Button>
          <Button variant="primary" icon={<Send />} disabled={!job || !lines.length} onClick={send}>Send PO to {vendor}</Button>
        </>
      }
    >
      {prefill?.replaces && <div className="mb-3 rounded-lg border border-warn-100 bg-warn-50 px-4 py-2.5 text-[0.875rem] text-ink-2">This replaces {prefill.replaces}, which will be cancelled and kept in the history.</div>}
      {!jobId && (
        <FormRow label="Project">
          <ProjectField value={job} onChange={setJob} keep={(x) => !['request', 'estimating', 'proposal', 'followup'].includes(x.stage)} autoFocus />
        </FormRow>
      )}
      <FormRow label="Supplier" hint={j ? <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" />Delivered to {j.address}</span> : undefined}>
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2 max-sm:grid-cols-1">
          <SearchSelect label="Supplier" value={vendor} onChange={pickVendor2} search={vendors.length > 8} width={340} options={vendors.map((v) => ({ key: v, label: v, hint: vendorHint(v) }))} />
          <SearchSelect label="Needed on site by" value={needed} onChange={setNeeded} search={false} width={260} options={days.map((d) => ({ key: d.key, label: byDay(d.label, 'Needed by') }))} plain />
        </div>
      </FormRow>
      <FormRow label="What to order" hint={useTake && j ? <SetupLine jobId={j.id} /> : 'Priced from QuickBooks — what you last paid is filled in.'}>
        <div className="grid grid-cols-[minmax(0,1fr)_5.625rem_6.25rem_6.25rem_2rem] border-b border-line pb-2 pt-2.5 text-[0.78125rem] font-medium text-muted max-sm:hidden">
          <span>Item</span><span className="text-right">Qty</span><span className="text-right">Price</span><span className="text-right">Amount</span><span />
        </div>
        {lines.map((l, i) => {
          const it = s.items.find((x) => x.id === l.itemId)!
          const set = (p: Partial<DraftLine>) => setLines((L) => L.map((x, k) => (k === i ? { ...x, ...p } : x)))
          return (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_5.625rem_6.25rem_6.25rem_2rem] items-center gap-0 border-b border-line-2 py-2 max-sm:grid-cols-[minmax(0,1fr)_4.5rem_2rem] max-sm:gap-y-1">
              <span className="flex min-w-0 items-center gap-3">
                <ItemThumb item={it} size={36} />
                <span className="min-w-0">
                  <span className="block truncate text-[0.875rem] font-medium text-ink">{it.brand ? `${it.brand} ${it.product}` : it.name}</span>
                  <span className="block truncate text-[0.75rem] text-muted">{it.brand ? `${it.name} · ` : ''}Last paid {fmtMoney(it.cost, { cents: it.cost % 1 !== 0 })} / {it.unit}</span>
                  {(() => { const m = take?.lines.find((x) => x.itemId === l.itemId); return m && useTake ? <CalcHow line={m} unit={it.unit} waste={take!.rules.waste} className="mt-0.5" /> : null })()}
                </span>
              </span>
              <span className="text-right"><Num value={l.n} onChange={(n) => set({ n })} label={`Quantity · ${it.name}`} /></span>
              <span className="text-right max-sm:hidden"><Num value={l.price} onChange={(n) => set({ price: n })} label={`Price · ${it.name}`} money /></span>
              <span className="text-right text-[0.875rem] tnum text-ink max-sm:hidden">{fmtMoney(l.n * l.price)}</span>
              <button aria-label="Remove line" onClick={() => setLines((L) => L.filter((_, k) => k !== i))} className="inline-flex h-7 w-7 items-center justify-center justify-self-end rounded-md text-faint hover:bg-bad-50 hover:text-bad-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )
        })}
        <div className="py-1.5">
          <ItemPicker types={['material']} label="Add an item" onPick={(it) => setLines((L) => [...L, { itemId: it.id, n: 1, price: it.cost }])} />
        </div>
      </FormRow>
    </Modal>
  )
}

/** the setup in one line, under what to order — worked out from it; a guess says so; Change the setup opens it */
function SetupLine({ jobId }: { jobId: string }) {
  const s = useStore()
  const rows = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.filter((x) => x.sf).map((x) => ({ m: methodOf(r.name, x) })))
  const guessed = rows.filter((r) => r.m.auto).length
  return (
    <span data-setup-line>
      Worked out from the setup and the square feet — only what’s still missing.{' '}
      {guessed > 0 && <span className="font-medium text-warn-700">{guessed} {guessed === 1 ? 'wall or floor’s' : 'walls or floors’'} setup is a guess.{' '}</span>}
      <button type="button" onClick={() => s.open({ t: 'setting', jobId })} className="font-semibold text-brand-700 hover:underline">Change the setup</button>
    </span>
  )
}

/** what we decided goes under the tile, surface by surface — the materials are worked out from it */
export function SetupPanel({ jobId }: { jobId: string }) {
  const s = useStore()
  const rows = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.filter((x) => x.sf).map((x) => ({ room: r.name, x, m: methodOf(r.name, x) })))
  if (!rows.length) return null
  const guessed = rows.filter((r) => r.m.auto).length
  return (
    <div className="overflow-hidden rounded-[0.75rem] border border-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-2 bg-wash px-4 py-2.5">
        <span className="text-[0.84375rem] font-semibold text-ink">The setup — what goes under the tile</span>
        {guessed > 0 && <span className="text-[0.78125rem] text-warn-700">{guessed} suggested, not confirmed</span>}
        <Button size="xs" className="ml-auto" onClick={() => s.open({ t: 'setting', jobId })}>Change the setup</Button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 px-4 py-1.5 max-md:grid-cols-1">
        {rows.map((r) => (
          <div key={r.room + r.x.name} className="flex items-center gap-3 border-b border-line-2 py-1.5 text-[0.8125rem] last:border-0 md:[&:nth-last-child(2):nth-child(odd)]:border-0">
            <span className="min-w-0 flex-1 truncate text-ink-2"><span className="font-medium text-ink">{r.room}</span> · {r.x.name.toLowerCase()} <span className="tnum text-muted">· {r.x.sf} SF</span></span>
            <span className={cn('shrink-0 font-semibold', r.m.auto ? 'text-warn-700' : 'text-ink')}>{METHODS[r.m.key].short}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
function Num({ value, onChange, label, money }: { value: number; onChange: (n: number) => void; label: string; money?: boolean }) {
  const [v, setV] = React.useState(String(value))
  React.useEffect(() => setV(String(value)), [value])
  return (
    <span className="relative inline-flex">
      {money && <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[0.8125rem] text-faint">$</span>}
      <input aria-label={label} inputMode="decimal" value={v} onChange={(x) => setV(x.target.value)} onBlur={() => { const n = Number(v.replace(/[^0-9.]/g, '')); if (!isNaN(n)) onChange(n); else setV(String(value)) }} onKeyDown={(x) => { if (x.key === 'Enter') (x.target as HTMLInputElement).blur() }} className={cn('h-8 w-[4.75rem] rounded-md border border-transparent bg-wash px-2 text-right text-[0.875rem] tnum text-ink hover:border-line focus:border-brand-300 focus:bg-white focus:outline-none', money && 'pl-5')} />
    </span>
  )
}

/** the real app: when Tile OS last emailed it, and a button to email it (again) */
function MailedLine({ mailed, who, onSend }: { mailed?: { at: string; to: string }; who: string; onSend: () => Promise<boolean> }) {
  const [busy, setBusy] = React.useState(false)
  const when = mailed ? new Date(mailed.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  return (
    <div className="mt-1 flex flex-wrap items-center justify-end gap-x-2 text-[0.8125rem] max-md:justify-start" data-mailed={mailed ? 'yes' : 'no'}>
      <span className="text-muted">{mailed ? `Emailed ${when} to ${mailed.to}` : `Not emailed to ${who} yet`}</span>
      <button disabled={busy} onClick={async () => { setBusy(true); try { await onSend() } finally { setBusy(false) } }} className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline disabled:text-faint"><Mail className="h-3.5 w-3.5" />{busy ? 'Sending…' : mailed ? 'Email it again' : 'Email it'}</button>
    </div>
  )
}
