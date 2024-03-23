type OffsetUnit = 'px' | 'percent'

export class Offset {
  #value: number
  #unit: OffsetUnit

  constructor(value: number, unit: OffsetUnit) {
    this.#value = value
    this.#unit = unit
  }

  get value(): number {
    return this.#value
  }

  set value(value: number) {
    this.#value = value
  }

  get unit(): OffsetUnit {
    return this.#unit
  }

  set unit(unit: OffsetUnit) {
    this.#unit = unit
  }
}

export interface OffsetValueAndUnit {
  value: number
  unit: OffsetUnit
}
