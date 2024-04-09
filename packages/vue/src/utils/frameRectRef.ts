import type { Frame } from 'placement'
import { customRef } from 'vue'

export function frameRectRef(frame: Frame) {
  const rect = frame.computed

  return customRef((track, trigger) => {
    frame.on('updated', trigger)

    return {
      get() {
        track()
        return rect
      },
      set() {
        throw new Error('Readonly')
      },
    }
  })
}
