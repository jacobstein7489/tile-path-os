/* One person does it — or two, whoever gets to it first; everyone who needs to can see it.
 *   owner     — the one person whose job it is (always exactly one)
 *   also      — others who can do it too: on their Today as well; whoever does it first closes it for all
 *   followers — it waits under their "Waiting on others" until it's done, and they're told when it moves (only who
 *               asked to follow it — the one who asked for it or handed it over follows it by itself) 
 *   everyone  — pinned to the top of every login's Today until it's done */
import { useStore, NOW, meOf } from '@/tileos/store'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'

const S = () => useStore.getState()
const ROLE_PERSON: Partial<Record<Role, PersonKey>> = { owner: 'ys', pm: 'ys', site: 'yakov', office: 'office', estimator: 'estimator', takeoff: 'takeoff', materials: 'materials', accounting: 'accounting' }
export const followersOf = (t: Task): PersonKey[] => Array.from(new Set(t.followers || [])).filter((p) => p !== t.owner)

export function toggleFollow(id: string, who: PersonKey) {
  const t0 = S().tasks.find((x) => x.id === id)
  if (!t0) return
  const on = !followersOf(t0).includes(who)
  S().commit(
    (s) => {
      const t = s.tasks.find((x) => x.id === id)!
      const cur = followersOf(t)
      t.followers = on ? [...cur, who] : cur.filter((p) => p !== who)
      t.log.push({ date: NOW, who: meOf(s.role), text: on ? `${PEOPLE[who].name} follows it` : `${PEOPLE[who].name} stopped following` })
    },
    who === meOf(S().role) ? (on ? 'You follow it' : 'You stopped following it') : on ? `${PEOPLE[who].short} follows it now` : `${PEOPLE[who].short} stopped following`,
    { undo: false, sub: on ? (who === meOf(S().role) ? 'It waits under Waiting on others until it’s done.' : 'They hear when it moves.') : undefined },
  )
}
/** someone else can do it too: it's on their Today as well, and whoever does it first closes it for both */
export function toggleAlso(id: string, who: PersonKey) {
  const t0 = S().tasks.find((x) => x.id === id)
  if (!t0 || who === t0.owner) return
  const on = !(t0.also || []).includes(who)
  S().commit(
    (s) => {
      const t = s.tasks.find((x) => x.id === id)!
      const cur = (t.also || []).filter((p) => p !== t.owner)
      const next = on ? [...cur, who] : cur.filter((p) => p !== who)
      t.also = next.length ? next : undefined
      const r = s.team.find((m) => m.key === who)?.role as Role | undefined
      if (on && r && !t.for.includes(r)) t.for = [...t.for, r]
      t.log.push({ date: NOW, who: meOf(s.role), text: on ? `${PEOPLE[who].name} can do it too` : `${PEOPLE[who].name} taken off it` })
    },
    on ? `On ${PEOPLE[who].short}’s Today too` : `Off ${PEOPLE[who].short}’s Today`,
    { undo: false, sub: on ? 'Whoever does it first closes it for both.' : undefined },
  )
}
export function setEveryone(id: string, on: boolean) {
  S().commit(
    (s) => {
      const t = s.tasks.find((x) => x.id === id)
      if (!t) return
      t.everyone = on
      t.log.push({ date: NOW, who: meOf(s.role), text: on ? 'Pinned to everyone’s Today' : 'Unpinned from everyone’s Today' })
    },
    on ? 'Everyone sees it on their Today' : 'Back to the owner and followers',
    { undo: false, sub: on ? 'It stays at the top of every login until it’s done.' : undefined },
  )
}
