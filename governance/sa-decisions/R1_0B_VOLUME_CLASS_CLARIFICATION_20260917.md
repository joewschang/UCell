# UCell R1.0B Volume Class Clarification

Status: PRODUCT OWNER APPROVED DOMAIN CLARIFICATION
Date: 2026-09-17
Baseline: R1.0B FROZEN

## 1. Purpose

This decision clarifies the domain semantics of PV, BV, GPV, RPV and EPV. It does not change already-approved R1.0B economic formulas for GPV, RPV or EPV, and it must not create duplicate monetary or volume entitlement.

## 2. Volume class model

### PV

PV is an abstract Point/Performance Volume class/concept. It is not, by itself, a separate R1.0B bonus-bearing concrete volume alongside GPV/RPV/EPV.

Under R1.0B the concrete PV-class business volume types are:

- GPV — General PV: concrete general-performance volume used by the applicable general compensation rules.
- RPV — Repurchase PV: concrete repurchase volume used by Active/repurchase rules.
- EPV — Excess PV: concrete excess-consumption volume used by EPV rules.

A ProductProfile may define PV-related conversion parameters. The effective RuleVersion and recognition purpose determine which concrete PV-class recognition fact is emitted. Abstract PV must not independently create monetary entitlement in addition to GPV/RPV/EPV.

### BV

BV is an abstract/reserved Business Volume class/concept. BV historically represented a possible organizational/business-volume basis, but under the current R1.0B economic rules its former bonus-calculation role has been replaced by GPV where the approved rule specifies GPV/general-performance volume.

R1.0B therefore has no active bonus formula whose monetary entitlement is calculated directly from an abstract BV value. BV remains reserved for domain compatibility, future versioned rules, ERP/analytics or other formally approved use. No concrete BV recognition shall be invented merely to populate the abstract class.

## 3. Recognition model

The authoritative event sequence remains:

`OrderCreated -> PaymentConfirmed -> ConsumptionRecognition -> VolumeRecognition`

PaymentConfirmed alone creates no volume. A qualifying ConsumptionRecognition under ProductProfile + RuleVersion may emit concrete VolumeRecognition facts such as GPV, RPV or EPV.

Recommended logical representation:

- `volume_class = PV`
- `volume_type = GPV | RPV | EPV`
- `amount`
- `qualification_id`
- `source_line_id`
- `recognized_at / period`
- `rule_version / parameter_snapshot`

BV remains a reserved abstract class with no active R1.0B concrete bonus-bearing type unless a later approved RuleVersion explicitly defines one.

## 4. Bonus-engine usage

Bonus engines consume concrete business volume types, never the abstract class name alone:

- Referral / Referral Matching / Binary / Matching / Global / Welfare: consume GPV or the formally defined general-performance basis.
- Repurchase / Active-related routes: consume RPV and the applicable ConsumptionRecognition evidence.
- EPV self/sponsor routes: consume EPV.
- Abstract PV: no direct monetary formula.
- Abstract BV: no active R1.0B direct monetary formula.

Code or configuration equivalent to `bonus = PV * rate` or `bonus = BV * rate` is invalid for R1.0B unless a later approved RuleVersion defines a concrete semantic basis.

## 5. Historical GPV clarification

Historical GPV facts remain GPV. They are not duplicated, renamed or economically migrated into separate PV or BV recognition rows.

For the current domain model, historical GPV can be semantically classified as a concrete PV-class volume type without changing its amount, source, period, Qualification, ledger identity or economic effect. This is classification, not economic migration.

Accordingly, the former pending question `PD-LEGACY-GPV-PVBV-MIGRATION` is resolved for R1.0B as **NO ECONOMIC MIGRATION REQUIRED**. Any physical schema refactor or metadata backfill must be non-monetary, idempotent, reconciliation-proven and must not duplicate historical volume or entitlement.

## 6. Compatibility with prior SA-20260916-06

This decision supersedes only the semantic wording in SA-20260916-06 that described PV and BV as independent concrete values/fields. The invariant that PV must never be hardcoded equal to BV remains valid as a defensive compatibility rule, but neither abstract class independently generates R1.0B monetary entitlement.

All other SA-20260916-06 requirements remain unchanged: order/payment/consumption/volume recognition separation, immutable recognition evidence, Qualification/source/time/parameter scoping, and append-only return reversal/replay.

## 7. Engineering follow-through

Required before Production promotion:

1. Update domain vocabulary, data dictionary, OpenAPI descriptions, Admin/Member labels and tooltips.
2. Verify no active R1.0B bonus path consumes generic PV or BV directly.
3. Preserve GPV/RPV/EPV historical rows and identifiers; prohibit duplicate PV/BV backfill that changes economic totals.
4. Add executable tests proving GPV/RPV/EPV concrete routing and proving abstract PV/BV cannot independently create Award/Ledger credit.
5. If schema metadata is introduced for `volume_class`, migrate/backfill only after reconciliation proves zero economic change.
6. Re-run Golden datasets, replay, Return/Recovery, K0/K1/K2, Carry and release gates.

Production remains blocked by the remaining operational/release obligations and other unresolved decisions.