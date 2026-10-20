# Core layout inputs

Oct 20, 2026 · @tim

Rework `Box` and `Frame` around the concepts their fields stand for, before the reactive model in `placement-model.md` builds on them. The inputs a child gives its parent's layout grew around one solver each, and grid, anchor positioning, and further diagram layouts will each want inputs of their own. This document maps the fields to concepts, records what is decided, and describes the pass over the core package that settles the basics.

**Status.** Steps 1 to 4 of the plan are built on `claude/core-inputs-design`. The sections below describe the code as it stands. "Back to the model" lists what the paused model branch changes when it rebases.

## Why core comes first

The model's props mirror the core inputs, so every quirk in a core input becomes code in the model. The prop layer on the model branch (`internal/model/props.ts`, PRs tkofh/placement#6 and tkofh/placement#7) carries three such bridges:

- one field table per input (`BOX`, `FRAME`), which repeat the same sizing rows
- a `none` field kind and a runtime rejection that keep `id` off items
- a rule that turns a size resolving to `NaN` into unset, because `Frame` read a `NaN` bound literally while `Box` read it as unset

Each step of this pass removes one of them. The model branch stays paused and rebases onto the result, so the model is written once, against settled inputs.

## Fields by concept

| Fields                                                   | Slice                 | On                                  | CSS counterpart                          | Read by                                                 |
| -------------------------------------------------------- | --------------------- | ----------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `width`, `height`, the min/max bounds, `aspectRatio`     | `placement/sizing`    | `Box`, `Frame`, `Adornment`         | `width`, `min-width`, `aspect-ratio`     | Every layout                                            |
| `top`, `right`, `bottom`, `left`                         | None yet              | `Box`                               | `top`, `left` under `position: absolute` | `Box.apply`                                             |
| `marginTop`, `marginRight`, `marginBottom`, `marginLeft` | `placement/margin`    | `Frame`, `Adornment`                | `margin`                                 | `Flexbox.apply`, `Hierarchy.apply`, adornment placement |
| `gutter`                                                 | None                  | Flex node props                     | `padding`                                | The flex node's content rect (model only)               |
| `align`, `stretch`                                       | `placement/alignment` | `Frame` (`Adornment`: `align` only) | `align-self`                             | `Flexbox.apply`, `Hierarchy.apply`, adornment placement |
| `alignX`, `alignY`, `stretchX`, `stretchY`               | `placement/alignment` | `Box`                               | `justify-self`, `align-self`             | `Box.apply`                                             |
| `grow`, `shrink`                                         | None                  | `Frame`                             | `flex-grow`, `flex-shrink`               | `Flexbox.apply`                                         |

Identity is no longer a field: `Hierarchy.apply` takes its nodes as a record keyed by id (see Identity).

A frame's margins push outward from the item, and a box's insets measure inward from the parent, so neither object holds padding. The three edge concepts of CSS (inset, margin, padding) each live on a different object, because the split follows the solvers. `Frame` is the item input of flex and hierarchy. `Hierarchy.apply` reads its sizing, margin, `align`, and `stretch`, and documents `grow` and `shrink` as having no effect. An `Adornment` takes the sizing and margin slices and `align` directly: its gaps are the margins along the line, and `align` is its side of the line.

## Sizing

`placement/sizing` owns the sizing slice:

- `SizingInput<L>`: the seven fields, with the length type `L` as a parameter (`number` by default).
- `fields`: the field table, naming each field's percentage axis (`x`, `y`) or `ratio`.
- `normalize`: reads every non-finite size or bound as unset, as `Box` already did. An unset size is `NaN`, an unset minimum `0`, an unset maximum `Infinity`. Negative bounds clamp to `0`, and a crossed maximum rises to its minimum. A non-positive or non-finite ratio is unset.
- `resolve(sizing, context)`: the one resolve for the clamp, the ratio transfer, and min-wins bounds.

`context` (a `SizingContext`) is what the layout knows about each axis: a size for an axis the item leaves unset, and whether the layout has fixed the axis (`definiteWidth`, `definiteHeight`). Each axis takes the first of: the context's size when the layout fixed the axis, the item's preferred size, the other axis's size through the ratio when the other axis has one of those two, and the context's size. When neither axis has a fixed or preferred size and the ratio is set, the ratio derives one axis from the other's clamped context size: the height from the width, unless the width is `0`. That keeps `Frame`'s old rule that a positive minimum on one axis drives the other.

A fixed axis overrides the item's preferred size, because in this library a stretch absorbs free space into any size, explicit or not (a hierarchy node with `height: 20` and `stretch: 1` fills its rank). A layout that wants an explicit size to win, as `Box.apply` does over an inset pair, simply does not mark the axis fixed.

Each spec keeps its normalized sizing under the internal `SizingOf` symbol (`internal/sizing.ts`), so layouts resolve it again with their own context. `Frame` and `Adornment` resolve their own `width` and `height` once at construction, with `0` for each axis, the intrinsic size until something measures one (the model's design call 10). They keep the result under `SizeOf`, beside `SizingOf`. `normalizeSizing` is gone.

**A stretched size feeds the ratio.** A stretch into space that is fixed before the item is sized gives a definite size, and the ratio derives the other axis from it. When both axes are definite, the ratio has no effect.

- `Flexbox.apply` solves each line's main track, derives an unset cross size from the flexed main size (decision: grow and the ratio), and then stacks the cross track. An item whose unset main size follows a stretched cross size then takes its main base size from the stretched size, and the line solves its main track again. The line keeps the cross size it stretched into: the container's for a lone line, its largest item's otherwise. Cross sizes that follow the main size derive again from the new main sizes, and the line keeps its items even if they now overflow it. Wrapping is decided once, on the first pass.
- `Hierarchy.apply` stacks each rank's band before it positions nodes across the flow (it used to stack them after). A node stretched within its band, with a ratio and no size of its own across the flow, takes its size across the flow from its stretched size, so Brandes-Köpf spaces it by the derived size.

`Box.apply` resolves through the same function. An inset pair fixes its axis unless a size is set. Otherwise the box's default alignment fills the room its insets leave, unless the ratio sizes the axis from the other one (see Self-alignment).

## Identity

`id` was the one field no layout solves with. `Hierarchy.apply` read it to index frames, to check the ids that edges name, and to key its result, and every other layout ignored it. It cost `Frame` a type parameter (`K`), a setter (`setId`), and, in the model, a field kind and a runtime rejection to keep it off items.

`Hierarchy.apply` now takes its nodes as a record keyed by id, as `Connector.apply` takes its rects:

```ts
Hierarchy.apply(
  { a: Frame.make({ width: 100, height: 40 }), b: Frame.make({ width: 100, height: 40 }) },
  [Edge.make({ source: 'a', target: 'b' })],
  Hierarchy.make({ rankGap: 50 }),
)
```

A record makes a duplicate id unrepresentable, so the runtime checks for a missing or shared id are gone. The record's keys type the edges and the result. Input order breaks ties, and a record puts integer-like keys (`'2'`, `'10'`) first, in numeric order, which `apply`'s docs state. The model's keys never start with a digit, so the model never meets it. Vue's `HierarchyNode` carries its `id` beside its frame (`HierarchyNodeInput.id`), and the layout still skips a node with a missing or taken id.

## Item protocols

Each layout reads a different set of concepts from its children:

| Layout                 | Sizing | Margin       | Insets | Self-alignment                      | Layout-specific                     |
| ---------------------- | ------ | ------------ | ------ | ----------------------------------- | ----------------------------------- |
| Flex                   | Yes    | Yes          | —      | One axis: the cross axis            | `grow`, `shrink`                    |
| Hierarchy              | Yes    | Yes          | —      | One axis: along the flow, in rank   | —                                   |
| Adornment              | Yes    | Yes, as gaps | —      | `align` only, across the line       | `at`, `position`, `layer`, `orient` |
| Positioned box (`Box`) | Yes    | —            | Yes    | Both axes, with its fill by default | —                                   |
| Grid (planned)         | Yes    | Yes          | —      | Both axes                           | Row and column lines or spans       |
| Anchor (planned)       | Yes    | Yes          | Yes    | Both axes                           | The anchor and the area near it     |

CSS anchor positioning turns an anchor and a `position-area` into an inset-modified containing block, then places the element with the ordinary insets and self-alignment of absolute positioning. Here that is a rect computed from the anchor's rect, followed by `Box.apply`, so `Box` is the last step of the anchor solve. `Box` now has both halves of that: insets and two-axis self-alignment.

## Self-alignment

Each axis that a layout leaves to its item takes one **alignment**: a position fraction (`align`) and a stretch fraction (`stretch`). Vue's `alignSelf` prop parses into the same pair, as `place 50% stretch 30%`. Flex, hierarchy, and adornments each leave the item one axis and handle the other themselves. Grid, `Box`, and anchor leave both.

`placement/alignment` owns the slice. The fields are named by who chooses the axis:

- **One-axis alignment** (`AlignInput`: `align`, `stretch`) is for a layout that names the axis. In flex, both mean the cross axis, so a flex that changes direction keeps them.
- **Two-axis alignment** (`Align2dInput`: `alignX`, `alignY`, `stretchX`, `stretchY`) is for a layout that names no axis. Physical names match the physical margins and insets.

Both flavors share one resolve per axis. `resolve(item, defaults)` takes one axis's `{ align, stretch }` and the layout's default, and an omitted or non-finite field inherits (`inherit` is the `Infinity` sentinel). A default that is itself non-finite resolves to `0`, so the result is always finite. `x` and `y` read each axis of the two-axis flavor as one-axis fields. `fields` and `fields2d` are the field tables. Flex resolves against `alignItems`/`stretchItems`, hierarchy against its own, and adornments against `alignAdornments`.

A layout reads one flavor. The model's type index can reject the other flavor on its children, so `align` on a grid child is a type error and never quietly means y. A child that moves from a column flex into a grid renames `align` to `alignX`, and the rename is accurate, because the axis has changed from one the parent chose to a fixed one.

`Box.apply` reads the two-axis flavor. On each axis, the box sits in the room its insets leave (the parent less whichever insets are set). `stretchX` moves the box's unstretched width toward that room, and `alignX` places it in the room left over. An inherited field takes the box's default, which is what `Box.apply` did before:

- The default stretch fills the room unless a size is set, or the ratio sizes the axis from the other one, which something besides this default sizes: a set size, an explicit stretch, or an inset pair. An inset pair always fills, so it ranks above the ratio, and the default fill ranks below it. That is CSS grid's `normal`, which acts as `stretch` except on an item with a preferred aspect ratio.
- The default alignment is `1` when only `right` is set, which anchors the box to `right`, and `0` otherwise.

An explicit stretch fixes its axis, as a flex stretch does, so `Box.make({ aspectRatio: 1, stretchY: 0.5 })` takes half the parent's height and derives its width from it. `Box` has `setAlign` and `setStretch` shorthands for both axes, and a longhand setter for each field.

The CSS names fit less well:

- CSS's `align-self` is the cross axis in flex and the block axis in grid. Without writing modes the block axis is y, so in a grid, `align` would mean y by convention and not by any axis the grid names.
- `justify-self` names the inline axis. Here that is x, which `alignX` already names.
- `place-self` is CSS's shorthand for both axes, and vue's `alignSelf` already uses `place` for the position fraction.

The rejected alternatives are a single `align` that takes a number or an `[x, y]` pair, and an `Align` value module (see Decisions).

Core inputs take longhands. A shorthand that sets both axes, like `place-self: center`, is a vue prop that parses into `alignX` and `alignY`, as `alignSelf` parses into `align` and `stretch`. Core setters offer the same shorthand, as `Box.setAlign` and `Frame.setMargin` do.

## Flat inputs without a god class

A god class fails through behavior: methods and invariants that span unrelated fields, so a change to one concept touches the rest. A bag of inert fields fails differently, if at all. CSS gives every element every property, and the parent's formatting context reads the ones it understands. Structural typing lets each solver declare only its slice, and a wide object satisfies every narrower type it covers, so nothing depends on the whole bag.

```ts
// Each slice module owns its fields, its field table, and its functions.
// placement/sizing:    SizingInput<L>, fields, normalize, resolve
// placement/margin:    MarginInput<L>, fields, normalize
// placement/alignment: AlignInput, Align2dInput, fields, fields2d, inherit, x, y, resolve

// A layout's item input extends its slices, and it stays flat.
interface FrameInput<L extends LengthInput = number>
  extends SizingInput<L>, MarginInput<L>, AlignInput {
  grow?: number
  shrink?: number
}
interface BoxInput<L extends LengthInput = number> extends SizingInput<L>, Align2dInput {
  top?: L
  right?: L
  bottom?: L
  left?: L
}
interface AdornmentInput<L extends LengthInput = number>
  extends SizingInput<L>, MarginInput<L>, Pick<AlignInput, 'align'> {
  at?: number
  position?: number
  layer?: number
  orient?: number
}

Frame.make({ width: 100, marginLeft: 8, grow: 1 }) // still one flat object
```

The inputs use `interface ... extends` rather than intersections, so each field keeps its slice's doc comment on hover. `grow`/`shrink` and the insets stay on their one spec until a second layout reads them. The field kinds (`x`, `y`, `ratio`, `number`) live in `internal/fields.ts`, and each slice module re-exports the `Field` and `FieldTable` types.

The model's field tables in `internal/model/props.ts` are a small property registry. Each names a field's value kind and the axis its percentage resolves against, as a CSS property definition names its value type and percentage basis. Each slice exports its table, and a layout's table is the union of its slices' tables, so checking and resolving stay generic.

The model's node kinds raise the same question one level up. An `item` is a flex child, so the child's kind fixes its parent's layout, and grid and anchor would each add an item kind. A single child props type, the whole bag, would let the parent's kind decide which slices it reads, and a vue component would not need to know its parent's layout. The type index knows each path's parent, so the checker could still reject a field the parent never reads. That rejection matters, because silently ignored properties are the part of CSS not worth copying. This question belongs to the model and waits for the grid design.

## Cost

The three concrete costs are paid off:

- `Frame` has no `id` and no type parameter.
- `Box` and `Frame` read sizing the same way, so the model needs no `NaN` rule.
- `Hierarchy.apply` still documents `grow` and `shrink` as ignored, because `Frame` stays its item input. Adornments, which ignored three fields, now take only the slices they read.

The speculative ones remain. The grid and anchor slices are guesses until those solvers exist. The split did multiply the setters: `Adornment` gained ten sizing setters, seven margin setters, and `setAlign`, which repeat `Frame`'s. A shared setter factory per slice would remove the repetition, at the cost of a pattern the codebase does not have yet.

## Decisions

- **Margin name.** The frame's offsets become `marginTop`, `marginRight`, `marginBottom`, and `marginLeft`, as in CSS, with `setMargin` and its siblings.
- **Hierarchy node keys.** A record, keyed by id.
- **Ratio and stretch.** A stretched size feeds the ratio (see Sizing).
- **Self-alignment names.** Split by flavor: one-axis `align` and `stretch`, two-axis `alignX`, `alignY`, `stretchX`, and `stretchY`, all plain numbers. An `Align` value module, a single `align` field whose value has a one-axis, a two-axis, and perhaps a logical kind, was weighed and set aside. It fits CSS, where `stretch` is an `align-self` value, but no logical case exists without writing modes: the one-axis flavor is already relative to the parent's axis, grid and anchor have physical frames, and anchor's flip fallbacks can mirror physical values inside the solver. It would also make `align` the one nested value in flat inputs, with costs in the model's field table, JSON round trips, and per-channel inherit. A logical flavor can still arrive later as a flavor or value type of its own without renaming these fields.
- **Grow and the ratio.** A grown or shrunk main size derives an unset cross size through the ratio, as CSS lays out an item's hypothetical cross size with its flexed main size. An explicit or stretched cross size wins, and the ratio is not applied again.
- **Box's default alignment.** The `Infinity` inherit sentinel. An omitted two-axis field inherits, and `Box.apply` resolves inherit to its default: stretch unless the ratio sizes the axis, at the start, which is CSS grid's `normal`. A grid will resolve inherit to its container's defaults. No input gains a third sentinel.
- **Adornment shape.** Flat. `AdornmentInput` is the sizing and margin slices and `align` beside `at`, `position`, `layer`, and `orient`, so it drops the `grow`, `shrink`, and `stretch` it never read, and `setFrame` goes.
- **The `L` parameter.** In core: `SizingInput<L = number>` and `MarginInput<L = number>` carry the length type, and the composed inputs pass it through. `make` takes numbers. The model's item props are `FrameInput<LengthInput>`.
- **Classes for specs.** Specs stay classes, and concept slices are input types, field tables, and functions with no class of their own, so composing a layout's input never needs a class per slice. Cost decides nothing between classes and records. On node 26, building a 16-field object takes about 9 ns as a class, 15 ns as an object literal or through `Object.create`, and 31 ns as a frozen literal, and reads cost the same in every shape. At hundreds of specs per solve the gap is microseconds. Classes keep the brand, `.pipe`, and the normalization at construction.
- **Non-finite sizing is unset everywhere.** Settled while building step 3. `Frame` used to read an infinite size as a literal preference and a `NaN` bound literally. It now reads both as unset, as `Box` did, and so does `Adornment`.

## Plan

Each step shipped alone, with tests, docs, and a changeset, and left vue working. Steps 1 to 4 are this pass. Steps 5 and 6 are later work that the pass must not block.

1. **Identity.** Done (`Key hierarchy nodes by id and take the id off Frame`). The unreleased `frame-id` changeset went, and the hierarchy changeset describes the record.
2. **Margin.** Done (`Rename the frame's offsets to margins`).
3. **Sizing.** Done (`Add placement/sizing and resolve every item's size through it`). Vue drops its `NaN`-to-undefined bridge in `internal/frame.ts`.
4. **Self-alignment.** Done in three commits: the margin slice (`placement/margin`, which the flat adornment needed), the alignment slice with `Box`'s two-axis alignment, and the flat adornment.
5. Design the grid item beside the flex item before generalizing the item protocol or the model's kinds. Two layouts' item inputs are the fewest that show where the seams fall.
6. Build anchor positioning on `Box.apply`.

## Back to the model

The model branch rebases onto this pass and changes in these places:

- `internal/model/props.ts` builds its tables from `Sizing.fields`, `Margin.fields`, `Alignment.fields`, and `Alignment.fields2d`, plus `number` rows for `grow`, `shrink`, and the box insets' `x`/`y` rows. The field kinds come from `Sizing.Field` (`x`, `y`, `ratio`, `number`).
- It drops the `none` field kind and the `id` rejection: `FrameInput` has no `id`, and an item's path is its key.
- It drops the `NaN` size rule and its `width`/`height` field kinds. A size that resolves to `NaN` can pass straight to `make`, which reads it as unset in `Box`, `Frame`, and `Adornment` alike.
- Item props take `FrameInput<LengthInput>` with `margin*` fields, and box props take `BoxInput<LengthInput>`, so the model no longer threads `L` itself. PR tkofh/placement#7's `FrameInput<K, L>` becomes `FrameInput<L>`.
- Box props gain `alignX`, `alignY`, `stretchX`, and `stretchY`. A box with none of them behaves as before.
- A hierarchy in the model passes its nodes to `Hierarchy.apply` as a record keyed by path.
- Two behavior changes reach the model's solves: a flex item's aspect ratio now follows its flexed main size and its stretched cross size, and a stretched hierarchy node's ratio follows its stretched size. Snapshot tests on the model branch that combine `aspectRatio` with `grow`, `shrink`, or a stretch will move.
- `placement-model.md` updates its percentage table and design call 1 to the new input names.
- The node kinds question (one child props type, parent decides) is settled with the grid design.
