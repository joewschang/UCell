# G8 source recovery execution packet

**Status:** `BLOCKED_STORAGE_PERMISSION`.

## Least privilege required

Assign **Storage Blob Data Contributor** to the designated release/recovery operator at the `ucellst5mafbbsq33mgu` storage account scope, or only the approved `ucell-source-recovery` container if the platform permits container-level assignment. Reader, Contributor and management-plane access alone are insufficient for blob upload.

## Execution

1. Create a full-ref Git bundle and SHA-256 manifest outside the source checkout.
2. Verify `git bundle verify`, then create a bare mirror and run `git fsck --no-dangling`.
3. Upload only the bundle and manifest to the private recovery container using Entra data-plane authorization.
4. Record blob version/ETag, manifest hash and upload timestamp; never archive secrets, local `.env`, credential stores or build caches.
5. On a separate recovery workstation, download the named blob, verify SHA-256, `git clone --mirror`, and run `git fsck --no-dangling`.

No account key, SAS token or permission bypass is requested.
