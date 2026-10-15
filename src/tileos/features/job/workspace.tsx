/* A project as its own page (Open full page from the project window). The window and the page are the same
 * thing — see project-window.tsx. */
import * as React from 'react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import type { StepNode } from '@/tileos/components/ui/progress'
import { JOB_TRACK, type Job } from '@/tileos/data/model'
import { ProjectPage } from './project-window'

export type JobTab = 'overview' | 'setup' | 'rooms' | 'materials' | 'pos' | 'money' | 'files' | 'history' | 'pricing'

export function jobTrack(job: Job): StepNode[] {
  const cur = JOB_TRACK.findIndex((n) => n.stages.includes(job.stage === 'awarded' ? 'setup' : job.stage))
  return JOB_TRACK.map((n, i) => {
    const date = job.stageDates?.[n.key]
    let state: StepNode['state'] = i < cur ? 'done' : i === cur ? 'current' : 'future'
    if (job.stage === 'complete') state = 'done'
    let sub = ''
    if (state === 'done') sub = date || 'Done'
    if (state === 'current') {
      if (n.key === 'installation') sub = `Now · ${job.pct ?? 0}%`
      else if (n.key === 'ready') sub = job.readiness === 'partial' ? 'With restrictions' : 'Now'
      else sub = 'Now' + (date ? ` · since ${date}` : '')
      if (job.status === 'bad' && ['setup', 'ready', 'punch'].includes(n.key)) state = 'blocked'
    }
    if (state === 'future' && n.key === 'installation' && job.dates?.start) sub = job.dates.start
    return { key: n.key, label: n.label, sub, state }
  })
}

export function JobPage() {
  const route = useStore((s) => s.route)
  const job = useStore((s) => s.jobs[route.id || ''])
  const go = useStore((s) => s.go)
  if (!job)
    return (
      <div className="py-20 text-center">
        <div className="text-[1.125rem] font-semibold text-ink">That project isn’t here anymore.</div>
        <Button className="mt-4" onClick={() => go({ page: 'projects' })}>Back to Projects</Button>
      </div>
    )
  return <div className="animate-fade-up"><ProjectPage job={job} tab={route.tab} /></div>
}
