import * as React from 'react'
import { cn } from '@/tileos/lib/utils'
import { CenterPop } from '@/tileos/lib/pop'
import { useStore, homeOf, meOf, type Page } from '@/tileos/store'
import { ROLES, PEOPLE } from '@/tileos/data/model'
import { REAL, awayFromMe, backToMe, leaveSample } from '@/tileos/lib/save'
import { roleDef, seesUpcoming } from '@/tileos/data/model'
import { Sidebar, TopBar, BottomNav, CommandPalette, DesktopTopBar, AppBadge } from '@/tileos/components/shell/shell'
import { TipProvider } from '@/tileos/components/ui/overlay'
import { MyTasksPage, TaskModal, NewTaskModal, CrewReportModal } from '@/tileos/features/mytasks'
import { InboxPage } from '@/tileos/features/inbox'
import { EventModal } from '@/tileos/features/agenda'
import { ActivityModal } from '@/tileos/features/activity'
import { EstimatesPage, EstimateModal, AiPlansModal, EstSendModal, EstChangesModal, EstFollowModal, EstLostModal } from '@/tileos/features/estimates'
import { LostModal } from '@/tileos/features/projects'
import { DirectoryPage, SupplierFormModal, DesignerFormModal, InstallerFormModal } from '@/tileos/features/directory'
import { ItemsPage, ItemModal, ImportItemsModal, NewItemModal } from '@/tileos/features/items'
import { EmailModal } from '@/tileos/features/email'
import { SettingModal } from '@/tileos/features/setting'
import { ShortageModal, ReportShortModal } from '@/tileos/features/shortage'
import { MessagesModal } from '@/tileos/features/messages'
import { PortalView } from '@/tileos/features/portal'
import { NewClientModal } from '@/tileos/features/clientform'
import { BillingPage } from '@/tileos/features/billing'
import { ProjectsPage, NewRepairModal, NewProjectModal } from '@/tileos/features/projectlist'
import { NewPickerModal } from '@/tileos/features/newpicker'
import { FreshModal } from './features/testdata'
import { DeleteModal } from '@/tileos/features/cleanup-ui'
import { NewEstimateModal } from '@/tileos/features/estnew'
import { NewAutomationModal } from '@/tileos/features/automations'
import { PunchNewModal } from '@/tileos/features/punch'
import { POsPage, MaterialPOModal, IPOModal, NewPOModal, BookInstallerModal } from '@/tileos/features/pos'
import { JobPage } from '@/tileos/features/job/workspace'
import { SurfaceModal, TileModal } from '@/tileos/features/job/scope-tab'
import { ProjectWindow, RoomModal, ScopeDocModal, FilesModal, HistoryModal, WhatsOpenModal, ScopeWinModal, OrdersWinModal, MoneyWinModal } from '@/tileos/features/job/project-window'
import { InstallSurfaceModal } from '@/tileos/features/job/rooms'
import { StageModal } from '@/tileos/features/job/stage'
import { BuildRoomsModal } from '@/tileos/features/job/overview'
import { SchedulePage, AssignModal, BookingModal } from '@/tileos/features/schedule'
import { MoneyPage, MoneyModal } from '@/tileos/features/money'
import { FollowUpModal, AwardModal } from '@/tileos/features/pricing'
import { RecordModal } from '@/tileos/features/record'
import { ProblemModal } from '@/tileos/features/problem'
import { TouchupsModal, NoteModal } from '@/tileos/features/touchups'
import { ChecklistModal, InstallerModal } from '@/tileos/features/job/checklist'
import { DailyModal, MediaModal, SiteChangeModal, ChangeApproveModal, MeetingModal } from '@/tileos/features/field'
import { HeightsModal } from '@/tileos/features/heights'
import { UpcomingPage } from '@/tileos/features/upcoming'
import { DrainModal, CO004Modal, ThinsetModal, QtyModal, ReceiveModal, ReceiveTileModal, VerifyModal, RolesModal } from '@/tileos/features/resolve'
import { FlowPage } from '@/tileos/features/flow-map'
import { SettingsPage, AddPersonModal, InviteModal } from '@/tileos/features/settings'
import { CrewView } from '@/tileos/features/crew'
import { PayPage, PayModal, PayWeekModal } from '@/tileos/features/pay-page'
import { ProgressModal } from '@/tileos/features/progress-page'
import { IncomingWatcher, IncomingModal } from '@/tileos/features/incoming'
import { WhoWhatModal, WhoWatcher } from '@/tileos/features/whowhat'
import { LateModal, LateWatcher } from '@/tileos/features/late'
import { EditProjectModal } from '@/tileos/features/job/plan'
import { StepModal } from '@/tileos/features/stepwin'
import { BilledBeforeModal } from '@/tileos/features/job/money-tab'
import { GamePlanPage, ReadyToBookModal } from '@/tileos/features/gameplan'
import { LayoutModal, LayoutsModal } from '@/tileos/features/layout'
import { ClientProfile, DesignerProfile, InstallerProfile, SupplierProfile } from '@/tileos/features/profiles'

function ModalSwitch({ m, level }: { m: any; level: number }) {
  switch (m.t) {
    case 'job': {
      /* a job still being priced opens as its estimate */
      const st = useStore.getState()
      const j = st.jobs[m.id]
      const est = j && ['request', 'estimating', 'proposal', 'followup'].includes(j.stage) ? st.estimates.find((e) => e.jobId === m.id) : undefined
      return est ? <EstimateModal id={est.id} level={level} /> : <ProjectWindow id={m.id} tab={m.tab} level={level} />
    }
    case 'files': return <FilesModal jobId={m.jobId} level={level} />
    case 'history': return <HistoryModal jobId={m.jobId} level={level} />
    case 'room': return <RoomModal jobId={m.jobId} room={m.room} view={m.view} surface={m.surface} level={level} />
    case 'install-surface': return <InstallSurfaceModal jobId={m.jobId} room={m.room} surface={m.surface} level={level} />
    case 'sow': return <ScopeDocModal jobId={m.jobId} estId={m.estId} print={m.print} level={level} />
    case 'estimate': return <EstimateModal id={m.id} level={level} />
    case 'aiplans': return <AiPlansModal estId={m.estId} level={level} />
    case 'task': {
      /* a task that is a getting-ready step opens the step's own window */
      const t = useStore.getState().tasks.find((x) => x.id === m.id)
      const [jobId, k] = (t?.step || '').split(':')
      if (t && jobId && jobId !== '*' && k && useStore.getState().jobs[jobId]) return <StepModal jobId={jobId} k={k} level={level} />
      return <TaskModal id={m.id} level={level} />
    }
    case 'step': return <StepModal jobId={m.jobId} k={m.k} level={level} />
    case 'new': return <NewPickerModal jobId={m.jobId} level={level} />
    case 'fresh': return <FreshModal mode={m.mode} level={level} />
    case 'delete': return <DeleteModal kind={m.kind} id={m.id} level={level} />
    case 'newauto': return <NewAutomationModal who={m.who} level={level} />
    case 'newtask': return <NewTaskModal jobId={m.jobId} level={level} />
    case 'problem': return <ProblemModal jobId={m.jobId} level={level} />
    case 'touchups': return <TouchupsModal jobId={m.jobId} level={level} />
    case 'note': return <NoteModal jobId={m.jobId} level={level} />
    case 'invite': return <InviteModal k={m.key} level={level} />
    case 'checklist': return <ChecklistModal jobId={m.jobId} level={level} />
    case 'installerwin': return <InstallerModal jobId={m.jobId} level={level} />
    case 'whatsopen': return <WhatsOpenModal jobId={m.jobId} level={level} />
    case 'scopewin': return <ScopeWinModal jobId={m.jobId} level={level} />
    case 'orderswin': return <OrdersWinModal jobId={m.jobId} level={level} />
    case 'moneywin': return <MoneyWinModal jobId={m.jobId} level={level} />
    case 'crewreport': return <CrewReportModal taskId={m.taskId} level={level} />
    case 'activity': return <ActivityModal entry={m.entry} jobId={m.jobId} level={level} />
    case 'money': {
      /* a change asked on site has its own window: price it, send it, approve it */
      const mm = useStore.getState().money.find((x) => x.id === m.id)
      return mm?.meta ? <ChangeApproveModal id={m.id} level={level} /> : <MoneyModal id={m.id} level={level} />
    }
    case 'po': return <MaterialPOModal id={m.id} level={level} />
    case 'ipo': return <IPOModal id={m.id} level={level} />
    case 'book': return <BookInstallerModal jobId={m.jobId} crew={m.crew} level={level} />
    case 'newpo': return <NewPOModal jobId={m.jobId} prefill={m.prefill} fromEstimate={m.fromEstimate} fromTakeoff={m.fromTakeoff} level={level} />
    case 'newrepair': return <NewRepairModal level={level} />
    case 'newproject': return <NewProjectModal level={level} />
    case 'punchnew': return <PunchNewModal jobId={m.jobId} level={level} />
    case 'designer': return <DesignerProfile id={m.id} level={level} />
    case 'sub': return <InstallerProfile id={m.id} level={level} />
    case 'supplier': return <SupplierProfile id={m.id} level={level} />
    case 'supplierform': return <SupplierFormModal name={m.name} level={level} />
    case 'designerform': return <DesignerFormModal level={level} />
    case 'installerform': return <InstallerFormModal level={level} />
    case 'item': return <ItemModal id={m.id} level={level} />
    case 'newitem': return <NewItemModal level={level} />
    case 'importitems': return <ImportItemsModal level={level} />
    case 'email': return <EmailModal what={m.what} level={level} />
    case 'setting': return <SettingModal jobId={m.jobId} level={level} />
    case 'short': return <ShortageModal id={m.id} level={level} />
    case 'chat': return <MessagesModal jobId={m.jobId} level={level} />
    case 'readytobook': return <ReadyToBookModal level={level} />
    case 'newclient': return <NewClientModal level={level} id={m.id} />
    case 'payweek': return <PayWeekModal level={level} />
    case 'progress': return <ProgressModal jobId={m.jobId} week={m.week} level={level} />
    case 'incoming': return <IncomingModal keys={m.keys} level={level} />
    case 'estsend': return <EstSendModal id={m.id} sent={m.sent} level={level} />
    case 'estchanges': return <EstChangesModal id={m.id} level={level} />
    case 'estfollow': return <EstFollowModal id={m.id} level={level} />
    case 'estlost': return <EstLostModal id={m.id} level={level} />
    case 'billedbefore': return <BilledBeforeModal jobId={m.jobId} level={level} />
    case 'reportshort': return <ReportShortModal jobId={m.jobId} room={m.room} surface={m.surface} level={level} />
    case 'record': return <RecordModal jobId={m.jobId} type={m.type} where={m.where} title={m.title} meetKind={m.meetKind} level={level} />
    case 'event': return <EventModal id={m.id} level={level} />
    case 'pay': return <PayModal crew={m.crew} week={m.week} level={level} />
    case 'layout': return <LayoutModal jobId={m.jobId} room={m.room} surface={m.surface} tile={m.tile} level={level} />
    case 'layouts': return <LayoutsModal jobId={m.jobId} level={level} />
    case 'surface': return <SurfaceModal jobId={m.jobId} room={m.room} surface={m.surface} level={level} />
    case 'tile': return <TileModal jobId={m.jobId} tag={m.tag} room={m.room} surface={m.surface} level={level} />
    case 'daily': return <DailyModal jobId={m.jobId} room={m.room} level={level} />
    case 'media': return <MediaModal items={m.items} index={m.index} level={level} />
    case 'sitechange': return <SiteChangeModal jobId={m.jobId} room={m.room} surface={m.surface} level={level} />
    case 'coapprove': return <ChangeApproveModal id={m.id} level={level} />
    case 'meeting': return <MeetingModal taskId={m.taskId} jobId={m.jobId} kind={m.kind} level={level} />
    case 'heights': return <HeightsModal jobId={m.jobId} taskId={m.taskId} level={level} />
    case 'followup': return <FollowUpModal jobId={m.jobId} outcome={m.outcome} level={level} />
    case 'award': return <AwardModal jobId={m.jobId} level={level} />
    case 'newreq': return <NewEstimateModal level={level} />
    case 'lost': return <LostModal level={level} />
    case 'customer': return <ClientProfile id={m.id} level={level} />
    case 'assign': return <AssignModal jobId={m.jobId} crew={m.crew} start={m.start} level={level} />
    case 'booking': return <BookingModal id={m.id} level={level} />
    case 'stage': return <StageModal jobId={m.jobId} k={m.key} level={level} />
    case 'drain': return <DrainModal level={level} />
    case 'co004': return <CO004Modal level={level} />
    case 'thinset': return <ThinsetModal level={level} />
    case 'qty': return <QtyModal jobId={m.jobId} tag={m.tag} level={level} />
    case 'receive': return <ReceiveModal matId={m.matId} level={level} />
    case 'receivetile': return <ReceiveTileModal jobId={m.jobId} tag={m.tag} level={level} />
    case 'verify': return <VerifyModal taskId={m.taskId} level={level} />
    case 'roles': return <RolesModal level={level} />
    case 'whowhat': return <WhoWhatModal level={level} first={m.first} />
    case 'late': return <LateModal level={level} />
    case 'editproject': return <EditProjectModal id={m.id} level={level} />
    case 'addperson': return <AddPersonModal level={level} />
    case 'buildrooms': return <BuildRoomsModal jobId={m.jobId} level={level} />
    default: return null
  }
}

function ModalHost() {
  const modals = useStore((s) => s.modals)
  return (
    <>
      {modals.map((m, i) => (
        <ModalSwitch key={[i, m.t, m.id || m.jobId || m.taskId || m.matId || '', m.tab || '', m.room || '', m.view || '', m.surface || '', m.tag || ''].join(':')} m={m} level={i} />
      ))}
    </>
  )
}

/* pages still on the old layout (padded, centered); the rest use the full-width page template */
const LEGACY: string[] = ['flow', 'job']

function useNarrow(q = '(max-width: 1023px)') {
  const get = () => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches
  const [m, setM] = React.useState(get)
  React.useEffect(() => {
    const mq = window.matchMedia?.(q)
    if (!mq) return
    const f = () => setM(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [q])
  return m
}

export default function App() {
  const narrow = useNarrow()
  const role = useStore((s) => s.role)
  const route = useStore((s) => s.route)
  const away = useStore((s) => awayFromMe(s))
  const navList = roleDef(role).nav
  const allowed: string[] = role === 'crew' ? ['crew'] : [...navList, 'tasks', 'inbox', 'flow', 'job', ...(role === 'owner' ? ['settings'] : []), ...(['clients', 'designers', 'subs', 'suppliers'].some((k) => navList.includes(k)) ? ['directory'] : [])]
  const page: Page = allowed.includes(route.page) ? route.page : homeOf(role).page

  let body: React.ReactNode = null
  switch (page) {
    case 'today':
    case 'tasks': body = <MyTasksPage key={role} />; break
    case 'inbox': body = <InboxPage />; break
    case 'upcoming': body = <GamePlanPage />; break
    case 'estimates': body = <EstimatesPage />; break
    case 'pos': body = <POsPage />; break
    case 'pay': body = <PayPage />; break
    case 'projects': body = <ProjectsPage />; break
    case 'directory':
    case 'clients':
    case 'designers':
    case 'subs':
    case 'suppliers': body = <DirectoryPage first={page} />; break
    case 'schedule': body = <GamePlanPage />; break
    case 'money': body = <BillingPage />; break
    case 'items': body = <ItemsPage />; break
    case 'flow': body = <FlowPage />; break
    case 'settings': body = <SettingsPage />; break
    case 'job': body = <JobPage />; break
  }

  return (
    <TipProvider delayDuration={250}>
      {role === 'crew' ? (
        <CrewView />
      ) : role === 'client' ? (
        <PortalView />
      ) : (
        <div className="min-h-screen bg-canvas">
          <Sidebar />
          <div className="lg:pl-[14rem]">
            {REAL.sampleView && <SampleBar />}
            {away && <PreviewBar />}
            <TopBar />
            <DesktopTopBar />
            <main key={page + (route.id || '')} className={cn(!LEGACY.includes(page) && 'pb-[calc(4.375rem+env(safe-area-inset-bottom,0))] lg:pb-0')}>
              {LEGACY.includes(page) ? <div className="mx-auto w-full max-w-[86.25rem] px-7 pb-20 pt-6 max-xl:px-6 max-lg:px-6 max-lg:pb-32 max-sm:px-4 max-sm:pt-5">{body}</div> : body}
            </main>
          </div>
          <BottomNav />
          <IncomingWatcher />
          <WhoWatcher />
          <AppBadge />
          <LateWatcher />
        </div>
      )}
      <ModalHost />
      <CommandPalette />
      <CenterPop />
    </TipProvider>
  )
}

/** the real app, full of sample projects for a look around: say so, and one tap back to the company's own data */
function SampleBar() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#2c4a3e] px-4 py-2 text-[0.8125rem] text-white/90">
      <span><b className="font-semibold text-white">Sample projects</b> — made-up jobs, so every page has something on it. Nothing you do here is saved.</span>
      <button onClick={leaveSample} className="rounded-md bg-white/15 px-2.5 py-1 text-[0.78125rem] font-semibold text-white hover:bg-white/25">Start with my own projects</button>
    </div>
  )
}
/** while the admin tries another login: say so, and one tap back */
function PreviewBar() {
  const role = useStore((s) => s.role)
  const open = useStore((s) => s.open)
  const label = ROLES.find((r) => r.key === role)?.label.split(' · ')[0] || role
  const who = PEOPLE[meOf(role)]
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-2 text-[0.8125rem] text-white/90">
      <span>You’re seeing <b className="font-semibold text-white">{who && !/^(Estimator|Back office|Accounting|Site manager|Office)$/i.test(who.name) ? `${who.name}’s` : `a ${label}`}</b> view{who ? ` (${label})` : ''} — exactly what lands on their Today.</span>
      <button onClick={() => open({ t: 'roles' })} className="rounded-md bg-white/10 px-2.5 py-1 text-[0.78125rem] font-semibold text-white hover:bg-white/20">Someone else</button>
      <button onClick={backToMe} className="rounded-md bg-white/15 px-2.5 py-1 text-[0.78125rem] font-semibold text-white hover:bg-white/25">Back to me</button>
    </div>
  )
}
