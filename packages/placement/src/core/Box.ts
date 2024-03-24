import { ReadonlyRect, type Rect } from './Rect'
import { AspectRatio, type AspectRatioValue } from './properties/AspectRatio'
import { Dimensions, ReadonlyDimensions } from './properties/Dimensions'
import { Size, type SizeValue } from './properties/Size'
import {
  SizeConstraint,
  type SizeConstraintValue,
} from './properties/SizeConstraint'

export class Box {
  #parent: Box
  #children: Array<Box> = []

  #width: Size
  #height: Size

  #aspectRatio: AspectRatio

  #minWidth: SizeConstraint
  #maxWidth: SizeConstraint

  #minHeight: SizeConstraint
  #maxHeight: SizeConstraint

  #dimensions: Dimensions
  #readonlyDimensions: ReadonlyDimensions

  #rect: Rect
  #readonlyRect: ReadonlyRect

  constructor(parent: Box, rect: Rect) {
    this.#parent = parent
    this.#rect = rect
    this.#readonlyRect = new ReadonlyRect(this.#rect)

    this.#width = new Size(this, 'width')
    this.#height = new Size(this, 'height')

    this.#aspectRatio = new AspectRatio(this, this.#width, this.#height)

    this.#minWidth = new SizeConstraint(this, 'minWidth')
    this.#maxWidth = new SizeConstraint(this, 'maxWidth')

    this.#minHeight = new SizeConstraint(this, 'minHeight')
    this.#maxHeight = new SizeConstraint(this, 'maxHeight')

    this.#dimensions = new Dimensions({
      width: this.#width,
      height: this.#height,
      aspectRatio: this.#aspectRatio,
      minWidth: this.#minWidth,
      maxWidth: this.#maxWidth,
      minHeight: this.#minHeight,
      maxHeight: this.#maxHeight,
    })
    this.#readonlyDimensions = new ReadonlyDimensions(this.#dimensions)
  }

  get parent() {
    return this.#parent
  }

  get rect() {
    return this.#readonlyRect
  }

  get width() {
    return this.#width.value
  }

  set width(value: SizeValue) {
    this.#width.value = value
  }

  get height() {
    return this.#height.value
  }

  set height(value: SizeValue) {
    this.#height.value = value
  }

  get aspectRatio() {
    return this.#aspectRatio.value
  }

  set aspectRatio(value: AspectRatioValue) {
    this.#aspectRatio.value = value
  }

  get minWidth() {
    return this.#minWidth.value
  }

  set minWidth(value: SizeConstraintValue) {
    this.#minWidth.value = value
  }

  get maxWidth() {
    return this.#maxWidth.value
  }

  set maxWidth(value: SizeConstraintValue) {
    this.#maxWidth.value = value
  }

  get minHeight() {
    return this.#minHeight.value
  }

  set minHeight(value: SizeConstraintValue) {
    this.#minHeight.value = value
  }

  get maxHeight() {
    return this.#maxHeight.value
  }

  set maxHeight(value: SizeConstraintValue) {
    this.#maxHeight.value = value
  }

  get dimensions() {
    return this.#readonlyDimensions
  }
}
