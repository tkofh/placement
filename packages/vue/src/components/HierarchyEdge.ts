import { Vector2 } from 'curvy/vector'
import type { Point } from 'placement/point'
import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, Fragment, computed, defineComponent, h } from 'vue'
import { useHierarchyEdge } from '../composables/useHierarchy.ts'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { curveOptions, curvePathData, finiteNumber } from '../internal/curve.ts'
import { type PortInput, resolvePort } from '../internal/props/port.ts'
import { type SmoothingInput, resolveSmoothing } from '../internal/props/smoothing.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export type HierarchyEdgeCurve = 'linear' | 'basis' | 'cardinal'

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
   * How the route is drawn: `'linear'` (default) is the polyline, with
   * corners rounded by `r` and `smoothing`, `'basis'` smooths past its
   * corners, and `'cardinal'` curves through them.
   */
  curve?: HierarchyEdgeCurve
  /** Rounds the corners of a `'linear'` route to this radius. */
  r?: LengthPercentageInput
  /**
   * How much each rounded corner eases its curvature in, from `0`
   * (default, circular corners) to `1` (fully smoothed, squircle-like).
   */
  smoothing?: SmoothingInput
  /** Cardinal tension: `0.5` (default) is Catmull-Rom. */
  tension?: number | `${number}`
  /** Cardinal parameterization: `0` uniform, `0.5` centripetal (default), `1` chordal. */
  alpha?: number | `${number}`
}

export const HierarchyEdge = defineComponent(
  (props: HierarchyEdgeProps, { slots, attrs }) => {
    const route = useHierarchyEdge(() => {
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
    })

    const radius = useLengthPercentage(() => props.r, 0, 'width')

    const options = computed(() => ({
      ...curveOptions(props.tension, props.alpha),
      radius: radius.value,
      smoothing: resolveSmoothing(props.smoothing),
    }))

    const pathData = computed(() =>
      curvePathData(
        props.curve ?? 'linear',
        'duplicate',
        route.value.points.map((point) => Vector2.make(point.x, point.y)),
        options.value,
      ),
    )

    const paint = usePaint(props)

    return () => {
      const d = pathData.value
      // The path renders first, so labels drawn in the slot sit on top of it.
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
        slots.default?.({ points: route.value.points, labels: route.value.labels }),
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
      'curve',
      'r',
      'smoothing',
      'tension',
      'alpha',
      ...PAINT_PROP_KEYS,
    ],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: {
        points: ReadonlyArray<Point>
        labels: ReadonlyArray<Rect>
      }) => Array<VNode>
    }>,
  },
)
