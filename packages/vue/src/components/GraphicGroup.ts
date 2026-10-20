import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, defineComponent } from 'vue'
import { RECT_PROP_KEYS, type RectProps } from '../composables/useRect.ts'
import { useModelNode } from '../internal/model.ts'
import { toBoxInput, toTranslateInput } from '../internal/modelInputs.ts'
import { resolveOrigin } from '../internal/props/origin.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'

export interface GraphicGroupProps extends RectProps {
  debug?: boolean
}

export const GraphicGroup = defineComponent(
  (props: GraphicGroupProps) => {
    const node = useModelNode('group', () => ({
      box: toBoxInput(props),
      origin: resolveOrigin(props.origin),
      translate: toTranslateInput(props),
    }))

    return useGroupRenderer(node.output, () => boolProp(props.debug))
  },
  {
    name: 'GraphicGroup',
    props: [...RECT_PROP_KEYS, 'debug'],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
