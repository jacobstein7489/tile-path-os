import type { Role, Stage } from './model'

export interface ProcStep {
  stage: Stage
  title: string
  happens: string
  who: { role: Role; buttons: string[]; note?: string }[]
  auto: string[]
  demo: { label: string; modal: any }
}

/* The whole company process — who presses what, and what the system does by itself. */
export const PROCESS: ProcStep[] = [
  {
    stage: 'request', title: 'A price request comes in',
    happens: 'A GC, developer, client or designer asks for a price. The office captures just enough to start — not a giant form.',
    who: [
      { role: 'office', buttons: ['New price request', 'Request missing info', 'Start the takeoff'], note: 'Missing documents become follow-ups with a date.' },
      { role: 'owner', buttons: ['Sees it in Estimates'] },
    ],
    auto: ['Missing documents turn into “waiting on GC” items that come back on their date', 'With the plans in, AI drafts the rooms, surfaces and square feet — and flags what it guessed'],
    demo: { label: 'Open 26 Cambridge St', modal: { t: 'job', id: 'b1' } },
  },
  {
    stage: 'estimating', title: 'Takeoff → office review → owner review',
    happens: 'The takeoff estimator works from the plans, the office estimator checks it, the owner gives it the last look. Notes are pinned to the room they’re about — not comments.',
    who: [
      { role: 'takeoff', buttons: ['Check off what AI flagged', 'Ready for review', 'Fixed — back to the reviewer'] },
      { role: 'estimator', buttons: ['Add a note', 'Send back', 'Looks good — to the owner'] },
      { role: 'owner', buttons: ['Send back', 'Approve and send to the client'] },
    ],
    auto: ['Whose turn it is lives on the estimate — nobody’s tasks change hands', 'Each hand-off lands on the next person’s Today; a send-back comes straight back to whoever sent it', 'It can’t move on with a note still open'],
    demo: { label: 'Open Green Tree Phase 2', modal: { t: 'job', id: 'b3' } },
  },
  {
    stage: 'proposal', title: 'Proposal',
    happens: 'The proposal goes out. Every revision is kept side by side — nothing is overwritten.',
    who: [
      { role: 'office', buttons: ['Send proposal'] },
      { role: 'estimator', buttons: ['Price revision'] },
    ],
    auto: ['Revision, amount, date and recipient are logged', 'The first follow-up date is set by itself'],
    demo: { label: 'Open Mark Drive model unit', modal: { t: 'job', id: 'b6' } },
  },
  {
    stage: 'followup', title: 'Follow-up',
    happens: 'One tap records how the call went. No more “followed up” comments in Asana.',
    who: [
      { role: 'office', buttons: ['Record follow-up'], note: 'Still reviewing · No answer · Call back later · Revision requested · Approved · Not proceeding' },
      { role: 'owner', buttons: ['Record follow-up'] },
    ],
    auto: ['It leaves Today until the next follow-up date, then comes back', '“Revision requested” opens the next revision for the estimator'],
    demo: { label: 'Open Forest Circle pool house', modal: { t: 'job', id: 'b7' } },
  },
  {
    stage: 'awarded', title: 'Award — one click, every department',
    happens: 'The biggest trigger in the company. Awarding tells every person what they now owe the project.',
    who: [{ role: 'owner', buttons: ['Make it a project'], note: 'Approved revision, deposit %, client PO, start window, PM' }],
    auto: ['Accounting: deposit invoice', 'Back office: setup package', 'Materials: tile order vs our takeoff, setting materials', 'Scheduling: heads-up with the start window', 'PM: review the setup'],
    demo: { label: 'Award the pool house', modal: { t: 'award', jobId: 'b7' } },
  },
  {
    stage: 'setup', title: 'Back office setup',
    happens: 'The office turns the paperwork into an organized project before anyone walks it.',
    who: [
      { role: 'office', buttons: ['Build rooms & surfaces', 'Add finish records', 'Enter tile paperwork', 'Set who supplies what', 'Send to site manager'] },
      { role: 'materials', buttons: ['Check tile quantities', 'Create PO'] },
      { role: 'accounting', buttons: ['Create deposit invoice', 'Record payment'] },
      { role: 'pm', buttons: ['Review setup'] },
    ],
    auto: ['Store quantity vs our takeoff + waste — a shortage becomes an action', 'Unpaid deposit stays visible as a warning with reminders'],
    demo: { label: 'Open 114 Park Place', modal: { t: 'job', id: '114' } },
  },
  {
    stage: 'verification', title: 'Site verification',
    happens: 'The site manager verifies reality. He confirms what the office built — he never re-enters it.',
    who: [
      { role: 'site', buttons: ['Start walkthrough', 'Confirm surface', 'Technical question', 'Record decision', 'Verification done'] },
      { role: 'pm', buttons: ['Design meeting decisions'] },
    ],
    auto: ['Unknowns attach to the exact surface and block only that surface', 'Answers become permanent installation directions'],
    demo: { label: 'Open 114 Park Place', modal: { t: 'job', id: '114', tab: 'rooms' } },
  },
  {
    stage: 'ready', title: 'Review for scheduling',
    happens: 'The company rules check whether the project can really start — before a crew is standing there.',
    who: [{ role: 'pm', buttons: ['Review for scheduling'] }],
    auto: ['Result: Ready · Start with restrictions · Not ready — with the reasons', 'Deposit, materials, decisions and site access checked'],
    demo: { label: 'Open 530 Mark', modal: { t: 'job', id: '530' } },
  },
  {
    stage: 'scheduled', title: 'Scheduled',
    happens: 'A crew is booked with dates and starting areas.',
    who: [
      { role: 'pm', buttons: ['Assign crew'] },
      { role: 'crew', buttons: ['Confirm the project'] },
    ],
    auto: ['Pre-start checks for the PM, site manager, materials and crew', 'The crew gets the installer package on his phone'],
    demo: { label: 'Assign a crew to Green Tree', modal: { t: 'assign', jobId: 'green' } },
  },
  {
    stage: 'installation', title: 'Installation',
    happens: 'Field and office stay in sync without anyone re-typing.',
    who: [
      { role: 'site', buttons: ['Daily update', 'Client wants a change', 'Report issue', 'Short or damaged'] },
      { role: 'crew', buttons: ['Daily update + photos', 'Extra work', 'Short on material', 'Problem / question'] },
      { role: 'pm', buttons: ['GC progress report', 'Record approval', 'Installer PO change'] },
      { role: 'estimator', buttons: ['Price the change', 'Send to the GC'] },
      { role: 'materials', buttons: ['Receive', 'Reorder'] },
      { role: 'accounting', buttons: ['Progress bill'], note: 'Pre-filled from the field progress' },
    ],
    auto: ['The daily update moves each wall and floor against the original plan, and files the photos in that room’s diary', 'A change asked on site starts the change order, the installer PO change and the tile in one click', 'The crew holds only that surface until it’s approved; an approved change reaches billing, the crew, the installer and the tile at once'],
    demo: { label: 'Open the 119 Park Place guest bath diary', modal: { t: 'job', id: '119', tab: 'rooms', room: 'Guest Bath', view: 'log' } },
  },
  {
    stage: 'punch', title: 'Punch and returns',
    happens: 'Touch-ups and return visits, tracked until verified.',
    who: [
      { role: 'site', buttons: ['Ready for punch', 'Add punch item', 'Verify'] },
      { role: 'crew', buttons: ['Ready to verify'] },
      { role: 'pm', buttons: ['Schedule return'] },
    ],
    auto: ['Required punch items block completion'],
    demo: { label: 'Open 828 Clyde', modal: { t: 'job', id: '828' } },
  },
  {
    stage: 'closeout', title: 'Closeout and final billing',
    happens: 'Closeout checks pass, and accounting gets the final bill — not a comment.',
    who: [
      { role: 'pm', buttons: ['Review for completion'] },
      { role: 'accounting', buttons: ['Send final invoice', 'Request retainage'] },
    ],
    auto: ['Final billing is created the moment closeout passes'],
    demo: { label: 'Open Millennium', modal: { t: 'job', id: 'mill' } },
  },
  {
    stage: 'complete', title: 'Complete',
    happens: 'The project closes. Its whole story stays searchable forever.',
    who: [
      { role: 'pm', buttons: ['Mark complete'] },
      { role: 'accounting', buttons: ['Record final payment'] },
    ],
    auto: ['Scope, revisions, tile, receipts, issues, changes, punch and billing kept in one history'],
    demo: { label: 'See a project’s history', modal: { t: 'job', id: '119', tab: 'history' } },
  },
]
