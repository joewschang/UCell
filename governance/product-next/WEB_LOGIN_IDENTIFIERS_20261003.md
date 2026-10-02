# Web member login and registration password confirmation

Product Owner request: support one of member number, email or mobile plus the correct existing password; require matching registration password confirmation.

The Member login input accepts all three identifiers. The existing API request field memberNo is retained for client compatibility, with validation broadened to a bounded string. Email matching is case-insensitive and trims surrounding spaces. Taiwan local 09 numbers normalize to +8869; international +country-code numbers accept common spacing/parentheses/hyphens. Stored local Taiwan numbers are also recognized. A non-unique contact identifier fails with MEMBER_LOGIN_INVALID rather than selecting an arbitrary account. Login still verifies the same password credential, account/security status, lockout and provider-neutral session with immutable member number as its subject. Mobile/password login does not claim OTP verification.

Web registration now requires a confirmation password input. Mismatching entries display a Chinese error and do not send the registration request. Only the original password is submitted; confirmation is not stored or transmitted. Existing Google verification, contract consent and no-Qualification registration behavior remain unchanged.

Source commit: 4083cbbedb642f8b4bcec80d4cbca834d2f032d0. Real isolated DB integration validates successful number/email/local-mobile/international-mobile login to the same session identity, incorrect password refusal and duplicate contact refusal. Member UI regression verifies mismatch blocks submission and matching values continue registration.

Validation: Member 43 suites / 237 tests PASS, builds PASS; real DB focused integration 6 tests and 162 existing DB assertions PASS; full remote RC CI run 37059479080 passes backend 207 suites / 1441 tests plus Admin and Stage static gates. Member CI run 37059479092 PASS. OpenAPI governance remains blocked by the pre-existing unapproved contract changes; no baseline waiver or main merge is made.

Stage deployment and public artifact/health/negative login probes: deployment/web-login-stage-verification-20261003.json. Both API and Member revisions end in web-login-20261003, Healthy/Running; API health 200; published member index-Cl4m1wE5.js matches the built SHA256. Synthetic nonexistent number/email/mobile probes all return 401 MEMBER_LOGIN_INVALID rather than input-format rejection. Successful password checks run in isolated DB, not against user credentials on Stage.

UI screenshots use an anonymous local preview of the identical verified frontend artifact because the in-app Stage browser already has an authenticated member session; that session was preserved. Screenshots: C:/UCell/logs/web-login-identifier-preview-20261003.png and C:/UCell/logs/web-register-confirm-preview-20261003.png. Preview contract load failure is due to the localhost origin and does not represent the deployed Stage contract state.

No database migration, Stage ownership/financial mutation, OTP activation or Production deployment.

Local full isolated API regression also completed: 207 suites / 1441 tests PASS, API_JEST_ISOLATED_PASS and API_JEST_ISOLATED_CLEANUP_PASS; log C:/UCell/logs/web-login-api-full-20261003.log. Its counts agree with the remote source-commit CI.
