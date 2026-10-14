/* How each wall and floor is set, and the coverage numbers the material takeoff runs on.
 * The numbers are standard industry figures to start from — the company changes them in Settings
 * so the math matches how its crews really use material. */

export type SurfKind = 'floor' | 'wall' | 'shower-floor'
export type MethodKey = 'slab' | 'mud' | 'slu' | 'membrane' | 'mudpan' | 'cbuwp' | 'cbu' | 'foam' | 'drywall' | 'skim'

export const METHODS: Record<MethodKey, { label: string; short: string; kinds: SurfKind[]; layers: string }> = {
  slab: { label: 'Thinset on the slab', short: 'On the slab', kinds: ['floor'], layers: 'Thinset straight on the concrete' },
  mud: { label: 'Mud bed with wire mesh', short: 'Mud bed + mesh', kinds: ['floor'], layers: 'Wire mesh, sand and Portland, then thinset' },
  slu: { label: 'Self-leveler', short: 'Self-leveler', kinds: ['floor'], layers: 'Primer and self-leveler, then thinset' },
  membrane: { label: 'Uncoupling mat — Strata_Mat or Ditra', short: 'Uncoupling mat', kinds: ['floor'], layers: 'Mat set in thinset, then thinset' },
  mudpan: { label: 'Mud pan and liner', short: 'Mud pan', kinds: ['shower-floor'], layers: 'Liner, then sloped sand and Portland' },
  cbuwp: { label: 'Cement board and waterproofing', short: 'Board + waterproofing', kinds: ['wall'], layers: 'Cement board, taped, liquid waterproofing' },
  cbu: { label: 'Cement board', short: 'Cement board', kinds: ['wall'], layers: 'Cement board, taped' },
  foam: { label: 'Foam board', short: 'Foam board', kinds: ['wall'], layers: 'Waterproof foam board, seams banded' },
  drywall: { label: 'On the wall (dry area)', short: 'On the wall', kinds: ['wall'], layers: 'Thinset straight on the wall' },
  skim: { label: 'Skim coat, then tile', short: 'Skim coat', kinds: ['wall'], layers: 'Skim coat for mosaic or subway' },
}

export interface MatRules {
  thinSmall: number
  thinMed: number
  thinLarge: number
  thinBond: number
  mudIn: number
  panIn: number
  sand: number
  portland: number
  mesh: number
  slu: number
  primer: number
  roll: number
  board: number
  wp: number
  foam: number
  skim: number
  waste: number
}

export const MAT_RULES0: MatRules = {
  thinSmall: 95, thinMed: 70, thinLarge: 40, thinBond: 60,
  mudIn: 1.5, panIn: 2, sand: 15, portland: 1.5, mesh: 18,
  slu: 25, primer: 300, roll: 150, board: 15, wp: 100, foam: 32, skim: 60,
  waste: 10,
}

/** the numbers as they show in Settings */
export const MAT_RULE_ROWS: { group: string; rows: { key: keyof MatRules; label: string; unit: string; step: number; min: number; max: number }[] }[] = [
  {
    group: 'Thinset · 50 lb bag',
    rows: [
      { key: 'thinSmall', label: 'Small tile — subway, mosaic', unit: 'SF a bag', step: 5, min: 30, max: 200 },
      { key: 'thinMed', label: 'Tile up to 15″', unit: 'SF a bag', step: 5, min: 30, max: 150 },
      { key: 'thinLarge', label: 'Large format, back-buttered', unit: 'SF a bag', step: 5, min: 20, max: 120 },
      { key: 'thinBond', label: 'Setting a membrane', unit: 'SF a bag', step: 5, min: 20, max: 150 },
    ],
  },
  {
    group: 'Mud — sand and Portland',
    rows: [
      { key: 'mudIn', label: 'Floor mud bed', unit: 'inches', step: 0.25, min: 0.75, max: 4 },
      { key: 'panIn', label: 'Shower pan, average', unit: 'inches', step: 0.25, min: 1, max: 4 },
      { key: 'sand', label: 'Sand per 100 SF, each inch', unit: 'bags · 50 lb', step: 1, min: 5, max: 40 },
      { key: 'portland', label: 'Portland per 100 SF, each inch', unit: 'bags · 94 lb', step: 0.25, min: 0.5, max: 6 },
      { key: 'mesh', label: 'Wire mesh in the mud bed', unit: 'SF a sheet', step: 1, min: 8, max: 40 },
    ],
  },
  {
    group: 'Underlayment and waterproofing',
    rows: [
      { key: 'slu', label: 'Self-leveler at ¼″', unit: 'SF a bag', step: 5, min: 10, max: 100 },
      { key: 'roll', label: 'Uncoupling membrane', unit: 'SF a roll', step: 5, min: 30, max: 330 },
      { key: 'board', label: 'Cement board 3×5', unit: 'SF a sheet', step: 1, min: 8, max: 32 },
      { key: 'wp', label: 'Liquid waterproofing, 2 coats', unit: 'SF a pail', step: 5, min: 30, max: 250 },
    ],
  },
  {
    group: 'Extra',
    rows: [{ key: 'waste', label: 'Added to every material', unit: '%', step: 1, min: 0, max: 30 }],
  },
]
