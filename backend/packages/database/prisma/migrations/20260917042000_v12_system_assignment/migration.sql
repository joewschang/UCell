CREATE TABLE rules.system_assignment_policy (
 system_assignment_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), version text NOT NULL UNIQUE,
 effective_from timestamptz(6) NOT NULL, effective_to timestamptz(6), pool_selector text NOT NULL,
 tie_break_strategy text NOT NULL, capacity_policy text NOT NULL, exclusion_policy text NOT NULL,
 lock_strategy text NOT NULL, config_hash text NOT NULL, approval_reference text NOT NULL,
 status text NOT NULL DEFAULT 'ACTIVE', created_at timestamptz(6) NOT NULL DEFAULT now(),
 CHECK(effective_to IS NULL OR effective_to>effective_from)
);
CREATE INDEX system_assignment_policy_effective_idx ON rules.system_assignment_policy(status,effective_from,effective_to);
CREATE TABLE rules.system_assignment_pool_entry (
 system_assignment_pool_entry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system_assignment_policy_id uuid NOT NULL REFERENCES rules.system_assignment_policy(system_assignment_policy_id),
 qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id), priority_class integer NOT NULL,
 capacity_limit integer, eligibility_state text NOT NULL, enabled_from timestamptz(6) NOT NULL, enabled_to timestamptz(6),
 approval_reference text NOT NULL, created_at timestamptz(6) NOT NULL DEFAULT now(),
 UNIQUE(system_assignment_policy_id,qualification_id), CHECK(priority_class>=0), CHECK(capacity_limit IS NULL OR capacity_limit>0), CHECK(enabled_to IS NULL OR enabled_to>enabled_from)
);
CREATE INDEX system_assignment_pool_eligible_idx ON rules.system_assignment_pool_entry(eligibility_state,enabled_from,enabled_to);
CREATE TABLE organization.system_assignment_evidence (
 system_assignment_evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), system_assignment_policy_id uuid NOT NULL REFERENCES rules.system_assignment_policy(system_assignment_policy_id),
 child_qualification_id uuid NOT NULL UNIQUE REFERENCES membership.qualification(qualification_id), selected_root_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id),
 binary_parent_qualification_id uuid NOT NULL REFERENCES membership.qualification(qualification_id), binary_side organization."SideCode" NOT NULL,
 root_descendant_count integer NOT NULL, policy_version text NOT NULL, policy_hash text NOT NULL, input_evidence jsonb NOT NULL, output_evidence jsonb NOT NULL,
 correlation_id uuid NOT NULL, executed_at timestamptz(6) NOT NULL, CHECK(root_descendant_count>=0)
);
CREATE INDEX system_assignment_evidence_root_time_idx ON organization.system_assignment_evidence(selected_root_qualification_id,executed_at);
CREATE TRIGGER system_assignment_evidence_append_only BEFORE UPDATE OR DELETE ON organization.system_assignment_evidence FOR EACH ROW EXECUTE FUNCTION public.ucell_prevent_mutation();
