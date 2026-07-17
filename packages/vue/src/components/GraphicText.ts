import { defineComponent, h, ref } from 'vue'
import { useTextRect } from '../composables/useDomRect.ts'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import {
  INSET_PROP_KEYS,
  type InsetProps,
  TRANSFORM_PROP_KEYS,
  type TransformProps,
  useRect,
} from '../composables/useRect.ts'

export interface GraphicTextProps extends PaintProps, InsetProps, TransformProps {}

export const GraphicText = defineComponent(
  (props: GraphicTextProps, { slots }) => {
    const text = ref<SVGTextElement>()
    const domRect = useTextRect(text)

    // The measured DOM rect is the box's explicit size; the inset and
    // transform props position it.
    const self = useRect(props, { size: domRect })

    const paint = usePaint(props)

    return () => {
      const { x, y, width, height } = self.value
      return h(
        'text',
        {
          ref: text,
          x,
          y: y + height,
          width,
          height,
          ...paint.value,
        },
        slots.default?.(),
      )
    }
  },
  {
    name: 'GraphicText',
    props: [...INSET_PROP_KEYS, ...TRANSFORM_PROP_KEYS, ...PAINT_PROP_KEYS],
  },
)
