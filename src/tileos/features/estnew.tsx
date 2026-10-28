/* Pricing a new project: the project and its plans — it goes straight to the takeoff person's Today; every step after
 * that hands it to the next person. (The area picker below is what the estimate window uses to add rooms.) */
import * as React from 'react'
import { Building2, Check, Plus, UserPlus, X, Users, ArrowRight, Upload, FileText } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Button, Avatar, TextInput, TextArea, Chip } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, Pop, DatePresets } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { FLOORS, uniqueArea, sortAreas, guessSurfaces, isOutside } from '@/tileos/data/areas'
import type { EstTeam } from '@/tileos/data/estimates'
import { TODAY, addDays, md, workday, dow, dayShort } from '@/tileos/lib/today'
import { companyTeam, companyAreas, companySurfaces, surfaceOf, newEstimate, projectLike, addCompanyArea, TEAM_KEYS, TEAM_LABEL, EST_PEOPLE } from './estflow'
import { isOff } from './active'
import { insidePeople } from './steps-ui'
import { FormHead, FormRow, ClientField } from './formkit'
import { SearchSelect } from '@/tileos/components/ui/select'

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
/** pick the floor, then the rooms on it from the list (type to find one — a new one is kept for next time), then
 *  tick each room's surfaces. The list below always reads in order: by floor, then the way the company's list reads. */
export function AreaBuilder({ areas, onChange }: { areas: PickedArea[]; onChange: (a: PickedArea[]) => void }) {
  const s = useStore()
  const presets = companyAreas(s)
  const [floor, setFloor] = React.useState('1st floor')
  const fl = floor || undefined
  const put = (list: PickedArea[]) => onChange(sortAreas(list, presets.map((p) => p.name)))
  const add = (name: string, surfaces: string[]) => put([...areas, { name: uniqueArea(name, areas.map((a) => a.name)), floor: isOutside(name) ? 'Outside' : fl, surfaces }])
  const set = (a0: PickedArea, p: Partial<PickedArea>) => put(areas.map((a) => (a === a0 ? { ...a, ...p } : a)))
  const groups = Array.from(new Set(areas.map((a) => a.floor || ''))).map((f) => ({ floor: f, list: areas.filter((a) => (a.floor || '') === f) }))
  return (
    <div>
      <div className="grid grid-cols-[11rem_minmax(0,22rem)] gap-2 max-sm:grid-cols-1" data-area-builder>
        <SearchSelect label="Floor" value={floor} onChange={setFloor} emptyLabel="No floor" options={FLOORS.map((f) => ({ key: f, label: f }))} search={false} width={220} plain />
        <SearchSelect
          label="Area"
          value=""
          onChange={(n) => { const p = presets.find((x) => x.name === n); if (p) add(p.name, [...p.surfaces]) }}
          placeholder="Pick or type an area…"
          options={presets.map((p) => ({ key: p.name, label: p.name, hint: `Comes with: ${p.surfaces.map((k) => surfaceOf(s, k).label.toLowerCase()).join(', ')}` }))}
          search
          searchPlaceholder="Type an area — Kitchen, Mikvah…"
          width={380}
          onCreate={(n) => { const keys = guessSurfaces(n, presets); addCompanyArea(n, keys); add(n, keys) }}
          createLabel={(t) => `Add “${t}” — kept for next time`}
        />
      </div>
      {areas.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-[0.75rem] border border-line">
          {groups.map((g) => (
            <div key={g.floor || 'none'}>
              <div className="border-b border-line-2 bg-[#f7f5f0] px-3 py-1.5 text-[0.71875rem] font-semibold text-muted">{g.floor || 'No floor'}</div>
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
        <div className="mt-4 rounded-[0.75rem] border border-dashed border-line px-4 py-5 text-center text-[0.84375rem] text-muted">Pick a floor, then an area from the list — each comes with its usual surfaces (a bathroom brings its niche, waterproofing, saddle and metals). Take off what it doesn’t have.</div>
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
  const [onJob, setOnJob] = React.useState<string | null>(null)
  const onJobOk = !!onJob
  const input = React.useRef<HTMLInputElement>(null)
  const ok = !!name.trim() && !!(client || cq.trim() || onJobOk)
  const me = meOf(s.role)
  const people = insidePeople(s)
  const addFiles = (l: File[]) => { const ok2 = l.filter((f) => /pdf|image/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic|dwg)$/i.test(f.name)); if (!ok2.length) return; setFiles((p) => [...p, ...ok2]); setDocs((d) => (d.includes('Plans') ? d : [...d, 'Plans'])) }
  const shownDocs = Array.from(new Set([...(files.length ? ['Plans'] : []), ...docs]))
  /* the same job twice? a project we already have with this name or street — price it there */
  const like = projectLike(s, name, address)
  const on = onJob ? s.jobs[onJob] : undefined
  const create = () => newEstimate({ name: on ? on.name : name.trim(), address: on ? on.address : address.trim(), clientId: on ? on.clientId : client?.id || 'new', client: on ? on.client : client?.name || cq.trim(), due, scope: scope.trim() || 'Scope to confirm from the plans', docs: shownDocs, team, areas, files, onJob: on?.id })
  const tk = PEOPLE[team.takeoff]
  /* the bid is due today unless you say otherwise — the next two weeks of work days */
  const dueOpts = Array.from({ length: 21 }, (_, i) => addDays(TODAY, i)).filter((d, i) => i === 0 || (dow(d) !== 0 && dow(d) !== 6)).slice(0, 11).map((d) => ({ key: md(d), label: `${d === TODAY ? 'Due today · ' : 'Due '}${dayShort(d)}` }))
  if (!dueOpts.some((o) => o.key === due)) dueOpts.unshift({ key: due, label: `Due ${due}` })
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title="Price a new project"
      header={<FormHead k="newreq" kicker="Start something new" right={<span className="hidden text-[0.8125rem] text-muted sm:inline">Upload the plans — {team.takeoff === me ? 'you do' : `${tk.short} does`} the takeoff</span>} />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <span className="inline-flex min-w-0 items-center gap-2 text-[0.8125rem] text-muted max-sm:hidden">
            <Avatar who={team.takeoff} size={22} plain />
            <span className="truncate">{team.takeoff === me ? 'Lands on your Today' : `Lands on ${tk.short}’s Today`}{files.length ? ` · ${files.length} file${files.length === 1 ? '' : 's'}` : ''}</span>
          </span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<ArrowRight />} disabled={!ok} onClick={create}>{team.takeoff === me ? 'Start the takeoff' : 'Send for the takeoff'}</Button>
        </>
      }
    >
      <FormRow label="Project">
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <TextInput data-autofocus aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name — e.g. Leeds Residence" className="h-10" />
          <TextInput aria-label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address — street, city" className="h-10" />
        </div>
        {(on || like) && (
          <div data-same-job className={cn('mt-2 flex flex-wrap items-center gap-3 rounded-[0.625rem] border px-3 py-2', on ? 'border-ok-200 bg-ok-50/60' : 'border-brand-100 bg-brand-50/50')}>
            <Building2 className={cn('h-4 w-4 shrink-0', on ? 'text-ok-600' : 'text-brand-600')} />
            <span className="min-w-0 flex-1 text-[0.8125rem] leading-snug text-ink">
              {on ? <>Priced on <b className="font-semibold">{on.name}</b> — the same job. It says {on.name} everywhere.</> : <><b className="font-semibold">{like!.name}</b> is a project already{like!.address ? ` (${like!.address})` : ''}. Is this estimate for it?</>}
            </span>
            {on ? <Button size="sm" variant="ghost" onClick={() => setOnJob(null)}>No — a new one</Button> : <Button size="sm" onClick={() => { setOnJob(like!.id); setName(like!.name); setAddress(like!.address) }}>Yes — price it on {like!.name}</Button>}
          </div>
        )}
      </FormRow>
      {!on && (
        <FormRow label="Client or GC">
          <ClientField value={client} onChange={(c) => { setClient(c); if (!c) setCq('') }} />
        </FormRow>
      )}
      <FormRow label="The plans" hint={['Plans', 'Spec book', 'Finish schedule'].some((d) => !shownDocs.includes(d)) ? 'Whatever’s missing, the office asks the GC for — it comes back with a date.' : undefined}>
        <input ref={input} type="file" multiple accept="application/pdf,image/*,.dwg" className="hidden" aria-label="Upload the plans" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; addFiles(l) }} />
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false) }}
          onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(Array.from(e.dataTransfer.files || [])) }}
          className={cn('flex items-center gap-3 rounded-[0.625rem] border-2 border-dashed px-3 py-2 transition', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d8d2c8] bg-[#faf8f5]')}
        >
          <Upload className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-ink-2"><b className="font-semibold text-ink">{files.length ? `${files.length} file${files.length === 1 ? '' : 's'} ready` : 'Drop the plans here'}</b> — PDFs or pictures</span>
          <Button size="sm" icon={<Upload />} onClick={() => input.current?.click()}>{files.length ? 'Add more' : 'Upload'}</Button>
        </div>
        {files.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-lg bg-wash px-3 py-1 text-[0.8125rem]">
                <FileText className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{f.name}</span>
                <span className="shrink-0 tnum text-muted">{f.size > 1_000_000 ? `${(f.size / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1000))} KB`}</span>
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((p) => p.filter((_, k) => k !== i))} className="inline-flex h-6 w-6 items-center justify-center rounded-md text-faint hover:bg-white hover:text-bad-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[0.78125rem] text-muted">What came in:</span>
          {['Plans', 'Spec book', 'Finish schedule', 'Photos'].map((d) => (
            <Chip key={d} on={shownDocs.includes(d)} onClick={() => { if (d === 'Plans' && files.length) return; setDocs((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d])) }} className="h-7 px-2.5 text-[0.78125rem]">{d}</Chip>
          ))}
        </div>
      </FormRow>
      <FormRow label="Anything to know">
        <TextArea aria-label="Anything else to know" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="Which floors, upgrades, who supplies the tile, deadlines" className="min-h-[2.75rem]" rows={1} />
      </FormRow>
      <FormRow label="Takeoff and bid">
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <Menu align="start" width={260} trigger={<button type="button" aria-label="Who does the takeoff" className="inline-flex h-10 min-w-0 items-center gap-2.5 rounded-[0.625rem] border border-line bg-white px-3 text-left text-[0.875rem] text-ink hover:border-[#d6cfc3]"><Avatar who={team.takeoff} size={22} plain /><span className="min-w-0 flex-1 truncate">{tk.name} <span className="text-muted">does the takeoff</span></span></button>}>
            <MenuLabel>Who does the takeoff?</MenuLabel>
            {(people.length ? people : EST_PEOPLE).map((x) => <MenuItem key={x} icon={<Avatar who={x} size={20} plain />} checked={x === team.takeoff} hint={PEOPLE[x]?.roleLabel} onSelect={() => setTeam({ ...team, takeoff: x })}>{PEOPLE[x]?.name}</MenuItem>)}
          </Menu>
          <SearchSelect label="Bid due" value={due} onChange={setDue} search={false} width={260} options={dueOpts} plain />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={() => setWho((v) => !v)} className="text-[0.8125rem] font-semibold text-brand-700 hover:underline">{who ? 'Done' : 'Who does the rest'}</button>
          <button type="button" onClick={() => setRooms((v) => !v)} className="text-[0.8125rem] font-semibold text-brand-700 hover:underline">{rooms ? 'Done with the rooms' : areas.length ? `Rooms · ${areas.length} — change` : 'Add rooms'}</button>
          {!rooms && !areas.length && <span className="text-[0.78125rem] text-muted">optional — {tk.short} puts them in from the plans</span>}
        </div>
        {who && <div className="mt-2 rounded-[0.625rem] border border-line-2 p-3"><TeamSlots team={team} onChange={(k, p) => setTeam({ ...team, [k]: p })} /></div>}
        {rooms && <div className="mt-2 rounded-[0.625rem] border border-line-2 p-3"><AreaBuilder areas={areas} onChange={setAreas} /></div>}
      </FormRow>
    </Modal>
  )
}
