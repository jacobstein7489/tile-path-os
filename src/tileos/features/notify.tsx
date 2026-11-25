/* Notifications on this phone (or computer): what comes, and one button to turn them on. Opened from the account menu,
 * Settings → This device, and once when you set a time on a to-do of yours while they're off. On an iPhone in Safari
 * it says how to put Tile OS on the Home Screen (only from there can an iPhone get them); turned off for Tile OS in
 * the phone's settings, it says where to turn it back on. */
import * as React from 'react'
import { AlarmClock, BellRing, BellOff, CalendarDays, Sunrise, Send, Check, HardHat, ClipboardList } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { toast } from '@/tileos/lib/pop'
import { cn } from '@/tileos/lib/utils'
import { useNotifyState, turnOn, turnOff, sendTest, isIPhone, type NotifyState } from '@/tileos/lib/notify'

const phone = () => typeof navigator !== 'undefined' && (isIPhone() || /Android|Mobi/i.test(navigator.userAgent))
const android = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

/** what turning them on would bring, one line each: what, and when */
const WHAT: { icon: React.ReactNode; what: string; when: string }[] = [
  { icon: <AlarmClock />, what: 'A to-do set for a time', when: 'At its time' },
  { icon: <CalendarDays />, what: 'Meetings and walkthroughs', when: '15 minutes before' },
  { icon: <BellRing />, what: 'Urgent, reminders, deliveries', when: 'Right away' },
  { icon: <Sunrise />, what: 'What’s still open from before', when: 'Once, in the morning' },
]
/* whoever sends the crew list (the site manager, or who it's set for in Automations): it, at its time */
const CREW_WHAT = { icon: <HardHat />, what: 'The crew list', when: 'At its time' }
/* whoever sends the daily updates: the ones not sent yet, at 5 PM */
const DAILY_WHAT = { icon: <ClipboardList />, what: 'Daily updates not sent yet', when: '5 PM' }

/** what's wrong, said plainly (the server's or the phone's word for it) */
export const NOTIFY_WHY: Record<string, string> = {
  denied: 'Only someone on the team can turn them on.',
  notable: 'The server isn’t set up for them yet. In the Lovable chat: Apply pending Supabase migrations.',
  nosw: 'Close the app all the way, open it again, then try once more.',
  dismissed: 'Tap Allow when the phone asks.',
  error: 'That didn’t work. Check the signal and try again.',
}

/** numbered steps, the same look everywhere */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5" data-notify-steps>
      {items.map((x, i) => (
        <li key={i} className="flex items-start gap-3 text-[0.9375rem] leading-snug text-ink">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[0.8125rem] font-semibold text-brand-700 tnum">{i + 1}</span>
          <span className="min-w-0 pt-0.5">{x}</span>
        </li>
      ))}
    </ol>
  )
}

export function NotifyModal({ level, at }: { level: number; /** opened right after setting a time on a to-do */ at?: string }) {
  const s = useStore()
  const st = useNotifyState()
  const [busy, setBusy] = React.useState<'' | 'on' | 'off' | 'test'>('')
  const [why, setWhy] = React.useState('')
  const [shown, setShown] = React.useState<NotifyState | null>(null)
  /* what the window shows: the state, or what turning on just found out (said no, needs the Home Screen) */
  const view = shown || st
  const where = phone() ? 'this phone' : 'this computer'
  const on = async () => {
    setBusy('on'); setWhy('')
    const r = await turnOn()
    setBusy('')
    if (r.ok) { setShown(null); toast('Notifications are on', { description: `What’s due comes to ${where}, even with the app closed.` }); return }
    if (r.why === 'blocked' || r.why === 'homescreen' || r.why === 'old' || r.why === 'unsupported' || r.why === 'preview') setShown(r.why as NotifyState)
    else setWhy(NOTIFY_WHY[r.why] || NOTIFY_WHY.error)
  }
  const off = async () => { setBusy('off'); await turnOff(); setBusy(''); toast('Notifications are off', { description: `Nothing comes to ${where}. Today still has it all.` }) }
  const test = async () => {
    setBusy('test'); setWhy('')
    const r = await sendTest()
    setBusy('')
    /* sent — but the every-minute check isn't running on the server yet: nothing would come with the app closed */
    if (r.ok && r.sent > 0 && r.ticking === false) setWhy(s.role === 'owner'
      ? 'The test was sent. But reminders with the app closed aren’t running yet: in Lovable, ask it to apply the Tile OS notifications migration (it turns on pg_cron and pg_net).'
      : 'The test was sent. Reminders with the app closed start once the office finishes setting them up.')
    else if (r.ok && r.sent > 0) toast('Sent', { description: 'It shows in a moment.' })
    else if (r.ok) setWhy(`It didn’t reach ${where}. Turn them off, then on again.`)
    else setWhy(NOTIFY_WHY[r.why] || NOTIFY_WHY.error)
  }

  const crewTo = s.rules.autoWho?.['crew-morning']
  const sendsCrew = !(s.rules.autoOff || []).includes('crew-morning') && (crewTo ? meOf(s.role) === crewTo : s.role === 'site')
  const dailyTo = s.rules.autoWho?.['daily-update']
  const sendsDaily = !(s.rules.autoOff || []).includes('daily-update') && (dailyTo ? meOf(s.role) === dailyTo : s.role === 'site')
  const list = (
    <ul className="flex flex-col border-y border-line-2" data-notify-what>
      {[WHAT[0], ...(sendsCrew ? [CREW_WHAT] : []), ...(sendsDaily ? [DAILY_WHAT] : []), ...WHAT.slice(1)].map((x) => (
        <li key={x.what} className="flex min-h-[2.875rem] items-center gap-3 border-t border-line-2 py-2 first:border-t-0">
          <span className="inline-flex h-4 w-4 shrink-0 text-faint [&>svg]:h-4 [&>svg]:w-4">{x.icon}</span>
          <span className="min-w-0 flex-1 text-[0.9375rem] text-ink">{x.what}</span>
          <span className="shrink-0 text-[0.8125rem] text-muted">{x.when}</span>
        </li>
      ))}
    </ul>
  )

  let sub: React.ReactNode = null
  let body: React.ReactNode = null
  let footer: React.ReactNode = null
  if (view === null) {
    body = <div className="h-40" aria-busy />
  } else if (view === 'on') {
    sub = <span className="inline-flex items-center gap-1.5 font-medium text-ok-700" data-notify-on><Check className="h-4 w-4" />On for {where}</span>
    body = list
    footer = (
      <>
        <Button variant="ghost" icon={<BellOff />} disabled={!!busy} onClick={off} data-notify-off>Turn off</Button>
        <Button className="ml-auto max-sm:flex-1" variant="primary" icon={<Send />} disabled={!!busy} onClick={test} data-notify-test>{busy === 'test' ? 'Sending…' : 'Send a test'}</Button>
      </>
    )
  } else if (view === 'off') {
    sub = at ? `So your ${at} to-do reaches ${where}, even with the app closed.` : `What’s due comes to ${where}, even with the app closed.`
    body = list
    footer = (
      <>
        <Button variant="ghost" onClick={s.close} data-notify-later>Not now</Button>
        <Button className="ml-auto max-sm:flex-1" variant="primary" icon={<BellRing />} disabled={!!busy} onClick={on} data-notify-turn-on>{busy === 'on' ? 'Turning on…' : 'Turn on'}</Button>
      </>
    )
  } else if (view === 'homescreen') {
    sub = 'An iPhone gets them only in the Tile OS app on the Home Screen.'
    body = <Steps items={[<>In Safari, tap <b className="font-semibold">Share</b> (the square with the arrow, at the bottom)</>, <>Tap <b className="font-semibold">Add to Home Screen</b>, then <b className="font-semibold">Add</b></>, <>Open <b className="font-semibold">Tile OS</b> from its new icon</>, <>Tap your name on top, then <b className="font-semibold">Notifications</b> → <b className="font-semibold">Turn on</b></>]} />
    footer = <Button className="ml-auto max-sm:flex-1" variant="primary" onClick={s.close}>Got it</Button>
  } else if (view === 'blocked') {
    sub = `They’re turned off for Tile OS on ${where}. Turn them back on there:`
    body = isIPhone()
      ? <Steps items={[<>Open the iPhone’s <b className="font-semibold">Settings</b></>, <>Tap <b className="font-semibold">Notifications</b>, then <b className="font-semibold">Tile OS</b></>, <>Turn on <b className="font-semibold">Allow Notifications</b>, then come back here</>]} />
      : android()
        ? <Steps items={[<>Press and hold the <b className="font-semibold">Tile OS</b> icon, tap <b className="font-semibold">App info</b></>, <>Tap <b className="font-semibold">Notifications</b>, turn them on</>, <>Come back here</>]} />
        : <Steps items={[<>Click the icon just left of the address, <b className="font-semibold">cobblestone.lovable.app</b></>, <>Set <b className="font-semibold">Notifications</b> to <b className="font-semibold">Allow</b></>, <>Reload the page</>]} />
    footer = <Button className="ml-auto max-sm:flex-1" variant="primary" onClick={s.close}>Got it</Button>
  } else {
    sub = view === 'old' ? 'This iPhone needs an update first (iOS 16.4 or newer): Settings → General → Software Update.'
      : view === 'unsupported' ? 'This browser can’t get notifications. Chrome, Edge or Safari can.'
        : 'They work in the published app, cobblestone.lovable.app, not in this preview.'
    body = list
    footer = <Button className="ml-auto max-sm:flex-1" variant="primary" onClick={s.close}>Got it</Button>
  }
  return (
    <Modal level={level} size="sm" onClose={s.close} title="Notifications" sub={sub || undefined} footer={footer}>
      <div data-notify={view || 'looking'}>
        {body}
        {why && <p className={cn('mt-3 text-[0.875rem] leading-snug text-warn-700')} data-notify-why>{why}</p>}
      </div>
    </Modal>
  )
}

/** the account menu's words for it: On, Off, or nothing while it's looked up */
export function notifyHint(st: NotifyState | null) {
  return st === 'on' ? 'On' : st === 'off' || st === 'homescreen' ? 'Off' : st === 'blocked' ? 'Turned off in the phone’s settings' : undefined
}
