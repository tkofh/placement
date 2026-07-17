import { createRenderer } from 'vue'

// A minimal object-tree host for driving components without a DOM. Uniform
// node shape (elements, text, and comments all carry every field) so nodeOps
// never needs to narrow.
export interface TestNode {
  children: Array<TestNode>
  parent: TestNode | null
  props: Record<string, unknown>
  tag: string
  text: string
}

function make(tag: string, text = ''): TestNode {
  return { children: [], parent: null, props: {}, tag, text }
}

function detach(node: TestNode): void {
  const parent = node.parent
  if (parent) {
    const index = parent.children.indexOf(node)
    if (index !== -1) {
      parent.children.splice(index, 1)
    }
    node.parent = null
  }
}

const renderer = createRenderer<TestNode, TestNode>({
  createComment: (text) => make('#comment', text),
  createElement: (tag) => make(tag),
  createText: (text) => make('#text', text),
  // Detach first: KeepAlive and keyed patches move nodes between parents.
  insert(node, parent, anchor) {
    detach(node)
    node.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    if (index === -1) {
      parent.children.push(node)
    } else {
      parent.children.splice(index, 0, node)
    }
  },
  nextSibling(node) {
    const siblings = node.parent?.children ?? []
    return siblings[siblings.indexOf(node) + 1] ?? null
  },
  parentNode: (node) => node.parent,
  patchProp(el, key, _prevValue, nextValue) {
    el.props[key] = nextValue
  },
  remove: detach,
  setElementText(el, text) {
    const child = make('#text', text)
    child.parent = el
    el.children = [child]
  },
  setText(node, text) {
    node.text = text
  },
})

export const { createApp } = renderer

export function createRoot(): TestNode {
  return make('#root')
}
