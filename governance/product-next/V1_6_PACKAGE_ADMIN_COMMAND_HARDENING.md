# V1.6 Package Admin Command Hardening

Date: 2026-09-17

All package configuration Admin mutation endpoints (profile creation, version creation, selectable products, approval, scheduling, activation, and retirement) now require `Idempotency-Key` and execute through the persisted Serializable idempotency service. Each first commit writes a domain audit fact in the same transaction; lost-response retries return the original response without duplicate rows or duplicate audit evidence, and changed payloads under the same key fail with `IDEMPOTENCY_CONFLICT`.

Evidence:

- Fresh DB Golden: PASS across 39 migrations.
- Package Admin command test: 22 real DB assertions PASS, including lost-response replay after every lifecycle state transition and exactly one domain audit fact per first commit.
- Backend Jest: 17 suites / 189 tests PASS, 0 TODO, random isolated DB cleaned up.
- API build, OpenAPI, static, security policy, and TODO gates: PASS.

Remaining package Admin mutations (`selectable-products`, `approve`, `schedule`, `activate`, `retire`) still require the same transactional idempotency/domain-audit conversion. This checkpoint does not claim those endpoints are hardened and does not change package economics or Production status.
