/* One set of words for where things stand — the same on every page, the same in every window.
 * The admin sees the whole book under Settings → Statuses. */
import type { Store } from '@/tileos/store'
import type { Job, Tone } from '@/tileos/data/model'
import type { BubbleColor } from '@/tileos/components/ui/page'

/* ---------------- projects ---------------- */
export type ProjectStatusKey = 'setup' | 'ready' | 'progress' | 'hold' | 'touchups' | 'done'
export const PROJECT_STATUS: Record<ProjectStatusKey, { label: string; tone: Tone; color: BubbleColor }> = {
  setup: { label: 'Setup', tone: 'vio', color: 'violet' },
  ready: { label: 'Ready to start', tone: 'info', color: 'blue' },
  progress: { label: 'In progress', tone: 'ok', color: 'green' },
  hold: { label: 'On hold', tone: 'bad', color: 'red' },
  touchups: { label: 'Touch-ups', tone: 'warn', color: 'amber' },
  done: { label: 'Finished', tone: 'neutral', color: 'teal' },
}
export function stageStatus(job: Job): ProjectStatusKey {
  if (['awarded', 'setup', 'verification'].includes(job.stage)) return 'setup'
  if (['ready', 'scheduled'].includes(job.stage)) return 'ready'
  if (job.stage === 'installation') return 'progress'
  if (job.stage === 'punch') return 'touchups'
  return 'done'
}
/** where a won project stands — "On hold" wins over the stage while something stops the work */
export function projectStatus(_s: Pick<Store, 'jobs'> | Store, job: Job): { key: ProjectStatusKey; label: string; tone: Tone; why?: string } {
  if (job.hold) return { key: 'hold', label: 'On hold', tone: 'bad', why: job.hold.reason }
  const k = stageStatus(job)
  return { key: k, label: PROJECT_STATUS[k].label, tone: PROJECT_STATUS[k].tone }
}

/* ---------------- the book: every page's statuses, what each one means ---------------- */
export type StatusDef = { label: string; color: BubbleColor; means: string }
export const STATUS_BOOK: { page: string; items: StatusDef[] }[] = [
  {
    page: 'Estimates',
    items: [
      { label: 'Request', color: 'violet', means: 'Came in — the plans and papers, before the takeoff' },
      { label: 'Takeoff', color: 'blue', means: 'Measuring and pricing from the plans. A revision comes back here and says “Revision 2”' },
      { label: 'Office review', color: 'blue', means: 'The estimator checks the takeoff — notes go back pinned to the room' },
      { label: 'Final review', color: 'blue', means: 'The last look before it goes out — approve and send' },
      { label: 'Sent', color: 'cyan', means: 'With the client — waiting for a yes or no; it comes back to follow up' },
      { label: 'Approved', color: 'green', means: 'Won — it becomes a project' },
      { label: 'Lost', color: 'slate', means: 'Went to someone else, or dropped' },
    ],
  },
  {
    page: 'Projects',
    items: [
      { label: 'Getting ready', color: 'violet', means: 'Won, not started — its checklist shows every step and who has it. The row says Setup or Ready to start' },
      { label: 'In progress', color: 'green', means: 'The crew is installing — how far along, and what holds anything up' },
      { label: 'On hold', color: 'red', means: 'Work stopped — the reason shows (waiting for tile, the GC, the site)' },
      { label: 'Touch-ups', color: 'amber', means: 'Punch list and the return visit' },
      { label: 'Repairs', color: 'rose', means: 'Callbacks and warranty fixes, booked with a crew and a day' },
      { label: 'Finished', color: 'teal', means: 'Done on site — final bill and retainage' },
    ],
  },
  {
    page: 'Checklist steps (inside every project)',
    items: [
      { label: 'Done', color: 'green', means: 'Checked off — by what happened in the system, or by the person who has it' },
      { label: 'Their turn', color: 'blue', means: 'The steps before it are done — it’s on that person’s Today' },
      { label: 'Waiting', color: 'amber', means: 'On someone outside: a delivery date, a payment, an installer to accept' },
      { label: 'Later', color: 'slate', means: 'Waits for an earlier step — it opens by itself' },
      { label: 'Problem', color: 'red', means: 'Something’s wrong — short tile, a turned-down PO' },
    ],
  },
  {
    page: 'Schedule',
    items: [
      { label: 'Booked', color: 'green', means: 'The installer confirmed the dates' },
      { label: 'Planned', color: 'blue', means: 'Installer and dates picked — not booked yet' },
      { label: 'Ready to book', color: 'violet', means: 'Ready to start — no installer or dates yet' },
      { label: 'On hold', color: 'red', means: 'Dates paused — waiting on tile, the GC or the site' },
    ],
  },
  {
    page: 'Purchase orders',
    items: [
      { label: 'Draft', color: 'violet', means: 'Written, not sent yet' },
      { label: 'Sent', color: 'amber', means: 'With the supplier or installer — waiting to confirm' },
      { label: 'Confirmed', color: 'blue', means: 'Confirmed, with a delivery date' },
      { label: 'Received', color: 'green', means: 'Everything came in' },
      { label: 'Late', color: 'red', means: 'Past the delivery date' },
    ],
  },
  {
    page: 'Tile (from the tile store)',
    items: [
      { label: 'Ordered', color: 'blue', means: 'The GC or client ordered it — we log when it lands' },
      { label: 'Partly delivered', color: 'amber', means: 'Some boxes came — the rest has a date' },
      { label: 'Delivered', color: 'green', means: 'All of it is on site' },
    ],
  },
  {
    page: 'Tile shortage',
    items: [
      { label: 'Found short', color: 'red', means: 'Reported by the crew, the site manager or a short delivery — which tile, how much, which surfaces' },
      { label: 'Reordered', color: 'amber', means: 'Whoever orders materials asked the GC’s store (or ordered it) — with a delivery date' },
      { label: 'On the way', color: 'blue', means: 'The date shows on the project and the Schedule; late turns red. On hold if the crew can’t keep working' },
      { label: 'Back to work', color: 'green', means: 'Received — the surfaces open up and the crew gets a task' },
    ],
  },
  {
    page: 'Installer pay',
    items: [
      { label: 'This week so far', color: 'slate', means: 'Builds up from the daily updates — nothing to approve yet' },
      { label: 'To approve', color: 'amber', means: 'Week closed: daily updates × PO rates' },
      { label: 'Bill doesn’t match', color: 'red', means: 'Their bill is different from what the updates add up to' },
      { label: 'Approved', color: 'green', means: 'Goes out with the next pay run' },
    ],
  },
  {
    page: 'Billing',
    items: [
      { label: 'Coming up', color: 'slate', means: 'Will be due — after a milestone or the next progress bill' },
      { label: 'To invoice', color: 'amber', means: 'Ready to send' },
      { label: 'Waiting for payment', color: 'blue', means: 'Sent to the client — not paid yet' },
      { label: 'Paid', color: 'green', means: 'Money is in' },
    ],
  },
  {
    page: 'Tasks',
    items: [
      { label: 'To do today', color: 'blue', means: 'Yours, due today or late — the number on Today in the menu' },
      { label: 'Coming up', color: 'slate', means: 'Yours, due tomorrow or later — it moves to To do today on its day' },
      { label: 'Waiting on others', color: 'amber', means: 'Someone owes an answer — it comes back on its date' },
      { label: 'The team', color: 'indigo', means: 'Everyone’s open work, by person. “Only what I follow” shows the ones you asked to see' },
      { label: 'For everyone', color: 'orange', means: 'Pinned on everyone’s Today until it’s done (one person still owns it)' },
      { label: 'Done', color: 'green', means: 'Finished — stays in the history' },
    ],
  },
]
