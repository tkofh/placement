import { roundTo } from './utils'

export interface MutableRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ReadonlyRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export function createMutableRect(): MutableRect {
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }
}

export class Box {
  #precision = 4
  #x = 0
  #y = 0
  #width = 0
  #height = 0
  #paddingTop = 0
  #paddingRight = 0
  #paddingBottom = 0
  #paddingLeft = 0
  #marginTop = 0
  #marginRight = 0
  #marginBottom = 0
  #marginLeft = 0

  readonly #innerRect: ReadonlyRect
  readonly #rect: ReadonlyRect
  readonly #outerRect: ReadonlyRect

  constructor() {
    this.#rect = Object.defineProperties(
      {},
      {
        x: { enumerable: true, get: () => this.x },
        y: { enumerable: true, get: () => this.y },
        width: { enumerable: true, get: () => this.width },
        height: { enumerable: true, get: () => this.height },
      },
    ) as ReadonlyRect

    this.#innerRect = Object.defineProperties(
      {},
      {
        x: { enumerable: true, get: () => this.x + this.paddingLeft },
        y: { enumerable: true, get: () => this.y + this.paddingTop },
        width: {
          enumerable: true,
          get: () => this.width - this.paddingLeft - this.paddingRight,
        },
        height: {
          enumerable: true,
          get: () => this.height - this.paddingTop - this.paddingBottom,
        },
      },
    ) as ReadonlyRect

    this.#outerRect = Object.defineProperties(
      {},
      {
        x: { enumerable: true, get: () => this.x - this.marginLeft },
        y: { enumerable: true, get: () => this.y - this.marginTop },
        width: {
          enumerable: true,
          get: () => this.width + this.marginLeft + this.marginRight,
        },
        height: {
          enumerable: true,
          get: () => this.height + this.marginTop + this.marginBottom,
        },
      },
    ) as ReadonlyRect
  }

  get x() {
    return this.#x
  }
  set x(value: number) {
    this.#x = roundTo(value, this.#precision)
  }

  get y() {
    return this.#y
  }
  set y(value: number) {
    this.#y = roundTo(value, this.#precision)
  }

  get width() {
    return this.#width
  }
  set width(value: number) {
    this.#width = Math.max(roundTo(value, this.#precision), 0)
  }

  get height() {
    return this.#height
  }
  set height(value: number) {
    this.#height = Math.max(roundTo(value, this.#precision))
  }

  get innerX() {
    return this.#x + this.#paddingLeft
  }
  set innerX(value: number) {
    this.#x = roundTo(value - this.#paddingLeft, this.#precision)
  }

  get innerY() {
    return this.#y + this.#paddingTop
  }
  set innerY(value: number) {
    this.#y = roundTo(value - this.#paddingTop, this.#precision)
  }

  get innerWidth() {
    return this.#width - this.#paddingLeft - this.#paddingRight
  }
  set innerWidth(value: number) {
    this.#width = Math.max(
      roundTo(value + this.#paddingLeft + this.#paddingRight, this.#precision),
      0,
    )
  }

  get innerHeight() {
    return this.#height - this.#paddingTop - this.#paddingBottom
  }
  set innerHeight(value: number) {
    this.#height = Math.max(
      roundTo(value + this.#paddingTop + this.#paddingBottom, this.#precision),
    )
  }

  get outerX() {
    return this.#x - this.#marginLeft
  }
  set outerX(value: number) {
    this.#x = roundTo(value + this.#marginLeft, this.#precision)
  }

  get outerY() {
    return this.#y - this.#marginTop
  }
  set outerY(value: number) {
    this.#y = roundTo(value + this.#marginTop, this.#precision)
  }

  get outerWidth() {
    return this.#width + this.#marginLeft + this.#marginRight
  }
  set outerWidth(value: number) {
    this.#width = Math.max(
      roundTo(value - this.#marginLeft - this.#marginRight, this.#precision),
      0,
    )
  }

  get outerHeight() {
    return this.#height + this.#marginTop + this.#marginBottom
  }
  set outerHeight(value: number) {
    this.#height = Math.max(
      roundTo(value - this.#marginTop - this.#marginBottom, this.#precision),
    )
  }

  get paddingTop() {
    return this.#paddingTop
  }
  set paddingTop(value: number) {
    this.#paddingTop = Math.max(roundTo(value, this.#precision))
  }

  get paddingRight() {
    return this.#paddingRight
  }
  set paddingRight(value: number) {
    this.#paddingRight = Math.max(roundTo(value, this.#precision))
  }

  get paddingBottom() {
    return this.#paddingBottom
  }
  set paddingBottom(value: number) {
    this.#paddingBottom = Math.max(roundTo(value, this.#precision))
  }

  get paddingLeft() {
    return this.#paddingLeft
  }
  set paddingLeft(value: number) {
    this.#paddingLeft = Math.max(roundTo(value, this.#precision))
  }

  get marginTop() {
    return this.#marginTop
  }
  set marginTop(value: number) {
    this.#marginTop = roundTo(value, this.#precision)
  }

  get marginRight() {
    return this.#marginRight
  }
  set marginRight(value: number) {
    this.#marginRight = roundTo(value, this.#precision)
  }

  get marginBottom() {
    return this.#marginBottom
  }
  set marginBottom(value: number) {
    this.#marginBottom = roundTo(value, this.#precision)
  }

  get marginLeft() {
    return this.#marginLeft
  }
  set marginLeft(value: number) {
    this.#marginLeft = roundTo(value, this.#precision)
  }

  get rect() {
    return this.#rect
  }

  get innerRect() {
    return this.#innerRect
  }

  get outerRect() {
    return this.#outerRect
  }
}
