import * as Connector from 'placement/connector'
import type * as Point from 'placement/point'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useConnectorEdge } from '../composables/useConnector.ts'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { useEdgeRenderer } from '../internal/edge.ts'
import { type PortInput, resolvePort } from '../internal/props/port.ts'
import { type RatioInput, resolveRatio } from '../internal/props/ratio.ts'
import { type SmoothingInput, resolveSmoothing } from '../internal/props/smoothing.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export type ConnectorEdgeTurn = keyof typeof Connector.turn

/**
 * The props of `ConnectorEdge`. The width of its `stroke` (1 for a stroke
 * without one) is the edge's thickness, which the layout keeps its gaps
 * and clearance between, unless `thickness` says otherwise.
 */
export interface ConnectorEdgeProps extends PaintProps {
  /** The `id` of the node the edge leaves. */
  from?: string
  /** The `id` of the node the edge enters. */
  to?: string
  /**
   * The port on the source node: a side (`'top'`, `'right'`, `'bottom'`,
   * `'left'`, or `'auto'`), a position along the side as a ratio, or both
   * (`'right 25%'`). An auto side is the side of the cheapest route, and
   * auto positions on a shared side spread out evenly.
   */
  fromPort?: PortInput
  /** The port on the target node, in the same form as `fromPort`. */
  toPort?: PortInput
  /**
   * Points the route passes through, in order, in the coordinates that
   * rects resolve in.
   */
  via?: ReadonlyArray<Point.PointLike>
  /**
   * The way the route prefers to turn at its corners: `'none'` (default),
   * `'clockwise'`, or `'counterclockwise'`. A corner against it costs the
   * layout's `bendCost` over again.
   */
  turn?: ConnectorEdgeTurn
  /**
   * Where the route's jogs sit along the runs they shift: `'start'` (the
   * source end), `'center'`, `'end'` (the target end), or a ratio. Omitted,
   * it takes the layout's `jogAt`.
   */
  jogAt?: RatioInput
  /**
   * Rounds the route's corners to at least this radius. Corners grow where
   * the edge turns outside others that turn with it, so that they nest
   * about one center, and shrink only where a leg is too short or a flow
   * adornment sits close. Percentages resolve against the width of the
   * edge's parent.
   */
  r?: LengthPercentageInput
  /**
   * How much each rounded corner eases its curvature in, from `0`
   * (default, circular corners) to `1` (fully smoothed, squircle-like). A
   * smoothed corner reaches `1 + smoothing` radii along its legs, and a
   * crowded one gives up smoothing before radius.
   */
  smoothing?: SmoothingInput
  /**
   * The width the layout routes the edge as, in place of its stroke's: set
   * it to keep routes still while the stroke changes, as on hover.
   * Percentages resolve against the width of the edge's parent.
   */
  thickness?: LengthPercentageInput
}

export const ConnectorEdge = defineComponent(
  (props: ConnectorEdgeProps, { slots }) => {
    const radius = useLengthPercentage(() => props.r, 0)
    const smoothing = computed(() => resolveSmoothing(props.smoothing))
    // The stroke's width, which SVG draws as 1 when a stroke leaves it out.
    const paint = usePaint(props)
    const pinned = useLengthPercentage(() => props.thickness, Number.NaN)
    const thickness = computed(() => {
      if (Number.isFinite(pinned.value)) {
        return Math.max(pinned.value, 0)
      }
      const { stroke, 'stroke-width': width } = paint.value
      if (stroke === undefined) {
        return 0
      }
      const value = width === undefined ? 1 : Number.parseFloat(width)
      return Number.isFinite(value) && value > 0 ? value : 0
    })

    const solution = useConnectorEdge(
      () => {
        const source = resolvePort(props.fromPort)
        const target = resolvePort(props.toPort)
        return {
          source: props.from ?? '',
          target: props.to ?? '',
          sourceSide: source.side,
          sourceAt: source.at,
          targetSide: target.side,
          targetAt: target.at,
          via: props.via,
          turn: Connector.turn[props.turn ?? 'none'] ?? Connector.turn.none,
          jogAt: resolveRatio(props.jogAt, Number.NaN),
        }
      },
      () => ({ radius: radius.value, smoothing: smoothing.value, thickness: thickness.value }),
    )

    // The drawn line stops short of each end by the length of the trimming
    // adornments there, and each corner takes the size the layout solved.
    return useEdgeRenderer(props, slots, solution, radius, smoothing)
  },
  {
    name: 'ConnectorEdge',
    props: [
      'from',
      'to',
      'fromPort',
      'toPort',
      'via',
      'turn',
      'jogAt',
      'r',
      'smoothing',
      'thickness',
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
