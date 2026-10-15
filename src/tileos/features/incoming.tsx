/* When something new lands on your plate — a hand-off, a task someone gave you — a card pops up in the middle of
 * the screen, so it's never just a little number in a corner. It waits until you're out of whatever window you're
 * in, lists what's new, and each one opens in a click. "Got it" puts it away (it stays on Today, of course). */
import * as React from 'react'
import { Inbox, ArrowRight } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { PEOPLE } from '@/tileos/data/model'
import { REAL } from '@/tileos/lib/save'
import type { Task } from '@/tileos/data/work'

const keyOf = (s: Store) => `tileos-seen:${REAL.email || 'preview'}:${meOf(s.role)}`
const read = (k: string): string[] | null => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const write = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-600))) } catch { /* private window */ } }
const tag = (t: Task) => `${t.id}:${t.owner}`
/** what's on my plate right now that someone (or a hand-off) put there */
const mineNow = (s: Store) => { const me = meOf(s.role); return s.tasks.filter((t) => t.owner === me && t.state === 'now' && t.log?.[0]?.who !== me) }
/* the automated tests drive the app themselves — no pop-ups in their way */
const quiet = () => { try { return navigator.webdriver && !localStorage.getItem('tileos-pop-test') } catch { return false } }

export function IncomingWatcher() {
  React.useEffect(() => {
    if (quiet()) return
    const check = () => {
      const s = useStore.getState()
      if (s.role === 'crew' || s.role === 'client') return
      const k = keyOf(s)
      const seen = read(k)
      const now = mineNow(s).map(tag)
      /* the first time on this computer: what's already there isn't "new" */
      if (!seen) { write(k, now); return }
      const fresh = now.filter((x) => !seen.includes(x))
      if (!fresh.length || s.modals.length) return
      s.open({ t: 'incoming', keys: fresh })
    }
    check()
    return useStore.subscribe((s, prev) => { if (s.tasks !== prev.tasks || s.role !== prev.role || (prev.modals.length && !s.modals.length)) check() })
  }, [])
  return null
}

function markSeen(keys: string[]) {
  const s = useStore.getState()
  const k = keyOf(s)
  write(k, Array.from(new Set([...(read(k) || []), ...keys])))
}

export function IncomingModal({ keys, level }: { keys: string[]; level: number }) {
  const s = useStore()
  const list = keys.map((k) => s.tasks.find((t) => tag(t) === k)).filter((t): t is Task => !!t)
  const done = () => { markSeen(keys); s.close() }
  if (!list.length) return null
  return (
    <Modal
      level={level}
      size="sm"
      onClose={done}
      title={list.length === 1 ? 'New for you' : `${list.length} new for you`}
      sub="It’s on your Today too"
      footer={<Button className="ml-auto" variant="primary" onClick={done}>Got it</Button>}
    >
      <div className="flex flex-col gap-2">
        {list.slice(0, 5).map((t) => {
          const from = t.log?.[0]?.who && t.log[0].who !== 'system' ? t.log[0].who : undefined
          const job = s.jobs[t.jobId]
          return (
            <button
              key={t.id}
              onClick={() => { markSeen(keys); s.close(); s.open({ t: 'task', id: t.id }) }}
              className="group flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
            >
              {from ? <Avatar who={from} size={34} /> : <span className="inline-flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Inbox className="h-4 w-4" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.90625rem] font-semibold text-ink">{t.title}</span>
                <span className="block truncate text-[0.78125rem] text-muted">{[job?.name, from ? `from ${PEOPLE[from]?.short}` : t.where, t.due ? `due ${t.due}` : ''].filter(Boolean).join(' · ')}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-faint transition group-hover:text-brand-600" />
            </button>
          )
        })}
        {list.length > 5 && <div className="px-1 text-[0.8125rem] text-muted">and {list.length - 5} more on your Today</div>}
      </div>
    </Modal>
  )
}
