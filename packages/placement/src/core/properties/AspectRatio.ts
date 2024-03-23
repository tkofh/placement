import { clamp } from '../util'

export class AspectRatio {
  #value: number | 'auto' | 'inherit'

  constructor(value: number | 'auto' | 'inherit') {
    this.#value = typeof value === 'string' ? value : clamp(value, 0.001, 1000)
  }

  get value() {
    return this.#value
  }

  set value(value: number | 'auto' | 'inherit') {
    this.#value = typeof value === 'string' ? value : clamp(value, 0.001, 1000)
  }
}
