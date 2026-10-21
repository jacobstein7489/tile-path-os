/* Settings — the admin's room: the team and their logins, what each login sees, and the rules the system runs on. */
import * as React from 'react'
import { ShieldCheck, Users, HardHat, Plug, CheckCircle2, Mail, MessageCircle, FolderOpen, BookOpen, UserPlus, Calculator, RotateCcw, Pencil, Check, Smartphone, LogIn, Calendar, Eye, ListChecks, Plus, Trash2, CornerDownRight, Layers, X , ChevronRight, Send, Copy, Link2 } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore, signInAs } from '@/tileos/store'
import { CardHeader, Button, Segmented, Chip, Avatar, Pill, Stepper as NumStepper, IconCircle, TextInput, TextArea, Field, UnderlineTabs } from '@/tileos/components/ui/core'
import { DEPOSIT_WAY, type DepositWay } from './progressbill'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { Page, Card } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { ROLES, PEOPLE, CREWS, ACCESS_PAGES, LOGIN_TYPES, type Role, type PersonKey } from '@/tileos/data/model'
import { MAT_RULES0, MAT_RULE_ROWS } from '@/tileos/data/takeoff'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { addMember, updateMember, setAccess, resetAccess, removeMember } from './team'
import { companySteps, addCompanyStep, removeCompanyStep, setCompanyStepOwner, BUILT_IN } from './steps'
import { insidePeople } from './steps-ui'
import { STATUS_BOOK } from './statuses'
import { companyTeam, companyAreas, surfaceOf, setCompanyTeam, addCompanyArea, removeCompanyArea, setCompanyAreaSurfaces, addCompanySurface, removeCompanySurface } from './estflow'
import { TeamSlots, SurfaceAdd } from './estnew'
import { AutomationsTab } from './automations'
import { TestDataTab } from './testdata'
import { PracticeTab } from './practice'
import { REAL, lookAtSample, type WaitingPerson } from '@/tileos/lib/save'
import { TODAY } from '@/tileos/lib/today'

type Tab = 'team' | 'access' | 'checklist' | 'autos' | 'statuses' | 'rules' | 'numbers' | 'connections' | 'practice' | 'testdata'
const LOGINS = ROLES.filter((r) => r.key !== 'crew' && LOGIN_TYPES.includes(r.key))
const INSIDE = LOGINS.filter((r) => r.key !== 'client')
const short = (r: Role) => ROLES.find((x) => x.key === r)!.label.split(' · ')[0]

export function SettingsPage() {
  const s = useStore()
  /* the real app has no test data — the company's data is the real thing */
  /* six tabs, not ten: the smaller parts sit under the tab they belong with (what each login sees under Team,
   * statuses under Checklists, material numbers under Company rules, test data under Practice) — old links still land */
  const [tab, setTab] = React.useState<Group>(() => GROUP_OF[(s.route.tab as Tab) || 'team'] || 'team')
  const below = (k: Tab) => { if (s.route.tab !== k) return; window.setTimeout(() => document.getElementById(`settings-${k}`)?.scrollIntoView({ block: 'start' }), 60) }
  React.useEffect(() => { below(s.route.tab as Tab) }, [])
  return (
    <Page
      title="Settings"
      sub="The team, what each login sees, and the rules the system runs on."
      bare
      top={<UnderlineTabs value={tab} onChange={setTab} items={[{ key: 'team', label: 'Team', count: s.team.filter((m) => m.status !== 'off').length }, { key: 'checklist', label: 'Checklists' }, { key: 'autos', label: 'Automations' }, { key: 'rules', label: 'Company rules' }, { key: 'connections', label: 'Connections' }, { key: 'practice', label: 'Practice project' }]} />}
    >
      {tab === 'team' && <div className="flex flex-col gap-10"><TeamTab /><div id="settings-access"><AccessTab /></div></div>}
      {tab === 'checklist' && <div className="flex flex-col gap-10"><ChecklistTab /><div id="settings-statuses"><StatusesTab /></div></div>}
      {tab === 'autos' && <AutomationsTab />}
      {tab === 'rules' && <div className="flex flex-col gap-10"><RulesTab /><div id="settings-numbers"><NumbersTab /></div></div>}
      {tab === 'connections' && <ConnectionsTab />}
      {tab === 'practice' && <div className="flex flex-col gap-10">{REAL.cloud && REAL.admin && <SampleLookCard />}{REAL.cloud && REAL.admin && <StartOverCard />}<PracticeTab />{!REAL.cloud && !REAL.sampleView && <div id="settings-testdata"><TestDataTab /></div>}</div>}
    </Page>
  )
}
type Group = 'team' | 'checklist' | 'autos' | 'rules' | 'connections' | 'practice'
const GROUP_OF: Record<Tab, Group> = { team: 'team', access: 'team', checklist: 'checklist', statuses: 'checklist', autos: 'autos', rules: 'rules', numbers: 'rules', connections: 'connections', practice: 'practice', testdata: 'practice' }

/* ================= the team ================= */
type Standing = { invited?: string; signedIn?: string; confirmed?: string; made?: string }
const Standings = React.createContext<Record<string, Standing> | null>(null)
const dayOf = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
function TeamTab() {
  const s = useStore()
  /* the real app: when each invite went out, and who has signed in since */
  const [standings, setStandings] = React.useState<Record<string, Standing> | null>(null)
  const emails = s.team.map((m) => (m.email || '').trim().toLowerCase()).filter(Boolean).join(',')
  React.useEffect(() => {
    if (!REAL.inviteStatus || !emails) return
    let live = true
    REAL.inviteStatus(emails.split(',')).then((r) => { if (live) setStandings(r) }).catch(() => { if (live) setStandings({}) })
    return () => { live = false }
  }, [emails])
  return (
    <Standings.Provider value={standings}>
    <div className="flex max-w-[56rem] flex-col gap-4">
      {REAL.people && REAL.admin && <WaitingToJoin />}
      <Card pad={false}>
        <CardHeader icon={<IconCircle tone="info" size={34}><Users className="h-4 w-4" /></IconCircle>} title="The team" sub="Everyone signs in with their own email and password, and sees only their part. Invite them — they make their own password." action={<Button size="sm" variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => s.open({ t: 'addperson' })}>Add a person</Button>} />
        <div className="border-t border-line-2">
          {s.team.filter((m) => m.role !== 'crew').map((m) => <MemberRow key={m.key} k={m.key} />)}
        </div>
      </Card>
      {REAL.testEmail && <EmailCheck />}
      <button onClick={() => s.go({ page: 'subs' })} className="flex items-center gap-3 rounded-[0.875rem] border border-line bg-white px-5 py-3 text-left text-[0.84375rem] text-muted transition hover:border-[#d1cbc0] hover:text-ink">
        <HardHat className="h-4 w-4 shrink-0 text-faint" /><span className="min-w-0 flex-1">The installers and their crews are on their own page — <b className="font-semibold text-ink-2">Installers</b></span><ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </button>
    </div>
    </Standings.Provider>
  )
}
/** do emails from the app land at all? the admin sends one to himself (a password link he can ignore) */
function EmailCheck() {
  const [busy, setBusy] = React.useState(false)
  const [said, setSaid] = React.useState('')
  const send = async () => {
    setBusy(true); setSaid('')
    try {
      const to = await REAL.testEmail!()
      setSaid(`Sent to ${to} — a password link you can ignore. Not there in a minute? Check spam. Never comes? Emails aren’t set up yet: in Lovable, More → Cloud → Emails.`)
    } catch (e: any) { setSaid(e?.message || 'Couldn’t send it') } finally { setBusy(false) }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[0.875rem] border border-line bg-white px-5 py-3 text-[0.84375rem] text-muted">
      <Mail className="h-4 w-4 shrink-0 text-faint" />
      <span className="min-w-0 flex-1">{said || 'Invites not landing? See if any email from the app reaches you.'}</span>
      <Button size="sm" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Send a test email to me'}</Button>
    </div>
  )
}
/** people who signed up and wait for the admin — let each in with the login type that decides what they see */
function WaitingToJoin() {
  const s = useStore()
  const [list, setList] = React.useState<WaitingPerson[] | null>(null)
  const [busy, setBusy] = React.useState('')
  const [problem, setProblem] = React.useState('')
  const load = React.useCallback(() => {
    setProblem('')
    REAL.people!.waiting().then(setList).catch((e) => { setList([]); setProblem(e?.message || 'Couldn’t load the sign-ups') })
  }, [])
  React.useEffect(() => { load() }, [load])
  if (!list || (!list.length && !problem)) return null
  const letIn = async (p: WaitingPerson, role: Role) => {
    setBusy(p.uid)
    try {
      /* someone already on the team list with the same email becomes this login — or the empty spot for that job
         (the "Back office" or "Accounting" on a fresh team), so the tasks already there are theirs */
      const same = s.team.find((m) => !m.uid && m.email && m.email.toLowerCase() === p.email.toLowerCase()) || s.team.find((m) => !m.uid && !m.email && m.role === role && m.status !== 'off')
      await REAL.people!.letIn(p, role, same?.key)
      setList((xs) => (xs || []).filter((x) => x.uid !== p.uid))
      toast(`${p.name} can sign in now`, { description: `As ${short(role)} — they see what that login sees.` })
    } catch (e: any) {
      setProblem(e?.message || 'That didn’t work — try again')
    } finally {
      setBusy('')
    }
  }
  return (
    <Card pad={false} className="col-span-full border-warn-100">
      <CardHeader icon={<IconCircle tone="warn" size={34}><UserPlus className="h-4 w-4" /></IconCircle>} title={`Waiting to join · ${list.length}`} sub="They signed up and can’t see anything yet. Let each one in with the login type that decides what they see." action={<Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={load}>Check again</Button>} />
      <div className="border-t border-line-2">
        {list.map((p) => (
          <div key={p.uid} className="flex items-center gap-3 border-b border-line-2 px-6 py-2.5 last:border-0 max-sm:flex-wrap max-sm:px-4">
            <span className="inline-flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full bg-warn-50 text-[0.8125rem] font-semibold text-warn-700">{(p.name || '?').trim().charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.875rem] font-semibold text-ink">{p.name}</span>
              <span className="block truncate text-[0.78125rem] text-muted">{p.email}{p.since ? ` · signed up ${new Date(p.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
            </span>
            {(() => {
              const inv = s.team.find((m) => !m.uid && m.email && m.email.toLowerCase() === p.email.toLowerCase())
              return inv ? (
                <>
                  <Button size="sm" variant="primary" icon={<Check className="h-4 w-4" />} disabled={busy === p.uid} onClick={() => void letIn(p, inv.role)}>{busy === p.uid ? 'Letting in…' : `Let in as ${short(inv.role)}`}</Button>
                  <Menu align="end" width={300} trigger={<Button size="sm" variant="ghost" aria-label="Let in as something else">Other</Button>}>
                    <MenuLabel>Login type — decides what they see</MenuLabel>
                    {INSIDE.filter((r) => r.key !== 'owner').map((r) => <MenuItem key={r.key} hint={r.sees} onSelect={() => void letIn(p, r.key)}>{short(r.key)}</MenuItem>)}
                  </Menu>
                </>
              ) : (
                <Menu align="end" width={300} trigger={<Button size="sm" variant="primary" icon={<Check className="h-4 w-4" />} disabled={busy === p.uid}>{busy === p.uid ? 'Letting in…' : 'Let in as…'}</Button>}>
                  <MenuLabel>Login type — decides what they see</MenuLabel>
                  {INSIDE.filter((r) => r.key !== 'owner').map((r) => <MenuItem key={r.key} hint={r.sees} onSelect={() => void letIn(p, r.key)}>{short(r.key)}</MenuItem>)}
                </Menu>
              )
            })()}
          </div>
        ))}
        {problem && <div className="px-6 py-2.5 text-[0.8125rem] font-medium text-bad-700 max-sm:px-4">{problem}</div>}
      </div>
    </Card>
  )
}
function MemberRow({ k }: { k: PersonKey }) {
  const s = useStore()
  const m = s.team.find((x) => x.key === k)!
  const standings = React.useContext(Standings)
  const st = standings?.[(m.email || '').trim().toLowerCase()]
  /* in the real app: the invite went out (the account exists) but they haven't signed in yet */
  const sentNotIn = !m.uid && !!st && !st.signedIn
  const inAt = m.uid ? st?.signedIn : undefined
  const [edit, setEdit] = React.useState(false)
  const [first, setFirst] = React.useState(m.first)
  const [last, setLast] = React.useState(m.last || '')
  const [email, setEmail] = React.useState(m.email || '')
  const admin = m.role === 'owner'
  const save = () => {
    if (!first.trim()) return
    updateMember(k, { first: first.trim(), last: last.trim() || undefined, email: email.trim() || undefined }, `Saved — it shows as ${[first.trim(), last.trim()].filter(Boolean).join(' ')} everywhere`)
    setEdit(false)
  }
  return (
    <div className={cn('flex items-center gap-3 border-b border-line-2 px-6 py-2.5 last:border-0 max-sm:gap-2.5 max-sm:px-4', m.status === 'off' && 'opacity-50')}>
      <Avatar who={k} size={34} />
      {edit ? (
        <form className="flex min-w-0 flex-1 flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); save() }}>
          <TextInput autoFocus value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" className="h-9 w-[9.375rem]" />
          <TextInput value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" className="h-9 w-[9.375rem]" />
          <TextInput value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email to sign in" className="h-9 w-[13.75rem]" />
          <Button size="sm" variant="primary" type="submit" icon={<Check />}>Save</Button>
          <Button size="sm" variant="ghost" type="button" onClick={() => setEdit(false)}>Cancel</Button>
        </form>
      ) : (
        <button onClick={() => setEdit(true)} className="group min-w-0 flex-1 text-left">
          <span className="flex min-w-0 items-center gap-2 truncate text-[0.875rem] font-semibold text-ink"><span className="truncate">{PEOPLE[k].name}</span><Pencil className="h-3.5 w-3.5 text-faint opacity-0 transition group-hover:opacity-100" /></span>
          <span className="block truncate text-[0.78125rem] text-muted">{m.email || 'No email yet — click to add'}{sentNotIn ? <span className="text-warn-700"> · invite went out {dayOf(st!.invited || st!.made) || m.invited} — not opened yet</span> : inAt ? ` · last signed in ${dayOf(inAt)}` : m.uid ? '' : m.invited && standings && !st ? <span className="text-warn-700"> · invited {m.invited} — no account yet, send it again</span> : ''}</span>
        </button>
      )}
      {!edit && (
        <>
          {admin ? (
            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 text-[0.8125rem] font-semibold text-brand-700"><ShieldCheck className="h-4 w-4" />Admin</span>
          ) : (
            <Menu align="end" width={300} trigger={<button className="inline-flex h-8 max-w-[9.375rem] shrink-0 items-center gap-1.5 truncate rounded-lg border border-line px-2.5 text-[0.8125rem] font-semibold text-ink-2 hover:bg-wash">{short(m.role)}</button>}>
              <MenuLabel>Login type — decides what they see</MenuLabel>
              {LOGINS.filter((r) => r.key !== 'owner').map((r) => <MenuItem key={r.key} checked={m.role === r.key} hint={r.sees} onSelect={() => updateMember(k, { role: r.key }, `${PEOPLE[k].name} is now ${short(r.key)}`)}>{short(r.key)}</MenuItem>)}
            </Menu>
          )}
          {!admin && !m.uid && m.role !== 'client'
            ? <Button size="sm" variant={m.invited ? 'ghost' : undefined} icon={<Send className="h-4 w-4" />} onClick={() => s.open({ t: 'invite', key: k })}>{m.invited ? (sentNotIn ? 'Invite again' : 'Invited') : 'Invite'}</Button>
            : <span className="w-[4.75rem] text-right max-sm:hidden"><Pill tone="ok" size="sm">{m.uid ? 'Signs in' : 'Active'}</Pill></span>}
          <Menu align="end" width={220} trigger={<button aria-label={`More for ${PEOPLE[k].name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-wash-2">⋯</button>}>
            <MenuItem icon={<LogIn className="h-4 w-4" />} onSelect={() => signInAs(k)}>See what they see</MenuItem>
            {!admin && !m.uid && <MenuItem icon={<Send className="h-4 w-4" />} onSelect={() => s.open({ t: 'invite', key: k })}>{m.invited ? 'Invite again' : 'Invite them'}</MenuItem>}
            <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => setEdit(true)}>Rename</MenuItem>
            {!admin && <MenuItem danger onSelect={() => removeMember(k)} hint="Their login stops working">Remove from the team</MenuItem>}
          </Menu>
        </>
      )}
    </div>
  )
}

/** invite someone to sign in: their email and what they'll see, and a message with the link — sent from your own email
 *  or phone. They make their own password when they sign up; you let them in with one tap (Waiting to join). */
const APP_LINK = () => (REAL.cloud && typeof location !== 'undefined' ? location.origin : 'https://tile-path-os.lovable.app')
export function InviteModal({ k, level }: { k: PersonKey; level: number }) {
  const s = useStore()
  const m = s.team.find((x) => x.key === k)
  const [email, setEmail] = React.useState(m?.email || '')
  const [role, setRole] = React.useState<Role>(m?.role || 'office')
  const me = PEOPLE[REAL.me || 'ys']?.short || 'Yaakov'
  const msg0 = (e: string) => [`Hi ${m?.first || ''},`, '', 'You’re invited to Cobblestone Tile OS — it’s where we run our projects.', '', `1. Open ${APP_LINK()}`, `2. Sign up with this email: ${e || 'your email'}`, '3. Make your own password', '', 'I’ll let you in right away.', '', `— ${me}`].join('\n')
  const [msg, setMsg] = React.useState(() => msg0(m?.email || ''))
  const [touched, setTouched] = React.useState(false)
  const [sending, setSending] = React.useState(false)
  const [failed, setFailed] = React.useState('')
  if (!m) return null
  const ok = /\S+@\S+\.\S+/.test(email)
  const mark = () => updateMember(k, { email: email.trim(), role, status: 'invited', invited: TODAY }, `${m.first} is invited`)
  /* the real app sends the email itself; the preview hands you the message to send */
  const send = async () => {
    if (!REAL.invite || sending) return
    setSending(true); setFailed('')
    try {
      const r = await REAL.invite({ email: email.trim(), name: `${m.first} ${m.last || ''}`.trim(), role })
      mark()
      toast(r === 'already' ? `${m.first} can sign in now` : `Invite sent to ${email.trim()}`, { description: r === 'already' ? `They’d signed up already — they’re in as ${short(role)}.` : `They pick a password from the email and they’re in as ${short(role)}. No letting in needed.` })
      s.close()
    } catch (e: any) { setFailed(e?.message || 'Couldn’t send it') } finally { setSending(false) }
  }
  const subject = 'You’re invited to Cobblestone Tile OS'
  const copy = async () => { try { await navigator.clipboard.writeText(msg) } catch { /* no clipboard */ } mark(); toast('Copied — paste it in a text or an email', { description: `When ${m.first} signs up, let them in from Settings → Team.` }) }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={`Invite ${PEOPLE[k]?.name || m.first}`}
      sub={REAL.invite ? 'They get an email from Tile OS, pick a password, and they’re in.' : 'They make their own password when they sign up — you let them in with one tap.'}
      footer={REAL.invite ? (
        <>
          {failed && <span className="text-[0.8125rem] font-medium text-bad-600">{failed}</span>}
          <Button className="ml-auto" variant="primary" icon={<Send />} disabled={!ok || sending} onClick={send}>{sending ? 'Sending…' : 'Send the invite'}</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" disabled={!ok} onClick={copy}>Copy</Button>
          {m.phone && <Button disabled={!ok} onClick={() => { mark(); window.open(`sms:${m.phone}?&body=${encodeURIComponent(msg)}`) }}>Text it</Button>}
          <Button className="ml-auto" variant="primary" icon={<Send />} disabled={!ok} onClick={() => { mark(); window.open(`mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`); s.close() }}>Email the invite</Button>
        </>
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_13rem] gap-3 max-sm:grid-cols-1">
        <Field label="Their email — they sign up with it"><TextInput data-autofocus aria-label="Their email" value={email} onChange={(e) => { setEmail(e.target.value); if (!touched) setMsg(msg0(e.target.value.trim())) }} placeholder="name@cobblestonenj.com" className="h-10" /></Field>
        <Field label="What they’ll see">
          <Menu align="end" width={300} trigger={<button className="flex h-10 w-full items-center justify-between rounded-[0.625rem] border border-line bg-white px-3 text-[0.875rem] text-ink hover:border-[#cdc7bc]">{short(role)}<ChevronRight className="h-4 w-4 rotate-90 text-faint" /></button>}>
            <MenuLabel>Login type — decides what they see</MenuLabel>
            {INSIDE.filter((r) => r.key !== 'owner').map((r) => <MenuItem key={r.key} checked={role === r.key} hint={r.sees} onSelect={() => setRole(r.key)}>{short(r.key)}</MenuItem>)}
          </Menu>
        </Field>
      </div>
      {!REAL.invite && <Field label="The message" className="mt-3"><TextArea rows={9} aria-label="The message" value={msg} onChange={(e) => { setMsg(e.target.value); setTouched(true) }} /></Field>}
      {REAL.invite && <InviteLinkBox email={email} name={`${m.first} ${m.last || ''}`.trim()} role={role} phone={m.phone} first={m.first} ok={ok} onGot={mark} />}
    </Modal>
  )
}

/** when the email doesn't land (spam, a typo, the mail service): a one-time link the admin texts them — it signs
 *  them in and asks for a password. The real app only; the admin only. */
function InviteLinkBox({ email, name, role, phone, first, ok, onGot }: { email: string; name: string; role: Role; phone?: string; first: string; ok: boolean; onGot?: () => void }) {
  const [link, setLink] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [err, setErr] = React.useState('')
  if (!REAL.inviteLink) return null
  const get = async () => {
    setBusy(true); setErr('')
    try { setLink(await REAL.inviteLink!({ email: email.trim(), name, role })); onGot?.() } catch (e: any) { setErr(e?.message || 'Couldn’t make the link') } finally { setBusy(false) }
  }
  const text = `Hi ${first}, here’s your link to Cobblestone Tile OS — open it, pick a password, and you’re in: ${link}`
  const copy = async () => { try { await navigator.clipboard.writeText(link) } catch { /* no clipboard */ } toast('Link copied — paste it in a text', { description: 'It works once. They open it, pick a password, and they’re in.' }) }
  return (
    <div className="mt-3 rounded-xl border border-line bg-wash px-4 py-3">
      {!link ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="text-[0.84375rem] text-ink-2">Email not landing? Text them a link instead.</span>
          <Button size="sm" icon={<Link2 />} disabled={!ok || busy} onClick={get}>{busy ? 'Making the link…' : 'Get a link to text'}</Button>
        </div>
      ) : (
        <>
          <div className="text-[0.8125rem] font-semibold text-ink">Their link — it works once, and asks them for a password</div>
          <input readOnly aria-label="Invite link" value={link} onFocus={(e) => e.target.select()} className="mt-1.5 h-9 w-full rounded-lg border border-line bg-white px-2.5 text-[0.8125rem] text-ink-2 outline-none" />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" icon={<Copy />} onClick={copy}>Copy</Button>
            {phone && <Button size="sm" icon={<Smartphone />} onClick={() => window.open(`sms:${phone}?&body=${encodeURIComponent(text)}`)}>Text it to {phone}</Button>}
          </div>
        </>
      )}
      {err && <div className="mt-2 text-[0.8125rem] font-medium text-bad-600">{err}</div>}
    </div>
  )
}

export function AddPersonModal({ level }: { level: number }) {
  const s = useStore()
  const [first, setFirst] = React.useState('')
  const [last, setLast] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [role, setRole] = React.useState<Role>('office')
  const [client, setClient] = React.useState('')
  const ok = first.trim() && /\S+@\S+\.\S+/.test(email) && (role !== 'client' || !!client)
  const [busy, setBusy] = React.useState(false)
  const [failed, setFailed] = React.useState('')
  /* the real app emails the invite right away; the preview just adds them to the team */
  const add = async () => {
    if (!ok || busy) return
    setBusy(true); setFailed('')
    try {
      if (REAL.invite && role !== 'client') await REAL.invite({ email: email.trim(), name: `${first.trim()} ${last.trim()}`.trim(), role })
      addMember({ first: first.trim(), last: last.trim() || undefined, email: email.trim(), phone: phone.trim() || undefined, role, clientId: role === 'client' ? client : undefined, ...(REAL.invite && role !== 'client' ? { invited: TODAY } : {}) })
      s.close()
    } catch (e: any) { setFailed(e?.message || 'Couldn’t send it') } finally { setBusy(false) }
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Add a person"
      sub="They get an email, pick a password, and see only what their login allows."
      footer={
        <>
          <Button variant="ghost" icon={<Eye />} onClick={() => s.setRole(role)}>See what a {short(role)} login sees</Button>
          {failed && <span className="text-[0.8125rem] font-medium text-bad-600">{failed}</span>}
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Mail />} disabled={!ok || busy} onClick={add}>{busy ? 'Sending…' : REAL.invite ? 'Send the invite' : 'Add them'}</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <Field label="First name"><TextInput data-autofocus value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
        <Field label="Last name"><TextInput value={last} onChange={(e) => setLast(e.target.value)} /></Field>
        <Field label="Email — they sign in with it"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
        <Field label="Phone (optional)"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      </div>
      <Field label="Login type" className="mt-5">
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          {LOGINS.filter((r) => r.key !== 'owner').map((r) => (
            <button key={r.key} onClick={() => setRole(r.key)} className={cn('rounded-xl border px-3.5 py-2.5 text-left transition', role === r.key ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-line hover:border-brand-200')}>
              <span className="block text-[0.875rem] font-semibold text-ink">{short(r.key)}</span>
              <span className="block text-[0.78125rem] leading-snug text-muted">{r.sees}</span>
            </button>
          ))}
        </div>
      </Field>
      {role === 'client' && (
        <Field label="Which company" className="mt-4">
          <div className="flex flex-wrap gap-2">
            {Object.values(CUSTOMERS).map((c) => <Chip key={c.id} on={client === c.id} onClick={() => setClient(c.id)} className="h-9">{c.name}</Chip>)}
          </div>
        </Field>
      )}
      {role === 'client' ? (
        <div className="mt-4 rounded-xl bg-wash px-3.5 py-3 text-[0.8125rem] text-ink-2">They’ll see only their company’s projects: progress, photos, what needs their OK, their invoices and the messages. Never costs, pay or team-only notes.</div>
      ) : (
      <div className="mt-4 rounded-xl bg-wash px-3.5 py-3">
        <div className="text-[0.78125rem] font-semibold text-muted">They’ll see</div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ACCESS_PAGES.filter((pg) => (s.access[role] || []).includes(pg.key)).map((pg) => <span key={pg.key} className="inline-flex h-7 items-center rounded-full bg-white px-2.5 text-[0.78125rem] font-semibold text-ink-2 ring-1 ring-line">{pg.label}</span>)}
        </div>
        <div className="mt-2 text-[0.75rem] text-muted">Change it any time under What each login sees.</div>
      </div>
      )}
      {failed && role !== 'client' && <InviteLinkBox email={email} name={`${first.trim()} ${last.trim()}`.trim()} role={role} phone={phone.trim() || undefined} first={first.trim()} ok={!!ok} onGot={() => { addMember({ first: first.trim(), last: last.trim() || undefined, email: email.trim(), phone: phone.trim() || undefined, role, invited: TODAY }); setFailed('') }} />}
    </Modal>
  )
}

/* ================= the getting-ready checklist: the steps every project goes through ================= */
function ChecklistTab() {
  const s = useStore()
  const steps = companySteps(s)
  const [label, setLabel] = React.useState('')
  const [owner, setOwner] = React.useState<PersonKey>('yakov')
  const [after, setAfter] = React.useState('rooms')
  const ownerOf = (o: PersonKey | 'matBy') => (o === 'matBy' ? (s.rules.matBy || 'yakov') : o)
  return (
    <div className="flex flex-col gap-4">
    <EstimateDefaults />
    <div className="grid grid-cols-[minmax(0,1fr)_21.25rem] items-start gap-4 max-xl:grid-cols-1">
      <Card pad={false} className="overflow-hidden">
        <CardHeader icon={<IconCircle tone="info" size={34}><ListChecks className="h-4 w-4" /></IconCircle>} title="Getting ready — every project" sub="The steps between the client’s yes and the crew’s first day, in order. Each one has an owner; when the steps before it are done, it lands on their Today." action={<Button size="sm" onClick={() => s.open({ t: 'whowhat' })}>Who does what</Button>} />
        <div className="border-t border-line-2">
          {steps.map((d, i) => (
            <div key={d.key} className="grid grid-cols-[1.75rem_minmax(0,1fr)_12.5rem_2.25rem] items-center gap-3 border-b border-line-2 px-5 py-2.5 last:border-0">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-wash-2 text-[0.71875rem] font-semibold tnum text-ink-2">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">{d.label}{!BUILT_IN.has(d.key) && <span className="ml-2 align-[0.0625rem] text-[0.71875rem] font-medium text-brand-600">yours</span>}</span>
                <span className="flex items-center gap-1 truncate text-[0.78125rem] text-muted">{d.after?.length ? <><CornerDownRight className="h-3 w-3" />After {d.after.map((k) => steps.find((x) => x.key === k)?.short.toLowerCase()).filter(Boolean).join(' and ')}</> : 'Starts the day it’s won'}{BUILT_IN.has(d.key) ? ' · checks itself off from what happens' : ' · its owner checks it off'}</span>
              </span>
              <Menu align="end" width={260} trigger={<button className="inline-flex h-9 min-w-0 items-center gap-2 rounded-[0.625rem] border border-line bg-white pl-1.5 pr-2.5 text-[0.8125rem] font-medium text-ink-2 hover:bg-wash"><Avatar who={ownerOf(d.owner)} size={22} /><span className="truncate">{d.owner === 'matBy' ? 'Whoever orders materials' : PEOPLE[d.owner]?.name}</span></button>}>
                <MenuLabel>Who has “{d.short}”</MenuLabel>
                {d.key === 'materials' && <MenuItem checked={d.owner === 'matBy'} onSelect={() => setCompanyStepOwner(d.key, 'matBy')} hint="Company rules → who orders our materials">Whoever orders materials</MenuItem>}
                {insidePeople(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={d.owner === p} hint={PEOPLE[p].roleLabel} onSelect={() => setCompanyStepOwner(d.key, p)}>{PEOPLE[p].name}</MenuItem>)}
              </Menu>
              {!BUILT_IN.has(d.key) ? <button aria-label={`Remove ${d.short}`} onClick={() => removeCompanyStep(d.key)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-bad-50 hover:text-bad-600"><Trash2 className="h-4 w-4" /></button> : <span />}
            </div>
          ))}
        </div>
      </Card>
      <Card pad={false}>
        <CardHeader title="Add a step" sub="It goes on every project that’s getting ready. For just one project, use Add a step inside the project." />
        <form className="flex flex-col gap-3 border-t border-line-2 px-5 py-4" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; addCompanyStep(label.trim(), owner, after); setLabel('') }}>
          <Field label="What has to be checked"><TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Drain locations confirmed with the plumber" /></Field>
          <Field label="Who does it">
            <div className="flex flex-wrap gap-1.5">{insidePeople(s).map((p) => <Chip key={p} on={owner === p} onClick={() => setOwner(p)} className="h-8 px-2.5 text-[0.8125rem]" icon={<Avatar who={p} size={18} />}>{PEOPLE[p].short}</Chip>)}</div>
          </Field>
          <Field label="It opens after">
            <div className="flex flex-wrap gap-1.5">{steps.map((d) => <Chip key={d.key} on={after === d.key} onClick={() => setAfter(d.key)} className="h-8 px-2.5 text-[0.8125rem]">{d.short}</Chip>)}</div>
          </Field>
          <Button type="submit" variant="primary" icon={<Plus />} disabled={!label.trim()}>Add to the checklist</Button>
        </form>
      </Card>
    </div>
    </div>
  )
}

/* ================= estimates: who does each step, and the areas a new estimate offers ================= */
function EstimateDefaults() {
  const s = useStore()
  const team = companyTeam(s)
  const areas = companyAreas(s)
  const own = s.rules.surfaces || []
  const [name, setName] = React.useState('')
  const [surf, setSurf] = React.useState('')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_21.25rem] items-start gap-4 max-xl:grid-cols-1">
      <Card pad={false} className="overflow-hidden">
        <CardHeader icon={<IconCircle tone="vio" size={34}><Layers className="h-4 w-4" /></IconCircle>} title="Estimates — the areas a new one offers" sub="Tap an area on a new estimate and it comes with these surfaces. Take one off, add your own, or add a whole new area." />
        <div className="border-t border-line-2">
          {areas.map((a) => (
            <div key={a.name} className="flex items-start gap-3 border-b border-line-2 px-5 py-2 last:border-0 max-sm:flex-col max-sm:gap-1.5 max-sm:px-4">
              <span className="w-[11.25rem] shrink-0 pt-1 text-[0.84375rem] font-semibold text-ink">{a.name}{a.custom && <span className="ml-2 align-[0.0625rem] text-[0.71875rem] font-medium text-brand-600">yours</span>}</span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {a.surfaces.map((k) => (
                  <span key={k} className="inline-flex h-7 items-center gap-1 rounded-full bg-wash-2 pl-2.5 pr-1 text-[0.78125rem] font-medium text-ink-2">
                    {surfaceOf(s, k).label}
                    <button aria-label={`Take ${surfaceOf(s, k).label} off ${a.name}`} onClick={() => setCompanyAreaSurfaces(a.name, a.surfaces.filter((x) => x !== k))} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-faint hover:bg-white hover:text-bad-600"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <SurfaceAdd have={a.surfaces} onAdd={(k) => setCompanyAreaSurfaces(a.name, [...a.surfaces, k])} />
              </span>
              <button aria-label={`Remove ${a.name}`} onClick={() => removeCompanyArea(a.name)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-bad-50 hover:text-bad-600 max-sm:hidden"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <form className="flex gap-2 border-t border-line-2 px-5 py-3 max-sm:px-4" onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; addCompanyArea(name.trim(), ['floor']); setName('') }}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="New area — e.g. Girls bathroom" className="max-w-[20rem]" />
          <Button type="submit" icon={<Plus />} disabled={!name.trim()}>Add area</Button>
        </form>
      </Card>
      <div className="flex flex-col gap-4">
        <Card pad={false}>
          <CardHeader title="Who does each estimate step" sub="New estimates start with these people. Change anyone on one estimate from inside it." />
          <div className="border-t border-line-2 px-5 py-4"><TeamSlots compact team={team} onChange={(k, p) => setCompanyTeam(k, p)} /></div>
        </Card>
        <Card pad={false}>
          <CardHeader title="Your own surfaces" sub="On the surface list everywhere — priced like the closest item, or at $0 for the estimator to price." />
          <div className="flex flex-wrap gap-1.5 border-t border-line-2 px-5 py-3">
            {own.map((x) => (
              <span key={x.key} className="inline-flex h-7 items-center gap-1 rounded-full bg-wash-2 pl-2.5 pr-1 text-[0.78125rem] font-medium text-ink-2">
                {x.label}
                <button aria-label={`Remove ${x.label}`} onClick={() => removeCompanySurface(x.key)} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-faint hover:bg-white hover:text-bad-600"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {!own.length && <span className="text-[0.8125rem] text-muted">None yet — the standard list covers floors, walls, niches, saddles, metals, waterproofing and more.</span>}
          </div>
          <form className="flex gap-2 border-t border-line-2 px-5 py-3" onSubmit={(e) => { e.preventDefault(); if (!surf.trim()) return; addCompanySurface(surf.trim()); setSurf('') }}>
            <TextInput value={surf} onChange={(e) => setSurf(e.target.value)} placeholder="e.g. Fireplace surround" />
            <Button type="submit" icon={<Plus />} disabled={!surf.trim()}>Add</Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

/* ================= the statuses: one set of words, every page ================= */
const DOT: Record<string, string> = { blue: '#2650cf', indigo: '#444ce7', violet: '#6938ef', green: '#079455', amber: '#dc6803', red: '#d92d20', rose: '#e31b54', teal: '#0e9384', slate: '#5a6372', orange: '#e04f16', cyan: '#088ab2' }
function StatusesTab() {
  return (
    <div className="grid grid-cols-2 gap-4 max-xl:grid-cols-1">
      {STATUS_BOOK.map((b) => (
        <Card key={b.page} pad={false} className="overflow-hidden">
          <div className="px-5 py-3.5 text-[0.9375rem] font-bold text-ink">{b.page}</div>
          <div className="border-t border-line-2">
            {b.items.map((it, i) => (
              <div key={it.label} className="flex items-start gap-3 border-b border-line-2 px-5 py-2.5 last:border-0">
                <span className="mt-[0.1875rem] inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[0.6875rem] font-bold text-white" style={{ background: DOT[it.color] }}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-semibold text-ink">{it.label}</span>
                  <span className="block text-[0.8125rem] leading-snug text-muted">{it.means}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

/* ================= what each login sees ================= */
function AccessTab() {
  const s = useStore()
  const cols = INSIDE
  return (
    <Card pad={false} className="overflow-hidden">
      <div className="px-6 py-4 max-sm:px-4">
        <div className="text-[1rem] font-bold text-ink">What each login sees</div>
        <div className="text-[0.84375rem] text-muted">Tick a page to give it to that login. It changes right away for everyone with that login.</div>
      </div>
      <div className="scroll-soft overflow-x-auto border-t border-line">
        <table className="w-full min-w-[53.75rem] border-collapse text-[0.84375rem]">
          <thead>
            <tr className="bg-wash">
              <th className="sticky left-0 z-[1] w-[11.875rem] bg-wash px-6 py-3 text-left text-[0.78125rem] font-semibold text-muted">Page</th>
              {cols.map((r) => {
                const n = s.team.filter((m) => m.role === r.key && m.status !== 'off').length
                return (
                  <th key={r.key} className="px-2 py-3 text-center align-bottom">
                    <span className="block text-[0.8125rem] font-bold text-ink">{short(r.key)}</span>
                    <span className="block text-[0.71875rem] font-medium text-muted">{n} {n === 1 ? 'person' : 'people'}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {ACCESS_PAGES.map((p, i) => (
              <React.Fragment key={p.key}>
                {p.group && p.group !== ACCESS_PAGES[i - 1]?.group && (
                  <tr><td colSpan={cols.length + 1} className="bg-white px-6 pb-1 pt-4 text-[0.75rem] font-semibold text-faint">{p.group}</td></tr>
                )}
                <tr className="border-t border-line-2">
                  <td className="sticky left-0 z-[1] bg-white px-6 py-2.5 font-medium text-ink">{p.label}</td>
                  {cols.map((r) => {
                    const on = (s.access[r.key] || []).includes(p.key)
                    const locked = r.key === 'owner'
                    return (
                      <td key={r.key} className="px-2 py-2 text-center">
                        <button
                          aria-label={`${short(r.key)} sees ${p.label}`}
                          aria-pressed={on || locked}
                          disabled={locked}
                          onClick={() => setAccess(r.key, p.key, !on)}
                          className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg border-2 transition', on || locked ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#d9d3c9] bg-white text-transparent hover:border-brand-400', locked && 'cursor-default opacity-60')}
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </button>
                      </td>
                    )
                  })}
                </tr>
              </React.Fragment>
            ))}
            <tr className="border-t border-line">
              <td className="sticky left-0 bg-white px-6 py-3 text-[0.78125rem] text-muted">Back to standard</td>
              {cols.map((r) => <td key={r.key} className="px-2 py-3 text-center">{r.key !== 'owner' && <button aria-label={`${short(r.key)} back to standard`} onClick={() => resetAccess(r.key)} className="text-brand-600 hover:text-brand-700"><RotateCcw className="mx-auto h-3.5 w-3.5" /></button>}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ================= company rules ================= */
function RulesTab() {
  const s = useStore()
  const r = s.rules
  const set = (fn: (x: typeof r) => void) => s.commit((st) => fn(st.rules), 'Company rule saved', { undo: false })
  return (
    <Card pad={false} className="max-w-[57.5rem]">
      <CardHeader icon={<IconCircle tone="info" size={34}><ShieldCheck className="h-4 w-4" /></IconCircle>} title="Company rules" sub="Change a rule once — every project follows it." />
      <div className="flex flex-col divide-y divide-line-2 border-t border-line-2">
        <Rule title="Who orders our materials" sub="Gets the calculated order when setup is done, sends it, and takes the deliveries.">
          <Segmented value={r.matBy === 'materials' ? 'office' : ((r.matBy || 'yakov') as string)} onChange={(v) => set((x) => (x.matBy = v as PersonKey))} items={[{ key: 'yakov', label: 'Site manager' }, { key: 'office', label: 'Office' }]} />
        </Rule>
        <Rule title="Deposit not received before the start" sub="What happens when a crew is booked and the deposit isn’t in.">
          <Segmented value={r.depositRule} onChange={(v) => set((x) => (x.depositRule = v))} items={[{ key: 'warn', label: 'Warn + remind' }, { key: 'block', label: 'Block the start' }]} />
        </Rule>
        <Rule title="Default deposit" sub="Filled in at award; can be changed per project.">
          <div className="flex gap-2">{[0, 10, 20, 30].map((d) => <Chip key={d} on={r.depositPct === d} onClick={() => set((x) => (x.depositPct = d))} className="h-9 px-3">{d ? d + '%' : 'None'}</Chip>)}</div>
        </Rule>
        <Rule title="Retainage" sub="Held on progress bills, released at closeout.">
          <div className="flex gap-2">{[0, 5, 10].map((d) => <Chip key={d} on={r.retainage === d} onClick={() => set((x) => (x.retainage = d))} className="h-9 px-3">{d}%</Chip>)}</div>
        </Rule>
        <Rule stack title="Waste on the quantity check" sub="Added to our takeoff before comparing with the store’s order.">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 max-sm:grid-cols-1">
            {(['floors', 'walls', 'mosaic', 'large'] as const).map((k) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <span className="text-[0.84375rem] capitalize text-ink-2">{k === 'large' ? 'Large format' : k}</span>
                <NumStepper value={r.waste[k]} onChange={(v) => set((x) => (x.waste[k] = v))} min={0} max={30} suffix="%" />
              </div>
            ))}
          </div>
        </Rule>
        <Rule title="Payment reminders" sub="Sent by themselves until an invoice is paid.">
          <NumStepper value={r.reminderDays} onChange={(v) => set((x) => (x.reminderDays = v))} min={1} max={14} suffix="days" />
        </Rule>
        <Rule title="The deposit comes off" sub={DEPOSIT_WAY[r.depositOff || 'first'].sub + '.'}>
          <Segmented value={r.depositOff || 'first'} onChange={(v) => set((x) => (x.depositOff = v as DepositWay))} items={(Object.keys(DEPOSIT_WAY) as DepositWay[]).map((k) => ({ key: k, label: DEPOSIT_WAY[k].label }))} />
        </Rule>
      </div>
    </Card>
  )
}

function NumbersTab() {
  const s = useStore()
  const r = s.rules
  return (
    <Card pad={false}>
      <CardHeader
        icon={<IconCircle tone="info" size={34}><Calculator className="h-4 w-4" /></IconCircle>}
        title="Material numbers"
        sub="What each material covers. Every project’s material list is worked out from these — set them to how your crews really work."
        action={<Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => s.commit((st) => { st.rules.mat = { ...MAT_RULES0 } }, 'Material numbers back to standard', { undo: false })}>Standard numbers</Button>}
      />
      <div className="grid grid-cols-2 gap-x-10 gap-y-5 border-t border-line-2 px-6 pb-6 pt-4 max-md:grid-cols-1 max-sm:px-4">
        {MAT_RULE_ROWS.map((g) => (
          <div key={g.group} className="min-w-0">
            <div className="mb-1 text-[0.75rem] font-semibold text-muted">{g.group}</div>
            {g.rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 border-b border-line-2 py-2.5 last:border-0">
                <div className="min-w-0">
                  <div className="text-[0.84375rem] font-medium leading-snug text-ink">{row.label}</div>
                  <div className="text-[0.75rem] text-muted">{row.unit}{r.mat[row.key] !== MAT_RULES0[row.key] ? ` · standard ${MAT_RULES0[row.key]}` : ''}</div>
                </div>
                <DecStepper value={r.mat[row.key]} step={row.step} min={row.min} max={row.max} onChange={(v) => s.commit((st) => { st.rules.mat[row.key] = v }, undefined, { undo: false })} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

function ConnectionsTab() {
  return (
    <Card pad={false}>
      <CardHeader icon={<IconCircle tone="info" size={34}><Plug className="h-4 w-4" /></IconCircle>} title="Connections" sub="Tile OS runs the operation; these keep the paperwork and conversations in one place." />
      <div className="grid grid-cols-3 gap-3 px-6 pb-6 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:px-4">
        {[
          { i: BookOpen, t: 'QuickBooks Online', d: 'Items, invoices, bills and payments. Tile OS creates them and reads back what’s paid.', on: !REAL.cloud },
          { i: Mail, t: 'Gmail', d: 'Estimates, POs and invoices go out from your address. Replies land on the right project.', on: false },
          { i: Calendar, t: 'Google Calendar', d: 'Meetings and walkthroughs show on everyone’s phone calendar.', on: false },
          { i: MessageCircle, t: 'Text / WhatsApp', d: 'Crews get their job and POs by text; site photos come back to the project.', on: false },
          { i: FolderOpen, t: 'Google Drive / Dropbox', d: 'Plans, spec books and finish schedules with their revisions.', on: false },
        ].map((c) => (
          <div key={c.t} className="flex flex-col rounded-2xl border border-line p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-wash-2 text-ink-2"><c.i className="h-5 w-5" /></span>
              <div className="text-[0.9375rem] font-semibold text-ink">{c.t}</div>
            </div>
            <div className="mt-3 flex-1 text-[0.84375rem] leading-snug text-muted">{c.d}</div>
            {c.on ? (
              <div className="mt-4 inline-flex items-center gap-1.5 text-[0.84375rem] font-semibold text-ok-600"><CheckCircle2 className="h-4 w-4" />Connected</div>
            ) : REAL.cloud ? (
              <div className="mt-4 text-[0.8125rem] font-semibold text-muted">{c.t === 'QuickBooks Online' ? 'Next up — it needs your QuickBooks sign-in once' : 'Coming later'}</div>
            ) : (
              <Button size="sm" className="mt-4 self-start" onClick={() => toast(`${c.t} connects in the real app`)}>Connect</Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function Rule({ title, sub, children, stack }: { title: string; sub: string; children: React.ReactNode; stack?: boolean }) {
  if (stack)
    return (
      <div className="px-6 py-4 max-sm:px-4">
        <div className="text-[0.90625rem] font-semibold text-ink">{title}</div>
        <div className="text-[0.8125rem] text-muted">{sub}</div>
        <div className="mt-3">{children}</div>
      </div>
    )
  return (
    <div className="flex items-center justify-between gap-6 px-6 py-4 max-md:flex-col max-md:items-start max-md:gap-3 max-sm:px-4">
      <div className="min-w-0">
        <div className="text-[0.90625rem] font-semibold text-ink">{title}</div>
        <div className="text-[0.8125rem] text-muted">{sub}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function DecStepper({ value, step, min, max, onChange }: { value: number; step: number; min: number; max: number; onChange: (n: number) => void }) {
  const r = (n: number) => Math.round(n * 100) / 100
  return (
    <div className="inline-flex h-9 shrink-0 items-center rounded-lg border border-line bg-white">
      <button aria-label="Less" className="h-full w-9 rounded-l-lg text-[1rem] text-ink-2 hover:bg-wash disabled:opacity-40" disabled={value <= min} onClick={() => onChange(Math.max(min, r(value - step)))}>−</button>
      <span className="min-w-[3rem] text-center text-[0.875rem] font-semibold tnum text-ink">{r(value)}</span>
      <button aria-label="More" className="h-full w-9 rounded-r-lg text-[1rem] text-ink-2 hover:bg-wash disabled:opacity-40" disabled={value >= max} onClick={() => onChange(Math.min(max, r(value + step)))}>+</button>
    </div>
  )
}

/** the real app: see the whole app full of sample projects — every page with something on it — then come back */
/** the real app, the admin: everything out, to start the company's data over (the team, items and settings stay) */
function StartOverCard() {
  const s = useStore()
  const n = Object.keys(s.jobs).length + s.estimates.length + Object.keys(s.clients).length
  return (
    <Card>
      <div className="flex items-start gap-4">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wash-2 text-ink-2"><Trash2 className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-semibold text-ink">Start over</div>
          <div className="mt-0.5 text-[0.84375rem] leading-snug text-muted">Delete every project, estimate, client and task — {n ? `${n} in all right now` : 'nothing here yet'}. Your team, logins, items, checklists and settings stay. One project, estimate or client at a time: open it and use its ··· menu.</div>
          <Button className="mt-4" variant="danger" icon={<Trash2 />} disabled={!n} onClick={() => s.open({ t: 'delete', kind: 'all' })}>Start over…</Button>
        </div>
      </div>
    </Card>
  )
}

function SampleLookCard() {
  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center gap-4 px-6 py-5 max-sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-semibold text-ink">See it full of sample projects</div>
          <div className="text-[0.84375rem] text-muted">Every page with something on it — 13 projects, estimates, orders, pay, billing. A look around; nothing you do there is saved, and your own data isn’t touched.</div>
        </div>
        <Button variant="primary" onClick={lookAtSample}>Look at the sample</Button>
      </div>
    </Card>
  )
}
