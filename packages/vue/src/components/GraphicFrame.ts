import { type SlotsType, defineComponent, useSlots } from 'vue'
import { useFrame } from '../composables/useFrame'

// type Unit = 'px' | '%' | 'vw' | 'vh' | 'vmin' | 'vmax'
// type QuantityInput = number | `${number}${Unit}` | (string & unknown)
//
// type AspectRatioInput = number | `${number}/${number}` | (string & unknown)
//
// type NumericInput = number | `${number}` | (string & unknown)

// interface GraphicFrameProps {
//   x?: QuantityInput
//   y?: QuantityInput
//   width?: QuantityInput
//   height?: QuantityInput
//   aspectRatio?: AspectRatioInput
//   minWidth?: QuantityInput
//   minHeight?: QuantityInput
//   maxWidth?: QuantityInput
//   maxHeight?: QuantityInput
//   grow?: NumericInput
//   shrink?: NumericInput
// }

export const GraphicFrame = defineComponent({
  name: 'GraphicFrame',
  slots: Object as SlotsType<{
    default: Readonly<Rect>
  }>,
  props: {
    width: { type: [String, Number], required: false },
    height: { type: [String, Number], required: false },
    aspectRatio: { type: [String, Number], required: false },
    x: { type: [String, Number], required: false },
    y: { type: [String, Number], required: false },
    grow: { type: [String, Number], required: false },
    shrink: { type: [String, Number], required: false },
  },
  setup(props) {
    const rect = useFrame(() => ({
      ...normalizeDimensionOptions(
        props.width,
        props.height,
        props.aspectRatio,
      ),
      x: parseDimensionProp(props.x ?? 0, 'width'),
      y: parseDimensionProp(props.y, 'height'),
    }))

    const slots = useSlots()

    return () => {
      return slots.default?.(rect.value)
    }
  },
})
