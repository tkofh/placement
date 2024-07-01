import { Pipeable } from './internal/pipeable'
import { dual } from './utils/function'

const TypeBrand: unique symbol = Symbol('placement/scale')
type TypeBrand = typeof TypeBrand

class Scale extends Pipeable {
  readonly [TypeBrand]: TypeBrand = TypeBrand
  constructor(
    readonly makeIterator: () => IterableIterator<number>,
    readonly length: number,
  ) {
    super()
  }
}

export type { Scale }

export const linear: {
  (): Scale
  (step: number): Scale
  (start: number, end: number): Scale
  (start: number, end: number, step: number): Scale
} = (a?: number, b?: number, c?: number) => {
  let start = 0
  let end = Number.POSITIVE_INFINITY
  let step = 1

  if (c !== undefined) {
    start = a as number
    end = b as number
    step = c
  } else if (b !== undefined) {
    start = a as number
    end = b
    step = (a as number) < b ? 1 : -1
  } else if (a !== undefined) {
    step = a
  }

  return new Scale(
    function* () {
      for (let i = start; i < end; i += step) {
        yield i
      }
    },
    Math.ceil((end - start) / step),
  )
}

export const isScale = (value: unknown): value is Scale => {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const map: {
  <R>(
    scale: Scale,
    fn: (scale: number, index: number) => R,
  ): IterableIterator<R>
  <R>(
    fn: (scale: number, index: number) => R,
  ): (scale: Scale) => IterableIterator<R>
} = dual(2, function* <
  R,
>(scale: Scale, fn: (scale: number, index: number) => R): IterableIterator<R> {
  let index = 0
  for (const value of scale.makeIterator()) {
    yield fn(value, index)
    index++
  }
})

type SizeableCollection<T> = Iterable<T> &
  ({ length: number } | { size: number })

export const mapWith: {
  <T, R>(
    scale: Scale,
    collection: SizeableCollection<T>,
    fn: (scale: number, collection: T, index: number) => R,
  ): IterableIterator<R>
  <T, R>(
    collection: SizeableCollection<T>,
    fn: (scale: number, collection: T, index: number) => R,
  ): (scale: Scale) => IterableIterator<R>
} = dual(3, function* <
  T,
  R,
>(scale: Scale, collection: SizeableCollection<T>, fn: (scale: number, collection: T, index: number) => R): IterableIterator<R> {
  let index = 0
  let iterator = scale.makeIterator()

  for (const value of collection) {
    let current = iterator.next()
    if (current.done) {
      iterator = scale.makeIterator()
      current = iterator.next() as IteratorResult<number> & { done: false }
    }

    yield fn(current.value, value, index)

    index++
  }
})
