# Company Ball independent operating unit — PO clarification

Integration note: this docs-only decision was rebased over upstream `66c9669` (provider manual retry, including an upstream migration). Those implementation changes were not authored, deployed or tested by this decision task. The recorded closure source-hash check predates that upstream commit and remains evidence for its declared baseline; it is not a claim that all current production sources still match that older inventory. This decision commit changes only governance/ux-v2 files.

Status: APPROVED PRINCIPLE; implementation remains outside Phase 1. Source: Product Owner's direct message in the architecture review conversation:

> 公司球也是獨立的運營單位，主要用於水庫與策略調整用，跟其他球一樣會影響順序

## Adopted domain meaning

Each Company Ball is an independent operating Qualification, not a placeholder or a single merged Company node. Its identity, Sponsor relationships, actual referral sequence, calculation evidence, Carry and entitlement remain Ball-specific. CompanyPrincipal identifies ownership; it does not collapse distinct operating Balls.

Company Balls participate in actual Sponsor ordering like other Balls. A real Company Ball referral consumes the applicable Sponsor's ordinary sequence number. Do not skip company referrals, reset numbering for founding members, assign numbers from canonical Binary position, or create fake referrals to satisfy placement. Canonical #1–#7 is Binary position numbering, not Sponsor sequence numbering. Sequence remains per actual Sponsor Qualification, not a global sequence across all company-owned Balls.

Company ownership alone provides no new first/third-left placement exemption. The previous recommendation to prefer a narrow founding exception is withdrawn as the default design. Use actual Sponsor edges and order with existing constraints; a later explicit rule decision would be needed for any exception. Already-approved Always Active and final company-income routing to Reservoir B remain applicable.

Company Balls serve reservoir and strategy operations, while remaining subject to the approved economic rules and evidence requirements. The purpose statement does not specify a reservoir withdrawal, transfer, parameter change or discretionary award command; no such behavior is implemented or newly defined by this record.

## D2 disposition and remaining questions

Resolved: independent operating Ball identity and equal participation in actual referral sequence. Effective company child relationships also use the normal effective-direct-count eligibility predicate; there is no company-only omission. Always Active is not itself proof of an EFFECTIVE lifecycle interval.

Still to specify: actual Sponsor edges for company #1/#2/#3, the designated Company Sponsor Ball(s) for founding #4–#7, bootstrap referral order, and a valid placement flow under the approved first/third-left rule. Binary parent links alone do not supply these Sponsor facts. D1 plan/rank configuration remains unresolved.

Conditional example, not an approved topology: if company #2 and #3 are both actual Sponsor children of #1, inserted in that order, they consume sequences 1 and 2. The next referral to #1 has sequence 3 and must satisfy the existing left-subtree rule. If those Sponsor edges differ, the sequence must be derived from the actual edges instead. No history is synthesized from the Binary diagram.

## Acceptance changes

The 24 founding permutations remain review inputs. They are not all required to succeed: each must be accepted or rejected consistently with actual prior referrals and the approved placement policy. Rejection leaves no partially committed Ball/edge/sequence evidence. Preview is advisory; commit rechecks the actual Sponsor sequence and slot.

Add future tests for company→company and company→member referrals sharing the same Sponsor sequence, independent sequences for distinct company Sponsors, no CompanyPrincipal-level Ball merge, and historical replay preserving the real sequence/direct-count/ancestry evidence. No code, migrations or live tests are performed by this decision record. Production remains BLOCKED.
