import * as Frame from 'placement/frame'
import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useHierarchyLabel, useHierarchyPercentBasis } from '../composables/useHierarchy.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { FRAME_ITEM_PROP_KEYS, type FrameItemProps, useFrameInput } from '../internal/frame.ts'
import { type RatioInput, resolveRatio } from '../internal/props/ratio.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'

export interface HierarchyLabelProps extends FrameItemProps {
  /**
   * Where the label sits along its edge: `'start'` (the source), `'center'`
   * (default), `'end'` (the target), or a ratio.
   */
  at?: RatioInput
  debug?: boolean
}

export const HierarchyLabel = defineComponent(
  (props: HierarchyLabelProps) => {
    const input = useFrameInput(props, useHierarchyPercentBasis())

    const rect = useHierarchyLabel(
      computed(() => ({ frame: Frame.make(input.value), at: resolveRatio(props.at, 0.5) })),
    )

    useParentRectRegistration(rect)

    return useGroupRenderer(rect, () => boolProp(props.debug))
  },
  {
    name: 'HierarchyLabel',
    props: [...FRAME_ITEM_PROP_KEYS, 'at', 'debug'],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
