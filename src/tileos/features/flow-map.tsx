import * as React from 'react'
import { TODAY } from '@/tileos/lib/today'
import { Zap, ArrowRight, ChevronLeft, ChevronRight, MousePointerClick, FileText, LayoutList, Building2, CalendarCheck, CalendarDays, PackageCheck, Receipt, Users, Play, Check, Sparkles, Calculator, HardHat, Ruler, BellRing, HandCoins } from 'lucide-react'
import { useStore, type Page } from '@/tileos/store'
import { PageHeader, Card, Button, Avatar, Segmented, Chip, IconCircle, Pill } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PHASES, STAGE_LABEL, ROLES, roleDef, type Role } from '@/tileos/data/model'
import { PROCESS } from '@/tileos/data/process'

const ROLE_ORDER: Role[] = ['office', 'estimator', 'owner', 'pm', 'site', 'materials', 'accounting', 'crew']

export function FlowPage() {
  const s = useStore()
  const [i, setI] = React.useState(0)
  const [view, setView] = React.useState<'pages' | 'steps' | 'people'>('pages')
  const [dept, setDept] = React.useState<Role>('office')
  const step = PROCESS[i]
  const tryIt = (m: any) => {
    if (s.role === 'crew' || s.role === 'accounting') s.setRole('owner')
    setTimeout(() => s.open(m), 30)
  }
  let n = 0
  return (
    <div className="animate-fade-up">
      <PageHeader
        title="How it all flows"
        sub={view === 'pages' ? 'Where each project lives, from the first price request to the last touch-up.' : 'Every step, who presses what, and what the system does by itself.'}
        actions={<Segmented value={view} onChange={setView} items={[{ key: 'pages', label: 'Where things live' }, { key: 'steps', label: 'By step' }, { key: 'people', label: 'By person' }]} />}
      />
      {view === 'pages' ? (
        <WhereThingsLive />
      ) : view === 'steps' ? (
        <>
          <Card className="px-5 py-5 max-sm:px-4 max-sm:py-4">
            <div className="flex gap-3 max-lg:grid max-lg:grid-cols-2 max-lg:gap-x-5 max-lg:gap-y-4 max-sm:grid-cols-1">
              {PHASES.map((p) => (
                <div key={p.key} className="min-w-0" style={{ flex: p.stages.length }}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <span className="text-[0.8125rem] font-bold text-ink">{p.label}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <div className="flex gap-1.5">
                    {p.stages.map((st) => {
                      const idx = PROCESS.findIndex((x) => x.stage === st)
                      n++
                      const on = idx === i
                      return (
                        <button key={st} onClick={() => setI(idx)} className={cn('min-w-0 flex-1 rounded-xl border px-2 py-2.5 text-left transition', on ? 'border-brand-600 bg-brand-600 text-white shadow-btn' : idx < i ? 'border-brand-100 bg-brand-50 text-brand-700 hover:bg-brand-100' : 'border-line bg-white text-ink-2 hover:bg-wash')}>
                          <div className={cn('text-[0.71875rem] font-bold', on ? 'text-white/80' : 'text-faint')}>{n}</div>
                          <div className="truncate text-[0.8125rem] font-semibold">{({ awarded: 'Award', verification: 'Verify', installation: 'Install' } as any)[st] || STAGE_LABEL[st]}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <div key={i} className="mt-6 grid animate-fade-up grid-cols-[minmax(0,1fr)_23.75rem] gap-6 max-lg:grid-cols-1">
            <Card className="p-7 max-sm:p-5">
              <div className="flex items-center gap-2 text-[0.8125rem] font-semibold text-muted">Step {i + 1} of {PROCESS.length}</div>
              <h2 className="h-display mt-1 text-[1.625rem] font-bold text-ink max-sm:text-[1.375rem]">{step.title}</h2>
              <p className="mt-2 text-[0.96875rem] leading-relaxed text-ink-2">{step.happens}</p>
              <div className="mt-6 text-[0.84375rem] font-semibold text-muted">Who does what — the buttons they press</div>
              <div className="mt-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                {step.who.map((w, k) => {
                  const def = roleDef(w.role)
                  return (
                    <div key={k} className="rounded-2xl border border-line p-4">
                      <div className="flex items-center gap-3">
                        <Avatar who={def.person} size={36} />
                        <div>
                          <div className="text-[0.9375rem] font-semibold text-ink">{def.label}</div>
                          <div className="text-[0.78125rem] text-muted">{def.person === 'ys' ? 'Yaakov' : ''}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {w.buttons.map((b) => (
                          <span key={b} className="inline-flex h-8 items-center rounded-lg border border-brand-100 bg-brand-50 px-2.5 text-[0.8125rem] font-semibold text-brand-700">{b}</span>
                        ))}
                      </div>
                      {w.note && <div className="mt-2.5 text-[0.78125rem] text-muted">{w.note}</div>}
                    </div>
                  )
                })}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3">
                <Button icon={<ChevronLeft className="h-4 w-4" />} disabled={i === 0} onClick={() => setI(i - 1)}>Previous</Button>
                <Button iconRight={<ChevronRight className="h-4 w-4" />} disabled={i === PROCESS.length - 1} onClick={() => setI(i + 1)}>Next step</Button>
              </div>
            </Card>
            <div className="flex flex-col gap-6">
              <Card className="p-6 max-sm:p-5">
                <div className="flex items-center gap-2.5">
                  <IconCircle tone="vio" size={36}><Zap className="h-4 w-4" /></IconCircle>
                  <div className="text-[1rem] font-semibold text-ink">The system does by itself</div>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {step.auto.map((a) => (
                    <div key={a} className="flex gap-2.5 text-[0.875rem] leading-snug text-ink-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vio-500" />
                      {a}
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="border-brand-100 bg-gradient-to-b from-brand-50/70 to-white p-6 max-sm:p-5">
                <div className="flex items-center gap-2.5">
                  <IconCircle tone="info" size={36}><MousePointerClick className="h-4 w-4" /></IconCircle>
                  <div className="text-[1rem] font-semibold text-ink">Try it in the demo</div>
                </div>
                <p className="mt-2 text-[0.875rem] text-ink-2">Opens the real screen where this step happens.</p>
                <Button full className="mt-4" variant="primary" iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => tryIt(step.demo.modal)}>{step.demo.label}</Button>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {ROLE_ORDER.map((r) => (
              <Chip key={r} on={dept === r} onClick={() => setDept(r)} icon={<Avatar who={roleDef(r).person} size={22} />}>{roleDef(r).label}</Chip>
            ))}
          </div>
          <Card className="mt-5 overflow-hidden">
            <div className="flex items-center gap-4 border-b border-line-2 px-6 py-5 max-sm:px-4">
              <Avatar who={roleDef(dept).person} size={46} />
              <div>
                <div className="text-[1.1875rem] font-bold text-ink">{roleDef(dept).label}</div>
                <div className="text-[0.875rem] text-muted">Sees: {roleDef(dept).sees}</div>
              </div>
            </div>
            {PROCESS.map((p, k) => {
              const mine = p.who.filter((w) => w.role === dept)
              if (!mine.length) return null
              return (
                <div key={p.stage} className="grid grid-cols-[13.75rem_1fr_auto] items-center gap-6 border-b border-line-2 px-6 py-4 last:border-0 max-md:grid-cols-1 max-md:gap-2.5 max-sm:px-4">
                  <div>
                    <div className="text-[0.75rem] font-bold text-faint">Step {k + 1}</div>
                    <div className="text-[0.9375rem] font-semibold text-ink">{p.title}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mine.flatMap((w) => w.buttons).map((b) => (
                      <span key={b} className="inline-flex h-8 items-center rounded-lg border border-brand-100 bg-brand-50 px-2.5 text-[0.8125rem] font-semibold text-brand-700">{b}</span>
                    ))}
                  </div>
                  <Button size="sm" className="max-md:justify-self-start" iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => tryIt(p.demo.modal)}>Try it</Button>
                </div>
              )
            })}
          </Card>
        </>
      )}
    </div>
  )
}

/* ================= where things live: the pages, in the order a project moves through them ================= */
const PRICING = ['request', 'estimating', 'proposal', 'followup']
const COMING = ['awarded', 'setup', 'verification', 'ready', 'scheduled']
function WhereThingsLive() {
  const s = useStore()
  const jobs = Object.values(s.jobs)
  const openEst = s.estimates.filter((e) => !['approved', 'lost'].includes(e.status)).length
  const coming = jobs.filter((j) => j.kind !== 'repair' && COMING.includes(j.stage)).length
  const won = jobs.filter((j) => !PRICING.includes(j.stage)).length
  const go = (page: Page) => s.go({ page })
  const MAIN = [
    { page: 'estimates' as Page, icon: FileText, title: 'Estimates', n: openEst, nLabel: 'open', grad: 'bg-[#f1eefb] text-[#6b55c9]', tint: 'bg-white border-line', what: 'From the plans until the client says yes. AI drafts the takeoff; three people check it; every revision is kept with what changed.', has: ['New request', 'Estimating (takeoff → office review → final review)', 'Pending approval', 'Revision needed'], leaves: 'Client approves → it becomes a project' },
    { page: 'projects' as Page, icon: Building2, title: 'Projects', n: coming, nLabel: 'getting ready', grad: 'bg-[#eaf0fc] text-[#2650cf]', tint: 'bg-white border-line', what: 'The game plan. Each project’s checklist — every step has an owner, and when one is done the next person has it on their Today.', has: ['Rooms', 'Tile picks', 'Setup', 'Tile order → delivery', 'Heights', 'Rough-ins', 'Materials', 'Installer', 'Deposit'], leaves: 'All steps done → book the crew' },
    { page: 'upcoming' as Page, icon: LayoutList, title: 'Schedule', n: new Set(s.bookings.filter((b) => b.start <= TODAY && b.end >= TODAY).map((b) => b.crew)).size, nLabel: 'crews on site today', grad: 'bg-[#e9f5ee] text-[#23854f]', tint: 'bg-white border-line', what: 'The crew calendar — who’s working where, what’s ready to book, what’s on hold. Start the job and the daily updates, touch-ups and billing follow.', has: ['Booked', 'Planned', 'Ready to book', 'On hold'], leaves: 'Final bill paid → finished, kept for the record' },
  ]
  const SIDE = [
    { page: 'today' as Page, icon: CalendarCheck, title: 'Today', what: 'Only what’s yours — overdue, today, this week: tasks, checklist steps that are your turn, meetings.' },
    { page: 'pos' as Page, icon: PackageCheck, title: 'Purchase orders', what: 'What we buy — supplier POs and installer POs.' },
    { page: 'pay' as Page, icon: HandCoins, title: 'Installer pay', what: 'Every Monday: each installer’s week from the daily updates, checked against his bill.' },
    { page: 'money' as Page, icon: Receipt, title: 'Billing', what: 'What we bill — every invoice with its number, until it’s paid.' },
    { page: 'clients' as Page, icon: Users, title: 'People', what: 'Clients, designers, installers and suppliers.' },
  ]
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-3 max-lg:grid-cols-1">
        {MAIN.map((m, k) => (
          <React.Fragment key={m.page}>
            {k > 0 && (
              <div className="flex items-center justify-center max-lg:rotate-90 max-lg:py-1">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-muted shadow-xs"><ArrowRight className="h-4 w-4" /></span>
              </div>
            )}
            <button onClick={() => go(m.page)} className={cn('group flex flex-col rounded-[0.875rem] border p-6 text-left transition duration-150 hover:border-[#cbd1d9] max-sm:p-5', m.tint)}>
              <div className="flex items-center gap-3.5">
                <span className={cn('inline-flex h-12 w-12 items-center justify-center rounded-[0.75rem]', m.grad)}><m.icon className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[0.8125rem] font-bold text-muted">Step {k + 1}</div>
                  <div className="font-display text-[1.3125rem] font-semibold tracking-[-0.01em] text-ink">{m.title}</div>
                </div>
                <div className="text-right">
                  <div className="display-num text-[1.625rem] font-semibold leading-none text-ink">{m.n}</div>
                  <div className="mt-1 text-[0.75rem] font-semibold text-muted">{m.nLabel}</div>
                </div>
              </div>
              <p className="mt-4 text-[0.9375rem] leading-snug text-ink-2">{m.what}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {m.has.map((h) => <span key={h} className="inline-flex h-7 items-center rounded-full bg-white/80 px-2.5 text-[0.78125rem] font-semibold text-ink-2 ring-1 ring-inset ring-black/5">{h}</span>)}
              </div>
              <div className="mt-auto flex items-center gap-2 pt-5 text-[0.84375rem] font-semibold text-ink">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-ok-600 ring-1 ring-inset ring-black/5">{k === 1 ? <Play className="h-3 w-3" /> : <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
                {m.leaves}
              </div>
            </button>
          </React.Fragment>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-baseline gap-x-2 border-b border-line-2 px-6 py-4 max-sm:px-4">
          <span className="inline-flex items-center gap-2 text-[0.9375rem] font-bold text-ink"><Sparkles className="h-4 w-4 text-brand-600" />Done for you</span>
          <span className="text-[0.8125rem] text-muted">the system works these out by itself</span>
        </div>
        <div className="grid grid-cols-5 max-xl:grid-cols-3 max-md:grid-cols-1">
          {[
            { icon: Calculator, title: 'Materials', what: 'Sand, Portland, thinset, board, grout — from the square feet and how each wall and floor is set. The PO fills itself.' },
            { icon: HardHat, title: 'Installer PO', what: 'Drafted from the rooms and square feet the moment you pick the installer.' },
            { icon: Ruler, title: 'Tile order check', what: 'The GC’s tile order against our takeoff plus waste — a shortage shows up before the crew does.' },
            { icon: Receipt, title: 'Progress bills', what: 'Filled in from the daily updates, room by room.' },
            { icon: BellRing, title: 'Follow-ups', what: 'Waiting items and unpaid invoices come back on their day.' },
          ].map((x) => (
            <div key={x.title} className="flex flex-col gap-2 border-r border-line-2 px-6 py-5 last:border-r-0 max-xl:border-b max-md:border-r-0 max-sm:px-4">
              <span className="flex items-center gap-2.5 text-[0.9375rem] font-bold text-ink"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#528bff] to-[#1848d6] text-white"><x.icon className="h-[1.125rem] w-[1.125rem]" /></span>{x.title}</span>
              <span className="text-[0.84375rem] leading-snug text-muted">{x.what}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="border-b border-line-2 px-6 py-4 text-[0.9375rem] font-bold text-ink max-sm:px-4">Alongside, every day</div>
        <div className="grid grid-cols-5 max-xl:grid-cols-3 max-md:grid-cols-1">
          {SIDE.map((x) => (
            <button key={x.page} onClick={() => go(x.page)} className="group flex flex-col gap-2 border-r border-line-2 px-6 py-5 text-left transition last:border-r-0 hover:bg-wash max-xl:border-b max-md:border-r-0 max-sm:px-4">
              <span className="flex items-center gap-2.5 text-[0.9375rem] font-bold text-ink"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><x.icon className="h-[1.125rem] w-[1.125rem]" /></span>{x.title}</span>
              <span className="text-[0.84375rem] leading-snug text-muted">{x.what}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
