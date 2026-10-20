import type { Rect } from 'placement/rect'
import { parse } from 'valued'
import { number } from 'valued/data/number'
import { type SlotsType, type VNode, defineComponent } from 'vue'
import { FRAME_ITEM_PROP_KEYS, type FrameItemProps, toFrameInput } from '../internal/frame.ts'
import { useModelNode } from '../internal/model.ts'
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
    const node = useModelNode('item', () => ({
      frame: {
        ...toFrameInput(props),
        grow: resolveNumber(props.grow),
        shrink: resolveNumber(props.shrink),
      },
    }))

    return useGroupRenderer(node.output, () => boolProp(props.debug))
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
