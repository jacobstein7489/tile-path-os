/* Estimates — where every project starts. Six words for where one stands: New request · Estimating · Pending approval ·
 * Revision needed · Approved · Lost. Inside "Estimating" it goes Takeoff → Office review → Final review, then to the client. Whose turn it is lives on the estimate, so nobody's tasks change hands; review notes are pinned
 * to the room they're about and go back as a checklist. Approved, it becomes a project. */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { Mail, Plus, Trash2, Send, Check, X, Inbox, FileText, FileClock, FileCheck2, FileX2, CalendarDays, Building2, UserRound, Ruler, ClipboardCheck, BadgeCheck, Undo2, MessageSquarePlus, Sparkles, StickyNote, ArrowRight, Upload, Printer, MoreHorizontal, Layers } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Chip, Field, UnderlineTabs } from '@/tileos/components/ui/core'
import { RevisionsPanel } from './revisions'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop, Tip, DatePresets } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Group, Row, Col, Meta, IconTile, EmptyState, Status, Path, Bubbles, STICKY_HEAD } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type PersonKey, type Tone } from '@/tileos/data/model'
import { CUSTOMERS, tileOf, tileLine } from '@/tileos/data/jobs'
import { EST_STATUS, EST_STEP, STEP_ORDER, curRev, revTotal, estAmount, teamOf, bucketOf, turnOf, holderOf, openNotes, type Estimate, type EstLine, type EstBucket, type EstNote, type EstTeam } from '@/tileos/data/estimates'
import { FLOORS, sortAreas } from '@/tileos/data/areas'
import { printNode } from '@/tileos/lib/print'
import { EstimatePaper } from './estpaper'
import { TeamSlots, SurfaceAdd } from './estnew'
import { ITEM_TYPE_LABEL } from '@/tileos/data/items'
import { estEditLines, newLine, estSend, estRevise, estLost, estFollowUp } from './flows2'
import { estStartTakeoff, estHandOff, estSendBack, estAddNote, estToggleNote, estRemoveNote, aiDraftFor, applyAiDraft, plansUploaded, estAddArea, estAddSurface, estSetArea, estRemoveArea, setEstTeam, companyAreas, companySurfaces, EST_PEOPLE } from './estflow'
import { jobMoney } from './job/money-tab'
import { ActivityRow } from './activity'

const OPEN_B: EstBucket[] = ['request', 'takeoff', 'review', 'final', 'sent']
const ownerish = (s: Store) => s.role === 'owner' || s.role === 'pm'
const B_TONE: Record<EstBucket, Tone> = { request: 'neutral', takeoff: 'info', review: 'vio', final: 'warn', sent: 'info', approved: 'ok', lost: 'neutral' }
const B_ICON: Record<EstBucket, React.ReactNode> = { request: <Inbox />, takeoff: <Ruler />, review: <ClipboardCheck />, final: <BadgeCheck />, sent: <FileClock />, approved: <FileCheck2 />, lost: <FileX2 /> }

/* the six statuses everyone sees */
export type EstCat = 'request' | 'estimating' | 'revision' | 'sent' | 'approved' | 'lost'
const OPEN_C: EstCat[] = ['request', 'estimating', 'revision', 'sent']
export const catOf = (e: Estimate): EstCat => e.status
export const CAT: Record<EstCat, { label: string; tone: Tone; icon: React.ReactNode }> = {
  request: { label: 'New request', tone: 'neutral', icon: <Inbox /> },
  estimating: { label: 'Estimating', tone: 'info', icon: <Ruler /> },
  revision: { label: 'Revision needed', tone: 'warn', icon: <Undo2 /> },
  sent: { label: 'Pending approval', tone: 'vio', icon: <FileClock /> },
  approved: { label: 'Approved', tone: 'ok', icon: <FileCheck2 /> },
  lost: { label: 'Lost', tone: 'neutral', icon: <FileX2 /> },
}
const STEP_RANK = (e: Estimate) => ['takeoff', 'review', 'final'].indexOf(bucketOf(e))
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function nextOf(s: Store, e: Estimate): { text: string; tone?: 'bad' | 'warn' } {
  const p = s.pricing[e.jobId]
  const missing = p?.docs.filter((d) => d.status === 'missing').map((d) => d.name.toLowerCase()) || []
  const b = bucketOf(e)
  const notes = openNotes(e).length
  if (b === 'request') return missing.length ? { text: `Waiting for the ${missing.join(' and ')}`, tone: 'warn' } : { text: aiDraftFor(e.jobId) ? 'Plans are in — start the takeoff' : 'Start the takeoff' }
  if (b === 'takeoff') {
    if (e.backTo) return { text: `Fix ${plural(notes, 'note')} — back to ${PEOPLE[teamOf(e)[e.backTo]].short}`, tone: 'warn' }
    if (p?.takeoff?.question) return { text: `Waiting on the ${p.takeoff.question.waitingOn.toLowerCase()}`, tone: 'warn' }
    return { text: curRev(e).lines.length ? (notes ? `${plural(notes, 'thing')} to check` : 'Finish — ready for review') : 'Start the takeoff' }
  }
  if (b === 'review') return { text: 'Check the takeoff' }
  if (b === 'final') return { text: 'Approve and send' }
  if (b === 'sent') return { text: `Follow up ${e.followUp || 'Thu'}`, tone: e.followUp === 'Today' ? 'warn' : undefined }
  if (b === 'approved') return { text: 'Project' }
  return { text: '—' }
}
const whenOf = (e: Estimate) => {
  const sent = [...e.revs].reverse().find((r) => r.sentOn)
  if (e.status === 'approved') return `Approved ${e.approvedOn}`
  if (e.status === 'sent' && sent) return `Sent ${sent.sentOn}`
  if (e.status === 'lost') return 'Lost'
  return e.due ? `Due ${e.due}` : '—'
}

type EstView = 'open' | EstCat
export function EstimatesPage() {
  const s = useStore()
  const q0 = s.route.q?.status as string | undefined
  const [view, setView] = React.useState<EstView>((q0 as EstView) || 'open')
  const [client, setClient] = React.useState('all')
  const [who, setWho] = React.useState('all')
  const [q, setQ] = React.useState('')
  const list = s.estimates.filter((e) => s.jobs[e.jobId])
  const turn = (e: Estimate) => holderOf(e)
  const match = (e: Estimate) => {
    const j = s.jobs[e.jobId]
    return (client === 'all' || j.clientId === client) && (who === 'all' || turn(e) === who) && (!q || `${e.id} ${j.name} ${j.client}`.toLowerCase().includes(q.toLowerCase()))
  }
  const of = (c: EstCat) => list.filter((e) => catOf(e) === c)
  const open = list.filter((e) => OPEN_C.includes(catOf(e)) && match(e))
  const shown = view === 'open' ? open : list.filter((e) => catOf(e) === view && match(e)).sort((a, b) => b.id.localeCompare(a.id))
  const lostOld = view === 'lost' ? s.lost.filter((l) => !shown.some((e) => s.jobs[e.jobId]?.name === l.name) && (!q || l.name.toLowerCase().includes(q.toLowerCase()))) : []
  const pipeline = of('sent').reduce((n, e) => n + estAmount(e), 0)
  const clients = Array.from(new Set(list.map((e) => s.jobs[e.jobId].clientId))).map((id) => ({ key: id, label: CUSTOMERS[id]?.name || s.jobs[list.find((e) => s.jobs[e.jobId].clientId === id)!.jobId].client }))
  const pick = (v: EstView) => () => setView(view === v ? 'open' : v)
  const me = meOf(s.role)
  const mine = of('estimating').concat(of('revision')).filter((e) => turnOf(e) === me).length
  return (
    <Page
      title="Estimates"
      sub={<><span className="font-semibold text-ink">{fmtMoney(pipeline)}</span> pending approval{smp(' · sample amounts')}</>}
      actions={<Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newreq' })}>New estimate</Button>}
      top={
        <Bubbles
          arrows
          items={[
            { key: 'request', label: CAT.request.label, count: of('request').length, icon: CAT.request.icon, color: 'violet', on: view === 'request', onClick: pick('request') },
            { key: 'estimating', label: CAT.estimating.label, count: of('estimating').length, sub: mine ? `${mine} your turn` : undefined, icon: CAT.estimating.icon, color: 'blue', on: view === 'estimating', onClick: pick('estimating') },
            { key: 'sent', label: CAT.sent.label, count: of('sent').length, sub: pipeline ? fmtMoney(pipeline) : undefined, icon: CAT.sent.icon, color: 'cyan', on: view === 'sent', onClick: pick('sent') },
            { key: 'revision', label: CAT.revision.label, count: of('revision').length, icon: CAT.revision.icon, color: 'amber', on: view === 'revision', onClick: pick('revision') },
            { key: 'approved', label: CAT.approved.label, count: of('approved').length, icon: CAT.approved.icon, color: 'green', on: view === 'approved', onClick: pick('approved'), gapBefore: true },
            { key: 'lost', label: CAT.lost.label, count: of('lost').length + s.lost.length, icon: CAT.lost.icon, color: 'slate', on: view === 'lost', onClick: pick('lost'), plainBefore: true },
          ]}
        />
      }
      toolbar={
        <>
          {view !== 'open' ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-brand-600 bg-brand-50 pl-3.5 pr-1.5 text-[0.84375rem] font-semibold text-brand-700">
              {CAT[view].label} <span className="text-brand-600">{shown.length + lostOld.length}</span>
              <button onClick={() => setView('open')} aria-label="Show open estimates" className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-100">×</button>
            </span>
          ) : (
            <span className="text-[0.9375rem] font-semibold text-ink">Open estimates <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{open.length}</span></span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Filter icon={<Building2 />} label="Client" value={client} options={clients} onChange={setClient} width={280} />
            <Filter icon={<UserRound />} label="Who has it" value={who} options={EST_PEOPLE.map((p) => ({ key: p, label: PEOPLE[p].name, hint: PEOPLE[p].roleLabel }))} onChange={setWho} />
            <ClearFilters show={client !== 'all' || who !== 'all' || !!q} onClear={() => { setClient('all'); setWho('all'); setQ('') }} />
            <ToolbarSearch value={q} onChange={setQ} placeholder="Search estimates" />
          </div>
        </>
      }
    >
      <div>
        {(shown.length > 0 || lostOld.length > 0) && <EstHead />}
        {view === 'open' &&
          (['request', 'estimating', 'sent', 'revision'] as EstCat[]).map((k) => {
            const rows = open.filter((e) => catOf(e) === k).sort((a, b) => STEP_RANK(a) - STEP_RANK(b))
            if (!rows.length) return null
            return (
              <section key={k}>
                <Group label={CAT[k].label} count={rows.length} tone={CAT[k].tone} right={k === 'sent' ? <span className="text-[0.8125rem] font-semibold tnum text-muted">{fmtMoney(rows.reduce((n, e) => n + estAmount(e), 0))}</span> : undefined} />
                {rows.map((e) => <EstRow key={e.id} e={e} />)}
              </section>
            )
          })}
        {view !== 'open' && shown.map((e) => <EstRow key={e.id} e={e} />)}
        {lostOld.map((l) => (
          <div key={l.name} className={cn('min-h-[3.75rem] border-b border-line-2 py-2.5 opacity-70', EST_COLS, 'px-5 max-sm:px-4')}>
            <div className="min-w-0"><div className="truncate text-[0.90625rem] font-semibold text-ink">{l.name}</div><div className="truncate text-[0.78125rem] text-muted">{l.client}</div></div>
            <div><Status tone="neutral">Lost</Status></div>
            <div className="min-w-0 max-lg:hidden"><span className="line-clamp-2 text-[0.8125rem] text-muted">{l.reason}</span></div>
            <div className="text-[0.8125rem] text-ink-2 max-lg:hidden">Lost {l.date}</div>
            <div className="text-right text-faint max-xl:hidden">—</div>
          </div>
        ))}
        {!shown.length && !lostOld.length && (list.length
          ? <EmptyState title="No estimates here" sub="Try another filter." />
          : <EmptyState icon={<FileText />} title="No estimates yet" sub="A new estimate goes straight to whoever does the takeoff — areas, surfaces and your prices fill in by themselves." action={<Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newreq' })}>New estimate</Button>} />)}
      </div>
    </Page>
  )
}

/* Estimate · Status · Who has it · Date · Amount — the same columns, spacing and header as Projects */
const EST_COLS = 'grid grid-cols-[minmax(0,1.25fr)_12.5rem_minmax(0,1.25fr)_8rem_7.5rem] items-center gap-6 max-xl:grid-cols-[minmax(0,1.2fr)_11.875rem_minmax(0,1.2fr)_7.5rem] max-lg:grid-cols-[minmax(0,1fr)_11.25rem] max-md:grid-cols-1 max-md:gap-1.5'
function EstHead() {
  return (
    <div className={cn('border-b border-line-2 bg-wash py-2 text-[0.75rem] font-semibold text-muted max-md:hidden', EST_COLS, 'px-5 max-sm:px-4', STICKY_HEAD)}>
      <span>Estimate</span>
      <span>Status</span>
      <span className="max-lg:hidden">Who has it</span>
      <span className="max-lg:hidden">Date</span>
      <span className="text-right max-xl:hidden">Amount</span>
    </div>
  )
}

function EstRow({ e }: { e: Estimate }) {
  const s = useStore()
  const j = s.jobs[e.jobId]
  const b = bucketOf(e)
  /* inside the company the number that matters is the one being checked */
  const amt = b === 'takeoff' || b === 'review' || b === 'final' ? revTotal(curRev(e)) : estAmount(e)
  const nx = nextOf(s, e)
  const rev = curRev(e).n
  const c = catOf(e)
  const step = b === 'takeoff' || b === 'review' || b === 'final' ? EST_STEP[b].label : ''
  const turn = holderOf(e)
  const date = whenOf(e)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => s.open({ t: 'estimate', id: e.id })}
      onKeyDown={(ev) => { if (ev.key === 'Enter') s.open({ t: 'estimate', id: e.id }) }}
      className={cn('min-h-[3.75rem] cursor-pointer border-b border-line-2 py-2.5 transition-colors hover:bg-[#f7f8fa] focus-visible:bg-[#f7f8fa] focus-visible:outline-none', EST_COLS, 'px-5 max-sm:px-4', c === 'lost' && 'opacity-70')}
    >
      <div className="min-w-0">
        <div className="truncate text-[0.90625rem] font-semibold text-ink">{j.name}</div>
        <div className="truncate text-[0.78125rem] text-muted"><span className="tnum">{e.id}</span> · {j.client}<span className="md:hidden">{amt ? ` · ${fmtMoney(amt)}` : ''}</span></div>
      </div>
      <div className="min-w-0 max-md:flex max-md:items-center max-md:gap-2">
        <Status tone={CAT[c].tone}>{CAT[c].label}</Status>
        {(step || (rev > 1 && OPEN_C.includes(c) && c !== 'request')) && <div className="mt-1 truncate pl-1 text-[0.75rem] font-medium text-muted max-md:mt-0">{[step, rev > 1 && OPEN_C.includes(c) && c !== 'request' ? `Revision ${rev}` : ''].filter(Boolean).join(' · ')}</div>}
      </div>
      <div className="min-w-0 max-lg:hidden">
        {turn ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar who={turn} size={28} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[0.84375rem] font-medium text-ink">{PEOPLE[turn].short}{e.since && (b === 'takeoff' || b === 'review' || b === 'final') && <span className="font-normal text-muted"> · since {e.since}</span>}</span>
              <span className={cn('block truncate text-[0.78125rem]', nx.tone === 'warn' ? 'font-medium text-warn-700' : 'text-muted')}>{nx.text}</span>
            </span>
          </span>
        ) : <span className="truncate text-[0.8125rem] text-muted">{nx.text}</span>}
      </div>
      <div className={cn('truncate text-[0.8125rem] max-lg:hidden', /Today|late/.test(date) ? 'font-semibold text-warn-700' : 'text-ink-2')}>{date}</div>
      <div className="text-right max-xl:hidden">
        <span className={cn('text-[0.90625rem] font-semibold tnum', amt ? 'text-ink' : 'font-normal text-faint')}>{amt ? fmtMoney(amt) : '—'}</span>
        {e.status === 'approved' && (() => {
          const jm = jobMoney(j)
          return <span className="mt-0.5 block text-[0.71875rem] font-medium tnum text-muted">{jm.billedPct}% invoiced</span>
        })()}
      </div>
    </div>
  )
}

/* ================= one estimate ================= */
export function EstimateModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const e = s.estimates.find((x) => x.id === id)
  const [revN, setRevN] = React.useState<number | null>(null)
  const [view, setView] = React.useState<'lines' | 'paper' | 'revs'>('lines')
  const paperRef = React.useRef<HTMLDivElement>(null)
  const [newArea, setNewArea] = React.useState('')
  const [noteAt, setNoteAt] = React.useState<string | null>(null)
  const [takeoffBy, setTakeoffBy] = React.useState<PersonKey>(() => { const x = s.estimates.find((y) => y.id === id); return x ? teamOf(x).takeoff : 'takeoff' })
  const [reviseOpen, setReviseOpen] = React.useState(false)
  const [reviseWhat, setReviseWhat] = React.useState('')
  const [lostOpen, setLostOpen] = React.useState(false)
  const [fuOpen, setFuOpen] = React.useState(false)
  if (!e) return null
  const j = s.jobs[e.jobId]
  if (!j) return null
  const cur = curRev(e)
  const shown = e.revs.find((r) => r.n === (revN ?? cur.n)) || cur
  const editable = shown === cur && cur.status === 'draft' && ['request', 'estimating', 'revision'].includes(e.status)
  const areas = sortAreas(Array.from(new Set([...(shown.areas || []).map((a) => a.name), ...shown.lines.map((l) => l.area)])).map((n) => ({ name: n, floor: shown.areas?.find((x) => x.name === n)?.floor }))).map((a) => a.name)
  const metaOf = (a: string) => shown.areas?.find((x) => x.name === a)
  const itemOf = (l: EstLine) => s.items.find((i) => i.id === l.itemId)
  const sum = (t: string) => shown.lines.filter((l) => (itemOf(l)?.type || 'other') === t).reduce((n, l) => n + l.qty * l.rate, 0)
  const total = revTotal(shown)
  const sent = [...e.revs].reverse().find((r) => r.sentOn)
  const st = e.status
  const b = bucketOf(e)
  const team = teamOf(e)
  const turn = turnOf(e)
  const inside = b === 'takeoff' || b === 'review' || b === 'final'
  const notes = (e.notes || []).filter((n) => n.rev === shown.n)
  const open = openNotes(e)
  const ai = aiDraftFor(e.jobId)
  const canNote = shown === cur && inside
  const me = meOf(s.role)
  /* everyone acts for themselves; the owner can act for anyone */
  const canAct = ownerish(s) || (b === 'request' ? s.role === 'office' : turn === me)

  const order: EstBucket[] = ['request', 'takeoff', 'review', 'final', 'sent', 'approved']
  const at = b === 'lost' ? 5 : order.indexOf(b)
  const state = (i: number) => (i < at ? 'done' : i === at ? (b === 'lost' ? 'blocked' : 'current') : 'future') as 'done' | 'current' | 'future' | 'blocked'
  const path = [
    { key: 'request', label: 'Request', sub: e.log[0]?.date },
    { key: 'takeoff', label: cur.n > 1 && inside ? `Takeoff · Rev ${cur.n}` : 'Takeoff', sub: PEOPLE[team.takeoff].name },
    { key: 'review', label: 'Office review', sub: PEOPLE[team.review].name },
    { key: 'final', label: 'Final review', sub: PEOPLE[team.final].name },
    { key: 'sent', label: 'Sent · follow-up', sub: PEOPLE[team.follow].name },
    { key: 'approved', label: b === 'lost' ? 'Lost' : 'Approved', sub: st === 'approved' ? e.approvedOn : undefined },
  ].map((p, i) => ({ ...p, state: state(i) }))

  const header = (
    <div className="border-b border-line px-6 pb-5 pt-5 pr-16 max-sm:pl-4 max-sm:pr-14">
      <div className="flex items-start justify-between gap-6 max-md:flex-col max-md:gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] tnum text-muted">
            <span>Estimate {e.id}{cur.n > 1 ? ` · Revision ${cur.n}${cur.what ? ` — ${cur.what}` : ''}` : ''}</span>
            <Status tone={CAT[catOf(e)].tone}>{CAT[catOf(e)].label}{inside ? ` · ${EST_STEP[b as 'takeoff'].label}` : ''}</Status>
          </div>
          <h2 className="font-display mt-0.5 text-[1.5625rem] font-semibold leading-tight tracking-[-0.012em] text-ink max-sm:text-[1.375rem]">{j.name}</h2>
          <div className="mt-1 text-[0.875rem] text-muted">
            <button onClick={() => s.open({ t: 'customer', id: j.clientId })} className="text-ink-2 hover:text-brand-700">{j.client}</button> · {j.address}
          </div>
        </div>
        <div className="shrink-0 text-right max-md:text-left">
          <div className="text-[0.8125rem] text-muted">{st === 'approved' ? 'Approved' : shown.status === 'draft' ? 'Draft total' : 'Total'}</div>
          <div className="text-[1.625rem] font-semibold leading-tight tnum text-ink">{shown.lines.length ? fmtMoney(total) : '—'}</div>
          {smp('x') && <div className="text-[0.75rem] text-faint">Sample amounts</div>}
          {st === 'approved' && (() => {
            const jm = jobMoney(j)
            return (
              <button onClick={() => s.swap({ t: 'job', id: e.jobId, tab: 'money' })} className="mt-2 block w-[13.75rem] rounded-xl border border-line px-3 py-2 text-left transition hover:border-brand-300">
                <span className="flex items-baseline justify-between text-[0.75rem]"><span className="font-semibold text-ink">Invoiced</span><span className="tnum text-muted"><b className="text-ink">{fmtMoney(jm.invoiced)}</b> · {jm.billedPct}%</span></span>
                <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-wash-2"><span className="h-full bg-ok-500" style={{ width: `${jm.paidPct}%` }} /><span className="h-full bg-brand-400" style={{ width: `${Math.max(0, jm.billedPct - jm.paidPct)}%` }} /></span>
                <span className="mt-1 block text-[0.71875rem] text-muted">{fmtMoney(jm.paid)} paid · {fmtMoney(jm.contract - jm.invoiced)} left to invoice</span>
              </button>
            )
          })()}
          {shown.lines.length > 0 && <Button size="sm" className="mt-2" icon={<FileText />} onClick={() => s.open({ t: 'sow', jobId: e.jobId, estId: e.id })}>Scope of work</Button>}
        </div>
      </div>
      <Path className="mt-4" steps={path} />
    </div>
  )

  const waitText = turn ? `With ${PEOPLE[turn].name}${e.since ? ` · since ${e.since}` : ''}` : ''
  const noteCount = open.length
  const footer = (
    <>
      {st === 'request' && (
        <>
          <span className="text-[0.84375rem] text-muted max-sm:hidden">Takeoff by</span>
          <Menu align="start" width={260} trigger={<Button icon={<Avatar who={takeoffBy} size={18} />}>{PEOPLE[takeoffBy].name}</Button>}>
            <MenuLabel>Who does the takeoff?</MenuLabel>
            {(['takeoff', 'estimator', 'ys'] as PersonKey[]).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={takeoffBy === p} hint={PEOPLE[p].roleLabel} onSelect={() => setTakeoffBy(p)}>{PEOPLE[p].name}</MenuItem>)}
          </Menu>
          {ai && <Button className="ml-auto" icon={<Sparkles />} onClick={() => s.open({ t: 'aiplans', estId: e.id })}>Draft it from the plans</Button>}
          <Button className={cn(!ai && 'ml-auto')} variant="primary" icon={<ArrowRight />} onClick={() => estStartTakeoff(e.id, takeoffBy)}>Start the takeoff</Button>
        </>
      )}
      {inside && !canAct && <span className="inline-flex items-center gap-2 text-[0.84375rem] text-muted">{turn && <Avatar who={turn} size={22} />}{waitText}</span>}
      {b === 'takeoff' && canAct && (
        <>
          <span className="inline-flex min-w-0 items-center gap-2 text-[0.84375rem] text-muted">
            <Avatar who={team.takeoff} size={22} />
            {noteCount ? <span className="font-medium text-warn-700">{plural(noteCount, 'note')} to check off</span> : cur.lines.length ? `${cur.lines.length} lines · ${fmtMoney(revTotal(cur))}` : 'Add the rooms and lines from your items.'}
          </span>
          <Tip label={!cur.lines.length ? 'Add the lines first' : noteCount ? 'Check off every note first' : `Goes to ${PEOPLE[team[e.backTo || 'review']].name}`}>
            <span className="ml-auto">
              <Button variant="primary" icon={<Send />} disabled={!cur.lines.length || noteCount > 0} onClick={() => estHandOff(e.id)}>{e.backTo ? `Fixed — back to ${PEOPLE[team[e.backTo]].short}` : 'Ready for review'}</Button>
            </span>
          </Tip>
        </>
      )}
      {(b === 'review' || b === 'final') && canAct && (
        <>
          <span className="inline-flex min-w-0 items-center gap-2 text-[0.84375rem] text-muted"><Avatar who={team[b]} size={22} />{noteCount ? `${plural(noteCount, 'note')} for ${PEOPLE[team.takeoff].short}` : b === 'review' ? 'Check it, add a note to any room' : 'Last look before it goes out'}</span>
          <Tip label={noteCount ? `Goes back to ${PEOPLE[team.takeoff].name} with the notes` : 'Add a note to a room first'}>
            <span className="ml-auto"><Button icon={<Undo2 />} disabled={!noteCount} onClick={() => estSendBack(e.id)}>Send back{noteCount ? ` · ${plural(noteCount, 'note')}` : ''}</Button></span>
          </Tip>
          {b === 'review' ? (
            <Button variant="primary" icon={<Check />} disabled={noteCount > 0} onClick={() => estHandOff(e.id)}>Looks good — to {PEOPLE[team.final].short}</Button>
          ) : (
            <>
              <Button icon={<Mail />} onClick={() => s.open({ t: 'email', what: { kind: 'estimate', id: e.id } })}>What the client gets</Button>
              <Button variant="primary" icon={<Send />} disabled={noteCount > 0} onClick={() => estHandOff(e.id)}>Approve and send to the client</Button>
            </>
          )}
        </>
      )}
      {st === 'sent' && (
        <>
          <Pop open={lostOpen} onOpenChange={setLostOpen} side="top" width={320} trigger={<Button variant="ghost">Not proceeding</Button>}>
            <div className="text-[0.875rem] font-medium text-ink">Why didn’t it go ahead?</div>
            <div className="mt-3 flex flex-col gap-1.5">
              {['Went with another installer', 'Price too high', 'Project cancelled', 'No answer'].map((r) => (
                <button key={r} onClick={() => { setLostOpen(false); estLost(e.id, r); s.close() }} className="rounded-md px-2.5 py-2 text-left text-[0.875rem] text-ink-2 hover:bg-wash-2">{r}</button>
              ))}
            </div>
          </Pop>
          <Pop open={fuOpen} onOpenChange={setFuOpen} side="top" width={360} trigger={<Button>Log a follow-up</Button>}>
            <FollowUpForm onSave={(o) => { setFuOpen(false); estFollowUp(e.id, o) }} />
          </Pop>
          <Pop open={reviseOpen} onOpenChange={setReviseOpen} side="top" width={360} trigger={<Button>Client wants changes</Button>}>
            <div className="text-[0.875rem] font-medium text-ink">What do they want changed?</div>
            <TextInput className="mt-3" data-autofocus value={reviseWhat} onChange={(x) => setReviseWhat(x.target.value)} placeholder="e.g. Remove the basement bath" />
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setReviseOpen(false)}>Cancel</Button>
              <Button size="sm" variant="primary" disabled={!reviseWhat.trim()} onClick={() => { setReviseOpen(false); estRevise(e.id, reviseWhat.trim()); setReviseWhat(''); setRevN(null) }}>Start revision {cur.n + 1}</Button>
            </div>
          </Pop>
          <Button className="ml-auto" variant="ghost" icon={<Mail />} onClick={() => s.open({ t: 'email', what: { kind: 'estimate', id: e.id } })}>What they got</Button>
          <Button variant="primary" icon={<Check />} onClick={() => s.open({ t: 'award', jobId: e.jobId })}>Approved — make it a project</Button>
        </>
      )}
      {st === 'approved' && (
        <>
          <span className="text-[0.84375rem] text-muted">Approved {e.approvedOn}. Its rooms and quantities are in the project’s scope.</span>
          <Button className="ml-auto" variant="primary" onClick={() => { s.close(); s.open({ t: 'job', id: e.jobId }) }}>Open the project</Button>
        </>
      )}
      {st === 'lost' && <span className="text-[0.84375rem] text-muted">Marked lost and kept here for the record.</span>}
    </>
  )

  const general = notes.filter((n) => !n.area)
  return (
    <Modal level={level} size="xl" tall onClose={s.close} title={`${e.id} · ${j.name}`} header={header} footer={footer} bodyClass="p-0">
      <div className="grid min-h-full grid-cols-[1fr_18.75rem] max-lg:grid-cols-1">
        {/* the lines, with the review notes pinned to their rooms */}
        <div className="min-w-0 border-r border-line px-6 py-5 max-lg:border-r-0 max-sm:px-4">
          <UnderlineTabs size="sm" className="-mt-2 mb-4" value={view} onChange={setView} items={[{ key: 'lines' as const, label: e.revs.length > 1 ? `Lines · revision ${shown.n}` : 'Lines' }, { key: 'paper' as const, label: 'Estimate paper' }, ...(e.revs.length > 1 ? [{ key: 'revs' as const, label: 'Revisions', count: e.revs.length }] : [])]} />
          {view === 'paper' ? (
            <div className="-mx-6 -mb-5 bg-wash px-6 pb-6 pt-4 max-sm:-mx-4 max-sm:px-2">
              <div className="mx-auto mb-3 flex max-w-[48.75rem] flex-wrap items-center gap-2">
                <span className="text-[0.8125rem] text-muted">What {j.client} gets{e.revs.length > 1 ? ` · revision ${shown.n}` : ''} — laid out like our scope of work</span>
                <Button size="sm" className="ml-auto" icon={<Printer />} onClick={() => printNode(paperRef.current)}>Print or save PDF</Button>
              </div>
              <EstimatePaper e={e} rev={shown} innerRef={paperRef} />
            </div>
          ) : view === 'revs' && e.revs.length > 1 ? <RevisionsPanel e={e} onShow={(n) => { setRevN(n); setView('lines') }} /> : <>
          {e.revs.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {e.revs.map((r) => (
                <Chip key={r.n} on={shown.n === r.n} onClick={() => setRevN(r.n)} className="h-8 px-2.5 text-[0.8125rem]">
                  {r.n} <span className="font-normal text-muted">· {r.status === 'draft' ? 'draft' : r.status === 'superseded' ? 'replaced' : r.status}</span>
                </Chip>
              ))}
              <span className="min-w-0 truncate text-[0.8125rem] text-muted">{shown.what}</span>
            </div>
          )}
          {shown === cur && (st === 'request' || editable) && !shown.lines.some((l) => l.qty > 1) && <AiCard e={e} filled={shown.lines.length > 0} />}
          {!shown.lines.length && !editable && <div className="py-10 text-center text-[0.875rem] text-muted">No lines on this revision.</div>}
          {(general.length > 0 || (canNote && noteAt === '')) && (
            <div className="mb-3 overflow-hidden rounded-xl border border-line">
              {general.map((n) => <NoteRow key={n.id} e={e} n={n} />)}
              {noteAt === '' && <AddNote e={e} onDone={() => setNoteAt(null)} />}
            </div>
          )}
          {(shown.lines.length > 0 || (editable && !(ai && st === 'request'))) && (
            <div>
              {canNote && noteAt !== '' && (
                <div className="mb-2 flex justify-end">
                  <button onClick={() => setNoteAt('')} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-warn-700 hover:text-ink"><MessageSquarePlus className="h-4 w-4" />Add a note</button>
                </div>
              )}
              <div className="overflow-hidden rounded-xl border border-line">
                <div className={cn(LINE_GRID, 'h-10 border-b border-line bg-wash px-3 text-[0.75rem] font-semibold text-muted max-sm:hidden')}>
                  <span>Scope · {shown.lines.length} lines</span>
                  <span className="text-right">Qty</span>
                  <span className="pl-2">Unit</span>
                  <span className="text-right">Rate</span>
                  <span className="text-right">Amount</span>
                  <span />
                </div>
                {areas.map((a) => {
                  const ls = shown.lines.filter((l) => l.area === a)
                  const pinned = notes.filter((n) => n.area === a)
                  return (
                    <section key={a}>
                      <div className="group/area flex items-center justify-between gap-3 border-b border-line-2 bg-[#fafbfc] px-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          {metaOf(a)?.floor && <span className="shrink-0 rounded-md bg-ink px-1.5 py-[0.0625rem] text-[0.6875rem] font-semibold text-white">{metaOf(a)!.floor}</span>}
                          <span className="truncate text-[0.84375rem] font-semibold text-ink">{a}</span>
                          {metaOf(a)?.note && <span className="truncate text-[0.78125rem] text-muted">| {metaOf(a)!.note}</span>}
                          {editable && <AreaMenu e={e} area={a} />}
                        </span>
                        <span className="flex items-center gap-3">
                          {canNote && <button onClick={() => setNoteAt(a)} aria-label={`Add a note on ${a}`} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.75rem] font-semibold text-warn-700 opacity-70 transition hover:bg-warn-50 hover:opacity-100 sm:opacity-0 sm:group-hover/area:opacity-100"><MessageSquarePlus className="h-3.5 w-3.5" />Note</button>}
                          <span className={cn('text-[0.8125rem] font-semibold tnum text-ink-2', editable && 'sm:pr-9')}>{fmtMoney(ls.reduce((n, l) => n + l.qty * l.rate, 0))}</span>
                        </span>
                      </div>
                      {pinned.map((n) => <NoteRow key={n.id} e={e} n={n} />)}
                      {noteAt === a && <AddNote e={e} area={a} onDone={() => setNoteAt(null)} />}
                      {ls.map((l) => <LineRow key={l.id} e={e} l={l} editable={editable} />)}
                      {!ls.length && <div className="border-b border-line-2 px-3 py-2 text-[0.8125rem] text-muted">No tile here yet — add a surface</div>}
                      {editable && (
                        <div className="flex flex-wrap items-center gap-1.5 border-b border-line-2 px-3 py-1.5">
                          <SurfaceAdd have={companySurfaces(s).filter((x) => ls.some((l) => l.surface === x.label)).map((x) => x.key)} onAdd={(k) => estAddSurface(e.id, a, k)} />
                          <ItemPicker label="Item" onPick={(it) => estEditLines(e.id, (L) => [...L, newLine(a, it.id, it.unit === 'LS' ? 1 : 100, it.price)])} />
                        </div>
                      )}
                    </section>
                  )
                })}
                {!areas.length && <div className="px-3 py-6 text-center text-[0.84375rem] text-muted">No areas yet — add the first room below.</div>}
              </div>
              {editable && <AreaAdder e={e} />}
            </div>
          )}
          {shown.lines.length > 0 && (
            <dl className="ml-auto mt-5 w-full max-w-[18.75rem] text-[0.875rem]">
              {(['labor', 'material', 'other'] as const).map((t) => sum(t) ? (
                <div key={t} className="flex justify-between py-1 text-ink-2"><dt>{t === 'other' ? 'Other' : ITEM_TYPE_LABEL[t]}</dt><dd className="tnum">{fmtMoney(sum(t))}</dd></div>
              ) : null)}
              <div className="mt-1 flex justify-between border-t border-line pt-2 text-[0.9375rem] font-semibold text-ink"><dt>Total</dt><dd className="tnum">{fmtMoney(total)}</dd></div>
            </dl>
          )}
          </>}
        </div>
        {/* who's on it, the notes, and what happened */}
        <aside className="px-6 py-5 max-sm:px-4">
          {notes.length > 0 && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-wash px-3 py-2.5 text-[0.8125rem] text-ink-2">
              <StickyNote className="h-4 w-4 text-warn-600" />
              <span><b className="font-semibold text-ink">{notes.filter((n) => n.done).length} of {notes.length}</b> notes checked off</span>
            </div>
          )}
          <div className="mb-4">
            <div className="mb-2 flex items-baseline justify-between"><span className="text-[0.8125rem] font-medium text-muted">Who does what</span>{e.since && inside && <span className="text-[0.75rem] text-faint">this step since {e.since}</span>}</div>
            <TeamSlots compact team={team} now={inside ? (b as keyof EstTeam) : b === 'sent' ? 'follow' : null} onChange={(ownerish(s) || s.role === 'office') && !['approved', 'lost'].includes(st) ? (k, p) => setEstTeam(e.id, k, p) : undefined} />
          </div>
          <dl className="text-[0.84375rem]">
            <Prop label="Client"><button onClick={() => s.open({ t: 'customer', id: j.clientId })} className="font-medium text-brand-700 hover:underline">{j.client}</button></Prop>
            {e.due && ['request', 'estimating', 'revision'].includes(st) && <Prop label="Due">{e.due}</Prop>}
            {sent && <Prop label="Sent">{sent.sentOn} · revision {sent.n}</Prop>}
            {st === 'sent' && <Prop label="Follow up"><span className={cn(e.followUp === 'Today' && 'font-medium text-warn-700')}>{PEOPLE[team.follow].short} · {e.followUp || 'Thu'}</span></Prop>}
            {s.pricing[e.jobId]?.docs && (
              <Prop label="Documents">
                <span className="flex flex-col gap-0.5">
                  {s.pricing[e.jobId].docs.map((d) => <span key={d.name} className={d.status === 'missing' ? 'text-warn-700' : 'text-ink-2'}>{d.name}{d.status === 'missing' ? ' — missing' : ''}</span>)}
                </span>
              </Prop>
            )}
          </dl>
          <div className="mt-6 text-[0.8125rem] font-medium text-muted">Activity</div>
          <div className="-mx-2 mt-1">
            {[...e.log].reverse().map((l, i) => <ActivityRow key={i} jobId={e.jobId} compact e={{ date: l.date, who: l.who, kind: 'pricing', title: l.text, ref: { t: 'estimate', id: e.id } }} />)}
          </div>
        </aside>
      </div>
    </Modal>
  )
}

/* ---------------- areas: floor, the note on the paper, remove ---------------- */
function AreaMenu({ e, area }: { e: Estimate; area: string }) {
  const meta = curRev(e).areas?.find((x) => x.name === area)
  const [open, setOpen] = React.useState(false)
  const [note, setNote] = React.useState(meta?.note || '')
  React.useEffect(() => { if (open) setNote(meta?.note || '') }, [open])
  return (
    <Pop open={open} onOpenChange={setOpen} width={310} trigger={<button type="button" aria-label={`${area} — floor and details`} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-faint transition hover:bg-wash-2 hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>}>
      <div className="text-[0.78125rem] font-semibold text-muted">Floor</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {['', ...FLOORS].map((f) => <button key={f || 'none'} type="button" onClick={() => estSetArea(e.id, area, { floor: f || null })} className={cn('inline-flex h-7 items-center rounded-full border px-2.5 text-[0.78125rem] font-semibold', (meta?.floor || '') === f ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-[#c3c9d2]')}>{f || 'No floor'}</button>)}
      </div>
      <div className="mt-3 text-[0.78125rem] font-semibold text-muted">Next to the room on the paper</div>
      <form className="mt-1.5 flex gap-2" onSubmit={(x) => { x.preventDefault(); estSetArea(e.id, area, { note }); setOpen(false) }}>
        <TextInput value={note} onChange={(x) => setNote(x.target.value)} placeholder="e.g. 9.25′ ceiling; fully tiled" className="h-8 text-[0.8125rem]" />
        <Button size="sm" type="submit">Save</Button>
      </form>
      <button type="button" onClick={() => { setOpen(false); estRemoveArea(e.id, area) }} className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-bad-600 hover:text-bad-700"><Trash2 className="h-3.5 w-3.5" />Remove {area}</button>
    </Pop>
  )
}
function AreaAdder({ e }: { e: Estimate }) {
  const s = useStore()
  const [own, setOwn] = React.useState('')
  return (
    <div className="mt-4 rounded-[0.75rem] border border-dashed border-[#d3d8de] px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-2 text-[0.8125rem] font-semibold text-ink"><Layers className="h-4 w-4 text-muted" />Add an area<span className="font-normal text-muted">— it comes with its usual surfaces</span></div>
      <div className="flex flex-wrap gap-1.5">
        {companyAreas(s).map((p) => <button key={p.name} type="button" onClick={() => estAddArea(e.id, p.name, p.surfaces)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-white px-3 text-[0.8125rem] font-medium text-ink-2 transition hover:border-brand-300 hover:text-brand-700"><Plus className="h-3.5 w-3.5" />{p.name}</button>)}
        <form className="inline-flex" onSubmit={(x) => { x.preventDefault(); if (!own.trim()) return; estAddArea(e.id, own.trim(), ['floor']); setOwn('') }}>
          <input value={own} onChange={(x) => setOwn(x.target.value)} placeholder="Your own area…" aria-label="Your own area" className="h-8 w-[9.375rem] rounded-l-full border border-r-0 border-line bg-white px-3 text-[0.8125rem] text-ink placeholder:text-faint focus:border-brand-300 focus:outline-none" />
          <button type="submit" disabled={!own.trim()} className="inline-flex h-8 items-center rounded-r-full border border-line bg-wash px-2.5 text-[0.78125rem] font-semibold text-ink-2 disabled:text-faint">Add</button>
        </form>
      </div>
    </div>
  )
}

/* ---------------- review notes ---------------- */
function NoteRow({ e, n }: { e: Estimate; n: EstNote }) {
  const s = useStore()
  const isAi = n.step === 'ai'
  const mine = n.by === meOf(s.role)
  return (
    <div className={cn('flex items-start gap-2.5 border-b border-line-2 px-3 py-2', n.done ? 'bg-white' : isAi ? 'bg-vio-50/70' : 'bg-warn-50/80')}>
      <button
        aria-label={n.done ? 'Mark not done' : 'Check it off'}
        onClick={() => estToggleNote(e.id, n.id)}
        className={cn('mt-[0.0625rem] inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border-2 transition', n.done ? 'border-ok-500 bg-ok-500 text-white' : 'border-[#c6ccd4] bg-white text-transparent hover:border-ok-500 hover:text-ok-500')}
      >
        <Check className="h-3 w-3" strokeWidth={3.4} />
      </button>
      {isAi ? <Sparkles className="mt-[0.125rem] h-3.5 w-3.5 shrink-0 text-vio-600" /> : <StickyNote className="mt-[0.125rem] h-3.5 w-3.5 shrink-0 text-warn-600" />}
      <span className="min-w-0 flex-1 text-[0.84375rem] leading-snug">
        <span className={cn(n.done ? 'text-muted line-through' : 'text-ink')}>{n.text}</span>
        <span className="ml-2 whitespace-nowrap text-[0.75rem] text-muted">{isAi ? 'From the plans — check it' : `${PEOPLE[n.by].short} · ${n.date}`}</span>
      </span>
      {mine && !isAi && !n.done && (
        <button aria-label="Remove the note" onClick={() => estRemoveNote(e.id, n.id)} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-faint hover:bg-bad-50 hover:text-bad-600"><X className="h-3.5 w-3.5" /></button>
      )}
    </div>
  )
}
function AddNote({ e, area, onDone }: { e: Estimate; area?: string; onDone: () => void }) {
  const [t, setT] = React.useState('')
  return (
    <form
      onSubmit={(x) => {
        x.preventDefault()
        if (!t.trim()) return
        estAddNote(e.id, { area, text: t.trim() })
        setT('')
        onDone()
      }}
      className="flex items-center gap-2 border-b border-line-2 bg-warn-50/60 px-3 py-2"
    >
      <StickyNote className="h-4 w-4 shrink-0 text-warn-600" />
      <TextInput autoFocus value={t} onChange={(x) => setT(x.target.value)} placeholder={area ? `Note on ${area} — e.g. add the niche` : 'A note for the takeoff'} className="h-8 flex-1 bg-white" />
      <Button size="sm" variant="primary" type="submit" disabled={!t.trim()}>Add</Button>
      <Button size="sm" variant="ghost" type="button" onClick={onDone}>Cancel</Button>
    </form>
  )
}

/* ---------------- AI: start from the plans ---------------- */
function AiCard({ e, filled }: { e: Estimate; filled?: boolean }) {
  const s = useStore()
  const docs = s.pricing[e.jobId]?.docs || []
  const file = React.useRef<HTMLInputElement>(null)
  const hasPlans = docs.some((d) => d.name === 'Plans' && d.status === 'in')
  return (
    <div className="mb-4 overflow-hidden rounded-[0.875rem] border border-vio-100 bg-gradient-to-br from-[#f6f4ff] via-white to-[#f2f6ff] p-4">
      <div className="flex items-start gap-4 max-sm:flex-col">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-vio-600 shadow-xs ring-1 ring-vio-100"><Sparkles className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-semibold text-ink">{filled ? 'Fill in the square feet from the plans' : 'Draft the takeoff from the plans'}</div>
          <div className="mt-0.5 text-[0.8125rem] text-muted">{filled ? 'The areas are in — the plans give the rooms, surfaces, square feet and tile. Anything it had to guess is flagged.' : 'Rooms, surfaces, square feet and tile — anything it had to guess is flagged.'}</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {docs.map((d) => (
              <span key={d.name} className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.78125rem] font-medium', d.status === 'in' ? 'border-line bg-white text-ink-2' : 'border-warn-100 bg-warn-50 text-warn-700')}>
                {d.status === 'in' ? <Check className="h-3.5 w-3.5 text-ok-600" /> : <X className="h-3.5 w-3.5" />}{d.name}
              </span>
            ))}
          </div>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-2 max-sm:items-start">
          {hasPlans && <Button variant="primary" icon={<Sparkles />} onClick={() => s.open({ t: 'aiplans', estId: e.id })}>Read the plans</Button>}
          <button onClick={() => file.current?.click()} className={cn(hasPlans ? 'text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700' : 'inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-[0.875rem] font-semibold text-white hover:bg-brand-700')}>
            {hasPlans ? 'Upload newer plans' : <><Upload className="h-4 w-4" />Upload the plans</>}
          </button>
          <input ref={file} type="file" accept=".pdf,image/*" className="hidden" onChange={(x) => { const f = x.target.files?.[0]; if (!f) return; plansUploaded(e.jobId, f.name); setTimeout(() => s.open({ t: 'aiplans', estId: e.id }), 80); x.target.value = '' }} />
        </span>
      </div>
    </div>
  )
}

export function AiPlansModal({ estId, level }: { estId: string; level: number }) {
  const s = useStore()
  const e = s.estimates.find((x) => x.id === estId)
  const [phase, setPhase] = React.useState(0)
  React.useEffect(() => {
    if (phase >= 4) return
    const t = setTimeout(() => setPhase((p) => p + 1), phase === 0 ? 450 : 700)
    return () => clearTimeout(t)
  }, [phase])
  if (!e) return null
  const j = s.jobs[e.jobId]
  const d = aiDraftFor(e.jobId)
  if (!j || !d) return null
  const rooms = Array.from(new Set(d.rows.map((r) => r.room)))
  const floor = d.rows.filter((r) => /floor/i.test(r.surface) && r.unit === 'SF').reduce((n, r) => n + r.qty, 0)
  const wall = d.rows.filter((r) => !/floor|waterproof/i.test(r.surface) && r.unit === 'SF').reduce((n, r) => n + r.qty, 0)
  const flags = d.rows.filter((r) => r.flag).length + (d.general?.length || 0)
  const price = (id: string) => s.items.find((i) => i.id === id)?.price || 0
  const total = d.rows.reduce((n, r) => n + r.qty * price(r.itemId), 0) + d.extra.reduce((n, x) => n + x.qty * price(x.itemId), 0)
  const steps = [
    { label: 'Reading the plans', sub: d.found[0] },
    { label: 'Reading the finish schedule', sub: d.found[1] },
    { label: 'Reading the spec book', sub: d.found[2] },
    { label: 'Measuring every room', sub: `${rooms.length} rooms · ${d.rows.length} surfaces · ${floor.toLocaleString('en-US')} SF of floor · ${wall.toLocaleString('en-US')} SF of wall` },
  ]
  const ready = phase >= 4
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={ready ? 'Draft takeoff' : 'Reading the plans'}
      sub={`${j.name} · ${d.sheets.join(' · ')}`}
      footer={
        ready ? (
          <>
            <span className="text-[0.84375rem] text-muted">Priced from your items · <b className="font-semibold text-ink">{fmtMoney(total)}</b>{smp(' · sample amounts')}</span>
            <Button className="ml-auto" variant="ghost" onClick={s.close}>Not now</Button>
            <Button variant="primary" icon={<Check />} onClick={() => { applyAiDraft(e.id); s.close() }}>Use this draft</Button>
          </>
        ) : (
          <span className="text-[0.84375rem] text-muted">Reading {d.sheets[0].toLowerCase()}…</span>
        )
      }
    >
      {!ready ? (
        <ol className="flex flex-col gap-1">
          {steps.map((x, i) => (
            <li key={x.label} className={cn('flex items-start gap-3.5 rounded-xl px-3 py-3 transition', i === phase && 'bg-vio-50')}>
              <span className={cn('mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full', i < phase ? 'bg-ok-500 text-white' : i === phase ? 'bg-white text-vio-600 ring-2 ring-vio-500' : 'bg-wash-2 text-faint')}>
                {i < phase ? <Check className="h-4 w-4" strokeWidth={3} /> : i === phase ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-vio-500 border-t-transparent" /> : <span className="text-[0.75rem] font-bold">{i + 1}</span>}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[0.9375rem] font-semibold', i <= phase ? 'text-ink' : 'text-muted')}>{x.label}</span>
                {i < phase && <span className="mt-0.5 block text-[0.84375rem] text-muted">{x.sub}</span>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2">
            {[`${rooms.length} rooms`, `${d.rows.length} surfaces`, `${floor.toLocaleString('en-US')} SF floor`, `${wall.toLocaleString('en-US')} SF wall`].map((c) => <span key={c} className="rounded-full bg-wash-2 px-3 py-1 text-[0.8125rem] font-semibold text-ink-2">{c}</span>)}
            {flags > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-50 px-3 py-1 text-[0.8125rem] font-semibold text-warn-700"><Sparkles className="h-3.5 w-3.5" />{plural(flags, 'thing')} to check</span>}
          </div>
          {d.general?.map((g) => <div key={g} className="mt-3 rounded-xl border border-warn-100 bg-warn-50 px-4 py-2.5 text-[0.84375rem] text-ink-2">{g}</div>)}
          <div className="mt-4 overflow-hidden rounded-xl border border-line">
            {rooms.map((room, ri) => (
              <section key={room} className={cn(ri > 0 && 'border-t border-line')}>
                <div className="bg-[#f3f4f6] px-4 py-2 text-[0.78125rem] font-bold uppercase tracking-[0.04em] text-ink">{room}{d.rows.find((r) => r.room === room)?.option ? <span className="ml-2 normal-case tracking-normal text-warn-700">· option</span> : null}</div>
                {d.rows.filter((r) => r.room === room).map((r) => {
                  const t = tileOf(e.jobId, r.tile)
                  return (
                    <div key={r.surface} className="border-t border-line-2 px-4 py-2 first:border-t-0">
                      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.625rem_3.75rem] items-center gap-3 text-[0.875rem] max-sm:grid-cols-[minmax(0,1fr)_5rem]">
                        <span className="truncate text-ink">{r.surface}</span>
                        <span className="truncate text-[0.8125rem] text-muted max-sm:hidden">{t ? `${t.tag} · ${t.name} ${t.size}` : 'Tile open'}</span>
                        <span className="text-right font-semibold tnum text-ink">{r.qty.toLocaleString('en-US')} {r.unit}</span>
                        <span className="text-right text-[0.78125rem] text-faint max-sm:hidden">{r.sheet}</span>
                      </div>
                      {r.flag && <div className="mt-1 flex items-start gap-1.5 text-[0.78125rem] font-medium text-warn-700"><Sparkles className="mt-[0.125rem] h-3 w-3 shrink-0" />{r.flag}</div>}
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
          <div className="mt-3 text-[0.8125rem] text-muted">
            Also: {d.extra.map((x) => { const it = s.items.find((i) => i.id === x.itemId); return `${x.desc || it?.name}${x.qty > 1 ? ` · ${x.qty.toLocaleString('en-US')} ${it?.unit}` : ''}` }).join(' · ')}
          </div>
        </div>
      )}
    </Modal>
  )
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.75rem_1fr] gap-3 border-b border-line-2 py-2.5 first:pt-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-ink-2">{children}</dd>
    </div>
  )
}

const LINE_GRID = 'grid grid-cols-[minmax(0,1fr)_5.75rem_3.5rem_6rem_6.5rem_2.25rem] items-center gap-0'
function LineRow({ e, l, editable }: { e: Estimate; l: EstLine; editable: boolean }) {
  const s = useStore()
  const it = s.items.find((i) => i.id === l.itemId)
  const set = (p: Partial<EstLine>) => estEditLines(e.id, (L) => L.map((x) => (x.id === l.id ? { ...x, ...p } : x)))
  const remove = editable && (
    <button aria-label="Remove line" onClick={() => estEditLines(e.id, (L) => L.filter((x) => x.id !== l.id))} className="inline-flex h-7 w-7 items-center justify-center justify-self-end rounded-md text-faint transition hover:bg-bad-50 hover:text-bad-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
  const name = (
    <div className="min-w-0 pr-3">
      <div className="truncate text-[0.875rem] text-ink">{l.desc || it?.name || l.itemId}</div>
      {l.surface ? (
        <div className="truncate text-[0.75rem] text-muted">{l.surface}{tileOf(e.jobId, l.tile) ? ` · ${tileLine(tileOf(e.jobId, l.tile))}` : ''}</div>
      ) : it && it.type !== 'other' ? (
        <div className="truncate text-[0.75rem] text-muted">{it.type === 'labor' ? 'Labor' : `Material · ${it.vendor}`}</div>
      ) : null}
    </div>
  )
  return (
    <div className="group border-b border-line-2 px-3 py-2 last:border-b-0">
      {/* laptops: one row with columns */}
      <div className={cn(LINE_GRID, 'max-sm:hidden')}>
        {name}
        <span className="text-right">{editable ? <NumIn value={l.qty} onChange={(n) => set({ qty: n })} label={`Quantity · ${it?.name}`} /> : <span className="text-[0.875rem] tnum text-ink-2">{l.qty.toLocaleString('en-US')}</span>}</span>
        <span className="pl-2 text-[0.8125rem] text-muted">{it?.unit}</span>
        <span className="text-right">{editable ? <NumIn value={l.rate} onChange={(n) => set({ rate: n })} label={`Rate · ${it?.name}`} money /> : <span className="text-[0.875rem] tnum text-ink-2">{fmtMoney(l.rate, { cents: l.rate % 1 !== 0 })}</span>}</span>
        <span className="text-right text-[0.875rem] tnum text-ink">{fmtMoney(l.qty * l.rate)}</span>
        {remove || <span />}
      </div>
      {/* phones: name and amount, then quantity × rate */}
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-3">
          {name}
          <span className="shrink-0 text-[0.875rem] tnum text-ink">{fmtMoney(l.qty * l.rate)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[0.8125rem] text-muted">
          {editable ? <NumIn value={l.qty} onChange={(n) => set({ qty: n })} label={`Quantity · ${it?.name}`} /> : <span className="tnum">{l.qty.toLocaleString('en-US')}</span>}
          <span>{it?.unit} ×</span>
          {editable ? <NumIn value={l.rate} onChange={(n) => set({ rate: n })} label={`Rate · ${it?.name}`} money /> : <span className="tnum">{fmtMoney(l.rate, { cents: l.rate % 1 !== 0 })}</span>}
          <span className="ml-auto">{remove}</span>
        </div>
      </div>
    </div>
  )
}

function NumIn({ value, onChange, label, money }: { value: number; onChange: (n: number) => void; label: string; money?: boolean }) {
  const [v, setV] = React.useState(String(value))
  React.useEffect(() => setV(String(value)), [value])
  return (
    <span className="relative inline-flex">
      {money && <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[0.8125rem] text-faint">$</span>}
      <input
        aria-label={label}
        inputMode="decimal"
        value={v}
        onChange={(x) => setV(x.target.value)}
        onBlur={() => { const n = Number(v.replace(/[^0-9.]/g, '')); if (!isNaN(n) && n !== value) onChange(n); else setV(String(value)) }}
        onKeyDown={(x) => { if (x.key === 'Enter') (x.target as HTMLInputElement).blur() }}
        className={cn('h-8 w-[5.25rem] rounded-md border border-transparent bg-wash px-2 text-right text-[0.875rem] tnum text-ink hover:border-line focus:border-brand-300 focus:bg-white focus:outline-none max-sm:w-[4.75rem]', money && 'pl-5')}
      />
    </span>
  )
}

/** pick one of our QuickBooks items */
export function ItemPicker({ onPick, label = 'Add item', types }: { onPick: (it: Store['items'][number]) => void; label?: string; types?: ('labor' | 'material' | 'other')[] }) {
  const s = useStore()
  const groups = (['labor', 'material', 'other'] as const).filter((t) => !types || types.includes(t))
  return (
    <Menu
      align="start"
      width={340}
      trigger={<button className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.84375rem] font-medium text-brand-700 hover:bg-brand-50"><Plus className="h-4 w-4" />{label}</button>}
    >
      {groups.map((t, gi) => (
        <React.Fragment key={t}>
          {gi > 0 && <MenuSep />}
          <MenuLabel>{t === 'other' ? 'Other' : ITEM_TYPE_LABEL[t]} · from QuickBooks</MenuLabel>
          {s.items.filter((i) => i.type === t && i.id !== 'o-room').map((i) => (
            <MenuItem key={i.id} onSelect={() => onPick(i)} hint={`${fmtMoney(i.price, { cents: i.price % 1 !== 0 })} / ${i.unit}${i.vendor ? ' · ' + i.vendor : ''}`}>{i.name}</MenuItem>
          ))}
        </React.Fragment>
      ))}
    </Menu>
  )
}

function FollowUpForm({ onSave }: { onSave: (o: { how: string; outcome: string; next: string }) => void }) {
  const [how, setHow] = React.useState('Called')
  const [outcome, setOutcome] = React.useState('Still reviewing')
  const [next, setNext] = React.useState('Thu')
  return (
    <div className="flex flex-col gap-4">
      <Field label="How">
        <div className="flex flex-wrap gap-1.5">{['Called', 'Emailed', 'Texted', 'Met'].map((x) => <Chip key={x} on={how === x} onClick={() => setHow(x)} className="h-8 px-2.5 text-[0.84375rem]">{x}</Chip>)}</div>
      </Field>
      <Field label="What they said">
        <div className="flex flex-wrap gap-1.5">{['Still reviewing', 'No answer', 'Comparing prices', 'Waiting on their client'].map((x) => <Chip key={x} on={outcome === x} onClick={() => setOutcome(x)} className="h-8 px-2.5 text-[0.84375rem]">{x}</Chip>)}</div>
      </Field>
      <Field label="Follow up again">
        <DatePresets value={next} onPick={setNext} presets={['Tomorrow', 'Thu', 'Fri', 'Next Mon']} />
      </Field>
      <div className="flex justify-end"><Button size="sm" variant="primary" onClick={() => onSave({ how, outcome, next })}>Save follow-up</Button></div>
    </div>
  )
}
