/* Bring in projects — the ones already going when Tile OS starts: getting ready, installing, on hold, in touch-ups.
 * Drop each project's estimate (a PDF or photos of it — whatever program made it): AI reads the client, the address,
 * every room and each wall and floor with its square feet, and the estimate's number and total. Check the name, pick
 * where it stands, add its tile paperwork if it's handy (the same reader fills in the tiles, grout, edges and
 * pictures), and bring them in — one at a time or a stack at once. The estimate stays with its project. */
import * as React from 'react'
import { Upload, FileText, Loader2, X, Plus, CircleAlert, Check, ChevronDown, PauseCircle, Sparkles } from 'lucide-react'
import { useStore, addHist, meOf, NOW } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney, CREWS, PEOPLE, type Customer, type Job, type PersonKey } from '@/tileos/data/model'
import { isOff } from './active'
import { CUSTOMERS, type Room } from '@/tileos/data/jobs'
import { keepFiles } from '@/tileos/lib/files'
import { pagesOf, askAI, jsonIn, ReadError } from './reader'
import { companySteps } from './steps'
import { readPaperworkFor } from './paperread'

/* ================= reading an estimate ================= */
export type EstSurface = { name: string; sf?: number; note?: string }
export type EstRoom = { room: string; floor?: string; note?: string; surfaces: EstSurface[] }
export type EstRead = {
  client: string; clientPhone?: string; clientEmail?: string; clientAddress?: string
  project: string; address: string; number?: string; date?: string; total?: number
  rooms: EstRoom[]; notes?: string
}

export const ESTIMATE_PROMPT = [
  'You are reading a tile installation estimate (a proposal or a quote). Cobblestone, a tile installation company, made it; the client is who it is for — never Cobblestone. The pictures are its pages.',
  '',
  'Read:',
  '- client: who the estimate is for (a general contractor, a builder, a homeowner) — and clientPhone, clientEmail, clientAddress if they are shown',
  '- project: the project’s name (often the job’s street address, or a building or development name); address: the job site’s address',
  '- number: the estimate or proposal number; date: its date; total: the grand total, as a number without $',
  '- rooms: every room or area, in the order of the estimate, with floor = the level it is on when the estimate groups rooms by floor ("1st Floor", "2nd Floor", "Basement"), else "".',
  '  For each room, every surface we tile, with its square feet (sf). Name it plainly: "Floor", "Shower floor", "Shower walls", "Tub walls", "Backsplash", "Base", "Niche", "Accent wall", "Wainscot", "Fireplace", "Stairs", "Bench", "Curb" — or the estimate’s own words when they are clear.',
  '  Leave out lines that are not a surface (setting materials, demolition, waterproofing alone, delivery, permits, disposal) — if one matters for the job, say it in the room’s note in a few words ("Waterproofing included").',
  '  note on a room: how it is tiled when the estimate says — "Fully tiled to the ceiling", "Half tiled to 4 ft", "Wet walls only".',
  '',
  'Answer with JSON only, no other text, in exactly this shape:',
  '{"client":"","clientPhone":"","clientEmail":"","clientAddress":"","project":"","address":"","number":"","date":"","total":0,"rooms":[{"room":"","floor":"","note":"","surfaces":[{"name":"","sf":0,"note":""}]}],"notes":""}',
  'In "notes" put anything that matters but fits nowhere else (exclusions, a revision). Leave a field "" (or 0) when the estimate doesn’t give it.',
].join('\n')

const str = (v: any) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())
const num = (v: any) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined }
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)
const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** the AI's answer, checked: rooms with at least one surface, every surface once (the bigger square feet wins) */
export function cleanEstimate(raw: any): EstRead {
  const rooms: EstRoom[] = (Array.isArray(raw?.rooms) ? raw.rooms : []).map((r: any) => {
    const list: EstSurface[] = []
    for (const x of Array.isArray(r?.surfaces) ? r.surfaces : []) {
      const name = cap(str(x?.name))
      if (!name) continue
      const had = list.find((y) => norm(y.name) === norm(name))
      const sf = num(x?.sf)
      if (had) { if ((sf || 0) > (had.sf || 0)) had.sf = sf; continue }
      list.push({ name, sf, note: str(x?.note) || undefined })
    }
    return { room: cap(str(r?.room)), floor: str(r?.floor) || undefined, note: str(r?.note) || undefined, surfaces: list }
  }).filter((r: EstRoom) => r.room && r.surfaces.length)
  return {
    client: str(raw?.client), clientPhone: str(raw?.clientPhone) || undefined, clientEmail: str(raw?.clientEmail) || undefined, clientAddress: str(raw?.clientAddress) || undefined,
    project: str(raw?.project), address: str(raw?.address), number: str(raw?.number) || undefined, date: str(raw?.date) || undefined, total: num(raw?.total),
    rooms, notes: str(raw?.notes) || undefined,
  }
}
/** what several asks found (a long estimate, 8 pages at a time), as one — the grand total is on the last page that
 *  has one; the same room (on the same floor) once */
export function mergeEstimates(parts: EstRead[]): EstRead {
  const first = <K extends keyof EstRead>(k: K) => parts.map((p) => p[k]).find((v) => !!v) as EstRead[K]
  const rooms: EstRoom[] = []
  for (const p of parts) for (const r of p.rooms) {
    const had = rooms.find((x) => norm(x.room) === norm(r.room) && norm(x.floor || '') === norm(r.floor || ''))
    if (!had) { rooms.push({ ...r, surfaces: r.surfaces.map((x) => ({ ...x })) }); continue }
    if (!had.note && r.note) had.note = r.note
    for (const x of r.surfaces) {
      const y = had.surfaces.find((z) => norm(z.name) === norm(x.name))
      if (!y) had.surfaces.push({ ...x })
      else if ((x.sf || 0) > (y.sf || 0)) y.sf = x.sf
    }
  }
  return {
    client: first('client') || '', clientPhone: first('clientPhone'), clientEmail: first('clientEmail'), clientAddress: first('clientAddress'),
    project: first('project') || '', address: first('address') || '', number: first('number'), date: first('date'),
    total: [...parts].reverse().map((p) => p.total).find((v) => !!v), rooms, notes: parts.map((p) => p.notes).filter(Boolean).join(' ') || undefined,
  }
}
/** read one estimate: its pages as pictures, 8 at a time, put together */
export async function readEstimate(files: File[], signal?: AbortSignal): Promise<EstRead> {
  const pages = await pagesOf(files, 16)
  if (!pages.length) throw new ReadError('nopages', 'That isn’t a PDF or a picture we can read.')
  const parts: EstRead[] = []
  for (let i = 0; i < pages.length; i += 8) {
    const chunk = pages.slice(i, i + 8)
    const which = pages.length > 8 ? `\n\nThese are pages ${i + 1}–${i + chunk.length} of ${pages.length}.` : ''
    const text = await askAI(ESTIMATE_PROMPT + which, chunk, signal)
    if (signal?.aborted) throw new ReadError('cancelled', 'Stopped.')
    parts.push(cleanEstimate(jsonIn(text)))
  }
  return mergeEstimates(parts)
}

/** rooms with names of their own — two "Bathroom"s on different floors become "Bathroom · 2nd Floor" */
export function roomsFrom(r: EstRead): Room[] {
  const out: Room[] = []
  for (const x of r.rooms) {
    let name = x.room
    if (out.some((y) => norm(y.name) === norm(name))) name = x.floor ? `${x.room} · ${x.floor}` : x.room
    let n = 2
    const base = name
    while (out.some((y) => norm(y.name) === norm(name))) name = `${base} ${n++}`
    out.push({ name, pct: 0, ...(x.floor ? { floor: x.floor } : {}), ...(x.note ? { note: x.note } : {}), surfaces: x.surfaces.map((s) => ({ name: s.name, tile: '', state: 'notstarted' as const, ...(s.sf ? { sf: s.sf } : {}), ...(s.note ? { notes: s.note } : {}) })) })
  }
  return out
}

/* ================= where each one stands ================= */
type Where = 'new' | 'tile' | 'ready' | 'installing' | 'touchups'
const WHERE: { key: Where; label: string; hint: string }[] = [
  { key: 'new', label: 'Getting ready — just won', hint: 'Every step of getting ready is still to do' },
  { key: 'tile', label: 'Getting ready — waiting for the tile', hint: 'Left: the tile delivery, the installer, our materials' },
  { key: 'ready', label: 'Getting ready — the tile is here', hint: 'Left: the installer and our materials' },
  { key: 'installing', label: 'In progress — installing', hint: 'Getting ready is checked off as done before Tile OS' },
  { key: 'touchups', label: 'Touch-ups', hint: 'Installed — the touch-ups are left' },
]
/** what's still open at each point — the rest was done before Tile OS (the deposit too: billed outside before) */
const OPEN_AT: Record<Where, string[] | null> = {
  new: null,
  tile: ['order', 'delivered', 'installer', 'walk', 'confirmed', 'materials', 'matin'],
  ready: ['installer', 'walk', 'confirmed', 'materials', 'matin'],
  installing: [],
  touchups: [],
}

/* ================= one estimate dropped in ================= */
type Card = {
  id: string; file: File; paper: File[]
  st: 'waiting' | 'reading' | 'read' | 'bad'; msg?: string; read?: EstRead
  name: string; client: string; address: string; where: Where; pct: string; hold: boolean; why: string; open: boolean
  /** the installer on it (in progress, touch-ups) — can be picked later */
  crew: string
}
const READABLE = (f: File) => /pdf|image/.test(f.type) || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name)
const bare = (f: string) => f.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim()
const clientOf = (name: string): Customer | undefined => { const k = norm(name); return k ? Object.values(CUSTOMERS).find((c) => norm(c.name) === k) : undefined }
const sfOf = (r?: EstRead) => (r ? r.rooms.reduce((a, x) => a + x.surfaces.reduce((b, y) => b + (y.sf || 0), 0), 0) : 0)

export function BringInModal({ level }: { level: number }) {
  const s = useStore()
  const [cards, setCards] = React.useState<Card[]>([])
  const [over, setOver] = React.useState(false)
  const input = React.useRef<HTMLInputElement>(null)
  /* one estimate read at a time — a stack of them doesn't jam the AI */
  const queue = React.useRef<Promise<void>>(Promise.resolve())
  const live = React.useRef(true)
  React.useEffect(() => () => { live.current = false }, [])
  const patch = (id: string, p: Partial<Card>) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const read = (c: Card) => {
    queue.current = queue.current.then(async () => {
      if (!live.current) return
      patch(c.id, { st: 'reading' })
      try {
        const r = await readEstimate([c.file])
        if (!live.current) return
        if (!r.rooms.length && !r.client && !r.project) { patch(c.id, { st: 'bad', msg: 'Nothing on it looked like an estimate — try a clearer PDF.' }); return }
        const name = r.project || r.address.split(',')[0] || bare(c.file.name)
        patch(c.id, { st: 'read', read: r, name, client: r.client, address: r.address || r.project })
      } catch (e: any) {
        if (live.current) patch(c.id, { st: 'bad', msg: e instanceof ReadError ? e.message : 'Couldn’t read it just now — try again.' })
      }
    })
  }
  const add = (list: File[]) => {
    const files = list.filter(READABLE)
    const fresh: Card[] = files.map((f, i) => ({ id: `${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 5)}`, file: f, paper: [], st: 'waiting', name: bare(f.name), client: '', address: '', where: 'new', pct: '', hold: false, why: '', open: false, crew: '' }))
    setCards((cs) => [...cs, ...fresh])
    fresh.forEach(read)
  }
  const ready = cards.filter((c) => c.st === 'read' && c.name.trim() && c.client.trim())
  const busy = cards.some((c) => c.st === 'waiting' || c.st === 'reading')

  const bring = () => {
    const me = meOf(s.role)
    const made: { card: Card; id: string }[] = []
    s.commit((st) => {
      ready.forEach((c, i) => {
        const r = c.read!
        const id = 'p' + Date.now().toString(36) + i
        /* the client: the one we have by that name — or a new one from what the estimate says */
        const nm = c.client.trim()
        let clientId = clientOf(nm)?.id || Object.values(st.clients).find((x) => norm(x.name) === norm(nm))?.id
        if (!clientId) {
          clientId = 'c' + Date.now().toString(36) + i
          st.clients[clientId] = {
            id: clientId, name: nm, kind: /\b(llc|inc|corp|co|construction|builders?|group|development|properties|homes|contracting|realty|management)\b/i.test(nm) ? 'General contractor' : 'Homeowner',
            address: r.clientAddress || '', phone: r.clientPhone || '', email: r.clientEmail || '', notes: `Brought in with ${c.name.trim()}`, contacts: [],
          } as Customer
        }
        const stage = c.where === 'installing' ? 'installation' : c.where === 'touchups' ? 'punch' : 'setup'
        const pct = Math.max(0, Math.min(100, Math.round(Number(c.pct.replace(/[^\d.]/g, '')) || 0)))
        const rooms = roomsFrom(r)
        const job: Job = {
          id, name: c.name.trim(), client: nm, clientId, address: c.address.trim() || r.address || '', stage, kind: 'install',
          status: c.hold ? 'bad' : 'info',
          headline: c.hold ? `On hold · ${c.why.trim() || 'brought in on hold'}` : WHERE.find((w) => w.key === c.where)!.label,
          issues: [], pm: 'ys', site: 'yakov',
          next: c.where === 'new' ? { text: 'Get the tile paperwork', owner: 'estimator', due: 'This week' } : c.where === 'tile' ? { text: 'Get the tile delivery date', owner: 'office', due: 'Today' } : c.where === 'ready' ? { text: 'Send the installer his PO', owner: 'ys', due: 'Today' } : { text: c.where === 'touchups' ? 'Finish the touch-ups' : 'Keep the daily updates going', owner: 'yakov' },
          keyDate: { label: 'Brought in', value: NOW }, swatch: 'bianco', building: 'house',
          contract: r.total || undefined, stageDates: { won: NOW },
          ...(stage === 'installation' ? { pct } : {}),
          ...(c.crew && (stage === 'installation' || stage === 'punch') ? { crew: c.crew as PersonKey } : {}),
          ...(c.hold ? { hold: { reason: c.why.trim() || 'Brought in on hold', since: NOW, by: me } } : {}),
        }
        st.jobs[id] = job
        /* the rooms from the estimate; installed already: its walls and floors as far as it is */
        st.rooms[id] = stage === 'punch' ? rooms.map((x) => ({ ...x, pct: 100, surfaces: x.surfaces.map((y) => ({ ...y, state: 'done' as const, pct: 100 })) })) : rooms
        st.prep[id] = { target: 'TBD', meeting: { text: 'TBD' }, installer: c.crew && (stage === 'installation' || stage === 'punch') ? c.crew : 'tbd', confirmed: c.crew ? 'yes' : 'no', paperwork: c.paper.length ? 'yes' : 'no', po: 'no', material: 'no', deposit: 'na' } as any
        /* already under way: what came before is checked off — only what's left lands on people's lists */
        const open = OPEN_AT[c.where]
        if (open) {
          const recs = (st.stepRecs[id] ||= {})
          companySteps(st).forEach((d) => {
            if (open.includes(d.key)) return
            recs[d.key] = d.key === 'sheets' && (c.where === 'tile' || c.where === 'ready') ? { na: true } : { done: NOW, by: me, note: 'Done before Tile OS' }
          })
        }
        addHist(st, id, { who: me, kind: 'pricing', title: `Brought in from its estimate${r.number ? ` ${r.number}` : ''}`, detail: [r.date ? `Dated ${r.date}` : '', r.total ? `Total ${fmtMoney(r.total)}` : '', `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}`, sfOf(r) ? `${Math.round(sfOf(r)).toLocaleString('en-US')} SF` : '', WHERE.find((w) => w.key === c.where)!.label.toLowerCase()].filter(Boolean).join(' · ') })
        if (c.hold) addHist(st, id, { who: me, kind: 'field', title: 'On hold', detail: c.why.trim() || undefined })
        made.push({ card: c, id })
      })
    }, `${ready.length} ${ready.length === 1 ? 'project' : 'projects'} brought in`, { sub: ready.some((c) => c.paper.length) ? 'Its tile paperwork is being read now — the tiles fill in by themselves.' : 'Each one is on Projects with its rooms, walls and floors.' })
    s.close()
    s.go({ page: 'projects' })
    /* the estimate stays with its project; the tile paperwork is read and entered, one project after another */
    void (async () => {
      for (const { card, id } of made) await keepFiles(id, [card.file], 'other', { quiet: true, doc: 'Estimate' }).catch(() => undefined)
      for (const { card, id } of made) {
        const job = useStore.getState().jobs[id]
        if (job && card.paper.length) await readPaperworkFor(job, card.paper).catch(() => undefined)
      }
    })()
  }

  return (
    <Modal
      level={level}
      size="lg"
      tall={cards.length > 0}
      onClose={s.close}
      title="Bring in projects"
      sub="Drop each project’s estimate — AI builds it: the client, the address, every room, wall and floor"
      footer={
        <>
          <span className="min-w-0 truncate text-[0.8125rem] text-muted">{busy ? 'Reading…' : cards.length ? `${ready.length} of ${cards.length} ready` : 'PDFs or photos — one estimate per project'}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Check />} disabled={!ready.length} onClick={bring} data-bring-in>{ready.length > 1 ? `Bring in ${ready.length} projects` : 'Bring it in'}</Button>
        </>
      }
    >
      <input ref={input} type="file" multiple accept="application/pdf,image/*" className="hidden" aria-label="Estimates" data-bringin-files onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ''; add(f) }} />
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files || [])) }}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        className={cn('flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed transition max-sm:flex-wrap', cards.length ? 'px-4 py-3' : 'px-5 py-8', over ? 'border-brand-400 bg-brand-50/60' : 'border-[#d8d2c8] bg-[#faf8f5] hover:border-brand-300')}
        data-bringin-drop
      >
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-xs"><Upload className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold text-ink">{cards.length ? 'Add more estimates' : 'Drop the estimates here — or tap to pick them'}</span>
          <span className="block text-[0.8125rem] text-muted">One per project, as many as you like. A PDF, or photos of the pages.</span>
        </span>
      </div>
      {cards.length > 0 && (
        <div className="mt-4 flex flex-col gap-3" data-bringin-list>
          {cards.map((c) => <EstCard key={c.id} c={c} patch={(p) => patch(c.id, p)} remove={() => setCards((cs) => cs.filter((x) => x.id !== c.id))} retry={() => read(c)} />)}
        </div>
      )}
    </Modal>
  )
}

/** one estimate: reading it, then what it found — the name, the client, the address, the rooms — and where it stands */
function EstCard({ c, patch, remove, retry }: { c: Card; patch: (p: Partial<Card>) => void; remove: () => void; retry: () => void }) {
  const s = useStore()
  const paperIn = React.useRef<HTMLInputElement>(null)
  const r = c.read
  const known = c.client.trim() ? clientOf(c.client) : undefined
  const sf = sfOf(r)
  const nSurf = r ? r.rooms.reduce((a, x) => a + x.surfaces.length, 0) : 0
  const dup = Object.values(s.jobs).find((j) => norm(j.name) === norm(c.name) || (!!c.address.trim() && norm(j.address) === norm(c.address)))
  const where = WHERE.find((w) => w.key === c.where)!
  return (
    <section className="overflow-hidden rounded-[0.875rem] border border-line bg-white" data-est-card={c.st}>
      <header className="flex min-w-0 items-center gap-3 border-b border-line-2 bg-[#fbfaf7] px-4 py-2.5">
        {c.st === 'reading' || c.st === 'waiting' ? <Loader2 className={cn('h-4 w-4 shrink-0 text-brand-600', c.st === 'reading' && 'animate-spin')} /> : c.st === 'bad' ? <CircleAlert className="h-4 w-4 shrink-0 text-bad-600" /> : <FileText className="h-4 w-4 shrink-0 text-muted" />}
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink-2">{c.file.name}</span>
        {r && (r.number || r.total) && <span className="shrink-0 text-[0.8125rem] tnum text-muted">{[r.number, r.total ? fmtMoney(r.total) : ''].filter(Boolean).join(' · ')}</span>}
        <button type="button" onClick={remove} aria-label="Take this one out" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-faint hover:bg-wash hover:text-ink"><X className="h-4 w-4" /></button>
      </header>
      {c.st === 'waiting' && <div className="px-4 py-3 text-[0.84375rem] text-muted">Waiting its turn…</div>}
      {c.st === 'reading' && <div className="px-4 py-3 text-[0.84375rem] text-muted">Reading the estimate — the client, the address, every room, wall and floor. Up to a minute.</div>}
      {c.st === 'bad' && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 text-[0.84375rem]">
          <span className="min-w-0 flex-1 text-bad-700">{c.msg}</span>
          <Button size="sm" onClick={retry}>Try again</Button>
        </div>
      )}
      {c.st === 'read' && r && (
        <div className="flex flex-col gap-3 px-4 py-3.5">
          <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
            <label className="min-w-0">
              <span className="mb-1 block text-[0.75rem] font-semibold text-muted">Project</span>
              <TextInput value={c.name} onChange={(e) => patch({ name: e.target.value })} aria-label="Project name" data-est-name />
            </label>
            <label className="min-w-0">
              <span className="mb-1 flex items-baseline justify-between gap-2 text-[0.75rem] font-semibold text-muted"><span>Client</span>{c.client.trim() && <span className={cn('font-medium', known ? 'text-[#2c8a5b]' : 'text-brand-700')}>{known ? 'Already a client' : 'New client'}</span>}</span>
              <TextInput value={c.client} onChange={(e) => patch({ client: e.target.value })} aria-label="Client" data-est-client />
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-[0.75rem] font-semibold text-muted">Address</span>
              <TextInput value={c.address} onChange={(e) => patch({ address: e.target.value })} aria-label="Job address" data-est-address />
            </label>
          </div>
          {dup && <div className="flex items-center gap-2 rounded-lg bg-warn-50 px-3 py-2 text-[0.8125rem] text-warn-700"><CircleAlert className="h-4 w-4 shrink-0" />{dup.name} is in Tile OS already — take this one out if it’s the same project.</div>}
          {/* what it found: the rooms, every wall and floor, the square feet — open it to check */}
          <div className="rounded-lg border border-line-2">
            <button type="button" onClick={() => patch({ open: !c.open })} aria-expanded={c.open} className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left" data-est-rooms>
              <span className="min-w-0 flex-1 truncate text-[0.84375rem] text-ink-2"><b className="font-semibold text-ink">{r.rooms.length} {r.rooms.length === 1 ? 'room' : 'rooms'}</b> · {nSurf} {nSurf === 1 ? 'wall or floor' : 'walls and floors'}{sf ? ` · ${Math.round(sf).toLocaleString('en-US')} SF` : ''}<span className="text-muted"> — {r.rooms.map((x) => x.room).slice(0, 4).join(', ')}{r.rooms.length > 4 ? '…' : ''}</span></span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-faint transition', c.open && 'rotate-180')} />
            </button>
            {c.open && (
              <div className="border-t border-line-2 px-3 py-2">
                {r.rooms.map((x, i) => (
                  <div key={i} className="py-1.5 text-[0.8125rem]">
                    <div className="font-semibold text-ink">{x.room}{x.floor ? <span className="font-normal text-muted"> · {x.floor}</span> : null}{x.note ? <span className="font-normal text-muted"> · {x.note}</span> : null}</div>
                    <div className="text-ink-2">{x.surfaces.map((y) => `${y.name}${y.sf ? ` ${y.sf} SF` : ''}`).join(' · ')}</div>
                  </div>
                ))}
                {!r.rooms.length && <div className="py-1.5 text-[0.8125rem] text-muted">No rooms found on it — they can be added on the project.</div>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 max-sm:grid-cols-1">
            <label className="min-w-0">
              <span className="mb-1 block text-[0.75rem] font-semibold text-muted">Where it stands</span>
              <SearchSelect label="Where it stands" value={c.where} onChange={(k) => patch({ where: (k || 'new') as Where })} search={false} plain options={WHERE.map((w) => ({ key: w.key, label: w.label }))} />
            </label>
            {c.where === 'installing' && (
              <label className="w-36 max-sm:w-full">
                <span className="mb-1 block text-[0.75rem] font-semibold text-muted">How far</span>
                <span className="relative block"><TextInput inputMode="numeric" value={c.pct} onChange={(e) => patch({ pct: e.target.value.replace(/[^\d]/g, '').slice(0, 3) })} placeholder="0" aria-label="How far — percent installed" className="pr-14" data-est-pct /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[0.8125rem] text-muted">% in</span></span>
              </label>
            )}
          </div>
          <div className="-mt-1.5 text-[0.75rem] text-muted">{where.hint}</div>
          {(c.where === 'installing' || c.where === 'touchups') && (
            <label className="min-w-0 sm:max-w-[22rem]">
              <span className="mb-1 block text-[0.75rem] font-semibold text-muted">Installer on it</span>
              <SearchSelect label="Installer on it" value={c.crew} onChange={(k) => patch({ crew: k || '' })} placeholder="Pick later" search={false} plain options={CREWS.filter((x) => !isOff(s, 'crew', x)).map((x) => ({ key: x, label: PEOPLE[x]?.name || x }))} />
            </label>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => patch({ hold: !c.hold })} aria-pressed={c.hold} data-est-hold className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold transition', c.hold ? 'border-bad-300 bg-bad-50 text-bad-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}><PauseCircle className="h-4 w-4" />On hold</button>
            {c.hold && <span className="min-w-[12rem] flex-1"><TextInput value={c.why} onChange={(e) => patch({ why: e.target.value })} placeholder="Why — waiting on the GC, the tile…" aria-label="Why it’s on hold" data-est-why /></span>}
          </div>
          {/* its tile paperwork, if it's handy: read and entered once it's in */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line-2 pt-3">
            <input ref={paperIn} type="file" multiple accept="application/pdf,image/*" className="hidden" aria-label="Tile paperwork" data-est-paper-files onChange={(e) => { const f = Array.from(e.target.files || []).filter(READABLE); e.target.value = ''; if (f.length) patch({ paper: [...c.paper, ...f] }) }} />
            <Button size="sm" icon={c.paper.length ? <Sparkles /> : <Plus />} onClick={() => paperIn.current?.click()} data-est-paper>{c.paper.length ? 'More tile paperwork' : 'Its tile paperwork'}</Button>
            {c.paper.length > 0
              ? <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">{c.paper.map((f) => f.name).join(', ')} <span className="text-muted">— AI reads it once it’s in</span><button type="button" onClick={() => patch({ paper: [] })} className="ml-2 font-semibold text-muted hover:text-ink">Remove</button></span>
              : <span className="text-[0.8125rem] text-muted">If you have it — the tiles, grout, edges and pictures fill in by themselves.</span>}
          </div>
        </div>
      )}
    </section>
  )
}
