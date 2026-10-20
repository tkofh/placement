import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, defineComponent } from 'vue'
import { useConnectorNode } from '../composables/useConnector.ts'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'

export interface ConnectorNodeProps extends RectProps {
  /**
   * The node's identity. `ConnectorEdge`'s `from` and `to` reference it. A
   * node without one is only an obstacle that routes go around.
   */
  id?: string
  debug?: boolean
}

export const ConnectorNode = defineComponent(
  (props: ConnectorNodeProps) => {
    // A node is a box like a group's, so by default it fills its parent: a
    // flex item, a hierarchy node, or any other placed box.
    const rect = useRect(props)

    useConnectorNode(() => ({ id: props.id, rect: rect.value }))

    useParentRectRegistration(rect)

    return useGroupRenderer(rect, () => boolProp(props.debug))
  },
  {
    name: 'ConnectorNode',
    props: [...RECT_PROP_KEYS, 'id', 'debug'],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
