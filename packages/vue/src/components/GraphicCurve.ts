import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Basis2d, Bezier2d, Cardinal2d, Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import { Fragment, computed, defineComponent, h } from 'vue'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { usePointList } from '../composables/usePointList.ts'
import { useParentX, useParentY } from '../composables/useSizingContext.ts'
import { finiteNumber } from '../internal/curve.ts'
import { boolProp } from '../internal/utils.ts'

export type CurveKind = 'cardinal' | 'basis' | 'bezier' | 'linear'

export type CurveEnds = 'duplicate' | 'reflect' | 'interpolate' | 'natural'

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

// The minimum count of registered points for each family. Below it, the
// component does not draw the path (points mount progressively).
function hasEnoughPoints(kind: CurveKind, ends: CurveEnds, count: number): boolean {
  switch (kind) {
    case 'basis':
    case 'cardinal':
      return count >= (ends === 'natural' ? 4 : 2)
    case 'bezier':
      return count >= 4 && count % 3 === 1
    default:
      return count >= 2
  }
}

export const GraphicCurve = defineComponent(
  (props: GraphicCurveProps, { slots, attrs }) => {
    const points = usePointList()

    const parentX = useParentX()
    const parentY = useParentY()

    const vectors = computed(() =>
      points.value.map((point) => Vector2.make(point.x + parentX.value, point.y + parentY.value)),
    )

    const options = computed(() => {
      const resolved: { tension?: number; alpha?: number } = {}
      const tension = finiteNumber(props.tension)
      const alpha = finiteNumber(props.alpha)
      if (tension !== undefined) {
        resolved.tension = tension
      }
      if (alpha !== undefined) {
        resolved.alpha = alpha
      }
      return resolved
    })

    const pathData = computed(() => {
      const kind = props.curve ?? 'cardinal'
      const ends = props.ends ?? 'duplicate'
      const controls = vectors.value

      if (!hasEnoughPoints(kind, ends, controls.length)) {
        return undefined
      }

      switch (kind) {
        case 'linear':
          return LinearPath2d.toPathData(Linear2d.toPath(Linear2d.fromArray(controls)))
        case 'basis': {
          // Basis2d.fromArray requires four control points, so endpoint
          // triplication pads the array before construction.
          const padded =
            ends === 'natural'
              ? controls
              : [controls[0]!, controls[0]!, ...controls, controls.at(-1)!, controls.at(-1)!]
          return CubicPath2d.toPathData(Basis2d.toPath(Basis2d.fromArray(padded)))
        }
        case 'bezier':
          return CubicPath2d.toPathData(Bezier2d.toPath(Bezier2d.fromArray(controls)))
        default: {
          const spline = Cardinal2d.fromArray(controls, options.value)
          const padded =
            ends === 'reflect'
              ? Cardinal2d.withReflectedEndpoints(spline)
              : ends === 'interpolate'
                ? Cardinal2d.withInterpolatedEndpoints(spline)
                : ends === 'natural'
                  ? spline
                  : Cardinal2d.withDuplicatedEndpoints(spline)
          return CubicPath2d.toPathData(Cardinal2d.toPath(padded))
        }
      }
    })

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
