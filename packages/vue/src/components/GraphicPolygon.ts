import { Vector2 } from 'curvy/vector'
import { computed, defineComponent, h } from 'vue'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect.ts'
import { curvePathData } from '../internal/curve.ts'
import { type PolygonCoordinate, parsePolygon } from '../internal/props/polygon.ts'
import { type SmoothingInput, resolveSmoothing } from '../internal/props/smoothing.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export interface GraphicPolygonProps extends PaintProps, RectProps {
  /**
   * The corners, in the form of CSS `polygon()`: comma-separated `x y`
   * pairs of lengths or percentages of the polygon's box, such as
   * `'0% 0%, 100% 50%, 0% 100%'` for a triangle pointing right. The
   * outline closes back to the first point.
   */
  points?: string
  /** Rounds the corners to this radius. */
  r?: LengthPercentageInput
  /**
   * How much each rounded corner eases its curvature in, from `0`
   * (default, circular corners) to `1` (fully smoothed, squircle-like).
   */
  smoothing?: SmoothingInput
}

// A coordinate in px, from a percentage of `basis` or as written.
function resolve(coordinate: PolygonCoordinate, basis: number): number {
  return coordinate.percent ? (coordinate.value * basis) / 100 : coordinate.value
}

export const GraphicPolygon = defineComponent(
  (props: GraphicPolygonProps) => {
    const self = useRect(props)

    const radius = useLengthPercentage(() => props.r, 0, 'width')

    const paint = usePaint(props)

    const pathData = computed(() => {
      const points = props.points === undefined ? null : parsePolygon(props.points)
      if (points === null || points.length < 2) {
        return undefined
      }
      const { x, y, width, height } = self.value
      const d = curvePathData(
        'linear',
        'duplicate',
        points.map(([px, py]) => Vector2.make(x + resolve(px, width), y + resolve(py, height))),
        { radius: radius.value, smoothing: resolveSmoothing(props.smoothing), closed: true },
      )
      return d === undefined ? undefined : `${d} Z`
    })

    return () => {
      const d = pathData.value
      return d === undefined ? null : h('path', { d, ...paint.value })
    }
  },
  {
    name: 'GraphicPolygon',
    props: [...RECT_PROP_KEYS, ...PAINT_PROP_KEYS, 'points', 'r', 'smoothing'],
  },
)
