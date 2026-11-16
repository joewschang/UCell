# Preserve complete greeting artwork

Uploading a finished greeting previously scaled it into 1080 x 880 and appended another logo/footer. An explicit `imageMode: artwork` now re-encodes the complete PNG at its original dimensions without adding a logo or cropping the QR. `background` retains trusted brand composition; omitted mode remains background for existing clients. The admin form defaults to the clearly labelled complete-artwork option. PNG validation, metadata removal, admin authorization, draft review and audit remain in place.

Existing drafts contain already-processed pixels and do not repair themselves after deployment. Re-upload the original finished artwork in complete-artwork mode and preview before approval. This fix does not publish, archive, delete or modify any existing draft or November 16 publication.

Source input limits are reconciled to the existing production 3 MiB PNG / 4 MiB base64 limits. The migration records the existing 5 MiB stored-image constraint; production metadata was read and confirmed as `CHECK ((octet_length(image) <= 5242880))`. No production schema mutation is needed for this image-only hotfix.

## Narrow production overlays

- API base: paper-signature revision, digest `sha256:28c1034e6bea8974fc306f77e8c05340301f5946dfe1d8fb89b4207c731b9ec9`.
- Admin base: order-label revision, digest `sha256:54b4b703dbc53dd855964e02c2f206db533848a66d7041903a7101cecd03045f`.
- API changes only the uploader, trusted simplified logo/QR helper/assets, one argument in the live draft service and optional DTO validation metadata. `patch-api.cjs` refuses unexpected anchors or upload limits. Paper-signature and all other production modules remain inherited from the pinned base.
- Admin changes only index.html plus a new, named greeting mode script. It adds the explicit selector on `/content/greetings` and adds `imageMode` only to that form's draft POST. Existing application bundles and other requests remain unchanged. The source React form implements the equivalent native selector.
- Before promotion, re-read both live digests; refuse if either changed. Retain old digests for rollback. Deploy API first, verify readiness/authentication, then admin; verify the new script/selector. Roll back by restoring the old digest; no draft or database rollback is required. Keep the November 16 publishing step with the parent task.

## Evidence before promotion

Local API build passed. Two focused suites / 12 tests passed, including exact rendered-pixel equality for a branded complete image with lower-right QR, non-square canvas preservation, explicit background mode, invalid mode/input rejection, and draft-only storage. All 21 offline preflights passed. A local headless browser test verified both selector choices and that unrelated requests remain unchanged. The same native artwork pixel/limit tests run inside the Linux candidate image during ACR build.

The exact-head GitHub application/contract checks and candidate image results must pass before promotion. SwaggerHub publication remains paused. Local Docker/PostgreSQL became unavailable while C: was full; 365 MB of npm cache was safely moved to D: preserving contents. Synthetic DB validation must be supplied by the exact-head CI, not falsely claimed from the unavailable local container. Runtime image rollback and production DB backup/restore release gates must be checked before cutover.
