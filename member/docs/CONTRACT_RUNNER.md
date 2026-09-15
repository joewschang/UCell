# Offline Member contract check

This tool checks **frontend compatibility**, not authorization, actual endpoint
availability, financial correctness, or live LINE integration. It makes no API
requests and needs no token. Use synthetic backend fixtures, not member exports.

Run from `member/` using the repository Node 24 / pnpm toolchain:

```sh
corepack pnpm run test:contract
```

Without an input file the command validates the checked-in synthetic baseline.
Export that baseline as a JSON template:

```sh
node --experimental-strip-types --input-type=module -e 'import { sample } from "./contracts/sample.ts"; console.log(JSON.stringify(sample, null, 2))' > /tmp/member-contract.json
```

Replace its response bodies with synthetic responses produced by the backend,
then run:

```sh
MEMBER_CONTRACT_FILE=/tmp/member-contract.json corepack pnpm run test:contract
```

Missing/invalid input fails instead of silently using the baseline. All ten
response keys are required. Test failure diagnostics name endpoints only; response
bodies are never included. A nonzero process exit is failure. Never commit real
member data or credentials as contract fixtures.

| Response key | GET path relative to `/api/v1` | Required context |
|---|---|---|
| qualifications | /member/qualifications | Person; must contain selected qualificationId |
| person | /member/me | Person |
| dashboard | /member/dashboard | qualificationId |
| organization | /member/organization/sponsor | qualificationId |
| binary | /member/organization/binary | qualificationId |
| performance | /member/performance | qualificationId + period |
| bonuses | /member/bonuses | qualificationId + period |
| ledger | /member/bonuses/ledger | qualificationId + period |
| products | /member/products | Catalog |
| orders | /member/orders | qualificationId |

Bundle shape: `{ qualificationId, period, responses: { ... } }`. Each response is
`{ data, meta: { request_id, timestamp, api_version: "v1" } }`. DTO checks reuse
`src/validation.ts`; envelope checks reuse `src/memberApi.ts`. Additional scope
and period checks prevent a valid-looking DTO being accepted for the wrong ball.
Fixture numbers are artificial display examples, not approved business rules.

Baseline validation: 87 tests PASS (82 retained, 5 added), typecheck/build PASS.
The normal CI test command includes this suite. CI uses the synthetic baseline;
it must not be described as a backend-provided fixture or live API PASS.

Remaining integration gates: actual Member routes and LINE session exchange,
server-side ownership/401/403 tests, approved order idempotency and reconciliation,
notification contracts, genuine LIFF device UAT. No production promotion.
