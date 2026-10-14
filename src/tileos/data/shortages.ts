/* Tile that came up short — one record per shortage, walked through found → reordered → delivery → back to work. */
import type { PersonKey } from './model'
import type { LogLine } from './work'

export interface Shortage {
  id: string
  jobId: string
  tag: string
  qty: number
  unit: string
  surfaces: { room: string; surface: string }[]
  found: { who: PersonKey; date: string; how: string }
  step: 'short' | 'reordered' | 'received'
  orderedBy?: 'GC' | 'Client' | 'Us'
  orderedFrom?: string
  orderedOn?: string
  eta?: string
  receivedOn?: string
  /** the crew can't keep working on anything else — the project is on hold */
  stops: boolean
  log: LogLine[]
}
export const SHORTAGES0: Shortage[] = [
  {
    id: 'SH-1', jobId: '24c', tag: 'T-06', qty: 12, unit: 'boxes', surfaces: [{ room: 'Basement bath', surface: 'Walls' }],
    found: { who: 'materials', date: 'Sep 2', how: 'Delivery came short — 18 of 30 boxes' },
    step: 'reordered', orderedBy: 'GC', orderedFrom: 'Best Tile', orderedOn: 'Sep 2', eta: 'Fri, Oct 2', stops: true,
    log: [
      { date: 'Sep 2', who: 'materials', text: 'Delivery came short — 18 of 30 boxes of T-06' },
      { date: 'Sep 2', who: 'materials', text: 'The GC put the rest on order with Best Tile' },
      { date: 'Sep 24', who: 'materials', text: 'Best Tile: “next Friday”' },
      { date: 'Sep 26', who: 'walter', text: 'Walls are prepped — waiting on the tile' },
    ],
  },
]

