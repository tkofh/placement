import { Node } from 'gpds/trees/general'
import {
  NumericProperty,
  type Quantity,
  QuantityProperty,
  RatioProperty,
} from './placement'

class GraphicNode extends Node {
  #frame: GraphicFrame

  constructor(frame: GraphicFrame) {
    super()
    this.#frame = frame
  }

  get frame() {
    return this.#frame
  }
}

interface FrameOptions {
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

class FrameConfig {
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

  #parsedWidth: Quantity = { value: 0, unit: QuantityProperty.UNITS.pixel }
  #parsedHeight: Quantity = { value: 0, unit: QuantityProperty.UNITS.pixel }

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

class Rect {
  #x: number
  #y: number
  #width: number
  #height: number

  #dirty = false

  constructor(x?: number, y?: number, width?: number, height?: number) {
    this.#x = x ?? 0
    this.#y = y ?? 0
    this.#width = width ?? 0
    this.#height = height ?? 0
  }

  get x() {
    return this.#x
  }
  set x(value: number) {
    if (value !== this.#x) {
      this.#x = value
      this.#dirty = true
    }
  }

  get y() {
    return this.#y
  }
  set y(value: number) {
    if (value !== this.#y) {
      this.#y = value
      this.#dirty = true
    }
  }

  get width() {
    return this.#width
  }
  set width(value: number) {
    if (value !== this.#width) {
      this.#width = value
      this.#dirty = true
    }
  }

  get height() {
    return this.#height
  }
  set height(value: number) {
    if (value !== this.#height) {
      this.#height = value
      this.#dirty = true
    }
  }

  get dirty() {
    return this.#dirty
  }

  clearDirty() {
    this.#dirty = false
  }
}

abstract class Layout {
  base: Rect
  configs: Array<FrameConfig> = []
  rects: Array<Rect> = []

  constructor(base: Rect) {
    this.base = base
  }

  abstract layout(): void
}

interface AbsoluteLayoutOptions {
  autoSizeMode?: 'fill' | 'hide'
}

class AbsoluteLayout extends Layout {
  autoSizeMode: 'fill' | 'hide'

  constructor(base: Rect, options?: AbsoluteLayoutOptions) {
    super(base)

    this.autoSizeMode = options?.autoSizeMode ?? 'fill'
  }

  computeInset(quantity: Quantity | null, basis: number) {
    if (quantity == null) {
      return null
    }
    if (quantity.unit === QuantityProperty.UNITS.percent) {
      return (basis * quantity.value) / 100
    }

    return quantity.value
  }

  computeSize(
    quantity: Quantity | null,
    baseSize: number,
    insetStart: number | null,
    insetEnd: number | null,
  ) {
    if (quantity == null) {
      if (this.autoSizeMode === 'fill') {
        return baseSize - (insetStart ?? 0) - (insetEnd ?? 0)
      }

      if (insetStart !== null && insetEnd !== null) {
        return baseSize - insetStart - insetEnd
      }

      return 0
    }

    if (quantity.unit === QuantityProperty.UNITS.flex) {
      const flexBasis = baseSize - (insetStart ?? insetEnd ?? 0) * 2
      return flexBasis * quantity.value
    }

    if (quantity.unit === QuantityProperty.UNITS.percent) {
      return (baseSize * quantity.value) / 100
    }

    return quantity.value
  }

  layout() {
    for (const [index, config] of this.configs.entries()) {
      const rect = this.rects[index]

      const top = this.computeInset(config.readTop(), this.base.height)
      const right = this.computeInset(config.readRight(), this.base.width)
      const bottom = this.computeInset(config.readBottom(), this.base.height)
      const left = this.computeInset(config.readLeft(), this.base.width)

      const width = this.computeSize(
        config.readWidth(),
        this.base.width,
        left,
        right,
      )
      const height = this.computeSize(
        config.readHeight(),
        this.base.height,
        top,
        bottom,
      )

      const offsetX = this.computeInset(config.readOffsetX(), width) ?? 0
      const offsetY = this.computeInset(config.readOffsetY(), height) ?? 0

      rect.x = this.base.x + (left ?? right ?? 0 + offsetX)
      rect.y = this.base.y + (top ?? bottom ?? 0 + offsetY)
      rect.width = width
      rect.height = height
    }
  }
}

export class GraphicFrame {
  #node: GraphicNode
  #config: FrameConfig
  #rect: Rect
  #layout: Layout

  constructor(options?: FrameOptions) {
    this.#node = new GraphicNode(this)
    this.#config = new FrameConfig(options)
    this.#rect = new Rect()
    this.#layout = new AbsoluteLayout(this.#rect)
  }

  update(force = false) {
    let shouldUpdate = force

    if (!shouldUpdate) {
      if (this.#config.dirty) {
        shouldUpdate = true
        this.#config.clearDirty()
      } else if (this.#rect.dirty) {
        shouldUpdate = true
        this.#rect.clearDirty()
      }
    }

    if (shouldUpdate) {
      this.#layout.layout()

      for (const child of this.#node.children()) {
        child.frame.update()
      }
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
class GraphicRoot extends GraphicFrame {
  #graphic: Graphic
  constructor(graphic: Graphic, options: FrameOptions) {
    super(options)
    this.#graphic = graphic
    this.update()
  }

  update(force?: boolean) {
    this.computedWidth = this.#graphic.viewportWidth
    this.computedHeight = this.#graphic.viewportHeight

    super.update(force)
  }
}

interface GraphicOptions {
  width: number
  height: number
}

export class Graphic {
  #root: GraphicRoot
  #viewportWidth: number
  #viewportHeight: number

  constructor(options: GraphicOptions, rootOptions: FrameOptions = {}) {
    this.#viewportWidth = options.width
    this.#viewportHeight = options.height
    this.#root = new GraphicRoot(this, {
      width: '100%',
      height: '100%',
      ...rootOptions,
    })
    // need to write more about how the graphic influences the rect of the root frame
    // i.e. what if the root is too small? add options to configure scaling/aspect ratio preservation
  }

  get root() {
    return this.#root
  }

  get viewportWidth() {
    return this.#viewportWidth
  }
  get viewportHeight() {
    return this.#viewportHeight
  }

  resize(width: number, height: number) {
    this.#viewportWidth = width
    this.#viewportHeight = height
  }

  appendChild(frame: GraphicFrame) {
    return this.#root.appendChild(frame)
  }
  insertBefore(frame: GraphicFrame, before: GraphicFrame) {
    return this.#root.insertBefore(frame, before)
  }
  removeChild(frame: GraphicFrame) {
    return this.#root.removeChild(frame)
  }
}
