/* The estimate's path inside the company: Takeoff → Office review → Final review → the client.
 * Handing it on gives the next person a task on their Today and closes yours. Nobody's ownership changes —
 * the estimate knows whose turn it is. Review notes are pinned to a room or line and go back as a checklist. */
import { useStore, addHist, newTask, closeTasks, meOf, NOW, type Store } from '@/tileos/store'
import { keepFiles } from '@/tileos/lib/files'
import { PEOPLE, fmtMoney, PRICING_STAGES, type PersonKey, type Role } from '@/tileos/data/model'
import { curRev, revTotal, teamOf, openNotes, bucketOf, EST_STEP, EST_TEAM0, type Estimate, type EstStep, type EstLine, type EstNote, type EstTeam } from '@/tileos/data/estimates'
import { AREA_PRESETS, SURFACES, customSurface, uniqueArea, sortAreas, type AreaPreset, type SurfaceDef } from '@/tileos/data/areas'
import { QB_SURFACE_ITEMS } from '@/tileos/data/qbitems'
import { estSend, newLine } from './flows2'
import { isoFromLabel, md } from '@/tileos/lib/today'

const S = () => useStore.getState()
const me = () => meOf(S().role)
type D = Parameters<Parameters<ReturnType<typeof S>['commit']>[0]>[0]

const ROLE_OF: Partial<Record<PersonKey, Role>> = { ys: 'owner', takeoff: 'takeoff', estimator: 'estimator', office: 'office' }
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** put the estimate on a step: the right person gets a task, the last step's task closes */
export function giveTo(s: D, e: Estimate, step: EstStep, o: { notes?: number } = {}) {
  const who = teamOf(e)[step]
  const j = s.jobs[e.jobId]
  const rev = curRev(e)
  e.step = step
  e.since = NOW
  closeTasks(s, s.tasks.filter((t) => t.action?.kind === 'estimate:' + e.id && t.state !== 'done').map((t) => t.id), 'Handed on')
  /* the same shape every time: what to do, then the revision — the project is on the line already */
  const revWord = rev.n > 1 ? ` · Revision ${rev.n}` : ''
  const title =
    step === 'takeoff' ? (o.notes ? `Fix ${plural(o.notes, 'note')} on the takeoff${revWord}` : `Do the takeoff${revWord}`)
    : step === 'review' ? `Review the takeoff${revWord}`
    : `Final review${revWord}`
  newTask(s, {
    jobId: e.jobId,
    title,
    type: 'Pricing',
    owner: who,
    /* the person's own login type — whoever the admin put on this step */
    for: [s.team.find((m: any) => m.key === who)?.role || ROLE_OF[who] || 'office'],
    watch: step === 'final' ? [] : ['owner'],
    state: 'now',
    /* it's theirs the moment it lands — on their Today right now, every step (the bid's own due date is on the estimate) */
    due: 'Today',
    dueTone: step === 'final' ? 'warn' : 'neutral',
    tone: o.notes ? 'warn' : 'info',
    where: step === 'takeoff' ? (o.notes ? 'Sent back with notes' : 'From the plans') : step === 'review' ? `Ready from ${PEOPLE[teamOf(e).takeoff].short}` : `Office review done · ${fmtMoney(revTotal(rev))}`,
    action: { label: step === 'takeoff' ? 'Open estimate' : 'Review', kind: 'estimate:' + e.id },
  })
  if (j) {
    j.next = { text: step === 'takeoff' ? (o.notes ? `Fix ${plural(o.notes, 'review note')}` : 'Finish the takeoff') : EST_STEP[step].label, owner: who, due: 'Today' }
    j.headline = step === 'takeoff' ? (o.notes ? `Back with ${PEOPLE[who].short} · ${plural(o.notes, 'note')}` : `Takeoff · ${PEOPLE[who].short}`) : step === 'review' ? 'Takeoff done · with the office for review' : 'Office review done · owner review'
  }
}

/** move the bid's due date — the estimate, its project and the list all follow */
export function setEstimateDue(estId: string, label: string) {
  const iso = isoFromLabel(label)
  const due = iso ? md(iso) : label
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e || e.due === due) return
    e.log.push({ date: NOW, who: me(), text: `Due ${e.due ? `${e.due} → ` : ''}${due}` })
    e.due = due
    const j = s.jobs[e.jobId]
    if (j) j.keyDate = { label: 'Bid due', value: due }
    const p = s.pricing[e.jobId]
    if (p) p.due = due
  }, `Due ${due}`)
}

export function estStartTakeoff(estId: string, who: PersonKey = 'takeoff') {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    e.status = 'estimating'
    e.estimator = who
    e.team = { ...(e.team || {}), takeoff: who }
    e.log.push({ date: NOW, who: me(), text: `Takeoff started · ${PEOPLE[who].name}` })
    const j = s.jobs[e.jobId]
    if (j && PRICING_STAGES.includes(j.stage)) j.stage = 'estimating'
    giveTo(s, e, 'takeoff')
    addHist(s, e.jobId, { who: me(), kind: 'pricing', title: `Takeoff started · ${PEOPLE[who].name}`, ref: { t: 'estimate', id: e.id } })
  }, `The takeoff is with ${PEOPLE[who].name}`, { close: true, sub: 'It’s on their Today. It comes back for review when they’re done.', flow: [{ who: meOf(S().role), label: 'Request', state: 'done' }, { who, label: 'Takeoff', state: 'now' }, { who: 'estimator', label: 'Office review', state: 'next' }, { who: 'ys', label: 'Final review', state: 'next' }, { label: 'Client', state: 'next' }] })
}

/** "Ready for review" / "Looks good" / "Approve and send" — whatever this step's yes is */
export function estHandOff(estId: string) {
  const e0 = S().estimates.find((x) => x.id === estId)
  if (!e0) return
  const step = e0.step || 'takeoff'
  if (step === 'final') {
    S().commit((s) => {
      const e = s.estimates.find((x) => x.id === estId)!
      e.log.push({ date: NOW, who: me(), text: 'Final review done — approved to send' })
      e.step = undefined
      e.backTo = undefined
    })
    return estSend(estId)
  }
  const next: EstStep = step === 'takeoff' ? e0.backTo || 'review' : 'final'
  const team = teamOf(e0)
  const fixed = (e0.notes || []).filter((n) => n.rev === curRev(e0).n && n.done).length
  S().commit(
    (s) => {
      const e = s.estimates.find((x) => x.id === estId)!
      e.backTo = undefined
      e.log.push({ date: NOW, who: me(), text: step === 'takeoff' ? `${e0.backTo && fixed ? `Fixed ${plural(fixed, 'note')} — ` : ''}Ready for review — to ${PEOPLE[team[next]].short}` : `Office review done — to ${PEOPLE[team.final].short}` })
      giveTo(s, e, next)
      addHist(s, e.jobId, { who: me(), kind: 'pricing', title: step === 'takeoff' ? `Takeoff ready for review · ${e.id}` : `Office review done · ${e.id}`, detail: `${fmtMoney(revTotal(curRev(e)))} · now with ${PEOPLE[team[next]].name}`, ref: { t: 'estimate', id: e.id } })
    },
    step === 'takeoff' ? `Sent to ${PEOPLE[team[next]].name} for ${next === 'final' ? 'final' : 'office'} review` : `Sent to ${PEOPLE[team.final].name} for the final review`,
    {
      close: true,
      sub: `It’s on ${PEOPLE[team[next]].short === PEOPLE[meOf(S().role)].short ? 'your' : `${PEOPLE[team[next]].short}’s`} Today.`,
      flow: (['takeoff', 'review', 'final'] as EstStep[]).map((k) => ({ who: team[k], label: k === 'takeoff' ? 'Takeoff' : k === 'review' ? 'Office review' : 'Final review', state: (k === next ? 'now' : ['takeoff', 'review', 'final'].indexOf(k) < ['takeoff', 'review', 'final'].indexOf(next) ? 'done' : 'next') as 'done' | 'now' | 'next' })).concat([{ who: undefined as any, label: 'Client', state: 'next' as const }]),
    },
  )
}

export function estSendBack(estId: string) {
  const e0 = S().estimates.find((x) => x.id === estId)
  if (!e0) return
  const step = e0.step
  if (step !== 'review' && step !== 'final') return
  const n = openNotes(e0).length
  const team = teamOf(e0)
  S().commit(
    (s) => {
      const e = s.estimates.find((x) => x.id === estId)!
      e.backTo = step
      e.log.push({ date: NOW, who: me(), text: `Sent back to ${PEOPLE[team.takeoff].short} · ${plural(n, 'note')}` })
      giveTo(s, e, 'takeoff', { notes: n })
      addHist(s, e.jobId, { who: me(), kind: 'pricing', title: `Sent back to ${PEOPLE[team.takeoff].short} · ${plural(n, 'note')}`, detail: openNotes(e).map((x) => x.text).join(' · '), ref: { t: 'estimate', id: e.id } })
    },
    `Sent back to ${PEOPLE[team.takeoff].name} with ${plural(n, 'note')}`,
    { close: true, sub: 'When the notes are checked off it comes straight back to you.', flow: [{ who: team.takeoff, label: 'Fixes the notes', state: 'now' }, { who: team[step], label: 'Back to you', state: 'next' }] },
  )
}

export function estAddNote(estId: string, o: { area?: string; lineId?: string; text: string }) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    ;(e.notes ||= []).push({ id: 'nt' + Date.now().toString(36), rev: curRev(e).n, by: me(), step: e.step || 'review', area: o.area, lineId: o.lineId, text: o.text, date: NOW })
  }, 'Note added')
}
export function estToggleNote(estId: string, noteId: string) {
  S().commit((s) => {
    const n = s.estimates.find((x) => x.id === estId)?.notes?.find((x) => x.id === noteId)
    if (n) n.done = !n.done
  })
}
export function estRemoveNote(estId: string, noteId: string) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (e?.notes) e.notes = e.notes.filter((x) => x.id !== noteId)
  })
}

/* ================= AI: a first draft from the plans ================= */
export interface AiRow { room: string; surface: string; tile?: string; qty: number; unit: 'SF' | 'LF' | 'EA'; itemId: string; sheet: string; flag?: string; option?: boolean }
export interface AiDraft { sheets: string[]; found: string[]; rows: AiRow[]; extra: { area: string; itemId: string; qty: number; desc?: string }[]; general?: string[] }
export const AI_DRAFTS: Record<string, AiDraft> = {
  b2: {
    sheets: ['Plans · 14 sheets', 'Finish schedule', 'Spec book · 09 30 00 Tiling'],
    found: ['A-101 Lobby plan · A-102 Elevator lobby · A-401 Interior elevations', 'T-03 porcelain 24×48 floors · T-05 porcelain 12×24 elevator walls', 'Large-format setting · crack isolation under all floor tile'],
    rows: [
      { room: 'Lobby', surface: 'Floor', tile: 'T-03', qty: 1180, unit: 'SF', itemId: 'i-large', sheet: 'A-101' },
      { room: 'Lobby', surface: 'Base · 4″ cut tile', tile: 'T-03', qty: 70, unit: 'SF', itemId: 'i-wall', sheet: 'A-101' },
      { room: 'Vestibule', surface: 'Floor', tile: 'T-03', qty: 96, unit: 'SF', itemId: 'i-large', sheet: 'A-101', flag: 'Walk-off mat recess isn’t dimensioned — left out 4′ × 6′' },
      { room: 'Elevator lobby', surface: 'Floor', tile: 'T-03', qty: 140, unit: 'SF', itemId: 'i-large', sheet: 'A-102' },
      { room: 'Elevator lobby', surface: 'Elevator walls', tile: 'T-05', qty: 360, unit: 'SF', itemId: 'i-wall', sheet: 'A-401', flag: 'Wall height isn’t on A-401 — used 9′-0″ from the ceiling plan' },
      { room: 'Mail room', surface: 'Floor', tile: 'T-03', qty: 64, unit: 'SF', itemId: 'i-large', sheet: 'A-101', flag: 'On the plans but not in the request — priced as an option', option: true },
    ],
    extra: [
      { area: 'All floors', itemId: 'i-wp', qty: 1480, desc: 'Crack isolation membrane — all floor tile (spec 09 30 00)' },
      { area: 'All floors', itemId: 'i-edge', qty: 40 },
      { area: 'General', itemId: 'o-mob', qty: 1 },
    ],
  },
  b4: {
    sheets: ['Plans · 9 sheets', 'Spec book'],
    found: ['A-201 Second floor · A-101 First floor · A-501 Bath elevations', 'No finish schedule yet — tile left open', 'Showers waterproofed with a membrane · tubs with board'],
    rows: [
      { room: 'Primary bath', surface: 'Floor', qty: 72, unit: 'SF', itemId: 'i-floor', sheet: 'A-201' },
      { room: 'Primary bath', surface: 'Shower walls', qty: 168, unit: 'SF', itemId: 'i-wall', sheet: 'A-501', flag: 'Glass height not shown — walls tiled to 7′-6″' },
      { room: 'Primary bath', surface: 'Shower floor', qty: 18, unit: 'SF', itemId: 'i-mosaic', sheet: 'A-201' },
      { room: 'Primary bath', surface: 'Waterproofing', qty: 186, unit: 'SF', itemId: 'i-wp', sheet: 'A-501' },
      { room: 'Hall bath 1', surface: 'Floor', qty: 45, unit: 'SF', itemId: 'i-floor', sheet: 'A-201' },
      { room: 'Hall bath 1', surface: 'Tub walls', qty: 96, unit: 'SF', itemId: 'i-wall', sheet: 'A-501' },
      { room: 'Hall bath 2', surface: 'Floor', qty: 42, unit: 'SF', itemId: 'i-floor', sheet: 'A-201' },
      { room: 'Hall bath 2', surface: 'Tub walls', qty: 96, unit: 'SF', itemId: 'i-wall', sheet: 'A-501' },
      { room: 'Mudroom', surface: 'Floor', qty: 88, unit: 'SF', itemId: 'i-floor', sheet: 'A-101' },
    ],
    extra: [{ area: 'All rooms', itemId: 'i-edge', qty: 36 }, { area: 'General', itemId: 'o-mob', qty: 1 }],
    general: ['No finish schedule yet — every tile is open; rates assume standard porcelain'],
  },
}
/** any other request: a first draft read from what we know about it — the scope and the documents in */
function genericDraft(jobId: string): AiDraft | undefined {
  const s = S()
  const j = s.jobs[jobId]
  const p = s.pricing[jobId]
  if (!j || !p || !p.docs.some((d) => d.name === 'Plans' && d.status === 'in')) return undefined
  /* the made-up draft is for the sample only — on a real test nothing invents square feet */
  if (!s.items.some((i) => i.id === 'i-floor')) return undefined
  const scope = `${j.scope || ''} ${p.scope || ''}`.toLowerCase()
  const word: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 }
  const m = scope.match(/(\d+|one|two|three|four|five|six)\s+(?:\w+\s)?bath/)
  const baths = m ? Number(word[m[1]] || m[1]) : /bath/.test(scope) ? 1 : 0
  const fs = p.docs.find((d) => d.name === 'Finish schedule')?.status === 'in'
  const rows: AiRow[] = []
  for (let i = 0; i < Math.min(baths, 6); i++) {
    const primary = i === 0 && (baths > 1 || /primary|master/.test(scope))
    const room = primary ? 'Primary bath' : baths > 1 ? `Bath ${i + 1}` : 'Bath'
    rows.push({ room, surface: 'Floor', qty: primary ? 68 : 45, unit: 'SF', itemId: 'i-floor', sheet: 'A-201', tile: fs ? 'T-05' : undefined })
    rows.push({ room, surface: primary ? 'Shower walls' : 'Tub walls', qty: primary ? 160 : 96, unit: 'SF', itemId: 'i-wall', sheet: 'A-501', tile: fs ? 'T-04' : undefined, flag: i === 0 ? 'Wall height not on the elevations — tiled to 7′-6″' : undefined })
    if (primary) rows.push({ room, surface: 'Shower floor', qty: 16, unit: 'SF', itemId: 'i-mosaic', sheet: 'A-201', tile: fs ? 'T-02' : undefined })
    rows.push({ room, surface: 'Waterproofing', qty: primary ? 176 : 96, unit: 'SF', itemId: 'i-wp', sheet: 'A-501' })
  }
  if (/kitchen|backsplash/.test(scope)) rows.push({ room: 'Kitchen', surface: 'Backsplash', qty: 32, unit: 'SF', itemId: 'i-splash', sheet: 'A-401', tile: fs ? 'T-04' : undefined })
  if (/lobby/.test(scope)) rows.push({ room: 'Lobby', surface: 'Floor', qty: 1100, unit: 'SF', itemId: /24|48|large/.test(scope) ? 'i-large' : 'i-floor', sheet: 'A-101', tile: fs ? 'T-03' : undefined })
  if (/elevator/.test(scope)) rows.push({ room: 'Elevator lobby', surface: 'Walls', qty: 320, unit: 'SF', itemId: 'i-wall', sheet: 'A-401', tile: fs ? 'T-05' : undefined })
  if (/mudroom|laundry|foyer|entry/.test(scope)) rows.push({ room: /mudroom/.test(scope) ? 'Mudroom' : /laundry/.test(scope) ? 'Laundry' : 'Foyer', surface: 'Floor', qty: 64, unit: 'SF', itemId: 'i-floor', sheet: 'A-101', tile: fs ? 'T-01' : undefined })
  if (!rows.length) rows.push({ room: 'Main area', surface: 'Floor', qty: 400, unit: 'SF', itemId: 'i-floor', sheet: 'A-101', flag: 'Scope wasn’t clear from the request — measured the largest tiled area' })
  return {
    sheets: ['Plans', ...(fs ? ['Finish schedule'] : []), ...(p.docs.find((d) => d.name === 'Spec book')?.status === 'in' ? ['Spec book'] : [])],
    found: [`${new Set(rows.map((r) => r.room)).size} tiled rooms on the plans`, fs ? 'Tile tags matched from the finish schedule' : 'No finish schedule yet — tile left open', 'Waterproofing at every shower and tub'],
    rows,
    extra: [{ area: 'All rooms', itemId: 'i-edge', qty: Math.max(24, rows.length * 6) }, { area: 'General', itemId: 'o-mob', qty: 1 }],
    general: fs ? undefined : ['No finish schedule yet — every tile is open; rates assume standard porcelain'],
  }
}
export const aiDraftFor = (jobId: string) => AI_DRAFTS[jobId] || genericDraft(jobId)
/** the plans came in by upload: mark them in, so the draft can read them */
/** one of the estimate's documents came in as a file: keep it with the project, tick it off, close the ask to the GC */
export async function docUploaded(jobId: string, doc: string, list: File[]) {
  if (!list.length) return
  const kept = await keepFiles(jobId, list, 'plans', { quiet: true, doc })
  if (!kept.recs.length) return
  const name = kept.recs[0].name
  S().commit((s) => {
    const p = s.pricing[jobId]
    if (p) {
      const d = p.docs.find((x) => x.name === doc)
      if (d) { d.status = 'in'; d.note = `${name} · ${NOW}` }
      else p.docs.push({ name: doc, status: 'in', note: name })
    }
    const j = s.jobs[jobId]
    if (j?.issues) j.issues = j.issues.filter((x) => x.text !== `${doc} missing`)
    s.tasks.forEach((t) => { if (t.jobId === jobId && t.state !== 'done' && t.title === `${doc} from the GC`) { t.state = 'done'; t.doneAt = NOW } })
    addHist(s, jobId, { who: me(), kind: 'pricing', title: `${doc} added · ${name}` })
  }, kept.problem ? undefined : `${doc} added`)
  return kept
}

export function plansUploaded(jobId: string, file: string) {
  S().commit((s) => {
    const p = s.pricing[jobId]
    if (!p) return
    const d = p.docs.find((x) => x.name === 'Plans')
    if (d) { d.status = 'in'; d.note = file }
    else p.docs.unshift({ name: 'Plans', status: 'in', note: file })
    s.tasks.forEach((t) => { if (t.jobId === jobId && t.state === 'waiting' && /^Plans from/.test(t.title)) { t.state = 'done'; t.doneAt = NOW } })
    addHist(s, jobId, { who: me(), kind: 'pricing', title: `Plans uploaded · ${file}` })
  }, `${file} uploaded`)
}

export function applyAiDraft(estId: string) {
  const s0 = S()
  const e0 = s0.estimates.find((x) => x.id === estId)
  if (!e0) return
  const d = aiDraftFor(e0.jobId)
  if (!d) return
  let lid = Date.now() % 100000
  const price = (id: string) => s0.items.find((i) => i.id === id)?.price || 0
  const lines: EstLine[] = [
    ...d.rows.map((r) => ({ id: 'ai' + ++lid, area: r.option ? `${r.room} (option)` : r.room, itemId: r.itemId, qty: r.qty, rate: price(r.itemId), surface: r.surface, tile: r.tile })),
    ...d.extra.map((x) => ({ id: 'ai' + ++lid, area: x.area, itemId: x.itemId, qty: x.qty, rate: price(x.itemId), desc: x.desc })),
  ]
  const flags = d.rows.filter((r) => r.flag)
  S().commit(
    (s) => {
      const e = s.estimates.find((x) => x.id === estId)!
      curRev(e).lines = lines
      const notes: EstNote[] = [
        ...flags.map((r, i) => ({ id: `ai-${e.id}-${i}`, rev: curRev(e).n, by: 'system' as PersonKey, step: 'ai' as const, area: r.option ? `${r.room} (option)` : r.room, text: r.flag!, date: NOW })),
        ...(d.general || []).map((t, i) => ({ id: `ai-${e.id}-g${i}`, rev: curRev(e).n, by: 'system' as PersonKey, step: 'ai' as const, text: t, date: NOW })),
      ]
      e.notes = [...(e.notes || []).filter((n) => n.step !== 'ai'), ...notes]
      e.log.push({ date: NOW, who: 'system', text: `Draft made from the plans — ${new Set(d.rows.map((r) => r.room)).size} rooms, ${d.rows.length} surfaces, ${plural(notes.length, 'thing')} to check` })
      if (e.status === 'request') {
        e.status = 'estimating'
        const who = e.team?.takeoff || 'takeoff'
        e.estimator = who
        e.team = { ...(e.team || {}), takeoff: who }
        const j = s.jobs[e.jobId]
        if (j && PRICING_STAGES.includes(j.stage)) j.stage = 'estimating'
        giveTo(s, e, 'takeoff')
      }
      addHist(s, e.jobId, { who: 'system', kind: 'pricing', title: `Draft takeoff from the plans · ${e.id}`, detail: `${lines.length} lines · ${plural(notes.length, 'thing')} to check`, ref: { t: 'estimate', id: e.id } })
    },
    `Draft added — ${lines.length} lines from the plans · ${plural(flags.length + (d.general?.length || 0), 'thing')} to check`,
  )
}

/* ================= who does what, by default and per estimate ================= */
export const TEAM_LABEL: Record<keyof EstTeam, string> = { takeoff: 'Takeoff', review: 'Office review', final: 'Final review', follow: 'Follows up' }
export const TEAM_KEYS: (keyof EstTeam)[] = ['takeoff', 'review', 'final', 'follow']
/** who can be put on an estimate step */
export const EST_PEOPLE: PersonKey[] = ['takeoff', 'estimator', 'ys', 'office']
export const companyTeam = (s: { rules: Store['rules'] }): EstTeam => ({ ...EST_TEAM0, ...(s.rules.estTeam || {}) })
export const companyAreas = (s: { rules: Store['rules'] }): AreaPreset[] => (s.rules.areas?.length ? s.rules.areas : AREA_PRESETS)
/** the surfaces, each with the item it brings: the company's own pick (Settings, or the QuickBooks import) wins */
export const companySurfaces = (s: { rules: Store['rules'] }): SurfaceDef[] => {
  const pick = s.rules.surfaceItems || {}
  return [...SURFACES, ...(s.rules.surfaces || [])].map((x) => (pick[x.key] ? { ...x, itemId: pick[x.key] } : x))
}
export const surfaceOf = (s: { rules: Store['rules'] }, key: string): SurfaceDef => companySurfaces(s).find((x) => x.key === key || x.label.toLowerCase() === key.toLowerCase()) || customSurface(key)
const STEP_ROLE: Partial<Record<PersonKey, Role>> = { ys: 'owner', takeoff: 'takeoff', estimator: 'estimator', office: 'office' }

/** one line per surface — square feet left for the takeoff, each-items (a niche, a saddle) start at 1 */
export function linesForArea(s: Pick<Store, 'rules' | 'items'>, area: string, keys: string[]): EstLine[] {
  return keys.map((k) => {
    const d = surfaceOf(s, k)
    /* a surface added since the company's pick was saved (risers): its QuickBooks item, when that's on the list */
    const it = s.items.find((i) => i.id === d.itemId) || s.items.find((i) => i.id === QB_SURFACE_ITEMS[k])
    const each = it?.unit === 'EA' || it?.unit === 'LS'
    /* an item that isn't on the list any more: the line stays, priced at $0 for the estimator */
    return newLine(area, it?.id || d.itemId, each ? 1 : 0, it?.price || 0, d.label)
  })
}

export interface NewEstimate { name: string; address: string; clientId: string; client: string; due: string; scope: string; docs: string[]; team: EstTeam; areas: { name: string; floor?: string; surfaces: string[] }[]; files?: File[]
  /** priced on a project we already have — the same job, not a new one */
  onJob?: string }
/** a new estimate goes straight to whoever does the takeoff — no waiting for someone to assign it */
export function newEstimate(d: NewEstimate) {
  const s0 = S()
  const on = d.onJob && s0.jobs[d.onJob] ? s0.jobs[d.onJob] : undefined
  const id = on ? on.id : 'r' + Date.now().toString(36)
  const estId = 'E-' + (1 + Math.max(1000, ...s0.estimates.map((e) => Number(e.id.slice(2)) || 0)))
  const missing = ['Plans', 'Spec book', 'Finish schedule'].filter((x) => !d.docs.includes(x))
  const t = d.team
  /* a client typed for the first time becomes a real client, so Clients and the filters know them */
  const clientId = on ? on.clientId : d.clientId === 'new' || !d.clientId ? 'c' + Date.now().toString(36) : d.clientId
  s0.commit(
    (s) => {
      if (!on && !s.clients[clientId]) s.clients[clientId] = { id: clientId, name: d.client, kind: 'General contractor', address: d.address || '', phone: '', email: '', notes: '', contacts: [] }
      if (!on) s.jobs[id] = {
        id, name: d.name, client: d.client, clientId, address: d.address || 'Address to confirm', stage: 'estimating',
        status: missing.length ? 'warn' : 'info', headline: `Takeoff · ${PEOPLE[t.takeoff].short}`,
        issues: missing.map((m) => ({ tone: 'warn' as const, text: `${m} missing` })),
        next: { text: 'Finish the takeoff', owner: t.takeoff, due: 'Today' },
        keyDate: { label: 'Bid due', value: d.due }, swatch: 'blueprint', building: 'midrise', estimator: t.takeoff, scope: d.scope,
      } as Store['jobs'][string]
      if (!on || !s.pricing[id]) s.pricing[id] = {
        docs: ['Plans', 'Spec book', 'Finish schedule'].map((n) => ({ name: n, status: d.docs.includes(n) ? 'in' : 'missing', note: d.docs.includes(n) ? 'Received today' : 'Not received' })),
        estimator: t.takeoff, due: d.due, scope: d.scope, contact: d.client, revs: [], fu: [],
      } as unknown as Store['pricing'][string]
      missing.forEach((m) => newTask(s, { jobId: id, title: `${m} from the GC`, type: 'Pricing', owner: 'office', for: ['office'], state: 'waiting', waitingOn: 'GC', followUp: 'Thu', tone: 'warn', where: 'Documents' }))
      d.areas = sortAreas(d.areas, companyAreas(s).map((x) => x.name))
      const lines = d.areas.flatMap((a) => linesForArea(s, a.name, a.surfaces))
      s.estimates.unshift({
        id: estId, jobId: id, status: 'estimating', estimator: t.takeoff, due: d.due, team: { ...t },
        revs: [{ n: 1, date: NOW, status: 'draft', what: 'Original scope', lines, areas: d.areas.map((a) => ({ name: a.name, floor: a.floor })) }],
        log: [{ date: NOW, who: me(), text: `Estimate started${d.areas.length ? ` · ${plural(d.areas.length, 'area')}` : ''}${missing.length ? ` · ${missing.join(' and ')} missing` : ''}` }],
      })
      giveTo(s, s.estimates[0], 'takeoff')
      addHist(s, id, { who: me(), kind: 'pricing', title: `Estimate ${estId} started · takeoff to ${PEOPLE[t.takeoff].name}`, ref: { t: 'estimate', id: estId } })
    },
    `${estId} is with ${PEOPLE[t.takeoff].name} for the takeoff`,
    {
      close: true,
      sub: `It’s on ${PEOPLE[t.takeoff].short}’s Today${missing.length ? ` — the office asks the GC for the ${missing.join(' and ').toLowerCase()}` : ''}. Each step hands it to the next person.`,
      flow: [{ who: me(), label: 'Started', state: 'done' }, { who: t.takeoff, label: 'Takeoff', state: 'now' }, { who: t.review, label: 'Office review', state: 'next' }, { who: t.final, label: 'Final review', state: 'next' }, { who: t.follow, label: 'Follows up', state: 'next' }],
    },
  )
  /* the plans go onto the project, so the takeoff starts from them */
  if (d.files?.length) void keepFiles(id, d.files, 'plans', { quiet: true, doc: 'Plans' })
  S().closeAll()
  /* whoever does the takeoff lands in it; anyone else just sends it on — it's on the takeoff person's Today */
  if (t.takeoff === me()) setTimeout(() => S().open({ t: 'estimate', id: estId }), 60)
  return { jobId: id, estId }
}

/** put someone else on a step; if the estimate is on that step right now, it moves to them with its task */
export function setEstTeam(estId: string, key: keyof EstTeam, who: PersonKey) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    const was = teamOf(e)[key]
    if (was === who) return
    e.team = { ...teamOf(e), [key]: who }
    if (key === 'takeoff') e.estimator = who
    const b = bucketOf(e)
    const j = s.jobs[e.jobId]
    const moveIt = b === key || (key === 'follow' && b === 'sent')
    if (moveIt) {
      s.tasks.forEach((t) => {
        const mine = key === 'follow' ? t.jobId === e.jobId && t.type === 'Pricing' && t.state !== 'done' && /^Follow up on/.test(t.title) : t.action?.kind === 'estimate:' + e.id && t.state !== 'done'
        if (!mine) return
        t.owner = who
        t.for = [STEP_ROLE[who] || 'office']
        t.log.push({ date: NOW, who: me(), text: `Handed from ${PEOPLE[was].short} to ${PEOPLE[who].short}` })
      })
      if (j?.next) j.next.owner = who
      if (key !== 'follow') e.since = NOW
    }
    e.log.push({ date: NOW, who: me(), text: `${TEAM_LABEL[key]}: ${PEOPLE[who].name} (was ${PEOPLE[was].short})` })
  }, `${TEAM_LABEL[key]} — ${PEOPLE[who].name}`, { sub: bucketOf(S().estimates.find((x) => x.id === estId)!) === key ? `It moved to ${PEOPLE[who].short}’s Today.` : undefined })
}

/* ================= areas on an estimate ================= */
const metaOf = (e: Estimate) => {
  const r = curRev(e)
  if (!r.areas) r.areas = Array.from(new Set(r.lines.map((l) => l.area))).map((name) => ({ name }))
  return r.areas
}
export function estAddArea(estId: string, name: string, keys: string[], floor?: string) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e || curRev(e).status !== 'draft') return
    const r = curRev(e)
    const meta = metaOf(e)
    const area = uniqueArea(name.trim(), Array.from(new Set([...meta.map((a) => a.name), ...r.lines.map((l) => l.area)])))
    meta.push({ name: area, floor })
    r.lines.push(...linesForArea(s, area, keys.length ? keys : ['floor']))
  }, `${name.trim()} added`)
}
export function estAddSurface(estId: string, area: string, key: string) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e || curRev(e).status !== 'draft') return
    const r = curRev(e)
    const lines = linesForArea(s, area, [key])
    const at = r.lines.map((l) => l.area).lastIndexOf(area)
    r.lines.splice(at < 0 ? r.lines.length : at + 1, 0, ...lines)
  })
}
export function estSetArea(estId: string, area: string, p: { floor?: string | null; note?: string | null }) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e) return
    const meta = metaOf(e)
    let a = meta.find((x) => x.name === area)
    if (!a) { a = { name: area }; meta.push(a) }
    if (p.floor !== undefined) a.floor = p.floor || undefined
    if (p.note !== undefined) a.note = p.note?.trim() || undefined
  })
}
export function estRemoveArea(estId: string, area: string) {
  S().commit((s) => {
    const e = s.estimates.find((x) => x.id === estId)
    if (!e || curRev(e).status !== 'draft') return
    const r = curRev(e)
    r.lines = r.lines.filter((l) => l.area !== area)
    if (r.areas) r.areas = r.areas.filter((a) => a.name !== area)
  }, `${area} removed`)
}

/* ================= the company lists (Settings) ================= */
export function setCompanyTeam(key: keyof EstTeam, who: PersonKey) {
  S().commit((s) => { s.rules.estTeam = { ...companyTeam(s), [key]: who } }, `New estimates: ${TEAM_LABEL[key].toLowerCase()} by ${PEOPLE[who].name}`)
}
export function addCompanyArea(name: string, keys: string[]) {
  S().commit((s) => {
    const list = companyAreas(s).map((a) => ({ ...a, surfaces: [...a.surfaces] }))
    if (list.some((a) => a.name.toLowerCase() === name.trim().toLowerCase())) return
    s.rules.areas = [...list, { name: name.trim(), surfaces: keys.length ? keys : ['floor'], custom: true }]
  }, `${name.trim()} added to the areas`)
}
export function removeCompanyArea(name: string) {
  S().commit((s) => { s.rules.areas = companyAreas(s).filter((a) => a.name !== name).map((a) => ({ ...a, surfaces: [...a.surfaces] })) }, `${name} removed from the areas`)
}
export function setCompanyAreaSurfaces(name: string, keys: string[]) {
  S().commit((s) => { s.rules.areas = companyAreas(s).map((a) => (a.name === name ? { ...a, surfaces: keys } : { ...a, surfaces: [...a.surfaces] })) })
}
export function addCompanySurface(label: string) {
  S().commit((s) => {
    if (companySurfaces(s).some((x) => x.label.toLowerCase() === label.trim().toLowerCase())) return
    s.rules.surfaces = [...(s.rules.surfaces || []), customSurface(label.trim())]
  }, `${label.trim()} added to the surfaces`)
}
export function removeCompanySurface(key: string) {
  S().commit((s) => { s.rules.surfaces = (s.rules.surfaces || []).filter((x) => x.key !== key) })
}

/* ---------------- the same job twice: an estimate made on its own for a project we already have ---------------- */
/** projects an estimate could belong to — the live ones, and any with a name or an address like it */
export function sameJobCandidates(s: Pick<Store, 'jobs'>, fromJobId: string, q = '') {
  const from = s.jobs[fromJobId]
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const words = (t: string) => norm(t).split(' ').filter(Boolean)
  const like = (j: { name: string; address: string }) => {
    if (!from) return 0
    const a = words(from.name), b = words(j.name)
    const nameHit = a.length && b.length && (b.join(' ').startsWith(a.join(' ')) || a.join(' ').startsWith(b.join(' ')) || a.some((w) => /\d/.test(w) && b.includes(w)))
    const addrHit = from.address && j.address && norm(from.address) && norm(j.address).startsWith(norm(from.address).split(' ').slice(0, 2).join(' '))
    return (nameHit ? 2 : 0) + (addrHit ? 1 : 0)
  }
  const nq = norm(q)
  return Object.values(s.jobs)
    .filter((j) => j.id !== fromJobId && j.kind !== 'repair' && !PRICING_STAGES.includes(j.stage) && j.stage !== ('lost' as any))
    .filter((j) => !nq || norm(`${j.name} ${j.client} ${j.address}`).includes(nq))
    .map((j) => ({ j, score: like(j) }))
    .sort((x, y) => y.score - x.score || x.j.name.localeCompare(y.j.name))
}

/** the estimate goes onto the project it's really for: its tasks, files, messages and history go with it, and the
 *  name everywhere is the project's. The project stays where it is (an estimate on a live project doesn't move it). */
export function moveEstimateTo(estId: string, toJobId: string) {
  const s0 = S()
  const e0 = s0.estimates.find((x) => x.id === estId)
  const from = e0?.jobId
  const fromJob = from ? s0.jobs[from] : undefined
  const to = s0.jobs[toJobId]
  if (!e0 || !from || !fromJob || !to || from === toJobId) return
  s0.commit((s) => {
    const arrays = ['tasks', 'money', 'pos', 'mats', 'checks', 'bookings', 'ready', 'notices', 'punch', 'ipos', 'events', 'shortages', 'files', 'estimates'] as const
    arrays.forEach((k) => ((s as any)[k] as { jobId?: string }[]).forEach((x) => { if (x.jobId === from) x.jobId = toJobId }))
    const lists = ['hist', 'diary', 'notes', 'messages', 'jobSteps', 'rooms'] as const
    lists.forEach((k) => {
      const m = (s as any)[k] as Record<string, unknown[]>
      if (!m?.[from]) return
      m[toJobId] = k === 'hist' ? [...(m[from] || []), ...(m[toJobId] || [])] : [...(m[toJobId] || []), ...(m[from] || [])]
      delete m[from]
    })
    const objs = ['tiles', 'pricing', 'prep', 'stepRecs'] as const
    objs.forEach((k) => {
      const m = (s as any)[k] as Record<string, Record<string, unknown>>
      if (!m?.[from]) return
      m[toJobId] = { ...(m[from] || {}), ...(m[toJobId] || {}) }
      delete m[from]
    })
    Object.keys(s.seen).forEach((key) => {
      const [id, who] = key.split('|')
      if (id !== from) return
      const next = `${toJobId}|${who}`
      /* what they'd read there they've read here — the joined conversation isn't all new to them */
      if (!s.seen[next]) s.seen[next] = { n: s.messages[toJobId]?.length || 0 }
      delete s.seen[key]
    })
    delete s.jobs[from]
    addHist(s, toJobId, { who: me(), kind: 'pricing', title: `Estimate ${estId} is on this project now`, detail: `It was made as “${fromJob.name}” — the same job`, ref: { t: 'estimate', id: estId } })
  }, `${estId} is on ${to.name} now`, { sub: `“${fromJob.name}” was the same job — its tasks, files and messages moved with it. It says ${to.name} everywhere.`, tone: 'done' })
}

/** a project we already have that looks like the one being typed in — the same name or number, or the same street */
export function projectLike(s: Pick<Store, 'jobs'>, name: string, address = '') {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const a = norm(name).split(' ').filter(Boolean)
  if (!a.length || norm(name).length < 3) return undefined
  const street = norm(address).split(' ').slice(0, 2).join(' ')
  return Object.values(s.jobs)
    .filter((j) => j.kind !== 'repair' && !PRICING_STAGES.includes(j.stage) && j.stage !== ('lost' as any))
    .find((j) => {
      const b = norm(j.name).split(' ').filter(Boolean)
      const same = b.join(' ').startsWith(a.join(' ')) || a.join(' ').startsWith(b.join(' ')) || (a[0] && /\d/.test(a[0]) && a[0] === b[0])
      return same || (street.length > 4 && norm(j.address).startsWith(street))
    })
}
