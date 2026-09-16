CREATE TABLE membership.qualification_setup (
 qualification_id uuid PRIMARY KEY REFERENCES membership.qualification(qualification_id),
 owner_person_id uuid NOT NULL REFERENCES identity.person(person_id),
 qualifying_order_id uuid NOT NULL REFERENCES commerce."order"(order_id),
 package_type text NOT NULL CHECK(package_type IN ('STARTER','ELITE','LEADER')),
 setup_status text NOT NULL CHECK(setup_status IN ('PURCHASE_PENDING','PURCHASED','BALL_SETUP_PENDING','PLACEMENT_PENDING','PLACEMENT_OVERDUE','PLACED','ACTIVE','CANCELLED','REVERSED')),
 provisional_attribution_id uuid REFERENCES identity.referral_attribution(referral_attribution_id),
 final_sponsor_qualification_id uuid REFERENCES membership.qualification(qualification_id),
 placement_requested_at timestamptz(6), placement_due_at timestamptz(6), placed_at timestamptz(6),
 setup_policy_version text NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT now(), updated_at timestamptz(6) NOT NULL DEFAULT now(),
 CHECK((placement_requested_at IS NULL AND placement_due_at IS NULL) OR placement_due_at=placement_requested_at+interval '72 hours'),
 CHECK(placed_at IS NULL OR setup_status IN ('PLACED','ACTIVE'))
);
CREATE INDEX qualification_setup_owner_status_idx ON membership.qualification_setup(owner_person_id,setup_status);
CREATE INDEX qualification_setup_sponsor_status_due_idx ON membership.qualification_setup(final_sponsor_qualification_id,setup_status,placement_due_at);

CREATE TABLE organization.qualification_sponsor_selection_evidence (
 qualification_sponsor_selection_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 attribution_referrer_person_id uuid REFERENCES identity.person(person_id), attribution_referrer_qualification_id uuid REFERENCES membership.qualification(qualification_id),
 selected_sponsor_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id), selected_sponsor_owner_person_id uuid NOT NULL REFERENCES identity.person(person_id),
 selected_by_person_id uuid NOT NULL REFERENCES identity.person(person_id), selected_at timestamptz(6) NOT NULL, source text NOT NULL CHECK(source IN ('ATTRIBUTION_PREFILL','MANUAL_INPUT','SYSTEM_ASSIGNMENT')),
 policy_version text NOT NULL, correlation_id uuid NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX sponsor_selection_qualification_time_idx ON organization.qualification_sponsor_selection_evidence(qualification_id,selected_at);

CREATE TABLE organization.placement_evidence (
 placement_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qualification_id uuid NOT NULL UNIQUE REFERENCES membership.qualification(qualification_id),
 sponsor_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id), binary_parent_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 side organization."SideCode" NOT NULL, placed_by_type text NOT NULL CHECK(placed_by_type IN ('SPONSOR_OWNER','ADMIN_OVERRIDE','SYSTEM_AUTO')),
 placed_by_person_id uuid REFERENCES identity.person(person_id), placed_at timestamptz(6) NOT NULL, reason_code text, policy_version text NOT NULL,
 previous_status text NOT NULL, correlation_id uuid NOT NULL, evidence_hash text NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX placement_evidence_sponsor_time_idx ON organization.placement_evidence(sponsor_qualification_id,placed_at);
CREATE INDEX placement_evidence_parent_side_time_idx ON organization.placement_evidence(binary_parent_qualification_id,side,placed_at);

CREATE TABLE organization.placement_escalation_evidence (
 placement_escalation_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 due_at timestamptz(6) NOT NULL, escalated_at timestamptz(6) NOT NULL, escalation_type text NOT NULL CHECK(escalation_type IN ('OVERDUE_72H','MANUAL_REVIEW')),
 status text NOT NULL CHECK(status IN ('OPEN','RESOLVED')), assigned_admin_id uuid REFERENCES identity.person(person_id), resolved_at timestamptz(6),
 resolution_placement_evidence_id uuid REFERENCES organization.placement_evidence(placement_evidence_id), correlation_id uuid NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE(qualification_id,escalation_type,due_at)
);
CREATE INDEX placement_escalation_status_due_idx ON organization.placement_escalation_evidence(status,due_at);

CREATE TABLE identity.member_referral_relationship (
 member_referral_relationship_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), referred_person_id uuid NOT NULL REFERENCES identity.person(person_id), referrer_person_id uuid NOT NULL REFERENCES identity.person(person_id),
 first_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id), source_sponsor_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 effective_from timestamptz(6) NOT NULL, effective_to timestamptz(6), source_type text NOT NULL, correlation_id uuid NOT NULL, evidence_hash text NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now(), CHECK(referred_person_id<>referrer_person_id), CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE UNIQUE INDEX member_referral_one_current_idx ON identity.member_referral_relationship(referred_person_id) WHERE effective_to IS NULL;
CREATE INDEX member_referral_referrer_time_idx ON identity.member_referral_relationship(referrer_person_id,effective_from,effective_to);

CREATE UNIQUE INDEX binary_placement_one_open_slot_idx ON organization.binary_placement(parent_qualification_id,side) WHERE effective_to IS NULL;

CREATE TRIGGER qualification_sponsor_selection_evidence_append_only BEFORE UPDATE OR DELETE ON organization.qualification_sponsor_selection_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER placement_evidence_append_only BEFORE UPDATE OR DELETE ON organization.placement_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER placement_escalation_evidence_append_only BEFORE UPDATE OR DELETE ON organization.placement_escalation_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
CREATE TRIGGER member_referral_relationship_append_only BEFORE UPDATE OR DELETE ON identity.member_referral_relationship FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
