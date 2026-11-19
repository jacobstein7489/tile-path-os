/* A job's own people — the homeowner, the designer, the super — each with a phone. A client like "NJ Private Customer"
 * stands for many homeowners, so each job keeps who to call: added on the project's People, shown under its name. */
import * as React from 'react'
import { Check, Trash2 } from 'lucide-react'
import { useStore, addHist, meOf } from '@/tileos/store'
import { Button, Field, TextInput, Chip } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import type { JobContact } from '@/tileos/data/model'

const ROLES = ['Homeowner', 'Designer', 'Super', 'Architect']

/** add or change one of the job's people (index: which one; none: a new one) */
export function JobContactModal({ jobId, index, level }: { jobId: string; index?: number; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const cur: JobContact | undefined = index != null ? job?.contacts?.[index] : undefined
  const [name, setName] = React.useState(cur?.name || '')
  const [role, setRole] = React.useState(cur?.role || (job?.contacts?.length ? '' : 'Homeowner'))
  const [phone, setPhone] = React.useState(cur?.phone || '')
  const [email, setEmail] = React.useState(cur?.email || '')
  if (!job) return null
  const ok = !!name.trim() && (!!phone.trim() || !!email.trim() || !!cur)
  const save = () => {
    if (!ok) return
    const c: JobContact = { name: name.trim(), ...(role.trim() ? { role: role.trim() } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}), ...(email.trim() ? { email: email.trim() } : {}) }
    s.commit((st) => {
      const j = st.jobs[jobId]
      if (!j) return
      const list = [...(j.contacts || [])]
      if (index != null && list[index]) list[index] = c
      else list.push(c)
      j.contacts = list
      addHist(st, jobId, { who: meOf(st.role), kind: 'setup', title: `${index != null ? 'Changed' : 'Added'} ${c.name}${c.role ? ` · ${c.role.toLowerCase()}` : ''}`, detail: [c.phone, c.email].filter(Boolean).join(' · ') })
    }, index != null ? `${c.name} saved` : `${c.name} is on ${job.name}`, { sub: 'Under the project’s name, and on its People.' })
    s.close()
  }
  const remove = () => {
    if (index == null) return
    s.commit((st) => { const j = st.jobs[jobId]; if (j?.contacts) j.contacts = j.contacts.filter((_, i) => i !== index) }, `${cur?.name || 'Contact'} taken off ${job.name}`)
    s.close()
  }
  return (
    <Modal
      level={level}
      size="sm"
      onClose={s.close}
      title={cur ? cur.name : 'Someone to call on this job'}
      sub={cur ? job.name : `${job.name}. The homeowner, the designer, the super. Only this job.`}
      footer={
        <>
          {cur && <Button variant="ghost" icon={<Trash2 />} onClick={remove} data-contact-remove>Take off</Button>}
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Check />} disabled={!ok} onClick={save} data-contact-save>Save</Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="Name"><TextInput data-autofocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Levi" data-contact-name /></Field>
        <Field label="Who they are">
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => <Chip key={r} on={role === r} onClick={() => setRole(role === r ? '' : r)} className="h-8">{r}</Chip>)}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Phone"><TextInput type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="732-555-0101" autoComplete="off" data-contact-phone /></Field>
          <Field label="Email (optional)"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" data-contact-email /></Field>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
