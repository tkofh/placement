import type { FrameConfig } from '../GraphicFrame'
import type { GraphicRect } from '../GraphicRect'

export abstract class Layout {
  base: GraphicRect
  configs: Array<FrameConfig> = []
  rects: Array<GraphicRect> = []

  constructor(base: GraphicRect) {
    this.base = base
  }

  abstract layout(): void
}
