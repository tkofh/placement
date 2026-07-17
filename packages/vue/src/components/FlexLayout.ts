import { type Flexbox, flexbox, isFlexbox } from 'placement/flexbox'
import { type Rect, contract } from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useFlexLayout } from '../composables/useFlex.ts'
import { INSET_PROP_KEYS, type RectProps, SIZE_PROP_KEYS, useRect } from '../composables/useRect.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { computedTRBLOffset } from '../data/offset.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { type AlignContentInput, useAlignContent } from '../props/alignContent.ts'
import { type AlignItemsInput, useAlignItems } from '../props/alignItems.ts'
import { type FlowInput, useFlow } from '../props/flow.ts'
import { type GapInput, useGap } from '../props/gap.ts'
import { type JustifyContentInput, useJustifyContent } from '../props/justifyContent.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export interface FlexLayoutProps extends RectProps {
  layout?: Flexbox
  alignContent?: AlignContentInput
  alignItems?: AlignItemsInput
  flow?: FlowInput
  gap?: GapInput
  justifyContent?: JustifyContentInput
  gutterTop?: LengthPercentageInput
  gutterRight?: LengthPercentageInput
  gutterBottom?: LengthPercentageInput
  gutterLeft?: LengthPercentageInput
  debug?: boolean
}

export const FlexLayout = defineComponent(
  (props: FlexLayoutProps, { expose }) => {
    const rect = useRect(props)

    const gutterTop = useLengthPercentage(() => props.gutterTop, 0, 'height')
    const gutterRight = useLengthPercentage(() => props.gutterRight, 0, 'width')
    const gutterBottom = useLengthPercentage(() => props.gutterBottom, 0, 'height')
    const gutterLeft = useLengthPercentage(() => props.gutterLeft, 0, 'width')

    const gutter = computedTRBLOffset(gutterTop, gutterRight, gutterBottom, gutterLeft)

    const innerRect = computed(() => rect.value.pipe(contract(gutter.value)))

    const alignContent = useAlignContent(() => props.alignContent)
    const alignItems = useAlignItems(() => props.alignItems)
    const flow = useFlow(() => props.flow)
    const gap = useGap(() => props.gap)
    const justifyContent = useJustifyContent(() => props.justifyContent)

    const layout = computed(() => {
      if (isFlexbox(props.layout)) {
        return props.layout
      }

      return flexbox({
        ...flow.value,
        ...gap.value,
        ...alignContent.value,
        ...alignItems.value,
        ...justifyContent.value,
      })
    })

    useFlexLayout(layout, innerRect)

    expose({
      rect: innerRect,
      layout,
    })

    useParentRectRegistration(innerRect)

    return useGroupRenderer(innerRect, () => boolProp(props.debug))
  },
  {
    name: 'FlexLayout',
    props: [
      ...SIZE_PROP_KEYS,
      ...INSET_PROP_KEYS,
      'alignContent',
      'alignItems',
      'flow',
      'gap',
      'justifyContent',
      'gutterTop',
      'gutterRight',
      'gutterBottom',
      'gutterLeft',
      'debug',
      'layout',
    ],
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
