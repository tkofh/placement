import { Emitter } from './Emitter'
import { FrameNode } from './FrameNode'
import { Rect, type RectLike } from './Rect'

export type FrameOptionGetter<T = number> = (
  parent: RectLike,
  root: RectLike,
) => T

export interface FrameOptions {
  width?: number | FrameOptionGetter
  height?: number | FrameOptionGetter
  x?: number | FrameOptionGetter
  y?: number | FrameOptionGetter
  grow?: number | FrameOptionGetter
  shrink?: number | FrameOptionGetter
}

export class Frame extends Emitter<{ updated: never }> {
  static defaults = {
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    grow: 0,
    shrink: 0,
  } satisfies FrameOptions

  protected readonly rect: Rect
  protected readonly node: FrameNode

  private _width!: number | FrameOptionGetter
  private _height!: number | FrameOptionGetter
  private _x!: number | FrameOptionGetter
  private _y!: number | FrameOptionGetter
  private _grow!: number | FrameOptionGetter
  private _shrink!: number | FrameOptionGetter

  private _needsUpdate = false

  constructor(options?: FrameOptions) {
    super()
    this.node = new FrameNode(this)
    this.rect = new Rect()

    this.configure(options)
  }

  get parent(): Frame | null {
    return this.node.parent?.frame ?? null
  }

  get index(): number {
    return this.node.index
  }

  get width(): number {
    return typeof this._width === 'function'
      ? this._width(this.parentRect, this.rootRect)
      : this._width
  }

  set width(value: number | FrameOptionGetter) {
    this._width = value
    this.configUpdated()
  }

  get height(): number {
    return typeof this._height === 'function'
      ? this._height(this.parentRect, this.rootRect)
      : this._height
  }

  set height(value: number | FrameOptionGetter) {
    this._height = value
    this.configUpdated()
  }

  get x(): number {
    return typeof this._x === 'function'
      ? this._x(this.parentRect, this.rootRect)
      : this._x
  }

  set x(value: number | FrameOptionGetter) {
    this._x = value
    this.configUpdated()
  }

  get y(): number {
    return typeof this._y === 'function'
      ? this._y(this.parentRect, this.rootRect)
      : this._y
  }

  set y(value: number | FrameOptionGetter) {
    this._y = value
    this.configUpdated()
  }

  get grow(): number {
    return typeof this._grow === 'function'
      ? this._grow(this.parentRect, this.rootRect)
      : this._grow
  }

  set grow(value: number | FrameOptionGetter) {
    this._grow = value
    this.configUpdated()
  }

  get shrink(): number {
    return typeof this._shrink === 'function'
      ? this._shrink(this.parentRect, this.rootRect)
      : this._shrink
  }

  set shrink(value: number | FrameOptionGetter) {
    this._shrink = value
    this.configUpdated()
  }

  get computed(): Readonly<Rect> {
    this.update()
    return this.rect
  }

  protected get parentRect(): Rect {
    if (this.parent) {
      return this.parent.rect
    }

    return this.rect
  }

  protected get rootRect(): Rect {
    if (this.node.root) {
      return this.node.root.frame.rect
    }

    return this.rect
  }

  update(): void {
    if (this.parent === null && !this._needsUpdate) {
      return
    }

    const node = this.node.findLastAncestor((node) => node.frame._needsUpdate)
    if (node) {
      node.frame._calculate()
    }
  }

  appendChild(frame: Frame) {
    this.node.appendChild(frame.node)
    this.configUpdated()

    return frame
  }

  insertBefore(frame: Frame, before: Frame) {
    this.node.insertBefore(frame.node, before.node)
    this.configUpdated()

    return frame
  }

  insertAt(frame: Frame, index: number) {
    this.node.insertAt(frame.node, index)
    this.configUpdated()

    return frame
  }

  removeChild(frame: Frame) {
    this.node.removeChild(frame.node)
    this.configUpdated()

    return frame
  }

  configure(options: undefined | FrameOptions) {
    this.width = options?.width ?? Frame.defaults.width
    this.height = options?.height ?? Frame.defaults.height
    this.x = options?.x ?? Frame.defaults.x
    this.y = options?.y ?? Frame.defaults.y
    this.grow = options?.grow ?? Frame.defaults.grow
    this.shrink = options?.shrink ?? Frame.defaults.shrink
  }

  *children(): IterableIterator<this> {
    for (const { frame } of this.node.children()) {
      yield frame as this
    }
  }

  protected layout() {
    for (const frame of this.children()) {
      frame.rect.x = this.rect.x + frame.x
      frame.rect.y = this.rect.y + frame.y
      frame.rect.width = frame.width
      frame.rect.height = frame.height
    }
  }

  protected configUpdated() {
    this._needsUpdate = true

    if (this.parent && !this.parent._needsUpdate) {
      for (const ancestor of this.node.ancestors()) {
        if (ancestor.frame._needsUpdate) {
          break
        }
        ancestor.frame._needsUpdate = true
      }
    }

    const descendants = this.node.descendants()
    let descendant = descendants.next()
    while (descendant.done === false) {
      let skip: number = descendant.value.skips.none
      if (!descendant.value.frame._needsUpdate) {
        descendant.value.frame._needsUpdate = true
        skip = descendant.value.skips.descendants
      }
      descendant = descendants.next(skip)
    }
  }

  protected getRect(frame: Frame) {
    return frame.rect
  }

  private _calculate(force = false) {
    if (this.parent === null) {
      this.rect.width = this.width
      this.rect.height = this.height
    }

    this.layout()

    this._needsUpdate = false

    for (const child of this.node.children()) {
      // if (child.frame._needsUpdate || force) {
      child.frame._calculate(force)
      // }
    }

    this.emit('updated')
  }
}
