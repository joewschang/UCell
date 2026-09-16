# Accessibility matrix

| Check | Evidence / status |
|---|---|
| Shared normal text/status color contrast >=4.5:1 | Automated token luminance test PASS |
| Status text independent of color | StatusBadge SSR test PASS |
| Member qualification label, live confirmed feedback | Existing label tests plus browser verification |
| Pending versus finalized zero | Design-system and existing Member tests PASS |
| Native modal name, Tab containment, Escape | visual-review.mjs browser assertions; see references/results.json |
| Member bottom navigation >=44px touch targets | visual-review.mjs browser assertions |
| Reduced motion | Shared utility honors prefers-reduced-motion |
| Existing form labels | Preserved; full form audit pending |
| Full WCAG AA / screen reader / high-risk command audit | PENDING; basic checks do not imply full conformance |
| Formal LIFF accessibility | OPERATIONAL CREDENTIAL PENDING |

Initial browser focus containment failed; explicit dialog Tab wrapping added and dependency cache refreshed before rerun. No tests weakened.

## UX-2 refinement

UX-2 focused checks PASS: modal forward/reverse Tab containment, Escape/focus restoration, roving Qualification tabs, labels, text-based status, >=44px bottom navigation, white/navy surface loading. Full WCAG/screen-reader and actual LIFF devices remain pending.

## UX-3 freeze and rollout

UX-3: 26 routes pass named-control, main-landmark, page-heading and textual-status automation. Search labels repaired. Complete screen-reader/manual WCAG and actual LIFF device checks remain pending.
