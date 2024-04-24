import type { Frame } from 'placement'
import { customRef } from 'vue'

export function frameRectRef(frame: Frame) {
  const rect = frame.rect

  return customRef((track, trigger) => {
    frame.onUpdate(() => {
      trigger()
    })

    return {
      get() {
        track()
        return { ...rect }
      },
      set() {
        throw new Error('Readonly')
      },
    }
  })
}
