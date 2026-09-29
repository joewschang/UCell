# Controlled Finance review download

New exports persist deterministic UTF-8 CSV bytes and their SHA-256 in a V2 artifact. The file contains business member/qualification references, period, export reference, gross payable, Recovery offset and net amount. It contains no internal source UUIDs or banking account fields. CSV cells neutralize formula prefixes. This is a human-readable Finance review artifact, not an approved bank-import layout and not evidence that money was transferred.

Finance/Super Admin can download a specific batch revision through an authenticated audited POST. The server verifies scope, revision, snapshot reconciliation and stored content hash before returning bytes. The browser verifies the UTF-8 checksum before creating a local download. Ordinary detail reads expose artifact metadata and per-line payment-result history, not raw artifact source snapshots. Repeated download retains identical bytes after a holder/master change and records each authorized access.

Legacy V1 artifacts retain their original JSON content hash. A legacy download reconstructs the original known field order to verify that hash, then renders CSV solely from that stored snapshot; the response distinguishes original artifact hash from rendered file hash. Unknown/corrupt legacy artifacts fail closed. Migration 111 freezes existing artifacts in place without regenerating their contents.

Validation completed before full recertification:

- Artifact/reconciliation isolated regression: 3 suites / 12 tests PASS, fresh 0→111, 162 baseline assertions and cleanup.
- Authenticated HTTP download: 1 suite / 2 tests PASS for Finance RBAC, invalid/foreign revision, exact safe bytes and audit metadata.
- 110→111 upgrade Golden preserves historical artifact and related payout evidence, rejects subsequent artifact mutation/deletion and passes cleanup.
- Database Golden, API build and schema/migration preflights PASS.
- Admin typecheck/build and 42 files / 155 tests PASS, including browser checksum validation, revision-scoped Finance download, workflow labels and recovery inputs.

Final pinned OpenAPI governance PASS with full isolated **156 suites / 1167 tests**, fresh **0→111 migrations**, **162 baseline assertions** and cleanup PASS. Actual bank layouts/credentials, governed replacement revision flow, legacy whole-batch payment evidence and actual-browser acceptance remain open. No Stage/Production deployment or bank transfer occurred; Stage RC is NOT READY.
