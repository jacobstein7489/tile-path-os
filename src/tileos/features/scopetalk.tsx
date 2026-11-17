/* Changing the scope by talking — say (or type) what changed, the way you'd tell the office: "the master bath floor is
 * herringbone now, take out the niche, the shower walls go to the ceiling, add a laundry — floor only". The company's
 * AI reads it against the scope as it is (every room, its walls and floors, the project's tiles) and writes it back as
 * changes. They show as a short list, each in a few words, with a box to untick — nothing changes until you tap the
 * button. What it couldn't place is said, not guessed. What the crew already started stays (taking it off is refused,
 * the same as by hand). Tapping a line to change it by hand still works — this is the quick way. */
import * as React from 'react'
import { Check, Loader2, Mic, TriangleAlert } from 'lucide-react'
import { useStore, addHist, meOf, type Store } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { Button, TextArea } from '@/tileos/components/ui/core'
import { cn } from '@/tileos/lib/utils'
import { REAL } from '@/tileos/lib/save'
import { GROUTS, type Room, type Surface } from '@/tileos/data/jobs'
import { FLOORS } from '@/tileos/data/areas'
import { HEIGHTS, WHICH_WALLS } from './tiles'
import { jsonIn } from './reader'
import { lineStarted, roomStarted } from './scopebuild'
import { detailsOf } from './roomdetails'

type Field = 'tile' | 'height' | 'walls' | 'layout' | 'grout' | 'sf' | 'notes'
export type ScopeChange =
  | { op: 'set'; room: string; surface: string; field: Field; value: string }
  | { op: 'addSurface'; room: string; surface: string; tile?: string; height?: string; layout?: string }
  | { op: 'removeSurface'; room: string; surface: string }
  | { op: 'addRoom'; room: string; floor?: string; note?: string; surfaces?: string[] }
  | { op: 'removeRoom'; room: string }
  | { op: 'roomNote'; room: string; value: string }
  | { op: 'note'; room: string; value: string }
/** a change, checked against the scope as it is: what it does in a few words — and, when it can't be done, why */
export type Checked = { c: ScopeChange; say: string; ok: boolean; why?: string }

const low = (t: string) => t.trim().toLowerCase()
const lowFirst = (t: string) => t.replace(/^[A-Z](?![A-Z])/, (c) => c.toLowerCase())
const FIELD_WORD: Record<Field, string> = { tile: 'tile', height: 'how high', walls: 'which walls', layout: 'laid', grout: 'grout', sf: 'square feet', notes: 'note' }

/** what goes to the AI: the scope as it is, the tiles, the words people use — and what was said */
export function scopePrompt(s: Store, jobId: string, words: string): string {
  const job = s.jobs[jobId]
  const rooms = (s.rooms[jobId] || []).map((r) => ({
    room: r.name, floor: r.floor || '', note: r.note || '',
    walls_and_floors: r.surfaces.map((x) => ({ name: x.name, tile: x.tile || '', more_tiles: x.also || [], how_high: x.height || '', which_walls: x.walls || '', layout: x.layout || '', grout: x.grout ? GROUTS[x.grout]?.name || x.grout : '', sf: x.sf || 0, note: x.notes || '' })),
  }))
  const tiles = Object.values(s.tiles[jobId] || {}).map((t) => ({ tag: t.tag, name: t.name, size: t.size }))
  return [
    'You help Cobblestone, a tile installation company, change a project’s scope of work. Below is the scope as it is now — every room with its walls and floors — and the project’s tiles. Then what the person said changed. It was spoken, so it may be loose. Write it back as changes.',
    `Project: ${job?.name || ''}`,
    'The scope now (JSON):',
    JSON.stringify(rooms),
    'The project’s tiles (JSON):',
    JSON.stringify(tiles),
    `How high a wall goes — one of these when it fits, else the words said: ${HEIGHTS.join(' | ')}`,
    `Which walls: ${WHICH_WALLS.join(' | ')}`,
    `Grout colors: ${Object.values(GROUTS).map((g) => g.name).join(' | ')}`,
    `Floors of a house: ${FLOORS.join(' | ')}`,
    'The changes you can write, as JSON:',
    '- {"op":"set","room":"","surface":"","field":"tile|height|walls|layout|grout|sf|notes","value":""} — one thing on a wall or floor. tile: the tag from the tiles list. layout: the pattern and where it starts, in a few words ("Herringbone", "Offset ⅓ · centered on the vanity", "Checkerboard · cut to 12 x 12"). sf: a number. notes: a short note for the crew. value "" clears it.',
    '- {"op":"addSurface","room":"","surface":"","tile":"","height":"","layout":""} — one more wall or floor in a room (fill in only what was said).',
    '- {"op":"removeSurface","room":"","surface":""} — a wall or floor taken out ("no backsplash", "take out the niche").',
    '- {"op":"addRoom","room":"","floor":"","note":"","surfaces":["Floor"]} — a new room, with its walls and floors.',
    '- {"op":"removeRoom","room":""} — a room taken off the scope.',
    '- {"op":"roomNote","room":"","value":""} — the short note next to the room’s name ("Floor only", "Not tiled").',
    '- {"op":"note","room":"","value":""} — something for the room that isn’t a wall or floor ("1 niche", "Saddle — white quartz", "Cut the border on site").',
    'Rules: for rooms and walls and floors that are there, use their names exactly as written above. "The shower walls go to the ceiling" is how high. "Herringbone floor in the master bath" is that floor’s layout. One change for each thing said. When something doesn’t match the scope or isn’t clear, don’t guess — say it in "unclear", in a few plain words.',
    'Answer with JSON only: {"changes":[...],"unclear":""}',
    `What was said: """${words.trim()}"""`,
  ].join('\n')
}

/** the AI's answer, read: its changes (only the kinds there are) and what it couldn't place */
export function readChanges(text: string): { changes: ScopeChange[]; unclear: string } {
  const j = jsonIn(text) || {}
  const str = (v: any) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
  const out: ScopeChange[] = []
  ;(Array.isArray(j.changes) ? j.changes : []).forEach((c: any) => {
    const op = str(c?.op), room = str(c?.room), surface = str(c?.surface)
    if (!room) return
    if (op === 'set' && surface && ['tile', 'height', 'walls', 'layout', 'grout', 'sf', 'notes'].includes(str(c.field))) out.push({ op, room, surface, field: str(c.field) as Field, value: str(c.value) })
    else if (op === 'addSurface' && surface) out.push({ op, room, surface, tile: str(c.tile) || undefined, height: str(c.height) || undefined, layout: str(c.layout) || undefined })
    else if (op === 'removeSurface' && surface) out.push({ op, room, surface })
    else if (op === 'addRoom') out.push({ op, room, floor: str(c.floor) || undefined, note: str(c.note) || undefined, surfaces: Array.isArray(c.surfaces) ? c.surfaces.map(str).filter(Boolean) : undefined })
    else if (op === 'removeRoom') out.push({ op, room })
    else if ((op === 'roomNote' || op === 'note') && str(c.value)) out.push({ op, room, value: str(c.value) })
  })
  return { changes: out, unclear: str(j.unclear) }
}

/* ---------------- each change, checked against the scope ---------------- */
const roomIn = (rooms: Room[], name: string) => rooms.find((r) => low(r.name) === low(name))
const surfIn = (r: Room | undefined, name: string) => r?.surfaces.find((x) => low(x.name) === low(name))
const tileIn = (s: Store, jobId: string, v: string) => { const all = Object.values(s.tiles[jobId] || {}); return all.find((t) => low(t.tag) === low(v)) || all.find((t) => low(t.name) === low(v)) || all.find((t) => low(`${t.tag} ${t.name}`) === low(v)) }
const groutIn = (v: string) => (GROUTS[v] ? v : Object.entries(GROUTS).find(([, g]) => low(g.name) === low(v))?.[0])

export function checkChanges(s: Store, jobId: string, list: ScopeChange[]): Checked[] {
  const rooms = s.rooms[jobId] || []
  return list.map((c): Checked => {
    const r = roomIn(rooms, c.room)
    const at = (x?: Surface) => `${r?.name || c.room} · ${x?.name || ('surface' in c ? c.surface : '')}`
    if (c.op === 'addRoom') {
      if (r) return { c, say: `Add a room: ${c.room}`, ok: false, why: `${r.name} is already on the scope` }
      const walls = c.surfaces?.length ? c.surfaces : ['Floor']
      /* its walls and floors said only when it's more than a floor */
      const more = walls.length > 1 || low(walls[0]) !== 'floor' ? ` · ${walls.join(', ')}` : ''
      return { c, say: `Add a room: ${c.room}${c.floor ? ` on the ${c.floor}` : ''}${c.note ? ` — ${c.note}` : ''}${more}`, ok: true }
    }
    if (!r) return { c, say: `${c.room}`, ok: false, why: `There’s no ${c.room} on the scope` }
    if (c.op === 'removeRoom') return roomStarted(r) ? { c, say: `Take ${r.name} off the scope`, ok: false, why: 'The crew started there — it stays' } : { c, say: `Take ${r.name} off the scope`, ok: true }
    if (c.op === 'roomNote') return { c, say: `${r.name} — next to its name: ${c.value}`, ok: true }
    if (c.op === 'note') return { c, say: `${r.name} — a note: ${c.value}`, ok: true }
    if (c.op === 'addSurface') {
      if (surfIn(r, c.surface)) return { c, say: `${r.name} — add ${c.surface}`, ok: false, why: `${r.name} has ${c.surface} already` }
      const t = c.tile ? tileIn(s, jobId, c.tile) : undefined
      return { c, say: `${r.name} — add ${c.surface}${t ? ` · ${t.name}` : ''}${c.height ? ` · ${lowFirst(c.height)}` : ''}${c.layout ? ` · ${lowFirst(c.layout)}` : ''}`, ok: true }
    }
    const x = surfIn(r, c.surface)
    if (!x) return { c, say: `${r.name} · ${c.surface}`, ok: false, why: `${r.name} has no ${c.surface}` }
    if (c.op === 'removeSurface') return lineStarted(x) ? { c, say: `${at(x)} — take it off`, ok: false, why: 'The crew started it — it stays' } : { c, say: `${at(x)} — take it off`, ok: true }
    /* set one thing */
    const v = c.value
    if (c.field === 'tile') { const t = v ? tileIn(s, jobId, v) : undefined; return v && !t ? { c, say: `${at(x)} — tile: ${v}`, ok: false, why: `No tile called ${v} on this project` } : { c, say: `${at(x)} — tile: ${t ? `${t.tag} ${t.name}` : 'none'}`, ok: true } }
    if (c.field === 'grout') { const g = v ? groutIn(v) : ''; return v && !g ? { c, say: `${at(x)} — grout: ${v}`, ok: false, why: `No grout color called ${v}` } : { c, say: `${at(x)} — grout: ${g ? GROUTS[g].name : 'none'}`, ok: true } }
    if (c.field === 'sf') { const n = Math.round(Number(v.replace(/[^\d.]/g, ''))); return n > 0 ? { c, say: `${at(x)} — ${n.toLocaleString('en-US')} SF`, ok: true } : { c, say: `${at(x)} — square feet: ${v}`, ok: false, why: 'Not a number of square feet' } }
    return { c, say: `${at(x)} — ${FIELD_WORD[c.field]}: ${v ? lowFirst(v) : 'none'}`, ok: true }
  })
}

/** the changes made — one save, one line in the project's history each */
export function applyChanges(jobId: string, list: Checked[]) {
  const go = list.filter((x) => x.ok)
  if (!go.length) return
  useStore.getState().commit((st) => {
    const rooms = (st.rooms[jobId] ||= [])
    const who = meOf(st.role)
    go.forEach(({ c, say }) => {
      const r = roomIn(rooms, c.room)
      if (c.op === 'addRoom') {
        if (r) return
        const walls = c.surfaces?.length ? c.surfaces : ['Floor']
        rooms.push({ name: c.room, pct: 0, ...(c.floor ? { floor: c.floor } : {}), ...(c.note ? { note: c.note } : {}), surfaces: walls.map((n) => ({ name: n, tile: '', state: 'notstarted' as const })) })
      } else if (!r) return
      else if (c.op === 'removeRoom') { if (!roomStarted(r)) st.rooms[jobId] = rooms.filter((y) => y !== r) }
      else if (c.op === 'roomNote') r.note = c.value
      else if (c.op === 'note') r.details = [...detailsOf(st, jobId, r).lines, c.value]
      else if (c.op === 'addSurface') {
        if (surfIn(r, c.surface)) return
        const t = c.tile ? tileIn(st as Store, jobId, c.tile) : undefined
        r.surfaces.push({ name: c.surface, tile: t?.tag || '', state: 'notstarted', ...(c.height ? { height: c.height } : {}), ...(c.layout ? { layout: c.layout } : {}) })
      } else {
        const x = surfIn(r, c.surface)
        if (!x) return
        if (c.op === 'removeSurface') { if (!lineStarted(x)) r.surfaces = r.surfaces.filter((y) => y !== x) }
        else if (c.op === 'set') {
          const v = c.value
          if (c.field === 'tile') { x.tile = v ? tileIn(st as Store, jobId, v)?.tag || x.tile : ''; if (x.tile && x.state === 'unknown' && /tile not (confirmed|picked)/i.test(x.reason || '')) { x.state = 'ready'; x.reason = undefined } }
          else if (c.field === 'grout') { const g = v ? groutIn(v) : ''; if (g) x.grout = g; else delete x.grout }
          else if (c.field === 'sf') { const n = Math.round(Number(v.replace(/[^\d.]/g, ''))); if (n > 0) x.sf = n }
          else { const k = c.field === 'notes' ? 'notes' : c.field; if (v) (x as any)[k] = v; else delete (x as any)[k] }
        }
      }
      addHist(st, jobId, { who, kind: 'setup', title: `Scope changed · ${say}`, detail: 'Said, and checked before it was saved' })
    })
  }, `${go.length} change${go.length === 1 ? '' : 's'} made`, { close: true, sub: 'The scope of work, the materials and the room sheets follow.' })
}

/* ---------------- the window ---------------- */
type Step = { k: 'say' } | { k: 'busy' } | { k: 'check'; list: Checked[]; unclear: string } | { k: 'fail'; msg: string }
export function ScopeTalkModal({ jobId, room, level }: { jobId: string; room?: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const [words, setWords] = React.useState(room ? `${room}: ` : '')
  const [step, setStep] = React.useState<Step>({ k: 'say' })
  const [off, setOff] = React.useState<number[]>([])
  const abort = React.useRef<AbortController | null>(null)
  React.useEffect(() => () => abort.current?.abort(), [])
  if (!job) return null
  const look = async () => {
    if (!words.trim()) return
    if (!REAL.ai) { setStep({ k: 'fail', msg: 'The AI isn’t on in this copy — tap a line on the scope to change it.' }); return }
    setStep({ k: 'busy' })
    const ac = (abort.current = new AbortController())
    try {
      const st = useStore.getState()
      const text = await REAL.ai(scopePrompt(st, jobId, words), [], ac.signal)
      if (ac.signal.aborted) return
      const { changes, unclear } = readChanges(text)
      setOff([])
      setStep({ k: 'check', list: checkChanges(useStore.getState(), jobId, changes), unclear })
    } catch (e: any) {
      if (ac.signal.aborted) return
      setStep({ k: 'fail', msg: e?.message || 'Couldn’t read it just now — try again.' })
    }
  }
  const list = step.k === 'check' ? step.list : []
  const picked = list.filter((x, i) => x.ok && !off.includes(i))
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title="Change the scope"
      sub={`${job.name} — say what changed. Nothing changes until you OK it.`}
      footer={step.k === 'check' ? (
        <>
          <Button onClick={() => setStep({ k: 'say' })} data-talk-back>Change what I said</Button>
          <Button className="ml-auto" variant="primary" icon={<Check />} disabled={!picked.length} onClick={() => applyChanges(jobId, picked)} data-talk-apply>{picked.length ? `Make ${picked.length === 1 ? 'this change' : `these ${picked.length} changes`}` : 'Nothing to change'}</Button>
        </>
      ) : (
        <Button className="ml-auto" variant="primary" disabled={!words.trim() || step.k === 'busy'} onClick={look} data-talk-look>{step.k === 'busy' ? 'Reading it…' : 'Look at it'}</Button>
      )}
    >
      {step.k !== 'check' && (
        <div data-talk-say>
          <div className="mb-2 flex items-center gap-2 text-[0.875rem] text-muted"><Mic className="h-4 w-4 text-brand-600" />Tap the mic and talk — or type it.</div>
          <TextArea autoFocus value={words} onChange={(e) => setWords(e.target.value)} placeholder="e.g. The master bath floor is herringbone now. Take out the niche. The shower walls go to the ceiling." className="min-h-[8rem] text-[0.9375rem]" data-talk-words />
          {step.k === 'busy' && <div className="mt-3 flex items-center gap-2 text-[0.875rem] text-muted" data-talk-busy><Loader2 className="h-4 w-4 animate-spin text-brand-600" />Reading what you said against the scope…</div>}
          {step.k === 'fail' && <div className="mt-3 flex items-start gap-2 rounded-lg bg-warn-50 px-3 py-2.5 text-[0.875rem] text-warn-800" data-talk-fail><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />{step.msg}</div>}
        </div>
      )}
      {step.k === 'check' && (
        <div data-talk-check>
          {list.length > 0 ? <div className="mb-2 text-[0.875rem] font-semibold text-ink">{list.length === 1 ? 'The change' : `${list.length} changes`} — untick one to leave it out</div> : <div className="text-[0.9375rem] text-muted">No change found in what you said.</div>}
          <div className="overflow-hidden rounded-xl border border-line">
            {list.map((x, i) => {
              const on = x.ok && !off.includes(i)
              return (
                <button key={i} type="button" disabled={!x.ok} onClick={() => setOff((o) => (o.includes(i) ? o.filter((y) => y !== i) : [...o, i]))} role="checkbox" aria-checked={on} className="flex w-full items-start gap-3 border-t border-line-2 px-4 py-2.5 text-left first:border-t-0 enabled:row-hover" data-talk-change={i} data-talk-ok={x.ok || undefined}>
                  <span className={cn('mt-0.5 inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.3125rem] border', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9ced6] bg-white')}>{on && <Check className="h-3 w-3" strokeWidth={3.2} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-[0.9375rem]', x.ok ? 'text-ink' : 'text-muted line-through decoration-faint')}>{x.say}</span>
                    {x.why && <span className="block text-[0.8125rem] text-warn-700">{x.why}</span>}
                  </span>
                </button>
              )
            })}
          </div>
          {step.unclear && <div className="mt-3 flex items-start gap-2 rounded-lg bg-warn-50 px-3 py-2.5 text-[0.875rem] text-warn-800" data-talk-unclear><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span><b className="font-semibold">Not sure about:</b> {step.unclear}</span></div>}
        </div>
      )}
    </Modal>
  )
}
