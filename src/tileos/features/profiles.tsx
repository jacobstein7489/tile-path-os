/* Profiles — every client, designer, installer and supplier opens as its own record:
 * what's open with them right now, then everything we've ever done together, a tab at a time. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { Phone, Mail, MapPin, ChevronRight, CalendarDays, FileText, Building2, HardHat, Hourglass, Check, ShieldCheck, Truck, Package, Receipt, Footprints, Pencil } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore, type Store } from '@/tileos/store'
import { Avatar, Button, UnderlineTabs } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Status } from '@/tileos/components/ui/page'
import { TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, STAGE_LABEL, fmtMoney, type PersonKey, type Tone, type Job } from '@/tileos/data/model'
import { CUSTOMERS, TILES, tileOf } from '@/tileos/data/jobs'
import { allSubs } from '@/tileos/data/directory'
import { EST_STATUS, curRev, revTotal, estAmount, bucketOf, EST_STEP, type Estimate } from '@/tileos/data/estimates'
import { dayLabel, timeLabel, CAL_TODAY } from '@/tileos/data/calendar'
import { jobMoney } from './job/money-tab'
import { crewFree } from './upcoming'
import { PAY_WEEKS, THIS_WEEK, PAY_STATE, PAID_EARLIER, payRow } from './pay'
import { TODAY } from '@/tileos/lib/today'

const PRICING = ['request', 'estimating', 'proposal', 'followup']
const shortDate = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/* ================= the shared frame ================= */
type Kpi = { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'bad' | 'warn' | 'ok'; tab?: string }
function Profile({
  level, lead, kind, name, lines, kpis, tabs, tab, setTab, children, footer, onEdit,
}: {
  level: number
  lead: React.ReactNode
  kind: string
  name: string
  onEdit?: () => void
  lines: { icon: React.ReactNode; text: string; href?: string }[]
  kpis: Kpi[]
  tabs: { key: string; label: string; count?: number }[]
  tab: string
  setTab: (k: string) => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const s = useStore()
  const header = (
    <div className="border-b border-line px-7 pt-6 max-sm:px-4">
      <div className="flex items-start gap-4 pr-12">
        {lead}
        <div className="min-w-0 flex-1">
          <div className="text-[0.8125rem] font-medium text-muted">{kind}</div>
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 className="truncate text-[1.5625rem] font-bold leading-tight tracking-[-0.02em] text-ink max-sm:text-[1.3125rem]">{name}</h2>
            {onEdit && <button onClick={onEdit} aria-label="Change the details" title="Change the details" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint transition hover:bg-wash hover:text-ink"><Pencil className="h-4 w-4" /></button>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.84375rem] text-ink-2">
            {lines.map((l) => (
              <a key={l.text} href={l.href} onClick={(e) => !l.href && e.preventDefault()} className={cn('inline-flex min-w-0 items-center gap-1.5 [&_svg]:h-[0.9375rem] [&_svg]:w-[0.9375rem] [&_svg]:text-faint', l.href && 'hover:text-brand-700')}>
                {l.icon}<span className="truncate">{l.text}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-3 max-md:grid-cols-2">
        {kpis.map((k) => (
          <button key={k.label} onClick={() => k.tab && setTab(k.tab)} disabled={!k.tab} className={cn('rounded-xl border px-4 py-3 text-left transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-xs', k.tone === 'bad' ? 'border-bad-100 bg-bad-50' : k.tone === 'warn' ? 'border-warn-100 bg-warn-50' : 'border-line bg-wash')}>
            <div className="text-[0.78125rem] font-semibold text-muted">{k.label}</div>
            <div className={cn('mt-0.5 truncate text-[1.25rem] font-bold leading-tight tnum', k.tone === 'bad' ? 'text-bad-600' : k.tone === 'warn' ? 'text-warn-700' : 'text-ink')}>{k.value}</div>
            {k.sub && <div className="mt-0.5 truncate text-[0.78125rem] text-muted">{k.sub}</div>}
          </button>
        ))}
      </div>
      <UnderlineTabs className="mt-3" value={tab} onChange={setTab} items={tabs} />
    </div>
  )
  return (
    <Modal level={level} size="xl" tall onClose={s.close} header={header} footer={footer} title={name} bodyClass="px-7 py-5 max-sm:px-4">
      {children}
    </Modal>
  )
}
function Initials({ name, color }: { name: string; color: string }) {
  const ini = name.replace(/[^A-Za-z0-9 ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return <span className="inline-flex h-[3.5rem] w-[3.5rem] shrink-0 items-center justify-center rounded-2xl text-[1.1875rem] font-bold text-white shadow-xs" style={{ background: color }}>{ini}</span>
}

/** a list where each row opens something */
type Col<T> = { label: string; w?: number; right?: boolean; hide?: 'md' | 'lg'; cell: (r: T) => React.ReactNode }
function List<T>({ rows, cols, onRow, empty, keyOf }: { rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; empty: string; keyOf: (r: T) => string }) {
  const tpl = cols.map((c) => (c.w ? `${c.w}px` : 'minmax(0,1fr)')).join(' ')
  const hide = (c: Col<T>) => (c.hide === 'md' ? 'max-md:hidden' : c.hide === 'lg' ? 'max-lg:hidden' : '')
  if (!rows.length) return <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[0.875rem] text-muted">{empty}</div>
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid items-center gap-3 border-b border-line bg-wash px-4 py-2 text-[0.75rem] font-semibold text-muted max-md:!grid-cols-[minmax(0,1fr)_auto]" style={{ gridTemplateColumns: tpl }}>
        {cols.map((c) => <span key={c.label} className={cn(c.right && 'text-right', hide(c))}>{c.label}</span>)}
      </div>
      {rows.map((r) => (
        <button key={keyOf(r)} onClick={() => onRow?.(r)} disabled={!onRow} className="grid w-full items-center gap-3 border-b border-line-2 px-4 py-2.5 text-left text-[0.875rem] last:border-0 enabled:hover:bg-wash max-md:!grid-cols-[minmax(0,1fr)_auto]" style={{ gridTemplateColumns: tpl }}>
          {cols.map((c) => <span key={c.label} className={cn('min-w-0', c.right && 'text-right', hide(c))}>{c.cell(r)}</span>)}
        </button>
      ))}
    </div>
  )
}
const Two = ({ title, sub }: { title: React.ReactNode; sub?: React.ReactNode }) => (
  <span className="block min-w-0 leading-tight">
    <span className="block truncate text-[0.875rem] font-medium text-ink">{title}</span>
    {sub && <span className="mt-0.5 block truncate text-[0.78125rem] text-muted">{sub}</span>}
  </span>
)
const Money = ({ n, muted }: { n: number | null | undefined; muted?: boolean }) => <span className={cn('tnum', muted ? 'text-muted' : 'font-semibold text-ink')}>{n ? fmtMoney(n) : '—'}</span>
function Section({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-[0.90625rem] font-bold text-ink">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}
/** one open thing in an overview: what it is, where it stands, click to open */
function OpenRow({ icon, title, sub, right, tone = 'neutral', onClick }: { icon: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; tone?: Tone; onClick?: () => void }) {
  const tint: Record<string, string> = { bad: 'bg-bad-50 text-bad-600', warn: 'bg-warn-50 text-warn-700', ok: 'bg-ok-50 text-ok-700', info: 'bg-brand-50 text-brand-600', vio: 'bg-vio-50 text-vio-600', neutral: 'bg-wash-2 text-ink-2' }
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 border-b border-line-2 py-2.5 text-left last:border-0">
      <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl [&_svg]:h-[1.0625rem] [&_svg]:w-[1.0625rem]', tint[tone])}>{icon}</span>
      <Two title={title} sub={sub} />
      <span className="ml-auto shrink-0 text-right text-[0.8125rem]">{right}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink-2" />
    </button>
  )
}
const estLabel = (s: Store, e: Estimate) => {
  const b = bucketOf(e)
  if (b === 'takeoff' || b === 'review' || b === 'final') return { label: `${e.status === 'revision' ? 'Revision needed' : 'Estimating'} · ${EST_STEP[b].label}`, tone: e.status === 'revision' ? 'warn' as const : EST_STEP[b].tone }
  return { label: EST_STATUS[e.status].label, tone: EST_STATUS[e.status].tone }
}
const estWhen = (e: Estimate) => (e.status === 'approved' ? `Approved ${e.approvedOn}` : e.status === 'sent' ? `Follow up ${e.followUp || 'Thu'}` : e.due ? `Due ${e.due}` : '')
const EstList = ({ s, ests }: { s: Store; ests: Estimate[] }) => (
  <List
    rows={[...ests].sort((a, b) => b.id.localeCompare(a.id))}
    keyOf={(e) => e.id}
    onRow={(e) => s.open({ t: 'estimate', id: e.id })}
    empty="No estimates yet."
    cols={[
      { label: 'Estimate', cell: (e) => <Two title={s.jobs[e.jobId]?.name} sub={`${e.id}${curRev(e).n > 1 ? ` · revision ${curRev(e).n}` : ''}`} /> },
      { label: 'Where it is', w: 170, hide: 'md', cell: (e) => { const x = estLabel(s, e); return <Status tone={x.tone}>{x.label}</Status> } },
      { label: 'When', w: 150, hide: 'lg', cell: (e) => <span className="text-[0.8125rem] text-muted">{estWhen(e)}</span> },
      { label: 'Amount', w: 110, right: true, cell: (e) => <Money n={['estimating', 'revision'].includes(e.status) ? revTotal(curRev(e)) : estAmount(e)} /> },
    ]}
  />
)
const ProjectList = ({ s, jobs, showClient }: { s: Store; jobs: Job[]; showClient?: boolean }) => (
  <List
    rows={jobs}
    keyOf={(j) => j.id}
    onRow={(j) => s.open({ t: 'job', id: j.id })}
    empty="No projects yet."
    cols={[
      { label: 'Project', cell: (j) => <Two title={j.name} sub={showClient ? j.client : j.address} /> },
      { label: 'Stage', w: 130, hide: 'md', cell: (j) => <Status tone={j.stage === 'complete' ? 'ok' : j.status === 'bad' ? 'bad' : j.status === 'warn' ? 'warn' : 'info'}>{STAGE_LABEL[j.stage]}</Status> },
      { label: 'Installed', w: 120, hide: 'lg', cell: (j) => <span className="flex items-center gap-2"><span className="h-1.5 w-14 overflow-hidden rounded-full bg-wash-2"><span className="block h-full rounded-full bg-ok-500" style={{ width: `${j.pct || 0}%` }} /></span><span className="text-[0.78125rem] tnum text-muted">{j.pct || 0}%</span></span> },
      { label: 'Invoiced', w: 110, right: true, hide: 'lg', cell: (j) => <span className="text-[0.8125rem] tnum text-muted">{jobMoney(j).billedPct}%</span> },
      { label: 'Contract', w: 110, right: true, cell: (j) => <Money n={jobMoney(j).contract} /> },
    ]}
  />
)

/* ================= a client ================= */
export function ClientProfile({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const [tab, setTab] = React.useState('overview')
  const c = CUSTOMERS[id]
  if (!c) return null
  const js = Object.values(s.jobs).filter((j) => j.clientId === id)
  const won = js.filter((j) => !PRICING.includes(j.stage))
  const live = won.filter((j) => j.stage !== 'complete')
  const ests = s.estimates.filter((e) => s.jobs[e.jobId]?.clientId === id)
  const out = ests.filter((e) => e.status === 'sent')
  const working = ests.filter((e) => ['request', 'estimating', 'revision'].includes(e.status))
  const money = s.money.filter((m) => s.jobs[m.jobId]?.clientId === id && m.state !== 'upcoming' && m.kind !== 'custpo')
  const openMoney = money.filter((m) => m.state === 'waiting')
  const toCollect = openMoney.reduce((n, m) => n + (m.amount || 0) - (m.paid || 0), 0)
  const contract = live.reduce((n, j) => n + jobMoney(j).contract, 0)
  const invoiced = won.reduce((n, j) => n + jobMoney(j).invoiced, 0)
  const paid = won.reduce((n, j) => n + jobMoney(j).paid, 0)
  const waitingOn = s.tasks.filter((t) => t.state === 'waiting' && js.some((j) => j.id === t.jobId) && /gc|client|owner/i.test(t.waitingOn || ''))
  const designers = s.designers.filter((d) => d.clients.includes(id))
  const tabs = [
    { key: 'overview', label: 'Now' },
    { key: 'projects', label: 'Projects', count: won.length },
    { key: 'estimates', label: 'Estimates', count: ests.length },
    { key: 'billing', label: 'Billing', count: money.length },
    { key: 'people', label: 'People', count: c.contacts.length },
  ]
  return (
    <Profile
      level={level}
      lead={<Initials name={c.name} color="#2650cf" />}
      kind={`Client · ${c.kind}`}
      name={c.name}
      onEdit={() => s.open({ t: 'newclient', id })}
      lines={[{ icon: <Phone />, text: c.phone, href: `tel:${c.phone}` }, { icon: <Mail />, text: c.email, href: `mailto:${c.email}` }, { icon: <MapPin />, text: c.address }]}
      kpis={[
        { label: 'Open projects', value: live.length, sub: `${won.length} won with us`, tab: 'projects' },
        { label: 'Estimates with them', value: out.length ? fmtMoney(out.reduce((n, e) => n + estAmount(e), 0)) : '—', sub: `${out.length} waiting · ${working.length} in the works`, tab: 'estimates' },
        { label: 'Under contract', value: contract ? fmtMoney(contract) : '—', sub: contract ? `${fmtMoney(invoiced)} invoiced so far` : 'Nothing open', tab: 'projects' },
        { label: 'Open to collect', value: toCollect ? fmtMoney(toCollect) : '—', sub: `${openMoney.length} ${openMoney.length === 1 ? 'invoice' : 'invoices'} out`, tone: openMoney.some((m) => m.dueTone === 'bad' || m.dueTone === 'warn') ? 'warn' : undefined, tab: 'billing' },
      ]}
      tabs={tabs}
      tab={tab}
      setTab={setTab}
    >
      {tab === 'overview' && (
        <div className="grid grid-cols-[minmax(0,1fr)_18.75rem] gap-8 max-lg:grid-cols-1">
          <Section title="Open with them">
            {out.map((e) => <OpenRow key={e.id} icon={<FileText />} tone="info" title={`${s.jobs[e.jobId].name} · ${e.id}`} sub={`Estimate with them · follow up ${e.followUp || 'Thu'}`} right={<Money n={estAmount(e)} />} onClick={() => s.open({ t: 'estimate', id: e.id })} />)}
            {working.map((e) => { const x = estLabel(s, e); return <OpenRow key={e.id} icon={<FileText />} tone={x.tone} title={`${s.jobs[e.jobId].name} · ${e.id}`} sub={`We’re pricing it · ${x.label.toLowerCase()}`} right={<Money n={revTotal(curRev(e))} muted />} onClick={() => s.open({ t: 'estimate', id: e.id })} /> })}
            {openMoney.map((m) => <OpenRow key={m.id} icon={<Receipt />} tone={m.dueTone === 'bad' ? 'bad' : 'warn'} title={`${s.jobs[m.jobId].name} · ${m.title}`} sub={`${m.ref ? `Invoice ${m.ref} · ` : ''}${m.due || 'Waiting for payment'}`} right={<Money n={(m.amount || 0) - (m.paid || 0)} />} onClick={() => s.open({ t: 'money', id: m.id })} />)}
            {waitingOn.map((t) => <OpenRow key={t.id} icon={<Hourglass />} tone="warn" title={t.title} sub={`${s.jobs[t.jobId]?.name} · we’re waiting on them · back ${t.followUp}`} onClick={() => s.open({ t: 'task', id: t.id })} />)}
            {live.map((j) => <OpenRow key={j.id} icon={<Building2 />} tone={j.status === 'bad' ? 'bad' : 'ok'} title={j.name} sub={`${STAGE_LABEL[j.stage]} · ${j.headline}`} right={<span className="tnum text-muted">{j.pct || 0}%</span>} onClick={() => s.open({ t: 'job', id: j.id })} />)}
            {!out.length && !working.length && !openMoney.length && !live.length && <div className="py-6 text-[0.875rem] text-muted">Nothing open with them right now.</div>}
          </Section>
          <div className="flex flex-col gap-6">
            <Section title="Who we deal with">
              {c.contacts.slice(0, 3).map((p) => (
                <div key={p.name} className="border-b border-line-2 py-2 last:border-0">
                  <div className="text-[0.875rem] font-medium text-ink">{p.name}</div>
                  <div className="text-[0.78125rem] text-muted">{p.role} · {p.phone}</div>
                </div>
              ))}
            </Section>
            {designers.length > 0 && (
              <Section title="Their designer">
                {designers.map((d) => <button key={d.id} onClick={() => s.open({ t: 'designer', id: d.id })} className="flex w-full items-center gap-2 py-1.5 text-left text-[0.875rem] font-medium text-brand-700 hover:underline">{d.name}<ChevronRight className="h-4 w-4" /></button>)}
              </Section>
            )}
            <Section title="Money so far">
              <dl className="flex flex-col gap-1.5 text-[0.84375rem]">
                <div className="flex justify-between"><dt className="text-muted">Invoiced</dt><dd className="font-medium tnum text-ink">{fmtMoney(invoiced)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Paid</dt><dd className="font-medium tnum text-ink">{fmtMoney(paid)}</dd></div>
                <div className="flex justify-between border-t border-line-2 pt-1.5"><dt className="text-muted">Open</dt><dd className="font-bold tnum text-ink">{fmtMoney(invoiced - paid)}</dd></div>
              </dl>
            </Section>
            {c.notes && <Section title="Notes"><p className="text-[0.84375rem] leading-relaxed text-ink-2">{c.notes}</p></Section>}
          </div>
        </div>
      )}
      {tab === 'projects' && <ProjectList s={s} jobs={won} />}
      {tab === 'estimates' && <EstList s={s} ests={ests} />}
      {tab === 'billing' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
            {[{ l: 'Invoiced', v: invoiced }, { l: 'Paid', v: paid }, { l: 'Open', v: invoiced - paid }].map((x) => (
              <div key={x.l} className="rounded-xl bg-wash px-4 py-3"><div className="text-[0.78125rem] font-semibold text-muted">{x.l}</div><div className="text-[1.1875rem] font-bold tnum text-ink">{fmtMoney(x.v)}</div></div>
            ))}
          </div>
          <List
            rows={money}
            keyOf={(m) => m.id}
            onRow={(m) => s.open({ t: 'money', id: m.id })}
            empty="Nothing billed yet."
            cols={[
              { label: 'Invoice', w: 90, hide: 'md', cell: (m) => <span className="text-[0.8125rem] tnum text-muted">{m.ref || 'Not sent'}</span> },
              { label: 'Project · bill', cell: (m) => <Two title={s.jobs[m.jobId]?.name} sub={m.title} /> },
              { label: 'Status', w: 170, hide: 'md', cell: (m) => <Status tone={m.state === 'paid' ? 'ok' : m.state === 'todo' ? 'warn' : 'info'}>{m.state === 'paid' ? 'Paid' : m.state === 'todo' ? 'Ready to invoice' : m.paid ? 'Part paid' : 'Waiting for payment'}</Status> },
              { label: 'When', w: 140, hide: 'lg', cell: (m) => <span className="text-[0.8125rem] text-muted">{m.state === 'paid' ? m.date : m.due}</span> },
              { label: 'Amount', w: 110, right: true, cell: (m) => <Money n={m.amount} /> },
            ]}
          />
        </div>
      )}
      {tab === 'people' && (
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          {c.contacts.map((p) => (
            <div key={p.name} className="rounded-xl border border-line p-4">
              <div className="text-[0.9375rem] font-semibold text-ink">{p.name}</div>
              <div className="text-[0.8125rem] text-muted">{p.role}</div>
              <div className="mt-2 flex flex-col gap-1 text-[0.84375rem] text-ink-2">
                <a href={`tel:${p.phone}`} className="inline-flex items-center gap-2 hover:text-brand-700"><Phone className="h-4 w-4 text-faint" />{p.phone}</a>
                <a href={`mailto:${p.email}`} className="inline-flex items-center gap-2 hover:text-brand-700"><Mail className="h-4 w-4 text-faint" />{p.email}</a>
              </div>
            </div>
          ))}
        </div>
      )}
    </Profile>
  )
}

/* ================= a designer ================= */
export function DesignerProfile({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const [tab, setTab] = React.useState('overview')
  const d = s.designers.find((x) => x.id === id)
  if (!d) return null
  const js = Object.values(s.jobs).filter((j) => d.clients.includes(j.clientId))
  const won = js.filter((j) => !PRICING.includes(j.stage))
  const ests = s.estimates.filter((e) => js.some((j) => j.id === e.jobId))
  const waits = s.tasks.filter((t) => t.state !== 'done' && js.some((j) => j.id === t.jobId) && /designer/i.test(`${t.title} ${t.waitingOn || ''}`))
  const meetings = s.events.filter((e) => e.date >= CAL_TODAY && e.jobId && js.some((j) => j.id === e.jobId)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
  /* every tile on their clients' projects, with where it goes */
  const picks: Record<string, { job: Job; tag: string; where: string[] }> = {}
  won.forEach((j) => (s.rooms[j.id] || []).forEach((r) => r.surfaces.forEach((x) => {
    if (!x.tile || !tileOf(j.id, x.tile)) return
    const p = (picks[j.id + '|' + x.tile] ||= { job: j, tag: x.tile, where: [] })
    p.where.push(`${r.name} · ${x.name}`)
  })))
  const tiles = Object.keys(picks).sort((a, b) => picks[a].job.name.localeCompare(picks[b].job.name) || picks[a].tag.localeCompare(picks[b].tag, undefined, { numeric: true }))
  return (
    <Profile
      level={level}
      lead={<Initials name={d.name} color="#6938ef" />}
      kind={d.contact && d.contact !== 'Designer' ? `Designer · ${d.contact}` : 'Designer'}
      name={d.name}
      lines={[{ icon: <Phone />, text: d.phone, href: `tel:${d.phone}` }, { icon: <Mail />, text: d.email, href: `mailto:${d.email}` }, { icon: <Building2 />, text: d.clients.map((c) => CUSTOMERS[c]?.name).join(' · ') }]}
      kpis={[
        { label: 'Projects', value: won.length, sub: `${won.filter((j) => j.stage !== 'complete').length} open`, tab: 'projects' },
        { label: 'Waiting on them', value: waits.length || '—', sub: waits.length ? 'answers and selections' : 'Nothing open', tone: waits.length ? 'warn' : undefined, tab: 'overview' },
        { label: 'Meetings coming', value: meetings.length || '—', sub: meetings[0] ? `${dayLabel(meetings[0].date)} ${timeLabel(meetings[0].start)}` : 'None on the agenda', tab: 'overview' },
        { label: 'Tile picks', value: tiles.length || '—', sub: 'on their projects', tab: 'tiles' },
      ]}
      tabs={[
        { key: 'overview', label: 'Now' },
        { key: 'projects', label: 'Projects', count: won.length },
        { key: 'tiles', label: 'Tile picks', count: tiles.length },
        { key: 'estimates', label: 'Estimates', count: ests.length },
      ]}
      tab={tab}
      setTab={setTab}
    >
      {tab === 'overview' && (
        <div className="grid grid-cols-[minmax(0,1fr)_18.75rem] gap-8 max-lg:grid-cols-1">
          <Section title="Waiting on them">
            {waits.map((t) => <OpenRow key={t.id} icon={<Hourglass />} tone="warn" title={t.title} sub={`${s.jobs[t.jobId]?.name}${t.state === 'waiting' ? ` · back ${t.followUp}` : t.due ? ` · ${t.due}` : ''}`} onClick={() => s.open({ t: 'task', id: t.id })} />)}
            {!waits.length && <div className="py-4 text-[0.875rem] text-muted">Nothing waiting on them.</div>}
            <h3 className="mb-2 mt-6 text-[0.90625rem] font-bold text-ink">Meetings coming</h3>
            {meetings.map((e) => <OpenRow key={e.id} icon={e.kind === 'walkthrough' ? <Footprints /> : <CalendarDays />} tone="info" title={e.title} sub={`${s.jobs[e.jobId!]?.name} · ${dayLabel(e.date)} ${timeLabel(e.start)}`} onClick={() => s.open({ t: 'event', id: e.id })} />)}
            {!meetings.length && <div className="py-4 text-[0.875rem] text-muted">None on the agenda.</div>}
          </Section>
          <div className="flex flex-col gap-6">
            <Section title="Their clients">
              {d.clients.map((c) => <button key={c} onClick={() => s.open({ t: 'customer', id: c })} className="flex w-full items-center gap-2 py-1.5 text-left text-[0.875rem] font-medium text-brand-700 hover:underline">{CUSTOMERS[c]?.name}<ChevronRight className="h-4 w-4" /></button>)}
            </Section>
            {d.notes && <Section title="How to work with them"><p className="text-[0.84375rem] leading-relaxed text-ink-2">{d.notes}</p></Section>}
          </div>
        </div>
      )}
      {tab === 'projects' && <ProjectList s={s} jobs={won} showClient />}
      {tab === 'estimates' && <EstList s={s} ests={ests} />}
      {tab === 'tiles' && (
        tiles.length ? (
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            {tiles.map((k) => {
              const p = picks[k]
              const t = tileOf(p.job.id, p.tag)!
              return (
                <div key={k} className="flex gap-3.5 rounded-xl border border-line p-3.5">
                  <TileImg tile={t} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.90625rem] font-semibold text-ink">{p.tag} · {t.name}</div>
                    <div className="text-[0.78125rem] text-muted">{[t.size, t.finish, t.maker].filter(Boolean).join(' · ')}</div>
                    <button onClick={() => s.open({ t: 'job', id: p.job.id, tab: 'scope' })} className="mt-1.5 block w-full truncate text-left text-[0.78125rem] text-ink-2 hover:text-brand-700"><b className="font-semibold">{p.job.name}</b> · {p.where.slice(0, 3).join(', ')}{p.where.length > 3 ? ` +${p.where.length - 3}` : ''}</button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-[0.875rem] text-muted">No tile picked on their projects yet.</div>
      )}
    </Profile>
  )
}

/* ================= an installer ================= */
export function InstallerProfile({ id, level }: { id: PersonKey; level: number }) {
  const s = useStore()
  const [tab, setTab] = React.useState('overview')
  const info = allSubs().find((x) => x.crew === id)
  if (!info) return null
  const bks = s.bookings.filter((b) => b.crew === id).sort((a, b) => a.start.localeCompare(b.start))
  const now = bks.find((b) => b.start <= TODAY && b.end >= TODAY)
  const next = bks.filter((b) => b.start > TODAY)
  const free = crewFree(s).find((f) => f.crew === id)
  const ipos = s.ipos.filter((p) => p.crew === id)
  const openPOs = ipos.filter((p) => p.status === 'Draft' || p.status === 'Sent')
  const poTotal = (p: (typeof ipos)[number]) => p.lines.reduce((n, l) => n + l.amount, 0) + p.changes.filter((c) => c.status !== 'pending').reduce((n, c) => n + c.amount, 0)
  const weeks = [THIS_WEEK, ...PAY_WEEKS].map((w) => ({ w, r: payRow(s, id, w) })).filter((x) => x.r)
  const last = payRow(s, id, PAY_WEEKS[0])
  const picked = Object.entries(s.prep).filter(([, p]) => p.installer === id).map(([jid]) => s.jobs[jid]).filter((j) => j && !s.bookings.some((b) => b.crew === id && b.jobId === j.id))
  const lastUpdate = now ? s.diary[now.jobId]?.find((e) => e.who === id) : undefined
  const earlier = ipos.reduce((n, p) => n + (PAID_EARLIER[p.id] || 0), 0)
  const paidWeeks = weeks.filter((x) => x.r && ['approved', 'paid'].includes(x.r.state)).reduce((n, x) => n + (x.r?.owe || 0), 0)
  return (
    <Profile
      level={level}
      lead={<Avatar who={id} size={56} />}
      kind={`Installer · ${info.trade}${info.region ? ` · ${info.region}` : ''}`}
      name={PEOPLE[id].name}
      lines={[{ icon: <HardHat />, text: now ? `On ${s.jobs[now.jobId]?.name} · ${now.workers || 2} people` : 'Not on a job' }, { icon: <CalendarDays />, text: free ? (free.iso === TODAY ? 'Free now' : `Free from ${shortDate(free.iso)}`) : '' }].filter((l) => l.text)}
      kpis={[
        { label: 'Working now', value: now ? s.jobs[now.jobId]?.name : 'Free', sub: now ? `${now.label} · till ${shortDate(now.end)}` : free?.iso === TODAY ? 'Ready for a job' : '', tab: 'schedule' },
        { label: 'Last week’s pay', value: last ? fmtMoney(last.calc.total) : '—', sub: last ? PAY_STATE[last.state].label : 'No work last week', tone: last?.state === 'check' ? 'bad' : undefined, tab: 'pay' },
        { label: 'Installer POs', value: ipos.length, sub: openPOs.length ? `${openPOs.length} waiting for him` : `${fmtMoney(ipos.reduce((n, p) => n + poTotal(p), 0))} in all`, tone: openPOs.length ? 'warn' : undefined, tab: 'pos' },
        { label: 'Paperwork', value: '2 missing', sub: 'Insurance · W-9', tone: 'warn', tab: 'papers' },
      ]}
      tabs={[
        { key: 'overview', label: 'Now' },
        { key: 'schedule', label: 'Schedule', count: bks.length },
        { key: 'pos', label: 'POs', count: ipos.length },
        { key: 'pay', label: 'Pay', count: weeks.length },
        { key: 'papers', label: 'Paperwork' },
      ]}
      tab={tab}
      setTab={setTab}
    >
      {tab === 'overview' && (
        <div className="grid grid-cols-[minmax(0,1fr)_18.75rem] gap-8 max-lg:grid-cols-1">
          <Section title="Now">
            {now ? (
              <OpenRow icon={<HardHat />} tone="ok" title={s.jobs[now.jobId]?.name} sub={`${now.label} · ${now.workers || 2} people · ${shortDate(now.start)} – ${shortDate(now.end)}`} right={<span className="tnum text-muted">{s.jobs[now.jobId]?.pct || 0}%</span>} onClick={() => s.open({ t: 'job', id: now.jobId })} />
            ) : <div className="py-3 text-[0.875rem] text-muted">Not on a job today.</div>}
            {lastUpdate && <OpenRow icon={<FileText />} tone="neutral" title={`Last daily update · ${lastUpdate.date}`} sub={lastUpdate.rooms.map((r) => `${r.room}: ${r.items.map((i) => `${i.surface} to ${i.to}%`).join(', ')}`).join(' · ')} onClick={() => s.open({ t: 'job', id: now!.jobId, tab: 'scope' })} />}
            {last && <OpenRow icon={<Receipt />} tone={PAY_STATE[last.state].tone === 'bad' ? 'bad' : PAY_STATE[last.state].tone === 'ok' ? 'ok' : 'warn'} title={`Pay · week of ${PAY_WEEKS[0].label}`} sub={`${PAY_STATE[last.state].label}${last.bill ? ` · his bill ${fmtMoney(last.bill.amount)}` : ''}`} right={<Money n={last.calc.total} />} onClick={() => s.open({ t: 'pay', crew: id, week: PAY_WEEKS[0].key })} />}
            {openPOs.map((p) => <OpenRow key={p.id} icon={<Package />} tone="warn" title={`${p.id} · ${s.jobs[p.jobId]?.name}`} sub={p.status === 'Draft' ? 'Draft — not sent yet' : 'Sent — waiting for his answer'} right={<Money n={poTotal(p)} />} onClick={() => s.open({ t: 'ipo', id: p.id })} />)}
            <h3 className="mb-2 mt-6 text-[0.90625rem] font-bold text-ink">Next</h3>
            {next.map((b) => <OpenRow key={b.id} icon={<CalendarDays />} tone="info" title={s.jobs[b.jobId]?.name} sub={`${b.label} · from ${shortDate(b.start)}`} onClick={() => s.open({ t: 'booking', id: b.id })} />)}
            {picked.map((j) => <OpenRow key={j.id} icon={<CalendarDays />} tone="vio" title={j.name} sub="Picked on the game plan — not booked yet" onClick={() => s.open({ t: 'job', id: j.id })} />)}
            {!next.length && !picked.length && <div className="py-3 text-[0.875rem] text-muted">Nothing booked after this.</div>}
          </Section>
          <div className="flex flex-col gap-6">
            <Section title="Paid this year">
              <div className="text-[1.375rem] font-bold tnum text-ink">{fmtMoney(earlier + paidWeeks)}</div>
              <div className="text-[0.78125rem] text-muted">Approved weekly pay and earlier payments in QuickBooks{smp(' · sample')}</div>
            </Section>
            <Section title="Rates on his POs">
              {Array.from(new Map(ipos.flatMap((p) => p.lines.filter((l) => l.rate).map((l) => [l.item, l.rate!] as const))).entries()).map(([item, rate]) => (
                <div key={item} className="flex justify-between border-b border-line-2 py-1.5 text-[0.84375rem] last:border-0"><span className="truncate text-ink-2">{item.split(' — ')[0]}</span><span className="tnum text-ink">${rate}/SF</span></div>
              ))}
            </Section>
          </div>
        </div>
      )}
      {tab === 'schedule' && (
        <List
          rows={bks}
          keyOf={(b) => b.id}
          onRow={(b) => s.open({ t: 'booking', id: b.id })}
          empty="Nothing booked."
          cols={[
            { label: 'Project', cell: (b) => <Two title={s.jobs[b.jobId]?.name} sub={b.label} /> },
            { label: 'People', w: 90, hide: 'md', cell: (b) => <span className="text-[0.84375rem] tnum text-ink-2">{b.workers || 2}</span> },
            { label: 'Dates', w: 150, right: true, cell: (b) => <span className="text-[0.84375rem] tnum text-ink-2">{shortDate(b.start)} – {shortDate(b.end)}</span> },
            { label: 'Status', w: 120, hide: 'md', cell: (b) => <Status tone={b.end < TODAY ? 'neutral' : b.start <= TODAY ? 'ok' : 'info'}>{b.end < TODAY ? 'Done' : b.start <= TODAY ? 'On site' : 'Booked'}</Status> },
          ]}
        />
      )}
      {tab === 'pos' && (
        <List
          rows={ipos}
          keyOf={(p) => p.id}
          onRow={(p) => s.open({ t: 'ipo', id: p.id })}
          empty="No POs yet."
          cols={[
            { label: 'PO', cell: (p) => <Two title={`${p.id} · ${s.jobs[p.jobId]?.name}`} sub={`${p.lines.length} lines${p.changes.length ? ` · ${p.changes.length} changes` : ''}`} /> },
            { label: 'Status', w: 150, hide: 'md', cell: (p) => <Status tone={p.status === 'Accepted' ? 'ok' : p.status === 'Rejected' ? 'bad' : 'warn'}>{p.status === 'Sent' ? 'Waiting for him' : p.status}</Status> },
            { label: 'Paid so far', w: 120, right: true, hide: 'lg', cell: (p) => { const paid = (PAID_EARLIER[p.id] || 0) + weeks.filter((x) => x.r && ['approved', 'paid'].includes(x.r.state)).reduce((n, x) => n + x.r!.calc.lines.filter((l) => l.jobId === p.jobId).reduce((m, l) => m + (l.amount || 0), 0), 0); return <Money n={paid} muted /> } },
            { label: 'PO total', w: 110, right: true, cell: (p) => <Money n={poTotal(p)} /> },
          ]}
        />
      )}
      {tab === 'pay' && (
        <List
          rows={weeks.map((x) => x.r!)}
          keyOf={(r) => r.week.key}
          onRow={(r) => s.open({ t: 'pay', crew: id, week: r.week.key })}
          empty="No weekly pay yet."
          cols={[
            { label: 'Week', cell: (r) => <Two title={`Week of ${r.week.label}`} sub={`${r.calc.days} days · ${r.calc.sf} SF · ${r.calc.jobs.map((j) => s.jobs[j]?.name).join(', ')}`} /> },
            { label: 'His bill', w: 120, right: true, hide: 'md', cell: (r) => (r.bill ? <span className={cn('tnum', r.state === 'check' || r.state === 'asked' ? 'font-semibold text-bad-600' : 'text-ink-2')}>{fmtMoney(r.bill.amount)}</span> : <span className="text-[0.8125rem] text-faint">No bill</span>) },
            { label: 'Status', w: 170, hide: 'md', cell: (r) => <Status tone={PAY_STATE[r.state].tone}>{PAY_STATE[r.state].label}</Status> },
            { label: 'From the updates', w: 140, right: true, cell: (r) => <Money n={r.calc.total} /> },
          ]}
        />
      )}
      {tab === 'papers' && (
        <div className="flex flex-col gap-3">
          {[{ name: 'Insurance certificate', sub: 'General liability · we’re listed as additional insured' }, { name: 'W-9', sub: 'For the 1099 at year end' }, { name: 'Workers’ comp', sub: 'Or a signed exemption' }].map((d, i) => (
            <div key={d.name} className="flex items-center gap-4 rounded-xl border border-line px-4 py-3">
              <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-xl', i < 2 ? 'bg-warn-50 text-warn-700' : 'bg-ok-50 text-ok-700')}>{i < 2 ? <ShieldCheck className="h-5 w-5" /> : <Check className="h-5 w-5" />}</span>
              <Two title={d.name} sub={d.sub} />
              {i < 2 ? (
                <span className="ml-auto flex items-center gap-3"><Status tone="warn">Not on file</Status><Button size="sm" onClick={() => toast.success(`Asked ${PEOPLE[id].short} for the ${d.name.toLowerCase()} — it comes back here when he sends it`)}>Ask for it</Button></span>
              ) : <span className="ml-auto"><Status tone="ok">On file · Jan 2026</Status></span>}
            </div>
          ))}
        </div>
      )}
    </Profile>
  )
}

/* ================= a supplier ================= */
export function SupplierProfile({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const [tab, setTab] = React.useState('overview')
  const info = s.suppliers.find((x) => x.name === id)
  if (!info) return null
  const pos = s.pos.filter((p) => p.supplier === id)
  const open = pos.filter((p) => p.step >= 1 && p.step < 3 && !/cancelled/i.test(p.note))
  const late = pos.filter((p) => p.late)
  const items = s.items.filter((i) => i.vendor === id)
  const tile = s.checks.filter((c) => c.supplier === id)
  const tileOpen = tile.filter((c) => c.received < c.ordered)
  const spent = pos.filter((p) => !/cancelled/i.test(p.note)).reduce((n, p) => n + p.amount, 0)
  const tileJobs = new Set(tile.map((c) => c.jobId)).size
  const tabs = [
    { key: 'overview', label: 'Now' },
    ...(pos.length ? [{ key: 'pos', label: 'Purchase orders', count: pos.length }] : []),
    ...(items.length ? [{ key: 'items', label: 'What we pay', count: items.length }] : []),
    ...(tile.length ? [{ key: 'tile', label: 'Tile orders', count: tile.length }] : []),
  ]
  return (
    <Profile
      level={level}
      lead={<Initials name={info.name} color="#0e9384" />}
      kind="Supplier"
      name={info.name}
      lines={[{ icon: <Truck />, text: info.supplies || 'What we buy — not set' }, ...(info.contact || info.phone ? [{ icon: <Phone />, text: [info.contact, info.phone].filter(Boolean).join(' · '), href: info.phone ? `tel:${info.phone}` : undefined }] : []), ...(info.email ? [{ icon: <Mail />, text: info.email, href: `mailto:${info.email}` }] : [])]}
      footer={<Button className="ml-auto" icon={<Pencil />} onClick={() => s.open({ t: 'supplierform', name: info.name })}>Edit the supplier</Button>}
      kpis={pos.length ? [
        { label: 'Open POs', value: open.length || '—', sub: open.length ? fmtMoney(open.reduce((n, p) => n + p.amount, 0)) : 'Nothing on order', tab: 'pos' },
        { label: 'Late', value: late.length || '—', sub: late[0] ? `${late[0].id} · ${s.jobs[late[0].jobId]?.name}` : 'Nothing late', tone: late.length ? 'bad' : undefined, tab: 'pos' },
        { label: 'Spent this year', value: spent ? fmtMoney(spent) : '—', sub: `${pos.length} POs${smp(' · sample')}`, tab: 'pos' },
        { label: 'Items we buy', value: items.length || '—', sub: 'priced from QuickBooks', tab: items.length ? 'items' : undefined },
      ] : [
        { label: 'Tile orders', value: tile.length, sub: 'ordered by the GC', tab: 'tile' },
        { label: 'Not all in', value: tileOpen.length || '—', sub: tileOpen[0] ? `next ${tileOpen.map((c) => c.eta).filter(Boolean)[0]}` : 'Everything received', tone: tileOpen.length ? 'warn' : undefined, tab: 'tile' },
        { label: 'Projects', value: tileJobs, sub: 'with tile from them', tab: 'tile' },
        { label: 'Our POs', value: '—', sub: 'the GC buys the tile' },
      ]}
      tabs={tabs}
      tab={tab}
      setTab={setTab}
    >
      {tab === 'overview' && (
        <Section title="Open with them">
          {late.map((p) => <OpenRow key={p.id} icon={<Truck />} tone="bad" title={`${p.id} · ${p.what}`} sub={`${s.jobs[p.jobId]?.name} · late · ${p.eta}`} right={<Money n={p.amount} />} onClick={() => s.open({ t: 'po', id: p.id })} />)}
          {open.filter((p) => !p.late).map((p) => <OpenRow key={p.id} icon={<Truck />} tone={p.step === 1 ? 'warn' : 'info'} title={`${p.id} · ${p.what}`} sub={`${s.jobs[p.jobId]?.name} · ${p.step === 1 ? 'waiting to confirm' : `arriving ${p.eta}`}`} right={<Money n={p.amount} />} onClick={() => s.open({ t: 'po', id: p.id })} />)}
          {tileOpen.map((c) => <OpenRow key={c.jobId + c.tag} icon={<Package />} tone="warn" title={`${c.tag} · ${s.jobs[c.jobId]?.name}`} sub={`${c.received} of ${c.ordered} ${c.unit} in${c.eta ? ` · rest ${c.eta}` : ''} · ${c.where}`} onClick={() => s.open({ t: 'job', id: c.jobId, tab: 'orders' })} />)}
          {!late.length && !open.length && !tileOpen.length && <div className="py-6 text-[0.875rem] text-muted">Nothing open with them.</div>}
        </Section>
      )}
      {tab === 'pos' && (
        <List
          rows={[...pos].sort((a, b) => b.id.localeCompare(a.id))}
          keyOf={(p) => p.id}
          onRow={(p) => s.open({ t: 'po', id: p.id })}
          empty="No POs from us — tile is ordered by the GC."
          cols={[
            { label: 'PO', cell: (p) => <Two title={`${p.id} · ${p.what}`} sub={s.jobs[p.jobId]?.name} /> },
            { label: 'Status', w: 170, hide: 'md', cell: (p) => <Status tone={/cancelled/i.test(p.note) ? 'neutral' : p.late ? 'bad' : p.step >= 3 ? 'ok' : p.step === 2 ? 'info' : 'warn'}>{/cancelled/i.test(p.note) ? 'Cancelled' : p.late ? 'Late' : ['Draft', 'Waiting to confirm', 'Confirmed', 'Delivered', 'Bill in', 'Paid'][p.step] || 'Paid'}</Status> },
            { label: 'Date', w: 100, hide: 'lg', cell: (p) => <span className="text-[0.8125rem] text-muted">{p.date || p.log[0]?.date}</span> },
            { label: 'Amount', w: 110, right: true, cell: (p) => <Money n={p.amount} /> },
          ]}
        />
      )}
      {tab === 'items' && (
        <List
          rows={items}
          keyOf={(i) => i.id}
          onRow={(i) => s.open({ t: 'item', id: i.id })}
          empty="No items."
          cols={[
            { label: 'Item', cell: (i) => <Two title={i.name} sub={`QuickBooks · ${i.qb}`} /> },
            { label: 'Last paid', w: 140, right: true, cell: (i) => <span className="tnum font-semibold text-ink">{fmtMoney(i.cost, { cents: i.cost % 1 !== 0 })} / {i.unit}</span> },
          ]}
        />
      )}
      {tab === 'tile' && (
        <List
          rows={tile}
          keyOf={(c) => c.jobId + c.tag}
          onRow={(c) => s.open({ t: 'job', id: c.jobId, tab: 'orders' })}
          empty="No tile orders."
          cols={[
            { label: 'Tile · project', cell: (c) => <Two title={`${c.tag} · ${tileOf(c.jobId, c.tag)?.name || ''} · ${s.jobs[c.jobId]?.name}`} sub={c.where} /> },
            { label: 'In', w: 130, right: true, cell: (c) => <span className={cn('tnum', c.received < c.ordered ? 'font-semibold text-warn-700' : 'text-ink-2')}>{c.received} of {c.ordered} {c.unit}</span> },
            { label: 'Rest', w: 100, hide: 'md', cell: (c) => <span className="text-[0.8125rem] text-muted">{c.received < c.ordered ? c.eta || '—' : 'All in'}</span> },
          ]}
        />
      )}
    </Profile>
  )
}
