import type { Dimensions } from 'placement/dimensions'
import { type Flexbox, flexbox, isFlexbox } from 'placement/flexbox'
import type { Point } from 'placement/point'
import { type Rect, rect, shrinkByOffset } from 'placement/rect'
import {
  type SlotsType,
  type VNode,
  computed,
  defineComponent,
  toValue,
} from 'vue'
import { useFlexLayout } from '../composables/useFlex'
import { provideParentRect, useParentRect } from '../composables/useParentRect'
import { useRootRect } from '../composables/useRootRect'
import { type Sizeable, useSize } from '../composables/useSize'
import { resolveOffset } from '../internal/offset'
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

export interface FlexLayoutProps extends Sizeable {
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

  return flexbox({
    ...parseFlow(props.flow ?? ''),
    ...parseGap(props.gap?.toString() ?? '', parent, root),
    ...placeValue,
  })
}

export const FlexLayout = defineComponent(
  (props: FlexLayoutProps, { slots, expose }) => {
    const parentRect = useParentRect()
    const rootRect = useRootRect()

    const size = useSize(props, parentRect, rootRect)

    const gutter = computed(() =>
      resolveOffset(props.gutter, true, toValue(parentRect), toValue(rootRect)),
    )

    const innerRect = computed(() =>
      rect.fromDimensions(size.value).pipe(shrinkByOffset(gutter.value)),
    )

    provideParentRect(innerRect)

    const layout = computed(() =>
      resolveFlexbox(props, toValue(parentRect), toValue(rootRect)),
    )

    useFlexLayout(layout, innerRect)

    expose({
      gutter,
      rect: innerRect,
    })

    return () => {
      return slots.default?.({ rect: innerRect.value })
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
      'gutter',
    ],
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
