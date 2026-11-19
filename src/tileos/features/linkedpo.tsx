/* What a to-do is about, right in its window — never just its name. "PO-1052 · get Infinity's confirmation" shows the
 * order itself: the store, each tile with its picture and how much, when it's needed — and Open the PO. "Alex to
 * accept PO-1047" shows his PO: his circle, the number, what we pay him. */
import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Avatar } from '@/tileos/components/ui/core'
import { TileImg } from '@/tileos/components/ui/swatch'
import { PEOPLE, fmtMoney } from '@/tileos/data/model'
import type { Task } from '@/tileos/data/work'
import { cn } from '@/tileos/lib/utils'

/** the PO a to-do is about, from its action ("po:PO-1052", "ipo:IPO-119", "ipoaccept:IPO-119") */
export function poOfTask(t: Task): { t: 'po' | 'ipo'; id: string } | null {
  const k = t.action?.kind || ''
  const m = /^(po|ipo|ipoaccept):(.+)$/.exec(k)
  if (!m) return null
  return { t: m[1] === 'po' ? 'po' : 'ipo', id: m[2] }
}

const BOX = 'overflow-hidden rounded-xl border border-line bg-white'
const HEAD = 'flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-wash/60'

/** the order, as it went to the store: each line with its tile's picture and how much */
export function LinkedPO({ t }: { t: Task }) {
  const s = useStore()
  const ref = poOfTask(t)
  if (!ref) return null
  if (ref.t === 'ipo') {
    const p = s.ipos.find((x) => x.id === ref.id)
    if (!p) return null
    const total = p.lines.reduce((n, l) => n + (l.amount || 0), 0)
    return (
      <div className={BOX} data-linked-po={p.id}>
        <button type="button" onClick={() => s.open({ t: 'ipo', id: p.id })} className={HEAD}>
          <Avatar who={p.crew} size={30} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold text-ink">{PEOPLE[p.crew]?.name} · {p.id}</span>
            <span className={cn('block text-[0.8125rem]', p.status === 'Accepted' ? 'text-ok-700' : p.status === 'Rejected' ? 'text-bad-600' : 'text-warn-700')}>{p.status === 'Accepted' ? `Accepted ${p.date}` : p.status === 'Rejected' ? 'He said no' : p.status === 'Sent' ? `Sent. Waiting for his yes` : 'Not sent yet'}{total ? ` · ${fmtMoney(total)}` : ''}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[0.8125rem] font-semibold text-brand-700">Open his PO<ChevronRight className="h-4 w-4" /></span>
        </button>
      </div>
    )
  }
  const p = s.pos.find((x) => x.id === ref.id)
  if (!p) return null
  const tiles = s.tiles[p.jobId] || {}
  return (
    <div className={BOX} data-linked-po={p.id}>
      <button type="button" onClick={() => s.open({ t: 'po', id: p.id })} className={cn(HEAD, 'border-b border-line-2')}>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold text-ink">{p.id} · {p.supplier}</span>
          <span className="block truncate text-[0.8125rem] text-muted">{[p.eta, p.date ? `sent ${p.date}` : ''].filter(Boolean).join(' · ')}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[0.8125rem] font-semibold text-brand-700">Open the PO<ChevronRight className="h-4 w-4" /></span>
      </button>
      <ul className="flex flex-col" data-linked-lines>
        {p.lines.map((l, i) => {
          const tile = l.tag ? tiles[l.tag] : undefined
          return (
            <li key={i} className="flex min-h-12 items-center gap-3 border-t border-line-2 px-4 py-1.5 first:border-t-0">
              {tile ? <TileImg tile={tile} size={32} radius={6} /> : <span className="h-8 w-8 shrink-0 rounded-md bg-wash-2" aria-hidden />}
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-ink">{l.item}</span>
              <span className="shrink-0 text-[0.875rem] font-semibold tnum text-ink">{l.qty}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
