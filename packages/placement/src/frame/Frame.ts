import { Emitter } from '../Emitter'
import { FrameConfig, type FrameOptions } from '../placement/FrameConfig'
import type { ReadonlyRect } from '../rect'
import { Rect } from '../rect/Rect'
import { FrameNode } from './FrameNode'

const FRAME_STATE = {
  idle: 0,
  descendantNeedsUpdate: 1,
  needsUpdate: 2,
  updating: 3,
} as const

type FrameState = (typeof FRAME_STATE)[keyof typeof FRAME_STATE]

export type { FrameOptions }

export class Frame {
  readonly config: FrameConfig

  readonly #rect: Rect
  readonly #node: FrameNode
  readonly #emitter = new Emitter<{ updated: never }>()
  #state: FrameState = FRAME_STATE.idle

  constructor(_options?: Partial<FrameOptions>) {
    this.#rect = new Rect()
    this.#node = new FrameNode(this)

    this.config = new FrameConfig(this)
  }

  get parent(): Frame | null {
    return this.#node.parent?.frame ?? null
  }

  get root(): Frame {
    if (this.#node.root) {
      return this.#node.root.frame
    }

    return this
  }

  // get index(): number {
  //   return this.#node.index
  // }

  get rect(): ReadonlyRect {
    if (this.root.#state !== FRAME_STATE.updating) {
      this.update()
    }
    return this.#rect.readonly
  }

  appendChild(frame: Frame) {
    this.#node.appendChild(frame.#node)
    this.#markNeedsUpdate()

    return frame
  }

  insertBefore(frame: Frame, before: Frame) {
    this.#node.insertBefore(frame.#node, before.#node)
    this.#markNeedsUpdate()

    return frame
  }

  insertAt(frame: Frame, index: number) {
    this.#node.insertAt(frame.#node, index)
    this.#markNeedsUpdate()

    return frame
  }

  removeChild(frame: Frame) {
    this.#node.removeChild(frame.#node)
    this.#markNeedsUpdate()

    return frame
  }

  // *children(): IterableIterator<this> {
  //   for (const { frame } of this.#node.children()) {
  //     yield frame as this
  //   }
  // }

  update(): void {
    if (this.root.#state === FRAME_STATE.updating) {
      throw new Error('Cannot update while updating')
    }

    if (this.root.#state !== FRAME_STATE.idle) {
      this.root.#updateTree()
    }
  }

  #markNeedsUpdate() {
    if (this.root.#state === FRAME_STATE.updating) {
      throw new Error('Cannot mark needsUpdate while updating')
    }

    if (this.#state === FRAME_STATE.needsUpdate) {
      return
    }

    this.#state = FRAME_STATE.needsUpdate

    for (const ancestor of this.#node.ancestors()) {
      if (ancestor.frame.#state !== FRAME_STATE.idle) {
        break
      }
      ancestor.frame.#state = FRAME_STATE.descendantNeedsUpdate
    }
  }

  onUpdate(callback: () => void) {
    this.#emitter.on('updated', callback)

    return () => {
      this.#emitter.off('updated', callback)
    }
  }

  protected getChildBox(frame: Frame): Rect {
    if (frame.#node.parent !== this.#node) {
      throw new Error('Can only access boxes of direct children')
    }
    return frame.#rect
  }

  #updateTree() {
    if (this.config.width === 'auto' || this.config.height === 'auto') {
      throw new Error('Root frame must have definite width and height')
    }

    this.#rect.width = this.config.width
    this.#rect.height = this.config.height

    // if the root needs to update we skip to the calculation step,
    // as all descendants will need to be recalculated
    if (this.#state === FRAME_STATE.needsUpdate) {
      this.#state = FRAME_STATE.updating

      this.#calculate()

      this.#state = FRAME_STATE.idle

      return
    }

    this.#state = FRAME_STATE.updating

    const skips = this.#node.skips

    const descendants = this.#node.descendants(this.#node.traversal.depth)
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
    if (this.root !== this) {
      this.#state = FRAME_STATE.idle
    }

    this.#emitter.emit('updated')

    for (const child of this.#node.children()) {
      child.frame.#calculate()
    }
  }
}
