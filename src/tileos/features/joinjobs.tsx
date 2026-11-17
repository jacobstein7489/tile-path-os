/* The same project twice — an estimate brought in from Asana ("Upgrades - Gordon 110 Park Place", still pending) and
 * the project itself ("110 Park PL"). Join them: everything on the double (its estimate, files, tasks, messages,
 * history) goes onto the project that's further along, the estimate is marked approved when that project is already
 * won, and the double is gone — from search, from Estimates, from everywhere. */
import * as React from 'react'
import { Search, Merge } from 'lucide-react'
import { useStore, addHist, meOf, NOW } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PRICING_STAGES, STAGE_LABEL, type Job } from '@/tileos/data/model'
import { approveEstimateInAward } from './flows2'

const S = () => useStore.getState()
const ORDER = ['request', 'estimating', 'proposal', 'followup', 'awarded', 'setup', 'verification', 'ready', 'scheduled', 'installation', 'punch', 'closeout', 'complete']
const rank = (j: Job) => Math.max(0, ORDER.indexOf(j.stage))

/** which one stays: the one further along (the real project); the same stage — the one picked */
export function keeperOf(a: Job, b: Job): { keep: Job; drop: Job } {
  return rank(a) > rank(b) ? { keep: a, drop: b } : { keep: b, drop: a }
}

/** join the double into the project: everything on it moves over, the double goes */
export function joinJobs(pickedId: string, otherId: string) {
  const s0 = S()
  const a = s0.jobs[pickedId]
  const b = s0.jobs[otherId]
  if (!a || !b || pickedId === otherId) return
  const { keep, drop } = keeperOf(b, a)
  const keepId = keep.id
  const dropId = drop.id
  s0.commit((st) => {
    const k = st.jobs[keepId]
    if (!k) return
    const won = !PRICING_STAGES.includes(k.stage)
    const hadEstimate = st.estimates.some((e) => e.jobId === keepId)
    /* what's tied to the double, onto the project */
    const move = (list: { jobId?: string }[]) => list.forEach((x) => { if (x.jobId === dropId) x.jobId = keepId })
    move(st.estimates); move(st.tasks); move(st.money); move(st.pos); move(st.ipos); move(st.files); move(st.events as any); move(st.punch)
    move(st.checks); move(st.bookings); move(st.shortages as any); move(st.notices as any); move(st.ready as any); move(st.mats as any)
    /* its rooms, tiles and the like — only where the project has none of its own */
    const take = (rec: Record<string, any>, empty: (v: any) => boolean) => { if (rec[dropId] !== undefined && (rec[keepId] === undefined || empty(rec[keepId]))) rec[keepId] = rec[dropId] }
    const none = (v: any) => (Array.isArray(v) ? !v.length : !v || !Object.keys(v).length)
    take(st.rooms, none); take(st.tiles, none); take(st.prep, none); take(st.pricing, none); take(st.stepRecs, none); take(st.jobSteps as any, none)
    /* what was said and done on both — kept, the project's first */
    const join = (rec: Record<string, any[]>) => { if (rec[dropId]?.length) rec[keepId] = [...(rec[keepId] || []), ...rec[dropId]] }
    join(st.hist as any); join(st.messages as any); join(st.notes as any); join(st.diary as any)
    /* the project is already won: its estimate is the approved one, and pricing it is over */
    if (won && !hadEstimate) {
      const e = st.estimates.find((x) => x.jobId === keepId)
      if (e && e.status !== 'approved') approveEstimateInAward(st, keepId)
    }
    if (won) st.tasks.forEach((t) => { if (t.jobId === keepId && t.type === 'Pricing' && t.state !== 'done' && !t.step) { t.state = 'done'; t.doneAt = 'Just now'; t.log.push({ date: NOW, who: meOf(st.role), text: `Done — ${drop.name} joined into ${k.name}` }) } })
    /* the double, gone */
    delete st.jobs[dropId]
    delete st.rooms[dropId]; delete st.tiles[dropId]; delete st.prep[dropId]; delete st.pricing[dropId]; delete st.stepRecs[dropId]; delete (st.jobSteps as any)[dropId]
    delete (st.hist as any)[dropId]; delete (st.messages as any)[dropId]; delete (st.notes as any)[dropId]; delete (st.diary as any)[dropId]
    addHist(st, keepId, { who: meOf(st.role), kind: 'setup', title: `Joined with ${drop.name}`, detail: 'The same project — its estimate, files, tasks and history are here now' })
  }, `${drop.name} joined into ${keep.name}`, { sub: 'One project now — its estimate, files, tasks and history are on it.' })
  S().closeAll()
  S().open({ t: 'job', id: keepId })
}

/** pick the other one — the same project — and join them */
export function JoinModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const [q, setQ] = React.useState('')
  const [pick, setPick] = React.useState('')
  if (!job) return null
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  /* the likely ones first: the same client, then names that share a number or a word */
  const key = (j: Job) => `${j.name} ${j.client} ${j.address}`.toLowerCase()
  /* the name's numbers and words ("130", "Order") — the address on a project is often its name */
  const mine = `${job.name} ${job.address}`.toLowerCase()
  const share = (j: Job) => (j.name.match(/\d+|[a-z]{4,}/gi) || ([] as string[])).filter((w) => mine.includes(w.toLowerCase())).length
  const list = Object.values(s.jobs).filter((j) => j.id !== jobId && words.every((w) => key(j).includes(w)))
    .sort((a, b) => Number(b.clientId === job.clientId) - Number(a.clientId === job.clientId) || share(b) - share(a) || a.name.localeCompare(b.name)).slice(0, 30)
  const other = pick ? s.jobs[pick] : undefined
  const plan = other ? keeperOf(other, job) : undefined
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="The same project as…"
      sub={`Pick the one that’s the same as ${job.name} — they become one.`}
      footer={
        <>
          {plan && <span className="min-w-0 text-[0.8125rem] text-muted" data-join-plan><b className="font-semibold text-ink-2">{plan.drop.name}</b> goes into <b className="font-semibold text-ink-2">{plan.keep.name}</b></span>}
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Merge />} disabled={!other} onClick={() => other && joinJobs(jobId, other.id)} data-join-go>Join them</Button>
        </>
      }
    >
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a project or an estimate" aria-label="Search projects" className="h-10 w-full rounded-[0.625rem] border border-line bg-white pl-9 pr-3 text-[0.9375rem] text-ink outline-none focus:border-brand-300" data-join-search />
      </label>
      <div className="overflow-hidden rounded-xl border border-line" data-join-list>
        {list.map((j) => (
          <button key={j.id} type="button" onClick={() => setPick(j.id)} aria-pressed={pick === j.id} className={cn('flex w-full min-w-0 items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left first:border-t-0', pick === j.id ? 'bg-brand-50' : 'hover:bg-wash/60')} data-join-row={j.id}>
            <span className={cn('inline-flex h-4 w-4 shrink-0 rounded-full border', pick === j.id ? 'border-[5px] border-brand-600' : 'border-[#c9ced6]')} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.90625rem] font-semibold text-ink">{j.name}</span>
              <span className="block truncate text-[0.78125rem] text-muted">{j.client} · {j.address}</span>
            </span>
            <span className="shrink-0 text-[0.78125rem] font-semibold text-muted">{PRICING_STAGES.includes(j.stage) ? 'Estimate' : 'Project'} · {STAGE_LABEL[j.stage]}</span>
          </button>
        ))}
        {!list.length && <div className="px-4 py-6 text-center text-[0.875rem] text-muted">Nothing matches “{q}”.</div>}
      </div>
    </Modal>
  )
}
