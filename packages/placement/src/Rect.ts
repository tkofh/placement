import { roundTo } from './utils'

export interface RectLike {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export class Rect implements RectLike {
  private _x!: number
  private _y!: number
  private _width!: number
  private _height!: number
  private _precision = 4

  constructor(x?: number, y?: number, width?: number, height?: number) {
    this.x = x ?? 0
    this.y = y ?? 0
    this.width = width ?? 0
    this.height = height ?? 0
  }

  get x() {
    return this._x
  }
  set x(value: number) {
    this._x = roundTo(value, this._precision)
  }

  get y() {
    return this._y
  }
  set y(value: number) {
    this._y = roundTo(value, this._precision)
  }

  get width() {
    return this._width
  }
  set width(value: number) {
    this._width = Math.max(roundTo(value, this._precision), 0)
  }

  get height() {
    return this._height
  }
  set height(value: number) {
    this._height = Math.max(roundTo(value, this._precision), 0)
  }

  toJSON(): RectLike {
    return {
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height,
    }
  }
}
