/* Items → From the list: add what we buy without typing it —
 *   Setting materials: the thinsets (Laticrete 253 Gold, 254 Platinum, 255 MultiMax…), grouts, waterproofing — tick them
 *   Metals: any Schluter profile, in any finish and size, as a length or a corner piece
 * They go into Items with no price yet — the first PO says what we paid. */
import * as React from 'react'
import { Check, Plus } from 'lucide-react'
import { useStore } from '@/tileos/store'
import { Button } from '@/tileos/components/ui/core'
import { Modal } from '@/tileos/components/ui/overlay'
import { ChipTabs } from '@/tileos/components/ui/page'
import { cn } from '@/tileos/lib/utils'
import { SETTING_CATALOG, metalItem, metalText, type MetalSpec } from '@/tileos/data/catalog'
import { MAT_CAT, type Item } from '@/tileos/data/items'
import { MetalPicker } from './metalpick'

export function CatalogModal({ level }: { level: number }) {
  const s = useStore()
  const [tab, setTab] = React.useState<'setting' | 'metal'>('setting')
  const [on, setOn] = React.useState<string[]>([])
  const [metal, setMetal] = React.useState<MetalSpec>({ profile: '', finish: '' })
  const have = (it: Item) => s.items.some((i) => i.id === it.id || i.name.toLowerCase() === it.name.toLowerCase())
  const metalOk = !!metal.profile && !!metal.finish && !!metal.size
  const mItem = metalOk ? metalItem(metal) : null
  const addSetting = () => {
    const picks = SETTING_CATALOG.filter((c) => on.includes(c.id) && !have(c))
    if (!picks.length) return
    s.commit((st) => { picks.forEach((c) => st.items.push({ ...c })) }, `${picks.length} added to Items`, { sub: 'No price yet — the first PO says what we paid.', close: true })
  }
  const addMetal = () => {
    if (!mItem) return
    if (have(mItem)) { s.commit(() => {}, 'Already in Items', { undo: false }); return }
    s.commit((st) => { st.items.push(mItem) }, 'Added to Items', { sub: mItem.name })
    setMetal({ profile: metal.profile, finish: '', size: undefined, piece: metal.piece })
  }
  const groups = Array.from(new Set(SETTING_CATALOG.map((c) => c.cat!)))
  return (
    <Modal
      level={level}
      size="lg"
      tall
      onClose={s.close}
      title="Add from the list"
      sub="Pick it — nothing to type. It goes into Items with no price yet."
      footer={tab === 'setting'
        ? <><span className="text-[0.8125rem] text-muted">{on.length ? `${on.length} picked` : 'Tick what you buy'}</span><Button className="ml-auto" variant="ghost" onClick={s.close}>Cancel</Button><Button variant="primary" icon={<Plus />} disabled={!on.length} onClick={addSetting} data-catalog-add>Add to Items</Button></>
        : <><span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink-2">{mItem ? mItem.name : 'Pick the profile, the finish and the size'}</span><Button variant="ghost" onClick={s.close}>Done</Button><Button variant="primary" icon={<Plus />} disabled={!mItem} onClick={addMetal} data-catalog-metal-add>Add to Items</Button></>}
    >
      <ChipTabs value={tab} onChange={(v) => setTab(v as 'setting' | 'metal')} items={[{ key: 'setting', label: 'Thinset, grout and more' }, { key: 'metal', label: 'Metals' }]} />
      {tab === 'setting' ? (
        <div className="mt-4 flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g}>
              <div className="mb-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.05em] text-muted">{MAT_CAT[g]?.label || g}</div>
              <div className="overflow-hidden rounded-[0.75rem] border border-line">
                {SETTING_CATALOG.filter((c) => c.cat === g).map((c) => {
                  const already = have(c)
                  const picked = on.includes(c.id)
                  return (
                    <label key={c.id} data-catalog-item={c.id} className={cn('flex min-h-12 cursor-pointer items-center gap-3 border-t border-line-2 px-3.5 py-2 first:border-t-0', already && 'cursor-default opacity-60')}>
                      <input type="checkbox" disabled={already} checked={already || picked} onChange={() => setOn((l) => (picked ? l.filter((x) => x !== c.id) : [...l, c.id]))} className="h-4 w-4 shrink-0 accent-[#2650cf]" />
                      <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-[0.25rem]" style={{ background: c.tint }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem] font-semibold text-ink">{c.name}</span>
                        <span className="block truncate text-[0.78125rem] text-muted">{[c.pack, c.usedFor].filter(Boolean).join(' · ')}</span>
                      </span>
                      {already && <span className="inline-flex shrink-0 items-center gap-1 text-[0.75rem] font-semibold text-ok-700"><Check className="h-3.5 w-3.5" />In Items</span>}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <MetalPicker value={metal} onChange={setMetal} pieces />
          {mItem && have(mItem) && <div className="mt-3 text-[0.8125rem] font-medium text-ok-700">{metalText(metal, { piece: true })} is in Items already</div>}
        </div>
      )}
    </Modal>
  )
}
