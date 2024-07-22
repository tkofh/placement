import { defineComponent, h } from 'vue'
import {
  PAINT_PROP_KEYS,
  type PaintProps,
  usePaint,
} from '../composables/usePaint'
import {
  RADIUS_PROP_KEYS,
  type RadiusProps,
  useRadius,
} from '../composables/useRadius'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect'

export interface GraphicRectProps extends PaintProps, RectProps, RadiusProps {}

export const GraphicRect = defineComponent(
  (props: GraphicRectProps) => {
    const self = useRect(props)

    const radius = useRadius(props)

    const paint = usePaint(props)

    return () => {
      const { x, y, width, height } = self.value
      const { x: rx, y: ry } = radius.value
      return h('rect', {
        x,
        y,
        width,
        height,
        rx,
        ry,
        ...paint.value,
      })
    }
  },
  {
    name: 'GraphicRect',
    props: [...RECT_PROP_KEYS, ...RADIUS_PROP_KEYS, ...PAINT_PROP_KEYS],
  },
)
