/* One person, two places on the team — the same sign-in or the same email. It happens when someone is let in and their
 * own phone signs in a moment before that reaches it, or when they're added a second time. The two become one:
 *   which one stays: a built-in place (the site manager's, the admin's) first, then the one that signs in, then the
 *     first on the list;
 *   it takes what the other had that it didn't (the sign-in, an email, a phone, their full name);
 *   everything that was the other's — tasks, steps, projects, meetings, history — is now this one's.
 * Installers aren't touched (a crew can share an office email). Two built-in places with one email both stay. */
import { DATA_KEYS, type Data } from '@/tileos/store'
import { TEAM0, type Member, type Reach } from '@/tileos/data/model'

const BUILT = new Set<string>(TEAM0.map((m) => m.key))
const mailOf = (m: { email?: string }) => (m.email || '').trim().toLowerCase()

export type Twins = { keep: string; drop: string[] }

/** the team's twins: each group of places that are one person, and the one that stays */
export function twinsOf(team: Member[] | undefined): Twins[] {
  const list = (team || []).filter((m) => m && m.role !== 'crew')
  const up = list.map((_, i) => i)
  const root = (i: number): number => (up[i] === i ? i : (up[i] = root(up[i])))
  const join = (a: number, b: number) => { const x = root(a), y = root(b); if (x !== y) up[Math.max(x, y)] = Math.min(x, y) }
  const byUid = new Map<string, number>()
  const byMail = new Map<string, number>()
  list.forEach((m, i) => {
    if (m.uid) { const j = byUid.get(m.uid); if (j != null) join(i, j); else byUid.set(m.uid, i) }
    const e = mailOf(m)
    if (e) { const j = byMail.get(e); if (j != null) join(i, j); else byMail.set(e, i) }
  })
  const groups = new Map<number, Member[]>()
  list.forEach((m, i) => { const r = root(i); groups.set(r, [...(groups.get(r) || []), m]) })
  const out: Twins[] = []
  for (const ms of groups.values()) {
    if (ms.length < 2) continue
    const keep = ms.find((m) => BUILT.has(m.key)) || ms.find((m) => m.uid) || ms[0]
    /* a built-in place is never folded away — its key is also a login type's name ("office") */
    const drop = ms.filter((m) => m !== keep && !BUILT.has(m.key)).map((m) => m.key)
    if (drop.length) out.push({ keep: keep.key, drop })
  }
  return out
}

/** the one that stays, with what the other had and it didn't */
function joined(k: Member, d: Member): Member {
  const more: Reach[] = [...(k.more || [])]
  const has = (r: Reach) => more.some((x) => x.kind === r.kind && x.value.trim().toLowerCase() === r.value.trim().toLowerCase())
  const add = (r: Reach) => { if (r.value?.trim() && !has(r)) more.push(r) }
  ;(d.more || []).forEach(add)
  if (d.phone && k.phone && d.phone !== k.phone) add({ kind: 'phone', value: d.phone })
  if (d.email && k.email && mailOf(d) !== mailOf(k)) add({ kind: 'email', value: d.email })
  /* a place still called for its job ("Yakov", "Back office") takes the person's full name */
  const name = !k.last && d.last ? { first: d.first, last: d.last } : {}
  return {
    ...k,
    ...name,
    email: k.email || d.email,
    phone: k.phone || d.phone,
    uid: k.uid || d.uid,
    invited: k.invited || d.invited,
    clientId: k.clientId || d.clientId,
    status: k.status === 'active' || d.status === 'active' ? 'active' : k.status,
    ...(more.length ? { more } : {}),
  }
}

/* every mention of a folded-away place → the one that stays: a value that is its key, or a key that is (two lists of
   the same thing are put together). Only what changes is copied — the rest stays as it is. */
function swap(v: any, to: Map<string, string>): any {
  if (typeof v === 'string') return to.get(v) ?? v
  if (Array.isArray(v)) {
    let out: any[] | null = null
    for (let i = 0; i < v.length; i++) { const y = swap(v[i], to); if (y !== v[i]) (out ||= v.slice())[i] = y }
    if (!out) return v
    /* a list of people with both in it: once */
    return out.every((x) => typeof x === 'string') ? Array.from(new Set(out)) : out
  }
  if (v && typeof v === 'object') {
    let out: any = null
    for (const key of Object.keys(v)) {
      const x = v[key]
      const y = swap(x, to)
      const nk = to.get(key)
      if (nk) {
        out ||= { ...v }
        delete out[key]
        const there = nk in out ? out[nk] : undefined
        out[nk] = there === undefined ? y : both(there, y)
      } else if (y !== x) (out ||= { ...v })[key] = y
    }
    return out || v
  }
  return v
}
/** the same thing kept for both: lists put together, the one that stays winning on anything else */
function both(a: any, b: any): any {
  if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b.filter((x) => !a.includes(x))]
  if (a && b && typeof a === 'object' && typeof b === 'object') return { ...b, ...a }
  return a
}

/** the real app: the site manager's built-in place ("Yakov", from the clean start) that nobody ever took — when the
 *  company has its own site manager, everything still pointing at the place is theirs. The one on the admin's email
 *  domain first (a test login on another email isn't the company's site manager), else the first on the list. */
export function siteSpotHolder(team: (Partial<Member> & Pick<Member, 'key' | 'role'>)[] | undefined): string | null {
  const list = team || []
  const spot = list.find((m) => m.key === 'yakov')
  const untaken = !spot || (!spot.uid && !spot.email && !spot.last && (spot.first || '').trim() === 'Yakov')
  if (!untaken) return null
  const real = list.filter((m) => m.key !== 'yakov' && m.role === 'site' && m.status !== 'off' && (m.uid || m.email))
  if (!real.length) return null
  const admin = list.find((m) => m.role === 'owner' && m.email)
  const domain = (admin?.email || '').split('@')[1]?.trim().toLowerCase()
  return ((domain && real.find((m) => mailOf(m).endsWith('@' + domain))) || real[0]).key
}

/** the data with each person in one place (null when nobody is in two) — and, with `site`, the untaken site manager's
 *  place folded into that person */
export function mergeTwins(d: Data, twins = twinsOf(d.team), site?: string | null): Data | null {
  if (!twins.length && !site) return null
  const to = new Map<string, string>()
  twins.forEach((t) => t.drop.forEach((k) => to.set(k, t.keep)))
  if (site) to.set('yakov', to.get(site) || site)
  const team = (d.team || []).filter((m) => !to.has(m.key)).map((m) => {
    const g = twins.find((t) => t.keep === m.key)
    if (!g) return m
    return g.drop.map((k) => (d.team || []).find((x) => x.key === k)!).filter(Boolean).reduce(joined, m)
  })
  const out: any = { ...d, team }
  let changed = team.length !== (d.team || []).length || team.some((m, i) => m !== (d.team || [])[i])
  for (const k of DATA_KEYS) {
    if (k === 'team' || k === 'access') continue
    const v = (d as any)[k]
    if (v === undefined) continue
    const y = swap(v, to)
    if (y !== v) { out[k] = y; changed = true }
  }
  return changed ? (out as Data) : null
}

/** the real app's loaded data, each person in one place: what changed, and who became whom (null: nothing to do) */
export function oneEach(d: Data): { data: Data; to: Map<string, string> } | null {
  const twins = twinsOf(d.team)
  const site = siteSpotHolder(d.team)
  const data = mergeTwins(d, twins, site)
  if (!data) return null
  const to = new Map<string, string>()
  twins.forEach((t) => t.drop.forEach((k) => to.set(k, t.keep)))
  if (site) to.set('yakov', to.get(site) || site)
  return { data, to }
}
