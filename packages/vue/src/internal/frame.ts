import type { FrameInput } from 'placement/frame'
import { type ComputedRef, type MaybeRefOrGetter, computed } from 'vue'
import { SIZE_PROP_KEYS, type SizeProps } from '../composables/useRect.ts'
import { computedTRBLOffset } from '../data/offset.ts'
import { useAspectRatioInput } from '../props/aspectRatio.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'
import { type AlignSelfInput, resolveAlignSelf } from './props/alignSelf.ts'

/** The props that every frame-backed item shares: size, margins, and self alignment. */
export interface FrameItemProps extends SizeProps {
  marginTop?: LengthPercentageInput
  marginRight?: LengthPercentageInput
  marginBottom?: LengthPercentageInput
  marginLeft?: LengthPercentageInput
  alignSelf?: AlignSelfInput | number
}

export const FRAME_ITEM_PROP_KEYS = [
  ...SIZE_PROP_KEYS,
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'alignSelf',
] as const

// The prop resolvers mark an unset input with NaN. `Frame.make` wants such
// fields omitted, because it reads a non-finite sizing input as a literal
// infinite preference. That preference defeats an inherited stretch, for example.
function unsetIfNaN<T extends number | object>(value: T): T | undefined {
  return typeof value === 'number' && Number.isNaN(value) ? undefined : value
}

/**
 * Resolves the shared item props into `Frame.make` input. Each axis
 * resolves raw: the core owns the width/height/ratio interaction and the
 * min/max clamping (see `placement/frame`).
 */
export function useFrameInput(
  props: FrameItemProps,
  basis?: {
    readonly width: MaybeRefOrGetter<number>
    readonly height: MaybeRefOrGetter<number>
  },
): ComputedRef<FrameInput> {
  // Without an explicit basis, percentages resolve against the parent rect.
  const x = basis?.width ?? 'width'
  const y = basis?.height ?? 'height'

  const width = useLengthPercentage(() => props.width, Number.NaN, x)
  const height = useLengthPercentage(() => props.height, Number.NaN, y)
  const aspectRatio = useAspectRatioInput(() => props.aspectRatio, Number.NaN)
  const minWidth = useLengthPercentage(() => props.minWidth, Number.NaN, x)
  const minHeight = useLengthPercentage(() => props.minHeight, Number.NaN, y)
  const maxWidth = useLengthPercentage(() => props.maxWidth, Number.NaN, x)
  const maxHeight = useLengthPercentage(() => props.maxHeight, Number.NaN, y)

  const marginTop = useLengthPercentage(() => props.marginTop, 0, y)
  const marginRight = useLengthPercentage(() => props.marginRight, 0, x)
  const marginBottom = useLengthPercentage(() => props.marginBottom, 0, y)
  const marginLeft = useLengthPercentage(() => props.marginLeft, 0, x)

  const margin = computedTRBLOffset(marginTop, marginRight, marginBottom, marginLeft)

  return computed(() => ({
    width: unsetIfNaN(width.value),
    height: unsetIfNaN(height.value),
    aspectRatio: unsetIfNaN(aspectRatio.value),
    minWidth: unsetIfNaN(minWidth.value),
    minHeight: unsetIfNaN(minHeight.value),
    maxWidth: unsetIfNaN(maxWidth.value),
    maxHeight: unsetIfNaN(maxHeight.value),
    marginTop: margin.value.top,
    marginRight: margin.value.right,
    marginBottom: margin.value.bottom,
    marginLeft: margin.value.left,
    ...resolveAlignSelf(props.alignSelf),
  }))
}
