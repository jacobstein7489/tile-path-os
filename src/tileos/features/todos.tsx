/* A project's to-dos, one person's — the window behind the one line on Today ("2052 West County · To do · Wrap up ·
 * Take in tiles"): everything right here, no second page — its tick (done, quietly; the last one says so), its words
 * (tap them to change them), who (tap the circle: the same Who as everywhere), its day (tap it to move it), and ···
 * (delete it; its notes and history if you need them). Done today stays on the list, ticked, so you see how far it
 * got. One more is added right at the bottom. */
import * as React from 'react'
import { Check, ListTodo, Plus, MoreHorizontal, Trash2, History, CalendarDays } from 'lucide-react'
import { useStore, meOf, addHist, kindOfTask as histKind, NOW, clockNow } from '@/tileos/store'
import { Modal, Menu, MenuItem, MenuSep } from '@/tileos/components/ui/overlay'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'
import { TODAY, isoFromLabel, labelFromIso } from '@/tileos/lib/today'
import { ListHead, WhoMenu, WhenPop, WIN_LIST_ROW, WIN_LIST_GRID, WIN_TICK, WIN_CELLS, WIN_MORE } from './winhead'
import { removeTask, editTask } from './taskshare'
import { insidePeople } from './steps-ui'
import { lateBy } from './mytasks'
import { todosOf } from './todokinds'

/** done — quietly (the tick says it); the last one on the list: "All done" */
function tick(id: string, last: boolean) {
  const S = useStore.getState()
  S.commit((s) => {
    const t = s.tasks.find((x) => x.id === id)
    if (!t) return
    const me = meOf(s.role)
    t.state = 'done'
    t.doneAt = 'Just now'
    t.doneOn = TODAY
    ;(t.log ||= []).push({ date: NOW, time: clockNow(), who: me, text: 'Marked done' })
    if (t.jobId) addHist(s, t.jobId, { who: me, kind: histKind(t.type), title: `Done · ${t.title}` })
    /* whoever gave it or watches it hears it's done */
    const hear = Array.from(new Set([t.by, t.owner, ...(t.also || []), ...(t.followers || [])].filter((p): p is PersonKey => !!p && p !== me)))
    if (hear.length) s.notices.unshift({ id: 'nt' + Date.now(), jobId: t.jobId, text: `Done · ${t.title} · ${PEOPLE[me]?.short || 'someone'}`, when: 'Just now', kind: 'field', unread: true, open: { t: 'task', id: t.id }, for: hear })
  }, last ? 'All done!' : undefined, last ? { tone: 'done' } : undefined)
}

/** its day, in words: "Today", "Fri", "3 days late" */
const dayOf = (t: Task): { text: string; late: boolean } => {
  const iso = isoFromLabel(t.due)
  if (!iso) return { text: t.due || '', late: false }
  return iso < TODAY ? { text: lateBy(iso), late: true } : { text: labelFromIso(iso), late: false }
}

export function TodosModal({ jobId, who, level }: { jobId: string; who: PersonKey; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const { open, done } = todosOf(s, jobId, who)
  const [words, setWords] = React.useState('')
  const me = meOf(s.role)
  const add = () => {
    const v = words.trim()
    if (!v) return
    const role = (s.team.find((m) => m.key === who)?.role || s.role) as any
    s.addTask({ jobId, title: v, type: 'Setup', owner: who, for: [role], due: 'Today', state: 'now', tone: 'info' })
    setWords('')
  }
  if (!job) return null
  const all = open.length + done.length
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="To-dos"
      inlineClose
      header={<ListHead kind={{ icon: <ListTodo />, label: 'To-dos' }} place={job.name} onPlace={() => s.open({ t: 'job', id: job.id })} title={open.length ? `${open.length} left${done.length ? ` · ${done.length} done` : ''}` : `All ${all} done`} who={who} me={me} when="Today" attrs={{ 'data-todos-head': '' }} />}
      footer={<Button className="ml-auto" variant="primary" onClick={s.close}>Done</Button>}
    >
      <div className="-mx-6 -my-5 max-sm:-mx-4" data-todos={jobId}>
        {[...open, ...done].map((t) => <TodoLine key={t.id} t={t} last={open.length === 1} />)}
        {/* one more, right here — on the same line as the words above it */}
        <div className={cn(WIN_LIST_ROW, 'py-1.5')}>
          <div className="grid min-h-9 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2.5">
            <Plus className="h-4 w-4 justify-self-center text-brand-600" aria-hidden />
            <input value={words} onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="Add a to-do" aria-label="Add a to-do"
              className="h-9 min-w-0 rounded-md bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-faint" data-todos-add />
            {words.trim() ? <Button size="sm" variant="primary" onClick={add}>Add</Button> : <span />}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** one to-do in the window: tick · its words (tap: change them) · who (tap the circle) · its day (tap: move it) · ··· */
function TodoLine({ t, last }: { t: Task; last: boolean }) {
  const s = useStore()
  const me = meOf(s.role)
  const d = dayOf(t)
  const isDone = t.state === 'done'
  const [editing, setEditing] = React.useState(false)
  const [words, setWords] = React.useState(t.title)
  const save = () => { const v = words.trim(); setEditing(false); if (v && v !== t.title) editTask(t.id, { title: v }); else setWords(t.title) }
  const people = insidePeople(s)
  /* who — the same Who as everywhere; its day — tap it to move it */
  const whoBtn = (
    <WhoMenu pick={{ people, me, current: t.owner, onPick: (p) => s.reassignTask(t.id, p) }}
      trigger={<button type="button" aria-label={`Who does it · ${t.title}`} title={PEOPLE[t.owner]?.name} className="inline-flex h-8 w-8 shrink-0 items-center justify-center justify-self-center rounded-full transition hover:bg-wash-2 max-sm:h-7 max-sm:w-7" data-todos-who><Avatar who={t.owner} size={22} /></button>} />
  )
  const whenBtn = (cls?: string) => (
    <WhenPop pick={{ value: t.due, onPick: (v) => s.setTaskDue(t.id, v) }}
      trigger={<button type="button" aria-label={`When · ${t.title}`} className={cn('inline-flex h-8 shrink-0 items-center rounded-md px-2 text-[0.8125rem] tnum transition hover:bg-wash-2 max-sm:h-7', d.late ? 'font-medium text-bad-600' : 'text-muted', cls)} data-todos-when>{d.text || <CalendarDays className="h-3.5 w-3.5 text-faint" />}</button>} />
  )
  return (
    <div className={WIN_LIST_ROW} data-todos-line={t.id} data-done={isDone ? '' : undefined}>
    <div className={WIN_LIST_GRID}>
      {/* its tick — a bigger spot to tap than it looks */}
      <button type="button" disabled={isDone} onClick={() => tick(t.id, last)} aria-label={`Done · ${t.title}`}
        className={cn(WIN_TICK, isDone ? 'bg-ok-500 text-white' : 'border-[0.09375rem] border-[#cfc9be] hover:border-brand-500 hover:bg-brand-50')} data-todos-tick>
        {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      {/* its words, whole — tap them to change them right here */}
      {editing ? (
        <textarea autoFocus value={words} rows={Math.min(4, Math.max(1, Math.ceil(words.length / 55)))} onChange={(e) => setWords(e.target.value)} onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setWords(t.title); setEditing(false) } }}
          aria-label="What the to-do is" className="-my-1 w-full min-w-0 resize-none rounded-lg border border-brand-300 bg-white px-2 py-1 text-[0.9375rem] text-ink outline-none ring-[0.1875rem] ring-brand-50" data-todos-words-edit data-editing />
      ) : (
        <button type="button" disabled={isDone} onClick={() => { setWords(t.title); setEditing(true) }} title={isDone ? undefined : 'Tap to change the words'}
          className={cn('-mx-1.5 min-w-0 rounded-md px-1.5 py-1 text-left text-[0.9375rem] leading-snug transition enabled:cursor-text enabled:hover:bg-wash-2', isDone ? 'text-muted line-through decoration-faint' : 'text-ink')} data-todos-words>
          <span className="break-words">{t.title}</span>
        </button>
      )}
      {/* who, and its day — each in its own column, straight down every line (a phone: under the words) */}
      <div className={WIN_CELLS}>
        {isDone ? <span /> : <span className="flex min-w-0 items-center justify-center max-sm:-ml-1.5 max-sm:gap-1" data-todos-who-cell>{whoBtn}<span className="text-[0.8125rem] text-muted sm:hidden">{PEOPLE[t.owner]?.short}</span></span>}
        {isDone
          ? <span className="text-right text-[0.8125rem] font-medium text-[#2c8a5b]">Done</span>
          : <span className="flex min-w-0 items-center justify-end max-sm:justify-start" data-todos-when-cell><span className="text-[0.8125rem] text-faint sm:hidden" aria-hidden>·</span>{whenBtn('-mr-2 max-sm:mr-0')}</span>}
      </div>
      <Menu align="end" width={240} trigger={<button type="button" aria-label={`More for ${t.title}`} className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center justify-self-end rounded-lg text-faint transition hover:bg-wash-2 hover:text-ink max-sm:h-7', WIN_MORE)} data-todos-more><MoreHorizontal className="h-4 w-4" /></button>}>
        <MenuItem icon={<History className="h-4 w-4" />} onSelect={() => s.open({ t: 'task', id: t.id })} data-todos-open>Notes and history</MenuItem>
        <MenuSep />
        <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => removeTask(t.id)} data-todos-delete>Delete</MenuItem>
      </Menu>
    </div>
    </div>
  )
}
