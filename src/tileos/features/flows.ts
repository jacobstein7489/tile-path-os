/* Every "button that does something" lives here.
 * Each flow records the event once and routes the consequences:
 * stage, tasks for the right people, money, materials, schedule, and history. */
import { toast } from '@/tileos/lib/pop'
import { isoOfDay, parseTime } from '@/tileos/data/calendar'
import { useStore, addHist, newTask, closeTasks, setIssues, NOW, meOf, recalc, type Store } from '@/tileos/store'
import type { PersonKey, Stage, SwatchKey, Role } from '@/tileos/data/model'
import { fmtMoney, PEOPLE } from '@/tileos/data/model'
import type { Task, MoneyItem } from '@/tileos/data/work'
import { surfacePct, tileOf } from '@/tileos/data/jobs'
import type { Media } from '@/tileos/data/field'
import { nextRef, nextPO } from '@/tileos/lib/utils'
import { approveEstimateInAward } from './flows2'
import { qbLive, pushBill, pushPayment, emailBill, pushEstimate } from './qbsync'
import { mailLive, emailPO, emailIPO } from './mailout'
import { REAL } from '@/tileos/lib/save'
import { TODAY, MONDAY, addDays, md, dayShort, workday, shiftISO, shiftText } from '@/tileos/lib/today'

const S = () => useStore.getState()
const me = () => meOf(S().role)
const L = (who: PersonKey, text: string) => ({ date: NOW, who, text })

/* ---------------- task actions ---------------- */
/** who orders our materials and takes deliveries (Settings → Company rules; the site manager by default) */
export const matBy = (s: { rules: { matBy?: PersonKey } }): PersonKey => s.rules?.matBy || 'yakov'
export const matFor = (s: { rules: { matBy?: PersonKey }; team?: { key: PersonKey; role: Role }[] }): Role[] => [((s.team || []).find((m) => m.key === matBy(s))?.role || 'site') as Role]

export function runTaskAction(t: Task) {
  const s = S()
  const kind = t.action?.kind || ''
  if (kind.startsWith('money:')) return s.open({ t: 'money', id: kind.slice(6) })
  if (kind.startsWith('po:')) return s.open({ t: 'po', id: kind.slice(3) })
  if (kind === 'crew-confirm') return confirmCrew(t.id)
  if (kind.startsWith('co:')) return s.open({ t: 'coapprove', id: kind.slice(3) })
  if (kind.startsWith('ipo:')) {
    const [, ipo, co] = kind.split(':')
    return co ? acceptIPOChange(ipo, co, t.id) : s.open({ t: 'ipo', id: ipo })
  }
  if (kind.startsWith('estimate:')) return s.open({ t: 'estimate', id: kind.slice(9) })
  if (kind.startsWith('estchange:')) return s.open({ t: 'estimate', id: kind.slice(10) })
  if (kind.startsWith('order:')) return s.open({ t: 'newpo', jobId: kind.slice(6), fromTakeoff: true })
  if (kind.startsWith('short:')) return s.open({ t: 'short', id: kind.slice(6) })
  if (kind.startsWith('heights:')) return s.open({ t: 'heights', jobId: kind.slice(8), taskId: t.id })
  if (kind.startsWith('pay:')) { const [, crew, week] = kind.split(':'); return s.open({ t: 'pay', crew, week }) }
  if (kind === 'crewreport') return s.open({ t: 'crewreport', taskId: t.id })
  if (kind === 'upcoming') return s.open({ t: 'readytobook' })
  if (kind.startsWith('ipoaccept:')) return acceptIPO(kind.slice(10), t.id)
  if (kind.startsWith('walk-done:')) return walkDone(kind.slice(10), t.id)
  if (kind === 'gc-confirm') return gcConfirmed(t.id)
  /* the touch-ups open as their own list, every touch-up its own line */
  if (kind === 'tab:touchups') return s.open({ t: 'touchups', jobId: t.jobId })
  if (kind.startsWith('tab:')) return s.open({ t: 'job', id: t.jobId, tab: kind.slice(4) })
  switch (kind) {
    case 'open-job': return s.open({ t: 'job', id: t.jobId })
    case 'schedule': return s.open({ t: 'readytobook' })
    case 'assign': return s.open({ t: 'assign', jobId: t.jobId })
    case 'followup': return s.open({ t: 'followup', jobId: t.jobId })
    case 'drain': return s.open({ t: 'drain' })
    case 'co004': return s.open({ t: 'co004' })
    case 'thinset': return s.open({ t: 'thinset' })
    case 'qty114': return s.open({ t: 'qty', jobId: '114', tag: 'T-04' })
    case 'po530': return s.open({ t: 'newpo', jobId: '530' })
    case 'receive-jolly': return s.open({ t: 'receive', matId: 'om5' })
    case 'po-confirm': return s.open({ t: 'po', id: 'PO-1045' })
    case 'follow': return s.open({ t: 'po', id: 'PO-1042' })
    case 'verify': return s.open({ t: 'verify', taskId: t.id })
    case 'meeting-wilk': return s.open({ t: 'meeting', taskId: t.id })
    case 'heights-mdrive': return s.open({ t: 'heights', jobId: 'mdrive', taskId: t.id })
    default: return s.open({ t: 'job', id: t.jobId })
  }
}

/* ================= pricing ================= */
export function assignEstimator(jobId: string, who: PersonKey) {
  S().commit((s) => {
    s.pricing[jobId].estimator = who
    s.jobs[jobId].estimator = who
    s.jobs[jobId].next = { text: 'Start estimating', owner: who, due: s.pricing[jobId].due }
    closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && /estimator/i.test(t.title)).map((t) => t.id), 'Estimator assigned')
    addHist(s, jobId, { who: me(), kind: 'pricing', title: `${PEOPLE[who].name} assigned to estimate` })
  }, `${PEOPLE[who].name} will estimate it`)
}

export function requestDoc(jobId: string, doc: string) {
  S().commit((s) => {
    const d = s.pricing[jobId].docs.find((x) => x.name === doc)
    if (d) d.note = 'Requested today · follow up Thu'
    newTask(s, { jobId, title: `${doc} from the GC`, type: 'Pricing', owner: 'office', for: ['office'], state: 'waiting', waitingOn: 'GC', followUp: 'Thu', tone: 'warn', blocks: 'Finishing the estimate', where: 'Documents', log: [L(me(), `Requested ${doc.toLowerCase()} from the GC`)] })
    addHist(s, jobId, { who: me(), kind: 'pricing', title: `Requested the ${doc.toLowerCase()} from the GC`, detail: 'Comes back Thursday if nothing arrives' })
  }, `Requested — comes back Thursday`)
}

export function markDocIn(jobId: string, doc: string) {
  S().commit((s) => {
    const p = s.pricing[jobId]
    const d = p.docs.find((x) => x.name === doc)
    if (d) {
      d.status = 'in'
      d.note = 'Received today'
    }
    closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && t.title.startsWith(doc)).map((t) => t.id), 'Received')
    const missing = p.docs.filter((x) => x.status === 'missing')
    setIssues(s, jobId, (iss) => iss.filter((i) => !i.text.toLowerCase().includes(doc.toLowerCase())))
    if (!missing.length && s.jobs[jobId].stage === 'request') {
      s.jobs[jobId].headline = 'All documents in · ready to estimate'
      s.jobs[jobId].status = 'ok'
    }
    addHist(s, jobId, { who: me(), kind: 'pricing', title: `${doc} received` })
  }, `${doc} marked received`)
}

const TAKEOFF_AREAS: Record<string, string[]> = {
  b1: ['Bath 1', 'Bath 2', 'Kitchen backsplash'],
  b2: ['Lobby floor', 'Elevator walls'],
}
export function startEstimating(jobId: string) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    const p = s.pricing[jobId]
    j.stage = 'estimating'
    if (!p.takeoff) p.takeoff = { pct: 0, areas: (TAKEOFF_AREAS[jobId] || ['Area 1', 'Area 2']).map((n) => ({ name: n, sf: '—', done: false })) }
    j.headline = 'Takeoff started'
    j.status = p.docs.some((d) => d.status === 'missing') ? 'warn' : 'ok'
    j.next = { text: 'Finish the estimate', owner: p.estimator || 'estimator', due: p.due }
    j.keyDate = { label: 'Due', value: p.due }
    newTask(s, { jobId, title: `Estimate ${j.name}`, type: 'Pricing', owner: p.estimator || 'estimator', for: ['estimator'], state: 'now', due: p.due, tone: 'info', where: 'Estimate', action: { label: 'Open estimate', kind: 'open-job' } })
    addHist(s, jobId, { who: p.estimator || 'estimator', kind: 'pricing', title: 'Estimating started' })
  }, 'Estimating started — it’s in the estimator’s queue')
}

export function toggleArea(jobId: string, i: number) {
  S().commit((s) => {
    const t = s.pricing[jobId].takeoff
    if (!t) return
    t.areas[i].done = !t.areas[i].done
    if (t.areas[i].done && t.areas[i].sf === '—') t.areas[i].sf = `${300 + i * 140} SF`
    t.pct = Math.round((t.areas.filter((a) => a.done).length / t.areas.length) * 100)
  })
}
export function answerEstimQuestion(jobId: string, answer: string) {
  S().commit((s) => {
    const t = s.pricing[jobId].takeoff
    if (t?.question) {
      addHist(s, jobId, { who: me(), kind: 'decision', title: `Answer: ${answer}`, detail: t.question.text })
      t.question = undefined
    }
    closeTasks(s, s.tasks.filter((x) => x.jobId === jobId && x.state === 'waiting' && x.type === 'Pricing').map((x) => x.id), 'Answered')
    setIssues(s, jobId, (iss) => iss.filter((i) => !/question/i.test(i.text)))
  }, 'Answer saved to the estimate')
}

export function estimateReady(jobId: string, amount: number) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    const p = s.pricing[jobId]
    j.stage = 'proposal'
    const n = p.revs.length + 1
    p.revs.push({ r: 'R' + n, date: '—', amount, status: 'Draft', what: n === 1 ? 'Original scope' : 'Revision' })
    j.headline = `Estimate ready · R${n} to send`
    j.status = 'info'
    j.next = { text: `Send R${n}`, owner: 'office', due: 'Today' }
    closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && t.owner === 'estimator' && t.state === 'now').map((t) => t.id), 'Estimate ready')
    newTask(s, { jobId, title: `Send the ${j.name} proposal`, type: 'Pricing', owner: 'office', for: ['office'], state: 'now', due: 'Today', dueTone: 'warn', tone: 'info', where: `R${n} · ${fmtMoney(amount)}`, action: { label: 'Open', kind: 'open-job' } })
    addHist(s, jobId, { who: p.estimator || 'estimator', kind: 'pricing', title: `Estimate ready · R${n} ${fmtMoney(amount)}` })
  }, 'Estimate ready — the office can send it')
}

export function setRevAmount(jobId: string, r: string, amount: number) {
  S().commit((s) => {
    const rev = s.pricing[jobId].revs.find((x) => x.r === r)
    if (rev) rev.amount = amount
  })
}

export function sendProposal(jobId: string) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    const p = s.pricing[jobId]
    const draft = [...p.revs].reverse().find((r) => r.status === 'Draft' || r.status === 'Pricing')
    if (!draft) return
    p.revs.forEach((r) => {
      if (r.status === 'Sent') r.status = 'Superseded'
    })
    draft.status = 'Sent'
    draft.date = NOW
    if (!draft.amount) draft.amount = Math.round(((p.revs.find((r) => r.amount)?.amount || 60000) * 0.86) / 100) * 100
    j.stage = 'followup'
    j.status = 'ok'
    j.headline = `${draft.r} sent today`
    j.keyDate = { label: 'Sent', value: NOW }
    j.next = { text: `Follow up on ${draft.r}`, owner: 'office', due: 'Thu' }
    p.nextFollowUp = shiftText('Thu Oct 1')
    closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && t.state !== 'done').map((t) => t.id), 'Proposal sent')
    newTask(s, { jobId, title: `${j.name} decision on ${draft.r}`, type: 'Pricing', owner: 'office', for: ['office'], watch: ['owner'], state: 'waiting', waitingOn: 'Client', followUp: 'Thu', tone: 'neutral', where: `${draft.r} · ${fmtMoney(draft.amount!)}`, action: { label: 'Record follow-up', kind: 'followup' }, log: [L(me(), `${draft.r} sent`)] })
    addHist(s, jobId, { who: me(), kind: 'pricing', title: `${draft.r} sent · ${fmtMoney(draft.amount!)}`, detail: 'First follow-up set for Thursday' })
  }, 'Proposal sent — follow-up set for Thursday')
}

export function recordFollowUp(jobId: string, o: { how: string; outcome: string; next?: string; note?: string; changes?: string }) {
  const s0 = S()
  const j0 = s0.jobs[jobId]
  if (o.outcome === 'approved') {
    s0.commit((s) => {
      s.pricing[jobId].fu.push({ date: NOW, how: o.how, outcome: 'Approved', by: me(), note: o.note })
      addHist(s, jobId, { who: me(), kind: 'pricing', title: `${o.how} — approved`, detail: o.note })
    })
    s0.swap({ t: 'award', jobId })
    return
  }
  if (o.outcome === 'lost') {
    s0.commit((s) => {
      s.lost.unshift({ name: j0.name, client: j0.client, reason: o.note || 'Not proceeding', date: NOW })
      closeTasks(s, s.tasks.filter((t) => t.jobId === jobId).map((t) => t.id), 'Not proceeding')
      delete s.jobs[jobId]
    }, `${j0.name} moved to not won`)
    s0.closeAll()
    return
  }
  const labels: Record<string, string> = { reviewing: 'Still reviewing', noanswer: 'No answer', later: 'Call back later', revision: 'Revision requested' }
  s0.commit((s) => {
    const j = s.jobs[jobId]
    const p = s.pricing[jobId]
    p.fu.push({ date: NOW, how: o.how, outcome: labels[o.outcome], by: me(), note: o.changes || o.note })
    addHist(s, jobId, { who: me(), kind: 'pricing', title: `${o.how} — ${labels[o.outcome].toLowerCase()}`, detail: o.changes || o.note })
    const open = s.tasks.filter((t) => t.jobId === jobId && t.type === 'Pricing' && t.state !== 'done')
    if (o.outcome === 'revision') {
      const n = p.revs.length + 1
      p.revs.forEach((r) => {
        if (r.status === 'Sent') r.status = 'Superseded'
      })
      p.revs.push({ r: 'R' + n, date: '—', amount: null, status: 'Pricing', what: o.changes || 'Changes requested' })
      j.stage = 'proposal'
      j.status = 'info'
      j.headline = `Revision requested · ${o.changes || 'changes'}`
      j.next = { text: `Price Revision ${n}`, owner: 'estimator', due: 'Wed' }
      closeTasks(s, open.map((t) => t.id), 'Revision requested')
      newTask(s, { jobId, title: `Price Revision ${n} · ${o.changes || 'changes requested'}`, type: 'Pricing', owner: 'estimator', for: ['estimator'], state: 'now', due: 'Wed', tone: 'info', where: `R${n}`, detail: `Revision ${n - 1} stays intact for reference.`, action: { label: 'Open', kind: 'open-job' } })
      p.nextFollowUp = undefined
    } else {
      const back = o.next || 'Fri'
      p.nextFollowUp = back
      j.headline = `${labels[o.outcome]} · ${o.how.toLowerCase()} today`
      j.status = o.outcome === 'noanswer' ? 'warn' : 'ok'
      j.next = { text: 'Follow up', owner: me(), due: back }
      if (open.length) {
        open.forEach((t) => {
          t.state = 'waiting'
          t.waitingOn = 'Client'
          t.followUp = back
          t.log.push(L(me(), `${o.how} — ${labels[o.outcome].toLowerCase()} · back ${back}`))
        })
      } else newTask(s, { jobId, title: `${j.name} decision`, type: 'Pricing', owner: me(), for: [s.role], state: 'waiting', waitingOn: 'Client', followUp: back, tone: 'neutral', action: { label: 'Record follow-up', kind: 'followup' } })
    }
  }, o.outcome === 'revision' ? 'Revision opened for the estimator' : `Logged — it comes back ${o.next || 'Fri'}`)
  s0.close()
}

const AWARD_SWATCH: Record<string, SwatchKey> = { b7: 'travertine', b5: 'terrazzo', b6: 'bianco', b3: 'zellige', b1: 'subway', b2: 'calacatta', b4: 'herringbone' }
/** "Week of Oct 12" → 2026-10-12 · "November" → the first Monday · "Not known yet" → nothing */
export function startWindowISO(w: string): string | undefined {
  const m = w.match(/([A-Z][a-z]{2})[a-z]* (\d{1,2})/)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const yearOf = (mi: number) => { const y = +TODAY.slice(0, 4); return mi + 1 < +TODAY.slice(5, 7) ? y + 1 : y }
  if (m && MONTHS.includes(m[1])) return `${yearOf(MONTHS.indexOf(m[1]))}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`
  const mm = MONTHS.findIndex((x) => w.startsWith(x))
  if (mm >= 0) {
    const d = new Date(Date.UTC(yearOf(mm), mm, 1))
    while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  return undefined
}
export function award(jobId: string, o: { rev: string; amount: number; depositPct: number; custPO: boolean; start: string; pm: PersonKey }) {
  const j0 = S().jobs[jobId]
  S().commit((s) => {
    const j = s.jobs[jobId]
    const p = s.pricing[jobId]
    p.revs.forEach((r) => {
      if (r.r === o.rev) r.status = 'Approved'
      else if (r.status === 'Sent') r.status = 'Superseded'
    })
    j.stage = 'setup'
    j.contract = o.amount
    j.pm = o.pm
    j.site = 'yakov'
    approveEstimateInAward(s, jobId)
    j.swatch = AWARD_SWATCH[jobId] || 'bianco'
    j.keyDate = { label: 'Awarded', value: NOW }
    j.stageDates = { won: NOW }
    j.next = { text: 'Check the paperwork and quantities', owner: 'estimator', due: 'Today' }
    /* the start window the client gave puts it on the Game plan, on that day, ready to book */
    const iso = startWindowISO(o.start)
    if (iso) s.prep[jobId] = { ...(s.prep[jobId] || {}), targetISO: iso, target: o.start }
    const issues: any[] = [{ tone: 'warn', text: 'Setup not started' }]
    if (o.depositPct) issues.push({ tone: 'warn', text: 'Deposit not invoiced' })
    if (o.custPO) issues.push({ tone: 'warn', text: 'Client PO not received' })
    j.issues = issues
    j.status = 'warn'
    j.headline = 'Awarded today · setup starts'
    closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && t.state !== 'done').map((t) => t.id), 'Awarded')
    newTask(s, { jobId, step: `${jobId}:rooms`, title: `Check the ${j.name} paperwork and quantities`, type: 'Setup', owner: 'estimator', for: ['estimator'], watch: ['owner', 'pm'], state: 'now', due: 'Today', tone: 'info', where: 'Paperwork', detail: 'The rooms and square feet came from the estimate — check them against the final plans and finish schedule, then say they check out.', action: { label: 'Open the project', kind: 'open-job' }, log: [L('system', 'Created at award')] })
    newTask(s, { jobId, step: `${jobId}:order`, title: `Check the ${j.name} tile order against our takeoff`, type: 'Materials', owner: matBy(s), for: matFor(s), state: 'now', due: 'When paperwork arrives', tone: 'info', where: 'Quantity check', log: [L('system', 'Created at award')] })
    newTask(s, { jobId, step: `${jobId}:materials`, title: `Plan setting materials for ${j.name}`, type: 'Materials', owner: matBy(s), for: matFor(s), state: 'later', laterUntil: md(addDays(MONDAY, 7)), tone: 'neutral', where: 'Installation materials', log: [L('system', 'Created at award')] })
    if (o.depositPct) {
      const amt = Math.round((o.amount * o.depositPct) / 100)
      s.money.unshift({ id: 'dep-' + jobId, jobId, kind: 'deposit', title: `Deposit ${o.depositPct}%`, amount: amt, step: 0, state: 'todo', due: 'Awarded today', dueTone: 'warn', note: `Created at award. Company rule: ${s.rules.depositRule === 'warn' ? 'warn' : 'block'} before the crew starts until it is received.`, log: [L('system', 'Deposit required — created at award')], action: 'Create invoice' })
      newTask(s, { jobId, step: `${jobId}:deposit`, title: `Send the ${j.name} deposit invoice`, type: 'Money', owner: 'accounting', for: ['accounting'], watch: ['owner'], state: 'now', due: 'Today', dueTone: 'warn', tone: 'warn', where: `Deposit ${o.depositPct}% · ${fmtMoney(amt)}`, action: { label: 'Create invoice', kind: 'money:dep-' + jobId }, log: [L('system', 'Created at award')] })
    }
    if (o.custPO) {
      s.money.unshift({ id: 'cpo-' + jobId, jobId, kind: 'custpo', title: 'Client PO / contract', amount: null, step: 0, state: 'waiting', due: 'Requested today', note: 'Company rule: their PO before the first bill.', log: [L('office', 'Requested from the client')], action: 'Mark received' })
      newTask(s, { jobId, title: `Get the client’s PO for ${j.name}`, type: 'Setup', owner: 'office', for: ['office'], watch: ['accounting'], state: 'waiting', waitingOn: 'Client', followUp: 'Fri', tone: 'warn', where: 'Contract', detail: 'The client sends their PO before the first bill — company rule. Follow up until it comes; when it does, file it with the project’s billing. That closes this, and billing can start.', action: { label: 'The PO came — file it', kind: 'money:cpo-' + jobId }, log: [L('system', 'Created at award — the client gives a PO')] })
    }
    s.notices.unshift({ id: 'nw' + Date.now(), jobId, text: `Awarded · ${j.name} — every department notified`, when: 'Just now', kind: 'pricing', unread: true, open: { t: 'job', id: jobId, tab: 'ready' } })
    addHist(s, jobId, { who: me(), kind: 'pricing', title: `Awarded on ${o.rev} · ${fmtMoney(o.amount)}`, detail: `Start window ${o.start}. Deposit, setup, materials and scheduling notified.` })
  }, `${j0.name} is a project now`, {
    sub: 'Everyone got their part on their Today.',
    to: [
      { who: 'office', what: 'Build the project from the paperwork' },
      ...(o.depositPct ? [{ who: 'accounting' as PersonKey, what: `Send the deposit invoice · ${fmtMoney(Math.round((o.amount * o.depositPct) / 100))}` }] : []),
      { who: matBy(S()), what: 'Check the tile order against our takeoff' },
      { who: o.pm, what: 'Review the setup and plan the start' },
    ],
  })
  S().closeAll()
  setTimeout(() => S().open({ t: 'job', id: jobId }), 60)
  /* the estimate that's in QuickBooks: marked accepted there */
  const won = S().estimates.find((e) => e.jobId === jobId && e.status === 'approved')
  if (won?.qb?.id && qbLive()) void pushEstimate(won.id, { accepted: true })
}

export function newRequest(d: { name: string; address: string; clientId: string; client: string; due: string; scope: string; docs: string[]; estimator: PersonKey | null }) {
  const id = 'r' + Date.now().toString(36)
  S().commit((s) => {
    const missing = ['Plans', 'Spec book', 'Finish schedule'].filter((x) => !d.docs.includes(x))
    s.jobs[id] = {
      id, name: d.name, client: d.client, clientId: d.clientId, address: d.address || 'Address to confirm', stage: 'request',
      status: missing.length ? 'warn' : 'info', headline: missing.length ? `${missing.join(' and ')} missing` : 'New today · ready to estimate',
      issues: missing.map((m) => ({ tone: 'warn' as const, text: `${m} missing` })),
      next: { text: d.estimator ? 'Start estimating' : 'Assign an estimator', owner: d.estimator || 'office', due: 'Today' },
      keyDate: { label: 'Bid due', value: d.due }, swatch: 'blueprint', building: 'midrise', estimator: d.estimator, scope: d.scope,
    }
    s.pricing[id] = {
      docs: ['Plans', 'Spec book', 'Finish schedule'].map((n) => ({ name: n, status: d.docs.includes(n) ? 'in' : 'missing', note: d.docs.includes(n) ? 'Received today' : 'Not received' })) as any,
      estimator: d.estimator, due: d.due, scope: d.scope, contact: d.client, revs: [], fu: [],
    }
    missing.forEach((m) => newTask(s, { jobId: id, title: `${m} from the GC`, type: 'Pricing', owner: 'office', for: ['office'], state: 'waiting', waitingOn: 'GC', followUp: 'Thu', tone: 'warn', where: 'Documents' }))
    const estId = 'E-' + (1 + Math.max(1000, ...s.estimates.map((e) => Number(e.id.slice(2)) || 0)))
    newTask(s, { jobId: id, title: 'Start the takeoff', type: 'Pricing', owner: 'office', for: ['office'], state: 'now', due: 'Today', tone: 'info', where: missing.length ? `${missing.join(' and ')} still missing` : 'All documents in', action: { label: 'Open estimate', kind: 'estimate:' + estId } })
    s.estimates.unshift({ id: estId, jobId: id, status: 'request', estimator: d.estimator, due: d.due, revs: [{ n: 1, date: NOW, status: 'draft', what: 'Original scope', lines: [] }], log: [L(me(), `Price request received${missing.length ? ' — ' + missing.join(' and ') + ' missing' : ''}`)] })
    addHist(s, id, { who: me(), kind: 'pricing', title: `Price request received · ${estId}`, ref: { t: 'estimate', id: estId } })
  }, `${d.name} added to Estimates`)
  S().closeAll()
  const est = S().estimates.find((e) => e.jobId === id)
  setTimeout(() => S().open(est ? { t: 'estimate', id: est.id } : { t: 'job', id }), 60)
}

/* ================= setup & readiness ================= */
export function settleQty(jobId: string, tag: string, choice: 'askgc' | 'order' | 'accept') {
  if (choice === 'order') {
    S().swap({ t: 'newpo', jobId, prefill: { supplier: 'Best Tile', lines: [{ item: `${tag} wall tile · short quantity`, qty: '60 SF (2 boxes)' }], amount: 540, what: `Short tile ${tag}`, tag, addQty: 60 } })
    return
  }
  S().commit((s) => {
    const c = s.checks.find((x) => x.jobId === jobId && x.tag === tag)
    if (!c) return
    if (choice === 'askgc') {
      c.note = 'GC asked to add 60 SF · waiting'
      newTask(s, { jobId, title: `GC to add 60 SF of ${tag}`, type: 'Materials', owner: 'office', for: ['office'], watch: ['materials'], state: 'waiting', waitingOn: 'GC', followUp: 'Wed', tone: 'warn', blocks: 'Master bath walls', where: 'Quantity', log: [L(me(), 'Asked the GC to add 60 SF to the Best Tile order')] })
      setIssues(s, jobId, (iss) => iss.map((i) => (/short/i.test(i.text) ? { tone: 'warn', text: 'Waiting on the GC for 60 SF more wall tile' } : i)))
      addHist(s, jobId, { who: me(), kind: 'material', title: 'Asked the GC to add 60 SF of wall tile', detail: 'Comes back Wednesday' })
    } else {
      c.measured = Math.floor(c.ordered / (1 + c.wastePct / 100))
      c.note = 'Store count accepted'
      setIssues(s, jobId, (iss) => iss.filter((i) => !/short/i.test(i.text)))
      addHist(s, jobId, { who: me(), kind: 'material', title: 'Store count accepted for ' + tag })
    }
    closeTasks(s, ['t-qty114'], 'Settled')
  }, choice === 'askgc' ? 'Sent to the GC — back Wednesday' : 'Quantity accepted')
  S().close()
}

export function sendToSite(jobId: string) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    j.stage = 'verification'
    j.stageDates = { ...(j.stageDates || {}), setup: NOW }
    j.next = { text: 'Walk the project and verify', owner: 'ys', due: 'Wed' }
    closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && t.type === 'Setup' && t.owner === 'office').map((t) => t.id), 'Setup done')
    newTask(s, { jobId, title: `Walk ${j.name} and verify what the office built`, type: 'Field', owner: 'yakov', for: ['site'], state: 'now', due: 'Wed', tone: 'info', where: 'Field verification', action: { label: 'Start walkthrough', kind: 'open-job' } })
    addHist(s, jobId, { who: me(), kind: 'setup', title: 'Setup approved · sent to the site manager' })
  }, 'Sent to the site manager for verification')
}

export function verificationDone(jobId: string) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    j.stage = 'ready'
    j.readiness = 'partial'
    j.stageDates = { ...(j.stageDates || {}), verification: NOW }
    j.next = { text: 'Start the job', owner: 'ys', due: 'This week' }
    j.headline = 'Ready to start'
    addHist(s, jobId, { who: me(), kind: 'field', title: 'Getting ready is done — ready to start' })
  }, `${S().jobs[jobId]?.name || 'The project'} is ready to start`, { sub: 'Start it from here when the crew goes in.' })
}

/** getting ready is done — all five tracks: the project is ready for the crew (no toast — the crew window opens next) */
export function readyForCrew(jobId: string) {
  const j0 = S().jobs[jobId]
  if (!j0 || !['awarded', 'setup', 'verification'].includes(j0.stage)) return
  S().commit((s) => {
    const j = s.jobs[jobId]
    j.stage = 'ready'
    j.readiness = 'partial'
    j.stageDates = { ...(j.stageDates || {}), verification: NOW }
    j.next = { text: 'Schedule the crew', owner: 'ys', due: 'This week' }
    j.headline = 'Ready for the crew'
    addHist(s, jobId, { who: me(), kind: 'field', title: 'Getting ready is done — all five tracks' })
  })
}

/* business-day helper for the schedule */
export function addBusinessDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  let n = days - 1
  while (n > 0) {
    d.setDate(d.getDate() + 1)
    if (d.getDay() !== 0 && d.getDay() !== 6) n--
  }
  return d.toISOString().slice(0, 10)
}
export const isoLabel = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export function assignCrew(jobId: string, o: { crew: PersonKey; start: string; days: number; workers: number; areas: string[]; confirm: boolean }) {
  const j0 = S().jobs[jobId]
  S().commit((s) => {
    const j = s.jobs[jobId]
    const end = addBusinessDays(o.start, o.days)
    const isReturn = ['punch', 'closeout'].includes(j.stage)
    s.bookings.push({ id: 'bk' + Date.now(), crew: o.crew, jobId, start: o.start, end, label: isReturn ? 'Return visit' : o.areas.slice(0, 2).join(' · ') || 'Starting areas', workers: o.workers, status: o.confirm ? 'pending' : 'on' })
    s.ready = s.ready.filter((r) => r.jobId !== jobId)
    if (!isReturn) {
      j.stage = 'scheduled'
      j.stageDates = { ...(j.stageDates || {}), ready: j.stageDates?.ready || NOW, scheduled: NOW }
    }
    j.crew = o.crew
    j.workers = o.workers
    if (!isReturn) s.prep[jobId] = { ...(s.prep[jobId] || {}), installer: o.crew, confirmed: o.confirm ? 'no' : 'yes', targetISO: o.start, target: `Starts ${isoLabel(o.start)}` }
    j.keyDate = { label: isReturn ? 'Return' : 'Starts', value: isoLabel(o.start) }
    j.next = { text: isReturn ? 'Verify the return visit' : 'Pre-start checks', owner: 'ys', due: isoLabel(o.start) }
    closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && t.type === 'Schedule').map((t) => t.id), 'Scheduled')
    if (!isReturn) {
      newTask(s, { jobId, title: `Confirm the ${j.name} start with the GC`, type: 'Schedule', owner: 'ys', for: ['pm'], state: 'now', due: 'Before ' + isoLabel(o.start), tone: 'info', where: 'Pre-start', action: { label: 'GC confirmed', kind: 'gc-confirm' } })
      newTask(s, { jobId, title: `Release the starting areas at ${j.name}`, type: 'Field', owner: 'yakov', for: ['site'], state: 'now', due: 'Before ' + isoLabel(o.start), tone: 'info', where: o.areas.join(', ') })
      newTask(s, { jobId, title: `Verify starting materials for ${j.name}`, type: 'Materials', owner: matBy(s), for: matFor(s), state: 'now', due: 'Before ' + isoLabel(o.start), tone: 'info', where: 'Pre-start' })
    }
    if (o.confirm) newTask(s, { jobId, title: `Waiting for ${PEOPLE[o.crew].name} to confirm ${j.name}`, type: 'Schedule', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: PEOPLE[o.crew].name, followUp: 'Tomorrow', tone: 'warn', where: 'Crew confirmation', action: { label: 'Mark confirmed', kind: 'crew-confirm' } })
    addHist(s, jobId, { who: me(), kind: 'schedule', title: `${isReturn ? 'Return booked' : 'Scheduled'} · ${PEOPLE[o.crew].name}, ${o.workers} workers, ${isoLabel(o.start)} – ${isoLabel(end)}`, detail: o.areas.length ? 'Starting with ' + o.areas.join(', ') : undefined })
  }, `${PEOPLE[o.crew].name} is on ${j0.name} from ${isoLabel(o.start)}`, {
    sub: o.confirm ? 'It shows dashed on the Schedule until you mark that he confirmed.' : 'It’s on the Schedule.',
    to: ['punch', 'closeout'].includes(j0.stage) ? undefined : [
      { who: 'ys', what: 'Confirm the start with the GC' },
      { who: 'yakov', what: 'Release the starting areas' },
      { who: matBy(S()), what: 'Verify the starting materials' },
    ],
  })
  S().close()
}

/** the office marks that the installer said yes to his booking (he's told by phone or text — installers don't use Tile OS) */
export function confirmCrewFor(jobId: string) {
  const t = S().tasks.find((x) => x.jobId === jobId && x.action?.kind === 'crew-confirm' && x.state !== 'done')
  if (t) return confirmCrew(t.id)
  S().commit((s) => {
    s.bookings.forEach((b) => { if (b.jobId === jobId && b.status === 'pending') b.status = 'on' })
    if (s.prep[jobId]) s.prep[jobId].confirmed = 'yes'
    const b = s.bookings.find((x) => x.jobId === jobId)
    addHist(s, jobId, { who: me(), kind: 'schedule', title: `${b ? PEOPLE[b.crew as PersonKey]?.name || 'The crew' : 'The crew'} confirmed the project` })
  }, 'Crew confirmed')
}
export function confirmCrew(taskId: string) {
  S().commit((s) => {
    const t = s.tasks.find((x) => x.id === taskId)
    if (!t) return
    s.bookings.forEach((b) => {
      if (b.jobId === t.jobId && b.status === 'pending') b.status = 'on'
    })
    if (s.prep[t.jobId]) s.prep[t.jobId].confirmed = 'yes'
    closeTasks(s, [taskId], 'Crew confirmed')
    addHist(s, t.jobId, { who: me(), kind: 'schedule', title: `${t.waitingOn} confirmed the project` })
  }, 'Crew confirmed')
}

/* ================= field ================= */
export const DRAIN_ANSWERS = [
  { a: 'Tile first; the plumber sets the final trim after', b: 'Saved to the shower floor as the installation direction — the floor is ready' },
  { a: 'The plumber sets the final drain before tile', b: 'The floor waits for his visit; nothing else does' },
  { a: 'The drain has to be replaced', b: 'He returns Tuesday; the floor stays blocked until then' },
]
export function resolveDrain(i: number) {
  S().commit((s) => {
    const room = s.rooms['119'].find((r) => r.name === 'Master Bath')!
    const sf = room.surfaces.find((x) => x.name === 'Shower floor')!
    if (i === 0) {
      sf.state = 'ready'
      sf.reason = undefined
      sf.decided = [...(sf.decided || []), `Tile first; plumber sets the final trim after — plumber, ${NOW}`]
      setIssues(s, '119', (iss) => iss.filter((x) => !/drain|shower floor/i.test(x.text)))
      closeTasks(s, ['t-drain'], 'Answered')
    } else {
      sf.reason = i === 1 ? 'Plumber sets the final drain first · booked Tue' : 'Drain to be replaced · plumber back Tue'
      const t = s.tasks.find((x) => x.id === 't-drain')
      if (t) {
        t.followUp = 'Tue'
        t.log.push(L(me(), DRAIN_ANSWERS[i].a))
      }
    }
    addHist(s, '119', { who: me(), kind: 'decision', title: `Drain answer: ${DRAIN_ANSWERS[i].a}`, detail: DRAIN_ANSWERS[i].b })
  }, i === 0 ? 'Master shower floor is ready — the crew sees it now' : 'Saved — it stays blocked until Tuesday')
  S().close()
}

export function approveCO004(o: { by: string; how: string }) {
  S().commit((s) => {
    const room = s.rooms['119'].find((r) => r.name === 'Boys Bath')!
    const sf = room.surfaces.find((x) => x.name === 'Main walls')!
    sf.state = 'ready'
    sf.reason = undefined
    sf.pending = undefined
    if (sf.sf) {
      const done = (sf.sf * surfacePct(sf)) / 100
      sf.sf += 96
      sf.pct = Math.round((done / sf.sf) * 100)
    }
    sf.height = `Full height (CO-004 approved ${NOW})`
    const ipo = s.ipos.find((p) => p.id === 'IPO-119')
    const ch = ipo?.changes.find((c) => c.co === 'CO-004')
    if (ipo && ch) {
      ch.status = 'sent'
      ipo.log.push(L(me(), 'CO-004 change sent to Philip · +96 SF wall tile'))
      newTask(s, { jobId: '119', title: 'Philip to accept the PO change · CO-004', type: 'Changes', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: 'Philip', followUp: 'Tomorrow', tone: 'info', where: 'IPO-119 · +96 SF wall tile', action: { label: 'Mark accepted', kind: 'ipo:IPO-119:CO-004' } })
    }
    recalc(s, '119')
    sf.decided = [...(sf.decided || []), `Full height — CO-004 approved by ${o.by} (${o.how.toLowerCase()})`]
    const m = s.money.find((x) => x.id === 'co119')
    if (m) {
      m.step = 0
      m.state = 'todo'
      m.due = 'Approved today'
      m.dueTone = undefined
      m.note = `Approved by ${o.by} (${o.how.toLowerCase()}). Bills with the next progress bill.`
      m.action = 'Add to next bill'
      m.log.push(L(me(), `Approved by ${o.by} · ${o.how.toLowerCase()}`))
    }
    const c = s.checks.find((x) => x.jobId === '119' && x.tag === 'T-06')
    if (c) {
      c.measured += 86
      c.note = 'CO-004 added 96 SF with waste — GC asked to order it'
    }
    const bk = s.bookings.find((b) => b.id === 'bk4')
    if (bk) bk.end = shiftISO('2026-10-12')
    s.jobs['119'].keyDate = { label: 'Finish', value: shiftText('Oct 12') }
    setIssues(s, '119', (iss) => iss.filter((x) => !/CO-004/.test(x.text)).concat([{ tone: 'warn', text: 'GC to order 96 SF more T-06 (CO-004)' }]))
    closeTasks(s, ['t-co004'], 'Approved')
    newTask(s, { jobId: '119', title: 'GC to order 96 SF more T-06 for CO-004', type: 'Materials', owner: 'office', for: ['office'], watch: ['materials'], state: 'waiting', waitingOn: 'GC', followUp: 'Wed', tone: 'warn', blocks: 'Boys bath walls above 3 ft', where: 'Boys Bath · main walls' })
    newTask(s, { jobId: '119', title: 'Bill CO-004 · boys bath full height', type: 'Money', owner: 'accounting', for: ['accounting'], state: 'now', due: 'With the October bill', tone: 'info', where: '$6,850', action: { label: 'Add to next bill', kind: 'money:co119' } })
    if (o.how === 'Verbal') newTask(s, { jobId: '119', title: 'Get CO-004 approval in writing', type: 'Changes', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: 'GC', followUp: 'Wed', tone: 'warn', where: 'Verbal approval on file' })
    addHist(s, '119', { who: me(), kind: 'change', title: `CO-004 approved by ${o.by} (${o.how.toLowerCase()})`, from: '3 ft', to: 'Full height', detail: 'Scope, tile, Philip’s PO, schedule, crew and billing updated together' })
    s.notices.unshift({ id: 'nc' + Date.now(), jobId: '119', text: 'CO-004 approved · crew instruction changed to full height', when: 'Just now', kind: 'change', unread: true, open: { t: 'job', id: '119', tab: 'money' } })
  }, 'CO-004 approved — 6 departments updated')
  S().close()
}

export function thinsetDecision(choice: 'chase' | 'reorder') {
  if (choice === 'reorder') {
    S().swap({ t: 'newpo', jobId: '828', prefill: { supplier: 'Metal Works Inc.', lines: [{ item: 'Versabond-LFT thinset · 50 lb', qty: '24 bags' }], amount: 960, what: 'Thinset reorder', replaces: 'PO-1039' } })
    return
  }
  S().commit((s) => {
    const t = s.tasks.find((x) => x.id === 't-thinset')
    if (t) {
      t.state = 'waiting'
      t.waitingOn = 'Infinity'
      t.followUp = 'Wed'
      t.log.push(L(me(), 'Chasing Infinity — reorder Wednesday if nothing ships'))
    }
    const po = s.pos.find((p) => p.id === 'PO-1039')
    po?.log.push(L(me(), 'Chased — decision point Wednesday'))
    addHist(s, '828', { who: me(), kind: 'material', title: 'Chasing Infinity for the thinset', detail: 'Reorder elsewhere Wednesday if nothing ships' })
  }, 'Chasing Infinity — it comes back Wednesday')
  S().close()
}

export function receiveMat(matId: string, qty: number, condition: string) {
  S().commit((s) => {
    const m = s.mats.find((x) => x.id === matId)
    if (!m) return
    if (condition === 'Good') {
      m.status = 'delivered'
      const po = s.pos.find((p) => p.id === m.po)
      if (po) {
        po.step = 3
        po.note = 'Delivered complete'
        po.log.push(L(me(), `Received ${qty} · all here`))
      }
      if (matId === 'om5') {
        const room = s.rooms['119'].find((r) => r.name === 'Girls Bath')!
        const sf = room.surfaces.find((x) => x.name === 'Outside corners')!
        sf.state = 'ready'
        sf.reason = undefined
        setIssues(s, '119', (iss) => iss.filter((x) => !/profile/i.test(x.text)))
        closeTasks(s, ['t-jolly'], 'Received')
      }
      addHist(s, m.jobId, { who: me(), kind: 'material', title: `Received ${qty} · ${m.name}`, detail: 'All here — waiting work opened up' })
    } else {
      newTask(s, { jobId: m.jobId, title: `${condition} · ${m.name}`, type: 'Materials', owner: matBy(s), for: matFor(s), state: 'now', due: 'Today', tone: 'bad', where: 'Replacement needed' })
      addHist(s, m.jobId, { who: me(), kind: 'material', title: `${condition} on delivery · ${m.name}`, detail: 'Replacement requested; only the work that needs it waits' })
    }
  }, condition === 'Good' ? 'Received — the girls bath corners are open' : 'Logged — replacement requested')
  S().close()
}

export function receiveTile(jobId: string, tag: string, qty: number) {
  S().commit((s) => {
    const c = s.checks.find((x) => x.jobId === jobId && x.tag === tag)
    if (!c) return
    c.received = Math.min(c.ordered, c.received + qty)
    if (c.received >= c.ordered) {
      c.note = 'All here'
      setIssues(s, jobId, (iss) => iss.filter((x) => !x.text.includes(tag)))
    }
    addHist(s, jobId, { who: me(), kind: 'material', title: `Received ${qty} ${c.unit} of ${tag}`, from: `${c.received - qty} of ${c.ordered}`, to: `${c.received} of ${c.ordered}` })
  }, `Received — ${tag} updated`)
  S().close()
}

export function verifyPunch(taskId: string, ok: boolean) {
  S().commit((s) => {
    const t = s.tasks.find((x) => x.id === taskId)
    if (!t) return
    if (ok) closeTasks(s, [taskId], 'Verified')
    else {
      t.log.push(L(me(), 'Needs more work — back to the crew'))
      t.owner = 'philip'
      t.state = 'now'
    }
    addHist(s, t.jobId, { who: me(), kind: 'field', title: ok ? `Verified · ${t.title.replace('Verify the ', '')}` : 'Punch item sent back to the crew' })
  }, ok ? 'Verified' : 'Sent back to the crew')
  S().close()
}

export interface DailyInput {
  who: PersonKey
  workers?: number
  rooms: { room: string; items: { surface: string; to: number }[]; media: Media[]; note?: string }[]
  blocked: boolean
  shortage: boolean
  change: boolean
  tomorrow: string[]
  note?: string
  gc: boolean
}
/* The daily update: what was tiled today, measured against the original plan, with photos and videos per room. */
export function sendDailyUpdate(jobId: string, d: DailyInput) {
  let moved = 0
  let finished = 0
  let media = 0
  const lines: string[] = []
  S().commit((s) => {
    const j = s.jobs[jobId]
    const rooms = s.rooms[jobId] || []
    const touched: string[] = []
    const entryRooms = d.rooms
      .map((r) => {
        const room = rooms.find((x) => x.name === r.room)
        const items = r.items
          .map((it) => {
            const sf = room?.surfaces.find((x) => x.name === it.surface)
            if (!sf) return null
            const from = surfacePct(sf)
            if (it.to <= from) return null
            sf.pct = it.to
            if (it.to >= 100) {
              sf.state = 'done'
              finished++
            } else if (['ready', 'notstarted', 'working'].includes(sf.state)) sf.state = 'working'
            moved++
            lines.push(`${r.room} ${sf.name.toLowerCase()} ${from}→${it.to}%`)
            return { surface: sf.name, from, to: it.to }
          })
          .filter(Boolean) as { surface: string; from: number; to: number }[]
        if (items.length) touched.push(r.room)
        media += r.media.length
        return { room: r.room, items, media: r.media, note: r.note }
      })
      .filter((r) => r.items.length || r.media.length || r.note)
    recalc(s, jobId, touched)
    if (!s.diary[jobId]) s.diary[jobId] = []
    const issues = [d.blocked ? 'Something is blocking tomorrow' : '', d.shortage ? 'Short on material' : '', d.change ? 'Change asked on site' : ''].filter(Boolean)
    s.diary[jobId].unshift({ id: 'd' + Date.now(), date: NOW, day: dayShort(TODAY), who: d.who, workers: d.workers, rooms: entryRooms, issues, tomorrow: d.tomorrow, gc: d.gc, note: d.note })
    addHist(s, jobId, {
      who: d.who, kind: 'field',
      title: `Daily update · ${moved ? `${moved} surface${moved > 1 ? 's' : ''} moved${finished ? `, ${finished} finished` : ''}` : 'no tile progress'}${media ? ` · ${media} photo${media > 1 ? 's' : ''}/video${media > 1 ? 's' : ''}` : ''}`,
      detail: [lines.join(' · '), d.tomorrow.length ? 'Tomorrow: ' + d.tomorrow.join(', ') : '', d.note || ''].filter(Boolean).join(' — '),
    })
    if (d.gc) addHist(s, jobId, { who: meOf(s.role), kind: 'field', title: 'Progress report sent to the GC', detail: `${j?.name} · ${j?.pct ?? 0}% installed · ${media} photos` })
    if (d.blocked) newTask(s, { jobId, title: 'Tomorrow is blocked — reported in the daily update', type: 'Field', owner: 'ys', for: ['site', 'pm'], state: 'now', due: 'Today', tone: 'bad', where: touched.join(', ') || undefined })
    if (d.shortage) newTask(s, { jobId, title: 'Material short — reported in the daily update', type: 'Materials', owner: matBy(s), for: matFor(s), state: 'now', due: 'Today', tone: 'warn' })
    s.notices.unshift({ id: 'nd' + Date.now(), jobId, text: `${PEOPLE[d.who].name} sent today’s update · ${j?.name}${moved ? ` · ${moved} surfaces moved` : ''}`, when: 'Just now', kind: 'field', unread: true, open: { t: 'job', id: jobId, tab: 'install' } })
  }, d.gc ? 'Update sent — the room diaries, the office and the GC have it' : 'Update sent — the room diaries and the office have it')
}

/* ---------- old one-screen version (kept for the crew view shortcut) ---------- */
export function dailyUpdate(jobId: string, d: { who: PersonKey; rooms: string[]; pct: number; blocked: boolean; shortage: boolean; change: boolean; tomorrow: string[]; note?: string }) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    if (d.pct) j.pct = d.pct
    addHist(s, jobId, { who: d.who, kind: 'field', title: `Daily update · ${d.rooms.join(', ') || 'site'}${d.pct ? ` · project at ${d.pct}%` : ''}`, detail: [d.tomorrow.length ? 'Tomorrow: ' + d.tomorrow.join(', ') : '', d.note || ''].filter(Boolean).join(' · ') })
    if (d.blocked) newTask(s, { jobId, title: 'Tomorrow is blocked — reported in the daily update', type: 'Field', owner: 'ys', for: ['site', 'pm'], state: 'now', due: 'Today', tone: 'bad', where: d.rooms.join(', ') })
    if (d.shortage) newTask(s, { jobId, title: 'Material short — reported in the daily update', type: 'Materials', owner: matBy(s), for: matFor(s), state: 'now', due: 'Today', tone: 'warn' })
    if (d.change) newTask(s, { jobId, title: 'Possible change asked on site', type: 'Changes', owner: 'ys', for: ['pm'], state: 'now', due: 'Today', tone: 'warn', detail: 'Crew holds until it is reviewed and approved.' })
    s.notices.unshift({ id: 'nd' + Date.now(), jobId, text: `${PEOPLE[d.who].name} sent the daily update · ${j.name}`, when: 'Just now', kind: 'field', unread: true, open: { t: 'job', id: jobId, tab: 'install' } })
  }, 'Daily update sent', { sub: 'Progress, billing and this week’s installer pay are updated from it.' })
  S().close()
}

/* ================= money ================= */
export function createInvoice(id: string) {
  /* QuickBooks connected: the invoice goes there, and from there to the client by email (its number is QuickBooks') */
  const live = qbLive()
  const ref = nextRef()
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    if (!m) return
    m.step = 1
    m.state = 'waiting'
    m.ref = ref
    m.due = 'Sent today'
    m.dueTone = undefined
    m.action = 'Record payment'
    m.log.push(L(me(), live ? 'Invoiced · going to QuickBooks and the client' : `Invoice ${ref} sent from QuickBooks`))
    closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'money:' + id).map((t) => t.id), 'Invoiced')
    if (m.kind === 'deposit') setIssues(s, m.jobId, (iss) => iss.map((i) => (/deposit/i.test(i.text) ? { tone: 'warn', text: `Deposit invoiced ${ref} · not paid` } : i)))
    if (m.kind === 'final' || m.kind === 'retainage') setIssues(s, m.jobId, (iss) => iss.filter((i) => !/final invoice/i.test(i.text)))
    addHist(s, m.jobId, { who: me(), kind: 'money', title: `${m.title} invoiced`, detail: m.amount ? fmtMoney(m.amount) : undefined })
  }, live ? 'Invoiced — going to QuickBooks' : `Invoice ${ref} sent`, live ? { sub: 'Then it’s emailed to the client with the Pay button.', undo: false } : { sub: 'Reminders go out by themselves until it’s paid.', flow: [{ who: 'accounting', label: 'Invoiced', state: 'done' }, { label: 'Client pays', state: 'now' }, { who: 'accounting', label: 'Paid', state: 'next' }] })
  if (live) void pushBill(id, { email: true })
}
/** what a payment changes on a bill — on the store being changed (a payment recorded here, or one made in QuickBooks) */
export function applyPayment(s: Store, id: string, amount: number, how?: string, who: PersonKey = me()) {
  const m = s.money.find((x) => x.id === id)
  if (!m || !m.amount) return
  if (how) m.log.push({ date: NOW, who, text: `${how} · ${fmtMoney(amount)}` })
  m.paid = Math.round(((m.paid || 0) + amount) * 100) / 100
  if (m.paid >= m.amount - 0.005) {
    m.state = 'paid'
    m.step = 99
    m.date = NOW
    m.log.push({ date: NOW, who, text: `Paid in full · ${fmtMoney(amount)}` })
    if (m.kind === 'deposit') setIssues(s, m.jobId, (iss) => iss.filter((i) => !/deposit/i.test(i.text)))
    ;(m.bill?.cos || []).forEach((c) => {
      const co = s.money.find((x) => x.id === c.id)
      if (!co || co.state === 'paid') return
      co.state = 'paid'
      co.step = 99
      co.date = NOW
      co.log.push({ date: NOW, who, text: `Paid with ${m.title.split(' · ')[0]}` })
    })
  } else {
    m.due = `${fmtMoney(m.amount - m.paid)} open`
    m.log.push({ date: NOW, who, text: `${fmtMoney(amount)} received · ${fmtMoney(m.amount - m.paid)} still open` })
  }
  closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'money:' + id).map((t) => t.id), 'Paid')
  addHist(s, m.jobId, { who, kind: 'money', title: `Payment received${m.ref ? ' · invoice ' + m.ref : ''} · ${m.title}`, detail: `${fmtMoney(amount)}${how ? ' · ' + how : ''}` })
}
export function recordPayment(id: string, amount: number, how?: string) {
  const m0 = S().money.find((x) => x.id === id)
  const left = m0?.amount ? m0.amount - (m0.paid || 0) - amount : 0
  /* the bill's invoice is in QuickBooks: the payment goes there too (no Undo — QuickBooks has it) */
  const live = qbLive() && !!m0?.qb?.id && !m0.qb.gone
  S().commit((s) => applyPayment(s, id, amount, how), m0?.ref ? `${fmtMoney(amount)} recorded on invoice ${m0.ref}` : 'Payment recorded', { sub: (left <= 0 ? 'Paid in full — it’s closed.' : `${fmtMoney(left)} still open${live ? '' : ' — reminders keep going'}.`) + (live ? ' Going to QuickBooks too.' : ''), close: true, undo: live ? false : undefined })
  if (live) void pushPayment(id, amount, how, { quietOk: true })
}
export function sendReminder(id: string) {
  /* in QuickBooks: a real reminder email, with the invoice and its Pay button again */
  const m = S().money.find((x) => x.id === id)
  if (qbLive() && m?.qb?.id && !m.qb.gone) { void emailBill(id, { reminder: true }); return }
  /* the real app: a reminder needs the invoice in QuickBooks (its PDF and Pay button) */
  if (REAL.cloud) { toast.error(qbLive() ? 'Put it in QuickBooks first (on the bill), then remind them' : 'Reminders go out once QuickBooks is connected — Settings → Connections'); return }
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    m?.log.push(L(me(), 'Reminder emailed to the client'))
  }, 'Reminder sent')
}
/** change a bill — what it's for and its amount. In QuickBooks, its invoice there changes the same way. */
export function changeBill(id: string, p: { amount: number; title: string }) {
  const m0 = S().money.find((x) => x.id === id)
  if (!m0 || !(p.amount > 0)) return
  const amount = Math.round(p.amount * 100) / 100
  const title = p.title.trim() || m0.title
  if (amount === m0.amount && title === m0.title) return
  const live = qbLive() && !!m0.qb?.id && !m0.qb.gone
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    if (!m) return
    const was = m.amount || 0
    const what = [amount !== was ? `Amount ${fmtMoney(was)} → ${fmtMoney(amount)}` : '', title !== m.title ? `now “${title}”` : ''].filter(Boolean).join(' · ')
    m.amount = amount
    m.title = title
    const open = amount - (m.paid || 0)
    if (m.state === 'paid' && open > 0.005) { m.state = 'waiting'; m.step = m.kind === 'progress' ? 3 : 1; m.date = undefined; m.action = 'Record payment' }
    if (m.state !== 'paid' && m.paid) m.due = `${fmtMoney(open)} open`
    m.log.push(L(me(), `Changed · ${what}`))
    addHist(s, m.jobId, { who: me(), kind: 'money', title: `${m.title} changed`, detail: what })
  }, 'Bill changed', live ? { sub: 'QuickBooks gets the change. Email it again if the client has the old one.', undo: false } : undefined)
  if (live) void pushBill(id, { quietOk: true })
}
export function addToBill(id: string) {
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    if (!m) return
    m.step = 1
    m.state = 'waiting'
    m.due = 'On the next bill'
    m.action = undefined
    m.log.push(L(me(), 'Added to the next progress bill'))
    closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'money:' + id).map((t) => t.id), 'Added to bill')
    addHist(s, m.jobId, { who: me(), kind: 'money', title: `${m.title} added to the next bill` })
  }, 'Added to the next bill')
}
export function requestRetainage(id: string) {
  const live = qbLive()
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    if (!m) return
    m.step = 1
    m.state = 'waiting'
    m.ref = nextRef()
    m.due = 'Requested today'
    m.action = 'Record payment'
    m.log.push(L(me(), 'Retainage release requested'))
  }, 'Retainage release requested', live ? { sub: 'Its invoice goes to QuickBooks and the client.', undo: false } : undefined)
  if (live) void pushBill(id, { email: true })
}
export function advanceBill(id: string) {
  /* the PM approved it: QuickBooks connected, its invoice goes there and to the GC by email */
  const m0 = S().money.find((x) => x.id === id)
  const live = qbLive() && m0?.step === 1
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    if (!m) return
    if (m.step <= 0) {
      m.step = 1
      m.state = 'todo'
      m.due = 'With the PM'
      m.log.push(L(me(), 'Draft sent to the PM for review'))
      newTask(s, { jobId: m.jobId, title: `Review the ${s.jobs[m.jobId].name} progress bill`, type: 'Money', owner: 'ys', for: ['pm', 'owner'], state: 'now', due: 'Today', tone: 'info', where: m.title, action: { label: 'Review', kind: 'money:' + m.id } })
    } else if (m.step === 1) {
      m.step = 2
      m.state = 'waiting'
      m.ref = nextRef()
      m.due = 'With the GC'
      m.log.push(L(me(), live ? 'PM approved · going to QuickBooks and the GC' : `PM approved · invoice ${m.ref} sent from QuickBooks`))
      closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'money:' + m.id).map((t) => t.id), 'Reviewed')
    } else if (m.step === 2) {
      m.step = 3
      m.due = 'Due in 30 days'
      m.log.push(L(me(), 'GC approved the pay application'))
    }
    addHist(s, m.jobId, { who: me(), kind: 'money', title: `${m.title} · ${['Draft', 'PM review', 'Sent', 'Approved'][Math.min(m.step, 3)]}` })
  }, live ? 'Approved — going to QuickBooks' : 'Progress bill moved forward', live ? { sub: 'Then it’s emailed to the GC with the Pay button.', undo: false } : undefined)
  if (live) void pushBill(id, { email: true })
}
export function custPOReceived(id: string) {
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    if (!m) return
    m.step = 1
    m.state = 'paid'
    m.date = NOW
    m.log.push(L(me(), 'Client PO received and filed'))
    closeTasks(s, s.tasks.filter((t) => t.jobId === m.jobId && /client(’s|'s)? po/i.test(t.title)).map((t) => t.id), 'Received')
    setIssues(s, m.jobId, (iss) => iss.filter((i) => !/client po/i.test(i.text)))
    addHist(s, m.jobId, { who: me(), kind: 'money', title: 'Client PO received' })
  }, 'Client PO filed')
}

/* ================= purchase orders ================= */
export function createPO(jobId: string, o: { supplier: string; lines: { item: string; qty: string }[]; amount: number; what: string; neededBy: string; replaces?: string; tag?: string; addQty?: number }) {
  const id = nextPO()
  S().commit((s) => {
    s.pos.unshift({ id, jobId, supplier: o.supplier, what: o.what, lines: o.lines, amount: o.amount, step: 1, eta: 'Asked for ' + o.neededBy, note: `Sent today · waiting for ${o.supplier} to confirm`, log: [L(me(), `Sent to ${o.supplier}`)] })
    closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'order:' + jobId && t.state !== 'done').map((t) => t.id), `${id} sent to ${o.supplier}`)
    if (jobId === '530') {
      s.mats.forEach((m) => {
        if (m.jobId === '530' && m.status === 'to-order') {
          m.status = 'sent'
          m.po = id
        }
      })
      closeTasks(s, ['t-prep530'], 'PO sent')
      setIssues(s, '530', (iss) => iss.map((i) => (/floor prep/i.test(i.text) ? { tone: 'warn', text: `Floor prep ordered · ${id} not confirmed` } : i)))
    }
    if (o.replaces) {
      const old = s.pos.find((p) => p.id === o.replaces)
      if (old) {
        old.note = `Cancelled — reordered as ${id}`
        old.late = false
        old.step = 0
        old.log.push(L(me(), `Cancelled · replaced by ${id}`))
      }
      closeTasks(s, ['t-thinset'], `Reordered as ${id}`)
      const mat = s.mats.find((m) => m.po === o.replaces)
      if (mat) {
        mat.po = id
        mat.status = 'sent'
        mat.eta = 'Asked for ' + o.neededBy
      }
      setIssues(s, jobId, (iss) => iss.map((i) => (/thinset/i.test(i.text) ? { tone: 'warn', text: `Thinset reordered · ${id}` } : i)))
    }
    if (o.tag && o.addQty) {
      const c = s.checks.find((x) => x.jobId === jobId && x.tag === o.tag)
      if (c) {
        c.ordered += o.addQty
        c.note = `${o.addQty} ${c.unit} ordered by us · ${id}`
      }
      closeTasks(s, ['t-qty114'], 'Ordered the short tile')
      setIssues(s, jobId, (iss) => iss.filter((i) => !/short/i.test(i.text)))
    }
    newTask(s, { jobId, title: `${id} · waiting for ${o.supplier} to confirm`, type: 'Materials', owner: matBy(s), for: matFor(s), state: 'waiting', waitingOn: o.supplier, followUp: 'Tomorrow', tone: 'warn', where: o.what, action: { label: 'Mark confirmed', kind: 'po:' + id } })
    addHist(s, jobId, { who: me(), kind: 'material', title: `${id} sent to ${o.supplier} · ${o.what}`, detail: o.lines.map((l) => `${l.qty} ${l.item}`).join(', ') })
  }, `${id} sent to ${o.supplier}`, { sub: `Needed on site ${o.neededBy}. Materials follows up if they don’t confirm.`, flow: [{ who: matBy(S()), label: 'Sent', state: 'done' }, { label: o.supplier, state: 'now' }, { label: 'Delivered', state: 'next' }, { who: 'accounting', label: 'Bill', state: 'next' }] })
  S().close()
  /* the real app: the PO goes to the supplier by email */
  if (mailLive()) void emailPO(id)
  return id
}
export function confirmPO(id: string, eta: string) {
  S().commit((s) => {
    const p = s.pos.find((x) => x.id === id)
    if (!p) return
    p.step = 2
    p.eta = eta
    p.late = false
    p.note = `Confirmed · arrives ${eta}`
    p.log.push(L(me(), `${p.supplier} confirmed · ETA ${eta}`))
    s.mats.forEach((m) => {
      if (m.po === id && m.status === 'sent') {
        m.status = 'confirmed'
        m.eta = eta
      }
    })
    closeTasks(s, s.tasks.filter((t) => t.title.startsWith(id) || t.action?.kind === 'po:' + id || (id === 'PO-1045' && t.id === 't-po1045')).map((t) => t.id), 'Confirmed')
    setIssues(s, p.jobId, (iss) => iss.filter((i) => !i.text.includes(id) && !/supplier has not confirmed/i.test(i.text)))
    addHist(s, p.jobId, { who: me(), kind: 'material', title: `${p.supplier} confirmed ${id}`, detail: `Arrives ${eta}` })
  }, `${id} confirmed — arrives ${eta}`, { close: true, flow: [{ who: matBy(S()), label: 'Sent', state: 'done' }, { label: 'Confirmed', state: 'done' }, { label: `Arrives ${eta}`, state: 'now' }, { who: 'accounting', label: 'Bill', state: 'next' }] })
}
export function receivePO(id: string) {
  S().commit((s) => {
    const p = s.pos.find((x) => x.id === id)
    if (!p) return
    p.step = 3
    p.late = false
    p.note = 'Delivered'
    p.log.push(L(me(), 'Delivered to site · all lines'))
    s.mats.forEach((m) => {
      if (m.po === id) m.status = 'delivered'
    })
    closeTasks(s, s.tasks.filter((t) => (id === 'PO-1042' && t.id === 't-trim118') || (id === 'PO-1041' && t.id === 't-jolly') || (id === 'PO-1039' && t.id === 't-thinset')).map((t) => t.id), 'Delivered')
    const thinset828 = p.jobId === '828' && (id === 'PO-1039' || /thinset/i.test(p.what))
    setIssues(s, p.jobId, (iss) => iss.filter((i) => !i.text.includes(id) && !(id === 'PO-1042' && /trim/i.test(i.text)) && !(thinset828 && /thinset/i.test(i.text))))
    if (thinset828) {
      const r = s.ready.find((x) => x.jobId === '828' && x.kind === 'hold')
      if (r) {
        r.kind = 'return'
        r.label = 'Return visit'
        r.warn = undefined
      }
      s.punch.forEach((x) => {
        if (x.jobId === '828' && /thinset/i.test(x.note || '')) x.note = 'Thinset on site'
      })
      closeTasks(s, ['t-thinset'], 'Delivered')
      s.jobs['828'].keyDate = { label: 'Return', value: 'Not booked', tone: 'warn' }
      newTask(s, { jobId: '828', title: 'Schedule the 828 Clyde return', type: 'Schedule', owner: 'ys', for: ['pm', 'owner'], state: 'now', due: 'This week', tone: 'neutral', where: 'Lobby repairs · landing · about 2 days', action: { label: 'Schedule', kind: 'assign' } })
    }
    addHist(s, p.jobId, { who: me(), kind: 'material', title: `${id} delivered · ${p.what}`, detail: thinset828 ? 'The return is off hold — ready to book' : undefined })
  }, `${id} delivered — it’s on site`, { close: true, flow: [{ who: matBy(S()), label: 'Sent', state: 'done' }, { label: 'Confirmed', state: 'done' }, { label: 'Delivered', state: 'done' }, { who: 'accounting', label: 'Bill', state: 'now' }] })
}
export function poNext(id: string) {
  S().commit((s) => {
    const p = s.pos.find((x) => x.id === id)
    if (!p) return
    p.step = Math.min(5, p.step + 1)
    p.note = p.step === 4 ? 'Supplier bill received' : p.step === 5 ? 'Paid' : p.note
    p.log.push(L(me(), p.step === 4 ? 'Supplier bill received — matched to the PO' : 'Paid'))
  }, 'PO updated')
}
export function followUpPO(id: string, said: string, back: string) {
  S().commit((s) => {
    const p = s.pos.find((x) => x.id === id)
    if (!p) return
    p.log.push(L(me(), `Called ${p.supplier} — “${said}”`))
    p.eta = said
    s.tasks.forEach((t) => {
      if ((id === 'PO-1042' && t.id === 't-trim118') || (id === 'PO-1039' && t.id === 't-thinset')) {
        t.state = 'waiting'
        t.waitingOn = p.supplier
        t.followUp = back
        t.log.push(L(me(), `${p.supplier}: “${said}” · back ${back}`))
      }
    })
    addHist(s, p.jobId, { who: me(), kind: 'material', title: `Followed up ${id} with ${p.supplier}`, detail: `“${said}” — back ${back}` })
  }, `Logged — it comes back ${back}`)
}

/* ================= record what happened ================= */
export function recordEvent(e: { jobId: string; type: string; label: string; kind?: string; where?: string; from?: string; to?: string; waitingOn?: string; back?: string; note?: string }) {
  S().commit((s) => {
    const j = s.jobs[e.jobId]
    const title = `${e.label}${e.kind ? ' · ' + e.kind : ''}`
    addHist(s, e.jobId, { who: me(), kind: e.type === 'change' ? 'change' : e.type === 'question' ? 'question' : e.type === 'delivery' || e.type === 'shortage' ? 'material' : e.type === 'decision' ? 'decision' : e.type === 'payment' ? 'money' : 'field', title, detail: [e.where, e.from && e.to ? `${e.from} → ${e.to}` : '', e.note].filter(Boolean).join(' · ') || undefined, from: e.from, to: e.to })
    if (e.type === 'change') {
      newTask(s, { jobId: e.jobId, title: `Price the change · ${e.where || j.name}`, type: 'Changes', owner: 'estimator', for: ['estimator'], state: 'now', due: 'Wed', tone: 'info', where: e.where, detail: `${e.from || ''} → ${e.to || ''}. The approved scope stays in history.` })
      newTask(s, { jobId: e.jobId, title: `Change requested · ${e.where || ''}`, type: 'Changes', owner: 'ys', for: ['pm', 'owner'], state: 'now', due: 'Today', tone: 'warn', where: e.where, blocks: 'Crew holds until approved', detail: 'Decide: included or extra. If extra, it goes to pricing and approval.' })
    }
    if (e.type === 'question') newTask(s, { jobId: e.jobId, title: e.kind ? `Question · ${e.kind}` : 'Technical question', type: 'Field', owner: me(), for: [s.role], state: 'waiting', waitingOn: e.waitingOn || 'GC', followUp: e.back || 'Tomorrow', tone: 'warn', where: e.where, blocks: e.where ? `${e.where} only` : undefined })
    /* a request from the site: whoever orders our materials gets it over there, and says "Delivered" — the one who asked hears it */
    if (e.type === 'shortage') newTask(s, { jobId: e.jobId, title: `Get to the site · ${e.kind || 'material'}${e.note ? ` — ${e.note}` : ''}`, detail: `${PEOPLE[me()]?.name || 'The site'} asked for it${e.where ? ` · ${e.where}` : ''}`, type: 'Materials', owner: matBy(s), for: matFor(s), by: me(), followers: [me()].filter((p) => p !== matBy(s)), state: 'now', due: 'Today', tone: 'bad', where: e.where })
    if (e.type === 'delivery' && e.kind && !/^All of it/.test(e.kind)) newTask(s, { jobId: e.jobId, title: `Delivery · ${e.kind.toLowerCase()} — ${e.where || 'check it'}`, type: 'Materials', owner: matBy(s), for: matFor(s), state: 'now', due: 'Today', tone: e.kind === 'Part of it' ? 'warn' : 'bad', where: e.where })
    if (e.type === 'call' && e.back) {
      const open = s.tasks.find((t) => t.jobId === e.jobId && t.state !== 'done' && t.type === 'Pricing')
      if (open) {
        open.state = 'waiting'
        open.waitingOn = e.waitingOn || 'Client'
        open.followUp = e.back
        open.log.push(L(me(), `${e.kind} · back ${e.back}`))
      }
    }
  }, 'Recorded — the right people have it')
  S().closeAll()
}

export const STAGE_ORDER: Stage[] = ['setup', 'verification', 'ready', 'scheduled', 'installation', 'punch', 'closeout', 'complete']

/* ================= punch, surfaces, rooms ================= */
export function setPunch(id: string, status: 'open' | 'working' | 'verify' | 'verified') {
  S().commit((s) => {
    const p = s.punch.find((x) => x.id === id)
    if (!p) return
    p.status = status
    if (status === 'verified' && p.taskId) closeTasks(s, [p.taskId], 'Verified')
    /* the crew says it's done — the site manager gets it to check, once per project */
    if (status === 'verify' && !s.tasks.some((t) => t.jobId === p.jobId && t.state !== 'done' && /check/i.test(t.title) && /touch-?up/i.test(t.title))) {
      newTask(s, { jobId: p.jobId, title: `Check the touch-ups at ${s.jobs[p.jobId]?.name || 'the project'}`, type: 'Field', owner: 'yakov', for: ['site'], watch: ['owner'], state: 'now', due: 'Tomorrow', tone: 'info', where: `${PEOPLE[p.owner]?.short || 'The crew'} marked “${p.text}” done`, action: { label: 'Check them', kind: 'tab:touchups' } })
    }
    addHist(s, p.jobId, { who: me(), kind: 'field', title: `Punch · ${p.text} — ${({ open: 'reopened', working: 'crew working', verify: 'ready to verify', verified: 'verified' } as any)[status]}` })
  }, status === 'verified' ? 'Checked!' : status === 'verify' ? 'Done!' : 'Updated', status === 'verified' || status === 'verify' ? { tone: 'done', sub: status === 'verify' ? 'The site manager checks it next.' : undefined } : undefined)
}
export function addPunch(jobId: string, text: string, where: string) {
  S().commit((s) => {
    s.punch.push({ id: 'pu' + Date.now(), jobId, text, where, owner: s.jobs[jobId]?.crew || 'ys', status: 'open' })
    addHist(s, jobId, { who: me(), kind: 'field', title: `Punch item added · ${text}`, detail: where })
  }, 'Punch item added')
}
export function confirmSurface(jobId: string, room: string, surf: string) {
  S().commit((s) => {
    const sf = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((x) => x.name === surf)
    if (!sf) return
    if (sf.state === 'unknown') {
      sf.state = 'ready'
      sf.reason = undefined
    }
    sf.decided = [...(sf.decided || []), `Verified on site — ${PEOPLE[me()].name}, ${NOW}`]
    addHist(s, jobId, { who: me(), kind: 'field', title: `Confirmed on site · ${room} — ${surf}` })
  }, `${room} · ${surf} confirmed`)
}
export function buildRooms(jobId: string, rooms: { name: string; surfaces: string[] }[]) {
  S().commit((s) => {
    s.rooms[jobId] = rooms.map((r) => ({ name: r.name, pct: 0, surfaces: r.surfaces.map((n) => ({ name: n, tile: '', state: 'notstarted' as const })) }))
    const j = s.jobs[jobId]
    setIssues(s, jobId, (iss) => iss.filter((i) => !/setup not started/i.test(i.text)))
    j.next = { text: 'Enter the tile paperwork and check quantities', owner: 'office', due: 'Wed' }
    addHist(s, jobId, { who: me(), kind: 'setup', title: `Rooms built · ${rooms.length} rooms, ${rooms.reduce((n, r) => n + r.surfaces.length, 0)} surfaces` })
  }, `${rooms.length} rooms built from the finish schedule`)
  S().close()
}

/** one more room on a project — the estimate missed it, or the paperwork has it */
export function addRoom(jobId: string, name: string, surfaces: string[]) {
  const n = name.trim()
  if (!n) return
  S().commit((s) => {
    const rooms = (s.rooms[jobId] ||= [])
    if (rooms.some((r) => r.name.toLowerCase() === n.toLowerCase())) return
    rooms.push({ name: n, pct: 0, surfaces: surfaces.map((x) => ({ name: x, tile: '', state: 'notstarted' as const })) })
    addHist(s, jobId, { who: me(), kind: 'setup', title: `Room added · ${n}`, detail: surfaces.join(', ') })
  }, `${n} added`, { sub: 'Put in the square feet so the materials and the bills follow.' })
}
/** one more wall or floor in a room */
export function addSurface(jobId: string, room: string, name: string, sf?: number) {
  const n = name.trim()
  if (!n) return
  S().commit((s) => {
    const r = s.rooms[jobId]?.find((x) => x.name === room)
    if (!r || r.surfaces.some((x) => x.name.toLowerCase() === n.toLowerCase())) return
    r.surfaces.push({ name: n, tile: '', state: 'notstarted', ...(sf ? { sf } : {}) })
    addHist(s, jobId, { who: me(), kind: 'setup', title: `${room} · ${n.toLowerCase()} added`, detail: sf ? `${sf} SF` : undefined })
  }, `${room} · ${n} added`)
}

/* ================= the designer meeting and the height check ================= */
export function logMeeting(taskId: string, o: { when: string; time: string; where: string; with: string }) {
  S().commit((s) => {
    const t = s.tasks.find((x) => x.id === taskId)
    if (!t) return
    t.state = 'waiting'
    t.waitingOn = o.with
    t.followUp = o.when
    t.title = `Meeting with the ${o.with.toLowerCase()} · ${o.when} ${o.time}`
    t.log.push(L(me(), `Meeting set · ${o.when} ${o.time} · ${o.where}`))
    const j = s.jobs[t.jobId]
    s.prep[t.jobId] = { ...(s.prep[t.jobId] || {}), meeting: { text: `${o.with === 'Designer' ? 'Design meeting' : `Meeting with the ${o.with.toLowerCase()}`}`, day: o.when, time: o.time }, nextStep: `Meet the ${o.with.toLowerCase()} · ${o.when} ${o.time}` }
    j.next = { text: `Meet the ${o.with.toLowerCase()} · ${o.when} ${o.time}`, owner: 'ys', due: o.when }
    setIssues(s, t.jobId, (iss) => iss.map((i) => (/designer/i.test(i.text) ? { tone: 'warn', text: `Master bath layout · meeting ${o.when} ${o.time}` } : i)))
    addHist(s, t.jobId, { who: me(), kind: 'decision', title: `Meeting set with the ${o.with.toLowerCase()} · ${o.when} ${o.time}`, detail: o.where })
  }, `Meeting set — it comes back to you ${o.when === 'Tomorrow' ? 'tomorrow' : 'on ' + o.when}`)
  S().close()
}

export function recordHeights(jobId: string, taskId: string | undefined, heights: { room: string; surface: string; height: string }[]) {
  S().commit((s) => {
    heights.forEach((h) => {
      const sf = s.rooms[jobId]?.find((r) => r.name === h.room)?.surfaces.find((x) => x.name === h.surface)
      if (!sf) return
      sf.height = h.height
      if (sf.state === 'unknown') {
        sf.state = 'ready'
        sf.reason = undefined
      }
      sf.decided = [...(sf.decided || []), `Height ${h.height} — measured on site, ${NOW}`]
    })
    if (taskId) closeTasks(s, [taskId], 'Heights recorded')
    const j = s.jobs[jobId]
    setIssues(s, jobId, (iss) => iss.filter((i) => !/height/i.test(i.text)))
    if (/height/i.test(j.next.text)) j.next = { text: j.crew ? 'Pre-start checks' : 'Assign a crew — walls released', owner: 'ys', due: 'This week' }
    const r = s.ready.find((x) => x.jobId === jobId)
    if (r) {
      r.areas = Array.from(new Set([...r.areas, ...heights.map((h) => h.room)]))
      r.warn = r.warn && /height|wall tile/i.test(r.warn) ? undefined : r.warn
    }
    addHist(s, jobId, { who: me(), kind: 'field', title: `Wall heights measured on site · ${heights.length} surfaces`, detail: heights.map((h) => `${h.room} ${h.surface.toLowerCase()}: ${h.height}`).join(' · ') })
  }, 'Heights saved — the walls are released to the crew')
  S().close()
}

/* ================= a change asked on site: one click starts everything ================= */
export function nextCO(s: { money: MoneyItem[] }, jobId: string) {
  const n = s.money
    .filter((m) => m.jobId === jobId && m.kind === 'change')
    .map((m) => Number((m.title.match(/CO-(\d+)/) || [])[1] || 0))
  return 'CO-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')
}
export interface SiteChangeInput {
  jobId: string; room: string; surface: string
  label: string; from: string; to: string
  by: string; note?: string
  /** change in tiled area (+ more, − less) */
  sfDelta: number
  /** tile to order for it, before waste */
  tileTag: string; tileSF: number
  ipoQty: string; ipoAmount: number
  doIPO: boolean; doTile: boolean
  /** decided at the design meeting, when the scope is confirmed */
  meeting?: boolean
}
export function siteChange(o: SiteChangeInput) {
  const co = nextCO(S(), o.jobId)
  S().commit((s) => {
    const j = s.jobs[o.jobId]
    const sf = s.rooms[o.jobId]?.find((r) => r.name === o.room)?.surfaces.find((x) => x.name === o.surface)
    const id = 'co-' + co.toLowerCase() + '-' + o.jobId
    const estimate = Math.max(450, Math.round((Math.abs(o.sfDelta) * 68 + o.tileSF * 6) / 10) * 10)
    s.money.unshift({
      id, jobId: o.jobId, kind: 'change', title: `${co} · ${o.room} ${o.surface.toLowerCase()} · ${o.label.toLowerCase()} ${o.to.toLowerCase()}`,
      amount: null, step: -1, state: 'upcoming', due: 'Being priced', note: `${o.label}: ${o.from} → ${o.to}. ${o.meeting ? 'Decided at the design meeting' : 'Asked on site'} by the ${o.by.toLowerCase()}. Billable the moment the approval is recorded.`,
      log: [L(me(), `${o.meeting ? 'Decided at the design meeting' : 'Asked on site'} by the ${o.by.toLowerCase()}${o.note ? ' — ' + o.note : ''}`)],
      meta: { room: o.room, surface: o.surface, label: o.label, from: o.from, to: o.to, sfDelta: o.sfDelta, tileTag: o.tileTag, tileSF: o.tileSF, ipoQty: o.ipoQty, ipoAmount: o.ipoAmount, doTile: o.doTile, doIPO: o.doIPO, by: o.by, estimate, ...(o.meeting ? { meeting: true } : {}) },
    })
    if (sf) {
      sf.pending = { co, label: o.label, from: o.from, to: o.to }
      sf.state = 'hold'
      sf.reason = `${co} · ${o.label.toLowerCase()} ${o.from} → ${o.to} — hold until approved`
    }
    newTask(s, { jobId: o.jobId, title: `Price ${co} · ${o.room} ${o.surface.toLowerCase()}`, type: 'Changes', owner: 'estimator', for: ['estimator'], watch: ['owner', 'pm'], state: 'now', due: 'Today', dueTone: 'warn', tone: 'info', where: `${o.label}: ${o.from} → ${o.to}`, detail: `${o.sfDelta ? `About ${o.sfDelta > 0 ? '+' : ''}${o.sfDelta} SF. ` : ''}Both scopes and the photos are attached. Send it to the GC from here.`, action: { label: 'Price it', kind: 'co:' + id } })
    if (o.doIPO) {
      let ipo = s.ipos.find((p) => p.jobId === o.jobId)
      if (!ipo && j?.crew) {
        ipo = { id: 'IPO-' + o.jobId.toUpperCase(), jobId: o.jobId, crew: j.crew, status: 'Accepted', date: NOW, lines: [], changes: [], log: [] }
        s.ipos.push(ipo)
      }
      if (ipo) {
        ipo.changes.push({ co, text: `${o.room} ${o.surface.toLowerCase()} — ${o.label.toLowerCase()} ${o.from} → ${o.to}`, qty: o.ipoQty, amount: o.ipoAmount, status: 'pending' })
        ipo.log.push(L(me(), `${co} drafted · goes to ${PEOPLE[ipo.crew].name} when approved`))
      }
    }
    if (o.doTile && o.tileSF > 0) {
      const c = s.checks.find((x) => x.jobId === o.jobId && x.tag === o.tileTag)
      if (c) c.note = `If ${co} is approved: +${Math.ceil(o.tileSF * (1 + c.wastePct / 100))} SF with waste`
    }
    setIssues(s, o.jobId, (iss) => [...iss, { tone: 'warn', text: `${co} waiting on pricing and approval · ${o.room}` }])
    addHist(s, o.jobId, { who: me(), kind: 'change', title: `${co} ${o.meeting ? 'from the design meeting' : 'asked on site'} · ${o.room} ${o.surface.toLowerCase()}`, from: o.from, to: o.to, detail: `Asked by the ${o.by.toLowerCase()}. ${o.meeting ? 'That surface waits' : 'The crew holds that surface'}; the price, the installer’s PO and the tile wait for approval.` })
    s.notices.unshift({ id: 'nco' + Date.now(), jobId: o.jobId, text: `${co} ${o.meeting ? 'from the design meeting' : 'asked on site'} · ${j?.name} · ${o.room}`, when: 'Just now', kind: 'change', unread: true, open: { t: 'job', id: o.jobId, tab: 'money' } })
  }, `${co} started — estimator, crew hold, installer PO and tile are all lined up`, o.meeting ? { sub: 'The estimator prices it, then it goes to the client for the OK — the tile and the installer’s PO follow.' } : undefined)
  return co
}
export function sendCO(id: string, amount: number) {
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    if (!m || !m.meta) return
    m.amount = amount
    m.meta.sent = true
    m.due = 'Waiting on GC approval'
    m.log.push(L(me(), `Priced at ${fmtMoney(amount)} · sent to the GC`))
    const co = m.title.split(' · ')[0]
    closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'co:' + id && t.owner === 'estimator').map((t) => t.id), 'Priced and sent')
    newTask(s, { jobId: m.jobId, title: `${co} waiting on the GC`, type: 'Changes', owner: 'ys', for: ['owner', 'pm'], watch: ['estimator', 'accounting', 'site'], state: 'waiting', waitingOn: 'GC', followUp: 'Wed', tone: 'warn', blocks: `${m.meta.room} ${m.meta.surface.toLowerCase()}`, where: `${m.meta.room} · ${m.meta.surface}`, detail: `${m.meta.label}: ${m.meta.from} → ${m.meta.to}. Priced at ${fmtMoney(amount)}.`, action: { label: 'Record approval', kind: 'co:' + id } })
    setIssues(s, m.jobId, (iss) => iss.map((i) => (i.text.startsWith(co) ? { ...i, text: `${co} waiting on GC approval` } : i)))
    addHist(s, m.jobId, { who: me(), kind: 'change', title: `${co} priced and sent to the GC · ${fmtMoney(amount)}` })
  }, 'Sent to the GC — it comes back Wednesday by itself')
}
export function approveChange(id: string, o: { by: string; how: string }) {
  S().commit((s) => {
    const m = s.money.find((x) => x.id === id)
    if (!m || !m.meta) return
    const co = m.title.split(' · ')[0]
    const x = m.meta
    const amount = m.amount || x.estimate || 0
    m.amount = amount
    m.step = 0
    m.state = 'todo'
    m.due = 'Approved today'
    m.action = 'Add to next bill'
    m.note = `Approved by ${o.by} (${o.how.toLowerCase()}). Bills with the next progress bill.`
    m.log.push(L(me(), `Approved by ${o.by} · ${o.how.toLowerCase()}`))
    const sf = s.rooms[m.jobId]?.find((r) => r.name === x.room)?.surfaces.find((y) => y.name === x.surface)
    if (sf) {
      if (x.label === 'Height') sf.height = x.to
      if (x.label === 'Tile') sf.tile = x.tileTag
      if (x.label === 'Layout') sf.layout = x.to
      if (sf.sf && x.sfDelta) {
        const done = (sf.sf * surfacePct(sf)) / 100
        sf.sf = Math.max(1, sf.sf + x.sfDelta)
        sf.pct = Math.min(100, Math.round((done / sf.sf) * 100))
      } else if (sf.state === 'done' && x.sfDelta > 0) sf.pct = 60
      sf.state = (sf.pct || 0) >= 100 ? 'done' : 'ready'
      sf.pending = undefined
      sf.reason = undefined
      sf.decided = [...(sf.decided || []), `${x.label}: ${x.to} — ${co} approved by ${o.by}`]
    }
    recalc(s, m.jobId)
    const ipo = s.ipos.find((p) => p.jobId === m.jobId)
    const ch = ipo?.changes.find((c) => c.co === co)
    if (ipo && ch) {
      ch.status = 'sent'
      ipo.log.push(L(me(), `${co} change sent to ${PEOPLE[ipo.crew].name} · ${ch.qty}`))
      newTask(s, { jobId: m.jobId, title: `${PEOPLE[ipo.crew].name} to accept the PO change · ${co}`, type: 'Changes', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: PEOPLE[ipo.crew].name, followUp: 'Tomorrow', tone: 'info', where: `${ipo.id} · ${ch.qty}`, action: { label: 'Mark accepted', kind: `ipo:${ipo.id}:${co}` } })
    }
    let tileLine = ''
    let gcTile = true
    if (x.doTile && x.tileSF > 0) {
      const t = tileOf(m.jobId, x.tileTag)
      const c = s.checks.find((y) => y.jobId === m.jobId && y.tag === x.tileTag)
      const need = Math.ceil(x.tileSF * (1 + (c?.wastePct || 12) / 100))
      if (c) {
        c.measured += x.tileSF
        c.note = `${co} added ${need} SF with waste — ${t?.suppliedBy === 'GC' || c.suppliedBy === 'GC' ? 'GC asked to order it' : 'order placed'}`
      }
      tileLine = `${need} SF more ${x.tileTag}`
      gcTile = !t || t.suppliedBy === 'GC' || c?.suppliedBy === 'GC' || c?.suppliedBy === 'Owner'
      if (gcTile) {
        newTask(s, { jobId: m.jobId, title: `GC to order ${tileLine} for ${co}`, type: 'Materials', owner: 'office', for: ['office'], watch: ['materials'], state: 'waiting', waitingOn: 'GC', followUp: 'Wed', tone: 'warn', blocks: `${x.room} ${x.surface.toLowerCase()}`, where: `${x.room} · ${x.surface}` })
      } else {
        newTask(s, { jobId: m.jobId, title: `Order ${tileLine} for ${co}`, type: 'Materials', owner: matBy(s), for: matFor(s), watch: ['pm'], state: 'now', due: 'Today', dueTone: 'warn', tone: 'warn', blocks: `${x.room} ${x.surface.toLowerCase()}`, where: `${x.room} · ${x.surface}` })
      }
    }
    closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'co:' + id).map((t) => t.id), 'Approved')
    setIssues(s, m.jobId, (iss) => iss.filter((i) => !i.text.startsWith(co)).concat(tileLine ? [{ tone: 'warn', text: gcTile ? `GC to order ${tileLine} (${co})` : `${tileLine} to order (${co})` }] : []))
    newTask(s, { jobId: m.jobId, title: `Bill ${co} · ${x.room} ${x.surface.toLowerCase()}`, type: 'Money', owner: 'accounting', for: ['accounting'], state: 'now', due: 'With the next bill', tone: 'info', where: fmtMoney(amount), action: { label: 'Add to next bill', kind: 'money:' + id } })
    if (o.how === 'Verbal') newTask(s, { jobId: m.jobId, title: `Get ${co} approval in writing`, type: 'Changes', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: 'GC', followUp: 'Wed', tone: 'warn', where: 'Verbal approval on file' })
    addHist(s, m.jobId, { who: me(), kind: 'change', title: `${co} approved by ${o.by} (${o.how.toLowerCase()})`, from: x.from, to: x.to, detail: `Billable · crew instruction changed${ch ? ' · installer PO change sent' : ''}${tileLine ? ' · ' + tileLine + ' requested' : ''}` })
    s.notices.unshift({ id: 'nca' + Date.now(), jobId: m.jobId, text: `${co} approved · crew instruction changed`, when: 'Just now', kind: 'change', unread: true, open: { t: 'money', id: m.id } })
  }, 'Approved — billing, the crew, the installer PO and the tile are updated')
  S().close()
}
export function acceptIPOChange(ipoId: string, co: string, taskId?: string) {
  S().commit((s) => {
    const ipo = s.ipos.find((p) => p.id === ipoId)
    const ch = ipo?.changes.find((c) => c.co === co)
    if (!ipo || !ch) return
    ch.status = 'accepted'
    ipo.log.push(L(ipo.crew, `Accepted ${co} · ${ch.qty}`))
    if (taskId) closeTasks(s, [taskId], 'Accepted')
    addHist(s, ipo.jobId, { who: ipo.crew, kind: 'change', title: `${PEOPLE[ipo.crew].name} accepted the PO change · ${co}`, detail: `${ch.text} · ${ch.qty}` })
  }, `${co} accepted — the installer PO is up to date`)
  S().close()
}

/* ================= before the start: the "Coming up" board ================= */
/** what we pay the crew, built from the takeoff (sample rates: floors $15/SF, walls $18/SF) */
export function sendIPO(jobId: string) {
  const s0 = S()
  const j0 = s0.jobs[jobId]
  const crew = (j0?.crew || s0.bookings.find((b) => b.jobId === jobId)?.crew) as PersonKey | undefined
  if (!j0 || !crew) return
  S().commit((s) => {
    const rooms = s.rooms[jobId] || []
    const isFloor = (tag: string) => rooms.some((r) => r.surfaces.some((x) => x.tile === tag && /floor|base|hearth/i.test(x.name))) && !rooms.some((r) => r.surfaces.some((x) => x.tile === tag && /wall|splash|shower w|tub/i.test(x.name)))
    const lines = s.checks
      .filter((c) => c.jobId === jobId && c.unit === 'SF')
      .map((c) => {
        const floor = isFloor(c.tag)
        return { item: `${floor ? 'Floor' : 'Wall'} tile — ${tileOf(jobId, c.tag)?.name || c.tag}, set and grout`, qty: `about ${c.measured} SF`, amount: c.measured * (floor ? 15 : 18) }
      })
    if (!lines.length) lines.push({ item: 'Install per the rooms and surfaces', qty: 'per scope', amount: Math.round(((s.jobs[jobId].contract || 40000) * 0.3) / 10) * 10 })
    const id = /^\d/.test(jobId) ? 'IPO-' + jobId.toUpperCase() : 'IPO-' + (201 + s.ipos.length)
    s.ipos = s.ipos.filter((p) => p.id !== id)
    s.ipos.push({ id, jobId, crew, status: 'Sent', date: NOW, lines, changes: [], log: [L(me(), `Sent to ${PEOPLE[crew].name}`)] })
    newTask(s, { jobId, title: `${PEOPLE[crew].name} to accept the installer PO · ${s.jobs[jobId].name}`, type: 'Schedule', owner: 'ys', for: ['owner', 'pm'], state: 'waiting', waitingOn: PEOPLE[crew].name, followUp: 'Tomorrow', tone: 'info', where: id, action: { label: 'Mark accepted', kind: 'ipoaccept:' + id } })
    addHist(s, jobId, { who: me(), kind: 'schedule', title: `Installer PO ${id} sent to ${PEOPLE[crew].name}`, detail: lines.map((l) => `${l.item} · ${l.qty}`).join(' · ') })
  }, `Installer PO sent to ${PEOPLE[crew].name} — it comes back when he accepts`)
  const sent = S().ipos.find((p) => p.jobId === jobId && p.crew === crew && p.status === 'Sent')
  if (mailLive() && sent) void emailIPO(sent.id)
}
export function acceptIPO(ipoId: string, taskId?: string) {
  const ipo0 = S().ipos.find((p) => p.id === ipoId)
  if (!ipo0) return
  S().commit((s) => {
    const ipo = s.ipos.find((p) => p.id === ipoId)!
    ipo.status = 'Accepted'
    ipo.date = NOW
    ipo.log.push(L(ipo.crew, 'Accepted'))
    closeTasks(s, taskId ? [taskId] : s.tasks.filter((t) => t.action?.kind === 'ipoaccept:' + ipoId).map((t) => t.id), 'Accepted')
    addHist(s, ipo.jobId, { who: ipo.crew, kind: 'schedule', title: `${PEOPLE[ipo.crew].name} accepted installer PO ${ipoId}` })
  }, `${PEOPLE[ipo0.crew].name} accepted the installer PO`)
  S().close()
}
/** the walkthrough with the crew before the start */
export function setWalk(jobId: string, o: { when: string; time: string; with: string; where: string }) {
  S().commit((s) => {
    const j = s.jobs[jobId]
    s.prep[jobId] = { ...(s.prep[jobId] || {}), walk: { state: 'set', when: `${o.when} ${o.time}`, with: o.with }, meeting: { text: `Installer meeting — ${o.with}`, day: o.when, time: o.time } }
    closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'walk-done:' + jobId).map((t) => t.id), 'Rescheduled')
    newTask(s, { jobId, title: `Walkthrough at ${j.name} with ${o.with} · ${o.when} ${o.time}`, type: 'Field', owner: 'ys', for: ['owner', 'pm', 'site'], state: 'waiting', waitingOn: o.with, followUp: o.when, tone: 'info', where: o.where, action: { label: 'Mark done', kind: 'walk-done:' + jobId } })
    addHist(s, jobId, { who: me(), kind: 'schedule', title: `Walkthrough set with ${o.with} · ${o.when} ${o.time}`, detail: o.where })
  }, `Walkthrough set — it comes back ${o.when === 'Tomorrow' ? 'tomorrow' : 'on ' + o.when}`)
  S().close()
}
export function walkDone(jobId: string, taskId?: string) {
  S().commit((s) => {
    const w = s.prep[jobId]?.walk
    s.prep[jobId] = { ...(s.prep[jobId] || {}), walk: { state: 'done', when: w?.when, with: w?.with } }
    closeTasks(s, taskId ? [taskId] : s.tasks.filter((t) => t.action?.kind === 'walk-done:' + jobId).map((t) => t.id), 'Walked it')
    addHist(s, jobId, { who: me(), kind: 'field', title: `Walked the project with ${w?.with || 'the crew'}` })
  }, 'Walkthrough done')
  if (S().modals.some((m) => m.t === 'task')) S().close()
}
export function gcConfirmed(taskId: string) {
  const t0 = S().tasks.find((x) => x.id === taskId)
  if (!t0) return
  S().commit((s) => {
    closeTasks(s, [taskId], 'GC confirmed the start')
    addHist(s, t0.jobId, { who: me(), kind: 'schedule', title: 'GC confirmed the start date' })
  }, 'The GC confirmed the start')
  if (S().modals.some((m) => m.t === 'task')) S().close()
}

/* ================= notes ================= */
export function addNote(jobId: string, text: string) {
  S().commit((s) => {
    s.notes[jobId] = [{ id: 'note' + Date.now(), who: me(), date: 'Just now', text }, ...(s.notes[jobId] || [])]
  }, 'Note added')
}

/* ================= the game plan (Coming up) ================= */
const PLAN_LABEL: Record<string, string> = { target: 'Start / timing', meeting: 'Next meeting', installer: 'Installer', confirmed: 'Installer confirmed', paperwork: 'Latest tile paperwork', po: 'PO made', material: 'Material ordered', deposit: 'Deposit request', nextStep: 'Next step', notes: 'Notes' }
const showVal = (k: string, v: any) =>
  k === 'installer' ? (v && v !== 'tbd' ? PEOPLE[v as PersonKey].name : 'TBD') : k === 'meeting' ? [v?.text, v?.day, v?.time].filter(Boolean).join(' · ') : v === 'yes' ? 'Yes' : v === 'no' ? 'No' : v === 'na' ? 'N/A' : v === 'qty' ? 'Sent to update QTY' : String(v || '—')
/** change one answer on the game plan — it's logged on the project like everything else */
export function setPlan(jobId: string, patch: Record<string, any>) {
  const [k, v] = Object.entries(patch)[0]
  S().commit((s) => {
    s.prep[jobId] = { ...(s.prep[jobId] || {}), ...patch }
    /* a next meeting with a day and a time goes on the calendar too — one place for every meeting */
    if (k === 'meeting') {
      const date = isoOfDay(v?.day)
      const start = parseTime(v?.time)
      const ev = s.events.find((e) => e.jobId === jobId && e.plan)
      if (date && start != null) {
        if (ev) Object.assign(ev, { title: v.text, date, start })
        else s.events.push({ id: 'ev-' + jobId + Date.now().toString(36), jobId, kind: /walk/i.test(v.text) ? 'walkthrough' : 'meeting', title: v.text, date, start, dur: 60, people: [me()], plan: true })
      } else if (ev) s.events = s.events.filter((e) => e !== ev)
    }
    if (k === 'nextStep' && s.jobs[jobId] && v) s.jobs[jobId].next = { ...s.jobs[jobId].next, text: v }
    addHist(s, jobId, { who: me(), kind: 'setup', title: `${PLAN_LABEL[k] || k}: ${showVal(k, v)}` })
  }, `${PLAN_LABEL[k] || k} · ${showVal(k, v)}`)
}
/** the project starts: it moves down to In progress, the crew is on the schedule, and the daily updates begin */
export function startProject(jobId: string) {
  const s0 = S()
  const j0 = s0.jobs[jobId]
  const crew = s0.prep[jobId]?.installer
  if (!j0 || !crew || crew === 'tbd') return
  const startIso = workday(TODAY)
  const end = addBusinessDays(startIso, 5)
  S().commit((s) => {
    const j = s.jobs[jobId]
    const b = s.bookings.find((x) => x.jobId === jobId && x.label !== 'Return visit')
    if (!b) s.bookings.push({ id: 'bk' + Date.now(), crew, jobId, start: startIso, end, label: (s.ready.find((r) => r.jobId === jobId)?.areas || []).slice(0, 2).join(' · ') || 'Starting areas', workers: j.workers || 2, status: 'on' })
    else {
      if (b.start > startIso) b.start = startIso
      if (b.end < end) b.end = end
      b.crew = crew
      b.status = 'on'
    }
    s.ready = s.ready.filter((r) => r.jobId !== jobId)
    j.stage = 'installation'
    j.crew = crew
    j.workers = j.workers || 2
    j.pct = j.pct ?? 0
    j.stageDates = { ...(j.stageDates || {}), scheduled: j.stageDates?.scheduled || NOW, installation: NOW }
    j.keyDate = { label: 'Started', value: NOW }
    j.next = { text: 'Daily updates', owner: 'ys', due: 'Every day' }
    s.prep[jobId] = { ...(s.prep[jobId] || {}), started: NOW, target: `Started ${NOW}`, confirmed: 'yes' }
    closeTasks(s, s.tasks.filter((t) => t.jobId === jobId && t.type === 'Schedule' && t.state !== 'done').map((t) => t.id), 'Started')
    addHist(s, jobId, { who: me(), kind: 'schedule', title: `Started — ${PEOPLE[crew].name} is on site`, detail: 'Moved to In progress on the game plan' })
  }, `${j0.name} started`, { sub: 'It’s In progress. The daily update shows up on the site manager’s Today from now on.', to: [{ who: crew as PersonKey, what: 'On site' }, { who: 'yakov', what: 'Daily update every day' }] })
}
