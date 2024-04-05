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

  constructor(options?: FrameOptions) {
    if (options?.aspectRatio != null) {
      this.#aspectRatio.set(options.aspectRatio)
    }
    if (options?.width != null) {
      this.#width.set(options.width)
    }
    if (options?.height != null) {
      this.#height.set(options.height)
    }
    if (options?.top != null) {
      this.#top.set(options.top)
    }
    if (options?.right != null) {
      this.#right.set(options.right)
    }
    if (options?.bottom != null) {
      this.#bottom.set(options.bottom)
    }
    if (options?.left != null) {
      this.#left.set(options.left)
    }
    if (options?.grow != null) {
      this.#grow.set(options.grow)
    }
    if (options?.shrink != null) {
      this.#shrink.set(options.shrink)
    }
    if (options?.offsetX != null) {
      this.#offsetX.set(options.offsetX)
    }
    if (options?.offsetY != null) {
      this.#offsetY.set(options.offsetY)
    }
  }

  getAspectRatio() {
    return this.#aspectRatio.get()
  }
  setAspectRatio(value: string | number | null) {
    return this.#aspectRatio.set(value)
  }
  readAspectRatio(): number | null {
    return this.#aspectRatio.read()
  }

  getWidth() {
    return this.#width.get()
  }
  setWidth(value: string | number | null) {
    return this.#width.set(value)
  }
  readWidth(): Readonly<Quantity> | null {
    const width = this.#width.read()
    if (width !== null) {
      Object.assign(this.#parsedWidth, width)

      return this.#parsedWidth
    }
    const height = this.#height.read()
    const aspectRatio = this.#aspectRatio.read()
    if (height !== null && aspectRatio !== null) {
      this.#parsedWidth.value = height.value * aspectRatio
      this.#parsedWidth.unit = height.unit

      return this.#parsedWidth
    }

    return null
  }

  getHeight() {
    return this.#height.get()
  }
  setHeight(value: string | number | null) {
    return this.#height.set(value)
  }
  readHeight(): Readonly<Quantity> | null {
    const height = this.#height.read()
    if (height !== null) {
      Object.assign(this.#parsedHeight, height)
      return this.#parsedHeight
    }

    const width = this.#width.read()
    const aspectRatio = this.#aspectRatio.read()
    if (width !== null && aspectRatio !== null) {
      this.#parsedHeight.value = width.value / aspectRatio
      this.#parsedHeight.unit = width.unit
      return this.#parsedHeight
    }

    return null
  }

  getTop() {
    return this.#top.get()
  }
  setTop(value: string | number | null) {
    return this.#top.set(value)
  }
  readTop(): Readonly<Quantity> | null {
    return this.#top.read()
  }

  getRight() {
    return this.#right.get()
  }
  setRight(value: string | number | null) {
    return this.#right.set(value)
  }
  readRight(): Readonly<Quantity> | null {
    return this.#right.read()
  }

  getBottom() {
    return this.#bottom.get()
  }
  setBottom(value: string | number | null) {
    return this.#bottom.set(value)
  }
  readBottom(): Readonly<Quantity> | null {
    return this.#bottom.read()
  }

  getLeft() {
    return this.#left.get()
  }
  setLeft(value: string | number | null) {
    return this.#left.set(value)
  }
  readLeft(): Readonly<Quantity> | null {
    return this.#left.read()
  }

  getGrow() {
    return this.#grow.get()
  }
  setGrow(value: string | number | null) {
    return this.#grow.set(value)
  }
  readGrow(): number | null {
    return this.#grow.read()
  }

  getShrink() {
    return this.#shrink.get()
  }
  setShrink(value: string | number | null) {
    return this.#shrink.set(value)
  }
  readShrink(): number | null {
    return this.#shrink.read()
  }

  getOffsetX() {
    return this.#offsetX.get()
  }
  setOffsetX(value: string | number | null) {
    return this.#offsetX.set(value)
  }
  readOffsetX(): Readonly<Quantity> | null {
    return this.#offsetX.read()
  }

  getOffsetY() {
    return this.#offsetY.get()
  }
  setOffsetY(value: string | number | null) {
    return this.#offsetY.set(value)
  }
  readOffsetY(): Readonly<Quantity> | null {
    return this.#offsetY.read()
  }
}

export class GraphicFrame {
  #node: GraphicNode
  #config: FrameConfig
  #rect: GraphicRect
  #layout: Layout

  #needsUpdate = false

  constructor(options?: FrameOptions) {
    this.#node = new GraphicNode(this)
    this.#config = new FrameConfig(options)
    this.#rect = new GraphicRect()
    this.#layout = new AbsoluteLayout(this.#rect)

    this.#dimensionsUpdated()
  }

  update(): void {
    const node = this.#node.findLastAncestor((node) => node.frame.#needsUpdate)
    if (node) {
      node.frame.#calculate()
    }
  }

  #calculate(force = false) {
    this.#layout.layout()

    this.#needsUpdate = false

    for (const child of this.#node.children()) {
      if (child.frame.#needsUpdate || force) {
        child.frame.#calculate(force)
      }
    }
  }

  #configUpdated() {
    if (!this.#needsUpdate) {
      this.#needsUpdate = true
      if (this.parent) {
        for (const ancestor of this.#node.ancestors()) {
          ancestor.frame.#needsUpdate = true
        }
      }

      const descendants = this.#node.descendants()
      let descendant: GraphicNode | undefined = descendants.next().value
      while (descendant !== undefined) {
        let next: number = descendant.skips.none
        if (!descendant.frame.#needsUpdate) {
          descendant.frame.#needsUpdate = true
          next = descendant.skips.descendants
        }
        descendant = descendants.next(next).value
      }
    }
  }

  #dimensionsUpdated() {
    if (this.parent !== null) {
      return
    }
    const width = this.#config.readWidth()
    const height = this.#config.readHeight()

    if (width !== null && height !== null) {
      if (
        width.unit === QuantityProperty.UNITS.pixel &&
        height.unit === QuantityProperty.UNITS.pixel
      ) {
        this.#rect.width = width.value
        this.#rect.height = height.value
      }
    }
  }

  appendChild(frame: GraphicFrame) {
    this.#node.appendChild(frame.#node)
    this.#layout.configs.push(frame.#config)
    this.#layout.rects.push(frame.#rect)
    this.#calculate(true)

    return frame
  }
  insertBefore(frame: GraphicFrame, before: GraphicFrame) {
    this.#node.insertBefore(frame.#node, before.#node)

    this.#layout.configs.splice(frame.#node.index, 0, frame.#config)
    this.#layout.rects.splice(frame.#node.index, 0, frame.#rect)
    this.update()

    return frame
  }
  removeChild(frame: GraphicFrame) {
    this.#node.removeChild(frame.#node)
    this.#layout.configs.splice(frame.#node.index, 1)
    this.#layout.rects.splice(frame.#node.index, 1)
    this.update()

    return frame
  }

  get parent(): GraphicFrame | null {
    return this.#node.parent?.frame ?? null
  }

  get aspectRatio() {
    return this.#config.getAspectRatio()
  }
  set aspectRatio(value: string | number | null) {
    const changed = this.#config.setAspectRatio(value)
    if (changed) {
      this.#configUpdated()
    }
  }

  get width() {
    return this.#config.getWidth()
  }
  set width(value: string | number | null) {
    const changed = this.#config.setWidth(value)
    if (changed) {
      this.#dimensionsUpdated()
      this.#configUpdated()
    }
  }

  get height() {
    return this.#config.getHeight()
  }
  set height(value: string | number | null) {
    const changed = this.#config.setHeight(value)
    if (changed) {
      this.#dimensionsUpdated()
      this.#configUpdated()
    }
  }

  get top() {
    return this.#config.getTop()
  }
  set top(value: string | number | null) {
    const changed = this.#config.setTop(value)
    if (changed) {
      this.#configUpdated()
    }
  }

  get left() {
    return this.#config.getLeft()
  }
  set left(value: string | number | null) {
    const changed = this.#config.setLeft(value)
    if (changed) {
      this.#configUpdated()
    }
  }

  get right() {
    return this.#config.getRight()
  }
  set right(value: string | number | null) {
    const changed = this.#config.setRight(value)
    if (changed) {
      this.#configUpdated()
    }
  }

  get bottom() {
    return this.#config.getBottom()
  }
  set bottom(value: string | number | null) {
    const changed = this.#config.setBottom(value)
    if (changed) {
      this.#configUpdated()
    }
  }

  get offsetX() {
    return this.#config.getOffsetX()
  }
  set offsetX(value: string | number | null) {
    const changed = this.#config.setOffsetX(value)
    if (changed) {
      this.#configUpdated()
    }
  }

  get offsetY() {
    return this.#config.getOffsetY()
  }
  set offsetY(value: string | number | null) {
    const changed = this.#config.setOffsetY(value)
    if (changed) {
      this.#configUpdated()
    }
  }

  get computed() {
    this.update()
    return this.#rect.readonly
  }
}
