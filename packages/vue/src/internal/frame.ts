import type { FrameInput } from 'placement/frame'
import * as Length from 'placement/length'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import { SIZE_PROP_KEYS, type SizeProps } from '../composables/useRect.ts'
import { useAspectRatio } from '../props/aspectRatio.ts'
import { type LengthPercentageInput, useLength } from '../props/lengthPercentage.ts'
import { useOverrideablePercentBasis } from './parent.ts'
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
function unsetIfNaN<T extends Length.LengthInput>(value: T): T | undefined {
  return typeof value === 'number' && Number.isNaN(value) ? undefined : value
}

/**
 * Parses the shared item props into `Frame.make` input and leaves
 * percentages unresolved. Use it where the layout resolves them, as
 * `Flexbox.apply` does against the container's inner rect (see
 * `placement/frame`). Each axis stays raw: the core owns the
 * width/height/ratio interaction and the min/max clamping.
 */
export function useFrameLengths(props: FrameItemProps): ComputedRef<FrameInput<undefined>> {
  const width = useLength(() => props.width, Number.NaN)
  const height = useLength(() => props.height, Number.NaN)
  const aspectRatio = useAspectRatio(() => props.aspectRatio, Number.NaN)
  const minWidth = useLength(() => props.minWidth, Number.NaN)
  const minHeight = useLength(() => props.minHeight, Number.NaN)
  const maxWidth = useLength(() => props.maxWidth, Number.NaN)
  const maxHeight = useLength(() => props.maxHeight, Number.NaN)

  const marginTop = useLength(() => props.marginTop, 0)
  const marginRight = useLength(() => props.marginRight, 0)
  const marginBottom = useLength(() => props.marginBottom, 0)
  const marginLeft = useLength(() => props.marginLeft, 0)

  return computed(() => ({
    width: unsetIfNaN(width.value),
    height: unsetIfNaN(height.value),
    aspectRatio: unsetIfNaN(aspectRatio.value),
    minWidth: unsetIfNaN(minWidth.value),
    minHeight: unsetIfNaN(minHeight.value),
    maxWidth: unsetIfNaN(maxWidth.value),
    maxHeight: unsetIfNaN(maxHeight.value),
    offsetTop: marginTop.value,
    offsetRight: marginRight.value,
    offsetBottom: marginBottom.value,
    offsetLeft: marginLeft.value,
    ...resolveAlignSelf(props.alignSelf),
  }))
}

// A size that resolves to NaN becomes unset, while an offset keeps the NaN
// as an auto margin, as `Frame.resolve` does.
function size(value: Length.LengthInput | undefined, basis: number): number | undefined {
  return value === undefined ? undefined : unsetIfNaN(Length.resolve(value, basis))
}

function offset(value: Length.LengthInput | undefined, basis: number): number | undefined {
  return value === undefined ? undefined : Length.resolve(value, basis)
}

/**
 * Resolves the shared item props into `Frame.make` input, percentages
 * included. Use it where the layout does not resolve percentages itself,
 * as for hierarchy nodes and edge adornments.
 */
export function useFrameInput(
  props: FrameItemProps,
  basis?: {
    readonly width: MaybeRefOrGetter<number>
    readonly height: MaybeRefOrGetter<number>
  },
): ComputedRef<FrameInput<undefined>> {
  // Without an explicit basis, percentages resolve against the parent rect.
  const x = useOverrideablePercentBasis(basis?.width ?? 'width')
  const y = useOverrideablePercentBasis(basis?.height ?? 'height')

  const lengths = useFrameLengths(props)

  return computed(() => {
    const input = lengths.value
    const width = toValue(x)
    const height = toValue(y)
    return {
      ...input,
      width: size(input.width, width),
      height: size(input.height, height),
      minWidth: size(input.minWidth, width),
      minHeight: size(input.minHeight, height),
      maxWidth: size(input.maxWidth, width),
      maxHeight: size(input.maxHeight, height),
      offsetTop: offset(input.offsetTop, height),
      offsetRight: offset(input.offsetRight, width),
      offsetBottom: offset(input.offsetBottom, height),
      offsetLeft: offset(input.offsetLeft, width),
    }
  })
}
