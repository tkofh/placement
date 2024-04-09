import { Frame, type FrameOptionGetter, type FrameOptions } from './Frame'
import { clamp, lerp } from './utils'

export type FlexDirection = 'row' | 'column' | 'row-reverse' | 'column-reverse'
export type FlexWrap = boolean | 'reverse'

export interface FlexOptions {
  direction?: FlexDirection | FrameOptionGetter<FlexDirection>
  wrap?: FlexWrap | FrameOptionGetter<FlexWrap>
  gap?: number | FrameOptionGetter
  justify?: number | FrameOptionGetter
  align?: number | FrameOptionGetter
  stretch?: number | FrameOptionGetter
  trackAlign?: number | FrameOptionGetter
  trackStretch?: number | FrameOptionGetter
  space?: number | FrameOptionGetter
  spaceOuter?: number | FrameOptionGetter
  trackSpace?: number | FrameOptionGetter
  trackSpaceOuter?: number | FrameOptionGetter
}

const defaultFlexOptions = {
  direction: 'row',
  wrap: false,
  gap: 0,
  justify: 0,
  align: 0,
  stretch: 0,
  trackAlign: 0,
  trackStretch: 0,
  space: 0,
  spaceOuter: 0,
  trackSpace: 0,
  trackSpaceOuter: 0,
} satisfies FlexOptions

class Track {
  private readonly _frames: Array<Frame> = []
  private _next: Track | null = null

  private _mainDimension: 'width' | 'height' = 'width'
  private _crossDimension: 'width' | 'height' = 'height'
  private _gap = 0
  private _maxSize = 0

  private _mainSize = 0
  private _crossSize = 0
  private _totalGrowth = 0
  // _totalShrink = 0

  get frames(): ReadonlyArray<Frame> {
    return this._frames
  }

  get mainSize(): number {
    return this._mainSize
  }
  get crossSize(): number {
    return this._crossSize
  }
  get freeSpace(): number {
    return Math.max(0, this._maxSize - this._mainSize)
  }
  get growthFactor(): number {
    if (this._totalGrowth === 0) {
      return 0
    }
    return this.freeSpace / this._totalGrowth
  }

  get trackSize(): number {
    if (this._next === null) {
      return this.crossSize
    }
    return this.crossSize + this._gap + this._next.trackSize
  }

  get _start(): number {
    return this._frames[0].index
  }
  get _end(): number {
    return this._frames[this._frames.length - 1].index
  }

  insert(frame: Frame) {
    if (this._frames.length === 0 || this._next === null) {
      this._frames.push(frame)
      return
    }

    if (frame.index > this._end) {
      this._next.insert(frame)
      return
    }

    if (frame.index >= this._start) {
      this._frames.splice(frame.index - this._start, 0, frame)
      return
    }

    throw new Error('frame index is out of bounds')
  }

  remove(frame: Frame) {
    if (frame.index >= this._start && frame.index <= this._end) {
      this._frames.splice(frame.index - this._start, 1)
      return
    }

    if (this._next !== null) {
      this._next.remove(frame)
      return
    }

    throw new Error('frame not found')
  }

  *reflow(
    direction: FlexDirection,
    wrap: FlexWrap,
    gap: number,
    size: number,
  ): IterableIterator<Track> {
    this._mainDimension = direction.startsWith('row') ? 'width' : 'height'
    this._crossDimension = direction.startsWith('row') ? 'height' : 'width'
    this._gap = gap
    this._maxSize = size

    this._mainSize = 0
    this._crossSize = 0
    this._totalGrowth = 0

    if (wrap) {
      this._reflowWrap()
    } else {
      this._reflowNoWrap()
    }

    yield this
    if (this._next !== null) {
      yield* this._next.reflow(direction, wrap, gap, size)
    }
  }

  computeMainOffsets(justify: number, space: number, spaceOuter: number) {
    let start = (this._maxSize - this._mainSize) * justify
    let between = this._gap

    if (this.freeSpace > 0 && this._frames.length > 1) {
      const spacing = (this.freeSpace / (this._frames.length + 1)) * space
      start += spacing * spaceOuter
      between +=
        spacing +
        (spacing * 2 * (1 - spaceOuter)) / Math.max(this._frames.length - 1, 1)
    }

    return { start, between }
  }

  private _reflowWrap() {
    for (const [index, frame] of this._frames.entries()) {
      const frameSize = frame[this._mainDimension]

      if (this._mainSize + frameSize > this._maxSize) {
        if (this._next === null) {
          this._next = new Track()
        }

        this._next._frames.unshift(...this._frames.slice(index))
        this._frames.length = index
        break
      }

      this._mainSize += frameSize + this._gap
      this._crossSize = Math.max(this._crossSize, frame[this._crossDimension])
      this._totalGrowth += frame.grow
    }

    while (this._next !== null && this.freeSpace > 0) {
      const nextFrame = this._next._frames[0]
      const nextSize = nextFrame[this._mainDimension]
      if (nextSize > this.freeSpace) {
        break
      }
      this._mainSize += nextSize + this._gap
      this._crossSize = Math.max(
        this._crossSize,
        nextFrame[this._crossDimension],
      )
      this._totalGrowth += nextFrame.grow

      this._frames.push(nextFrame)
      this._next._frames.shift()
      if (this._next._frames.length === 0) {
        this._next = this._next._next
      }
    }

    this._mainSize -= this._gap
  }

  private _reflowNoWrap() {
    let track: Track | null = this

    while (track !== null) {
      for (const frame of this._frames) {
        this._mainSize += frame[this._mainDimension] + this._gap
        this._crossSize = Math.max(this._crossSize, frame[this._crossDimension])
        this._totalGrowth += frame.grow

        if (track !== this) {
          this._frames.push(frame)
        }
      }
      track = track._next
      this._next = track
    }

    this._mainSize -= this._gap
  }
}

export class FlexFrame extends Frame {
  private _direction!: FlexDirection | FrameOptionGetter<FlexDirection>
  private _wrap!: FlexWrap | FrameOptionGetter<FlexWrap>
  private _gap!: number | FrameOptionGetter
  private _justify!: number | FrameOptionGetter
  private _align!: number | FrameOptionGetter
  private _stretch!: number | FrameOptionGetter
  private _trackAlign!: number | FrameOptionGetter
  private _trackStretch!: number | FrameOptionGetter
  private _space!: number | FrameOptionGetter
  private _spaceOuter!: number | FrameOptionGetter
  private _trackSpace!: number | FrameOptionGetter
  private _trackSpaceOuter!: number | FrameOptionGetter

  private readonly _tracks = new Track()

  private _mainDimension!: 'width' | 'height'
  private _crossDimension!: 'width' | 'height'
  private _mainStart!: 'x' | 'y'
  private _crossStart!: 'x' | 'y'

  constructor(frame?: FrameOptions, flex?: FlexOptions) {
    super(frame)

    this.configure(frame, flex)
  }

  //region Properties
  get direction(): FlexDirection {
    return this._direction instanceof Function
      ? this._direction(this.parentRect, this.rootRect)
      : this._direction
  }

  set direction(value: FlexDirection | FrameOptionGetter<FlexDirection>) {
    this._direction = value

    if (this.direction.startsWith('row')) {
      this._mainDimension = 'width'
      this._crossDimension = 'height'
      this._mainStart = 'x'
      this._crossStart = 'y'
    } else {
      this._mainDimension = 'height'
      this._crossDimension = 'width'
      this._mainStart = 'y'
      this._crossStart = 'x'
    }

    this.configUpdated()
  }

  get wrap(): FlexWrap {
    return this._wrap instanceof Function
      ? this._wrap(this.parentRect, this.rootRect)
      : this._wrap
  }

  set wrap(value: FlexWrap | FrameOptionGetter<FlexWrap>) {
    this._wrap = value
    this.configUpdated()
  }

  get gap(): number {
    return this._gap instanceof Function
      ? this._gap(this.parentRect, this.rootRect)
      : this._gap
  }

  set gap(value: number | FrameOptionGetter) {
    this._gap = value
    this.configUpdated()
  }

  get justify(): number {
    return clamp(
      this._justify instanceof Function
        ? this._justify(this.parentRect, this.rootRect)
        : this._justify,
      0,
      1,
    )
  }

  set justify(value: number | FrameOptionGetter) {
    this._justify = value
    this.configUpdated()
  }

  get align(): number {
    return clamp(
      this._align instanceof Function
        ? this._align(this.parentRect, this.rootRect)
        : this._align,
      0,
      1,
    )
  }

  set align(value: number | FrameOptionGetter) {
    this._align = value
    this.configUpdated()
  }

  get stretch(): number {
    return clamp(
      this._stretch instanceof Function
        ? this._stretch(this.parentRect, this.rootRect)
        : this._stretch,
      0,
      1,
    )
  }

  set stretch(value: number | FrameOptionGetter) {
    this._stretch = value
    this.configUpdated()
  }

  get trackAlign(): number {
    return clamp(
      this._trackAlign instanceof Function
        ? this._trackAlign(this.parentRect, this.rootRect)
        : this._trackAlign,
      0,
      1,
    )
  }

  set trackAlign(value: number | FrameOptionGetter) {
    this._trackAlign = value
    this.configUpdated()
  }

  get trackStretch(): number {
    return clamp(
      this._trackStretch instanceof Function
        ? this._trackStretch(this.parentRect, this.rootRect)
        : this._trackStretch,
      0,
      1,
    )
  }

  set trackStretch(value: number | FrameOptionGetter) {
    this._trackStretch = value
    this.configUpdated()
  }

  get space(): number {
    return clamp(
      this._space instanceof Function
        ? this._space(this.parentRect, this.rootRect)
        : this._space,
      0,
      1,
    )
  }

  set space(value: number | FrameOptionGetter) {
    this._space = value
    this.configUpdated()
  }

  get spaceOuter(): number {
    return clamp(
      this._spaceOuter instanceof Function
        ? this._spaceOuter(this.parentRect, this.rootRect)
        : this._spaceOuter,
      0,
      1,
    )
  }

  set spaceOuter(value: number | FrameOptionGetter) {
    this._spaceOuter = value
    this.configUpdated()
  }

  get trackSpace(): number {
    return clamp(
      this._trackSpace instanceof Function
        ? this._trackSpace(this.parentRect, this.rootRect)
        : this._trackSpace,
      0,
      1,
    )
  }

  set trackSpace(value: number | FrameOptionGetter) {
    this._trackSpace = value
    this.configUpdated()
  }

  get trackSpaceOuter(): number {
    return clamp(
      this._trackSpaceOuter instanceof Function
        ? this._trackSpaceOuter(this.parentRect, this.rootRect)
        : this._trackSpaceOuter,
      0,
      1,
    )
  }

  set trackSpaceOuter(value: number | FrameOptionGetter) {
    this._trackSpaceOuter = value
    this.configUpdated()
  }
  //endregion

  override appendChild(frame: Frame): Frame {
    super.appendChild(frame)
    this._tracks.insert(frame)

    return frame
  }

  override insertBefore(frame: Frame, before: Frame): Frame {
    super.insertBefore(frame, before)
    this._tracks.insert(frame)

    return frame
  }

  override insertAt(frame: Frame, index: number): Frame {
    super.insertAt(frame, index)
    this._tracks.insert(frame)

    return frame
  }

  override removeChild(frame: Frame): Frame {
    super.removeChild(frame)
    this._tracks.remove(frame)

    return frame
  }

  override configure(frame?: FrameOptions, flex?: FlexOptions) {
    super.configure(frame)

    this.direction = flex?.direction ?? defaultFlexOptions.direction
    this.wrap = flex?.wrap ?? defaultFlexOptions.wrap
    this.gap = flex?.gap ?? defaultFlexOptions.gap
    this.justify = flex?.justify ?? defaultFlexOptions.justify
    this.align = flex?.align ?? defaultFlexOptions.align
    this.stretch = flex?.stretch ?? defaultFlexOptions.stretch
    this.trackAlign = flex?.trackAlign ?? defaultFlexOptions.trackAlign
    this.trackStretch = flex?.trackStretch ?? defaultFlexOptions.trackStretch
    this.space = flex?.space ?? defaultFlexOptions.space
    this.spaceOuter = flex?.spaceOuter ?? defaultFlexOptions.spaceOuter
    this.trackSpace = flex?.trackSpace ?? defaultFlexOptions.trackSpace
    this.trackSpaceOuter =
      flex?.trackSpaceOuter ?? defaultFlexOptions.trackSpaceOuter
  }

  protected override layout() {
    const direction = this.direction
    const wrap = this.wrap
    const gap = this.gap
    const trackAlign = this.trackAlign
    const trackSpace = this.trackSpace
    const trackSpaceOuter = this.trackSpaceOuter

    const tracks = Array.from(
      this._tracks.reflow(direction, wrap, gap, this.rect[this._mainDimension]),
    )

    const trackSize = this._tracks.trackSize

    let start = (this.rect[this._crossDimension] - trackSize) * trackAlign
    let between = gap

    const trackFreeSpace = Math.max(
      this.rect[this._crossDimension] - trackSize,
      0,
    )

    if (trackFreeSpace > 0 && tracks.length > 1) {
      const spacing = (trackFreeSpace / (tracks.length + 1)) * trackSpace
      start += spacing * trackSpaceOuter
      between +=
        spacing +
        (spacing * 2 * (1 - trackSpaceOuter)) / Math.max(tracks.length - 1, 1)
    }

    if (wrap === 'reverse') {
      let crossPosition = this.rect[this._crossStart] + start + trackSize
      for (const track of tracks) {
        crossPosition -= track.crossSize
        this._layoutTrack(track, crossPosition)
        crossPosition -= between
      }
    } else {
      let crossPosition = this.rect[this._crossStart] + start
      for (const track of tracks) {
        this._layoutTrack(track, crossPosition)
        crossPosition += track.crossSize + between
      }
    }
  }

  private _layoutTrack(track: Track, crossStart: number) {
    const offsets = track.computeMainOffsets(
      this.justify,
      this.space,
      this.spaceOuter,
    )

    const align = this.align
    const stretch = this.stretch

    if (this.direction.endsWith('reverse')) {
      let mainPosition =
        this.rect[this._mainStart] +
        this.rect[this._mainDimension] -
        offsets.start

      for (const frame of track.frames) {
        const rect = this.getRect(frame)

        rect[this._mainDimension] =
          frame[this._mainDimension] + track.growthFactor * frame.grow

        rect[this._mainStart] = mainPosition - rect[this._mainDimension]

        const crossSize = lerp(
          stretch,
          frame[this._crossDimension],
          track.crossSize,
        )
        rect[this._crossDimension] = crossSize
        rect[this._crossStart] =
          crossStart + (track.crossSize - crossSize) * align

        mainPosition -= rect[this._mainDimension] + offsets.between
      }
    } else {
      let mainPosition = this.rect[this._mainStart] + offsets.start

      for (const frame of track.frames) {
        const rect = this.getRect(frame)

        rect[this._mainDimension] =
          frame[this._mainDimension] + track.growthFactor * frame.grow

        rect[this._mainStart] = mainPosition

        const crossSize = lerp(
          stretch,
          frame[this._crossDimension],
          track.crossSize,
        )
        rect[this._crossDimension] = crossSize
        rect[this._crossStart] =
          crossStart + (track.crossSize - crossSize) * align

        mainPosition += rect[this._mainDimension] + offsets.between
      }
    }
  }
}
