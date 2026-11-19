/* Follow up on a PO by email, right from where you are (the PO, its to-do): a small window over the button with the
 * words to the store — typed over if you like — and Send. It goes on the order's own email (a reply to it), so the
 * store sees one thread for the PO; their answer comes to you. The to-do comes back tomorrow if they still don't answer. */
import * as React from 'react'
import { Mail, Send } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button, TextArea } from '@/tileos/components/ui/core'
import { Pop } from '@/tileos/components/ui/overlay'
import type { PO } from '@/tileos/data/work'
import { mailLive, followWords, emailFollow, supplierEmails } from './mailout'

/** email follow-ups work here: the real app with email set up */
export const canEmailFollow = () => mailLive()

export function POFollowUp({ po, onSent, className, primary }: { po: PO; /** after it went (the window closes) */ onSent?: () => void; className?: string; primary?: boolean }) {
  const s = useStore()
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const to = supplierEmails(s, po.supplier)
  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    const ok = await emailFollow(po.id, text.trim())
    setBusy(false)
    if (ok) { setOpen(false); onSent?.() }
  }
  return (
    <Pop
      open={open}
      onOpenChange={(o) => { setOpen(o); if (o) setText(followWords(useStore.getState(), po)) }}
      side="top"
      align="start"
      width={440}
      trigger={<Button variant={primary ? 'primary' : undefined} icon={<Mail />} className={className} data-po-follow={po.id}>Follow up</Button>}
    >
      <div data-po-follow-box>
        <div className="text-[0.9375rem] font-semibold text-ink">Follow up with {po.supplier}</div>
        <div className="mt-0.5 text-[0.8125rem] leading-snug text-muted" data-po-follow-to>{to.length ? <>To {to.join(', ')} · on the same email as {po.id}</> : `${po.supplier} has no email in Tile OS. Add it under Suppliers, or call them.`}</div>
        <TextArea className="mt-3" rows={8} value={text} onChange={(e) => setText(e.target.value)} aria-label="The follow-up" data-po-follow-message />
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Not now</Button>
          <Button variant="primary" icon={<Send />} disabled={!text.trim() || !to.length || busy} onClick={send} data-po-follow-send>{busy ? 'Sending…' : 'Send it'}</Button>
        </div>
      </div>
    </Pop>
  )
}
