/* A job's own people — the homeowner, the designer, the super — each with a phone. A client like "NJ Private Customer"
 * stands for many homeowners, so each job keeps who to call: added on the project's People, shown under its name. */
import * as React from 'react'
import { Check, Trash2 } from 'lucide-react'
import { useStore, addHist, meOf } from '@/tileos/store'
import { Button, Field, TextInput, Chip } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import type { JobContact } from '@/tileos/data/model'
import { designerOf, NO_DESIGNER } from '@/tileos/data/directory'
import { fmtPhone } from './reach'

const S = () => useStore.getState()
/** the project's designer: one from Designers (id), or none on it ('' or "none") — written in What happened */
export function setJobDesigner(jobId: string, id: string) {
  const job = S().jobs[jobId]
  if (!job) return
  const was = designerOf(S().designers, job)
  const d = id && id !== NO_DESIGNER ? S().designers.find((x) => x.id === id) : undefined
  /* the same one it has: nothing changes */
  if ((was?.id || '') === (d?.id || '')) return
  S().commit((st) => {
    const j = st.jobs[jobId]
    if (!j) return
    j.designerId = d ? d.id : NO_DESIGNER
    addHist(st, jobId, { who: meOf(st.role), kind: 'setup', title: d ? `Designer: ${d.name}` : 'No designer on it', detail: was && was.id !== d?.id ? `Was ${was.name}` : undefined })
  }, d ? `${d.name} is the designer` : 'No designer on it', { sub: job.name })
}
/** a designer typed in that isn't on the list yet: added to Designers with just the name (the rest from their window) */
export function addDesignerNamed(name: string): string {
  const n = name.trim()
  const same = S().designers.find((d) => d.name.toLowerCase() === n.toLowerCase())
  if (same) return same.id
  const id = 'd' + Date.now().toString(36)
  S().commit((st) => { st.designers.push({ id, name: n, contact: '', phone: '', email: '', clients: [], notes: '' }) }, undefined, { undo: false })
  return id
}

/** one of the job's people taken off it (Undo puts them back) — written in What happened */
export function removeJobContact(jobId: string, index: number) {
  const job = S().jobs[jobId]
  const c = job?.contacts?.[index]
  if (!job || !c) return
  S().commit((st) => {
    const j = st.jobs[jobId]
    if (!j?.contacts) return
    j.contacts = j.contacts.filter((_, i) => i !== index)
    if (!j.contacts.length) delete j.contacts
    addHist(st, jobId, { who: meOf(st.role), kind: 'setup', title: `Took ${c.name} off`, detail: [c.role, c.phone, c.email].filter(Boolean).join(' · ') || undefined })
  }, `${c.name} taken off ${job.name}`)
}

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
    s.close()
    removeJobContact(jobId, index)
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
          <Field label="Phone"><TextInput type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setPhone(fmtPhone(phone))} placeholder="(732) 555-0101" autoComplete="off" data-contact-phone /></Field>
          <Field label="Email (optional)"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setEmail(email.trim().toLowerCase())} autoComplete="off" data-contact-email /></Field>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
