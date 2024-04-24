export type FrameFit = 'fill' | 'cover' | 'contain'

export type Prettify<T> = T extends object
  ? { [K in keyof T]: Prettify<T[K]> }
  : T

export type Numberish = number | string
