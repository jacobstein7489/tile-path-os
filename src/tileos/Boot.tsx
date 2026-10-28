/* The real app starts here: sign in → let in? → the company's data → the app.
 * (The preview page on claude.ai starts from main.tsx instead and keeps a test in the browser.) */
import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import App from './App'
import { REAL, wantsSampleLook } from './lib/save'
import { startCloud, startSample, stopCloud, type CloudProblem } from './lib/cloud'
import { SignIn, WaitingRoom, Splash, SetupNeeded, SetPassword, LinkUsed } from './features/signin'

type Phase =
  | { k: 'loading' }
  | { k: 'signin'; note?: string }
  | { k: 'password'; email: string; name: string; why: 'invite' | 'recovery' | 'magiclink'; was?: string }
  | { k: 'badlink'; as?: string }
  | { k: 'waiting'; email: string; name: string }
  | { k: 'problem'; why: CloudProblem; detail?: string }
  | { k: 'ready' }

const sb = supabase as any
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* who's let in: their login types. A look-up that fails (the server busy for a moment right after an update, a sign-in
 * being refreshed), or that comes back empty for someone this browser has already seen let in, is asked again with
 * the sign-in refreshed — "you're not on the team yet" only ever comes from a clean, empty answer. */
const MEMBER_KEY = 'tileos-member'
const remembered = (uid: string) => { try { return localStorage.getItem(MEMBER_KEY) === uid } catch { return false } }
const remember = (uid: string) => { try { localStorage.setItem(MEMBER_KEY, uid) } catch { /* private window */ } }
type Found = { ok: true; roles: string[]; name?: string } | { ok: false; error: any }
async function lookUp(uid: string): Promise<Found> {
  let lastErr: any = null
  let name: string | undefined
  for (let i = 0; i < 5; i++) {
    if (i) { await pause([0, 500, 1200, 2500, 4000][i]); await supabase.auth.getSession().catch(() => null) }
    const [r, p] = await Promise.all([
      sb.from('user_roles').select('role').eq('user_id', uid),
      sb.from('profiles').select('full_name').eq('user_id', uid).maybeSingle(),
    ])
    name = p?.data?.full_name || name
    if (r.error) { lastErr = r.error; continue }
    lastErr = null
    const roles: string[] = (r.data || []).map((x: any) => x.role)
    if (roles.length) return { ok: true, roles, name }
    /* empty: once more for anyone (the sign-in may not have been ready yet), a few more for someone let in before */
    if (i === 0 || (remembered(uid) && i < 4)) continue
    return { ok: true, roles: [], name }
  }
  return lastErr ? { ok: false, error: lastErr } : { ok: true, roles: [], name }
}

/* signed out by itself after a while away: 12 hours with no tap or key on Tile OS (overnight, a computer left on at the
 * office) — the next time, it asks for the password and pops up the day. While someone's using it, it never does. */
const IDLE_KEY = 'tileos-last-active'
const IDLE_MS = 12 * 60 * 60 * 1000
const touch = () => { try { localStorage.setItem(IDLE_KEY, String(Date.now())) } catch { /* private window */ } }
const awayTooLong = () => { try { const t = Number(localStorage.getItem(IDLE_KEY) || 0); return t > 0 && Date.now() - t > IDLE_MS } catch { return false } }
const AWAY_NOTE = 'Signed out after 12 hours away — sign in again.'

/* came in from an invite, a texted link or a password link: the link signs them in, and the app asks for a password.
 * Read before anything touches the URL (the auth client clears it once it has the session). */
type Link = { type?: 'invite' | 'recovery' | 'magiclink'; access?: string; refresh?: string; bad?: string }
/* the address as the page opened — kept by the route before the sign-in client took the token out of it */
const OPENED: { hash: string; search: string; before?: string } = (globalThis as any).__TILEOS_LINK__ || { hash: location.hash, search: location.search }
const hashParams = () => new URLSearchParams(OPENED.hash.replace(/^#\/?/, '').replace(/^[^?&]*[?]/, ''))
const LINK = ((): Link => {
  try {
    const h = hashParams()
    const q = new URLSearchParams(OPENED.search)
    const get = (k: string) => h.get(k) || q.get(k) || undefined
    const t = get('type')
    /* a sign-up confirmation is the invite's link when the account was made by the invite */
    const type = t === 'invite' || t === 'recovery' || t === 'magiclink' ? t : t === 'signup' ? 'invite' : undefined
    /* a link that was used already, or is too old: the sign-in service sends it back with an error */
    const bad = get('error_code') || get('error') || get('error_description')
    return { type, access: get('access_token'), refresh: get('refresh_token'), bad }
  } catch { return {} }
})()
const ARRIVED = LINK.type || null
/** who this browser was signed in as before the link — the link's person takes over; the page says so */
const BEFORE = OPENED.before
/** the person a sign-in token is for */
const subOf = (jwt?: string): string | undefined => { try { return JSON.parse(atob((jwt || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub } catch { return undefined } }
let askedPassword = false
let badLink = !!LINK.bad
/* a link the app made itself (the one the admin texts): the token is checked right here, with no stop at the sign-in
 * service — so it lands in the app, never on a Lovable page */
const DIRECT = ((): { th: string; type: 'recovery' | 'invite' | 'magiclink' } | null => {
  try {
    const h = hashParams()
    const q = new URLSearchParams(OPENED.search)
    const th = h.get('th') || q.get('th')
    const t = h.get('type') || q.get('type')
    return th && (t === 'recovery' || t === 'invite' || t === 'magiclink') ? { th, type: t } : null
  } catch { return null }
})()
/* until the link's own sign-in is done, nothing opens — not the person who was signed in on this browser before */
let linkSettled = !(DIRECT || (LINK.access && LINK.refresh))
let linkStep: Promise<void> | null = null
/** the link's own sign-in, once per visit (a used or old link says so) */
function linkSignIn(): Promise<void> {
  return (linkStep ||= (async () => {
    try {
      let r: { error: unknown } | null = null
      if (DIRECT) r = await supabase.auth.verifyOtp({ token_hash: DIRECT.th, type: DIRECT.type })
      else if (LINK.access && LINK.refresh) {
        /* the link is one person's: if this browser still holds someone else (signed in here before), the link wins */
        const { data } = await supabase.auth.getSession()
        if (data.session?.user?.id !== subOf(LINK.access)) r = await supabase.auth.setSession({ access_token: LINK.access, refresh_token: LINK.refresh })
      }
      if (r?.error) { askedPassword = true; badLink = true }
    } catch { askedPassword = true; badLink = true }
    try { history.replaceState(null, '', location.pathname) } catch { /* fine */ }
    linkSettled = true
  })())
}

export default function Boot() {
  const [phase, setPhase] = React.useState<Phase>({ k: 'loading' })
  const started = React.useRef<string | null>(null)
  /* a screen that waits for the person (pick a password, a link that didn't work): nothing else replaces it — a tab
     coming back into view or another sign-in event doesn't skip it */
  const hold = React.useRef<string | null>(null)

  const signOut = React.useCallback(async () => {
    stopCloud()
    started.current = null
    hold.current = null
    try { localStorage.removeItem(IDLE_KEY); sessionStorage.removeItem('tileos-sample-look') } catch { /* fine */ }
    await supabase.auth.signOut()
    location.hash = ''
    location.reload()
  }, [])

  const begin = React.useCallback(async (session: Session | null) => {
    if (hold.current || !linkSettled) return
    /* the link was used already or is too old: say so — never open someone else's app, never a bare sign-in page */
    if (badLink) {
      badLink = false
      hold.current = 'badlink'
      started.current = null
      try { history.replaceState(null, '', location.pathname) } catch { /* fine */ }
      setPhase({ k: 'badlink', as: session?.user?.email || undefined })
      return
    }
    if (!session?.user) { started.current = null; setPhase((p) => ({ k: 'signin', note: p.k === 'signin' ? p.note : undefined })); return }
    /* away too long: sign out first (a link that just came in counts as being here) */
    if (awayTooLong() && !ARRIVED && !DIRECT) {
      try { localStorage.removeItem(IDLE_KEY) } catch { /* fine */ }
      started.current = null
      await supabase.auth.signOut()
      setPhase({ k: 'signin', note: AWAY_NOTE })
      return
    }
    touch()
    const user = session.user
    if (started.current === user.id) return
    started.current = user.id
    setPhase({ k: 'loading' })
    /* let in = has a role; the first person to sign up was made the admin by the database */
    const found = await lookUp(user.id)
    if (!found.ok) { started.current = null; setPhase({ k: 'problem', why: 'network', detail: found.error?.message }); return }
    const appRoles = found.roles
    if (appRoles.length) remember(user.id)
    const name = found.name || user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0]
    /* from a link: a password first, then the app — for the link's person, whoever was signed in here before */
    if (ARRIVED && !askedPassword) {
      askedPassword = true
      started.current = null
      hold.current = user.id
      const was = BEFORE && BEFORE.toLowerCase() !== (user.email || '').toLowerCase() ? BEFORE : undefined
      setPhase({ k: 'password', email: user.email || '', name, why: ARRIVED, was })
      return
    }
    if (!appRoles.length) { setPhase({ k: 'waiting', email: user.email || '', name }); return }
    /* the admin asked for the sample projects (Try it with sample projects): a made-up company to try everything on —
       nothing is saved, and the company's own data isn't even loaded. Everyone else opens the company's own data. */
    const admin = appRoles.includes('admin')
    const sample = admin && wantsSampleLook()
    if (!sample) { try { sessionStorage.removeItem('tileos-sample-look') } catch { /* fine */ } }
    let res = sample ? startSample(user, { admin, name, appRoles }) : await startCloud(user, { admin, name, appRoles })
    /* the company's data didn't load (the server busy for a moment): twice more before saying so */
    for (let i = 0; i < 2 && !res.ok && res.why === 'network'; i++) { await pause(1500 * (i + 1)); res = await startCloud(user, { admin, name, appRoles }) }
    if (!res.ok) { started.current = null; setPhase({ k: 'problem', why: res.why, detail: res.detail }); return }
    REAL.signOut = () => void signOut()
    setPhase({ k: 'ready' })
  }, [signOut])

  React.useEffect(() => {
    let live = true
    const go = () => supabase.auth.getSession().then(({ data }) => { if (live) void begin(data.session) })
    if (DIRECT || (LINK.access && LINK.refresh)) void linkSignIn().then(() => { void go() })
    else void go()
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { started.current = null; hold.current = null; setPhase({ k: 'signin' }); return }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') void begin(session)
    })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [begin])

  /* waiting to be let in: look again every 20 seconds — the page opens the app by itself the moment they're in */
  React.useEffect(() => {
    if (phase.k !== 'waiting') return
    const t = setInterval(() => {
      void supabase.auth.getSession().then(async ({ data }) => {
        const u = data.session?.user
        if (!u) return
        const f = await lookUp(u.id)
        if (f.ok && f.roles.length) { started.current = null; void begin(data.session) }
      })
    }, 20_000)
    return () => clearInterval(t)
  }, [phase.k, begin])

  /* while it's open: every tap or key keeps it signed in; 12 hours with neither signs out by itself */
  React.useEffect(() => {
    if (phase.k !== 'ready') return
    let last = 0
    const seen = () => { const n = Date.now(); if (n - last > 60_000) { last = n; touch() } }
    const look = () => { if (awayTooLong()) { stopCloud(); started.current = null; void supabase.auth.signOut().then(() => setPhase({ k: 'signin', note: AWAY_NOTE })) } }
    window.addEventListener('pointerdown', seen, { passive: true })
    window.addEventListener('keydown', seen)
    document.addEventListener('visibilitychange', look)
    const every = setInterval(look, 5 * 60 * 1000)
    return () => { window.removeEventListener('pointerdown', seen); window.removeEventListener('keydown', seen); document.removeEventListener('visibilitychange', look); clearInterval(every) }
  }, [phase.k])

  if (phase.k === 'loading') return <Splash />
  if (phase.k === 'signin') return <SignIn note={phase.note} />
  const onward = () => { hold.current = null; location.hash = ''; void supabase.auth.getSession().then(({ data }) => begin(data.session)) }
  if (phase.k === 'password') return <SetPassword email={phase.email} name={phase.name} why={phase.why} was={phase.was} onDone={onward} onSkip={phase.why === 'magiclink' ? onward : undefined} />
  if (phase.k === 'badlink') return <LinkUsed as={phase.as} onContinue={phase.as ? onward : undefined} onSignIn={() => { hold.current = null; setPhase({ k: 'signin' }) }} onSignOut={signOut} />
  if (phase.k === 'waiting') return <WaitingRoom email={phase.email} name={phase.name} onSignOut={signOut} onCheck={() => { started.current = null; void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} />
  if (phase.k === 'problem') return <SetupNeeded why={phase.why} detail={phase.detail} onRetry={() => { void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} onSignOut={signOut} />
  return <App />
}
