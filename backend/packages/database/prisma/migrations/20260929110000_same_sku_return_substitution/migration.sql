ALTER TABLE commerce.return_serial_receipt
 ADD COLUMN receipt_type text NOT NULL DEFAULT 'EXACT_SOURCE',
 ADD COLUMN substitution_rule_version text,
 ADD COLUMN eligibility_evidence jsonb NOT NULL DEFAULT '{"format":"UCELL_RETURN_SERIAL_ELIGIBILITY_V1","legacy":true}'::jsonb,
 ADD COLUMN evidence_hash char(64) NOT NULL DEFAULT repeat('0',64),
 ADD CONSTRAINT return_serial_receipt_type_check CHECK (receipt_type IN ('EXACT_SOURCE','SAME_ORDER_SAME_SKU')),
 ADD CONSTRAINT return_serial_receipt_substitution_rule_check CHECK ((receipt_type='EXACT_SOURCE' AND substitution_rule_version IS NULL) OR (receipt_type='SAME_ORDER_SAME_SKU' AND substitution_rule_version='R1.0B_SAME_ORDER_SAME_SKU_V1')),
 ADD CONSTRAINT return_serial_receipt_evidence_format_check CHECK ((eligibility_evidence->>'format') IS NOT DISTINCT FROM 'UCELL_RETURN_SERIAL_ELIGIBILITY_V1'),
 ADD CONSTRAINT return_serial_receipt_evidence_hash_check CHECK (evidence_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION commerce.ucell_validate_return_serial_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE exact_source boolean; governed_substitution boolean;
BEGIN
 PERFORM 1 FROM commerce.return_line WHERE return_line_id=NEW.return_line_id FOR UPDATE;
 SELECT
  rl.order_line_id=sa.order_line_id,
  rl.order_line_id<>sa.order_line_id
   AND NEW.receipt_type='SAME_ORDER_SAME_SKU'
   AND NEW.substitution_rule_version='R1.0B_SAME_ORDER_SAME_SKU_V1'
   AND target.order_id=rc.order_id AND original.order_id=rc.order_id
   AND target.sku_snapshot=sa.sku_snapshot AND original.sku_snapshot=sa.sku_snapshot
   AND target.product_id=original.product_id
   AND COALESCE(target.rule_profile_snapshot->>'returnSerialSubstitutionAllowed','true')<>'false'
   AND COALESCE(original.rule_profile_snapshot->>'returnSerialSubstitutionAllowed','true')<>'false'
   AND COALESCE(target.commercial_offering_snapshot->>'returnSerialSubstitutionAllowed','true')<>'false'
   AND COALESCE(original.commercial_offering_snapshot->>'returnSerialSubstitutionAllowed','true')<>'false'
   AND EXISTS (
    SELECT 1 FROM commerce.fulfillment_source_allocation target_sa
    JOIN commerce.fulfillment_serial_allocation target_a ON target_a.fulfillment_source_allocation_id=target_sa.fulfillment_source_allocation_id
    JOIN commerce.shipment_serial_binding target_b ON target_b.fulfillment_serial_allocation_id=target_a.fulfillment_serial_allocation_id
    WHERE target_sa.fulfillment_id=f.fulfillment_id AND target_sa.order_line_id=rl.order_line_id AND target_b.shipment_id=b.shipment_id
   )
 INTO exact_source,governed_substitution
 FROM commerce.return_line rl
 JOIN commerce.return_case rc ON rc.return_case_id=rl.return_case_id
 JOIN commerce.order_line target ON target.order_line_id=rl.order_line_id
 JOIN commerce.shipment_serial_binding b ON b.shipment_serial_binding_id=NEW.shipment_serial_binding_id
 JOIN commerce.fulfillment_serial_allocation a ON a.fulfillment_serial_allocation_id=b.fulfillment_serial_allocation_id
 JOIN commerce.fulfillment_source_allocation sa ON sa.fulfillment_source_allocation_id=a.fulfillment_source_allocation_id
 JOIN commerce.order_line original ON original.order_line_id=sa.order_line_id
 JOIN commerce.fulfillment f ON f.fulfillment_id=sa.fulfillment_id
 WHERE rl.return_line_id=NEW.return_line_id AND rc.status::text='POSTED' AND f.order_id=rc.order_id;
 IF NEW.receipt_type='EXACT_SOURCE' AND exact_source IS NOT TRUE THEN RAISE EXCEPTION 'RETURN_SERIAL_SOURCE_MISMATCH'; END IF;
 IF NEW.receipt_type='SAME_ORDER_SAME_SKU' AND governed_substitution IS NOT TRUE THEN RAISE EXCEPTION 'RETURN_SERIAL_SUBSTITUTION_INELIGIBLE'; END IF;
 IF NEW.eligibility_evidence->>'format' IS DISTINCT FROM 'UCELL_RETURN_SERIAL_ELIGIBILITY_V1' THEN RAISE EXCEPTION 'RETURN_SERIAL_EVIDENCE_INVALID'; END IF;
 IF (SELECT count(*)+1 FROM commerce.return_serial_receipt WHERE return_line_id=NEW.return_line_id) > (SELECT quantity FROM commerce.return_line WHERE return_line_id=NEW.return_line_id)
 THEN RAISE EXCEPTION 'RETURN_SERIAL_QUANTITY_EXCEEDED'; END IF;
 RETURN NEW;
END $$;
