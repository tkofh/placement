import { Node } from 'gpds/trees/general'
import type { Frame } from './Frame'

export class FrameNode extends Node {
  readonly frame: Frame

  constructor(frame: Frame) {
    super()
    this.frame = frame
  }

  findLastAncestor(
    predicate: (ancestor: FrameNode) => boolean,
  ): FrameNode | null {
    if (!predicate(this)) {
      return null
    }

    let ancestor: FrameNode = this
    for (const node of this.ancestors()) {
      if (!predicate(node)) {
        break
      }
      ancestor = node
    }
    return ancestor
  }
}
