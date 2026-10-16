import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import type * as Point from 'placement/point'
import { type SlotsType, type VNode, Fragment, computed, defineComponent, h } from 'vue'
import { useHierarchyEdge, useHierarchyPercentBasis } from '../composables/useHierarchy.ts'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { roundPolyline } from '../internal/corners.ts'
import { finiteNumber } from '../internal/curve.ts'
import { type PortInput, resolvePort } from '../internal/props/port.ts'
import { type SmoothingInput, resolveSmoothing } from '../internal/props/smoothing.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export interface HierarchyEdgeProps extends PaintProps {
  /** The `id` of the node the edge leaves. */
  from?: string
  /** The `id` of the node the edge enters. */
  to?: string
  /**
   * The port on the source node: a side (`'top'`, `'right'`, `'bottom'`,
   * `'left'`, or `'auto'`), a position along the side as a ratio, or both
   * (`'right 25%'`). Omitted parts are auto.
   */
  fromPort?: PortInput
  /** The port on the target node, in the same form as `fromPort`. */
  toPort?: PortInput
  /** How strongly the layout keeps the edge short and straight. Defaults to `1`. */
  weight?: number | `${number}`
  /** The minimum number of ranks the edge spans. Defaults to `1`. */
  minLength?: number | `${number}`
  /**
   * Rounds the route's corners to this radius where it has room. Corners
   * shrink where a leg is short or an adornment sits close. Percentages
   * resolve against the width of the layout's parent.
   */
  r?: LengthPercentageInput
  /**
   * The least corner radius the layout keeps room for along the flow and
   * out of each port, up to `r`. Defaults to `0`.
   */
  minR?: LengthPercentageInput
  /**
   * How much each rounded corner eases its curvature in, from `0`
   * (default, circular corners) to `1` (fully smoothed, squircle-like). A
   * smoothed corner reaches `1 + smoothing` radii along its legs, and a
   * crowded one gives up smoothing before radius.
   */
  smoothing?: SmoothingInput
}

export const HierarchyEdge = defineComponent(
  (props: HierarchyEdgeProps, { slots, attrs }) => {
    // Percentages resolve against the layout's parent, as node sizes do,
    // because the radius sizes the layout itself.
    const basis = useHierarchyPercentBasis().width
    const radius = useLengthPercentage(() => props.r, 0, basis)
    const minRadius = useLengthPercentage(() => props.minR, 0, basis)
    const smoothing = computed(() => resolveSmoothing(props.smoothing))

    const solution = useHierarchyEdge(
      () => {
        const source = resolvePort(props.fromPort)
        const target = resolvePort(props.toPort)
        return {
          source: props.from ?? '',
          target: props.to ?? '',
          weight: finiteNumber(props.weight),
          minLength: finiteNumber(props.minLength),
          sourceSide: source.side,
          sourceAt: source.at,
          targetSide: target.side,
          targetAt: target.at,
        }
      },
      () => ({
        radius: radius.value,
        minRadius: Math.min(minRadius.value, radius.value),
        smoothing: smoothing.value,
      }),
    )

    // The drawn line stops short of each end by the length of the trimming
    // adornments there, and each corner takes the size the layout solved.
    const pathData = computed(() => {
      const { points, rooms } = solution.value.line
      if (points.length < 2) {
        return undefined
      }
      if (radius.value > 0) {
        const rounded = roundPolyline(points, radius.value, smoothing.value, false, rooms)
        return rounded === undefined ? undefined : CubicPath2d.toPathData(rounded)
      }
      const vectors = points.map((point) => Vector2.make(point.x, point.y))
      return LinearPath2d.toPathData(Linear2d.toPath(Linear2d.fromArray(vectors)))
    })

    const paint = usePaint(props)

    return () => {
      const d = pathData.value
      const route = solution.value.route
      // The path renders first, so adornments drawn in the slot sit on top of it.
      return h(Fragment, {}, [
        d === undefined
          ? null
          : h('path', {
              d,
              ...attrs,
              ...paint.value,
              // An SVG path with no fill attribute fills black. An edge is a
              // stroke by default.
              fill: paint.value.fill ?? 'none',
            }),
        slots.default?.({ points: route.points, radii: route.radii }),
      ])
    }
  },
  {
    name: 'HierarchyEdge',
    props: [
      'from',
      'to',
      'fromPort',
      'toPort',
      'weight',
      'minLength',
      'r',
      'minR',
      'smoothing',
      ...PAINT_PROP_KEYS,
    ],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: {
        points: ReadonlyArray<Point.Point>
        radii: ReadonlyArray<number>
      }) => Array<VNode>
    }>,
  },
)
