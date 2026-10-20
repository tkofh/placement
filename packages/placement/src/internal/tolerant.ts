import type { ConnectorNote } from '../connector.ts'

// The tolerant solves (`applyTolerant` in `placement/hierarchy` and
// `placement/connector`) route only the edges they keep, so the notes of the
// solve name edges by their place in that shorter list. These helpers turn
// them back into places in the caller's list.

/**
 * Renames the edges and rects in notes from the solve's to the caller's.
 *
 * @param notes - The notes of the solve.
 * @param edges - The caller's index of each edge the solve routed, in its order.
 * @param named - Whether a rect id is one the caller gave, rather than a key
 * the tolerant solve made up for an obstacle.
 * @returns The notes, with caller indices and only the caller's rect ids.
 */
export function remapNotes(
  notes: ReadonlyArray<ConnectorNote<string>>,
  edges: ReadonlyArray<number>,
  named: (id: string) => boolean,
): Array<ConnectorNote<string>> {
  const edge = (i: number): number => edges[i] as number
  return notes.map((note) => {
    if ('edge' in note) {
      return { ...note, edge: edge(note.edge) }
    }
    if ('rects' in note) {
      return { ...note, edges: note.edges.map(edge), rects: note.rects.filter(named) }
    }
    return { ...note, edges: note.edges.map(edge) }
  })
}

/**
 * Renames the edges that draw a route's shared adornments from the solve's
 * to the caller's, keeping `-1` for an end that does not merge.
 *
 * @param merged - The route's `merged`.
 * @param edges - The caller's index of each edge the solve routed, in its order.
 * @returns The same pair in caller indices.
 */
export function remapMerged(
  merged: readonly [source: number, target: number],
  edges: ReadonlyArray<number>,
): readonly [source: number, target: number] {
  const [source, target] = merged
  return [
    source < 0 ? source : (edges[source] as number),
    target < 0 ? target : (edges[target] as number),
  ]
}
