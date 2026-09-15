export const backendRoutes=[
  {
    "method": "GET",
    "path": "/health",
    "label": "Health"
  },
  {
    "method": "GET",
    "path": "/admin/persons",
    "label": "List persons"
  },
  {
    "method": "POST",
    "path": "/admin/persons",
    "label": "Create person"
  },
  {
    "method": "GET",
    "path": "/admin/persons/:personId",
    "label": "Get person"
  },
  {
    "method": "POST",
    "path": "/admin/membership-applications",
    "label": "Create application"
  },
  {
    "method": "GET",
    "path": "/admin/membership-applications/:id",
    "label": "Get application"
  },
  {
    "method": "POST",
    "path": "/admin/membership-applications/:id/submit",
    "label": "Submit application"
  },
  {
    "method": "POST",
    "path": "/admin/membership-applications/:id/approve",
    "label": "Approve application"
  },
  {
    "method": "POST",
    "path": "/admin/qualifications",
    "label": "Create qualification"
  },
  {
    "method": "GET",
    "path": "/admin/qualifications/:qualificationId",
    "label": "Get qualification"
  },
  {
    "method": "GET",
    "path": "/admin/qualifications/:qualificationId/active/at",
    "label": "Check active"
  },
  {
    "method": "POST",
    "path": "/admin/qualifications/:qualificationId/active/periods",
    "label": "Create active period"
  },
  {
    "method": "POST",
    "path": "/admin/organization/binary-placement",
    "label": "Place in binary"
  },
  {
    "method": "GET",
    "path": "/admin/products",
    "label": "List products"
  },
  {
    "method": "POST",
    "path": "/admin/products",
    "label": "Create product"
  },
  {
    "method": "POST",
    "path": "/admin/orders",
    "label": "Create order"
  },
  {
    "method": "GET",
    "path": "/admin/orders/:orderId",
    "label": "Get order"
  },
  {
    "method": "POST",
    "path": "/admin/orders/:orderId/payment-confirmations",
    "label": "Confirm payment"
  },
  {
    "method": "POST",
    "path": "/admin/orders/:orderId/returns",
    "label": "Create return"
  },
  {
    "method": "POST",
    "path": "/admin/orders/:orderId/returns/:returnCaseId/process-reversal",
    "label": "Process reversal"
  },
  {
    "method": "GET",
    "path": "/admin/subscriptions/plans",
    "label": "List subscription plans"
  },
  {
    "method": "POST",
    "path": "/admin/subscriptions",
    "label": "Create subscription"
  },
  {
    "method": "GET",
    "path": "/admin/subscriptions/:id",
    "label": "Get subscription"
  },
  {
    "method": "POST",
    "path": "/admin/subscriptions/:id/cancel",
    "label": "Cancel subscription"
  },
  {
    "method": "GET",
    "path": "/admin/qualifications/:qualificationId/ledger/pv",
    "label": "PV ledger"
  },
  {
    "method": "GET",
    "path": "/admin/qualifications/:qualificationId/ledger/balances",
    "label": "Ledger balances"
  },
  {
    "method": "GET",
    "path": "/admin/bonus/qualifications/:qualificationId/awards",
    "label": "Bonus awards"
  },
  {
    "method": "POST",
    "path": "/admin/bonus/settlements/referral",
    "label": "Referral settlement"
  },
  {
    "method": "POST",
    "path": "/admin/bonus/settlements/binary",
    "label": "Binary settlement"
  },
  {
    "method": "POST",
    "path": "/admin/bonus/settlements/matching",
    "label": "Matching settlement"
  },
  {
    "method": "POST",
    "path": "/admin/bonus/lifecycle/mature",
    "label": "Mature awards"
  },
  {
    "method": "POST",
    "path": "/admin/epv/orders/:orderId/recognize",
    "label": "Recognize EPV"
  },
  {
    "method": "POST",
    "path": "/admin/rpv/recognitions/:recognitionId/run",
    "label": "Run RPV"
  },
  {
    "method": "GET",
    "path": "/admin/rpv/recognitions/:recognitionId/awards",
    "label": "RPV awards"
  },
  {
    "method": "POST",
    "path": "/admin/pools/global/settle",
    "label": "Settle global pool"
  },
  {
    "method": "POST",
    "path": "/admin/pools/welfare/accrue",
    "label": "Accrue welfare pool"
  },
  {
    "method": "POST",
    "path": "/admin/settlement-adjustments/requests/:id/prepare",
    "label": "Prepare adjustment"
  },
  {
    "method": "POST",
    "path": "/admin/settlement-adjustments/requests/:id/calculate-and-post",
    "label": "Calculate/post adjustment"
  },
  {
    "method": "POST",
    "path": "/admin/replays/returns/:returnCaseId",
    "label": "Carry-chain replay"
  },
  {
    "method": "POST",
    "path": "/admin/qualification-workflows",
    "label": "Submit workflow"
  },
  {
    "method": "POST",
    "path": "/admin/qualification-workflows/:id/approve",
    "label": "Approve workflow"
  },
  {
    "method": "POST",
    "path": "/admin/payouts/materialize",
    "label": "Materialize payable"
  },
  {
    "method": "POST",
    "path": "/admin/payouts/batches",
    "label": "Create payout batch"
  },
  {
    "method": "GET",
    "path": "/admin/dashboard/summary",
    "label": "Dashboard summary"
  },
  {
    "method": "GET",
    "path": "/admin/membership-applications",
    "label": "Application queue"
  },
  {
    "method": "GET",
    "path": "/admin/qualifications",
    "label": "Qualification search"
  },
  {
    "method": "GET",
    "path": "/admin/orders",
    "label": "Order search"
  },
  {
    "method": "GET",
    "path": "/admin/organization/placement-preview",
    "label": "Placement preview"
  },
  {
    "method": "GET",
    "path": "/admin/observability/organization/sponsor-tree/:rootQualificationId",
    "label": "Sponsor tree"
  },
  {
    "method": "GET",
    "path": "/admin/observability/organization/binary-tree/:rootQualificationId",
    "label": "Binary tree"
  },
  {
    "method": "GET",
    "path": "/admin/observability/qualifications/:qualificationId/operations",
    "label": "Qualification operations"
  },
  {
    "method": "GET",
    "path": "/admin/observability/awards/:bonusAwardId",
    "label": "Award drill-down"
  },
  {
    "method": "GET",
    "path": "/admin/observability/settlements",
    "label": "Settlement history"
  },
  {
    "method": "GET",
    "path": "/admin/observability/pools",
    "label": "Pool history"
  },
  {
    "method": "GET",
    "path": "/admin/observability/compensation/summary",
    "label": "Compensation summary"
  },
  {
    "method": "GET",
    "path": "/admin/operations/returns",
    "label": "Return queue"
  },
  {
    "method": "GET",
    "path": "/admin/operations/returns/:id",
    "label": "Return detail"
  },
  {
    "method": "GET",
    "path": "/admin/operations/workflows",
    "label": "Workflow queue"
  },
  {
    "method": "GET",
    "path": "/admin/operations/workflows/:id",
    "label": "Workflow detail"
  },
  {
    "method": "GET",
    "path": "/admin/operations/recoveries",
    "label": "Recovery aging"
  },
  {
    "method": "GET",
    "path": "/admin/operations/payout-batches",
    "label": "Payout queue"
  },
  {
    "method": "GET",
    "path": "/admin/operations/payout-batches/:id",
    "label": "Payout detail"
  },
  {
    "method": "POST",
    "path": "/admin/operations/payout-batches/:id/approvals/:stage",
    "label": "Payout dual approval"
  },
  {
    "method": "POST",
    "path": "/admin/operations/payout-batches/:id/export",
    "label": "Payout export record"
  },
  {
    "method": "POST",
    "path": "/admin/operations/payout-batches/:id/mark-paid",
    "label": "Payout reconciliation"
  },
  {
    "method": "POST",
    "path": "/admin/ops-ready/attachments",
    "label": "Register attachment metadata"
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/attachments",
    "label": "List attachments"
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/audit-events",
    "label": "Audit search"
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/reports/operations",
    "label": "Operations report"
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/integrity-alerts",
    "label": "Integrity alerts"
  },
  {
    "method": "GET",
    "path": "/admin/ops-ready/exports/:dataset",
    "label": "CSV export"
  },
  {
    "method": "POST",
    "path": "/auth/admin/entra/exchange",
    "label": "Admin Entra exchange"
  },
  {
    "method": "GET",
    "path": "/auth/admin/me",
    "label": "Admin session me"
  },
  {
    "method": "POST",
    "path": "/auth/admin/logout",
    "label": "Admin logout"
  }
] as const;
