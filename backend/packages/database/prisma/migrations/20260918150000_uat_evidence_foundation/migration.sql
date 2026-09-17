CREATE TYPE "audit"."UatEvidenceClassification" AS ENUM ('LOCAL_ASSISTIVE_ONLY', 'FORMAL_UAT_EVIDENCE');
CREATE TYPE "audit"."UatEvidenceResult" AS ENUM ('PASS', 'FAIL', 'BLOCKED');

CREATE TABLE "audit"."uat_execution_evidence" (
  "uat_execution_evidence_id" UUID NOT NULL,
  "classification" "audit"."UatEvidenceClassification" NOT NULL,
  "environment" TEXT NOT NULL,
  "scenario_code" TEXT NOT NULL,
  "result" "audit"."UatEvidenceResult" NOT NULL,
  "evidence_hash" TEXT NOT NULL,
  "artifact_reference" TEXT NOT NULL,
  "approval_reference" TEXT,
  "actor_id" UUID NOT NULL,
  "executed_at" TIMESTAMPTZ(6) NOT NULL,
  "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "request_id" TEXT NOT NULL,
  "correlation_id" UUID NOT NULL,
  CONSTRAINT "uat_execution_evidence_pkey" PRIMARY KEY ("uat_execution_evidence_id"),
  CONSTRAINT "uat_execution_evidence_hash_check" CHECK ("evidence_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "uat_execution_evidence_scenario_check" CHECK (length(trim("scenario_code")) > 0),
  CONSTRAINT "uat_execution_evidence_artifact_check" CHECK (length(trim("artifact_reference")) > 0),
  CONSTRAINT "uat_execution_evidence_formal_approval_check" CHECK (
    "classification" <> 'FORMAL_UAT_EVIDENCE' OR
    ("approval_reference" IS NOT NULL AND length(trim("approval_reference")) > 0)
  )
);

CREATE UNIQUE INDEX "uat_execution_evidence_classification_environment_scenario_key"
  ON "audit"."uat_execution_evidence"("classification", "environment", "scenario_code", "evidence_hash");
CREATE INDEX "uat_execution_evidence_environment_scenario_recorded_idx"
  ON "audit"."uat_execution_evidence"("environment", "scenario_code", "recorded_at");
CREATE INDEX "uat_execution_evidence_actor_recorded_idx"
  ON "audit"."uat_execution_evidence"("actor_id", "recorded_at");

CREATE FUNCTION "audit"."reject_uat_evidence_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'UAT evidence is append-only';
END;
$$;

CREATE TRIGGER "uat_execution_evidence_append_only"
BEFORE UPDATE OR DELETE ON "audit"."uat_execution_evidence"
FOR EACH ROW EXECUTE FUNCTION "audit"."reject_uat_evidence_mutation"();
