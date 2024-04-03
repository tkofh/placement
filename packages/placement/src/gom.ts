interface DimensionsLike {
  readonly width: number
  readonly height: number
}

interface RectLike extends DimensionsLike {
  readonly x: number
  readonly y: number
}

class Rect implements RectLike {
  x: number
  y: number
  width: number
  height: number

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  }

  static zero() {
    return new Rect(0, 0, 0, 0)
  }
}

// type Config = any

// function layout(
//   _rect: Rect,
//   _config: Config,
//   _naturalRects: Array<Rect>,
//   _layoutRects: Array<Rect>,
// ) {}

// class Layout {
//   #rect: Rect
//   #items: Array<LayoutItem> = []

//   constructor(rect: Rect) {
//     this.#rect = rect
//   }

//   createItem(index = -1) {
//     const item = new LayoutItem(this.#rect)

//     if (index === -1) {
//       this.#items.push(item)
//     } else {
//       let i = index % this.#items.length

//       if (i < 0) {
//         i += this.#items.length
//       }

//       this.#items.splice(i, 0, item)
//     }
//     return item
//   }
// }

const UNITS = {
  px: 'px',
  percent: '%',
} as const

type Unit = (typeof UNITS)[keyof typeof UNITS]

class LayoutItem {
  #declared: Rect
  #computed: Rect

  #basis: Rect

  constructor(basis: RectLike) {
    this.#basis = basis
    this.#declared = Rect.zero()
    this.#computed = Rect.zero()
  }

  get x() {
    return this.#computed.x
  }
  get y() {
    return this.#computed.y
  }
  get width() {
    return this.#computed.width
  }
  get height() {
    return this.#computed.height
  }

  setX(x: number, unit: Unit = 'px') {
    if (unit === 'px') {
      this.#declared.x = x
    } else {
      this.#declared.x = x * this.#basis.width
    }
  }

  setY(y: number, unit: Unit = 'px') {
    if (unit === 'px') {
      this.#declared.y = y
    } else {
      this.#declared.y = y * this.#basis.height
    }
  }

  setWidth(width: number, unit: Unit = 'px') {
    if (unit === 'px') {
      this.#declared.width = width
    } else {
      this.#declared.width = width * this.#basis.width
    }
  }

  setHeight(height: number, unit: Unit = 'px') {
    if (unit === 'px') {
      this.#declared.height = height
    } else {
      this.#declared.height = height * this.#basis.height
    }
  }

  readDeclared() {
    return this.#declared
  }

  writeComputed(x: number, y: number, width: number, height: number) {
    this.#computed.x = x
    this.#computed.y = y
    this.#computed.width = width
    this.#computed.height = height
  }
}

class Tree {
  #parents: Map<Node, Node> = new Map()
  #viewport: Rect
  #root: Node
  constructor(viewport: DimensionsLike) {
    this.#viewport = new Rect(0, 0, viewport.width, viewport.height)

    this.#root = new Node(this, this.#viewport, this.#viewport, this.#viewport)
  }

  parentOf(node: Node) {
    if (node === this.#root) {
      return null
    }

    const parent = this.#parents.get(node)

    if (parent == null) {
      throw new Error('Node is not in this tree')
    }

    return parent
  }

  setParent(node: Node, parent: Node) {
    this.#parents.set(node, parent)
  }
}

class Node implements RectLike {
  #tree: Tree
  #layoutItem: LayoutItem

  constructor(tree: Tree, layoutItem: LayoutItem) {
    this.#tree = tree
    this.#layoutItem = layoutItem
  }

  getParent() {
    return this.#tree.parentOf(this)
  }

  get x() {
    return this.#layoutItem.x
  }
  get y() {
    return this.#layoutItem.y
  }
  get width() {
    return this.#layoutItem.width
  }
  get height() {
    return this.#layoutItem.height
  }
}
