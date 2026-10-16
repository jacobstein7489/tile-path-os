/* Setup: what each surface is set on (the underlayment). Pick it once — the system works out every material from
 * the square feet, and the order goes to whoever orders materials (the site manager, unless Settings says otherwise). */
import { smp } from '@/tileos/lib/save'
import * as React from 'react'
import { Sparkles, Send, Layers } from 'lucide-react'
import { useStore, addHist, newTask, closeTasks, meOf, type Store } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal, Tip } from '@/tileos/components/ui/overlay'
import { cn } from '@/tileos/lib/utils'
import { PEOPLE, fmtMoney, type PersonKey } from '@/tileos/data/model'
import { type Room, tileOf } from '@/tileos/data/jobs'
import { METHODS, type MethodKey } from '@/tileos/data/takeoff'
import { methodOf, suggestMethod, methodsFor, takeoff, qtyLabel } from './takeoff'
import { ItemThumb } from './items'
import { matBy, matFor } from './flows'

const S = () => useStore.getState()
type Choice = Record<string, MethodKey>
const keyOf = (room: string, surface: string) => `${room}|${surface}`

/** save the underlayment for every surface, and hand the calculated order to whoever orders materials */
export function confirmSetting(jobId: string, choice: Choice) {
  const st0 = S()
  const job = st0.jobs[jobId]
  const who = matBy(st0)
  const patched = patchRooms(st0.rooms[jobId] || [], choice)
  const t = takeoff({ ...st0, rooms: { ...st0.rooms, [jobId]: patched } }, jobId)
  const toOrder = t.lines.filter((l) => l.toOrder > 0)
  const total = toOrder.reduce((n, l) => n + l.toOrder * (st0.items.find((i) => i.id === l.itemId)?.cost || 0), 0)
  st0.commit(
    (s) => {
      ;(s.rooms[jobId] || []).forEach((r) => r.surfaces.forEach((x) => { const c = choice[keyOf(r.name, x.name)]; if (c) x.method = c }))
      addHist(s, jobId, { who: meOf(s.role), kind: 'setup', title: 'Underlayment set for every surface', detail: `${toOrder.length} materials worked out from the scope` })
      closeTasks(s, s.tasks.filter((x) => x.jobId === jobId && /^Plan setting materials/.test(x.title)).map((x) => x.id), 'Replaced by the calculated order')
      if (toOrder.length && !s.tasks.some((x) => x.jobId === jobId && x.action?.kind === 'order:' + jobId && x.state !== 'done'))
        newTask(s, { jobId, title: `Order the materials · ${job.name}`, detail: `${toOrder.length} materials worked out from the scope and the underlayment — check the quantities and send the PO.`, type: 'Materials', owner: matBy(s), for: matFor(s), state: 'now', due: 'Today', tone: 'info', where: `${toOrder.length} items · about ${fmtMoney(total)}`, action: { label: 'Review the order', kind: 'order:' + jobId } })
    },
    toOrder.length ? `Materials worked out — ${toOrder.length} to order` : 'Underlayment saved — nothing more to order',
    {
      close: true,
      sub: toOrder.length ? `About ${fmtMoney(total)}${smp(' · sample prices')}. ${PEOPLE[who].short} checks it and sends the PO.` : 'Everything the scope needs is already ordered.',
      flow: toOrder.length ? [{ who: meOf(st0.role), label: 'Setup', state: 'done' }, { who, label: 'Orders it', state: 'now' }, { label: 'Supplier delivers', state: 'next' }, { who, label: 'Receives', state: 'next' }] : undefined,
    },
  )
}
function patchRooms(rooms: Room[], choice: Choice): Room[] {
  return rooms.map((r) => ({ ...r, surfaces: r.surfaces.map((x) => (choice[keyOf(r.name, x.name)] ? { ...x, method: choice[keyOf(r.name, x.name)] } : x)) }))
}
/** how many surfaces have their underlayment confirmed (not just suggested) */
export function settingStatus(s: Pick<Store, 'rooms'>, jobId: string) {
  const flat = (s.rooms[jobId] || []).flatMap((r) => r.surfaces.filter((x) => x.sf).map((x) => ({ room: r.name, x })))
  const set = flat.filter((f) => !methodOf(f.room, f.x).auto).length
  return { set, total: flat.length }
}

export function SettingModal({ jobId, level }: { jobId: string; level: number }) {
  const s = useStore()
  const job = s.jobs[jobId]
  const rooms = s.rooms[jobId] || []
  const [choice, setChoice] = React.useState<Choice>(() => {
    const c: Choice = {}
    rooms.forEach((r) => r.surfaces.forEach((x) => { c[keyOf(r.name, x.name)] = methodOf(r.name, x).key }))
    return c
  })
  if (!job) return null
  const patched = patchRooms(rooms, choice)
  const t = takeoff({ ...s, rooms: { ...s.rooms, [jobId]: patched } }, jobId)
  const need = t.lines.filter((l) => l.need > 0)
  const toOrder = t.lines.filter((l) => l.toOrder > 0)
  const total = toOrder.reduce((n, l) => n + l.toOrder * (s.items.find((i) => i.id === l.itemId)?.cost || 0), 0)
  const who = matBy(s)
  return (
    <Modal
      level={level}
      size="xl"
      tall
      onClose={s.close}
      title="What each surface is set on"
      sub={`${job.name} · pick the underlayment once — every material is worked out from the square feet`}
      bodyClass="p-0"
      footer={
        <>
          <span className="text-[0.84375rem] text-muted">{toOrder.length ? <>{toOrder.length} to order · about <b className="font-semibold text-ink">{fmtMoney(total)}</b>{smp(' · sample prices')}</> : 'Nothing new to order'}</span>
          <Button className="ml-auto" variant="primary" icon={<Send />} onClick={() => confirmSetting(jobId, choice)}>{toOrder.length ? `Save — ${PEOPLE[who].short} orders it` : 'Save'}</Button>
        </>
      }
    >
      <div className="grid min-h-full grid-cols-[minmax(0,1fr)_22.5rem] max-lg:grid-cols-1">
        <div className="min-w-0 border-r border-line px-6 py-5 max-lg:border-r-0 max-sm:px-4">
          {rooms.map((r) => (
            <section key={r.name} className="mb-4 overflow-hidden rounded-xl border border-line">
              <div className="bg-[#f1eee8] px-4 py-2 text-[0.78125rem] font-bold uppercase tracking-[0.04em] text-ink">{r.name}</div>
              {r.surfaces.map((x) => {
                const k = keyOf(r.name, x.name)
                const sug = suggestMethod(r.name, x)
                const tile = tileOf(jobId, x.tile)
                return (
                  <div key={x.name} className="flex items-center gap-4 border-t border-line-2 px-4 py-2.5 max-md:flex-col max-md:items-stretch max-md:gap-2">
                    <span className="w-[13.125rem] min-w-0 shrink-0 max-md:w-auto">
                      <span className="block truncate text-[0.875rem] font-semibold text-ink">{x.name}</span>
                      <span className="block truncate text-[0.78125rem] text-muted">{x.sf ? `${x.sf} SF` : 'No SF yet'}{tile ? ` · ${x.tile} ${tile.name}` : ''}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {methodsFor(x).map((m) => (
                        <Tip key={m} label={METHODS[m].layers}>
                          <button onClick={() => setChoice({ ...choice, [k]: m })} className={cn('inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[0.8125rem] font-semibold transition', choice[k] === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-ink-2 hover:border-brand-200')}>
                            {m === sug && <Sparkles className={cn('h-3 w-3', choice[k] === m ? 'text-brand-600' : 'text-faint')} />}
                            {METHODS[m].short}
                          </button>
                        </Tip>
                      ))}
                    </span>
                  </div>
                )
              })}
            </section>
          ))}
          <div className="flex items-center gap-1.5 text-[0.78125rem] text-muted"><Sparkles className="h-3.5 w-3.5 text-brand-500" />Suggested from the surface — change it if it’s set differently.</div>
        </div>
        <aside className="bg-[#faf8f5] px-5 py-5 max-sm:px-4">
          <div className="flex items-center gap-2 text-[0.875rem] font-bold text-ink"><Layers className="h-4 w-4 text-muted" />What it takes</div>
          <div className="mb-3 text-[0.78125rem] text-muted">From {t.sf.toLocaleString('en-US')} SF · {s.rules.mat.waste}% extra · updates as you pick</div>
          <div className="flex flex-col gap-1.5">
            {need.map((l) => {
              const it = s.items.find((i) => i.id === l.itemId)
              return (
                <button key={l.itemId} onClick={() => s.open({ t: 'item', id: l.itemId })} className="flex items-center gap-3 rounded-xl border border-line bg-white px-2.5 py-2 text-left hover:border-brand-200">
                  <ItemThumb item={it} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.84375rem] font-semibold text-ink">{it?.brand ? `${it.brand} ${it.product}` : it?.name}</span>
                    <span className="block truncate text-[0.75rem] text-muted">{it?.name}</span>
                  </span>
                  <span className="shrink-0 text-right leading-tight">
                    <span className="block text-[0.84375rem] font-bold tnum text-ink">{qtyLabel(l.need, it?.unit || '')}</span>
                    {l.have > 0 && <span className="block text-[0.71875rem] text-ok-700">{l.toOrder ? `${l.have} ordered` : 'ordered'}</span>}
                  </span>
                </button>
              )
            })}
            {!need.length && <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[0.8125rem] text-muted">Add square feet and tile to the scope first.</div>}
          </div>
          {t.skipped.length > 0 && <div className="mt-3 text-[0.75rem] text-warn-700">{t.skipped.length} surface{t.skipped.length > 1 ? 's' : ''} left out — {t.skipped[0].why.toLowerCase()}</div>}
        </aside>
      </div>
    </Modal>
  )
}
export type { PersonKey }
