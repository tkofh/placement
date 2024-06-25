import type { Rect } from '../rect'
import type { ReadonlyRect } from '../rect'
import type { ComputedFrameProperties } from './ComputedFrameProperties'

export class FrameInnerRect implements ReadonlyRect {
  #rect: Rect
  #computed: ComputedFrameProperties

  constructor(rect: Rect, computed: ComputedFrameProperties) {
    this.#rect = rect
    this.#computed = computed
  }

  get #insetLeft() {
    return Math.min(this.#computed.insetLeft, this.#rect.width)
  }

  get #insetTop() {
    return Math.min(this.#computed.insetTop, this.#rect.height)
  }

  get x() {
    return this.#rect.x + this.#insetLeft
  }

  get y() {
    return this.#rect.y + this.#insetTop
  }

  get width() {
    return Math.max(
      this.#rect.width - this.#computed.insetLeft - this.#computed.insetRight,
      0,
    )
  }

  get height() {
    return Math.max(
      this.#rect.height - this.#computed.insetTop - this.#computed.insetBottom,
      0,
    )
  }
}
