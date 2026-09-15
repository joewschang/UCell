# AI Core alignment — R1.0B

## Required boundary
The Intelligence OS specification requires deterministic calculations to remain in the versioned Rule Engine. AI may explain, diagnose, detect anomalies, simulate in isolated datasets and recommend actions, but must not publish rules, change awards, bypass Active, approve returns, change holders or execute payments.

## RC1 implementation conclusion
The current R6 transaction path contains no LLM/AI module writing PV, Award, Settlement, Recovery or Payout. This is **correct for MVP/production safety** and aligned with the Master/MVP specifications, where AI integration is an Adapter/later phase.

## Required future AI integration contract
When AI is enabled, every Skill invocation must record at minimum: actor, qualification_id, skill_id, rule_version, input_hash, output_hash, request_id, correlation_id and timestamp. AI data access must be authorized before retrieval and remain qualification-scoped unless explicit RBAC/ABAC grants broader access.

## Production status
AI Skills are **spec-defined / runtime-deferred**. Their absence does not block the current Admin/Core MVP release, but any future AI runtime must pass a separate AI governance/security gate before accessing production data.
