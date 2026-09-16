# Visual regression references

Six states: Member Dashboard/Organization/Bonus, Admin Dashboard/Person-Qualification/Bonus-Settlement. Four viewports each, 24 PNGs. Metadata references/results.json stores source commit and fixture class. Member fixture EXPLICIT_MOCK_VISUAL_ONLY; Admin fixture ISOLATED_ADMIN_DEV_HTTP_READS. No financial facts written by harness. Successful screenshot review is a baseline, not a pixel-difference regression gate yet. Image diff threshold and approved baseline updates remain staged.

Run: node governance/ux/visual-review.mjs, with isolated local Admin/API and explicit Member mock visual server. Default browser msedge. Existing connected HTTP/DB tests independently protect actual API authorization and monetary semantics.

## UX-2 refinement

UX-2 captures preserved separately in ux2/references: six states x four viewports, fixture type and source commit in results.json. Member mock visual ONLY; Admin isolated real reads. Ten owned-Qualification tabs and navy/timeline loaded-state checks enforced. Awaiting second SA Visual Review.

## UX-3 freeze and rollout

UX-3: 26 additional route reference screenshots in ux3/references; source checkpoint e90d740. Member visual fixture is MOCK ONLY; Admin is isolated Connected DEV reads.
