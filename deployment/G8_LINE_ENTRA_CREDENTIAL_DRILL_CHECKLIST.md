# G8 LINE and Entra credential drill checklist

**Status:** `BLOCKED_EXTERNAL_CREDENTIALS`.

Required Stage-only inputs: approved Entra tenant/client/redirect URI and approved LINE Login/LIFF channel, callback URI, signing verification configuration and named credential owners. Do not substitute synthetic Stage UAT identity for these credentials.

When provisioned, verify: valid login, invalid issuer/audience/signature rejection, expired/replayed token rejection, grant/revocation behavior, LINE link/rebind owner checks, redirect allowlist, privacy-safe audit events, correlation trace, and absence of credentials/PII from diagnostics. Record configuration identifiers and result only; never record values.
