import { expect, test } from 'vitest'
import { Graphic, GraphicNode } from '../src/gom2'

test('works', () => {
  expect(true).toBe(true)

  const graphic = new Graphic({ viewport: { width: 1600, height: 900 } })
  const test = graphic.appendChild(new GraphicNode({}))

  console.log(graphic, test)
})

// const graphic = new Graphic({
//   width: 1600,
//   height: 900,
// })

// graphic.appendChild(new GraphicManualLayout({ layer: true })).appendChild(
//   new GraphicCircle({
//     // this needs to be deffered until the node has a parent
//     top: '50%',
//     left: '50%',
//     origin: '50%',
//     radius: 100,
//   }),
// )

// const flex = graphic
//   .appendChild(
//     new GraphicPolarProjection({
//       layer: true,
//       origin: '50%',
//       theta: '0deg',
//     }),
//   )
//   .appendChild(
//     new GraphicFlexLayout({
//       direction: 'column',
//     }),
//   )

// for (const size of [20, 2, 6, 30]) {
//   flex.appendChild(
//     new GraphicRect({
//       height: '100%',
//       width: 0,
//       grow: size,
//     }),
//   )
// }
