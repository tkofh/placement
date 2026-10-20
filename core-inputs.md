# Core layout inputs

Oct 20, 2026 · @tim

Rework `Box` and `Frame` around the concepts their fields stand for, before the reactive model in `placement-model.md` builds on them. The inputs a child gives its parent's layout grew around one solver each, and grid, anchor positioning, and further diagram layouts will each want inputs of their own. This document maps the fields to concepts, records what is decided, and lays out a pass over the core package that settles the basics.

## Why core comes first

The model's props mirror the core inputs, so every quirk in a core input becomes code in the model. The prop layer on the model branch (`internal/model/props.ts`, PRs tkofh/placement#6 and tkofh/placement#7) carries three such bridges:

- one field table per input (`BOX`, `FRAME`), which repeat the same sizing rows
- a `none` field kind and a runtime rejection that keep `id` off items
- a rule that turns a size resolving to `NaN` into unset, because `Frame` reads a `NaN` bound literally while `Box` reads it as unset

Each step of this pass removes one of them. The model branch stays paused and rebases onto the result, so the model is written once, against settled inputs.

## Fields by concept

| Fields                                                   | On              | Concept                                                       | CSS counterpart                          | Read by                                                 |
| -------------------------------------------------------- | --------------- | ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `width`, `height`, the min/max bounds, `aspectRatio`     | `Box`, `Frame`  | Sizing                                                        | `width`, `min-width`, `aspect-ratio`     | Every layout                                            |
| `top`, `right`, `bottom`, `left`                         | `Box`           | Insets: the distance from each edge of the containing rect    | `top`, `left` under `position: absolute` | `Box.apply`                                             |
| `offsetTop`, `offsetRight`, `offsetBottom`, `offsetLeft` | `Frame`         | Margin: space reserved outside the item, auto when non-finite | `margin`                                 | `Flexbox.apply`, `Hierarchy.apply`, adornment placement |
| `gutter`                                                 | Flex node props | Padding: the container's inner space                          | `padding`                                | The flex node's content rect (model only)               |
| `align`, `stretch`                                       | `Frame`         | Self-alignment on one axis                                    | `align-self`                             | `Flexbox.apply`, `Hierarchy.apply`, adornment placement |
| `grow`, `shrink`                                         | `Frame`         | Flex factors                                                  | `flex-grow`, `flex-shrink`               | `Flexbox.apply`                                         |
| `id`                                                     | `Frame`         | Identity                                                      | None                                     | `Hierarchy.apply`                                       |

A frame's offsets push outward from the item, and a box's sides measure inward from the parent, so neither object holds padding. The three edge concepts of CSS (inset, margin, padding) each live on a different object, because the split follows the solvers. `Frame` is the item input of three layouts. `Hierarchy.apply` reads its sizing, margin, `align`, and `stretch`, and documents `grow` and `shrink` as having no effect. An `Adornment` holds a frame for its size, its gaps (the margins along the line), and its `align` across the line.

## Sizing

`Box` and `Frame` take the same seven sizing fields and read them differently:

- `Box` keeps an unset size unset until `apply`, which fills the parent minus the set insets. It reads any non-finite value as unset.
- `Frame` resolves its sizing at construction through `normalizeSizing` (`utils/arguments.ts`), and an unset size falls back to `0`. It reads a `NaN` bound literally.

A box's fill is self-alignment. A box with no explicit or ratio-derived size takes the extent its set insets leave and sits at its start, which acts as a stretch of `1` and an alignment of `0` in that space. Both insets set is the same stretch. The ratio below is the one place the two differ. If stretch and alignment move into a self-alignment concept that `Box` also reads, an unset size means one thing in every layout: the intrinsic size, `0` until something measures one (the model's design call 10).

**A stretched size feeds the ratio.** A stretch into space that is fixed before the item is sized gives a definite size, and the ratio derives the other axis from it, as `Box.apply` derives a width from an inset-determined height. When both axes are definite, the ratio has no effect. `Flexbox.apply` reads a frame's resolved size and never consults the ratio, so flex has to change:

- A single line's cross size is the container's cross size, known before the solve, so a stretched cross size derives the main base size directly.
- A wrapped line takes its cross size from its items, so a stretch there feeds the ratio only on a second pass, after the lines are sized.

The decision exposes one exception in `Box`. Without an inset pair or an explicit size, `Box.apply` lets the ratio derive an axis from the other one first and fills only what the ratio leaves. Its default fill therefore ranks below the ratio, while an inset pair ranks above it. A box's default self-alignment cannot be a plain stretch of `1`. It is its own value, which stretches unless the ratio sizes the axis. CSS grid's `normal` is similar: it acts as `stretch`, except on an item with a preferred aspect ratio, where it acts as `start`.

A **sizing module** (`placement/sizing`) owns:

- the seven fields, kept unset when omitted, with the length type `L` as a parameter (PR tkofh/placement#7 threads `L` through `BoxInput` and `FrameInput` separately)
- the field table naming each field's percentage axis
- one resolve for the clamp, the ratio transfer, and min-wins bounds, given the size each layout supplies for an unset axis and whether a stretch made an axis definite

`normalizeSizing` and the sizing half of `Box.apply` both become calls to that resolve.

## Identity

`id` is the one field no layout solves with. `Hierarchy.apply` reads it to index frames, to check the ids that edges name, and to key its result, and every other layout ignores it. It costs `Frame` a type parameter: 79 lines of `frame.ts` mention `K extends string | undefined`, `setId` exists to change it, and the model needs a field kind (`none`) and a runtime rejection to keep it off items.

`Hierarchy.apply` already keys its `options` and its result's `nodes` by id, and `Connector.apply` takes its rects as a record keyed by id. Hierarchy takes its nodes the same way, which removes the field:

```ts
Hierarchy.apply(
  { a: Frame.make({ width: 100, height: 40 }), b: Frame.make({ width: 100, height: 40 }) },
  [Edge.make({ source: 'a', target: 'b' })],
  Hierarchy.make({ rankGap: 50 }),
)
```

A record makes a duplicate id unrepresentable, where `apply` checks for one at runtime. Input order breaks ties, and a record puts integer-like keys (`'2'`, `'10'`) first, in numeric order, so `apply`'s docs state that order. The model's keys never start with a digit, so the model never meets it.

## Item protocols

Each layout reads a different set of concepts from its children:

| Layout                 | Sizing | Margin       | Insets | Self-alignment        | Layout-specific                     |
| ---------------------- | ------ | ------------ | ------ | --------------------- | ----------------------------------- |
| Flex                   | Yes    | Yes          | —      | Cross axis            | `grow`, `shrink`                    |
| Hierarchy              | Yes    | Yes          | —      | One axis              | —                                   |
| Adornment              | Yes    | Yes, as gaps | —      | Across the line       | `at`, `position`, `layer`, `orient` |
| Positioned box (`Box`) | Yes    | —            | Yes    | Both axes, by default | —                                   |
| Grid (planned)         | Yes    | Yes          | —      | Both axes             | Row and column lines or spans       |
| Anchor (planned)       | Yes    | Yes          | Yes    | Both axes             | The anchor and the area near it     |

CSS anchor positioning turns an anchor and a `position-area` into an inset-modified containing block, then places the element with the ordinary insets and self-alignment of absolute positioning. Here that is a rect computed from the anchor's rect, followed by `Box.apply`, so `Box` is the last step of the anchor solve.

## Self-alignment

Each axis that a layout leaves to its item takes one **alignment**: a position fraction (`align`) and a stretch fraction (`stretch`). Vue's `alignSelf` prop parses into the same pair, as `place 50% stretch 30%`. Flex, hierarchy, and adornments each leave the item one axis and handle the other themselves. Grid, `Box`, and anchor leave both.

The fields are named by who chooses the axis:

- **One-axis alignment** (`align`, `stretch`) is for a layout that names the axis. In flex, both mean the cross axis, so a flex that changes direction keeps them.
- **Two-axis alignment** (`alignX`, `alignY`, `stretchX`, `stretchY`) is for a layout that names no axis. Physical names match the physical margins and insets.

Both flavors share one resolve per axis. A layout reads one flavor. The model's type index can reject the other flavor on its children, so `align` on a grid child is a type error and never quietly means y. A child that moves from a column flex into a grid renames `align` to `alignX`, and the rename is accurate, because the axis has changed from one the parent chose to a fixed one.

The CSS names fit less well:

- CSS's `align-self` is the cross axis in flex and the block axis in grid. Without writing modes the block axis is y, so in a grid, `align` would mean y by convention and not by any axis the grid names.
- `justify-self` names the inline axis. Here that is x, which `alignX` already names.
- `place-self` is CSS's shorthand for both axes, and vue's `alignSelf` already uses `place` for the position fraction.

The rejected alternative is a single `align` that takes a number in a one-axis layout and a number or an `[x, y]` pair in a two-axis one. It keeps one name, but a bare number would change from one axis to both when the child changes parents.

Core inputs take longhands. A shorthand that sets both axes, like `place-self: center`, is a vue prop that parses into `alignX` and `alignY`, as `alignSelf` parses into `align` and `stretch`. A core setter can offer the same shorthand, as `setMargin` does for the four margins.

## Flat inputs without a god class

A god class fails through behavior: methods and invariants that span unrelated fields, so a change to one concept touches the rest. A bag of inert fields fails differently, if at all. CSS gives every element every property, and the parent's formatting context reads the ones it understands. Structural typing lets each solver declare only its slice, and a wide object satisfies every narrower type it covers, so nothing depends on the whole bag.

```ts
// Each concept module owns its fields, defaults, check, and field table.
type SizingInput<L> = { width?: L; height?: L; minWidth?: L; /* … */ aspectRatio?: AspectRatio }
type MarginInput<L> = { marginTop?: L; marginRight?: L; marginBottom?: L; marginLeft?: L }
type AlignInput = { align?: number; stretch?: number }
type Align2dInput = { alignX?: number; alignY?: number; stretchX?: number; stretchY?: number }
type FlexFactorsInput = { grow?: number; shrink?: number }

// A layout's item input is an intersection, and it stays flat.
type FrameInput<L = number> = SizingInput<L> & MarginInput<L> & AlignInput & FlexFactorsInput
type GridItemInput<L = number> = SizingInput<L> & MarginInput<L> & Align2dInput & GridPlacementInput

Frame.make({ width: 100, marginLeft: 8, grow: 1 }) // still one flat object
```

The model's field tables in `internal/model/props.ts` are a small property registry. Each names a field's value kind and the axis its percentage resolves against, as a CSS property definition names its value type and percentage basis. Each concept module exports its table, and a layout's table is the union of its slices' tables, so checking and resolving stay generic.

The model's node kinds raise the same question one level up. An `item` is a flex child, so the child's kind fixes its parent's layout, and grid and anchor would each add an item kind. A single child props type, the whole bag, would let the parent's kind decide which slices it reads, and a vue component would not need to know its parent's layout. The type index knows each path's parent, so the checker could still reject a field the parent never reads. That rejection matters, because silently ignored properties are the part of CSS not worth copying. This question belongs to the model and waits for the grid design.

## Cost

Three costs are concrete:

- The `id` type parameter runs through every `Frame` signature and needs a workaround in the model.
- The two readings of sizing need a `NaN` rule in the model's props.
- `Frame` is the item input of a layout that documents two of its fields as ignored.

Two are speculative. The grid and anchor slices are guesses until those solvers exist. A split also multiplies the setters, since each concept module brings its own `set*` functions and each composed spec has to forward them.

## Decisions

- **Margin name.** The frame's offsets become `marginTop`, `marginRight`, `marginBottom`, and `marginLeft`, as in CSS, with `setMargin` and its siblings.
- **Hierarchy node keys.** A record, keyed by id.
- **Ratio and stretch.** A stretched size feeds the ratio (see Sizing).
- **Self-alignment names.** Split by flavor: one-axis `align` and `stretch`, two-axis `alignX`, `alignY`, `stretchX`, and `stretchY`, all plain numbers. An `Align` value module, a single `align` field whose value has a one-axis, a two-axis, and perhaps a logical kind, was weighed and set aside. It fits CSS, where `stretch` is an `align-self` value, but no logical case exists without writing modes: the one-axis flavor is already relative to the parent's axis, grid and anchor have physical frames, and anchor's flip fallbacks can mirror physical values inside the solver. It would also make `align` the one nested value in flat inputs, with costs in the model's field table, JSON round trips, and per-channel inherit. A logical flavor can still arrive later as a flavor or value type of its own without renaming these fields.
- **Grow and the ratio.** A grown or shrunk main size derives an unset cross size through the ratio, as CSS lays out an item's hypothetical cross size with its flexed main size. An explicit or stretched cross size wins, and the ratio is not applied again.
- **Box's default alignment.** The `Infinity` inherit sentinel. An omitted two-axis field inherits, and `Box.apply` resolves inherit to its default: stretch unless the ratio sizes the axis, at the start, which is CSS grid's `normal`. A grid will resolve inherit to its container's defaults. No input gains a third sentinel.
- **Adornment shape.** Flat. `AdornmentInput` is the sizing, margin, and one-axis alignment slices beside `at`, `position`, `layer`, and `orient`, so it drops the `grow`, `shrink`, and `stretch` it never read, and `setFrame` goes.
- **The `L` parameter.** In core: `SizingInput<L = number>` and `MarginInput<L = number>` carry the length type, and the composed inputs pass it through. `make` takes numbers. The model's item props are `FrameInput<LengthInput>`.
- **Classes for specs.** Specs stay classes, and concept slices are input types, field tables, and functions with no class of their own, so composing a layout's input never needs a class per slice. Cost decides nothing between classes and records. On node 26, building a 16-field object takes about 9 ns as a class, 15 ns as an object literal or through `Object.create`, and 31 ns as a frozen literal, and reads cost the same in every shape. At hundreds of specs per solve the gap is microseconds. Classes keep the brand, `.pipe`, and the normalization at construction.

## Plan

Each step ships alone, with tests, docs, and a changeset, and leaves vue working. Steps 1 to 4 are this pass. Steps 5 and 6 are later work that the pass must not block.

1. **Identity.** Take `id` and the `K` parameter off `Frame`, remove `setId`, and make `Hierarchy.apply` take its nodes as a record keyed by id. Update vue's `HierarchyNode` and the hierarchy tests.
2. **Margin.** Rename the frame's offsets to `margin*` across `Frame`, `Flexbox`, `Hierarchy`, adornments, vue's `internal/frame.ts`, and the tests.
3. **Sizing.** Add `placement/sizing` with the inputs, the field table, and one resolve that takes the unset size from the layout. Port `Frame`, `Box`, and `normalizeSizing` onto it. Make a stretched size feed the ratio in `Flexbox.apply` and `Hierarchy.apply`, and settle what grow does.
4. **Self-alignment.** Extract one-axis and two-axis alignment with one per-axis resolve. Flex, hierarchy, and adornments read `align` and `stretch`. `Box` reads the two-axis flavor, with its fill as the default.
5. Design the grid item beside the flex item before generalizing the item protocol or the model's kinds. Two layouts' item inputs are the fewest that show where the seams fall.
6. Build anchor positioning on `Box.apply`.

## Back to the model

When the pass lands, the model branch rebases onto it and changes in these places:

- `internal/model/props.ts` builds its tables from the slices' tables and drops the `none` field kind, the `id` rejection, and the `NaN` size rule.
- Item props take the composed `FrameInput` with `margin*` fields, and the `Length` parameter comes from the sizing and margin slices.
- `placement-model.md` updates its percentage table and design call 1 to the new input names.
- The node kinds question (one child props type, parent decides) is settled with the grid design.
