export const SIZE_UNITS = [
  '%',
  'px',
  'vw',
  'vh',
  'vmin',
  'vmax',
  'cqw',
  'cqh',
  'cqmin',
  'cqmax',
] as const

export type SizeUnit = (typeof SIZE_UNITS)[number]
