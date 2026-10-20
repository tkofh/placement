import * as Hierarchy from 'placement/hierarchy'
import * as Point from 'placement/point'
import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useHierarchyLayout } from '../composables/useHierarchy.ts'
import {
  INSET_PROP_KEYS,
  type InsetProps,
  TRANSFORM_PROP_KEYS,
  type TransformProps,
  useRect,
} from '../composables/useRect.ts'
import {
  useParentHeight,
  useParentRectRegistration,
  useParentWidth,
} from '../composables/useSizingContext.ts'
import { keywordResults } from '../internal/props/alignItems.ts'
import { type RatioInput, resolveRatio } from '../internal/props/ratio.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { type AlignItemsInput, useAlignItems } from '../props/alignItems.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export type HierarchyDirectionInput = keyof typeof Hierarchy.direction

export type HierarchyBackEdgesInput = keyof typeof Hierarchy.backEdges

export interface HierarchyLayoutProps extends InsetProps, TransformProps {
  /** A prebuilt spec. When set, it replaces every other layout prop. */
  layout?: Hierarchy.Hierarchy
  /** The direction edges flow in: `'down'` (default), `'up'`, `'right'`, or `'left'`. */
  direction?: HierarchyDirectionInput
  /**
   * How back edges (the edges that point against the flow) attach:
   * `'direct'` (default) runs them straight back against the flow, and
   * `'loop'` leaves the source downstream and loops around into the target
   * from upstream. Edges with an explicit side keep it.
   */
  backEdges?: HierarchyBackEdgesInput
  /** The space between adjacent ranks. Percentages resolve against the parent along the flow. */
  rankGap?: LengthPercentageInput
  /** The space between adjacent nodes in a rank. Percentages resolve across the flow. */
  nodeGap?: LengthPercentageInput
  /** The space between parallel edges and between edge ports. Percentages resolve across the flow. */
  edgeGap?: LengthPercentageInput
  /** How nodes sit in the thickness of their rank. Defaults to `'center'`. */
  alignItems?: AlignItemsInput
  /** Which side of their edge adornments sit on: `'start'`, `'center'` (default), `'end'`, or a ratio. */
  alignAdornments?: RatioInput
  debug?: boolean
}

export const HierarchyLayout = defineComponent(
  (props: HierarchyLayoutProps, { expose }) => {
    const parentWidth = useParentWidth()
    const parentHeight = useParentHeight()

    const direction = computed(() => Hierarchy.direction[props.direction ?? 'down'] ?? 0)
    const vertical = computed(() => direction.value <= 1)

    const flowBasis = () => (vertical.value ? parentHeight.value : parentWidth.value)
    const crossBasis = () => (vertical.value ? parentWidth.value : parentHeight.value)

    const rankGap = useLengthPercentage(() => props.rankGap, 0, flowBasis)
    const nodeGap = useLengthPercentage(() => props.nodeGap, 0, crossBasis)
    const edgeGap = useLengthPercentage(() => props.edgeGap, 0, crossBasis)
    const alignItems = useAlignItems(() => props.alignItems, keywordResults.center)

    const layout = computed(() => {
      if (Hierarchy.isHierarchy(props.layout)) {
        return props.layout
      }

      return Hierarchy.make({
        direction: direction.value,
        backEdges: Hierarchy.backEdges[props.backEdges ?? 'direct'] ?? Hierarchy.backEdges.direct,
        rankGap: rankGap.value,
        nodeGap: nodeGap.value,
        edgeGap: edgeGap.value,
        ...alignItems.value,
        alignAdornments: resolveRatio(props.alignAdornments, 0.5),
      })
    })

    // The drawing has its own size, so the bounds are the box's explicit
    // size, and the inset and transform props only position it.
    const bounds = useHierarchyLayout(layout, () => Point.make(rect.value.x, rect.value.y))
    const rect = useRect(props, { size: bounds })

    expose({ rect, layout })

    useParentRectRegistration(rect)

    return useGroupRenderer(rect, () => boolProp(props.debug))
  },
  {
    name: 'HierarchyLayout',
    props: [
      ...INSET_PROP_KEYS,
      ...TRANSFORM_PROP_KEYS,
      'layout',
      'direction',
      'backEdges',
      'rankGap',
      'nodeGap',
      'edgeGap',
      'alignItems',
      'alignAdornments',
      'debug',
    ],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
