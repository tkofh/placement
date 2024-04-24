import type { Input } from '../property'
import { Property } from '../property/Property'

const autoLengthPercent = {
  keyword: ['auto'],
  length: true,
  percentage: 'width',
  allowNegative: false,
} as const

type AutoLengthPercent = typeof autoLengthPercent

const autoLengthVerticalPercent = {
  keyword: ['auto'],
  length: true,
  percentage: 'height',
  allowNegative: false,
} as const

type AutoLengthVerticalPercent = typeof autoLengthVerticalPercent
export type AutoLengthPercentInput = Input<
  AutoLengthPercent | AutoLengthVerticalPercent
>

const autoRatio = {
  keyword: ['auto'],
  ratio: true,
  allowNegative: false,
} as const

type AutoRatio = typeof autoRatio

export type AutoRatioInput = Input<AutoRatio>

const autoScalarNumber = {
  keyword: ['auto'],
  number: true,
  allowNegative: false,
} as const

type AutoScalarNumber = typeof autoScalarNumber

export type AutoScalarNumberInput = Input<AutoScalarNumber>

const noneLengthPercent = {
  keyword: ['none'],
  length: true,
  percentage: 'width',
  allowNegative: false,
} as const

type NoneLengthPercent = typeof noneLengthPercent

const noneLengthVerticalPercent = {
  keyword: ['none'],
  length: true,
  percentage: 'height',
  allowNegative: false,
} as const

type NoneLengthVerticalPercent = typeof noneLengthVerticalPercent

export type NoneLengthPercentInput = Input<
  NoneLengthPercent | NoneLengthVerticalPercent
>

const autoNoneLengthPercentNegative = {
  keyword: ['auto', 'none'],
  length: true,
  percentage: 'width',
  allowNegative: true,
} as const

type AutoNoneLengthPercentNegative = typeof autoNoneLengthPercentNegative

const autoNoneLengthVerticalPercentNegative = {
  keyword: ['auto', 'none'],
  length: true,
  percentage: 'height',
  allowNegative: true,
} as const

type AutoNoneLengthVerticalPercentNegative =
  typeof autoNoneLengthVerticalPercentNegative

export type AutoNoneLengthPercentNegativeInput = Input<
  AutoNoneLengthPercentNegative | AutoNoneLengthVerticalPercentNegative
>

const lengthPercentNegative = {
  length: true,
  percentage: 'width',
  allowNegative: true,
} as const

type LengthPercentNegative = typeof lengthPercentNegative

export type LengthPercentNegativeInput = Input<LengthPercentNegative>

const noneNumber = {
  keyword: ['none'],
  number: true,
  allowNegative: false,
} as const

type NoneNumber = typeof noneNumber

export type NoneNumberInput = Input<NoneNumber>

const scalarNumber = {
  number: true,
  allowNegative: false,
} as const

type ScalarNumber = typeof scalarNumber

export type ScalarNumberInput = Input<ScalarNumber>

const flexDirection = {
  keyword: ['row', 'row-reverse', 'column', 'column-reverse'],
} as const

type FlexDirection = typeof flexDirection

export type FlexDirectionInput = Input<FlexDirection>

const flexWrap = {
  keyword: ['nowrap', 'wrap', 'wrap-reverse'],
} as const

type FlexWrap = typeof flexWrap

export type FlexWrapInput = Input<FlexWrap>

export interface FrameOptions {
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
  alignContent?: ScalarNumberInput
  alignItems?: ScalarNumberInput
  alignSelf?: ScalarNumberInput
  placeContent?: ScalarNumberInput
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

export class FrameProperties {
  //region Sizing
  #width?: Property<AutoLengthPercent>
  #height?: Property<AutoLengthVerticalPercent>

  #aspectRatio?: Property<AutoRatio>

  #minWidth?: Property<NoneLengthPercent>
  #minHeight?: Property<NoneLengthVerticalPercent>
  #maxWidth?: Property<NoneLengthPercent>
  #maxHeight?: Property<NoneLengthVerticalPercent>

  get width() {
    this.#width ||= new Property(autoLengthPercent, 'auto')
    return this.#width
  }
  get height() {
    this.#height ||= new Property(autoLengthVerticalPercent, 'auto')
    return this.#height
  }

  get aspectRatio() {
    this.#aspectRatio ||= new Property(autoRatio, 'auto')
    return this.#aspectRatio
  }

  get minWidth() {
    this.#minWidth ||= new Property(noneLengthPercent, 'none')
    return this.#minWidth
  }
  get minHeight() {
    this.#minHeight ||= new Property(noneLengthVerticalPercent, 'none')
    return this.#minHeight
  }
  get maxWidth() {
    this.#maxWidth ||= new Property(noneLengthPercent, 'none')
    return this.#maxWidth
  }
  get maxHeight() {
    this.#maxHeight ||= new Property(noneLengthVerticalPercent, 'none')
    return this.#maxHeight
  }

  #serializeSizing(output: Record<string, string | number>) {
    if (this.#width) {
      output.width = this.#width.value
    }
    if (this.#height) {
      output.height = this.#height.value
    }
    if (this.#aspectRatio) {
      output.aspectRatio = this.#aspectRatio.value
    }
    if (this.#minWidth) {
      output.minWidth = this.#minWidth.value
    }
    if (this.#minHeight) {
      output.minHeight = this.#minHeight.value
    }
    if (this.#maxWidth) {
      output.maxWidth = this.#maxWidth.value
    }
    if (this.#maxHeight) {
      output.maxHeight = this.#maxHeight.value
    }
  }
  //endregion

  //region Positioning
  #offsetTop?: Property<AutoNoneLengthVerticalPercentNegative>
  #offsetRight?: Property<AutoNoneLengthPercentNegative>
  #offsetBottom?: Property<AutoNoneLengthVerticalPercentNegative>
  #offsetLeft?: Property<AutoNoneLengthPercentNegative>

  #translateX?: Property<LengthPercentNegative>
  #translateY?: Property<LengthPercentNegative>

  get offsetTop() {
    this.#offsetTop ||= new Property(
      autoNoneLengthVerticalPercentNegative,
      'none',
    )
    return this.#offsetTop
  }
  get offsetRight() {
    this.#offsetRight ||= new Property(autoNoneLengthPercentNegative, 'none')
    return this.#offsetRight
  }
  get offsetBottom() {
    this.#offsetBottom ||= new Property(
      autoNoneLengthVerticalPercentNegative,
      'none',
    )
    return this.#offsetBottom
  }
  get offsetLeft() {
    this.#offsetLeft ||= new Property(autoNoneLengthPercentNegative, 'none')
    return this.#offsetLeft
  }

  get translateX() {
    this.#translateX ||= new Property(lengthPercentNegative, 0)
    return this.#translateX
  }
  get translateY() {
    this.#translateY ||= new Property(lengthPercentNegative, 0)
    return this.#translateY
  }

  #serializePositioning(output: Record<string, string | number>) {
    if (this.#offsetTop) {
      output.offsetTop = this.#offsetTop.value
    }
    if (this.#offsetRight) {
      output.offsetRight = this.#offsetRight.value
    }
    if (this.#offsetBottom) {
      output.offsetBottom = this.#offsetBottom.value
    }
    if (this.#offsetLeft) {
      output.offsetLeft = this.#offsetLeft.value
    }
    if (this.#translateX) {
      output.translateX = this.#translateX.value
    }
    if (this.#translateY) {
      output.translateY = this.#translateY.value
    }
  }
  //endregion

  //region General Layout
  #insetTop?: Property<LengthPercentNegative>
  #insetRight?: Property<LengthPercentNegative>
  #insetBottom?: Property<LengthPercentNegative>
  #insetLeft?: Property<LengthPercentNegative>

  get insetTop() {
    this.#insetTop ||= new Property(lengthPercentNegative, 0)
    return this.#insetTop
  }
  get insetRight() {
    this.#insetRight ||= new Property(lengthPercentNegative, 0)
    return this.#insetRight
  }
  get insetBottom() {
    this.#insetBottom ||= new Property(lengthPercentNegative, 0)
    return this.#insetBottom
  }
  get insetLeft() {
    this.#insetLeft ||= new Property(lengthPercentNegative, 0)
    return this.#insetLeft
  }

  #serializeGeneralLayout(output: Record<string, string | number>) {
    if (this.#insetTop) {
      output.insetTop = this.#insetTop.value
    }
    if (this.#insetRight) {
      output.insetRight = this.#insetRight.value
    }
    if (this.#insetBottom) {
      output.insetBottom = this.#insetBottom.value
    }
    if (this.#insetLeft) {
      output.insetLeft = this.#insetLeft.value
    }
  }
  //endregion

  //region Flex Item
  #grow?: Property<NoneNumber>
  #shrink?: Property<NoneNumber>

  #alignSelf?: Property<AutoScalarNumber>

  #stretchSelf?: Property<AutoScalarNumber>

  get grow() {
    this.#grow ||= new Property(noneNumber, 0)
    return this.#grow
  }
  get shrink() {
    this.#shrink ||= new Property(noneNumber, 0)
    return this.#shrink
  }

  get stretchSelf() {
    this.#stretchSelf ||= new Property(autoScalarNumber, 'auto')

    return this.#stretchSelf
  }

  get alignSelf() {
    this.#alignSelf ||= new Property(autoScalarNumber, 'auto')
    return this.#alignSelf
  }

  #serializeFlexItem(output: Record<string, string | number>) {
    if (this.#grow) {
      output.grow = this.#grow.value
    }
    if (this.#shrink) {
      output.shrink = this.#shrink.value
    }
    if (this.#alignSelf) {
      output.alignSelf = this.#alignSelf.value
    }
    if (this.#stretchSelf) {
      output.stretchSelf = this.#stretchSelf.value
    }
  }
  //endregion

  //region Flex Container
  #flexDirection?: Property<FlexDirection>
  #flexWrap?: Property<FlexWrap>

  #justifyContent?: Property<ScalarNumber>

  #alignContent?: Property<ScalarNumber>
  #alignItems?: Property<ScalarNumber>

  #stretchContent?: Property<AutoScalarNumber>
  #stretchItems?: Property<ScalarNumber>

  #rowGap?: Property<NoneLengthPercent>
  #columnGap?: Property<NoneLengthVerticalPercent>

  #justifyContentSpace?: Property<ScalarNumber>
  #justifyContentSpaceOuter?: Property<ScalarNumber>

  #alignContentSpace?: Property<ScalarNumber>
  #alignContentSpaceOuter?: Property<ScalarNumber>

  get flexDirection() {
    this.#flexDirection ||= new Property(flexDirection, 'row')
    return this.#flexDirection
  }
  get flexWrap() {
    this.#flexWrap ||= new Property(flexWrap, 'nowrap')
    return this.#flexWrap
  }

  get justifyContent() {
    this.#justifyContent ||= new Property(scalarNumber, 0)
    return this.#justifyContent
  }

  get alignContent() {
    this.#alignContent ||= new Property(scalarNumber, 0)

    return this.#alignContent
  }
  get alignItems() {
    this.#alignItems ||= new Property(scalarNumber, 0)
    return this.#alignItems
  }

  get stretchContent() {
    this.#stretchContent ||= new Property(autoScalarNumber, 'auto')

    return this.#stretchContent
  }
  get stretchItems() {
    this.#stretchItems ||= new Property(scalarNumber, 0)

    return this.#stretchItems
  }

  get rowGap() {
    this.#rowGap ||= new Property(noneLengthPercent, 0)

    return this.#rowGap
  }
  get columnGap() {
    this.#columnGap ||= new Property(noneLengthVerticalPercent, 0)

    return this.#columnGap
  }

  get justifyContentSpace() {
    this.#justifyContentSpace ||= new Property(scalarNumber, 0)

    return this.#justifyContentSpace
  }
  get justifyContentSpaceOuter() {
    this.#justifyContentSpaceOuter ||= new Property(scalarNumber, 0)

    return this.#justifyContentSpaceOuter
  }

  get alignContentSpace() {
    this.#alignContentSpace ||= new Property(scalarNumber, 0)

    return this.#alignContentSpace
  }
  get alignContentSpaceOuter() {
    this.#alignContentSpaceOuter ||= new Property(scalarNumber, 0)

    return this.#alignContentSpaceOuter
  }

  #serializeFlexContainer(output: Record<string, string | number>) {
    if (this.#flexDirection) {
      output.flexDirection = this.#flexDirection.value
    }
    if (this.#flexWrap) {
      output.flexWrap = this.#flexWrap.value
    }
    if (this.#justifyContent) {
      output.justifyContent = this.#justifyContent.value
    }
    if (this.#alignContent) {
      output.alignContent = this.#alignContent.value
    }
    if (this.#alignItems) {
      output.alignItems = this.#alignItems.value
    }
    if (this.#stretchContent) {
      output.stretchContent = this.#stretchContent.value
    }
    if (this.#stretchItems) {
      output.stretchItems = this.#stretchItems.value
    }
    if (this.#rowGap) {
      output.rowGap = this.#rowGap.value
    }
    if (this.#columnGap) {
      output.columnGap = this.#columnGap.value
    }
    if (this.#justifyContentSpace) {
      output.justifyContentSpace = this.#justifyContentSpace.value
    }
    if (this.#justifyContentSpaceOuter) {
      output.justifyContentSpaceOuter = this.#justifyContentSpaceOuter.value
    }
    if (this.#alignContentSpace) {
      output.alignContentSpace = this.#alignContentSpace.value
    }
    if (this.#alignContentSpaceOuter) {
      output.alignContentSpaceOuter = this.#alignContentSpaceOuter.value
    }
  }
  //endregion

  serialize() {
    const serialized: Record<string, string | number> = {}

    this.#serializeSizing(serialized)
    this.#serializePositioning(serialized)
    this.#serializeGeneralLayout(serialized)
    this.#serializeFlexItem(serialized)
    this.#serializeFlexContainer(serialized)

    return serialized
  }
}
