-- UCell R1.0B FROZEN / Backend v0.6.0
-- Compensating facts only. Closed historical settlement facts are never rewritten.
CREATE TYPE ledger."AdjustmentStatus" AS ENUM ('DRAFT','CALCULATED','POSTED','VOIDED');
CREATE TYPE membership."QualificationWorkflowType" AS ENUM ('UPGRADE','TRANSFER','EXIT','COMPANY_RETRANSFER');
CREATE TYPE membership."QualificationWorkflowStatus" AS ENUM ('DRAFT','SUBMITTED','APPROVED','REJECTED','EFFECTIVE','CANCELLED');

CREATE TABLE ledger.settlement_adjustment_batch (
 settlement_adjustment_batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_recalculation_request_id uuid NOT NULL REFERENCES ledger.settlement_recalculation_request(settlement_recalculation_request_id),
 settlement_type text NOT NULL, period_start timestamptz NOT NULL, period_end timestamptz NOT NULL,
 status ledger."AdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
 original_theory numeric(18,4) NOT NULL DEFAULT 0, recomputed_theory numeric(18,4) NOT NULL DEFAULT 0,
 delta_theory numeric(18,4) NOT NULL DEFAULT 0, original_payable numeric(18,4) NOT NULL DEFAULT 0,
 recomputed_payable numeric(18,4) NOT NULL DEFAULT 0, delta_payable numeric(18,4) NOT NULL DEFAULT 0,
 calculation_snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), posted_at timestamptz,
 UNIQUE(source_recalculation_request_id)
);
CREATE TABLE ledger.settlement_adjustment_line (
 settlement_adjustment_line_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 settlement_adjustment_batch_id uuid NOT NULL REFERENCES ledger.settlement_adjustment_batch(settlement_adjustment_batch_id),
 qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 award_type ledger."BonusAwardType" NOT NULL, original_amount numeric(18,4) NOT NULL,
 recomputed_amount numeric(18,4) NOT NULL, delta_amount numeric(18,4) NOT NULL,
 source_reference jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
-- Subscription cancellation intentionally created in migration 0006 under the canonical `subscription` schema.
CREATE TABLE membership.qualification_workflow (
 qualification_workflow_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 workflow_type membership."QualificationWorkflowType" NOT NULL, status membership."QualificationWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
 applicant_person_id uuid REFERENCES identity.person(person_id), receiving_person_id uuid REFERENCES identity.person(person_id),
 target_plan_code text, review_fee numeric(18,2) NOT NULL DEFAULT 600, submitted_at timestamptz, approved_at timestamptz,
 effective_at timestamptz, payload jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
