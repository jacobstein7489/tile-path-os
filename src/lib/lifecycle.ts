export const LIFECYCLE_STAGES = [
  "New Submission",
  "Estimating",
  "Proposal",
  "Awarded",
  "Setup",
  "Ready",
  "Scheduled",
  "Installation",
  "Closeout / Return",
  "Complete",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export const EXCEPTION_STATES = ["On Hold", "Lost", "Cancelled"] as const;
export type ExceptionState = (typeof EXCEPTION_STATES)[number];

export const STAGE_SUB_WORKFLOWS: Partial<Record<LifecycleStage, string[]>> = {
  Estimating: ["Takeoff", "Questions", "Estimate", "Internal Review", "Ready to Send"],
  Setup: [
    "Project Info",
    "Scope & Plans",
    "Tiles & Finishes",
    "Install Materials",
    "Site Conditions",
    "Setup Review",
  ],
  Ready: ["Scope Ready", "Finishes Ready", "Materials On Site", "Crew Ready", "Schedule Ready"],
  "Closeout / Return": [
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

/** The next master lifecycle stage, or null at Complete. */
export function nextStage(stage: string): LifecycleStage | null {
  const i = stageIndex(stage);
  if (i < 0 || i >= LIFECYCLE_STAGES.length - 1) return null;
  return LIFECYCLE_STAGES[i + 1]!;
}

export function subWorkflowFor(stage: string): string[] | undefined {
  return STAGE_SUB_WORKFLOWS[stage as LifecycleStage];
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

/** Filters shown on the Projects page by default. */
export const PRIMARY_PROJECT_FILTERS = [
  "All",
  "Ready",
  "Scheduled",
  "Installation",
  "Closeout",
] as const;

/** Everything else lives behind More filters. */
export const MORE_PROJECT_FILTERS = ["Preconstruction", "On Hold", "Complete"] as const;

export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

const FILTER_STAGES: Record<Exclude<ProjectFilter, "All" | "On Hold">, LifecycleStage[]> = {
  Preconstruction: ["New Submission", "Estimating", "Proposal", "Awarded", "Setup"],
  Ready: ["Ready"],
  Scheduled: ["Scheduled"],
  Installation: ["Installation"],
  Closeout: ["Closeout / Return"],
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
