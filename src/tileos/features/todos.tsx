/* A project's to-dos, one person's — the window behind the one line on Today ("2052 West County · To-dos · 2 of 5
 * done"): each one with its tick (done, quietly — the last one says so), its day, and a tap to open it. Done today stays
 * on the list, ticked, so you see how far it got. One more is added right at the bottom. */
import * as React from 'react'
import { Check, ChevronRight, ListTodo, Plus } from 'lucide-react'
import { useStore, meOf, addHist, kindOfTask as histKind, NOW } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'
import { TODAY, isoFromLabel, labelFromIso } from '@/tileos/lib/today'
import { ListHead } from './winhead'
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
    ;(t.log ||= []).push({ date: NOW, who: me, text: 'Marked done' })
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
      header={<ListHead kind={{ icon: <ListTodo />, label: 'To-dos' }} place={job.name} onPlace={() => s.open({ t: 'job', id: job.id })} title={`${done.length} of ${all} done`} who={who} me={me} when="Today" attrs={{ 'data-todos-head': '' }} />}
      footer={<Button className="ml-auto" variant="primary" onClick={s.close}>Done</Button>}
    >
      <div className="-mx-6 -my-5 max-sm:-mx-4" data-todos={jobId}>
        {[...open, ...done].map((t) => {
          const d = dayOf(t)
          const isDone = t.state === 'done'
          return (
            <div key={t.id} className="flex items-center gap-3 border-b border-line-2 px-6 py-2.5 max-sm:px-4" data-todos-line={t.id} data-done={isDone ? '' : undefined}>
              {/* its tick — a bigger spot to tap than it looks */}
              <button type="button" disabled={isDone} onClick={() => tick(t.id, open.length === 1)} aria-label={`Done · ${t.title}`}
                className={cn('relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition before:absolute before:-inset-2.5', isDone ? 'bg-ok-500 text-white' : 'border-[0.09375rem] border-[#cfc9be] hover:border-brand-500 hover:bg-brand-50')} data-todos-tick>
                {isDone && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>
              {/* the words, whole — tap them: its own window */}
              <button type="button" onClick={() => s.open({ t: 'task', id: t.id })} className="flex min-w-0 flex-1 items-center gap-3 text-left" data-todos-open>
                <span className={cn('min-w-0 flex-1 break-words text-[0.9375rem] leading-snug', isDone ? 'text-muted line-through decoration-faint' : 'text-ink')}>{t.title}</span>
                <span className={cn('shrink-0 text-[0.8125rem] tnum', isDone ? 'font-medium text-[#2c8a5b]' : d.late ? 'font-medium text-bad-600' : 'text-muted')}>{isDone ? 'Done' : d.text}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
              </button>
            </div>
          )
        })}
        {/* one more, right here */}
        <div className="flex items-center gap-3 px-6 py-2.5 max-sm:px-4">
          <Plus className="h-4 w-4 shrink-0 text-brand-600" />
          <TextInput value={words} onChange={(e) => setWords(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder="Add a to-do" aria-label="Add a to-do" className="h-10 flex-1" data-todos-add />
          {words.trim() && <Button size="sm" variant="primary" onClick={add}>Add</Button>}
        </div>
      </div>
    </Modal>
  )
}
