/* A project's touch-ups, as a list: one line per touch-up — where, what, who does it — with its photos and videos.
 * The crew marks each one done; the site manager (or anyone in the office) checks it. A touch-up that can't be done
 * yet says what it's waiting on ("the tile delivery"). The project shows them as one line on What's open.
 * And a note on a project: say it (or type it), add photos or videos — it goes into the project's Latest. */
import * as React from 'react'
import { Plus, Check, Camera, Play, MoreHorizontal, Hourglass, Trash2, RotateCcw, ChevronDown, ChevronRight, CalendarDays, Sparkles, History } from 'lucide-react'
import { useStore, meOf, NOW, addHist } from '@/tileos/store'
import { Button, Avatar, TextArea, Field } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop } from '@/tileos/components/ui/overlay'
import { BAND, BAND_LABEL, BandCount } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { keepFiles, showFile } from '@/tileos/lib/files'
import { PEOPLE, CREWS, type PersonKey, type Job } from '@/tileos/data/model'
import type { FileRec } from '@/tileos/data/jobs'
import type { PunchItem, Task } from '@/tileos/data/work'
import { setPunch, setPunchOwner, checkAllPunch } from './flows'
import { ListHead, WhoMenu, WhenPop, WIN_LIST_ROW, WIN_LIST_GRID, WIN_TICK, WIN_CELLS, WIN_MORE, WIN_UNDER, type WhoPick, type WhenPick } from './winhead'
import { isOff } from './active'
import { TOUCH_WORDS, sameWords, touchupsWords } from './todokinds'
import { touchNext } from './touchnext'
import { FormHead, FormRow, ProjectField, PhotoButton } from './formkit'
import { fieldPeople } from './steps-ui'
import { Whose } from './job/whatsleft'
import { isoFromLabel, labelFromIso, TODAY } from '@/tileos/lib/today'

const ORDER: Record<PunchItem['status'], number> = { open: 0, working: 0, verify: 1, verified: 2 }

/** add photos or videos to a touch-up (they're kept with the project, like every photo) */
async function addMedia(p: PunchItem, list: File[]) {
  const { recs } = await keepFiles(p.jobId, list, 'photo', { quiet: true })
  if (!recs.length) return
  useStore.getState().commit((st) => {
    const x = st.punch.find((y) => y.id === p.id)
    if (x) x.media = [...(x.media || []), ...recs.map((r) => r.id)]
  }, recs.length === 1 ? 'Added to the touch-up' : `${recs.length} added to the touch-up`)
}
const isVideo = (f?: FileRec) => !!f && (/^video\//.test(f.type) || /\.(mov|mp4|m4v|webm|3gp)$/i.test(f.name))

/** the list itself — to do, fixed-to-check, checked — the same on the project page and in its own window */
/** the list, edge to edge — each group a band, each touch-up a line (in a window, it fills the window's width) */
export function TouchupsList({ job, bare, win }: { job: Job; /** inside the project's To do: its own band says Touch-ups — no "To fix" band, no empty word */ bare?: boolean; /** in its own window: the window's lines */ win?: boolean }) {
  const s = useStore()
  const jobId = job.id
  const [showDone, setShowDone] = React.useState(false)
  const items = s.punch.filter((p) => p.jobId === jobId).sort((a, b) => ORDER[a.status] - ORDER[b.status])
  const open = items.filter((p) => p.status === 'open' || p.status === 'working')
  const check = items.filter((p) => p.status === 'verify')
  const done = items.filter((p) => p.status === 'verified')
  const canAdd = !['accounting', 'client'].includes(s.role)
  const started = ['installation', 'punch', 'closeout', 'complete'].includes(job.stage) || job.kind === 'repair'
  return (
    <>
      {!items.length && !bare && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <div className="text-[1rem] font-semibold text-ink">{started ? `No touch-ups on ${job.name}` : 'Touch-ups come after the installing'}</div>
          <div className="mt-1 max-w-sm text-[0.875rem] text-muted">{started ? 'Type the whole list at once. One per line. Each one gets its own line here, with its photos and videos.' : 'Once the crew is on site, the list goes here: one line per touch-up, with photos, done and checked one by one.'}</div>
          {canAdd && <Button className="mt-4" variant={started ? 'primary' : undefined} icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId })}>{started ? 'Add touch-ups' : 'Add touch-ups anyway'}</Button>}
        </div>
      )}
      {/* the project's To do: what's left, one list (the ones fixed and waiting to be checked last); checked ones aren't on it */}
      {bare && [...open, ...check].map((p) => <TouchupLine key={p.id} p={p} />)}
      {/* in a window with nothing fixed yet: just the lines, the same as a to-do's window (its top says "3 to fix") */}
      {!bare && open.length > 0 && (win && !check.length && !done.length ? open.map((p) => <TouchupLine key={p.id} p={p} win />) : <Part label="To fix" n={open.length} win={win}>{open.map((p) => <TouchupLine key={p.id} p={p} win={win} />)}</Part>)}
      {!bare && check.length > 0 && <Part label="Fixed · to check" n={check.length} win={win}>{check.map((p) => <TouchupLine key={p.id} p={p} win={win} />)}</Part>}
      {!bare && done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className={cn(BAND, 'group w-full text-left max-sm:px-4', win ? 'px-6' : 'px-5')}>
            <span className={BAND_LABEL}>Checked</span><BandCount n={done.length} />
            {showDone ? <ChevronDown className="h-3.5 w-3.5 text-white/[0.6]" /> : <ChevronRight className="h-3.5 w-3.5 text-white/[0.6]" />}
          </button>
          {showDone && done.map((p) => <TouchupLine key={p.id} p={p} win={win} />)}
        </div>
      )}
    </>
  )
}

/** a to-do about the touch-ups said in words ("check them when Leo is done"): not a line of its own on the lists — one
 *  line at the top of their window, ticked off there */
export function StrayLine({ t }: { t: Task }) {
  const s = useStore()
  const iso = isoFromLabel(t.due)
  const late = !!iso && iso < TODAY
  const when = !t.due ? '' : late ? `Was due ${labelFromIso(iso!)}` : iso === TODAY || /^today$/i.test(t.due) ? 'Today' : `Due ${t.due}`
  const whoName = t.owner ? (t.owner === meOf(s.role) ? 'You' : PEOPLE[t.owner]?.short || '') : ''
  /* the same line as the touch-ups under it: tick, words, who, its day (only the day goes red when it's late) */
  return (
    <div className={WIN_LIST_ROW} data-task-stray={t.id}>
      <div className={WIN_LIST_GRID}>
        <button type="button" onClick={() => s.completeTask(t.id)} aria-label={`Done: ${t.title}`} className={cn(WIN_TICK, 'border-[0.09375rem] border-[#cfc9be] text-transparent hover:border-ok-500 hover:text-ok-500')} data-task-stray-done><Check className="h-3 w-3" strokeWidth={3} /></button>
        <span className="min-w-0 break-words py-0.5 text-[0.9375rem] leading-snug text-ink">{t.title}</span>
        <div className={WIN_CELLS}>
          <span className="flex min-w-0 items-center justify-center max-sm:-ml-1.5 max-sm:gap-1">{t.owner && <span className="inline-flex h-8 w-8 items-center justify-center" title={whoName}><Avatar who={t.owner} size={22} /></span>}<span className="text-[0.8125rem] text-muted sm:hidden">{whoName}</span></span>
          <span className="flex min-w-0 items-center justify-end text-right text-[0.8125rem] max-sm:justify-start">{when && <span className="text-faint sm:hidden" aria-hidden>·&nbsp;</span>}<span className={cn('tnum', late ? 'font-medium text-bad-600' : 'text-muted')} data-stray-when>{when}</span></span>
        </div>
        <span className={WIN_MORE} />
      </div>
    </div>
  )
}
/** a project's touch-ups in their own window — the same window as every to-do (what it is and the project on top, how
 *  far along, whose turn and their day; the list; who logged them; and their next step as the main button). It opens
 *  when no single to-do carries them all (two lists logged, or a list brought in from before) */
export function TouchupsModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  const items = s.punch.filter((p) => p.jobId === jobId)
  /* the to-dos about them said in words: on top */
  const linked = new Set(items.map((p) => p.taskId).filter(Boolean) as string[])
  /* (a to-do with the same words as one of theirs is that one, written twice: not shown again) */
  const mains = s.tasks.filter((t) => linked.has(t.id))
  const strays = items.length ? s.tasks.filter((t) => t.jobId === jobId && t.state === 'now' && !linked.has(t.id) && TOUCH_WORDS.test(t.title) && !mains.some((m) => sameWords(m.title, t.title))) : []
  const me = meOf(s.role)
  const canAdd = !['accounting', 'client'].includes(s.role)
  const canStep = canAdd && s.role !== 'crew'
  const tn = touchNext(s, job)
  const people: PersonKey[] = Array.from(new Set([...CREWS.filter((c) => !isOff(s, 'crew', c)), ...fieldPeople(s, job)]))
  const open = items.filter((p) => p.status !== 'verified')
  const step = canStep && tn && tn.step !== 'add' ? tn : null
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Touch-ups"
      inlineClose
      header={<ListHead kind={{ icon: <Sparkles />, label: 'Touch-ups' }} place={job.name} onPlace={() => s.open({ t: 'job', id: job.id })} title={items.length ? touchupsWords(items) : 'No touch-ups yet'} who={tn?.who} me={me} when={tn?.when} whenTone={tn?.late ? 'late' : undefined} attrs={{ 'data-touchups-head': '' }} />}
      footer={
        <>
          {canAdd && <Button icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId, into: tn?.task?.id })} data-touchups-add><span className="max-sm:hidden">Add touch-ups</span><span className="sm:hidden">Add</span></Button>}
          <div className="ml-auto" aria-hidden />
          {/* their next step — pick who does them, book the return visit, or all checked in one tap */}
          {step?.step === 'who' ? (
            <WhoMenu pick={{ people, me, current: undefined, onPick: (k) => setPunchOwner(open.filter((p) => !p.owner).map((p) => p.id), k) }} trigger={<Button variant="primary" className="max-sm:flex-1" data-touch-step="who">{step.button}</Button>} />
          ) : step?.step === 'book' ? (
            <Button variant="primary" className="max-sm:flex-1" icon={<CalendarDays />} onClick={() => s.open({ t: 'assign', jobId, crew: step.crew, start: step.iso })} data-touch-step="book">{step.button}</Button>
          ) : step ? (
            <Button variant="primary" className="max-sm:flex-1" icon={<Check />} onClick={() => { checkAllPunch(open.map((p) => p.id)); s.close() }} data-touch-step={step.step}>{step.button}</Button>
          ) : (
            <Button variant="primary" className="max-sm:flex-1" onClick={s.close}>Done</Button>
          )}
        </>
      }
      bodyClass="px-6 pb-4 pt-0 max-sm:px-4"
    >
      {strays.length > 0 && <div className="-mx-6 border-b border-line-2 max-sm:-mx-4" data-task-strays>{strays.map((t) => <StrayLine key={t.id} t={t} />)}</div>}
      <div className="-mx-6 border-b border-line-2 max-sm:-mx-4" data-touchups-list><TouchupsList job={job} win /></div>
      {/* who logged them, and when — one quiet line, the same as on every to-do */}
      {tn?.by && tn.on && (
        <div className="mt-5 flex items-center gap-1.5 text-[0.8125rem] text-faint" data-touchups-record>
          <History className="h-3.5 w-3.5 shrink-0" /><span>Logged {tn.on} by {tn.by === me ? 'you' : PEOPLE[tn.by]?.short || tn.by}</span>
        </div>
      )}
    </Modal>
  )
}
function Part({ label, n, win, children }: { label: string; n: number; win?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn(BAND, 'max-sm:px-4', win ? 'px-6' : 'px-5')}><span className={BAND_LABEL}>{label}</span><BandCount n={n} /></div>
      {children}
    </div>
  )
}

/** a touch-up's day: its own, or what its note said ("Due Fri") — and whether it's gone by */
export function punchDue(p: PunchItem): { text: string; late: boolean } | null {
  const d = p.due || p.note?.match(/^Due (.+)$/)?.[1]
  if (!d) return null
  const iso = isoFromLabel(d)
  const late = !!iso && iso < TODAY && p.status !== 'verified'
  return { text: iso ? (late ? `Was due ${labelFromIso(iso)}` : labelFromIso(iso)) : d, late }
}
/** one touch-up, one line — the same as a to-do: its tick, what it is (whole, never cut — tap the words to change
 *  them), who does it (tap: the same Who as everywhere, "Not decided yet" too), its day (tap: move it) — then a camera
 *  and ··· (a photo, on hold, delete). Where it is and what it waits on, in gray under it; its photos in a small row.
 *  The tick: the crew ticks it done (the site manager checks it next); anyone else ticking it has checked it. Laid out
 *  by the room it has: wide (a project's To do) in columns; narrow (a window, a phone) who and when under the words */
export function TouchupLine({ p, win }: { p: PunchItem; /** in a window: one line on the window's own lines */ win?: boolean }) {
  const s = useStore()
  const pick = React.useRef<HTMLInputElement>(null)
  const [waitOpen, setWaitOpen] = React.useState(false)
  const [wait, setWait] = React.useState('')
  /* its words, changed right on the line */
  const [editing, setEditing] = React.useState(false)
  const [words, setWords] = React.useState(p.text)
  const media = (p.media || []).map((id) => s.files.find((f) => f.id === id)).filter(Boolean) as FileRec[]
  const done = p.status === 'verified'
  const toCheck = p.status === 'verify'
  const waiting = !!p.note && /^waiting/i.test(p.note)
  const set = (patch: Partial<PunchItem>, msg?: string) => s.commit((st) => { const x = st.punch.find((y) => y.id === p.id); if (x) Object.assign(x, patch) }, msg)
  const me = meOf(s.role)
  const crews = CREWS.filter((c) => !isOff(s, 'crew', c))
  const people: PersonKey[] = Array.from(new Set([...crews, ...fieldPeople(s, s.jobs[p.jobId])]))
  const due = punchDue(p)
  const where = p.where !== 'To place' ? p.where : ''
  const note = p.note && !/^Due /.test(p.note) ? <span className={cn('inline-flex min-w-0 items-center gap-1', waiting ? 'text-warn-700' : 'text-ink-2')}>{waiting && <Hourglass className="h-3.5 w-3.5 shrink-0" />}<span className="min-w-0">{p.note}</span></span> : null
  const canEdit = !['client', 'accounting'].includes(s.role)
  /* the crew says it's done; whoever checks (the site manager, the office) — checked, in one tap */
  const crew = s.role === 'crew'
  const canTick = canEdit && !done && !(toCheck && crew)
  const tick = () => { if (canTick) setPunch(p.id, crew && !toCheck ? 'verify' : 'verified') }
  const tickWord = crew && !toCheck ? 'Done' : 'Checked'
  /* its day — or, fixed: waiting to be checked; checked */
  const day = done ? { text: 'Checked', cls: 'font-medium text-[#2c8a5b]' } : toCheck ? { text: 'Fixed · to check', cls: 'font-medium text-brand-700' } : due ? { text: due.text, cls: due.late ? 'font-medium text-bad-600' : 'text-muted' } : null
  const saveWords = () => {
    const v = words.trim()
    setEditing(false)
    if (!v || v === p.text) { setWords(p.text); return }
    s.commit((st) => { const x = st.punch.find((y) => y.id === p.id); if (x) { x.text = v; addHist(st, p.jobId, { who: meOf(st.role), kind: 'field', title: `Touch-up changed · ${v}`, detail: `Was “${p.text}”` }) } }, 'Changed')
  }
  /* who does it and its day: tapped right there, the same as on every list */
  const open = canEdit && !done
  const whoPick: WhoPick = { people, me, current: p.owner, onPick: (k) => setPunchOwner(p.id, k), onNone: () => setPunchOwner(p.id, undefined), noneLabel: 'Not decided yet' }
  const whenPick: WhenPick = { value: p.due || due?.text, onPick: (d) => set({ due: d, note: p.note && /^Due /.test(p.note) ? undefined : p.note }, `Due ${d}`) }
  const whoView = (size = 20) => p.owner ? <Whose who={p.owner} size={size} /> : (
    <span className="flex min-w-0 items-center gap-2 text-[0.875rem] text-muted" data-whose="none"><span className="inline-flex shrink-0 rounded-full border border-dashed border-[#bdb6aa]" style={{ width: size, height: size }} aria-hidden />Not decided yet</span>
  )
  const who = (size?: number) => open ? <WhoMenu pick={whoPick} trigger={<button type="button" className={CELL} aria-label={`Who does it · ${p.text}`} data-touchup-who-pick>{whoView(size)}</button>} /> : whoView(size)
  const when = (cls?: string) => open && !toCheck
    ? <WhenPop pick={whenPick} trigger={<button type="button" className={cn(CELL, cls)} aria-label={`When · ${p.text}`} data-touchup-when-pick>{day ? <span className={cn('tnum', day.cls)}>{day.text}</span> : <CalendarDays className="h-3.5 w-3.5 text-faint" />}</button>} />
    : day ? <span className={cn('tnum', day.cls, cls)}>{day.text}</span> : null
  /* its tick — a bigger spot to tap than it looks */
  const tickBtn = (cls: string) => (
    <button type="button" disabled={!canTick} onClick={tick} aria-label={done ? `Checked · ${p.text}` : `${tickWord} · ${p.text}`} title={done ? 'Checked' : toCheck && crew ? 'Fixed · the site manager checks it' : tickWord}
      className={cn(cls, done ? 'bg-ok-500 text-white' : toCheck ? 'bg-brand-600 text-white enabled:hover:bg-ok-500' : 'border-[0.09375rem] border-[#cfc9be] enabled:hover:border-brand-500 enabled:hover:bg-brand-50')} data-touchup-tick>
      {(done || toCheck) && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  )
  const wordsEl = editing ? (
    <textarea autoFocus value={words} rows={Math.min(4, Math.max(1, Math.ceil(words.length / 60)))} onChange={(e) => setWords(e.target.value)} onBlur={saveWords}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveWords() } else if (e.key === 'Escape') { e.preventDefault(); setWords(p.text); setEditing(false) } }}
      aria-label="What the touch-up is" className="-my-1 w-full resize-none rounded-lg border border-brand-300 bg-white px-2 py-1 text-[0.9375rem] text-ink outline-none ring-[0.1875rem] ring-brand-50" data-touchup-words-edit data-editing />
  ) : open ? (
    /* tap the words: change them right there */
    <button type="button" onClick={() => { setWords(p.text); setEditing(true) }} title="Tap to change the words" className="-mx-1.5 min-w-0 cursor-text rounded-md px-1.5 py-0.5 text-left text-[0.9375rem] leading-snug text-ink transition hover:bg-wash-2" data-touchup-text>
      <span className="break-words">{p.text}</span>
    </button>
  ) : (
    <span className={cn('min-w-0 break-words text-[0.9375rem] leading-snug', done ? 'text-muted line-through decoration-faint' : 'text-ink')} data-touchup-text>{p.text}</span>
  )
  const fileIn = !done && <input ref={pick} type="file" accept="image/*,video/*" multiple className="hidden" aria-label={`Photos or videos of ${p.text}`} onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) void addMedia(p, l) }} />
  const moreMenu = (cls?: string) => (
    <Menu align="end" width={270} trigger={<button aria-label={`More for ${p.text}`} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink', cls)} data-touchup-more><MoreHorizontal className="h-4 w-4" /></button>}>
      {!done && <MenuItem icon={<Camera className="h-4 w-4" />} onSelect={() => pick.current?.click()} data-touchup-photo>Add a photo or video</MenuItem>}
      {!done && <MenuItem icon={<Hourglass className="h-4 w-4" />} onSelect={() => setWaitOpen(true)} data-touchup-hold>{waiting ? 'Change what it’s waiting on' : 'Put it on hold'}</MenuItem>}
      {waiting && <MenuItem icon={<Check className="h-4 w-4" />} onSelect={() => set({ note: undefined }, 'Not on hold any more')}>Not on hold any more</MenuItem>}
      {p.status !== 'open' && <MenuItem icon={<RotateCcw className="h-4 w-4" />} onSelect={() => setPunch(p.id, 'open')} data-touchup-reopen>Not done after all</MenuItem>}
      {canEdit && (
        <>
          <MenuSep />
          <MenuItem icon={<Trash2 className="h-4 w-4" />} onSelect={() => s.commit((st) => { st.punch = st.punch.filter((y) => y.id !== p.id); addHist(st, p.jobId, { who: meOf(st.role), kind: 'field', title: `Touch-up deleted · ${p.text}` }) }, 'Touch-up deleted')} data-touchup-delete>Delete</MenuItem>
        </>
      )}
    </Menu>
  )
  const mediaEl = (pad: string) => media.length > 0 && (
    <div className={cn('mt-2 flex flex-wrap items-center gap-1.5', pad)}>
      {media.map((f) => (
        <button key={f.id} onClick={() => void showFile(f, media, { cap: p.text, room: where || undefined })} aria-label={`Open ${f.name}`} data-touchup-media={f.id} className="relative h-11 w-11 overflow-hidden rounded-lg border border-line-2 bg-wash-2">
          {f.thumb ? <img src={f.thumb} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-ink text-white">{isVideo(f) ? <Play className="h-4 w-4" /> : <Camera className="h-4 w-4" />}</span>}
          {isVideo(f) && f.thumb && <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white"><Play className="h-4 w-4" /></span>}
        </button>
      ))}
    </div>
  )
  const waitEl = (pad: string) => waitOpen && (
    <div className={cn('mt-2 flex flex-wrap items-center gap-2', pad)}>
      <input autoFocus value={wait} onChange={(e) => setWait(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && wait.trim()) { set({ note: `Waiting on ${wait.trim().replace(/^waiting on /i, '')}` }, 'On hold'); setWaitOpen(false); setWait('') } }} placeholder="What it’s waiting on · e.g. the tile delivery" data-editing className="h-9 min-w-[15rem] flex-1 rounded-[0.5625rem] border border-line bg-white px-3 text-[0.84375rem] text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50" />
      <Button size="sm" variant="primary" disabled={!wait.trim()} onClick={() => { set({ note: `Waiting on ${wait.trim().replace(/^waiting on /i, '')}` }, 'On hold'); setWaitOpen(false); setWait('') }}>Save</Button>
      <Button size="sm" variant="ghost" onClick={() => setWaitOpen(false)}>Cancel</Button>
    </div>
  )

  /* in a window: one line on the window's own lines (the same as a to-do's list) — tick, words, who (their circle), its
     day, ···; where it is and what it waits on under the words */
  if (win) {
    const dot = p.owner ? <Avatar who={p.owner} size={22} /> : <span className="inline-flex h-[1.375rem] w-[1.375rem] rounded-full border border-dashed border-[#bdb6aa]" aria-hidden />
    const whoName = p.owner ? (p.owner === me ? 'You' : PEOPLE[p.owner]?.short || '') : 'Not decided yet'
    const whoBtn = open
      ? <WhoMenu pick={whoPick} trigger={<button type="button" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:bg-wash-2 max-sm:h-7 max-sm:w-7" aria-label={`Who does it · ${p.text}`} title={whoName} data-touchup-who-pick>{dot}</button>} />
      : <span className="inline-flex h-8 w-8 items-center justify-center max-sm:h-7 max-sm:w-7" title={whoName}>{dot}</span>
    return (
      <div data-touchup={p.id} data-touchup-status={p.status} data-touchup-owner={p.owner || 'none'} data-touchup-win className={WIN_LIST_ROW}>
        <div className={WIN_LIST_GRID}>
          {tickBtn(WIN_TICK)}
          {wordsEl}
          <div className={WIN_CELLS}>
            <span className="flex min-w-0 items-center justify-center max-sm:-ml-1.5 max-sm:gap-1" data-touchup-who>{whoBtn}<span className="text-[0.8125rem] text-muted sm:hidden">{whoName}</span></span>
            <span className="flex min-w-0 items-center justify-end text-right text-[0.8125rem] max-sm:justify-start" data-touchup-when>{day && <span className="text-faint sm:hidden" aria-hidden>·&nbsp;</span>}{when('-mr-2 justify-end max-sm:mr-0')}</span>
          </div>
          <span className={cn('flex justify-end', WIN_MORE)}>{fileIn}{moreMenu('max-sm:h-7')}</span>
        </div>
        {(where || note) && (
          <div className={cn('flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pb-1 text-[0.8125rem] text-muted', WIN_UNDER)} data-touchup-under>
            {where && <span className="min-w-0">{where}</span>}
            {where && note && <span>·</span>}{note}
          </div>
        )}
        {mediaEl(cn(WIN_UNDER, 'mb-1'))}
        {waitEl(WIN_UNDER)}
      </div>
    )
  }
  return (
    <div data-touchup={p.id} data-touchup-status={p.status} data-touchup-owner={p.owner || 'none'} className="@container border-t border-line-2 px-5 py-2.5 max-sm:px-4">
      <div className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 @3xl:grid-cols-[1.25rem_minmax(0,1fr)_9rem_7.5rem_auto]">
        {tickBtn('relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition before:absolute before:-inset-2.5')}
        {wordsEl}
        {/* who does it, and its day — the same as every to-do (narrow: under the words) */}
        <span className="min-w-0 @max-3xl:hidden" data-touchup-who>{who()}</span>
        <span className="flex min-w-0 justify-end text-right text-[0.875rem] @max-3xl:hidden" data-touchup-when>{when('-mr-2 justify-end')}</span>
        <span className="flex shrink-0 items-center gap-1">
          {fileIn}
          {!done && <button type="button" onClick={() => pick.current?.click()} aria-label={`Add a photo or video of ${p.text}`} title="Add a photo or video" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink @max-3xl:hidden"><Camera className="h-4 w-4" /></button>}
          {moreMenu()}
        </span>
      </div>
      {/* under it: narrow, who and when; where it is and what it waits on */}
      <div className={cn('mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-8 text-[0.8125rem] text-muted', !where && !note && '@3xl:hidden')} data-touchup-under>
        <span className="@3xl:hidden">{who(18)}</span>
        {day && <span className="inline-flex items-center gap-1.5 @3xl:hidden">· {when()}</span>}
        {where && <span className="min-w-0"><span className="@3xl:hidden">· </span>{where}</span>}
        {where && note && <span>·</span>}{note}
      </div>
      {mediaEl('pl-8')}
      {waitEl('pl-8')}
    </div>
  )
}
/** a cell's own button on a line: tap it to change it right there */
const CELL = '-mx-2 inline-flex max-w-[calc(100%+1rem)] min-w-0 items-center gap-1.5 rounded-md px-2 py-1 transition hover:bg-wash-2 focus-visible:bg-wash-2 focus-visible:outline-none'

/* ================= a note on a project — the same frame as every + New ================= */
export function NoteModal({ jobId: j0, level }: { jobId?: string; level: number }) {
  const s = useStore()
  const [jobId, setJobId] = React.useState(j0 || '')
  const job = jobId ? s.jobs[jobId] : undefined
  const [text, setText] = React.useState('')
  const [files, setFiles] = React.useState<File[]>([])
  const save = () => {
    const t = text.trim()
    if (!t || !job) return
    const me = meOf(s.role)
    const first = t.split('\n')[0]
    s.commit((st) => {
      st.notes[jobId] = [{ id: 'note' + Date.now().toString(36), who: me, date: NOW, text: t }, ...(st.notes[jobId] || [])]
      addHist(st, jobId, { who: me, kind: 'field', title: `Note · ${first.length > 90 ? first.slice(0, 88) + '…' : first}`, detail: [t.split('\n').slice(1).join(' ').trim(), files.length ? `${files.length} photo${files.length === 1 ? '' : 's'} or video${files.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || undefined })
    }, 'Note added', { sub: `It’s on ${job.name}’s Latest.` })
    if (files.length) void keepFiles(jobId, files, 'photo', { quiet: true })
    s.close()
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="A note"
      header={<FormHead k="note" kicker={j0 && job ? job.name : undefined} title="A note" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <PhotoButton photos={files} onAdd={(l) => setFiles((x) => [...x, ...l])} label="Photos or videos" />
          <div className="ml-auto" aria-hidden />
          <Button variant="primary" disabled={!text.trim() || !job} onClick={save}>Save the note</Button>
        </>
      }
    >
      {!j0 && <FormRow label="Project"><ProjectField value={jobId} onChange={setJobId} autoFocus /></FormRow>}
      <FormRow label="The note">
        <TextArea data-autofocus={j0 ? true : undefined} aria-label="The note" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened, what was said, what to remember. Tap the mic to say it" />
      </FormRow>
    </Modal>
  )
}
