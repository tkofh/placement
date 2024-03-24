import type { AspectRatio } from './AspectRatio'
import type { Size } from './Size'
import type { SizeConstraint } from './SizeConstraint'

interface DimensionsOptions {
  width: Size
  height: Size

  aspectRatio: AspectRatio

  minWidth: SizeConstraint
  maxWidth: SizeConstraint

  minHeight: SizeConstraint
  maxHeight: SizeConstraint
}

export class Dimensions {
  #width: Size
  #height: Size

  #aspectRatio: AspectRatio

  #minWidth: SizeConstraint
  #maxWidth: SizeConstraint

  #minHeight: SizeConstraint
  #maxHeight: SizeConstraint

  #computedWidth: number | null = null
  #computedHeight: number | null = null

  #computedAspectRatio: number | null = null

  #computedMinWidth: number | null = null
  #computedMaxWidth: number | null = null

  #computedMinHeight: number | null = null
  #computedMaxHeight: number | null = null

  constructor(options: DimensionsOptions) {
    this.#width = options.width
    this.#height = options.height

    this.#aspectRatio = options.aspectRatio

    this.#minWidth = options.minWidth
    this.#maxWidth = options.maxWidth

    this.#minHeight = options.minHeight
    this.#maxHeight = options.maxHeight
  }

  get width() {
    return this.#computedWidth
  }

  get height() {
    return this.#computedHeight
  }

  get aspectRatio() {
    return this.#computedAspectRatio
  }

  get minWidth() {
    return this.#computedMinWidth
  }

  get maxWidth() {
    return this.#computedMaxWidth
  }

  get minHeight() {
    return this.#computedMinHeight
  }

  get maxHeight() {
    return this.#computedMaxHeight
  }

  #computeDimension(
    basis: number | null,
    min: number | null,
    max: number | null,
  ) {
    const result = {
      value: null as number | null,
      min: null as number | null,
      max: null as number | null,
    }

    if (basis !== null) {
      if (min !== null && max !== null) {
        result.min = min
        result.value = Math.max(min, Math.min(max, basis))
        result.max = Math.max(min, max)
      } else if (min !== null) {
        result.min = min
        result.value = Math.max(min, basis)
      } else if (max !== null) {
        result.value = Math.min(max, basis)
        result.max = max
      } else {
        result.value = basis
      }
    } else if (min !== null && max !== null) {
      result.min = min
      result.max = Math.max(min, max)
    } else {
      result.min = min
      result.max = max
    }

    return result
  }

  compute() {
    const width = this.#width.pixels ?? this.#aspectRatio.computedWidth
    const minWidth = this.#minWidth.pixels
    const maxWidth = this.#maxWidth.pixels

    const height = this.#height.pixels ?? this.#aspectRatio.computedHeight
    const minHeight = this.#minHeight.pixels
    const maxHeight = this.#maxHeight.pixels

    const computedWidth = this.#computeDimension(width, minWidth, maxWidth)
    this.#computedWidth = computedWidth.value
    this.#computedMinWidth = computedWidth.min
    this.#computedMaxWidth = computedWidth.max

    const computedHeight = this.#computeDimension(height, minHeight, maxHeight)
    this.#computedHeight = computedHeight.value
    this.#computedMinHeight = computedHeight.min
    this.#computedMaxHeight = computedHeight.max
  }
}

export class ReadonlyDimensions {
  #dimensions: Dimensions

  constructor(dimensions: Dimensions) {
    this.#dimensions = dimensions
  }

  get width() {
    return this.#dimensions.width
  }

  get height() {
    return this.#dimensions.height
  }

  get aspectRatio() {
    return this.#dimensions.aspectRatio
  }

  get minWidth() {
    return this.#dimensions.minWidth
  }

  get maxWidth() {
    return this.#dimensions.maxWidth
  }

  get minHeight() {
    return this.#dimensions.minHeight
  }

  get maxHeight() {
    return this.#dimensions.maxHeight
  }
}
