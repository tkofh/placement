---
'placement': minor
---

Add an optional `id` to `Frame`. `Frame` is now generic over the literal type
of its id: `Frame.make({ id: 'start' })` is a `Frame<'start'>`, and a frame
without an id is a `Frame<undefined>`. The bare `Frame` type still accepts
any frame, so `Flexbox.apply` and other id-agnostic code are unaffected.
Every setter keeps the id and its type, and the new `Frame.setId` replaces
it. Layouts that connect frames, such as `Hierarchy.apply`, reference frames
by id.
