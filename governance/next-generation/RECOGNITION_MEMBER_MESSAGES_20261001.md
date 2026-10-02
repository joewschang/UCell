# Repurchase recognition personal messages — local implementation increment

Authority: §33 MSG-1 requires personal recognition notices; UCell remains the economic and identity source. This change adds no LINE delivery or deployment.

Both actual RpvService API recognition and Worker processRecognition append a qualification-scoped personal message in their existing Serializable economic transaction, after the PV posting, sealed RPV replay source and RECOGNIZED schedule are saved. The shared producer checks the original schedule/PV/seal identity, volume, time and rule version, rejects missing/future recognized timestamps, locks the qualification, and routes only MEMBER_ORIGIN qualifications with a current holder. Message identity is unique per recognition. Re-delivery preserves the original recipient; it does not retarget an old message following transfer.

The fixed Traditional Chinese template includes public qualification number, installment and month with a safe /repurchase link and hashed business reference. It contains no economic amounts, private source IDs, Active inference or award/payment promise. Existing person and qualification-history access checks remain mandatory. Existing already-recognized writer replays do not backfill missing historical messages.

Focused isolated proof: four suites / 29 tests PASS; 126 migrations, 162 baseline assertions and cleanup PASS. Actual API and Worker writes are retried and retain one notice; personal-only reads exclude the qualification notice, authorized qualification reads include it without UUID disclosure, no LINE delivery is created, and holder transfer preserves the original notice while denying foreign access. A conflicting notice binding rolls back the recognition schedule, PV, awards and seal atomically. Existing partial-return/replay/payout/lineage tests remain passing. Initial fixture failures lacked holder-history records; those fixtures were corrected without weakening production authorization. Failed logs remain preserved.

Database, API and Worker builds PASS. Full API/OpenAPI runner terminal PASS: 185 suites / 1,339 tests, 126 migrations, 162 baseline assertions, cleanup PASS, fixed oasdiff 1.32.1 and unchanged approved baseline/artifact. Four tests from the concurrently edited LINE binding work were included during execution. This is not frozen whole-working-tree recertification; the recognition source hashes were rechecked unchanged. Five Growth/timing artifact tests PASS. No schema or migration change.

Evidence logs: C:/UCell/logs/cr-batch-recognition-message-focused.log (failed fixture attempt), cr-batch-recognition-message-focused-fixed.log (PASS), cr-batch-recognition-message-{db,api,worker}-build-final.log, cr-batch-recognition-message-full-gate.log.

Remaining scope: other required business-domain message producers and source routing/privacy/browser acceptance; Compensation overall business-stage duration history; broader Operations/Member360 integration; Learning/Event/Growth and full UX acceptance. This bounded increment does not close the full batch.

LOCAL_IMPLEMENTATION = IN_PROGRESS
FULL_ISOLATED_RECERTIFICATION = IN_PROGRESS
STAGE_RC = NOT_READY
