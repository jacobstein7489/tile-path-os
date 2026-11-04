/* Log a problem — something wrong on a project, in a few taps: the tile came broken or wrong, some of it is missing,
 * or the site isn't ready (no water, no power…). It lands on the project's "What's open" in red, on someone's desk with
 * a day, and stays there until it's sorted. It goes into the project's Latest too, with the photos. */
import * as React from 'react'
import { PackageX, Shuffle, PackageMinus, Droplets, TriangleAlert, Camera, Check, ChevronDown, CalendarDays } from 'lucide-react'
import { useStore, meOf, newTask, addHist, NOW, type Store } from '@/tileos/store'
import { Button, TextArea, Stepper } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { FormHead, FormRow, ProjectField, PhotoButton } from './formkit'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { useSmall } from '@/tileos/lib/phone'
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
  /* on a phone it goes one thing at a time, in big taps: the project, what's wrong, which tile and how many — each
     answer folds to one line (Change opens it again) — then a few words if you like, the photos, Log it */
  const small = useSmall()
  const [jobId, setJobId] = React.useState(j0 || '')
  const job = jobId ? s.jobs[jobId] : undefined
  const me = meOf(s.role)
  const tiles = tilesOf(jobId)
  const [kind, setKind] = React.useState<Kind | ''>('')
  const [tag, setTag] = React.useState(tiles.length === 1 ? tiles[0].tag : '')
  const [n, setN] = React.useState(1)
  const [what, setWhat] = React.useState(SITE[0])
  const [note, setNote] = React.useState('')
  /* it lands on your own list, for today — the admin hands it to someone else or moves the day from the task */
  const owner: PersonKey = me
  const due = 'Today'
  const [photos, setPhotos] = React.useState<File[]>([])
  const choose = (k: Kind | '') => setKind(k)
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
      newTask(st, { jobId, title, detail, where, type: isTile(kind) ? 'Materials' : 'Field', owner, for: role ? [role] : [s.role], watch: owner === me ? [] : [s.role], state: 'now', due, tone: 'bad', log: [{ date: NOW, who: me, text: 'Logged as a problem' }],
        /* tile broken, wrong or missing: one tap orders it — a PO to the store with that tile and those boxes, then their yes, then it coming in */
        ...(isTile(kind) && tag ? { action: { label: 'Order more tile', kind: `moretile:${tag}:${n}:boxes` } } : {}) })
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
      footer={small ? (
        <>
          <PhotoButton photos={photos} onAdd={(l) => setPhotos((p) => [...p, ...l])} label="Photos" big />
          <Button className="flex-1 max-md:h-12 max-md:text-[1rem]" variant="primary" disabled={!ok} onClick={save} data-problem-log>Log it</Button>
        </>
      ) : (
        <>
          <PhotoButton photos={photos} onAdd={(l) => setPhotos((p) => [...p, ...l])} label="Add photos" />
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={save} data-problem-log>Log it</Button>
        </>
      )}
    >
      {!j0 && <FormRow label={small && !jobId ? 'Which project?' : 'Project'}><ProjectField value={jobId} onChange={(id) => { setJobId(id); setTag('') }} keep={keepJob} autoFocus /></FormRow>}
      {/* on a phone the project comes first — the rest once it's picked */}
      {(!small || !!jobId) && (
        <>
          <FormRow label="What’s wrong?">
            {/* tap one — no list to open. Picked, only that one stays (Change brings the others back) */}
            <div className={cn('grid grid-cols-2 gap-2', small && !kind && 'gap-2.5')} data-problem-kinds>
              {KINDS.filter((x) => !kind || kind === x.k).map((x) => {
                const on = kind === x.k
                /* on a phone, before one is picked: big tiles, the icon on top — like + New */
                if (small && !on) return (
                  <button key={x.k} type="button" onClick={() => choose(x.k)} aria-pressed={false} data-problem-kind={x.k}
                    className="flex h-[6.5rem] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-white px-2 text-center shadow-[0_1px_2px_rgba(20,26,36,.05)] transition active:scale-[0.97] active:bg-wash">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.8125rem] bg-[#fdecea] text-[#c4311f]"><x.icon className="h-[1.375rem] w-[1.375rem]" /></span>
                    <span className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-ink">{x.label}</span>
                  </button>
                )
                return (
                  <button key={x.k} type="button" onClick={() => choose(on ? ('' as Kind) : x.k)} aria-pressed={on} data-problem-kind={x.k}
                    className={cn('flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition max-sm:min-h-14', on ? 'col-span-2 border-bad-300 bg-bad-50 ring-2 ring-bad-100' : 'border-line bg-white hover:border-[#d6cfc3]', x.k === 'other' && 'col-span-2')}>
                    <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem]', on ? 'bg-bad-600 text-white' : 'bg-wash-2 text-ink-2')}><x.icon className="h-[1.125rem] w-[1.125rem]" /></span>
                    <span className="min-w-0 flex-1 leading-tight"><span className="block text-[0.875rem] font-semibold text-ink max-sm:text-[0.9375rem]">{x.label}</span><span className="block truncate text-[0.75rem] text-muted max-sm:text-[0.8125rem]">{x.sub}</span></span>
                    {on && <span className="shrink-0 text-[0.8125rem] font-semibold text-brand-700 max-sm:text-[0.9375rem]" data-problem-change>Change</span>}
                  </button>
                )
              })}
            </div>
          </FormRow>
          {isTile(kind || undefined) && (small && tiles.length > 0 && tiles.length <= 8 ? (
            <>
              <FormRow label="Which tile">
                {/* each tile a big row to tap; picked, only it stays */}
                <div className="flex flex-col gap-2" data-problem-tiles>
                  {tiles.filter((t) => !tag || t.tag === tag).map((t) => {
                    const on = t.tag === tag
                    return (
                      <button key={t.tag} type="button" aria-pressed={on} onClick={() => setTag(on && tiles.length > 1 ? '' : t.tag)} data-problem-tile={t.tag}
                        className={cn('flex min-h-14 min-w-0 items-center gap-3 rounded-xl border px-3.5 py-2 text-left transition', on ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100' : 'border-line bg-white active:bg-wash')}>
                        <span className="shrink-0 text-[1rem] font-bold tnum text-ink">{t.tag}</span>
                        <span className="min-w-0 flex-1 leading-tight"><span className="block truncate text-[0.9375rem] text-ink-2">{t.name}</span>{t.size && <span className="block truncate text-[0.8125rem] text-muted">{t.size}</span>}</span>
                        {on && tiles.length > 1 && <span className="shrink-0 text-[0.9375rem] font-semibold text-brand-700">Change</span>}
                      </button>
                    )
                  })}
                </div>
              </FormRow>
              <FormRow label={kind === 'short' ? 'How many boxes are missing' : `How many boxes came ${kind}`}>
                <Stepper value={n} onChange={setN} min={1} max={999} suffix={n === 1 ? 'box' : 'boxes'} big />
              </FormRow>
            </>
          ) : (
            <FormRow label="Which tile">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 max-sm:grid-cols-1">
                <SearchSelect label="Which tile" value={tag} onChange={setTag} placeholder={tiles.length ? 'Pick the tile' : 'No tiles on this project yet'} search={tiles.length > 8} width={340} options={tiles.map((t) => ({ key: t.tag, label: `${t.tag} · ${t.name}`, hint: [t.size, t.supplier].filter(Boolean).join(' · ') }))} />
                <Stepper value={n} onChange={setN} min={1} max={999} suffix={n === 1 ? 'box' : 'boxes'} big={small} />
              </div>
            </FormRow>
          ))}
          {kind === 'site' && (
            <FormRow label="What isn’t ready">
              {small ? (
                <div className="grid grid-cols-2 gap-2" data-problem-site>
                  {SITE.map((x) => <button key={x} type="button" aria-pressed={what === x} onClick={() => setWhat(x)} className={cn('flex min-h-12 items-center justify-center rounded-xl border px-2 text-center text-[0.9375rem] font-semibold transition', what === x ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 active:bg-wash', x === SITE[SITE.length - 1] && 'col-span-2')}>{x}</button>)}
                </div>
              ) : <SearchSelect label="What isn’t ready" value={what} onChange={setWhat} search={false} width={300} options={SITE.map((x) => ({ key: x, label: x }))} />}
            </FormRow>
          )}
          {(!small || !!kind) && (
            <FormRow label={kind === 'other' ? 'What’s wrong' : small ? 'A few words (if you like)' : 'What happened'}>
              <TextArea aria-label="What happened" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="min-h-[3.75rem] max-sm:text-[1rem]" placeholder={kind === 'site' ? 'e.g. The GC says the water is on Friday' : kind === 'other' ? 'Say it in a few words' : small ? 'e.g. 3 boxes cracked in the corner' : 'e.g. 3 boxes cracked in the corner — the driver saw it (optional)'} />
            </FormRow>
          )}
        </>
      )}
    </Modal>
  )
}
const keepJob = (j: { stage: string }) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage)
