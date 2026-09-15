# Member response envelope integration

Evidence: `backend/apps/api/src/main.ts` registers `EnvelopeInterceptor` globally.
`backend/apps/api/src/common/interceptors/envelope.interceptor.ts` supplies
`data` and metadata (`request_id`, `timestamp`, `api_version: v1`).

Member data loaders now unwrap this envelope once, before the existing DTO,
qualification and period checks. Bare payloads, missing data, invalid metadata
and unknown API versions are rejected. Null/zero/negative adjustments and arrays
are preserved. Metadata never authorizes membership or ball ownership.

The low-level HTTP client remains unchanged for timeout, 401, 403 and cancellation.
Mock mode still returns explicit demo data directly. The existing HTTP fixtures
now match the backend envelope; no test or assertion was removed.

Validation: 76 tests PASS (72 retained, 4 new), TypeScript and Vite build PASS.
Existing real-mode UI tests exercise envelope -> DTO -> qualification/period
checks, including wrong ball/month and malformed product price rejection.
This is frontend contract validation, not a live authenticated backend test.

Member controllers and LINE session exchange remain integration blockers. Real
login is still fail-closed; this change does not invent or enable an endpoint.
No backend, monetary rules, main merge or production deployment was changed.
