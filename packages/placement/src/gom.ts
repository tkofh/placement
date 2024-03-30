import {
  type Dimensions,
  type DimensionsInput,
  parseDimensions,
} from './dimensions'

interface ViewportInput extends Dimensions {
  // fit: 'contain' | 'cover' | 'fill'
}

interface GraphicOptions {
  viewport: ViewportInput
  root: DimensionsInput
}

export class Graphic {
  #viewport: Dimensions
  #root: GraphicNode
  #parents: Map<GraphicNode, GraphicNode> = new Map()

  constructor(options: GraphicOptions) {
    this.#viewport = {
      width: options.viewport.width,
      height: options.viewport.height,
    }

    this.#root = new GraphicNode(this, null, options.root)
  }

  get viewport(): Readonly<Dimensions> {
    return this.#viewport
  }

  resize(size: Dimensions) {
    this.#viewport.width = size.width
    this.#viewport.height = size.height
  }

  createNode() {
    return new GraphicNode(this, null, {
      width: 'auto',
      height: 'auto',
      aspectRatio: 'none',
    })
  }
}

export class GraphicRootNode {
  #graphic: Graphic
  #children: Array<GraphicNode> = []

  constructor(graphic: Graphic) {
    this.#graphic = graphic
  }

  appendChild(child: GraphicNode) {
    this.#children.push(child)
  }

  removeChild(child: GraphicNode) {
    const index = this.#children.indexOf(child)
    if (index === -1) {
      throw new Error('Child not found')
    }

    this.#children.splice(index, 1)
  }
}

export class GraphicNode {
  #parent: GraphicNode | null
  #graphic: Graphic
  #children: Array<GraphicNode> = []
  #naturalDimensions!: Dimensions

  constructor(
    graphic: Graphic,
    parent: GraphicNode | null,
    dimensions: Readonly<DimensionsInput>,
  ) {
    this.#parent = parent
    this.#graphic = graphic
    this.#setSize(dimensions)
  }

  get graphic(): Graphic {
    return this.#graphic
  }

  get parent(): GraphicNode | null {
    return this.#parent
  }

  get [DimensionsObject](): Readonly<Dimensions> {
    return this.#naturalDimensions
  }

  get naturalWidth(): number {
    return this.#naturalDimensions.width
  }

  get naturalHeight(): number {
    return this.#naturalDimensions.height
  }

  resize(size: Readonly<DimensionsInput>) {
    this.#setSize(size)
  }

  #setSize(dimensions: Readonly<DimensionsInput>) {
    this.#naturalDimensions = parseDimensions(
      dimensions,
      this.#parent?.[DimensionsObject] ?? this.#graphic.viewport,
    )
  }

  [RegisterParent](_parent: GraphicNode) {
    if (this.#graphic[GraphicRoot] === this || this.#parent === null) {
      throw new Error('Cannot set parent of root node')
    }

    this.#parent.removeChild(this)
  }

  setParent(parent: GraphicNode) {
    parent.appendChild(this)
  }

  appendChild(child: GraphicNode) {
    child[RegisterParent](this)
  }

  removeChild(child: GraphicNode) {
    const index = this.#children.indexOf(child)
    if (index === -1) {
      throw new Error('Child not found')
    }

    this.#children.splice(index, 1)
  }
}
