ALTER TABLE identity.referral_attribution_history
 ADD COLUMN bound_person_id uuid REFERENCES identity.person(person_id);

CREATE INDEX referral_attribution_history_bound_person_idx
 ON identity.referral_attribution_history(bound_person_id,occurred_at)
 WHERE bound_person_id IS NOT NULL;
