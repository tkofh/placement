import { rect } from 'placement/rect'
import { defineComponent, h, ref } from 'vue'
import { useTextRect } from '../composables/useDomRect'
import {
  PAINT_PROP_KEYS,
  type PaintProps,
  usePaint,
} from '../composables/usePaint'
import {
  type InsetProps,
  TRANSFORM_PROP_KEYS,
  type TransformProps,
  useAxisInterval,
  useInset,
  useTransformedRect,
} from '../composables/useRect'
import {
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
} from '../composables/useSizingContext'

export interface GraphicTextProps
  extends PaintProps,
    Omit<InsetProps, 'inset'>,
    TransformProps {}

export const GraphicText = defineComponent(
  (props: GraphicTextProps, { slots }) => {
    const text = ref<SVGTextElement>()
    const domRect = useTextRect(text)

    const { top, right, bottom, left } = useInset(props)

    const parentX = useParentX()
    const parentY = useParentY()
    const parentWidth = useParentWidth()
    const parentHeight = useParentHeight()

    const x = useAxisInterval(
      left,
      right,
      () => domRect.value.width,
      parentX,
      parentWidth,
      0,
      0,
      Number.POSITIVE_INFINITY,
    )

    const y = useAxisInterval(
      top,
      bottom,
      () => domRect.value.height,
      parentY,
      parentHeight,
      0,
      0,
      Number.POSITIVE_INFINITY,
    )

    const self = useTransformedRect(
      () => rect.fromInterval(x.value, y.value),
      props,
    )

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
    props: [
      'top',
      'right',
      'bottom',
      'left',
      ...TRANSFORM_PROP_KEYS,
      ...PAINT_PROP_KEYS,
    ],
  },
)
