import type * as Alignment from '../alignment.ts'
import type { FieldTable } from './fields.ts'

// What each one-axis alignment field holds: both are plain numbers.
export const fields = {
  align: 'number',
  stretch: 'number',
} as const satisfies FieldTable<Alignment.AlignInput>

// What each two-axis alignment field holds: all four are plain numbers.
export const fields2d = {
  alignX: 'number',
  alignY: 'number',
  stretchX: 'number',
  stretchY: 'number',
} as const satisfies FieldTable<Alignment.Align2dInput>
