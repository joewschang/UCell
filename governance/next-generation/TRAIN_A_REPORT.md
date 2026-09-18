# Train A implementation report

Status: PASS for Train A validation. Code checkpoint 6072bb1df679adea610e10ab6436f57635e0351f; this report-only commit completes the checkpoint. Clean working tree and local/origin equality must be verified immediately after push before Train B. Train B has not started. This is a provider-free foundation, not deployment or Production approval.

## Baseline and recovery

Repository joewschang/UCell; branch integration/member-backend-mvp. Dedicated checkout C:/UCell/next-generation. Original C:/UCell/UCell contains unrelated uncommitted Worker work and was not modified. The dedicated clone began clean at 330162b38a81097259a3e4e9d8b24ff49fdc7f6a. Power recovery synchronized 84032c6 then 14b714fdb4487580ac2ef63bd8fac294e40b1e10; subsequent integration baseline was 93a811e24b7dd3555d93bcbc1828f0c933c2265a, then 0fe7bc2d2838f3d5d93b4f452dddaa68cf71bff0 (provider certification/workload harness additions). All were fast-forward integrations preserving local work.

Ending implementation HEAD: 6072bb1df679adea610e10ab6436f57635e0351f. The following report-only checkpoint commit records that immutable code revision; its own SHA is necessarily outside its content.

53 migrations throughout Train A; Prisma schema and existing migrations unchanged. OpenAPI: 155 at initial/14b714f baseline, 157 at 93a811e/0fe7bc2 upstream, 159 with this implementation. Existing 157 operation objects are semantically unchanged; added memberStructuredExplain and adminExplainReservoir only. Generated JSON ordering accounts for unrelated-looking diff movement.

Node 24.21.0; pnpm 12.4.1; Prisma 6.19.3. Member node_modules contained interruption damage; prior directories were retained outside the checkout and a clean isolated store restored frozen-lockfile installation. All source files checked after the second outage were intact. Tests use the dedicated local PostgreSQL container on 127.0.0.1:55432 and disposable named databases. No existing application database was stopped, dropped or reset.

## Implemented

25 typed business terms, 17 registered metrics, ExplainCode and 14 event/evidence definitions; qualification/Person, Sponsor/Binary, abstract PV/BV and concrete GPV/RPV/EPV remain distinct. Reusable typed EvidenceEnvelope, AsOfContext and server-derived UCellRequestContext enforce explicit scope, effective/recorded time, rule/parameter versions and evidence quality.

Backend Explain reads cover Active, Performance, Binary Pair/Carry, Award, Settlement, Payout, posted Return impact and Reservoir A. B and tree contracts fail closed pending activation. Member and Admin HTTP adapters validate live authorization before and after reads, bound reads in repeatable-read transactions, disable response caching, minimize fields and persist safe audit metadata. No economic calculation or posting service is called.

The provider-free simulator dispatches Explain plus allowlisted queryMetric and governed lookupKnowledge. KnowledgeDocument/Unit contracts include approval/version/hash/effective/recorded-time evidence; no documents are implicitly approved, ingested or embedded. Classification blocks secrets and masks reviewed sensitive field aliases. Logical canonical routes reject arbitrary query/path input and grant no authorization.

Existing UAT frontend tests used a fixed 20ms sleep and failed under concurrent load. They now wait for actual query completion; product behavior is unchanged.

## Evidence and invariants

See [PASS/FAIL matrix](TRAIN_A_PASS_FAIL_MATRIX.md) and [supported reads](TRAIN_A_SUPPORTED_READS.md). Original baseline API was 63 suites / 604 tests; Shared 68, Member 142 and Admin 68. First integrated API was 68 suites / 664 tests. Final synchronized API is 69 suites / 673 tests after the upstream provider harness integration. Train A adds 34 API cases and 113 Shared cases; 24 existing question IDs have executable boundary mappings, with explicit unsupported/unavailable behavior rather than a fabricated 120-case completion claim. An additional 16 real PostgreSQL/HTTP assertions exercise the new endpoint alongside 86 existing adapter/HTTP assertions.

Decision v3 T01–T17, existing economic golden cases, all API historical/replay cases and RC database replay pass. Boundary B01–B05 map to Shared calendar tests; B06–B09 to recognition-active-db; B10–B11 to a-decision-return; B12 to global-pool-calculation; B13–B14 to global-pool-persistence; B15–B20 to boundary-qualification. No economic writer, Worker, Prisma schema or historical migration changed. Read tests preserve stored Final even when a synthetic fixture differs from Theory times K and verify the stored Award is unchanged after requests. Existing member-only economic fixtures show no regression.

The first preflight attempt reached all offline/economic/security PASS checks and Prisma validate, then hit a Windows DLL rename lock because DB tests were still running. Serialized retry and RC passed. An Admin test attempt failed due to fixed-time waiting; corrected tests passed. These are not hidden or relabeled as successful first attempts.

## Company decisions and remaining scope

Issue #2 body and all 8 comments were retrieved, including D1/D2 disposition 5722342390 and execution directive 5722354891. D1 architecture and D2 are approved; the old Phase 1 stop state is superseded in its historical documents. [Company profile mapping](COMPANY_BOOTSTRAP_PROFILE_V1_PENDING_MAPPING.md) records candidate rates/caps, ordinary unlock/rank rules, provenance and the unresolved exact version/effective binding. Only Company monetary activation remains closed. Always Active is not a maximum plan or rank grant.

Full support limits are explicit in [TRAIN_A_SUPPORTED_READS.md](TRAIN_A_SUPPORTED_READS.md): historical cases lacking authoritative revisions fail closed; Return replay is PARTIAL, analytics has no production execution adapter, and no deployed canonical destination is invented. Company ownership/tree schema, commands, statistics and UI belong to Train B and are not claimed here. No Stage/Production deployment, external AI provider, vector DB, RAG ingestion or Company monetary posting was performed.

Evidence text copies normalize line endings and trailing whitespace only; original command logs remain locally preserved.
