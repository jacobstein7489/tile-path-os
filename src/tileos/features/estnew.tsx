/* Pricing a new project: the project and its plans — it goes straight to the takeoff person's Today; every step after
 * that hands it to the next person. (The area picker below is what the estimate window uses to add rooms.) */
import * as React from 'react'
import { Building2, Check, Plus, UserPlus, X, Users, ArrowRight, Upload, FileText } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Button, Avatar, TextInput, TextArea, Chip } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, Pop, DatePresets, Tip } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { FLOORS, uniqueArea, sortAreas, guessSurfaces } from '@/tileos/data/areas'
import type { EstTeam } from '@/tileos/data/estimates'
import { TODAY, addDays, md, workday } from '@/tileos/lib/today'
import { companyTeam, companyAreas, companySurfaces, surfaceOf, newEstimate, TEAM_KEYS, TEAM_LABEL, EST_PEOPLE } from './estflow'
import { isOff } from './active'
import { insidePeople } from './steps-ui'

export type PickedArea = { name: string; floor?: string; surfaces: string[] }

/** one person per step — tap a face to change it */
export function TeamSlots({ team, onChange, now, compact }: { team: EstTeam; onChange?: (k: keyof EstTeam, p: PersonKey) => void; now?: keyof EstTeam | null; compact?: boolean }) {
  const st = useStore()
  const people = insidePeople(st)
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'grid-cols-4 max-md:grid-cols-2')}>
      {TEAM_KEYS.map((k, i) => {
        const p = team[k]
        const on = now === k
        const body = (
          <span className={cn('flex w-full items-center gap-2.5 rounded-[0.6875rem] border px-2.5 py-2 text-left transition', on ? 'border-brand-300 bg-brand-50' : 'border-line bg-white', onChange && 'hover:border-[#c6bfb4]')}>
            <Avatar who={p} size={28} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[0.71875rem] font-semibold text-muted">{i + 1}. {TEAM_LABEL[k]}{on && <span className="ml-1.5 text-brand-700">· now</span>}</span>
              <span className="block truncate text-[0.84375rem] font-semibold text-ink">{PEOPLE[p].name}</span>
            </span>
          </span>
        )
        if (!onChange) return <div key={k}>{body}</div>
        return (
          <Menu key={k} align="start" width={260} trigger={<button type="button" aria-label={`${TEAM_LABEL[k]} — ${PEOPLE[p].name}`} className="block w-full">{body}</button>}>
            <MenuLabel>{TEAM_LABEL[k]}</MenuLabel>
            {(people.length ? people : EST_PEOPLE).map((x) => <MenuItem key={x} icon={<Avatar who={x} size={20} />} checked={x === p} hint={PEOPLE[x]?.roleLabel} onSelect={() => onChange(k, x)}>{PEOPLE[x]?.name}</MenuItem>)}
          </Menu>
        )
      })}
    </div>
  )
}

/** pick surfaces for an area — tick as many as you need; it stays open until Done. Without onRemove the ones
 *  already there stay ticked (the estimate window adds lines; removing is done on the line itself). */
export function SurfaceAdd({ have, onAdd, onRemove, label = 'Surfaces' }: { have: string[]; onAdd: (key: string) => void; onRemove?: (key: string) => void; label?: string }) {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const [t, setT] = React.useState('')
  const all = companySurfaces(s)
  const own = have.filter((k) => !all.some((x) => x.key === k))
  const add = () => { if (!t.trim()) return; onAdd(t.trim()); setT('') }
  /* the checklist opens right under the room — one scroll for the whole window, nothing floating on top */
  return (
    <>
      <button type="button" aria-label={label === 'Surfaces' ? 'Pick surfaces' : label} aria-expanded={open} onClick={() => setOpen(!open)} className={cn('inline-flex h-7 items-center gap-1 rounded-full border border-dashed px-2.5 text-[0.78125rem] font-semibold transition', open ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-[#c6bfb4] text-muted hover:border-brand-300 hover:text-brand-700')}><Plus className="h-3.5 w-3.5" />{label}</button>
      {open && (
        <div className="order-last mt-1 basis-full rounded-xl border border-brand-100 bg-white p-3 shadow-xs">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink">Tick every surface it has</span>
            <span className="text-[0.75rem] text-muted">{have.length} picked</span>
          </div>
          <div role="group" aria-label="Surfaces" className="mt-2 grid grid-cols-4 gap-x-1 max-lg:grid-cols-3 max-sm:grid-cols-2">
            {[...all.map((x) => ({ key: x.key, label: x.label })), ...own.map((k) => ({ key: k, label: surfaceOf(s, k).label }))].map((x) => {
              const on = have.includes(x.key)
              const locked = on && !onRemove
              return (
                <button key={x.key} type="button" role="checkbox" aria-checked={on} disabled={locked} onClick={() => (on ? onRemove?.(x.key) : onAdd(x.key))} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-[0.4375rem] text-left text-[0.8125rem] text-ink-2 transition hover:bg-wash-2 disabled:cursor-default disabled:hover:bg-transparent">
                  <span className={cn('inline-flex h-[1.0625rem] w-[1.0625rem] shrink-0 items-center justify-center rounded-[0.3125rem] border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9ced6] bg-white', locked && 'opacity-60')}>{on && <Check className="h-3 w-3" strokeWidth={3.2} />}</span>
                  <span className={cn('truncate', on && 'font-semibold text-ink')}>{x.label}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-2.5 flex items-center gap-2 border-t border-line-2 pt-2.5">
            <form className="flex min-w-0 flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); add() }}>
              <TextInput value={t} onChange={(e) => setT(e.target.value)} placeholder="Your own — e.g. Fireplace surround" aria-label="Your own surface" className="h-8 max-w-[18rem] text-[0.8125rem]" />
              <Button size="sm" type="submit" disabled={!t.trim()}>Add</Button>
            </form>
            <Button size="sm" variant="primary" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      )}
    </>
  )
}

const baseName = (n: string) => n.replace(/ #\d+$/, '')
/** pick the floor, tick the rooms on it (tap again to take one off), then tick each room's surfaces.
 *  The list below always reads in order: by floor, then the way the company's list reads. */
export function AreaBuilder({ areas, onChange }: { areas: PickedArea[]; onChange: (a: PickedArea[]) => void }) {
  const s = useStore()
  const presets = companyAreas(s)
  const [floor, setFloor] = React.useState('1st floor')
  const [own, setOwn] = React.useState('')
  const fl = floor || undefined
  const put = (list: PickedArea[]) => onChange(sortAreas(list, presets.map((p) => p.name)))
  const add = (name: string, surfaces: string[]) => put([...areas, { name: uniqueArea(name, areas.map((a) => a.name)), floor: fl, surfaces }])
  const onFloor = (n: string) => areas.filter((a) => baseName(a.name) === n && (a.floor || '') === floor)
  const toggle = (p: { name: string; surfaces: string[] }) => {
    const here = onFloor(p.name)
    if (here.length) { const last = here[here.length - 1]; put(areas.filter((a) => a !== last)) }
    else add(p.name, [...p.surfaces])
  }
  const set = (a0: PickedArea, p: Partial<PickedArea>) => put(areas.map((a) => (a === a0 ? { ...a, ...p } : a)))
  const groups = Array.from(new Set(areas.map((a) => a.floor || ''))).map((f) => ({ floor: f, list: areas.filter((a) => (a.floor || '') === f) }))
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[0.78125rem] font-semibold text-muted">Floor</span>
        {[...FLOORS, ''].map((f) => (
          <button key={f || 'none'} type="button" aria-pressed={floor === f} onClick={() => setFloor(f)} className={cn('inline-flex h-7 items-center rounded-full border px-2.5 text-[0.78125rem] font-semibold transition', floor === f ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-[#c6bfb4]')}>{f || 'No floor'}</button>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const n = onFloor(p.name).length
          return (
            <Tip key={p.name} label={`Comes with: ${p.surfaces.map((k) => surfaceOf(s, k).label.toLowerCase()).join(', ')}`}>
              <button type="button" aria-pressed={n > 0} onClick={() => toggle(p)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-medium transition', n ? 'border-brand-300 bg-brand-50 text-brand-800' : 'border-line bg-white text-ink-2 hover:border-brand-300 hover:text-brand-700')}>
                {n ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <Plus className="h-3.5 w-3.5" />}{p.name}{n > 1 && <span className="text-[0.75rem] font-semibold">×{n}</span>}
              </button>
            </Tip>
          )
        })}
        <form className="inline-flex" onSubmit={(e) => { e.preventDefault(); if (!own.trim()) return; add(own.trim(), guessSurfaces(own.trim(), presets)); setOwn('') }}>
          <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Your own area…" aria-label="Your own area" className="h-8 w-[9.375rem] rounded-l-full border border-r-0 border-line bg-white px-3 text-[0.8125rem] text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none" />
          <button type="submit" disabled={!own.trim()} className="inline-flex h-8 items-center rounded-r-full border border-line bg-wash px-2.5 text-[0.78125rem] font-semibold text-ink-2 disabled:text-faint">Add</button>
        </form>
      </div>
      {areas.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-[0.75rem] border border-line">
          {groups.map((g) => (
            <div key={g.floor || 'none'}>
              <div className="border-b border-line-2 bg-[#f7f5f0] px-3 py-1.5 text-[0.71875rem] font-bold uppercase tracking-[0.06em] text-muted">{g.floor || 'No floor'}</div>
              {g.list.map((a) => (
                <div key={a.name + (a.floor || '')} className="flex items-start gap-3 border-b border-line-2 px-3 py-2.5 last:border-b-0">
                  <div className="w-[10.625rem] shrink-0 pt-0.5 max-sm:w-[7.5rem]">
                    <div className="truncate text-[0.875rem] font-semibold text-ink">{a.name}</div>
                    <div className="mt-0.5 flex items-center gap-2 text-[0.75rem]">
                      <Menu align="start" width={200} trigger={<button type="button" className="font-semibold text-muted hover:text-ink">Move</button>}>
                        <MenuLabel>Which floor</MenuLabel>
                        {FLOORS.map((f) => <MenuItem key={f} checked={a.floor === f} onSelect={() => set(a, { floor: f })}>{f}</MenuItem>)}
                        <MenuItem checked={!a.floor} onSelect={() => set(a, { floor: undefined })}>No floor</MenuItem>
                      </Menu>
                      <button type="button" aria-label={`Another ${baseName(a.name)}`} onClick={() => put([...areas, { name: uniqueArea(baseName(a.name), areas.map((x) => x.name)), floor: a.floor, surfaces: [...a.surfaces] }])} className="font-semibold text-muted hover:text-ink">+ Another</button>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {a.surfaces.map((k) => (
                      <span key={k} className="inline-flex h-7 items-center gap-1 rounded-full bg-wash-2 pl-2.5 pr-1 text-[0.78125rem] font-medium text-ink-2">
                        {surfaceOf(s, k).label}
                        <button type="button" aria-label={`Remove ${surfaceOf(s, k).label}`} onClick={() => set(a, { surfaces: a.surfaces.filter((x) => x !== k) })} className="inline-flex h-5 w-5 items-center justify-center rounded-full text-faint hover:bg-white hover:text-bad-600"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                    <SurfaceAdd have={a.surfaces} onAdd={(k) => set(a, { surfaces: [...a.surfaces, k] })} onRemove={(k) => set(a, { surfaces: a.surfaces.filter((x) => x !== k) })} />
                  </div>
                  <button type="button" aria-label={`Remove ${a.name}`} onClick={() => put(areas.filter((x) => x !== a))} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-bad-50 hover:text-bad-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[0.75rem] border border-dashed border-line px-4 py-5 text-center text-[0.84375rem] text-muted">Pick a floor, then tap its rooms — each comes with its usual surfaces (a bathroom brings its niche, waterproofing, saddle and metals). Untick what it doesn’t have.</div>
      )}
    </div>
  )
}

/* Price a new project: the project, the client, the bid date — and the plans. That's all it takes: it goes straight to
 * whoever does the takeoff (Malisa, unless Settings says otherwise), with the plans on the project, and lands on her
 * Today. She builds the rooms and the takeoff from the plans — nobody has to set up the estimate first. */
export function NewEstimateModal({ level }: { level: number }) {
  const s = useStore()
  const [name, setName] = React.useState('')
  const [address, setAddress] = React.useState('')
  const [cq, setCq] = React.useState('')
  const [client, setClient] = React.useState<{ id: string; name: string } | null>(null)
  /* an estimate is due right away unless you say otherwise */
  const [due, setDue] = React.useState(md(TODAY))
  const [scope, setScope] = React.useState('')
  const [docs, setDocs] = React.useState<string[]>([])
  const [files, setFiles] = React.useState<File[]>([])
  const [over, setOver] = React.useState(false)
  const [team, setTeam] = React.useState<EstTeam>(() => companyTeam(s))
  const [who, setWho] = React.useState(false)
  /* the rooms are the takeoff person's job — but if you already know them, you can put them in */
  const [areas, setAreas] = React.useState<PickedArea[]>([])
  const [rooms, setRooms] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  const custs = Object.values(CUSTOMERS).filter((c) => !isOff(s, 'client', c.id) && (!cq || c.name.toLowerCase().includes(cq.toLowerCase()))).slice(0, 5)
  const ok = !!name.trim() && !!(client || cq.trim())
  const me = meOf(s.role)
  const people = insidePeople(s)
  const addFiles = (l: File[]) => { const ok2 = l.filter((f) => /pdf|image/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic|dwg)$/i.test(f.name)); if (!ok2.length) return; setFiles((p) => [...p, ...ok2]); setDocs((d) => (d.includes('Plans') ? d : [...d, 'Plans'])) }
  const shownDocs = Array.from(new Set([...(files.length ? ['Plans'] : []), ...docs]))
  const create = () => newEstimate({ name: name.trim(), address: address.trim(), clientId: client?.id || 'new', client: client?.name || cq.trim(), due, scope: scope.trim() || 'Scope to confirm from the plans', docs: shownDocs, team, areas, files })
  const tk = PEOPLE[team.takeoff]
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="Price a new project"
      sub={`Upload the plans — it goes straight to ${team.takeoff === me ? 'you' : tk.short} for the takeoff`}
      footer={
        <>
          <span className="inline-flex min-w-0 items-center gap-2 text-[0.8125rem] text-muted max-sm:hidden">
            <Avatar who={team.takeoff} size={22} plain />
            <span className="truncate">{team.takeoff === me ? 'Lands on your Today' : `Lands on ${tk.short}’s Today`}{files.length ? ` · ${files.length} file${files.length === 1 ? '' : 's'}` : ''}</span>
          </span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<ArrowRight />} disabled={!ok} onClick={create}>{team.takeoff === me ? 'Start the takeoff' : `Send to ${tk.short} for the takeoff`}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <label className="block"><span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2">Project name</span><TextInput data-autofocus aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Leeds Residence" className="h-10" /></label>
          <label className="block"><span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2">Address</span><TextInput aria-label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" className="h-10" /></label>
        </div>
        <div>
          <div className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">Client or GC</div>
          {client ? (
            <div className="flex h-10 items-center justify-between rounded-[0.5625rem] border border-line bg-wash px-3">
              <span className="flex items-center gap-2 text-[0.875rem] font-semibold text-ink"><Building2 className="h-4 w-4 text-muted" />{client.name}{client.id === 'new' && <span className="text-[0.75rem] font-medium text-muted">· new client</span>}</span>
              <button type="button" onClick={() => setClient(null)} className="text-[0.8125rem] font-semibold text-brand-700 hover:underline">Change</button>
            </div>
          ) : (
            <>
              <TextInput aria-label="Client" value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Type to search, or a new name" className="h-10" />
              {(custs.length > 0 || cq.trim()) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {custs.map((c) => <Chip key={c.id} onClick={() => setClient({ id: c.id, name: c.name })} className="h-8 px-2.5 text-[0.8125rem]" icon={<Building2 className="h-3.5 w-3.5 text-muted" />}>{c.name}</Chip>)}
                  {cq.trim() && !custs.some((c) => c.name.toLowerCase() === cq.trim().toLowerCase()) && <Chip onClick={() => setClient({ id: 'new', name: cq.trim() })} className="h-8 px-2.5 text-[0.8125rem]" icon={<UserPlus className="h-3.5 w-3.5" />}>Add “{cq.trim()}”</Chip>}
                </div>
              )}
            </>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">Bid due</div>
          <DatePresets value={due} onPick={setDue} presets={[md(TODAY), md(workday(addDays(TODAY, 1))), ...[3, 5, 10].map((n) => md(workday(addDays(TODAY, n))))]} />
        </div>

        {/* the plans */}
        <div>
          <div className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">The plans</div>
          <input ref={input} type="file" multiple accept="application/pdf,image/*,.dwg" className="hidden" aria-label="Upload the plans" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; addFiles(l) }} />
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false) }}
            onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(Array.from(e.dataTransfer.files || [])) }}
            className={cn('flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d8d2c8] bg-[#faf8f5]')}
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-xs"><Upload className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.90625rem] font-semibold text-ink">{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} ready` : 'Drop the plans here'}</span>
              <span className="block text-[0.8125rem] text-muted">PDFs or pictures — the plans, the spec book, the finish schedule. {tk.short} works from them.</span>
            </span>
            <Button size="sm" icon={<Upload />} onClick={() => input.current?.click()}>{files.length ? 'Add more' : 'Upload'}</Button>
          </div>
          {files.length > 0 && (
            <div className="mt-2 flex flex-col gap-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 rounded-lg bg-wash px-3 py-1.5 text-[0.8125rem]">
                  <FileText className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{f.name}</span>
                  <span className="shrink-0 tnum text-muted">{f.size > 1_000_000 ? `${(f.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1000))} KB`}</span>
                  <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((_, k) => k !== i))} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-white hover:text-bad-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[0.78125rem] text-muted">What came in:</span>
            {['Plans', 'Spec book', 'Finish schedule', 'Photos'].map((d) => (
              <Chip key={d} on={shownDocs.includes(d)} onClick={() => { if (d === 'Plans' && files.length) return; setDocs((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d])) }} className="h-8 px-2.5 text-[0.8125rem]">{d}</Chip>
            ))}
          </div>
          {['Plans', 'Spec book', 'Finish schedule'].some((d) => !shownDocs.includes(d)) && <div className="mt-1.5 text-[0.78125rem] text-muted">Whatever’s missing, the office asks the GC for — it comes back with a date.</div>}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2">Anything else to know</span>
          <TextArea aria-label="Anything else to know" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Which floors, upgrades, who supplies the tile, deadlines" className="min-h-[4rem]" />
        </label>

        <div className="rounded-[0.75rem] border border-line">
          <button type="button" onClick={() => setRooms((v) => !v)} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
            <Building2 className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block text-[0.84375rem] font-semibold text-ink">The rooms {areas.length ? `· ${areas.length}` : <span className="font-normal text-muted">— optional</span>}</span>
              <span className="block truncate text-[0.78125rem] text-muted">{areas.length ? areas.map((a) => a.name).join(', ') : `${tk.short} puts them in from the plans — add them now only if you already know them`}</span>
            </span>
            <span className="text-[0.8125rem] font-semibold text-muted">{rooms ? 'Done' : areas.length ? 'Change' : 'Add rooms'}</span>
          </button>
          {rooms && <div className="border-t border-line-2 p-3"><AreaBuilder areas={areas} onChange={setAreas} /></div>}
        </div>

        <div className="rounded-[0.75rem] border border-line">
          <div className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
            <Users className="h-4 w-4 shrink-0 text-muted" />
            <span className="text-[0.84375rem] font-semibold text-ink">The takeoff</span>
            <Menu align="start" width={260} trigger={<button type="button" aria-label="Who does the takeoff" className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-white py-1 pl-1 pr-3 text-[0.8125rem] font-semibold text-ink hover:bg-wash"><Avatar who={team.takeoff} size={22} plain />{tk.name}</button>}>
              <MenuLabel>Who does the takeoff?</MenuLabel>
              {(people.length ? people : EST_PEOPLE).map((x) => <MenuItem key={x} icon={<Avatar who={x} size={20} plain />} checked={x === team.takeoff} hint={PEOPLE[x]?.roleLabel} onSelect={() => setTeam({ ...team, takeoff: x })}>{PEOPLE[x]?.name}</MenuItem>)}
            </Menu>
            <button type="button" onClick={() => setWho((v) => !v)} className="ml-auto text-[0.8125rem] font-semibold text-muted hover:text-ink">{who ? 'Done' : 'Who does the rest'}</button>
          </div>
          {who && <div className="border-t border-line-2 p-3"><TeamSlots team={team} onChange={(k, p) => setTeam({ ...team, [k]: p })} /></div>}
        </div>
      </div>
    </Modal>
  )
}
