# My Growth repurchase recognition — local increment, 2026-10-01

The Growth read now includes stored MonthlyRecognitionSchedule facts for the authenticated person's currently held Qualifications. This is a read-only Repeatable Read projection. It includes cancelled/completed schemes, separates scheme status from installment status, and returns all-record status counts independently of its deterministic 100-row preview. Public qualification numbers and decimal strings are retained; Person, Qualification, Subscription and Recognition UUIDs are not returned.

Counts mean persisted schedule statuses, not independently recertified economic outcomes. Amount and RPV are stored schedule values, not payable amounts, original immutable economic snapshots, or browser-calculated recognition. RECOGNIZED rows missing a timestamp or dated after the response asOf are marked UNAVAILABLE; the UI displays a confirmation-needed label. The projection does not recreate historical entry times or infer recognition from ACTIVE.

Verification: isolated Growth DB/HTTP suite covers owner/foreign scope, no-qualification access, anonymous/forged-scope rejection, historical cancelled scheme, all five status buckets, 105 rows versus 100 preview, decimal precision, missing/future recognizedAt and no writes during read. The new fixture is synthetic projection testing, not proof of actual recognition-writer or §36 return execution; those economic matrices are separate evidence. Member rendering test covers cancelled scheme labels, exact schedule amounts and unavailable time. API build and Member production build pass. Exact log results/hashes are recorded in evidence/growth-recognition-20261001.json after the runner completes.

No migration, economic command, Stage/Production deployment or baseline change. This increment does not claim new actual-browser/theme/accessibility acceptance or a complete typed OpenAPI Growth output; both remain in the full Growth/UX queue. Full API recertification from the preceding checkpoint does not certify this newer source.

R1.0B_CR_BATCH_01_LOCAL_IMPLEMENTATION = IN_PROGRESS
FULL_ISOLATED_RECERTIFICATION = IN_PROGRESS
STAGE_RC = NOT_READY
