---
'placement': patch
---

`Connector.apply` keeps two more promises about the routes it draws. A
route whose port leg runs between the lanes of another edge's merge, which
hold still as the leg does, still steps past those lanes, but now it holds
the leg straight out of its port until a gap and the reach of the step's
corners short of them, comes back toward the port only as far as the
routes beside the step need, and never crosses a rect or a merge's whisks.
Before, the step came right where the leg left the rect around its port,
where it could pass through the whisks of a merge on the same side and
pull the rest of the route around them. And a port that slides to take
out a short jog no longer leaves a kink. A jog a little longer than half of
what its corners need slides only part of the way, so the slide never jumps
as the jog grows, and the residue it leaves could be a fraction of a pixel
drawn as two tiny upright corners when another route of the same merge ran
beside it. A jog shorter than the `gap` now slants into an S even beside
such a route, since the S strays off its legs no farther than the upright
corners would.
