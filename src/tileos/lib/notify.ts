/* Notifications on this device: what's due reaches it even with the app closed (the server looks every minute and
 * sends them: lib/remind.server). Here: whether this device can get them, turning them on (the phone asks once) and
 * off, and a test. Only the published app, the one kept on the device. On an iPhone only from its Home Screen icon
 * (Apple's rule: Safari itself can't get them). After a new version clears the app kept on the device, they're turned
 * back on by themselves the next time it opens (keepOn). */
import * as React from 'react'
import { REAL } from './save'
import { onDevice } from './device'
import { TODAY, daysBetween } from './today'
import { meOf, useStore } from '@/tileos/store'

export type NotifyState =
  /** on for this device */ | 'on'
  /** it can, it isn't on */ | 'off'
  /** this device said no to Tile OS (only its settings can undo that) */ | 'blocked'
  /** an iPhone in Safari: only the Home Screen icon can get them */ | 'homescreen'
  /** an iPhone too old for them (iOS 16.4 is the first) */ | 'old'
  /** a browser that can't */ | 'unsupported'
  /** not the published app (the editor's preview, the test copy) */ | 'preview'

const ON_KEY = 'tileos-notify-on'
const SAVED_KEY = 'tileos-notify-saved'
const ASKED_KEY = 'tileos-notify-asked'
/* the test copy has no push service: it pretends (localStorage 'tileos-notify-fake' = the state to pretend) */
const FAKE_KEY = 'tileos-notify-fake'
const get = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const put = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* private window */ } }
const fake = () => get(FAKE_KEY) as NotifyState | null

export const isIPhone = () => typeof navigator !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const fromHomeScreen = () => (navigator as any).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches
const canPush = () => 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return undefined } }
const unb64u = (s: string) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); const b = atob(t + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)) }
const sameKey = (sub: PushSubscription, want: Uint8Array) => { const k = sub.options?.applicationServerKey; if (!k) return true; const a = new Uint8Array(k); return a.length === want.length && a.every((x, i) => x === want[i]) }

/** whose they are: the person signed in (never someone the admin is looking through) */
export const notifyPerson = () => REAL.me || meOf(REAL.home)

/* whoever shows the state hears when it changes */
const watchers = new Set<() => void>()
const changed = () => watchers.forEach((f) => f())

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    const r = await navigator.serviceWorker.getRegistration()
    if (r) return r
    return await Promise.race([navigator.serviceWorker.ready, new Promise<undefined>((ok) => setTimeout(() => ok(undefined), 4000))])
  } catch { return undefined }
}

export async function notifyState(): Promise<NotifyState> {
  const f = fake()
  if (f) return f
  if (typeof window === 'undefined') return 'unsupported'
  if (!onDevice() || !REAL.push) return 'preview'
  if (isIPhone() && !fromHomeScreen()) return 'homescreen'
  if (!canPush()) return isIPhone() ? 'old' : 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted' || !get(ON_KEY)) return 'off'
  const sub = await (await registration())?.pushManager.getSubscription().catch(() => null)
  return sub ? 'on' : 'off'
}

/** the state, kept up to date — null while it's being looked up */
export function useNotifyState(): NotifyState | null {
  const [st, setSt] = React.useState<NotifyState | null>(null)
  React.useEffect(() => {
    let live = true
    const look = () => { void notifyState().then((x) => { if (live) setSt(x) }) }
    look()
    watchers.add(look)
    return () => { live = false; watchers.delete(look) }
  }, [])
  return st
}

/** this device's push address, kept on the server with whose it is */
async function subscribeAndSave(person: string): Promise<{ ok: true } | { ok: false; why: string }> {
  const key = await REAL.push!.key()
  if (!key.ok) return key
  const reg = await registration()
  if (!reg) return { ok: false, why: 'nosw' }
  const want = unb64u(key.key)
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub, want)) { await sub.unsubscribe().catch(() => false); sub = null }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want as BufferSource })
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const r = await REAL.push!.save({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, person, tz: tz() })
  if (r.ok) put(SAVED_KEY, `${TODAY}|${person}|${j.endpoint.slice(-24)}`)
  return r
}

/** turn them on: the phone asks first (right after the tap: an iPhone only asks then) */
export async function turnOn(): Promise<{ ok: true } | { ok: false; why: string }> {
  const person = notifyPerson()
  if (fake()) {
    const r = await REAL.push?.save({ endpoint: 'https://push.example/test-device', p256dh: 'test', auth: 'test', person, tz: tz() })
    if (r && !r.ok) return r
    put(FAKE_KEY, 'on'); changed()
    return { ok: true }
  }
  if (typeof window === 'undefined' || !onDevice() || !REAL.push) return { ok: false, why: 'preview' }
  if (isIPhone() && !fromHomeScreen()) return { ok: false, why: 'homescreen' }
  if (!canPush()) return { ok: false, why: isIPhone() ? 'old' : 'unsupported' }
  let perm: NotificationPermission = 'default'
  try { perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission() } catch { perm = 'denied' }
  if (perm !== 'granted') { changed(); return { ok: false, why: perm === 'denied' ? 'blocked' : 'dismissed' } }
  try {
    const r = await subscribeAndSave(person)
    if (!r.ok) return r
    put(ON_KEY, person); put(ASKED_KEY, TODAY); changed()
    return { ok: true }
  } catch {
    return { ok: false, why: 'error' }
  }
}

/** turn them off on this device */
export async function turnOff() {
  if (fake()) { put(FAKE_KEY, 'off'); changed(); return }
  put(ON_KEY, null); put(SAVED_KEY, null)
  try {
    const sub = await (await registration())?.pushManager.getSubscription()
    if (sub) { await REAL.push?.drop(sub.endpoint); await sub.unsubscribe() }
  } catch { /* off here anyway */ }
  changed()
}

/** "Notifications are on" to all my devices */
export async function sendTest(): Promise<{ ok: true; sent: number; ticking?: boolean } | { ok: false; why: string }> {
  if (!REAL.push) return { ok: false, why: 'preview' }
  try { return await REAL.push.test() } catch { return { ok: false, why: 'error' } }
}

/** when the app opens: on here before, still on — a new version (it clears the app kept on the device) or a new
 *  push address from the phone is put back by itself; once a day it tells the server it's still here */
export async function keepOn() {
  if (fake() || typeof window === 'undefined' || !onDevice() || !REAL.push || !get(ON_KEY)) return
  if (!canPush() || Notification.permission !== 'granted') return
  const person = notifyPerson()
  try {
    const sub = await (await registration())?.pushManager.getSubscription()
    if (sub && get(SAVED_KEY) === `${TODAY}|${person}|${sub.endpoint.slice(-24)}`) return
    const r = await subscribeAndSave(person)
    if (r.ok) { put(ON_KEY, person); changed() }
  } catch { /* the next open tries again */ }
}

/** a to-do of mine set for a time, and nothing would reach this phone at that time: offer it, once in a while */
export async function offerNotify(at?: string) {
  const st = await notifyState()
  if (st !== 'off' && st !== 'homescreen') return
  const was = get(ASKED_KEY)
  if (was && /^\d{4}-\d\d-\d\d$/.test(was) && daysBetween(was, TODAY) < 14) return
  /* once the window it was set in is closed (a minute at most) */
  const show = (tries = 0) => {
    const s = useStore.getState()
    if (s.modals.length) { if (tries < 40) setTimeout(() => show(tries + 1), 1500); return }
    put(ASKED_KEY, TODAY)
    s.open({ t: 'notify', at })
  }
  setTimeout(() => show(), 600)
}
