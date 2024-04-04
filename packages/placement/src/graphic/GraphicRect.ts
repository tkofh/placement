export class GraphicRect {
  #x: number
  #y: number
  #width: number
  #height: number

  #dirty = false

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
    if (value !== this.#x) {
      this.#x = value
      this.#dirty = true
    }
  }

  get y() {
    return this.#y
  }
  set y(value: number) {
    if (value !== this.#y) {
      this.#y = value
      this.#dirty = true
    }
  }

  get width() {
    return this.#width
  }
  set width(value: number) {
    if (value !== this.#width) {
      this.#width = value
      this.#dirty = true
    }
  }

  get height() {
    return this.#height
  }
  set height(value: number) {
    if (value !== this.#height) {
      this.#height = value
      this.#dirty = true
    }
  }

  get dirty() {
    return this.#dirty
  }

  clearDirty() {
    this.#dirty = false
  }
}
