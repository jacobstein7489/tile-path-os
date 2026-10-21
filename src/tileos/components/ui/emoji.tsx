/* The emoji picker — every emoji, like WhatsApp: a search on top, the groups along a row of tabs, the ones you used
 * last first. Used to write a message and to react to one. */
import * as React from 'react'
import { Search, Clock3, Smile, PersonStanding, PawPrint, Apple, Plane, Volleyball, Lightbulb, Hash, Flag, X } from 'lucide-react'
import { cn } from '@/tileos/lib/utils'
import { EMOJI_GROUPS } from '@/tileos/data/emoji'

const KEY = 'tileos-emoji-recent'
const START = ['👍', '❤️', '😂', '🙏', '✅', '👌', '🔥', '😊', '👏', '💪', '🎉', '😅', '🤝', '👀', '😮', '😢']
function readRecent(): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) && v.length ? v.slice(0, 24) : START } catch { return START }
}
function keepRecent(e: string) {
  try { const list = [e, ...readRecent().filter((x) => x !== e)].slice(0, 24); localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* a private window — it still works, it just doesn't remember */ }
}
const ICONS: Record<string, React.ElementType> = { recent: Clock3, smileys: Smile, people: PersonStanding, nature: PawPrint, food: Apple, travel: Plane, activities: Volleyball, objects: Lightbulb, symbols: Hash, flags: Flag }

/** the six for a quick reaction, like WhatsApp */
export const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function EmojiPicker({ onPick, className, autoFocus }: { onPick: (e: string) => void; className?: string; autoFocus?: boolean }) {
  const [q, setQ] = React.useState('')
  const [recent, setRecent] = React.useState(readRecent)
  const [tab, setTab] = React.useState('recent')
  const box = React.useRef<HTMLDivElement>(null)
  const pick = (e: string) => { keepRecent(e); setRecent(readRecent()); onPick(e) }
  const groups = [{ key: 'recent', label: 'Used lately', list: recent.map((e) => [e, ''] as [string, string]) }, ...EMOJI_GROUPS]
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  /* the name first: "fire" finds 🔥 before the fire engine */
  const found = words.length
    ? EMOJI_GROUPS.flatMap((g) => g.list)
        .filter(([, w]) => words.every((x) => w.includes(x)))
        .map(([e, w], i) => { const name = w.split('|')[0]; const q = words.join(' '); return { e, w, i, rank: name === q ? 0 : name.startsWith(q) ? 1 : name.split(' ').some((x) => x.startsWith(words[0])) ? 2 : name.includes(q) ? 3 : 4 } })
        .sort((a, b) => a.rank - b.rank || a.i - b.i)
        .slice(0, 160)
        .map((x) => [x.e, x.w] as [string, string])
    : []
  /* the tab follows the group you scroll to; a tab scrolls to its group */
  const onScroll = () => {
    const el = box.current
    if (!el || words.length) return
    const heads = Array.from(el.querySelectorAll<HTMLElement>('[data-group]'))
    const top = el.scrollTop + 8
    let cur = 'recent'
    for (const h of heads) if (h.offsetTop - el.offsetTop <= top) cur = h.dataset.group || cur
    if (cur !== tab) setTab(cur)
  }
  const go = (k: string) => {
    setQ('')
    setTab(k)
    requestAnimationFrame(() => {
      const el = box.current
      const h = el?.querySelector<HTMLElement>(`[data-group="${k}"]`)
      if (el && h) el.scrollTop = h.offsetTop - el.offsetTop
    })
  }
  const cell = (e: string, w: string, i: number) => (
    <button key={e + i} type="button" title={w ? w.split('|')[0] : undefined} aria-label={w ? `Emoji ${w.split('|')[0]}` : `Emoji ${e}`} onClick={() => pick(e)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[1.375rem] leading-none transition hover:scale-110 hover:bg-wash">
      {e}
    </button>
  )
  return (
    <div className={cn('flex w-[21.5rem] max-w-[calc(100vw-1.5rem)] flex-col', className)} data-emoji-picker>
      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-2.5 h-4 w-4 text-faint" />
        <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emoji" aria-label="Search emoji" className="h-9 w-full rounded-lg border border-line bg-wash pl-8 pr-8 text-[0.875rem] text-ink outline-none placeholder:text-faint focus:border-brand-300 focus:bg-white" />
        {q && <button type="button" aria-label="Clear" onClick={() => setQ('')} className="absolute right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-faint hover:text-ink"><X className="h-3.5 w-3.5" /></button>}
      </label>
      <div className="mt-2 flex items-center justify-between border-b border-line-2 pb-1">
        {groups.map((g) => {
          const Ic = ICONS[g.key] || Smile
          const on = !words.length && tab === g.key
          return (
            <button key={g.key} type="button" aria-label={g.label} title={g.label} onClick={() => go(g.key)} className={cn('relative inline-flex h-8 w-8 items-center justify-center rounded-md transition', on ? 'text-brand-600' : 'text-faint hover:text-ink-2')}>
              <Ic className="h-[1.0625rem] w-[1.0625rem]" />
              {on && <span className="absolute -bottom-1 left-1.5 right-1.5 h-[0.1875rem] rounded-full bg-brand-600" />}
            </button>
          )
        })}
      </div>
      <div ref={box} onScroll={onScroll} className="scroll-soft relative mt-1 h-[16.5rem] overflow-y-auto pr-0.5">
        {words.length ? (
          found.length ? <div className="grid grid-cols-8 gap-0.5 pt-1">{found.map(([e, w], i) => cell(e, w, i))}</div> : <div className="py-10 text-center text-[0.8125rem] text-muted">No emoji for “{q}”</div>
        ) : (
          groups.map((g) => (
            <section key={g.key} data-group={g.key}>
              <div className="sticky top-0 z-[1] bg-white/95 px-1 pb-1 pt-2 text-[0.71875rem] font-semibold text-muted backdrop-blur-sm">{g.label}</div>
              <div className="grid grid-cols-8 gap-0.5">{g.list.map(([e, w], i) => cell(e, w, i))}</div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
