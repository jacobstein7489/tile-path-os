/* How long the app took to open, kept on the device — so a slow start can be seen for what it is: the app's files,
 * the sign-in and the data, or drawing the screen. The account menu shows the last one, small, under the version.
 *   files: from tapping the app to the app's code being loaded (the network, or the copy on the device)
 *   sign-in & data: until the company's data is in (from this device's copy, or the database)
 *   screen: until the first screen is drawn */
const KEY = 'tileos-opened'
export type Opened = { at: number; total: number; files: number; data: number; screen: number; from: 'device' | 'database' }
const marks: { files?: number; data?: number; from?: 'device' | 'database' } = {}
const now = () => (typeof performance !== 'undefined' ? performance.now() : 0)
/** the app's code is loaded (called from the top of Boot) */
export const markFiles = () => { if (marks.files == null) marks.files = now() }
/** the data is in */
export const markData = (from: 'device' | 'database') => { if (marks.data == null) { marks.data = now(); marks.from = from } }
/** the first screen is drawn: keep this open's times */
export function markScreen() {
  if (marks.files == null || marks.data == null) return
  const at = now()
  const o: Opened = { at: Date.now(), total: at, files: marks.files, data: marks.data - marks.files, screen: at - marks.data, from: marks.from || 'device' }
  marks.files = undefined
  try {
    const list: Opened[] = JSON.parse(localStorage.getItem(KEY) || '[]')
    localStorage.setItem(KEY, JSON.stringify([o, ...list].slice(0, 10)))
  } catch { /* private window */ }
}
/** the last open, in words: "2.4 s — files 1.2 · sign-in & data 0.6 · screen 0.6" */
export function lastOpened(): string | null {
  try {
    const o: Opened | undefined = JSON.parse(localStorage.getItem(KEY) || '[]')[0]
    if (!o) return null
    const s = (ms: number) => (ms / 1000).toFixed(1)
    return `Opened in ${s(o.total)} s — files ${s(o.files)} · sign-in & data ${s(o.data)}${o.from === 'database' ? ' (from the database)' : ''} · screen ${s(o.screen)}`
  } catch { return null }
}
