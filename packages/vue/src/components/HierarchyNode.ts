import * as Frame from 'placement/frame'
import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useHierarchyNode, useHierarchyPercentBasis } from '../composables/useHierarchy.ts'
import { useOutlineCollector } from '../composables/useOutline.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { FRAME_ITEM_PROP_KEYS, type FrameItemProps, useFrameInput } from '../internal/frame.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'

export interface HierarchyNodeProps extends FrameItemProps {
  /** The node's identity. `HierarchyEdge`'s `from` and `to` reference it. */
  id: string
  debug?: boolean
}

export const HierarchyNode = defineComponent(
  (props: HierarchyNodeProps) => {
    const basis = useHierarchyPercentBasis()

    const input = useFrameInput(props, basis)

    const node = computed(() => ({
      frame: Frame.make({ ...input.value, id: props.id }),
      shape: outline.value,
    }))

    const rect = useHierarchyNode(node)

    useParentRectRegistration(rect)

    // The children's box is the node's, so a graphic that fills it gives
    // the node the outline its edges meet. This comes after the parent rect
    // registration, which blocks outlines from below.
    const outline = useOutlineCollector()

    return useGroupRenderer(rect, () => boolProp(props.debug))
  },
  {
    name: 'HierarchyNode',
    props: [...FRAME_ITEM_PROP_KEYS, 'id', 'debug'],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
