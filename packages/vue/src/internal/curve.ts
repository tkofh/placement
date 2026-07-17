import type { Interval, Interval2d } from 'curvy/interval'
import { CubicPath2d, LinearPath2d, QuadraticPath2d, RationalCubicPath2d } from 'curvy/path'
import { Basis2d, Bezier2d, Cardinal2d, Hermite2d, Linear2d, RationalBezier2d } from 'curvy/splines'
import type { Affine2d } from 'curvy/transform'

/**
 * Everything `GraphicPath` accepts: a renderable path, a spline (converted
 * through its `toPath`), or a rational form (approximated as a cubic path
 * to the component's `tolerance`).
 */
export type PathInput =
  | LinearPath2d.LinearPath2d
  | QuadraticPath2d.QuadraticPath2d
  | CubicPath2d.CubicPath2d
  | RationalCubicPath2d.RationalCubicPath2d
  | Linear2d.Linear2d
  | Bezier2d.Bezier2d
  | Cardinal2d.Cardinal2d
  | Hermite2d.Hermite2d
  | Basis2d.Basis2d
  | RationalBezier2d.RationalBezier2d

// The three kinds with direct SVG path data emission; rational forms are
// approximated into cubics during normalization.
export type RenderablePath =
  | { readonly kind: 'linear'; readonly path: LinearPath2d.LinearPath2d }
  | { readonly kind: 'quadratic'; readonly path: QuadraticPath2d.QuadraticPath2d }
  | { readonly kind: 'cubic'; readonly path: CubicPath2d.CubicPath2d }

export function normalizePath(input: PathInput, tolerance: number): RenderablePath | null {
  if (CubicPath2d.isCubicPath2d(input)) {
    return { kind: 'cubic', path: input }
  }
  if (LinearPath2d.isLinearPath2d(input)) {
    return { kind: 'linear', path: input }
  }
  if (QuadraticPath2d.isQuadraticPath2d(input)) {
    return { kind: 'quadratic', path: input }
  }
  if (RationalCubicPath2d.isRationalCubicPath2d(input)) {
    return {
      kind: 'cubic',
      path: RationalCubicPath2d.approximateAsCubicPath(input, tolerance),
    }
  }
  if (Cardinal2d.isCardinal2d(input)) {
    return { kind: 'cubic', path: Cardinal2d.toPath(input) }
  }
  if (Bezier2d.isCubicBezier2d(input)) {
    return { kind: 'cubic', path: Bezier2d.toPath(input) }
  }
  if (Hermite2d.isHermite2d(input)) {
    return { kind: 'cubic', path: Hermite2d.toPath(input) }
  }
  if (Basis2d.isBasis2d(input)) {
    return { kind: 'cubic', path: Basis2d.toPath(input) }
  }
  if (Linear2d.isLinear2d(input)) {
    return { kind: 'linear', path: Linear2d.toPath(input) }
  }
  if (RationalBezier2d.isRationalBezier2d(input)) {
    return {
      kind: 'cubic',
      path: RationalCubicPath2d.approximateAsCubicPath(RationalBezier2d.toPath(input), tolerance),
    }
  }
  return null
}

export function transformPath(renderable: RenderablePath, affine: Affine2d): RenderablePath {
  switch (renderable.kind) {
    case 'linear':
      return { kind: 'linear', path: LinearPath2d.transform(renderable.path, affine) }
    case 'quadratic':
      return { kind: 'quadratic', path: QuadraticPath2d.transform(renderable.path, affine) }
    case 'cubic':
      return { kind: 'cubic', path: CubicPath2d.transform(renderable.path, affine) }
  }
}

export function pathBounds(
  renderable: RenderablePath,
): Interval2d<Interval.Closed, Interval.Closed> {
  switch (renderable.kind) {
    case 'linear':
      return LinearPath2d.boundingBox(renderable.path)
    case 'quadratic':
      return QuadraticPath2d.boundingBox(renderable.path)
    case 'cubic':
      return CubicPath2d.boundingBox(renderable.path)
  }
}

export function pathData(renderable: RenderablePath): string {
  switch (renderable.kind) {
    case 'linear':
      return LinearPath2d.toPathData(renderable.path)
    case 'quadratic':
      return QuadraticPath2d.toPathData(renderable.path)
    case 'cubic':
      return CubicPath2d.toPathData(renderable.path)
  }
}

/**
 * Parses a number-or-numeric-string prop (the `grow="1"` template idiom);
 * non-finite results are unset.
 */
export function finiteNumber(value: number | `${number}` | undefined): number | undefined {
  const parsed = typeof value === 'number' ? value : value != null ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}
