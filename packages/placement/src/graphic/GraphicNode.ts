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
}
