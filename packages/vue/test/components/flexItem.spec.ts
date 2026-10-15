import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { type VNodeArrayChildren, h, nextTick } from 'vue'
import { FlexItem } from '../../src/components/FlexItem.ts'
import { FlexLayout } from '../../src/components/FlexLayout.ts'
import { GraphicRect } from '../../src/components/GraphicRect.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

const host = Rect.make(0, 0, 200, 100)

function probe(rect: Rect.Rect) {
  return h('probe', { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
}

const itemSlot = { default: ({ rect }: { rect: Rect.Rect }) => [probe(rect)] }

async function mountItems(items: () => VNodeArrayChildren) {
  const mounted = mountWithRect(host, () => [h(FlexLayout, null, { default: items })])
  // The flex solve resolves on the next tick.
  await nextTick()
  return mounted
}

function probes(root: Parameters<typeof findAll>[0]) {
  return findAll(root, 'probe').map((node) => node.props)
}

describe('sizing', () => {
  test('percentages resolve against the layout inner rect', async () => {
    const { root } = await mountItems(() => [
      h(FlexItem, { width: '50%', height: '50%' }, itemSlot),
    ])

    expect(probes(root)).toEqual([{ x: 0, y: 0, width: 100, height: 50 }])
  })

  test('aspectRatio derives the missing dimension', async () => {
    const { root } = await mountItems(() => [h(FlexItem, { width: 50, aspectRatio: 1 }, itemSlot)])

    expect(probes(root)).toEqual([{ x: 0, y: 0, width: 50, height: 50 }])
  })
})

describe('margins', () => {
  test('margins offset the item and the following items', async () => {
    const { root } = await mountItems(() => [
      h(
        FlexItem,
        { width: 50, height: 20, marginTop: 5, marginLeft: 10, marginRight: 20 },
        itemSlot,
      ),
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([
      { x: 10, y: 5, width: 50, height: 20 },
      { x: 80, y: 0, width: 50, height: 20 },
    ])
  })
})

describe('grow and shrink', () => {
  test('grow accepts a number and a numeric string alike', async () => {
    const numbers = await mountItems(() => [
      h(FlexItem, { grow: 1, height: 100 }, itemSlot),
      h(FlexItem, { grow: 1, height: 100 }, itemSlot),
    ])
    const strings = await mountItems(() => [
      h(FlexItem, { grow: '1', height: 100 }, itemSlot),
      h(FlexItem, { grow: '1', height: 100 }, itemSlot),
    ])

    const expected = [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 100, y: 0, width: 100, height: 100 },
    ]
    expect(probes(numbers.root)).toEqual(expected)
    expect(probes(strings.root)).toEqual(expected)
  })

  test('shrink accepts a number and a numeric string alike', async () => {
    const numbers = await mountItems(() => [
      h(FlexItem, { width: 150, height: 20, shrink: 1 }, itemSlot),
      h(FlexItem, { width: 150, height: 20, shrink: 1 }, itemSlot),
    ])
    const strings = await mountItems(() => [
      h(FlexItem, { width: 150, height: 20, shrink: '1' }, itemSlot),
      h(FlexItem, { width: 150, height: 20, shrink: '1' }, itemSlot),
    ])

    const expected = [
      { x: 0, y: 0, width: 100, height: 20 },
      { x: 100, y: 0, width: 100, height: 20 },
    ]
    expect(probes(numbers.root)).toEqual(expected)
    expect(probes(strings.root)).toEqual(expected)
  })

  test('without shrink an overflowing row keeps its basis', async () => {
    const { root } = await mountItems(() => [
      h(FlexItem, { width: 150, height: 20 }, itemSlot),
      h(FlexItem, { width: 150, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 150, height: 20 },
      { x: 150, y: 0, width: 150, height: 20 },
    ])
  })
})

describe('alignSelf', () => {
  test('keywords place the item on the cross axis', async () => {
    const { root } = await mountItems(() => [
      h(FlexItem, { width: 40, height: 20, alignSelf: 'end' }, itemSlot),
      h(FlexItem, { width: 40, height: 20, alignSelf: 'center' }, itemSlot),
      h(FlexItem, { width: 40, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([
      { x: 0, y: 80, width: 40, height: 20 },
      { x: 40, y: 40, width: 40, height: 20 },
      { x: 80, y: 0, width: 40, height: 20 },
    ])
  })

  test('a numeric alignSelf is the normalized cross position', async () => {
    const { root } = await mountItems(() => [
      h(FlexItem, { width: 40, height: 20, alignSelf: 0.5 }, itemSlot),
    ])

    expect(probes(root)).toEqual([{ x: 0, y: 40, width: 40, height: 20 }])
  })

  test('stretch fills the cross axis, overriding the container default', async () => {
    const { root } = await mountItems(() => [
      h(FlexItem, { width: 40, height: 20, alignSelf: 'stretch' }, itemSlot),
      h(FlexItem, { width: 40, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 40, height: 100 },
      { x: 40, y: 0, width: 40, height: 20 },
    ])
  })
})

describe('sizing context', () => {
  test('the item registers its solved rect as the parent context', async () => {
    const { root } = await mountItems(() => [
      h(FlexItem, { width: 50, height: 40 }, itemSlot),
      h(
        FlexItem,
        { width: 50, height: 40 },
        {
          default: () => [h(GraphicRect, { width: '100%' })],
        },
      ),
    ])

    // The child fills the second item's solved rect exactly.
    expect(findOne(root, 'rect').props).toEqual({
      x: 50,
      y: 0,
      width: 50,
      height: 40,
      rx: 0,
      ry: 0,
    })
  })
})

describe('debug', () => {
  test('debug wraps the slot in a <g> spread with the solved rect', async () => {
    const { root } = await mountItems(() => [
      h(FlexItem, { width: 50, height: 20, debug: true }, itemSlot),
    ])

    expect(findOne(root, 'g').props).toEqual({ x: 0, y: 0, width: 50, height: 20 })
  })
})
