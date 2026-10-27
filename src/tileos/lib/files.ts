/* Files kept with a project — the tile paperwork, plans, photos. The real app keeps them in the company's storage;
 * the preview keeps them only while the page is open (it has nowhere private to put them).
 * Photos are made smaller before they go up (a phone photo is several MB), and keep a little preview with the record
 * so a page of photos opens at once. */
import { useStore, meOf, addHist, NOW } from '@/tileos/store'
import { REAL } from '@/tileos/lib/save'
import { toast } from '@/tileos/lib/pop'
import type { FileRec } from '@/tileos/data/jobs'

/** the preview's files, while the page is open */
const LOCAL = new Map<string, string>()
/** links to files in storage are good for ten minutes — reuse them for nine */
const LINKS = new Map<string, { url: string; at: number }>()

const isPhoto = (f: File) => /^image\/(jpeg|png|webp|heic|heif|gif)$/i.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)
function shrink(f: File, max: number, q = 0.85): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * k))
      c.height = Math.max(1, Math.round(img.height * k))
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob((b) => resolve(b), 'image/jpeg', q)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}
const asDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(''); r.readAsDataURL(b) })

export type Kept = { recs: FileRec[]; problem?: string }
/** keep files with a project; says so in its history. Storage that isn't set up yet doesn't stop the work. */
export async function keepFiles(jobId: string, list: File[], kind: FileRec['kind'], o: { quiet?: boolean; doc?: string } = {}): Promise<Kept> {
  const s = useStore.getState()
  const me = meOf(s.role)
  const recs: FileRec[] = []
  let problem: string | undefined
  for (const f of list) {
    const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    /* a photo goes up at a sensible size, with a small preview kept on the record */
    let body: Blob = f
    let name = f.name || 'file'
    let thumb: string | undefined
    if (isPhoto(f)) {
      const big = f.size > 900_000 ? await shrink(f, 2200) : null
      if (big) { body = big; name = name.replace(/\.\w+$/, '') + '.jpg' }
      const small = await shrink(f, 360, 0.75)
      if (small) thumb = await asDataUrl(small)
    }
    let path: string | undefined
    if (REAL.files) {
      try { path = await REAL.files.put(jobId, id, body, name) } catch (e: any) { problem = e?.message || 'Couldn’t keep the file' }
    } else LOCAL.set(id, URL.createObjectURL(body))
    recs.push({ id, jobId, name, size: body.size, type: body.type || f.type || 'application/octet-stream', kind, ...(path ? { path } : {}), ...(thumb ? { thumb } : {}), ...(o.doc ? { doc: o.doc } : {}), by: me, at: NOW })
  }
  if (recs.length)
    s.commit((st) => {
      st.files.push(...recs)
      addHist(st, jobId, { who: me, kind: kind === 'photo' ? 'field' : 'setup', title: recs.length === 1 ? `${kind === 'photo' ? 'Photo' : 'File'} added · ${recs[0].name}` : `${recs.length} ${kind === 'photo' ? 'photos' : 'files'} added`, detail: recs.map((r) => r.name).join(', ') })
    }, problem || o.quiet ? undefined : recs.length === 1 ? `${recs[0].name} added` : `${recs.length} ${kind === 'photo' ? 'photos' : 'files'} added`)
  return { recs, problem }
}

/** a link to open a kept file (or nothing, when the preview no longer has it) */
export async function fileUrl(rec: FileRec): Promise<string | undefined> {
  if (rec.path && REAL.files) {
    const hit = LINKS.get(rec.path)
    if (hit && Date.now() - hit.at < 9 * 60_000) return hit.url
    const url = await REAL.files.url(rec.path)
    LINKS.set(rec.path, { url, at: Date.now() })
    return url
  }
  return LOCAL.get(rec.id)
}

/** a kept file back as a file — to read it again (the paperwork uploaded on Get paperwork, read on Enter paperwork) */
export async function fileBlob(rec: FileRec): Promise<File | undefined> {
  try {
    const url = await fileUrl(rec)
    if (!url) return undefined
    const r = await fetch(url)
    if (!r.ok) return undefined
    const b = await r.blob()
    return new File([b], rec.name, { type: rec.type || b.type })
  } catch { return undefined }
}

/** open a kept file in a new tab */
export async function openFile(rec: FileRec) {
  /* open the tab right away (phones block a tab opened after waiting), then send it to the file */
  const tab = rec.path && REAL.files ? window.open('', '_blank') : null
  try {
    const url = await fileUrl(rec)
    if (url) {
      if (tab) tab.location.href = url
      else window.open(url, '_blank', 'noopener')
      return
    }
    tab?.close()
    toast(REAL.cloud ? 'This file isn’t in storage — upload it again' : 'Files are only kept while the preview is open — in the real app they stay with the project')
  } catch {
    tab?.close()
    toast('Couldn’t open the file — try again')
  }
}

/** take a file off a project (and out of storage) */
export async function removeFile(rec: FileRec) {
  if (rec.path && REAL.files) { try { await REAL.files.remove(rec.path) } catch { /* the record goes either way */ } }
  LOCAL.delete(rec.id)
  const s = useStore.getState()
  s.commit((st) => {
    st.files = st.files.filter((f) => f.id !== rec.id)
    addHist(st, rec.jobId, { who: meOf(st.role), kind: 'setup', title: `${rec.kind === 'photo' ? 'Photo' : 'File'} removed · ${rec.name}` })
  }, `${rec.name} removed`)
}

/** the files that are one of the estimate's documents — tagged when they came in, or named like it */
/** the files that are one named document — the tile paperwork, the plans, the spec book, the finish schedule. A file
 *  given that name when it was added is it; one added without a name counts only when its file name says that one
 *  document and no other (a "spec book and finish schedule.pdf" is neither — it stays with the other files). */
const DOC_LIKE: Record<string, RegExp> = { Plans: /plan|drawing|arch|^A\d/i, 'Spec book': /spec/i, 'Finish schedule': /finish|schedule/i }
export function filesOfDoc(files: FileRec[], jobId: string, doc: string): FileRec[] {
  if (doc === 'Tile paperwork') return files.filter((f) => f.jobId === jobId && f.kind === 'paperwork')
  const mine = files.filter((f) => f.jobId === jobId && f.kind !== 'photo' && f.kind !== 'paperwork')
  const tagged = mine.filter((f) => f.doc === doc)
  if (tagged.length) return tagged
  const like = DOC_LIKE[doc]
  if (!like) return []
  const others = Object.entries(DOC_LIKE).filter(([k]) => k !== doc).map(([, r]) => r)
  return mine.filter((f) => !f.doc && (like.test(f.name) || (doc === 'Plans' && f.kind === 'plans')) && !others.some((r) => r.test(f.name)))
}
export const isPdf = (f: { name: string; type?: string }) => /pdf/i.test(f.type || '') || /\.pdf$/i.test(f.name)
export const isImage = (f: { name: string; type?: string }) => /^image\//i.test(f.type || '') || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)

export const sizeLabel = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`)
export const KIND_LABEL: Record<FileRec['kind'], string> = { paperwork: 'Tile paperwork', plans: 'Plans and specs', photo: 'Photos', other: 'Other files' }
