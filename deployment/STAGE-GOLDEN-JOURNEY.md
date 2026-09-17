# Stage UAT seed and Golden Journey smoke

This runner validates deployed Stage through HTTPS APIs only. It never connects to a database and never deploys. A missing credential, seed endpoint, response field, or required API produces `BLOCKED`; it is never counted as a pass.

## Required Stage contract

The deployment must expose an authorized, Stage-only endpoint under `/api/v1/uat/`. `POST` with `{ "scenario": "GOLDEN_JOURNEY_TWO_BALL_V1" }` must idempotently prepare or locate disposable UAT data and return:

```json
{
  "data": {
    "ball1QualificationId": "uuid",
    "ball2QualificationId": "uuid",
    "outsiderQualificationId": "uuid",
    "orderBody": { "qualificationId": "uuid", "items": [{ "productId": "uuid", "quantity": 1 }] },
    "paymentReadback": {
      "payment": "/api/v1/...",
      "inventory": "/api/v1/...",
      "notification": "/api/v1/..."
    }
  }
}
```

`paymentReadback` is optional only while Stage reports that payment-to-inventory/notification capability is unavailable. When present, every path is called and must return 200. Returned paths cannot leave `/api/v1/` or the configured Stage origin. The seed service owns cleanup, idempotency, fixture identity binding, and the distinction between unavailable capability and an unexpected error.

## Explicit execution

Supply secrets through the CI secret store or interactive process environment. Do not commit them or place them on a command line.

```powershell
$env:UCELL_ENVIRONMENT='STAGE'
$env:UCELL_STAGE_GOLDEN_OPT_IN='RUN_STAGE_UAT_GOLDEN_JOURNEY'
$env:UCELL_STAGE_API_BASE_URL='https://stage-api.example.com'
$env:UCELL_STAGE_API_ALLOWLIST='https://stage-api.example.com'
$env:UCELL_STAGE_UAT_SEED_ENDPOINT='/api/v1/uat/golden-journey/seed'
$env:UCELL_STAGE_UAT_SEED_BEARER='<Stage UAT seed service bearer>'
$env:UCELL_STAGE_MEMBER_LINE_ID_TOKEN='<real Stage LINE ID token for seeded owner>'
$env:UCELL_STAGE_OUTSIDER_LINE_ID_TOKEN='<real Stage LINE ID token for seeded outsider>'
node deployment/stage-golden-journey.mjs
```

The runner checks login/session/Person, exactly addressable Ball1 and Ball2 qualifications, Ball1 dashboard/sponsor/binary/performance/bonus/ledger, Ball2 isolation, foreign Qualification denial, products/order creation/order detail/notifications/profile, and deterministic Ball1 readback after switching context. It prints only status metadata and redacts credential values from failures.

Unit tests use a mocked HTTP transport and do not contact Stage:

```powershell
node --test deployment/stage-golden-journey.test.mjs
```
