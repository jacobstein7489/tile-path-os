/* Something needed on the job — thinset, grout, a blade, trim. Whoever's there asks for it in one window; it lands on
 * the list of whoever brings it and stays there until it's dropped off. "On my way" and "Dropped off" are one tap each,
 * and the one who asked hears both, with a pop-up and in the inbox. */
import * as React from 'react'
import { Truck, PackageCheck, Camera, X } from 'lucide-react'
import { useStore, newTask, addHist, meOf, NOW, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel } from '@/tileos/components/ui/overlay'
import { DatePresets } from '@/tileos/components/ui/overlay'
import { Mic } from '@/tileos/components/ui/mic'
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

/* ---------------- the window: what, by when, who brings it ---------------- */
const QUICK = ['Thinset', 'Grout', 'Spacers', 'Leveling clips', 'Trim / metal', 'Saw blade', 'Sponges', 'Caulk']
export function NeedModal({ jobId: j0, level }: { jobId?: string; level: number }) {
  const s = useStore()
  const projects = Object.values(s.jobs).filter((j) => !['request', 'estimating', 'proposal', 'followup', 'complete'].includes(j.stage))
  const [jobId, setJobId] = React.useState(j0 || '')
  const [what, setWhat] = React.useState('')
  const [when, setWhen] = React.useState('Today')
  const people = insidePeople(s)
  const [who, setWho] = React.useState<PersonKey>(() => { const m = matBy(s); return people.includes(m) || !people.length ? m : people[0] })
  const [note, setNote] = React.useState('')
  const [photo, setPhoto] = React.useState<File | null>(null)
  const pic = React.useRef<HTMLInputElement>(null)
  const ok = !!jobId && what.trim().length > 1
  const send = async () => {
    if (!ok) return
    if (photo) await keepFiles(jobId, [photo], 'photo', { quiet: true })
    askFor({ jobId, what: what.trim(), when, who, note: note.trim() || (photo ? 'Photo with the project' : undefined) })
  }
  const add = (q: string) => setWhat((w) => (w.trim() ? `${w.trim().replace(/,$/, '')}, ${q.toLowerCase()}` : q))
  return (
    <Modal level={level} size="md" onClose={s.close} title="Need something on site" sub="It goes on the list of whoever brings it, and stays there until it’s dropped off. You hear when it’s on the way."
      footer={<><Button variant="ghost" onClick={s.close}>Cancel</Button><Button className="ml-auto" variant="primary" icon={<Truck />} disabled={!ok} onClick={() => void send()}>Ask for it</Button></>}>
      {!j0 && (
        <div className="mb-4">
          <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">Which project</div>
          <div className="flex flex-wrap gap-1.5">
            {projects.map((j) => <button key={j.id} onClick={() => setJobId(j.id)} className={cn('inline-flex h-9 items-center rounded-full border px-3 text-[0.84375rem] font-semibold transition', jobId === j.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white text-ink-2 hover:border-[#cdc7bc]')}>{j.name}</button>)}
            {!projects.length && <span className="text-[0.84375rem] text-muted">No projects yet.</span>}
          </div>
        </div>
      )}
      <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">What do you need?</div>
      <div className="flex items-start gap-2">
        <textarea data-autofocus aria-label="What do you need" value={what} onChange={(e) => setWhat(e.target.value)} rows={2} placeholder="e.g. 3 bags of white thinset, a box of 1/8 spacers" className="min-h-[4.25rem] flex-1 resize-none rounded-xl border border-line px-3 py-2.5 text-[0.9375rem] outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100" />
        <Mic onText={(t) => setWhat((w) => (w.trim() ? `${w.trim()} ${t}` : t))} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">{QUICK.map((q) => <button key={q} onClick={() => add(q)} className="inline-flex h-8 items-center rounded-full border border-line bg-white px-3 text-[0.8125rem] font-medium text-ink-2 hover:border-brand-300 hover:text-brand-700">+ {q}</button>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-4 max-sm:grid-cols-1">
        <div>
          <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">By when</div>
          <DatePresets value={when} onPick={(d) => setWhen(d)} presets={['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri']} />
        </div>
        <div>
          <div className="mb-1.5 text-[0.8125rem] font-semibold text-ink-2">Who brings it</div>
          <Menu align="start" width={280} trigger={<button aria-label="Who brings it" className="inline-flex h-10 w-full items-center gap-2 rounded-xl border border-line bg-white pl-1.5 pr-3 text-left text-[0.875rem] font-semibold text-ink hover:border-[#cdc7bc]"><Avatar who={who} size={28} />{PEOPLE[who]?.name || 'Pick someone'}</button>}>
            <MenuLabel>Who brings it</MenuLabel>
            {(people.length ? people : [who]).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={who === p} hint={PEOPLE[p]?.roleLabel} onSelect={() => setWho(p)}>{PEOPLE[p]?.name}</MenuItem>)}
          </Menu>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for them (optional) — the color, the brand, where to leave it" className="h-10 flex-1" />
        <input ref={pic} type="file" accept="image/*" className="hidden" aria-label="A photo of what you need" onChange={(e) => { setPhoto(e.target.files?.[0] || null); e.target.value = '' }} />
        {photo
          ? <span className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 text-[0.8125rem] font-semibold text-brand-700">Photo<button aria-label="Take the photo off" onClick={() => setPhoto(null)}><X className="h-3.5 w-3.5" /></button></span>
          : <Button icon={<Camera />} onClick={() => pic.current?.click()}><span className="max-sm:hidden">Photo</span></Button>}
      </div>
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
/** every button at the end of a list row: the same size and look */
export const ROW_BTN = 'min-w-[6.75rem] justify-center'
