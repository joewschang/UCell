# Member contact verification

Registration through Google or LINE requires independently verified SMS and Email contacts. Google `email_verified` is provider identity evidence and does not replace the contact-code step. Changes to a member's mobile or Email require a fresh proof for that destination. Existing login and identity linking remain available; existing contacts are not retroactively marked verified.

Each six-digit code expires after five minutes. Delivery reservations persist before sending, with a 60-second destination cooldown, five sends per destination/hour, ten/day, and twenty per identity/day. Failed deliveries count toward these limits. Five wrong attempts lock a challenge. A proof binds the authenticated identity, destination, channel and purpose and is consumed once in the same transaction as the contact write. Failed writes roll back proof consumption. Clients keep proofs in memory and clear them when the destination changes or the challenge expires.

## Provider configuration

Server only; configure through Azure secret references. Never put credentials, codes or proofs in GitHub, frontend environment variables or operational evidence.

- `OTP_HASH_SECRET`: cryptographically random secret of at least 32 characters; changing it invalidates outstanding challenges.
- `EVERY8D_SMS_ENDPOINT`: the account's exact HTTPS SiteUrl followed by `/API21/HTTP/SendSMS.ashx`.
- `EVERY8D_UID` and `EVERY8D_PASSWORD`: activated account credentials.
- `CONTACT_VERIFICATION_EMAIL_WEBHOOK_URL` and `CONTACT_VERIFICATION_EMAIL_WEBHOOK_TOKEN`: a configured HTTPS email-delivery adapter accepting bearer-authenticated JSON `{template:"UCELL_CONTACT_VERIFICATION",from:"service@ucell.life",to,code,expiresInSeconds:300}`. It must honor the approved sender `service@ucell.life`, return success only after the provider accepts delivery, and verify the sender/domain with that provider. The owner selected the sender on 2026-10-03; the delivery provider is still pending.

Every8D uses form-encoded POST, immediate sending, and validates the five-column delivery response. Specification: https://www.teamplus.tech/wp-content/uploads/2025/11/%E4%BA%92%E5%8B%95%E8%B3%87%E9%80%9A%E7%B0%A1%E8%A8%8AAPI21%E8%A6%8F%E6%A0%BC%E6%9B%B8_v2.2.pdf

The contact flow does not enable SMS login or reuse password-reset templates. No fake-code or verification-bypass mode exists. Missing configuration returns an actionable unavailable error and cannot produce a verified contact.

### Microsoft 365 Graph transport

The owner selected the GoDaddy-hosted Microsoft 365 mailbox on 2026-10-04. Set `TRANSACTIONAL_EMAIL_PROVIDER=microsoft365_graph` to use the direct Graph transport for both verification and password-reset messages. Set `M365_MAIL_TENANT_ID`, `M365_MAIL_CLIENT_ID` and `M365_MAIL_CLIENT_SECRET` through server secret references. The client secret belongs to a dedicated single-tenant mail application; it is **not** the mailbox login password. Do not put it into frontend variables, screenshots, command output or GitHub. Track its expiration and rotate before expiry. Omitted provider or `webhook` retains the existing adapter; explicitly selected Graph with incomplete credentials fails closed and never falls back to a different sender/provider.

The transport obtains an app-only token from the fixed Microsoft identity endpoint and calls `/v1.0/users/service%40ucell.life/sendMail` at `graph.microsoft.com`. Sender and API origins cannot be overridden. Requests reject redirects and time out after ten seconds. Tokens are memory-only, refreshed before expiry, and concurrent acquisitions share one request. A failed/ambiguous send is not automatically retried. Only HTTP 202 counts as provider acceptance; actual inbox receipt and authentication headers require separate real UAT. Provider response bodies and tokens are not logged or returned to members.

Use Exchange Online **Application RBAC**, with only `Application Mail.Send` scoped to the `service@ucell.life` mailbox. Do not add tenant-wide Microsoft Graph `Mail.Send`, `Mail.Read`, `Mail.ReadWrite` or Exchange full-access permissions in Entra. RBAC and Entra permissions are additive; a tenant-wide grant defeats the mailbox restriction. Microsoft setup reference: https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac

Prepare a dedicated `UCell Stage Transactional Mail` single-tenant app without redirect URIs. The owner must approve the new persistent sending access and Microsoft registration terms before registration. Have the owner complete any new credential creation required by the browser confirmation policy, and store the resulting secret directly in Azure secret storage. Use the **enterprise application's service-principal Object ID**, not the app-registration Object ID, for Exchange registration. An Exchange administrator can then run the reviewed commands below after verifying IDs against the intended tenant:

```powershell
Connect-ExchangeOnline -UserPrincipalName service@ucell.life
$mailAppId = '<dedicated application client ID>'
$mailPrincipalId = '<enterprise application Object ID>'
New-ServicePrincipal -AppId $mailAppId -ObjectId $mailPrincipalId -DisplayName 'UCell Stage Transactional Mail'
New-ManagementScope -Name 'UCell Stage Service Mailbox' -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'service@ucell.life'"
New-ManagementRoleAssignment -Name 'UCell Stage Send Verification Mail' -Role 'Application Mail.Send' -App $mailPrincipalId -CustomResourceScope 'UCell Stage Service Mailbox'
Test-ServicePrincipalAuthorization -Identity $mailPrincipalId -Resource service@ucell.life
```

Inspect the scope's recipients: it must contain exactly the service mailbox. Verify the RBAC positive test and a negative test against a different existing mailbox, and independently verify that Entra has no broader app grant. Allow for permission propagation before a real send. No application or permission was created by committing these instructions. To revoke, remove the named role assignment and disable/revoke the dedicated app credential; retain unrelated grants and mailbox settings.

### DNS audit (2026-10-04)

The GoDaddy domain page identifies **Cloudflare** as the DNS provider. Microsoft DKIM UI showed Enabled/Valid with a last check of 2026-09-03, but public DNS initially did not return the selector CNAMEs. Cloudflare inspection found both existing records incorrectly **proxied**. Both were changed to **DNS only** on 2026-10-04. After saving, public queries via 1.1.1.1 returned both expected CNAMEs and Microsoft's RSA DKIM public-key TXT records. The UI status alone was insufficient evidence.

| Name | Microsoft target (DNS only) |
| --- | --- |
| `selector1._domainkey` | `selector1-ucell-life._domainkey.NETORGFT21090526.d-v1.dkim.mail.microsoft` |
| `selector2._domainkey` | `selector2-ucell-life._domainkey.NETORGFT21090526.d-v1.dkim.mail.microsoft` |

The existing SPF is `v=spf1 include:secureserver.net -all`. Public DNS confirmed `secureserver.net` includes `spf-0.secureserver.net`, which already includes `spf.protection.outlook.com`. The Microsoft record contains address mechanisms only: this chain uses three include lookups, below the limit of ten. SPF was retained, with exactly one SPF TXT record at the root. Existing DMARC is `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` and was retained. MX, nameservers and Stage host records were not changed.

The service mailbox's authenticated SMTP checkbox was disabled, consistent with the real SMTP test returning 535. Graph avoids requiring that switch or weakening organization security defaults. DNS correction and mailbox-scoped app authorization are complete; dedicated credential configuration and real inbox delivery remain outstanding.

After explicit owner approval, `UCell Stage Transactional Mail` was registered as single-tenant. Client ID: `afed58af-a413-4fb8-b298-6d7a883118cf`; tenant: `3401a3be-fd5f-43c9-ac34-c32241af4e95`; enterprise service-principal Object ID: `caa1ca0d-d3eb-4b53-9a6a-e9ef3b0d33aa`. The default delegated `User.Read` request was removed; the Entra API-permission list is empty. Exchange contains only the named `Application Mail.Send` assignment above for this principal. The scope preview contained exactly `service@ucell.life`. `Test-ServicePrincipalAuthorization` returned `InScope=True` for the service mailbox and `False` for the tenant's existing DiscoveryMailbox. The negative test was authorization-only and sent no message.

Exchange's device-code login was blocked with 530035. Standard modern browser authentication succeeded using official ExchangeOnlineManagement 3.10.1 and `-DisableWAM`; no tenant security setting was weakened. No app secret has yet been created. The browser credential-creation step is left for the owner to complete under its confirmation policy; subsequent handling must place it directly into server secret storage without disclosing it in chat or evidence.

## Activation and UAT

As of 2026-10-03, Every8D activation is expected next week. The Email sender is `service@ucell.life`; delivery service configuration is pending. Keep the existing Stage registration release running until both providers are ready; deploying the strict replacement beforehand would block new registrations. Prepare the reviewed release and migration now, then configure both providers before replacing the Stage API/member images.

Apply `20261003090000_contact_verification` with the existing approved migration recovery procedure and regenerate Prisma inside the Linux API image. Preserve applied historical migration checksums. Verify both provider deliveries with owner-approved test destinations before rollout. Do not report provider acceptance as proof of handset/mailbox receipt.

Real UAT must cover Google and LINE new registration, SMS-only/Email-only rejection, wrong code, five-attempt lock, expiry, cooldown/resend, browser retry without duplicate delivery, edited destination invalidation, and verified profile contact changes. Check `mobileVerifiedAt`/`emailVerifiedAt` are stored only after successful registration/change. Confirm existing Google, password and LINE login and identity linking still work. Production additionally requires approved contracts/privacy documents in place of Stage's empty placeholder.

The database suite uses an isolated disposable database and synthetic delivery providers; it does not send SMS/email. Real delivery remains a separate acceptance step.


## Stage Email-first release (2026-10-04)

Owner authorized Email-first activation without waiting for Every8D. Set
`CONTACT_VERIFICATION_SMS_REQUIRED=false` only with `UCELL_ENVIRONMENT=STAGE`.
Default and Production remain strict. Public contact policy drives registration/profile forms.
Email proof stays mandatory and is consumed atomically. Collected/changed phones without SMS proof
retain `mobileVerifiedAt=null`; UI explicitly labels them unverified. SMS send is unavailable,
not simulated. After Every8D enablement remove the override (or set true) and complete dual-channel UAT.
Azure secret `m365-mail-client-secret` is ready; never put its value in frontend configuration.
