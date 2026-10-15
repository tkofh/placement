import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { keywordResults } from '../../src/internal/props/alignSelf.ts'
import { type AlignSelfInput, useAlignSelf } from '../../src/props/alignSelf.ts'

describe('useAlignSelf', () => {
  test("the wrapper defaults the fallback to start, not the resolver's inherit sentinels", () => {
    // resolveAlignSelf's own defaults are the Infinity inherit sentinels. The
    // wrapper pins the fallback to keywordResults.start.
    expect(useAlignSelf(() => undefined).value).toEqual(keywordResults.start)
  })

  test("an 'auto' fallback flows the inherit sentinels through", () => {
    expect(useAlignSelf(() => undefined, keywordResults.auto).value).toEqual({
      align: Number.POSITIVE_INFINITY,
      stretch: Number.POSITIVE_INFINITY,
    })
  })

  test('keywords resolve through keywordResults', () => {
    expect(useAlignSelf(() => 'center').value).toEqual(keywordResults.center)
  })

  test('equal recomputes keep the cached instance', () => {
    const input = ref<AlignSelfInput>(0.5)
    const alignSelf = useAlignSelf(input)

    const first = alignSelf.value
    expect(first).toEqual({ align: 0.5, stretch: 0 })

    // The keyword resolves to the same values as the number under the start
    // fallback: recomputed, same instance.
    input.value = 'center'
    expect(alignSelf.value).toBe(first)

    input.value = 'stretch'
    expect(alignSelf.value).not.toBe(first)
    expect(alignSelf.value).toEqual(keywordResults.stretch)
  })
})
