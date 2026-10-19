// What the later passes of the pipeline leave as they find it on a route.
// Each pass that decides something about a point of a route records it
// here, and the passes after it read the record instead of deciding again.
// Locks only accumulate, in the order of the passes, so the order in which
// one decision yields to another is the order of `solve`.

/** The locks on one route, by point or segment index. */
export interface Locks {
  /**
   * The jogs that stay upright, by the index of the segment's first point:
   * the jogs where a route parts from a bundle, and the segments that turn
   * with a bundle.
   */
  readonly upright: Set<number>
}

/**
 * Locks on a route with nothing locked yet.
 *
 * @returns Empty locks.
 */
export const emptyLocks = (): Locks => ({
  upright: new Set(),
})
