import { coincident } from 'curvy/number'
import type { LayeredGraph, Segment } from './graph.ts'

// Crossing reduction, the ordering phase of layered layout. It alternates
// down and up sweeps. Each sweep sorts a rank by the weighted barycenter of
// each element's neighbors in the rank just fixed, and the order with the
// fewest crossings wins. Crossing counts are integers, so comparing them is
// exact. Barycenters are float averages, so equal barycenters are decided
// with `coincident` and fall back to the current order (see PRECISION.md).

const MAX_SWEEPS = 32
const PATIENCE = 4

export function order(graph: LayeredGraph): Array<Array<number>> {
  let layers = initialOrder(graph)
  const position = new Int32Array(graph.ranks.length)
  const assign = (): void => {
    for (const layer of layers) {
      for (const [index, element] of layer.entries()) {
        position[element] = index
      }
    }
  }
  assign()

  let best = layers.map((layer) => [...layer])
  let bestCrossings = countCrossings(graph, layers, position)

  for (let sweep = 0, sinceBest = 0; sweep < MAX_SWEEPS && sinceBest < PATIENCE; sweep++) {
    if (bestCrossings === 0) {
      break
    }

    const downward = sweep % 2 === 0
    const biasRight = sweep % 4 >= 2

    if (downward) {
      for (let r = 1; r < layers.length; r++) {
        layers[r] = reorder(graph, layers[r] as Array<number>, position, true, biasRight)
      }
    } else {
      for (let r = layers.length - 2; r >= 0; r--) {
        layers[r] = reorder(graph, layers[r] as Array<number>, position, false, biasRight)
      }
    }

    const crossings = countCrossings(graph, layers, position)
    sinceBest++
    if (crossings < bestCrossings) {
      best = layers.map((layer) => [...layer])
      bestCrossings = crossings
      sinceBest = 0
    }
  }

  layers = best
  return layers
}

// A depth-first search from the elements in rank order, then id order. Each
// element joins its rank when first visited, so connected elements start out
// near each other, in the order the caller wrote them.
function initialOrder(graph: LayeredGraph): Array<Array<number>> {
  const layers: Array<Array<number>> = Array.from({ length: graph.rankCount }, () => [])
  const visited = new Uint8Array(graph.ranks.length)
  const starts = graph.ranks.map((_, element) => element)
  starts.sort((a, b) => (graph.ranks[a] as number) - (graph.ranks[b] as number) || a - b)

  for (const start of starts) {
    if (visited[start] === 1) {
      continue
    }
    const stack = [start]
    while (stack.length > 0) {
      const element = stack.pop() as number
      if (visited[element] === 1) {
        continue
      }
      visited[element] = 1
      layers[graph.ranks[element] as number]?.push(element)
      const down = graph.down[element] as ReadonlyArray<number>
      for (let i = down.length - 1; i >= 0; i--) {
        const lower = (graph.segments[down[i] as number] as Segment).lower
        if (visited[lower] === 0) {
          stack.push(lower)
        }
      }
    }
  }

  return layers
}

function reorder(
  graph: LayeredGraph,
  layer: ReadonlyArray<number>,
  position: Int32Array,
  fromAbove: boolean,
  biasRight: boolean,
): Array<number> {
  const sortable: Array<{ element: number; index: number; barycenter: number }> = []
  const fixed: Array<{ element: number; index: number }> = []

  for (const [index, element] of layer.entries()) {
    const segments = (fromAbove ? graph.up : graph.down)[element] as ReadonlyArray<number>
    if (segments.length === 0) {
      fixed.push({ element, index })
      continue
    }

    let weighted = 0
    let weights = 0
    let plain = 0
    for (const segmentId of segments) {
      const segment = graph.segments[segmentId] as Segment
      const neighbor = fromAbove ? segment.upper : segment.lower
      const shift = fromAbove
        ? segment.upperShift - segment.lowerShift
        : segment.lowerShift - segment.upperShift
      const value = (position[neighbor] as number) + shift
      weighted += segment.weight * value
      weights += segment.weight
      plain += value
    }

    const barycenter = weights > 0 ? weighted / weights : plain / segments.length
    sortable.push({ element, index, barycenter })
  }

  sortable.sort((a, b) => {
    if (!coincident(a.barycenter, b.barycenter)) {
      return a.barycenter - b.barycenter
    }
    return biasRight ? b.index - a.index : a.index - b.index
  })

  // Elements without neighbors on the fixed side keep their slots. The
  // sorted elements fill the remaining slots in order.
  const result: Array<number> = Array.from({ length: layer.length }, () => -1)
  for (const { element, index } of fixed) {
    result[index] = element
  }
  let next = 0
  for (const [slot, value] of result.entries()) {
    if (value === -1) {
      result[slot] = (sortable[next++] as (typeof sortable)[number]).element
    }
  }

  for (const [index, element] of result.entries()) {
    position[element] = index
  }
  return result
}

// Counts crossings between each pair of adjacent ranks with an accumulator
// tree (Barth, Mutzel, and Jünger, 2004).
export function countCrossings(
  graph: LayeredGraph,
  layers: ReadonlyArray<ReadonlyArray<number>>,
  position: Int32Array,
): number {
  let total = 0

  for (let r = 0; r + 1 < layers.length; r++) {
    const north = layers[r] as ReadonlyArray<number>
    const southLength = (layers[r + 1] as ReadonlyArray<number>).length
    if (southLength === 0) {
      continue
    }

    const entries: Array<number> = []
    for (const element of north) {
      const lowers = (graph.down[element] as ReadonlyArray<number>).map(
        (segment) => position[(graph.segments[segment] as Segment).lower] as number,
      )
      lowers.sort((a, b) => a - b)
      entries.push(...lowers)
    }

    let firstIndex = 1
    while (firstIndex < southLength) {
      firstIndex <<= 1
    }
    const tree = new Int32Array(2 * firstIndex - 1)
    firstIndex -= 1

    for (const south of entries) {
      let index = south + firstIndex
      increment(tree, index)
      let sum = 0
      while (index > 0) {
        if (index % 2 === 1) {
          sum += tree[index + 1] as number
        }
        index = (index - 1) >> 1
        increment(tree, index)
      }
      total += sum
    }
  }

  return total
}

function increment(tree: Int32Array, index: number): void {
  const count = tree[index] as number
  tree[index] = count + 1
}
