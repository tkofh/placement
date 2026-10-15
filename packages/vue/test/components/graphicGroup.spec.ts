import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { h } from 'vue'
import { GraphicGroup } from '../../src/components/GraphicGroup.ts'
import { GraphicRect } from '../../src/components/GraphicRect.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

const host = Rect.make(0, 0, 200, 100)

function probe(rect: Rect.Rect) {
  return h('probe', { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
}

describe('render modes', () => {
  test('by default children render without a <g> wrapper', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicGroup, null, { default: ({ rect }: { rect: Rect.Rect }) => [probe(rect)] }),
    ])

    expect(findAll(root, 'g')).toEqual([])
    expect(findAll(root, 'probe')).toHaveLength(1)
  })

  test('a class attr wraps in a <g> carrying exactly the attrs', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicGroup, { class: 'layer' }, { default: () => [h('probe', {})] }),
    ])

    const group = findOne(root, 'g')
    expect(group.props).toEqual({ class: 'layer' })
    expect(group.children.map((child) => child.tag)).toContain('probe')
  })

  test('a style attr also wraps in a <g>', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicGroup, { style: 'opacity: 0.5' }, { default: () => [h('probe', {})] }),
    ])

    expect(findOne(root, 'g').props).toEqual({ style: 'opacity: 0.5' })
  })

  test('debug wraps in a <g> with the rect fields spread as attrs', () => {
    const { root } = mountWithRect(host, () => [
      h(
        GraphicGroup,
        { debug: true, top: 10, left: 20, width: 100, height: 50 },
        { default: () => [h('probe', {})] },
      ),
    ])

    // Rect fields are own instance fields, so the spread carries them.
    expect(findOne(root, 'g').props).toEqual({ x: 20, y: 10, width: 100, height: 50 })
  })

  test('debug merges attrs with the rect fields', () => {
    const { root } = mountWithRect(host, () => [
      h(
        GraphicGroup,
        { debug: true, class: 'layer', width: 100, height: 50 },
        { default: () => [h('probe', {})] },
      ),
    ])

    expect(findOne(root, 'g').props).toEqual({
      class: 'layer',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    })
  })
})

describe('slot rect', () => {
  test('the default slot receives the resolved rect', () => {
    const { root } = mountWithRect(host, () => [
      h(
        GraphicGroup,
        { top: 10, left: 20, width: 100, height: 50 },
        { default: ({ rect }: { rect: Rect.Rect }) => [probe(rect)] },
      ),
    ])

    expect(findOne(root, 'probe').props).toEqual({ x: 20, y: 10, width: 100, height: 50 })
  })

  test('an unsized group fills the host rect', () => {
    const { root } = mountWithRect(host, () => [
      h(GraphicGroup, null, { default: ({ rect }: { rect: Rect.Rect }) => [probe(rect)] }),
    ])

    expect(findOne(root, 'probe').props).toEqual({ x: 0, y: 0, width: 200, height: 100 })
  })
})

describe('sizing context', () => {
  test('children resolve against the group rect, not the host', () => {
    const { root } = mountWithRect(host, () => [
      h(
        GraphicGroup,
        { top: 10, left: 20, width: 100, height: 50 },
        { default: () => [h(GraphicRect, { width: '50%' })] },
      ),
    ])

    // 50% of the group's 100, positioned at the group's origin, filling
    // the group's height.
    expect(findOne(root, 'rect').props).toEqual({
      x: 20,
      y: 10,
      width: 50,
      height: 50,
      rx: 0,
      ry: 0,
    })
  })
})
