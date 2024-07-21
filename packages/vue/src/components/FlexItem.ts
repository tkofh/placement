import type { Dimensions } from 'placement/dimensions'
import { frame } from 'placement/frame'
import type { Point } from 'placement/point'
import type { Rect } from 'placement/rect'
import {
  type SlotsType,
  type VNode,
  computed,
  defineComponent,
  toValue,
} from 'vue'
import { useFlexItem } from '../composables/useFlex'
import { provideParentRect, useParentRect } from '../composables/useParentRect'
import { type SizeProps, useUnconstrainedSizes } from '../composables/useRect'
import { useRootRect } from '../composables/useRootRect'
import { resolveOffset } from '../internal/offset'
import {
  type AlignSelfInput,
  type AlignSelfValue,
  parseAlignSelf,
} from '../internal/props/alignSelf'
import {
  type JustifySelfInput,
  parseJustifySelf,
} from '../internal/props/justifySelf'
import type { OffsetInput } from '../internal/props/offset'

export interface FlexItemProps extends SizeProps {
  margin?: OffsetInput | Dimensions | Point | number
  grow?: number
  shrink?: number
  alignSelf?: AlignSelfInput | number
  justifySelf?: JustifySelfInput | number
}

function resolveAlignSelf(
  input: AlignSelfInput | number | undefined,
): AlignSelfValue {
  return typeof input === 'number'
    ? {
        align: input,
        stretchCross: 0,
      }
    : parseAlignSelf(input ?? '')
}

function resolveJustifySelf(
  input: JustifySelfInput | number | undefined,
): number {
  return typeof input === 'number' ? input : parseJustifySelf(input ?? '')
}

export const FlexItem = defineComponent(
  (props: FlexItemProps, { slots }) => {
    const parentRect = useParentRect()
    const rootRect = useRootRect()

    const { size, minSize, maxSize } = useUnconstrainedSizes(
      props,
      parentRect,
      rootRect,
    )

    const margin = computed(() =>
      resolveOffset(props.margin, true, toValue(parentRect), toValue(rootRect)),
    )

    const self = computed(() =>
      frame({
        width: size.value.width,
        height: size.value.height,
        minWidth: minSize.value.width,
        minHeight: minSize.value.height,
        maxWidth: maxSize.value.width,
        maxHeight: maxSize.value.height,
        offsetTop: margin.value.top,
        offsetRight: margin.value.right,
        offsetBottom: margin.value.bottom,
        offsetLeft: margin.value.left,
        grow: props.grow,
        shrink: props.shrink,
        justify: resolveJustifySelf(props.justifySelf),
        ...resolveAlignSelf(props.alignSelf),
      }),
    )

    const rect = useFlexItem(self)

    provideParentRect(rect)

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
    ],
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
