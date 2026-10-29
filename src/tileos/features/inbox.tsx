/* Inbox — conversations, like a messaging app: one per project. The GC, the crew and our team talk there, with
 * photos, and what the app noticed (a delivery, an approval, a daily update) lands in the same conversation as a
 * quiet line. Newest on top, a blue count for what's new; tap one and the conversation opens. On a phone the list
 * and the conversation are two screens; on a desktop they sit side by side. */
import * as React from 'react'
import { Building2, Search, MoreHorizontal, Mail, MailOpen, Inbox, Archive, MessageSquarePlus, Package, FileText, Receipt, HardHat, Repeat, CheckCheck, BellDot } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuLabel, MenuSep, RightMenu } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { NOW } from '@/tileos/lib/today'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import type { Notice } from '@/tileos/data/work'
import { Thread, msgGist, lastAt, ConvoHead, ProjectFace } from './messages'
import markUrl from '@/tileos/assets/mark.svg'


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

/** every conversation for this login: one per project people have written on — only people talking (what the app
 *  noticed is under the bell). Read is per person: what you've opened is read for you, not for everyone. */
export function conversations(s: St, withAway = false): Convo[] {
  const me = meOf(s.role)
  const outside = s.role === 'client'
  const out: Convo[] = []
  Object.keys(s.messages).forEach((jobId) => {
    const job = s.jobs[jobId]
    const msgs = (s.messages[jobId] || []).filter((m) => !outside || !m.internal)
    if (!job || !msgs.length) return
    const last = msgs[msgs.length - 1]
    const seen = s.seen?.[seenKey(jobId, me)]
    const newMsgs = (s.messages[jobId] || []).slice(seen?.n || 0).filter((m) => m.who !== me && (!outside || !m.internal)).length
    const unread = newMsgs + (seen?.unread && !newMsgs ? 1 : 0)
    const away = !!seen?.away && seen.away >= (s.messages[jobId] || []).length
    if (away && !withAway) return
    const preview = `${last.who === me ? 'You' : PEOPLE[last.who]?.short || ''}: ${msgGist(last)}`
    const when = last.date === NOW ? last.time : last.date
    out.push({ key: jobId, jobId, name: job.name, sub: job.client, preview, when, unread, away, rank: lastAt(last) })
  })
  return out.sort((a, b) => b.rank - a.rank)
}
/** what the app noticed for this login — a delivery, an approval, a request dropped off — newest first */
/** an update archived by this person (the same per-person list as the conversations) */
const updKey = (id: string, me: PersonKey) => `u:${id}|${me}`
const updAway = (s: St, id: string, me: PersonKey) => !!s.seen?.[updKey(id, me)]?.away
export const updatesFor = (s: St) => { const me = meOf(s.role); return noticesFor(s, me).filter((n) => !updAway(s, n.id, me)) }
export const archivedUpdates = (s: St) => { const me = meOf(s.role); return noticesFor(s, me).filter((n) => updAway(s, n.id, me)) }
/** archive an update — or bring it back */
export function archiveUpdate(id: string, on: boolean) {
  const st = useStore.getState()
  const me = meOf(st.role)
  st.commit((x) => {
    x.seen ||= {}
    if (on) x.seen[updKey(id, me)] = { n: 0, away: 1 }
    else delete x.seen[updKey(id, me)]
    const n = x.notices.find((y) => y.id === id)
    if (n && on) n.unread = false
  }, on ? 'Archived' : 'Back in Updates')
}
/** an update back to unread — bold with the dot until it's opened again */
export function unreadUpdate(id: string) {
  useStore.getState().commit((x) => { const n = x.notices.find((y) => y.id === id); if (n) n.unread = true })
}
export const updatesUnread = (s: St) => updatesFor(s).filter((n) => n.unread).length
export const inboxUnread = (s: St) => conversations(s).reduce((n, c) => n + c.unread, 0) + updatesUnread(s)
/** an update seen — or all of them */
export function readUpdate(id?: string) {
  const st = useStore.getState()
  const me = meOf(st.role)
  if (!st.notices.some((n) => n.unread && (!id || n.id === id) && (!n.for || n.for.includes(me)))) return
  st.commit((x) => { x.notices.forEach((n) => { if (n.unread && (!id || n.id === id) && (!n.for || n.for.includes(me))) n.unread = false }) })
}
const UPD_ICON: Record<Notice['kind'], React.ElementType> = { material: Package, pricing: FileText, money: Receipt, field: HardHat, change: Repeat }

/** opening a conversation: everything in it is read, for you */
export function markRead(key: string, jobId?: string) {
  const st = useStore.getState()
  const me = meOf(st.role)
  const k = seenKey(key, me)
  const n = jobId ? (st.messages[jobId] || []).length : 0
  const cur = st.seen?.[k]
  if (cur && cur.n === n && !cur.unread) return
  st.commit((x) => {
    x.seen ||= {}
    x.seen[k] = { n }
  })
}
/** put a conversation away (it comes back when something new lands), or bring it back */
export function putAway(key: string, jobId: string | undefined, on: boolean) {
  const st = useStore.getState()
  const me = meOf(st.role)
  const k = seenKey(key, me)
  const n = jobId ? (st.messages[jobId] || []).length : 0
  st.commit((x) => { x.seen ||= {}; const cur = x.seen[k] || { n }; x.seen[k] = on ? { ...cur, n, away: n, unread: false } : { n: cur.n } }, on ? 'Archived' : 'Back in the inbox', { sub: on ? 'It comes back the moment something new is said in it.' : undefined })
}
/** mark it unread — it stays bold with a 1 until you open it again */
export function markUnread(key: string, jobId?: string) {
  const st = useStore.getState()
  const me = meOf(st.role)
  const k = seenKey(key, me)
  const n = jobId ? (st.messages[jobId] || []).length : 0
  st.commit((x) => { x.seen ||= {}; x.seen[k] = { ...(x.seen[k] || { n }), unread: true, away: undefined } })
}

function Face({ c }: { c: Convo }) {
  return <ProjectFace id={c.key} name={c.name} size={48} />
}

const PRICING_STAGES: string[] = ['request', 'estimating', 'proposal', 'followup']

export function InboxPage() {
  const s = useStore()
  const all = conversations(s, true)
  const [q, setQ] = React.useState('')
  const me = meOf(s.role)
  /* a search finds a project by its name, or by anything said in it — the line it found shows under the name */
  const words = q.trim().toLowerCase()
  const hit = (c: Convo) => {
    if (!words) return { ok: true }
    if (`${c.name} ${c.sub || ''}`.toLowerCase().includes(words)) return { ok: true }
    const m = c.jobId ? [...(s.messages[c.jobId] || [])].reverse().find((x) => !x.deleted && x.text.toLowerCase().includes(words)) : undefined
    return m ? { ok: true, said: `${m.who === me ? 'You' : PEOPLE[m.who]?.short || ''}: ${m.text}` } : { ok: false }
  }
  const [picked, setPicked] = React.useState<string | null>(null)
  /* New: what you haven't seen. All: everything not archived. Archived: what you filed — a conversation comes back on its
     own when someone says something new in it */
  const [view, setView] = React.useState<'all' | 'new' | 'away' | 'updates'>('all')
  const updates = updatesFor(s)
  const updN = updates.filter((n) => n.unread).length
  const oldUpdates = archivedUpdates(s)
  const list = all.filter((c) => !c.away)
  const unreadN = list.reduce((n, c) => n + c.unread, 0)
  const shown = (view === 'away' ? all.filter((c) => c.away) : view === 'new' ? list.filter((c) => c.unread > 0) : list).map((c) => ({ c, h: hit(c) })).filter((x) => x.h.ok).map((x) => (x.h.said ? { ...x.c, preview: x.h.said } : x.c))
  /* a project nobody has written on yet opens empty, ready for the first message */
  const fresh = (id: string): Convo | null => (s.jobs[id] ? { key: id, jobId: id, name: s.jobs[id].name, sub: s.jobs[id].client, preview: '', when: '', unread: 0, away: false, rank: 0 } : null)
  /* nothing opens by itself — opening a conversation reads it, so you pick it (like WhatsApp on a computer) */
  const cur = all.find((c) => c.key === picked) || (picked ? fresh(picked) : null) || null
  const startable = Object.values(s.jobs).filter((j) => (j.stage as string) !== 'lost').sort((a, b) => a.name.localeCompare(b.name))
  /* where you left off, taken before it's marked read — the "New" line goes there */
  const [from, setFrom] = React.useState<Record<string, { n: number }>>({})
  const snap = (c: Convo) => ({ n: c.jobId ? s.seen?.[`${c.jobId}|${me}`]?.n ?? 0 : 0 })
  const openConvo = (c: Convo) => { setFrom((f) => ({ ...f, [c.key]: f[c.key] && picked === c.key ? f[c.key] : snap(c) })); setPicked(c.key) }
  const team = (jobId: string) => { const j = s.jobs[jobId]; return j ? Array.from(new Set([j.pm || 'ys', 'yakov', ...(j.crew ? [j.crew] : [])])) as (keyof typeof PEOPLE)[] : [] }
  return (
    <div className="mx-auto flex w-full max-w-[160rem] min-h-0 flex-col px-7 pb-4 pt-5 max-xl:px-6 max-lg:px-0 max-lg:pb-0 max-lg:pt-0" style={{ height: 'calc(100dvh - var(--app-top, 0px) - var(--inbox-bottom, 0px))' }}>
      <div className={cn('grid min-h-0 flex-1 overflow-hidden rounded-[1rem] border border-[#ebe6dd] bg-white shadow-card max-lg:rounded-none max-lg:border-0 max-lg:shadow-none', 'grid-cols-[minmax(0,1fr)] lg:grid-cols-[22rem_minmax(0,1fr)]')}>
        {/* the conversations */}
        <div className={cn('flex min-h-0 min-w-0 flex-col border-r border-line-2 max-lg:border-r-0', cur && 'max-lg:hidden')}>
          <div className="flex items-center gap-2 border-b border-line-2 px-4 py-3">
            <h1 className="font-display text-[1.25rem] font-semibold text-ink max-lg:hidden">Messages</h1>
            <label className="relative ml-auto flex min-w-0 flex-1 items-center lg:max-w-[11rem]">
              <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-faint" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search the messages" className="h-9 w-full rounded-full border border-line bg-wash pl-8 pr-3 text-[0.875rem] text-ink outline-none placeholder:text-faint focus:border-brand-300 focus:bg-white" />
            </label>
            <Menu align="end" width={300} trigger={<button aria-label="New conversation" title="New conversation" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-btn transition hover:bg-brand-700"><MessageSquarePlus className="h-[1.125rem] w-[1.125rem]" /></button>}>
              <div className="max-h-[20rem] overflow-y-auto">
                {/* the projects, then the estimates still being priced — each said for what it is (an estimate and its
                    project can share a name) */}
                {([['Projects', startable.filter((j) => !PRICING_STAGES.includes(j.stage))], ['Estimates', startable.filter((j) => PRICING_STAGES.includes(j.stage))]] as const).filter(([, l]) => l.length).map(([label, l], gi) => (
                  <React.Fragment key={label}>
                    {gi > 0 && <MenuSep />}
                    <MenuLabel>{label}</MenuLabel>
                    {l.map((j) => {
                      const est = label === 'Estimates' ? s.estimates.find((e) => e.jobId === j.id) : undefined
                      return <MenuItem key={j.id} icon={label === 'Estimates' ? <FileText className="h-4 w-4" /> : <Building2 className="h-4 w-4" />} hint={[est?.id, j.client].filter(Boolean).join(' · ')} onSelect={() => { const c = all.find((x) => x.key === j.id) || fresh(j.id); if (c) openConvo(c) }}>{j.name}</MenuItem>
                    })}
                  </React.Fragment>
                ))}
              </div>
            </Menu>
          </div>
          <div className="flex items-center gap-1.5 border-b border-line-2 px-3 py-2">
            {([['all', 'All'], ['new', 'New'], ['updates', 'Updates'], ['away', 'Archived']] as const).map(([k, label]) => {
              const on = view === k
              const n = k === 'new' ? unreadN : k === 'updates' ? updN : k === 'away' ? all.filter((c) => c.away).length + oldUpdates.length : 0
              if (k === 'away' && !n) return null
              return <button key={k} onClick={() => setView(k)} data-inbox-view={k} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold transition', on ? 'bg-brand-600 text-white' : 'text-ink-2 hover:bg-wash')}>{label}{n > 0 && <span className={cn('rounded-full px-1.5 text-[0.71875rem] tnum', on ? 'bg-white/20' : k === 'new' || k === 'updates' ? 'bg-brand-600 text-white' : 'bg-wash-2 text-ink-2')}>{n}</span>}</button>
            })}
          </div>
          <div className="scroll-soft min-h-0 flex-1 overflow-y-auto">
            {view === 'updates' && (
              <>
                {updates.length > 0 && updN > 0 && <div className="flex justify-end border-b border-line-2 px-3 py-1.5"><button onClick={() => readUpdate()} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[0.78125rem] font-semibold text-brand-700 hover:bg-brand-50"><CheckCheck className="h-3.5 w-3.5" />Mark all as seen</button></div>}
                {updates.map((n) => <UpdateRow key={n.id} n={n} />)}
                {!updates.length && <div className="px-4 py-12 text-center text-[0.875rem] text-muted">No updates yet — deliveries, approvals and requests land here.</div>}
              </>
            )}
            {view !== 'updates' && shown.map((c) => {
              const on = cur?.key === c.key
              const items = [
                c.unread ? { icon: <MailOpen className="h-4 w-4" />, label: 'Mark as read', onSelect: () => markRead(c.key, c.jobId) } : { icon: <Mail className="h-4 w-4" />, label: 'Mark as unread', onSelect: () => markUnread(c.key, c.jobId) },
                c.away ? { icon: <Inbox className="h-4 w-4" />, label: 'Move back to the inbox', onSelect: () => putAway(c.key, c.jobId, false) } : { icon: <Archive className="h-4 w-4" />, label: 'Archive', hint: 'It comes back when someone writes in it', onSelect: () => { putAway(c.key, c.jobId, true); if (on) setPicked(null) } },
                c.jobId ? { icon: <Building2 className="h-4 w-4" />, label: 'Open the project', onSelect: () => s.open({ t: 'job', id: c.jobId! }) } : null,
              ]
              return (
                <RightMenu key={c.key} items={items}>
                <div className={cn('group relative border-b border-line-2 transition row-hover', on && 'bg-[#eef2fd] hover:bg-[#eef2fd]')}>
                  <button onClick={() => openConvo(c)} data-convo={c.key} className="flex w-full items-center gap-3 px-4 py-3 pr-11 text-left">
                    <Face c={c} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={cn('min-w-0 flex-1 truncate text-[0.9375rem]', c.unread ? 'font-bold text-ink' : 'font-semibold text-ink')}>{c.name}</span>
                        <span className={cn('shrink-0 text-[0.75rem] tnum', c.unread ? 'font-semibold text-brand-700' : 'text-muted')}>{c.when}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cn('min-w-0 flex-1 truncate text-[0.8125rem]', c.unread ? 'font-medium text-ink-2' : 'text-muted')}>{c.preview}</span>
                        {c.unread > 0 && <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[0.71875rem] font-bold tnum text-white">{c.unread}</span>}
                      </span>
                    </span>
                  </button>
                  {/* at the side, pointing at it: archive in one click, unread in one click (right-click has the same) —
                      on a phone, the ··· (or a long press) */}
                  <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-lg bg-white/95 opacity-0 shadow-xs transition group-hover:opacity-100 focus-within:opacity-100 max-lg:hidden" data-convo-actions>
                    <button aria-label={c.unread ? `Mark ${c.name} as read` : `Mark ${c.name} as unread`} title={c.unread ? 'Mark as read' : 'Mark as unread'} onClick={() => (c.unread ? markRead(c.key, c.jobId) : markUnread(c.key, c.jobId))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-wash-2 hover:text-ink">{c.unread ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}</button>
                    <button aria-label={c.away ? `Move ${c.name} back to the inbox` : `Archive ${c.name}`} title={c.away ? 'Move back to the inbox' : 'Archive'} onClick={() => { putAway(c.key, c.jobId, !c.away); if (on && !c.away) setPicked(null) }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-wash-2 hover:text-ink" data-archive>{c.away ? <Inbox className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button>
                  </span>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 lg:hidden">
                    <Menu align="end" width={230} trigger={<button aria-label={`More for ${c.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-white hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
                      {items.filter(Boolean).map((it) => <MenuItem key={it!.label} icon={it!.icon} hint={it!.hint} onSelect={it!.onSelect}>{it!.label}</MenuItem>)}
                    </Menu>
                  </span>
                </div>
                </RightMenu>
              )
            })}
            {view === 'away' && oldUpdates.length > 0 && (
              <>
                <div className="border-b border-line-2 px-4 pb-1.5 pt-3 text-[0.75rem] font-semibold text-muted">Archived updates</div>
                {oldUpdates.map((n) => <UpdateRow key={n.id} n={n} archived />)}
              </>
            )}
            {view !== 'updates' && !shown.length && <div className="px-4 py-12 text-center text-[0.875rem] text-muted">{q ? 'Nothing matches.' : view === 'new' ? 'Nothing new. You’ve seen it all.' : view === 'away' ? (oldUpdates.length ? 'No archived conversations.' : 'Nothing archived.') : 'No conversations yet — tap the blue button to write on a project.'}</div>}
          </div>
        </div>
        {/* the conversation */}
        <div className={cn('flex min-h-0 min-w-0 flex-col', !cur && 'max-lg:hidden')}>
          {cur ? (
            <>
              {cur.jobId && <ConvoHead jobId={cur.jobId} onBack={() => setPicked(null)} backLabel="Back to the inbox" backClass="lg:hidden" right={<button onClick={() => s.open({ t: 'job', id: cur.jobId })} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-[0.8125rem] font-semibold text-ink-2 hover:bg-wash"><Building2 className="h-4 w-4 text-faint" /><span className="max-sm:hidden">Open the project</span></button>} />}
              <div className="flex min-h-0 flex-1 flex-col">
                {cur.jobId && <div className="min-h-0 flex-1"><Thread key={cur.key} jobId={cur.jobId} newFrom={from[cur.key]} outside={s.role === 'client'} /></div>}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600"><MessageSquarePlus className="h-7 w-7" /></span>
              <div className="text-[1.0625rem] font-semibold text-ink">Pick a conversation</div>
              <div className="max-w-xs text-[0.875rem] text-muted">One per project — the team, the crew and the GC. Updates from the app are under the bell.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** one update: tap it to open what it's about; archive it at the side or with a right-click */
function UpdateRow({ n, archived }: { n: Notice; archived?: boolean }) {
  const s = useStore()
  const Ic = UPD_ICON[n.kind] || BellDot
  const job = n.jobId ? s.jobs[n.jobId] : undefined
  const items = [
    n.unread ? { icon: <MailOpen className="h-4 w-4" />, label: 'Mark as seen', onSelect: () => readUpdate(n.id) } : { icon: <Mail className="h-4 w-4" />, label: 'Mark as unread', onSelect: () => unreadUpdate(n.id) },
    archived ? { icon: <Inbox className="h-4 w-4" />, label: 'Move back to Updates', onSelect: () => archiveUpdate(n.id, false) } : { icon: <Archive className="h-4 w-4" />, label: 'Archive', onSelect: () => archiveUpdate(n.id, true) },
    job ? { icon: <Building2 className="h-4 w-4" />, label: 'Open the project', onSelect: () => s.open({ t: 'job', id: job.id }) } : null,
  ]
  return (
    <RightMenu items={items}>
      <div className="group relative border-b border-line-2 row-hover" data-update-row={n.id}>
        <button data-update={n.id} onClick={() => { readUpdate(n.id); if (n.open) s.open(n.open); else if (n.jobId) s.open({ t: 'job', id: n.jobId }) }} className={cn('flex w-full items-start gap-3 px-4 py-3 pr-12 text-left', n.unread && 'bg-[#f6f8fe]')}>
          <span className={cn('mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full', n.unread ? 'bg-brand-50 text-brand-600' : 'bg-wash text-muted')}><Ic className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className={cn('block text-[0.875rem] leading-snug', n.unread ? 'font-semibold text-ink' : 'text-ink-2')}>{n.text}</span>
            <span className="mt-0.5 block truncate text-[0.75rem] text-muted">{job ? `${job.name} · ` : ''}{n.when}</span>
          </span>
          {n.unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600 group-hover:invisible" aria-label="New" />}
        </button>
        <button aria-label={archived ? 'Move back to Updates' : 'Archive'} title={archived ? 'Move back to Updates' : 'Archive'} onClick={() => archiveUpdate(n.id, !archived)} className="absolute right-2 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-muted opacity-0 shadow-xs transition hover:bg-wash-2 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100 max-lg:shadow-none" data-archive>{archived ? <Inbox className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button>
      </div>
    </RightMenu>
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
      <span className="min-w-0 flex-1 text-[0.875rem] font-semibold text-brand-800">{n === 1 ? '1 new message' : `${n} new messages`}</span>
      <span className="text-[0.8125rem] font-semibold text-brand-700">Open</span>
    </button>
  )
}
