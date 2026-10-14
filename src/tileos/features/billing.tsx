/* Billing — money coming in: deposits, progress bills, change orders, final bills and retainage.
 * Invoices go out from here; QuickBooks gets a copy. Every row opens its record. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { RefreshCw, Send, Hourglass, CalendarClock, CircleCheckBig, Building2, Layers, TrendingUp } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Page, Filter, ToolbarSearch, ClearFilters, Table, Th, Tr, Td, EmptyRow, Status, Bubbles } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, type Tone } from '@/tileos/data/model'
import { MONEY_STEPS, MONEY_KIND_LABEL, type MoneyItem, type MoneyKind } from '@/tileos/data/work'
import { billingOf } from './job/money-tab'
import { ProgressToolbar, ProgressList } from './progress-page'
import { billsToMake, billTotal, LAST_WEEK } from './progressbill'

type BTab = 'progress' | 'todo' | 'waiting' | 'upcoming' | 'paid' | 'jobs'
const stepLabel = (m: MoneyItem) => (m.step < 0 ? 'Not open yet' : MONEY_STEPS[m.kind][Math.min(m.step, MONEY_STEPS[m.kind].length - 1)])
/** where a bill is, in plain words */
const statusOf = (m: MoneyItem) => {
  if (m.state === 'upcoming') return m.step < 0 ? 'Not billable yet' : 'Opens soon'
  if (m.state === 'todo') return m.kind === 'change' ? 'Change · to bill' : m.kind === 'retainage' ? 'Ready to request' : 'Ready to invoice'
  if (m.kind === 'custpo') return 'Requested'
  if (m.paid) return 'Partly paid'
  if (m.kind === 'progress' && m.step === 2) return 'With the GC'
  if (m.kind === 'progress' && m.step < 2) return stepLabel(m)
  return 'Awaiting payment'
}
const tone = (m: MoneyItem): Tone => (m.state === 'paid' ? 'ok' : m.state === 'todo' ? (m.dueTone === 'bad' ? 'bad' : 'warn') : m.state === 'waiting' ? (m.dueTone === 'warn' || m.dueTone === 'bad' ? 'warn' : 'info') : 'neutral')

export function BillingPage() {
  const s = useStore()
  /* the week's progress comes first when there's something to bill — it's the billing person's weekly job */
  const [tab, setTab] = React.useState<BTab>(() => (s.route.tab === 'progress' || billsToMake(s).length ? 'progress' : 'todo'))
  const [week, setWeek] = React.useState(LAST_WEEK.key)
  React.useEffect(() => { if (s.route.tab === 'progress') { setTab('progress'); setWeek(LAST_WEEK.key) } }, [s.route])
  const toMake = billsToMake(s)
  const [kind, setKind] = React.useState('all')
  const [job, setJob] = React.useState('all')
  const [q, setQ] = React.useState('')
  const [synced, setSynced] = React.useState('5 min ago')
  const scoped = s.money.filter((m) => (kind === 'all' || m.kind === kind) && (job === 'all' || m.jobId === job) && (!q || `${m.title} ${s.jobs[m.jobId]?.name} ${m.ref || ''}`.toLowerCase().includes(q.toLowerCase())))
  const by = (st: MoneyItem['state']) => scoped.filter((m) => m.state === st)
  const open = (l: MoneyItem[]) => l.reduce((n, m) => n + (m.amount ? m.amount - (m.paid || 0) : 0), 0)
  const list = tab === 'jobs' || tab === 'progress' ? [] : by(tab)
  const jobs = Array.from(new Set(s.money.map((m) => m.jobId))).filter((id) => s.jobs[id])
  const sub: Record<BTab, string> = {
    progress: 'What got installed each week, from the daily updates — and what to bill for it',
    todo: `${fmtMoney(open(by('todo')))} ready to bill`,
    waiting: `${fmtMoney(open(by('waiting')))} we’re waiting on`,
    upcoming: 'Opens by itself when the work or approval is in',
    paid: `${fmtMoney(by('paid').reduce((n, m) => n + (m.amount || 0), 0))} received`,
    jobs: 'Installed against billed and paid, per project',
  }
  return (
    <Page
      title="Billing"
      sub={<>Invoices go out from here and sync to QuickBooks. {sub[tab]}{smp(' · sample amounts')}</>}
      actions={<Button icon={<RefreshCw />} onClick={() => setSynced('just now')}>QuickBooks synced {synced}</Button>}
      top={
        <Bubbles
          arrows
          items={[
            { key: 'progress', label: 'Progress to bill', count: toMake.length, sub: toMake.length ? fmtMoney(toMake.reduce((n, r) => n + billTotal(r), 0)) : undefined, icon: <TrendingUp />, color: 'teal', on: tab === 'progress', onClick: () => setTab('progress') },
            { key: 'upcoming', label: 'Coming up', count: by('upcoming').length, icon: <CalendarClock />, color: 'slate', on: tab === 'upcoming', onClick: () => setTab('upcoming') },
            { key: 'todo', label: 'To invoice', count: by('todo').length, sub: fmtMoney(open(by('todo'))), icon: <Send />, color: 'amber', on: tab === 'todo', onClick: () => setTab('todo') },
            { key: 'waiting', label: 'Waiting for payment', count: by('waiting').length, sub: fmtMoney(open(by('waiting'))), icon: <Hourglass />, color: 'blue', on: tab === 'waiting', onClick: () => setTab('waiting') },
            { key: 'paid', label: 'Paid', count: by('paid').length, icon: <CircleCheckBig />, color: 'green', on: tab === 'paid', onClick: () => setTab('paid') },
            { key: 'jobs', label: 'By project', count: Object.values(s.jobs).filter((j) => billingOf(j).contract > 0).length, icon: <Building2 />, color: 'violet', on: tab === 'jobs', onClick: () => setTab('jobs'), gapBefore: true },
          ]}
        />
      }
      toolbar={
        tab === 'progress' ? <ProgressToolbar week={week} onWeek={setWeek} /> : tab === 'jobs' ? <span className="text-[0.9375rem] font-semibold text-ink">Installed, billed and paid — per project</span> : (
          <>
            <span className="mr-2 text-[0.9375rem] font-semibold text-ink">{{ progress: '', todo: 'To invoice', waiting: 'Waiting for payment', upcoming: 'Coming up', paid: 'Paid', jobs: '' }[tab]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{list.length}</span></span>
            <Filter icon={<Layers />} label="Type" value={kind} options={(Object.keys(MONEY_KIND_LABEL) as MoneyKind[]).map((k) => ({ key: k, label: MONEY_KIND_LABEL[k] }))} onChange={setKind} />
            <Filter icon={<Building2 />} label="Project" value={job} options={jobs.map((id) => ({ key: id, label: s.jobs[id].name }))} onChange={setJob} width={260} />
            <ClearFilters show={kind !== 'all' || job !== 'all' || !!q} onClear={() => { setKind('all'); setJob('all'); setQ('') }} />
            <ToolbarSearch value={q} onChange={setQ} placeholder="Search billing" />
          </>
        )
      }
    >
      {tab === 'progress' ? (
        <ProgressList week={week} />
      ) : tab !== 'jobs' ? (
        <Table minWidth={900}>
          <thead>
            <tr>
              <Th w={104} className="max-md:hidden">Invoice</Th>
              <Th>Project · bill</Th>
              <Th w={200} className="max-xl:hidden">Client · PO · estimate</Th>
              <Th w={128} right className="max-md:hidden">Amount</Th>
              <Th w={170} className="max-md:hidden">Status</Th>
              <Th w={180} className="max-lg:hidden">When</Th>
              {tab === 'todo' && <Th w={150} className="max-lg:hidden" />}
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const j = s.jobs[m.jobId]
              return (
                <Tr key={m.id} onClick={() => s.open({ t: 'money', id: m.id })}>
                  <Td className="max-md:hidden">
                    {m.ref ? (
                      <span className="inline-flex h-7 items-center rounded-md bg-wash-2 px-2 text-[0.8125rem] font-semibold tnum text-ink">{m.ref}</span>
                    ) : (
                      <span className="text-[0.8125rem] text-faint">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="truncate text-[0.875rem] font-semibold text-ink">{j?.name}</div>
                    <div className="truncate text-[0.78125rem] text-muted">{m.title}<span className="md:hidden"> · {m.amount ? fmtMoney(m.amount) : '—'}</span></div>
                  </Td>
                  <Td className="max-xl:hidden">
                    <div className="truncate text-[0.84375rem] text-ink-2">{j?.client}</div>
                    <div className="truncate text-[0.75rem] text-muted">{[j?.clientPO ? `PO ${j.clientPO}` : '', s.estimates.find((e) => e.jobId === m.jobId && e.status === 'approved')?.id].filter(Boolean).join(' · ') || 'No client PO yet'}</div>
                  </Td>
                  <Td right className="max-md:hidden">
                    <div className="text-[0.90625rem] font-semibold tnum text-ink">{m.amount ? fmtMoney(m.amount) : '—'}</div>
                    {m.paid && m.state !== 'paid' ? <div className="text-[0.75rem] text-muted">{fmtMoney(m.amount! - m.paid)} open</div> : null}
                  </Td>
                  <Td className="max-md:hidden"><Status tone={tone(m)}>{m.state === 'paid' ? `Paid ${m.date || ''}` : statusOf(m)}</Status></Td>
                  <Td className={cn('truncate text-[0.84375rem] max-lg:hidden', m.state !== 'paid' && m.dueTone === 'bad' ? 'font-medium text-bad-700' : m.state !== 'paid' && m.dueTone === 'warn' ? 'text-warn-700' : 'text-muted')}>{m.state === 'paid' ? m.date : m.due}</Td>
                  {tab === 'todo' && (
                    <Td right className="max-lg:hidden">
                      {m.action && <Button size="xs" variant="outline" onClick={(e) => { e.stopPropagation(); s.open({ t: 'money', id: m.id }) }}>{m.action}</Button>}
                    </Td>
                  )}
                </Tr>
              )
            })}
            {!list.length && <EmptyRow colSpan={7} title={tab === 'todo' ? 'Nothing to send — every bill is out' : tab === 'waiting' ? 'Nobody owes us anything right now' : 'Nothing here'} />}
          </tbody>
        </Table>
      ) : (
        <ByProject />
      )}
    </Page>
  )
}

function ByProject() {
  const s = useStore()
  const rows = Object.values(s.jobs).filter((j) => billingOf(j).contract > 0)
  return (
    <Table minWidth={860}>
      <thead>
        <tr>
          <Th>Project</Th>
          <Th w={130} right className="max-md:hidden">Contract</Th>
          <Th w={110} right className="max-md:hidden">Installed</Th>
          <Th w={100} right className="max-md:hidden">Billed</Th>
          <Th w={100} right className="max-lg:hidden">Paid</Th>
          <Th w={120} right className="max-lg:hidden">Retainage</Th>
          <Th w={190} className="max-xl:hidden" />
        </tr>
      </thead>
      <tbody>
        {rows.map((j) => {
          const b = billingOf(j)
          return (
            <Tr key={j.id} onClick={() => s.open({ t: 'job', id: j.id, tab: 'money' })}>
              <Td>
                <div className="truncate text-[0.875rem] font-medium text-ink">{j.name}</div>
                <div className="truncate text-[0.78125rem] text-muted">{j.client}<span className="md:hidden"> · {b.installedPct}% in · {b.billedPct}% billed</span></div>
              </Td>
              <Td right className="tnum text-ink max-md:hidden">{fmtMoney(b.contract + b.changes)}</Td>
              <Td right className="tnum max-md:hidden">{b.installedPct}%</Td>
              <Td right className="tnum max-md:hidden">{b.billedPct}%</Td>
              <Td right className="tnum max-lg:hidden">{b.paidPct}%</Td>
              <Td right className="tnum text-muted max-lg:hidden">{b.retainage ? fmtMoney(b.retainage) : '—'}</Td>
              <Td className="max-xl:hidden">{b.toBill > 0 ? <Status tone="warn">{fmtMoney(b.toBill)} to bill</Status> : <Status tone="ok" plain>Billing caught up</Status>}</Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )
}
