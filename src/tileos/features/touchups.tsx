/* A project's touch-ups, as a list: one line per touch-up — where, what, who does it — with its photos and videos.
 * The crew marks each one done; the site manager (or anyone in the office) checks it. A touch-up that can't be done
 * yet says what it's waiting on ("the tile delivery"). The project shows them as one line on What's open.
 * And a note on a project: say it (or type it), add photos or videos — it goes into the project's Latest. */
import * as React from 'react'
import { Plus, Check, Camera, Play, MoreHorizontal, Hourglass, Trash2, RotateCcw, ChevronDown, ChevronRight, CalendarDays } from 'lucide-react'
import { useStore, meOf, NOW, addHist } from '@/tileos/store'
import { Button, Avatar, TextArea, Field } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop } from '@/tileos/components/ui/overlay'
import { BAND, BAND_LABEL, BandCount } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { keepFiles, openFile } from '@/tileos/lib/files'
import { PEOPLE, CREWS, type PersonKey, type Job } from '@/tileos/data/model'
import type { FileRec } from '@/tileos/data/jobs'
import type { PunchItem, Task } from '@/tileos/data/work'
import { setPunch, setPunchOwner } from './flows'
import { WhoMenu, WhenPop, type WhoPick, type WhenPick } from './winhead'
import { isOff } from './active'
import { TOUCH_WORDS, sameWords } from './todokinds'
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
export function TouchupsList({ job, bare }: { job: Job; /** inside the project's To do: its own band says Touch-ups — no "To fix" band, no empty word */ bare?: boolean }) {
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
      {!bare && open.length > 0 && <Part label="To fix" n={open.length}>{open.map((p) => <TouchupLine key={p.id} p={p} />)}</Part>}
      {!bare && check.length > 0 && <Part label="Fixed · to check" n={check.length}>{check.map((p) => <TouchupLine key={p.id} p={p} />)}</Part>}
      {!bare && done.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className={cn(BAND, 'group w-full px-5 text-left max-sm:px-4')}>
            <span className={cn(BAND_LABEL, 'group-hover:text-ink')}>Checked</span><BandCount n={done.length} />
            {showDone ? <ChevronDown className="h-3.5 w-3.5 text-faint" /> : <ChevronRight className="h-3.5 w-3.5 text-faint" />}
          </button>
          {showDone && done.map((p) => <TouchupLine key={p.id} p={p} />)}
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
  return (
    <div className="flex items-start gap-3 border-t border-line-2 px-5 py-3 first:border-t-0 max-sm:px-4" data-task-stray={t.id}>
      <button type="button" onClick={() => s.completeTask(t.id)} aria-label={`Done: ${t.title}`} className="mt-0.5 inline-flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#c9c2b7] text-transparent transition hover:border-ok-500 hover:text-ok-500" data-task-stray-done><Check className="h-3 w-3" strokeWidth={3} /></button>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[0.9375rem] leading-snug text-ink">{t.title}</span>
        {/* only the day goes red when it's late, not the whole line */}
        <span className="block text-[0.8125rem] leading-snug text-muted">To-do{t.owner ? ` · ${t.owner === meOf(s.role) ? 'You' : PEOPLE[t.owner]?.short || ''}` : ''}{when ? <> · <span className={cn(late && 'font-medium text-bad-600')} data-stray-when>{when}</span></> : null}</span>
      </span>
    </div>
  )
}
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
  const open = items.filter((p) => p.status === 'open' || p.status === 'working')
  const check = items.filter((p) => p.status === 'verify')
  const done = items.filter((p) => p.status === 'verified')
  const canAdd = !['accounting', 'client'].includes(s.role)
  return (
    <Modal
      level={level}
      size="lg"
      tall
      onClose={s.close}
      title="Touch-ups"
      sub={`${job.name} · ${[open.length ? `${open.length} to do` : '', check.length ? `${check.length} to check` : '', done.length ? `${done.length} checked` : ''].filter(Boolean).join(' · ') || 'none yet'}`}
      footer={
        <>
          {canAdd && <Button icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId })}>Add touch-ups</Button>}
          <Button className="ml-auto" variant="primary" onClick={s.close}>Done</Button>
        </>
      }
    >
      {strays.length > 0 && <div className="-mx-6 -mt-5 mb-5 border-b border-line-2 max-sm:-mx-4" data-task-strays>{strays.map((t) => <StrayLine key={t.id} t={t} />)}</div>}
      <div className={cn('-mx-6 -my-5 max-sm:-mx-4', strays.length > 0 && 'mt-0')}><TouchupsList job={job} /></div>
    </Modal>
  )
}
function Part({ label, n, children }: { label: string; n: number; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn(BAND, 'px-5 max-sm:px-4')}><span className={BAND_LABEL}>{label}</span><BandCount n={n} /></div>
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
export function TouchupLine({ p }: { p: PunchItem }) {
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
  return (
    <div data-touchup={p.id} data-touchup-status={p.status} data-touchup-owner={p.owner || 'none'} className="@container border-t border-line-2 px-5 py-2.5 max-sm:px-4">
      <div className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 @3xl:grid-cols-[1.25rem_minmax(0,1fr)_9rem_7.5rem_auto]">
        {/* its tick — a bigger spot to tap than it looks */}
        <button type="button" disabled={!canTick} onClick={tick} aria-label={done ? `Checked · ${p.text}` : `${tickWord} · ${p.text}`} title={done ? 'Checked' : toCheck && crew ? 'Fixed · the site manager checks it' : tickWord}
          className={cn('relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition before:absolute before:-inset-2.5', done ? 'bg-ok-500 text-white' : toCheck ? 'bg-brand-600 text-white enabled:hover:bg-ok-500' : 'border-[0.09375rem] border-[#cfc9be] enabled:hover:border-brand-500 enabled:hover:bg-brand-50')} data-touchup-tick>
          {(done || toCheck) && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        {editing ? (
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
        )}
        {/* who does it, and its day — the same as every to-do (narrow: under the words) */}
        <span className="min-w-0 @max-3xl:hidden" data-touchup-who>{who()}</span>
        <span className="flex min-w-0 justify-end text-right text-[0.875rem] @max-3xl:hidden" data-touchup-when>{when('-mr-2 justify-end')}</span>
        <span className="flex shrink-0 items-center gap-1">
          {!done && (
            <>
              <input ref={pick} type="file" accept="image/*,video/*" multiple className="hidden" aria-label={`Photos or videos of ${p.text}`} onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) void addMedia(p, l) }} />
              <button type="button" onClick={() => pick.current?.click()} aria-label={`Add a photo or video of ${p.text}`} title="Add a photo or video" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink @max-3xl:hidden"><Camera className="h-4 w-4" /></button>
            </>
          )}
          <Menu align="end" width={270} trigger={<button aria-label={`More for ${p.text}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink" data-touchup-more><MoreHorizontal className="h-4 w-4" /></button>}>
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
        </span>
      </div>
      {/* under it: narrow, who and when; where it is and what it waits on */}
      <div className={cn('mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-8 text-[0.8125rem] text-muted', !where && !note && '@3xl:hidden')} data-touchup-under>
        <span className="@3xl:hidden">{who(18)}</span>
        {day && <span className="inline-flex items-center gap-1.5 @3xl:hidden">· {when()}</span>}
        {where && <span className="min-w-0"><span className="@3xl:hidden">· </span>{where}</span>}
        {where && note && <span>·</span>}{note}
      </div>
      {media.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8">
          {media.map((f) => (
            <button key={f.id} onClick={() => void openFile(f)} aria-label={`Open ${f.name}`} className="relative h-11 w-11 overflow-hidden rounded-lg border border-line-2 bg-wash-2">
              {f.thumb ? <img src={f.thumb} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-ink text-white">{isVideo(f) ? <Play className="h-4 w-4" /> : <Camera className="h-4 w-4" />}</span>}
              {isVideo(f) && f.thumb && <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white"><Play className="h-4 w-4" /></span>}
            </button>
          ))}
        </div>
      )}
      {waitOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
          <input autoFocus value={wait} onChange={(e) => setWait(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && wait.trim()) { set({ note: `Waiting on ${wait.trim().replace(/^waiting on /i, '')}` }, 'On hold'); setWaitOpen(false); setWait('') } }} placeholder="What it’s waiting on · e.g. the tile delivery" data-editing className="h-9 min-w-[15rem] flex-1 rounded-[0.5625rem] border border-line bg-white px-3 text-[0.84375rem] text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50" />
          <Button size="sm" variant="primary" disabled={!wait.trim()} onClick={() => { set({ note: `Waiting on ${wait.trim().replace(/^waiting on /i, '')}` }, 'On hold'); setWaitOpen(false); setWait('') }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setWaitOpen(false)}>Cancel</Button>
        </div>
      )}
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
