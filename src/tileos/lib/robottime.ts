/* How long the robot took, the last time — the account menu shows it (like "Opened in"), so its speed on a real phone
 * is known, not guessed: writing down what was said, the first words of the answer, the whole answer. */
const KEY = 'tileos-robot-time'
type T = { heard?: number; heardAt?: number; first?: number; done?: number }
let last: T | null = null
const read = (): T | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null } }

/** what was said is written down — it took this long */
export function noteHeard(ms: number) {
  last = { heard: ms, heardAt: Date.now() }
  try { localStorage.setItem(KEY, JSON.stringify(last)) } catch { /* fine */ }
}
/** the answer: its first words, and all of it — with the writing down, when it was just said by voice */
export function noteAnswered(first: number, done: number) {
  const t = last || read()
  const heard = t?.heardAt && Date.now() - t.heardAt < done + 15_000 ? t.heard : undefined
  last = { heard, first, done }
  try { localStorage.setItem(KEY, JSON.stringify(last)) } catch { /* fine */ }
}
export function robotTime(): string {
  const t = last || read()
  if (!t || t.done == null) return ''
  const s = (ms: number) => (ms / 1000).toFixed(1)
  return `Robot: ${[t.heard != null ? `heard in ${s(t.heard)} s` : '', t.first != null ? `first words ${s(t.first)} s` : '', `done ${s(t.done)} s`].filter(Boolean).join(' · ')}`
}
