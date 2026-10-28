/* The Delete window — one question, what goes with it, a red button. For a project, an estimate, a client, or
 * starting over. A project or estimate with work in it says what's in it, only the admin can delete it, and only by
 * typing DELETE — so nothing gets lost by a slip. A bare one (a double, a test) goes with one click. */
import * as React from 'react'
import { Trash2, ShieldAlert } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { REAL } from '@/tileos/lib/save'
import { deleteJob, deleteEstimate, deleteClient, startOver, jobTies, jobWork, estimateWork } from './cleanup'

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
  /* work in it: what would be lost — then only the admin, typing DELETE */
  const work = kind === 'job' && id ? jobWork(id) : kind === 'estimate' && id ? [...estimateWork(id), ...(onlyEst && job ? jobWork(job.id).filter((w) => !/estimate/.test(w)) : [])] : []
  const guarded = kind === 'all' || work.length > 0
  const admin = s.role === 'owner'
  const typed = word.trim().toUpperCase() === 'DELETE'
  const can = kind === 'client' ? clientJobs === 0 : guarded ? typed && (kind === 'all' || admin) : true
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
      {work.length > 0 && kind !== 'all' && (
        <div className="mt-4 rounded-xl border border-warn-100 bg-warn-50 px-3.5 py-3" data-delete-guard>
          <div className="flex items-center gap-2 text-[0.84375rem] font-semibold text-warn-800"><ShieldAlert className="h-4 w-4 shrink-0" />There’s work in it</div>
          <div className="mt-1 text-[0.8125rem] leading-snug text-warn-800">{work.join(' · ')}</div>
          {!admin && <div className="mt-2 text-[0.8125rem] font-semibold text-warn-800" data-delete-admin-only>Only the admin can delete it.</div>}
        </div>
      )}
      {work.length > 0 && kind !== 'all' && admin && <TextInput autoFocus className="mt-3" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Type DELETE to be sure" aria-label="Type DELETE to be sure" />}
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
