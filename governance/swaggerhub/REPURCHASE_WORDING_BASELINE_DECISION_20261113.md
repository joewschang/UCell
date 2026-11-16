# Repurchase wording baseline maintenance — 2026-11-13

## Authority and exact instruction
Repository/product owner Wei-Shiang Chang (@joewschang) replied to the proposed baseline restoration:

> 文件用語一併改成：重銷（三個月）、重銷（六個月）、重銷（十二月）

This records that owner decision relayed in the owner's Dot conversation. It is not a GitHub review receipt, CI pass, or approval of unrelated contract changes. The proposed restoration of 季/半年/年 wording was superseded, not approved.

Exact terminology: **重銷（三個月）、重銷（六個月）、重銷（十二月）**. 十二月 is preserved as requested; the duration calculation remains twelve months.

## Bound scope
Candidate starting head: 43eaab4cb70b657cce53c0d75bbbdf597def0e98
Previous checked-in baseline SHA-256: ee3ed58ae6502c41ca93199edb0a87e14bcb83c382e048b2e3305a58d9f0baaa
New baseline SHA-256: ce7165674f053fd4b77ecfa7956aff284c5334a9a2d039456fa8c70c91f58b1f
Previous policy-approved hash: 3b99a0207611c55c5d85e4e4d743c51c6b7013ac18b19a254942bdc312259ec3
Archived previous checked-in bytes: governance/swaggerhub/baselines/baseline.openapi.pre-wording-20261113-ee3ed58ae6502c41ca93199edb0a87e14bcb83c382e048b2e3305a58d9f0baaa.json

Only the summary of POST /api/v1/admin/subscriptions changes in the baseline. Source ApiOperation and checked-in generated summaries use the same duration label, retaining their existing no-auto-renewal description. Current reference/planning documents align. Historic decision records and archived baselines remain untouched; this decision supersedes their display labels only.

The previous drift came from 7c4148b47428795649e796ec229f71f9aa6ab074 changing one summary without updating the pin. This is an explicitly authorized documentation maintenance, not a wholesale reset to the generated candidate.

No route, operationId, parameter, request/response schema, status, security requirement, price, duration computation, database identifier or runtime display function changes. Any other compatibility findings remain blocking.

## Verification and release boundaries
Normal gates, CODEOWNERS review and severity settings are unchanged. The fixed oasdiff 1.32.1 comparison uses the existing repository comparisonView normalization; exact differences and results are retained as evidence. Remote CI is authoritative; no pass or separate GitHub review is claimed in this decision. Publication/deployment remain subject to existing release gates.
