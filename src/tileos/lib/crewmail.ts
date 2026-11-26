/* The crew list email, word for word — one place, used by the app (the evening's, when the site manager taps Send) and
 * by the server (the same list again first thing that morning, by itself). Plain data in, the email out: nothing here
 * reads the app's store, so the server can use it as is. */

export type CrewLine = { jobId: string; crew: string; workers: number; note: string }
type JobLite = { name?: string; address?: string; stage?: string; hold?: { shortage?: unknown; reason?: string; since?: string; until?: string } | null | false }
type PunchLite = { jobId: string; text: string; status: string; owner?: string }
export type CrewMailData = {
  jobs: Record<string, JobLite | undefined>
  punch: PunchLite[]
  /** a person's full name ("Leo Russo") and short one ("Leo") */
  nameOf: (k: string) => string | undefined
  shortOf: (k: string) => string | undefined
  /** who sent it ("Yaakov Jacobs") */
  by: string
  /** where the logo is */
  site: string
}

export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
/** every email's frame: the logo on top, the company's name at the bottom */
export const mailFrame = (site: string, inner: string) => `<div style="font:15px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1b18;max-width:640px">
<img src="${site}/logo-email.png" width="130" alt="Cobblestone Tile Installation" style="display:block;width:130px;height:auto;border:0;margin:0 0 18px">
${inner}
<p style="margin:22px 0 0;padding-top:12px;border-top:1px solid #ece7df;font-size:12px;color:#8a857b">Cobblestone Tile Installation</p>
</div>`

/** "Crews for Tue, Nov 24": each crew once with its projects under it (the address, how many, the note), who's nowhere
 *  that day, the touch-ups still open and what's on hold. That morning's (morning: true): "Crews today · …", and it
 *  says it's last night's list */
export function crewMailCompose(d: CrewMailData, rows: CrewLine[], day: string, o: { morning?: boolean } = {}): { subject: string; html: string; text: string } {
  const on = rows.filter((r) => r.workers > 0)
  const off = rows.filter((r) => !(r.workers > 0))
  const people = on.reduce((n, r) => n + r.workers, 0)
  const dt = new Date(day + 'T12:00:00')
  const dayWords = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const count = `${on.length} ${on.length === 1 ? 'job' : 'jobs'}, ${people} ${people === 1 ? 'person' : 'people'}`
  const subject = o.morning ? `Crews today, ${dayWords} · ${count}` : `Crews for ${dayWords} · ${count}`
  const crewName = (r: CrewLine) => d.nameOf(r.crew) || 'No installer yet'
  const jobName = (r: CrewLine) => d.jobs[r.jobId]?.name || 'A project'
  const addrOf = (r: CrewLine) => { const j = d.jobs[r.jobId]; return j?.address && j.address !== j.name ? j.address : '' }
  /* by crew: each crew once, its jobs under it (A to Z) — who's where at a glance */
  const crews = Array.from(new Set(on.map(crewName))).sort((a, b) => a.localeCompare(b))
  const groups = crews.map((c) => { const list = on.filter((r) => crewName(r) === c).sort((a, b) => jobName(a).localeCompare(jobName(b))); return { c, list, n: list.reduce((k, r) => k + r.workers, 0) } })
  const cell = 'padding:7px 6px;border-bottom:1px solid #ece8e1;vertical-align:top'
  const small = (t: string) => `<br><span style="color:#7a7569;font-size:13px">${esc(t)}</span>`
  const crewTbl = `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:14px 0 6px;font-size:14px">
${groups.map((g) => `<tr><td style="padding:10px 6px 6px;background:#f6f5f2;font-weight:700">${esc(g.c)} <span style="color:#7a7569;font-weight:400">· ${g.list.length} ${g.list.length === 1 ? 'job' : 'jobs'}</span></td><td style="padding:10px 6px 6px;background:#f6f5f2;text-align:right;font-weight:700">${g.n}</td></tr>
${g.list.map((r) => `<tr><td style="${cell};padding-left:16px"><b>${esc(jobName(r))}</b>${addrOf(r) ? small(addrOf(r)) : ''}${r.note ? small(r.note) : ''}</td><td style="${cell};text-align:right;white-space:nowrap">${r.workers}</td></tr>`).join('\n')}`).join('\n')}
<tr><td style="text-align:right;padding:10px 6px;font-weight:700">Total</td><td style="text-align:right;padding:10px 6px;font-weight:700">${people}</td></tr>
</table>`
  /* each part the same: its name, then one line a job — the job in bold, what to know under it */
  const head = (t: string, n: number) => `<p style="margin:24px 0 6px;font-size:16px;font-weight:700">${esc(t)} <span style="color:#7a7569;font-weight:400">· ${n}</span></p>`
  const tbl = (rowsHtml: string) => `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px">${rowsHtml}</table>`
  /* in progress with nobody there that day (or not started yet): which, whose, and when it starts */
  const nobody = off.length ? head(`Nobody there ${dayWords}`, off.length) + tbl(off.map((r) => `<tr><td style="${cell}"><b>${esc(jobName(r))}</b>${small([crewName(r), r.note].filter(Boolean).join(' · '))}</td></tr>`).join('')) : ''
  /* everyone in the loop: the touch-ups still open, and the jobs on hold: what has to happen on each, and why it waits */
  const jobs = Object.entries(d.jobs).filter((x): x is [string, JobLite] => !!x[1])
  const tu = jobs.filter(([, j]) => j.stage === 'punch' && !j.hold).map(([id, j]) => ({ j, open: d.punch.filter((p) => p.jobId === id && p.status !== 'verified') })).filter((x) => x.open.length).sort((a, b) => (a.j.name || '').localeCompare(b.j.name || ''))
  const held = jobs.map(([, j]) => j).filter((j) => j.hold && !['complete', 'closeout'].includes(j.stage || '')).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const tuHtml = tu.length ? head('Touch-ups still open', tu.length) + tbl(tu.map(({ j, open }) => `<tr><td style="${cell}"><b>${esc(j.name)}</b> <span style="color:#7a7569">· ${open.length} ${open.length === 1 ? 'thing' : 'things'} to fix</span>${open.map((p) => small(`• ${p.text}${p.status === 'verify' ? ' (fixed, to check)' : ''}${p.owner ? ` · ${d.shortOf(p.owner) || ''}` : ''}`)).join('')}</td></tr>`).join('')) : ''
  const whyHeld = (j: JobLite) => { const h = j.hold || undefined; return [h?.shortage ? 'Waiting for the tile' : h?.reason || 'On hold', h?.since ? `since ${h.since}` : '', h?.until ? `until ${h.until}` : ''].filter(Boolean).join(' · ') }
  const heldHtml = held.length ? head('On hold', held.length) + tbl(held.map((j) => `<tr><td style="${cell}"><b>${esc(j.name)}</b>${small(whyHeld(j))}</td></tr>`).join('')) : ''
  const sum = [`${on.length} ${on.length === 1 ? 'job' : 'jobs'}`, `${people} ${people === 1 ? 'person' : 'people'}`, tu.length ? `${tu.length} with touch-ups` : '', held.length ? `${held.length} on hold` : '', `from ${d.by}`].filter(Boolean).join(' · ')
  const title = o.morning ? `Where the crews are today, ${dayWords}` : `Where the crews are ${dayWords}`
  const again = o.morning ? 'Last night’s list, again this morning.' : ''
  const html = mailFrame(d.site, `<p style="margin:0 0 4px;font-size:18px;font-weight:700">${esc(title)}</p>
<p style="margin:0;color:#5b5f68">${esc(sum)}</p>${again ? `\n<p style="margin:2px 0 0;color:#7a7569;font-size:13px">${esc(again)}</p>` : ''}
${crewTbl}${nobody}${tuHtml}${heldHtml}`)
  const text = [
    title, sum, ...(again ? [again] : []), '',
    ...groups.flatMap((g) => [`${g.c} · ${g.n}`, ...g.list.map((r) => `   ${jobName(r)}${addrOf(r) ? ` (${addrOf(r)})` : ''} · ${r.workers}${r.note ? ` · ${r.note}` : ''}`)]),
    '', `Total: ${people}`,
    ...(off.length ? ['', `Nobody there ${dayWords}`, ...off.map((r) => `   ${jobName(r)} · ${[crewName(r), r.note].filter(Boolean).join(' · ')}`)] : []),
    ...(tu.length ? ['', 'Touch-ups still open', ...tu.flatMap(({ j, open }) => [`${j.name}`, ...open.map((p) => `   • ${p.text}`)])] : []),
    ...(held.length ? ['', 'On hold', ...held.map((j) => `   ${j.name} · ${whyHeld(j)}`)] : []),
  ].join('\n')
  return { subject, html, text }
}
