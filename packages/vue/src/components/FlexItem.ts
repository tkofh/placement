import * as Frame from 'placement/frame'
import type { Rect } from 'placement/rect'
import { parse } from 'valued'
import { number } from 'valued/data/number'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useFlexItem } from '../composables/useFlex.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { FRAME_ITEM_PROP_KEYS, type FrameItemProps, useFrameInput } from '../internal/frame.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'

export interface FlexItemProps extends FrameItemProps {
  grow?: number | `${number}`
  shrink?: number | `${number}`
  debug?: boolean
}

function resolveNumber(value: number | `${number}` | undefined): number {
  if (typeof value === 'number') {
    return value
  }
  const parsed = parse(value ?? '', number())
  return parsed.valid ? parsed.value.value : 0
}

export const FlexItem = defineComponent(
  (props: FlexItemProps) => {
    const input = useFrameInput(props)

    const self = computed(() =>
      Frame.make({
        ...input.value,
        grow: resolveNumber(props.grow),
        shrink: resolveNumber(props.shrink),
      }),
    )

    const rect = useFlexItem(self)

    useParentRectRegistration(rect)

    return useGroupRenderer(rect, () => boolProp(props.debug))
  },
  {
    name: 'FlexItem',
    props: [...FRAME_ITEM_PROP_KEYS, 'grow', 'shrink', 'debug'],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
