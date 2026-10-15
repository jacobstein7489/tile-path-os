/* Products and services, as they come in from QuickBooks — and the materials catalog the takeoff orders from.
 * Labor items carry what we charge (price) and what we pay the installer (cost).
 * Material items carry what we charge and what we last paid the supplier; the history comes from our POs.
 * Sample amounts. */
export type ItemType = 'labor' | 'material' | 'other'
export interface Item {
  id: string
  name: string
  type: ItemType
  unit: string
  /** what we charge the client */
  price: number
  /** labor: what we pay the installer per unit · material: what we last paid */
  cost: number
  vendor?: string
  /** the QuickBooks item it syncs with */
  qb: string
  /** QuickBooks' sales description — what the estimate paper says under the name */
  desc?: string
  /** how the item list and the estimate's item picker group it — Tile install, Showers & wet areas, Floor prep… */
  group?: string
  /** which surface a labor item tiles, so an approved estimate can build the project's rooms */
  surface?: 'Floor' | 'Walls' | 'Shower floor' | 'Backsplash' | 'Border'
  /* the catalog: who makes it, what it's called, how it comes, and its picture */
  brand?: string
  product?: string
  cat?: MatCat
  pic?: PicKind
  /** the package color in the picture, when it isn't the category's */
  tint?: string
  /** how it's sold, e.g. 50 lb bag */
  pack?: string
  /** the takeoff uses it — what for */
  usedFor?: string
  /** a real product photo — from the supplier's catalog, or added by hand */
  photo?: string
}
export type PicKind = 'bag' | 'pail' | 'roll' | 'sheet' | 'box' | 'trim' | 'tube' | 'jug' | 'kit'
export type MatCat = 'mortar' | 'grout' | 'waterproofing' | 'membrane' | 'board' | 'prep' | 'trim' | 'supplies' | 'care'
export const MAT_CAT: Record<MatCat, { label: string; color: string }> = {
  mortar: { label: 'Thinset', color: '#7c8592' },
  grout: { label: 'Grout & caulk', color: '#a8876a' },
  waterproofing: { label: 'Waterproofing', color: '#3d6fd6' },
  membrane: { label: 'Membranes', color: '#d97a1f' },
  board: { label: 'Backer board', color: '#5f6b7a' },
  prep: { label: 'Floor prep', color: '#b8954f' },
  trim: { label: 'Trims & edges', color: '#9aa3ad' },
  supplies: { label: 'Supplies', color: '#4b5565' },
  care: { label: 'Sealers & care', color: '#2f8f5b' },
}

export const ITEMS0: Item[] = [
  { id: 'i-floor', name: 'Floor tile — set and grout', type: 'labor', unit: 'SF', price: 24, cost: 15, qb: 'Install:Floor tile', surface: 'Floor' },
  { id: 'i-wall', name: 'Wall tile — set and grout', type: 'labor', unit: 'SF', price: 28, cost: 18, qb: 'Install:Wall tile', surface: 'Walls' },
  { id: 'i-large', name: 'Large format 24×48 and up', type: 'labor', unit: 'SF', price: 30, cost: 19, qb: 'Install:Large format', surface: 'Floor' },
  { id: 'i-mosaic', name: 'Mosaic — shower floors and accents', type: 'labor', unit: 'SF', price: 45, cost: 30, qb: 'Install:Mosaic', surface: 'Shower floor' },
  { id: 'i-splash', name: 'Backsplash — set and grout', type: 'labor', unit: 'SF', price: 30, cost: 19, qb: 'Install:Backsplash', surface: 'Backsplash' },
  { id: 'i-border', name: 'Stone border and coping — set', type: 'labor', unit: 'LF', price: 65, cost: 40, qb: 'Install:Border', surface: 'Border' },
  { id: 'i-prep', name: 'Floor prep — mortar bed', type: 'labor', unit: 'SF', price: 9, cost: 5.5, qb: 'Install:Floor prep' },
  { id: 'i-wp', name: 'Waterproofing — showers and tubs', type: 'labor', unit: 'SF', price: 6, cost: 3.5, qb: 'Install:Waterproofing' },
  { id: 'i-edge', name: 'Metal edges and corners', type: 'labor', unit: 'LF', price: 12, cost: 7, qb: 'Install:Trim' },
  { id: 'i-under', name: 'Underlayment — backer board or uncoupling mat', type: 'labor', unit: 'SF', price: 4.5, cost: 2.5, qb: 'Install:Underlayment' },
  { id: 'i-skim', name: 'Skim coat for mosaic or subway', type: 'labor', unit: 'SF', price: 5, cost: 3, qb: 'Install:Skim coat' },
  { id: 'i-niche', name: 'Tile niche — frame, waterproof and tile', type: 'labor', unit: 'EA', price: 350, cost: 200, qb: 'Install:Niche' },
  { id: 'i-window', name: 'Window wrap — tile the returns', type: 'labor', unit: 'EA', price: 275, cost: 160, qb: 'Install:Window wrap' },
  { id: 'i-saddle', name: 'Saddle — set at the door', type: 'labor', unit: 'EA', price: 85, cost: 45, qb: 'Install:Saddle' },
  { id: 'i-metal', name: 'Metal edge — each piece', type: 'labor', unit: 'EA', price: 45, cost: 25, qb: 'Install:Metal piece' },
  { id: 'i-drain', name: 'Linear drain — set and install', type: 'labor', unit: 'EA', price: 450, cost: 260, qb: 'Install:Linear drain' },
  /* ---- the materials catalog (sample prices) — the takeoff picks from it ---- */
  { id: 'm-thinset', name: 'LFT thinset · 50 lb', brand: 'Laticrete', product: '4-XLT', cat: 'mortar', pic: 'bag', pack: '50 lb bag', type: 'material', unit: 'bag', price: 52, cost: 38, vendor: 'Infinity', qb: 'Materials:LFT thinset', usedFor: 'Tile up to 15″ and large format' },
  { id: 'm-versa', name: 'Versabond-LFT · 50 lb', brand: 'Custom Building Products', product: 'VersaBond-LFT', cat: 'mortar', pic: 'bag', tint: '#8b8f96', pack: '50 lb bag', type: 'material', unit: 'bag', price: 52, cost: 38, vendor: 'Infinity', qb: 'Materials:Versabond-LFT' },
  { id: 'm-ultraflex', name: 'Polymer LFT thinset · 50 lb', brand: 'Mapei', product: 'Ultraflex LFT', cat: 'mortar', pic: 'bag', tint: '#6b7280', pack: '50 lb bag', type: 'material', unit: 'bag', price: 58, cost: 42, vendor: 'Infinity', qb: 'Materials:Ultraflex LFT' },
  { id: 'm-megalite', name: 'Lightweight thinset · 30 lb', brand: 'Custom Building Products', product: 'MegaLite', cat: 'mortar', pic: 'bag', tint: '#9aa1ab', pack: '30 lb bag', type: 'material', unit: 'bag', price: 54, cost: 40, vendor: 'Infinity', qb: 'Materials:MegaLite' },
  { id: 'm-grout', name: 'Grout · 25 lb', brand: 'Custom Building Products', product: 'Polyblend Plus', cat: 'grout', pic: 'bag', pack: '25 lb bag · sanded', type: 'material', unit: 'bag', price: 48, cost: 34, vendor: 'Infinity', qb: 'Materials:Grout', usedFor: 'Every tiled surface' },
  { id: 'm-permacolor', name: 'High-performance grout · 25 lb', brand: 'Laticrete', product: 'Permacolor', cat: 'grout', pic: 'bag', tint: '#8f7a66', pack: '25 lb bag', type: 'material', unit: 'bag', price: 62, cost: 45, vendor: 'Infinity', qb: 'Materials:Permacolor' },
  { id: 'm-epoxy', name: 'Epoxy grout · full unit', brand: 'Laticrete', product: 'SpectraLOCK', cat: 'grout', pic: 'kit', tint: '#7d6b5a', pack: 'Full unit', type: 'material', unit: 'kit', price: 155, cost: 115, vendor: 'Infinity', qb: 'Materials:Epoxy grout' },
  { id: 'm-caulk', name: 'Matching caulk · 10.5 oz', brand: 'Custom Building Products', product: 'Polyblend', cat: 'grout', pic: 'tube', pack: '10.5 oz tube', type: 'material', unit: 'tube', price: 14, cost: 9, vendor: 'Infinity', qb: 'Materials:Caulk' },
  { id: 'm-wp', name: 'Waterproofing · pail', brand: 'Laticrete', product: 'Hydro Ban', cat: 'waterproofing', pic: 'pail', pack: '5 gal pail', type: 'material', unit: 'pail', price: 240, cost: 180, vendor: 'Infinity', qb: 'Materials:Waterproofing', usedFor: 'Shower and tub walls, two coats' },
  { id: 'm-redgard', name: 'Waterproofing · 3.5 gal', brand: 'Custom Building Products', product: 'RedGard', cat: 'waterproofing', pic: 'pail', tint: '#5a7fd0', pack: '3.5 gal pail', type: 'material', unit: 'pail', price: 180, cost: 132, vendor: 'Infinity', qb: 'Materials:RedGard' },
  { id: 'm-liner', name: 'Shower pan liner kit', brand: 'Oatey', product: 'Pan liner', cat: 'waterproofing', pic: 'kit', tint: '#4f74c4', pack: 'Kit · 5 × 6 ft', type: 'material', unit: 'kit', price: 120, cost: 85, vendor: 'Infinity', qb: 'Materials:Pan liner', usedFor: 'Mud-pan shower floors' },
  { id: 'm-drain', name: 'Shower drain kit · 4″', brand: 'Schluter', product: 'KERDI-DRAIN', cat: 'waterproofing', pic: 'kit', tint: '#2f5fb8', pack: 'Kit', type: 'material', unit: 'kit', price: 165, cost: 120, vendor: 'Infinity', qb: 'Materials:Drain kit' },
  { id: 'm-membrane', name: 'Uncoupling membrane · roll', brand: 'Schluter', product: 'DITRA', cat: 'membrane', pic: 'roll', pack: '150 SF roll', type: 'material', unit: 'roll', price: 410, cost: 315, vendor: 'Infinity', qb: 'Materials:Uncoupling membrane', usedFor: 'Floors set on membrane' },
  { id: 'm-kerdi', name: 'Waterproofing membrane · roll', brand: 'Schluter', product: 'KERDI', cat: 'membrane', pic: 'roll', tint: '#d9902e', pack: '108 SF roll', type: 'material', unit: 'roll', price: 320, cost: 240, vendor: 'Infinity', qb: 'Materials:KERDI' },
  { id: 'm-kerdiband', name: 'Seam band · 33 ft', brand: 'Schluter', product: 'KERDI-BAND', cat: 'membrane', pic: 'roll', tint: '#e0a046', pack: '33 ft roll', type: 'material', unit: 'roll', price: 42, cost: 30, vendor: 'Infinity', qb: 'Materials:KERDI-BAND' },
  { id: 'm-board', name: 'Cement board 3×5 · ½″', brand: 'USG', product: 'Durock', cat: 'board', pic: 'sheet', pack: '3 × 5 ft · ½″ sheet', type: 'material', unit: 'sheet', price: 20, cost: 14, vendor: 'Infinity', qb: 'Materials:Cement board', usedFor: 'Walls on cement board' },
  { id: 'm-hardie', name: 'Fiber-cement board 3×5 · ½″', brand: 'James Hardie', product: 'HardieBacker', cat: 'board', pic: 'sheet', tint: '#7a8696', pack: '3 × 5 ft · ½″ sheet', type: 'material', unit: 'sheet', price: 22, cost: 15, vendor: 'Infinity', qb: 'Materials:HardieBacker' },
  { id: 'm-foam', name: 'Foam board 4×8 · ½″', brand: 'Wedi', product: 'Building panel', cat: 'board', pic: 'sheet', tint: '#3f86c7', pack: '4 × 8 ft · ½″ panel', type: 'material', unit: 'sheet', price: 95, cost: 68, vendor: 'Infinity', qb: 'Materials:Foam board', usedFor: 'Walls on foam board' },
  { id: 'm-slu', name: 'Self-leveler · 50 lb', brand: 'Custom Building Products', product: 'LevelQuik RS', cat: 'prep', pic: 'bag', pack: '50 lb bag', type: 'material', unit: 'bag', price: 52, cost: 38, vendor: 'Infinity', qb: 'Materials:Self-leveler', usedFor: 'Floors on self-leveler' },
  { id: 'm-primer', name: 'Primer · 1 gal', brand: 'Custom Building Products', product: 'LevelQuik', cat: 'prep', pic: 'jug', tint: '#c9a35e', pack: '1 gal jug', type: 'material', unit: 'gal', price: 40, cost: 28, vendor: 'Infinity', qb: 'Materials:Primer', usedFor: 'Under self-leveler' },
  { id: 'm-portland', name: 'Portland cement · 94 lb', brand: 'Quikrete', product: 'Type I/II', cat: 'prep', pic: 'bag', tint: '#a39b8b', pack: '94 lb bag', type: 'material', unit: 'bag', price: 24, cost: 17, vendor: 'Infinity', qb: 'Materials:Portland cement', usedFor: 'Mud beds and shower pans' },
  { id: 'm-sand', name: 'Sand · 50 lb', brand: 'Quikrete', product: 'All-purpose', cat: 'prep', pic: 'bag', tint: '#c8ad7f', pack: '50 lb bag', type: 'material', unit: 'bag', price: 9, cost: 6, vendor: 'Infinity', qb: 'Materials:Sand', usedFor: 'Mud beds and shower pans' },
  { id: 'm-mesh', name: 'Wire mesh lath · 27″ × 97″', product: 'Diamond mesh lath', cat: 'prep', pic: 'sheet', tint: '#8f969f', pack: '27″ × 97″ sheet', type: 'material', unit: 'sheet', price: 9, cost: 6, vendor: 'Infinity', qb: 'Materials:Wire mesh', usedFor: 'Floor mud beds' },
  { id: 'm-skim', name: 'Skim coat · 50 lb', brand: 'Mapei', product: 'Planipatch', cat: 'prep', pic: 'bag', tint: '#9c8f7d', pack: '50 lb bag', type: 'material', unit: 'bag', price: 40, cost: 28, vendor: 'Infinity', qb: 'Materials:Skim coat', usedFor: 'Walls skim-coated for mosaic' },
  { id: 'm-jolly', name: 'Schluter JOLLY · satin brass 10 mm · 8 ft', brand: 'Schluter', product: 'JOLLY', cat: 'trim', pic: 'trim', tint: '#c9a24a', pack: '8 ft · satin brass · 10 mm', type: 'material', unit: 'pc', price: 148, cost: 114, vendor: 'Metal Works Inc.', qb: 'Materials:JOLLY brass 10mm' },
  { id: 'm-trim', name: 'Metal trim · satin nickel 1/4″ · 8 ft', brand: 'Schluter', product: 'RONDEC', cat: 'trim', pic: 'trim', tint: '#a7adb5', pack: '8 ft · satin nickel · ¼″', type: 'material', unit: 'pc', price: 51, cost: 39, vendor: 'Metal Works Inc.', qb: 'Materials:Trim nickel 1/4' },
  { id: 'm-edge', name: 'Metal edge · 8 ft', brand: 'Schluter', product: 'SCHIENE', cat: 'trim', pic: 'trim', tint: '#b9c0c8', pack: '8 ft · aluminum', type: 'material', unit: 'pc', price: 32, cost: 24, vendor: 'Metal Works Inc.', qb: 'Materials:Metal edge' },
  { id: 'm-screws', name: 'Board screws · box', brand: 'USG', product: 'Durock screws', cat: 'supplies', pic: 'box', pack: 'Box · 1¼″', type: 'material', unit: 'box', price: 26, cost: 18, vendor: 'Infinity', qb: 'Materials:Board screws', usedFor: 'Cement board walls' },
  { id: 'm-tape', name: 'Mesh tape · roll', brand: 'USG', product: 'Durock tape', cat: 'supplies', pic: 'roll', tint: '#6b7684', pack: '150 ft roll', type: 'material', unit: 'roll', price: 13, cost: 9, vendor: 'Infinity', qb: 'Materials:Mesh tape', usedFor: 'Cement board seams' },
  { id: 'm-clips', name: 'Leveling clips · bag of 250', brand: 'Raimondi', product: 'Leveling clips', cat: 'supplies', pic: 'box', tint: '#e06b2c', pack: 'Bag of 250', type: 'material', unit: 'bag', price: 62, cost: 45, vendor: 'Infinity', qb: 'Materials:Leveling clips', usedFor: 'Large format floors and walls' },
  { id: 'm-sealer', name: 'Grout and stone sealer · quart', brand: 'Aqua Mix', product: 'Sealer’s Choice', cat: 'care', pic: 'jug', pack: '1 quart', type: 'material', unit: 'qt', price: 38, cost: 26, vendor: 'Infinity', qb: 'Materials:Sealer' },
  { id: 'm-cleaner', name: 'Grout haze remover · quart', brand: 'Aqua Mix', product: 'Haze remover', cat: 'care', pic: 'jug', tint: '#4aa476', pack: '1 quart', type: 'material', unit: 'qt', price: 22, cost: 15, vendor: 'Infinity', qb: 'Materials:Haze remover' },
  { id: 'o-mob', name: 'Mobilization and protection', type: 'other', unit: 'LS', price: 2500, cost: 0, qb: 'General:Mobilization' },
  { id: 'o-room', name: 'Tile installation per plans', type: 'other', unit: 'LS', price: 0, cost: 0, qb: 'Install:Per plans' },
]
export const ITEM_TYPE_LABEL: Record<ItemType, string> = { labor: 'Labor', material: 'Material', other: 'Other' }
