# Bank-native payout workbook exports

Source: user-supplied `整批匯款、中心轉帳範本.zip`, received 2026-10-08.
The two original `.xls` files are retained under the API's `bank-templates` assets.
This is a file-generation adapter, not a bank transfer integration.

## Workflow

1. Complete the existing independent Finance and Compliance approvals.
2. Generate the existing finance-review export. The batch must be EXPORTED and
   have no payment result recorded before a new bank file may be created.
3. On the Admin payout detail, select the bank format, supply an export reference
   and the verified recipient name/account for every positive-net payout line.
4. Create/download the XLS, review it in Excel, and submit through the bank's
   approved channel. No automatic email or bank submission is performed.
5. Record the external bank result using the existing reconciliation workflow.

API: `POST /api/v1/admin/operations/payout-batches/:id/bank-exports`.
Input contains `format`, `exportReference` and `recipients` keyed by payoutLineId.
Amounts are taken from stored payout lines, never accepted from the browser.
The adapter rejects sub-cent precision rather than rounding the ledger amount.
Zero-net lines are excluded; every positive-net line must be mapped exactly once.

Exports use append-only PayoutExportArtifact snapshots and increasing revisions.
An identical export reference/request returns the same bytes; a changed request
using the same reference is rejected. No batch payment status is changed.
Only one bank submission artifact is created per batch. A fresh reference cannot
silently issue a replacement; subsequent operations download the stored version.
Historical download uses the same role-protected, audited download endpoint as
review CSVs. The browser verifies SHA-256 before saving the binary XLS.
Full account numbers are in the restricted XLS snapshot, not the audit payload.

## Bank rules

Bulk remittance: original four sheets retained; 4-character ASCII reference;
recipient name/remark up to 40 characters; bank+branch exactly 7 digits; account
digits up to 14, left-padded to 14. Maximum 999 data rows in supplied template.
Under the supplied 800,000 limit, each transfer's supplied fee table gives NT$30.
Pending bank clarification, the entire batch including fees is capped at NT$800,000.

Center transfer: original sheets retained; name required; full account exactly
16 digits (never inferred from a 14-digit interbank account); bonus credit uses
service category 74, debit 0 and credit equal to payout net. Optional Chinese
remark up to 5 characters. This release supports the template's 31 data rows;
larger batches fail explicitly and are not silently truncated or split.

BIFF8 input/output cell records are patched within the original workbook;
format records, unrelated formulas and non-workbook CFB streams are preserved.
Optional row indexes are removed for Excel to rebuild on save.
No dependency on Windows Excel is required at runtime. Native Excel was used
only to independently verify generated test workbooks and render their layouts.

## Validation

Synthetic test-only workbooks were read independently with xlrd, then opened
with macros disabled in native Excel and exported to PDF without repair.
Verified account leading zeros, sheet names, fields, totals and layout.
Bank acceptance testing and confirmation of whether the 800,000 limit applies
per transfer or per batch remain external acceptance items.
