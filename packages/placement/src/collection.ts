import { dual } from './utils/function'

const TypeBrand: unique symbol = Symbol('placement/collection')

class Collection<T> {
  readonly [TypeBrand] = TypeBrand

  constructor(
    readonly items: ReadonlyArray<T>,
    readonly length: number,
  ) {}
}

export function collection<T>(items: Iterable<T>): Collection<T> {
  const itemsArray = Array.from(items)
  return new Collection(itemsArray, itemsArray.length)
}

export function isCollection<T>(value: unknown): value is Collection<T> {
  return typeof value === 'object' && value !== null && TypeBrand in value
}

export const insert: {
  <T>(collection: Collection<T>, index: number, frame: T): Collection<T>
  <T>(index: number, frame: T): (collection: Collection<T>) => Collection<T>
} = dual(3, <T>(collection: Collection<T>, index: number, frame: T) => {
  return new Collection(
    collection.items
      .slice(0, index)
      .concat(frame)
      .concat(collection.items.slice(index)),
    collection.length + 1,
  )
})

export const replace: {
  <T>(collection: Collection<T>, current: T, replacement: T): Collection<T>
  <T>(current: T, replacement: T): (collection: Collection<T>) => Collection<T>
} = dual(3, <T>(collection: Collection<T>, current: T, replacement: T) => {
  return new Collection(
    collection.items.map((item) => {
      if (item === current) {
        return replacement
      }
      return item
    }),
    collection.length,
  )
})

export const move: {
  <T>(collection: Collection<T>, item: T, to: number): Collection<T>
  <T>(item: T, to: number): (collection: Collection<T>) => Collection<T>
} = dual(3, <T>(collection: Collection<T>, item: T, to: number) => {
  const currentIndex = collection.items.indexOf(item)
  if (currentIndex === -1) {
    return insert(collection, to, item)
  }

  if (currentIndex === to) {
    return collection
  }

  if (to < currentIndex) {
    return new Collection(
      collection.items
        .slice(0, to)
        .concat(collection.items.slice(to + 1, currentIndex))
        .concat(item)
        .concat(collection.items.slice(currentIndex)),
      collection.length,
    )
  }

  return new Collection(
    collection.items
      .slice(0, currentIndex)
      .concat(collection.items.slice(currentIndex + 1, to))
      .concat(item)
      .concat(collection.items.slice(to)),
    collection.length,
  )
})

export const remove: {
  <T>(collection: Collection<T>, item: T): Collection<T>
  <T>(item: T): (collection: Collection<T>) => Collection<T>
} = dual(2, <T>(collection: Collection<T>, item: T) => {
  const currentIndex = collection.items.indexOf(item)
  if (currentIndex === -1) {
    return collection
  }

  return new Collection(
    collection.items
      .slice(0, currentIndex)
      .concat(collection.items.slice(currentIndex + 1)),
    collection.length - 1,
  )
})
