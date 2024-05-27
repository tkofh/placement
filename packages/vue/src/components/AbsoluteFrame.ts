import type { ReadonlyRect } from 'placement/rect'
import { type SlotsType, defineComponent, h, useSlots } from 'vue'
import { useFrame } from '../composables/useFrame'
import {
  frameInsetPropDefs,
  frameSelfPropDefs,
  frameSizingPropDefs,
  svgPaintPropDefs,
  svgRadiusPropDefs,
} from '../internal/props'
import { Primitive } from './Primitive'
export const AbsoluteFrame = defineComponent({
  name: 'AbsoluteFrame',
  props: {
    ...svgPaintPropDefs,
    ...svgRadiusPropDefs,
    ...frameSizingPropDefs,
    ...frameSelfPropDefs,
    ...frameInsetPropDefs,
  },
  slots: Object as SlotsType<{
    default: Readonly<ReadonlyRect>
  }>,
  setup(props) {
    const rect = useFrame('absolute', props, false)
    const slots = useSlots()

    return () => {
      return h(
        'g',
        {
          'data-x': rect.value.x,
          'data-y': rect.value.y,
          'data-width': rect.value.width,
          'data-height': rect.value.height,
        },
        [
          h(Primitive, { rect: rect.value, ...props }),
          ...(slots.default?.(rect.value) ?? []),
        ],
      )
    }
  },
})
