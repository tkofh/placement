import type * as Point from 'placement/point'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useHierarchyEdge, useHierarchyPercentBasis } from '../composables/useHierarchy.ts'
import { PAINT_PROP_KEYS, type PaintProps } from '../composables/usePaint.ts'
import { finiteNumber } from '../internal/curve.ts'
import { useEdgeRenderer } from '../internal/edge.ts'
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
   * Rounds the route's corners to at least this radius, which the layout
   * keeps room for along the flow and out of each port. Corners grow where
   * the edge turns outside others that turn with it, so that they nest
   * about one center, and shrink only where a leg between nodes is too
   * short or an adornment sits close. Percentages resolve against the
   * width of the layout's parent.
   */
  r?: LengthPercentageInput
  /**
   * How much each rounded corner eases its curvature in, from `0`
   * (default, circular corners) to `1` (fully smoothed, squircle-like). A
   * smoothed corner reaches `1 + smoothing` radii along its legs, and a
   * crowded one gives up smoothing before radius.
   */
  smoothing?: SmoothingInput
}

export const HierarchyEdge = defineComponent(
  (props: HierarchyEdgeProps, { slots }) => {
    // Percentages resolve against the layout's parent, as node sizes do,
    // because the radius sizes the layout itself.
    const basis = useHierarchyPercentBasis().width
    const radius = useLengthPercentage(() => props.r, 0, basis)
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
        smoothing: smoothing.value,
      }),
    )

    // The drawn line stops short of each end by the length of the trimming
    // adornments there, and each corner takes the size the layout solved.
    return useEdgeRenderer(props, slots, solution, radius, smoothing)
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
