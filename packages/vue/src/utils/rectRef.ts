import { createRect } from 'placement/rect'
import { shallowRef, triggerRef } from 'vue'

export function rectRef() {
  const rect = createRect()

  const rectRef = shallowRef(rect)
  return {
    update: (x: number, y: number, width: number, height: number) => {
      let didUpdate = false

      if (rect.x !== x) {
        rect.x = x
        didUpdate = true
      }

      if (rect.y !== y) {
        rect.y = y
        didUpdate = true
      }

      if (rect.width !== width) {
        rect.width = width
        didUpdate = true
      }

      if (rect.height !== height) {
        rect.height = height
        didUpdate = true
      }

      if (didUpdate) {
        triggerRef(rectRef)
      }
    },
    rect: rectRef,
  }
}
