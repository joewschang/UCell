CREATE TABLE identity.referral_link (
 referral_link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE,
 referrer_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 policy_version text NOT NULL, status text NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz(6) NOT NULL DEFAULT now(), expires_at timestamptz(6) NOT NULL,
 CONSTRAINT referral_link_window_check CHECK (expires_at > created_at)
);
CREATE INDEX referral_link_referrer_created_idx ON identity.referral_link(referrer_qualification_id,created_at);

CREATE TABLE identity.referral_attribution (
 referral_attribution_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anonymous_id uuid NOT NULL UNIQUE,
 person_id uuid REFERENCES identity.person(person_id), referrer_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 referral_link_id uuid NOT NULL REFERENCES identity.referral_link(referral_link_id),
 first_touch_at timestamptz(6) NOT NULL, last_touch_at timestamptz(6) NOT NULL, locked_until timestamptz(6) NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE', version integer NOT NULL DEFAULT 1,
 created_at timestamptz(6) NOT NULL DEFAULT now(), updated_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT referral_attribution_window_check CHECK (last_touch_at >= first_touch_at AND locked_until > first_touch_at)
);
CREATE INDEX referral_attribution_person_status_idx ON identity.referral_attribution(person_id,status);
CREATE INDEX referral_attribution_referrer_status_idx ON identity.referral_attribution(referrer_qualification_id,status);

CREATE TABLE identity.referral_attribution_history (
 referral_attribution_history_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 referral_attribution_id uuid NOT NULL REFERENCES identity.referral_attribution(referral_attribution_id),
 action text NOT NULL, previous_referrer_qualification_id uuid REFERENCES membership.qualification(qualification_id), new_referrer_qualification_id uuid REFERENCES membership.qualification(qualification_id),
 reason_code text NOT NULL, referral_link_id uuid REFERENCES identity.referral_link(referral_link_id), correlation_id uuid NOT NULL,
 occurred_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX referral_attribution_history_attribution_time_idx ON identity.referral_attribution_history(referral_attribution_id,occurred_at);
CREATE TRIGGER referral_attribution_history_append_only BEFORE UPDATE OR DELETE ON identity.referral_attribution_history FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
