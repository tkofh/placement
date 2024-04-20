import { AbsoluteLayout } from '../layout/absolute'
import { FlexLayout } from '../layout/flex'
import type { Layout } from '../layout/types'
import type { ReadonlyRect } from '../rect'
import { Rect } from '../rect/Rect'
import { ComputedFrameProperties } from './ComputedFrameProperties'
import { Emitter } from './Emitter'
import { FrameInnerRect } from './FrameInnerRect'
import { FrameNode } from './FrameNode'
import {
  type AutoLengthPercentInput,
  type AutoNoneLengthPercentNegativeInput,
  type AutoRatioInput,
  type AutoScalarNumberInput,
  FrameProperties,
  type LengthPercentNegativeInput,
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
  readonly #emitter = new Emitter<{ updated: never }>()
  readonly #rect = new Rect()
  readonly #properties = new FrameProperties()
  readonly #computed = new ComputedFrameProperties(this.#properties, this.#rect)
  readonly #innerRect = new FrameInnerRect(this.#rect, this.#computed)
  readonly #node = new FrameNode(this)
  #state: FrameState = FRAME_STATE.idle

  readonly #layout: Layout

  constructor(layout: 'flex' | 'absolute') {
    this.#layout =
      layout === 'absolute'
        ? new AbsoluteLayout(this.#innerRect)
        : new FlexLayout(this.#computed, this.#innerRect)
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

  get offsetX(): AutoNoneLengthPercentNegativeInput | 'mixed' {
    const offsetLeft = this.offsetLeft
    const offsetRight = this.offsetRight
    if (offsetLeft === offsetRight) {
      return offsetLeft
    }
    return 'mixed'
  }
  set offsetX(value: AutoNoneLengthPercentNegativeInput) {
    this.offsetLeft = value
    this.offsetRight = value
  }

  get offsetY(): AutoNoneLengthPercentNegativeInput | 'mixed' {
    const offsetTop = this.offsetTop
    const offsetBottom = this.offsetBottom
    if (offsetTop === offsetBottom) {
      return offsetTop
    }
    return 'mixed'
  }
  set offsetY(value: AutoNoneLengthPercentNegativeInput) {
    this.offsetTop = value
    this.offsetBottom = value
  }

  get offset(): AutoNoneLengthPercentNegativeInput | 'mixed' {
    const offsetX = this.offsetX
    const offsetY = this.offsetY
    if (offsetX === offsetY) {
      return offsetX
    }
    return 'mixed'
  }
  set offset(value: AutoNoneLengthPercentNegativeInput) {
    this.offsetX = value
    this.offsetY = value
  }

  get insetTop(): LengthPercentNegativeInput {
    return this.#properties.insetTop.value
  }
  set insetTop(value: LengthPercentNegativeInput) {
    const insetTop = this.#properties.insetTop
    if (insetTop.value !== value) {
      insetTop.value = value
      this.#configUpdated()
    }
  }

  get insetRight(): LengthPercentNegativeInput {
    return this.#properties.insetRight.value
  }
  set insetRight(value: LengthPercentNegativeInput) {
    const insetRight = this.#properties.insetRight
    if (insetRight.value !== value) {
      insetRight.value = value
      this.#configUpdated()
    }
  }

  get insetBottom(): LengthPercentNegativeInput {
    return this.#properties.insetBottom.value
  }
  set insetBottom(value: LengthPercentNegativeInput) {
    const insetBottom = this.#properties.insetBottom
    if (insetBottom.value !== value) {
      insetBottom.value = value
      this.#configUpdated()
    }
  }

  get insetLeft(): LengthPercentNegativeInput {
    return this.#properties.insetLeft.value
  }
  set insetLeft(value: LengthPercentNegativeInput) {
    const insetLeft = this.#properties.insetLeft
    if (insetLeft.value !== value) {
      insetLeft.value = value
      this.#configUpdated()
    }
  }

  get insetX(): LengthPercentNegativeInput | 'mixed' {
    const insetLeft = this.insetLeft
    const insetRight = this.insetRight
    if (insetLeft === insetRight) {
      return insetLeft
    }
    return 'mixed'
  }
  set insetX(value: LengthPercentNegativeInput) {
    this.insetLeft = value
    this.insetRight = value
  }

  get insetY(): LengthPercentNegativeInput | 'mixed' {
    const insetTop = this.insetTop
    const insetBottom = this.insetBottom
    if (insetTop === insetBottom) {
      return insetTop
    }
    return 'mixed'
  }
  set insetY(value: LengthPercentNegativeInput) {
    this.insetTop = value
    this.insetBottom = value
  }

  get inset(): LengthPercentNegativeInput | 'mixed' {
    const insetX = this.insetX
    const insetY = this.insetY
    if (insetX === insetY) {
      return insetX
    }
    return 'mixed'
  }
  set inset(value: LengthPercentNegativeInput) {
    this.insetX = value
    this.insetY = value
  }

  get translateX(): LengthPercentNegativeInput {
    return this.#properties.translateX.value
  }
  set translateX(value: LengthPercentNegativeInput) {
    const translateX = this.#properties.translateX
    if (translateX.value !== value) {
      translateX.value = value
      this.#configUpdated()
    }
  }

  get translateY(): LengthPercentNegativeInput {
    return this.#properties.translateY.value
  }
  set translateY(value: LengthPercentNegativeInput) {
    const translateY = this.#properties.translateY
    if (translateY.value !== value) {
      translateY.value = value
      this.#configUpdated()
    }
  }

  get translate(): LengthPercentNegativeInput | 'mixed' {
    const translateX = this.translateX
    const translateY = this.translateY
    if (translateX === translateY) {
      return translateX
    }
    return 'mixed'
  }
  set translate(value: LengthPercentNegativeInput) {
    this.translateX = value
    this.translateY = value
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

  // get justifyItems(): ScalarNumberInput {
  //   return this.#property.justifyItems.value
  // }
  // set justifyItems(value: ScalarNumberInput) {
  //   const justifyItems = this.#property.justifyItems
  //   if (justifyItems.value !== value) {
  //     justifyItems.value = value
  //     this.#configUpdated()
  //   }
  // }
  //
  // get justifySelf(): ScalarNumberInput {
  //   return this.#property.justifySelf.value
  // }
  // set justifySelf(value: ScalarNumberInput) {
  //   const justifySelf = this.#property.justifySelf
  //   if (justifySelf.value !== value) {
  //     justifySelf.value = value
  //     this.#configUpdated()
  //   }
  // }

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

  get alignSelf(): AutoScalarNumberInput {
    return this.#properties.alignSelf.value
  }
  set alignSelf(value: AutoScalarNumberInput) {
    const alignSelf = this.#properties.alignSelf
    if (alignSelf.value !== value) {
      alignSelf.value = value
      this.#configUpdated()
    }
  }

  get placeContent(): ScalarNumberInput | 'mixed' {
    const justifyContent = this.justifyContent
    const alignContent = this.alignContent
    if (justifyContent === alignContent) {
      return justifyContent
    }
    return 'mixed'
  }
  set placeContent(value: ScalarNumberInput) {
    this.justifyContent = value
    this.alignContent = value
  }

  // get placeItems(): ScalarNumberInput | 'mixed' {
  //   const justifyItems = this.justifyItems
  //   const alignItems = this.alignItems
  //   if (justifyItems === alignItems) {
  //     return justifyItems
  //   }
  //   return 'mixed'
  // }
  // set placeItems(value: ScalarNumberInput) {
  //   this.justifyItems = value
  //   this.alignItems = value
  // }

  // get placeSelf(): ScalarNumberInput | 'mixed' {
  //   const justifySelf = this.justifySelf
  //   const alignSelf = this.alignSelf
  //   if (justifySelf === alignSelf) {
  //     return justifySelf
  //   }
  //   return 'mixed'
  // }
  // set placeSelf(value: ScalarNumberInput) {
  //   this.justifySelf = value
  //   this.alignSelf = value
  // }

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

  get gap(): NoneLengthPercentInput | 'mixed' {
    const rowGap = this.rowGap
    const columnGap = this.columnGap
    if (rowGap === columnGap) {
      return rowGap
    }
    return 'mixed'
  }
  set gap(value: NoneLengthPercentInput) {
    this.rowGap = value
    this.columnGap = value
  }

  get justifyContentSpace(): ScalarNumberInput {
    return this.#properties.justifyContentSpace.value
  }
  set justifyContentSpace(value: ScalarNumberInput) {
    const justifyContentSpace = this.#properties.justifyContentSpace
    if (justifyContentSpace.value !== value) {
      justifyContentSpace.value = value
      this.#configUpdated()
    }
  }

  get alignContentSpace(): ScalarNumberInput {
    return this.#properties.alignContentSpace.value
  }
  set alignContentSpace(value: ScalarNumberInput) {
    const alignContentSpace = this.#properties.alignContentSpace
    if (alignContentSpace.value !== value) {
      alignContentSpace.value = value
      this.#configUpdated()
    }
  }

  get placeContentSpace(): ScalarNumberInput | 'mixed' {
    const justifyContentSpace = this.justifyContentSpace
    const alignContentSpace = this.alignContentSpace
    if (justifyContentSpace === alignContentSpace) {
      return justifyContentSpace
    }
    return 'mixed'
  }
  set placeContentSpace(value: ScalarNumberInput) {
    this.justifyContentSpace = value
    this.alignContentSpace = value
  }

  get justifyContentSpaceOuter(): ScalarNumberInput {
    return this.#properties.justifyContentSpaceOuter.value
  }
  set justifyContentSpaceOuter(value: ScalarNumberInput) {
    const justifyContentSpaceOuter = this.#properties.justifyContentSpaceOuter
    if (justifyContentSpaceOuter.value !== value) {
      justifyContentSpaceOuter.value = value
      this.#configUpdated()
    }
  }

  get alignContentSpaceOuter(): ScalarNumberInput {
    return this.#properties.alignContentSpaceOuter.value
  }
  set alignContentSpaceOuter(value: ScalarNumberInput) {
    const alignContentSpaceOuter = this.#properties.alignContentSpaceOuter
    if (alignContentSpaceOuter.value !== value) {
      alignContentSpaceOuter.value = value
      this.#configUpdated()
    }
  }

  get placeContentSpaceOuter(): ScalarNumberInput | 'mixed' {
    const justifyContentSpaceOuter = this.justifyContentSpaceOuter
    const alignContentSpaceOuter = this.alignContentSpaceOuter
    if (justifyContentSpaceOuter === alignContentSpaceOuter) {
      return justifyContentSpaceOuter
    }
    return 'mixed'
  }
  set placeContentSpaceOuter(value: ScalarNumberInput) {
    this.justifyContentSpaceOuter = value
    this.alignContentSpaceOuter = value
  }

  get stretchContent(): AutoScalarNumberInput {
    return this.#properties.stretchContent.value
  }
  set stretchContent(value: AutoScalarNumberInput) {
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

  get stretchSelf(): AutoScalarNumberInput {
    return this.#properties.stretchSelf.value
  }
  set stretchSelf(value: AutoScalarNumberInput) {
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

    frame.#computed.updateRects(this.#innerRect, this.root.#innerRect)

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

    this.#rect.width = typeof width === 'string' ? 0 : width
    this.#rect.height = typeof height === 'string' ? 0 : height

    const incomingState = this.#state
    this.#state = FRAME_STATE.updating

    // if the root needs to update we skip to the calculation step,
    // as all descendants will need to be recalculated
    if (incomingState === FRAME_STATE.needsUpdate) {
      this.#state = FRAME_STATE.updating

      this.#calculate()

      this.#state = FRAME_STATE.idle

      return
    }

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
