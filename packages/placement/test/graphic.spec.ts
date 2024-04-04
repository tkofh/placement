import { describe, test } from 'vitest'
import { Graphic, GraphicFrame } from '../src/graphic'

describe('graphic', () => {
  // test('it works', () => {
  //   const graphic = new Graphic({ width: 100, height: 100 })
  //   const graphicFrame = graphic.appendChild(
  //     new GraphicFrame({ width: 100, height: 100 }),
  //   )

  //   expect(graphic.viewportWidth).toBe(100)
  //   expect(graphic.viewportHeight).toBe(100)

  //   expect(graphicFrame.width).toBe(100)
  //   expect(graphicFrame.computedWidth).toBe(100)
  //   expect(graphicFrame.height).toBe(100)
  //   expect(graphicFrame.computedHeight).toBe(100)
  // })

  test('it resizes', () => {
    const graphic = new Graphic({ width: 100, height: 100 })

    console.log('------------------------------------------')
    console.log('appending child')
    console.log('------------------------------------------')
    const graphicFrame = graphic.appendChild(
      new GraphicFrame({ width: 100, height: 100 }),
    )

    console.log('------------------------------------------')
    console.log('resizing')
    console.log('------------------------------------------')
    graphic.resize(200, 200)

    console.log('------------------------------------------')
    console.log('setting size')
    console.log('------------------------------------------')

    graphicFrame.width = '100%'
    graphicFrame.height = '100%'

    console.log('------------------------------------------')
    console.log('reading')
    console.log('------------------------------------------')
    console.log({
      width: graphicFrame.computedWidth,
      height: graphicFrame.computedHeight,
    })

    // console.log({
    //   width: graphicFrame.parent?.computedWidth,
    //   height: graphicFrame.parent?.computedHeight,
    // })

    // console.log({
    //   width: graphicFrame.computedWidth,
    //   height: graphicFrame.computedHeight,
    // })

    console.log(graphicFrame)
    console.log(graphic)
  })
})
