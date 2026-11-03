/* Jobs from Asana, brought in all at once — from Asana's own CSV export of a project (Cobblestone Sales Process): every
 * open job in its place. The ones still being priced go on Estimates (a new submission, estimating, waiting for the
 * client's OK); the won ones on Projects (getting ready, ready for the crew, in progress, touch-ups). Each one with its
 * client (the client's own project in Asana — the task sits in both), its installer, its dates, its notes and its link
 * back to Asana. Where each one stands comes from Cobblestone's Asana fields: "Actions 5.0" (the numbered step) and
 * "Job Status 5.0". The papers come after, by hand: each project's estimate (its rooms) and its tile paperwork. */
import { useStore, addHist, meOf, NOW } from '@/tileos/store'
import { CUSTOMERS } from '@/tileos/data/jobs'
import { PEOPLE, CREWS, fmtMoney, type Customer, type Job, type PersonKey, type Stage } from '@/tileos/data/model'
import { labelFromIso } from '@/tileos/lib/today'
import { companySteps } from './steps'

/* ---------------- the file ---------------- */
/** a CSV file as rows of cells (quotes, commas and line breaks inside quotes, a byte-order mark) */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
      continue
    }
    if (ch === '"') { q = true; continue }
    if (ch === ',') { row.push(cell); cell = ''; continue }
    if (ch === '\r') continue
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim()))
}

/* ---------------- where a job stands ---------------- */
/** request · estimating · waiting for the client's OK — on Estimates; won (getting ready) · ready for the crew ·
 *  installing · touch-ups — on Projects; done and lost are left out */
export type Place = 'request' | 'estimating' | 'pending' | 'won' | 'ready' | 'installing' | 'touchups' | 'done' | 'lost'
export const PLACES: { key: Place; label: string; on: 'Estimates' | 'Projects' | 'Left out' }[] = [
  { key: 'request', label: 'New submission', on: 'Estimates' },
  { key: 'estimating', label: 'Estimating', on: 'Estimates' },
  { key: 'pending', label: 'Waiting for the client’s OK', on: 'Estimates' },
  { key: 'won', label: 'Getting ready', on: 'Projects' },
  { key: 'ready', label: 'Ready for the crew', on: 'Projects' },
  { key: 'installing', label: 'In progress', on: 'Projects' },
  { key: 'touchups', label: 'Touch-ups', on: 'Projects' },
  { key: 'done', label: 'Done', on: 'Left out' },
  { key: 'lost', label: 'Lost', on: 'Left out' },
]
const RANK: Record<Place, number> = { lost: -1, request: 0, estimating: 1, pending: 2, won: 3, ready: 4, installing: 5, touchups: 6, done: 7 }
/** from Cobblestone's numbered step ("12 - Job Oversight") first, the job status ("Customer Approval") when there's no step */
export function placeOf(action: string, status: string): Place {
  const a = action.toLowerCase()
  const s = status.toLowerCase()
  if (/\blost\b/.test(s) || /\blost\b/.test(a)) return 'lost'
  if (a.trim()) {
    if (/job done|send survey/.test(a)) return 'done'
    if (/punch|clean (the )?site|remove extra material/.test(a)) return 'touchups'
    if (/oversight/.test(a)) return 'installing'
    if (/review (&|and) coordinate|schedule the job|select sm|schedule job/.test(a)) return 'ready'
    if (/upload final paperwork|default po|check tile quantity|add info to task/.test(a)) return 'won'
    if (/confirmation|follow/.test(a)) return 'pending'
    if (/approve|estimate|measure|clarify scope|tile info/.test(a)) return 'estimating'
    if (/new submission/.test(a)) return 'request'
  }
  if (/job done/.test(s)) return 'done'
  if (/schedule job and coordinate/.test(s)) return 'installing'
  if (/crew needed|schedule job/.test(s)) return 'ready'
  if (/mobilization|co & additions|misc/.test(s)) return 'won'
  if (/customer approval|follow up/.test(s)) return 'pending'
  if (/approve estimate|estimating/.test(s)) return 'estimating'
  return 'request'
}

/* ---------------- one job from the list ---------------- */
export type ListJob = {
  key: string
  /** Asana's task id — its link */
  task?: string
  name: string; address: string; client: string; place: Place
  /** a price-out (a budget number), not an actual project yet */
  priceOut: boolean
  /** the installer as Asana says it, and ours when the name matches */
  crew?: string; crewKey?: PersonKey
  start?: string; finish?: string; due?: string
  estimator?: string; sales?: string; site?: string
  notes?: string; total?: number
  completed: boolean
  /** a project already in Tile OS that's the same job */
  dup?: string
  /** what Asana said, word for word */
  status?: string; action?: string
}
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const SUFFIX: [RegExp, string][] = [[/\broad\b/g, 'rd'], [/\bstreet\b/g, 'st'], [/\bavenue\b/g, 'ave'], [/\bdrive\b/g, 'dr'], [/\bcourt\b/g, 'ct'], [/\bplace\b/g, 'pl'], [/\blane\b/g, 'ln'], [/\bboulevard\b/g, 'blvd'], [/\bterrace\b/g, 'ter'], [/\bparkway\b/g, 'pkwy'], [/\bhighway\b/g, 'hwy'], [/\bmarc\b/g, 'mark']]
/** an address boiled down to its number and street — "2426 Whitesville Road" and "2426 Whitesville Rd. Toms River" match */
export function addrKey(t: string): string {
  let n = norm(t)
  SUFFIX.forEach(([re, w]) => { n = n.replace(re, w) })
  const w = n.split(' ')
  return /^\d/.test(w[0] || '') ? w.slice(0, 2).join(' ') : n
}
/** the same job: the same name, or the same number and street */
export const sameJob = (a: string, b: string) => !!a && !!b && (norm(a) === norm(b) || (/^\d/.test(norm(a)) && addrKey(a) === addrKey(b)))
/** "Schedule 489-497 Teaneck Rd." → "489-497 Teaneck Rd." — the scheduling task is the job */
export const cleanName = (t: string) => t.replace(/\s+/g, ' ').trim().replace(/^schedule\s+/i, '').trim()
const ADDR_LINE = /^\s*\d+[\w\-–]*\s+[\w .'-]*\b(st|street|ave|avenue|rd|road|dr|drive|ct|court|pl|place|ln|lane|blvd|way|ter|terrace|pkwy|parkway|hwy|highway|route|circle|cir|trl|trail)\b.*$/im
const isoDay = (v: string) => { const m = v.match(/(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`; const u = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); if (u) return `${u[3].length === 2 ? '20' + u[3] : u[3]}-${u[1].padStart(2, '0')}-${u[2].padStart(2, '0')}`; return undefined }
/** our installer by name — "Leo", "CLR Tile Leo", "Alex castro" */
export function crewOf(name?: string): PersonKey | undefined {
  if (!name) return undefined
  const words = norm(name).split(' ')
  return CREWS.find((c) => { const first = norm(PEOPLE[c]?.name || c).split(' ')[0]; return !!first && words.includes(first) })
}

/** the rows of Asana's CSV export, as jobs: the open ones (finished ones only when asked), the same job once (the one
 *  furthest along wins), and which are in Tile OS already */
export function jobsFromCsv(text: string, o: { finished?: boolean; have?: Job[] } = {}): { jobs: ListJob[]; board: string; finished: number; columns: boolean } {
  const rows = parseCsv(text)
  const head = (rows[0] || []).map((h) => h.replace(/\s+/g, ' ').trim().toLowerCase())
  const col = (...res: RegExp[]) => { for (const re of res) { const i = head.findIndex((h) => re.test(h)); if (i >= 0) return i } return -1 }
  const C = {
    name: col(/^name$/, /^task name$/, /^task$/), task: col(/^task id$/), done: col(/^completed at$/), projects: col(/^projects$/), notes: col(/^notes$/), due: col(/^due date$/),
    status: col(/^job status/, /^status$/), action: col(/^actions?\b/, /^next action/), type: col(/^proposal type/), crew: col(/assigned crew/, /^crew$/, /^installer$/),
    start: col(/scheduled ?start/, /^start date$/), finish: col(/estimated ?finish/, /^finish/), estimator: col(/^estimator/), sales: col(/sales ?person/), site: col(/^site manager/),
    client: col(/^client$/, /^customer$/, /^general contractor$/, /^gc$/), address: col(/^address$/, /^job address$/, /^location$/),
  }
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] || '').trim() : '')
  const body = rows.slice(1).filter((r) => at(r, C.name))
  /* the board itself is the project every task is in — the client is the other one */
  const counts = new Map<string, number>()
  body.forEach((r) => at(r, C.projects).split(/\s*,\s*/).filter(Boolean).forEach((p) => counts.set(p, (counts.get(p) || 0) + 1)))
  const board = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || ''
  const out: ListJob[] = []
  let finished = 0
  body.forEach((r, i) => {
    const completed = !!at(r, C.done)
    const action = at(r, C.action), status = at(r, C.status)
    let place = placeOf(action, status)
    if (completed && place !== 'lost') place = 'done'
    if (completed || place === 'done' || place === 'lost') finished++
    if ((completed || place === 'done' || place === 'lost') && !o.finished) return
    const name = cleanName(at(r, C.name))
    const notes = at(r, C.notes)
    const fromNotes = notes.match(ADDR_LINE)?.[0]?.trim()
    const address = at(r, C.address) || fromNotes || (/^\d/.test(name) ? name : '')
    const others = at(r, C.projects).split(/\s*,\s*/).filter((p) => p && p !== board)
    const total = notes.match(/total(?: price)?[^$\d\n]{0,20}\$\s?([\d,]+(?:\.\d{1,2})?)/i)?.[1]
    const crew = at(r, C.crew) || undefined
    const j: ListJob = {
      key: at(r, C.task) || `row${i}`, task: at(r, C.task) || undefined, name, address, client: at(r, C.client) || others[0] || '', place,
      priceOut: /price ?out|budget/i.test(at(r, C.type)), crew, crewKey: crewOf(crew),
      start: isoDay(at(r, C.start)), finish: isoDay(at(r, C.finish)), due: isoDay(at(r, C.due)),
      estimator: at(r, C.estimator) || undefined, sales: at(r, C.sales) || undefined, site: at(r, C.site) || undefined,
      notes: notes || undefined, total: total ? Number(total.replace(/,/g, '')) || undefined : undefined, completed, status: status || undefined, action: action || undefined,
    }
    /* the same job twice on the board (its scheduling task and itself): the same name — two jobs at one address
       (a separate flooring scope) stay two */
    const same = out.find((x) => norm(x.name) === norm(j.name))
    if (same) { if (RANK[j.place] > RANK[same.place]) Object.assign(same, { ...j, key: same.key }); return }
    out.push(j)
  })
  const have = o.have || []
  out.forEach((j) => { j.dup = have.find((h) => sameJob(h.name, j.name) || (!!j.address && sameJob(h.address, j.address)))?.id })
  return { jobs: out, board, finished, columns: C.name >= 0 }
}

/* ---------------- bringing them in ---------------- */
const asanaLink = (task?: string) => (task ? `https://app.asana.com/0/0/${task}/f` : '')
/** a person on the team by their whole name, or their first name when only one has it */
function personOf(name?: string): PersonKey | undefined {
  if (!name) return undefined
  const team = useStore.getState().team.filter((m) => m.status !== 'off' && m.role !== 'crew' && m.role !== 'client')
  const full = norm(name)
  const hit = team.find((m) => norm([m.first, m.last].filter(Boolean).join(' ')) === full)
  if (hit) return hit.key
  const first = full.split(' ')[0]
  const firsts = team.filter((m) => norm(m.first || '').split(' ')[0] === first)
  return firsts.length === 1 ? firsts[0].key : undefined
}
/** what came before is checked off for a project that's further along — only what's left lands on people's lists */
const OPEN_AT: Partial<Record<Place, string[]>> = {
  ready: ['installer', 'walk', 'confirmed', 'materials', 'matin'],
  installing: [], touchups: [],
}
export function bringList(jobs: ListJob[], board: string) {
  const s = useStore.getState()
  const me = meOf(s.role)
  const won = jobs.filter((j) => RANK[j.place] >= RANK.won && j.place !== 'done')
  s.commit((st) => {
    const clients = new Map<string, string>()
    const clientIdOf = (name: string, i: number) => {
      const nm = name.trim() || 'Client to confirm'
      const k = norm(nm)
      if (clients.has(k)) return { id: clients.get(k)!, name: nm }
      const had = Object.values(CUSTOMERS).find((c) => norm(c.name) === k) || Object.values(st.clients).find((c) => norm(c.name) === k)
      const id = had?.id || 'c' + Date.now().toString(36) + i
      if (!had) st.clients[id] = { id, name: nm, kind: /private|homeowner|owner/i.test(nm) ? 'Homeowner' : 'General contractor', address: '', phone: '', email: '', notes: board ? `From Asana (${board})` : 'From Asana', contacts: [] } as Customer
      clients.set(k, id)
      return { id, name: nm }
    }
    let estN = Math.max(1000, ...st.estimates.map((e) => Number(e.id.slice(2)) || 0))
    jobs.forEach((j, i) => {
      if (j.place === 'done' || j.place === 'lost') return
      const c = clientIdOf(j.client, i)
      const link = asanaLink(j.task)
      const asanaWords = [j.status && `Status: ${j.status}`, j.action && `Step: ${j.action}`, j.sales && `Sales: ${j.sales}`, j.estimator && `Estimator: ${j.estimator}`, j.site && `Site manager: ${j.site}`, j.crew && `Crew: ${j.crew}`].filter(Boolean).join(' · ')
      if (RANK[j.place] < RANK.won) {
        /* still being priced: on Estimates */
        const id = 'r' + Date.now().toString(36) + i
        const est = personOf(j.estimator) || null
        const stage: Stage = j.place === 'request' ? 'request' : j.place === 'estimating' ? 'estimating' : j.priceOut ? 'followup' : 'proposal'
        const day = j.due ? labelFromIso(j.due) : ''
        st.jobs[id] = {
          id, name: j.name, client: c.name, clientId: c.id, address: j.address || 'Address to confirm', stage, status: 'info',
          headline: j.place === 'request' ? 'New submission' : j.place === 'estimating' ? 'Estimating' : j.priceOut ? 'Price-out — following the project' : 'Waiting for the client’s OK',
          issues: [], next: { text: j.place === 'pending' ? 'Follow up with the client' : 'Price it', owner: est || 'office', due: day || undefined },
          keyDate: { label: j.place === 'pending' ? 'Follow up' : 'Bid due', value: day || 'TBD' }, swatch: 'blueprint', building: 'midrise', estimator: est,
          ...(j.total ? { contract: j.total } : {}),
        }
        st.pricing[id] = { docs: [], estimator: est, due: day, scope: '', contact: c.name, revs: [], fu: [] }
        const estId = 'E-' + ++estN
        st.estimates.unshift({
          id: estId, jobId: id, status: j.place === 'request' ? 'request' : j.place === 'estimating' ? 'estimating' : 'sent', estimator: est,
          ...(day ? (j.place === 'pending' ? { followUp: day } : { due: day }) : {}),
          revs: [{ n: 1, date: NOW, status: j.place === 'pending' ? 'sent' : 'draft', ...(j.place === 'pending' ? { sentOn: NOW } : {}), what: 'Original scope', lines: [] }],
          log: [{ date: NOW, who: me, text: `Brought in from Asana${board ? ` (${board})` : ''}` }],
        })
        addHist(st, id, { who: me, kind: 'pricing', title: `Brought in from Asana · ${estId}`, detail: [asanaWords, link].filter(Boolean).join(' — ') || undefined, ref: { t: 'estimate', id: estId } })
        if (j.notes) addHist(st, id, { who: me, kind: 'pricing', title: 'Notes from Asana', detail: j.notes.replace(/\s+/g, ' ').slice(0, 600) })
        return
      }
      /* won: on Projects, where it stands */
      const id = 'p' + Date.now().toString(36) + i
      const stage: Stage = j.place === 'installing' ? 'installation' : j.place === 'touchups' ? 'punch' : 'setup'
      const crew = j.crewKey && (j.place === 'installing' || j.place === 'touchups' || j.place === 'ready') ? j.crewKey : undefined
      const job: Job = {
        id, name: j.name, client: c.name, clientId: c.id, address: j.address || 'Address to confirm', stage, kind: 'install', status: 'info',
        headline: PLACES.find((p) => p.key === j.place)!.label, issues: [], pm: 'ys', site: personOf(j.site) || 'yakov',
        next: j.place === 'won' ? { text: 'Get the tile paperwork', owner: 'estimator', due: 'This week' } : j.place === 'ready' ? { text: 'Send the installer his PO', owner: 'ys', due: 'Today' } : { text: j.place === 'touchups' ? 'Finish the touch-ups' : 'Keep the daily updates going', owner: 'yakov' },
        keyDate: { label: 'Brought in', value: NOW }, swatch: 'bianco', building: 'house', stageDates: { won: NOW },
        ...(j.total ? { contract: j.total } : {}),
        ...(stage === 'installation' ? { pct: 0 } : {}),
        ...(crew ? { crew } : {}),
        ...(stage !== 'setup' && (j.start || j.finish) ? { dates: { ...(j.start ? { start: labelFromIso(j.start) } : {}), ...(j.finish ? { finish: labelFromIso(j.finish) } : {}) } } : {}),
      }
      st.jobs[id] = job
      st.rooms[id] = []
      st.prep[id] = { ...(stage === 'setup' && j.start ? { targetISO: j.start, target: labelFromIso(j.start) } : { target: 'TBD' }), meeting: { text: 'TBD' }, installer: crew || 'tbd', confirmed: crew ? 'yes' : 'no', paperwork: 'no', po: 'no', material: 'no', deposit: 'na' } as any
      const open = OPEN_AT[j.place]
      if (open) {
        const recs = (st.stepRecs[id] ||= {})
        companySteps(st).forEach((d) => {
          if (open.includes(d.key)) return
          recs[d.key] = d.key === 'sheets' && j.place === 'ready' ? { na: true } : { done: NOW, by: me, note: 'Done before Tile OS' }
        })
      }
      addHist(st, id, { who: me, kind: 'setup', title: 'Brought in from Asana', detail: [asanaWords, j.total ? `Total ${fmtMoney(j.total)}` : '', link].filter(Boolean).join(' — ') || undefined })
      if (j.notes) addHist(st, id, { who: me, kind: 'setup', title: 'Notes from Asana', detail: j.notes.replace(/\s+/g, ' ').slice(0, 600) })
    })
  }, `${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} brought in from Asana`, { sub: `${won.length} on Projects · ${jobs.length - won.length} on Estimates. Add each one’s estimate and tile paperwork when you get to it.` })
}
