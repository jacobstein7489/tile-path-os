/* A project at a glance — for a meeting about it (a job review): while it's getting ready, its parts, one line each with
 * where each one is (the same list as on the project — tap a part for that step's window); once the crew started, how
 * far it is. Never the whole project: that's one tap away for whoever wants it. */
import * as React from 'react'
import { useStore, meOf, type Store } from '@/tileos/store'
import type { Job } from '@/tileos/data/model'
import { tracksFor, stepShort } from './tracks'
import { pastReady, howFar } from './projectlist'
import { Parts } from './job/standing'
import type { StepView } from './steps'

/** the step on a project that's mine now (a problem first) — the one thing to do after a meeting about it */
export function nextForMe(s: Store, job: Job): { v: StepView; label: string } | undefined {
  if (pastReady(job)) return undefined
  const me = meOf(s.role)
  const steps = tracksFor(s, job).flatMap((x) => x.steps).filter((v) => v.owner === me && (v.state === 'bad' || v.state === 'now'))
  const v = steps.find((x) => x.state === 'bad') || steps[0]
  return v ? { v, label: v.action?.label || stepShort(s, job, v) } : undefined
}

export function JobGlance({ job }: { job: Job }) {
  const s = useStore()
  if (pastReady(job)) {
    const f = howFar(s, job)
    return (
      <div className="rounded-[0.875rem] border border-line bg-white px-4 py-3" data-job-glance="far">
        <div className="mb-2 text-[0.8125rem] font-semibold text-ink">How far it is</div>
        <div className="flex items-center gap-3">
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5e0d7]"><span className="block h-full rounded-full bg-[#2c8a5b]" style={{ width: `${Math.max(0, Math.min(100, f.pct))}%` }} /></span>
          <span className="shrink-0 text-[0.875rem] font-semibold tnum text-ink">{f.text}</span>
        </div>
      </div>
    )
  }
  const tracks = tracksFor(s, job)
  if (!tracks.length) return null
  return (
    <div data-job-glance="ready">
      <Parts job={job} tracks={tracks} onPick={(t) => { const k = (t.state !== 'done' && t.lead?.key) || t.steps[t.steps.length - 1]?.key; if (k) s.open({ t: 'step', jobId: job.id, k }) }} />
    </div>
  )
}
