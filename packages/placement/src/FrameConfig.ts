import type { Frame } from './Frame'
import {
  type NumericInput,
  NumericProperty,
} from './properties/NumericProperty'
import {
  type QuantityInput,
  QuantityProperty,
} from './properties/QuantityProperty'
import { type RatioInput, RatioProperty } from './properties/RatioProperty'
import { clamp } from './utils'

export interface FrameOptions {
  width: QuantityInput<'auto'>
  height: QuantityInput<'auto'>
  x: QuantityInput
  y: QuantityInput
  aspectRatio: RatioInput
  minWidth: QuantityInput<'auto'>
  minHeight: QuantityInput<'auto'>
  maxWidth: QuantityInput<'none'>
  maxHeight: QuantityInput<'none'>
  grow: NumericInput
  shrink: NumericInput
  paddingTop: QuantityInput
  paddingRight: QuantityInput
  paddingBottom: QuantityInput
  paddingLeft: QuantityInput
  marginTop: QuantityInput<'auto'>
  marginRight: QuantityInput<'auto'>
  marginBottom: QuantityInput<'auto'>
  marginLeft: QuantityInput<'auto'>
}

export class FrameConfig {
  readonly #frame: Frame

  readonly #x: QuantityProperty
  readonly #y: QuantityProperty

  readonly #width: QuantityProperty<'auto'>
  readonly #height: QuantityProperty<'auto'>

  readonly #aspectRatio: RatioProperty

  readonly #minWidth: QuantityProperty<'auto'>
  readonly #minHeight: QuantityProperty<'auto'>
  readonly #maxWidth: QuantityProperty<'none'>
  readonly #maxHeight: QuantityProperty<'none'>

  readonly #paddingTop: QuantityProperty
  readonly #paddingRight: QuantityProperty
  readonly #paddingBottom: QuantityProperty
  readonly #paddingLeft: QuantityProperty
  readonly #marginTop: QuantityProperty<'auto'>
  readonly #marginRight: QuantityProperty<'auto'>
  readonly #marginBottom: QuantityProperty<'auto'>
  readonly #marginLeft: QuantityProperty<'auto'>

  readonly #grow: NumericProperty
  readonly #shrink: NumericProperty

  readonly #updateTarget: Frame

  constructor(frame: Frame) {
    this.#frame = frame

    this.#x = new QuantityProperty(false, 'width')
    this.#y = new QuantityProperty(false, 'height')

    this.#width = new QuantityProperty(false, 'width', ['auto'])
    this.#height = new QuantityProperty(false, 'height')

    this.#aspectRatio = new RatioProperty()

    this.#minWidth = new QuantityProperty(false, 'width')
    this.#minHeight = new QuantityProperty(false, 'height')
    this.#maxWidth = new QuantityProperty(false, 'width', ['none'])
    this.#maxWidth.value = 'none'
    this.#maxHeight = new QuantityProperty(false, 'height', ['none'])
    this.#maxHeight.value = 'none'

    this.#paddingTop = new QuantityProperty(false, 'height')
    this.#paddingRight = new QuantityProperty(false, 'width')
    this.#paddingBottom = new QuantityProperty(false, 'height')
    this.#paddingLeft = new QuantityProperty(false, 'width')
    this.#marginTop = new QuantityProperty(true, 'height', ['auto'])
    this.#marginRight = new QuantityProperty(true, 'width', ['auto'])
    this.#marginBottom = new QuantityProperty(true, 'height', ['auto'])
    this.#marginLeft = new QuantityProperty(true, 'width', ['auto'])

    this.#grow = new NumericProperty()
    this.#shrink = new NumericProperty()

    this.#updateTarget = frame.parent ?? frame
  }
  //region Properties
  get width(): number {
    const width = this.#width.compute(this.#parentRect, this.#rootRect)

    if (width !== 'auto') {
      return width
    }

    const height = this.#height.compute(this.#parentRect, this.#rootRect)
    if (this.#aspectRatio.value !== 'none' && height !== 'auto') {
      return height * this.#aspectRatio.value
    }

    return 0
  }
  set width(value: QuantityInput<'auto'>) {
    this.#width.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get height(): number {
    const height = this.#height.compute(this.#parentRect, this.#rootRect)
    if (height !== 'auto') {
      return height
    }

    const width = this.#width.compute(this.#parentRect, this.#rootRect)
    if (this.#aspectRatio.value !== 'none' && width !== 'auto') {
      return width / this.#aspectRatio.value
    }

    return 0
  }
  set height(value: QuantityInput<'auto'>) {
    this.#height.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get x(): number {
    return this.#x.compute(this.#parentRect, this.#rootRect)
  }
  set x(value: QuantityInput) {
    this.#x.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get y(): number {
    return this.#y.compute(this.#parentRect, this.#rootRect)
  }
  set y(value: QuantityInput) {
    this.#y.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get aspectRatio(): number | 'none' {
    if (this.#aspectRatio.value !== 'none') {
      return this.#aspectRatio.value
    }

    const width = this.#width.compute(this.#parentRect, this.#rootRect)
    const height = this.#height.compute(this.#parentRect, this.#rootRect)

    if (width !== 'auto' && height !== 'auto' && width > 0 && height > 0) {
      return width / height
    }

    return 'none'
  }
  set aspectRatio(value: RatioInput) {
    this.#aspectRatio.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get minWidth(): number {
    const minWidth = this.#minWidth.compute(this.#parentRect, this.#rootRect)

    if (minWidth !== 'auto') {
      return minWidth
    }
    return this.width
  }
  set minWidth(value: QuantityInput<'auto'>) {
    this.#minWidth.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get minHeight(): number | null {
    const minHeight = this.#minHeight.compute(this.#parentRect, this.#rootRect)

    if (minHeight !== 'auto') {
      return minHeight
    }
    return this.height
  }
  set minHeight(value: QuantityInput<'auto'>) {
    this.#minHeight.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get maxWidth(): number {
    const maxWidth = this.#maxWidth.compute(this.#parentRect, this.#rootRect)

    if (maxWidth !== 'none') {
      return maxWidth
    }

    return Number.POSITIVE_INFINITY
  }
  set maxWidth(value: QuantityInput<'none'>) {
    this.#maxWidth.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get maxHeight(): number | null {
    const maxHeight = this.#maxHeight.compute(this.#parentRect, this.#rootRect)

    if (maxHeight !== 'none') {
      return maxHeight
    }

    return Number.POSITIVE_INFINITY
  }
  set maxHeight(value: QuantityInput<'none'>) {
    this.#maxHeight.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get grow(): number {
    return this.#grow.value
  }
  set grow(value: NumericInput) {
    this.#grow.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get shrink(): number {
    return this.#shrink.value
  }
  set shrink(value: NumericInput) {
    this.#shrink.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get paddingTop(): number {
    return this.#paddingTop.compute(this.#parentRect, this.#rootRect)
  }
  set paddingTop(value: QuantityInput) {
    this.#paddingTop.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get paddingRight(): number {
    return this.#paddingRight.compute(this.#parentRect, this.#rootRect)
  }
  set paddingRight(value: QuantityInput) {
    this.#paddingRight.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get paddingBottom(): number {
    return this.#paddingBottom.compute(this.#parentRect, this.#rootRect)
  }
  set paddingBottom(value: QuantityInput) {
    this.#paddingBottom.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get paddingLeft(): number {
    return this.#paddingLeft.compute(this.#parentRect, this.#rootRect)
  }
  set paddingLeft(value: QuantityInput) {
    this.#paddingLeft.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  // auto will be
  get marginTop(): number | 'auto' {
    return this.#marginTop.compute(this.#parentRect, this.#rootRect)
  }
  set marginTop(value: QuantityInput<'auto'>) {
    this.#marginTop.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get marginRight(): number | 'auto' {
    return this.#marginRight.compute(this.#parentRect, this.#rootRect)
  }
  set marginRight(value: QuantityInput<'auto'>) {
    this.#marginRight.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get marginBottom(): number | 'auto' {
    return this.#marginBottom.compute(this.#parentRect, this.#rootRect)
  }
  set marginBottom(value: QuantityInput<'auto'>) {
    this.#marginBottom.value = value
    this.#updateTarget.markNeedsUpdate()
  }

  get marginLeft(): number | 'auto' {
    return this.#marginLeft.compute(this.#parentRect, this.#rootRect)
  }
  set marginLeft(value: QuantityInput<'auto'>) {
    this.#marginLeft.value = value
    this.#updateTarget.markNeedsUpdate()
  }
  //endregion

  //region Computed Properties
  get effectiveMinWidth(): number {
    return Math.max(this.minWidth ?? 0, this.paddingLeft + this.paddingRight)
  }

  get effectiveMaxWidth(): number {
    return Math.max(
      this.maxWidth ?? Number.POSITIVE_INFINITY,
      this.effectiveMinWidth,
    )
  }

  get effectiveMinHeight(): number {
    return Math.max(this.minHeight ?? 0, this.paddingTop + this.paddingBottom)
  }

  get effectiveMaxHeight(): number {
    return Math.max(
      this.maxHeight ?? Number.POSITIVE_INFINITY,
      this.effectiveMinHeight,
    )
  }

  get constrainedWidth(): number {
    return clamp(this.width, this.effectiveMinWidth, this.effectiveMaxWidth)
  }

  get constrainedHeight(): number {
    return clamp(this.height, this.effectiveMinHeight, this.effectiveMaxHeight)
  }
  //endregion

  get #parentRect() {
    return this.#frame.parent?.innerRect ?? this.#frame.rect
  }

  get #rootRect() {
    if (this.#frame.root === this.#frame) {
      return this.#frame.rect
    }
    return this.#frame.root.innerRect
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: todo refactor after we switch to factories
  configure(options: Partial<FrameOptions>) {
    if (options.width != null) {
      this.#width.value = options.width
    }
    if (options.height != null) {
      this.#height.value = options.height
    }
    if (options.x != null) {
      this.#x.value = options.x
    }
    if (options.y != null) {
      this.#y.value = options.y
    }
    if (options.aspectRatio != null) {
      this.#aspectRatio.value = options.aspectRatio
    }
    if (options.minWidth != null) {
      this.#minWidth.value = options.minWidth
    }
    if (options.minHeight != null) {
      this.#minHeight.value = options.minHeight
    }
    if (options.maxWidth != null) {
      this.#maxWidth.value = options.maxWidth
    }
    if (options.maxHeight != null) {
      this.#maxHeight.value = options.maxHeight
    }
    if (options.grow != null) {
      this.#shrink.value = options.grow
    }
    if (options.shrink != null) {
      this.#grow.value = options.shrink
    }
    if (options.paddingTop != null) {
      this.#paddingTop.value = options.paddingTop
    }
    if (options.paddingRight != null) {
      this.#paddingRight.value = options.paddingRight
    }
    if (options.paddingBottom != null) {
      this.#paddingBottom.value = options.paddingBottom
    }
    if (options.paddingLeft != null) {
      this.#paddingLeft.value = options.paddingLeft
    }
    if (options.marginTop != null) {
      this.#marginTop.value = options.marginTop
    }
    if (options.marginRight != null) {
      this.#marginRight.value = options.marginRight
    }
    if (options.marginBottom != null) {
      this.#marginBottom.value = options.marginBottom
    }
    if (options.marginLeft != null) {
      this.#marginLeft.value = options.marginLeft
    }

    this.#updateTarget.markNeedsUpdate()
  }
}
