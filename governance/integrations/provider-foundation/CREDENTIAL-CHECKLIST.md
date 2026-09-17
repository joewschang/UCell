# Provider Credential and Operational Checklist

Status: DRAFT  
Default for every formal credential and external verification item: **OPERATIONAL_CREDENTIAL_PENDING**.

Do not paste secrets, certificates, private keys, access tokens or merchant passwords into this document, Git, tickets, test fixtures or chat. Record only secret references, key versions, ownership and verification evidence IDs. Stage/UAT and Production must use different identities, databases, secrets and provider connections.

## Common checklist for each connection

| Item | Required record | Status |
|---|---|---|
| Contract/account owner | Legal entity, operational owner, technical owner | OPERATIONAL_CREDENTIAL_PENDING |
| Environment | SANDBOX/UAT or PRODUCTION, never ambiguous | OPERATIONAL_CREDENTIAL_PENDING |
| Provider product/API version | Approved documentation revision and effective date | OPERATIONAL_CREDENTIAL_PENDING |
| Merchant/channel/service ID | Non-secret identifier and owner | OPERATIONAL_CREDENTIAL_PENDING |
| Secrets | Azure Key Vault URI/name/version only | OPERATIONAL_CREDENTIAL_PENDING |
| Certificates | Key Vault certificate reference, expiry and rotation owner | OPERATIONAL_CREDENTIAL_PENDING |
| Callback endpoints | HTTPS URL, event types, ownership and registration evidence | OPERATIONAL_CREDENTIAL_PENDING |
| Network controls | Provider IP/mTLS/allowlist requirements and test evidence | OPERATIONAL_CREDENTIAL_PENDING |
| Signature vectors | Official valid, tampered, wrong-key, expired and replay cases | OPERATIONAL_CREDENTIAL_PENDING |
| Idempotency/operation identity | Provider-defined key and UCell canonical mapping | OPERATIONAL_CREDENTIAL_PENDING |
| Retry/ack/query behavior | Timeout, lost response, redelivery and reconciliation SOP | OPERATIONAL_CREDENTIAL_PENDING |
| Rate/timeout limits | Config version, retry budget and circuit-breaker settings | OPERATIONAL_CREDENTIAL_PENDING |
| Monitoring | Success/error/latency/backlog alarms and on-call owner | OPERATIONAL_CREDENTIAL_PENDING |
| UAT approval | Dated evidence, tester, result, exceptions and approver | OPERATIONAL_CREDENTIAL_PENDING |
| Production approval | Go/No-Go reference and rollback/disable owner | OPERATIONAL_CREDENTIAL_PENDING |

## LINE OA / LIFF

- [ ] OA basic ID and verified organization ownership — OPERATIONAL_CREDENTIAL_PENDING
- [ ] LINE Login Channel ID and Channel Secret Key Vault reference — OPERATIONAL_CREDENTIAL_PENDING
- [ ] LIFF ID, Scope and Stage HTTPS endpoint — OPERATIONAL_CREDENTIAL_PENDING
- [ ] OA and Login Channel linkage — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Messaging webhook secret/reference and registered callback, if enabled — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Real-device valid/invalid/expired/replay token evidence — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Unbound/disabled/no-Qualification/wrong-Qualification/session-expiry evidence — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Identity binding, unbinding and account recovery SOP — OPERATIONAL_CREDENTIAL_PENDING

## LINE Pay

- [ ] Merchant ID and Channel ID — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Channel Secret Key Vault reference/version — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Sandbox and Production endpoints/config separated — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Confirm/capture/query/cancel/refund operation mapping — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Signature nonce/timestamp/canonical request official vectors — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Return/cancel URLs and server verification path — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Settlement/reconciliation source and finance owner — OPERATIONAL_CREDENTIAL_PENDING

## Taishin e-commerce / POS

- [ ] Merchant, terminal and acquiring product identifiers — OPERATIONAL_CREDENTIAL_PENDING
- [ ] API/version and official signature/checksum rules — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Secret/certificate Key Vault references and rotation process — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Payment/capture/cancel/refund/query callbacks and event identities — OPERATIONAL_CREDENTIAL_PENDING
- [ ] POS terminal/batch/transaction uniqueness and reconciliation SOP — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Paid-authority rule for online and POS evidence — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Settlement report and bank deposit reconciliation — OPERATIONAL_CREDENTIAL_PENDING

## ECPay payment

- [ ] Merchant ID, HashKey/HashIV secret references — OPERATIONAL_CREDENTIAL_PENDING
- [ ] CheckMacValue/encoding official vectors — OPERATIONAL_CREDENTIAL_PENDING
- [ ] ReturnURL/OrderResultURL/ClientBackURL authority classification — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Query/cancel/refund/settlement reconciliation — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Payment adapter connection distinct from invoice/logistics — OPERATIONAL_CREDENTIAL_PENDING

## ECPay / Chunghwa Telecom e-invoice

- [ ] Provider selection/role and API product version — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Business tax identity and invoice number-track responsibility — OPERATIONAL_CREDENTIAL_PENDING
- [ ] App/merchant identifiers, secrets/certificates in Key Vault — OPERATIONAL_CREDENTIAL_PENDING
- [ ] B2C/B2B, carrier, donation, buyer/tax and rounding policy approval — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Issue trigger and timing approval — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Void, allowance, partial-return and lost-response SOP — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Daily invoice reconciliation and retention evidence — OPERATIONAL_CREDENTIAL_PENDING

## Black Cat / 7-ELEVEN

- [ ] Approved direct/aggregator route and contract/account — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Customer/store/service codes and secret/certificate references — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Service size/temperature/region/COD restrictions — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Store map/validation contract and store snapshot policy — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Label generation/printing format and sandbox — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Tracking callback/query event identity and monotonic mapping — OPERATIONAL_CREDENTIAL_PENDING
- [ ] Cancel, failed delivery, return-to-sender and reverse-logistics SOP — OPERATIONAL_CREDENTIAL_PENDING

## Key Vault naming and evidence rules

Use environment-qualified references, for example `kv-ucell-stage/<provider>-<purpose>-<version>`. This is a naming example only, not evidence that a secret exists. Applications receive least-privilege read access; operators cannot read Production secrets unless their formal role requires it. Rotation must support an overlap window and record old/new config versions without rewriting historical verification evidence.

Before marking any line PASS, record: environment, connection/config version, evidence artifact, execution timestamp, non-secret endpoint, result, approver and linked incident/exception if applicable.

