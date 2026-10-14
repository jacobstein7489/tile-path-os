/* The real app starts here: sign in → let in? → the company's data → the app.
 * (The preview page on claude.ai starts from main.tsx instead and keeps a test in the browser.) */
import * as React from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'
import App from './App'
import { REAL } from './lib/save'
import { startCloud, stopCloud, type CloudProblem } from './lib/cloud'
import { SignIn, WaitingRoom, Splash, SetupNeeded } from './features/signin'

type Phase =
  | { k: 'loading' }
  | { k: 'signin' }
  | { k: 'waiting'; email: string; name: string }
  | { k: 'problem'; why: CloudProblem; detail?: string }
  | { k: 'ready' }

const sb = supabase as any

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
    if (!appRoles.length) { setPhase({ k: 'waiting', email: user.email || '', name }); return }
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
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') void begin(session)
    })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [begin])

  if (phase.k === 'loading') return <Splash />
  if (phase.k === 'signin') return <SignIn />
  if (phase.k === 'waiting') return <WaitingRoom email={phase.email} name={phase.name} onSignOut={signOut} onCheck={() => { started.current = null; void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} />
  if (phase.k === 'problem') return <SetupNeeded why={phase.why} detail={phase.detail} onRetry={() => { void supabase.auth.getSession().then(({ data }) => begin(data.session)) }} onSignOut={signOut} />
  return <App />
}
