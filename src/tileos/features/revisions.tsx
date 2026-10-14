/* Every revision of an estimate, and what changed each time — newest first, in plain words:
 * why it was revised, who asked, the new total and the difference, and the lines that were added, removed or
 * changed. Compare any two revisions side by side. */
import * as React from 'react'
import { ArrowRight, GitCompareArrows, Plus, Minus, PenLine, ChevronDown, ChevronRight, MessageSquareQuote } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, Avatar } from '@/tileos/components/ui/core'
import { Status } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney } from '@/tileos/data/model'
import { revTotal, type Estimate, type EstLine, type EstRev } from '@/tileos/data/estimates'

type Item = { id: string; name: string; unit: string }
export type LineDiff = { key: string; area: string; name: string; unit: string; a?: EstLine; b?: EstLine; kind: 'added' | 'removed' | 'changed' | 'same'; delta: number }

const amt = (l?: EstLine) => (l ? l.qty * l.rate : 0)
const lineKey = (l: EstLine) => `${l.area}|${l.itemId}|${l.surface || ''}|${l.tile || ''}`

/** match the lines of two revisions by room and item, and say what happened to each */
export function diffRevs(items: Item[], A: EstRev | undefined, B: EstRev): LineDiff[] {
  const name = (l: EstLine) => l.desc || items.find((i) => i.id === l.itemId)?.name || l.itemId
  const unit = (l: EstLine) => items.find((i) => i.id === l.itemId)?.unit || ''
  const left = [...(A?.lines || [])]
  const out: LineDiff[] = []
  B.lines.forEach((b) => {
    const i = left.findIndex((a) => lineKey(a) === lineKey(b))
    const a = i >= 0 ? left.splice(i, 1)[0] : undefined
    const kind = !a ? 'added' : a.qty !== b.qty || a.rate !== b.rate ? 'changed' : 'same'
    out.push({ key: lineKey(b) + out.length, area: b.area, name: name(b), unit: unit(b), a, b, kind, delta: amt(b) - amt(a) })
  })
  left.forEach((a) => out.push({ key: lineKey(a) + 'x' + out.length, area: a.area, name: name(a), unit: unit(a), a, kind: 'removed', delta: -amt(a) }))
  return out
}

const money = (n: number) => fmtMoney(n)
const signed = (n: number) => (n === 0 ? '±$0' : `${n > 0 ? '+' : '−'}${fmtMoney(Math.abs(n))}`)
const qty = (l: EstLine, unit: string) => `${l.qty.toLocaleString('en-US')} ${unit === 'LS' ? '' : unit}`.trim()

/** one change as a sentence */
function sentence(d: LineDiff): React.ReactNode {
  if (d.kind === 'added') return <>Added <b className="font-semibold text-ink">{d.area} · {d.name}</b> — {qty(d.b!, d.unit)} at {money(d.b!.rate)}</>
  if (d.kind === 'removed') return <>Removed <b className="font-semibold text-ink">{d.area} · {d.name}</b> — {qty(d.a!, d.unit)}</>
  const parts: string[] = []
  if (d.a!.qty !== d.b!.qty) parts.push(`${qty(d.a!, d.unit)} → ${qty(d.b!, d.unit)}`)
  if (d.a!.rate !== d.b!.rate) parts.push(`${d.unit === 'LS' ? '' : 'rate '}${money(d.a!.rate)} → ${money(d.b!.rate)}`)
  return <><b className="font-semibold text-ink">{d.area} · {d.name}</b>: {parts.join(', ')}</>
}
const ICON = { added: <Plus className="h-3 w-3" strokeWidth={3} />, removed: <Minus className="h-3 w-3" strokeWidth={3} />, changed: <PenLine className="h-3 w-3" strokeWidth={2.5} />, same: null }
const TONE = { added: 'bg-ok-50 text-ok-700', removed: 'bg-bad-50 text-bad-600', changed: 'bg-warn-50 text-warn-700', same: '' }

export function RevisionsPanel({ e, onShow }: { e: Estimate; onShow: (n: number) => void }) {
  const s = useStore()
  const [cmp, setCmp] = React.useState<[number, number] | null>(null)
  const revs = e.revs
  const first = revs[0]
  const last = revs[revs.length - 1]
  if (cmp) return <Compare e={e} a={cmp[0]} b={cmp[1]} onPick={(a, b) => setCmp([a, b])} onBack={() => setCmp(null)} />
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[0.75rem] border border-line bg-wash px-4 py-3">
        <span className="text-[0.875rem] text-ink-2"><b className="font-semibold text-ink">{revs.length} revisions</b> · first sent {first.sentOn || first.date} at {money(revTotal(first))} · now {money(revTotal(last))} <span className={cn('font-semibold', revTotal(last) < revTotal(first) ? 'text-bad-600' : 'text-ok-700')}>({signed(revTotal(last) - revTotal(first))})</span></span>
        <Button size="sm" className="ml-auto" icon={<GitCompareArrows />} onClick={() => setCmp([first.n, last.n])}>Compare two</Button>
      </div>
      <ol className="relative">
        {[...revs].reverse().map((r, i, arr) => {
          const prev = revs.find((x) => x.n === r.n - 1)
          const diffs = prev ? diffRevs(s.items, prev, r).filter((d) => d.kind !== 'same') : []
          const delta = prev ? revTotal(r) - revTotal(prev) : 0
          return (
            <li key={r.n} className="relative pb-4 pl-9 last:pb-0">
              {i < arr.length - 1 && <span className="absolute bottom-0 left-[0.8125rem] top-7 w-px bg-line" />}
              <span className={cn('absolute left-0 top-0.5 inline-flex h-[1.6875rem] w-[1.6875rem] items-center justify-center rounded-full text-[0.75rem] font-semibold tnum', r === last ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 ring-1 ring-line')}>{r.n}</span>
              <div className="rounded-[0.75rem] border border-line bg-white">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3">
                  <span className="text-[0.90625rem] font-semibold text-ink">Revision {r.n}</span>
                  <Status tone={r.status === 'draft' ? 'warn' : r.status === 'sent' ? 'info' : r.status === 'approved' ? 'ok' : 'neutral'}>{r.status === 'draft' ? 'Being priced' : r.status === 'sent' ? `Sent ${r.sentOn}` : r.status === 'approved' ? 'Approved' : `Sent ${r.sentOn || r.date} · replaced`}</Status>
                  <span className="ml-auto text-right">
                    <span className="text-[0.9375rem] font-semibold tnum text-ink">{money(revTotal(r))}</span>
                    {prev && <span className={cn('ml-2 text-[0.8125rem] font-semibold tnum', delta < 0 ? 'text-bad-600' : delta > 0 ? 'text-ok-700' : 'text-muted')}>{signed(delta)}</span>}
                  </span>
                </div>
                <div className="mt-1 px-4 text-[0.84375rem] text-ink-2">{r.what}</div>
                {(r.asked || r.by) && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 text-[0.78125rem] text-muted">
                    {r.asked && <span className="inline-flex items-center gap-1"><MessageSquareQuote className="h-3.5 w-3.5" />{r.asked}</span>}
                    {r.by && <span className="inline-flex items-center gap-1.5"><Avatar who={r.by} size={16} />Priced by {PEOPLE[r.by]?.short}</span>}
                  </div>
                )}
                {diffs.length > 0 && (
                  <ul className="mx-4 mt-2.5 flex flex-col gap-1.5 border-t border-line-2 pt-2.5">
                    {diffs.map((d) => (
                      <li key={d.key} className="flex items-start gap-2 text-[0.8125rem] text-ink-2">
                        <span className={cn('mt-[0.0625rem] inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full', TONE[d.kind])}>{ICON[d.kind]}</span>
                        <span className="min-w-0 flex-1">{sentence(d)}</span>
                        <span className={cn('shrink-0 font-semibold tnum', d.delta < 0 ? 'text-bad-600' : 'text-ok-700')}>{signed(d.delta)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!prev && <div className="mx-4 mt-2.5 border-t border-line-2 pt-2.5 text-[0.8125rem] text-muted">{r.lines.length} lines — the starting point.</div>}
                <div className="flex flex-wrap gap-1 px-2.5 py-2">
                  <Button size="xs" variant="ghost" onClick={() => onShow(r.n)}>See its lines</Button>
                  {prev && <Button size="xs" variant="ghost" icon={<GitCompareArrows />} onClick={() => setCmp([prev.n, r.n])}>Side by side with {prev.n}</Button>}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function Compare({ e, a, b, onPick, onBack }: { e: Estimate; a: number; b: number; onPick: (a: number, b: number) => void; onBack: () => void }) {
  const s = useStore()
  const [showSame, setShowSame] = React.useState(false)
  const A = e.revs.find((r) => r.n === a)!
  const B = e.revs.find((r) => r.n === b)!
  const diffs = diffRevs(s.items, A, B)
  const changed = diffs.filter((d) => d.kind !== 'same')
  const same = diffs.filter((d) => d.kind === 'same')
  const cell = (l: EstLine | undefined, unit: string, strike?: boolean, hi?: boolean) => l ? (
    <span className={cn('block text-right', strike && 'text-muted line-through decoration-bad-300')}>
      <span className={cn('block text-[0.84375rem] font-semibold tnum', hi ? 'text-warn-700' : 'text-ink')}>{money(amt(l))}</span>
      <span className="block text-[0.75rem] tnum text-muted">{qty(l, unit)} × {money(l.rate)}</span>
    </span>
  ) : <span className="block text-right text-[0.8125rem] text-faint">—</span>
  const Pick = ({ v, set, other }: { v: number; set: (n: number) => void; other: number }) => (
    <span className="inline-flex items-center gap-1">
      {e.revs.map((r) => <button key={r.n} disabled={r.n === other} onClick={() => set(r.n)} className={cn('inline-flex h-8 min-w-8 items-center justify-center rounded-[0.5rem] border px-2 text-[0.8125rem] font-semibold tnum transition disabled:opacity-30', v === r.n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink-2 hover:bg-wash')}>{r.n}</button>)}
    </span>
  )
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button onClick={onBack} className="text-[0.8125rem] font-semibold text-brand-600 hover:text-brand-700">← All revisions</button>
        <span className="ml-auto flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted">Compare <Pick v={a} other={b} set={(n) => onPick(n, b)} /> <ArrowRight className="h-4 w-4" /> <Pick v={b} other={a} set={(n) => onPick(a, n)} /></span>
      </div>
      <div className="overflow-hidden rounded-[0.75rem] border border-line">
        <div className="grid grid-cols-[minmax(0,1fr)_8.75rem_8.75rem_6.875rem] items-end gap-3 border-b border-line bg-wash px-4 py-2 text-[0.75rem] font-semibold text-muted">
          <span>Line</span><span className="text-right">Revision {a}<span className="block font-normal">{A.sentOn || A.date}</span></span><span className="text-right">Revision {b}<span className="block font-normal">{B.sentOn || B.date}</span></span><span className="text-right">Change</span>
        </div>
        {changed.map((d) => (
          <div key={d.key} className={cn('grid grid-cols-[minmax(0,1fr)_8.75rem_8.75rem_6.875rem] items-center gap-3 border-b border-line-2 px-4 py-2.5', d.kind === 'added' ? 'bg-ok-50/50' : d.kind === 'removed' ? 'bg-bad-50/50' : 'bg-warn-50/40')}>
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn('inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full', TONE[d.kind])}>{ICON[d.kind]}</span>
              <span className="min-w-0"><span className={cn('block truncate text-[0.84375rem] font-semibold', d.kind === 'removed' ? 'text-muted line-through' : 'text-ink')}>{d.name}</span><span className="block truncate text-[0.75rem] text-muted">{d.area} · {d.kind === 'added' ? 'new' : d.kind === 'removed' ? 'taken out' : 'changed'}</span></span>
            </span>
            {cell(d.a, d.unit, d.kind === 'removed')}
            {cell(d.b, d.unit, false, d.kind === 'changed')}
            <span className={cn('text-right text-[0.84375rem] font-semibold tnum', d.delta < 0 ? 'text-bad-600' : 'text-ok-700')}>{signed(d.delta)}</span>
          </div>
        ))}
        {!changed.length && <div className="px-4 py-6 text-center text-[0.84375rem] text-muted">No differences.</div>}
        {same.length > 0 && (
          <>
            <button onClick={() => setShowSame((x) => !x)} className="flex w-full items-center gap-1.5 border-b border-line-2 px-4 py-2 text-left text-[0.78125rem] font-semibold text-muted hover:bg-wash">
              {showSame ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{same.length} line{same.length > 1 ? 's' : ''} the same
            </button>
            {showSame && same.map((d) => (
              <div key={d.key} className="grid grid-cols-[minmax(0,1fr)_8.75rem_8.75rem_6.875rem] items-center gap-3 border-b border-line-2 px-4 py-2 text-muted">
                <span className="min-w-0 truncate pl-[1.625rem] text-[0.8125rem]">{d.area} · {d.name}</span>
                {cell(d.a, d.unit)}{cell(d.b, d.unit)}<span className="text-right text-[0.8125rem]">—</span>
              </div>
            ))}
          </>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_8.75rem_8.75rem_6.875rem] items-center gap-3 bg-wash px-4 py-2.5">
          <span className="text-[0.84375rem] font-semibold text-ink">Total</span>
          <span className="text-right text-[0.875rem] font-semibold tnum text-ink">{money(revTotal(A))}</span>
          <span className="text-right text-[0.875rem] font-semibold tnum text-ink">{money(revTotal(B))}</span>
          <span className={cn('text-right text-[0.875rem] font-semibold tnum', revTotal(B) - revTotal(A) < 0 ? 'text-bad-600' : 'text-ok-700')}>{signed(revTotal(B) - revTotal(A))}</span>
        </div>
      </div>
      <div className="mt-3 text-[0.78125rem] text-muted">Revision {b}: {B.what}{B.asked ? ` · ${B.asked}` : ''}</div>
    </div>
  )
}
