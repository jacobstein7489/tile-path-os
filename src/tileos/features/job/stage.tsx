import * as React from 'react'
import { CheckCircle2, Circle, CalendarDays, UserRound, Sparkles, ArrowRight } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Modal } from '@/tileos/components/ui/overlay'
import { Pill, Button, IconCircle } from '@/tileos/components/ui/core'
import { Bar } from '@/tileos/components/ui/progress'
import { JOB_TRACK } from '@/tileos/data/model'
import { jobTrack } from './workspace'
import { shiftDeep } from '@/tileos/lib/today'

interface Story { title: string; dates: string; owner: string; lines: string[]; factsTitle: string; facts: [string, string][]; foot: string }

const S119: Record<string, Story> = shiftDeep({
  won: {
    title: 'Winning the work', dates: 'Aug 11 – Aug 31', owner: 'Office and estimating',
    lines: [
      'Price request came in August 11. Plans arrived; the spec book was missing, so it was requested and came August 14.',
      'Estimated August 14 to 19. One scope question went to the designer: are the boys bath walls also 3 ft? Answered yes.',
      'Revision 1 sent August 20. The GC asked to remove the basement bath and add two fireplace walls.',
      'Revision 2 priced and sent August 26. Revision 1 is kept, not overwritten.',
      'Followed up August 28 and 31. Approved on the second call.',
    ],
    factsTitle: 'Sold scope', facts: [['Approved revision', 'Revision 2 · Aug 31'], ['Contract', '$184,600'], ['Client PO', 'Received Sep 2'], ['Deposit', '20% · received Sep 4']],
    foot: 'Award notified accounting, back office, materials and scheduling automatically.',
  },
  setup: {
    title: 'Back office setup', dates: 'Sep 1 – Sep 3', owner: 'Back office',
    lines: [
      '9 rooms and 31 surfaces — only what actually applies to this project.',
      '7 finish records assigned to exact surfaces. T-03 Toscana Ivory goes on the master shower and tub walls.',
      'Finish tile supplied and ordered by the GC from Best Tile. Installation materials by Cobblestone.',
      'Tile quantities checked against our takeoff: every tile covered our need plus waste.',
      '4 unknowns flagged for the site manager instead of guessed at.',
    ],
    factsTitle: 'Finish record T-03', facts: [['Product', 'Toscana Ivory 24 × 48 matte'], ['Manufacturer', 'Marca Corona'], ['Supplier', 'Best Tile'], ['Ordered by', 'The GC']],
    foot: 'The site manager received an organized project, not a blank one.',
  },
  verification: {
    title: 'Field and design verification', dates: 'Sep 4 – Sep 8', owner: 'Yaakov Stein · site manager',
    lines: [
      'Rooms and surfaces matched the site on the September 4 walkthrough.',
      'Metal confirmed: Schluter JOLLY, satin brass, 10 mm, six 8 ft pieces. Cobblestone supplies it, so it became a material requirement.',
      'Doorway transitions: finished wood elevation verified before the prep decision.',
      'The design meeting on September 8 settled 12 open details — not the whole bathroom.',
      'One question stayed open: the master shower drain sequence.',
    ],
    factsTitle: 'Decisions saved', facts: [['Shower walls', 'Full tile at the doorway, vertical stack'], ['Outside corners', '10 mm satin brass'], ['Niche', 'Field tile, mitered'], ['Tub walls', '84″ with a metal edge']],
    foot: 'Every answer became permanent surface information the crew can see.',
  },
  ready: {
    title: 'Review for scheduling', dates: 'Sep 9', owner: 'Company rules',
    lines: [
      'Scope and documents: plans A4, Revision 2 approved.',
      'Design decisions: all settled except the master shower drain.',
      'Site: access, water and power confirmed September 4.',
      'Finish tile: 14 of 20 boxes of T-03 — enough to start, not to finish.',
      'Money: deposit received September 4, so the start rule was satisfied.',
    ],
    factsTitle: 'Result', facts: [['Result', 'Can start with restrictions'], ['Start with', 'Guest bath, powder, master floor'], ['Hold', 'Master shower floor'], ['Crew', '4 workers, about 4 weeks']],
    foot: 'One blocked surface did not stop the whole project from being scheduled.',
  },
  scheduled: {
    title: 'Scheduled', dates: 'Sep 10 – Sep 12', owner: 'Scheduling',
    lines: [
      'Philip and 4 workers booked September 14 to October 9.',
      'Starting areas in sequence: guest bath, then powder, then the master main floor.',
      'The PM confirmed the start with the GC on September 11.',
      'The site manager released access and the starting areas on September 12.',
      'The crew received the installer package on September 12.',
    ],
    factsTitle: 'Pre-start checks', facts: [['Project manager', 'Start confirmed with the GC'], ['Site manager', 'Access and areas released'], ['Materials', 'Week-one materials verified'], ['Crew', 'Package received']],
    foot: 'Each role got its own check automatically when the crew was booked.',
  },
})

const GENERIC: Record<string, string[]> = {
  won: ['Approved revision recorded', 'Deposit sent to accounting', 'Client PO recorded', 'Project manager assigned'],
  setup: ['Rooms and surfaces built from the paperwork', 'Tile records assigned to exact surfaces', 'Store quantities checked against our takeoff', 'Unknowns flagged for the walkthrough'],
  verification: ['Site walkthrough done', 'Field measurements confirmed', 'Open design details decided', 'Remaining questions tracked on their surface'],
  ready: ['Scope and documents current', 'Critical decisions made', 'Enough tile and materials to start', 'Site access, water and power', 'Deposit received (or warned)'],
  scheduled: ['Crew and dates booked', 'Starting areas set', 'Each role’s pre-start check', 'Installer package sent to the crew'],
  installation: ['Daily updates from the site', 'Blocked surfaces tracked — the rest keeps moving', 'Changes held until approved', 'Progress by room rolls up'],
  punch: ['Punch items: open, working, ready to verify, verified', 'Returns scheduled', 'Before and after photos'],
  closeout: ['Required punch verified', 'Approved changes billed', 'GC sign-off', 'Final billing sent to accounting'],
  complete: ['Final payment recorded', 'Whole history kept and searchable'],
}

export function StageModal({ jobId, k, level }: { jobId: string; k: string; level: number }) {
  const job = useStore((s) => s.jobs[jobId])
  const rooms = useStore((s) => s.rooms[jobId]) || []
  const close = useStore((s) => s.close)
  const open = useStore((s) => s.open)
  if (!job) return null
  const node = jobTrack(job).find((n) => n.key === k)!
  const label = JOB_TRACK.find((n) => n.key === k)!.label
  const story = jobId === '119' ? S119[k] : undefined
  const state = node.state
  const header = (
    <div className="border-b border-line-2 px-7 pb-5 pt-6 pr-20 max-sm:px-4 max-sm:pb-4 max-sm:pr-14 max-sm:pt-4">
      <div className="flex items-center gap-2 text-[0.84375rem] text-muted">
        <span className="font-semibold text-ink-2">{job.name}</span> · Stage {JOB_TRACK.findIndex((n) => n.key === k) + 1} of {JOB_TRACK.length}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 className="h-tight text-[1.5rem] font-bold text-ink max-sm:text-[1.25rem]">{story?.title || label}</h2>
        <Pill tone={state === 'done' ? 'ok' : state === 'future' ? 'neutral' : state === 'blocked' ? 'bad' : 'info'} dot>
          {state === 'done' ? 'Done' : state === 'future' ? 'Coming up' : 'Now'}
        </Pill>
      </div>
      <div className="mt-2 flex items-center gap-5 text-[0.875rem] text-muted">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{story?.dates || node.sub || 'Not started'}</span>
        <span className="inline-flex items-center gap-1.5"><UserRound className="h-4 w-4" />{story?.owner || (k === 'setup' ? 'Back office' : k === 'won' ? 'Office and estimating' : k === 'closeout' ? 'PM and accounting' : 'Project manager')}</span>
      </div>
    </div>
  )
  return (
    <Modal level={level} size="lg" onClose={close} header={header} title={label}>
      {story ? (
        <div className="grid grid-cols-[1fr_18.75rem] gap-8 max-md:grid-cols-1 max-md:gap-6">
          <div>
            <div className="mb-3 text-[0.84375rem] font-semibold text-muted">What happened</div>
            <div className="flex flex-col gap-3">
              {story.lines.map((l, i) => (
                <div key={i} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok-500" />
                  <div className="text-[0.9375rem] leading-relaxed text-ink">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="self-start rounded-2xl border border-line bg-wash/60 p-5">
            <div className="mb-3 text-[0.84375rem] font-semibold text-muted">{story.factsTitle}</div>
            <div className="flex flex-col gap-3">
              {story.facts.map(([a, b]) => (
                <div key={a}>
                  <div className="text-[0.78125rem] text-muted">{a}</div>
                  <div className="text-[0.90625rem] font-semibold text-ink">{b}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-4 py-3.5 text-[0.875rem] text-ink-2">
            <Sparkles className="h-5 w-5 text-brand-600" />
            {story.foot}
          </div>
        </div>
      ) : k === 'installation' && rooms.length ? (
        <div>
          <div className="mb-3 text-[0.84375rem] font-semibold text-muted">Progress by room — from the daily updates</div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 max-sm:grid-cols-1">
            {rooms.map((r) => (
              <div key={r.name}>
                <div className="flex justify-between text-[0.875rem]"><span className="font-semibold text-ink">{r.name}</span><span className="tnum text-ink-2">{r.pct}%</span></div>
                <Bar pct={r.pct} className="mt-1.5" h={7} tone={r.surfaces.some((x) => x.state === 'blocked') ? 'bad' : r.pct === 100 ? 'ok' : 'info'} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-line bg-wash px-4 py-3.5">
            <div className="text-[0.875rem] text-ink-2">Ready for punch unlocks when installation is substantially complete and no blocking issues are left.</div>
            <Button size="sm" iconRight={<ArrowRight className="h-4 w-4" />} onClick={() => { close(); open({ t: 'job', id: jobId, tab: 'rooms' }) }}>Rooms</Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-3 text-[0.84375rem] font-semibold text-muted">{state === 'done' ? 'What was done' : state === 'future' ? 'What it will take' : 'What has to happen'}</div>
          <div className="flex flex-col gap-3">
            {(GENERIC[k] || []).map((l, i) => (
              <div key={i} className="flex gap-3">
                {state === 'done' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ok-500" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[#CDD4DE]" />}
                <div className="text-[0.9375rem] text-ink">{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
