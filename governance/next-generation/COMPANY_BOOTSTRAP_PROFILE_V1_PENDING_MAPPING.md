# COMPANY_BOOTSTRAP_PROFILE_V1_PENDING_MAPPING

Status: PENDING_MAPPING. D1 architecture and D2 placement are APPROVED; only company monetary activation is closed. Train A and non-monetary Train B continue.

Authority: GitHub Issue #2 comments 5722342390 (D1/D2 disposition) and 5722354891 (execution directive). Reviewed on 2026-09-18 against repository baseline 14b714f. Historical Phase 1 PENDING_D1/PENDING_D2 statements do not supersede these dispositions.

The repository contains no authoritative, uniquely selected mapping from COMPANY_BOOTSTRAP_PROFILE_V1 to a runtime plan scope. Always Active is eligibility only. It cannot select LEADER, a maximum cap, a rank, an unlocked generation depth, or Global qualification. No candidate below is selected by this implementation.

| Required binding | STARTER candidate | ELITE candidate | LEADER candidate | Authority / unresolved selection |
|---|---|---|---|---|
| weekly Binary cap | 450000 | 900000 | 1500000 | migrations/0003_bonus_engine_core/migration.sql, binary.weekly.cap; plan scope unresolved |
| first generation referral | 0.15 | 0.20 | 0.25 | same migration, referral.g1.rate; plan scope unresolved |
| Equalization maximum generation | 4 | 6 | 7 | referral-bonus.service.ts; actual effective direct count still gates unlocked depth |
| Equalization rate G2 onward | .10/.10/.10 | .20/.10/.10/.05/.05 | .20/.15/.10/.10/.10/.05 | same migration, equalization.rate; no automatic maximum unlocking |
| Binary pair rate | .12 | .12 | .12 | binary.pair.rate wildcard; common rate does not settle profile binding |
| Matching G1–G5 | .15/.10/.05/.05/.05 | same | same | matching.rate wildcard; actual eligibility remains authoritative |
| Carry | Core stored carry/replay projection | same | same | binary-bonus.service.ts, BinaryCarry and ReplayCarryProjection; bootstrap starting state and selected profile binding must be explicit |
| Global / rank | historical evidence required | historical evidence required | historical evidence required | QualificationGlobalRankHistory and Global Core; Always Active grants neither rank nor Global eligibility |
| rule/version/effective interval | R1.0B candidate | R1.0B candidate | R1.0B candidate | seed effectiveFrom 2026-09-01T00:00:00+08:00; this is NOT an approved company-profile effective interval |

Paths in table are under backend/packages/database/prisma or backend/apps/api/src/modules/bonus. Current runtime overrides and parameter snapshot hashes must be resolved at the approved effective interval; seed values are candidate provenance, never authority to activate an unspecified profile. Existing award.pending.days seed is superseded by the approved business-calendar behavior and must not be reused as literal date arithmetic.

Required disposition before activation: selected cap and Carry policy; referral/equalization scope and ordinary direct-count gates; matching eligibility; Global/rank policy; exact rule/profile versions; effectiveFrom/effectiveTo and snapshot binding. Until then, no Company economic calculation, Reservoir B posting, or default maximum-plan assignment.

After approval, normal Core produces recognition → Theory → pool/K → Final first; the versioned recipient policy routes company-owned final entitlement to Reservoir B. This document does not authorize an alternative calculator.

D2 stays approved: per-tree CompanySponsor/root #1; #2 Sponsor #1 sequence 1 LEFT; #3 Sponsor #1 sequence 2 RIGHT; #4/#5 below #2 and #6/#7 below #3. Actual Sponsor chronology is separate from canonical Binary positions. No fake Person, renumbering, skipped sequence, invented sponsor or placement exemption.

Member-origin Qualifications taken into company ownership remain MEMBER_ORIGIN, retain historical plan/identity/Carry, and use effective ownership routing. They never silently acquire COMPANY_BOOTSTRAP_PROFILE_V1.
