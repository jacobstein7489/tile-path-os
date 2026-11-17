/* Set up projects — for now, while the projects that were already going get put in. Every open project on one list,
 * the same kind of list as Projects and Estimates: where it stands, and what's still missing on it (the client, the
 * installer, the site manager, the start, the estimate, the tile paperwork) — so it's plain what's done and what isn't.
 * Tap one: its window — fill in what's missing, upload its estimate and tile paperwork (AI fills in the rooms and the
 * tiles), Save. It's ticked here. "Go through them one by one" does them in a row. Once every one is set up, the page
 * leaves the menu by itself. */
import * as React from 'react'
import { Check, ChevronRight, ListChecks } from 'lucide-react'
import { useStore, type Store } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Page, Group, EmptyState, HEAD_ROW, STICKY_HEAD, PX } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import type { Job } from '@/tileos/data/model'
import { allOpenList, missingOf } from './catchup'
import { standOf } from './projectlist'

/** what's still missing on a project — the people and dates, and its papers: no rooms yet (the estimate), no tiles yet
 *  (the tile paperwork) */
export function setupMissing(s: Store, j: Job): string[] {
  const out = missingOf(s, j)
  if (!(s.rooms[j.id] || []).length) out.push('estimate')
  if (!Object.keys(s.tiles[j.id] || {}).length) out.push('tile paperwork')
  return out
}
/** how many open projects aren't set up yet — the number next to it in the menu */
export const setupLeft = (s: Store) => allOpenList(s).filter((j) => !j.caughtUp).length
/** the menu has it while any open project isn't set up (the admin) */
export const setupOn = (s: Store) => (s.role === 'owner' || s.role === 'pm') && setupLeft(s) > 0

const COLS = { '--list': 'minmax(0,1.1fr) minmax(0,1fr) minmax(0,1.5fr) 8.5rem' } as React.CSSProperties
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1)

export function SetupPage() {
  const s = useStore()
  const jobs = allOpenList(s)
  const todo = jobs.filter((j) => !j.caughtUp)
  const done = jobs.filter((j) => j.caughtUp)
  const pct = jobs.length ? Math.round((done.length / jobs.length) * 100) : 100
  const row = (j: Job) => {
    const miss = setupMissing(s, j)
    const ok = !!j.caughtUp
    const st = standOf(s, j)
    return (
      <div key={j.id} role="button" tabIndex={0} onClick={() => s.open({ t: 'catchup', id: j.id, papers: true })} onKeyDown={(e) => { if (e.key === 'Enter') s.open({ t: 'catchup', id: j.id, papers: true }) }}
        className={cn('min-h-[3rem] cursor-pointer items-center border-t border-line-2 transition-colors row-hover max-md:flex max-md:gap-3 max-md:py-2.5 md:grid md:gap-x-6 md:py-1.5', PX)} data-subrow data-setup-row={j.id} data-set={ok ? '1' : '0'}>
        <div className="flex min-w-0 items-center gap-3 max-md:flex-1">
          <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full', ok ? 'bg-[#e6f4ec] text-[#2c8a5b]' : 'border-2 border-[#d9d3c9]')}>{ok && <Check className="h-3.5 w-3.5" strokeWidth={3} />}</span>
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] text-ink" data-setup-name>{j.name}</span>
            {/* a phone: what's missing under the name */}
            <span className={cn('block truncate text-[0.8125rem] md:hidden', miss.length ? 'font-medium text-warn-700' : 'text-muted')}>{miss.length ? `Missing: ${miss.join(', ')}` : st.text}</span>
          </span>
        </div>
        <div className="min-w-0 truncate text-[0.875rem] text-muted max-md:hidden" data-setup-stand>{st.text}</div>
        <div className={cn('min-w-0 truncate text-[0.875rem] max-md:hidden', miss.length ? 'font-medium text-warn-700' : 'text-muted')} data-setup-missing={miss.join(',')}>{miss.length ? cap(miss.join(' · ')) : 'Nothing missing'}</div>
        <div className="flex shrink-0 items-center justify-end gap-1 text-[0.8125rem]" data-setup-state>
          {ok ? <span className="font-medium text-[#2c8a5b]">Set up</span> : <span className="font-semibold text-brand-700">Set it up</span>}
          <ChevronRight className="h-4 w-4 text-faint" />
        </div>
      </div>
    )
  }
  return (
    <Page
      title="Set up projects"
      sub="Every open project — what’s still missing on each. Tap one, fill it in, upload its papers, Save."
      actions={todo.length > 0 ? <Button variant="primary" icon={<ListChecks />} onClick={() => s.open({ t: 'catchup', all: true })} data-setup-go>Go through them one by one</Button> : undefined}
      top={
        <div className="flex items-center gap-3 text-[0.9375rem]" data-setup-progress>
          <span className="font-semibold text-ink tnum" data-setup-count>{done.length} of {jobs.length} set up</span>
          <span className="h-2 w-48 overflow-hidden rounded-full bg-[#ece8e1] max-sm:w-24" aria-hidden><span className="block h-full rounded-full bg-[#2c8a5b] transition-[width]" style={{ width: `${pct}%` }} /></span>
        </div>
      }
    >
      <div data-even-list style={COLS} data-setup-list>
        {jobs.length > 0 && (
          <div className={cn(HEAD_ROW, 'px-5 md:grid md:gap-x-6', STICKY_HEAD, 'max-md:hidden')} data-list-head data-subrow>
            <span>Project</span><span>Where it stands</span><span>Still missing</span><span className="text-right">Set up</span>
          </div>
        )}
        {todo.length > 0 && <section><Group label="Not set up yet" count={todo.length} />{todo.map(row)}</section>}
        {done.length > 0 && <section><Group label="Set up" count={done.length} />{done.map(row)}</section>}
        {!jobs.length && <EmptyState icon={<Check />} title="No open projects" sub="Projects that are going show here to be set up." />}
      </div>
    </Page>
  )
}
