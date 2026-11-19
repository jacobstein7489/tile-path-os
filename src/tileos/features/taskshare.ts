/* One person does it — or two, whoever gets to it first; everyone who needs to can see it.
 *   owner     — the one person whose job it is (always exactly one)
 *   also      — others who can do it too: on their Today as well; whoever does it first closes it for all
 *   followers — it waits under their "Waiting on others" until it's done, and they're told when it moves (only who
 *               asked to follow it — the one who asked for it or handed it over follows it by itself) 
 *   everyone  — pinned to the top of every login's Today until it's done */
import { useStore, NOW, meOf, clockNow } from '@/tileos/store'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'

const S = () => useStore.getState()
const ROLE_PERSON: Partial<Record<Role, PersonKey>> = { owner: 'ys', pm: 'ys', site: 'yakov', office: 'office', estimator: 'estimator', takeoff: 'takeoff', materials: 'materials', accounting: 'accounting' }
export const followersOf = (t: Task): PersonKey[] => Array.from(new Set(t.followers || [])).filter((p) => p !== t.owner && !t.also?.includes(p))

export function toggleFollow(id: string, who: PersonKey, quiet = false) {
  const t0 = S().tasks.find((x) => x.id === id)
  if (!t0) return
  const on = !followersOf(t0).includes(who)
  const you = who === meOf(S().role)
  S().commit(
    (s) => {
      const t = s.tasks.find((x) => x.id === id)!
      const cur = followersOf(t)
      t.followers = on ? [...cur, who] : cur.filter((p) => p !== who)
      t.log.push({ date: NOW, who: meOf(s.role), text: on ? `${PEOPLE[who].name} is watching it` : `${PEOPLE[who].name} stopped watching` })
    },
    /* quiet: ticked in the Watching list — the line says it right away, no pop-up for each tick */
    quiet ? undefined : you ? (on ? 'You’re watching it' : 'You stopped watching it') : on ? `${PEOPLE[who].short} is watching it now` : `${PEOPLE[who].short} stopped watching`,
    { undo: false, sub: on ? (you ? 'It waits under Waiting on others until it’s done.' : 'They hear when it moves.') : undefined },
  )
}
/** someone else can do it too: it's on their Today as well, and whoever does it first closes it for both */
export function toggleAlso(id: string, who: PersonKey, quiet = false) {
  const t0 = S().tasks.find((x) => x.id === id)
  if (!t0 || who === t0.owner) return
  const on = !(t0.also || []).includes(who)
  S().commit(
    (s) => {
      const t = s.tasks.find((x) => x.id === id)!
      const cur = (t.also || []).filter((p) => p !== t.owner)
      const next = on ? [...cur, who] : cur.filter((p) => p !== who)
      t.also = next.length ? next : undefined
      /* doing it — so not watching it */
      if (on && t.followers?.includes(who)) { t.followers = t.followers.filter((p) => p !== who); if (!t.followers.length) delete t.followers }
      const r = s.team.find((m) => m.key === who)?.role as Role | undefined
      if (on && r && !t.for.includes(r)) t.for = [...t.for, r]
      t.log.push({ date: NOW, who: meOf(s.role), text: on ? `${PEOPLE[who].name} can do it too` : `${PEOPLE[who].name} taken off it` })
    },
    /* ticked right in Who: you see it change there — nothing pops up */
    quiet ? undefined : on ? `On ${PEOPLE[who].short}’s Today too` : `Off ${PEOPLE[who].short}’s Today`,
    { undo: false, sub: !quiet && on ? 'Whoever does it first closes it for both.' : undefined },
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

/** the time of day it's for ("9:00 AM") — none: any time that day. It goes on its line on Today, in time order */
export function setTaskTime(id: string, at?: string) {
  S().commit((s) => {
    const t = s.tasks.find((x) => x.id === id)
    if (!t || (t.at || '') === (at || '')) return
    if (at) t.at = at
    else delete t.at
    t.log.push({ date: NOW, time: clockNow(), who: meOf(s.role), text: at ? `Time: ${at}` : 'No set time' })
  }, undefined, { undo: false })
}

/** a task someone added by hand, taken off the list altogether (Undo puts it back) */
export function removeTask(id: string) {
  const t = S().tasks.find((x) => x.id === id)
  if (!t) return
  S().commit((s) => { s.tasks = s.tasks.filter((x) => x.id !== id) }, 'Removed', { sub: t.title })
}

/** its words changed right in its window — what to do, and what it's about (empty: nothing under it) */
export function editTask(id: string, patch: { title?: string; detail?: string }) {
  S().commit((s) => {
    const t = s.tasks.find((x) => x.id === id)
    if (!t) return
    if (patch.title != null && patch.title.trim()) t.title = patch.title.trim()
    if (patch.detail != null) { const d = patch.detail.trim(); if (d) t.detail = d; else delete t.detail }
  }, undefined, { undo: false })
}
/** who may take it off altogether: a task someone added by hand, or asked for (the app's own come and go by
 *  themselves) — the admin, or whoever added it */
export const canRemoveTask = (t: Task, me: PersonKey, admin: boolean) => !t.step && (admin || (!t.action && (t.by === me || (t.log || [])[0]?.who === me)))
/** who may change its words: the same — not something to bring (that's what was asked for, in their words) */
export const canEditTask = (t: Task, me: PersonKey, admin: boolean) => canRemoveTask(t, me, admin) && !t.req && t.state !== 'done'
