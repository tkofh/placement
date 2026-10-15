// The layered graph shared by the ordering, positioning, and routing phases.
// Elements are real nodes (ids 0 to nodeCount - 1) followed by the dummy
// elements that split each edge into one segment per pair of adjacent ranks.
// Every segment joins an element on rank r (upper) to one on rank r + 1
// (lower).

export interface Segment {
  readonly upper: number
  readonly lower: number
  readonly weight: number
  // Order-axis port shifts in [-0.5, 0.5], used by crossing reduction to
  // pull an element toward the side its port sits on.
  readonly upperShift: number
  readonly lowerShift: number
  // Whether coordinate assignment may align the two ends vertically. A
  // segment that attaches off the center of a node's facing side is not.
  readonly alignable: boolean
}

export interface LayeredGraph {
  readonly rankCount: number
  // The rank of each element.
  readonly ranks: ReadonlyArray<number>
  // Whether each element is a dummy (part of an edge chain).
  readonly dummy: ReadonlyArray<boolean>
  readonly segments: ReadonlyArray<Segment>
  // Segment ids per element: segments to the rank above, and to the rank
  // below, in creation order.
  readonly up: ReadonlyArray<ReadonlyArray<number>>
  readonly down: ReadonlyArray<ReadonlyArray<number>>
}

export function upperNeighbors(graph: LayeredGraph, element: number): Array<number> {
  return (graph.up[element] as ReadonlyArray<number>).map(
    (segment) => (graph.segments[segment] as Segment).upper,
  )
}

export function lowerNeighbors(graph: LayeredGraph, element: number): Array<number> {
  return (graph.down[element] as ReadonlyArray<number>).map(
    (segment) => (graph.segments[segment] as Segment).lower,
  )
}
