import type { Frame } from './Frame'

export class FrameNode {
  static traversal = {
    depth: 0,
    breadth: 1,
  } as const

  static skips = {
    none: 0,
    siblings: 1,
    descendants: 2,
  } as const

  readonly frame: Frame

  #root: this = this
  #parent: this | null = null
  #index = -1
  #depth = 0
  #size = 1

  #children: Array<this> = []

  constructor(frame: Frame) {
    this.frame = frame
  }

  get index(): number {
    return this.#index
  }

  get parent(): this | null {
    return this.#parent
  }

  get root(): this {
    return this.#root
  }

  get size(): number {
    return this.#size
  }

  appendChild(child: this): this {
    if (child.#parent !== null) {
      child.#parent.#removeChild(child)
    }

    this.#children.push(child)

    child.#setParent(this)
    this.#adjustSize(child.#size)

    return child
  }

  insertBefore(child: this, before: this | null): this {
    if (before === null) {
      return this.appendChild(child)
    }

    if (before.#parent !== this) {
      throw new Error('Provided before node is not a child of this node')
    }

    if (child.#parent !== null) {
      child.#parent.removeChild(child)
    }

    this.#children.splice(before.#index, 0, child)

    child.#setParent(this)
    this.#adjustSize(child.#size)

    for (let i = child.#index + 1; i < this.#children.length; i++) {
      this.#children[i].#index = i
    }

    return child
  }

  insertAt(child: this, index: number): this {
    if (child.#parent !== null) {
      child.#parent.removeChild(child)
    }

    const insertIndex = Math.min(this.#children.length, Math.max(index, 0))

    if (insertIndex === this.#children.length) {
      this.#children.push(child)
    } else {
      this.#children.splice(insertIndex, 0, child)
    }

    child.#setParent(this)
    this.#adjustSize(child.#size)

    for (let i = insertIndex + 1; i < this.#children.length; i++) {
      this.#children[i].#index = i
    }

    return child
  }

  removeChild(child: this): this {
    this.#removeChild(child)
    child.#setParent(null)

    return child
  }

  children(): IterableIterator<this> {
    return this.#children[Symbol.iterator]()
  }

  *descendants(
    traverse: number = FrameNode.traversal.depth,
  ): Generator<this, undefined, number | undefined> {
    const stack: Array<this> = [...this.#children]

    while (stack.length > 0) {
      const node = stack.shift() as this

      let skips = yield node
      skips = skips ?? FrameNode.skips.none

      if (0 !== (FrameNode.skips.siblings & skips) && node.#parent !== null) {
        stack.splice(0, node.#parent.#children.length - node.#index - 1)
      }

      if ((FrameNode.skips.descendants & skips) === 0) {
        if (traverse === FrameNode.traversal.depth) {
          stack.unshift(...node.#children)
        } else {
          stack.push(...node.#children)
        }
      }
    }
  }

  *ancestors(): IterableIterator<this> {
    if (this.#parent === null) {
      return
    }

    let node: this = this.#parent
    while (true) {
      yield node

      if (node.#parent === null) {
        break
      }

      node = node.#parent
    }
  }

  #removeChild(child: this) {
    if (child.#parent !== this) {
      throw new Error('Provided node is not a child of this node')
    }

    this.#adjustSize(-child.#size)

    const index = this.#children.indexOf(child)
    this.#children.splice(index, 1)
    for (let i = index; i < this.#children.length; i++) {
      this.#children[i].#index = i
    }
  }

  #setParent(parent: this | null) {
    this.#parent = parent
    if (parent === null) {
      this.#root = this
      this.#index = -1
      this.#depth = 0
    } else {
      this.#root = parent.#root
      this.#index = parent.#children.indexOf(this)
      this.#depth = parent.#depth + 1

      for (const sibling of parent.#children.slice(this.#index + 1)) {
        sibling.#index++
      }
    }

    for (const descendant of this.descendants()) {
      descendant.#root = this.#root
    }
  }

  #adjustSize(size: number) {
    this.#size += size
    for (const ancestor of this.ancestors()) {
      ancestor.#size += size
    }
  }
}
