# Mall cart release — 2026-10-23

- API revision: `ucell-prod-api--mall-cart-20261023`; image digest `sha256:3615a207755c11f37d8d30bfcc717e948aae3e5515fe4a6bd868f9cc64c7cccf`.
- Member revision: `ucell-prod-member--mall-cart-20261023`; image digest `sha256:738f466b6c33ee3539c9c7222d4f1e5c33d54eda76391e1da39103a9998d644a`.
- Main products use quantities 0–99, combined order, explicit payment selection and address confirmation. Every catalog card has sharing access; qualified product links retain existing referral short-link service. General/package links identify SKU/category and do not claim referral attribution.
- New optional checkout metadata is validated and stored in each order line's rule profile snapshot, referencing the encrypted/versioned delivery profile. Creating an order does not create a payment event. Existing clients without checkout metadata remain compatible.
- Source and live compiled baseline differ due to earlier production fixes. API release overlays ONLY the checkout helper, nested checkout DTO, forwarding and snapshot insertion onto the pinned prior live API image. `prepare-overlay.cjs` asserts each anchor appears exactly once; all other live order/payment/enrollment behavior is retained. No database migration.
- Production frontend built with `build-production-web.ps1 -App member -AssetsOnly`, preserving existing public assets. Public index serves `index-ly2Ricvx.js`; cart text, production API, LINE LIFF and Google client identifiers verified. Product image HTTP 200.
- Member focused tests: 15 passed (cart, product intent, retail orders, localization). Backend checkout tests: 3 passed. TypeScript/Nest build passed.
- Browser QA: mobile 390px and desktop 1440px; quantity 2+1, sharing link, disabled incomplete checkout, one combined POST after confirmation, receipt, no horizontal overflow or browser errors. Mocked responses; no real orders.
- Live rollback QA passed for both network and qualified members: two product lines, correct total, checkout snapshots, no payment created, stale price and stale address rejected. Transaction rolled back, including temporary delivery profiles. No notifications sent. Initial QA had no existing delivery profiles; the checked-in script adds transaction-only fixtures when absent.
- Live DTO validation passed with whitelist enabled; checkout survives transformation; invalid payment method rejected.
- Screenshots retained outside Git at `C:/UCell/mall-cart-20261023/`.
