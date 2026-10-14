import type { Rect } from 'placement/rect'
import { type App, type MaybeRefOrGetter, type VNodeArrayChildren, defineComponent, h } from 'vue'
import { useSizingContextRoot } from '../src/composables/useSizingContext.ts'
import { type TestNode, createApp, createRoot } from './renderer.ts'

export interface Host {
  app: App<TestNode>
  root: TestNode
}

// Mounts content inside a sizing context rooted at `rect` — what
// `GraphicRoot` provides, minus the DOM measurement.
export function mountWithRect(
  rect: MaybeRefOrGetter<Rect>,
  content: () => VNodeArrayChildren,
): Host {
  const HostComponent = defineComponent({
    name: 'Host',
    setup() {
      useSizingContextRoot(rect)
      return () => h('svg', content())
    },
  })
  const root = createRoot()
  const app = createApp(HostComponent)
  app.mount(root)
  return { app, root }
}

export function findAll(node: TestNode, tag: string): Array<TestNode> {
  const found: Array<TestNode> = []
  if (node.tag === tag) {
    found.push(node)
  }
  for (const child of node.children) {
    found.push(...findAll(child, tag))
  }
  return found
}

/** The single `tag` element in the tree; throws when absent or ambiguous. */
export function findOne(node: TestNode, tag: string): TestNode {
  const found = findAll(node, tag)
  if (found.length !== 1) {
    throw new Error(`expected exactly one <${tag}>, found ${found.length}`)
  }
  return found[0]!
}

interface FakeContentRect {
  x: number
  y: number
  width: number
  height: number
}

// Stand-in for the DOM ResizeObserver: records observed targets and lets the
// test dispatch measurements. Specs stub the `ResizeObserver` global to this
// class (and `Element` to `TestNode`) before mounting, then drive resizes
// with `FakeResizeObserver.resize` and await `nextTick`.
export class FakeResizeObserver {
  static instances: Array<FakeResizeObserver> = []

  readonly targets: Array<unknown> = []
  readonly #callback: (entries: Array<{ target: unknown; contentRect: FakeContentRect }>) => void

  constructor(
    callback: (entries: Array<{ target: unknown; contentRect: FakeContentRect }>) => void,
  ) {
    this.#callback = callback
    FakeResizeObserver.instances.push(this)
  }

  static reset(): void {
    FakeResizeObserver.instances = []
  }

  /** Dispatches a measurement to every observer currently watching `target`. */
  static resize(target: unknown, contentRect: FakeContentRect): void {
    for (const instance of FakeResizeObserver.instances) {
      if (instance.targets.includes(target)) {
        instance.#callback([{ target, contentRect }])
      }
    }
  }

  observe(target: unknown): void {
    this.targets.push(target)
  }

  unobserve(target: unknown): void {
    const index = this.targets.indexOf(target)
    if (index !== -1) {
      this.targets.splice(index, 1)
    }
  }

  disconnect(): void {
    this.targets.length = 0
  }
}
