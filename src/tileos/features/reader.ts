/* Reading the tile paperwork with AI. The pages — photos, or a PDF turned into pictures right here in the browser —
 * go to the AI together with the walls and floors we're tiling. It sends back every tile on the paperwork (tag, name,
 * size, finish, maker, grout, how much) and which of OUR walls and floors each one goes on.
 *   the real app: the company's AI, on the server
 *   the preview on claude.ai: Claude, through the page (the viewer allows it once) */
import { REAL } from '@/tileos/lib/save'
import type { ReadStep } from '@/tileos/lib/reading'
import type { Job } from '@/tileos/data/model'
import type { Room, Tile } from '@/tileos/data/jobs'

export type ReadTile = {
  tag: string; name: string; maker?: string; size?: string; finish?: string; grout?: string; joint?: string
  qty?: number; unit?: 'SF' | 'boxes'; boxSF?: number; supplier?: string
  /** our walls and floors it goes on, as "Room · Surface" */
  goesOn: string[]
  /** how it's laid, how its edges are finished (mitered, or which metal), how high it goes on the walls — when the
   *  paperwork says */
  layout?: string; edge?: string; height?: string
  /** a trim piece (a wall cap, a jolly, a pencil liner, a bullnose) — it goes on with the walls' tile, by the piece */
  trim?: boolean
  note?: string
  /** where the tile's own picture is on the pages (the page, from 0, and the box) — and the picture cut out of it */
  photo?: { page: number; box: [number, number, number, number] }
  pic?: string; picColor?: string
}
/** what the paperwork says about a room as a whole — "9 ft ceiling; wet walls full, other walls to 4 ft" */
export type ReadRoom = { room: string; note: string }
export type ReadResult = { tiles: ReadTile[]; rooms?: ReadRoom[]; notes?: string; pages: number }
export class ReadError extends Error { constructor(public code: string, msg: string) { super(msg) } }

/* up to 24 pages, read 8 at a time — a room sheet a page is often 10 pages or more */
const MAX_PAGES = 24
const PER_ASK = 8
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
async function pdfPages(f: File, max: number, onPage?: (done: number, total: number) => void): Promise<Blob[]> {
  /* PDFs are read in the browser only — this keeps the PDF reader out of the server's bundle */
  if (import.meta.env.SSR) throw new ReadError('server', 'PDFs are read in the browser')
  const pdfjs: any = await import('pdfjs-dist')
  /* the PDF is read on the page itself — no separate worker to load (works inside the preview too) */
  // @ts-ignore — the worker module has no types
  if (!(globalThis as any).pdfjsWorker) (globalThis as any).pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs')
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise
  const out: Blob[] = []
  try {
    const n = Math.min(pdf.numPages, max)
    for (let i = 1; i <= n; i++) {
      onPage?.(i - 1, n)
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
/** every page of every file as a picture, up to `max` — saying how far it got (each page opened, of how many) */
export async function pagesOf(files: File[], max = MAX_PAGES, onStep?: (s: ReadStep) => void): Promise<Blob[]> {
  const out: Blob[] = []
  for (let k = 0; k < files.length; k++) {
    const f = files[k]
    if (out.length >= max) break
    const later = files.length - k - 1
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) out.push(...(await pdfPages(f, max - out.length, (d, n) => onStep?.({ phase: 'pages', done: out.length + d, total: out.length + n + later }))))
    else if (/^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name)) { onStep?.({ phase: 'pages', done: out.length, total: out.length + 1 + later }); out.push(await imagePage(f)) }
  }
  return out
}

/* ---------------- asking ---------------- */
const SAMPLE_WORDS: Record<string, string> = {
  not_granted: 'Claude wasn’t allowed to read it. Try again and allow it when it asks.',
  sampling_disabled: 'Claude isn’t available on this account.',
  rate_limited: 'Too many at once. Try again in a minute.',
  image_rejected: 'One of the pages couldn’t be read. Try a clearer photo or the PDF.',
  images_unavailable: 'Reading pictures isn’t available here.',
  cancelled: 'Stopped.',
}
/** ask the AI about these pages; the answer as text */
export async function askAI(prompt: string, pages: Blob[], signal?: AbortSignal): Promise<string> {
  if (REAL.ai) return REAL.ai(prompt, pages, signal)
  const c = (globalThis as any).claude
  const sample = c?.use ? await c.use('sample').catch(() => null) : null
  if (!sample) throw new ReadError('noai', 'Reading paperwork works in the real app. Here it needs Claude, which isn’t available on this page.')
  const lim = await sample.limits?.().catch(() => null)
  const n = lim?.images?.maxCount || 5
  try {
    const r = await sample(prompt, { images: pages.slice(0, n), modelTier: 'default', signal, cache: false })
    return r.text
  } catch (e: any) {
    throw new ReadError(e?.code || 'error', SAMPLE_WORDS[e?.code] || 'Couldn’t read it just now · try again.')
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
  throw new ReadError('json', 'The answer didn’t come back in a form we can use · try again.')
}

/* ---------------- the tile paperwork ---------------- */
export const labelOf = (room: string, surface: string) => `${room} · ${surface}`
export function paperworkPrompt(job: Job, rooms: Room[], tiles: Tile[]): string {
  const surfaces = rooms.flatMap((r) => r.surfaces.map((x) => `- ${labelOf(r.name, x.name)}${x.sf ? ` · ${x.sf} SF` : ''}${x.tile ? ` · has ${x.tile} now` : ''}`))
  const have = tiles.map((t) => `- ${t.tag} ${t.name}${t.size ? ` (${t.size})` : ''}`)
  return [
    'You are reading tile paperwork for Cobblestone, a tile installation company. The pictures are the pages of a finish schedule, room sheets (a page for each room), a tile selection sheet, a showroom quote or a tile order. Read every tile on them.',
    '',
    `The project is "${job.name}"${job.address ? ` at ${job.address}` : ''}. These are the walls and floors we are tiling, from our estimate (room · surface · square feet):`,
    ...(surfaces.length ? surfaces : ['- (none entered yet)']),
    ...(have.length ? ['', 'Tiles we already have on the project (keep the same tag when it is the same tile):', ...have] : []),
    '',
    'Our room names and the paperwork’s often differ. Match them by what the room is, not the exact words: "Foyer" on the paperwork is our room with Foyer in its name (like "Foyer / Hallway / Closet"), "Powder Room 1" is our "Powder Room #1", "Main Floor Guest Bathroom" is our "Guest Bath · 1st floor". When a paperwork room clearly isn’t one of ours, leave goesOn empty and name the room in note.',
    '',
    'Room sheets: each page is one room, its name big on top. Each tile on it has a small label above its name saying where it goes in that room · FLOOR, WALLS, WALLS TO 4 FT, FLOOR + WALLS TO 3 FT, FLOOR + FIRST 24 INCHES OF WALLS, ACCENT WALL, SHOWER FLOOR, SHOWER WALLS, TOP 4 FT OF SHOWER WALLS, REMAINING WALLS, BACKSPLASH, WALL CAP, CHECKERBOARD… Go by that label: FLOOR is that room’s floor; WALLS (to any height) its walls, or its wainscot, if that’s what we have; FLOOR + WALLS both; SHOWER FLOOR its shower floor; ACCENT WALL its accent wall if we list one, else its walls; CHECKERBOARD its floor. Two tiles can share one wall or floor (a checkerboard, a mix of two colors): give each of them that wall or floor. "Also used in" only says the same tile is on another room’s sheet too. Where it goes there is on that room’s own sheet. The same tile on several sheets is ONE tile: give it once, with every wall and floor it goes on.',
    '',
    'For each different tile on the paperwork give:',
    '- tag: the tag or code the paperwork uses (T-1, FT-2, WT-3…), or "" if it has none',
    '- name: the tile’s name or color, e.g. "Calacatta Gold"',
    '- maker, size as bought (like "24 x 48"), finish (Matte, Polished, Honed, Gloss…)',
    '- grout: the grout color if the paperwork says it ("Not specified" means it doesn’t. Leave it ""); joint: the grout joint if given (like 1/16")',
    '- qty and unit: how much the paperwork has of it, unit "SF" or "boxes" (cartons count as boxes); boxSF: square feet in a box, if shown',
    '- supplier: the store or showroom the tile comes from. The company whose name or logo is on the paperwork (its header, footer, quote or order · for example "Infinity Tile"). When the paperwork is one store’s, every tile on it gets that store',
    '- goesOn: which of OUR walls and floors listed above it goes on. Copy the labels exactly as written above (for example "Master Bath · Floor"). Go by where the paperwork says it goes (room names, the label over the tile, floor, shower walls, backsplash…). If it doesn’t say, leave it empty · don’t guess.',
    '- layout: the pattern if the paperwork gives it · Straight lay, Offset ½, Offset ⅓, Vertical stack, Herringbone, Diagonal, Basketweave, Checkerboard…, and if the tile is cut down on the job ("Cut to 12 × 12"), add that, like "Checkerboard · cut to 12 x 12"',
    '- edge: how its open edges and outside corners are finished, if the paperwork says · "Mitered", "Bullnose", or the metal with its profile, finish (color) and size, like "Schluter JOLLY · Brushed nickel · 10 mm"',
    '- height: on walls, how high it goes if the paperwork says and it’s the same everywhere the tile goes · "Fully tiled, to the ceiling", "Half tiled, to 4 ft", "Wet walls only · to the ceiling", or a height like 84″. When it differs by room, say it for each room in "rooms" instead.',
    '- trim: true when it’s a trim piece, not a field tile. A wall cap, a jolly, a pencil liner, a bullnose, a chair rail, a base. Give it goesOn like any tile (the walls it finishes): it goes on them together with their tile. A metal edge (Schluter and the like) isn’t a tile. Say it in edge on the tiles it finishes instead.',
    '- note: where the paperwork puts it in its own words (like "Accent wall" or "Top 4 ft of shower walls"), and anything unclear about this tile, in a few words',
    '- photo: if the pages show a picture of this tile (a sample photo or swatch), where it is: {"page": the picture number (1 for the first picture you were sent), "box": [ymin, xmin, ymax, xmax]}. Each from 0 to 1000 across that picture, top-left is 0,0. Box just the tile’s picture, not text and not the whole page (two small pictures side by side for one tile: box both). Leave photo out if there is no picture of it.',
    '',
    'Also, for each of OUR rooms where the paperwork says the ceiling height or how the walls are tiled, give a short note in "rooms". For example {"room":"Master Bath","note":"9 ft ceiling; wet walls full, other walls to 4 ft"} or {"room":"Powder Room #1","note":"Walls to 4 ft"}. Use our room names exactly as written above.',
    '',
    'Answer with JSON only, no other text, in exactly this shape:',
    '{"tiles":[{"tag":"","name":"","maker":"","size":"","finish":"","grout":"","joint":"","qty":0,"unit":"SF","boxSF":0,"supplier":"","goesOn":[],"layout":"","edge":"","height":"","trim":false,"note":"","photo":{"page":1,"box":[0,0,0,0]}}],"rooms":[{"room":"","note":""}],"notes":""}',
    'In "notes" put anything on the paperwork that matters for the job but isn’t a tile. A revision date, a missing page, a question. Leave a field "" (or 0) when the paperwork doesn’t give it.',
  ].join('\n')
}

const num = (v: any) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return isFinite(n) && n > 0 ? n : undefined }
/** a picture's place, checked: the picture number (from 1 — 0 is taken as 1) and a box that's a real part of it */
function photoOf(p: any): ReadTile['photo'] {
  if (!p || !Array.isArray(p.box) || p.box.length !== 4) return undefined
  const b = p.box.map((v: any) => Math.max(0, Math.min(1000, Number(v)))) as [number, number, number, number]
  if (b.some((v) => !isFinite(v))) return undefined
  const [y0, x0, y1, x1] = b
  const area = ((y1 - y0) * (x1 - x0)) / 1e6
  if (y1 - y0 < 20 || x1 - x0 < 20 || area > 0.85) return undefined
  const page = Math.max(1, Math.round(Number(p.page) || 1))
  return { page: page - 1, box: b }
}
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
      layout: str(t?.layout) || undefined, edge: str(t?.edge) || undefined, height: str(t?.height) || undefined,
      ...(t?.trim === true || /^true$/i.test(str(t?.trim)) ? { trim: true } : {}),
      photo: photoOf(t?.photo),
    }
  }).filter((t: ReadTile) => t.name || t.tag)
    /* "Not specified" is no grout */
    .map((t: ReadTile) => (t.grout && /^(not specified|none|n\/?a|tbd|—|-)$/i.test(t.grout) ? { ...t, grout: undefined } : t))
  const names = new Map(rooms.map((r) => [norm(r.name), r.name]))
  const roomNotes: ReadRoom[] = (Array.isArray(raw?.rooms) ? raw.rooms : []).map((r: any) => ({ room: names.get(norm(str(r?.room))) || '', note: str(r?.note) })).filter((r: ReadRoom) => r.room && r.note)
  return { tiles, rooms: roomNotes.length ? roomNotes : undefined, notes: str(raw?.notes) || undefined }
}
/** what several reads found, as one: the same tile (by its tag, or its name) once, with everything each page said */
/** a tile's name as words only — "Uptown Morning Side" and "Uptown Morningside" are the same tile */
export const sameName = (a: string, b: string) => { const n = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ''); return !!n(a) && n(a) === n(b) }
export function mergeReads(parts: Omit<ReadResult, 'pages'>[]): Omit<ReadResult, 'pages'> {
  const tiles: ReadTile[] = []
  for (const part of parts) for (const t of part.tiles) {
    /* the same tag, or (no tags to go by) the same name — the same tile on two room sheets is one tile */
    const had = tiles.find((x) => (!!t.tag && !!x.tag ? x.tag === t.tag : false) || ((!t.tag || !x.tag || x.tag === t.tag) && sameName(x.name, t.name)))
    if (!had) { tiles.push({ ...t, goesOn: [...t.goesOn] }); continue }
    for (const k of ['tag', 'maker', 'size', 'finish', 'grout', 'joint', 'boxSF', 'supplier', 'layout', 'edge', 'height', 'photo', 'trim'] as const) if (!had[k] && t[k]) (had as any)[k] = t[k]
    if ((t.qty || 0) > (had.qty || 0)) { had.qty = t.qty; had.unit = t.unit }
    had.goesOn = Array.from(new Set([...had.goesOn, ...t.goesOn]))
    if (t.note && !(had.note || '').includes(t.note)) had.note = [had.note, t.note].filter(Boolean).join(' · ')
  }
  const rooms = parts.flatMap((p) => p.rooms || []).filter((r, i, all) => all.findIndex((x) => x.room === r.room) === i)
  const notes = parts.map((p) => p.notes).filter(Boolean).join(' ')
  return { tiles, rooms: rooms.length ? rooms : undefined, notes: notes || undefined }
}

/** read the paperwork: the pages, the question, the answer checked */
export async function readTilePaperwork(job: Job, rooms: Room[], tiles: Tile[], files: File[], signal?: AbortSignal, onStep?: (s: ReadStep) => void): Promise<ReadResult> {
  const pages = await pagesOf(files, MAX_PAGES, onStep)
  if (!pages.length) throw new ReadError('nopages', 'Those files aren’t pictures or PDFs we can read.')
  if (signal?.aborted) throw new ReadError('cancelled', 'Stopped.')
  /* 8 pages at a time — then it's put together as one */
  const parts: Omit<ReadResult, 'pages'>[] = []
  const asks = Math.ceil(pages.length / PER_ASK)
  for (let i = 0; i < pages.length; i += PER_ASK) {
    onStep?.({ phase: 'reading', done: i / PER_ASK, total: asks, pages: pages.length, per: PER_ASK })
    const chunk = pages.slice(i, i + PER_ASK)
    const which = pages.length > PER_ASK ? `\n\nThese are pages ${i + 1}–${i + chunk.length} of ${pages.length}.` : ''
    const text = await askAI(paperworkPrompt(job, rooms, tiles) + which, chunk, signal)
    if (signal?.aborted) throw new ReadError('cancelled', 'Stopped.')
    const part = cleanRead(jsonIn(text), rooms)
    /* the picture numbers are this ask's — make them the page's place in the whole paperwork */
    part.tiles.forEach((t) => { if (t.photo) t.photo = t.photo.page < chunk.length ? { ...t.photo, page: t.photo.page + i } : undefined })
    parts.push(part)
  }
  const out = mergeReads(parts)
  /* each tile's picture, cut out of its page — it goes on the tile, and so on the room sheets */
  onStep?.({ phase: 'pictures', done: 0, total: 1 })
  for (const t of out.tiles) {
    if (!t.photo || !pages[t.photo.page]) continue
    const c = await cutOut(pages[t.photo.page], t.photo.box).catch(() => undefined)
    if (c) { t.pic = c.photo; t.picColor = c.color }
  }
  return { ...out, pages: pages.length }
}
/** a part of a page, as a small JPEG (about 480 px) and its average color */
async function cutOut(page: Blob, box: [number, number, number, number]): Promise<{ photo: string; color: string } | undefined> {
  if (typeof createImageBitmap === 'undefined') return undefined
  const bmp = await createImageBitmap(page)
  const [y0, x0, y1, x1] = box.map((v) => v / 1000)
  const sx = Math.round(x0 * bmp.width), sy = Math.round(y0 * bmp.height)
  const sw = Math.round((x1 - x0) * bmp.width), sh = Math.round((y1 - y0) * bmp.height)
  if (sw < 24 || sh < 24) return undefined
  const k = Math.min(1, 480 / Math.max(sw, sh))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(sw * k))
  c.height = Math.max(1, Math.round(sh * k))
  const g = c.getContext('2d')!
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height)
  bmp.close?.()
  let color = '#e9e5de'
  try {
    const d = g.getImageData(0, 0, c.width, c.height).data
    let r = 0, gg = 0, b = 0, n = 0
    for (let q = 0; q < d.length; q += 16) { r += d[q]; gg += d[q + 1]; b += d[q + 2]; n++ }
    const hx = (v: number) => Math.round(v / n).toString(16).padStart(2, '0')
    if (n) color = `#${hx(r)}${hx(gg)}${hx(b)}`
  } catch { /* keep the neutral color */ }
  return { photo: c.toDataURL('image/jpeg', 0.82), color }
}
