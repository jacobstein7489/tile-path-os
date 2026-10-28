/* The scope of work as Cobblestone prints it — green floor bands, grey rooms, every wall and floor with its quantity.
 * From the project's rooms, or the estimate when it has none yet. Printed straight from the project (Print), or
 * shown in its own window (Scope of work, from the estimate). */
import * as React from 'react'
import { Printer } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { printNode } from '@/tileos/lib/print'
import { tileOf, floorsOf } from '@/tileos/data/jobs'
import { EstimatePaper } from '../estpaper'

/** the scope of work as the printed document — from the project's rooms, or the estimate when it has none yet */
export function ScopeDoc({ jobId, estId, innerRef }: { jobId: string; estId?: string; innerRef: React.RefObject<HTMLDivElement | null> }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const rooms = estId ? [] : s.rooms[jobId] || []
  const est = estId ? s.estimates.find((e) => e.id === estId) : s.estimates.find((e) => e.jobId === jobId && e.status === 'approved')
  if (!job) return null
  const fromEst = !rooms.length && est ? (est.revs.find((r) => r.status === 'draft') || est.revs[est.revs.length - 1]) : undefined
  const GREEN = '#2c4a3e'
  if (fromEst && est) return <EstimatePaper e={est} rev={fromEst} prices={false} innerRef={innerRef} />
  return (
    <div ref={innerRef} className="mx-auto max-w-[47.5rem] bg-white px-10 py-9 font-[Helvetica,Arial,sans-serif] text-[#222] shadow-card max-sm:px-4">
      <div className="flex items-baseline justify-between">
        <div className="text-[1.75rem] font-bold tracking-[0.01em]" style={{ color: GREEN }}>COBBLESTONE</div>
        <div className="text-[0.8125rem] font-bold tracking-[0.04em]" style={{ color: GREEN }}>SCOPE OF WORK</div>
      </div>
      <div className="mt-4 text-[0.875rem] font-bold">{job.name} | {job.address}</div>
      <div className="mt-0.5 flex justify-between text-[0.75rem] text-[#444]">
        <span>{job.client}</span>
        <span>{est ? `Estimate ${est.id}` : 'Scope'} | {est?.approvedOn || job.stageDates?.won || ''}</span>
      </div>
      <div className="mt-6">
        {floorsOf(rooms).map((g) => (
          <section key={g.floor} className="mb-5">
            <div className="flex justify-between px-2 py-2 text-[0.75rem] font-bold uppercase text-white" style={{ background: GREEN }}>
              <span>{g.floor}</span><span>Quantity</span>
            </div>
            {g.rooms.map((r) => (
              <div key={r.name}>
                <div className="mt-1 bg-[#efece5] px-2 py-1.5 text-[0.71875rem] font-bold uppercase">{r.name}{r.note ? <span className="normal-case"> | {r.note}</span> : null}</div>
                {r.surfaces.map((x) => {
                  const t = tileOf(jobId, x.tile)
                  const what = /floor/i.test(x.name) ? 'Floor tile' : /wall|splash|wainscot/i.test(x.name) ? 'Wall tile' : x.name
                  return (
                    <div key={x.name} className="flex justify-between px-2 py-[0.1875rem] text-[0.71875rem]">
                      <span>{x.name} — {what}{t ? ` ${t.size.replace(/\s/g, '').toUpperCase()} (${t.tag} ${t.name})` : ''}{x.height ? ` · ${x.height}` : ''}</span>
                      <span className="tnum">{x.sf ? `${x.sf} SF` : '1 EA'}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </section>
        ))}
      </div>
      <div className="mt-8 flex justify-between border-t border-[#ddd] pt-2 text-[0.625rem] text-[#666]">
        <span>Scope reference{est ? ` — based on estimate ${est.id}` : ''}</span><span>1</span>
      </div>
    </div>
  )
}

/** print the scope of work straight from the project — no window in between */
export function PrintScopeButton({ jobId, className }: { jobId: string; className?: string }) {
  const [on, setOn] = React.useState(false)
  const doc = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!on) return
    const t = setTimeout(() => { printNode(doc.current); setOn(false) }, 60)
    return () => clearTimeout(t)
  }, [on])
  return (
    <>
      <button onClick={() => setOn(true)} data-print-scope className={className}><Printer className="h-3.5 w-3.5" />Print</button>
      {on && <div className="hidden"><ScopeDoc jobId={jobId} innerRef={doc} /></div>}
    </>
  )
}

