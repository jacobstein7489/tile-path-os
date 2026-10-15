import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Tone } from '@/tileos/data/model'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* tone → classes (one place, so color always means the same thing) */
export const TONE = {
  bad: { text: 'text-bad-600', strong: 'text-bad-700', bg: 'bg-bad-50', bg2: 'bg-bad-100', border: 'border-bad-100', dot: 'bg-bad-500', bar: 'bg-bad-500', ring: 'ring-bad-200' },
  warn: { text: 'text-warn-600', strong: 'text-warn-700', bg: 'bg-warn-50', bg2: 'bg-warn-100', border: 'border-warn-100', dot: 'bg-warn-500', bar: 'bg-warn-500', ring: 'ring-warn-200' },
  ok: { text: 'text-ok-600', strong: 'text-ok-700', bg: 'bg-ok-50', bg2: 'bg-ok-100', border: 'border-ok-100', dot: 'bg-ok-500', bar: 'bg-ok-500', ring: 'ring-ok-200' },
  info: { text: 'text-brand-600', strong: 'text-brand-700', bg: 'bg-brand-50', bg2: 'bg-brand-100', border: 'border-brand-100', dot: 'bg-brand-500', bar: 'bg-brand-600', ring: 'ring-brand-200' },
  vio: { text: 'text-vio-600', strong: 'text-vio-600', bg: 'bg-vio-50', bg2: 'bg-vio-100', border: 'border-vio-100', dot: 'bg-vio-500', bar: 'bg-vio-500', ring: 'ring-vio-100' },
  neutral: { text: 'text-muted', strong: 'text-ink-2', bg: 'bg-wash-2', bg2: 'bg-line-2', border: 'border-line', dot: 'bg-faint', bar: 'bg-faint', ring: 'ring-line' },
} satisfies Record<Tone, Record<string, string>>

export type DueBucket = 'overdue' | 'today' | 'week' | 'later'
export function dueBucket(due?: string, tone?: Tone): DueBucket {
  if (!due) return 'later'
  const d = due.toLowerCase()
  if (d.includes('late') || tone === 'bad') return 'overdue'
  if (d.includes('today')) return 'today'
  if (/(tomorrow|mon|tue|wed|thu|fri|this week|sep 29|sep 30|oct 1|oct 2)/.test(d)) return 'week'
  return 'later'
}
export const BUCKET_LABEL: Record<DueBucket, string> = { overdue: 'Overdue', today: 'Today', week: 'This week', later: 'Later' }

export function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const pct = (n: number, d: number) => (d <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((n / d) * 100))))

let seq = 1050
export const nextRef = () => '#' + ++seq
let poSeq = 1046
export const nextPO = () => 'PO-' + poSeq++
/** invoice and PO numbers carry on after the saved ones */
export const seedRefs = (ref: number, po: number) => { if (ref > seq) seq = ref; if (po >= poSeq) poSeq = po + 1 }
