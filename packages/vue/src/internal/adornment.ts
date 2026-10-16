import * as Point from 'placement/point'

// The line an edge draws: its route pulled back from each end to make room
// for the adornments there, with the size each corner may take.

// Pulls the end of a polyline back by `length`, dropping the points it
// passes, and the corner sizes with them. A line shorter than `length` keeps
// only its first point twice, so it still draws nothing longer than itself.
function trimEnd(
  points: ReadonlyArray<Point.Point>,
  radii: ReadonlyArray<number>,
  length: number,
): [Array<Point.Point>, Array<number>] {
  const result = [...points]
  const sizes = [...radii]
  let remaining = length
  while (remaining > 0 && result.length >= 2) {
    const tip = result[result.length - 1] as Point.Point
    const from = result[result.length - 2] as Point.Point
    const segment = Point.distance(from, tip)
    if (segment > remaining) {
      const t = remaining / segment
      result[result.length - 1] = Point.make(
        tip.x + (from.x - tip.x) * t,
        tip.y + (from.y - tip.y) * t,
      )
      break
    }
    remaining -= segment
    if (result.length === 2) {
      result[1] = from
      break
    }
    result.pop()
    sizes.pop()
  }
  if (sizes.length > 0) {
    sizes[sizes.length - 1] = 0
  }
  return [result, sizes]
}

/** A drawn line: its points, and the most each of its corners may reach along its legs. */
export interface DrawnLine {
  readonly points: ReadonlyArray<Point.Point>
  readonly rooms: ReadonlyArray<number>
}

/**
 * The line an edge draws: its route pulled back from each end by `insets`.
 *
 * @param route - The route's points.
 * @param radii - The size of the route's corner at each point.
 * @param insets - How far each end of the line stops short of the route's.
 * @returns The drawn line.
 */
export function drawnLine(
  route: ReadonlyArray<Point.Point>,
  radii: ReadonlyArray<number>,
  insets: { readonly start: number; readonly end: number },
): DrawnLine {
  const [points, rooms] = trimEnd(route, radii, insets.end)
  const [reversed, reversedRooms] = trimEnd(points.toReversed(), rooms.toReversed(), insets.start)
  return { points: reversed.toReversed(), rooms: reversedRooms.toReversed() }
}
