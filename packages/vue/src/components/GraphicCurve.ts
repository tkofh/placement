import { Vector2 } from 'curvy/vector'
import { Fragment, computed, defineComponent, h } from 'vue'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { usePointList } from '../composables/usePointList.ts'
import { useParentX, useParentY } from '../composables/useSizingContext.ts'
import { type CurveEnds, type CurveKind, curveOptions, curvePathData } from '../internal/curve.ts'
import { type SmoothingInput, resolveSmoothing } from '../internal/props/smoothing.ts'
import { boolProp } from '../internal/utils.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export type { CurveEnds, CurveKind }

export interface GraphicCurveProps extends PaintProps {
  /**
   * The spline family drawn through the `GraphicPoint` children:
   * `'cardinal'` (default) interpolates every point, `'basis'` smooths
   * past them, `'bezier'` reads them as cubic control points (it needs
   * 3n+1), and `'linear'` is a polyline.
   */
  curve?: CurveKind
  /**
   * How the curve treats its first and last points. Cardinal and basis
   * splines span only their interior control points. To pull the curve
   * through every point, `'duplicate'` (default), `'reflect'`, and
   * `'interpolate'` pad the endpoints. `'natural'` leaves the control
   * points as authored, so the curve starts at the second point and needs
   * four. `'bezier'` and `'linear'` ignore this prop. Basis treats every
   * padding choice as endpoint triplication.
   */
  ends?: CurveEnds
  /** Cardinal tension: `0.5` (default) is Catmull-Rom. */
  tension?: number | `${number}`
  /** Cardinal parameterization: `0` uniform, `0.5` centripetal (default), `1` chordal. */
  alpha?: number | `${number}`
  /**
   * Closes the path back to its first point with a straight edge. A
   * rounded linear curve rounds the closing corners too.
   */
  closed?: boolean
  /** Rounds the corners of a `'linear'` curve to this radius. Other curves ignore it. */
  r?: LengthPercentageInput
  /**
   * How much each rounded corner eases its curvature in, from `0`
   * (default, circular corners) to `1` (fully smoothed, squircle-like).
   * Numbers and percentages both work.
   */
  smoothing?: SmoothingInput
}

export const GraphicCurve = defineComponent(
  (props: GraphicCurveProps, { slots, attrs }) => {
    const points = usePointList()

    const parentX = useParentX()
    const parentY = useParentY()

    const vectors = computed(() =>
      points.value.map((point) => Vector2.make(point.x + parentX.value, point.y + parentY.value)),
    )

    const radius = useLengthPercentage(() => props.r, 0, 'width')

    const options = computed(() => ({
      ...curveOptions(props.tension, props.alpha),
      radius: radius.value,
      smoothing: resolveSmoothing(props.smoothing),
      closed: boolProp(props.closed),
    }))

    const pathData = computed(() =>
      curvePathData(
        props.curve ?? 'cardinal',
        props.ends ?? 'duplicate',
        vectors.value,
        options.value,
      ),
    )

    const paint = usePaint(props)

    return () => {
      const d = pathData.value
      return h(Fragment, {}, [
        slots.default?.(),
        d === undefined
          ? null
          : h('path', {
              d: boolProp(props.closed) ? `${d} Z` : d,
              ...attrs,
              ...paint.value,
              // An SVG path with no fill attribute fills black. A curve
              // through points is a stroke by default.
              fill: paint.value.fill ?? 'none',
            }),
      ])
    }
  },
  {
    name: 'GraphicCurve',
    props: ['curve', 'ends', 'tension', 'alpha', 'closed', 'r', 'smoothing', ...PAINT_PROP_KEYS],
    inheritAttrs: false,
  },
)
