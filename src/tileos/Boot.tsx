/* The real app starts here: sign in → let in? → the company's data → the app.
 * (The preview page on claude.ai starts from main.tsx instead and keeps a test in the browser.) */
import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import App from './App'
import { REAL, wantsSampleLook, declinedSample, setSaveStatus } from './lib/save'
import { useStore, initialData } from './store'
import { startCloud, stopCloud, type CloudProblem } from './lib/cloud'
import { SignIn, WaitingRoom, Splash, SetupNeeded, SetPassword } from './features/signin'

type Phase =
  | { k: 'loading' }
  | { k: 'signin' }
  | { k: 'password'; email: string; name: string; why: 'invite' | 'recovery' | 'magiclink' }
  | { k: 'waiting'; email: string; name: string }
  | { k: 'problem'; why: CloudProblem; detail?: string }
  | { k: 'ready' }

const sb = supabase as any

/* came in from an invite, a texted link or a password link: the link signs them in, and the app asks for a password.
 * Read before anything touches the URL (the auth client clears it once it has the session). */
const ARRIVED = ((): 'invite' | 'recovery' | 'magiclink' | null => {
  try {
    const h = new URLSearchParams(location.hash.replace(/^#\/?/, '').replace(/^[^?&]*[?]/, ''))
    const q = new URLSearchParams(location.search)
    const t = h.get('type') || q.get('type')
    return t === 'invite' || t === 'recovery' || t === 'magiclink' ? t : null
  } catch { return null }
})()
let askedPassword = false

export default function Boot() {
  const [phase, setPhase] = React.useState<Phase>({ k: 'loading' })
  const started = React.useRef<string | null>(null)

  const signOut = React.useCallback(async () => {
    stopCloud()
    started.current = null
    await supabase.auth.signOut()
    location.hash = ''
    location.reload()
  }, [])

  const begin = React.useCallback(async (session: Session | null) => {
    if (!session?.user) { started.current = null; setPhase({ k: 'signin' }); return }
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
    /* the admin asked for a look at the sample — or the company has no projects yet, so every page would be empty:
       the app opens on the made-up projects, nothing goes to the database, one tap starts their own */
    let sample = appRoles.includes('admin') && wantsSampleLook()
    if (!sample && appRoles.includes('admin') && !declinedSample()) {
      const { count, error } = await sb.from('tileos_records').select('id', { count: 'exact', head: true }).eq('collection', 'jobs')
      if (!error && count === 0) sample = true
    }
    if (sample) {
      REAL.sampleView = true
      useStore.getState().replaceData(initialData())
      REAL.email = user.email || undefined
      REAL.signOut = () => void signOut()
      setSaveStatus({ where: 'none', mode: 'sample' })
      setPhase({ k: 'ready' })
      return
    }
    const res = await startCloud(user, { admin: appRoles.includes('admin'), name, appRoles })
    if (!res.ok) { started.current = null; setPhase({ k: 'problem', why: res.why, detail: res.detail }); return }
    REAL.signOut = () => void signOut()
    setPhase({ k: 'ready' })
  }, [signOut])

  React.useEffect(() => {
    let live = true
    supabase.auth.getSession().then(({ data }) => { if (live) void begin(data.session) })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { started.current = null; setPhase({ k: 'signin' }); return }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') void begin(session)
    })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [begin])

  if (phase.k === 'loading') return <Splash />
  if (phase.k === 'signin') return <SignIn />
  if (phase.k === 'password') return <SetPassword email={phase.email} name={phase.name} why={phase.why} onDone={() => { location.hash = ''; void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} onSkip={phase.why === 'magiclink' ? () => { location.hash = ''; void supabase.auth.getSession().then(({ data }) => begin(data.session)) } : undefined} />
  if (phase.k === 'waiting') return <WaitingRoom email={phase.email} name={phase.name} onSignOut={signOut} onCheck={() => { started.current = null; void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} />
  if (phase.k === 'problem') return <SetupNeeded why={phase.why} detail={phase.detail} onRetry={() => { void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} onSignOut={signOut} />
  return <App />
}
