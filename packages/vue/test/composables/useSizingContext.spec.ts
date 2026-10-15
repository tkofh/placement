import * as Rect from 'placement/rect'
import { describe, expect, test } from 'vitest'
import { type ComputedRef, defineComponent, h, nextTick, shallowRef } from 'vue'
import {
  useParentHeight,
  useParentRectRegistration,
  useParentWidth,
  useParentX,
  useParentY,
} from '../../src/composables/useSizingContext.ts'
import { mountWithRect } from '../host.ts'
import { createApp, createRoot } from '../renderer.ts'

interface ParentAccessors {
  readonly x: ComputedRef<number>
  readonly y: ComputedRef<number>
  readonly width: ComputedRef<number>
  readonly height: ComputedRef<number>
}

function makeProbe(record: Record<string, ParentAccessors>) {
  return defineComponent({
    name: 'Probe',
    props: { label: { type: String, required: true } },
    setup(props) {
      record[props.label] = {
        x: useParentX(),
        y: useParentY(),
        width: useParentWidth(),
        height: useParentHeight(),
      }
      return () => null
    },
  })
}

function valuesOf(accessors: ParentAccessors | undefined) {
  return accessors === undefined
    ? undefined
    : {
        x: accessors.x.value,
        y: accessors.y.value,
        width: accessors.width.value,
        height: accessors.height.value,
      }
}

describe('accessors', () => {
  test('return the host rect components and track rect changes', async () => {
    const record: Record<string, ParentAccessors> = {}
    const Probe = makeProbe(record)
    const rect = shallowRef(Rect.make(10, 20, 200, 100))
    mountWithRect(rect, () => [h(Probe, { label: 'root' })])
    await nextTick()

    expect(valuesOf(record['root'])).toEqual({ x: 10, y: 20, width: 200, height: 100 })

    rect.value = Rect.make(5, 15, 400, 50)
    await nextTick()

    expect(valuesOf(record['root'])).toEqual({ x: 5, y: 15, width: 400, height: 50 })
  })
})

describe('shadowing', () => {
  test('useParentRectRegistration shadows the context for its descendants only', async () => {
    const record: Record<string, ParentAccessors> = {}
    const Probe = makeProbe(record)
    const Shadow = defineComponent({
      name: 'Shadow',
      setup(_, { slots }) {
        useParentRectRegistration(Rect.make(1, 2, 30, 40))
        return () => slots['default']?.()
      },
    })
    mountWithRect(Rect.make(0, 0, 200, 100), () => [
      h(Shadow, null, () => [h(Probe, { label: 'inner' })]),
      h(Probe, { label: 'sibling' }),
    ])
    await nextTick()

    expect(valuesOf(record['inner'])).toEqual({ x: 1, y: 2, width: 30, height: 40 })
    expect(valuesOf(record['sibling'])).toEqual({ x: 0, y: 0, width: 200, height: 100 })
  })
})

describe('errors', () => {
  test.each([
    ['useParentX', useParentX],
    ['useParentY', useParentY],
    ['useParentWidth', useParentWidth],
    ['useParentHeight', useParentHeight],
  ])('%s reports a missing sizing context', (name, accessor) => {
    const errors: Array<unknown> = []
    const Orphan = defineComponent({
      setup() {
        accessor()
        return () => null
      },
    })
    const app = createApp(Orphan)
    app.config.errorHandler = (error) => {
      errors.push(error)
    }
    app.mount(createRoot())

    expect(String(errors[0])).toContain(`${name}() was called outside of a sizing context`)
  })
})
