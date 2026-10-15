/* Record something — pick what happened (big colored options), then one short form with only the questions that
 * thing needs, each a dropdown: the day, the time, how long, who, which installer. Payment received asks which
 * invoice and how much. Delivery asks which order. Daily update and a client change open their own windows. */
import * as React from 'react'
import {
  ArrowLeftRight, MessageCircleQuestion, Truck, PackageX, Gavel, Phone, ClipboardList, Wallet, ArrowLeft, Camera, Check, ChevronRight, Search,
  Building2, FileText, Package, CircleDollarSign, CalendarPlus, AlertTriangle, CalendarDays, Clock3, HardHat,
} from 'lucide-react'
import { toast } from '@/tileos/lib/pop'
import { keepFiles } from '@/tileos/lib/files'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Modal, WAIT_WHO } from '@/tileos/components/ui/overlay'
import { Button, TextArea, SearchField, TextInput, Avatar, Segmented } from '@/tileos/components/ui/core'
import { SearchSelect, MultiSelect } from '@/tileos/components/ui/select'
import { TODAY, addDays, dow, dayShort } from '@/tileos/lib/today'
import { AvatarStack } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, PEOPLE, CREWS, type Job, type PersonKey } from '@/tileos/data/model'
import { dayLabel, timeLabel, rangeLabel, parseTime, workDays } from '@/tileos/data/calendar'
import { busyFor, clashesWith, nextFree, addEvent } from './calendar'
import { recordEvent, recordPayment, receivePO, receiveTile } from './flows'
import { ColorTile, TILE_COLORS } from './newpicker'

type Color = 'amber' | 'violet' | 'red' | 'teal' | 'indigo' | 'cyan' | 'blue' | 'green' | 'orange'

type TypeKey = 'question' | 'change' | 'shortage' | 'delivery' | 'decision' | 'call' | 'daily' | 'payment' | 'meeting'
interface Tpl { key: TypeKey; label: string; hint: string; icon: React.ElementType; color: Color; kindQ?: string; kindStep?: string; kinds?: [string, string][]; where?: boolean; wait?: boolean }
const TPL: Tpl[] = [
  { key: 'question', label: 'Site issue or question', hint: 'Something on site needs an answer', icon: MessageCircleQuestion, color: 'amber', kindQ: 'What is it about?', kindStep: 'About', kinds: [['Drain or plumbing', 'Final drain, sequence, elevation'], ['Layout or start point', 'Centered, full tile, direction'], ['Metal or edge', 'Miter, profile, size, finish'], ['Transition or elevation', 'Where tile meets something else'], ['Something else', 'Anything not on this list']], where: true, wait: true },
  { key: 'change', label: 'Client asked for a change', hint: 'Different height, tile, layout or extra work', icon: ArrowLeftRight, color: 'violet', kindQ: 'What kind of change?', kindStep: 'Change', kinds: [['Tile height', 'Higher or lower than approved'], ['Extra surface or room', 'Not in the scope'], ['Different tile or finish', 'A selection change'], ['Extra work on site', 'The GC asked the crew directly']], where: true },
  { key: 'shortage', label: 'Short, wrong or damaged', hint: 'The crew can’t finish with what’s there', icon: PackageX, color: 'red', kindQ: 'What is short?', kindStep: 'What', kinds: [['Finish tile', 'Supplied by the GC or the store'], ['Metal or trim', 'We supply it'], ['Setting material', 'Thinset, mud, membrane, grout'], ['Something else', 'Consumables, protection']], where: true },
  { key: 'delivery', label: 'Delivery arrived', hint: 'Tile or materials landed on site', icon: Truck, color: 'teal', kindQ: 'How did it arrive?', kindStep: 'Arrived', kinds: [['All of it, correct', 'Nothing outstanding'], ['Part of it', 'Some of it came'], ['Wrong item', 'Not what was ordered'], ['Damaged', 'Broken boxes or cracked tile']] },
  { key: 'decision', label: 'Decision made', hint: 'The designer, GC or client answered', icon: Gavel, color: 'indigo', kindQ: 'What was decided?', kindStep: 'Decided', kinds: [['Layout or direction', 'Centered, full tile, start point'], ['Edge or metal', 'Miter or profile, size, finish'], ['Height or where it stops', 'Where the tile ends'], ['Niche, bench or curb', 'Treatment and edges']], where: true },
  { key: 'meeting', label: 'Meeting or walkthrough', hint: 'On the agenda with a day and a time', icon: CalendarPlus, color: 'blue' },
  { key: 'call', label: 'Call or follow-up', hint: 'Spoke with someone, or no answer', icon: Phone, color: 'cyan', kindQ: 'How did it go?', kindStep: 'Result', kinds: [['Spoke — they’ll confirm', 'A promise with a date'], ['Still reviewing', 'No decision yet'], ['No answer', 'Left a message'], ['They approved it', 'Said yes']], wait: true },
  { key: 'daily', label: 'Daily update', hint: 'What the crew tiled today', icon: ClipboardList, color: 'orange' },
  { key: 'payment', label: 'Payment received', hint: 'A check or transfer came in', icon: Wallet, color: 'green' },
]
const BACK = ['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon', 'In 2 weeks']
const METHODS = ['Check', 'ACH / transfer', 'Wire', 'Card']
const PRICING = ['request', 'estimating', 'proposal', 'followup']

type StepKey = 'type' | 'project' | 'invoice' | 'amount' | 'delivery' | 'kind' | 'where' | 'fromto' | 'wait' | 'who' | 'when' | 'note'

/** invoices sent and not paid in full */
export const openInvoices = (s: Store, jobId?: string) => s.money.filter((m) => m.state === 'waiting' && m.ref && m.amount && m.kind !== 'custpo' && (!jobId || m.jobId === jobId))
/** what's still coming to a project: our POs not delivered, tile the GC ordered that isn't all here */
type Delivery = { key: string; kind: 'po' | 'tile'; id: string; title: string; sub: string }
function deliveriesOf(s: Store, jobId: string): Delivery[] {
  const pos = s.pos.filter((p) => p.jobId === jobId && p.step < 3).map((p) => ({ key: 'po:' + p.id, kind: 'po' as const, id: p.id, title: `${p.id} · ${p.what}`, sub: `${p.supplier} · ${p.late ? 'late — ' : ''}${p.eta || p.note}` }))
  const tile = s.checks.filter((c) => c.jobId === jobId && c.received < c.ordered).map((c) => ({ key: 'tile:' + c.tag, kind: 'tile' as const, id: c.tag, title: `${c.tag} tile · ${c.where}`, sub: `${c.received} of ${c.ordered} ${c.unit} here · from ${c.supplier}` }))
  return [...pos, ...tile]
}
/** the projects that make sense for each kind of record */
function projectsFor(s: Store, type: TypeKey | ''): Job[] {
  const all = Object.values(s.jobs).filter((j) => j.stage !== 'complete')
  if (type === 'payment') return all.filter((j) => openInvoices(s, j.id).length)
  if (type === 'daily') return all.filter((j) => ['installation', 'punch'].includes(j.stage))
  if (type === 'delivery') return all.filter((j) => deliveriesOf(s, j.id).length)
  if (type === 'call' || type === 'meeting') return all
  return all.filter((j) => !PRICING.includes(j.stage))
}

/* one line of the form: the question on the left, the answer on the right (stacked on a phone) */
function FormRow({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-x-5 gap-y-1.5 border-t border-line-2 py-3.5 first:border-t-0 first:pt-0 max-sm:grid-cols-1">
      <div className="pt-2.5 text-[0.84375rem] font-semibold text-ink-2 max-sm:pt-0">{label}</div>
      <div className="min-w-0">
        {children}
        {hint && <div className="mt-1.5 text-[0.78125rem] text-muted">{hint}</div>}
      </div>
    </div>
  )
}
const DURS: [number, string][] = [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours'], [180, '3 hours'], [240, 'Half day']]
const BACK_OPTS = ['Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon', 'In 2 weeks']
const nextHour = () => { const d = new Date(); const m = (d.getHours() + 1) * 60; return m >= 7 * 60 && m <= 17 * 60 ? m : 9 * 60 }

export function RecordModal({ jobId: initialJob, type: initialType, where: initialWhere, title: initialTitle, meetKind: initialKind, level }: { jobId?: string; type?: string; where?: string; title?: string; meetKind?: 'meeting' | 'walkthrough'; level: number }) {
  const s = useStore()
  const [type, setType] = React.useState<TypeKey | ''>((initialType as TypeKey) || '')
  /* photos picked for this record — they go onto the project's photos when it's saved */
  const [photos, setPhotos] = React.useState<File[]>([])
  const photoInput = React.useRef<HTMLInputElement>(null)
  const [jobId, setJobId] = React.useState(initialJob || '')
  const [invoice, setInvoice] = React.useState('')
  const [full, setFull] = React.useState(true)
  const [part, setPart] = React.useState('')
  const [method, setMethod] = React.useState('Check')
  const [checkNo, setCheckNo] = React.useState('')
  const [delivery, setDelivery] = React.useState('')
  const [kind, setKind] = React.useState('')
  const [room, setRoom] = React.useState(initialWhere?.split(' · ')[0] || '')
  const [surface, setSurface] = React.useState(initialWhere?.split(' · ')[1] || '')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [waitOn, setWaitOn] = React.useState('')
  const [back, setBack] = React.useState('Tomorrow')
  const [note, setNote] = React.useState('')
  const me = meOf(s.role)
  const [meetKind, setMeetKind] = React.useState<'meeting' | 'walkthrough'>(initialKind || 'meeting')
  const [people, setPeople] = React.useState<PersonKey[]>([me])
  const [others, setOthers] = React.useState<string[]>([])
  const [installer, setInstaller] = React.useState<PersonKey | ''>('')
  const late = new Date().getHours() >= 17
  const [date, setDate] = React.useState(late ? workDays(2)[1] : workDays(1)[0])
  const [start, setStart] = React.useState<number>(late ? 9 * 60 : nextHour())
  const [dur, setDur] = React.useState(60)
  const [title, setTitle] = React.useState(initialTitle || '')
  const job = s.jobs[jobId]
  const tpl = TPL.find((t) => t.key === type)
  const rooms = s.rooms[jobId] || []
  const inv = s.money.find((m) => m.id === invoice)
  const open = inv ? (inv.amount || 0) - (inv.paid || 0) : 0
  const amount = full ? open : Number(part.replace(/[^0-9.]/g, '')) || 0
  const dl = jobId ? deliveriesOf(s, jobId).find((d) => d.key === delivery) : undefined

  /* daily updates and changes on a project with rooms have their own windows */
  React.useEffect(() => {
    if (!jobId) return
    if (type === 'daily') s.swap({ t: 'daily', jobId })
    if (type === 'change' && (s.rooms[jobId] || []).length) s.swap({ t: 'sitechange', jobId, room: room || undefined, surface: surface || undefined })
  }, [type, jobId])

  const where = room ? (room === 'Whole project' ? 'Whole project' : surface && surface !== 'Whole room' ? `${room} · ${surface}` : room) : ''
  const needWait = !!tpl?.wait && kind !== 'They approved it'
  const ready = type === 'payment' ? !!inv && !!amount && amount <= open
    : type === 'meeting' ? people.length > 0 && !!date
      : type === 'delivery' ? !!jobId && !!delivery && !!kind
        : !!jobId && (!tpl?.kinds || !!kind) && (type !== 'change' || kind !== 'Tile height' || (!!from && !!to)) && (!needWait || !!waitOn)
  const save = () => {
    if (!ready) return
    if (type === 'delivery' && dl && kind === 'All of it, correct') {
      if (dl.kind === 'po') receivePO(dl.id)
      else {
        const c = s.checks.find((x) => x.jobId === jobId && x.tag === dl.id)
        if (c) receiveTile(jobId, dl.id, c.ordered - c.received)
      }
      s.closeAll()
      return
    }
    if (photos.length && jobId) void keepFiles(jobId, photos, 'photo', { quiet: true })
    recordEvent({ jobId, type, label: tpl!.label, kind, where: type === 'delivery' ? dl?.title : where, from, to, waitingOn: needWait ? waitOn : '', back, note: [note.trim(), photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || undefined })
  }
  const withText = [...others.filter((o) => o !== 'Installer'), others.includes('Installer') ? (installer ? `${PEOPLE[installer].name} (installer)` : 'the installer') : ''].filter(Boolean).join(', ')
  const kindLabel = meetKind === 'walkthrough' ? 'Walkthrough' : 'Meeting'
  const autoTitle = withText ? `${kindLabel} with ${withText}` : job ? `${kindLabel} · ${job.name}` : kindLabel
  const clash = date ? clashesWith(s, { date, start, dur }, people) : []
  const free = date && clash.length ? nextFree(s, date, start, dur, people) : null
  const saveMeeting = () => {
    if (!ready) return
    addEvent({ jobId: jobId || undefined, kind: meetKind, title: title.trim() || autoTitle, date, start, dur, people, with: withText || undefined, note: note.trim() || undefined })
    s.closeAll()
  }
  const savePayment = () => {
    if (!ready || !inv) return
    recordPayment(inv.id, amount, `${method}${method === 'Check' && checkNo ? ' #' + checkNo : ''}`)
    s.closeAll()
  }

  const projects = projectsFor(s, type)
  const ORDER = ['installation', 'punch', 'ready', 'scheduled', 'verification', 'setup', 'awarded', 'closeout', 'complete']
  const projOpts = projects.slice().sort((a, b) => ORDER.indexOf(a.stage) - ORDER.indexOf(b.stage)).map((j) => ({ key: j.id, label: j.name, hint: `${j.client}${j.address ? ' · ' + j.address : ''}` }))
  const invoices = openInvoices(s, initialJob)
  /* the times of the day, every 15 minutes — the ones already taken for these people say so */
  const busy = date ? busyFor(s, date, people) : []
  const timeOpts = Array.from({ length: (19 - 6) * 4 + 1 }, (_, i) => 6 * 60 + i * 15).map((m) => {
    const hit = busy.find((b) => m < b.start + b.dur && m + dur > b.start)
    return { key: String(m), label: timeLabel(m).replace(/^(\d+) /, '$1:00 '), hint: hit ? `Busy — ${hit.title} ${rangeLabel(hit.start, hit.dur)}` : undefined }
  })
  const dayOpts = Array.from({ length: 28 }, (_, i) => addDays(TODAY, i)).filter((d) => dow(d) !== 6 || d === TODAY).map((d) => ({ key: d, label: dayLabel(d) === 'Today' || dayLabel(d) === 'Tomorrow' ? `${dayLabel(d)} · ${dayShort(d)}` : dayShort(d) }))

  const header = (
    <div className="border-b border-line px-6 pb-4 pt-5 pr-16 max-sm:px-4 max-sm:pr-14">
      <div className="flex items-center gap-3">
        {tpl && <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.6875rem] text-white" style={{ background: TILE_COLORS[tpl.color].solid }}><tpl.icon className="h-5 w-5" /></span>}
        <div className="min-w-0">
          <div className="text-[0.8125rem] font-medium text-muted">{initialJob && job ? job.name : 'Log what happened'}</div>
          <h2 className="truncate text-[1.25rem] font-bold tracking-[-0.01em] text-ink max-sm:text-[1.125rem]">{tpl ? tpl.label : 'What happened?'}</h2>
        </div>
        {tpl && !initialType && <button onClick={() => { setType(''); setKind('') }} className="ml-auto shrink-0 text-[0.8125rem] font-semibold text-brand-700 hover:underline">Change</button>}
      </div>
    </div>
  )
  const footer = !type ? undefined : (
    <>
      {!initialType ? <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => { setType(''); setKind('') }}>Back</Button> : <span />}
      {type === 'meeting' && <Button className="ml-auto" variant="primary" icon={<CalendarPlus className="h-4 w-4" />} disabled={!ready} onClick={saveMeeting}>Put it on the agenda</Button>}
      {type === 'payment' && <Button className="ml-auto" variant="primary" icon={<Check />} disabled={!ready} onClick={savePayment}>Record {amount ? fmtMoney(amount) : 'payment'}</Button>}
      {type !== 'meeting' && type !== 'payment' && type !== 'daily' && (
        <>
          <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const l = Array.from(e.target.files || []); e.target.value = ''; setPhotos((p) => [...p, ...l]) }} />
          <Button className="ml-auto" icon={<Camera className="h-4 w-4" />} onClick={() => photoInput.current?.click()}>{photos.length ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Add photo'}</Button>
          <Button variant="primary" disabled={!ready} onClick={save}>Save</Button>
        </>
      )}
    </>
  )
  const projectRow = !initialJob && (
    <FormRow label={type === 'meeting' ? 'About' : 'Project'}>
      <SearchSelect
        label="Project"
        value={jobId}
        onChange={(k) => { setJobId(k); setRoom(''); setSurface(''); setDelivery('') }}
        options={projOpts}
        placeholder="Pick the project"
        emptyLabel={type === 'meeting' ? 'Company meeting — no project' : undefined}
        searchPlaceholder="Type a project, address or client…"
        width={420}
        search
      />
      {!projOpts.length && <div className="mt-1.5 text-[0.78125rem] text-muted">{type === 'delivery' ? 'Nothing is on its way to any project.' : 'No project needs this right now.'}</div>}
    </FormRow>
  )

  return (
    <Modal level={level} size="md" onClose={s.close} header={header} footer={footer} title="Log what happened" bodyClass="px-6 py-5 max-sm:px-4">
      <div key={type || 'type'} className="animate-fade-up">
        {!type && (
          <div className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-2 max-sm:gap-2">
            {TPL.map((t) => (
              <ColorTile key={t.key} label={t.label} hint={t.hint} icon={t.icon} color={t.color} selected={false} onClick={() => { setType(t.key); setKind(''); setDelivery(''); setInvoice('') }} />
            ))}
          </div>
        )}

        {type === 'meeting' && (
          <div>
            {projectRow}
            <FormRow label="What">
              <Segmented value={meetKind} onChange={setMeetKind} items={[{ key: 'meeting', label: 'Meeting' }, { key: 'walkthrough', label: 'Walkthrough on site' }]} />
            </FormRow>
            <FormRow label="When" hint={clash.length ? undefined : busy.length ? `${busy.length} other ${busy.length === 1 ? 'thing' : 'things'} that day for ${people.length === 1 && people[0] === me ? 'you' : 'them'} — the busy times say so in the list.` : undefined}>
              <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2 max-sm:grid-cols-2">
                <SearchSelect label="Day" value={date} onChange={setDate} options={dayOpts} width={280} search={false} icon={<CalendarDays />} className="max-sm:col-span-2" />
                <SearchSelect label="Time" value={String(start)} onChange={(k) => setStart(Number(k))} options={timeOpts} width={300} search={false} icon={<Clock3 />} />
                <SearchSelect label="How long" value={String(dur)} onChange={(k) => setDur(Number(k))} options={DURS.map(([m, l]) => ({ key: String(m), label: l }))} width={200} search={false} />
              </div>
              {clash.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2.5 rounded-[0.625rem] border border-bad-100 bg-bad-50 px-3 py-2 text-[0.8125rem] text-bad-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1">Clashes with <b>{clash[0].title}</b> ({rangeLabel(clash[0].start, clash[0].dur)})</span>
                  {free != null && <Button size="xs" variant="primary" onClick={() => setStart(free)}>Move to {timeLabel(free)}</Button>}
                </div>
              )}
            </FormRow>
            <FormRow label="From Cobblestone">
              <MultiSelect
                label="From Cobblestone"
                values={people}
                onChange={(v) => setPeople(v as PersonKey[])}
                options={OUR_PEOPLE.filter((p) => PEOPLE[p]).map((p) => ({ key: p, label: p === me ? `${PEOPLE[p].name} (me)` : PEOPLE[p].name, hint: PEOPLE[p].roleLabel, lead: <Avatar who={p} size={24} /> }))}
                placeholder="Who from our side"
                summary={(xs) => <span className="flex items-center gap-2"><AvatarStack who={xs.map((x) => x.key as PersonKey)} size={22} max={4} /><span className="truncate">{xs.map((x) => (x.key === me ? 'You' : PEOPLE[x.key as PersonKey].short)).join(', ')}</span></span>}
              />
            </FormRow>
            <FormRow label="Who else">
              <MultiSelect label="Who else" values={others} onChange={setOthers} options={OTHERS.map((o) => ({ key: o, label: o }))} placeholder="Nobody else" />
              {others.includes('Installer') && (
                <div className="mt-2">
                  <SearchSelect label="Which installer" value={installer} onChange={(k) => setInstaller(k as PersonKey)} options={CREWS.filter((c) => !(s.inactive || []).includes('crew:' + c)).map((c) => ({ key: c, label: PEOPLE[c].name }))} placeholder="Which installer?" width={280} search={false} icon={<HardHat />} />
                </div>
              )}
            </FormRow>
            <FormRow label="Name it">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={autoTitle} />
            </FormRow>
            <FormRow label="Note">
              <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it’s about — e.g. go over the tiles we saw today (optional)" />
            </FormRow>
          </div>
        )}

        {type === 'payment' && (
          <div>
            <FormRow label="Which invoice">
              <SearchSelect
                label="Invoice"
                value={invoice}
                onChange={(k) => { setInvoice(k); setFull(true); setPart('') }}
                options={invoices.map((m) => ({ key: m.id, label: `${m.ref} · ${s.jobs[m.jobId]?.name} — ${m.title}`, hint: `${fmtMoney((m.amount || 0) - (m.paid || 0))} open · ${s.jobs[m.jobId]?.client}` }))}
                placeholder="Pick the invoice"
                searchPlaceholder="Invoice number, project or client…"
                width={460}
                search
              />
              {!invoices.length && <div className="mt-1.5 text-[0.78125rem] text-muted">No open invoices — everything sent is paid.</div>}
            </FormRow>
            {inv && (
              <FormRow label="How much">
                <Segmented value={full ? 'all' : 'part'} onChange={(v) => setFull(v === 'all')} items={[{ key: 'all', label: `All of it · ${fmtMoney(open)}` }, { key: 'part', label: 'Part of it' }]} />
                {!full && <TextInput autoFocus className="mt-2 max-w-[13.75rem] text-[1rem] font-semibold tnum" value={part} onChange={(e) => setPart(e.target.value)} placeholder="$0" inputMode="decimal" />}
                {!full && amount > open && <div className="mt-1.5 text-[0.78125rem] font-medium text-bad-600">More than what’s open ({fmtMoney(open)})</div>}
              </FormRow>
            )}
            <FormRow label="How it was paid">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-[13.75rem]"><SearchSelect label="Method" value={method} onChange={setMethod} options={METHODS.map((m) => ({ key: m, label: m }))} width={220} search={false} /></div>
                {method === 'Check' && <TextInput className="w-[10rem]" value={checkNo} onChange={(e) => setCheckNo(e.target.value)} placeholder="Check #" />}
              </div>
            </FormRow>
          </div>
        )}

        {type === 'daily' && (
          <div>
            {projectRow}
            <div className="mt-1 text-[0.8125rem] text-muted">Pick the project — the daily update opens with its rooms.</div>
          </div>
        )}

        {tpl && type !== 'meeting' && type !== 'payment' && type !== 'daily' && (
          <div>
            {projectRow}
            {type === 'delivery' && jobId && (
              <FormRow label="Which delivery">
                <SearchSelect label="Delivery" value={delivery} onChange={setDelivery} options={deliveriesOf(s, jobId).map((d) => ({ key: d.key, label: d.title, hint: d.sub }))} placeholder="Pick the order" width={440} search={false} />
              </FormRow>
            )}
            {tpl.kinds && (
              <FormRow label={tpl.kindQ || 'What is it?'}>
                <SearchSelect
                  label={tpl.kindQ || 'What is it?'}
                  value={kind}
                  onChange={(k) => {
                    if (type === 'shortage' && k === 'Finish tile' && jobId) { s.swap({ t: 'reportshort', jobId, room: room || undefined, surface: surface || undefined }); return }
                    setKind(k)
                  }}
                  options={tpl.kinds.map(([k, h]) => ({ key: k, label: k, hint: h }))}
                  placeholder="Pick one"
                  width={380}
                  search={false}
                />
              </FormRow>
            )}
            {tpl.where && rooms.length > 0 && (
              <FormRow label="Where">
                <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
                  <SearchSelect label="Room" value={room} onChange={(k) => { setRoom(k); setSurface('') }} options={[...rooms.map((r) => ({ key: r.name, label: r.name })), { key: 'Whole project', label: 'Whole project' }]} placeholder="Which room" width={300} />
                  {room && room !== 'Whole project' && <SearchSelect label="Wall or floor" value={surface} onChange={setSurface} options={[...(rooms.find((r) => r.name === room)?.surfaces || []).map((x) => ({ key: x.name, label: x.name })), { key: 'Whole room', label: 'Whole room' }]} placeholder="Which wall or floor" width={300} search={false} />}
                </div>
              </FormRow>
            )}
            {type === 'change' && kind === 'Tile height' && (
              <FormRow label="Heights">
                <div className="grid grid-cols-2 gap-2">
                  <SearchSelect label="Approved" value={from} onChange={setFrom} options={['3 ft', '4 ft', 'Half wall'].map((x) => ({ key: x, label: `Approved: ${x}` }))} placeholder="Approved" search={false} width={220} />
                  <SearchSelect label="Now asking for" value={to} onChange={setTo} options={['4 ft', '6 ft', 'Full height'].map((x) => ({ key: x, label: `Now: ${x}` }))} placeholder="Now asking for" search={false} width={220} />
                </div>
              </FormRow>
            )}
            {needWait && (
              <FormRow label="Waiting on">
                <div className="grid grid-cols-2 gap-2">
                  <SearchSelect label="Who we’re waiting on" value={waitOn} onChange={setWaitOn} options={WAIT_WHO.map((w) => ({ key: w, label: w }))} placeholder="Who" search={false} width={240} />
                  <SearchSelect label="Back on" value={back} onChange={setBack} options={BACK_OPTS.map((b) => ({ key: b, label: `Back ${b === 'Tomorrow' || b === 'Next Mon' || b === 'In 2 weeks' ? b.toLowerCase() : 'on ' + b}` }))} search={false} width={240} />
                </div>
              </FormRow>
            )}
            <FormRow label="Note">
              <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was said, a measurement, a name (optional)" />
            </FormRow>
          </div>
        )}
      </div>
    </Modal>
  )
}

const QUESTION: Record<StepKey, (t?: Tpl, room?: string) => string> = {
  type: () => 'What happened?',
  project: () => 'Which project?',
  invoice: () => 'Which invoice was paid?',
  amount: () => 'How much came in?',
  delivery: () => 'Which delivery?',
  kind: (t) => t?.kindQ || 'What is it?',
  where: () => 'Where on the project?',
  fromto: () => 'What was approved, and what do they want now?',
  wait: () => 'Who are we waiting on?',
  who: () => 'Who’s in it?',
  when: () => 'When?',
  note: (t) => (t?.key === 'meeting' ? 'Anything to add?' : 'Anything to add?'),
}
const STEP_LABEL: Record<StepKey, (t?: Tpl) => string> = {
  type: () => 'What happened',
  project: () => 'Project',
  invoice: () => 'Invoice',
  amount: () => 'Amount',
  delivery: () => 'Delivery',
  kind: (t) => t?.kindStep || 'Details',
  where: () => 'Where',
  fromto: () => 'Heights',
  wait: () => 'Waiting on',
  who: () => 'Who',
  when: () => 'When',
  note: () => 'Save',
}

const OUR_PEOPLE: PersonKey[] = ['ys', 'yakov', 'office', 'estimator', 'materials', 'accounting']
const OTHERS = ['Installer', 'Designer', 'GC / super', 'Client', 'Plumber', 'Tile store']
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => h * 60)
function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[0.84375rem] font-semibold text-ink-2">{children}</div>
}

function Empty({ text }: { text: string }) {
  return <div className="flex items-center gap-2 py-6 text-[0.875rem] text-muted"><Search className="h-4 w-4" />{text}</div>
}

function Option({ label, hint, icon, on, onClick }: { label: string; hint?: string; icon?: React.ReactNode; on?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('group flex w-full min-w-0 items-center gap-3.5 rounded-xl border px-4 py-3 text-left transition', on ? 'border-brand-500 bg-brand-50/60' : 'border-line bg-white hover:border-brand-300 hover:bg-brand-50/30')}>
      {icon && <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', on ? 'bg-brand-600 text-white' : 'bg-wash-2 text-ink-2')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold text-ink">{label}</span>
        {hint && <span className="block truncate text-[0.8125rem] text-muted">{hint}</span>}
      </span>
      {on ? <Check className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={3} /> : <ChevronRight className="h-4 w-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink-2" />}
    </button>
  )
}

function Pick({ on, onClick, children, wide }: { on: boolean; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button onClick={onClick} className={cn('inline-flex h-11 items-center rounded-xl border px-4 text-[0.90625rem] font-semibold transition', wide && 'w-full justify-start', on ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100' : 'border-line bg-white text-ink-2 hover:border-brand-300 hover:bg-brand-50/40')}>
      {on && <Check className="mr-1.5 h-4 w-4" strokeWidth={3} />}
      {children}
    </button>
  )
}
