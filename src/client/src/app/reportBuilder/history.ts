/**
 * A small, generic undo/redo history for the Report Builder (Phase 12): the
 * classic past / present / future stack over an immutable value (the working
 * {@link ReportTemplate}). Kept pure and value-agnostic so the screen can hold one
 * in state and the stack logic can be tested in isolation.
 *
 * Consecutive changes that share a non-empty {@link History.tag} are *coalesced*
 * into a single undo step — so a live drag or resize (many model updates per
 * gesture) collapses to one entry, while discrete edits (untagged) each get their
 * own. An undo or redo clears the tag, so the next tagged gesture starts a fresh
 * step rather than folding into the restored state.
 */

/** The number of undo steps kept; older steps are dropped as new ones are recorded. */
export const HISTORY_LIMIT = 100

/** An undo/redo history over a value of type `T`. */
export interface History<T> {
  /** Prior states, oldest first; the last entry is the most recent undo target. */
  past: T[]
  /** The current value. */
  present: T
  /** Undone states, in the order they would be redone. */
  future: T[]
  /** The coalesce tag of the change that produced {@link present}, if any. */
  tag?: string
}

/**
 * Creates a history holding a single present value, with nothing to undo or redo.
 *
 * @param present The initial value.
 * @returns A fresh {@link History}.
 */
export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/**
 * Records a new present value. When `tag` is given and matches the tag of the
 * current present, the change is coalesced — the present is replaced without
 * adding an undo step (used for the many updates of a single drag/resize gesture);
 * otherwise the previous present is pushed onto the past. Either way the redo
 * future is cleared, and the past is capped at {@link HISTORY_LIMIT}.
 *
 * @param history The history to update.
 * @param present The new present value.
 * @param tag An optional coalesce tag identifying the gesture this change belongs to.
 * @returns A new {@link History} with the change applied.
 */
export function record<T>(history: History<T>, present: T, tag?: string): History<T> {
  if (tag != null && tag === history.tag) {
    return { ...history, present, future: [] }
  }
  const past = [...history.past, history.present]
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(-HISTORY_LIMIT) : past,
    present,
    future: [],
    tag,
  }
}

/**
 * Steps back to the previous state, moving the current present onto the redo
 * future. Returns the same history (by reference) when there is nothing to undo.
 *
 * @param history The history to step back.
 * @returns The previous {@link History}, or `history` unchanged if the past is empty.
 */
export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history
  const past = history.past.slice(0, -1)
  const present = history.past[history.past.length - 1]
  return { past, present, future: [history.present, ...history.future] }
}

/**
 * Steps forward to the next redone state, moving the current present onto the
 * past. Returns the same history (by reference) when there is nothing to redo.
 *
 * @param history The history to step forward.
 * @returns The next {@link History}, or `history` unchanged if the future is empty.
 */
export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history
  const [present, ...future] = history.future
  return { past: [...history.past, history.present], present, future }
}

/** Whether {@link undo} would change the history. */
export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

/** Whether {@link redo} would change the history. */
export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}
