/* What's mine on a project, for a meeting about it: the one step that's my turn now (a problem first) — the meeting
 * window's button. The meeting window itself shows the meeting and nothing else; the project is one tap away. */
import { meOf, type Store } from '@/tileos/store'
import type { Job } from '@/tileos/data/model'
import { tracksFor, stepShort } from './tracks'
import { pastReady } from './projectlist'
import type { StepView } from './steps'

/** the step on a project that's mine now (a problem first) — the one thing to do after a meeting about it */
export function nextForMe(s: Store, job: Job): { v: StepView; label: string } | undefined {
  if (pastReady(job)) return undefined
  const me = meOf(s.role)
  const steps = tracksFor(s, job).flatMap((x) => x.steps).filter((v) => v.owner === me && (v.state === 'bad' || v.state === 'now'))
  const v = steps.find((x) => x.state === 'bad') || steps[0]
  return v ? { v, label: v.action?.label || stepShort(s, job, v) } : undefined
}
