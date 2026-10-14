/* The screens before the app: sign in (or make an account), waiting to be let in, and the one-time setup note. */
import * as React from 'react'
import { ArrowRight, Hourglass, Database, RefreshCw, LogOut } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable'
import { Button, TextInput } from '@/tileos/components/ui/core'
import type { CloudProblem } from '@/tileos/lib/cloud'

function Mark() {
  return (
    <div className="mb-7 flex items-center gap-2.5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" /></svg>
      </span>
      <span className="font-display text-[16px] font-semibold leading-tight tracking-[-0.01em] text-ink">Cobblestone<br /><span className="text-muted">Tile OS</span></span>
    </div>
  )
}
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-12">
      <div className="w-full max-w-[400px]">
        <Mark />
        <div className="rounded-[16px] border border-line bg-white p-6 shadow-card">{children}</div>
      </div>
    </main>
  )
}

export function Splash() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3 text-muted">
        <span className="inline-flex h-10 w-10 animate-pulse items-center justify-center rounded-[11px] bg-brand-600 text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M12 2l5 5-5 5-5-5 5-5zM5 12l5 5-5 5-5-5 5-5zM19 12l5 5-5 5-5-5 5-5z" /></svg>
        </span>
        <span className="text-[13.5px]">Opening Tile OS…</span>
      </div>
    </main>
  )
}

export function SignIn() {
  const [mode, setMode] = React.useState<'in' | 'up'>('in')
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<{ bad?: boolean; text: string } | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setMsg({ text: 'Check your email to confirm it — then sign in here.' })
      }
    } catch (err: any) {
      setMsg({ bad: true, text: /invalid login/i.test(err?.message || '') ? 'That email and password don’t match.' : err?.message || 'That didn’t work — try again.' })
    } finally {
      setBusy(false)
    }
  }
  const google = async () => {
    setBusy(true)
    try { await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin }) } catch (err: any) { setMsg({ bad: true, text: err?.message || 'Google sign-in didn’t work' }); setBusy(false) }
  }
  return (
    <Sheet>
      <h1 className="font-display text-[21px] font-semibold tracking-[-0.01em] text-ink">{mode === 'in' ? 'Sign in' : 'Make your account'}</h1>
      <p className="mt-1 text-[13.5px] text-muted">{mode === 'in' ? 'With your Cobblestone account.' : 'Once you’re in, the admin lets you in and picks what you see.'}</p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        {mode === 'up' && (
          <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Your name</span><TextInput value={name} onChange={(e) => setName(e.target.value)} required placeholder="First and last name" className="h-10" autoComplete="name" /></label>
        )}
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Email</span><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="h-10" autoComplete="email" /></label>
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Password</span><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder={mode === 'up' ? 'At least 8 characters' : '••••••••'} className="h-10" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
        {msg && <div className={msg.bad ? 'rounded-[10px] bg-bad-50 px-3 py-2 text-[13px] font-medium text-bad-700' : 'rounded-[10px] bg-ok-50 px-3 py-2 text-[13px] font-medium text-ok-700'}>{msg.text}</div>}
        <Button type="submit" variant="primary" className="mt-1 h-10 w-full justify-center" disabled={busy} iconRight={<ArrowRight />}>{mode === 'in' ? 'Sign in' : 'Make my account'}</Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-[12px] text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <Button className="h-10 w-full justify-center" disabled={busy} onClick={google}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
        Continue with Google
      </Button>
      <div className="mt-5 text-center text-[13px] text-muted">
        {mode === 'in' ? <>New here? <button type="button" onClick={() => { setMode('up'); setMsg(null) }} className="font-semibold text-brand-700 hover:underline">Make an account</button></> : <>Have an account? <button type="button" onClick={() => { setMode('in'); setMsg(null) }} className="font-semibold text-brand-700 hover:underline">Sign in</button></>}
      </div>
    </Sheet>
  )
}

export function WaitingRoom({ email, name, onSignOut, onCheck }: { email: string; name: string; onSignOut: () => void; onCheck: () => void }) {
  return (
    <Sheet>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-warn-50 text-warn-600"><Hourglass className="h-5 w-5" /></span>
      <h1 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">You’re signed up, {name.split(' ')[0]}</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">The admin lets you in and picks what you see — it shows on their Settings → Team. Then this page opens the app.</p>
      <div className="mt-4 rounded-[10px] bg-wash px-3 py-2 text-[13px] text-muted">Signed in as <b className="font-semibold text-ink-2">{email}</b></div>
      <div className="mt-5 flex gap-2">
        <Button variant="primary" icon={<RefreshCw />} onClick={onCheck}>Check again</Button>
        <Button variant="ghost" icon={<LogOut />} onClick={onSignOut}>Sign out</Button>
      </div>
    </Sheet>
  )
}

export function SetupNeeded({ why, detail, onRetry, onSignOut }: { why: CloudProblem; detail?: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <Sheet>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Database className="h-5 w-5" /></span>
      {why === 'setup' ? (
        <>
          <h1 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">One step left: the database</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">The app’s table isn’t in the database yet. In Lovable, type this in the chat and send it:</p>
          <div className="mt-3 rounded-[10px] border border-line bg-wash px-3 py-2.5 font-mono text-[13px] text-ink">Apply pending Supabase migrations</div>
          <p className="mt-3 text-[13px] text-muted">Then come back and press Try again.</p>
        </>
      ) : why === 'denied' ? (
        <>
          <h1 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">Your login can’t open the company’s data</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Ask the admin to let you in from Settings → Team.</p>
        </>
      ) : (
        <>
          <h1 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">Couldn’t reach the database</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Check the internet connection and try again.</p>
        </>
      )}
      {detail && <div className="mt-3 truncate text-[12px] text-faint" title={detail}>{detail}</div>}
      <div className="mt-5 flex gap-2">
        <Button variant="primary" icon={<RefreshCw />} onClick={onRetry}>Try again</Button>
        <Button variant="ghost" icon={<LogOut />} onClick={onSignOut}>Sign out</Button>
      </div>
    </Sheet>
  )
}
