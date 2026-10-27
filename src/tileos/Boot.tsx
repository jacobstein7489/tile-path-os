/* The real app starts here: sign in → let in? → the company's data → the app.
 * (The preview page on claude.ai starts from main.tsx instead and keeps a test in the browser.) */
import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import App from './App'
import { REAL } from './lib/save'
import { startCloud, stopCloud, type CloudProblem } from './lib/cloud'
import { SignIn, WaitingRoom, Splash, SetupNeeded, SetPassword } from './features/signin'

type Phase =
  | { k: 'loading' }
  | { k: 'signin'; note?: string }
  | { k: 'password'; email: string; name: string; why: 'invite' | 'recovery' | 'magiclink' }
  | { k: 'waiting'; email: string; name: string }
  | { k: 'problem'; why: CloudProblem; detail?: string }
  | { k: 'ready' }

const sb = supabase as any

/* signed out by itself after a while away: 12 hours with no tap or key on Tile OS (overnight, a computer left on at the
 * office) — the next time, it asks for the password and pops up the day. While someone's using it, it never does. */
const IDLE_KEY = 'tileos-last-active'
const IDLE_MS = 12 * 60 * 60 * 1000
const touch = () => { try { localStorage.setItem(IDLE_KEY, String(Date.now())) } catch { /* private window */ } }
const awayTooLong = () => { try { const t = Number(localStorage.getItem(IDLE_KEY) || 0); return t > 0 && Date.now() - t > IDLE_MS } catch { return false } }
const AWAY_NOTE = 'Signed out after 12 hours away — sign in again.'

/* came in from an invite, a texted link or a password link: the link signs them in, and the app asks for a password.
 * Read before anything touches the URL (the auth client clears it once it has the session). */
const ARRIVED = ((): 'invite' | 'recovery' | 'magiclink' | null => {
  try {
    const h = new URLSearchParams(location.hash.replace(/^#\/?/, '').replace(/^[^?&]*[?]/, ''))
    const q = new URLSearchParams(location.search)
    const t = h.get('type') || q.get('type')
    /* a sign-up confirmation is the invite's link when the account was made by the invite */
    return t === 'invite' || t === 'recovery' || t === 'magiclink' ? t : t === 'signup' ? 'invite' : null
  } catch { return null }
})()
let askedPassword = false
/* a link the app made itself (the one the admin texts): the token is checked right here, with no stop at the sign-in
 * service — so it lands in the app, never on a Lovable page */
const DIRECT = ((): { th: string; type: 'recovery' | 'invite' | 'magiclink' } | null => {
  try {
    const h = new URLSearchParams(location.hash.replace(/^#\/?/, '').replace(/^[^?&]*[?]/, ''))
    const q = new URLSearchParams(location.search)
    const th = h.get('th') || q.get('th')
    const t = h.get('type') || q.get('type')
    return th && (t === 'recovery' || t === 'invite' || t === 'magiclink') ? { th, type: t } : null
  } catch { return null }
})()

export default function Boot() {
  const [phase, setPhase] = React.useState<Phase>({ k: 'loading' })
  const started = React.useRef<string | null>(null)

  const signOut = React.useCallback(async () => {
    stopCloud()
    started.current = null
    try { localStorage.removeItem(IDLE_KEY) } catch { /* fine */ }
    await supabase.auth.signOut()
    location.hash = ''
    location.reload()
  }, [])

  const begin = React.useCallback(async (session: Session | null) => {
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
    const [{ data: roles }, { data: profile }] = await Promise.all([
      sb.from('user_roles').select('role').eq('user_id', user.id),
      sb.from('profiles').select('full_name').eq('user_id', user.id).maybeSingle(),
    ])
    const appRoles: string[] = (roles || []).map((r: any) => r.role)
    const name = profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || (user.email || '').split('@')[0]
    /* from a link: a password first, then the app */
    if (ARRIVED && !askedPassword) { askedPassword = true; started.current = null; setPhase({ k: 'password', email: user.email || '', name, why: ARRIVED }); return }
    if (!appRoles.length) { setPhase({ k: 'waiting', email: user.email || '', name }); return }
    /* only the company's own data — no sample to look at */
    try { sessionStorage.removeItem('tileos-sample-look') } catch { /* fine */ }
    const res = await startCloud(user, { admin: appRoles.includes('admin'), name, appRoles })
    if (!res.ok) { started.current = null; setPhase({ k: 'problem', why: res.why, detail: res.detail }); return }
    REAL.signOut = () => void signOut()
    setPhase({ k: 'ready' })
  }, [signOut])

  React.useEffect(() => {
    let live = true
    const go = () => supabase.auth.getSession().then(({ data }) => { if (live) void begin(data.session) })
    if (DIRECT) {
      /* sign in with the link's token first; a used or old link falls back to the sign-in page */
      void supabase.auth.verifyOtp({ token_hash: DIRECT.th, type: DIRECT.type }).then(({ error }) => {
        if (error) { askedPassword = true; try { history.replaceState(null, '', location.pathname) } catch { /* fine */ } }
        void go()
      })
    } else void go()
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { started.current = null; setPhase({ k: 'signin' }); return }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') void begin(session)
    })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [begin])

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
  if (phase.k === 'password') return <SetPassword email={phase.email} name={phase.name} why={phase.why} onDone={() => { location.hash = ''; void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} onSkip={phase.why === 'magiclink' ? () => { location.hash = ''; void supabase.auth.getSession().then(({ data }) => begin(data.session)) } : undefined} />
  if (phase.k === 'waiting') return <WaitingRoom email={phase.email} name={phase.name} onSignOut={signOut} onCheck={() => { started.current = null; void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} />
  if (phase.k === 'problem') return <SetupNeeded why={phase.why} detail={phase.detail} onRetry={() => { void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} onSignOut={signOut} />
  return <App />
}
