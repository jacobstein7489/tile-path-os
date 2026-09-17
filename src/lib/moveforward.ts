import { useCallback } from "react";
import {
  simpleStatus,
  useSaveWorkItem,
  workflowFor,
  type WorkItemRow,
} from "@/lib/workitems";

/**
 * Move Forward — the single canonical workflow transition.
 *
 * One work_items row is updated and exactly ONE history event is appended.
 * No replacement work item is ever created. Internal workflow_step and
 * next_action are preserved: users never manage internal step labels, so the
 * transition only touches the user-facing fields (status, waiting-on,
 * follow-up, date, completion).
 */

/** The only four states a user can move an item into. */
export const MOVE_STATES = ["To Do", "Waiting", "Scheduled", "Done"] as const;
export type MoveState = (typeof MOVE_STATES)[number];

export type MoveForwardInput = {
  item: WorkItemRow;
  next: MoveState;
  /** "What happened?" — optional, folded into the single history event. */
  note?: string;
  waitingOn?: string | null;
  followUpOn?: string | null;
  /** Scheduled date. Stored on the item's existing due date field. */
  scheduledFor?: string | null;
};

/** Snapshot of everything Move Forward may change, so Undo can restore it. */
export type MoveSnapshot = Pick<
  WorkItemRow,
  "status" | "waiting_on" | "follow_up_on" | "due_date" | "completed_at"
>;

export function snapshotOf(item: WorkItemRow): MoveSnapshot {
  return {
    status: item.status,
    waiting_on: item.waiting_on ?? null,
    follow_up_on: item.follow_up_on ?? null,
    due_date: item.due_date ?? null,
    completed_at: item.completed_at ?? null,
  };
}

/** The current user-facing state of an item, collapsed from stored statuses. */
export function currentMoveState(item: WorkItemRow): MoveState {
  if (item.status === "Complete" || item.status === "Done" || item.completed_at) return "Done";
  if (item.status === "Scheduled") return "Scheduled";
  if (simpleStatus(item.status) === "Waiting") return "Waiting";
  return "To Do";
}

/** Stored status written for each user-facing state. Legacy values are never migrated. */
function storedFor(next: MoveState): string {
  switch (next) {
    case "Done":
      return "Complete";
    case "Waiting":
      return "Waiting";
    case "Scheduled":
      return "Scheduled";
    default:
      return "Open";
  }
}

export function buildMovePatch(input: MoveForwardInput): Partial<WorkItemRow> {
  const { item, next } = input;
  const patch: Partial<WorkItemRow> = {
    status: storedFor(next),
    completed_at: next === "Done" ? new Date().toISOString() : null,
  };

  if (next === "Waiting") {
    patch.waiting_on = input.waitingOn?.trim() || item.waiting_on || null;
    patch.follow_up_on = input.followUpOn || null;
  } else {
    // Leaving Waiting clears the follow-up so it stops resurfacing on Today.
    patch.waiting_on = null;
    patch.follow_up_on = null;
  }

  if (next === "Scheduled") patch.due_date = input.scheduledFor || item.due_date || null;

  return patch;
}

/** The single history sentence written for this transition. */
export function moveEventMessage(input: MoveForwardInput): string {
  const { item, next } = input;
  const parts: string[] = [];
  const note = input.note?.trim();
  if (note) parts.push(note);

  const step = item.workflow_step;
  const wf = workflowFor(item);
  switch (next) {
    case "Waiting": {
      const who = input.waitingOn?.trim() || item.waiting_on;
      parts.push(
        `Moved to Waiting${who ? ` on ${who}` : ""}${
          input.followUpOn ? ` · follow up ${input.followUpOn}` : ""
        }`,
      );
      break;
    }
    case "Scheduled":
      parts.push(`Moved to Scheduled${input.scheduledFor ? ` for ${input.scheduledFor}` : ""}`);
      break;
    case "Done":
      parts.push("Completed");
      break;
    default:
      parts.push("Moved to To Do");
  }
  if (wf && step) parts.push(`(step: ${step})`);
  return parts.join(" — ");
}

/**
 * Performs a Move Forward. Optimistic through the existing save mutation, so
 * the row flips instantly and the write catches up.
 */
export function useMoveForward() {
  const save = useSaveWorkItem();

  const move = useCallback(
    async (input: MoveForwardInput): Promise<MoveSnapshot> => {
      const previous = snapshotOf(input.item);
      await save.mutateAsync({
        id: input.item.id,
        patch: buildMovePatch(input),
        note: moveEventMessage(input),
      });
      return previous;
    },
    [save],
  );

  const undo = useCallback(
    async (id: string, previous: MoveSnapshot) => {
      await save.mutateAsync({ id, patch: previous, note: "Move forward undone" });
    },
    [save],
  );

  return { move, undo, isPending: save.isPending };
}
