import { Spacing } from './Spacing'

export class Padding {
  #top: Spacing
  #right: Spacing
  #bottom: Spacing
  #left: Spacing

  constructor() {
    this.#top = new Spacing(false, 'inherit')
    this.#right = new Spacing(false, 'inherit')
    this.#bottom = new Spacing(false, 'inherit')
    this.#left = new Spacing(false, 'inherit')
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
