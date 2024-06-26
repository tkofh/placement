import { Property } from '../property/property'
import type { Input } from '../property/types'

const autoLengthPercent = {
  keyword: ['auto'],
  length: true,
  percentage: true,
  allowNegative: false,
} as const

type AutoLengthPercent = typeof autoLengthPercent
export type AutoLengthPercentInput = Input<AutoLengthPercent>

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
  percentage: true,
  allowNegative: false,
} as const

type NoneLengthPercent = typeof noneLengthPercent

export type NoneLengthPercentInput = Input<NoneLengthPercent>

const autoNoneLengthPercentNegative = {
  keyword: ['auto', 'none'],
  length: true,
  percentage: true,
  allowNegative: true,
} as const

type AutoNoneLengthPercentNegative = typeof autoNoneLengthPercentNegative

export type AutoNoneLengthPercentNegativeInput =
  Input<AutoNoneLengthPercentNegative>

const lengthPercentNegative = {
  length: true,
  percentage: true,
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

export class FrameProperties {
  #width?: Property<AutoLengthPercent>
  #height?: Property<AutoLengthPercent>

  #aspectRatio?: Property<AutoRatio>

  #minWidth?: Property<NoneLengthPercent>
  #minHeight?: Property<NoneLengthPercent>
  #maxWidth?: Property<NoneLengthPercent>
  #maxHeight?: Property<NoneLengthPercent>

  #offsetTop?: Property<AutoNoneLengthPercentNegative>
  #offsetRight?: Property<AutoNoneLengthPercentNegative>
  #offsetBottom?: Property<AutoNoneLengthPercentNegative>
  #offsetLeft?: Property<AutoNoneLengthPercentNegative>

  #insetTop?: Property<LengthPercentNegative>
  #insetRight?: Property<LengthPercentNegative>
  #insetBottom?: Property<LengthPercentNegative>
  #insetLeft?: Property<LengthPercentNegative>

  #translateX?: Property<LengthPercentNegative>
  #translateY?: Property<LengthPercentNegative>

  #grow?: Property<NoneNumber>
  #shrink?: Property<NoneNumber>

  #flexDirection?: Property<FlexDirection>
  #flexWrap?: Property<FlexWrap>

  #justifyContent?: Property<ScalarNumber>
  // #justifyItems?: Property<ScalarNumber>
  // #justifySelf?: Property<AutoScalarNumber>

  #alignContent?: Property<ScalarNumber>
  #alignItems?: Property<ScalarNumber>
  #alignSelf?: Property<AutoScalarNumber>

  #stretchContent?: Property<AutoScalarNumber>
  #stretchItems?: Property<ScalarNumber>
  #stretchSelf?: Property<AutoScalarNumber>

  #rowGap?: Property<NoneLengthPercent>
  #columnGap?: Property<NoneLengthPercent>

  #justifyContentSpace?: Property<ScalarNumber>
  #justifyContentSpaceOuter?: Property<ScalarNumber>

  #alignContentSpace?: Property<ScalarNumber>
  #alignContentSpaceOuter?: Property<ScalarNumber>

  get width() {
    this.#width ||= new Property(autoLengthPercent, 'auto')
    return this.#width
  }
  get height() {
    this.#height ||= new Property(autoLengthPercent, 'auto')
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
    this.#minHeight ||= new Property(noneLengthPercent, 'none')
    return this.#minHeight
  }
  get maxWidth() {
    this.#maxWidth ||= new Property(noneLengthPercent, 'none')
    return this.#maxWidth
  }
  get maxHeight() {
    this.#maxHeight ||= new Property(noneLengthPercent, 'none')
    return this.#maxHeight
  }

  get offsetTop() {
    this.#offsetTop ||= new Property(autoNoneLengthPercentNegative, 'none')
    return this.#offsetTop
  }
  get offsetRight() {
    this.#offsetRight ||= new Property(autoNoneLengthPercentNegative, 'none')
    return this.#offsetRight
  }
  get offsetBottom() {
    this.#offsetBottom ||= new Property(autoNoneLengthPercentNegative, 'none')
    return this.#offsetBottom
  }
  get offsetLeft() {
    this.#offsetLeft ||= new Property(autoNoneLengthPercentNegative, 'none')
    return this.#offsetLeft
  }

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

  get translateX() {
    this.#translateX ||= new Property(lengthPercentNegative, 0)
    return this.#translateX
  }
  get translateY() {
    this.#translateY ||= new Property(lengthPercentNegative, 0)
    return this.#translateY
  }

  get grow() {
    this.#grow ||= new Property(noneNumber, 0)
    return this.#grow
  }
  get shrink() {
    this.#shrink ||= new Property(noneNumber, 0)
    return this.#shrink
  }

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
  // get justifyItems() {
  //   this.#justifyItems ||= new Property(scalarNumber, 0)
  //
  //   return this.#justifyItems
  // }
  // get justifySelf() {
  //   this.#justifySelf ||= new Property(autoScalarNumber, 'auto')
  //
  //   return this.#justifySelf
  // }

  get alignContent() {
    this.#alignContent ||= new Property(scalarNumber, 0)

    return this.#alignContent
  }
  get alignItems() {
    this.#alignItems ||= new Property(scalarNumber, 0)
    return this.#alignItems
  }
  get alignSelf() {
    this.#alignSelf ||= new Property(autoScalarNumber, 'auto')
    return this.#alignSelf
  }

  get stretchContent() {
    this.#stretchContent ||= new Property(autoScalarNumber, 'auto')

    return this.#stretchContent
  }
  get stretchItems() {
    this.#stretchItems ||= new Property(scalarNumber, 0)

    return this.#stretchItems
  }
  get stretchSelf() {
    this.#stretchSelf ||= new Property(autoScalarNumber, 'auto')

    return this.#stretchSelf
  }

  get rowGap() {
    this.#rowGap ||= new Property(noneLengthPercent, 0)

    return this.#rowGap
  }
  get columnGap() {
    this.#columnGap ||= new Property(noneLengthPercent, 0)

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
}
