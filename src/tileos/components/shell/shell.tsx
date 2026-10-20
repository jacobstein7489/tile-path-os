import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Command } from 'cmdk'

import { CircleCheck, Building2, Building, Boxes, CalendarDays, Workflow, Settings, Bell, Plus, Search, ChevronsUpDown, Table2, PackageCheck, PenTool, Truck, Ellipsis, Smartphone, Repeat, FileText, Package, HardHat, Receipt, ArrowRight, CornerDownLeft, CalendarCheck, ChevronDown, ContactRound, LayoutList, HandCoins, ListTodo, Sparkles, Wrench, MessageCircleQuestion, ArrowLeftRight, PackageX, CalendarPlus, ClipboardList, Wallet, X, LogOut } from 'lucide-react'
import { REAL, awayFromMe, backToMe, lookAtSample, leaveSample } from '@/tileos/lib/save'
import { BUILT } from '@/tileos/lib/version'
import { useStore, meOf, type Page, homeOf } from '@/tileos/store'
import { todayCount } from '@/tileos/features/mytasks'
import { payOpen } from '@/tileos/features/pay'
import { billsToMake, billingOn } from '@/tileos/features/progressbill'
import { cn } from '@/tileos/lib/utils'
import { Avatar, Kbd, Button, Count } from '@/tileos/components/ui/core'
import { Menu, MenuItem, MenuSep, MenuLabel, Pop } from '@/tileos/components/ui/overlay'
import { Eraser, Users } from 'lucide-react'
import { Swatch } from '@/tileos/components/ui/swatch'
import { roleDef, PEOPLE, STAGE_LABEL } from '@/tileos/data/model'
import { CUSTOMERS } from '@/tileos/data/jobs'

/* Plain word matching (every word you type must appear) — no fuzzy letter-skipping, so results never look random. */
const paletteFilter = (value: string, search: string) => {
  const v = value.toLowerCase()
  const words = search.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 1
  if (!words.every((w) => v.includes(w))) return 0
  return v.startsWith(words[0]) ? 1 : v.includes(' ' + words[0]) ? 0.9 : 0.7
}

export function Logo({ size = 34 }: { size?: number; dark?: boolean }) {
  /* four tiles set on the diagonal, like a laid floor */
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden>
      <rect x="11" y="1.5" width="11" height="11" rx="1.8" transform="rotate(45 16.5 7)" fill="#2650CF" />
      <rect x="4.5" y="9.5" width="10" height="10" rx="1.8" transform="rotate(45 9.5 14.5)" fill="#152A66" />
      <rect x="19.5" y="9.5" width="10" height="10" rx="1.8" transform="rotate(45 24.5 14.5)" fill="#6E8FE6" />
      <rect x="12" y="17" width="10" height="10" rx="1.8" transform="rotate(45 17 22)" fill="#2650CF" />
    </svg>
  )
}

/** + New: one window of colored tiles — start something, or log something that happened */
export function NewMenu({ trigger }: { trigger: React.ReactElement; align?: 'start' | 'end' }) {
  const open = useStore((s) => s.open)
  return React.cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, { onClick: () => open({ t: 'new' }) })
}

export const NAV: Record<string, { label: string; icon: React.ElementType }> = {
  today: { label: 'Today', icon: CalendarCheck },
  tasks: { label: 'Today', icon: CalendarCheck },
  projects: { label: 'Projects', icon: Building2 },
  upcoming: { label: 'Schedule', icon: CalendarDays },
  schedule: { label: 'Schedule', icon: CalendarDays },
  estimates: { label: 'Estimates', icon: FileText },
  pos: { label: 'Purchase orders', icon: PackageCheck },
  pay: { label: 'Installer pay', icon: HandCoins },
  money: { label: 'Billing', icon: Receipt },
  items: { label: 'Items', icon: Boxes },
  directory: { label: 'Clients', icon: ContactRound },
  clients: { label: 'Clients', icon: Building },
  designers: { label: 'Designers', icon: PenTool },
  subs: { label: 'Installers', icon: HardHat },
  suppliers: { label: 'Suppliers', icon: Truck },
}
/** what a role sees in the menu, in menu order */
export function navKeys(nav: string[]) {
  return nav.filter((k) => k !== 'directory')
}
const GROUPS: { label: string; keys: string[] }[] = [
  { label: '', keys: ['today'] },
  { label: 'Work', keys: ['estimates', 'projects', 'upcoming'] },
  { label: 'Money', keys: ['pos', 'pay', 'money', 'items'] },
  { label: 'People', keys: ['clients', 'designers', 'subs', 'suppliers'] },
]
export const activeNav = (page: string) => (page === 'job' ? 'projects' : page === 'tasks' ? 'today' : page === 'directory' ? 'clients' : page === 'schedule' ? 'upcoming' : page)

function useBadges() {
  const s = useStore()
  const role = s.role
  /* the same number Today shows under "To do today" — due today or late */
  const todayN = todayCount(s, role)
  const moneyTodo = s.money.filter((m) => m.state === 'todo').length + (role === 'accounting' && billingOn(s) ? billsToMake(s).length : 0)
  const payOpenN = ['owner', 'accounting'].includes(role) ? payOpen(s).length : 0
  return (k: string) => (k === 'today' ? todayN : k === 'money' && role === 'accounting' ? moneyTodo : k === 'pay' ? payOpenN : 0)
}

export function Sidebar() {
  const role = useStore((s) => s.role)
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const open = useStore((s) => s.open)
  const def = roleDef(role)
  const keysFor = navKeys(def.nav)
  const badge = useBadges()
  const active = activeNav(route.page)

  const Item = ({ k, label, icon: Icon, n }: { k: Page; label: string; icon: React.ElementType; n?: number }) => {
    const on = active === k
    return (
      <button
        onClick={() => go({ page: k })}
        aria-current={on ? 'page' : undefined}
        className={cn(
          'group flex h-8 w-full shrink-0 items-center gap-2.5 rounded-[0.5rem] px-2.5 text-[0.84375rem] transition-colors',
          on ? 'bg-brand-50 font-semibold text-brand-800' : 'font-medium text-ink-2 hover:bg-wash hover:text-ink',
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', on ? 'text-brand-600' : 'text-[#7b8492] group-hover:text-ink-2')} strokeWidth={1.9} />
        <span className="flex-1 truncate text-left">{label}</span>
        {!!n && <span className={cn('text-[0.78125rem] font-semibold tnum', on ? 'text-brand-700' : 'text-muted')}>{n}</span>}
      </button>
    )
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[14rem] flex-col border-r border-line bg-side max-lg:hidden">
      <button onClick={() => go(homeOf(role))} className="flex shrink-0 items-center gap-2.5 px-4 pb-3.5 pt-4 text-left">
        <Logo size={28} />
        <span className="min-w-0 leading-[1.1]">
          <span className="font-display block truncate text-[1rem] font-semibold tracking-[-0.01em] text-ink">Cobblestone</span>
          <span className="mt-0.5 block truncate text-[0.75rem] font-medium text-muted">Tile OS</span>
        </span>
      </button>
      <div className="shrink-0 px-3">
        <NewMenu
          trigger={
            <button aria-label="New" className="flex h-9 w-full items-center justify-center gap-2 rounded-[0.5625rem] bg-brand-600 px-3 text-[0.84375rem] font-semibold text-white shadow-btn transition hover:bg-brand-700">
              <Plus className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.4} />
              New
            </button>
          }
        />
      </div>
      <nav className="scroll-soft mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-3" aria-label="Main">
        {GROUPS.map((g) => {
          const keys = g.keys.filter((k) => keysFor.includes(k))
          if (!keys.length) return null
          return (
            <div key={g.label || 'top'} className={cn(g.label && 'mt-2.5 border-t border-line-2 pt-2.5 [@media(max-height:47.5rem)]:mt-2 [@media(max-height:47.5rem)]:pt-2')}>
              {g.label && <div className="px-2.5 pb-1 text-[0.75rem] font-semibold text-faint">{g.label}</div>}
              <div className="flex flex-col gap-[0.125rem]">
                {keys.map((k) => <Item key={k} k={k as Page} label={NAV[k].label} icon={NAV[k].icon} n={badge(k)} />)}
              </div>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

/** desktop: search across everything, notifications and who you are, above every page */
export function DesktopTopBar() {
  const role = useStore((s) => s.role)
  const setPalette = useStore((s) => s.setPalette)
  const me = meOf(role)
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-4 bg-canvas/90 px-7 backdrop-blur-md max-xl:px-6 max-lg:hidden">
      <button onClick={() => setPalette(true)} className="flex h-9 w-[25rem] max-w-[48%] items-center gap-2.5 rounded-[0.5625rem] border border-line bg-white px-3 text-[0.84375rem] text-faint shadow-xs transition hover:border-[#cdc7bc] hover:text-muted">
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate text-left">Search projects, clients, tasks, POs…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <div className="ml-auto flex items-center gap-3">
        <Notifications big />
        <Menu
          align="end"
          width={270}
          trigger={
            <button className="flex items-center gap-2.5 rounded-[0.625rem] border border-line bg-white py-[0.1875rem] pl-[0.1875rem] pr-2.5 shadow-xs transition hover:border-[#cdc7bc]">
              <Avatar who={me} size={28} />
              <span className="min-w-0 text-left leading-tight">
                <span className="block truncate text-[0.84375rem] font-semibold text-ink">{PEOPLE[me].name}</span>
                <span className="block truncate text-[0.75rem] text-muted">{roleDef(role).label}</span>
              </span>
              <ChevronDown className="h-4 w-4 text-faint" />
            </button>
          }
        >
          <UserMenuItems />
        </Menu>
      </div>
    </header>
  )
}

function UserMenuItems({ withPages }: { withPages?: boolean }) {
  const role = useStore((s) => s.role)
  const go = useStore((s) => s.go)
  const open = useStore((s) => s.open)
  const away = useStore((s) => awayFromMe(s))
  return (
    <>
      {role === 'owner' && <MenuItem icon={<Settings className="h-4 w-4" />} onSelect={() => go({ page: 'settings', tab: 'team' } as any)} hint="People, logins, what each one sees">Team and settings</MenuItem>}
      {role === 'owner' && <MenuItem icon={<Users className="h-4 w-4" />} onSelect={() => open({ t: 'whowhat' })} hint="Every step, and who has it">Who does what</MenuItem>}
      {REAL.admin && <MenuItem icon={<Repeat className="h-4 w-4" />} onSelect={() => open({ t: 'roles' })} hint="Try any login type">See what each login sees</MenuItem>}
      {away && <MenuItem icon={<Repeat className="h-4 w-4" />} onSelect={backToMe} hint="Your own login">Back to me</MenuItem>}
      <MenuSep />
      {withPages &&
        phoneNav(roleDef(role).nav).more.map((k) => {
          const Icon = NAV[k].icon
          return (
            <MenuItem key={k} icon={<Icon className="h-4 w-4" />} onSelect={() => go({ page: k as Page })}>
              {NAV[k].label}
            </MenuItem>
          )
        })}
      <MenuItem icon={<Workflow className="h-4 w-4" />} onSelect={() => go({ page: 'flow' })} hint="The whole process, start to finish">How it works</MenuItem>
      {role === 'owner' && !REAL.cloud && !REAL.sampleView && <MenuItem icon={<Eraser className="h-4 w-4" />} onSelect={() => go({ page: 'settings', tab: 'testdata' } as any)} hint="Start fresh, or bring the sample back">Test data</MenuItem>}
      {REAL.cloud && REAL.admin && !REAL.sampleView && <MenuItem icon={<Eraser className="h-4 w-4" />} onSelect={lookAtSample} hint="Every page with something on it">Look at the sample</MenuItem>}
      {REAL.sampleView && <MenuItem icon={<Eraser className="h-4 w-4" />} onSelect={leaveSample}>Back to your company</MenuItem>}
      {REAL.signOut && <><MenuSep /><MenuItem icon={<LogOut className="h-4 w-4" />} onSelect={REAL.signOut} hint={REAL.email}>Sign out</MenuItem></>}
      {BUILT && <div className="px-2.5 pb-1 pt-2 text-[0.71875rem] text-faint">Version {BUILT}</div>}
    </>
  )
}

/* Phones and tablets: four pages sit in a bar at the bottom; everything else is under More. */
const PHONE_ORDER = ['today', 'projects', 'upcoming', 'estimates', 'money', 'pos', 'items', 'clients', 'designers', 'subs', 'suppliers']
export function phoneNav(navIn: string[]) {
  const nav = navKeys(navIn)
  const bar = PHONE_ORDER.filter((k) => nav.includes(k)).slice(0, 4)
  return { bar, more: nav.filter((k) => !bar.includes(k)) }
}
export function BottomNav() {
  const role = useStore((s) => s.role)
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const def = roleDef(role)
  const badge = useBadges()
  const active = activeNav(route.page)
  const { bar, more } = phoneNav(def.nav)
  const moreOn = more.includes(active)
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom,0)] backdrop-blur-md lg:hidden" aria-label="Main">
      <div className="mx-auto flex h-[3.625rem] max-w-[35rem] items-stretch px-2">
        {bar.map((k) => {
          const on = active === k
          const Icon = NAV[k].icon
          const n = badge(k)
          return (
            <button key={k} onClick={() => go({ page: k as Page })} className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[0.71875rem] font-semibold transition-colors', on ? 'text-brand-600' : 'text-muted')}>
              <span className="relative">
                <Icon className="h-[1.3125rem] w-[1.3125rem]" strokeWidth={on ? 2 : 1.7} />
                {!!n && <span className="absolute -right-2.5 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-bad-600 px-1 text-[0.625rem] font-semibold text-white ring-2 ring-white">{n}</span>}
              </span>
              {NAV[k].label}
            </button>
          )
        })}
        <Menu
          align="end"
          width={240}
          trigger={
            <button className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[0.71875rem] font-semibold', moreOn ? 'text-brand-600' : 'text-muted')}>
              <Ellipsis className="h-[1.3125rem] w-[1.3125rem]" strokeWidth={moreOn ? 2 : 1.7} />
              More
            </button>
          }
        >
          {more.map((k) => {
            const Icon = NAV[k].icon
            return (
              <MenuItem key={k} icon={<Icon className="h-4 w-4" />} onSelect={() => go({ page: k as Page })} checked={active === k}>
                {NAV[k].label}
              </MenuItem>
            )
          })}
          <MenuSep />
          <MenuItem icon={<Workflow className="h-4 w-4" />} onSelect={() => go({ page: 'flow' })}>How it works</MenuItem>
          {role === 'owner' && <MenuItem icon={<Settings className="h-4 w-4" />} onSelect={() => go({ page: 'settings' })}>Settings</MenuItem>}
        </Menu>
      </div>
    </nav>
  )
}

/* Phones and tablets only: the sidebar's top row (logo, search, record, account). */
export function TopBar() {
  const role = useStore((s) => s.role)
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const open = useStore((s) => s.open)
  const setPalette = useStore((s) => s.setPalette)
  const title = NAV[activeNav(route.page)]?.label || ({ flow: 'How it works', settings: 'Settings' } as Record<string, string>)[route.page] || 'Cobblestone'
  return (
    <header className="sticky top-[env(safe-area-inset-top,0)] z-20 flex h-14 items-center gap-2 border-b border-line bg-white/95 px-4 backdrop-blur-md lg:hidden">
      <button onClick={() => go(homeOf(role))} aria-label="Home" className="shrink-0">
        <Logo size={30} />
      </button>
      <span className="ml-1 min-w-0 flex-1 truncate text-[1rem] font-bold text-ink">{title}</span>
      <button onClick={() => setPalette(true)} aria-label="Search" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-wash-2">
        <Search className="h-[1.125rem] w-[1.125rem]" />
      </button>
      <Notifications />
      <NewMenu align="end" trigger={<button aria-label="New" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700"><Plus className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.2} /></button>} />
      <Menu
        align="end"
        width={260}
        trigger={
          <button aria-label="Account" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
            <Avatar who={meOf(role)} size={30} />
          </button>
        }
      >
        <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1.5">
          <Avatar who={meOf(role)} size={30} />
          <div className="min-w-0">
            <div className="truncate text-[0.875rem] font-medium text-ink">{PEOPLE[meOf(role)].name}</div>
            <div className="truncate text-[0.78125rem] text-muted">{roleDef(role).label}</div>
          </div>
        </div>
        <MenuSep />
        <UserMenuItems />
      </Menu>
    </header>
  )
}

/** the bell opens a panel down the right side: what's new on top, then earlier */
function Notifications({ dark, big }: { dark?: boolean; big?: boolean }) {
  const notices = useStore((s) => s.notices)
  const commit = useStore((s) => s.commit)
  const open = useStore((s) => s.open)
  const role = useStore((s) => s.role)
  const [on, setOn] = React.useState(false)
  const list = role === 'accounting' ? notices.filter((n) => n.kind === 'money') : notices
  const unread = list.filter((n) => n.unread).length
  const icon = (k: string) => ({ material: Package, pricing: FileText, money: Receipt, field: HardHat, change: Repeat } as any)[k] || Bell
  const item = (n: (typeof list)[number]) => {
    const Ic = icon(n.kind)
    return (
      <button key={n.id} onClick={() => { commit((s) => { const x = s.notices.find((y) => y.id === n.id); if (x) x.unread = false }); setOn(false); if (n.jobId) open({ t: 'job', id: n.jobId }) }} className="flex w-full items-start gap-3 rounded-[0.75rem] px-3 py-2.5 text-left transition hover:bg-wash">
        <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.5625rem]', n.unread ? 'bg-brand-50 text-brand-600' : 'bg-wash-2 text-muted')}><Ic className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[0.84375rem] leading-snug', n.unread ? 'font-semibold text-ink' : 'text-ink-2')}>{n.text}</span>
          <span className="mt-0.5 block text-[0.75rem] text-muted">{n.when}</span>
        </span>
        {n.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-bad-500" />}
      </button>
    )
  }
  return (
    <Dialog.Root open={on} onOpenChange={setOn}>
      <Dialog.Trigger asChild>
        <button aria-label="Notifications" className={cn('relative inline-flex shrink-0 items-center justify-center', big ? 'h-9 w-9 rounded-[0.5625rem] border border-line bg-white text-ink-2 shadow-xs hover:border-[#cdc7bc]' : 'h-9 w-9 rounded-[0.625rem] text-muted hover:bg-wash-2 hover:text-ink', dark && 'text-white/60 hover:bg-white/[0.06] hover:text-white')}>
          <Bell className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.8} />
          {unread > 0 && (big ? <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bad-500 px-1 text-[0.6875rem] font-bold text-white ring-2 ring-canvas">{unread}</span> : <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-bad-500 ring-2 ring-white" />)}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[260] bg-[rgba(20,26,36,.28)] animate-fade-in" />
        <Dialog.Content aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()} className="fixed inset-y-0 right-0 z-[270] flex w-[26.25rem] max-w-full flex-col bg-white shadow-modal outline-none animate-sheet-in">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-[1.125rem] font-semibold text-ink">Notifications</Dialog.Title>
            {unread > 0 && <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-bad-500 px-1.5 text-[0.71875rem] font-semibold text-white">{unread}</span>}
            <button className="ml-auto text-[0.8125rem] font-semibold text-brand-700 hover:underline disabled:text-faint disabled:no-underline" disabled={!unread} onClick={() => commit((s) => s.notices.forEach((n) => (n.unread = false)))}>Mark all read</button>
            <Dialog.Close aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-[0.5rem] text-muted hover:bg-wash-2 hover:text-ink"><X className="h-4 w-4" /></Dialog.Close>
          </div>
          <div className="scroll-soft min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {unread > 0 && <div className="px-3 pb-1 text-[0.75rem] font-semibold text-muted">New</div>}
            {list.filter((n) => n.unread).map(item)}
            {list.some((n) => !n.unread) && <div className="px-3 pb-1 pt-3 text-[0.75rem] font-semibold text-muted">Earlier</div>}
            {list.filter((n) => !n.unread).map(item)}
            {!list.length && <div className="px-3 py-10 text-center text-[0.84375rem] text-muted">Nothing new.</div>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function CommandPalette() {
  const openP = useStore((s) => s.paletteOpen)
  const setPalette = useStore((s) => s.setPalette)
  const jobs = useStore((s) => s.jobs)
  const tasks = useStore((s) => s.tasks)
  const role = useStore((s) => s.role)
  const open = useStore((s) => s.open)
  const go = useStore((s) => s.go)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(!useStore.getState().paletteOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPalette])

  const run = (fn: () => void) => {
    setPalette(false)
    setTimeout(fn, 10)
  }
  const item = 'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[0.90625rem] text-ink outline-none'
  return (
    <Dialog.Root open={openP} onOpenChange={setPalette}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] animate-overlay-in bg-[rgba(13,22,40,.32)] backdrop-blur-[0.125rem]" />
        <div className="pointer-events-none fixed inset-0 z-[91] flex items-start justify-center pt-[11vh]">
          <Dialog.Content aria-describedby={undefined} className="pointer-events-auto w-[min(43.75rem,94vw)] overflow-hidden rounded-2xl bg-white shadow-modal outline-none animate-modal-in">
            <Dialog.Title className="sr-only">Search</Dialog.Title>
            <Command label="Search everything" loop filter={paletteFilter}>
              <div className="flex h-16 items-center gap-3 border-b border-line-2 px-5">
                <Search className="h-5 w-5 text-faint" />
                <Command.Input autoFocus placeholder="Search projects, clients, tasks, or type an action…" className="h-full flex-1 bg-transparent text-[1.03125rem] text-ink placeholder:text-faint focus:outline-none" />
                <Kbd>Esc</Kbd>
              </div>
              <Command.List className="scroll-soft max-h-[min(28.75rem,60vh)] overflow-y-auto p-2">
                <Command.Empty className="px-4 py-10 text-center text-[0.90625rem] text-muted">Nothing matches that.</Command.Empty>
                <Command.Group heading="Projects">
                  {Object.values(jobs).map((j) => (
                    <Command.Item key={j.id} value={`${j.name} ${j.client} ${j.address} project job`} onSelect={() => run(() => open({ t: 'job', id: j.id, tab: role === 'accounting' ? 'money' : undefined }))} className={item}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{j.name}</span>
                        <span className="block truncate text-[0.78125rem] text-muted">{j.client} · {j.address}</span>
                      </span>
                      <span className="text-[0.78125rem] font-semibold text-muted">{STAGE_LABEL[j.stage]}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
                {role !== 'accounting' && (
                  <Command.Group heading="Clients">
                    {Object.values(CUSTOMERS).map((c) => (
                      <Command.Item key={c.id} value={`${c.name} ${c.kind} client`} onSelect={() => run(() => open({ t: 'customer', id: c.id }))} className={item}>
                        <span className="inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-[0.5625rem] bg-wash-2 text-muted"><Building2 className="h-4 w-4" /></span>
                        <span className="flex-1 truncate font-semibold">{c.name}</span>
                        <span className="text-[0.78125rem] text-muted">{c.kind}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                <Command.Group heading="Tasks">
                  {tasks.filter((t) => t.state !== 'done' && (role === 'owner' || t.for.includes(role))).map((t) => (
                    <Command.Item key={t.id} value={`${t.title} ${jobs[t.jobId]?.name} task`} onSelect={() => run(() => open({ t: 'task', id: t.id }))} className={item}>
                      <span className="inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-[0.5625rem] bg-brand-50 text-brand-600"><CircleCheck className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{t.title}</span>
                        <span className="block truncate text-[0.78125rem] text-muted">{jobs[t.jobId]?.name}</span>
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Actions">
                  {[
                    { l: 'Log what happened', k: 'record log update event site issue', f: () => open({ t: 'new' }) },
                    ...(role !== 'accounting' ? [{ l: 'New project', k: 'new project create job won', f: () => open({ t: 'newproject' }) }, { l: 'Touch-ups or punch list', k: 'punch touch up list repair', f: () => open({ t: 'punchnew' }) }] : []),
                    ...(role !== 'accounting' ? [{ l: 'New price request', k: 'new request bid', f: () => open({ t: 'newreq' }) }] : []),
                    { l: 'Go to Billing', k: 'billing money invoice payment deposit', f: () => go({ page: 'money' }) },
                    ...(role !== 'accounting' ? [{ l: 'Go to the Schedule', k: 'game plan schedule crew calendar month', f: () => go({ page: 'upcoming' }) }] : []),
                    { l: 'How the whole process works', k: 'how it works process map flow', f: () => go({ page: 'flow' }) },
                    { l: 'Switch login (demo)', k: 'switch login role demo', f: () => open({ t: 'roles' }) },
                  ].map((a) => (
                    <Command.Item key={a.l} value={a.l + ' ' + a.k} onSelect={() => run(a.f)} className={item}>
                      <span className="inline-flex h-[2.125rem] w-[2.125rem] items-center justify-center rounded-[0.5625rem] bg-wash-2 text-ink-2"><ArrowRight className="h-4 w-4" /></span>
                      <span className="flex-1 font-semibold">{a.l}</span>
                      <CornerDownLeft className="h-4 w-4 text-faint" />
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
