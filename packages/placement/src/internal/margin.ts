import type * as Margin from '../margin.ts'
import type { FieldTable } from './fields.ts'

// What each margin field holds: the top and bottom margins resolve a
// percentage against the basis height (`y`), the left and right margins
// against its width (`x`).
export const fields = {
  marginTop: 'y',
  marginRight: 'x',
  marginBottom: 'y',
  marginLeft: 'x',
} as const satisfies FieldTable<Margin.MarginInput>
