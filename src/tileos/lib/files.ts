/* Files kept with a project — the tile paperwork, plans, photos. The real app keeps them in the company's storage;
 * the preview keeps them only while the page is open (it has nowhere private to put them). */
import { useStore, meOf, addHist, NOW } from '@/tileos/store'
import { REAL } from '@/tileos/lib/save'
import { toast } from '@/tileos/lib/pop'
import type { FileRec } from '@/tileos/data/jobs'

/** the preview's files, while the page is open */
const LOCAL = new Map<string, string>()

export type Kept = { recs: FileRec[]; problem?: string }
/** keep files with a project; says so in its history. Storage that isn't set up yet doesn't stop the work. */
export async function keepFiles(jobId: string, list: File[], kind: FileRec['kind']): Promise<Kept> {
  const s = useStore.getState()
  const me = meOf(s.role)
  const recs: FileRec[] = []
  let problem: string | undefined
  for (const f of list) {
    const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    let path: string | undefined
    if (REAL.files) {
      try { path = await REAL.files.put(jobId, id, f) } catch (e: any) { problem = e?.message || 'Couldn’t keep the file' }
    } else LOCAL.set(id, URL.createObjectURL(f))
    recs.push({ id, jobId, name: f.name, size: f.size, type: f.type || 'application/octet-stream', kind, ...(path ? { path } : {}), by: me, at: NOW })
  }
  if (recs.length)
    s.commit((st) => {
      st.files.push(...recs)
      addHist(st, jobId, { who: me, kind: 'setup', title: recs.length === 1 ? `File added · ${recs[0].name}` : `${recs.length} files added`, detail: recs.map((r) => r.name).join(', ') })
    })
  return { recs, problem }
}

/** open a kept file in a new tab */
export async function openFile(rec: FileRec) {
  if (rec.path && REAL.files) {
    try { window.open(await REAL.files.url(rec.path), '_blank', 'noopener') } catch { toast('Couldn’t open the file — try again') }
    return
  }
  const local = LOCAL.get(rec.id)
  if (local) window.open(local, '_blank', 'noopener')
  else toast(REAL.cloud ? 'This file isn’t in storage — upload it again' : 'Files are only kept while the preview is open — in the real app they stay with the project')
}

export const sizeLabel = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`)
