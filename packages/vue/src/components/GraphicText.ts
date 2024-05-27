import type { ReadonlyRect } from 'placement/rect'
import {
  type PropType,
  type SlotsType,
  defineComponent,
  h,
  shallowRef,
} from 'vue'
import type {
  OriginXInput,
  OriginYInput,
} from '../composables/properties/origin'
import { useDomRect } from '../composables/useDomRect'
import { useFrame } from '../composables/useFrame'
import { useParentRect } from '../composables/useParentRect'
import { useRootRect } from '../composables/useRootRect'
import { useViewportRect } from '../composables/useViewportRect'
import { frameSelfPropDefs, frameSizingPropDefs } from '../internal/props'

const graphicTextPropDefs = {
  ...frameSizingPropDefs,
  ...frameSelfPropDefs,
  originX: { type: String as PropType<OriginXInput>, required: false },
  originY: { type: String as PropType<OriginYInput>, required: false },
} as const

export const GraphicText = defineComponent({
  name: 'GraphicText',
  props: graphicTextPropDefs,
  slots: Object as SlotsType<{
    default: Readonly<ReadonlyRect>
  }>,
  setup(props, { slots }) {
    const text = shallowRef<SVGElement>()
    const frameRect = useFrame('absolute', props, true)
    const textRect = useDomRect(text)

    console.log(textRect, frameRect, props)

    const rect = useViewportRect(
      frameRect,
      textRect,
      'fill',
      () => props.originX ?? '50%',
      () => props.originY ?? '50%',
    )

    console.log(rect, useRootRect(), useParentRect())

    return () => {
      return h(
        'text',
        {
          ref: text,
          x: frameRect.value.x + rect.value.x,
          y: frameRect.value.y + rect.value.y + textRect.value.height,
        },
        slots.default?.(rect.value),
      )
    }
  },
})
