FROM ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-api@sha256:6f601725778c23372dc76c108b38bc297f3e42d7f11b51612dbf7646622b025c
COPY patch.cjs verify.cjs manual-payment-review.ts /tmp/manual-receipts/
RUN node /tmp/manual-receipts/patch.cjs && node /tmp/manual-receipts/verify.cjs
COPY patch-directory.cjs verify-directory.cjs formal-review-directory.ts /tmp/ops-directory/
RUN node /tmp/ops-directory/patch-directory.cjs && node /tmp/ops-directory/verify-directory.cjs
COPY report.cjs verify-report.cjs /tmp/ops-reports/
RUN node /tmp/ops-reports/report.cjs /app/apps/api/dist/modules/admin-ops-ready/admin-ops-ready.service.js && node /tmp/ops-reports/verify-report.cjs
COPY patch-payout-verification.cjs compensation-audit-runner.ts /tmp/ops-payouts/
RUN node /tmp/ops-payouts/patch-payout-verification.cjs
