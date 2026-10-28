/* One of a client's people — the GC's project manager, the super, accounts payable: their name, what they do, and
 * every phone and email they have. Added from the client's People tab; changed or taken off from the same place.
 * The first one is the client's main contact (the client's own details) — it can be changed, not taken off. */
import * as React from 'react'
import { Trash2, Check } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { CUSTOMERS } from '@/tileos/data/jobs'
import type { Reach } from '@/tileos/data/model'
import { MoreReach, cleanReach, reachOk, isEmail } from './reach'

const field = (label: string, el: React.ReactNode) => (
  <label className="block min-w-0"><span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2">{label}</span>{el}</label>
)

export function ContactModal({ clientId, index, level }: { clientId: string; index?: number; level: number }) {
  const s = useStore()
  const c = s.clients[clientId] || CUSTOMERS[clientId]
  const was = index != null ? c?.contacts?.[index] : undefined
  const [name, setName] = React.useState(was?.name || '')
  const [role, setRole] = React.useState(was?.role || '')
  const [phone, setPhone] = React.useState(was?.phone || '')
  const [email, setEmail] = React.useState(was?.email || '')
  const [more, setMore] = React.useState<Reach[]>(() => (was?.more || []).map((r) => ({ ...r })))
  if (!c) return null
  const badMain = !!email.trim() && !isEmail(email)
  const ok = !!(name.trim() || role.trim()) && !badMain && reachOk(more)
  const label = (x?: { name: string; role: string }) => x?.name || x?.role || 'This person'
  const save = () => {
    const rec = { name: name.trim(), role: role.trim() || 'Contact', phone: phone.trim(), email: email.trim(), more: cleanReach(more) }
    s.commit((st) => {
      const x = st.clients[clientId] || (CUSTOMERS[clientId] ? (st.clients[clientId] = JSON.parse(JSON.stringify(CUSTOMERS[clientId]))) : undefined)
      if (!x) return
      x.contacts ||= []
      if (index != null && x.contacts[index]) x.contacts[index] = rec
      else x.contacts.push(rec)
    }, `${label(rec)} — saved`, { close: true, sub: was ? undefined : `On ${c.name}’s people.` })
  }
  const remove = () => {
    if (index == null || index === 0) return
    s.commit((st) => {
      const x = st.clients[clientId] || (CUSTOMERS[clientId] ? (st.clients[clientId] = JSON.parse(JSON.stringify(CUSTOMERS[clientId]))) : undefined)
      if (x?.contacts?.[index]) x.contacts.splice(index, 1)
    }, `${label(was)} taken off`, { close: true })
  }
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={was ? label(was) : 'Add a person'}
      sub={was ? `${c.name}${index === 0 ? ' · main contact' : ''}` : `Someone at ${c.name} — the PM, the super, who pays the bills`}
      footer={
        <>
          {was && index ? <Button variant="ghost" className="text-bad-600" icon={<Trash2 />} onClick={remove}>Take them off</Button> : null}
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Check />} disabled={!ok} onClick={save}>{was ? 'Save' : 'Add them'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5" data-contact-form>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {field('Name', <TextInput data-autofocus aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dana Ruiz" className="h-10" />)}
          {field('What they do', <TextInput aria-label="What they do" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Project manager" className="h-10" />)}
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {field('Phone', <TextInput aria-label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(718) 555-0100" className="h-10" />)}
          {field('Email', <TextInput aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="h-10" />)}
        </div>
        {badMain && <div className="-mt-2 text-[0.75rem] font-medium text-bad-600">That isn’t an email address</div>}
        <div>
          <div className="mb-1.5 text-[0.8125rem] font-medium text-ink-2">More phones and emails</div>
          <MoreReach value={more} onChange={setMore} />
        </div>
      </div>
    </Modal>
  )
}
