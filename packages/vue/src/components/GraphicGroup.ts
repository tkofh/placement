import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, defineComponent } from 'vue'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'

export interface GraphicRectProps extends RectProps {
  debug?: boolean
}

export const GraphicGroup = defineComponent(
  (props: GraphicRectProps) => {
    const self = useRect(props)

    useParentRectRegistration(self)

    return useGroupRenderer(self, () => boolProp(props.debug))
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
