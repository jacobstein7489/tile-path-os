import * as React from 'react'
import {
  HardHat, Ban, ArrowRight, ClipboardList, AlertTriangle, ArrowLeftRight, Truck, Camera, ListPlus, CheckCircle2, Circle, Clock3, XCircle,
  Package, Wallet, Users, FileText, MapPin, LayoutGrid, ShieldCheck, Sparkles, Lock, CalendarDays, Plus, Layers3, Receipt, ChevronRight,
} from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore } from '@/tileos/store'
import { Card, CardHeader, Button, Pill, Avatar, Count, Empty, NumberBadge, IconCircle, TextInput, Field, Chip } from '@/tileos/components/ui/core'
import { Modal, Tip } from '@/tileos/components/ui/overlay'
import { Swatch } from '@/tileos/components/ui/swatch'
import { Ring, Bar } from '@/tileos/components/ui/progress'
import { TaskRow } from '../common'
import { cn, TONE } from '@/tileos/lib/utils'
import { PEOPLE, type Job, type Tone } from '@/tileos/data/model'
import { SURF_LABEL, SURF_TONE, surfacePct, type Room, type Surface, tileOf } from '@/tileos/data/jobs'
import { needWithWaste } from '@/tileos/data/work'
import { sendToSite, setPunch, addPunch, buildRooms, verificationDone } from '../flows'
import { openChangeFor, openRoom } from '../field'
import { WhatsGoingOn, NotesCard } from './going-on'
import type { JobTab } from './workspace'
import { shiftText, NOW } from '@/tileos/lib/today'

export function Overview({ job, setTab }: { job: Job; setTab: (t: JobTab) => void }) {
  const body = ['installation', 'scheduled'].includes(job.stage) ? (
    <InstallOverview job={job} setTab={setTab} />
  ) : ['setup', 'awarded', 'verification'].includes(job.stage) ? (
    <SetupOverview job={job} setTab={setTab} />
  ) : job.stage === 'ready' ? (
    <ReadyOverview job={job} setTab={setTab} />
  ) : (
    <CloseOverview job={job} setTab={setTab} />
  )
  return (
    <div className="flex flex-col gap-6">
      <WhatsGoingOn job={job} />
      {body}
      <NotesCard job={job} />
    </div>
  )
}

/* what button fixes this surface? */
export function surfaceFix(job: Job, room: string, sf: Surface): { label: string; run: () => void } | null {
  const s = useStore.getState()
  if (job.id === '119' && sf.name === 'Shower floor' && sf.state === 'blocked') return { label: 'Record answer', run: () => s.open({ t: 'drain' }) }
  if (job.id === '119' && room === 'Boys Bath' && sf.state === 'hold') return { label: 'Record approval', run: () => s.open({ t: 'co004' }) }
  if (job.id === '119' && room === 'Girls Bath' && sf.state === 'waitmat') return { label: 'Receive', run: () => s.open({ t: 'receive', matId: 'om5' }) }
  if (job.id === '118' && sf.state === 'waitmat') return { label: 'Follow up', run: () => s.open({ t: 'po', id: 'PO-1042' }) }
  if (job.id === '530' && sf.state === 'blocked') {
    const m = s.mats.find((x) => x.jobId === '530' && x.status === 'to-order')
    return m ? { label: 'Create PO', run: () => s.open({ t: 'newpo', jobId: '530' }) } : { label: 'Open PO', run: () => s.open({ t: 'job', id: '530', tab: 'materials' }) }
  }
  if (job.id === '828' && sf.state === 'waitmat') return { label: 'Chase or reorder', run: () => s.open({ t: 'thinset' }) }
  if (job.id === '24c' && sf.state === 'waitmat') return { label: 'Follow up', run: () => s.open({ t: 'task', id: 't-tile24c' }) }
  if (sf.pending) {
    const co = sf.pending.co
    const m = s.money.find((x) => x.jobId === job.id && x.kind === 'change' && x.title.startsWith(co))
    return { label: m?.meta && !m.meta.sent ? `Price ${co}` : `Approve ${co}`, run: () => openChangeFor(job.id, co) }
  }
  if (sf.state === 'unknown') return { label: 'Verify', run: () => openRoom(job.id, room, 'surfaces', sf.name) }
  if (sf.state === 'blocked' || sf.state === 'waitmat' || sf.state === 'hold') return { label: 'Record update', run: () => s.open({ t: 'record', jobId: job.id, type: 'question' }) }
  return null
}

function OpenItems({ job }: { job: Job }) {
  const tasks = useStore((s) => s.tasks).filter((t) => t.jobId === job.id && t.state !== 'done')
  const open = useStore((s) => s.open)
  const order = { now: 0, waiting: 1, later: 2, done: 3 }
  tasks.sort((a, b) => order[a.state] - order[b.state])
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Open items" count={tasks.length} action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => open({ t: 'newtask', jobId: job.id })}>Add</Button>} />
      <div className="border-t border-line-2">
        {tasks.map((t) => (
          <TaskRow key={t.id} t={t} showJob={false} compact />
        ))}
        {!tasks.length && <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="Nothing open" sub="Every item on this project is done." className="py-8" />}
      </div>
    </Card>
  )
}

export function QuickActions({ job }: { job: Job }) {
  const open = useStore((s) => s.open)
  const role = useStore((s) => s.role)
  const items = [
    { icon: ClipboardList, label: 'Daily update', sub: 'One minute', run: () => open({ t: 'daily', jobId: job.id }) },
    { icon: AlertTriangle, label: 'Report issue', sub: 'Attach to a surface', run: () => open({ t: 'record', jobId: job.id, type: 'question' }) },
    { icon: ArrowLeftRight, label: 'Client wants a change', sub: 'CO, installer PO, tile', run: () => open({ t: 'sitechange', jobId: job.id }) },
    { icon: Truck, label: 'Receive material', sub: 'Partial is fine', run: () => open({ t: 'record', jobId: job.id, type: 'delivery' }) },
    { icon: Camera, label: 'Add photos', sub: 'Saved to the room diary', run: () => open({ t: 'daily', jobId: job.id }) },
    { icon: ListPlus, label: 'Add task', sub: 'With an owner and date', run: () => open({ t: 'newtask', jobId: job.id }) },
  ].filter((x) => role !== 'materials' || ['Receive material', 'Add task', 'Report issue'].includes(x.label))
  return (
    <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-2 max-sm:gap-2.5">
      {items.map((it) => (
        <button key={it.label} onClick={it.run} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-left shadow-card transition hover:-translate-y-[0.0625rem] hover:border-brand-200 hover:shadow-raise max-sm:gap-2.5 max-sm:px-3 max-sm:py-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
            <it.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.90625rem] font-semibold text-ink">{it.label}</span>
            <span className="block truncate text-[0.78125rem] text-muted">{it.sub}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

function roomTone(r: Room): Tone {
  if (r.surfaces.some((x) => x.state === 'blocked')) return 'bad'
  if (r.surfaces.some((x) => x.state === 'hold' || x.state === 'waitmat' || x.state === 'unknown')) return 'warn'
  if (r.surfaces.every((x) => x.state === 'done')) return 'ok'
  if (r.surfaces.some((x) => x.state === 'working')) return 'info'
  return 'neutral'
}
function roomLabel(r: Room) {
  if (r.surfaces.some((x) => x.state === 'blocked')) return 'Partly blocked'
  if (r.surfaces.every((x) => x.state === 'done')) return 'Complete'
  if (r.surfaces.some((x) => x.state === 'working')) return 'Crew working'
  if (r.surfaces.some((x) => x.state === 'hold')) return 'Change pending'
  if (r.surfaces.some((x) => x.state === 'waitmat')) return 'Waiting material'
  if (r.surfaces.some((x) => x.state === 'unknown')) return 'To verify'
  if (r.surfaces.some((x) => x.state === 'ready')) return 'Ready'
  return 'Later'
}

function RoomsMini({ job, setTab }: { job: Job; setTab: (t: JobTab) => void }) {
  const rooms = useStore((s) => s.rooms[job.id]) || []
  const done = rooms.filter((r) => r.surfaces.every((x) => x.state === 'done')).length
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Rooms" count={rooms.length} sub={`${done} of ${rooms.length} complete`} action={<Button size="sm" iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => setTab('rooms')}>Open rooms</Button>} />
      <div className="border-t border-line-2">
        {rooms.map((r) => {
          const tone = roomTone(r)
          return (
            <button key={r.name} onClick={() => setTab('rooms')} className="flex w-full items-center gap-3 border-b border-line-2 px-6 py-3 text-left last:border-0 hover:bg-wash">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.90625rem] font-semibold text-ink">{r.name}</span>
                <span className={cn('block text-[0.78125rem] font-medium', tone === 'neutral' ? 'text-muted' : TONE[tone].strong)}>{roomLabel(r)}</span>
              </span>
              <span className="text-[0.8125rem] font-semibold tnum text-ink-2">{r.pct}%</span>
              <Ring pct={r.pct} size={30} stroke={3.5} tone={tone === 'neutral' ? 'info' : tone} />
            </button>
          )
        })}
        {!rooms.length && <Empty icon={<LayoutGrid className="h-6 w-6" />} title="No rooms yet" sub="The back office builds them from the paperwork." className="py-8" />}
      </div>
    </Card>
  )
}

/* ---------------- installation ---------------- */
function InstallOverview({ job, setTab }: { job: Job; setTab: (t: JobTab) => void }) {
  const rooms = useStore((s) => s.rooms[job.id]) || []
  const hist = useStore((s) => s.hist[job.id])
  const open = useStore((s) => s.open)
  const flat = rooms.flatMap((r) => r.surfaces.map((sf) => ({ room: r.name, sf })))
  const working = flat.filter((x) => x.sf.state === 'working')
  const cant = flat.filter((x) => ['blocked', 'hold', 'waitmat'].includes(x.sf.state))
  const nextUp = flat.filter((x) => x.sf.state === 'ready')
  const lastUpdate = hist?.find((h) => h.kind === 'field' && /daily/i.test(h.title))

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Right now" />
        <div className="grid grid-cols-3 divide-x divide-line-2 border-t border-line-2 max-md:grid-cols-1 max-md:divide-x-0 max-md:divide-y">
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[0.90625rem] font-semibold text-ink">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600"><HardHat className="h-4 w-4" /></span>
              Working now
            </div>
            {job.crew && (
              <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-wash px-3 py-2.5">
                <Avatar who={job.crew} size={30} />
                <div>
                  <div className="text-[0.875rem] font-semibold text-ink">{PEOPLE[job.crew].name} · {job.workers} workers</div>
                  <div className="text-[0.78125rem] text-muted">{lastUpdate ? `Update ${lastUpdate.date === NOW ? 'today' : lastUpdate.date}` : 'Last update Sat 4:10 PM'}</div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {working.slice(0, 4).map((x, i) => (
                <SurfacePill key={i} job={job} room={x.room} sf={x.sf} />
              ))}
              {working.length > 4 && <button onClick={() => setTab('rooms')} className="text-left text-[0.84375rem] font-semibold text-brand-600">+{working.length - 4} more in progress</button>}
              {!working.length && <div className="text-[0.875rem] text-muted">Nobody on a surface right now.</div>}
            </div>
          </div>
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[0.90625rem] font-semibold text-ink">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bad-50 text-bad-600"><Ban className="h-4 w-4" /></span>
              Do not start
              <Count tone={cant.length ? 'bad' : 'neutral'}>{cant.length}</Count>
            </div>
            <div className="flex flex-col gap-2.5">
              {cant.map((x, i) => {
                const fix = surfaceFix(job, x.room, x.sf)
                return (
                  <div key={i} className="rounded-xl border border-line p-3">
                    <div className="flex items-start gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[0.875rem] font-semibold text-ink">{x.room} · {x.sf.name}</div>
                        <div className={cn('mt-0.5 text-[0.8125rem] leading-snug', TONE[SURF_TONE[x.sf.state]].strong)}>{x.sf.reason || SURF_LABEL[x.sf.state]}</div>
                      </div>
                    </div>
                    {fix && (
                      <Button size="xs" variant="soft" className="mt-2.5 w-full" iconRight={<ArrowRight className="h-3.5 w-3.5" />} onClick={fix.run}>
                        {fix.label}
                      </Button>
                    )}
                  </div>
                )
              })}
              {!cant.length && <div className="rounded-xl border border-dashed border-line py-6 text-center text-[0.875rem] text-muted">Nothing is blocked</div>}
            </div>
          </div>
          <div className="p-5">
            <div className="mb-3 flex items-center gap-2 text-[0.90625rem] font-semibold text-ink">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ok-50 text-ok-600"><CheckCircle2 className="h-4 w-4" /></span>
              Next allowed
              <Count tone="ok">{nextUp.length}</Count>
            </div>
            <div className="flex flex-col gap-2">
              {nextUp.slice(0, 4).map((x, i) => (
                <SurfacePill key={i} job={job} room={x.room} sf={x.sf} />
              ))}
              {nextUp.length > 4 && <button onClick={() => setTab('rooms')} className="text-left text-[0.84375rem] font-semibold text-brand-600">+{nextUp.length - 4} more ready</button>}
            </div>
          </div>
        </div>
      </Card>
      <RoomsMini job={job} setTab={setTab} />
    </div>
  )
}

function SurfacePill({ job, room, sf }: { job: Job; room: string; sf: Surface }) {
  const pct = surfacePct(sf)
  return (
    <button onClick={() => openRoom(job.id, room, 'surfaces', sf.name)} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-2.5 py-2 text-left hover:bg-wash">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.84375rem] font-semibold text-ink">{room} · {sf.name}</span>
        <span className="block truncate text-[0.75rem] text-muted">{tileOf(job.id, sf.tile)?.tag} {tileOf(job.id, sf.tile)?.name}</span>
      </span>
      {sf.state === 'working' && sf.sf ? <span className="text-[0.78125rem] font-semibold tnum text-brand-700">{pct}%</span> : null}
    </button>
  )
}

/* ---------------- setup / verification ---------------- */
type Check = { n: number; title: string; detail: string; state: 'ok' | 'warn' | 'bad' | 'todo'; action?: { label: string; run: () => void }; blocking?: boolean }

function useSetupChecks(job: Job): Check[] {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const surfaces = rooms.reduce((n, r) => n + r.surfaces.length, 0)
  const checks = s.checks.filter((c) => c.jobId === job.id)
  const short = checks.filter((c) => c.ordered < needWithWaste(c))
  const pos = s.pos.filter((p) => p.jobId === job.id)
  const dep = s.money.find((m) => m.jobId === job.id && m.kind === 'deposit')
  const cpo = s.money.find((m) => m.jobId === job.id && m.kind === 'custpo')
  const unknown = rooms.flatMap((r) => r.surfaces).filter((x) => x.state === 'unknown').length
  return [
    {
      n: 1, title: 'Rooms and surfaces', state: rooms.length ? 'ok' : 'todo', blocking: !rooms.length,
      detail: rooms.length ? `${rooms.length} rooms · ${surfaces} surfaces — only what applies` : 'Nothing built yet',
      action: rooms.length ? { label: 'Open rooms', run: () => s.open({ t: 'job', id: job.id, tab: 'rooms' }) } : { label: 'Build rooms', run: () => s.open({ t: 'buildrooms', jobId: job.id }) },
    },
    { n: 2, title: 'Finish records on surfaces', state: rooms.length ? 'ok' : 'todo', detail: rooms.length ? 'Each tile assigned to the exact surfaces it goes on' : 'After the rooms are built' },
    { n: 3, title: 'Tile store paperwork', state: checks.length ? 'ok' : 'todo', detail: checks.length ? 'Best Tile order entered' : 'Waiting for the store paperwork', blocking: false },
    {
      n: 4, title: 'Quantity check — their order vs our takeoff', state: !checks.length ? 'todo' : short.length ? 'bad' : 'ok', blocking: short.length > 0,
      detail: short.length ? `${short.map((c) => `${c.tag} ${needWithWaste(c) - c.ordered} ${c.unit} short`).join(' · ')}` : checks.length ? 'Every tile ordered covers our takeoff + waste' : 'Runs when the paperwork is in',
      action: short.length ? { label: 'Settle it', run: () => s.open({ t: 'qty', jobId: job.id, tag: short[0].tag }) } : undefined,
    },
    { n: 5, title: 'Who supplies what', state: rooms.length ? 'ok' : 'todo', detail: 'Finish tile: GC via Best Tile · setting materials & metals: Cobblestone' },
    {
      n: 6, title: 'Our setting materials', state: pos.some((p) => p.step >= 2) ? 'ok' : pos.length ? 'warn' : 'todo',
      detail: pos.length ? pos.map((p) => `${p.id} ${p.step >= 2 ? 'confirmed' : 'waiting for ' + p.supplier + ' to confirm'}`).join(' · ') : 'Planned after the walkthrough',
      action: pos.length && pos[0].step < 2 ? { label: 'Open PO', run: () => s.open({ t: 'po', id: pos[0].id }) } : undefined,
    },
    {
      n: 7, title: 'Deposit', state: !dep ? 'todo' : dep.state === 'paid' ? 'ok' : 'warn',
      detail: !dep ? 'No deposit on this project' : dep.state === 'paid' ? 'Received' : dep.step === 0 ? 'Not invoiced yet — accounting has it (warning, not a block)' : `Invoiced ${dep.ref} — not paid yet`,
      action: dep && dep.state !== 'paid' ? { label: 'View', run: () => s.open({ t: 'money', id: dep.id }) } : undefined,
    },
    ...(cpo ? [{ n: 8, title: 'Client PO', state: (cpo.state === 'paid' ? 'ok' : 'warn') as Check['state'], detail: cpo.state === 'paid' ? 'Received and filed' : 'Requested — waiting on the GC', action: cpo.state !== 'paid' ? { label: 'Mark received', run: () => s.open({ t: 'money', id: cpo.id }) } : undefined }] : []),
    ...(unknown ? [{ n: cpo ? 9 : 8, title: 'Unknowns for the walkthrough', state: 'warn' as const, detail: `${unknown} surfaces flagged for the site manager to verify — not guessed at` }] : []),
  ]
}

const CHECK_ICON = {
  ok: <CheckCircle2 className="h-[1.375rem] w-[1.375rem] text-ok-500" />,
  warn: <Clock3 className="h-[1.375rem] w-[1.375rem] text-warn-500" />,
  bad: <XCircle className="h-[1.375rem] w-[1.375rem] text-bad-500" />,
  todo: <Circle className="h-[1.375rem] w-[1.375rem] text-[#CDD4DE]" />,
}

function SetupOverview({ job, setTab }: { job: Job; setTab: (t: JobTab) => void }) {
  const checks = useSetupChecks(job)
  const done = checks.filter((c) => c.state === 'ok').length
  const blockers = checks.filter((c) => c.blocking)
  const verifying = job.stage === 'verification'
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-[1.55fr_1fr] gap-6 max-md:grid-cols-1 max-md:gap-4">
        <Card>
          <CardHeader
            title={verifying ? 'Site verification' : 'Back office setup'}
            sub={verifying ? 'The office built it. The site manager confirms reality and adds only what’s missing.' : 'Turn the paperwork into an organized project before anyone walks it.'}
            action={<span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[0.84375rem] font-semibold text-ink-2"><Ring pct={(done / checks.length) * 100} size={34} stroke={4} tone="ok" />{done} of {checks.length}</span>}
          />
          <div className="border-t border-line-2">
            {checks.map((c) => (
              <div key={c.n} className="flex items-center gap-4 border-b border-line-2 px-6 py-3.5 last:border-0">
                {CHECK_ICON[c.state]}
                <div className="min-w-0 flex-1">
                  <div className="text-[0.90625rem] font-semibold text-ink">{c.title}</div>
                  <div className={cn('mt-0.5 text-[0.8125rem]', c.state === 'bad' ? 'font-medium text-bad-700' : 'text-muted')}>{c.detail}</div>
                </div>
                {c.action && (
                  <Button size="xs" variant={c.state === 'bad' ? 'primary' : 'secondary'} onClick={c.action.run}>
                    {c.action.label}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="What’s blocking the next step" count={blockers.length} tone={blockers.length ? 'bad' : 'ok'} />
            <div className="flex flex-col gap-2.5 px-6 pb-6">
              {blockers.map((b) => (
                <div key={b.n} className="flex items-start gap-3 rounded-xl border border-bad-100 bg-bad-50/50 p-3.5">
                  <AlertTriangle className="mt-0.5 h-[1.125rem] w-[1.125rem] shrink-0 text-bad-500" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.875rem] font-semibold text-ink">{b.title}</div>
                    <div className="text-[0.8125rem] text-bad-700">{b.detail}</div>
                  </div>
                </div>
              ))}
              {!blockers.length && <div className="rounded-xl border border-ok-100 bg-ok-50 px-4 py-5 text-center text-[0.875rem] font-semibold text-ok-700">Nothing blocking — ready to move on</div>}
              <div className="mt-1 text-[0.78125rem] text-muted">Deposit and client PO show as warnings — they never block the setup on their own.</div>
            </div>
          </Card>
        </div>
      </div>
      <div className="flex items-center gap-5 rounded-2xl border border-line bg-white px-6 py-5 shadow-card">
        <IconCircle tone="info" size={46}><Sparkles className="h-5 w-5" /></IconCircle>
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-semibold text-ink">Always up to date</div>
          <div className="text-[0.84375rem] text-muted">When a tile, grout or metal changes, the linked tasks and orders update by themselves.</div>
        </div>
        {blockers.length > 0 && <div className="text-right text-[0.875rem] font-semibold text-bad-600">{blockers.length} blocker{blockers.length > 1 ? 's' : ''} left</div>}
        <Button
          size="lg"
          variant="primary"
          disabled={blockers.length > 0}
          icon={blockers.length ? <Lock className="h-[1.125rem] w-[1.125rem]" /> : undefined}
          onClick={() => (verifying ? verificationDone(job.id) : sendToSite(job.id))}
        >
          {verifying ? 'Verification done' : 'Send to site manager'}
        </Button>
      </div>
    </div>
  )
}

/* ---------------- ready (review for scheduling) ---------------- */
function ReadyOverview({ job, setTab }: { job: Job; setTab: (t: JobTab) => void }) {
  const s = useStore()
  const rooms = s.rooms[job.id] || []
  const flat = rooms.flatMap((r) => r.surfaces.map((sf) => ({ room: r.name, sf })))
  const startWith = flat.filter((x) => x.sf.state === 'ready')
  const hold = flat.filter((x) => ['blocked', 'unknown', 'waitmat', 'hold'].includes(x.sf.state))
  const toOrder = s.mats.filter((m) => m.jobId === job.id && m.status === 'to-order')
  const sent = s.mats.filter((m) => m.jobId === job.id && ['sent', 'confirmed'].includes(m.status))
  const dep = s.money.find((m) => m.jobId === job.id && m.kind === 'deposit' && m.state !== 'paid')
  const tileShort = s.checks.filter((c) => c.jobId === job.id && c.received < c.ordered)
  const booking = s.bookings.find((b) => b.jobId === job.id)
  const rows: { title: string; state: 'ok' | 'warn' | 'bad' | 'todo'; detail: string; action?: { label: string; run: () => void } }[] = [
    { title: 'Scope and documents', state: 'ok', detail: 'Approved revision and current plans on file' },
    { title: 'Design decisions', state: hold.some((x) => /designer|confirmed/i.test(x.sf.reason || '')) ? 'warn' : 'ok', detail: hold.some((x) => /designer|confirmed/i.test(x.sf.reason || '')) ? hold.filter((x) => /designer|confirmed/i.test(x.sf.reason || '')).map((x) => `${x.room}: ${x.sf.reason}`).slice(0, 1).join('') : 'All decided for the starting areas' },
    { title: 'Site', state: 'ok', detail: 'Access, water and power confirmed on the walkthrough' },
    { title: 'Finish tile', state: tileShort.length ? 'warn' : 'ok', detail: tileShort.length ? `${tileShort[0].tag}: ${tileShort[0].received} of ${tileShort[0].ordered} ${tileShort[0].unit}` : 'Starting tile on site' },
    {
      title: 'Our materials', state: toOrder.length ? 'bad' : sent.length ? 'warn' : 'ok',
      detail: toOrder.length ? `${toOrder.map((m) => m.name).join(' and ')} not ordered` : sent.length ? `${sent[0].po} ${sent[0].status === 'confirmed' ? 'confirmed' : 'not confirmed yet'}` : 'Setting materials on site',
      action: toOrder.length ? { label: 'Create PO', run: () => s.open({ t: 'newpo', jobId: job.id }) } : undefined,
    },
    { title: 'Deposit', state: dep ? 'warn' : 'ok', detail: dep ? (dep.step === 0 ? 'Deposit not invoiced — warning only' : `Deposit invoiced ${dep.ref}, not paid — warning only`) : 'Deposit received', action: dep ? { label: 'View', run: () => s.open({ t: 'money', id: dep.id }) } : undefined },
    { title: 'Crew', state: booking ? 'ok' : 'todo', detail: booking ? `${PEOPLE[booking.crew as any].name} booked` : 'Not assigned yet', action: booking ? undefined : { label: 'Assign crew', run: () => s.open({ t: 'assign', jobId: job.id }) } },
  ]
  const result = job.readiness === 'ready' && !toOrder.length ? 'ready' : 'partial'
  return (
    <div className="flex flex-col gap-6">
      <div className={cn('flex items-center gap-5 rounded-2xl border px-6 py-5', result === 'ready' ? 'border-ok-100 bg-ok-50/70' : 'border-warn-100 bg-warn-50/70')}>
        <IconCircle tone={result === 'ready' ? 'ok' : 'warn'} size={52}><ShieldCheck className="h-6 w-6" /></IconCircle>
        <div className="min-w-0 flex-1">
          <div className="text-[0.8125rem] font-semibold text-muted">Review for scheduling</div>
          <div className="h-tight text-[1.375rem] font-bold text-ink">{result === 'ready' ? 'Ready to schedule' : 'Can start with restrictions'}</div>
          <div className="text-[0.875rem] text-ink-2">{result === 'ready' ? 'Every hard start gate is clear.' : 'Enough approved work to mobilize — the held areas wait without stopping the project.'}</div>
        </div>
      </div>
      <div className="grid grid-cols-[1.55fr_1fr] gap-6 max-md:grid-cols-1 max-md:gap-4">
        <Card>
          <CardHeader title="What the rules checked" />
          <div className="border-t border-line-2">
            {rows.map((r) => (
              <div key={r.title} className="flex items-center gap-4 border-b border-line-2 px-6 py-3.5 last:border-0">
                {CHECK_ICON[r.state]}
                <div className="min-w-0 flex-1">
                  <div className="text-[0.90625rem] font-semibold text-ink">{r.title}</div>
                  <div className={cn('mt-0.5 text-[0.8125rem]', r.state === 'bad' ? 'font-medium text-bad-700' : 'text-muted')}>{r.detail}</div>
                </div>
                {r.action && <Button size="xs" variant={r.state === 'bad' ? 'primary' : 'secondary'} onClick={r.action.run}>{r.action.label}</Button>}
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Start with" count={startWith.length} tone="ok" />
            <div className="flex flex-col gap-2 px-6 pb-5">
              {startWith.map((x, i) => <SurfacePill key={i} job={job} room={x.room} sf={x.sf} />)}
            </div>
            {hold.length > 0 && (
              <>
                <div className="flex items-center gap-2 border-t border-line-2 px-6 pb-3 pt-4 text-[0.90625rem] font-semibold text-ink">Held back <Count tone="bad">{hold.length}</Count></div>
                <div className="flex flex-col gap-2 px-6 pb-6">
                  {hold.map((x, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-xl border border-line px-3 py-2.5">
                      <Ban className="mt-0.5 h-4 w-4 shrink-0 text-bad-500" />
                      <div>
                        <div className="text-[0.84375rem] font-semibold text-ink">{x.room} · {x.sf.name}</div>
                        <div className="text-[0.78125rem] text-bad-700">{x.sf.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ---------------- punch / closeout ---------------- */
const PUNCH_STEPS = ['Open', 'Working', 'Ready to verify', 'Verified']
const PUNCH_IDX = { open: 0, working: 1, verify: 2, verified: 3 }
export function CloseOverview({ job, setTab }: { job: Job; setTab: (t: JobTab) => void }) {
  const s = useStore()
  const items = s.punch.filter((p) => p.jobId === job.id)
  const left = items.filter((p) => p.status !== 'verified')
  const booking = s.bookings.find((b) => b.jobId === job.id)
  const hold = s.ready.find((r) => r.jobId === job.id && r.kind === 'hold')
  const fin = s.money.find((m) => m.jobId === job.id && m.kind === 'final')
  const changesOpen = s.money.filter((m) => m.jobId === job.id && m.kind === 'change' && m.state !== 'paid' && m.step < 1)
  const [adding, setAdding] = React.useState(false)
  const [txt, setTxt] = React.useState('')
  const checks: { t: string; ok: boolean; d: string }[] = [
    { t: 'Required punch verified', ok: !left.length, d: left.length ? `${left.length} item${left.length > 1 ? 's' : ''} still open` : 'All verified' },
    { t: 'Approved changes billed', ok: !changesOpen.length, d: changesOpen.length ? `${changesOpen[0].title} not billed yet` : 'Nothing unbilled' },
    { t: 'Final photos', ok: true, d: 'On file' },
    { t: 'GC sign-off', ok: job.stage === 'closeout', d: job.stage === 'closeout' ? shiftText('Signed Sep 25') : 'Request after punch' },
    { t: 'Material returns', ok: true, d: 'Nothing to return' },
    { t: 'Final billing to accounting', ok: !!fin && fin.step >= 0, d: fin && fin.step >= 0 ? (fin.state === 'paid' ? 'Paid' : fin.step === 0 ? 'Ready — accounting has it' : `Invoiced ${fin.ref}`) : 'Created the moment closeout passes' },
  ]
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 max-md:gap-4">
        <Card>
          <CardHeader
            title="Punch list"
            count={left.length}
            tone={left.length ? 'warn' : 'ok'}
            action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => s.open({ t: 'punchnew', jobId: job.id })}>Add touch-ups</Button>}
          />
          <div className="border-t border-line-2">
            {adding && (
              <div className="flex gap-2.5 border-b border-line-2 bg-wash px-6 py-3.5">
                <TextInput data-autofocus value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="What needs fixing, and where?" autoFocus />
                <Button variant="primary" disabled={!txt.trim()} onClick={() => { addPunch(job.id, txt.trim(), 'To place'); setTxt(''); setAdding(false) }}>Add</Button>
                <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            )}
            {items.map((p) => (
              <div key={p.id} className="flex items-center gap-4 border-b border-line-2 px-6 py-4 last:border-0 max-sm:flex-wrap max-sm:gap-x-3 max-sm:gap-y-2.5 max-sm:px-4">
                <div className="min-w-0 flex-1 max-sm:basis-full">
                  <div className={cn('text-[0.90625rem] font-semibold leading-snug', p.status === 'verified' ? 'text-muted line-through decoration-faint' : 'text-ink')}>{p.text}</div>
                  <div className="mt-0.5 line-clamp-2 text-[0.8125rem] text-muted">
                    {p.where}
                    {p.note ? ` · ${p.note}` : ''}
                  </div>
                </div>
                <div className="w-[9.375rem] shrink-0 max-sm:w-auto max-sm:flex-1">
                  <div className="flex items-center gap-1">
                    {PUNCH_STEPS.map((st, i) => (
                      <span key={st} className={cn('h-[0.375rem] flex-1 rounded-full', i <= PUNCH_IDX[p.status] ? (p.status === 'verified' ? 'bg-ok-500' : 'bg-brand-500') : 'bg-[#E3E8EF]')} />
                    ))}
                  </div>
                  <div className="mt-1.5 text-[0.75rem] font-semibold text-ink-2">{PUNCH_STEPS[PUNCH_IDX[p.status]]}</div>
                </div>
                <Avatar who={p.owner} size={28} />
                <div className="w-[7.375rem] text-right max-sm:w-auto">
                  {p.status === 'verify' && <Button size="xs" variant="success" onClick={() => setPunch(p.id, 'verified')}>Verify</Button>}
                  {p.status === 'working' && <Button size="xs" onClick={() => setPunch(p.id, 'verify')}>Ready to verify</Button>}
                  {p.status === 'open' && (hold && /waiting/i.test(p.note || '') ? (
                    <Tip label="The return is on hold — decide the thinset first">
                      <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-warn-50 px-2.5 text-[0.78125rem] font-semibold text-warn-700"><Lock className="h-3.5 w-3.5" />On hold</span>
                    </Tip>
                  ) : (
                    <Button size="xs" onClick={() => setPunch(p.id, 'working')}>Start</Button>
                  ))}
                  {p.status === 'verified' && <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-ok-600"><CheckCircle2 className="h-4 w-4" />Done</span>}
                </div>
              </div>
            ))}
            {!items.length && <Empty icon={<CheckCircle2 className="h-6 w-6" />} title="No punch items" className="py-8" />}
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Closeout checks"
            count={`${checks.filter((c) => c.ok).length}/${checks.length}`}
            tone={checks.every((c) => c.ok) ? 'ok' : 'warn'}
            action={
              job.stage === 'closeout' ? (
                <Button size="sm" variant="primary" icon={<Receipt className="h-4 w-4" />} onClick={() => fin && s.open({ t: 'money', id: fin.id })}>Final bill</Button>
              ) : (
                <Tip label={left.length ? 'Verify the punch list first' : 'Run the closeout checks'}>
                  <span className="inline-block">
                    <Button size="sm" variant="primary" disabled={!!left.length} icon={left.length ? <Lock className="h-4 w-4" /> : undefined}>Review for completion</Button>
                  </span>
                </Tip>
              )
            }
          />
          <div className="grid grid-cols-3 gap-2 px-6 pb-6 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:px-4">
            {checks.map((c) => (
              <div key={c.t} className={cn('flex items-center gap-3 rounded-xl px-3.5 py-3', c.ok ? 'bg-ok-50/60' : 'bg-wash')}>
                {c.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-ok-500" /> : <Circle className="h-5 w-5 shrink-0 text-[#CDD4DE]" />}
                <div className="min-w-0">
                  <div className="truncate text-[0.84375rem] font-semibold text-ink">{c.t}</div>
                  <div className="truncate text-[0.78125rem] text-muted">{c.d}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ---------------- build rooms (setup) ---------------- */
export function BuildRoomsModal({ jobId, level }: { jobId: string; level: number }) {
  const close = useStore((s) => s.close)
  const job = useStore((s) => s.jobs[jobId])
  const proposal = [
    { name: 'Lobby', surfaces: ['Floor', 'Base', 'Feature wall'] },
    { name: 'Elevator vestibule', surfaces: ['Floor', 'Walls'] },
    { name: 'Corridors 2–4', surfaces: ['Floor', 'Base'] },
    { name: 'Mail room', surfaces: ['Floor'] },
  ]
  const [pick, setPick] = React.useState(proposal.map((p) => p.name))
  return (
    <Modal
      level={level}
      size="md"
      onClose={close}
      title={`Build ${job?.name} from the paperwork`}
      sub="Read from the finish schedule. Keep only what Cobblestone is tiling — the site manager verifies it later."
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button className="ml-auto" variant="primary" disabled={!pick.length} onClick={() => buildRooms(jobId, proposal.filter((p) => pick.includes(p.name)))}>
            Create {pick.length} rooms
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        {proposal.map((p) => {
          const on = pick.includes(p.name)
          return (
            <button key={p.name} onClick={() => setPick((x) => (on ? x.filter((y) => y !== p.name) : [...x, p.name]))} className={cn('flex items-center gap-4 rounded-2xl border p-4 text-left transition', on ? 'border-brand-500 bg-brand-50/50' : 'border-line hover:bg-wash')}>
              <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-md border-2', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#CDD4DE]')}>{on && <CheckCircle2 className="h-3.5 w-3.5" />}</span>
              <div className="flex-1">
                <div className="text-[0.9375rem] font-semibold text-ink">{p.name}</div>
                <div className="text-[0.8125rem] text-muted">{p.surfaces.join(' · ')}</div>
              </div>
              <Pill tone="neutral" size="sm">{p.surfaces.length} surfaces</Pill>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
