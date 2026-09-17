-- A shipment, its parcel, and its QC evidence are one fulfillment aggregate.
CREATE UNIQUE INDEX fulfillment_parcel_id_fulfillment_uq
  ON commerce.fulfillment_parcel(fulfillment_parcel_id, fulfillment_id);
CREATE UNIQUE INDEX fulfillment_qc_id_fulfillment_uq
  ON commerce.fulfillment_qc_evidence(fulfillment_qc_evidence_id, fulfillment_id);

ALTER TABLE commerce.shipment DROP CONSTRAINT shipment_parcel_fk;
ALTER TABLE commerce.shipment DROP CONSTRAINT shipment_qc_evidence_fk;
ALTER TABLE commerce.shipment
  ADD CONSTRAINT shipment_parcel_fulfillment_fk
  FOREIGN KEY(fulfillment_parcel_id, fulfillment_id)
  REFERENCES commerce.fulfillment_parcel(fulfillment_parcel_id, fulfillment_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE commerce.shipment
  ADD CONSTRAINT shipment_qc_fulfillment_fk
  FOREIGN KEY(fulfillment_qc_evidence_id, fulfillment_id)
  REFERENCES commerce.fulfillment_qc_evidence(fulfillment_qc_evidence_id, fulfillment_id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Provider identity is normalized through provider_connection_version. Keep the
-- shipment snapshot aligned without duplicating provider_connection_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM commerce.shipment shipment
      JOIN commerce.provider_connection_version version
        ON version.provider_connection_version_id = shipment.provider_connection_version_id
      JOIN commerce.provider_connection connection
        ON connection.provider_connection_id = version.provider_connection_id
     WHERE connection.domain <> 'LOGISTICS'
        OR connection.provider <> shipment.provider
        OR connection.connection_key <> shipment.connection_id
  ) THEN
    RAISE EXCEPTION 'existing shipment provider identity does not match its logistics provider connection version';
  END IF;
END;
$$;

CREATE FUNCTION commerce.ucell_assert_shipment_provider_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM commerce.provider_connection_version version
      JOIN commerce.provider_connection connection
        ON connection.provider_connection_id = version.provider_connection_id
     WHERE version.provider_connection_version_id = NEW.provider_connection_version_id
       AND connection.domain = 'LOGISTICS'
       AND connection.provider = NEW.provider
       AND connection.connection_key = NEW.connection_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'shipment_provider_identity_ck',
      MESSAGE = 'shipment provider identity does not match its logistics provider connection version';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shipment_provider_identity_guard
BEFORE INSERT OR UPDATE OF provider, connection_id, provider_connection_version_id
ON commerce.shipment FOR EACH ROW
EXECUTE FUNCTION commerce.ucell_assert_shipment_provider_identity();

CREATE FUNCTION commerce.ucell_guard_shipment_provider_connection_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM commerce.provider_connection_version version
      JOIN commerce.shipment shipment
        ON shipment.provider_connection_version_id = version.provider_connection_version_id
     WHERE version.provider_connection_id = NEW.provider_connection_id
       AND (
         NEW.domain <> 'LOGISTICS'
         OR shipment.provider <> NEW.provider
         OR shipment.connection_id <> NEW.connection_key
       )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT = 'shipment_provider_identity_ck',
      MESSAGE = 'provider connection identity is referenced by a shipment and cannot become inconsistent';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER provider_connection_shipment_identity_guard
BEFORE UPDATE OF domain, provider, connection_key
ON commerce.provider_connection FOR EACH ROW
EXECUTE FUNCTION commerce.ucell_guard_shipment_provider_connection_identity();
