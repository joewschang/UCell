# SwaggerHub Release/RC evidence

Implementation/local and hosted OpenAPI verification: PASS. Hosted publication: NOT RUN; activation pending.

Required marker: SWAGGERHUB_SYNC_PASS in R6_RELEASE_GATE.json. RC promotion retrieves successful swaggerhub-sync.yml artifacts for the exact release commit, verifies the generated artifact receipt and private cloud readback hashes/version, and fails for missing/stale/failed evidence. A local PASS snapshot is not accepted for publishing.

The CI publisher writes backend/release/SWAGGERHUB_SYNC_EVIDENCE.json and governance/swaggerhub/evidence/OPENAPI_CONTRACT_REPORT.md after upload verification, including a failure receipt if publication fails. Artifacts are retained for 90 days; signed long-term releases should archive them under existing release evidence retention policy before expiration.

See [contract report](../../OPENAPI_CONTRACT_REPORT.md) and [governance runbook](../../governance/swaggerhub/README.md). No application deployment is included.

Hosted PR validation run: https://github.com/joewschang/UCell/actions/runs/35329872016 for implementation f1e0fc10c216c3547a1a1b30aeaf1cad9f1e9a3e. The generated artifact was downloaded and verified byte-for-byte against local source. See governance/swaggerhub/hosted-verification.json. This verification receipt cannot substitute for SWAGGERHUB_SYNC_PASS: the private publishing job has not run.
