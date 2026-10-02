# UCell AI / Analytics Data Firewall Threat Model v1

Status: DESIGN ONLY. No LLM/runtime integration is authorized yet.

| Threat | Required control | Expected result |
|---|---|---|
| RBAC bypass | server policy before retrieval | DENY |
| Reservoir probing | C3 dataset isolation + Member zero-disclosure | DENY/no existence leak |
| Bootstrap #1-#3 probing | MEMBER_VISIBLE scope invariant | absent |
| PII enumeration | detail policy, rate limit, minimum necessary fields | DENY/limited |
| UUID enumeration | business IDs in UX; BOLA on internal refs | DENY |
| Prompt injection in DB text | retrieved text treated as untrusted DATA | no tool/policy expansion |
| Free-form SQL | no SQL tool; governed DSL only | impossible |
| Write request | first AI runtime read-only; no write tools | DENY |
| Join fan-out | approved joins/cardinality compiler | DENY unsafe plan |
| Historical rewrite | historical evidence/version required | UNKNOWN if absent |
| Stale ERP | freshness/dataThrough | explicit STALE/UNKNOWN |
| Export leakage | export permission <= interactive permission | DENY/redact |
| Large extraction | row/date/cardinality/cost limits | block/background |
| Secret exposure | secrets excluded from analytics schema/tools | impossible by contract |
| Cross-role cached result | cache key includes identity/policy/scope/version | no cross-role reuse |
| Metric hallucination | CERTIFIED metric allowlist | non-official or deny |
| Authority conflict | conflict blocks certification | no official answer |
| Codex-to-prod path | separate development/runtime credentials and human gates | impossible |
| Model output PII leak | output scanner/redaction + evidence policy | redact/block |

Hard invariants:
1. LLM never receives Production DB credentials.
2. No executeSql tool.
3. No write/mutation tool in first AI release.
4. Policy/RBAC/privacy checks occur before data retrieval, not after LLM response.
5. Reservoir and secrets are absent from unauthorized tool schemas.
6. All official facts use CERTIFIED metrics with version/asOf/dataThrough/evidence.
7. Retrieved content can never change tool permissions.
8. Codex development workflow is separate from Production AI runtime.
