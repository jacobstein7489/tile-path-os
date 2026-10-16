/* Our materials changed by hand on a project: a material added, a different amount, one taken off the list.
 * Kept on the project (its prep) — the takeoff reads them. */
import { useStore, type Store } from '@/tileos/store'

function editMats(jobId: string, f: (m: NonNullable<Store['prep'][string]['mats']>) => void, msg: string) {
  useStore.getState().commit((s) => {
    const p = (s.prep[jobId] ||= {})
    const m = (p.mats ||= {})
    f(m)
  }, msg)
}
/** add a material that the takeoff didn't work out (or more of one) */
export const addMat = (jobId: string, itemId: string, qty: number, note?: string) => editMats(jobId, (m) => { (m.add ||= []).push({ itemId, qty, note }); m.off = (m.off || []).filter((x) => x !== itemId) }, 'Added to the materials')
/** a different amount than the takeoff worked out */
export const setMatQty = (jobId: string, itemId: string, qty: number | null) => editMats(jobId, (m) => { m.qty ||= {}; if (qty == null) delete m.qty[itemId]; else m.qty[itemId] = qty }, qty == null ? 'Back to the worked-out amount' : 'Amount changed')
/** take it off the list (and back on) */
export const removeMat = (jobId: string, itemId: string) => editMats(jobId, (m) => { m.add = (m.add || []).filter((x) => x.itemId !== itemId); if (!(m.off || []).includes(itemId)) (m.off ||= []).push(itemId); if (m.qty) delete m.qty[itemId] }, 'Taken off the materials')
export const restoreMat = (jobId: string, itemId: string) => editMats(jobId, (m) => { m.off = (m.off || []).filter((x) => x !== itemId) }, 'Back on the materials')

