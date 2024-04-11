import {
  type FlexDirection,
  FlexLayout,
  type FlexOptions,
  type FlexWrap,
} from './FlexLayout'
import { Frame } from './Frame'
import type { FrameOptions } from './FrameConfig'

export class FlexFrame extends Frame {
  #flex: FlexLayout

  constructor(frame?: Partial<FrameOptions>, flex?: Partial<FlexOptions>) {
    super(frame)

    this.#flex = new FlexLayout(this)
    this.#flex.configure(flex ?? {})
  }

  get direction(): string {
    return this.#flex.direction
  }
  set direction(value: FlexDirection) {
    this.#flex.direction = value
  }

  get wrap(): FlexWrap {
    return this.#flex.wrap
  }
  set wrap(value: FlexWrap) {
    this.#flex.wrap = value
  }

  get gap(): number {
    return this.#flex.gap
  }
  set gap(value: number) {
    this.#flex.gap = value
  }

  get justify(): number {
    return this.#flex.justify
  }
  set justify(value: number) {
    this.#flex.justify = value
  }

  get align(): number {
    return this.#flex.align
  }
  set align(value: number) {
    this.#flex.align = value
  }

  get stretch(): number {
    return this.#flex.stretch
  }
  set stretch(value: number) {
    this.#flex.stretch = value
  }

  get linesAlign(): number {
    return this.#flex.linesAlign
  }
  set linesAlign(value: number) {
    this.#flex.linesAlign = value
  }

  get linesStretch(): number {
    return this.#flex.linesStretch
  }
  set linesStretch(value: number) {
    this.#flex.linesStretch = value
  }

  get space(): number {
    return this.#flex.space
  }
  set space(value: number) {
    this.#flex.space = value
  }

  get spaceOuter(): number {
    return this.#flex.spaceOuter
  }
  set spaceOuter(value: number) {
    this.#flex.spaceOuter = value
  }

  get linesSpace(): number {
    return this.#flex.linesSpace
  }
  set linesSpace(value: number) {
    this.#flex.linesSpace = value
  }

  get linesSpaceOuter(): number {
    return this.#flex.linesSpaceOuter
  }
  set linesSpaceOuter(value: number) {
    this.#flex.linesSpaceOuter = value
  }

  //region Public Methods
  override appendChild(frame: Frame): Frame {
    super.appendChild(frame)
    this.#flex.insert(frame)

    return frame
  }

  override insertBefore(frame: Frame, before: Frame): Frame {
    super.insertBefore(frame, before)
    this.#flex.insert(frame)

    return frame
  }

  override insertAt(frame: Frame, index: number): Frame {
    super.insertAt(frame, index)
    this.#flex.insert(frame)

    return frame
  }

  override removeChild(frame: Frame): Frame {
    super.removeChild(frame)
    this.#flex.remove(frame)

    return frame
  }

  protected override layout() {
    for (const item of this.#flex.placeItems()) {
      const box = this.getChildBox(item.frame)

      box.outerX = this.box.innerX + item.outerX
      box.outerY = this.box.innerY + item.outerY
      box.outerWidth = item.outerWidth
      box.outerHeight = item.outerHeight
    }
  }
}
