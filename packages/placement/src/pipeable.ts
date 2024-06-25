import { type FinalMapFn, type MapFn, pipe } from './utils/function'

export class Pipeable {
  pipe<T>(...fns: [...Array<MapFn<this>>, FinalMapFn<this, T>]): T {
    return pipe(this, ...fns)
  }
}
