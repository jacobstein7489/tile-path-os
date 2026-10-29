import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { Mail, Receipt, Clock3, Landmark, Package, ArrowRight, CheckCircle2, Send, BellRing, Plus, Trash2, Truck, AlertTriangle, FileText, Building2, Ban, CircleDollarSign } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { PageHeader, Card, CardHeader, Button, Pill, Avatar, KpiTile, UnderlineTabs, Field, TextInput, Chip, Empty, IconCircle, Count, StatStrip } from '@/tileos/components/ui/core'
import { Modal, DatePresets } from '@/tileos/components/ui/overlay'
import { Swatch } from '@/tileos/components/ui/swatch'
import { MiniSteps, Bar, StackBar } from '@/tileos/components/ui/progress'
import { cn, TONE } from '@/tileos/lib/utils'
import { fmtMoney, PEOPLE } from '@/tileos/data/model'
import { MONEY_STEPS, MONEY_KIND_LABEL, PO_STEPS, BILLING, type MoneyItem } from '@/tileos/data/work'
import { MoneyRow, billingOf, jobMoney } from './job/money-tab'
import { createInvoice, recordPayment, sendReminder, addToBill, requestRetainage, advanceBill, custPOReceived, confirmPO, receivePO, poNext, followUpPO, createPO, changeBill } from './flows'
import { REAL } from '@/tileos/lib/save'
import { QbBillRow, QbHeaderStatus } from './qbui'
import { qbLive } from './qbsync'

type MTab = 'todo' | 'waiting' | 'upcoming' | 'purchases' | 'paid' | 'jobs'

export function MoneyPage() {
  const s = useStore()
  const role = s.role
  const [tab, setTab] = React.useState<MTab>('todo')
  const todo = s.money.filter((m) => m.state === 'todo')
  const waiting = s.money.filter((m) => m.state === 'waiting')
  const upcoming = s.money.filter((m) => m.state === 'upcoming')
  const paid = s.money.filter((m) => m.state === 'paid')
  const sum = (l: MoneyItem[]) => l.reduce((n, m) => n + (m.amount ? m.amount - (m.paid || 0) : 0), 0)
  const retainage = Object.entries(BILLING).filter(([id]) => s.jobs[id]).reduce((n, [, b]) => n + b.retainage, 0)
  const poOpen = s.pos.filter((p) => p.step === 1 || p.late)

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Billing"
        sub="Deposits, progress bills, change orders, retainage and our purchase orders — where each one is at. QuickBooks keeps the invoices."
        actions={
          REAL.cloud ? <QbHeaderStatus /> : (
            <span className="inline-flex items-center gap-2 text-[0.84375rem] text-muted">
              <span className="h-2 w-2 rounded-full bg-ok-500" /> QuickBooks synced 5 min ago{smp(' · sample amounts')}
            </span>
          )
        }
      />
      <StatStrip
        items={[
          { label: 'Bills to send', value: todo.length, sub: `${fmtMoney(sum(todo), { compact: true })} ready to bill`, active: tab === 'todo', onClick: () => setTab('todo') },
          { label: 'Waiting for payment', value: fmtMoney(sum(waiting), { compact: true }), sub: `${waiting.length} bills · oldest 13 days`, active: tab === 'waiting', onClick: () => setTab('waiting') },
          { label: 'Retainage held', value: fmtMoney(retainage, { compact: true }), sub: 'Released at closeout', active: tab === 'jobs', onClick: () => setTab('jobs') },
          { label: 'POs to confirm', value: poOpen.length, sub: 'Suppliers to confirm, or late', active: tab === 'purchases', onClick: () => setTab('purchases') },
        ]}
      />
      <Card className="mt-6 overflow-hidden">
        <div className="px-6 pt-1 max-sm:px-3">
          <UnderlineTabs
            className="border-b-0"
            value={tab}
            onChange={setTab}
            items={[
              { key: 'todo', label: 'To invoice', count: todo.length },
              { key: 'waiting', label: 'Waiting for payment', count: waiting.length },
              { key: 'upcoming', label: 'Coming up', count: upcoming.length },
              { key: 'purchases', label: 'Purchase orders', count: s.pos.length },
              { key: 'paid', label: 'Paid', count: paid.length },
              { key: 'jobs', label: 'By project' },
            ]}
          />
        </div>
        <div className="border-t border-line">
          {tab === 'todo' && <Rows list={todo} empty="Nothing to send — every bill is out." />}
          {tab === 'waiting' && <Rows list={waiting} empty="Nobody owes us anything right now." />}
          {tab === 'upcoming' && <Rows list={upcoming} empty="Nothing coming up." />}
          {tab === 'paid' && <Rows list={paid} empty="No payments recorded yet." />}
          {tab === 'purchases' && <POList />}
          {tab === 'jobs' && <ByJob />}
        </div>
      </Card>
    </div>
  )
}

function Rows({ list, empty }: { list: MoneyItem[]; empty: string }) {
  return list.length ? (
    <>
      {list.map((m) => (
        <MoneyRow key={m.id} m={m} showJob />
      ))}
    </>
  ) : (
    <Empty icon={<CheckCircle2 className="h-6 w-6" />} title={empty} />
  )
}

function POList() {
  const s = useStore()
  return (
    <>
      {s.pos.map((p) => {
        const job = s.jobs[p.jobId]
        const cancelled = /cancelled/i.test(p.note)
        return (
          <button key={p.id} onClick={() => s.open({ t: 'po', id: p.id })} className="grid w-full grid-cols-[minmax(0,1.6fr)_minmax(0,1.5fr)_6.875rem_11rem] items-center gap-6 border-b border-line-2 px-6 py-4 text-left last:border-0 hover:bg-wash md:max-xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:max-xl:gap-x-6 md:max-xl:gap-y-1.5 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:gap-y-3 max-sm:px-4">
            <div className="min-w-0 md:max-xl:row-span-2 md:max-xl:self-center">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[0.90625rem] font-bold text-ink">{p.id}</span>
                <span className="text-[0.84375rem] font-medium text-ink-2">· {p.supplier}</span>
                {p.late && <Pill tone="bad" size="sm">Late</Pill>}
                {cancelled && <Pill tone="neutral" size="sm">Cancelled</Pill>}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 truncate text-[0.8125rem] text-muted">
                {job?.name} · {p.what}
              </div>
            </div>
            <div className="min-w-0 md:max-xl:row-span-2 md:max-xl:self-center max-md:col-span-2 max-md:row-start-2">{cancelled ? <span className="text-[0.8125rem] text-muted">{p.note}</span> : <MiniSteps steps={PO_STEPS} at={p.step} late={p.late} />}</div>
            <div className="text-right text-[1rem] font-bold tnum text-ink md:max-xl:col-start-3 md:max-xl:row-start-1 max-md:col-start-2 max-md:row-start-1 max-md:self-start">{fmtMoney(p.amount)}</div>
            <div className="flex justify-end md:max-xl:col-start-3 md:max-xl:row-start-2 max-md:col-span-2 max-md:justify-start max-md:empty:hidden">
              {!cancelled && (
                <span className={cn('inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[0.625rem] px-3 text-[0.8125rem] font-semibold', p.late ? 'bg-bad-50 text-bad-700' : 'bg-brand-50 text-brand-700')}>
                  {p.step === 1 ? 'Mark confirmed' : p.step === 2 ? (p.late ? 'Follow up' : 'Receive') : p.step === 3 ? 'Bill in' : p.step === 4 ? 'Mark paid' : 'Open'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          </button>
        )
      })}
    </>
  )
}

function ByJob() {
  const s = useStore()
  const rows = Object.values(s.jobs).filter((j) => BILLING[j.id])
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1.6fr)_6.875rem_minmax(0,1.6fr)_6.875rem_10rem] items-center gap-6 bg-wash px-6 py-2.5 text-[0.78125rem] font-semibold text-muted max-xl:hidden">
        <span>Project</span>
        <span className="text-right">Contract</span>
        <span>Installed vs billed vs paid</span>
        <span className="text-right">Retainage</span>
        <span />
      </div>
      {rows.map((j) => {
        const b = billingOf(j)
        const under = b.installedPct - b.billedPct
        const next = s.money.find((m) => m.jobId === j.id && m.kind === 'progress' && m.state === 'upcoming')
        return (
          <div key={j.id} className="grid grid-cols-[minmax(0,1.6fr)_6.875rem_minmax(0,1.6fr)_6.875rem_10rem] items-center gap-6 border-b border-line-2 px-6 py-3.5 last:border-0 md:max-xl:grid-cols-[minmax(0,1.3fr)_5.625rem_minmax(0,1.3fr)_auto] md:max-xl:gap-x-5 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:gap-y-2.5 max-sm:px-4">
            <button onClick={() => s.open({ t: 'job', id: j.id, tab: 'money' })} className="flex min-w-0 items-center gap-3 text-left">
              <div className="min-w-0">
                <div className="truncate text-[0.90625rem] font-semibold text-ink hover:text-brand-700">{j.name}</div>
                <div className="truncate text-[0.78125rem] text-muted">{j.client}</div>
              </div>
            </button>
            <div className="text-right text-[0.90625rem] font-semibold tnum">{fmtMoney(b.contract + b.changes, { compact: true })}</div>
            <div className="min-w-0 max-md:col-span-2">
              <StackBar h={10} parts={[{ pct: b.paidPct, className: 'bg-ok-500' }, { pct: Math.max(0, b.billedPct - b.paidPct), className: 'bg-brand-500' }, { pct: Math.max(0, under), className: 'bg-warn-300' }]} />
              <div className="mt-1 text-[0.75rem] text-muted">{b.installedPct}% installed · {b.billedPct}% billed · {b.paidPct}% paid</div>
            </div>
            <div className="text-right text-[0.875rem] tnum text-ink-2 max-xl:hidden">{b.retainage ? fmtMoney(b.retainage) : '—'}</div>
            <div className="flex justify-end max-md:col-span-2 max-md:justify-start">
              {under >= 5 ? (
                <Button size="xs" variant="soft" onClick={() => (next ? s.open({ t: 'money', id: next.id }) : s.open({ t: 'job', id: j.id, tab: 'money' }))}>Under-billed {under}% · bill</Button>
              ) : (
                <span className="text-[0.78125rem] font-medium text-ok-600">Billing on track</span>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

/* ---------------- money item popup ---------------- */
export function MoneyModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const m = s.money.find((x) => x.id === id)
  const [amt, setAmt] = React.useState('')
  const [editing, setEditing] = React.useState(false)
  if (!m) return null
  const job = s.jobs[m.jobId]
  const steps = MONEY_STEPS[m.kind]
  const at = m.state === 'paid' ? steps.length - 1 : m.step
  const open = m.amount ? m.amount - (m.paid || 0) : 0
  const b = job ? billingOf(job) : undefined
  const jm = job ? jobMoney(job) : undefined
  const est = s.estimates.find((e) => e.jobId === m.jobId && e.status === 'approved')

  const header = (
    <div className="border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
      <div className="flex items-start gap-4 max-sm:flex-wrap max-sm:gap-2">
        <div className="min-w-0 flex-1 max-sm:basis-full">
          <div className="flex flex-wrap items-center gap-2 text-[0.84375rem] text-muted">
            <button onClick={() => s.open({ t: 'job', id: m.jobId, tab: 'money' })} className="font-semibold text-ink-2 hover:text-brand-700">{job?.name}</button>
            <span>·</span>
            <Pill tone={m.kind === 'change' ? 'vio' : m.kind === 'progress' ? 'info' : 'warn'} size="sm">{MONEY_KIND_LABEL[m.kind]}</Pill>
            <span className={cn('font-semibold', m.ref ? 'text-ink' : 'text-faint')}>{m.ref ? `Invoice ${m.ref}` : 'Not invoiced yet'}</span>
          </div>
          <h2 className="h-tight mt-1 text-[1.4375rem] font-bold text-ink max-sm:text-[1.1875rem]">{m.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted">
            {est && <button onClick={() => s.open({ t: 'estimate', id: est.id })} className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline"><FileText className="h-3.5 w-3.5" />From estimate {est.id}</button>}
            <span className="inline-flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" />{job?.clientPO ? <>Client PO <b className="font-semibold text-ink-2">{job.clientPO}</b></> : 'No client PO yet'}</span>
            {job && <span>{job.client}</span>}
          </div>
        </div>
        <div className="text-right max-sm:flex max-sm:items-baseline max-sm:gap-2 max-sm:text-left">
          <div className="text-[1.75rem] font-bold tnum h-tight text-ink max-sm:text-[1.375rem]">{m.amount ? fmtMoney(m.amount) : '—'}</div>
          {m.paid ? <div className="text-[0.8125rem] font-semibold text-ok-600">{fmtMoney(m.paid)} paid</div> : <div className="text-[0.78125rem] text-muted">{smp('Sample amount') || 'Not paid yet'}</div>}
        </div>
      </div>
      <div className="mt-5">
        {m.step >= 0 || m.state === 'paid' ? (
          <MiniSteps steps={steps} at={at} tone={m.state === 'paid' ? 'ok' : 'info'} />
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl bg-wash-2 px-4 py-3 text-[0.875rem] text-ink-2">
            <Ban className="h-4 w-4 text-muted" /> {m.due} — {m.kind === 'change' ? 'billing opens the moment the approval is recorded.' : 'it opens by itself when the project gets there.'}
          </div>
        )}
      </div>
    </div>
  )

  let actions: React.ReactNode = null
  if (m.state === 'paid') actions = <div className="flex items-center gap-2 text-[0.90625rem] font-semibold text-ok-600"><CheckCircle2 className="h-5 w-5" />Paid {m.date}</div>
  else if ((m.kind === 'deposit' || m.kind === 'final') && m.step === 0)
    actions = (
      <>
        <button onClick={() => s.open({ t: 'email', what: { kind: 'invoice', id: m.id } })} className="rounded-xl border border-line bg-white p-4 text-left transition hover:border-brand-300 hover:shadow-xs">
          <div className="flex items-center justify-between text-[0.8125rem] font-semibold text-muted"><span>Invoice preview</span><span className="inline-flex items-center gap-1 text-brand-600"><Mail className="h-3.5 w-3.5" />See what they get</span></div>
          <div className="mt-2 flex justify-between text-[0.875rem]"><span className="text-ink-2">{m.title}{b ? ` of ${fmtMoney(b.contract + b.changes)}` : ''}</span><span className="font-semibold tnum">{fmtMoney(m.amount || 0)}</span></div>
          <div className="mt-1 flex justify-between text-[0.8125rem] text-muted"><span>To</span><span>{job?.client}</span></div>
        </button>
        <Button full size="lg" variant="primary" icon={<Send className="h-[1.125rem] w-[1.125rem]" />} onClick={() => createInvoice(m.id)}>Send the invoice</Button>
        <div className="text-[0.78125rem] text-muted">{(s.rules.autoOff || []).includes('inv-remind') ? 'Reminders are off — Settings → Automations.' : `Reminders go out by themselves every ${s.rules.reminderDays} days until it’s paid.`}</div>
      </>
    )
  else if (m.kind === 'retainage' && m.step === 0) actions = <Button full size="lg" variant="primary" icon={<Send className="h-[1.125rem] w-[1.125rem]" />} onClick={() => requestRetainage(m.id)}>Request release</Button>
  else if (m.kind === 'change' && m.step === 0) actions = <Button full size="lg" variant="primary" icon={<Plus className="h-[1.125rem] w-[1.125rem]" />} onClick={() => addToBill(m.id)}>Add to the next bill</Button>
  else if (m.kind === 'change' && m.step < 0) actions = <Button full size="lg" onClick={() => s.open({ t: 'co004' })}>Record the approval</Button>
  else if (m.kind === 'custpo') actions = <Button full size="lg" variant="primary" icon={<FileText className="h-[1.125rem] w-[1.125rem]" />} onClick={() => custPOReceived(m.id)}>Mark received</Button>
  else if (m.kind === 'progress' && m.step <= 1)
    actions = (
      <Button full size="lg" variant="primary" icon={<Send className="h-[1.125rem] w-[1.125rem]" />} onClick={() => advanceBill(m.id)}>
        {m.step <= 0 ? 'Send to the PM for review' : 'PM approved — send it'}
      </Button>
    )
  else if (m.kind === 'progress' && m.step === 2) actions = <Button full size="lg" variant="primary" onClick={() => advanceBill(m.id)}>GC approved it</Button>
  else
    actions = (
      <>
        <Field label="Record a payment">
          <div className="flex gap-2">
            <TextInput value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={fmtMoney(open)} />
          </div>
        </Field>
        <div className="flex gap-2">
          <Button className="flex-1" variant="primary" onClick={() => recordPayment(m.id, open)}>Paid in full</Button>
          <Button className="flex-1" disabled={!amt} onClick={() => { recordPayment(m.id, Number(amt.replace(/[^0-9]/g, ''))); setAmt('') }}>Partial</Button>
        </div>
        <Button full icon={<BellRing className="h-[1.125rem] w-[1.125rem]" />} onClick={() => sendReminder(m.id)}>Send a reminder now</Button>
      </>
    )

  return (
    <Modal level={level} size="lg" onClose={s.close} header={header} title={m.title}>
      <div className="grid grid-cols-[1fr_18.75rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <div className="min-w-0">
          {jm && jm.contract > 0 && (
            <div className="mb-5 rounded-2xl border border-line px-4 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[0.8125rem]">
                <span className="font-semibold text-ink">Invoiced so far on {job!.name}</span>
                <span className="tnum text-muted"><b className="font-bold text-ink">{fmtMoney(jm.invoiced)}</b> of {fmtMoney(jm.contract)} · {jm.billedPct}%</span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-wash-2">
                <span className="h-full bg-ok-500" style={{ width: `${jm.paidPct}%` }} />
                <span className="h-full bg-brand-400" style={{ width: `${Math.max(0, jm.billedPct - jm.paidPct)}%` }} />
              </div>
              <div className="mt-1.5 flex gap-4 text-[0.75rem] text-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok-500" />Paid {fmtMoney(jm.paid)}</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-400" />Invoiced, not paid {fmtMoney(jm.invoiced - jm.paid)}</span>
                <span className="ml-auto">Left to invoice {fmtMoney(jm.contract - jm.invoiced)}</span>
              </div>
            </div>
          )}
          <p className="text-[0.9375rem] leading-relaxed text-ink">{m.note}</p>
          {m.bill && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-line">
              <button onClick={() => s.open({ t: 'progress', jobId: m.jobId, week: m.bill!.week })} className="flex w-full items-center justify-between bg-wash px-4 py-2.5 text-left hover:bg-wash-2">
                <span className="text-[0.84375rem] font-semibold text-ink">From the daily updates · week of {m.bill.label}</span>
                <span className="text-[0.78125rem] font-semibold text-brand-600">See the week</span>
              </button>
              {m.bill.rooms.map((r) => (
                <div key={r.room} className="flex items-baseline justify-between gap-4 border-t border-line-2 px-4 py-2 text-[0.84375rem]">
                  <span className="min-w-0 truncate text-ink-2">{r.room}</span>
                  <span className="shrink-0 tnum text-ink">{fmtMoney(r.amount)}</span>
                </div>
              ))}
              <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line bg-wash/60 px-4 py-2.5 text-[0.84375rem]">
                <span className="text-muted">Installed through {m.bill.through} · {m.bill.pct}% of {fmtMoney(m.bill.contract)}</span>
                <span className="text-right tnum text-ink-2">{fmtMoney(m.bill.installed)}</span>
                <span className="text-muted">Less retainage {m.bill.retainagePct}%</span>
                <span className="text-right tnum text-ink-2">−{fmtMoney(m.bill.held)}</span>
                {m.bill.credit > 0 && <><span className="text-muted">Less the deposit’s share</span><span className="text-right tnum text-ink-2">−{fmtMoney(m.bill.credit)}</span></>}
                <span className="text-muted">Less billed before</span>
                <span className="text-right tnum text-ink-2">−{fmtMoney(m.bill.before)}</span>
                <span className="font-semibold text-ink">Progress</span>
                <span className="text-right font-semibold tnum text-ink">{fmtMoney(m.bill.progress)}</span>
                {m.bill.cos.map((c) => <React.Fragment key={c.id}><span className="truncate text-muted">{c.title}</span><span className="text-right tnum text-ink-2">+{fmtMoney(c.amount)}</span></React.Fragment>)}
                <span className="border-t border-line-2 pt-1.5 font-bold text-ink">This bill</span>
                <span className="border-t border-line-2 pt-1.5 text-right font-bold tnum text-ink">{fmtMoney(m.amount || 0)}</span>
              </div>
            </div>
          )}
          <div className="mt-6 text-[0.84375rem] font-semibold text-muted">Log</div>
          <div className="mt-3 flex flex-col">
            {[...m.log].reverse().map((l, i) => (
              <div key={i} className="flex gap-3 border-b border-line-2 py-2.5 last:border-0">
                <Avatar who={l.who} size={26} />
                <div>
                  <div className="text-[0.875rem] text-ink">{l.text}</div>
                  <div className="text-[0.78125rem] text-muted">{PEOPLE[l.who].name} · {l.date}</div>
                </div>
              </div>
            ))}
            {!m.log.length && <div className="text-[0.875rem] text-muted">Nothing logged yet.</div>}
          </div>
        </div>
        <div className="flex flex-col gap-3 self-start rounded-2xl border border-line bg-wash/60 p-4 max-md:order-first max-md:self-stretch">
          {editing ? (
            <BillEdit m={m} onDone={() => setEditing(false)} />
          ) : (
            <>
              <div className="text-[0.84375rem] font-semibold text-muted">Next step</div>
              {actions}
              <QbBillRow m={m} />
              {m.amount && m.state !== 'paid' && m.kind !== 'custpo' && (
                <button onClick={() => setEditing(true)} className="self-start text-[0.8125rem] font-semibold text-brand-600 hover:underline" data-bill-change>Change this bill</button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- purchase order popup ---------------- */
export function POModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const p = s.pos.find((x) => x.id === id)
  const [eta, setEta] = React.useState('Thu')
  const [said, setSaid] = React.useState('')
  const [back, setBack] = React.useState('Tomorrow')
  if (!p) return null
  const job = s.jobs[p.jobId]
  const cancelled = /cancelled/i.test(p.note)
  const header = (
    <div className="border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
      <div className="flex items-start gap-4 max-sm:flex-wrap max-sm:gap-2">
        <IconCircle tone={p.late ? 'bad' : 'info'} size={52} className="max-sm:hidden"><Package className="h-6 w-6" /></IconCircle>
        <div className="min-w-0 flex-1 max-sm:basis-full">
          <div className="flex flex-wrap items-center gap-2 text-[0.84375rem] text-muted">
            <button onClick={() => s.open({ t: 'job', id: p.jobId, tab: 'materials' })} className="font-semibold text-ink-2 hover:text-brand-700">{job?.name}</button>
            <span>·</span>
            <span>{p.what}</span>
          </div>
          <h2 className="h-tight mt-1 text-[1.4375rem] font-bold text-ink max-sm:text-[1.1875rem]">{p.id} · {p.supplier}</h2>
        </div>
        <div className="text-right max-sm:flex max-sm:items-baseline max-sm:gap-2 max-sm:text-left">
          <div className="text-[1.625rem] font-bold tnum text-ink max-sm:text-[1.375rem]">{fmtMoney(p.amount)}</div>
          <div className={cn('text-[0.8125rem] font-semibold', p.late ? 'text-bad-600' : 'text-muted')}>{p.eta || ''}</div>
        </div>
      </div>
      <div className="mt-5">{cancelled ? <div className="rounded-xl bg-wash-2 px-4 py-3 text-[0.875rem] text-ink-2">{p.note}</div> : <MiniSteps steps={PO_STEPS} at={p.step} late={p.late} />}</div>
    </div>
  )
  return (
    <Modal level={level} size="lg" onClose={s.close} header={header} title={p.id}>
      <div className="grid grid-cols-[1fr_19.375rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <div>
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="grid grid-cols-[1fr_7.5rem] bg-wash px-4 py-2.5 text-[0.78125rem] font-semibold text-muted"><span>Item</span><span className="text-right">Qty</span></div>
            {p.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_7.5rem] border-t border-line-2 px-4 py-3 text-[0.875rem]"><span className="font-medium text-ink">{l.item}</span><span className="text-right tnum text-ink-2">{l.qty}</span></div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-[0.84375rem] text-muted"><Truck className="h-4 w-4" />Deliver to {job?.address}</div>
          <div className="mt-6 text-[0.84375rem] font-semibold text-muted">Log</div>
          <div className="mt-3 flex flex-col">
            {[...p.log].reverse().map((l, i) => (
              <div key={i} className="flex gap-3 border-b border-line-2 py-2.5 last:border-0">
                <Avatar who={l.who} size={26} />
                <div>
                  <div className="text-[0.875rem] text-ink">{l.text}</div>
                  <div className="text-[0.78125rem] text-muted">{PEOPLE[l.who].name} · {l.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 self-start rounded-2xl border border-line bg-wash/60 p-4 max-md:order-first max-md:self-stretch">
          <div className="text-[0.84375rem] font-semibold text-muted">Next step</div>
          {cancelled ? (
            <div className="text-[0.875rem] text-ink-2">Nothing — this PO was replaced.</div>
          ) : p.step === 1 ? (
            <>
              <div className="text-[0.875rem] text-ink-2">Waiting for {p.supplier} to confirm.</div>
              <Field label="They confirmed — arriving">
                <DatePresets value={eta} onPick={setEta} presets={['Tomorrow', 'Thu', 'Fri', 'Next Mon']} />
              </Field>
              <Button full variant="primary" icon={<CheckCircle2 className="h-[1.125rem] w-[1.125rem]" />} onClick={() => confirmPO(p.id, eta)}>Mark confirmed</Button>
            </>
          ) : p.step === 2 ? (
            <>
              <Button full variant="primary" icon={<Truck className="h-[1.125rem] w-[1.125rem]" />} onClick={() => receivePO(p.id)}>Received — all here</Button>
              {p.late && (
                <div className="mt-2 rounded-xl border border-line bg-white p-3">
                  <div className="text-[0.84375rem] font-semibold text-ink">Followed up — what did they say?</div>
                  <TextInput className="mt-2" value={said} onChange={(e) => setSaid(e.target.value)} placeholder="e.g. Ships Thursday" />
                  <div className="mt-2.5"><DatePresets value={back} onPick={setBack} presets={['Tomorrow', 'Thu', 'Fri']} /></div>
                  <Button full className="mt-3" disabled={!said.trim()} onClick={() => { followUpPO(p.id, said.trim(), back); setSaid('') }}>Save — back {back}</Button>
                </div>
              )}
            </>
          ) : p.step === 3 ? (
            <Button full variant="primary" icon={<FileText className="h-[1.125rem] w-[1.125rem]" />} onClick={() => poNext(p.id)}>Supplier bill received</Button>
          ) : p.step === 4 ? (
            <Button full variant="primary" icon={<CircleDollarSign className="h-[1.125rem] w-[1.125rem]" />} onClick={() => poNext(p.id)}>Mark paid</Button>
          ) : (
            <div className="flex items-center gap-2 text-[0.875rem] font-semibold text-ok-600"><CheckCircle2 className="h-5 w-5" />Paid</div>
          )}
        </div>
      </div>
    </Modal>
  )
}

/* ---------------- new purchase order ---------------- */
const SUPPLIERS = ['Infinity', 'Metal Works Inc.', 'Best Tile']
const DEFAULT_LINES: Record<string, { item: string; qty: string }[]> = {
  '530': [{ item: 'Portland cement · 94 lb', qty: '12 bags' }, { item: 'Concrete sand · 50 lb', qty: '30 bags' }],
}
export function NewPOModal({ jobId, prefill, level }: { jobId: string; prefill?: any; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const [supplier, setSupplier] = React.useState(prefill?.supplier || 'Infinity')
  const [lines, setLines] = React.useState<{ item: string; qty: string }[]>(prefill?.lines || DEFAULT_LINES[jobId] || [{ item: 'LFT thinset · 50 lb', qty: '20 bags' }])
  const [needed, setNeeded] = React.useState('Thu')
  const amount = prefill?.amount || (jobId === '530' ? 410 : 780)
  if (!job) return null
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={`New purchase order · ${job.name}`}
      sub="Sent to the supplier from here — the PO number, confirmation and delivery are all tracked."
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">The supplier’s confirmation comes back as its own step — nothing to remember.</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Send className="h-[1.125rem] w-[1.125rem]" />} disabled={!lines.some((l) => l.item.trim())} onClick={() => createPO(jobId, { supplier, lines: lines.filter((l) => l.item.trim()), amount, what: prefill?.what || (jobId === '530' ? 'Floor prep' : 'Setting materials'), neededBy: needed, replaces: prefill?.replaces, tag: prefill?.tag, addQty: prefill?.addQty })}>
            Send PO to {supplier}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {prefill?.replaces && (
          <div className="flex items-center gap-3 rounded-2xl border border-warn-100 bg-warn-50/70 px-4 py-3 text-[0.875rem] text-ink-2">
            <AlertTriangle className="h-5 w-5 text-warn-600" /> This replaces {prefill.replaces}, which will be cancelled and kept in history.
          </div>
        )}
        <Field label="Supplier">
          <div className="flex flex-wrap gap-2">
            {SUPPLIERS.map((x) => (
              <Chip key={x} on={supplier === x} onClick={() => setSupplier(x)} icon={<Building2 className="h-4 w-4 text-muted" />}>{x}</Chip>
            ))}
          </div>
        </Field>
        <Field label="What to order" hint="Every line stays linked to the project and where it’s used.">
          <div className="overflow-hidden rounded-2xl border border-line">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_9.375rem_2.5rem] items-center gap-2 border-b border-line-2 p-2 last:border-0 max-sm:grid-cols-[1fr_5.75rem_2.25rem]">
                <TextInput value={l.item} onChange={(e) => setLines((p) => p.map((x, k) => (k === i ? { ...x, item: e.target.value } : x)))} className="border-transparent" />
                <TextInput value={l.qty} onChange={(e) => setLines((p) => p.map((x, k) => (k === i ? { ...x, qty: e.target.value } : x)))} className="border-transparent text-right" />
                <button onClick={() => setLines((p) => p.filter((_, k) => k !== i))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:bg-wash hover:text-bad-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button onClick={() => setLines((p) => [...p, { item: '', qty: '' }])} className="flex w-full items-center gap-2 px-4 py-3 text-[0.875rem] font-semibold text-brand-600 hover:bg-wash"><Plus className="h-4 w-4" />Add line</button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1 max-sm:gap-4">
          <Field label="Needed on site by"><DatePresets value={needed} onPick={setNeeded} presets={['Tomorrow', 'Thu', 'Fri', 'Next Mon']} /></Field>
          <Field label="Deliver to"><div className="flex h-11 items-center gap-2 rounded-xl border border-line bg-wash px-3.5 text-[0.875rem] text-ink-2"><Truck className="h-4 w-4 text-muted" />{job.address}</div></Field>
        </div>
      </div>
    </Modal>
  )
}

/** change a bill in place of its next step: what it's for and the amount — QuickBooks gets the change */
function BillEdit({ m, onDone }: { m: MoneyItem; onDone: () => void }) {
  const [title, setTitle] = React.useState(m.title)
  const [amount, setAmount] = React.useState(String(m.amount ?? ''))
  const n = Number(amount.replace(/[^0-9.]/g, ''))
  const ok = n > 0 && !!title.trim() && (n !== m.amount || title.trim() !== m.title)
  const inQb = qbLive() && !!m.qb?.id && !m.qb.gone
  return (
    <div className="flex flex-col gap-3" data-bill-edit>
      <div className="text-[0.84375rem] font-semibold text-muted">Change this bill</div>
      <Field label="What it’s for"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} aria-label="What it’s for" /></Field>
      <Field label="Amount"><TextInput inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" /></Field>
      {m.paid ? <div className="text-[0.78125rem] text-muted">{fmtMoney(m.paid)} is paid on it already.</div> : null}
      {m.bill && n !== m.amount && <div className="text-[0.78125rem] leading-snug text-muted">The breakdown from the daily updates stays as it was; the bill goes out with the new amount.</div>}
      <div className="flex gap-2">
        <Button className="flex-1" variant="primary" disabled={!ok} onClick={() => { changeBill(m.id, { amount: n, title }); onDone() }}>Save</Button>
        <Button className="flex-1" onClick={onDone}>Cancel</Button>
      </div>
      {inQb && <div className="text-[0.78125rem] text-muted">The invoice in QuickBooks changes the same way.</div>}
    </div>
  )
}
