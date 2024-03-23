import type { Box } from './Box'

export class Container {
  #box: Box
  #children: Array<Box>

  constructor(box: Box) {
    this.#box = box
    this.#children = []
  }
}
