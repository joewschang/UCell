# Local preparation results — 2026-11-16

Base: `950c55fe47a2a28369c83eac7672505e0cd283c1` (PR #75 head, independently read through GitHub connector).
Local branch: `prep/dot-uploader-token-age-261116`.
Independent clone: `/workspace/scratch/85e57236c5c6/ucell-cloud-prep-independent-261116`.
No existing checkout or remote branch was modified. No push, merge, deployment, database migration, credential/role/principal creation, network-policy change, paid model, publication or SwaggerHub update was performed. No AGENTS.md or .agents/skills/SKILL.md existed in the checked-out repository; README release instructions were read, with this task's explicit no-deployment restriction taking precedence.

## Changes

- `backend/apps/api/src/modules/daily-greetings/cloud-greeting-auth.ts`: strict effective age under 3600 seconds, valid integer iat/exp, no future iat or expiration grace, and signed lifetime capped at 5400 seconds. All existing signature and pinned app/role checks remain. Shared publish/generate verifier updated.
- `backend/apps/api/test/cloud-greeting-security.e2e-spec.ts`: 25 time cases per role (50 signed JWT checks), including exact age/expiry boundaries, future/missing/string/null/fractional/unsafe times and abnormal lifetime; existing identity/role/signature tests retained.
- `deployment/cloud-greetings/uploader.mjs`: offline-prepared reusable publisher with injected auth/transport, strict payload/PNG/date/HTTPS validation, immutable UUID/body retries, bounded response processing, fixed errors and no logs. No default network or auth implementation.
- `deployment/cloud-greetings/uploader.test.mjs`: 12 passing synthetic/mock tests.
- `deployment/cloud-greetings/README.md` and `UPLOADER.md`: corrected token policy, interface documentation, PNG-subset limitation and live-auth boundary.

## Actual validation

Environment: Node v24.22.1. The preinstalled pnpm was 11.25.0, incompatible with repo engines, so commands used `npx --yes pnpm@12.4.1`; no global package-manager change. Frozen-lockfile install passed without lockfile edits.

Passed:

- From repo root: `node --test deployment/cloud-greetings/uploader.test.mjs`: **12/12 tests**. All synthetic PNGs/provider strings/transport responses; zero live HTTP.
- `node --check deployment/cloud-greetings/uploader.mjs` and `node --check deployment/cloud-greetings/uploader.test.mjs`.
- From backend: `npx --yes pnpm@12.4.1 db:generate` and `npx --yes pnpm@12.4.1 --filter @ucell/api... build`.
- From backend: `npx --yes pnpm@12.4.1 --filter @ucell/api exec jest --config ./test/jest-e2e.json --runInBand --runTestsByPath test/cloud-greeting-security.e2e-spec.ts test/greeting-push-http.e2e-spec.ts test/cloud-greeting-http.e2e-spec.ts test/greeting-push-native.e2e-spec.ts test/greeting-complete-artwork.e2e-spec.ts`: **5 suites / 39 tests passed**. New time-table cases run inside two tests. An initial test-only clock mismatch (Date.now mocked but jose used new Date) was corrected with Jest fake system time, then all five suites passed. No verifier relaxation was used to fix the test.
- From backend: `DATABASE_URL=postgresql://synthetic:synthetic@127.0.0.1:5432/offline_only npx --yes pnpm@12.4.1 exec bash scripts/ci-gate.sh`: **21 offline preflight checks, Prisma validate/generate and all backend workspace builds passed**, ending `OFFLINE_PREFLIGHT_PASS` and `DEPENDENCY_GATE_PASS`. This script did not connect to a database or execute migrations.
- `git diff --check` passed.

Blocked validation:

- `npx --yes pnpm@12.4.1 --filter @ucell/api lint` failed before linting because installed ESLint 10.10.0 could not find `eslint.config.*`. No such config exists in the base tree. Unrelated lint configuration was not changed. This is not a successful lint run.

Not run / not claimed:

- Full API test suite, isolated PostgreSQL publication/concurrency/audit/replay suite, migrations, CI on a pushed branch, admin/member builds, release/backup/restore/UAT gates.
- Live Entra client_credentials, proxy placeholder substitution (especially form encoding), actual token claim inspection, real HTTP adapter/redirect/TLS/proxy cancellation behavior, production publication/retry, unattended scheduling, durable retry storage or PC-off end-to-end operation.

## Remaining handoff

`UPLOADER.md` describes the required adapter contracts. Network-secret substitution is only a documented candidate, not verified custody. Real form-encoded placeholder replacement must be demonstrated separately without exposing the secret. An approved dedicated publisher identity and audited adapters/storage must exist before activation. Tokens remain memory-only in this module, but injected adapters and runtime diagnostics must be reviewed separately. PNG metadata chunks are deliberately rejected; real generated assets may need approved normalization. The server remains authoritative for native image decoding, branding and immutable publication.

Sources consulted: [Microsoft token lifetime](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens#token-lifetime) and [ChatGPT cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environments). Neither source establishes that this runtime's live identity path has been tested.
