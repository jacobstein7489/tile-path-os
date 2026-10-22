/* Something needed on the job — thinset, grout, a blade, trim. Whoever's there asks for it in one window; it lands on
 * the list of whoever brings it and stays there until it's dropped off. "On my way" and "Dropped off" are one tap each,
 * and the one who asked hears both, with a pop-up and in the inbox. */
import * as React from 'react'
import { Truck, PackageCheck, X } from 'lucide-react'
import { useStore, newTask, addHist, meOf, NOW, type Store } from '@/tileos/store'
import { Button, TextInput, TextArea } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { FormHead, FormRow, ProjectField, WhoWhen, PhotoButton } from './formkit'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { isoFromLabel, labelFromIso, TODAY } from '@/tileos/lib/today'
import { matBy } from './flows'
import { insidePeople } from './steps-ui'
import { keepFiles } from '@/tileos/lib/files'
import type { Task } from '@/tileos/data/work'

const S = () => useStore.getState()
const me = () => meOf(S().role)
const ROLE_OF: Partial<Record<string, Role[]>> = { ys: ['owner', 'pm'], yakov: ['site'], office: ['office'], estimator: ['estimator'], takeoff: ['takeoff'], materials: ['materials'], accounting: ['accounting'] }
const rolesOf = (s: Pick<Store, 'team'>, p: PersonKey): Role[] => { const m = s.team.find((x) => x.key === p); return m ? [m.role] : ROLE_OF[p] || ['owner'] }

/** ask for something on site: it goes on the list of whoever brings it */
export function askFor(o: { jobId: string; what: string; when: string; who: PersonKey; note?: string; photo?: string }) {
  const s = S()
  const j = s.jobs[o.jobId]
  const by = me()
  const due = labelFromIso(isoFromLabel(o.when) || TODAY) || 'Today'
  s.commit((st) => {
    newTask(st, {
      jobId: o.jobId, title: `Bring to ${j?.name || 'the site'}: ${o.what}`, detail: [o.note, `${PEOPLE[by]?.name || 'Someone'} asked for it`].filter(Boolean).join(' · '),
      type: 'Materials', owner: o.who, for: rolesOf(st, o.who), by, followers: o.who === by ? [] : [by], state: 'now', due, tone: 'warn',
      req: { what: o.what, trip: 'asked' }, where: j?.address, log: [{ date: NOW, who: by, text: `Asked for ${o.what} — by ${due}` }],
    } as Partial<Task> & { jobId: string; title: string })
    if (o.who !== by) st.notices.unshift({ id: 'nr' + Date.now(), jobId: o.jobId, text: `${PEOPLE[by]?.short || 'Someone'} needs ${o.what} at ${j?.name || 'the site'} — by ${due}`, when: 'Just now', kind: 'material', unread: true, for: [o.who] })
    addHist(st, o.jobId, { who: by, kind: 'material', title: `Asked for ${o.what}`, detail: `${PEOPLE[o.who]?.short || 'Someone'} brings it · by ${due}` })
  }, o.who === by ? 'On your list' : `Asked — ${PEOPLE[o.who]?.short || 'they'} brings it`, { tone: o.who === by ? undefined : 'wait', sub: `${o.what} · by ${due}. It stays on the list until it’s dropped off.`, to: o.who === by ? undefined : [{ who: o.who, what: `Bring ${o.what}` }], close: true })
}
/** on the way: the one who asked hears it */
export function onTheWay(id: string) {
  const s = S()
  const t = s.tasks.find((x) => x.id === id)
  if (!t?.req) return
  const j = s.jobs[t.jobId]
  s.commit((st) => {
    const x = st.tasks.find((y) => y.id === id)!
    x.req = { ...x.req!, trip: 'onway', at: NOW }
    ;(x.log ||= []).push({ date: NOW, who: me(), text: 'On the way' })
    if (x.by && x.by !== me()) st.notices.unshift({ id: 'nw' + Date.now(), jobId: x.jobId, text: `On the way · ${x.req.what} to ${j?.name || 'the site'} — ${PEOPLE[me()]?.short || 'someone'}`, when: 'Just now', kind: 'material', unread: true, open: { t: 'task', id }, for: [x.by] })
  }, 'On the way', { sub: t.by && t.by !== me() ? `${PEOPLE[t.by]?.short} knows it’s coming.` : undefined, undo: false })
}

/* ---------------- the window: the same frame as every + New ----------------
 * Project (typed) · What do you need (each thing its own line — tap a common one and it's a line with how many, or type
 * it or say it) · Who brings it and by when (two dropdowns) · a note. A photo from the button at the bottom. */
const QUICK: [string, string, string][] = [['Thinset', 'bag', 'bags'], ['Grout', 'bag', 'bags'], ['Spacers', 'box', 'boxes'], ['Leveling clips', 'bag', 'bags'], ['Trim / metal', 'piece', 'pieces'], ['Saw blade', 'blade', 'blades'], ['Sponges', 'pack', 'packs'], ['Caulk', 'tube', 'tubes']]
type NeedLine = { id: string; text: string; qty?: number; unit?: [string, string] }
let lineN = 0
/** a line as said in the request: "2 bags thinset", or what was typed */
export const needWords = (l: NeedLine) => (l.qty && l.unit ? `${l.qty} ${l.qty === 1 ? l.unit[0] : l.unit[1]} ${l.text.toLowerCase()}` : l.text)
export function NeedModal({ jobId: j0, level }: { jobId?: string; level: number }) {
  const s = useStore()
  const [jobId, setJobId] = React.useState(j0 || '')
  const [lines, setLines] = React.useState<NeedLine[]>([])
  const [draft, setDraft] = React.useState('')
  const [when, setWhen] = React.useState('Today')
  const people = insidePeople(s)
  const [who, setWho] = React.useState<PersonKey>(() => { const m = matBy(s); return people.includes(m) || !people.length ? m : people[0] })
  const [note, setNote] = React.useState('')
  const [photos, setPhotos] = React.useState<File[]>([])
  const job = jobId ? s.jobs[jobId] : undefined
  const typed = (t: string) => { const x = t.trim(); if (x.length < 2) return; setLines((l) => [...l, { id: 'nl' + ++lineN, text: x }]); setDraft('') }
  const quick = ([name, one, many]: [string, string, string]) => setLines((l) => {
    const had = l.find((x) => x.text === name && x.unit)
    return had ? l.map((x) => (x === had ? { ...x, qty: (x.qty || 1) + 1 } : x)) : [...l, { id: 'nl' + ++lineN, text: name, qty: 1, unit: [one, many] }]
  })
  const all = [...lines, ...(draft.trim().length > 1 ? [{ id: 'draft', text: draft.trim() }] : [])]
  const ok = !!jobId && all.length > 0
  const send = async () => {
    if (!ok) return
    if (photos.length) await keepFiles(jobId, photos, 'photo', { quiet: true })
    askFor({ jobId, what: all.map(needWords).join(' · '), when, who, note: [note.trim(), photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'} with the project` : ''].filter(Boolean).join(' · ') || undefined })
  }
  return (
    <Modal level={level} size="md" onClose={s.close} title="Need something on site"
      header={<FormHead k="need" kicker={job && j0 ? job.name : undefined} />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={<><PhotoButton photos={photos} onAdd={(f) => setPhotos((p) => [...p, ...f])} /><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" icon={<Truck />} disabled={!ok} onClick={() => void send()}>Ask for it</Button></>}>
      {!j0 && <FormRow label="Project"><ProjectField value={jobId} onChange={setJobId} keep={(j) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage)} autoFocus /></FormRow>}
      <FormRow label="What do you need?">
        {lines.length > 0 && (
          <div className="mb-2 overflow-hidden rounded-[0.625rem] border border-line" data-need-lines>
            {lines.map((l) => (
              <div key={l.id} className="flex min-h-10 items-center gap-2 border-t border-line-2 px-3 py-1 first:border-t-0" data-need-line={l.text}>
                <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-ink">{l.text}</span>
                {l.unit && (
                  <span className="inline-flex h-8 items-center rounded-lg border border-line">
                    <button type="button" aria-label={`Fewer ${l.text}`} onClick={() => setLines((x) => x.map((y) => (y.id === l.id ? { ...y, qty: Math.max(1, (y.qty || 1) - 1) } : y)))} className="h-full w-8 text-[1rem] text-ink-2 hover:bg-wash">−</button>
                    <span className="min-w-[4.5rem] text-center text-[0.8125rem] font-semibold tnum text-ink">{l.qty} {l.qty === 1 ? l.unit[0] : l.unit[1]}</span>
                    <button type="button" aria-label={`More ${l.text}`} onClick={() => setLines((x) => x.map((y) => (y.id === l.id ? { ...y, qty: (y.qty || 1) + 1 } : y)))} className="h-full w-8 text-[1rem] text-ink-2 hover:bg-wash">+</button>
                  </span>
                )}
                <button type="button" aria-label={`Take ${l.text} off`} onClick={() => setLines((x) => x.filter((y) => y.id !== l.id))} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-bad-50 hover:text-bad-600"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <TextInput mic aria-label="What do you need" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); typed(draft) } }} placeholder={lines.length ? 'Something else? Type it or say it' : 'Type it or say it — e.g. 3 bags of white thinset'} className="h-10" />
          {draft.trim().length > 1 && <Button onClick={() => typed(draft)}>Add</Button>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK.map((q) => <button key={q[0]} type="button" onClick={() => quick(q)} className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3 text-[0.8125rem] font-medium text-ink-2 transition hover:border-brand-300 hover:text-brand-700">+ {q[0]}</button>)}
        </div>
      </FormRow>
      <FormRow label="Who brings it">
        <WhoWhen who={who} onWho={setWho} when={when} onWhen={setWhen} whoLabel="Who brings it" whenLabel="By when" people={people.length ? people : [who]} />
      </FormRow>
      <FormRow label="Note">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="The color, the brand, where to leave it (optional)" className="min-h-[3.75rem]" />
      </FormRow>
    </Modal>
  )
}

/** the two buttons on a request: On my way, Dropped off */
export function TripButtons({ t, size = 'sm', onDone }: { t: Task; size?: 'sm' | 'md'; onDone?: () => void }) {
  const s = useStore()
  /* in a list row: one button, the same size as every row's — the next thing to say (on my way, then dropped off) */
  if (size === 'sm') {
    return t.req?.trip !== 'onway'
      ? <Button size="sm" className={ROW_BTN} icon={<Truck />} onClick={(e) => { e.stopPropagation(); onTheWay(t.id) }}>On my way</Button>
      : <Button size="sm" className={ROW_BTN} icon={<PackageCheck />} onClick={(e) => { e.stopPropagation(); s.completeTask(t.id); onDone?.() }}>Dropped off</Button>
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      {t.req?.trip !== 'onway' && <Button variant="ghost" icon={<Truck />} onClick={(e) => { e.stopPropagation(); onTheWay(t.id) }}>On my way</Button>}
      <Button variant="primary" icon={<PackageCheck />} onClick={(e) => { e.stopPropagation(); s.completeTask(t.id); onDone?.() }}>Dropped off</Button>
    </span>
  )
}
/** every button at the end of a list row: one size and look — Done, Dropped off, Send update, Open it, all the same width
 *  (a long label is cut short rather than making its button wider) */
export const ROW_BTN = 'w-[11rem] shrink-0 justify-center overflow-hidden whitespace-nowrap'
