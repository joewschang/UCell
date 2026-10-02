-- Extend the existing exact-owner checks prospectively. No ownership rows or
-- historical intervals are rewritten; range and overlap constraints remain.
ALTER TABLE membership.qualification
  DROP CONSTRAINT qualification_explicit_owner_xor;
ALTER TABLE membership.qualification
  ADD CONSTRAINT qualification_explicit_owner_xor CHECK (
    num_nonnulls(current_holder_person_id,current_holder_legal_entity_id,current_company_principal_id)=1
  );

ALTER TABLE membership.qualification_owner_interval
  DROP CONSTRAINT owner_interval_principal_xor;
ALTER TABLE membership.qualification_owner_interval
  ADD CONSTRAINT owner_interval_principal_xor CHECK (
    (owner_type='MEMBER' AND person_id IS NOT NULL AND legal_entity_id IS NULL AND company_principal_id IS NULL)
    OR
    (owner_type='LEGAL_ENTITY' AND person_id IS NULL AND legal_entity_id IS NOT NULL AND company_principal_id IS NULL)
    OR
    (owner_type='COMPANY' AND person_id IS NULL AND legal_entity_id IS NULL AND company_principal_id IS NOT NULL)
  );
