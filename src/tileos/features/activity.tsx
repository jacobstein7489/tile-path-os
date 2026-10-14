/* Everything that's logged can be opened. A log line links to its record (a PO, an invoice, a payment,
 * a change order, an estimate, a daily update); anything else opens the entry itself with all its details. */
import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import type { HistEntry } from '@/tileos/data/jobs'

export type Ref = { t: string; [k: string]: any }
const KIND_LABEL: Record<string, string> = { field: 'Field', change: 'Change', question: 'Question', material: 'Materials', money: 'Billing', schedule: 'Schedule', decision: 'Decision', setup: 'Setup', pricing: 'Estimate', system: 'System' }

/** find the record a line talks about, from its text when it was logged before links existed */
export function refFor(s: Store, text: string, jobId?: string, given?: Ref): Ref | undefined {
  if (given) return given
  const ipo = text.match(/\bIPO-[A-Z0-9-]+\b/)
  if (ipo && s.ipos.some((p) => p.id === ipo[0])) return { t: 'ipo', id: ipo[0] }
  const po = text.match(/\bPO-\d{4}\b/)
  if (po && s.pos.some((p) => p.id === po[0])) return { t: 'po', id: po[0] }
  const est = text.match(/\bE-\d{4}\b/)
  if (est && s.estimates.some((e) => e.id === est[0])) return { t: 'estimate', id: est[0] }
  const inv = text.match(/#\d{4}\b/)
  if (inv) {
    const m = s.money.find((x) => x.ref === inv[0])
    if (m) return { t: 'money', id: m.id }
  }
  const co = text.match(/\bCO-\d{3}\b/)
  if (co) {
    const m = s.money.find((x) => x.title.startsWith(co[0]) && (!jobId || x.jobId === jobId))
    if (m) return { t: 'money', id: m.id }
  }
  if (jobId && /deposit/i.test(text)) {
    const m = s.money.find((x) => x.jobId === jobId && x.kind === 'deposit')
    if (m) return { t: 'money', id: m.id }
  }
  if (jobId && /progress bill/i.test(text)) {
    const m = s.money.find((x) => x.jobId === jobId && x.kind === 'progress' && x.state !== 'upcoming')
    if (m) return { t: 'money', id: m.id }
  }
  if (jobId && /daily update|crew report/i.test(text) && s.diary[jobId]?.length) return { t: 'diary', jobId }
  if (jobId && /^(awarded|revision \d|price request|r\d sent)/i.test(text)) {
    const e = s.estimates.find((x) => x.jobId === jobId)
    if (e) return { t: 'estimate', id: e.id }
  }
  return undefined
}
export const refLabel = (r: Ref) =>
  r.t === 'po' ? `Open ${r.id}` : r.t === 'ipo' ? `Open ${r.id}` : r.t === 'estimate' ? `Open estimate ${r.id}` : r.t === 'money' ? 'Open the billing record' : r.t === 'diary' ? 'Open the daily log' : 'Open'
export function openRef(s: Store, r: Ref) {
  if (r.t === 'diary') return s.open({ t: 'job', id: r.jobId, tab: 'rooms' })
  s.open(r)
}

/** one line of a log, always clickable */
export function ActivityRow({ e, jobId, compact }: { e: HistEntry; jobId?: string; compact?: boolean }) {
  const s = useStore()
  return (
    <button
      onClick={() => s.open({ t: 'activity', entry: e, jobId })}
      className={cn('group flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-wash', compact && 'py-2')}
    >
      <Avatar who={e.who} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.875rem] leading-snug text-ink">{e.title}</span>
        {e.detail && !compact && <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] text-muted">{e.detail}</span>}
        <span className="mt-0.5 block text-[0.78125rem] text-faint">{PEOPLE[e.who]?.name} · {e.date}</span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

export function ActivityModal({ entry, jobId, level }: { entry: HistEntry & { text?: string }; jobId?: string; level: number }) {
  const s = useStore()
  const job = jobId ? s.jobs[jobId] : undefined
  const title = entry.title || entry.text || ''
  const r = refFor(s, `${title} ${entry.detail || ''}`, jobId, entry.ref)
  const who = entry.who as PersonKey
  return (
    <Modal
      level={level}
      size="sm"
      onClose={s.close}
      title={title}
      sub={`${PEOPLE[who]?.name || 'Tile OS'} · ${entry.date}`}
      footer={
        <>
          {job && <Button variant="ghost" onClick={() => s.open({ t: 'job', id: job.id, tab: 'history' })}>Open {job.name}</Button>}
          {r && <Button className="ml-auto" variant="primary" onClick={() => openRef(s, r)}>{refLabel(r)}</Button>}
          {!r && <Button className="ml-auto" onClick={s.close}>Close</Button>}
        </>
      }
    >
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-3 text-[0.875rem]">
        <dt className="text-muted">What happened</dt>
        <dd className="text-ink">{title}</dd>
        {entry.detail && (
          <>
            <dt className="text-muted">Details</dt>
            <dd className="text-ink-2">{entry.detail}</dd>
          </>
        )}
        {(entry.from || entry.to) && (
          <>
            <dt className="text-muted">Changed</dt>
            <dd className="text-ink-2">{entry.from || '—'} → <span className="font-medium text-ink">{entry.to || '—'}</span></dd>
          </>
        )}
        <dt className="text-muted">Who</dt>
        <dd className="flex items-center gap-2 text-ink-2"><Avatar who={who} size={22} />{PEOPLE[who]?.name}{PEOPLE[who]?.roleLabel ? <span className="text-muted">· {PEOPLE[who]?.roleLabel}</span> : null}</dd>
        <dt className="text-muted">When</dt>
        <dd className="text-ink-2">{entry.date}</dd>
        {entry.kind && (
          <>
            <dt className="text-muted">Type</dt>
            <dd className="text-ink-2">{KIND_LABEL[entry.kind] || entry.kind}</dd>
          </>
        )}
        {job && (
          <>
            <dt className="text-muted">Project</dt>
            <dd><button onClick={() => s.open({ t: 'job', id: job.id })} className="font-medium text-brand-700 hover:underline">{job.name}</button></dd>
          </>
        )}
      </dl>
    </Modal>
  )
}
