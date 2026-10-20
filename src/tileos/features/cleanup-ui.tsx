/* The Delete window — one question, what goes with it, a red button. For a project, an estimate, a client, or
 * starting over (type DELETE for that one — it's everything). */
import * as React from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { REAL } from '@/tileos/lib/save'
import { deleteJob, deleteEstimate, deleteClient, startOver, jobTies } from './cleanup'

export type DeleteKind = 'job' | 'estimate' | 'client' | 'all'

export function DeleteModal({ kind, id, level }: { kind: DeleteKind; id?: string; level: number }) {
  const s = useStore()
  const [word, setWord] = React.useState('')
  const job = kind === 'job' && id ? s.jobs[id] : kind === 'estimate' && id ? s.jobs[s.estimates.find((e) => e.id === id)?.jobId || ''] : undefined
  const est = kind === 'estimate' && id ? s.estimates.find((e) => e.id === id) : undefined
  const client = kind === 'client' && id ? s.clients[id] : undefined
  const clientJobs = client ? Object.values(s.jobs).filter((j) => j.clientId === client.id).length : 0
  const ties = kind === 'job' && id ? jobTies(id) : undefined
  const onlyEst = !!est && !!job && ['request', 'estimating', 'proposal', 'followup'].includes(job.stage) && s.estimates.filter((e) => e.jobId === job.id).length === 1
  const counts = { projects: Object.keys(s.jobs).length, estimates: s.estimates.length, clients: Object.keys(s.clients).length, tasks: s.tasks.filter((t) => t.state !== 'done').length }
  const title = kind === 'all' ? 'Start over?' : kind === 'job' ? `Delete ${job?.name || 'this project'}?` : kind === 'estimate' ? `Delete estimate ${id}?` : `Delete ${client?.name || 'this client'}?`
  const goes = kind === 'job' && ties
    ? [ties.estimates && `${ties.estimates} estimate${ties.estimates === 1 ? '' : 's'}`, ties.tasks && `${ties.tasks} open task${ties.tasks === 1 ? '' : 's'}`, ties.pos && `${ties.pos} purchase order${ties.pos === 1 ? '' : 's'}`, ties.money && `${ties.money} invoice${ties.money === 1 ? '' : 's'} or payment${ties.money === 1 ? '' : 's'}`, ties.punch && `${ties.punch} touch-up${ties.punch === 1 ? '' : 's'}`, ties.files && `${ties.files} file${ties.files === 1 ? '' : 's'}`].filter(Boolean).join(', ')
    : ''
  const can = kind === 'all' ? word.trim().toUpperCase() === 'DELETE' : kind === 'client' ? clientJobs === 0 : true
  const go = () => {
    if (kind === 'job' && id) deleteJob(id)
    else if (kind === 'estimate' && id) deleteEstimate(id)
    else if (kind === 'client' && id) deleteClient(id)
    else if (kind === 'all') startOver()
  }
  return (
    <Modal level={level} size="sm" onClose={s.close} title={title} footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Keep it</Button><Button variant="danger" icon={<Trash2 />} disabled={!can} onClick={go}>{kind === 'all' ? 'Delete everything' : 'Delete it'}</Button></>}>
      {kind === 'job' && <p className="text-[0.875rem] leading-relaxed text-ink-2">The project goes, with everything tied to it{goes ? ` — ${goes}` : ''}. {REAL.cloud ? 'Out of the company’s database, for everyone.' : ''} It can’t be undone.</p>}
      {kind === 'estimate' && <p className="text-[0.875rem] leading-relaxed text-ink-2">{onlyEst ? `The estimate and ${job?.name} go — the project was only ever this estimate.` : `The estimate goes. ${job?.name} stays.`} It can’t be undone.</p>}
      {kind === 'client' && (clientJobs
        ? <p className="text-[0.875rem] leading-relaxed text-ink-2">{client?.name} has {clientJobs} project{clientJobs === 1 ? '' : 's'} — a client with projects can’t be deleted. Mark them inactive instead, or delete the projects first.</p>
        : <p className="text-[0.875rem] leading-relaxed text-ink-2">The client goes, with their contacts and logins. It can’t be undone.</p>)}
      {kind === 'all' && (
        <>
          <p className="text-[0.875rem] leading-relaxed text-ink-2">Every project ({counts.projects}), estimate ({counts.estimates}), client ({counts.clients}) and open task ({counts.tasks}) goes{REAL.cloud ? ' — out of the company’s database, for everyone' : ''}. Your team, logins, items, checklists and settings stay. It can’t be undone.</p>
          <TextInput autoFocus className="mt-4" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Type DELETE to be sure" aria-label="Type DELETE to be sure" />
        </>
      )}
    </Modal>
  )
}
