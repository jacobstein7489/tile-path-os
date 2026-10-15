/* + : everything you can start or log, as colored tiles. Pick one and its window opens right here. */
import * as React from 'react'
import {
  FileText, Building2, ListTodo, CalendarPlus, Sparkles, Wrench, ContactRound, PackageCheck,
  MessageCircleQuestion, ArrowLeftRight, PackageX, Truck, Gavel, Phone, ClipboardList, Wallet,
} from 'lucide-react'
import { useStore, type Modal as M } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'

export const TILE_COLORS = {
  blue: { solid: '#2f5bd8', tint: '#f0f4fe', line: '#d9e2f9' },
  violet: { solid: '#7357d6', tint: '#f5f2fe', line: '#e3dcf8' },
  indigo: { solid: '#4f55d0', tint: '#f1f1fd', line: '#dcddf7' },
  cyan: { solid: '#1586a8', tint: '#ecf7fa', line: '#cde8f0' },
  amber: { solid: '#d1870f', tint: '#fdf6e9', line: '#f3e2c0' },
  rose: { solid: '#d0456f', tint: '#fdf0f4', line: '#f5d6e0' },
  teal: { solid: '#15897a', tint: '#ebf7f5', line: '#cce9e4' },
  orange: { solid: '#d9631e', tint: '#fdf2eb', line: '#f5dac8' },
  red: { solid: '#cf3d2e', tint: '#fdf0ee', line: '#f4d3ce' },
  green: { solid: '#22894f', tint: '#edf7f1', line: '#cde9d8' },
  slate: { solid: '#5b6575', tint: '#f3f4f6', line: '#dfe2e7' },
} as const
export type TileColor = keyof typeof TILE_COLORS

/** one colored option — a solid icon on a soft tint of the same color */
export function ColorTile({ label, hint, icon: I, color, onClick, selected }: { label: string; hint?: string; icon: React.ElementType; color: TileColor; onClick: () => void; selected?: boolean }) {
  const c = TILE_COLORS[color]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('group flex min-h-[5.75rem] flex-col items-start gap-2 rounded-[0.8125rem] border p-3 text-left transition duration-150 hover:-translate-y-px hover:shadow-[0_0.5rem_1.125rem_-0.625rem_rgba(20,26,36,.28)] max-sm:min-h-0 max-sm:flex-row max-sm:items-center max-sm:gap-2.5 max-sm:p-2.5', selected && 'ring-2')}
      style={{ background: c.tint, borderColor: c.line, ...(selected ? ({ '--tw-ring-color': c.solid } as React.CSSProperties) : {}) }}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.625rem] text-white shadow-[0_0.125rem_0.375rem_-0.125rem_rgba(0,0,0,.28)] max-sm:h-8 max-sm:w-8" style={{ background: c.solid }}>
        <I className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.84375rem] font-semibold leading-tight text-ink max-sm:text-[0.8125rem]">{label}</span>
        {hint && <span className="mt-0.5 line-clamp-2 block text-[0.75rem] leading-snug text-[#5b6372] max-sm:hidden">{hint}</span>}
      </span>
    </button>
  )
}

type Pick = { l: string; h: string; i: React.ElementType; c: TileColor; m: M; hide?: boolean }

export function NewPickerModal({ level }: { level: number }) {
  const s = useStore()
  const acct = s.role === 'accounting'
  const start: Pick[] = [
    { l: 'New estimate', h: 'Areas, takeoff, review, send', i: FileText, c: 'blue', m: { t: 'newreq' }, hide: acct },
    { l: 'New project', h: 'Work that’s already won', i: Building2, c: 'violet', m: { t: 'newproject' }, hide: acct },
    { l: 'New task', h: 'Something someone has to do', i: ListTodo, c: 'indigo', m: { t: 'newtask' } },
    { l: 'Meeting or walkthrough', h: 'On the agenda with a day and a time', i: CalendarPlus, c: 'cyan', m: { t: 'record', type: 'meeting' }, hide: acct },
    { l: 'Touch-ups / punch list', h: 'A list for a crew, with a due date', i: Sparkles, c: 'amber', m: { t: 'punchnew' }, hide: acct },
    { l: 'Repair', h: 'A callback or warranty fix', i: Wrench, c: 'rose', m: { t: 'newrepair' }, hide: acct },
    { l: 'New client', h: 'A GC, builder or homeowner', i: ContactRound, c: 'teal', m: { t: 'newclient' } },
    { l: 'Purchase order', h: 'Materials from a supplier', i: PackageCheck, c: 'orange', m: { t: 'newpo' }, hide: acct },
  ]
  const log: Pick[] = [
    { l: 'Site issue or question', h: 'Something on site needs an answer', i: MessageCircleQuestion, c: 'amber', m: { t: 'record', type: 'question' }, hide: acct },
    { l: 'Client asked for a change', h: 'Height, tile, layout or extra work', i: ArrowLeftRight, c: 'violet', m: { t: 'record', type: 'change' }, hide: acct },
    { l: 'Short, wrong or damaged', h: 'The crew can’t finish with what’s there', i: PackageX, c: 'red', m: { t: 'record', type: 'shortage' }, hide: acct },
    { l: 'Delivery arrived', h: 'Tile or materials landed on site', i: Truck, c: 'teal', m: { t: 'record', type: 'delivery' }, hide: acct },
    { l: 'Decision made', h: 'The designer, GC or client answered', i: Gavel, c: 'indigo', m: { t: 'record', type: 'decision' }, hide: acct },
    { l: 'Call or follow-up', h: 'Spoke with someone, or no answer', i: Phone, c: 'cyan', m: { t: 'record', type: 'call' } },
    { l: 'Daily update', h: 'What the crew tiled today', i: ClipboardList, c: 'orange', m: { t: 'record', type: 'daily' }, hide: acct },
    { l: 'Payment received', h: 'A check or transfer came in', i: Wallet, c: 'green', m: { t: 'record', type: 'payment' } },
  ]
  const Section = ({ label, items }: { label: string; items: Pick[] }) => {
    const shown = items.filter((x) => !x.hide)
    if (!shown.length) return null
    return (
      <section>
        <div className="mb-2 text-[0.78125rem] font-semibold text-muted">{label}</div>
        <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-3 max-sm:grid-cols-2 max-sm:gap-2">
          {shown.map((x) => <ColorTile key={x.l} label={x.l} hint={x.h} icon={x.i} color={x.c} onClick={() => s.swap(x.m)} />)}
        </div>
      </section>
    )
  }
  return (
    <Modal level={level} size="lg" onClose={s.close} title="What do you want to do?" sub="Start something new, or log something that happened">
      <div className="flex flex-col gap-5">
        <Section label="Start something" items={start} />
        <Section label="Log what happened" items={log} />
      </div>
    </Modal>
  )
}
