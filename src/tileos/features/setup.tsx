/* Set up projects — for now, while the projects that were already going get put in. Just the basics, so everything is
 * where it belongs and the app can be used: every open project on one list, the same kind of list as Projects and
 * Estimates — where it stands, and what's still missing of the basics (the client, the installer, the site manager,
 * the start). Tap one: its window — where it stands, who's on it, how far, the dates, on hold — Save. The papers
 * (the estimate, the tile paperwork — the rooms, the tiles, the layouts) aren't part of it: those are done later, on
 * the projects picked for it, on the project itself. A star puts a project on top. "Go through them one by one" does
 * them in a row. Once every one is set up, the page leaves the menu by itself. */
import * as React from 'react'
import { Check, ChevronRight, ListChecks } from 'lucide-react'
import { useStore, meOf, type Store } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Page, Group, EmptyState, HEAD_ROW, STICKY_HEAD, PX } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import type { Job } from '@/tileos/data/model'
import { allOpenList, missingOf } from './catchup'
import { standOf } from './projectlist'
import { StarButton, isStarred } from './star'

/** what's still missing on a project — of the basics only: the client, the installer, the site manager, the start (its
 *  papers aren't asked for here) */
export function setupMissing(s: Store, j: Job): string[] {
  return missingOf(s, j)
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
  const me = meOf(s.role)
  /* the starred ones on top, set up or not — then the rest */
  const starred = jobs.filter((j) => isStarred(j, me))
  const todo = jobs.filter((j) => !j.caughtUp && !isStarred(j, me))
  const done = jobs.filter((j) => j.caughtUp && !isStarred(j, me))
  const setN = jobs.filter((j) => j.caughtUp).length
  const pct = jobs.length ? Math.round((setN / jobs.length) * 100) : 100
  const row = (j: Job) => {
    const miss = setupMissing(s, j)
    const ok = !!j.caughtUp
    const st = standOf(s, j)
    return (
      <div key={j.id} role="button" tabIndex={0} onClick={() => s.open({ t: 'catchup', id: j.id })} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) s.open({ t: 'catchup', id: j.id }) }}
        className={cn('min-h-[3rem] cursor-pointer items-center border-t border-line-2 transition-colors row-hover max-md:flex max-md:gap-3 max-md:py-2.5 md:grid md:gap-x-6 md:py-1.5', PX)} data-subrow data-setup-row={j.id} data-set={ok ? '1' : '0'}>
        <div className="flex min-w-0 items-center gap-1.5 max-md:flex-1">
          {/* its star — on top of the list */}
          <StarButton j={j} className="-ml-2" />
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] text-ink" data-setup-name>{j.name}</span>
            {/* a phone: what's missing under the name */}
            <span className={cn('block truncate text-[0.8125rem] md:hidden', miss.length ? 'font-medium text-warn-700' : 'text-muted')}>{miss.length ? `Missing: ${miss.join(', ')}` : st.text}</span>
          </span>
        </div>
        <div className="min-w-0 truncate text-[0.875rem] text-muted max-md:hidden" data-setup-stand>{st.text}</div>
        <div className={cn('min-w-0 truncate text-[0.875rem] max-md:hidden', miss.length ? 'font-medium text-warn-700' : 'text-muted')} data-setup-missing={miss.join(',')}>{miss.length ? cap(miss.join(' · ')) : <span className="text-faint">—</span>}</div>
        <div className="flex shrink-0 items-center justify-end gap-1 text-[0.8125rem]" data-setup-state>
          {ok ? <span className="inline-flex items-center gap-1 font-medium text-[#2c8a5b]"><Check className="h-3.5 w-3.5" strokeWidth={3} />Set up</span> : <span className="font-semibold text-brand-700">Set it up</span>}
          <ChevronRight className="h-4 w-4 text-faint" />
        </div>
      </div>
    )
  }
  return (
    <Page
      title="Set up projects"
      sub="Just the basics — where it stands, who’s on it, the dates. Tap one, fill it in, Save. The star puts it on top."
      actions={setN < jobs.length ? <Button variant="primary" icon={<ListChecks />} onClick={() => s.open({ t: 'catchup', all: true })} data-setup-go>Go through them one by one</Button> : undefined}
      top={
        <div className="flex items-center gap-3 text-[0.9375rem]" data-setup-progress>
          <span className="font-semibold text-ink tnum" data-setup-count>{setN} of {jobs.length} set up</span>
          <span className="h-2 w-48 overflow-hidden rounded-full bg-[#ece8e1] max-sm:w-24" aria-hidden><span className="block h-full rounded-full bg-[#2c8a5b] transition-[width]" style={{ width: `${pct}%` }} /></span>
        </div>
      }
    >
      <div data-even-list style={COLS} data-setup-list>
        {jobs.length > 0 && (
          <div className={cn(HEAD_ROW, 'px-5 md:grid md:gap-x-6', STICKY_HEAD, 'max-md:hidden')} data-list-head data-subrow>
            <span className="pl-[2.125rem]">Project</span><span>Where it stands</span><span>Still missing</span><span className="text-right">Set up</span>
          </div>
        )}
        {starred.length > 0 && <section data-starred><Group label="Starred" count={starred.length} />{starred.map(row)}</section>}
        {todo.length > 0 && <section><Group label="Not set up yet" count={todo.length} />{todo.map(row)}</section>}
        {done.length > 0 && <section><Group label="Set up" count={done.length} />{done.map(row)}</section>}
        {!jobs.length && <EmptyState icon={<Check />} title="No open projects" sub="Projects that are going show here to be set up." />}
      </div>
    </Page>
  )
}
