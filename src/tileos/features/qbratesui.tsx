/* Installer prices from QuickBooks: what we paid each installer there, turned into his regular prices — looked at, ticked
 * and saved by the admin. Nothing in QuickBooks changes. */
import * as React from 'react'
import { BookOpen, Check, ChevronDown, RefreshCw } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuSep, MenuLabel } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, fmtMoney, type PersonKey } from '@/tileos/data/model'
import { REAL } from '@/tileos/lib/save'
import { TODAY } from '@/tileos/lib/today'
import type { QbPaid, QbBilled } from '@/lib/quickbooks'
import { ListHead } from './winhead'
import { readInstallerBills, type QbVendor, type CrewFromQb } from './qbrates'
import { LABOR_LINE } from './poratio'

const dayWords = (iso?: string) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '')
const money = (n: number) => `$${n.toFixed(2).replace(/\.00$/, '')}`
const WHY: Record<string, string> = { reconnect: 'QuickBooks needs to be connected again (Settings → QuickBooks).', denied: 'Only the team can read QuickBooks.', preview: 'This is the sample. Connect QuickBooks in your own app.' }

type Got = { since: string; vendors: QbVendor[]; bills: QbPaid[]; invoices: QbBilled[] } | { error: string } | null

export function QbRatesModal({ level, crew: only }: { level: number; /** one installer's (his page → Prices) */ crew?: PersonKey }) {
  const s = useStore()
  const [got, setGot] = React.useState<Got>(null)
  /* vendors matched by hand: kept with the company, so next time they're matched already */
  const [map, setMap] = React.useState<Record<string, string>>(() => ({ ...(s.rules.qbVendors || {}) }))
  /* prices left unticked (installer:item) */
  const [off, setOff] = React.useState<Record<string, boolean>>({})
  const [more, setMore] = React.useState(false)
  const load = React.useCallback(() => {
    setGot(null)
    const read = REAL.qb?.bills
    if (!read) { setGot({ error: 'Your app needs its latest version for this. Publish it in Lovable, then try again.' }); return }
    read().then((r) => setGot(r.ok ? { since: r.since, vendors: r.vendors, bills: r.bills, invoices: r.invoices || [] } : { error: WHY[r.why] || r.detail || 'QuickBooks said no.' })).catch(() => setGot({ error: 'Couldn’t reach QuickBooks.' }))
  }, [])
  React.useEffect(load, [load])
  const read = got && 'bills' in got ? readInstallerBills(s, got.vendors, got.bills, got.since, map, undefined, got.invoices) : null
  const crews = read ? read.crews.filter((c) => !only || c.crew === only) : []
  const picks = crews.flatMap((c) => c.rates.filter((r) => Math.abs(r.rate - r.now) >= 0.01 && !off[`${c.crew}:${r.itemId}`]).map((r) => ({ crew: c.crew, itemId: r.itemId, rate: r.rate })))
  const usual = crews.filter((c) => c.pct)
  const save = () => {
    s.commit((st) => {
      const all = { ...(st.rules.crewRates || {}) }
      picks.forEach((p) => { all[p.crew] = { ...(all[p.crew] || {}), [p.itemId]: p.rate } })
      st.rules.crewRates = all
      const pct = { ...(st.rules.crewPct || {}) }
      usual.forEach((c) => { pct[c.crew] = c.pct! })
      st.rules.crewPct = pct
      st.rules.qbVendors = map
      st.rules.qbRatesAt = TODAY
    }, picks.length ? `${picks.length} ${picks.length === 1 ? 'price' : 'prices'} saved` : 'Saved', { sub: picks.length ? 'Their POs are drafted at these prices from now on.' : undefined })
    s.close()
  }
  const sub = !got ? 'Reading bills and checks from QuickBooks…' : 'error' in got ? 'Couldn’t read QuickBooks' : `From ${read!.count} bills and checks since ${dayWords(got.since)}. Nothing in QuickBooks changes.`
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="Installer prices from QuickBooks"
      inlineClose
      header={<ListHead kind={{ icon: <BookOpen />, label: 'QuickBooks' }} title={only ? `${PEOPLE[only]?.short || 'His'} prices from QuickBooks` : 'Installer prices from QuickBooks'} sub={sub} attrs={{ 'data-qbrates-head': '' }} />}
      footer={
        <>
          <Button variant="ghost" onClick={s.close}>Cancel</Button>
          <Button className="ml-auto max-sm:flex-1" variant="primary" icon={<Check />} disabled={!read || (!picks.length && !usual.length)} onClick={save} data-qbrates-save>{picks.length ? `Save ${picks.length} ${picks.length === 1 ? 'price' : 'prices'}` : 'Save'}</Button>
        </>
      }
      bodyClass="px-6 py-5 max-sm:px-4"
    >
      {!got && <div className="flex items-center gap-2.5 py-10 text-[0.9375rem] text-muted" data-qbrates-loading><RefreshCw className="h-4 w-4 animate-spin" />Reading what we paid each installer…</div>}
      {got && 'error' in got && (
        <div className="flex flex-col items-start gap-3 py-6" data-qbrates-error>
          <div className="text-[0.9375rem] text-ink">{got.error}</div>
          <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>Try again</Button>
        </div>
      )}
      {read && (
        <div className="flex flex-col gap-4" data-qbrates>
          {!crews.length && <div className="rounded-xl border border-line px-4 py-4 text-[0.875rem] text-muted">{only ? `No bills to ${PEOPLE[only]?.short || 'him'} in QuickBooks under a name like his. Match him below.` : 'No bills to the installers in QuickBooks under their names. Match them below.'}</div>}
          {crews.map((c) => <CrewCard key={c.crew} c={c} off={off} onTick={(k) => setOff((o) => ({ ...o, [k]: !o[k] }))} />)}
          {/* the vendors that aren't one of our installers by name: say which one is (or that it isn't) */}
          {read.others.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-line" data-qbrates-others>
              <button type="button" onClick={() => setMore((m) => !m)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-wash/60" aria-expanded={more}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.875rem] font-semibold text-ink">{read.others.length} other {read.others.length === 1 ? 'vendor' : 'vendors'}</span>
                  <span className="block text-[0.8125rem] text-muted">An installer under another name? Match him here.</span>
                </span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-faint transition', more && 'rotate-180')} />
              </button>
              {more && read.others.slice(0, 40).map((o) => (
                <div key={o.vendor.id} className="flex items-center gap-3 border-t border-line-2 px-4 py-2.5" data-qbrates-other={o.vendor.id}>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[0.875rem] text-ink">{o.vendor.name}</span>
                    <span className="block text-[0.78125rem] text-muted">{o.bills} {o.bills === 1 ? 'bill' : 'bills'} · {fmtMoney(o.paid)}</span>
                  </span>
                  <Menu align="end" width={240} trigger={<Button size="sm" iconRight={<ChevronDown className="h-3.5 w-3.5" />} data-qbrates-match={o.vendor.id}>{map[o.vendor.id] ? PEOPLE[map[o.vendor.id] as PersonKey]?.short : 'Is it one of ours?'}</Button>}>
                    <MenuLabel>This is…</MenuLabel>
                    {CREWS.map((k) => <MenuItem key={k} icon={<Avatar who={k} size={20} />} onSelect={() => setMap((m) => ({ ...m, [o.vendor.id]: k }))}>{PEOPLE[k]?.name}</MenuItem>)}
                    <MenuSep />
                    <MenuItem onSelect={() => setMap((m) => ({ ...m, [o.vendor.id]: '' }))}>Not an installer</MenuItem>
                  </Menu>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/** one installer: what we paid him, his usual share of a job, and each price — what he gets now and what his bills say */
function CrewCard({ c, off, onTick }: { c: CrewFromQb; off: Record<string, boolean>; onTick: (k: string) => void }) {
  const s = useStore()
  const line = s.rules.laborPct || LABOR_LINE
  const items = s.items
  return (
    <div className="overflow-hidden rounded-xl border border-line" data-qbrates-crew={c.crew}>
      <div className="flex items-start gap-3 px-4 py-3">
        <Avatar who={c.crew} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block text-[0.96875rem] font-semibold text-ink">{PEOPLE[c.crew]?.name || c.crew}</span>
          <span className="block break-words text-[0.8125rem] text-muted">In QuickBooks: {c.vendors.map((v) => v.name).join(', ')}{c.last ? ` · last ${dayWords(c.last).replace(/, \d{4}$/, '')}` : ''}</span>
          {c.pct != null && <span className={cn('mt-0.5 block text-[0.8125rem]', c.pct > line ? 'font-semibold text-bad-600' : 'text-ink-2')} data-qbrates-pct title={c.jobs.map((j) => `${j.name}: ${j.pct}%`).join(' · ')}>Usually {c.pct}% of the job{c.pct > line ? ` · over the ${line}% budget` : ''} <span className="font-normal text-muted">({c.jobs.length} {c.jobs.length === 1 ? 'job' : 'jobs'})</span></span>}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[0.9375rem] font-semibold tnum text-ink">{fmtMoney(c.paid)}</span>
          <span className="block text-[0.78125rem] text-muted">{c.bills} {c.bills === 1 ? 'bill' : 'bills'}</span>
        </span>
      </div>
      {c.rates.length ? (
        <div className="border-t border-line-2">
          <div className="grid h-8 grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_7.5rem] items-center gap-x-3 bg-wash px-4 text-[0.75rem] font-medium text-faint max-sm:grid-cols-[1.25rem_minmax(0,1fr)_3.75rem_6.25rem] max-sm:gap-x-2.5"><span /><span>Work</span><span className="text-right">Now</span><span className="text-right">QuickBooks</span></div>
          {c.rates.map((r) => {
            const it = items.find((i) => i.id === r.itemId)
            const k = `${c.crew}:${r.itemId}`
            const same = Math.abs(r.rate - r.now) < 0.01
            const on = !same && !off[k]
            return (
              <button key={r.itemId} type="button" role="checkbox" aria-checked={on} disabled={same} onClick={() => onTick(k)} className="grid min-h-[2.75rem] w-full grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_7.5rem] items-center gap-x-3 border-t border-line-2 px-4 py-1.5 text-left transition enabled:hover:bg-wash/60 max-sm:grid-cols-[1.25rem_minmax(0,1fr)_3.75rem_6.25rem] max-sm:gap-x-2.5" data-qbrates-rate={r.itemId}>
                <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-[0.3125rem] border-[1.5px] text-white', on ? 'border-brand-600 bg-brand-600' : 'border-[#c9c2b7] bg-white', same && 'opacity-40')}>{on && <Check className="h-3 w-3" strokeWidth={3} />}</span>
                {/* the work in a few words ("Floor tile", not "Floor tile. Set and grout") */}
                <span className="min-w-0 break-words text-[0.875rem] text-ink" title={it?.name}>{(it?.name || r.itemId).split(/\. | · /)[0]}</span>
                <span className="text-right text-[0.8125rem] tnum text-muted">{money(r.now)}{r.own ? '' : <span className="block text-[0.6875rem] leading-none text-faint">standard</span>}</span>
                <span className="text-right">
                  <span className="block text-[0.875rem] font-semibold tnum text-ink">{money(r.rate)} / {it?.unit || 'SF'}</span>
                  <span className="block text-[0.71875rem] leading-tight text-muted">{same ? 'the same' : `from ${r.n} ${r.n === 1 ? 'line' : 'lines'}`}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="border-t border-line-2 px-4 py-2.5 text-[0.8125rem] text-muted" data-qbrates-norates>His bills have totals only, no price per square foot.{c.pct != null ? ' His usual share of a job is used for his price.' : ''}</div>
      )}
    </div>
  )
}
