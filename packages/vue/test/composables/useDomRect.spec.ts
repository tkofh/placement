import * as Rect from 'placement/rect'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { type ShallowRef, nextTick, shallowRef } from 'vue'
import { useDomRect, useTextRect } from '../../src/composables/useDomRect.ts'
import { FakeResizeObserver } from '../host.ts'
import { TestNode } from '../renderer.ts'

// The composable checks `typeof ResizeObserver` at call time and
// `element instanceof Element` in its watch, so both globals must be in
// place before the call.
function stubObserverGlobals(): void {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  vi.stubGlobal('Element', TestNode)
}

// The watch runs standalone: no component instance is required.
function makeElementRef() {
  const el = shallowRef<TestNode | undefined>(undefined)
  return { el, element: el as unknown as ShallowRef<Element | undefined> }
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeResizeObserver.reset()
})

describe('useDomRect', () => {
  test('starts at the zero rect and adopts dispatched measurements', async () => {
    stubObserverGlobals()
    const { el, element } = makeElementRef()
    const rect = useDomRect(element)

    expect(rect.value).toEqual(Rect.make())
    expect(FakeResizeObserver.instances).toHaveLength(1)

    const node = new TestNode('div')
    el.value = node
    await nextTick()
    expect(FakeResizeObserver.instances[0]!.targets).toContain(node)

    FakeResizeObserver.resize(node, { x: 0, y: 0, width: 200, height: 100 })
    expect(rect.value).toEqual(Rect.make(0, 0, 200, 100))
  })

  test('copies the contentRect position, not only its size', async () => {
    stubObserverGlobals()
    const { el, element } = makeElementRef()
    const rect = useDomRect(element)

    const node = new TestNode('div')
    el.value = node
    await nextTick()

    FakeResizeObserver.resize(node, { x: 1, y: 2, width: 50, height: 25 })
    expect(rect.value).toEqual(Rect.make(1, 2, 50, 25))
  })

  test('swapping elements unobserves the old and observes the new', async () => {
    stubObserverGlobals()
    const { el, element } = makeElementRef()
    const rect = useDomRect(element)
    const first = new TestNode('div')
    const second = new TestNode('div')

    el.value = first
    await nextTick()
    FakeResizeObserver.resize(first, { x: 0, y: 0, width: 100, height: 50 })
    expect(rect.value).toEqual(Rect.make(0, 0, 100, 50))

    el.value = second
    await nextTick()
    const observer = FakeResizeObserver.instances[0]!
    expect(observer.targets).not.toContain(first)
    expect(observer.targets).toContain(second)

    // A stale dispatch to the swapped-out element goes nowhere.
    FakeResizeObserver.resize(first, { x: 0, y: 0, width: 999, height: 999 })
    expect(rect.value).toEqual(Rect.make(0, 0, 100, 50))

    FakeResizeObserver.resize(second, { x: 0, y: 0, width: 60, height: 30 })
    expect(rect.value).toEqual(Rect.make(0, 0, 60, 30))
  })

  test('without a ResizeObserver global the composable is inert', async () => {
    const { el, element } = makeElementRef()
    const rect = useDomRect(element)

    expect(FakeResizeObserver.instances).toHaveLength(0)

    el.value = new TestNode('div')
    await nextTick()

    expect(rect.value).toEqual(Rect.make())
  })
})

describe('useTextRect', () => {
  test('observes its element and adopts measurements', async () => {
    stubObserverGlobals()
    const el = shallowRef<TestNode | undefined>(undefined)
    const rect = useTextRect(el as unknown as ShallowRef<SVGTextElement | undefined>)

    const node = new TestNode('text')
    el.value = node
    await nextTick()

    FakeResizeObserver.resize(node, { x: 0, y: 0, width: 80, height: 20 })
    expect(rect.value).toEqual(Rect.make(0, 0, 80, 20))
  })
})
