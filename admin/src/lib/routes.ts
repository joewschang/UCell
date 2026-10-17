import {uiText} from "../../../shared/design-system/i18n";
/**
 * Curated UI reference captured during the Issue #2 Phase 1 audit.
 *
 * This is intentionally not generated or fetched at runtime. The backend
 * OpenAPI artifact remains the API contract source of truth, while this list
 * supports human-readable navigation on the System page.
 */
export const backendRouteSnapshot = {
  asOf: '2026-09-18',
  source: 'Issue #2 Phase 1 manual inventory',
  authoritativeSource: 'backend/openapi.generated.json',
  scope: 'Selected Admin and health operations used by the Admin UI',
  knownOpenApiPathCountAtAudit: 123,
  knownOpenApiOperationCountAtAudit: 134,
} as const;

export const backendRoutes=[
  {
    "method": "GET",
    "path": "/health",
    "label": uiText("Health")
  },
  {
    "method": "GET",
    "path": "/admin/persons",
    "label": uiText("List persons")
  },
  {
    "method": "POST",
    "path": "/admin/persons",
    "label": uiText("Create person")
  },
  {
    "method": "GET",
    "path": "/admin/persons/:personId",
    "label": uiText("Get person")
  },
  {
    "method": "POST",
    "path": "/admin/membership-applications",
    "label": uiText("Create application")
  },
  {
    "method": "GET",
    "path": "/admin/membership-applications/:id",
    "label": uiText("Get application")
  },
  {
    "method": "POST",
    "path": "/admin/membership-applications/:id/submit",
    "label": uiText("Submit application")
  },
  {
    "method": "POST",
    "path": "/admin/membership-applications/:id/approve",
    "label": uiText("Approve application")
  },
  {
    "method": "POST",
    "path": "/admin/qualifications",
    "label": uiText("Create qualification")
  },
  {
    "method": "GET",
    "path": "/admin/qualifications/:qualificationId",
    "label": uiText("Get qualification")
  },
  {
    "method": "GET",
    "path": "/admin/qualifications/:qualificationId/active/at",
    "label": uiText("Check active")
  },
  {
    "method": "POST",
    "path": "/admin/qualifications/:qualificationId/active/periods",
    "label": uiText("Create active period")
  },
  {
    "method": "POST",
    "path": "/admin/organization/binary-placement",
    "label": uiText("Place in binary")
  },
  {
    "method": "GET",
    "path": "/admin/products",
    "label": uiText("List products")
  },
  {
    "method": "POST",
    "path": "/admin/products",
    "label": uiText("Create product")
  },
  {
    "method": "POST",
    "path": "/admin/orders",
    "label": uiText("Create order")
  },
  {
    "method": "GET",
    "path": "/admin/orders/:orderId",
    "label": uiText("Get order")
  },
  {
    "method": "POST",
    "path": "/admin/orders/:orderId/payment-confirmations",
    "label": uiText("Confirm payment")
  },
  {
    "method": "POST",
    "path": "/admin/orders/:orderId/returns",
    "label": uiText("Create return")
  },
  {
    "method": "POST",
    "path": "/admin/orders/:orderId/returns/:returnCaseId/process-reversal",
    "label": uiText("Process reversal")
  },
  {
    "method": "GET",
    "path": "/admin/subscriptions/plans",
    "label": uiText("List subscription plans")
  },
  {
    "method": "POST",
    "path": "/admin/subscriptions",
    "label": uiText("Create subscription")
  },
  {
    "method": "GET",
    "path": "/admin/subscriptions/:id",
    "label": uiText("Get subscription")
  },
  {
    "method": "POST",
    "path": "/admin/subscriptions/:id/cancel",
    "label": uiText("Cancel subscription")
  },
  {
    "method": "GET",
    "path": "/admin/qualifications/:qualificationId/ledger/pv",
    "label": uiText("PV ledger")
  },
  {
    "method": "GET",
    "path": "/admin/qualifications/:qualificationId/ledger/balances",
    "label": uiText("Ledger balances")
  },
  {
    "method": "GET",
    "path": "/admin/bonus/qualifications/:qualificationId/awards",
    "label": uiText("Bonus awards")
  },
  {
    "method": "POST",
    "path": "/admin/bonus/settlements/referral",
    "label": uiText("Referral settlement")
  },
  {
    "method": "POST",
    "path": "/admin/bonus/settlements/binary",
    "label": uiText("Binary settlement")
  },
  {
    "method": "POST",
    "path": "/admin/bonus/settlements/matching",
    "label": uiText("Matching settlement")
  },
  {
    "method": "POST",
    "path": "/admin/bonus/lifecycle/mature",
    "label": uiText("Mature awards")
  },
  {
    "method": "POST",
    "path": "/admin/epv/orders/:orderId/recognize",
    "label": uiText("Recognize EPV")
  },
  {
    "method": "POST",
    "path": "/admin/rpv/recognitions/:recognitionId/run",
    "label": uiText("Run RPV")
  },
  {
    "method": "GET",
    "path": "/admin/rpv/recognitions/:recognitionId/awards",
    "label": uiText("RPV awards")
  },
  {
    "method": "POST",
    "path": "/admin/pools/global/settle",
    "label": uiText("Settle global pool")
  },
  {
    "method": "POST",
    "path": "/admin/pools/welfare/accrue",
    "label": uiText("Accrue welfare pool")
  },
  {
    "method": "POST",
    "path": "/admin/settlement-adjustments/requests/:id/prepare",
    "label": uiText("Prepare adjustment")
  },
  {
    "method": "POST",
    "path": "/admin/settlement-adjustments/requests/:id/calculate-and-post",
    "label": uiText("Calculate/post adjustment")
  },
  {
    "method": "POST",
    "path": "/admin/replays/returns/:returnCaseId",
    "label": uiText("Carry-chain replay")
  },
  {
    "method": "POST",
    "path": "/admin/qualification-workflows",
    "label": uiText("Submit workflow")
  },
  {
    "method": "POST",
    "path": "/admin/qualification-workflows/:id/approve",
    "label": uiText("Approve workflow")
  },
  {
    "method": "POST",
    "path": "/admin/payouts/materialize",
    "label": uiText("Materialize payable")
  },
  {
    "method": "POST",
    "path": "/admin/payouts/batches",
    "label": uiText("Create payout batch")
  },
  {
    "method": "GET",
    "path": "/admin/dashboard/summary",
    "label": uiText("Dashboard summary")
  },
  {
    "method": "GET",
    "path": "/admin/membership-applications",
    "label": uiText("Application queue")
  },
  {
    "method": "GET",
    "path": "/admin/qualifications",
    "label": uiText("Qualification search")
  },
  {
    "method": "GET",
    "path": "/admin/orders",
    "label": uiText("Order search")
  },
  {
    "method": "GET",
    "path": "/admin/organization/placement-preview",
    "label": uiText("Placement preview")
  },
  {
    "method": "GET",
    "path": "/admin/observability/organization/sponsor-tree/:rootQualificationId",
    "label": uiText("Sponsor tree")
  },
  {
    "method": "GET",
    "path": "/admin/observability/organization/binary-tree/:rootQualificationId",
    "label": uiText("Binary tree")
  },
  {
    "method": "GET",
    "path": "/admin/observability/qualifications/:qualificationId/operations",
    "label": uiText("Qualification operations")
  },
  {
    "method": "GET",
    "path": "/admin/observability/awards/:bonusAwardId",
    "label": uiText("Award drill-down")
  },
  {
    "method": "GET",
    "path": "/admin/observability/settlements",
    "label": uiText("Settlement history")
  },
  {
    "method": "GET",
    "path": "/admin/observability/pools",
    "label": uiText("Pool history")
  },
  {
    "method": "GET",
    "path": "/admin/observability/compensation/summary",
    "label": uiText("Compensation summary")
  },
  {
    "method": "GET",
    "path": "/admin/operations/returns",
    "label": uiText("Return queue")
  },
  {
    "method": "GET",
    "path": "/admin/operations/returns/:id",
    "label": uiText("Return detail")
  },
  {
    "method": "GET",
    "path": "/admin/operations/workflows",
    "label": uiText("Workflow queue")
  },
  {
    "method": "GET",
    "path": "/admin/operations/workflows/:id",
    "label": uiText("Workflow detail")
  },
  {
    "method": "GET",
    "path": "/admin/operations/recoveries",
    "label": uiText("Recovery aging")
  },
  {
    "method": "GET",
    "path": "/admin/operations/payout-batches",
    "label": uiText("Payout queue")
  },
  {
    "method": "GET",
    "path": "/admin/operations/payout-batches/:id",
    "label": uiText("Payout detail")
  },
  {
    "method": "POST",
    "path": "/admin/operations/payout-batches/:id/approvals/:stage",
    "label": uiText("Payout dual approval")
  },
  {
    "method": "POST",
    "path": "/admin/operations/payout-batches/:id/export",
    "label": uiText("Payout export record")
  },
  {
    "method": "POST",
    "path": "/admin/operations/payout-batches/:id/mark-paid",
    "label": uiText("Payout reconciliation")
  },
  {
    "method": "POST",
    "path": "/admin/ops-ready/attachments",
    "label": uiText("Register attachment metadata")
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/attachments",
    "label": uiText("List attachments")
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/audit-events",
    "label": uiText("Audit search")
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/reports/operations",
    "label": uiText("Operations report")
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/integrity-alerts",
    "label": uiText("Integrity alerts")
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/exports/:dataset",
    "label": uiText("CSV export")
  },
  {
    "method": "POST",
    "path": "/auth/admin/entra/exchange",
    "label": uiText("Admin Entra exchange")
  },
  {
    "method": "GET",
    "path": "/auth/admin/me",
    "label": uiText("Admin session me")
  },
  {
    "method": "POST",
    "path": "/auth/admin/logout",
    "label": uiText("Admin logout")
  }
] as const;
