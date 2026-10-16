import { coincident } from 'curvy/number'
import { findReversed } from './acyclic.ts'

// Lane assignment for the parallel segments in a routing channel, the
// ordering problem of orthogonal edge routing (Sander 2004, and the nudging
// step of orthogonal connector routing).
//
// A channel is a strip that connections cross. Each crossing that shifts
// sideways becomes a jog: a segment along the channel at some lane, joined to
// a connection from the near side of the channel at `start` and to one toward
// the far side at `end`. Jogs whose spans overlap need different lanes, and
// their order decides how many of their connections cross. Lane 0 is nearest
// the near side.

export interface Jog {
  // Where the connection from the near side meets the jog.
  readonly start: number
  // Where the connection toward the far side leaves it.
  readonly end: number
}

export interface Lanes {
  // The lane of each jog.
  readonly lanes: ReadonlyArray<number>
  // The number of lanes in use.
  readonly count: number
}

const low = (jog: Jog) => Math.min(jog.start, jog.end)
const high = (jog: Jog) => Math.max(jog.start, jog.end)

// Spans that only touch share a lane: they meet end to end.
function overlaps(a: Jog, b: Jog): boolean {
  const from = Math.max(low(a), low(b))
  const to = Math.min(high(a), high(b))
  return from < to && !coincident(from, to)
}

function inside(x: number, jog: Jog): boolean {
  const from = low(jog)
  const to = high(jog)
  return x > from && x < to && !coincident(x, from) && !coincident(x, to)
}

// The crossings when `a` runs nearer the near side than `b`: a's connection
// toward the far side crosses b's jog, and b's connection from the near side
// crosses a's jog.
function crossings(a: Jog, b: Jog): number {
  return (inside(a.end, b) ? 1 : 0) + (inside(b.start, a) ? 1 : 0)
}

/**
 * Assigns lanes to the jogs of one channel. Overlapping jogs get distinct
 * lanes, ordered to avoid the crossings that an order can avoid. When the
 * preferred orders form a cycle, a depth-first search in input order breaks
 * it, accepting a crossing. The result is deterministic.
 *
 * @param jogs - The jogs of the channel.
 * @returns The lane of each jog and the lane count.
 */
export function assignLanes(jogs: ReadonlyArray<Jog>): Lanes {
  const count = jogs.length
  const conflicts: Array<Array<number>> = jogs.map(() => [])
  const preferred: Array<{ source: number; target: number }> = []

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const a = jogs[i] as Jog
      const b = jogs[j] as Jog
      if (!overlaps(a, b)) {
        continue
      }
      ;(conflicts[i] as Array<number>).push(j)
      ;(conflicts[j] as Array<number>).push(i)
      const aFirst = crossings(a, b)
      const bFirst = crossings(b, a)
      if (aFirst < bFirst) {
        preferred.push({ source: i, target: j })
      } else if (bFirst < aFirst) {
        preferred.push({ source: j, target: i })
      }
    }
  }

  // An acyclic version of the preferred orders: flip each back edge.
  const reversed = findReversed(count, preferred)
  const before: Array<Array<number>> = jogs.map(() => [])
  const pending = Array.from({ length: count }, () => 0)
  for (const [k, { source, target }] of preferred.entries()) {
    const [first, second] = reversed[k] ? [target, source] : [source, target]
    ;(before[first] as Array<number>).push(second)
    const waiting = pending[second] as number
    pending[second] = waiting + 1
  }

  // A topological order that takes the lowest ready index first. Jogs with
  // no preference between them keep input order.
  const position = Array.from({ length: count }, () => -1)
  const ready: Array<number> = []
  for (let i = 0; i < count; i++) {
    if (pending[i] === 0) {
      ready.push(i)
    }
  }
  let next = 0
  while (ready.length > 0) {
    let pick = 0
    for (let k = 1; k < ready.length; k++) {
      if ((ready[k] as number) < (ready[pick] as number)) {
        pick = k
      }
    }
    const jog = ready.splice(pick, 1)[0] as number
    position[jog] = next++
    for (const after of before[jog] as Array<number>) {
      const left = (pending[after] as number) - 1
      pending[after] = left
      if (left === 0) {
        ready.push(after)
      }
    }
  }

  // Each jog takes the lane after every overlapping jog placed before it.
  const order = Array.from({ length: count }, (_, i) => i).toSorted(
    (a, b) => (position[a] as number) - (position[b] as number),
  )
  const lanes = Array.from({ length: count }, () => 0)
  let used = 0
  for (const jog of order) {
    let lane = 0
    for (const other of conflicts[jog] as Array<number>) {
      if ((position[other] as number) < (position[jog] as number)) {
        lane = Math.max(lane, (lanes[other] as number) + 1)
      }
    }
    lanes[jog] = lane
    used = Math.max(used, lane + 1)
  }

  return { lanes, count: used }
}
