/* The sample's last four weeks of finished work — what each of ours had set for each day, and the day it really got
 * done — so the team report has something to show in the preview. Sample data only: the real app starts with its
 * own history and builds it as the team works. */
import type { PersonKey, Role } from './model'
import type { Task, TaskType } from './work'
import { addDays, md } from '@/tileos/lib/today'

const isWeekend = (iso: string) => { const d = new Date(iso + 'T12:00:00Z').getUTCDay(); return d === 0 || d === 6 }
/** a few work days after a day */
const afterWorkdays = (iso: string, n: number) => { let d = iso; while (n > 0) { d = addDays(d, 1); if (!isWeekend(d)) n-- } return d }
/** the same "random" every time, so the preview always looks the same */
const hash = (n: number) => { let x = (n ^ 0x2c1b3c6d) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x297a2d39) >>> 0; x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0; return (x ^ (x >>> 16)) >>> 0 }

/** who, how often they're late (in 100), and the kind of things they do */
const PLAN: { who: PersonKey; role: Role; type: TaskType; late: number; jobs: [string, string][] }[] = [
  { who: 'yakov', role: 'site', type: 'Field', late: 9, jobs: [['118', 'Daily update · 118 Park'], ['green', 'Check in the tile at Green Tree'], ['mdrive', 'Measure the floors at Mark Drive'], ['530', 'Walk-through with Leo at 530 Mark'], ['119', 'Site check at 119 Park Place'], ['wilk', 'Look at the fixes again at Wilkinson']] },
  { who: 'office', role: 'office', type: 'Setup', late: 24, jobs: [['114', 'Get the tile delivery date for 114 Park Place'], ['wilk', 'Set the design meeting at Wilkinson'], ['b1', 'Ask the GC for the spec book · 26 Cambridge'], ['119', 'Send the walk-through to Philip'], ['green', 'Call Best Tile about T-04'], ['mdrive', 'Get the tile paperwork for Mark Drive']] },
  { who: 'takeoff', role: 'takeoff', type: 'Pricing', late: 41, jobs: [['b6', 'Do the takeoff · Mark Drive model unit'], ['b3', 'Fix 2 notes on the takeoff · Green Tree Phase 2'], ['115', 'Enter the tile paperwork · 115 Park'], ['b8', 'Do the takeoff · Park Ave Residences 7A'], ['114', 'Check the quantities · 114 Park Place']] },
  { who: 'estimator', role: 'estimator', type: 'Pricing', late: 13, jobs: [['b7', 'Review the takeoff · Forest Circle pool house'], ['118', 'Price CO-003 · 118 Park'], ['b5', 'Review the takeoff · Clyde St retail'], ['114', 'Pick the tile and grout · 114 Park Place']] },
  { who: 'materials', role: 'materials', type: 'Materials', late: 6, jobs: [['530', 'Order setting materials · 530 Mark'], ['green', 'Receive our materials at Green Tree'], ['119', 'Brass profiles — confirm the delivery'], ['118', 'Order the membrane for 118 Park']] },
  { who: 'accounting', role: 'accounting', type: 'Money', late: 28, jobs: [['118', 'Send progress bill #3 · 118 Park'], ['wilk', 'Record the deposit · Wilkinson'], ['2385', 'Send the final invoice · 2385 Forest Circle'], ['530', 'Installer pay — Leo, last week']] },
]

export function sampleHistory(today: string): Task[] {
  const out: Task[] = []
  for (let back = 28; back >= 1; back--) {
    const day = addDays(today, -back)
    if (isWeekend(day)) continue
    PLAN.forEach((p, pi) => {
      const per = (back + pi) % 3 === 0 ? 2 : 1
      for (let k = 0; k < per; k++) {
        const h = hash(pi * 7919 + back * 131 + k * 17) % 100
        const lateBy = h < p.late ? 1 + (h % 3) : 0
        const doneDay = lateBy ? afterWorkdays(day, lateBy) : day
        if (doneDay >= today) continue
        const [jobId, title] = p.jobs[(back + k * 2 + pi) % p.jobs.length]
        const moved = lateBy > 0 && h % 2 === 0
        out.push({
          id: `h-${p.who}-${back}-${k}`, jobId, title, type: p.type, owner: p.who, for: [p.role], state: 'done', tone: 'ok',
          due: md(day), doneAt: md(doneDay), doneOn: doneDay, ...(moved ? { rolls: 1 } : {}),
          log: [
            { date: md(day), who: 'system', text: 'Created' },
            ...(moved ? [{ date: md(afterWorkdays(day, 1)), who: p.who, text: `Moved to ${md(doneDay)} — it was late` }] : []),
            { date: md(doneDay), who: p.who, text: 'Done' },
          ],
        })
      }
    })
  }
  return out
}
