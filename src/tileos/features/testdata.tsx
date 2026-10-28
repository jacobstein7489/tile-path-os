/* Test data — a clean slate to test with real work, or the sample back to see how a busy week looks.
 * Whatever is done is kept: on the account when the page runs on claude.ai, in this browser otherwise. */
import * as React from 'react'
import { Cloud, HardDrive, RotateCcw, Eraser, Check, Loader2, CircleSlash } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { Card } from '@/tileos/components/ui/page'
import { useSaveStatus, startFresh, bringBackSample } from '@/tileos/lib/save'
const PRICING_STAGES = ['request', 'estimating', 'proposal', 'followup', 'lost']

export function savedAgo(at?: number) {
  if (!at) return ''
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  const d = new Date(at)
  return `at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

export function TestDataTab() {
  const s = useStore()
  const st = useSaveStatus()
  const [, tick] = React.useState(0)
  React.useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 30000); return () => window.clearInterval(t) }, [])
  const jobs = Object.values(s.jobs)
  const projects = jobs.filter((j) => !PRICING_STAGES.includes(j.stage)).length
  const counts: [number, string][] = [
    [s.estimates.length, s.estimates.length === 1 ? 'estimate' : 'estimates'],
    [projects, projects === 1 ? 'project' : 'projects'],
    [s.tasks.filter((t) => t.state !== 'done').length, 'open tasks'],
    [Object.keys(s.clients).length, Object.keys(s.clients).length === 1 ? 'client' : 'clients'],
    [s.items.length, 'items'],
  ]
  const fromQB = s.items.filter((i) => i.id.startsWith('qb-')).length
  const where = st.where === 'account'
    ? { icon: <Cloud className="h-5 w-5" />, title: 'Saved to your account', sub: 'Open it on your phone or another computer — it’s the same test.' }
    : st.where === 'browser'
      ? { icon: <HardDrive className="h-5 w-5" />, title: 'Saved in this browser', sub: 'Open it here again and everything you did is still there.' }
      : { icon: <CircleSlash className="h-5 w-5" />, title: 'Not being saved', sub: 'This copy is pinned to a test day, so nothing is kept.' }
  return (
    <div className="flex flex-col gap-4">
      <Card pad={false}>
        <div className="flex items-center gap-4 px-6 py-5 max-sm:px-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ok-50 text-ok-600">{where.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[0.9375rem] font-semibold text-ink">{where.title}</div>
            <div className="text-[0.84375rem] text-muted">{where.sub}</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-medium text-muted max-sm:hidden">
            {st.saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</> : st.problem ? <span className="text-warn-700">{st.problem}</span> : st.at ? <><Check className="h-3.5 w-3.5 text-ok-600" />Saved {savedAgo(st.at)}</> : null}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line-2 px-6 py-4 max-sm:px-4">
          <span className="text-[0.8125rem] font-semibold text-muted">{st.mode === 'fresh' ? 'Your own test' : 'Sample data'}</span>
          {counts.map(([n, l]) => (
            <span key={l} className="text-[0.84375rem] text-ink-2"><b className="font-semibold tnum text-ink">{n}</b> {l}</span>
          ))}
          {fromQB > 0 && <span className="text-[0.8125rem] text-muted">{fromQB} items from your QuickBooks</span>}
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <Card>
          <div className="flex items-start gap-4 p-5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wash-2 text-ink-2"><Eraser className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] font-semibold text-ink">Start fresh</div>
              <div className="mt-0.5 text-[0.84375rem] leading-snug text-muted">Clears every project, estimate, task, client, purchase order and payment, so you can run a job from the first call. Your team, logins, items and settings stay.</div>
              <Button className="mt-4" onClick={() => s.open({ t: 'fresh', mode: 'fresh' })}>Start fresh…</Button>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start gap-4 p-5">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wash-2 text-ink-2"><RotateCcw className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] font-semibold text-ink">Bring back the sample</div>
              <div className="mt-0.5 text-[0.84375rem] leading-snug text-muted">The sample projects, estimates and tasks — to see how every screen looks in a busy week. It replaces what’s here now.</div>
              <Button className="mt-4" onClick={() => s.open({ t: 'fresh', mode: 'sample' })}>Bring back the sample…</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

/** asks once before clearing — nothing here can be undone */
export function FreshModal({ mode, level }: { mode: 'fresh' | 'sample'; level: number }) {
  const s = useStore()
  const fresh = mode === 'fresh'
  const go = () => {
    s.close()
    if (fresh) startFresh()
    else bringBackSample()
  }
  return (
    <Modal
      level={level}
      size="sm"
      onClose={s.close}
      title={fresh ? 'Start fresh?' : 'Bring back the sample?'}
      footer={<><Button variant="ghost" onClick={s.close}>Cancel</Button><Button className="ml-auto" variant={fresh ? 'danger' : 'primary'} onClick={go}>{fresh ? 'Clear it and start fresh' : 'Bring back the sample'}</Button></>}
    >
      <div className="flex flex-col gap-3 text-[0.875rem] leading-snug text-ink-2">
        {fresh ? (
          <>
            <p>Every project, estimate, task, client, purchase order, payment and message goes. This can’t be undone.</p>
            <p className="text-muted">Stays: your team and logins, your items and prices, the checklist, automations and company rules.</p>
          </>
        ) : (
          <>
            <p>The sample projects, estimates and tasks come back, as they were.</p>
            <p className="text-muted">What you tested so far is replaced. This can’t be undone.</p>
          </>
        )}
      </div>
    </Modal>
  )
}
