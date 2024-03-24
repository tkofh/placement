export class Rect {
  x: number
  y: number
  width: number
  height: number

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }
}

export class ReadonlyRect {
  #rect: Rect

  constructor(rect: Rect) {
    this.#rect = rect
  }

  get x() {
    return this.#rect.x
  }

  get y() {
    return this.#rect.y
  }

  get width() {
    return this.#rect.width
  }

  get height() {
    return this.#rect.height
  }
}
