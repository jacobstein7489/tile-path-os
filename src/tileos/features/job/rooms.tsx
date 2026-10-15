import * as React from 'react'
import { Plus, CheckCircle2, Circle, Ban, Clock3, PauseCircle, HelpCircle, AlertTriangle, Package, Check, FileText, Layers3, LayoutGrid, Printer, ArrowLeftRight, ClipboardList, ArrowRight, Ruler } from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { useStore } from '@/tileos/store'
import { Card, Button, Pill, Empty, UnderlineTabs } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { Ring, Bar } from '@/tileos/components/ui/progress'
import { cn, TONE } from '@/tileos/lib/utils'
import type { Job, Tone } from '@/tileos/data/model'
import { GROUTS, SURF_LABEL, SURF_TONE, surfacePct, type Room, type Surface, type SurfState, tileOf } from '@/tileos/data/jobs'
import { confirmSurface } from '../flows'
import { surfaceFix } from './overview'
import { RoomDiary, RoomPhotos, roomMedia, openChangeFor } from '../field'

const STATE_ICON: Record<SurfState, React.ReactNode> = {
  done: <CheckCircle2 className="h-[1.375rem] w-[1.375rem] fill-ok-500 text-white" />,
  working: <Ring pct={55} size={22} stroke={3} tone="info" />,
  ready: <Circle className="h-[1.375rem] w-[1.375rem] text-ok-500" strokeWidth={2.4} />,
  blocked: <Ban className="h-[1.375rem] w-[1.375rem] text-bad-500" />,
  waitmat: <Clock3 className="h-[1.375rem] w-[1.375rem] text-warn-500" />,
  hold: <PauseCircle className="h-[1.375rem] w-[1.375rem] text-warn-500" />,
  notstarted: <Circle className="h-[1.375rem] w-[1.375rem] text-[#CDD4DE]" />,
  unknown: <HelpCircle className="h-[1.375rem] w-[1.375rem] text-warn-500" />,
}
/* the icon shows how far along a surface really is */
function stateIcon(x: Surface) {
  if (x.state === 'working') return <Ring pct={Math.max(8, surfacePct(x))} size={22} stroke={3} tone="info" />
  return STATE_ICON[x.state]
}
function surfaceSub(x: Surface) {
  if (x.pending) return `${x.pending.co} · waiting on approval`
  if (x.state === 'working') return `In progress · ${surfacePct(x)}%`
  if (x.state === 'done') return 'Finished'
  return SURF_LABEL[x.state]
}
const DOT: Record<SurfState, string> = {
  done: 'bg-ok-500', working: 'bg-brand-500', ready: 'bg-white ring-2 ring-inset ring-ok-500', blocked: 'bg-bad-500', waitmat: 'bg-warn-500', hold: 'bg-warn-500', notstarted: 'bg-[#CDD4DE]', unknown: 'bg-warn-500',
}
const subTone = (x: Surface) => (x.state === 'blocked' ? 'font-medium text-bad-600' : ['hold', 'waitmat', 'unknown'].includes(x.state) ? 'font-medium text-warn-700' : x.state === 'working' ? 'text-brand-700' : 'text-muted')

function roomTone(r: Room): Tone {
  if (r.surfaces.some((x) => x.state === 'blocked')) return 'bad'
  if (r.surfaces.some((x) => ['hold', 'waitmat', 'unknown'].includes(x.state))) return 'warn'
  if (r.surfaces.every((x) => x.state === 'done')) return 'ok'
  return 'info'
}

export type RoomView = 'surfaces' | 'log' | 'photos'
const attention = (r: Room) => Math.max(0, r.surfaces.findIndex((x) => ['blocked', 'hold', 'waitmat', 'unknown', 'working'].includes(x.state)))

export function RoomsTab({ job, room: r0, view: v0, surface: s0 }: { job: Job; room?: string; view?: RoomView; surface?: string }) {
  const rooms = useStore((s) => s.rooms[job.id]) || []
  const diary = useStore((s) => s.diary[job.id])
  const open = useStore((s) => s.open)
  const [ri, setRi] = React.useState(() => Math.max(0, rooms.findIndex((r) => r.name === r0)))
  const [view, setView] = React.useState<RoomView>(v0 || 'surfaces')
  const room = rooms[Math.min(ri, rooms.length - 1)]
  const [si, setSi] = React.useState(() => {
    if (!room) return 0
    const k = s0 ? room.surfaces.findIndex((x) => x.name === s0) : -1
    return k >= 0 ? k : attention(room)
  })
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (room) setSi(attention(room))
  }, [ri])
  if (!rooms.length)
    return (
      <Card>
        <Empty icon={<LayoutGrid className="h-6 w-6" />} title="No rooms built yet" sub="The back office builds the rooms and surfaces from the plans and finish schedule. The site manager verifies them." action={<Button variant="primary" onClick={() => open({ t: 'buildrooms', jobId: job.id })}>Build rooms</Button>} />
      </Card>
    )
  const sf = room.surfaces[Math.min(si, room.surfaces.length - 1)]
  const totalPct = job.pct ?? Math.round(rooms.reduce((n, r) => n + r.pct, 0) / rooms.length)
  const doneRooms = rooms.filter((r) => r.surfaces.every((x) => x.state === 'done')).length
  const roomDone = room.surfaces.filter((x) => x.state === 'done').length
  const entries = (diary || []).filter((e) => e.rooms.some((x) => x.room === room.name))
  const media = roomMedia(diary, room.name)
  const inField = ['scheduled', 'installation', 'punch'].includes(job.stage)
  const pickRoom = (i: number) => setRi(i)

  return (
    <Card className="grid min-h-[40rem] grid-cols-[16.25rem_minmax(0,1fr)] overflow-hidden max-xl:min-h-0 max-xl:grid-cols-1">
      {/* rooms rail (wide screens) */}
      <div className="flex min-w-0 flex-col border-r border-line max-xl:hidden">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div className="text-[1.0625rem] font-semibold text-ink">Rooms</div>
          <button className="inline-flex items-center gap-1 text-[0.84375rem] font-semibold text-brand-600" onClick={() => toast('Add room — the office names it and adds only the surfaces that apply')}>
            <Plus className="h-4 w-4" />Add room
          </button>
        </div>
        <div className="mx-5 mb-3 rounded-xl bg-wash p-3">
          <div className="flex items-center justify-between text-[0.8125rem] font-semibold text-ink-2">
            <span>Overall installed</span>
            <span className="tnum">{totalPct}%</span>
          </div>
          <Bar pct={totalPct} className="mt-2" h={6} />
          <div className="mt-1.5 text-[0.75rem] text-muted">{doneRooms} of {rooms.length} rooms complete</div>
        </div>
        <div className="scroll-soft flex-1 overflow-y-auto pb-2">
          {rooms.map((r, i) => {
            const tone = roomTone(r)
            const d = r.surfaces.filter((x) => x.state === 'done').length
            return (
              <button key={r.name} onClick={() => pickRoom(i)} className={cn('flex w-full items-center gap-3 border-l-[0.1875rem] px-5 py-3 text-left transition', i === ri ? 'border-brand-600 bg-brand-50/70' : 'border-transparent hover:bg-wash')}>
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-[0.9375rem] font-semibold', i === ri ? 'text-brand-700' : 'text-ink')}>{r.name}</div>
                  <div className="truncate text-[0.78125rem] text-muted">{d}/{r.surfaces.length} surfaces done</div>
                </div>
                <span className="text-[0.78125rem] font-semibold tnum text-ink-2">{r.pct}%</span>
                <Ring pct={r.pct} size={30} stroke={3.5} tone={tone} />
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-col">
        {/* rooms as a sideways row (tablets and phones) */}
        <div className="border-b border-line px-5 pb-3.5 pt-4 xl:hidden max-sm:px-4">
          <div className="flex items-center justify-between gap-3 text-[0.8125rem] font-semibold text-ink-2">
            <span>Rooms · {doneRooms} of {rooms.length} complete</span>
            <span className="tnum">{totalPct}% installed</span>
          </div>
          <Bar pct={totalPct} className="mt-2" h={5} />
          <div className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {rooms.map((r, i) => (
              <button key={r.name} onClick={() => pickRoom(i)} className={cn('inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[0.84375rem] font-semibold transition', i === ri ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}>
                <Ring pct={r.pct} size={18} stroke={2.5} tone={roomTone(r)} />
                {r.name}
                <span className={cn('tnum text-[0.75rem]', i === ri ? 'text-brand-600' : 'text-muted')}>{r.pct}%</span>
              </button>
            ))}
          </div>
        </div>

        {/* the room: name, how far, and its three views */}
        <div className="border-b border-line px-6 pt-5 max-sm:px-4 max-sm:pt-4">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="min-w-0">
              <div className="h-tight text-[1.3125rem] font-bold text-ink max-sm:text-[1.1875rem]">{room.name}</div>
              <div className="mt-0.5 text-[0.84375rem] text-muted">
                {roomDone} of {room.surfaces.length} surfaces finished · <span className="font-semibold text-ink-2">{room.pct}% installed</span>
                {entries[0] ? ` · last update ${entries[0].day}` : ''}
              </div>
            </div>
            {inField && (
              <Button size="sm" variant="primary" className="max-sm:w-full" icon={<ClipboardList className="h-4 w-4" />} onClick={() => open({ t: 'daily', jobId: job.id, room: room.name })}>
                Today’s update
              </Button>
            )}
          </div>
          <UnderlineTabs
            size="sm"
            className="mt-2 border-b-0"
            value={view}
            onChange={setView}
            items={[
              { key: 'surfaces', label: 'Surfaces', count: room.surfaces.length },
              { key: 'log', label: 'Daily log', count: entries.length },
              { key: 'photos', label: 'Photos', count: media.length },
            ]}
          />
        </div>

        {view === 'surfaces' && (
          <div className="grid flex-1 grid-cols-[15.625rem_minmax(0,1fr)] max-md:grid-cols-1">
            {/* the surfaces of this room */}
            <div className="flex min-w-0 flex-col border-r border-line max-md:hidden">
              <div className="scroll-soft flex-1 overflow-y-auto py-2">
                {room.surfaces.map((x, i) => (
                  <button key={x.name} onClick={() => setSi(i)} className={cn('flex w-full items-center gap-3 border-l-[0.1875rem] px-5 py-3 text-left transition', i === si ? 'border-brand-600 bg-brand-50/70' : 'border-transparent hover:bg-wash')}>
                    <div className="min-w-0 flex-1">
                      <div className={cn('truncate text-[0.90625rem] font-semibold', i === si ? 'text-brand-700' : 'text-ink')}>{x.name}</div>
                      <div className={cn('truncate text-[0.78125rem]', subTone(x))}>{surfaceSub(x)}</div>
                    </div>
                    {stateIcon(x)}
                  </button>
                ))}
              </div>
              <button className="mx-5 mb-4 mt-1 inline-flex items-center gap-1 self-start text-[0.84375rem] font-semibold text-brand-600" onClick={() => toast('Add surface — only what actually applies')}>
                <Plus className="h-4 w-4" />Add surface
              </button>
            </div>
            {/* phones and tablets: surfaces as a sideways row */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-line-2 px-4 py-3 md:hidden">
              {room.surfaces.map((x, i) => (
                <button key={x.name} onClick={() => setSi(i)} className={cn('inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[0.84375rem] font-semibold transition', i === si ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2')}>
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', DOT[x.state])} />
                  {x.name}
                  {x.state === 'working' && <span className={cn('tnum text-[0.75rem]', i === si ? 'text-brand-600' : 'text-muted')}>{surfacePct(x)}%</span>}
                </button>
              ))}
            </div>
            <SurfaceDetail key={room.name + sf.name} job={job} room={room} sf={sf} />
          </div>
        )}
        {view === 'log' && <RoomDiary key={'log' + room.name} job={job} room={room} />}
        {view === 'photos' && <RoomPhotos key={'pics' + room.name} job={job} room={room} />}
      </div>
    </Card>
  )
}

function SurfaceDetail({ job, room, sf }: { job: Job; room: Room; sf: Surface }) {
  const s = useStore()
  const tile = tileOf(job.id, sf.tile)
  const grout = sf.grout ? GROUTS[sf.grout] : undefined
  const tone = SURF_TONE[sf.state]
  const fix = surfaceFix(job, room.name, sf)
  const check = s.checks.find((c) => c.jobId === job.id && c.tag === sf.tile)
  const metal = sf.edge && /jolly|metal/i.test(sf.edge) ? s.mats.find((m) => m.jobId === job.id && m.kind === 'metal') : undefined
  const linked: { label: string; status: string; tone: Tone }[] = []
  if (tile) linked.push({ label: `Tile ${tile.tag}`, status: check ? (check.received >= check.ordered ? 'On site' : `${check.received} of ${check.ordered} ${check.unit}`) : 'Ordered by GC', tone: check && check.received < check.ordered ? 'warn' : 'ok' })
  if (grout) linked.push({ label: `Grout · ${grout.name}`, status: 'On site', tone: 'ok' })
  if (metal) linked.push({ label: 'JOLLY · brass 10 mm', status: metal.status === 'delivered' ? 'On site' : metal.status === 'partial' ? '4 of 6 · 2 tomorrow' : metal.status, tone: metal.status === 'delivered' ? 'ok' : 'warn' })

  const pct = surfacePct(sf)
  const changeable = sf.state !== 'done' || !!sf.sf
  return (
    <div className="scroll-soft flex min-w-0 flex-col overflow-y-auto">
      <div className="border-b border-line-2 px-6 pb-4 pt-5 max-sm:px-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="h-tight text-[1.375rem] font-bold text-ink">{sf.name}</div>
            <Pill tone={tone} className="mt-2" dot>{SURF_LABEL[sf.state]}</Pill>
          </div>
          {sf.sf ? (
            <div className="w-[13.75rem] max-sm:w-full">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.78125rem] font-medium text-muted">Done vs. the plan</span>
                <span className={cn('text-[0.9375rem] font-bold tnum', pct === 100 ? 'text-ok-600' : 'text-ink')}>{pct}%</span>
              </div>
              <Bar pct={pct} className="mt-1.5" h={7} tone={pct === 100 ? 'ok' : 'info'} />
              <div className="mt-1 text-[0.78125rem] text-muted tnum">{Math.round((sf.sf * pct) / 100)} of {sf.sf} SF tiled</div>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {changeable && (
            <Button size="xs" variant="soft" icon={<ArrowLeftRight className="h-4 w-4" />} onClick={() => s.open({ t: 'sitechange', jobId: job.id, room: room.name, surface: sf.name })}>
              Client wants a change
            </Button>
          )}
          <Button size="xs" icon={<AlertTriangle className="h-4 w-4" />} onClick={() => s.open({ t: 'record', jobId: job.id, type: 'question', where: `${room.name} · ${sf.name}` })}>Add issue</Button>
          <Button size="xs" icon={<Package className="h-4 w-4" />} onClick={() => s.open({ t: 'newpo', jobId: job.id })}>Order item</Button>
          <Button size="xs" variant={sf.state === 'unknown' ? 'primary' : 'secondary'} icon={<Check className="h-4 w-4" strokeWidth={2.6} />} onClick={() => confirmSurface(job.id, room.name, sf.name)}>Verified on site</Button>
        </div>
      </div>
      {sf.pending && (
        <div className="mx-6 mt-5 rounded-2xl border border-warn-100 bg-warn-50 p-4 max-sm:mx-4">
          <div className="flex flex-wrap items-center gap-3">
            <PauseCircle className="h-5 w-5 shrink-0 text-warn-600" />
            <div className="min-w-0 flex-1">
              <div className="text-[0.875rem] font-semibold text-ink">{sf.pending.co} · the crew holds this {/floor/i.test(sf.name) ? 'floor' : 'surface'} until it’s approved</div>
              <div className="mt-0.5 text-[0.84375rem] text-ink-2">{sf.pending.label}: {sf.pending.from} → <span className="font-semibold">{sf.pending.to}</span></div>
            </div>
            <Button size="xs" variant="primary" iconRight={<ArrowRight className="h-3.5 w-3.5" />} onClick={() => openChangeFor(job.id, sf.pending!.co)}>Open {sf.pending.co}</Button>
          </div>
        </div>
      )}
      {!sf.pending && (sf.reason || fix) && sf.state !== 'done' && ['blocked', 'hold', 'waitmat', 'unknown'].includes(sf.state) && (
        <div className={cn('mx-6 mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3 max-sm:mx-4 max-sm:flex-wrap', TONE[tone].border, TONE[tone].bg)}>
          {sf.state === 'blocked' ? <Ban className="h-5 w-5 text-bad-500" /> : <Clock3 className="h-5 w-5 text-warn-600" />}
          <div className="min-w-0 flex-1">
            <div className="text-[0.875rem] font-semibold text-ink">{sf.state === 'blocked' ? 'Do not start this surface' : sf.state === 'hold' ? 'Hold — change not approved' : sf.state === 'unknown' ? 'To verify on site' : 'Waiting on material'}</div>
            <div className="text-[0.84375rem] text-ink-2">{sf.reason}</div>
          </div>
          {fix && <Button size="xs" variant="primary" onClick={fix.run}>{fix.label}</Button>}
        </div>
      )}
      <div className="px-6 py-5 max-sm:px-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[1rem] font-semibold text-ink">Installation details</div>
          <button onClick={() => toast('Installer package for this room — printable sheet with plan and elevations (coming in the build)')} className="inline-flex items-center gap-1.5 text-[0.84375rem] font-semibold text-brand-600"><Printer className="h-4 w-4" />Installer sheet</button>
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {tile && (
            <Spec label="Tile">
              <div className="flex items-center gap-4">
                <TileImg tile={tile} size={76} radius={12} />
                <div className="min-w-0">
                  <div className="text-[0.9375rem] font-semibold text-ink">{tile.tag} · {tile.name}</div>
                  <div className="text-[0.8125rem] text-ink-2">{tile.size} · {tile.finish}</div>
                  <div className="mt-1 text-[0.78125rem] text-muted">{tile.maker} · {tile.sku}</div>
                  <div className="text-[0.78125rem] text-muted">Supplied by the {tile.suppliedBy} · {tile.supplier}</div>
                </div>
              </div>
            </Spec>
          )}
          <Spec label="Grout">
            {grout ? (
              <div className="flex items-center gap-4">
                <span className="h-[4rem] w-[4rem] shrink-0 rounded-full shadow-[inset_0_0_0_0.0625rem_rgba(16,24,40,.1)]" style={{ background: `radial-gradient(circle at 35% 30%, #fff8, transparent 45%), ${grout.color}` }} />
                <div>
                  <div className="text-[0.9375rem] font-semibold text-ink">{grout.name}</div>
                  {grout.product && <div className="text-[0.78125rem] text-muted">{grout.product}</div>}
                  <div className="mt-1 text-[0.8125rem] text-ink-2">Joint {sf.joint || '1/16″'}</div>
                </div>
              </div>
            ) : (
              <Unset text="Not set — ask at the design meeting" />
            )}
          </Spec>
          <Spec label="Edge / trim">
            {sf.edge ? (
              <div className="flex items-center gap-4">
                <EdgeArt edge={sf.edge} />
                <div className="text-[0.875rem] font-semibold text-ink">{sf.edge}</div>
              </div>
            ) : (
              <Unset text="No exposed edge" />
            )}
          </Spec>
          <Spec label="Layout">
            {sf.layout ? (
              <div className="flex items-center gap-4">
                <LayoutArt layout={sf.layout} />
                <div className="min-w-0">
                  <div className="text-[0.875rem] font-semibold text-ink">{sf.layout}</div>
                  {tile && <button onClick={() => s.open({ t: 'layout', jobId: job.id, room: room.name, surface: sf.name })} className="mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700"><Ruler className="h-3.5 w-3.5" />See it drawn to scale</button>}
                </div>
              </div>
            ) : tile ? (
              <button onClick={() => s.open({ t: 'layout', jobId: job.id, room: room.name, surface: sf.name })} className="flex items-center gap-3 text-left">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Ruler className="h-5 w-5" /></span>
                <span><span className="block text-[0.875rem] font-semibold text-brand-700">Draw the layout</span><span className="block text-[0.78125rem] text-muted">To scale, with the best start and every cut</span></span>
              </button>
            ) : (
              <Unset text="Not decided yet" />
            )}
          </Spec>
          <Spec label="Height / termination">
            {sf.height ? (
              <div className="flex items-center gap-4">
                <HeightArt height={sf.height} />
                <div className="text-[0.875rem] font-semibold text-ink">{sf.height}</div>
              </div>
            ) : (
              <Unset text="Floor — no height" />
            )}
          </Spec>
          <Spec label="Prep / waterproofing">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-wash-2 text-muted"><Layers3 className="h-5 w-5" /></span>
              <div className="text-[0.875rem] font-semibold text-ink">{sf.prep || 'Standard thinset on approved substrate'}</div>
            </div>
          </Spec>
        </div>
        {(sf.notes || sf.decided?.length) && (
          <div className="mt-3 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            {sf.notes && (
              <Spec label="Notes">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 text-muted" />
                  <div className="text-[0.875rem] text-ink-2">{sf.notes}</div>
                </div>
              </Spec>
            )}
            {sf.decided?.length ? (
              <Spec label="Decided — permanent">
                <div className="flex flex-col gap-1.5">
                  {sf.decided.map((d, i) => (
                    <div key={i} className="flex items-start gap-2 text-[0.84375rem] text-ink-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-500" />
                      {d}
                    </div>
                  ))}
                </div>
              </Spec>
            ) : null}
          </div>
        )}
        {linked.length > 0 && (
          <div className="mt-4 rounded-2xl border border-line p-4">
            <div className="mb-3 text-[0.84375rem] font-semibold text-muted">Linked materials</div>
            <div className="flex flex-wrap gap-2.5">
              {linked.map((l) => (
                <button key={l.label} onClick={() => s.open({ t: 'job', id: job.id, tab: 'materials' })} className="inline-flex items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2 hover:bg-wash">
                  <span className="text-[0.84375rem] font-semibold text-ink">{l.label}</span>
                  <span className={cn('text-[0.8125rem] font-medium', TONE[l.tone].strong)}>{l.status}</span>
                  {l.tone === 'ok' ? <CheckCircle2 className="h-4 w-4 text-ok-500" /> : <Clock3 className="h-4 w-4 text-warn-500" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 text-[0.8125rem] font-semibold text-muted">{label}</div>
      {children}
    </div>
  )
}
const Unset = ({ text }: { text: string }) => <div className="text-[0.875rem] text-faint">{text}</div>

/* little drawings so the detail is visual, not words */
export function LayoutArt({ layout }: { layout: string }) {
  const l = layout.toLowerCase().replace(/½/g, '1/2').replace(/⅓/g, '1/3')
  const stroke = '#AEB7C4'
  let body: React.ReactNode
  if (l.includes('vertical')) body = Array.from({ length: 6 }).map((_, i) => <rect key={i} x={4 + i * 12} y={4} width={12} height={52} fill="#fff" stroke={stroke} />)
  else if (/herringbone|chevron/.test(l)) {
    body = Array.from({ length: 8 }).map((_, r) => Array.from({ length: 6 }).map((_, c) => {
      const x = 4 + c * 14 - (r % 2) * 7
      const y = -6 + r * 8 + (c % 2) * 7
      return c % 2 ? <rect key={r + '-' + c} x={x} y={y} width={14} height={7} fill="#fff" stroke={stroke} /> : <rect key={r + '-' + c} x={x + 7} y={y - 7} width={7} height={14} fill="#fff" stroke={stroke} />
    }))
  } else if (/diagonal/.test(l)) {
    body = <g transform="rotate(45 40 30)">{Array.from({ length: 9 }).map((_, r) => Array.from({ length: 9 }).map((_, c) => <rect key={r + '-' + c} x={-20 + c * 14} y={-30 + r * 14} width={14} height={14} fill="#fff" stroke={stroke} />))}</g>
  } else if (/1\/2|1\/3|offset|brick|running/.test(l)) {
    const third = l.includes('1/3')
    const off = third ? 8 : 12
    body = Array.from({ length: 6 }).map((_, r) => Array.from({ length: 5 }).map((_, c) => <rect key={r + '-' + c} x={4 + c * 24 - ((r % (third ? 3 : 2)) * off)} y={4 + r * 9} width={24} height={9} fill="#fff" stroke={stroke} />))
  } else if (l.includes('pitched') || l.includes('drain')) {
    body = (
      <>
        {Array.from({ length: 5 }).map((_, r) => Array.from({ length: 7 }).map((_, c) => <rect key={r + '-' + c} x={4 + c * 10.3} y={4 + r * 10.4} width={10.3} height={10.4} fill="#fff" stroke={stroke} />))}
        <circle cx="40" cy="30" r="4" fill="#1F5CF0" />
        <path d="M10 8L34 26M70 8L46 26M10 52L34 34M70 52L46 34" stroke="#1F5CF0" strokeWidth="1.4" markerEnd="" />
      </>
    )
  } else if (l.includes('niche') || l.includes('mitered')) {
    body = (
      <>
        {Array.from({ length: 4 }).map((_, r) => Array.from({ length: 3 }).map((_, c) => <rect key={r + '-' + c} x={4 + c * 24} y={4 + r * 13} width={24} height={13} fill="#fff" stroke={stroke} />))}
        <rect x="24" y="18" width="32" height="22" fill="#EEF3FF" stroke="#1F5CF0" strokeWidth="1.6" />
      </>
    )
  } else {
    body = (
      <>
        {Array.from({ length: 3 }).map((_, r) => Array.from({ length: 4 }).map((_, c) => <rect key={r + '-' + c} x={4 + c * 18} y={4 + r * 17.4} width={18} height={17.4} fill="#fff" stroke={stroke} />))}
        <path d="M40 4V56M4 30H76" stroke="#1F5CF0" strokeWidth="1.2" strokeDasharray="3 2" />
      </>
    )
  }
  return (
    <svg width="80" height="60" viewBox="0 0 80 60" className="shrink-0 rounded-lg bg-wash">
      <clipPath id="lc"><rect x="4" y="4" width="72" height="52" rx="2" /></clipPath>
      <g clipPath="url(#lc)">{body}</g>
      <rect x="4" y="4" width="72" height="52" rx="2" fill="none" stroke="#8E99A8" />
    </svg>
  )
}

export function HeightArt({ height }: { height: string }) {
  const h = height.toLowerCase()
  const ratio = h.includes('ceiling') || h.includes('full') ? 0.92 : h.includes('84') ? 0.8 : h.includes('48') ? 0.5 : h.includes('3 ft') ? 0.38 : h.includes('18') ? 0.24 : h.includes('4″') ? 0.1 : h.includes('mantel') ? 0.6 : 0.5
  const top = 56 - 50 * ratio
  return (
    <svg width="80" height="60" viewBox="0 0 80 60" className="shrink-0 rounded-lg bg-wash">
      <rect x="12" y="6" width="56" height="50" fill="#fff" stroke="#AEB7C4" />
      <rect x="12" y={top} width="56" height={56 - top} fill="#E9EEF8" />
      {Array.from({ length: 6 }).map((_, i) => (top + i * 7 < 56 ? <path key={i} d={`M12 ${top + i * 7}H68`} stroke="#C9D3E2" strokeWidth=".8" /> : null))}
      <path d={`M8 ${top}H72`} stroke="#1F5CF0" strokeWidth="1.6" />
      <path d={`M74 56V${top}`} stroke="#1F5CF0" strokeWidth="1" markerEnd="" />
    </svg>
  )
}

export function EdgeArt({ edge }: { edge: string }) {
  const e = edge.toLowerCase()
  const brass = e.includes('brass')
  const metal = e.includes('jolly') || e.includes('metal')
  const g1 = brass ? '#EBD9AC' : '#EEF0F3'
  const g2 = brass ? '#B98E45' : '#9AA3AE'
  return (
    <svg width="64" height="60" viewBox="0 0 64 60" className="shrink-0 rounded-lg bg-wash">
      <defs>
        <linearGradient id={'m' + (brass ? 'b' : 'c')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={g1} />
          <stop offset=".5" stopColor={g2} />
          <stop offset="1" stopColor={g1} />
        </linearGradient>
      </defs>
      {metal ? (
        <>
          <rect x="14" y="8" width="26" height="44" fill="#fff" stroke="#AEB7C4" />
          <path d="M40 6H46V52H40Z" fill={`url(#m${brass ? 'b' : 'c'})`} stroke={g2} strokeWidth=".8" />
          <path d="M40 52H22V48H40Z" fill={`url(#m${brass ? 'b' : 'c'})`} opacity=".7" />
        </>
      ) : e.includes('miter') ? (
        <>
          <path d="M10 10H40L54 24V52H24L10 38Z" fill="#fff" stroke="#AEB7C4" />
          <path d="M40 10L24 52" stroke="#1F5CF0" strokeWidth="1.4" />
        </>
      ) : e.includes('saddle') ? (
        <>
          <rect x="6" y="30" width="22" height="12" fill="#fff" stroke="#AEB7C4" />
          <path d="M28 30H42L46 34V42H28Z" fill="#F1ECE2" stroke="#B8AA90" />
          <rect x="46" y="34" width="14" height="8" fill="#D9C2A0" />
        </>
      ) : (
        <>
          <rect x="6" y="28" width="26" height="12" fill="#fff" stroke="#AEB7C4" />
          <rect x="32" y="28" width="26" height="12" fill="#E7DCCB" stroke="#C3B49B" />
          <path d="M32 24V44" stroke="#1F5CF0" strokeWidth="1.2" strokeDasharray="2 2" />
        </>
      )}
    </svg>
  )
}
