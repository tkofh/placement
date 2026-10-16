import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Frame from '../src/frame.ts'

const frame = Frame.make({ width: 9, height: 8 })
const base = Adornment.make({ frame })

describe('adornment', () => {
  test('make applies the defaults', () => {
    expect(base.toJSON()).toEqual({
      frame,
      at: 0.5,
      position: Adornment.position.flow,
      layer: 0,
      orient: Adornment.orient.upright,
    })
  })

  test('encodings', () => {
    expect(Adornment.position).toEqual({ flow: 0, absolute: 1 })
    expect(Adornment.orient).toEqual({ upright: 0, forward: 1, backward: 2 })
  })

  test('isAdornment accepts adornments and rejects everything else', () => {
    expect(Adornment.isAdornment(base)).toBe(true)
    expect(Adornment.isAdornment({ frame, at: 0.5 })).toBe(false)
    expect(Adornment.isAdornment(frame)).toBe(false)
    expect(Adornment.isAdornment(null)).toBe(false)
  })

  test('a JSON round trip of the fields rebuilds the adornment', () => {
    const arrow = Adornment.make({ frame, at: 1, layer: 2, orient: Adornment.orient.forward })
    expect(Adornment.make(arrow.toJSON()).toJSON()).toEqual(arrow.toJSON())
  })

  const other = Frame.make({ width: 30, height: 12 })

  test.each([
    [
      'setFrame',
      Adornment.setFrame(base, other),
      base.pipe(Adornment.setFrame(other)),
      'frame',
      other,
    ],
    ['setAt', Adornment.setAt(base, 1), base.pipe(Adornment.setAt(1)), 'at', 1],
    [
      'setPosition',
      Adornment.setPosition(base, Adornment.position.absolute),
      base.pipe(Adornment.setPosition(Adornment.position.absolute)),
      'position',
      1,
    ],
    ['setLayer', Adornment.setLayer(base, 3), base.pipe(Adornment.setLayer(3)), 'layer', 3],
    [
      'setOrient',
      Adornment.setOrient(base, Adornment.orient.backward),
      base.pipe(Adornment.setOrient(Adornment.orient.backward)),
      'orient',
      2,
    ],
  ] as const)('%s works in both forms', (_, dataFirst, dataLast, field, value) => {
    expect(dataFirst[field]).toBe(value)
    expect(dataLast[field]).toBe(value)
    expect(base[field]).not.toBe(value)
  })

  test('setters keep the other fields', () => {
    const arrow = Adornment.make({ frame, at: 1, orient: Adornment.orient.forward, layer: 1 })
    expect(Adornment.setAt(arrow, 0).toJSON()).toEqual({ ...arrow.toJSON(), at: 0 })
  })
})
