/* A to-do's short name: the line on a list says it in a few words ("Chase the thinset"); its window has the whole
 * words. Made by itself, once, for a to-do whose words are long — by the company's AI when it's on, else from its
 * first sentence. Changing the words makes a new one. */
import * as React from 'react'
import { useStore } from '@/tileos/store'
import { REAL } from '@/tileos/lib/save'

/** long enough to need one: more than fits on a phone's line (beside its icon and its time) */
export const LONG = 24
const tried = new Set<string>()
/** without the AI: its first sentence or clause, if that's short enough and says something (two words at least) —
 *  else nothing (the line wraps). "Yakov, please call the plumber": who it's for isn't the to-do — "Call the plumber" */
export function shortFrom(title: string): string | undefined {
  let t = title.trim()
  const named = t.match(/^([A-Z][a-z]+),\s+(.+)$/)
  if (named) t = named[2]
  t = t.replace(/^(please|pls)\s+/i, '')
  const first = t.split(/(?<=[a-z0-9)])[.?!;]\s|\s[-–—]\s|,\s/i)[0].trim()
  const out = first.charAt(0).toUpperCase() + first.slice(1)
  return out && out.length < title.length && out.length <= 34 && out.split(/\s+/).length >= 2 ? out : undefined
}
async function aiShort(title: string): Promise<string | undefined> {
  const ai = (REAL as any).ai as undefined | ((p: string, pages: Blob[], signal?: AbortSignal, o?: { fast?: boolean }) => Promise<string>)
  if (!ai) return undefined
  const prompt = `A to-do on a tile installation company's list. Write it in 2 to 5 words, as a short line on a phone. Keep names, numbers and tile codes. Start with the verb when there is one. Answer with the short line only, no quotes, no period.\n\nTo-do: ${title}`
  const out = (await ai(prompt, [], undefined, { fast: true })).trim().replace(/^["“']|["”'.]$/g, '').split('\n')[0].trim()
  return out && out.length <= 40 && out.length < title.length ? out : undefined
}
export function ShortNames() {
  const tasks = useStore((s) => s.tasks)
  React.useEffect(() => {
    const need = tasks.filter((t) => t.state !== 'done' && !t.short && t.title.length > LONG && !tried.has(t.id + t.title)).slice(0, 6)
    need.forEach((t) => {
      tried.add(t.id + t.title)
      void (async () => {
        let short: string | undefined
        try { short = await aiShort(t.title) } catch { short = undefined }
        short ||= shortFrom(t.title)
        if (!short) return
        useStore.getState().commit((st) => { const x = st.tasks.find((y) => y.id === t.id); if (x && x.title === t.title && !x.short) x.short = short }, undefined, { undo: false })
      })()
    })
  }, [tasks])
  return null
}
