import type { PersonKey, Role, Tone } from './model'

/* ================= tasks (one item per thing that has to happen) ================= */
export type TaskType = 'Pricing' | 'Setup' | 'Materials' | 'Field' | 'Changes' | 'Schedule' | 'Money'
export type TaskState = 'now' | 'waiting' | 'later' | 'done'
export interface LogLine { date: string; who: PersonKey; text: string }
export interface Task {
  id: string
  jobId: string
  title: string
  detail?: string
  /** who asked for it (a request from the site): they hear when it's on the way and when it's dropped off */
  by?: PersonKey
  /** something needed on site: what, and where the trip is — asked, on the way (dropped off = done) */
  req?: { what: string; trip: 'asked' | 'onway'; at?: string }
  where?: string
  type: TaskType
  owner: PersonKey
  for: Role[]
  watch?: Role[]
  state: TaskState
  due?: string
  dueTone?: Tone
  waitingOn?: string
  followUp?: string
  /** how many times someone followed up while it waited — each one is logged on the task */
  followUps?: number
  laterUntil?: string
  blocks?: string
  tone: Tone
  action?: { label: string; kind: string }
  log: LogLine[]
  doneAt?: string
  /** the day it was done (ISO) — so the team report can tell done on its day from done late */
  doneOn?: string
  /** how many times it was moved to a later day after it was already late */
  rolls?: number
  /** the day it was set for before it was first moved after going late (ISO) — lateness counts from here */
  lateFrom?: string
  /** the admin checked in on it when it was late past the company's line — off his list until that many more work
   *  days go by with it still not done */
  checkIn?: { by: PersonKey; day: string; note?: string }
  result?: string
  /** people who see it on their Following list and get told when it moves — the owner still does it */
  followers?: PersonKey[]
  /** someone reminded the owner it's late (the admin's "Remind") — it pops up on the owner's screen */
  nudge?: { by: PersonKey; at: string; day: string }
  /** shows at the top of everyone's Today until it's done */
  everyone?: boolean
  /** the checklist step this task is ("jobId:step"), or "*:step" for one task that covers that step everywhere */
  step?: string
  /** a task that comes back on a schedule */
  repeat?: 'daily' | 'weekdays' | 'weekly' | 'monthly'
  repeatAt?: string
  /** a repeating task that's turned off for now (Settings → Automations) */
  paused?: boolean
}
export const REPEAT_LABEL: Record<NonNullable<Task['repeat']>, string> = { daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week', monthly: 'Every month' }

const L = (date: string, who: PersonKey, text: string): LogLine => ({ date, who, text })

export const TASKS0: Task[] = [
  /* ---- one person does it, everybody sees it ---- */
  {
    id: 't-wilk-finishes', jobId: 'wilk', title: 'Client wants every finish picked today', type: 'Setup', owner: 'office', for: ['office'], watch: ['owner', 'pm', 'site'],
    followers: ['ys', 'yakov'], everyone: true, state: 'now', due: 'Today', dueTone: 'warn', tone: 'warn', where: 'Grout colors · edges · niche · master bath layout',
    detail: 'The client asked for all finishes to be settled today so the master bath can be released. Back office calls the designer and records each decision on its surface; everyone sees where it stands.',
    log: [L('Sep 28', 'ys', 'Client called — wants all finishes settled today'), L('Sep 28', 'office', 'Designer reached — answers by 3 PM')],
  },
  /* ---- recurring: the site manager's report, every weekday ---- */
  {
    id: 't-crewreport', jobId: '', title: 'Daily crew report — who is working where, and how far each job is', type: 'Field', owner: 'yakov', for: ['site'], watch: ['owner', 'pm'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'info', repeat: 'weekdays', repeatAt: '4 PM', where: 'Every weekday at 4 PM',
    detail: 'For every job with a crew today: how many people are working there, and where the job is up to. It goes straight to Yanky.',
    action: { label: 'Send the report', kind: 'crewreport' },
    log: [L('Sep 1', 'ys', 'Set up to repeat every weekday at 4 PM'), L('Sep 25', 'yakov', 'Sent Friday’s report — 4 jobs, 12 people')],
  },
  /* ---- owner / PM / site ---- */
  {
    id: 't-thinset', jobId: '828', title: 'Thinset is three weeks late — chase it or reorder?', type: 'Materials', owner: 'ys', for: ['owner', 'pm'], watch: ['materials', 'site'],
    state: 'now', due: '23 days late', dueTone: 'bad', tone: 'bad', blocks: 'Punch return at 828 Clyde', where: 'Lobby · front entrance',
    detail: 'PO-1039 · 24 bags of Versabond-LFT from Infinity, confirmed for Sep 5. Nothing has arrived and the return visit is on hold.',
    action: { label: 'Chase or reorder', kind: 'thinset' },
    log: [L('Aug 25', 'materials', 'PO-1039 sent to Infinity'), L('Aug 26', 'materials', 'Infinity confirmed · ETA Sep 5'), L('Sep 8', 'materials', 'Called Infinity — “next week”'), L('Sep 21', 'system', 'Two weeks late — raised to the owner')],
  },
  {
    id: 't-co004', jobId: '119', title: 'CO-004 waiting on the GC', type: 'Changes', owner: 'ys', for: ['owner', 'pm'], watch: ['estimator', 'accounting', 'site'],
    state: 'waiting', waitingOn: 'GC', followUp: 'Tomorrow', tone: 'warn', blocks: 'Boys bath walls above 3 ft', where: 'Boys Bath · main walls',
    detail: 'Full-height walls instead of the approved 3 ft. Priced at $6,850 — about 96 SF more T-06 and one crew day.',
    action: { label: 'Record approval', kind: 'co004' },
    log: [L('Sep 24', 'ys', 'Client asked for full height in the boys bath'), L('Sep 24', 'estimator', 'Priced: 96 SF more tile, one crew day, $6,850'), L('Sep 24', 'ys', 'Sent to the GC for approval'), L('Sep 26', 'ys', 'Called the GC — reviewing with the owner')],
  },
  {
    id: 't-drain', jobId: '119', title: 'Final drain sequence', type: 'Field', owner: 'ys', for: ['owner', 'pm', 'site'], watch: [],
    state: 'waiting', waitingOn: 'Plumber', followUp: 'Tue', tone: 'bad', blocks: 'Master shower floor only', where: 'Master Bath · shower floor · drain',
    detail: 'Is this the final drain, and does the trim go in before or after tile? Everything else in the master bath keeps moving.',
    action: { label: 'Record answer', kind: 'drain' },
    log: [L('Sep 22', 'ys', 'Asked during the site visit'), L('Sep 24', 'ys', 'Plumber: “I’ll check it Tuesday”')],
  },
  {
    id: 't-capacity', jobId: 'green', step: '*:installer',  title: '6 projects ready, 2 crews free this week', type: 'Schedule', owner: 'ys', for: ['owner', 'pm'],
    state: 'now', due: 'This week', tone: 'info', where: 'Crews',
    detail: 'Caesar and Giovanni have nothing booked. Green Tree is fully ready; three more can start with restrictions.',
    action: { label: 'Book them', kind: 'schedule' },
    log: [L('Sep 24', 'system', 'Green Tree passed review for scheduling')],
  },
  {
    id: 't-review114', jobId: '114', title: 'Review the 114 Park Place setup', type: 'Setup', owner: 'ys', for: ['pm'],
    state: 'now', due: 'Tomorrow', tone: 'info', where: 'Setup',
    detail: 'The office built 2 rooms and 4 surfaces and flagged a tile quantity problem before the walkthrough.',
    action: { label: 'Open setup', kind: 'open-job' },
    log: [L('Sep 25', 'office', 'Setup ready for PM review')],
  },
  {
    id: 't-walk114', jobId: '114', title: 'Walk 114 Park Place and verify what the office built', type: 'Field', owner: 'ys', for: ['site'],
    state: 'now', due: 'Wed', tone: 'info', where: 'Field verification',
    detail: '2 rooms, 4 surfaces and 2 unknowns to check on site: wall tile layout and the guest niche size.',
    action: { label: 'Start walkthrough', kind: 'open-job' },
    log: [L('Sep 25', 'office', 'Sent for field verification')],
  },
  {
    id: 't-grout828', jobId: '828', title: 'Verify the lobby grout cleanup', type: 'Field', owner: 'ys', for: ['site'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'ok', where: 'Lobby · punch item',
    detail: 'Philip marked it ready to verify this morning. Before and after photos attached.',
    action: { label: 'Verify', kind: 'verify' },
    log: [L('Sep 11', 'ys', 'Punch item created'), L('Sep 28', 'philip', 'Marked ready to verify')],
  },
  {
    id: 't-return830', jobId: '830', title: 'Schedule the 830 Northwood return', type: 'Schedule', owner: 'ys', for: ['pm', 'owner'],
    state: 'now', due: 'This week', tone: 'neutral', where: 'Touch-ups · about a day',
    action: { label: 'Schedule', kind: 'assign' }, log: [L('Sep 15', 'ys', 'Touch-up list captured')],
  },
  {
    id: 't-designer-wilk', jobId: 'wilk', title: 'Set up the designer meeting for the master bath layout', type: 'Field', owner: 'ys', for: ['owner', 'pm', 'site'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'warn', where: 'Master bath', blocks: 'Master bath at Wilkinson',
    detail: 'The hall bath and laundry can start. The master bath floor and shower walls wait for the layout — the designer answers in about a week.',
    action: { label: 'Set the meeting', kind: 'meeting-wilk' },
    log: [L('Sep 23', 'system', 'Review for scheduling · master bath held for the designer')],
  },
  {
    id: 't-heights-mdrive', jobId: 'mdrive', step: 'mdrive:heights',  title: 'Check the wall heights at Mark Drive', type: 'Field', owner: 'yakov', for: ['owner', 'pm', 'site'],
    state: 'now', due: 'Wed', tone: 'info', where: 'Kitchen · primary bath', blocks: 'Wall tile at Mark Drive',
    detail: 'Floors are released. The wall tile waits until the heights are measured on site — backsplash to the cabinets, shower to the ceiling or 84″.',
    action: { label: 'Record the heights', kind: 'heights-mdrive' },
    log: [L('Sep 25', 'system', 'Review for scheduling · walls held until heights are confirmed')],
  },
  {
    id: 't-fu-b7', jobId: 'b7', title: 'Pool house decision', type: 'Pricing', owner: 'ys', for: ['owner'],
    state: 'waiting', waitingOn: 'Client', followUp: 'Fri', tone: 'neutral', where: 'Revision 1 · $41,200',
    detail: 'Called Sep 23 — still reviewing with the designer.',
    action: { label: 'Record follow-up', kind: 'followup' },
    log: [L('Sep 11', 'office', 'Revision 1 sent'), L('Sep 16', 'ys', 'Emailed — no answer'), L('Sep 23', 'ys', 'Called — still reviewing')],
  },

  /* ---- back office ---- */
  {
    id: 't-qty114', jobId: '114', step: '114:order',  title: 'Wall tile 60 SF short of our takeoff', type: 'Materials', owner: 'office', for: ['office'], watch: ['materials', 'owner', 'pm'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'bad', blocks: 'Master bath walls', where: 'Master Bath · walls · T-04',
    detail: 'Best Tile ordered 500 SF. Our takeoff with 12% waste needs 560 SF.',
    action: { label: 'Settle it', kind: 'qty114' },
    log: [L('Sep 25', 'office', 'Tile store paperwork entered'), L('Sep 25', 'system', 'Quantity check failed · 60 SF short')],
  },
  {
    id: 't-est-b2', jobId: 'b2', title: 'Start the takeoff', type: 'Pricing', owner: 'office', for: ['office'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'info', where: 'Request · all documents in',
    action: { label: 'Open estimate', kind: 'estimate:E-1047' }, log: [L('Sep 28', 'office', 'Request logged · all documents in')],
  },
  {
    id: 't-fu-b5', jobId: 'b5', title: 'Follow up on Clyde St retail · Revision 4', type: 'Pricing', owner: 'office', for: ['office'], watch: ['owner'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'warn', where: 'Revision 4 · $86,400',
    detail: 'Sent Sep 18. Called Sep 21 — still reviewing. Emailed Sep 25 — no answer.',
    action: { label: 'Record follow-up', kind: 'followup' },
    log: [L('Sep 18', 'office', 'Revision 4 sent'), L('Sep 21', 'office', 'Called — still reviewing'), L('Sep 25', 'office', 'Emailed — no answer')],
  },
  {
    id: 't-spec-b1', jobId: 'b1', title: 'Spec book from the GC', type: 'Pricing', owner: 'office', for: ['office'],
    state: 'waiting', waitingOn: 'GC', followUp: 'Thu', tone: 'warn', blocks: 'Finishing the estimate', where: 'Documents',
    log: [L('Sep 26', 'office', 'Requested spec book and finish schedule')],
  },
  {
    id: 't-custpo114', jobId: '114', title: 'Get the client’s PO from the GC', type: 'Setup', owner: 'office', for: ['office'], watch: ['accounting'],
    state: 'waiting', waitingOn: 'GC', followUp: 'Wed', tone: 'warn', where: 'Contract',
    detail: 'The client sends their PO before the first bill — company rule. Follow up until it comes; when it does, file it with the project’s billing. That closes this, and billing can start.',
    action: { label: 'The PO came — file it', kind: 'money:custpo114' },
    log: [L('Sep 21', 'system', 'Created at award — the GC gives a PO'), L('Sep 21', 'office', 'Requested from the GC')],
  },

  /* ---- Green Tree: a job the way the office sees one mid-week — the design walk to confirm, tile that came broken,
   * wrong and short, the setting materials on the way (the water isn't on yet — that's the site check) ---- */
  {
    id: 't-green-decided', jobId: 'green', title: 'Confirm what was decided at the design walkthrough', type: 'Setup', owner: 'office', for: ['office'], watch: ['owner'],
    state: 'now', due: 'Today', tone: 'warn', where: 'Design walkthrough · Sep 29',
    detail: 'Grout warm gray everywhere · lobby feature wall centered on the doors · niches move 6″ left. Send it to the designer and the GC.',
    log: [L('Sep 29', 'ys', 'Walked it with the designer')],
  },
  {
    id: 't-green-broken', jobId: 'green', title: 'T-05: 3 boxes came broken', type: 'Materials', owner: 'office', for: ['office'], watch: ['owner'],
    state: 'waiting', waitingOn: 'Best Tile', followUp: 'Tue', tone: 'bad', where: 'T-05 · Bianco',
    detail: 'Cracked in one corner of the pallet — the driver saw it. Best Tile is sending 3 boxes.',
    log: [L('Sep 30', 'yakov', 'Logged as a problem'), L('Sep 30', 'office', 'Asked Best Tile for 3 boxes')],
  },
  {
    id: 't-green-wrong', jobId: 'green', title: 'T-07: 4 boxes came wrong', type: 'Materials', owner: 'office', for: ['office'], watch: ['owner'],
    state: 'now', due: 'Today', tone: 'bad', where: 'T-07 · Calacatta',
    detail: 'Honed came instead of polished — send them back and get the right ones.',
    log: [L('Sep 30', 'yakov', 'Logged as a problem')],
  },
  {
    id: 't-green-short', jobId: 'green', title: 'T-04: 6 boxes missing', type: 'Materials', owner: 'office', for: ['office'], watch: ['owner'],
    state: 'waiting', waitingOn: 'Best Tile', followUp: 'Thu', tone: 'bad', where: 'T-04 · White subway',
    detail: '54 of 60 boxes came. The store says the rest comes Thursday.',
    log: [L('Sep 30', 'yakov', 'Logged as a problem'), L('Oct 1', 'office', 'Best Tile: the rest comes Thursday')],
  },
  {
    id: 't-green-mat', jobId: 'green', title: 'Setting materials delivered', type: 'Materials', owner: 'yakov', for: ['site'], watch: ['owner'],
    state: 'waiting', waitingOn: 'Infinity', followUp: 'Mon', tone: 'info', where: 'Thinset, grout, membrane',
    detail: 'Ordered Sep 30 — Infinity delivers Monday.',
    log: [L('Sep 30', 'yakov', 'Ordered from Infinity')],
  },

  /* ---- estimator ---- */
  {
    id: 't-est-b3', jobId: 'b3', title: 'Do the takeoff', type: 'Pricing', owner: 'takeoff', for: ['takeoff'], watch: ['owner'],
    state: 'now', due: 'Thu', dueTone: 'warn', tone: 'warn', where: 'Takeoff 60%',
    detail: '12 unit baths and the lobby. Unit baths 9–12 and the lobby feature wall still to measure.',
    action: { label: 'Open estimate', kind: 'estimate:E-1044' }, log: [L('Sep 16', 'office', 'Takeoff started')],
  },
  {
    id: 't-r2-b6', jobId: 'b6', title: 'Final review · Revision 2', type: 'Pricing', owner: 'ys', for: ['owner'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'info', where: 'Basement bath removed · office review done',
    detail: 'The office checked it — 1 note, fixed. Approve and it goes to the client.', action: { label: 'Review', kind: 'estimate:E-1040' },
    log: [L('Sep 22', 'ys', 'Revision requested: remove the basement bath'), L('Sep 28', 'estimator', 'Office review done — to Yaakov')],
  },
  {
    id: 't-rev-b8', jobId: 'b8', title: 'Review the takeoff', type: 'Pricing', owner: 'estimator', for: ['estimator'],
    state: 'now', due: 'Tomorrow', tone: 'info', where: 'Office review · ready from Takeoff',
    action: { label: 'Review', kind: 'estimate:E-1048' }, log: [L('Sep 28', 'takeoff', 'Ready for review')],
  },
  {
    id: 't-takeoff-b4', jobId: 'b4', title: 'Do the takeoff', type: 'Pricing', owner: 'takeoff', for: ['takeoff'],
    state: 'now', due: 'Oct 5', tone: 'neutral', where: 'Finish schedule still missing', action: { label: 'Open estimate', kind: 'estimate:E-1045' }, log: [],
  },
  {
    id: 't-q-b3', jobId: 'b3', title: 'Same tile as Phase 1?', type: 'Pricing', owner: 'takeoff', for: ['takeoff'],
    state: 'waiting', waitingOn: 'Designer', followUp: 'Thu', tone: 'warn', blocks: 'Finishing the estimate', where: 'Question',
    detail: 'It changes the tile allowance.', log: [L('Sep 24', 'takeoff', 'Asked the designer')],
  },

  /* ---- materials ---- */
  {
    id: 't-prep530', jobId: '530', step: '530:materials',  title: 'Order Portland cement and sand', type: 'Materials', owner: 'materials', for: ['materials'], watch: ['owner', 'pm'],
    state: 'now', due: 'Today', dueTone: 'bad', tone: 'bad', blocks: 'Floors at 530 Mark', where: 'Floor prep',
    detail: '12 bags of Portland cement and 30 bags of sand. The start is planned for Oct 5 — walls can start without it, floors cannot.',
    action: { label: 'Create PO', kind: 'po530' }, log: [L('Sep 22', 'system', 'Created by review for scheduling')],
  },
  {
    id: 't-jolly', jobId: '119', title: 'Receive 2 brass JOLLY profiles', type: 'Materials', owner: 'materials', for: ['materials', 'site'],
    state: 'now', due: 'Tomorrow', tone: 'info', blocks: 'Girls bath outside corners', where: 'PO-1041 · Metal Works Inc.',
    action: { label: 'Receive', kind: 'receive-jolly' }, log: [L('Sep 25', 'materials', 'Received 4 of 6'), L('Sep 28', 'materials', 'Metal Works: ships tomorrow')],
  },
  {
    id: 't-po1045', jobId: '114', step: '114:matin',  title: 'PO-1045 · waiting for Infinity to confirm', type: 'Materials', owner: 'materials', for: ['materials'],
    state: 'waiting', waitingOn: 'Infinity', followUp: 'Tomorrow', tone: 'warn', where: 'Setting materials',
    detail: 'Membrane, LFT thinset and grout for 114 Park Place. Sent Sep 26.',
    action: { label: 'Mark confirmed', kind: 'po-confirm' }, log: [L('Sep 26', 'materials', 'PO-1045 sent to Infinity')],
  },
  {
    id: 't-trim118', jobId: '118', title: 'Metal trim ETA · PO-1042', type: 'Materials', owner: 'materials', for: ['materials'], watch: ['pm'],
    state: 'waiting', waitingOn: 'Metal Works Inc.', followUp: 'Today', tone: 'bad', blocks: 'Edges in 3 rooms', where: 'Satin nickel 1/4″ × 40',
    detail: 'Confirmed for Sep 21. Seven days late. Leo keeps working on the field tile.',
    action: { label: 'Record update', kind: 'follow' }, log: [L('Sep 14', 'materials', 'PO-1042 confirmed · ETA Sep 21'), L('Sep 23', 'materials', 'Called — “end of the week”')],
  },
  {
    id: 't-tile24c', jobId: '24c', title: '12 boxes of basement wall tile', type: 'Materials', owner: 'materials', for: ['materials'], watch: ['pm'],
    state: 'waiting', waitingOn: 'Best Tile', followUp: 'Fri', tone: 'warn', blocks: 'Basement bath walls', where: 'T-06 Pearl 3 × 12',
    detail: '18 of 30 boxes received. The store supplies it, but the crew cannot finish without it.', action: { label: 'It came in', kind: 'short:SH-1' },
    log: [L('Sep 2', 'materials', 'Received 18 of 30'), L('Sep 24', 'materials', 'Store: “next Friday”')],
  },

  /* ---- accounting ---- */
  {
    id: 't-dep114', jobId: '114', step: '114:deposit',  title: 'Send the 114 Park Place deposit invoice', type: 'Money', owner: 'accounting', for: ['accounting'], watch: ['owner'],
    state: 'now', due: '7 days late', dueTone: 'bad', tone: 'bad', blocks: 'Crew start (warning)', where: 'Deposit 20% · $25,360',
    detail: 'Created at award on Sep 21. Company rule: warn before the crew starts until it is received.',
    action: { label: 'Create invoice', kind: 'money:dep114' }, log: [L('Sep 21', 'system', 'Created at award'), L('Sep 24', 'system', 'Reminder — not invoiced yet')],
  },
  {
    id: 't-dep115', jobId: '115', step: '115:deposit',  title: 'Send the 115 Park deposit invoice', type: 'Money', owner: 'accounting', for: ['accounting'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'warn', where: 'Deposit 20% · $17,680',
    action: { label: 'Create invoice', kind: 'money:dep115' }, log: [L('Sep 23', 'system', 'Created at award')],
  },
  {
    id: 't-finmill', jobId: 'mill', title: 'Send the Millennium final invoice', type: 'Money', owner: 'accounting', for: ['accounting'], watch: ['owner'],
    state: 'now', due: 'Today', dueTone: 'warn', tone: 'warn', where: 'Final 10% + retainage',
    detail: 'Punch verified Sep 25. Closeout checks passed.', action: { label: 'Create invoice', kind: 'money:finmill' },
    log: [L('Sep 25', 'system', 'Final billing ready — created by closeout')],
  },
  {
    id: 't-co118', jobId: '118', title: 'Bill CO-001 · kitchen backsplash return', type: 'Money', owner: 'accounting', for: ['accounting'],
    state: 'now', due: 'This week', tone: 'info', where: '$1,280 · approved Sep 24',
    action: { label: 'Add to next bill', kind: 'money:co118' }, log: [L('Sep 24', 'ys', 'Approved by the owner’s rep (email attached)')],
  },
  {
    id: 't-dep530', jobId: '530', step: '530:deposit',  title: '530 Mark deposit · invoice #1038', type: 'Money', owner: 'accounting', for: ['accounting'], watch: ['pm'],
    state: 'waiting', waitingOn: 'Client', followUp: 'Today', tone: 'warn', where: 'Deposit · $10,860',
    detail: 'Invoiced Sep 15 — 13 days. An automatic reminder goes out today.', action: { label: 'Record payment', kind: 'money:dep530' },
    log: [L('Sep 15', 'accounting', 'Invoice #1038 sent from QuickBooks'), L('Sep 22', 'system', 'Reminder sent to the client')],
  },
  {
    id: 't-depwilk', jobId: 'wilk', step: 'wilk:deposit',  title: 'Wilkinson deposit · $6,380 outstanding', type: 'Money', owner: 'accounting', for: ['accounting'],
    state: 'waiting', waitingOn: 'Client', followUp: 'Fri', tone: 'warn', where: 'Partly paid',
    log: [L('Sep 16', 'accounting', 'Invoice #1033 sent'), L('Sep 22', 'accounting', '$6,000 received')],
  },

  /* ---- done today ---- */
  { id: 'd1', jobId: 'b2', title: 'Logged the 115 Park lobby request', type: 'Pricing', owner: 'office', for: ['office'], state: 'done', doneAt: '9:12 AM', tone: 'ok', log: [] },
  { id: 'd2', jobId: '2385', title: 'Approved CO-002 · ballroom epoxy upgrade', type: 'Changes', owner: 'ys', for: ['owner', 'pm'], state: 'done', doneAt: '10:05 AM', tone: 'ok', log: [] },
  { id: 'd3', jobId: '119', title: 'Checked the brass profile ETA', type: 'Materials', owner: 'materials', for: ['materials'], state: 'done', doneAt: '10:40 AM', tone: 'ok', log: [] },
  { id: 'd4', jobId: '530', title: 'Released the kitchen and bath walls', type: 'Field', owner: 'ys', for: ['owner', 'pm', 'site'], state: 'done', doneAt: '11:30 AM', tone: 'ok', log: [] },
  { id: 'd5', jobId: '118', title: 'Reviewed Leo’s Saturday update', type: 'Field', owner: 'ys', for: ['owner', 'pm', 'site'], state: 'done', doneAt: '8:20 AM', tone: 'ok', log: [] },
]

/* ================= materials ================= */
export interface TileCheck {
  jobId: string; tag: string; where: string; unit: string
  measured: number; wastePct: number; ordered: number; received: number
  supplier: string; suppliedBy: string; eta?: string; note?: string
}
export const TILECHECKS: TileCheck[] = [
  { jobId: '119', tag: 'T-01', where: 'Master main floor · curb · foyer', unit: 'SF', measured: 380, wastePct: 10, ordered: 440, received: 440, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: '119', tag: 'T-02', where: 'Shower floors', unit: 'SF', measured: 78, wastePct: 15, ordered: 96, received: 96, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: '119', tag: 'T-03', where: 'Master shower and tub walls', unit: 'boxes', measured: 18, wastePct: 10, ordered: 20, received: 14, supplier: 'Best Tile', suppliedBy: 'GC', eta: 'Oct 2', note: 'Enough to start, not to finish' },
  { jobId: '119', tag: 'T-04', where: 'Guest shower · laundry walls', unit: 'SF', measured: 240, wastePct: 12, ordered: 280, received: 280, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: '119', tag: 'T-06', where: 'Girls and boys bath walls', unit: 'SF', measured: 285, wastePct: 12, ordered: 320, received: 320, supplier: 'Best Tile', suppliedBy: 'GC', note: 'If CO-004 is approved: +96 SF' },
  { jobId: '119', tag: 'T-07', where: 'Powder · kitchen · fireplace', unit: 'SF', measured: 195, wastePct: 12, ordered: 225, received: 225, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: '114', tag: 'T-04', where: 'Master bath walls · guest shower', unit: 'SF', measured: 500, wastePct: 12, ordered: 500, received: 0, supplier: 'Best Tile', suppliedBy: 'GC', eta: 'Oct 6' },
  { jobId: '114', tag: 'T-05', where: 'Floors', unit: 'SF', measured: 175, wastePct: 12, ordered: 200, received: 0, supplier: 'Best Tile', suppliedBy: 'GC', eta: 'Oct 6' },
  { jobId: '24c', tag: 'T-06', where: 'Basement bath walls', unit: 'boxes', measured: 27, wastePct: 10, ordered: 30, received: 18, supplier: 'Best Tile', suppliedBy: 'GC', eta: 'Fri', note: 'Was due Sep 2' },
  { jobId: '24c', tag: 'T-05', where: 'Basement bath floor', unit: 'boxes', measured: 20, wastePct: 10, ordered: 22, received: 15, supplier: 'Best Tile', suppliedBy: 'GC', eta: 'Fri' },
  { jobId: '2385', tag: 'T-01', where: 'Ballroom field', unit: 'pallets', measured: 7, wastePct: 10, ordered: 8, received: 6, supplier: 'Best Tile', suppliedBy: 'Owner', eta: 'Oct 5' },
  { jobId: '118', tag: 'T-07', where: 'Kitchen · baths · entry', unit: 'SF', measured: 610, wastePct: 10, ordered: 680, received: 680, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: '530', tag: 'T-04', where: 'Kitchen and bath walls', unit: 'SF', measured: 220, wastePct: 12, ordered: 250, received: 250, supplier: 'Best Tile', suppliedBy: 'Owner' },
  { jobId: '530', tag: 'T-05', where: 'Floors', unit: 'SF', measured: 410, wastePct: 10, ordered: 460, received: 460, supplier: 'Best Tile', suppliedBy: 'Owner' },
  { jobId: 'green', tag: 'T-05', where: 'Lobby and unit floors', unit: 'SF', measured: 940, wastePct: 10, ordered: 1040, received: 1040, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: 'green', tag: 'T-04', where: 'Tub walls', unit: 'SF', measured: 520, wastePct: 12, ordered: 590, received: 590, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: 'mdrive', tag: 'T-05', where: 'Main floor · primary bath floor', unit: 'SF', measured: 310, wastePct: 10, ordered: 345, received: 345, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: 'wilk', tag: 'T-05', where: 'Hall bath · laundry floors', unit: 'SF', measured: 150, wastePct: 10, ordered: 165, received: 165, supplier: 'Best Tile', suppliedBy: 'GC' },
  { jobId: 'wilk', tag: 'T-04', where: 'Hall bath tub walls', unit: 'SF', measured: 110, wastePct: 12, ordered: 125, received: 125, supplier: 'Best Tile', suppliedBy: 'GC' },
]
export const needWithWaste = (t: TileCheck) => Math.ceil(t.measured * (1 + t.wastePct / 100))

export type MatStatus = 'suggested' | 'to-order' | 'sent' | 'confirmed' | 'partial' | 'delivered' | 'late'
export interface OurMat {
  id: string; jobId: string; name: string; qty: string; status: MatStatus; po?: string; eta?: string; where: string; kind: 'setting' | 'metal' | 'prep' | 'grout'
  /** what it covers, for the takeoff: one item and a count, or whole items, or whole rooms */
  itemId?: string; n?: number; items?: string[]; rooms?: string[] | 'all'
}
export const OURMATS: OurMat[] = [
  { id: 'om1', jobId: '119', name: 'LFT thinset', qty: '40 bags', status: 'delivered', po: 'PO-1036', where: 'All walls', kind: 'setting' },
  { id: 'om2', jobId: '119', name: 'Uncoupling membrane', qty: '4 rolls', status: 'delivered', po: 'PO-1036', where: 'Floors', kind: 'prep' },
  { id: 'om3', jobId: '119', name: 'Waterproofing membrane', qty: '6 pails', status: 'delivered', po: 'PO-1036', where: 'Showers', kind: 'prep' },
  { id: 'om4', jobId: '119', name: 'Grout · 4 colors', qty: '22 bags', status: 'delivered', po: 'PO-1036', where: 'All rooms', kind: 'grout' },
  { id: 'om5', jobId: '119', name: 'Schluter JOLLY · satin brass · 10 mm', qty: '6 × 8 ft', status: 'partial', po: 'PO-1041', eta: 'Tomorrow', where: 'Outside corners, edges', kind: 'metal' },
  { id: 'om19', jobId: '119', name: 'Floor prep and wall board', qty: 'Sand, Portland, leveler, liners, board', status: 'delivered', where: 'All rooms', kind: 'prep', items: ['m-sand', 'm-portland', 'm-slu', 'm-primer', 'm-liner', 'm-board', 'm-screws', 'm-tape', 'm-clips'], rooms: 'all' },
  { id: 'om20', jobId: '119', name: 'Schluter JOLLY · satin brass · 10 mm', qty: '8 × 8 ft', status: 'delivered', where: 'Shower, tub and powder edges', kind: 'metal', itemId: 'm-jolly', n: 8 },
  { id: 'om6', jobId: '114', name: 'Setting materials · membrane, LFT thinset, grout', qty: '3 lines', status: 'sent', po: 'PO-1045', where: 'Both baths', kind: 'setting' },
  { id: 'om7', jobId: '530', name: 'Portland cement', qty: '12 bags', status: 'to-order', where: 'Floor prep', kind: 'prep' },
  { id: 'om8', jobId: '530', name: 'Sand', qty: '30 bags', status: 'to-order', where: 'Floor prep', kind: 'prep' },
  { id: 'om9', jobId: '530', name: 'LFT thinset', qty: '20 bags', status: 'delivered', where: 'Walls', kind: 'setting', itemId: 'm-thinset', n: 20 },
  { id: 'om18', jobId: '530', name: 'Wall board, waterproofing and clips', qty: 'Bath walls', status: 'delivered', where: 'Bath walls', kind: 'prep', items: ['m-board', 'm-screws', 'm-tape', 'm-wp', 'm-clips'], rooms: 'all' },
  { id: 'om10', jobId: '828', name: 'Versabond-LFT thinset', qty: '24 bags', status: 'late', po: 'PO-1039', eta: 'Was Sep 5', where: 'Lobby repairs, landing', kind: 'setting' },
  { id: 'om11', jobId: '118', name: 'Metal trim · satin nickel · 1/4″', qty: '40 pieces', status: 'late', po: 'PO-1042', eta: 'Was Sep 21', where: 'Edges in 3 rooms', kind: 'metal' },
  { id: 'om12', jobId: '118', name: 'LFT thinset', qty: '30 bags', status: 'delivered', where: 'All rooms', kind: 'setting', itemId: 'm-thinset', n: 30 },
  { id: 'om21', jobId: '118', name: 'Board, waterproofing and grout', qty: 'All rooms', status: 'delivered', where: 'All rooms', kind: 'prep', items: ['m-board', 'm-screws', 'm-tape', 'm-wp', 'm-grout', 'm-sand', 'm-portland', 'm-clips', 'm-liner', 'm-slu', 'm-primer'], rooms: 'all' },
  { id: 'om13', jobId: 'green', name: 'Setting materials', qty: 'All lines', status: 'delivered', where: 'Whole project', kind: 'setting', rooms: 'all' },
  { id: 'om14', jobId: '2385', name: 'Epoxy grout', qty: '14 units', status: 'delivered', where: 'Ballroom', kind: 'grout', rooms: 'all' },
  { id: 'om15', jobId: '24c', name: 'Setting materials', qty: 'All lines', status: 'delivered', where: 'Whole project', kind: 'setting', rooms: 'all' },
  { id: 'om16', jobId: 'mdrive', name: 'Setting materials', qty: 'Floors', status: 'delivered', where: 'Main floor · primary bath', kind: 'setting', rooms: ['Main floor', 'Primary bath'] },
  { id: 'om17', jobId: 'wilk', name: 'Setting materials', qty: 'Hall bath · laundry', status: 'delivered', where: 'Hall bath · laundry', kind: 'setting', rooms: ['Hall bath', 'Laundry'] },
]

/* ================= purchase orders (money out) ================= */
export const PO_STEPS = ['Draft', 'Sent', 'Confirmed', 'Delivered', 'Bill in', 'Paid']
export interface POLine { item: string; qty: string; itemId?: string; n?: number; price?: number }
export interface PO { id: string; jobId: string; supplier: string; what: string; lines: POLine[]; amount: number; step: number; late?: boolean; eta?: string; note: string; log: LogLine[]; date?: string }
export const POS0: PO[] = [
  { id: 'PO-1045', jobId: '114', supplier: 'Infinity', what: 'Setting materials', amount: 1374, step: 1, date: 'Sep 26', eta: 'Asked for Oct 5', note: 'Sent Sep 26 · waiting for Infinity to confirm', lines: [{ item: 'Uncoupling membrane', qty: '2 rolls', itemId: 'm-membrane', n: 2, price: 315 }, { item: 'LFT thinset', qty: '16 bags', itemId: 'm-thinset', n: 16, price: 38 }, { item: 'Grout · Silverado', qty: '4 bags', itemId: 'm-grout', n: 4, price: 34 }], log: [L('Sep 26', 'materials', 'Sent to Infinity')] },
  { id: 'PO-1041', jobId: '119', supplier: 'Metal Works Inc.', what: 'JOLLY satin brass 10 mm', amount: 684, step: 2, date: 'Sep 9', eta: 'Tomorrow', note: '4 of 6 received · 2 ship tomorrow', lines: [{ item: 'Schluter JOLLY · satin brass · 10 mm · 8 ft', qty: '6', itemId: 'm-jolly', n: 6, price: 114 }], log: [L('Sep 9', 'materials', 'Sent'), L('Sep 10', 'materials', 'Confirmed'), L('Sep 25', 'materials', 'Received 4 of 6')] },
  { id: 'PO-1042', jobId: '118', supplier: 'Metal Works Inc.', what: 'Satin nickel trim 1/4″', amount: 1560, step: 2, late: true, date: 'Sep 13', eta: 'Was Sep 21', note: 'Confirmed for Sep 21 · 7 days late', lines: [{ item: 'Metal trim · satin nickel · 1/4″ · 8 ft', qty: '40', itemId: 'm-trim', n: 40, price: 39 }], log: [L('Sep 13', 'materials', 'Sent'), L('Sep 14', 'materials', 'Confirmed · ETA Sep 21'), L('Sep 23', 'materials', 'Called — “end of the week”')] },
  { id: 'PO-1039', jobId: '828', supplier: 'Infinity', what: 'Versabond-LFT thinset', amount: 912, step: 2, late: true, date: 'Aug 25', eta: 'Was Sep 5', note: 'Confirmed for Sep 5 · 23 days late', lines: [{ item: 'Versabond-LFT · 50 lb', qty: '24 bags', itemId: 'm-versa', n: 24, price: 38 }], log: [L('Aug 25', 'materials', 'Sent'), L('Aug 26', 'materials', 'Confirmed · ETA Sep 5'), L('Sep 8', 'materials', 'Called — “next week”')] },
  { id: 'PO-1036', jobId: '119', supplier: 'Infinity', what: 'Setting materials', amount: 4536, step: 4, date: 'Sep 5', note: 'Delivered Sep 12 · bill received Sep 20', lines: [{ item: 'LFT thinset', qty: '40 bags', itemId: 'm-thinset', n: 40, price: 37 }, { item: 'Uncoupling membrane', qty: '4 rolls', itemId: 'm-membrane', n: 4, price: 310 }, { item: 'Waterproofing', qty: '6 pails', itemId: 'm-wp', n: 6, price: 178 }, { item: 'Grout · 4 colors', qty: '22 bags', itemId: 'm-grout', n: 22, price: 34 }], log: [L('Sep 5', 'materials', 'Sent'), L('Sep 12', 'materials', 'Delivered'), L('Sep 20', 'accounting', 'Supplier bill received')] },
]

/* ================= money in ================= */
export type MoneyKind = 'deposit' | 'progress' | 'change' | 'final' | 'retainage' | 'custpo'
export const MONEY_STEPS: Record<MoneyKind, string[]> = {
  deposit: ['Required', 'Invoiced', 'Paid'],
  progress: ['Draft', 'PM review', 'Sent', 'Approved', 'Paid'],
  change: ['Approved', 'Billed', 'Paid'],
  final: ['Ready', 'Invoiced', 'Paid'],
  retainage: ['Held', 'Requested', 'Paid'],
  custpo: ['Requested', 'Received'],
}
export const MONEY_KIND_LABEL: Record<MoneyKind, string> = {
  deposit: 'Deposit', progress: 'Progress bill', change: 'Change order', final: 'Final bill', retainage: 'Retainage', custpo: 'Client PO',
}
export type MoneyState = 'todo' | 'waiting' | 'upcoming' | 'paid'
export interface ChangeMeta {
  room: string; surface: string; label: string; from: string; to: string
  sfDelta: number; tileTag: string; tileSF: number; ipoQty: string; ipoAmount: number
  doTile: boolean; doIPO: boolean; by: string; sent?: boolean; estimate?: number
  /** decided at the design meeting (confirming the scope), not asked on site */
  meeting?: boolean
}
export interface MoneyItem {
  id: string; jobId: string; kind: MoneyKind; title: string; amount: number | null
  step: number; state: MoneyState; due?: string; dueTone?: Tone; ref?: string; paid?: number
  note: string; log: LogLine[]; action?: string; date?: string
  /** a change order asked on site: what it touches */
  meta?: ChangeMeta
  /** a progress bill: the week it bills (its Monday) */
  week?: string
  /** a progress bill made from the week's daily updates: how it adds up */
  bill?: BillBreakdown
}
/** how a progress bill adds up — kept on the bill, so it reads the same later */
export interface BillBreakdown {
  /** the week's Monday, its label ("Oct 5 – 10") and the last day it counts ("Oct 10") */
  week: string; label: string; through: string
  contract: number
  /** installed to date at the end of the week, and what share of the contract that is */
  installed: number; pct: number
  /** retainage held on the installed work, to date */
  retainagePct: number; held: number
  /** how the deposit comes off: counted as billed ('first'), a share of each bill ('share') or at the end ('final') — and the share to date */
  depositWay: 'first' | 'share' | 'final'; credit: number
  /** billed before this bill (contract work, after retainage) */
  before: number
  /** this bill's progress amount */
  progress: number
  /** installed that week, room by room (before retainage) */
  weekAmount: number
  rooms: { room: string; amount: number }[]
  /** approved change orders billed with it */
  cos: { id: string; title: string; amount: number }[]
}
export const MONEY0: MoneyItem[] = [
  { id: 'dep114', jobId: '114', kind: 'deposit', title: 'Deposit 20%', amount: 25360, step: 0, state: 'todo', due: '7 days since award', dueTone: 'bad', note: 'Awarded Sep 21. Company rule: warn before the crew starts until it is received.', log: [L('Sep 21', 'system', 'Deposit required — created at award'), L('Sep 24', 'system', 'Reminder: not invoiced yet')], action: 'Create invoice' },
  { id: 'dep115', jobId: '115', kind: 'deposit', title: 'Deposit 20%', amount: 17680, step: 0, state: 'todo', due: '5 days since award', dueTone: 'warn', note: 'Awarded Sep 23.', log: [L('Sep 23', 'system', 'Deposit required — created at award')], action: 'Create invoice' },
  { id: 'finmill', jobId: 'mill', kind: 'final', title: 'Final bill · last 10%', amount: 6420, step: 0, state: 'todo', due: 'Ready since Sep 25', dueTone: 'warn', note: 'Punch verified Sep 25 and the closeout checks passed.', log: [L('Sep 25', 'system', 'Final billing ready — created by closeout')], action: 'Create invoice' },
  { id: 'retmill', jobId: 'mill', kind: 'retainage', title: 'Retainage release', amount: 5778, step: 0, state: 'todo', due: 'With the final bill', note: '10% held on every progress bill. Their terms: released 30 days after the final invoice.', log: [L('Sep 25', 'system', 'Retainage release ready')], action: 'Request release' },
  { id: 'co118', jobId: '118', kind: 'change', title: 'CO-001 · kitchen backsplash return', amount: 1280, step: 0, state: 'todo', due: 'Approved Sep 24', note: 'Approved in writing by the owner’s rep. Bills with the next progress bill.', log: [L('Sep 22', 'ys', 'Requested on site'), L('Sep 23', 'estimator', 'Priced'), L('Sep 24', 'ys', 'Approved by the owner’s rep')], action: 'Add to next bill' },
  { id: 'co2385', jobId: '2385', kind: 'change', title: 'CO-002 · ballroom epoxy upgrade', amount: 3900, step: 0, state: 'todo', due: 'Approved today', note: 'Bills with the final bill.', log: [L('Sep 26', 'estimator', 'Priced'), L('Sep 28', 'ys', 'Approved')], action: 'Add to final bill' },
  { id: 'dep530', jobId: '530', kind: 'deposit', title: 'Deposit 20%', amount: 10860, step: 1, state: 'waiting', ref: '#1038', due: '13 days', dueTone: 'warn', note: 'Invoiced Sep 15. Automatic reminder goes out today.', log: [L('Sep 8', 'system', 'Deposit required — created at award'), L('Sep 15', 'accounting', 'Invoice #1038 sent from QuickBooks'), L('Sep 22', 'system', 'Reminder sent to the client')], action: 'Record payment' },
  { id: 'depwilk', jobId: 'wilk', kind: 'deposit', title: 'Deposit 20% · partly paid', amount: 12380, paid: 6000, step: 1, state: 'waiting', ref: '#1033', due: '$6,380 open', dueTone: 'warn', note: '$6,000 received Sep 22. Follow up Friday for the rest.', log: [L('Sep 16', 'accounting', 'Invoice #1033 sent'), L('Sep 22', 'accounting', '$6,000 received')], action: 'Record payment' },
  { id: 'req119', jobId: '119', kind: 'progress', title: 'Progress bill #1 · through Sep 19', amount: 27690, step: 3, state: 'waiting', ref: '#1047', due: 'Due Oct 25', note: 'GC approved Sep 27. 10% retainage held.', log: [L('Sep 21', 'ys', 'PM checked the progress'), L('Sep 22', 'accounting', 'Invoice #1047 sent'), L('Sep 27', 'system', 'GC approved the pay application')], action: 'Record payment' },
  { id: 'req118', jobId: '118', kind: 'progress', title: 'Progress bill #1 · through Sep 19', amount: 14000, step: 2, state: 'waiting', ref: '#1046', due: 'With the GC', note: 'Sent Sep 22. Waiting for the owner’s rep to approve.', log: [L('Sep 22', 'accounting', 'Invoice #1046 sent')], action: 'Record approval' },
  { id: 'req24c', jobId: '24c', kind: 'progress', title: 'Progress bill #3', amount: 8835, step: 3, state: 'waiting', ref: '#1041', due: 'Due Oct 1', dueTone: 'warn', note: 'Approved Sep 8.', log: [L('Sep 1', 'accounting', 'Invoice #1041 sent'), L('Sep 8', 'system', 'Approved')], action: 'Record payment' },
  { id: 'custpo114', jobId: '114', kind: 'custpo', title: 'Client PO / subcontract', amount: null, step: 0, state: 'waiting', due: 'Requested Sep 21', note: 'Company rule: their PO before the first bill.', log: [L('Sep 21', 'office', 'Requested from the GC')], action: 'Mark received' },
  { id: 'co119', jobId: '119', kind: 'change', title: 'CO-004 · boys bath full height', amount: 6850, step: -1, state: 'upcoming', due: 'Waiting on GC approval', note: 'Not billable until approved. Billing opens by itself the moment approval is recorded.', log: [L('Sep 24', 'ys', 'Sent to the GC')] },
  { id: 'fin828', jobId: '828', kind: 'final', title: 'Final bill', amount: 21300, step: -1, state: 'upcoming', due: 'After punch', note: 'Opens when punch is verified and closeout passes.', log: [] },
  { id: 'fin2385', jobId: '2385', kind: 'final', title: 'Final bill', amount: 42500, step: -1, state: 'upcoming', due: 'After punch', note: 'Opens when punch is verified and closeout passes.', log: [] },
  { id: 'fin24c', jobId: '24c', kind: 'final', title: 'Final bill', amount: 14725, step: -1, state: 'upcoming', due: 'After punch', note: 'Opens when punch is verified and closeout passes.', log: [] },
  { id: 'paid119', jobId: '119', kind: 'deposit', title: 'Deposit 20%', amount: 36920, step: 2, state: 'paid', ref: '#1021', date: 'Sep 4', note: '', log: [L('Aug 31', 'system', 'Created at award'), L('Sep 1', 'accounting', 'Invoice #1021 sent'), L('Sep 4', 'accounting', 'Paid in full')] },
  { id: 'paid118', jobId: '118', kind: 'deposit', title: 'Deposit 20%', amount: 19260, step: 2, state: 'paid', ref: '#1019', date: 'Aug 24', note: '', log: [L('Aug 19', 'system', 'Created at award'), L('Aug 20', 'accounting', 'Invoice #1019 sent'), L('Aug 24', 'accounting', 'Paid in full')] },
  { id: 'paidgreen', jobId: 'green', kind: 'deposit', title: 'Deposit 20%', amount: 23600, step: 2, state: 'paid', ref: '#1024', date: 'Sep 10', note: '', log: [] },
  { id: 'paidmd', jobId: 'mdrive', kind: 'deposit', title: 'Deposit 20%', amount: 9500, step: 2, state: 'paid', ref: '#1029', date: 'Sep 17', note: '', log: [] },
  { id: 'paid2385', jobId: '2385', kind: 'progress', title: 'Progress bill #4', amount: 21250, step: 4, state: 'paid', ref: '#1043', date: 'Sep 24', note: '', log: [] },
  { id: 'paid828', jobId: '828', kind: 'progress', title: 'Progress bill #3', amount: 14200, step: 4, state: 'paid', ref: '#1040', date: 'Sep 22', note: '', log: [] },
]

/* per-job billing picture (sample numbers) */
export interface Billing { contract: number; changes: number; pending: number; billedPct: number; paidPct: number; installedPct: number; retainage: number; depositPct: number }
export const BILLING: Record<string, Billing> = {
  '119': { contract: 184600, changes: 2450, pending: 6850, billedPct: 35, paidPct: 20, installedPct: 47, retainage: 2769, depositPct: 20 },
  '118': { contract: 96300, changes: 1280, pending: 0, billedPct: 34, paidPct: 20, installedPct: 48, retainage: 1400, depositPct: 20 },
  '114': { contract: 126800, changes: 0, pending: 0, billedPct: 0, paidPct: 0, installedPct: 0, retainage: 0, depositPct: 20 },
  '115': { contract: 88400, changes: 0, pending: 0, billedPct: 0, paidPct: 0, installedPct: 0, retainage: 0, depositPct: 20 },
  '530': { contract: 54300, changes: 0, pending: 0, billedPct: 20, paidPct: 0, installedPct: 0, retainage: 0, depositPct: 20 },
  green: { contract: 118000, changes: 0, pending: 0, billedPct: 20, paidPct: 20, installedPct: 0, retainage: 0, depositPct: 20 },
  mdrive: { contract: 47500, changes: 0, pending: 0, billedPct: 20, paidPct: 20, installedPct: 0, retainage: 0, depositPct: 20 },
  wilk: { contract: 61900, changes: 0, pending: 0, billedPct: 20, paidPct: 10, installedPct: 0, retainage: 0, depositPct: 20 },
  '828': { contract: 142000, changes: 0, pending: 0, billedPct: 85, paidPct: 80, installedPct: 92, retainage: 12070, depositPct: 20 },
  '2385': { contract: 212500, changes: 3900, pending: 0, billedPct: 80, paidPct: 80, installedPct: 88, retainage: 17000, depositPct: 20 },
  '24c': { contract: 58900, changes: 0, pending: 0, billedPct: 60, paidPct: 45, installedPct: 66, retainage: 3500, depositPct: 20 },
  '830': { contract: 73400, changes: 0, pending: 0, billedPct: 90, paidPct: 90, installedPct: 96, retainage: 6606, depositPct: 20 },
  fire: { contract: 38750, changes: 0, pending: 0, billedPct: 90, paidPct: 90, installedPct: 98, retainage: 3488, depositPct: 20 },
  mill: { contract: 64200, changes: 0, pending: 0, billedPct: 90, paidPct: 90, installedPct: 100, retainage: 5778, depositPct: 20 },
}

/* ================= schedule ================= */
export interface Booking { id: string; crew: string; jobId: string; start: string; end: string; label: string; workers?: number; status?: 'on' | 'hold' | 'pending' }
/* ISO dates; the visible weeks are Sep 21 – Oct 16 */
export const BOOKINGS0: Booking[] = [
  { id: 'bk1', crew: 'walter', jobId: '24c', start: '2026-09-21', end: '2026-10-01', label: 'Basement bath · punch', workers: 3, status: 'on' },
  { id: 'bk2', crew: 'leo', jobId: '118', start: '2026-09-08', end: '2026-10-16', label: 'Kitchen · hall bath', workers: 2, status: 'on' },
  { id: 'bk3', crew: 'alex', jobId: '2385', start: '2026-09-21', end: '2026-09-30', label: 'Ballroom epoxy · punch', workers: 3, status: 'on' },
  { id: 'bk4', crew: 'philip', jobId: '119', start: '2026-09-14', end: '2026-10-09', label: 'Guest bath walls · powder', workers: 4, status: 'on' },
]
export interface ReadyItem { jobId: string; kind: 'ready' | 'partial' | 'return' | 'hold'; label: string; days: number; workers: number; areas: string[]; warn?: string }
export const READY0: ReadyItem[] = [
  { jobId: 'green', kind: 'ready', label: 'Ready', days: 5, workers: 2, areas: ['Lobby', 'Unit 1A bath', 'Unit 1B bath'] },
  { jobId: '530', kind: 'partial', label: 'Start with restrictions', days: 4, workers: 2, areas: ['Kitchen walls', 'Bath walls'], warn: 'Floors wait on Portland and sand · deposit not paid' },
  { jobId: 'mdrive', kind: 'partial', label: 'Start with restrictions', days: 3, workers: 2, areas: ['Main floor', 'Primary bath floor'], warn: 'Wall tile not confirmed — floors only' },
  { jobId: 'wilk', kind: 'partial', label: 'Start with restrictions', days: 3, workers: 2, areas: ['Hall bath', 'Laundry'], warn: 'Master bath waits on the designer' },
  { jobId: '830', kind: 'return', label: 'Return visit', days: 1, workers: 1, areas: ['Touch-ups'] },
  { jobId: 'fire', kind: 'return', label: 'Return visit', days: 1, workers: 1, areas: ['Touch-ups'] },
  { jobId: '828', kind: 'hold', label: 'Return on hold', days: 2, workers: 2, areas: ['Lobby repairs', 'Landing'], warn: 'Waiting on the thinset' },
]

/* ================= punch ================= */
export type PunchStatus = 'open' | 'working' | 'verify' | 'verified'
export interface PunchItem { id: string; jobId: string; text: string; where: string; owner: PersonKey; status: PunchStatus; note?: string; taskId?: string; /** photos and videos of it (kept with the project's files) */ media?: string[] }
export const PUNCH0: PunchItem[] = [
  { id: 'pu1', jobId: '828', text: 'Lobby grout cleanup', where: 'Lobby · floor', owner: 'philip', status: 'verify', note: 'Before/after photos attached', taskId: 't-grout828' },
  { id: 'pu2', jobId: '828', text: 'Replace 2 cracked lobby tiles', where: 'Lobby · floor', owner: 'philip', status: 'open', note: 'Waiting on the thinset' },
  { id: 'pu3', jobId: '828', text: 'Reset 1 loose tile on the landing', where: 'Front entrance · landing', owner: 'philip', status: 'open', note: 'Waiting on the thinset' },
  { id: 'pu4', jobId: '2385', text: 'Ballroom epoxy grout', where: 'Ballroom · field tile', owner: 'alex', status: 'working', note: 'About two days left' },
  { id: 'pu5', jobId: '2385', text: 'Powder room caulk line', where: 'Powder rooms · walls', owner: 'alex', status: 'verified' },
  { id: 'pu6', jobId: '24c', text: 'Basement bath walls', where: 'Basement bath · walls', owner: 'walter', status: 'open', note: 'Waiting on 12 boxes from the store' },
  { id: 'pu7', jobId: '24c', text: 'Grout haze in the primary shower', where: 'Primary bath · shower', owner: 'walter', status: 'verified' },
  { id: 'pu8', jobId: '830', text: 'Lobby touch-ups (5 spots)', where: 'Lobby · floor', owner: 'ys', status: 'open', note: 'Return visit not booked' },
  { id: 'pu9', jobId: 'fire', text: 'Primary bath touch-ups', where: 'Primary bath', owner: 'ys', status: 'open', note: 'Return visit not booked' },
  { id: 'pu10', jobId: 'mill', text: 'Corridor grout repair', where: 'Corridors · floor', owner: 'ys', status: 'verified' },
]

/* ================= notifications ================= */
export interface Notice { id: string; jobId?: string; text: string; when: string; kind: 'material' | 'pricing' | 'money' | 'field' | 'change'; unread: boolean
  /** the exact thing it's about — the bill, the PO, the update — so the inbox opens that, not the whole project */
  open?: { t: string; [k: string]: any }
  /** only for these people (a request that got delivered goes to whoever asked) — everyone, when it's left out */
  for?: PersonKey[] }
export const NOTICES0: Notice[] = [
  { id: 'n1', jobId: '119', text: 'Metal Works Inc.: 2 JOLLY profiles ship tomorrow', when: '1h ago', kind: 'material', unread: true, open: { t: 'po', id: 'PO-1041' } },
  { id: 'n2', jobId: '2385', text: 'CO-002 approved · ballroom epoxy upgrade', when: '10:05 AM', kind: 'change', unread: true, open: { t: 'job', id: '2385', tab: 'money' } },
  { id: 'n3', jobId: 'b2', text: 'New price request · 115 Park lobby', when: '9:12 AM', kind: 'pricing', unread: true, open: { t: 'estimate', id: 'E-1047' } },
  { id: 'n4', jobId: '530', text: 'Automatic reminder sent · 530 Mark deposit #1038', when: '8:00 AM', kind: 'money', unread: false, open: { t: 'money', id: 'dep530' } },
  { id: 'n5', jobId: '119', text: 'GC approved progress bill #1 · 119 Park Place', when: 'Sun', kind: 'money', unread: false, open: { t: 'money', id: 'req119' } },
  { id: 'n6', jobId: '119', text: 'Philip sent Saturday’s update · guest bath walls 70%', when: 'Sat', kind: 'field', unread: false, open: { t: 'job', id: '119', tab: 'install' } },
]

/* ================= follow-up outcomes ================= */
export const OUTCOMES = [
  { key: 'reviewing', label: 'Still reviewing', hint: 'Spoke — no decision yet', tone: 'warn' as Tone, next: 'Fri' },
  { key: 'noanswer', label: 'No answer', hint: 'Left a message or no reply', tone: 'neutral' as Tone, next: 'Tomorrow' },
  { key: 'later', label: 'Call back later', hint: 'They gave a date', tone: 'neutral' as Tone, next: 'In 2 weeks' },
  { key: 'revision', label: 'Revision requested', hint: 'Scope or price to change', tone: 'info' as Tone, next: '' },
  { key: 'approved', label: 'Approved', hint: 'They said yes', tone: 'ok' as Tone, next: '' },
  { key: 'lost', label: 'Not proceeding', hint: 'Went elsewhere or cancelled', tone: 'bad' as Tone, next: '' },
]
