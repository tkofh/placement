import { Node } from 'gpds/trees/general'
import type { Frame } from './Frame'

export class FrameNode extends Node {
  readonly frame: Frame

  constructor(frame: Frame) {
    super()
    this.frame = frame
  }
}
