/* A notification tapped on the phone: the app opens (or comes to the front) right on what it was about: the to-do,
 * the meeting, what's late. What it said counts as seen, so the same card doesn't pop up again in the app. And when a
 * new version cleared the app kept on the device, notifications are put back by themselves (lib/notify keepOn). */
import * as React from 'react'
import { useStore } from '@/tileos/store'
import { keepOn } from '@/tileos/lib/notify'
import { markSeen } from './incoming'

type Open = { t: string; id?: string; seen?: string; [k: string]: any }

/** open what a notification was about — once the company's data is in (opened from scratch, it's still coming) */
export function openFromPush(o: Open) {
  if (!o?.t) return
  if (o.seen) markSeen([o.seen])
  const { seen: _seen, ...m } = o
  const go = (tries = 0) => {
    const s = useStore.getState()
    const there = m.t === 'task' ? s.tasks.some((t) => t.id === m.id) : m.t === 'event' ? s.events.some((e) => e.id === m.id) : true
    if (!there && tries < 30) { setTimeout(() => go(tries + 1), 300); return }
    s.closeAll()
    if (!there || m.t === 'today') { s.go({ page: 'today' }); return }
    /* the team's late things (the admin's morning): Team report */
    if (m.t === 'team') { s.go({ page: 'team' }); return }
    s.open(m as any)
  }
  go()
}

export function PushOpener() {
  React.useEffect(() => {
    /* opened by tapping one: ?open=… on the address (taken off right away, so a reload doesn't open it again) */
    try {
      const q = new URLSearchParams(location.search)
      const raw = q.get('open')
      if (raw) {
        q.delete('open')
        const rest = q.toString()
        history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash)
        openFromPush(JSON.parse(raw))
      }
    } catch { /* not one of ours */ }
    /* the app already open: the tap comes as a message */
    const onMsg = (e: MessageEvent) => { const d = e.data || {}; if (d.tileosOpen) openFromPush(d.tileosOpen) }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    /* on here before: kept on (a new version, a new push address from the phone) */
    const t = setTimeout(() => void keepOn(), 6000)
    const back = () => { if (document.visibilityState === 'visible') void keepOn() }
    document.addEventListener('visibilitychange', back)
    return () => { navigator.serviceWorker?.removeEventListener('message', onMsg); clearTimeout(t); document.removeEventListener('visibilitychange', back) }
  }, [])
  return null
}
