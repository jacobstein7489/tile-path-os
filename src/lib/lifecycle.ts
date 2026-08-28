export const LIFECYCLE_STAGES = [
  "New Submission",
  "Estimating",
  "Proposal / Revision",
  "Approved",
  "Office Setup",
  "Site Walkthrough / Decisions",
  "Materials & Readiness",
  "Ready to Schedule",
  "Scheduled",
  "Installation",
  "Punch / Return",
  "Complete",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const EXCEPTION_STATES = ["On Hold", "Lost", "Cancelled"] as const;
export type ExceptionState = (typeof EXCEPTION_STATES)[number];

export const STAGE_SUB_WORKFLOWS: Partial<Record<LifecycleStage, string[]>> = {
  Estimating: ["Takeoff", "Questions", "Estimate", "Internal Review", "Ready to Send"],
  "Office Setup": [
    "Project Info",
    "Areas & Surfaces",
    "Tile / Grout / Metals",
    "Installation Systems",
    "Site Requirements",
    "Setup Review",
  ],
  "Materials & Readiness": ["Requirements Confirmed", "To Order", "Ordered", "Receiving", "Ready"],
  "Punch / Return": [
    "Punch Open",
    "Waiting on Material / Trade",
    "Ready for Return",
    "Return Scheduled",
    "Verified",
  ],
};

export function stageIndex(stage: string) {
  return LIFECYCLE_STAGES.indexOf(stage as LifecycleStage);
}

/** Installation percentages are only meaningful once physical work starts. */
export function showsInstallationProgress(stage: string) {
  return stageIndex(stage) >= stageIndex("Installation");
}

export const PROJECT_FILTERS = [
  "All",
  "Preconstruction",
  "Ready",
  "Scheduled",
  "Installation",
  "Closeout",
  "On Hold",
  "Complete",
] as const;

export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

const FILTER_STAGES: Record<Exclude<ProjectFilter, "All" | "On Hold">, LifecycleStage[]> = {
  Preconstruction: [
    "New Submission",
    "Estimating",
    "Proposal / Revision",
    "Approved",
    "Office Setup",
    "Site Walkthrough / Decisions",
    "Materials & Readiness",
  ],
  Ready: ["Ready to Schedule"],
  Scheduled: ["Scheduled"],
  Installation: ["Installation"],
  Closeout: ["Punch / Return"],
  Complete: ["Complete"],
};

export function matchesFilter(
  filter: ProjectFilter,
  stage: string,
  exceptionState: string | null,
): boolean {
  if (filter === "All") return true;
  if (filter === "On Hold") return exceptionState === "On Hold";
  if (exceptionState === "On Hold") return false;
  return FILTER_STAGES[filter].includes(stage as LifecycleStage);
}
