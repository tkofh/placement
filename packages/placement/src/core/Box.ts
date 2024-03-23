import { AspectRatio } from './properties/AspectRatio'
import { Margin } from './properties/Margin'
import { Padding } from './properties/Padding'
import { Size } from './properties/Size'
import { SizeConstraint } from './properties/SizeConstraint'

export class Box {
  #width: Size
  #height: Size

  #aspectRatio: AspectRatio

  #minWidth: SizeConstraint
  #maxWidth: SizeConstraint

  #minHeight: SizeConstraint
  #maxHeight: SizeConstraint

  #padding: Padding
  #margin: Margin

  constructor() {
    this.#width = new Size('auto')
    this.#height = new Size('auto')

    this.#aspectRatio = new AspectRatio('inherit')

    this.#minWidth = new SizeConstraint('none')
    this.#maxWidth = new SizeConstraint('none')

    this.#minHeight = new SizeConstraint('none')
    this.#maxHeight = new SizeConstraint('none')

    this.#padding = new Padding()
    this.#margin = new Margin()
  }
}
