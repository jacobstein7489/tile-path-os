/* One person does it; everyone who needs to can see it.
 *   owner     — the one person whose job it is (always exactly one)
 *   followers — see it under "Following" and get told when it moves
 *   everyone  — pinned to the top of every login's Today until it's done */
import { useStore, NOW, meOf } from '@/tileos/store'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'

const S = () => useStore.getState()
const ROLE_PERSON: Partial<Record<Role, PersonKey>> = { owner: 'ys', pm: 'ys', site: 'yakov', office: 'office', estimator: 'estimator', takeoff: 'takeoff', materials: 'materials', accounting: 'accounting' }
export const followersOf = (t: Task): PersonKey[] =>
  Array.from(new Set(t.followers ?? ((t.watch || []).map((r) => ROLE_PERSON[r]).filter(Boolean) as PersonKey[]))).filter((p) => p !== t.owner)

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
    on ? `${PEOPLE[who].short} follows it now` : `${PEOPLE[who].short} stopped following`,
    { undo: false, sub: on ? 'It shows under Following, and they hear when it moves.' : undefined },
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
