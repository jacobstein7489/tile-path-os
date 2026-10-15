/* A project's tiles and the details of each wall and floor.
 *   a tile: its tag from the finish schedule (T-1…), a picture, size, finish, maker, who orders it, and the grout it goes with
 *   a wall or floor: which tile, grout and joint, the layout, what goes under it, the edge or metal, the height, square feet
 * Every change is saved to the project's history; the materials and the scope of work follow by themselves. */
import { useStore, addHist, meOf } from '@/tileos/store'
import { GROUTS, JOINTS, type Tile, type Surface, type Grout } from '@/tileos/data/jobs'
import type { ReadTile } from './reader'
import { METHODS, type MethodKey } from '@/tileos/data/takeoff'

const S = () => useStore.getState()
const me = () => meOf(S().role)

export type SurfaceRef = { room: string; surface: string }
export const refKey = (r: SurfaceRef) => `${r.room}|${r.surface}`

/** the next free tag on a project — T-1, T-2… (or T-01 if the project's tags are written that way) */
export function nextTag(jobId: string): string {
  const tags = Object.keys(S().tiles[jobId] || {})
  const nums = tags.map((t) => Number((t.match(/(\d+)\s*$/) || [])[1] || 0))
  const n = (nums.length ? Math.max(...nums) : 0) + 1
  const lead = tags.find((t) => /^[A-Z]+-?\d/i.test(t))?.match(/^([A-Z]+-?)/i)?.[1] || 'T-'
  const padded = tags.some((t) => /\D0\d$/.test(t))
  return `${lead}${padded ? String(n).padStart(2, '0') : n}`
}

/** add a tile to a project or change one; `on` = the walls and floors it goes on (others that had it are cleared) */
export function saveTile(jobId: string, t: Tile, o: { was?: string; on?: SurfaceRef[] } = {}) {
  const st = S()
  const was = o.was
  const fresh = !was
  st.commit(
    (s) => {
      if (!s.tiles[jobId]) s.tiles[jobId] = {}
      if (was && was !== t.tag) {
        /* the tag changed — move it, and point every wall, order and estimate line on this project at the new tag */
        delete s.tiles[jobId][was]
        ;(s.rooms[jobId] || []).forEach((r) => r.surfaces.forEach((x) => { if (x.tile === was) x.tile = t.tag }))
        s.checks.forEach((c) => { if (c.jobId === jobId && c.tag === was) c.tag = t.tag })
        s.shortages.forEach((c) => { if (c.jobId === jobId && c.tag === was) c.tag = t.tag })
        s.estimates.filter((e) => e.jobId === jobId).forEach((e) => e.revs.forEach((r) => r.lines.forEach((l) => { if (l.tile === was) l.tile = t.tag })))
      }
      s.tiles[jobId][t.tag] = t
      if (o.on) {
        const want = new Set(o.on.map(refKey))
        ;(s.rooms[jobId] || []).forEach((r) =>
          r.surfaces.forEach((x) => {
            const k = refKey({ room: r.name, surface: x.name })
            if (want.has(k)) {
              if (x.tile !== t.tag) {
                x.tile = t.tag
                if (t.grout) x.grout = t.grout
                if (t.joint) x.joint = t.joint
              }
              if (!x.grout && t.grout) x.grout = t.grout
              if (!x.joint && t.joint) x.joint = t.joint
              if (x.state === 'unknown' && /tile not (confirmed|picked)/i.test(x.reason || '')) { x.state = 'ready'; x.reason = undefined }
            } else if (x.tile === t.tag) x.tile = ''
          }),
        )
      }
      const where = o.on?.length ? ` · ${o.on.length} wall${o.on.length === 1 ? '' : 's'} and floors` : ''
      addHist(s, jobId, { who: me(), kind: 'setup', title: fresh ? `Tile added · ${t.tag} ${t.name}${where}` : `Tile changed · ${t.tag} ${t.name}${where}`, detail: [t.size, t.finish, t.maker, t.grout ? `${GROUTS[t.grout]?.name} grout` : ''].filter(Boolean).join(' · ') })
    },
    fresh ? `${t.tag} ${t.name} added` : `${t.tag} ${t.name} saved`,
    { close: true, sub: o.on?.length ? `On ${o.on.length} wall${o.on.length === 1 ? '' : 's'} and floors — the scope and the materials follow.` : 'Pick where it goes from the Scope tab.' },
  )
}

/** a small change to a tile — its picture, its grout, the paperwork's quantity. The walls and floors that had the
 *  tile's old grout follow the new one. */
export function patchTile(jobId: string, tag: string, p: Partial<Tile>, msg?: string) {
  S().commit((s) => {
    const t = s.tiles[jobId]?.[tag]
    if (!t) return
    const was = t.grout
    Object.assign(t, p)
    if (p.grout) (s.rooms[jobId] || []).forEach((r) => r.surfaces.forEach((x) => { if (x.tile === tag && (!x.grout || x.grout === was)) x.grout = p.grout }))
    if (p.joint) (s.rooms[jobId] || []).forEach((r) => r.surfaces.forEach((x) => { if (x.tile === tag && !x.joint) x.joint = p.joint }))
  }, msg)
}
/** where a tile goes: these walls and floors get it, any other that had it goes back to "no tile" */
export function setTileOn(jobId: string, tag: string, on: SurfaceRef[]) {
  S().commit((s) => {
    const want = new Set(on.map(refKey))
    const t = s.tiles[jobId]?.[tag]
    ;(s.rooms[jobId] || []).forEach((r) =>
      r.surfaces.forEach((x) => {
        if (want.has(refKey({ room: r.name, surface: x.name }))) {
          if (x.tile !== tag) { x.tile = tag; if (t?.grout) x.grout = t.grout; if (t?.joint) x.joint = t.joint }
          if (x.state === 'unknown' && /tile not (confirmed|picked)/i.test(x.reason || '')) { x.state = 'ready'; x.reason = undefined }
        } else if (x.tile === tag) x.tile = ''
      }),
    )
  })
}

/** a grout named on paperwork, as one of ours (a new one is added to the company's list) */
function groutKeyFor(s: { rules: { grouts?: Record<string, Grout> } }, name: string): string {
  const n = name.toLowerCase().replace(/\b(grout|sanded|unsanded|epoxy|color)\b/g, '').replace(/\s+/g, ' ').trim()
  const hit = Object.entries(GROUTS).find(([, g]) => g.name.toLowerCase() === n) || Object.entries(GROUTS).find(([, g]) => n && n.includes(g.name.toLowerCase()))
  if (hit) return hit[0]
  const key = 'g-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const g: Grout = { name: name.replace(/\s*grout\s*$/i, ''), color: guessColor(name) }
  GROUTS[key] = g
  s.rules.grouts = { ...(s.rules.grouts || {}), [key]: g }
  return key
}
const jointOf = (j: string) => JOINTS.find((x) => x.replace(/[^\d/]/g, '') === j.replace(/[^\d/]/g, '')) || j

/** what was read off the tile paperwork goes onto the project in one go: new tiles added, known ones filled in, the
 *  walls and floors pointed at their tile, and the paperwork's quantity kept for the check */
export function applyRead(jobId: string, picks: ReadTile[], o: { file?: string } = {}) {
  let added = 0
  let placed = 0
  S().commit(
    (s) => {
      const mine = (s.tiles[jobId] ||= {})
      const taken = new Set(Object.keys(mine))
      const next = () => {
        const lead = [...taken].find((t) => /^[A-Z]+-?\d/i.test(t))?.match(/^([A-Z]+-?)/i)?.[1] || 'T-'
        let n = Math.max(0, ...[...taken].map((t) => Number((t.match(/(\d+)\s*$/) || [])[1] || 0))) + 1
        while (taken.has(`${lead}${n}`)) n++
        return `${lead}${n}`
      }
      for (const p of picks) {
        const same = (p.tag && mine[p.tag]) || Object.values(mine).find((t) => t.name.toLowerCase() === p.name.toLowerCase())
        const tag = same ? same.tag : p.tag && !taken.has(p.tag) ? p.tag : next()
        taken.add(tag)
        const base: Tile = same ? { ...same } : { tag, name: p.name, size: '', finish: '', maker: '', supplier: '', suppliedBy: 'GC', sku: '' }
        const t: Tile = {
          ...base,
          name: p.name || base.name,
          ...(p.size ? { size: p.size } : {}), ...(p.finish ? { finish: p.finish } : {}), ...(p.maker ? { maker: p.maker } : {}), ...(p.supplier ? { supplier: p.supplier } : {}),
          ...(p.grout ? { grout: groutKeyFor(s, p.grout) } : {}), ...(p.joint ? { joint: jointOf(p.joint) } : {}), ...(p.boxSF ? { boxSF: p.boxSF } : {}),
          ...(p.qty ? { paper: { qty: p.qty, unit: p.unit || 'SF' } } : {}), ...(p.note && !base.note ? { note: p.note } : {}),
        }
        mine[tag] = t
        if (!same) added++
        p.goesOn.forEach((label) => {
          const [room, surface] = label.split(' · ')
          const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
          if (!x) return
          x.tile = tag
          if (t.grout) x.grout = t.grout
          if (t.joint) x.joint = t.joint
          if (x.state === 'unknown' && /tile not (confirmed|picked)/i.test(x.reason || '')) { x.state = 'ready'; x.reason = undefined }
          placed++
        })
      }
      addHist(s, jobId, { who: me(), kind: 'setup', title: `Read from the tile paperwork${o.file ? ` · ${o.file}` : ''}`, detail: `${picks.length} tile${picks.length === 1 ? '' : 's'} (${added} new) · ${placed} wall${placed === 1 ? '' : 's'} and floors matched` })
    },
    `Read from the paperwork — ${picks.length} tile${picks.length === 1 ? '' : 's'}`,
    { sub: `${placed} wall${placed === 1 ? '' : 's'} and floors matched. Check the quantities below.` },
  )
}

/** take a tile off a project — the walls and floors that had it go back to "no tile" */
export function removeTile(jobId: string, tag: string) {
  const name = S().tiles[jobId]?.[tag]?.name || ''
  S().commit(
    (s) => {
      if (s.tiles[jobId]) delete s.tiles[jobId][tag]
      ;(s.rooms[jobId] || []).forEach((r) => r.surfaces.forEach((x) => { if (x.tile === tag) x.tile = '' }))
      addHist(s, jobId, { who: me(), kind: 'setup', title: `Tile removed · ${tag} ${name}` })
    },
    `${tag} removed`,
    { close: true },
  )
}

export type SurfaceEdit = Partial<Pick<Surface, 'tile' | 'grout' | 'joint' | 'layout' | 'method' | 'edge' | 'height' | 'sf' | 'notes'>>
const LABEL: Record<keyof SurfaceEdit, string> = { tile: 'Tile', grout: 'Grout', joint: 'Joint', layout: 'Layout', method: 'Under it', edge: 'Edge', height: 'Height', sf: 'SF', notes: 'Note' }
const shown = (k: keyof SurfaceEdit, v: any) => (v === undefined || v === '' || v === null ? '—' : k === 'grout' ? GROUTS[v]?.name || v : k === 'method' ? METHODS[v as MethodKey]?.short || v : k === 'sf' ? `${v} SF` : String(v))

/** save what changed on one wall or floor, in one go */
export function saveSurface(jobId: string, room: string, surface: string, p: SurfaceEdit) {
  const x0 = S().rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
  if (!x0) return
  const changed = (Object.keys(p) as (keyof SurfaceEdit)[]).filter((k) => (p[k] ?? '') !== ((x0 as any)[k] ?? ''))
  if (!changed.length) {
    S().close()
    return
  }
  S().commit(
    (s) => {
      const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
      if (!x) return
      changed.forEach((k) => {
        const v = p[k]
        if (v === undefined || v === '' || (k === 'sf' && !v)) delete (x as any)[k]
        else (x as any)[k] = v
      })
      if (x.tile === undefined) x.tile = ''
      if (changed.includes('tile') && x.tile && x.state === 'unknown' && /tile not (confirmed|picked)/i.test(x.reason || '')) { x.state = 'ready'; x.reason = undefined }
      /* the room's progress follows the square feet */
      addHist(s, jobId, {
        who: me(),
        kind: 'setup',
        title: `${room} · ${surface.toLowerCase()} — ${changed.map((k) => LABEL[k].toLowerCase()).join(', ')}`,
        detail: changed.map((k) => `${LABEL[k]}: ${shown(k, (x0 as any)[k])} → ${shown(k, p[k])}`).join(' · '),
      })
    },
    `${room} · ${surface} saved`,
    { close: true, sub: changed.some((k) => ['tile', 'method', 'sf', 'edge'].includes(k)) ? 'The materials and the scope of work follow by themselves.' : undefined },
  )
}

/** a grout color the company uses that isn't on the list yet */
export function addGrout(name: string): string {
  const key = 'g-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (GROUTS[key]) return key
  const g: Grout = { name, color: guessColor(name) }
  GROUTS[key] = g
  S().commit((s) => { s.rules.grouts = { ...(s.rules.grouts || {}), [key]: g } })
  return key
}
/** a sensible color from the grout's name, so the dot looks about right */
function guessColor(name: string) {
  const n = name.toLowerCase()
  const pairs: [RegExp, string][] = [[/black|ebony|onyx/, '#2a2b2d'], [/charcoal|graphite|iron|slate/, '#4d4f52'], [/pewter|gray|grey|smoke|ash/, '#9a9a96'], [/silver|platinum|mist/, '#c3c5c6'], [/brown|mocha|walnut|chocolate|coffee/, '#76604d'], [/sand|beige|tan|khaki|camel/, '#d4c09e'], [/bone|cream|ivory|linen|biscuit/, '#e4dac6'], [/white|snow|frost|avalanche|arctic/, '#f1f1ee'], [/blue|navy/, '#5b6f8f'], [/green|sage/, '#8a9a7f']]
  return pairs.find(([rx]) => rx.test(n))?.[1] || '#c9c4bb'
}

/** a picture of a tile, made small enough to keep with the project (about 30 KB), and its average color
 *  (the layout drawing paints the tile in it) */
export function readPhoto(file: File, max = 480): Promise<{ photo: string; color: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * k))
      c.height = Math.max(1, Math.round(img.height * k))
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      let color = '#e9e5de'
      try {
        const d = g.getImageData(0, 0, c.width, c.height).data
        let r = 0, gg = 0, b = 0, n = 0
        for (let i = 0; i < d.length; i += 16) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++ }
        const hx = (v: number) => Math.round(v / n).toString(16).padStart(2, '0')
        if (n) color = `#${hx(r)}${hx(gg)}${hx(b)}`
      } catch { /* a picture from another site can't be read back — keep the neutral color */ }
      resolve({ photo: c.toDataURL('image/jpeg', 0.8), color })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file isn’t a picture we can read.')) }
    img.src = url
  })
}

/* ---------------- the choices the windows offer ---------------- */
export const TILE_SIZES = ['1 × 1 mosaic', '2″ hex', '2 × 2 mosaic', '3 × 6', '3 × 12', '4 × 4', '4 × 12', '2 × 8', '6 × 6', '6 × 24', '8 × 8', '8 × 48', '12 × 12', '12 × 24', '24 × 24', '24 × 48', '32 × 32', '48 × 48', '48 × 96 slab']
export const FINISHES = ['Matte', 'Honed', 'Polished', 'Gloss', 'Textured', 'Lappato']
export const WHO_ORDERS: { key: string; label: string }[] = [{ key: 'GC', label: 'The GC' }, { key: 'Us', label: 'Us' }, { key: 'Owner', label: 'The owner' }]
export const PATTERNS = ['Straight lay', 'Offset ½', 'Offset ⅓', 'Vertical stack', 'Herringbone', 'Diagonal', 'Basketweave', 'Pitched to the drain', 'Field tile · mitered edges']
export const STARTS = ['Best start — no slivers', 'Centered', 'Full tile at the door', 'Full tile at the doorway', 'Full tile at the floor', 'From the top', 'Centered on the niche', 'Centered on the tub', 'Centered on the window', 'Long side to the door']
export const EDGES = ['Schluter JOLLY · satin brass · 10 mm', 'Schluter JOLLY · brushed nickel · 10 mm', 'Schluter JOLLY · matte black · 10 mm', 'Schluter JOLLY · aluminum · 10 mm', 'Schluter RONDEC · brushed stainless', 'Mitered', 'Bullnose tile', 'Pencil liner', 'Marble saddle at the door', 'Flush to the wood floor', 'Metal transition strip']
export const HEIGHTS = ['To the ceiling', '96″', '84″', '84″ · metal edge on top', '72″', '60″', '48″ wainscot', '42″ wainscot', '36″', '18″ backsplash', '4″ base']

/** a layout reads "Vertical stack · full tile at the doorway" — split it into the pattern and where it starts */
export function splitLayout(layout?: string): { pattern: string; start: string } {
  if (!layout) return { pattern: '', start: '' }
  const [first, ...rest] = layout.split(' · ')
  const start = rest.join(' · ')
  const known = PATTERNS.find((p) => p.toLowerCase() === first.toLowerCase())
  if (known) return { pattern: known, start }
  if (/1\/2|½/i.test(first)) return { pattern: 'Offset ½', start }
  if (/1\/3|⅓/i.test(first)) return { pattern: 'Offset ⅓', start }
  if (/^straight|^stack/i.test(first)) return { pattern: 'Straight lay', start }
  if (/^vertical/i.test(first)) return { pattern: 'Vertical stack', start }
  return { pattern: first, start }
}
export const joinLayout = (pattern: string, start: string) => [pattern, start ? start.charAt(0).toLowerCase() + start.slice(1) : ''].filter(Boolean).join(' · ')
/** is the edge a metal profile (it goes on the materials order) */
export const isMetal = (edge?: string) => !!edge && /jolly|rondec|schluter|metal|profile|strip/i.test(edge)
