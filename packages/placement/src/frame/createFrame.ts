import { Frame } from './Frame'
import type { FrameOptions } from './FrameProperties'
import { updateFrame } from './updateFrame'

export interface CreateFrameOptions extends FrameOptions {
  layout: 'flex' | 'absolute'
}

export function createFrame(options: CreateFrameOptions) {
  const { layout, ...frameOptions } = options
  const frame = new Frame(layout)

  updateFrame(frame, frameOptions)

  return frame
}
