import { Frame } from './Frame'

export class Box {
  #width: number
  #height: number

  #padding: Frame
  #margin: Frame

  constructor(width: number, height: number) {
    this.#width = width
    this.#height = height

    this.#padding = new Frame(0, 0, 0, 0, false)
    this.#margin = new Frame(0, 0, 0, 0, true)
  }

  get width(): number {
    return this.#width
  }

  set width(value: number) {
    this.#width = Math.max(value, 0)
  }

  get height(): number {
    return this.#height
  }

  set height(value: number) {
    this.#height = Math.max(value, 0)
  }

  get padding(): Frame {
    return this.#padding
  }

  get margin(): Frame {
    return this.#margin
  }
}
