import { Spacing } from './Spacing'

export class Margin {
  #top: Spacing
  #right: Spacing
  #bottom: Spacing
  #left: Spacing

  constructor() {
    this.#top = new Spacing(true, 'inherit')
    this.#right = new Spacing(true, 'inherit')
    this.#bottom = new Spacing(true, 'inherit')
    this.#left = new Spacing(true, 'inherit')
  }

  get top() {
    return this.#top
  }

  get right() {
    return this.#right
  }

  get bottom() {
    return this.#bottom
  }

  get left() {
    return this.#left
  }
}
