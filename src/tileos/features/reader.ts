/* Reading the tile paperwork with AI. The pages — photos, or a PDF turned into pictures right here in the browser —
 * go to the AI together with the walls and floors we're tiling. It sends back every tile on the paperwork (tag, name,
 * size, finish, maker, grout, how much) and which of OUR walls and floors each one goes on.
 *   the real app: the company's AI, on the server
 *   the preview on claude.ai: Claude, through the page (the viewer allows it once) */
import { REAL } from '@/tileos/lib/save'
import type { Job } from '@/tileos/data/model'
import type { Room, Tile } from '@/tileos/data/jobs'

export type ReadTile = {
  tag: string; name: string; maker?: string; size?: string; finish?: string; grout?: string; joint?: string
  qty?: number; unit?: 'SF' | 'boxes'; boxSF?: number; supplier?: string
  /** our walls and floors it goes on, as "Room · Surface" */
  goesOn: string[]
  note?: string
}
export type ReadResult = { tiles: ReadTile[]; notes?: string; pages: number }
export class ReadError extends Error { constructor(public code: string, msg: string) { super(msg) } }

const MAX_PAGES = 8
const SIDE = 1600

/* ---------------- files → pictures ---------------- */
function toJpeg(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new ReadError('draw', 'Couldn’t read that page'))), 'image/jpeg', 0.85))
}
async function imagePage(f: Blob): Promise<Blob> {
  const url = URL.createObjectURL(f)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new ReadError('image', 'That picture can’t be read')); i.src = url })
    const k = Math.min(1, SIDE / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.width * k))
    c.height = Math.max(1, Math.round(img.height * k))
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, c.width, c.height)
    g.drawImage(img, 0, 0, c.width, c.height)
    return await toJpeg(c)
  } finally { URL.revokeObjectURL(url) }
}
async function pdfPages(f: File, max: number): Promise<Blob[]> {
  /* PDFs are read in the browser only — this keeps the PDF reader out of the server's bundle */
  if (import.meta.env.SSR) throw new ReadError('server', 'PDFs are read in the browser')
  const pdfjs: any = await import('pdfjs-dist')
  /* the PDF is read on the page itself — no separate worker to load (works inside the preview too) */
  // @ts-ignore — the worker module has no types
  if (!(globalThis as any).pdfjsWorker) (globalThis as any).pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs')
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise
  const out: Blob[] = []
  try {
    for (let i = 1; i <= Math.min(pdf.numPages, max); i++) {
      const page = await pdf.getPage(i)
      const v1 = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: Math.min(3, SIDE / Math.max(v1.width, v1.height)) })
      const c = document.createElement('canvas')
      c.width = Math.ceil(vp.width)
      c.height = Math.ceil(vp.height)
      const g = c.getContext('2d')!
      g.fillStyle = '#fff'
      g.fillRect(0, 0, c.width, c.height)
      await page.render({ canvasContext: g, viewport: vp }).promise
      out.push(await toJpeg(c))
      page.cleanup()
    }
  } finally { await pdf.destroy() }
  return out
}
/** every page of every file as a picture, up to `max` */
export async function pagesOf(files: File[], max = MAX_PAGES): Promise<Blob[]> {
  const out: Blob[] = []
  for (const f of files) {
    if (out.length >= max) break
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) out.push(...(await pdfPages(f, max - out.length)))
    else if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)) out.push(await imagePage(f))
  }
  return out
}

/* ---------------- asking ---------------- */
const SAMPLE_WORDS: Record<string, string> = {
  not_granted: 'Claude wasn’t allowed to read it. Try again and allow it when it asks.',
  sampling_disabled: 'Claude isn’t available on this account.',
  rate_limited: 'Too many at once — try again in a minute.',
  image_rejected: 'One of the pages couldn’t be read — try a clearer photo or the PDF.',
  images_unavailable: 'Reading pictures isn’t available here.',
  cancelled: 'Stopped.',
}
/** ask the AI about these pages; the answer as text */
export async function askAI(prompt: string, pages: Blob[], signal?: AbortSignal): Promise<string> {
  if (REAL.ai) return REAL.ai(prompt, pages, signal)
  const c = (globalThis as any).claude
  const sample = c?.use ? await c.use('sample').catch(() => null) : null
  if (!sample) throw new ReadError('noai', 'Reading paperwork works in the real app — here it needs Claude, which isn’t available on this page.')
  const lim = await sample.limits?.().catch(() => null)
  const n = lim?.images?.maxCount || 5
  try {
    const r = await sample(prompt, { images: pages.slice(0, n), modelTier: 'default', signal, cache: false })
    return r.text
  } catch (e: any) {
    throw new ReadError(e?.code || 'error', SAMPLE_WORDS[e?.code] || 'Couldn’t read it just now — try again.')
  }
}

/** the first JSON object in a reply (the AI sometimes wraps it in a code block or a sentence) */
export function jsonIn(text: string): any {
  const t = (text || '').trim()
  try { return JSON.parse(t) } catch { /* look inside */ }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) { try { return JSON.parse(fence[1]) } catch { /* keep looking */ } }
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) } catch { /* no */ } }
  throw new ReadError('json', 'The answer didn’t come back in a form we can use — try again.')
}

/* ---------------- the tile paperwork ---------------- */
export const labelOf = (room: string, surface: string) => `${room} · ${surface}`
export function paperworkPrompt(job: Job, rooms: Room[], tiles: Tile[]): string {
  const surfaces = rooms.flatMap((r) => r.surfaces.map((x) => `- ${labelOf(r.name, x.name)}${x.sf ? ` · ${x.sf} SF` : ''}${x.tile ? ` · has ${x.tile} now` : ''}`))
  const have = tiles.map((t) => `- ${t.tag} ${t.name}${t.size ? ` (${t.size})` : ''}`)
  return [
    'You are reading tile paperwork for Cobblestone, a tile installation company. The pictures are the pages of a finish schedule, a tile selection sheet, a showroom quote or a tile order. Read every tile on them.',
    '',
    `The project is "${job.name}"${job.address ? ` at ${job.address}` : ''}. These are the walls and floors we are tiling, from our estimate (room · surface · square feet):`,
    ...(surfaces.length ? surfaces : ['- (none entered yet)']),
    ...(have.length ? ['', 'Tiles we already have on the project (keep the same tag when it is the same tile):', ...have] : []),
    '',
    'For each different tile on the paperwork give:',
    '- tag: the tag or code the paperwork uses (T-1, FT-2, WT-3…), or "" if it has none',
    '- name: the tile’s name or color, e.g. "Calacatta Gold"',
    '- maker, size (like "24 x 48"), finish (Matte, Polished, Honed, Gloss…)',
    '- grout: the grout color if the paperwork says it; joint: the grout joint if given (like 1/16")',
    '- qty and unit: how much the paperwork has of it, unit "SF" or "boxes" (cartons count as boxes); boxSF: square feet in a box, if shown',
    '- supplier: the store or showroom, if shown',
    '- goesOn: which of OUR walls and floors listed above it goes on — copy the labels exactly as written above (for example "Master Bath · Floor"). Go by where the paperwork says it goes (room names, floor, shower walls, backsplash…). If it doesn’t say, leave it empty — don’t guess.',
    '- note: anything unclear about this tile, in a few words',
    '',
    'Answer with JSON only, no other text, in exactly this shape:',
    '{"tiles":[{"tag":"","name":"","maker":"","size":"","finish":"","grout":"","joint":"","qty":0,"unit":"SF","boxSF":0,"supplier":"","goesOn":[],"note":""}],"notes":""}',
    'In "notes" put anything on the paperwork that matters for the job but isn’t a tile — a revision date, a missing page, a question. Leave a field "" (or 0) when the paperwork doesn’t give it.',
  ].join('\n')
}

const num = (v: any) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return isFinite(n) && n > 0 ? n : undefined }
const str = (v: any) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())
/** the AI's answer, checked: our walls and floors only, numbers as numbers */
export function cleanRead(raw: any, rooms: Room[]): Omit<ReadResult, 'pages'> {
  const labels = rooms.flatMap((r) => r.surfaces.map((x) => labelOf(r.name, x.name)))
  const norm = (l: string) => l.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const byNorm = new Map(labels.map((l) => [norm(l), l]))
  const tiles: ReadTile[] = (Array.isArray(raw?.tiles) ? raw.tiles : []).map((t: any) => {
    const unit: 'SF' | 'boxes' = /box|carton|ctn/i.test(str(t?.unit)) ? 'boxes' : 'SF'
    const goesOn = Array.from(new Set((Array.isArray(t?.goesOn) ? t.goesOn : []).map((l: any) => byNorm.get(norm(str(l)))).filter(Boolean))) as string[]
    return {
      tag: str(t?.tag).toUpperCase().replace(/\s+/g, ''), name: str(t?.name) || str(t?.color) || 'Tile', maker: str(t?.maker) || undefined, size: str(t?.size).replace(/\s*[x×X]\s*/g, ' × ') || undefined,
      finish: str(t?.finish) || undefined, grout: str(t?.grout) || undefined, joint: str(t?.joint) || undefined,
      qty: num(t?.qty), unit, boxSF: num(t?.boxSF), supplier: str(t?.supplier) || undefined, goesOn, note: str(t?.note) || undefined,
    }
  }).filter((t: ReadTile) => t.name || t.tag)
  return { tiles, notes: str(raw?.notes) || undefined }
}

/** read the paperwork: the pages, the question, the answer checked */
export async function readTilePaperwork(job: Job, rooms: Room[], tiles: Tile[], files: File[], signal?: AbortSignal): Promise<ReadResult> {
  const pages = await pagesOf(files)
  if (!pages.length) throw new ReadError('nopages', 'Those files aren’t pictures or PDFs we can read.')
  if (signal?.aborted) throw new ReadError('cancelled', 'Stopped.')
  const text = await askAI(paperworkPrompt(job, rooms, tiles), pages, signal)
  return { ...cleanRead(jsonIn(text), rooms), pages: pages.length }
}
