export interface FrameLike {
  top: number
  right: number
  bottom: number
  left: number
}

export class Frame {
  #top: number
  #right: number
  #bottom: number
  #left: number

  #allowNegative: boolean

  constructor(
    top: number,
    right: number,
    bottom: number,
    left: number,
    allowNegative: boolean,
  ) {
    this.#top = top
    this.#right = right
    this.#bottom = bottom
    this.#left = left

    this.#allowNegative = allowNegative
  }

  get top(): number {
    return this.#top
  }

  set top(value: number) {
    this.#top = this.#allowNegative ? value : Math.max(value, 0)
  }

  get right(): number {
    return this.#right
  }

  set right(value: number) {
    this.#right = this.#allowNegative ? value : Math.max(value, 0)
  }

  get bottom(): number {
    return this.#bottom
  }

  set bottom(value: number) {
    this.#bottom = this.#allowNegative ? value : Math.max(value, 0)
  }

  get left(): number {
    return this.#left
  }

  set left(value: number) {
    this.#left = this.#allowNegative ? value : Math.max(value, 0)
  }

  set(value: number | Partial<FrameLike & { x: number; y: number }>) {
    if (typeof value === 'number') {
      this.top = value
      this.right = value
      this.bottom = value
      this.left = value
    } else {
      if (value.x !== undefined) {
        this.left = value.x
        this.right = value.x
      }
      if (value.y !== undefined) {
        this.top = value.y
        this.bottom = value.y
      }
      if (value.top !== undefined) {
        this.top = value.top
      }
      if (value.right !== undefined) {
        this.right = value.right
      }
      if (value.bottom !== undefined) {
        this.bottom = value.bottom
      }
      if (value.left !== undefined) {
        this.left = value.left
      }
    }
  }
}
