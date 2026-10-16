/* Log a problem — something wrong on a project, in a few taps: the tile came broken or wrong, some of it is missing,
 * or the site isn't ready (no water, no power…). It lands on the project's "What's open" in red, on someone's desk with
 * a day, and stays there until it's sorted. It goes into the project's Latest too, with the photos. */
import * as React from 'react'
import { PackageX, Shuffle, PackageMinus, Droplets, TriangleAlert, Camera, Check, ChevronDown, CalendarDays } from 'lucide-react'
import { useStore, meOf, newTask, addHist, NOW, type Store } from '@/tileos/store'
import { Button, Avatar, TextArea, Stepper, Field } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { keepFiles } from '@/tileos/lib/files'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { tilesOf } from '@/tileos/data/jobs'
import { companySteps, realOwner } from './steps'
import { insidePeople } from './steps-ui'

type Kind = 'broken' | 'wrong' | 'short' | 'site' | 'other'
const KINDS: { k: Kind; label: string; sub: string; icon: React.ElementType }[] = [
  { k: 'broken', label: 'Tile came broken', sub: 'Cracked or chipped', icon: PackageX },
  { k: 'wrong', label: 'Tile came wrong', sub: 'Wrong color, size or finish', icon: Shuffle },
  { k: 'short', label: 'Tile is missing', sub: 'Not all of it came', icon: PackageMinus },
  { k: 'site', label: 'The site isn’t ready', sub: 'Water, power, plumbing, walls', icon: Droplets },
  { k: 'other', label: 'Something else', sub: 'Anything that holds the job up', icon: TriangleAlert },
]
const SITE = ['Water on site', 'Power on site', 'Plumbing', 'Walls or floors', 'Something else on site']
const WHEN = ['Today', 'Tomorrow', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Next Mon']
const isTile = (k?: Kind) => k === 'broken' || k === 'wrong' || k === 'short'

/** whose desk a problem goes to: tile goes to whoever gets the tile from the store, the site to the site manager */
function deskFor(s: Store, k: Kind): PersonKey {
  const step = (key: string) => companySteps(s).find((d) => d.key === key)?.owner
  const own = (p?: string) => (p && p !== 'matBy' && PEOPLE[p] ? realOwner(s, p as PersonKey) : undefined)
  if (isTile(k)) return own(step('order')) || meOf(s.role)
  if (k === 'site') return own(step('heights')) || (s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key as PersonKey | undefined) || meOf(s.role)
  return meOf(s.role)
}

export function ProblemModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const me = meOf(s.role)
  const tiles = tilesOf(jobId)
  const [kind, setKind] = React.useState<Kind | undefined>()
  const [tag, setTag] = React.useState(tiles.length === 1 ? tiles[0].tag : '')
  const [n, setN] = React.useState(1)
  const [what, setWhat] = React.useState(SITE[0])
  const [note, setNote] = React.useState('')
  const [owner, setOwner] = React.useState<PersonKey>(me)
  const [ownerPicked, setOwnerPicked] = React.useState(false)
  const [due, setDue] = React.useState('Tomorrow')
  const [photos, setPhotos] = React.useState<File[]>([])
  const pick = React.useRef<HTMLInputElement>(null)
  if (!job) return null
  const people = insidePeople(s)
  const choose = (k: Kind) => { setKind(k); if (!ownerPicked) setOwner(deskFor(s, k)) }
  const tile = tiles.find((t) => t.tag === tag)
  const boxes = `${n} ${n === 1 ? 'box' : 'boxes'}`
  const title = !kind ? '' : kind === 'broken' ? `${tag}: ${boxes} came broken` : kind === 'wrong' ? `${tag}: ${boxes} came wrong` : kind === 'short' ? `${tag}: ${boxes} missing` : kind === 'site' ? `${what} — not ready yet` : (note.trim().split(/[.\n]/)[0] || '').slice(0, 80)
  const ok = !!kind && (!isTile(kind) || !!tag) && (kind !== 'other' || !!note.trim())
  const save = () => {
    if (!ok || !kind) return
    const role = s.team.find((m) => m.key === owner)?.role as Role | undefined
    const where = isTile(kind) && tile ? `${tile.tag} · ${tile.name}` : kind === 'site' ? what : undefined
    const detail = note.trim() || (kind === 'broken' ? 'Get replacements from the store' : kind === 'wrong' ? 'Send it back — get the right tile' : kind === 'short' ? 'Find out when the rest comes' : kind === 'site' ? 'Find out when it will be ready' : undefined)
    s.commit((st) => {
      newTask(st, { jobId, title, detail, where, type: isTile(kind) ? 'Materials' : 'Field', owner, for: role ? [role] : [s.role], watch: owner === me ? [] : [s.role], state: 'now', due, tone: 'bad', log: [{ date: NOW, who: me, text: 'Logged as a problem' }] })
      addHist(st, jobId, { who: me, kind: isTile(kind) ? 'material' : 'question', title: `Problem: ${title}`, detail: [note.trim(), photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || undefined })
    }, 'Problem logged', { sub: `${owner === me ? 'On your desk' : `On ${PEOPLE[owner]?.short}’s desk`} — it stays red on ${job.name} until it’s sorted.` })
    if (photos.length) void keepFiles(jobId, photos, 'photo', { quiet: true })
    s.close()
  }
  const chip = 'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[#d9d3c9] bg-white pl-1.5 pr-2.5 text-[0.8125rem] font-medium text-ink-2 transition hover:border-[#c6bfb4] hover:text-ink data-[state=open]:border-brand-300 data-[state=open]:ring-[0.1875rem] data-[state=open]:ring-brand-50'
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Log a problem"
      sub={job.name}
      footer={
        <>
          <span className="truncate text-[0.8125rem] text-muted max-sm:hidden">{kind ? `Red on the project until it’s sorted · ${owner === me ? 'your desk' : `${PEOPLE[owner]?.short}’s desk`}` : 'Pick what’s wrong'}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={save}>Log it</Button>
        </>
      }
    >
      <div className="text-[0.8125rem] font-semibold text-ink-2">What’s wrong?</div>
      <div role="radiogroup" aria-label="What’s wrong" className="mt-2 overflow-hidden rounded-[0.75rem] border border-line">
        {KINDS.map((x) => (
          <button key={x.k} type="button" role="radio" aria-checked={kind === x.k} onClick={() => choose(x.k)} className={cn('flex w-full items-center gap-3 border-t border-line-2 px-3.5 py-2.5 text-left transition first:border-t-0', kind === x.k ? 'bg-brand-50/70' : 'hover:bg-wash')}>
            <span className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5625rem]', kind === x.k ? 'bg-brand-600 text-white' : 'bg-wash-2 text-ink-2')}><x.icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.875rem] font-semibold text-ink">{x.label}</span>
              <span className="block truncate text-[0.78125rem] text-muted">{x.sub}</span>
            </span>
            {kind === x.k && <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} />}
          </button>
        ))}
      </div>
      {kind && (
        <div className="mt-4 flex flex-col gap-3.5">
          {isTile(kind) && (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-sm:grid-cols-1">
              <Field label="Which tile">
                <SearchSelect label="Which tile" value={tag} onChange={setTag} placeholder={tiles.length ? 'Pick the tile' : 'No tiles on this project yet'} search={tiles.length > 8} width={340} options={tiles.map((t) => ({ key: t.tag, label: `${t.tag} · ${t.name}`, hint: [t.size, t.supplier].filter(Boolean).join(' · ') }))} />
              </Field>
              <Field label="How many boxes"><Stepper value={n} onChange={setN} min={1} max={999} /></Field>
            </div>
          )}
          {kind === 'site' && (
            <Field label="What isn’t ready">
              <SearchSelect label="What isn’t ready" value={what} onChange={setWhat} search={false} width={300} options={SITE.map((x) => ({ key: x, label: x }))} />
            </Field>
          )}
          <Field label={kind === 'other' ? 'What’s wrong' : 'What happened (optional)'}>
            <TextArea aria-label="What happened" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={kind === 'site' ? 'e.g. The GC says the water is on Friday' : kind === 'other' ? 'Say it in a few words' : 'e.g. 3 boxes cracked in the corner — the driver saw it'} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Menu align="start" width={260} trigger={<button type="button" aria-label="Whose desk" className={chip}><Avatar who={owner} size={20} /><span className="truncate">{owner === me ? 'Me' : PEOPLE[owner]?.short}</span><ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
              <MenuLabel>Whose desk — who sorts it out</MenuLabel>
              {people.map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={owner === p} onSelect={() => { setOwner(p); setOwnerPicked(true) }} hint={PEOPLE[p]?.roleLabel}>{p === me ? `${PEOPLE[p]?.name} (me)` : PEOPLE[p]?.name}</MenuItem>)}
            </Menu>
            <Menu align="start" width={200} trigger={<button type="button" aria-label="Sorted by" className={chip}><span className="inline-flex h-5 w-5 items-center justify-center text-muted"><CalendarDays className="h-4 w-4" /></span><span className="truncate">Sorted by {due.toLowerCase() === 'today' || due.toLowerCase() === 'tomorrow' ? due.toLowerCase() : due}</span><ChevronDown className="h-3.5 w-3.5 text-faint" /></button>}>
              <MenuLabel>Sorted by</MenuLabel>
              {WHEN.map((w) => <MenuItem key={w} checked={due === w} onSelect={() => setDue(w)}>{w}</MenuItem>)}
            </Menu>
            <input ref={pick} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) setPhotos((p) => [...p, ...l]) }} />
            <button type="button" onClick={() => pick.current?.click()} className={cn(chip, 'pl-2.5')}><Camera className="h-4 w-4 text-muted" />{photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Add photos'}</button>
          </div>
        </div>
      )}
    </Modal>
  )
}
