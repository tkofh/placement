import { NumericProperty, QuantityProperty, RatioProperty } from './placement'

class Rect {
  #computedX = 0
  #computedY = 0
  #computedWidth = 0
  #computedHeight = 0

  get computedX() {
    return this.#computedX
  }
  get computedY() {
    return this.#computedY
  }
  get computedWidth() {
    return this.#computedWidth
  }
  get computedHeight() {
    return this.#computedHeight
  }

  protected set computedX(value: number) {
    this.#computedX = value
  }
  protected set computedY(value: number) {
    this.#computedY = value
  }
  protected set computedWidth(value: number) {
    this.#computedWidth = value
  }
  protected set computedHeight(value: number) {
    this.#computedHeight = value
  }
}

interface DimensionsDeclarationOptions {
  aspectRatio?: string | number
  width?: string | number
  height?: string | number
}

export class DimensionsDeclaration extends Rect {
  #aspectRatio = new RatioProperty()
  #width: QuantityProperty = new QuantityProperty(
    QuantityProperty.DIMENSION_OR_FLEX_UNITS,
  )
  #height: QuantityProperty = new QuantityProperty(
    QuantityProperty.DIMENSION_OR_FLEX_UNITS,
  )

  constructor(options?: DimensionsDeclarationOptions) {
    super()
    if (options) {
      if (options.width != null) {
        this.#width.input = options.width
      }
      if (options.height != null) {
        this.#height.input = options.height
      }

      if (options.aspectRatio != null) {
        this.#aspectRatio.input = options.aspectRatio
      }
    }
  }

  get aspectRatio() {
    return this.#aspectRatio.input
  }
  set aspectRatio(value: string | number | null) {
    this.#aspectRatio.input = value
  }

  get width() {
    return this.#width.input
  }
  set width(value: string | number | null) {
    this.#width.input = value
  }

  get height() {
    return this.#height.input
  }
  set height(value: string | number | null) {
    this.#height.input = value
  }

  protected get aspectRatioProp() {
    return this.#aspectRatio
  }
  protected get widthProp() {
    return this.#width
  }
  protected get heightProp() {
    return this.#height
  }
}

interface GraphicNodeOptions extends DimensionsDeclarationOptions {
  parent?: GraphicNode
}

export class GraphicNode extends DimensionsDeclaration {
  #parent: GraphicNode | null = null
  #graphic: Graphic | null = null
  #children: Array<GraphicNode> = []
  // #descendents: Set<GraphicNode> = new Set()

  constructor(options?: GraphicNodeOptions) {
    super(options)
    if (options?.parent) {
      this.#parent = options.parent
    }
  }

  get parent() {
    return this.#parent
  }

  get graphic() {
    return this.#graphic
  }

  get children(): ReadonlyArray<GraphicNode> {
    return this.#children
  }

  // get descendents(): ReadonlySet<GraphicNode> {
  //   return this.#descendents
  // }

  removeParent() {
    if (this.#parent instanceof Graphic) {
      throw new Error('cannot remove the parent of the root node of a graphic')
    }

    if (this.#parent instanceof GraphicNode) {
      const parent = this.#parent
      this.#parent = null
      this.#graphic = null

      parent.removeChild(this)
    }
  }

  protected set parent(parent: GraphicNode | null) {
    if (this.#parent instanceof Graphic) {
      throw new Error('cannot reparent the root node of a graphic')
    }

    if (parent !== this.parent) {
      this.removeParent()
    }

    if (parent instanceof GraphicNode) {
      this.#parent = parent
      this.#graphic = parent.graphic
    }
  }

  removeChild(child: GraphicNode) {
    const index = this.#children.indexOf(child)
    if (index !== -1) {
      this.#children.splice(index, 1)

      if (child.parent === this) {
        child.removeParent()
      }
    }
  }

  appendChild<Child extends GraphicNode>(child: Child): Child {
    this.#children.push(child)
    child.parent = this
    // this.#descendents.add(child)

    return child
  }
}

interface GraphicFrameOptions extends DimensionsDeclarationOptions {
  layer?: boolean
  grow?: number
  shrink?: number
  top?: string | number
  right?: string | number
  bottom?: string | number
  left?: string | number
}

export class GraphicFrame extends GraphicNode {
  layer = false

  #grow = new NumericProperty(false)
  #shrink = new NumericProperty(false)

  #top: QuantityProperty = new QuantityProperty(
    QuantityProperty.DIMENSION_UNITS,
  )
  #right: QuantityProperty = new QuantityProperty(
    QuantityProperty.DIMENSION_UNITS,
  )
  #bottom: QuantityProperty = new QuantityProperty(
    QuantityProperty.DIMENSION_UNITS,
  )
  #left: QuantityProperty = new QuantityProperty(
    QuantityProperty.DIMENSION_UNITS,
  )

  constructor(options?: GraphicFrameOptions) {
    super(options)
    if (options) {
      this.layer = options.layer ?? this.layer

      if (options.grow != null) {
        this.#grow.input = options.grow
      }

      if (options.shrink != null) {
        this.#shrink.input = options.shrink
      }

      if (options.top != null) {
        this.#top.input = options.top
      }
      if (options.right != null) {
        this.#right.input = options.right
      }
      if (options.bottom != null) {
        this.#bottom.input = options.bottom
      }
      if (options.left != null) {
        this.#left.input = options.left
      }
    }
  }

  get grow() {
    return this.#grow.input
  }
  set grow(value: string | number | null) {
    this.#grow.input = value
  }

  get shrink() {
    return this.#shrink.input
  }
  set shrink(value: string | number | null) {
    this.#shrink.input = value
  }

  get top() {
    return this.#top.input
  }
  set top(value: string | number | null) {
    this.#top.input = value
  }

  get right() {
    return this.#right.input
  }
  set right(value: string | number | null) {
    this.#right.input = value
  }

  get bottom() {
    return this.#bottom.input
  }
  set bottom(value: string | number | null) {
    this.#bottom.input = value
  }

  get left() {
    return this.#left.input
  }
  set left(value: string | number | null) {
    this.#left.input = value
  }

  protected get growProp() {
    return this.#grow
  }
  protected get shrinkProp() {
    return this.#shrink
  }

  protected get topProp() {
    return this.#top
  }
  protected get rightProp() {
    return this.#right
  }
  protected get bottomProp() {
    return this.#bottom
  }
  protected get leftProp() {
    return this.#left
  }
}

interface GraphicRootOptions extends DimensionsDeclarationOptions {
  parent: Graphic
}

class GraphicRoot extends GraphicNode {
  constructor(options: GraphicRootOptions) {
    super(options)

    this.computedWidth = this.parent.viewportWidth
    this.computedHeight = this.parent.viewportHeight
  }

  get parent(): Graphic {
    return super.parent as Graphic
  }
}

interface ViewportOptions {
  width: number
  height: number
}

interface GraphicOptions {
  viewport: ViewportOptions
  content?: DimensionsDeclaration
}

export class Graphic {
  #viewportWidth: number
  #viewportHeight: number
  #root: GraphicNode

  constructor(options: GraphicOptions) {
    this.#viewportWidth = options.viewport.width
    this.#viewportHeight = options.viewport.height

    this.#root = new GraphicRoot({ parent: this, ...options.content })
  }

  get viewportWidth() {
    return this.#viewportWidth
  }

  get viewportHeight() {
    return this.#viewportHeight
  }

  appendChild<const Child extends GraphicNode>(child: Child): Child {
    return this.#root.appendChild(child)
  }
}

class GraphicLayout extends GraphicNode {}

export class GraphicAbsoluteLayout extends GraphicLayout {
  resize() {}
}

interface GraphicElementOptions extends GraphicFrameOptions {
  originX?: string | number
  originY?: string | number
}

export class GraphicElement extends GraphicNode {
  #originX: QuantityProperty = new QuantityProperty(
    QuantityProperty.DIMENSION_UNITS,
  )
  #originY: QuantityProperty = new QuantityProperty(
    QuantityProperty.DIMENSION_UNITS,
  )

  constructor(options?: GraphicElementOptions) {
    super(options)
    if (options) {
      if (options.originX != null) {
        this.#originX.input = options.originX
      }
      if (options.originY != null) {
        this.#originY.input = options.originY
      }
    }
  }

  get originX() {
    return this.#originX.input
  }
  set originX(value: string | number | null) {
    this.#originX.input = value
  }

  get originY() {
    return this.#originY.input
  }
  set originY(value: string | number | null) {
    this.#originY.input = value
  }

  protected get originXProp() {
    return this.#originX
  }
  protected get originYProp() {
    return this.#originY
  }

  get computedX() {
    return super.computedX - 100
  }
  get computedY() {
    return super.computedY - 100
  }
}
