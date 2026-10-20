import { Vector2 } from 'curvy/vector'
import * as Polygon from 'placement/polygon'
import { computed, defineComponent, h } from 'vue'
import { useOutline } from '../composables/useOutline.ts'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { RECT_PROP_KEYS, type RectProps, fillsParent, useRect } from '../composables/useRect.ts'
import { curvePathData, finiteNumber } from '../internal/curve.ts'
import { type RatioInput, resolveRatio } from '../internal/props/ratio.ts'
import { type SmoothingInput, resolveSmoothing } from '../internal/props/smoothing.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export interface GraphicPolygonProps extends PaintProps, RectProps {
  /**
   * The number of corners, at least `3`. Defaults to `4`. The polygon is
   * regular, stretched to fill its box, with a flat top edge.
   */
  sides?: number | `${number}`
  /**
   * How many times the outline winds around the center. Past `1`, each
   * corner joins the corner `loops` places on, which draws a star polygon:
   * `sides="5" loops="2"` is a pentagram. Defaults to `1`. See `Polygon`
   * in `placement/polygon`.
   */
  loops?: number | `${number}`
  /**
   * How far each corner slides along its edge toward the next, as a ratio
   * (`0.5` or `'50%'`). The base polygon has a flat top, so a phase of
   * `0.5` puts a corner on top: a rect becomes a diamond, and a triangle
   * points up. Defaults to `0`.
   */
  phase?: RatioInput
  /**
   * Rounds the corners to this radius. The polygon grows so that its
   * rounded outline still fills its box, so rounding a diamond keeps its
   * tips on the box. The radius is at most what every corner fits.
   * Percentages resolve against the width of its parent.
   */
  r?: LengthPercentageInput
  /**
   * How much each rounded corner eases its curvature in, from `0`
   * (default, circular corners) to `1` (fully smoothed, squircle-like).
   */
  smoothing?: SmoothingInput
}

export const GraphicPolygon = defineComponent(
  (props: GraphicPolygonProps) => {
    const self = useRect(props)

    const radius = useLengthPercentage(() => props.r, 0, 'width')

    const paint = usePaint(props)

    const polygon = computed(() =>
      Polygon.make({
        sides: finiteNumber(props.sides),
        loops: finiteNumber(props.loops),
        phase: resolveRatio(props.phase, 0),
        radius: radius.value,
      }),
    )

    // A polygon that fills a hierarchy node gives the node its outline, so
    // edges meet it at its tips and on its sides.
    useOutline(() => (fillsParent(props) ? polygon.value : undefined))

    const pathData = computed(() => {
      const { outlines, radius: used } = Polygon.apply(polygon.value, self.value)
      const smoothing = resolveSmoothing(props.smoothing)
      const parts: Array<string> = []
      for (const outline of outlines) {
        const d = curvePathData(
          'linear',
          'duplicate',
          outline.map(({ x, y }) => Vector2.make(x, y)),
          { radius: used, smoothing, closed: true },
        )
        if (d !== undefined) {
          parts.push(`${d} Z`)
        }
      }
      return parts.length === 0 ? undefined : parts.join(' ')
    })

    return () => {
      const d = pathData.value
      return d === undefined ? null : h('path', { d, ...paint.value })
    }
  },
  {
    name: 'GraphicPolygon',
    props: [...RECT_PROP_KEYS, ...PAINT_PROP_KEYS, 'sides', 'loops', 'phase', 'r', 'smoothing'],
  },
)
