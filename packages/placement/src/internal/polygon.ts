import { coincident } from 'curvy/number'

// Polygon geometry shared by `placement/polygon` and the hierarchy layout:
// regular polygons and polygrams in fractions of a box, the circular arcs
// that round their corners, and the growth that keeps a rounded outline
// filling its box.

export type XY = readonly [x: number, y: number]

// The sine and cosine of `pi * m / d`, for integers `m` and `d > 0`. Both
// come from one angle in the first octant, so angles that mirror each other
// get values of exactly the same size, and quarter turns are exact.
function sinCosPi(m: number, d: number): XY {
  const full = 2 * d
  // The angle, as m / d half turns, in [0, 2).
  let u = ((m % full) + full) % full
  let sinSign = 1
  let cosSign = 1
  if (u > d) {
    u = full - u
    sinSign = -1
  }
  if (2 * u > d) {
    u = d - u
    cosSign = -1
  }
  // Now in [0, pi/2]. Past an eighth turn, sine and cosine trade places.
  let sin: number
  let cos: number
  if (4 * u === d) {
    sin = Math.SQRT1_2
    cos = Math.SQRT1_2
  } else if (4 * u > d) {
    const v = d - 2 * u
    sin = Math.cos((Math.PI * v) / (2 * d))
    cos = Math.sin((Math.PI * v) / (2 * d))
  } else {
    sin = Math.sin((Math.PI * u) / d)
    cos = Math.cos((Math.PI * u) / d)
  }
  return [sinSign * sin, cosSign * cos]
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

// The corners of a regular polygon or polygram, as closed loops of points
// in fractions of a box, stretched to fill it. The base polygon of `sides`
// corners has a flat top edge. Each point moves `phase` of the way along
// the edge from its corner to the next one. Each loop then joins every
// `step`-th point, which makes a star for steps past 1. A step that shares
// a factor with `sides` splits the points into that many loops.
export function regularLoops(sides: number, step: number, phase: number): Array<Array<XY>> {
  const d = 2 * sides
  const corners: Array<XY> = []
  for (let i = 0; i < sides; i++) {
    // Half turns of (4i - sides - 2) / (2 sides) put the first edge on top.
    const [sin, cos] = sinCosPi(4 * i - sides - 2, d)
    corners.push([cos, sin])
  }
  const points = corners.map((corner, i): XY => {
    if (phase === 0) {
      return corner
    }
    const next = corners[(i + 1) % sides] as XY
    return [corner[0] + phase * (next[0] - corner[0]), corner[1] + phase * (next[1] - corner[1])]
  })

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [x, y] of points) {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const fractions = points.map(
    ([x, y]): XY => [(x - minX) / (maxX - minX), (y - minY) / (maxY - minY)],
  )

  const count = gcd(sides, step)
  const loops: Array<Array<XY>> = []
  for (let start = 0; start < count; start++) {
    const loop: Array<XY> = []
    for (let k = 0; k < sides / count; k++) {
      loop.push(fractions[(start + k * step) % sides] as XY)
    }
    loops.push(loop)
  }
  return loops
}

// The arc that rounds a corner of a closed loop: its tangent points on the
// sides before and after the corner, its circle, the unit direction from
// the center toward the corner, and how far its tangent points reach in
// that direction. The arc is the part of the circle that reaches further.
export interface CornerArc {
  readonly start: XY
  readonly end: XY
  readonly center: XY
  readonly radius: number
  readonly toward: XY
  readonly limit: number
}

// Rounds each corner of a closed loop with a circular arc of `radius`. A
// corner reaches `radius * tan(turn / 2)` along its sides, and never past
// its share of either side: the two corners on a side split it in
// proportion to what each wants, and a corner that does not fit takes a
// smaller radius. Straight and reversing corners stay sharp.
export function cornerArcs(
  corners: ReadonlyArray<XY>,
  radius: number,
): Array<CornerArc | undefined> {
  const count = corners.length
  if (!(radius > 0)) {
    return corners.map(() => undefined)
  }
  const at = (i: number) => corners[(i + count) % count] as XY
  const turns = corners.map((corner, i) => {
    const before = at(i - 1)
    const after = at(i + 1)
    const inLength = Math.hypot(corner[0] - before[0], corner[1] - before[1])
    const outLength = Math.hypot(after[0] - corner[0], after[1] - corner[1])
    if (inLength === 0 || outLength === 0) {
      return undefined
    }
    const u: XY = [(corner[0] - before[0]) / inLength, (corner[1] - before[1]) / inLength]
    const v: XY = [(after[0] - corner[0]) / outLength, (after[1] - corner[1]) / outLength]
    const cross = u[0] * v[1] - u[1] * v[0]
    const dot = u[0] * v[0] + u[1] * v[1]
    if (coincident(cross, 0)) {
      return undefined
    }
    // tan(turn / 2) = sin(turn) / (1 + cos(turn)), exact for right angles.
    const halfTan = Math.abs(cross) / (1 + dot)
    return { u, v, cross, halfTan, inLength, outLength, wanted: radius * halfTan }
  })
  const wanted = (i: number): number => turns[(i + count) % count]?.wanted ?? 0
  // The room of corner `i` on a side of `length` it shares with corner `j`.
  const share = (i: number, j: number, length: number): number => {
    const total = wanted(i) + wanted(j)
    return total <= length ? wanted(i) : (length * wanted(i)) / total
  }
  return corners.map((corner, i) => {
    const turn = turns[i]
    if (turn === undefined) {
      return undefined
    }
    const { u, v, halfTan } = turn
    const reach = Math.min(
      turn.wanted,
      share(i, i - 1, turn.inLength),
      share(i, i + 1, turn.outLength),
    )
    const size = reach / halfTan
    if (!(size > 0)) {
      return undefined
    }
    const start: XY = [corner[0] - u[0] * reach, corner[1] - u[1] * reach]
    const end: XY = [corner[0] + v[0] * reach, corner[1] + v[1] * reach]
    // The normal at `start` toward the center, on the side the loop turns.
    const side = turn.cross > 0 ? 1 : -1
    const center: XY = [start[0] - side * u[1] * size, start[1] + side * u[0] * size]
    const distance = Math.hypot(corner[0] - center[0], corner[1] - center[1])
    const toward: XY = [(corner[0] - center[0]) / distance, (corner[1] - center[1]) / distance]
    return {
      start,
      end,
      center,
      radius: size,
      toward,
      limit: (start[0] - center[0]) * toward[0] + (start[1] - center[1]) * toward[1],
    }
  })
}

// Whether `point`, on an arc's circle, lies on the arc.
export function onArc(arc: CornerArc, point: XY): boolean {
  const reach =
    (point[0] - arc.center[0]) * arc.toward[0] + (point[1] - arc.center[1]) * arc.toward[1]
  return reach >= arc.limit || coincident(reach, arc.limit)
}

/**
 * Where a port on a side of a rect sits on the rect's shape: the line
 * through the port across the side first meets the outline there, coming
 * in from the side. Without a hit the port stays on the side. A shape whose
 * rounded corners grew it past the rect can only bring the port in, never
 * out past the side.
 *
 * @param outlines - The closed outlines of the shape, in the rect's space.
 * @param radius - The radius of the arcs that round every corner.
 * @param side - The side: `0` top, `1` right, `2` bottom, `3` left.
 * @param along - The port's coordinate along the side: x on the top and
 * bottom, y on the left and right.
 * @param edge - The side's coordinate across it: the rect's top, right,
 * bottom, or left.
 * @returns The port's coordinate across the side.
 */
export function portDepth(
  outlines: ReadonlyArray<ReadonlyArray<XY>>,
  radius: number,
  side: number,
  along: number,
  edge: number,
): number {
  // The axis the line runs along, and the one it holds at `along`. The
  // top and left sides sit at the start of the axis across them.
  const axis = side % 2 === 0 ? 1 : 0
  const held = axis === 0 ? 1 : 0
  const fromStart = side === 0 || side === 3
  let hit: number | undefined
  const meet = (value: number): void => {
    if (hit === undefined || (fromStart ? value < hit : value > hit)) {
      hit = value
    }
  }
  for (const corners of outlines) {
    const arcs = cornerArcs(corners, radius)
    for (const [i, corner] of corners.entries()) {
      const next = (i + 1) % corners.length
      // The side from this corner to the next, between their arcs. An end
      // on the line meets it. Otherwise the side meets it where its ends
      // lie on either side.
      const a = arcs[i]?.end ?? corner
      const b = arcs[next]?.start ?? (corners[next] as XY)
      const aOn = coincident(a[held], along)
      const bOn = coincident(b[held], along)
      if (aOn) {
        meet(a[axis])
      }
      if (bOn) {
        meet(b[axis])
      }
      if (!aOn && !bOn && a[held] < along !== b[held] < along) {
        meet(a[axis] + ((along - a[held]) * (b[axis] - a[axis])) / (b[held] - a[held]))
      }
      // The arc that rounds this corner meets the line where its circle
      // does, on the corner's side of its tangent points. A line that
      // grazes the circle touches it.
      const arc = arcs[i]
      if (arc !== undefined) {
        const offset = along - arc.center[held]
        const squared = arc.radius * arc.radius - offset * offset
        if (squared >= 0 || coincident(Math.abs(offset), arc.radius)) {
          const root = Math.sqrt(Math.max(squared, 0))
          for (const value of [arc.center[axis] - root, arc.center[axis] + root]) {
            if (onArc(arc, axis === 0 ? [value, along] : [along, value])) {
              meet(value)
            }
          }
        }
      }
    }
  }
  return hit === undefined ? edge : fromStart ? Math.max(hit, edge) : Math.min(hit, edge)
}

const AXES: ReadonlyArray<XY> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// The bounds of loops as rounded: the sharp corners, the tangent points of
// the arcs, and the points where the arcs run along an axis.
function roundedBounds(
  loops: ReadonlyArray<ReadonlyArray<XY>>,
  radius: number,
): [left: number, top: number, right: number, bottom: number] {
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  const include = ([x, y]: XY): void => {
    left = Math.min(left, x)
    top = Math.min(top, y)
    right = Math.max(right, x)
    bottom = Math.max(bottom, y)
  }
  for (const loop of loops) {
    const arcs = cornerArcs(loop, radius)
    for (const [i, corner] of loop.entries()) {
      const arc = arcs[i]
      if (arc === undefined) {
        include(corner)
        continue
      }
      include(arc.start)
      include(arc.end)
      for (const [dx, dy] of AXES) {
        const point: XY = [arc.center[0] + dx * arc.radius, arc.center[1] + dy * arc.radius]
        if (onArc(arc, point)) {
          include(point)
        }
      }
    }
  }
  return [left, top, right, bottom]
}

const GROWTH_PASSES = 64

// The least of `tan(turn / 2)` at the two ends of each side, summed: a
// side of length `L` fits both of its corners' arcs whole for radii up to
// `L` over that sum. The largest radius every corner of the loops fits.
function largestRadius(loops: ReadonlyArray<ReadonlyArray<XY>>): number {
  let largest = Number.POSITIVE_INFINITY
  for (const loop of loops) {
    const count = loop.length
    const halfTans = loop.map((corner, i) => {
      const before = loop[(i - 1 + count) % count] as XY
      const after = loop[(i + 1) % count] as XY
      const u: XY = [corner[0] - before[0], corner[1] - before[1]]
      const v: XY = [after[0] - corner[0], after[1] - corner[1]]
      const cross = u[0] * v[1] - u[1] * v[0]
      const dot = u[0] * v[0] + u[1] * v[1]
      const lengths = Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])
      return lengths === 0 || coincident(cross / lengths, 0) ? 0 : Math.abs(cross) / (lengths + dot)
    })
    for (const [i, corner] of loop.entries()) {
      const after = loop[(i + 1) % count] as XY
      const sum = (halfTans[i] as number) + (halfTans[(i + 1) % count] as number)
      if (sum > 0) {
        largest = Math.min(largest, Math.hypot(after[0] - corner[0], after[1] - corner[1]) / sum)
      }
    }
  }
  return largest
}

// Grows loops given in fractions of a box until, rounded to `radius`, they
// fill a box of `width` by `height`, and returns the grown size. The
// growth repeats until the size settles, because rounding depends on the
// angles, which depend on the size.
function grow(
  fractions: ReadonlyArray<ReadonlyArray<XY>>,
  width: number,
  height: number,
  radius: number,
): [width: number, height: number] {
  let w = width
  let h = height
  for (let pass = 0; pass < GROWTH_PASSES; pass++) {
    const [left, top, right, bottom] = roundedBounds(place(fractions, w, h, 0, 0), radius)
    if (!(right > left) || !(bottom > top)) {
      break
    }
    const nextW = (w * width) / (right - left)
    const nextH = (h * height) / (bottom - top)
    const settled = coincident(nextW, w) && coincident(nextH, h)
    w = nextW
    h = nextH
    if (settled) {
      break
    }
  }
  return [w, h]
}

function place(
  fractions: ReadonlyArray<ReadonlyArray<XY>>,
  w: number,
  h: number,
  left: number,
  top: number,
): Array<Array<XY>> {
  return fractions.map((loop) => loop.map(([fx, fy]): XY => [left + fx * w, top + fy * h]))
}

// Places loops given in fractions of a box into the rect at (x, y) of
// `width` by `height`, and returns their corners there with the radius
// they round to. The radius is at most the largest one every corner fits
// whole, so that the rounded outline keeps its shape. The loops then grow,
// and their corners move out past the rect, until the rounded outline
// fills the rect: rounding takes no room from the shape. Growth can
// sharpen corners until they no longer fit the radius, and then the
// radius shrinks to what fits and the loops grow again. A rect is its own
// rounded bounds, so it never grows.
export function fitLoops(
  fractions: ReadonlyArray<ReadonlyArray<XY>>,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): { readonly loops: Array<Array<XY>>; readonly radius: number } {
  const placed = place(fractions, width, height, x, y)
  let used = Math.min(radius, largestRadius(placed))
  if (!(used > 0) || !(width > 0) || !(height > 0)) {
    return { loops: placed, radius: 0 }
  }

  let [w, h] = grow(fractions, width, height, used)
  for (let pass = 0; pass < GROWTH_PASSES; pass++) {
    const fits = largestRadius(place(fractions, w, h, 0, 0))
    if (used <= fits || coincident(used, fits)) {
      break
    }
    used = fits
    ;[w, h] = grow(fractions, width, height, used)
  }
  // Centered, so what is left of the growth's error splits evenly.
  const [left, top, right, bottom] = roundedBounds(place(fractions, w, h, 0, 0), used)
  return {
    loops: place(
      fractions,
      w,
      h,
      x + (width - (right - left)) / 2 - left,
      y + (height - (bottom - top)) / 2 - top,
    ),
    radius: used,
  }
}

// The outlines of a polygon spec in fractions of the rect it fills, before
// any rounding, with its raw fields resolved as `placement/polygon`
// documents.
export function resolveFractions(spec: {
  readonly sides: number
  readonly loops: number
  readonly phase: number
}): Array<Array<XY>> {
  const sides = Number.isFinite(spec.sides) ? Math.max(Math.trunc(spec.sides), 3) : 4
  const loops = Number.isFinite(spec.loops)
    ? Math.max(Math.min(Math.trunc(spec.loops), Math.floor((sides - 1) / 2)), 1)
    : 1
  const phase = Number.isFinite(spec.phase) ? spec.phase - Math.floor(spec.phase) : 0
  return regularLoops(sides, loops, phase)
}

// A polygon spec's corner radius, with negative and non-finite values as 0.
export function resolveRadius(radius: number): number {
  return Number.isFinite(radius) && radius > 0 ? radius : 0
}
