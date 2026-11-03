/* The lists to pick from, so nobody has to type a product name:
 *   Metals    — every Schluter edge profile, in every finish (color) and size, by the piece
 *   Setting   — the thinsets (Laticrete 253 Gold, 254 Platinum…), grouts and waterproofing a tile job uses
 * Picking one the first time adds it to the company's Items (no price yet — the first PO says what we paid). */
import type { Item } from './items'

/* ---------------- metals ---------------- */
export type MetalProfile = { key: string; name: string; short: string; use: string; sizes: number[] }
export const METAL_PROFILES: MetalProfile[] = [
  { key: 'jolly', name: 'Schluter JOLLY', short: 'JOLLY', use: 'Wall edges and outside corners — square L-angle', sizes: [4.5, 6, 8, 10, 11, 12.5, 15] },
  { key: 'rondec', name: 'Schluter RONDEC', short: 'RONDEC', use: 'Rounded edge — walls, outside corners, niches', sizes: [6, 8, 10, 12.5] },
  { key: 'quadec', name: 'Schluter QUADEC', short: 'QUADEC', use: 'Square edge — walls, outside corners, niches', sizes: [6, 8, 10, 12.5] },
  { key: 'finec', name: 'Schluter FINEC', short: 'FINEC', use: 'Slim, minimal edge', sizes: [8, 10, 12.5] },
  { key: 'schiene', name: 'Schluter SCHIENE', short: 'SCHIENE', use: 'Floor edges', sizes: [3, 4.5, 6, 8, 10, 11, 12.5, 15] },
  { key: 'reno-t', name: 'Schluter RENO-T', short: 'RENO-T', use: 'T-transition between two floors at the same height', sizes: [6, 8, 10, 12.5] },
  { key: 'reno-u', name: 'Schluter RENO-U', short: 'RENO-U', use: 'Tile down to a lower floor', sizes: [6, 8, 10, 12.5] },
  { key: 'dilex-eke', name: 'Schluter DILEX-EKE', short: 'DILEX-EKE', use: 'Inside corners — where two walls meet', sizes: [8, 10, 12.5] },
]
export type MetalFinish = { key: string; name: string; group: 'Metallic' | 'Stainless steel' | 'Colors' | 'Textured'; color: string }
export const METAL_FINISHES: MetalFinish[] = [
  { key: 'satin-aluminum', name: 'Satin anodized aluminum', group: 'Metallic', color: '#c9ccd0' },
  { key: 'brushed-nickel', name: 'Brushed nickel', group: 'Metallic', color: '#b6b1a7' },
  { key: 'satin-nickel', name: 'Satin nickel', group: 'Metallic', color: '#c2beb5' },
  { key: 'polished-nickel', name: 'Polished nickel', group: 'Metallic', color: '#d9d5cd' },
  { key: 'brushed-chrome', name: 'Brushed chrome', group: 'Metallic', color: '#c3c7cb' },
  { key: 'polished-chrome', name: 'Polished chrome', group: 'Metallic', color: '#e1e5e9' },
  { key: 'satin-brass', name: 'Satin brass', group: 'Metallic', color: '#c8a85f' },
  { key: 'brushed-brass', name: 'Brushed brass', group: 'Metallic', color: '#bf9d57' },
  { key: 'polished-brass', name: 'Polished brass', group: 'Metallic', color: '#d9b65b' },
  { key: 'brushed-copper', name: 'Brushed copper', group: 'Metallic', color: '#b57552' },
  { key: 'satin-copper', name: 'Satin copper', group: 'Metallic', color: '#c08466' },
  { key: 'antique-bronze', name: 'Brushed antique bronze', group: 'Metallic', color: '#7b6247' },
  { key: 'chrome-brass', name: 'Chrome-plated solid brass', group: 'Metallic', color: '#dce0e4' },
  { key: 'brushed-stainless', name: 'Brushed stainless steel', group: 'Stainless steel', color: '#b7bbbf' },
  { key: 'stainless', name: 'Stainless steel', group: 'Stainless steel', color: '#c8ccd0' },
  { key: 'matte-black', name: 'Matte black', group: 'Colors', color: '#2a2a2b' },
  { key: 'bright-white', name: 'Bright white', group: 'Colors', color: '#f7f7f4' },
  { key: 'classic-grey', name: 'Classic grey', group: 'Colors', color: '#8d8f92' },
  { key: 'metallic-grey', name: 'Metallic grey', group: 'Colors', color: '#7c7f83' },
  { key: 'sand', name: 'Sand', group: 'Colors', color: '#cdbb97' },
  { key: 'black-brown', name: 'Black brown', group: 'Colors', color: '#3a2f29' },
  { key: 'pewter', name: 'Pewter (textured)', group: 'Textured', color: '#8a877f' },
  { key: 'greige', name: 'Greige (textured)', group: 'Textured', color: '#a49c8f' },
  { key: 'stone-grey', name: 'Stone grey (textured)', group: 'Textured', color: '#9a9a95' },
  { key: 'bronze', name: 'Bronze (textured)', group: 'Textured', color: '#6e5942' },
  { key: 'light-anthracite', name: 'Light anthracite (textured)', group: 'Textured', color: '#5d5f61' },
  { key: 'dark-anthracite', name: 'Dark anthracite (textured)', group: 'Textured', color: '#3c3e40' },
]
export const FINISH_GROUPS: MetalFinish['group'][] = ['Metallic', 'Stainless steel', 'Colors', 'Textured']
/** how it comes: a length (8′ 2½″), or a corner or end piece */
export const METAL_PIECES = ['Length · 8′ 2½″', 'Outside corner', 'Inside corner', 'End cap']
const INCH: Record<string, string> = { '3': '1/8″', '4.5': '3/16″', '6': '1/4″', '8': '5/16″', '10': '3/8″', '11': '7/16″', '12.5': '1/2″', '15': '9/16″' }
/** "10 mm (3/8″)" */
export const sizeLabel = (mm: number) => `${mm} mm${INCH[String(mm)] ? ` (${INCH[String(mm)]})` : ''}`

export type MetalSpec = { profile: string; finish: string; size?: number; piece?: string }
export const profileOf = (k?: string) => METAL_PROFILES.find((p) => p.key === k)
export const finishOf = (k?: string) => METAL_FINISHES.find((f) => f.key === k)
/** "Schluter JOLLY · Brushed nickel · 10 mm (3/8″)" — and the piece, when it isn't a length */
export function metalText(m: MetalSpec, o: { piece?: boolean } = {}) {
  const p = profileOf(m.profile)
  const f = finishOf(m.finish)
  return [p?.name || m.profile, f?.name || m.finish, m.size ? sizeLabel(m.size) : '', o.piece && m.piece && !/^length/i.test(m.piece) ? m.piece : ''].filter(Boolean).join(' · ')
}
/* the words older entries and the paperwork use for a finish */
const FINISH_WORDS: [RegExp, string][] = [
  [/antique\s*bronze/i, 'antique-bronze'], [/polished\s*chrome/i, 'polished-chrome'], [/brushed\s*chrome/i, 'brushed-chrome'], [/chrome.?plated/i, 'chrome-brass'],
  [/polished\s*nickel/i, 'polished-nickel'], [/satin\s*nickel/i, 'satin-nickel'], [/nickel/i, 'brushed-nickel'],
  [/polished\s*brass/i, 'polished-brass'], [/brushed\s*brass/i, 'brushed-brass'], [/brass|gold/i, 'satin-brass'],
  [/satin\s*copper/i, 'satin-copper'], [/copper/i, 'brushed-copper'],
  [/brushed\s*stainless/i, 'brushed-stainless'], [/stainless/i, 'stainless'],
  [/matte?\s*black|black(?!\s*brown)/i, 'matte-black'], [/white/i, 'bright-white'], [/black\s*brown/i, 'black-brown'],
  [/light\s*anthracite/i, 'light-anthracite'], [/anthracite/i, 'dark-anthracite'], [/greige/i, 'greige'], [/pewter/i, 'pewter'], [/stone\s*gr[ae]y/i, 'stone-grey'],
  [/metallic\s*gr[ae]y/i, 'metallic-grey'], [/classic\s*gr[ae]y|gr[ae]y/i, 'classic-grey'], [/sand/i, 'sand'], [/bronze/i, 'bronze'],
  [/alumin/i, 'satin-aluminum'],
]
const MM_OF_INCH: Record<string, number> = { '1/8': 3, '3/16': 4.5, '1/4': 6, '5/16': 8, '3/8': 10, '7/16': 11, '1/2': 12.5, '9/16': 15 }
/** read a metal back from its words — "Schluter JOLLY · satin brass · 10 mm", "RONDEC brushed nickel 3/8" */
export function parseMetal(text?: string): MetalSpec | null {
  if (!text) return null
  const t = text.toLowerCase()
  const p = [...METAL_PROFILES].sort((a, b) => b.short.length - a.short.length).find((x) => t.includes(x.short.toLowerCase()))
  if (!p && !/schluter|metal|profile|trim|strip/i.test(text)) return null
  /* a finish named exactly wins over the words for it */
  const exact = METAL_FINISHES.find((f) => t.includes(f.name.toLowerCase()))
  const finish = exact?.key || FINISH_WORDS.find(([re]) => re.test(text))?.[1] || ''
  const mm = text.match(/(\d+(?:\.\d+)?)\s*mm/i)
  const inch = text.match(/(\d+\/\d+)\s*(?:″|"|in)/i)
  const size = mm ? Number(mm[1]) : inch ? MM_OF_INCH[inch[1]] : undefined
  const piece = /outside corner/i.test(text) ? 'Outside corner' : /inside corner/i.test(text) ? 'Inside corner' : /end cap/i.test(text) ? 'End cap' : undefined
  return { profile: p?.key || '', finish, size, piece }
}
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '')
/** the Items entry for a metal — one per profile, finish, size and piece */
export function metalItem(m: MetalSpec): Item {
  const p = profileOf(m.profile)
  const f = finishOf(m.finish)
  const piece = m.piece || METAL_PIECES[0]
  const corner = !/^length/i.test(piece)
  return {
    id: `m-metal-${slug([m.profile, m.finish, m.size || '', corner ? piece : ''].filter(Boolean).join('-'))}`,
    name: metalText({ ...m, piece }, { piece: true }), type: 'material', unit: corner ? 'ea' : 'pc', price: 0, cost: 0,
    brand: 'Schluter', product: p?.short || m.profile, cat: 'trim', pic: 'trim', tint: f?.color, qb: 'Materials:Metal edge',
    pack: corner ? piece : `8′ 2½″ length${f ? ` · ${f.name.toLowerCase()}` : ''}${m.size ? ` · ${sizeLabel(m.size)}` : ''}`,
    usedFor: p?.use,
  }
}

/* ---------------- edges on a wall or floor: mitered, metal (which one), bullnose… ---------------- */
export type EdgeKind = '' | 'mitered' | 'metal' | 'bullnose' | 'pencil' | 'other'
export const EDGE_KINDS: { key: EdgeKind; label: string }[] = [
  { key: '', label: 'None' }, { key: 'mitered', label: 'Mitered' }, { key: 'metal', label: 'Metal' }, { key: 'bullnose', label: 'Bullnose' }, { key: 'pencil', label: 'Pencil liner' }, { key: 'other', label: 'Other' },
]
export function edgeKind(edge?: string): EdgeKind {
  if (!edge) return ''
  if (/miter/i.test(edge)) return 'mitered'
  if (/bullnose/i.test(edge)) return 'bullnose'
  if (/pencil/i.test(edge)) return 'pencil'
  if (parseMetal(edge)) return 'metal'
  return 'other'
}
/** what the room sheet says: "Mitered", "Metal — Schluter JOLLY · Brushed nickel · 10 mm (3/8″)" */
export function edgeWords(edge?: string) {
  const k = edgeKind(edge)
  if (k === 'metal') { const m = parseMetal(edge)!; return m.profile ? `Metal — ${metalText(m)}` : `Metal — ${edge}` }
  if (k === 'mitered') return 'Mitered'
  return edge || ''
}

/* ---------------- setting materials ---------------- */
type Seed = [id: string, brand: string, product: string, cat: Item['cat'], pack: string, unit: string, usedFor: string, tint?: string]
const SEEDS: Seed[] = [
  ['c-lat-253-gray', 'Laticrete', '253 Gold · gray', 'mortar', '50 lb bag · gray', 'bag', 'Multipurpose — porcelain and ceramic, floors and walls', '#7e868f'],
  ['c-lat-253-white', 'Laticrete', '253 Gold · white', 'mortar', '50 lb bag · white', 'bag', 'Multipurpose — light stone and glass', '#b9bec4'],
  ['c-lat-254-gray', 'Laticrete', '254 Platinum · gray', 'mortar', '50 lb bag · gray', 'bag', 'Premium — porcelain, stone, large format', '#6f7781'],
  ['c-lat-254-white', 'Laticrete', '254 Platinum · white', 'mortar', '50 lb bag · white', 'bag', 'Premium — marble, glass and light stone', '#aab0b8'],
  ['c-lat-254r-gray', 'Laticrete', '254R Platinum Rapid · gray', 'mortar', '50 lb bag · gray', 'bag', 'Fast setting — grout the same day', '#66707a'],
  ['c-lat-254r-white', 'Laticrete', '254R Platinum Rapid · white', 'mortar', '50 lb bag · white', 'bag', 'Fast setting — grout the same day', '#a3a9b1'],
  ['c-lat-255-gray', 'Laticrete', '255 MultiMax · gray', 'mortar', '50 lb bag · gray', 'bag', 'Large and heavy tile — floors and walls, no sag', '#737b85'],
  ['c-lat-255-white', 'Laticrete', '255 MultiMax · white', 'mortar', '50 lb bag · white', 'bag', 'Large and heavy tile — light stone', '#adb3ba'],
  ['c-lat-257-gray', 'Laticrete', '257 Titanium · gray', 'mortar', '50 lb bag · gray', 'bag', 'Large format porcelain and stone', '#5f6872'],
  ['c-lat-257-white', 'Laticrete', '257 Titanium · white', 'mortar', '50 lb bag · white', 'bag', 'Large format marble and glass', '#9fa6ae'],
  ['c-lat-mmlite-gray', 'Laticrete', 'MultiMax Lite · gray', 'mortar', '30 lb bag · gray', 'bag', 'Lightweight — large format on walls', '#86909a'],
  ['c-lat-mmlite-white', 'Laticrete', 'MultiMax Lite · white', 'mortar', '30 lb bag · white', 'bag', 'Lightweight — large format on walls', '#bcc2c8'],
  ['c-lat-4xlt-white', 'Laticrete', '4-XLT · white', 'mortar', '50 lb bag · white', 'bag', 'Large and heavy tile — light stone', '#b3b9c0'],
  ['c-map-uf2-gray', 'Mapei', 'Ultraflex 2 · gray', 'mortar', '50 lb bag · gray', 'bag', 'Polymer-modified — floors and walls', '#6b7280'],
  ['c-map-uf2-white', 'Mapei', 'Ultraflex 2 · white', 'mortar', '50 lb bag · white', 'bag', 'Polymer-modified — light stone and glass', '#a7adb5'],
  ['c-map-uflft-white', 'Mapei', 'Ultraflex LFT · white', 'mortar', '50 lb bag · white', 'bag', 'Large format — light stone', '#a1a8b0'],
  ['c-cbp-versabond-gray', 'Custom Building Products', 'VersaBond · gray', 'mortar', '50 lb bag · gray', 'bag', 'Fortified thinset — floors and walls', '#808892'],
  ['c-cbp-versabond-white', 'Custom Building Products', 'VersaBond · white', 'mortar', '50 lb bag · white', 'bag', 'Fortified thinset — light tile', '#b6bcc3'],
  ['c-cbp-prolite-gray', 'Custom Building Products', 'ProLite · gray', 'mortar', '30 lb bag · gray', 'bag', 'Lightweight — large format', '#8a929c'],
  ['c-lat-permacolor-select', 'Laticrete', 'Permacolor Select', 'grout', '25 lb base + color kit', 'kit', 'Cement grout in any Laticrete color', '#8f7a66'],
  ['c-lat-spectralock-pro', 'Laticrete', 'SpectraLOCK PRO Premium', 'grout', 'Full unit', 'kit', 'Epoxy grout — showers, stain-proof', '#7d6b5a'],
  ['c-map-ultracolor', 'Mapei', 'Ultracolor Plus FA', 'grout', '25 lb bag', 'bag', 'Fast-setting grout for any joint', '#9a8573'],
  ['c-cbp-prism', 'Custom Building Products', 'Prism', 'grout', '17 lb bag', 'bag', 'Even color, no sealing', '#a08b78'],
  ['c-lat-latasil', 'Laticrete', 'Latasil · color matched', 'grout', '10.1 oz tube', 'tube', 'Silicone for corners and changes of plane', '#8c7b6a'],
  ['c-lat-hydroban-1', 'Laticrete', 'Hydro Ban · 1 gal', 'waterproofing', '1 gal pail', 'pail', 'Waterproofing — a niche, a bench, touch-ups', '#3d6fd6'],
  ['c-lat-hydroban-board', 'Laticrete', 'Hydro Ban Board · 4×8 · ½″', 'board', '4 × 8 ft · ½″ board', 'sheet', 'Waterproof board for shower walls', '#4a7ad8'],
  ['c-lat-nxt-level', 'Laticrete', 'NXT Level', 'prep', '50 lb bag', 'bag', 'Self-leveler', '#b8954f'],
]
/** the setting materials anyone can pick — Laticrete first */
export const SETTING_CATALOG: Item[] = SEEDS.map(([id, brand, product, cat, pack, unit, usedFor, tint]) => ({
  id, name: `${brand === 'Custom Building Products' ? 'Custom' : brand} ${product}`, type: 'material', unit, price: 0, cost: 0, brand, product, cat, pic: cat === 'grout' && unit === 'tube' ? 'tube' : cat === 'grout' && unit === 'kit' ? 'kit' : cat === 'waterproofing' ? 'pail' : cat === 'board' ? 'sheet' : 'bag', tint, pack, usedFor, qb: `Materials:${brand} ${product}`.slice(0, 100),
}))
/** what's not in the company's Items yet, from the list */
export const notInItems = (items: Item[]) => SETTING_CATALOG.filter((c) => !items.some((i) => i.id === c.id || i.name.toLowerCase() === c.name.toLowerCase()))
