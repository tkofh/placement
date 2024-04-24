import { roundTo } from '../utils'
import type { MutableRect, ReadonlyRect } from './types'

export class Rect implements MutableRect {
  readonly #precision: number
  #x = 0
  #y = 0
  #width = 0
  #height = 0

  #readonly?: ReadonlyRect

  constructor(precision = 4) {
    this.#precision = precision
  }

  get x() {
    return this.#x
  }
  set x(value: number) {
    if (Number.isNaN(value)) {
      throw new Error('Cannot set rect.x to NaN')
    }
    this.#x = roundTo(value, this.#precision)
  }

  get y() {
    return this.#y
  }
  set y(value: number) {
    if (Number.isNaN(value)) {
      throw new Error('Cannot set rect.y to NaN')
    }
    this.#y = roundTo(value, this.#precision)
  }

  get width() {
    return this.#width
  }
  set width(value: number) {
    if (Number.isNaN(value)) {
      throw new Error('Cannot set rect.width to NaN')
    }
    this.#width = Math.max(roundTo(value, this.#precision), 0)
  }

  get height() {
    return this.#height
  }
  set height(value: number) {
    if (Number.isNaN(value)) {
      throw new Error('Cannot set rect.height to NaN')
    }
    this.#height = Math.max(roundTo(value, this.#precision), 0)
  }

  get readonly(): ReadonlyRect {
    if (this.#readonly === undefined) {
      this.#readonly = Object.defineProperties(
        {},
        {
          x: { enumerable: true, get: () => this.x },
          y: { enumerable: true, get: () => this.y },
          width: { enumerable: true, get: () => this.width },
          height: { enumerable: true, get: () => this.height },
        },
      ) as ReadonlyRect
    }
    return this.#readonly
  }
}
