import { rect } from 'placement/rect'
import { defineComponent, h, ref } from 'vue'
import { useTextRect } from '../composables/useDomRect'
import {
  PAINT_PROP_KEYS,
  type PaintProps,
  usePaint,
} from '../composables/usePaint'
import {
  INSET_PROP_KEYS,
  type InsetProps,
  TRANSFORM_PROP_KEYS,
  type TransformProps,
  useAxisInterval,
  useTransformedRect,
} from '../composables/useRect'
import {
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
} from '../composables/useSizingContext'
import { useLengthPercentage } from '../props/lengthPercentage'

export interface GraphicTextProps
  extends PaintProps,
    InsetProps,
    TransformProps {}

export const GraphicText = defineComponent(
  (props: GraphicTextProps, { slots }) => {
    const text = ref<SVGTextElement>()
    const domRect = useTextRect(text)

    const top = useLengthPercentage(
      () => props.top,
      Number.POSITIVE_INFINITY,
      'height',
    )
    const right = useLengthPercentage(
      () => props.right,
      Number.POSITIVE_INFINITY,
      'width',
    )
    const bottom = useLengthPercentage(
      () => props.bottom,
      Number.POSITIVE_INFINITY,
      'height',
    )
    const left = useLengthPercentage(
      () => props.left,
      Number.POSITIVE_INFINITY,
      'width',
    )

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
      Number.POSITIVE_INFINITY,
    )

    const y = useAxisInterval(
      top,
      bottom,
      () => domRect.value.height,
      parentY,
      parentHeight,
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
    props: [...INSET_PROP_KEYS, ...TRANSFORM_PROP_KEYS, ...PAINT_PROP_KEYS],
  },
)
