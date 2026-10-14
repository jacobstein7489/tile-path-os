/* Material takeoff — the system works out what we have to buy, straight from the scope.
 * Every wall and floor knows its square feet, its tile and how it's set (mud bed, membrane, board and
 * waterproofing…). Coverage numbers are company rules (Settings → Material numbers). What's already ordered
 * or on site comes from our POs and delivery records, so "to order" is only what's really missing. */
import type { Store } from '@/tileos/store'
import { type Surface, tileOf } from '@/tileos/data/jobs'
import { METHODS, MAT_RULES0, type MatRules, type MethodKey, type SurfKind } from '@/tileos/data/takeoff'

export type Group = 'Floor prep' | 'Walls and waterproofing' | 'Setting and grout' | 'Metal edges'
export const GROUPS: Group[] = ['Floor prep', 'Walls and waterproofing', 'Setting and grout', 'Metal edges']
const GROUP_OF: Record<string, Group> = {
  'm-sand': 'Floor prep', 'm-portland': 'Floor prep', 'm-slu': 'Floor prep', 'm-primer': 'Floor prep', 'm-membrane': 'Floor prep', 'm-liner': 'Floor prep',
  'm-board': 'Walls and waterproofing', 'm-screws': 'Walls and waterproofing', 'm-tape': 'Walls and waterproofing', 'm-wp': 'Walls and waterproofing', 'm-foam': 'Walls and waterproofing', 'm-skim': 'Walls and waterproofing',
  'm-thinset': 'Setting and grout', 'm-grout': 'Setting and grout', 'm-clips': 'Setting and grout',
  'm-jolly': 'Metal edges', 'm-trim': 'Metal edges', 'm-edge': 'Metal edges',
}
/** the same material under another name on an older PO */
const ALIAS: Record<string, string> = { 'm-versa': 'm-thinset' }
/** counted as is — no extra added */
const EXACT = new Set(['m-liner', 'm-jolly', 'm-trim', 'm-edge'])

/* ---------------- reading a surface ---------------- */
export function kindOf(x: Surface): SurfKind {
  const n = x.name.toLowerCase()
  if (/shower floor|shower pan/.test(n)) return 'shower-floor'
  if (/floor|hearth|step|landing|curb|threshold|field/.test(n)) return 'floor'
  return 'wall'
}
function fromPrep(prep: string, k: SurfKind): MethodKey | undefined {
  if (/waterproof/i.test(prep)) return k === 'wall' ? 'cbuwp' : undefined
  if (/cement board/i.test(prep)) return 'cbu'
  if (/uncoupling/i.test(prep)) return 'membrane'
  if (/mud/i.test(prep)) return k === 'shower-floor' ? 'mudpan' : 'mud'
  if (/self-level/i.test(prep)) return 'slu'
  if (/foam/i.test(prep)) return 'foam'
  if (/skim/i.test(prep)) return 'skim'
  return undefined
}
/** what the system suggests when nobody said how it's set */
export function suggestMethod(room: string, x: Surface): MethodKey {
  const k = kindOf(x)
  if (k === 'shower-floor') return 'mudpan'
  if (k === 'floor') return /bath|powder|laundry/i.test(room) && !/curb/i.test(x.name) ? 'mud' : 'slab'
  return /shower|tub|niche/i.test(x.name) ? 'cbuwp' : 'drywall'
}
export function methodOf(room: string, x: Surface): { key: MethodKey; auto: boolean } {
  if (x.method && METHODS[x.method as MethodKey]) return { key: x.method as MethodKey, auto: false }
  const p = x.prep ? fromPrep(x.prep, kindOf(x)) : undefined
  if (p) return { key: p, auto: false }
  return { key: suggestMethod(room, x), auto: true }
}
export const methodsFor = (x: Surface) => (Object.keys(METHODS) as MethodKey[]).filter((k) => METHODS[k].kinds.includes(kindOf(x)))

function dims(jobId: string, tag: string): [number, number] {
  const t = tileOf(jobId, tag)
  if (!t) return [12, 12]
  const m = t.size.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/)
  if (m) return [Number(m[1]), Number(m[2])]
  const d = Number(t.size.match(/(\d+)/)?.[1] || 2)
  return [d, d]
}
const JOINTS: Record<string, number> = { '1/32': 1 / 32, '1/16': 1 / 16, '1/8': 1 / 8, '3/16': 3 / 16, '1/4': 1 / 4 }
function joint(x: Surface, k: SurfKind): [number, string] {
  const j = x.joint?.match(/(\d+\/\d+)/)?.[1]
  if (j && JOINTS[j]) return [JOINTS[j], `${j}″`]
  return k === 'wall' ? [1 / 16, '1/16″'] : [1 / 8, '1/8″']
}
function heightFt(h?: string): number | null {
  if (!h || /ceiling|full height/i.test(h)) return null
  const ft = h.match(/(\d+(?:\.\d+)?)\s*ft/)
  if (ft) return Number(ft[1])
  const inch = h.match(/(\d+)\s*″/)
  return inch ? Number(inch[1]) / 12 : null
}
/** metal edges: an 8 ft piece per vertical edge that runs to the ceiling, or enough to cap a wall that stops short */
function metalOf(x: Surface): { itemId: string; pcs: number; note: string } | null {
  if (!x.edge || !/jolly|trim|metal/i.test(x.edge)) return null
  const itemId = /brass/i.test(x.edge) ? 'm-jolly' : /nickel/i.test(x.edge) ? 'm-trim' : 'm-edge'
  const corners = Number((x.notes || '').match(/(\d+)\s*corners/)?.[1] || 0)
  if (corners) return { itemId, pcs: corners, note: `${corners} outside corners` }
  const h = heightFt(x.height)
  if (h && x.sf) {
    const lf = x.sf / h
    return { itemId, pcs: Math.ceil(lf / 8), note: `Cap on top · about ${Math.round(lf)} LF` }
  }
  return { itemId, pcs: 1, note: 'Outside edge, floor to ceiling' }
}

/* ---------------- the takeoff ---------------- */
export interface Use { room: string; surface: string; sf: number; raw: number; note: string }
export interface TakeLine { itemId: string; group: Group; raw: number; need: number; have: number; onSite: number; toOrder: number; uses: Use[]; refs: string[] }
export interface Takeoff { lines: TakeLine[]; skipped: { room: string; surface: string; why: string }[]; sf: number; counted: number; total: number; rules: MatRules }

export function takeoff(s: Pick<Store, 'rooms' | 'pos' | 'mats' | 'rules'>, jobId: string): Takeoff {
  const R: MatRules = { ...MAT_RULES0, ...(s.rules?.mat || {}) }
  const w = 1 + R.waste / 100
  const rooms = s.rooms[jobId] || []
  const acc: Record<string, { raw: number; uses: Use[] }> = {}
  const add = (itemId: string, raw: number, use: Omit<Use, 'raw'>) => {
    if (!(raw > 0)) return
    const a = (acc[itemId] ||= { raw: 0, uses: [] })
    a.raw += raw
    a.uses.push({ ...use, raw })
  }
  const skipped: Takeoff['skipped'] = []
  let sf = 0
  let counted = 0
  let total = 0
  for (const r of rooms) {
    for (const x of r.surfaces) {
      total++
      if (!x.sf) { skipped.push({ room: r.name, surface: x.name, why: 'No square feet yet' }); continue }
      if (!x.tile) { skipped.push({ room: r.name, surface: x.name, why: 'No tile picked yet' }); continue }
      if (x.state === 'unknown' && /tile not confirmed/i.test(x.reason || '')) { skipped.push({ room: r.name, surface: x.name, why: 'Tile not confirmed yet' }); continue }
      counted++
      sf += x.sf
      const k = kindOf(x)
      const m = methodOf(r.name, x).key
      const [L, W] = dims(jobId, x.tile)
      const big = Math.max(L, W)
      const size = tileOf(jobId, x.tile)?.size || ''
      const base = { room: r.name, surface: x.name, sf: x.sf }
      /* thinset for the tile, by tile size */
      const cov = big <= 8 ? R.thinSmall : big <= 15 ? R.thinMed : R.thinLarge
      add('m-thinset', x.sf / cov, { ...base, note: `${x.sf} SF of ${size} tile ÷ ${cov} SF a bag` })
      /* grout from the joint: width × tile thickness × joint length */
      const [J, jl] = joint(x, k)
      const T = big >= 16 ? 0.375 : big >= 6 ? 0.3125 : 0.25
      /* 12 ≈ grout weight per cubic inch × 144, with the mixing loss the grout makers' charts include */
      const lb = x.sf * ((L + W) / (L * W)) * J * T * 12
      add('m-grout', lb / 25, { ...base, note: `${size} tile with a ${jl} joint → ${lb < 10 ? lb.toFixed(1) : Math.round(lb)} lb` })
      /* what's under it */
      if (m === 'mud' || m === 'mudpan') {
        const inch = m === 'mud' ? R.mudIn : R.panIn
        add('m-sand', (x.sf / 100) * inch * R.sand, { ...base, note: `${x.sf} SF × ${inch}″ of mud × ${R.sand} bags per 100 SF an inch` })
        add('m-portland', (x.sf / 100) * inch * R.portland, { ...base, note: `${x.sf} SF × ${inch}″ of mud × ${R.portland} bags per 100 SF an inch` })
        if (m === 'mud') add('m-mesh', x.sf / (R.mesh || 18), { ...base, note: `${x.sf} SF ÷ ${R.mesh || 18} SF a sheet of mesh` })
        if (m === 'mudpan') add('m-liner', 1, { ...base, note: 'One liner for the shower' })
      }
      if (m === 'slu') {
        add('m-slu', x.sf / R.slu, { ...base, note: `${x.sf} SF ÷ ${R.slu} SF a bag at ¼″` })
        add('m-primer', x.sf / R.primer, { ...base, note: `${x.sf} SF ÷ ${R.primer} SF a gallon` })
      }
      if (m === 'membrane') {
        add('m-membrane', x.sf / R.roll, { ...base, note: `${x.sf} SF ÷ ${R.roll} SF a roll` })
        add('m-thinset', x.sf / R.thinBond, { ...base, note: `Setting the membrane · ${x.sf} SF ÷ ${R.thinBond} SF a bag` })
      }
      if (m === 'cbuwp' || m === 'cbu') {
        const sheets = x.sf / R.board
        add('m-board', sheets, { ...base, note: `${x.sf} SF ÷ ${R.board} SF a sheet` })
        add('m-screws', sheets / 12, { ...base, note: 'A box for every 12 sheets' })
        add('m-tape', x.sf / 300, { ...base, note: 'A roll for every 300 SF' })
        if (m === 'cbuwp') add('m-wp', x.sf / R.wp, { ...base, note: `${x.sf} SF ÷ ${R.wp} SF a pail, 2 coats` })
      }
      if (m === 'foam') add('m-foam', x.sf / R.foam, { ...base, note: `${x.sf} SF ÷ ${R.foam} SF a sheet` })
      if (m === 'skim') add('m-skim', x.sf / R.skim, { ...base, note: `${x.sf} SF ÷ ${R.skim} SF a bag` })
      /* large format gets leveling clips */
      if (big >= 24) {
        const clips = x.sf * (144 / (L * W)) * 3
        add('m-clips', clips / 250, { ...base, note: `About ${Math.round(clips)} clips · 3 a tile` })
      }
      const metal = metalOf(x)
      if (metal) add(metal.itemId, metal.pcs, { ...base, note: metal.note })
    }
  }

  /* what we already have: our POs, then delivery records without a PO */
  const cover: Record<string, { have: number; onSite: number; refs: string[] }> = {}
  const put = (id0: string, have: number, onSite: number, ref: string) => {
    const id = ALIAS[id0] || id0
    const c = (cover[id] ||= { have: 0, onSite: 0, refs: [] })
    c.have += have
    c.onSite += onSite
    if (!c.refs.includes(ref)) c.refs.push(ref)
  }
  s.pos.filter((p) => p.jobId === jobId && p.step >= 1 && !/cancel/i.test(p.note)).forEach((p) => {
    const got = p.note.match(/(\d+) of (\d+) received/)
    p.lines.forEach((l) => {
      if (!l.itemId || !l.n) return
      const here = p.step >= 3 ? l.n : got ? Math.min(l.n, Number(got[1])) : 0
      put(l.itemId, l.n, here, p.id)
    })
  })
  let all: { onSite: boolean; ref: string } | null = null
  const scoped: { rooms: Set<string> | null; items: Set<string> | null; onSite: boolean; ref: string }[] = []
  s.mats.filter((m) => m.jobId === jobId && !m.po && !['to-order', 'suggested'].includes(m.status)).forEach((m) => {
    const here = m.status === 'delivered'
    if (m.itemId && m.n) put(m.itemId, m.n, here ? m.n : 0, m.name)
    else if (m.rooms === 'all' && !m.items) all = { onSite: here, ref: m.name }
    else if (m.rooms || m.items) scoped.push({ rooms: m.rooms && m.rooms !== 'all' ? new Set(m.rooms.map((r) => r.toLowerCase())) : null, items: m.items ? new Set(m.items) : null, onSite: here, ref: m.name })
  })

  const lines: TakeLine[] = Object.entries(acc).map(([itemId, a]) => {
    const need = EXACT.has(itemId) ? Math.ceil(a.raw - 1e-9) : Math.ceil(a.raw * w - 1e-9)
    const c = cover[itemId] || { have: 0, onSite: 0, refs: [] }
    let have = c.have
    let onSite = c.onSite
    const refs = [...c.refs]
    scoped.forEach((sc) => {
      if (sc.items && !sc.items.has(itemId)) return
      const raw = a.uses.filter((u) => !sc.rooms || sc.rooms.has(u.room.toLowerCase())).reduce((n, u) => n + u.raw, 0)
      if (!raw) return
      const q = EXACT.has(itemId) ? Math.ceil(raw - 1e-9) : Math.ceil(raw * w - 1e-9)
      have += q
      if (sc.onSite) onSite += q
      if (!refs.includes(sc.ref)) refs.push(sc.ref)
    })
    if (all) {
      const a0 = all as { onSite: boolean; ref: string }
      have = Math.max(have, need)
      if (a0.onSite) onSite = Math.max(onSite, need)
      if (!refs.includes(a0.ref)) refs.push(a0.ref)
    }
    return { itemId, group: GROUP_OF[itemId] || 'Setting and grout', raw: a.raw, need, have, onSite: Math.min(onSite, have), toOrder: Math.max(0, need - have), uses: a.uses, refs }
  })
  const order = (id: string) => Object.keys(GROUP_OF).indexOf(id)
  lines.sort((a, b) => GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || order(a.itemId) - order(b.itemId))
  return { lines, skipped, sf, counted, total, rules: R }
}

/** "102 bags", "1 box", "15 sheets" */
export function qtyLabel(n: number, unit: string) {
  if (unit === 'LS') return `${n}`
  const plural = n === 1 ? unit : unit === 'box' ? 'boxes' : unit === 'pc' ? 'pcs' : unit + 's'
  return `${n.toLocaleString('en-US')} ${plural}`
}

/** where a project stands on our materials — one answer for the Game plan, the Now panel and the Orders tab */
export type MatState = { state: 'yes' | 'no' | 'part' | 'wait'; label: string; hint: string; go: 'order' | 'orders' | 'scope' }
export function materialStatus(s: Pick<Store, 'rooms' | 'pos' | 'mats' | 'rules' | 'items'>, jobId: string): MatState {
  const t = takeoff(s, jobId)
  const name = (id: string) => (s.items.find((i) => i.id === id)?.name || id).split(' ·')[0].replace(' 3×5', '')
  if (!t.total) return { state: 'no', label: 'No scope', hint: 'Build the rooms first — the materials calculate from them', go: 'scope' }
  if (!t.counted) return { state: 'no', label: 'Add SF', hint: 'Add square feet to the scope and the materials calculate by themselves', go: 'scope' }
  const miss = t.lines.filter((l) => l.toOrder > 0)
  if (miss.length) {
    const names = miss.slice(0, 3).map((l) => name(l.itemId).toLowerCase())
    return { state: t.lines.some((l) => l.have > 0) ? 'part' : 'no', label: `${miss.length} to order`, hint: `${names.join(', ')}${miss.length > 3 ? ` and ${miss.length - 3} more` : ''} — worked out from the scope`, go: 'order' }
  }
  const coming = t.lines.filter((l) => l.onSite < l.need)
  if (coming.length) {
    const refs = Array.from(new Set(coming.flatMap((l) => l.refs))).slice(0, 2)
    return { state: 'wait', label: 'Ordered', hint: `${refs.join(', ')} — on the way`, go: 'orders' }
  }
  return { state: 'yes', label: 'On site', hint: 'Everything the scope needs is on site', go: 'orders' }
}
