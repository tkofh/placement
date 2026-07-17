import * as Frame from 'placement/frame'
import type { Rect } from 'placement/rect'
import { parse } from 'valued'
import { number } from 'valued/data/number'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useFlexItem } from '../composables/useFlex.ts'
import { SIZE_PROP_KEYS, type SizeProps } from '../composables/useRect.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { computedTRBLOffset } from '../data/offset.ts'
import { type AlignSelfInput, resolveAlignSelf } from '../internal/props/alignSelf.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { useAspectRatio } from '../props/aspectRatio.ts'
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

// The prop resolvers mark an unset input with NaN; `Frame.make` wants such
// fields omitted (a non-finite sizing input to `Frame.make` is a literal
// infinite preference, defeating e.g. an inherited stretch).
function unsetIfNaN(value: number): number | undefined {
  return Number.isNaN(value) ? undefined : value
}

export const FlexItem = defineComponent(
  (props: FlexItemProps) => {
    // Raw per-axis resolution only — the width/height/ratio interplay and
    // the min/max clamping are the core's job (see `placement/frame`).
    const width = useLengthPercentage(() => props.width, Number.NaN, 'width')
    const height = useLengthPercentage(() => props.height, Number.NaN, 'height')
    const aspectRatio = useAspectRatio(() => props.aspectRatio, Number.NaN)
    const minWidth = useLengthPercentage(() => props.minWidth, Number.NaN, 'width')
    const minHeight = useLengthPercentage(() => props.minHeight, Number.NaN, 'height')
    const maxWidth = useLengthPercentage(() => props.maxWidth, Number.NaN, 'width')
    const maxHeight = useLengthPercentage(() => props.maxHeight, Number.NaN, 'height')

    const marginTop = useLengthPercentage(() => props.marginTop, 0, 'height')
    const marginRight = useLengthPercentage(() => props.marginRight, 0, 'width')
    const marginBottom = useLengthPercentage(() => props.marginBottom, 0, 'height')
    const marginLeft = useLengthPercentage(() => props.marginLeft, 0, 'width')

    const margin = computedTRBLOffset(marginTop, marginRight, marginBottom, marginLeft)

    const self = computed(() =>
      Frame.make({
        width: unsetIfNaN(width.value),
        height: unsetIfNaN(height.value),
        aspectRatio: unsetIfNaN(aspectRatio.value),
        minWidth: unsetIfNaN(minWidth.value),
        minHeight: unsetIfNaN(minHeight.value),
        maxWidth: unsetIfNaN(maxWidth.value),
        maxHeight: unsetIfNaN(maxHeight.value),
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
