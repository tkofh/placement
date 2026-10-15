import { coincident } from 'curvy/number'
import { type LayeredGraph, lowerNeighbors, upperNeighbors } from './graph.ts'

// Order-axis coordinate assignment by Brandes and Köpf ("Fast and Simple
// Horizontal Coordinate Assignment", 2001), following the structure of
// dagre's implementation. Four passes (aligned upward or downward, compacted
// leftward or rightward) each build vertical blocks of aligned elements and
// pack them as tightly as separation allows. The result is the average of
// the two median candidates per element.
//
// Each element has an anchor (the coordinate this phase solves for) and
// extents before and after it, plus half of the gap it wants to its
// neighbors. Adjacent elements in a rank must stay at least
// after(left) + gap(left) + gap(right) + before(right) apart.
//
// Every construction is exact IEEE 754: sums, maxima, minima, and the median
// average. Two discrete decisions involve floats. The narrowest alignment
// wins only when it is narrower beyond the coincidence band, and the
// balanced result is rejected only when it violates separation beyond the
// band.

export interface Extent {
  readonly before: number
  readonly after: number
  readonly gap: number
}

type Neighbors = (graph: LayeredGraph, element: number) => Array<number>

export function position(
  graph: LayeredGraph,
  layers: ReadonlyArray<ReadonlyArray<number>>,
  extents: ReadonlyArray<Extent>,
): Array<number> {
  const count = graph.ranks.length
  const conflicts = findType1Conflicts(graph, layers, count)

  const candidates: Array<Array<number>> = []

  for (const vertical of ['up', 'down'] as const) {
    const verticalLayers = vertical === 'up' ? layers : [...layers].toReversed()
    const neighbors: Neighbors = vertical === 'up' ? upperNeighbors : lowerNeighbors

    for (const horizontal of ['left', 'right'] as const) {
      const reverse = horizontal === 'right'
      const adjusted = reverse
        ? verticalLayers.map((layer) => [...layer].toReversed())
        : verticalLayers

      const root = verticalAlignment(graph, adjusted, conflicts, neighbors, count)
      const xs = horizontalCompaction(adjusted, root, extents, reverse, count)
      candidates.push(reverse ? xs.map((x) => -x) : xs)
    }
  }

  // Shift each candidate so that it shares the left edge (or, for the
  // right-compacted candidates, the right edge) of the narrowest one.
  const narrowest = findNarrowest(candidates, extents)
  const narrowestMin = minimum(narrowest)
  const narrowestMax = maximum(narrowest)

  const aligned = candidates.map((xs, index) => {
    if (xs === narrowest) {
      return xs
    }
    const delta = index % 2 === 0 ? narrowestMin - minimum(xs) : narrowestMax - maximum(xs)
    return xs.map((x) => x + delta)
  })

  const balanced: Array<number> = []
  for (let element = 0; element < count; element++) {
    const values = aligned.map((xs) => xs[element] as number).toSorted((a, b) => a - b)
    balanced.push(((values[1] as number) + (values[2] as number)) / 2)
  }

  if (respectsSeparation(balanced, layers, extents)) {
    return balanced
  }

  return aligned[candidates.indexOf(narrowest)] as Array<number>
}

// Marks segments that cross an inner segment (one that joins two dummies)
// so that alignment never uses them. Inner segments then stay straight.
// Segments that are not alignable (off-center ports) are marked too.
function findType1Conflicts(
  graph: LayeredGraph,
  layers: ReadonlyArray<ReadonlyArray<number>>,
  count: number,
): Set<number> {
  const conflicts = new Set<number>()
  for (const segment of graph.segments) {
    if (!segment.alignable) {
      conflicts.add(conflictKey(segment.upper, segment.lower, count))
    }
  }
  const pos = new Int32Array(count)
  for (const layer of layers) {
    for (const [index, element] of layer.entries()) {
      pos[element] = index
    }
  }

  for (let r = 1; r < layers.length; r++) {
    const previousLength = (layers[r - 1] as ReadonlyArray<number>).length
    const layer = layers[r] as ReadonlyArray<number>
    const last = layer[layer.length - 1]
    let k0 = 0
    let scan = 0

    for (const [i, element] of layer.entries()) {
      const inner = graph.dummy[element]
        ? upperNeighbors(graph, element).find((upper) => graph.dummy[upper])
        : undefined
      const k1 = inner === undefined ? previousLength : (pos[inner] as number)

      if (inner !== undefined || element === last) {
        for (const scanned of layer.slice(scan, i + 1)) {
          for (const upper of upperNeighbors(graph, scanned)) {
            const upperPos = pos[upper] as number
            if ((upperPos < k0 || k1 < upperPos) && !(graph.dummy[upper] && graph.dummy[scanned])) {
              conflicts.add(conflictKey(upper, scanned, count))
            }
          }
        }
        scan = i + 1
        k0 = k1
      }
    }
  }

  return conflicts
}

function conflictKey(a: number, b: number, count: number): number {
  return a < b ? a * count + b : b * count + a
}

// Aligns each element with the median of its neighbors in the previous
// layer, unless that crosses an earlier alignment or a marked conflict.
// `align` links each block into a cycle. The result names the root (first
// element) of each element's block.
function verticalAlignment(
  graph: LayeredGraph,
  layers: ReadonlyArray<ReadonlyArray<number>>,
  conflicts: Set<number>,
  neighbors: Neighbors,
  count: number,
): Int32Array {
  const root = new Int32Array(count)
  const align = new Int32Array(count)
  const pos = new Int32Array(count)

  for (const layer of layers) {
    for (const [index, element] of layer.entries()) {
      root[element] = element
      align[element] = element
      pos[element] = index
    }
  }

  for (const layer of layers) {
    let previous = -1
    for (const element of layer) {
      const ws = neighbors(graph, element)
      if (ws.length === 0) {
        continue
      }
      ws.sort((a, b) => (pos[a] as number) - (pos[b] as number))
      const median = (ws.length - 1) / 2
      for (let i = Math.floor(median); i <= Math.ceil(median); i++) {
        const w = ws[i] as number
        if (
          align[element] === element &&
          previous < (pos[w] as number) &&
          !conflicts.has(conflictKey(element, w, count))
        ) {
          align[w] = element
          align[element] = root[w] as number
          root[element] = root[w] as number
          previous = pos[w] as number
        }
      }
    }
  }

  return root
}

// Packs blocks against each other. The block graph has an edge from the
// block on the left to the block on the right for every adjacent pair in a
// layer, weighted with their separation. The first pass places each block as
// far left as its predecessors allow. The second pass pulls blocks right
// toward their successors to remove unused space.
function horizontalCompaction(
  layers: ReadonlyArray<ReadonlyArray<number>>,
  root: Int32Array,
  extents: ReadonlyArray<Extent>,
  reverse: boolean,
  count: number,
): Array<number> {
  const separations = new Map<number, Map<number, number>>()
  const incoming = new Map<number, Array<number>>()
  const blocks: Array<number> = []
  const seen = new Set<number>()

  for (const layer of layers) {
    let left: number | undefined
    for (const element of layer) {
      const block = root[element] as number
      if (!seen.has(block)) {
        seen.add(block)
        blocks.push(block)
      }
      if (left !== undefined) {
        const leftBlock = root[left] as number
        const separation = separate(extents, left, element, reverse)
        let targets = separations.get(leftBlock)
        if (targets === undefined) {
          targets = new Map()
          separations.set(leftBlock, targets)
        }
        const existing = targets.get(block)
        if (existing === undefined) {
          targets.set(block, separation)
          let sources = incoming.get(block)
          if (sources === undefined) {
            sources = []
            incoming.set(block, sources)
          }
          sources.push(leftBlock)
        } else {
          targets.set(block, Math.max(existing, separation))
        }
      }
      left = element
    }
  }

  // Kahn's algorithm in first-appearance order. The block graph is acyclic
  // because every layer orders its blocks consistently.
  const inDegree = new Map<number, number>()
  for (const block of blocks) {
    inDegree.set(block, incoming.get(block)?.length ?? 0)
  }
  const sorted = blocks.filter((block) => inDegree.get(block) === 0)
  for (let i = 0; i < sorted.length; i++) {
    for (const target of separations.get(sorted[i] as number)?.keys() ?? []) {
      const remaining = (inDegree.get(target) as number) - 1
      inDegree.set(target, remaining)
      if (remaining === 0) {
        sorted.push(target)
      }
    }
  }

  const xs = new Map<number, number>()
  for (const block of sorted) {
    let x = 0
    for (const source of incoming.get(block) ?? []) {
      x = Math.max(x, (xs.get(source) as number) + (separations.get(source)?.get(block) as number))
    }
    xs.set(block, x)
  }

  for (let i = sorted.length - 1; i >= 0; i--) {
    const block = sorted[i] as number
    let min = Number.POSITIVE_INFINITY
    for (const [target, separation] of separations.get(block) ?? []) {
      min = Math.min(min, (xs.get(target) as number) - separation)
    }
    if (min !== Number.POSITIVE_INFINITY) {
      xs.set(block, Math.max(xs.get(block) as number, min))
    }
  }

  const result: Array<number> = Array.from({ length: count }, () => 0)
  for (let element = 0; element < count; element++) {
    result[element] = xs.get(root[element] as number) ?? 0
  }
  return result
}

// The minimum anchor distance between `left` and the element after it. In a
// reversed pass, `left` sits physically to the right of `right`.
export function separate(
  extents: ReadonlyArray<Extent>,
  left: number,
  right: number,
  reverse: boolean,
): number {
  const a = extents[left] as Extent
  const b = extents[right] as Extent
  return (reverse ? a.before + b.after : a.after + b.before) + a.gap + b.gap
}

function findNarrowest(
  candidates: ReadonlyArray<Array<number>>,
  extents: ReadonlyArray<Extent>,
): Array<number> {
  let best = candidates[0] as Array<number>
  let bestWidth = Number.POSITIVE_INFINITY

  for (const xs of candidates) {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    for (const [element, x] of xs.entries()) {
      const extent = extents[element] as Extent
      min = Math.min(min, x - extent.before)
      max = Math.max(max, x + extent.after)
    }
    const width = max - min
    if (
      bestWidth === Number.POSITIVE_INFINITY ||
      (width < bestWidth && !coincident(width, bestWidth))
    ) {
      best = xs
      bestWidth = width
    }
  }

  return best
}

function respectsSeparation(
  xs: ReadonlyArray<number>,
  layers: ReadonlyArray<ReadonlyArray<number>>,
  extents: ReadonlyArray<Extent>,
): boolean {
  for (const layer of layers) {
    for (let i = 1; i < layer.length; i++) {
      const left = layer[i - 1] as number
      const right = layer[i] as number
      const a = extents[left] as Extent
      const b = extents[right] as Extent
      const leftEdge = (xs[left] as number) + a.after + a.gap
      const rightEdge = (xs[right] as number) - b.before - b.gap
      if (rightEdge < leftEdge && !coincident(rightEdge, leftEdge)) {
        return false
      }
    }
  }
  return true
}

function minimum(values: ReadonlyArray<number>): number {
  let result = Number.POSITIVE_INFINITY
  for (const value of values) {
    result = Math.min(result, value)
  }
  return result
}

function maximum(values: ReadonlyArray<number>): number {
  let result = Number.NEGATIVE_INFINITY
  for (const value of values) {
    result = Math.max(result, value)
  }
  return result
}
