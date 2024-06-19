export type MapFn<T = unknown> = (a: T) => T

export function pipe<T>(value: T, ...fns: Array<(value: T) => T>): T
export function pipe(
  value: unknown,
  a?: MapFn,
  b?: MapFn,
  c?: MapFn,
  d?: MapFn,
  e?: MapFn,
  f?: MapFn,
  g?: MapFn,
  h?: MapFn,
): unknown {
  switch (arguments.length) {
    case 1:
      return value
    case 2:
      return a!(value)
    case 3:
      return b!(a!(value))
    case 4:
      return c!(b!(a!(value)))
    case 5:
      return d!(c!(b!(a!(value))))
    case 6:
      return e!(d!(c!(b!(a!(value)))))
    case 7:
      return f!(e!(d!(c!(b!(a!(value))))))
    case 8:
      return g!(f!(e!(d!(c!(b!(a!(value)))))))
    case 9:
      return h!(g!(f!(e!(d!(c!(b!(a!(value))))))))
    default: {
      let ret = arguments[0]
      for (let i = 1; i < arguments.length; i++) {
        ret = arguments[i](ret)
      }
      return ret
    }
  }
}

export const dual: {
  <
    // biome-ignore lint/suspicious/noExplicitAny: generic function
    DataLast extends (...args: Array<any>) => any,
    // biome-ignore lint/suspicious/noExplicitAny: generic function
    DataFirst extends (...args: Array<any>) => any,
  >(
    arity: Parameters<DataFirst>['length'],
    body: DataFirst,
  ): DataLast & DataFirst
  <
    // biome-ignore lint/suspicious/noExplicitAny: generic function
    DataLast extends (...args: Array<any>) => any,
    // biome-ignore lint/suspicious/noExplicitAny: generic function
    DataFirst extends (...args: Array<any>) => any,
  >(
    isDataFirst: (args: IArguments) => boolean,
    body: DataFirst,
  ): DataLast & DataFirst
} = function dual(arity, body) {
  if (typeof arity === 'function') {
    return function () {
      if (arity(arguments)) {
        // @ts-expect-error
        return body.apply(this, arguments)
      }
      return ((self: unknown) => body(self, ...arguments)) as unknown
    }
  }

  switch (arity) {
    case 0:
    case 1:
      throw new RangeError(`Invalid arity ${arity}`)

    case 2:
      return function twoArgs(a, b) {
        if (arguments.length >= 2) {
          return body(a, b)
        }
        return (self: unknown) => body(self, a)
      }

    case 3:
      return function threeArgs(a, b, c) {
        if (arguments.length >= 3) {
          return body(a, b, c)
        }
        return (self: unknown) => body(self, a, b)
      }

    case 4:
      return function fourArgs(a, b, c, d) {
        if (arguments.length >= 4) {
          return body(a, b, c, d)
        }
        return (self: unknown) => body(self, a, b, c)
      }

    default:
      return function () {
        if (arguments.length >= arity) {
          // @ts-expect-error
          return body.apply(this, arguments)
        }
        const args = arguments
        return (self: unknown) => body(self, ...args)
      }
  }
}
