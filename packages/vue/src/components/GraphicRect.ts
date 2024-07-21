import { defineComponent, h } from 'vue'
import {
  PAINT_PROP_KEYS,
  type PaintProps,
  usePaint,
} from '../composables/usePaint'
import { useParentRect } from '../composables/useParentRect'
import {
  RADIUS_PROP_KEYS,
  type RadiusProps,
  useRadius,
} from '../composables/useRadius'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect'
import { useRootRect } from '../composables/useRootRect'

export interface GraphicRectProps extends PaintProps, RectProps, RadiusProps {}

export const GraphicRect = defineComponent(
  (props: GraphicRectProps, { slots }) => {
    const parentRect = useParentRect()
    const rootRect = useRootRect()

    const self = useRect(props, parentRect, rootRect)

    const radius = useRadius(props, parentRect, rootRect)

    const paint = usePaint(props, parentRect, rootRect)

    return () => {
      const { x, y, width, height } = self.value
      const { x: rx, y: ry } = radius.value
      return h(
        'rect',
        {
          x,
          y,
          width,
          height,
          rx,
          ry,
          ...paint.value,
        },
        slots.default?.(),
      )
    }
  },
  {
    name: 'GraphicRect',
    props: [...RECT_PROP_KEYS, ...RADIUS_PROP_KEYS, ...PAINT_PROP_KEYS],
    // props: [
    //   'width',
    //   'height',
    //   'aspectRatio',
    //   'size',
    //   'maxSize',
    //   'maxWidth',
    //   'maxHeight',
    //   'minSize',
    //   'minWidth',
    //   'minHeight',
    //   'opacity',
    //   'fill',
    //   'stroke',
    //   'r',
    //   'top',
    //   'right',
    //   'bottom',
    //   'left',
    //   'inset',
    //   'origin',
    //   'x',
    //   'y',
    // ],
  },
)
