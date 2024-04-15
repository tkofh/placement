import type { Frame } from '../frame/Frame'
import type { FrameConfig } from '../placement/FrameConfig'
import type { Rect } from '../rect/Rect'

export interface Layout {
  readonly innerWidth: number
  readonly innerHeight: number

  insert(config: FrameConfig, box: Rect, index: number): void
  remove(config: FrameConfig): void

  calculate(): void
}

export interface LayoutDefinition {
  registerFrame(frame: Frame): Layout
}
