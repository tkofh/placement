import { type Flexbox, applyFlexbox } from 'placement/flexbox'
import type { Frame } from 'placement/frame'
import { type Rect, rect } from 'placement/rect'
import {
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
  computed,
  inject,
  provide,
  ref,
  toValue,
  watch,
} from 'vue'
import { useChildIndex, useIndexParent } from './useChildIndex'

const FLEX_FRAMES = Symbol('placement/vue/flex-frames') as InjectionKey<
  Ref<ReadonlyArray<Frame>>
>

const FLEX_RECTS = Symbol('placement/vue/flex-rects') as InjectionKey<
  Ref<ReadonlyArray<Rect>>
>

export function useFlexLayout(
  flexbox: MaybeRefOrGetter<Flexbox>,
  rect: MaybeRefOrGetter<Rect>,
): {
  frames: Readonly<Ref<ReadonlyArray<Frame>>>
  rects: Readonly<Ref<ReadonlyArray<Rect>>>
} {
  const length = useIndexParent()

  const frames = ref<Array<Frame>>([])

  watch(length, (length) => {
    frames.value.length = length
  })

  provide(FLEX_FRAMES, frames)

  const rects = computed(() => {
    return applyFlexbox(frames.value, toValue(flexbox), toValue(rect))
  })

  provide(FLEX_RECTS, rects)

  return { frames, rects }
}

const zero = rect()

export function useFlexItem(input: MaybeRefOrGetter<Frame>) {
  const index = useChildIndex()

  const frames = inject(FLEX_FRAMES)
  const rects = inject(FLEX_RECTS)

  if (frames === undefined || rects === undefined) {
    throw new Error('no flex parent')
  }

  watch(
    index,
    (current, previous) => {
      const frame = toValue(input)

      if (previous === undefined || previous === -1) {
        frames.value = frames.value.toSpliced(current, 0, frame)
      } else if (current === -1) {
        frames.value = frames.value.toSpliced(previous, 1)
      } else {
        frames.value = frames.value.with(current, frame)
      }
    },
    { immediate: true, flush: 'sync' },
  )

  watch(
    () => toValue(input),
    (frame) => {
      frames.value =
        index.value >= frames.value.length
          ? frames.value.concat(frame)
          : frames.value.with(index.value, frame)
    },
    { immediate: true },
  )

  return computed(() =>
    index.value === -1 ? zero : rects.value.at(index.value) ?? zero,
  )
}
