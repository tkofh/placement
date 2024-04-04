import { type FrameOptions, GraphicFrame } from './GraphicFrame'

class GraphicRoot extends GraphicFrame {
  #graphic: Graphic
  constructor(graphic: Graphic, options: FrameOptions) {
    super(options)
    this.#graphic = graphic
    this.resize()
  }

  resize() {
    console.log('resizing graphic root')
    this.computedWidth = this.#graphic.viewportWidth
    this.computedHeight = this.#graphic.viewportHeight

    super.update()
  }
}

interface GraphicOptions {
  width: number
  height: number
  // fit?: 'fill' | 'contain' | 'cover'
}
// maybe graphic is a viewport?
// or all frames have viewports, and the root frame has configurable width/height
// or viewport is a layout?
export class Graphic {
  #root: GraphicRoot
  #viewportWidth: number
  #viewportHeight: number
  // #fit: 'fill' | 'contain' | 'cover'

  constructor(options: GraphicOptions, rootOptions: FrameOptions = {}) {
    this.#viewportWidth = options.width
    this.#viewportHeight = options.height
    // this.#fit = options.fit ?? 'fill'

    this.#root = new GraphicRoot(this, {
      width: '100%',
      height: '100%',
      ...rootOptions,
    })
  }

  get root() {
    return this.#root
  }

  get viewportWidth() {
    return this.#viewportWidth
  }
  get viewportHeight() {
    return this.#viewportHeight
  }

  // get fit() {
  //   return this.#fit
  // }
  // set fit(value: 'fill' | 'contain' | 'cover') {
  //   this.#fit = value
  //   this.#root.resize()
  // }

  resize(width: number, height: number) {
    console.log('resizing graphic')
    this.#viewportWidth = width
    this.#viewportHeight = height
    this.#root.resize()
  }

  appendChild(frame: GraphicFrame) {
    return this.#root.appendChild(frame)
  }
  insertBefore(frame: GraphicFrame, before: GraphicFrame) {
    return this.#root.insertBefore(frame, before)
  }
  removeChild(frame: GraphicFrame) {
    return this.#root.removeChild(frame)
  }
}
