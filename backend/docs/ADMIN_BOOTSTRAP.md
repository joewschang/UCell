# Production Admin Bootstrap

Production Admin authentication is allow-list based.

For each administrator:
1. Create/identify the `identity.person`.
2. Obtain the administrator's Microsoft Entra Object ID (`oid`).
3. Insert or migrate an `identity.admin_access_grant`:
   - provider = `ENTRA`
   - provider_subject = Entra `oid`
   - role_code = one of:
     - SUPER_ADMIN
     - MEMBERSHIP_OPS
     - ORDER_OPS
     - FINANCE
     - COMPLIANCE_AUDIT
     - CUSTOMER_SERVICE
   - status = ACTIVE
4. Verify the person logs in using Entra and receives only the expected role.
5. Do not share identities. Dual-approval users must be separate people.

The first SUPER_ADMIN grant must be provisioned through controlled DB/ops procedure before opening Admin UI.

## Role changes / revocation

Do not overwrite an administrator's role in-place.
To change role:
1. mark the existing grant `REVOKED` and set `valid_to`,
2. create a new grant with the new `role_code`.

The database prevents changing identity/role fields on an existing grant and prevents physical deletion.
