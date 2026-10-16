import { oneOf, parse } from 'valued'
import { lengthPercentage } from 'valued/data/length-percentage'
import { isNumberValue, number } from 'valued/data/number'
import { createCache } from '../cache.ts'

// One coordinate of a polygon point: a length in px (or a unitless number)
// or a percentage of the box along its axis.
const coordinate = oneOf([lengthPercentage.subset(['%', 'px']), number()])

/** A polygon coordinate: `value` px, or `value` percent of the box when `percent`. */
export interface PolygonCoordinate {
  readonly value: number
  readonly percent: boolean
}

/** The points of a polygon, as `[x, y]` coordinate pairs. */
export type PolygonPoints = ReadonlyArray<readonly [PolygonCoordinate, PolygonCoordinate]>

const cache = createCache<string, PolygonPoints | null>(128)

/**
 * Parses polygon points in the form of CSS `polygon()`: comma-separated
 * pairs of lengths or percentages, such as `'0% 0%, 100% 50%, 0% 100%'`.
 *
 * @param input - The point list.
 * @returns The coordinate pairs, or `null` when the input does not parse.
 */
export function parsePolygon(input: string): PolygonPoints | null {
  return cache(input, () => {
    const points: Array<readonly [PolygonCoordinate, PolygonCoordinate]> = []
    for (const pair of input.split(',')) {
      const parts = pair.trim().split(/\s+/)
      if (parts.length !== 2) {
        return null
      }
      const coordinates: Array<PolygonCoordinate> = []
      for (const part of parts) {
        const parsed = parse(part, coordinate)
        if (!parsed.valid) {
          return null
        }
        const value = parsed.value
        coordinates.push(
          isNumberValue(value)
            ? { value: value.value, percent: false }
            : { value: value.value, percent: value.unit === '%' },
        )
      }
      points.push([coordinates[0] as PolygonCoordinate, coordinates[1] as PolygonCoordinate])
    }
    return points
  })
}
