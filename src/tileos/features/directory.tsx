/* The directory: clients, designers, subs (our installers), suppliers — and the items we buy and sell.
 * Same page every time: big header, filters on top, one list; every row opens the whole record. */
import * as React from 'react'
import { RefreshCw, Plus, Upload, Building2, PenTool, HardHat, Truck, Boxes, Hammer, Package, Shapes, FileClock, CircleDollarSign, Hourglass, CalendarCheck, HandCoins, AlarmClock, Archive, MoreHorizontal, ArchiveRestore } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore } from '@/tileos/store'
import { Button, Avatar, TextInput } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem } from '@/tileos/components/ui/overlay'
import { isOff, setActive, type DirKind } from './active'
import { Page, Filter, ToolbarSearch, ClearFilters, Table, Th, Tr, Td, EmptyRow, Status, Bubbles, type BubbleColor } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, STAGE_LABEL, fmtMoney, roleDef, type PersonKey } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { allSubs, type SupplierInfo } from '@/tileos/data/directory'
import { ITEM_TYPE_LABEL, type ItemType } from '@/tileos/data/items'
import { crewFree } from './upcoming'
import { PAY_WEEKS, PAY_STATE, payRow } from './pay'
import { TODAY, MONDAY, addDays } from '@/tileos/lib/today'
import { MoreReach, cleanReach, reachOk } from './reach'
import type { Reach } from '@/tileos/data/model'

const DONE = ['complete']
const PRICING = ['request', 'estimating', 'proposal', 'followup']

/* ================= the people we work with: four lists, each its own menu item ================= */
type DirKey = 'clients' | 'designers' | 'subs' | 'suppliers'
const DIR_META: Record<DirKey, { label: string; icon: React.ReactNode; color: BubbleColor; sub: string }> = {
  clients: { label: 'Clients', icon: <Building2 />, color: 'blue', sub: 'GCs, developers and owners we build for' },
  designers: { label: 'Designers', icon: <PenTool />, color: 'violet', sub: 'The designers behind the tile choices' },
  subs: { label: 'Installers', icon: <HardHat />, color: 'orange', sub: 'Our crews — where they are, when they’re free, their POs' },
  suppliers: { label: 'Suppliers', icon: <Truck />, color: 'teal', sub: 'Who we buy from — open POs and late deliveries' },
}
export function DirectoryPage({ first }: { first: string }) {
  const s = useStore()
  const nav = roleDef(s.role).nav
  const lists = (['clients', 'designers', 'subs', 'suppliers'] as DirKey[]).filter((k) => nav.includes(k))
  const which: DirKey = lists.includes(first as DirKey) ? (first as DirKey) : lists[0]
  if (which === 'designers') return <DesignersPage />
  if (which === 'subs') return <SubsPage />
  if (which === 'suppliers') return <SuppliersPage />
  return <ClientsPage />
}

/** the ⋯ at the end of a row: mark inactive, or bring back */
function ActiveMenu({ kind, id, name }: { kind: DirKind; id: string; name: string }) {
  const s = useStore()
  const off = isOff(s, kind, id)
  return (
    <span onClick={(e) => e.stopPropagation()} className="flex justify-end">
      <Menu align="end" width={240} trigger={<button aria-label={`More · ${name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-faint transition hover:bg-wash-2 hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
        {off
          ? <MenuItem icon={<ArchiveRestore className="h-4 w-4" />} onSelect={() => setActive(kind, id, name, true)}>Make active again</MenuItem>
          : <MenuItem icon={<Archive className="h-4 w-4" />} hint="Off the lists and pickers — history stays" onSelect={() => setActive(kind, id, name, false)}>Mark inactive</MenuItem>}
      </Menu>
    </span>
  )
}
const offBubble = (n: number, on: boolean, onClick: () => void) => ({ key: 'off', label: 'Inactive', count: n, icon: <Archive />, color: 'slate' as BubbleColor, on, onClick, gapBefore: true })

/* ================= clients ================= */
export function ClientsPage() {
  const s = useStore()
  type ClientTab = 'all' | 'active' | 'estimates' | 'owe' | 'off'
  const linked = (t?: string): ClientTab | null => (t && ['all', 'active', 'estimates', 'owe', 'off'].includes(t) ? (t as ClientTab) : null)
  const [tab, setTab] = React.useState<ClientTab>(() => linked(s.route.tab) || 'active')
  /* a link to one view (after an import: All clients) opens it even when Clients is already open */
  React.useEffect(() => { const t = linked(s.route.tab); if (t) setTab(t) }, [s.route.tab])
  const [kind, setKind] = React.useState('all')
  const [q, setQ] = React.useState('')
  const every = Object.values(CUSTOMERS)
  const offList = every.filter((c) => isOff(s, 'client', c.id))
  const all = tab === 'off' ? offList : every.filter((c) => !isOff(s, 'client', c.id))
  const jobsOf = (id: string) => Object.values(s.jobs).filter((j) => j.clientId === id)
  const active = (id: string) => jobsOf(id).some((j) => !DONE.includes(j.stage))
  /* invoiced and not paid yet — ready-to-invoice isn't owed until it's sent */
  const owed = (id: string) => s.money.filter((m) => s.jobs[m.jobId]?.clientId === id && m.state === 'waiting').reduce((n, m) => n + (m.amount ? m.amount - (m.paid || 0) : 0), 0)
  const estOut = (id: string) => s.estimates.filter((e) => e.status === 'sent' && s.jobs[e.jobId]?.clientId === id).length
  const inTab = (id: string) => tab === 'all' || tab === 'off' || (tab === 'active' ? active(id) : tab === 'estimates' ? estOut(id) > 0 : owed(id) > 0)
  const list = all.filter((c) => inTab(c.id) && (kind === 'all' || c.kind === kind) && (!q || `${c.name} ${c.kind} ${c.contacts.map((p) => p.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  const kinds = Array.from(new Set(all.map((c) => c.kind)))
  const pick = (k: typeof tab) => () => setTab(tab === k ? 'all' : k)
  const live = every.filter((c) => !isOff(s, 'client', c.id))
  const owedAll = live.reduce((n, c) => n + owed(c.id), 0)
  return (
    <Page
      title="Clients"
      actions={<><Button icon={<Upload />} onClick={() => s.open({ t: 'importclients' })} data-import-clients data-import="client">Import</Button><Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newclient' })}>New client</Button></>}
      top={
        <Bubbles
          items={[
            { key: 'all', label: 'All clients', count: live.length, icon: <Building2 />, color: 'slate', on: tab === 'all', onClick: () => setTab('all') },
            { key: 'active', label: 'With open work', count: live.filter((c) => active(c.id)).length, icon: <Hammer />, color: 'blue', on: tab === 'active', onClick: pick('active') },
            { key: 'estimates', label: 'Estimates with them', count: live.filter((c) => estOut(c.id) > 0).length, icon: <FileClock />, color: 'cyan', on: tab === 'estimates', onClick: pick('estimates') },
            { key: 'owe', label: 'Owe us money', count: live.filter((c) => owed(c.id) > 0).length, sub: owedAll ? fmtMoney(owedAll) : undefined, icon: <CircleDollarSign />, color: 'amber', on: tab === 'owe', onClick: pick('owe') },
            offBubble(offList.length, tab === 'off', pick('off')),
          ]}
        />
      }
      toolbar={
        <>
          <span className="bar-title mr-2 text-[0.9375rem] font-semibold text-ink">{{ all: 'All clients', active: 'With open work', estimates: 'Estimates with them', owe: 'Owe us money', off: 'Inactive clients' }[tab]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{list.length}</span></span>
          <Filter label="Type" value={kind} options={kinds.map((k) => ({ key: k, label: k }))} onChange={setKind} />
          <ClearFilters show={kind !== 'all' || !!q} onClear={() => { setKind('all'); setQ('') }} />
          <ToolbarSearch value={q} onChange={setQ} placeholder="Search clients" />
        </>
      }
    >
      <Table minWidth={820}>
        <thead>
          <tr>
            <Th>Client</Th>
            <Th w={170} className="max-lg:hidden">Main contact</Th>
            <Th w={150} className="max-md:hidden">Phone</Th>
            <Th w={150} className="max-md:hidden">Projects</Th>
            <Th w={130} right className="max-lg:hidden">Open to collect</Th>
            <Th w={52} />
          </tr>
        </thead>
        <tbody>
          {list.map((c) => {
            const js = jobsOf(c.id)
            const live = js.filter((j) => !DONE.includes(j.stage))
            const pricing = live.filter((j) => PRICING.includes(j.stage)).length
            const o = owed(c.id)
            return (
              <Tr key={c.id} onClick={() => s.open({ t: 'customer', id: c.id })}>
                <Td>
                  <div className="truncate text-[0.875rem] font-medium text-ink">{c.name}</div>
                  <div className="truncate text-[0.78125rem] text-muted">{c.kind}<span className="md:hidden"> · {live.length} open</span></div>
                </Td>
                <Td className="truncate text-[0.84375rem] max-lg:hidden">{c.contacts[0]?.role || '—'}</Td>
                <Td className="text-[0.84375rem] tnum max-md:hidden">{c.phone}</Td>
                <Td className="text-[0.84375rem] max-md:hidden">{live.length ? `${live.length - pricing} active${pricing ? ` · ${pricing} pricing` : ''}` : <span className="text-muted">None open</span>}</Td>
                <Td right className={cn('tnum max-lg:hidden', o ? 'text-ink' : 'text-faint')}>{o ? fmtMoney(o) : '—'}</Td>
                <Td><ActiveMenu kind="client" id={c.id} name={c.name} /></Td>
              </Tr>
            )
          })}
          {!list.length && <EmptyRow colSpan={6} title={tab === 'off' ? 'No inactive clients' : 'No clients match'} />}
        </tbody>
      </Table>
    </Page>
  )
}

/* ================= designers ================= */
export function DesignersPage() {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const [tab, setTab] = React.useState<'all' | 'waiting' | 'active' | 'off'>('all')
  const waitsOf = (d: (typeof s.designers)[number]) => s.tasks.filter((t) => t.state !== 'done' && /designer/i.test(`${t.title} ${t.waitingOn || ''}`) && d.clients.includes(s.jobs[t.jobId]?.clientId)).length
  const activeOf = (d: (typeof s.designers)[number]) => Object.values(s.jobs).some((j) => d.clients.includes(j.clientId) && !DONE.includes(j.stage) && !PRICING.includes(j.stage))
  const live = s.designers.filter((d) => !isOff(s, 'designer', d.id))
  const offList = s.designers.filter((d) => isOff(s, 'designer', d.id))
  const list = (tab === 'off' ? offList : live).filter((d) => (tab === 'all' || tab === 'off' || (tab === 'waiting' ? waitsOf(d) > 0 : activeOf(d))) && (!q || `${d.name} ${d.contact}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <Page
      title="Designers"
      actions={<><Button icon={<Upload />} onClick={() => s.open({ t: 'import', kind: 'designer' })} data-import="designer">Import</Button><Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'designerform' })}>New designer</Button></>}
      top={
        <Bubbles
          items={[
            { key: 'all', label: 'All designers', count: live.length, icon: <PenTool />, color: 'slate', on: tab === 'all', onClick: () => setTab('all') },
            { key: 'waiting', label: 'Waiting on them', count: live.filter((d) => waitsOf(d) > 0).length, icon: <Hourglass />, color: 'amber', on: tab === 'waiting', onClick: () => setTab(tab === 'waiting' ? 'all' : 'waiting') },
            { key: 'active', label: 'On open projects', count: live.filter(activeOf).length, icon: <Hammer />, color: 'violet', on: tab === 'active', onClick: () => setTab(tab === 'active' ? 'all' : 'active') },
            offBubble(offList.length, tab === 'off', () => setTab(tab === 'off' ? 'all' : 'off')),
          ]}
        />
      }
      toolbar={
        <>
          <span className="bar-title mr-2 text-[0.9375rem] font-semibold text-ink">{{ all: 'All designers', waiting: 'Waiting on them', active: 'On open projects', off: 'Inactive designers' }[tab]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{list.length}</span></span>
          <ToolbarSearch value={q} onChange={setQ} placeholder="Search designers" />
        </>
      }
    >
      <Table minWidth={760}>
        <thead>
          <tr>
            <Th>Designer</Th>
            <Th w={150} className="max-md:hidden">Phone</Th>
            <Th w={240} className="max-lg:hidden">Clients</Th>
            <Th w={230} className="max-md:hidden">Waiting on them</Th>
            <Th w={52} />
          </tr>
        </thead>
        <tbody>
          {list.map((d) => {
            const waits = waitsOf(d)
            return (
              <Tr key={d.id} onClick={() => s.open({ t: 'designer', id: d.id })}>
                <Td>
                  <div className="truncate text-[0.875rem] font-medium text-ink">{d.name}</div>
                  <div className="truncate text-[0.78125rem] text-muted">{d.contact} · {d.email}</div>
                </Td>
                <Td className="text-[0.84375rem] tnum max-md:hidden">{d.phone}</Td>
                <Td className="truncate text-[0.84375rem] max-lg:hidden">{d.clients.map((c) => CUSTOMERS[c]?.name).join(', ')}</Td>
                <Td className="max-md:hidden">{waits ? <Status tone="warn">{waits} open item{waits > 1 ? 's' : ''}</Status> : <span className="text-[0.84375rem] text-faint">Nothing</span>}</Td>
                <Td><ActiveMenu kind="designer" id={d.id} name={d.name} /></Td>
              </Tr>
            )
          })}
          {!list.length && <EmptyRow colSpan={5} title={tab === 'off' ? 'No inactive designers' : 'No designers match'} />}
        </tbody>
      </Table>
    </Page>
  )
}
/* ================= subs — our installers ================= */
export function SubsPage() {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const [tab, setTab] = React.useState<'all' | 'working' | 'free' | 'pay' | 'off'>('all')
  const free = crewFree(s)
  const working = (c: PersonKey) => s.bookings.some((b) => b.crew === c && b.start <= TODAY && b.end >= TODAY)
  const freeSoon = (c: PersonKey) => { const f = free.find((y) => y.crew === c); return !!f && f.iso <= addDays(MONDAY, 4) }
  const payOpenFor = (c: PersonKey) => { const r = payRow(s, c, PAY_WEEKS[0]); return !!r && !['approved', 'paid'].includes(r.state) }
  const inTab = (c: PersonKey) => tab === 'all' || tab === 'off' || (tab === 'working' ? working(c) : tab === 'free' ? freeSoon(c) : payOpenFor(c))
  const subs = allSubs()
  const live = subs.filter((x) => !isOff(s, 'crew', x.crew))
  const offList = subs.filter((x) => isOff(s, 'crew', x.crew))
  const list = (tab === 'off' ? offList : live).filter((x) => inTab(x.crew as PersonKey) && (!q || PEOPLE[x.crew as PersonKey].name.toLowerCase().includes(q.toLowerCase())))
  const pick = (k: typeof tab) => () => setTab(tab === k ? 'all' : k)
  return (
    <Page
      title="Installers"
      actions={<><Button icon={<Upload />} onClick={() => s.open({ t: 'import', kind: 'installer' })} data-import="installer">Import</Button><Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'installerform' })}>New installer</Button></>}
      top={
        <Bubbles
          items={[
            { key: 'all', label: 'All installers', count: live.length, icon: <HardHat />, color: 'slate', on: tab === 'all', onClick: () => setTab('all') },
            { key: 'working', label: 'Working now', count: live.filter((x) => working(x.crew as PersonKey)).length, icon: <Hammer />, color: 'green', on: tab === 'working', onClick: pick('working') },
            { key: 'free', label: 'Free this week', count: live.filter((x) => freeSoon(x.crew as PersonKey)).length, icon: <CalendarCheck />, color: 'blue', on: tab === 'free', onClick: pick('free') },
            { key: 'pay', label: 'Pay to approve', count: live.filter((x) => payOpenFor(x.crew as PersonKey)).length, icon: <HandCoins />, color: 'amber', on: tab === 'pay', onClick: pick('pay') },
            offBubble(offList.length, tab === 'off', pick('off')),
          ]}
        />
      }
      toolbar={
        <>
          <span className="bar-title mr-2 text-[0.9375rem] font-semibold text-ink">{{ all: 'All installers', working: 'Working now', free: 'Free this week', pay: 'Pay to approve', off: 'Inactive installers' }[tab]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{list.length}</span></span>
          <ToolbarSearch value={q} onChange={setQ} placeholder="Search installers" />
        </>
      }
    >
      <Table minWidth={860}>
        <thead>
          <tr>
            <Th>Installer</Th>
            <Th w={230} className="max-md:hidden">Working now</Th>
            <Th w={120} className="max-lg:hidden">Free from</Th>
            <Th w={170} className="max-md:hidden">Installer POs</Th>
            <Th w={210} className="max-xl:hidden">Last week’s pay</Th>
            <Th w={52} />
          </tr>
        </thead>
        <tbody>
          {list.map((x) => {
            const crew = x.crew as PersonKey
            const now = s.bookings.find((b) => b.crew === crew && b.start <= TODAY && b.end >= TODAY)
            const f = free.find((y) => y.crew === crew)!
            const ipos = s.ipos.filter((p) => p.crew === crew)
            const open = ipos.filter((p) => p.status === 'Draft' || p.status === 'Sent').length
            return (
              <Tr key={crew} onClick={() => s.open({ t: 'sub', id: crew })}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar who={crew} size={28} />
                    <div className="min-w-0">
                      <div className="truncate text-[0.875rem] font-medium text-ink">{PEOPLE[crew].name}</div>
                      <div className="truncate text-[0.78125rem] text-muted">{x.trade}{x.region ? ` · ${x.region}` : ''}</div>
                    </div>
                  </div>
                </Td>
                <Td className="max-md:hidden">{now ? <span className="text-[0.84375rem] text-ink-2">{s.jobs[now.jobId]?.name} <span className="text-muted">· {now.workers || 2} people</span></span> : <Status tone="ok">Free</Status>}</Td>
                <Td className="text-[0.84375rem] max-lg:hidden">{f.iso === TODAY ? 'Now' : new Date(f.iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Td>
                <Td className="text-[0.84375rem] max-md:hidden">{ipos.length ? `${ipos.length} PO${ipos.length > 1 ? 's' : ''}${open ? ` · ${open} open` : ''}` : <span className="text-faint">None</span>}</Td>
                <Td className="max-xl:hidden">{(() => { const r = payRow(s, crew, PAY_WEEKS[0]); return r ? <span className="inline-flex items-center gap-2 text-[0.84375rem]"><span className="font-semibold tnum text-ink">{fmtMoney(r.calc.total)}</span><Status tone={PAY_STATE[r.state].tone}>{r.state === 'check' ? 'Check bill' : r.state === 'ready' ? 'To approve' : PAY_STATE[r.state].label}</Status></span> : <span className="text-[0.84375rem] text-faint">—</span> })()}</Td>
                <Td><ActiveMenu kind="crew" id={crew} name={PEOPLE[crew].name} /></Td>
              </Tr>
            )
          })}
          {!list.length && <EmptyRow colSpan={6} title={tab === 'off' ? 'No inactive installers' : 'No installers match'} />}
        </tbody>
      </Table>
    </Page>
  )
}
/* ================= suppliers ================= */
export function SuppliersPage() {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const [tab, setTab] = React.useState<'all' | 'open' | 'late' | 'off'>('all')
  const openOf = (n: string) => s.pos.filter((p) => p.supplier === n && p.step >= 1 && p.step < 3 && !/cancelled/i.test(p.note)).length + s.checks.filter((c) => c.supplier === n && c.received < c.ordered).length
  const lateOf = (n: string) => s.pos.filter((p) => p.supplier === n && p.late).length
  const live = s.suppliers.filter((x) => !isOff(s, 'supplier', x.name))
  const offList = s.suppliers.filter((x) => isOff(s, 'supplier', x.name))
  const list = (tab === 'off' ? offList : live).filter((x) => (tab === 'all' || tab === 'off' || (tab === 'open' ? openOf(x.name) > 0 : lateOf(x.name) > 0)) && (!q || `${x.name} ${x.supplies}`.toLowerCase().includes(q.toLowerCase())))
  return (
    <Page
      title="Suppliers"
      actions={<><Button icon={<Upload />} onClick={() => s.open({ t: 'import', kind: 'supplier' })} data-import="supplier">Import</Button><Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'supplierform' })}>New supplier</Button></>}
      top={
        <Bubbles
          items={[
            { key: 'all', label: 'All suppliers', count: live.length, icon: <Truck />, color: 'slate', on: tab === 'all', onClick: () => setTab('all') },
            { key: 'open', label: 'Orders coming', count: live.filter((x) => openOf(x.name) > 0).length, icon: <Package />, color: 'blue', on: tab === 'open', onClick: () => setTab(tab === 'open' ? 'all' : 'open') },
            { key: 'late', label: 'Late', count: live.filter((x) => lateOf(x.name) > 0).length, icon: <AlarmClock />, color: 'red', on: tab === 'late', onClick: () => setTab(tab === 'late' ? 'all' : 'late') },
            offBubble(offList.length, tab === 'off', () => setTab(tab === 'off' ? 'all' : 'off')),
          ]}
        />
      }
      toolbar={
        <>
          <span className="bar-title mr-2 text-[0.9375rem] font-semibold text-ink">{{ all: 'All suppliers', open: 'Orders coming', late: 'Late', off: 'Inactive suppliers' }[tab]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{list.length}</span></span>
          <ToolbarSearch value={q} onChange={setQ} placeholder="Search suppliers" />
        </>
      }
    >
      <Table minWidth={760}>
        <thead>
          <tr>
            <Th>Supplier</Th>
            <Th w={260} className="max-lg:hidden">Who to call</Th>
            <Th w={130} className="max-md:hidden">Open POs</Th>
            <Th w={130} className="max-md:hidden">Late</Th>
            <Th w={150} right className="max-lg:hidden">Spent this year</Th>
            <Th w={52} />
          </tr>
        </thead>
        <tbody>
          {list.map((x) => {
            const pos = s.pos.filter((p) => p.supplier === x.name)
            const open = pos.filter((p) => p.step >= 1 && p.step < 3).length
            const late = pos.filter((p) => p.late).length
            const tile = s.checks.filter((c) => c.supplier === x.name).length
            return (
              <Tr key={x.name} onClick={() => s.open({ t: 'supplier', id: x.name })}>
                <Td>
                  <div className="truncate text-[0.875rem] font-medium text-ink">{x.name}</div>
                  <div className="truncate text-[0.78125rem] text-muted">{x.supplies}</div>
                </Td>
                <Td className="max-lg:hidden">
                  {x.contact || x.phone ? (
                    <>
                      <div className="truncate text-[0.84375rem] font-medium text-ink-2">{x.contact || 'Office'}</div>
                      <div className="truncate text-[0.78125rem] text-muted">{[x.phone, x.email].filter(Boolean).join(' · ') || '—'}</div>
                    </>
                  ) : <button onClick={(e) => { e.stopPropagation(); s.open({ t: 'supplierform', name: x.name }) }} className="text-[0.8125rem] font-semibold text-brand-600 hover:underline">Add a contact</button>}
                </Td>
                <Td className="text-[0.84375rem] max-md:hidden">{pos.length ? open : tile ? `${tile} tile orders` : '—'}</Td>
                <Td className="max-md:hidden">{late ? <Status tone="bad">{late} late</Status> : <span className="text-[0.84375rem] text-faint">None</span>}</Td>
                <Td right className="tnum max-lg:hidden">{pos.length ? fmtMoney(pos.reduce((n, p) => n + p.amount, 0)) : '—'}</Td>
                <Td><ActiveMenu kind="supplier" id={x.name} name={x.name} /></Td>
              </Tr>
            )
          })}
          {!list.length && <EmptyRow colSpan={6} title={tab === 'off' ? 'No inactive suppliers' : 'No suppliers match'} />}
        </tbody>
      </Table>
    </Page>
  )
}
/* ================= items — from QuickBooks ================= */
export function ItemsPage() {
  const s = useStore()
  const [tab, setTab] = React.useState<'all' | ItemType>('all')
  const [vendor, setVendor] = React.useState('all')
  const [q, setQ] = React.useState('')
  const [synced, setSynced] = React.useState('5 min ago')
  const items = s.items.filter((i) => i.id !== 'o-room')
  const list = items.filter((i) => (tab === 'all' || i.type === tab) && (vendor === 'all' || i.vendor === vendor) && (!q || `${i.name} ${i.qb}`.toLowerCase().includes(q.toLowerCase())))
  const vendors = Array.from(new Set(items.map((i) => i.vendor).filter(Boolean))) as string[]
  return (
    <Page
      title="Items"
      sub="Your products and services from QuickBooks — what we charge on estimates, and what we pay installers and suppliers."
      actions={<Button icon={<RefreshCw />} onClick={() => { setSynced('just now'); toast.success('QuickBooks items synced') }}>Synced {synced}</Button>}
      top={
        <Bubbles
          items={[
            { key: 'all', label: 'All items', count: items.length, icon: <Boxes />, color: 'blue', on: tab === 'all', onClick: () => setTab('all') },
            { key: 'labor', label: 'Labor', count: items.filter((i) => i.type === 'labor').length, icon: <Hammer />, color: 'orange', on: tab === 'labor', onClick: () => setTab(tab === 'labor' ? 'all' : 'labor') },
            { key: 'material', label: 'Materials', count: items.filter((i) => i.type === 'material').length, icon: <Package />, color: 'teal', on: tab === 'material', onClick: () => setTab(tab === 'material' ? 'all' : 'material') },
            { key: 'other', label: 'Other', count: items.filter((i) => i.type === 'other').length, icon: <Shapes />, color: 'slate', on: tab === 'other', onClick: () => setTab(tab === 'other' ? 'all' : 'other') },
          ]}
        />
      }
      toolbar={
        <>
          <span className="bar-title mr-2 text-[0.9375rem] font-semibold text-ink">{{ all: 'All items', labor: 'Labor', material: 'Materials', other: 'Other' }[tab]} <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{list.length}</span></span>
          <Filter icon={<Truck />} label="Vendor" value={vendor} options={vendors.map((v) => ({ key: v, label: v }))} onChange={setVendor} />
          <ClearFilters show={vendor !== 'all' || !!q} onClear={() => { setVendor('all'); setQ('') }} />
          <ToolbarSearch value={q} onChange={setQ} placeholder="Search items" />
        </>
      }
    >
      <Table minWidth={860}>
        <thead>
          <tr>
            <Th>Item</Th>
            <Th w={70} className="max-md:hidden">Unit</Th>
            <Th w={110} right className="max-md:hidden">We charge</Th>
            <Th w={110} right className="max-md:hidden">We pay</Th>
            <Th w={90} right className="max-lg:hidden">Margin</Th>
            <Th w={170} className="max-xl:hidden">Paid to</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((i) => {
            const margin = i.price ? Math.round(((i.price - i.cost) / i.price) * 100) : 0
            return (
              <Tr key={i.id} onClick={() => s.open({ t: 'item', id: i.id })}>
                <Td>
                  <div className="truncate text-[0.875rem] font-medium text-ink">{i.name}</div>
                  <div className="truncate text-[0.78125rem] text-muted">{ITEM_TYPE_LABEL[i.type]} · QuickBooks {i.qb}</div>
                </Td>
                <Td className="text-[0.84375rem] text-muted max-md:hidden">{i.unit}</Td>
                <Td right className="tnum text-ink max-md:hidden">{fmtMoney(i.price, { cents: i.price % 1 !== 0 })}</Td>
                <Td right className="tnum max-md:hidden">{i.cost ? fmtMoney(i.cost, { cents: i.cost % 1 !== 0 }) : '—'}</Td>
                <Td right className="tnum text-muted max-lg:hidden">{i.cost ? `${margin}%` : '—'}</Td>
                <Td className="truncate text-[0.84375rem] max-xl:hidden">{i.type === 'labor' ? 'Installer' : i.vendor || '—'}</Td>
              </Tr>
            )
          })}
          {!list.length && <EmptyRow colSpan={6} title="No items match" />}
        </tbody>
      </Table>
    </Page>
  )
}
export function ItemModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const i = s.items.find((x) => x.id === id)
  if (!i) return null
  /* what we paid, PO by PO */
  const paid = s.pos.flatMap((p) => p.lines.filter((l) => l.itemId === id && l.price).map((l) => ({ po: p, l })))
  const inst = s.ipos.flatMap((p) => p.lines.filter((l) => l.itemId === id && l.rate).map((l) => ({ po: p, l })))
  const onEst = s.estimates.filter((e) => e.revs.some((r) => r.lines.some((l) => l.itemId === id)))
  return (
    <Modal level={level} size="lg" onClose={s.close} title={i.name} sub={`${ITEM_TYPE_LABEL[i.type]} · per ${i.unit} · QuickBooks ${i.qb}`}>
      <div className="grid grid-cols-3 gap-6 border-b border-line pb-5 max-sm:grid-cols-1">
        <div><div className="text-[0.8125rem] text-muted">We charge</div><div className="text-[1.375rem] font-semibold tnum text-ink">{fmtMoney(i.price, { cents: i.price % 1 !== 0 })}</div></div>
        <div><div className="text-[0.8125rem] text-muted">{i.type === 'labor' ? 'We pay the installer' : 'We last paid'}</div><div className="text-[1.375rem] font-semibold tnum text-ink">{i.cost ? fmtMoney(i.cost, { cents: i.cost % 1 !== 0 }) : '—'}</div></div>
        <div><div className="text-[0.8125rem] text-muted">Margin</div><div className="text-[1.375rem] font-semibold tnum text-ink">{i.price && i.cost ? `${Math.round(((i.price - i.cost) / i.price) * 100)}%` : '—'}</div></div>
      </div>
      <SectionTitle className="mt-6">{i.type === 'labor' ? 'On installer POs' : 'What we paid, PO by PO'}</SectionTitle>
      {paid.map(({ po, l }, k) => <RowBtn key={k} onClick={() => s.open({ t: 'po', id: po.id })} title={`${po.id} · ${po.supplier}`} sub={`${s.jobs[po.jobId]?.name} · ${l.qty} · ${po.date || ''}`} right={`${fmtMoney(l.price!, { cents: l.price! % 1 !== 0 })} / ${i.unit}`} />)}
      {inst.map(({ po, l }, k) => <RowBtn key={'i' + k} onClick={() => s.open({ t: 'ipo', id: po.id })} title={`${po.id} · ${PEOPLE[po.crew].name}`} sub={`${s.jobs[po.jobId]?.name} · ${l.qty}`} right={`${fmtMoney(l.rate!, { cents: l.rate! % 1 !== 0 })} / ${i.unit}`} />)}
      {!paid.length && !inst.length && <Muted>Not on any PO yet.</Muted>}
      <SectionTitle className="mt-7">On estimates</SectionTitle>
      {onEst.map((e) => <RowBtn key={e.id} onClick={() => s.open({ t: 'estimate', id: e.id })} title={`${e.id} · ${s.jobs[e.jobId]?.name}`} sub={e.status === 'approved' ? 'Approved' : 'Open'} right="" />)}
      {!onEst.length && <Muted>Not on any estimate yet.</Muted>}
    </Modal>
  )
}

/* ---------------- small shared pieces ---------------- */
function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-1.5 text-[0.8125rem] font-medium text-muted', className)}>{children}</div>
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div className="py-2 text-[0.84375rem] text-muted">{children}</div>
}
function RowBtn({ title, sub, right, onClick }: { title: string; sub?: string; right?: string; onClick: () => void }) {
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

/* ================= a supplier: who they are and who to call ================= */
export function SupplierFormModal({ name, level }: { name?: string; level: number }) {
  const s = useStore()
  const cur = name ? s.suppliers.find((x) => x.name === name) : undefined
  const [f, setF] = React.useState<SupplierInfo>(() => cur ? { ...cur, more: (cur.more || []).map((r) => ({ ...r })) } : { name: '', supplies: '', contact: '', phone: '', email: '', more: [] })
  const set = (p: Partial<SupplierInfo>) => setF((v) => ({ ...v, ...p }))
  const clash = !!f.name.trim() && f.name.trim() !== name && s.suppliers.some((x) => x.name.toLowerCase() === f.name.trim().toLowerCase())
  const ok = !!f.name.trim() && !clash && reachOk(f.more)
  const save = () => {
    const rec: SupplierInfo = { name: f.name.trim(), supplies: (f.supplies || '').trim(), contact: f.contact?.trim() || undefined, phone: f.phone?.trim() || undefined, email: f.email?.trim() || undefined, more: cleanReach(f.more), note: f.note?.trim() || undefined }
    s.commit((x) => {
      if (cur) {
        const i = x.suppliers.findIndex((y) => y.name === cur.name)
        if (i >= 0) x.suppliers[i] = rec
        /* a new name follows on every PO and tile order */
        if (rec.name !== cur.name) {
          x.pos.forEach((p) => { if (p.supplier === cur.name) p.supplier = rec.name })
          x.checks.forEach((c) => { if (c.supplier === cur.name) c.supplier = rec.name })
          x.items.forEach((it) => { if (it.vendor === cur.name) it.vendor = rec.name })
        }
      } else x.suppliers.push(rec)
    }, cur ? `${rec.name} saved` : `${rec.name} added`, { close: true })
  }
  return (
    <Modal level={level} size="md" onClose={s.close} title={cur ? cur.name : 'New supplier'} sub="Who we buy from — the name shows on every PO" footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={save}>{cur ? 'Save' : 'Add the supplier'}</Button></>}>
      <div className="flex flex-col gap-3.5">
        {formField('Name', <TextInput data-autofocus aria-label="Supplier name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Infinity" className="h-10" />)}
        {clash && <div className="-mt-2 text-[0.78125rem] font-medium text-bad-600">That supplier is already on the list.</div>}
        {formField('What we buy from them', <TextInput aria-label="What we buy from them" value={f.supplies} onChange={(e) => set({ supplies: e.target.value })} placeholder="e.g. Setting materials — thinset, grout, membranes" className="h-10" />)}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {formField('Who to call', <TextInput aria-label="Contact name" value={f.contact || ''} onChange={(e) => set({ contact: e.target.value })} placeholder="Name of the rep" className="h-10" />)}
          {formField('Phone', <TextInput aria-label="Phone" inputMode="tel" value={f.phone || ''} onChange={(e) => set({ phone: e.target.value })} placeholder="(732) 555-0100" className="h-10" />)}
        </div>
        {formField('Email — where POs go', <TextInput aria-label="Email" type="email" value={f.email || ''} onChange={(e) => set({ email: e.target.value })} placeholder="orders@supplier.com" className="h-10" />)}
        <MoreBlock value={f.more} onChange={(more) => set({ more })} />
      </div>
    </Modal>
  )
}

/* ================= a designer, an installer — new, or changing one that's there ================= */
const formField = (label: string, el: React.ReactNode) => (
  <label className="block min-w-0"><span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2">{label}</span>{el}</label>
)
/** more phones and emails — a cell besides the office line, a billing address */
function MoreBlock({ value, onChange }: { value: Reach[] | undefined; onChange: (v: Reach[]) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">More phones and emails</div>
      <MoreReach value={value} onChange={onChange} />
    </div>
  )
}
export function DesignerFormModal({ id, level }: { id?: string; level: number }) {
  const s = useStore()
  const cur = id ? s.designers.find((d) => d.id === id) : undefined
  const [f, setF] = React.useState(() => ({ name: cur?.name || '', contact: cur?.contact || '', phone: cur?.phone || '', email: cur?.email || '', notes: cur?.notes || '', more: (cur?.more || []).map((r) => ({ ...r })) as Reach[] }))
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))
  const clash = !!f.name.trim() && s.designers.some((d) => d.id !== id && d.name.toLowerCase() === f.name.trim().toLowerCase())
  const ok = !!f.name.trim() && !clash && reachOk(f.more)
  const save = () => {
    const rec = { name: f.name.trim(), contact: f.contact.trim(), phone: f.phone.trim(), email: f.email.trim(), notes: f.notes.trim(), more: cleanReach(f.more) }
    if (cur) {
      s.commit((x) => { const d = x.designers.find((y) => y.id === cur.id); if (d) Object.assign(d, rec) }, `${rec.name} saved`, { close: true })
      return
    }
    const nid = 'd' + Date.now().toString(36)
    s.commit((x) => { x.designers.push({ id: nid, ...rec, clients: [] }) }, `${rec.name} added`, { close: true })
  }
  return (
    <Modal level={level} size="md" onClose={s.close} title={cur ? cur.name : 'New designer'} sub="The firm, who to talk to, and how to reach them" footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={save}>{cur ? 'Save' : 'Add the designer'}</Button></>}>
      <div className="flex flex-col gap-3.5">
        {formField('Firm', <TextInput data-autofocus aria-label="Firm" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ivy Lane Interiors" className="h-10" />)}
        {clash && <div className="-mt-2 text-[0.78125rem] font-medium text-bad-600">That designer is already on the list.</div>}
        {formField('Who to talk to', <TextInput aria-label="Contact" value={f.contact} onChange={(e) => set({ contact: e.target.value })} placeholder="Name, or their role" className="h-10" />)}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {formField('Phone', <TextInput aria-label="Phone" inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(718) 555-0100" className="h-10" />)}
          {formField('Email', <TextInput aria-label="Email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="studio@designer.com" className="h-10" />)}
        </div>
        <MoreBlock value={f.more} onChange={(more) => set({ more })} />
        {formField('Notes', <TextInput aria-label="Notes" value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. Answers by email within a week" className="h-10" />)}
      </div>
    </Modal>
  )
}
export function InstallerFormModal({ id, level }: { id?: PersonKey; level: number }) {
  const s = useStore()
  /* an installer that's there: his details live on the team list (a standing crew gets his spot the first time) */
  const mem = id ? s.team.find((m) => m.key === id) : undefined
  const info = id ? allSubs().find((x) => x.crew === id) : undefined
  const [f, setF] = React.useState(() => ({ name: id ? PEOPLE[id]?.name || '' : '', phone: mem?.phone || '', email: mem?.email || '', region: mem?.region ?? info?.region ?? '', trade: mem?.trade || info?.trade || 'Tile installation', more: (mem?.more || []).map((r) => ({ ...r })) as Reach[] }))
  const set = (p: Partial<typeof f>) => setF((v) => ({ ...v, ...p }))
  const taken = !!f.name.trim() && Object.values(PEOPLE).some((p) => p.crew && p.key !== id && p.name.toLowerCase() === f.name.trim().toLowerCase())
  const ok = !!f.name.trim() && !taken && reachOk(f.more)
  const save = () => {
    const [first, ...rest] = f.name.trim().split(/\s+/)
    const patch = { first, last: rest.join(' ') || undefined, phone: f.phone.trim() || undefined, email: f.email.trim() || undefined, more: cleanReach(f.more), trade: f.trade.trim() || 'Tile installation', region: f.region.trim() || undefined }
    if (id) {
      s.commit((x) => {
        const m = x.team.find((y) => y.key === id)
        if (m) Object.assign(m, patch)
        else x.team.push({ key: id, ...patch, role: 'crew', status: 'active' })
      }, `${f.name.trim()} saved`, { close: true })
      return
    }
    const key = ('c' + Date.now().toString(36)) as PersonKey
    s.commit((x) => {
      x.team.push({ key, ...patch, role: 'crew', status: 'active' })
    }, `${f.name.trim()} added`, { close: true, sub: 'He shows on the schedule, the installer list and when you pick who installs a job.' })
  }
  return (
    <Modal level={level} size="md" onClose={s.close} title={id ? PEOPLE[id]?.name || 'Installer' : 'New installer'} sub={id ? 'His phone, email and where he works' : 'He shows up on the schedule, in Installer pay, and when you pick who installs a job'} footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={save}>{id ? 'Save' : 'Add the installer'}</Button></>}>
      <div className="flex flex-col gap-3.5">
        {formField('Name', <TextInput data-autofocus aria-label="Installer name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Marco" className="h-10" />)}
        {taken && <div className="-mt-2 text-[0.78125rem] font-medium text-bad-600">There’s already an installer with that name.</div>}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {formField('Phone', <TextInput aria-label="Phone" inputMode="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(718) 555-0100" className="h-10" />)}
          {formField('Email (for his POs)', <TextInput aria-label="Email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@email.com" className="h-10" />)}
        </div>
        <MoreBlock value={f.more} onChange={(more) => set({ more })} />
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {formField('What he does', <TextInput aria-label="Trade" value={f.trade} onChange={(e) => set({ trade: e.target.value })} className="h-10" />)}
          {formField('Where he works (optional)', <TextInput aria-label="Area" value={f.region} onChange={(e) => set({ region: e.target.value })} placeholder="e.g. New Jersey" className="h-10" />)}
        </div>
      </div>
    </Modal>
  )
}
