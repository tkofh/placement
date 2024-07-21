import type { Dimensions } from 'placement/dimensions'
import { type Flexbox, flexbox, isFlexbox } from 'placement/flexbox'
import type { Point } from 'placement/point'
import type { Rect } from 'placement/rect'
import {
  type SlotsType,
  type VNode,
  computed,
  defineComponent,
  toValue,
} from 'vue'
import { useFlexLayout } from '../composables/useFlex'
import { provideParentRect, useParentRect } from '../composables/useParentRect'
import { type RectProps, useRect } from '../composables/useRect'
import { useRootRect } from '../composables/useRootRect'
import {
  type AlignContentInput,
  parseAlignContent,
} from '../internal/props/alignContent'
import {
  type AlignItemsInput,
  parseAlignItems,
} from '../internal/props/alignItems'
import { type FlowInput, parseFlow } from '../internal/props/flow'
import { type GapInput, parseGap } from '../internal/props/gap'
import {
  type JustifyContentInput,
  parseJustifyContent,
} from '../internal/props/justifyContent'
import type { OffsetInput } from '../internal/props/offset'
import {
  type PlaceInput,
  type PlaceValue,
  parsePlace,
} from '../internal/props/place'

export interface FlexLayoutProps extends RectProps {
  layout?: Flexbox
  alignContent?: AlignContentInput
  alignItems?: AlignItemsInput
  flow?: FlowInput
  gap?: GapInput | number
  justifyContent?: JustifyContentInput
  place?: PlaceInput
  gutter?: OffsetInput | Dimensions | Point | number
}

function resolveFlexbox(
  props: FlexLayoutProps,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Flexbox {
  if (isFlexbox(props.layout)) {
    return props.layout
  }

  const { alignContent, alignItems, justifyContent, place } = props

  const placeValue: Partial<PlaceValue> = {}

  if (place !== undefined) {
    const parsedPlace = parsePlace(place)
    placeValue.justifyContent = parsedPlace.justifyContent
    placeValue.justifyContentSpace = parsedPlace.justifyContentSpace
    placeValue.justifyContentSpaceOuter = parsedPlace.justifyContentSpaceOuter
    placeValue.alignItems = parsedPlace.alignItems
    placeValue.stretchItems = parsedPlace.stretchItems
    placeValue.alignContent = parsedPlace.alignContent
    placeValue.alignContentSpace = parsedPlace.alignContentSpace
    placeValue.alignContentSpaceOuter = parsedPlace.alignContentSpaceOuter
    placeValue.stretchContent = parsedPlace.stretchContent
  }

  if (alignContent !== undefined) {
    const parsedAlignContent = parseAlignContent(alignContent)
    placeValue.alignContent = parsedAlignContent.alignContent
    placeValue.alignContentSpace = parsedAlignContent.alignContentSpace
    placeValue.alignContentSpaceOuter =
      parsedAlignContent.alignContentSpaceOuter
    placeValue.stretchContent = parsedAlignContent.stretchContent
  }

  if (alignItems !== undefined) {
    const parsedAlignItems = parseAlignItems(alignItems)
    placeValue.alignItems = parsedAlignItems.alignItems
    placeValue.stretchItems = parsedAlignItems.stretchItems
  }

  if (justifyContent !== undefined) {
    const parsedJustifyContent = parseJustifyContent(justifyContent)
    placeValue.justifyContent = parsedJustifyContent.justifyContent
    placeValue.justifyContentSpace = parsedJustifyContent.justifyContentSpace
    placeValue.justifyContentSpaceOuter =
      parsedJustifyContent.justifyContentSpace
  }

  const gapValue =
    typeof props.gap === 'number'
      ? { rowGap: props.gap, columnGap: props.gap }
      : parseGap(props.gap?.toString() ?? '', parent, root)

  return flexbox({
    ...parseFlow(props.flow ?? ''),
    ...gapValue,
    ...placeValue,
  })
}

export const FlexLayout = defineComponent(
  (props: FlexLayoutProps, { slots, expose }) => {
    const parentRect = useParentRect()
    const rootRect = useRootRect()

    const rect = useRect(props, parentRect, rootRect)

    provideParentRect(rect)

    const layout = computed(() =>
      resolveFlexbox(props, toValue(parentRect), toValue(rootRect)),
    )

    useFlexLayout(layout, rect)

    expose({
      rect: rect,
    })

    return () => {
      return slots.default?.({ rect: rect.value })
    }
  },
  {
    name: 'FlexLayout',
    props: [
      'aspectRatio',
      'width',
      'height',
      'minWidth',
      'minHeight',
      'maxWidth',
      'maxHeight',
      'minSize',
      'maxSize',
      'size',
      'alignContent',
      'alignItems',
      'flow',
      'gap',
      'justifyContent',
      'place',
      'inset',
      'top',
      'right',
      'bottom',
      'left',
    ],
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
