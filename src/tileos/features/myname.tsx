/* Your name, from the account menu: what the team sees everywhere — on tasks, the history, the schedule. Anyone can
 * change their own; the admin changes anyone's in Settings → Team. */
import * as React from 'react'
import { Check } from 'lucide-react'
import { useStore, meOf } from '@/tileos/store'
import { Button, Field, TextInput } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { updateMember } from './team'

export function MyNameModal({ level }: { level: number }) {
  const s = useStore()
  const key = meOf(s.role)
  const m = s.team.find((x) => x.key === key)
  const [first, setFirst] = React.useState(m?.first || '')
  const [last, setLast] = React.useState(m?.last || '')
  const ok = !!first.trim() && !!m
  const same = first.trim() === (m?.first || '') && last.trim() === (m?.last || '')
  const save = () => {
    if (!ok) return
    if (!same) updateMember(key, { first: first.trim(), last: last.trim() || undefined }, 'Your name is saved')
    s.close()
  }
  return (
    <Modal
      level={level}
      size="sm"
      onClose={s.close}
      title="Your name"
      sub="How the team sees you — on tasks, notes and the schedule."
      footer={
        <>
          <Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button>
          <Button variant="primary" icon={<Check />} disabled={!ok} onClick={save} data-my-name-save>Save</Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4 max-sm:grid-cols-1" onSubmit={(e) => { e.preventDefault(); save() }}>
        <Field label="First name"><TextInput data-autofocus value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" data-my-first /></Field>
        <Field label="Last name"><TextInput value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" data-my-last /></Field>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
