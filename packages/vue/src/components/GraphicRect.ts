import { defineComponent, h } from 'vue'
import type { Sizeable } from '../composables/useSize'

export interface GraphicRectProps extends Sizeable {
  // need to extend Paintable as well
  // parse stroke-width etc and use units
}

export const GraphicRect = defineComponent(
  (_props: GraphicRectProps, { slots }) => {
    return () => {
      return h(
        'rect',
        {
          x: 0,
          y: 0,
        },
        slots.default?.(),
      )
    }
  },
  {
    name: 'GraphicRect',
    props: [
      'width',
      'height',
      'aspectRatio',
      'size',
      'maxSize',
      'maxWidth',
      'maxHeight',
      'minSize',
      'minWidth',
      'minHeight',
    ],
  },
)
