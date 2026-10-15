import * as Dimensions from 'placement/dimensions'
import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { type ComputedRef, defineComponent, h, nextTick, ref } from 'vue'
import { type GapInput, type GapValue, useGap } from '../../src/props/gap.ts'
import { mountWithRect } from '../host.ts'

const parent = Dimensions.make(200, 100)

describe('explicit parent', () => {
  test('a number applies to both gaps', () => {
    expect(useGap(() => 8, 0, parent).value).toEqual({ rowGap: 8, columnGap: 8 })
  })

  test('undefined resolves to the fallback', () => {
    expect(useGap(() => undefined, 4, parent).value).toEqual({ rowGap: 4, columnGap: 4 })
    expect(useGap(() => undefined, { rowGap: 2, columnGap: 6 }, parent).value).toEqual({
      rowGap: 2,
      columnGap: 6,
    })
  })

  test('percentages resolve the row against the height and the column against the width', () => {
    expect(useGap(() => '10% 25%', 0, parent).value).toEqual({ rowGap: 10, columnGap: 50 })
  })

  test('a single percentage copies the resolved row gap to the column', () => {
    // The column copies the row's resolved 50 (of height 100). It is not
    // re-resolved against the width.
    expect(useGap(() => '50%', 0, parent).value).toEqual({ rowGap: 50, columnGap: 50 })
  })

  test('equal recomputes keep the cached instance', () => {
    const input = ref<GapInput>(8)
    const gap = useGap(input, 0, parent)

    const first = gap.value
    expect(first).toEqual({ rowGap: 8, columnGap: 8 })

    input.value = '8'
    expect(gap.value).toBe(first)

    input.value = 12
    expect(gap.value).not.toBe(first)
    expect(gap.value).toEqual({ rowGap: 12, columnGap: 12 })
  })
})

describe('inherited parent', () => {
  test('resolves against the sizing context rect and tracks it', async () => {
    const rect = ref(Rect.make(0, 0, 200, 100))
    let gap!: ComputedRef<GapValue>
    const Probe = defineComponent({
      setup() {
        gap = useGap(() => '50% 50%')
        return () => null
      },
    })
    mountWithRect(rect, () => [h(Probe)])

    expect(gap.value).toEqual({ rowGap: 50, columnGap: 100 })

    rect.value = Rect.make(0, 0, 400, 600)
    await nextTick()

    expect(gap.value).toEqual({ rowGap: 300, columnGap: 200 })
  })
})
