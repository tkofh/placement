import { expect, test } from 'vitest'

type Node = {
  width: { value: number; unit: 'pixel' | 'percent' } | 'auto'
  height: { value: number; unit: 'pixel' | 'percent' } | 'auto'
  basis: {
    width: number
    height: number
  }
  dimensions: {
    width: number | null
    height: number | null
  }
  children: Array<Node>
}

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

type Dimensions = {
  width: number
  height: number
}

const tree: Node = {
  width: { value: 100, unit: 'pixel' },
  height: { value: 100, unit: 'pixel' },
  basis: { width: 0, height: 0 },
  dimensions: {
    width: null,
    height: null,
  },
  children: [
    {
      width: { value: 50, unit: 'percent' },
      height: { value: 50, unit: 'pixel' },
      basis: { width: 0, height: 0 },
      dimensions: {
        width: null,
        height: null,
      },
      children: [],
    },
    {
      width: 'auto',
      height: { value: 25, unit: 'percent' },
      basis: { width: 0, height: 0 },
      dimensions: {
        width: null,
        height: null,
      },
      children: [
        {
          width: { value: 50, unit: 'percent' },
          height: { value: 50, unit: 'percent' },
          basis: { width: 0, height: 0 },
          dimensions: {
            width: null,
            height: null,
          },
          children: [],
        },
      ],
    },
  ],
}

class Layout {
  #tree: Node
  #width: number
  #height: number

  #needsDimensionsUpdate: Array<Node> = []
  #needsLayoutUpdate: Array<Node> = []

  constructor(tree: Node, width: number, height: number) {
    this.#tree = tree
    this.#width = width
    this.#height = height

    this.recalculate()
  }

  recalculate() {
    this.#tree.basis.width = this.#width
    this.#tree.basis.height = this.#height
    this.#needsDimensionsUpdate = [this.#tree]
    this.#calculateDimensions()

    console.log(JSON.stringify(this.#needsLayoutUpdate, null, 2))
  }

  #calculateDimensions() {
    while (this.#needsDimensionsUpdate.length > 0) {
      const node = this.#needsDimensionsUpdate.shift() as Node

      node.dimensions.width = null
      if (typeof node.width === 'object') {
        if (node.width.unit === 'pixel') {
          node.dimensions.width = node.width.value
        } else if (node.width.unit === 'percent') {
          node.dimensions.width = (node.basis.width * node.width.value) / 100
        }
      }

      node.dimensions.height = null
      if (typeof node.height === 'object') {
        if (node.height.unit === 'pixel') {
          node.dimensions.height = node.height.value
        } else if (node.height.unit === 'percent') {
          node.dimensions.height = (node.basis.height * node.height.value) / 100
        }
      }

      if (node.children.length > 0) {
        this.#needsLayoutUpdate.push(node)
        for (const child of node.children) {
          child.basis.width = node.dimensions.width ?? node.basis.width
          child.basis.height = node.dimensions.height ?? node.basis.height

          this.#needsDimensionsUpdate.push(child)
        }
      }
    }
  }
}

test('dimensions', () => {
  new Layout(tree, 100, 100)

  expect(tree.dimensions.width).toBe(100)
  expect(tree.dimensions.height).toBe(100)

  expect(tree.children[0].dimensions.width).toBe(50)
  expect(tree.children[0].dimensions.height).toBe(50)

  expect(tree.children[1].dimensions.width).toBe(null)
  expect(tree.children[1].dimensions.height).toBe(25)

  expect(tree.children[1].children[0].dimensions.width).toBe(50)
  expect(tree.children[1].children[0].dimensions.height).toBe(12.5)

  console.log(JSON.stringify(tree, null, 2))
})
