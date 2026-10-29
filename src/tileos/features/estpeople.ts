/* Who does each step of an estimate — real people, one or more on a step. With two on a step it's on both their
 * Todays and either one hands it on. The company sets them once (Settings → Who does what); one estimate can change
 * its own. A login spot nobody has taken ("Estimator") is never shown as a person: it goes to whoever has that kind
 * of login. The company can add its own steps after the takeoff or the office review — they go in order like the rest:
 * when the step before is done, it lands on its people's Today. */
import { useStore, meOf, type Store } from '@/tileos/store'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { EST_TEAM0, bucketOf, type Estimate } from '@/tileos/data/estimates'
import { realOwner } from './steps'

export interface EstStepDef { key: string; label: string; what: string; custom?: boolean; after?: string }
export const EST_BUILT: EstStepDef[] = [
  { key: 'takeoff', label: 'Takeoff', what: 'From the plans — every room, wall and floor, measured and priced' },
  { key: 'review', label: 'Office review', what: 'Checks the takeoff — fixes it, or sends it back with notes' },
  { key: 'final', label: 'Final review', what: 'The last look — approve it and it goes to the client' },
]
export const EST_FOLLOW: EstStepDef = { key: 'follow', label: 'Follows up', what: 'After it goes out — calls or emails the client until they answer' }
const BUILT_KEYS = ['takeoff', 'review', 'final', 'follow']
export const isBuiltStep = (k: string) => BUILT_KEYS.includes(k)

/** the steps inside the company, in order: takeoff, office review, the company's own (each after the step it follows),
 *  final review. The final review always comes last — it sends the estimate. */
export function estSteps(s: Pick<Store, 'rules'>): EstStepDef[] {
  const out = [...EST_BUILT]
  for (const c of s.rules.estSteps || []) {
    if (c.off) continue
    const after = c.after && c.after !== 'final' && out.some((x) => x.key === c.after) ? c.after : 'review'
    let at = out.findIndex((x) => x.key === after) + 1
    /* added after the same step as one before it: it goes after that one */
    while (out[at]?.custom) at++
    out.splice(at, 0, { key: c.key, label: c.label, what: c.what || 'One of your own steps', custom: true, after })
  }
  return out
}
/** a step's name: "Office review", "Check supplier prices" — "Follows up" once it's sent */
export function stepLabel(s: Pick<Store, 'rules'>, key?: string): string {
  if (!key) return ''
  if (key === 'follow') return EST_FOLLOW.label
  return estSteps(s).find((x) => x.key === key)?.label || (s.rules.estSteps || []).find((x) => x.key === key)?.label || 'A step'
}
/** the step after this one — none after the final review (it goes to the client). A step the company has since
 *  taken away goes on to the final review. */
export function stepAfter(s: Pick<Store, 'rules'>, key: string): string | undefined {
  const list = estSteps(s)
  const i = list.findIndex((x) => x.key === key)
  if (i < 0) return key === 'final' ? undefined : 'final'
  return list[i + 1]?.key
}
/** the inside steps, numbered — for the path on the estimate */
export const stepIndex = (s: Pick<Store, 'rules'>, key?: string) => estSteps(s).findIndex((x) => x.key === key)

/* ---------------- who ---------------- */
/** the company's people for a step (Settings → Who does what) — the first one leads */
export function companyPeople(s: Pick<Store, 'rules'>, key: string): PersonKey[] {
  const list = (s.rules.estPeople?.[key] || []).filter(Boolean)
  if (list.length) return list
  if (BUILT_KEYS.includes(key)) return [({ ...EST_TEAM0, ...(s.rules.estTeam || {}) } as Record<string, PersonKey>)[key]]
  return [meOf('owner')]
}
/** the estimate's own people for a step, else the company's */
function rawPeople(s: Pick<Store, 'rules'>, e: Estimate, key: string): PersonKey[] {
  const own = (e.people?.[key] || []).filter(Boolean)
  if (own.length) return own
  const one = (e.team as Record<string, PersonKey> | undefined)?.[key]
  if (one) return [one]
  if (key === 'takeoff' && e.estimator && e.estimator !== 'estimator') return [e.estimator]
  return companyPeople(s, key)
}
/** the real people on a step. A spot nobody took goes to whoever has that kind of login — and someone already doing
 *  the takeoff on this estimate is passed over when there's someone else. */
export function peopleOn(s: Pick<Store, 'rules' | 'team'>, e: Estimate | null | undefined, key: string): PersonKey[] {
  const raw = e ? rawPeople(s, e, key) : companyPeople(s, key)
  const avoid = key === 'takeoff' || key === 'follow' ? [] : (e ? rawPeople(s, e, 'takeoff') : companyPeople(s, 'takeoff')).map((k) => realOwner(s, k))
  const out: PersonKey[] = []
  for (const k of raw) {
    const r = realOwner(s, k, avoid)
    if (r && !out.includes(r)) out.push(r)
  }
  return out
}
/** whose turn it is: the people on the step it's on; with the client, who follows up; a new request, the office */
export function turnOn(s: Pick<Store, 'rules' | 'team'>, e: Estimate): PersonKey[] {
  const b = bucketOf(e)
  if (b === 'request') return [realOwner(s, 'office')]
  if (b === 'sent') return peopleOn(s, e, 'follow')
  if (b === 'approved' || b === 'lost') return []
  return peopleOn(s, e, b)
}
/** "Mordcha" · "Yanky and David" · "You and David" — first names */
export function namesOf(list: PersonKey[], me?: PersonKey | null, full = false): string {
  const n = list.map((k) => (k === me ? 'You' : (full ? PEOPLE[k]?.name : PEOPLE[k]?.short) || k))
  return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}
/** the logins that see a step's task on their Today: each person's own */
export function rolesOf(s: Pick<Store, 'team'>, list: PersonKey[]): Role[] {
  const ROLE_OF: Partial<Record<PersonKey, Role>> = { ys: 'owner', takeoff: 'takeoff', estimator: 'estimator', office: 'office' }
  return Array.from(new Set(list.map((k) => (s.team.find((m) => m.key === k)?.role as Role) || ROLE_OF[k] || 'office')))
}

/* ---------------- setting them ---------------- */
const S = () => useStore.getState()
/** the company's people for a step — every new estimate follows it */
export function setCompanyPeople(key: string, list: PersonKey[]) {
  const clean = Array.from(new Set(list.filter(Boolean)))
  if (!clean.length) return
  S().commit((st) => {
    st.rules.estPeople = { ...(st.rules.estPeople || {}), [key]: clean }
    /* the standard steps keep their one lead in the old place too — older screens read it */
    if (BUILT_KEYS.includes(key)) st.rules.estTeam = { ...EST_TEAM0, ...(st.rules.estTeam || {}), [key]: clean[0] }
  }, `${stepLabel(S(), key)}: ${namesOf(clean, null, true)}`)
}
/** add one of the company's own estimate steps, after the step it follows */
export function addCompanyEstStep(label: string, after: string, people: PersonKey[], what?: string) {
  const key = 'x' + Date.now().toString(36)
  S().commit((st) => {
    st.rules.estSteps = [...(st.rules.estSteps || []), { key, label: label.trim(), after, what: what?.trim() || undefined }]
    st.rules.estPeople = { ...(st.rules.estPeople || {}), [key]: people.length ? people : [meOf('owner')] }
  }, `“${label.trim()}” added to the estimate steps`, { sub: 'Every estimate goes through it from now on, after the step before it.' })
  return key
}
export function renameCompanyEstStep(key: string, label: string) {
  S().commit((st) => { st.rules.estSteps = (st.rules.estSteps || []).map((x) => (x.key === key ? { ...x, label: label.trim() } : x)) }, 'Renamed')
}
/** take one of the company's own steps away — an estimate on it now goes on to the next step when it's handed on */
export function removeCompanyEstStep(key: string) {
  const def = (S().rules.estSteps || []).find((x) => x.key === key)
  S().commit((st) => {
    st.rules.estSteps = (st.rules.estSteps || []).filter((x) => x.key !== key)
    if (st.rules.estPeople) { const { [key]: _, ...rest } = st.rules.estPeople; st.rules.estPeople = rest }
  }, `“${def?.label || 'The step'}” taken off the estimate steps`)
}
/** one estimate's people on a step (only this one) */
export function setEstimatePeople(estId: string, key: string, list: PersonKey[]) {
  const clean = Array.from(new Set(list.filter(Boolean)))
  if (!clean.length) return
  S().commit((st) => {
    const e = st.estimates.find((x) => x.id === estId)
    if (!e) return
    e.people = { ...(e.people || {}), [key]: clean }
    if (BUILT_KEYS.includes(key)) e.team = { ...(e.team || {}), [key]: clean[0] }
    /* the step it's on right now: its task is theirs now */
    if ((e.status === 'estimating' || e.status === 'revision') && (e.step || 'takeoff') === key) {
      st.tasks.forEach((t) => {
        if (t.action?.kind !== 'estimate:' + e.id || t.state === 'done') return
        t.owner = clean[0]
        t.also = clean.length > 1 ? clean.slice(1) : undefined
        t.for = rolesOf(st, clean)
      })
    }
    if (e.status === 'sent' && key === 'follow') {
      st.tasks.forEach((t) => {
        if (t.action?.kind !== 'estimate:' + e.id || t.state === 'done' || !/^Follow up/.test(t.title)) return
        t.owner = clean[0]
        t.also = clean.length > 1 ? clean.slice(1) : undefined
        t.for = rolesOf(st, clean)
      })
    }
  }, `${stepLabel(S(), key)}: ${namesOf(clean, null, true)}`)
}
