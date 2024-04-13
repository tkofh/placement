import { Box, type ReadonlyRect } from './Box'
import { Emitter } from './Emitter'
import { FrameConfig, type FrameOptions } from './FrameConfig'
import { FrameNode } from './FrameNode'

const FRAME_STATE = {
  idle: 0,
  descendantNeedsUpdate: 1,
  needsUpdate: 2,
  updating: 3,
} as const

type FrameState = (typeof FRAME_STATE)[keyof typeof FRAME_STATE]

export type { FrameOptions }

export class Frame extends Emitter<{ updated: never }> {
  protected readonly box: Box
  protected readonly node: FrameNode

  readonly config: FrameConfig

  #state: FrameState = FRAME_STATE.idle

  constructor(options?: Partial<FrameOptions>) {
    super()
    this.node = new FrameNode(this)

    this.box = new Box()

    this.config = new FrameConfig(this)
    this.config.configure(options ?? {})
  }

  get parent(): Frame | null {
    return this.node.parent?.frame ?? null
  }

  get root(): Frame {
    if (this.node.root) {
      return this.node.root.frame
    }

    return this
  }

  get index(): number {
    return this.node.index
  }

  get rect(): ReadonlyRect {
    if (this.root.#state !== FRAME_STATE.updating) {
      this.update()
    }
    return this.box.rect
  }

  get innerRect(): ReadonlyRect {
    if (this.root.#state !== FRAME_STATE.updating) {
      this.update()
    }
    return this.box.innerRect
  }

  get outerRect(): ReadonlyRect {
    if (this.root.#state !== FRAME_STATE.updating) {
      this.update()
    }
    return this.box.outerRect
  }

  appendChild(frame: Frame) {
    this.node.appendChild(frame.node)
    this.markNeedsUpdate()

    return frame
  }

  insertBefore(frame: Frame, before: Frame) {
    this.node.insertBefore(frame.node, before.node)
    this.markNeedsUpdate()

    return frame
  }

  insertAt(frame: Frame, index: number) {
    this.node.insertAt(frame.node, index)
    this.markNeedsUpdate()

    return frame
  }

  removeChild(frame: Frame) {
    this.node.removeChild(frame.node)
    this.markNeedsUpdate()

    return frame
  }

  *children(): IterableIterator<this> {
    for (const { frame } of this.node.children()) {
      yield frame as this
    }
  }

  update(): void {
    if (this.root.#state === FRAME_STATE.updating) {
      throw new Error('Cannot update while updating')
    }

    if (this.root.#state !== FRAME_STATE.idle) {
      this.root.#updateTree()
    }
  }

  markNeedsUpdate() {
    if (this.root.#state === FRAME_STATE.updating) {
      throw new Error('Cannot mark needsUpdate while updating')
    }

    if (this.#state === FRAME_STATE.needsUpdate) {
      return
    }

    this.#state = FRAME_STATE.needsUpdate

    for (const ancestor of this.node.ancestors()) {
      if (ancestor.frame.#state !== FRAME_STATE.idle) {
        break
      }
      ancestor.frame.#state = FRAME_STATE.descendantNeedsUpdate
    }
  }

  protected layout() {
    for (const frame of this.children()) {
      frame.box.paddingTop = frame.config.paddingTop
      frame.box.paddingRight = frame.config.paddingRight
      frame.box.paddingBottom = frame.config.paddingBottom
      frame.box.paddingLeft = frame.config.paddingLeft

      if (
        frame.config.marginTop === 'auto' &&
        frame.config.marginBottom === 'auto'
      ) {
        const freeSpace = this.box.innerRect.height - frame.box.height
        frame.box.marginTop = freeSpace / 2
        frame.box.marginBottom = freeSpace / 2
      } else if (
        frame.config.marginTop === 'auto' &&
        frame.config.marginBottom !== 'auto'
      ) {
        frame.box.marginTop =
          this.box.innerRect.height -
          frame.box.height -
          frame.config.marginBottom
      } else if (
        frame.config.marginTop !== 'auto' &&
        frame.config.marginBottom === 'auto'
      ) {
        frame.box.marginBottom =
          this.box.innerRect.height - frame.box.height - frame.config.marginTop
      } else if (
        frame.config.marginTop !== 'auto' &&
        frame.config.marginBottom !== 'auto'
      ) {
        frame.box.marginTop = frame.config.marginTop
        frame.box.marginBottom = frame.config.marginBottom
      }

      if (
        frame.config.marginLeft === 'auto' &&
        frame.config.marginRight === 'auto'
      ) {
        const freeSpace = this.box.innerRect.width - frame.box.width
        frame.box.marginLeft = freeSpace / 2
        frame.box.marginRight = freeSpace / 2
      } else if (
        frame.config.marginLeft === 'auto' &&
        frame.config.marginRight !== 'auto'
      ) {
        frame.box.marginLeft =
          this.box.innerRect.width - frame.box.width - frame.config.marginRight
      } else if (
        frame.config.marginLeft !== 'auto' &&
        frame.config.marginRight === 'auto'
      ) {
        frame.box.marginRight =
          this.box.innerRect.width - frame.box.width - frame.config.marginLeft
      } else if (
        frame.config.marginLeft !== 'auto' &&
        frame.config.marginRight !== 'auto'
      ) {
        frame.box.marginLeft = frame.config.marginLeft
        frame.box.marginRight = frame.config.marginRight
      }

      frame.box.outerX = this.innerRect.x + frame.config.x
      frame.box.outerY = this.innerRect.y + frame.config.y
      frame.box.width = frame.config.constrainedWidth
      frame.box.height = frame.config.constrainedHeight
    }
  }

  protected getChildBox(frame: Frame): Box {
    if (frame.node.parent !== this.node) {
      throw new Error('Can only access boxes of direct children')
    }
    return frame.box
  }

  #updateTree() {
    // if the root needs to update we skip to the calculation step,
    // as all descendants will need to be recalculated
    if (this.#state === FRAME_STATE.needsUpdate) {
      this.#state = FRAME_STATE.updating

      this.#calculate()

      this.#state = FRAME_STATE.idle

      return
    }

    this.#state = FRAME_STATE.updating

    const skips = this.node.skips

    const descendants = this.node.descendants(this.node.traversal.depth)
    let descendant = descendants.next()
    while (!descendant.done) {
      const { frame } = descendant.value

      if (frame.#state === FRAME_STATE.idle) {
        descendant = descendants.next(skips.descendants)
      } else if (frame.#state === FRAME_STATE.descendantNeedsUpdate) {
        frame.#state = FRAME_STATE.idle
        descendant = descendants.next(skips.none)
      } else {
        frame.#calculate()
        descendant = descendants.next(skips.descendants)
      }
    }

    this.#state = FRAME_STATE.idle
  }

  #calculate() {
    const isRoot = this.root === this
    if (isRoot) {
      this.box.width = this.config.width
      this.box.height = this.config.height
    }

    this.layout()

    if (!isRoot) {
      this.#state = FRAME_STATE.idle
    }

    this.emit('updated')

    for (const child of this.node.children()) {
      child.frame.#calculate()
    }
  }
}
