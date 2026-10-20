// Turns component props into the plain inputs that model props take. Each
// length parses to pixels or a `Length.percent`, and the model resolves the
// percentages against each node's basis (see `placement/unstable/model`).
// An unset size, bound, or inset parses to `NaN`, which the core reads as
// unset.
import type { BoxInput } from 'placement/box'
import type { LengthInput } from 'placement/length'
import type { SizingInput } from 'placement/sizing'
import type * as Model from 'placement/unstable/model'
import type { InsetProps, SizeProps, TranslateProps } from '../composables/useRect.ts'
import { toAspectRatio } from './props/aspectRatio.ts'
import { toLength } from './props/size1d.ts'

/**
 * The sizing fields of `props`.
 *
 * @param props - The size props.
 * @returns The sizing input, with its percentages unresolved.
 */
export function toSizingInput(props: SizeProps): SizingInput<LengthInput> {
  return {
    width: toLength(props.width, Number.NaN),
    height: toLength(props.height, Number.NaN),
    aspectRatio: toAspectRatio(props.aspectRatio, Number.NaN),
    minWidth: toLength(props.minWidth, Number.NaN),
    minHeight: toLength(props.minHeight, Number.NaN),
    maxWidth: toLength(props.maxWidth, Number.NaN),
    maxHeight: toLength(props.maxHeight, Number.NaN),
  }
}

/**
 * The positioned box of `props`: its insets and its sizing.
 *
 * @param props - The inset and size props.
 * @returns The box input, with its percentages unresolved.
 */
export function toBoxInput(props: InsetProps & SizeProps): BoxInput<LengthInput> {
  return {
    top: toLength(props.top, Number.NaN),
    right: toLength(props.right, Number.NaN),
    bottom: toLength(props.bottom, Number.NaN),
    left: toLength(props.left, Number.NaN),
    ...toSizingInput(props),
  }
}

/**
 * The translation of `props`, `0` where unset.
 *
 * @param props - The `x` and `y` props.
 * @returns The translation input, with its percentages unresolved.
 */
export function toTranslateInput(props: TranslateProps): Model.TranslateInput {
  return { x: toLength(props.x, 0), y: toLength(props.y, 0) }
}
