import { GraphicNode } from './GraphicNode'
import { GraphicRect } from './GraphicRect'
import { AbsoluteLayout } from './layout/AbsoluteLayout'
import type { Layout } from './layout/Layout'
import { NumericProperty } from './properties/NumericProperty'
import { type Quantity, QuantityProperty } from './properties/QuantityProperty'
import { RatioProperty } from './properties/RatioProperty'

export interface FrameOptions {
  aspectRatio?: string | number
  width?: string | number
  height?: string | number
  grow?: number
  shrink?: number
  top?: string | number
  right?: string | number
  bottom?: string | number
  left?: string | number
  offsetX?: string | number
  offsetY?: string | number
}

export class FrameConfig {
  #aspectRatio = new RatioProperty()
  #width = new QuantityProperty(QuantityProperty.DIMENSION_OR_FLEX_UNITS)
  #height = new QuantityProperty(QuantityProperty.DIMENSION_OR_FLEX_UNITS)
  #top = new QuantityProperty(QuantityProperty.DIMENSION_UNITS)
  #right = new QuantityProperty(QuantityProperty.DIMENSION_UNITS)
  #bottom = new QuantityProperty(QuantityProperty.DIMENSION_UNITS)
  #left = new QuantityProperty(QuantityProperty.DIMENSION_UNITS)
  #grow = new NumericProperty(false)
  #shrink = new NumericProperty(false)
  #offsetX = new QuantityProperty(QuantityProperty.DIMENSION_UNITS)
  #offsetY = new QuantityProperty(QuantityProperty.DIMENSION_UNITS)

  readonly #parsedWidth: Quantity = {
    value: 0,
    unit: QuantityProperty.UNITS.pixel,
  }
  readonly #parsedHeight: Quantity = {
    value: 0,
    unit: QuantityProperty.UNITS.pixel,
  }

  #dirty = false

  constructor(options?: FrameOptions) {
    if (options?.aspectRatio != null) {
      this.#aspectRatio.input = options.aspectRatio
    }
    if (options?.width != null) {
      this.#width.input = options.width
    }
    if (options?.height != null) {
      this.#height.input = options.height
    }
    if (options?.top != null) {
      this.#top.input = options.top
    }
    if (options?.right != null) {
      this.#right.input = options.right
    }
    if (options?.bottom != null) {
      this.#bottom.input = options.bottom
    }
    if (options?.left != null) {
      this.#left.input = options.left
    }
    if (options?.grow != null) {
      this.#grow.input = options.grow
    }
    if (options?.shrink != null) {
      this.#shrink.input = options.shrink
    }
    if (options?.offsetX != null) {
      this.#offsetX.input = options.offsetX
    }
    if (options?.offsetY != null) {
      this.#offsetY.input = options.offsetY
    }
  }

  get aspectRatio() {
    return this.#aspectRatio.input
  }
  set aspectRatio(value: string | number | null) {
    if (value !== this.#aspectRatio.input) {
      this.#aspectRatio.input = value
      this.#dirty = true
    }
  }
  get width() {
    return this.#width.input
  }
  set width(value: string | number | null) {
    if (value !== this.#width.input) {
      this.#width.input = value
      this.#dirty = true
    }
  }
  get height() {
    return this.#height.input
  }
  set height(value: string | number | null) {
    if (value !== this.#height.input) {
      this.#height.input = value
      this.#dirty = true
    }
  }
  get top() {
    return this.#top.input
  }
  set top(value: string | number | null) {
    if (value !== this.#top.input) {
      this.#top.input = value
      this.#dirty = true
    }
  }
  get right() {
    return this.#right.input
  }
  set right(value: string | number | null) {
    if (value !== this.#right.input) {
      this.#right.input = value
      this.#dirty = true
    }
  }
  get bottom() {
    return this.#bottom.input
  }
  set bottom(value: string | number | null) {
    if (value !== this.#bottom.input) {
      this.#bottom.input = value
      this.#dirty = true
    }
  }
  get left() {
    return this.#left.input
  }
  set left(value: string | number | null) {
    if (value !== this.#left.input) {
      this.#left.input = value
      this.#dirty = true
    }
  }
  get grow() {
    return this.#grow.input
  }
  set grow(value: string | number | null) {
    if (value !== this.#grow.input) {
      this.#grow.input = value
      this.#dirty = true
    }
  }
  get shrink() {
    return this.#shrink.input
  }
  set shrink(value: string | number | null) {
    if (value !== this.#shrink.input) {
      this.#shrink.input = value
      this.#dirty = true
    }
  }
  get offsetX() {
    return this.#offsetX.input
  }
  set offsetX(value: string | number | null) {
    if (value !== this.#offsetX.input) {
      this.#offsetX.input = value
      this.#dirty = true
    }
  }
  get offsetY() {
    return this.#offsetY.input
  }
  set offsetY(value: string | number | null) {
    if (value !== this.#offsetY.input) {
      this.#offsetY.input = value
      this.#dirty = true
    }
  }

  readAspectRatio(): number | null {
    return this.#aspectRatio.value
  }
  readWidth(): Readonly<Quantity> | null {
    if (this.#width.isDefined()) {
      this.#parsedWidth.unit = this.#width.parsed.unit
      this.#parsedWidth.value = this.#width.parsed.value

      return this.#parsedWidth
    }
    if (this.#height.isDefined() && this.#aspectRatio.isDefined()) {
      this.#parsedWidth.value =
        this.#height.parsed.value * this.#aspectRatio.value
      this.#parsedWidth.unit = this.#height.parsed.unit

      return this.#parsedWidth
    }

    return null
  }
  readHeight(): Readonly<Quantity> | null {
    if (this.#height.isDefined()) {
      this.#parsedHeight.unit = this.#height.parsed.unit
      this.#parsedHeight.value = this.#height.parsed.value
      return this.#parsedHeight
    }

    if (this.#width.isDefined() && this.#aspectRatio.isDefined()) {
      this.#parsedHeight.value =
        this.#width.parsed.value / this.#aspectRatio.value
      this.#parsedHeight.unit = this.#width.parsed.unit
      return this.#parsedHeight
    }

    return null
  }
  readTop(): Readonly<Quantity> | null {
    return this.#top.parsed
  }
  readRight(): Readonly<Quantity> | null {
    return this.#right.parsed
  }
  readBottom(): Readonly<Quantity> | null {
    return this.#bottom.parsed
  }
  readLeft(): Readonly<Quantity> | null {
    return this.#left.parsed
  }
  readGrow(): number | null {
    return this.#grow.value
  }
  readShrink(): number | null {
    return this.#shrink.value
  }
  readOffsetX(): Readonly<Quantity> | null {
    return this.#offsetX.parsed
  }
  readOffsetY(): Readonly<Quantity> | null {
    return this.#offsetY.parsed
  }

  get dirty() {
    return this.#dirty
  }
  clearDirty() {
    this.#dirty = false
  }
}

export class GraphicFrame {
  #node: GraphicNode
  #config: FrameConfig
  #rect: GraphicRect
  #layout: Layout

  constructor(options?: FrameOptions) {
    this.#node = new GraphicNode(this)
    this.#config = new FrameConfig(options)
    this.#rect = new GraphicRect()
    this.#layout = new AbsoluteLayout(this.#rect)
  }

  get #needsUpdate(): boolean {
    if (this.#rect.dirty || this.#config.dirty) {
      return true
    }
    if (this.parent) {
      return this.parent.#needsUpdate
    }
    return false
  }

  update(force = false): void {
    if (this.#needsUpdate || force) {
      if (this.parent) {
        for (const ancestor of this.#node.ancestors()) {
          if (!ancestor.frame.#needsUpdate) {
            ancestor.frame.#calculate()
          }
        }
      } else {
        this.#calculate()
      }
    }
  }

  #calculate() {
    console.log(this.constructor.name, 'calculating')
    this.#layout.layout()

    this.#config.clearDirty()
    this.#rect.clearDirty()

    for (const child of this.#node.children()) {
      child.frame.#calculate()
    }
  }

  appendChild(frame: GraphicFrame) {
    this.#node.appendChild(frame.#node)
    this.#layout.configs.push(frame.#config)
    this.#layout.rects.push(frame.#rect)
    this.update(true)

    return frame
  }
  insertBefore(frame: GraphicFrame, before: GraphicFrame) {
    this.#node.insertBefore(frame.#node, before.#node)

    this.#layout.configs.splice(frame.#node.index, 0, frame.#config)
    this.#layout.rects.splice(frame.#node.index, 0, frame.#rect)
    this.update(true)

    return frame
  }
  removeChild(frame: GraphicFrame) {
    this.#node.removeChild(frame.#node)
    this.#layout.configs.splice(frame.#node.index, 1)
    this.#layout.rects.splice(frame.#node.index, 1)
    this.update(true)

    return frame
  }

  get parent(): GraphicFrame | null {
    return this.#node.parent?.frame ?? null
  }

  get aspectRatio() {
    return this.#config.aspectRatio
  }
  set aspectRatio(value: string | number | null) {
    this.#config.aspectRatio = value
  }
  get width() {
    return this.#config.width
  }
  set width(value: string | number | null) {
    this.#config.width = value
  }
  get height() {
    return this.#config.height
  }
  set height(value: string | number | null) {
    this.#config.height = value
  }
  get top() {
    return this.#config.top
  }
  set top(value: string | number | null) {
    this.#config.top = value
  }
  get right() {
    return this.#config.right
  }
  set right(value: string | number | null) {
    this.#config.right = value
  }
  get bottom() {
    return this.#config.bottom
  }
  set bottom(value: string | number | null) {
    this.#config.bottom = value
  }
  get left() {
    return this.#config.left
  }
  set left(value: string | number | null) {
    this.#config.left = value
  }
  get grow() {
    return this.#config.grow
  }
  set grow(value: string | number | null) {
    this.#config.grow = value
  }
  get shrink() {
    return this.#config.shrink
  }
  set shrink(value: string | number | null) {
    this.#config.shrink = value
  }
  get offsetX() {
    return this.#config.offsetX
  }
  set offsetX(value: string | number | null) {
    this.#config.offsetX = value
  }
  get offsetY() {
    return this.#config.offsetY
  }
  set offsetY(value: string | number | null) {
    this.#config.offsetY = value
  }

  get computedX() {
    this.update()
    return this.#rect.x
  }
  protected set computedX(value: number) {
    this.#rect.x = value
  }
  get computedY() {
    this.update()
    return this.#rect.y
  }
  protected set computedY(value: number) {
    this.#rect.y = value
  }
  get computedWidth() {
    this.update()
    return this.#rect.width
  }
  protected set computedWidth(value: number) {
    this.#rect.width = value
  }
  get computedHeight() {
    this.update()
    return this.#rect.height
  }
  protected set computedHeight(value: number) {
    this.#rect.height = value
  }

  get relativeX() {
    return this.#rect.x - (this.parent?.computedX ?? 0)
  }
  get relativeY() {
    return this.#rect.y - (this.parent?.computedY ?? 0)
  }
}
