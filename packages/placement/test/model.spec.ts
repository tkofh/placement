import { describe, expect, test, vi } from 'vitest'
import * as Box from '../src/box.ts'
import * as Flexbox from '../src/flexbox.ts'
import * as Frame from '../src/frame.ts'
import * as Length from '../src/length.ts'
import * as Offset from '../src/offset.ts'
import * as Point from '../src/point.ts'
import * as Rect from '../src/rect.ts'
import * as Model from '../src/unstable/model.ts'

const root = Rect.make(800, 600)
const layout = Flexbox.make({ columnGap: 10 })
const a = Frame.make({ width: 100 })
const b = Frame.make({ grow: 1 })

const toolbar = () =>
  Model.store(
    Model.flex('toolbar', { layout }, [Model.item({ frame: a }), Model.item('b', { frame: b })]),
    { root },
  )

describe('specs', () => {
  test('keys come from the call or the position', () => {
    const spec = Model.flex('t', {}, [Model.item({}), Model.item('x', {}), Model.item()])
    expect(spec.key).toBe('t')
    expect(spec.children.map((child) => child.key)).toEqual([undefined, 'x', undefined])
    expect(Model.isSpec(spec)).toBe(true)
    expect(Model.isSpec({ kind: 'flex' })).toBe(false)
  })

  test.each(['', 'a.b', '1', '2nd'])('rejects the key %j', (key) => {
    expect(() => Model.item(key, {})).toThrow(RangeError)
  })

  test('rejects duplicate sibling keys', () => {
    expect(() => Model.flex('t', {}, [Model.item('a', {}), Model.item('a', {})])).toThrow(
      RangeError,
    )
  })

  test('rejects a child kind the parent does not accept', () => {
    expect(() => Model.flex('t', {}, [Model.group('g', {}) as never])).toThrow(TypeError)
    expect(() => Model.group('g', {}, [Model.item('i', {}) as never])).toThrow(TypeError)
  })

  test('rejects unknown and mistyped props', () => {
    expect(() => Model.item('i', { box: Box.make({}) } as never)).toThrow(TypeError)
    expect(() => Model.item('i', { frame: Box.make({}) } as never)).toThrow(TypeError)
    expect(() => Model.group('g', 3 as never)).toThrow(TypeError)
  })

  test('freezes props and children', () => {
    const props = { frame: a }
    const spec = Model.item('i', props)
    expect(spec.props).not.toBe(props)
    expect(Object.isFrozen(spec.props)).toBe(true)
    expect(Object.isFrozen(Model.flex('t', {}, [spec]).children)).toBe(true)
  })
})

describe('store', () => {
  test('places a flex and its items like Flexbox.apply', () => {
    const store = toolbar()
    const [ra, rb] = Flexbox.apply([a, b], layout, root)
    expect(store.get('toolbar')).toEqual(root)
    expect(store.get('toolbar.0')).toEqual(ra)
    expect(store.get('toolbar.b', 'rect')).toEqual(rb)
  })

  test('places groups with box, origin, and translation', () => {
    const box = Box.make({ width: 100, height: 50, left: 10, top: 20 })
    const store = Model.store(
      Model.group({}, [
        Model.group('g', { box, origin: Point.half, translate: Point.make(5, 6) }, [
          Model.group('inner', { box: Box.make({ width: 10, height: 10 }) }),
        ]),
      ]),
      { root },
    )
    const placed = Box.apply(box, root)
    const g = Rect.make(placed.x - 50 + 5, placed.y - 25 + 6, 100, 50)
    expect(store.get('root')).toEqual(root)
    expect(store.get('root.g')).toEqual(g)
    expect(store.get('root.g.inner')).toEqual(Rect.make(g.x, g.y, 10, 10))
  })

  test('a flex places its items in its content rect', () => {
    const gutter = Offset.make(10)
    const store = Model.store(Model.flex('t', { gutter }, [Model.item('i', { frame: b })]), {
      root,
    })
    const inner = Rect.contract(root, gutter)
    expect(store.get('t')).toEqual(inner)
    expect(store.get('t.i')).toEqual(Flexbox.apply([b], Flexbox.make({}), inner)[0])
  })

  test('items hold nested containers', () => {
    const store = Model.store(
      Model.flex('t', {}, [
        Model.item('i', { frame: a }, [Model.flex('f', {}, [Model.item('j', {})])]),
      ]),
      { root },
    )
    expect(store.get('t.i.f')).toEqual(store.get('t.i'))
  })

  test('rejects an item root and a missing path', () => {
    expect(() => Model.store(Model.item('i', {}) as never, { root })).toThrow(TypeError)
    expect(() => toolbar().get('nope' as never)).toThrow(RangeError)
    expect(() => toolbar().get('toolbar', 'route' as never)).toThrow(TypeError)
    expect(Model.isStore(toolbar())).toBe(true)
  })
})

describe('mutate', () => {
  test('returns the same store with the ops applied', () => {
    const store = toolbar()
    const next = Model.mutate(store, (m) =>
      m
        .update('toolbar.b', { frame: Frame.make({ width: 50 }) })
        .insert('toolbar', Model.item('c', { frame: a }), { before: 'toolbar.b' })
        .remove('toolbar.0')
        .setChildren('toolbar', ['toolbar.b', 'toolbar.c']),
    )
    expect(next).toBe(store)
    const [rb, rc] = Flexbox.apply([Frame.make({ width: 50 }), a], layout, root)
    expect(next.get('toolbar.b')).toEqual(rb)
    expect(next.get('toolbar.c')).toEqual(rc)
    expect(() => store.get('toolbar.0')).toThrow(RangeError)
  })

  test('update merges props, and undefined resets a field', () => {
    const store = Model.store(
      Model.group('g', { box: Box.make({ width: 10, height: 10 }), translate: Point.make(5, 5) }),
      { root },
    )
    Model.mutate(store, (m) => m.update('g', { translate: undefined }))
    expect(store.get('g')).toEqual(Rect.make(10, 10))
  })

  test('setRoot moves everything', () => {
    const store = toolbar()
    Model.mutate(store, (m) => m.setRoot(Rect.make(400, 300)))
    expect(store.get('toolbar.b')).toEqual(Flexbox.apply([a, b], layout, Rect.make(400, 300))[1])
  })

  test('removing a node removes its descendants', () => {
    const store = Model.store(
      Model.group('g', {}, [Model.flex('f', {}, [Model.item('i', {}, [Model.group('deep', {})])])]),
      { root },
    )
    const removed = Model.mutate(store, (m) => m.remove('g.f'))
    expect(() => store.get('g.f.i.deep')).toThrow(RangeError)
    const again = Model.mutate(removed, (m) => m.insert('g', Model.flex('f', {})))
    expect(() => again.get('g.f.i' as never)).toThrow(RangeError)
  })

  test.each<
    [string, (m: Model.Draft<Model.Dynamic>) => Model.Draft<Model.Dynamic>, ErrorConstructor]
  >([
    ['an unknown path', (m) => m.update('toolbar.z', {}), RangeError],
    ['a removed path', (m) => m.remove('toolbar.b').update('toolbar.b', {}), RangeError],
    ['a keyless insert', (m) => m.insert('toolbar', Model.item({}) as never), RangeError],
    ['a duplicate insert', (m) => m.insert('toolbar', Model.item('b', {})), RangeError],
    ['a kind the parent rejects', (m) => m.insert('toolbar', Model.group('g', {})), TypeError],
    [
      'a before that is not a child',
      (m) => m.insert('toolbar', Model.item('c'), { before: 'toolbar' }),
      RangeError,
    ],
    ['removing the root', (m) => m.remove('toolbar'), RangeError],
    ['a partial setChildren', (m) => m.setChildren('toolbar', ['toolbar.b']), RangeError],
    [
      'a repeated setChildren',
      (m) => m.setChildren('toolbar', ['toolbar.b', 'toolbar.b']),
      RangeError,
    ],
    ['props of another kind', (m) => m.update('toolbar.b', { layout } as never), TypeError],
    ['a root that is not a rect', (m) => m.setRoot({} as never), TypeError],
  ])('rejects %s before writing anything', (_, f, error) => {
    const store = toolbar() as unknown as Model.Store<Model.Dynamic>
    const before = store.get('toolbar.b')
    expect(() =>
      Model.mutate(store, (m) => f(m.update('toolbar.b', { frame: Frame.make({ width: 1 }) }))),
    ).toThrow(error)
    expect(store.get('toolbar.b')).toBe(before)
  })

  test('rejects a callback that does not return the draft', () => {
    expect(() => Model.mutate(toolbar(), (() => undefined) as never)).toThrow(TypeError)
  })

  test('a dropped op applies nowhere', () => {
    const store = toolbar()
    Model.mutate(store, (m) => {
      m.remove('toolbar.b')
      return m
    })
    expect(store.get('toolbar.b')).toBeDefined()
  })
})

// Places one frame alone in `content`.
const solve = (content: Rect.Rect, input: Frame.FrameInput) =>
  Flexbox.apply([Frame.make(input)], Flexbox.make({}), content)[0]

describe('lengths', () => {
  const pct = Length.percent

  test('a box resolves against its parent rect, each field on its axis', () => {
    const store = Model.store(
      Model.group('g', {
        box: { left: pct(10), top: pct(25), width: pct(50), maxHeight: pct(25), right: 8 },
      }),
      { root },
    )
    const box = Box.make({ left: 80, top: 150, width: 400, maxHeight: 150, right: 8 })
    expect(store.get('g')).toEqual(Box.apply(box, root))
  })

  test('a nested box resolves against its parent group, and re-resolves with it', () => {
    const store = Model.store(
      Model.group('g', { box: { width: pct(50), height: pct(50) } }, [
        Model.group('inner', { box: { width: pct(50), top: pct(50) } }),
      ]),
      { root },
    )
    expect(store.get('g.inner')).toEqual(Rect.make(0, 150, 200, 150))

    const listener = vi.fn()
    store.subscribe('g.inner', listener)
    Model.mutate(store, (m) => m.setRoot(Rect.make(400, 200)))
    expect(store.get('g.inner')).toEqual(Rect.make(0, 50, 100, 50))
    expect(listener).toHaveBeenCalledTimes(1)

    Model.mutate(store, (m) => m.update('g', { box: { width: pct(100), height: pct(100) } }))
    expect(store.get('g.inner')).toEqual(Rect.make(0, 100, 200, 100))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  test('a translation resolves against the rect it moves', () => {
    const store = Model.store(
      Model.group('g', {
        box: { width: 100, height: 50, left: 200 },
        translate: { x: pct(50), y: pct(-100) },
      }),
      { root },
    )
    expect(store.get('g')).toEqual(Rect.make(250, -50, 100, 50))
  })

  test('a gutter resolves against the placed rect', () => {
    const store = Model.store(
      Model.flex('t', {
        box: { width: 400, height: 200 },
        gutter: { top: pct(10), left: pct(10), right: 4 },
      }),
      { root },
    )
    expect(store.get('t')).toEqual(Rect.make(40, 20, 356, 180))
  })

  test('a frame resolves against its container content rect, and re-resolves with it', () => {
    const frame = { width: pct(50), height: pct(25), offsetLeft: pct(25), offsetTop: pct(25) }
    const store = Model.store(
      Model.flex('t', { gutter: Offset.make(100) }, [Model.item('i', { frame })]),
      { root },
    )
    const content = Rect.make(100, 100, 600, 400)
    const resolved = { width: 300, height: 100, offsetLeft: 150, offsetTop: 100 }
    expect(store.get('t.i')).toEqual(solve(content, resolved))

    Model.mutate(store, (m) => m.update('t', { gutter: Offset.make(200) }))
    const smaller = Rect.make(200, 200, 400, 200)
    expect(store.get('t.i')).toEqual(
      solve(smaller, { width: 200, height: 50, offsetLeft: 100, offsetTop: 50 }),
    )

    Model.mutate(store, (m) => m.update('t', { gutter: undefined }).setRoot(Rect.make(400, 400)))
    expect(store.get('t.i')).toEqual(
      solve(Rect.make(400, 400), { width: 200, height: 100, offsetLeft: 100, offsetTop: 100 }),
    )
  })

  test('a frame size that resolves to NaN is unset, and a NaN margin stays auto', () => {
    const store = Model.store(
      Model.group('g', {}, [
        Model.flex('t', {}, [Model.item('a', { frame: { grow: 1, maxWidth: Number.NaN } })]),
        Model.flex('u', {}, [Model.item('b', { frame: { width: 100, offsetLeft: Number.NaN } })]),
      ]),
      { root },
    )
    expect(store.get('g.t.a')).toEqual(solve(root, { grow: 1 }))
    expect(store.get('g.t.a').width).toBe(800)
    expect(store.get('g.u.b')).toEqual(solve(root, { width: 100, offsetLeft: Number.NaN }))
    expect(store.get('g.u.b').x).toBe(700)
  })

  test('plain inputs are copied and frozen', () => {
    const ratio: [number, number] = [16, 9]
    const box = { width: 10, aspectRatio: ratio }
    const spec = Model.group('g', { box })
    const kept = spec.props.box as Box.BoxInput<Length.LengthInput>
    expect(kept).not.toBe(box)
    expect(Object.isFrozen(kept)).toBe(true)
    expect(kept.aspectRatio).not.toBe(ratio)
    expect(Object.isFrozen(kept.aspectRatio)).toBe(true)
  })

  test.each<[string, () => unknown]>([
    ['a frame field in a box', () => Model.group('g', { box: { grow: 1 } as never })],
    ['a string length', () => Model.group('g', { box: { width: '50%' as never } })],
    ['an id in a frame', () => Model.item('i', { frame: { id: 'x' } as never })],
    ['a box as a frame', () => Model.item('i', { frame: Box.make({}) as never })],
    ['a bad ratio', () => Model.item('i', { frame: { aspectRatio: [16] as never } })],
    ['an unknown gutter side', () => Model.flex('t', { gutter: { x: 1 } as never })],
    ['a length object as a gutter', () => Model.flex('t', { gutter: pct(5) as never })],
    ['an unknown translate field', () => Model.group('g', { translate: { z: 1 } as never })],
  ])('rejects %s', (_, make) => {
    expect(make).toThrow(TypeError)
  })
})

describe('subscriptions', () => {
  test('a path listener runs once per mutate that changes the output', () => {
    const store = toolbar()
    const listener = vi.fn()
    const off = store.subscribe('toolbar.b', listener)
    const prev = store.get('toolbar.b')

    Model.mutate(store, (m) =>
      m.update('toolbar.0', { frame: Frame.make({ width: 50 }) }).setRoot(Rect.make(700, 600)),
    )
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(store.get('toolbar.b'), prev)

    off()
    off()
    Model.mutate(store, (m) => m.setRoot(root))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('an unchanged sibling stays quiet', () => {
    const store = Model.store(
      Model.flex('t', {}, [Model.item('x', { frame: a }), Model.item('y', { frame: a })]),
      {
        root,
      },
    )
    const listener = vi.fn()
    store.subscribe('t.x', listener)
    Model.mutate(store, (m) => m.update('t.y', { frame: Frame.make({ width: 200 }) }))
    expect(listener).not.toHaveBeenCalled()
  })

  test('removing a node ends its subscriptions without a call', () => {
    const store = toolbar()
    const listener = vi.fn()
    const off = store.subscribe('toolbar.b', listener)
    const removed = Model.mutate(store, (m) => m.remove('toolbar.b'))
    Model.mutate(removed, (m) => m.insert('toolbar', Model.item('b', { frame: a })))
    expect(listener).not.toHaveBeenCalled()
    off()
  })

  test('an any-change listener gets every change of a mutate at once', () => {
    const store = toolbar()
    const listener = vi.fn()
    store.subscribe(listener)
    const prev0 = store.get('toolbar.0')
    const prevB = store.get('toolbar.b')

    const next = Model.mutate(store, (m) =>
      m.insert('toolbar', Model.item('c', { frame: a })).remove('toolbar.0'),
    )
    expect(listener).toHaveBeenCalledTimes(1)
    const changes = listener.mock.calls[0]?.[0] as ReadonlyMap<string, Model.Change<Rect.Rect>>
    expect([...changes.keys()].toSorted()).toEqual(['toolbar.0', 'toolbar.b', 'toolbar.c'])
    expect(changes.get('toolbar.0')).toEqual({ prev: prev0, next: undefined })
    expect(changes.get('toolbar.b')).toEqual({ prev: prevB, next: next.get('toolbar.b') })
    expect(changes.get('toolbar.c')).toEqual({ prev: undefined, next: next.get('toolbar.c') })
  })

  test('a path removed and inserted again in one draft gets one entry', () => {
    const store = toolbar()
    const listener = vi.fn()
    store.subscribe(listener)
    const prev = store.get('toolbar.b')
    Model.mutate(store, (m) =>
      m
        .remove('toolbar.b')
        .insert('toolbar', Model.item('b', { frame: Frame.make({ width: 30 }) })),
    )
    const changes = listener.mock.calls[0]?.[0] as ReadonlyMap<string, Model.Change<Rect.Rect>>
    expect(changes.get('toolbar.b')).toEqual({ prev, next: store.get('toolbar.b') })
  })

  test('a mutate inside a listener applies at once and notifies in a second round', () => {
    const store = toolbar()
    const order: Array<string> = []
    store.subscribe('toolbar.b', () => {
      order.push('b')
      if (order.length === 1) {
        Model.mutate(store, (m) => m.update('toolbar.0', { frame: Frame.make({ width: 10 }) }))
        expect(store.get('toolbar.0').width).toBe(10)
        order.push('applied')
      }
    })
    store.subscribe('toolbar.0', () => order.push('0'))
    store.subscribe(() => order.push('any'))

    Model.mutate(store, (m) => m.setRoot(Rect.make(700, 600)))
    expect(order).toEqual(['b', 'applied', 'any', 'b', '0', 'any'])
  })
})
