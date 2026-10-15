/* The admin's controls: who signs in, what they're called, and what each login sees. */
import { useStore } from '@/tileos/store'
import { PEOPLE, ROLES, type Member, type PersonKey, type Role } from '@/tileos/data/model'

const S = () => useStore.getState()
const roleName = (r: Role) => ROLES.find((x) => x.key === r)?.label.split(' · ')[0] || r

export function addMember(m: Omit<Member, 'key' | 'status'>) {
  const key = ('u' + Date.now().toString(36)) as PersonKey
  S().commit(
    (s) => {
      s.team.push({ ...m, key, status: 'invited' })
    },
    `${[m.first, m.last].filter(Boolean).join(' ')} is invited`,
    { undo: false, sub: `${m.email ? `An email goes to ${m.email}. ` : ''}They pick a password and land on their Today as ${roleName(m.role)}.` },
  )
  return key
}
export function updateMember(key: PersonKey, patch: Partial<Member>, msg = 'Saved') {
  S().commit((s) => {
    const m = s.team.find((x) => x.key === key)
    if (m) Object.assign(m, patch)
  }, msg, { undo: false })
}
export function setAccess(role: Role, page: string, on: boolean) {
  S().commit((s) => {
    const cur = s.access[role] || []
    s.access[role] = on ? Array.from(new Set([...cur, page])) : cur.filter((p) => p !== page)
  })
}
export function resetAccess(role: Role) {
  const def = ROLES.find((r) => r.key === role)
  if (!def) return
  S().commit((s) => {
    s.access[role] = [...def.nav]
  }, `${roleName(role)} back to the standard pages`, { undo: false })
}
export const memberName = (key: PersonKey) => PEOPLE[key]?.name || 'Someone'

/** take someone off the team — their login stops working; what they did stays in the history */
export function removeMember(key: PersonKey) {
  const name = PEOPLE[key]?.name || 'They'
  S().commit((s) => {
    s.team = s.team.filter((m) => m.key !== key)
    s.tasks.filter((t) => t.owner === key && t.state !== 'done').forEach((t) => (t.owner = 'ys'))
  }, `${name} removed`, { sub: 'Their login stops working. Their open tasks came back to you; everything they did stays in the history.' })
}
