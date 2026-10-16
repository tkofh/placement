import type { Interval, Interval2d } from 'curvy/interval'
import { CubicPath2d, LinearPath2d, QuadraticPath2d, RationalCubicPath2d } from 'curvy/path'
import { Basis2d, Bezier2d, Cardinal2d, Hermite2d, Linear2d, RationalBezier2d } from 'curvy/splines'
import type { Affine2d } from 'curvy/transform'
import type { Vector2 } from 'curvy/vector'
import { roundPolyline } from './corners.ts'

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

// The three kinds that emit SVG path data directly. Normalization
// approximates rational forms as cubics.
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
 * Parses a number-or-numeric-string prop (the `grow="1"` template idiom).
 * A non-finite result is unset.
 */
export function finiteNumber(value: number | `${number}` | undefined): number | undefined {
  const parsed = typeof value === 'number' ? value : value != null ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

export type CurveKind = 'cardinal' | 'basis' | 'bezier' | 'linear'

export type CurveEnds = 'duplicate' | 'reflect' | 'interpolate' | 'natural'

// The minimum count of control points for each family. Below it, there is
// no path to draw (points mount progressively).
function hasEnoughPoints(kind: CurveKind, ends: CurveEnds, count: number): boolean {
  switch (kind) {
    case 'basis':
    case 'cardinal':
      return count >= (ends === 'natural' ? 4 : 2)
    case 'bezier':
      return count >= 4 && count % 3 === 1
    default:
      return count >= 2
  }
}

export interface CurveOptions {
  /** Cardinal tension. */
  readonly tension?: number
  /** Cardinal parameterization. */
  readonly alpha?: number
  /** The corner radius of a linear curve. `0` (default) keeps it sharp. */
  readonly radius?: number
  /** The corner smoothing of a linear curve, from `0` to `1`. */
  readonly smoothing?: number
  /** Whether a rounded linear curve also rounds its closing corners. */
  readonly closed?: boolean
}

/**
 * The SVG path data of a spline family through `controls`, or `undefined`
 * when there are too few control points for the family. A linear curve
 * with a positive `radius` rounds its corners (see `roundPolyline`).
 */
export function curvePathData(
  kind: CurveKind,
  ends: CurveEnds,
  controls: ReadonlyArray<Vector2>,
  options: CurveOptions = {},
): string | undefined {
  if (!hasEnoughPoints(kind, ends, controls.length)) {
    return undefined
  }

  switch (kind) {
    case 'linear': {
      const radius = options.radius ?? 0
      if (radius > 0) {
        const rounded = roundPolyline(
          controls,
          radius,
          options.smoothing ?? 0,
          options.closed ?? false,
        )
        return rounded === undefined ? undefined : CubicPath2d.toPathData(rounded)
      }
      return LinearPath2d.toPathData(Linear2d.toPath(Linear2d.fromArray(controls)))
    }
    case 'basis': {
      // Basis2d.fromArray requires four control points, so endpoint
      // triplication pads the array before construction.
      const padded =
        ends === 'natural'
          ? controls
          : [controls[0]!, controls[0]!, ...controls, controls.at(-1)!, controls.at(-1)!]
      return CubicPath2d.toPathData(Basis2d.toPath(Basis2d.fromArray(padded)))
    }
    case 'bezier':
      return CubicPath2d.toPathData(Bezier2d.toPath(Bezier2d.fromArray(controls)))
    default: {
      const spline = Cardinal2d.fromArray(controls, options)
      const padded =
        ends === 'reflect'
          ? Cardinal2d.withReflectedEndpoints(spline)
          : ends === 'interpolate'
            ? Cardinal2d.withInterpolatedEndpoints(spline)
            : ends === 'natural'
              ? spline
              : Cardinal2d.withDuplicatedEndpoints(spline)
      return CubicPath2d.toPathData(Cardinal2d.toPath(padded))
    }
  }
}

/** The cardinal spline options from the `tension` and `alpha` props. Unset options stay omitted. */
export function curveOptions(
  tension: number | `${number}` | undefined,
  alpha: number | `${number}` | undefined,
): { tension?: number; alpha?: number } {
  const resolved: { tension?: number; alpha?: number } = {}
  const tensionValue = finiteNumber(tension)
  const alphaValue = finiteNumber(alpha)
  if (tensionValue !== undefined) {
    resolved.tension = tensionValue
  }
  if (alphaValue !== undefined) {
    resolved.alpha = alphaValue
  }
  return resolved
}
