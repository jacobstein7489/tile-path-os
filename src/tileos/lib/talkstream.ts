/* The assistant's answer as it's written (the server's /api/talk, lib/talk.server): each time more comes, onText gets
 * all of it so far — so the first words show right away. null: that didn't work (an older server, a network that holds
 * it back, 15 seconds with nothing new) — the caller asks the usual way, all at once. */
export class TalkStopped extends Error {}

export async function streamTalk(token: string, prompt: string, onText: (soFar: string) => void, signal?: AbortSignal): Promise<string | null> {
  const ac = new AbortController()
  const stop = () => ac.abort()
  signal?.addEventListener('abort', stop)
  let timer: ReturnType<typeof setTimeout> = setTimeout(stop, 15_000)
  const still = () => { clearTimeout(timer); timer = setTimeout(stop, 15_000) }
  let all = ''
  let ok = false
  try {
    const res = await fetch('/api/talk', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal: ac.signal })
    if (res.ok && res.body && /^text\/plain/i.test(res.headers.get('content-type') || '')) {
      const rd = res.body.getReader()
      const dec = new TextDecoder()
      for (;;) {
        const { done, value } = await rd.read()
        if (done) break
        if (value?.length) { still(); all += dec.decode(value, { stream: true }); onText(all) }
      }
      ok = true
    }
  } catch { /* the usual way */ } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
  }
  if (signal?.aborted) throw new TalkStopped('Stopped.')
  return ok && all.trim() ? all : null
}
