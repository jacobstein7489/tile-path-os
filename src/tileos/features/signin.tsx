/* The screens before the app: sign in, pick a password (from an invite or a password link), a link that doesn't work
 * any more, waiting to be let in, and the one-time setup note. New people come in by the admin's invite only. */
import * as React from 'react'
import { appUrl } from '@/tileos/lib/save'
import { ArrowRight, Hourglass, Database, RefreshCw, LogOut, KeyRound, Link2Off, Mail } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { lovable } from '@/integrations/lovable'
import { Button, TextInput } from '@/tileos/components/ui/core'
import type { CloudProblem } from '@/tileos/lib/cloud'
import logoUrl from '@/tileos/assets/logo.svg'

/** the first look after signing in pops up the day (what's late, what's due) */
export const markSignedIn = () => { try { sessionStorage.setItem('tileos-signed-in', '1'); localStorage.setItem('tileos-last-active', String(Date.now())) } catch { /* private window */ } }

/** the company's own logo on top of every screen before the app — the one on the emails */
function Mark() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <img src={logoUrl} alt="Cobblestone Tile Installation" className="h-[4.75rem] w-auto" />
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-[#22372b]/70">Tile OS</span>
    </div>
  )
}
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top,#ffffff_0%,#f4f1eb_60%)] px-5 py-12">
      <div className="w-full max-w-[400px]">
        <Mark />
        <div className="rounded-[18px] border border-[#ebe6dd] bg-white p-7 shadow-[0_1px_2px_rgba(34,55,43,.04),0_12px_32px_-12px_rgba(34,55,43,.18)]">{children}</div>
        <div className="mt-5 text-center text-[12px] text-faint">Cobblestone Tile Installation</div>
      </div>
    </main>
  )
}

export function Splash() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3 text-muted">
        <img src={logoUrl} alt="Cobblestone" className="h-14 w-auto animate-pulse" />
        <span className="text-[13.5px]">Opening Tile OS…</span>
      </div>
    </main>
  )
}

export function SignIn({ note }: { note?: string } = {}) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<{ bad?: boolean; text: string } | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw error
      markSignedIn()
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
  /* forgot it: an email with a link that opens the app and asks for a new one */
  const forgot = async () => {
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setMsg({ bad: true, text: 'Type your email first, then tap “Forgot your password?”' }); return }
    setBusy(true); setMsg(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() })
      if (error) throw error
      setMsg({ text: `Check ${email.trim()} for a link — it opens Tile OS and asks for a new password.` })
    } catch (err: any) { setMsg({ bad: true, text: err?.message || 'That didn’t work — try again.' }) } finally { setBusy(false) }
  }
  return (
    <Sheet>
      {note && <div className="mb-4 rounded-[10px] bg-wash px-3 py-2 text-[13px] text-ink-2">{note}</div>}
      <h1 className="font-display text-[21px] font-semibold tracking-[-0.01em] text-ink">Sign in</h1>
      <p className="mt-1 text-[13.5px] text-muted">With your Cobblestone account.</p>
      <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Email</span><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="h-10" autoComplete="email" /></label>
        <label className="block"><span className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-ink-2">Password<button type="button" onClick={forgot} disabled={busy} className="font-semibold text-brand-700 hover:underline">Forgot your password?</button></span><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="h-10" autoComplete="current-password" /></label>
        {msg && <div className={msg.bad ? 'rounded-[10px] bg-bad-50 px-3 py-2 text-[13px] font-medium text-bad-700' : 'rounded-[10px] bg-ok-50 px-3 py-2 text-[13px] font-medium text-ok-700'}>{msg.text}</div>}
        <Button type="submit" variant="primary" className="mt-1 h-10 w-full justify-center" disabled={busy} iconRight={<ArrowRight />}>Sign in</Button>
      </form>
      <div className="my-4 flex items-center gap-3 text-[12px] text-faint"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <Button className="h-10 w-full justify-center" disabled={busy} onClick={google}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" /></svg>
        Continue with Google
      </Button>
      {/* no sign-ups: the admin invites each person (Settings → Team), and the invite sets up their login */}
      <div className="mt-5 text-center text-[13px] text-muted" data-no-signup>New here? Your admin sends you an invite.</div>
    </Sheet>
  )
}

/** you came in from an invite or a password link: pick a password, and the app opens */
export function SetPassword({ email, name, why, was, onDone, onSkip }: { email: string; name: string; why: 'invite' | 'recovery' | 'magiclink'; was?: string; onDone: () => void; onSkip?: () => void }) {
  const [password, setPassword] = React.useState('')
  const [again, setAgain] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { setMsg('At least 8 characters.'); return }
    if (password !== again) { setMsg('The two don’t match.'); return }
    setBusy(true); setMsg(null)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      markSignedIn()
      onDone()
    } catch (err: any) { setMsg(err?.message || 'That didn’t work — try again.'); setBusy(false) }
  }
  return (
    <Sheet>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600"><KeyRound className="h-5 w-5" /></span>
      <h1 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">{why === 'invite' ? `Welcome to Tile OS${name ? `, ${name.split(' ')[0]}` : ''}` : `${name ? `${name.split(' ')[0]}, pick` : 'Pick'} your password`}</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{why === 'invite' ? 'Pick a password — you sign in with it from now on, with your email, on your phone and your computer.' : 'You sign in with it from now on — with your email, on your phone and your computer.'}</p>
      <div className="mt-3 rounded-[10px] bg-wash px-3 py-2 text-[13px] text-muted" data-password-for>For <b className="font-semibold text-ink-2">{email}</b></div>
      {was && <div className="mt-2 rounded-[10px] border border-line px-3 py-2 text-[12.5px] leading-snug text-muted" data-was-signed-in>This browser was signed in as <b className="font-semibold text-ink-2">{was}</b> — the link signed that out here. Sign in as yourself again after.</div>}
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Password</span><TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" className="h-10" autoComplete="new-password" autoFocus /></label>
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Once more</span><TextInput type="password" value={again} onChange={(e) => setAgain(e.target.value)} required minLength={8} placeholder="The same again" className="h-10" autoComplete="new-password" /></label>
        {msg && <div className="rounded-[10px] bg-bad-50 px-3 py-2 text-[13px] font-medium text-bad-700">{msg}</div>}
        <Button type="submit" variant="primary" className="mt-1 h-10 w-full justify-center" disabled={busy} iconRight={<ArrowRight />}>{busy ? 'Saving…' : 'Save it and open Tile OS'}</Button>
        {onSkip && <button type="button" onClick={onSkip} className="text-center text-[13px] font-semibold text-muted hover:text-ink">Keep the password I have</button>}
      </form>
    </Sheet>
  )
}

/** the link was used already (each one works once) or it's too old: say so, and send a fresh one to their email */
export function LinkUsed({ as, onContinue, onSignIn, onSignOut }: { as?: string; onContinue?: () => void; onSignIn: () => void; onSignOut: () => void }) {
  const [email, setEmail] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [msg, setMsg] = React.useState<{ bad?: boolean; text: string } | null>(null)
  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setMsg({ bad: true, text: 'Type the email the invite came to.' }); return }
    setBusy(true); setMsg(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() })
      if (error) throw error
      setMsg({ text: `Sent to ${email.trim()} — open the newest email (check Spam too). It opens Tile OS and asks for a password.` })
    } catch (err: any) {
      setMsg({ bad: true, text: /60 seconds|rate limit|security purposes/i.test(err?.message || '') ? 'One a minute — wait a moment and send it again.' : err?.message || 'That didn’t work — try again.' })
    } finally { setBusy(false) }
  }
  return (
    <Sheet>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-warn-50 text-warn-600"><Link2Off className="h-5 w-5" /></span>
      <h1 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink" data-link-used>This link doesn’t work anymore</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Each link works once, and only for a day. Type your email and we’ll send a fresh one — or ask your admin to send the invite again.</p>
      <form onSubmit={send} className="mt-4 flex flex-col gap-3">
        <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-ink-2">Your email</span><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="h-10" autoComplete="email" autoFocus={!as} /></label>
        {msg && <div className={msg.bad ? 'rounded-[10px] bg-bad-50 px-3 py-2 text-[13px] font-medium text-bad-700' : 'rounded-[10px] bg-ok-50 px-3 py-2 text-[13px] font-medium text-ok-700'}>{msg.text}</div>}
        <Button type="submit" variant="primary" className="h-10 w-full justify-center" disabled={busy} icon={<Mail />}>{busy ? 'Sending…' : 'Email me a new link'}</Button>
      </form>
      {as ? (
        <div className="mt-5 rounded-[10px] bg-wash px-3 py-2.5 text-[13px] text-muted" data-signed-in-as>
          You’re signed in here as <b className="font-semibold text-ink-2">{as}</b>.
          <div className="mt-2 flex flex-wrap gap-2">
            {onContinue && <Button size="sm" onClick={onContinue} iconRight={<ArrowRight />}>Go on as {as.split('@')[0]}</Button>}
            <Button size="sm" variant="ghost" icon={<LogOut />} onClick={onSignOut}>Sign out</Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 text-center text-[13px] text-muted">Have a password? <button type="button" onClick={onSignIn} className="font-semibold text-brand-700 hover:underline">Sign in</button></div>
      )}
    </Sheet>
  )
}

export function WaitingRoom({ email, name, onSignOut, onCheck }: { email: string; name: string; onSignOut: () => void; onCheck: () => void }) {
  return (
    <Sheet>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-warn-50 text-warn-600"><Hourglass className="h-5 w-5" /></span>
      <h1 className="mt-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink">You’re not on the team yet, {name.split(' ')[0]}</h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">Ask your admin to invite this email — or to let you in from Settings → Team. Then this page opens the app.</p>
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
