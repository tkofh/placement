import { describe, expect, test } from 'vitest'
import { GraphicFrame } from '../src/graphic'

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
    // const graphic = new Graphic({ width: 100, height: 100 })

    // const graphicFrame = graphic.appendChild(
    //   new GraphicFrame({ width: 100, height: 100 }),
    // )

    const outer = new GraphicFrame({ width: 200, height: 200 })
    const inner = outer.appendChild(
      new GraphicFrame({ width: 100, height: 100 }),
    )

    inner.width = '100%'
    inner.height = '100%'

    expect(inner.computed.width).toBe(200)
    expect(inner.computed.height).toBe(200)

    // console.log({
    //   width: graphicFrame.parent?.computedWidth,
    //   height: graphicFrame.parent?.computedHeight,
    // })

    // console.log({
    //   width: graphicFrame.computedWidth,
    //   height: graphicFrame.computedHeight,
    // })
  })
})
