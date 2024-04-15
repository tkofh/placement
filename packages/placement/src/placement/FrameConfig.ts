import type { Frame } from '../frame/Frame'
import {
  type NumericInput,
  NumericProperty,
} from '../properties/NumericProperty'
import {
  type QuantityInput,
  QuantityProperty,
} from '../properties/QuantityProperty'
import { type RatioInput, RatioProperty } from '../properties/RatioProperty'

export interface FrameOptions {
  width: QuantityInput<'auto'>
  height: QuantityInput<'auto'>
  aspectRatio: RatioInput
  minWidth: QuantityInput<'none'>
  minHeight: QuantityInput<'none'>
  maxWidth: QuantityInput<'none'>
  maxHeight: QuantityInput<'none'>
  grow: NumericInput
  shrink: NumericInput
  top: QuantityInput<'auto'>
  right: QuantityInput<'auto'>
  bottom: QuantityInput<'auto'>
  left: QuantityInput<'auto'>
}

export class FrameConfig {
  readonly #frame: Frame

  readonly #width: QuantityProperty<'auto'>
  readonly #height: QuantityProperty<'auto'>

  readonly #aspectRatio: RatioProperty

  readonly #minWidth: QuantityProperty<'none'>
  readonly #minHeight: QuantityProperty<'none'>
  readonly #maxWidth: QuantityProperty<'none'>
  readonly #maxHeight: QuantityProperty<'none'>

  readonly #top: QuantityProperty<'auto' | 'none'>
  readonly #right: QuantityProperty<'auto' | 'none'>
  readonly #bottom: QuantityProperty<'auto' | 'none'>
  readonly #left: QuantityProperty<'auto' | 'none'>

  readonly #grow: NumericProperty
  readonly #shrink: NumericProperty

  readonly #updateTarget: Frame

  constructor(frame: Frame) {
    this.#frame = frame

    this.#width = new QuantityProperty(false, 'width', ['auto'])
    this.#height = new QuantityProperty(false, 'height', ['auto'])

    this.#aspectRatio = new RatioProperty()

    this.#minWidth = new QuantityProperty(false, 'width', ['none'])
    this.#minHeight = new QuantityProperty(false, 'height', ['none'])
    this.#maxWidth = new QuantityProperty(false, 'width', ['none'])
    this.#maxHeight = new QuantityProperty(false, 'height', ['none'])
    this.#minWidth.value = 'none'
    this.#minHeight.value = 'none'
    this.#maxWidth.value = 'none'
    this.#maxHeight.value = 'none'

    this.#top = new QuantityProperty(true, 'height', ['auto', 'none'])
    this.#right = new QuantityProperty(true, 'width', ['auto', 'none'])
    this.#bottom = new QuantityProperty(true, 'height', ['auto', 'none'])
    this.#left = new QuantityProperty(true, 'width', ['auto', 'none'])
    this.#top.value = 'none'
    this.#right.value = 'none'
    this.#bottom.value = 'none'
    this.#left.value = 'none'

    this.#grow = new NumericProperty()
    this.#shrink = new NumericProperty()

    this.#updateTarget = frame.parent ?? frame
  }

  //region Properties
  get width(): number | 'auto' {
    const width = this.#width.compute(this.#parentRect, this.#rootRect)

    if (width !== 'auto') {
      return width
    }

    const height = this.#height.compute(this.#parentRect, this.#rootRect)
    if (this.#aspectRatio.value !== 'none' && height !== 'auto') {
      return height * this.#aspectRatio.value
    }

    return 'auto'
  }
  set width(value: QuantityInput<'auto'>) {
    this.#width.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get height(): number | 'auto' {
    const height = this.#height.compute(this.#parentRect, this.#rootRect)
    if (height !== 'auto') {
      return height
    }

    const width = this.#width.compute(this.#parentRect, this.#rootRect)
    if (this.#aspectRatio.value !== 'none' && width !== 'auto') {
      return width / this.#aspectRatio.value
    }

    return 'auto'
  }
  set height(value: QuantityInput<'auto'>) {
    this.#height.value = value
    // this.#updateTarget.markNeedsUpdate()
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
    // this.#updateTarget.markNeedsUpdate()
  }

  get minWidth(): number {
    const minWidth = this.#minWidth.compute(this.#parentRect, this.#rootRect)

    if (minWidth === 'none') {
      return 0
    }

    return minWidth
  }
  set minWidth(value: QuantityInput<'none'>) {
    this.#minWidth.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get minHeight(): number {
    const minHeight = this.#minHeight.compute(this.#parentRect, this.#rootRect)

    if (minHeight === 'none') {
      return 0
    }

    return minHeight
  }
  set minHeight(value: QuantityInput<'none'>) {
    this.#minHeight.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get maxWidth(): number {
    const maxWidth = this.#maxWidth.compute(this.#parentRect, this.#rootRect)

    if (maxWidth === 'none') {
      return Number.POSITIVE_INFINITY
    }

    return maxWidth
  }
  set maxWidth(value: QuantityInput<'none'>) {
    this.#maxWidth.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get maxHeight(): number {
    const maxHeight = this.#maxHeight.compute(this.#parentRect, this.#rootRect)

    if (maxHeight === 'none') {
      return Number.POSITIVE_INFINITY
    }

    return maxHeight
  }
  set maxHeight(value: QuantityInput<'none'>) {
    this.#maxHeight.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get grow(): number {
    return this.#grow.value
  }
  set grow(value: NumericInput) {
    this.#grow.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get shrink(): number {
    return this.#shrink.value
  }
  set shrink(value: NumericInput) {
    this.#shrink.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get top(): number | 'auto' | 'none' {
    return this.#top.compute(this.#parentRect, this.#rootRect)
  }
  set top(value: QuantityInput<'auto'>) {
    this.#top.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get right(): number | 'auto' | 'none' {
    return this.#right.compute(this.#parentRect, this.#rootRect)
  }
  set right(value: QuantityInput<'auto'>) {
    this.#right.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get bottom(): number | 'auto' | 'none' {
    return this.#bottom.compute(this.#parentRect, this.#rootRect)
  }
  set bottom(value: QuantityInput<'auto'>) {
    this.#bottom.value = value
    // this.#updateTarget.markNeedsUpdate()
  }

  get left(): number | 'auto' | 'none' {
    return this.#left.compute(this.#parentRect, this.#rootRect)
  }
  set left(value: QuantityInput<'auto'>) {
    this.#left.value = value
    // this.#updateTarget.markNeedsUpdate()
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
}
