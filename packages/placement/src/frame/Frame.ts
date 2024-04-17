import { AbsoluteLayout } from '../layout/absolute'
import { FlexLayout } from '../layout/flex'
import type { Layout } from '../layout/types'
import type { ReadonlyRect } from '../rect'
import { Rect } from '../rect/Rect'
import { ComputedFrameProperties } from './ComputedFrameProperties'
import { Emitter } from './Emitter'
import { FrameNode } from './FrameNode'
import {
  type AutoLengthPercentInput,
  type AutoNoneLengthPercentNegativeInput,
  type AutoRatioInput,
  FrameProperties,
  type LengthPercentageInput,
  type NoneLengthPercentInput,
  type NoneNumberInput,
  type ScalarNumberInput,
} from './FrameProperties'

const FRAME_STATE = {
  idle: 0,
  descendantNeedsUpdate: 1,
  needsUpdate: 2,
  updating: 3,
} as const

type FrameState = (typeof FRAME_STATE)[keyof typeof FRAME_STATE]

export class Frame {
  readonly #rect: Rect
  readonly #properties: FrameProperties
  readonly #node: FrameNode
  readonly #emitter = new Emitter<{ updated: never }>()
  readonly #layout: Layout
  #state: FrameState = FRAME_STATE.idle

  readonly #computed: ComputedFrameProperties

  constructor(layout: 'flex' | 'absolute') {
    this.#rect = new Rect()
    this.#properties = new FrameProperties()
    this.#computed = new ComputedFrameProperties(this.#properties, this.#rect)
    this.#node = new FrameNode(this)
    this.#layout =
      layout === 'absolute'
        ? new AbsoluteLayout(this.#computed, this.#rect.readonly)
        : new FlexLayout(this.#computed, this.#rect.readonly)
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

  //region Properties
  get width(): AutoLengthPercentInput {
    return this.#properties.width.value
  }
  set width(value: AutoLengthPercentInput) {
    const width = this.#properties.width
    if (width.value !== value) {
      width.value = value
      this.#configUpdated()
    }
  }

  get height(): AutoLengthPercentInput {
    return this.#properties.height.value
  }
  set height(value: AutoLengthPercentInput) {
    const height = this.#properties.height
    if (height.value !== value) {
      height.value = value
      this.#configUpdated()
    }
  }

  get aspectRatio(): AutoRatioInput {
    return this.#properties.aspectRatio.value
  }
  set aspectRatio(value: AutoRatioInput) {
    const aspectRatio = this.#properties.aspectRatio
    if (aspectRatio.value !== value) {
      aspectRatio.value = value
      this.#configUpdated()
    }
  }

  get minWidth(): NoneLengthPercentInput {
    return this.#properties.minWidth.value
  }
  set minWidth(value: NoneLengthPercentInput) {
    const minWidth = this.#properties.minWidth
    if (minWidth.value !== value) {
      minWidth.value = value
      this.#configUpdated()
    }
  }

  get minHeight(): NoneLengthPercentInput {
    return this.#properties.minHeight.value
  }
  set minHeight(value: NoneLengthPercentInput) {
    const minHeight = this.#properties.minHeight
    if (minHeight.value !== value) {
      minHeight.value = value
      this.#configUpdated()
    }
  }

  get maxWidth(): NoneLengthPercentInput {
    return this.#properties.maxWidth.value
  }
  set maxWidth(value: NoneLengthPercentInput) {
    const maxWidth = this.#properties.maxWidth
    if (maxWidth.value !== value) {
      maxWidth.value = value
      this.#configUpdated()
    }
  }

  get maxHeight(): NoneLengthPercentInput {
    return this.#properties.maxHeight.value
  }
  set maxHeight(value: NoneLengthPercentInput) {
    const maxHeight = this.#properties.maxHeight
    if (maxHeight.value !== value) {
      maxHeight.value = value
      this.#configUpdated()
    }
  }

  get offsetTop(): AutoNoneLengthPercentNegativeInput {
    return this.#properties.offsetTop.value
  }
  set offsetTop(value: AutoNoneLengthPercentNegativeInput) {
    const offsetTop = this.#properties.offsetTop
    if (offsetTop.value !== value) {
      offsetTop.value = value
      this.#configUpdated()
    }
  }

  get offsetRight(): AutoNoneLengthPercentNegativeInput {
    return this.#properties.offsetRight.value
  }
  set offsetRight(value: AutoNoneLengthPercentNegativeInput) {
    const offsetRight = this.#properties.offsetRight
    if (offsetRight.value !== value) {
      offsetRight.value = value
      this.#configUpdated()
    }
  }

  get offsetBottom(): AutoNoneLengthPercentNegativeInput {
    return this.#properties.offsetBottom.value
  }
  set offsetBottom(value: AutoNoneLengthPercentNegativeInput) {
    const offsetBottom = this.#properties.offsetBottom
    if (offsetBottom.value !== value) {
      offsetBottom.value = value
      this.#configUpdated()
    }
  }

  get offsetLeft(): AutoNoneLengthPercentNegativeInput {
    return this.#properties.offsetLeft.value
  }
  set offsetLeft(value: AutoNoneLengthPercentNegativeInput) {
    const offsetLeft = this.#properties.offsetLeft
    if (offsetLeft.value !== value) {
      offsetLeft.value = value
      this.#configUpdated()
    }
  }

  get insetTop(): LengthPercentageInput {
    return this.#properties.insetTop.value
  }
  set insetTop(value: LengthPercentageInput) {
    const insetTop = this.#properties.insetTop
    if (insetTop.value !== value) {
      insetTop.value = value
      this.#configUpdated()
    }
  }

  get insetRight(): LengthPercentageInput {
    return this.#properties.insetRight.value
  }
  set insetRight(value: LengthPercentageInput) {
    const insetRight = this.#properties.insetRight
    if (insetRight.value !== value) {
      insetRight.value = value
      this.#configUpdated()
    }
  }

  get insetBottom(): LengthPercentageInput {
    return this.#properties.insetBottom.value
  }
  set insetBottom(value: LengthPercentageInput) {
    const insetBottom = this.#properties.insetBottom
    if (insetBottom.value !== value) {
      insetBottom.value = value
      this.#configUpdated()
    }
  }

  get insetLeft(): LengthPercentageInput {
    return this.#properties.insetLeft.value
  }
  set insetLeft(value: LengthPercentageInput) {
    const insetLeft = this.#properties.insetLeft
    if (insetLeft.value !== value) {
      insetLeft.value = value
      this.#configUpdated()
    }
  }

  get grow(): NoneNumberInput {
    return this.#properties.grow.value
  }
  set grow(value: NoneNumberInput) {
    const grow = this.#properties.grow
    if (grow.value !== value) {
      grow.value = value
      this.#configUpdated()
    }
  }

  get shrink(): NoneNumberInput {
    return this.#properties.shrink.value
  }
  set shrink(value: NoneNumberInput) {
    const shrink = this.#properties.shrink
    if (shrink.value !== value) {
      shrink.value = value
      this.#configUpdated()
    }
  }

  get flexDirection(): 'row' | 'row-reverse' | 'column' | 'column-reverse' {
    return this.#properties.flexDirection.value
  }
  set flexDirection(value:
    | 'row'
    | 'row-reverse'
    | 'column'
    | 'column-reverse') {
    const flexDirection = this.#properties.flexDirection
    if (flexDirection.value !== value) {
      flexDirection.value = value
      this.#configUpdated()
    }
  }

  get flexWrap(): 'nowrap' | 'wrap' | 'wrap-reverse' {
    return this.#properties.flexWrap.value
  }
  set flexWrap(value: 'nowrap' | 'wrap' | 'wrap-reverse') {
    const flexWrap = this.#properties.flexWrap
    if (flexWrap.value !== value) {
      flexWrap.value = value
      this.#configUpdated()
    }
  }

  get justifyContent(): ScalarNumberInput {
    return this.#properties.justifyContent.value
  }
  set justifyContent(value: ScalarNumberInput) {
    const justifyContent = this.#properties.justifyContent
    if (justifyContent.value !== value) {
      justifyContent.value = value
      this.#configUpdated()
    }
  }

  get justifyItems(): ScalarNumberInput {
    return this.#properties.justifyItems.value
  }
  set justifyItems(value: ScalarNumberInput) {
    const justifyItems = this.#properties.justifyItems
    if (justifyItems.value !== value) {
      justifyItems.value = value
      this.#configUpdated()
    }
  }

  get justifySelf(): ScalarNumberInput {
    return this.#properties.justifySelf.value
  }
  set justifySelf(value: ScalarNumberInput) {
    const justifySelf = this.#properties.justifySelf
    if (justifySelf.value !== value) {
      justifySelf.value = value
      this.#configUpdated()
    }
  }

  get alignItems(): ScalarNumberInput {
    return this.#properties.alignItems.value
  }
  set alignItems(value: ScalarNumberInput) {
    const alignItems = this.#properties.alignItems
    if (alignItems.value !== value) {
      alignItems.value = value
      this.#configUpdated()
    }
  }

  get alignContent(): ScalarNumberInput {
    return this.#properties.alignContent.value
  }
  set alignContent(value: ScalarNumberInput) {
    const alignContent = this.#properties.alignContent
    if (alignContent.value !== value) {
      alignContent.value = value
      this.#configUpdated()
    }
  }

  get alignSelf(): ScalarNumberInput {
    return this.#properties.alignSelf.value
  }
  set alignSelf(value: ScalarNumberInput) {
    const alignSelf = this.#properties.alignSelf
    if (alignSelf.value !== value) {
      alignSelf.value = value
      this.#configUpdated()
    }
  }

  get rowGap(): NoneLengthPercentInput {
    return this.#properties.rowGap.value
  }
  set rowGap(value: NoneLengthPercentInput) {
    const rowGap = this.#properties.rowGap
    if (rowGap.value !== value) {
      rowGap.value = value
      this.#configUpdated()
    }
  }

  get columnGap(): NoneLengthPercentInput {
    return this.#properties.columnGap.value
  }
  set columnGap(value: NoneLengthPercentInput) {
    const columnGap = this.#properties.columnGap
    if (columnGap.value !== value) {
      columnGap.value = value
      this.#configUpdated()
    }
  }

  get justifySpace(): ScalarNumberInput {
    return this.#properties.justifySpace.value
  }
  set justifySpace(value: ScalarNumberInput) {
    const justifySpace = this.#properties.justifySpace
    if (justifySpace.value !== value) {
      justifySpace.value = value
      this.#configUpdated()
    }
  }

  get alignSpace(): ScalarNumberInput {
    return this.#properties.alignSpace.value
  }
  set alignSpace(value: ScalarNumberInput) {
    const alignSpace = this.#properties.alignSpace
    if (alignSpace.value !== value) {
      alignSpace.value = value
      this.#configUpdated()
    }
  }

  get justifySpaceOuter(): ScalarNumberInput {
    return this.#properties.justifySpaceOuter.value
  }
  set justifySpaceOuter(value: ScalarNumberInput) {
    const justifySpaceOuter = this.#properties.justifySpaceOuter
    if (justifySpaceOuter.value !== value) {
      justifySpaceOuter.value = value
      this.#configUpdated()
    }
  }

  get alignSpaceOuter(): ScalarNumberInput {
    return this.#properties.alignSpaceOuter.value
  }
  set alignSpaceOuter(value: ScalarNumberInput) {
    const alignSpaceOuter = this.#properties.alignSpaceOuter
    if (alignSpaceOuter.value !== value) {
      alignSpaceOuter.value = value
      this.#configUpdated()
    }
  }

  get stretchContent(): ScalarNumberInput {
    return this.#properties.stretchContent.value
  }
  set stretchContent(value: ScalarNumberInput) {
    const stretchContent = this.#properties.stretchContent
    if (stretchContent.value !== value) {
      stretchContent.value = value
      this.#configUpdated()
    }
  }

  get stretchItems(): ScalarNumberInput {
    return this.#properties.stretchItems.value
  }
  set stretchItems(value: ScalarNumberInput) {
    const stretchItems = this.#properties.stretchItems
    if (stretchItems.value !== value) {
      stretchItems.value = value
      this.#configUpdated()
    }
  }

  get stretchSelf(): ScalarNumberInput {
    return this.#properties.stretchSelf.value
  }
  set stretchSelf(value: ScalarNumberInput) {
    const stretchSelf = this.#properties.stretchSelf
    if (stretchSelf.value !== value) {
      stretchSelf.value = value
      this.#configUpdated()
    }
  }
  //endregion

  get rect(): ReadonlyRect {
    if (this.root.#state !== FRAME_STATE.updating) {
      this.update()
    }
    return this.#rect.readonly
  }

  appendChild(frame: Frame) {
    this.#node.appendChild(frame.#node)

    this.#layout.insert(frame.#computed, frame.#rect, frame.#node.index)

    frame.#computed.updateRects(this.#rect.readonly, this.root.#rect.readonly)

    this.#markNeedsUpdate()

    return frame
  }

  insertBefore(frame: Frame, before: Frame) {
    this.#node.insertBefore(frame.#node, before.#node)

    this.#layout.insert(frame.#computed, frame.#rect, frame.#node.index)

    frame.#computed.updateRects(this.#rect.readonly, this.root.#rect.readonly)

    this.#markNeedsUpdate()

    return frame
  }

  insertAt(frame: Frame, index: number) {
    this.#node.insertAt(frame.#node, index)

    this.#layout.insert(frame.#computed, frame.#rect, frame.#node.index)

    frame.#computed.updateRects(this.#rect.readonly, this.root.#rect.readonly)

    this.#markNeedsUpdate()

    return frame
  }

  removeChild(frame: Frame) {
    this.#node.removeChild(frame.#node)

    this.#layout.remove(frame.#computed)

    frame.#computed.updateRects(frame.#rect.readonly)

    this.#markNeedsUpdate()

    return frame
  }

  update(): void {
    if (this.root.#state === FRAME_STATE.updating) {
      throw new Error('Cannot update while updating')
    }

    if (this.root.#state !== FRAME_STATE.idle) {
      this.root.#updateTree()
    }
  }

  onUpdate(callback: () => void) {
    this.#emitter.on('updated', callback)

    return () => {
      this.#emitter.off('updated', callback)
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

  #configUpdated() {
    if (this.parent) {
      this.parent.#markNeedsUpdate()
    } else {
      this.#markNeedsUpdate()
    }
  }

  #updateTree() {
    const width = this.#computed.width
    const height = this.#computed.height
    if (width === 'auto' || height === 'auto') {
      throw new Error('Root frame must have definite width and height')
    }

    this.#rect.width = width
    this.#rect.height = height

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
    if (this.#node.size === 1) {
      return
    }

    if (this.root !== this) {
      this.#state = FRAME_STATE.idle
    }

    this.#layout.calculate()

    this.#emitter.emit('updated')

    for (const child of this.#node.children()) {
      child.frame.#calculate()
    }
  }
}
