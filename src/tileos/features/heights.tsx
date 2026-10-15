/* Heights — a must at the site check. The site manager measures every tiled wall; the system compares it with what the
 * estimate assumed. The square feet and the materials follow the real height by themselves, and if the walls are taller,
 * a change order goes to the estimator to price — nobody has to remember. */
import * as React from 'react'
import { Ruler, ArrowRight } from 'lucide-react'
import { useStore, addHist, newTask, closeTasks, setIssues, NOW, meOf } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney } from '@/tileos/data/model'
import { type Room, type Surface, tileOf } from '@/tileos/data/jobs'
import { nextCO } from './flows'

const S = () => useStore.getState()
export const isWall = (n: string) => /wall|backsplash|splash|wainscot|niche|tub|shower w/i.test(n)
const ceilingIn = (r: Room) => {
  const m = (r.note || '').match(/(\d+(?:\.\d+)?)\s*['′]\s*ceiling/i)
  return m ? Math.round(Number(m[1]) * 12) : 96
}
/** the height the estimate counted on (or what was measured), in inches */
export function plannedIn(r: Room, x: Surface): number {
  if (x.measured) return x.measured.inches
  const h = x.height || ''
  if (/ceiling/i.test(h)) return ceilingIn(r)
  const ft = h.match(/(\d+(?:\.\d+)?)\s*ft/i)
  if (ft) return Math.round(Number(ft[1]) * 12)
  const inch = h.match(/(\d+(?:\.\d+)?)\s*[″"]/)
  if (inch) return Number(inch[1])
  if (x.dims?.h) return x.dims.h
  if (/backsplash|splash/i.test(x.name)) return 18
  return 96
}
const ftIn = (n: number) => `${Math.floor(n / 12)}′ ${n % 12}″`
/** the walls on a project and how many are measured */
export function heightStatus(s: { rooms: Record<string, Room[]> }, jobId: string) {
  const walls = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.filter((x) => isWall(x.name)).map((x) => ({ room: r, x })))
  return { walls, measured: walls.filter((w) => w.x.measured).length, total: walls.length }
}

type Row = { room: string; surface: string; inches: number; was: number; oldSF?: number; newSF?: number; tile: string }
export function measureHeights(jobId: string, taskId: string | undefined, rows: Row[]) {
  const st0 = S()
  const delta = rows.reduce((n, r) => n + ((r.newSF ?? 0) - (r.oldSF ?? 0)), 0)
  const co = delta > 0 ? nextCO(st0, jobId) : undefined
  const wallRate = st0.items.find((i) => i.id === 'i-wall')
  st0.commit(
    (s) => {
      const j = s.jobs[jobId]
      rows.forEach((r) => {
        const x = s.rooms[jobId]?.find((y) => y.name === r.room)?.surfaces.find((y) => y.name === r.surface)
        if (!x) return
        x.measured = { inches: r.inches, date: NOW, was: r.was }
        x.height = `${r.inches}″`
        if (r.newSF) x.sf = r.newSF
        if (x.state === 'unknown') { x.state = 'ready'; x.reason = undefined }
        x.decided = [...(x.decided || []), `Height ${ftIn(r.inches)} measured on site ${NOW}${r.inches !== r.was ? ` — the estimate had ${ftIn(r.was)}` : ''}`]
      })
      if (taskId) closeTasks(s, [taskId], 'Heights measured')
      closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && t.action?.kind === 'heights:' + jobId && t.state !== 'done').map((t) => t.id), 'Heights measured')
      setIssues(s, jobId, (iss) => iss.filter((i) => !/height/i.test(i.text)))
      const changed = rows.filter((r) => r.inches !== r.was)
      addHist(s, jobId, { who: meOf(s.role), kind: 'field', title: `Wall heights measured · ${rows.length} walls${delta ? ` · ${delta > 0 ? '+' : ''}${delta} SF` : ' · as estimated'}`, detail: changed.length ? changed.map((r) => `${r.room} ${r.surface.toLowerCase()}: ${ftIn(r.was)} → ${ftIn(r.inches)}`).join(' · ') : 'Every wall matches the estimate' })
      if (co && delta > 0) {
        const big = [...rows].sort((a, b) => ((b.newSF ?? 0) - (b.oldSF ?? 0)) - ((a.newSF ?? 0) - (a.oldSF ?? 0)))[0]
        const id = 'co-' + co.toLowerCase() + '-' + jobId
        const estimate = Math.round((delta * (wallRate?.price || 28)) / 10) * 10
        s.money.unshift({
          id, jobId, kind: 'change', title: `${co} · walls taller than the estimate · +${delta} SF`, amount: null, step: -1, state: 'upcoming', due: 'Being priced',
          note: `Measured on site: ${changed.map((r) => `${r.room} ${r.surface.toLowerCase()} ${ftIn(r.was)} → ${ftIn(r.inches)}`).join(' · ')}. Billable the moment the approval is recorded.`,
          log: [{ date: NOW, who: meOf(s.role), text: 'Heights measured on site — more wall than the estimate' }],
          meta: { room: big.room, surface: big.surface, label: 'Wall height', from: ftIn(big.was), to: ftIn(big.inches), sfDelta: delta, tileTag: big.tile, tileSF: delta, ipoQty: `${delta} SF`, ipoAmount: Math.round(delta * (wallRate?.cost || 18)), doTile: true, doIPO: true, by: 'Site manager', estimate },
        })
        newTask(s, { jobId, title: `Price ${co} · walls taller than the estimate`, type: 'Changes', owner: 'estimator', for: ['estimator'], watch: ['owner', 'pm'], state: 'now', due: 'Today', dueTone: 'warn', tone: 'info', where: `+${delta} SF of wall`, detail: `The site manager measured the walls. About ${fmtMoney(estimate)} at our wall rate — check it and send it to the ${j.client ? 'client' : 'GC'}.`, action: { label: 'Price it', kind: 'co:' + id } })
      }
    },
    `Heights saved — ${rows.length} walls${delta ? ` · ${delta > 0 ? '+' : ''}${delta} SF` : ''}`,
    {
      close: true,
      sub: delta > 0 ? `Square feet and materials updated. ${co} goes to the estimator to price.` : delta < 0 ? 'Less wall than the estimate — square feet and materials updated.' : 'Every wall matches the estimate.',
      flow: delta > 0 ? [{ who: meOf(st0.role), label: 'Measured', state: 'done' }, { who: 'estimator', label: `Prices ${co}`, state: 'now' }, { label: 'Client approves', state: 'next' }, { label: 'Crew tiles it', state: 'next' }] : undefined,
    },
  )
}

const OPTS = [96, 84, 72, 48]
export function HeightsModal({ jobId, taskId, level }: { jobId: string; taskId?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const { walls } = heightStatus(s, jobId)
  /* nothing is guessed — each height is what was measured on site */
  const [h, setH] = React.useState<Record<string, number>>({})
  if (!job) return null
  const key = (r: Room, x: Surface) => r.name + '::' + x.name
  const rows: Row[] = walls.filter((w) => h[key(w.room, w.x)]).map((w) => {
    const was = plannedIn(w.room, w.x)
    const inches = h[key(w.room, w.x)]
    const len = w.x.sf ? w.x.sf / (was / 12) : 0
    return { room: w.room.name, surface: w.x.name, inches, was, oldSF: w.x.sf, newSF: len ? Math.round(len * (inches / 12)) : undefined, tile: w.x.tile }
  })
  const delta = rows.reduce((n, r) => n + ((r.newSF ?? 0) - (r.oldSF ?? 0)), 0)
  return (
    <Modal
      level={level}
      size="lg"
      tall
      onClose={s.close}
      title={`Wall heights · ${job.name}`}
      sub="Measured on site. The square feet and materials follow; more wall than the estimate becomes a change order."
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{rows.length} of {walls.length} walls{rows.length ? <> · <b className={cn('font-semibold', delta > 0 ? 'text-warn-700' : 'text-ink')}>{delta > 0 ? '+' : ''}{delta} SF</b>{delta > 0 ? ' → change order' : ''}</> : ''}</span>
          <Button className="ml-auto" variant="primary" disabled={!rows.length} icon={<Ruler />} onClick={() => measureHeights(jobId, taskId, rows)}>Save heights</Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        {walls.map((w) => {
          const k = key(w.room, w.x)
          const was = plannedIn(w.room, w.x)
          const ceil = ceilingIn(w.room)
          const opts = Array.from(new Set([ceil, ...(/backsplash|splash/i.test(w.x.name) ? [18, 24, 36] : OPTS)])).sort((a, b) => b - a)
          const row = rows.find((r) => r.room === w.room.name && r.surface === w.x.name)
          const d = row && row.newSF !== undefined && row.oldSF !== undefined ? row.newSF - row.oldSF : 0
          return (
            <div key={k} className={cn('rounded-2xl border px-4 py-3', row ? 'border-brand-200 bg-brand-50/30' : 'border-line')}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="min-w-0 flex-1 basis-[12.5rem]">
                  <div className="text-[0.90625rem] font-semibold text-ink">{w.room.name} · {w.x.name}</div>
                  <div className="text-[0.78125rem] text-muted">{w.x.measured ? `Measured ${ftIn(w.x.measured.inches)} on ${w.x.measured.date}` : `Estimate counted ${ftIn(was)}`}{w.x.sf ? ` · ${w.x.sf} SF` : ''}{w.x.tile && tileOf(jobId, w.x.tile) ? ` · ${w.x.tile}` : ''}</div>
                </div>
                {row && row.newSF !== undefined && (
                  <div className="flex items-center gap-1.5 text-[0.8125rem] font-semibold tnum">
                    <span className="text-muted">{row.oldSF} SF</span><ArrowRight className="h-3.5 w-3.5 text-faint" /><span className="text-ink">{row.newSF} SF</span>
                    {d !== 0 && <span className={cn('rounded-full px-1.5 py-0.5 text-[0.71875rem]', d > 0 ? 'bg-warn-50 text-warn-700' : 'bg-ok-50 text-ok-700')}>{d > 0 ? '+' : ''}{d}</span>}
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {opts.map((o) => (
                  <button key={o} onClick={() => setH((p) => ({ ...p, [k]: o }))} className={cn('inline-flex h-8 items-center rounded-full border px-3 text-[0.8125rem] font-semibold tnum transition', h[k] === o ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-2 hover:border-brand-300')}>
                    {o === ceil ? `To the ceiling · ${ftIn(o)}` : ftIn(o)}
                  </button>
                ))}
                <span className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-white pl-3 pr-1 text-[0.8125rem] text-muted">
                  Other
                  <input aria-label={`Height of ${w.room.name} ${w.x.name} in inches`} inputMode="numeric" placeholder="in" className="h-6 w-12 rounded-full bg-wash px-2 text-right text-[0.8125rem] tnum text-ink focus:outline-none" onChange={(e) => { const n = Number(e.target.value); if (n > 6 && n < 200) setH((p) => ({ ...p, [k]: n })) }} />
                </span>
              </div>
            </div>
          )
        })}
        {!walls.length && <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-[0.875rem] text-muted">No tiled walls on this project.</div>}
      </div>
    </Modal>
  )
}
