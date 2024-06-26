import type { ComputedFrameProperties } from '../frame/ComputedFrameProperties'
import type { Rect } from '../rect/Rect'

export interface Layout {
  insert(props: ComputedFrameProperties, box: Rect, index: number): void
  remove(props: ComputedFrameProperties): void

  calculate(): void
}
