# Formal enrollment API change approval — 2026-10-03

## Authority and exact scope

Product/API owner Wei-Shiang Chang (Joe Chang; repository owner @joewschang) explicitly approved all twelve changes in the conversation at 2026-10-03 10:01:08 Asia/Taipei:

> 這些都是必要的修正，全部核准

This records acceptance of the intentional contract changes, including added required inputs, LEGAL_ENTITY response enum values and removal of nationalId. It does not require reverting these approved changes to the previous contract.

The exact approved findings are retained in governance/swaggerhub/evidence/formal-enrollment-openapi-breaking-diff-20261003.json (also deployment/stage-integration-openapi-breaking-diff-20261003.json).

| Fingerprint | Operation | Approved change |
| --- | --- | --- |
| 63ca0ce97e23 | POST /api/v1/admin/membership-applications | required holderType |
| c207eb974cc3 | GET /api/v1/admin/persons/{personId}/qualifications | ownerType adds LEGAL_ENTITY |
| 5b3340e8384a | POST /api/v1/admin/qualifications | required holderType |
| b2db469931e3 | GET /api/v1/admin/qualifications/{qualificationId} | ownerType adds LEGAL_ENTITY |
| 1a42e8a3f12b | POST /api/v1/member/formal-applications | required identityDocumentNumber |
| 76ef50157f2c | POST /api/v1/member/formal-applications | required identityDocumentType |
| e3bea22c0587 | POST /api/v1/member/formal-applications | required nationalityCode |
| 6d4fe9871fb6 | POST /api/v1/member/formal-applications | required hasSpouse with default |
| 46b44a9e5904 | POST /api/v1/member/registration/network | required identityDocumentNumber |
| 50203ad399a1 | POST /api/v1/member/registration/network | required identityDocumentType |
| 786f9972dfbe | POST /api/v1/member/registration/network | required nationalityCode |
| fba5d2daa0f6 | POST /api/v1/member/formal-applications | remove nationalId |

## Gate disposition

Business/API-owner approval: APPROVED for the exact twelve findings above.

Technical gate status is separate. The current gate has no per-finding waiver mechanism. This approval record alone does not change the baseline or make CI pass. Implement the existing separately reviewable pre-GA baseline maintenance process with preserved prior bytes, exact candidate hash, pinned-tool diff evidence and baseline-promotions manifest; any additional findings require separate review. Do not suppress oasdiff checks, weaken validation/security checks or fabricate passing receipts.

Keep client/server contract tests and migration review for these accepted changes. This approval does not authorize Production rollout, main merge, automatic inactivity recovery, unrelated breaking changes, or SwaggerHub publication without the existing successful gates.
