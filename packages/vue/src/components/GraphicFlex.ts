import type { FlexDirection, FlexWrap } from 'placement/FlexFrame'
import type { Rect } from 'placement/Rect'
import { type PropType, type SlotsType, defineComponent, useSlots } from 'vue'
import { useFlexFrame } from '../composables/useFlexFrame'
import { normalizeDimensionOptions } from '../utils/normalizeDimensionOptions'
import { parseDimensionProp } from '../utils/parseDimensionProp'
import { parseNumericProp } from '../utils/parseNumericProp'

export const GraphicFlex = defineComponent({
  name: 'GraphicFlex',
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
    direction: { type: String as PropType<FlexDirection>, required: false },
    wrap: { type: String as PropType<FlexWrap>, required: false },
    gap: { type: [String, Number], required: false },
    justify: { type: [String, Number], required: false },
    align: { type: [String, Number], required: false },
    stretch: { type: [String, Number], required: false },
    trackAlign: { type: [String, Number], required: false },
    trackStretch: { type: [String, Number], required: false },
    space: { type: [String, Number], required: false },
    spaceOuter: { type: [String, Number], required: false },
    trackSpace: { type: [String, Number], required: false },
    trackSpaceOuter: { type: [String, Number], required: false },
  },
  setup(props) {
    const rect = useFlexFrame(
      () => ({
        ...normalizeDimensionOptions(
          props.width,
          props.height,
          props.aspectRatio,
        ),
        x: parseDimensionProp(props.x ?? 0, 'width'),
        y: parseDimensionProp(props.y, 'height'),
        grow: parseNumericProp(props.grow),
        shrink: parseNumericProp(props.shrink),
      }),
      () => ({
        direction: props.direction,
        wrap: props.wrap,
        gap: parseNumericProp(props.gap),
        justify: parseNumericProp(props.justify),
        align: parseNumericProp(props.align),
        stretch: parseNumericProp(props.stretch),
        trackAlign: parseNumericProp(props.trackAlign),
        trackStretch: parseNumericProp(props.trackStretch),
        space: parseNumericProp(props.space),
        spaceOuter: parseNumericProp(props.spaceOuter),
        trackSpace: parseNumericProp(props.trackSpace),
        trackSpaceOuter: parseNumericProp(props.trackSpaceOuter),
      }),
    )

    const slots = useSlots()

    return () => {
      return slots.default?.(rect.value)
    }
  },
})
