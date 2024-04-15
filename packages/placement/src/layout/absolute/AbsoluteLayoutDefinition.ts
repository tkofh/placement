import type { Frame } from '../../frame/Frame'
import {
  type QuantityInput,
  QuantityProperty,
} from '../../properties/QuantityProperty'
import type { Layout, LayoutDefinition } from '../types'
import { AbsoluteLayout } from './AbsoluteLayout'

export interface AbsoluteLayoutOptions {
  readonly insetTop: QuantityInput
  readonly insetRight: QuantityInput
  readonly insetBottom: QuantityInput
  readonly insetLeft: QuantityInput
}

export class AbsoluteLayoutDefinition implements LayoutDefinition {
  static DEFAULTS = {
    insetTop: 0,
    insetRight: 0,
    insetBottom: 0,
    insetLeft: 0,
  } satisfies AbsoluteLayoutOptions

  readonly #insetTop: QuantityProperty
  readonly #insetRight: QuantityProperty
  readonly #insetBottom: QuantityProperty
  readonly #insetLeft: QuantityProperty

  constructor(options: Partial<AbsoluteLayoutOptions>) {
    this.#insetTop = new QuantityProperty(true, 'height')
    this.#insetRight = new QuantityProperty(true, 'width')
    this.#insetBottom = new QuantityProperty(true, 'height')
    this.#insetLeft = new QuantityProperty(true, 'width')

    this.#insetTop.value =
      options.insetTop ?? AbsoluteLayoutDefinition.DEFAULTS.insetTop
    this.#insetRight.value =
      options.insetRight ?? AbsoluteLayoutDefinition.DEFAULTS.insetRight
    this.#insetBottom.value =
      options.insetBottom ?? AbsoluteLayoutDefinition.DEFAULTS.insetBottom
    this.#insetLeft.value =
      options.insetLeft ?? AbsoluteLayoutDefinition.DEFAULTS.insetLeft
  }

  get insetTop() {
    return this.#insetTop.value
  }
  set insetTop(value) {
    this.#insetTop.value = value
  }

  get insetRight() {
    return this.#insetRight.value
  }
  set insetRight(value) {
    this.#insetRight.value = value
  }

  get insetBottom() {
    return this.#insetBottom.value
  }
  set insetBottom(value) {
    this.#insetBottom.value = value
  }

  get insetLeft() {
    return this.#insetLeft.value
  }
  set insetLeft(value) {
    this.#insetLeft.value = value
  }

  registerFrame(frame: Frame): Layout {
    return new AbsoluteLayout(
      frame,
      this.#insetTop,
      this.#insetRight,
      this.#insetBottom,
      this.#insetLeft,
    )
  }
}
