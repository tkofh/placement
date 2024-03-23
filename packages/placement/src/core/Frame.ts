import { Offset, type OffsetValueAndUnit } from './Offset'

export interface FrameLike {
  top: number
  right: number
  bottom: number
  left: number
}

export class Frame {
  #top: Offset
  #right: Offset
  #bottom: Offset
  #left: Offset

  #allowNegative: boolean

  constructor(
    top: OffsetValueAndUnit,
    right: OffsetValueAndUnit,
    bottom: OffsetValueAndUnit,
    left: OffsetValueAndUnit,
    allowNegative: boolean,
  ) {
    this.#top = new Offset(top.value, top.unit)
    this.#right = new Offset(right.value, right.unit)
    this.#bottom = new Offset(bottom.value, bottom.unit)
    this.#left = new Offset(left.value, left.unit)

    this.#allowNegative = allowNegative
  }

  get top(): Offset {
    if (this.#top.value < 0 && !this.#allowNegative) {
      this.#top.value = 0
    }
    return this.#top
  }

  get right(): Offset {
    if (this.#right.value < 0 && !this.#allowNegative) {
      this.#right.value = 0
    }
    return this.#right
  }

  get bottom(): Offset {
    if (this.#bottom.value < 0 && !this.#allowNegative) {
      this.#bottom.value = 0
    }
    return this.#bottom
  }

  get left(): Offset {
    if (this.#left.value < 0 && !this.#allowNegative) {
      this.#left.value = 0
    }
    return this.#left
  }
}
