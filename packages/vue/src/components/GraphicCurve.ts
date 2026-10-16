import { Vector2 } from 'curvy/vector'
import { Fragment, computed, defineComponent, h } from 'vue'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { usePointList } from '../composables/usePointList.ts'
import { useParentX, useParentY } from '../composables/useSizingContext.ts'
import { type CurveEnds, type CurveKind, curveOptions, curvePathData } from '../internal/curve.ts'
import { boolProp } from '../internal/utils.ts'

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
  /** Closes the path back to its first point with a straight edge. */
  closed?: boolean
}

export const GraphicCurve = defineComponent(
  (props: GraphicCurveProps, { slots, attrs }) => {
    const points = usePointList()

    const parentX = useParentX()
    const parentY = useParentY()

    const vectors = computed(() =>
      points.value.map((point) => Vector2.make(point.x + parentX.value, point.y + parentY.value)),
    )

    const options = computed(() => curveOptions(props.tension, props.alpha))

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
    props: ['curve', 'ends', 'tension', 'alpha', 'closed', ...PAINT_PROP_KEYS],
    inheritAttrs: false,
  },
)
