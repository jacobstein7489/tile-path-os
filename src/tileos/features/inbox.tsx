/* Inbox — everything that happened that concerns you, in one list, newest first: things put on your desk, problems
 * logged, what the crews sent, approvals, deliveries, messages. New ones sit on top until you've seen them. Tap one
 * and it opens the project. The count on the Inbox menu item (and the bell on a phone) is how many are new. */
import * as React from 'react'
import { Package, FileText, Receipt, HardHat, Repeat, Bell, MessageCircle, Check, Inbox as InboxIcon } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Page, Bubbles, EmptyState } from '@/tileos/components/ui/page'
import { Button } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { NOW } from '@/tileos/lib/today'
import type { Notice } from '@/tileos/data/work'

const ICON: Record<Notice['kind'] | 'message', React.ElementType> = { material: Package, pricing: FileText, money: Receipt, field: HardHat, change: Repeat, message: MessageCircle }
const KIND_WORD: Record<Notice['kind'] | 'message', string> = { material: 'Materials', pricing: 'Estimates', money: 'Money', field: 'From the site', change: 'Changes', message: 'Message' }

export type InboxRow = { id: string; kind: Notice['kind'] | 'message'; text: string; sub?: string; when: string; unread: boolean; jobId?: string; open: () => void; seen: () => void }

/** what's in the inbox for this login: notices (accounting sees money only) and today's new messages on projects */
export function inboxRows(s: ReturnType<typeof useStore.getState>): InboxRow[] {
  const me = meOf(s.role)
  const notices = (s.role === 'accounting' ? s.notices.filter((n) => n.kind === 'money') : s.notices).map<InboxRow>((n) => ({
    id: n.id, kind: n.kind, text: n.text, sub: n.jobId && s.jobs[n.jobId] ? s.jobs[n.jobId].name : undefined, when: n.when, unread: n.unread, jobId: n.jobId,
    seen: () => s.commit((x) => { const y = x.notices.find((z) => z.id === n.id); if (y) y.unread = false }),
    open: () => { if (n.open) s.open(n.open); else if (n.jobId && s.jobs[n.jobId]) s.open({ t: 'job', id: n.jobId }) },
  }))
  const msgs: InboxRow[] = Object.entries(s.messages).flatMap(([jobId, list]) => {
    const job = s.jobs[jobId]
    if (!job) return []
    const today = list.filter((m) => m.date === NOW && m.who !== me)
    if (!today.length) return []
    const last = today[today.length - 1]
    return [{ id: 'msg:' + jobId, kind: 'message' as const, text: `${today.length === 1 ? 'A message' : `${today.length} messages`} on ${job.name}`, sub: last.text.slice(0, 90), when: 'Today', unread: true, jobId, seen: () => {}, open: () => s.open({ t: 'chat', jobId }) }]
  })
  return [...msgs, ...notices]
}
export const inboxUnread = (s: ReturnType<typeof useStore.getState>) => inboxRows(s).filter((r) => r.unread).length

export function InboxPage() {
  const s = useStore()
  const rows = inboxRows(s)
  const unread = rows.filter((r) => r.unread)
  const [view, setView] = React.useState<'new' | 'all'>(() => (unread.length ? 'new' : 'all'))
  const list = view === 'new' ? unread : rows
  const markAll = () => s.commit((x) => x.notices.forEach((n) => (n.unread = false)))
  return (
    <Page
      title="Inbox"
      actions={unread.length > 0 ? <Button icon={<Check />} onClick={markAll}>I’ve seen them all</Button> : undefined}
      top={<Bubbles items={[
        { key: 'new', label: 'New', count: unread.length, icon: <Bell />, color: 'blue', on: view === 'new', onClick: () => setView('new') },
        { key: 'all', label: 'Everything', count: rows.length, icon: <InboxIcon />, color: 'slate', on: view === 'all', onClick: () => setView('all') },
      ]} />}
    >
      {list.length ? (
        <div className="overflow-hidden rounded-[1rem] border border-[#ebe6dd] bg-white shadow-card">
          {list.map((r) => {
            const Ic = ICON[r.kind]
            return (
              <button key={r.id} onClick={() => { r.seen(); r.open() }} className="flex w-full items-start gap-3.5 border-t border-line-2 px-5 py-3.5 text-left transition first:border-t-0 hover:bg-[#f8f6f2] max-sm:px-4">
                <span className={cn('mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem]', r.unread ? 'bg-brand-50 text-brand-600' : 'bg-wash-2 text-muted')}><Ic className="h-[1.125rem] w-[1.125rem]" /></span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-[0.9375rem] leading-snug', r.unread ? 'font-semibold text-ink' : 'text-ink-2')}>{r.text}</span>
                  <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">{[KIND_WORD[r.kind], r.sub].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-[0.78125rem] tnum text-muted">{r.when}</span>
                  {r.unread && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={<InboxIcon />} title={view === 'new' ? 'Nothing new' : 'Nothing here yet'} sub={view === 'new' ? 'When something moves on a project you’re on, it lands here.' : 'What the crews send, what gets approved, what’s delivered — it all lands here.'} action={view === 'new' && rows.length ? <Button onClick={() => setView('all')}>See everything</Button> : undefined} />
      )}
    </Page>
  )
}

/** on Today: one line when there's something new, tap it to open the inbox */
export function InboxStrip() {
  const s = useStore()
  const n = inboxUnread(s)
  if (!n) return null
  return (
    <button onClick={() => s.go({ page: 'inbox' })} className="mb-3 flex w-full items-center gap-3 rounded-[0.875rem] border border-brand-100 bg-brand-50 px-4 py-2.5 text-left transition hover:bg-[#e8eefb]">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[0.8125rem] font-bold tnum text-white">{n}</span>
      <span className="min-w-0 flex-1 text-[0.875rem] font-semibold text-brand-800">{n === 1 ? '1 new thing in your inbox' : `${n} new things in your inbox`}</span>
      <span className="text-[0.8125rem] font-semibold text-brand-700">Open</span>
    </button>
  )
}
