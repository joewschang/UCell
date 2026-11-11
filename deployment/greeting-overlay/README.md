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

No production update, production database migration, cloud job or dot credential has been applied. A narrowly scoped temporary workstation database firewall rule and the paid scheduled job/database access require the requested user confirmation. Do not treat this PR or local images as deployment evidence.

After restore/UAT gates pass: re-read live revisions; push immutable candidate digests; record rollback digests; migrate; deploy API, member and admin sequentially with publish-production.ps1; enable publication settings only after compatibility checks; verify real authenticated workflows and public image/OG/CORS. A separately approved Container Apps Job should use `node /app/apps/api/dist/daily-greeting-job.js`, UTC `0 23 * * *`, parallelism/completion count 1, 0.5 CPU/1 GiB, timeout 180 seconds and retry limit 2. Use a real approved template policy reference for automatic template publication. Keep arbitrary uploads subject to review and keep the dot endpoint disabled.
