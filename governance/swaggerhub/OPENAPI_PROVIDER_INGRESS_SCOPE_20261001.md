# Canonical LINE provider ingress and versioned API validation

Authority: the user's 2026-10-01 Interrupted Work Recovery + LINE Integration + UAT Readiness instruction explicitly requires `POST /api/line/webhook`. The preserved request states this at lines 249/262/489; the implemented route and its existing tests are retained. This is a provider ingress, not a new UCell client API version or permission to add arbitrary unversioned routes.

The full OpenAPI governance gate previously rejected the actual generated contract at `OPENAPI_V1_PREFIX_REQUIRED`, before validation/diff/tests. The precise integration repair recognizes only `/api/line/webhook`, POST only, with operationId `lineStageWebhook`, a required `x-line-signature` header and documented 200/401/503 outcomes. Other non-v1 paths, other verbs/identities and missing signature/error contracts still fail. The provider operation stays in the same secret scan, pinned validation and strict breaking comparison; it is not hidden, removed or excluded from evidence.

The normal `/api/v1/` client contract boundary remains intact. No approved baseline byte, baseline hash, diff severity, oasdiff rule, publisher permission, economic outcome or webhook implementation is changed. The signature header is now documented consistently with the existing raw-body verification behavior.

This is reconciliation with an already explicit user-authorized path, not an automatic breaking-change waiver or a baseline promotion. Local governance evidence cannot authorize SwaggerHub publication, Stage or Production deployment. The full R1.0B batch acceptance remains independently incomplete.
