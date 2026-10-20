import * as Flexbox from 'placement/flexbox'
import type * as Rect from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { INSET_PROP_KEYS, type RectProps, SIZE_PROP_KEYS } from '../composables/useRect.ts'
import { useModelNode } from '../internal/model.ts'
import { toBoxInput } from '../internal/modelInputs.ts'
import { toLength } from '../internal/props/size1d.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { type AlignContentInput, useAlignContent } from '../props/alignContent.ts'
import { type AlignItemsInput, useAlignItems } from '../props/alignItems.ts'
import { type FlowInput, useFlow } from '../props/flow.ts'
import { type GapInput, useGap } from '../props/gap.ts'
import { type JustifyContentInput, useJustifyContent } from '../props/justifyContent.ts'
import type { LengthPercentageInput } from '../props/lengthPercentage.ts'

export interface FlexLayoutProps extends RectProps {
  layout?: Flexbox.Flexbox
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
    const alignContent = useAlignContent(() => props.alignContent)
    const alignItems = useAlignItems(() => props.alignItems)
    const flow = useFlow(() => props.flow)
    const gap = useGap(() => props.gap)
    const justifyContent = useJustifyContent(() => props.justifyContent)

    const layout = computed(() => {
      if (Flexbox.isFlexbox(props.layout)) {
        return props.layout
      }

      return Flexbox.make({
        ...flow.value,
        ...gap.value,
        ...alignContent.value,
        ...alignItems.value,
        ...justifyContent.value,
      })
    })

    // The node's output is its content rect: its placed rect contracted by
    // the gutter, whose percentages resolve against the placed rect.
    const node = useModelNode('flex', () => ({
      box: toBoxInput(props),
      gutter: {
        top: toLength(props.gutterTop, 0),
        right: toLength(props.gutterRight, 0),
        bottom: toLength(props.gutterBottom, 0),
        left: toLength(props.gutterLeft, 0),
      },
      layout: layout.value,
    }))

    expose({
      rect: node.output,
      layout,
    })

    return useGroupRenderer(node.output, () => boolProp(props.debug))
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
      default: (props: { rect: Rect.Rect }) => Array<VNode>
    }>,
  },
)
