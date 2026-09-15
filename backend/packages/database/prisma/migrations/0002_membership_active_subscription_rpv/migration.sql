CREATE SCHEMA IF NOT EXISTS subscription;

CREATE TYPE membership."ApplicationStatus" AS ENUM (
  'DRAFT','SUBMITTED','APPROVED','REJECTED','EFFECTIVE','VOIDED'
);
CREATE TYPE subscription."SubscriptionStatus" AS ENUM (
  'PENDING','ACTIVE','SUSPENDED','CANCELLED','COMPLETED'
);
CREATE TYPE subscription."RecognitionStatus" AS ENUM (
  'SCHEDULED','DUE','RECOGNIZED','CANCELLED','REVERSED'
);

CREATE TABLE membership.membership_application (
  application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.person(person_id),
  requested_plan_level_code text NOT NULL CHECK (requested_plan_level_code IN ('STARTER','ELITE','LEADER')),
  sponsor_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  binary_parent_qualification_id uuid REFERENCES membership.qualification(qualification_id),
  binary_side text CHECK (binary_side IS NULL OR binary_side IN ('LEFT','RIGHT')),
  status membership."ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  effective_at timestamptz,
  created_qualification_id uuid UNIQUE REFERENCES membership.qualification(qualification_id),
  source_referral_token_hash text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_membership_application_person_status
ON membership.membership_application(person_id,status);
CREATE INDEX ix_membership_application_sponsor
ON membership.membership_application(sponsor_qualification_id);

CREATE TRIGGER trg_membership_application_updated_at
BEFORE UPDATE ON membership.membership_application
FOR EACH ROW EXECUTE FUNCTION public.ucell_set_updated_at();

CREATE TABLE membership.active_period (
  active_period_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  active_from timestamptz NOT NULL,
  active_to timestamptz,
  source_type text NOT NULL,
  source_id uuid,
  rule_version_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (active_to IS NULL OR active_to > active_from)
);
CREATE INDEX ix_active_period_q_time
ON membership.active_period(qualification_id,active_from,active_to);

CREATE OR REPLACE FUNCTION membership.ucell_is_active_at(
  p_qualification_id uuid,
  p_at timestamptz
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS(
    SELECT 1
      FROM membership.active_period ap
     WHERE ap.qualification_id = p_qualification_id
       AND ap.active_from <= p_at
       AND (ap.active_to IS NULL OR ap.active_to > p_at)
  );
$$;

CREATE TABLE subscription.subscription_plan (
  subscription_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL UNIQUE,
  display_name text NOT NULL,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  prepaid_amount numeric(18,2) NOT NULL CHECK (prepaid_amount > 0),
  product_box_qty integer NOT NULL CHECK (product_box_qty >= 0),
  monthly_recognized_amount numeric(18,2) NOT NULL CHECK (monthly_recognized_amount > 0),
  monthly_rpv numeric(18,4) NOT NULL CHECK (monthly_rpv > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO subscription.subscription_plan
(plan_code,display_name,duration_months,prepaid_amount,product_box_qty,monthly_recognized_amount,monthly_rpv)
VALUES
('QUARTER','季方案',3,6000,2,2000,1200),
('HALF_YEAR','半年方案',6,12000,4,2000,1200),
('YEAR','一年方案',12,24000,8,2000,1200)
ON CONFLICT (plan_code) DO NOTHING;

CREATE TABLE subscription.subscription (
  subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  subscription_plan_id uuid NOT NULL REFERENCES subscription.subscription_plan(subscription_plan_id),
  order_id uuid REFERENCES commerce."order"(order_id),
  status subscription."SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
  start_month date NOT NULL,
  end_month date NOT NULL,
  rule_version_code text NOT NULL,
  parameter_snapshot_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  cancelled_at timestamptz,
  CHECK (end_month >= start_month)
);
CREATE INDEX ix_subscription_q_status
ON subscription.subscription(qualification_id,status);

CREATE TABLE subscription.monthly_recognition_schedule (
  recognition_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscription.subscription(subscription_id),
  installment_no integer NOT NULL CHECK (installment_no > 0),
  recognition_month date NOT NULL,
  recognized_amount numeric(18,2) NOT NULL,
  rpv_amount numeric(18,4) NOT NULL,
  status subscription."RecognitionStatus" NOT NULL DEFAULT 'SCHEDULED',
  due_at timestamptz NOT NULL,
  recognized_at timestamptz,
  pv_ledger_event_id uuid UNIQUE REFERENCES ledger.pv_ledger(event_id),
  rule_version_code text NOT NULL,
  parameter_snapshot_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_subscription_installment UNIQUE(subscription_id,installment_no)
);
CREATE INDEX ix_monthly_recognition_due
ON subscription.monthly_recognition_schedule(status,due_at);

CREATE TABLE ledger.rpv_upline_award_event (
  rpv_award_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recognition_id uuid NOT NULL REFERENCES subscription.monthly_recognition_schedule(recognition_id),
  source_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  recipient_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
  binary_generation integer NOT NULL CHECK (binary_generation BETWEEN 1 AND 12),
  effective_direct_count_snapshot integer NOT NULL CHECK (effective_direct_count_snapshot >= 0),
  unlocked_depth_snapshot integer NOT NULL CHECK (unlocked_depth_snapshot IN (5,8,12)),
  active_snapshot boolean NOT NULL,
  theory_amount numeric(18,2) NOT NULL,
  payable_amount numeric(18,2) NOT NULL,
  rule_version_code text NOT NULL,
  parameter_snapshot_hash text,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_rpv_recipient_generation UNIQUE(recognition_id,recipient_qualification_id,binary_generation)
);
CREATE INDEX ix_rpv_award_recipient_time
ON ledger.rpv_upline_award_event(recipient_qualification_id,occurred_at);

CREATE TRIGGER trg_active_period_no_delete
BEFORE DELETE ON membership.active_period
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_subscription_plan_no_delete
BEFORE DELETE ON subscription.subscription_plan
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_subscription_no_delete
BEFORE DELETE ON subscription.subscription
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_recognition_no_delete
BEFORE DELETE ON subscription.monthly_recognition_schedule
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_delete();

CREATE TRIGGER trg_rpv_award_append_only
BEFORE UPDATE OR DELETE ON ledger.rpv_upline_award_event
FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();

COMMENT ON TABLE membership.membership_application IS
'會員申請流程主檔；DRAFT→SUBMITTED→APPROVED→EFFECTIVE。核准後建立Qualification，不直接覆寫歷史。';
COMMENT ON TABLE membership.active_period IS
'Qualification之Active有效期間。歷史獎金判斷必須依事件時點查此表，不得以今日Active重算。';
COMMENT ON TABLE subscription.monthly_recognition_schedule IS
'預付重銷逐月認列排程；季/半年/年分別建立3/6/12列，每月獨立認列2,000元與1,200 RPV。';
COMMENT ON TABLE ledger.rpv_upline_award_event IS
'R1.0B重銷RPV沿Binary Tree向上之每代100元獎勵事件；每位收受者獨立檢查Active及有效直推數5/8/12代解鎖。';
