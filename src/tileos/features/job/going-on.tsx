/* What's going on on a project — every open thing, not one line — and the project's notes. */
import * as React from 'react'
import { Plus, Send, StickyNote } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Card, Button, Avatar, Dot, Count, TextArea } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type Job } from '@/tileos/data/model'
import { runTaskAction, addNote } from '../flows'

export function WhatsGoingOn({ job }: { job: Job }) {
  const s = useStore()
  const tasks = s.tasks.filter((t) => t.jobId === job.id && t.state !== 'done')
  const order = { now: 0, waiting: 1, later: 2, done: 3 }
  tasks.sort((a, b) => order[a.state] - order[b.state])
  const total = job.issues.length + tasks.length
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pb-3 pt-5 max-sm:px-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="h-tight text-[1.0625rem] font-semibold text-ink">What’s going on</h3>
            <Count tone={job.issues.some((i) => i.tone === 'bad') ? 'bad' : 'neutral'}>{total}</Count>
          </div>
          <p className="mt-0.5 text-[0.84375rem] text-muted">Everything open on this project, and who has it.</p>
        </div>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => s.open({ t: 'newtask', jobId: job.id })}>Add task</Button>
      </div>
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] border-t border-line-2 max-lg:grid-cols-1">
        <div className="min-w-0 border-r border-line-2 px-6 py-4 max-lg:border-b max-lg:border-r-0 max-sm:px-4">
          <div className="mb-2.5 text-[0.8125rem] font-semibold text-muted">Issues · {job.issues.length}</div>
          {job.issues.length ? (
            <div className="flex flex-col gap-2.5">
              {job.issues.map((i, k) => (
                <div key={k} className="flex items-start gap-2.5 text-[0.875rem] leading-snug">
                  <Dot tone={i.tone === 'info' ? 'neutral' : i.tone} className="mt-[0.375rem]" />
                  <span className={cn('min-w-0', i.tone === 'bad' ? 'font-medium text-bad-700' : 'text-ink-2')}>{i.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[0.875rem] text-muted">No issues open.</div>
          )}
        </div>
        <div className="min-w-0 py-2">
          <div className="px-6 pb-1 pt-2 text-[0.8125rem] font-semibold text-muted max-sm:px-4">Open tasks · {tasks.length}</div>
          {tasks.map((t) => (
            <div key={t.id} onClick={() => s.open({ t: 'task', id: t.id })} className="flex cursor-pointer items-center gap-3 px-6 py-2.5 hover:bg-wash max-sm:px-4">
              <Avatar who={t.owner} size={24} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.875rem] text-ink">{t.title}</div>
                <div className={cn('truncate text-[0.78125rem]', t.state === 'waiting' ? 'text-warn-700' : /late/i.test(t.due || '') ? 'font-semibold text-bad-700' : 'text-muted')}>
                  {PEOPLE[t.owner].name}
                  {t.state === 'waiting' ? ` · waiting on ${t.waitingOn}, back ${t.followUp}` : t.due ? ` · ${t.due}` : ''}
                </div>
              </div>
              {t.action && t.state === 'now' && (
                <Button
                  size="xs"
                  className="max-sm:hidden"
                  onClick={(e) => {
                    e.stopPropagation()
                    runTaskAction(t)
                  }}
                >
                  {t.action.label}
                </Button>
              )}
            </div>
          ))}
          {!tasks.length && <div className="px-6 py-2 text-[0.875rem] text-muted max-sm:px-4">No open tasks.</div>}
        </div>
      </div>
    </Card>
  )
}

export function NotesCard({ job }: { job: Job }) {
  const s = useStore()
  const notes = s.notes[job.id] || []
  const [text, setText] = React.useState('')
  const save = () => {
    if (!text.trim()) return
    addNote(job.id, text.trim())
    setText('')
  }
  return (
    <Card className="overflow-hidden">
      <div className="px-6 pb-3 pt-5 max-sm:px-4">
        <div className="flex items-center gap-2.5">
          <h3 className="h-tight text-[1.0625rem] font-semibold text-ink">Notes</h3>
          <Count>{notes.length}</Count>
        </div>
        <p className="mt-0.5 text-[0.84375rem] text-muted">Anything worth knowing about this project. Everyone on it can see them.</p>
      </div>
      <div className="flex items-start gap-3 border-t border-line-2 px-6 py-4 max-sm:px-4">
        <Avatar who={meOf(s.role)} size={30} />
        <div className="min-w-0 flex-1">
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a note…"
            className="min-h-[4.5rem]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" variant="primary" icon={<Send className="h-4 w-4" />} disabled={!text.trim()} onClick={save}>Add note</Button>
          </div>
        </div>
      </div>
      {notes.map((n) => (
        <div key={n.id} className="flex items-start gap-3 border-t border-line-2 px-6 py-3.5 max-sm:px-4">
          <Avatar who={n.who} size={30} />
          <div className="min-w-0 flex-1">
            <div className="text-[0.8125rem] text-muted">
              <span className="font-semibold text-ink-2">{PEOPLE[n.who].name}</span> · {n.date}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-[0.90625rem] leading-relaxed text-ink">{n.text}</p>
          </div>
        </div>
      ))}
      {!notes.length && (
        <div className="flex items-center gap-2 border-t border-line-2 px-6 py-4 text-[0.84375rem] text-muted max-sm:px-4">
          <StickyNote className="h-4 w-4" /> No notes yet.
        </div>
      )}
    </Card>
  )
}
