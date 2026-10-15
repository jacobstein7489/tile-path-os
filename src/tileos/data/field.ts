/* Field records: the daily diary per room (with photos and videos) and the installer POs.
 * The diary is what the crew sends each day, measured against the original plan of rooms and surfaces. */
import type { PersonKey, SwatchKey } from './model'
import type { LogLine } from './work'

export interface Media {
  id: string
  kind: 'photo' | 'video'
  /** demo photos are drawn from the tile itself; real uploads carry a local url */
  sw?: SwatchKey
  url?: string
  cap: string
  dur?: string
  surface?: string
}
export interface DiaryItem { surface: string; from: number; to: number }
export interface DiaryRoom { room: string; items: DiaryItem[]; media: Media[]; note?: string }
export interface DiaryEntry {
  id: string
  date: string
  day: string
  who: PersonKey
  workers?: number
  rooms: DiaryRoom[]
  issues?: string[]
  tomorrow?: string[]
  gc?: boolean
  note?: string
}

let mid = 0
const P = (sw: SwatchKey, cap: string, surface?: string): Media => ({ id: 'm' + ++mid, kind: 'photo', sw, cap, surface })
const V = (sw: SwatchKey, cap: string, dur: string, surface?: string): Media => ({ id: 'm' + ++mid, kind: 'video', sw, cap, dur, surface })
const I = (surface: string, from: number, to: number): DiaryItem => ({ surface, from, to })

/* 119 Park Place — Philip and 4 workers, Sep 14 to Sep 26. Every number below adds up to today's room progress. */
export const DIARY0: Record<string, DiaryEntry[]> = {
  '119': [
    {
      id: 'd119-0926', date: 'Sep 26', day: 'Sat, Sep 26', who: 'philip', workers: 4, gc: true,
      rooms: [
        { room: 'Guest Bath', items: [I('Shower walls', 40, 55), I('Niche', 0, 50)], media: [P('subway', 'Shower walls at 55%', 'Shower walls'), P('subway', 'Niche — mitered edges started', 'Niche')] },
        { room: 'Master Bath', items: [I('Shower wall A', 70, 80), I('Shower wall B', 20, 40)], media: [V('toscana', 'Master shower — walk-around', '0:42', 'Shower wall A')] },
      ],
      tomorrow: ['Guest Bath', 'Powder Room'],
      note: 'Monday: guest bath walls and the powder floor.',
    },
    {
      id: 'd119-0925', date: 'Sep 25', day: 'Fri, Sep 25', who: 'philip', workers: 4,
      rooms: [
        { room: 'Master Bath', items: [I('Shower wall A', 40, 70), I('Shower wall B', 0, 20)], media: [P('toscana', 'Wall A — full tile at the doorway', 'Shower wall A'), P('toscana', 'Wall B — niche layout marked', 'Shower wall B')] },
        { room: 'Girls Bath', items: [], media: [], note: '4 of 6 brass profiles arrived — corners wait for the last 2.' },
      ],
      issues: ['2 brass profiles still to come for the girls bath corners'],
    },
    {
      id: 'd119-0924', date: 'Sep 24', day: 'Thu, Sep 24', who: 'philip', workers: 4,
      rooms: [
        { room: 'Master Bath', items: [I('Shower wall A', 0, 40)], media: [P('toscana', 'Wall A — vertical stack', 'Shower wall A')] },
        { room: 'Guest Bath', items: [I('Shower walls', 25, 40)], media: [P('subway', 'Guest shower walls at 40%', 'Shower walls')] },
        { room: 'Boys Bath', items: [I('Shower walls', 0, 20)], media: [], note: 'Client asked for the main walls full height — CO-004. Holding at 3 ft.' },
      ],
      issues: ['Client asked for full height in the boys bath (CO-004)'],
    },
    {
      id: 'd119-0923', date: 'Sep 23', day: 'Wed, Sep 23', who: 'philip', workers: 4,
      rooms: [
        { room: 'Guest Bath', items: [I('Shower walls', 0, 25)], media: [P('subway', 'Starting the shower walls from the top', 'Shower walls')] },
        { room: 'Girls Bath', items: [I('Shower walls', 30, 60)], media: [V('pearl', 'Girls shower walls', '0:18', 'Shower walls')] },
      ],
    },
    {
      id: 'd119-0922', date: 'Sep 22', day: 'Tue, Sep 22', who: 'philip', workers: 4,
      rooms: [
        { room: 'Girls Bath', items: [I('Main walls', 50, 100), I('Shower walls', 0, 30)], media: [P('pearl', 'Main walls finished at 3 ft', 'Main walls')] },
        { room: 'Boys Bath', items: [I('Main walls', 60, 100)], media: [P('pearl', 'Main walls to 3 ft', 'Main walls')] },
        { room: 'Master Bath', items: [], media: [P('hex', 'Shower drain — question for the plumber', 'Shower floor')], note: 'Not starting the shower floor until the plumber confirms the drain.' },
      ],
      issues: ['Master shower drain — waiting on the plumber'],
    },
    {
      id: 'd119-0921', date: 'Sep 21', day: 'Mon, Sep 21', who: 'philip', workers: 4,
      rooms: [
        { room: 'Boys Bath', items: [I('Floor', 60, 100), I('Main walls', 0, 60)], media: [P('pearl', 'Main walls going up', 'Main walls')] },
        { room: 'Girls Bath', items: [I('Main walls', 0, 50)], media: [P('pearl', 'Main walls, offset 1/2', 'Main walls')] },
      ],
    },
    {
      id: 'd119-0918', date: 'Sep 18', day: 'Fri, Sep 18', who: 'philip', workers: 4,
      rooms: [
        { room: 'Girls Bath', items: [I('Floor', 0, 100)], media: [P('bianco', 'Girls bath floor finished', 'Floor')] },
        { room: 'Boys Bath', items: [I('Floor', 0, 60)], media: [P('bianco', 'Long side to the door', 'Floor')] },
      ],
    },
    {
      id: 'd119-0917', date: 'Sep 17', day: 'Thu, Sep 17', who: 'philip', workers: 4,
      rooms: [
        { room: 'Kitchen', items: [I('Backsplash', 50, 100), I('Range wall', 0, 100)], media: [P('calacatta', 'Kitchen finished', 'Range wall'), V('calacatta', 'Kitchen walk-around', '0:34', 'Backsplash')], note: 'Kitchen finished.' },
      ],
    },
    {
      id: 'd119-0916', date: 'Sep 16', day: 'Wed, Sep 16', who: 'philip', workers: 4,
      rooms: [
        { room: 'Guest Bath', items: [I('Shower floor', 0, 100)], media: [P('hex', 'Shower floor pitched to the drain', 'Shower floor')] },
        { room: 'Kitchen', items: [I('Backsplash', 0, 50)], media: [P('calacatta', 'Backsplash centered on the range', 'Backsplash')] },
      ],
    },
    {
      id: 'd119-0915', date: 'Sep 15', day: 'Tue, Sep 15', who: 'philip', workers: 4,
      rooms: [
        { room: 'Guest Bath', items: [I('Floor', 60, 100), I('Curb', 0, 100)], media: [P('bianco', 'Guest bath floor finished', 'Floor'), V('bianco', 'Floor and curb', '0:21', 'Floor')] },
      ],
    },
    {
      id: 'd119-0914', date: 'Sep 14', day: 'Mon, Sep 14', who: 'philip', workers: 4,
      rooms: [
        { room: 'Guest Bath', items: [I('Floor', 0, 60)], media: [P('bianco', 'First rows, long side to the door', 'Floor')], note: 'Started in the guest bath.' },
      ],
    },
  ],
  '118': [
    {
      id: 'd118-0926', date: 'Sep 26', day: 'Sat, Sep 26', who: 'leo', workers: 2,
      rooms: [
        { room: 'Kitchen', items: [I('Wall B – Sink', 0, 40)], media: [P('calacatta', 'Sink wall, centered on the window', 'Wall B – Sink')] },
        { room: 'Hall Bath', items: [I('Tub walls', 30, 50)], media: [P('subway', 'Tub walls at 50%', 'Tub walls')], note: 'Edges wait on the satin nickel trim.' },
      ],
      issues: ['Metal trim still not here — PO-1042'],
    },
    {
      id: 'd118-0925', date: 'Sep 25', day: 'Fri, Sep 25', who: 'leo', workers: 2,
      rooms: [
        { room: 'Master Bath', items: [I('Vanity wall', 0, 100)], media: [P('calacatta', 'Vanity wall finished', 'Vanity wall')] },
        { room: 'Hall Bath', items: [I('Tub walls', 0, 30)], media: [] },
      ],
    },
  ],
  '2385': [
    {
      id: 'd2385-0926', date: 'Sep 26', day: 'Sat, Sep 26', who: 'alex', workers: 3,
      rooms: [{ room: 'Ballroom', items: [I('Epoxy grout', 40, 70)], media: [P('grigio', 'Epoxy grout on the ballroom field', 'Epoxy grout'), V('grigio', 'Ballroom walk-through', '0:24', 'Epoxy grout')], note: 'About a day of epoxy left.' }],
      tomorrow: ['Ballroom'],
    },
    {
      id: 'd2385-0925', date: 'Sep 25', day: 'Fri, Sep 25', who: 'alex', workers: 3,
      rooms: [{ room: 'Ballroom', items: [I('Border', 70, 100), I('Epoxy grout', 0, 40)], media: [P('calacatta', 'Border finished all around', 'Border')] }],
    },
  ],
  '24c': [
    {
      id: 'd24c-0926', date: 'Sep 26', day: 'Sat, Sep 26', who: 'walter', workers: 3,
      rooms: [{ room: 'Basement bath', items: [], media: [P('subway', 'Walls prepped, waiting on tile', 'Walls')], note: 'Walls are prepped — still waiting on 12 boxes of wall tile from the store.' }],
      issues: ['12 boxes of T-06 still outstanding'],
    },
    {
      id: 'd24c-0925', date: 'Sep 25', day: 'Fri, Sep 25', who: 'walter', workers: 3,
      rooms: [{ room: 'Basement bath', items: [I('Floor', 70, 100)], media: [P('bianco', 'Basement bath floor grouted', 'Floor')] }],
    },
  ],
}

/* ================= installer POs (what we pay the crew for this project) ================= */
export interface IPOLine { item: string; qty: string; amount: number; itemId?: string; n?: number; rate?: number; room?: string }
export interface IPOChange { co: string; text: string; qty: string; amount: number; status: 'pending' | 'sent' | 'accepted' }
export interface IPO { id: string; jobId: string; crew: PersonKey; status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected'; date: string; lines: IPOLine[]; changes: IPOChange[]; log: LogLine[]; reason?: string; /** revision number once it's been changed after he had it */ rev?: number }

const LL = (date: string, who: PersonKey, text: string): LogLine => ({ date, who, text })
export const IPOS0: IPO[] = [
  {
    id: 'IPO-119', jobId: '119', crew: 'philip', status: 'Accepted', date: 'Sep 12',
    lines: [
      { item: 'Floor tile — set and grout', qty: '330 SF', amount: 4950, itemId: 'i-floor', n: 330, rate: 15 },
      { item: 'Wall tile — set and grout', qty: '650 SF', amount: 11700, itemId: 'i-wall', n: 650, rate: 18 },
      { item: 'Mosaic — shower floors', qty: '28 SF', amount: 840, itemId: 'i-mosaic', n: 28, rate: 30 },
      { item: 'Metal edges and corners', qty: 'All rooms', amount: 900, itemId: 'i-edge' },
    ],
    changes: [
      { co: 'CO-003', text: 'Powder accent wall to 48″', qty: '+8 SF', amount: 160, status: 'accepted' },
      { co: 'CO-004', text: 'Boys bath main walls to full height', qty: '+96 SF wall tile', amount: 1730, status: 'pending' },
    ],
    log: [LL('Sep 12', 'ys', 'Sent to Philip with the installer package'), LL('Sep 12', 'philip', 'Accepted'), LL('Sep 12', 'ys', 'CO-003 added · +8 SF'), LL('Sep 12', 'philip', 'Accepted CO-003')],
  },
  {
    id: 'IPO-118', jobId: '118', crew: 'leo', status: 'Accepted', date: 'Sep 4',
    lines: [
      { item: 'Floor tile — set and grout', qty: '300 SF', amount: 4500, itemId: 'i-floor', n: 300, rate: 15 },
      { item: 'Wall tile — set and grout', qty: '310 SF', amount: 5580, itemId: 'i-wall', n: 310, rate: 18 },
      { item: 'Metal edges and corners', qty: '40 pieces', amount: 600, itemId: 'i-edge' },
    ],
    changes: [{ co: 'CO-001', text: 'Kitchen backsplash return', qty: '+12 SF', amount: 220, status: 'accepted' }],
    log: [LL('Sep 4', 'ys', 'Sent to Leo'), LL('Sep 5', 'leo', 'Accepted')],
  },
  {
    id: 'IPO-24C', jobId: '24c', crew: 'walter', status: 'Accepted', date: 'Aug 10',
    lines: [{ item: 'Floor tile — set and grout', qty: 'about 190 SF', amount: 2850 }, { item: 'Wall tile — set and grout', qty: 'about 260 SF', amount: 4680 }],
    changes: [],
    log: [LL('Aug 10', 'ys', 'Sent to Walter'), LL('Aug 11', 'walter', 'Accepted')],
  },
  {
    id: 'IPO-2385', jobId: '2385', crew: 'alex', status: 'Accepted', date: 'Jul 17',
    lines: [{ item: 'Ballroom field tile — set', qty: 'about 1,800 SF', amount: 21600 }, { item: 'Border and powder rooms', qty: 'about 420 SF', amount: 6300 }],
    changes: [{ co: 'CO-002', text: 'Ballroom epoxy grout upgrade', qty: 'Ballroom', amount: 1400, status: 'accepted' }],
    log: [LL('Jul 17', 'ys', 'Sent to Alex'), LL('Jul 17', 'alex', 'Accepted')],
  },
  {
    id: 'IPO-828', jobId: '828', crew: 'philip', status: 'Accepted', date: 'Jul 29',
    lines: [{ item: 'Lobby and entrance — set and grout', qty: 'about 1,400 SF', amount: 16800 }],
    changes: [],
    log: [LL('Jul 29', 'ys', 'Sent to Philip'), LL('Jul 29', 'philip', 'Accepted')],
  },
]
