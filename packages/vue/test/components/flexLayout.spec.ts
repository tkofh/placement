import * as Flexbox from 'placement/flexbox'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { type VNodeArrayChildren, h, nextTick, ref } from 'vue'
import { FlexItem } from '../../src/components/FlexItem.ts'
import type { FlexLayoutProps } from '../../src/components/FlexLayout.ts'
import { FlexLayout } from '../../src/components/FlexLayout.ts'
import { findAll, findOne, mountWithRect } from '../host.ts'

const host = Rect.make(0, 0, 200, 100)

function probe(rect: Rect.Rect) {
  return h('probe', { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
}

const itemSlot = { default: ({ rect }: { rect: Rect.Rect }) => [probe(rect)] }

async function mountLayout(props: FlexLayoutProps | null, items: () => VNodeArrayChildren) {
  const mounted = mountWithRect(host, () => [h(FlexLayout, props, { default: items })])
  // The flex solve resolves on the next tick.
  await nextTick()
  return mounted
}

function probes(root: Parameters<typeof findAll>[0]) {
  return findAll(root, 'probe').map((node) => node.props)
}

describe('solving', () => {
  test('two grow-1 items split the container width', async () => {
    const { root } = await mountLayout(null, () => [
      h(FlexItem, { grow: 1, height: 100 }, itemSlot),
      h(FlexItem, { grow: 1, height: 100 }, itemSlot),
    ])

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 100, y: 0, width: 100, height: 100 },
    ])
  })

  test('explicit widths lay out in sequence', async () => {
    const { root } = await mountLayout(null, () => [
      h(FlexItem, { width: 30, height: 20 }, itemSlot),
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 30, height: 20 },
      { x: 30, y: 0, width: 50, height: 20 },
    ])
  })

  test('gap separates items on the main axis', async () => {
    const { root } = await mountLayout({ gap: 10 }, () => [
      h(FlexItem, { width: 30, height: 20 }, itemSlot),
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 30, height: 20 },
      { x: 40, y: 0, width: 50, height: 20 },
    ])
  })

  test('flow column stacks items vertically', async () => {
    const { root } = await mountLayout({ flow: 'column' }, () => [
      h(FlexItem, { width: 40, height: 30 }, itemSlot),
      h(FlexItem, { width: 40, height: 30 }, itemSlot),
    ])

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 40, height: 30 },
      { x: 0, y: 30, width: 40, height: 30 },
    ])
  })
})

describe('alignment', () => {
  test('justifyContent end packs toward the main end', async () => {
    const { root } = await mountLayout({ justifyContent: 'end' }, () => [
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([{ x: 150, y: 0, width: 50, height: 20 }])
  })

  test('justifyContent center splits the free space', async () => {
    const { root } = await mountLayout({ justifyContent: 'center' }, () => [
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([{ x: 75, y: 0, width: 50, height: 20 }])
  })

  test('alignItems positions items on the cross axis', async () => {
    const centered = await mountLayout({ alignItems: 'center' }, () => [
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])
    expect(probes(centered.root)).toEqual([{ x: 0, y: 40, width: 50, height: 20 }])

    const ended = await mountLayout({ alignItems: 'end' }, () => [
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])
    expect(probes(ended.root)).toEqual([{ x: 0, y: 80, width: 50, height: 20 }])
  })

  test('alignItems stretch fills the cross axis', async () => {
    const { root } = await mountLayout({ alignItems: 'stretch' }, () => [
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])

    expect(probes(root)).toEqual([{ x: 0, y: 0, width: 50, height: 100 }])
  })
})

describe('gutters', () => {
  test('gutters contract the inner rect: slot, context, and items all shift', async () => {
    const { root } = await mountLayout(
      { gutterTop: 5, gutterRight: 20, gutterBottom: 15, gutterLeft: 10 },
      () => [h(FlexItem, { width: 50, height: 20 }, itemSlot)],
    )

    const layoutProbe = findAll(root, 'probe')
    expect(layoutProbe).toHaveLength(1)
    expect(layoutProbe[0]?.props).toEqual({ x: 10, y: 5, width: 50, height: 20 })
  })

  test('the layout slot receives the contracted inner rect', async () => {
    const { root } = mountWithRect(host, () => [
      h(
        FlexLayout,
        { gutterTop: 5, gutterRight: 20, gutterBottom: 15, gutterLeft: 10 },
        {
          default: ({ rect }: { rect: Rect.Rect }) => [probe(rect)],
        },
      ),
    ])
    await nextTick()

    expect(findOne(root, 'probe').props).toEqual({ x: 10, y: 5, width: 170, height: 80 })
  })

  test('percentage gutters resolve against the layout rect, not the host', async () => {
    const { root } = await mountLayout(
      { width: 100, height: 50, gutterLeft: '10%', gutterTop: '20%' },
      () => [h(FlexItem, { grow: 1, height: '100%' }, itemSlot)],
    )

    expect(probes(root)).toEqual([{ x: 10, y: 10, width: 90, height: 40 }])
  })

  test('a grow item fills only the inner rect', async () => {
    const { root } = await mountLayout({ gutterLeft: 10, gutterRight: 20 }, () => [
      h(FlexItem, { grow: 1, height: 100 }, itemSlot),
    ])

    expect(probes(root)).toEqual([{ x: 10, y: 0, width: 170, height: 100 }])
  })
})

describe('own rect', () => {
  test('percentage sizing and insets resolve against the host', async () => {
    const { root } = await mountLayout({ width: '50%', height: 50, top: 10, left: 20 }, () => [
      h(FlexItem, { grow: 1, height: 50 }, itemSlot),
    ])

    expect(probes(root)).toEqual([{ x: 20, y: 10, width: 100, height: 50 }])
  })
})

describe('layout prop', () => {
  test('a Flexbox instance overrides the individual props', async () => {
    const { root } = await mountLayout(
      {
        layout: Flexbox.make({ direction: Flexbox.direction.column }),
        // Ignored: the layout prop wins wholesale.
        justifyContent: 'end',
        gap: 10,
      },
      () => [
        h(FlexItem, { width: 40, height: 30 }, itemSlot),
        h(FlexItem, { width: 40, height: 30 }, itemSlot),
      ],
    )

    expect(probes(root)).toEqual([
      { x: 0, y: 0, width: 40, height: 30 },
      { x: 0, y: 30, width: 40, height: 30 },
    ])
  })
})

describe('debug', () => {
  test('debug wraps the children in a <g> spread with the inner rect', async () => {
    const { root } = await mountLayout({ debug: true }, () => [
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])

    expect(findOne(root, 'g').props).toEqual({ x: 0, y: 0, width: 200, height: 100 })
  })

  test('without debug there is no wrapper', async () => {
    const { root } = await mountLayout(null, () => [
      h(FlexItem, { width: 50, height: 20 }, itemSlot),
    ])

    expect(findAll(root, 'g')).toEqual([])
  })
})

describe('reactivity', () => {
  test('a justifyContent change re-solves the layout', async () => {
    const justify = ref<'start' | 'end'>('start')
    const { root } = mountWithRect(host, () => [
      h(
        FlexLayout,
        { justifyContent: justify.value },
        {
          default: () => [h(FlexItem, { width: 50, height: 20 }, itemSlot)],
        },
      ),
    ])
    await nextTick()
    expect(probes(root)).toEqual([{ x: 0, y: 0, width: 50, height: 20 }])

    justify.value = 'end'
    await nextTick()

    expect(probes(root)).toEqual([{ x: 150, y: 0, width: 50, height: 20 }])
  })
})
