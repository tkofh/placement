import type { ReadonlyRect } from 'placement/rect'
import { type SlotsType, defineComponent, useSlots } from 'vue'
import { useFrame } from '../composables/useFrame'
import { frameSelfPropDefs } from '../internal/props'

export const BasicFrame = defineComponent({
  name: 'BasicFrame',
  props: frameSelfPropDefs,
  slots: Object as SlotsType<{
    default: Readonly<ReadonlyRect>
  }>,
  setup(props) {
    const rect = useFrame('absolute', props, true)
    const slots = useSlots()

    return () => {
      return slots.default?.(rect.value)
    }
  },
})
