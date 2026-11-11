# Greeting overlay for the existing production release

The live `topics-261111b` images include health-game, topics, enrollment and other deployed overlays that are absent from main. Replacing these images with a full main build would lose functionality. These Dockerfiles retain the exact live image digests and add only the reviewed greeting modules and isolated UI bundles. The original API module imports are extended; original frontend bundles and topic hooks remain byte-identical.

Source recovery references on David-PC-888: `D:/UCell/tag-first-edition/deployment/topic-tags`, `D:/UCell/tmp/tags-ui-261111`, `D:/UCell/tmp/health-release`, and `D:/UCell/tmp/entity-ops-261111`. ACR runs ckj8, ckj9, ckja establish the pinned bases. No local uncommitted source was overwritten.

## Rebuild

Install each backend/member/admin lockfile with pnpm 12.4.1. Generate Prisma and build the backend with the repository's normal commands. From the repository root:

```text
python deployment/greeting-overlay/prepare-api.py
node deployment/greeting-overlay/build-ui.mjs
```

Build the API with the Dockerfile copied into `output/api`. Build member/admin using `-f deployment/greeting-overlay/Dockerfile.member output/member` and the corresponding admin path. Tag local images `ucell-greeting-api:261111`, `ucell-greeting-member:261111`, `ucell-greeting-admin:261111` for the verification scripts. The source Dockerfiles must remain digest-pinned. Reconcile again if the live revisions have moved.

Member bundle mounts the existing DailyGreetingCard only on `/explore`, responds to navigation/DOM replacement, and preserves existing content. Admin uses the existing authenticated API client and AuthProvider at `/greetings/`, linked from the existing navigation. It never copies or creates administrator credentials. Its preview, approval reference and role restrictions are unchanged.

## Validation and release status

See `verification.json`. The focused PostgreSQL tests, UI tests, four-width browser smoke, exact-image renderer/job and synthetic backup/restore passed. `tests/verify-greeting-images.py` compares every existing API dist/frontend file with the production base. `tests/greeting-runtime-smoke.cjs` is executed inside the API image with networking disabled and `/evidence` mounted. Browser fixtures mock external requests and never send real social posts.

The full production-based API cannot be validated against a main-only database: existing production notification migrations require tables absent from main. Restore an actual production backup into an isolated environment, verify it, then apply only the additive greeting migration through the controlled release process. Do not run every main migration blindly on production. Preserve table/assets/audit records during code rollback.

Released to production on 2026-11-11 after an on-demand backup, isolated restore and migration verification. The existing API runs the scheduler and the public current endpoint returned the published artwork. Dot authorization remains pending.

After restore/UAT gates pass: re-read live revisions; push immutable candidate digests; record rollback digests; migrate; deploy API, member and admin sequentially with publish-production.ps1; enable publication settings only after compatibility checks; verify real authenticated workflows and public image/OG/CORS. After the release gates pass, enable `DAILY_GREETING_API_SCHEDULER_ENABLED=true` with `DAILY_GREETING_PUBLISHING_ENABLED=true` in the existing API (keep at least one replica). It catches up asynchronously at startup, resolves the released Asia/Taipei date at the 07:00 boundary, retries failures from 30 seconds to 15 minutes, and uses existing PostgreSQL date locks and stable idempotency keys across replicas. Native rendering runs on the bounded worker-thread queue. Set the scheduler flag false to stop future dispatches on restart. No separate cloud Job is required. Use a real approved template policy reference for automatic template publication. Keep arbitrary uploads subject to review and keep the dot endpoint disabled.

Actual-image dual-process scheduler smoke passed against a disposable local PostgreSQL database: both replicas observed the same publication ID, one row and one upload/publish audit pair; 10 ms heartbeat timers continued during rendering. Lifecycle/date-boundary/retry tests and PostgreSQL concurrency/restart tests are in the API test suite. This validates the scheduler services in the exact candidate image, not full production-schema boot or a live 07:00 execution.
