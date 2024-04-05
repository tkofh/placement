export class GraphicRect {
  #x: number
  #y: number
  #width: number
  #height: number

  #readonly = new GraphicRectReadonly(this)

  constructor(x?: number, y?: number, width?: number, height?: number) {
    this.#x = x ?? 0
    this.#y = y ?? 0
    this.#width = width ?? 0
    this.#height = height ?? 0
  }

  get x() {
    return this.#x
  }
  set x(value: number) {
    this.#x = value
  }

  get y() {
    return this.#y
  }
  set y(value: number) {
    this.#y = value
  }

  get width() {
    return this.#width
  }
  set width(value: number) {
    this.#width = Math.max(value, 0)
  }

  get height() {
    return this.#height
  }
  set height(value: number) {
    this.#height = Math.max(value, 0)
  }

  get readonly() {
    return this.#readonly
  }
}

export class GraphicRectReadonly {
  #rect: GraphicRect

  constructor(rect: GraphicRect) {
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
