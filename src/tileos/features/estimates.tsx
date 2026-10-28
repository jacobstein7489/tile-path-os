/* Estimates — where every project starts. One set of words everywhere, the estimate's own path:
 *   Request → Takeoff → Office review → Final review → Sent → Approved (or Lost).
 * The bubbles on top, the groups on the list and the estimate's header all say the same thing. A revision goes back
 * to its step and says "Revision 2". Whose turn it is lives on the estimate, so nobody's tasks change hands; review
 * notes are pinned to the room they're about and go back as a checklist. Approved, it becomes a project. */
import { smp, REAL } from '@/tileos/lib/save'
import * as React from 'react'
import { Mail, Plus, Trash2, Send, Check, X, Inbox, FileText, ChevronDown, FileClock, FileCheck2, FileX2, CalendarDays, Building2, UserRound, Ruler, ClipboardCheck, BadgeCheck, Undo2, MessageSquarePlus, Sparkles, StickyNote, ArrowRight, Upload, Printer, MoreHorizontal, Layers, Receipt, Users, History, GitCompareArrows, Loader2, ChevronRight } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button, Avatar, TextInput, Chip, Field, Segmented } from '@/tileos/components/ui/core'
import { RevisionsPanel, diffRevs, type LineDiff } from './revisions'
import { Modal, Menu, MenuItem, MenuLabel, MenuSep, Pop, Tip, DatePresets } from '@/tileos/components/ui/overlay'
import { Page, Filter, ToolbarSearch, ClearFilters, Group, Row, Col, Meta, IconTile, EmptyState, Status, Circles, Bubbles, STICKY_HEAD, type CircleState } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, PRICING_STAGES, type PersonKey, type Tone } from '@/tileos/data/model'
import { CUSTOMERS, tileOf, tileLine } from '@/tileos/data/jobs'
import { EST_STATUS, EST_STEP, STEP_ORDER, curRev, revTotal, estAmount, teamOf, bucketOf, turnOf, holderOf, openNotes, type Estimate, type EstLine, type EstBucket, type EstNote, type EstTeam } from '@/tileos/data/estimates'
import { FLOORS, sortAreas, guessSurfaces } from '@/tileos/data/areas'
import { printNode } from '@/tileos/lib/print'
import { EstimatePaper, paperGroups, paperText } from './estpaper'
import { DocPanel, PanelBar } from './docview'
import { TeamSlots, SurfaceAdd } from './estnew'
import { ITEM_TYPE_LABEL } from '@/tileos/data/items'
import { estEditLines, newLine, estSend, estRevise, estLost, estFollowUp } from './flows2'
import { TODAY, isoFromLabel, labelFromIso } from '@/tileos/lib/today'
import { setEstimateDue, estStartTakeoff, estHandOff, estSendBack, estAddNote, estToggleNote, estRemoveNote, aiDraftFor, applyAiDraft, plansUploaded, docUploaded, estAddArea, estAddSurface, estSetArea, estRemoveArea, setEstTeam, companyAreas, companySurfaces, addCompanyArea, surfaceOf, EST_PEOPLE, sameJobCandidates, moveEstimateTo, TEAM_KEYS, TEAM_LABEL } from './estflow'
import { insidePeople } from './steps-ui'
import { SearchSelect } from '@/tileos/components/ui/select'
import { jobMoney } from './job/money-tab'
import { ActivityRow } from './activity'

const OPEN_B: EstBucket[] = ['request', 'takeoff', 'review', 'final', 'sent']
const ownerish = (s: Store) => s.role === 'owner' || s.role === 'pm'
/** one colour per part of the path, the same on the bubbles, the groups and the estimate's header: grey for a request,
 *  blue while it's being priced inside, violet with the client, green once it's won */
const B_TONE: Record<EstBucket, Tone> = { request: 'neutral', takeoff: 'info', review: 'info', final: 'info', sent: 'vio', approved: 'ok', lost: 'neutral' }
const B_ICON: Record<EstBucket, React.ReactNode> = { request: <Inbox />, takeoff: <Ruler />, review: <ClipboardCheck />, final: <BadgeCheck />, sent: <FileClock />, approved: <FileCheck2 />, lost: <FileX2 /> }

/* the statuses an estimate keeps (its record) — on screen it's always the path's word (estWord) */
export type EstCat = 'request' | 'estimating' | 'revision' | 'sent' | 'approved' | 'lost'
const OPEN_C: EstCat[] = ['request', 'estimating', 'revision', 'sent']
export const catOf = (e: Estimate): EstCat => e.status
export const CAT: Record<EstCat, { label: string; tone: Tone; icon: React.ReactNode }> = {
  request: { label: 'Request', tone: 'neutral', icon: <Inbox /> },
  estimating: { label: 'Estimating', tone: 'info', icon: <Ruler /> },
  revision: { label: 'Revision', tone: 'warn', icon: <Undo2 /> },
  sent: { label: 'Sent', tone: 'vio', icon: <FileClock /> },
  approved: { label: 'Approved', tone: 'ok', icon: <FileCheck2 /> },
  lost: { label: 'Lost', tone: 'neutral', icon: <FileX2 /> },
}
/** the path, the same words as the estimate's circles */
export const PATH_WORD: Record<EstBucket, string> = { request: 'Request', takeoff: 'Takeoff', review: 'Office review', final: 'Final review', sent: 'Sent', approved: 'Approved', lost: 'Lost' }
const PATH_COLOR: Record<EstBucket, 'violet' | 'blue' | 'green' | 'slate'> = { request: 'slate', takeoff: 'blue', review: 'blue', final: 'blue', sent: 'violet', approved: 'green', lost: 'slate' }
/** where an estimate is, in the path's word — "Office review", "Takeoff · Revision 2", "Sent" */
export const estWord = (e: Estimate): string => `${PATH_WORD[bucketOf(e)]}${e.status === 'revision' ? ` · Revision ${curRev(e).n}` : ''}`
export const estTone = (e: Estimate): Tone => (e.status === 'revision' ? 'warn' : B_TONE[bucketOf(e)])
const STEP_RANK = (e: Estimate) => ['takeoff', 'review', 'final'].indexOf(bucketOf(e))
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function nextOf(s: Store, e: Estimate): { text: string; tone?: 'bad' | 'warn' } {
  const p = s.pricing[e.jobId]
  const missing = p?.docs.filter((d) => d.status === 'missing').map((d) => d.name.toLowerCase()) || []
  const b = bucketOf(e)
  const notes = openNotes(e).length
  if (b === 'request') return missing.length ? { text: `Waiting for the ${missing.join(' and ')}`, tone: 'warn' } : { text: 'Plans are in — send it to the takeoff' }
  if (b === 'takeoff') {
    if (e.backTo) return { text: `Fix ${plural(notes, 'note')} — back to ${PEOPLE[teamOf(e)[e.backTo]].short}`, tone: 'warn' }
    if (p?.takeoff?.question) return { text: `Waiting on the ${p.takeoff.question.waitingOn.toLowerCase()}`, tone: 'warn' }
    if (e.status === 'revision') return { text: 'Make the client’s changes', tone: 'warn' }
    return { text: curRev(e).lines.length ? (notes ? `${plural(notes, 'thing')} to check` : 'Finish the takeoff') : 'Do the takeoff' }
  }
  if (b === 'review') return { text: 'Review the takeoff' }
  if (b === 'final') return { text: 'Approve and send' }
  if (b === 'sent') return { text: `Follow up ${e.followUp || 'Thu'}`, tone: e.followUp === 'Today' ? 'warn' : undefined }
  if (b === 'approved') return { text: 'It’s a project' }
  return { text: '—' }
}
const whenOf = (e: Estimate) => {
  const sent = [...e.revs].reverse().find((r) => r.sentOn)
  if (e.status === 'approved') return `Approved ${e.approvedOn}`
  if (e.status === 'sent' && sent) return `Sent ${sent.sentOn}`
  if (e.status === 'lost') return 'Lost'
  return e.due ? `Due ${e.due}` : '—'
}

type EstView = 'open' | EstBucket
const OPEN_PATH: EstBucket[] = ['request', 'takeoff', 'review', 'final', 'sent']
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
  const of = (b: EstBucket) => list.filter((e) => bucketOf(e) === b)
  const open = list.filter((e) => OPEN_PATH.includes(bucketOf(e)) && match(e))
  const shown = view === 'open' ? open : list.filter((e) => bucketOf(e) === view && match(e)).sort((a, b) => b.id.localeCompare(a.id))
  const lostOld = view === 'lost' ? s.lost.filter((l) => !shown.some((e) => s.jobs[e.jobId]?.name === l.name) && (!q || l.name.toLowerCase().includes(q.toLowerCase()))) : []
  const pipeline = of('sent').reduce((n, e) => n + estAmount(e), 0)
  const clients = Array.from(new Set(list.map((e) => s.jobs[e.jobId].clientId))).map((id) => ({ key: id, label: CUSTOMERS[id]?.name || s.jobs[list.find((e) => s.jobs[e.jobId].clientId === id)!.jobId].client }))
  const pick = (v: EstView) => () => setView(view === v ? 'open' : v)
  const me = meOf(s.role)
  const mineAt = (b: EstBucket) => of(b).filter((e) => turnOf(e) === me).length
  const revs = (b: EstBucket) => of(b).filter((e) => e.status === 'revision').length
  const subOf = (b: EstBucket) => (b === 'sent' ? (pipeline ? fmtMoney(pipeline) : undefined) : mineAt(b) ? `${mineAt(b)} yours` : revs(b) ? `${revs(b)} revision${revs(b) > 1 ? 's' : ''}` : undefined)
  return (
    <Page
      title="Estimates"
      sub={<><span className="font-semibold text-ink">{fmtMoney(pipeline)}</span> sent — waiting for a yes{smp(' · sample amounts')}</>}
      actions={<Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newreq' })}>Price a new project</Button>}
      top={
        <Bubbles
          arrows
          dense
          items={[
            ...OPEN_PATH.map((b) => ({ key: b, label: PATH_WORD[b], count: of(b).length, sub: subOf(b), icon: B_ICON[b], color: PATH_COLOR[b], on: view === b, onClick: pick(b) })),
            { key: 'approved', label: PATH_WORD.approved, count: of('approved').length, icon: B_ICON.approved, color: PATH_COLOR.approved, on: view === 'approved', onClick: pick('approved'), gapBefore: true },
            { key: 'lost', label: PATH_WORD.lost, count: of('lost').length + s.lost.length, icon: B_ICON.lost, color: PATH_COLOR.lost, on: view === 'lost', onClick: pick('lost'), plainBefore: true },
          ]}
        />
      }
      toolbar={
        <>
          {view !== 'open' ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-brand-600 bg-brand-50 pl-3.5 pr-1.5 text-[0.84375rem] font-semibold text-brand-700">
              {PATH_WORD[view]} <span className="text-brand-600">{shown.length + lostOld.length}</span>
              <button onClick={() => setView('open')} aria-label="Show open estimates" className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-100">×</button>
            </span>
          ) : (
            <span className="bar-title text-[0.9375rem] font-semibold text-ink">Open estimates <span className="ml-1 text-[0.8125rem] font-semibold text-faint">{open.length}</span></span>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Filter icon={<Building2 />} label="Client" value={client} options={clients} onChange={setClient} width={280} />
            <Filter icon={<UserRound />} label="Who has it" value={who} options={(insidePeople(s).length ? insidePeople(s) : EST_PEOPLE).map((p) => ({ key: p, label: PEOPLE[p]?.name || p, hint: PEOPLE[p]?.roleLabel }))} onChange={setWho} />
            <ClearFilters show={client !== 'all' || who !== 'all' || !!q} onClear={() => { setClient('all'); setWho('all'); setQ('') }} />
            <ToolbarSearch value={q} onChange={setQ} placeholder="Search estimates" />
          </div>
        </>
      }
    >
      <div>
        {(shown.length > 0 || lostOld.length > 0) && <EstHead />}
        {view === 'open' &&
          OPEN_PATH.map((b) => {
            const rows = open.filter((e) => bucketOf(e) === b).sort((a, c) => (a.due && c.due ? (isoFromLabel(a.due) || '').localeCompare(isoFromLabel(c.due) || '') : 0))
            if (!rows.length) return null
            return (
              <section key={b} data-est-group={b}>
                <Group label={PATH_WORD[b]} count={rows.length} tone={B_TONE[b]} right={b === 'sent' ? <span className="text-[0.8125rem] font-semibold tnum text-muted">{fmtMoney(rows.reduce((n, e) => n + estAmount(e), 0))}</span> : undefined} />
                {rows.map((e) => <EstRow key={e.id} e={e} />)}
              </section>
            )
          })}
        {view !== 'open' && shown.map((e) => <EstRow key={e.id} e={e} />)}
        {lostOld.map((l) => (
          <div key={l.name} className={cn('min-h-[3.75rem] border-t border-line-2 py-2.5 opacity-70', EST_COLS, 'px-5 max-sm:px-4')}>
            <div className="min-w-0"><div className="truncate text-[0.90625rem] font-semibold text-ink">{l.name}</div><div className="truncate text-[0.78125rem] text-muted">{l.client}</div></div>
            <div className="min-w-0"><span className="line-clamp-2 text-[0.8125rem] text-muted">{l.reason}</span></div>
            <div className="text-[0.8125rem] text-ink-2 max-lg:hidden">Lost {l.date}</div>
            <div className="text-right text-faint max-xl:hidden">—</div>
          </div>
        ))}
        {!shown.length && !lostOld.length && (list.length
          ? <EmptyState title="No estimates here" sub="Try another filter." />
          : <EmptyState icon={<FileText />} title="No estimates yet" sub="Upload the plans — it goes straight to whoever does the takeoff, and the estimate is built from there." action={<Button variant="primary" icon={<Plus />} onClick={() => s.open({ t: 'newreq' })}>Price a new project</Button>} />)}
      </div>
    </Page>
  )
}

/* Estimate · Who has it · Date · Amount — the same columns, spacing and header as Projects. No status column: the
   group it's under (or the bubble you picked) already says it, in the path's own word. */
const EST_COLS = 'grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_9rem_8rem] items-center gap-6 max-xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_8.5rem_7.5rem] max-lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7.5rem] max-md:grid-cols-1 max-md:gap-1.5'
function EstHead() {
  return (
    <div className={cn('border-b border-line-2 bg-wash py-2 text-[0.75rem] font-semibold text-muted max-md:hidden', EST_COLS, 'px-5 max-sm:px-4', STICKY_HEAD)}>
      <span>Estimate</span>
      <span>Who has it</span>
      <span className="max-lg:hidden">Date</span>
      <span className="text-right">Amount</span>
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
  const turn = holderOf(e)
  const me = meOf(s.role)
  const date = whenOf(e)
  return (
    <div
      role="button"
      tabIndex={0}
      data-est={e.id}
      onClick={() => s.open({ t: 'estimate', id: e.id })}
      onKeyDown={(ev) => { if (ev.key === 'Enter') s.open({ t: 'estimate', id: e.id }) }}
      className={cn('min-h-[3.75rem] cursor-pointer border-t border-line-2 py-2.5 transition-colors hover:bg-[#f7f5f0] focus-visible:bg-[#f7f5f0] focus-visible:outline-none', EST_COLS, 'px-5 max-sm:px-4', c === 'lost' && 'opacity-70')}
    >
      <div className="min-w-0">
        <div className="truncate text-[0.90625rem] font-semibold text-ink">{j.name}</div>
        <div className="truncate text-[0.78125rem] text-muted"><span className="tnum">{e.id}</span> · {j.client}{rev > 1 && OPEN_C.includes(c) && c !== 'request' ? <span className={c === 'revision' ? 'font-semibold text-warn-700' : ''}> · Revision {rev}</span> : ''}<span className="md:hidden">{amt ? ` · ${fmtMoney(amt)}` : ''}</span></div>
      </div>
      <div className="min-w-0">
        {turn ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="max-md:hidden"><Avatar who={turn} size={28} /></span>
            <span className="min-w-0 leading-tight">
              <span className={cn('block truncate text-[0.84375rem]', turn === me ? 'font-semibold text-ink' : 'font-medium text-ink')}>{turn === me ? 'You' : PEOPLE[turn].short}{e.since && (b === 'takeoff' || b === 'review' || b === 'final') && <span className="font-normal text-muted"> · since {e.since}</span>}</span>
              <span className={cn('block truncate text-[0.78125rem]', nx.tone === 'warn' ? 'font-medium text-warn-700' : 'text-muted')}>{nx.text}</span>
            </span>
          </span>
        ) : <span className="truncate text-[0.8125rem] text-muted">{nx.text}</span>}
      </div>
      <div className={cn('truncate text-[0.8125rem] max-lg:hidden', /Today|late/.test(date) ? 'font-semibold text-warn-700' : 'text-ink-2')}>{date}</div>
      <div className="text-right max-md:text-left">
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
/* the estimate's documents, the client's copy, every revision, who does what and what happened open in the window
 * itself, with "Back to the estimate" on top — never a window on a window */
type EstPanel = null | { t: 'doc'; doc: string } | { t: 'paper'; prices?: boolean } | { t: 'revs' } | { t: 'team' } | { t: 'log' } | { t: 'same' }
const GREEN = '#2c4a3e'
const GRAY = '#efece5'
/** scope · qty · unit · rate · amount · (remove) — the same columns on the green bands, the rooms and every line */
const SHEET_GRID = 'grid grid-cols-[minmax(0,1fr)_5.25rem_2.75rem_6.25rem_6.75rem_2.25rem] items-center'

/** the job itself, beside the estimate — in the same spot as on a project: its papers (plans, spec book, finish
 *  schedule — each one here, or missing), who does what, the client. None of it is a step: it's here or it isn't.
 *  Tap a paper and it opens right in the window; a missing one takes its file. */
function EstJob({ e, onDoc, onTeam, className }: { e: Estimate; onDoc: (doc: string) => void; onTeam?: () => void; className?: string }) {
  const s = useStore()
  const j = s.jobs[e.jobId]
  const docs = s.pricing[e.jobId]?.docs || []
  const add = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState<string | null>(null)
  const target = React.useRef('')
  const upload = async (doc: string, fl: File[]) => {
    if (!fl.length || !doc) return
    setBusy(doc)
    await docUploaded(e.jobId, doc, fl)
    setBusy(null)
    onDoc(doc)
  }
  const team = teamOf(e)
  const b = bucketOf(e)
  const nowKey: keyof EstTeam | null = b === 'takeoff' || b === 'review' || b === 'final' ? b : b === 'sent' ? 'follow' : null
  const me = meOf(s.role)
  const here = docs.filter((d) => d.status !== 'missing').length
  const row = 'flex w-full min-w-0 items-center gap-3 rounded-[0.625rem] px-2 py-1.5 text-left transition hover:bg-[#f6f3ee]'
  const head = 'text-[0.71875rem] font-semibold uppercase tracking-[0.06em] text-faint'
  if (!j) return null
  return (
    <aside data-side="job" data-est-job className={cn('scroll-soft min-h-0 min-w-0 border-line bg-white lg:overflow-y-auto lg:border-l', className)}>
      <section className="px-4 pb-2.5 pt-4" aria-label="Documents">
        <header className="mb-1 flex items-center gap-2 px-2"><h4 className={head}>Documents</h4>{docs.length > 0 && <span className="ml-auto text-[0.75rem] text-muted">{here} of {docs.length} here</span>}</header>
        <input ref={add} type="file" accept=".pdf,image/*" className="hidden" aria-label="Upload a document" onChange={(x) => { const f = Array.from(x.target.files || []); x.target.value = ''; void upload(target.current, f) }} />
        {docs.map((d) =>
          d.status === 'missing' ? (
            <button key={d.name} data-doc={d.name} onClick={() => { target.current = d.name; add.current?.click() }} title={`${d.name} — missing. Add it.`} className={row}>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] border border-dashed border-warn-300 bg-[#fffaf0] text-warn-700">{busy === d.name ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.875rem] font-semibold text-ink">{d.name}</span>
                <span className="block truncate text-[0.75rem] font-medium text-warn-700">missing — tap to add it</span>
              </span>
            </button>
          ) : (
            <button key={d.name} data-doc={d.name} onClick={() => onDoc(d.name)} title={`Open the ${d.name.toLowerCase()}`} className={row}>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-brand-50 text-brand-600"><FileText className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5 text-[0.875rem] font-semibold text-ink"><span className="truncate">{d.name}</span><Check className="h-3.5 w-3.5 shrink-0 text-ok-600" strokeWidth={3} /></span>
                <span className="block truncate text-[0.75rem] text-muted">{d.note || 'Here'}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
            </button>
          ),
        )}
        {!docs.length && <div className="px-2 py-2 text-[0.8125rem] text-muted">No documents yet.</div>}
      </section>
      <section className="border-t border-line-2 px-4 pb-2.5 pt-3" aria-label="Who does what">
        <header className="mb-1 flex items-center gap-2 px-2"><h4 className={head}>Who does what</h4>{onTeam && <button onClick={onTeam} className="ml-auto text-[0.78125rem] font-semibold text-brand-700 hover:underline">Change</button>}</header>
        {TEAM_KEYS.map((k) => (
          <div key={k} className="flex min-w-0 items-center gap-3 px-2 py-1.5" data-team={k}>
            <Avatar who={team[k]} size={28} />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[0.84375rem] font-semibold text-ink">{team[k] === me ? 'You' : PEOPLE[team[k]]?.name}</span>
              <span className="block truncate text-[0.75rem] text-muted">{TEAM_LABEL[k]}</span>
            </span>
            {nowKey === k && <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[0.6875rem] font-bold text-white">Now</span>}
          </div>
        ))}
      </section>
      <section className="border-t border-line-2 px-4 pb-4 pt-3" aria-label="Client">
        <header className="mb-1 px-2"><h4 className={head}>Client</h4></header>
        <button onClick={() => s.open({ t: 'customer', id: j.clientId })} className={row}>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-wash-2 text-ink-2"><Building2 className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.875rem] font-semibold text-ink">{j.client}</span>
            <span className="block truncate text-[0.75rem] text-muted">{j.address}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
        </button>
      </section>
    </aside>
  )
}

/** "Revision 2 ▾" — every revision, and all of them side by side */
function RevPick({ e, shown, onPick, onCompare }: { e: Estimate; shown: Estimate['revs'][number]; onPick: (n: number) => void; onCompare: () => void }) {
  const cur = curRev(e)
  return (
    <Menu
      align="start"
      width={330}
      trigger={
        <button aria-label="Pick a revision" className={cn('inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[0.8125rem] font-semibold transition hover:bg-wash', shown === cur ? 'text-ink-2' : 'bg-warn-50 text-warn-700')}>
          Revision {shown.n}{shown === cur ? '' : ' · older'}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </button>
      }
    >
      <MenuLabel>{e.revs.length} revisions</MenuLabel>
      {[...e.revs].reverse().map((r) => (
        <MenuItem key={r.n} checked={shown.n === r.n} hint={`${r.status === 'draft' ? 'Being priced' : r.status === 'approved' ? 'Approved' : r.status === 'sent' ? `Sent ${r.sentOn}` : `Sent ${r.sentOn || r.date} · replaced`} · ${fmtMoney(revTotal(r))}`} onSelect={() => onPick(r.n)}>
          Revision {r.n}{r.what ? ` — ${r.what}` : ''}
        </MenuItem>
      ))}
      <MenuSep />
      <MenuItem icon={<GitCompareArrows className="h-4 w-4" />} onSelect={onCompare}>Every revision, side by side</MenuItem>
    </Menu>
  )
}

export function EstimateModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const e = s.estimates.find((x) => x.id === id)
  const [revN, setRevN] = React.useState<number | null>(null)
  const [panel, setPanel] = React.useState<EstPanel>(null)
  /* on a phone: the estimate, or the job (its documents, who does what, the client) */
  const [side, setSide] = React.useState<'est' | 'job'>('est')
  const paperRef = React.useRef<HTMLDivElement>(null)
  const [noteAt, setNoteAt] = React.useState<string | null>(null)
  const [takeoffBy, setTakeoffBy] = React.useState<PersonKey>(() => { const x = s.estimates.find((y) => y.id === id); return x ? teamOf(x).takeoff : 'takeoff' })
  if (!e) return null
  const j = s.jobs[e.jobId]
  if (!j) return null
  const cur = curRev(e)
  const shown = e.revs.find((r) => r.n === (revN ?? cur.n)) || cur
  const editable = shown === cur && cur.status === 'draft' && ['request', 'estimating', 'revision'].includes(e.status)
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
  /* reading the plans is shown in the preview; the real app doesn't offer it until it's real */
  const ai = REAL.cloud ? undefined : aiDraftFor(e.jobId)
  const canNote = shown === cur && inside
  const me = meOf(s.role)
  /* everyone acts for themselves; the owner can act for anyone */
  const canAct = ownerish(s) || (b === 'request' ? s.role === 'office' : turn === me)
  const canTeam = (ownerish(s) || s.role === 'office') && !['approved', 'lost'].includes(st)
  const back = () => setPanel(null)

  const order: EstBucket[] = ['request', 'takeoff', 'review', 'final', 'sent', 'approved']
  const at = b === 'lost' ? 5 : order.indexOf(b)
  const state = (i: number) => (i < at ? 'done' : i === at ? (b === 'lost' ? 'blocked' : 'current') : 'future') as 'done' | 'current' | 'future' | 'blocked'
  /* when each step was done — from the estimate's own log (the last time, if it went round again) */
  const lastLog = (re: RegExp) => [...e.log].reverse().find((l) => re.test(l.text))
  const DONE_RE: Record<string, RegExp> = { takeoff: /Ready for review/, review: /^Office review done/, final: /^Final review done/, sent: /^Revision \d+ sent|^Sent/, approved: /^Approved/ }
  const doneLog = (k: string) => (k === 'request' ? e.log[0] : DONE_RE[k] ? lastLog(DONE_RE[k]) : undefined)
  const doneOn: Record<string, string | undefined> = {
    request: e.log[0]?.date,
    takeoff: doneLog('takeoff')?.date,
    review: doneLog('review')?.date,
    final: doneLog('final')?.date || sent?.sentOn,
    sent: sent?.sentOn,
    approved: e.approvedOn,
  }
  /* who did it — the one in the estimate's own log; else whoever has that step */
  const doneBy = (k: string) => { const w = doneLog(k)?.who; return w && w !== 'system' && PEOPLE[w] ? PEOPLE[w].short : undefined }
  const people = [
    PEOPLE[e.log[0]?.who]?.short && e.log[0]?.who !== 'system' ? PEOPLE[e.log[0].who].short : PEOPLE[team.follow].short,
    PEOPLE[team.takeoff].short, PEOPLE[team.review].short, PEOPLE[team.final].short, PEOPLE[team.follow].short, undefined,
  ]
  const path = [
    { key: 'request', label: 'Request' },
    { key: 'takeoff', label: cur.n > 1 && inside ? `Takeoff · Rev ${cur.n}` : 'Takeoff' },
    { key: 'review', label: 'Office review' },
    { key: 'final', label: 'Final review' },
    { key: 'sent', label: 'Sent · follow-up' },
    { key: 'approved', label: b === 'lost' ? 'Lost' : 'Approved' },
  ].map((p, i) => {
    const s0 = state(i)
    const cs: CircleState = s0 === 'done' ? 'done' : s0 === 'current' ? 'now' : s0 === 'blocked' ? 'bad' : 'later'
    const date = s0 === 'done' ? doneOn[p.key] : s0 === 'current' && e.since && p.key !== 'sent' ? `since ${e.since}` : s0 === 'current' && p.key === 'sent' ? sent?.sentOn : st === 'approved' && p.key === 'approved' ? e.approvedOn : undefined
    const sub = s0 === 'done' ? [doneBy(p.key) || people[i], date ? date.replace(/^Done\s*/, '') : ''].filter(Boolean).join(' · ') || 'Done' : [people[i], date].filter(Boolean).join(' · ') || undefined
    return { key: p.key, label: p.label, state: cs, sub, center: String(i + 1) }
  })

  const header = (
    <div className="border-b border-line px-5 pb-3 pt-3 pr-14 max-sm:px-4 max-sm:pr-14">
      {/* the name, where it stands, the total and the buttons */}
      <div className="flex min-w-0 items-center gap-2.5">
        <h2 className="font-display min-w-0 truncate text-[1.25rem] font-semibold leading-tight tracking-[-0.012em] text-ink max-sm:text-[1.125rem]">{j.name}</h2>
        <Status tone={estTone(e)} className="min-w-0 shrink-0 max-sm:hidden">{estWord(e)}</Status>
        <span className="whitespace-nowrap text-[0.8125rem] tnum text-muted max-md:hidden">{e.id}</span>
        {e.revs.length > 1 && <RevPick e={e} shown={shown} onPick={(n) => { setRevN(n === cur.n ? null : n); setPanel(null) }} onCompare={() => setPanel({ t: 'revs' })} />}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="text-[0.8125rem] text-muted max-sm:hidden"><b className="text-[0.9375rem] font-semibold tnum text-ink">{shown.lines.length ? fmtMoney(total) : '—'}</b> {st === 'approved' ? 'approved' : shown.status === 'draft' ? 'draft' : 'total'}{smp('x') ? ' · sample' : ''}</span>
          {shown.lines.length > 0 && <Button size="sm" icon={<FileText />} aria-pressed={panel?.t === 'paper'} onClick={() => setPanel(panel?.t === 'paper' ? null : { t: 'paper' })}><span className="max-sm:hidden">Scope of work</span></Button>}
          {['owner', 'pm', 'office', 'estimator'].includes(s.role) && (
            <Menu align="end" width={250} trigger={<Button size="sm" aria-label="More for this estimate" icon={<MoreHorizontal />} />}>
              <MenuItem icon={<History className="h-4 w-4" />} onSelect={() => setPanel({ t: 'log' })}>What happened</MenuItem>
              {st === 'approved' && <MenuItem icon={<Receipt className="h-4 w-4" />} onSelect={() => s.swap({ t: 'job', id: e.jobId, tab: 'money' })}>Billed and paid</MenuItem>}
              {PRICING_STAGES.includes(j.stage) && ['owner', 'pm', 'office'].includes(s.role) && <MenuItem icon={<Building2 className="h-4 w-4" />} hint="Same job, two names? Put it on the project" onSelect={() => setPanel({ t: 'same' })}>It’s for a project we have…</MenuItem>}
              <MenuSep />
              <MenuItem danger icon={<Trash2 className="h-4 w-4" />} onSelect={() => s.open({ t: 'delete', kind: 'estimate', id: e.id })}>Delete this estimate…</MenuItem>
            </Menu>
          )}
        </span>
      </div>
      {/* who it's for, where, when it's due (its documents are on the right, with the job) */}
      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-muted max-sm:flex-col max-sm:items-start max-sm:gap-0 sm:[&>*+*]:before:mr-1.5 sm:[&>*+*]:before:content-['·']">
          <button onClick={() => s.open({ t: 'customer', id: j.clientId })} className="truncate text-ink-2 hover:text-brand-700">{j.client}</button>
          <span className="truncate">{j.address}</span>
          {['request', 'estimating', 'revision'].includes(st) && <span className="inline-flex items-center gap-1">Due <DueEdit id={e.id} due={e.due} /></span>}
          {st === 'sent' && sent && <span>Sent {sent.sentOn}</span>}
          {st === 'approved' && e.approvedOn && <span>Approved {e.approvedOn}</span>}
          <span className="sm:hidden">{shown.lines.length ? fmtMoney(total) : ''}</span>
        </span>
      </div>
      <Circles layout="beside" markNow className="mt-3" groups={[{ key: 'path', steps: path }]} label="Where the estimate is" />
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
            {insidePeople(s).map((p) => <MenuItem key={p} icon={<Avatar who={p} size={20} />} checked={takeoffBy === p} hint={PEOPLE[p]?.roleLabel} onSelect={() => setTakeoffBy(p)}>{PEOPLE[p]?.name}</MenuItem>)}
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
          {canNote && noteAt !== '' && <Button icon={<MessageSquarePlus />} onClick={() => setNoteAt('')} className="text-warn-700">Add a note</Button>}
          <span className="inline-flex min-w-0 items-center gap-2 text-[0.84375rem] text-muted max-md:hidden">{noteCount ? `${plural(noteCount, 'note')} for ${PEOPLE[team.takeoff].short}` : b === 'review' ? 'or on a room' : 'Last look before it goes out'}</span>
          <Tip label={noteCount ? `Goes back to ${PEOPLE[team.takeoff].name} with the notes` : 'Add a note to a room first'}>
            <span className="ml-auto"><Button icon={<Undo2 />} disabled={!noteCount} onClick={() => estSendBack(e.id)}>Send back{noteCount ? ` · ${plural(noteCount, 'note')}` : ''}</Button></span>
          </Tip>
          {b === 'review' ? (
            <Button variant="primary" icon={<Check />} disabled={noteCount > 0} onClick={() => estHandOff(e.id)}>Looks good — to {PEOPLE[team.final].short}</Button>
          ) : (
            <Button variant="primary" icon={<Send />} disabled={noteCount > 0} onClick={() => s.open({ t: 'estsend', id: e.id })}>Preview and send</Button>
          )}
        </>
      )}
      {st === 'sent' && (
        <>
          <Button variant="ghost" icon={<FileText />} onClick={() => s.open({ t: 'estsend', id: e.id, sent: true })}>What they got</Button>
          <span className="ml-auto text-[0.84375rem] text-muted max-md:hidden">{PEOPLE[team.follow].short} follows up {e.followUp || 'Thu'}</span>
          <Menu align="end" width={300} trigger={<Button variant="primary" iconRight={<ChevronDown />} className="max-md:ml-auto">What did the client say?</Button>}>
            <MenuItem icon={<Check className="h-4 w-4 text-ok-600" />} hint="It becomes a project — scope, deposit, getting ready" onSelect={() => s.open({ t: 'award', jobId: e.jobId })}>Approved</MenuItem>
            <MenuItem icon={<Undo2 className="h-4 w-4 text-warn-600" />} hint="List what they asked for — a new revision" onSelect={() => s.open({ t: 'estchanges', id: e.id })}>They want changes</MenuItem>
            <MenuItem icon={<CalendarDays className="h-4 w-4 text-brand-600" />} hint="Called, emailed — and when to try again" onSelect={() => s.open({ t: 'estfollow', id: e.id })}>Still deciding · log a follow-up</MenuItem>
            <MenuSep />
            <MenuItem icon={<X className="h-4 w-4 text-bad-600" />} hint="Kept for the record, with the reason" onSelect={() => s.open({ t: 'estlost', id: e.id })}>Not going ahead</MenuItem>
          </Menu>
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
  /* on a revision: what changed from the one before — added, changed (with the old numbers) and removed lines */
  const prevRev = shown.n > 1 ? e.revs.find((r) => r.n === shown.n - 1) : undefined
  const diffs = prevRev ? diffRevs(s.items, prevRev, shown) : []
  const diffOf = (l: EstLine) => diffs.find((d) => d.b?.id === l.id && d.kind !== 'same')
  const removedIn = (a: string) => diffs.filter((d) => d.kind === 'removed' && d.area === a)
  const changes = diffs.filter((d) => d.kind !== 'same')
  /* the rooms laid out like the paper: by floor, each room in its band */
  const groups = paperGroups(shown)
  const goneAreas = Array.from(new Set(diffs.filter((d) => d.kind === 'removed' && !groups.some((g) => g.areas.some((a) => a.name === d.area))).map((d) => d.area)))
  /* square feet per room, to check the takeoff at a glance */
  const sfOf = (a: string) => shown.lines.filter((l) => l.area === a && (itemOf(l)?.unit || '').toUpperCase() === 'SF').reduce((n, l) => n + l.qty, 0)

  const room = (a: string, note: string | undefined, ls: EstLine[]) => {
    const gone = removedIn(a)
    const sf = sfOf(a)
    const pinned = notes.filter((n) => n.area === a)
    return (
      <div key={a} data-area={a} className="group/room">
        <div className={cn(SHEET_GRID, 'group/area px-5 py-1.5 max-sm:flex max-sm:gap-2 max-sm:px-3')} style={{ background: GRAY }}>
          <span className="col-span-4 flex min-w-0 items-center gap-2 max-sm:flex-1">
            <span className={cn('truncate text-[0.875rem] font-semibold', !ls.length && gone.length ? 'text-bad-700 line-through' : 'text-ink')}>{a}</span>
            {sf > 0 && <span className="shrink-0 text-[0.78125rem] font-medium tnum text-muted">{sf.toLocaleString('en-US')} SF</span>}
            {note && <span className="min-w-0 truncate text-[0.78125rem] text-muted">| {note}</span>}
            {canNote && <button onClick={() => setNoteAt(a)} aria-label={`Add a note on ${a}`} className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.75rem] font-semibold text-warn-700 opacity-80 transition hover:bg-warn-50 hover:opacity-100 sm:opacity-0 sm:group-hover/area:opacity-100"><MessageSquarePlus className="h-3.5 w-3.5" />Note</button>}
          </span>
          <span className="text-right text-[0.875rem] font-semibold tnum text-ink">{fmtMoney(ls.reduce((n, l) => n + l.qty * l.rate, 0))}</span>
          <span className="flex justify-end">{editable && <AreaMenu e={e} area={a} />}</span>
        </div>
        {pinned.map((n) => <NoteRow key={n.id} e={e} n={n} />)}
        {noteAt === a && <AddNote e={e} area={a} onDone={() => setNoteAt(null)} />}
        {ls.map((l) => <LineRow key={l.id} e={e} l={l} editable={editable} diff={diffOf(l)} />)}
        {gone.map((d) => <RemovedRow key={d.key} d={d} />)}
        {!ls.length && !gone.length && <div className="px-5 py-2 text-[0.8125rem] text-muted max-sm:px-3">No tile here yet{editable ? ' — add a surface' : ''}</div>}
        {editable && (
          <div className="flex flex-wrap items-center gap-1.5 px-5 pb-2 pt-1 max-sm:px-3" data-add-row>
            <SurfaceAdd have={companySurfaces(s).filter((x) => ls.some((l) => l.surface === x.label)).map((x) => x.key)} onAdd={(k) => estAddSurface(e.id, a, k)} />
            <ItemPicker label="Item" onPick={(it) => estEditLines(e.id, (L) => [...L, newLine(a, it.id, it.unit === 'LS' ? 1 : 100, it.price)])} />
          </div>
        )}
      </div>
    )
  }

  /* the estimate itself, laid out like the scope of work: green bands, grey rooms, plain lines — the numbers you can change look like numbers */
  const sheet = (
    <div className="overflow-clip rounded-[0.875rem] border border-[#e4ded3] bg-white shadow-card" data-sheet>
      {groups.map((g) => (
        <section key={g.floor}>
          <div className={cn(SHEET_GRID, 'sticky top-0 z-[5] px-5 py-1.5 text-[0.75rem] font-semibold tracking-[0.01em] text-white max-sm:flex max-sm:justify-between max-sm:px-3')} style={{ background: GREEN }}>
            <span className="truncate">{g.floor}</span>
            <span className="text-right max-sm:hidden">Qty</span>
            <span className="pl-2 max-sm:hidden">Unit</span>
            <span className="text-right max-sm:hidden">Rate</span>
            <span className="text-right">Amount</span>
            <span className="max-sm:hidden" />
          </div>
          {g.areas.map((a) => room(a.name, a.note, a.lines))}
        </section>
      ))}
      {goneAreas.map((a) => room(a, undefined, []))}
      {!groups.length && !goneAreas.length && <div className="px-5 py-8 text-center text-[0.875rem] text-muted">No rooms yet — add the first one below.</div>}
      {shown.lines.length > 0 && (
        <div className="border-t border-[#ebe6dd] px-5 pb-5 pt-3 max-sm:px-3">
          <dl className="ml-auto w-full max-w-[19rem] text-[0.84375rem]">
            {(['labor', 'material', 'other'] as const).map((t) => sum(t) ? (
              <div key={t} className="flex justify-between py-0.5 text-ink-2"><dt>{t === 'other' ? 'Other' : ITEM_TYPE_LABEL[t]}</dt><dd className="tnum">{fmtMoney(sum(t))}</dd></div>
            ) : null)}
          </dl>
          <div className="ml-auto mt-2 flex w-full max-w-[19rem] items-center justify-between rounded-md px-3 py-2 text-[0.9375rem] font-semibold text-white" style={{ background: GREEN }}><span>Total</span><span className="tnum">{fmtMoney(total)}</span></div>
        </div>
      )}
    </div>
  )

  const desk = (
    <div className="min-h-full bg-[#f3f0ea]" data-desk>
      <div className="mx-auto w-full max-w-[64rem] px-6 pb-8 pt-3 max-sm:px-2 max-sm:pt-2">
        {/* review notes: how many are checked off, and a note for the whole estimate */}
        {notes.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center justify-end gap-3">
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-ink-2"><StickyNote className="h-4 w-4 text-warn-600" /><b className="font-semibold text-ink">{notes.filter((n) => n.done).length} of {notes.length}</b> notes checked off</span>
          </div>
        )}
        {shown !== cur && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-warn-100 bg-warn-50 px-3.5 py-2.5 text-[0.8125rem] text-warn-800">
            <span>You’re looking at revision {shown.n}{shown.what ? ` — ${shown.what}` : ''}. It’s kept as it was.</span>
            <button onClick={() => setRevN(null)} className="ml-auto font-semibold text-brand-700 hover:underline">Back to revision {cur.n}</button>
          </div>
        )}
        {ai && shown === cur && (st === 'request' || editable) && !shown.lines.some((l) => l.qty > 1) && <AiCard e={e} filled={shown.lines.length > 0} />}
        {prevRev && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-white px-3.5 py-2.5 text-[0.8125rem] text-ink-2">
            <span className="font-semibold text-ink">{changes.length ? `What changed from revision ${prevRev.n}` : `Same lines as revision ${prevRev.n}`}</span>
            {changes.length > 0 && (
              <>
                {(['added', 'changed', 'removed'] as const).map((k) => {
                  const n = changes.filter((d) => d.kind === k).length
                  return n ? <span key={k} className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.75rem] font-semibold', k === 'added' ? 'bg-ok-50 text-ok-700' : k === 'changed' ? 'bg-warn-50 text-warn-700' : 'bg-bad-50 text-bad-700')}>{n} {k}</span> : null
                })}
                <span className={cn('ml-auto font-semibold tnum', revTotal(shown) - revTotal(prevRev) < 0 ? 'text-bad-600' : 'text-ok-700')}>{revTotal(shown) - revTotal(prevRev) < 0 ? '−' : '+'}{fmtMoney(Math.abs(revTotal(shown) - revTotal(prevRev)))}</span>
              </>
            )}
          </div>
        )}
        {(general.length > 0 || (canNote && noteAt === '')) && (
          <div className="mb-3 overflow-hidden rounded-xl border border-line bg-white">
            {general.map((n) => <NoteRow key={n.id} e={e} n={n} />)}
            {noteAt === '' && <AddNote e={e} onDone={() => setNoteAt(null)} />}
          </div>
        )}
        {!shown.lines.length && !editable && <div className="rounded-xl bg-white py-10 text-center text-[0.875rem] text-muted">No lines on this revision.</div>}
        {(shown.lines.length > 0 || (editable && !(ai && st === 'request'))) && sheet}
        {editable && <AreaAdder e={e} />}
      </div>
    </div>
  )

  const body =
    panel?.t === 'doc' ? (
      <DocPanel jobId={e.jobId} doc={panel.doc} onBack={back} back="Back to the estimate" />
    ) : panel?.t === 'paper' ? (
      <div className="min-h-full bg-[#f3f0ea]" data-panel="paper">
        <PanelBar
          title={panel.prices ? 'The estimate the client gets' : 'Scope of work'}
          sub={panel.prices ? 'with prices, ready to print or save as PDF' : 'what we install, room by room — no prices'}
          onBack={back}
          back="Back to the estimate"
          right={
            <>
              <Segmented value={panel.prices ? 'p' : 's'} onChange={(v) => setPanel({ t: 'paper', prices: v === 'p' })} items={[{ key: 's', label: 'Scope of work' }, { key: 'p', label: 'With prices' }]} className="max-sm:hidden" />
              <Button size="sm" variant="primary" icon={<Printer />} onClick={() => printNode(paperRef.current)}>Print or PDF</Button>
            </>
          }
        />
        {/* phones: the switch under the bar */}
        <div className="px-3 pt-3 sm:hidden"><Segmented value={panel.prices ? 'p' : 's'} onChange={(v) => setPanel({ t: 'paper', prices: v === 'p' })} items={[{ key: 's', label: 'Scope of work' }, { key: 'p', label: 'With prices' }]} className="w-full [&>button]:flex-1" /></div>
        <div className="px-6 py-6 max-sm:px-2"><EstimatePaper e={e} rev={shown} prices={!!panel.prices} innerRef={paperRef} /></div>
      </div>
    ) : panel?.t === 'revs' ? (
      <div className="min-h-full" data-panel="revs">
        <PanelBar title="Every revision" sub={`${e.revs.length} so far`} onBack={back} back="Back to the estimate" />
        <div className="mx-auto max-w-[52rem] px-6 py-5 max-sm:px-3"><RevisionsPanel e={e} onShow={(n) => { setRevN(n === cur.n ? null : n); setPanel(null) }} /></div>
      </div>
    ) : panel?.t === 'team' ? (
      <div className="min-h-full" data-panel="team">
        <PanelBar title="Who does what" sub="on this estimate" onBack={back} back="Back to the estimate" />
        <div className="mx-auto max-w-[30rem] px-6 py-5 max-sm:px-3"><TeamSlots compact team={team} now={inside ? (b as keyof EstTeam) : b === 'sent' ? 'follow' : null} onChange={(k, p) => setEstTeam(e.id, k, p)} /></div>
      </div>
    ) : panel?.t === 'same' ? (
      <div className="min-h-full" data-panel="same">
        <PanelBar title="Which project is it for?" sub={`${e.id} was made as “${j.name}”`} onBack={back} back="Back to the estimate" />
        <div className="mx-auto max-w-[40rem] px-6 py-5 max-sm:px-3"><SameJob e={e} onDone={() => setPanel(null)} /></div>
      </div>
    ) : panel?.t === 'log' ? (
      <div className="min-h-full" data-panel="log">
        <PanelBar title="What happened" sub={plural(e.log.length, 'thing')} onBack={back} back="Back to the estimate" />
        <div className="mx-auto max-w-[46rem] px-4 py-3">
          {[...e.log].reverse().map((l, i) => <ActivityRow key={i} jobId={e.jobId} e={{ date: l.date, who: l.who, kind: 'pricing', title: l.text, ref: { t: 'estimate', id: e.id } }} />)}
        </div>
      </div>
    ) : (
      desk
    )

  return (
    <Modal level={level} size="full" tall onClose={s.close} title={`${e.id} · ${j.name}`} header={header} footer={footer} bodyClass="p-0 lg:overflow-hidden">
      {panel ? (
        <div className="scroll-soft h-full min-h-0 lg:overflow-y-auto" data-est-body>{body}</div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-line bg-white px-4 py-2 lg:hidden">
            <Segmented value={side} onChange={setSide} items={[{ key: 'est', label: 'The estimate' }, { key: 'job', label: 'The job' }]} className="w-full [&>button]:flex-1" />
          </div>
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <div className={cn('scroll-soft min-h-0 min-w-0 lg:overflow-y-auto', side !== 'est' && 'max-lg:hidden')} data-est-body>{body}</div>
            <EstJob e={e} className={cn(side !== 'job' && 'max-lg:hidden')} onDoc={(doc) => setPanel({ t: 'doc', doc })} onTeam={canTeam ? () => setPanel({ t: 'team' }) : undefined} />
          </div>
        </div>
      )}
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
        {['', ...FLOORS].map((f) => <button key={f || 'none'} type="button" onClick={() => estSetArea(e.id, area, { floor: f || null })} className={cn('inline-flex h-7 items-center rounded-full border px-2.5 text-[0.78125rem] font-semibold', (meta?.floor || '') === f ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-[#c6bfb4]')}>{f || 'No floor'}</button>)}
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
  const presets = companyAreas(s)
  /* the floor the last room went on — the next one usually goes there too */
  const meta = curRev(e).areas || []
  const [floor, setFloor] = React.useState<string>(() => meta[meta.length - 1]?.floor || '')
  const add = (name: string) => { const p = presets.find((x) => x.name === name); if (p) estAddArea(e.id, p.name, p.surfaces, floor || undefined) }
  /* a new one: it goes on this estimate, and on the company's list for the next one */
  const addOwn = (name: string) => { const keys = guessSurfaces(name, presets); addCompanyArea(name, keys); estAddArea(e.id, name, keys, floor || undefined) }
  return (
    <div className="mt-4 rounded-[0.875rem] border border-dashed border-[#d6cfc3] bg-white/70 px-4 py-3" data-area-adder>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 text-[0.8125rem] font-semibold text-ink"><Layers className="h-4 w-4 text-muted" />Add an area<span className="font-normal text-muted">— it comes with its usual surfaces</span></div>
      <div className="grid grid-cols-[11rem_minmax(0,22rem)] gap-2 max-sm:grid-cols-1">
        <SearchSelect label="Floor" value={floor} onChange={setFloor} emptyLabel="No floor" options={FLOORS.map((f) => ({ key: f, label: f }))} search={false} width={220} plain />
        <SearchSelect
          label="Area"
          value=""
          onChange={add}
          placeholder="Pick or type an area…"
          options={presets.map((p) => ({ key: p.name, label: p.name, hint: `Comes with: ${p.surfaces.map((k) => surfaceOf(s, k).label.toLowerCase()).join(', ')}` }))}
          search
          searchPlaceholder="Type an area — Kitchen, Mikvah…"
          width={380}
          onCreate={addOwn}
          createLabel={(t) => `Add “${t}” — kept for next time`}
        />
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
    <div className={cn('flex items-start gap-2.5 border-b border-line-2 px-5 py-2 max-sm:px-3', n.done ? 'bg-white' : isAi ? 'bg-vio-50/70' : 'bg-warn-50/80')}>
      <button
        aria-label={n.done ? 'Mark not done' : 'Check it off'}
        onClick={() => estToggleNote(e.id, n.id)}
        className={cn('mt-[0.0625rem] inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border-2 transition', n.done ? 'border-ok-500 bg-ok-500 text-white' : 'border-[#c9c2b7] bg-white text-transparent hover:border-ok-500 hover:text-ok-500')}
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
      className="flex items-center gap-2 border-b border-line-2 bg-warn-50/60 px-5 py-2 max-sm:px-3"
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
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-vio-100 bg-gradient-to-r from-[#f6f4ff] to-white px-3.5 py-2.5">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-vio-600 ring-1 ring-vio-100"><Sparkles className="h-4 w-4" /></span>
      {/* the documents themselves are on the right, with the job — here only what AI does with the plans */}
      <div className="min-w-0 flex-1">
        <div className="text-[0.875rem] font-semibold text-ink">{filled ? 'Fill in the square feet from the plans' : 'Draft the takeoff from the plans'}</div>
        <div className="mt-0.5 text-[0.78125rem] text-muted">{hasPlans ? 'AI reads them and fills in the rooms and square feet — you check every number.' : 'Upload the plans and AI drafts the rooms and square feet.'}</div>
      </div>
      <span className="flex shrink-0 items-center gap-3 max-sm:w-full max-sm:justify-end">
        <button onClick={() => file.current?.click()} className={cn(hasPlans ? 'text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700' : 'inline-flex h-9 items-center gap-2 rounded-lg bg-brand-600 px-3.5 text-[0.8125rem] font-semibold text-white hover:bg-brand-700')}>
          {hasPlans ? 'Newer plans' : <><Upload className="h-4 w-4" />Upload the plans</>}
        </button>
        {hasPlans && <Button size="sm" variant="primary" icon={<Sparkles />} onClick={() => s.open({ t: 'aiplans', estId: e.id })}>Read the plans</Button>}
        <input ref={file} type="file" accept=".pdf,image/*" className="hidden" onChange={(x) => { const f = x.target.files?.[0]; if (!f) return; plansUploaded(e.jobId, f.name); setTimeout(() => s.open({ t: 'aiplans', estId: e.id }), 80); x.target.value = '' }} />
      </span>
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
                <div className="bg-[#f1eee8] px-4 py-2 text-[0.78125rem] font-semibold text-ink">{room}{d.rows.find((r) => r.room === room)?.option ? <span className="ml-2 normal-case tracking-normal text-warn-700">· option</span> : null}</div>
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

/** the bid's due date — tap it to move it */
function DueEdit({ id, due }: { id: string; due?: string }) {
  const [open, setOpen] = React.useState(false)
  const late = !!due && (isoFromLabel(due) || '9') < TODAY
  return (
    <Pop open={open} onOpenChange={setOpen} align="start" width={380} trigger={
      <button className={cn('inline-flex items-center gap-1 rounded-md font-medium hover:text-brand-700', late ? 'text-bad-600' : 'text-ink-2')} aria-label="Change the due date">
        {due ? (labelFromIso(isoFromLabel(due) || '') || due) : 'Set a date'}<ChevronDown className="h-3.5 w-3.5 text-faint" />
      </button>
    }>
      <div className="text-[0.875rem] font-semibold text-ink">When is the bid due?</div>
      <div className="mt-3"><DatePresets value={due} onPick={(d) => { setEstimateDue(id, d); setOpen(false) }} presets={['Today', 'Tomorrow', 'Fri', 'Next Mon']} /></div>
    </Pop>
  )
}


/** a line that was on the revision before and isn't on this one */
function RemovedRow({ d }: { d: LineDiff }) {
  const a = d.a!
  return (
    <div className="border-b border-[#f1ede6] bg-bad-50/40 px-5 py-1.5 max-sm:px-3">
      <div className={cn(SHEET_GRID, 'max-sm:flex max-sm:items-center max-sm:justify-between')}>
        <div className="min-w-0 pr-3">
          <div className="flex items-center gap-2"><span className="truncate text-[0.875rem] text-bad-700 line-through">{d.name}</span><span className="shrink-0 rounded-full bg-bad-50 px-1.5 text-[0.6875rem] font-semibold text-bad-700 ring-1 ring-bad-100">Removed</span></div>
        </div>
        <span className="pr-1.5 text-right text-[0.875rem] tnum text-bad-600 line-through max-sm:hidden">{a.qty.toLocaleString('en-US')}</span>
        <span className="pl-2 text-[0.8125rem] text-muted max-sm:hidden">{d.unit}</span>
        <span className="pr-1.5 text-right text-[0.875rem] tnum text-bad-600 line-through max-sm:hidden">{fmtMoney(a.rate, { cents: a.rate % 1 !== 0 })}</span>
        <span className="text-right text-[0.875rem] tnum text-bad-600 line-through">{fmtMoney(a.qty * a.rate)}</span>
        <span className="max-sm:hidden" />
      </div>
    </div>
  )
}

/** one line of the estimate — the words the client reads, the item it's priced with beside them, then the numbers */
function LineRow({ e, l, editable, diff }: { e: Estimate; l: EstLine; editable: boolean; diff?: LineDiff }) {
  const s = useStore()
  const it = s.items.find((i) => i.id === l.itemId)
  const was = diff?.kind === 'changed' ? diff.a : undefined
  const set = (p: Partial<EstLine>) => estEditLines(e.id, (L) => L.map((x) => (x.id === l.id ? { ...x, ...p } : x)))
  const remove = editable && (
    <button aria-label="Remove line" onClick={() => estEditLines(e.id, (L) => L.filter((x) => x.id !== l.id))} className="inline-flex h-7 w-7 items-center justify-center justify-self-end rounded-md text-faint transition hover:bg-bad-50 hover:text-bad-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
  const main = paperText(l, it?.name, e.jobId)
  const sub = it && it.name !== main ? it.name : it && it.type === 'material' && it.vendor ? it.vendor : ''
  const name = (
    <div className="min-w-0 pr-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="min-w-0 shrink-0 truncate text-[0.875rem] text-ink max-w-[72%]">{main}</span>
        {sub && <span className="min-w-0 truncate text-[0.75rem] text-faint max-sm:hidden">{sub}</span>}
        {diff?.kind === 'added' && <span className="shrink-0 self-center rounded-full bg-ok-50 px-1.5 text-[0.6875rem] font-semibold text-ok-700 ring-1 ring-ok-100">New</span>}
        {was && <span className="shrink-0 self-center rounded-full bg-warn-50 px-1.5 text-[0.6875rem] font-semibold text-warn-700 ring-1 ring-warn-100">Changed</span>}
      </div>
      {was && <div className="truncate text-[0.75rem] font-medium text-warn-700">was {[was.qty !== l.qty ? `${was.qty.toLocaleString('en-US')} ${it?.unit || ''}`.trim() : '', was.rate !== l.rate ? `${fmtMoney(was.rate, { cents: was.rate % 1 !== 0 })}${was.qty !== 1 || was.qty !== l.qty ? (it?.unit && it.unit !== 'LS' ? `/${it.unit}` : '') : ''}` : '', was.qty !== 1 ? `= ${fmtMoney(was.qty * was.rate)}` : ''].filter(Boolean).join(' · ')}</div>}
    </div>
  )
  const unit = it?.unit === 'LS' ? 'EA' : it?.unit
  return (
    <div className={cn('group border-b border-[#f1ede6] px-5 py-px last:border-b-0 max-sm:px-3 max-sm:py-2', diff?.kind === 'added' && 'bg-ok-50/40', was && 'bg-warn-50/40')} data-line={l.id}>
      {/* laptops: one row, the columns of the green band */}
      <div className={cn(SHEET_GRID, 'max-sm:hidden')}>
        {name}
        <span className="text-right">{editable ? <NumIn value={l.qty} onChange={(n) => set({ qty: n })} label={`Quantity · ${it?.name}`} /> : <span className="pr-1.5 text-[0.875rem] tnum text-ink-2">{l.qty.toLocaleString('en-US')}</span>}</span>
        <span className="pl-2 text-[0.8125rem] text-muted">{unit}</span>
        <span className="text-right">{editable ? <NumIn value={l.rate} onChange={(n) => set({ rate: n })} label={`Rate · ${it?.name}`} money /> : <span className="pr-1.5 text-[0.875rem] tnum text-ink-2">{fmtMoney(l.rate, { cents: l.rate % 1 !== 0 })}</span>}</span>
        <span className="text-right text-[0.875rem] font-medium tnum text-ink">{fmtMoney(l.qty * l.rate)}</span>
        {remove || <span />}
      </div>
      {/* phones: the words and the amount, then quantity × rate */}
      <div className="sm:hidden">
        <div className="flex items-start justify-between gap-3">
          {name}
          <span className="shrink-0 text-[0.875rem] font-medium tnum text-ink">{fmtMoney(l.qty * l.rate)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[0.8125rem] text-muted">
          {editable ? <NumIn value={l.qty} onChange={(n) => set({ qty: n })} label={`Quantity · ${it?.name}`} /> : <span className="tnum">{l.qty.toLocaleString('en-US')}</span>}
          <span>{unit} ×</span>
          {editable ? <NumIn value={l.rate} onChange={(n) => set({ rate: n })} label={`Rate · ${it?.name}`} money /> : <span className="tnum">{fmtMoney(l.rate, { cents: l.rate % 1 !== 0 })}</span>}
          <span className="ml-auto">{remove}</span>
        </div>
      </div>
    </div>
  )
}

/** a number you can change that reads like a number — no box until you point at it */
function NumIn({ value, onChange, label, money }: { value: number; onChange: (n: number) => void; label: string; money?: boolean }) {
  const [v, setV] = React.useState(String(value))
  const [on, setOn] = React.useState(false)
  const cancel = React.useRef(false)
  const shown = on ? v : money ? fmtMoney(value, { cents: value % 1 !== 0 }) : value.toLocaleString('en-US')
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={shown}
      onFocus={(x) => { cancel.current = false; setV(String(value)); setOn(true); const el = x.currentTarget; requestAnimationFrame(() => el.select()) }}
      onChange={(x) => setV(x.target.value)}
      onBlur={() => { setOn(false); if (cancel.current) return; const n = Number(v.replace(/[^0-9.]/g, '')); if (v.trim() !== '' && !isNaN(n) && n !== value) onChange(n) }}
      onKeyDown={(x) => { if (x.key === 'Enter') (x.target as HTMLInputElement).blur(); if (x.key === 'Escape') { cancel.current = true; (x.target as HTMLInputElement).blur() } }}
      className="h-7 w-full max-w-[5.75rem] rounded-md border border-transparent bg-transparent px-1.5 text-right text-[0.875rem] tnum text-ink transition hover:border-[#e2dcd2] hover:bg-[#faf8f4] focus:border-brand-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100 max-sm:w-[4.75rem] max-sm:border-[#e2dcd2] max-sm:bg-[#faf8f4]"
    />
  )
}

/** pick one of our QuickBooks items: type to find it; not on the list — add it as a new item (its price goes on the
 *  line, and it's on Items for next time) */
export function ItemPicker({ onPick, label = 'Add item', types }: { onPick: (it: Store['items'][number]) => void; label?: string; types?: ('labor' | 'material' | 'other')[] }) {
  const s = useStore()
  const groups = (['labor', 'material', 'other'] as const).filter((t) => !types || types.includes(t))
  const options = groups.flatMap((t) => s.items.filter((i) => i.type === t && i.id !== 'o-room').map((i) => ({ key: i.id, label: i.name, hint: `${t === 'other' ? 'Other' : ITEM_TYPE_LABEL[t]} · ${i.price ? `${fmtMoney(i.price, { cents: i.price % 1 !== 0 })} / ${i.unit}` : `priced on the line · ${i.unit}`}${i.vendor ? ' · ' + i.vendor : ''}` })))
  const create = (name: string) => {
    const type = types?.length === 1 ? types[0] : /install|labor|setting|demo|prep|grouting|waterproofing|leveling/i.test(name) ? 'labor' : 'material'
    const it = { id: 'n' + Date.now().toString(36), name, type, unit: type === 'labor' || /tile|stone|marble|mosaic/i.test(name) ? 'SF' : 'EA', price: 0, cost: 0, qb: name } as Store['items'][number]
    s.commit((st) => { st.items.push(it) }, `${name} — a new item`, { sub: 'Put its price on the line. It’s on Items now, for next time.' })
    onPick(it)
  }
  return (
    <SearchSelect
      label={label}
      value=""
      onChange={(k) => { const it = useStore.getState().items.find((x) => x.id === k); if (it) onPick(it) }}
      options={options}
      search
      searchPlaceholder="Search the items…"
      width={400}
      onCreate={create}
      createLabel={(t) => `Add “${t}” as a new item`}
      trigger={<button type="button" aria-label={label} data-item-picker className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.84375rem] font-medium text-brand-700 hover:bg-brand-50"><Plus className="h-4 w-4" />{label}</button>}
    />
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

/* ---------------- what goes to the client: the estimate exactly as they get it ---------------- */
export function EstSendModal({ id, sent, level }: { id: string; sent?: boolean; level: number }) {
  const s = useStore()
  const e = s.estimates.find((x) => x.id === id)
  const ref = React.useRef<HTMLDivElement>(null)
  if (!e) return null
  const j = s.jobs[e.jobId]
  const rev = sent ? [...e.revs].reverse().find((r) => r.sentOn) || curRev(e) : curRev(e)
  const c = j ? s.clients[j.clientId] : undefined
  const to = c?.contacts?.find((x) => x.email)?.email || c?.email || ''
  const blocked = openNotes(e).length > 0
  return (
    <Modal
      level={level}
      size="xl"
      tall
      onClose={s.close}
      title={sent ? `What ${j?.client || 'the client'} got` : `Send ${e.id} to ${j?.client || 'the client'}`}
      sub={sent ? `Revision ${rev.n}${rev.sentOn ? ` · sent ${rev.sentOn}` : ''}` : 'This is exactly what they get — check it, then send it'}
      bodyClass="p-0"
      footer={
        <>
          <Button variant="ghost" icon={<Printer />} onClick={() => printNode(ref.current)}>Download PDF</Button>
          {sent ? (
            <Button className="ml-auto" onClick={s.close}>Close</Button>
          ) : (
            <>
              <Button className="ml-auto" variant="ghost" onClick={s.close}>Not yet</Button>
              <Tip label={blocked ? 'Check off every note first' : 'It goes out, and the follow-up starts'}>
                <span><Button variant="primary" icon={<Send />} disabled={blocked} onClick={() => { s.close(); estHandOff(e.id) }}>Approve and send</Button></span>
              </Tip>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line bg-white px-6 py-3 text-[0.84375rem] max-sm:px-4">
        <span><span className="text-muted">To </span><b className="font-semibold text-ink">{j?.client}</b>{to ? <span className="text-muted"> · {to}</span> : ''}</span>
        <span><span className="text-muted">Subject </span><span className="text-ink">Estimate {e.id} · {j?.name}{rev.n > 1 ? ` · revision ${rev.n}` : ''}</span></span>
        <span className="inline-flex items-center gap-1.5 text-ink-2"><FileText className="h-4 w-4 text-muted" />{e.id}{rev.n > 1 ? `-R${rev.n}` : ''}.pdf</span>
      </div>
      <div className="bg-wash px-6 py-5 max-sm:px-2">
        <EstimatePaper e={e} rev={rev} innerRef={ref} />
      </div>
    </Modal>
  )
}

/* ---------------- the client wants changes — as many as they asked for ---------------- */
export function EstChangesModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  const e = s.estimates.find((x) => x.id === id)
  const [rows, setRows] = React.useState<{ text: string; area: string }[]>([{ text: '', area: '' }])
  const [asked, setAsked] = React.useState('Email')
  if (!e) return null
  const cur = curRev(e)
  const areas = Array.from(new Set([...(cur.areas || []).map((a) => a.name), ...cur.lines.map((l) => l.area)]))
  const list = rows.filter((r) => r.text.trim())
  const set = (i: number, p: Partial<{ text: string; area: string }>) => setRows((xs) => xs.map((x, k) => (k === i ? { ...x, ...p } : x)))
  const more = (after: number) => { setRows((xs) => [...xs.slice(0, after + 1), { text: '', area: '' }, ...xs.slice(after + 1)]); setTimeout(() => document.getElementById(`chg-${after + 1}`)?.focus(), 30) }
  const go = () => {
    estRevise(e.id, list.length === 1 ? list[0].text.trim() : `${list.length} changes`, { changes: list.map((r) => ({ text: r.text.trim(), area: r.area || undefined })), asked: `Asked by ${asked.toLowerCase()}` })
    s.close()
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="What do they want changed?"
      sub={`One line for each thing they asked — revision ${cur.n + 1} starts with all of them, and each one is checked off as it’s done`}
      footer={
        <>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" disabled={!list.length} onClick={go}>Start revision {cur.n + 1}{list.length > 1 ? ` · ${list.length} changes` : ''}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-right text-[0.8125rem] font-semibold tnum text-faint">{i + 1}</span>
            <TextInput
              id={`chg-${i}`}
              data-autofocus={i === 0 || undefined}
              value={r.text}
              onChange={(x) => set(i, { text: x.target.value })}
              onKeyDown={(x) => { if (x.key === 'Enter') { x.preventDefault(); if (r.text.trim()) more(i) } }}
              placeholder={i === 0 ? 'e.g. Take the basement bath out' : 'Another change'}
              aria-label={`Change ${i + 1}`}
              className="h-10 min-w-0 flex-1"
            />
            <Menu align="end" width={240} trigger={<button type="button" className="inline-flex h-10 max-w-[10rem] shrink-0 items-center gap-1 truncate rounded-lg border border-line px-2.5 text-[0.8125rem] font-medium text-ink-2 hover:bg-wash">{r.area || 'Whole estimate'}<ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" /></button>}>
              <MenuLabel>Which room</MenuLabel>
              <MenuItem checked={!r.area} onSelect={() => set(i, { area: '' })}>Whole estimate</MenuItem>
              {areas.map((a) => <MenuItem key={a} checked={r.area === a} onSelect={() => set(i, { area: a })}>{a}</MenuItem>)}
            </Menu>
            {rows.length > 1 && <button type="button" aria-label={`Remove change ${i + 1}`} onClick={() => setRows((xs) => xs.filter((_, k) => k !== i))} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-faint hover:bg-bad-50 hover:text-bad-600"><X className="h-4 w-4" /></button>}
          </div>
        ))}
        <button type="button" onClick={() => more(rows.length - 1)} className="ml-7 mt-1 self-start text-[0.8125rem] font-semibold text-brand-600 hover:underline">+ Add another change</button>
      </div>
      <Field label="How did they ask?" className="mt-5">
        <div className="flex flex-wrap gap-1.5">{['Email', 'Phone', 'In person', 'Text'].map((x) => <Chip key={x} on={asked === x} onClick={() => setAsked(x)} className="h-8 px-2.5 text-[0.84375rem]">{x}</Chip>)}</div>
      </Field>
    </Modal>
  )
}

export function EstFollowModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  return (
    <Modal level={level} size="sm" onClose={s.close} title="Log a follow-up" sub="What happened, and when to try again">
      <FollowUpForm onSave={(o) => { estFollowUp(id, o); s.close() }} />
    </Modal>
  )
}

export function EstLostModal({ id, level }: { id: string; level: number }) {
  const s = useStore()
  return (
    <Modal level={level} size="sm" onClose={s.close} title="Not going ahead" sub="Why? It’s kept for the record.">
      <div className="flex flex-col gap-1.5">
        {['Went with another installer', 'Price too high', 'Project cancelled', 'No answer'].map((r) => (
          <button key={r} onClick={() => { estLost(id, r); s.closeAll() }} className="rounded-lg border border-line px-3 py-2.5 text-left text-[0.875rem] font-medium text-ink-2 transition hover:border-bad-200 hover:bg-bad-50/50 hover:text-bad-700">{r}</button>
        ))}
      </div>
    </Modal>
  )
}

/** the same job made twice — an estimate on its own, and the project: pick the project, and the estimate goes on it */
function SameJob({ e, onDone }: { e: Estimate; onDone: () => void }) {
  const s = useStore()
  const [q, setQ] = React.useState('')
  const [pick, setPick] = React.useState<string | null>(null)
  const list = sameJobCandidates(s, e.jobId, q).slice(0, 8)
  const to = pick ? s.jobs[pick] : undefined
  const from = s.jobs[e.jobId]
  return (
    <div>
      <p className="text-[0.875rem] leading-snug text-ink-2">Pick the project. The estimate goes on it — its tasks, files and messages too — and it says the project’s name everywhere: on Today, in the inbox, on the estimate.</p>
      <TextInput className="mt-4" aria-label="Find the project" value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Find the project — name, client or address" />
      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
        {list.map(({ j, score }) => (
          <button key={j.id} data-same={j.id} onClick={() => setPick(j.id)} className={cn('flex w-full items-center gap-3 border-t border-line-2 px-4 py-2.5 text-left transition first:border-t-0 hover:bg-[#f7f5f0]', pick === j.id && 'bg-brand-50/60')}>
            <span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', pick === j.id ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-white')}>{pick === j.id && <Check className="h-3 w-3" strokeWidth={3} />}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.90625rem] font-semibold text-ink">{j.name}{score >= 2 && <span className="ml-2 rounded-full bg-ok-50 px-1.5 py-px text-[0.6875rem] font-semibold text-ok-700">Looks like the one</span>}</span>
              <span className="block truncate text-[0.78125rem] text-muted">{[j.client, j.address].filter(Boolean).join(' · ')}</span>
            </span>
          </button>
        ))}
        {!list.length && <div className="px-4 py-6 text-center text-[0.84375rem] text-muted">No project like that.</div>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
        <Button variant="primary" icon={<ArrowRight />} disabled={!to} onClick={() => { if (to) { moveEstimateTo(e.id, to.id); onDone() } }}>{to ? `Put it on ${to.name}` : 'Pick the project'}</Button>
      </div>
      {from && <p className="mt-3 text-[0.78125rem] text-muted">“{from.name}” goes away — it was the same job.</p>}
    </div>
  )
}
