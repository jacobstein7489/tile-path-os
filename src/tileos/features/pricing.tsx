import * as React from 'react'
import { FileCheck2, FileWarning, Send, Phone, Mail, MessageSquare, Users, CheckCircle2, Circle, Award, XCircle, Clock3, RotateCcw, Ruler, HelpCircle, Upload, ArrowRight, Building2, CalendarDays, Sparkles, Trophy, Lock, Plus } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore, historyOf } from '@/tileos/store'
import { Card, CardHeader, Button, Pill, Avatar, Chip, OptionCard, Field, TextInput, TextArea, NumberBadge, IconCircle, Count } from '@/tileos/components/ui/core'
import { Modal, DatePresets } from '@/tileos/components/ui/overlay'
import { Stepper, StepSummary, type StepNode, Ring } from '@/tileos/components/ui/progress'
import { cn, TONE } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type Job, type PersonKey } from '@/tileos/data/model'
import { OUTCOMES } from '@/tileos/data/work'
import type { Pricing } from '@/tileos/data/jobs'
import { assignEstimator, requestDoc, markDocIn, startEstimating, toggleArea, answerEstimQuestion, estimateReady, setRevAmount, sendProposal, recordFollowUp, award } from './flows'
import { weekOf, monthName } from '@/tileos/lib/today'

function pricingNodes(job: Job, p: Pricing): StepNode[] {
  const order = ['request', 'estimating', 'proposal', 'followup']
  const cur = order.indexOf(job.stage)
  const latest = [...p.revs].reverse()[0]
  const subs = [
    p.docs.every((d) => d.status === 'in') ? 'Docs in' : `${p.docs.filter((d) => d.status === 'missing').length} docs missing`,
    p.takeoff ? `Takeoff ${p.takeoff.pct}%` : 'Not started',
    latest ? `${latest.r} · ${latest.status.toLowerCase()}` : '—',
    p.nextFollowUp ? `Next: ${p.nextFollowUp}` : p.fu.length ? `${p.fu.length} logged` : '—',
    '—',
  ]
  return ['Request', 'Estimating', 'Proposal', 'Follow-up', 'Award'].map((l, i) => ({
    key: l,
    label: l,
    sub: i < cur ? (i === 0 ? 'Done' : subs[i]) : i === cur ? subs[i] : i === 4 ? '' : '',
    state: i < cur ? 'done' : i === cur ? (job.status === 'bad' ? 'blocked' : 'current') : 'future',
  }))
}

export function PricingWorkspace({ job }: { job: Job }) {
  const s = useStore()
  const p = s.pricing[job.id]
  if (!p) return null
  const hist = historyOf(s, job.id).slice(0, 5)
  const latest = [...p.revs].reverse().find((r) => r.amount)
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-line bg-white px-6 pb-4 pt-5 shadow-card max-sm:hidden">
        <Stepper nodes={pricingNodes(job, p)} />
      </div>
      <StepSummary nodes={pricingNodes(job, p)} className="border-line bg-white shadow-card sm:hidden" />
      <div className="grid grid-cols-[minmax(0,1fr)_20.625rem] gap-6 max-md:grid-cols-1 max-md:gap-4">
        <div className="flex min-w-0 flex-col gap-6">
          {job.stage === 'request' && <RequestPanel job={job} p={p} />}
          {job.stage === 'estimating' && <EstimatingPanel job={job} p={p} />}
          {job.stage === 'proposal' && <ProposalPanel job={job} p={p} />}
          {job.stage === 'followup' && <FollowUpPanel job={job} p={p} />}
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="The bid" />
            <div className="flex flex-col gap-3.5 px-6 pb-6 max-sm:px-4">
              <Row label={job.stage === 'followup' ? 'Sent' : 'Bid due'} value={job.stage === 'followup' ? job.keyDate.value : p.due} />
              <Row label="Estimator" value={p.estimator ? <span className="inline-flex items-center gap-2"><Avatar who={p.estimator} size={22} />{PEOPLE[p.estimator].name}</span> : <span className="text-warn-700">Not assigned</span>} />
              <Row label="Client" value={<button onClick={() => s.open({ t: 'customer', id: job.clientId })} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"><Building2 className="h-4 w-4" />{job.client}</button>} />
              <Row label="Contact" value={p.contact} />
              <Row label="Latest amount" value={latest ? `${fmtMoney(latest.amount!)} · ${latest.r}` : '—'} />
              {p.nextFollowUp && <Row label="Next follow-up" value={<span className="text-warn-700">{p.nextFollowUp}</span>} />}
            </div>
          </Card>
          <Card>
            <CardHeader title="Scope" />
            <p className="px-6 pb-6 text-[0.90625rem] leading-relaxed text-ink-2">{p.scope}</p>
          </Card>
          <Card>
            <CardHeader title="Latest activity" />
            <div className="flex flex-col gap-3 px-6 pb-6">
              {hist.map((h, i) => (
                <div key={i} className="flex gap-3">
                  <Avatar who={h.who} size={24} />
                  <div className="min-w-0">
                    <div className="text-[0.84375rem] font-medium text-ink">{h.title}</div>
                    <div className="text-[0.75rem] text-muted">{h.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-[0.84375rem] text-muted">{label}</span>
    <span className="text-right text-[0.875rem] font-semibold text-ink">{value}</span>
  </div>
)

function RequestPanel({ job, p }: { job: Job; p: Pricing }) {
  const missing = p.docs.filter((d) => d.status === 'missing')
  return (
    <>
      <Card>
        <CardHeader icon={<NumberBadge n={1} />} title="What came in" sub="An attachment is evidence — the status is what we track." />
        <div className="grid grid-cols-3 gap-3 px-6 pb-6 max-lg:grid-cols-1 max-sm:px-4">
          {p.docs.map((d) => {
            const inn = d.status === 'in'
            const requested = /requested/i.test(d.note)
            return (
              <div key={d.name} className={cn('flex flex-col rounded-2xl border p-4', inn ? 'border-line' : 'border-warn-100 bg-warn-50/50')}>
                <div className="flex items-center gap-3">
                  <span className={cn('inline-flex h-11 w-11 items-center justify-center rounded-xl', inn ? 'bg-ok-50 text-ok-600' : 'bg-warn-100 text-warn-700')}>
                    {inn ? <FileCheck2 className="h-5 w-5" /> : <FileWarning className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[0.9375rem] font-semibold text-ink">{d.name}</div>
                    <div className={cn('text-[0.78125rem]', inn ? 'text-muted' : 'font-medium text-warn-700')}>{inn ? d.note : requested ? d.note : 'Missing'}</div>
                  </div>
                </div>
                {!inn && (
                  <div className="mt-3.5 flex gap-2">
                    {!requested && <Button size="xs" variant="primary" onClick={() => requestDoc(job.id, d.name)}>Request from GC</Button>}
                    <Button size="xs" onClick={() => markDocIn(job.id, d.name)}>Mark received</Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
      <Card>
        <CardHeader icon={<NumberBadge n={2} />} title="Who estimates it?" />
        <div className="flex flex-wrap items-center gap-3 px-6 pb-6">
          {(['estimator', 'ys'] as PersonKey[]).map((who) => (
            <Chip key={who} on={p.estimator === who} onClick={() => assignEstimator(job.id, who)} className="h-12 px-4" icon={<Avatar who={who} size={26} />}>
              {PEOPLE[who].name}
            </Chip>
          ))}
        </div>
      </Card>
      <div className="flex items-center gap-5 rounded-2xl border border-line bg-white px-6 py-5 shadow-card max-sm:flex-wrap max-sm:gap-3 max-sm:px-4">
        <IconCircle tone="info" size={46} className="max-sm:hidden"><Ruler className="h-5 w-5" /></IconCircle>
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-semibold text-ink">Start estimating</div>
          <div className="text-[0.84375rem] text-muted">{missing.length ? `${missing.length} document${missing.length > 1 ? 's' : ''} still missing — they stay on follow-up while you start.` : 'Everything is in.'}</div>
        </div>
        <Button size="lg" variant="primary" className="max-sm:w-full" disabled={!p.estimator} icon={!p.estimator ? <Lock className="h-[1.125rem] w-[1.125rem]" /> : undefined} onClick={() => startEstimating(job.id)}>
          {p.estimator ? 'Start estimating' : 'Pick an estimator first'}
        </Button>
      </div>
    </>
  )
}

function EstimatingPanel({ job, p }: { job: Job; p: Pricing }) {
  const t = p.takeoff!
  const [answer, setAnswer] = React.useState('')
  const [excl, setExcl] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const gates = [
    { l: 'Takeoff complete', ok: t.pct === 100 },
    { l: 'Open questions answered', ok: !t.question },
    { l: 'Exclusions and allowances reviewed', ok: excl },
    { l: 'Price entered', ok: Number(amount.replace(/[^0-9]/g, '')) > 0 },
  ]
  const ok = gates.every((g) => g.ok)
  return (
    <>
      <Card>
        <CardHeader icon={<NumberBadge n={1} />} title="Takeoff" sub="Tick each area as it’s measured." action={<span className="inline-flex items-center gap-2 text-[0.875rem] font-semibold text-ink-2"><Ring pct={t.pct} size={36} stroke={4} tone={t.pct === 100 ? 'ok' : 'info'} />{t.pct}%</span>} />
        <div className="border-t border-line-2">
          {t.areas.map((a, i) => (
            <button key={a.name} onClick={() => toggleArea(job.id, i)} className="flex w-full items-center gap-3.5 border-b border-line-2 px-6 py-3.5 text-left last:border-0 row-hover max-sm:px-4">
              {a.done ? <CheckCircle2 className="h-[1.375rem] w-[1.375rem] fill-ok-500 text-white" /> : <Circle className="h-[1.375rem] w-[1.375rem] text-[#CDD4DE]" />}
              <span className="flex-1 text-[0.90625rem] font-semibold text-ink">{a.name}</span>
              <span className="text-[0.875rem] tnum text-ink-2">{a.sf}</span>
            </button>
          ))}
        </div>
        <div className="px-6 py-3.5">
          <Button size="xs" variant="ghost" icon={<Upload className="h-4 w-4" />} onClick={() => toast('Takeoff file attached (demo)')}>Attach takeoff file</Button>
        </div>
      </Card>
      {t.question && (
        <Card className="border-warn-100">
          <CardHeader icon={<IconCircle tone="warn" size={30}><HelpCircle className="h-4 w-4" /></IconCircle>} title="Open question" sub={`Waiting on the ${t.question.waitingOn.toLowerCase()} since ${t.question.since}`} />
          <div className="px-6 pb-6">
            <div className="rounded-xl bg-wash px-4 py-3 text-[0.9375rem] font-medium text-ink">{t.question.text}</div>
            <div className="mt-3 flex gap-2.5 max-sm:flex-col">
              <TextInput value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type the answer when it comes in…" />
              <Button variant="primary" disabled={!answer.trim()} onClick={() => answerEstimQuestion(job.id, answer.trim())}>Record answer</Button>
            </div>
            <div className="mt-2 text-[0.78125rem] text-muted">The answer becomes part of the estimate record. The question stays in history.</div>
          </div>
        </Card>
      )}
      <Card>
        <CardHeader icon={<NumberBadge n={2} />} title="Estimate ready" sub="The system checks the gates — it tells you exactly what’s missing." />
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 max-sm:grid-cols-1 max-sm:px-4">
          {gates.map((g) => (
            <div key={g.l} className="flex items-center gap-2.5 text-[0.90625rem]">
              {g.ok ? <CheckCircle2 className="h-5 w-5 text-ok-500" /> : <Circle className="h-5 w-5 text-[#CDD4DE]" />}
              <span className={g.ok ? 'text-ink' : 'text-muted'}>{g.l}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-end gap-3 border-t border-line-2 px-6 py-5 max-sm:flex-wrap max-sm:px-4">
          <Field label="Price (from QuickBooks estimate)" className="w-[15rem] max-sm:w-full">
            <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0" />
          </Field>
          <Chip on={excl} onClick={() => setExcl((v) => !v)} className="h-11">Exclusions reviewed</Chip>
          <Button size="md" className="ml-auto max-sm:flex-1" variant="primary" disabled={!ok} onClick={() => estimateReady(job.id, Number(amount.replace(/[^0-9]/g, '')))}>
            Estimate ready
          </Button>
        </div>
      </Card>
    </>
  )
}

function RevCards({ job, p, editable }: { job: Job; p: Pricing; editable?: boolean }) {
  const [amt, setAmt] = React.useState('')
  return (
    <div className="flex flex-col gap-3">
      {[...p.revs].reverse().map((r) => {
        const draft = r.status === 'Pricing' || r.status === 'Draft'
        const tone = r.status === 'Sent' ? 'info' : r.status === 'Approved' ? 'ok' : r.status === 'Superseded' ? 'neutral' : 'vio'
        return (
          <div key={r.r} className={cn('flex items-center gap-4 rounded-2xl border p-4 max-sm:flex-wrap max-sm:gap-3', draft ? 'border-vio-100 bg-vio-50/40' : 'border-line')}>
            <span className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[1rem] font-bold', r.status === 'Superseded' ? 'bg-wash-2 text-muted' : 'bg-brand-50 text-brand-700')}>{r.r}</span>
            <div className="min-w-0 flex-1">
              <div className={cn('truncate text-[0.9375rem] font-semibold', r.status === 'Superseded' ? 'text-muted' : 'text-ink')}>{r.what}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted">
                <Pill tone={tone as any} size="sm">{r.status === 'Pricing' ? 'Being priced' : r.status}</Pill>
                {r.date === '—' ? 'Not sent yet' : `Sent ${r.date}`}
              </div>
            </div>
            {draft && editable && !r.amount ? (
              <div className="flex items-center gap-2 max-sm:w-full">
                <TextInput value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="Price" className="w-[8.125rem] max-sm:w-full max-sm:flex-1" />
                <Button size="sm" disabled={!amt} onClick={() => setRevAmount(job.id, r.r, Number(amt.replace(/[^0-9]/g, '')))}>Save</Button>
              </div>
            ) : (
              <div className={cn('text-[1.125rem] font-bold tnum', r.status === 'Superseded' ? 'text-muted line-through decoration-faint' : 'text-ink')}>{r.amount ? fmtMoney(r.amount) : '—'}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ProposalPanel({ job, p }: { job: Job; p: Pricing }) {
  const draft = [...p.revs].reverse().find((r) => r.status === 'Pricing' || r.status === 'Draft')
  return (
    <>
      <Card>
        <CardHeader icon={<NumberBadge n={1} />} title="Revisions" sub="Every revision side by side — nothing overwritten." />
        <div className="px-6 pb-6"><RevCards job={job} p={p} editable /></div>
      </Card>
      <div className="flex items-center gap-5 rounded-2xl border border-line bg-white px-6 py-5 shadow-card max-sm:flex-wrap max-sm:gap-3 max-sm:px-4">
        <IconCircle tone="info" size={46} className="max-sm:hidden"><Send className="h-5 w-5" /></IconCircle>
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-semibold text-ink">Send {draft?.r}</div>
          <div className="text-[0.84375rem] text-muted">Logs the revision, amount and date, and sets the first follow-up for Thursday.</div>
        </div>
        <Button size="lg" variant="primary" className="max-sm:w-full" icon={<Send className="h-[1.125rem] w-[1.125rem]" />} disabled={!draft?.amount} onClick={() => sendProposal(job.id)}>
          {draft?.amount ? `Send ${draft.r}` : 'Enter the price first'}
        </Button>
      </div>
    </>
  )
}

function FollowUpPanel({ job, p }: { job: Job; p: Pricing }) {
  const open = useStore((s) => s.open)
  return (
    <>
      <Card>
        <div className="flex items-center gap-4 px-6 py-5 max-sm:flex-wrap max-sm:gap-3 max-sm:px-4">
          <IconCircle tone="warn" size={48} className="max-sm:hidden"><Clock3 className="h-5 w-5" /></IconCircle>
          <div className="min-w-0 flex-1">
            <div className="text-[0.8125rem] font-semibold text-muted">Waiting on the client</div>
            <div className="h-tight text-[1.25rem] font-bold text-ink max-sm:text-[1.125rem]">Next follow-up: {p.nextFollowUp || 'not set'}</div>
          </div>
          <Button size="lg" variant="primary" className="max-sm:w-full" icon={<Phone className="h-[1.125rem] w-[1.125rem]" />} onClick={() => open({ t: 'followup', jobId: job.id })}>Record follow-up</Button>
        </div>
        <div className="border-t border-line-2 px-6 py-4 max-sm:px-4">
          <div className="mb-2.5 text-[0.8125rem] font-semibold text-muted">How did it go? One tap</div>
          <div className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
            {OUTCOMES.map((o) => (
              <button key={o.key} onClick={() => open({ t: 'followup', jobId: job.id, outcome: o.key })} className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40">
                <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE[o.tone].dot)} />
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-semibold text-ink">{o.label}</span>
                  <span className="block truncate text-[0.78125rem] text-muted">{o.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1 max-sm:gap-4">
        <Card>
          <CardHeader title="Revisions" />
          <div className="px-6 pb-6"><RevCards job={job} p={p} /></div>
        </Card>
        <Card>
          <CardHeader title="Follow-up log" count={p.fu.length} sub="Replaces the Asana comment thread." />
          <div className="flex flex-col gap-0 px-6 pb-6">
            {[...p.fu].reverse().map((f, i) => (
              <div key={i} className="flex gap-3 border-b border-line-2 py-3 last:border-0">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wash-2 text-muted">
                  {f.how === 'Emailed' ? <Mail className="h-4 w-4" /> : f.how === 'Texted' ? <MessageSquare className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[0.875rem] font-semibold text-ink">{f.how} — {f.outcome.toLowerCase()}</div>
                  {f.note && <div className="text-[0.8125rem] text-ink-2">{f.note}</div>}
                  <div className="text-[0.75rem] text-muted">{f.date} · {PEOPLE[f.by].name}</div>
                </div>
              </div>
            ))}
            {!p.fu.length && <div className="py-3 text-[0.875rem] text-muted">No follow-ups yet.</div>}
          </div>
        </Card>
      </div>
    </>
  )
}

/* ---------------- follow-up popup ---------------- */
export function FollowUpModal({ jobId, outcome: initial, level }: { jobId: string; outcome?: string; level: number }) {
  const job = useStore((s) => s.jobs[jobId])
  const p = useStore((s) => s.pricing[jobId])
  const close = useStore((s) => s.close)
  const [how, setHow] = React.useState('Called')
  const [outcome, setOutcome] = React.useState(initial || '')
  const o = OUTCOMES.find((x) => x.key === outcome)
  const [next, setNext] = React.useState(o?.next || 'Fri')
  const [changes, setChanges] = React.useState('')
  const [note, setNote] = React.useState('')
  const [reason, setReason] = React.useState('')
  React.useEffect(() => {
    if (o?.next) setNext(o.next === 'In 2 weeks' ? 'In 2 weeks' : o.next)
  }, [outcome])
  if (!job || !p) return null
  const nextRev = 'R' + (p.revs.length + 1)
  const label = outcome === 'approved' ? 'Approved — make it a project' : outcome === 'revision' ? `Open ${nextRev} for the estimator` : outcome === 'lost' ? 'Mark not won' : 'Save follow-up'
  return (
    <Modal
      level={level}
      size="lg"
      onClose={close}
      title={`Follow-up · ${job.name}`}
      sub={`${[...p.revs].reverse().find((r) => r.status === 'Sent')?.r || 'Proposal'} · logged in the project history, no comment needed`}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{outcome && ['reviewing', 'noanswer', 'later'].includes(outcome) ? `It leaves Today and comes back ${next}.` : outcome === 'approved' ? 'Next: it becomes a project.' : ''}</span>
          <Button className="ml-auto" variant="ghost" onClick={close}>Cancel</Button>
          <Button
            variant={outcome === 'lost' ? 'danger' : 'primary'}
            disabled={!outcome || (outcome === 'lost' && !reason)}
            onClick={() => recordFollowUp(jobId, { how, outcome, next, note: outcome === 'lost' ? reason + (note ? ' · ' + note : '') : note, changes })}
          >
            {label}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="How">
          <div className="flex flex-wrap gap-2">
            {[['Called', Phone], ['Emailed', Mail], ['Texted', MessageSquare], ['Spoke in person', Users]].map(([l, I]: any) => (
              <Chip key={l} on={how === l} onClick={() => setHow(l)} icon={<I className="h-4 w-4" />}>{l}</Chip>
            ))}
          </div>
        </Field>
        <Field label="What happened">
          <div className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
            {OUTCOMES.map((x) => (
              <OptionCard key={x.key} on={outcome === x.key} onClick={() => setOutcome(x.key)} title={x.label} sub={x.hint} />
            ))}
          </div>
        </Field>
        {outcome && ['reviewing', 'noanswer', 'later'].includes(outcome) && (
          <Field label="Bring it back">
            <DatePresets value={next} onPick={setNext} presets={['Tomorrow', 'Thu', 'Fri', 'Next Mon', 'In 2 weeks']} />
          </Field>
        )}
        {outcome === 'revision' && (
          <Field label={`What should change in ${nextRev}?`} hint={`Revision ${p.revs.length} stays exactly as it was.`}>
            <div className="mb-2.5 flex flex-wrap gap-2">
              {['Remove a room', 'Add a room', 'Different tile', 'Change the height', 'Price too high'].map((c) => (
                <Chip key={c} on={changes === c} onClick={() => setChanges(c)} className="h-9 px-3 text-[0.84375rem]">{c}</Chip>
              ))}
            </div>
            <TextInput value={changes} onChange={(e) => setChanges(e.target.value)} placeholder="e.g. Remove the basement bath, add two fireplace walls" />
          </Field>
        )}
        {outcome === 'lost' && (
          <Field label="Why didn’t it go ahead?">
            <div className="flex flex-wrap gap-2">
              {['Price', 'Went with another installer', 'Project cancelled', 'Timing', 'Other'].map((c) => (
                <Chip key={c} on={reason === c} onClick={() => setReason(c)} className="h-9 px-3 text-[0.84375rem]">{c}</Chip>
              ))}
            </div>
          </Field>
        )}
        <Field label="Note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was actually said" />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- award popup ---------------- */
export function AwardModal({ jobId, level }: { jobId: string; level: number }) {
  const job = useStore((s) => s.jobs[jobId])
  const p = useStore((s) => s.pricing[jobId])
  const rules = useStore((s) => s.rules)
  const close = useStore((s) => s.close)
  const revs = p ? [...p.revs].reverse().filter((r) => r.amount) : []
  const [rev, setRev] = React.useState(revs.find((r) => r.status === 'Sent')?.r || revs[0]?.r || '')
  const chosen = revs.find((r) => r.r === rev)
  const [amount, setAmount] = React.useState(chosen?.amount ? fmtMoney(chosen.amount) : '')
  const [dep, setDep] = React.useState(rules.depositPct)
  const [custPO, setCustPO] = React.useState<boolean | null>(null)
  const [start, setStart] = React.useState('')
  const [pm, setPm] = React.useState<PersonKey>('ys')
  React.useEffect(() => setAmount(chosen?.amount ? fmtMoney(chosen.amount) : ''), [rev])
  if (!job || !p) return null
  const amt = Number(String(amount).replace(/[^0-9]/g, ''))
  const missing = [!rev && 'the revision', custPO === null && 'client PO', !start && 'start window'].filter(Boolean) as string[]
  const handoff = [
    { who: 'office' as PersonKey, what: 'Build the project', sub: 'Rooms, surfaces, finish records, who supplies what' },
    ...(dep ? [{ who: 'accounting' as PersonKey, what: `Deposit invoice · ${fmtMoney(Math.round((amt * dep) / 100))}`, sub: `${dep}% · ${rules.depositRule === 'warn' ? 'warning, with reminders' : 'blocks the start'} until received` }] : []),
    { who: 'materials' as PersonKey, what: 'Check the tile order against our takeoff', sub: 'Then plan our setting materials and POs' },
    ...(custPO ? [{ who: 'office' as PersonKey, what: 'Collect the client PO', sub: 'Waiting on the client, back Friday' }] : []),
    { who: pm, what: 'Review the setup · plan the start', sub: start ? `Start window: ${start}` : 'Start window not set' },
  ]
  return (
    <Modal
      level={level}
      size="xl"
      onClose={close}
      title={`${job.name} — approved`}
      sub="It becomes a project and goes on the Schedule to get ready."
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{missing.length ? `Still needed: ${missing.join(', ')}` : `${handoff.length} people get their part the moment you press it.`}</span>
          <Button className="ml-auto" variant="ghost" onClick={close}>Cancel</Button>
          <Button size="lg" variant="primary" icon={<Trophy className="h-[1.125rem] w-[1.125rem]" />} disabled={missing.length > 0 || !amt} onClick={() => award(jobId, { rev, amount: amt, depositPct: dep, custPO: !!custPO, start, pm })}>
            Make it a project
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_25rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <div className="flex flex-col gap-6">
          <Field label="Which revision did they approve?">
            <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
              {revs.map((r) => (
                <OptionCard key={r.r} on={rev === r.r} onClick={() => setRev(r.r)} title={`${r.r} · ${fmtMoney(r.amount!)}`} sub={`${r.what} · ${r.date === '—' ? 'not sent' : 'sent ' + r.date}`} />
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
            <Field label="Contract amount" hint="Frozen as what was sold.">
              <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Deposit" hint={dep ? `${fmtMoney(Math.round((amt * dep) / 100))} · company rule: ${rules.depositRule === 'warn' ? 'warn before start' : 'block start'}` : 'No deposit on this project'}>
              <div className="flex gap-2">
                {[0, 10, 20, 30].map((d) => (
                  <Chip key={d} on={dep === d} onClick={() => setDep(d)} className="h-11 px-3.5">{d ? d + '%' : 'None'}</Chip>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Do they need to send us a PO or contract?">
            <div className="flex gap-2">
              <Chip on={custPO === true} onClick={() => setCustPO(true)}>Yes — we need their PO</Chip>
              <Chip on={custPO === false} onClick={() => setCustPO(false)}>No</Chip>
            </div>
          </Field>
          <Field label="Expected start">
            <div className="flex flex-wrap gap-2">
              {[weekOf(1), weekOf(2), monthName(1), 'Not known yet'].map((w) => (
                <Chip key={w} on={start === w} onClick={() => setStart(w)}>{w}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Project manager">
            <div className="flex gap-2">
              <Chip on={pm === 'ys'} onClick={() => setPm('ys')} icon={<Avatar who="ys" size={22} />}>Yaakov Stein</Chip>
            </div>
          </Field>
        </div>
        <div className="self-start rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/70 to-white p-5">
          <div className="flex items-center gap-2.5">
            <IconCircle tone="info" size={34}><Sparkles className="h-4 w-4" /></IconCircle>
            <div className="text-[0.96875rem] font-semibold text-ink">Who gets what</div>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {handoff.map((h, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-line bg-white p-3">
                <Avatar who={h.who} size={32} />
                <div className="min-w-0">
                  <div className="text-[0.78125rem] font-semibold text-muted">{PEOPLE[h.who].roleLabel}</div>
                  <div className="text-[0.875rem] font-semibold text-ink">{h.what}</div>
                  <div className="text-[0.78125rem] text-muted">{h.sub}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-white/60 p-3 text-[0.8125rem] text-muted">
              <CalendarDays className="h-4 w-4" /> Scheduling sees it coming — awarded is not the same as ready.
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
