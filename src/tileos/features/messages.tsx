/* Messages — one thread per project instead of WhatsApp groups: our team, the crew and the GC, with photos.
 * Any message can become a task in one click. "Team only" stays inside; the GC's login never shows it. */
import * as React from 'react'
import { Send, Camera, Lock, ListPlus } from 'lucide-react'
import { useStore, addHist, newTask, NOW, meOf } from '@/tileos/store'
import { Avatar, Button } from '@/tileos/components/ui/core'
import { Modal, Tip } from '@/tileos/components/ui/overlay'
import { Swatch } from '@/tileos/components/ui/swatch'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, type PersonKey, type Role } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'
import type { Msg } from '@/tileos/data/messages'

const S = () => useStore.getState()
const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export function postMessage(jobId: string, text: string, o: { internal?: boolean; photos?: Msg['photos'] } = {}) {
  const me = meOf(S().role)
  S().commit((s) => {
    const list = (s.messages[jobId] ||= [])
    list.push({ id: 'm' + Date.now(), who: me, text, date: NOW, time: timeNow(), internal: o.internal, photos: o.photos })
  })
}
export function messageToTask(jobId: string, id: string) {
  const st0 = S()
  const m = st0.messages[jobId]?.find((x) => x.id === id)
  if (!m) return
  const me = meOf(st0.role)
  st0.commit(
    (s) => {
      const x = s.messages[jobId].find((y) => y.id === id)!
      x.became = 'task'
      newTask(s, { jobId, title: m.text.length > 70 ? m.text.slice(0, 68) + '…' : m.text, detail: `From ${PEOPLE[m.who].name} in the project messages, ${m.date} ${m.time}.`, type: 'Field', owner: me, for: [s.role], state: 'now', due: 'Today', tone: 'info', where: 'From a message' })
      addHist(s, jobId, { who: me, kind: 'question', title: 'A message became a task', detail: m.text })
    },
    'It’s a task now',
    { sub: 'On your Today, linked to the message.' },
  )
}
/** messages from someone else today — the dot on the project */
export const unreadOf = (s: { messages: Record<string, Msg[]>; role: Role }, jobId: string) => (s.messages[jobId] || []).filter((m) => m.date === NOW && m.who !== meOf(s.role)).length

export function Thread({ jobId, outside }: { jobId: string; outside?: boolean }) {
  const s = useStore()
  const me = meOf(s.role)
  const list = (s.messages[jobId] || []).filter((m) => !outside || !m.internal)
  const [text, setText] = React.useState('')
  const [internal, setInternal] = React.useState(false)
  const [photo, setPhoto] = React.useState(false)
  const end = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [list.length])
  const send = () => {
    if (!text.trim() && !photo) return
    postMessage(jobId, text.trim() || 'Photo', { internal: !outside && internal, photos: photo ? [{ sw: 'bianco', cap: 'Just now' }] : undefined })
    setText('')
    setPhoto(false)
  }
  let lastDate = ''
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-5 py-4 max-sm:px-3">
        {list.map((m) => {
          const mine = m.who === me
          const ext = m.who === 'gcpp'
          const day = m.date !== lastDate ? (lastDate = m.date) : ''
          return (
            <React.Fragment key={m.id}>
              {day && <div className="my-3 text-center text-[0.75rem] font-semibold text-faint">{day === NOW ? 'Today' : day}</div>}
              <div className={cn('group mb-3 flex items-end gap-2.5', mine && 'flex-row-reverse')}>
                {!mine && <Avatar who={m.who} size={30} />}
                <div className={cn('max-w-[72%] min-w-0', mine && 'items-end text-right')}>
                  {!mine && <div className="mb-0.5 text-[0.75rem] font-semibold text-muted">{PEOPLE[m.who]?.name}{ext ? ' · GC' : ''}{m.wa ? ' · via WhatsApp' : ''}</div>}
                  <div className={cn('inline-block rounded-2xl px-3.5 py-2 text-left text-[0.875rem] leading-snug', mine ? 'rounded-br-md bg-brand-600 text-white' : m.internal ? 'rounded-bl-md bg-warn-50 text-ink ring-1 ring-warn-100' : 'rounded-bl-md bg-wash-2 text-ink')}>
                    {m.internal && <div className={cn('mb-0.5 inline-flex items-center gap-1 text-[0.75rem] font-semibold', mine ? 'text-white/80' : 'text-warn-700')}><Lock className="h-3 w-3" />Team only</div>}
                    <div>{m.text}</div>
                    {m.photos && (
                      <div className="mt-2 flex gap-1.5">
                        {m.photos.map((p, i) => (
                          <button key={i} onClick={() => s.open({ t: 'media', items: m.photos!.map((x, k) => ({ id: m.id + k, kind: 'photo', sw: x.sw, cap: x.cap, who: m.who, day: m.date })), index: i })} className="overflow-hidden rounded-lg ring-1 ring-black/5">
                            <Swatch kind={p.sw} size={72} radius={8} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={cn('mt-0.5 flex items-center gap-2 text-[0.71875rem] text-faint', mine && 'justify-end')}>
                    {m.time}
                    {m.became && <span className="font-semibold text-ok-700">· became a task</span>}
                    {!outside && !m.became && (
                      <button onClick={() => messageToTask(jobId, m.id)} className="inline-flex items-center gap-1 font-semibold text-brand-600 opacity-0 transition hover:underline group-hover:opacity-100 max-sm:opacity-100"><ListPlus className="h-3 w-3" />Make it a task</button>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
        {!list.length && <div className="py-10 text-center text-[0.875rem] text-muted">No messages yet.</div>}
        <div ref={end} />
      </div>
      <div className="shrink-0 border-t border-line-2 px-4 py-3 max-sm:px-3">
        {photo && <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-wash px-2 py-1 text-[0.78125rem] text-ink-2"><Swatch kind="bianco" size={28} radius={6} />Photo attached</div>}
        <div className="flex items-end gap-2">
          <Tip label="Add a photo or video"><button onClick={() => setPhoto(!photo)} className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-muted hover:bg-wash', photo ? 'border-brand-300 text-brand-600' : 'border-line')}><Camera className="h-4 w-4" /></button></Tip>
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} rows={1} placeholder={outside ? 'Message the Cobblestone team' : internal ? 'Team only — the GC won’t see this' : 'Message everyone on the project'} className={cn('min-h-10 flex-1 resize-none rounded-xl border px-3 py-2 text-[0.875rem] focus:outline-none', internal ? 'border-warn-200 bg-warn-50/50 focus:border-warn-300' : 'border-line focus:border-brand-300')} />
          <Button variant="primary" icon={<Send />} onClick={send} aria-label="Send">Send</Button>
        </div>
        {!outside && (
          <div className="mt-2 flex items-center gap-2 text-[0.78125rem]">
            <button onClick={() => setInternal(false)} className={cn('rounded-full px-2.5 py-1 font-semibold', !internal ? 'bg-ink text-white' : 'text-muted hover:bg-wash')}>Everyone (with the GC)</button>
            <button onClick={() => setInternal(true)} className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold', internal ? 'bg-warn-500 text-white' : 'text-muted hover:bg-wash')}><Lock className="h-3 w-3" />Team only</button>
          </div>
        )}
      </div>
    </div>
  )
}

export function MessagesModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  if (!job) return null
  const c = CUSTOMERS[job.clientId]
  const team: PersonKey[] = Array.from(new Set([job.pm || 'ys', 'yakov', ...(job.crew ? [job.crew as PersonKey] : [])]))
  return (
    <Modal level={level} size="lg" tall onClose={s.close} title={`Messages · ${job.name}`} sub={`Our team, the crew and ${c?.name || job.client} — photos, questions, answers. WhatsApp messages land here too.`} bodyClass="p-0">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-line-2 px-5 py-2.5 max-sm:px-3">
          <span className="flex -space-x-1.5">{team.map((p) => <Avatar key={p} who={p} size={26} ring />)}<Avatar who="gcpp" size={26} ring /></span>
          <span className="truncate text-[0.78125rem] text-muted">{team.map((p) => PEOPLE[p].short).join(', ')} and {PEOPLE.gcpp.name}</span>
        </div>
        <div className="min-h-0 flex-1"><Thread jobId={jobId} /></div>
      </div>
    </Modal>
  )
}
