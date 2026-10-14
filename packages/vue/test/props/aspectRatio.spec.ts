import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { resolveAspectRatio } from '../../src/internal/props/aspectRatio.ts'
import { type AspectRatioInput, useAspectRatio } from '../../src/props/aspectRatio.ts'

describe('useAspectRatio', () => {
  test('the wrapper defaults the fallback to 1, overriding the resolver default of Infinity', () => {
    expect(resolveAspectRatio(undefined)).toBe(Number.POSITIVE_INFINITY)
    expect(useAspectRatio(() => undefined).value).toBe(1)
  })

  test('reactive input', () => {
    const input = ref<AspectRatioInput>(undefined)
    const ratio = useAspectRatio(input)

    expect(ratio.value).toBe(1)

    input.value = '4 / 2'
    expect(ratio.value).toBe(2)

    input.value = 1.5
    expect(ratio.value).toBe(1.5)

    input.value = 'auto'
    expect(ratio.value).toBe(1)
  })

  test('reactive fallback', () => {
    const fallback = ref(2)
    const ratio = useAspectRatio(() => undefined, fallback)

    expect(ratio.value).toBe(2)

    fallback.value = 0.5
    expect(ratio.value).toBe(0.5)
  })
})
