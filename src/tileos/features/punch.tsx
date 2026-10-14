/* Touch-ups and punch lists: log a whole list at once, say who does it and by when.
 * The installer crew (or one of us) gets it; the site manager gets a task to check each item once it's fixed. */
import * as React from 'react'
import { Sparkles, HardHat } from 'lucide-react'
import { useStore, meOf, NOW, newTask, addHist } from '@/tileos/store'
import { Button, Avatar, TextArea, Field, Chip } from '@/tileos/components/ui/core'
import { Modal, DatePresets } from '@/tileos/components/ui/overlay'
import { SearchSelect } from '@/tileos/components/ui/select'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, CREWS, type PersonKey } from '@/tileos/data/model'
import { isOff } from './active'

/** "Master bath — caulk the tub" → where + what; plain lines go to "To place" */
const split = (line: string) => {
  const m = line.match(/^\s*([^—:\-]{2,40})\s*[—:\-]\s*(.+)$/)
  return m ? { where: m[1].trim(), text: m[2].trim() } : { where: 'To place', text: line.trim() }
}

export function PunchNewModal({ jobId: jobId0, level }: { jobId?: string; level: number }) {
  const s = useStore()
  const [jobId, setJobId] = React.useState(jobId0 || '')
  const job = s.jobs[jobId]
  const [text, setText] = React.useState('')
  const crew0 = (job?.crew || s.bookings.find((b) => b.jobId === jobId)?.crew) as PersonKey | undefined
  const [who, setWho] = React.useState<PersonKey | ''>(crew0 || '')
  const [due, setDue] = React.useState('Fri')
  const [checker, setChecker] = React.useState<PersonKey>('yakov')
  React.useEffect(() => { if (!who && crew0) setWho(crew0) }, [jobId])
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const projects = Object.values(s.jobs).filter((j) => !['request', 'estimating', 'proposal', 'followup'].includes(j.stage))
  const save = () => {
    const owner = who as PersonKey
    const items = lines.map(split)
    s.commit((st) => {
      const tid = 't' + Date.now().toString(36)
      items.forEach((it, i) => st.punch.push({ id: `pu${Date.now()}${i}`, jobId, text: it.text, where: it.where, owner, status: 'open', note: `Due ${due}`, taskId: tid }))
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
    }, `${lines.length} touch-up${lines.length > 1 ? 's' : ''} logged`, {
      sub: PEOPLE[owner]?.crew ? `${PEOPLE[owner].name}’s crew does them by ${due}; ${PEOPLE[checker].short} checks each one.` : `${PEOPLE[owner].short} has them, due ${due}.`,
      to: PEOPLE[owner]?.crew ? [{ who: owner, what: `${lines.length} touch-ups · ${due}` }, { who: checker, what: 'Check them when fixed' }] : [{ who: owner, what: `${lines.length} touch-ups · ${due}` }],
      close: true,
    })
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={job ? `Touch-ups · ${job.name}` : 'Touch-ups or a punch list'}
      sub="Type the whole list — one item per line. “Master bath — caulk the tub” puts it in the right room."
      footer={
        <>
          <span className="text-[0.8125rem] text-muted">{lines.length ? `${lines.length} item${lines.length > 1 ? 's' : ''}` : 'Nothing yet'}</span>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Sparkles />} disabled={!jobId || !lines.length || !who} onClick={save}>Log {lines.length || ''} touch-up{lines.length === 1 ? '' : 's'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!jobId0 && (
          <Field label="Project">
            <SearchSelect value={jobId} onChange={setJobId} placeholder="Type a project name" options={projects.map((j) => ({ key: j.id, label: j.name, hint: j.client }))} />
          </Field>
        )}
        <Field label="What needs fixing">
          <TextArea data-autofocus value={text} onChange={(e) => setText(e.target.value)} className="min-h-[8.25rem]" placeholder={'Master bath — caulk around the tub\nHall bath — replace 2 chipped floor tiles\nKitchen — grout haze on the backsplash'} />
        </Field>
        <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
          <Field label="Who does them">
            <SearchSelect label="Who does them" value={who} onChange={(k) => setWho(k as PersonKey)} options={[...CREWS.filter((c) => !isOff(s, 'crew', c)).map((c) => ({ key: c, label: PEOPLE[c].name, hint: c === crew0 ? 'On this job' : 'Installer' })), ...(['yakov', 'ys'] as PersonKey[]).map((p) => ({ key: p, label: PEOPLE[p].name, hint: PEOPLE[p].roleLabel }))]} placeholder="Pick who" search={false} width={280} />
          </Field>
          <Field label="Done by">
            <SearchSelect label="Done by" value={due} onChange={setDue} options={['Today', 'Tomorrow', 'Wed', 'Thu', 'Fri', 'Next Mon', 'In 2 weeks'].map((d) => ({ key: d, label: d }))} search={false} width={220} />
          </Field>
          {who && PEOPLE[who]?.crew ? (
            <Field label="Who checks them">
              <SearchSelect label="Who checks them" value={checker} onChange={(k) => setChecker(k as PersonKey)} options={(['yakov', 'ys'] as PersonKey[]).map((p) => ({ key: p, label: PEOPLE[p].name, hint: PEOPLE[p].roleLabel }))} search={false} width={260} />
            </Field>
          ) : <span />}
        </div>
        {who && PEOPLE[who]?.crew && <div className="flex items-start gap-2 rounded-[0.625rem] bg-wash px-3 py-2.5 text-[0.8125rem] text-ink-2"><HardHat className="mt-0.5 h-4 w-4 shrink-0 text-muted" />{PEOPLE[who].name}’s crew sees the list on their phone. {PEOPLE[checker].short} gets a task to check each item once it’s fixed.</div>}
      </div>
    </Modal>
  )
}
