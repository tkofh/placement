import * as Frame from 'placement/frame'
import type { Rect } from 'placement/rect'
import { parse } from 'valued'
import { number } from 'valued/data/number'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useFlexItem } from '../composables/useFlex.ts'
import {
  SIZE_PROP_KEYS,
  type SizeProps,
  useBasisSize,
  useMaxSize,
  useMinSize,
} from '../composables/useRect.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { computedTRBLOffset } from '../data/offset.ts'
import { type AlignSelfInput, resolveAlignSelf } from '../internal/props/alignSelf.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export interface FlexItemProps extends SizeProps {
  marginTop?: LengthPercentageInput
  marginRight?: LengthPercentageInput
  marginBottom?: LengthPercentageInput
  marginLeft?: LengthPercentageInput
  grow?: number | `${number}`
  shrink?: number | `${number}`
  alignSelf?: AlignSelfInput | number
  debug?: boolean
}

function resolveNumber(value: number | `${number}` | undefined): number {
  if (typeof value === 'number') {
    return value
  }
  const parsed = parse(value ?? '', number())
  return parsed.valid ? parsed.value.value : 0
}

// The sizing composables mark an unset dimension with the old
// `Number.POSITIVE_INFINITY` sentinel, but `Frame.make` stores non-finite
// sizing fields as literal infinite preferences (defeating, e.g., an
// inherited stretch). Translate the sentinel to the core's unset convention.
function finiteOrUndefined(value: number): number | undefined {
  return Number.isFinite(value) ? value : undefined
}

export const FlexItem = defineComponent(
  (props: FlexItemProps) => {
    const basisSize = useBasisSize(props)
    const minSize = useMinSize(props)
    const maxSize = useMaxSize(props)

    const marginTop = useLengthPercentage(() => props.marginTop, 0, 'height')
    const marginRight = useLengthPercentage(() => props.marginRight, 0, 'width')
    const marginBottom = useLengthPercentage(() => props.marginBottom, 0, 'height')
    const marginLeft = useLengthPercentage(() => props.marginLeft, 0, 'width')

    const margin = computedTRBLOffset(marginTop, marginRight, marginBottom, marginLeft)

    const self = computed(() =>
      Frame.make({
        width: finiteOrUndefined(basisSize.value.width),
        height: finiteOrUndefined(basisSize.value.height),
        minWidth: finiteOrUndefined(minSize.value.width),
        minHeight: finiteOrUndefined(minSize.value.height),
        maxWidth: finiteOrUndefined(maxSize.value.width),
        maxHeight: finiteOrUndefined(maxSize.value.height),
        offsetTop: margin.value.top,
        offsetRight: margin.value.right,
        offsetBottom: margin.value.bottom,
        offsetLeft: margin.value.left,
        grow: resolveNumber(props.grow),
        shrink: resolveNumber(props.shrink),
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
      'debug',
    ],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
