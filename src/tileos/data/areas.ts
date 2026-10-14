/* The areas and surfaces an estimate starts from — written the way Cobblestone's scope paper reads: a floor, then the
 * rooms on it, then each surface with its quantity. The company keeps its own list (Settings → Checklists); anyone can
 * type a new area or surface on the spot. */
export const FLOORS = ['1st floor', '2nd floor', '3rd floor', 'Attic floor', 'Basement']
/** the proper order of floors on every list and paper — whatever order they were picked in */
export function floorRank(f?: string): number {
  if (!f) return 99
  const i = FLOORS.findIndex((x) => x.toLowerCase() === f.toLowerCase())
  if (i >= 0) return i
  const l = f.toLowerCase()
  return /1st|first|ground|main/.test(l) ? 0 : /2nd|second/.test(l) ? 1 : /3rd|third/.test(l) ? 2 : /4th|fourth/.test(l) ? 2.5 : /attic|roof/.test(l) ? 3 : /basement|cellar|lower/.test(l) ? 4 : 50
}

export interface SurfaceDef { key: string; label: string; itemId: string }
export const SURFACES: SurfaceDef[] = [
  { key: 'floor', label: 'Floor tile', itemId: 'i-floor' },
  { key: 'wall', label: 'Wall tile', itemId: 'i-wall' },
  { key: 'accent', label: 'Accent wall', itemId: 'i-wall' },
  { key: 'splash', label: 'Backsplash', itemId: 'i-splash' },
  { key: 'showerfloor', label: 'Shower floor', itemId: 'i-mosaic' },
  { key: 'tubwalls', label: 'Tub walls', itemId: 'i-wall' },
  { key: 'under', label: 'Underlayment', itemId: 'i-under' },
  { key: 'wp', label: 'Waterproofing', itemId: 'i-wp' },
  { key: 'niche', label: 'Tile niche', itemId: 'i-niche' },
  { key: 'window', label: 'Window wrap', itemId: 'i-window' },
  { key: 'saddle', label: 'Saddle', itemId: 'i-saddle' },
  { key: 'metals', label: 'Metals', itemId: 'i-metal' },
  { key: 'drain', label: 'Linear drain', itemId: 'i-drain' },
  { key: 'skim', label: 'Skim coat', itemId: 'i-skim' },
  { key: 'mud', label: 'Mud bed', itemId: 'i-prep' },
  { key: 'base', label: 'Tile base', itemId: 'i-wall' },
  { key: 'bench', label: 'Shower bench', itemId: 'i-wall' },
  { key: 'kneewall', label: 'Knee wall', itemId: 'i-wall' },
  { key: 'tubapron', label: 'Tub apron', itemId: 'i-wall' },
  { key: 'steps', label: 'Steps', itemId: 'i-floor' },
  { key: 'border', label: 'Border', itemId: 'i-border' },
  { key: 'selflevel', label: 'Self-level', itemId: 'i-prep' },
  { key: 'showerdrain', label: 'Shower drain', itemId: 'i-drain' },
]

export interface AreaPreset { name: string; surfaces: string[]; custom?: boolean }
export const AREA_PRESETS: AreaPreset[] = [
  { name: 'Kitchen', surfaces: ['floor', 'splash'] },
  { name: 'Dining room', surfaces: ['floor', 'under'] },
  { name: 'Family room', surfaces: ['floor', 'under'] },
  { name: 'Living room', surfaces: ['floor', 'under'] },
  { name: 'Foyer / hallway', surfaces: ['floor', 'saddle'] },
  { name: 'Mudroom', surfaces: ['floor'] },
  { name: 'Laundry room', surfaces: ['floor', 'splash', 'saddle'] },
  { name: 'Powder room', surfaces: ['floor', 'wall', 'saddle'] },
  { name: 'Guest shower bathroom', surfaces: ['floor', 'showerfloor', 'wall', 'niche', 'saddle', 'metals', 'wp'] },
  { name: 'Guest tub bathroom', surfaces: ['floor', 'tubwalls', 'niche', 'saddle', 'metals', 'wp'] },
  { name: 'Master bathroom', surfaces: ['floor', 'showerfloor', 'drain', 'wall', 'niche', 'window', 'saddle', 'metals', 'wp'] },
  { name: 'Kids bathroom', surfaces: ['floor', 'tubwalls', 'niche', 'saddle', 'metals', 'wp'] },
  { name: 'Basement', surfaces: ['floor', 'under'] },
  { name: 'Lobby', surfaces: ['floor', 'base'] },
]

/** a surface you typed yourself: priced like the closest thing we have, or left at $0 for the estimator */
export function customSurface(label: string): SurfaceDef {
  const w = label.toLowerCase()
  const itemId = /floor|threshold|step|stair/.test(w) ? 'i-floor'
    : /mosaic|herringbone|pattern|medallion/.test(w) ? 'i-mosaic'
      : /wall|surround|fireplace|splash|wainscot/.test(w) ? 'i-wall'
        : /waterproof|membrane/.test(w) ? 'i-wp'
          : 'o-room'
  return { key: 'c:' + w.replace(/[^a-z0-9]+/g, '-'), label, itemId }
}

/** two Powder rooms become "Powder room" and "Powder room #2", the way the scope paper numbers them */
export function uniqueArea(name: string, taken: string[]) {
  if (!taken.includes(name)) return name
  let n = 2
  while (taken.includes(`${name} #${n}`)) n++
  return `${name} #${n}`
}

/** areas in the proper order: by floor, then the way the company's list reads (Kitchen, Dining room…), then the rest
 *  in the order they were added */
export function sortAreas<T extends { name: string; floor?: string }>(list: T[], presets: string[] = AREA_PRESETS.map((p) => p.name)): T[] {
  const base = (n: string) => n.replace(/ #\d+$/, '')
  const at = (n: string) => { const i = presets.indexOf(base(n)); return i < 0 ? 999 : i }
  return list.map((a, i) => ({ a, i })).sort((x, y) => floorRank(x.a.floor) - floorRank(y.a.floor) || at(x.a.name) - at(y.a.name) || x.i - y.i).map((x) => x.a)
}
