/* Log a problem — something wrong on a project, in a few taps: the tile came broken or wrong, some of it is missing,
 * or the site isn't ready (no water, no power…). It lands on the project's "What's open" in red, on someone's desk with
 * a day, and stays there until it's sorted. It goes into the project's Latest too, with the photos. */
import * as React from 'react'
import { PackageX, Shuffle, PackageMinus, Droplets, TriangleAlert, Camera, Check, ChevronDown, CalendarDays } from 'lucide-react'
import { useStore, meOf, newTask, addHist, NOW, type Store } from '@/tileos/store'
import { Button, TextArea, Stepper } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { FormHead, FormRow, ProjectField, WhoWhen, PhotoButton } from './formkit'
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
const isTile = (k?: Kind) => k === 'broken' || k === 'wrong' || k === 'short'

/** whose desk a problem goes to: tile goes to whoever gets the tile from the store, the site to the site manager */
function deskFor(s: Store, k: Kind): PersonKey {
  const step = (key: string) => companySteps(s).find((d) => d.key === key)?.owner
  const own = (p?: string) => (p && p !== 'matBy' && PEOPLE[p] ? realOwner(s, p as PersonKey) : undefined)
  if (isTile(k)) return own(step('order')) || meOf(s.role)
  if (k === 'site') return own(step('heights')) || (s.team.find((m) => m.role === 'site' && m.status !== 'off')?.key as PersonKey | undefined) || meOf(s.role)
  return meOf(s.role)
}

export function ProblemModal({ jobId: j0, level }: { jobId?: string; level: number }) {
  const s = useStore()
  const [jobId, setJobId] = React.useState(j0 || '')
  const job = jobId ? s.jobs[jobId] : undefined
  const me = meOf(s.role)
  const tiles = tilesOf(jobId)
  const [kind, setKind] = React.useState<Kind | ''>('')
  const [tag, setTag] = React.useState(tiles.length === 1 ? tiles[0].tag : '')
  const [n, setN] = React.useState(1)
  const [what, setWhat] = React.useState(SITE[0])
  const [note, setNote] = React.useState('')
  const [owner, setOwner] = React.useState<PersonKey>(me)
  const [ownerPicked, setOwnerPicked] = React.useState(false)
  const [due, setDue] = React.useState('Tomorrow')
  const [photos, setPhotos] = React.useState<File[]>([])
  const people = insidePeople(s)
  const choose = (k: Kind) => { setKind(k); if (!ownerPicked) setOwner(deskFor(s, k)) }
  const tile = tiles.find((t) => t.tag === tag)
  const boxes = `${n} ${n === 1 ? 'box' : 'boxes'}`
  const title = !kind ? '' : kind === 'broken' ? `${tag}: ${boxes} came broken` : kind === 'wrong' ? `${tag}: ${boxes} came wrong` : kind === 'short' ? `${tag}: ${boxes} missing` : kind === 'site' ? `${what} — not ready yet` : (note.trim().split(/[.\n]/)[0] || '').slice(0, 80)
  const ok = !!job && !!kind && (!isTile(kind) || !!tag) && (kind !== 'other' || !!note.trim())
  const save = () => {
    if (!ok || !kind || !job) return
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
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Log a problem"
      header={<FormHead k="problem" kicker={j0 && job ? job.name : undefined} title="Log a problem" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <PhotoButton photos={photos} onAdd={(l) => setPhotos((p) => [...p, ...l])} label="Add photos" />
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={save}>Log it</Button>
        </>
      }
    >
      {!j0 && <FormRow label="Project"><ProjectField value={jobId} onChange={(id) => { setJobId(id); setTag('') }} keep={(j) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage)} autoFocus /></FormRow>}
      <FormRow label="What’s wrong?">
        <SearchSelect label="What’s wrong" value={kind} onChange={(k) => choose(k as Kind)} search={false} width={360} placeholder="Pick one" options={KINDS.map((x) => ({ key: x.k, label: x.label, hint: x.sub, lead: <span className="inline-flex h-7 w-7 items-center justify-center rounded-[0.5rem] bg-wash-2 text-ink-2"><x.icon className="h-4 w-4" /></span> }))} />
      </FormRow>
      {isTile(kind || undefined) && (
        <FormRow label="Which tile">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 max-sm:grid-cols-1">
            <SearchSelect label="Which tile" value={tag} onChange={setTag} placeholder={tiles.length ? 'Pick the tile' : 'No tiles on this project yet'} search={tiles.length > 8} width={340} options={tiles.map((t) => ({ key: t.tag, label: `${t.tag} · ${t.name}`, hint: [t.size, t.supplier].filter(Boolean).join(' · ') }))} />
            <Stepper value={n} onChange={setN} min={1} max={999} suffix={n === 1 ? 'box' : 'boxes'} />
          </div>
        </FormRow>
      )}
      {kind === 'site' && (
        <FormRow label="What isn’t ready">
          <SearchSelect label="What isn’t ready" value={what} onChange={setWhat} search={false} width={300} options={SITE.map((x) => ({ key: x, label: x }))} />
        </FormRow>
      )}
      <FormRow label={kind === 'other' ? 'What’s wrong' : 'What happened'}>
        <TextArea aria-label="What happened" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="min-h-[3.75rem]" placeholder={kind === 'site' ? 'e.g. The GC says the water is on Friday' : kind === 'other' ? 'Say it in a few words' : 'e.g. 3 boxes cracked in the corner — the driver saw it (optional)'} />
      </FormRow>
      <FormRow label="Who sorts it out">
        <WhoWhen who={owner} onWho={(p) => { setOwner(p); setOwnerPicked(true) }} when={due} onWhen={setDue} whoLabel="Whose desk" whenLabel="Sorted by" whenPrefix="Sorted by" people={people} />
      </FormRow>
    </Modal>
  )
}
