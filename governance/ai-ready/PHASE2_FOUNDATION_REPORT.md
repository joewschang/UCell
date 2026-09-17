# AI-ready foundation implementation — first read-contract slice

Status: IMPLEMENTED AND LOCALLY VERIFIED; not connected to production read services. Authorization: user requested「請繼續開發」after architecture review, then asked to continue. This supersedes the earlier docs-only stop for this bounded foundation work; it does not approve D1/D2, schema migration, provider integration or deployment.

Source starting point: c449af0c207c3287973d4266a7e3759520ab025a. The prior Phase 1 inventory/tests remain historical evidence and are not overwritten to imply unchanged source now that implementation is authorized.

## Delivered behavior

`backend/packages/shared/src/ai-ready/catalog.ts` provides three immutable versioned read definitions with grain, time mode, authoritative-source integration point, dimensions, classification, replay/rounding/null policy and permission key. These are the initial read registry, not a completed catalog of all BI metrics. active.status is the ownership-aware Active result definition; separate member/company business terms remain in the broader catalog proposal.

`read-gateway.ts` provides strict allowlisted request parsing, a typed evidence envelope, source-field projection, server-resolved context and resource authorization hooks. Tool names are getActiveStatus, explainBinaryCarry and explainReservoirB. There is no arbitrary SQL, URL, actor/role override, mutation tool or generic public execution endpoint. Monetary values remain exact source decimal strings; no Core arithmetic is implemented.

Member reads must match the selected Ball and pass the injected authoritative ownership check. A Member cannot read B even if an erroneous B permission is present. Admin reads require an explicit permission plus resource authorization; projected ordinary reads are ADMIN_OPERATIONAL and B is FINANCE_CONFIDENTIAL. The library resolves context and authorization again after reading; changed context or revoked grants suppress the result. Authorizer output, source scope, tree and period must match the request exactly.

Available results require evidence and versions; Carry and B require FINALIZED. Unavailable results must be null, never a fabricated zero. Active reason codes are allowlisted. Invalid source facts fail closed rather than being repaired silently. Source errors are reduced to safe codes. The audit hook receives only tool/version/correlation/outcome; audit failure prevents result release. Invalid request syntax and failure before an authenticated context exists do not invoke this audit hook; future HTTP integration must record safe request-level diagnostics separately.

Source read deadline defaults to 2 seconds, configurable by trusted code between 1 and 5000ms. On expiry the gateway rejects and signals AbortSignal. Adapters must honor the signal to stop their underlying work. This is not an end-to-end SLA: authentication, authorization and controlled audit I/O need their own bounded infrastructure handling when integrated.

## How to run

From backend:

```powershell
pnpm --filter @ucell/shared build
pnpm --filter @ucell/shared test:ai-ready
node scripts/ai-ready-simulator.mjs
```

The simulator runs eight synthetic scenarios and never connects to a database/network/provider. Its IDs, values and rule versions are explicitly synthetic; successful Reservoir B output does not mean a B ledger exists. The fuller contract suite uses deterministic adapters and includes context-change, revocation, field minimization, malformed history/decimals, evidence/finality and deadline cases.

## Executed verification

- Shared TypeScript build: PASS.
- Full Shared Jest suite: 3 suites / 68 tests PASS, including 49 new read-contract tests and the existing 19 tests.
- Backend workspace build: PASS, including API and Worker consuming the shared exports.
- Provider-free simulator: 8/8 PASS; saved at [simulator evidence](evidence/simulator.json).
- Backend TODO gate: PASS.
- Diff whitespace check: PASS before commit.

No database or browser tests were run for this standalone library. No dependencies or lockfile changed. Existing Core calculation, Prisma/schema, migrations, UI, HTTP/OpenAPI routes and deployments are unchanged by this implementation.

## Integration limits and next work

The injected resolveContext/authorize/read/audit functions are trusted server ports. TypeScript interfaces are not authentication: a real adapter must bind them to the existing authenticated request, current grants/ownership, transaction-consistent resource checks and controlled audit facility. Never construct context from model/client role claims. Rechecking reduces stale responses but does not replace database transaction/authorization policy. Evidence IDs and correction references must be authorized/projected by the adapter; this library is not a general PII scanner.

Current-only Active rejects extra asOf/knowledgeCutoff fields. Carry accepts one canonical UTC periodEnd and rejects mismatched source periods. B reads one entry; generalized historical cutoffs, effective-version selection, freshness/STALE, partial results, UI deep links, source-specific schema adapters, retention persistence, knowledge/RAG, all other Explain tools and BI query contracts remain implementation work. No fake authoritative values or broad fallback is provided for those gaps.

Next independent slice is authoritative Active/Carry adapters with real server ownership/RBAC and adapter integration tests, followed by the remaining catalog/Explain contracts. Reservoir B production data remains unavailable until its domain/schema/routing decisions are implemented under separate scope. The earlier 24 golden questions are a proposed corpus, not claimed as fully executed by these 49 tests. D1 and the remaining D2 Sponsor graph/root decisions remain pending; no Company bootstrap has been enabled. Production remains BLOCKED.
