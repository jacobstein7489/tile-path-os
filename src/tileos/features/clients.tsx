/* Clients — one plain list: who they are, who we deal with, their projects, what's open and what they owe. */
import * as React from 'react'
import { ChevronRight, Plus, Handshake } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore, canSee } from '@/tileos/store'
import { Card, Button, Empty, PageHeader, SearchField, Dot } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, type Job, type Tone } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'

const worst = (list: Job[]): Tone => (list.some((j) => j.status === 'bad') ? 'bad' : list.some((j) => j.status === 'warn') ? 'warn' : 'ok')

export function ClientsPage() {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const seeMoney = canSee(s.role, 'money')
  const jobs = Object.values(s.jobs)

  const rows = Object.values(CUSTOMERS).map((c) => {
    const theirs = jobs.filter((j) => j.clientId === c.id && j.stage !== 'complete')
    const ids = new Set(theirs.map((j) => j.id))
    const openItems = s.tasks.filter((t) => t.state !== 'done' && ids.has(t.jobId)).length
    const owed = s.money.filter((m) => ids.has(m.jobId) && m.state === 'waiting' && m.amount).reduce((n, m) => n + (m.amount || 0) - (m.paid || 0), 0)
    return { c, theirs, openItems, owed }
  })
  const shown = rows
    .filter((r) => {
      if (!q) return true
      const hay = `${r.c.name} ${r.c.address} ${r.c.contacts.map((p) => p.role).join(' ')} ${r.theirs.map((j) => j.name).join(' ')}`.toLowerCase()
      return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))
    })
    .sort((a, b) => a.c.name.localeCompare(b.c.name))
  const cols = seeMoney ? 'grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_6.875rem_7.5rem_1.25rem]' : 'grid-cols-[minmax(0,1.3fr)_minmax(0,1.6fr)_6.875rem_1.25rem]'

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Clients"
        sub={`${rows.length} clients and the people we deal with there. Click one to see everything about them.`}
        actions={<Button variant="primary" icon={<Plus className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.4} />} onClick={() => toast('Add a client — name, the people you deal with, and their billing terms')}>Add client</Button>}
      />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 max-sm:px-4">
          <SearchField value={q} onChange={setQ} placeholder="Search a client, a person or a project…" className="w-[26.25rem] max-md:w-full" />
          <span className="ml-auto text-[0.84375rem] text-muted max-md:hidden">{shown.length} shown</span>
        </div>
        <div className={cn('grid items-center gap-5 border-y border-line bg-wash px-6 py-2.5 text-[0.78125rem] font-semibold text-muted max-md:hidden', cols)}>
          <span>Client</span>
          <span>Projects</span>
          <span>Open items</span>
          {seeMoney && <span className="text-right">They owe us</span>}
          <span />
        </div>
        {shown.map(({ c, theirs, openItems, owed }) => {
          const tone = theirs.length ? worst(theirs) : 'neutral'
          return (
            <button key={c.id} onClick={() => s.open({ t: 'customer', id: c.id })} className={cn('group grid w-full items-center gap-5 border-b border-line-2 px-6 py-3.5 text-left transition-colors last:border-0 hover:bg-wash max-md:grid-cols-[minmax(0,1fr)_1.25rem] max-md:gap-x-3 max-md:gap-y-1 max-sm:px-4', cols)}>
              <span className="min-w-0">
                <span className="block truncate text-[0.9375rem] font-semibold text-ink group-hover:text-brand-700">{c.name}</span>
                <span className="block truncate text-[0.8125rem] text-muted">{c.contacts[0]?.role || 'Office'} · {c.phone}</span>
              </span>
              <span className="min-w-0 max-md:row-start-2">
                {theirs.length ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <Dot tone={tone} />
                    <span className="truncate text-[0.875rem] text-ink-2">{theirs.map((j) => j.name).join(', ')}</span>
                  </span>
                ) : (
                  <span className="text-[0.875rem] text-faint">No projects running</span>
                )}
              </span>
              <span className="text-[0.875rem] tnum text-ink-2 max-md:hidden">{openItems || '—'}</span>
              {seeMoney && <span className={cn('text-right text-[0.90625rem] font-semibold tnum max-md:hidden', owed ? 'text-ink' : 'text-faint')}>{owed ? fmtMoney(owed) : '—'}</span>}
              <ChevronRight className="h-[1.125rem] w-[1.125rem] text-faint transition group-hover:translate-x-0.5 group-hover:text-ink-2 max-md:col-start-2 max-md:row-start-1" />
            </button>
          )
        })}
        {!shown.length && <Empty icon={<Handshake className="h-6 w-6" />} title="No clients match" sub="Try another search." />}
      </Card>
    </div>
  )
}
