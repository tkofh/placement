export interface Paintable {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  strokeDashoffset?: number
  strokeLinecap?: 'butt' | 'round' | 'square'
  strokeLinejoin?: 'miter' | 'round' | 'bevel'
  strokeMiterlimit?: number
  opacity?: number
}
