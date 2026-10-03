# Member contact verification

Registration through Google or LINE requires independently verified SMS and Email contacts. Google `email_verified` is provider identity evidence and does not replace the contact-code step. Changes to a member's mobile or Email require a fresh proof for that destination. Existing login and identity linking remain available; existing contacts are not retroactively marked verified.

Each six-digit code expires after five minutes. Delivery reservations persist before sending, with a 60-second destination cooldown, five sends per destination/hour, ten/day, and twenty per identity/day. Failed deliveries count toward these limits. Five wrong attempts lock a challenge. A proof binds the authenticated identity, destination, channel and purpose and is consumed once in the same transaction as the contact write. Failed writes roll back proof consumption. Clients keep proofs in memory and clear them when the destination changes or the challenge expires.

## Provider configuration

Server only; configure through Azure secret references. Never put credentials, codes or proofs in GitHub, frontend environment variables or operational evidence.

- `OTP_HASH_SECRET`: cryptographically random secret of at least 32 characters; changing it invalidates outstanding challenges.
- `EVERY8D_SMS_ENDPOINT`: the account's exact HTTPS SiteUrl followed by `/API21/HTTP/SendSMS.ashx`.
- `EVERY8D_UID` and `EVERY8D_PASSWORD`: activated account credentials.
- `CONTACT_VERIFICATION_EMAIL_WEBHOOK_URL` and `CONTACT_VERIFICATION_EMAIL_WEBHOOK_TOKEN`: a configured HTTPS email-delivery adapter accepting bearer-authenticated JSON `{template:"UCELL_CONTACT_VERIFICATION",to,code,expiresInSeconds:300}`. It must return success only after the provider accepts delivery and must configure the approved sender/domain. The email provider and sender have not yet been selected.

Every8D uses form-encoded POST, immediate sending, and validates the five-column delivery response. Specification: https://www.teamplus.tech/wp-content/uploads/2025/11/%E4%BA%92%E5%8B%95%E8%B3%87%E9%80%9A%E7%B0%A1%E8%A8%8AAPI21%E8%A6%8F%E6%A0%BC%E6%9B%B8_v2.2.pdf

The contact flow does not enable SMS login or reuse password-reset templates. No fake-code or verification-bypass mode exists. Missing configuration returns an actionable unavailable error and cannot produce a verified contact.

## Activation and UAT

As of 2026-10-03, Every8D activation is expected next week, and email delivery is pending. Keep the existing Stage registration release running until both providers are ready; deploying the strict replacement beforehand would block new registrations. Prepare the reviewed release and migration now, then configure both providers before replacing the Stage API/member images.

Apply `20261003090000_contact_verification` with the existing approved migration recovery procedure and regenerate Prisma inside the Linux API image. Preserve applied historical migration checksums. Verify both provider deliveries with owner-approved test destinations before rollout. Do not report provider acceptance as proof of handset/mailbox receipt.

Real UAT must cover Google and LINE new registration, SMS-only/Email-only rejection, wrong code, five-attempt lock, expiry, cooldown/resend, browser retry without duplicate delivery, edited destination invalidation, and verified profile contact changes. Check `mobileVerifiedAt`/`emailVerifiedAt` are stored only after successful registration/change. Confirm existing Google, password and LINE login and identity linking still work. Production additionally requires approved contracts/privacy documents in place of Stage's empty placeholder.

The database suite uses an isolated disposable database and synthetic delivery providers; it does not send SMS/email. Real delivery remains a separate acceptance step.
