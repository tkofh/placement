import * as Point from 'placement/point'

// The line an edge draws: its route pulled back from each end to make room
// for the adornments there, with the size each corner may take.

// Pulls the end of a polyline back by `length`, dropping the points it
// passes, and their values per point (corner sizes and nest insets) with
// them. A line shorter than `length` keeps only its first point twice, so
// it still draws nothing longer than itself.
function trimEnd(
  points: ReadonlyArray<Point.Point>,
  values: ReadonlyArray<ReadonlyArray<number>>,
  length: number,
): [Array<Point.Point>, Array<Array<number>>] {
  const result = [...points]
  const lists = values.map((list) => [...list])
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
    for (const list of lists) {
      list.pop()
    }
  }
  for (const list of lists) {
    if (list.length > 0) {
      list[list.length - 1] = 0
    }
  }
  return [result, lists]
}

/**
 * A drawn line: its points, the most each of its corners may reach along
 * its legs, and how far inside the outermost corner of its nest each sits.
 */
export interface DrawnLine {
  readonly points: ReadonlyArray<Point.Point>
  readonly rooms: ReadonlyArray<number>
  readonly nests: ReadonlyArray<number>
}

/**
 * The line an edge draws: its route pulled back from each end by `insets`.
 *
 * @param route - The route's points.
 * @param radii - The size of the route's corner at each point.
 * @param insets - How far each end of the line stops short of the route's.
 * @param nests - How far inside the outermost corner of its nest the corner
 * at each point sits, `0` for none.
 * @returns The drawn line.
 */
export function drawnLine(
  route: ReadonlyArray<Point.Point>,
  radii: ReadonlyArray<number>,
  insets: { readonly start: number; readonly end: number },
  nests: ReadonlyArray<number> = route.map(() => 0),
): DrawnLine {
  const [points, lists] = trimEnd(route, [radii, nests], insets.end)
  const [reversed, back] = trimEnd(
    points.toReversed(),
    lists.map((list) => list.toReversed()),
    insets.start,
  )
  const [rooms, nested] = back.map((list) => list.toReversed()) as [Array<number>, Array<number>]
  return { points: reversed.toReversed(), rooms, nests: nested }
}
