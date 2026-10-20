---
'placement': patch
---

`Connector.apply` now weighs how full a channel between rects is when it
searches for routes. Each route takes its stroke and the `gap` of the
room across the channels it runs through, and the routes of a merge take
it as one bundle, their lanes a `mergeGap` apart, as far as they run
together out of their shared port. A channel too narrow
for the routes in it makes each unit of length through it cost more by
how many routes it is over by, while a channel that only one route or one
merge runs through never costs more, however narrow. Over a few rounds,
pressing harder each time, the search then moves routes out of such
channels, first the route that gains the most, so the route with the
cheapest other way leaves a channel too narrow for it, and a route
without one stays and is squeezed as before. The price rises smoothly as
a channel narrows, so a route never jumps away over a pixel of room. An
end with an auto side weighs the same price, so it comes in on a side
whose approach has room when that costs less than squeezing through a
full channel. Layouts whose channels all have room route as they did.
