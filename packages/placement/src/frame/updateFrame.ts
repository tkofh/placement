import type { Frame } from './Frame'
import type { FrameOptions } from './FrameProperties'

export function updateFrame(frame: Frame, options: FrameOptions) {
  frame.width = options.width
  frame.height = options.height
  frame.aspectRatio = options.aspectRatio

  frame.minWidth = options.minWidth
  frame.minHeight = options.minHeight
  frame.maxWidth = options.maxWidth
  frame.maxHeight = options.maxHeight

  frame.offset = options.offset
  frame.offsetX = options.offsetX
  frame.offsetY = options.offsetY
  frame.offsetTop = options.offsetTop
  frame.offsetRight = options.offsetRight
  frame.offsetBottom = options.offsetBottom
  frame.offsetLeft = options.offsetLeft

  frame.inset = options.inset
  frame.insetX = options.insetX
  frame.insetY = options.insetY
  frame.insetTop = options.insetTop
  frame.insetRight = options.insetRight
  frame.insetBottom = options.insetBottom
  frame.insetLeft = options.insetLeft

  frame.translate = options.translate
  frame.translateX = options.translateX
  frame.translateY = options.translateY

  frame.grow = options.grow
  frame.shrink = options.shrink

  frame.flexDirection = options.flexDirection
  frame.flexWrap = options.flexWrap

  frame.gap = options.gap
  frame.rowGap = options.rowGap
  frame.columnGap = options.columnGap

  frame.placeContent = options.placeContent
  frame.placeContentSpace = options.placeContentSpace
  frame.placeContentSpaceOuter = options.placeContentSpaceOuter

  frame.justifyContent = options.justifyContent
  frame.justifyContentSpace = options.justifyContentSpace
  frame.justifyContentSpaceOuter = options.justifyContentSpaceOuter

  frame.alignContent = options.alignContent
  frame.alignContentSpace = options.alignContentSpace
  frame.alignContentSpaceOuter = options.alignContentSpaceOuter

  frame.alignItems = options.alignItems
  frame.alignSelf = options.alignSelf

  frame.stretchContent = options.stretchContent
  frame.stretchItems = options.stretchItems
  frame.stretchSelf = options.stretchSelf
}
