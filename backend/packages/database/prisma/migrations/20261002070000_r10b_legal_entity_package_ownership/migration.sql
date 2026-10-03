ALTER TABLE commerce.package_purchase_snapshot
  ALTER COLUMN person_id DROP NOT NULL,
  ADD COLUMN legal_entity_id uuid,
  ADD CONSTRAINT package_purchase_snapshot_legal_entity_fk
    FOREIGN KEY (legal_entity_id) REFERENCES identity.legal_entity(legal_entity_id) ON DELETE RESTRICT,
  ADD CONSTRAINT package_purchase_snapshot_exact_buyer_check CHECK (
    num_nonnulls(person_id,legal_entity_id)=1
  );
CREATE INDEX package_purchase_snapshot_legal_entity_idx
  ON commerce.package_purchase_snapshot(legal_entity_id,purchased_at);

ALTER TABLE membership.qualification_setup
  ALTER COLUMN owner_person_id DROP NOT NULL,
  ADD COLUMN owner_legal_entity_id uuid,
  ADD CONSTRAINT qualification_setup_legal_entity_fk
    FOREIGN KEY (owner_legal_entity_id) REFERENCES identity.legal_entity(legal_entity_id) ON DELETE RESTRICT,
  ADD CONSTRAINT qualification_setup_exact_owner_check CHECK (
    num_nonnulls(owner_person_id,owner_legal_entity_id)=1
  );
CREATE INDEX qualification_setup_legal_entity_idx
  ON membership.qualification_setup(owner_legal_entity_id,setup_status);
