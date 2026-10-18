import { describe, expectTypeOf, test } from 'vitest'
import * as Box from '../src/box.ts'
import * as Frame from '../src/frame.ts'
import * as Rect from '../src/rect.ts'
import * as Model from '../src/unstable/model.ts'

const root = Rect.make(800, 600)

const toolbar = Model.store(
  Model.flex('toolbar', {}, [
    Model.item({ frame: Frame.make({ width: 100 }) }),
    Model.item('b', {}),
  ]),
  { root },
)

const app = Model.store(
  Model.group('app', {}, [
    Model.flex('top', {}, [Model.item('a', {}), Model.item('b', {})]),
    Model.flex('bottom', {}, [
      Model.item('a', {}),
      Model.item({}, [Model.flex('inner', {}, [Model.item('a', {})])]),
    ]),
  ]),
  { root },
)

describe('paths', () => {
  test('come from keys and positions', () => {
    expectTypeOf<Parameters<typeof toolbar.get>[0]>().toEqualTypeOf<
      'toolbar' | 'toolbar.0' | 'toolbar.b'
    >()
    expectTypeOf(app.get('app.bottom.1.inner.a')).toEqualTypeOf<Rect.Rect>()
  })

  test('reject what is not in the model', () => {
    // @ts-expect-error -- no node at 'b'
    toolbar.subscribe('b', () => {})
    // @ts-expect-error -- 'b' is at position 1 but named 'b'
    toolbar.get('toolbar.1')
  })

  test('a keyless root is root', () => {
    const store = Model.store(Model.group({}, [Model.group('g', {})]), { root })
    expectTypeOf<Parameters<typeof store.get>[0]>().toEqualTypeOf<'root' | 'root.g'>()
  })
})

describe('specs', () => {
  test('reject bad and repeated keys', () => {
    expectTypeOf(Model.item('a.b', {})).not.toMatchTypeOf<Model.Spec>()
    expectTypeOf(Model.item('2nd', {})).not.toMatchTypeOf<Model.Spec>()
    expectTypeOf(Model.item('', {})).not.toMatchTypeOf<Model.Spec>()
    expectTypeOf(
      Model.flex('t', {}, [Model.item('a', {}), Model.item('a', {})]),
    ).not.toMatchTypeOf<Model.Spec>()
    expectTypeOf(Model.item('second2', {})).toMatchTypeOf<Model.Spec>()
  })

  test('reject child kinds the parent does not accept', () => {
    // @ts-expect-error -- a flex holds items
    Model.flex('t', {}, [Model.group('g', {})])
    // @ts-expect-error -- an item needs a flex
    Model.group('g', {}, [Model.item('i', {})])
    // @ts-expect-error -- an item cannot be the root
    Model.store(Model.item('i', {}), { root })
  })

  test('reject props of another kind', () => {
    // @ts-expect-error -- items have no box
    Model.item('i', { box: Box.make({}) })
  })
})

describe('get and subscribe', () => {
  test('type outputs and listeners', () => {
    expectTypeOf(toolbar.get('toolbar.b')).toEqualTypeOf<Rect.Rect>()
    expectTypeOf(toolbar.get('toolbar.b', 'rect')).toEqualTypeOf<Rect.Rect>()
    toolbar.subscribe('toolbar.b', (next, prev) => {
      expectTypeOf(next).toEqualTypeOf<Rect.Rect>()
      expectTypeOf(prev).toEqualTypeOf<Rect.Rect>()
    })
    toolbar.subscribe((changes) => {
      expectTypeOf(changes).toEqualTypeOf<
        ReadonlyMap<'toolbar' | 'toolbar.0' | 'toolbar.b', Model.Change<Rect.Rect>>
      >()
    })
  })

  test('reject an output the path cannot give', () => {
    // @ts-expect-error -- not an output
    toolbar.get('toolbar.b', 'route')
    // @ts-expect-error -- not an output
    toolbar.subscribe('toolbar.b', 'route', () => {})
  })
})

describe('mutate', () => {
  test('tracks the index through the ops', () => {
    const next = Model.mutate(app, (m) =>
      m
        .insert('app.top', Model.item('c', {}), { before: 'app.top.a' })
        .remove('app.bottom.1')
        .update('app.top.c', { frame: Frame.make({ grow: 1 }) })
        .setChildren('app.top', ['app.top.c', 'app.top.a', 'app.top.b'])
        .setRoot(root),
    )
    expectTypeOf(next.get('app.top.c')).toEqualTypeOf<Rect.Rect>()
    // @ts-expect-error -- went with 'app.bottom.1'
    next.get('app.bottom.1.inner.a')
  })

  test('rejects bad ops', () => {
    // @ts-expect-error -- 'app.bottom.a' is not a child of 'app.top'
    Model.mutate(app, (m) => m.setChildren('app.top', ['app.bottom.a']))
    // @ts-expect-error -- 'a' exists under 'app.top'
    Model.mutate(app, (m) => m.insert('app.top', Model.item('a', {})))
    // @ts-expect-error -- inserts need a key
    Model.mutate(app, (m) => m.insert('app.top', Model.item({})))
    // @ts-expect-error -- a flex holds items
    Model.mutate(app, (m) => m.insert('app.top', Model.group('g', {})))
    // @ts-expect-error -- an item is not a container
    Model.mutate(app, (m) => m.insert('app.top.a', Model.item('x', {})))
    // @ts-expect-error -- flex props on an item
    Model.mutate(app, (m) => m.update('app.top.a', { layout: undefined }))
    // @ts-expect-error -- the root cannot be removed
    Model.mutate(app, (m) => m.remove('app'))
    // @ts-expect-error -- 'before' must be a child of the parent
    Model.mutate(app, (m) => m.insert('app.top', Model.item('c', {}), { before: 'app.bottom.a' }))
    Model.mutate(app, (m) =>
      // @ts-expect-error -- removed earlier in the draft
      m.remove('app.top.a').update('app.top.a', {}),
    )
    // @ts-expect-error -- the callback must return the draft
    Model.mutate(app, (m) => {
      m.remove('app.top.a')
    })
  })
})

describe('runtime keys', () => {
  test('mapped children give pattern paths', () => {
    const names: Array<string> = ['p', 'q']
    const store = Model.store(
      Model.group('app', {}, [
        Model.flex(
          'list',
          {},
          names.map((name) => Model.item(name, {})),
        ),
        Model.flex(
          'grid',
          {},
          names.map(() => Model.item({})),
        ),
      ]),
      { root },
    )
    store.get('app.list.anything')
    store.get('app.grid.3')
    // @ts-expect-error -- not a position
    store.get('app.grid.x')
    // @ts-expect-error -- no such prefix
    store.get('app.nope')
  })

  test('a runtime key gives a pattern under its parent', () => {
    const key: string = 'k'
    const store = Model.store(
      Model.group('app', {}, [Model.flex('bar', {}, [Model.item('a', {})]), Model.group(key, {})]),
      { root },
    )
    expectTypeOf(store.get('app.bar.a')).toEqualTypeOf<Rect.Rect>()
    store.get('app.anything.deeper', 'rect')
    // @ts-expect-error -- outside 'app'
    store.get('elsewhere')
  })

  test('a runtime root key makes the store dynamic', () => {
    const key: string = 'k'
    const store = Model.store(Model.group(key, {}), { root })
    expectTypeOf(store).toEqualTypeOf<Model.Store<Model.Dynamic>>()
    const id: string = 'x'
    Model.mutate(store, (m) => m.insert(id, Model.item(id, {})).remove(id)).get(id)
  })
})

describe('dynamic stores', () => {
  test('take runtime paths in every op', () => {
    const store = Model.store(Model.group('root' as string, {}), { root })
    const id: string = 'x'
    Model.mutate(store, (m) =>
      m
        .insert(id, Model.item(id, {}), { before: id })
        .setChildren(id, [id])
        .update(id, { frame: undefined })
        .remove(id),
    )
    // @ts-expect-error -- inserts need a key
    Model.mutate(store, (m) => m.insert(id, Model.item({})))
  })
})
