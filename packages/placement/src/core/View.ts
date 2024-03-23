class ViewRect {
  #view: View

  readonly x = 0
  readonly y = 0

  constructor(view: View) {
    this.#view = view
  }

  get width() {
    return this.#view.width
  }

  get height() {
    return this.#view.height
  }
}

export class View {
  #width: number
  #height: number

  #rect: ViewRect

  constructor(width: number, height: number) {
    this.#width = width
    this.#height = height

    this.#rect = new ViewRect(this)
  }

  get width() {
    return this.#width
  }

  get height() {
    return this.#height
  }

  get rect() {
    return this.#rect
  }
}
