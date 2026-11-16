/* What's being read right now — an estimate or tile paperwork, on a project. It lives outside every window: leave the
 * project and come back, it's still there with how far it got; the bar on top of every screen shows it too. Each
 * reading says where it is (the pages, then each part the AI reads, then the tile pictures), and the bar moves on its
 * own between those steps, so it never sits still. */
import { create } from 'zustand'

export type ReadKind = 'paperwork' | 'estimate'
/** where a reading is: turning the pages into pictures, the AI reading them (a part at a time), cutting out the
 *  pictures */
export type ReadStep = { phase: 'pages' | 'reading' | 'pictures'; done: number; total: number; /** reading: how many pages in all, and how many each part has */ pages?: number; per?: number }
export type Reading = ReadStep & { kind: ReadKind; jobId: string; file: string; started: number; at: number; /** it couldn't be read — why, in a few words (it stays until it's tried again or put away) */ failed?: string }

const keyOf = (kind: ReadKind, jobId: string) => `${kind}:${jobId}`
export const useReading = create<{ by: Record<string, Reading> }>(() => ({ by: {} }))

export function startReading(kind: ReadKind, jobId: string, file: string) {
  const now = Date.now()
  useReading.setState((x) => ({ by: { ...x.by, [keyOf(kind, jobId)]: { kind, jobId, file, phase: 'pages', done: 0, total: 1, started: now, at: now } } }))
}
export function stepReading(kind: ReadKind, jobId: string, step: ReadStep) {
  const k = keyOf(kind, jobId)
  const cur = useReading.getState().by[k]
  if (!cur) return
  useReading.setState((x) => ({ by: { ...x.by, [k]: { ...cur, ...step, at: Date.now() } } }))
}
export function endReading(kind: ReadKind, jobId: string) {
  const k = keyOf(kind, jobId)
  if (!useReading.getState().by[k]) return
  useReading.setState((x) => { const by = { ...x.by }; delete by[k]; return { by } })
}
/** it couldn't be read: the card says why, until it's tried again or put away */
export function failReading(kind: ReadKind, jobId: string, why: string) {
  const k = keyOf(kind, jobId)
  const cur = useReading.getState().by[k]
  if (!cur) return
  useReading.setState((x) => ({ by: { ...x.by, [k]: { ...cur, failed: why, at: Date.now() } } }))
}
export const useReadingOf = (kind: ReadKind, jobId: string) => useReading((x) => x.by[keyOf(kind, jobId)])
/** the readings going on now (not the ones that failed) */
export const readingNow = () => Object.values(useReading.getState().by).filter((r) => !r.failed)

/* each phase's share of the bar: the pages are quick, the AI reading is most of it, the pictures are the end */
const SPAN: Record<ReadStep['phase'], [number, number]> = { pages: [2, 14], reading: [14, 92], pictures: [92, 99] }
/** how far, 0–99: where the last step put it, and creeping on toward the next step while the AI reads (it gets close,
 *  never past it) */
export function pctOf(r: ReadStep & { at: number }, now = Date.now()): number {
  const [a, b] = SPAN[r.phase]
  const total = Math.max(1, r.total)
  const done = Math.min(r.done, total)
  const from = a + ((b - a) * done) / total
  const to = a + ((b - a) * Math.min(total, done + 1)) / total
  /* a part the AI is on takes 15–40 seconds: most of the way there in about half a minute */
  const k = r.phase === 'reading' ? 1 - Math.exp(-(now - r.at) / 14000) : r.phase === 'pages' ? 1 - Math.exp(-(now - r.at) / 1500) : 0.5
  return Math.max(1, Math.min(99, Math.round(from + (to - from) * k * 0.92)))
}
/** what it's doing, in a few words: "Page 4 of 13", "Reading pages 9–13 of 13", "Cutting out the tile pictures" */
export function wordsOf(r: Reading): string {
  if (r.phase === 'pages') return r.total > 1 ? `Opening page ${Math.min(r.done + 1, r.total)} of ${r.total}` : 'Opening it'
  if (r.phase === 'pictures') return 'Cutting out the tile pictures'
  if (r.pages && r.per) {
    if (r.pages <= r.per) return r.pages === 1 ? 'Reading the page' : `Reading all ${r.pages} pages`
    const a = Math.min(r.done, r.total - 1) * r.per + 1
    return `Reading pages ${a}–${Math.min(r.pages, a + r.per - 1)} of ${r.pages}`
  }
  return r.total > 1 ? `Reading part ${Math.min(r.done + 1, r.total)} of ${r.total}` : 'Reading it'
}
