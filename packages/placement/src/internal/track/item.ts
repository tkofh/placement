import { clamp } from 'curvy/number'
import { auto } from '../../utils/arguments.ts'

export interface TrackItemInput {
  start?: number
  end?: number
  basis?: number
  min?: number
  max?: number
}

export class TrackItem {
  readonly start: number
  readonly end: number

  readonly basis: number
  readonly min: number
  readonly max: number

  readonly startIsAuto: boolean
  readonly endIsAuto: boolean

  readonly definiteStart: number
  readonly definiteEnd: number

  readonly autoOffsetCount: number

  readonly initialSize: number

  // Inputs are immutable. Only adjustment changes after construction, so the
  // constructor precomputes everything else. Only the values that depend on
  // adjustment are getters.
  adjustment = 0

  readonly #baseSize: number

  constructor(start: number, end: number, basis: number, min: number, max: number) {
    this.start = start
    this.end = end

    this.basis = Math.max(basis, 0)
    this.min = Math.max(min, 0)
    this.max = Math.max(max, 0)

    this.startIsAuto = !Number.isFinite(start)
    this.endIsAuto = !Number.isFinite(end)

    this.definiteStart = this.startIsAuto ? 0 : start
    this.definiteEnd = this.endIsAuto ? 0 : end

    this.autoOffsetCount = Number(this.startIsAuto) + Number(this.endIsAuto)

    this.initialSize = clamp(basis, this.min, this.max)
    this.#baseSize = auto(this.initialSize, 0)
  }

  get size(): number {
    return clamp(this.#baseSize + this.adjustment, this.min, this.max)
  }

  get definiteOuterSize(): number {
    return this.size + this.definiteStart + this.definiteEnd
  }
}
