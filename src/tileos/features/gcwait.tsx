/* Waiting on the GC — what the GC owes us (a drain, a fix, an answer), followed until it's done.
 *
 * One item, on one person's list (the site manager, usually): what it is, the day it has to be done by (the day our
 * crew starts), and the day of the next message to the GC. The GC hears about it the same day it's seen — "Tell the
 * GC" is on its person's Today right away, the message already written: what it is and the day we start. Send in
 * WhatsApp opens WhatsApp with it, ready; pick the GC's group and send. Then a reminder every three work days, every
 * day in the last week, each one written too.
 *
 * What the GC says goes in with one paste: a day ("plumber Thursday") and it's checked again that day; done is done
 * — with a photo of it done. Someone waiting for the answer (an installer asked for the lockbox code) gets it written
 * as well, one tap to send it on. The GC never hears who asked — it's "our crew".
 *
 * The admin doesn't chase anyone: every one of them is on his Today under Waiting on the GC — what the GC said, the
 * days left. Red only when something's wrong: the GC wasn't told the same day, a reminder was skipped, the GC missed
 * the day he gave, or it's a week before we start and it's still not done. */
import * as React from 'react'
import { Hourglass, Check, Copy, Send, ChevronLeft } from 'lucide-react'
import { useStore, meOf, NOW, addHist, type Store } from '@/tileos/store'
import { Button, Chip, TextArea } from '@/tileos/components/ui/core'
import { DatePresets } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { toast } from '@/tileos/lib/pop'
import { keepFiles } from '@/tileos/lib/files'
import { PEOPLE, type Job, type PersonKey } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'
import { TODAY, addDays, daysBetween, dayShort, dow, isoFromLabel, labelFromIso, md, workday } from '@/tileos/lib/today'
import { PhotoButton } from './formkit'

/* ---------------- what it is ---------------- */
export const isGc = (t: Pick<Task, 'waitingOn'>) => /^(the )?gc$/i.test((t.waitingOn || '').trim())
/** open and waiting on the GC */
export const isGcWait = (t: Task) => t.state === 'waiting' && isGc(t)
/** a question for him (the lockbox code) — not something he has to do */
export const isQuestion = (t: Task) => /\?\s*$/.test(t.title) || !!t.forWho
/** the GC has heard about it: told or reminded from here, followed up, or it waits on him because of something we
 *  sent (a change order, a request — the app made it, or someone set it waiting). Only what's just been said ("Say
 *  it", for the GC) hasn't been told yet */
const TOLD = /^(Requested|Asked|Told|Reminded the GC|Followed up|Sent|Emailed|Called|Waiting on )/i
export const toldGc = (t: Task) => !!t.asked || (t.followUps || 0) > 0 || (t.log || [])[0]?.who === 'system' || (t.log || []).some((l) => TOLD.test(l.text))

/** the day our crew starts on the job: booked, or the day we're getting it ready for */
export function startOf(s: Pick<Store, 'bookings' | 'prep'>, job?: Job): string | undefined {
  if (!job) return undefined
  return s.bookings.find((b) => b.jobId === job.id && b.label !== 'Return visit')?.start || s.prep[job.id]?.targetISO
}
/** the day it's needed by when nobody said: the start, if it's still ahead */
export function needByFor(s: Pick<Store, 'bookings' | 'prep'>, job?: Job): string | undefined {
  const st = startOf(s, job)
  return st && st >= TODAY ? st : undefined
}

/** n work days after a day */
const workDaysOn = (from: string, n: number) => { let d = from; let k = 0; while (k < n) { d = addDays(d, 1); if (dow(d) !== 0 && dow(d) !== 6) k++ } return d }
/** the next message to the GC: the day he said (it's checked then) — otherwise three work days on, every work day in
 *  the last week before it's needed (and never sleeping past the start of that week) */
export function nextAsk(t: Pick<Task, 'needBy' | 'promised'>, from = TODAY): string {
  if (t.promised && t.promised > from) return t.promised
  const n = t.needBy ? daysBetween(from, t.needBy) : undefined
  const d = workDaysOn(from, n === undefined ? 2 : n > 7 ? 3 : 1)
  if (t.needBy && n !== undefined && n > 7) { const wk = workday(addDays(t.needBy, -7)); if (wk > from && wk < d) return wk }
  return d
}

/* ---------------- where it stands — the same words on Today, the project and its window ---------------- */
export type GcState = { text: string; tone: 'bad' | 'warn' | 'quiet'; flag: boolean }
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
export function gcState(t: Task): GcState {
  const fu = isoFromLabel(t.followUp)
  const told = toldGc(t)
  const n = t.needBy ? daysBetween(TODAY, t.needBy) : undefined
  if (!told && fu && fu < TODAY) return { text: 'GC not told yet', tone: 'bad', flag: true }
  if (t.promised && t.promised < TODAY) return { text: `GC said ${md(t.promised)} — not done`, tone: 'bad', flag: true }
  if (told && fu && fu < TODAY) return { text: `Reminder ${days(daysBetween(fu, TODAY))} late`, tone: 'bad', flag: true }
  if (n !== undefined && n <= 7) return { text: n < 0 ? `Needed ${days(-n)} ago` : n === 0 ? 'Needed today' : `${days(n)} left`, tone: 'bad', flag: true }
  if (!told) return { text: 'Tell the GC today', tone: 'warn', flag: false }
  if (n !== undefined) return { text: `Needed in ${days(n)}`, tone: 'quiet', flag: false }
  return { text: fu === TODAY ? 'Remind today' : fu ? `Next reminder ${labelFromIso(fu)}` : 'Waiting', tone: 'quiet', flag: false }
}
/** every open one, the ones with something wrong first, then the soonest needed */
export function gcWaits(s: Pick<Store, 'tasks'>, jobId?: string): Task[] {
  const key = (t: Task) => `${gcState(t).flag ? 0 : 1}|${t.needBy || '9999'}|${isoFromLabel(t.followUp) || '9999'}`
  return s.tasks.filter((t) => isGcWait(t) && (!jobId || t.jobId === jobId)).sort((a, b) => key(a).localeCompare(key(b)))
}
/** the button: ask him (a question), tell him (the first time), remind him (after that) */
export const askLabel = (t: Task) => (isQuestion(t) && !toldGc(t) ? 'Ask the GC' : toldGc(t) ? 'Remind the GC' : 'Tell the GC')

/* ---------------- what goes to the GC, and on to whoever asked ---------------- */
/** the item as the GC reads it — without "from the GC", "GC to…", or who asked for it */
export function gcWords(title: string): string {
  const w = title
    .replace(/\s*[—–-]\s*(for|tell)\s+[A-Z][\w']*\s*$/u, '')
    .replace(/\s*[—–-]\s*(the )?(gc|contractor)\b.*$/i, '')
    .replace(/\s*[—–-]?\s*(waiting on|from) the gc\s*$/i, '')
    .replace(/^(the )?gc (to|has to|needs to|must|should|will)\s+/i, '')
    .trim()
  return w.charAt(0).toUpperCase() + w.slice(1)
}
/** the message to the GC — the day we start, firmer as it gets close */
export function gcMessage(s: Pick<Store, 'jobs'>, t: Task): string {
  const j = s.jobs[t.jobId]
  const what = gcWords(t.title)
  const again = toldGc(t)
  const q = /\?\s*$/.test(what)
  const n = t.needBy ? daysBetween(TODAY, t.needBy) : undefined
  const when = n === undefined ? '' : n > 7 ? `Our crew starts ${dayShort(t.needBy!)}.` : n > 1 ? `Our crew starts ${dayShort(t.needBy!)} — ${n} days from now.` : n === 1 ? 'Our crew starts tomorrow.' : n === 0 ? 'Our crew starts today.' : 'Our crew is on the job.'
  const ask = q && !again ? '' : n !== undefined && n <= 2 ? 'We need it now — please let us know today.' : n !== undefined && n <= 7 ? 'We need it before then. When will it be done?' : q ? 'Can you let us know?' : 'When will it be done?'
  const head = `Hi, it’s Cobblestone${again ? ' again' : ''}${j ? `, about ${j.name}` : ''}.`
  const end = /[.!?]$/.test(what) ? '' : '.'
  const line = again ? `Still open: ${what.charAt(0).toLowerCase()}${what.slice(1)}${end}` : `${what}${end}`
  return [head, line, [when, ask].filter(Boolean).join(' ')].filter(Boolean).join('\n')
}
/** the answer, written for whoever was waiting for it */
export function passOnMessage(s: Pick<Store, 'jobs'>, t: Task, answer: string): string {
  const j = s.jobs[t.jobId]
  return `${j ? `${j.name} — ` : ''}${gcWords(t.title)}\n${answer.trim()}`
}

/** WhatsApp, open with the message ready — you pick the chat (the GC's group) and send. Its own link: official */
export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
export function openWhatsApp(text: string) {
  try { window.open(waLink(text), '_blank', 'noopener,noreferrer') } catch { /* a blocked window: Copy is there */ }
}
export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); toast('Copied — paste it where you need it') } catch { toast('Couldn’t copy — select it and copy') }
}

/* ---------------- what happens ---------------- */
/** told or reminded the GC: it's off its person's list until the next one */
export function askedGc(id: string) {
  const s = useStore.getState()
  const me = meOf(s.role)
  const t = s.tasks.find((x) => x.id === id)
  if (!t) return
  const first = !toldGc(t)
  const next = nextAsk(t)
  s.commit((st) => {
    const x = st.tasks.find((y) => y.id === id)
    if (!x) return
    x.asked = TODAY
    x.followUps = (x.followUps || 0) + 1
    x.followUp = md(next)
    ;(x.log ||= []).push({ date: NOW, who: me, text: first ? 'Told the GC' : 'Reminded the GC' })
  }, first ? 'Sent to the GC' : 'Reminded the GC', { tone: 'wait', sub: `Next reminder ${labelFromIso(next) === 'Tomorrow' ? 'tomorrow' : labelFromIso(next)} — it’s off your list until then.` })
}
/** the day it has to be done by */
export function setNeedBy(id: string, iso?: string) {
  const s = useStore.getState()
  s.commit((st) => {
    const x = st.tasks.find((y) => y.id === id)
    if (!x) return
    x.needBy = iso
    /* a reminder set for after the new date's last week comes closer */
    const fu = isoFromLabel(x.followUp)
    if (iso && fu && fu > TODAY) { const nx = nextAsk(x, TODAY); if (nx < fu) x.followUp = md(nx) }
    ;(x.log ||= []).push({ date: NOW, who: meOf(st.role), text: iso ? `Needed by ${md(iso)}` : 'No date it’s needed by' })
  }, iso ? `Needed by ${dayShort(iso)}` : 'No date it’s needed by')
}
/** what the GC said: a day (checked then), done (with a photo of it), or just his words (the next reminder as usual).
 *  Done with someone waiting for the answer: it's sent on to him */
export async function gcAnswered(id: string, o: { text: string; done?: boolean; day?: string; photos?: File[]; passedTo?: PersonKey }) {
  const s = useStore.getState()
  const me = meOf(s.role)
  const t0 = s.tasks.find((x) => x.id === id)
  if (!t0) return
  if (o.photos?.length && t0.jobId) await keepFiles(t0.jobId, o.photos, 'photo', { quiet: true, hist: false })
  const said = o.text.trim()
  const next = o.day || nextAsk({ needBy: t0.needBy })
  const to = o.passedTo ? PEOPLE[o.passedTo]?.short || 'them' : ''
  s.commit((st) => {
    const x = st.tasks.find((y) => y.id === id)
    if (!x) return
    ;(x.log ||= [])
    if (said) { x.said = { text: said, day: TODAY }; x.log.push({ date: NOW, who: me, text: `GC: “${said}”`, note: true }) }
    if (o.done) {
      x.state = 'done'
      x.doneAt = 'Just now'
      x.doneOn = TODAY
      x.result = o.passedTo ? `${said} — sent to ${to}` : said || (o.photos?.length ? 'Done — the photo is with the project' : 'Done')
      x.log.push({ date: NOW, who: me, text: o.passedTo ? `Sent to ${to}` : o.photos?.length ? 'Done — with a photo' : 'Done' })
      if (x.jobId) addHist(st, x.jobId, { who: me, kind: 'field', title: `Done · ${x.title}`, detail: [said && `The GC: “${said}”`, o.passedTo && `sent to ${to}`, o.photos?.length && `${o.photos.length === 1 ? 'a photo' : `${o.photos.length} photos`} of it`].filter(Boolean).join(' · ') || undefined })
      /* whoever follows it hears it's done */
      const hear = Array.from(new Set([x.by, x.owner, ...(x.followers || [])].filter((p): p is PersonKey => !!p && p !== me)))
      if (hear.length) st.notices.unshift({ id: 'nt' + Date.now(), jobId: x.jobId, text: `Done · ${x.title}${st.jobs[x.jobId] ? ` at ${st.jobs[x.jobId].name}` : ''} — ${PEOPLE[me]?.short || 'someone'}`, when: 'Just now', kind: 'field', unread: true, open: { t: 'task', id: x.id }, for: hear })
      return
    }
    if (o.day) x.promised = o.day
    x.followUp = md(next)
    if (said && x.jobId) addHist(st, x.jobId, { who: me, kind: 'field', title: `The GC on ${x.title}`, detail: `“${said}”${o.day ? ` · checked again ${md(o.day)}` : ''}` })
  }, o.done ? (o.passedTo ? `Sent to ${to}` : 'Done!') : o.day ? `The GC said ${labelFromIso(o.day) === 'Tomorrow' ? 'tomorrow' : labelFromIso(o.day)}` : 'Saved', { tone: o.done ? 'done' : 'wait', sub: o.done ? t0.title : `It’s back on the list ${labelFromIso(next) === 'Tomorrow' ? 'tomorrow' : labelFromIso(next)} — done only when it’s done.` })
}

/* ---------------- in the item's window ---------------- */
/** what goes to the GC — written out, the way it'll look in WhatsApp; Copy for anywhere else */
export function GcMessageBox({ t }: { t: Task }) {
  const s = useStore()
  const text = gcMessage(s, t)
  return (
    <div data-gc-message>
      <div className="flex items-center gap-2">
        <span className="text-[0.8125rem] font-medium text-muted">{toldGc(t) ? 'The reminder' : 'What goes to the GC'}</span>
        <button type="button" onClick={() => void copyText(text)} className="ml-auto inline-flex items-center gap-1 text-[0.8125rem] font-medium text-brand-700 hover:underline" data-gc-copy><Copy className="h-3.5 w-3.5" />Copy</button>
      </div>
      <p className="mt-1.5 whitespace-pre-line rounded-xl rounded-tl-sm bg-[#e8f7e4] px-3.5 py-2.5 text-[0.875rem] leading-relaxed text-ink" data-gc-text>{text}</p>
    </div>
  )
}
/** how far the GC's been told — and, where it's wanted, what he said last */
export function gcSoFar(t: Task, said = true): string {
  const k = t.followUps || 0
  const parts = [t.asked ? `${k > 1 ? `messaged ${k} times, last ${md(t.asked)}` : `told ${md(t.asked)}`}` : toldGc(t) ? 'he knows' : 'not told yet', said && t.said ? `he said “${t.said.text}” (${md(t.said.day)})` : '']
  return parts.filter(Boolean).join(' · ')
}

/** the next few work days, as people say them: Tomorrow, Mon, Tue… */
function nextDays(n = 4): string[] {
  const out: string[] = []
  let d = TODAY
  while (out.length < n) { d = addDays(d, 1); if (dow(d) !== 0 && dow(d) !== 6) out.push(labelFromIso(d)) }
  return out
}
/** they answered: his words (paste, type or say them), and done — or the day it's coming */
export function GcAnswer({ t, onDone, onBack }: { t: Task; onDone: () => void; onBack: () => void }) {
  const s = useStore()
  const forName = t.forWho ? PEOPLE[t.forWho]?.short || 'them' : ''
  const q = isQuestion(t)
  const [text, setText] = React.useState('')
  /* done — or a day it's coming (as a word: "Thu", "Nov 18") */
  const [pick, setPick] = React.useState<string>(t.forWho ? 'done' : '')
  const [photos, setPhotos] = React.useState<File[]>([])
  const [busy, setBusy] = React.useState(false)
  const done = pick === 'done'
  const day = !done && pick ? isoFromLabel(pick) : undefined
  const sendOn = done && !!t.forWho
  const can = !busy && (sendOn ? !!text.trim() : !!(text.trim() || pick || photos.length))
  const save = async () => {
    if (!can) return
    setBusy(true)
    /* the answer on to whoever asked — WhatsApp opens on the tap, before anything else */
    if (sendOn) openWhatsApp(passOnMessage(s, t, text))
    await gcAnswered(t.id, { text, done, day, photos, passedTo: sendOn ? t.forWho : undefined })
    setBusy(false)
    onDone()
  }
  return (
    <div data-gc-answer>
      <div className="text-[0.9375rem] font-semibold text-ink">What the GC said</div>
      <TextArea className="mt-2" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={q ? 'Paste or type his answer' : 'Paste or type it — “the plumber comes Thursday”'} autoFocus data-gc-said />
      <div className="mt-3 flex flex-wrap items-center gap-2" data-gc-picks>
        <Chip on={done} onClick={() => setPick(done ? '' : 'done')} icon={done ? undefined : <Check className="h-4 w-4" />}>{q ? 'That’s the answer' : 'It’s done'}</Chip>
        <span className="px-0.5 text-[0.8125rem] text-muted">or coming</span>
        <DatePresets value={done ? undefined : pick} onPick={(d) => setPick(d === pick ? '' : d)} presets={nextDays()} />
      </div>
      {done && !t.forWho && (
        <div className="mt-3 flex items-center gap-3" data-gc-photo>
          <PhotoButton photos={photos} onAdd={(f) => setPhotos([...photos, ...f])} label="Photo of it done" />
          <span className="text-[0.8125rem] text-muted">{photos.length ? 'It goes with the project.' : 'So everyone sees it’s done.'}</span>
        </div>
      )}
      <div className="mt-5 flex items-center gap-3">
        <Button variant="ghost" icon={<ChevronLeft />} onClick={onBack} data-gc-back>Back</Button>
        <Button className="ml-auto max-sm:flex-1" variant="primary" icon={sendOn ? <Send /> : done ? <Check /> : undefined} disabled={!can} onClick={() => void save()} data-gc-save>
          {sendOn ? `Send it to ${forName}` : done ? 'Done' : day ? `Check again ${labelFromIso(day) === 'Tomorrow' ? 'tomorrow' : labelFromIso(day)}` : 'Save'}
        </Button>
      </div>
    </div>
  )
}

/* ---------------- on the project, under where it is ---------------- */
/** what the project waits on from the GC — one line: each thing (tap it: its window) and the days left */
export function GcLine({ job }: { job: Job }) {
  const s = useStore()
  const list = gcWaits(s, job.id)
  if (!list.length) return null
  const first = gcState(list[0])
  return (
    <div className="mt-2.5 flex min-w-0 items-center gap-1.5 text-[0.8125rem]" data-gc-line={list.length}>
      <Hourglass className="h-3.5 w-3.5 shrink-0 text-warn-600" />
      <span className="shrink-0 font-medium text-warn-700">Waiting on the GC</span>
      <span className="shrink-0 text-faint" aria-hidden>·</span>
      <span className="min-w-0 truncate">
        {list.slice(0, 3).map((t, i) => (
          <React.Fragment key={t.id}>
            {i > 0 && <span className="text-muted">, </span>}
            <button type="button" onClick={() => s.open({ t: 'task', id: t.id })} className="text-ink-2 hover:text-brand-700 hover:underline" data-gc-line-item={t.id}>{gcWords(t.title).replace(/\?$/, '')}</button>
          </React.Fragment>
        ))}
        {list.length > 3 && <span className="text-muted"> and {list.length - 3} more</span>}
      </span>
      <span className="shrink-0 text-faint" aria-hidden>·</span>
      <span className={cn('shrink-0', first.tone === 'bad' ? 'font-medium text-bad-600' : first.tone === 'warn' ? 'font-medium text-warn-700' : 'text-muted')} data-gc-line-state>{first.text}</span>
    </div>
  )
}
