/* Someone on the team — their name (it shows the same everywhere), the email they sign in with, their phone, and more
 * phones and emails. Opened from Settings → Team. */
import * as React from 'react'
import { Check } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, TextInput } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { ROLES, type PersonKey, type Reach } from '@/tileos/data/model'
import { updateMember } from './team'
import { MoreReach, cleanReach, reachOk, isEmail } from './reach'

const field = (label: string, el: React.ReactNode) => (
  <label className="block min-w-0"><span className="mb-1.5 block text-[0.8125rem] font-medium text-ink-2">{label}</span>{el}</label>
)

export function MemberModal({ k, level }: { k: PersonKey; level: number }) {
  const s = useStore()
  const m = s.team.find((x) => x.key === k)
  const [first, setFirst] = React.useState(m?.first || '')
  const [last, setLast] = React.useState(m?.last || '')
  const [email, setEmail] = React.useState(m?.email || '')
  const [phone, setPhone] = React.useState(m?.phone || '')
  const [more, setMore] = React.useState<Reach[]>(() => (m?.more || []).map((r) => ({ ...r })))
  if (!m) return null
  /* once they sign in, the email is their login — it changes only with the login */
  const locked = !!m.uid
  const badMain = !!email.trim() && !isEmail(email)
  const ok = !!first.trim() && !badMain && reachOk(more)
  const save = () => {
    const name = [first.trim(), last.trim()].filter(Boolean).join(' ')
    updateMember(k, { first: first.trim(), last: last.trim() || undefined, ...(locked ? {} : { email: email.trim() || undefined }), phone: phone.trim() || undefined, more: cleanReach(more) }, `Saved — it shows as ${name} everywhere`)
    s.close()
  }
  const role = ROLES.find((r) => r.key === m.role)?.label.split(' · ')[0]
  return (
    <Modal
      level={level}
      size="md"
      onClose={s.close}
      title={[m.first, m.last].filter(Boolean).join(' ') || 'Team member'}
      sub={role ? `${role} login` : undefined}
      footer={<><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" icon={<Check />} disabled={!ok} onClick={save}>Save</Button></>}
    >
      <div className="flex flex-col gap-3.5" data-member-form>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {field('First name', <TextInput data-autofocus aria-label="First name" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" className="h-10" />)}
          {field('Last name', <TextInput aria-label="Last name" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" className="h-10" />)}
        </div>
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {field(locked ? 'Email — their login' : 'Email to sign in', <TextInput aria-label="Email to sign in" type="email" value={email} disabled={locked} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="h-10" />)}
          {field('Phone', <TextInput aria-label="Phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(718) 555-0100" className="h-10" />)}
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
