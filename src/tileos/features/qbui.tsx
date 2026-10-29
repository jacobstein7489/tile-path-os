/* QuickBooks and email on the screens (the real app): where a bill stands in QuickBooks, the Settings → Connections
 * cards, and the line on top of Billing. The preview and the sample projects keep their sample look. */
import * as React from 'react'
import { BookOpen, Mail, RefreshCw, ExternalLink, Send, MoreHorizontal, Calendar, MessageCircle, FolderOpen, ChevronDown } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { REAL, appUrl, PUBLISHED } from '@/tileos/lib/save'
import { showPop } from '@/tileos/lib/pop'
import { Button } from '@/tileos/components/ui/core'
import { Card } from '@/tileos/components/ui/page'
import { Menu, MenuItem, MenuSep } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { fmtMoney } from '@/tileos/data/model'
import type { MoneyItem } from '@/tileos/data/work'
import { useQb, pushBill, emailBill, retryUnsent, syncQb, connectQb, disconnectQb, refreshQb, invoicedYet, billTo } from './qbsync'

const ago = (t?: number | string) => {
  if (!t) return ''
  const ms = Date.now() - (typeof t === 'number' ? t : Date.parse(t))
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  return new Date(typeof t === 'number' ? t : Date.parse(t)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
/** the invoice in QuickBooks' own screens */
const qbScreen = (id: string, env?: string) => `https://app.${env === 'sandbox' ? 'sandbox.' : ''}qbo.intuit.com/app/invoice?txnId=${encodeURIComponent(id)}`

/* ---------------- a bill: where it stands in QuickBooks ---------------- */
export function QbBillRow({ m }: { m: MoneyItem }) {
  const s = useStore()
  const qb = useQb()
  const [busy, setBusy] = React.useState('')
  if (!REAL.qb || !REAL.cloud || m.kind === 'custpo' || m.kind === 'change' || !m.amount) return null
  const run = async (k: string, f: () => Promise<unknown>) => { if (busy) return; setBusy(k); try { await f() } finally { setBusy('') } }
  const head = <div className="flex items-center gap-1.5 text-[0.78125rem] font-semibold text-muted"><BookOpen className="h-3.5 w-3.5" />QuickBooks</div>
  const box = (body: React.ReactNode) => <div className="flex flex-col gap-2 border-t border-line-2 pt-3" data-qb-row>{head}{body}</div>
  if (!qb.known) return null
  if (!qb.connected) {
    if (!invoicedYet(m)) return null
    return box(
      <div className="text-[0.8125rem] leading-snug text-muted">
        Not connected yet, so this bill isn’t there.{' '}
        {REAL.admin && <button className="font-semibold text-brand-600 hover:underline" onClick={() => s.go({ page: 'settings', id: 'qb', tab: 'connections' })}>Connect it</button>}
      </div>,
    )
  }
  if (!invoicedYet(m)) return box(<div className="text-[0.8125rem] text-muted">Goes to QuickBooks when it’s sent{m.kind === 'progress' ? ' (after the PM approves it)' : ''}.</div>)
  const to = billTo(s, m.jobId)
  const link = m.qb
  /* not there: never made there, or it didn't go */
  if (!link?.id || link.gone) {
    const failed = !!link?.error && !link.gone
    return box(
      <>
        <div className={cn('text-[0.8125rem] leading-snug', failed ? 'text-bad-700' : 'text-ink-2')}>
          {link?.gone ? 'Deleted in QuickBooks.' : failed ? <>Not in QuickBooks yet — {link!.error}</> : 'Not in QuickBooks — it was invoiced before QuickBooks was connected.'}
        </div>
        <Button size="sm" variant={failed ? 'primary' : 'secondary'} icon={<RefreshCw className={cn('h-3.5 w-3.5', busy === 'push' && 'animate-spin')} />} disabled={!!busy} onClick={() => run('push', () => pushBill(m.id, { findFirst: !failed && !link?.gone }))} data-qb-push>
          {busy === 'push' ? 'Putting it in…' : failed ? 'Try again' : link?.gone ? 'Put it back in QuickBooks' : 'Put it in QuickBooks'}
        </Button>
        {!failed && !link?.gone && <div className="text-[0.75rem] leading-snug text-faint">If accounting made it there already, it’s linked by its number ({m.ref || 'none'}) — never made twice.</div>}
      </>,
    )
  }
  const open = Math.max(0, (m.amount || 0) - (m.paid || 0))
  const differs = link.total !== undefined && Math.abs(link.total - (m.amount || 0)) >= 0.01
  const unsent = (link.unsent || []).reduce((n, p) => n + p.amount, 0)
  return box(
    <>
      <div className="text-[0.8125rem] leading-snug">
        <span className="font-semibold text-ink">In QuickBooks{link.doc ? ` as #${link.doc}` : ''}</span>
        {link.balance !== undefined && <span className="text-muted"> · {link.balance > 0 ? `${fmtMoney(link.balance, { cents: link.balance % 1 !== 0 })} open there` : 'paid there'}</span>}
      </div>
      {differs && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-warn-50 px-3 py-2 text-[0.78125rem] leading-snug text-warn-800">
          <span>QuickBooks has {fmtMoney(link.total!, { cents: link.total! % 1 !== 0 })} on it — Tile OS has {fmtMoney(m.amount || 0)}.</span>
          <button className="self-start font-semibold text-brand-700 hover:underline" disabled={!!busy} onClick={() => run('push', () => pushBill(m.id))}>{busy === 'push' ? 'Sending…' : 'Send Tile OS’s amount to QuickBooks'}</button>
        </div>
      )}
      {unsent > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-bad-50 px-3 py-2 text-[0.78125rem] leading-snug text-bad-700">
          <span>{fmtMoney(unsent)} paid here isn’t in QuickBooks yet.</span>
          <button className="self-start font-semibold hover:underline" disabled={!!busy} onClick={() => run('pay', retryUnsent)}>{busy === 'pay' ? 'Sending…' : 'Send it now'}</button>
        </div>
      )}
      {m.state !== 'paid' && (
        to.emails.length ? (
          <Button size="sm" icon={<Send className="h-3.5 w-3.5" />} disabled={!!busy} onClick={() => run('mail', () => emailBill(m.id))} data-qb-email>
            {busy === 'mail' ? 'Sending…' : link.emailed ? 'Email it again' : `Email it to ${to.emails[0]}`}
          </Button>
        ) : (
          <div className="text-[0.78125rem] leading-snug text-muted">{to.name} has no email for invoices — add it on their page to email it from here.</div>
        )
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[0.75rem] text-faint">
        <span>{link.emailed ? `Emailed ${ago(link.emailed)}${link.emailedTo ? ` to ${link.emailedTo}` : ''}` : open > 0 ? 'Not emailed from here yet' : ''}</span>
        <a href={qbScreen(link.id, qb.env)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">Open in QuickBooks<ExternalLink className="h-3 w-3" /></a>
      </div>
    </>,
  )
}

/* ---------------- Billing: the line on top ---------------- */
export function QbHeaderStatus() {
  const s = useStore()
  const qb = useQb()
  const [busy, setBusy] = React.useState(false)
  if (!REAL.qb || !REAL.cloud || !qb.known) return null
  if (!qb.connected)
    return (
      <button onClick={() => s.go({ page: 'settings', id: 'qb', tab: 'connections' })} className="inline-flex items-center gap-2 text-[0.84375rem] text-muted hover:text-ink" data-qb-head="off">
        <span className="h-2 w-2 rounded-full bg-[#c9c2b7]" />QuickBooks isn’t connected<span className="font-semibold text-brand-600">· Connect</span>
      </button>
    )
  return (
    <button disabled={busy} onClick={async () => { setBusy(true); try { await syncQb({ say: true }) } finally { setBusy(false) } }} className="inline-flex items-center gap-2 text-[0.84375rem] text-muted hover:text-ink" title="Look for payments made in QuickBooks now" data-qb-head="on">
      <span className="h-2 w-2 rounded-full bg-ok-500" />QuickBooks{qb.company ? ` · ${qb.company}` : ''}{qb.pulled ? ` · checked ${ago(qb.pulled)}` : ''}
      <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} />
    </button>
  )
}

/* ---------------- Settings → Connections ---------------- */
const KINDS = [
  { k: 'deposit', label: 'Deposits' },
  { k: 'progress', label: 'Progress bills' },
  { k: 'final', label: 'Final bills' },
  { k: 'retainage', label: 'Retainage' },
  { k: 'change', label: 'Change orders (on a progress bill)' },
] as const
function Status({ tone, children }: { tone: 'ok' | 'off' | 'bad'; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[0.78125rem] font-semibold', tone === 'ok' ? 'bg-ok-50 text-ok-700' : tone === 'bad' ? 'bg-bad-50 text-bad-700' : 'bg-wash-2 text-muted')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', tone === 'ok' ? 'bg-ok-500' : tone === 'bad' ? 'bg-bad-500' : 'bg-[#c9c2b7]')} />{children}
    </span>
  )
}
function Head({ icon, title, status }: { icon: React.ReactNode; title: string; status: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wash-2 text-ink-2">{icon}</span>
      <div className="min-w-0 flex-1 text-[0.9375rem] font-semibold text-ink">{title}</div>
      {status}
    </div>
  )
}
const Code = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-wash-2 px-1 py-0.5 text-[0.78125rem] font-semibold text-ink-2">{children}</code>

export function QbConnectCard() {
  const s = useStore()
  const qb = useQb()
  const [busy, setBusy] = React.useState('')
  const [items, setItems] = React.useState<{ id: string; name: string }[] | null>(null)
  const [itemsErr, setItemsErr] = React.useState('')
  React.useEffect(() => { void refreshQb() }, [])
  React.useEffect(() => {
    if (!qb.connected || items || !REAL.qb) return
    void REAL.qb.items().then((r) => (r.ok ? setItems(r.items) : setItemsErr(r.detail || 'Couldn’t read the products from QuickBooks'))).catch(() => setItemsErr('Couldn’t reach QuickBooks'))
  }, [qb.connected, items])
  const run = async (k: string, f: () => Promise<unknown>) => { if (busy) return; setBusy(k); try { await f() } finally { setBusy('') } }
  /* Intuit only sends the admin back to the published app — from the Lovable editor's preview, open that first */
  const onPublished = appUrl() === (typeof location !== 'undefined' ? location.origin : PUBLISHED)
  const picked = s.rules.qbItems || {}
  const pick = (k: (typeof KINDS)[number]['k'], it?: { id: string; name: string }) => s.commit((st) => { st.rules.qbItems = { ...(st.rules.qbItems || {}), [k]: it } }, it ? `${KINDS.find((x) => x.k === k)!.label} go on “${it.name}”` : `${KINDS.find((x) => x.k === k)!.label} go on QuickBooks’ own Services`, { undo: false })

  let status: React.ReactNode = <Status tone="off">Checking…</Status>
  let body: React.ReactNode = null
  if (qb.known && qb.problem === 'notable') {
    status = <Status tone="off">One step left</Status>
    body = <p className="text-[0.84375rem] leading-relaxed text-ink-2">The app’s database needs its QuickBooks table. In the Lovable chat, type <b className="font-semibold">Apply pending Supabase migrations</b>, then come back here.</p>
  } else if (qb.known && !qb.configured) {
    status = <Status tone="off">Not set up</Status>
    body = <p className="text-[0.84375rem] leading-relaxed text-ink-2">It needs the keys from your app on developer.intuit.com, in Lovable → More → Settings → Secrets: <Code>QUICKBOOKS_CLIENT_ID</Code> and <Code>QUICKBOOKS_CLIENT_SECRET</Code>. Then publish the app again and come back here.</p>
  } else if (qb.known && !qb.connected) {
    status = <Status tone="off">Not connected</Status>
    body = (
      <>
        <p className="text-[0.84375rem] leading-relaxed text-ink-2">Connect once with the QuickBooks admin’s sign-in. You pick the company and click Connect there, and you’re back here.</p>
        {REAL.admin ? (
          onPublished ? (
            <Button variant="primary" className="self-start" icon={<BookOpen className="h-4 w-4" />} disabled={!!busy} onClick={() => run('connect', connectQb)} data-qb-connect>{busy === 'connect' ? 'Opening QuickBooks…' : 'Connect QuickBooks'}</Button>
          ) : (
            <>
              <Button variant="primary" className="self-start" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(`${PUBLISHED}/#/settings/qb/connections`, '_blank')}>Open the published app to connect</Button>
              <span className="text-[0.78125rem] text-muted">QuickBooks only sends you back to {PUBLISHED.replace('https://', '')}, so connect from there.</span>
            </>
          )
        ) : (
          <span className="text-[0.8125rem] text-muted">The admin connects it.</span>
        )}
      </>
    )
  } else if (qb.connected) {
    status = <Status tone="ok">Connected</Status>
    body = (
      <>
        <p className="text-[0.84375rem] leading-relaxed text-ink-2">
          {qb.company ? <b className="font-semibold text-ink">{qb.company}</b> : 'Your company'}{qb.since ? ` · since ${new Date(qb.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}{qb.env === 'sandbox' ? ' · test company' : ''}.
          {' '}Every invoice made here goes to QuickBooks — and every change to it, and every payment recorded here. Payments made in QuickBooks come back here every 10 minutes.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" icon={<RefreshCw className={cn('h-3.5 w-3.5', busy === 'sync' && 'animate-spin')} />} disabled={!!busy} onClick={() => run('sync', () => syncQb({ say: true }))}>{busy === 'sync' ? 'Checking…' : 'Check QuickBooks now'}</Button>
          {REAL.admin && (
            <Menu trigger={<Button size="sm" variant="ghost" aria-label="More" icon={<MoreHorizontal className="h-4 w-4" />} />}>
              <MenuItem onSelect={() => run('connect', connectQb)} hint="Same company, or another one">Connect again</MenuItem>
              <MenuSep />
              <MenuItem danger onSelect={() => { if (confirm('Disconnect QuickBooks? Nothing more goes there until it’s connected again.')) void run('off', disconnectQb) }}>Disconnect</MenuItem>
            </Menu>
          )}
        </div>
        <div className="mt-1 overflow-hidden rounded-xl border border-line" data-qb-items>
          <div className="bg-wash px-4 py-2 text-[0.78125rem] font-semibold text-muted">Which QuickBooks product each bill goes on</div>
          {KINDS.map((k) => {
            const cur = picked[k.k]
            return (
              <div key={k.k} className="flex items-center justify-between gap-3 border-t border-line-2 px-4 py-2 max-sm:flex-col max-sm:items-start max-sm:gap-1">
                <span className="text-[0.84375rem] text-ink">{k.label}</span>
                <Menu width={300} trigger={<Button size="sm" variant="outline" iconRight={<ChevronDown className="h-3.5 w-3.5" />} className="max-w-[16rem]"><span className="truncate">{cur?.name || 'Services (QuickBooks’ own)'}</span></Button>}>
                  <MenuItem checked={!cur} onSelect={() => pick(k.k, undefined)} hint="Or the first service there is">Services (QuickBooks’ own)</MenuItem>
                  <MenuSep />
                  {(items || []).map((it) => <MenuItem key={it.id} checked={cur?.id === it.id} onSelect={() => pick(k.k, it)}>{it.name}</MenuItem>)}
                  {!items && <div className="px-2.5 py-2 text-[0.8125rem] text-muted">{itemsErr || 'Reading the list from QuickBooks…'}</div>}
                </Menu>
              </div>
            )
          })}
        </div>
      </>
    )
  } else if (qb.known && qb.problem) {
    status = <Status tone="bad">Can’t check</Status>
    body = <p className="text-[0.84375rem] leading-relaxed text-ink-2">Couldn’t reach the server to see how QuickBooks stands. <button className="font-semibold text-brand-600 hover:underline" onClick={() => void refreshQb()}>Try again</button></p>
  }
  return (
    <Card pad={false} id="qb">
      <div className="flex flex-col gap-3 p-5 max-sm:p-4" data-qb-card={qb.connected ? 'on' : qb.configured ? 'off' : 'nokeys'}>
        <Head icon={<BookOpen className="h-5 w-5" />} title="QuickBooks Online" status={status} />
        {body}
      </div>
    </Card>
  )
}

export function EmailCard() {
  const s = useStore()
  const [st, setSt] = React.useState<{ configured: boolean; domains: { name: string; status: string }[] | null } | null>(null)
  const [busy, setBusy] = React.useState(false)
  React.useEffect(() => { if (REAL.mail) void REAL.mail.status().then(setSt).catch(() => setSt({ configured: false, domains: null })) }, [])
  if (!REAL.mail) return null
  const verified = (st?.domains || []).filter((d) => d.status === 'verified').map((d) => d.name)
  const waiting = (st?.domains || []).filter((d) => d.status !== 'verified').map((d) => d.name)
  const test = async () => {
    if (!REAL.mail || !REAL.email || busy) return
    setBusy(true)
    try {
      const from = s.rules.email?.other || REAL.email
      const r = await REAL.mail.send({ from: `Cobblestone Tile <${from}>`, to: [REAL.email], subject: 'Tile OS can send email', html: '<p style="font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif">It works — purchase orders, invoices and invites go out from Tile OS now.</p>' })
      if (r.ok) showPop({ title: `Test email sent to ${REAL.email}`, sub: `From ${r.from}. Check the inbox — and spam, the first time.` })
      else showPop({ title: 'The test email didn’t go out', sub: r.why === 'nokey' ? 'The Resend key isn’t in Lovable yet.' : r.why, tone: 'warn' })
    } finally { setBusy(false) }
  }
  let status: React.ReactNode = <Status tone="off">Checking…</Status>
  let body: React.ReactNode = null
  if (st && !st.configured) {
    status = <Status tone="off">Not set up</Status>
    body = <p className="text-[0.84375rem] leading-relaxed text-ink-2">Purchase orders, invoices and invites go out from your own address once a Resend key is in Lovable → More → Settings → Secrets: <Code>RESEND_API_KEY</Code>. Until then invoices go out from QuickBooks itself, and POs aren’t emailed.</p>
  } else if (st) {
    status = verified.length || !st.domains ? <Status tone="ok">Sending</Status> : <Status tone="bad">Domain not verified</Status>
    body = (
      <>
        <p className="text-[0.84375rem] leading-relaxed text-ink-2">
          {verified.length ? <>Sends from <b className="font-semibold text-ink">@{verified.join(', @')}</b> — POs to suppliers and installers, invoices to clients, invites to the team. Who each kind comes from and who’s copied: Settings → Email.</>
            : waiting.length ? <>Resend hasn’t verified <b className="font-semibold text-ink">{waiting.join(', ')}</b> yet — finish the DNS records there (Resend → Domains), then it sends.</>
            : st.domains ? <>No domain in Resend yet — add cobblestonenj.com there (Resend → Domains).</>
            : <>The key works. (It can’t list the domains — that’s fine.)</>}
        </p>
        {REAL.email && <Button size="sm" className="self-start" icon={<Send className="h-3.5 w-3.5" />} disabled={busy} onClick={test} data-mail-test>{busy ? 'Sending…' : 'Send a test email to me'}</Button>}
      </>
    )
  }
  return (
    <Card pad={false}>
      <div className="flex flex-col gap-3 p-5 max-sm:p-4" data-mail-card={st?.configured ? 'on' : 'off'}>
        <Head icon={<Mail className="h-5 w-5" />} title="Email from Tile OS" status={status} />
        {body}
      </div>
    </Card>
  )
}

/** what isn't connected yet — one short list */
export function LaterList() {
  return (
    <Card pad={false}>
      <div className="px-5 py-3 text-[0.78125rem] font-semibold text-muted max-sm:px-4">Later</div>
      {[
        { i: Calendar, t: 'Google Calendar', d: 'Meetings and walkthroughs on everyone’s phone calendar' },
        { i: MessageCircle, t: 'Text / WhatsApp', d: 'Installers get their PO by text' },
        { i: FolderOpen, t: 'Google Drive / Dropbox', d: 'Plans and spec books with their revisions' },
      ].map((c) => (
        <div key={c.t} className="flex items-center gap-3 border-t border-line-2 px-5 py-2.5 max-sm:px-4">
          <c.i className="h-4 w-4 shrink-0 text-faint" />
          <span className="min-w-0 flex-1"><span className="text-[0.84375rem] font-medium text-ink-2">{c.t}</span><span className="text-[0.8125rem] text-muted"> — {c.d}</span></span>
          <span className="shrink-0 text-[0.75rem] font-medium text-faint">Not yet</span>
        </div>
      ))}
    </Card>
  )
}

