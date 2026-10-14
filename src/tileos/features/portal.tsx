/* The GC's login — only their own projects: how far along, the photos, what needs their OK, their invoices, and one
 * message thread with us. Nothing internal shows: no costs, no installer pay, no team-only messages. */
import * as React from 'react'
import { CheckCircle2, Lock, FileText, LogOut, Check } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Avatar, Button, UnderlineTabs } from '@/tileos/components/ui/core'
import { ProgressRing, Status } from '@/tileos/components/ui/page'
import { Swatch } from '@/tileos/components/ui/swatch'
import { showPop } from '@/tileos/lib/pop'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, STAGE_LABEL, fmtMoney } from '@/tileos/data/model'
import { CUSTOMERS, roomPct } from '@/tileos/data/jobs'
import { approveCO004, approveChange } from './flows'
import { Thread, unreadOf } from './messages'

type Tab = 'progress' | 'approvals' | 'invoices' | 'messages'
export function PortalView() {
  const s = useStore()
  const me = meOf('client')
  const member = s.team.find((m) => m.key === me)
  const clientId = member?.clientId || 'parkplace'
  const c = CUSTOMERS[clientId]
  const rank = (st: string) => ['installation', 'punch', 'scheduled', 'ready', 'verification', 'setup', 'awarded', 'closeout', 'complete'].indexOf(st)
  const jobs = Object.values(s.jobs).filter((j) => j.clientId === clientId && !['request', 'estimating', 'proposal', 'followup'].includes(j.stage)).sort((a, b) => rank(a.stage) - rank(b.stage))
  const [jobId, setJobId] = React.useState(jobs[0]?.id || '')
  const [tab, setTab] = React.useState<Tab>('progress')
  const job = s.jobs[jobId]
  const approvals = s.money.filter((m) => m.jobId === jobId && m.kind === 'change' && (m.id === 'co119' ? m.step < 0 : !!m.meta?.sent && m.state === 'upcoming'))
  const invoices = s.money.filter((m) => m.jobId === jobId && m.ref && m.amount)
  const unpaid = invoices.filter((m) => m.state !== 'paid')
  const diary = (s.diary[jobId] || []).flatMap((d) => d.rooms.flatMap((r) => (r.media || []).map((m) => ({ ...m, day: d.day, who: d.who }))))
  /* in this demo the admin is looking through the GC's login */
  const previewing = true
  return (
    <div className="min-h-screen bg-canvas">
      <header className="flex items-center gap-3 border-b border-line bg-white px-6 py-3 max-sm:px-4">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-[0.9375rem] font-black text-white">C</span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[0.9375rem] font-bold text-ink">Cobblestone Tile</span>
          <span className="block truncate text-[0.78125rem] text-muted">for {c?.name}</span>
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          <Avatar who={me} size={30} />
          <span className="text-[0.84375rem] font-semibold text-ink max-sm:hidden">{PEOPLE[me]?.name}</span>
          {previewing && <Button size="sm" icon={<LogOut />} onClick={() => s.setRole('owner')}>Back to me</Button>}
        </span>
      </header>
      {previewing && <div className="bg-brand-50 px-6 py-2 text-center text-[0.8125rem] font-medium text-brand-800">This is what {c?.name} sees when they sign in — only their projects, nothing internal.</div>}
      <main className="mx-auto max-w-[68.75rem] px-6 py-6 max-sm:px-3">
        <h1 className="text-[1.5rem] font-bold tracking-[-0.02em] text-ink">Your projects</h1>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(15.625rem,1fr))] gap-3">
          {jobs.map((j) => (
            <button key={j.id} onClick={() => { setJobId(j.id); setTab('progress') }} className={cn('flex items-center gap-3 rounded-2xl border bg-white p-3.5 text-left transition', jobId === j.id ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-brand-200')}>
              <ProgressRing pct={j.pct ?? 0} size={44} tone={j.hold ? 'bad' : 'ok'} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-bold text-ink">{j.name}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{j.hold ? 'On hold' : STAGE_LABEL[j.stage]}{j.dates?.start ? ` · ${j.dates.start} – ${j.dates.finish}` : ''}</span>
              </span>
              {unreadOf(s, j.id) > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[0.6875rem] font-bold text-white">{unreadOf(s, j.id)}</span>}
            </button>
          ))}
        </div>
        {job && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
            <div className="flex flex-wrap items-center gap-4 px-6 pb-2 pt-5 max-sm:px-4">
              <div className="min-w-0 flex-1">
                <div className="text-[1.375rem] font-bold tracking-[-0.02em] text-ink">{job.name}</div>
                <div className="text-[0.84375rem] text-muted">{job.address}</div>
              </div>
              <Button icon={<FileText />} onClick={() => s.open({ t: 'sow', jobId: job.id })}>Scope of work</Button>
            </div>
            <UnderlineTabs className="px-6 max-sm:px-4" value={tab} onChange={setTab} items={[{ key: 'progress', label: 'Progress' }, { key: 'approvals', label: 'Needs your OK', count: approvals.length || undefined, tone: 'bad' }, { key: 'invoices', label: 'Invoices', count: unpaid.length || undefined }, { key: 'messages', label: 'Messages', count: unreadOf(s, job.id) || undefined }]} />
            <div className={cn(tab === 'messages' ? 'h-[35rem]' : 'px-6 py-5 max-sm:px-4')}>
              {tab === 'progress' && (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-center gap-5">
                    <ProgressRing pct={job.pct ?? 0} size={72} tone={job.hold ? 'bad' : 'ok'} />
                    <div>
                      <div className="text-[1.125rem] font-bold text-ink">{job.pct ?? 0}% installed</div>
                      <div className="text-[0.84375rem] text-muted">{job.hold ? `On hold · ${job.hold.reason}` : STAGE_LABEL[job.stage]}{job.dates?.start ? ` · ${job.dates.start} – ${job.dates.finish}` : ''}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 max-sm:grid-cols-1">
                    {(s.rooms[job.id] || []).map((r) => {
                      const p = roomPct(r)
                      return (
                        <div key={r.name} className="flex items-center gap-3">
                          <span className="w-[9.375rem] truncate text-[0.84375rem] font-semibold text-ink">{r.name}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-wash-2"><span className="block h-full rounded-full bg-ok-500" style={{ width: p + '%' }} /></span>
                          <span className="w-10 text-right text-[0.78125rem] font-bold tnum text-ink-2">{p}%</span>
                        </div>
                      )
                    })}
                  </div>
                  {diary.length > 0 && (
                    <div>
                      <div className="mb-2 text-[0.8125rem] font-semibold text-muted">Latest photos</div>
                      <div className="flex flex-wrap gap-2">
                        {diary.slice(0, 8).map((m, i) => (
                          <button key={i} onClick={() => s.open({ t: 'media', items: diary, index: i })} className="overflow-hidden rounded-xl ring-1 ring-black/5">
                            <Swatch kind={m.sw || 'bianco'} size={96} radius={12} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {tab === 'approvals' && (
                <div className="flex flex-col gap-3">
                  {approvals.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line p-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.9375rem] font-bold text-ink">{m.title}</div>
                        <div className="text-[0.8125rem] text-muted">{m.note}</div>
                      </div>
                      <div className="text-[1.125rem] font-bold tnum text-ink">{fmtMoney(m.amount || m.meta?.estimate || 0)}</div>
                      <Button variant="primary" icon={<Check />} onClick={() => { if (m.id === 'co119') approveCO004({ by: c?.name || 'the GC', how: 'Approved in the GC login' }); else approveChange(m.id, { by: c?.name || 'the GC', how: 'Approved in the GC login' }) }}>Approve</Button>
                    </div>
                  ))}
                  {!approvals.length && <div className="flex items-center gap-2 py-6 text-[0.875rem] text-muted"><CheckCircle2 className="h-5 w-5 text-ok-500" />Nothing waiting for your OK.</div>}
                </div>
              )}
              {tab === 'invoices' && (
                <div className="flex flex-col divide-y divide-line-2 rounded-2xl border border-line">
                  {invoices.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.90625rem] font-semibold text-ink">Invoice {m.ref} · {m.title}</div>
                        <div className="text-[0.78125rem] text-muted">{m.state === 'paid' ? `Paid ${m.date || ''}` : m.due}</div>
                      </div>
                      <div className="text-[0.9375rem] font-bold tnum text-ink">{fmtMoney((m.amount || 0) - (m.paid || 0))}</div>
                      {m.state === 'paid' ? <Status tone="ok">Paid</Status> : <Button variant="primary" icon={<Lock />} onClick={() => showPop({ title: 'QuickBooks Payments opens', sub: 'Card or bank transfer on their secure page — card numbers never touch Tile OS. The payment shows here by itself.' })}>Pay securely</Button>}
                    </div>
                  ))}
                  {!invoices.length && <div className="px-4 py-6 text-[0.875rem] text-muted">No invoices yet.</div>}
                </div>
              )}
              {tab === 'messages' && <Thread jobId={job.id} outside />}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
