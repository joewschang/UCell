# G8 source recovery evidence and blocker — 2026-09-26

A full-ref Git bundle was generated from the repository and verified using Git's native format. It included all visible branches, remote tracking refs, tags, `HEAD`, and worktree refs; `git bundle verify` reported complete history. A local bare clone and `git fsck --no-dangling` completed successfully.

| Field | Value |
|---|---|
| Candidate at archive attempt | `056055542a88e4f0837a8b6a6f685dc621eda524` |
| Bundle SHA-256 | `3b1d8722723dc39224d85dece33512bb7550596a4ab76d8f550fe6fd03c60715` |
| Bundle refs | 17 |
| Local restore | PASS (`git clone --mirror`, `git fsck --no-dangling`) |
| Intended independent destination | private Azure Storage container `ucell-source-recovery`, account `ucellst5mafbbsq33mgu` |

The private container was created using Azure management-plane authorization. Uploading the bundle and manifest through Azure AD data-plane authorization was denied because the current operator lacks `Storage Blob Data Contributor` (or higher) on the storage account. No archive blob was uploaded; therefore `SOURCE_RECOVERY` remains blocked and the local copy is not claimed as an independent recovery copy.

Required external action: grant the designated release/recovery operator a least-privilege `Storage Blob Data Contributor` role for the approved independent recovery storage location, then run the governed archive upload and separate restore verification. No storage account keys or secrets are required or requested.
