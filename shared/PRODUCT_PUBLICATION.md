# UCell primary products and official brand source

Source: user-supplied `5FF151E4-EFA9-4FE5-AFEF-254C84179928.PNG`.
The original bytes are preserved in `brand/ucell-products.png`. CSS viewports
display its logo and packaging areas; no logo redraw or generated packaging is
used. The original artwork has an ivory background, retained in the logo badge.

`products.json` contains five products: TIP-777 肽時光膠原飲, TIP-696 活力芯,
TIP-999 禦力源, TIP-580 淨衡順, TIP-363 晶萃源力飲. Each is NT$4,800/box and
PV 2,880. These values are transcribed from the source, not calculated by the UI.
BV, GPV, inventory, pack quantities, ingredients and benefit claims are not inferred.

## Implemented
- Member demo catalog uses all five approved names/prices/PV and original photos.
  Demo-prefixed IDs and existing demo-order restrictions remain explicit.
- Admin product page shows the approved source catalog separately from backend
  records. A button prefills SKU/name/price only; GPV must be explicitly supplied
  from approved rules before the existing reference-save operation.
- Member header and footer, Admin shell and login use the supplied gold logo.
- Real Member catalog still comes exclusively from its API; there is no hardcoded
  fallback or automatic photo matching by name/unknown backend product ID.

## Formal publication remains blocked
No deployed backend URL, authenticated session or production database connection
is configured in this checkout. The current product endpoint writes a GPV rule
profile and has no independent PV field. These changes do not claim database
publication, inventory availability, live checkout or deployment. A backend PV
mapping/write contract and target environment are required to complete that step.
The user authorized publication, so do not request the same permission again;
resolve the missing contract/access rather than fabricating a successful upload.
