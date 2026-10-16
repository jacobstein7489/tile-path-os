/* Tile layout — any wall or floor drawn to scale with its real tile, joint and pattern.
 * It finds the start point that leaves no slivers, shows every cut, counts the tiles, and goes to the designer
 * for a yes. Saved, it becomes the surface's layout on the scope and the installer's sheet. */
import * as React from 'react'
import { Sparkles, Send, Check, Ruler, TriangleAlert, Printer } from 'lucide-react'
import { useStore, addHist, newTask, meOf, NOW } from '@/tileos/store'
import { Button, Chip } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { GROUTS, type Surface, tileOf } from '@/tileos/data/jobs'
import { kindOf } from './takeoff'
import { printNode } from '@/tileos/lib/print'

export type Pattern = 'stack' | 'half' | 'third' | 'vertical'
export const PATTERNS: { key: Pattern; label: string }[] = [
  { key: 'stack', label: 'Straight' },
  { key: 'half', label: '½ offset' },
  { key: 'third', label: '⅓ offset' },
  { key: 'vertical', label: 'Vertical stack' },
]
type Start = 'best' | 'center' | 'edge'
const TILE_COLOR: Record<string, string> = { grigio: '#d2cdc6', hex: '#ecebe7', toscana: '#eadfcb', subway: '#f7f7f4', bianco: '#f2f0eb', pearl: '#efebe3', calacatta: '#f5f3ef', blueprint: '#e8edf5' }

/* ---------------- numbers ---------------- */
const parseJoint = (j?: string) => {
  const m = (j || '1/16').match(/(\d+)\s*\/\s*(\d+)/)
  return m ? Number(m[1]) / Number(m[2]) : 0.0625
}
export function tileDims(size: string): { a: number; b: number; mosaic?: boolean } {
  if (/hex|mosaic/i.test(size)) return { a: 12, b: 12, mosaic: true }
  const n = (size.match(/\d+(\.\d+)?/g) || ['12', '12']).map(Number)
  return { a: n[0], b: n[1] ?? n[0] }
}
/** the surface's size in inches: what was measured, else worked out from its square feet and height */
export function surfaceDims(x: Surface): { w: number; h: number } {
  if (x.dims) return x.dims
  const area = (x.sf || 40) * 144
  const k = kindOf(x)
  if (k === 'wall') {
    const hm = (x.height || '').match(/(\d+)\s*(″|"|in)/)
    const h = /ceiling/i.test(x.height || '') ? 96 : hm ? Number(hm[1]) : /wainscot/i.test(x.name) ? 42 : 96
    return { w: Math.max(12, Math.round(area / h)), h }
  }
  const w = Math.round(Math.sqrt(area * 1.25))
  return { w, h: Math.max(12, Math.round(area / w)) }
}
export const ftIn = (inch: number) => {
  const q = Math.round(inch * 4) / 4
  const ft = Math.floor(q / 12)
  const i = q - ft * 12
  const frac = (v: number) => { const w = Math.floor(v); const r = v - w; const f = r === 0.25 ? '¼' : r === 0.5 ? '½' : r === 0.75 ? '¾' : ''; return `${w || (f ? '' : '0')}${f}` }
  return ft ? `${ft}′ ${frac(i)}″` : `${frac(i)}″`
}

type Piece = { x: number; y: number; w: number; h: number; cutW: boolean; cutH: boolean; sliver: boolean }
function lay(W: number, H: number, tw: number, th: number, j: number, pattern: Pattern, ox: number, oy: number) {
  const cw = tw + j
  const ch = th + j
  const minW = Math.max(1.5, Math.min(tw / 4, 6))
  const minH = Math.max(1, Math.min(th / 4, 6))
  const out: Piece[] = []
  for (let r = Math.floor(-oy / ch) - 1; oy + r * ch < H; r++) {
    const y = oy + r * ch
    const k = pattern === 'half' ? ((r % 2) + 2) % 2 : pattern === 'third' ? ((r % 3) + 3) % 3 : 0
    const shift = pattern === 'half' ? (k * cw) / 2 : pattern === 'third' ? (k * cw) / 3 : 0
    for (let c = Math.floor(-(ox + shift) / cw) - 1; ox + shift + c * cw < W; c++) {
      const x = ox + shift + c * cw
      const x0 = Math.max(0, x), x1 = Math.min(W, x + tw), y0 = Math.max(0, y), y1 = Math.min(H, y + th)
      if (x1 - x0 < 0.05 || y1 - y0 < 0.05) continue
      const w = x1 - x0, h = y1 - y0
      /* a hair off is taken up in the joints, not cut */
      const cutW = w < tw - 0.25, cutH = h < th - 0.25
      out.push({ x: x0, y: y0, w, h, cutW, cutH, sliver: (cutW && w < minW) || (cutH && h < minH) })
    }
  }
  const cuts = out.filter((p) => p.cutW || p.cutH)
  const smallest = cuts.length ? Math.min(...cuts.map((p) => Math.min(p.cutW ? p.w : Infinity, p.cutH ? p.h : Infinity))) : null
  return { pieces: out, full: out.length - cuts.length, cut: cuts.length, slivers: out.filter((p) => p.sliver).length, smallest }
}
/** the start that leaves the biggest smallest cut — no slivers if there's any way to avoid them */
function bestStart(W: number, H: number, tw: number, th: number, j: number, pattern: Pattern) {
  const cw = tw + j, ch = th + j
  const score = (ox: number, oy: number) => {
    const r = lay(W, H, tw, th, j, pattern, ox, oy)
    return (r.slivers ? -1000 * r.slivers : 0) + (r.smallest ?? 999)
  }
  let bx = 0, by = 0, best = -Infinity
  for (let ox = 0; ox < cw; ox += Math.max(0.25, cw / 96)) {
    const v = score(ox, 0)
    const sym = -Math.abs(((W - ox) % cw) - ox) * 0.001
    if (v + sym > best) { best = v + sym; bx = ox }
  }
  best = -Infinity
  for (let oy = 0; oy < ch; oy += Math.max(0.25, ch / 96)) {
    const v = score(bx, oy) - Math.abs(((H - oy) % ch) - oy) * 0.001
    if (v > best) { best = v; by = oy }
  }
  return { ox: bx, oy: by }
}

/* ---------------- saving it ---------------- */
function saveLayout(jobId: string, room: string, surface: string, o: { text: string; dims: { w: number; h: number }; grout?: string }) {
  useStore.getState().commit((s) => {
    const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
    if (!x) return
    x.layout = o.text
    x.dims = o.dims
    if (o.grout) x.grout = o.grout
    x.decided = [...(x.decided || []).filter((d) => !/^Layout drawn/.test(d)), `Layout drawn — ${NOW}`]
    addHist(s, jobId, { who: meOf(s.role), kind: 'setup', title: `Layout set · ${room} ${surface.toLowerCase()}`, detail: o.text })
  }, `Saved — the layout is on the scope and the installer’s sheet`, { close: true })
}
function sendLayout(jobId: string, room: string, surface: string, text: string) {
  useStore.getState().commit((s) => {
    addHist(s, jobId, { who: meOf(s.role), kind: 'setup', title: `Layout sent to the designer · ${room} ${surface.toLowerCase()}`, detail: text })
    newTask(s, { jobId, title: `Designer to OK the layout · ${room} ${surface.toLowerCase()}`, type: 'Setup', owner: meOf(s.role), for: [s.role], state: 'waiting', waitingOn: 'Designer', followUp: 'Thu', tone: 'neutral', where: text })
  }, 'Sent to the designer — it comes back Thursday if they haven’t answered')
}

/* ================= the window ================= */
export function LayoutModal({ jobId, room, surface, tile: tileTag, level }: { jobId: string; room: string; surface: string; tile?: string; level: number }) {
  const s = useStore()
  const x = s.rooms[jobId]?.find((r) => r.name === room)?.surfaces.find((y) => y.name === surface)
  const d0 = x ? surfaceDims(x) : { w: 60, h: 96 }
  const [W, setW] = React.useState(d0.w)
  const [H, setH] = React.useState(d0.h)
  /* the surface window can pass the tile just picked there, before it's saved */
  const tile = x ? tileOf(jobId, tileTag || x.tile) : undefined
  const td = tileDims(tile?.size || '12 × 24')
  const initial: Pattern = /vertical/i.test(x?.layout || '') ? 'vertical' : /1\/3|⅓|third/i.test(x?.layout || '') ? 'third' : /offset|brick|running/i.test(x?.layout || '') ? 'half' : td.mosaic ? 'stack' : td.b >= td.a * 2 ? 'third' : 'stack'
  const [pattern, setPattern] = React.useState<Pattern>(initial)
  const [start, setStart] = React.useState<Start>('best')
  const [grout, setGrout] = React.useState(x?.grout || tile?.grout || 'warmgray')
  /* the drawing, for printing the crew's sheet */
  const drawRef = React.useRef<HTMLDivElement>(null)
  const j = parseJoint(x?.joint)
  if (!x) return null
  const job = s.jobs[jobId]
  const long = Math.max(td.a, td.b), short = Math.min(td.a, td.b)
  const tw = pattern === 'vertical' ? short : long
  const th = pattern === 'vertical' ? long : short
  const cw = tw + j, ch = th + j
  const origin = start === 'best' ? bestStart(W, H, tw, th, j, pattern) : start === 'center' ? { ox: ((W / 2 - tw / 2) % cw + cw) % cw, oy: ((H / 2 - th / 2) % ch + ch) % ch } : { ox: 0, oy: 0 }
  const r = lay(W, H, tw, th, j, pattern, origin.ox, origin.oy)
  const options = (['best', 'center', 'edge'] as Start[]).map((k) => {
    const o = k === 'best' ? bestStart(W, H, tw, th, j, pattern) : k === 'center' ? { ox: ((W / 2 - tw / 2) % cw + cw) % cw, oy: ((H / 2 - th / 2) % ch + ch) % ch } : { ox: 0, oy: 0 }
    return { k, r: lay(W, H, tw, th, j, pattern, o.ox, o.oy) }
  })
  const isWall = kindOf(x) === 'wall'
  const startLabel = { best: 'Best start — fewest slivers', center: 'Centered', edge: isWall ? 'Full tile at the floor' : 'Full tile at the door' }
  const firstCut = r.pieces.filter((p) => p.y === 0).sort((a, b) => a.x - b.x)
  const leftCut = firstCut[0]?.cutW ? firstCut[0].w : null
  const rightCut = firstCut[firstCut.length - 1]?.cutW ? firstCut[firstCut.length - 1].w : null
  const text = `${PATTERNS.find((p) => p.key === pattern)!.label} · ${start === 'best' ? 'best start' : startLabel[start].toLowerCase()}${leftCut && rightCut ? ` · ${ftIn(leftCut)} cuts both sides` : ''}`
  const color = tile?.color || TILE_COLOR[tile?.swatch || ''] || '#efece6'
  const g = GROUTS[grout]?.color || '#b8b0a3'
  /* draw: fit the surface in the canvas, floor at the bottom */
  const box = { w: 780, h: 520 }
  const k = Math.min(box.w / W, box.h / H)
  const pw = W * k, ph = H * k
  const pieces = r.pieces.length
  const buy = Math.ceil(pieces * 1.1)
  return (
    <Modal
      level={level}
      size="full"
      tall
      onClose={s.close}
      title={`${room} · ${surface}`}
      sub={`${job?.name} · ${tile ? `${tile.tag} ${tile.name} ${tile.size}` : 'No tile picked'} · joint ${x.joint || '1/16″'} · drawn to scale`}
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{text}</span>
          <Button className="ml-auto" icon={<Printer />} onClick={() => printNode(drawRef.current)}>Print</Button>
          <Button icon={<Send />} onClick={() => sendLayout(jobId, room, surface, text)}>Send to the designer</Button>
          <Button variant="primary" icon={<Check />} onClick={() => saveLayout(jobId, room, surface, { text, dims: { w: W, h: H }, grout })}>Use this layout</Button>
        </>
      }
      bodyClass="p-0"
    >
      <div className="grid min-h-full grid-cols-[minmax(0,1fr)_20rem] max-lg:grid-cols-1">
        <div ref={drawRef} className="flex min-w-0 flex-col items-center justify-center gap-3 bg-[#f4f1eb] px-6 py-6">
          <div className="flex max-w-full items-end gap-3">
            {/* height label */}
            <div className="flex flex-col items-center justify-center text-[0.75rem] font-semibold tnum text-muted max-sm:hidden" style={{ height: ph }}>
              <span className="w-px flex-1 bg-[#c8ced8]" />
              <span className="my-1 -rotate-90 whitespace-nowrap">{ftIn(H)}</span>
              <span className="w-px flex-1 bg-[#c8ced8]" />
            </div>
            <div className="min-w-0 max-w-full">
              <svg width={pw} height={ph} viewBox={`0 0 ${W} ${H}`} className="block h-auto max-w-full rounded-[0.1875rem] shadow-[0_0_0_0.0625rem_rgba(16,24,40,.18),0_0.625rem_1.875rem_-0.75rem_rgba(16,24,40,.35)]" role="img" aria-label={`${surface} layout`}>
                <rect x={0} y={0} width={W} height={H} fill={g} />
                {r.pieces.map((p, i) => (
                  <rect
                    key={i}
                    x={p.x}
                    y={H - p.y - p.h}
                    width={p.w}
                    height={p.h}
                    fill={p.sliver ? '#fdd8d4' : p.cutW || p.cutH ? shade(color, -0.07) : color}
                    stroke={p.sliver ? '#d92d20' : g}
                    strokeWidth={p.sliver ? Math.max(0.25, 1.6 / k) : Math.max(j, 1.3 / k)}
                  />
                ))}
                {/* cut sizes on the edge pieces, where they fit */}
                {r.pieces.filter((p) => (p.cutW && (p.x === 0 || p.x + p.w >= W - 0.01)) || (p.cutH && (p.y === 0 || p.y + p.h >= H - 0.01))).filter((p) => p.w * k > 30 && p.h * k > 16).map((p, i) => (
                  <text key={'t' + i} x={p.x + p.w / 2} y={H - p.y - p.h / 2} fontSize={10.5 / k} fontWeight={700} textAnchor="middle" dominantBaseline="middle" fill={p.sliver ? '#b42318' : '#6b6255'} style={{ fontFamily: 'Inter, sans-serif' }}>
                    {p.cutW && p.cutH ? `${ftIn(p.w)} × ${ftIn(p.h)}` : ftIn(p.cutW ? p.w : p.h)}
                  </text>
                ))}
                {td.mosaic && r.pieces.map((p, i) => <rect key={'m' + i} x={p.x} y={H - p.y - p.h} width={p.w} height={p.h} fill="url(#hexdots)" />)}
                <defs>
                  <pattern id="hexdots" width="2" height="2" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.8" fill="none" stroke={g} strokeWidth="0.12" /></pattern>
                </defs>
              </svg>
              {/* width label */}
              <div className="mt-2 flex max-w-full items-center gap-2 text-[0.75rem] font-semibold tnum text-muted" style={{ width: pw }}>
                <span className="h-px flex-1 bg-[#c8ced8]" />{ftIn(W)}<span className="sm:hidden"> × {ftIn(H)}</span><span className="h-px flex-1 bg-[#c8ced8]" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[0.78125rem] text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />Full tile</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: shade(color, -0.06), boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />Cut</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm border border-bad-600 bg-[#fdd8d4]" />Sliver — too thin</span>
            <span>{isWall ? 'Floor at the bottom' : 'Door at the bottom'}</span>
          </div>
        </div>

        <aside className="flex flex-col gap-4 border-l border-line px-5 py-4 max-lg:border-l-0 max-lg:border-t">
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink">Size</div>
            <div className="grid grid-cols-2 gap-2">
              <Inch label="Width" value={W} onChange={setW} />
              <Inch label={isWall ? 'Height' : 'Length'} value={H} onChange={setH} />
            </div>
            {!x.dims && <div className="mt-1 text-[0.75rem] text-muted">Worked out from {x.sf} SF — type in what you measure</div>}
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink">Pattern</div>
            <div className="flex flex-wrap gap-1.5">{PATTERNS.map((p) => <Chip key={p.key} on={pattern === p.key} onClick={() => setPattern(p.key)} className="h-8 px-2.5 text-[0.8125rem]">{p.label}</Chip>)}</div>
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] font-semibold text-ink">Where to start</div>
            <div className="flex flex-col gap-1.5">
              {options.map(({ k: key, r: rr }) => (
                <button key={key} onClick={() => setStart(key)} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition', start === key ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-100' : 'border-line hover:border-brand-200')}>
                  {key === 'best' ? <Sparkles className="h-4 w-4 shrink-0 text-vio-600" /> : <Ruler className="h-4 w-4 shrink-0 text-muted" />}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[0.84375rem] font-semibold text-ink">{startLabel[key]}</span>
                    <span className={cn('block text-[0.75rem]', rr.slivers ? 'font-semibold text-bad-600' : 'text-muted')}>{rr.slivers ? `${rr.slivers} slivers` : `Smallest cut ${rr.smallest ? ftIn(rr.smallest) : '—'}`}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-[0.8125rem] font-semibold text-ink">Grout</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(GROUTS).map(([key, gg]) => (
                <button key={key} onClick={() => setGrout(key)} aria-label={gg.name} title={gg.name} className={cn('h-8 w-8 rounded-full shadow-[inset_0_0_0_0.0625rem_rgba(16,24,40,.15)] transition', grout === key && 'ring-2 ring-brand-600 ring-offset-2')} style={{ background: gg.color }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-wash p-3.5">
            <dl className="flex flex-col gap-1.5 text-[0.84375rem]">
              <div className="flex justify-between"><dt className="text-muted">Full tiles</dt><dd className="font-semibold tnum text-ink">{r.full}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Cut tiles</dt><dd className="font-semibold tnum text-ink">{r.cut}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Smallest cut</dt><dd className="font-semibold tnum text-ink">{r.smallest ? ftIn(r.smallest) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Slivers</dt><dd className={cn('font-semibold tnum', r.slivers ? 'text-bad-600' : 'text-ok-700')}>{r.slivers ? r.slivers : 'None'}</dd></div>
              <div className="mt-1 flex justify-between border-t border-line-2 pt-1.5"><dt className="text-muted">{td.mosaic ? 'Sheets' : 'Tiles'} with 10% waste</dt><dd className="font-bold tnum text-ink">{buy}</dd></div>
            </dl>
          </div>
          {r.slivers > 0 && start !== 'best' && (
            <button onClick={() => setStart('best')} className="flex items-start gap-2 rounded-xl border border-bad-100 bg-bad-50 px-3 py-2.5 text-left text-[0.8125rem] text-ink-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-bad-600" /><span><b className="font-semibold text-bad-700">Slivers on this start.</b> The best start avoids them — tap to use it.</span>
            </button>
          )}
        </aside>
      </div>
    </Modal>
  )
}
function Inch({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [v, setV] = React.useState(String(value))
  React.useEffect(() => setV(String(value)), [value])
  return (
    <label className="block">
      <span className="text-[0.75rem] font-medium text-muted">{label}</span>
      <span className="relative mt-1 flex items-center">
        <input
          inputMode="decimal"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={() => { const n = Number(v.replace(/[^0-9.]/g, '')); if (n >= 6 && n <= 1200) onChange(n); else setV(String(value)) }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="h-9 w-full rounded-lg border border-line bg-white pl-2.5 pr-14 text-[0.875rem] tnum text-ink focus:border-brand-300 focus:outline-none focus:ring-[0.1875rem] focus:ring-brand-50"
        />
        <span className="pointer-events-none absolute right-2.5 text-[0.75rem] text-muted">in · {ftIn(value)}</span>
      </span>
    </label>
  )
}
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)))
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((c) => c.toString(16).padStart(2, '0')).join('')
}
