/* Core types and constants for Cobblestone Tile OS (mockup data layer).
 * The same shapes map onto Supabase tables when this moves into the real app. */

export type Role = 'owner' | 'pm' | 'office' | 'takeoff' | 'estimator' | 'site' | 'materials' | 'accounting' | 'crew' | 'client'

export type Stage =
  | 'request' | 'estimating' | 'proposal' | 'followup'
  | 'awarded' | 'setup' | 'verification' | 'ready'
  | 'scheduled' | 'installation'
  | 'punch' | 'closeout' | 'complete'

export type Phase = 'pricing' | 'ready' | 'installing' | 'closing'

export type Tone = 'bad' | 'warn' | 'ok' | 'info' | 'neutral' | 'vio'

export const PHASES: { key: Phase; label: string; stages: Stage[]; hint: string }[] = [
  { key: 'pricing', label: 'Pricing', stages: ['request', 'estimating', 'proposal', 'followup'], hint: 'Request → Estimating → Proposal → Follow-up' },
  { key: 'ready', label: 'Getting ready', stages: ['awarded', 'setup', 'verification', 'ready'], hint: 'Awarded → Setup → Verification → Ready' },
  { key: 'installing', label: 'Installing', stages: ['scheduled', 'installation'], hint: 'Scheduled → Installation' },
  { key: 'closing', label: 'Closing out', stages: ['punch', 'closeout', 'complete'], hint: 'Punch → Closeout → Complete' },
]

/** still being priced — an estimate, not a project yet */
export const PRICING_STAGES: string[] = ['request', 'estimating', 'proposal', 'followup']
export const STAGE_LABEL: Record<Stage, string> = {
  request: 'New request', estimating: 'Estimating', proposal: 'Pending approval', followup: 'Pending approval',
  awarded: 'Won', setup: 'Setup', verification: 'Site check', ready: 'Ready to start',
  scheduled: 'Ready to start', installation: 'In progress',
  punch: 'Touch-ups', closeout: 'Finished', complete: 'Finished',
}

export const ALL_STAGES: Stage[] = PHASES.flatMap((p) => p.stages)
export const stageIndex = (s: Stage) => ALL_STAGES.indexOf(s)
export const phaseOf = (s: Stage): Phase => PHASES.find((p) => p.stages.includes(s))!.key
export const phaseLabel = (p: Phase) => PHASES.find((x) => x.key === p)!.label

/* The job's own progress track once it is won (pricing collapses into "Won"). */
export const JOB_TRACK: { key: string; label: string; stages: Stage[] }[] = [
  { key: 'won', label: 'Won', stages: ['request', 'estimating', 'proposal', 'followup', 'awarded'] },
  { key: 'setup', label: 'Setup', stages: ['setup'] },
  { key: 'verification', label: 'Verified', stages: ['verification'] },
  { key: 'ready', label: 'Ready', stages: ['ready'] },
  { key: 'scheduled', label: 'Scheduled', stages: ['scheduled'] },
  { key: 'installation', label: 'Installing', stages: ['installation'] },
  { key: 'punch', label: 'Punch', stages: ['punch'] },
  { key: 'closeout', label: 'Closeout', stages: ['closeout'] },
  { key: 'complete', label: 'Complete', stages: ['complete'] },
]
export const PRICING_TRACK: { key: Stage | 'award'; label: string }[] = [
  { key: 'request', label: 'Request' },
  { key: 'estimating', label: 'Estimating' },
  { key: 'proposal', label: 'Proposal' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'award', label: 'Award' },
]

/* ---------------- people ---------------- */
export type PersonKey =
  | 'ys' | 'office' | 'takeoff' | 'estimator' | 'materials' | 'accounting'
  | 'walter' | 'leo' | 'alex' | 'philip' | 'caesar' | 'giovanni' | 'jose'
  | 'yakov'
  | 'gcpp'
  | 'system'

export interface Person {
  key: PersonKey
  name: string
  short: string
  initials: string
  /** tailwind classes for the avatar */
  bg: string
  fg: string
  crew?: boolean
  roleLabel?: string
}

export const PEOPLE: Record<PersonKey, Person> = {
  ys: { key: 'ys', name: 'Yaakov Stein', short: 'Yaakov', initials: 'YS', bg: 'bg-[#dde5f9]', fg: 'text-[#1f42ad]', roleLabel: 'Owner · COO' },
  yakov: { key: 'yakov', name: 'Yakov', short: 'Yakov', initials: 'YK', bg: 'bg-[#d8edf5]', fg: 'text-[#0b5f80]', roleLabel: 'Site manager' },
  office: { key: 'office', name: 'Back office', short: 'Office', initials: 'BO', bg: 'bg-[#e4e7ec]', fg: 'text-[#46505f]', roleLabel: 'Back office' },
  takeoff: { key: 'takeoff', name: 'Takeoff estimator', short: 'Takeoff', initials: 'TK', bg: 'bg-[#d6efea]', fg: 'text-[#0d6b61]', roleLabel: 'Takeoff estimator' },
  estimator: { key: 'estimator', name: 'Estimator', short: 'Estimator', initials: 'ES', bg: 'bg-[#e8e3f9]', fg: 'text-[#5536ad]', roleLabel: 'Estimator · office' },
  materials: { key: 'materials', name: 'Materials', short: 'Materials', initials: 'MA', bg: 'bg-[#f9e8d6]', fg: 'text-[#8c4609]', roleLabel: 'Materials' },
  accounting: { key: 'accounting', name: 'Accounting', short: 'Accounting', initials: 'AC', bg: 'bg-[#d8efe2]', fg: 'text-[#1b6a40]', roleLabel: 'Accounting' },
  gcpp: { key: 'gcpp', name: 'GC super (Park Place)', short: 'GC super', initials: 'GS', bg: 'bg-[#e4e7ec]', fg: 'text-[#3e4757]', roleLabel: 'GC · Client' },
  walter: { key: 'walter', name: 'Walter', short: 'Walter', initials: 'W', bg: 'bg-[#e2efd9]', fg: 'text-[#3d6a1d]', crew: true },
  leo: { key: 'leo', name: 'Leo', short: 'Leo', initials: 'L', bg: 'bg-[#ebe4fa]', fg: 'text-[#5a3eae]', crew: true },
  alex: { key: 'alex', name: 'Alex', short: 'Alex', initials: 'A', bg: 'bg-[#d9eff0]', fg: 'text-[#11666a]', crew: true },
  philip: { key: 'philip', name: 'Philip', short: 'Philip', initials: 'P', bg: 'bg-[#fbe6d6]', fg: 'text-[#9c470d]', crew: true },
  caesar: { key: 'caesar', name: 'Caesar', short: 'Caesar', initials: 'C', bg: 'bg-[#f9e0e4]', fg: 'text-[#a12841]', crew: true },
  giovanni: { key: 'giovanni', name: 'Giovanni', short: 'Giovanni', initials: 'G', bg: 'bg-[#e1e7f0]', fg: 'text-[#36507a]', crew: true },
  jose: { key: 'jose', name: 'Jose (Jersey)', short: 'Jose', initials: 'J', bg: 'bg-[#efe6da]', fg: 'text-[#74532c]', crew: true },
  system: { key: 'system', name: 'Tile OS', short: 'Tile OS', initials: 'OS', bg: 'bg-ink', fg: 'text-white' },
}
/** who gets the game plan */
export const seesUpcoming = (r: Role) => ['owner', 'pm', 'office', 'site', 'materials'].includes(r)
export const CREWS: PersonKey[] = ['walter', 'leo', 'alex', 'philip', 'caesar', 'giovanni', 'jose']

/* soft block colors for each crew on the schedule (same family as the avatar) */
export const CREW_BLOCK: Record<string, { bg: string; bar: string; text: string }> = {
  walter: { bg: '#EEF7E9', bar: '#5B9A34', text: '#2F5716' },
  leo: { bg: '#F3EEFC', bar: '#7D57C9', text: '#4B2E8A' },
  alex: { bg: '#E8F6F6', bar: '#1A9090', text: '#0B5858' },
  philip: { bg: '#FEF2E7', bar: '#D66A16', text: '#8A3F07' },
  caesar: { bg: '#FDEDEF', bar: '#C83A52', text: '#7F1A2C' },
  giovanni: { bg: '#EBF0F7', bar: '#4A6A96', text: '#26405F' },
  jose: { bg: '#F5F1EA', bar: '#8A6D45', text: '#5A4426' },
}

export interface RoleDef {
  key: Role
  label: string
  person: PersonKey
  greetName: string
  sees: string
  nav: string[]
}

export const ROLES: RoleDef[] = [
  { key: 'owner', label: 'Admin · Owner', person: 'ys', greetName: 'Yanky', sees: 'Everything — and controls who sees what', nav: ['today', 'estimates', 'projects', 'upcoming', 'pos', 'pay', 'money', 'items', 'clients', 'designers', 'subs', 'suppliers'] },
  { key: 'pm', label: 'Project manager', person: 'ys', greetName: 'Yanky', sees: 'Projects, readiness, changes, schedule', nav: ['today', 'estimates', 'projects', 'upcoming', 'pos', 'items', 'clients', 'designers', 'subs', 'suppliers'] },
  { key: 'office', label: 'Office', person: 'office', greetName: 'team', sees: 'Requests, follow-ups, project setup, documents, materials and deliveries', nav: ['today', 'estimates', 'projects', 'upcoming', 'pos', 'items', 'clients', 'designers', 'subs', 'suppliers'] },
  { key: 'takeoff', label: 'Takeoff estimator', person: 'takeoff', greetName: 'team', sees: 'The first pass on every estimate — quantities from the plans', nav: ['today', 'estimates', 'items'] },
  { key: 'estimator', label: 'Estimator', person: 'estimator', greetName: 'team', sees: 'Takeoffs from the plans, reviews, revisions and changes', nav: ['today', 'estimates', 'projects', 'items', 'clients', 'designers'] },
  { key: 'site', label: 'Site manager', person: 'yakov', greetName: 'Yakov', sees: 'Walkthroughs, field issues, daily updates, the daily crew report', nav: ['today', 'projects', 'upcoming', 'subs'] },
  { key: 'materials', label: 'Materials', person: 'materials', greetName: 'team', sees: 'Tile quantities, deliveries, our POs', nav: ['today', 'projects', 'upcoming', 'pos', 'items', 'suppliers'] },
  { key: 'accounting', label: 'Accounting', person: 'accounting', greetName: 'team', sees: 'Billing, purchase orders and installer pay', nav: ['money', 'today', 'pos', 'pay'] },
  { key: 'client', label: 'GC · Client', person: 'gcpp', greetName: 'there', sees: 'Only their own projects — progress, photos, approvals, invoices and messages', nav: ['portal'] },
  { key: 'crew', label: 'Crew · foreman', person: 'philip', greetName: 'Philip', sees: 'Where to work and what not to start — on his phone', nav: [] },
]
/** the login types people get: five inside, plus the installers' phones and the GC's portal.
 *  Project manager folds into Admin, Takeoff into Estimator, Materials into Office — their work follows. */
export const LOGIN_TYPES: Role[] = ['owner', 'office', 'estimator', 'site', 'accounting', 'crew', 'client']
const MERGED: Partial<Record<Role, Role>> = { pm: 'owner', takeoff: 'estimator', materials: 'office' }
/** the login type a role's work shows up for */
export const loginOf = (r: Role): Role => MERGED[r] || r
/** team members on a login type that's been folded in move over (not Project manager — that would make them an admin) */
export function moveLogins(team: Member[]) {
  team.forEach((m) => { if (m.role === 'takeoff' || m.role === 'materials') m.role = loginOf(m.role) })
}
/** what each login sees — the admin changes it in Settings; this map follows the store */
export const ACCESS: Record<Role, string[]> = Object.fromEntries(ROLES.map((r) => [r.key, [...r.nav]])) as Record<Role, string[]>
export const roleDef = (r: Role) => {
  const d = ROLES.find((x) => x.key === r)!
  return { ...d, nav: ACCESS[r] || d.nav }
}
/** the pages a login can be given, in menu order */
export const ACCESS_PAGES: { key: string; label: string; group: string }[] = [
  { key: 'today', label: 'Today', group: '' },
  { key: 'estimates', label: 'Estimates', group: 'Work' },
  { key: 'projects', label: 'Projects', group: 'Work' },
  { key: 'upcoming', label: 'Schedule', group: 'Work' },
  { key: 'pos', label: 'Purchase orders', group: 'Money' },
  { key: 'pay', label: 'Installer pay', group: 'Money' },
  { key: 'money', label: 'Billing', group: 'Money' },
  { key: 'items', label: 'Items', group: 'Money' },
  { key: 'clients', label: 'Clients', group: 'People' },
  { key: 'designers', label: 'Designers', group: 'People' },
  { key: 'subs', label: 'Installers', group: 'People' },
  { key: 'suppliers', label: 'Suppliers', group: 'People' },
]
/** the people who sign in — the admin adds them, names them and picks their login */
/** another way to reach someone — a cell besides the office line, a billing email — with what it's for */
export interface Reach { kind: 'phone' | 'email'; value: string; label?: string }
export interface Member { key: PersonKey; first: string; last?: string; email?: string; phone?: string; /** more phones and emails */ more?: Reach[]; role: Role; status: 'active' | 'invited' | 'off'; /** GC · Client logins: whose projects they see */ clientId?: string; /** the real app: the sign-in this person uses */ uid?: string; /** installers: what they do and where they work */ trade?: string; region?: string; /** the day the admin sent them the invite */ invited?: string }
export const TEAM0: Member[] = [
  { key: 'ys', first: 'Yaakov', last: 'Stein', role: 'owner', status: 'active' },
  { key: 'yakov', first: 'Yakov', role: 'site', status: 'active' },
  { key: 'office', first: 'Back office', role: 'office', status: 'active' },
  { key: 'takeoff', first: 'Takeoff estimator', role: 'estimator', status: 'active' },
  { key: 'estimator', first: 'Estimator', role: 'estimator', status: 'active' },
  { key: 'materials', first: 'Materials', role: 'office', status: 'active' },
  { key: 'accounting', first: 'Accounting', role: 'accounting', status: 'active' },
  { key: 'gcpp', first: 'GC super', last: '(Park Place)', role: 'client', status: 'active', clientId: 'parkplace' },
]
const AV: [string, string][] = [['bg-[#dde5f9]', 'text-[#1f42ad]'], ['bg-[#d6efea]', 'text-[#0d6b61]'], ['bg-[#e8e3f9]', 'text-[#5536ad]'], ['bg-[#f9e0ee]', 'text-[#9b1f63]'], ['bg-[#f9e8d6]', 'text-[#8c4609]'], ['bg-[#d8efe2]', 'text-[#1b6a40]'], ['bg-[#e4e7ec]', 'text-[#46505f]'], ['bg-[#d8edf5]', 'text-[#0b5f80]']]
/* installers added on the Installers page are team members with the installer role — they join the crews */
const BASE_CREWS = [...CREWS]
const CREW_COLORS: { bg: string; bar: string; text: string; av: [string, string] }[] = [
  { bg: '#EAF4FB', bar: '#2F7FB8', text: '#174A70', av: ['bg-[#dcecf7]', 'text-[#174a70]'] },
  { bg: '#FBF0F7', bar: '#B44B8C', text: '#6E1F50', av: ['bg-[#f7e1ef]', 'text-[#6e1f50]'] },
  { bg: '#F1F5E8', bar: '#6F8F2A', text: '#3E5212', av: ['bg-[#e6eed4]', 'text-[#3e5212]'] },
  { bg: '#FFF4E5', bar: '#C77C12', text: '#734504', av: ['bg-[#fbe9cc]', 'text-[#734504]'] },
  { bg: '#EEF0FB', bar: '#5B63C9', text: '#2F3584', av: ['bg-[#e2e4f8]', 'text-[#2f3584]'] },
]
export const crewInfo: Record<string, { trade: string; region?: string; phone?: string; email?: string; more?: Reach[] }> = {}
function applyCrews(team: Member[]) {
  /* a standing crew whose details were changed on the Installers page: his phone, email, trade and area */
  team.filter((m) => m.role === 'crew' && BASE_CREWS.includes(m.key)).forEach((m) => { crewInfo[m.key] = { trade: m.trade || 'Tile installation', region: m.region, phone: m.phone, email: m.email, more: m.more } })
  const added = team.filter((m) => m.role === 'crew' && m.status !== 'off' && !BASE_CREWS.includes(m.key))
  const keep = new Set([...BASE_CREWS, ...added.map((m) => m.key)])
  for (let i = CREWS.length - 1; i >= 0; i--) if (!keep.has(CREWS[i])) CREWS.splice(i, 1)
  added.forEach((m, i) => {
    if (!CREWS.includes(m.key)) CREWS.push(m.key)
    const c = CREW_COLORS[i % CREW_COLORS.length]
    if (!CREW_BLOCK[m.key]) CREW_BLOCK[m.key] = { bg: c.bg, bar: c.bar, text: c.text }
    crewInfo[m.key] = { trade: m.trade || 'Tile installation', region: m.region, phone: m.phone, email: m.email, more: m.more }
    const p = PEOPLE[m.key]
    if (p) { p.crew = true; p.roleLabel = 'Installer'; p.bg = c.av[0]; p.fg = c.av[1] }
  })
}
/** keep every name on screen in step with the team list */
export function applyTeam(team: Member[]) {
  applyTeamNames(team)
  applyCrews(team)
}
/** login spots named for the work, not a person — they keep their whole name */
const ROLE_NAMES = new Set(['Back office', 'Takeoff estimator', 'Estimator', 'Materials', 'Accounting', 'New person', 'Tile OS'])
function applyTeamNames(team: Member[]) {
  team.forEach((m, i) => {
    const name = [m.first, m.last].filter(Boolean).join(' ').trim() || 'New person'
    const words = name.split(' ').filter(Boolean)
    const initials = (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
    const cur = PEOPLE[m.key]
    /* a person goes by their first name ("Mordcha", even when the whole name was typed as the first); a role-type
     * login nobody has taken yet ("Back office") keeps its whole name */
    const short = m.last ? m.first : ROLE_NAMES.has(name) ? name : words[0]
    PEOPLE[m.key] = { ...(cur || { key: m.key, bg: AV[i % AV.length][0], fg: AV[i % AV.length][1] }), key: m.key, name, short, initials, roleLabel: ROLES.find((r) => r.key === m.role)?.label.split(' · ')[0] }
  })
}

/* ---------------- jobs ---------------- */
export type SwatchKey =
  | 'blueprint' | 'grigio' | 'hex' | 'toscana' | 'subway' | 'bianco' | 'pearl' | 'calacatta'
  | 'terrazzo' | 'zellige' | 'travertine' | 'herringbone' | 'cement' | 'blackhex' | 'sage' | 'slate'

export type BuildingKind = 'brownstone' | 'townhouse' | 'tower' | 'midrise' | 'house' | 'estate' | 'retail' | 'lobby' | 'walkup'

export interface Issue { tone: Tone; text: string }

export interface Job {
  id: string
  name: string
  client: string
  clientId: string
  address: string
  stage: Stage
  status: Tone
  headline: string
  issues: Issue[]
  next: { text: string; owner: PersonKey; due?: string; dueTone?: Tone }
  pct?: number
  crew?: PersonKey
  workers?: number
  pm?: PersonKey
  site?: PersonKey
  estimator?: PersonKey | null
  keyDate: { label: string; value: string; tone?: Tone }
  dates?: { start?: string; finish?: string; awarded?: string }
  swatch: SwatchKey
  building: BuildingKind
  scope?: string
  readiness?: 'ready' | 'partial' | 'not'
  contract?: number
  /** the client's PO / subcontract number, once it's in */
  clientPO?: string
  lostReason?: string
  /** install work, or a repair job */
  kind?: 'install' | 'repair'
  stageDates?: Record<string, string>
  /** stopped while something is missing (tile, the GC, the site) — the project shows On hold */
  hold?: { reason: string; since: string; by: PersonKey; shortage?: string }
  /** billed and paid before Tile OS (from QuickBooks) — the progress bills pick up from there */
  before?: { billed: number; paid: number; retainage?: number; changes?: number }
}

export interface Customer {
  id: string
  name: string
  kind: string
  address: string
  phone: string
  email: string
  notes: string
  contacts: { name: string; role: string; phone: string; email: string; more?: Reach[] }[]
  /** more phones and emails for the client — the office line, a cell, billing */
  more?: Reach[]
  city?: string
  zip?: string
  country?: string
  /** a card on file goes through QuickBooks Payments' secure page — we only ever keep the brand and last 4 */
  card?: { status: 'link-sent' | 'on-file'; brand?: string; last4?: string; sent?: string }
  /** the same client in QuickBooks (set the first time one of their invoices goes there) */
  qbId?: string
}

export const fmtMoney = (n: number, opts: { cents?: boolean; compact?: boolean } = {}) => {
  if (opts.compact && Math.abs(n) >= 1000) {
    const k = n / 1000
    return '$' + (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10).toLocaleString('en-US') + 'k'
  }
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: opts.cents ? 2 : 0, maximumFractionDigits: opts.cents ? 2 : 0 })
}
