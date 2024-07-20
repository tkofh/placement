import { clamp } from '../../utils/math'

export interface TrackItemInput {
  start?: number
  end?: number
  basis?: number
  min?: number
  max?: number
}

export class TrackItem {
  readonly initialSize: number

  adjustment = 0

  readonly basis: number
  readonly min: number
  readonly max: number

  readonly definiteStart: number
  readonly definiteEnd: number

  readonly startIsAuto: boolean
  readonly endIsAuto: boolean

  constructor(
    readonly start: number,
    readonly end: number,
    basis: number,
    min: number,
    max: number,
  ) {
    this.basis = Math.max(basis, 0)
    this.min = Math.max(min, 0)
    this.max = Math.max(max, 0)

    this.startIsAuto = !Number.isFinite(start)
    this.endIsAuto = !Number.isFinite(end)

    this.definiteStart = this.startIsAuto ? 0 : start
    this.definiteEnd = this.endIsAuto ? 0 : end

    this.initialSize = clamp(basis, min, max)
  }

  get size(): number {
    return clamp(this.initialSize + this.adjustment, this.min, this.max)
  }

  get definiteOuterSize(): number {
    return this.size + this.definiteStart + this.definiteEnd
  }

  get autoOffsetCount(): number {
    return Number(this.startIsAuto) + Number(this.endIsAuto)
  }
}
