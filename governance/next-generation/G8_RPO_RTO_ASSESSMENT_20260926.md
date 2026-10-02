# G8 RPO/RTO assessment — 2026-09-26

Authority: Phase-1 business decision section 15.

- **RPO_TARGET = 1H**
- **RTO_TARGET = 4H**

## Evidence

Stage Azure PostgreSQL provides point-in-time recovery for seven days. A controlled restore selected `2026-09-26T09:30:00Z`, created an isolated target, verified the restored 86-migration point and append-only audit protection, then deleted it. The selected recovery point was within one hour of the drill execution window.

- **RPO_EVIDENCE = PASS (Stage capability)** — PITR supports a selected point inside the one-hour objective; seven-day retention alone is not the basis of this result.
- **RTO_EVIDENCE = PASS (Stage drill)** — isolated target provisioning, controlled connectivity preparation and verification completed well inside four hours. This is Stage evidence only; future Production topology/scale changes require a new assessment.

This assessment does not remove the remaining G8 external blockers.
