---
'placement': patch
---

`Connector.apply` also tries moving a node's whole ingress or egress to
another side: the auto ends of the edges that enter the node, or of those
that leave it, held together to one side while the rest stay auto. It
keeps the layout that scores best, as it does for the orders it routes
in. Routes that draw best leaving a node together by a side none of them
would take alone, because each gains nothing by moving there on its own,
now take that side.
