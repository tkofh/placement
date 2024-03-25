import { test } from 'vitest'

type FlexConfig = {
  direction: 'row' | 'column' | 'row-reverse' | 'column-reverse'
  wrap: boolean | 'reverse'
  gap: number
  alignMain: number
  spaceMain: number
  outerSpaceMain: number
  alignItems: number
  scaleItems: number
  alignCross: number
  scaleCross: number
  spaceCross: number
  outerSpaceCross: number
}

type FlexNode = {
  rect: { x: number; y: number; width: number; height: number }
  dimensions: { width: number | null; height: number | null }
  children: Array<FlexNode>
}

class Rect {
  x = 0
  y = 0
  width = 0
  height = 0
}

class Dimensions {
  width: null | number = null
  height: null | number = null
}

class FlexItem {
  rect = new Rect()
  dimensions = new Dimensions()
  children: Array<FlexItem> = []
}

class Track {
  layout: FlexLayout
  nodes: Array<FlexItem> = []

  constructor(layout: FlexLayout) {
    this.layout = layout
  }

  get mainDimension() {
    return this.layout.config.direction.startsWith('row') ? 'width' : 'height'
  }

  get size() {
    return this.layout.dimensions[this.mainDimension]
  }

  get free() {
    if (this.size === null) {
      return null
    }

    let free = this.size
    for (const node of this.nodes) {
      free -= node.dimensions[this.mainDimension] ?? 0
    }

    return free
  }

  append(node: FlexItem) {
    const nodeSize = node.dimensions[this.mainDimension] ?? 0

    if (
      this.nodes.length > 0 &&
      this.free !== null &&
      (this.free === 0 || this.free - nodeSize < 0) &&
      this.layout.config.wrap
    ) {
      this.layout.tracks.push(new Track(this.layout))
      this.layout.tracks[this.layout.tracks.length - 1].append(node)
    } else {
      this.nodes.push(node)
    }
  }
}

class FlexLayout {
  items: Array<FlexItem>
  dimensions: Dimensions
  config: FlexConfig
  tracks: Array<Track>

  constructor(
    items: Array<FlexItem>,
    dimensions: Dimensions,
    config: FlexConfig,
  ) {
    this.items = items
    this.dimensions = dimensions
    this.config = config

    this.tracks = [new Track(this)]

    for (const item of this.items) {
      this.append(item)
    }
  }

  append(item: FlexItem) {
    const track = this.tracks[this.tracks.length - 1]
    track.append(item)
  }
}

const tree = new FlexItem()
tree.dimensions.width = 100
tree.dimensions.height = 100

const child1 = new FlexItem()
child1.dimensions.width = 50
child1.dimensions.height = 25

const child2 = new FlexItem()
child2.dimensions.width = 50
child2.dimensions.height = 25

const child3 = new FlexItem()
child3.dimensions.width = 50
child3.dimensions.height = 25

tree.children.push(child1)
tree.children.push(child2)
tree.children.push(child3)

test('flexbox', () => {
  const layout = new FlexLayout(tree.children, tree.dimensions, {
    direction: 'row',
    wrap: false,
    gap: 0,
    alignMain: 0,
    spaceMain: 0,
    outerSpaceMain: 0,
    alignItems: 0,
    scaleItems: 0,
    alignCross: 0,
    scaleCross: 0,
    spaceCross: 0,
    outerSpaceCross: 0,
  })

  console.log(layout)
})
