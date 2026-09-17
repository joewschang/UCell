-- R1.0B Decision Register v3: prospective, append-only evidence only.
-- No historical volume row is copied, reclassified, or economically changed.

CREATE TYPE ledger."VolumeClass" AS ENUM ('PV','BV');
CREATE TYPE ledger."ConcreteVolumeType" AS ENUM ('GPV','RPV','EPV');
CREATE TYPE ledger."RecognitionDirection" AS ENUM ('ORIGINAL','REVERSAL');
CREATE TYPE ledger."TheoryKind" AS ENUM ('REFERRAL','REFERRAL_MATCHING','BINARY_MATCHING');
CREATE TYPE ledger."SettlementSlot" AS ENUM ('TENTH','TWENTY_FIFTH');
CREATE TYPE ledger."ReservoirEffectType" AS ENUM ('GLOBAL_UNDISTRIBUTED');

CREATE TABLE ledger.consumption_recognition_event (
  consumption_recognition_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  source_type text NOT NULL, source_id uuid NOT NULL, source_line_id uuid, direction ledger."RecognitionDirection" NOT NULL DEFAULT 'ORIGINAL',
  eligible boolean NOT NULL, eligible_amount numeric(18,4) NOT NULL, exclusion_reason_code text, recognition_purpose text NOT NULL,
  product_profile_version text NOT NULL, rule_version_code text NOT NULL, parameter_snapshot_hash text NOT NULL,
  recognized_at timestamptz NOT NULL, recognition_month date NOT NULL, timezone text NOT NULL DEFAULT 'Asia/Taipei',
  reversal_of_event_id uuid REFERENCES ledger.consumption_recognition_event(consumption_recognition_event_id), idempotency_key text NOT NULL UNIQUE,
  correlation_id uuid NOT NULL, evidence_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_consumption_recognition_source UNIQUE NULLS NOT DISTINCT (source_type,source_id,source_line_id,direction),
  CONSTRAINT ck_consumption_recognition_amount CHECK ((eligible AND eligible_amount > 0 AND exclusion_reason_code IS NULL) OR (NOT eligible AND eligible_amount = 0 AND exclusion_reason_code IS NOT NULL) OR (direction = 'REVERSAL' AND eligible_amount < 0 AND reversal_of_event_id IS NOT NULL)),
  CONSTRAINT ck_consumption_recognition_reversal CHECK ((direction = 'ORIGINAL' AND reversal_of_event_id IS NULL) OR (direction = 'REVERSAL' AND reversal_of_event_id IS NOT NULL)),
  CONSTRAINT ck_consumption_recognition_timezone CHECK (timezone = 'Asia/Taipei')
);
CREATE INDEX ix_consumption_recognition_qualification_month ON ledger.consumption_recognition_event(qualification_id,recognition_month,recognized_at);

CREATE TABLE ledger.volume_recognition_classification (
  volume_recognition_classification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), volume_event_id uuid NOT NULL UNIQUE REFERENCES ledger.pv_ledger(event_id),
  volume_class ledger."VolumeClass" NOT NULL, concrete_volume_type ledger."ConcreteVolumeType" NOT NULL, classification_version text NOT NULL,
  rule_version_code text NOT NULL, evidence_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_r1b_concrete_volume_class CHECK (volume_class = 'PV')
);
CREATE INDEX ix_volume_recognition_classification_type ON ledger.volume_recognition_classification(volume_class,concrete_volume_type);
CREATE FUNCTION ledger.validate_concrete_volume_classification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actual_type text; BEGIN
  SELECT pv_type::text INTO actual_type FROM ledger.pv_ledger WHERE event_id = NEW.volume_event_id;
  IF actual_type IS DISTINCT FROM NEW.concrete_volume_type::text THEN RAISE EXCEPTION 'CONCRETE_VOLUME_TYPE_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_concrete_volume_classification BEFORE INSERT ON ledger.volume_recognition_classification FOR EACH ROW EXECUTE FUNCTION ledger.validate_concrete_volume_classification();

CREATE TABLE ledger.qualification_month_accumulator_evidence (
  qualification_month_accumulator_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  calendar_month date NOT NULL, consumption_recognition_event_id uuid NOT NULL REFERENCES ledger.consumption_recognition_event(consumption_recognition_event_id),
  replay_run_id uuid REFERENCES ledger.settlement_replay_run(settlement_replay_run_id), cumulative_before numeric(18,4) NOT NULL,
  eligible_delta numeric(18,4) NOT NULL, cumulative_after numeric(18,4) NOT NULL, active_threshold numeric(18,4) NOT NULL,
  threshold_crossed boolean NOT NULL, epv_after numeric(18,4) NOT NULL, sequence_no integer NOT NULL, rule_version_code text NOT NULL,
  evidence_hash text NOT NULL, idempotency_key text NOT NULL UNIQUE, recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_qualification_month_accumulator_sequence UNIQUE (qualification_id,calendar_month,sequence_no),
  CONSTRAINT ck_qualification_month_accumulator_math CHECK (cumulative_after = cumulative_before + eligible_delta),
  CONSTRAINT ck_qualification_month_accumulator_nonnegative CHECK (cumulative_before >= 0 AND cumulative_after >= 0 AND active_threshold > 0 AND epv_after >= 0),
  CONSTRAINT ck_qualification_month_threshold_crossing CHECK (threshold_crossed = (cumulative_before < active_threshold AND cumulative_after >= active_threshold))
);
CREATE INDEX ix_qualification_month_accumulator_scope ON ledger.qualification_month_accumulator_evidence(qualification_id,calendar_month,recorded_at);

CREATE TABLE ledger.active_interval_evidence (
  active_interval_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  calendar_month date NOT NULL, source_accumulator_evidence_id uuid NOT NULL REFERENCES ledger.qualification_month_accumulator_evidence(qualification_month_accumulator_evidence_id),
  active_from timestamptz NOT NULL, active_to timestamptz NOT NULL, supersedes_active_evidence_id uuid REFERENCES ledger.active_interval_evidence(active_interval_evidence_id),
  replay_run_id uuid REFERENCES ledger.settlement_replay_run(settlement_replay_run_id), reason_code text NOT NULL, rule_version_code text NOT NULL,
  evidence_hash text NOT NULL, idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_active_interval_order CHECK (active_to > active_from)
);
CREATE INDEX ix_active_interval_evidence_scope ON ledger.active_interval_evidence(qualification_id,calendar_month,active_from);

CREATE TABLE ledger.theory_calculation_evidence (
  theory_calculation_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), theory_kind ledger."TheoryKind" NOT NULL,
  source_volume_event_id uuid NOT NULL REFERENCES ledger.pv_ledger(event_id), source_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  recipient_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id), fixed_generation_no integer NOT NULL,
  base_amount numeric(18,4) NOT NULL, rate_snapshot numeric(10,8) NOT NULL, theory_amount numeric(18,4) NOT NULL,
  active_snapshot boolean NOT NULL, unlock_eligible_snapshot boolean NOT NULL, reason_code text NOT NULL,
  historical_sponsor_path_hash text NOT NULL, rule_version_code text NOT NULL, parameter_snapshot_hash text NOT NULL,
  occurred_at timestamptz NOT NULL, idempotency_key text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_theory_fixed_generation UNIQUE (theory_kind,source_volume_event_id,recipient_qualification_id,fixed_generation_no),
  CONSTRAINT ck_theory_generation CHECK (fixed_generation_no >= 1),
  CONSTRAINT ck_theory_amount CHECK (base_amount >= 0 AND rate_snapshot >= 0 AND theory_amount >= 0),
  CONSTRAINT ck_theory_zero_evidence CHECK ((active_snapshot AND unlock_eligible_snapshot) OR theory_amount = 0)
);
CREATE INDEX ix_theory_evidence_recipient ON ledger.theory_calculation_evidence(recipient_qualification_id,theory_kind,occurred_at);

CREATE TABLE ledger.binary_volume_ledger (
  binary_volume_ledger_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_volume_event_id uuid NOT NULL REFERENCES ledger.pv_ledger(event_id),
  source_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id), ancestor_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  binary_generation_no integer NOT NULL, side organization."SideCode" NOT NULL, amount numeric(18,4) NOT NULL, occurred_at timestamptz NOT NULL,
  qualification_scope_hash text NOT NULL, historical_binary_path_hash text NOT NULL, rule_version_code text NOT NULL,
  idempotency_key text NOT NULL UNIQUE, reversal_of_binary_volume_ledger_id uuid REFERENCES ledger.binary_volume_ledger(binary_volume_ledger_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_binary_volume_propagation UNIQUE (source_volume_event_id,ancestor_qualification_id,binary_generation_no),
  CONSTRAINT ck_binary_volume_generation CHECK (binary_generation_no >= 1), CONSTRAINT ck_binary_volume_amount CHECK (amount <> 0),
  CONSTRAINT ck_binary_volume_self CHECK (source_qualification_id <> ancestor_qualification_id),
  CONSTRAINT ck_binary_volume_reversal CHECK ((amount > 0 AND reversal_of_binary_volume_ledger_id IS NULL) OR (amount < 0 AND reversal_of_binary_volume_ledger_id IS NOT NULL))
);
CREATE INDEX ix_binary_volume_qualification_period ON ledger.binary_volume_ledger(ancestor_qualification_id,occurred_at,side);

CREATE TABLE rules.business_calendar_version (
  business_calendar_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version_code text NOT NULL UNIQUE, timezone text NOT NULL DEFAULT 'Asia/Taipei',
  effective_from date NOT NULL, effective_to date, approval_reference text NOT NULL, calendar_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_business_calendar_timezone CHECK (timezone = 'Asia/Taipei'),
  CONSTRAINT ck_business_calendar_effective_range CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX ix_business_calendar_effective ON rules.business_calendar_version(effective_from,effective_to);
CREATE TABLE rules.business_calendar_date (
  business_calendar_date_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_calendar_version_id uuid NOT NULL REFERENCES rules.business_calendar_version(business_calendar_version_id),
  calendar_date date NOT NULL, is_business_day boolean NOT NULL, holiday_reason text, holiday_source text, evidence_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT uq_business_calendar_date UNIQUE (business_calendar_version_id,calendar_date),
  CONSTRAINT ck_business_calendar_holiday_reason CHECK (is_business_day OR (holiday_reason IS NOT NULL AND holiday_source IS NOT NULL))
);
CREATE INDEX ix_business_calendar_date_lookup ON rules.business_calendar_date(calendar_date,is_business_day);

CREATE TABLE ledger.settlement_calendar_evidence (
  settlement_calendar_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settlement_batch_id uuid NOT NULL UNIQUE REFERENCES ledger.settlement_batch(settlement_batch_id),
  settlement_date date NOT NULL, settlement_slot ledger."SettlementSlot" NOT NULL, business_calendar_version_id uuid NOT NULL REFERENCES rules.business_calendar_version(business_calendar_version_id),
  timezone text NOT NULL DEFAULT 'Asia/Taipei', anchor_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_settlement_calendar_timezone CHECK (timezone = 'Asia/Taipei'),
  CONSTRAINT ck_settlement_calendar_slot_date CHECK ((settlement_slot = 'TENTH' AND extract(day from settlement_date) = 10) OR (settlement_slot = 'TWENTY_FIFTH' AND extract(day from settlement_date) = 25))
);
CREATE INDEX ix_settlement_calendar_date ON ledger.settlement_calendar_evidence(settlement_date,settlement_slot);

CREATE TABLE ledger.award_payout_anchor (
  award_payout_anchor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bonus_award_id uuid NOT NULL UNIQUE REFERENCES ledger.bonus_award(bonus_award_id),
  settlement_calendar_evidence_id uuid NOT NULL REFERENCES ledger.settlement_calendar_evidence(settlement_calendar_evidence_id), settlement_date date NOT NULL,
  nominal_payout_date date NOT NULL, adjusted_payout_date date NOT NULL, business_calendar_version_id uuid NOT NULL REFERENCES rules.business_calendar_version(business_calendar_version_id),
  anchor_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT ck_award_payout_adjustment CHECK (adjusted_payout_date >= nominal_payout_date)
);
CREATE INDEX ix_award_payout_adjusted_date ON ledger.award_payout_anchor(adjusted_payout_date);

CREATE TABLE ledger.reservoir_ledger_effect (
  reservoir_ledger_effect_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reservoir_code text NOT NULL DEFAULT 'A', effect_type ledger."ReservoirEffectType" NOT NULL,
  source_global_settlement_id uuid NOT NULL REFERENCES ledger.global_pool_settlement(global_pool_settlement_id), source_period_start timestamptz NOT NULL,
  source_period_end timestamptz NOT NULL, amount numeric(18,4) NOT NULL, rule_version_code text NOT NULL, idempotency_key text NOT NULL UNIQUE,
  evidence_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reservoir_source_effect UNIQUE (reservoir_code,effect_type,source_global_settlement_id), CONSTRAINT ck_reservoir_a_only CHECK (reservoir_code = 'A'),
  CONSTRAINT ck_reservoir_amount CHECK (amount >= 0), CONSTRAINT ck_reservoir_period CHECK (source_period_end > source_period_start)
);
CREATE INDEX ix_reservoir_period ON ledger.reservoir_ledger_effect(reservoir_code,source_period_end);
CREATE FUNCTION ledger.validate_reservoir_a_effect() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_row ledger.global_pool_settlement%ROWTYPE; BEGIN
  SELECT * INTO source_row FROM ledger.global_pool_settlement WHERE global_pool_settlement_id = NEW.source_global_settlement_id;
  IF NEW.amount <> source_row.undistributed_amount OR NEW.source_period_start <> source_row.period_start OR NEW.source_period_end <> source_row.period_end OR NEW.rule_version_code <> source_row.rule_version_code THEN RAISE EXCEPTION 'RESERVOIR_A_SOURCE_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_reservoir_a_effect BEFORE INSERT ON ledger.reservoir_ledger_effect FOR EACH ROW EXECUTE FUNCTION ledger.validate_reservoir_a_effect();

CREATE TRIGGER trg_consumption_recognition_event_append_only BEFORE UPDATE OR DELETE ON ledger.consumption_recognition_event FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_volume_recognition_classification_append_only BEFORE UPDATE OR DELETE ON ledger.volume_recognition_classification FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_qualification_month_accumulator_append_only BEFORE UPDATE OR DELETE ON ledger.qualification_month_accumulator_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_active_interval_evidence_append_only BEFORE UPDATE OR DELETE ON ledger.active_interval_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_theory_calculation_evidence_append_only BEFORE UPDATE OR DELETE ON ledger.theory_calculation_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_binary_volume_ledger_append_only BEFORE UPDATE OR DELETE ON ledger.binary_volume_ledger FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_business_calendar_version_append_only BEFORE UPDATE OR DELETE ON rules.business_calendar_version FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_business_calendar_date_append_only BEFORE UPDATE OR DELETE ON rules.business_calendar_date FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_settlement_calendar_evidence_append_only BEFORE UPDATE OR DELETE ON ledger.settlement_calendar_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_award_payout_anchor_append_only BEFORE UPDATE OR DELETE ON ledger.award_payout_anchor FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_reservoir_ledger_effect_append_only BEFORE UPDATE OR DELETE ON ledger.reservoir_ledger_effect FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

DROP TRIGGER IF EXISTS trg_welfare_pool_no_delete ON ledger.welfare_pool_accrual;
CREATE TRIGGER trg_global_pool_settlement_append_only BEFORE UPDATE OR DELETE ON ledger.global_pool_settlement FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER trg_welfare_pool_accrual_append_only BEFORE UPDATE OR DELETE ON ledger.welfare_pool_accrual FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

COMMENT ON TABLE ledger.volume_recognition_classification IS 'One-to-one non-monetary classification of an existing concrete GPV/RPV/EPV fact. It never duplicates ledger volume.';
COMMENT ON TABLE ledger.theory_calculation_evidence IS 'Immediate referral/matching theory evidence, including explicit zero fixed generations. It is not a payable or monetary credit.';
COMMENT ON TABLE ledger.reservoir_ledger_effect IS 'Append-only, exactly-once Reservoir A receipt of a source Global period undistributed balance.';
