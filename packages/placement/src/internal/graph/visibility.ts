import { coincident } from 'curvy/number'
import { before } from '../../utils/tolerance.ts'
import { type Graph, type Obstacle, fromRows } from './graph.ts'

// The orthogonal visibility graph of orthogonal connector routing (Wybrow,
// Marriott & Stuckey 2009). Lines run horizontally and vertically through
// every interesting point: the corners of the obstacles and the pins that
// connectors attach to. Each line extends from its point until it meets the
// interior of an obstacle, or the bounds of the drawing. The nodes of the
// graph are the points where a horizontal line crosses a vertical one, and
// each node joins the next node along its two lines. The graph holds a route
// between any two pins that is shortest for any cost that grows with length
// and bends, so the search can stay on it.
//
// Obstacles block only their open interior. A line may run along an
// obstacle's edge, so obstacles that touch leave a seam between them, and
// callers keep routes off the shapes by inflating obstacles with a clearance.

// Directions, clockwise from up (the Y axis points down). Turning clockwise
// adds one, modulo four.
export const UP = 0
export const RIGHT = 1
export const DOWN = 2
export const LEFT = 3

// Direction sets are bit masks of `1 << direction`.
export const ALL_DIRECTIONS = 0b1111

export interface Pin {
  readonly x: number
  readonly y: number
  // The directions a line leaves the pin in, as a set. A pin with no
  // directions is still a node, joined only to lines that pass through it.
  readonly directions: number
  // The obstacle the pin belongs to, if any. Its lines pass through that
  // obstacle, so a pin on a shape's boundary escapes the clearance around it.
  // Give such a pin only the directions that leave the shape.
  readonly owner?: number
}

export interface VisibilityGraph {
  // Each node lists its neighbors up, right, down, and left, skipping those
  // it does not have.
  readonly graph: Graph
  // The node of each pin.
  readonly pins: Int32Array
}

// One axis of the problem. A line sits at `across` and runs along the other
// coordinate. For horizontal lines, `across` is y and `along` is x.
interface Span {
  readonly across0: number
  readonly across1: number
  readonly along0: number
  readonly along1: number
}

interface Origin {
  readonly across: number
  readonly along: number
  // Whether the line extends from the point toward lower and higher `along`.
  readonly low: boolean
  readonly high: boolean
  readonly owner: number
  readonly pin: number
}

interface Line {
  readonly across: number
  readonly low: number
  readonly high: number
}

interface Lines {
  readonly lines: Array<Line>
  // The line that holds each pin.
  readonly pins: Array<number>
}

/**
 * Builds the orthogonal visibility graph of a set of obstacles and pins.
 *
 * @param obstacles - The rects that routes avoid. An obstacle with a
 * non-finite field is ignored.
 * @param pins - The points that routes attach to, inside the bounds of the
 * obstacles or not.
 * @returns The graph, with nodes ordered by y, then x, and the node of each
 * pin.
 */
export function visibilityGraph(
  obstacles: ReadonlyArray<Obstacle>,
  pins: ReadonlyArray<Pin>,
): VisibilityGraph {
  const kept: Array<number> = []
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const [i, o] of obstacles.entries()) {
    if (
      Number.isFinite(o.left) &&
      Number.isFinite(o.top) &&
      Number.isFinite(o.right) &&
      Number.isFinite(o.bottom)
    ) {
      kept.push(i)
      left = Math.min(left, o.left)
      top = Math.min(top, o.top)
      right = Math.max(right, o.right)
      bottom = Math.max(bottom, o.bottom)
    }
  }
  for (const pin of pins) {
    left = Math.min(left, pin.x)
    top = Math.min(top, pin.y)
    right = Math.max(right, pin.x)
    bottom = Math.max(bottom, pin.y)
  }

  const rows: Array<Span | undefined> = []
  const columns: Array<Span | undefined> = []
  const rowOrigins: Array<Origin> = []
  const columnOrigins: Array<Origin> = []
  for (const i of kept) {
    const o = obstacles[i] as Obstacle
    rows[i] = { across0: o.top, across1: o.bottom, along0: o.left, along1: o.right }
    columns[i] = { across0: o.left, across1: o.right, along0: o.top, along1: o.bottom }
    for (const y of [o.top, o.bottom]) {
      for (const x of [o.left, o.right]) {
        rowOrigins.push({ across: y, along: x, low: true, high: true, owner: -1, pin: -1 })
        columnOrigins.push({ across: x, along: y, low: true, high: true, owner: -1, pin: -1 })
      }
    }
  }
  for (const [i, pin] of pins.entries()) {
    const owner = pin.owner ?? -1
    const has = (direction: number) => (pin.directions & (1 << direction)) !== 0
    rowOrigins.push({
      across: pin.y,
      along: pin.x,
      low: has(LEFT),
      high: has(RIGHT),
      owner,
      pin: i,
    })
    columnOrigins.push({
      across: pin.x,
      along: pin.y,
      low: has(UP),
      high: has(DOWN),
      owner,
      pin: i,
    })
  }

  const horizontal = sweepLines(rows, rowOrigins, left, right, pins.length)
  const vertical = sweepLines(columns, columnOrigins, top, bottom, pins.length)
  return crossings(horizontal, vertical, pins.length)
}

// The lines through the origins along one axis, merged where they overlap on
// the same line. A sweep across the axis keeps the set of obstacles that
// block the current line: those whose interior it passes through.
function sweepLines(
  spans: ReadonlyArray<Span | undefined>,
  origins: Array<Origin>,
  low: number,
  high: number,
  pinCount: number,
): Lines {
  const blocking: Array<number> = []
  for (const [i, span] of spans.entries()) {
    // An obstacle without area has no interior to block.
    if (
      span !== undefined &&
      before(span.across0, span.across1) &&
      before(span.along0, span.along1)
    ) {
      blocking.push(i)
    }
  }
  const byStart = blocking.toSorted(
    (a, b) => (spans[a] as Span).across0 - (spans[b] as Span).across0,
  )
  const byEnd = blocking.toSorted((a, b) => (spans[a] as Span).across1 - (spans[b] as Span).across1)
  const entered = new Set<number>()
  const exited = new Set<number>()
  const active = new Set<number>()
  let nextStart = 0
  let nextEnd = 0

  origins.sort((a, b) => a.across - b.across || a.along - b.along)
  const lines: Array<Line> = []
  const pins = Array.from({ length: pinCount }, () => -1)
  let first = 0
  while (first < origins.length) {
    // Origins within rounding distance of the first share its line, which
    // keeps noise from splitting a line in two. The line sits at the first
    // pin among them, so routes end exactly on their pins.
    const start = (origins[first] as Origin).across
    let across = start
    let pinned = false
    let last = first
    while (last < origins.length && coincident((origins[last] as Origin).across, start)) {
      const origin = origins[last] as Origin
      if (!pinned && origin.pin !== -1) {
        across = origin.across
        pinned = true
      }
      last++
    }

    // An obstacle blocks the line while the line runs strictly inside it.
    while (nextStart < byStart.length) {
      const i = byStart[nextStart] as number
      if (!before((spans[i] as Span).across0, across)) {
        break
      }
      entered.add(i)
      if (!exited.has(i)) {
        active.add(i)
      }
      nextStart++
    }
    while (nextEnd < byEnd.length) {
      const i = byEnd[nextEnd] as number
      if (before(across, (spans[i] as Span).across1)) {
        break
      }
      exited.add(i)
      active.delete(i)
      nextEnd++
    }

    const extents: Array<{ low: number; high: number; pin: number }> = []
    for (let k = first; k < last; k++) {
      const origin = origins[k] as Origin
      const at = origin.along
      let lowStop = low
      let highStop = high
      let buried = false
      for (const i of active) {
        if (i === origin.owner) {
          continue
        }
        const span = spans[i] as Span
        if (!before(at, span.along1)) {
          lowStop = Math.max(lowStop, span.along1)
        } else if (!before(span.along0, at)) {
          highStop = Math.min(highStop, span.along0)
        } else {
          buried = true
          break
        }
      }
      extents.push({
        low: !buried && origin.low ? lowStop : at,
        high: !buried && origin.high ? highStop : at,
        pin: origin.pin,
      })
    }

    // Merge the extents on this line that overlap or touch. A merged line
    // without length joins nothing, so it is kept only to hold a pin.
    extents.sort((a, b) => a.low - b.low)
    let current: { low: number; high: number; pins: Array<number> } | undefined
    const flush = () => {
      if (current !== undefined && (current.low < current.high || current.pins.length > 0)) {
        for (const pin of current.pins) {
          pins[pin] = lines.length
        }
        lines.push({ across, low: current.low, high: current.high })
      }
    }
    for (const extent of extents) {
      if (current !== undefined && !before(current.high, extent.low)) {
        current.high = Math.max(current.high, extent.high)
      } else {
        flush()
        current = { low: extent.low, high: extent.high, pins: [] }
      }
      if (extent.pin !== -1) {
        current.pins.push(extent.pin)
      }
    }
    flush()
    first = last
  }
  return { lines, pins }
}

// The graph of the points where horizontal lines cross vertical ones. A sweep
// down the horizontal lines keeps the vertical lines that reach the current
// one, sorted by x, so each horizontal line meets its crossings in order.
function crossings(horizontal: Lines, vertical: Lines, pinCount: number): VisibilityGraph {
  const rows = horizontal.lines
  const columns = vertical.lines
  const byStart = [...columns.keys()].toSorted((a, b) => columnAt(a).low - columnAt(b).low)
  const byEnd = [...columns.keys()].toSorted((a, b) => columnAt(a).high - columnAt(b).high)
  function columnAt(i: number): Line {
    return columns[i] as Line
  }

  // The pins, keyed by the pair of lines that cross at them.
  const pinsAt = new Map<number, Array<number>>()
  for (let pin = 0; pin < pinCount; pin++) {
    const key = (horizontal.pins[pin] as number) * columns.length + (vertical.pins[pin] as number)
    const list = pinsAt.get(key)
    if (list === undefined) {
      pinsAt.set(key, [pin])
    } else {
      list.push(pin)
    }
  }

  const xs: Array<number> = []
  const ys: Array<number> = []
  const neighbors: Array<number> = []
  // The neighbor slots still `-1`.
  let missing = 0
  const pins = new Int32Array(pinCount).fill(-1)
  const lastOnColumn = new Int32Array(columns.length).fill(-1)
  const exited = new Uint8Array(columns.length)
  // The vertical lines that reach the current horizontal one, sorted by x,
  // then by index.
  const active: Array<number> = []
  const lowerBound = (x: number, index: number) => {
    let lo = 0
    let hi = active.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      const other = active[mid] as number
      const at = columnAt(other).across
      if (at < x || (at === x && other < index)) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    return lo
  }
  let nextStart = 0
  let nextEnd = 0

  const order = [...rows.keys()].toSorted((a, b) => {
    const p = rows[a] as Line
    const q = rows[b] as Line
    return p.across - q.across || p.low - q.low
  })
  for (const r of order) {
    const row = rows[r] as Line
    const y = row.across
    while (nextStart < byStart.length) {
      const c = byStart[nextStart] as number
      if (before(y, columnAt(c).low)) {
        break
      }
      if (exited[c] === 0) {
        const column = columnAt(c)
        active.splice(lowerBound(column.across, c), 0, c)
      }
      nextStart++
    }
    while (nextEnd < byEnd.length) {
      const c = byEnd[nextEnd] as number
      if (!before(columnAt(c).high, y)) {
        break
      }
      exited[c] = 1
      const at = active.indexOf(c)
      if (at !== -1) {
        active.splice(at, 1)
      }
      nextEnd++
    }

    let previous = -1
    let lo = 0
    let hi = active.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (before(columnAt(active[mid] as number).across, row.low)) {
        lo = mid + 1
      } else {
        hi = mid
      }
    }
    for (let k = lo; k < active.length; k++) {
      const c = active[k] as number
      const x = columnAt(c).across
      if (before(row.high, x)) {
        break
      }
      const node = xs.length
      xs.push(x)
      ys.push(y)
      neighbors.push(-1, -1, -1, -1)
      missing += 4
      if (previous !== -1) {
        neighbors[4 * previous + RIGHT] = node
        neighbors[4 * node + LEFT] = previous
        missing -= 2
      }
      const above = lastOnColumn[c] as number
      if (above !== -1) {
        neighbors[4 * above + DOWN] = node
        neighbors[4 * node + UP] = above
        missing -= 2
      }
      lastOnColumn[c] = node
      previous = node
      for (const pin of pinsAt.get(r * columns.length + c) ?? []) {
        pins[pin] = node
      }
    }
  }

  const offsets = new Int32Array(xs.length + 1)
  const targets = new Int32Array(neighbors.length - missing)
  let e = 0
  for (let slot = 0; slot < neighbors.length; slot++) {
    const neighbor = neighbors[slot] as number
    if (neighbor !== -1) {
      targets[e++] = neighbor
    }
    if ((slot & 3) === 3) {
      offsets[(slot >> 2) + 1] = e
    }
  }
  return {
    graph: fromRows(
      Float64Array.from(xs),
      Float64Array.from(ys),
      offsets,
      targets,
      undefined,
      true,
    ),
    pins,
  }
}
