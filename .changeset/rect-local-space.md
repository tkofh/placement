---
'placement': minor
---

Add `localize`, `normalize`, and `denormalize` to `Rect` and `Interval`. Each takes the reference as `self` and re-expresses a target against it: relative to its origin, as fractions of it, or back from fractions. `Rect` targets are points or rects (`Rect.denormalize(rect, Point.half)` is the center), and `Interval` targets are positions or intervals (`Interval.denormalize(interval, 0.5)` is the midpoint).

**Breaking: `Interval.normalize` swaps its arguments.** It was `Interval.normalize(subject, reference)` and is now `Interval.normalize(reference, subject)`. Both arguments are intervals, so the compiler will not flag old call sites — swap them by hand. `Track.normalize` is unchanged.

`Box` and `Frame` no longer use `#private` fields, so they work inside Vue `ref`/`reactive` proxies. `Rect.make` is about 40% cheaper.
