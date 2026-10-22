/* Touch-ups and punch lists: log a whole list at once, say who does it and by when.
 * The installer crew (or one of us) gets it; the site manager gets a task to check each item once it's fixed. */
import * as React from 'react'
import { Sparkles, HardHat, Building2, CalendarDays, CheckCheck, Camera, X, Plus } from 'lucide-react'
import { useStore, meOf, NOW, newTask, addHist } from '@/tileos/store'
import { Button, Avatar, TextArea, Field, Chip } from '@/tileos/components/ui/core'
import { Modal, DatePresets } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, type PersonKey } from '@/tileos/data/model'
import { isOff } from './active'
import { keepFiles } from '@/tileos/lib/files'
import { FormHead, FormRow, ProjectField } from './formkit'

/** a small rounded picker — the same as on a new task */
const CHIP = 'h-8 w-auto max-w-[16.25rem] gap-1.5 rounded-full border-[#d9d3c9] pl-2.5 pr-2.5 text-[0.8125rem] font-medium text-ink-2 [&>span:nth-child(2)]:flex-initial'
/** "Master bath — caulk the tub" → where + what; plain lines go to "To place" */
const split = (line: string) => {
  const m = line.match(/^\s*([^—:\-]{2,40})\s*[—:\-]\s*(.+)$/)
  return m ? { where: m[1].trim(), text: m[2].trim() } : { where: 'To place', text: line.trim() }
}

type Line = { id: number; text: string; files: File[] }
export function PunchNewModal({ jobId: jobId0, level }: { jobId?: string; level: number }) {
  const s = useStore()
  const [jobId, setJobId] = React.useState(jobId0 || '')
  const job = s.jobs[jobId]
  /* one line per touch-up — each with its own photos; Enter adds the next line */
  const [rows, setRows] = React.useState<Line[]>([{ id: 1, text: '', files: [] }, { id: 2, text: '', files: [] }, { id: 3, text: '', files: [] }])
  const next = React.useRef(4)
  const inputs = React.useRef<Record<number, HTMLInputElement | null>>({})
  const crew0 = (job?.crew || s.bookings.find((b) => b.jobId === jobId)?.crew) as PersonKey | undefined
  const [who, setWho] = React.useState<PersonKey | ''>(crew0 || '')
  const [due, setDue] = React.useState('Fri')
  const [checker, setChecker] = React.useState<PersonKey>('yakov')
  React.useEffect(() => { if (!who && crew0) setWho(crew0) }, [jobId])
  const filled = rows.filter((r) => r.text.trim())
  const projects = Object.values(s.jobs).filter((j) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage))
  const setText = (id: number, text: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, text } : r)))
  const addRow = (after?: number) => {
    const id = next.current++
    setRows((rs) => { const i = after == null ? rs.length : rs.findIndex((r) => r.id === after) + 1; return [...rs.slice(0, i), { id, text: '', files: [] }, ...rs.slice(i)] })
    setTimeout(() => inputs.current[id]?.focus(), 30)
  }
  const removeRow = (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs))
  const addFiles = (id: number, list: FileList | null) => { if (list?.length) setRows((rs) => rs.map((r) => (r.id === id ? { ...r, files: [...r.files, ...Array.from(list)] } : r))) }
  const save = async () => {
    const owner = who as PersonKey
    const items = filled.map((r) => ({ ...split(r.text), files: r.files }))
    const stamp = Date.now()
    const ids = items.map((_, i) => `pu${stamp}${i}`)
    s.commit((st) => {
      const tid = 't' + stamp.toString(36)
      items.forEach((it, i) => st.punch.push({ id: ids[i], jobId, text: it.text, where: it.where, owner, status: 'open', note: `Due ${due}`, taskId: tid }))
      const crewDoes = !!PEOPLE[owner]?.crew
      newTask(st, {
        id: tid, jobId, title: crewDoes ? `Touch-ups at ${st.jobs[jobId].name} — check them when ${PEOPLE[owner].short} is done` : `Touch-ups at ${st.jobs[jobId].name}`,
        type: 'Field', owner: crewDoes ? checker : owner, for: crewDoes ? ['site'] : ['site', 'owner'], state: 'now', due, tone: 'warn',
        where: `${items.length} item${items.length > 1 ? 's' : ''}${crewDoes ? ` · ${PEOPLE[owner].name}’s crew` : ''}`,
        detail: items.map((it) => `• ${it.where !== 'To place' ? it.where + ' — ' : ''}${it.text}`).join('\n'),
        action: { label: 'Open the list', kind: 'tab:touchups' }, followers: crewDoes ? [] : [checker],
        log: [{ date: NOW, who: meOf(st.role), text: `${items.length} touch-up${items.length > 1 ? 's' : ''} logged · due ${due}` }],
      } as any)
      addHist(st, jobId, { who: meOf(st.role), kind: 'field', title: `${items.length} touch-up${items.length > 1 ? 's' : ''} logged`, detail: `${PEOPLE[owner].name} · due ${due}` })
    }, `${items.length} touch-up${items.length > 1 ? 's' : ''} logged`, {
      sub: PEOPLE[owner]?.crew ? `${PEOPLE[owner].name}’s crew does them by ${due}; ${PEOPLE[checker].short} checks each one.` : `${PEOPLE[owner].short} has them, due ${due}.`,
      to: PEOPLE[owner]?.crew ? [{ who: owner, what: `${items.length} touch-ups · ${due}` }, { who: checker, what: 'Check them when fixed' }] : [{ who: owner, what: `${items.length} touch-ups · ${due}` }],
      close: true,
    })
    /* the photos go with each line, kept with the project's files */
    for (let i = 0; i < items.length; i++) {
      if (!items[i].files.length) continue
      const { recs } = await keepFiles(jobId, items[i].files, 'photo', { quiet: true })
      if (recs.length) useStore.getState().commit((st) => { const x = st.punch.find((y) => y.id === ids[i]); if (x) x.media = [...(x.media || []), ...recs.map((r) => r.id)] })
    }
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={job ? `Touch-ups · ${job.name}` : 'Touch-ups'}
      header={<FormHead k="punch" kicker={jobId0 && job ? job.name : undefined} title="Touch-ups" />}
      bodyClass="px-6 py-5 max-sm:px-4"
      footer={
        <>
          <span className="truncate text-[0.8125rem] text-muted max-sm:hidden">{who && PEOPLE[who]?.crew ? `${PEOPLE[who].short}’s crew sees them on the phone · ${PEOPLE[checker].short} checks` : filled.length ? `${filled.length} on the list` : 'Each line its own touch-up, with its own photos'}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Sparkles />} disabled={!jobId || !filled.length || !who} onClick={save}>Log {filled.length || ''} touch-up{filled.length === 1 ? '' : 's'}</Button>
        </>
      }
    >
      {!jobId0 && <FormRow label="Project"><ProjectField value={jobId} onChange={setJobId} keep={(j) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage)} autoFocus /></FormRow>}
      <FormRow label="The touch-ups">
      <div className="overflow-hidden rounded-[0.875rem] border border-line bg-white" role="list" aria-label="The touch-ups">
        {rows.map((r, i) => (
          <div key={r.id} role="listitem" className="flex items-center gap-2 border-t border-line-2 py-1.5 pl-3 pr-2 first:border-t-0">
            <span className="w-5 shrink-0 text-center text-[0.78125rem] font-semibold tnum text-faint">{i + 1}</span>
            <input
              ref={(el) => { inputs.current[r.id] = el }}
              data-autofocus={i === 0 ? true : undefined}
              aria-label={`Touch-up ${i + 1}`}
              value={r.text}
              onChange={(e) => setText(r.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (r.text.trim()) addRow(r.id) } else if (e.key === 'Backspace' && !r.text && rows.length > 1) { e.preventDefault(); removeRow(r.id); const prev = rows[i - 1]; if (prev) setTimeout(() => inputs.current[prev.id]?.focus(), 20) } }}
              placeholder={i === 0 ? 'Master bath — caulk around the tub' : i === 1 ? 'Hall bath — replace 2 chipped tiles' : 'Next one…'}
              className="h-9 min-w-0 flex-1 bg-transparent text-[0.9375rem] text-ink outline-none placeholder:text-faint"
            />
            {r.files.length > 0 && <span className="shrink-0 text-[0.78125rem] font-semibold text-brand-700">{r.files.length} {r.files.length === 1 ? 'photo' : 'photos'}</span>}
            <label className={cn('inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition', r.files.length ? 'bg-brand-50 text-brand-600' : 'text-muted hover:bg-wash-2 hover:text-ink')} title="Add photos or a video">
              <Camera className="h-4 w-4" />
              <input type="file" accept="image/*,video/*" multiple capture="environment" className="sr-only" aria-label={`Photos for touch-up ${i + 1}`} onChange={(e) => { addFiles(r.id, e.target.files); e.target.value = '' }} />
            </label>
            {rows.length > 1 && <button type="button" aria-label={`Take off touch-up ${i + 1}`} onClick={() => removeRow(r.id)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-wash-2 hover:text-ink"><X className="h-4 w-4" /></button>}
          </div>
        ))}
        <button type="button" onClick={() => addRow()} className="flex w-full items-center gap-2 border-t border-line-2 px-3 py-2 text-left text-[0.8125rem] font-semibold text-brand-700 hover:bg-[#f8f6f2]"><Plus className="h-4 w-4" />Another one</button>
      </div>
      </FormRow>
      {/* who does them and by when — the same two dropdowns as every form; who checks, when a crew does them */}
      <FormRow label="Who does them">
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <SearchSelect label="Who does them" value={who} onChange={(k) => setWho(k as PersonKey)} options={[...CREWS.filter((c) => !isOff(s, 'crew', c)).map((c) => ({ key: c, label: PEOPLE[c].name, hint: c === crew0 ? 'On this job' : 'Installer', lead: <Avatar who={c} size={22} /> })), ...(['yakov', 'ys'] as PersonKey[]).map((p) => ({ key: p, label: PEOPLE[p].name, hint: PEOPLE[p].roleLabel, lead: <Avatar who={p} size={22} /> }))]} placeholder="Who does them" width={280} plain />
          <SearchSelect label="Done by" value={due} onChange={setDue} options={['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon', 'In 2 weeks'].map((d) => ({ key: d, label: `By ${d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : d}` }))} search={false} width={220} icon={<CalendarDays />} />
        </div>
      </FormRow>
      {who && PEOPLE[who]?.crew && (
        <FormRow label="Who checks them">
          <SearchSelect label="Who checks them" value={checker} onChange={(k) => setChecker(k as PersonKey)} options={(['yakov', 'ys'] as PersonKey[]).map((p) => ({ key: p, label: `${PEOPLE[p].short} checks`, hint: PEOPLE[p].roleLabel, lead: <Avatar who={p} size={22} /> }))} search={false} width={260} icon={<CheckCheck />} plain />
        </FormRow>
      )}
    </Modal>
  )
}
