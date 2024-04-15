export interface MutableRect {
  x: number
  y: number
  width: number
  height: number
}

export type ReadonlyRect = Readonly<MutableRect>
