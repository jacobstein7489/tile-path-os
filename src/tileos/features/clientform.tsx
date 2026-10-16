/* A client — new, or changing one that's there: the details the office needs, and a card on file without anyone
 * typing a card number (the client gets a secure QuickBooks Payments link and adds it there; we keep only the brand
 * and last 4). */
import * as React from 'react'
import { Lock, Building2, User, Check } from 'lucide-react'
import { useStore, NOW } from '@/tileos/store'
import { Button, Chip, Field, TextInput, TextArea } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { CUSTOMERS } from '@/tileos/data/jobs'

export function NewClientModal({ level, id: editId }: { level: number; id?: string }) {
  const s = useStore()
  const was = editId ? s.clients[editId] || CUSTOMERS[editId] : undefined
  const main = was?.contacts?.[0]
  const [kind, setKind] = React.useState<'company' | 'person'>(was && /home|owner|person/i.test(was.kind) ? 'person' : 'company')
  const [company, setCompany] = React.useState(was?.name || '')
  const [first, setFirst] = React.useState(main?.name?.split(' ')[0] || '')
  const [last, setLast] = React.useState(main?.name?.split(' ').slice(1).join(' ') || '')
  const [email, setEmail] = React.useState(was?.email || main?.email || '')
  const [phone, setPhone] = React.useState(was?.phone || main?.phone || '')
  const [street, setStreet] = React.useState(was ? was.address.split(',')[0]?.trim() || '' : '')
  const [city, setCity] = React.useState(was?.city || (was ? was.address.split(',')[1]?.trim() || '' : ''))
  const [zip, setZip] = React.useState(was?.zip || '')
  const [country, setCountry] = React.useState(was?.country || 'United States')
  const [comment, setComment] = React.useState(was?.notes || '')
  const [card, setCard] = React.useState(!was)
  const person = [first.trim(), last.trim()].filter(Boolean).join(' ')
  const name = kind === 'company' ? company.trim() : person
  const ok = editId ? !!name : !!name && !!first.trim() && /\S+@\S+\.\S+/.test(email)
  /* changing a client that's there: the details change everywhere it shows (its projects too) */
  const update = () => {
    if (!editId) return
    s.commit((st) => {
      const c = st.clients[editId] || (CUSTOMERS[editId] ? (st.clients[editId] = JSON.parse(JSON.stringify(CUSTOMERS[editId]))) : undefined)
      if (!c) return
      c.name = name
      c.kind = kind === 'company' ? (/home|owner/i.test(c.kind) ? 'General contractor' : c.kind) : 'Homeowner'
      c.address = [street.trim(), city.trim(), zip.trim()].filter(Boolean).join(', ')
      c.phone = phone.trim()
      c.email = email.trim()
      c.notes = comment.trim()
      c.city = city.trim() || undefined
      c.zip = zip.trim() || undefined
      c.country = country
      if (person) {
        if (c.contacts?.length) c.contacts[0] = { ...c.contacts[0], name: person, phone: phone.trim(), email: email.trim() }
        else c.contacts = [{ name: person, role: kind === 'company' ? 'Main contact' : 'Owner', phone: phone.trim(), email: email.trim() }]
      }
      if (card && !c.card) c.card = { status: 'link-sent', sent: NOW }
      Object.values(st.jobs).forEach((j) => { if (j.clientId === editId) j.client = name })
    }, `${name} — saved`, { close: true, sub: card && !was?.card ? `A secure QuickBooks link went to ${email.trim()} to put a card on file.` : 'Its projects show the new details too.' })
  }
  const save = () => {
    if (editId) return update()
    const id = 'c' + Date.now().toString(36)
    const client = {
      id, name, kind: kind === 'company' ? 'General contractor' : 'Homeowner', address: [street.trim(), city.trim(), zip.trim()].filter(Boolean).join(', '),
      phone: phone.trim(), email: email.trim(), notes: comment.trim(), city: city.trim() || undefined, zip: zip.trim() || undefined, country,
      contacts: [{ name: person, role: kind === 'company' ? 'Main contact' : 'Owner', phone: phone.trim(), email: email.trim() }],
      card: card ? { status: 'link-sent', sent: NOW } : undefined,
    }
    s.commit(
      (st) => { st.clients[id] = client as any; st.notices.unshift({ id: 'nc' + id, text: `${name} added as a client`, when: 'Just now', kind: 'pricing', unread: false }) },
      `${name} is a client`,
      { close: true, undo: false, sub: card ? `A secure QuickBooks link went to ${email.trim()} to put a card on file. We’ll only ever see the last 4 digits.` : 'QuickBooks gets the client too.' },
    )
  }
  return (
    <Modal
      level={level}
      size="lg"
      onClose={s.close}
      title={editId ? 'Client details' : 'New client'}
      sub={editId ? was?.name : 'QuickBooks gets the same client by itself.'}
      footer={<>{editId && <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>}<Button className={editId ? '' : 'ml-auto'} variant="primary" icon={<Check />} disabled={!ok} onClick={save}>{editId ? 'Save' : 'Add the client'}</Button></>}
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-2">
          <Chip on={kind === 'company'} onClick={() => setKind('company')} className="h-10 px-4" icon={<Building2 className="h-4 w-4" />}>A company — GC, developer</Chip>
          <Chip on={kind === 'person'} onClick={() => setKind('person')} className="h-10 px-4" icon={<User className="h-4 w-4" />}>A person — homeowner</Chip>
        </div>
        {kind === 'company' && <Field label="Company name"><TextInput data-autofocus value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Ocean Ave Partners" /></Field>}
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="First name"><TextInput value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          <Field label="Last name"><TextInput value={last} onChange={(e) => setLast(e.target.value)} /></Field>
          <Field label="Email"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></Field>
          <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(718) 555-0100" /></Field>
        </div>
        <div className="grid grid-cols-[2fr_1.2fr_0.8fr_1.2fr] gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
          <Field label="Street"><TextInput value={street} onChange={(e) => setStreet(e.target.value)} /></Field>
          <Field label="City"><TextInput value={city} onChange={(e) => setCity(e.target.value)} placeholder="Brooklyn" /></Field>
          <Field label="Zip"><TextInput value={zip} onChange={(e) => setZip(e.target.value)} inputMode="numeric" /></Field>
          <Field label="Country"><TextInput value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
        </div>
        <Field label="Comment"><TextArea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How they like to work, who approves changes, payment terms…" /></Field>
        {was?.card ? <div className="flex items-center gap-2 rounded-2xl border border-line px-4 py-3 text-[0.84375rem] text-ink-2"><Lock className="h-4 w-4 text-ok-600" />{was.card.status === 'on-file' ? `Card on file · ${was.card.brand || 'Card'} ···· ${was.card.last4 || ''}` : `Card link sent ${was.card.sent || ''} — waiting for them to add it`}</div> :
        <button onClick={() => setCard(!card)} className={cn('flex items-start gap-3 rounded-2xl border p-4 text-left transition', card ? 'border-brand-300 bg-brand-50/50' : 'border-line hover:bg-wash')}>
          <span className={cn('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[0.375rem] border-2', card ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9c2b7]')}>{card && <Check className="h-3 w-3" strokeWidth={3.4} />}</span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[0.90625rem] font-semibold text-ink"><Lock className="h-4 w-4 text-ok-600" />Card on file — send them a secure link</span>
            <span className="mt-0.5 block text-[0.8125rem] leading-snug text-muted">They add the card on QuickBooks Payments’ own page. Nobody here types or sees the number; we keep only “Visa ···· 4242” to charge deposits and invoices with their OK.</span>
          </span>
        </button>}
      </div>
    </Modal>
  )
}
