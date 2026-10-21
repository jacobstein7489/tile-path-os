/* Inbox — conversations, like a messaging app: one per project. The GC, the crew and our team talk there, with
 * photos, and what the app noticed (a delivery, an approval, a daily update) lands in the same conversation as a
 * quiet line. Newest on top, a blue count for what's new; tap one and the conversation opens. On a phone the list
 * and the conversation are two screens; on a desktop they sit side by side. */
import * as React from 'react'
import { ChevronLeft, Building2, Package, FileText, Receipt, HardHat, Repeat, Bell, Search, MoreHorizontal, Mail, MailOpen, Inbox, Archive } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { NOW } from '@/tileos/lib/today'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import type { Notice } from '@/tileos/data/work'
import { Thread } from './messages'
import markUrl from '@/tileos/assets/mark.svg'

const ICON: Record<Notice['kind'], React.ElementType> = { material: Package, pricing: FileText, money: Receipt, field: HardHat, change: Repeat }

export type Convo = {
  key: string
  jobId?: string
  name: string
  sub?: string
  /** the last thing said or noticed */
  preview: string
  when: string
  unread: number
  /** put away (until something new lands in it) */
  away: boolean
  /** the newest thing's place in time — for the order (today's messages first, then by the notice's own order) */
  rank: number
}
type St = ReturnType<typeof useStore.getState>
/** the news this login gets: the books see money; a delivered request goes only to whoever asked */
export const noticesFor = (s: St, me: PersonKey) => (s.role === 'accounting' ? s.notices.filter((n) => n.kind === 'money') : s.notices).filter((n) => !n.for || n.for.includes(me))
const seenKey = (key: string, me: PersonKey) => `${key}|${me}`

/** every conversation for this login: each project with messages or news, plus Tile OS for company-wide news.
 *  Read is per person: what you've opened is read for you, not for everyone. */
export function conversations(s: St, withAway = false): Convo[] {
  const me = meOf(s.role)
  const notices = noticesFor(s, me)
  const out: Convo[] = []
  const jobIds = new Set<string>([...Object.keys(s.messages).filter((j) => (s.messages[j] || []).length), ...notices.filter((n) => n.jobId).map((n) => n.jobId!)])
  jobIds.forEach((jobId) => {
    const job = s.jobs[jobId]
    if (!job) return
    const msgs = s.messages[jobId] || []
    const last = msgs[msgs.length - 1]
    const news = notices.filter((n) => n.jobId === jobId)
    const fresh = news.filter((n) => n.unread)
    const seen = s.seen?.[seenKey(jobId, me)]
    const newMsgs = msgs.slice(seen?.n || 0).filter((m) => m.who !== me).length
    const unread = fresh.length + newMsgs + (seen?.unread && !newMsgs && !fresh.length ? 1 : 0)
    const away = !!seen?.away && seen.away >= msgs.length && !fresh.length
    if (away && !withAway) return
    const newest = fresh[0]
    const preview = newest ? newest.text : last ? `${last.who === me ? 'You' : PEOPLE[last.who]?.short || ''}: ${last.audio ? '🎤 Voice note' : last.text}` : news[0]?.text || ''
    const when = newest ? newest.when : last ? (last.date === NOW ? last.time : last.date) : news[0]?.when || ''
    const rank = (fresh.length ? 1000 : 0) + (newMsgs ? 500 : 0) + (last?.date === NOW ? 100 : 0) - notices.findIndex((n) => n.jobId === jobId) * 0.001
    out.push({ key: jobId, jobId, name: job.name, sub: job.client, preview, when, unread, away, rank })
  })
  const company = notices.filter((n) => !n.jobId)
  if (company.length) {
    const seen = s.seen?.[seenKey('tileos', me)]
    const fresh = company.filter((n) => n.unread).length
    const away = !!seen?.away && !fresh
    if (!away || withAway) out.push({ key: 'tileos', name: 'Tile OS', sub: 'The company', preview: company[0].text, when: company[0].when, unread: fresh + (seen?.unread && !fresh ? 1 : 0), away, rank: fresh ? 999 : -1 })
  }
  return out.sort((a, b) => b.rank - a.rank)
}
export const inboxUnread = (s: St) => conversations(s).reduce((n, c) => n + c.unread, 0)

/** opening a conversation: everything in it is read, for you */
export function markRead(key: string, jobId?: string) {
  const st = useStore.getState()
  const me = meOf(st.role)
  const k = seenKey(key, me)
  const n = jobId ? (st.messages[jobId] || []).length : 0
  const cur = st.seen?.[k]
  const news = noticesFor(st, me).filter((x) => (jobId ? x.jobId === jobId : !x.jobId) && x.unread)
  if (cur && cur.n === n && !cur.unread && !news.length) return
  st.commit((x) => {
    x.seen ||= {}
    x.seen[k] = { n }
    x.notices.forEach((y) => { if ((jobId ? y.jobId === jobId : !y.jobId) && y.unread) y.unread = false })
  })
}
/** put a conversation away (it comes back when something new lands), or bring it back */
export function putAway(key: string, jobId: string | undefined, on: boolean) {
  const st = useStore.getState()
  const me = meOf(st.role)
  const k = seenKey(key, me)
  const n = jobId ? (st.messages[jobId] || []).length : 0
  st.commit((x) => { x.seen ||= {}; const cur = x.seen[k] || { n }; x.seen[k] = on ? { ...cur, n, away: n, unread: false } : { n: cur.n } }, on ? 'Put away' : 'Back in the inbox', { sub: on ? 'It comes back the moment something new lands in it.' : undefined })
}
/** mark it unread — it stays bold with a 1 until you open it again */
export function markUnread(key: string, jobId?: string) {
  const st = useStore.getState()
  const me = meOf(st.role)
  const k = seenKey(key, me)
  const n = jobId ? (st.messages[jobId] || []).length : 0
  st.commit((x) => { x.seen ||= {}; x.seen[k] = { ...(x.seen[k] || { n }), unread: true, away: undefined } }, 'Marked unread')
}

/** the news in a conversation — what the app noticed on that project, as quiet lines */
function News({ jobId }: { jobId?: string }) {
  const s = useStore()
  const list = noticesFor(s, meOf(s.role)).filter((n) => (jobId ? n.jobId === jobId : !n.jobId))
  if (!list.length) return null
  return (
    <div className="mb-4">
      <div className="mb-2 text-center text-[0.75rem] font-semibold text-faint">What happened</div>
      <div className="flex flex-col items-center gap-1.5">
        {[...list].reverse().map((n) => {
          const Ic = ICON[n.kind]
          return (
            <button key={n.id} onClick={() => { if (n.open) s.open(n.open); else if (n.jobId) s.open({ t: 'job', id: n.jobId }) }} className={cn('inline-flex max-w-[90%] items-center gap-2 rounded-full px-3 py-1.5 text-left text-[0.8125rem] leading-snug transition hover:bg-[#ebe7df]', n.unread ? 'bg-brand-50 font-semibold text-brand-800' : 'bg-wash text-ink-2')}>
              <Ic className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0">{n.text}</span><span className="shrink-0 text-[0.71875rem] font-normal text-muted">{n.when}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Face({ c }: { c: Convo }) {
  if (!c.jobId) return <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#22372b]"><img src={markUrl} alt="" width={26} height={26} style={{ filter: 'brightness(0) invert(1)' }} /></span>
  /* initials from the words, not the house number: "119 Park Place" → PP, "530 Mark" → M */
  const words = c.name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean)
  const ini = (words[0]?.[0] || '') + (words[1]?.[0] || '')
  return <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#dde5f9] text-[0.9375rem] font-bold text-[#1f42ad]">{ini ? ini.toUpperCase() : <Building2 className="h-5 w-5" />}</span>
}

export function InboxPage() {
  const s = useStore()
  const all = conversations(s, true)
  const [q, setQ] = React.useState('')
  const [picked, setPicked] = React.useState<string | null>(null)
  /* New: what you haven't seen. All: everything that isn't put away. Put away: what you filed — it comes back on its own */
  const [view, setView] = React.useState<'all' | 'new' | 'away'>('all')
  const list = all.filter((c) => !c.away)
  const unreadN = list.reduce((n, c) => n + c.unread, 0)
  const shown = (view === 'away' ? all.filter((c) => c.away) : view === 'new' ? list.filter((c) => c.unread > 0) : list).filter((c) => !q.trim() || `${c.name} ${c.sub || ''} ${c.preview}`.toLowerCase().includes(q.trim().toLowerCase()))
  const cur = all.find((c) => c.key === picked) || null
  /* opening a conversation reads it — for you */
  const openConvo = (c: Convo) => { setPicked(c.key); markRead(c.key, c.jobId) }
  /* while it's open, what lands in it is read too */
  const curMsgs = cur?.jobId ? (s.messages[cur.jobId] || []).length : 0
  React.useEffect(() => { if (cur) markRead(cur.key, cur.jobId) }, [cur?.key, curMsgs]) // eslint-disable-line react-hooks/exhaustive-deps
  const team = (jobId: string) => { const j = s.jobs[jobId]; return j ? Array.from(new Set([j.pm || 'ys', 'yakov', ...(j.crew ? [j.crew] : [])])) as (keyof typeof PEOPLE)[] : [] }
  return (
    <div className="mx-auto flex w-full max-w-[86.25rem] min-h-0 flex-col px-7 pb-4 pt-5 max-xl:px-6 max-lg:px-0 max-lg:pb-0 max-lg:pt-0" style={{ height: 'calc(100dvh - var(--app-top, 0px) - var(--inbox-bottom, 0px))' }}>
      <div className={cn('grid min-h-0 flex-1 overflow-hidden rounded-[1rem] border border-[#ebe6dd] bg-white shadow-card max-lg:rounded-none max-lg:border-0 max-lg:shadow-none', 'grid-cols-[minmax(0,1fr)] lg:grid-cols-[22rem_minmax(0,1fr)]')}>
        {/* the conversations */}
        <div className={cn('flex min-h-0 min-w-0 flex-col border-r border-line-2 max-lg:border-r-0', cur && 'max-lg:hidden')}>
          <div className="flex items-center gap-2 border-b border-line-2 px-4 py-3">
            <h1 className="font-display text-[1.25rem] font-semibold text-ink max-lg:hidden">Inbox</h1>
            <label className="relative ml-auto flex min-w-0 flex-1 items-center lg:max-w-[12rem]">
              <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search the inbox" className="h-9 w-full rounded-full border border-line bg-wash pl-8 pr-3 text-[0.875rem] text-ink outline-none placeholder:text-faint focus:border-brand-300 focus:bg-white" />
            </label>
          </div>
          <div className="flex items-center gap-1.5 border-b border-line-2 px-3 py-2">
            {([['all', 'All'], ['new', 'New'], ['away', 'Put away']] as const).map(([k, label]) => {
              const on = view === k
              const n = k === 'new' ? unreadN : k === 'away' ? all.filter((c) => c.away).length : 0
              if (k === 'away' && !n) return null
              return <button key={k} onClick={() => setView(k)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold transition', on ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-wash')}>{label}{n > 0 && <span className={cn('rounded-full px-1.5 text-[0.71875rem] tnum', on ? 'bg-white/20' : k === 'new' ? 'bg-bad-500 text-white' : 'bg-wash-2 text-ink-2')}>{n}</span>}</button>
            })}
            <span className="ml-auto text-[0.75rem] text-faint">{list.length} {list.length === 1 ? 'conversation' : 'conversations'}</span>
          </div>
          <div className="scroll-soft min-h-0 flex-1 overflow-y-auto">
            {shown.map((c) => {
              const on = cur?.key === c.key
              return (
                <div key={c.key} className={cn('group relative border-b border-line-2 transition hover:bg-[#f8f6f2]', on && 'bg-brand-50/60 hover:bg-brand-50/60')}>
                  <button onClick={() => openConvo(c)} data-convo={c.key} className="flex w-full items-center gap-3 px-4 py-3 pr-11 text-left">
                    <Face c={c} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={cn('min-w-0 flex-1 truncate text-[0.9375rem]', c.unread ? 'font-bold text-ink' : 'font-semibold text-ink')}>{c.name}</span>
                        <span className={cn('shrink-0 text-[0.75rem] tnum', c.unread ? 'font-semibold text-bad-600' : 'text-muted')}>{c.when}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cn('min-w-0 flex-1 truncate text-[0.8125rem]', c.unread ? 'font-medium text-ink-2' : 'text-muted')}>{c.preview}</span>
                        {c.unread > 0 && <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-bad-500 px-1.5 text-[0.71875rem] font-bold tnum text-white">{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                  {/* unread · put away — like any messaging app */}
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 max-lg:opacity-100">
                    <Menu align="end" width={220} trigger={<button aria-label={`More for ${c.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
                      {c.unread ? <MenuItem icon={<MailOpen className="h-4 w-4" />} onSelect={() => markRead(c.key, c.jobId)}>Mark as read</MenuItem> : <MenuItem icon={<Mail className="h-4 w-4" />} onSelect={() => markUnread(c.key, c.jobId)}>Mark as unread</MenuItem>}
                      {c.away ? <MenuItem icon={<Inbox className="h-4 w-4" />} onSelect={() => putAway(c.key, c.jobId, false)}>Back to the inbox</MenuItem> : <MenuItem icon={<Archive className="h-4 w-4" />} hint="It comes back when something new lands" onSelect={() => { putAway(c.key, c.jobId, true); if (on) setPicked(null) }}>Put away</MenuItem>}
                      {c.jobId && <MenuItem icon={<Building2 className="h-4 w-4" />} onSelect={() => s.open({ t: 'job', id: c.jobId })}>Open the project</MenuItem>}
                    </Menu>
                  </span>
                </div>
              )
            })}
            {!shown.length && <div className="px-4 py-12 text-center text-[0.875rem] text-muted">{q ? 'Nothing matches.' : view === 'new' ? 'Nothing new. You’ve seen it all.' : view === 'away' ? 'Nothing put away.' : 'Nothing here yet — when someone writes on a project, or something moves, it lands here.'}</div>}
          </div>
        </div>
        {/* the conversation */}
        <div className={cn('flex min-h-0 min-w-0 flex-col', !cur && 'max-lg:hidden')}>
          {cur ? (
            <>
              <div className="flex shrink-0 items-center gap-2.5 border-b border-line-2 px-4 py-2.5">
                <button onClick={() => setPicked(null)} aria-label="Back to the inbox" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-wash lg:hidden"><ChevronLeft className="h-5 w-5" /></button>
                <Face c={cur} />
                <span className="min-w-0 flex-1">
                  <button onClick={() => cur.jobId && s.open({ t: 'job', id: cur.jobId })} className="block max-w-full truncate text-left text-[1rem] font-semibold text-ink hover:underline">{cur.name}</button>
                  <span className="block truncate text-[0.78125rem] text-muted">{cur.jobId ? `${team(cur.jobId).map((p) => PEOPLE[p]?.short).join(', ')} and the GC` : 'What the app noticed, company-wide'}</span>
                </span>
                {cur.jobId && <span className="flex -space-x-1.5 max-sm:hidden">{team(cur.jobId).map((p) => <Avatar key={p} who={p} size={26} ring />)}</span>}
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {cur.jobId ? <div className="min-h-0 flex-1"><Thread jobId={cur.jobId} top={<News jobId={cur.jobId} />} /></div> : <div className="scroll-soft min-h-0 flex-1 overflow-y-auto pb-6"><News /></div>}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-wash text-muted"><Bell className="h-6 w-6" /></span>
              <div className="text-[1rem] font-semibold text-ink">Pick a conversation</div>
              <div className="max-w-sm text-[0.875rem] text-muted">Every project is one conversation: the GC, the crew, our team — and what the app noticed, in the same place. Five messages on a job are one conversation with a red 5. Open it and the count clears, for you. Done with it? Put it away — it comes back by itself when something new lands. If a message needs doing, “Make it a task” puts it on someone’s Today.</div>
            </div>
          )}
        </div>
      </div>
    </div>
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
      <span className="min-w-0 flex-1 text-[0.875rem] font-semibold text-brand-800">{n === 1 ? '1 new in your inbox' : `${n} new in your inbox`}</span>
      <span className="text-[0.8125rem] font-semibold text-brand-700">Open</span>
    </button>
  )
}
