# G8 source recovery execution attempt — 2026-09-26

**Status:** `BLOCKED_STORAGE_PERMISSION`
**Scope:** independent source archive only; no Stage or Production resource was changed.

## Local evidence retained

| Check | Result |
|---|---|
| Source baseline | `e3c954b1c256b87ffe575cc7f3ad9eaabe2bc07e` |
| Full-ref Git bundle | PASS — 17 refs, complete history reported by `git bundle verify` |
| Bundle SHA-256 | `6ea6f5e89b72b394532dd022f86e56aebc1757a2b5afca98661b3ee2d22ff823` |
| Isolated bare restore | PASS — `git clone --mirror` and `git fsck --no-dangling` |
| Restored integration head | `e3c954b1c256b87ffe575cc7f3ad9eaabe2bc07e` |

## Independent-storage attempt

The approved private destination was Azure Storage account `ucellst5mafbbsq33mgu`, container `ucell-source-recovery`. Azure AD data-plane container enumeration succeeded, but both governed uploads were rejected by Azure with `You do not have the required permissions needed to perform this operation`.

No blob, manifest, key, SAS token, secret, Stage, or Production resource was created or changed. Container-list permission is insufficient for archive upload. The exact remaining external prerequisite is `Storage Blob Data Contributor` (or higher) for the designated recovery operator at the approved container or storage-account scope. Once granted, rerun the existing [source recovery execution packet](../../deployment/G8_SOURCE_RECOVERY_EXECUTION_PACKET.md): upload the bundle plus manifest, verify the remote object metadata, download into an isolated restore location, verify SHA-256, then clone and run `git fsck`.
