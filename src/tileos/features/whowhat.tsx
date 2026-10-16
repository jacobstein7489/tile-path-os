/* Who does what — every hand-off in one place: the estimate's steps, and every step of getting a project ready.
 * Set once; every new estimate and every project follows it (each one can still be changed on its own, from its step).
 * The first time the admin opens the real app it asks, already filled in the way he described the company works. */
import * as React from 'react'
import { ChevronDown, Sparkles, Check } from 'lucide-react'
import { useStore, meOf, NOW, type Store } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { REAL } from '@/tileos/lib/save'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { teamOf, type EstTeam } from '@/tileos/data/estimates'
import { companyTeam, TEAM_KEYS } from './estflow'
import { companySteps, setCompanyOwners, PHASES } from './steps'
import { insidePeople } from './steps-ui'
import { matBy } from './flows'

type Owners = Record<string, PersonKey | 'matBy'>
const TEAM_WORDS: Record<keyof EstTeam, string> = { takeoff: 'Takeoff — from the plans', review: 'Office review — checks it, makes changes', final: 'Final review — and sends it out', follow: 'Follows up with the client' }

const byName = (s: Store, re: RegExp) => s.team.find((m) => m.status !== 'off' && re.test(`${m.first || ''} ${m.last || ''}`))?.key as PersonKey | undefined
/** filled in the way Jacob described it (Oct 15): Malisa does the takeoffs and enters the tile paperwork; Mordechai
 *  reviews the estimates and gets the paperwork from the store; the owner does the final review and sends it, picks the
 *  installer and gets his yes; the site manager checks the site, decides the setup, orders our materials and takes the
 *  deliveries. Only people who are on the team are used — anyone not there keeps what it was. */
/** 3 = the steps nobody had said (Oct 15, "you decide"): the design meeting, the estimate check after it, grout and
 *  pictures, layouts, the tile delivery date, showing the installer the job, the deposit */
export const WHO_V = 3
const REST: Record<string, string> = { design: 'office', change: 'office', tile: 'estimator', layouts: 'office', order: 'office', walk: 'yakov', deposit: 'accounting' }
/** the rest, decided: the office reviewer runs the store and the meeting side (he gets the paperwork, so he gets the
 *  delivery date; he sets the design meeting — the boss and the site manager get it on their calendar — and the grout,
 *  pictures and layouts come out of that meeting); the boss checks the estimate after the meeting (he's in it and sends
 *  the estimate); the site manager shows the installer the job; the deposit goes to whoever does the books, or the boss */
function rest(s: Store, team: EstTeam, owners: Owners, filled: Set<string>, onlyDefaults: boolean) {
  const here = (k?: string) => (k && s.team.some((m) => m.key === k && m.status !== 'off') ? (k as PersonKey) : undefined)
  const site = s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key as PersonKey | undefined
  const books = s.team.find((m) => m.role === 'accounting' && m.status !== 'off')?.key as PersonKey | undefined
  const boss = here(team.final) || (REAL.me && here(REAL.me)) || undefined
  const pick: Record<string, PersonKey | undefined> = {
    design: here(team.review), tile: here(team.review), layouts: here(team.review), order: here(owners.getpaper as string) || here(team.review),
    change: boss, walk: site, deposit: books || boss,
  }
  Object.entries(pick).forEach(([k, who]) => {
    if (!who || owners[k] === undefined || owners[k] === who) return
    if (onlyDefaults && owners[k] !== REST[k]) return
    owners[k] = who
    filled.add(k)
  })
}
function suggest(s: Store): { team: EstTeam; owners: Owners; filled: Set<string> } {
  const team = companyTeam(s)
  const owners: Owners = Object.fromEntries(companySteps(s).map((d) => [d.key, d.owner]))
  const filled = new Set<string>()
  if (s.rules.whoSet) {
    if ((s.rules.whoV || 0) < WHO_V) rest(s, team, owners, filled, true)
    return { team, owners, filled }
  }
  const set = (k: string, who?: PersonKey | 'matBy') => { if (!who || owners[k] === who) return; owners[k] = who; filled.add(k) }
  const setT = (k: keyof EstTeam, who?: PersonKey) => { if (!who || team[k] === who) return; team[k] = who; filled.add('est:' + k) }
  const takeoff = byName(s, /\b(malisa|melissa|malissa)\b/i)
  const review = byName(s, /\bmord/i)
  const site = s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key as PersonKey | undefined
  const boss = (REAL.me && s.team.some((m) => m.key === REAL.me) ? REAL.me : meOf('owner')) as PersonKey
  setT('takeoff', takeoff)
  setT('review', review)
  setT('final', boss)
  set('getpaper', review)
  set('rooms', takeoff)
  set('qty', takeoff)
  set('installer', boss)
  set('confirmed', boss)
  set('heights', site)
  set('setup', site)
  set('delivered', site)
  set('materials', 'matBy')
  set('matin', 'matBy')
  rest(s, team, owners, filled, false)
  return { team, owners, filled }
}

/** save it: the company's people, and the estimates already in progress that still had the old person */
export function saveWhoWhat(team: EstTeam, owners: Owners, alsoOpen: boolean) {
  const s = useStore.getState()
  s.commit((st) => {
    const old = companyTeam(st)
    st.rules.estTeam = { ...team }
    setCompanyOwners(st, owners)
    st.rules.whoSet = NOW
    st.rules.whoV = WHO_V
    if (!alsoOpen) return
    st.estimates.forEach((e) => {
      if (e.status !== 'estimating' && e.status !== 'revision' && e.status !== 'request') return
      const t = teamOf(e)
      TEAM_KEYS.forEach((k) => {
        if (t[k] !== old[k] || team[k] === old[k]) return
        e.team = { ...(e.team || {}), [k]: team[k] }
        /* the step it's on right now: its task goes to the new person */
        if ((e.step || 'takeoff') === k && e.status !== 'request') {
          const role = (st.team.find((m) => m.key === team[k])?.role || 'estimator') as Role
          st.tasks.forEach((x) => { if (x.action?.kind === 'estimate:' + e.id && x.state === 'now') { x.owner = team[k]; x.for = [role] } })
        }
      })
    })
  }, 'Who does what — saved', { sub: 'Every new estimate and every project follows it. Each one can still be changed on its own.', close: true })
}

export function WhoWhatModal({ level, first }: { level: number; first?: boolean }) {
  const s = useStore()
  const start = React.useMemo(() => suggest(s), [])
  const [team, setTeam] = React.useState<EstTeam>(start.team)
  const [owners, setOwners] = React.useState<Owners>(start.owners)
  const [also, setAlso] = React.useState(true)
  const people = insidePeople(s)
  const defs = companySteps(s)
  const pick = (cur: PersonKey | 'matBy', on: (p: PersonKey | 'matBy') => void, label: string, k: string, withMatBy?: boolean) => {
    const shown = cur === 'matBy' ? matBy(s) : cur
    return (
      <Menu align="end" width={290} trigger={
        <button aria-label={`${label} — ${PEOPLE[shown]?.name || 'nobody'}`} className={cn('inline-flex h-9 min-w-[12.5rem] items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-3 text-[0.84375rem] font-semibold text-ink transition hover:border-[#cdc7bc] max-sm:min-w-0', start.filled.has(k) ? 'border-brand-300' : 'border-line')}>
          <Avatar who={shown} size={26} /><span className="min-w-0 flex-1 truncate text-left">{PEOPLE[shown]?.name || 'Pick someone'}{cur === 'matBy' ? <span className="font-normal text-muted"> · whoever orders</span> : null}</span>
          {start.filled.has(k) && <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-500" />}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" />
        </button>
      }>
        <MenuLabel>{label}</MenuLabel>
        {withMatBy && <MenuItem checked={cur === 'matBy'} hint="Settings → company rules" onSelect={() => on('matBy')}>Whoever orders our materials</MenuItem>}
        {people.map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={cur === p} hint={PEOPLE[p]?.roleLabel} onSelect={() => on(p)}>{PEOPLE[p]?.name}</MenuItem>)}
      </Menu>
    )
  }
  const row = (label: string, sub: string | undefined, control: React.ReactNode, key: string) => (
    <div key={key} className="flex items-center gap-3 border-t border-line-2 px-4 py-2 first:border-t-0 max-sm:flex-wrap">
      <span className="min-w-0 flex-1"><span className="block text-[0.875rem] font-semibold text-ink">{label}</span>{sub && <span className="block text-[0.75rem] text-muted">{sub}</span>}</span>
      {control}
    </div>
  )
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="Who does what"
      sub={first && s.rules.whoSet ? 'The steps nobody had yet — I filled them in (the ones with a ✨). Check it and save.' : first ? 'Filled in the way you described it — check it and save. Change any of it later in Settings.' : 'Every new estimate and every project follows this. One project can still be changed from its own step.'}
      footer={
        <>
          <label className="inline-flex cursor-pointer items-center gap-2 text-[0.84375rem] text-ink-2"><input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} className="h-4 w-4 accent-[#2650cf]" />Also on the estimates in progress</label>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>{first ? 'Later' : 'Cancel'}</Button>
          <Button variant="primary" icon={<Check />} onClick={() => saveWhoWhat(team, owners, also)}>Save</Button>
        </>
      }
    >
      {start.filled.size > 0 && <div className="mb-4 flex items-start gap-2 rounded-xl bg-brand-50/70 px-4 py-3 text-[0.84375rem] text-brand-800"><Sparkles className="mt-0.5 h-4 w-4 shrink-0" /><span>{s.rules.whoSet
        ? <>The ones with a <Sparkles className="inline h-3.5 w-3.5 align-[-0.125rem]" /> had nobody. The office reviewer sets the design meeting (you and the site manager get it on your calendar) and handles what comes out of it and the store; you check the estimate after the meeting; the site manager shows the installer the job; the deposit goes to whoever does the books. Nothing changes until you save.</>
        : <>The ones with a <Sparkles className="inline h-3.5 w-3.5 align-[-0.125rem]" /> are filled in from how you said it works. Nothing changes until you save.</>}</span></div>}
      <section className="overflow-hidden rounded-xl border border-line">
        <header className="border-b border-line-2 bg-[#faf8f5] px-4 py-2 text-[0.8125rem] font-bold text-ink">Estimates</header>
        {TEAM_KEYS.map((k) => row(TEAM_WORDS[k].split(' — ')[0], TEAM_WORDS[k].split(' — ')[1], pick(team[k], (p) => setTeam({ ...team, [k]: p as PersonKey }), TEAM_WORDS[k], 'est:' + k), 'est' + k))}
      </section>
      {PHASES.map((ph) => {
        const items = defs.filter((d) => (d.phase || 'own') === ph.key)
        if (!items.length) return null
        return (
          <section key={ph.key} className="mt-3 overflow-hidden rounded-xl border border-line">
            <header className="border-b border-line-2 bg-[#faf8f5] px-4 py-2 text-[0.8125rem] font-bold text-ink">{ph.key === 'paper' ? 'Getting a project ready · ' : ''}{ph.label}</header>
            {items.map((d) => row(d.label, undefined, pick(owners[d.key] || d.owner, (p) => setOwners({ ...owners, [d.key]: p }), d.label, d.key, d.key === 'materials' || d.key === 'matin'), d.key))}
          </section>
        )
      })}
    </Modal>
  )
}

/** the first time the admin opens the real app after this came in: ask once */
export function WhoWatcher() {
  React.useEffect(() => {
    const s = useStore.getState()
    const settled = (st: Store) => !!st.rules.whoSet && ((st.rules.whoV || 0) >= WHO_V || suggest(st).filled.size === 0)
    if (!REAL.cloud || !REAL.admin || settled(s)) return
    const asked = () => { try { return !!sessionStorage.getItem('tileos-who-asked') } catch { return false } }
    if (asked()) return
    /* once the screen is free (nothing else open), and only once this visit */
    const t = setInterval(() => {
      const st = useStore.getState()
      if (settled(st) || asked()) { clearInterval(t); return }
      if (st.modals.length) return
      clearInterval(t)
      try { sessionStorage.setItem('tileos-who-asked', '1') } catch { /* private window */ }
      st.open({ t: 'whowhat', first: true })
    }, 900)
    return () => clearInterval(t)
  }, [])
  return null
}
