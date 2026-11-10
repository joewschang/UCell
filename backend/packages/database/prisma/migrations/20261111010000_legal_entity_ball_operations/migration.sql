DO $migration$
DECLARE
  source text;
  old_predicate text := 'o.owner_type=''MEMBER'' AND o.person_id=fact.initial_person_id';
BEGIN
  IF to_regclass('ledger.nhi_payout_entity_profile') IS NOT NULL THEN RETURN; END IF;
  ALTER TABLE organization.founding_occupation_evidence
    ADD COLUMN initial_legal_entity_id uuid REFERENCES identity.legal_entity(legal_entity_id),
    ALTER COLUMN initial_person_id DROP NOT NULL,
    ADD CONSTRAINT founding_exact_initial_owner CHECK (num_nonnulls(initial_person_id, initial_legal_entity_id)=1);
  SELECT pg_get_functiondef('organization.ucell_verify_canonical_occupation()'::regprocedure) INTO source;
  IF strpos(source,old_predicate)=0 THEN RAISE EXCEPTION 'Unexpected founding evidence validation'; END IF;
  EXECUTE replace(source,old_predicate,'((' || old_predicate || ') OR (o.owner_type=''LEGAL_ENTITY'' AND o.legal_entity_id=fact.initial_legal_entity_id))');
  ALTER TABLE organization.qualification_sponsor_selection_evidence ADD COLUMN selected_sponsor_owner_legal_entity_id uuid REFERENCES identity.legal_entity(legal_entity_id),
    ADD CONSTRAINT sponsor_at_most_one_member_owner CHECK (num_nonnulls(selected_sponsor_owner_legal_entity_id,selected_sponsor_owner_person_id)<=1);
  CREATE TABLE ledger.nhi_payout_entity_profile (
    legal_entity_id uuid PRIMARY KEY REFERENCES identity.legal_entity(legal_entity_id),
    payload jsonb NOT NULL, updated_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
  );
END
$migration$;
