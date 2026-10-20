/* A project's touch-ups, as a list: one line per touch-up — where, what, who does it — with its photos and videos.
 * The crew marks each one done; the site manager (or anyone in the office) checks it. A touch-up that can't be done
 * yet says what it's waiting on ("the tile delivery"). The project shows them as one line on What's open.
 * And a note on a project: say it (or type it), add photos or videos — it goes into the project's Latest. */
import * as React from 'react'
import { Plus, Check, Camera, Play, MoreHorizontal, Hourglass, Trash2, UserRound, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { useStore, meOf, NOW, addHist } from '@/tileos/store'
import { Button, Avatar, TextArea, Field } from '@/tileos/components/ui/core'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { keepFiles, openFile } from '@/tileos/lib/files'
import { PEOPLE, CREWS, type PersonKey, type Job } from '@/tileos/data/model'
import type { FileRec } from '@/tileos/data/jobs'
import type { PunchItem } from '@/tileos/data/work'
import { setPunch } from './flows'
import { isOff } from './active'

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
export function TouchupsList({ job }: { job: Job }) {
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
      {!items.length && (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <div className="text-[1rem] font-semibold text-ink">{started ? `No touch-ups on ${job.name}` : 'Touch-ups come after the installing'}</div>
          <div className="mt-1 max-w-sm text-[0.875rem] text-muted">{started ? 'Type the whole list at once — one per line. Each one gets its own line here, with its photos and videos.' : 'Once the crew is on site, the list goes here: one line per touch-up, with photos, done and checked one by one.'}</div>
          {canAdd && <Button className="mt-4" variant={started ? 'primary' : undefined} icon={<Plus />} onClick={() => s.open({ t: 'punchnew', jobId })}>{started ? 'Add touch-ups' : 'Add touch-ups anyway'}</Button>}
        </div>
      )}
      {open.length > 0 && <Part label="To do" n={open.length}>{open.map((p) => <TouchupLine key={p.id} p={p} />)}</Part>}
      {check.length > 0 && <Part label="Fixed — to check" n={check.length}>{check.map((p) => <TouchupLine key={p.id} p={p} />)}</Part>}
      {done.length > 0 && (
        <div className="mt-4">
          <button onClick={() => setShowDone(!showDone)} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-muted hover:text-ink">
            {showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}{done.length} checked
          </button>
          {showDone && <div className="mt-2 overflow-hidden rounded-[0.75rem] border border-line">{done.map((p) => <TouchupLine key={p.id} p={p} />)}</div>}
        </div>
      )}
    </>
  )
}

export function TouchupsModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  const items = s.punch.filter((p) => p.jobId === jobId)
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
      <TouchupsList job={job} />
    </Modal>
  )
}
function Part({ label, n, children }: { label: string; n: number; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center gap-2 text-[0.75rem] font-semibold text-ink-2">{label}<span className="font-semibold text-muted">{n}</span></div>
      <div className="overflow-hidden rounded-[0.75rem] border border-line">{children}</div>
    </div>
  )
}

/** one touch-up: what and where, who does it, its photos and videos, what it's waiting on, and the one button */
function TouchupLine({ p }: { p: PunchItem }) {
  const s = useStore()
  const pick = React.useRef<HTMLInputElement>(null)
  const [waitOpen, setWaitOpen] = React.useState(false)
  const [wait, setWait] = React.useState('')
  const media = (p.media || []).map((id) => s.files.find((f) => f.id === id)).filter(Boolean) as FileRec[]
  const done = p.status === 'verified'
  const waiting = !!p.note && /^waiting/i.test(p.note)
  const set = (patch: Partial<PunchItem>, msg: string) => s.commit((st) => { const x = st.punch.find((y) => y.id === p.id); if (x) Object.assign(x, patch) }, msg)
  const crews = CREWS.filter((c) => !isOff(s, 'crew', c))
  const people: PersonKey[] = [...crews, ...(['yakov', 'ys'] as PersonKey[]).filter((k) => PEOPLE[k])]
  return (
    <div data-touchup={p.id} className="border-t border-line-2 px-4 py-3 first:border-t-0">
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full', done ? 'bg-ok-500 text-white' : p.status === 'verify' ? 'bg-brand-600 text-white' : 'border-[0.09375rem] border-[#cfc9be]')}>{(done || p.status === 'verify') && <Check className="h-3 w-3" strokeWidth={3} />}</span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[0.90625rem] font-semibold leading-snug', done ? 'text-muted line-through decoration-faint' : 'text-ink')}>{p.text}</span>
          <span className="block truncate text-[0.78125rem] text-muted">{[p.where !== 'To place' ? p.where : '', PEOPLE[p.owner]?.short].filter(Boolean).join(' · ')}</span>
          {p.note && <span className={cn('mt-0.5 inline-flex items-center gap-1 text-[0.78125rem] font-medium', waiting ? 'text-warn-700' : 'text-ink-2')}>{waiting && <Hourglass className="h-3.5 w-3.5" />}{p.note}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {(p.status === 'open' || p.status === 'working') && <Button size="sm" icon={<Check />} onClick={() => setPunch(p.id, 'verify')}>Done</Button>}
          {p.status === 'verify' && <Button size="sm" variant="primary" icon={<Check />} onClick={() => setPunch(p.id, 'verified')}>Checked</Button>}
          <Menu align="end" width={250} trigger={<button aria-label={`More for ${p.text}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
            {!done && <MenuItem icon={<Hourglass className="h-4 w-4" />} onSelect={() => setWaitOpen(true)}>{waiting ? 'Change what it’s waiting on' : 'It’s waiting on something'}</MenuItem>}
            {waiting && <MenuItem icon={<Check className="h-4 w-4" />} onSelect={() => set({ note: undefined }, 'Not waiting any more')}>Not waiting any more</MenuItem>}
            {!done && (
              <>
                <MenuSep />
                <MenuLabel>Who does it</MenuLabel>
                {people.map((k) => <MenuItem key={k} icon={<Avatar who={k} size={20} />} checked={p.owner === k} onSelect={() => set({ owner: k }, `${PEOPLE[k]?.short} has it`)}>{PEOPLE[k]?.name}</MenuItem>)}
              </>
            )}
            <MenuSep />
            {p.status !== 'open' && <MenuItem icon={<RotateCcw className="h-4 w-4" />} onSelect={() => setPunch(p.id, 'open')}>Not done after all</MenuItem>}
            <MenuItem icon={<Trash2 className="h-4 w-4" />} onSelect={() => s.commit((st) => { st.punch = st.punch.filter((y) => y.id !== p.id); addHist(st, p.jobId, { who: meOf(st.role), kind: 'field', title: `Touch-up taken off · ${p.text}` }) }, 'Touch-up taken off')}>Take it off the list</MenuItem>
          </Menu>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
        {media.map((f) => (
          <button key={f.id} onClick={() => void openFile(f)} aria-label={`Open ${f.name}`} className="relative h-14 w-14 overflow-hidden rounded-lg border border-line-2 bg-wash-2">
            {f.thumb ? <img src={f.thumb} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-ink text-white">{isVideo(f) ? <Play className="h-5 w-5" /> : <Camera className="h-5 w-5" />}</span>}
            {isVideo(f) && f.thumb && <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white"><Play className="h-5 w-5" /></span>}
          </button>
        ))}
        {!done && (
          <>
            <input ref={pick} type="file" accept="image/*,video/*" multiple className="hidden" aria-label={`Photos or videos of ${p.text}`} onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) void addMedia(p, l) }} />
            <button type="button" onClick={() => pick.current?.click()} className={cn('inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#d1cbc0] text-[0.78125rem] font-semibold text-muted transition hover:border-brand-300 hover:text-brand-700', media.length ? 'h-14 w-14 justify-center' : 'h-8 px-2.5')}>
              <Camera className="h-4 w-4" />{media.length ? '' : 'Photo or video'}
            </button>
          </>
        )}
      </div>
      {waitOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-8">
          <input autoFocus value={wait} onChange={(e) => setWait(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && wait.trim()) { set({ note: `Waiting on ${wait.trim().replace(/^waiting on /i, '')}` }, 'Waiting'); setWaitOpen(false); setWait('') } }} placeholder="What it’s waiting on — e.g. the tile delivery" className="h-9 min-w-[15rem] flex-1 rounded-[0.5625rem] border border-line bg-white px-3 text-[0.84375rem] text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50" />
          <Button size="sm" variant="primary" disabled={!wait.trim()} onClick={() => { set({ note: `Waiting on ${wait.trim().replace(/^waiting on /i, '')}` }, 'Waiting'); setWaitOpen(false); setWait('') }}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setWaitOpen(false)}>Cancel</Button>
        </div>
      )}
    </div>
  )
}

/* ================= a note on a project ================= */
export function NoteModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const [text, setText] = React.useState('')
  const [files, setFiles] = React.useState<File[]>([])
  const pick = React.useRef<HTMLInputElement>(null)
  if (!job) return null
  const save = () => {
    const t = text.trim()
    if (!t) return
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
      sub={job.name}
      footer={
        <>
          <input ref={pick} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; if (l.length) setFiles((x) => [...x, ...l]) }} />
          <Button icon={<Camera />} onClick={() => pick.current?.click()}>{files.length ? `${files.length} photo${files.length === 1 ? '' : 's'} or video${files.length === 1 ? '' : 's'}` : 'Photos or videos'}</Button>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!text.trim()} onClick={save}>Save the note</Button>
        </>
      }
    >
      <Field label="What happened, what was said, what to remember">
        <TextArea data-autofocus aria-label="The note" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Walked it with the GC — they want the lobby done before the units. Tap the mic to say it." />
      </Field>
    </Modal>
  )
}
