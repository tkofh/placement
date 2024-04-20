import { stripUndefined } from '../utils'
import { Frame } from './Frame'
import type {
  AutoLengthPercentInput,
  AutoNoneLengthPercentNegativeInput,
  AutoRatioInput,
  AutoScalarNumberInput,
  FlexDirectionInput,
  FlexWrapInput,
  LengthPercentNegativeInput,
  NoneLengthPercentInput,
  NoneNumberInput,
  ScalarNumberInput,
} from './FrameProperties'

export interface FrameOptions {
  layout: 'flex' | 'absolute'
  width?: AutoLengthPercentInput
  height?: AutoLengthPercentInput
  aspectRatio?: AutoRatioInput
  insetTop?: LengthPercentNegativeInput
  insetRight?: LengthPercentNegativeInput
  insetBottom?: LengthPercentNegativeInput
  insetLeft?: LengthPercentNegativeInput
  insetX?: LengthPercentNegativeInput
  insetY?: LengthPercentNegativeInput
  inset?: LengthPercentNegativeInput
  offsetTop?: AutoNoneLengthPercentNegativeInput
  offsetRight?: AutoNoneLengthPercentNegativeInput
  offsetBottom?: AutoNoneLengthPercentNegativeInput
  offsetLeft?: AutoNoneLengthPercentNegativeInput
  offsetX?: AutoNoneLengthPercentNegativeInput
  offsetY?: AutoNoneLengthPercentNegativeInput
  offset?: AutoNoneLengthPercentNegativeInput
  minWidth?: NoneLengthPercentInput
  minHeight?: NoneLengthPercentInput
  maxWidth?: NoneLengthPercentInput
  maxHeight?: NoneLengthPercentInput
  translateX?: LengthPercentNegativeInput
  translateY?: LengthPercentNegativeInput
  translate?: LengthPercentNegativeInput
  grow?: NoneNumberInput
  shrink?: NoneNumberInput
  flexDirection?: FlexDirectionInput
  flexWrap?: FlexWrapInput
  rowGap?: LengthPercentNegativeInput
  columnGap?: LengthPercentNegativeInput
  gap?: LengthPercentNegativeInput
  justifyContent?: ScalarNumberInput
  // justifyItems?: ScalarNumberInput
  // justifySelf?: ScalarNumberInput
  alignContent?: ScalarNumberInput
  alignItems?: ScalarNumberInput
  alignSelf?: ScalarNumberInput
  placeContent?: ScalarNumberInput
  // placeItems?: ScalarNumberInput
  // placeSelf?: ScalarNumberInput
  justifyContentSpace?: ScalarNumberInput
  justifyContentSpaceOuter?: ScalarNumberInput
  alignContentSpace?: ScalarNumberInput
  alignContentSpaceOuter?: ScalarNumberInput
  placeContentSpace?: ScalarNumberInput
  placeContentSpaceOuter?: ScalarNumberInput
  stretchContent?: AutoScalarNumberInput
  stretchItems?: ScalarNumberInput
  stretchSelf?: ScalarNumberInput
}

export function createFrame(options: FrameOptions) {
  const { layout, ...props } = options
  const frame = new Frame(layout)

  Object.assign(frame, stripUndefined(props))

  return frame
}
