/* Inactive: a client, designer, installer or supplier you don't work with right now. They drop out of the lists and
 * pickers but keep their history; one tap brings them back. */
import { useStore, type Store } from '@/tileos/store'

export type DirKind = 'client' | 'designer' | 'crew' | 'supplier'
const S = () => useStore.getState()
export const isOff = (s: Pick<Store, 'inactive'>, kind: DirKind, id: string) => (s.inactive || []).includes(`${kind}:${id}`)
export function setActive(kind: DirKind, id: string, name: string, on: boolean) {
  S().commit((s) => {
    const k = `${kind}:${id}`
    s.inactive = on ? (s.inactive || []).filter((x) => x !== k) : Array.from(new Set([...(s.inactive || []), k]))
  }, on ? `${name} is active again` : `${name} marked inactive`, { sub: on ? undefined : 'Gone from the lists and pickers — find them under Inactive. Their history stays.' })
}
