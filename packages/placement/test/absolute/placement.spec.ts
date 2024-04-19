import { expect, test } from 'vitest'
import { createFrame } from '../../src/frame/createFrame'

test('absolute items can be placed on top of each other', () => {
  const parent = createFrame({
    layout: 'absolute',
    width: '100px',
    height: '100px',
  })

  const child1 = parent.appendChild(
    createFrame({
      layout: 'absolute',
      offsetTop: '10px',
      offsetLeft: '10px',
      width: '10px',
      height: '10px',
    }),
  )

  const child2 = parent.appendChild(
    createFrame({
      layout: 'absolute',
      offsetTop: '10px',
      offsetLeft: '10px',
      width: '10px',
      height: '10px',
    }),
  )

  expect(child1.rect.x).toBe(10)
  expect(child1.rect.y).toBe(10)

  expect(child2.rect.x).toBe(10)
  expect(child2.rect.y).toBe(10)
})
