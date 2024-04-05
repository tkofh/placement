import { Node } from 'gpds/trees/general'
import type { GraphicFrame } from './GraphicFrame'

export class GraphicNode extends Node {
  #frame: GraphicFrame

  constructor(frame: GraphicFrame) {
    super()
    this.#frame = frame
  }

  get frame() {
    return this.#frame
  }

  findLastAncestor(
    predicate: (ancestor: GraphicNode) => boolean,
  ): GraphicNode | null {
    if (!predicate(this)) {
      return null
    }

    let ancestor: GraphicNode = this
    while (ancestor) {
      if (!predicate(ancestor)) {
        return ancestor
      }
      if (!ancestor.parent) {
        break
      }
      ancestor = ancestor.parent
    }
    return ancestor
  }
}
