import { Box, type ReadonlyRect } from './Box'
import { Emitter } from './Emitter'
import { FrameConfig, type FrameOptions } from './FrameConfig'
import { FrameNode } from './FrameNode'

const FRAME_STATE = {
  clean: 0,
  dirty: 1,
  updating: 2,
} as const

type FrameState = (typeof FRAME_STATE)[keyof typeof FRAME_STATE]

export class Frame extends Emitter<{ updated: never }> {
  protected readonly box: Box
  protected readonly node: FrameNode

  readonly config: FrameConfig

  #state: FrameState = FRAME_STATE.clean

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
    this.update()
    return this.box.rect
  }

  get innerRect(): ReadonlyRect {
    this.update()
    return this.box.innerRect
  }

  get outerRect(): ReadonlyRect {
    this.update()
    return this.box.outerRect
  }

  update(): void {
    if (
      (this.parent === null && this.#state !== FRAME_STATE.dirty) ||
      this.#state === FRAME_STATE.updating
    ) {
      return
    }

    const node = this.node.findLastAncestor(
      (node) => node.frame.#state === FRAME_STATE.dirty,
    )
    if (node) {
      node.frame.#calculate()
    }
  }

  appendChild(frame: Frame) {
    this.node.appendChild(frame.node)
    this.markDirty()

    return frame
  }

  insertBefore(frame: Frame, before: Frame) {
    this.node.insertBefore(frame.node, before.node)
    this.markDirty()

    return frame
  }

  insertAt(frame: Frame, index: number) {
    this.node.insertAt(frame.node, index)
    this.markDirty()

    return frame
  }

  removeChild(frame: Frame) {
    this.node.removeChild(frame.node)
    this.markDirty()

    return frame
  }

  *children(): IterableIterator<this> {
    for (const { frame } of this.node.children()) {
      yield frame as this
    }
  }

  protected layout() {
    for (const frame of this.children()) {
      frame.box.paddingTop = frame.config.paddingTop
      frame.box.paddingRight = frame.config.paddingRight
      frame.box.paddingBottom = frame.config.paddingBottom
      frame.box.paddingLeft = frame.config.paddingLeft

      frame.box.marginTop = frame.config.marginTop
      frame.box.marginRight = frame.config.marginRight
      frame.box.marginBottom = frame.config.marginBottom
      frame.box.marginLeft = frame.config.marginLeft

      frame.box.outerX = this.innerRect.x + frame.config.x
      frame.box.outerY = this.innerRect.y + frame.config.y
      frame.box.width = frame.config.constrainedWidth
      frame.box.height = frame.config.constrainedHeight
    }
  }

  markDirty() {
    this.#state = FRAME_STATE.dirty

    if (this.parent && this.parent.#state === FRAME_STATE.clean) {
      for (const ancestor of this.node.ancestors()) {
        if (ancestor.frame.#state !== FRAME_STATE.clean) {
          break
        }
        ancestor.frame.#state = FRAME_STATE.dirty
      }
    }

    const descendants = this.node.descendants()
    let descendant = descendants.next()
    while (descendant.done === false) {
      let skip: number = descendant.value.skips.none
      if (!descendant.value.frame.#state) {
        descendant.value.frame.#state = FRAME_STATE.dirty
        skip = descendant.value.skips.descendants
      }
      descendant = descendants.next(skip)
    }
  }

  protected getChildBox(frame: Frame): Box {
    if (frame.node.parent !== this.node) {
      throw new Error('Can only access boxes of direct children')
    }
    return frame.box
  }

  #calculate() {
    let holdsLock = false
    if (this.root.#state !== FRAME_STATE.updating) {
      this.root.#state = FRAME_STATE.updating
      holdsLock = true
    }

    if (this.parent === null) {
      this.box.width = this.config.width
      this.box.height = this.config.height
    }

    this.layout()

    if (this.root !== this) {
      this.#state = FRAME_STATE.clean
    }

    this.emit('updated')

    for (const child of this.node.children()) {
      child.frame.#calculate()
    }

    if (holdsLock) {
      this.root.#state = FRAME_STATE.clean
    }
  }
}
