/* Commissions — who sold each project, what they've earned on it, what they've been paid and what they're owed.
 *   The company's rate (4% unless it's changed in the window "Rate") goes on every salesperson put on a project; one
 *   project or one person can have a different one.
 *   Earned = the rate × what's been invoiced on the project (the invoices sent: the deposit, the progress bills, the
 *   final — the same "billed" as the project's Billing). Paid out = the payments to them, one by one. Owed = the rest.
 *   What the client has paid shows alongside, for anyone who waits for the money before paying out. */
import * as React from 'react'
import { Percent, Users, HandCoins, CircleCheckBig, Plus, Trash2, Building2, UserRound, Wallet } from 'lucide-react'
import { useStore, NOW, meOf, type Store } from '@/tileos/store'
import { Button, TextInput, Field } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Page, Filter, ClearFilters, Table, Th, Tr, Td, EmptyRow, Bubbles, GroupRow } from '@/tileos/components/ui/page'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, type Job, type SaleShare, type SalesPerson } from '@/tileos/data/model'
import { TODAY } from '@/tileos/lib/today'
import { pictureOf } from './progressbill'

/* ================= the numbers ================= */
export const DEFAULT_RATE = 4
const PRICING = ['request', 'estimating', 'proposal', 'followup']
export const rateOf = (s: Pick<Store, 'rules'>) => s.rules.commission?.rate ?? DEFAULT_RATE
export const salesPeople = (s: Pick<Store, 'rules'>): SalesPerson[] => s.rules.commission?.people || []
const won = (s: Store) => Object.values(s.jobs).filter((j) => !PRICING.includes(j.stage))
const r2 = (n: number) => Math.round(n * 100) / 100
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, '')}%`

export type CommRow = { job: Job; share: SaleShare; person?: SalesPerson; invoiced: number; clientPaid: number; earned: number; paidOut: number; owed: number }
/** one line for each salesperson on each project */
export function commRows(s: Store): CommRow[] {
  const people = salesPeople(s)
  return won(s).flatMap((job) => {
    const shares = job.sales || []
    if (!shares.length) return []
    const pic = pictureOf(s, job.id)
    return shares.map((share) => {
      const earned = r2((pic.billed * share.rate) / 100)
      const paidOut = r2((share.paid || []).reduce((n, p) => n + p.amount, 0))
      return { job, share, person: people.find((p) => p.id === share.who), invoiced: pic.billed, clientPaid: pic.paid, earned, paidOut, owed: r2(earned - paidOut) }
    })
  })
}

/* ================= what you do ================= */
const S = () => useStore.getState()
const newId = () => 'sp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
export function addSalesPerson(name: string, o: { email?: string; phone?: string } = {}): string {
  const id = newId()
  S().commit((s) => {
    const c = (s.rules.commission ||= {})
    ;(c.people ||= []).push({ id, name: name.trim(), ...(o.email?.trim() ? { email: o.email.trim() } : {}), ...(o.phone?.trim() ? { phone: o.phone.trim() } : {}) })
  }, `${name.trim()} added as a salesperson`, { undo: false })
  return id
}
export function editSalesPerson(id: string, patch: Partial<SalesPerson>) {
  S().commit((s) => {
    const p = s.rules.commission?.people?.find((x) => x.id === id)
    if (p) Object.assign(p, patch)
  }, 'Saved', { undo: false })
}
/** off the list — only someone who was never paid a commission (their history stays otherwise) */
export function removeSalesPerson(id: string) {
  const s0 = S()
  const paid = won(s0).some((j) => (j.sales || []).some((x) => x.who === id && (x.paid || []).length))
  if (paid) return false
  const name = salesPeople(s0).find((x) => x.id === id)?.name || 'They'
  s0.commit((s) => {
    if (s.rules.commission?.people) s.rules.commission.people = s.rules.commission.people.filter((x) => x.id !== id)
    Object.values(s.jobs).forEach((j) => { if (j.sales) j.sales = j.sales.filter((x) => x.who !== id) })
  }, `${name} is off the list`)
  return true
}
/** the company's rate — on everyone put on a project from now on; "also on the projects set up already" changes theirs */
export function setCompanyRate(rate: number, everywhere: boolean) {
  S().commit((s) => {
    const c = (s.rules.commission ||= {})
    const was = c.rate ?? DEFAULT_RATE
    c.rate = rate
    if (everywhere) Object.values(s.jobs).forEach((j) => (j.sales || []).forEach((x) => { if (x.rate === was) x.rate = rate }))
  }, `Commission rate ${pct(rate)}`, { sub: everywhere ? 'On every project that had the old rate, and on the ones to come.' : 'On the salespeople put on a project from now on.' })
}
export function putOnProject(jobId: string, who: string) {
  const s0 = S()
  const name = salesPeople(s0).find((x) => x.id === who)?.name || 'Salesperson'
  s0.commit((s) => {
    const j = s.jobs[jobId]
    if (!j || (j.sales || []).some((x) => x.who === who)) return
    ;(j.sales ||= []).push({ who, rate: rateOf(s) })
  }, `${name} is on ${s0.jobs[jobId]?.name}`, { undo: false, sub: `${pct(rateOf(s0))} of what’s invoiced on it.` })
}
export function setShareRate(jobId: string, who: string, rate: number) {
  S().commit((s) => {
    const x = s.jobs[jobId]?.sales?.find((y) => y.who === who)
    if (x) x.rate = rate
  }, `Rate ${pct(rate)}`, { undo: false })
}
export function takeOffProject(jobId: string, who: string) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    if (j?.sales) j.sales = j.sales.filter((x) => x.who !== who || (x.paid || []).length)
  }, 'Taken off the project')
}
export function payCommission(jobId: string, who: string, amount: number, note?: string) {
  const s0 = S()
  const name = salesPeople(s0).find((x) => x.id === who)?.name || 'Salesperson'
  s0.commit((s) => {
    const x = s.jobs[jobId]?.sales?.find((y) => y.who === who)
    if (!x) return
    ;(x.paid ||= []).push({ amount: r2(amount), date: NOW, iso: TODAY, ...(note?.trim() ? { note: note.trim() } : {}), by: meOf(s.role) })
  }, `${fmtMoney(amount, { cents: amount % 1 !== 0 })} paid to ${name}`, { sub: s0.jobs[jobId]?.name })
}

/* ================= the page ================= */
type View = 'all' | 'owed' | 'paid' | 'none'
const money = (n: number) => fmtMoney(n, { cents: Math.round(n * 100) % 100 !== 0 })
export function CommissionsPage() {
  const s = useStore()
  const [view, setView] = React.useState<View>('all')
  const [who, setWho] = React.useState('all')
  const people = salesPeople(s)
  const rows = commRows(s)
  const none = won(s).filter((j) => !(j.sales || []).length && j.stage !== 'complete')
  const owedRows = rows.filter((r) => r.owed > 0.004)
  const paidRows = rows.filter((r) => r.owed <= 0.004 && r.earned > 0)
  const sum = (list: CommRow[], k: 'earned' | 'paidOut' | 'owed') => list.reduce((n, r) => n + r[k], 0)
  const shown = (view === 'owed' ? owedRows : view === 'paid' ? paidRows : rows).filter((r) => who === 'all' || r.share.who === who)
  const groups = Array.from(new Set(shown.map((r) => r.share.who))).sort((a, b) => (people.find((p) => p.id === a)?.name || '').localeCompare(people.find((p) => p.id === b)?.name || ''))
  const pick = (k: View) => () => setView(view === k ? 'all' : k)
  return (
    <Page
      title="Commissions"
      sub={`What each salesperson earned on what’s been invoiced — ${pct(rateOf(s))} unless a project says otherwise — what they’ve been paid, and what they’re owed.`}
      actions={
        <>
          <Button icon={<Percent />} onClick={() => s.open({ t: 'commrate' })} data-comm-rate>Rate {pct(rateOf(s))}</Button>
          <Button icon={<Users />} onClick={() => s.open({ t: 'salespeople' })} data-comm-people>Salespeople{people.length ? ` · ${people.length}` : ''}</Button>
        </>
      }
      top={
        <Bubbles
          items={[
            { key: 'all', label: 'Projects with a salesperson', count: new Set(rows.map((r) => r.job.id)).size, icon: <Building2 />, color: 'indigo', on: view === 'all', onClick: () => setView('all') },
            { key: 'owed', label: 'Owed to them', count: money(sum(owedRows, 'owed')), icon: <HandCoins />, color: 'amber', on: view === 'owed', onClick: pick('owed'), gapBefore: true },
            { key: 'paid', label: 'Paid out', count: money(sum(rows, 'paidOut')), icon: <CircleCheckBig />, color: 'green', on: view === 'paid', onClick: pick('paid') },
            { key: 'none', label: 'No salesperson yet', count: none.length, icon: <UserRound />, color: 'slate', on: view === 'none', onClick: pick('none'), gapBefore: true },
          ]}
        />
      }
      toolbar={
        <div className="flex w-full flex-wrap items-center gap-2">
          {view !== 'none' && <Filter icon={<UserRound />} label="Salesperson" value={who} options={people.map((p) => ({ key: p.id, label: p.name }))} onChange={setWho} />}
          <ClearFilters show={who !== 'all'} onClear={() => setWho('all')} />
        </div>
      }
    >
      {view === 'none' ? (
        <Table minWidth={640}>
          <thead>
            <tr>
              <Th className="xl:w-[22rem]">Project</Th>
              <Th w="9rem" right>Invoiced</Th>
              <Th w="12rem" right>Salesperson</Th>
            </tr>
          </thead>
          <tbody>
            {none.map((j) => (
              <Tr key={j.id} onClick={() => s.open({ t: 'commission', jobId: j.id })}>
                <Td><div className="truncate text-[0.875rem] font-semibold text-ink">{j.name}</div><div className="truncate text-[0.78125rem] text-muted">{j.client}</div></Td>
                <Td right className="tnum">{money(pictureOf(s, j.id).billed)}</Td>
                <Td right><span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-brand-700"><Plus className="h-3.5 w-3.5" />Add a salesperson</span></Td>
              </Tr>
            ))}
            {!none.length && <EmptyRow colSpan={3} title="Every project has a salesperson" />}
          </tbody>
        </Table>
      ) : (
        <Table minWidth={900}>
          <thead>
            <tr>
              <Th className="xl:w-[16rem]">Project</Th>
              <Th w="8.5rem" right>Invoiced</Th>
              <Th w="8.5rem" right className="max-lg:hidden">Client paid</Th>
              <Th w="5rem" right>Rate</Th>
              <Th w="8rem" right>Earned</Th>
              <Th w="8rem" right>Paid to them</Th>
              <Th w="8rem" right>Owed</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const list = shown.filter((r) => r.share.who === g)
              const name = list[0]?.person?.name || 'Salesperson'
              return (
                <React.Fragment key={g}>
                  <GroupRow label={`${name} · ${money(sum(list, 'owed'))} owed`} count={list.length} colSpan={7} />
                  {list.map((r) => (
                    <Tr key={r.job.id + r.share.who} onClick={() => s.open({ t: 'commission', jobId: r.job.id })}>
                      <Td><div className="truncate text-[0.875rem] font-semibold text-ink" data-comm-row={r.job.id}>{r.job.name}</div><div className="truncate text-[0.78125rem] text-muted">{r.job.client}</div></Td>
                      <Td right className="tnum">{money(r.invoiced)}</Td>
                      <Td right className="tnum text-muted max-lg:hidden">{money(r.clientPaid)}</Td>
                      <Td right className="tnum">{pct(r.share.rate)}</Td>
                      <Td right className="tnum text-ink">{money(r.earned)}</Td>
                      <Td right className="tnum">{money(r.paidOut)}</Td>
                      <Td right className={cn('tnum font-semibold', r.owed > 0.004 ? 'text-warn-700' : 'text-[#2c8a5b]')} >{r.owed > 0.004 ? money(r.owed) : 'Paid up'}</Td>
                    </Tr>
                  ))}
                </React.Fragment>
              )
            })}
            {!shown.length && (
              <EmptyRow
                colSpan={7}
                title={rows.length ? 'Nothing here' : 'No salesperson on a project yet'}
                sub={rows.length ? 'Try another filter.' : people.length ? 'Open “No salesperson yet” and put someone on a project.' : 'Add your salespeople first, then put them on their projects.'}
                action={!people.length ? <Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'salespeople' })}>Add a salesperson</Button> : <Button icon={<Plus />} onClick={() => setView('none')}>Projects with no salesperson</Button>}
              />
            )}
          </tbody>
        </Table>
      )}
    </Page>
  )
}

/* ================= one project: its salespeople, their rate, what they earned, the payments ================= */
export function CommissionModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const people = salesPeople(s)
  const [adding, setAdding] = React.useState('')
  if (!job) return null
  const pic = pictureOf(s, jobId)
  const rows = commRows(s).filter((r) => r.job.id === jobId)
  const free = people.filter((p) => !(job.sales || []).some((x) => x.who === p.id))
  return (
    <Modal level={level} size="md" onClose={s.close} title={`Commission · ${job.name}`} sub={`${job.client} · invoiced ${money(pic.billed)} · the client paid ${money(pic.paid)}`} footer={<Button className="ml-auto" variant="primary" onClick={s.close}>Done</Button>}>
      <div className="flex flex-col gap-3" data-commission={jobId}>
        {rows.map((r) => <ShareCard key={r.share.who} r={r} />)}
        {!rows.length && <p className="text-[0.875rem] text-muted">Nobody on this project yet — who sold it?</p>}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchSelect
              label="Add a salesperson"
              value={adding}
              placeholder={rows.length ? 'Add another salesperson' : 'Pick the salesperson'}
              options={free.map((p) => ({ key: p.id, label: p.name, hint: p.email }))}
              onChange={(k) => { setAdding(''); putOnProject(jobId, k) }}
              onCreate={(text) => { const id = addSalesPerson(text); putOnProject(jobId, id) }}
              createLabel={(t) => `Add “${t}” as a salesperson`}
              search
              width={340}
            />
          </div>
        </div>
        <p className="text-[0.78125rem] text-muted">Each one gets the rate on what’s invoiced on the project — {pct(rateOf(s))} unless you change it here. Two people sharing a project can each have their own.</p>
      </div>
    </Modal>
  )
}
function ShareCard({ r }: { r: CommRow }) {
  const [rate, setRate] = React.useState(String(r.share.rate))
  const [amount, setAmount] = React.useState('')
  const [note, setNote] = React.useState('')
  React.useEffect(() => setRate(String(r.share.rate)), [r.share.rate])
  const saveRate = () => { const n = Number(rate); if (n >= 0 && n <= 50 && n !== r.share.rate) setShareRate(r.job.id, r.share.who, n); else setRate(String(r.share.rate)) }
  const n = Number(amount || r.owed)
  const pay = () => { if (n > 0) { payCommission(r.job.id, r.share.who, n, note); setAmount(''); setNote('') } }
  const paid = r.share.paid || []
  return (
    <section className="overflow-hidden rounded-xl border border-line" data-share={r.share.who}>
      <header className="flex items-center gap-3 border-b border-line-2 bg-[#faf9f7] px-4 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-ink">{r.person?.name || 'Salesperson'}</span>
        <label className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] text-muted">
          Rate
          <input inputMode="decimal" aria-label="Rate" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} onBlur={saveRate} onKeyDown={(e) => { if (e.key === 'Enter') saveRate() }} className="h-8 w-14 rounded-md border border-line bg-white px-2 text-right text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none" data-share-rate />
          %
        </label>
        {!paid.length && <button type="button" onClick={() => takeOffProject(r.job.id, r.share.who)} aria-label="Take off this project" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-wash hover:text-ink"><Trash2 className="h-4 w-4" /></button>}
      </header>
      <div className="grid grid-cols-3 gap-2 px-4 py-3 text-center max-sm:gap-1">
        <div><div className="text-[0.75rem] text-muted">Earned</div><div className="text-[1rem] font-semibold tnum text-ink">{money(r.earned)}</div></div>
        <div><div className="text-[0.75rem] text-muted">Paid to them</div><div className="text-[1rem] font-semibold tnum text-ink">{money(r.paidOut)}</div></div>
        <div><div className="text-[0.75rem] text-muted">Owed</div><div className={cn('text-[1rem] font-semibold tnum', r.owed > 0.004 ? 'text-warn-700' : 'text-[#2c8a5b]')} data-share-owed>{r.owed > 0.004 ? money(r.owed) : 'Paid up'}</div></div>
      </div>
      {paid.length > 0 && (
        <div className="border-t border-line-2 px-4 py-1">
          {paid.map((p, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 text-[0.8125rem]">
              <Wallet className="h-3.5 w-3.5 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate text-ink-2">{p.date}{p.note ? ` · ${p.note}` : ''}</span>
              <span className="shrink-0 font-medium tnum text-ink">{money(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
      {r.owed > 0.004 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-2 bg-[#faf9f7] px-4 py-2.5">
          <span className="text-[0.8125rem] text-muted">Pay them</span>
          <input inputMode="decimal" aria-label="How much" placeholder={money(r.owed)} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} className="h-9 w-28 rounded-md border border-line bg-white px-2 text-right text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none" data-pay-amount />
          <input aria-label="Check number or a note" placeholder="Check # or a note" value={note} onChange={(e) => setNote(e.target.value)} className="h-9 min-w-0 flex-1 rounded-md border border-line bg-white px-2 text-[0.875rem] text-ink focus:border-brand-300 focus:outline-none" />
          <Button size="sm" variant="primary" icon={<HandCoins />} onClick={pay} disabled={!(n > 0)} data-pay-commission>Paid {money(n > 0 ? n : 0)}</Button>
        </div>
      )}
    </section>
  )
}

/* ================= the company's salespeople ================= */
export function SalesPeopleModal({ level }: { level: number }) {
  const s = useStore()
  const people = salesPeople(s)
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [msg, setMsg] = React.useState('')
  const count = (id: string) => won(s).filter((j) => (j.sales || []).some((x) => x.who === id)).length
  const add = () => { if (!name.trim()) return; addSalesPerson(name, { email }); setName(''); setEmail('') }
  return (
    <Modal level={level} size="md" onClose={s.close} title="Salespeople" sub="Who sells for the company — put them on their projects from Commissions." footer={<Button className="ml-auto" variant="primary" onClick={s.close}>Done</Button>}>
      <div className="flex flex-col gap-4">
        {people.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line">
            {people.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5 first:border-t-0" data-salesperson={p.id}>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[0.875rem] font-semibold text-ink">{p.name}</span>
                  <span className="block truncate text-[0.78125rem] text-muted">{[p.email, `${count(p.id)} ${count(p.id) === 1 ? 'project' : 'projects'}`].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" onClick={() => setMsg(removeSalesPerson(p.id) ? '' : `${p.name} was paid commissions — they stay on the list for the record.`)} aria-label={`Take ${p.name} off the list`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-wash hover:text-ink"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        {msg && <p className="text-[0.8125rem] text-warn-700">{msg}</p>}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2 max-sm:grid-cols-1">
          <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" onKeyDown={(e) => { if (e.key === 'Enter') add() }} data-new-salesperson /></Field>
          <Field label="Email (optional)"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" onKeyDown={(e) => { if (e.key === 'Enter') add() }} /></Field>
          <Button icon={<Plus />} onClick={add} disabled={!name.trim()} data-add-salesperson>Add</Button>
        </div>
      </div>
    </Modal>
  )
}

/* ================= the company's rate ================= */
export function CommissionRateModal({ level }: { level: number }) {
  const s = useStore()
  const now = rateOf(s)
  const [rate, setRate] = React.useState(String(now))
  const [all, setAll] = React.useState(false)
  const n = Number(rate)
  const ok = rate !== '' && n >= 0 && n <= 50
  return (
    <Modal level={level} size="sm" onClose={s.close} title="Commission rate" sub="On what’s invoiced on a project — for each salesperson on it." footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" disabled={!ok || (n === now && !all)} onClick={() => { setCompanyRate(n, all); s.close() }} data-save-rate>Save</Button></>}>
      <div className="flex flex-col gap-4">
        <Field label="Rate">
          <div className="flex items-center gap-2">
            <TextInput inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^0-9.]/g, ''))} className="w-24 text-right tnum" data-autofocus />
            <span className="text-[0.9375rem] text-ink-2">%</span>
          </div>
        </Field>
        <label className="flex items-start gap-2.5 text-[0.875rem] text-ink-2">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#2650cf]" />
          <span>Also change it on the projects that are set up already (the ones on {pct(now)})</span>
        </label>
      </div>
    </Modal>
  )
}
