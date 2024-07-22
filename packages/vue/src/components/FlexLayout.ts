import type { Dimensions } from 'placement/dimensions'
import { type Flexbox, flexbox, isFlexbox } from 'placement/flexbox'
import type { Point } from 'placement/point'
import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useFlexLayout } from '../composables/useFlex'
import {
  INSET_PROP_KEYS,
  type RectProps,
  SIZE_PROP_KEYS,
  useRect,
} from '../composables/useRect'
import {
  useParentHeight,
  useParentRectRegistration,
  useParentWidth,
  useRootHeight,
  useRootWidth,
} from '../composables/useSizingContext'
import {
  type AlignContentInput,
  resolveAlignContent,
} from '../internal/props/alignContent'
import {
  type AlignItemsInput,
  resolveAlignItems,
} from '../internal/props/alignItems'
import { type FlowInput, resolveFlow } from '../internal/props/flow'
import { type GapInput, resolveGap } from '../internal/props/gap'
import {
  type JustifyContentInput,
  resolveJustifyContent,
} from '../internal/props/justifyContent'
import type { OffsetInput } from '../internal/props/offset'
import {
  type PlaceInput,
  type PlaceValue,
  resolvePlace,
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
  parentWidth: number,
  parentHeight: number,
  rootWidth: number,
  rootHeight: number,
): Flexbox {
  if (isFlexbox(props.layout)) {
    return props.layout
  }

  const { alignContent, alignItems, justifyContent, place } = props

  const placeValue: Partial<PlaceValue> = {}

  if (place !== undefined) {
    const parsedPlace = resolvePlace(place)
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
    const parsedAlignContent = resolveAlignContent(alignContent)
    placeValue.alignContent = parsedAlignContent.alignContent
    placeValue.alignContentSpace = parsedAlignContent.alignContentSpace
    placeValue.alignContentSpaceOuter =
      parsedAlignContent.alignContentSpaceOuter
    placeValue.stretchContent = parsedAlignContent.stretchContent
  }

  if (alignItems !== undefined) {
    const parsedAlignItems = resolveAlignItems(alignItems)
    placeValue.alignItems = parsedAlignItems.alignItems
    placeValue.stretchItems = parsedAlignItems.stretchItems
  }

  if (justifyContent !== undefined) {
    const parsedJustifyContent = resolveJustifyContent(justifyContent)
    placeValue.justifyContent = parsedJustifyContent.justifyContent
    placeValue.justifyContentSpace = parsedJustifyContent.justifyContentSpace
    placeValue.justifyContentSpaceOuter =
      parsedJustifyContent.justifyContentSpace
  }

  const gapValue = resolveGap(
    props.gap,
    0,
    parentWidth,
    parentHeight,
    rootWidth,
    rootHeight,
  )

  return flexbox({
    ...resolveFlow(props.flow ?? ''),
    ...gapValue,
    ...placeValue,
  })
}

export const FlexLayout = defineComponent(
  (props: FlexLayoutProps, { slots, expose }) => {
    const rect = useRect(props)

    const parentWidth = useParentWidth()
    const parentHeight = useParentHeight()
    const rootWidth = useRootWidth()
    const rootHeight = useRootHeight()

    const layout = computed(() =>
      resolveFlexbox(
        props,
        parentWidth.value,
        parentHeight.value,
        rootWidth.value,
        rootHeight.value,
      ),
    )

    useFlexLayout(layout, rect)

    expose({
      rect: rect,
    })

    useParentRectRegistration(rect)

    return () => {
      return slots.default?.({ rect: rect.value })
    }
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
      'place',
    ],
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
