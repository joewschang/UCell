CREATE FUNCTION identity.reject_contract_version_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'contract document version is immutable';
END $$;
CREATE TRIGGER contract_document_version_immutable BEFORE UPDATE OR DELETE ON identity.contract_document_version
FOR EACH ROW EXECUTE FUNCTION identity.reject_contract_version_mutation();
