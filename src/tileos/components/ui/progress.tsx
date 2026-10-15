import * as React from 'react'
import { Check, Lock } from 'lucide-react'
import { cn, TONE } from '@/tileos/lib/utils'
import type { Stage, Tone } from '@/tileos/data/model'
import { PHASES, ALL_STAGES } from '@/tileos/data/model'

export function Ring({ pct, size = 40, stroke = 4, tone = 'info', label, className }: { pct: number; size?: number; stroke?: number; tone?: Tone; label?: React.ReactNode; className?: string }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const col = { bad: '#EC4848', warn: '#F29A0F', ok: '#22A861', info: '#1F5CF0', vio: '#7C62F0', neutral: '#C3CAD5' }[tone]
  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E9EDF3" strokeWidth={stroke} />
        {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`} />}
      </svg>
      {label !== undefined && <span className="absolute inset-0 flex items-center justify-center text-[0.6875rem] font-bold tnum text-ink-2">{label}</span>}
    </span>
  )
}

export function Bar({ pct, tone = 'info', className, h = 8 }: { pct: number; tone?: Tone; className?: string; h?: number }) {
  return (
    <span className={cn('relative block w-full overflow-hidden rounded-full bg-[#E9EDF3]', className)} style={{ height: h }}>
      <span className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-500', TONE[tone].bar)} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </span>
  )
}

export function StackBar({ parts, h = 14, className }: { parts: { pct: number; className: string; label?: string }[]; h?: number; className?: string }) {
  return (
    <span className={cn('flex w-full overflow-hidden rounded-full bg-[#E9EDF3]', className)} style={{ height: h }}>
      {parts.map((p, i) => (p.pct > 0 ? <span key={i} title={p.label} className={cn('h-full first:rounded-l-full', p.className)} style={{ width: `${p.pct}%` }} /> : null))}
    </span>
  )
}

/* Mini 13-step track for list rows: where the job is up to, at a glance. */
export function StageTrack({ stage, className, blocked }: { stage: Stage; className?: string; blocked?: boolean }) {
  const cur = ALL_STAGES.indexOf(stage)
  let i = -1
  return (
    <span className={cn('inline-flex items-center gap-[0.3125rem]', className)} aria-label={`Stage ${stage}`}>
      {PHASES.map((p) => (
        <span key={p.key} className="inline-flex items-center gap-[0.125rem]">
          {p.stages.map((s) => {
            i++
            const done = i < cur || stage === 'complete'
            const isCur = i === cur && stage !== 'complete'
            return (
              <span
                key={s}
                className={cn(
                  'h-[0.4375rem] w-[0.5625rem] rounded-[0.1875rem] transition-colors',
                  done && 'bg-brand-500',
                  isCur && (blocked ? 'bg-bad-500 ring-2 ring-bad-100' : 'bg-brand-600 ring-2 ring-brand-100'),
                  !done && !isCur && 'bg-[#E3E8EF]',
                )}
              />
            )
          })}
        </span>
      ))}
    </span>
  )
}

export interface StepNode { key: string; label: string; sub?: string; state: 'done' | 'current' | 'future' | 'blocked'; locked?: boolean }

export function Stepper({ nodes, onNode, compact }: { nodes: StepNode[]; onNode?: (n: StepNode, i: number) => void; compact?: boolean }) {
  const size = compact ? 28 : 34
  return (
    <div className="grid w-full" style={{ gridTemplateColumns: `repeat(${nodes.length}, minmax(0, 1fr))` }}>
      {nodes.map((n, i) => {
        const next = nodes[i + 1]
        const lineCls = !next ? '' : next.state === 'done' ? 'bg-ok-500' : next.state === 'current' || next.state === 'blocked' ? 'bg-gradient-to-r from-ok-500 to-brand-500' : ''
        const dashed = next && (next.state === 'future')
        return (
          <div key={n.key} className="relative flex flex-col items-center text-center">
            {next && (
              <span
                className={cn('absolute top-[1rem] left-[calc(50%+1.375rem)] right-[calc(-50%+1.375rem)] h-[0.125rem] rounded-full', lineCls, compact && 'top-[0.8125rem] left-[calc(50%+1.125rem)] right-[calc(-50%+1.125rem)]')}
                style={dashed ? { backgroundImage: 'linear-gradient(90deg,#CED5DF 50%,transparent 0)', backgroundSize: '8px 2px' } : undefined}
              />
            )}
            <button
              type="button"
              onClick={() => onNode?.(n, i)}
              className={cn('group relative z-[1] flex flex-col items-center gap-2 rounded-xl px-1 outline-none', onNode && 'cursor-pointer')}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full text-[0.8125rem] font-bold transition-transform group-hover:scale-110',
                  n.state === 'done' && 'border-2 border-ok-500 bg-white text-ok-600',
                  n.state === 'current' && 'bg-brand-600 text-white animate-pulse-ring',
                  n.state === 'blocked' && 'bg-bad-500 text-white',
                  n.state === 'future' && 'border-2 border-[#D5DBE4] bg-white text-faint',
                )}
                style={{ width: size, height: size }}
              >
                {n.state === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : n.locked ? <Lock className="h-3.5 w-3.5" /> : n.state === 'current' ? <span className="h-2.5 w-2.5 rounded-full bg-white" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className={cn('block whitespace-nowrap text-[0.84375rem] font-semibold leading-tight', n.state === 'future' ? 'text-muted' : n.state === 'current' ? 'text-brand-700' : n.state === 'blocked' ? 'text-bad-700' : 'text-ink')}>{n.label}</span>
                <span className={cn('mt-1 block whitespace-nowrap text-[0.75rem] leading-tight', n.state === 'current' ? 'font-semibold text-brand-600' : n.state === 'blocked' ? 'font-semibold text-bad-600' : 'text-muted')}>{n.sub || ' '}</span>
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* Phones: a step track collapses to one line and a segmented bar. */
export function StepSummary({ nodes, onOpen, className }: { nodes: StepNode[]; onOpen?: (n: StepNode) => void; className?: string }) {
  const idx = Math.max(0, nodes.findIndex((n) => n.state === 'current' || n.state === 'blocked'))
  const cur = nodes[idx]
  const Tag = onOpen ? 'button' : 'div'
  return (
    <Tag onClick={onOpen ? () => onOpen(cur) : undefined} className={cn('block w-full rounded-2xl border border-line-2 bg-wash/70 px-4 py-3 text-left', className)}>
      <span className="flex items-center justify-between gap-3 text-[0.84375rem]">
        <span className={cn('min-w-0 truncate font-semibold', cur.state === 'blocked' ? 'text-bad-700' : 'text-brand-700')}>
          {cur.label}
          {cur.sub && cur.sub.trim() ? <span className="font-medium"> · {cur.sub}</span> : null}
        </span>
        <span className="shrink-0 text-[0.78125rem] text-muted">Step {idx + 1} of {nodes.length}</span>
      </span>
      <span className="mt-2.5 flex gap-1">
        {nodes.map((n) => (
          <span key={n.key} className={cn('h-1.5 flex-1 rounded-full', n.state === 'done' ? 'bg-ok-500' : n.state === 'current' ? 'bg-brand-600' : n.state === 'blocked' ? 'bg-bad-500' : 'bg-[#E3E8EF]')} />
        ))}
      </span>
    </Tag>
  )
}

/* Small step line for money items, POs and setup checklists. */
export function MiniSteps({ steps, at, tone = 'info', className, showLabels = true, late }: { steps: string[]; at: number; tone?: Tone; className?: string; showLabels?: boolean; late?: boolean }) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center">
        {steps.map((s, i) => {
          const done = i < at || (at >= steps.length - 1 && i === steps.length - 1 && tone === 'ok')
          const cur = i === at
          return (
            <React.Fragment key={s}>
              <span
                className={cn(
                  'relative inline-flex h-[0.625rem] w-[0.625rem] shrink-0 rounded-full',
                  done ? 'bg-[#2c4a3e]' : cur ? (late ? 'bg-bad-500 ring-4 ring-bad-100' : 'bg-ink ring-4 ring-[#e6e8ec]') : 'border-2 border-[#D5DBE4] bg-white',
                )}
              />
              {i < steps.length - 1 && <span className={cn('h-[0.125rem] flex-1', i < at ? 'bg-[#2c4a3e]' : 'bg-[#E3E8EF]')} />}
            </React.Fragment>
          )
        })}
      </div>
      {showLabels && (
        <div className="mt-1.5 flex justify-between">
          {steps.map((s, i) => (
            <span key={s} className={cn('text-[0.71875rem] leading-tight', i === at ? (late ? 'font-semibold text-bad-600' : 'font-semibold text-ink') : i < at ? 'text-ink-2' : 'text-faint', i === 0 ? 'text-left' : i === steps.length - 1 ? 'text-right' : 'text-center')} style={{ width: `${100 / steps.length}%` }}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
