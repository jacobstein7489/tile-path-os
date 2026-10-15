import * as React from 'react'
import { Droplets, ArrowRight, Check, CheckCircle2, AlertTriangle, Package, CalendarDays, Smartphone, Receipt, Layers3, ScrollText, Camera, Truck, HardHat, Clock3, Repeat, Building2, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { keepFiles } from '@/tileos/lib/files'
import { REAL, backToMe } from '@/tileos/lib/save'
import { useStore, signInAs, meOf } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { Button, OptionCard, Chip, Field, Pill, IconCircle, Avatar, Stepper as NumStepper, TextInput } from '@/tileos/components/ui/core'
import { Swatch, TileImg } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, PEOPLE, ROLES, roleDef, type Role, LOGIN_TYPES, loginOf } from '@/tileos/data/model'
import { tileOf } from '@/tileos/data/jobs'
import { needWithWaste } from '@/tileos/data/work'
import { DRAIN_ANSWERS, resolveDrain, approveCO004, thinsetDecision, settleQty, receiveMat, receiveTile, verifyPunch } from './flows'
import { shiftText, shiftDeep } from '@/tileos/lib/today'

function JobHead({ jobId, kicker, title, right }: { jobId: string; kicker: string; title: string; right?: React.ReactNode }) {
  const job = useStore((s) => s.jobs[jobId])
  return (
    <div className="flex items-center gap-4 border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
      <div className="min-w-0 flex-1">
        <div className="text-[0.84375rem] font-medium text-muted">{job?.name} · {kicker}</div>
        <h2 className="h-tight text-[1.375rem] font-bold text-ink max-sm:text-[1.1875rem]">{title}</h2>
      </div>
      {right}
    </div>
  )
}

export function DrainModal({ level }: { level: number }) {
  const close = useStore((s) => s.close)
  const [pick, setPick] = React.useState<number | null>(null)
  return (
    <Modal
      level={level}
      size="md"
      onClose={close}
      title="Drain answer"
      header={<JobHead jobId="119" kicker="Master Bath · shower floor · drain" title="Record the plumber’s answer" right={<Pill tone="bad">Blocks 1 surface</Pill>} />}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">The answer becomes a permanent installation direction.</span>
          <Button className="ml-auto" variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={pick === null} onClick={() => resolveDrain(pick!)}>Save answer</Button>
        </>
      }
    >
      <div className="mb-5 rounded-2xl bg-wash px-4 py-3.5">
        <div className="text-[0.8125rem] font-semibold text-muted">{shiftText('The question · asked Sep 22')}</div>
        <div className="mt-1 text-[0.96875rem] font-medium text-ink">Is this the final drain, and does the trim go in before or after tile?</div>
      </div>
      <div className="flex flex-col gap-2.5">
        {DRAIN_ANSWERS.map((a, i) => (
          <OptionCard key={i} on={pick === i} onClick={() => setPick(i)} title={a.a} sub={a.b} icon={<Droplets className="h-5 w-5" />} />
        ))}
      </div>
    </Modal>
  )
}

export function CO004Modal({ level }: { level: number }) {
  const close = useStore((s) => s.close)
  const [by, setBy] = React.useState('')
  const [how, setHow] = React.useState('')
  const cascade = [
    { i: Layers3, t: 'Scope', d: 'Full height becomes the approved scope. The 3 ft version stays in history.' },
    { i: Package, t: 'Finish tile', d: 'About 96 SF more T-06 — the GC is asked to add it to their order.' },
    { i: ScrollText, t: 'Materials', d: 'Thinset, grout, clips and metal recalculated.' },
    { i: CalendarDays, t: 'Schedule', d: shiftText('About one more crew day — finish moves to Oct 12.') },
    { i: Smartphone, t: 'Crew', d: 'Philip’s phone changes from “hold at 3 ft” to full height.' },
    { i: Receipt, t: 'Accounting', d: 'CO-004 becomes ready to bill · $6,850.' },
  ]
  return (
    <Modal
      level={level}
      size="lg"
      onClose={close}
      title="Record CO-004 approval"
      header={<JobHead jobId="119" kicker="Change order CO-004" title="Boys bath walls — 3 ft to full height" right={<div className="text-right"><div className="text-[1.5rem] font-bold tnum text-ink">$6,850</div><div className="text-[0.78125rem] text-muted">{shiftText('Priced Sep 24')}</div></div>} />}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{how === 'Verbal' ? 'Verbal is allowed — a “get it in writing” item is created.' : 'One approval updates six departments.'}</span>
          <Button className="ml-auto" variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!by || !how} icon={<ShieldCheck className="h-[1.125rem] w-[1.125rem]" />} onClick={() => approveCO004({ by, how })}>Record approval</Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_23.75rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
            <div className="flex-1 text-center">
              <div className="text-[0.78125rem] text-muted">Approved today</div>
              <div className="text-[1.125rem] font-bold text-muted line-through decoration-faint">3 ft high</div>
            </div>
            <ArrowRight className="h-5 w-5 text-faint" />
            <div className="flex-1 text-center">
              <div className="text-[0.78125rem] text-muted">Client asked for</div>
              <div className="text-[1.125rem] font-bold text-ink">Full height</div>
            </div>
          </div>
          <Field label="Who approved it?">
            <div className="flex flex-wrap gap-2">
              {['GC project manager', 'Owner’s rep', 'Client'].map((x) => <Chip key={x} on={by === x} onClick={() => setBy(x)}>{x}</Chip>)}
            </div>
          </Field>
          <Field label="How?">
            <div className="flex flex-wrap gap-2">
              {['Signed change order', 'Email', 'Verbal'].map((x) => <Chip key={x} on={how === x} onClick={() => setHow(x)}>{x}</Chip>)}
            </div>
            {how === 'Verbal' && <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-warn-50 px-3 py-2.5 text-[0.84375rem] text-warn-700"><AlertTriangle className="h-4 w-4" />Allowed by company rule — written backup is required and tracked.</div>}
          </Field>
        </div>
        <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-5">
          <div className="text-[0.9375rem] font-semibold text-ink">The moment you approve</div>
          <div className="mt-3 flex flex-col gap-3">
            {cascade.map((c) => (
              <div key={c.t} className="flex gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-card"><c.i className="h-4 w-4" /></span>
                <div>
                  <div className="text-[0.84375rem] font-semibold text-ink">{c.t}</div>
                  <div className="text-[0.8125rem] leading-snug text-ink-2">{c.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function ThinsetModal({ level }: { level: number }) {
  const close = useStore((s) => s.close)
  const [pick, setPick] = React.useState<'chase' | 'reorder' | ''>('')
  return (
    <Modal
      level={level}
      size="md"
      onClose={close}
      title="Thinset decision"
      header={<JobHead jobId="828" kicker="PO-1039 · Infinity" title="Thinset is 23 days late — chase or reorder?" right={<Pill tone="bad">Return on hold</Pill>} />}
      footer={
        <>
          <Button className="ml-auto" variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!pick} onClick={() => thinsetDecision(pick as any)}>{pick === 'reorder' ? 'Set up the new PO' : 'Save decision'}</Button>
        </>
      }
    >
      <div className="mb-5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {shiftDeep([['Ordered', 'Aug 25'], ['Promised', 'Sep 5'], ['Last call', 'Sep 8 — “next week”']]).map(([a, b]) => (
          <div key={a} className="rounded-xl bg-wash px-3.5 py-3">
            <div className="text-[0.78125rem] text-muted">{a}</div>
            <div className="text-[0.875rem] font-semibold text-ink">{b}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        <OptionCard on={pick === 'chase'} onClick={() => setPick('chase')} icon={<Clock3 className="h-5 w-5" />} title="Chase Infinity — decide again Wednesday" sub="It waits on Infinity and comes back to you Wednesday by itself." />
        <OptionCard on={pick === 'reorder'} onClick={() => setPick('reorder')} icon={<Repeat className="h-5 w-5" />} title="Reorder from another supplier now" sub="PO-1039 is cancelled and kept in history. The return can be booked when it lands." />
      </div>
    </Modal>
  )
}

export function QtyModal({ jobId, tag, level }: { jobId: string; tag: string; level: number }) {
  const s = useStore()
  const c = s.checks.find((x) => x.jobId === jobId && x.tag === tag)
  const [pick, setPick] = React.useState<'askgc' | 'order' | 'accept' | ''>('')
  if (!c) return null
  const need = needWithWaste(c)
  const short = need - c.ordered
  const t = tileOf(jobId, tag)
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="Quantity check"
      header={<JobHead jobId={jobId} kicker={`${tag} · ${c.where}`} title={`Their order is ${short} ${c.unit} short of our takeoff`} />}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">Settled now — not when the crew is standing there.</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!pick} onClick={() => settleQty(jobId, tag, pick as any)}>{pick === 'order' ? 'Set up the PO' : 'Save'}</Button>
        </>
      }
    >
      <div className="mb-6 flex items-center gap-6 rounded-2xl border border-line p-5">
        <TileImg tile={t} size={72} />
        <div className="grid flex-1 grid-cols-3 gap-4 max-sm:grid-cols-1 max-sm:gap-3">
          <div>
            <div className="text-[0.78125rem] text-muted">Our takeoff</div>
            <div className="text-[1.375rem] font-bold tnum text-ink">{need} {c.unit}</div>
            <div className="text-[0.78125rem] text-muted">{c.measured} measured + {c.wastePct}% waste</div>
          </div>
          <div>
            <div className="text-[0.78125rem] text-muted">Store ordered</div>
            <div className="text-[1.375rem] font-bold tnum text-ink">{c.ordered} {c.unit}</div>
            <div className="text-[0.78125rem] text-muted">{c.supplier} · for the {c.suppliedBy}</div>
          </div>
          <div>
            <div className="text-[0.78125rem] text-muted">Gap</div>
            <div className="text-[1.375rem] font-bold tnum text-bad-600">−{short} {c.unit}</div>
            <div className="text-[0.78125rem] text-muted">About {Math.ceil(short / 30)} boxes</div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <OptionCard on={pick === 'askgc'} onClick={() => setPick('askgc')} icon={<Building2 className="h-5 w-5" />} title={`Ask the GC to add ${short} ${c.unit} to their order`} sub="They supply the tile. It waits on the GC and comes back Wednesday." />
        <OptionCard on={pick === 'order'} onClick={() => setPick('order')} icon={<Package className="h-5 w-5" />} title="We order the short tile ourselves" sub="A PO to Best Tile from here — billed back to the GC if agreed." />
        <OptionCard on={pick === 'accept'} onClick={() => setPick('accept')} icon={<CheckCircle2 className="h-5 w-5" />} title="The store counted differently — accept their number" sub="Use only if our takeoff was high. It’s logged with your name." />
      </div>
    </Modal>
  )
}

export function ReceiveModal({ matId, level }: { matId: string; level: number }) {
  const s = useStore()
  const m = s.mats.find((x) => x.id === matId)
  const [qty, setQty] = React.useState(2)
  const [cond, setCond] = React.useState('Good')
  if (!m) return null
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Receive"
      header={<JobHead jobId={m.jobId} kicker={`${m.po} · ${m.where}`} title={`Receive · ${m.name}`} right={<Pill tone="warn">4 of 6 here</Pill>} />}
      footer={
        <>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Truck className="h-[1.125rem] w-[1.125rem]" />} onClick={() => receiveMat(matId, qty, cond)}>Save receipt</Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="How many arrived?" hint="Receipts add up — nothing is overwritten."><NumStepper value={qty} onChange={setQty} min={1} max={6} suffix="pieces" /></Field>
        <Field label="Condition">
          <div className="flex flex-wrap gap-2">
            {['Good', 'Damaged', 'Wrong item'].map((x) => <Chip key={x} on={cond === x} onClick={() => setCond(x)}>{x}</Chip>)}
          </div>
        </Field>
        <SlipPhoto jobId={m.jobId} />
      </div>
    </Modal>
  )
}

/** a photo of the packing slip goes onto the project's photos */
function SlipPhoto({ jobId }: { jobId: string }) {
  const ref = React.useRef<HTMLInputElement>(null)
  const [n, setN] = React.useState(0)
  return (
    <>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) { setN((x) => x + l.length); void keepFiles(jobId, l, 'photo', { quiet: true }) } }} />
      <Button className="self-start" icon={n ? <Check className="h-4 w-4" /> : <Camera className="h-4 w-4" />} onClick={() => ref.current?.click()}>{n ? `${n} photo${n === 1 ? '' : 's'} of the packing slip added` : 'Add photo of the packing slip'}</Button>
    </>
  )
}

export function ReceiveTileModal({ jobId, tag, level }: { jobId: string; tag: string; level: number }) {
  const s = useStore()
  const c = s.checks.find((x) => x.jobId === jobId && x.tag === tag)
  const [qty, setQty] = React.useState(c ? c.ordered - c.received : 1)
  if (!c) return null
  const t = tileOf(jobId, tag)
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Receive tile"
      header={<JobHead jobId={jobId} kicker={`${c.supplier} · supplied by the ${c.suppliedBy}`} title={`Receive ${tag} · ${t?.name}`} right={<Pill tone="warn">{c.received} of {c.ordered} here</Pill>} />}
      footer={
        <>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Truck className="h-[1.125rem] w-[1.125rem]" />} onClick={() => { receiveTile(jobId, tag, qty); s.close() }}>Save receipt</Button>
        </>
      }
    >
      <Field label="How many arrived?" hint={`Outstanding: ${c.ordered - c.received} ${c.unit}. Partial is fine — the rest stays outstanding.`}>
        <NumStepper value={qty} onChange={setQty} min={1} max={c.ordered - c.received} suffix={c.unit} />
      </Field>
    </Modal>
  )
}

export function VerifyModal({ taskId, level }: { taskId: string; level: number }) {
  const s = useStore()
  const t = s.tasks.find((x) => x.id === taskId)
  if (!t) return null
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Verify"
      header={<JobHead jobId={t.jobId} kicker={t.where || 'Punch item'} title={t.title} />}
      footer={
        <>
          <Button onClick={() => verifyPunch(taskId, false)}>Needs more work</Button>
          <Button className="ml-auto" variant="success" icon={<CheckCircle2 className="h-[1.125rem] w-[1.125rem]" />} onClick={() => verifyPunch(taskId, true)}>Verified</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {['Before', 'After'].map((l, i) => (
          <div key={l} className="overflow-hidden rounded-2xl border border-line">
            <div className="relative h-[9.375rem]">
              <Swatch kind="blackhex" size={300} radius={0} className="!h-full !w-full" />
              {i === 0 && <span className="absolute inset-0 bg-[radial-gradient(circle_at_40%_45%,rgba(214,200,170,.75),transparent_55%)]" />}
            </div>
            <div className="px-3 py-2 text-[0.8125rem] font-semibold text-ink">{l} · {i ? 'Philip, today' : shiftText('Yaakov, Sep 11')}</div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export function RolesModal({ level }: { level: number }) {
  const s = useStore()
  const label = (r: string) => ROLES.find((x) => x.key === r)?.label.split(' · ')[0]
  const pages = (r: Role) => (s.access[r] || []).map((k) => ({ today: 'Today', estimates: 'Estimates', projects: 'Projects', upcoming: 'Schedule', pos: 'POs', pay: 'Installer pay', money: 'Billing', items: 'Items', clients: 'Clients', designers: 'Designers', subs: 'Installers', suppliers: 'Suppliers' } as Record<string, string>)[k]).filter(Boolean)
  const TYPES: Role[] = LOGIN_TYPES
  const count = (r: Role) => s.team.filter((m) => loginOf(m.role) === r && m.status !== 'off').length
  const what: Partial<Record<Role, string>> = { crew: 'An installer’s phone — only his job: where to work, what not to start, his touch-ups', client: 'A GC or client — their projects, photos, approvals, invoices, messages' }
  return (
    <Modal level={level} size="lg" onClose={s.close} title="See what each person sees" sub="Tap a person to see exactly their Today — every task that lands on them. In the real app everyone signs in with their own email.">
      <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
        {TYPES.map((r) => {
          const on = s.role === r
          const people = s.team.filter((m) => loginOf(m.role) === r && m.status !== 'off')
          return (
            <div key={r} className={cn('overflow-hidden rounded-[0.75rem] border transition', on ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-line')}>
              <button onClick={() => (r === REAL.home ? backToMe() : people[0] ? signInAs(people[0].key) : s.setRole(r))} className="flex w-full items-start gap-3.5 p-3.5 text-left transition hover:bg-wash">
                <span className={cn('mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.5625rem]', on ? 'bg-brand-600 text-white' : 'bg-wash-2 text-ink-2')}>{r === 'crew' ? <Smartphone className="h-4 w-4" /> : r === 'client' ? <Building2 className="h-4 w-4" /> : r === 'owner' ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[0.90625rem] font-semibold text-ink">{r === 'owner' ? 'Admin' : r === 'crew' ? 'Installer (crew)' : r === 'client' ? 'GC / client' : label(r)}{r !== 'crew' && r !== 'client' && <span className="text-[0.75rem] font-medium text-muted">{count(r)} {count(r) === 1 ? 'person' : 'people'}</span>}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[0.78125rem] leading-snug text-muted">{what[r] || (r === 'owner' ? 'Everything, plus Settings — the team, logins and rules' : pages(r).join(' · '))}</span>
                </span>
                <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-faint" />
              </button>
              {people.length > 0 && r !== 'client' && (
                <div className="flex flex-wrap gap-1.5 border-t border-line-2 px-3.5 py-2.5">
                  {people.map((m) => (
                    <button key={m.key} data-person={m.key} onClick={() => signInAs(m.key)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border bg-white pl-1 pr-2.5 text-[0.78125rem] font-medium transition hover:border-brand-300 hover:text-brand-700', on && meOf(s.role) === m.key ? 'border-brand-500 text-brand-700' : 'border-line text-ink-2')}>
                      <Avatar who={m.key} size={22} />{PEOPLE[m.key]?.name || m.first}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
