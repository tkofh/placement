import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { type ComputedRef, defineComponent, h, nextTick, ref } from 'vue'
import { useLengthPercentage } from '../../src/props/lengthPercentage.ts'
import { mountWithRect } from '../host.ts'

describe('numeric percent basis', () => {
  test('numbers pass through', () => {
    expect(useLengthPercentage(() => 10, 0, 100).value).toBe(10)
  })

  test('undefined resolves to the reactive fallback', () => {
    const fallback = ref(7)
    const resolved = useLengthPercentage(() => undefined, fallback, 100)

    expect(resolved.value).toBe(7)

    fallback.value = 9
    expect(resolved.value).toBe(9)
  })

  test('percentages resolve against the reactive basis', () => {
    const basis = ref(200)
    const resolved = useLengthPercentage(() => '50%', 0, basis)

    expect(resolved.value).toBe(100)

    basis.value = 300
    expect(resolved.value).toBe(150)
  })

  test('px lengths are absolute', () => {
    expect(useLengthPercentage(() => '10px', 0, 100).value).toBe(10)
  })
})

describe('inherited percent basis', () => {
  test('width and height bases resolve against the parent rect and track it', async () => {
    const rect = ref(Rect.make(0, 0, 200, 100))
    const resolved: Array<ComputedRef<number>> = []
    const Probe = defineComponent({
      setup() {
        resolved.push(
          useLengthPercentage(() => '50%', 0, 'width'),
          useLengthPercentage(() => '50%', 0, 'height'),
          // The default basis inherits the width.
          useLengthPercentage(() => '50%'),
        )
        return () => null
      },
    })
    mountWithRect(rect, () => [h(Probe)])

    expect(resolved.map((value) => value.value)).toEqual([100, 50, 100])

    rect.value = Rect.make(0, 0, 400, 600)
    await nextTick()

    expect(resolved.map((value) => value.value)).toEqual([200, 300, 200])
  })
})
