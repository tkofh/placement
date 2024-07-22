import { frame } from 'placement/frame'
import { offset } from 'placement/offset'
import type { Point } from 'placement/point'
import type { Rect } from 'placement/rect'
import { parse } from 'valued'
import { number } from 'valued/data/number'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useFlexItem } from '../composables/useFlex'
import {
  type SizeProps,
  useBasisSize,
  useMaxSize,
  useMinSize,
} from '../composables/useRect'
import {
  useParentHeight,
  useParentRectRegistration,
  useParentWidth,
  useRootHeight,
  useRootWidth,
} from '../composables/useSizingContext'
import {
  type AlignSelfInput,
  resolveAlignSelf,
} from '../internal/props/alignSelf'
import {
  type JustifySelfInput,
  resolveJustifySelf,
} from '../internal/props/justifySelf'
import { type OffsetInput, resolveOffset } from '../internal/props/offset'

export interface FlexItemProps extends SizeProps {
  margin?: OffsetInput | Point | number
  grow?: number | `${number}`
  shrink?: number | `${number}`
  alignSelf?: AlignSelfInput | number
  justifySelf?: JustifySelfInput | number
}

function resolveNumber(value: number | `${number}` | undefined): number {
  if (typeof value === 'number') {
    return value
  }
  const parsed = parse(value ?? '', number())
  return parsed.valid ? parsed.value.value : 0
}

export const FlexItem = defineComponent(
  (props: FlexItemProps, { slots }) => {
    const basisSize = useBasisSize(props)
    const minSize = useMinSize(props)
    const maxSize = useMaxSize(props)

    const parentWidth = useParentWidth()
    const parentHeight = useParentHeight()
    const rootWidth = useRootWidth()
    const rootHeight = useRootHeight()

    const margin = computed(() =>
      resolveOffset(
        props.margin,
        offset.zero,
        true,
        parentWidth.value,
        parentHeight.value,
        rootWidth.value,
        rootHeight.value,
      ),
    )

    const self = computed(() =>
      frame({
        width: basisSize.value.width,
        height: basisSize.value.height,
        minWidth: minSize.value.width,
        minHeight: minSize.value.height,
        maxWidth: maxSize.value.width,
        maxHeight: maxSize.value.height,
        offsetTop: margin.value.bottom,
        offsetRight: margin.value.right,
        offsetBottom: margin.value.top,
        offsetLeft: margin.value.left,
        grow: resolveNumber(props.grow),
        shrink: resolveNumber(props.shrink),
        justify: resolveJustifySelf(props.justifySelf),
        ...resolveAlignSelf(props.alignSelf),
      }),
    )

    const rect = useFlexItem(self)

    useParentRectRegistration(rect)

    return () => {
      return slots.default?.({ rect: rect.value })
    }
  },
  {
    name: 'FlexItem',
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
      'alignSelf',
      'grow',
      'justifySelf',
      'margin',
      'shrink',
    ],
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
