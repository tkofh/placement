import { frame } from 'placement/frame'
import type { Rect } from 'placement/rect'
import { parse } from 'valued'
import { number } from 'valued/data/number'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useFlexItem } from '../composables/useFlex'
import {
  SIZE_PROP_KEYS,
  type SizeProps,
  useBasisSize,
  useMaxSize,
  useMinSize,
} from '../composables/useRect'
import { useParentRectRegistration } from '../composables/useSizingContext'
import { computedTRBLOffset } from '../data/offset'
import {
  type AlignSelfInput,
  resolveAlignSelf,
} from '../internal/props/alignSelf'
import {
  type JustifySelfInput,
  resolveJustifySelf,
} from '../internal/props/justifySelf'
import { useGroupRenderer } from '../internal/render'
import { boolProp } from '../internal/utils'
import {
  type LengthPercentageInput,
  useLengthPercentage,
} from '../props/lengthPercentage'

export interface FlexItemProps extends SizeProps {
  marginTop?: LengthPercentageInput
  marginRight?: LengthPercentageInput
  marginBottom?: LengthPercentageInput
  marginLeft?: LengthPercentageInput
  grow?: number | `${number}`
  shrink?: number | `${number}`
  alignSelf?: AlignSelfInput | number
  justifySelf?: JustifySelfInput | number
  debug?: boolean
}

function resolveNumber(value: number | `${number}` | undefined): number {
  if (typeof value === 'number') {
    return value
  }
  const parsed = parse(value ?? '', number())
  return parsed.valid ? parsed.value.value : 0
}

export const FlexItem = defineComponent(
  (props: FlexItemProps) => {
    const basisSize = useBasisSize(props)
    const minSize = useMinSize(props)
    const maxSize = useMaxSize(props)

    const marginTop = useLengthPercentage(() => props.marginTop, 0, 'height')
    const marginRight = useLengthPercentage(() => props.marginRight, 0, 'width')
    const marginBottom = useLengthPercentage(
      () => props.marginBottom,
      0,
      'height',
    )
    const marginLeft = useLengthPercentage(() => props.marginLeft, 0, 'width')

    const margin = computedTRBLOffset(
      marginTop,
      marginRight,
      marginBottom,
      marginLeft,
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

    return useGroupRenderer(rect, () => boolProp(props.debug))
  },
  {
    name: 'FlexItem',
    props: [
      ...SIZE_PROP_KEYS,
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
      'grow',
      'shrink',
      'alignSelf',
      'justifySelf',
      'debug',
    ],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
