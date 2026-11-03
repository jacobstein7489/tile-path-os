/* Picking a metal edge, or how an edge is finished — taps, not typing:
 *   EdgePicker   None · Mitered · Metal · Bullnose · Pencil liner · Other — and for Metal, which one
 *   MetalPicker  the profile (JOLLY, RONDEC, QUADEC…), the finish (every color, with its swatch), the size, the piece */
import * as React from 'react'
import { cn } from '@/tileos/lib/utils'
import { TextInput } from '@/tileos/components/ui/core'
import {
  METAL_PROFILES, METAL_FINISHES, FINISH_GROUPS, METAL_PIECES, EDGE_KINDS, sizeLabel, profileOf, finishOf, parseMetal, metalText, edgeKind,
  type MetalSpec, type EdgeKind,
} from '@/tileos/data/catalog'

const CHIP = 'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[0.8125rem] font-medium transition'
const ON = 'border-brand-500 bg-brand-50 text-brand-700'
const OFF = 'border-line bg-white text-ink-2 hover:border-[#d1cbc0] hover:bg-wash'
const LBL = 'mb-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-muted'

/** the finish's color, as a little round sample */
export function FinishDot({ finish, size = 14 }: { finish?: string; size?: number }) {
  const f = finishOf(finish)
  return <span className="inline-block shrink-0 rounded-full ring-1 ring-black/15" style={{ width: size, height: size, background: f ? `linear-gradient(135deg, rgba(255,255,255,.55), transparent 55%), ${f.color}` : 'transparent' }} />
}

export function MetalPicker({ value, onChange, pieces }: { value: MetalSpec; onChange: (m: MetalSpec) => void; pieces?: boolean }) {
  const p = profileOf(value.profile)
  const sizes = p?.sizes || [6, 8, 10, 12.5]
  return (
    <div className="flex flex-col gap-3.5" data-metal-picker>
      <div>
        <div className={LBL}>Profile</div>
        <div className="flex flex-wrap gap-1.5">
          {METAL_PROFILES.map((x) => (
            <button key={x.key} type="button" title={x.use} data-metal-profile={x.key} onClick={() => onChange({ ...value, profile: x.key, size: value.size && x.sizes.includes(value.size) ? value.size : undefined })} className={cn(CHIP, value.profile === x.key ? ON : OFF)}>{x.short}</button>
          ))}
        </div>
        {p && <div className="mt-1.5 text-[0.78125rem] text-muted">{p.use}</div>}
      </div>
      <div>
        <div className={LBL}>Finish</div>
        <div className="flex flex-col gap-1.5">
          {FINISH_GROUPS.map((g) => (
            <div key={g} className="flex flex-wrap items-center gap-1.5">
              <span className="w-[6.25rem] shrink-0 text-[0.75rem] font-medium text-faint max-sm:w-full">{g}</span>
              {METAL_FINISHES.filter((f) => f.group === g).map((f) => (
                <button key={f.key} type="button" data-metal-finish={f.key} onClick={() => onChange({ ...value, finish: f.key })} className={cn(CHIP, 'pl-2', value.finish === f.key ? ON : OFF)}>
                  <FinishDot finish={f.key} />{f.name.replace(' (textured)', '')}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className={LBL}>Size — fits the tile’s thickness</div>
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((mm) => <button key={mm} type="button" data-metal-size={mm} onClick={() => onChange({ ...value, size: mm })} className={cn(CHIP, value.size === mm ? ON : OFF)}>{sizeLabel(mm)}</button>)}
        </div>
      </div>
      {pieces && (
        <div>
          <div className={LBL}>Piece</div>
          <div className="flex flex-wrap gap-1.5">
            {METAL_PIECES.map((x) => <button key={x} type="button" data-metal-piece={x} onClick={() => onChange({ ...value, piece: x })} className={cn(CHIP, (value.piece || METAL_PIECES[0]) === x ? ON : OFF)}>{x}</button>)}
          </div>
        </div>
      )}
    </div>
  )
}

/** what an edge is saved as — "Mitered", "Schluter JOLLY · Brushed nickel · 10 mm (3/8″)" */
export function edgeValue(kind: EdgeKind, m: MetalSpec, other: string) {
  if (kind === 'mitered') return 'Mitered'
  if (kind === 'bullnose') return 'Bullnose tile'
  if (kind === 'pencil') return 'Pencil liner'
  if (kind === 'other') return other.trim()
  if (kind === 'metal') return m.profile ? metalText(m) : ['Metal', finishOf(m.finish)?.name, m.size ? sizeLabel(m.size) : ''].filter(Boolean).join(' · ')
  return ''
}

/** how the open edges are finished — the one row in a wall or floor's window */
export function EdgePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [kind, setKind] = React.useState<EdgeKind>(() => edgeKind(value))
  const [metal, setMetal] = React.useState<MetalSpec>(() => parseMetal(value) || { profile: '', finish: '' })
  const [other, setOther] = React.useState(() => (edgeKind(value) === 'other' ? value : ''))
  const pick = (k: EdgeKind) => { setKind(k); onChange(edgeValue(k, metal, other)) }
  return (
    <div data-edge-picker>
      <div className="flex flex-wrap gap-1.5">
        {EDGE_KINDS.map((k) => <button key={k.key || 'none'} type="button" data-edge-kind={k.key || 'none'} onClick={() => pick(k.key)} className={cn(CHIP, kind === k.key ? ON : OFF)}>{k.label}</button>)}
      </div>
      {kind === 'metal' && (
        <div className="mt-3 rounded-[0.75rem] border border-line bg-[#faf9f7] p-3.5">
          <MetalPicker value={metal} onChange={(m) => { setMetal(m); onChange(edgeValue('metal', m, other)) }} />
        </div>
      )}
      {kind === 'other' && (
        <TextInput aria-label="The edge" value={other} onChange={(e) => { setOther(e.target.value); onChange(edgeValue('other', metal, e.target.value)) }} placeholder="e.g. marble saddle at the door" className="mt-2.5 h-10" />
      )}
    </div>
  )
}
