import type { Obstacle } from './graph/graph.ts'

// The orientation vocabulary of the routers: axes, signs, and the sides of a
// rect, with the facts about them that every pass needs.
//
// Axis 0 is x and axis 1 is y, the indices of an `XY`. A pass that works on
// one axis names the two by their roles, `along` for the axis it runs on and
// `across` for the other, and never by a bare `axis`, so that the two never
// swap meaning between files.
//
// Sides are the encodings of `placement/edge`: 0 top, 1 right, 2 bottom, 3
// left, clockwise from the top with the Y axis down. The outward normal of
// a side runs along one axis, and the side itself runs along the other.

/** A point or vector, as `[x, y]`. */
export type XY = readonly [number, number]

/** An axis: `0` for x, `1` for y. */
export type Axis = 0 | 1

/** A direction along an axis. */
export type Sign = 1 | -1

/** The x axis. */
export const X: Axis = 0

/** The y axis. */
export const Y: Axis = 1

/**
 * The other axis.
 *
 * @param axis - An axis.
 * @returns The axis across it.
 */
export const other = (axis: Axis): Axis => (axis === 0 ? 1 : 0)

/**
 * The axis a side's outward normal runs along: y for the top and bottom,
 * x for the right and left.
 *
 * @param side - A side encoding.
 * @returns The axis out of the side.
 */
export const normalAxis = (side: number): Axis => (side % 2 === 0 ? 1 : 0)

/**
 * The axis a side runs along: x for the top and bottom, y for the right and
 * left. Positions along a side increase along it.
 *
 * @param side - A side encoding.
 * @returns The axis along the side.
 */
export const sideAxis = (side: number): Axis => (side % 2 === 0 ? 0 : 1)

/**
 * Which way a side's outward normal points along its axis: toward lesser
 * coordinates for the top and left.
 *
 * @param side - A side encoding.
 * @returns The sign of the normal.
 */
export const outwardSign = (side: number): Sign => (side === 0 || side === 3 ? -1 : 1)

const OUTWARD: ReadonlyArray<XY> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

const ALONG: ReadonlyArray<XY> = [
  [1, 0],
  [0, 1],
  [1, 0],
  [0, 1],
]

/**
 * The unit vector out of a side.
 *
 * @param side - A side encoding.
 * @returns The outward normal.
 */
export const outward = (side: number): XY => OUTWARD[side % 4] as XY

/**
 * The unit vector along a side, toward increasing positions on it.
 *
 * @param side - A side encoding.
 * @returns The direction along the side.
 */
export const along = (side: number): XY => ALONG[side % 4] as XY

/**
 * The lesser bound of a box on an axis: its left or top.
 *
 * @param box - The box.
 * @param axis - The axis.
 * @returns The bound.
 */
export const lo = (box: Obstacle, axis: Axis): number => (axis === 0 ? box.left : box.top)

/**
 * The greater bound of a box on an axis: its right or bottom.
 *
 * @param box - The box.
 * @param axis - The axis.
 * @returns The bound.
 */
export const hi = (box: Obstacle, axis: Axis): number => (axis === 0 ? box.right : box.bottom)

/**
 * A point from its coordinate on one axis and on the other.
 *
 * @param axis - The axis the first coordinate lies on.
 * @param on - The coordinate on that axis.
 * @param across - The coordinate on the other axis.
 * @returns The point.
 */
export const pointOn = (axis: Axis, on: number, across: number): XY =>
  axis === 0 ? [on, across] : [across, on]

/**
 * A box from its extent on one axis and on the other.
 *
 * @param axis - The axis the first extent lies on.
 * @param on - The lesser and greater bounds on that axis.
 * @param across - The lesser and greater bounds on the other axis.
 * @returns The box.
 */
export const boxOn = (
  axis: Axis,
  on: readonly [number, number],
  across: readonly [number, number],
): Obstacle =>
  axis === 0
    ? { left: on[0], right: on[1], top: across[0], bottom: across[1] }
    : { left: across[0], right: across[1], top: on[0], bottom: on[1] }

/**
 * The box around a segment, grown by `half` on every side: the stroke of a
 * route segment, or the segment itself with `half` `0`.
 *
 * @param a - One end of the segment.
 * @param b - The other end.
 * @param half - How far the box reaches past the segment on each side.
 * @returns The box.
 */
export const segmentBox = (a: XY, b: XY, half = 0): Obstacle => ({
  left: Math.min(a[0], b[0]) - half,
  right: Math.max(a[0], b[0]) + half,
  top: Math.min(a[1], b[1]) - half,
  bottom: Math.max(a[1], b[1]) + half,
})

/**
 * The heading of a segment as signs, `[0, 0]` for a segment without length.
 *
 * @param a - The start of the segment.
 * @param b - Its end.
 * @returns The sign of the step along each axis.
 */
export const headingOf = (a: XY, b: XY): XY => [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])]

/**
 * Which way a turn from one heading to the next goes, with the Y axis down:
 * a positive cross product turns clockwise, to the right.
 *
 * @param from - The heading in.
 * @param to - The heading out.
 * @returns `1` for a turn to the right, `-1` for one to the left, and `0`
 * for straight on or back.
 */
export const turnOf = (from: XY, to: XY): number => Math.sign(from[0] * to[1] - from[1] * to[0])

/**
 * A length with unusable values as none: negative, `NaN`, and infinite
 * values act as `0`.
 *
 * @param value - The raw length.
 * @returns The length, or `0`.
 */
export const positiveLength = (value: number | undefined): number =>
  value !== undefined && Number.isFinite(value) && value > 0 ? value : 0
