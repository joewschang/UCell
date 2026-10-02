# Payout workspace browser acceptance

This record covers the local Admin payout workspace only. It is not whole-product browser acceptance and does not assert a Stage-ready environment.

## Observed runtime behavior

- A Finance development role can reach the role-gated payout workspace through the Finance/Governance navigation.
- In local read-only mode, all monetary mutations remain disabled and the page explicitly states that it records external payment outcomes rather than executing a bank transfer.
- When payout/recovery reads fail, counts and amounts render as `—` with an unavailable-data message and an enabled reload action; the UI does not misrepresent unavailable data as zero.
- The narrow `390×844` dark-theme layout keeps labels, fields, disabled controls and the financial-control explanation readable without horizontal clipping. Evidence: `ux-payout-20260929/mobile-dark.png`.

## Automated support

- Admin component suite: 42 files / 157 tests PASS, including unavailable-data/retry and stale-detail action-lock behavior.
- Admin typecheck and production build PASS.

Actual authentication, data-bearing payment workflows, bank transport and whole Admin/Member second-pass browser acceptance remain separate work. No payment, deployment or external data submission occurred.
